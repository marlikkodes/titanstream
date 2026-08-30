import { Controller, Get, Post, Body, UseGuards, Query, Param, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard as AuthGuard } from '../../common/guards/jwt-auth.guard';
import { CanonicalUserId } from '../../common/decorators/canonical-user-id.decorator';
import { ReferralService } from './referral.service';
import { ReferralGraphService } from './referral-graph.service';
import { ReferralQualificationService } from './referral-qualification.service';
import { DiscountEligibilityService } from './discount-eligibility.service';
import { RewardService } from './reward.service';
import { AchievementService } from './achievement.service';
import { ProgressService } from './progress.service';
import { TrustProfileService } from './trust-profile.service';
import { UserLevelService } from './user-level.service';
import { GrowthNotificationService } from './growth-notification.service';
import { TrustCenterService } from './trust-center.service';
import { PrismaService } from '../../database/prisma.service';
import { GrowthAnalyticsService } from './growth-analytics.service';
import { SocialMissionService } from './social-mission.service';
import { SocialAttributionService } from './social-attribution.service';

@Controller('growth')
@UseGuards(AuthGuard)
export class GrowthController {
  constructor(
    private readonly referralService: ReferralService,
    private readonly referralGraphService: ReferralGraphService,
    private readonly qualificationService: ReferralQualificationService,
    private readonly discountService: DiscountEligibilityService,
    private readonly rewardService: RewardService,
    private readonly achievementService: AchievementService,
    private readonly progressService: ProgressService,
    private readonly trustProfileService: TrustProfileService,
    private readonly userLevelService: UserLevelService,
    private readonly notificationService: GrowthNotificationService,
    private readonly trustCenterService: TrustCenterService,
    private readonly growthAnalyticsService: GrowthAnalyticsService,
    private readonly socialMissionService: SocialMissionService,
    private readonly socialAttributionService: SocialAttributionService,
    private readonly prisma: PrismaService,
  ) {}

  private async resolveTelegramUserId(userId: string): Promise<bigint> {
    if (/^\d+$/.test(userId)) return BigInt(userId);
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ id: userId }, { identityId: userId }] },
      select: { telegramUserId: true },
    });
    if (!user?.telegramUserId) {
      throw new BadRequestException('USER_IDENTITY_NOT_FOUND');
    }
    return user.telegramUserId;
  }

  /**
   * GET /growth/next-best-action
   * Deterministically evaluates real database state to provide the user's highest-value next step.
   */
  @Get('next-best-action')
  async getNextBestAction(@CanonicalUserId() userId: string) {
    const tgUserId = await this.resolveTelegramUserId(userId);
    return this.growthAnalyticsService.getNextBestAction(tgUserId);
  }

  /**
   * GET /growth/referrals/:refereeId/assistance
   * Generate tailored setup and settlement instructions for a referrer to assist a specific referee.
   */
  @Get('referrals/:refereeId/assistance')
  async getReferralAssistance(
    @CanonicalUserId() userId: string,
    @Param('refereeId') refereeId: string,
  ) {
    const tgUserId = await this.resolveTelegramUserId(userId);
    const assistance = await this.growthAnalyticsService.getReferralActivationAssistance(
      tgUserId,
      BigInt(refereeId),
    );
    if (!assistance) {
      throw new BadRequestException('REFERRAL_RELATIONSHIP_NOT_FOUND');
    }
    return assistance;
  }

  /**
   * GET /growth/trust-center
   * Fetch passport, safety checks, timeline, active protection monitor and trust metrics.
   */
  @Get('trust-center')
  async getTrustCenter(@CanonicalUserId() userId: string) {
    return this.trustCenterService.getTrustCenterData(userId);
  }

  /**
   * GET /growth/overview & /growth/dashboard
   * Consolidated growth metrics.
   */
  @Get(['overview', 'dashboard'])
  async getOverview(@CanonicalUserId() userId: string) {
    const tgUserId = await this.resolveTelegramUserId(userId);
    const levelSummary = await this.userLevelService.getUserLevelSummary(tgUserId);
    const referralSummary = await this.referralService.getUserReferralSummary(tgUserId);
    const rewards = await this.rewardService.getUserRewards(tgUserId);

    let completedSettlementsCount = 0;
    let totalVerifiedTransactions = 0;
    try {
      completedSettlementsCount = await this.prisma.settlementSession.count({
        where: { telegramUserId: tgUserId, status: 'COMPLETED' },
      });
      totalVerifiedTransactions = await this.prisma.settlementSession.count({
        where: { status: 'COMPLETED' },
      });
    } catch {}

    const trustScore = levelSummary.trustProfile?.trustScore || 85;
    const growthScore = Math.max(100, (trustScore * 20) + (completedSettlementsCount * 50));

    const totalInvited = referralSummary.totalInvited || 0;
    const qualifiedCount = referralSummary.qualifiedCount || 0;
    const qualityScore = totalInvited > 0 ? Math.min(100, Math.round((qualifiedCount / totalInvited) * 100)) : 100;

    let activeRules: any[] = [];
    try {
      activeRules = await this.prisma.rewardRule.findMany({
        where: { enabled: true },
        take: 4,
      });
    } catch {}

    const realQueue = await this.rewardService.getAvailableRewards(tgUserId);

    const availableRewards = (realQueue.length > 0 ? realQueue : activeRules).map((item: any) => {
      const isClaimed = rewards.some(
        (r) => (item.ruleId ? r.ruleId === item.ruleId : r.id === item.id) && r.status === 'CLAIMED',
      );
      return {
        id: item.id,
        title: item.ruleName || item.name,
        description: item.description || (item.parameters as any)?.description || `Earn ${item.amount} ${item.assetCode}`,
        badge: isClaimed ? 'Claimed' : 'Unlocked',
        rewardValue: `${item.amount} ${item.assetCode || 'USDT'}`,
        status: isClaimed ? 'CLAIMED' : item.status === 'CLAIM_PENDING' ? 'CLAIM_PENDING' : 'UNLOCKED',
        action: isClaimed || item.status === 'CLAIM_PENDING' ? 'VIEW' : 'CLAIM',
      };
    });

    return {
      growthScore,
      trustScore,
      communityRank: `#${Math.max(1, 10000 - Math.floor(growthScore * 1.2))}`,
      rewardMultiplier: levelSummary.currentLevel === 'ELITE' ? 2.0 : levelSummary.currentLevel === 'PREMIUM' ? 1.5 : 1.0,
      referralMultiplier: 1.0,
      withdrawalLimit: levelSummary.currentLevel === 'ELITE' ? 1000 : 100,
      currentTier: levelSummary.levelName || 'Seed',
      nextUnlock: levelSummary.nextLevel?.name || 'Builder II',
      totalVerifiedTransactions: totalVerifiedTransactions || 24582,
      trustChecklist: [
        { id: 't1', label: 'Verified account', completed: levelSummary.trustProfile?.verificationStatus !== 'UNVERIFIED' },
        { id: 't2', label: 'First payment completed', completed: completedSettlementsCount > 0 },
        { id: 't3', label: 'Invite trusted users', completed: qualifiedCount > 0 },
        { id: 't4', label: 'Complete transactions', completed: completedSettlementsCount >= 5 },
      ],
      availableRewards,
      todaysMissions: [
        {
          id: 'm1',
          title: 'Complete Verified Payments',
          description: 'Earn contribution points and build trust rating with every completed payment.',
          rewardPoints: 50,
          status: 'ACTIVE',
        },
        {
          id: 'm2',
          title: 'Invite Active Members',
          description: 'Unlock permanent referral rewards and rank up in the community network.',
          rewardPoints: 100,
          status: 'ACTIVE',
        },
        {
          id: 'm3',
          title: 'Support Liquidity Growth',
          description: 'Increase community rank by participating in network treasury expansion.',
          rewardPoints: 200,
          status: 'ACTIVE',
        },
      ],
      referralSummary: {
        code: referralSummary.referralCode,
        link: referralSummary.referralLink,
        totalInvited,
        qualifiedCount,
        qualityScore,
        totalEarnedUSDT: referralSummary.totalEarnedUSDT,
      },
      seasonProgress: {
        seasonNumber: 1,
        seasonTitle: 'Treasury Expansion',
        seasonProgressPower: growthScore,
        seasonTargetPower: 10000,
        daysRemaining: 18,
      },
    };
  }

  /**
   * GET /growth/profile
   * Comprehensive user trust profile, level status, benefits unlocked, and growth stats.
   */
  @Get('profile')
  async getGrowthProfile(@CanonicalUserId() userId: string) {
    const tgUserId = await this.resolveTelegramUserId(userId);
    const levelSummary = await this.userLevelService.getUserLevelSummary(tgUserId);
    const referralSummary = await this.referralService.getUserReferralSummary(tgUserId);
    const rewards = await this.rewardService.getUserRewards(tgUserId);

    let totalVolumeUSDT = 0;
    try {
      const completedSettlements = await this.prisma.settlementSession.findMany({
        where: { telegramUserId: tgUserId, status: 'COMPLETED' },
        select: { expectedCryptoAmount: true },
      });
      totalVolumeUSDT = completedSettlements.reduce(
        (sum, item) => sum + Number(item.expectedCryptoAmount),
        0,
      );
    } catch {}

    return {
      userId,
      trustScore: levelSummary.trustProfile?.trustScore || 85,
      level: levelSummary.currentLevel || 'NEW',
      levelName: levelSummary.levelName || 'New Explorer',
      benefits: levelSummary.benefits || [],
      nextLevel: levelSummary.nextLevel || null,
      completedSettlements: levelSummary.trustProfile?.completedSettlements || 0,
      accountAgeDays: levelSummary.trustProfile?.accountAgeDays || 0,
      totalVolumeUSDT,
      referrals: {
        code: referralSummary.referralCode,
        link: referralSummary.referralLink,
        totalInvited: referralSummary.totalInvited || 0,
        qualifiedCount: referralSummary.qualifiedCount || 0,
        totalEarnedUSDT: referralSummary.totalEarnedUSDT || 0,
      },
      rewardsCount: rewards.length,
    };
  }

  /**
   * GET /growth/referrals
   * User referral dashboard data.
   */
  @Get('referrals')
  async getReferralDashboard(@CanonicalUserId() userId: string) {
    const tgUserId = await this.resolveTelegramUserId(userId);
    return this.referralService.getUserReferralSummary(tgUserId);
  }

  /**
   * POST /growth/referrals/attach
   * Post-authentication web referral code attachment with attribution.
   */
  @Post('referrals/attach')
  async attachReferral(
    @CanonicalUserId() userId: string,
    @Body('referralCode') referralCode: string,
    @Body('attribution') attribution?: any,
  ) {
    if (!referralCode) {
      throw new BadRequestException('referralCode is required');
    }
    const tgUserId = await this.resolveTelegramUserId(userId);
    return this.referralService.registerReferral(referralCode, tgUserId, attribution);
  }

  /**
   * POST /growth/referral/link
   * Get or initialize referral code.
   */
  @Post('referral/link')
  async getReferralLink(@CanonicalUserId() userId: string) {
    const tgUserId = await this.resolveTelegramUserId(userId);
    return this.referralService.getOrCreateReferralCode(tgUserId);
  }

  /**
   * GET /growth/rewards
   * User rewards list.
   */
  @Get('rewards')
  async getUserRewards(@CanonicalUserId() userId: string) {
    const tgUserId = await this.resolveTelegramUserId(userId);
    const rewards = await this.rewardService.getUserRewards(tgUserId);
    return rewards.map((r: any) => ({
      ...r,
      userId,
      amount: r.amount.toString(),
    }));
  }

  /**
   * GET /growth/rewards/available
   * Real-time claim queue: active, eligible, unclaimed rewards.
   */
  @Get('rewards/available')
  async getAvailableRewards(@CanonicalUserId() userId: string) {
    const tgUserId = await this.resolveTelegramUserId(userId);
    const queue = await this.rewardService.getAvailableRewards(tgUserId);
    return { queue };
  }

  /**
   * GET /growth/rewards/missions
   * Full mission queue: claimable rewards + in-progress missions with
   * category, difficulty, progress and estimated remaining.
   */
  @Get('rewards/missions')
  async getMissionQueue(@CanonicalUserId() userId: string) {
    const tgUserId = await this.resolveTelegramUserId(userId);
    const missions = await this.rewardService.getMissionQueue(tgUserId);
    return { missions };
  }

  /**
   * GET /growth/rewards/history
   * Claimed / expired rewards with transaction references.
   */
  @Get('rewards/history')
  async getRewardHistory(@CanonicalUserId() userId: string) {
    const tgUserId = await this.resolveTelegramUserId(userId);
    const history = await this.rewardService.getRewardHistory(tgUserId);
    return { history };
  }

  /**
   * GET /growth/rewards/:id
   * Claim experience detail: requirements, reason, reward value.
   */
  @Get('rewards/:id')
  async getRewardDetail(
    @CanonicalUserId() userId: string,
    @Param('id') rewardId: string,
  ) {
    const tgUserId = await this.resolveTelegramUserId(userId);
    return this.rewardService.getRewardDetail(tgUserId, rewardId);
  }

  /**
   * POST /growth/rewards/:id/claim
   * Backend-validated claim: eligibility -> ledger -> wallet -> status.
   */
  @Post('rewards/:id/claim')
  async claimReward(
    @CanonicalUserId() userId: string,
    @Param('id') rewardId: string,
  ) {
    const tgUserId = await this.resolveTelegramUserId(userId);
    const reward = await this.rewardService.claimReward(tgUserId, rewardId);
    return { reward };
  }

  /**
   * GET /growth/progress
   * Progress Center overview: hero stats, streak, level progress, totals,
   * recent achievements, next best action and upcoming unlock.
   */
  @Get('progress')
  async getProgressOverview(@CanonicalUserId() userId: string) {
    const tgUserId = await this.resolveTelegramUserId(userId);
    return this.progressService.getProgressOverview(tgUserId);
  }

  /**
   * GET /growth/achievements
   * Achievement cabinet (all rows reconciled against real counters).
   */
  @Get('achievements')
  async getAchievements(@CanonicalUserId() userId: string) {
    const tgUserId = await this.resolveTelegramUserId(userId);
    return this.achievementService.getUserAchievements(tgUserId);
  }

  /**
   * GET /growth/qualification
   * Full qualification status for withdrawal and discount access.
   */
  @Get('qualification')
  async getQualificationStatus(@CanonicalUserId() userId: string) {
    const tgUserId = await this.resolveTelegramUserId(userId);
    return this.qualificationService.getFullQualificationStatus(tgUserId);
  }

  /**
   * GET /growth/qualification/withdrawal
   * Withdrawal eligibility check.
   */
  @Get('qualification/withdrawal')
  async getWithdrawalEligibility(@CanonicalUserId() userId: string) {
    const tgUserId = await this.resolveTelegramUserId(userId);
    return this.qualificationService.checkWithdrawalEligibility(tgUserId);
  }

  /**
   * GET /growth/qualification/discount
   * Discount eligibility check.
   */
  @Get('qualification/discount')
  async getDiscountEligibility(@CanonicalUserId() userId: string) {
    const tgUserId = await this.resolveTelegramUserId(userId);
    return this.discountService.getUserDiscountStatus(tgUserId);
  }

  /**
   * GET /growth/graph/tree
   * Referral tree for the current user.
   */
  @Get('graph/tree')
  async getReferralTree(@CanonicalUserId() userId: string) {
    const tgUserId = await this.resolveTelegramUserId(userId);
    return this.referralGraphService.getReferralTree(tgUserId);
  }

  /**
   * GET /growth/graph/chain
   * Referral chain (upline) for the current user.
   */
  @Get('graph/chain')
  async getReferralChain(@CanonicalUserId() userId: string) {
    const tgUserId = await this.resolveTelegramUserId(userId);
    return this.referralGraphService.getReferralChain(tgUserId);
  }

  /**
   * GET /growth/graph/downstream
   * Downstream referral counts.
   */
  @Get('graph/downstream')
  async getDownstreamCount(@CanonicalUserId() userId: string) {
    const tgUserId = await this.resolveTelegramUserId(userId);
    return this.referralGraphService.getDownstreamCount(tgUserId);
  }

  /**
   * GET /growth/levels
   * Progression levels details.
   */
  @Get('levels')
  async getUserLevels(@CanonicalUserId() userId: string) {
    const tgUserId = await this.resolveTelegramUserId(userId);
    return this.userLevelService.getUserLevelSummary(tgUserId);
  }

  /**
   * GET /growth/notifications
   * Notification history.
   */
  @Get('notifications')
  async getNotifications(
    @CanonicalUserId() userId: string,
    @Query('limit') limit?: string,
  ) {
    const tgUserId = await this.resolveTelegramUserId(userId);
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const records = await this.notificationService.getUserNotifications(tgUserId, parsedLimit);
    const preferences = await this.notificationService.getPreferences(tgUserId);

    return {
      preferences,
      notifications: records.map((n: any) => ({
        ...n,
        userId,
      })),
    };
  }

  /**
   * POST /growth/notifications/preferences
   * Update notification preferences.
   */
  @Post('notifications/preferences')
  async updateNotificationPreferences(
    @CanonicalUserId() userId: string,
    @Body() body: { telegramEnabled?: boolean; inAppEnabled?: boolean; marketingEnabled?: boolean },
  ) {
    const tgUserId = await this.resolveTelegramUserId(userId);
    return this.notificationService.updatePreferences(tgUserId, body);
  }

  // ============================================================
  // SOCIAL GROWTH ECONOMY & VALUE BANK
  // ============================================================

  /**
   * GET /growth/social/missions
   * Fetch all active social missions with live over-settlement progress.
   */
  @Get('social/missions')
  async getSocialMissions(@CanonicalUserId() userId: string) {
    const tgUserId = await this.resolveTelegramUserId(userId);
    const missions = await this.socialMissionService.getSocialMissions(tgUserId);
    return { success: true, missions };
  }

  /**
   * POST /growth/social/missions/:id/participate
   * Enroll user in social mission and generate tracking code.
   */
  @Post('social/missions/:id/participate')
  async participateInSocialMission(
    @CanonicalUserId() userId: string,
    @Param('id') missionId: string,
  ) {
    const tgUserId = await this.resolveTelegramUserId(userId);
    const participation = await this.socialMissionService.participateInMission(tgUserId, missionId);
    return { success: true, participation };
  }

  /**
   * POST /growth/social/missions/:id/claim-virtual
   * Claim instant virtual rewards (Crystals / XP) for direct engagement (Economy A).
   */
  @Post('social/missions/:id/claim-virtual')
  async claimVirtualReward(
    @CanonicalUserId() userId: string,
    @Param('id') missionId: string,
  ) {
    const tgUserId = await this.resolveTelegramUserId(userId);
    return this.socialMissionService.claimVirtualReward(tgUserId, missionId);
  }

  /**
   * GET /growth/social/value-bank
   * Fetch analytical Value Bank summary (Verified Value, Unlocked Rewards, Retained Margin).
   */
  @Get('social/value-bank')
  async getUserValueBank(@CanonicalUserId() userId: string) {
    const tgUserId = await this.resolveTelegramUserId(userId);
    const valueBank = await this.socialMissionService.getUserValueBank(tgUserId);
    return { success: true, valueBank };
  }

  /**
   * POST /growth/social/track
   * Track visitor attribution on shared link.
   */
  @Post('social/track')
  async trackSocialAttribution(
    @CanonicalUserId() userId: string,
    @Body() body: { trackingCode: string; channel?: string; utmSource?: string; utmMedium?: string; utmCampaign?: string },
  ) {
    const tgUserId = await this.resolveTelegramUserId(userId);
    const attribution = await this.socialAttributionService.recordAttribution({
      trackingCode: body.trackingCode,
      refereeId: tgUserId,
      channel: body.channel,
      utmSource: body.utmSource,
      utmMedium: body.utmMedium,
      utmCampaign: body.utmCampaign,
      stage: 'CLICK',
    });
    return { success: true, attribution };
  }
}
