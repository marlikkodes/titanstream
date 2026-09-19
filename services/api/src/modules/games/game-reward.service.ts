import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { GameCatalog, GameSession, GameRewardGrantType, Prisma, RewardType } from '@prisma/client';
import { RewardService } from '../growth/reward.service';
import { GameEventService } from './game-event.service';
import type { GameRewardConfig, GameRewardResult, RewardGrantDecision, RouletteSectorConfig } from './game-types';
import * as crypto from 'crypto';

type TxClient = Prisma.TransactionClient | PrismaService;

/**
 * Server-authoritative reward computation with Cryptographic Randomness.
 *
 * Responsibilities:
 *  - The client never decides payouts. Every reward is computed server-side.
 *  - Chance games outcomes and probability gates use cryptographically secure RNG (`crypto.randomInt`).
 *  - Maintains exact configured statistical probability distributions.
 *  - Enforces per-game daily USDT liability caps.
 */
@Injectable()
export class GameRewardService {
  private readonly logger = new Logger(GameRewardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rewardService: RewardService,
    private readonly eventService: GameEventService,
  ) {}

  private getConfig(game: GameCatalog): GameRewardConfig {
    return (game.rewardConfig as unknown as GameRewardConfig) ?? {};
  }

  /**
   * Cryptographically secure weighted selection.
   */
  private pickWeighted(sectors: RouletteSectorConfig[]): RouletteSectorConfig {
    const validSectors = sectors.filter((s) => s.weight > 0);
    if (!validSectors.length) return sectors[0];

    const totalWeight = validSectors.reduce((sum, s) => sum + s.weight, 0);
    const precision = 1_000_000;
    const maxBound = Math.max(1, Math.floor(totalWeight * precision));
    const roll = crypto.randomInt(0, maxBound) / precision;

    let accumulated = 0;
    for (const sector of validSectors) {
      accumulated += sector.weight;
      if (roll < accumulated) return sector;
    }
    return validSectors[validSectors.length - 1];
  }

  /**
   * Cryptographically secure probability check.
   */
  private secureProbability(prob: number): boolean {
    if (prob <= 0) return false;
    if (prob >= 1) return true;
    const precision = 1_000_000;
    const roll = crypto.randomInt(0, precision);
    return roll < Math.floor(prob * precision);
  }

  /**
   * Resolve a chance-game outcome at session start. Stored on the session so
   * the end-of-game call can never re-roll.
   */
  async decideOutcome(game: GameCatalog, reference: string): Promise<{ sectorIndex: number } | null> {
    const config = this.getConfig(game);
    if (!config.chanceGame || !config.sectors?.length) return null;

    const sector = this.pickWeighted(config.sectors);
    const sectorIndex = config.sectors.indexOf(sector);
    return { sectorIndex };
  }

  /**
   * Compute the reward for a session. Returns crystals to credit, an optional
   * USDT amount (created as a claimable Reward via RewardService) and the
   * non-currency grants to persist.
   */
  async computeRewards(
    game: GameCatalog,
    session: GameSession,
    score: number,
    sectorIndex?: number | null,
  ): Promise<GameRewardResult> {
    const config = this.getConfig(game);
    const multipliers = await this.eventService.resolveMultipliers(game.gameId);
    let crystals = 0;
    let usdt: string | null = null;
    let boostToken: RewardGrantDecision | null = null;

    if (config.chanceGame) {
      // Chance game: outcome was predetermined at session start
      const sector = sectorIndex != null ? config.sectors?.[sectorIndex] : undefined;
      if (!sector) {
        throw new BadRequestException({ code: 'INVALID_OUTCOME', message: 'Session outcome is missing or invalid.' });
      }
      if (sector.type === 'CRYSTALS') {
        crystals = Math.floor(sector.value);
      } else if (sector.type === 'USDT') {
        usdt = sector.value.toFixed(6);
      } else if (sector.type === 'BOOST') {
        // Boost sectors pay out as crystal-boost tokens (0.1x increments)
        boostToken = {
          type: 'BOOST_TOKEN',
          amount: Math.max(1, Math.floor(sector.value * 10)),
          metadata: { sectorLabel: sector.label, boostType: 'CRYSTAL_MULTIPLIER', perCent: sector.value * 10 },
        };
      }
    } else {
      // Skill game: score → reward table lookup
      const crystalBands = config.crystalRewards ?? [];
      const usdtBands = config.usdtRewards ?? [];

      for (const band of crystalBands) {
        if (score >= band.minScore && score <= band.maxScore) {
          crystals = band.crystals;
          break;
        }
      }

      for (const band of usdtBands) {
        if (score >= band.minScore && score <= band.maxScore) {
          if (band.probability > 0 && this.secureProbability(band.probability)) {
            usdt = parseFloat(band.usdt) > 0 ? parseFloat(band.usdt).toFixed(6) : null;
          }
          break;
        }
      }
    }

    // Event multipliers — events never reduce payouts
    if (crystals > 0) {
      crystals = crystals * multipliers.crystalMultiplier;
    }
    if (usdt) {
      const boosted = parseFloat(usdt) * multipliers.usdtMultiplier;
      usdt = boosted.toFixed(6);
    }

    // Economy protection: per-game daily USDT cap. Sessions beyond the cap are
    // still rewarded in crystals only — the financial pool is protected.
    if (usdt && !(await this.isWithinDailyUsdtCap(game, session.telegramUserId, usdt))) {
      usdt = null;
    }

    const xp = score * (config.xpPerScore ?? 1);

    const grants: RewardGrantDecision[] = [];
    if (boostToken) grants.push(boostToken);

    const grantConfig = config.grants;
    if (grantConfig) {
      const isWin = score >= (config.winScoreThreshold ?? 1) && crystals > 0;
      const xpFlat = (grantConfig.xpOnComplete ?? 0) + (isWin ? grantConfig.xpOnWin ?? 0 : 0);
      if (xpFlat > 0) grants.push({ type: 'XP', amount: xpFlat });
      if ((grantConfig.eventPointsOnComplete ?? 0) > 0) {
        grants.push({ type: 'EVENT_POINTS', amount: grantConfig.eventPointsOnComplete! });
      }
      if ((grantConfig.mysteryBoxChance ?? 0) > 0 && this.secureProbability(grantConfig.mysteryBoxChance!)) {
        grants.push({ type: 'MYSTERY_BOX', amount: 1, metadata: { gameId: game.gameId } });
      }
      if ((grantConfig.machineBoostChance ?? 0) > 0 && this.secureProbability(grantConfig.machineBoostChance!)) {
        grants.push({ type: 'MACHINE_BOOST', amount: 1, metadata: { gameId: game.gameId } });
      }
      for (const ap of grantConfig.achievementProgress ?? []) {
        if (ap.amount > 0) {
          grants.push({ type: 'ACHIEVEMENT_PROGRESS', amount: ap.amount, metadata: { achievementCode: ap.code } });
        }
      }
    }

    return {
      crystals,
      usdt,
      usdtRewardId: null,
      xp,
      grants,
      multipliers: {
        crystal: multipliers.crystalMultiplier,
        usdt: multipliers.usdtMultiplier.toString(),
      },
      events: multipliers.events,
    };
  }

  /**
   * Persist non-currency grants idempotently (unique reference per grant).
   * Called inside the session-finalization transaction.
   */
  async persistGrants(
    telegramUserId: bigint,
    gameId: string,
    sessionId: string,
    grants: RewardGrantDecision[],
    client: TxClient = this.prisma,
  ): Promise<number> {
    let count = 0;
    for (const grant of grants) {
      if (grant.type === 'XP') continue; // XP is folded into GameProfile by the session service
      const reference = `game_grant_${sessionId}_${grant.type}_${grant.metadata?.achievementCode ?? grant.amount}`;
      const existing = await client.gameRewardGrant.findUnique({ where: { reference } });
      if (existing) continue;
      await client.gameRewardGrant.create({
        data: {
          telegramUserId,
          gameId,
          sessionId,
          type: grant.type as GameRewardGrantType,
          amount: grant.amount,
          reference,
          metadata: (grant.metadata as Prisma.InputJsonValue) ?? undefined,
        },
      });
      count += 1;
    }
    return count;
  }

  /**
   * Whether the pending USDT payout fits inside the configured per-game daily
   * cap, counting already-awarded USDT for today.
   */
  private async isWithinDailyUsdtCap(game: GameCatalog, telegramUserId: bigint, pendingUsdt: string): Promise<boolean> {
    const config = this.getConfig(game);
    const cap = config.dailyUsdtCap;
    if (!cap) return true;

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    const daySessions = await this.prisma.gameSession.findMany({
      where: {
        telegramUserId,
        gameId: game.gameId,
        status: 'COMPLETED',
        usdtEarned: { not: null },
        createdAt: { gte: dayStart },
      },
      select: { usdtEarned: true },
    });

    const spentToday = daySessions.reduce((sum, s) => sum + (s.usdtEarned?.toNumber() ?? 0), 0);
    const capValue = parseFloat(cap);
    if (spentToday + parseFloat(pendingUsdt) > capValue) {
      this.logger.warn(`[GameReward] Daily USDT cap hit for ${game.gameId} user ${telegramUserId}: ${spentToday.toFixed(4)}/${capValue}`);
      return false;
    }
    return true;
  }

  /**
   * Create a claimable USDT reward (Reward row, AVAILABLE) through the
   * platform reward service. Idempotent via the session reference, so retries
   * can never double-create.
   */
  async createUsdtReward(game: GameCatalog, session: GameSession, score: number, amount: string) {
    const reference = `game_usdt_${session.id}`;
    return this.rewardService.createReward({
      telegramUserId: session.telegramUserId,
      rewardType: RewardType.CAMPAIGN,
      amount,
      reference,
      metadata: {
        source: 'game_reward',
        gameId: game.gameId,
        sessionId: session.id,
        score,
      },
    });
  }
}
