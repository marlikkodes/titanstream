import { Injectable, BadRequestException, NotFoundException, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SettlementService } from './settlement.service';
import { SettlementStatus, SettlementEventType } from '@prisma/client';
import { ProviderEventService } from './provider-event.service';

export enum MatchingFailureReason {
  REFERENCE_NOT_FOUND = 'REFERENCE_NOT_FOUND',
  MERCHANT_MISMATCH = 'MERCHANT_MISMATCH',
  NETWORK_MISMATCH = 'NETWORK_MISMATCH',
  AMOUNT_MISMATCH = 'AMOUNT_MISMATCH',
  CURRENCY_MISMATCH = 'CURRENCY_MISMATCH',
  TRANSACTION_ALREADY_CONSUMED = 'TRANSACTION_ALREADY_CONSUMED',
  TRANSACTION_NOT_COMPLETED = 'TRANSACTION_NOT_COMPLETED',
  OUTSIDE_ALLOWED_TIME_WINDOW = 'OUTSIDE_ALLOWED_TIME_WINDOW',
  SETTLEMENT_ALREADY_COMPLETED = 'SETTLEMENT_ALREADY_COMPLETED',
  INVALID_REFERENCE = 'INVALID_REFERENCE',
  SUSPICIOUS_TRANSACTION = 'SUSPICIOUS_TRANSACTION',
}

@Injectable()
export class MerchantPaymentMatchingService implements OnModuleInit {
  private readonly logger = new Logger(MerchantPaymentMatchingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settlementService: SettlementService,
    private readonly providerEvents: ProviderEventService,
  ) {}

  onModuleInit() {
    this.logger.log('Initializing Merchant Payment Matching Engine & Background Worker...');
    // Start background matching worker loop every 10 seconds
    setInterval(() => {
      this.retryPendingClaimsMatching().catch((err) => {
        this.logger.error(`[BACKGROUND_MATCHING_ERR] ${err.message}`);
      });
    }, 10000);
  }

  /**
   * Customer submits a Mobile Money transaction reference (e.g. CM123456).
   * Creates a MerchantPaymentClaim record and triggers matching attempt.
   */
  async submitCustomerReference(settlementId: string, telegramUserId: bigint, rawReference: string) {
    const ref = (rawReference || '').trim();
    if (!ref || ref.length < 3) {
      throw new BadRequestException('INVALID_TRANSACTION_REFERENCE');
    }

    let session: any = null;
    try {
      session = await this.prisma.settlementSession.findUnique({
        where: { id: settlementId },
        include: { merchant: true },
      });
    } catch (dbErr: any) {
      this.logger.warn(`[PAYMENT_CLAIM_DB_WARN] Could not find session: ${dbErr?.message}`);
    }

    if (!session || session.telegramUserId !== telegramUserId) throw new NotFoundException('SETTLEMENT_NOT_FOUND');

    if (session.status === SettlementStatus.COMPLETED) {
      throw new BadRequestException('SETTLEMENT_ALREADY_COMPLETED');
    }

    const claimId = `claim_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    let claim: any = null;
    try {
      // Create or update MerchantPaymentClaim
      claim = await this.prisma.merchantPaymentClaim.create({
        data: {
          settlementId,
          telegramUserId,
          merchantId: session.merchantId || 'mch_mtn_ug_1',
          network: session.mobileMoneyNetwork,
          expectedAmount: session.requestedAmount,
          expectedCurrency: 'UGX',
          submittedReference: ref,
          status: 'REFERENCE_SUBMITTED',
        },
      });

      // Update SettlementSession status to AWAITING_VERIFICATION and record submittedReference
      await this.prisma.settlementSession.update({
        where: { id: settlementId },
        data: {
          status: SettlementStatus.AWAITING_VERIFICATION,
          submittedReference: ref,
          events: {
            create: {
              eventType: SettlementEventType.SettlementVerificationStarted,
              actorType: 'CUSTOMER',
              actorId: telegramUserId.toString(),
              payload: { submittedReference: ref, claimId: claim.id },
            },
          },
        },
      });
    } catch (claimErr: any) {
      this.logger.warn(`[PAYMENT_CLAIM_WARN] Could not persist claim: ${claimErr?.message}`);
      claim = {
        id: claimId,
        settlementId,
        merchantId: session.merchantId || 'mch_mtn_ug_1',
        telegramUserId,
        submittedReference: ref,
      };
    }

    this.logger.log(`[PAYMENT_CLAIM] Submitted reference "${ref}" for settlement [${settlementId}]. Attempting automatic matching...`);

    // Execute 10-step matching attempt synchronously
    const matchResult = await this.attemptMatchClaim(claim.id);
    return {
      claimId: claim.id,
      settlementId: claim.settlementId,
      merchantId: claim.merchantId,
      telegramUserId: claim.telegramUserId.toString(),
      submittedReference: claim.submittedReference,
      status: matchResult.matched ? 'COMPLETED' : 'AWAITING_VERIFICATION',
      failureReason: matchResult.failureReason,
      matched: matchResult.matched,
    };
  }

  /**
   * 10-step Authoritative Verification & Matching Engine.
   */
  async attemptMatchClaim(claimId: string): Promise<{ matched: boolean; failureReason?: MatchingFailureReason }> {
    let claim: any = null;
    try {
      claim = await this.prisma.merchantPaymentClaim.findUnique({
        where: { id: claimId },
        include: { settlement: true },
      });
    } catch (dbErr: any) {
      this.logger.warn(`[MATCHING_ENGINE_DB_WARN] Could not find claim: ${dbErr?.message}`);
      return { matched: false, failureReason: MatchingFailureReason.REFERENCE_NOT_FOUND };
    }

    if (!claim || !claim.settlement) {
      return { matched: false, failureReason: MatchingFailureReason.REFERENCE_NOT_FOUND };
    }

    const session = claim.settlement;
    if (session.status === SettlementStatus.COMPLETED) {
      return { matched: false, failureReason: MatchingFailureReason.SETTLEMENT_ALREADY_COMPLETED };
    }

    // Step 1: Look up authoritative MerchantTransaction by reference (case-insensitive)
    let tx: any = null;
    try {
      tx = await this.prisma.merchantTransaction.findFirst({
        where: {
          transactionReference: {
            equals: claim.submittedReference,
            mode: 'insensitive',
          },
        },
      });
    } catch (dbErr: any) {
      this.logger.warn(`[MATCHING_ENGINE_DB_WARN] Could not find transaction: ${dbErr?.message}`);
    }

    if (!tx) {
      try {
        await this.prisma.merchantPaymentClaim.update({
          where: { id: claimId },
          data: { status: 'AWAITING_VERIFICATION', failureReason: MatchingFailureReason.REFERENCE_NOT_FOUND },
        });
      } catch {}
      return { matched: false, failureReason: MatchingFailureReason.REFERENCE_NOT_FOUND };
    }

    // Step 2: Verify merchant matches
    if (session.merchantId && tx.merchantId !== session.merchantId) {
      await this.prisma.merchantPaymentClaim.update({
        where: { id: claimId },
        data: { status: 'AWAITING_VERIFICATION', failureReason: MatchingFailureReason.MERCHANT_MISMATCH },
      });
      return { matched: false, failureReason: MatchingFailureReason.MERCHANT_MISMATCH };
    }

    // Step 3: Verify network matches
    if (tx.network.toUpperCase() !== session.mobileMoneyNetwork.toUpperCase()) {
      await this.prisma.merchantPaymentClaim.update({
        where: { id: claimId },
        data: { status: 'AWAITING_VERIFICATION', failureReason: MatchingFailureReason.NETWORK_MISMATCH },
      });
      return { matched: false, failureReason: MatchingFailureReason.NETWORK_MISMATCH };
    }

    // Step 4: Verify currency matches
    if (tx.currency.toUpperCase() !== 'UGX') {
      await this.prisma.merchantPaymentClaim.update({
        where: { id: claimId },
        data: { status: 'AWAITING_VERIFICATION', failureReason: MatchingFailureReason.CURRENCY_MISMATCH },
      });
      return { matched: false, failureReason: MatchingFailureReason.CURRENCY_MISMATCH };
    }

    // Step 5: Verify amount matches exactly
    if (!tx.amount.equals(session.requestedAmount)) {
      this.logger.warn(`[MATCHING_MISMATCH] Amount mismatch for ref "${tx.transactionReference}": Expected ${session.requestedAmount}, Tx has ${tx.amount}`);
      await this.prisma.merchantPaymentClaim.update({
        where: { id: claimId },
        data: { status: 'AWAITING_VERIFICATION', failureReason: MatchingFailureReason.AMOUNT_MISMATCH },
      });
      return { matched: false, failureReason: MatchingFailureReason.AMOUNT_MISMATCH };
    }

    // Step 6: Verify provider status is SUCCESS
    if (tx.providerStatus !== 'SUCCESS' && tx.providerStatus !== 'COMPLETED') {
      await this.prisma.merchantPaymentClaim.update({
        where: { id: claimId },
        data: { status: 'AWAITING_VERIFICATION', failureReason: MatchingFailureReason.TRANSACTION_NOT_COMPLETED },
      });
      return { matched: false, failureReason: MatchingFailureReason.TRANSACTION_NOT_COMPLETED };
    }

    // Step 7: Verify transaction is not already consumed
    if (tx.consumedAt !== null) {
      await this.prisma.merchantPaymentClaim.update({
        where: { id: claimId },
        data: { status: 'AWAITING_VERIFICATION', failureReason: MatchingFailureReason.TRANSACTION_ALREADY_CONSUMED },
      });
      return { matched: false, failureReason: MatchingFailureReason.TRANSACTION_ALREADY_CONSUMED };
    }

    // Step 8: Verify timestamp is within 48h allowed window
    const maxWindowMs = 48 * 60 * 60 * 1000;
    const sessionTime = session.createdAt.getTime();
    const txTime = tx.transactionTimestamp.getTime();
    if (Math.abs(sessionTime - txTime) > maxWindowMs) {
      await this.prisma.merchantPaymentClaim.update({
        where: { id: claimId },
        data: { status: 'AWAITING_VERIFICATION', failureReason: MatchingFailureReason.OUTSIDE_ALLOWED_TIME_WINDOW },
      });
      return { matched: false, failureReason: MatchingFailureReason.OUTSIDE_ALLOWED_TIME_WINDOW };
    }

    // Step 9 & 10: MATCHED! Perform atomic consumption & financial settlement
    this.logger.log(`[MATCHING_SUCCESS] Authoritative match found for claim [${claimId}] ref "${tx.transactionReference}"! Executing settlement...`);

    // Use Prisma transaction to atomically mark transaction consumed and claim matched
    await this.prisma.$transaction(async (txPrisma) => {
      await txPrisma.merchantTransaction.update({
        where: { id: tx.id },
        data: { consumedAt: new Date() },
      });

      await txPrisma.merchantPaymentClaim.update({
        where: { id: claimId },
        data: { status: 'MATCHED', failureReason: null },
      });
    });

    // Invoke authoritative SettlementService completion (posts to FinancialOrchestrator & Ledger)
    await this.settlementService.processSettlementApproved(session.id, {
      matchedReference: tx.transactionReference,
      merchantId: tx.merchantId,
      amount: tx.amount.toString(),
      source: 'merchant_payment_matching_engine',
    });

    return { matched: true };
  }

  /**
   * Ingests an authoritative MerchantTransaction (e.g. from bank statement, telco SMS, or provider feed).
   * Automatically triggers matching against any pending claims.
   */
  async ingestMerchantTransaction(data: {
    merchantId: string;
    network: string;
    transactionReference: string;
    amount: number;
    currency?: string;
    senderPhone?: string;
    recipientMerchant?: string;
    rawMetadata?: Record<string, any>;
  }) {
    const ref = data.transactionReference.trim();

    // Upsert transaction to prevent duplicates
    const tx = await this.prisma.merchantTransaction.upsert({
      where: { transactionReference: ref },
      update: {
        providerStatus: 'SUCCESS',
        amount: data.amount,
      },
      create: {
        merchantId: data.merchantId,
        network: data.network.toUpperCase(),
        transactionReference: ref,
        amount: data.amount,
        currency: (data.currency || 'UGX').toUpperCase(),
        senderPhone: data.senderPhone || null,
        recipientMerchant: data.recipientMerchant || 'TitanStream Escrow',
        providerStatus: 'SUCCESS',
        rawMetadata: data.rawMetadata || {},
      },
    });

    this.logger.log(`[INGEST_TX] Ingested merchant transaction "${ref}" (${tx.amount} ${tx.currency}). Triggering automatic claim matching...`);

    // Trigger retry matching for all claims matching this reference
    await this.retryPendingClaimsMatching(ref);

    return tx;
  }

  /**
   * Worker retry loop for claims in AWAITING_VERIFICATION.
   */
  async retryPendingClaimsMatching(specificReference?: string) {
    const whereClause: any = {
      status: { in: ['REFERENCE_SUBMITTED', 'AWAITING_VERIFICATION'] },
    };

    if (specificReference) {
      whereClause.submittedReference = { equals: specificReference, mode: 'insensitive' };
    }

    const pendingClaims = await this.prisma.merchantPaymentClaim.findMany({
      where: whereClause,
      take: 50,
      orderBy: { createdAt: 'asc' },
    });

    if (pendingClaims.length === 0) return;

    for (const claim of pendingClaims) {
      try {
        await this.attemptMatchClaim(claim.id);
      } catch (err: any) {
        this.logger.error(`[RETRY_MATCHING_ERR] Failed matching claim [${claim.id}]: ${err.message}`);
      }
    }
  }
}
