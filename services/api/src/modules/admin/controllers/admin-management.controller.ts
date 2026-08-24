import { Controller, Get, Post, Body, Param, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { RbacGuard } from '../guards/rbac.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { AdminPermission } from '../interfaces/admin-permissions.enum';
import { CurrentAdmin, AuthenticatedAdmin } from '../decorators/current-admin.decorator';
import { AdminRole } from '@prisma/client';
import { AdminManagementService } from '../services/admin-management.service';

@ApiTags('Admin Management & RBAC')
@Controller('admin/management')
@UseGuards(AdminAuthGuard, RbacGuard)
export class AdminManagementController {
  constructor(private readonly service: AdminManagementService) {}

  @Get('admins')
  @Permissions(AdminPermission.USER_VIEW)
  @ApiOperation({ summary: 'List all authenticated admin users' })
  getAdmins() {
    return {
      success: true,
      data: this.service.getAdminAccounts(),
    };
  }

  @Post('invite')
  @Permissions(AdminPermission.ADMIN_MANAGE)
  @ApiOperation({ summary: 'Invite a new Admin user by telegram_user_id' })
  inviteAdmin(
    @Body('telegramUserId') telegramUserId: string,
    @Body('name') name: string,
    @Body('role') role: AdminRole,
  ) {
    const admin = this.service.inviteAdmin({ telegramUserId, name, role });
    return {
      success: true,
      data: admin,
    };
  }

  @Post(':id/role')
  @Permissions(AdminPermission.ADMIN_MANAGE)
  @ApiOperation({ summary: 'Update an admin user role and permissions' })
  updateAdminRole(
    @CurrentAdmin() currentAdmin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body('role') role: AdminRole,
  ) {
    if (currentAdmin.id === id) {
      throw new ForbiddenException('Cannot modify your own administrative role');
    }
    const admin = this.service.updateAdminRole(id, role);
    return {
      success: true,
      data: admin,
    };
  }

  @Post(':id/status')
  @Permissions(AdminPermission.ADMIN_MANAGE)
  @ApiOperation({ summary: 'Suspend or activate an admin user' })
  toggleAdminStatus(
    @CurrentAdmin() currentAdmin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body('status') status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED',
  ) {
    if (currentAdmin.id === id) {
      throw new ForbiddenException('Cannot modify your own administrative status');
    }
    const admin = this.service.toggleAdminStatus(id, status);
    return {
      success: true,
      data: admin,
    };
  }
}
