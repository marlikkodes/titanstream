import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SettlementStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { CurrentAdmin, AuthenticatedAdmin } from '../decorators/current-admin.decorator';
import { Permissions } from '../decorators/permissions.decorator';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { RbacGuard } from '../guards/rbac.guard';
import { AdminPermission } from '../interfaces/admin-permissions.enum';
import { PayoutProofDto, WithdrawalService } from '../../financial/withdrawal.service';

@Controller('admin/withdrawals')
@UseGuards(AdminAuthGuard, RbacGuard)
export class AdminWithdrawalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly withdrawalService: WithdrawalService,
  ) {}

  @Get()
  @Permissions(AdminPermission.SETTLEMENT_VIEW)
  async listWithdrawals(
    @Query('status') status?: SettlementStatus,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const lim = limit ? Number(limit) : 50;
    const off = offset ? Number(offset) : 0;

    const where: any = { sessionType: 'PAYOUT' };
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      this.prisma.settlementSession.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: lim,
        skip: off,
        include: { user: { select: { telegramUsername: true, firstName: true, phoneNumber: true, verifiedUsdtAddress: true } } },
      }),
      this.prisma.settlementSession.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        telegramUserId: item.telegramUserId.toString(),
        requestedAmount: item.requestedAmount.toString(),
        expectedCryptoAmount: item.expectedCryptoAmount.toString(),
        feeAmount: item.feeAmount.toString(),
        netPayoutAmount: item.netPayoutAmount.toString(),
      })),
      pagination: { total, limit: lim, offset: off },
    };
  }

  @Get(':id/payout-instructions')
  @Permissions(AdminPermission.SETTLEMENT_VIEW)
  async getPayoutInstructions(@Param('id') id: string) {
    return this.withdrawalService.getAuthoritativePayoutInstructions(id);
  }

  @Post(':id/claim')
  @Permissions(AdminPermission.SETTLEMENT_OVERRIDE)
  async claimWithdrawal(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id') id: string) {
    return this.withdrawalService.claimWithdrawalForExecution(admin.id, id);
  }

  @Post(':id/mark-executed')
  @Permissions(AdminPermission.SETTLEMENT_OVERRIDE)
  async markPayoutExecuted(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id') id: string) {
    return this.withdrawalService.markPayoutExecuted(admin.id, id);
  }

  @Post(':id/submit-proof')
  @Permissions(AdminPermission.SETTLEMENT_OVERRIDE)
  async submitPayoutProof(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body() body: PayoutProofDto,
  ) {
    return this.withdrawalService.submitPayoutProof(admin.id, id, body);
  }

  @Post(':id/verify-and-settle')
  @Permissions(AdminPermission.SETTLEMENT_OVERRIDE)
  async verifyAndSettle(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id') id: string) {
    return this.withdrawalService.verifyAndSettleWithdrawal(admin.id, id);
  }

  @Post(':id/approve')
  @Permissions(AdminPermission.SETTLEMENT_OVERRIDE)
  async approveWithdrawal(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id') id: string) {
    return this.withdrawalService.verifyAndSettleWithdrawal(admin.id, id);
  }

  @Post(':id/reject')
  @Permissions(AdminPermission.SETTLEMENT_OVERRIDE)
  async rejectWithdrawal(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.withdrawalService.rejectWithdrawal(admin, id, body.reason);
  }

  @Post(':id/retry')
  @Permissions(AdminPermission.SETTLEMENT_OVERRIDE)
  async retryPayout(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id') id: string) {
    return this.withdrawalService.claimWithdrawalForExecution(admin.id, id);
  }
}
