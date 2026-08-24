import { Body, Controller, Get, Param, Post, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { CurrentAdmin, AuthenticatedAdmin } from '../decorators/current-admin.decorator';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { RbacGuard } from '../guards/rbac.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { MerchantPortalService } from '../services/merchant-portal.service';
import { AdminPermission } from '../interfaces/admin-permissions.enum';
import { AdminRole } from '@prisma/client';

@Controller('merchant')
@UseGuards(AdminAuthGuard, RbacGuard)
export class MerchantPortalController {
  constructor(private readonly portalService: MerchantPortalService) {}

  private resolveMerchantId(admin: AuthenticatedAdmin, requestedMerchantId?: string): string {
    // Super admins can inspect any merchant; regular admins are scoped strictly to their own admin.id / merchant profile
    if (requestedMerchantId && requestedMerchantId !== admin.id) {
      if (admin.role !== AdminRole.SUPER_ADMIN) {
        throw new ForbiddenException('ACCESS_DENIED_MERCHANT_SCOPE_MISMATCH: Cannot access merchant outside assigned scope');
      }
      return requestedMerchantId;
    }
    return admin.id;
  }

  @Get('assigned-settlements')
  @Permissions(AdminPermission.SETTLEMENT_VIEW)
  async getAssignedSettlements(@CurrentAdmin() admin: AuthenticatedAdmin, @Query('merchantId') merchantIdQuery?: string) {
    const merchantId = this.resolveMerchantId(admin, merchantIdQuery);
    return this.portalService.getAssignedSettlements(merchantId);
  }

  @Post('settlements/:id/fulfill')
  @Permissions(AdminPermission.SETTLEMENT_OVERRIDE)
  async fulfillSettlement(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body() body: { proofReference?: string; merchantId?: string },
  ) {
    const merchantId = this.resolveMerchantId(admin, body?.merchantId);
    return this.portalService.fulfillSettlement(merchantId, id, body.proofReference);
  }

  @Get('history')
  @Permissions(AdminPermission.SETTLEMENT_VIEW)
  async getHistory(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Query('merchantId') merchantIdQuery?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const merchantId = this.resolveMerchantId(admin, merchantIdQuery);
    return this.portalService.getSettlementHistory(merchantId, limit, offset);
  }

  @Get('performance')
  @Permissions(AdminPermission.SETTLEMENT_VIEW)
  async getPerformance(@CurrentAdmin() admin: AuthenticatedAdmin, @Query('merchantId') merchantIdQuery?: string) {
    const merchantId = this.resolveMerchantId(admin, merchantIdQuery);
    return this.portalService.getMerchantPerformance(merchantId);
  }
}
