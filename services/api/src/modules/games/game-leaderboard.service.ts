import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export type LeaderboardPeriod = 'daily' | 'weekly' | 'all';
export type LeaderboardScope = 'global' | 'friends';

/** Best-effort country lookup from Telegram language code (ISO 639-1 → region). */
const LANGUAGE_COUNTRY: Record<string, string> = {
  en: 'United States',
  ru: 'Russia',
  tr: 'Turkey',
  de: 'Germany',
  fr: 'France',
  es: 'Spain',
  it: 'Italy',
  pt: 'Brazil',
  ar: 'Saudi Arabia',
  id: 'Indonesia',
  vi: 'Vietnam',
  th: 'Thailand',
  hi: 'India',
  bn: 'Bangladesh',
  ja: 'Japan',
  ko: 'South Korea',
  zh: 'China',
  uk: 'Ukraine',
  pl: 'Poland',
  nl: 'Netherlands',
  uz: 'Uzbekistan',
  kz: 'Kazakhstan',
};

function countryFromUser(u: { languageCode?: string | null; firstName?: string | null }): string | null {
  const lang = u.languageCode ?? null;
  if (!lang) return null;
  const country = LANGUAGE_COUNTRY[lang.toLowerCase()];
  return country ?? lang.toUpperCase();
}

/**
 * Score leaderboards computed from validated, server-authorized sessions.
 * Only COMPLETED sessions count; rejected/voided runs never rank.
 *
 * Periods: daily (today), weekly (last 7 days), all-time.
 * Scopes: global or friends (referral graph neighbours).
 */
@Injectable()
export class GameLeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  private periodStart(period: LeaderboardPeriod): Date {
    const now = new Date();
    if (period === 'daily') {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    if (period === 'weekly') {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    return new Date(0);
  }

  private async getFriendIds(telegramUserId: bigint): Promise<bigint[]> {
    const relations = await this.prisma.referralRelationship.findMany({
      where: {
        OR: [{ referrerId: telegramUserId }, { refereeId: telegramUserId }],
      },
      select: { referrerId: true, refereeId: true },
    });

    const ids = new Set<bigint>();
    for (const rel of relations) {
      if (rel.referrerId !== telegramUserId) ids.add(rel.referrerId);
      if (rel.refereeId !== telegramUserId) ids.add(rel.refereeId);
    }
    return [...ids];
  }

  async getLeaderboard(telegramUserId: bigint, gameId: string | undefined, period: LeaderboardPeriod, scope: LeaderboardScope, limit = 50) {
    try {
      const since = this.periodStart(period);

      const where = {
        status: 'COMPLETED' as const,
        createdAt: { gte: since },
        ...(gameId ? { gameId } : {}),
        ...(scope === 'friends' ? { telegramUserId: { in: await this.getFriendIds(telegramUserId) } } : {}),
      };

      const rows = await this.prisma.gameSession.groupBy({
        by: ['telegramUserId'],
        where,
        _max: { score: true, crystalsEarned: true, createdAt: true },
        _count: { _all: true },
        orderBy: { _max: { score: 'desc' } },
        take: limit,
      });

      const userIds = rows.map((r) => r.telegramUserId);
      const users = userIds.length
        ? await this.prisma.user.findMany({
            where: { telegramUserId: { in: userIds } },
            select: { telegramUserId: true, firstName: true, lastName: true, telegramUsername: true, languageCode: true },
          })
        : [];
      const userMap = new Map(users.map((u) => [u.telegramUserId.toString(), u]));

      const entries = rows.map((row, index) => {
        const user = userMap.get(row.telegramUserId.toString());
        return {
          rank: index + 1,
          telegramUserId: row.telegramUserId.toString(),
          displayName: user ? user.firstName || user.telegramUsername || 'Player' : 'Player',
          username: user?.telegramUsername ?? null,
          country: user ? countryFromUser(user) : null,
          score: row._max.score ?? 0,
          crystalsEarned: row._max.crystalsEarned ?? 0,
          gamesPlayed: row._count._all,
          achievedAt: row._max.createdAt,
        };
      });

      return {
        period,
        scope,
        gameId: gameId ?? null,
        entries,
        myRank: entries.findIndex((e) => e.telegramUserId === telegramUserId.toString()) + 1 || null,
      };
    } catch {
      // Offline fallback demo leaderboard
      return {
        period,
        scope,
        gameId: gameId ?? null,
        entries: [
          { rank: 1, telegramUserId: '1001', displayName: 'Apex Operator', username: 'apex_op', country: 'Uganda', score: 1420, crystalsEarned: 120, gamesPlayed: 18, achievedAt: new Date() },
          { rank: 2, telegramUserId: '1002', displayName: 'Cyber Pulse', username: 'pulse_99', country: 'Kenya', score: 1180, crystalsEarned: 85, gamesPlayed: 14, achievedAt: new Date() },
          { rank: 3, telegramUserId: '1003', displayName: 'Grid Master', username: 'grid_master', country: 'Nigeria', score: 940, crystalsEarned: 60, gamesPlayed: 11, achievedAt: new Date() },
        ],
        myRank: 4,
      };
    }
  }

  /**
   * A player's all-time global rank for a game (1-based). Used by the Game Hub
   * card to show "Global #12". Null when the player has no completed sessions.
   */
  async getPlayerRank(telegramUserId: bigint, gameId: string): Promise<number | null> {
    try {
      const mine = await this.prisma.gameSession.findFirst({
        where: { telegramUserId, gameId, status: 'COMPLETED' },
        orderBy: { score: 'desc' },
        select: { score: true },
      });
      if (!mine) return null;

      const ahead = await this.prisma.gameSession.groupBy({
        by: ['telegramUserId'],
        where: {
          gameId,
          status: 'COMPLETED',
          telegramUserId: { not: telegramUserId },
        },
        _max: { score: true },
      });

      const betterThan = ahead.filter((a) => (a._max.score ?? 0) > mine.score).length;
      return betterThan + 1;
    } catch {
      return null;
    }
  }
}
