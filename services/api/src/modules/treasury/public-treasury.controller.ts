import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { TreasuryService } from './treasury.service';

@Controller('treasury')
@UseGuards(JwtAuthGuard)
export class PublicTreasuryController {
  constructor(private readonly service: TreasuryService) {}

  @Public()
  @Get('metrics')
  async getPublicTreasuryMetrics() {
    const metrics = await this.service.getMetrics();
    return {
      success: true,
      data: metrics,
    };
  }
}
