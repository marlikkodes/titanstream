import { create } from 'zustand';
import {
  growthService,
  type GrowthProfile,
  type ReferralSummary,
  type RewardItem,
  type QualificationStatus,
  type NextBestAction,
  type SocialMission,
  type UserValueBank,
} from '../services/growthService';

interface GrowthState {
  profile: GrowthProfile | null;
  referrals: ReferralSummary | null;
  rewards: RewardItem[];
  socialMissions: SocialMission[];
  valueBank: UserValueBank | null;
  qualification: QualificationStatus | null;
  nextBestAction: NextBestAction | null;
  dashboardData: any | null;
  trustCenterData: any | null;
  isLoading: boolean;
  error: string | null;

  fetchGrowthProfile: () => Promise<void>;
  fetchReferrals: () => Promise<void>;
  fetchRewards: () => Promise<void>;
  fetchSocialMissions: () => Promise<void>;
  fetchValueBank: () => Promise<void>;
  participateInSocialMission: (id: string) => Promise<any>;
  claimSocialVirtualReward: (id: string) => Promise<any>;
  fetchQualification: () => Promise<void>;
  fetchNextBestAction: () => Promise<void>;
  fetchDashboardData: () => Promise<void>;
  fetchTrustCenterData: () => Promise<void>;
}

export const useGrowthStore = create<GrowthState>((set, get) => ({
  profile: null,
  referrals: null,
  rewards: [],
  qualification: null,
  nextBestAction: null,
  dashboardData: null,
  trustCenterData: null,
  isLoading: false,
  error: null,

  fetchGrowthProfile: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await growthService.getProfile();
      set({ profile: data, isLoading: false });
    } catch (err: any) {
      set({ error: err?.message || 'Failed to load growth profile', isLoading: false });
    }
  },

  fetchReferrals: async () => {
    try {
      const data = await growthService.getReferrals();
      set({ referrals: data });
    } catch (err: any) {
      console.warn('Failed to load referrals:', err?.message);
    }
  },

  fetchRewards: async () => {
    try {
      const data = await growthService.getRewards();
      set({ rewards: data });
    } catch (err: any) {
      console.warn('Failed to load rewards:', err?.message);
    }
  },

  fetchQualification: async () => {
    try {
      const data = await growthService.getQualification();
      set({ qualification: data });
    } catch (err: any) {
      console.warn('Failed to load qualification:', err?.message);
    }
  },

  fetchNextBestAction: async () => {
    try {
      const data = await growthService.getNextBestAction();
      set({ nextBestAction: data });
    } catch (err: any) {
      console.warn('Failed to load next best action:', err?.message);
    }
  },

  socialMissions: [],
  valueBank: null,

  fetchSocialMissions: async () => {
    try {
      const data = await growthService.getSocialMissions();
      set({ socialMissions: data });
    } catch (err: any) {
      console.warn('Failed to load social missions:', err?.message);
    }
  },

  fetchValueBank: async () => {
    try {
      const data = await growthService.getUserValueBank();
      set({ valueBank: data });
    } catch (err: any) {
      console.warn('Failed to load value bank:', err?.message);
    }
  },

  participateInSocialMission: async (id: string) => {
    try {
      const res = await growthService.participateInSocialMission(id);
      await get().fetchSocialMissions();
      return res;
    } catch (err: any) {
      console.warn('Failed to participate in social mission:', err?.message);
      throw err;
    }
  },

  claimSocialVirtualReward: async (id: string) => {
    try {
      const res = await growthService.claimSocialVirtualReward(id);
      await get().fetchSocialMissions();
      await get().fetchValueBank();
      return res;
    } catch (err: any) {
      console.warn('Failed to claim social virtual reward:', err?.message);
      throw err;
    }
  },

  fetchDashboardData: async () => {
    try {
      const data = await growthService.getDashboard();
      set({ dashboardData: data });
    } catch (err: any) {
      console.warn('Failed to load growth dashboard:', err?.message);
    }
  },

  fetchTrustCenterData: async () => {
    try {
      const data = await growthService.getTrustCenter();
      set({ trustCenterData: data });
    } catch (err: any) {
      console.warn('Failed to load trust center:', err?.message);
    }
  },
}));

