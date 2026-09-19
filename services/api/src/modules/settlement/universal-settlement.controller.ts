import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CanonicalUserId } from '../../common/decorators/canonical-user-id.decorator';
import { CreateSettlementSessionDto } from './dto/create-settlement-session.dto';
import { ProviderRegistryService } from './provider-registry.service';
import { MerchantPaymentMatchingService } from './merchant-payment-matching.service';

@Controller(['settlement', 'api/v1/settlement'])
@UseGuards(AuthGuard)
export class UniversalSettlementController {
  constructor(
    private readonly registry: ProviderRegistryService,
    private readonly matchingService: MerchantPaymentMatchingService,
  ) {}

  @Get('providers')
  providers(@Query('asset') asset?: string, @Query('country') country?: string) {
    return this.registry.listProviders({ asset, country, buyOnly: true });
  }

  @Post('session')
  async create(@CanonicalUserId() userId: string, @Body() dto: CreateSettlementSessionDto) {
    const result = await this.registry.routeCreate(userId, dto);
    return { success: true, data: result, ...result };
  }

  @Get(['session/:id', 'session/:settlementId'])
  async get(@CanonicalUserId() userId: string, @Param('id') id: string, @Param('settlementId') settlementId: string) {
    const result = await this.registry.getSession(userId, id || settlementId);
    return { success: true, data: result, ...result };
  }

  @Post('session/:settlementId/submit-reference')
  async submitReference(
    @CanonicalUserId() userId: string,
    @Param('settlementId') settlementId: string,
    @Body() dto: { reference: string },
  ) {
    const { telegramUserId } = await this.registry.resolveUserAndTelegramId(userId);
    const result = await this.matchingService.submitCustomerReference(settlementId, telegramUserId, dto.reference);
    return { success: true, data: result };
  }

  @Post(['session/:id/cancel', 'session/:settlementId/cancel'])
  cancel(@CanonicalUserId() userId: string, @Param('id') id: string, @Param('settlementId') settlementId: string) {
    return this.registry.cancel(userId, id || settlementId);
  }

  @Get('history')
  history(@CanonicalUserId() userId: string) {
    return this.registry.history(userId);
  }
}
