import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserLevelTier } from '@prisma/client';

export interface AchievementDefinition {
  code: string;
  name: string;
  description: string;
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';
  icon: string;
  target: number;
  compute: (telegramUserId: bigint) => Promise<number>;
}

const LEVEL_ORDER: Record<string, number> = {
  NEW: 0,
  VERIFIED: 1,
  TRUSTED: 2,
  PREMIUM: 3,
  ELITE: 4,
};

@Injectable()
export class AchievementService {
  private readonly logger = new Logger(AchievementService.name);

  constructor(private readonly prisma: PrismaService) {}

  private definitions(): AchievementDefinition[] {
    return [
      {
        code: 'FIRST_REWARD',
        name: 'First Victory',
        description: 'Claim your first reward.',
        tier: 'BRONZE',
        icon: '🏆',
        target: 1,
        compute: async (id) =>
          this.prisma.reward.count({ where: { telegramUserId: id, status: 'CLAIMED' } }),
      },
      {
        code: 'REWARD_HUNTER',
        name: 'Reward Hunter',
        description: 'Claim 5 rewards.',
        tier: 'SILVER',
        icon: '🎯',
        target: 5,
        compute: async (id) =>
          this.prisma.reward.count({ where: { telegramUserId: id, status: 'CLAIMED' } }),
      },
      {
        code: 'TITAN_PATRON',
        name: 'Titan Patron',
        description: 'Claim 10 rewards.',
        tier: 'GOLD',
        icon: '💎',
        target: 10,
        compute: async (id) =>
          this.prisma.reward.count({ where: { telegramUserId: id, status: 'CLAIMED' } }),
      },
      {
        code: 'FIRST_REFERRAL',
        name: 'First Invite',
        description: 'Invite your first friend to qualify.',
        tier: 'BRONZE',
        icon: '🤝',
        target: 1,
        compute: async (id) => {
          const user = await this.prisma.user.findUnique({
            where: { telegramUserId: id },
            select: { qualifiedReferrals: true },
          });
          if (user && typeof user.qualifiedReferrals === 'number' && user.qualifiedReferrals > 0) {
            return user.qualifiedReferrals;
          }
          return this.prisma.referralRelationship.count({
            where: { referrerId: id, status: { in: ['QUALIFIED', 'REWARDED'] } },
          });
        },
      },
      {
        code: 'NETWORK_BUILDER',
        name: 'Network Builder',
        description: 'Qualify 3 referrals.',
        tier: 'SILVER',
        icon: '🌐',
        target: 3,
        compute: async (id) => {
          const user = await this.prisma.user.findUnique({
            where: { telegramUserId: id },
            select: { qualifiedReferrals: true },
          });
          if (user && typeof user.qualifiedReferrals === 'number' && user.qualifiedReferrals > 0) {
            return user.qualifiedReferrals;
          }
          return this.prisma.referralRelationship.count({
            where: { referrerId: id, status: { in: ['QUALIFIED', 'REWARDED'] } },
          });
        },
      },
      {
        code: 'REFERRAL_MAGNET',
        name: 'Referral Magnet',
        description: 'Qualify 10 referrals.',
        tier: 'PLATINUM',
        icon: '🧲',
        target: 10,
        compute: async (id) => {
          const user = await this.prisma.user.findUnique({
            where: { telegramUserId: id },
            select: { qualifiedReferrals: true },
          });
          if (user && typeof user.qualifiedReferrals === 'number' && user.qualifiedReferrals > 0) {
            return user.qualifiedReferrals;
          }
          return this.prisma.referralRelationship.count({
            where: { referrerId: id, status: { in: ['QUALIFIED', 'REWARDED'] } },
          });
        },
      },
      {
        code: 'FIRST_MACHINE',
        name: 'Core Operator',
        description: 'Commission your first active compute engine.',
        tier: 'BRONZE',
        icon: '⚡',
        target: 1,
        compute: async (id) =>
          this.prisma.userMachine.count({
            where: { telegramUserId: id, status: { in: ['ACTIVE', 'RUNNING'] } },
          }),
      },
      {
        code: 'MACHINE_COLLECTOR',
        name: 'Fleet Architect',
        description: 'Deploy 3 active compute engines in your fleet.',
        tier: 'GOLD',
        icon: '🖥️',
        target: 3,
        compute: async (id) =>
          this.prisma.userMachine.count({
            where: { telegramUserId: id, status: { in: ['ACTIVE', 'RUNNING'] } },
          }),
      },
      {
        code: 'FIRST_SETTLEMENT',
        name: 'First Settlement',
        description: 'Complete your first settlement.',
        tier: 'BRONZE',
        icon: '✅',
        target: 1,
        compute: async (id) =>
          this.prisma.settlementSession.count({
            where: { telegramUserId: id, status: 'COMPLETED' },
          }),
      },
      {
        code: 'SETTLEMENT_VETERAN',
        name: 'Settlement Veteran',
        description: 'Complete 10 settlements.',
        tier: 'SILVER',
        icon: '📊',
        target: 10,
        compute: async (id) =>
          this.prisma.settlementSession.count({
            where: { telegramUserId: id, status: 'COMPLETED' },
          }),
      },
      {
        code: 'TRUSTED_MEMBER',
        name: 'Trusted Member',
        description: 'Reach the Trusted level.',
        tier: 'SILVER',
        icon: '🛡️',
        target: 2,
        compute: async (id) => {
          const rec = await this.prisma.userLevelRecord.findUnique({
            where: { telegramUserId: id },
            select: { currentLevel: true },
          });
          return LEVEL_ORDER[rec?.currentLevel || 'NEW'] ?? 0;
        },
      },
      {
        code: 'PREMIUM_MEMBER',
        name: 'Premium Member',
        description: 'Reach the Premium level.',
        tier: 'GOLD',
        icon: '👑',
        target: 3,
        compute: async (id) => {
          const rec = await this.prisma.userLevelRecord.findUnique({
            where: { telegramUserId: id },
            select: { currentLevel: true },
          });
          return LEVEL_ORDER[rec?.currentLevel || 'NEW'] ?? 0;
        },
      },
      {
        code: 'ELITE_PARTNER',
        name: 'Elite Partner',
        description: 'Reach the Elite level.',
        tier: 'DIAMOND',
        icon: '🚀',
        target: 4,
        compute: async (id) => {
          const rec = await this.prisma.userLevelRecord.findUnique({
            where: { telegramUserId: id },
            select: { currentLevel: true },
          });
          return LEVEL_ORDER[rec?.currentLevel || 'NEW'] ?? 0;
        },
      },
      {
        code: 'WEEKLY_WARRIOR',
        name: 'Weekly Warrior',
        description: 'Claim rewards 3 days in a row.',
        tier: 'SILVER',
        icon: '🔥',
        target: 3,
        compute: async (id) => this.computeClaimStreak(id),
      },
      {
        code: 'DAILY_DEDICATED',
        name: 'Daily Dedicated',
        description: 'Claim rewards 7 days in a row.',
        tier: 'GOLD',
        icon: '⚡',
        target: 7,
        compute: async (id) => this.computeClaimStreak(id),
      },
      // ── Titan Reactor ────────────────────────────────────────────────────
      {
        code: 'REACTOR_FIRST_RUN',
        name: 'First Reactor',
        description: 'Play Titan Reactor for the first time.',
        tier: 'BRONZE',
        icon: '⚛️',
        target: 1,
        compute: async (id) => (await this.gameStat(id, 'titan-core-reactor'))?.gamesPlayed ?? 0,
      },
      {
        code: 'REACTOR_COMBO_MASTER',
        name: 'Combo Master',
        description: 'Reach a 10x combo streak in Titan Reactor.',
        tier: 'SILVER',
        icon: '🔥',
        target: 10,
        compute: async (id) => (await this.gameStat(id, 'titan-core-reactor'))?.bestCombo ?? 0,
      },
      {
        code: 'REACTOR_PERFECT_ACCURACY',
        name: 'Perfect Accuracy',
        description: 'Finish a Titan Reactor run with 100% accuracy.',
        tier: 'GOLD',
        icon: '🎯',
        target: 100,
        compute: async (id) => (await this.gameStat(id, 'titan-core-reactor'))?.bestAccuracy ?? 0,
      },
      {
        code: 'REACTOR_CHAMPION',
        name: 'Reactor Champion',
        description: 'Score 500 or more in a single Titan Reactor run.',
        tier: 'DIAMOND',
        icon: '👑',
        target: 500,
        compute: async (id) => (await this.gameStat(id, 'titan-core-reactor'))?.highestScore ?? 0,
      },
      // ── Power Grid ───────────────────────────────────────────────────────
      {
        code: 'GRID_FIRST_CIRCUIT',
        name: 'First Circuit',
        description: 'Complete your first Power Grid level.',
        tier: 'BRONZE',
        icon: '🔌',
        target: 1,
        compute: async (id) => (await this.gameStat(id, 'power-grid'))?.levelsCompleted ?? 0,
      },
      {
        code: 'GRID_ENGINEER',
        name: 'Grid Engineer',
        description: 'Complete 15 Power Grid levels in total.',
        tier: 'SILVER',
        icon: '⚙️',
        target: 15,
        compute: async (id) => (await this.gameStat(id, 'power-grid'))?.levelsCompleted ?? 0,
      },
      {
        code: 'GRID_PERFECT_CONNECTION',
        name: 'Perfect Connection',
        description: 'Finish a Power Grid level with 100% efficiency.',
        tier: 'GOLD',
        icon: '💡',
        target: 100,
        compute: async (id) => (await this.gameStat(id, 'power-grid'))?.bestEfficiency ?? 0,
      },
      {
        code: 'GRID_ENERGY_ARCHITECT',
        name: 'Energy Architect',
        description: 'Complete 40 Power Grid levels in total.',
        tier: 'PLATINUM',
        icon: '🏗️',
        target: 40,
        compute: async (id) => (await this.gameStat(id, 'power-grid'))?.levelsCompleted ?? 0,
      },
      // ── Titan Hoop ─────────────────────────────────────────────────────────
      {
        code: 'HOOPS_SHARPSHOOTER',
        name: 'Sharpshooter',
        description: 'Score 15 or more in a single Titan Hoop run.',
        tier: 'SILVER',
        icon: '🏀',
        target: 15,
        compute: async (id) => (await this.gameStat(id, 'hoop-masters'))?.highestScore ?? 0,
      },
      {
        code: 'HOOPS_PERFECT_TEN',
        name: 'Ten Perfect Runs',
        description: 'Win 10 Titan Hoop runs.',
        tier: 'GOLD',
        icon: '🎯',
        target: 10,
        compute: async (id) => (await this.gameStat(id, 'hoop-masters'))?.gamesWon ?? 0,
      },
      // ── Crypto Roulette ──────────────────────────────────────────────────
      {
        code: 'ROULETTE_LUCKY_SPIN',
        name: 'Lucky Spin',
        description: 'Win any prize from Crypto Roulette.',
        tier: 'BRONZE',
        icon: '🎡',
        target: 1,
        compute: async (id) => (await this.gameStat(id, 'crypto-roulette'))?.gamesWon ?? 0,
      },
      {
        code: 'ROULETTE_HIGH_ROLLER',
        name: 'High Roller',
        description: 'Win 100+ Crystals in a single roulette spin.',
        tier: 'GOLD',
        icon: '💎',
        target: 100,
        compute: async (id) => {
          const best = await this.prisma.gameSession.findFirst({
            where: { telegramUserId: id, gameId: 'crypto-roulette', status: 'COMPLETED' },
            orderBy: { crystalsEarned: 'desc' },
            select: { crystalsEarned: true },
          });
          return best?.crystalsEarned ?? 0;
        },
      },
      {
        code: 'ROULETTE_FORTUNE_SEEKER',
        name: 'Fortune Seeker',
        description: 'Play Crypto Roulette 25 times.',
        tier: 'SILVER',
        icon: '🎰',
        target: 25,
        compute: async (id) => (await this.gameStat(id, 'crypto-roulette'))?.gamesPlayed ?? 0,
      },
    ];
  }

  private async gameStat(telegramUserId: bigint, gameId: string) {
    return this.prisma.gamePlayerStat.findUnique({
      where: { telegramUserId_gameId: { telegramUserId, gameId } },
      select: {
        gamesPlayed: true,
        gamesWon: true,
        highestScore: true,
        bestCombo: true,
        bestAccuracy: true,
        levelsCompleted: true,
        bestEfficiency: true,
      },
    });
  }

  /**
   * Longest consecutive-day claim streak (current streak preferred).
   */
  private async computeClaimStreak(telegramUserId: bigint): Promise<number> {
    const { current } = await this.getClaimStreakInfo(telegramUserId);
    return current;
  }

  /**
   * Current streak (anchored at today/yesterday) and best streak in history.
   */
  async getClaimStreakInfo(telegramUserId: bigint): Promise<{ current: number; best: number }> {
    const claims = await this.prisma.reward.findMany({
      where: { telegramUserId, status: 'CLAIMED', processedAt: { not: null } },
      select: { processedAt: true },
      orderBy: { processedAt: 'desc' },
    });

    const days = new Set<number>();
    for (const c of claims) {
      const d = new Date(c.processedAt as Date);
      days.add(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    }

    const sorted = [...days].sort((a, b) => b - a);
    const today = new Date();
    const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    const yesterdayUtc = todayUtc - 86400000;

    // Current streak anchored at today or yesterday.
    let anchor = 0;
    if (sorted[0] === todayUtc || sorted[0] === yesterdayUtc) anchor = sorted[0];

    let current = 0;
    if (anchor !== 0) {
      let cursor = anchor;
      for (const day of sorted) {
        if (day === cursor) {
          current += 1;
          cursor -= 86400000;
        } else if (day > cursor) {
          continue;
        } else {
          break;
        }
      }
    }

    let best = 0;
    let run = 0;
    let prev = -1;
    for (const day of sorted) {
      if (prev === -1 || day === prev - 86400000) run += 1;
      else run = 1;
      best = Math.max(best, run);
      prev = day;
    }

    return { current, best };
  }

  /**
   * Reconcile achievement rows against the real counters and persist any
   * newly unlocked achievements.
   */
  async reconcileAchievements(telegramUserId: bigint) {
    const defs = this.definitions();
    const unlocked: { code: string; name: string; tier: string }[] = [];

    for (const def of defs) {
      const progress = await def.compute(telegramUserId);
      const achievedAt = progress >= def.target ? new Date() : null;

      const existing = await this.prisma.achievement.findUnique({
        where: { telegramUserId_code: { telegramUserId, code: def.code } },
      });

      if (!existing) {
        await this.prisma.achievement.create({
          data: {
            telegramUserId,
            code: def.code,
            name: def.name,
            description: def.description,
            tier: def.tier,
            icon: def.icon,
            progress,
            target: def.target,
            achievedAt,
          },
        });
        if (achievedAt) {
          unlocked.push({ code: def.code, name: def.name, tier: def.tier });
          this.logger.log(`[Achievements] Unlocked ${def.code} for user ${telegramUserId}`);
        }
      } else if (existing.progress !== progress || (!existing.achievedAt && achievedAt)) {
        await this.prisma.achievement.update({
          where: { telegramUserId_code: { telegramUserId, code: def.code } },
          data: { progress, achievedAt: achievedAt || existing.achievedAt },
        });
        if (achievedAt && !existing.achievedAt) {
          unlocked.push({ code: def.code, name: def.name, tier: def.tier });
          this.logger.log(`[Achievements] Unlocked ${def.code} for user ${telegramUserId}`);
        }
      }
    }

    return unlocked;
  }

  /**
   * Full cabinet: every definition evaluated against real counters.
   */
  async getUserAchievements(telegramUserId: bigint) {
    const unlocked = await this.reconcileAchievements(telegramUserId);
    const rows = await this.prisma.achievement.findMany({
      where: { telegramUserId },
      orderBy: [{ achievedAt: 'desc' }, { createdAt: 'asc' }],
    });

    return {
      achievements: rows.map((a) => ({
        code: a.code,
        name: a.name,
        description: a.description,
        tier: a.tier,
        icon: a.icon,
        progress: a.progress,
        target: a.target,
        achieved: !!a.achievedAt,
        achievedAt: a.achievedAt,
      })),
      totalUnlocked: rows.filter((a) => a.achievedAt).length,
      total: rows.length,
      justUnlocked: unlocked,
    };
  }
}
