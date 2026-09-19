import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaymentIntentStatus, PaymentMethod, UsdtTxProcessingStatus, Prisma } from '@prisma/client';

/**
 * USDT Exception Queue Service
 * Manages USDT transactions that require manual review
 */
@Injectable()
export class UsdtExceptionQueueService {
  private readonly logger = new Logger(UsdtExceptionQueueService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get USDT transactions requiring manual review
   */
  async getExceptionQueue(limit = 50, offset = 0): Promise<any[]> {
    const transactions = await this.prisma.usdtBlockchainTransaction.findMany({
      where: {
        processingStatus: {
          in: [
            UsdtTxProcessingStatus.AMBIGUOUS_MATCH,
            UsdtTxProcessingStatus.UNDERPAYMENT,
            UsdtTxProcessingStatus.OVERPAYMENT,
            UsdtTxProcessingStatus.RECONCILIATION_REQUIRED,
            UsdtTxProcessingStatus.PENDING_ADMIN_APPROVAL,
          ],
        },
      },
      // include: {
      //   paymentIntent: true,
      // },
      orderBy: { firstObservedAt: 'asc' },
      take: limit,
      skip: offset,
    });

    return transactions.map(tx => ({
      id: tx.id,
      transactionHash: tx.transactionHash,
      network: tx.network,
      senderAddress: tx.senderAddress,
      recipientAddress: tx.recipientAddress,
      amount: tx.normalizedAmount.toString(),
      confirmations: tx.confirmations,
      processingStatus: tx.processingStatus,
      anomalyReason: tx.anomalyReason,
      // paymentIntent: tx.paymentIntent, // Not available in current schema
      firstObservedAt: tx.firstObservedAt,
    }));
  }

  /**
   * Get unmatched transactions (ambiguous matches)
   */
  async getUnmatchedTransactions(limit = 50, offset = 0): Promise<any[]> {
    const transactions = await this.prisma.usdtBlockchainTransaction.findMany({
      where: {
        processingStatus: UsdtTxProcessingStatus.AMBIGUOUS_MATCH,
        settlementSessionId: null,
      },
      orderBy: { firstObservedAt: 'asc' },
      take: limit,
      skip: offset,
    });

    return transactions.map(tx => ({
      id: tx.id,
      transactionHash: tx.transactionHash,
      network: tx.network,
      senderAddress: tx.senderAddress,
      recipientAddress: tx.recipientAddress,
      amount: tx.normalizedAmount.toString(),
      confirmations: tx.confirmations,
      firstObservedAt: tx.firstObservedAt,
    }));
  }

  /**
   * Manually match a transaction to a PaymentIntent
   */
  async manualMatchTransaction(
    transactionId: string,
    paymentIntentId: string,
    adminId: string,
    adminEmail: string,
  ): Promise<any> {
    const tx = await this.prisma.usdtBlockchainTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!tx) {
      throw new Error('Transaction not found');
    }

    const intent = await this.prisma.paymentIntent.findUnique({
      where: { id: paymentIntentId },
    });

    if (!intent) {
      throw new Error('PaymentIntent not found');
    }

    // Link transaction to PaymentIntent
    await this.prisma.usdtBlockchainTransaction.update({
      where: { id: transactionId },
      data: {
        settlementSessionId: paymentIntentId,
        processingStatus: UsdtTxProcessingStatus.MATCHED,
      },
    });

    // Update PaymentIntent with blockchain reference
    await this.prisma.paymentIntent.update({
      where: { id: paymentIntentId },
      data: {
        settlementSessionId: transactionId,
      },
    });

    this.logger.log(`[UsdtExceptionQueue] Manually matched transaction ${tx.transactionHash} to PaymentIntent ${intent.reference}`);

    return {
      success: true,
      transactionId,
      paymentIntentId,
      message: 'Transaction manually matched to PaymentIntent',
    };
  }

  /**
   * Escalate transaction for manual review
   */
  async escalateTransaction(transactionId: string, reason: string): Promise<any> {
    await this.prisma.usdtBlockchainTransaction.update({
      where: { id: transactionId },
      data: {
        processingStatus: UsdtTxProcessingStatus.PENDING_ADMIN_APPROVAL,
        anomalyReason: reason,
      },
    });

    this.logger.log(`[UsdtExceptionQueue] Transaction ${transactionId} escalated for manual review: ${reason}`);

    return { success: true, message: 'Transaction escalated for manual review' };
  }

  /**
   * Mark transaction as settled
   */
  async markTransactionSettled(transactionId: string, orchestratorReference: string): Promise<any> {
    await this.prisma.usdtBlockchainTransaction.update({
      where: { id: transactionId },
      data: {
        processingStatus: UsdtTxProcessingStatus.SETTLED,
        orchestratorReference,
        finalizedAt: new Date(),
      },
    });

    this.logger.log(`[UsdtExceptionQueue] Transaction ${transactionId} marked as settled`);

    return { success: true, message: 'Transaction marked as settled' };
  }

  /**
   * Reject transaction
   */
  async rejectTransaction(transactionId: string, reason: string): Promise<any> {
    await this.prisma.usdtBlockchainTransaction.update({
      where: { id: transactionId },
      data: {
        processingStatus: UsdtTxProcessingStatus.FAILED,
        anomalyReason: reason,
        finalizedAt: new Date(),
      },
    });

    this.logger.log(`[UsdtExceptionQueue] Transaction ${transactionId} rejected: ${reason}`);

    return { success: true, message: 'Transaction rejected' };
  }
}
