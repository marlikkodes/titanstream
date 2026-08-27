import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AssetLicenseStatus } from '@prisma/client';
import { CurrentAdmin, AuthenticatedAdmin } from '../decorators/current-admin.decorator';
import { Permissions } from '../decorators/permissions.decorator';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { RbacGuard } from '../guards/rbac.guard';
import { AdminPermission } from '../interfaces/admin-permissions.enum';
import { CreateMachineDto, GrantLicenseDto, MachineAdminService } from '../services/machine-admin.service';
import { EconomyEngineService, EconomySimulationParams } from '../../machine/services/economy-engine.service';

@Controller('admin/machines-hq')
@UseGuards(AdminAuthGuard, RbacGuard)
export class AdminMachineController {
  constructor(
    private readonly machineAdminService: MachineAdminService,
    private readonly economyEngine: EconomyEngineService,
  ) {}

  @Get('catalog')
  @Permissions(AdminPermission.MACHINE_VIEW)
  async listMachines() {
    return this.machineAdminService.listMachines();
  }

  @Get('stats')
  @Permissions(AdminPermission.MACHINE_VIEW)
  async getOwnershipStats() {
    return this.machineAdminService.getOwnershipStats();
  }

  @Post('catalog')
  @Permissions(AdminPermission.MACHINE_CREATE)
  async createMachine(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body() dto: CreateMachineDto,
  ) {
    return this.machineAdminService.createMachine(admin, dto);
  }

  @Put('catalog/:id')
  @Permissions(AdminPermission.MACHINE_EDIT)
  async updateMachine(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body() dto: Partial<CreateMachineDto>,
  ) {
    return this.machineAdminService.updateMachine(admin, id, dto);
  }

  @Post('outputs')
  @Permissions(AdminPermission.OUTPUT_EDIT)
  async addOutputStream(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body() dto: { machineId: string; assetCode: string; baseYieldRate: number; minimumLicense?: string },
  ) {
    return this.machineAdminService.addOutputStream(admin, dto);
  }

  @Get('licenses')
  @Permissions(AdminPermission.LICENSE_VIEW)
  async listLicenses(
    @Query('userId') userId?: string,
    @Query('asset') asset?: string,
    @Query('status') status?: AssetLicenseStatus,
  ) {
    return this.machineAdminService.listLicenses({ telegramUserId: userId, asset, status });
  }

  @Post('licenses/grant')
  @Permissions(AdminPermission.LICENSE_GRANT)
  async grantLicense(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body() dto: GrantLicenseDto,
  ) {
    return this.machineAdminService.grantLicense(admin, dto);
  }

  @Post('licenses/:id/revoke')
  @Permissions(AdminPermission.LICENSE_REVOKE)
  async revokeLicense(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.machineAdminService.revokeLicense(admin, id, body?.reason);
  }

  @Get('user-fleet/:userId')
  @Permissions(AdminPermission.MACHINE_VIEW)
  async getUserFleet(@Param('userId') userId: string) {
    return this.machineAdminService.getUserFleet(userId);
  }

  @Get('economy/profiles')
  @Permissions(AdminPermission.ECONOMY_VIEW)
  async getEconomyProfiles() {
    return this.economyEngine.getProfiles();
  }

  @Post('economy/profiles')
  @Permissions(AdminPermission.ECONOMY_EDIT)
  async createEconomyProfile(
    @Body() dto: { code: string; name: string; yieldMultiplier: number; referralMultiplier?: number; rewardMultiplier?: number; decayRules?: any },
  ) {
    return this.economyEngine.createProfile(dto);
  }

  @Post('economy/profiles/:code/activate')
  @Permissions(AdminPermission.ECONOMY_EDIT)
  async activateEconomyProfile(@Param('code') code: string) {
    return this.economyEngine.activateProfile(code);
  }

  @Post('economy/simulate')
  @Permissions(AdminPermission.SIMULATION_RUN)
  async simulateEconomy(@Body() dto: EconomySimulationParams) {
    return this.economyEngine.simulateScenario(dto);
  }

  @Get('maintenance')
  @Permissions(AdminPermission.MAINTENANCE_CONTROL)
  async getMaintenanceWindows() {
    return this.machineAdminService.getMaintenanceWindows();
  }

  @Post('maintenance')
  @Permissions(AdminPermission.MAINTENANCE_CONTROL)
  async setMaintenanceMode(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body() dto: { scope: string; targetId?: string; mode: string; message?: string; durationHours?: number },
  ) {
    return this.machineAdminService.setMaintenanceMode(admin, dto);
  }

  @Get('promotions')
  @Permissions(AdminPermission.PROMOTION_CREATE)
  async listPromotions() {
    return this.machineAdminService.listPromotions();
  }

  @Post('promotions')
  @Permissions(AdminPermission.PROMOTION_CREATE)
  async createPromotion(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body() dto: { campaignCode: string; title: string; description: string; discountPct?: number; yieldBoostMult?: number; durationDays?: number },
  ) {
    return this.machineAdminService.createPromotion(admin, dto);
  }
}
