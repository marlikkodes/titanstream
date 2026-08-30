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

export const CANONICAL_ACHIEVEMENTS: AchievementItem[] = [
  { code: 'FIRST_REWARD', name: 'First Victory', description: 'Claim your first reward.', tier: 'BRONZE', icon: '🏆', progress: 0, target: 1, achieved: false },
  { code: 'FIRST_MACHINE', name: 'Miner', description: 'Own your first active mining machine.', tier: 'BRONZE', icon: '⛏️', progress: 1, target: 1, achieved: true },
  { code: 'FIRST_SETTLEMENT', name: 'First Settlement', description: 'Complete your first settlement.', tier: 'BRONZE', icon: '✅', progress: 0, target: 1, achieved: false },
  { code: 'FIRST_REFERRAL', name: 'First Invite', description: 'Invite your first friend to qualify.', tier: 'BRONZE', icon: '🤝', progress: 0, target: 1, achieved: false },
  { code: 'REWARD_HUNTER', name: 'Reward Hunter', description: 'Claim 5 rewards.', tier: 'SILVER', icon: '🎯', progress: 0, target: 5, achieved: false },
  { code: 'NETWORK_BUILDER', name: 'Network Builder', description: 'Qualify 3 referrals.', tier: 'SILVER', icon: '🌐', progress: 0, target: 3, achieved: false },
  { code: 'SETTLEMENT_VETERAN', name: 'Settlement Veteran', description: 'Complete 10 settlements.', tier: 'SILVER', icon: '📊', progress: 0, target: 10, achieved: false },
  { code: 'TRUSTED_MEMBER', name: 'Trusted Member', description: 'Reach the Trusted level.', tier: 'SILVER', icon: '🛡️', progress: 1, target: 2, achieved: false },
  { code: 'MACHINE_COLLECTOR', name: 'Machine Collector', description: 'Own 3 active mining machines.', tier: 'GOLD', icon: '🏭', progress: 1, target: 3, achieved: false },
  { code: 'PREMIUM_MEMBER', name: 'Premium Member', description: 'Reach the Premium level.', tier: 'GOLD', icon: '👑', progress: 0, target: 3, achieved: false },
  { code: 'TITAN_PATRON', name: 'Titan Patron', description: 'Claim 10 rewards.', tier: 'GOLD', icon: '💎', progress: 0, target: 10, achieved: false },
  { code: 'REFERRAL_MAGNET', name: 'Referral Magnet', description: 'Qualify 10 referrals.', tier: 'PLATINUM', icon: '🧲', progress: 0, target: 10, achieved: false },
];

export const useRewardQueueStore = create<RewardQueueState>((set, get) => ({
  queue: [],
  missions: [],
  history: [],
  progress: null,
  achievements: CANONICAL_ACHIEVEMENTS,
  totalAchievementsUnlocked: 1,
  totalAchievements: CANONICAL_ACHIEVEMENTS.length,
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
      const data = await growthService.getAchievements();
      if (data && Array.isArray(data.achievements) && data.achievements.length > 0) {
        set({
          achievements: data.achievements,
          totalAchievementsUnlocked: data.totalUnlocked || 0,
          totalAchievements: data.total || data.achievements.length,
        });
      }
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

      // 1. Authoritative double-entry ledger balance sync from Balance Engine
      await useWalletStore.getState().fetchBalanceFromEngine();
      useWalletStore.getState().fetchTransactions().catch(() => undefined);
      useTreasuryStore.getState().fetchTreasuryState().catch(() => undefined);
      useGrowthStore.getState().fetchGrowthProfile().catch(() => undefined);
      useGrowthStore.getState().fetchRewards().catch(() => undefined);

      // 2. Refresh local mission list and claim history
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
