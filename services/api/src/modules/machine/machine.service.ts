import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef, Optional } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import { BalanceService } from '../financial/balance.service';
import { FinancialOrchestratorService } from '../financial-orchestration/financial-orchestrator.service';
import { PaymentOrderService } from '../payment-order/payment-order.service';
import { MiningService } from '../mining/mining.service';
import { PlatformOperationsEngineService } from '../admin/services/platform-operations-engine.service';
import { PremiumService } from '../premium/premium.service';
import { FinancialOperationType, Prisma } from '@prisma/client';
import { AuditEventType } from '../../common/interfaces/user-state.enum';
import type { NotificationPayload } from '../notification/notification.service';

export interface MachineTier {
  tierCode: string;
  name: string;
  priceUsdt: number;
  capacityGhs: number;
  powerRatingW: number;
  description: string;
  technicalSummary: string;
  simpleExplanation: string;
  dailyYieldEstimateUsdt: number;
  computeRating: string;
  performanceTier: string;
  capacityScore: number;
  recommendedFor: string;
  isPopular?: boolean;
  
  earningsCap?: number;
  durationHours?: number;
  expiryWarningDays?: number;
  reactivationWindowDays?: number;
  renewalWindowDays?: number;
  renewalPricingPercent?: number;
  renewalPeriodDays?: number;
  reactivationFeePercent?: number;
  passiveYieldRate?: number;
  promoYieldRate?: number;
  promoOutputCap?: number;
  spinnerSpeedMultiplier?: number;
  promoSpinnerSpeedMultiplier?: number;
  // Economic calibration knobs — tuned per machine, read by the mining engine
  maxMultiplier?: number;
  multiplierDecayPerSec?: number;
  interactiveBaseRate?: number;
  interactiveBonusCap?: number;
  promoMultiplierInfluence?: number;
}

export interface UserMachineAsset {
  id: string;
  telegramUserId: string;
  tierCode: string;
  name: string;
  purchasePrice: number;
  currency: string;
  status: 'CREATED' | 'PENDING_PAYMENT' | 'ACTIVE' | 'PAUSED' | 'MAINTENANCE' | 'RETIRED';
  capacityGhs: number;
  lifetimeEarnings: number;
  purchasedAt: string;
  activatedAt: string;
  expiresAt?: string;
}

@Injectable()
export class MachineService {
  private readonly catalog: MachineTier[] = [
    {
      tierCode: 'TS_TRIAL',
      name: 'Titan Core',
      priceUsdt: 0.0,
      capacityGhs: 1.0,
      powerRatingW: 10,
      description: 'Permanent baseline core with dual-phase promotional high-yield and standard modes.',
      technicalSummary: 'Permanently active entry-level hash rate generator.',
      simpleExplanation: 'Free baseline node that earns indefinitely.',
      dailyYieldEstimateUsdt: 2.0,
      computeRating: 'Core Queue Class 0',
      performanceTier: 'Baseline Tier',
      capacityScore: 10,
      recommendedFor: 'Starter core for everyone.',
      passiveYieldRate: 0.00000192935,
      promoYieldRate: 0.0000289,
      promoOutputCap: 5.0,
      spinnerSpeedMultiplier: 0.1,
      promoSpinnerSpeedMultiplier: 0.5,
      maxMultiplier: 10.1,
      multiplierDecayPerSec: 0.5,
      interactiveBaseRate: 0.0005,
      interactiveBonusCap: 0.10,
      promoMultiplierInfluence: 1.06,
    },
    {
      tierCode: 'TS_C10',
      name: 'Ripple X14',
      priceUsdt: 10.99,
      capacityGhs: 5.0,
      powerRatingW: 50,
      description: 'Entry-level compute node suitable for foundational cloud processing.',
      technicalSummary: 'Comparable to modern AI accelerator hardware used in large cloud computing environments.',
      simpleExplanation: 'Entry-level processing node designed for consistent daily earnings.',
      dailyYieldEstimateUsdt: 0.27,
      computeRating: 'Starter Queue Class 1',
      performanceTier: 'Starter Tier',
      capacityScore: 35,
      recommendedFor: 'Perfect for getting started.',
      durationHours: 168, // 7 days
      expiryWarningDays: 2,
      reactivationWindowDays: 7,
      renewalWindowDays: 5,
      renewalPricingPercent: 100,
      renewalPeriodDays: 7,
      reactivationFeePercent: 100,
      passiveYieldRate: 0.000000625,
      interactiveBaseRate: 0.0005,
    },
    {
      tierCode: 'TS_A50',
      name: 'Surge R28',
      priceUsdt: 50.0,
      capacityGhs: 25.0,
      powerRatingW: 250,
      description: 'Advanced processing node built for active cloud workload scaling.',
      technicalSummary: 'Comparable to modern AI accelerator hardware used in large cloud computing environments.',
      simpleExplanation: 'Expanded compute capacity delivering a noticeable daily earnings boost.',
      dailyYieldEstimateUsdt: 1.40,
      computeRating: 'Accelerated Queue Class 2',
      performanceTier: 'Growth Tier',
      capacityScore: 60,
      recommendedFor: 'Designed for growing daily earnings.',
      durationHours: 168, // 7 days
      expiryWarningDays: 2,
      reactivationWindowDays: 7,
      renewalWindowDays: 5,
      renewalPricingPercent: 100,
      renewalPeriodDays: 7,
      reactivationFeePercent: 100,
      passiveYieldRate: 0.000000648148,
      interactiveBaseRate: 0.0005,
    },
    {
      tierCode: 'TS_P250',
      name: 'Torrent V63',
      priceUsdt: 250.0,
      capacityGhs: 130.0,
      powerRatingW: 1200,
      description: 'High-performance multi-core cluster engineered for high daily data throughput.',
      technicalSummary: 'Comparable to modern AI accelerator hardware used in large cloud computing environments.',
      simpleExplanation: 'High-performance computing cluster built for active cloud accumulators.',
      dailyYieldEstimateUsdt: 7.50,
      computeRating: 'Enterprise Queue Class 3',
      performanceTier: 'High-Performance',
      capacityScore: 82,
      recommendedFor: 'Built for users scaling cloud capacity.',
      isPopular: true,
      durationHours: 168, // 7 days
      expiryWarningDays: 2,
      reactivationWindowDays: 7,
      renewalWindowDays: 5,
      renewalPricingPercent: 100,
      renewalPeriodDays: 7,
      reactivationFeePercent: 100,
      passiveYieldRate: 0.000000667735,
      interactiveBaseRate: 0.0005,
    },
    {
      tierCode: 'TS_X1000',
      name: 'Cascade M91',
      priceUsdt: 1000.0,
      capacityGhs: 550.0,
      powerRatingW: 4500,
      description: 'Professional enterprise supercomputing array delivering massive daily throughput.',
      technicalSummary: 'Comparable to modern AI accelerator hardware used in large cloud computing environments.',
      simpleExplanation: 'Professional hardware array for demanding AI & parallel cloud data workflows.',
      dailyYieldEstimateUsdt: 32.00,
      computeRating: 'Priority Allocation Class 4',
      performanceTier: 'Professional Tier',
      capacityScore: 94,
      recommendedFor: 'Built for users seeking high-volume cloud allocation.',
      durationHours: 168, // 7 days
      expiryWarningDays: 2,
      reactivationWindowDays: 7,
      renewalWindowDays: 5,
      renewalPricingPercent: 100,
      renewalPeriodDays: 7,
      reactivationFeePercent: 100,
      passiveYieldRate: 0.000000673401,
      interactiveBaseRate: 0.0005,
    },
    {
      tierCode: 'TS_Q2500',
      name: 'StreamTitan 2028',
      priceUsdt: 2500.0,
      capacityGhs: 1500.0,
      powerRatingW: 12000,
      description: 'Flagship enterprise quantum supercomputer cluster for maximum capacity allocation.',
      technicalSummary: 'Comparable to modern AI accelerator hardware used in large cloud computing environments.',
      simpleExplanation: 'Ultimate enterprise computing tier producing industry-leading daily yields.',
      dailyYieldEstimateUsdt: 85.00,
      computeRating: 'Quantum Supercluster Class 5',
      performanceTier: 'Flagship Enterprise',
      capacityScore: 99,
      recommendedFor: 'Enterprise performance for maximum compute allocation.',
      durationHours: 168, // 7 days
      expiryWarningDays: 2,
      reactivationWindowDays: 7,
      renewalWindowDays: 5,
      renewalPricingPercent: 100,
      renewalPeriodDays: 7,
      reactivationFeePercent: 100,
      passiveYieldRate: 0.000000655864,
      interactiveBaseRate: 0.0005,
    },
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notification: NotificationService,
    private readonly balanceService: BalanceService,
    private readonly orchestrator: FinancialOrchestratorService,
    private readonly paymentOrderService: PaymentOrderService,
    @Inject(forwardRef(() => MiningService))
    private readonly miningService?: MiningService,
    @Optional() @Inject(forwardRef(() => PlatformOperationsEngineService)) private readonly opsEngine?: PlatformOperationsEngineService,
    @Optional() private readonly premiumService?: PremiumService,
  ) {}

  getCatalog(): MachineTier[] {
    return this.catalog;
  }

  async getUserMachines(userIdOrTelegramId: string | bigint): Promise<UserMachineAsset[]> {
    const userStr = String(userIdOrTelegramId);
    const isUuid = userStr.includes('-');

    let records: any[] = [];
    try {
      if (isUuid) {
        const u = await this.prisma.user.findUnique({ where: { id: userStr } });
        if (u?.telegramUserId) {
          records = await this.prisma.userMachine.findMany({
            where: { telegramUserId: u.telegramUserId },
            orderBy: { purchasedAt: 'desc' },
          });
        }
      } else if (/^\d+$/.test(userStr)) {
        records = await this.prisma.userMachine.findMany({
          where: { telegramUserId: BigInt(userStr) },
          orderBy: { purchasedAt: 'desc' },
        });
      }
    } catch (err: any) {
      console.warn('[MachineService] user_machines table query error:', err?.message);
      records = [];
    }

    // Ensure database-backed trial machine exists
    const telegramUserId = await this.resolveTelegramUserId(userIdOrTelegramId);
    let trialMachine = records.find((r) => r.tierCode === 'TS_TRIAL');
    
    if (!trialMachine) {
      try {
        trialMachine = await this.prisma.userMachine.create({
          data: {
            telegramUserId,
            tierCode: 'TS_TRIAL',
            name: 'Titan Core',
            type: 'TRIAL',
            purchasePrice: new Prisma.Decimal(0),
            currency: 'USDT',
            status: 'ACTIVE',
            capacityGhs: new Prisma.Decimal(1.0),
            trialLimitAmount: new Prisma.Decimal(5.0),
            trialUsedAmount: new Prisma.Decimal(0),
            purchasedAt: new Date(),
            activatedAt: new Date(),
          },
        });
        records.push(trialMachine);
      } catch (err) {
        console.warn('[MachineService] Failed to create trial machine:', err?.message);
      }
    }

    const userAssets: UserMachineAsset[] = records.map((r) => ({
      id: r.id,
      telegramUserId: r.telegramUserId.toString(),
      tierCode: r.tierCode,
      name: r.name,
      purchasePrice: r.purchasePrice.toNumber(),
      currency: r.currency,
      status: r.status as any,
      capacityGhs: r.capacityGhs.toNumber(),
      lifetimeEarnings: r.lifetimeEarnings.toNumber(),
      purchasedAt: r.purchasedAt.toISOString(),
      activatedAt: r.activatedAt.toISOString(),
      expiresAt: r.expiresAt ? r.expiresAt.toISOString() : undefined,
    }));

    return userAssets;
  }

  private async resolveTelegramUserId(userKey: string | bigint): Promise<bigint> {
    if (typeof userKey === 'bigint') return userKey;
    const userStr = String(userKey).trim();
    if (/^\d+$/.test(userStr)) {
      return BigInt(userStr);
    }
    const u = await this.prisma.user.findUnique({ where: { id: userStr } });
    if (u?.telegramUserId) {
      return u.telegramUserId;
    }
    const digits = userStr.replace(/\D/g, '');
    if (digits.length > 0) {
      return BigInt(digits);
    }
    let hash = 0;
    for (let i = 0; i < userStr.length; i++) {
      hash = (hash << 5) - hash + userStr.charCodeAt(i);
      hash |= 0;
    }
    return BigInt(Math.abs(hash) + 100000);
  }

  async fulfillMachineOwnershipAfterPayment(userIdOrTelegramId: string | bigint, tierCode: string, pricePaid: number) {
    const telegramUserId = await this.resolveTelegramUserId(userIdOrTelegramId);
    const tier = this.catalog.find((t) => t.tierCode === tierCode);

    if (this.opsEngine) {
      await this.opsEngine.assertOperationalModeAllowed('PURCHASE', 'USDT', tier?.performanceTier || tier?.computeRating);
    }

    const machineName = tier ? tier.name : tierCode;
    const capacityGhs = tier ? tier.capacityGhs : 5.0;

    const createdMachine = await this.prisma.userMachine.create({
      data: {
        telegramUserId,
        tierCode,
        name: machineName,
        type: 'PAID',
        purchasePrice: pricePaid,
        currency: 'USDT',
        status: 'ACTIVE',
        capacityGhs,
      },
    });

    if (this.miningService) {
      await this.miningService.recalculateUserMiningState(telegramUserId.toString());
    }

    await this.notification.createNotification({
      userId: telegramUserId,
      templateCode: 'MACHINE_ACTIVATED',
      variables: { machineName: `${machineName} (${capacityGhs} GH/s)` },
    });

    await this.audit.create({
      telegramUserId,
      eventType: AuditEventType.TRANSACTION_COMPLETED,
      description: `Fulfilled machine ownership for ${machineName} ($${pricePaid} USDT)`,
      metadata: { machineId: createdMachine.id, tierCode, price: pricePaid },
    });

    return createdMachine;
  }

  async purchaseMachine(userIdOrTelegramId: string | bigint, tierCode: string, idempotencyKey: string) {
    const telegramUserId = await this.resolveTelegramUserId(userIdOrTelegramId);

    // Explicitly reject attempt to "purchase" promotional Titan Core
    if (tierCode === 'TS_TRIAL') {
      throw new BadRequestException('CANNOT_PURCHASE_TRIAL_MACHINE: Titan Core is a complimentary baseline asset and cannot be purchased.');
    }

    const tier = this.catalog.find((t) => t.tierCode === tierCode);
    if (!tier) throw new NotFoundException(`Machine tier ${tierCode} not found`);

    // Server-enforced $1,000 premium gate for high-tier machines
    if (this.premiumService && tier.priceUsdt >= 1000) {
      await this.premiumService.assertPremiumAccess(telegramUserId, `purchase ${tier.name}`);
    }

    const userIdStr = telegramUserId.toString();

    // Check user available balance (auto-create financial account if missing)
    let account = await this.prisma.financialAccount.findUnique({
      where: { telegramUserId },
    });
    if (!account) {
      account = await this.prisma.financialAccount.create({
        data: { telegramUserId },
      });
    }
    const { balances } = await this.balanceService.getBalances(telegramUserId, account.id);
    const usdtBalance = balances.find((b) => b.assetCode === 'USDT');
    const availableUsdt = parseFloat(usdtBalance?.availableBalance || '0');

    if (availableUsdt < tier.priceUsdt) {
      // LEGACY: PaymentOrderService quarantined - use PaymentIntent instead
      // const missingUsdt = tier.priceUsdt - availableUsdt;
      // const order = await this.paymentOrderService.createOrder(telegramUserId, {
      //   type: 'MACHINE_PURCHASE',
      //   amount: tier.priceUsdt,
      //   currency: 'USDT',
      //   paymentMethod: 'MOBILE_MONEY',
      //   metadata: { targetTierCode: tierCode, missingAmount: missingUsdt },
      // });

      // For now, just return insufficient balance error
      const missingUsdt = tier.priceUsdt - availableUsdt;
      return {
        success: false,
        requiresFunding: true,
        missingAmountUsdt: missingUsdt,
        message: `Insufficient balance. Please deposit ${missingUsdt.toFixed(2)} USDT to purchase this machine.`,
      };
    }

    const reference = `mach_buy_${telegramUserId}_${idempotencyKey}`;
    const existing = await this.prisma.userMachine.findUnique({ where: { purchaseReference: reference } });
    if (existing) return { success: true, requiresFunding: false, machine: existing, message: 'Machine purchase already completed.' };

    // Reserve, create, and settle inside one serializable transaction. The
    // rules-layer balance check runs in this same transaction for all debits.
    const activatedMachine = await this.prisma.$transaction(async (tx) => {
      await this.orchestrator.requestOperation({
      telegramUserId,
      operationType: FinancialOperationType.MACHINE_PURCHASE_RESERVE,
      assetCode: 'USDT',
      amount: tier.priceUsdt.toString(),
      idempotencyKey: reference,
      reference,
      metadata: { source: 'machine_purchase', tierCode, price: tier.priceUsdt },
      }, tx);
      const createdMachine = await tx.userMachine.create({
      data: {
        telegramUserId,
        tierCode: tier.tierCode,
        name: tier.name,
        purchasePrice: tier.priceUsdt,
        currency: 'USDT',
        purchaseReference: reference,
        status: 'PAYMENT_VERIFIED',
        capacityGhs: tier.capacityGhs,
      },
      });
      await this.orchestrator.requestOperation({
      telegramUserId,
      operationType: FinancialOperationType.MACHINE_PURCHASE_SETTLE,
      assetCode: 'USDT',
      amount: tier.priceUsdt.toString(),
      idempotencyKey: `${reference}_settle`,
      reference: `${reference}_settle`,
        metadata: { source: 'machine_purchase_settle', tierCode, price: tier.priceUsdt, machineId: createdMachine.id },
      }, tx);
      return tx.userMachine.update({
      where: { id: createdMachine.id },
      data: {
        status: 'ACTIVE',
        activatedAt: new Date(),
      },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000, maxWait: 10000 });

    const newMachineAsset: UserMachineAsset = {
      id: activatedMachine.id,
      telegramUserId: userIdStr,
      tierCode: activatedMachine.tierCode,
      name: activatedMachine.name,
      purchasePrice: activatedMachine.purchasePrice.toNumber(),
      currency: activatedMachine.currency,
      status: activatedMachine.status as any,
      capacityGhs: activatedMachine.capacityGhs.toNumber(),
      lifetimeEarnings: activatedMachine.lifetimeEarnings.toNumber(),
      purchasedAt: activatedMachine.purchasedAt.toISOString(),
      activatedAt: activatedMachine.activatedAt.toISOString(),
    };

    if (this.miningService) {
      await this.miningService.recalculateUserMiningState(userIdStr);
    }

    await this.notification.createNotification({
      userId: telegramUserId,
      templateCode: 'MACHINE_ACTIVATED',
      variables: { machineName: `${tier.name} (${tier.capacityGhs} GH/s)` },
    });

    await this.audit.create({
      telegramUserId,
      eventType: AuditEventType.TRANSACTION_COMPLETED,
      description: `Purchased machine ${tier.name} for $${tier.priceUsdt} USDT`,
      metadata: { machineId: activatedMachine.id, tierCode: tier.tierCode, price: tier.priceUsdt },
    });

    // Record economic contribution in analytical ledger
    try {
      const price = new Prisma.Decimal(tier.priceUsdt || 0);
      const directCost = price.mul(0.70); // 30% upfront margin basis
      const rel = await this.prisma.referralRelationship.findUnique({
        where: { refereeId: telegramUserId },
        select: { id: true },
      });
      await this.prisma.growthContribution.create({
        data: {
          telegramUserId,
          referralRelationshipId: rel?.id,
          economicEventType: 'MACHINE_PURCHASE',
          economicEventId: activatedMachine.id,
          grossRevenueUsdt: price,
          directCostUsdt: directCost,
          netContributionUsdt: price.minus(directCost),
        },
      });
    } catch (e: any) {
      console.warn('[MachineService] Failed to record GrowthContribution for machine purchase:', e?.message);
    }

    return {
      success: true,
      requiresFunding: false,
      machine: newMachineAsset,
      message: `Machine ${tier.name} purchased and activated successfully!`,
    };
  }

  async repowerMachine(userIdOrTelegramId: string | bigint, machineId: string, idempotencyKey: string) {
    const telegramUserId = await this.resolveTelegramUserId(userIdOrTelegramId);
    const machine = await this.prisma.userMachine.findUnique({
      where: { id: machineId },
    });
    if (!machine || machine.telegramUserId !== telegramUserId) {
      throw new NotFoundException('Machine not found');
    }

    const tier = this.catalog.find((t) => t.tierCode === machine.tierCode);
    const repowerFee = tier ? tier.priceUsdt * 0.15 : 1.65;

    const reference = `repower_${machineId}_${idempotencyKey}`;
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.orchestrator.requestOperation({
        telegramUserId, operationType: FinancialOperationType.MACHINE_REPOWER_RESERVE,
        assetCode: 'USDT', amount: repowerFee.toString(), idempotencyKey,
        reference, metadata: { machineId, repowerFee },
      }, tx);
      const activated = await tx.userMachine.update({
        where: { id: machineId }, data: { status: 'ACTIVE', activatedAt: new Date() },
      });
      await this.orchestrator.requestOperation({
        telegramUserId, operationType: FinancialOperationType.MACHINE_REPOWER_SETTLE,
        assetCode: 'USDT', amount: repowerFee.toString(), idempotencyKey: `${idempotencyKey}:settle`,
        reference: `${reference}:settle`, metadata: { machineId, repowerFee },
      }, tx);
      return activated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000, maxWait: 10000 });

    if (this.miningService) {
      await this.miningService.recalculateUserMiningState(telegramUserId.toString());
    }

    await this.audit.create({
      telegramUserId,
      eventType: AuditEventType.TRANSACTION_COMPLETED,
      description: `Repowered machine ${machine.name} ($${repowerFee.toFixed(2)} USDT)`,
      metadata: { machineId, repowerFee },
    });

    return {
      success: true,
      machine: updated,
      message: `Machine ${machine.name} repowered successfully for 30 days!`,
    };
  }

  async upgradeMachineTier(userIdOrTelegramId: string | bigint, currentMachineId: string, targetTierCode: string, idempotencyKey: string) {
    const telegramUserId = await this.resolveTelegramUserId(userIdOrTelegramId);
    const currentMachine = await this.prisma.userMachine.findUnique({
      where: { id: currentMachineId },
    });
    if (!currentMachine || currentMachine.telegramUserId !== telegramUserId) {
      throw new NotFoundException('Current machine asset not found');
    }

    const targetTier = this.catalog.find((t) => t.tierCode === targetTierCode);
    if (!targetTier) throw new NotFoundException(`Target tier ${targetTierCode} not found`);

    const currentTier = this.catalog.find((t) => t.tierCode === currentMachine.tierCode);
    const currentPrice = currentTier ? currentTier.priceUsdt : currentMachine.purchasePrice.toNumber();
    if (targetTier.priceUsdt <= currentPrice) throw new BadRequestException('TARGET_TIER_MUST_BE_HIGHER');
    const upgradeCost = targetTier.priceUsdt - currentPrice;
    const reference = `upgrade_${currentMachineId}_${idempotencyKey}`;
    const updatedMachine = await this.prisma.$transaction(async (tx) => {
      await this.orchestrator.requestOperation({
        telegramUserId, operationType: FinancialOperationType.MACHINE_UPGRADE_RESERVE,
        assetCode: 'USDT', amount: upgradeCost.toString(), idempotencyKey,
        reference, metadata: { currentMachineId, targetTierCode, upgradeCost },
      }, tx);
      const upgraded = await tx.userMachine.update({
        where: { id: currentMachineId },
        data: { tierCode: targetTier.tierCode, name: targetTier.name, capacityGhs: targetTier.capacityGhs,
          purchasePrice: targetTier.priceUsdt, status: 'ACTIVE', activatedAt: new Date() },
      });
      await this.orchestrator.requestOperation({
        telegramUserId, operationType: FinancialOperationType.MACHINE_UPGRADE_SETTLE,
        assetCode: 'USDT', amount: upgradeCost.toString(), idempotencyKey: `${idempotencyKey}:settle`,
        reference: `${reference}:settle`, metadata: { currentMachineId, targetTierCode, upgradeCost },
      }, tx);
      return upgraded;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000, maxWait: 10000 });

    if (this.miningService) {
      await this.miningService.recalculateUserMiningState(telegramUserId.toString());
    }

    await this.audit.create({
      telegramUserId,
      eventType: AuditEventType.TRANSACTION_COMPLETED,
      description: `Upgraded machine to ${targetTier.name} ($${upgradeCost.toFixed(2)} USDT)`,
      metadata: { currentMachineId, targetTierCode, upgradeCost },
    });

    return {
      success: true,
      machine: updatedMachine,
      message: `Machine upgraded to ${targetTier.name} (${targetTier.capacityGhs} GH/s) successfully!`,
    };
  }

  async updateNickname(telegramUserId: string, machineId: string, nickname: string) {
    try {
      const machine = await this.prisma.userMachine.findFirst({
        where: { id: machineId, telegramUserId: BigInt(telegramUserId) },
      });
      if (machine) {
        await this.prisma.userMachine.update({
          where: { id: machineId },
          data: { name: nickname },
        });
      }
    } catch {
      // Graceful fallback for custom IDs or non-persisted trial machines
    }
    return { success: true, machineId, nickname };
  }

  async toggleControl(telegramUserId: string, machineId: string, action: 'start' | 'pause' | 'restart') {
    const status = action === 'pause' ? 'PAUSED' : 'ACTIVE';
    try {
      const machine = await this.prisma.userMachine.findFirst({
        where: { id: machineId, telegramUserId: BigInt(telegramUserId) },
      });
      if (machine) {
        await this.prisma.userMachine.update({
          where: { id: machineId },
          data: { status },
        });
      }
    } catch {
      // Graceful fallback
    }
    return { success: true, machineId, status };
  }

  async getCertificate(telegramUserId: string, machineId: string) {
    try {
      const machine = await this.prisma.userMachine.findFirst({
        where: { id: machineId, telegramUserId: BigInt(telegramUserId) },
      });
      if (machine) {
        return {
          machineId: machine.id,
          tierCode: machine.tierCode,
          name: machine.name,
          capacityGhs: machine.capacityGhs.toNumber(),
          commissionedAt: machine.purchasedAt,
          activatedAt: machine.activatedAt,
          certificateId: `CERT-${machine.tierCode}-${machine.id.slice(0, 8)}`,
        };
      }
    } catch {}
    return null;
  }
}
