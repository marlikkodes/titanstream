import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UserState } from '../../common/interfaces/user-state.enum';
import { AuditEventType } from '../../common/interfaces/user-state.enum';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import { FinancialAccountRepository } from './financial-account.repository';
import { Prisma } from '@prisma/client';

type DbClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class FinancialAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: FinancialAccountRepository,
    private readonly auditService: AuditService,
  ) {}

  async getOrCreateForReadyUser(userKey: bigint | string, client: DbClient = this.prisma) {
    const isUuid = typeof userKey === 'string' && userKey.includes('-');
    let user: any = null;

    if (isUuid) {
      user = await client.user.findUnique({ where: { id: userKey as string } }) ||
             await client.user.findFirst({ where: { identityId: userKey as string } });
    } else {
      const telegramUserIdBig = typeof userKey === 'bigint' ? userKey : BigInt(userKey);
      user = await client.user.findUnique({ where: { telegramUserId: telegramUserIdBig } });
    }

    if (!user) throw new NotFoundException('USER_NOT_FOUND');

    let existing = await client.financialAccount.findFirst({
      where: { OR: [{ userId: user.id }, { telegramUserId: user.telegramUserId }] },
    });
    if (existing) return existing;

    const ALLOWED_STATES = ['READY', 'READY_FOR_PLATFORM', 'ELIGIBLE_USER', 'ACTIVE_USER', 'AUTHENTICATED', 'NEW'];
    if (!ALLOWED_STATES.includes(user.state) && !user.isReady) {
      throw new BadRequestException('USER_NOT_READY_FOR_FINANCIAL_ACCOUNT');
    }

    const account = await client.financialAccount.create({
      data: {
        userId: user.id,
        telegramUserId: user.telegramUserId,
        status: 'ACTIVE',
        activatedAt: new Date(),
      },
    });

    await this.auditService.createWithClient(client, {
      telegramUserId: user.telegramUserId,
      eventType: AuditEventType.FINANCIAL_ACCOUNT_CREATED,
      description: 'Financial account created for ready user',
      metadata: { financialAccountId: account.id, status: account.status, userId: user.id },
      source: 'financial_account_service',
    });

    return account;
  }
}
