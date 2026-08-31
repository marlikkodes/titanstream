import { Controller, Get, Post, Param, Body, Query, UseGuards, Inject, forwardRef } from '@nestjs/common';
import { AdminAuthGuard } from '../admin/guards/admin-auth.guard';
import { RbacGuard } from '../admin/guards/rbac.guard';
import { Permissions } from '../admin/decorators/permissions.decorator';
import { AdminPermission } from '../admin/interfaces/admin-permissions.enum';
import { RewardService } from './reward.service';
import { UserLevelService } from './user-level.service';
import { GrowthNotificationService } from './growth-notification.service';
import { ReferralGraphService } from './referral-graph.service';
import { GrowthAnalyticsService } from './growth-analytics.service';
import { FraudDetectionService } from '../fraud/fraud-detection.service';
import { PrismaService } from '../../database/prisma.service';
import { RewardStatus, RewardType, ReferralStatus, UserLevelTier, NotificationChannel, Prisma } from '@prisma/client';

@Controller('admin')
@UseGuards(AdminAuthGuard, RbacGuard)
export class GrowthAdminController {
  constructor(
    private readonly rewardService: RewardService,
    private readonly userLevelService: UserLevelService,
    private readonly notificationService: GrowthNotificationService,
    private readonly referralGraphService: ReferralGraphService,
    private readonly growthAnalyticsService: GrowthAnalyticsService,
    @Inject(forwardRef(() => FraudDetectionService))
    private readonly fraudDetectionService: FraudDetectionService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * GET /admin/growth/economics
   * Growth Economy Net Contribution, CAC, LTV, and Channel Breakdown.
   */
  @Get('growth/economics')
  @Permissions(AdminPermission.REFERRAL_READ)
  async getGrowthEconomics() {
    return this.growthAnalyticsService.getGrowthEconomyMetrics();
  }

  /**
   * GET /admin/growth/funnel
   * Canonical 9-stage Economic Funnel with net contribution.
   */
  @Get('growth/funnel')
  @Permissions(AdminPermission.REFERRAL_READ)
  async getEconomicFunnel() {
    return this.growthAnalyticsService.getCanonicalEconomicFunnel();
  }

  /**
   * GET /admin/growth/leaks
   * Economic Leak Detection and drop-off analysis.
   */
  @Get('growth/leaks')
  @Permissions(AdminPermission.REFERRAL_READ)
  async getEconomicLeaks() {
    return this.growthAnalyticsService.getEconomicLeaks();
  }

  /**
   * GET /admin/growth/opportunities
   * Ranked Revenue Opportunity Map (P0 → P3).
   */
  @Get('growth/opportunities')
  @Permissions(AdminPermission.REFERRAL_READ)
  async getRevenueOpportunities() {
    return this.growthAnalyticsService.getRevenueOpportunities();
  }

  /**
   * GET /admin/growth/cohorts
   * Cohort Economics tracking CAC, LTV, net contribution, and retention.
   */
  @Get('growth/cohorts')
  @Permissions(AdminPermission.REFERRAL_READ)
  async getCohortEconomics() {
    return this.growthAnalyticsService.getCohortEconomics();
  }

  /**
   * GET /admin/growth/liabilities
   * Reward Liability Governance (Available, Committed, Disbursed, Budget).
   */
  @Get('growth/liabilities')
  @Permissions(AdminPermission.REFERRAL_READ)
  async getRewardLiabilities() {
    return this.growthAnalyticsService.getRewardLiabilityBreakdown();
  }

  /**
   * GET /admin/growth/referrers/quality
   * Referrer Quality Score Rankings.
   */
  @Get('growth/referrers/quality')
  @Permissions(AdminPermission.REFERRAL_READ)
  async getReferrerQualityRankings() {
    return this.growthAnalyticsService.getReferrerQualityRankings();
  }

  /**
   * GET /admin/growth/campaigns/roi
   * Campaign-level ROI and conversion efficiency ranking.
   */
  @Get('growth/campaigns/roi')
  @Permissions(AdminPermission.REFERRAL_READ)
  async getCampaignRoiMetrics() {
    const metrics = await this.growthAnalyticsService.getGrowthEconomyMetrics();
    return {
      timestamp: new Date().toISOString(),
      campaigns: metrics.campaigns,
      overallGrowthRoi: metrics.overallGrowthRoi,
      netGrowthContributionUsdt: metrics.netGrowthContributionUsdt,
    };
  }

  /**
   * GET /admin/growth/attribution/health
   * Diagnostic health of attribution graph and cost estimations.
   */
  @Get('growth/attribution/health')
  @Permissions(AdminPermission.REFERRAL_READ)
  async getAttributionHealth() {
    return this.growthAnalyticsService.getAttributionHealthMetrics();
  }

  /**
   * GET /admin/rewards
   * Admin view of all rewards.
   */
  @Get('rewards')
  @Permissions(AdminPermission.REFERRAL_READ)
  async getAllRewards(@Query('status') status?: RewardStatus) {
    const rewards = await this.rewardService.getAllRewards(status);
    return rewards.map((r) => ({
      ...r,
      telegramUserId: r.telegramUserId.toString(),
      amount: r.amount.toString(),
    }));
  }

  /**
   * POST /admin/rewards/:id/approve
   * Admin trigger to approve & disburse pending reward via Financial Orchestrator.
   */
  @Post('rewards/:id/approve')
  @Permissions(AdminPermission.REFERRAL_MANAGE)
  async approveReward(@Param('id') id: string) {
    const result = await this.rewardService.approveAndDisburseReward(id);
    return {
      ...result,
      telegramUserId: result.telegramUserId.toString(),
      amount: result.amount.toString(),
    };
  }

  /**
   * GET /admin/referrals/relationships
   * Detailed listing of all referral relationships for auditing.
   */
  @Get('referrals/relationships')
  @Permissions(AdminPermission.REFERRAL_READ)
  async getReferralRelationships(
    @Query('status') status?: ReferralStatus,
    @Query('referrerId') referrerId?: string,
  ) {
    const where: any = {};
    if (status) where.status = status;
    if (referrerId) where.referrerId = BigInt(referrerId);

    const list = await this.prisma.referralRelationship.findMany({
      where,
      include: {
        referrer: { select: { telegramUserId: true, firstName: true, telegramUsername: true } },
        referee: { select: { telegramUserId: true, firstName: true, telegramUsername: true } },
        rewards: { include: { reward: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return list.map((r) => ({
      id: r.id,
      referrerId: r.referrerId.toString(),
      referrerName: r.referrer.firstName,
      referrerUsername: r.referrer.telegramUsername,
      refereeId: r.refereeId.toString(),
      refereeName: r.referee.firstName,
      refereeUsername: r.referee.telegramUsername,
      status: r.status,
      createdAt: r.createdAt,
      qualifiedAt: r.qualifiedAt,
      rewardedAt: r.rewardedAt,
      rewards: r.rewards.map((rw) => ({
        id: rw.reward.id,
        amount: rw.reward.amount.toString(),
        status: rw.reward.status,
        reference: rw.reward.reference,
      })),
    }));
  }

  /**
   * GET /admin/referrals/graph/:userId
   * Inspect referral graph tree & chain for a specific user.
   */
  @Get('referrals/graph/:userId')
  @Permissions(AdminPermission.REFERRAL_READ)
  async getReferralGraphForUser(@Param('userId') userId: string) {
    const targetId = BigInt(userId);
    const tree = await this.referralGraphService.getReferralTree(targetId);
    const chain = await this.referralGraphService.getReferralChain(targetId);
    const downstream = await this.referralGraphService.getDownstreamCount(targetId);

    return {
      telegramUserId: userId,
      tree,
      chain,
      downstream,
    };
  }

  /**
   * GET /admin/referrals/fraud-check
   * Run fraud analysis across IP clusters and referral graph cycles.
   */
  @Get('referrals/fraud-check')
  @Permissions(AdminPermission.RISK_MANAGE)
  async runFraudCheck() {
    const ipClusters = await this.fraudDetectionService.analyzeIpClusters();
    const graphCycles = await this.fraudDetectionService.checkReferralGraph();

    return {
      timestamp: new Date().toISOString(),
      ipClusters,
      graphCycles,
    };
  }

  /**
   * POST /admin/rewards/rules
   * Create or update a reward rule.
   */
  @Post('rewards/rules')
  @Permissions(AdminPermission.REFERRAL_MANAGE)
  async upsertRewardRule(
    @Body()
    body: {
      code: string;
      name: string;
      rewardType: RewardType;
      amount: string;
      assetCode?: string;
      enabled?: boolean;
      parameters?: Record<string, any>;
    },
  ) {
    return this.prisma.rewardRule.upsert({
      where: { code: body.code },
      update: {
        name: body.name,
        rewardType: body.rewardType,
        amount: body.amount,
        assetCode: body.assetCode || 'USDT',
        enabled: body.enabled !== undefined ? body.enabled : true,
        parameters: body.parameters || {},
      },
      create: {
        code: body.code,
        name: body.name,
        rewardType: body.rewardType,
        amount: body.amount,
        assetCode: body.assetCode || 'USDT',
        enabled: body.enabled !== undefined ? body.enabled : true,
        parameters: body.parameters || {},
      },
    });
  }

  /**
   * POST /admin/levels/configure
   * Configure user level progression criteria and benefits.
   */
  @Post('levels/configure')
  @Permissions(AdminPermission.REFERRAL_MANAGE)
  async configureLevel(
    @Body()
    body: {
      level: UserLevelTier;
      name: string;
      minAccountAgeDays: number;
      minSuccessfulSettlements: number;
      minTrustScore: number;
      benefits: string[];
      orderIndex: number;
    },
  ) {
    return this.prisma.userLevelConfig.upsert({
      where: { level: body.level },
      update: {
        name: body.name,
        minAccountAgeDays: body.minAccountAgeDays,
        minSuccessfulSettlements: body.minSuccessfulSettlements,
        minTrustScore: body.minTrustScore,
        benefits: body.benefits,
        orderIndex: body.orderIndex,
      },
      create: body,
    });
  }

  /**
   * POST /admin/notifications/templates
   * Create or update notification templates.
   */
  @Post('notifications/templates')
  @Permissions(AdminPermission.OPERATIONS_CONTROL)
  async upsertNotificationTemplate(
    @Body()
    body: {
      code: string;
      name: string;
      titleTemplate: string;
      bodyTemplate: string;
      channel?: NotificationChannel;
      enabled?: boolean;
    },
  ) {
    return this.prisma.notificationTemplate.upsert({
      where: { code: body.code },
      update: {
        name: body.name,
        titleTemplate: body.titleTemplate,
        bodyTemplate: body.bodyTemplate,
        channel: body.channel || NotificationChannel.TELEGRAM,
        enabled: body.enabled !== undefined ? body.enabled : true,
      },
      create: {
        code: body.code,
        name: body.name,
        titleTemplate: body.titleTemplate,
        bodyTemplate: body.bodyTemplate,
        channel: body.channel || NotificationChannel.TELEGRAM,
        enabled: body.enabled !== undefined ? body.enabled : true,
      },
    });
  }
  /**
   * GET /admin/growth/social/campaigns
   * Social Campaign performance, unit economics, ROI, and over-settlement telemetry.
   */
  @Get('growth/social/campaigns')
  @Permissions(AdminPermission.REFERRAL_READ)
  async getSocialCampaigns() {
    const missions = await this.prisma.socialMission.findMany({
      include: {
        participations: {
          include: {
            attributions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      campaigns: missions.map((m) => {
        const totalParticipants = m.participations.length;
        const totalClicks = m.participations.reduce((acc, p) => acc + p.attributions.filter((a) => a.stage === 'CLICK').length, 0);
        const verifiedContribution = m.participations.reduce((acc, p) => acc + Number(p.verifiedContributionUsdt), 0);
        const unlockedRewards = m.participations.reduce((acc, p) => acc + Number(p.unlockedRewardUsdt), 0);
        const retainedContribution = verifiedContribution - unlockedRewards;
        const roi = unlockedRewards > 0 ? (verifiedContribution / unlockedRewards).toFixed(2) : 'N/A';

        return {
          id: m.id,
          code: m.code,
          name: m.name,
          tier: m.tier,
          channel: m.channel,
          enabled: m.enabled,
          totalParticipants,
          totalClicks,
          verifiedContributionUsdt: verifiedContribution.toFixed(2),
          unlockedRewardsUsdt: unlockedRewards.toFixed(2),
          retainedContributionUsdt: retainedContribution.toFixed(2),
          roi,
          status: !m.enabled
            ? 'PAUSED'
            : verifiedContribution >= unlockedRewards * 2
              ? 'PROFITABLE'
              : 'OPTIMIZE',
        };
      }),
    };
  }

  /**
   * POST /admin/growth/social/campaigns
   * Create or update a social mission campaign configuration.
   */
  @Post('growth/social/campaigns')
  @Permissions(AdminPermission.OPERATIONS_CONTROL)
  async upsertSocialCampaign(@Body() body: any) {
    return this.prisma.socialMission.upsert({
      where: { code: body.code },
      update: {
        name: body.name,
        description: body.description,
        tier: body.tier,
        channel: body.channel || 'ALL',
        virtualRewardCrystals: Number(body.virtualRewardCrystals || 0),
        virtualRewardXp: Number(body.virtualRewardXp || 0),
        maxRewardUsdt: body.maxRewardUsdt ? new Prisma.Decimal(body.maxRewardUsdt) : undefined,
        requiredContributionUsdt: body.requiredContributionUsdt ? new Prisma.Decimal(body.requiredContributionUsdt) : undefined,
        rewardRate: body.rewardRate ? new Prisma.Decimal(body.rewardRate) : undefined,
        platformMarginBufferUsdt: body.platformMarginBufferUsdt ? new Prisma.Decimal(body.platformMarginBufferUsdt) : undefined,
        enabled: body.enabled !== undefined ? body.enabled : true,
      },
      create: {
        code: body.code,
        name: body.name,
        description: body.description,
        tier: body.tier || 'ENGAGEMENT',
        channel: body.channel || 'ALL',
        virtualRewardCrystals: Number(body.virtualRewardCrystals || 0),
        virtualRewardXp: Number(body.virtualRewardXp || 0),
        maxRewardUsdt: new Prisma.Decimal(body.maxRewardUsdt || 0),
        requiredContributionUsdt: new Prisma.Decimal(body.requiredContributionUsdt || 0),
        rewardRate: new Prisma.Decimal(body.rewardRate || 0.2),
        platformMarginBufferUsdt: new Prisma.Decimal(body.platformMarginBufferUsdt || 0),
        enabled: body.enabled !== undefined ? body.enabled : true,
      },
    });
  }
}
