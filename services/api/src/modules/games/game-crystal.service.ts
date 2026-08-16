import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CrystalTransactionType, Prisma } from '@prisma/client';

type TxClient = Prisma.TransactionClient | PrismaService;

/**
 * First-class crystal ledger. Crystals are the gameplay currency and are kept
 * fully separate from financial (USDT/TON) balances. Every movement is a
 * signed, append-only transaction with a balance-after snapshot.
 *
 * Atomicity contract: callers may pass an outer Prisma transaction client so
 * that crystal movements commit or roll back together with game sessions and
 * financial rewards.
 */
@Injectable()
export class GameCrystalService {
  private readonly logger = new Logger(GameCrystalService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateAccount(userKey: bigint | string, client: TxClient = this.prisma) {
    const isUuid = typeof userKey === 'string' && userKey.includes('-');
    let user: any = null;

    if (isUuid) {
      user = await client.user.findUnique({ where: { id: userKey as string } });
    } else {
      const telegramUserId = typeof userKey === 'bigint' ? userKey : BigInt(userKey);
      user = await client.user.findUnique({ where: { telegramUserId } });
    }

    if (!user) throw new BadRequestException('USER_NOT_FOUND');

    let existing = await client.crystalAccount.findFirst({
      where: { telegramUserId: user.telegramUserId || undefined },
    });

    if (existing) return existing;

    return client.crystalAccount.create({
      data: {
        telegramUserId: user.telegramUserId || BigInt(0),
        balance: 100,
      },
    });
  }

  async getAccount(userKey: bigint | string) {
    return this.getOrCreateAccount(userKey);
  }

  async getBalance(userKey: bigint | string): Promise<number> {
    const account = await this.getAccount(userKey);
    return account.balance;
  }

  async getTransactions(userKey: bigint | string, limit = 50, offset = 0) {
    const account = await this.getAccount(userKey);
    return this.prisma.crystalTransaction.findMany({
      where: { telegramUserId: account.telegramUserId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Credit crystals. Returns the resulting balance. Idempotent per reference —
   * a duplicate reference is rejected instead of double-crediting.
   */
  async credit(
    telegramUserId: bigint,
    amount: number,
    type: CrystalTransactionType,
    reference: string,
    metadata?: Record<string, unknown>,
    client: TxClient = this.prisma,
  ): Promise<number> {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException({ code: 'INVALID_CRYSTAL_AMOUNT', message: 'Crystal credit amount must be a positive integer.' });
    }

    const existing = await client.crystalTransaction.findUnique({ where: { reference } });
    if (existing) {
      return existing.balanceAfter;
    }

    const account = await this.getOrCreateAccount(telegramUserId, client);

    const updated = await client.crystalAccount.update({
      where: { id: account.id },
      data: {
        balance: { increment: amount },
        lifetimeEarned: { increment: amount },
      },
    });

    await client.crystalTransaction.create({
      data: {
        telegramUserId,
        accountId: account.id,
        type,
        amount,
        balanceAfter: updated.balance,
        reference,
        metadata: (metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });

    return updated.balance;
  }

  /**
   * Debit crystals after verifying sufficient balance. Returns the resulting
   * balance. Rejects when balance is insufficient.
   */
  async debit(
    telegramUserId: bigint,
    amount: number,
    type: CrystalTransactionType,
    reference: string,
    metadata?: Record<string, unknown>,
    client: TxClient = this.prisma,
  ): Promise<number> {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException({ code: 'INVALID_CRYSTAL_AMOUNT', message: 'Crystal debit amount must be a positive integer.' });
    }

    const account = await this.getOrCreateAccount(telegramUserId, client);
    if (account.balance < amount) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_CRYSTALS',
        message: 'Not enough Crystals. Earn more through daily login, games and missions.',
        balance: account.balance,
        required: amount,
      });
    }

    const updated = await client.crystalAccount.update({
      where: { id: account.id },
      data: {
        balance: { decrement: amount },
        lifetimeSpent: { increment: amount },
      },
    });

    await client.crystalTransaction.create({
      data: {
        telegramUserId,
        accountId: account.id,
        type,
        amount: -amount,
        balanceAfter: updated.balance,
        reference,
        metadata: (metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });

    return updated.balance;
  }

  /**
   * Admin adjustment. Positive credits, negative debits. Reversals are not
   * permitted — corrections are new transactions with their own audit trail.
   */
  async adjust(telegramUserId: bigint, amount: number, reason: string, adminActor: string) {
    if (amount === 0) {
      throw new BadRequestException({ code: 'INVALID_CRYSTAL_AMOUNT', message: 'Adjustment amount must be non-zero.' });
    }
    const reference = `crystal_admin_${telegramUserId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    if (amount > 0) {
      return this.credit(telegramUserId, amount, CrystalTransactionType.ADMIN_ADJUSTMENT, reference, { reason, actor: adminActor });
    }
    return this.debit(telegramUserId, Math.abs(amount), CrystalTransactionType.ADMIN_ADJUSTMENT, reference, { reason, actor: adminActor });
  }
}
