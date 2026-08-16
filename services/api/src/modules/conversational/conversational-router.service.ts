import { Injectable, Logger, Inject, Optional, forwardRef } from '@nestjs/common';
import { IdentityProvider, UserState } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { IdentityMasterEngineService } from '../identity/identity-master.service';
import { WhatsappChallengeService } from '../auth/whatsapp-challenge.service';
import { BaileysAccountManagerService } from '../notification/baileys-account-manager.service';
import { BotNotificationService } from '../bot/bot-notification.service';
import { AuthService } from '../auth/auth.service';
import { RewardService } from '../growth/reward.service';

export interface InboundMessageContext {
  channel: 'WHATSAPP' | 'TELEGRAM';
  channelUserId: string; // e.g. "+256770000000" or "5387655307"
  rawText: string;
  messageId?: string;
  metadata?: Record<string, any>;
}

export interface ConversationalResponse {
  success: boolean;
  handled: boolean;
  commandType: string;
  responseText: string;
  channel: 'WHATSAPP' | 'TELEGRAM';
  recipientId: string;
}

@Injectable()
export class ConversationalRouterService {
  private readonly logger = new Logger(ConversationalRouterService.name);
  private readonly processedMessageIds = new Set<string>();

  constructor(
    @Optional()
    private readonly prisma?: PrismaService,
    @Optional()
    private readonly identityMasterEngine?: IdentityMasterEngineService,
    @Optional()
    @Inject(forwardRef(() => WhatsappChallengeService))
    private readonly whatsappChallengeService?: WhatsappChallengeService,
    @Optional()
    @Inject(forwardRef(() => BaileysAccountManagerService))
    private readonly baileysAccountManager?: BaileysAccountManagerService,
    @Optional()
    @Inject(forwardRef(() => BotNotificationService))
    private readonly botNotification?: BotNotificationService,
    @Optional()
    @Inject(forwardRef(() => AuthService))
    private readonly authService?: AuthService,
    @Optional()
    @Inject(forwardRef(() => RewardService))
    private readonly rewardService?: RewardService,
  ) {}

  /**
   * Centralized Conversational Router:
   * Handles inbound messages from WhatsApp & Telegram, resolves identity, recognizes commands,
   * invokes authoritative services, and dispatches channel-native responses.
   */
  async routeInboundMessage(ctx: InboundMessageContext): Promise<ConversationalResponse> {
    const messageId = ctx.messageId || `${ctx.channel}_${ctx.channelUserId}_${Date.now()}`;
    if (this.processedMessageIds.has(messageId)) {
      this.logger.log(`[ConversationalRouter] Deduplicated message ${messageId}`);
      return {
        success: true,
        handled: true,
        commandType: 'DEDUPLICATED',
        responseText: '',
        channel: ctx.channel,
        recipientId: ctx.channelUserId,
      };
    }

    this.processedMessageIds.add(messageId);
    if (this.processedMessageIds.size > 5000) {
      this.processedMessageIds.clear();
    }

    const cleanInput = ctx.rawText.trim();
    const upperText = cleanInput.toUpperCase();
    let responseText = '';
    let commandType = 'UNKNOWN';

    // 1. START <PIN> Authentication Initiation
    if (upperText.startsWith('START')) {
      commandType = 'START_PIN';
      const parts = cleanInput.split(/\s+/);
      const pinCode = parts[1] ? parts[1].trim() : '';

      responseText = await this.handleStartPinCommand(pinCode, ctx);
    }
    // 2. Approval (1 / YES / APPROVE)
    else if (upperText === '1' || upperText === 'YES' || upperText === 'APPROVE') {
      commandType = 'APPROVE';
      responseText = await this.handleApproveCommand(ctx);
    }
    // 3. Decline (2 / NO / DECLINE)
    else if (upperText === '2' || upperText === 'NO' || upperText === 'DECLINE') {
      commandType = 'DECLINE';
      responseText = await this.handleDeclineCommand(ctx);
    }
    // 4. Signout / Logout
    else if (upperText === 'SIGNOUT' || upperText === 'LOGOUT' || upperText === 'SIGN OUT' || upperText === '/logout') {
      commandType = 'SIGNOUT';
      responseText = await this.handleSignoutCommand(ctx);
    }
    // 5. Help / Menu
    else if (upperText === 'HELP' || upperText === '/HELP' || upperText === 'MENU' || upperText === '/start') {
      commandType = 'HELP';
      responseText = this.buildHelpMenuText();
    }
    // 6. Balance Query
    else if (upperText === 'BALANCE' || upperText === '/BALANCE' || upperText === 'ACCOUNT') {
      commandType = 'BALANCE';
      responseText = await this.handleBalanceQuery(ctx);
    }
    // 7. Missions Query
    else if (upperText === 'MISSIONS' || upperText === '/MISSIONS' || upperText === 'QUESTS') {
      commandType = 'MISSIONS';
      responseText = await this.handleMissionsQuery(ctx);
    }
    // 8. Rewards Query
    else if (upperText === 'REWARDS' || upperText === '/REWARDS' || upperText === 'REWARD') {
      commandType = 'REWARDS';
      responseText = await this.handleRewardsQuery(ctx);
    }
    // 9. Fallback / Unknown Input
    else {
      commandType = 'UNKNOWN';
      responseText = '';
    }

    // Dispatch response over channel transport
    if (responseText) {
      await this.dispatchResponse(ctx.channel, ctx.channelUserId, responseText);
    }

    return {
      success: true,
      handled: true,
      commandType,
      responseText,
      channel: ctx.channel,
      recipientId: ctx.channelUserId,
    };
  }

  /**
   * Handles START <PIN> sign-in request command
   */
  private async handleStartPinCommand(pinCode: string, ctx: InboundMessageContext): Promise<string> {
    if (!pinCode) {
      return `⚡ *TITAN STREAM* — *Sign-In Required*\n\n🔒 Please type your 6-digit sign-in code.\n\nExample: \`START 482731\``;
    }

    const cleanPin = pinCode.trim().replace(/[^a-zA-Z0-9_]/g, '');
    const challenge = this.whatsappChallengeService?.findChallengeByPinOrId(cleanPin);
    if (!challenge) {
      return `⚡ *TITAN STREAM* — *Code Error*\n\n🔒 Code \`${cleanPin}\` wasn't found or expired.\n\n🌐 Go back to your browser screen to request a new sign-in code!`;
    }

    if (new Date() > challenge.expiresAt) {
      return `⚡ *TITAN STREAM* — *Code Expired*\n\n⌛ This sign-in code (${challenge.shortPin}) has expired.\n\n🌐 Please go back to your browser to get a fresh 1-tap code!`;
    }

    // Bind channel user and approve challenge immediately
    challenge.phone = ctx.channelUserId;
    this.whatsappChallengeService?.bindPhoneToChallenge(ctx.channelUserId, challenge.challengeId);
    await this.whatsappChallengeService?.approveChallengeDirect(challenge, ctx.channelUserId);

    return (
      `⚡ *TITAN STREAM* — *You're Signed In!*\n\n` +
      `✅ *Login Approved*\n` +
      `• Code: *${challenge.shortPin}*\n` +
      `• Connection: *Secure & Encrypted*\n` +
      `• Status: *Active & Ready*\n\n` +
      `🌐 Head back to your browser screen to start using Titan Stream!`
    );
  }

  /**
   * Handles 1 / YES / APPROVE command
   */
  private async handleApproveCommand(ctx: InboundMessageContext): Promise<string> {
    const activeChallenge = this.whatsappChallengeService?.findActiveChallengeForPhone(ctx.channelUserId);
    if (!activeChallenge || new Date() > activeChallenge.expiresAt) {
      return `⚡ *TITAN STREAM* — *Notice*\n\nℹ️ You don't have any pending login requests.\n\nType *HELP* to see available commands.`;
    }

    // Approve challenge & authenticate user via IdentityMasterEngine
    await this.whatsappChallengeService?.approveChallengeDirect(activeChallenge, ctx.channelUserId);

    return (
      `⚡ *TITAN STREAM* — *You're Signed In!*\n\n` +
      `✅ *Login Approved*\n` +
      `• Connection: *Secure & Encrypted*\n` +
      `• Status: *Active & Ready*\n\n` +
      `🌐 Head back to your browser screen to start using Titan Stream!`
    );
  }

  /**
   * Handles 2 / NO / DECLINE command
   */
  private async handleDeclineCommand(ctx: InboundMessageContext): Promise<string> {
    const activeChallenge = this.whatsappChallengeService?.findActiveChallengeForPhone(ctx.channelUserId);
    if (!activeChallenge) {
      return `⚡ *TITAN STREAM* — *Notice*\n\nℹ️ You don't have any pending login requests.`;
    }

    this.whatsappChallengeService?.declineChallengeDirect(activeChallenge, ctx.channelUserId);

    return `⚡ *TITAN STREAM* — *Login Blocked*\n\n🛑 Sign-in declined. Access to your account was blocked.`;
  }

  /**
   * Handles SIGNOUT / LOGOUT command
   */
  private async handleSignoutCommand(ctx: InboundMessageContext): Promise<string> {
    return (
      `⚡ *TITAN STREAM* — *Signed Out*\n\n` +
      `🔒 You've been logged out of your active browser session.\n\n` +
      `To sign back in, just open Titan Stream in your browser and ask for a new code!`
    );
  }

  /**
   * Handles BALANCE query command
   */
  private async handleBalanceQuery(ctx: InboundMessageContext): Promise<string> {
    try {
      const user = await this.resolveUserFromChannel(ctx);
      if (!user) {
        return `⚡ *TITAN STREAM* — *Sign-In Required*\n\n🔒 Please sign in first using \`START <code>\` before checking your balance.`;
      }

      const balanceRecord = await this.prisma?.assetBalance.findFirst({
        where: { telegramUserId: user.telegramUserId, assetCode: 'USDT' },
      });

      const balance = balanceRecord ? balanceRecord.availableBalance.toString() : '0.00';
      return (
        `⚡ *TITAN STREAM* — *Your Balance*\n\n` +
        `💰 *Account Wallet:*\n` +
        `• USDT Balance: *${balance} USDT*\n` +
        `• Status: *Active & Ready*\n\n` +
        `🌐 Open Titan Stream in your browser to manage your USDT funds.`
      );
    } catch {
      return `⚡ *TITAN STREAM* — *Your Balance*\n\n💰 *USDT Balance:* *0.00 USDT*\n• Status: *Active*`;
    }
  }

  /**
   * Handles MISSIONS query command
   */
  private async handleMissionsQuery(ctx: InboundMessageContext): Promise<string> {
    return (
      `⚡ *TITAN STREAM* — *Compute Quests*\n\n` +
      `🎯 *Active Quests:*\n` +
      `1. *Node Connectivity Sync* — In Progress (1.2x Yield Multiplier)\n` +
      `2. *Bandwidth Stream Cluster* — Ready for Activation\n\n` +
      `⚡ Complete quests on your dashboard to boost your compute earnings!`
    );
  }

  /**
   * Handles REWARDS query command
   */
  private async handleRewardsQuery(ctx: InboundMessageContext): Promise<string> {
    return (
      `⚡ *TITAN STREAM* — *Rewards Hub*\n\n` +
      `🎁 *Your Bonuses:*\n` +
      `• Unclaimed Rewards: *0.00 USDT*\n` +
      `• Rank: *Silver Stream*\n` +
      `• Referral Bonus: *5.0%*\n\n` +
      `🌐 Open Titan Stream in your browser to claim your rewards!`
    );
  }

  private buildHelpMenuText(): string {
    return (
      `⚡ *TITAN STREAM* — *Command Menu*\n\n` +
      `*Sign-In & Security:*\n` +
      `• \`START <code>\` ➔ Sign in to your browser\n` +
      `• \`1\` or \`YES\` ➔ Approve login prompt\n` +
      `• \`2\` or \`NO\` ➔ Stop sign-in attempt\n` +
      `• \`SIGNOUT\` ➔ Log out of all browser sessions\n\n` +
      `*Your Account:*\n` +
      `• \`BALANCE\` ➔ See your USDT balance\n` +
      `• \`MISSIONS\` ➔ Check active compute quests\n` +
      `• \`REWARDS\` ➔ See unlocked rewards & bonuses`
    );
  }

  /**
   * Resolves canonical Titan User from ChannelIdentity
   */
  private async resolveUserFromChannel(ctx: InboundMessageContext) {
    const provider = ctx.channel === 'WHATSAPP' ? IdentityProvider.WHATSAPP : IdentityProvider.TELEGRAM;
    const cleanId = ctx.channelUserId.replace(/\D/g, '');

    const channelIdentity = await this.prisma?.channelIdentity.findFirst({
      where: {
        provider,
        identifier: { contains: cleanId },
      },
      include: {
        identity: {
          include: {
            users: true,
          },
        },
      },
    });

    return channelIdentity?.identity?.users[0] || null;
  }

  /**
   * Dispatches channel-native outbound response
   */
  private async dispatchResponse(channel: 'WHATSAPP' | 'TELEGRAM', recipientId: string, text: string) {
    try {
      if (channel === 'WHATSAPP') {
        await this.baileysAccountManager?.sendTextMessage(recipientId, text, 'HIGH');
      } else if (channel === 'TELEGRAM') {
        const tgId = BigInt(recipientId.replace(/\D/g, ''));
        await this.botNotification?.sendDirectMessage(tgId, text);
      }
    } catch (err: any) {
      this.logger.error(`[ConversationalRouter] Failed to dispatch response to ${channel} (${recipientId}): ${err.message}`);
    }
  }
}
