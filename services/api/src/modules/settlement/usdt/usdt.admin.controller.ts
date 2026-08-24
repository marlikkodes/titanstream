import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../../admin/guards/admin-auth.guard';
import { RbacGuard } from '../../admin/guards/rbac.guard';
import { Permissions } from '../../admin/decorators/permissions.decorator';
import { AdminPermission } from '../../admin/interfaces/admin-permissions.enum';
import { CurrentAdmin, AuthenticatedAdmin } from '../../admin/decorators/current-admin.decorator';
import { UsdtAdminService } from './usdt.admin.service';

@Controller(['admin/settlement/usdt', 'api/v1/admin/settlement/usdt'])
@UseGuards(AdminAuthGuard, RbacGuard)
export class UsdtAdminController {
  constructor(private readonly adminService: UsdtAdminService) {}

  @Get('health')
  @Permissions(AdminPermission.TREASURY_VIEW)
  getHealth() {
    return this.adminService.getConfig();
  }

  @Get('config')
  @Permissions(AdminPermission.TREASURY_VIEW)
  getConfig() {
    return this.adminService.getConfig();
  }

  @Post('config')
  @Permissions(AdminPermission.TREASURY_MANAGE)
  updateConfig(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body() dto: {
      enabled?: boolean;
      network?: string;
      tokenContract?: string;
      receivingAddress?: string;
      requiredConfirmations?: number;
      reason?: string;
    },
  ) {
    return this.adminService.updateConfig(admin.id, dto);
  }

  @Get('transactions')
  @Permissions(AdminPermission.TREASURY_VIEW)
  listTransactions(
    @Query('status') status?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.adminService.listTransactions({ status, limit: Number(limit) || 50, offset: Number(offset) || 0 });
  }

  @Post('transactions/:id/resolve')
  @Permissions(AdminPermission.TREASURY_MANAGE)
  resolveTransaction(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body() dto: { targetSettlementSessionId: string; reason: string },
  ) {
    return this.adminService.resolveAmbiguousTransaction(
      admin.id,
      id,
      dto.targetSettlementSessionId,
      dto.reason,
    );
  }
}
