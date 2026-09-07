import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MiningService } from './mining.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CanonicalUserId } from '../../common/decorators/canonical-user-id.decorator';

@ApiTags('Mining Engine')
@Controller('mining')
@UseGuards(AuthGuard)
export class MiningController {
  constructor(private readonly service: MiningService) {}

  @Get('state')
  @ApiOperation({ summary: 'Get current user mining session state' })
  async getMiningState(@CanonicalUserId() userId: string) {
    return this.service.getOrCreateSession(userId);
  }

  @Post('tap')
  @ApiOperation({ summary: 'Tap the mining cooler to increase speed multiplier' })
  async tapCooler(@CanonicalUserId() userId: string) {
    return this.service.tap(userId);
  }

  @Post('toggle')
  @ApiOperation({ summary: 'Toggle active mining asset between USDT and TON' })
  async toggleCurrency(
    @CanonicalUserId() userId: string,
    @Body('currency') currency: 'USDT' | 'TON',
  ) {
    return this.service.toggleCurrency(userId, currency);
  }

  @Post('claim')
  @ApiOperation({ summary: 'Claim and disburse accumulated mining yield to double-entry ledger' })
  async claimRewards(
    @CanonicalUserId() userId: string,
    @Body('idempotencyKey') idempotencyKey?: string,
  ) {
    return this.service.claim(userId, idempotencyKey);
  }
}
