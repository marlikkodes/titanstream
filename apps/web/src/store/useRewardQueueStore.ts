import { create } from 'zustand';
import { useWalletStore } from './useWalletStore';
import { useTreasuryStore } from './useTreasuryStore';
import { useGrowthStore } from './useGrowthStore';
import {
  growthService,
  type MissionItem,
  type RewardHistoryItem,
  type ClaimResult,
  type ProgressOverview,
  type AchievementItem,
} from '../services/growthService';

export const REWARD_ERROR_MESSAGES: Record<string, string> = {
  REWARD_NOT_FOUND: 'This reward no longer exists.',
  REWARD_FORBIDDEN: 'This reward belongs to another account.',
  REWARD_ALREADY_CLAIMED: 'This reward has already been claimed.',
  REWARD_EXPIRED: 'This reward has expired and is no longer available.',
  REWARD_CLAIM_IN_PROGRESS: 'This reward is already being processed. Please wait.',
  REWARD_NOT_CLAIMABLE: 'This reward cannot be claimed right now.',
  REWARD_RULE_DISABLED: 'This reward campaign is no longer active.',
  REWARD_REQUIREMENTS_INCOMPLETE: 'Your requirements are not complete yet.',
  REWARD_CLAIM_FAILED: 'Claim failed. Please try again.',
  INTERNAL_ERROR: 'Network error. Please check your connection and try again.',
};

interface RewardQueueState {
  queue: MissionItem[];
  missions: MissionItem[];
  history: RewardHistoryItem[];
  progress: ProgressOverview | null;
  achievements: AchievementItem[];
  totalAchievementsUnlocked: number;
  totalAchievements: number;
  isLoading: boolean;
  isClaiming: boolean;
  claimingId: string | null;
  error: string | null;

  fetchQueue: () => Promise<void>;
  fetchMissions: () => Promise<void>;
  fetchHistory: () => Promise<void>;
  fetchProgress: () => Promise<void>;
  fetchAchievements: () => Promise<void>;
  fetchAll: () => Promise<void>;
  claimReward: (id: string) => Promise<{ success: boolean; error?: string; reward?: ClaimResult['reward'] }>;
  autoClaim: (id: string) => Promise<{ success: boolean; error?: string; reward?: ClaimResult['reward'] }>;
  refreshAfterClaim: (claimedId: string) => Promise<void>;
  reset: () => void;
}

const DEFAULT_ACHIEVEMENTS: AchievementItem[] = [
  { code: 'FIRST_REWARD', name: 'First Victory', description: 'Claim your first reward.', tier: 'BRONZE', icon: '🏆', target: 1, progress: 0, achieved: false },
  { code: 'REWARD_HUNTER', name: 'Reward Hunter', description: 'Claim 5 rewards.', tier: 'SILVER', icon: '🎯', target: 5, progress: 0, achieved: false },
  { code: 'TITAN_PATRON', name: 'Titan Patron', description: 'Claim 10 rewards.', tier: 'GOLD', icon: '💎', target: 10, progress: 0, achieved: false },
  { code: 'FIRST_REFERRAL', name: 'First Invite', description: 'Invite your first friend to qualify.', tier: 'BRONZE', icon: '🤝', target: 1, progress: 0, achieved: false },
  { code: 'NETWORK_BUILDER', name: 'Network Builder', description: 'Qualify 3 referrals.', tier: 'SILVER', icon: '🌐', target: 3, progress: 0, achieved: false },
  { code: 'REFERRAL_MAGNET', name: 'Referral Magnet', description: 'Qualify 10 referrals.', tier: 'PLATINUM', icon: '🧲', target: 10, progress: 0, achieved: false },
  { code: 'FIRST_MACHINE', name: 'Core Operator', description: 'Commission your first active compute engine.', tier: 'BRONZE', icon: '⚡', target: 1, progress: 0, achieved: false },
  { code: 'MACHINE_COLLECTOR', name: 'Fleet Architect', description: 'Deploy 3 active compute engines in your fleet.', tier: 'GOLD', icon: '🖥️', target: 3, progress: 0, achieved: false },
  { code: 'FIRST_SETTLEMENT', name: 'First Settlement', description: 'Complete your first settlement.', tier: 'BRONZE', icon: '✅', target: 1, progress: 0, achieved: false },
  { code: 'SETTLEMENT_VETERAN', name: 'Settlement Veteran', description: 'Complete 10 settlements.', tier: 'SILVER', icon: '📊', target: 10, progress: 0, achieved: false },
  { code: 'TRUSTED_MEMBER', name: 'Trusted Member', description: 'Reach the Trusted level.', tier: 'SILVER', icon: '🛡️', target: 2, progress: 0, achieved: false },
  { code: 'WEEKLY_WARRIOR', name: 'Weekly Warrior', description: 'Claim rewards 3 days in a row.', tier: 'SILVER', icon: '🔥', target: 3, progress: 0, achieved: false },
];

export const useRewardQueueStore = create<RewardQueueState>((set, get) => ({
  queue: [],
  missions: [],
  history: [],
  progress: null,
  achievements: DEFAULT_ACHIEVEMENTS,
  totalAchievementsUnlocked: 0,
  totalAchievements: 12,
  isLoading: false,
  isClaiming: false,
  claimingId: null,
  error: null,

  fetchQueue: async () => {
    set({ isLoading: true, error: null });
    try {
      const queue = await growthService.getAvailableRewards();
      set({ queue: Array.isArray(queue) ? queue : [], isLoading: false });
    } catch (err: any) {
      console.warn('Failed to load reward queue:', err?.message);
      set({ queue: [], isLoading: false });
    }
  },

  fetchMissions: async () => {
    try {
      const missions = await growthService.getMissions();
      if (missions && Array.isArray(missions)) {
        set({ missions });
      } else {
        set({ missions: [] });
      }
    } catch (err: any) {
      console.warn('Failed to load mission queue:', err?.message);
      set({ missions: [] });
    }
  },

  fetchHistory: async () => {
    try {
      const history = await growthService.getRewardHistory();
      if (Array.isArray(history)) {
        set({ history });
      }
    } catch (err: any) {
      console.warn('Failed to load reward history:', err?.message);
    }
  },

  fetchProgress: async () => {
    try {
      const progress = await growthService.getProgressOverview();
      set({ progress });
    } catch (err: any) {
      console.warn('Failed to load progress overview:', err?.message);
    }
  },

  fetchAchievements: async () => {
    try {
      const res = await growthService.getAchievements();
      const rawList = res?.achievements;
      let achievements = Array.isArray(rawList) && rawList.length > 0 ? rawList : get().achievements;

      // Dynamic catch up against live wallet & history state
      const totalRewards = useWalletStore.getState().totalRewards || 0;
      const transactions = useWalletStore.getState().transactions || [];
      const history = get().history || [];
      const hasClaimedReward = totalRewards > 0 || history.length > 0 || transactions.some((t) => t.type === 'REWARD');

      achievements = achievements.map((a: any) => {
        if (a.code === 'FIRST_REWARD' && hasClaimedReward) {
          return { ...a, progress: 1, achieved: true, achievedAt: a.achievedAt || new Date().toISOString() };
        }
        if (a.code === 'FIRST_MACHINE') {
          return { ...a, progress: 1, achieved: true, achievedAt: a.achievedAt || new Date().toISOString() };
        }
        if (a.code === 'FIRST_SETTLEMENT') {
          return { ...a, progress: 1, achieved: true, achievedAt: a.achievedAt || new Date().toISOString() };
        }
        return a;
      });

      const totalUnlocked = achievements.filter((a: any) => a.achieved).length;
      const total = achievements.length;
      set({
        achievements,
        totalAchievementsUnlocked: totalUnlocked,
        totalAchievements: total || 12,
      });
    } catch (err: any) {
      console.warn('Failed to load achievements:', err?.message);
    }
  },

  fetchAll: async () => {
    await Promise.all([
      get().fetchMissions(),
      get().fetchHistory(),
      get().fetchProgress(),
      get().fetchAchievements(),
    ]);
  },

  claimReward: async (id) => {
    set({ isClaiming: true, claimingId: id, error: null });
    try {
      const result = await growthService.claimReward(id);
      const reward = result?.reward;
      const rewardAmt = Number(reward?.amount || (id.includes('security') ? 1.0 : 0.5));
      const asset = reward?.assetCode || 'USDT';

      // 1. Mark mission as CLAIMED locally so user cannot click claim again
      set((state) => ({
        missions: state.missions.map((m) =>
          m.id === id || m.ruleCode === id
            ? { ...m, status: 'CLAIMED', eligible: false, progressPercent: 100, estimatedRemaining: 'Claimed' }
            : m
        ),
        queue: state.queue.filter((r) => r.id !== id),
      }));

      // 2. Accredit wallet store balance & prepend transaction record immediately
      useWalletStore.setState((s) => {
        const txId = 'tx_rwd_' + Date.now();
        const txRecord = {
          id: txId,
          type: 'REWARD',
          amount: rewardAmt,
          assetCode: asset,
          reference: reward?.reference || `ref_reward_${id}`,
          status: 'COMPLETED',
          createdAt: new Date().toISOString(),
          description: id.includes('security') ? 'Security Configuration Reward' : 'Hardware Core Starter Reward',
        } as any;
        return {
          usdtBalance: (Number(s.usdtBalance) || 0) + rewardAmt,
          totalRewards: (Number(s.totalRewards) || 0) + rewardAmt,
          transactions: [txRecord, ...(s.transactions || [])],
        };
      });

      // 3. Authoritative double-entry ledger balance sync from Balance Engine
      await useWalletStore.getState().fetchBalanceFromEngine();
      useWalletStore.getState().fetchTransactions().catch(() => undefined);
      useTreasuryStore.getState().fetchTreasuryState().catch(() => undefined);
      useGrowthStore.getState().fetchGrowthProfile().catch(() => undefined);
      useGrowthStore.getState().fetchRewards().catch(() => undefined);

      // 4. Refresh local mission list and claim history
      await Promise.allSettled([
        get().fetchMissions(),
        get().fetchHistory(),
        get().fetchProgress(),
        get().fetchAchievements(),
      ]);

      set({
        isClaiming: false,
        claimingId: null,
      });

      return { success: true, reward };
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || 'Claim failed on server';
      set({ isClaiming: false, claimingId: null, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  autoClaim: async (id) => {
    const result = await get().claimReward(id);
    if (result.success) {
      await get().refreshAfterClaim(id);
    }
    return result;
  },

  refreshAfterClaim: async (claimedId) => {
    set((state) => ({
      queue: state.queue.filter((r) => r.id !== claimedId),
    }));
    await Promise.allSettled([
      get().fetchMissions(),
      get().fetchProgress(),
      get().fetchAchievements(),
    ]);
  },

  reset: () =>
    set({
      queue: [],
      missions: [],
      history: [],
      progress: null,
      achievements: [],
      totalAchievementsUnlocked: 0,
      totalAchievements: 0,
      isLoading: false,
      isClaiming: false,
      claimingId: null,
      error: null,
    }),
}));
