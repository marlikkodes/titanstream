import { api } from './api';

export interface RetentionCohort {
  cohortDate: string;
  totalUsers: number;
  d1RetentionPercent: number;
  d7RetentionPercent: number;
  d30RetentionPercent: number;
}

export interface FunnelStage {
  stageName: string;
  userCount: number;
  conversionPercent: number;
  dropoffPercent: number;
}

export interface GrowthAnalyticsOverview {
  totalUsers: number;
  activeUsersMonthly: number;
  kFactorViralCoefficient: number;
  totalReferralBonusDistributedUsdt: number;
  cohorts: RetentionCohort[];
  funnel: FunnelStage[];
  topReferrers: Array<{ telegramUserId: string; username: string; totalReferees: number; earningsUsdt: number }>;
}

export interface ReferredByInfo {
  referrerId: string;
  name: string;
  username?: string;
  joinedAt: string;
  status: string;
}

export interface ReferralSummaryItem {
  id: string;
  refereeId: string;
  refereeName: string;
  refereeUsername?: string;
  status: string;
  createdAt: string;
  qualifiedAt?: string;
  rewardedAt?: string;
}

export interface ReferralSummary {
  referralCode: string;
  referralLink: string;
  totalInvited: number;
  qualifiedCount: number;
  payingCount: number;
  totalEarnedUSDT: number;
  networkContributionUsdt?: number;
  networkGrossVolumeUsdt?: number;
  qualificationStatus?: {
    qualifiedCount: number;
    payingCount: number;
    withdrawalRequired: number;
    withdrawalRemaining: number;
    isWithdrawalUnlocked: boolean;
  };
  referredBy?: ReferredByInfo | null;
  referrals: ReferralSummaryItem[];
}

export interface GrowthProfile {
  telegramUserId: string;
  trustScore: number;
  level: string;
  levelName: string;
  benefits: string[];
  nextLevel?: any;
  completedSettlements: number;
  accountAgeDays: number;
  totalVolumeUSDT: number;
  referrals: {
    code: string;
    link: string;
    totalInvited: number;
    qualifiedCount: number;
    totalEarnedUSDT: number;
  };
  rewardsCount: number;
}

export interface RewardItem {
  id: string;
  telegramUserId: string;
  rewardType: string;
  amount: string;
  assetCode: string;
  status: string;
  reference: string;
  createdAt: string;
}

export interface RewardRequirement {
  key: string;
  label: string;
  required: number;
  current: number;
  unit: string;
  completed: boolean;
  actionTab?: string;
}

export interface RewardQueueItem {
  id: string;
  rewardType: string;
  amount: string;
  assetCode: string;
  status: string;
  reference: string;
  createdAt: string;
  ruleName?: string;
  description?: string;
  requirement: RewardRequirement | null;
  reason?: string;
  eligible: boolean;
}

export interface MissionItem {
  id: string;
  ruleCode?: string | null;
  rewardType: string;
  amount: string;
  assetCode: string;
  status: string;
  reference?: string;
  createdAt?: string;
  ruleName?: string;
  description?: string;
  requirement: RewardRequirement | null;
  reason?: string;
  eligible: boolean;
  category?: string;
  difficulty?: string;
  progressPercent?: number;
  estimatedRemaining?: string;
}

export interface AchievementItem {
  code: string;
  name: string;
  description: string;
  tier: string;
  icon?: string | null;
  progress: number;
  target: number;
  achieved: boolean;
  achievedAt?: string | null;
}

export interface NextBestAction {
  type: string;
  missionId?: string;
  rewardId?: string;
  ruleCode?: string;
  title: string;
  message: string;
  tab: string;
}

export interface ProgressCriteria {
  key: string;
  label: string;
  current: number;
  required: number;
  met: boolean;
}

export interface ProgressOverview {
  level: {
    currentLevel: string;
    levelName: string;
    benefits: string[];
    upgradedAt?: string | null;
    nextLevel?: {
      level: string;
      name: string;
      minAccountAgeDays: number;
      minSuccessfulSettlements: number;
      minTrustScore: number;
      benefits: string[];
    } | null;
    progressPercent: number;
    criteria: ProgressCriteria[];
  };
  streak: { days: number; best: number };
  totals: {
    totalClaimed: number;
    totalEarned: number;
    availableCount: number;
    estimatedRemaining: number;
  };
  recentAchievements: AchievementItem[];
  justUnlocked: Array<{ code: string; name: string; tier: string }>;
  nextBestAction: NextBestAction;
  upcomingUnlock: {
    missionId: string;
    ruleCode?: string;
    name: string;
    amount: string;
    assetCode: string;
    progressPercent: number;
    requirement: RewardRequirement | null;
    estimatedRemaining: string;
    actionTab: string;
  } | null;
}

export interface RewardHistoryItem {
  id: string;
  rewardType: string;
  amount: string;
  assetCode: string;
  status: string;
  reference: string;
  createdAt: string;
  claimedAt: string;
  transactionReference: string;
  ruleName?: string;
  description?: string;
}

export interface ClaimResult {
  reward: {
    id: string;
    rewardType: string;
    amount: string;
    assetCode: string;
    status: string;
    reference: string;
    operationId?: string | null;
    processedAt?: string | null;
  };
}

export interface QualificationStatus {
  withdrawal: any;
  discount: any;
}

export const growthService = {
  async getProfile(): Promise<GrowthProfile> {
    const res = await api.get('/growth/profile');
    return res.data.data;
  },

  async getReferrals(): Promise<ReferralSummary> {
    const res = await api.get('/growth/referrals');
    return res.data.data;
  },

  async attachReferral(referralCode: string, attribution?: any): Promise<any> {
    const res = await api.post('/growth/referrals/attach', { referralCode, attribution });
    return res.data;
  },

  async getRewards(): Promise<RewardItem[]> {
    const res = await api.get('/growth/rewards');
    return res.data.data;
  },

  async getAvailableRewards(): Promise<RewardQueueItem[]> {
    const res = await api.get('/growth/rewards/available');
    return res.data.data.queue;
  },

  async getMissions(): Promise<MissionItem[]> {
    const res = await api.get('/growth/rewards/missions');
    return res.data.data.missions;
  },

  async getProgressOverview(): Promise<ProgressOverview> {
    const res = await api.get('/growth/progress');
    return res.data?.data ?? res.data;
  },

  async getAchievements(): Promise<{
    achievements: AchievementItem[];
    totalUnlocked: number;
    total: number;
    justUnlocked: Array<{ code: string; name: string; tier: string }>;
  }> {
    const res = await api.get('/growth/achievements');
    return res.data?.data ?? res.data ?? { achievements: [], totalUnlocked: 0, total: 0, justUnlocked: [] };
  },

  async getRewardDetail(id: string): Promise<RewardQueueItem> {
    const res = await api.get(`/growth/rewards/${id}`);
    return res.data?.data ?? res.data;
  },

  async claimReward(id: string): Promise<ClaimResult> {
    const res = await api.post(`/growth/rewards/${id}/claim`);
    return res.data?.data ?? res.data;
  },

  async getRewardHistory(): Promise<RewardHistoryItem[]> {
    const res = await api.get('/growth/rewards/history');
    return res.data?.data?.history ?? res.data?.history ?? res.data?.data ?? [];
  },

  async getQualification(): Promise<QualificationStatus> {
    const res = await api.get('/growth/qualification');
    return res.data.data;
  },

  async getDashboard(): Promise<any> {
    const res = await api.get('/growth/dashboard');
    return res.data.data;
  },

  async getTrustCenter(): Promise<any> {
    const res = await api.get('/growth/trust-center');
    return res.data.data;
  },

  async getAnalyticsOverview(): Promise<GrowthAnalyticsOverview> {
    const res = await api.get('/admin/growth/analytics-overview');
    return res.data.data;
  },

  async getCohorts(): Promise<RetentionCohort[]> {
    const res = await api.get('/admin/growth/cohorts');
    return res.data.data;
  },

  async getFunnel(): Promise<FunnelStage[]> {
    const res = await api.get('/admin/growth/conversion-funnel');
    return res.data.data;
  },

  async getNextBestAction(): Promise<NextBestAction> {
    const res = await api.get('/growth/next-best-action');
    return res.data.data ?? res.data;
  },

  async getReferralAssistance(refereeId: string): Promise<ReferralAssistance> {
    const res = await api.get(`/growth/referrals/${refereeId}/assistance`);
    return res.data.data ?? res.data;
  },

  async getEconomicFunnel(): Promise<{ stages: CanonicalFunnelStage[] }> {
    const res = await api.get('/admin/growth/funnel');
    return res.data.data ?? res.data;
  },

  async getEconomicLeaks(): Promise<EconomicLeakItem[]> {
    const res = await api.get('/admin/growth/leaks');
    return res.data.data ?? res.data;
  },

  async getRevenueOpportunities(): Promise<RevenueOpportunityItem[]> {
    const res = await api.get('/admin/growth/opportunities');
    return res.data.data ?? res.data;
  },

  async getCohortEconomics(): Promise<CohortEconomicsItem[]> {
    const res = await api.get('/admin/growth/cohorts');
    return res.data.data ?? res.data;
  },

  async getRewardLiabilities(): Promise<RewardLiabilityBreakdown> {
    const res = await api.get('/admin/growth/liabilities');
    return res.data.data ?? res.data;
  },

  async getReferrerQualityRankings(): Promise<ReferrerQualityItem[]> {
    const res = await api.get('/admin/growth/referrers/quality');
    return res.data.data ?? res.data;
  },

  async getGrowthEconomyMetrics(): Promise<GrowthEconomyMetrics> {
    const res = await api.get('/admin/growth/economics');
    return res.data.data ?? res.data;
  },

  async getCampaignsRoi(): Promise<{
    timestamp: string;
    campaigns: CampaignRoiItem[];
    overallGrowthRoi: number;
    netGrowthContributionUsdt: number;
  }> {
    const res = await api.get('/admin/growth/campaigns/roi');
    return res.data.data ?? res.data;
  },

  async getAttributionHealth(): Promise<AttributionHealthMetrics> {
    const res = await api.get('/admin/growth/attribution/health');
    return res.data.data ?? res.data;
  },

  async getSocialMissions(): Promise<SocialMission[]> {
    const res = await api.get('/growth/social/missions');
    const list = res.data.missions ?? res.data.data?.missions ?? res.data;
    return Array.isArray(list) ? list : [];
  },

  async participateInSocialMission(id: string): Promise<any> {
    const res = await api.post(`/growth/social/missions/${id}/participate`);
    return res.data.participation ?? res.data.data?.participation ?? res.data;
  },

  async claimSocialVirtualReward(id: string): Promise<{ success: boolean; crystals: number; xp: number }> {
    const res = await api.post(`/growth/social/missions/${id}/claim-virtual`);
    return res.data ?? { success: true, crystals: 0, xp: 0 };
  },

  async getUserValueBank(): Promise<UserValueBank> {
    const res = await api.get('/growth/social/value-bank');
    return res.data.valueBank ?? res.data.data?.valueBank ?? res.data;
  },
};

export interface NextBestAction {
  actionType: string;
  title: string;
  description: string;
  reason: string;
  destinationTab: 'wallet' | 'shop' | 'grow' | 'rewards' | 'hub';
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  potentialUnlockUsdt: number;
  badge?: string;
}

export interface ReferralAssistance {
  relationshipId: string;
  refereeId: string;
  name: string;
  username?: string | null;
  status: string;
  isQualified: boolean;
  missingStep: string;
  helperMessage: string;
}

export interface CanonicalFunnelStage {
  stage: string;
  name: string;
  count: number;
  conversionPct: number;
  dropoffPct: number;
  netContributionUsdt: number;
}

export interface EconomicLeakItem {
  leakId: string;
  stage: string;
  fromCount: number;
  toCount: number;
  dropoffCount: number;
  dropoffPercent: number;
  estimatedLostContributionUsdt: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  recommendedAction: string;
}

export interface RevenueOpportunityItem {
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  title: string;
  category: string;
  currentVolume: string;
  targetLiftPercent: number;
  expectedIncrementalContributionUsdt: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
}

export interface CohortEconomicsItem {
  cohortMonth: string;
  totalUsers: number;
  qualifiedUsers: number;
  payingUsers: number;
  grossRevenueUsdt: number;
  directCostUsdt: number;
  rewardSpendUsdt: number;
  netContributionUsdt: number;
  ltvUsdt: number;
  cacUsdt: number;
  retentionD30Percent: number;
}

export interface RewardLiabilityBreakdown {
  totalBudgetUsdt: number;
  availableLiabilityUsdt: number;
  committedLiabilityUsdt: number;
  disbursedSpendUsdt: number;
  remainingBudgetUsdt: number;
  budgetUtilizationPercent: number;
}

export interface ReferrerQualityItem {
  referrerId: string;
  name: string;
  username?: string | null;
  totalInvited: number;
  qualifiedCount: number;
  payingCount: number;
  netContributionUsdt: number;
  qualityScore: number;
}

export type CostBasis = 'EXACT_LEDGER' | 'ESTIMATED_RAIL_35PCT' | 'ESTIMATED_HARDWARE_70PCT' | 'ESTIMATED' | 'ZERO_COST';
export type EconomicStatus = 'PROFITABLE' | 'OPTIMIZE' | 'UNPROFITABLE';

export interface CampaignRoiItem {
  campaignCode: string;
  title: string;
  totalAcquiredUsers: number;
  totalPayingUsers: number;
  grossRevenueUsdt: number;
  directCostUsdt: number;
  rewardSpendUsdt: number;
  netContributionUsdt: number;
  incrementalContributionUsdt: number;
  cacUsdt: number;
  ltvUsdt: number;
  paybackPeriodDays: number | null;
  roi: number;
  budgetLimitUsdt?: number;
  committedLiabilityUsdt?: number;
  disbursedSpendUsdt?: number;
  availableBudgetUsdt?: number;
  budgetUtilizationPercent?: number;
  status: EconomicStatus;
}

export interface ChannelBreakdownItem {
  channel: string;
  userCount: number;
  grossRevenueUsdt: number;
  rewardSpendUsdt: number;
  netContributionUsdt: number;
  roi: number;
}

export interface TopEconomicReferrer {
  telegramUserId: string;
  username: string;
  downlineCount: number;
  networkGrossRevenueUsdt: number;
  rewardsEarnedUsdt: number;
  netContributionUsdt: number;
  networkRoi: number;
}

export interface CostBreakdown {
  exactDisbursedRewardsUsdt: number;
  estimatedRailCostsUsdt: number;
  estimatedHardwareCostsUsdt: number;
}

export interface GrowthEconomyMetrics {
  totalGrossRevenueUsdt: number;
  totalDirectCostUsdt: number;
  totalRewardSpendUsdt: number;
  netGrowthContributionUsdt: number;
  overallGrowthRoi: number;
  costBreakdown: CostBreakdown;
  campaigns: CampaignRoiItem[];
  channelBreakdown: ChannelBreakdownItem[];
  topEconomicReferrers: TopEconomicReferrer[];
}

export interface AttributionHealthMetrics {
  totalUsers: number;
  attributedUsers: number;
  unattributedUsers: number;
  referralLinkedUsers: number;
  attributionCoveragePercent: number;
  totalEconomicEvents: number;
  exactCostEvents: number;
  estimatedCostEvents: number;
  unassignedContributions: number;
  graphHealthStatus: 'HEALTHY' | 'OPTIMIZATION_REQUIRED';
}

export interface SocialMission {
  id: string;
  code: string;
  name: string;
  description: string;
  tier: 'ENGAGEMENT' | 'DISTRIBUTION' | 'ACQUISITION' | 'REVENUE';
  category: string;
  channel: string;
  virtualRewardCrystals: number;
  virtualRewardXp: number;
  maxRewardUsdt: number;
  requiredContributionUsdt: number;
  verifiedContributionUsdt: number;
  rewardRate: number;
  platformMarginBufferUsdt: number;
  progressPercent: number;
  status: string;
  isOverSettled: boolean;
  isEligible: boolean;
  isClaimed: boolean;
  virtualRewardsClaimed: boolean;
  trackingCode: string;
  attributedActionsCount: number;
  parameters?: any;
}

export interface UserValueBank {
  totalValueGeneratedUsdt: number;
  unlockedRewardsUsdt: number;
  retainedContributionUsdt: number;
  activeMissionsCount: number;
  completedMissionsCount: number;
  totalCrystalsEarned: number;
}
