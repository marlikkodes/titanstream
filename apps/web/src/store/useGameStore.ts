import { create } from 'zustand';
import {
  gamesService,
  type GameCatalogItem,
  type GameCatalogResponse,
  type GameEndResult,
  type GameEventItem,
  type GameProfileView,
  type DailyLoginStatus,
  type DailyChallengeItem,
  type LeaderboardResponse,
} from '../services/gamesService';

interface GameStoreState {
  balance: number;
  games: GameCatalogItem[];
  events: GameEventItem[];
  profile: GameProfileView | null;
  dailyLogin: DailyLoginStatus | null;
  dailyChallenge: DailyChallengeItem | null;
  leaderboard: LeaderboardResponse | null;
  lastResult: GameEndResult | null;

  isLoading: boolean;
  isLoadingLeaderboard: boolean;
  error: string | null;

  loadHub: () => Promise<void>;
  refreshBalance: () => Promise<number | null>;
  claimDailyLogin: () => Promise<{ balance: number; amount: number; dailyStreak: number } | null>;
  loadLeaderboard: (params?: { gameId?: string; period?: 'daily' | 'weekly' | 'all'; scope?: 'global' | 'friends' }) => Promise<void>;
  setLastResult: (result: GameEndResult | null) => void;
  clearError: () => void;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  balance: 0,
  games: [],
  events: [],
  profile: null,
  dailyLogin: null,
  dailyChallenge: null,
  leaderboard: null,
  lastResult: null,

  isLoading: false,
  isLoadingLeaderboard: false,
  error: null,

  loadHub: async () => {
    set({ isLoading: true, error: null });
    try {
      const [catalog, profileData]: [GameCatalogResponse, { profile: GameProfileView; dailyLogin: DailyLoginStatus }] =
        await Promise.all([gamesService.getCatalog(), gamesService.getProfile()]);
      set({
        balance: catalog.balance,
        games: catalog.games ?? [],
        events: catalog.events ?? [],
        dailyChallenge: catalog.dailyChallenge,
        profile: profileData.profile,
        dailyLogin: profileData.dailyLogin,
        isLoading: false,
      });
    } catch (err: any) {
      console.warn('[GameStore] Hub load failed:', err?.message);
      set({ isLoading: false, error: err?.response?.data?.error?.message ?? err?.message ?? 'Failed to load games hub.' });
    }
  },

  refreshBalance: async () => {
    try {
      const data = await gamesService.getBalance();
      set({ balance: data.balance });
      return data.balance;
    } catch (err: any) {
      console.warn('[GameStore] Balance refresh failed:', err?.message);
      return null;
    }
  },

  claimDailyLogin: async () => {
    try {
      const result = await gamesService.claimDailyLogin();
      set({ balance: result.balance });
      const profileData = await gamesService.getProfile();
      set({ profile: profileData.profile, dailyLogin: profileData.dailyLogin });
      return result;
    } catch (err: any) {
      console.warn('[GameStore] Daily login claim failed:', err?.message);
      return null;
    }
  },

  loadLeaderboard: async (params = {}) => {
    set({ isLoadingLeaderboard: true });
    try {
      const data = await gamesService.getLeaderboard(params);
      set({ leaderboard: data, isLoadingLeaderboard: false });
    } catch (err: any) {
      console.warn('[GameStore] Leaderboard load failed:', err?.message);
      set({ isLoadingLeaderboard: false });
    }
  },

  setLastResult: (result) => set({ lastResult: result }),
  clearError: () => set({ error: null }),
}));
