import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { GameCatalog, GameChallengeObjective, GameDailyChallenge, GameSession, Prisma } from '@prisma/client';
import { GameCrystalService } from './game-crystal.service';
import { GrowthNotificationService } from '../growth/growth-notification.service';
import type { DailyChallengeView, GameSessionStats } from './game-types';

type TxClient = Prisma.TransactionClient | PrismaService;

const DAY_MS = 86_400_000;

interface ChallengeSeed {
  code: string;
  gameId: string;
  title: string;
  description: string;
  objectiveType: GameChallengeObjective;
  target: number;
  rewardCrystals: number;
  rewardXp: number;
}

const DEFAULT_CHALLENGES: ChallengeSeed[] = [
  {
    code: 'REACTOR_500',
    gameId: 'titan-reactor',
    title: 'Reactor Rush',
    description: 'Score 500 or more in Titan Reactor',
    objectiveType: GameChallengeObjective.SCORE_AT_LEAST,
    target: 500,
    rewardCrystals: 50,
    rewardXp: 60,
  },
  {
    code: 'GRID_20_MOVES',
    gameId: 'power-grid',
    title: 'Grid Efficiency',
    description: 'Complete Power Grid with fewer than 20 moves',
    objectiveType: GameChallengeObjective.FEWER_MOVES,
    target: 20,
    rewardCrystals: 40,
    rewardXp: 50,
  },
  {
    code: 'HOOPS_NO_MISS',
    gameId: 'hoop-masters',
    title: 'Sharpshooter Day',
    description: 'Win a Hoop Masters run without missing',
    objectiveType: GameChallengeObjective.PERFECT_SESSION,
    target: 1,
    rewardCrystals: 45,
    rewardXp: 55,
  },
  {
    code: 'ROULETTE_3_SPINS',
    gameId: 'crypto-roulette',
    title: 'Lucky Spins',
    description: 'Spin the roulette wheel 3 times',
    objectiveType: GameChallengeObjective.PLAYS,
    target: 3,
    rewardCrystals: 35,
    rewardXp: 40,
  },
  {
    code: 'REACTOR_PRECISION',
    gameId: 'titan-reactor',
    title: 'Precision Core',
    description: 'Hit 90% accuracy or better in Titan Reactor',
    objectiveType: GameChallengeObjective.PERFECT_ACCURACY,
    target: 90,
    rewardCrystals: 50,
    rewardXp: 60,
  },
  {
    code: 'GRID_5_LEVELS',
    gameId: 'power-grid',
    title: 'Grid Architect',
    description: 'Complete 5 Power Grid levels in one run',
    objectiveType: GameChallengeObjective.WINS,
    target: 5,
    rewardCrystals: 45,
    rewardXp: 55,
  },
  {
    code: 'MEMORY_10',
    gameId: 'memory-matrix',
    title: 'Memory Marathon',
    description: 'Clear 10 Memory Matrix rounds',
    objectiveType: GameChallengeObjective.WINS,
    target: 10,
    rewardCrystals: 40,
    rewardXp: 50,
  },
];

/**
 * Rotating Daily Challenge engine.
 *
 * A pool of challenge definitions is configured by administrators; each day
 * the next challenge in rotation is activated (deterministic, time-based — no
 * scheduler process required). Completing today's challenge awards a larger
 * crystal payout than standard gameplay. Completions are idempotent per
 * user + challenge + day.
 */
@Injectable()
export class GameDailyChallengeService {
  private readonly logger = new Logger(GameDailyChallengeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crystals: GameCrystalService,
    private readonly notificationService: GrowthNotificationService,
  ) {}

  async seedDefaults() {
    for (const seed of DEFAULT_CHALLENGES) {
      const game = await this.prisma.gameCatalog.findUnique({ where: { gameId: seed.gameId } });
      if (!game) continue;
      await this.prisma.gameDailyChallenge.upsert({
        where: { code: seed.code },
        update: {
          title: seed.title,
          description: seed.description,
          objectiveType: seed.objectiveType,
          target: seed.target,
          rewardCrystals: seed.rewardCrystals,
          rewardXp: seed.rewardXp,
        },
        create: { ...seed },
      });
    }
    this.logger.log(`[DailyChallenge] Seeded ${DEFAULT_CHALLENGES.length} challenge definitions`);
  }

  /** UTC day key for idempotency and rotation */
  private dayKey(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  private daysSinceEpoch(day: Date): number {
    return Math.floor(day.getTime() / DAY_MS);
  }

  /**
   * Today's challenge = pool[(daysSinceEpoch) % poolSize]. Deterministic
   * rotation: every challenge surfaces once per cycle without cron jobs.
   */
  async getActiveChallenge(now = new Date()): Promise<{ challenge: GameDailyChallenge | null; index: number; poolSize: number }> {
    const pool = await this.prisma.gameDailyChallenge.findMany({
      where: { enabled: true },
      orderBy: { createdAt: 'asc' },
      include: { game: { select: { name: true, icon: true } } },
    });
    if (pool.length === 0) return { challenge: null, index: -1, poolSize: 0 };

    const index = this.daysSinceEpoch(this.dayKey(now)) % pool.length;
    return { challenge: pool[index], index, poolSize: pool.length };
  }

  /**
   * Today's challenge view with the user's progress and completion state.
   */
  async getTodayView(telegramUserId: bigint, now = new Date()): Promise<DailyChallengeView | null> {
    try {
      const { challenge } = await this.getActiveChallenge(now);
      if (challenge) {
        const day = this.dayKey(now);
        const completion = await this.prisma.gameChallengeCompletion.findUnique({
          where: { telegramUserId_challengeId_challengeDay: { telegramUserId, challengeId: challenge.id, challengeDay: day } },
        });

        const sessions = await this.prisma.gameSession.findMany({
          where: {
            telegramUserId,
            gameId: challenge.gameId,
            status: { in: ['STARTED', 'COMPLETED'] },
            createdAt: { gte: day },
          },
          select: { score: true, status: true, validation: true },
        });

        const progress = this.computeProgress(challenge.objectiveType, challenge.target, sessions);

        return {
          id: challenge.id,
          code: challenge.code,
          gameId: challenge.gameId,
          gameName: (challenge as any).game?.name ?? challenge.gameId,
          gameIcon: (challenge as any).game?.icon ?? '🎮',
          title: challenge.title,
          description: challenge.description,
          objectiveType: challenge.objectiveType,
          target: challenge.target,
          rewardCrystals: challenge.rewardCrystals,
          rewardXp: challenge.rewardXp,
          completedToday: !!completion,
          progress,
        };
      }
    } catch (err: any) {
      this.logger.warn(`[DailyChallenge] Database fallback for today's challenge: ${err?.message}`);
    }

    const fallbackSeed = DEFAULT_CHALLENGES[0];
    return {
      id: 'dc_fallback_1',
      code: fallbackSeed.code,
      gameId: fallbackSeed.gameId,
      gameName: 'Titan Reactor',
      gameIcon: '⚛️',
      title: fallbackSeed.title,
      description: fallbackSeed.description,
      objectiveType: fallbackSeed.objectiveType,
      target: fallbackSeed.target,
      rewardCrystals: fallbackSeed.rewardCrystals,
      rewardXp: fallbackSeed.rewardXp,
      completedToday: false,
      progress: 0,
    };
  }

  /**
   * Progress normalization per objective. Returns a 0..1 fraction of the
   * target (for FEWER_MOVES lower is better, so 1 = target met).
   */
  private computeProgress(
    objective: GameChallengeObjective,
    target: number,
    sessions: Array<{ score: number; status: string; validation: Prisma.JsonValue | null }>,
  ): number {
    if (sessions.length === 0) return 0;

    if (objective === GameChallengeObjective.SCORE_AT_LEAST) {
      const best = Math.max(...sessions.map((s) => s.score));
      return Math.min(1, best / target);
    }
    if (objective === GameChallengeObjective.FEWER_MOVES) {
      const best = Math.min(...sessions.map((s) => s.score));
      return best > 0 ? Math.min(1, target / best) : 0;
    }
    if (objective === GameChallengeObjective.PLAYS) {
      const plays = sessions.filter((s) => s.status === 'STARTED' || s.status === 'COMPLETED').length;
      return Math.min(1, plays / target);
    }
    if (objective === GameChallengeObjective.PERFECT_ACCURACY) {
      const best = Math.max(...sessions.map((s) => this.extractAccuracy(s.validation)));
      return best >= target ? 1 : Math.min(0.99, best / target);
    }
    if (objective === GameChallengeObjective.PERFECT_SESSION) {
      const perfect = sessions.filter((s) => s.status === 'COMPLETED' && this.extractPerfect(s.validation)).length;
      return Math.min(1, perfect / target);
    }
    // WINS
    const wins = sessions.filter((s) => s.status === 'COMPLETED').length;
    return Math.min(1, wins / target);
  }

  private extractAccuracy(validation: Prisma.JsonValue | null): number {
    const v = validation as { stats?: { accuracy?: number } } | null;
    return v?.stats?.accuracy ?? 0;
  }

  private extractPerfect(validation: Prisma.JsonValue | null): boolean {
    const v = validation as { stats?: { perfect?: boolean } } | null;
    return !!v?.stats?.perfect;
  }

  /**
   * Evaluate a freshly finalized session against today's challenge. Grants the
   * challenge reward (crystals + XP) once per user per day, idempotently.
   */
  async evaluateSession(
    telegramUserId: bigint,
    game: GameCatalog,
    session: GameSession,
    score: number,
    stats: GameSessionStats | null,
    tx: TxClient,
  ): Promise<{ completed: boolean; rewardCrystals: number; rewardXp: number } | null> {
    const { challenge } = await this.getActiveChallenge();
    if (!challenge || challenge.gameId !== game.gameId || session.status !== 'COMPLETED') {
      return null;
    }

    const day = this.dayKey(new Date());
    const existing = await tx.gameChallengeCompletion.findUnique({
      where: { telegramUserId_challengeId_challengeDay: { telegramUserId, challengeId: challenge.id, challengeDay: day } },
    });
    if (existing) return { completed: true, rewardCrystals: 0, rewardXp: 0 };

    const objective = challenge.objectiveType;
    const target = challenge.target;
    let satisfied = false;

    if (objective === GameChallengeObjective.SCORE_AT_LEAST) {
      satisfied = score >= target;
    } else if (objective === GameChallengeObjective.FEWER_MOVES) {
      satisfied = (stats?.moves ?? 0) > 0 && (stats?.moves ?? 0) <= target;
    } else if (objective === GameChallengeObjective.WINS) {
      const dayStart = this.dayKey(new Date());
      const winsToday = await tx.gameSession.count({
        where: {
          telegramUserId,
          gameId: game.gameId,
          status: 'COMPLETED',
          createdAt: { gte: dayStart },
        },
      });
      satisfied = winsToday >= target;
    } else if (objective === GameChallengeObjective.PLAYS) {
      satisfied = true; // this session itself counts as a play
    } else if (objective === GameChallengeObjective.PERFECT_ACCURACY) {
      satisfied = (stats?.accuracy ?? 0) >= target;
    } else if (objective === GameChallengeObjective.PERFECT_SESSION) {
      satisfied = !!stats?.perfect;
    }

    if (!satisfied) return null;

    const reference = `game_challenge_${challenge.id}_${telegramUserId}_${day.toISOString().slice(0, 10)}`;

    await this.crystals.credit(
      telegramUserId,
      challenge.rewardCrystals,
      'ACHIEVEMENT',
      reference,
      { challengeCode: challenge.code, challengeDay: day.toISOString(), gameId: game.gameId, sessionId: session.id },
      tx,
    );

    await tx.gameChallengeCompletion.create({
      data: {
        telegramUserId,
        challengeId: challenge.id,
        challengeDay: day,
        sessionId: session.id,
        rewardCrystals: challenge.rewardCrystals,
        rewardXp: challenge.rewardXp,
      },
    });

    await tx.gameProfile.upsert({
      where: { telegramUserId },
      create: { telegramUserId, challengesCompleted: 1, xpTotal: challenge.rewardXp, xpLevel: 1 },
      update: {
        challengesCompleted: { increment: 1 },
        xpTotal: { increment: challenge.rewardXp },
      },
    });

    try {
      await this.notificationService.sendNotification({
        telegramUserId,
        templateCode: 'GAME_DAILY_CHALLENGE_COMPLETE',
        variables: {
          challengeTitle: challenge.title,
          crystals: String(challenge.rewardCrystals),
          xp: String(challenge.rewardXp),
        },
      });
    } catch (err: any) {
      this.logger.warn(`[DailyChallenge] Completion notification failed: ${err?.message}`);
    }

    return { completed: true, rewardCrystals: challenge.rewardCrystals, rewardXp: challenge.rewardXp };
  }

  async listChallenges(includeDisabled = false) {
    return this.prisma.gameDailyChallenge.findMany({
      where: includeDisabled ? {} : { enabled: true },
      include: { game: { select: { name: true, icon: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async upsertChallenge(data: ChallengeSeed & { enabled?: boolean }) {
    return this.prisma.gameDailyChallenge.upsert({
      where: { code: data.code },
      update: {
        gameId: data.gameId,
        title: data.title,
        description: data.description,
        objectiveType: data.objectiveType,
        target: data.target,
        rewardCrystals: data.rewardCrystals,
        rewardXp: data.rewardXp,
        enabled: data.enabled ?? true,
      },
      create: { ...data, enabled: data.enabled ?? true },
    });
  }

  async deleteChallenge(id: string) {
    return this.prisma.gameDailyChallenge.delete({ where: { id } });
  }

  async listCompletions(limit = 50) {
    return this.prisma.gameChallengeCompletion.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { challenge: { select: { title: true, code: true } } },
    });
  }
}
