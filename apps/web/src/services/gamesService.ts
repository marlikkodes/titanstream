import { api } from './api';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GameRewardPreview {
  minCrystals: number;
  maxCrystals: number;
  maxUsdt: string;
}

export interface GamePlayerStat {
  gameId: string;
  gamesPlayed: number;
  gamesWon: number;
  highestScore: number;
  bestCombo: number;
  bestAccuracy: number;
  bestReactionMs: number;
  bestMoves: number;
  bestTimeMs: number;
  bestEfficiency: number;
  levelsCompleted: number;
  perfectSessions: number;
  xpEarned: number;
  lastPlayedAt: string | null;
}

export interface GameCatalogItem {
  gameId: string;
  code: string;
  name: string;
  description: string;
  category: 'chance' | 'skill' | 'puzzle' | string;
  icon: string;
  accentColor: string;
  crystalCost: number;
  dailyLimit: number;
  estimatedDurationSec: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
  enabled: boolean;
  rewardPreview: GameRewardPreview;
  playsUsedToday: number;
  currentCost: number;
  winScoreThreshold: number;
  rules?: string[];
  personalBest: GamePlayerStat | null;
  leaderboardRank: number | null;
  sectors?: Array<{ label: string; type: 'USDT' | 'CRYSTALS' | 'BOOST'; value: number; weight: number; premium: boolean }>;
}

export interface GameEventItem {
  code: string;
  title: string;
  description: string;
  gameId: string | null;
  crystalMultiplier: number;
  usdtMultiplier: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
}

export interface DailyChallengeItem {
  id: string;
  code: string;
  gameId: string;
  gameName: string;
  gameIcon: string;
  title: string;
  description: string;
  objectiveType: string;
  target: number;
  rewardCrystals: number;
  rewardXp: number;
  completedToday: boolean;
  progress: number;
}

export interface GameCatalogResponse {
  balance: number;
  events: GameEventItem[];
  games: GameCatalogItem[];
  dailyChallenge: DailyChallengeItem | null;
}

export interface GameStartSession {
  sessionId: string;
  gameId: string;
  gameName: string;
  crystalCost: number;
  serverStartedAt: string;
  chanceGame: boolean;
  outcomeSectorIndex: number | null;
  message: string;
}

export interface GameSessionStats {
  combo?: number;
  accuracy?: number;
  reactionMs?: number;
  moves?: number;
  efficiency?: number;
  levelsCompleted?: number;
  perfect?: boolean;
}

export interface GameEndResult {
  sessionId: string;
  gameId: string;
  gameName: string;
  status: string;
  score: number;
  crystalsEarned: number;
  usdtEarned: string | null;
  usdtRewardId: string | null;
  xpEarned: number;
  stats: GameSessionStats | null;
  isNewPersonalBest: boolean;
  levelUp: { from: number; to: number } | null;
  grantCount: number;
  challenge: { completed: boolean; rewardCrystals: number; rewardXp: number } | null;
  unlockedAchievements: Array<{ code: string; name: string; tier: string }>;
  verdict: { ok: boolean; status: string; reasons: string[] };
  message: string;
}

export interface GameProfileView {
  telegramUserId: string;
  highestScore: number;
  gamesPlayed: number;
  gamesWon: number;
  winStreak: number;
  bestWinStreak: number;
  dailyStreak: number;
  totalCrystalsEarned: number;
  totalCrystalsSpent: number;
  lastPlayedAt: string | null;
  lastDailyClaimAt: string | null;
}

export interface DailyLoginStatus {
  claimedToday: boolean;
  dailyStreak: number;
  streakContinues: boolean;
  baseReward: number;
  streakBonus: number;
  machineBonus: number;
  activeMachines: number;
  totalReward: number;
}

export interface LeaderboardEntry {
  rank: number;
  telegramUserId: string;
  displayName: string;
  username: string | null;
  country: string | null;
  score: number;
  crystalsEarned: number;
  gamesPlayed: number;
  achievedAt: string | null;
}

export interface LeaderboardResponse {
  period: 'daily' | 'weekly' | 'all';
  scope: 'global' | 'friends';
  gameId: string | null;
  entries: LeaderboardEntry[];
  myRank: number | null;
}

// ─── Game Economy Service ────────────────────────────────────────────────────
// All economy state is owned by the backend. The client never writes balances;
// it only reads the crystal ledger and starts/ends server-validated sessions.

export const gamesService = {
  async getCatalog(): Promise<GameCatalogResponse> {
    const response = await api.get('/games/catalog');
    return response.data.data;
  },

  async getBalance(): Promise<{ balance: number; lifetimeEarned: number; lifetimeSpent: number }> {
    try {
      const response = await api.get('/games/balance');
      const data = response.data?.data ?? response.data;
      if (data && typeof data.balance === 'number') {
        return {
          balance: data.balance,
          lifetimeEarned: data.lifetimeEarned ?? data.balance,
          lifetimeSpent: data.lifetimeSpent ?? 0,
        };
      }
      return { balance: 0, lifetimeEarned: 0, lifetimeSpent: 0 };
    } catch {
      return { balance: 0, lifetimeEarned: 0, lifetimeSpent: 0 };
    }
  },

  async getProfile(): Promise<{ profile: GameProfileView; dailyLogin: DailyLoginStatus }> {
    try {
      const response = await api.get('/games/profile');
      return response.data?.data ?? response.data;
    } catch {
      return {
        profile: { totalGamesPlayed: 0, highestScore: 0, crystals: 0, totalAchievements: 0 },
        dailyLogin: { eligible: false, streak: 0, rewardAmount: 0, nextClaimAt: '' },
      } as any;
    }
  },

  async claimDailyLogin(): Promise<{ balance: number; amount: number; dailyStreak: number }> {
    const response = await api.post('/games/daily-login/claim');
    return response.data.data;
  },

  async startSession(gameId: string): Promise<GameStartSession> {
    const response = await api.post(`/games/${gameId}/session/start`);
    return response.data.data;
  },

  async endSession(
    gameId: string,
    sessionId: string,
    payload: {
      score: number;
      durationMs?: number;
      telemetry?: Array<{ action: string; t: number }>;
      stats?: GameSessionStats;
    },
  ): Promise<GameEndResult> {
    const response = await api.post(`/games/${gameId}/session/${sessionId}/end`, payload);
    return response.data.data;
  },

  async getTodayChallenge(): Promise<{ challenge: DailyChallengeItem | null }> {
    const response = await api.get('/games/challenges');
    return response.data.data;
  },

  async getGrants(limit = 50, offset = 0) {
    const response = await api.get('/games/grants', { params: { limit, offset } });
    return response.data.data;
  },

  async getLeaderboard(
    params: { gameId?: string; period?: 'daily' | 'weekly' | 'all'; scope?: 'global' | 'friends' } = {},
  ): Promise<LeaderboardResponse> {
    const response = await api.get('/games/leaderboard', { params });
    return response.data.data;
  },

  async getEvents(): Promise<{ items: GameEventItem[] }> {
    const response = await api.get('/games/events');
    return response.data.data;
  },

  async getHistory(limit = 30, offset = 0) {
    const response = await api.get('/games/history', { params: { limit, offset } });
    return response.data.data;
  },

  async getTransactions(limit = 50, offset = 0) {
    const response = await api.get('/games/transactions', { params: { limit, offset } });
    return response.data.data;
  },
};
