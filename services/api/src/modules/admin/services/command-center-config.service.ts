import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

export interface MobileMoneyConfig {
  id: string;
  provider: string; // MTN, AIRTEL, MPESA
  country: string; // UG, KE, TZ
  currency: string; // UGX, KES, TZS
  phoneNumber: string;
  displayName: string;
  ussdTemplate: string; // *165*1*1*{phone}*{amount}#
  priority: number;
  dailyCapacityUsdt: number;
  status: 'ACTIVE' | 'PAUSED' | 'DISABLED' | 'ARCHIVED';
  notes?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CryptoWalletConfig {
  id: string;
  asset: string; // USDT, TON, BTC
  network: string; // TON, TRC20, ERC20
  address: string;
  label: string;
  qrCodeUrl?: string;
  status: 'ACTIVE' | 'MAINTENANCE' | 'DISABLED';
  priority: number;
  dailyCapacityUsdt: number;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommandCenterSettings {
  machineCatalog: Array<{
    tierCode: string;
    name: string;
    priceUsdt: number;
    capacityGhs: number;
    powerRatingW: number;
    dailyYieldEstimateUsdt: number;
    isActive: boolean;
  }>;
  treasuryPolicies: {
    minDepositUsdt: number;
    maxDepositUsdt: number;
    minWithdrawalUsdt: number;
    maxWithdrawalUsdt: number;
    targetReserveRatioPercent: number;
    manualReviewThresholdUsdt: number;
  };
  featureFlags: {
    enableUssdAutoDial: boolean;
    enableUsdtTrc20Deposit: boolean;
    enableCryptoBotDeposit: boolean;
    enableInstantWithdrawal: boolean;
    enableMiningClaims: boolean;
    enableReferralRewards: boolean;
  };
  referralRules: {
    tier1BonusPercent: number;
    tier2BonusPercent: number;
    signupRewardCrystals: number;
  };
  countrySettings: Record<string, { enabled: boolean; exchangeRateUsdt: number; defaultCurrency: string }>;
}

@Injectable()
export class CommandCenterConfigService {
  private readonly logger = new Logger(CommandCenterConfigService.name);

  private readonly mobileMoneyRegistry = new Map<string, MobileMoneyConfig>();
  private readonly cryptoWalletRegistry = new Map<string, CryptoWalletConfig>();
  private settings: CommandCenterSettings;

  constructor(private readonly prisma: PrismaService) {
    this.seedDefaultRegistries();
  }

  private seedDefaultRegistries() {
    // 1. Mobile Money Registry
    const mm1: MobileMoneyConfig = {
      id: 'mm_mtn_ug_escrow',
      provider: 'MTN',
      country: 'UG',
      currency: 'UGX',
      phoneNumber: '234654',
      displayName: 'TitanStream UG Escrow Pool 1',
      ussdTemplate: '*165*1*1*{phone}*{amount}#',
      priority: 1,
      dailyCapacityUsdt: 10000,
      status: 'ACTIVE',
      notes: 'Primary MTN Uganda receiving mobile money number',
      createdBy: 'SYSTEM_SUPER_ADMIN',
      updatedBy: 'SYSTEM_SUPER_ADMIN',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mm2: MobileMoneyConfig = {
      id: 'mm_airtel_ug_escrow',
      provider: 'AIRTEL',
      country: 'UG',
      currency: 'UGX',
      phoneNumber: '7183443',
      displayName: 'TitanStream UG Escrow Pool 2',
      ussdTemplate: '*185*9*{phone}*{amount}#',
      priority: 2,
      dailyCapacityUsdt: 10000,
      status: 'ACTIVE',
      notes: 'Primary Airtel Uganda receiving mobile money number',
      createdBy: 'SYSTEM_SUPER_ADMIN',
      updatedBy: 'SYSTEM_SUPER_ADMIN',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.mobileMoneyRegistry.set(mm1.id, mm1);
    this.mobileMoneyRegistry.set(mm2.id, mm2);

    // 2. Crypto Wallet Registry
    const cw1: CryptoWalletConfig = {
      id: 'cw_usdt_ton_pool',
      asset: 'USDT',
      network: 'TON',
      address: 'EQD_titanstream_escrow_master_wallet_ton_001',
      label: 'TitanStream Master USDT (TON) Escrow Pool',
      status: 'ACTIVE',
      priority: 1,
      dailyCapacityUsdt: 50000,
      notes: 'Main receiving wallet for TON Jetton USDT',
      createdBy: 'SYSTEM_SUPER_ADMIN',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.cryptoWalletRegistry.set(cw1.id, cw1);

    // 3. System Settings
    this.settings = {
      machineCatalog: [
        { tierCode: 'T1_MINI', name: 'Starter Node (T1)', priceUsdt: 10.0, capacityGhs: 5.0, powerRatingW: 50, dailyYieldEstimateUsdt: 0.25, isActive: true },
        { tierCode: 'T2_PRO', name: 'Pro Compute Node (T2)', priceUsdt: 50.0, capacityGhs: 25.0, powerRatingW: 250, dailyYieldEstimateUsdt: 1.40, isActive: true },
        { tierCode: 'T3_ENTERPRISE', name: 'Enterprise Cluster (T3)', priceUsdt: 200.0, capacityGhs: 120.0, powerRatingW: 1000, dailyYieldEstimateUsdt: 6.20, isActive: true },
        { tierCode: 'T4_QUANTUM', name: 'Quantum Cluster (T4)', priceUsdt: 1000.0, capacityGhs: 650.0, powerRatingW: 5000, dailyYieldEstimateUsdt: 34.0, isActive: true },
      ],
      treasuryPolicies: {
        minDepositUsdt: 1.0,
        maxDepositUsdt: 5000.0,
        minWithdrawalUsdt: 5.0,
        maxWithdrawalUsdt: 2500.0,
        targetReserveRatioPercent: 148,
        manualReviewThresholdUsdt: 500.0,
      },
      featureFlags: {
        enableUssdAutoDial: true,
        enableUsdtTrc20Deposit: true,
        enableCryptoBotDeposit: false,
        enableInstantWithdrawal: true,
        enableMiningClaims: true,
        enableReferralRewards: true,
      },
      referralRules: {
        tier1BonusPercent: 5.0,
        tier2BonusPercent: 2.0,
        signupRewardCrystals: 5,
      },
      countrySettings: {
        UG: { enabled: true, exchangeRateUsdt: 3700, defaultCurrency: 'UGX' },
        KE: { enabled: true, exchangeRateUsdt: 130.5, defaultCurrency: 'KES' },
        TZ: { enabled: true, exchangeRateUsdt: 2600, defaultCurrency: 'TZS' },
      },
    };
  }

  // ─── MOBILE MONEY REGISTRY ──────────────────────────────────────────────────

  async getMobileMoneyRegistry(): Promise<MobileMoneyConfig[]> {
    const merchants = await this.prisma.mobileMoneyMerchant.findMany({
      orderBy: { priority: 'asc' },
    });

    if (merchants.length === 0) {
      // Seed default active MTN merchant record if database is empty
      const seeded = await this.prisma.mobileMoneyMerchant.create({
        data: {
          network: 'MTN',
          merchantName: 'TitanStream UG Escrow Pool 1',
          merchantNumber: '234654',
          country: 'UG',
          currency: 'UGX',
          status: 'ACTIVE',
          priority: 1,
        },
      });
      merchants.push(seeded);
    }

    return merchants.map((m) => ({
      id: m.id,
      provider: m.network,
      country: m.country,
      currency: m.currency,
      phoneNumber: m.merchantNumber,
      displayName: m.merchantName,
      ussdTemplate: m.network === 'MTN' ? '*165*1*1*{phone}*{amount}#' : '*185*9*{phone}*{amount}#',
      priority: m.priority,
      dailyCapacityUsdt: Number(m.dailyLimit) / 3700,
      status: m.status as any,
      createdBy: 'SYSTEM_SUPER_ADMIN',
      updatedBy: 'SYSTEM_SUPER_ADMIN',
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    }));
  }

  async upsertMobileMoneyConfig(dto: Partial<MobileMoneyConfig>, adminId: string): Promise<MobileMoneyConfig> {
    const network = dto.provider || 'MTN';
    const merchantName = dto.displayName || 'TitanStream Escrow Pool';
    const merchantNumber = dto.phoneNumber || '0770000000';
    const country = dto.country || 'UG';
    const currency = dto.currency || 'UGX';
    const status = dto.status || 'ACTIVE';
    const priority = dto.priority ?? 1;

    let merchant;
    if (dto.id) {
      merchant = await this.prisma.mobileMoneyMerchant.upsert({
        where: { id: dto.id },
        update: {
          network,
          merchantName,
          merchantNumber,
          country,
          currency,
          status,
          priority,
        },
        create: {
          id: dto.id,
          network,
          merchantName,
          merchantNumber,
          country,
          currency,
          status,
          priority,
        },
      });
    } else {
      merchant = await this.prisma.mobileMoneyMerchant.create({
        data: {
          network,
          merchantName,
          merchantNumber,
          country,
          currency,
          status,
          priority,
        },
      });
    }

    this.logger.log(`[CommandCenterConfig] Mobile money merchant ${merchant.id} updated in DB by admin ${adminId}`);

    return {
      id: merchant.id,
      provider: merchant.network,
      country: merchant.country,
      currency: merchant.currency,
      phoneNumber: merchant.merchantNumber,
      displayName: merchant.merchantName,
      ussdTemplate: merchant.network === 'MTN' ? '*165*1*1*{phone}*{amount}#' : '*185*9*{phone}*{amount}#',
      priority: merchant.priority,
      dailyCapacityUsdt: Number(merchant.dailyLimit) / 3700,
      status: merchant.status as any,
      createdBy: adminId,
      updatedBy: adminId,
      createdAt: merchant.createdAt.toISOString(),
      updatedAt: merchant.updatedAt.toISOString(),
    };
  }

  // ─── CRYPTO WALLET REGISTRY ────────────────────────────────────────────────

  async getCryptoWalletRegistry(): Promise<CryptoWalletConfig[]> {
    const config = await this.prisma.usdtConfig.findUnique({ where: { id: 'default' } });
    const receivingAddr = config?.receivingAddress || process.env.USDT_RECEIVING_ADDRESS?.trim();
    if (!receivingAddr) throw new BadRequestException('USDT_RECEIVING_ADDRESS_NOT_CONFIGURED');

    return [
      {
        id: config?.id || 'default',
        asset: 'USDT',
        network: config?.network || 'TRON',
        address: receivingAddr,
        label: 'TitanStream Primary USDT Receiving Escrow Wallet',
        status: config?.enabled ? 'ACTIVE' : 'DISABLED',
        priority: 1,
        dailyCapacityUsdt: 500000,
        createdBy: config?.configuredByAdminId || 'SYSTEM_SUPER_ADMIN',
        createdAt: config?.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: config?.updatedAt?.toISOString() || new Date().toISOString(),
      },
    ];
  }

  async upsertCryptoWalletConfig(dto: Partial<CryptoWalletConfig>, adminId: string): Promise<CryptoWalletConfig> {
    const receivingAddress = dto.address?.trim();
    if (!receivingAddress) {
      throw new BadRequestException('CRYPTO_ADDRESS_REQUIRED: Valid receiving address string required');
    }

    const updated = await this.prisma.usdtConfig.upsert({
      where: { id: 'default' },
      update: {
        receivingAddress,
        network: dto.network || 'TRON',
        enabled: dto.status !== 'DISABLED',
        configuredByAdminId: adminId,
      },
      create: {
        id: 'default',
        receivingAddress,
        network: dto.network || 'TRON',
        enabled: dto.status !== 'DISABLED',
        configuredByAdminId: adminId,
      },
    });

    return {
      id: updated.id,
      asset: dto.asset || 'USDT',
      network: updated.network,
      address: updated.receivingAddress,
      label: dto.label || 'TitanStream Crypto Escrow',
      status: updated.enabled ? 'ACTIVE' : 'DISABLED',
      priority: dto.priority ?? 1,
      dailyCapacityUsdt: dto.dailyCapacityUsdt ?? 500000,
      createdBy: adminId,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  // ─── USSD TEMPLATE ENGINE & PREVIEW ──────────────────────────────────────────

  testUssdTemplate(template: string, phone: string, amount: number) {
    if (!template.includes('{phone}') || !template.includes('{amount}')) {
      throw new BadRequestException('USSD template must contain both {phone} and {amount} placeholders.');
    }

    const generatedUssd = template
      .replace('{phone}', phone)
      .replace('{amount}', Math.round(amount).toString());

    const telUri = `tel:${generatedUssd.replace('#', '%23')}`;

    return {
      template,
      phone,
      amount,
      generatedUssd,
      telUri,
      isValid: true,
    };
  }

  // ─── SYSTEM SETTINGS ────────────────────────────────────────────────────────

  getSettings(): CommandCenterSettings {
    return this.settings;
  }

  updateSettings(patch: Partial<CommandCenterSettings>): CommandCenterSettings {
    this.settings = {
      ...this.settings,
      ...patch,
      treasuryPolicies: { ...this.settings.treasuryPolicies, ...patch.treasuryPolicies },
      featureFlags: { ...this.settings.featureFlags, ...patch.featureFlags },
      referralRules: { ...this.settings.referralRules, ...patch.referralRules },
    };
    return this.settings;
  }
}
