import { BadRequestException, Injectable, Logger, NotFoundException, Optional, Inject, forwardRef } from '@nestjs/common';
import { FinancialOperationType, Prisma, SettlementProviderId, SettlementStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { FinancialOrchestratorService } from '../financial-orchestration/financial-orchestrator.service';
import { OperationalAuditService } from '../admin/services/operational-audit.service';
import { WithdrawalRiskService } from './withdrawal-risk.service';
import { EventBusService } from '../automation/event-bus.service';
import { TreasuryService } from '../treasury/treasury.service';
import { PlatformOperationsEngineService } from '../admin/services/platform-operations-engine.service';
import { DurableOutboxService } from '../automation/durable-outbox.service';
import { supportsLocalPaymentRails } from '../settlement/payment-region.policy';

export interface InitiateWithdrawalDto {
  telegramUserId: bigint;
  userId?: string;
  amount: number;
  asset?: string;
  network: string; // MOMO, TRC20, POLYGON, ARBITRUM
  destinationAddress: string;
  country?: string;
  mobileMoneyNetwork?: string;
}

export interface PayoutProofDto {
  proofReference?: string;
  txHash?: string;
  actualAmountSent?: number;
  network?: string;
  destinationAddress?: string;
  notes?: string;
}

@Injectable()
export class WithdrawalService {
  private readonly logger = new Logger(WithdrawalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orchestrator: FinancialOrchestratorService,
    private readonly riskService: WithdrawalRiskService,
    private readonly auditService: OperationalAuditService,
    private readonly eventBus: EventBusService,
    @Optional() private readonly treasuryService?: TreasuryService,
    @Optional() @Inject(forwardRef(() => PlatformOperationsEngineService)) private readonly opsEngine?: PlatformOperationsEngineService,
    @Optional() private readonly durableOutbox?: DurableOutboxService,
  ) {}

  async initiateWithdrawal(dto: InitiateWithdrawalDto, idempotencyKey?: string) {
    const asset = dto.asset || 'USDT';
    const netUpper = (dto.network || '').toUpperCase();

    // 0. Provider Capability Check: Block unsupported CARD rail only
    if (netUpper === 'CARD') {
      throw new BadRequestException(
        'UNSUPPORTED_WITHDRAWAL_RAIL: Card payouts are not supported. Please withdraw using Mobile Money or USDT TRC-20.',
      );
    }

    // 0. Operational Switch Enforcement
    if (this.opsEngine) {
      await this.opsEngine.assertOperationalModeAllowed('WITHDRAWAL', asset);
    }

    const isMobileMoney = ['MOMO', 'MOBILE_MONEY', 'MTN', 'AIRTEL'].includes(netUpper);
    if (isMobileMoney && !supportsLocalPaymentRails(dto.country)) {
      throw new BadRequestException('LOCAL_PAYOUT_NOT_AVAILABLE: Outside East Africa, withdrawals are available via USDT (TRC-20) only');
    }

    // 1. Recipient Binding Lock (Phase 3 & 4 Server-Side Recipient Lock)
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          ...(dto.telegramUserId && dto.telegramUserId > BigInt(0) ? [{ telegramUserId: dto.telegramUserId }] : []),
          ...(dto.userId ? [{ id: dto.userId }] : []),
        ],
      },
    });
    if (!user) throw new NotFoundException('USER_NOT_FOUND: User must exist to perform a withdrawal');
    dto.telegramUserId = user.telegramUserId;

    // Check Recipient Security Cooling Period
    if (user.recipientCoolingUntil && new Date(user.recipientCoolingUntil) > new Date()) {
      throw new BadRequestException(
        `RECIPIENT_COOLING_PERIOD_ACTIVE: Your withdrawal destination was recently updated. Withdrawals are paused until ${new Date(user.recipientCoolingUntil).toISOString()}.`,
      );
    }

    // Check Referral Qualification Guardrail (5 Qualified Referrals)
    const qualifiedCount = user.qualifiedReferrals || 0;
    if (qualifiedCount < 5) {
      throw new BadRequestException(
        `REFERRAL_THRESHOLD_NOT_MET: Withdrawal locked. You must have at least 5 qualified referrals to enable payouts (${qualifiedCount}/5).`,
      );
    }

    let verifiedRecipient = '';
    let mmNetwork = dto.mobileMoneyNetwork || dto.network;

    if (isMobileMoney) {
      mmNetwork = dto.mobileMoneyNetwork || (netUpper === 'AIRTEL' ? 'AIRTEL' : 'MTN');
      // A withdrawal request must never be able to enroll and verify its own
      // recipient. Enrollment is a separate, step-up protected settings flow.
      if (!user.withdrawalPhoneNumber && !user.phoneNumber) {
        throw new BadRequestException('MOBILE_MONEY_NUMBER_REQUIRED: Configure and verify a withdrawal number before requesting a payout.');
      }
      verifiedRecipient = this.resolveMobileMoneyWithdrawalNumber(user);
    } else {
      // USDT TRC-20 Recipient Lock
      if (netUpper !== 'TRC20' && netUpper !== 'TRON' && netUpper !== 'USDT') {
        throw new BadRequestException(`UNSUPPORTED_CRYPTO_NETWORK: USDT withdrawals require TRON (TRC-20) network. Provided: ${dto.network}`);
      }
      if (user.verifiedUsdtAddress) {
        // Authoritative lock: ignore client recipient, resolve server-side address
        verifiedRecipient = user.verifiedUsdtAddress;
      } else {
        throw new BadRequestException('UNVERIFIED_USDT_ADDRESS: Please register your verified USDT TRC-20 address before requesting a withdrawal.');
      }
    }

    const exchangeRate = isMobileMoney ? 3774.62 : 1.0;
    const requestedFiatAmount = isMobileMoney ? Math.round(dto.amount * exchangeRate) : dto.amount;
    const providerId = isMobileMoney ? SettlementProviderId.MERCHANT_MOBILE_MONEY : SettlementProviderId.USDT;

    const amountStr = dto.amount.toString();
    const idKey = idempotencyKey || `wd_${dto.telegramUserId}_${Date.now()}`;

    // 2. Risk & Limit Checks
    const riskEval = await this.riskService.evaluateWithdrawal(dto.telegramUserId, dto.amount);

    if (this.treasuryService) {
      const treasuryCheck = await this.treasuryService.checkWithdrawalSafety(dto.amount);
      if (!treasuryCheck.safe) {
        riskEval.requiresManualReview = true;
        riskEval.riskReason = (riskEval.riskReason ? `${riskEval.riskReason}; ` : '') + treasuryCheck.reason;
      }
    }

    // Determine Four-Eyes Dual Control Threshold ($40 / 150,000 UGX)
    const requiresFourEyes = dto.amount >= 40 || requestedFiatAmount >= 150000;

    // 3. Reserve the balance and persist the payout record atomically. A retry
    // returns the exact payout record instead of creating a second payout.
    const orchestratorRef = `wd_reserve_${idKey}`;
    const session = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.settlementSession.findUnique({ where: { orchestratorReference: orchestratorRef } });
      if (existing) return existing;

      const financialOp = await this.orchestrator.requestOperation({
        telegramUserId: dto.telegramUserId,
        operationType: FinancialOperationType.WITHDRAWAL_RESERVE,
        assetCode: asset,
        amount: amountStr,
        idempotencyKey: idKey,
        reference: orchestratorRef,
        metadata: { network: dto.network, destinationAddress: verifiedRecipient, requiresManualReview: riskEval.requiresManualReview },
      }, tx);

      return tx.settlementSession.create({
        data: {
          telegramUserId: dto.telegramUserId,
          referenceCode: `WD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          provider: providerId,
          sessionType: 'PAYOUT',
          asset,
          requestedAmount: new Prisma.Decimal(requestedFiatAmount),
          expectedCryptoAmount: new Prisma.Decimal(dto.amount),
          exchangeRate: new Prisma.Decimal(exchangeRate),
          country: dto.country || 'UG',
          mobileMoneyNetwork: mmNetwork,
          status: SettlementStatus.AWAITING_ADMIN_EXECUTION,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          orchestratorReference: orchestratorRef,
          verifiedRecipientAddress: verifiedRecipient,
          recipientVerifiedAt: new Date(),
          requiresFourEyes,
          feeAmount: new Prisma.Decimal(0),
          netPayoutAmount: new Prisma.Decimal(requestedFiatAmount),
          providerMetadata: {
            network: dto.network,
            destinationAddress: verifiedRecipient,
            userTier: riskEval.userTier,
            requiresManualReview: riskEval.requiresManualReview,
            requiresFourEyes,
            riskReason: riskEval.riskReason || null,
            financialOperationId: (financialOp as any)?.id,
            paymentCurrency: isMobileMoney ? 'UGX' : 'USDT',
          },
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000, maxWait: 10000 });

    // 5. Emit Event-Driven Notifications (Phase 12)
    this.eventBus.publish({
      type: 'WithdrawalRequested',
      correlationId: `corr_wd_${session.id}`,
      actorId: dto.telegramUserId.toString(),
      payload: {
        withdrawalId: session.id,
        telegramUserId: dto.telegramUserId.toString(),
        amount: dto.amount,
        network: dto.network,
        verifiedRecipient,
        status: SettlementStatus.AWAITING_ADMIN_EXECUTION,
      },
    });

    this.eventBus.publish({
      type: 'WithdrawalReserved',
      correlationId: `corr_wd_res_${session.id}`,
      actorId: dto.telegramUserId.toString(),
      payload: {
        withdrawalId: session.id,
        telegramUserId: dto.telegramUserId.toString(),
        amount: dto.amount,
        orchestratorReference: orchestratorRef,
      },
    });

    this.eventBus.publish({
      type: 'WithdrawalAwaitingAdminExecution',
      correlationId: `corr_wd_await_${session.id}`,
      actorId: dto.telegramUserId.toString(),
      payload: {
        withdrawalId: session.id,
        telegramUserId: dto.telegramUserId.toString(),
        amount: dto.amount,
        network: dto.network,
        verifiedRecipient,
      },
    });

    const finalSession = await this.prisma.settlementSession.findUnique({
      where: { id: session.id },
    });
    return this.formatSession(finalSession);
  }

  private formatSession(session: any) {
    if (!session) return session;
    return {
      ...session,
      telegramUserId: session.telegramUserId ? session.telegramUserId.toString() : null,
      requestedAmount: session.requestedAmount ? session.requestedAmount.toString() : '0',
      expectedCryptoAmount: session.expectedCryptoAmount ? session.expectedCryptoAmount.toString() : '0',
      exchangeRate: session.exchangeRate ? session.exchangeRate.toString() : '1',
      feeAmount: session.feeAmount ? session.feeAmount.toString() : '0',
      netPayoutAmount: session.netPayoutAmount ? session.netPayoutAmount.toString() : '0',
    };
  }

  // ─── Phase 6: Admin Concurrency Claiming ─────────────────────
  async claimWithdrawalForExecution(adminId: string, withdrawalId: string) {
    const session = await this.prisma.settlementSession.findUnique({ where: { id: withdrawalId } });
    if (!session) throw new NotFoundException('WITHDRAWAL_NOT_FOUND');

    if (session.claimedByAdminId && session.claimedByAdminId !== adminId && session.status === SettlementStatus.ADMIN_EXECUTION_IN_PROGRESS) {
      throw new BadRequestException('WITHDRAWAL_ALREADY_BEING_PROCESSED: This withdrawal is currently being executed by another administrator.');
    }

    if (session.status === SettlementStatus.COMPLETED || session.status === SettlementStatus.REJECTED) {
      throw new BadRequestException('CANNOT_CLAIM_FINALIZED_WITHDRAWAL');
    }

    const updated = await this.prisma.settlementSession.update({
      where: { id: withdrawalId },
      data: {
        claimedByAdminId: adminId,
        claimedAt: new Date(),
        status: SettlementStatus.ADMIN_EXECUTION_IN_PROGRESS,
      },
    });

    this.eventBus.publish({
      type: 'WithdrawalClaimed',
      correlationId: `corr_wd_claim_${withdrawalId}`,
      actorId: adminId,
      payload: { withdrawalId, claimedByAdminId: adminId, status: SettlementStatus.ADMIN_EXECUTION_IN_PROGRESS },
    });

    return this.formatSession(updated);
  }

  // ─── Phase 7: Authoritative Payout Instructions ──────────────
  async getAuthoritativePayoutInstructions(withdrawalId: string) {
    const session = await this.prisma.settlementSession.findUnique({
      where: { id: withdrawalId },
      include: { user: { select: { telegramUserId: true, telegramUsername: true, firstName: true, phoneNumber: true, verifiedUsdtAddress: true } } },
    });
    if (!session) throw new NotFoundException('WITHDRAWAL_NOT_FOUND');

    const isMomo = session.provider === SettlementProviderId.MERCHANT_MOBILE_MONEY;
    const recipient = session.verifiedRecipientAddress || (isMomo ? session.user.phoneNumber : session.user.verifiedUsdtAddress) || 'N/A';

    return {
      withdrawalId: session.id,
      referenceCode: session.referenceCode,
      sessionType: session.sessionType,
      method: isMomo ? 'MOBILE_MONEY' : 'USDT',
      network: session.mobileMoneyNetwork,
      verifiedRecipient: recipient,
      usdtAmount: session.expectedCryptoAmount.toString(),
      exchangeRate: session.exchangeRate.toString(),
      grossLocalAmount: session.requestedAmount.toString(),
      currency: isMomo ? 'UGX' : 'USDT',
      fee: session.feeAmount.toString(),
      netPayoutAmount: session.netPayoutAmount.toString(),
      status: session.status,
      claimedByAdminId: session.claimedByAdminId,
      claimedAt: session.claimedAt ? session.claimedAt.toISOString() : null,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  async markPayoutExecuted(adminId: string, withdrawalId: string) {
    const session = await this.prisma.settlementSession.findUnique({ where: { id: withdrawalId } });
    if (!session) throw new NotFoundException('WITHDRAWAL_NOT_FOUND');

    if (session.claimedByAdminId && session.claimedByAdminId !== adminId && session.status === SettlementStatus.ADMIN_EXECUTION_IN_PROGRESS) {
      throw new BadRequestException('WITHDRAWAL_ALREADY_BEING_PROCESSED: Locked by another administrator.');
    }

    const updated = await this.prisma.settlementSession.update({
      where: { id: withdrawalId },
      data: {
        claimedByAdminId: session.claimedByAdminId || adminId,
        status: SettlementStatus.PAYOUT_EXECUTED,
      },
    });

    this.eventBus.publish({
      type: 'WithdrawalPayoutExecuted',
      correlationId: `corr_wd_exec_${withdrawalId}`,
      actorId: adminId,
      payload: { withdrawalId, adminId, status: SettlementStatus.PAYOUT_EXECUTED },
    });

    return this.formatSession(updated);
  }

  // ─── Phase 8 & 9: Payout Proof Submission & Four-Eyes Verification ────
  async submitPayoutProof(adminId: string, withdrawalId: string, proof: PayoutProofDto) {
    const session = await this.prisma.settlementSession.findUnique({ where: { id: withdrawalId } });
    if (!session) throw new NotFoundException('WITHDRAWAL_NOT_FOUND');

    if (session.status === SettlementStatus.COMPLETED) {
      throw new BadRequestException('WITHDRAWAL_ALREADY_COMPLETED');
    }

    const proofRef = (proof.proofReference || proof.txHash || '').trim();
    if (!proofRef || proofRef.length < 3) {
      throw new BadRequestException('INVALID_PAYOUT_PROOF_REFERENCE');
    }

    // Duplicate Payout Proof Reference Check across all completed or active withdrawals
    const duplicate = await this.prisma.settlementSession.findFirst({
      where: {
        id: { not: withdrawalId },
        payoutTxHash: proofRef,
        status: { in: [SettlementStatus.PROOF_SUBMITTED, SettlementStatus.PROOF_VERIFICATION_REQUIRED, SettlementStatus.COMPLETED] },
      },
    });
    if (duplicate) {
      throw new BadRequestException(`DUPLICATE_PAYOUT_REFERENCE: Payout proof reference "${proofRef}" has already been used for withdrawal ${duplicate.id}.`);
    }

    const nextStatus = session.requiresFourEyes ? SettlementStatus.PROOF_VERIFICATION_REQUIRED : SettlementStatus.PROOF_SUBMITTED;

    const updated = await this.prisma.settlementSession.update({
      where: { id: withdrawalId },
      data: {
        claimedByAdminId: session.claimedByAdminId || adminId,
        payoutTxHash: proofRef,
        payoutProof: proof as any,
        status: nextStatus,
      },
    });

    this.eventBus.publish({
      type: 'WithdrawalProofSubmitted',
      correlationId: `corr_wd_proof_${withdrawalId}`,
      actorId: adminId,
      payload: { withdrawalId, proofRef, adminId, status: nextStatus },
    });

    if (session.requiresFourEyes) {
      return this.formatSession(updated);
    }

    // Auto-trigger verification & settlement for standard (non-four-eyes) withdrawals
    return this.verifyAndSettleWithdrawal(adminId, withdrawalId);
  }

  async verifyAndSettleWithdrawal(adminId: string, withdrawalId: string) {
    const session = await this.prisma.settlementSession.findUnique({ where: { id: withdrawalId } });
    if (!session) throw new NotFoundException('WITHDRAWAL_NOT_FOUND');

    if (session.status === SettlementStatus.COMPLETED) {
      return this.formatSession(session);
    }

    // Four-Eyes Dual Control Validation: Approving admin cannot be the executing admin
    if (session.requiresFourEyes && session.claimedByAdminId && session.claimedByAdminId === adminId) {
      throw new BadRequestException(
        'CANNOT_SELF_APPROVE_FOUR_EYES: High-value withdrawals require Four-Eyes dual control. A second administrator must verify and settle this payout.',
      );
    }

    const externalRef = session.payoutTxHash || `payout_tx_${session.id.substring(0, 8)}`;

    // Double-Entry Ledger Settlement (WITHDRAWAL_SETTLE)
    const settleRef = `wd_settle_${withdrawalId}`;
    await this.orchestrator.requestOperation({
      telegramUserId: session.telegramUserId,
      operationType: FinancialOperationType.WITHDRAWAL_SETTLE,
      assetCode: session.asset,
      amount: session.expectedCryptoAmount.toString(),
      idempotencyKey: settleRef,
      reference: settleRef,
      metadata: { originalSettlementId: withdrawalId, externalReference: externalRef, adminId },
    });

    const completed = await this.prisma.settlementSession.update({
      where: { id: withdrawalId },
      data: {
        status: SettlementStatus.COMPLETED,
        completedAt: new Date(),
        usdtSentAt: new Date(),
        verifiedByAdminId: adminId,
        verifiedAt: new Date(),
        providerMetadata: {
          ...(typeof session.providerMetadata === 'object' ? session.providerMetadata : {}),
          externalReference: externalRef,
          settledAt: new Date().toISOString(),
          verifiedByAdminId: adminId,
        },
      },
    });

    await this.auditService.logAction({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'WITHDRAWAL_SETTLED',
      entity: 'SETTLEMENT',
      entityId: withdrawalId,
      metadata: { referenceCode: session.referenceCode, externalRef, fourEyesVerifiedBy: adminId },
    });

    this.eventBus.publish({
      type: 'WithdrawalCompleted',
      correlationId: `corr_wd_comp_${withdrawalId}`,
      actorId: session.telegramUserId.toString(),
      payload: {
        withdrawalId,
        telegramUserId: session.telegramUserId.toString(),
        amount: session.expectedCryptoAmount.toString(),
        externalReference: externalRef,
      },
    });

    return this.formatSession(completed);
  }

  // ─── Phase 10: Rejection & Reversal ─────────────────────────
  async rejectWithdrawal(admin: { id: string; role: string }, withdrawalId: string, reason?: string) {
    const session = await this.prisma.settlementSession.findUnique({ where: { id: withdrawalId } });
    if (!session) throw new NotFoundException('WITHDRAWAL_NOT_FOUND');
    if (session.status === SettlementStatus.COMPLETED || session.status === SettlementStatus.REJECTED || session.status === SettlementStatus.REVERSED) {
      throw new BadRequestException('CANNOT_REJECT_FINALIZED_WITHDRAWAL');
    }

    // Double-Entry Ledger Reversal — Restore User Balance
    const reversalRef = `wd_reversal_${withdrawalId}`;
    await this.orchestrator.requestOperation({
      telegramUserId: session.telegramUserId,
      operationType: FinancialOperationType.WITHDRAWAL_REVERSAL,
      assetCode: session.asset,
      amount: (session.expectedCryptoAmount ?? (session as any).expectedFiatAmount ?? session.requestedAmount ?? '0').toString(),
      idempotencyKey: reversalRef,
      reference: reversalRef,
      metadata: { originalSettlementId: withdrawalId, reason },
    });

    const updated = await this.prisma.settlementSession.update({
      where: { id: withdrawalId },
      data: {
        status: SettlementStatus.REJECTED,
        providerMetadata: {
          ...(typeof session.providerMetadata === 'object' ? session.providerMetadata : {}),
          rejectionReason: reason || 'REJECTED_BY_ADMIN',
          rejectedAt: new Date().toISOString(),
        },
      },
    });

    await this.auditService.logAction({
      actorId: admin.id,
      actorRole: admin.role,
      action: 'WITHDRAWAL_REJECTED',
      entity: 'SETTLEMENT',
      entityId: withdrawalId,
      metadata: { referenceCode: session.referenceCode, reason },
    });

    this.eventBus.publish({
      type: 'WithdrawalRejected',
      correlationId: `corr_wd_rej_${withdrawalId}`,
      actorId: session.telegramUserId.toString(),
      payload: { withdrawalId, telegramUserId: session.telegramUserId.toString(), amount: (session.expectedCryptoAmount ?? (session as any).expectedFiatAmount ?? session.requestedAmount ?? '0').toString(), reason },
    });

    this.eventBus.publish({
      type: 'WithdrawalReversed',
      correlationId: `corr_wd_rev_${withdrawalId}`,
      actorId: session.telegramUserId.toString(),
      payload: { withdrawalId, telegramUserId: session.telegramUserId.toString(), amount: (session.expectedCryptoAmount ?? (session as any).expectedFiatAmount ?? session.requestedAmount ?? '0').toString(), reason },
    });

    return this.formatSession(updated);
  }

  // ─── Phase 11: Automated Expiration Sweeper ─────────────────
  async expireStaleWithdrawals() {
    const expiredCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h timeout
    const staleSessions = await this.prisma.settlementSession.findMany({
      where: {
        sessionType: 'PAYOUT',
        status: { in: [SettlementStatus.AWAITING_ADMIN_EXECUTION, SettlementStatus.WAITING_PAYMENT, SettlementStatus.WAITING_FOR_PAYMENT] },
        createdAt: { lt: expiredCutoff },
      },
    });

    for (const session of staleSessions) {
      try {
        const reversalRef = `wd_expire_reversal_${session.id}`;
        await this.orchestrator.requestOperation({
          telegramUserId: session.telegramUserId,
          operationType: FinancialOperationType.WITHDRAWAL_REVERSAL,
          assetCode: session.asset,
          amount: session.expectedCryptoAmount.toString(),
          idempotencyKey: reversalRef,
          reference: reversalRef,
          metadata: { originalSettlementId: session.id, reason: 'EXPIRED_TIMEOUT' },
        });

        await this.prisma.settlementSession.update({
          where: { id: session.id },
          data: { status: SettlementStatus.EXPIRED },
        });

        this.eventBus.publish({
          type: 'WithdrawalExpired',
          correlationId: `corr_wd_exp_${session.id}`,
          actorId: session.telegramUserId.toString(),
          payload: { withdrawalId: session.id, telegramUserId: session.telegramUserId.toString() },
        });
      } catch (err: any) {
        this.logger.error(`[WITHDRAWAL_EXPIRATION_ERR] Failed expiring session ${session.id}: ${err.message}`);
      }
    }
  }

  public normalizeUgandaPhone(raw: string): string {
    const cleaned = (raw || '').replace(/\D/g, '');
    if (!cleaned) return raw;
    if (cleaned.startsWith('256') && cleaned.length === 12) {
      return '0' + cleaned.substring(3);
    }
    if (cleaned.length === 9 && cleaned.startsWith('7')) {
      return '0' + cleaned;
    }
    if (cleaned.length === 10 && cleaned.startsWith('07')) {
      return cleaned;
    }
    return cleaned;
  }

  public resolveMobileMoneyWithdrawalNumber(user: any): string {
    // Priority 1: User's explicitly configured Mobile Money Withdrawal Number
    if (user.withdrawalPhoneNumber && user.withdrawalPhoneNumber.trim().length >= 8) {
      return this.normalizeUgandaPhone(user.withdrawalPhoneNumber.trim());
    }

    // Priority 2: User's registered WhatsApp number
    if (user.phoneNumber && user.phoneNumber.trim().length >= 8) {
      return this.normalizeUgandaPhone(user.phoneNumber.trim());
    }

    if (user.channelIdentities && user.channelIdentities.length > 0) {
      const waChan = user.channelIdentities.find(
        (c: any) => c.channel === 'WHATSAPP' || c.channelType === 'WHATSAPP' || (c.address && (c.address.startsWith('256') || c.address.startsWith('07'))),
      );
      if (waChan && waChan.address && waChan.address.length >= 8) {
        return this.normalizeUgandaPhone(waChan.address);
      }
    }

    // Priority 3: Fail closed
    throw new BadRequestException(
      'MOBILE_MONEY_NUMBER_REQUIRED: Please configure a Mobile Money Withdrawal Number in Settings → Withdrawals or connect your WhatsApp account.',
    );
  }

  async getUserWithdrawalHistory(userKey: bigint | string, limit = 50, offset = 0) {
    const isUuid = typeof userKey === 'string' && userKey.includes('-');
    let whereClause: any;

    if (isUuid) {
      whereClause = { userId: userKey as string };
    } else {
      const telegramUserId = typeof userKey === 'bigint' ? userKey : BigInt(userKey);
      whereClause = { telegramUserId };
    }

    const [items, total] = await Promise.all([
      this.prisma.settlementSession.findMany({
        where: { ...whereClause, sessionType: 'PAYOUT' },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.settlementSession.count({
        where: { ...whereClause, sessionType: 'PAYOUT' },
      }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        telegramUserId: item.telegramUserId.toString(),
        requestedAmount: item.requestedAmount.toString(),
        expectedCryptoAmount: item.expectedCryptoAmount.toString(),
      })),
      pagination: { total, limit, offset },
    };
  }
}
