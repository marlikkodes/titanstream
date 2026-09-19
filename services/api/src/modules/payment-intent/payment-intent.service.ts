import { Injectable, Logger, BadRequestException, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FinancialOperationType, PaymentIntentStatus, PaymentMethod, Prisma } from '@prisma/client';
import { FinancialOrchestratorService } from '../financial-orchestration/financial-orchestrator.service';
import { ExchangeRateService } from '../financial/exchange-rate.service';
import { NotificationService } from '../notification/notification.service';
import { AuditService } from '../audit/audit.service';
import { AuditEventType } from '@prisma/client';
import { CreatePaymentIntentDto, PaymentIntentView } from './interfaces/payment-intent.interface';
import { PaymentIdempotencyService } from './payment-idempotency.service';
import { AdminFourEyesService } from './admin-four-eyes.service';

@Injectable()
export class PaymentIntentService {
  private readonly logger = new Logger(PaymentIntentService.name);
  private readonly INTENT_EXPIRY_MINUTES = 15;

  // State machine transitions
  private readonly VALID_TRANSITIONS: Record<PaymentIntentStatus, PaymentIntentStatus[]> = {
    [PaymentIntentStatus.CREATED]: [PaymentIntentStatus.AWAITING_PAYMENT, PaymentIntentStatus.CANCELLED, PaymentIntentStatus.EXPIRED],
    [PaymentIntentStatus.AWAITING_PAYMENT]: [PaymentIntentStatus.DETECTED, PaymentIntentStatus.CANCELLED, PaymentIntentStatus.EXPIRED],
    [PaymentIntentStatus.DETECTED]: [PaymentIntentStatus.VERIFYING, PaymentIntentStatus.MANUAL_REVIEW, PaymentIntentStatus.FAILED, PaymentIntentStatus.REJECTED, PaymentIntentStatus.EXPIRED],
    [PaymentIntentStatus.VERIFYING]: [PaymentIntentStatus.VERIFIED, PaymentIntentStatus.MANUAL_REVIEW, PaymentIntentStatus.FAILED, PaymentIntentStatus.REJECTED, PaymentIntentStatus.EXPIRED],
    [PaymentIntentStatus.VERIFIED]: [PaymentIntentStatus.SETTLEMENT_PENDING, PaymentIntentStatus.FAILED, PaymentIntentStatus.EXPIRED],
    [PaymentIntentStatus.SETTLEMENT_PENDING]: [PaymentIntentStatus.SETTLED, PaymentIntentStatus.FAILED, PaymentIntentStatus.EXPIRED],
    [PaymentIntentStatus.SETTLED]: [],
    [PaymentIntentStatus.FAILED]: [],
    [PaymentIntentStatus.EXPIRED]: [],
    [PaymentIntentStatus.CANCELLED]: [],
    [PaymentIntentStatus.MANUAL_REVIEW]: [PaymentIntentStatus.VERIFIED, PaymentIntentStatus.REJECTED, PaymentIntentStatus.FAILED, PaymentIntentStatus.EXPIRED],
    [PaymentIntentStatus.REJECTED]: [],
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly orchestrator: FinancialOrchestratorService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly notification: NotificationService,
    private readonly audit: AuditService,
    private readonly idempotency: PaymentIdempotencyService,
    private readonly fourEyes: AdminFourEyesService,
  ) {}

  /**
   * Create a new PaymentIntent
   * This is the canonical entry point for all payment flows
   */
  async createPaymentIntent(dto: CreatePaymentIntentDto): Promise<PaymentIntentView> {
    const { telegramUserId, paymentMethod, requestedAmount, currency = 'USDT', country = 'GLOBAL', network } = dto;

    // Check for active intents to prevent duplicate payments
    const hasActive = await this.idempotency.hasActivePaymentIntent(telegramUserId);
    if (hasActive) {
      throw new ConflictException('ACTIVE_PAYMENT_INTENT_EXISTS: You have an active payment. Please complete or cancel it before creating a new one.');
    }

    // Get authoritative exchange rate (never trust client-provided rate)
    const rateData = await this.exchangeRateService.lockRateForSettlement(currency);
    const exchangeRate = rateData.userRate;
    const expectedCryptoAmount = currency === 'USDT' 
      ? requestedAmount 
      : Number((requestedAmount / exchangeRate).toFixed(6));

    // Generate unique reference and idempotency key
    const reference = `PAY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const idempotencyKey = `pay_intent_${telegramUserId}_${Date.now()}`;

    // Calculate expiration
    const expiresAt = new Date(Date.now() + this.INTENT_EXPIRY_MINUTES * 60 * 1000);

    // Determine destination based on payment method
    let merchantDestination: string | undefined;
    let usdtAddress: string | undefined;

    if (paymentMethod === PaymentMethod.USDT_TRC20) {
      const usdtConfig = await this.prisma.usdtConfig.findUnique({ where: { id: 'default' } });
      if (!usdtConfig || !usdtConfig.receivingAddress) {
        throw new BadRequestException('USDT_RECEIVING_ADDRESS_NOT_CONFIGURED');
      }
      usdtAddress = usdtConfig.receivingAddress;
    } else if (paymentMethod === PaymentMethod.MOBILE_MONEY) {
      // Merchant destination will be set based on country/network configuration
      merchantDestination = await this.resolveMerchantDestination(country, network);
    }

    // Create PaymentIntent in database (persistent, not in-memory)
    const intent = await this.prisma.paymentIntent.create({
      data: {
        telegramUserId,
        reference,
        status: PaymentIntentStatus.CREATED,
        paymentMethod,
        asset: dto.asset || 'USDT',
        requestedAmount: new Prisma.Decimal(requestedAmount),
        expectedCryptoAmount: new Prisma.Decimal(expectedCryptoAmount),
        currency,
        country,
        network: network || 'GLOBAL',
        exchangeRate: new Prisma.Decimal(exchangeRate),
        merchantDestination,
        usdtAddress,
        expiresAt,
        idempotencyKey,
        metadata: dto.metadata || {},
      },
    });

    // Transition to AWAITING_PAYMENT immediately after creation
    const updatedIntent = await this.transitionStatus(intent.id, PaymentIntentStatus.AWAITING_PAYMENT, PaymentIntentStatus.CREATED);

    this.logger.log(`[PaymentIntent] Created ${reference} for user ${telegramUserId}, method: ${paymentMethod}, amount: ${requestedAmount} ${currency}`);

    return this.toView(updatedIntent);
  }

  /**
   * Get a PaymentIntent by ID (for current user)
   */
  async getPaymentIntent(id: string, telegramUserId: bigint): Promise<PaymentIntentView> {
    const intent = await this.prisma.paymentIntent.findFirst({
      where: { id, telegramUserId },
      include: { attempts: true, verification: true },
    });

    if (!intent) {
      throw new NotFoundException('PAYMENT_INTENT_NOT_FOUND');
    }

    return this.toView(intent);
  }

  /**
   * Get active PaymentIntent for a user
   */
  async getActivePaymentIntent(telegramUserId: bigint): Promise<PaymentIntentView | null> {
    const intent = await this.prisma.paymentIntent.findFirst({
      where: {
        telegramUserId,
        status: { in: [PaymentIntentStatus.CREATED, PaymentIntentStatus.AWAITING_PAYMENT, PaymentIntentStatus.DETECTED, PaymentIntentStatus.VERIFYING] },
        expiresAt: { gt: new Date() },
      },
      include: { attempts: true, verification: true },
    });

    return intent ? this.toView(intent) : null;
  }

  /**
   * Cancel a PaymentIntent
   */
  async cancelPaymentIntent(id: string, telegramUserId: bigint): Promise<PaymentIntentView> {
    const intent = await this.prisma.paymentIntent.findFirst({
      where: { id, telegramUserId },
    });

    if (!intent) {
      throw new NotFoundException('PAYMENT_INTENT_NOT_FOUND');
    }

    if (intent.status === PaymentIntentStatus.SETTLED || intent.status === PaymentIntentStatus.VERIFIED) {
      throw new BadRequestException('CANNOT_CANCEL_SETTLED_PAYMENT');
    }

    const updated = await this.transitionStatus(id, PaymentIntentStatus.CANCELLED, intent.status as PaymentIntentStatus);

    return this.toView(updated);
  }

  /**
   * Mark payment as detected (by webhook, polling, or admin action)
   */
  async markPaymentDetected(id: string, externalReference: string, metadata?: Record<string, any>): Promise<PaymentIntentView> {
    const intent = await this.prisma.paymentIntent.findUnique({ where: { id } });

    if (!intent) {
      throw new NotFoundException('PAYMENT_INTENT_NOT_FOUND');
    }

    if (intent.status !== PaymentIntentStatus.AWAITING_PAYMENT) {
      throw new BadRequestException(`INVALID_STATE_TRANSITION: Cannot mark payment as detected from ${intent.status}`);
    }

    // Create PaymentAttempt record
    await this.prisma.paymentAttempt.create({
      data: {
        paymentIntentId: id,
        externalReference,
        amount: intent.requestedAmount,
        currency: intent.currency,
        status: 'DETECTED',
        metadata: metadata || {},
      },
    });

    // Transition to DETECTED
    const updated = await this.transitionStatus(id, PaymentIntentStatus.DETECTED);

    this.logger.log(`[PaymentIntent] Payment ${intent.reference} detected with external reference ${externalReference}`);

    return this.toView(updated);
  }

  /**
   * Start verification process
   */
  async startVerification(id: string): Promise<PaymentIntentView> {
    const intent = await this.prisma.paymentIntent.findUnique({ where: { id } });

    if (!intent) {
      throw new NotFoundException('PAYMENT_INTENT_NOT_FOUND');
    }

    if (intent.status !== PaymentIntentStatus.DETECTED) {
      throw new BadRequestException(`INVALID_STATE_TRANSITION: Cannot start verification from ${intent.status}`);
    }

    const updated = await this.transitionStatus(id, PaymentIntentStatus.VERIFYING);

    this.logger.log(`[PaymentIntent] Verification started for ${intent.reference}`);

    return this.toView(updated);
  }

  /**
   * Admin verification - approves payment for settlement
   * This does NOT directly credit the wallet - it transitions to VERIFIED
   * FinancialOrchestrator will handle the actual settlement
   */
  async verifyPaymentIntent(
    id: string,
    adminId: string,
    adminEmail: string,
    verifiedAmount: number,
    verifiedCurrency: string,
    verifiedReference?: string,
    blockchainTxHash?: string,
    reviewNotes?: string,
  ): Promise<PaymentIntentView> {
    const intent = await this.prisma.paymentIntent.findUnique({ where: { id } });

    if (!intent) {
      throw new NotFoundException('PAYMENT_INTENT_NOT_FOUND');
    }

    // Only allow verification from DETECTED, VERIFYING, or MANUAL_REVIEW
    if (![
      PaymentIntentStatus.DETECTED,
      PaymentIntentStatus.VERIFYING,
      PaymentIntentStatus.MANUAL_REVIEW,
    ].includes(intent.status as any)) {
      throw new BadRequestException(`INVALID_STATE_TRANSITION: Cannot verify payment from ${intent.status}`);
    }

    // Validate admin role and permissions
    const hasPermission = await this.fourEyes.validateAdminAction(adminId, 'APPROVE');
    if (!hasPermission) {
      throw new ForbiddenException('INSUFFICIENT_ADMIN_PERMISSIONS: This role cannot approve payments');
    }

    // Check four-eyes control (prevent self-approval)
    const canApprove = await this.fourEyes.canApprovePayment(adminId, id);
    if (!canApprove) {
      throw new ForbiddenException('FOUR_EYES_VIOLATION: Cannot approve payment you initiated or already verified');
    }

    // Acquire verification lock to prevent race conditions
    const lockAcquired = await this.idempotency.acquireVerificationLock(id, adminId);
    if (!lockAcquired) {
      throw new ConflictException('VERIFICATION_LOCK_FAILED: Another admin is currently verifying this payment');
    }

    // Validate amount matches expected (within tolerance)
    const amountDiff = Math.abs(Number(intent.requestedAmount) - verifiedAmount);
    const tolerance = Number(intent.requestedAmount) * 0.01; // 1% tolerance
    if (amountDiff > tolerance) {
      await this.idempotency.releaseVerificationLock(id);
      throw new BadRequestException(`AMOUNT_MISMATCH: Expected ${intent.requestedAmount}, received ${verifiedAmount}`);
    }

    // Create or update PaymentVerification record
    await this.prisma.paymentVerification.upsert({
      where: { paymentIntentId: id },
      create: {
        paymentIntentId: id,
        verifiedByAdminId: adminId,
        verifiedByAdminEmail: adminEmail,
        status: 'VERIFIED',
        verifiedAmount: new Prisma.Decimal(verifiedAmount),
        verifiedCurrency,
        verifiedReference,
        blockchainTxHash,
        reviewNotes,
        verifiedAt: new Date(),
      },
      update: {
        verifiedByAdminId: adminId,
        verifiedByAdminEmail: adminEmail,
        status: 'VERIFIED',
        verifiedAmount: new Prisma.Decimal(verifiedAmount),
        verifiedCurrency,
        verifiedReference,
        blockchainTxHash,
        reviewNotes,
        verifiedAt: new Date(),
      },
    });

    // Transition to VERIFIED
    const updated = await this.transitionStatus(id, PaymentIntentStatus.VERIFIED);

    this.logger.log(`[PaymentIntent] Payment ${intent.reference} verified by admin ${adminEmail}`);

    // Release verification lock
    await this.idempotency.releaseVerificationLock(id);

    return this.toView(updated);
  }

  /**
   * Reject a payment
   */
  async rejectPaymentIntent(
    id: string,
    adminId: string,
    adminEmail: string,
    rejectionReason: string,
    reviewNotes?: string,
  ): Promise<PaymentIntentView> {
    const intent = await this.prisma.paymentIntent.findUnique({ where: { id } });

    if (!intent) {
      throw new NotFoundException('PAYMENT_INTENT_NOT_FOUND');
    }

    if (intent.status === PaymentIntentStatus.SETTLED || intent.status === PaymentIntentStatus.REJECTED) {
      throw new BadRequestException('CANNOT_REJECT_SETTLED_OR_REJECTED_PAYMENT');
    }

    // Create or update PaymentVerification record
    await this.prisma.paymentVerification.upsert({
      where: { paymentIntentId: id },
      create: {
        paymentIntentId: id,
        verifiedByAdminId: adminId,
        verifiedByAdminEmail: adminEmail,
        status: 'FAILED',
        verifiedAmount: new Prisma.Decimal(0),
        verifiedCurrency: intent.currency,
        rejectionReason,
        reviewNotes,
      },
      update: {
        verifiedByAdminId: adminId,
        verifiedByAdminEmail: adminEmail,
        status: 'FAILED',
        verifiedAmount: new Prisma.Decimal(0),
        verifiedCurrency: intent.currency,
        rejectionReason,
        reviewNotes,
      },
    });

    // Transition to REJECTED
    const updated = await this.transitionStatus(id, PaymentIntentStatus.REJECTED);

    this.logger.log(`[PaymentIntent] Payment ${intent.reference} rejected by admin ${adminEmail}: ${rejectionReason}`);

    return this.toView(updated);
  }

  /**
   * Escalate to manual review
   */
  async escalateToManualReview(id: string, reason: string): Promise<PaymentIntentView> {
    const intent = await this.prisma.paymentIntent.findUnique({ where: { id } });

    if (!intent) {
      throw new NotFoundException('PAYMENT_INTENT_NOT_FOUND');
    }

    const updated = await this.transitionStatus(id, PaymentIntentStatus.MANUAL_REVIEW);

    // Update verification record
    await this.prisma.paymentVerification.upsert({
      where: { paymentIntentId: id },
      create: {
        paymentIntentId: id,
        status: 'ESCALATED',
        verifiedAmount: new Prisma.Decimal(0),
        verifiedCurrency: intent.currency,
        reviewNotes: reason,
      },
      update: {
        status: 'ESCALATED',
        verifiedAmount: new Prisma.Decimal(0),
        verifiedCurrency: intent.currency,
        reviewNotes: reason,
      },
    });

    this.logger.log(`[PaymentIntent] Payment ${intent.reference} escalated to manual review: ${reason}`);

    return this.toView(updated);
  }

  /**
   * Transition to SETTLEMENT_PENDING and trigger FinancialOrchestrator
   * This is the ONLY path to credit user funds
   */
  async settlePaymentIntent(id: string): Promise<PaymentIntentView> {
    const intent = await this.prisma.paymentIntent.findUnique({ where: { id } });

    if (!intent) {
      throw new NotFoundException('PAYMENT_INTENT_NOT_FOUND');
    }

    if (intent.status !== PaymentIntentStatus.VERIFIED) {
      throw new BadRequestException(`INVALID_STATE_TRANSITION: Cannot settle from ${intent.status}. Must be VERIFIED first.`);
    }

    // Transition to SETTLEMENT_PENDING
    await this.transitionStatus(id, PaymentIntentStatus.SETTLEMENT_PENDING);

    // Execute through FinancialOrchestrator (authoritative financial path)
    const reference = `pay_settle_${intent.reference}`;
    await this.orchestrator.requestOperation({
      telegramUserId: intent.telegramUserId,
      operationType: FinancialOperationType.DEPOSIT_SETTLEMENT,
      assetCode: intent.asset,
      amount: intent.expectedCryptoAmount.toString(),
      idempotencyKey: reference,
      reference,
      metadata: {
        source: 'payment_intent_settlement',
        paymentIntentId: intent.id,
        paymentIntentReference: intent.reference,
        paymentMethod: intent.paymentMethod,
      },
    });

    // Transition to SETTLED after successful orchestration
    const settled = await this.transitionStatus(id, PaymentIntentStatus.SETTLED, PaymentIntentStatus.SETTLEMENT_PENDING);
    await this.prisma.paymentIntent.update({
      where: { id },
      data: {
        settledAt: new Date(),
        orchestratorReference: reference,
      },
    });

    // Notify user
    await this.notification.createNotification({
      userId: intent.telegramUserId,
      templateCode: 'PAYMENT_CONFIRMED',
      message: `Your payment of ${intent.requestedAmount} ${intent.currency} has been confirmed and credited to your wallet.`,
    });

    this.logger.log(`[PaymentIntent] Payment ${intent.reference} settled via FinancialOrchestrator`);

    return this.toView(settled);
  }

  /**
   * Get pending payment intents for admin approval queue
   */
  async getPendingPaymentIntents(limit = 50, offset = 0): Promise<PaymentIntentView[]> {
    const intents = await this.prisma.paymentIntent.findMany({
      where: {
        status: { in: [PaymentIntentStatus.DETECTED, PaymentIntentStatus.VERIFYING, PaymentIntentStatus.MANUAL_REVIEW] },
        expiresAt: { gt: new Date() },
      },
      include: { attempts: true, verification: true },
      orderBy: { createdAt: 'asc' },
      take: limit,
      skip: offset,
    });

    return intents.map(intent => this.toView(intent));
  }

  /**
   * Expire old payment intents (called by cron)
   */
  async expirePaymentIntents(): Promise<{ expired: number }> {
    const now = new Date();
    const intents = await this.prisma.paymentIntent.findMany({
      where: {
        status: { in: [PaymentIntentStatus.CREATED, PaymentIntentStatus.AWAITING_PAYMENT, PaymentIntentStatus.DETECTED, PaymentIntentStatus.VERIFYING] },
        expiresAt: { lt: now },
      },
    });

    for (const intent of intents) {
      await this.transitionStatus(intent.id, PaymentIntentStatus.EXPIRED, intent.status as PaymentIntentStatus);
    }

    this.logger.log(`[PaymentIntent] Expired ${intents.length} payment intents`);

    return { expired: intents.length };
  }

  /**
   * State machine transition enforcement
   */
  private async transitionStatus(id: string, newStatus: PaymentIntentStatus, currentStatus?: PaymentIntentStatus): Promise<any> {
    const intent = currentStatus 
      ? { id, status: currentStatus } as any
      : await this.prisma.paymentIntent.findUnique({ where: { id } });

    if (!intent) {
      throw new NotFoundException('PAYMENT_INTENT_NOT_FOUND');
    }

    const actualStatus = currentStatus || intent.status as PaymentIntentStatus;
    const allowedTransitions = this.VALID_TRANSITIONS[actualStatus] || [];

    if (!allowedTransitions.includes(newStatus)) {
      throw new BadRequestException(`INVALID_STATE_TRANSITION: Cannot transition from ${actualStatus} to ${newStatus}`);
    }

    return this.prisma.paymentIntent.update({
      where: { id },
      data: { status: newStatus },
    });
  }

  /**
   * Resolve merchant destination based on country/network
   * In production, this would query a configured merchant table
   */
  private async resolveMerchantDestination(country: string, network?: string): Promise<string> {
    // Placeholder - in production, query MobileMoneyMerchant table
    // For now, return a default that indicates configuration needed
    return `MERCHANT_${country}_${network || 'DEFAULT'}`;
  }

  /**
   * Convert PaymentIntent to view DTO
   */
  private toView(intent: any): PaymentIntentView {
    const instructions: Record<string, any> = {};

    if (intent.paymentMethod === PaymentMethod.USDT_TRC20 && intent.usdtAddress) {
      instructions.address = intent.usdtAddress;
      instructions.network = 'TRON';
      instructions.token = 'USDT';
      instructions.minConfirmations = 19;
    } else if (intent.paymentMethod === PaymentMethod.MOBILE_MONEY && intent.merchantDestination) {
      instructions.merchantCode = intent.merchantDestination;
      instructions.network = intent.network;
      instructions.currency = intent.currency;
      instructions.amount = intent.requestedAmount.toString();
    }

    return {
      id: intent.id,
      reference: intent.reference,
      status: intent.status,
      paymentMethod: intent.paymentMethod,
      asset: intent.asset,
      requestedAmount: intent.requestedAmount?.toString() || '0',
      expectedCryptoAmount: intent.expectedCryptoAmount?.toString() || '0',
      currency: intent.currency,
      country: intent.country,
      network: intent.network,
      exchangeRate: intent.exchangeRate?.toString() || '0',
      merchantDestination: intent.merchantDestination,
      usdtAddress: intent.usdtAddress,
      expiresAt: intent.expiresAt.toISOString(),
      createdAt: intent.createdAt.toISOString(),
      instructions: Object.keys(instructions).length > 0 ? instructions : undefined,
    };
  }
}
