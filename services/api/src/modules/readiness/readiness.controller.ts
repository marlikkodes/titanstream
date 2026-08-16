import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ReadinessService } from './readiness.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CanonicalUserId } from '../../common/decorators/canonical-user-id.decorator';

@ApiTags('Readiness')
@Controller('readiness')
@UseGuards(AuthGuard)
export class ReadinessController {
  constructor(private readonly readinessService: ReadinessService) {}

  @Get(['', 'status'])
  @ApiOperation({ summary: 'Get current readiness score and status' })
  async getReadiness(@CanonicalUserId() userId: string) {
    return this.readinessService.getReadinessScore(userId);
  }

  @Post('calculate')
  @ApiOperation({ summary: 'Force recalculation of readiness score' })
  async calculateReadiness(@CanonicalUserId() userId: string) {
    return this.readinessService.calculateReadiness(userId);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get readiness score history' })
  async getHistory(@CanonicalUserId() userId: string) {
    return this.readinessService.getReadinessHistory(userId);
  }
}
