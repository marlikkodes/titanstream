import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { AdminMerchantService } from '../services/admin-merchant.service';
import { MerchantPaymentMatchingService } from '../../settlement/merchant-payment-matching.service';

@Controller('admin/merchant-settlements')
export class AdminMerchantController {
  constructor(
    private readonly adminMerchantService: AdminMerchantService,
    private readonly matchingService: MerchantPaymentMatchingService,
  ) {}

  @Get('pending')
  async getPendingQueue() {
    const items = await this.adminMerchantService.getPendingVerificationQueue();
    return { success: true, count: items.length, data: items };
  }

  @Post('claims/:claimId/verify-and-settle')
  async verifyAndSettle(@Param('claimId') claimId: string, @Body() body: { adminUserId?: string }) {
    const adminUserId = body?.adminUserId || 'system_admin';
    const res = await this.adminMerchantService.verifyAndSettle(claimId, adminUserId);
    return { success: true, data: res };
  }

  @Post('claims/:claimId/reject')
  async rejectClaim(@Param('claimId') claimId: string, @Body() body: { adminUserId?: string; reason?: string }) {
    const adminUserId = body?.adminUserId || 'system_admin';
    const res = await this.adminMerchantService.rejectClaim(claimId, adminUserId, body?.reason);
    return { success: true, data: res };
  }

  @Post('transactions/ingest')
  async ingestTransaction(@Body() body: {
    merchantId: string;
    network: string;
    transactionReference: string;
    amount: number;
    currency?: string;
    senderPhone?: string;
    recipientMerchant?: string;
    rawMetadata?: Record<string, any>;
  }) {
    const tx = await this.matchingService.ingestMerchantTransaction(body);
    return { success: true, data: tx };
  }
}
