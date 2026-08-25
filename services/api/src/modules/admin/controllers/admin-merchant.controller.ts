import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { AdminMerchantService } from '../services/admin-merchant.service';
import { MerchantPaymentMatchingService } from '../../settlement/merchant-payment-matching.service';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { RbacGuard } from '../guards/rbac.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { AdminPermission } from '../interfaces/admin-permissions.enum';
import { CurrentAdmin, AuthenticatedAdmin } from '../decorators/current-admin.decorator';

@Controller('admin/merchant-settlements')
@UseGuards(AdminAuthGuard, RbacGuard)
export class AdminMerchantController {
  constructor(
    private readonly adminMerchantService: AdminMerchantService,
    private readonly matchingService: MerchantPaymentMatchingService,
  ) {}

  @Get('pending')
  @Permissions(AdminPermission.MERCHANT_VIEW)
  async getPendingQueue() {
    const items = await this.adminMerchantService.getPendingVerificationQueue();
    return { success: true, count: items.length, data: items };
  }

  @Post('claims/:claimId/verify-and-settle')
  @Permissions(AdminPermission.SETTLEMENT_OVERRIDE)
  async verifyAndSettle(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('claimId') claimId: string,
    @Body() body: { adminUserId?: string },
  ) {
    const adminUserId = admin?.id || body?.adminUserId || 'system_admin';
    const res = await this.adminMerchantService.verifyAndSettle(claimId, adminUserId);
    return { success: true, data: res };
  }

  @Post('claims/:claimId/reject')
  @Permissions(AdminPermission.SETTLEMENT_OVERRIDE)
  async rejectClaim(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('claimId') claimId: string,
    @Body() body: { adminUserId?: string; reason?: string },
  ) {
    const adminUserId = admin?.id || body?.adminUserId || 'system_admin';
    const res = await this.adminMerchantService.rejectClaim(claimId, adminUserId, body?.reason);
    return { success: true, data: res };
  }

  @Post('transactions/ingest')
  @Permissions(AdminPermission.SETTLEMENT_OVERRIDE)
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

  @Get('merchants')
  @Permissions(AdminPermission.MERCHANT_VIEW)
  async listMerchants() {
    const data = await this.adminMerchantService.listMerchants();
    return { success: true, data };
  }

  @Post('merchants')
  @Permissions(AdminPermission.MERCHANT_CREATE)
  async upsertMerchant(@Body() body: {
    id?: string;
    network: string;
    merchantName: string;
    merchantNumber: string;
    country?: string;
    currency?: string;
    status?: string;
    dailyLimit?: number | string;
    perTransactionLimit?: number | string;
  }) {
    return this.adminMerchantService.upsertMerchant(body);
  }

  @Post('merchants/:id/status')
  @Permissions(AdminPermission.MERCHANT_SUSPEND)
  async toggleStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.adminMerchantService.toggleMerchantStatus(id, body?.status || 'ACTIVE');
  }
}
