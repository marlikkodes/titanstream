import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SettlementStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { CurrentAdmin, AuthenticatedAdmin } from '../decorators/current-admin.decorator';
import { Permissions } from '../decorators/permissions.decorator';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { RbacGuard } from '../guards/rbac.guard';
import { AdminPermission } from '../interfaces/admin-permissions.enum';
import { PayoutProofDto, WithdrawalService } from '../../financial/withdrawal.service';
import { DualAuthorizationService } from '../services/dual-authorization.service';

@Controller('admin/withdrawals')
@UseGuards(AdminAuthGuard, RbacGuard)
export class AdminWithdrawalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly withdrawalService: WithdrawalService,
    private readonly dualAuthorizationService: DualAuthorizationService,
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
        include: { user: { select: { telegramUsername: true, firstName: true, lastName: true, phoneNumber: true, withdrawalPhoneNumber: true, preferredTransactionMethod: true, verifiedUsdtAddress: true } } },
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
  @Permissions(AdminPermission.WITHDRAWAL_APPROVE)
  async claimWithdrawal(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id') id: string) {
    return this.withdrawalService.claimWithdrawalForExecution(admin.id, id);
  }

  @Post(':id/mark-executed')
  @Permissions(AdminPermission.WITHDRAWAL_APPROVE)
  async markPayoutExecuted(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id') id: string) {
    return this.withdrawalService.markPayoutExecuted(admin.id, id);
  }

  @Post(':id/submit-proof')
  @Permissions(AdminPermission.WITHDRAWAL_APPROVE)
  async submitPayoutProof(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body() body: PayoutProofDto,
  ) {
    return this.withdrawalService.submitPayoutProof(admin.id, id, body);
  }

  @Post(':id/verify-and-settle')
  @Permissions(AdminPermission.WITHDRAWAL_APPROVE)
  async verifyAndSettle(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Headers('x-confirmation-token') confirmationToken: string,
  ) {
    await this.requireSettlementConfirmation(confirmationToken, admin.id, id);
    return this.withdrawalService.verifyAndSettleWithdrawal(admin.id, id);
  }

  @Post(':id/approve')
  @Permissions(AdminPermission.WITHDRAWAL_APPROVE)
  async approveWithdrawal(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Headers('x-confirmation-token') confirmationToken: string,
  ) {
    await this.requireSettlementConfirmation(confirmationToken, admin.id, id);
    return this.withdrawalService.verifyAndSettleWithdrawal(admin.id, id);
  }

  @Post(':id/reject')
  @Permissions(AdminPermission.WITHDRAWAL_REJECT)
  async rejectWithdrawal(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.withdrawalService.rejectWithdrawal(admin, id, body.reason);
  }

  @Post(':id/retry')
  @Permissions(AdminPermission.SETTLEMENT_RETRY)
  async retryPayout(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id') id: string) {
    return this.withdrawalService.claimWithdrawalForExecution(admin.id, id);
  }

  private async requireSettlementConfirmation(token: string, adminUserId: string, withdrawalId: string) {
    if (!token) {
      throw new BadRequestException('CONFIRMATION_TOKEN_REQUIRED');
    }
    await this.dualAuthorizationService.verifyAndConsumeToken(token, adminUserId, {
      actionType: 'WITHDRAWAL_APPROVAL',
      actionPayload: { withdrawalId },
    });
  }
}
