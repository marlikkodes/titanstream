import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service';
import { CurrentAdmin, AuthenticatedAdmin } from '../admin/decorators/current-admin.decorator';
import { Permissions } from '../admin/decorators/permissions.decorator';
import { AdminAuthGuard } from '../admin/guards/admin-auth.guard';
import { RbacGuard } from '../admin/guards/rbac.guard';
import { AdminPermission } from '../admin/interfaces/admin-permissions.enum';
import { GameCatalogService } from './game-catalog.service';
import { GameCrystalService } from './game-crystal.service';
import { GameEventService } from './game-event.service';
import { GameProfileService } from './game-profile.service';
import { GameLeaderboardService } from './game-leaderboard.service';
import { GameDailyChallengeService } from './game-daily-challenge.service';
import { GameSessionService } from './game-session.service';
import { EconomicIntelligenceService } from './economic-intelligence.service';
import { CrystalAdminAdjustDto, UpsertGameCatalogDto, UpsertGameEventDto, UpsertDailyChallengeDto } from './dto/games.dto';

/**
 * Game economy administration — crystal costs, reward pools, game
 * availability, daily limits, seasonal events. Every change is written to the
 * same tables the runtime reads; no redeploys required.
 */
@ApiTags('Admin Games')
@Controller('admin/games')
@UseGuards(AdminAuthGuard, RbacGuard)
export class GamesAdminController {
  constructor(
    private readonly catalog: GameCatalogService,
    private readonly crystals: GameCrystalService,
    private readonly events: GameEventService,
    private readonly profile: GameProfileService,
    private readonly leaderboard: GameLeaderboardService,
    private readonly challenges: GameDailyChallengeService,
    private readonly sessions: GameSessionService,
    private readonly prisma: PrismaService,
    private readonly economicIntelligence: EconomicIntelligenceService,
  ) {}

  @Get('catalog')
  @Permissions(AdminPermission.GAME_MANAGE)
  @ApiOperation({ summary: 'List full game catalog (including disabled games)' })
  async listCatalog() {
    const games = await this.catalog.listGames(true);
    return games.map((g) => ({
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
      enabled: g.enabled,
      rewardConfig: g.rewardConfig,
      updatedAt: g.updatedAt,
    }));
  }

  @Post('catalog')
  @Permissions(AdminPermission.GAME_MANAGE)
  @ApiOperation({ summary: 'Create or update a game in the catalog' })
  async upsertGame(@Body() dto: UpsertGameCatalogDto) {
    if (!dto.gameId) {
      return { error: 'gameId is required.' };
    }
    return this.catalog.upsertGame(dto as Required<Pick<UpsertGameCatalogDto, 'gameId'>> & UpsertGameCatalogDto);
  }

  @Patch('catalog/:gameId')
  @Permissions(AdminPermission.GAME_MANAGE)
  @ApiOperation({ summary: 'Update a game: cost, daily limit, availability, reward tables' })
  async updateGame(@Param('gameId') gameId: string, @Body() dto: UpsertGameCatalogDto) {
    return this.catalog.upsertGame({ ...dto, gameId });
  }

  @Get('events')
  @Permissions(AdminPermission.GAME_MANAGE)
  @ApiOperation({ summary: 'List all seasonal events' })
  async listEvents() {
    return { items: await this.events.getAllEvents() };
  }

  @Post('events')
  @Permissions(AdminPermission.GAME_MANAGE)
  @ApiOperation({ summary: 'Create or update a seasonal event (multipliers, schedule)' })
  async upsertEvent(@Body() dto: UpsertGameEventDto) {
    return this.events.upsertEvent({
      code: dto.code,
      title: dto.title,
      description: dto.description,
      gameId: dto.gameId,
      crystalMultiplier: dto.crystalMultiplier,
      usdtMultiplier: dto.usdtMultiplier,
      startsAt: new Date(dto.startsAt),
      endsAt: new Date(dto.endsAt),
      enabled: dto.enabled,
    });
  }

  @Delete('events/:code')
  @Permissions(AdminPermission.GAME_MANAGE)
  @ApiOperation({ summary: 'Delete a seasonal event' })
  async deleteEvent(@Param('code') code: string) {
    await this.events.deleteEvent(code);
    return { success: true, code };
  }

  @Get('players/:telegramUserId/profile')
  @Permissions(AdminPermission.GAME_MANAGE)
  @ApiOperation({ summary: 'Inspect a player\'s game profile and crystal account' })
  async getPlayerProfile(@Param('telegramUserId') telegramUserId: string) {
    const id = BigInt(telegramUserId);
    const [profile, account, daily] = await Promise.all([
      this.profile.getProfile(id),
      this.crystals.getAccount(id),
      this.profile.getDailyLoginStatus(id),
    ]);
    return {
      profile,
      account: {
        balance: account.balance,
        lifetimeEarned: account.lifetimeEarned,
        lifetimeSpent: account.lifetimeSpent,
        telegramUserId: account.telegramUserId.toString(),
      },
      dailyLogin: daily,
    };
  }

  @Post('players/:telegramUserId/crystals')
  @Permissions(AdminPermission.GAME_MANAGE)
  @ApiOperation({ summary: 'Admin crystal adjustment (audit-trailed)' })
  async adjustCrystals(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('telegramUserId') telegramUserId: string,
    @Body() dto: CrystalAdminAdjustDto,
  ) {
    const balance = await this.crystals.adjust(BigInt(telegramUserId), dto.amount, dto.reason, `${admin.username} (${admin.role})`);
    return { balance, adjusted: dto.amount, reason: dto.reason };
  }

  @Get('sessions')
  @Permissions(AdminPermission.GAME_MANAGE)
  @ApiOperation({ summary: 'Session audit trail' })
  async listSessions(
    @Query('gameId') gameId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    const sessions = await this.prisma.gameSession.findMany({
      where: {
        ...(gameId ? { gameId } : {}),
        ...(status ? { status: status as never } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(limit ?? '100', 10) || 100, 500),
    });
    return sessions.map((s) => ({
      id: s.id,
      telegramUserId: s.telegramUserId.toString(),
      gameId: s.gameId,
      status: s.status,
      score: s.score,
      crystalCost: s.crystalCost,
      crystalsEarned: s.crystalsEarned,
      usdtEarned: s.usdtEarned?.toString() ?? null,
      durationMs: s.durationMs,
      createdAt: s.createdAt,
    }));
  }

  @Get('leaderboard')
  @Permissions(AdminPermission.GAME_MANAGE)
  @ApiOperation({ summary: 'Global leaderboard preview for moderation' })
  async previewLeaderboard(@Query('gameId') gameId?: string, @Query('period') period: 'daily' | 'weekly' | 'all' = 'daily') {
    return this.leaderboard.getLeaderboard(BigInt(0), gameId, period, 'global');
  }

  @Get('challenges')
  @Permissions(AdminPermission.GAME_MANAGE)
  @ApiOperation({ summary: 'List all daily challenge definitions (pool)' })
  async listChallenges() {
    return { items: await this.challenges.listChallenges(true) };
  }

  @Post('challenges')
  @Permissions(AdminPermission.GAME_MANAGE)
  @ApiOperation({ summary: 'Create or update a daily challenge definition' })
  async upsertChallenge(@Body() dto: UpsertDailyChallengeDto) {
    return this.challenges.upsertChallenge({
      code: dto.code,
      gameId: dto.gameId,
      title: dto.title,
      description: dto.description,
      objectiveType: dto.objectiveType,
      target: dto.target,
      rewardCrystals: dto.rewardCrystals ?? 20,
      rewardXp: dto.rewardXp ?? 25,
      enabled: dto.enabled ?? true,
    });
  }

  @Delete('challenges/:id')
  @Permissions(AdminPermission.GAME_MANAGE)
  @ApiOperation({ summary: 'Delete a daily challenge definition' })
  async deleteChallenge(@Param('id') id: string) {
    await this.challenges.deleteChallenge(id);
    return { success: true };
  }

  @Get('challenges/completions')
  @Permissions(AdminPermission.GAME_MANAGE)
  @ApiOperation({ summary: 'Daily challenge completion audit trail' })
  async listChallengeCompletions(@Query('limit') limit?: string) {
    const rows = await this.challenges.listCompletions(Math.min(parseInt(limit ?? '50', 10) || 50, 200));
    return {
      items: rows.map((c) => ({
        id: c.id,
        telegramUserId: c.telegramUserId.toString(),
        challengeId: c.challengeId,
        challengeCode: c.challenge?.code ?? null,
        challengeTitle: c.challenge?.title ?? null,
        challengeDay: c.challengeDay,
        rewardCrystals: c.rewardCrystals,
        rewardXp: c.rewardXp,
        completedAt: c.createdAt,
      })),
    };
  }

  @Get('grants')
  @Permissions(AdminPermission.GAME_MANAGE)
  @ApiOperation({ summary: 'Reward grant audit trail (XP, boxes, boost tokens)' })
  async listGrants(@Query('limit') limit?: string, @Query('type') type?: string) {
    const rows = await this.prisma.gameRewardGrant.findMany({
      where: type ? { type: type as never } : {},
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(limit ?? '100', 10) || 100, 500),
    });
    return rows.map((g) => ({
      id: g.id,
      telegramUserId: g.telegramUserId.toString(),
      gameId: g.gameId,
      sessionId: g.sessionId,
      type: g.type,
      amount: g.amount,
      reference: g.reference,
      createdAt: g.createdAt,
    }));
  }

  @Get('economics/supply')
  @Permissions(AdminPermission.GAME_MANAGE)
  @ApiOperation({ summary: 'Crystal supply and velocity metrics' })
  async getSupplyEconomics() {
    const [supply, velocity] = await Promise.all([
      this.economicIntelligence.getSupplyMetrics(),
      this.economicIntelligence.getVelocityMetrics(),
    ]);
    return { supply, velocity };
  }

  @Get('economics/games')
  @Permissions(AdminPermission.GAME_MANAGE)
  @ApiOperation({ summary: 'Per-game economic breakdown (in/out, sink flow)' })
  async getGameEconomics() {
    return { items: await this.economicIntelligence.getPerGameEconomics() };
  }

  @Get('economics/nev')
  @Permissions(AdminPermission.GAME_MANAGE)
  @ApiOperation({ summary: 'Net Economic Value (NEV) calculation' })
  async getNetEconomicValue() {
    return this.economicIntelligence.calculateNetEconomicValue();
  }

  @Get('economics/governor')
  @Permissions(AdminPermission.GAME_MANAGE)
  @ApiOperation({ summary: 'Shadow-mode Economic Governor policy status' })
  async getGovernorStatus() {
    return this.economicIntelligence.getGovernorStatus();
  }

  @Post('economics/simulate')
  @Permissions(AdminPermission.GAME_MANAGE)
  @ApiOperation({ summary: 'Deterministic, read-only economic policy simulation' })
  async simulatePolicy(@Body() body: any) {
    return this.economicIntelligence.simulateScenario(body);
  }
}
