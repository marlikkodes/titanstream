import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TelegramClientService } from './telegram-client.service';
import { NotificationChannel } from '@prisma/client';

export interface SendBotNotificationDto {
  telegramUserId: bigint;
  templateCode: string;
  title?: string;
  message: string;
  metadata?: Record<string, any>;
  actionButton?: {
    text: string;
    url?: string;
    web_app?: { url: string };
  };
}

@Injectable()
export class BotNotificationService {
  private readonly logger = new Logger(BotNotificationService.name);
  private readonly webAppUrl = process.env.TELEGRAM_WEBAPP_URL || 'https://titanstream.app';

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramClient: TelegramClientService,
  ) {}

  async sendMachineHealthReport(
    telegramUserId: bigint,
    userName?: string,
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { telegramUserId },
      include: {
        miningState: true,
        userMachines: { where: { status: 'ACTIVE' } },
      },
    });

    const activeMachinesCount = user?.userMachines?.length || 0;
    const totalCapacity = user?.userMachines?.reduce((sum, m) => sum + Number(m.capacityGhs), 0) || 0;
    const unclaimedYield = user?.miningState ? Number(user.miningState.unclaimedBalance) : 0.00;
    const ugxEst = Math.round(unclaimedYield * 3800); // 1 USDT ~= 3800 UGX

    const timeGreeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';
    const name = userName ? `, ${userName}` : '';

    let text = `👋 <b>${timeGreeting}${name}.</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<b>🖥 Machine Health & Revenue Report</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (activeMachinesCount > 0) {
      text += `<b>Status:</b> 🟢 ONLINE & RENTED\n` +
        `<b>Active Machines:</b> <b>${activeMachinesCount} Machine${activeMachinesCount === 1 ? '' : 's'}</b> (${totalCapacity} CU)\n` +
        `<b>Runtime Uptime:</b> 99.98%\n` +
        `<b>Unclaimed Revenue:</b> <b>${unclaimedYield.toFixed(2)} USDT</b> (${ugxEst.toLocaleString()} UGX)\n` +
        `<b>Revenue Trend:</b> 📈 Active rental contract\n` +
        `<b>Network Capacity:</b> 🟢 Excellent\n\n` +
        `Your Machine cloud allocation is processing active workloads 24/7 in high-security data centers.`;
    } else {
      text += `<b>Status:</b> ⚪ INACTIVE\n` +
        `<b>Active Machines:</b> 0 (No active allocation)\n` +
        `<b>Unclaimed Revenue:</b> 0.00 USDT (0 UGX)\n\n` +
        `<i>No active Machine yet — activate your first Machine in the Mini App to start earning daily rental revenue!</i>`;
    }

    return this.dispatchNotification({
      telegramUserId,
      templateCode: 'MACHINE_HEALTH_REPORT',
      message: text,
      actionButton: {
        text: 'Open TitanStream →',
        web_app: { url: `${this.webAppUrl}/mine` },
      },
    });
  }

  async sendMilestoneAchievement(
    telegramUserId: bigint,
    badgeTitle: string,
    description: string,
  ): Promise<boolean> {
    const text = `🎉 <b>Milestone Unlocked!</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<b>${badgeTitle}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `${description}\n\n` +
      `Keep running your Machine to unlock the next network achievement level!`;

    return this.dispatchNotification({
      telegramUserId,
      templateCode: 'MILESTONE_ACHIEVEMENT_UNLOCKED',
      message: text,
      actionButton: {
        text: 'View Achievements in App →',
        web_app: { url: `${this.webAppUrl}/boost` },
      },
    });
  }

  async sendFinancialDepositConfirmed(
    telegramUserId: bigint,
    amount: string,
    txRef: string,
  ): Promise<boolean> {
    const text = `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<b>Machine Activated</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `<b>Plan:</b> Titan Core Capacity\n` +
      `<b>Amount Funded:</b> ${amount} USDT\n` +
      `<b>Revenue Starts:</b> 🟢 Immediately\n` +
      `<b>Reference:</b> <code>${txRef}</code>\n\n` +
      `Your allocation is online and active in our secure data centers.`;

    return this.dispatchNotification({
      telegramUserId,
      templateCode: 'FINANCIAL_DEPOSIT_CONFIRMED',
      message: text,
      metadata: { amount, txRef },
      actionButton: {
        text: 'Open Dashboard →',
        web_app: { url: `${this.webAppUrl}/balance` },
      },
    });
  }

  async sendFinancialWithdrawalCompleted(
    telegramUserId: bigint,
    amount: string,
    txRef: string,
  ): Promise<boolean> {
    const text = `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<b>💸 Payout Dispatched</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `<b>Amount:</b> <b>${amount} USDT</b>\n` +
      `<b>Status:</b> 🟢 SETTLED & COMPLETED\n` +
      `<b>Transaction ID:</b> <code>${txRef}</code>\n\n` +
      `Your funds have been transferred instantly with zero platform fees.`;

    return this.dispatchNotification({
      telegramUserId,
      templateCode: 'FINANCIAL_WITHDRAWAL_COMPLETED',
      message: text,
      metadata: { amount, txRef },
      actionButton: {
        text: 'View Ledger Wallet →',
        web_app: { url: `${this.webAppUrl}/wallet` },
      },
    });
  }

  async sendGrowthTrustLevelUpgraded(
    telegramUserId: bigint,
    newLevel: string,
  ): Promise<boolean> {
    const text = `🎉 <b>Trust Tier Level Upgraded!</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<b>New Tier: Level ${newLevel}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Higher daily withdrawal limits ($2,500+/day) and bonus compute multipliers unlocked!`;

    return this.dispatchNotification({
      telegramUserId,
      templateCode: 'GROWTH_TRUST_LEVEL_UPGRADED',
      message: text,
      metadata: { newLevel },
      actionButton: {
        text: 'View Tier Benefits →',
        web_app: { url: `${this.webAppUrl}/boost` },
      },
    });
  }

  async sendGrowthReferralReward(
    telegramUserId: bigint,
    rewardAmount: string,
    refereeName?: string,
  ): Promise<boolean> {
    const text = `🚀 <b>New Referral Joined Network!</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${refereeName ? `<b>${refereeName}</b> ` : 'A friend '}activated their Machine allocation.\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `<b>Direct Bonus Credited:</b> +${rewardAmount} USDT\n` +
      `<b>Trust Score Bonus:</b> +10 Points`;

    return this.dispatchNotification({
      telegramUserId,
      templateCode: 'GROWTH_REFERRAL_REWARD',
      message: text,
      metadata: { rewardAmount, refereeName },
      actionButton: {
        text: 'View Referral Network →',
        web_app: { url: `${this.webAppUrl}/boost` },
      },
    });
  }

  async sendSecurityNewLogin(
    telegramUserId: bigint,
    deviceInfo: string,
    ipAddress?: string,
  ): Promise<boolean> {
    const text = `<b>⚠️ New Device Authorized</b>\n\n` +
      `<b>Device:</b> ${deviceInfo}\n` +
      `<b>Time:</b> ${new Date().toLocaleTimeString()}\n` +
      `${ipAddress ? `<b>IP Address:</b> ${ipAddress}` : ''}`;

    return this.dispatchNotification({
      telegramUserId,
      templateCode: 'SECURITY_NEW_LOGIN',
      message: text,
      metadata: { deviceInfo, ipAddress },
    });
  }

  async sendSecurityWithdrawalRequested(
    telegramUserId: bigint,
    amount: string,
    reference: string,
  ): Promise<boolean> {
    const text = `<b>⚠️ Withdrawal Request Processing</b>\n\n` +
      `<b>Amount:</b> ${amount} USDT\n` +
      `<b>Reference:</b> <code>${reference}</code>\n\n` +
      `Review required if you did not initiate this cashout.`;

    return this.dispatchNotification({
      telegramUserId,
      templateCode: 'SECURITY_WITHDRAWAL_REQUESTED',
      message: text,
      metadata: { amount, reference },
    });
  }

  async dispatchNotification(dto: SendBotNotificationDto): Promise<boolean> {
    const replyMarkup = dto.actionButton
      ? {
          inline_keyboard: [
            [
              dto.actionButton.web_app
                ? { text: dto.actionButton.text, web_app: dto.actionButton.web_app }
                : { text: dto.actionButton.text, url: dto.actionButton.url! },
            ],
          ],
        }
      : undefined;

    const res = await this.telegramClient.sendMessage(Number(dto.telegramUserId), dto.message, {
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
    });

    const status = res.ok ? 'DELIVERED' : 'FAILED';

    try {
      await this.prisma.notificationRecord.create({
        data: {
          telegramUserId: dto.telegramUserId,
          templateCode: dto.templateCode,
          message: dto.message,
          channel: NotificationChannel.TELEGRAM,
          status,
          metadata: { ...dto.metadata, error: res.description },
        },
      });
    } catch (dbErr) {
      this.logger.error(`Failed to store notification record: ${dbErr.message}`);
    }

    return res.ok;
  }

  async sendDirectMessage(telegramUserId: bigint, text: string): Promise<boolean> {
    const res = await this.telegramClient.sendMessage(Number(telegramUserId), text, {
      parse_mode: 'HTML',
    });
    return res.ok;
  }
}
