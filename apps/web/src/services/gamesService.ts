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

const FALLBACK_GAMES: GameCatalogItem[] = [
  {
    gameId: 'hoop-masters',
    code: 'HOOPS',
    name: 'Titan Hoop',
    description: 'Aim & swipe to launch. Chain combo swishes and activate Fire Mode!',
    category: 'skill',
    icon: '🏀',
    accentColor: '#0088cc',
    crystalCost: 3,
    dailyLimit: 15,
    estimatedDurationSec: 60,
    difficulty: 'MEDIUM',
    enabled: true,
    rewardPreview: { minCrystals: 1, maxCrystals: 10, maxUsdt: '0.10' },
    playsUsedToday: 0,
    currentCost: 3,
    winScoreThreshold: 5,
    rules: [
      'Entry costs 3 💎 crystals.',
      'Touch and swipe towards the hoop to shoot.',
      'Aim arc shows predicted ball flight trajectory.',
      'Clean swishes give bonus points and streak flame!',
      'Reach streak x3 to activate Fire Mode for 2x payouts!',
    ],
    personalBest: null,
    leaderboardRank: null,
  },
  {
    gameId: 'crypto-roulette',
    code: 'ROULETTE',
    name: 'Titan Vault Wheel',
    description: 'Spin the high-torque titanium vault wheel for instant crystal multipliers and direct USDT prizes.',
    category: 'chance',
    icon: '🎡',
    accentColor: '#00e676',
    crystalCost: 5,
    dailyLimit: 10,
    estimatedDurationSec: 30,
    difficulty: 'EASY',
    enabled: true,
    rewardPreview: { minCrystals: 10, maxCrystals: 100, maxUsdt: '1.00' },
    playsUsedToday: 0,
    currentCost: 5,
    winScoreThreshold: 1,
    rules: ['Entry costs 5 💎.', 'Outcomes are determined server-side.'],
    personalBest: null,
    leaderboardRank: null,
    sectors: [
      { label: '₮50.00 GRAND', type: 'USDT', value: 50.0, weight: 0, premium: true },
      { label: '15 💎 LUCKY', type: 'CRYSTALS', value: 15, weight: 20, premium: false },
      { label: '₮25.00 MEGA', type: 'USDT', value: 25.0, weight: 0, premium: true },
      { label: '10 💎 WIN', type: 'CRYSTALS', value: 10, weight: 25, premium: false },
      { label: '₮10.00 TITAN', type: 'USDT', value: 10.0, weight: 0, premium: true },
      { label: '⚡×2.0 BOOST', type: 'BOOST', value: 2.0, weight: 5, premium: true },
      { label: '₮1.00 JACKPOT', type: 'USDT', value: 1.0, weight: 1, premium: true },
      { label: '50 💎 BIG POT', type: 'CRYSTALS', value: 50, weight: 4, premium: true },
      { label: '₮0.50 HIGH', type: 'USDT', value: 0.50, weight: 3, premium: true },
      { label: '100 💎 MEGA', type: 'CRYSTALS', value: 100, weight: 1, premium: true },
      { label: '₮0.25 VAULT', type: 'USDT', value: 0.25, weight: 8, premium: true },
      { label: '⚡×1.5 BOOST', type: 'BOOST', value: 1.5, weight: 18, premium: false },
    ],
  },
  {
    gameId: 'titan-core-reactor',
    code: 'REACTOR',
    name: 'Titan Reactor',
    description: 'Reflex challenge. Tap energy nodes before they decay to prevent core meltdown.',
    category: 'skill',
    icon: '⚛️',
    accentColor: '#ff007f',
    crystalCost: 5,
    dailyLimit: 10,
    estimatedDurationSec: 45,
    difficulty: 'HARD',
    enabled: true,
    rewardPreview: { minCrystals: 1, maxCrystals: 15, maxUsdt: '0.20' },
    playsUsedToday: 0,
    currentCost: 5,
    winScoreThreshold: 8,
    rules: ['Tap active energy nodes to build combo multipliers.', 'Maintain high reaction speed.'],
    personalBest: null,
    leaderboardRank: null,
  },
  {
    gameId: 'power-grid',
    code: 'GRID',
    name: 'Power Grid',
    description: 'Circuit puzzle. Rotate power lines to connect the substation to the generator.',
    category: 'puzzle',
    icon: '⚡',
    accentColor: '#ffb300',
    crystalCost: 4,
    dailyLimit: 12,
    estimatedDurationSec: 90,
    difficulty: 'MEDIUM',
    enabled: true,
    rewardPreview: { minCrystals: 2, maxCrystals: 12, maxUsdt: '0.15' },
    playsUsedToday: 0,
    currentCost: 4,
    winScoreThreshold: 3,
    rules: ['Tap tiles to rotate circuit paths.', 'Form a continuous line from source to generator.'],
    personalBest: null,
    leaderboardRank: null,
  },
  {
    gameId: 'memory-matrix',
    code: 'MEMORY',
    name: 'Memory Matrix',
    description: 'Pattern-recognition challenge. Memorize the light sequence and repeat it.',
    category: 'skill',
    icon: '🧠',
    accentColor: '#00e5ff',
    crystalCost: 3,
    dailyLimit: 10,
    estimatedDurationSec: 60,
    difficulty: 'MEDIUM',
    enabled: true,
    rewardPreview: { minCrystals: 1, maxCrystals: 8, maxUsdt: '0.10' },
    playsUsedToday: 0,
    currentCost: 3,
    winScoreThreshold: 4,
    rules: ['Memorize flashing grid pattern.', 'Repeat sequence accurately within time.'],
    personalBest: null,
    leaderboardRank: null,
  },
];

export const gamesService = {
  async getCatalog(): Promise<GameCatalogResponse> {
    try {
      const response = await api.get('/games/catalog');
      const data = response.data?.data ?? response.data;
      if (data && Array.isArray(data.games) && data.games.length > 0) {
        return {
          balance: typeof data.balance === 'number' ? data.balance : 100,
          events: Array.isArray(data.events) ? data.events : [],
          games: data.games,
          dailyChallenge: data.dailyChallenge ?? null,
        };
      }
    } catch (err: any) {
      console.warn('[gamesService] getCatalog network error, using fallback catalog:', err?.message);
    }
    return {
      balance: 100,
      events: [],
      games: FALLBACK_GAMES,
      dailyChallenge: null,
    };
  },

  async getBalance(): Promise<{ balance: number; lifetimeEarned: number; lifetimeSpent: number }> {
    try {
      const response = await api.get('/games/balance');
      return response.data?.data ?? response.data ?? { balance: 100, lifetimeEarned: 100, lifetimeSpent: 0 };
    } catch {
      return { balance: 100, lifetimeEarned: 100, lifetimeSpent: 0 };
    }
  },

  async getProfile(): Promise<{ profile: GameProfileView; dailyLogin: DailyLoginStatus }> {
    try {
      const response = await api.get('/games/profile');
      const data = response.data?.data ?? response.data;
      if (data?.profile) return data;
    } catch {}
    return {
      profile: {
        telegramUserId: '100000001',
        highestScore: 0,
        gamesPlayed: 0,
        gamesWon: 0,
        winStreak: 0,
        bestWinStreak: 0,
        dailyStreak: 1,
        totalCrystalsEarned: 0,
        totalCrystalsSpent: 0,
        lastPlayedAt: null,
        lastDailyClaimAt: null,
      },
      dailyLogin: {
        claimedToday: false,
        dailyStreak: 1,
        streakContinues: true,
        baseReward: 10,
        streakBonus: 0,
        machineBonus: 0,
        activeMachines: 1,
        totalReward: 10,
      },
    };
  },

  async claimDailyLogin(): Promise<{ balance: number; amount: number; dailyStreak: number }> {
    const response = await api.post('/games/daily-login/claim');
    return response.data?.data ?? response.data;
  },

  async startSession(gameId: string): Promise<GameStartSession> {
    const response = await api.post(`/games/${gameId}/session/start`);
    return response.data?.data ?? response.data;
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
