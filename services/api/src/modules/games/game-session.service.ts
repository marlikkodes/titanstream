import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, Optional, Inject } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CrystalTransactionType, GameCatalog, GameSession, GameSessionStatus, Prisma } from '@prisma/client';
import { GameCatalogService } from './game-catalog.service';
import { GameCrystalService } from './game-crystal.service';
import { GameRewardService } from './game-reward.service';
import { GameAntiCheatService } from './game-anti-cheat.service';
import { GameProfileService } from './game-profile.service';
import { GameEventService } from './game-event.service';
import { GameDailyChallengeService } from './game-daily-challenge.service';
import { AchievementService } from '../growth/achievement.service';
import { EndSessionDto } from './dto/games.dto';
import { GrowthNotificationService } from '../growth/growth-notification.service';
import { EventBusService } from '../automation/event-bus.service';
import type { GameSessionStats } from './game-types';

/**
 * Game session lifecycle. Entry requires crystals, respects per-game daily
 * limits with escalating costs, and rewards are issued only after server-side
 * validation. The client never writes to any balance directly.
 *
 * Completion pipeline (server-side only):
 *   Game Ends → Submit Result → Backend Validation → Anti-cheat → Rewards
 *   Engine → Ledger → Wallet → Achievement Check → Notifications → Result
 */
@Injectable()
export class GameSessionService {
  private readonly logger = new Logger(GameSessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: GameCatalogService,
    private readonly crystals: GameCrystalService,
    private readonly rewards: GameRewardService,
    private readonly antiCheat: GameAntiCheatService,
    private readonly profile: GameProfileService,
    private readonly events: GameEventService,
    private readonly challenges: GameDailyChallengeService,
    private readonly achievements: AchievementService,
    private readonly notificationService: GrowthNotificationService,
    @Optional() @Inject(EventBusService) private readonly eventBus?: EventBusService,
  ) {}

  async countPlaysToday(telegramUserId: bigint, gameId: string, client: Prisma.TransactionClient | PrismaService = this.prisma): Promise<number> {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    try {
      return await client.gameSession.count({
        where: {
          telegramUserId,
          gameId,
          createdAt: { gte: dayStart },
          status: { in: [GameSessionStatus.STARTED, GameSessionStatus.COMPLETED] },
        },
      });
    } catch {
      return 0;
    }
  }

  /**
   * Start a session: validates availability + daily limits, computes the
   * (possibly escalated) entry cost, deducts crystals and persists the
   * session atomically. Chance-game outcomes are decided here, server-side.
   */
  async startSession(telegramUserId: bigint, gameId: string) {
    const game = await this.catalog.getGame(gameId);

    const reference = `game_entry_${gameId}_${telegramUserId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const outcome = await this.rewards.decideOutcome(game, reference);

    let sessionId = '';

    await this.prisma.$transaction(
      async (tx) => {
        const playsToday = await this.countPlaysToday(telegramUserId, gameId, tx);

        if (playsToday >= game.dailyLimit) {
          throw new BadRequestException({
            code: 'GAME_DAILY_LIMIT_REACHED',
            message: `Daily limit reached for ${game.name}. It resets at midnight — come back tomorrow.`,
            playsToday,
            dailyLimit: game.dailyLimit,
          });
        }

        const cost = this.catalog.costForPlay(game, playsToday);
        await this.crystals.debit(
          telegramUserId,
          cost,
          CrystalTransactionType.GAME_ENTRY,
          reference,
          { gameId, playsToday },
          tx,
        );

        const session = await tx.gameSession.create({
          data: {
            telegramUserId,
            gameId,
            crystalCost: cost,
            status: GameSessionStatus.STARTED,
            reference: `game_session_${gameId}_${telegramUserId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            validation: outcome ? { outcomeSectorIndex: outcome.sectorIndex } : Prisma.JsonNull,
          },
        });
        sessionId = session.id;
      },
      { timeout: 15000, maxWait: 10000 },
    );

    const session = await this.prisma.gameSession.findUnique({ where: { id: sessionId } });

    if (this.eventBus) {
      this.eventBus.publish({
        type: 'GameSessionStarted',
        correlationId: session?.reference || `session_${sessionId}`,
        actorId: telegramUserId.toString(),
        payload: {
          telegramUserId: telegramUserId.toString(),
          gameId,
          sessionId,
          crystalCost: session?.crystalCost ?? 0,
        },
      });
    }

    return this.toStartView(game, session!);
  }

  /**
   * End a session: validates the submitted score + stats against anti-cheat
   * bounds, computes rewards server-side, and finalizes session + crystal
   * ledger + grants + progression atomically. USDT rewards (if any) are
   * enqueued to the claim queue through the platform reward service.
   */
  async endSession(telegramUserId: bigint, gameId: string, sessionId: string, body: EndSessionDto) {
    const game = await this.catalog.getGame(gameId);

    const session = await this.prisma.gameSession.findUnique({ where: { id: sessionId } });
    if (!session || session.gameId !== gameId || session.telegramUserId !== telegramUserId) {
      throw new NotFoundException({ code: 'GAME_SESSION_NOT_FOUND', message: 'Game session not found.' });
    }
    if (session.status !== GameSessionStatus.STARTED) {
      throw new BadRequestException({ code: 'GAME_SESSION_ALREADY_FINALIZED', message: 'This session has already been finalized.' });
    }

    const durationMs = body.durationMs ?? new Date().getTime() - session.serverStartedAt.getTime();
    const stats: GameSessionStats | null = this.sanitizeStats(body.stats);

    // Anti-cheat: never trust client results
    const verdict = this.antiCheat.validate(game, session, body.score, durationMs, body.telemetry, stats ?? undefined);

    let crystalsEarned = 0;
    let usdtEarned: string | null = null;
    let usdtRewardId: string | null = null;
    let xpEarned = 0;
    let grants: { type: 'XP' | 'EVENT_POINTS' | 'MYSTERY_BOX' | 'MACHINE_BOOST' | 'ACHIEVEMENT_PROGRESS' | 'BOOST_TOKEN'; amount: number; metadata?: Record<string, unknown> }[] = [];
    let outcome = session.validation as { outcomeSectorIndex?: number } | null;

    if (verdict.ok) {
      const computed = await this.rewards.computeRewards(game, session, body.score, outcome?.outcomeSectorIndex ?? null);
      crystalsEarned = computed.crystals;
      usdtEarned = computed.usdt;
      xpEarned = computed.xp;
      grants = computed.grants ?? [];
    }

    // USDT rewards go through the claim queue (idempotent by session reference).
    // Created after the atomic finalization so the queue never references a
    // session that could still be rolled back.
    if (verdict.ok && usdtEarned && parseFloat(usdtEarned) > 0) {
      const reward = await this.rewards.createUsdtReward(game, session, body.score, usdtEarned);
      usdtRewardId = reward.id;

      try {
        await this.notificationService.sendNotification({
          telegramUserId,
          templateCode: 'GAME_USDT_REWARD',
          variables: {
            amount: usdtEarned,
            gameName: game.name,
          },
        });
      } catch (err: any) {
        this.logger.warn(`[GameSession] USDT reward notification failed: ${err?.message}`);
      }
    }

    const finalization = { levelUp: null as { from: number; to: number } | null };
    let grantCount = 0;

    await this.prisma.$transaction(
      async (tx) => {
        await tx.gameSession.update({
          where: { id: session.id },
          data: {
            status: verdict.status,
            score: body.score,
            durationMs,
            serverEndedAt: new Date(),
            crystalsEarned,
            usdtEarned: usdtEarned ? usdtEarned : null,
            validation: {
              verdict,
              outcome: outcome?.outcomeSectorIndex ?? null,
              reportedDurationMs: durationMs,
              serverDurationMs: new Date().getTime() - session.serverStartedAt.getTime(),
              stats: stats ?? undefined,
            } as unknown as Prisma.InputJsonValue,
          },
        });

        if (verdict.ok && crystalsEarned > 0) {
          const reference = `game_reward_${session.id}`;
          await this.crystals.credit(
            telegramUserId,
            crystalsEarned,
            CrystalTransactionType.GAME_REWARD,
            reference,
            { gameId, score: body.score, sessionId: session.id },
            tx,
          );
        }

        // Non-currency grants (XP excluded — folded into the profile below)
        if (verdict.ok) {
          grantCount = await this.rewards.persistGrants(telegramUserId, gameId, session.id, grants, tx);
        }

        const recorded = await this.profile.recordSession(
          telegramUserId,
          gameId,
          body.score,
          verdict.ok,
          crystalsEarned + (usdtEarned ? parseFloat(usdtEarned) : 0),
          xpEarned,
          stats,
          durationMs,
          tx,
        );
        finalization.levelUp = recorded.leveledUp;
      },
      { timeout: 20000, maxWait: 15000 },
    );

    // Post-finalization: personal best detection, daily challenge evaluation,
    // achievement reconciliation, notifications.
    const finalSession = await this.prisma.gameSession.findUnique({ where: { id: session.id } });
    const isNewPersonalBest = verdict.ok ? await this.detectNewPersonalBest(telegramUserId, gameId, body.score) : false;

    if (isNewPersonalBest) {
      try {
        await this.notificationService.sendNotification({
          telegramUserId,
          templateCode: 'GAME_PERSONAL_BEST',
          variables: { gameName: game.name, score: String(body.score) },
        });
      } catch (err: any) {
        this.logger.warn(`[GameSession] PB notification failed: ${err?.message}`);
      }
    }

    const levelUp = finalization.levelUp;
    if (levelUp) {
      try {
        await this.notificationService.sendNotification({
          telegramUserId,
          templateCode: 'GAME_LEVEL_UP',
          variables: { level: String(levelUp.to) },
        });
      } catch (err: any) {
        this.logger.warn(`[GameSession] Level-up notification failed: ${err?.message}`);
      }
    }

    // Daily challenge evaluation (idempotent per challenge + day)
    let challengeResult: { completed: boolean; rewardCrystals: number; rewardXp: number } | null = null;
    if (verdict.ok && finalSession) {
      try {
        challengeResult = await this.prisma.$transaction(
          async (tx) => this.challenges.evaluateSession(telegramUserId, game, finalSession!, body.score, stats, tx),
          { timeout: 15000, maxWait: 10000 },
        );
      } catch (err: any) {
        if (err?.code !== 'P2002') {
          this.logger.warn(`[GameSession] Daily challenge evaluation failed: ${err?.message}`);
        }
        challengeResult = challengeResult ?? null;
      }
    }

    // Achievement reconciliation — newly unlocked achievements get notified
    let unlockedAchievements: Array<{ code: string; name: string; tier: string }> = [];
    if (verdict.ok) {
      try {
        unlockedAchievements = await this.achievements.reconcileAchievements(telegramUserId);
      } catch (err: any) {
        this.logger.warn(`[GameSession] Achievement reconcile failed: ${err?.message}`);
      }
      for (const ach of unlockedAchievements) {
        try {
          await this.notificationService.sendNotification({
            telegramUserId,
            templateCode: 'GAME_ACHIEVEMENT',
            variables: { achievementName: ach.name, tier: ach.tier },
          });
        } catch (err: any) {
          this.logger.warn(`[GameSession] Achievement notification failed: ${err?.message}`);
        }
      }
    }

    if (this.eventBus) {
      this.eventBus.publish({
        type: 'GameSessionCompleted',
        correlationId: finalSession?.reference || `session_${sessionId}`,
        actorId: telegramUserId.toString(),
        payload: {
          telegramUserId: telegramUserId.toString(),
          gameId,
          sessionId,
          score: body.score,
          status: finalSession?.status ?? (verdict.ok ? 'COMPLETED' : 'REJECTED'),
          crystalsEarned,
          usdtEarned,
          isNewPersonalBest,
          challengeCompleted: challengeResult?.completed ?? false,
        },
      });
    }

    return this.toEndView(game, finalSession!, {
      verdict,
      crystalsEarned,
      usdtEarned,
      usdtRewardId,
      xpEarned,
      outcome: outcome?.outcomeSectorIndex ?? null,
      stats,
      isNewPersonalBest,
      levelUp,
      grantCount,
      challenge: challengeResult,
      unlockedAchievements,
    });
  }

  private sanitizeStats(stats?: Record<string, unknown> | null): GameSessionStats | null {
    if (!stats) return null;
    const out: GameSessionStats = {};
    if (typeof stats.combo === 'number' && Number.isFinite(stats.combo)) out.combo = Math.max(0, Math.floor(stats.combo));
    if (typeof stats.accuracy === 'number' && Number.isFinite(stats.accuracy)) out.accuracy = Math.max(0, Math.floor(stats.accuracy));
    if (typeof stats.reactionMs === 'number' && Number.isFinite(stats.reactionMs)) out.reactionMs = Math.max(0, Math.floor(stats.reactionMs));
    if (typeof stats.moves === 'number' && Number.isFinite(stats.moves)) out.moves = Math.max(0, Math.floor(stats.moves));
    if (typeof stats.efficiency === 'number' && Number.isFinite(stats.efficiency)) out.efficiency = Math.max(0, Math.floor(stats.efficiency));
    if (typeof stats.levelsCompleted === 'number' && Number.isFinite(stats.levelsCompleted)) out.levelsCompleted = Math.max(0, Math.floor(stats.levelsCompleted));
    if (typeof stats.perfect === 'boolean') out.perfect = stats.perfect;
    return out;
  }

  /**
   * Whether this score beats the player's previous best for the game.
   */
  private async detectNewPersonalBest(telegramUserId: bigint, gameId: string, score: number): Promise<boolean> {
    const stat = await this.profile.getPlayerStat(telegramUserId, gameId);
    if (!stat) return score > 0;
    return score > stat.highestScore;
  }

  async getHistory(telegramUserId: bigint, limit = 30, offset = 0) {
    const sessions = await this.prisma.gameSession.findMany({
      where: { telegramUserId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: { game: { select: { name: true, icon: true, accentColor: true, code: true } } },
    });

    return sessions.map((s) => ({
      id: s.id,
      gameId: s.gameId,
      gameName: s.game.name,
      icon: s.game.icon,
      accentColor: s.game.accentColor,
      code: s.game.code,
      status: s.status,
      score: s.score,
      crystalCost: s.crystalCost,
      crystalsEarned: s.crystalsEarned,
      usdtEarned: s.usdtEarned?.toString() ?? null,
      durationMs: s.durationMs,
      createdAt: s.createdAt,
    }));
  }

  async getGrants(telegramUserId: bigint, limit = 50, offset = 0) {
    const rows = await this.prisma.gameRewardGrant.findMany({
      where: { telegramUserId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
    return rows.map((g) => ({
      id: g.id,
      gameId: g.gameId,
      sessionId: g.sessionId,
      type: g.type,
      amount: g.amount,
      metadata: g.metadata,
      createdAt: g.createdAt,
    }));
  }

  private toStartView(
    game: GameCatalog,
    session: { id: string; crystalCost: number; validation: Prisma.JsonValue },
  ) {
    const config = (game.rewardConfig as unknown as { chanceGame?: boolean }) ?? {};
    const outcome = session.validation as { outcomeSectorIndex?: number } | null;
    return {
      sessionId: session.id,
      gameId: game.gameId,
      gameName: game.name,
      crystalCost: session.crystalCost,
      serverStartedAt: new Date(),
      chanceGame: !!config.chanceGame,
      // Server-decided outcome for chance games — the client animates to it but
      // can never change it; the end call uses the server-stored value.
      outcomeSectorIndex: config.chanceGame ? (outcome?.outcomeSectorIndex ?? null) : null,
      message: `Entry paid — ${session.crystalCost} 💎. Play ${game.name} now.`,
    };
  }

  private toEndView(
    game: { gameId: string; name: string },
    session: GameSession,
    result: {
      verdict: { ok: boolean; status: string; reasons: string[] };
      crystalsEarned: number;
      usdtEarned: string | null;
      usdtRewardId: string | null;
      xpEarned: number;
      outcome: number | null;
      stats: GameSessionStats | null;
      isNewPersonalBest: boolean;
      levelUp: { from: number; to: number } | null;
      grantCount: number;
      challenge: { completed: boolean; rewardCrystals: number; rewardXp: number } | null;
      unlockedAchievements: Array<{ code: string; name: string; tier: string }>;
    },
  ) {
    return {
      sessionId: session.id,
      gameId: game.gameId,
      gameName: game.name,
      status: session.status,
      score: session.score,
      crystalsEarned: result.crystalsEarned,
      usdtEarned: result.usdtEarned,
      usdtRewardId: result.usdtRewardId,
      xpEarned: result.xpEarned,
      stats: result.stats,
      isNewPersonalBest: result.isNewPersonalBest,
      levelUp: result.levelUp,
      grantCount: result.grantCount,
      challenge: result.challenge,
      unlockedAchievements: result.unlockedAchievements,
      verdict: result.verdict,
      message:
        result.verdict.ok && result.usdtEarned && parseFloat(result.usdtEarned) > 0
          ? `You won ${result.usdtEarned} USDT! Claim it from your rewards queue.`
          : result.verdict.ok
            ? `You earned ${result.crystalsEarned} 💎.`
            : 'This run was flagged by our validation engine and voided without rewards.',
    };
  }
}
