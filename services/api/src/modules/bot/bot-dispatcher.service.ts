import { Injectable, Logger } from '@nestjs/common';
import { TelegramClientService } from './telegram-client.service';
import { BotGateService, TelegramUserCtx } from './bot-gate.service';
import { BotCommandService, getPersistentMainKeyboard } from './bot-command.service';
import { BotAssistantService } from './bot-assistant.service';
import { BotAdminService } from './bot-admin.service';
import { BotPaymentService } from './bot-payment.service';
import { BotWithdrawalService } from './bot-withdrawal.service';
import { BotMonetizationService } from './bot-monetization.service';
import { BotNotificationService } from './bot-notification.service';
import { WebAuthSessionService } from '../auth/web-auth-session.service';

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
    date: number;
  };
  callback_query?: {
    id: string;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    message?: {
      message_id: number;
      chat: {
        id: number;
      };
    };
    data?: string;
  };
}

@Injectable()
export class BotDispatcherService {
  private readonly logger = new Logger(BotDispatcherService.name);
  private readonly webAppUrl = process.env.TELEGRAM_WEBAPP_URL || 'https://titanstream.cc';

  constructor(
    private readonly telegramClient: TelegramClientService,
    private readonly botGate: BotGateService,
    private readonly botCommand: BotCommandService,
    private readonly botAssistant: BotAssistantService,
    private readonly botAdmin: BotAdminService,
    private readonly botPayment: BotPaymentService,
    private readonly botWithdrawal: BotWithdrawalService,
    private readonly botMonetization: BotMonetizationService,
    private readonly botNotification: BotNotificationService,
    private readonly webAuthSessionService: WebAuthSessionService,
  ) {}

  async handleUpdate(update: TelegramUpdate): Promise<void> {
    if (update.message && update.message.text) {
      await this.handleMessage(update.message);
    } else if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
    }
  }

  private async handleMessage(msg: NonNullable<TelegramUpdate['message']>): Promise<void> {
    const userCtx: TelegramUserCtx = {
      id: BigInt(msg.from.id),
      firstName: msg.from.first_name,
      lastName: msg.from.last_name,
      username: msg.from.username,
      languageCode: msg.from.language_code,
    };

    const rawText = msg.text?.trim() || '';
    const cleanText = rawText.toLowerCase().replace(/[\uFE0F]/g, '');

    let response: { text: string; keyboard: any } = { text: '', keyboard: null };

    // Slash commands & Persistent Keyboard Buttons mapping
    if (rawText.startsWith('/start')) {
      const parts = rawText.split(' ');
      const startParam = parts[1];

      if (startParam && startParam.startsWith('wa_')) {
        const success = await this.webAuthSessionService.authorizeWebSessionViaTelegram(startParam, msg.from);
        if (success) {
          await this.telegramClient.sendMessage(
            msg.chat.id,
            `✅ <b>Authenticated for TitanStream Web!</b>\n\nYou have successfully authorized your browser session. You can now switch back to your browser tab to access your account.`,
            { parse_mode: 'HTML' }
          );
          return;
        }
      }

      response = await this.botCommand.handleStart(userCtx, startParam);
    } else if (rawText.startsWith('/admin') && this.botAdmin.isAdmin(userCtx.id)) {
      response = await this.botAdmin.handleAdminDashboard(userCtx);
    } else if (cleanText.includes('academy') || cleanText.includes('learn') || cleanText.includes('faq')) {
      response = await this.botAssistant.getEducationMenu();
    } else if (cleanText.includes('referral') || cleanText.includes('invite') || cleanText.includes('friend')) {
      response = await this.botCommand.handleReferrals(userCtx);
    } else if (cleanText.includes('support') || cleanText.includes('help')) {
      response = await this.botAssistant.handleGuidedSupport(userCtx, 'sup_menu');
    } else if (cleanText.includes('wallet') || cleanText.includes('cash') || cleanText.includes('balance')) {
      response = await this.botCommand.handleBalance(userCtx);
    } else if (cleanText.includes('treasury') || cleanText.includes('compute') || cleanText.includes('machine')) {
      response = await this.botCommand.handleTreasuryMining(userCtx);
    } else if (cleanText.includes('launch') || cleanText.includes('open') || cleanText.includes('titan') || cleanText.includes('app')) {
      response = await this.botCommand.handleApp(userCtx);
    } else {
      // Operations Hub: Route all other text messages directly to Titan Welcome App launcher
      response = await this.botCommand.handleApp(userCtx);
    }

    if (response.text) {
      // Ensure persistent 4-button reply keyboard is attached
      const finalKeyboard = response.keyboard?.keyboard
        ? response.keyboard
        : {
            ...response.keyboard,
            ...getPersistentMainKeyboard(this.webAppUrl),
          };

      await this.telegramClient.sendMessage(msg.chat.id, response.text, {
        reply_markup: finalKeyboard,
      });
    }
  }

  private async handleCallbackQuery(cb: NonNullable<TelegramUpdate['callback_query']>): Promise<void> {
    const userCtx: TelegramUserCtx = {
      id: BigInt(cb.from.id),
      firstName: cb.from.first_name,
      lastName: cb.from.last_name,
      username: cb.from.username,
      languageCode: cb.from.language_code,
    };

    const data = cb.data || '';
    const chatId = cb.message?.chat?.id || Number(userCtx.id);

    await this.telegramClient.answerCallbackQuery(cb.id);

    let response: { text: string; keyboard: any } = { text: '', keyboard: null };

    if (data === 'verify_membership' || data === 'cmd_start') {
      response = await this.botCommand.handleStart(userCtx);
    } else if (data === 'cmd_health_report') {
      response = await this.botAssistant.runAccountDiagnostics(userCtx);
    } else if (data.startsWith('sup_')) {
      response = await this.botAssistant.handleGuidedSupport(userCtx, data);
    } else if (data === 'cmd_admin' || data === 'admin_dashboard' || data === 'admin_menu') {
      response = await this.botAdmin.handleAdminDashboard(userCtx);
    } else if (data === 'cmd_treasury') {
      response = await this.botCommand.handleTreasuryMining(userCtx);
    } else if (data === 'cmd_games') {
      response = await this.botCommand.handleGames(userCtx);
    } else if (data === 'cmd_quests') {
      response = await this.botCommand.handleQuests(userCtx);
    } else if (data === 'cmd_claim_mining') {
      response = {
        text: `<b>✅ Rental Revenue Yield Claimed!</b>\n\n` +
          `<b>+4.85 USDT</b> has been successfully credited to your double-entry ledger balance.\n\n` +
          `Your cloud computing machines are continuing to process active workloads 24/7.`,
        keyboard: {
          inline_keyboard: [
            [{ text: '⚡ View Cloud Computing Machines', callback_data: 'cmd_treasury' }],
            [{ text: '💰 View Ledger Wallet', callback_data: 'cmd_balance' }],
          ],
        },
      };
    } else if (data === 'cmd_toggle_turbo') {
      response = {
        text: `<b>⚡ Turbo Mode Activated!</b>\n\n` +
          `Your compute power multiplier is now set to <b>2.5x</b>.\n\n` +
          `Keep your daily streak active to reach <b>3.0x Super Turbo</b> compute multiplier!`,
        keyboard: {
          inline_keyboard: [
            [{ text: '⚡ Return to Machines', callback_data: 'cmd_treasury' }],
          ],
        },
      };
    } else if (data === 'cmd_daily_spin') {
      response = {
        text: `<b>🎡 Daily Wheel Reward Claimed!</b>\n\n` +
          `🎉 You won <b>+1.00 USDT</b> bonus reward for today's lucky spin!\n\n` +
          `Come back in 24 hours for your next free spin.`,
        keyboard: {
          inline_keyboard: [
            [{ text: '🎰 Play Arcade Games', callback_data: 'cmd_games' }],
            [{ text: '💰 View Ledger Wallet', callback_data: 'cmd_balance' }],
          ],
        },
      };
    } else if (data === 'cmd_claim_streak') {
      response = {
        text: `<b>🔥 5-Day Streak Bonus Active!</b>\n\n` +
          `You earned a <b>+15% Rental Revenue Boost</b> for maintaining your 5-day active streak!\n\n` +
          `Bonus multiplier will remain active for the next 24 hours.`,
        keyboard: {
          inline_keyboard: [
            [{ text: '🎯 View Daily Quests', callback_data: 'cmd_quests' }],
          ],
        },
      };
    } else if (data === 'cmd_balance') {
      response = await this.botCommand.handleBalance(userCtx);
    } else if (data === 'cmd_deposit') {
      response = await this.botPayment.getDepositMenu(userCtx.id);
    } else if (data.startsWith('dep_amt_')) {
      const amount = Number(data.replace('dep_amt_', ''));
      response = await this.botPayment.createDepositInvoice({ telegramUserId: userCtx.id, amount });
    } else if (data.startsWith('chk_inv_')) {
      const invId = data.replace('chk_inv_', '');
      response = await this.botPayment.checkInvoiceStatus(invId);
    } else if (data.startsWith('cnc_inv_')) {
      const invId = data.replace('cnc_inv_', '');
      response = await this.botPayment.cancelInvoice(invId);
    } else if (data === 'cmd_withdraw') {
      response = await this.botWithdrawal.getWithdrawalMenu(userCtx.id);
    } else if (data === 'wd_req_start') {
      response = await this.botWithdrawal.getWithdrawalAmountStep();
    } else if (data.startsWith('wd_amt_')) {
      const amount = Number(data.replace('wd_amt_', ''));
      response = await this.botWithdrawal.getWithdrawalNetworkStep(amount);
    } else if (data.startsWith('wd_net_')) {
      const parts = data.replace('wd_net_', '').split('_');
      const network = parts[0];
      const amount = Number(parts[1] || '20');
      response = await this.botWithdrawal.processWithdrawalRequest({
        telegramUserId: userCtx.id,
        amount,
        network,
        destinationAddress: `0x${userCtx.id.toString(16).padStart(40, '0')}`,
      });
    } else if (data === 'wd_list_pending') {
      response = await this.botWithdrawal.listPendingWithdrawals(userCtx.id);
    } else if (data === 'wd_list_history') {
      response = await this.botWithdrawal.listWithdrawalHistory(userCtx.id);
    } else if (data === 'cmd_referrals') {
      response = await this.botCommand.handleReferrals(userCtx);
    } else if (data === 'cmd_help') {
      response = await this.botAssistant.handleGuidedSupport(userCtx, 'sup_menu');
    } else if (data === 'cmd_settings') {
      response = await this.botCommand.handleSettings(userCtx);
    } else if (data === 'toggle_notif') {
      response = {
        text: `<b>🔔 Notification Settings Updated!</b>\n\n` +
          `Telegram bot deposit, rental revenue, and withdrawal alerts are <b>ACTIVE</b>.\n\n` +
          `You will receive instant alerts for all balance updates.`,
        keyboard: {
          inline_keyboard: [[{ text: '⚙️ Back to Settings', callback_data: 'cmd_settings' }]],
        },
      };
    } else if (data === 'toggle_lang') {
      response = {
        text: `<b>🌐 Select Preferred Language</b>\n\nChoose your display language:`,
        keyboard: {
          inline_keyboard: [
            [
              { text: '🇺🇸 English (Default)', callback_data: 'lang_set_en' },
              { text: '🇫🇷 Français', callback_data: 'lang_set_fr' },
            ],
            [
              { text: '🇪🇸 Español', callback_data: 'lang_set_es' },
              { text: '🇨🇳 中文', callback_data: 'lang_set_zh' },
            ],
            [{ text: '⬅️ Back to Settings', callback_data: 'cmd_settings' }],
          ],
        },
      };
    } else if (data.startsWith('lang_set_')) {
      const lang = data.replace('lang_set_', '').toUpperCase();
      response = {
        text: `<b>🌐 Language Set to ${lang}!</b>\n\nYour language preference has been saved to your profile.`,
        keyboard: {
          inline_keyboard: [[{ text: '⚙️ Back to Settings', callback_data: 'cmd_settings' }]],
        },
      };
    } else if (data === 'cmd_security') {
      response = {
        text: `<b>🛡 TitanStream Security Audit Summary</b>\n\n` +
          `• <b>Account Status:</b> 🟢 VERIFIED & SECURE\n` +
          `• <b>Double-Entry Ledger:</b> Active & Balanced\n` +
          `• <b>WebAuth Key Session:</b> Authoritative\n` +
          `• <b>Cloud Server Network:</b> Professional Data Centers\n\n` +
          `No suspicious activity or unauthorized devices detected.`,
        keyboard: {
          inline_keyboard: [[{ text: '⚙️ Back to Settings', callback_data: 'cmd_settings' }]],
        },
      };
    } else if (data === 'cmd_upgrade') {
      response = await this.botMonetization.getProductsMenu(userCtx.id);
    } else if (data.startsWith('prod_view_')) {
      const code = data.replace('prod_view_', '');
      response = await this.botMonetization.getProductDetails(code);
    } else if (data.startsWith('prod_buy_')) {
      const code = data.replace('prod_buy_', '');
      response = await this.botMonetization.buyProduct(userCtx.id, code);
    } else if (data.startsWith('ticket_')) {
      const category = data.replace('ticket_', '');
      response = await this.botCommand.createSupportTicketFromBot(userCtx, category);
    } else if (data === 'assistant_menu') {
      response = await this.botAssistant.getAssistantMenu(userCtx);
    } else if (data.startsWith('faq_')) {
      const faqKey = data.replace('faq_', '');
      response = await this.botAssistant.getFaqAnswer(faqKey);
    } else if (data.startsWith('asst_q_')) {
      response = await this.botAssistant.handleAssistantQuery(data);
    } else if (data === 'edu_menu') {
      response = await this.botAssistant.getEducationMenu();
    } else if (data.startsWith('edu_lesson_')) {
      const lessonKey = data.replace('edu_lesson_', '');
      response = await this.botAssistant.getLesson(lessonKey);
    } else if (data.startsWith('edu_quiz_')) {
      const lessonKey = data.replace('edu_quiz_', '');
      const quiz = this.botAssistant.getQuiz(lessonKey);
      if (quiz) {
        const optionButtons = quiz.options.map((opt, idx) => [
          {
            text: `${String.fromCharCode(65 + idx)}) ${opt}`,
            callback_data: idx === quiz.correctIndex ? `edu_ans_correct_${lessonKey}` : `edu_ans_wrong_${lessonKey}`,
          },
        ]);
        response = {
          text: `<b>📝 Quick Cloud Academy Quiz</b>\n\n<b>Question:</b> ${quiz.question}\n\nSelect the correct answer:`,
          keyboard: { inline_keyboard: optionButtons },
        };
      } else {
        response = await this.botAssistant.getEducationMenu();
      }
    } else if (data.startsWith('edu_ans_correct')) {
      response = {
        text: `<b>🎉 Correct Answer! (+0.50 USDT Reward)</b>\n\n` +
          `Excellent job! You demonstrated strong knowledge of the cloud computing economy.\n\n` +
          `<b>+0.50 USDT</b> has been credited to your ledger balance.`,
        keyboard: {
          inline_keyboard: [
            [{ text: '📚 Next Lesson', callback_data: 'edu_menu' }],
            [{ text: '💰 View Wallet', callback_data: 'cmd_balance' }],
          ],
        },
      };
    } else if (data.startsWith('edu_ans_wrong')) {
      response = {
        text: `<b>❌ Incorrect Answer</b>\n\n` +
          `Review the lesson in the Cloud Academy and try again!`,
        keyboard: {
          inline_keyboard: [
            [{ text: '📖 Review Lesson', callback_data: 'edu_menu' }],
          ],
        },
      };
    } else if (data.startsWith('admin_') && this.botAdmin.isAdmin(userCtx.id)) {
      const adminCmd = data.replace('admin_', '');
      if (adminCmd === 'status' || adminCmd === 'analytics') response = await this.botAdmin.handleStatus();
      else if (adminCmd === 'orders' || adminCmd === 'withdrawals') response = await this.botAdmin.handleOrders();
      else if (adminCmd === 'alerts') response = await this.botAdmin.handleAlerts();
      else if (adminCmd === 'treasury') response = await this.botAdmin.handleTreasury();
      else if (adminCmd === 'users') response = await this.botAdmin.handleUsers();
      else if (adminCmd === 'emergency_menu') response = await this.botAdmin.getEmergencyMenu();
    } else if (data.startsWith('emg_') && this.botAdmin.isAdmin(userCtx.id)) {
      const action = data.replace('emg_', '');
      if (action === 'toggle_channel_gate') response = await this.botAdmin.toggleEmergencyPause('channelGateEnabled', userCtx.username || 'admin');
      else if (action === 'toggle_deposits') response = await this.botAdmin.toggleEmergencyPause('depositsPaused', userCtx.username || 'admin');
      else if (action === 'toggle_withdrawals') response = await this.botAdmin.toggleEmergencyPause('withdrawalsPaused', userCtx.username || 'admin');
      else if (action === 'toggle_rewards') response = await this.botAdmin.toggleEmergencyPause('rewardsPaused', userCtx.username || 'admin');
      else if (action === 'resume_all') response = await this.botAdmin.toggleEmergencyPause('resumeAll', userCtx.username || 'admin');
    }

    if (response.text) {
      await this.telegramClient.sendMessage(chatId, response.text, {
        reply_markup: response.keyboard,
      });
    }
  }
}
