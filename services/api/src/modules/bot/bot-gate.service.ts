import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma, IdentityProvider } from '@prisma/client';
import { TelegramClientService } from './telegram-client.service';
import { AuditService } from '../audit/audit.service';
import { UserState, AuditEventType } from '../../common/interfaces/user-state.enum';
import { IdentityMasterEngineService } from '../identity/identity-master.service';

export interface TelegramUserCtx {
  id: bigint;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
  photoUrl?: string;
}

@Injectable()
export class BotGateService {
  private readonly logger = new Logger(BotGateService.name);
  private readonly webAppUrl = process.env.TELEGRAM_WEBAPP_URL || 'https://titanstream.cc';

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramClient: TelegramClientService,
    private readonly auditService: AuditService,
    private readonly identityMasterEngine: IdentityMasterEngineService,
  ) {}

  private get defaultChannel(): { id: string; username: string; label: string } {
    const mainChannelId = process.env.TELEGRAM_CHANNEL_ID || '@titanstreamm';
    const mainChannelUser = (process.env.TELEGRAM_CHANNEL_USERNAME || 'titanstreamm').replace('@', '');
    return {
      id: mainChannelId,
      username: mainChannelUser,
      label: '📢 Join Official Channel',
    };
  }

  async verifyChannelMembership(telegramUserId: bigint, channelId?: string): Promise<{
    isMember: boolean;
    status: string;
    details?: any;
  }> {
    const targetChannel = channelId || this.defaultChannel.id;
    const member = await this.telegramClient.getChatMember(targetChannel, Number(telegramUserId));

    if (!member) {
      this.logger.warn(`Could not verify member status in ${targetChannel} (Bot may need Admin rights in ${targetChannel}). Granting fallback passage.`);
      return { isMember: true, status: 'fallback_granted' };
    }

    const acceptedStates = ['creator', 'administrator', 'member'];
    const isMember = acceptedStates.includes(member.status);

    try {
      await this.prisma.channelVerificationEvent.create({
        data: {
          telegramUserId,
          channelId: targetChannel,
          status: member.status,
          metadata: { isMember },
        },
      });
    } catch (err) {
      this.logger.error(`Failed to record ChannelVerificationEvent: ${err.message}`);
    }

    return {
      isMember,
      status: member.status,
      details: member,
    };
  }

  async ensureUserIdentity(userCtx: TelegramUserCtx): Promise<{
    user: any;
    isNew: boolean;
  }> {
    const identifierStr = String(userCtx.id);
    let identityContext = await this.identityMasterEngine.authenticate({
      provider: IdentityProvider.TELEGRAM,
      identifier: identifierStr,
      displayName: userCtx.firstName ? `${userCtx.firstName} ${userCtx.lastName || ''}`.trim() : `Telegram_${identifierStr}`,
      avatarUrl: userCtx.photoUrl,
      metadata: {
        username: userCtx.username,
        languageCode: userCtx.languageCode,
        source: 'telegram_bot_gate',
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: identityContext.userId },
      include: {
        financialAccount: true,
        userLevel: true,
        miningState: true,
        userMachines: { where: { status: 'ACTIVE' } },
      },
    });

    const isNew = identityContext.assuranceLevel !== 'HIGH';
    return { user, isNew };
  }

  async processGateCheck(userCtx: TelegramUserCtx): Promise<{
    verified: boolean;
    message: string;
    keyboard: any;
  }> {
    const { user } = await this.ensureUserIdentity(userCtx);

    let channelGateEnabled = true;
    let targetChannel = this.defaultChannel.id;

    try {
      const state = await this.prisma.emergencyControlState.findUnique({
        where: { id: 'SYSTEM_EMERGENCY_STATE' },
      });
      if (state) {
        channelGateEnabled = state.channelGateEnabled;
        if (state.requiredChannelId) {
          targetChannel = state.requiredChannelId;
        }
      }
    } catch (err) {
      this.logger.warn(`Failed to fetch EmergencyControlState in processGateCheck: ${err.message}`);
    }

    // Channel membership gate
    if (channelGateEnabled) {
      const membership = await this.verifyChannelMembership(userCtx.id, targetChannel);

      if (!membership.isMember) {
        const channelUser = targetChannel.startsWith('@') ? targetChannel.substring(1) : targetChannel;
        const gateText = `<b>⚠️ Channel Membership Required</b>\n\n` +
          `Welcome, ${userCtx.firstName}! To access Titan Stream Cloud Infrastructure and start earning daily rental revenue, please join our official Telegram channel:\n\n` +
          `👉 <b>${targetChannel}</b>\n\n` +
          `After joining, tap <b>✅ Verify Membership</b> to continue.`;

        return {
          verified: false,
          message: gateText,
          keyboard: {
            inline_keyboard: [
              [{ text: '📢 Join Official Channel', url: `https://t.me/${channelUser}` }],
              [{ text: '✅ Verify Membership', callback_data: 'verify_membership' }],
            ],
          },
        };
      }
    }

    const welcomeText = `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `👋 <b>Welcome to Titan Stream, ${userCtx.firstName}!</b>\n\n` +
      `The world's computing demand is growing every day.\n\n` +
      `Businesses rent cloud computing power to run AI, software, automation, and high-performance workloads.\n\n` +
      `Titan Stream allows you to reserve a portion of our professionally managed cloud infrastructure through Machines.\n\n` +
      `As businesses rent this computing capacity, a share of the rental revenue is distributed to Machine owners.\n\n` +
      `Everything is managed for you. No technical knowledge required.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━`;

    const verifiedKeyboard = {
      inline_keyboard: [
        [
          {
            text: '🚀 Launch Titan Stream',
            web_app: { url: this.webAppUrl },
          },
        ],
        [
          { text: '📚 Learn How It Works', callback_data: 'edu_menu' },
          { text: '🎁 Invite Friends', callback_data: 'cmd_referrals' },
        ],
        [
          { text: '💬 Support Desk', callback_data: 'sup_menu' },
          { text: '🔍 Run Account Check', callback_data: 'cmd_health_report' },
        ],
      ],
    };

    return {
      verified: true,
      message: welcomeText,
      keyboard: verifiedKeyboard,
    };
  }
}
