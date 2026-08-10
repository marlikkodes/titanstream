import { Injectable, NotFoundException, BadRequestException, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { OperationalAuditService } from './operational-audit.service';
import { EconomyEngineService } from '../../machine/services/economy-engine.service';
import { AssetLicenseStatus, AssetLicenseType, MachineOutputStatus, MachineStatus, Prisma } from '@prisma/client';

export interface CreateMachineDto {
  tierCode: string;
  name: string;
  description: string;
  category?: string;
  priceUsdt: number;
  capacityGhs: number;
  dailyYieldEstimateUsdt: number;
  displayOrder?: number;
  icon?: string;
  artwork?: string;
}

export interface GrantLicenseDto {
  telegramUserId: string;
  asset: string;
  licenseType?: AssetLicenseType;
  durationDays?: number;
  reason: string;
}

@Injectable()
export class MachineAdminService {
  private readonly logger = new Logger(MachineAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => EconomyEngineService)) private readonly economyEngine: EconomyEngineService,
    private readonly auditService: OperationalAuditService,
  ) {}

  private parseBigInt(idString: string): bigint {
    const clean = idString.trim();
    if (!/^\d+$/.test(clean)) {
      throw new BadRequestException(`INVALID_USER_ID: '${idString}' must be numeric`);
    }
    return BigInt(clean);
  }

  /**
   * 1. Machine Catalog CRUD
   */
  async listMachines() {
    return this.prisma.machineCatalogItem.findMany({
      include: { outputs: true, _count: { select: { userFleet: true } } },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async createMachine(admin: { id: string; role: string }, dto: CreateMachineDto) {
    if (!dto.tierCode || !dto.name || dto.priceUsdt === undefined) {
      throw new BadRequestException('tierCode, name, and priceUsdt are mandatory');
    }

    const machine = await this.prisma.machineCatalogItem.create({
      data: {
        tierCode: dto.tierCode.trim().toUpperCase(),
        name: dto.name.trim(),
        description: dto.description || '',
        category: dto.category || 'STANDARD',
        priceUsdt: new Prisma.Decimal(dto.priceUsdt),
        capacityGhs: new Prisma.Decimal(dto.capacityGhs || 1.0),
        dailyYieldEstimateUsdt: new Prisma.Decimal(dto.dailyYieldEstimateUsdt || 0.5),
        displayOrder: dto.displayOrder || 0,
        icon: dto.icon || '⚡',
        artwork: dto.artwork || '',
        status: MachineStatus.ACTIVE,
      },
    });

    // Automatically create default USDT output stream
    await this.prisma.machineOutputStream.create({
      data: {
        machineId: machine.id,
        assetCode: 'USDT',
        baseYieldRate: new Prisma.Decimal(dto.dailyYieldEstimateUsdt / 86400 || 0.000005),
        status: MachineOutputStatus.ENABLED,
      },
    });

    await this.auditService.logAction({
      actorId: admin.id,
      actorRole: admin.role,
      action: 'MACHINE_CREATED',
      entity: 'MACHINE_CATALOG',
      entityId: machine.id,
      metadata: { tierCode: machine.tierCode, name: machine.name, priceUsdt: dto.priceUsdt },
    });

    return machine;
  }

  async updateMachine(admin: { id: string; role: string }, id: string, dto: Partial<CreateMachineDto> & { status?: MachineStatus }) {
    const existing = await this.prisma.machineCatalogItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('MACHINE_NOT_FOUND');

    const updated = await this.prisma.machineCatalogItem.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.description ? { description: dto.description } : {}),
        ...(dto.priceUsdt !== undefined ? { priceUsdt: new Prisma.Decimal(dto.priceUsdt) } : {}),
        ...(dto.capacityGhs !== undefined ? { capacityGhs: new Prisma.Decimal(dto.capacityGhs) } : {}),
        ...(dto.dailyYieldEstimateUsdt !== undefined ? { dailyYieldEstimateUsdt: new Prisma.Decimal(dto.dailyYieldEstimateUsdt) } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
    });

    await this.auditService.logAction({
      actorId: admin.id,
      actorRole: admin.role,
      action: 'MACHINE_UPDATED',
      entity: 'MACHINE_CATALOG',
      entityId: id,
      metadata: { previousName: existing.name, newName: updated.name, status: updated.status },
    });

    return updated;
  }

  async addOutputStream(admin: { id: string; role: string }, dto: { machineId: string; assetCode: string; baseYieldRate: number; minimumLicense?: string }) {
    const machine = await this.prisma.machineCatalogItem.findUnique({ where: { id: dto.machineId } });
    if (!machine) throw new NotFoundException('MACHINE_NOT_FOUND');

    const output = await this.prisma.machineOutputStream.upsert({
      where: { machineId_assetCode: { machineId: dto.machineId, assetCode: dto.assetCode.toUpperCase() } },
      create: {
        machineId: dto.machineId,
        assetCode: dto.assetCode.toUpperCase(),
        baseYieldRate: new Prisma.Decimal(dto.baseYieldRate),
        minimumLicense: dto.minimumLicense || dto.assetCode.toUpperCase(),
        status: MachineOutputStatus.ENABLED,
      },
      update: {
        baseYieldRate: new Prisma.Decimal(dto.baseYieldRate),
        status: MachineOutputStatus.ENABLED,
      },
    });

    await this.auditService.logAction({
      actorId: admin.id,
      actorRole: admin.role,
      action: 'OUTPUT_STREAM_ADDED',
      entity: 'MACHINE_OUTPUT',
      entityId: output.id,
      metadata: { machineId: dto.machineId, assetCode: dto.assetCode, baseYieldRate: dto.baseYieldRate },
    });

    return output;
  }

  /**
   * 2. Asset License Management
   */
  async listLicenses(params: { telegramUserId?: string; asset?: string; status?: AssetLicenseStatus }) {
    const where: Prisma.UserAssetLicenseWhereInput = {};
    if (params.telegramUserId) where.telegramUserId = this.parseBigInt(params.telegramUserId);
    if (params.asset) where.asset = params.asset.toUpperCase();
    if (params.status) where.status = params.status;

    const licenses = await this.prisma.userAssetLicense.findMany({
      where,
      include: { user: { select: { telegramUsername: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return licenses.map((l) => ({
      id: l.id,
      telegramUserId: l.telegramUserId.toString(),
      userName: [l.user.firstName, l.user.lastName].filter(Boolean).join(' ') || `User ${l.telegramUserId}`,
      asset: l.asset,
      status: l.status,
      licenseType: l.licenseType,
      activatedAt: l.activatedAt,
      expiresAt: l.expiresAt,
      grantedBy: l.grantedBy,
    }));
  }

  async grantLicense(admin: { id: string; role: string }, dto: GrantLicenseDto) {
    if (!dto.reason || !dto.reason.trim()) {
      throw new BadRequestException('ACTION_REASON_REQUIRED: Mandatory reason string required to grant asset license');
    }
    const telegramUserId = this.parseBigInt(dto.telegramUserId);
    const asset = (dto.asset || 'TON').toUpperCase();
    const expiresAt = dto.durationDays ? new Date(Date.now() + dto.durationDays * 86400 * 1000) : null;

    const license = await this.prisma.userAssetLicense.upsert({
      where: { telegramUserId_asset: { telegramUserId, asset } },
      create: {
        telegramUserId,
        asset,
        status: AssetLicenseStatus.ACTIVE,
        licenseType: dto.licenseType || AssetLicenseType.ADMIN_GRANTED,
        expiresAt,
        grantedBy: admin.id,
        metadata: { reason: dto.reason.trim() },
      },
      update: {
        status: AssetLicenseStatus.ACTIVE,
        expiresAt,
        grantedBy: admin.id,
        metadata: { reason: dto.reason.trim() },
      },
    });

    await this.auditService.logAction({
      actorId: admin.id,
      actorRole: admin.role,
      action: 'ASSET_LICENSE_GRANTED',
      entity: 'USER_ASSET_LICENSE',
      entityId: license.id,
      metadata: { telegramUserId: telegramUserId.toString(), asset, reason: dto.reason },
    });

    return license;
  }

  async revokeLicense(admin: { id: string; role: string }, licenseId: string, reason: string) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('ACTION_REASON_REQUIRED: Mandatory reason required to revoke license');
    }

    const license = await this.prisma.userAssetLicense.update({
      where: { id: licenseId },
      data: { status: AssetLicenseStatus.REVOKED },
    });

    await this.auditService.logAction({
      actorId: admin.id,
      actorRole: admin.role,
      action: 'ASSET_LICENSE_REVOKED',
      entity: 'USER_ASSET_LICENSE',
      entityId: licenseId,
      metadata: { telegramUserId: license.telegramUserId.toString(), asset: license.asset, reason },
    });

    return license;
  }

  /**
   * 3. User Fleet Inspector & Timeline
   */
  async getUserFleet(rawId: string) {
    const telegramUserId = this.parseBigInt(rawId);
    const fleet = await this.prisma.userMachineFleetItem.findMany({
      where: { telegramUserId },
      include: { machine: true, timelineEvents: { orderBy: { createdAt: 'desc' } } },
    });

    return fleet.map((item) => ({
      id: item.id,
      tierCode: item.tierCode,
      name: item.name,
      purchasePrice: item.purchasePrice.toString(),
      status: item.status,
      capacityGhs: item.capacityGhs.toString(),
      lifetimeEarnings: item.lifetimeEarnings.toString(),
      purchasedAt: item.purchasedAt,
      timeline: item.timelineEvents,
    }));
  }

  /**
   * 4. Maintenance & Promotions Controls
   */
  async getMaintenanceWindows() {
    return this.prisma.maintenanceWindowRecord.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async setMaintenanceMode(admin: { id: string; role: string }, dto: { scope: string; targetId?: string; mode: string; message?: string; durationHours?: number }) {
    const startsAt = new Date();
    const endsAt = new Date(Date.now() + (dto.durationHours || 24) * 3600 * 1000);

    const window = await this.prisma.maintenanceWindowRecord.create({
      data: {
        scope: dto.scope.toUpperCase(),
        targetId: dto.targetId || null,
        mode: dto.mode || 'NO_CLAIMS',
        customMessage: dto.message || 'Scheduled System Maintenance',
        startsAt,
        endsAt,
        isActive: true,
      },
    });

    await this.auditService.logAction({
      actorId: admin.id,
      actorRole: admin.role,
      action: 'MAINTENANCE_MODE_ACTIVATED',
      entity: 'MAINTENANCE_WINDOW',
      entityId: window.id,
      metadata: { scope: dto.scope, mode: dto.mode },
    });

    return window;
  }

  async listPromotions() {
    return this.prisma.promotionCampaignRecord.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPromotion(admin: { id: string; role: string }, dto: { campaignCode: string; title: string; description: string; discountPct?: number; yieldBoostMult?: number; durationDays?: number }) {
    const startsAt = new Date();
    const endsAt = new Date(Date.now() + (dto.durationDays || 7) * 86400 * 1000);

    const promo = await this.prisma.promotionCampaignRecord.create({
      data: {
        campaignCode: dto.campaignCode.trim().toUpperCase(),
        title: dto.title.trim(),
        description: dto.description || '',
        discountPct: dto.discountPct || 0,
        yieldBoostMult: new Prisma.Decimal(dto.yieldBoostMult || 1.0),
        startsAt,
        endsAt,
        status: 'ACTIVE',
      },
    });

    await this.auditService.logAction({
      actorId: admin.id,
      actorRole: admin.role,
      action: 'PROMOTION_CAMPAIGN_CREATED',
      entity: 'PROMOTION_CAMPAIGN',
      entityId: promo.id,
      metadata: { campaignCode: promo.campaignCode, title: promo.title },
    });

    return promo;
  }
}
