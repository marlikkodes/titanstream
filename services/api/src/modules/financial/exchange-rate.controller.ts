import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ExchangeRateService } from './exchange-rate.service';

@ApiTags('Financial')
@Controller('financial')
export class ExchangeRateController {
  constructor(private readonly rates: ExchangeRateService) {}

  @Public()
  @Get('exchange-rates')
  @ApiOperation({ summary: 'Get live exchange rates for all supported currencies' })
  async getAllRates() {
    return this.rates.getAllRates();
  }

  @Public()
  @Get('exchange-rate/:currencyCode')
  @ApiOperation({ summary: 'Get live exchange rate for a specific currency' })
  async getRate(@Param('currencyCode') currencyCode: string) {
    return this.rates.getRate(currencyCode.toUpperCase());
  }
}
