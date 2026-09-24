import { Controller, Post, Get, Body, Query, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { BotDispatcherService, TelegramUpdate } from './bot-dispatcher.service';
import { BotGateService } from './bot-gate.service';
import { BotBroadcastService, CreateBroadcastDto } from './bot-broadcast.service';
import { BotAnalyticsService } from './bot-analytics.service';
import { BotPaymentService } from './bot-payment.service';
import { BotAdminService } from './bot-admin.service';
import { BotMonetizationService } from './bot-monetization.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin/guards/admin-auth.guard';

@ApiTags('Telegram Bot')
@Controller('bot')
export class BotController {
  constructor(
    private readonly botDispatcher: BotDispatcherService,
    private readonly botGate: BotGateService,
    private readonly botBroadcast: BotBroadcastService,
    private readonly botAnalytics: BotAnalyticsService,
    private readonly botPayment: BotPaymentService,
    private readonly botAdmin: BotAdminService,
    private readonly botMonetization: BotMonetizationService,
  ) {}

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Telegram Bot Webhook endpoint for receiving Telegram updates' })
  async handleWebhook(@Body() update: TelegramUpdate) {
    if (update && update.update_id) {
      await this.botDispatcher.handleUpdate(update);
    }
    return { ok: true };
  }



  @Public()
  @Get('config')
  @ApiOperation({ summary: 'Get Telegram Host Bot configuration' })
  getBotConfig() {
    return {
      botUsername: process.env.TELEGRAM_BOT_USERNAME || 'titanstream_bot',
      channelId: process.env.TELEGRAM_CHANNEL_ID || '@titanstream',
      channelUsername: process.env.TELEGRAM_CHANNEL_USERNAME || 'titanstream',
      webAppUrl: process.env.TELEGRAM_WEBAPP_URL || 'https://titanstream.cc',
      status: 'ONLINE',
    };
  }

  @Public()
  @Post('verify')
  @ApiOperation({ summary: 'Verify Telegram channel membership status' })
  async verifyMembership(@Body() body: { telegramUserId: string }) {
    const userId = BigInt(body.telegramUserId);
    const result = await this.botGate.verifyChannelMembership(userId);
    return result;
  }

  @UseGuards(AdminAuthGuard)
  @Get('emergency')
  @ApiOperation({ summary: 'Get current system emergency controls state' })
  async getEmergencyState() {
    return this.botAdmin.getEmergencyState();
  }

  @UseGuards(AdminAuthGuard)
  @Post('emergency')
  @ApiOperation({ summary: 'Toggle emergency system pause controls' })
  async toggleEmergencyState(@Body() body: { field: 'depositsPaused' | 'withdrawalsPaused' | 'rewardsPaused' | 'resumeAll'; adminUsername?: string }) {
    return this.botAdmin.toggleEmergencyPause(body.field, body.adminUsername || 'API_ADMIN');
  }

  @UseGuards(AdminAuthGuard)
  @Post('broadcast')
  @ApiOperation({ summary: 'Admin endpoint to trigger announcement broadcasts' })
  async createBroadcast(@Body() dto: CreateBroadcastDto) {
    return this.botBroadcast.createAndDispatchBroadcast(dto);
  }

  @UseGuards(AdminAuthGuard)
  @Get('broadcasts')
  @ApiOperation({ summary: 'Get history of broadcast campaigns' })
  async listBroadcasts() {
    return this.botBroadcast.listBroadcasts();
  }

  @UseGuards(AdminAuthGuard)
  @Get('analytics')
  @ApiOperation({ summary: 'Get bot acquisition, engagement, and conversion analytics' })
  async getAnalytics() {
    return this.botAnalytics.getMetricsOverview();
  }
}
