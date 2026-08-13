import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CanonicalUserId } from '../../common/decorators/canonical-user-id.decorator';
import { CreateSettlementSessionDto } from './dto/create-settlement-session.dto';
import { ProviderRegistryService } from './provider-registry.service';

@Controller(['settlement', 'api/v1/settlement'])
@UseGuards(AuthGuard)
export class UniversalSettlementController {
  constructor(private readonly registry: ProviderRegistryService) {}

  @Get('providers')
  providers(@Query('asset') asset?: string, @Query('country') country?: string) {
    return this.registry.listProviders({ asset, country, buyOnly: true });
  }

  @Post('session')
  create(@CanonicalUserId() userId: string, @Body() dto: CreateSettlementSessionDto) {
    return this.registry.routeCreate(userId, dto);
  }

  @Get(['session/:id', 'session/:settlementId'])
  get(@CanonicalUserId() userId: string, @Param('id') id: string, @Param('settlementId') settlementId: string) {
    return this.registry.getSession(userId, id || settlementId);
  }

  @Post(['session/:id/cancel', 'session/:settlementId/cancel'])
  cancel(@Param('id') id: string, @Param('settlementId') settlementId: string) {
    return this.registry.cancel(id || settlementId);
  }

  @Get('history')
  history(@CanonicalUserId() userId: string) {
    return this.registry.history(userId);
  }
}
