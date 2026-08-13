import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { StepUpGuard } from '../../common/guards/step-up.guard';
import { RequireStepUp } from '../../common/decorators/step-up.decorator';
import { CanonicalUserId } from '../../common/decorators/canonical-user-id.decorator';
import { InitiateWithdrawalDto, WithdrawalService } from './withdrawal.service';

@Controller(['financial/withdrawal', 'financial/withdrawals'])
@UseGuards(AuthGuard)
export class WithdrawalController {
  constructor(private readonly withdrawalService: WithdrawalService) {}

  @Post()
  @UseGuards(StepUpGuard)
  @RequireStepUp()
  async initiateWithdrawal(
    @CanonicalUserId() userId: string,
    @Body() body: { amount: number; asset?: string; network: string; destinationAddress: string; country?: string; mobileMoneyNetwork?: string },
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    const dto: any = {
      userId,
      telegramUserId: /^\d+$/.test(userId) ? BigInt(userId) : BigInt(0),
      amount: body.amount,
      asset: body.asset || 'USDT',
      network: body.network,
      destinationAddress: body.destinationAddress,
      country: body.country,
      mobileMoneyNetwork: body.mobileMoneyNetwork,
    };
    return this.withdrawalService.initiateWithdrawal(dto, idempotencyKey);
  }

  @Get()
  async getWithdrawalHistory(
    @CanonicalUserId() userId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.withdrawalService.getUserWithdrawalHistory(userId, limit, offset);
  }
}
