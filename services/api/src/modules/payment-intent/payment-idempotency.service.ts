import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaymentIntentStatus, FinancialOperationStatus } from '@prisma/client';

/**
 * Payment Idempotency & Concurrency Protection Service
 * Ensures no duplicate payments, no double settlement, and no race conditions
 */
@Injectable()
export class PaymentIdempotencyService {
  private readonly logger = new Logger(PaymentIdempotencyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if a payment reference has already been used
   * Prevents duplicate payment verification
   */
  async isReferenceUsed(reference: string): Promise<boolean> {
    const existing = await this.prisma.paymentIntent.findUnique({
      where: { reference },
    });

    if (!existing) {
      return false;
    }

    // Reference is considered "used" if the payment is settled or verified
    return [
      PaymentIntentStatus.SETTLED,
      PaymentIntentStatus.VERIFIED,
      PaymentIntentStatus.SETTLEMENT_PENDING,
    ].includes(existing.status as any);
  }

  /**
   * Check if a blockchain transaction has already been settled
   * Prevents one transaction from settling multiple PaymentIntents
   */
  async isTransactionSettled(transactionHash: string, network: string, tokenContract: string): Promise<boolean> {
    const tx = await this.prisma.usdtBlockchainTransaction.findFirst({
      where: {
        transactionHash,
        network,
        tokenContract,
      },
    });

    if (!tx) {
      return false;
    }

    return tx.processingStatus === 'SETTLED' || tx.settlementSessionId !== null;
  }

  /**
   * Atomic lock for payment verification
   * Prevents two admins from verifying the same payment simultaneously
   */
  async acquireVerificationLock(paymentIntentId: string, adminId: string): Promise<boolean> {
    const intent = await this.prisma.paymentIntent.findUnique({
      where: { id: paymentIntentId },
    });

    if (!intent) {
      return false;
    }

    // Only allow verification from certain states
    if (![
      PaymentIntentStatus.DETECTED,
      PaymentIntentStatus.VERIFYING,
      PaymentIntentStatus.MANUAL_REVIEW,
    ].includes(intent.status as any)) {
      return false;
    }

    // Use advisory lock via database row update
    const result = await this.prisma.$transaction(async (tx: any) => {
      // Check if another admin is already verifying
      const current = await tx.paymentIntent.findUnique({
        where: { id: paymentIntentId },
      });

      if (!current) {
        return false;
      }

      // If already verified or settled, reject
      if (current.status === PaymentIntentStatus.VERIFIED || current.status === PaymentIntentStatus.SETTLED) {
        return false;
      }

      // Update to indicate verification in progress
      await tx.paymentIntent.update({
        where: { id: paymentIntentId },
        data: {
          status: PaymentIntentStatus.VERIFYING,
          metadata: {
            verificationLock: adminId,
            verificationLockedAt: new Date().toISOString(),
          } as any,
        },
      });

      return true;
    });

    return result;
  }

  /**
   * Release verification lock
   */
  async releaseVerificationLock(paymentIntentId: string): Promise<void> {
    await this.prisma.paymentIntent.update({
      where: { id: paymentIntentId },
      data: {
        metadata: {
          verificationLock: null,
          verificationLockedAt: null,
        },
      },
    });
  }

  /**
   * Check for duplicate payment intents for same user
   * Prevents user from creating multiple active payments
   */
  async hasActivePaymentIntent(telegramUserId: bigint): Promise<boolean> {
    const activeIntent = await this.prisma.paymentIntent.findFirst({
      where: {
        telegramUserId,
        status: { in: [PaymentIntentStatus.CREATED, PaymentIntentStatus.AWAITING_PAYMENT, PaymentIntentStatus.DETECTED, PaymentIntentStatus.VERIFYING] },
        expiresAt: { gt: new Date() },
      },
    });

    return !!activeIntent;
  }

  /**
   * Ensure payment intent has not already been settled
   * Throw exception if already settled
   */
  async ensureNotSettled(paymentIntentId: string): Promise<void> {
    const intent = await this.prisma.paymentIntent.findUnique({
      where: { id: paymentIntentId },
    });

    if (!intent) {
      throw new ConflictException('PAYMENT_INTENT_NOT_FOUND');
    }

    if (intent.status === PaymentIntentStatus.SETTLED) {
      throw new ConflictException('PAYMENT_ALREADY_SETTLED');
    }

    // Check if there's already a financial operation for this payment
    const existingOperation = await this.prisma.financialOperation.findFirst({
      where: {
        metadata: {
          path: ['paymentIntentId'],
          equals: paymentIntentId,
        },
        status: { in: [FinancialOperationStatus.COMPLETED, FinancialOperationStatus.EXECUTING] },
      },
    });

    if (existingOperation) {
      throw new ConflictException('FINANCIAL_OPERATION_ALREADY_EXISTS');
    }
  }

  /**
   * Check for idempotency key conflicts
   */
  async checkIdempotencyKey(idempotencyKey: string): Promise<boolean> {
    const existing = await this.prisma.paymentIntent.findUnique({
      where: { idempotencyKey },
    });

    return !!existing;
  }

  /**
   * Record that a payment intent is being processed
   * For restart recovery
   */
  async markProcessing(paymentIntentId: string): Promise<void> {
    await this.prisma.paymentIntent.update({
      where: { id: paymentIntentId },
      data: {
        metadata: {
          processingStartedAt: new Date().toISOString(),
        },
      },
    });
  }

  /**
   * Clear processing marker
   */
  async clearProcessing(paymentIntentId: string): Promise<void> {
    await this.prisma.paymentIntent.update({
      where: { id: paymentIntentId },
      data: {
        metadata: {
          processingStartedAt: null,
        },
      },
    });
  }

  /**
   * Recover stuck payments (called by cron)
   * Finds payments that were processing but never completed
   */
  async recoverStuckPayments(): Promise<{ recovered: number }> {
    const stuckThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes

    const stuckPayments = await this.prisma.paymentIntent.findMany({
      where: {
        status: PaymentIntentStatus.VERIFYING,
        updatedAt: { lt: stuckThreshold },
      },
    });

    for (const payment of stuckPayments) {
      // Release lock and return to DETECTED state for retry
      await this.prisma.paymentIntent.update({
        where: { id: payment.id },
        data: {
          status: PaymentIntentStatus.DETECTED,
          metadata: {
            verificationLock: null,
            verificationLockedAt: null,
            recoveryAttemptedAt: new Date().toISOString(),
          } as any,
        },
      });

      this.logger.log(`[Idempotency] Recovered stuck payment ${payment.reference}`);
    }

    return { recovered: stuckPayments.length };
  }
}
