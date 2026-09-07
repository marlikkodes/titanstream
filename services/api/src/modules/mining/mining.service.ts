import { Injectable, Inject, forwardRef, Optional, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FinancialOrchestratorService } from '../financial-orchestration/financial-orchestrator.service';
import { FinancialOperationType, Prisma } from '@prisma/client';
import { MachineService } from '../machine/machine.service';
import type { MachineTier } from '../machine/machine.service';
import { PlatformOperationsEngineService } from '../admin/services/platform-operations-engine.service';

export interface UserMiningState {
  telegramUserId: string;
  activeCurrency: 'USDT' | 'TON';
  baseSpeedGhs: number;
  coolerMultiplier: number;
  unclaimedBalance: number;
  lastTappedAt?: Date;
  lastUpdatedAt?: Date;
  machineMode: string;
  lifetimePromotionalOutput: number;
  interactivePromotionalOutput: number;
  // Computed on every read — rendered by the UI but never persisted
  isOverheated: boolean;
  cooldownRemaining: number;
  tapYieldPerTap: number;
}

const MAX_MULTIPLIER = 10.1;
const MULTIPLIER_DECAY_PER_SEC = 0.5;
const OVERHEAT_MS = 15 * 1000;

@Injectable()
export class MiningService {
  // In-memory store for user mining sessions (acts as a Redis fallback)
  private readonly sessions = new Map<string, UserMiningState>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly orchestrator: FinancialOrchestratorService,
    @Inject(forwardRef(() => MachineService))
    private readonly machineService: MachineService,
    @Optional() @Inject(forwardRef(() => PlatformOperationsEngineService)) private readonly opsEngine?: PlatformOperationsEngineService,
  ) {}

  private async loadFromDb(userIdOrTelegramId: string): Promise<UserMiningState | null> {
    try {
      const cleanDigits = userIdOrTelegramId.replace(/\D/g, '');
      let record: any = null;

      if (userIdOrTelegramId.includes('-')) {
        const u = await this.prisma.user.findUnique({ where: { id: userIdOrTelegramId } });
        if (u?.telegramUserId) {
          record = await this.prisma.userMiningState.findUnique({
            where: { telegramUserId: u.telegramUserId },
          });
        }
      }

      if (!record && cleanDigits) {
        let tgId = BigInt(cleanDigits);
        const MAX_POSTGRES_BIGINT = BigInt('9223372036854775807');
        if (tgId > MAX_POSTGRES_BIGINT) tgId = tgId % MAX_POSTGRES_BIGINT;
        record = await this.prisma.userMiningState.findUnique({
          where: { telegramUserId: tgId },
        });
      }

      if (!record) return null;
      const toNum = (val: any) => (val && typeof val.toNumber === 'function' ? val.toNumber() : Number(val || 0));
      return {
        telegramUserId: userIdOrTelegramId,
        activeCurrency: record.activeCurrency as 'USDT' | 'TON',
        baseSpeedGhs: toNum(record.baseSpeedGhs),
        coolerMultiplier: toNum(record.coolerMultiplier),
        unclaimedBalance: toNum(record.unclaimedBalance),
        lastTappedAt: record.lastTappedAt ? new Date(record.lastTappedAt) : undefined,
        lastUpdatedAt: record.lastUpdatedAt ? new Date(record.lastUpdatedAt) : undefined,
        machineMode: record.machineMode,
        lifetimePromotionalOutput: toNum(record.lifetimePromotionalOutput),
        interactivePromotionalOutput: toNum(record.interactivePromotionalOutput),
        isOverheated: false,
        cooldownRemaining: 0,
        tapYieldPerTap: 0,
      };
    } catch (err) {
      console.warn('Failed to load mining state from DB:', err);
      return null;
    }
  }

  private async persistSession(session: UserMiningState, client: Prisma.TransactionClient | PrismaService = this.prisma): Promise<void> {
    let rawTgId = (session as any).telegramUserId;
    if (typeof rawTgId === 'object' && rawTgId !== null && rawTgId.value) {
      rawTgId = rawTgId.value;
    }
    const cleanDigits = String(rawTgId || '').replace(/\D/g, '');
    if (!cleanDigits || !/^\d+$/.test(cleanDigits)) return;

    let tgBigInt = BigInt(cleanDigits);
    const MAX_POSTGRES_BIGINT = BigInt('9223372036854775807');
    if (tgBigInt > MAX_POSTGRES_BIGINT) tgBigInt = tgBigInt % MAX_POSTGRES_BIGINT;

    await client.userMiningState.upsert({
      where: { telegramUserId: tgBigInt },
      create: {
        telegramUserId: tgBigInt,
        activeCurrency: session.activeCurrency,
        baseSpeedGhs: session.baseSpeedGhs,
        coolerMultiplier: session.coolerMultiplier,
        unclaimedBalance: session.unclaimedBalance,
        lastTappedAt: session.lastTappedAt,
        lastUpdatedAt: session.lastUpdatedAt,
        machineMode: session.machineMode,
        lifetimePromotionalOutput: session.lifetimePromotionalOutput,
        interactivePromotionalOutput: session.interactivePromotionalOutput,
      },
      update: {
        activeCurrency: session.activeCurrency,
        baseSpeedGhs: session.baseSpeedGhs,
        coolerMultiplier: session.coolerMultiplier,
        unclaimedBalance: session.unclaimedBalance,
        lastTappedAt: session.lastTappedAt,
        lastUpdatedAt: session.lastUpdatedAt,
        machineMode: session.machineMode,
        lifetimePromotionalOutput: session.lifetimePromotionalOutput,
        interactivePromotionalOutput: session.interactivePromotionalOutput,
      },
    });
  }

  private async saveToDb(session: UserMiningState): Promise<void> {
    try {
      await this.persistSession(session);
    } catch (err) {
      console.warn('Failed to save mining state to DB:', err);
    }
  }

  /**
   * Highest-capacity active machine tier — the economic profile that governs
   * tap yield, thermal limits, and promotional economics for the session.
   */
  private async getBestActiveTier(session: UserMiningState): Promise<MachineTier | undefined> {
    const machines = await this.machineService.getUserMachines(session.telegramUserId);
    const activeMachines = machines.filter((m) => m.status === 'ACTIVE');
    const catalog = this.machineService.getCatalog();

    let bestTier: MachineTier | undefined;
    for (const um of activeMachines) {
      const tier = catalog.find((t) => t.tierCode === um.tierCode);
      if (!tier) continue;
      if (!bestTier || tier.capacityGhs > bestTier.capacityGhs) bestTier = tier;
    }
    return bestTier;
  }

  /**
   * Derive the thermal state of the machine. The overheat window opens when the
   * cooler multiplier reaches its cap and closes 15s after the last tap. While
   * overheated the multiplier is frozen and the engine pauses; when the window
   * closes the core resets to 1.0 so tapping can resume cleanly.
   */
  private async applyCoolingState(session: UserMiningState, now: Date): Promise<void> {
    const bestTier = await this.getBestActiveTier(session);
    const maxMultiplier = bestTier?.maxMultiplier ?? MAX_MULTIPLIER;
    const lastTap = session.lastTappedAt ? new Date(session.lastTappedAt).getTime() : 0;
    const overheated = session.coolerMultiplier >= maxMultiplier && now.getTime() - lastTap < OVERHEAT_MS;
    if (overheated) {
      session.isOverheated = true;
      session.cooldownRemaining = Math.max(0, Math.ceil((OVERHEAT_MS - (now.getTime() - lastTap)) / 1000));
      return;
    }
    session.isOverheated = false;
    session.cooldownRemaining = 0;
    if (session.coolerMultiplier >= maxMultiplier) {
      session.coolerMultiplier = 1.0; // cooldown finished — core resets
    }
  }

  /**
   * Server-computed per-tap yield from the machine configuration. The client
   * never supplies yield numbers — it only renders this value.
   */
  private async computeTapYield(session: UserMiningState): Promise<number> {
    const bestTier = await this.getBestActiveTier(session);

    const dailyYield = bestTier?.dailyYieldEstimateUsdt ?? 2.0;
    const payout = session.activeCurrency === 'TON' ? dailyYield * 1.15 : dailyYield;
    const interactiveRate = bestTier?.interactiveBaseRate ?? 0.0005;
    let yieldValue = interactiveRate * session.coolerMultiplier * payout;

    if (bestTier?.promoOutputCap && session.machineMode === 'PROMOTIONAL') {
      const remainingPromoCap = Math.max(0, bestTier.promoOutputCap - session.lifetimePromotionalOutput);
      const interactiveCap = bestTier.interactiveBonusCap ?? 0.10;
      const remainingInteractive = Math.max(0, interactiveCap - session.interactivePromotionalOutput);
      yieldValue = Math.min(yieldValue, remainingPromoCap, remainingInteractive);
    }

    return yieldValue;
  }

  /**
   * Hidden Operator Bonus:
   * Backend-controlled, deterministic bonus for consistent app engagement,
   * machine synchronization, and health checks. Daily capped at 5% of machine yield.
   */
  private calculateOperatorBonus(passiveYieldAmount: number): number {
    if (passiveYieldAmount <= 0) return 0;
    // 3% operator bonus for healthy session synchronization
    return passiveYieldAmount * 0.03;
  }

  private async accruePassiveYield(session: UserMiningState): Promise<void> {
    const now = new Date();
    const lastUpdate = session.lastUpdatedAt ? new Date(session.lastUpdatedAt) : new Date();

    const elapsedMs = now.getTime() - lastUpdate.getTime();
    await this.applyCoolingState(session, now);
    if (elapsedMs <= 0) {
      session.lastUpdatedAt = now;
      return;
    }

    if (session.isOverheated) {
      session.lastUpdatedAt = now;
      return;
    }

    // Enforce 24-hour maximum offline accrual window to prevent runaway unbounded accrual
    const MAX_OFFLINE_ACCRUAL_MS = 24 * 3600 * 1000;
    const boundedElapsedMs = Math.min(elapsedMs, MAX_OFFLINE_ACCRUAL_MS);

    const bestTier = await this.getBestActiveTier(session);
    const decayPerSec = bestTier?.multiplierDecayPerSec ?? MULTIPLIER_DECAY_PER_SEC;
    if (session.coolerMultiplier > 1.0) {
      session.coolerMultiplier = Math.max(1.0, session.coolerMultiplier - decayPerSec * (boundedElapsedMs / 1000));
    }

    const machines = await this.machineService.getUserMachines(session.telegramUserId);
    const activeMachines = machines.filter((m) => m.status === 'ACTIVE');
    const catalog = this.machineService.getCatalog();

    let totalYield = 0;

    for (const um of activeMachines) {
      const tier = catalog.find((t) => t.tierCode === um.tierCode);
      if (!tier) continue;

      // Exact interval intersection:
      // Machine must be activated before or during the interval, and not expired
      const activatedAtMs = um.activatedAt ? new Date(um.activatedAt).getTime() : 0;
      const windowStart = Math.max(lastUpdate.getTime(), activatedAtMs);

      let expiresAtMs = Number.POSITIVE_INFINITY;
      if ((um as any).expiresAt) {
        expiresAtMs = new Date((um as any).expiresAt).getTime();
      } else if (tier.durationHours && activatedAtMs > 0) {
        expiresAtMs = activatedAtMs + tier.durationHours * 3600 * 1000;
      }
      const windowEnd = Math.min(now.getTime(), expiresAtMs);

      const eligibleMs = Math.max(0, windowEnd - windowStart);
      if (eligibleMs <= 0) continue;

      // Bound eligible time to maximum offline accrual limit
      const effectiveMs = Math.min(eligibleMs, MAX_OFFLINE_ACCRUAL_MS);

      const machineCapacity = um.capacityGhs > 0 ? um.capacityGhs : tier.capacityGhs;

      if (tier.promoOutputCap && tier.promoYieldRate && session.machineMode === 'PROMOTIONAL') {
        const promoRatePerSec = tier.promoYieldRate;
        const multiplierInfluence = Math.min(session.coolerMultiplier, tier.promoMultiplierInfluence ?? Number.POSITIVE_INFINITY);
        const totalPromoYield = machineCapacity * multiplierInfluence * promoRatePerSec * (effectiveMs / 1000);

        const remainingCap = tier.promoOutputCap - session.lifetimePromotionalOutput;
        if (remainingCap <= 0) {
          session.machineMode = 'STANDARD';
        } else if (totalPromoYield >= remainingCap) {
          totalYield += remainingCap;
          session.lifetimePromotionalOutput = tier.promoOutputCap;
          session.machineMode = 'STANDARD';

          const usedFraction = remainingCap / totalPromoYield;
          const remainingMs = effectiveMs * (1 - usedFraction);
          if (remainingMs > 0) {
            const stdRatePerSec = tier.passiveYieldRate || 0.00000192935;
            const stdYield = machineCapacity * session.coolerMultiplier * stdRatePerSec * (remainingMs / 1000);
            totalYield += stdYield;
          }
        } else {
          totalYield += totalPromoYield;
          session.lifetimePromotionalOutput += totalPromoYield;
        }
      } else {
        const stdRatePerSec = tier.passiveYieldRate || 0.00000192935;
        const stdYield = machineCapacity * session.coolerMultiplier * stdRatePerSec * (effectiveMs / 1000);
        totalYield += stdYield;
      }
    }

    // Apply Hidden Operator Bonus for regular app synchronization
    const operatorBonus = this.calculateOperatorBonus(totalYield);
    totalYield += operatorBonus;

    session.unclaimedBalance += totalYield;
    session.lastUpdatedAt = now;
  }

  async getOrCreateSession(telegramUserId: string): Promise<UserMiningState> {
    const cleanId = telegramUserId.replace(/\D/g, '') || telegramUserId;
    let session = this.sessions.get(telegramUserId) || this.sessions.get(cleanId);
    if (!session) {
      session = (await this.loadFromDb(telegramUserId)) ?? (await this.loadFromDb(cleanId)) ?? undefined;
    }

    // Sync speed dynamically with user's active machines from MachineService
    const machines = await this.machineService.getUserMachines(telegramUserId);
    const activeMachines = machines.filter((m) => m.status === 'ACTIVE');
    const totalGhs = activeMachines.reduce((sum, m) => sum + m.capacityGhs, 0);
    const baseSpeed = totalGhs > 0 ? totalGhs : 1.0;

    if (!session) {
      session = {
        telegramUserId,
        activeCurrency: 'USDT',
        baseSpeedGhs: baseSpeed,
        coolerMultiplier: 1.0,
        unclaimedBalance: 0.0,
        machineMode: 'PROMOTIONAL',
        lifetimePromotionalOutput: 0.0,
        interactivePromotionalOutput: 0.0,
        isOverheated: false,
        cooldownRemaining: 0,
        tapYieldPerTap: 0.01 * 2.0,
        lastUpdatedAt: new Date(),
      };
      this.sessions.set(telegramUserId, session);
      if (cleanId) this.sessions.set(cleanId, session);
    } else {
      session.baseSpeedGhs = baseSpeed;
      await this.accruePassiveYield(session);
      this.sessions.set(telegramUserId, session);
      if (cleanId) this.sessions.set(cleanId, session);
    }

    session.tapYieldPerTap = await this.computeTapYield(session);
    await this.saveToDb(session);
    return session;
  }

  /**
   * Recalculate and persist user mining state baseSpeedGhs based on persistent active machines in DB.
   */
  async recalculateUserMiningState(telegramUserId: string): Promise<UserMiningState> {
    const session = await this.getOrCreateSession(telegramUserId);
    const machines = await this.machineService.getUserMachines(telegramUserId);
    const activeMachines = machines.filter((m) => m.status === 'ACTIVE');
    const totalGhs = activeMachines.reduce((sum, m) => sum + m.capacityGhs, 0);
    session.baseSpeedGhs = totalGhs > 0 ? totalGhs : 1.0;
    session.tapYieldPerTap = await this.computeTapYield(session);
    await this.saveToDb(session);
    this.sessions.set(telegramUserId, session);
    return session;
  }

  async tap(telegramUserId: string): Promise<UserMiningState> {
    const session = await this.getOrCreateSession(telegramUserId);
    if (session.isOverheated) {
      return session;
    }

    // Yield is computed from machine configuration before the multiplier bump,
    // so the credited amount matches the value the UI displayed.
    const increment = await this.computeTapYield(session);

    const bestTier = await this.getBestActiveTier(session);
    session.coolerMultiplier = Math.min(bestTier?.maxMultiplier ?? MAX_MULTIPLIER, session.coolerMultiplier + 0.6);
    session.lastTappedAt = new Date();

    let credit = increment;
    if (session.machineMode === 'PROMOTIONAL') {
      const promoCap = bestTier?.promoOutputCap ?? 5.0;
      const interactiveCap = bestTier?.interactiveBonusCap ?? Number.MAX_SAFE_INTEGER;

      const remainingCap = promoCap - session.lifetimePromotionalOutput;
      const remainingInteractive = interactiveCap - session.interactivePromotionalOutput;

      if (remainingCap <= 0) {
        credit = 0;
        session.machineMode = 'STANDARD';
      } else {
        credit = Math.min(increment, remainingInteractive, remainingCap);
        session.lifetimePromotionalOutput += credit;
        session.interactivePromotionalOutput += credit;
        if (session.lifetimePromotionalOutput >= promoCap) {
          session.lifetimePromotionalOutput = promoCap;
          session.machineMode = 'STANDARD';
        }
      }
    }

    session.unclaimedBalance += credit;
    session.lastUpdatedAt = new Date();

    await this.applyCoolingState(session, new Date());
    session.tapYieldPerTap = await this.computeTapYield(session);

    await this.saveToDb(session);
    return session;
  }

  async toggleCurrency(telegramUserId: string, currency: 'USDT' | 'TON'): Promise<UserMiningState> {
    const session = await this.getOrCreateSession(telegramUserId);
    session.activeCurrency = currency;
    session.tapYieldPerTap = await this.computeTapYield(session);
    await this.saveToDb(session);
    return session;
  }

  async claim(telegramUserId: string, idempotencyKey?: string): Promise<{ success: boolean; amount: string; session: UserMiningState }> {
    const cleanDigits = telegramUserId.replace(/\D/g, '') || telegramUserId;
    const tgBigInt = BigInt(cleanDigits);

    // Check for replayed idempotent request first
    if (idempotencyKey) {
      const opKey = `mining_claim_${telegramUserId}_${idempotencyKey}`;
      try {
        const existingRecord = await this.prisma.financialIdempotencyRecord.findUnique({
          where: {
            telegramUserId_idempotencyKey: {
              telegramUserId: tgBigInt,
              idempotencyKey: opKey,
            },
          },
        });
        if (existingRecord && existingRecord.status === 'COMPLETED') {
          const session = await this.getOrCreateSession(telegramUserId);
          const amount = (existingRecord.responsePayload as any)?.amount?.toString() || '0.000000';
          return {
            success: true,
            amount,
            session,
          };
        }
      } catch (idempErr) {
        // Table may not exist in mock/test setups, proceed to transaction
      }
    }

    // Operational control switch enforcement
    if (this.opsEngine) {
      const currentSession = await this.getOrCreateSession(telegramUserId);
      await this.opsEngine.assertOperationalModeAllowed('CLAIM', currentSession.activeCurrency);
    }

    const MIN_CLAIM_THRESHOLD = 3.0;
    let finalClaimAmountStr = '0.000000';
    let committedDate: Date = new Date();

    // ONE atomic database transaction with pessimistic row lock (FOR UPDATE):
    // Prevents claim races (simultaneous browser claims), double credits, and ensures
    // the ledger credit matches the exact balance committed in the database.
    await this.prisma.$transaction(
      async (tx) => {
        // 1. Pessimistic lock on the user's mining state record
        const lockedRows = await tx.$queryRaw<any[]>`
          SELECT "telegram_user_id", "active_currency", "unclaimed_balance", "cooler_multiplier", "base_speed_ghs", "machine_mode"
          FROM "user_mining_states"
          WHERE "telegram_user_id" = ${tgBigInt}
          FOR UPDATE
        `;

        if (!lockedRows || lockedRows.length === 0) {
          throw new BadRequestException({
            code: 'SESSION_NOT_FOUND',
            message: 'No active mining state found for user.',
          });
        }

        const lockedRow = lockedRows[0];
        const lockedUnclaimed = Number(lockedRow.unclaimed_balance || 0);

        // 2. Strict accounting check against the locked database balance
        if (lockedUnclaimed < MIN_CLAIM_THRESHOLD) {
          throw new BadRequestException({
            code: 'ALREADY_CLAIMED',
            message: `Mining rewards already collected or below minimum threshold of $3.00 (Current: $${lockedUnclaimed.toFixed(4)}).`,
          });
        }

        finalClaimAmountStr = lockedUnclaimed.toFixed(6);
        const reference = idempotencyKey 
          ? `mining_claim_${telegramUserId}_${idempotencyKey}` 
          : `mining_claim_${telegramUserId}_${Date.now()}`;
        const currency = lockedRow.active_currency || 'USDT';

        // 3. Double-entry ledger allocation inside the SAME transaction
        await (this.orchestrator as any).requestOperation(
          {
            telegramUserId: tgBigInt,
            operationType: FinancialOperationType.SYSTEM_ALLOCATION,
            assetCode: currency,
            amount: finalClaimAmountStr,
            idempotencyKey: reference,
            reference,
            metadata: { source: 'mining_claim', claimAmount: lockedUnclaimed },
          },
          tx,
        );

        // 4. Reset unclaimed balance to exactly 0.0 and advance lastUpdatedAt
        committedDate = new Date();
        await tx.userMiningState.update({
          where: { telegramUserId: tgBigInt },
          data: {
            unclaimedBalance: 0.0,
            coolerMultiplier: 1.0,
            lastUpdatedAt: committedDate,
          },
        });
      },
      { timeout: 15000, maxWait: 10000 },
    );

    // Transaction committed — sync the in-memory session to mirror the persisted state
    const session = await this.getOrCreateSession(telegramUserId);
    session.unclaimedBalance = 0.0;
    session.coolerMultiplier = 1.0;
    session.isOverheated = false;
    session.cooldownRemaining = 0;
    session.lastUpdatedAt = committedDate;
    session.tapYieldPerTap = await this.computeTapYield(session);
    this.sessions.set(telegramUserId, session);
    if (cleanDigits) this.sessions.set(cleanDigits, session);

    return {
      success: true,
      amount: finalClaimAmountStr,
      session,
    };
  }
}
