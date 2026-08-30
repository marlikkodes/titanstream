import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';

export interface RecordContributionDto {
  telegramUserId: bigint;
  referralRelationshipId?: string;
  campaignCode?: string;
  growthEventId?: string;
  economicEventType: 'SETTLEMENT_FEE' | 'MACHINE_PURCHASE' | 'REWARD_INCENTIVE' | 'MAINTENANCE_FEE' | 'DEPOSIT_SPREAD';
  economicEventId?: string;
  grossRevenueUsdt: string | number;
  directCostUsdt?: string | number;
  rewardCostUsdt?: string | number;
  fraudProvisionUsdt?: string | number;
}

@Injectable()
export class GrowthContributionService {
  private readonly logger = new Logger(GrowthContributionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Core immutable economic contribution logger.
   */
  async recordContribution(dto: RecordContributionDto) {
    try {
      const gross = new Prisma.Decimal(dto.grossRevenueUsdt || 0);
      const direct = new Prisma.Decimal(dto.directCostUsdt || 0);
      const reward = new Prisma.Decimal(dto.rewardCostUsdt || 0);
      const fraud = new Prisma.Decimal(dto.fraudProvisionUsdt || 0);
      const net = gross.minus(direct).minus(reward).minus(fraud);

      // Auto-resolve referral relationship and campaign if not provided
      let referralRelationshipId = dto.referralRelationshipId;
      let campaignCode = dto.campaignCode;

      if (!referralRelationshipId) {
        const rel = await this.prisma.referralRelationship.findUnique({
          where: { refereeId: dto.telegramUserId },
          select: { id: true },
        });
        if (rel) referralRelationshipId = rel.id;
      }

      if (!campaignCode) {
        const analytics = await this.prisma.referralAnalytics.findFirst({
          where: { inviteeId: dto.telegramUserId },
          select: { campaign: true },
        });
        if (analytics?.campaign) campaignCode = analytics.campaign;
      }

      const record = await this.prisma.growthContribution.create({
        data: {
          telegramUserId: dto.telegramUserId,
          referralRelationshipId,
          campaignCode,
          growthEventId: dto.growthEventId,
          economicEventType: dto.economicEventType,
          economicEventId: dto.economicEventId,
          grossRevenueUsdt: gross,
          directCostUsdt: direct,
          rewardCostUsdt: reward,
          fraudProvisionUsdt: fraud,
          netContributionUsdt: net,
        },
      });

      return record;
    } catch (err: any) {
      this.logger.warn(`Failed to record GrowthContribution for user ${dto.telegramUserId}: ${err.message}`);
      return null;
    }
  }

  /**
   * Record contribution from a completed settlement session.
   */
  async recordSettlementContribution(
    settlementId: string,
    telegramUserId: bigint,
    feeAmount: string | number,
    expectedCryptoAmount: string | number,
  ) {
    const feeDecimal = new Prisma.Decimal(feeAmount || 0);
    // Provider cost estimation: ~35% of fee or 1.2% rail fee
    const directCost = feeDecimal.mul(0.35);

    return this.recordContribution({
      telegramUserId,
      economicEventType: 'SETTLEMENT_FEE',
      economicEventId: settlementId,
      grossRevenueUsdt: feeDecimal.toString(),
      directCostUsdt: directCost.toString(),
    });
  }

  /**
   * Record contribution from a machine purchase.
   */
  async recordMachineContribution(
    machineId: string,
    telegramUserId: bigint,
    purchasePrice: string | number,
    tierCode: string,
  ) {
    const price = new Prisma.Decimal(purchasePrice || 0);
    // 30% upfront hardware margin basis (70% COGS for cloud compute provisioning)
    const directCost = price.mul(0.70);

    return this.recordContribution({
      telegramUserId,
      economicEventType: 'MACHINE_PURCHASE',
      economicEventId: machineId,
      grossRevenueUsdt: price.toString(),
      directCostUsdt: directCost.toString(),
    });
  }

  /**
   * Record incentive cost from a claimed reward.
   */
  async recordRewardIncentive(
    rewardId: string,
    telegramUserId: bigint,
    amount: string | number,
    ruleCode?: string,
  ) {
    return this.recordContribution({
      telegramUserId,
      economicEventType: 'REWARD_INCENTIVE',
      economicEventId: rewardId,
      grossRevenueUsdt: 0,
      rewardCostUsdt: amount,
    });
  }

  /**
   * Get user economic contribution summary.
   */
  async getUserContributionSummary(telegramUserId: bigint) {
    const aggregates = await this.prisma.growthContribution.aggregate({
      where: { telegramUserId },
      _sum: {
        grossRevenueUsdt: true,
        directCostUsdt: true,
        rewardCostUsdt: true,
        netContributionUsdt: true,
      },
      _count: { id: true },
    });

    return {
      totalEvents: aggregates._count.id,
      grossRevenueUsdt: (aggregates._sum.grossRevenueUsdt || 0).toString(),
      directCostUsdt: (aggregates._sum.directCostUsdt || 0).toString(),
      rewardCostUsdt: (aggregates._sum.rewardCostUsdt || 0).toString(),
      netContributionUsdt: (aggregates._sum.netContributionUsdt || 0).toString(),
    };
  }

  /**
   * Get referral network economic summary for a referrer.
   */
  async getReferralNetworkContribution(referrerId: bigint) {
    const downline = await this.prisma.referralRelationship.findMany({
      where: { referrerId },
      select: { refereeId: true, status: true },
    });

    const refereeIds = downline.map((d) => d.refereeId);

    const downlineContribs = await this.prisma.growthContribution.aggregate({
      where: { telegramUserId: { in: refereeIds } },
      _sum: {
        grossRevenueUsdt: true,
        directCostUsdt: true,
        netContributionUsdt: true,
      },
    });

    const referrerRewards = await this.prisma.growthContribution.aggregate({
      where: {
        telegramUserId: referrerId,
        economicEventType: 'REWARD_INCENTIVE',
      },
      _sum: {
        rewardCostUsdt: true,
      },
    });

    const netGenerated = Number(downlineContribs._sum.netContributionUsdt || 0);
    const rewardCost = Number(referrerRewards._sum.rewardCostUsdt || 0);
    const networkRoi = rewardCost > 0 ? Number((netGenerated / rewardCost).toFixed(2)) : netGenerated > 0 ? 10.0 : 0;

    return {
      totalNetworkUsers: downline.length,
      qualifiedUsers: downline.filter((d) => ['QUALIFIED', 'PAYING', 'REWARDED'].includes(d.status)).length,
      payingUsers: downline.filter((d) => ['PAYING', 'REWARDED'].includes(d.status)).length,
      networkGrossRevenueUsdt: Number(downlineContribs._sum.grossRevenueUsdt || 0),
      networkDirectCostUsdt: Number(downlineContribs._sum.directCostUsdt || 0),
      networkNetContributionUsdt: netGenerated,
      referrerRewardCostUsdt: rewardCost,
      networkRoi,
    };
  }
}
