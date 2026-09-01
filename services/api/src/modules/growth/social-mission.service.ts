import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma, SocialMissionTier, SocialParticipationStatus, RewardType, RewardStatus, CrystalTransactionType } from '@prisma/client';
import { RewardService } from './reward.service';
import { GrowthContributionService } from './growth-contribution.service';

export interface UserValueBankSummary {
  totalValueGeneratedUsdt: number;
  unlockedRewardsUsdt: number;
  retainedContributionUsdt: number;
  activeMissionsCount: number;
  completedMissionsCount: number;
  totalCrystalsEarned: number;
}

@Injectable()
export class SocialMissionService {
  private readonly logger = new Logger(SocialMissionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rewardService: RewardService,
    private readonly contributionService: GrowthContributionService,
  ) {}

  /**
   * Seed default social missions spanning all 4 tiers:
   * Level 1 (Engagement) -> Level 2 (Distribution) -> Level 3 (Acquisition) -> Level 4 (Revenue)
   */
  async ensureDefaultSocialMissions() {
    const defaultMissions = [
      {
        code: 'SOCIAL_JOIN_TG',
        name: 'Join Official Titan Telegram',
        description: 'Join the global Titan Stream community for instant rate updates and announcements.',
        tier: SocialMissionTier.ENGAGEMENT,
        channel: 'TELEGRAM',
        category: 'social',
        virtualRewardCrystals: 250,
        virtualRewardXp: 100,
        maxRewardUsdt: new Prisma.Decimal(0),
        requiredContributionUsdt: new Prisma.Decimal(0),
        rewardRate: new Prisma.Decimal(0),
        platformMarginBufferUsdt: new Prisma.Decimal(0),
        requiredActionCount: 1,
        actionType: 'JOIN_COMMUNITY',
        parameters: { actionUrl: 'https://t.me/TitanStreamGlobal', badge: 'Community' },
      },
      {
        code: 'SOCIAL_SHARE_CIRCLE',
        name: 'Activate Your Circle',
        description: 'Share your Titan link with your close network. Earn Crystals instantly, plus 2 USDT when your circle generates verified settlement liquidity.',
        tier: SocialMissionTier.DISTRIBUTION,
        channel: 'ALL',
        category: 'distribution',
        virtualRewardCrystals: 500,
        virtualRewardXp: 250,
        maxRewardUsdt: new Prisma.Decimal(2.0),
        requiredContributionUsdt: new Prisma.Decimal(10.0),
        rewardRate: new Prisma.Decimal(0.20),
        platformMarginBufferUsdt: new Prisma.Decimal(8.0),
        requiredActionCount: 3,
        actionType: 'SHARE',
        parameters: { targetReferrals: 3, badge: 'Distribution' },
      },
      {
        code: 'SOCIAL_ACTIVATE_TRADERS',
        name: 'Liquidity Pioneer',
        description: 'Bring active partners who complete settlements. Unlock up to 5 USDT when your attributed network generates $25 verified contribution.',
        tier: SocialMissionTier.REVENUE,
        channel: 'WHATSAPP',
        category: 'revenue',
        virtualRewardCrystals: 1500,
        virtualRewardXp: 1000,
        maxRewardUsdt: new Prisma.Decimal(5.0),
        requiredContributionUsdt: new Prisma.Decimal(25.0),
        rewardRate: new Prisma.Decimal(0.20),
        platformMarginBufferUsdt: new Prisma.Decimal(20.0),
        requiredActionCount: 3,
        actionType: 'REFERRAL_SETTLEMENT',
        parameters: { targetQualified: 3, badge: 'High Yield' },
      },
      {
        code: 'SOCIAL_COMMUNITY_LEADER',
        name: 'Titan Community Leader',
        description: 'Host or expand a regional growth hub. Unlock 10 USDT when your network generates $50 in verified platform margin.',
        tier: SocialMissionTier.REVENUE,
        channel: 'TELEGRAM',
        category: 'revenue',
        virtualRewardCrystals: 5000,
        virtualRewardXp: 3000,
        maxRewardUsdt: new Prisma.Decimal(10.0),
        requiredContributionUsdt: new Prisma.Decimal(50.0),
        rewardRate: new Prisma.Decimal(0.20),
        platformMarginBufferUsdt: new Prisma.Decimal(40.0),
        requiredActionCount: 5,
        actionType: 'GROWTH_HUB',
        parameters: { targetQualified: 5, badge: 'VIP Tier' },
      },
    ];

    for (const m of defaultMissions) {
      await this.prisma.socialMission.upsert({
        where: { code: m.code },
        update: {
          name: m.name,
          description: m.description,
          tier: m.tier,
          channel: m.channel,
          category: m.category,
          virtualRewardCrystals: m.virtualRewardCrystals,
          virtualRewardXp: m.virtualRewardXp,
          maxRewardUsdt: m.maxRewardUsdt,
          requiredContributionUsdt: m.requiredContributionUsdt,
          rewardRate: m.rewardRate,
          platformMarginBufferUsdt: m.platformMarginBufferUsdt,
          requiredActionCount: m.requiredActionCount,
          actionType: m.actionType,
          parameters: m.parameters,
          enabled: true,
        },
        create: {
          ...m,
          enabled: true,
        },
      });
    }
  }

  /**
   * Get user social missions with real-time participation & over-settlement state.
   */
  async getSocialMissions(telegramUserId: bigint) {
    await this.ensureDefaultSocialMissions();

    const missions = await this.prisma.socialMission.findMany({
      where: { enabled: true },
      orderBy: [{ tier: 'asc' }, { createdAt: 'asc' }],
    });

    const participations = await this.prisma.socialMissionParticipation.findMany({
      where: { telegramUserId },
      include: { attributions: true },
    });

    const participationMap = new Map(participations.map((p) => [p.socialMissionId, p]));

    return missions.map((mission) => {
      const p = participationMap.get(mission.id);
      const trackingCode = p?.trackingCode || `TSG-${mission.code.slice(0, 4)}-${telegramUserId.toString().slice(-4)}`;
      const verifiedContribution = Number(p?.verifiedContributionUsdt || 0);
      const requiredContribution = Number(mission.requiredContributionUsdt || 0);
      const maxReward = Number(mission.maxRewardUsdt || 0);

      // Over-settlement calculation
      const isOverSettled = requiredContribution > 0
        ? verifiedContribution >= requiredContribution
        : (p?.currentActionCount || 0) >= mission.requiredActionCount;

      const progressPct = requiredContribution > 0
        ? Math.min(100, Math.round((verifiedContribution / Math.max(1, requiredContribution)) * 100))
        : Math.min(100, Math.round(((p?.currentActionCount || 0) / Math.max(1, mission.requiredActionCount)) * 100));

      const status = p?.status || SocialParticipationStatus.TRACKING;

      return {
        id: mission.id,
        code: mission.code,
        name: mission.name,
        description: mission.description,
        tier: mission.tier,
        category: mission.category,
        channel: mission.channel,
        virtualRewardCrystals: mission.virtualRewardCrystals,
        virtualRewardXp: mission.virtualRewardXp,
        maxRewardUsdt: maxReward,
        requiredContributionUsdt: requiredContribution,
        verifiedContributionUsdt: verifiedContribution,
        rewardRate: Number(mission.rewardRate),
        platformMarginBufferUsdt: Number(mission.platformMarginBufferUsdt),
        progressPercent: progressPct,
        status,
        isOverSettled,
        isEligible: status === SocialParticipationStatus.ELIGIBLE || (isOverSettled && status !== SocialParticipationStatus.CLAIMED),
        isClaimed: status === SocialParticipationStatus.CLAIMED,
        virtualRewardsClaimed: p?.virtualRewardsClaimed || false,
        trackingCode,
        attributedActionsCount: p?.currentActionCount || 0,
        parameters: mission.parameters,
      };
    });
  }

  /**
   * Enroll user in a social mission & generate deterministic tracking identity.
   */
  async participateInMission(telegramUserId: bigint, missionId: string) {
    const mission = await this.prisma.socialMission.findFirst({
      where: { OR: [{ id: missionId }, { code: missionId }], enabled: true },
    });

    if (!mission) {
      throw new NotFoundException(`Social mission ${missionId} not found`);
    }

    const existing = await this.prisma.socialMissionParticipation.findUnique({
      where: {
        socialMissionId_telegramUserId: {
          socialMissionId: mission.id,
          telegramUserId,
        },
      },
    });

    if (existing) {
      return existing;
    }

    const salt = Math.random().toString(36).substring(2, 6).toUpperCase();
    const trackingCode = `TSG-${mission.code.slice(0, 4)}-${telegramUserId.toString().slice(-4)}${salt}`;

    return this.prisma.socialMissionParticipation.create({
      data: {
        socialMissionId: mission.id,
        telegramUserId,
        trackingCode,
        status: SocialParticipationStatus.TRACKING,
      },
    });
  }

  /**
   * Claim virtual reward (Crystals / XP) upon direct social engagement.
   * Isolates Economy A from Economy B (zero USDT liability).
   */
  async claimVirtualReward(telegramUserId: bigint, missionId: string) {
    const mission = await this.prisma.socialMission.findFirst({
      where: { OR: [{ id: missionId }, { code: missionId }] },
    });
    if (!mission) throw new NotFoundException('Mission not found');

    const participation = await this.participateInMission(telegramUserId, mission.id);
    if (participation.virtualRewardsClaimed) {
      return { success: true, alreadyClaimed: true, crystals: 0 };
    }

    const ref = `social_mission_virtual_${participation.id}_${telegramUserId}`;
    const txRunner = typeof this.prisma.$transaction === 'function'
      ? this.prisma.$transaction.bind(this.prisma)
      : async (fn: any) => fn(this.prisma);

    await txRunner(async (tx: any) => {
      if (mission.virtualRewardCrystals > 0 && tx.crystalAccount) {
        let account = await tx.crystalAccount.findUnique({ where: { telegramUserId } });
        if (!account) {
          account = await tx.crystalAccount.create({
            data: { telegramUserId, balance: 100 },
          });
        }

        const updated = await tx.crystalAccount.update({
          where: { id: account.id },
          data: {
            balance: { increment: mission.virtualRewardCrystals },
            lifetimeEarned: { increment: mission.virtualRewardCrystals },
          },
        });

        if (tx.crystalTransaction) {
          await tx.crystalTransaction.create({
            data: {
              telegramUserId,
              accountId: account.id,
              type: CrystalTransactionType.ACHIEVEMENT,
              amount: mission.virtualRewardCrystals,
              balanceAfter: updated.balance,
              reference: ref,
              metadata: { missionCode: mission.code, missionId: mission.id },
            },
          });
        }
      }

      await tx.socialMissionParticipation.update({
        where: { id: participation.id },
        data: {
          virtualRewardsClaimed: true,
          currentActionCount: { increment: 1 },
        },
      });
    });

    return {
      success: true,
      alreadyClaimed: false,
      crystals: mission.virtualRewardCrystals,
      xp: mission.virtualRewardXp,
    };
  }

  /**
   * Evaluates downstream value produced by attributed referees for a participation.
   * Gated strictly by Over-Settlement:
   * Verified Net Contribution >= Required Contribution AND Margin >= Buffer
   */
  async evaluateOverSettlement(participationId: string) {
    const participation = await this.prisma.socialMissionParticipation.findUnique({
      where: { id: participationId },
      include: { mission: true, attributions: true },
    });

    if (!participation || participation.status === SocialParticipationStatus.CLAIMED) {
      return null;
    }

    const mission = participation.mission;
    const refereeIds = participation.attributions
      .map((a) => a.refereeId)
      .filter((id): id is bigint => id !== null);

    let verifiedNetContribution = new Prisma.Decimal(0);

    if (refereeIds.length > 0) {
      const contributionAggregate = await this.prisma.growthContribution.aggregate({
        where: {
          telegramUserId: { in: refereeIds },
          economicEventType: { in: ['SETTLEMENT_FEE', 'MACHINE_PURCHASE'] },
        },
        _sum: { netContributionUsdt: true },
      });
      verifiedNetContribution = new Prisma.Decimal(contributionAggregate._sum.netContributionUsdt || 0);
    }

    const requiredContribution = mission.requiredContributionUsdt;
    const maxReward = mission.maxRewardUsdt;
    const rate = mission.rewardRate;
    const buffer = mission.platformMarginBufferUsdt;

    // Calculate maximum rewardable value: min(maxReward, verifiedContribution * rate)
    const rawReward = verifiedNetContribution.mul(rate);
    const calculatedReward = rawReward.greaterThan(maxReward) ? maxReward : rawReward;
    const retainedMargin = verifiedNetContribution.minus(calculatedReward);

    const isOverSettled = verifiedNetContribution.greaterThanOrEqualTo(requiredContribution) &&
      retainedMargin.greaterThanOrEqualTo(buffer) &&
      calculatedReward.greaterThan(0);

    const newStatus = isOverSettled
      ? SocialParticipationStatus.ELIGIBLE
      : verifiedNetContribution.greaterThan(0)
        ? SocialParticipationStatus.VALUE_GENERATING
        : SocialParticipationStatus.TRACKING;

    return this.prisma.socialMissionParticipation.update({
      where: { id: participationId },
      data: {
        verifiedContributionUsdt: verifiedNetContribution,
        unlockedRewardUsdt: calculatedReward,
        retainedMarginUsdt: retainedMargin,
        status: newStatus,
      },
    });
  }

  /**
   * User Growth Value Bank Analytical Summary.
   */
  async getUserValueBank(telegramUserId: bigint): Promise<UserValueBankSummary> {
    const participations = await this.prisma.socialMissionParticipation.findMany({
      where: { telegramUserId },
      include: { mission: true },
    });

    let totalGenerated = new Prisma.Decimal(0);
    let totalUnlocked = new Prisma.Decimal(0);
    let totalRetained = new Prisma.Decimal(0);
    let totalCrystals = 0;
    let completedCount = 0;

    for (const p of participations) {
      totalGenerated = totalGenerated.plus(p.verifiedContributionUsdt);
      totalUnlocked = totalUnlocked.plus(p.unlockedRewardUsdt);
      totalRetained = totalRetained.plus(p.retainedMarginUsdt);
      if (p.virtualRewardsClaimed) {
        totalCrystals += p.mission.virtualRewardCrystals;
      }
      if (p.status === SocialParticipationStatus.CLAIMED || p.status === SocialParticipationStatus.ELIGIBLE) {
        completedCount += 1;
      }
    }

    return {
      totalValueGeneratedUsdt: Number(totalGenerated),
      unlockedRewardsUsdt: Number(totalUnlocked),
      retainedContributionUsdt: Number(totalRetained),
      activeMissionsCount: participations.length,
      completedMissionsCount: completedCount,
      totalCrystalsEarned: totalCrystals,
    };
  }
}
