import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { GameCatalog, GameDifficulty, Prisma } from '@prisma/client';
import type {
  GameCatalogView,
  GameRewardConfig,
  CrystalRewardBand,
  UsdtRewardBand,
  RouletteSectorConfig,
  GamePlayerStatView,
} from './game-types';

interface DefaultGameSeed {
  gameId: string;
  code: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  accentColor: string;
  crystalCost: number;
  dailyLimit: number;
  estimatedDurationSec: number;
  difficulty: GameDifficulty;
  rewardConfig: GameRewardConfig;
}

const CRYSTAL_1_10: CrystalRewardBand[] = [
  { minScore: 0, maxScore: 2, crystals: 1 },
  { minScore: 3, maxScore: 5, crystals: 2 },
  { minScore: 6, maxScore: 9, crystals: 3 },
  { minScore: 10, maxScore: 14, crystals: 4 },
  { minScore: 15, maxScore: 1000, crystals: 5 },
];

const USDT_100_DAILY: UsdtRewardBand[] = [
  { minScore: 0, maxScore: 14, usdt: '0', probability: 0 },
  { minScore: 15, maxScore: 24, usdt: '0.05', probability: 0.15 },
  { minScore: 25, maxScore: 1000, usdt: '0.10', probability: 0.25 },
];

const DEFAULT_GAMES: DefaultGameSeed[] = [
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
    difficulty: GameDifficulty.EASY,
    rewardConfig: {
      chanceGame: true,
      minDurationMs: 1000,
      maxDurationMs: 180000,
      winScoreThreshold: 1,
      escalationEnabled: true,
      dailyUsdtCap: '1.00',
      grants: {
        xpOnComplete: 4,
        xpOnWin: 8,
        eventPointsOnComplete: 4,
        mysteryBoxChance: 0.02,
        machineBoostChance: 0.01,
      },
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
  },
  {
    gameId: 'hoop-masters',
    code: 'HOOPS',
    name: 'Titan Hoop',
    description: 'Swipe to launch. Chain baskets to build combo streaks and earn crystals.',
    category: 'skill',
    icon: '🏀',
    accentColor: '#0088cc',
    crystalCost: 3,
    dailyLimit: 15,
    estimatedDurationSec: 60,
    difficulty: GameDifficulty.MEDIUM,
    rewardConfig: {
      minDurationMs: 15000,
      maxDurationMs: 300000,
      minScorePerSecond: 0.02,
      maxScorePerSecond: 2,
      winScoreThreshold: 5,
      xpPerScore: 2,
      grants: {
        xpOnComplete: 5,
        xpOnWin: 10,
        eventPointsOnComplete: 4,
        mysteryBoxChance: 0.02,
        machineBoostChance: 0.01,
      },
      antiCheat: {
        maxEventsPerScore: 2.5,
        minEventIntervalMs: 350,
        maxScorePerSecond: 2,
      },
      stats: {
        trackCombo: true,
        trackAccuracy: true,
        trackPerfect: true,
      },
      crystalRewards: [
        { minScore: 0, maxScore: 4, crystals: 1 },
        { minScore: 5, maxScore: 9, crystals: 3 },
        { minScore: 10, maxScore: 19, crystals: 6 },
        { minScore: 20, maxScore: 1000, crystals: 10 },
      ],
      usdtRewards: [
        { minScore: 0, maxScore: 14, usdt: '0', probability: 0 },
        { minScore: 15, maxScore: 29, usdt: '0.05', probability: 0.15 },
        { minScore: 30, maxScore: 1000, usdt: '0.10', probability: 0.2 },
      ],
    },
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
    estimatedDurationSec: 75,
    difficulty: GameDifficulty.MEDIUM,
    rewardConfig: {
      minDurationMs: 10000,
      maxDurationMs: 300000,
      minScorePerSecond: 0.02,
      maxScorePerSecond: 1.5,
      winScoreThreshold: 3,
      xpPerScore: 6,
      grants: {
        xpOnComplete: 5,
        xpOnWin: 12,
        eventPointsOnComplete: 4,
        mysteryBoxChance: 0.02,
        machineBoostChance: 0.01,
      },
      antiCheat: {
        maxEventsPerScore: 3,
        minEventIntervalMs: 300,
        maxScorePerSecond: 1.5,
      },
      stats: {
        trackCombo: true,
        trackPerfect: true,
      },
      crystalRewards: [
        { minScore: 0, maxScore: 2, crystals: 1 },
        { minScore: 3, maxScore: 5, crystals: 3 },
        { minScore: 6, maxScore: 9, crystals: 5 },
        { minScore: 10, maxScore: 1000, crystals: 8 },
      ],
      usdtRewards: [
        { minScore: 0, maxScore: 9, usdt: '0', probability: 0 },
        { minScore: 10, maxScore: 1000, usdt: '0.05', probability: 0.2 },
      ],
    },
  },
  {
    gameId: 'titan-core-reactor',
    code: 'REACTOR',
    name: 'Titan Reactor',
    description: 'Energy nodes overload across the grid. Tap them before they fail — speed, combos and accuracy rule the core.',
    category: 'skill',
    icon: '⚛️',
    accentColor: '#ffb300',
    crystalCost: 5,
    dailyLimit: 12,
    estimatedDurationSec: 45,
    difficulty: GameDifficulty.MEDIUM,
    rewardConfig: {
      minDurationMs: 15000,
      maxDurationMs: 180000,
      minScorePerSecond: 0.05,
      maxScorePerSecond: 4,
      winScoreThreshold: 100,
      escalationEnabled: true,
      xpPerScore: 0.2,
      grants: {
        xpOnComplete: 5,
        xpOnWin: 15,
        eventPointsOnComplete: 5,
        mysteryBoxChance: 0.03,
        machineBoostChance: 0.02,
      },
      antiCheat: {
        maxEventsPerScore: 2.5,
        minEventIntervalMs: 220,
        maxScorePerSecond: 4,
        requireScoreTelemetry: true,
      },
      stats: {
        trackCombo: true,
        trackAccuracy: true,
        trackReactionMs: true,
        trackPerfect: true,
      },
      rules: [
        'Nodes overload across the grid — tap each one before its timer expires.',
        'Hitting a node within 60% of its window counts as FAST (+1 combo).',
        'A missed node breaks your combo and costs 10 points.',
        'The grid speeds up every 10 seconds. Accuracy beats raw speed.',
        'A perfect run (100% accuracy) counts as a perfect session.',
      ],
      crystalRewards: [
        { minScore: 0, maxScore: 49, crystals: 2 },
        { minScore: 50, maxScore: 99, crystals: 4 },
        { minScore: 100, maxScore: 199, crystals: 7 },
        { minScore: 200, maxScore: 349, crystals: 11 },
        { minScore: 350, maxScore: 100000, crystals: 16 },
      ],
      usdtRewards: [
        { minScore: 0, maxScore: 199, usdt: '0', probability: 0 },
        { minScore: 200, maxScore: 349, usdt: '0.05', probability: 0.2 },
        { minScore: 350, maxScore: 100000, usdt: '0.15', probability: 0.25 },
      ],
    },
  },
  {
    gameId: 'power-grid',
    code: 'GRID',
    name: 'Power Grid',
    description: 'Rotate pipes to connect generators to batteries. Restore the grid with precision — every move counts.',
    category: 'puzzle',
    icon: '🔋',
    accentColor: '#7c4dff',
    crystalCost: 4,
    dailyLimit: 10,
    estimatedDurationSec: 120,
    difficulty: GameDifficulty.MEDIUM,
    rewardConfig: {
      minDurationMs: 30000,
      maxDurationMs: 600000,
      minScorePerSecond: 0.01,
      maxScorePerSecond: 0.5,
      winScoreThreshold: 1,
      escalationEnabled: true,
      xpPerScore: 15,
      grants: {
        xpOnComplete: 10,
        xpOnWin: 20,
        eventPointsOnComplete: 6,
        mysteryBoxChance: 0.03,
        machineBoostChance: 0.02,
      },
      antiCheat: {
        maxMovesPerLevel: 30,
        maxEventsPerScore: 3,
        minEventIntervalMs: 150,
        maxScorePerSecond: 0.5,
        requireScoreTelemetry: true,
      },
      stats: {
        trackMoves: true,
        trackEfficiency: true,
        trackLevels: true,
        trackPerfect: true,
        efficiencyCeiling: 100,
      },
      rules: [
        'Tap tiles to rotate pipes — connect every generator to a battery.',
        'Complete as many levels as you can before time runs out.',
        'Fewer moves per level = higher efficiency bonus.',
        'Perfect connections (no extra moves) earn combo bonuses.',
        'Levels get larger and harder — plan your rotations.',
      ],
      crystalRewards: [
        { minScore: 0, maxScore: 0, crystals: 1 },
        { minScore: 1, maxScore: 2, crystals: 3 },
        { minScore: 3, maxScore: 4, crystals: 6 },
        { minScore: 5, maxScore: 6, crystals: 10 },
        { minScore: 7, maxScore: 100000, crystals: 15 },
      ],
      usdtRewards: [
        { minScore: 0, maxScore: 2, usdt: '0', probability: 0 },
        { minScore: 3, maxScore: 4, usdt: '0.05', probability: 0.15 },
        { minScore: 5, maxScore: 100000, usdt: '0.10', probability: 0.2 },
      ],
    },
  },
];

/**
 * Config-driven game catalog. Defaults are seeded on boot; administrators can
 * retune costs, daily limits, availability and reward tables via the admin API.
 */
@Injectable()
export class GameCatalogService {
  private readonly logger = new Logger(GameCatalogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async seedDefaults() {
    for (const seed of DEFAULT_GAMES) {
      await this.prisma.gameCatalog.upsert({
        where: { gameId: seed.gameId },
        update: {
          name: seed.name,
          description: seed.description,
          category: seed.category,
          icon: seed.icon,
          accentColor: seed.accentColor,
          difficulty: seed.difficulty,
        },
        create: {
          ...seed,
          rewardConfig: seed.rewardConfig as Prisma.InputJsonValue,
        },
      });
    }
    this.logger.log(`[GameCatalog] Seeded ${DEFAULT_GAMES.length} games`);
  }

  async getEnabledGames(): Promise<GameCatalog[]> {
    try {
      const items = await this.prisma.gameCatalog.findMany({
        where: { enabled: true },
        orderBy: { createdAt: 'asc' },
      });
      if (items && items.length > 0) return items;
    } catch (err: any) {
      this.logger.warn(`[GameCatalog] Database query failed, using in-memory catalog fallback: ${err?.message}`);
    }

    return DEFAULT_GAMES.map((g, idx) => ({
      id: `game_${idx + 1}`,
      gameId: g.gameId,
      code: g.code,
      name: g.name,
      description: g.description,
      category: g.category,
      icon: g.icon,
      accentColor: g.accentColor,
      crystalCost: g.crystalCost,
      dailyLimit: g.dailyLimit,
      estimatedDurationSec: g.estimatedDurationSec,
      difficulty: g.difficulty,
      enabled: true,
      rewardConfig: g.rewardConfig as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  }

  async getGame(gameId: string): Promise<GameCatalog> {
    try {
      const game = await this.prisma.gameCatalog.findUnique({ where: { gameId } });
      if (game && game.enabled) return game;
    } catch {}

    const seed = DEFAULT_GAMES.find((g) => g.gameId === gameId);
    if (!seed) {
      throw new NotFoundException({ code: 'GAME_NOT_FOUND', message: 'Game is not available.' });
    }
    return {
      id: `game_${seed.gameId}`,
      gameId: seed.gameId,
      code: seed.code,
      name: seed.name,
      description: seed.description,
      category: seed.category,
      icon: seed.icon,
      accentColor: seed.accentColor,
      crystalCost: seed.crystalCost,
      dailyLimit: seed.dailyLimit,
      estimatedDurationSec: seed.estimatedDurationSec,
      difficulty: seed.difficulty,
      enabled: true,
      rewardConfig: seed.rewardConfig as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async getGameStrict(gameId: string): Promise<GameCatalog | null> {
    return this.prisma.gameCatalog.findUnique({ where: { gameId } });
  }

  async listGames(includeDisabled = false): Promise<GameCatalog[]> {
    try {
      const items = await this.prisma.gameCatalog.findMany({
        where: includeDisabled ? {} : { enabled: true },
        orderBy: { createdAt: 'asc' },
      });
      if (items && items.length > 0) return items;
    } catch {}

    return DEFAULT_GAMES.map((g, idx) => ({
      id: `game_${idx + 1}`,
      gameId: g.gameId,
      code: g.code,
      name: g.name,
      description: g.description,
      category: g.category,
      icon: g.icon,
      accentColor: g.accentColor,
      crystalCost: g.crystalCost,
      dailyLimit: g.dailyLimit,
      estimatedDurationSec: g.estimatedDurationSec,
      difficulty: g.difficulty,
      enabled: true,
      rewardConfig: g.rewardConfig as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  }

  async upsertGame(data: {
    gameId: string;
    code?: string;
    name?: string;
    description?: string;
    category?: string;
    icon?: string;
    accentColor?: string;
    crystalCost?: number;
    dailyLimit?: number;
    estimatedDurationSec?: number;
    difficulty?: GameDifficulty;
    enabled?: boolean;
    rewardConfig?: Record<string, unknown>;
  }) {
    const existing = await this.getGameStrict(data.gameId);
    if (existing) {
      return this.prisma.gameCatalog.update({
        where: { gameId: data.gameId },
        data: {
          name: data.name,
          description: data.description,
          category: data.category,
          icon: data.icon,
          accentColor: data.accentColor,
          crystalCost: data.crystalCost,
          dailyLimit: data.dailyLimit,
          estimatedDurationSec: data.estimatedDurationSec,
          difficulty: data.difficulty,
          enabled: data.enabled,
          rewardConfig: data.rewardConfig ? (data.rewardConfig as Prisma.InputJsonValue) : undefined,
        },
      });
    }
    return this.prisma.gameCatalog.create({
      data: {
        gameId: data.gameId,
        code: data.code ?? data.gameId,
        name: data.name ?? data.gameId,
        description: data.description ?? '',
        category: data.category ?? 'skill',
        icon: data.icon ?? '🎮',
        accentColor: data.accentColor ?? '#00e676',
        crystalCost: data.crystalCost ?? 5,
        dailyLimit: data.dailyLimit ?? 10,
        estimatedDurationSec: data.estimatedDurationSec ?? 60,
        difficulty: data.difficulty ?? GameDifficulty.MEDIUM,
        enabled: data.enabled ?? true,
        rewardConfig: (data.rewardConfig ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Escalating entry cost: plays beyond half the daily limit cost more, so
   * excessive play becomes progressively expensive while the economy stays open.
   */
  costForPlay(game: GameCatalog, playsToday: number): number {
    const config = (game.rewardConfig as unknown as GameRewardConfig) ?? {};
    if (config.escalationEnabled === false || game.dailyLimit <= 0) {
      return game.crystalCost;
    }
    if (playsToday >= Math.floor(game.dailyLimit * 0.8)) return game.crystalCost * 3;
    if (playsToday >= Math.floor(game.dailyLimit * 0.5)) return game.crystalCost * 2;
    return game.crystalCost;
  }

  getRewardPreview(game: GameCatalog): GameCatalogView['rewardPreview'] {
    const config = (game.rewardConfig as unknown as GameRewardConfig) ?? {};
    if (config.chanceGame && config.sectors?.length) {
      const maxCrystal = Math.max(...config.sectors.filter((s) => s.type === 'CRYSTALS').map((s) => s.value), 0);
      const maxUsdt = Math.max(...config.sectors.filter((s) => s.type === 'USDT').map((s) => s.value), 0);
      return { minCrystals: 1, maxCrystals: maxCrystal, maxUsdt: maxUsdt.toFixed(2) };
    }
    const crystals = config.crystalRewards ?? [];
    const usdt = config.usdtRewards ?? [];
    const maxCrystals = crystals.length ? Math.max(...crystals.map((c) => c.crystals)) : 0;
    const maxUsdt = usdt.length ? Math.max(...usdt.map((u) => parseFloat(u.usdt))) : 0;
    const minCrystals = crystals.length ? Math.min(...crystals.map((c) => c.crystals)) : 0;
    return { minCrystals, maxCrystals, maxUsdt: maxUsdt.toFixed(2) };
  }

  toView(
    game: GameCatalog,
    playsToday = 0,
    events: string[] = [],
    personalBest: GamePlayerStatView | null = null,
    leaderboardRank: number | null = null,
  ): GameCatalogView {
    const config = (game.rewardConfig as unknown as GameRewardConfig) ?? {};
    return {
      gameId: game.gameId,
      code: game.code,
      name: game.name,
      description: game.description,
      category: game.category,
      icon: game.icon,
      accentColor: game.accentColor,
      crystalCost: this.costForPlay(game, playsToday),
      dailyLimit: game.dailyLimit,
      estimatedDurationSec: game.estimatedDurationSec,
      difficulty: game.difficulty,
      enabled: game.enabled,
      rewardPreview: this.getRewardPreview(game),
      playsUsedToday: playsToday,
      currentCost: this.costForPlay(game, playsToday),
      winScoreThreshold: config.winScoreThreshold ?? 1,
      rules: config.rules ?? [],
      personalBest,
      leaderboardRank,
      sectors: config.chanceGame ? (config.sectors ?? []) : undefined,
    };
  }

  /**
   * Human-readable rule list for the entry dialog, derived from config when
   * not explicitly provided.
   */
  rulesFor(game: GameCatalog): string[] {
    const config = (game.rewardConfig as unknown as GameRewardConfig) ?? {};
    if (config.rules?.length) return config.rules;
    const rules = [
      `Entry costs ${game.crystalCost} 💎 — deducted when you confirm.`,
      `Estimated play time: ${game.estimatedDurationSec} seconds.`,
      `Rewards are computed and validated server-side.`,
      `Scores are verified by the anti-cheat engine before payouts.`,
    ];
    if (config.chanceGame) rules.push('This is a chance game — the outcome is decided server-side at entry.');
    return rules;
  }
}
