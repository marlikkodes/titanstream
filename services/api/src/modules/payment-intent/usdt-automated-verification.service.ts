import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaymentIntentService } from './payment-intent.service';
import { PaymentIntentStatus, PaymentMethod, UsdtTxProcessingStatus, Prisma } from '@prisma/client';

/**
 * USDT TRC-20 Automated Verification Service
 * Monitors blockchain transactions and automatically verifies USDT payments
 */
@Injectable()
export class UsdtAutomatedVerificationService {
  private readonly logger = new Logger(UsdtAutomatedVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentIntentService: PaymentIntentService,
  ) {}

  /**
   * Process a detected blockchain transaction
   * Called by blockchain monitoring when a transaction is detected
   */
  async processBlockchainTransaction(
    transactionHash: string,
    network: string,
    tokenContract: string,
    senderAddress: string,
    recipientAddress: string,
    amount: string,
    blockNumber: bigint,
    confirmations: number,
  ): Promise<{ status: string; paymentIntentId?: string; message: string }> {
    this.logger.log(`[USDTVerification] Processing transaction ${transactionHash}`);

    // 1. Validate transaction parameters
    const validationResult = await this.validateTransaction(
      transactionHash,
      network,
      tokenContract,
      recipientAddress,
      amount,
      confirmations,
    );

    if (!validationResult.valid) {
      return {
        status: 'REJECTED',
        message: validationResult.reason || 'Transaction validation failed',
      };
    }

    // 2. Record blockchain transaction
    const txRecord = await this.recordBlockchainTransaction({
      transactionHash,
      network,
      tokenContract,
      senderAddress,
      recipientAddress,
      amount,
      blockNumber,
      confirmations,
    });

    // 3. Find matching PaymentIntent
    const matchedIntent = await this.findMatchingPaymentIntent(
      recipientAddress,
      amount,
      network,
      tokenContract,
    );

    if (!matchedIntent) {
      // No matching intent - mark as ambiguous
      await this.updateTransactionStatus(txRecord.id, UsdtTxProcessingStatus.AMBIGUOUS_MATCH);
      return {
        status: 'NO_MATCHING_INTENT',
        message: 'No matching PaymentIntent found for this transaction',
      };
    }

    // 4. Check for duplicate transaction
    const duplicateTx = await this.checkDuplicateTransaction(transactionHash, network, tokenContract);
    if (duplicateTx) {
      await this.updateTransactionStatus(txRecord.id, UsdtTxProcessingStatus.DUPLICATE);
      return {
        status: 'DUPLICATE',
        paymentIntentId: matchedIntent.id,
        message: 'Transaction already processed',
      };
    }

    // 5. Check amount tolerance
    const amountDiff = Math.abs(Number(matchedIntent.requestedAmount) - parseFloat(amount));
    const tolerance = Number(matchedIntent.requestedAmount) * 0.01; // 1% tolerance
    if (amountDiff > tolerance) {
      await this.updateTransactionStatus(txRecord.id, UsdtTxProcessingStatus.UNDERPAYMENT);
      await this.paymentIntentService.escalateToManualReview(
        matchedIntent.id,
        `Amount mismatch: expected ${matchedIntent.requestedAmount}, received ${amount}`,
      );
      return {
        status: 'AMOUNT_MISMATCH',
        paymentIntentId: matchedIntent.id,
        message: `Amount mismatch: expected ${matchedIntent.requestedAmount}, received ${amount}`,
      };
    }

    // 6. Check confirmations threshold
    const usdtConfig = await this.prisma.usdtConfig.findUnique({ where: { id: 'default' } });
    const requiredConfirmations = usdtConfig?.requiredConfirmations || 19;
    if (confirmations < requiredConfirmations) {
      await this.updateTransactionStatus(txRecord.id, UsdtTxProcessingStatus.CONFIRMING);
      return {
        status: 'INSUFFICIENT_CONFIRMATIONS',
        paymentIntentId: matchedIntent.id,
        message: `Waiting for confirmations: ${confirmations}/${requiredConfirmations}`,
      };
    }

    // 7. All checks passed - mark as detected and start verification
    await this.paymentIntentService.markPaymentDetected(
      matchedIntent.id,
      transactionHash,
      {
        blockNumber: blockNumber.toString(),
        confirmations,
        senderAddress,
      },
    );

    await this.updateTransactionStatus(txRecord.id, UsdtTxProcessingStatus.MATCHED);
    await this.prisma.paymentIntent.update({
      where: { id: matchedIntent.id },
      data: {
        settlementSessionId: txRecord.id,
      },
    });

    // 8. Start automatic verification
    await this.paymentIntentService.startVerification(matchedIntent.id);

    // 9. Auto-verify if all checks pass (no manual review needed)
    const autoVerified = await this.autoVerifyPaymentIntent(matchedIntent.id, txRecord);

    if (autoVerified) {
      return {
        status: 'AUTO_VERIFIED',
        paymentIntentId: matchedIntent.id,
        message: 'Payment automatically verified and settled',
      };
    }

    return {
      status: 'MANUAL_REVIEW_REQUIRED',
      paymentIntentId: matchedIntent.id,
      message: 'Payment requires manual review',
    };
  }

  /**
   * Validate transaction parameters
   */
  private async validateTransaction(
    transactionHash: string,
    network: string,
    tokenContract: string,
    recipientAddress: string,
    amount: string,
    confirmations: number,
  ): Promise<{ valid: boolean; reason?: string }> {
    const config = await this.prisma.usdtConfig.findUnique({ where: { id: 'default' } });

    // Check network
    if (network !== config?.network) {
      return { valid: false, reason: `Invalid network: ${network}` };
    }

    // Check token contract
    if (tokenContract !== config?.tokenContract) {
      return { valid: false, reason: `Invalid token contract: ${tokenContract}` };
    }

    // Check recipient address
    if (recipientAddress !== config?.receivingAddress) {
      return { valid: false, reason: `Invalid recipient address` };
    }

    // Check amount is positive
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return { valid: false, reason: 'Invalid amount' };
    }

    return { valid: true };
  }

  /**
   * Record blockchain transaction in database
   */
  private async recordBlockchainTransaction(data: {
    transactionHash: string;
    network: string;
    tokenContract: string;
    senderAddress: string;
    recipientAddress: string;
    amount: string;
    blockNumber: bigint;
    confirmations: number;
  }): Promise<any> {
    return this.prisma.usdtBlockchainTransaction.create({
      data: {
        transactionHash: data.transactionHash,
        network: data.network,
        tokenContract: data.tokenContract,
        blockNumber: data.blockNumber,
        blockTimestamp: new Date(),
        senderAddress: data.senderAddress,
        recipientAddress: data.recipientAddress,
        rawTokenAmount: data.amount,
        normalizedAmount: new Prisma.Decimal(data.amount),
        confirmations: data.confirmations,
        onChainStatus: 'SUCCESS',
        processingStatus: UsdtTxProcessingStatus.DETECTED,
        firstObservedAt: new Date(),
        lastObservedAt: new Date(),
      },
    });
  }

  /**
   * Find matching PaymentIntent for a transaction
   * Uses recipient address, amount, and time window
   */
  private async findMatchingPaymentIntent(
    recipientAddress: string,
    amount: string,
    network: string,
    tokenContract: string,
  ): Promise<any> {
    const amountNum = parseFloat(amount);
    const tolerance = amountNum * 0.01; // 1% tolerance

    // Find PaymentIntents with matching USDT address
    const intents = await this.prisma.paymentIntent.findMany({
      where: {
        paymentMethod: PaymentMethod.USDT_TRC20,
        usdtAddress: recipientAddress,
        status: { in: [PaymentIntentStatus.AWAITING_PAYMENT, PaymentIntentStatus.DETECTED] },
        expiresAt: { gt: new Date() },
      },
      include: { attempts: true },
    });

    // Find intents with matching amount within tolerance
    const matchingIntents = intents.filter(intent => {
      const expectedAmount = Number(intent.requestedAmount);
      const diff = Math.abs(expectedAmount - amountNum);
      return diff <= tolerance;
    });

    // If multiple intents match, escalate to manual review (static address ambiguity)
    if (matchingIntents.length > 1) {
      this.logger.warn(`[USDTVerification] Multiple PaymentIntents match transaction: ${matchingIntents.length} matches. Escalating to manual review.`);
      return null; // Return null to trigger manual review
    }

    // If exactly one intent matches, return it
    if (matchingIntents.length === 1) {
      return matchingIntents[0];
    }

    // No matches found
    return null;
  }

  /**
   * Check for duplicate transaction
   */
  private async checkDuplicateTransaction(
    transactionHash: string,
    network: string,
    tokenContract: string,
  ): Promise<boolean> {
    const existing = await this.prisma.usdtBlockchainTransaction.findFirst({
      where: {
        transactionHash,
        network,
        tokenContract,
      },
    });

    return !!existing;
  }

  /**
   * Update transaction processing status
   */
  private async updateTransactionStatus(
    transactionId: string,
    status: UsdtTxProcessingStatus,
  ): Promise<void> {
    await this.prisma.usdtBlockchainTransaction.update({
      where: { id: transactionId },
      data: {
        processingStatus: status,
        lastObservedAt: new Date(),
      },
    });
  }

  /**
   * Auto-verify payment if all criteria pass
   * Returns true if auto-verified, false if manual review needed
   */
  private async autoVerifyPaymentIntent(
    paymentIntentId: string,
    txRecord: any,
  ): Promise<boolean> {
    const intent = await this.prisma.paymentIntent.findUnique({
      where: { id: paymentIntentId },
      include: { verification: true },
    });

    if (!intent) {
      return false;
    }

    // Check if already verified
    if (intent.status === PaymentIntentStatus.VERIFIED || intent.status === PaymentIntentStatus.SETTLED) {
      return true;
    }

    // Auto-verify if no anomalies detected
    try {
      await this.paymentIntentService.verifyPaymentIntent(
        paymentIntentId,
        'SYSTEM_AUTO', // System as admin for auto-verification
        'system@tetherstream.com',
        Number(intent.requestedAmount),
        intent.currency,
        txRecord.transactionHash,
        txRecord.transactionHash,
        'Auto-verified by USDT blockchain monitoring',
      );

      // Auto-settle after verification
      await this.paymentIntentService.settlePaymentIntent(paymentIntentId);

      return true;
    } catch (error) {
      this.logger.warn(`[USDTVerification] Auto-verification failed for ${intent.reference}: ${error.message}`);
      // Escalate to manual review
      await this.paymentIntentService.escalateToManualReview(
        paymentIntentId,
        `Auto-verification failed: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Poll for blockchain transactions (called by cron)
   */
  async pollBlockchainTransactions(): Promise<{ processed: number; errors: number }> {
    const config = await this.prisma.usdtConfig.findUnique({ where: { id: 'default' } });
    if (!config || !config.enabled) {
      return { processed: 0, errors: 0 };
    }

    // Get last scanned block
    const lastScannedBlock = config.lastScannedBlock || BigInt(0);
    const currentBlock = await this.getCurrentBlockNumber();

    this.logger.log(`[USDTVerification] Polling blocks ${lastScannedBlock} to ${currentBlock}`);

    let processed = 0;
    let errors = 0;

    // In production, this would query the TRON blockchain API
    // For now, this is a placeholder that would be replaced with actual blockchain polling
    // The implementation would:
    // 1. Query TRON API for blocks from lastScannedBlock to currentBlock
    // 2. Extract USDT transactions to the configured receiving address
    // 3. Call processBlockchainTransaction for each transaction
    // 4. Update lastScannedBlock

    // Update last scanned block
    await this.prisma.usdtConfig.update({
      where: { id: 'default' },
      data: {
        lastScannedBlock: currentBlock,
        lastScanAt: new Date(),
      },
    });

    return { processed, errors };
  }

  /**
   * Get current block number (placeholder - would query TRON API in production)
   */
  private async getCurrentBlockNumber(): Promise<bigint> {
    // Placeholder - in production, query TRON API
    // For now, return a simulated block number
    const config = await this.prisma.usdtConfig.findUnique({ where: { id: 'default' } });
    return (config?.lastScannedBlock || BigInt(0)) + BigInt(1);
  }
}
