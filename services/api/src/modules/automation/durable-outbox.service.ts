import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import { OutboxStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { EventBusService, PlatformEvent } from './event-bus.service';
import { NotificationService, NotificationPayload } from '../notification/notification.service';

export interface DurableEventPayload {
  eventId: string;
  eventType: string;
  telegramUserId: bigint;
  category?: 'SECURITY' | 'FINANCIAL' | 'CHALLENGE' | 'SYSTEM' | 'INFORMATIONAL' | 'PROMOTIONAL';
  priority?: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
  correlationId?: string;
  payload: Record<string, any>;
  maxAttempts?: number;
}

@Injectable()
export class DurableOutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DurableOutboxService.name);
  private pollerTimer?: NodeJS.Timeout;
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService: NotificationService,
  ) {}

  onModuleInit() {
    this.logger.log('Initializing Transactional Durable Outbox Engine & Recovery Loop...');
    // Start background poller loop every 3 seconds
    this.pollerTimer = setInterval(() => {
      this.pollAndDispatchOutbox().catch((err) => {
        this.logger.error(`[DurableOutbox] Poller error: ${err.message}`);
      });
    }, 3000);

    // Subscribe to EventBus for immediate real-time notifications
    this.eventBus.stream.subscribe({
      next: (event: PlatformEvent) => {
        this.enqueueFromEventBus(event).catch((err) => {
          this.logger.warn(`[DurableOutbox] Failed to enqueue event from EventBus: ${err.message}`);
        });
      },
    });
  }

  onModuleDestroy() {
    if (this.pollerTimer) {
      clearInterval(this.pollerTimer);
    }
  }

  /**
   * Transactional Outbox Writer:
   * Writes event durably to PostgreSQL inside an existing Prisma transaction client if provided,
   * or standard Prisma client.
   */
  async writeOutboxEvent(
    data: DurableEventPayload,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || this.prisma;
    try {
      const existing = await db.notificationOutbox.findUnique({
        where: { eventId: data.eventId },
      });
      if (existing) return existing;

      const record = await db.notificationOutbox.create({
        data: {
          eventId: data.eventId,
          eventType: data.eventType,
          category: data.category || 'INFORMATIONAL',
          priority: data.priority || 'NORMAL',
          telegramUserId: data.telegramUserId,
          correlationId: data.correlationId || null,
          payload: (data.payload || {}) as Prisma.InputJsonValue,
          status: OutboxStatus.PENDING,
          attempts: 0,
          maxAttempts: data.maxAttempts || 5,
          availableAt: new Date(),
        },
      });

      this.logger.log(`[DurableOutbox] Transactional outbox event created: ${data.eventId} (${data.eventType})`);
      return record;
    } catch (err: any) {
      if (err.code === 'P2002') {
        this.logger.log(`[DurableOutbox] Duplicate event ${data.eventId} suppressed by unique constraint.`);
        return;
      }
      this.logger.error(`[DurableOutbox] Failed to write outbox event ${data.eventId}: ${err.message}`);
      throw err;
    }
  }

  /**
   * Fallback subscriber for in-memory EventBus events to guarantee DB persistence
   */
  private async enqueueFromEventBus(event: PlatformEvent) {
    if (!event.payload || !event.payload.telegramUserId) return;

    const telegramUserId = BigInt(event.payload.telegramUserId);
    const eventId = event.id || `evt_${event.type}_${telegramUserId}_${event.correlationId || Date.now()}`;

    // Priority mapping
    let priority: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW' = 'NORMAL';
    let category: 'SECURITY' | 'FINANCIAL' | 'CHALLENGE' | 'SYSTEM' | 'INFORMATIONAL' | 'PROMOTIONAL' = 'INFORMATIONAL';

    if (event.type.includes('Security') || event.type.includes('StepUp')) {
      priority = 'CRITICAL';
      category = 'SECURITY';
    } else if (event.type.includes('Settlement') || event.type.includes('Withdrawal')) {
      priority = 'HIGH';
      category = 'FINANCIAL';
    } else if (event.type.includes('Reward') || event.type.includes('Mission')) {
      priority = 'NORMAL';
      category = 'CHALLENGE';
    }

    await this.writeOutboxEvent({
      eventId,
      eventType: event.type,
      telegramUserId,
      correlationId: event.correlationId,
      category,
      priority,
      payload: event.payload,
    });
  }

  /**
   * Main Outbox Poller & Dispatcher
   * Fetches PENDING / RETRYING events using PostgreSQL row locking & lease reclamation.
   */
  async pollAndDispatchOutbox() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const now = new Date();
      const leaseTimeout = new Date(now.getTime() - 60 * 1000); // 60s lease timeout for worker crash recovery

      // 1. Reclaim stuck PROCESSING items whose worker died (>60s ago)
      await this.prisma.notificationOutbox.updateMany({
        where: {
          status: OutboxStatus.PROCESSING,
          updatedAt: { lt: leaseTimeout },
        },
        data: {
          status: OutboxStatus.RETRYING,
          availableAt: now,
        },
      });

      // 2. Claim available PENDING & RETRYING events sorted by priority & creation time
      const itemsToProcess = await this.prisma.notificationOutbox.findMany({
        where: {
          status: { in: [OutboxStatus.PENDING, OutboxStatus.RETRYING] },
          availableAt: { lte: now },
        },
        take: 20,
        orderBy: [
          { priority: 'desc' },
          { availableAt: 'asc' },
        ],
      });

      if (itemsToProcess.length === 0) {
        this.isProcessing = false;
        return;
      }

      for (const item of itemsToProcess) {
        // Atomic claim: set status to PROCESSING with lock timeout
        const claimed = await this.prisma.notificationOutbox.updateMany({
          where: {
            id: item.id,
            status: { in: [OutboxStatus.PENDING, OutboxStatus.RETRYING] },
          },
          data: {
            status: OutboxStatus.PROCESSING,
            updatedAt: now,
          },
        });

        if (claimed.count === 0) continue; // Claimed by concurrent worker

        try {
          // Map outbox eventType to NotificationTemplate code
          const templateCode = this.mapEventTypeToTemplateCode(item.eventType);
          if (templateCode) {
            const payloadVars = this.extractVariablesFromPayload(item.payload);

            await this.notificationService.dispatchNotification({
              userId: item.telegramUserId,
              templateCode,
              category: item.category as any,
              priority: item.priority as any,
              variables: payloadVars,
              correlationId: item.correlationId || item.eventId,
            });
          }

          // Mark COMPLETED
          await this.prisma.notificationOutbox.update({
            where: { id: item.id },
            data: {
              status: OutboxStatus.COMPLETED,
              processedAt: new Date(),
              lastError: null,
            },
          });

          this.logger.log(`[DurableOutbox] Event ${item.eventId} (${item.eventType}) dispatched & completed successfully.`);
        } catch (dispatchErr: any) {
          const nextAttempts = item.attempts + 1;
          const isFinalFailure = nextAttempts >= item.maxAttempts;
          const backoffSec = Math.pow(2, nextAttempts) * 5; // Exponential backoff: 10s, 20s, 40s...
          const nextAvailable = new Date(Date.now() + backoffSec * 1000);

          await this.prisma.notificationOutbox.update({
            where: { id: item.id },
            data: {
              attempts: nextAttempts,
              status: isFinalFailure ? OutboxStatus.FAILED : OutboxStatus.RETRYING,
              availableAt: nextAvailable,
              lastError: dispatchErr.message,
            },
          });

          this.logger.warn(`[DurableOutbox] Event ${item.eventId} dispatch failed (Attempt ${nextAttempts}/${item.maxAttempts}): ${dispatchErr.message}`);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private mapEventTypeToTemplateCode(eventType: string): string | null {
    switch (eventType) {
      case 'SettlementCreated':
        return 'SETTLEMENT_CREATED';
      case 'SettlementCompleted':
        return 'SETTLEMENT_APPROVED';
      case 'SettlementFailed':
        return 'SETTLEMENT_FAILED';
      case 'WithdrawalRequested':
        return 'WITHDRAWAL_REQUESTED';
      case 'WithdrawalCompleted':
        return 'WITHDRAWAL_COMPLETED';
      case 'WithdrawalRejected':
        return 'WITHDRAWAL_REJECTED';
      case 'MissionClaimable':
        return 'MISSION_CLAIMABLE';
      case 'RewardAwarded':
        return 'REWARD_AWARDED';
      case 'SecurityStepUpRequired':
        return 'SECURITY_STEP_UP_REQUIRED';
      case 'NewDeviceLogin':
        return 'NEW_DEVICE_LOGIN';
      default:
        return null;
    }
  }

  private extractVariablesFromPayload(payload: any): Record<string, string> {
    if (!payload || typeof payload !== 'object') return {};
    const res: Record<string, string> = {};
    Object.entries(payload).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        res[k] = String(v);
      }
    });
    return res;
  }
}
