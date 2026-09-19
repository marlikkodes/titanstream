import { Controller, Get, Post, Body, Param, UseGuards, Query } from '@nestjs/common';
import { MobileMoneyApprovalQueueService } from './mobile-money-approval-queue.service';
import { AdminAuthGuard } from '../admin/guards/admin-auth.guard';

@Controller('api/v1/payment-intents/admin')
@UseGuards(AdminAuthGuard)
export class PaymentApprovalQueueController {
  constructor(private readonly approvalQueueService: MobileMoneyApprovalQueueService) {}

  /**
   * Get mobile money approval queue
   * GET /api/v1/payment-intents/admin/queue
   */
  @Get('queue')
  async getApprovalQueue(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.approvalQueueService.getApprovalQueue(
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  /**
   * Add payment to approval queue (for webhooks or admin action)
   * POST /api/v1/payment-intents/admin/queue/:paymentIntentId/add
   */
  @Post('queue/:paymentIntentId/add')
  async addToQueue(
    @Param('paymentIntentId') paymentIntentId: string,
    @Body() body: { externalReference: string },
  ) {
    await this.approvalQueueService.addToApprovalQueue(paymentIntentId, body.externalReference);
    return { success: true, message: 'Payment added to approval queue' };
  }

  /**
   * Escalate stuck payments (cron endpoint)
   * POST /api/v1/payment-intents/admin/escalate-stuck
   */
  @Post('escalate-stuck')
  async escalateStuckPayments() {
    return this.approvalQueueService.escalateStuckPayments();
  }
}
