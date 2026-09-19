import { Controller, Get, Post, Body, Param, UseGuards, Query } from '@nestjs/common';
import { PaymentIntentService } from './payment-intent.service';
import { CreatePaymentIntentDto, PaymentIntentView } from './interfaces/payment-intent.interface';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/user.interface';
import { AdminAuthGuard } from '../admin/guards/admin-auth.guard';
import { CurrentAdmin } from '../admin/decorators/current-admin.decorator';
import { AdminUser } from '@prisma/client';

@Controller('api/v1/payment-intents')
export class PaymentIntentController {
  constructor(private readonly paymentIntentService: PaymentIntentService) {}

  /**
   * Create a new PaymentIntent
   * POST /api/v1/payment-intents
   */
  @Post()
  @UseGuards(AuthGuard)
  async createPaymentIntent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePaymentIntentDto,
  ): Promise<PaymentIntentView> {
    return this.paymentIntentService.createPaymentIntent({
      ...dto,
      telegramUserId: BigInt(user.id),
    });
  }

  /**
   * Get a specific PaymentIntent
   * GET /api/v1/payment-intents/:id
   */
  @Get(':id')
  @UseGuards(AuthGuard)
  async getPaymentIntent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<PaymentIntentView> {
    return this.paymentIntentService.getPaymentIntent(id, BigInt(user.id));
  }

  /**
   * Get active PaymentIntent for current user
   * GET /api/v1/payment-intents/active
   */
  @Get('active')
  @UseGuards(AuthGuard)
  async getActivePaymentIntent(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaymentIntentView | null> {
    return this.paymentIntentService.getActivePaymentIntent(BigInt(user.id));
  }

  /**
   * Cancel a PaymentIntent
   * POST /api/v1/payment-intents/:id/cancel
   */
  @Post(':id/cancel')
  @UseGuards(AuthGuard)
  async cancelPaymentIntent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<PaymentIntentView> {
    return this.paymentIntentService.cancelPaymentIntent(id, BigInt(user.id));
  }

  /**
   * Get pending payment intents for admin approval queue
   * GET /api/v1/payment-intents/admin/pending
   */
  @Get('admin/pending')
  @UseGuards(AdminAuthGuard)
  async getPendingPaymentIntents(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<PaymentIntentView[]> {
    return this.paymentIntentService.getPendingPaymentIntents(
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  /**
   * Admin verify and approve payment
   * POST /api/v1/payment-intents/:id/verify
   */
  @Post(':id/verify')
  @UseGuards(AdminAuthGuard)
  async verifyPaymentIntent(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminUser,
    @Body() dto: any,
  ): Promise<PaymentIntentView> {
    return this.paymentIntentService.verifyPaymentIntent(
      id,
      admin.id,
      admin.email,
      dto.verifiedAmount,
      dto.verifiedCurrency,
      dto.verifiedReference,
      dto.blockchainTxHash,
      dto.reviewNotes,
    );
  }

  /**
   * Admin reject payment
   * POST /api/v1/payment-intents/:id/reject
   */
  @Post(':id/reject')
  @UseGuards(AdminAuthGuard)
  async rejectPaymentIntent(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminUser,
    @Body() dto: any,
  ): Promise<PaymentIntentView> {
    return this.paymentIntentService.rejectPaymentIntent(
      id,
      admin.id,
      admin.email,
      dto.rejectionReason,
      dto.reviewNotes,
    );
  }

  /**
   * Escalate to manual review
   * POST /api/v1/payment-intents/:id/escalate
   */
  @Post(':id/escalate')
  @UseGuards(AdminAuthGuard)
  async escalateToManualReview(
    @Param('id') id: string,
    @Body() dto: any,
  ): Promise<PaymentIntentView> {
    return this.paymentIntentService.escalateToManualReview(id, dto.reason);
  }

  /**
   * Settle payment (transition from VERIFIED to SETTLED via FinancialOrchestrator)
   * POST /api/v1/payment-intents/:id/settle
   */
  @Post(':id/settle')
  @UseGuards(AdminAuthGuard)
  async settlePaymentIntent(
    @Param('id') id: string,
  ): Promise<PaymentIntentView> {
    return this.paymentIntentService.settlePaymentIntent(id);
  }
}
