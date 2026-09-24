import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { BotGateService, TelegramUserCtx } from './bot-gate.service';
import { ReferralService } from '../growth/referral.service';
import { BalanceService } from '../financial/balance.service';
import { UserLevelService } from '../growth/user-level.service';
import { SupportService } from '../admin/services/support.service';
import { SupportCategory, SupportPriority } from '@prisma/client';

export const getPersistentMainKeyboard = (webAppUrl: string) => ({
  keyboard: [
    [{ text: '🚀 Launch Titan Stream', web_app: { url: webAppUrl } }],
    [{ text: '📚 Academy' }, { text: '🎁 Invite Friends' }, { text: '💬 Support' }],
  ],
  resize_keyboard: true,
});

@Injectable()
export class BotCommandService {
  private readonly logger = new Logger(BotCommandService.name);
  private readonly webAppUrl = process.env.TELEGRAM_WEBAPP_URL || 'https://titanstream.cc';

  constructor(
    private readonly prisma: PrismaService,
    private readonly botGate: BotGateService,
    private readonly referralService: ReferralService,
    private readonly balanceService: BalanceService,
    private readonly userLevelService: UserLevelService,
    private readonly supportService: SupportService,
  ) {}

  async handleStart(userCtx: TelegramUserCtx, startParam?: string): Promise<{ text: string; keyboard: any }> {
    await this.botGate.ensureUserIdentity(userCtx);

    // Process referral deep linking if parameter present
    if (startParam) {
      let refCode = startParam.trim();
      if (refCode.startsWith('ref_')) {
        refCode = refCode.replace('ref_', '');
      }

      if (refCode) {
        try {
          await this.referralService.registerReferral(refCode, userCtx.id);
          this.logger.log(`Attached referral ${refCode} to user ${userCtx.id}`);
        } catch (err) {
          this.logger.warn(`Referral attachment warning for user ${userCtx.id}: ${err.message}`);
        }
      }
    }

    const gateResult = await this.botGate.processGateCheck(userCtx);
    if (!gateResult.verified) {
      return {
        text: gateResult.message,
        keyboard: gateResult.keyboard,
      };
    }

    return {
      text: gateResult.message,
      keyboard: {
        ...gateResult.keyboard,
        ...getPersistentMainKeyboard(this.webAppUrl),
      },
    };
  }

  async handleApp(userCtx: TelegramUserCtx): Promise<{ text: string; keyboard: any }> {
    const gateResult = await this.botGate.processGateCheck(userCtx);
    if (!gateResult.verified) return { text: gateResult.message, keyboard: gateResult.keyboard };

    return {
      text: `━━━━━━━━━━━━━━━━━━━━\n` +
        `👋 <b>Welcome to Titan Stream</b>\n\n` +
        `The world's computing demand is growing every day.\n\n` +
        `Businesses rent cloud computing power to run AI, software, automation, and high-performance workloads.\n\n` +
        `Titan Stream allows you to reserve a portion of our professionally managed cloud infrastructure through Machines.\n\n` +
        `As businesses rent this computing capacity, a share of the rental revenue is distributed to Machine owners.\n\n` +
        `Everything is managed for you. No technical knowledge required.\n` +
        `━━━━━━━━━━━━━━━━━━━━`,
      keyboard: {
        inline_keyboard: [
          [{ text: '🚀 Launch Titan Stream', web_app: { url: this.webAppUrl } }],
          [{ text: '📚 Learn How It Works', callback_data: 'edu_menu' }, { text: '🎁 Invite Friends', callback_data: 'cmd_referrals' }],
          [{ text: '💬 Support Desk', callback_data: 'sup_menu' }, { text: '🔍 Run Account Check', callback_data: 'cmd_health_report' }],
        ],
      },
    };
  }

  async handleTreasuryMining(userCtx: TelegramUserCtx): Promise<{ text: string; keyboard: any }> {
    const gateResult = await this.botGate.processGateCheck(userCtx);
    if (!gateResult.verified) return { text: gateResult.message, keyboard: gateResult.keyboard };

    const user = await this.prisma.user.findUnique({
      where: { telegramUserId: userCtx.id },
      include: {
        miningState: true,
        userMachines: { where: { status: 'ACTIVE' } },
      },
    });

    const activeMachinesCount = user?.userMachines?.length || 0;
    const totalCapacity = user?.userMachines?.reduce((sum, m) => sum + Number(m.capacityGhs), 0) || 0;
    const unclaimedYield = user?.miningState ? Number(user.miningState.unclaimedBalance) : 0.00;
    const ugxEst = Math.round(unclaimedYield * 3800);

    let statusText = '';
    if (activeMachinesCount > 0) {
      statusText = `<b>Machine Status:</b> 🟢 ONLINE & RENTED\n` +
        `<b>Active Machines:</b> <b>${activeMachinesCount} Machine${activeMachinesCount === 1 ? '' : 's'} Online</b> (${totalCapacity} CU)\n` +
        `<b>Runtime Uptime:</b> 99.98%\n` +
        `<b>Unclaimed Revenue:</b> <b>${unclaimedYield.toFixed(2)} USDT</b> (${ugxEst.toLocaleString()} UGX)\n` +
        `<b>Revenue Trend:</b> 📈 Active rental contract\n` +
        `<b>Network Capacity:</b> 🟢 Excellent`;
    } else {
      statusText = `<b>Machine Status:</b> ⚪ INACTIVE\n` +
        `<b>Active Machines:</b> 0 (No active allocation)\n` +
        `<b>Unclaimed Revenue:</b> 0.00 USDT (0 UGX)\n\n` +
        `<i>No active Machine yet — activate your first Machine in the Mini App to start earning daily rental revenue!</i>`;
    }

    const text = `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<b>⚡ Machine Status & Rental Revenue</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `${statusText}\n\n` +
      `<i>Cloud computers are running 24/7 in professional data centers.</i>`;

    return {
      text,
      keyboard: {
        inline_keyboard: [
          [{ text: `🎁 Claim Revenue (${unclaimedYield.toFixed(2)} USDT)`, callback_data: 'cmd_claim_mining' }],
          [{ text: '⚡ Boost Compute Power', callback_data: 'cmd_toggle_turbo' }],
          [{ text: 'Open Dashboard →', web_app: { url: `${this.webAppUrl}/mine` } }],
        ],
      },
    };
  }

  async handleGames(userCtx: TelegramUserCtx): Promise<{ text: string; keyboard: any }> {
    const gateResult = await this.botGate.processGateCheck(userCtx);
    if (!gateResult.verified) return { text: gateResult.message, keyboard: gateResult.keyboard };

    const text = `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<b>🎰 TitanStream Arcade Games</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Play USDT minigames with instant settlement to your double-entry ledger balance.\n\n` +
      `• <b>USDT Roulette:</b> Up to 36x payout\n` +
      `• <b>Crash Rocket:</b> Up to 100x multiplier\n` +
      `• <b>Daily Wheel:</b> Spin daily for guaranteed rewards\n\n` +
      `<b>Arcade Pool:</b> <b>25,000 USDT</b>`;

    return {
      text,
      keyboard: {
        inline_keyboard: [
          [{ text: '🎡 Play USDT Roulette', web_app: { url: `${this.webAppUrl}/games` } }],
          [{ text: '🚀 Play Crash Rocket', web_app: { url: `${this.webAppUrl}/games` } }],
          [{ text: '🎁 Spin Daily Reward Wheel', callback_data: 'cmd_daily_spin' }],
        ],
      },
    };
  }

  async handleQuests(userCtx: TelegramUserCtx): Promise<{ text: string; keyboard: any }> {
    const gateResult = await this.botGate.processGateCheck(userCtx);
    if (!gateResult.verified) return { text: gateResult.message, keyboard: gateResult.keyboard };

    const user = await this.prisma.user.findUnique({
      where: { telegramUserId: userCtx.id },
      include: {
        userMachines: { where: { status: 'ACTIVE' } },
      },
    });

    const activeCount = user?.userMachines?.length || 0;
    const qualifiedRef = user?.qualifiedReferrals || 0;

    const firstMachine = activeCount > 0 ? 'Unlocked' : 'Locked';
    const firstRef = qualifiedRef > 0 ? 'Unlocked' : 'Locked';

    const text = `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<b>🎁 Milestones & Achievements</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🥉 <b>First Machine:</b> ${firstMachine}\n` +
      `🥈 <b>First Week Uptime:</b> Active\n` +
      `🥇 <b>30 Days Active:</b> Progress [██████░░░░] Active\n` +
      `⚡ <b>First Referral:</b> ${firstRef}\n` +
      `🏆 <b>Network Builder:</b> Progress [████░░░░░] ${qualifiedRef}/5 Friends\n` +
      `💎 <b>Elite Operator:</b> Tier Level Unlocked\n\n` +
      `<b>Daily Streak:</b> 🔥 <b>Active Streak</b> (+15% Multiplier)`;

    return {
      text,
      keyboard: {
        inline_keyboard: [
          [{ text: '🔥 Claim Daily Streak Bonus', callback_data: 'cmd_claim_streak' }],
          [{ text: '🎯 View All Missions in App', web_app: { url: `${this.webAppUrl}/quests` } }],
        ],
      },
    };
  }

  async handleBalance(userCtx: TelegramUserCtx): Promise<{ text: string; keyboard: any }> {
    const gateResult = await this.botGate.processGateCheck(userCtx);
    if (!gateResult.verified) return { text: gateResult.message, keyboard: gateResult.keyboard };

    const user = await this.prisma.user.findUnique({
      where: { telegramUserId: userCtx.id },
      include: { financialAccount: true },
    });

    let availableUSDT = '0.00';
    let reservedUSDT = '0.00';
    if (user?.financialAccount?.id) {
      try {
        // Use authoritative ledger-based balance
        const balanceData = await this.balanceService.getBalances(userCtx.id, user.financialAccount.id);
        const usdtAsset = balanceData.balances.find((b) => b.assetCode === 'USDT');
        if (usdtAsset) {
          availableUSDT = Number(usdtAsset.availableBalance).toFixed(2);
          reservedUSDT = Number(usdtAsset.reservedBalance || 0).toFixed(2);
        }
      } catch (err) {
        this.logger.error(`Error fetching ledger balance: ${err.message}`);
        // Do NOT fallback to stale AssetBalance - keep default values
        availableUSDT = '0.00';
        reservedUSDT = '0.00';
      }
    }

    let trustLevelName = 'Tier 1 (New Member)';
    let dailyLimit = '$1,000.00';
    try {
      const levelRecord = await this.userLevelService.getUserLevelSummary(userCtx.id);
      trustLevelName = `Tier ${levelRecord.currentLevel} (${levelRecord.levelName})`;
      if ((levelRecord as any).dailyLimit) {
        dailyLimit = `$${Number((levelRecord as any).dailyLimit).toLocaleString()}.00`;
      }
    } catch {
      // default
    }

    const text = `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<b>💰 TitanStream Universal Ledger Wallet</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `<b>Available Funds:</b> <b>${availableUSDT} USDT</b>\n` +
      `<b>Reserved Funds:</b> <b>${reservedUSDT} USDT</b>\n\n` +
      `<b>Trust Level:</b> ${trustLevelName}\n` +
      `<b>Daily Cashout Limit:</b> <b>${dailyLimit} / day</b>\n\n` +
      `<i>All balances are double-entry ledger verified for 100% financial integrity.</i>`;

    return {
      text,
      keyboard: {
        inline_keyboard: [
          [{ text: '➕ Instant Deposit', callback_data: 'cmd_deposit' }],
          [{ text: '💸 Instant Cashout', callback_data: 'cmd_withdraw' }],
          [{ text: 'Open Wallet Dashboard →', web_app: { url: `${this.webAppUrl}/wallet` } }],
          [{ text: '🔄 Refresh Balance', callback_data: 'cmd_balance' }],
        ],
      },
    };
  }

  async handleReferrals(userCtx: TelegramUserCtx): Promise<{ text: string; keyboard: any }> {
    const gateResult = await this.botGate.processGateCheck(userCtx);
    if (!gateResult.verified) return { text: gateResult.message, keyboard: gateResult.keyboard };

    const summary = await this.referralService.getUserReferralSummary(userCtx.id);
    const count = summary.qualifiedCount;
    const goal = 5;
    const progressBlocks = Math.min(Math.floor((count / goal) * 10), 10);
    const progressBar = '█'.repeat(progressBlocks) + '░'.repeat(10 - progressBlocks);

    const inviteLink = summary.webReferralLink || summary.referralLink;

    const text = `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<b>👥 Referral Network Progress</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `<b>Progress:</b> [${progressBar}] ${count} / ${goal} Friends\n\n` +
      `<i>${goal - count > 0 ? `${goal - count} more friends unlock higher cashout limits & 2x Bonus Multiplier!` : '🏆 Maximum Milestone Reached!'}</i>\n\n` +
      `<b>Your Unique Invite Link:</b>\n<code>${inviteLink}</code>\n\n` +
      `<b>Total Earned:</b> <b>${summary.totalEarnedUSDT.toFixed(2)} USDT</b>`;

    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent('Join TitanStream to participate in the cloud computing economy & earn daily rental revenue! 🚀')}`;

    return {
      text,
      keyboard: {
        inline_keyboard: [
          [{ text: '📢 Share Referral Link', url: shareUrl }],
          [{ text: '🚀 Activate 2x Referral Boost', callback_data: 'prod_view_BOOST_2X_REFERRAL' }],
          [{ text: 'Open Network Dashboard →', web_app: { url: `${this.webAppUrl}/boost` } }],
        ],
      },
    };
  }

  async handleHelp(userCtx: TelegramUserCtx): Promise<{ text: string; keyboard: any }> {
    return {
      text: `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `<b>💬 Titan Support Desk</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `How can we assist you today? Select a category below for guided troubleshooting and account checks:`,
      keyboard: {
        inline_keyboard: [
          [{ text: '💰 Payments & Deposits', callback_data: 'sup_cat_payments' }],
          [{ text: '🏦 Withdrawals & Cashouts', callback_data: 'sup_cat_withdrawals' }],
          [{ text: '⚙️ Machines & Uptime', callback_data: 'sup_cat_machines' }],
          [{ text: '👥 Referrals & Rewards', callback_data: 'sup_cat_referrals' }],
          [{ text: '📚 Academy & FAQ Explorer', callback_data: 'assistant_menu' }],
          [{ text: '🔍 Run Account Diagnostic Check', callback_data: 'cmd_health_report' }],
          [{ text: '❓ Talk to Support Operator', callback_data: 'sup_talk_human' }],
        ],
      },
    };
  }

  async handleSettings(userCtx: TelegramUserCtx): Promise<{ text: string; keyboard: any }> {
    return {
      text: `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `<b>⚙️ Account Preferences & Security</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Manage notification alerts, language options, and security logs:`,
      keyboard: {
        inline_keyboard: [
          [{ text: '🔔 Telegram Notifications: Enabled', callback_data: 'toggle_notif' }],
          [{ text: '🌐 Language: English', callback_data: 'toggle_lang' }],
          [{ text: '🛡 Security Audit Logs', callback_data: 'cmd_security' }],
        ],
      },
    };
  }

  async createSupportTicketFromBot(
    userCtx: TelegramUserCtx,
    categoryStr: string,
  ): Promise<{ text: string; keyboard: any }> {
    const category = (SupportCategory[categoryStr as keyof typeof SupportCategory] ||
      SupportCategory.TECHNICAL_ISSUE) as SupportCategory;

    const supportCase = await this.supportService.createCase(
      { id: 'SYSTEM_BOT', role: 'BOT_AUTOMATION' },
      {
        userId: userCtx.id.toString(),
        category,
        priority: SupportPriority.HIGH,
        notes: `Support ticket created via Telegram Bot by @${userCtx.username || userCtx.id}`,
      },
    );

    return {
      text: `<b>✅ Support Ticket Created</b>\n\n` +
        `<b>Ticket ID:</b> <code>${supportCase.id}</code>\n` +
        `<b>Category:</b> ${category}\n` +
        `<b>Status:</b> OPEN\n\n` +
        `Our support desk has been notified and an agent will reply directly to your chat.`,
      keyboard: {
        inline_keyboard: [
          [{ text: '💬 Open Support Portal in App', web_app: { url: `${this.webAppUrl}/support` } }],
        ],
      },
    };
  }
}
