import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { GrowthModule } from '../growth/growth.module';
import { MachineModule } from '../machine/machine.module';
import { GameCatalogService } from './game-catalog.service';
import { GameCrystalService } from './game-crystal.service';
import { GameAntiCheatService } from './game-anti-cheat.service';
import { GameRewardService } from './game-reward.service';
import { GameSessionService } from './game-session.service';
import { GameProfileService } from './game-profile.service';
import { GameLeaderboardService } from './game-leaderboard.service';
import { GameEventService } from './game-event.service';
import { GameDailyChallengeService } from './game-daily-challenge.service';
import { EconomicIntelligenceService } from './economic-intelligence.service';
import { GamesController } from './games.controller';
import { GamesAdminController } from './games-admin.controller';

/**
 * Game Economy Service.
 *
 * Mini-games are part of the Titan Stream economy:
 *  - Crystals are a first-class gameplay currency (own ledger, own analytics)
 *  - USDT payouts flow only through the existing Rewards Engine → Ledger →
 *    Wallet pipeline (claim queue)
 *  - The client never writes to any balance; every session is validated
 *    server-side and rewards are computed here
 */
@Module({
  imports: [PrismaModule, GrowthModule, MachineModule],
  controllers: [GamesController, GamesAdminController],
  providers: [
    GameCatalogService,
    GameCrystalService,
    GameAntiCheatService,
    GameRewardService,
    GameSessionService,
    GameProfileService,
    GameLeaderboardService,
    GameEventService,
    GameDailyChallengeService,
    EconomicIntelligenceService,
  ],
  exports: [
    GameCatalogService,
    GameCrystalService,
    GameSessionService,
    GameProfileService,
    GameLeaderboardService,
    GameEventService,
    GameRewardService,
    GameDailyChallengeService,
    EconomicIntelligenceService,
  ],
})
export class GamesModule implements OnModuleInit {
  private readonly logger = new Logger(GamesModule.name);

  constructor(
    private readonly catalogService: GameCatalogService,
    private readonly eventService: GameEventService,
    private readonly challengeService: GameDailyChallengeService,
  ) {}

  async onModuleInit() {
    setImmediate(async () => {
      try {
        await this.catalogService.seedDefaults();
        await this.eventService.seedDefaults();
        await this.challengeService.seedDefaults();
      } catch (err: any) {
        this.logger.warn(`[GamesModule] Failed to seed game defaults: ${err?.message}`);
      }
    });
  }
}
