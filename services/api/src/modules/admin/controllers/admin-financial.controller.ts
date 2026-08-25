import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { LedgerEntryType, SettlementStatus } from '@prisma/client';
import { CurrentAdmin, AuthenticatedAdmin } from '../decorators/current-admin.decorator';
import { Permissions } from '../decorators/permissions.decorator';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { RbacGuard } from '../guards/rbac.guard';
import { AdminPermission } from '../interfaces/admin-permissions.enum';
import { AdminAdjustmentDto, FinancialAdminService, LedgerExplorerParams } from '../services/financial-admin.service';

@Controller('admin/financial')
@UseGuards(AdminAuthGuard, RbacGuard)
export class AdminFinancialController {
  constructor(private readonly financialAdminService: FinancialAdminService) {}

  @Get('overview')
  @Permissions(AdminPermission.FINANCIAL_VIEW)
  async getOverview() {
    return this.financialAdminService.getFinancialOverview();
  }

  @Get('assets')
  @Permissions(AdminPermission.FINANCIAL_VIEW)
  async getAssetMetrics() {
    return this.financialAdminService.getAssetMetrics();
  }

  @Get('user/:id')
  @Permissions(AdminPermission.FINANCIAL_VIEW)
  async getUserFinancialProfile(@Param('id') id: string) {
    return this.financialAdminService.getUserFinancialProfile(id);
  }

  @Get('ledger')
  @Permissions(AdminPermission.LEDGER_VIEW)
  async getLedgerExplorer(@Query() query: LedgerExplorerParams) {
    return this.financialAdminService.getLedgerExplorer(query);
  }

  @Post('adjustments')
  @Permissions(AdminPermission.BALANCE_ADJUST)
  async executeAdjustment(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body() dto: AdminAdjustmentDto,
  ) {
    return this.financialAdminService.executeAdminAdjustment(admin, dto);
  }

  @Post('holds/place')
  @Permissions(AdminPermission.BALANCE_ADJUST)
  async placeFinancialHold(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body() dto: { telegramUserId: string; assetCode?: string; amount: string; holdType: string; reason: string },
  ) {
    return this.financialAdminService.placeFinancialHold(admin, dto);
  }

  @Post('holds/:id/release')
  @Permissions(AdminPermission.BALANCE_ADJUST)
  async releaseFinancialHold(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.financialAdminService.releaseFinancialHold(admin, id, body?.reason);
  }

  @Get('deposits')
  @Permissions(AdminPermission.FINANCIAL_VIEW)
  async getDeposits(
    @Query('status') status?: SettlementStatus,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('page') page?: number,
  ) {
    return this.financialAdminService.getDeposits({ status, limit, offset, page });
  }

  @Post('deposits/:id/verify')
  @Permissions(AdminPermission.DEPOSIT_VERIFY)
  async verifyDeposit(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.financialAdminService.verifyDeposit(admin, id, body?.reason);
  }

  @Get('withdrawals')
  @Permissions(AdminPermission.FINANCIAL_VIEW)
  async getWithdrawals(
    @Query('status') status?: SettlementStatus,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('page') page?: number,
  ) {
    return this.financialAdminService.getWithdrawals({ status, limit, offset, page });
  }

  @Get('withdrawals/:id/validate')
  @Permissions(AdminPermission.WITHDRAWAL_APPROVE)
  async validateWithdrawalSafety(@Param('id') id: string) {
    return this.financialAdminService.validateWithdrawalSafety(id);
  }

  @Post('withdrawals/:id/approve')
  @Permissions(AdminPermission.WITHDRAWAL_APPROVE)
  async approveWithdrawal(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
  ) {
    return this.financialAdminService.approveWithdrawal(admin, id);
  }

  @Post('withdrawals/:id/reject')
  @Permissions(AdminPermission.WITHDRAWAL_REJECT)
  async rejectWithdrawal(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.financialAdminService.rejectWithdrawal(admin, id, body?.reason);
  }

  @Get('settlement-center')
  @Permissions(AdminPermission.SETTLEMENT_VIEW)
  async getSettlementCenterMetrics() {
    return this.financialAdminService.getSettlementCenterMetrics();
  }

  @Post('settlement/:id/retry')
  @Permissions(AdminPermission.SETTLEMENT_RETRY)
  async retrySettlement(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
  ) {
    return this.financialAdminService.retrySettlement(admin, id);
  }

  @Get('treasury')
  @Permissions(AdminPermission.TREASURY_VIEW)
  async getTreasuryOverview() {
    return this.financialAdminService.getTreasuryOverview();
  }
}
