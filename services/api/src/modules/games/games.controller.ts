import { Body, Controller, Get, Param, Post, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CanonicalUserId } from '../../common/decorators/canonical-user-id.decorator';
import { PrismaService } from '../../database/prisma.service';
import { GameCatalogService } from './game-catalog.service';
import { GameCrystalService } from './game-crystal.service';
import { GameSessionService } from './game-session.service';
import { GameProfileService } from './game-profile.service';
import { GameLeaderboardService } from './game-leaderboard.service';
import { GameEventService } from './game-event.service';
import { GameDailyChallengeService } from './game-daily-challenge.service';
import { EndSessionDto, LeaderboardQueryDto } from './dto/games.dto';

@ApiTags('Games')
@Controller('games')
@UseGuards(AuthGuard)
export class GamesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: GameCatalogService,
    private readonly crystals: GameCrystalService,
    private readonly sessions: GameSessionService,
    private readonly profile: GameProfileService,
    private readonly leaderboard: GameLeaderboardService,
    private readonly events: GameEventService,
    private readonly challenges: GameDailyChallengeService,
  ) {}

  private async resolveTelegramUserId(userId: string): Promise<bigint> {
    if (/^\d+$/.test(userId)) return BigInt(userId);
    try {
      let user = await this.prisma.user.findFirst({
        where: { OR: [{ id: userId }, { identityId: userId }] },
        select: { id: true, telegramUserId: true },
      });
      if (user?.telegramUserId) return user.telegramUserId;
      if (user) {
        const hashSegment = user.id.split('-')[0] || '1';
        const numericPart = parseInt(hashSegment, 16) % 900000000;
        const deterministicTgId = BigInt('900' + String(100000000 + numericPart));
        try {
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: { telegramUserId: deterministicTgId },
            select: { id: true, telegramUserId: true },
          });
          if (user?.telegramUserId) return user.telegramUserId;
        } catch {}
        return deterministicTgId;
      }
    } catch {}

    const cleanSegment = userId.replace(/\D/g, '') || '1001';
    return BigInt(cleanSegment.slice(0, 15));
  }

  @Get('catalog')
  @ApiOperation({ summary: 'Game catalog with costs, reward previews, personal bests, ranks and today\'s daily challenge' })
  async getCatalog(@CanonicalUserId() userId: string) {
    const telegramUserId = await this.resolveTelegramUserId(userId);
    const games = await this.catalog.getEnabledGames();
    const activeEvents = await this.events.getActiveEventsView();
    const balance = await this.crystals.getBalance(telegramUserId);
    const playerStats = await this.profile.getPlayerStats(telegramUserId);
    const dailyChallenge = await this.challenges.getTodayView(telegramUserId);

    const views = [];
    for (const game of games) {
      const playsToday = await this.sessions.countPlaysToday(telegramUserId, game.gameId);
      const stat = playerStats[game.gameId] as any;
      const personalBest = stat
        ? {
            gameId: game.gameId,
            gamesPlayed: stat.gamesPlayed,
            gamesWon: stat.gamesWon,
            highestScore: stat.highestScore,
            bestCombo: stat.bestCombo,
            bestAccuracy: stat.bestAccuracy,
            bestReactionMs: stat.bestReactionMs,
            bestMoves: stat.bestMoves,
            bestTimeMs: stat.bestTimeMs,
            bestEfficiency: stat.bestEfficiency,
            levelsCompleted: stat.levelsCompleted,
            perfectSessions: stat.perfectSessions,
            xpEarned: stat.xpEarned,
            lastPlayedAt: stat.lastPlayedAt,
          }
        : null;
      const rank = stat ? await this.leaderboard.getPlayerRank(telegramUserId, game.gameId) : null;
      views.push(this.catalog.toView(game, playsToday, activeEvents.map((e) => e.code), personalBest, rank));
    }

    return {
      balance,
      events: activeEvents,
      games: views,
      dailyChallenge,
    };
  }

  @Get('challenges')
  @ApiOperation({ summary: 'Today\'s daily challenge with progress and completion state' })
  async getTodayChallenge(@CanonicalUserId() userId: string) {
    const telegramUserId = await this.resolveTelegramUserId(userId);
    return { challenge: await this.challenges.getTodayView(telegramUserId) };
  }

  @Get('grants')
  @ApiOperation({ summary: 'My non-currency reward grants (XP, boxes, boost tokens, event points)' })
  async getGrants(@CanonicalUserId() userId: string, @Query('limit') limit?: number, @Query('offset') offset?: number) {
    const telegramUserId = await this.resolveTelegramUserId(userId);
    return { items: await this.sessions.getGrants(telegramUserId, limit ?? 50, offset ?? 0) };
  }

  @Get('balance')
  @ApiOperation({ summary: 'Crystal balance and ledger totals' })
  async getBalance(@CanonicalUserId() userId: string) {
    const telegramUserId = await this.resolveTelegramUserId(userId);
    const account = await this.crystals.getAccount(telegramUserId);
    return {
      balance: account.balance,
      lifetimeEarned: account.lifetimeEarned,
      lifetimeSpent: account.lifetimeSpent,
      userId,
    };
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Crystal ledger history (append-only, balance-after snapshots)' })
  async getTransactions(@CanonicalUserId() userId: string, @Query('limit') limit?: number, @Query('offset') offset?: number) {
    const telegramUserId = await this.resolveTelegramUserId(userId);
    const rows = await this.crystals.getTransactions(telegramUserId, limit ?? 50, offset ?? 0);
    return {
      items: rows.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        balanceAfter: t.balanceAfter,
        reference: t.reference,
        metadata: t.metadata,
        createdAt: t.createdAt,
      })),
    };
  }

  @Get('profile')
  @ApiOperation({ summary: 'Progression profile (best score, streaks, totals)' })
  async getProfile(@CanonicalUserId() userId: string) {
    const telegramUserId = await this.resolveTelegramUserId(userId);
    const profile = await this.profile.getProfile(telegramUserId);
    const daily = await this.profile.getDailyLoginStatus(telegramUserId);
    return { profile, dailyLogin: daily };
  }

  @Post('daily-login/claim')
  @ApiOperation({ summary: 'Claim daily login crystal grant (streak + machine bonuses)' })
  async claimDailyLogin(@CanonicalUserId() userId: string) {
    const telegramUserId = await this.resolveTelegramUserId(userId);
    return this.profile.claimDailyLogin(telegramUserId);
  }

  @Post(':gameId/session/start')
  @ApiOperation({ summary: 'Start a game session (deducts crystal entry cost, decides chance outcomes server-side)' })
  async startSession(@CanonicalUserId() userId: string, @Param('gameId') gameId: string) {
    const telegramUserId = await this.resolveTelegramUserId(userId);
    return this.sessions.startSession(telegramUserId, gameId);
  }

  @Post(':gameId/session/:sessionId/end')
  @ApiOperation({ summary: 'Finish a session — server validates the score and issues rewards through the reward engine' })
  async endSession(
    @CanonicalUserId() userId: string,
    @Param('gameId') gameId: string,
    @Param('sessionId') sessionId: string,
    @Body() body: EndSessionDto,
  ) {
    const telegramUserId = await this.resolveTelegramUserId(userId);
    return this.sessions.endSession(telegramUserId, gameId, sessionId, body);
  }

  @Get('history')
  @ApiOperation({ summary: 'My recent game sessions' })
  async getHistory(@CanonicalUserId() userId: string, @Query('limit') limit?: number, @Query('offset') offset?: number) {
    const telegramUserId = await this.resolveTelegramUserId(userId);
    return { items: await this.sessions.getHistory(telegramUserId, limit ?? 30, offset ?? 0) };
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Daily / weekly / all-time leaderboards, global or friends scope' })
  async getLeaderboard(
    @CanonicalUserId() userId: string,
    @Query() query: LeaderboardQueryDto,
  ) {
    const telegramUserId = await this.resolveTelegramUserId(userId);
    return this.leaderboard.getLeaderboard(
      telegramUserId,
      query.gameId,
      query.period ?? 'daily',
      query.scope ?? 'global',
    );
  }

  @Get('events')
  @ApiOperation({ summary: 'Active and upcoming seasonal events' })
  async getEvents() {
    return { items: await this.events.getAllEvents() };
  }
}
