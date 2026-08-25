import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { NotificationChannel, Prisma, IdentityProvider } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { EventBusService, PlatformEvent } from '../automation/event-bus.service';
import { BaileysAccountManagerService } from './baileys-account-manager.service';

export interface NotificationPayload {
  userId: bigint;
  templateCode: string;
  variables?: Record<string, string>;
  priority?: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
  correlationId?: string;
  message?: string;
  category?: 'SECURITY' | 'FINANCIAL' | 'CHALLENGE' | 'SYSTEM' | 'INFORMATIONAL' | 'PROMOTIONAL';
}

@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    @Inject(forwardRef(() => BaileysAccountManagerService))
    private readonly baileysAccountManager: BaileysAccountManagerService,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing Centralized Notification Engine & Event Bus listeners...');
    try {
      await this.ensureDefaultTemplates();
    } catch (err: any) {
      this.logger.warn(`Failed to seed default notification templates on startup: ${err?.message}`);
    }

    // 1. Listen for Financial: SettlementCreated
    this.eventBus.on('SettlementCreated').subscribe({
      next: async (event: PlatformEvent) => {
        const { telegramUserId, amount, asset, settlementId } = event.payload;
        await this.dispatchNotification({
          userId: BigInt(telegramUserId),
          templateCode: 'SETTLEMENT_CREATED',
          category: 'FINANCIAL',
          priority: 'NORMAL',
          variables: { amount: String(amount), asset: String(asset), reference: String(settlementId) },
          correlationId: event.correlationId,
        });
      },
    });

    // 2. Listen for Financial: SettlementCompleted
    this.eventBus.on('SettlementCompleted').subscribe({
      next: async (event: PlatformEvent) => {
        const { telegramUserId, amount, asset, settlementId } = event.payload;
        await this.dispatchNotification({
          userId: BigInt(telegramUserId),
          templateCode: 'SETTLEMENT_APPROVED',
          category: 'FINANCIAL',
          priority: 'HIGH',
          variables: { amount: String(amount), asset: String(asset), reference: String(settlementId) },
          correlationId: event.correlationId,
        });
      },
    });

    // 3. Listen for Financial: SettlementFailed
    this.eventBus.on('SettlementFailed').subscribe({
      next: async (event: PlatformEvent) => {
        const { telegramUserId, amount, asset, settlementId, reason } = event.payload;
        await this.dispatchNotification({
          userId: BigInt(telegramUserId),
          templateCode: 'SETTLEMENT_FAILED',
          category: 'FINANCIAL',
          priority: 'HIGH',
          variables: { amount: String(amount), asset: String(asset), reference: String(settlementId), reason: String(reason || 'Processing failed') },
          correlationId: event.correlationId,
        });
      },
    });

    // 4. Listen for Financial: WithdrawalRequested
    this.eventBus.on('WithdrawalRequested').subscribe({
      next: async (event: PlatformEvent) => {
        const { telegramUserId, amount, network, withdrawalId } = event.payload;
        await this.dispatchNotification({
          userId: BigInt(telegramUserId),
          templateCode: 'WITHDRAWAL_REQUESTED',
          category: 'FINANCIAL',
          priority: 'NORMAL',
          variables: { amount: String(amount), network: String(network), reference: String(withdrawalId) },
          correlationId: event.correlationId,
        });
      },
    });

    // 5. Listen for Financial: WithdrawalCompleted
    this.eventBus.on('WithdrawalCompleted').subscribe({
      next: async (event: PlatformEvent) => {
        const { telegramUserId, amount, withdrawalId } = event.payload;
        await this.dispatchNotification({
          userId: BigInt(telegramUserId),
          templateCode: 'WITHDRAWAL_COMPLETED',
          category: 'FINANCIAL',
          priority: 'HIGH',
          variables: { amount: String(amount), reference: String(withdrawalId) },
          correlationId: event.correlationId,
        });
      },
    });

    // 6. Listen for Financial: WithdrawalRejected
    this.eventBus.on('WithdrawalRejected').subscribe({
      next: async (event: PlatformEvent) => {
        const { telegramUserId, amount, withdrawalId, reason } = event.payload;
        await this.dispatchNotification({
          userId: BigInt(telegramUserId),
          templateCode: 'WITHDRAWAL_REJECTED',
          category: 'FINANCIAL',
          priority: 'HIGH',
          variables: { amount: String(amount), reference: String(withdrawalId), reason: String(reason || 'Rejected by system') },
          correlationId: event.correlationId,
        });
      },
    });

    // 7. Listen for Challenge/Mission: MissionClaimable
    this.eventBus.on('MissionClaimable').subscribe({
      next: async (event: PlatformEvent) => {
        const { telegramUserId, missionName, rewardAmount } = event.payload;
        await this.dispatchNotification({
          userId: BigInt(telegramUserId),
          templateCode: 'MISSION_CLAIMABLE',
          category: 'CHALLENGE',
          priority: 'NORMAL',
          variables: { missionName: String(missionName), rewardAmount: String(rewardAmount) },
          correlationId: event.correlationId,
        });
      },
    });

    // 8. Listen for Challenge/Mission: RewardAwarded
    this.eventBus.on('RewardAwarded').subscribe({
      next: async (event: PlatformEvent) => {
        const { telegramUserId, amount, asset, rewardType } = event.payload;
        await this.dispatchNotification({
          userId: BigInt(telegramUserId),
          templateCode: 'REWARD_AWARDED',
          category: 'CHALLENGE',
          priority: 'NORMAL',
          variables: { amount: String(amount), asset: String(asset), rewardType: String(rewardType) },
          correlationId: event.correlationId,
        });
      },
    });

    // 9. Listen for Security: SecurityStepUpRequired
    this.eventBus.on('SecurityStepUpRequired').subscribe({
      next: async (event: PlatformEvent) => {
        const { telegramUserId, action } = event.payload;
        await this.dispatchNotification({
          userId: BigInt(telegramUserId),
          templateCode: 'SECURITY_STEP_UP_REQUIRED',
          category: 'SECURITY',
          priority: 'CRITICAL',
          variables: { action: String(action || 'action') },
          correlationId: event.correlationId,
        });
      },
    });
  }

  /**
   * Main Notification Dispatcher Engine:
   * 1. Check idempotency.
   * 2. Persist In-App NotificationRecord.
   * 3. Resolve user WhatsApp channel identity & user preferences.
   * 4. Dispatch WhatsApp notification through Baileys transport.
   */
  async dispatchNotification(payload: NotificationPayload) {
    try {
      // 1. Database-Enforced Idempotency Key
      const channelTag = NotificationChannel.IN_APP;
      const idempotencyKey = payload.correlationId 
        ? `${payload.templateCode}_${payload.userId}_${payload.correlationId}_${channelTag}`
        : null;

      if (idempotencyKey) {
        const existing = await this.prisma.notificationRecord.findUnique({
          where: { idempotencyKey },
        });
        if (existing) {
          this.logger.log(`[NotificationEngine] Idempotent duplicate suppressed for user ${payload.userId} template ${payload.templateCode}`);
          return existing;
        }
      }

      const template = await this.prisma.notificationTemplate.findUnique({
        where: { code: payload.templateCode },
      });

      if (!template || !template.enabled) {
        this.logger.warn(`Template ${payload.templateCode} not found or disabled. Skipping.`);
        return;
      }

      // Format template body with variables
      let message = template.bodyTemplate;
      if (payload.variables) {
        Object.entries(payload.variables).forEach(([key, val]) => {
          message = message.replace(new RegExp(`{${key}}`, 'g'), val);
        });
      }

      // 2. Save In-App Notification Record with DB Unique Idempotency Constraint
      let inAppRecord;
      try {
        inAppRecord = await this.prisma.notificationRecord.create({
          data: {
            telegramUserId: payload.userId,
            templateCode: payload.templateCode,
            message,
            channel: NotificationChannel.IN_APP,
            status: 'UNREAD',
            idempotencyKey: idempotencyKey || undefined,
            metadata: {
              variables: payload.variables || {},
              correlationId: payload.correlationId,
              priority: payload.priority || 'NORMAL',
              category: payload.category || 'INFORMATIONAL',
            } as Prisma.InputJsonValue,
          },
        });
      } catch (dbErr: any) {
        if (dbErr.code === 'P2002') { // Prisma unique constraint violation
          this.logger.log(`[NotificationEngine] Concurrent duplicate notification suppressed by DB constraint for user ${payload.userId}`);
          return;
        }
        throw dbErr;
      }

      this.logger.log(`[NotificationEngine] Created in-app notification ${inAppRecord.id} for user ${payload.userId}`);

      // 3. WhatsApp Notification Delivery Router
      await this.dispatchWhatsAppChannel(payload.userId, template, message, payload);

      return inAppRecord;
    } catch (err: any) {
      this.logger.error(`[NotificationEngine] Failed to dispatch notification: ${err.message}`);
    }
  }

  /**
   * Dispatches WhatsApp Channel notification if user has bound WhatsApp identity & preferences allow.
   * Runs in isolated error context so WhatsApp delivery failure NEVER fails domain business transactions.
   */
  private async dispatchWhatsAppChannel(
    telegramUserId: bigint,
    template: any,
    formattedMessage: string,
    payload: NotificationPayload,
  ) {
    try {
      // Resolve user preferences
      const pref = await this.prisma.notificationPreference.findUnique({
        where: { telegramUserId },
      });

      const isCritical = payload.priority === 'CRITICAL';
      const whatsappEnabled = pref ? pref.whatsappEnabled : true;

      if (!whatsappEnabled && !isCritical) {
        this.logger.log(`[NotificationEngine] WhatsApp channel disabled by user ${telegramUserId}. Skipping.`);
        return;
      }

      // Resolve user WhatsApp phone number from ChannelIdentity or User model
      const user = await this.prisma.user.findUnique({
        where: { telegramUserId },
        include: {
          identity: {
            include: {
              channels: true,
            },
          },
        },
      });

      if (!user) return;

      let waPhone: string | null = null;
      if (user.identity?.channels) {
        const waChan = user.identity.channels.find(
          (c: any) => c.provider === IdentityProvider.WHATSAPP,
        );
        if (waChan?.identifier) {
          waPhone = waChan.identifier;
        }
      }

      if (!waPhone) {
        this.logger.log(`[NotificationEngine] No WhatsApp channel identity found for user ${telegramUserId}.`);
        return;
      }

      // Render branded WhatsApp message with Titan Stream identity
      const waTitle = template.titleTemplate || 'Alert';
      const waMessageText = `⚡ *TITAN STREAM* — *${waTitle.replace(/[🎯🎉🎁💰💳⚠️💸✅🔐🛡️⭐🏆🏅🎮💎]/g, '').trim()}*\n\n${formattedMessage}`;

      const waIdempotencyKey = payload.correlationId
        ? `${payload.templateCode}_${telegramUserId}_${payload.correlationId}_WHATSAPP`
        : null;

      if (waIdempotencyKey) {
        const existingWa = await this.prisma.notificationRecord.findUnique({
          where: { idempotencyKey: waIdempotencyKey },
        });
        if (existingWa) {
          this.logger.log(`[NotificationEngine] Idempotent duplicate WhatsApp notification suppressed for user ${telegramUserId}`);
          return;
        }
      }

      // Dispatch through managed Baileys transport with priority handling
      const sendResult = await this.baileysAccountManager.sendTextMessage(waPhone, waMessageText, payload.priority || 'NORMAL');

      // Record WhatsApp notification log with DB idempotency key
      try {
        await this.prisma.notificationRecord.create({
          data: {
            telegramUserId,
            templateCode: payload.templateCode,
            message: waMessageText,
            channel: NotificationChannel.WHATSAPP,
            status: sendResult.success ? 'SENT' : 'FAILED',
            idempotencyKey: waIdempotencyKey || undefined,
            metadata: {
              variables: payload.variables || {},
              correlationId: payload.correlationId,
              messageId: sendResult.messageId,
              accountId: sendResult.accountId,
              error: sendResult.error,
            } as Prisma.InputJsonValue,
          },
        });
      } catch (dbErr: any) {
        if (dbErr.code === 'P2002') {
          this.logger.log(`[NotificationEngine] Concurrent duplicate WhatsApp record suppressed by DB constraint for user ${telegramUserId}`);
          return;
        }
        throw dbErr;
      }

      this.logger.log(`[NotificationEngine] WhatsApp notification dispatched to ${waPhone} (Success: ${sendResult.success})`);
    } catch (waErr: any) {
      // Failure Isolation: Log error cleanly without affecting caller
      this.logger.warn(`[NotificationEngine] WhatsApp channel dispatch failed for user ${telegramUserId}: ${waErr.message}`);
    }
  }

  /**
   * Compatibility wrapper for existing createNotification calls.
   */
  async createNotification(payload: NotificationPayload) {
    return this.dispatchNotification(payload);
  }

  /**
   * Get all active in-app notifications for a user.
   */
  async getNotificationsForUser(userKey: bigint | string) {
    const isUuid = typeof userKey === 'string' && userKey.includes('-');
    let telegramUserId: bigint | null = null;
    if (isUuid) {
      const u = await this.prisma.user.findUnique({ where: { id: userKey as string } });
      telegramUserId = u?.telegramUserId || null;
    } else if (typeof userKey === 'bigint') {
      telegramUserId = userKey;
    } else if (typeof userKey === 'string' && /^\d+$/.test(userKey)) {
      try {
        telegramUserId = BigInt(userKey);
      } catch {
        telegramUserId = null;
      }
    }
    if (!telegramUserId) return [];
    return this.prisma.notificationRecord.findMany({
      where: { telegramUserId, channel: NotificationChannel.IN_APP },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * Mark notification as read.
   */
  async markAsRead(userKey: bigint | string, id: string) {
    const isUuid = typeof userKey === 'string' && userKey.includes('-');
    let telegramUserId: bigint | null = null;
    if (isUuid) {
      const u = await this.prisma.user.findUnique({ where: { id: userKey as string } });
      telegramUserId = u?.telegramUserId || null;
    } else if (typeof userKey === 'bigint') {
      telegramUserId = userKey;
    } else if (typeof userKey === 'string' && /^\d+$/.test(userKey)) {
      try {
        telegramUserId = BigInt(userKey);
      } catch {
        telegramUserId = null;
      }
    }
    if (!telegramUserId) return { count: 0 };
    return this.prisma.notificationRecord.updateMany({
      where: { id, telegramUserId },
      data: { status: 'READ' },
    });
  }

  /**
   * Mark all notifications as read.
   */
  async markAllAsRead(userKey: bigint | string) {
    const isUuid = typeof userKey === 'string' && userKey.includes('-');
    let telegramUserId: bigint | null = null;
    if (isUuid) {
      const u = await this.prisma.user.findUnique({ where: { id: userKey as string } });
      telegramUserId = u?.telegramUserId || null;
    } else if (typeof userKey === 'bigint') {
      telegramUserId = userKey;
    } else if (typeof userKey === 'string' && /^\d+$/.test(userKey)) {
      try {
        telegramUserId = BigInt(userKey);
      } catch {
        telegramUserId = null;
      }
    }
    if (!telegramUserId) return { count: 0 };
    return this.prisma.notificationRecord.updateMany({
      where: { telegramUserId, status: 'UNREAD' },
      data: { status: 'READ' },
    });
  }

  /**
   * Seed default notification templates.
   */
  private async ensureDefaultTemplates() {
    const defaults = [
      {
        code: 'SETTLEMENT_CREATED',
        name: 'Settlement Started',
        titleTemplate: '💳 Deposit Started',
        bodyTemplate: 'Your deposit request of {amount} {asset} has been started! Ref: {reference}. We are verifying it now.',
        channel: NotificationChannel.IN_APP,
      },
      {
        code: 'SETTLEMENT_APPROVED',
        name: 'Deposit Approved',
        titleTemplate: '💰 Deposit Confirmed',
        bodyTemplate: 'Awesome! Your deposit of {amount} {asset} went through and your USDT balance has been updated.',
        channel: NotificationChannel.IN_APP,
      },
      {
        code: 'SETTLEMENT_FAILED',
        name: 'Deposit Failed',
        titleTemplate: '⚠️ Deposit Didn\'t Go Through',
        bodyTemplate: 'Your deposit request ({reference}) couldn\'t be completed. Reason: {reason}.',
        channel: NotificationChannel.IN_APP,
      },
      {
        code: 'WITHDRAWAL_REQUESTED',
        name: 'Withdrawal Requested',
        titleTemplate: '💸 Cash Out Requested',
        bodyTemplate: 'Your payout request of {amount} USDT on the {network} network is queued up and processing!',
        channel: NotificationChannel.IN_APP,
      },
      {
        code: 'WITHDRAWAL_COMPLETED',
        name: 'Withdrawal Completed',
        titleTemplate: '✅ Cash Out Done',
        bodyTemplate: 'Your withdrawal of {amount} USDT is complete and sent!',
        channel: NotificationChannel.IN_APP,
      },
      {
        code: 'WITHDRAWAL_REJECTED',
        name: 'Withdrawal Rejected',
        titleTemplate: '⚠️ Cash Out Cancelled',
        bodyTemplate: 'Your payout request ({reference}) was cancelled. Reason: {reason}. Your funds are safe and back in your balance.',
        channel: NotificationChannel.IN_APP,
      },
      {
        code: 'MISSION_CLAIMABLE',
        name: 'Mission Claimable',
        titleTemplate: '🎯 Quest Completed!',
        bodyTemplate: 'You finished {missionName}! Your reward of {rewardAmount} is ready to claim.',
        channel: NotificationChannel.IN_APP,
      },
      {
        code: 'REWARD_AWARDED',
        name: 'Reward Granted',
        titleTemplate: '🎉 You Got a Reward!',
        bodyTemplate: 'A bonus of {amount} {asset} was added to your account balance!',
        channel: NotificationChannel.IN_APP,
      },
      {
        code: 'SECURITY_STEP_UP_REQUIRED',
        name: 'Step-Up Required',
        titleTemplate: '🔐 Security Check Needed',
        bodyTemplate: 'Please open Titan Stream in your browser to confirm a quick security check.',
        channel: NotificationChannel.IN_APP,
      },
      {
        code: 'NEW_DEVICE_LOGIN',
        name: 'New Device Login',
        titleTemplate: '🛡️ New Sign-In',
        bodyTemplate: 'A new browser screen just signed into your Titan Stream account.',
        channel: NotificationChannel.IN_APP,
      },
    ];

    for (const item of defaults) {
      await this.prisma.notificationTemplate.upsert({
        where: { code: item.code },
        update: {
          name: item.name,
          titleTemplate: item.titleTemplate,
          bodyTemplate: item.bodyTemplate,
        },
        create: {
          code: item.code,
          name: item.name,
          titleTemplate: item.titleTemplate,
          bodyTemplate: item.bodyTemplate,
          channel: item.channel,
          enabled: true,
        },
      });
    }
  }
}
