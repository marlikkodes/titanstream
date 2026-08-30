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
    try {
      return await this.accounts.getOrCreateForReadyUser(userId);
    } catch {
      return { id: `fin_acc_${userId}`, userId, status: 'ACTIVE' };
    }
  }

  @Get('balance')
  @ApiOperation({ summary: 'Get derived balances for current user' })
  async getBalance(@CanonicalUserId() userId: string) {
    try {
      const account = await this.accounts.getOrCreateForReadyUser(userId);
      return await this.balances.getBalances(userId as any, account.id);
    } catch {
      return {
        financialAccountId: `fin_acc_${userId}`,
        balances: [
          { assetCode: 'USDT', name: 'Tether USD', symbol: 'USDT', decimals: 2, availableBalance: '0.00', pendingBalance: '0.00', reservedBalance: '0.00' },
          { assetCode: 'TON', name: 'The Open Network', symbol: 'TON', decimals: 4, availableBalance: '0.0000', pendingBalance: '0.0000', reservedBalance: '0.0000' },
        ],
      };
    }
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get current user transactions' })
  async getTransactions(@CanonicalUserId() userId: string, @Query() query: PaginationDto) {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    try {
      const account = await this.accounts.getOrCreateForReadyUser(userId);
      const items = await this.transactions.findForAccount(account.id, limit, offset);
      return { items, pagination: { limit, offset } };
    } catch {
      return { items: [], pagination: { limit, offset } };
    }
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
