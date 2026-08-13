import { Controller, Get, Post, UseGuards, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CanonicalUserId } from '../../common/decorators/canonical-user-id.decorator';

@ApiTags('Onboarding')
@Controller('onboarding')
@UseGuards(AuthGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('state')
  @ApiOperation({ summary: 'Get current onboarding state' })
  async getState(@CanonicalUserId() userId: string) {
    return this.onboardingService.getState(userId);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get current onboarding status' })
  async getStatus(@CanonicalUserId() userId: string) {
    return this.onboardingService.getState(userId);
  }

  @Post('start')
  @ApiOperation({ summary: 'Start the onboarding process' })
  async startOnboarding(@CanonicalUserId() userId: string) {
    return this.onboardingService.startOnboarding(userId);
  }

  @Post('step')
  @ApiOperation({ summary: 'Complete an onboarding step' })
  async completeStep(
    @CanonicalUserId() userId: string,
    @Body('step') step: string,
  ) {
    return this.onboardingService.completeStep(userId, step);
  }

  @Post('transition')
  @ApiOperation({ summary: 'Transition onboarding lifecycle state' })
  async transition(
    @CanonicalUserId() userId: string,
    @Body('state') state: string,
    @Body('trigger') trigger?: string,
    @Body('metadata') metadata?: any,
  ) {
    return this.onboardingService.transition(userId, state as any, trigger, metadata);
  }

  @Post('resume')
  @ApiOperation({ summary: 'Resume stalled onboarding' })
  async resumeOnboarding(@CanonicalUserId() userId: string) {
    return this.onboardingService.resumeOnboarding(userId);
  }

  @Get('progress')
  @ApiOperation({ summary: 'Get detailed onboarding progress' })
  async getProgress(@CanonicalUserId() userId: string) {
    return this.onboardingService.getProgress(userId);
  }
}
