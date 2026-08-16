import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationChannel } from '@prisma/client';

export interface NotificationTemplateDefinition {
  code: string;
  name: string;
  titleTemplate: string;
  bodyTemplate: string;
}

const DEFAULT_TEMPLATES: NotificationTemplateDefinition[] = [
  {
    code: 'SETTLEMENT_COMPLETED',
    name: 'Settlement Completed',
    titleTemplate: '✅ Deposit Confirmed',
    bodyTemplate: 'Your deposit of {amount} {asset} via {provider} went through! Your balance has been updated.',
  },
  {
    code: 'REFERRAL_COMPLETED',
    name: 'Referral Qualified',
    titleTemplate: '🎉 Referral Bonus Unlocked!',
    bodyTemplate: 'Your friend {refereeName} just completed their first deposit — your 5 USDT bonus is being processed!',
  },
  {
    code: 'REWARD_EARNED',
    name: 'Reward Granted',
    titleTemplate: '🎁 You Got a Reward!',
    bodyTemplate: 'A bonus of {amount} {asset} was dropped into your wallet. Nice!',
  },
  {
    code: 'LEVEL_UPGRADED',
    name: 'Level Upgraded',
    titleTemplate: '🚀 Level Up — {newLevel}!',
    bodyTemplate: 'You just leveled up to {newLevelName}! New perks and higher compute tiers unlocked.',
  },
  {
    code: 'SECURITY_EVENT',
    name: 'Security Alert',
    titleTemplate: '🛡️ Security Alert',
    bodyTemplate: 'Heads up — security activity detected on your Titan Stream account: {details}.',
  },
  {
    code: 'GAME_DAILY_LOGIN',
    name: 'Game Daily Login',
    titleTemplate: '💎 Daily Crystals Claimed!',
    bodyTemplate: '+{amount} 💎 claimed! Day {streak} streak — keep it going!',
  },
  {
    code: 'GAME_USDT_REWARD',
    name: 'Game USDT Reward',
    titleTemplate: '🎮 Game Reward Ready!',
    bodyTemplate: 'You won {amount} USDT in {gameName}! Claim it from your rewards.',
  },
  {
    code: 'GAME_PERSONAL_BEST',
    name: 'Game Personal Best',
    titleTemplate: '🏅 New Personal Best!',
    bodyTemplate: 'You hit {score} points in {gameName} — that\'s a new record! The leaderboard is watching 👀',
  },
  {
    code: 'GAME_DAILY_CHALLENGE_COMPLETE',
    name: 'Daily Challenge Complete',
    titleTemplate: '🎯 Challenge Done!',
    bodyTemplate: 'You crushed \"{challengeTitle}\" — +{crystals} 💎 and +{xp} XP earned. Come back tomorrow for a new one!',
  },
  {
    code: 'GAME_ACHIEVEMENT',
    name: 'Game Achievement Unlocked',
    titleTemplate: '🏆 Achievement Unlocked!',
    bodyTemplate: '\"{achievementName}\" ({tier}) is yours! Check your achievements cabinet.',
  },
  {
    code: 'GAME_LEVEL_UP',
    name: 'Game Level Up',
    titleTemplate: '⭐ Level {level} Reached!',
    bodyTemplate: 'Your XP leveled you up! Keep playing to unlock bigger rewards.',
  },
  {
    code: 'GAME_EVENT_REWARD',
    name: 'Game Event Reward',
    titleTemplate: '🎉 Event Bonus Claimed!',
    bodyTemplate: 'You earned {amount} during {eventName}. Enjoy the bonus!',
  },
];

@Injectable()
export class GrowthNotificationService {
  private readonly logger = new Logger(GrowthNotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Seed default notification templates.
   */
  async ensureDefaultTemplates() {
    for (const tpl of DEFAULT_TEMPLATES) {
      await this.prisma.notificationTemplate.upsert({
        where: { code: tpl.code },
        update: {},
        create: {
          code: tpl.code,
          name: tpl.name,
          titleTemplate: tpl.titleTemplate,
          bodyTemplate: tpl.bodyTemplate,
          channel: NotificationChannel.TELEGRAM,
          enabled: true,
        },
      });
    }
  }

  /**
   * Get or create notification preferences for a user.
   */
  async getPreferences(telegramUserId: bigint) {
    let pref = await this.prisma.notificationPreference.findUnique({
      where: { telegramUserId },
    });

    if (!pref) {
      pref = await this.prisma.notificationPreference.create({
        data: {
          telegramUserId,
          telegramEnabled: true,
          inAppEnabled: true,
          marketingEnabled: false,
        },
      });
    }

    return pref;
  }

  /**
   * Update notification preferences.
   */
  async updatePreferences(
    telegramUserId: bigint,
    data: { telegramEnabled?: boolean; inAppEnabled?: boolean; marketingEnabled?: boolean },
  ) {
    return this.prisma.notificationPreference.upsert({
      where: { telegramUserId },
      update: data,
      create: {
        telegramUserId,
        ...data,
      },
    });
  }

  /**
   * Dispatch a notification using a template and replace placeholder variables.
   */
  async sendNotification(data: {
    telegramUserId: bigint;
    templateCode: string;
    variables?: Record<string, string>;
  }) {
    await this.ensureDefaultTemplates();
    const prefs = await this.getPreferences(data.telegramUserId);

    if (!prefs.telegramEnabled && !prefs.inAppEnabled) {
      this.logger.log(`[GrowthNotification] User ${data.telegramUserId} disabled notifications. Skipping.`);
      return null;
    }

    const template = await this.prisma.notificationTemplate.findUnique({
      where: { code: data.templateCode },
    });

    if (!template || !template.enabled) {
      this.logger.warn(`[GrowthNotification] Template ${data.templateCode} not found or disabled.`);
      return null;
    }

    let title = template.titleTemplate;
    let body = template.bodyTemplate;

    if (data.variables) {
      Object.entries(data.variables).forEach(([key, value]) => {
        title = title.replace(new RegExp(`{${key}}`, 'g'), value);
        body = body.replace(new RegExp(`{${key}}`, 'g'), value);
      });
    }

    const message = `${title}\n\n${body}`;

    const record = await this.prisma.notificationRecord.create({
      data: {
        telegramUserId: data.telegramUserId,
        templateCode: data.templateCode,
        message,
        channel: NotificationChannel.TELEGRAM,
        status: 'SENT',
        metadata: data.variables || {},
      },
    });

    this.logger.log(`[GrowthNotification] Dispatched notification ${record.id} to user ${data.telegramUserId}`);
    return record;
  }

  /**
   * Get user notification history.
   */
  async getUserNotifications(telegramUserId: bigint, limit = 20) {
    return this.prisma.notificationRecord.findMany({
      where: { telegramUserId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
