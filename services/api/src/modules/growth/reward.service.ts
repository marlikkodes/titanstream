import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FinancialOrchestratorService } from '../financial-orchestration/financial-orchestrator.service';
import { GrowthEventService } from './growth-event.service';
import { GrowthNotificationService } from './growth-notification.service';
import { AchievementService } from './achievement.service';
import { ReferralService } from './referral.service';
import {
  RewardStatus,
  RewardType,
  GrowthEventType,
  ReferralStatus,
  Prisma,
} from '@prisma/client';

export interface RequirementSnapshot {
  key: string;
  label: string;
  required: number;
  current: number;
  unit: string;
  completed: boolean;
  actionTab?: string;
}

export interface RewardEligibility {
  eligible: boolean;
  requirement: RequirementSnapshot | null;
  reason: string;
}

const LEVEL_ORDER: Record<string, number> = {
  NEW: 0,
  VERIFIED: 1,
  TRUSTED: 2,
  PREMIUM: 3,
  ELITE: 4,
};

@Injectable()
export class RewardService {
  private readonly logger = new Logger(RewardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orchestrator: FinancialOrchestratorService,
    private readonly growthEventService: GrowthEventService,
    private readonly notificationService: GrowthNotificationService,
    private readonly achievementService: AchievementService,
    private readonly referralService: ReferralService,
  ) {}

  /**
   * Seed default reward rules if none exist, and refresh rule parameters so
   * existing installations pick up the requirement engine configuration.
   */
  async ensureDefaultRules() {
    const defaultRules = [
      {
        code: 'REFERRAL_DEFAULT_5USDT',
        name: 'Referral Reward',
        rewardType: RewardType.REFERRAL,
        amount: '5.000000',
        assetCode: 'USDT',
        parameters: {
          description: 'Earn 5 USDT for each friend who joins, completes onboarding and settles.',
          requirementType: 'REFERRAL_QUALIFIED',
          requirementCount: 1,
          actionTab: 'friends',
          expiresInDays: 30,
        },
      },
      {
        code: 'MILESTONE_FIRST_SETTLEMENT',
        name: 'First Settlement Bonus',
        rewardType: RewardType.MILESTONE,
        amount: '2.000000',
        assetCode: 'USDT',
        parameters: {
          description: 'Earn 2 USDT when you complete your first settlement.',
          requirementType: 'SETTLEMENT_COUNT',
          requirementCount: 1,
          actionTab: 'wallet',
          expiresInDays: 90,
        },
      },
    ];

    for (const rule of defaultRules) {
      await this.prisma.rewardRule.upsert({
        where: { code: rule.code },
        update: {
          name: rule.name,
          amount: rule.amount,
          parameters: rule.parameters,
          enabled: true,
        },
        create: rule,
      });
    }
  }

  /**
   * Resolve the configured referral rule amount (engine source of truth).
   */
  async getReferralRuleAmount() {
    return this.prisma.rewardRule.findUnique({
      where: { code: 'REFERRAL_DEFAULT_5USDT' },
      select: { amount: true, code: true },
    });
  }

  // ============================================================
  // SURPRISE REWARD ENGINE (Platform-First & Controlled Budget)
  // ============================================================

  /**
   * Evaluates and disburses a server-authoritative surprise reward.
   * Enforces daily USDT budget caps, emergency kill switch, tier probabilities,
   * and diminishing returns on repeated daily triggers.
   */
  async evaluateSurpriseReward(
    telegramUserId: bigint,
    triggerEvent: 'SETTLEMENT_COMPLETED' | 'RETURN_AFTER_INACTIVITY' | 'PROGRESSION_MILESTONE' | 'LOYALTY_SURPRISE',
  ): Promise<{
    granted: boolean;
    tier: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
    assetCode: 'USDT' | 'CRYSTALS';
    amount: string;
    reason: string;
  } | null> {
    // 1. Emergency Control Kill Switch Check
    const emergencyState = await this.prisma.emergencyControlState.findUnique({
      where: { id: 'SYSTEM_EMERGENCY_STATE' },
    });
    if (emergencyState?.rewardsPaused) {
      this.logger.warn(`[SurpriseEngine] Surprise rewards bypassed for user ${telegramUserId}: Emergency rewards control is PAUSED`);
      return null;
    }

    // 2. Calculate daily trigger count for Diminishing Returns Probability Decay
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const triggerCountToday = await this.prisma.growthEvent.count({
      where: {
        telegramUserId,
        eventType: GrowthEventType.SURPRISE_REWARD_GRANTED,
        createdAt: { gte: todayStart },
      },
    });

    const decayMultiplier = Math.pow(0.5, triggerCountToday);

    // 3. Server-side Tier Selection (PRNG)
    const roll = Math.random() * 100;
    let tier: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' = 'COMMON';
    let targetAsset: 'USDT' | 'CRYSTALS' = 'CRYSTALS';
    let targetAmount = '25';

    if (roll < 0.5 * decayMultiplier) {
      tier = 'LEGENDARY';
      targetAsset = 'USDT';
      targetAmount = '1.000000';
    } else if (roll < (0.5 + 2.5) * decayMultiplier) {
      tier = 'EPIC';
      targetAsset = 'USDT';
      targetAmount = '0.250000';
    } else if (roll < (0.5 + 2.5 + 7.0) * decayMultiplier) {
      tier = 'RARE';
      targetAsset = 'USDT';
      targetAmount = '0.100000';
    } else if (roll < 0.5 + 2.5 + 7.0 + 20.0) {
      tier = 'UNCOMMON';
      targetAsset = 'CRYSTALS';
      targetAmount = '100';
    } else {
      tier = 'COMMON';
      targetAsset = 'CRYSTALS';
      targetAmount = '25';
    }

    // 4. Daily USDT Budget Cap Verification ($2.00 / day global cap) with Atomic Transaction Isolation
    const DAILY_USDT_BUDGET_CAP = 2.0;
    const ref = `surprise_${triggerEvent.toLowerCase()}_${telegramUserId}_${Date.now()}`;
    const reason = `Titan Drop (${tier}) triggered by ${triggerEvent}`;

    if (targetAsset === 'USDT') {
      await this.prisma.$transaction(async (tx) => {
        const disbursedAggregate = await tx.reward.aggregate({
          where: {
            assetCode: 'USDT',
            status: RewardStatus.CLAIMED,
            processedAt: { gte: todayStart },
          },
          _sum: { amount: true },
        });

        const currentDisbursedToday = Number(disbursedAggregate._sum.amount || 0);
        if (currentDisbursedToday + Number(targetAmount) > DAILY_USDT_BUDGET_CAP) {
          this.logger.log(`[SurpriseEngine] Daily USDT Budget Cap reached ($${currentDisbursedToday.toFixed(2)} / $${DAILY_USDT_BUDGET_CAP}). Downgrading surprise drop to UNCOMMON Crystals.`);
          tier = 'UNCOMMON';
          targetAsset = 'CRYSTALS';
          targetAmount = '100';
        } else {
          await tx.reward.create({
            data: {
              telegramUserId,
              rewardType: RewardType.MILESTONE,
              amount: targetAmount,
              assetCode: 'USDT',
              status: RewardStatus.CLAIMED,
              reference: ref,
              processedAt: new Date(),
              metadata: { surpriseTier: tier, triggerEvent, reason },
            },
          });
        }
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    }

    // 5. Execute Reward Disbursement & Financial Orchestration
    if (targetAsset === 'USDT') {
      try {
        await this.orchestrator.requestOperation({
          telegramUserId,
          amount: targetAmount,
          assetCode: 'USDT',
          operationType: 'SYSTEM_ALLOCATION' as any,
          idempotencyKey: `surprise_${ref}`,
          reference: ref,
        });
      } catch (err: any) {
        this.logger.error(`[SurpriseEngine] Ledger operation failed for surprise reward ref ${ref}: ${err.message}`);
      }
    } else {
      // Credit Crystals in CrystalAccount & log signed transaction
      const amountInt = parseInt(targetAmount, 10);
      try {
        let account = await this.prisma.crystalAccount.findUnique({ where: { telegramUserId } });
        if (!account) {
          account = await this.prisma.crystalAccount.create({
            data: { telegramUserId, balance: 0 },
          });
        }

        const newBalance = account.balance + amountInt;
        await this.prisma.crystalAccount.update({
          where: { telegramUserId },
          data: {
            balance: newBalance,
            lifetimeEarned: account.lifetimeEarned + amountInt,
          },
        });

        await this.prisma.crystalTransaction.create({
          data: {
            telegramUserId,
            accountId: account.id,
            type: 'EVENT_BONUS',
            amount: amountInt,
            balanceAfter: newBalance,
            reference: ref,
            metadata: { surpriseTier: tier, triggerEvent, reason },
          },
        });
      } catch (err: any) {
        this.logger.warn(`[SurpriseEngine] Crystal credit transaction failed: ${err.message}`);
      }
    }

    // 6. Log Growth Audit Event
    await this.growthEventService.publish({
      telegramUserId,
      eventType: GrowthEventType.SURPRISE_REWARD_GRANTED,
      payload: { tier, assetCode: targetAsset, amount: targetAmount, triggerEvent, reason },
    });

    this.logger.log(`[SurpriseEngine] Issued ${tier} surprise drop (+${targetAmount} ${targetAsset}) to user ${telegramUserId} for ${triggerEvent}`);

    return {
      granted: true,
      tier,
      assetCode: targetAsset,
      amount: targetAmount,
      reason,
    };
  }
  async createReward(data: {
    telegramUserId: bigint;
    rewardType: RewardType;
    amount: string;
    ruleCode?: string;
    reference: string;
    metadata?: Record<string, unknown>;
  }) {
    const existing = await this.prisma.reward.findUnique({
      where: { reference: data.reference },
    });

    if (existing) {
      return existing;
    }

    let ruleId: string | undefined;
    if (data.ruleCode) {
      const rule = await this.prisma.rewardRule.findUnique({
        where: { code: data.ruleCode },
      });
      if (rule) ruleId = rule.id;
    }

    const reward = await this.prisma.reward.create({
      data: {
        telegramUserId: data.telegramUserId,
        ruleId,
        rewardType: data.rewardType,
        amount: data.amount,
        assetCode: 'USDT',
        status: RewardStatus.AVAILABLE,
        reference: data.reference,
        metadata: (data.metadata as Prisma.InputJsonValue) || {},
      },
    });

    this.logger.log(`[RewardService] Created AVAILABLE reward ${reward.id} (${data.amount} USDT) for user ${data.telegramUserId}`);
    return reward;
  }

  // ============================================================
  // ELIGIBILITY ENGINE (real counters only)
  // ============================================================

  /**
   * Compute the requirement snapshot for a reward rule from real user activity.
   */
  async evaluateRuleEligibility(
    telegramUserId: bigint,
    rule: { rewardType: RewardType; parameters: Prisma.JsonValue; id?: string },
  ): Promise<RewardEligibility> {
    const params = (rule.parameters as Record<string, any>) || {};
    const requirementType = params.requirementType || (rule.rewardType === RewardType.REFERRAL ? 'REFERRAL_QUALIFIED' : 'SETTLEMENT_COUNT');
    const required = Number(params.requirementCount || 1);
    const actionTab = params.actionTab || undefined;

    let label = '';
    let current = 0;
    let unit = '';

    if (requirementType === 'REFERRAL_QUALIFIED') {
      const user = await this.prisma.user.findUnique({
        where: { telegramUserId },
        select: { qualifiedReferrals: true },
      });
      label = 'Qualified referral';
      unit = 'qualified referral(s)';
      current = user?.qualifiedReferrals ?? 0;
    } else if (requirementType === 'REFERRAL_PAYING') {
      const user = await this.prisma.user.findUnique({
        where: { telegramUserId },
        select: { payingReferrals: true },
      });
      label = 'Paying referral';
      unit = 'paying referral(s)';
      current = user?.payingReferrals ?? 0;
    } else if (requirementType === 'REFERRAL_COUNT') {
      const count = await this.prisma.referralRelationship.count({
        where: { referrerId: telegramUserId },
      });
      label = 'Invited friend';
      unit = 'friend(s)';
      current = count;
    } else if (requirementType === 'SETTLEMENT_COUNT') {
      const count = await this.prisma.settlementSession.count({
        where: { telegramUserId, status: 'COMPLETED' },
      });
      label = 'Completed settlement';
      unit = 'settlement(s)';
      current = count;
    } else if (requirementType === 'MACHINE_CAPACITY') {
      const aggregate = await this.prisma.userMachine.aggregate({
        where: { telegramUserId, status: 'ACTIVE' },
        _sum: { capacityGhs: true },
      });
      label = 'Active mining capacity';
      unit = 'GH/s';
      current = Math.floor(Number(aggregate._sum.capacityGhs || 0));
    } else if (requirementType === 'USER_LEVEL') {
      const level = await this.prisma.userLevelRecord.findUnique({
        where: { telegramUserId },
        select: { currentLevel: true },
      });
      const tier = level?.currentLevel || 'NEW';
      label = 'User level';
      unit = 'level';
      current = LEVEL_ORDER[tier] ?? 0;
    } else if (requirementType === 'TAP_COUNT') {
      const miningState = await this.prisma.userMiningState.findUnique({
        where: { telegramUserId },
        select: { lifetimePromotionalOutput: true, interactivePromotionalOutput: true },
      });
      label = 'Cooler tap';
      unit = 'tap(s)';
      current = Math.floor(Number(miningState?.interactivePromotionalOutput || miningState?.lifetimePromotionalOutput || 0) * 50);
    } else if (requirementType === 'DAILY_LOGIN' || requirementType === 'DAILY_STREAK') {
      const streakInfo = await this.achievementService.getClaimStreakInfo(telegramUserId);
      label = 'Daily login streak';
      unit = 'day(s)';
      current = streakInfo.current || 1;
    } else if (requirementType === 'BALANCE_ACCUMULATED') {
      const volumeAggregate = await this.prisma.settlementSession.aggregate({
        where: { telegramUserId, status: 'COMPLETED' },
        _sum: { expectedCryptoAmount: true },
      });
      label = 'Accumulated volume';
      unit = 'USDT';
      current = Number(volumeAggregate._sum.expectedCryptoAmount || 0);
    } else if (requirementType === 'GAME_SPINS') {
      const spins = await this.prisma.achievement.findUnique({
        where: { telegramUserId_code: { telegramUserId, code: 'GAME_SPINS' } },
      });
      label = 'Game spin';
      unit = 'spin(s)';
      current = spins?.progress ?? 0;
    } else if (requirementType === 'GAME_SCORE') {
      const score = await this.prisma.achievement.findUnique({
        where: { telegramUserId_code: { telegramUserId, code: 'GAME_HOOPS' } },
      });
      label = 'Hoop score';
      unit = 'point(s)';
      current = score?.progress ?? 0;
    } else {
      label = params.label || 'Requirement';
      current = Number(params.current ?? 0);
      unit = params.unit || '';
    }

    const completed = current >= required;

    return {
      eligible: completed,
      requirement: { key: requirementType, label, required, current, unit, completed, actionTab },
      reason: this.buildReason(label, required, current, unit, completed, rule.rewardType),
    };
  }

  private buildReason(label: string, required: number, current: number, unit: string, completed: boolean, rewardType: RewardType): string {
    if (rewardType === RewardType.REFERRAL) {
      return completed
        ? 'You have a qualified referral — reward unlocked.'
        : 'Your friend must join, complete onboarding and settle before this unlocks.';
    }
    if (completed) {
      return `Requirement met: ${current} ${unit} of ${required} required.`;
    }
    return `${Math.max(0, required - current)} more ${unit} needed to unlock (${current}/${required}).`;
  }

  /**
   * Evaluate eligibility of an existing reward record (rule-based + referral checks).
   */
  async evaluateRewardEligibility(telegramUserId: bigint, reward: { id: string; rewardType: RewardType; ruleId: string | null }): Promise<RewardEligibility> {
    if (reward.rewardType === RewardType.REFERRAL) {
      const relationshipId = (await this.prisma.reward.findUnique({ where: { id: reward.id }, select: { metadata: true } }))?.metadata as any;
      const relId = relationshipId?.relationshipId as string | undefined;
      if (relId) {
        const relationship = await this.prisma.referralRelationship.findUnique({
          where: { id: relId },
          select: { status: true, qualifiedAt: true },
        });
        if (!relationship) {
          return { eligible: false, requirement: null, reason: 'Referral record no longer exists.' };
        }
        const stillQualified =
          relationship.status === ReferralStatus.QUALIFIED ||
          relationship.status === ReferralStatus.PAYING;
        return {
          eligible: stillQualified,
          requirement: {
            key: 'REFERRAL_QUALIFIED',
            label: 'Qualified referral',
            required: 1,
            current: stillQualified ? 1 : 0,
            unit: 'qualified referral(s)',
            completed: stillQualified,
            actionTab: 'friends',
          },
          reason: stillQualified
            ? 'Your friend completed onboarding and their first settlement — reward unlocked.'
            : 'This referral no longer qualifies.',
        };
      }
      // No relationship attached — fall back to the rule engine
      const rule = reward.ruleId
        ? await this.prisma.rewardRule.findUnique({ where: { id: reward.ruleId } })
        : null;
      if (rule) return this.evaluateRuleEligibility(telegramUserId, rule);
      return { eligible: true, requirement: null, reason: 'Referral reward unlocked.' };
    }

    if (reward.ruleId) {
      const rule = await this.prisma.rewardRule.findUnique({ where: { id: reward.ruleId } });
      if (rule) return this.evaluateRuleEligibility(telegramUserId, rule);
    }
    return { eligible: true, requirement: null, reason: 'Reward unlocked.' };
  }

  // ============================================================
  // RECONCILIATION — keep the queue aligned with the real engine
  // ============================================================

  /**
   * Expire rewards whose rule carries an expiresInDays window.
   */
  private async expireOverdueRewards(telegramUserId: bigint) {
    const active = await this.prisma.reward.findMany({
      where: { telegramUserId, status: { in: [RewardStatus.AVAILABLE, RewardStatus.IN_PROGRESS] } },
      include: { rule: true },
    });
    const now = Date.now();
    for (const rw of active) {
      const expiresInDays = Number((rw.rule?.parameters as any)?.expiresInDays || 0);
      if (expiresInDays > 0 && now - rw.createdAt.getTime() > expiresInDays * 86400000) {
        await this.prisma.reward.update({
          where: { id: rw.id },
          data: { status: RewardStatus.EXPIRED },
        });
        this.logger.log(`[RewardService] Expired reward ${rw.id} for user ${telegramUserId}`);
      }
    }
  }

  /**
   * Ensure every qualified-but-unrewarded referral relationship has an
   * AVAILABLE reward in the queue (idempotent by unique reference).
   */
  private async reconcileReferralRewards(telegramUserId: bigint) {
    const rule = await this.prisma.rewardRule.findUnique({
      where: { code: 'REFERRAL_DEFAULT_5USDT' },
    });

    const relationships = await this.prisma.referralRelationship.findMany({
      where: { referrerId: telegramUserId, status: { in: [ReferralStatus.QUALIFIED, ReferralStatus.PAYING] } },
      select: {
        id: true,
        referee: { select: { firstName: true, telegramUsername: true } },
      },
    });

    for (const rel of relationships) {
      const refereeName = rel.referee.firstName || rel.referee.telegramUsername || 'Your Friend';
      await this.createReward({
        telegramUserId,
        rewardType: RewardType.REFERRAL,
        amount: rule ? rule.amount.toString() : '5.000000',
        ruleCode: rule ? rule.code : undefined,
        reference: `ref_qual_${rel.id}`,
        metadata: {
          relationshipId: rel.id,
          refereeName,
          rewardFor: refereeName,
        },
      });
    }
  }

  /**
   * Ensure each enabled non-referral rule has an AVAILABLE reward once the
   * user meets its requirement (idempotent by unique reference).
   */
  private async reconcileRuleRewards(telegramUserId: bigint) {
    const rules = await this.prisma.rewardRule.findMany({
      where: { enabled: true },
    });

    for (const rule of rules) {
      if (rule.rewardType === RewardType.REFERRAL) continue;

      const existing = await this.prisma.reward.findFirst({
        where: {
          telegramUserId,
          ruleId: rule.id,
          status: { in: [RewardStatus.AVAILABLE, RewardStatus.IN_PROGRESS, RewardStatus.CLAIM_PENDING, RewardStatus.CLAIMED] },
        },
      });
      if (existing) continue;

      const { eligible } = await this.evaluateRuleEligibility(telegramUserId, rule);
      if (eligible) {
        await this.createReward({
          telegramUserId,
          rewardType: rule.rewardType,
          amount: rule.amount.toString(),
          ruleCode: rule.code,
          reference: `rule_${rule.code}_${telegramUserId}`,
          metadata: { ruleCode: rule.code },
        });
      }
    }
  }

  // ============================================================
  // QUEUE & HISTORY
  // ============================================================

  /**
   * The claim queue: rewards that are active, user-eligible, not completed,
   * not expired and not already claimed — with progress attached.
   */
  async getAvailableRewards(telegramUserId: bigint) {
    const missions = await this.getMissionQueue(telegramUserId);
    return missions.filter((m) => m.eligible);
  }

  /**
   * The mission queue backing the Progress Center: every claimable reward
   * PLUS rules the user is actively working toward (progress > 0), each
   * annotated with category, difficulty, progress and estimated remaining.
   * Claimable missions are always sorted first.
   */
  async getMissionQueue(telegramUserId: bigint) {
    await this.expireOverdueRewards(telegramUserId);
    await this.reconcileReferralRewards(telegramUserId);
    await this.reconcileRuleRewards(telegramUserId);

    const rewards = await this.prisma.reward.findMany({
      where: {
        telegramUserId,
        status: { in: [RewardStatus.AVAILABLE, RewardStatus.IN_PROGRESS, RewardStatus.CLAIM_PENDING] },
      },
      include: { rule: true },
      orderBy: { createdAt: 'asc' },
    });

    const queue: any[] = [];
    for (const rw of rewards) {
      const eligibility = await this.evaluateRewardEligibility(telegramUserId, rw);
      if (!eligibility.eligible) continue;
      queue.push(this.toMissionCard(rw, eligibility));
    }

    // In-progress missions: enabled non-referral rules with progress but no
    // reward row yet — show them so the runner can guide completion.
    const rules = await this.prisma.rewardRule.findMany({ where: { enabled: true } });
    for (const rule of rules) {
      if (rule.rewardType === RewardType.REFERRAL) continue;
      const existing = await this.prisma.reward.findFirst({
        where: {
          telegramUserId,
          ruleId: rule.id,
          status: { in: [RewardStatus.AVAILABLE, RewardStatus.IN_PROGRESS, RewardStatus.CLAIM_PENDING, RewardStatus.CLAIMED] },
        },
      });
      if (existing) continue;

      const eligibility = await this.evaluateRuleEligibility(telegramUserId, rule);
      if (eligibility.eligible) continue;
      if ((eligibility.requirement?.current || 0) <= 0) continue;

      queue.push({
        id: `rule:${rule.id}`,
        ruleCode: rule.code,
        rewardType: rule.rewardType,
        amount: rule.amount.toString(),
        assetCode: 'USDT',
        status: 'IN_PROGRESS',
        ruleName: rule.name,
        description: (rule.parameters as any)?.description || rule.name,
        requirement: eligibility.requirement,
        reason: eligibility.reason,
        eligible: false,
        ...this.missionMeta(eligibility.requirement, rule),
      });
    }

    return queue.sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
      return (b.progressPercent || 0) - (a.progressPercent || 0);
    });
  }

  /**
   * Category / difficulty / progress / estimated-remaining annotations.
   */
  private missionMeta(
    requirement: RequirementSnapshot | null,
    rule?: { rewardType?: RewardType; parameters?: Prisma.JsonValue },
  ) {
    const params = (rule?.parameters as Record<string, any>) || {};
    const key = requirement?.key || '';
    const required = requirement?.required || 1;
    const current = requirement?.current || 0;
    const progressPercent = required > 0 ? Math.min(100, Math.floor((current / required) * 100)) : 0;
    const remaining = Math.max(0, required - current);

    let category: string;
    if (key.startsWith('REFERRAL')) category = 'referral';
    else if (key === 'SETTLEMENT_COUNT') category = 'settlement';
    else if (key === 'MACHINE_CAPACITY') category = 'machine';
    else if (key === 'USER_LEVEL') category = 'profile';
    else category = params.category || 'campaign';

    const difficulty = params.difficulty || (required <= 1 ? 'EASY' : required <= 3 ? 'MEDIUM' : 'HARD');

    const estimatedRemaining = current >= required
      ? 'Claim now'
      : `${remaining} more ${requirement?.unit || 'step(s)'} needed`;

    return {
      category,
      difficulty,
      progressPercent,
      estimatedRemaining,
    };
  }

  private toMissionCard(rw: any, eligibility: RewardEligibility) {
    return {
      id: rw.id,
      ruleCode: rw.rule?.code || null,
      rewardType: rw.rewardType,
      amount: rw.amount.toString(),
      assetCode: rw.assetCode,
      status: rw.status,
      reference: rw.reference,
      createdAt: rw.createdAt,
      ruleName: rw.rule?.name || this.defaultRewardName(rw.rewardType),
      description:
        (rw.rule?.parameters as any)?.description ||
        this.defaultRewardName(rw.rewardType),
      requirement: eligibility.requirement,
      reason: eligibility.reason,
      eligible: true,
      ...this.missionMeta(eligibility.requirement, rw.rule),
    };
  }

  /**
   * Claimed / expired rewards for the history screen.
   */
  async getRewardHistory(telegramUserId: bigint) {
    const rewards = await this.prisma.reward.findMany({
      where: { telegramUserId, status: { in: [RewardStatus.CLAIMED, RewardStatus.EXPIRED] } },
      include: { rule: true },
      orderBy: [{ processedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return rewards.map((rw) => ({
      id: rw.id,
      rewardType: rw.rewardType,
      amount: rw.amount.toString(),
      assetCode: rw.assetCode,
      status: rw.status,
      reference: rw.reference,
      createdAt: rw.createdAt,
      claimedAt: rw.processedAt || rw.createdAt,
      transactionReference: rw.operationId || `ref_reward_${rw.id}`,
      ruleName: rw.rule?.name || this.defaultRewardName(rw.rewardType),
      description: (rw.rule?.parameters as any)?.description || this.defaultRewardName(rw.rewardType),
    }));
  }

  /**
   * Detail view for the claim experience page.
   */
  async getRewardDetail(telegramUserId: bigint, rewardId: string) {
    const reward = await this.prisma.reward.findUnique({
      where: { id: rewardId },
      include: { rule: true },
    });
    if (!reward) throw new NotFoundException({ code: 'REWARD_NOT_FOUND', message: `Reward ${rewardId} not found` });
    if (reward.telegramUserId !== telegramUserId) {
      throw new ForbiddenException({ code: 'REWARD_FORBIDDEN', message: 'This reward belongs to another user' });
    }

    const eligibility = await this.evaluateRewardEligibility(telegramUserId, reward);

    return {
      id: reward.id,
      rewardType: reward.rewardType,
      amount: reward.amount.toString(),
      assetCode: reward.assetCode,
      status: reward.status,
      reference: reward.reference,
      createdAt: reward.createdAt,
      ruleName: reward.rule?.name || this.defaultRewardName(reward.rewardType),
      description:
        (reward.rule?.parameters as any)?.description || this.defaultRewardName(reward.rewardType),
      requirement: eligibility.requirement,
      reason: eligibility.reason,
      eligible: eligibility.eligible,
    };
  }

  private defaultRewardName(type: RewardType): string {
    switch (type) {
      case RewardType.REFERRAL: return 'Referral Reward';
      case RewardType.MILESTONE: return 'Milestone Reward';
      case RewardType.LOYALTY: return 'Loyalty Reward';
      case RewardType.CAMPAIGN: return 'Campaign Reward';
      default: return 'Reward';
    }
  }

  // ============================================================
  // CLAIM — the only path that moves money
  // ============================================================

  /**
   * Validate + disburse + settle a reward. Never remove a card until the
   * ledger entry is confirmed.
   */
  async claimReward(telegramUserId: bigint, rewardId: string) {
    const reward = await this.prisma.reward.findUnique({
      where: { id: rewardId },
    });

    if (!reward) throw new NotFoundException({ code: 'REWARD_NOT_FOUND', message: 'Reward not found' });
    if (reward.telegramUserId !== telegramUserId) {
      throw new ForbiddenException({ code: 'REWARD_FORBIDDEN', message: 'This reward belongs to another user' });
    }
    if (reward.status === RewardStatus.CLAIMED) {
      throw new BadRequestException({ code: 'REWARD_ALREADY_CLAIMED', message: 'This reward has already been claimed.' });
    }
    if (reward.status === RewardStatus.EXPIRED) {
      throw new BadRequestException({ code: 'REWARD_EXPIRED', message: 'This reward has expired.' });
    }
    if (reward.status === RewardStatus.CLAIM_PENDING) {
      throw new BadRequestException({ code: 'REWARD_CLAIM_IN_PROGRESS', message: 'This reward is already being processed. Please wait.' });
    }
    if (reward.status !== RewardStatus.AVAILABLE && reward.status !== RewardStatus.IN_PROGRESS) {
      throw new BadRequestException({ code: 'REWARD_NOT_CLAIMABLE', message: 'This reward cannot be claimed right now.' });
    }

    // Rule still active?
    if (reward.ruleId) {
      const rule = await this.prisma.rewardRule.findUnique({ where: { id: reward.ruleId } });
      if (rule && !rule.enabled) {
        throw new BadRequestException({ code: 'REWARD_RULE_DISABLED', message: 'This reward campaign is no longer active.' });
      }
    }

    // Re-validate real eligibility — only the backend can approve.
    const eligibility = await this.evaluateRewardEligibility(telegramUserId, reward);
    if (!eligibility.eligible) {
      throw new BadRequestException({ code: 'REWARD_REQUIREMENTS_INCOMPLETE', message: eligibility.reason });
    }

    // Referral rewards: the relationship must still be qualified and unrewarded.
    const metadata = (reward.metadata as Record<string, any>) || {};
    let relationshipId: string | undefined;
    if (reward.rewardType === RewardType.REFERRAL && metadata.relationshipId) {
      relationshipId = metadata.relationshipId as string;
      const relationship = await this.prisma.referralRelationship.findUnique({
        where: { id: relationshipId },
        select: { status: true, rewardedAt: true },
      });
      if (!relationship) {
        throw new BadRequestException({ code: 'REWARD_NOT_FOUND', message: 'Referral record no longer exists.' });
      }
      if (relationship.status === ReferralStatus.REWARDED) {
        throw new BadRequestException({ code: 'REWARD_ALREADY_CLAIMED', message: 'This referral reward has already been claimed.' });
      }
    }

    // Atomic guard: only one claim can flip the status, even under concurrency.
    const guard = await this.prisma.reward.updateMany({
      where: { id: rewardId, status: { in: [RewardStatus.AVAILABLE, RewardStatus.IN_PROGRESS] } },
      data: { status: RewardStatus.CLAIM_PENDING },
    });
    if (guard.count === 0) {
      throw new BadRequestException({ code: 'REWARD_ALREADY_CLAIMED', message: 'This reward has already been claimed.' });
    }

    try {
      // Reward Service -> Ledger Entry (orchestrator posts balanced ledger group) -> Wallet (derived)
      const operationResult: any = await this.orchestrator.requestOperation({
        telegramUserId: reward.telegramUserId,
        operationType: 'SYSTEM_ALLOCATION',
        assetCode: reward.assetCode,
        amount: reward.amount.toString(),
        idempotencyKey: `reward_${reward.id}`,
        reference: `ref_reward_${reward.id}`,
        metadata: {
          rewardId: reward.id,
          rewardType: reward.rewardType,
          originalReference: reward.reference,
        },
      });

      // Referral chain: mark relationship REWARDED + link the reward.
      if (relationshipId) {
        try {
          await this.referralService.markRewarded(relationshipId, reward.id);
        } catch (err: any) {
          this.logger.warn(`[RewardService] markRewarded failed for ${relationshipId}: ${err.message}`);
        }
      }

      // Reward Status Update
      const claimed = await this.prisma.reward.update({
        where: { id: reward.id },
        data: {
          status: RewardStatus.CLAIMED,
          operationId: operationResult?.id || null,
          processedAt: new Date(),
        },
      });

      await this.growthEventService.publish({
        telegramUserId: reward.telegramUserId,
        eventType: GrowthEventType.REWARD_GRANTED,
        payload: {
          rewardId: reward.id,
          amount: reward.amount.toString(),
          assetCode: reward.assetCode,
          rewardType: reward.rewardType,
          operationId: operationResult?.id,
        },
      });

      // Server-side Trust Profile Safety Score +2 increment (audit event & single claim increment)
      try {
        const profile = await this.prisma.userTrustProfile.findUnique({ where: { telegramUserId: reward.telegramUserId } });
        if (profile) {
          const newScore = Math.min(100, profile.trustScore + 2);
          await this.prisma.userTrustProfile.update({
            where: { telegramUserId: reward.telegramUserId },
            data: { trustScore: newScore },
          });
          await this.prisma.trustEvent.create({
            data: {
              profileId: profile.id,
              telegramUserId: reward.telegramUserId,
              scoreDelta: 2,
              newScore,
              reason: `Reward Claim Bonus: ${reward.id}`,
            },
          });
        }
      } catch (err: any) {
        this.logger.warn(`[RewardService] Safety score bump failed after claim ${reward.id}: ${err.message}`);
      }

      try {
        await this.notificationService.sendNotification({
          telegramUserId: reward.telegramUserId,
          templateCode: 'REWARD_EARNED',
          variables: {
            amount: reward.amount.toString(),
            asset: reward.assetCode,
          },
        });
      } catch (err: any) {
        this.logger.warn(`[RewardService] Notification failed after claim ${reward.id}: ${err.message}`);
      }
      try {
        await this.achievementService.reconcileAchievements(reward.telegramUserId);
      } catch (err: any) {
        this.logger.warn(`[RewardService] Achievement reconcile failed after claim ${reward.id}: ${err.message}`);
      }

      this.logger.log(`[RewardService] Reward ${reward.id} CLAIMED & disbursed via Orchestrator`);
      return {
        id: claimed.id,
        rewardType: claimed.rewardType,
        amount: claimed.amount.toString(),
        assetCode: claimed.assetCode,
        status: claimed.status,
        reference: claimed.reference,
        operationId: claimed.operationId,
        processedAt: claimed.processedAt,
      };
    } catch (err: any) {
      this.logger.error(`[RewardService] Failed to disburse reward ${rewardId}: ${err.message}`, err.stack);
      // Never remove the card: revert to claimable on failure.
      await this.prisma.reward
        .update({
          where: { id: rewardId },
          data: { status: RewardStatus.AVAILABLE },
        })
        .catch(() => undefined);
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException({ code: 'REWARD_CLAIM_FAILED', message: 'Claim failed. Please try again.' });
    }
  }

  /**
   * Admin approval path — reuses the same ledger + status logic.
   */
  async approveAndDisburseReward(rewardId: string) {
    const reward = await this.prisma.reward.findUnique({ where: { id: rewardId } });
    if (!reward) throw new NotFoundException(`Reward ${rewardId} not found`);
    if (reward.status === RewardStatus.CLAIMED) return reward;
    if (reward.status === RewardStatus.EXPIRED) {
      throw new BadRequestException(`Cannot process expired reward ${rewardId}`);
    }
    if (reward.status === RewardStatus.CLAIM_PENDING) {
      throw new BadRequestException(`Reward ${rewardId} is already being processed`);
    }

    await this.prisma.reward.update({
      where: { id: rewardId },
      data: { status: RewardStatus.CLAIM_PENDING },
    });

    try {
      const operationResult: any = await this.orchestrator.requestOperation({
        telegramUserId: reward.telegramUserId,
        operationType: 'SYSTEM_ALLOCATION',
        assetCode: reward.assetCode,
        amount: reward.amount.toString(),
        idempotencyKey: `reward_${reward.id}`,
        reference: `ref_reward_${reward.id}`,
        metadata: {
          rewardId: reward.id,
          rewardType: reward.rewardType,
          originalReference: reward.reference,
        },
      });

      const processed = await this.prisma.reward.update({
        where: { id: rewardId },
        data: {
          status: RewardStatus.CLAIMED,
          operationId: (operationResult as any)?.id || null,
          processedAt: new Date(),
        },
      });

      this.logger.log(`[RewardService] Reward ${reward.id} CLAIMED (admin) & disbursed via Orchestrator`);
      return processed;
    } catch (err: any) {
      this.logger.error(`[RewardService] Admin disbursement failed for ${rewardId}: ${err.message}`, err.stack);
      await this.prisma.reward
        .update({ where: { id: rewardId }, data: { status: RewardStatus.AVAILABLE } })
        .catch(() => undefined);
      throw err;
    }
  }

  /**
   * Get user rewards list.
   */
  async getUserRewards(telegramUserId: bigint) {
    return this.prisma.reward.findMany({
      where: { telegramUserId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all rewards (for Admin management).
   */
  async getAllRewards(status?: RewardStatus) {
    return this.prisma.reward.findMany({
      where: status ? { status } : undefined,
      include: {
        user: {
          select: {
            telegramUserId: true,
            firstName: true,
            telegramUsername: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
