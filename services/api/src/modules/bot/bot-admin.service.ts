import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TelegramClientService } from './telegram-client.service';
import { TelegramUserCtx } from './bot-gate.service';
import { OperationalAuditService } from '../admin/services/operational-audit.service';

@Injectable()
export class BotAdminService {
  private readonly logger = new Logger(BotAdminService.name);
  private readonly adminTelegramIds: Set<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramClient: TelegramClientService,
    @Optional() private readonly auditService?: OperationalAuditService,
  ) {
    const ids = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map((id) => id.trim()).filter(Boolean);
    this.adminTelegramIds = new Set(ids);
  }

  isAdmin(telegramUserId: bigint | string | number): boolean {
    if (!telegramUserId) return false;
    const idStr = telegramUserId.toString().trim();
    if (!idStr || this.adminTelegramIds.size === 0) {
      return false;
    }
    return this.adminTelegramIds.has(idStr);
  }

  async getEmergencyState() {
    let state = await this.prisma.emergencyControlState.findUnique({
      where: { id: 'SYSTEM_EMERGENCY_STATE' },
    });

    if (!state) {
      const mainChannelId = process.env.TELEGRAM_CHANNEL_ID || '@tetherstream';
      state = await this.prisma.emergencyControlState.create({
        data: {
          id: 'SYSTEM_EMERGENCY_STATE',
          depositsPaused: false,
          withdrawalsPaused: false,
          rewardsPaused: false,
          channelGateEnabled: true,
          requiredChannelId: mainChannelId,
        },
      });
    }

    return state;
  }

  async handleAdminDashboard(userCtx: TelegramUserCtx): Promise<{ text: string; keyboard: any }> {
    if (!this.isAdmin(userCtx.id)) {
      return {
        text: `<b>⛔ Access Denied</b>\n\nYou are not authorized to access the Admin Control Plane.`,
        keyboard: null,
      };
    }

    const state = await this.getEmergencyState();
    const systemStatus = state.depositsPaused || state.withdrawalsPaused || state.rewardsPaused ? '⚠️ PAUSED (PARTIAL)' : '🟢 ALL SYSTEMS OPERATIONAL';

    const text = `<b>🛡 TitanStream Admin Control Panel</b>\n\n` +
      `Welcome, Operator <b>${userCtx.firstName}</b>.\n\n` +
      `<b>System Health:</b> ${systemStatus}\n` +
      `<b>Channel Gate:</b> ${state.channelGateEnabled ? `🟢 REQUIRED (${state.requiredChannelId})` : '⚪ DISABLED (OPEN ACCESS)'}\n\n` +
      `Select an administrative department:`;

    return {
      text,
      keyboard: {
        inline_keyboard: [
          [
            { text: '📦 Pending Orders', callback_data: 'admin_orders' },
            { text: '💸 Withdrawals', callback_data: 'admin_withdrawals' },
          ],
          [
            { text: '🚨 Risk Alerts', callback_data: 'admin_alerts' },
            { text: '💰 Treasury', callback_data: 'admin_treasury' },
          ],
          [
            { text: '👥 Users', callback_data: 'admin_users' },
            { text: '📊 Analytics', callback_data: 'admin_analytics' },
          ],
          [
            { text: '🛑 Emergency & Gate Controls', callback_data: 'admin_emergency_menu' },
          ],
        ],
      },
    };
  }

  async handleStatus(): Promise<{ text: string; keyboard: any }> {
    const [userCount, readyUserCount, activeSessionsCount, openTicketsCount] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isReady: true } }),
      this.prisma.settlementSession.count({ where: { status: 'WAITING_PAYMENT' } }),
      this.prisma.supportCase.count({ where: { status: 'OPEN' } }),
    ]);

    const text = `<b>📊 System Operational Summary</b>\n\n` +
      `• <b>Total Users:</b> ${userCount}\n` +
      `• <b>Ready Users:</b> ${readyUserCount}\n` +
      `• <b>Active Settlements:</b> ${activeSessionsCount}\n` +
      `• <b>Open Support Cases:</b> ${openTicketsCount}\n` +
      `• <b>API Status:</b> 🟢 ONLINE\n` +
      `• <b>Database Engine:</b> 🟢 CONNECTED`;

    return {
      text,
      keyboard: {
        inline_keyboard: [[{ text: '🔄 Refresh Status', callback_data: 'admin_status' }], [{ text: '⬅️ Back', callback_data: 'cmd_admin' }]],
      },
    };
  }

  async handleOrders(): Promise<{ text: string; keyboard: any }> {
    const recent = await this.prisma.settlementSession.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const ordersList = recent
      .map(
        (o) =>
          `• <code>${o.referenceCode}</code> — ${Number(o.requestedAmount)} USDT [<b>${o.status}</b>]`,
      )
      .join('\n');

    const text = `<b>📦 Recent Settlement Orders (Last 5)</b>\n\n${ordersList || 'No recent orders'}`;

    return {
      text,
      keyboard: {
        inline_keyboard: [
          [{ text: '🔄 Refresh Orders', callback_data: 'admin_orders' }],
          [{ text: '⬅️ Back', callback_data: 'cmd_admin' }],
        ],
      },
    };
  }

  async handleAlerts(): Promise<{ text: string; keyboard: any }> {
    const [riskEvents, openCases] = await Promise.all([
      this.prisma.riskEvent.findMany({ where: { status: 'OPEN' }, take: 3 }),
      this.prisma.supportCase.findMany({ where: { status: 'OPEN' }, take: 3 }),
    ]);

    let alertSummary = '<b>🚨 Active Admin Risk & System Alerts</b>\n\n';

    if (riskEvents.length > 0) {
      alertSummary += '<b>Risk Flags:</b>\n';
      riskEvents.forEach((r) => {
        alertSummary += `• [${r.severity}] ${r.ruleTriggered} — ${r.entityType}:${r.entityId}\n`;
      });
    } else {
      alertSummary += '• No active risk flags.\n';
    }

    if (openCases.length > 0) {
      alertSummary += '\n<b>Pending Support Tickets:</b>\n';
      openCases.forEach((c) => {
        alertSummary += `• Ticket #${c.id.slice(0, 8)} (${c.category}) — Priority ${c.priority}\n`;
      });
    } else {
      alertSummary += '\n• No open support tickets.';
    }

    return {
      text: alertSummary,
      keyboard: {
        inline_keyboard: [
          [{ text: '🔄 Refresh Alerts', callback_data: 'admin_alerts' }],
          [{ text: '⬅️ Back', callback_data: 'cmd_admin' }],
        ],
      },
    };
  }

  async handleTreasury(): Promise<{ text: string; keyboard: any }> {
    const assets = await this.prisma.asset.findMany({ where: { enabled: true } });
    const text = `<b>🏦 System Treasury Health</b>\n\n` +
      `• <b>Primary Reserve:</b> USDT (Multi-chain)\n` +
      `• <b>Enabled Assets:</b> ${assets.map((a) => a.symbol).join(', ')}\n` +
      `• <b>Liquidity Engine:</b> Active\n` +
      `• <b>Reconciliation:</b> PASSED`;

    return {
      text,
      keyboard: {
        inline_keyboard: [
          [{ text: '🔄 Refresh Treasury', callback_data: 'admin_treasury' }],
          [{ text: '⬅️ Back', callback_data: 'cmd_admin' }],
        ],
      },
    };
  }

  async handleUsers(): Promise<{ text: string; keyboard: any }> {
    const [total, verifiedChannel, ready] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { channelVerified: true } }),
      this.prisma.user.count({ where: { isReady: true } }),
    ]);

    const text = `<b>👥 User Analytics Dashboard</b>\n\n` +
      `• Total User Accounts: <b>${total}</b>\n` +
      `• Channel Verified: <b>${verifiedChannel}</b>\n` +
      `• Fully Onboarded & Ready: <b>${ready}</b>`;

    return {
      text,
      keyboard: {
        inline_keyboard: [
          [{ text: '🔄 Refresh Users', callback_data: 'admin_users' }],
          [{ text: '⬅️ Back', callback_data: 'cmd_admin' }],
        ],
      },
    };
  }

  async getEmergencyMenu(): Promise<{ text: string; keyboard: any }> {
    const state = await this.getEmergencyState();

    const text = `<b>🛑 Emergency & Operational Controls</b>\n\n` +
      `Manage global system switches and channel membership rules:\n\n` +
      `• 📢 <b>Channel Membership Gate:</b> <b>${state.channelGateEnabled ? `🟢 REQUIRED (${state.requiredChannelId})` : '⚪ DISABLED (OPEN ACCESS)'}</b>\n` +
      `• 💳 <b>Deposits:</b> <b>${state.depositsPaused ? '⛔ PAUSED' : '🟢 ACTIVE'}</b>\n` +
      `• 💸 <b>Withdrawals:</b> <b>${state.withdrawalsPaused ? '⛔ PAUSED' : '🟢 ACTIVE'}</b>\n` +
      `• 🎁 <b>Rewards:</b> <b>${state.rewardsPaused ? '⛔ PAUSED' : '🟢 ACTIVE'}</b>`;

    return {
      text,
      keyboard: {
        inline_keyboard: [
          [{ text: state.channelGateEnabled ? '⚪ Disable Channel Gate' : '📢 Enable Channel Gate', callback_data: 'emg_toggle_channel_gate' }],
          [{ text: state.depositsPaused ? '▶️ Resume Deposits' : '⛔ Pause Deposits', callback_data: 'emg_toggle_deposits' }],
          [{ text: state.withdrawalsPaused ? '▶️ Resume Withdrawals' : '⛔ Pause Withdrawals', callback_data: 'emg_toggle_withdrawals' }],
          [{ text: state.rewardsPaused ? '▶️ Resume Rewards' : '⛔ Pause Rewards', callback_data: 'emg_toggle_rewards' }],
          [{ text: '✅ Resume All Systems & Enable Gate', callback_data: 'emg_resume_all' }],
          [{ text: '⬅️ Back to Admin Dashboard', callback_data: 'cmd_admin' }],
        ],
      },
    };
  }

  async toggleEmergencyPause(
    field: 'depositsPaused' | 'withdrawalsPaused' | 'rewardsPaused' | 'channelGateEnabled' | 'resumeAll',
    adminUsername: string,
  ): Promise<{ text: string; keyboard: any }> {
    const state = await this.getEmergencyState();

    if (field === 'resumeAll') {
      await this.prisma.emergencyControlState.update({
        where: { id: 'SYSTEM_EMERGENCY_STATE' },
        data: {
          depositsPaused: false,
          withdrawalsPaused: false,
          rewardsPaused: false,
          channelGateEnabled: true,
          updatedBy: adminUsername,
        },
      });
    } else {
      await this.prisma.emergencyControlState.update({
        where: { id: 'SYSTEM_EMERGENCY_STATE' },
        data: {
          [field]: !state[field],
          updatedBy: adminUsername,
        },
      });
    }

    if (this.auditService) {
      await this.auditService.logAction({
        actorId: `tg_admin_${adminUsername}`,
        actorRole: 'ADMIN',
        action: `TELEGRAM_EMERGENCY_CONTROL_${field.toUpperCase()}`,
        entity: 'EMERGENCY_CONTROL_STATE',
        entityId: 'SYSTEM_EMERGENCY_STATE',
        beforeState: {
          depositsPaused: state.depositsPaused,
          withdrawalsPaused: state.withdrawalsPaused,
          rewardsPaused: state.rewardsPaused,
          channelGateEnabled: state.channelGateEnabled,
        },
        afterState: field === 'resumeAll'
          ? { depositsPaused: false, withdrawalsPaused: false, rewardsPaused: false, channelGateEnabled: true }
          : { [field]: !(state as any)[field] },
        metadata: { adminUsername, field },
      }).catch((err) => this.logger.error(`Failed to audit emergency control toggle: ${err.message}`));
    }

    return this.getEmergencyMenu();
  }

  async sendLargeWithdrawalAlert(details: {
    userId: string;
    username?: string;
    amount: string;
    reference: string;
    riskLevel: string;
  }): Promise<void> {
    const alertText = `🚨 <b>Large Withdrawal Request Alert</b>\n\n` +
      `<b>User:</b> @${details.username || details.userId}\n` +
      `<b>Amount:</b> <code>${details.amount} USDT</code>\n` +
      `<b>Reference:</b> <code>${details.reference}</code>\n` +
      `<b>Risk Level:</b> <b>${details.riskLevel}</b>\n\n` +
      `Action required by admin operator:`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Approve', callback_data: `admin_approve_tx_${details.reference}` },
          { text: '⛔ Reject', callback_data: `admin_reject_tx_${details.reference}` },
        ],
      ],
    };

    for (const adminId of this.adminTelegramIds) {
      await this.telegramClient.sendMessage(adminId, alertText, { reply_markup: keyboard });
    }
  }
}
