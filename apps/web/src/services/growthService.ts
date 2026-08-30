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
    return res.data.data;
  },

  async getAchievements(): Promise<{
    achievements: AchievementItem[];
    totalUnlocked: number;
    total: number;
    justUnlocked: Array<{ code: string; name: string; tier: string }>;
  }> {
    const res = await api.get('/growth/achievements');
    return res.data.data;
  },

  async getRewardDetail(id: string): Promise<RewardQueueItem> {
    const res = await api.get(`/growth/rewards/${id}`);
    return res.data.data;
  },

  async claimReward(id: string): Promise<ClaimResult> {
    const res = await api.post(`/growth/rewards/${id}/claim`);
    return res.data.data;
  },

  async getRewardHistory(): Promise<RewardHistoryItem[]> {
    const res = await api.get('/growth/rewards/history');
    return res.data.data.history;
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
};
