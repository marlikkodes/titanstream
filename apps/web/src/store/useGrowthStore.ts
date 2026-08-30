import { create } from 'zustand';
import {
  growthService,
  type GrowthProfile,
  type ReferralSummary,
  type RewardItem,
  type QualificationStatus,
  type NextBestAction,
} from '../services/growthService';

interface GrowthState {
  profile: GrowthProfile | null;
  referrals: ReferralSummary | null;
  rewards: RewardItem[];
  qualification: QualificationStatus | null;
  nextBestAction: NextBestAction | null;
  dashboardData: any | null;
  trustCenterData: any | null;
  isLoading: boolean;
  error: string | null;

  fetchGrowthProfile: () => Promise<void>;
  fetchReferrals: () => Promise<void>;
  fetchRewards: () => Promise<void>;
  fetchQualification: () => Promise<void>;
  fetchNextBestAction: () => Promise<void>;
  fetchDashboardData: () => Promise<void>;
  fetchTrustCenterData: () => Promise<void>;
}

export const useGrowthStore = create<GrowthState>((set) => ({
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

