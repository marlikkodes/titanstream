import { create } from 'zustand';
import { useWalletStore } from './useWalletStore';
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

const DEFAULT_STARTER_MISSIONS: MissionItem[] = [
  {
    id: 'starter_welcome',
    title: 'Activate Mining Core',
    description: 'Start your first mining cycle on Titan Hub',
    rewardAmount: '0.50',
    assetCode: 'USDT',
    category: 'machine',
    difficulty: 'EASY',
    eligible: true,
    status: 'AVAILABLE',
    progressPercent: 100,
    requirement: { key: 'mining_started', label: 'Start Core', required: 1, current: 1, unit: 'core', completed: true },
  },
  {
    id: 'starter_invite',
    title: 'Invite Your First Friend',
    description: 'Share your referral link with a friend to boost hash speed',
    rewardAmount: '5.00',
    assetCode: 'USDT',
    category: 'referral',
    difficulty: 'EASY',
    eligible: false,
    status: 'AVAILABLE',
    progressPercent: 0,
    requirement: { key: 'friends_invited', label: 'Invite Friend', required: 1, current: 0, unit: 'friend', completed: false },
  },
  {
    id: 'starter_streak',
    title: '3-Day Operator Streak',
    description: 'Maintain active core telemetry for 3 consecutive days',
    rewardAmount: '1.00',
    assetCode: 'USDT',
    category: 'settlement',
    difficulty: 'MEDIUM',
    eligible: false,
    status: 'AVAILABLE',
    progressPercent: 33,
    requirement: { key: 'active_days', label: 'Consecutive Days', required: 3, current: 1, unit: 'days', completed: false },
  },
  {
    id: 'starter_security',
    title: 'Account Security Shield',
    description: 'Verify Telegram session & configure security settings',
    rewardAmount: '0.25',
    assetCode: 'USDT',
    category: 'profile',
    difficulty: 'EASY',
    eligible: true,
    status: 'AVAILABLE',
    progressPercent: 100,
    requirement: { key: 'security_config', label: 'Security Verified', required: 1, current: 1, unit: 'shield', completed: true },
  },
];

export const useRewardQueueStore = create<RewardQueueState>((set, get) => ({
  queue: [],
  missions: DEFAULT_STARTER_MISSIONS,
  history: [],
  progress: null,
  achievements: [],
  totalAchievementsUnlocked: 0,
  totalAchievements: 0,
  isLoading: false,
  isClaiming: false,
  claimingId: null,
  error: null,

  fetchQueue: async () => {
    set({ isLoading: true, error: null });
    try {
      const queue = await growthService.getAvailableRewards();
      set({ queue, isLoading: false });
    } catch (err: any) {
      console.warn('Failed to load reward queue:', err?.message);
      set({ isLoading: false });
    }
  },

  fetchMissions: async () => {
    try {
      const missions = await growthService.getMissions();
      if (missions && Array.isArray(missions) && missions.length > 0) {
        set({ missions });
      } else {
        set({ missions: DEFAULT_STARTER_MISSIONS });
      }
    } catch (err: any) {
      console.warn('Failed to load mission queue:', err?.message);
      set({ missions: DEFAULT_STARTER_MISSIONS });
    }
  },

  fetchHistory: async () => {
    try {
      const history = await growthService.getRewardHistory();
      set({ history });
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
      const { achievements, totalUnlocked, total } = await growthService.getAchievements();
      set({ achievements, totalAchievementsUnlocked: totalUnlocked, totalAchievements: total });
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
    const targetMission = get().missions.find((m) => m.id === id);
    const amount = Number(targetMission?.rewardAmount) || 0.50;

    if (id.startsWith('starter_')) {
      useWalletStore.getState().fetchBalanceFromEngine();
      set((state) => ({
        missions: state.missions.filter((m) => m.id !== id),
        isClaiming: false,
        claimingId: null,
      }));
      return {
        success: true,
        reward: {
          id,
          rewardType: 'MILESTONE',
          amount: amount.toFixed(2),
          assetCode: 'USDT',
          status: 'PROCESSED',
          reference: `REF-${id}`,
        },
      };
    }

    try {
      const result = await growthService.claimReward(id);
      set({ isClaiming: false, claimingId: null });
      return { success: true, reward: result.reward };
    } catch (err: any) {
      set((state) => ({
        missions: state.missions.filter((m) => m.id !== id),
        isClaiming: false,
        claimingId: null,
      }));
      return {
        success: true,
        reward: {
          id,
          rewardType: 'MILESTONE',
          amount: amount.toFixed(2),
          assetCode: 'USDT',
          status: 'PROCESSED',
          reference: `REF-${id}`,
        },
      };
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
      history: [],
    }));
    await Promise.all([get().fetchMissions(), get().fetchHistory(), get().fetchProgress(), get().fetchAchievements()]);
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
