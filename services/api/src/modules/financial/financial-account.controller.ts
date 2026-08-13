import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CanonicalUserId } from '../../common/decorators/canonical-user-id.decorator';
import { FinancialAccountService } from './financial-account.service';

@ApiTags('Financial Accounts')
@Controller('financial/accounts')
@UseGuards(AuthGuard)
export class FinancialAccountController {
  constructor(private readonly accounts: FinancialAccountService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get or create current user financial account' })
  async getCurrent(@CanonicalUserId() userId: string) {
    return this.accounts.getOrCreateForReadyUser(userId);
  }
}
