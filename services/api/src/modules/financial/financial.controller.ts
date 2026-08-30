import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CanonicalUserId } from '../../common/decorators/canonical-user-id.decorator';
import { BalanceService } from './balance.service';
import { FinancialAccountService } from './financial-account.service';
import { LedgerService } from './ledger.service';
import { PaginationDto } from './dto/pagination.dto';
import { TransactionService } from './transaction.service';

@ApiTags('Financial')
@Controller('financial')
@UseGuards(AuthGuard)
export class FinancialController {
  constructor(
    private readonly accounts: FinancialAccountService,
    private readonly balances: BalanceService,
    private readonly ledger: LedgerService,
    private readonly transactions: TransactionService,
  ) {}

  @Get('account')
  @ApiOperation({ summary: 'Get or create current user financial account' })
  async getAccount(@CanonicalUserId() userId: string) {
    return this.accounts.getOrCreateForReadyUser(userId);
  }

  @Get('balance')
  @ApiOperation({ summary: 'Get derived balances for current user' })
  async getBalance(@CanonicalUserId() userId: string) {
    const account = await this.accounts.getOrCreateForReadyUser(userId);
    return this.balances.getBalances(account.telegramUserId, account.id);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get current user transactions' })
  async getTransactions(@CanonicalUserId() userId: string, @Query() query: PaginationDto) {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const account = await this.accounts.getOrCreateForReadyUser(userId);
    const items = await this.transactions.findForAccount(account.id, limit, offset);
    return { items, pagination: { limit, offset } };
  }

  @Get('ledger')
  @ApiOperation({ summary: 'Get current user ledger entries' })
  async getLedger(@CanonicalUserId() userId: string, @Query() query: PaginationDto) {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    try {
      const account = await this.accounts.getOrCreateForReadyUser(userId);
      const items = await this.ledger.findForAccount(account.id, limit, offset);
      return { items, pagination: { limit, offset } };
    } catch {
      return { items: [], pagination: { limit, offset } };
    }
  }
}
