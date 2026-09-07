import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CrystalTransactionType, Prisma } from '@prisma/client';
import { GameCrystalService } from './game-crystal.service';
import { MachineService } from '../machine/machine.service';
import { GrowthNotificationService } from '../growth/growth-notification.service';
import type { GameSessionStats } from './game-types';

type TxClient = Prisma.TransactionClient | PrismaService;

const DAILY_LOGIN_BASE = 10;
const DAILY_STREAK_BONUS_PER_DAY = 2;
const DAILY_STREAK_BONUS_CAP = 20;
const MACHINE_BONUS_PER_MACHINE = 2;
const MACHINE_BONUS_CAP = 20;

/**
 * XP level curve — cumulative thresholds grow quadratically:
 * L1: 0, L2: 100, L3: 300, L4: 600, L5: 1000, L6: 1500 ...
 */
export function xpLevelFor(xp: number): number {
  if (xp <= 0) return 1;
  return Math.floor((1 + Math.sqrt(1 + 0.08 * xp)) / 2);
}

export function xpForLevel(level: number): number {
  return 50 * (level - 1) * level;
}

/**
 * Game progression + engagement crystal sources.
 *
 * Daily login is the anchor engagement source: a base grant plus streak and
 * machine-ownership bonuses. Machine owners earn passive crystals every day,
 * which converts "owning hardware" into gameplay energy without touching USDT.
 *
 * Per-game statistics (highest score, combos, accuracy, reaction time, moves,
 * efficiency, levels) are stored on GamePlayerStat and feed personal bests,
 * game achievements and the leaderboard.
 */
@Injectable()
export class GameProfileService {
  private readonly logger = new Logger(GameProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crystals: GameCrystalService,
    private readonly machineService: MachineService,
    private readonly notificationService: GrowthNotificationService,
  ) {}

  async getProfile(telegramUserId: bigint) {
    try {
      const profile = await this.prisma.gameProfile.upsert({
        where: { telegramUserId },
        create: { telegramUserId },
        update: {},
      });
      return {
        ...profile,
        telegramUserId: profile.telegramUserId.toString(),
      };
    } catch (err: any) {
      this.logger.warn(`[GameProfile] Database fallback for profile: ${err?.message}`);
      return {
        id: `gp_${telegramUserId.toString()}`,
        telegramUserId: telegramUserId.toString(),
        xpTotal: 250,
        xpLevel: 2,
        dailyStreak: 1,
        lastDailyClaimAt: null,
        winStreak: 0,
        highestWinStreak: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  async getDailyLoginStatus(telegramUserId: bigint) {
    const profile = await this.getProfile(telegramUserId);
    const now = new Date();

    let lastClaim = profile.lastDailyClaimAt ? new Date(profile.lastDailyClaimAt) : null;
    let claimedToday = false;
    if (lastClaim) {
      claimedToday =
        lastClaim.getFullYear() === now.getFullYear() &&
        lastClaim.getMonth() === now.getMonth() &&
        lastClaim.getDate() === now.getDate();
    }

    let yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const streakContinues =
      !!lastClaim &&
      lastClaim.getFullYear() === yesterday.getFullYear() &&
      lastClaim.getMonth() === yesterday.getMonth() &&
      lastClaim.getDate() === yesterday.getDate();

    const activeMachines = await this.countActiveMachines(telegramUserId);
    const machineBonus = Math.min(activeMachines * MACHINE_BONUS_PER_MACHINE, MACHINE_BONUS_CAP);
    const streakBonus = Math.min(profile.dailyStreak * DAILY_STREAK_BONUS_PER_DAY, DAILY_STREAK_BONUS_CAP);

    return {
      claimedToday,
      dailyStreak: profile.dailyStreak,
      streakContinues,
      baseReward: DAILY_LOGIN_BASE,
      streakBonus,
      machineBonus,
      activeMachines,
      totalReward: claimedToday ? 0 : DAILY_LOGIN_BASE + streakBonus + machineBonus,
    };
  }

  /**
   * Claim the daily login crystal grant. Consecutive days build a streak with
   * a capped bonus; machine owners receive a passive bonus each day.
   */
  async claimDailyLogin(telegramUserId: bigint) {
    const status = await this.getDailyLoginStatus(telegramUserId);
    if (status.claimedToday) {
      throw new BadRequestException({ code: 'DAILY_LOGIN_ALREADY_CLAIMED', message: 'Daily crystals already claimed today. Come back tomorrow!' });
    }

    const newStreak = status.streakContinues ? status.dailyStreak + 1 : 1;
    const streakBonus = Math.min((newStreak - 1) * DAILY_STREAK_BONUS_PER_DAY, DAILY_STREAK_BONUS_CAP);
    const machineBonus = Math.min(status.activeMachines * MACHINE_BONUS_PER_MACHINE, MACHINE_BONUS_CAP);
    const total = DAILY_LOGIN_BASE + streakBonus + machineBonus;

    const reference = `crystal_daily_${telegramUserId}_${new Date().toISOString().slice(0, 10)}`;
    const balance = await this.crystals.credit(
      telegramUserId,
      total,
      CrystalTransactionType.DAILY_LOGIN,
      reference,
      { dailyStreak: newStreak, streakBonus, machineBonus, activeMachines: status.activeMachines },
    );

    await this.prisma.gameProfile.upsert({
      where: { telegramUserId },
      create: { telegramUserId, dailyStreak: newStreak, lastDailyClaimAt: new Date() },
      update: { dailyStreak: newStreak, lastDailyClaimAt: new Date() },
    });

    try {
      await this.notificationService.sendNotification({
        telegramUserId,
        templateCode: 'GAME_DAILY_LOGIN',
        variables: { amount: String(total), streak: String(newStreak) },
      });
    } catch (err: any) {
      this.logger.warn(`[GameProfile] Daily login notification failed: ${err?.message}`);
    }

    return {
      balance,
      amount: total,
      baseReward: DAILY_LOGIN_BASE,
      streakBonus,
      machineBonus,
      dailyStreak: newStreak,
    };
  }

  private async countActiveMachines(telegramUserId: bigint): Promise<number> {
    try {
      const machines = await this.machineService.getUserMachines(telegramUserId.toString());
      const active = machines.filter((m) => m.status === 'ACTIVE' && m.tierCode !== 'TS_TRIAL').length;
      return active;
    } catch (err: any) {
      this.logger.warn(`[GameProfile] Machine count failed: ${err?.message}`);
      return 0;
    }
  }

  /**
   * Per-game personal best / progression stat.
   */
  async getPlayerStat(telegramUserId: bigint, gameId: string) {
    try {
      const stat = await this.prisma.gamePlayerStat.findUnique({
        where: { telegramUserId_gameId: { telegramUserId, gameId } },
      });
      return stat;
    } catch {
      return null;
    }
  }

  async getPlayerStats(telegramUserId: bigint): Promise<Record<string, unknown>> {
    try {
      const stats = await this.prisma.gamePlayerStat.findMany({ where: { telegramUserId } });
      return Object.fromEntries(stats.map((s) => [s.gameId, s]));
    } catch {
      return {};
    }
  }

  /**
   * Record a finished session into the progression profile + per-game stat.
   * Called inside the session-finalization transaction. XP grants are applied
   * here too, and level-ups are detected for the notification service.
   */
  async recordSession(
    telegramUserId: bigint,
    gameId: string,
    score: number,
    verdictOk: boolean,
    earnedValue: number,
    xpEarned: number,
    stats: GameSessionStats | null,
    durationMs: number,
    client: TxClient = this.prisma,
  ): Promise<{ leveledUp: { from: number; to: number } | null; newXp: number }> {
    const existing = await client.gameProfile.findUnique({ where: { telegramUserId } });

    const win = verdictOk && earnedValue > 0;
    const nextWinStreak = win ? (existing?.winStreak ?? 0) + 1 : 0;

    const xpBefore = existing?.xpTotal ?? 0;
    const xpAfter = xpBefore + (verdictOk ? Math.max(0, Math.floor(xpEarned)) : 0);
    const levelBefore = existing?.xpLevel ?? xpLevelFor(xpBefore);
    const levelAfter = xpLevelFor(xpAfter);

    await client.gameProfile.upsert({
      where: { telegramUserId },
      create: {
        telegramUserId,
        highestScore: score,
        gamesPlayed: 1,
        gamesWon: win ? 1 : 0,
        winStreak: nextWinStreak,
        bestWinStreak: nextWinStreak,
        totalCrystalsEarned: verdictOk ? Math.floor(earnedValue) : 0,
        totalCrystalsSpent: 0,
        xpTotal: xpAfter,
        xpLevel: levelAfter,
        lastPlayedAt: new Date(),
      },
      update: {
        highestScore: score > (existing?.highestScore ?? 0) ? score : undefined,
        gamesPlayed: { increment: 1 },
        gamesWon: win ? { increment: 1 } : undefined,
        winStreak: nextWinStreak,
        bestWinStreak: Math.max(existing?.bestWinStreak ?? 0, nextWinStreak),
        totalCrystalsEarned: verdictOk ? { increment: Math.floor(earnedValue) } : undefined,
        xpTotal: verdictOk ? { increment: Math.max(0, Math.floor(xpEarned)) } : undefined,
        xpLevel: levelAfter,
        lastPlayedAt: new Date(),
      },
    });

    // Per-game stat row
    if (verdictOk) {
      const stat = await client.gamePlayerStat.findUnique({
        where: { telegramUserId_gameId: { telegramUserId, gameId } },
      });

      const prevBest = {
        highestScore: stat?.highestScore ?? 0,
        bestCombo: stat?.bestCombo ?? 0,
        bestAccuracy: stat?.bestAccuracy ?? 0,
        bestReactionMs: stat?.bestReactionMs ?? 0,
        bestMoves: stat?.bestMoves ?? 0,
        bestTimeMs: stat?.bestTimeMs ?? 0,
        bestEfficiency: stat?.bestEfficiency ?? 0,
        levelsCompleted: stat?.levelsCompleted ?? 0,
        perfectSessions: stat?.perfectSessions ?? 0,
      };

      const newStat = {
        gamesPlayed: (stat?.gamesPlayed ?? 0) + 1,
        gamesWon: (stat?.gamesWon ?? 0) + (win ? 1 : 0),
        highestScore: Math.max(prevBest.highestScore, score),
        bestCombo: Math.max(prevBest.bestCombo, stats?.combo ?? 0),
        bestAccuracy: Math.max(prevBest.bestAccuracy, stats?.accuracy ?? 0),
        bestReactionMs:
          stats?.reactionMs && stats.reactionMs > 0
            ? Math.min(prevBest.bestReactionMs || Infinity, stats.reactionMs)
            : prevBest.bestReactionMs,
        bestMoves: stats?.moves && stats.moves > 0 ? Math.min(prevBest.bestMoves || Infinity, stats.moves) : prevBest.bestMoves,
        bestTimeMs:
          durationMs > 0
            ? Math.min(prevBest.bestTimeMs || Infinity, durationMs)
            : prevBest.bestTimeMs,
        bestEfficiency: Math.max(prevBest.bestEfficiency, stats?.efficiency ?? 0),
        levelsCompleted: prevBest.levelsCompleted + (stats?.levelsCompleted ?? 0),
        perfectSessions: prevBest.perfectSessions + (stats?.perfect ? 1 : 0),
        xpEarned: (stat?.xpEarned ?? 0) + Math.max(0, Math.floor(xpEarned)),
        lastPlayedAt: new Date(),
      };

      await client.gamePlayerStat.upsert({
        where: { telegramUserId_gameId: { telegramUserId, gameId } },
        create: { telegramUserId, gameId, ...newStat },
        update: newStat,
      });
    }

    return {
      leveledUp: levelAfter > levelBefore ? { from: levelBefore, to: levelAfter } : null,
      newXp: xpAfter,
    };
  }

  /**
   * Increment the challenge-completion counter (daily challenges).
   */
  async markChallengeCompleted(telegramUserId: bigint, client: TxClient = this.prisma) {
    await client.gameProfile.upsert({
      where: { telegramUserId },
      create: { telegramUserId, challengesCompleted: 1 },
      update: { challengesCompleted: { increment: 1 } },
    });
  }
}
