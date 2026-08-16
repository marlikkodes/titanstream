import { Injectable, Logger, OnModuleInit, Optional, Inject, forwardRef } from '@nestjs/common';
import { EventBusService, PlatformEvent } from './event-bus.service';
import { PrismaService } from '../../database/prisma.service';
import { DomainEventType, GrowthEventType, OperationsQueueStatus } from '@prisma/client';
import { GrowthEventService } from '../growth/growth-event.service';

@Injectable()
export class AutomationService implements OnModuleInit {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly prisma: PrismaService,
    @Optional() @Inject(forwardRef(() => GrowthEventService)) private readonly growthEventService?: GrowthEventService,
  ) {}

  onModuleInit() {
    this.logger.log('Initializing Automation triggers & subscribers...');

    // 1. Subscribe to SettlementCompleted events
    this.eventBus.on('SettlementCompleted').subscribe({
      next: async (event: PlatformEvent) => {
        try {
          await this.handleSettlementCompleted(event);
        } catch (err: any) {
          await this.escalateFailure('SETTLEMENT_COMPLETED_AUTOMATION_FAILED', event, err);
        }
      },
    });

    // 2. Subscribe to WithdrawalRequested events
    this.eventBus.on('WithdrawalRequested').subscribe({
      next: async (event: PlatformEvent) => {
        try {
          await this.handleWithdrawalRequested(event);
        } catch (err: any) {
          await this.escalateFailure('WITHDRAWAL_REQUESTED_AUTOMATION_FAILED', event, err);
        }
      },
    });

    // 3. Subscribe to WithdrawalCompleted events
    this.eventBus.on('WithdrawalCompleted').subscribe({
      next: async (event: PlatformEvent) => {
        try {
          await this.handleWithdrawalCompleted(event);
        } catch (err: any) {
          await this.escalateFailure('WITHDRAWAL_COMPLETED_AUTOMATION_FAILED', event, err);
        }
      },
    });
  }

  /**
   * Handle when a settlement completes successfully.
   * Auto-credits referrals and tracks campaigns.
   */
  private async handleSettlementCompleted(event: PlatformEvent) {
    const { settlementId, userId: rawUserId, telegramUserId, amount, asset } = event.payload;
    this.logger.log(`[Automation] Processing SettlementCompleted trigger for settlement ${settlementId}`);

    const userKey = rawUserId || telegramUserId;
    const isUuid = typeof userKey === 'string' && userKey.includes('-');
    let user: any = null;

    if (isUuid) {
      user = await this.prisma.user.findUnique({ where: { id: userKey } });
    } else if (telegramUserId) {
      user = await this.prisma.user.findUnique({ where: { telegramUserId: BigInt(telegramUserId) } });
    }

    const canonicalUserId = user?.id || (isUuid ? userKey : undefined);
    const tgUserIdBig = user?.telegramUserId || (!isUuid && telegramUserId ? BigInt(telegramUserId) : BigInt(0));

    // Standard timeline integration: record domain event in audit trail
    await this.prisma.financialDomainEvent.create({
      data: {
        eventType: DomainEventType.BALANCE_CHANGED,
        telegramUserId: tgUserIdBig,
        payload: JSON.parse(JSON.stringify({
          action: 'SETTLEMENT_COMPLETED',
          settlementId,
          userId: canonicalUserId,
          amount,
          asset,
          correlationId: event.correlationId,
        })),
      },
    });

    // Trigger growth domain event to evaluate referral eligibility, trust score, and rewards
    if (this.growthEventService && user) {
      this.logger.log(`[Automation] Emitting SETTLEMENT_COMPLETED to GrowthEventService for user ${user.id}`);
      await this.growthEventService.publish({
        telegramUserId: user.telegramUserId || undefined,
        eventType: GrowthEventType.SETTLEMENT_COMPLETED,
        payload: {
          settlementId,
          userId: user.id,
          telegramUserId: user.telegramUserId ? user.telegramUserId.toString() : undefined,
          amount: amount?.toString(),
          asset: asset || 'USDT',
        },
        correlationId: event.correlationId,
      });
    }
  }

  /**
   * Handle when a withdrawal is requested.
   */
  private async handleWithdrawalRequested(event: PlatformEvent) {
    const { withdrawalId, userId: rawUserId, telegramUserId, amount } = event.payload;
    this.logger.log(`[Automation] Processing WithdrawalRequested trigger for withdrawal ${withdrawalId}`);

    const userKey = rawUserId || telegramUserId;
    const isUuid = typeof userKey === 'string' && userKey.includes('-');
    let user: any = null;

    if (isUuid) {
      user = await this.prisma.user.findUnique({ where: { id: userKey } });
    } else if (telegramUserId) {
      user = await this.prisma.user.findUnique({ where: { telegramUserId: BigInt(telegramUserId) } });
    }

    const canonicalUserId = user?.id || (isUuid ? userKey : undefined);
    const tgUserIdBig = user?.telegramUserId || (!isUuid && telegramUserId ? BigInt(telegramUserId) : BigInt(0));

    // Create tracking timeline record
    await this.prisma.financialDomainEvent.create({
      data: {
        eventType: DomainEventType.LEDGER_POSTING_STARTED,
        telegramUserId: tgUserIdBig,
        payload: JSON.parse(JSON.stringify({
          action: 'WITHDRAWAL_REQUESTED',
          withdrawalId,
          userId: canonicalUserId,
          amount,
          correlationId: event.correlationId,
        })),
      },
    });
  }

  /**
   * Handle when a withdrawal completes.
   */
  private async handleWithdrawalCompleted(event: PlatformEvent) {
    const { withdrawalId, userId: rawUserId, telegramUserId, amount } = event.payload;
    this.logger.log(`[Automation] Processing WithdrawalCompleted trigger for withdrawal ${withdrawalId}`);

    const userKey = rawUserId || telegramUserId;
    const isUuid = typeof userKey === 'string' && userKey.includes('-');
    let user: any = null;

    if (isUuid) {
      user = await this.prisma.user.findUnique({ where: { id: userKey } });
    } else if (telegramUserId) {
      user = await this.prisma.user.findUnique({ where: { telegramUserId: BigInt(telegramUserId) } });
    }

    const canonicalUserId = user?.id || (isUuid ? userKey : undefined);
    const tgUserIdBig = user?.telegramUserId || (!isUuid && telegramUserId ? BigInt(telegramUserId) : BigInt(0));

    // Finalize timeline record
    await this.prisma.financialDomainEvent.create({
      data: {
        eventType: DomainEventType.LEDGER_POSTING_COMPLETED,
        telegramUserId: tgUserIdBig,
        payload: JSON.parse(JSON.stringify({
          action: 'WITHDRAWAL_COMPLETED',
          withdrawalId,
          userId: canonicalUserId,
          amount,
          correlationId: event.correlationId,
        })),
      },
    });
  }

  /**
   * Enforce No Silent Failure: write errors during event automation to operations DLQ queue.
   */
  private async escalateFailure(reason: string, event: PlatformEvent, error: Error) {
    this.logger.error(`[Automation] Trigger execution failed for event ${event.type}: ${error.message}`);
    await this.prisma.operationsQueueItem.create({
      data: {
        reason,
        status: OperationsQueueStatus.OPEN,
        payload: {
          eventId: event.id,
          eventType: event.type,
          correlationId: event.correlationId,
          error: error.message,
          stack: error.stack,
          originalEvent: JSON.parse(JSON.stringify(event)),
        },
      },
    });
  }
}
