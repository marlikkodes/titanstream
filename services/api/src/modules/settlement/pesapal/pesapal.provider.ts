import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  FinancialOperationType,
  Prisma,
  SettlementEventType,
  SettlementProviderId,
  SettlementStatus,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { FinancialOrchestratorService } from '../../financial-orchestration/financial-orchestrator.service';
import { ExchangeRateService } from '../../financial/exchange-rate.service';
import { CreateSettlementSessionDto } from '../dto/create-settlement-session.dto';
import { ProviderEventService } from '../provider-event.service';
import { SettlementCapabilityManifest, SettlementProvider } from '../settlement-provider.interface';
import { SettlementRiskService, RiskEvaluationResult } from '../settlement-risk.service';
import { PesapalClient } from './pesapal.client';
import {
  PesapalNormalizedStatus,
  PesapalOrderRequestPayload,
  PesapalTransactionStatusResponse,
  normalizePesapalStatus,
  isProviderSuccess,
  isProviderPending,
  isProviderFailure,
  isProviderUnknown,
} from './pesapal.types';

@Injectable()
export class PesapalProvider implements SettlementProvider {
  private readonly logger = new Logger(PesapalProvider.name);

  readonly providerId = SettlementProviderId.PESAPAL;
  readonly manifest: SettlementCapabilityManifest = {
    provider: SettlementProviderId.PESAPAL,
    supports_buy: true,
    supports_sell: false,
    supports_refunds: false,
    supports_webhooks: true,
    supports_manual_review: true,
    supports_partial_payments: false,
    supported_assets: ['USDT', 'KES', 'UGX', 'USD'],
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: ProviderEventService,
    private readonly orchestrator: FinancialOrchestratorService,
    private readonly pesapalClient: PesapalClient,
    private readonly riskService: SettlementRiskService,
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

  getCapabilities(): SettlementCapabilityManifest {
    return this.manifest;
  }

  /**
   * Status Normalizer: Delegates directly to the single canonical normalizePesapalStatus function.
   */
  normalizeStatus(response: PesapalTransactionStatusResponse): PesapalNormalizedStatus {
    return normalizePesapalStatus(response);
  }

  async initializeSettlement(settlementId: string) {
    const session = await this.load(settlementId);
    await this.emitSettlementEvent(settlementId, SettlementEventType.SettlementInitialized, { provider: this.providerId });
    return this.toProviderIndependentView(session);
  }

  async getSettlementStatus(settlementId: string) {
    const session = await this.load(settlementId);
    const metadata = (session.providerMetadata || {}) as Record<string, any>;

    if (
      metadata.orderTrackingId &&
      (session.status === SettlementStatus.WAITING_FOR_PAYMENT || session.status === SettlementStatus.VERIFYING)
    ) {
      try {
        const liveStatus = await this.pesapalClient.getTransactionStatus(metadata.orderTrackingId);
        const normalized = this.normalizeStatus(liveStatus);

        if (normalized === 'COMPLETED') {
          this.verifyPaymentIntegrity(session, liveStatus);
          return this.processVerifiedSuccess(session, liveStatus);
        } else if (normalized === 'FAILED') {
          await this.prisma.settlementSession.update({
            where: { id: settlementId },
            data: { status: SettlementStatus.FAILED },
          });
        } else if (normalized === 'UNKNOWN') {
          this.logger.warn(`[PesapalProvider] Unknown provider status received for ${settlementId}: ${liveStatus.payment_status_description}`);
          await this.prisma.settlementSession.update({
            where: { id: settlementId },
            data: { status: SettlementStatus.VERIFYING },
          });
        }
      } catch (err: any) {
        const isIntegrityFailure = err?.message?.includes('MISSING_PROVIDER_') || err?.message?.includes('PAYMENT_');
        if (isIntegrityFailure) {
          this.logger.warn(`[PesapalProvider] Payment integrity check failed for ${settlementId}: ${err?.message}. Holding in VERIFYING for reconciliation.`);
          await this.prisma.settlementSession.update({
            where: { id: settlementId },
            data: { status: SettlementStatus.VERIFYING },
          });
        } else {
          this.logger.warn(`[PesapalProvider] Polling status check failed for ${settlementId}: ${err?.message}`);
        }
      }
    }

    const reloaded = await this.load(settlementId);
    return this.toProviderIndependentView(reloaded);
  }

  async verifySettlement(settlementId: string) {
    const session = await this.validateSettlement(settlementId);
    await this.emitSettlementEvent(settlementId, SettlementEventType.SettlementVerificationStarted, { provider: this.providerId });
    return this.toProviderIndependentView(session);
  }

  /**
   * Create a Pesapal settlement session for a user.
   * Admin approval requirement is determined by the centralized SettlementRiskService,
   * not by a hardcoded threshold inside this provider.
   */
  async createSettlement(telegramUserId: bigint, dto: CreateSettlementSessionDto) {
    if (dto.paymentMethod?.toUpperCase() === 'USDT') {
      throw new BadRequestException('INVALID_SETTLEMENT_ROUTING: USDT payments must use the TRC-20 blockchain rail and cannot be processed via Pesapal.');
    }

    const expectedCryptoUsd = Number(dto.expectedCryptoAmount);

    // Consult the centralized risk engine for both hard limits AND manual review requirements
    const riskResult: RiskEvaluationResult = await this.riskService.evaluateUserRisk(telegramUserId, expectedCryptoUsd);
    if (!riskResult.allowed) {
      throw new BadRequestException(`SETTLEMENT_RISK_REJECTED: ${riskResult.reason}`);
    }

    const requiresAdminApproval = riskResult.requiresManualReview === true;
    const referenceCode = `PSP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const initialStatus = requiresAdminApproval
      ? SettlementStatus.CREATED
      : SettlementStatus.WAITING_FOR_PAYMENT;

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // ── AUTHORITATIVE EXCHANGE RATE ──────────────────────────────────────────
    // Backend owns the rate. Frontend-provided exchangeRate is IGNORED.
    // ExchangeRateService provides live CoinGecko rates with spread, cached 60s.
    const country = dto.country || 'UG';
    const paymentCurrency = country === 'KE' ? 'KES' : country === 'UG' ? 'UGX' : 'USD';
    const currencySymbol = country === 'KE' ? 'KSh' : country === 'UG' ? 'UGX' : '$';
    const lockedRate = await this.exchangeRateService.lockRateForSettlement(paymentCurrency);
    const authoritativeRate = lockedRate.userRate;
    const paymentAmount = paymentCurrency === 'USD'
      ? new Prisma.Decimal(dto.requestedAmount).toNumber()
      : new Prisma.Decimal(dto.requestedAmount).mul(new Prisma.Decimal(authoritativeRate.toString())).toDecimalPlaces(0).toNumber();

    this.logger.log(
      `[PesapalProvider] Rate locked: ${dto.requestedAmount} USDT × ${authoritativeRate} = ${paymentAmount} ${paymentCurrency} (source=${lockedRate.source})`,
    );

    const session = await this.prisma.settlementSession.create({
      data: {
        telegramUserId,
        provider: SettlementProviderId.PESAPAL,
        asset: dto.asset,
        requestedAmount: new Prisma.Decimal(dto.requestedAmount),
        expectedCryptoAmount: new Prisma.Decimal(dto.expectedCryptoAmount),
        exchangeRate: new Prisma.Decimal(authoritativeRate.toString()),
        country,
        mobileMoneyNetwork: dto.paymentNetwork || dto.mobileMoneyNetwork || 'MOBILE_MONEY',
        referenceCode,
        status: initialStatus,
        expiresAt,
        providerMetadata: {
          provider: SettlementProviderId.PESAPAL,
          paymentMethod: dto.paymentMethod || (dto.mobileMoneyNetwork?.includes('CARD') ? 'CARD' : 'MOBILE_MONEY'),
          requiresAdminApproval,
          expectedCryptoUsd,
          riskCode: riskResult.riskCode || null,
          approvedAmount: dto.requestedAmount,
          approvedAsset: dto.asset,
          approvedCountry: country,
          // ── Financial snapshot locked at session creation ──
          paymentCurrency,
          paymentAmount,
          currencySymbol,
          exchangeRateUsed: authoritativeRate,
          exchangeRateSource: lockedRate.source,
          exchangeRateTimestamp: lockedRate.rateTimestamp,
          exchangeRateBaseRate: lockedRate.baseRate,
          exchangeRateAppliedRate: lockedRate.appliedRate,
        },
        events: {
          create: [
            {
              eventType: SettlementEventType.SettlementCreated,
              actorType: 'CUSTOMER',
              actorId: telegramUserId.toString(),
              payload: {
                paymentMethod: dto.paymentMethod || (dto.mobileMoneyNetwork?.includes('CARD') ? 'CARD' : 'MOBILE_MONEY'),
                requiresAdminApproval,
                amountUsd: expectedCryptoUsd,
                riskCode: riskResult.riskCode || null,
                paymentCurrency,
                paymentAmount,
                exchangeRate: authoritativeRate,
              },
            },
          ],
        },
      },
    });

    let payUrl: string | undefined;
    let orderTrackingId: string | undefined;

    if (!requiresAdminApproval) {
      const submitted = await this.submitOrderToPesapal(session);
      payUrl = submitted.redirect_url;
      orderTrackingId = submitted.order_tracking_id;
    } else {
      this.logger.log(`[PesapalProvider] Session ${session.id} requires admin approval (riskCode=${riskResult.riskCode}). Submission deferred.`);
    }

    const reloaded = await this.load(session.id);
    return {
      ...this.toProviderIndependentView(reloaded),
      payUrl: payUrl || (reloaded.providerMetadata as any)?.redirectUrl || null,
      paymentUrl: payUrl || (reloaded.providerMetadata as any)?.redirectUrl || null,
      orderTrackingId: orderTrackingId || (reloaded.providerMetadata as any)?.orderTrackingId || null,
      requiresAdminApproval,
    };
  }

  /**
   * Admin Approval: Authorize submission of a pending transaction to Pesapal.
   *
   * CONCURRENCY SAFETY (GAP 1): Uses atomic updateMany with status filter to prevent
   * two concurrent admin approvals from both succeeding.
   *
   * DOUBLE-SUBMISSION PROTECTION (GAP 2): Checks orderTrackingId in metadata before
   * submitting to Pesapal to prevent duplicate orders.
   *
   * INVARIANT 6 Enforcement: Re-validates that material fields (amount, currency, asset)
   * have not been mutated since creation.
   */
  async approveSettlement(settlementId: string, context: Record<string, unknown> = {}) {
    const session = await this.load(settlementId);
    if (session.status === SettlementStatus.COMPLETED) {
      return this.toProviderIndependentView(session);
    }

    const metadata = (session.providerMetadata || {}) as Record<string, any>;

    // INVARIANT 6: Material field mutation detection
    if (
      (metadata.approvedAmount && metadata.approvedAmount !== session.requestedAmount.toString()) ||
      (metadata.approvedAsset && metadata.approvedAsset !== session.asset)
    ) {
      this.logger.error(`[PesapalProvider] Material field mutation detected for session ${settlementId}`);
      throw new BadRequestException('MUTATED_TRANSACTION_APPROVAL_INVALID: Transaction details changed after creation.');
    }

    // GAP 2: Double-submission protection — if order already submitted, return existing state
    if (metadata.orderTrackingId) {
      this.logger.warn(`[PesapalProvider] Order already submitted for ${settlementId}: orderTrackingId=${metadata.orderTrackingId}`);
      throw new BadRequestException('ORDER_ALREADY_SUBMITTED: This settlement has already been submitted to the provider.');
    }

    // GAP 1: Atomic approval transition — only one concurrent request can succeed
    // Uses updateMany with status filter so the second concurrent request gets count=0
    const approvalResult = await this.prisma.settlementSession.updateMany({
      where: {
        id: settlementId,
        status: SettlementStatus.CREATED,
      },
      data: {
        status: SettlementStatus.APPROVED,
      },
    });

    if (approvalResult.count === 0) {
      // Either already approved by another admin, or status changed
      const currentSession = await this.load(settlementId);
      if (currentSession.status === SettlementStatus.APPROVED || currentSession.status === SettlementStatus.WAITING_FOR_PAYMENT || currentSession.status === SettlementStatus.COMPLETED) {
        this.logger.warn(`[PesapalProvider] Concurrent approval race detected for ${settlementId}. Session already at ${currentSession.status}.`);
        return this.toProviderIndependentView(currentSession);
      }
      throw new BadRequestException(`INVALID_SETTLEMENT_TRANSITION:${currentSession.status}->APPROVED`);
    }

    // Record the approval event (separate from atomic update since updateMany can't create relations)
    await this.prisma.settlementEvent.create({
      data: {
        settlementId,
        eventType: SettlementEventType.SettlementApproved,
        actorType: 'ADMIN',
        actorId: (context.adminId as string) || 'ADMIN',
        payload: context as Prisma.InputJsonValue,
      },
    });
    await this.emitSettlementEvent(settlementId, SettlementEventType.SettlementApproved, context);

    // Now submit to Pesapal — only one thread reaches here due to atomic gate above
    const approvedSession = await this.load(settlementId);
    const submitted = await this.submitOrderToPesapal(approvedSession);

    const readySession = await this.prisma.settlementSession.update({
      where: { id: settlementId },
      data: {
        status: SettlementStatus.WAITING_FOR_PAYMENT,
      },
    });

    return {
      ...this.toProviderIndependentView(readySession),
      payUrl: submitted.redirect_url,
      orderTrackingId: submitted.order_tracking_id,
    };
  }

  /**
   * Admin Rejection: Permanently reject submission. Pesapal is never contacted.
   */
  async rejectSettlement(settlementId: string, reason?: string) {
    return this.close(settlementId, SettlementStatus.REJECTED, SettlementEventType.SettlementRejected, { reason });
  }

  async expireSettlement(settlementId: string) {
    return this.close(settlementId, SettlementStatus.EXPIRED, SettlementEventType.SettlementExpired);
  }

  async cancelSettlement(settlementId: string) {
    return this.close(settlementId, SettlementStatus.CANCELLED, SettlementEventType.SettlementCancelled);
  }

  /**
   * Handle incoming Pesapal IPN callback notification.
   * Calls GetTransactionStatus directly from Pesapal server, normalizes status,
   * enforces idempotency, and routes verified completion to FinancialOrchestratorService.
   */
  async handleIpn(orderTrackingId: string, merchantReference: string) {
    this.logger.log(`[PesapalProvider] Processing IPN: orderTrackingId=${orderTrackingId}, merchantReference=${merchantReference}`);

    const session = await this.prisma.settlementSession.findFirst({
      where: {
        OR: [
          { referenceCode: merchantReference },
          { id: merchantReference },
        ],
      },
    });

    if (!session) {
      this.logger.error(`[PesapalProvider] IPN received for unknown transaction: merchantRef=${merchantReference}`);
      throw new NotFoundException(`SETTLEMENT_NOT_FOUND: ${merchantReference}`);
    }

    if (session.status === SettlementStatus.COMPLETED) {
      this.logger.log(`[PesapalProvider] IPN ignored for already COMPLETED transaction: ${session.id}`);
      return this.toProviderIndependentView(session);
    }

    // Direct server-to-server lookup
    const liveStatus = await this.pesapalClient.getTransactionStatus(orderTrackingId);

    if (liveStatus.merchant_reference && liveStatus.merchant_reference !== session.referenceCode && liveStatus.merchant_reference !== session.id) {
      throw new BadRequestException('PESAPAL_MERCHANT_REFERENCE_MISMATCH');
    }

    const normalized = this.normalizeStatus(liveStatus);

    if (normalized === 'COMPLETED') {
      try {
        this.verifyPaymentIntegrity(session, liveStatus);
        return this.processVerifiedSuccess(session, liveStatus);
      } catch (integrityErr: any) {
        // Payment integrity check failed — hold in VERIFYING for reconciliation.
        // Do NOT credit the user. Do NOT throw a 400 at Pesapal (would stop retries).
        this.logger.error(
          `[PesapalProvider] IPN payment integrity check failed for ${session.id}: ${integrityErr?.message}. ` +
          `Holding in VERIFYING for reconciliation retry.`,
        );
        await this.prisma.settlementSession.update({
          where: { id: session.id },
          data: {
            status: SettlementStatus.VERIFYING,
            events: {
              create: {
                eventType: SettlementEventType.SettlementVerificationStarted,
                actorType: 'SYSTEM',
                actorId: 'PAYMENT_INTEGRITY_GUARD',
                payload: {
                  reason: integrityErr?.message,
                  providerAmount: liveStatus.amount,
                  providerCurrency: liveStatus.currency,
                } as unknown as Prisma.InputJsonValue,
              },
            },
          },
        });
        return this.toProviderIndependentView(await this.load(session.id));
      }
    } else if (normalized === 'FAILED') {
      await this.prisma.settlementSession.update({
        where: { id: session.id },
        data: {
          status: SettlementStatus.FAILED,
          events: {
            create: {
              eventType: SettlementEventType.SettlementRejected,
              actorType: 'PROVIDER',
              actorId: this.providerId,
              payload: { liveStatus } as unknown as Prisma.InputJsonValue,
            },
          },
        },
      });
      return this.toProviderIndependentView(await this.load(session.id));
    } else if (normalized === 'UNKNOWN') {
      this.logger.warn(`[PesapalProvider] Unknown provider status for ${session.id}. Marking VERIFYING.`);
      await this.prisma.settlementSession.update({
        where: { id: session.id },
        data: { status: SettlementStatus.VERIFYING },
      });
      return this.toProviderIndependentView(await this.load(session.id));
    }

    return this.toProviderIndependentView(session);
  }

  validateSettlement(settlementId: string) {
    return this.load(settlementId);
  }

  monitorSettlement(settlementId: string) {
    return this.load(settlementId);
  }

  emitSettlementEvent(settlementId: string, eventType: SettlementEventType, payload: Record<string, unknown> = {}) {
    return this.events.emit(this.providerId, settlementId, eventType, payload);
  }

  private async submitOrderToPesapal(session: any) {
    const currentMetadata = (session.providerMetadata || {}) as Record<string, any>;
    if (currentMetadata.orderTrackingId) {
      this.logger.warn(`[PesapalProvider] Attempted duplicate submission for session ${session.id}. Existing tracking ID: ${currentMetadata.orderTrackingId}`);
      throw new BadRequestException('ORDER_ALREADY_SUBMITTED: Session already submitted to provider');
    }

    const callbackUrl = process.env.PESAPAL_CALLBACK_URL || `${process.env.APP_BASE_URL || 'https://tetherstream.internal'}/api/v1/settlement/pesapal/callback`;
    const ipnId = await this.pesapalClient.getIpnId(
      `${process.env.APP_BASE_URL || 'https://tetherstream.internal'}/api/v1/settlement/pesapal/ipn`
    );

    // ── Use the locked financial snapshot from session metadata ──────────
    // The rate and amount were locked at session creation time.
    // Do NOT recalculate here — use the exact values persisted in the session.
    const sessionMeta = (session.providerMetadata || {}) as Record<string, any>;
    const pesapalCurrency = sessionMeta.paymentCurrency
      || (session.country === 'KE' ? 'KES' : session.country === 'UG' ? 'UGX' : 'USD');
    const pesapalAmount = sessionMeta.paymentAmount != null
      ? Number(sessionMeta.paymentAmount)
      : new Prisma.Decimal(session.requestedAmount.toString()).mul(new Prisma.Decimal(session.exchangeRate.toString())).toDecimalPlaces(0).toNumber();

    this.logger.log(
      `[PesapalProvider] Submitting order: ${pesapalAmount} ${pesapalCurrency} (ref=${session.referenceCode})`,
    );

    const orderPayload: PesapalOrderRequestPayload = {
      id: session.referenceCode,
      currency: pesapalCurrency,
      amount: pesapalAmount,
      description: `TitanStream Deposit (${session.asset})`,
      callback_url: callbackUrl,
      notification_id: ipnId,
      billing_address: {
        email_address: `user_${session.telegramUserId}@tetherstream.internal`,
        phone_number: sessionMeta.phoneNumber || '0700000000',
        country_code: session.country || 'KE',
        first_name: 'Titan',
        last_name: 'User',
      },
    };

    const response = await this.pesapalClient.submitOrder(orderPayload);

    const metadata = {
      ...((session.providerMetadata as object) || {}),
      orderTrackingId: response.order_tracking_id,
      merchantReference: response.merchant_reference,
      redirectUrl: response.redirect_url,
      submittedAt: new Date().toISOString(),
    };

    await this.prisma.settlementSession.update({
      where: { id: session.id },
      data: {
        providerMetadata: metadata,
        status: SettlementStatus.WAITING_FOR_PAYMENT,
        events: {
          create: {
            eventType: SettlementEventType.SettlementInitialized,
            actorType: 'PROVIDER',
            actorId: this.providerId,
            payload: { orderTrackingId: response.order_tracking_id, redirectUrl: response.redirect_url },
          },
        },
      },
    });

    return response;
  }

  /**
   * PAYMENT INTEGRITY VERIFICATION — FAIL-CLOSED
   *
   * Before any user credit, verify that the Pesapal-reported payment matches
   * the locked financial snapshot in the session.
   *
   * FAIL-CLOSED POLICY:
   * - Missing amount  → REJECT (transition to VERIFYING for reconciliation)
   * - Missing currency → REJECT (transition to VERIFYING for reconciliation)
   * - Amount mismatch  → REJECT (throw BadRequestException)
   * - Currency mismatch → REJECT (throw BadRequestException)
   *
   * AMOUNT TOLERANCE:
   * Currency-specific absolute tolerances based on the smallest transactable
   * unit for each payment rail. Mobile money in East Africa transacts in
   * whole currency units (no sub-unit fractions). We allow exactly 1 whole
   * unit of tolerance to handle rounding at the payment provider boundary.
   *
   * UGX: ±1 UGX  (smallest unit; no fractional UGX exists)
   * KES: ±1 KES  (mobile money rounds to whole shillings)
   * USD: ±0.01   (1 cent tolerance for card processor rounding)
   *
   * This means:
   * 185,000 UGX → 185,000 UGX = ACCEPT
   * 185,000 UGX → 184,999 UGX = ACCEPT (within 1 UGX tolerance)
   * 185,000 UGX → 184,000 UGX = REJECT (1,000 UGX difference)
   * 185,000 UGX → 100,000 UGX = REJECT (material underpayment)
   */
  private verifyPaymentIntegrity(
    session: any,
    liveStatus: PesapalTransactionStatusResponse,
  ): void {
    const metadata = (session.providerMetadata || {}) as Record<string, any>;
    const expectedAmount = metadata.paymentAmount != null
      ? Number(metadata.paymentAmount)
      : new Prisma.Decimal(session.requestedAmount.toString())
          .mul(new Prisma.Decimal(session.exchangeRate.toString()))
          .toDecimalPlaces(0)
          .toNumber();
    const expectedCurrency = (metadata.paymentCurrency as string | undefined)
      || (session.country === 'KE' ? 'KES' : session.country === 'UG' ? 'UGX' : 'USD');

    // ── FAIL-CLOSED: Require provider amount ───────────────────────────
    if (liveStatus.amount == null || liveStatus.amount === undefined) {
      this.logger.error(
        `[PesapalProvider] MISSING_PROVIDER_AMOUNT for session ${session.id}: ` +
        `Pesapal did not return payment amount. Cannot authorize credit.`,
      );
      throw new BadRequestException(
        `MISSING_PROVIDER_AMOUNT: Provider did not return payment amount for session ${session.id}`,
      );
    }

    // ── FAIL-CLOSED: Require provider currency ─────────────────────────
    if (!liveStatus.currency) {
      this.logger.error(
        `[PesapalProvider] MISSING_PROVIDER_CURRENCY for session ${session.id}: ` +
        `Pesapal did not return payment currency. Cannot authorize credit.`,
      );
      throw new BadRequestException(
        `MISSING_PROVIDER_CURRENCY: Provider did not return payment currency for session ${session.id}`,
      );
    }

    // ── Currency verification (case-normalized, semantically exact) ────
    if (liveStatus.currency.toUpperCase() !== expectedCurrency.toUpperCase()) {
      this.logger.error(
        `[PesapalProvider] PAYMENT_CURRENCY_MISMATCH for session ${session.id}: ` +
        `expected=${expectedCurrency}, received=${liveStatus.currency}`,
      );
      throw new BadRequestException(
        `PAYMENT_CURRENCY_MISMATCH: expected=${expectedCurrency}, received=${liveStatus.currency}`,
      );
    }

    // ── Amount verification with currency-specific absolute tolerance ──
    const absoluteTolerance = this.getAmountTolerance(expectedCurrency);
    const amountDifference = Math.abs(liveStatus.amount - expectedAmount);

    if (amountDifference > absoluteTolerance) {
      this.logger.error(
        `[PesapalProvider] PAYMENT_AMOUNT_MISMATCH for session ${session.id}: ` +
        `expected=${expectedAmount} ${expectedCurrency}, received=${liveStatus.amount} ${liveStatus.currency}, ` +
        `difference=${amountDifference}, tolerance=${absoluteTolerance}`,
      );
      throw new BadRequestException(
        `PAYMENT_AMOUNT_MISMATCH: expected=${expectedAmount}, received=${liveStatus.amount}, ` +
        `difference=${amountDifference} exceeds tolerance=${absoluteTolerance} ${expectedCurrency}`,
      );
    }
  }

  /**
   * Currency-specific absolute amount tolerances.
   *
   * These tolerances account for rounding at the payment provider boundary:
   * - UGX: 1 unit (Uganda Shilling has no fractional subunit)
   * - KES: 1 unit (mobile money transacts in whole shillings)
   * - TZS: 1 unit (Tanzania Shilling, no fractional subunit for MM)
   * - NGN: 1 unit (whole Naira for mobile money)
   * - GHS: 0.01 (Ghana Cedi has pesewa subunit)
   * - USD: 0.01 (cent-level tolerance)
   * - GBP: 0.01 (penny-level tolerance)
   * - EUR: 0.01 (cent-level tolerance)
   *
   * Default for unknown currencies: 0 (exact match required).
   */
  private getAmountTolerance(currencyCode: string): number {
    const tolerances: Record<string, number> = {
      UGX: 1,
      KES: 1,
      TZS: 1,
      NGN: 1,
      GHS: 0.01,
      USD: 0.01,
      GBP: 0.01,
      EUR: 0.01,
    };
    return tolerances[currencyCode.toUpperCase()] ?? 0;
  }

  /**
   * DEFECT 1 FIX — Atomic Financial Settlement
   * All three operations (status claim, event recording, ledger posting) execute
   * inside a single Prisma $transaction. If ANY step fails, the entire
   * transaction rolls back — including the COMPLETED status. This means the next
   * IPN retry will re-attempt the full atomic posting.
   *
   * The FinancialOrchestratorService.requestOperation() accepts an optional
   * `client` parameter that joins the caller's transaction instead of opening
   * its own.
   */
  private async processVerifiedSuccess(session: any, liveStatus: PesapalTransactionStatusResponse) {
    const settlementId = session.id;
    const reference = `pesapal_settlement_${settlementId}`;

    const result = await this.prisma.$transaction(async (tx) => {
      // Step 1: Atomic claim — only one concurrent IPN/poll succeeds
      const updated = await tx.settlementSession.updateMany({
        where: {
          id: settlementId,
          status: { not: SettlementStatus.COMPLETED },
        },
        data: {
          status: SettlementStatus.COMPLETED,
          completedAt: new Date(),
          orchestratorReference: reference,
        },
      });

      if (updated.count === 0) {
        return null; // Already completed by another thread
      }

      // Step 2: Record completion event (inside same transaction)
      await tx.settlementEvent.create({
        data: {
          settlementId,
          eventType: SettlementEventType.SettlementCompleted,
          actorType: 'PROVIDER',
          actorId: this.providerId,
          payload: { reference, liveStatus } as unknown as Prisma.InputJsonValue,
        },
      });

      // Step 3: Ledger posting + balance credit (joins this transaction)
      await this.orchestrator.requestOperation({
        telegramUserId: session.telegramUserId,
        operationType: FinancialOperationType.SYSTEM_ALLOCATION,
        assetCode: session.asset,
        amount: session.expectedCryptoAmount.toString(),
        idempotencyKey: reference,
        reference,
        metadata: {
          source: 'pesapal_settlement',
          settlementId,
          provider: this.providerId,
          orderTrackingId: liveStatus.order_tracking_id,
          merchantReference: session.referenceCode,
          amountFiat: session.requestedAmount.toString(),
          currencyFiat: liveStatus.currency || session.country,
        },
      }, tx);

      return updated;
    }, { timeout: 15000, maxWait: 10000 });

    if (result === null) {
      return this.toProviderIndependentView(await this.load(settlementId));
    }

    // Event emission is fire-and-forget, outside the transaction
    await this.emitSettlementEvent(settlementId, SettlementEventType.SettlementCompleted, { reference });
    return this.toProviderIndependentView(await this.load(settlementId));
  }

  private async close(settlementId: string, status: SettlementStatus, eventType: SettlementEventType, payload: Record<string, unknown> = {}) {
    const session = await this.load(settlementId);
    if (session.status === SettlementStatus.COMPLETED) {
      throw new BadRequestException('SETTLEMENT_ALREADY_COMPLETED');
    }
    const updated = await this.prisma.settlementSession.update({
      where: { id: settlementId },
      data: {
        status,
        events: {
          create: {
            eventType,
            actorType: 'PROVIDER',
            actorId: this.providerId,
            payload: payload as Prisma.InputJsonValue,
          },
        },
      },
    });
    await this.emitSettlementEvent(settlementId, eventType, payload);
    return this.toProviderIndependentView(updated);
  }

  private async load(settlementId: string) {
    const session = await this.prisma.settlementSession.findUnique({ where: { id: settlementId } });
    if (!session) throw new BadRequestException('SETTLEMENT_NOT_FOUND');
    return session;
  }

  toProviderIndependentView(session: any) {
    const metadata = (session.providerMetadata || {}) as Record<string, any>;
    return {
      settlementId: session.id,
      provider: session.provider,
      reference: session.referenceCode,
      referenceCode: session.referenceCode,
      asset: session.asset,
      requestedAmount: session.requestedAmount.toString(),
      expectedAssetAmount: session.expectedCryptoAmount.toString(),
      expectedCryptoAmount: session.expectedCryptoAmount.toString(),
      exchangeRate: session.exchangeRate.toString(),
      status: session.status,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      payUrl: metadata.redirectUrl || null,
      paymentUrl: metadata.redirectUrl || null,
      orderTrackingId: metadata.orderTrackingId || null,
      requiresAdminApproval: metadata.requiresAdminApproval || false,
      // ── Canonical payment method source of truth ──
      paymentMethod: metadata.paymentMethod || (session.country === 'US' ? 'CARD' : 'MOBILE_MONEY'),
      mobileMoneyNetwork: metadata.mobileMoneyNetwork || session.mobileMoneyNetwork || null,
      // ── Financial display data (safe for frontend, no secrets) ──
      paymentCurrency: metadata.paymentCurrency || null,
      paymentAmount: metadata.paymentAmount != null ? Number(metadata.paymentAmount) : null,
      currencySymbol: metadata.currencySymbol || null,
      exchangeRateSource: metadata.exchangeRateSource || null,
      exchangeRateTimestamp: metadata.exchangeRateTimestamp || null,
    };
  }

  /**
   * SANDBOX SIMULATION: Instantly complete settlement and credit user balance.
   */
  async simulatePayment(settlementId: string) {
    const session = await this.load(settlementId);
    const metadata = (session.providerMetadata || {}) as Record<string, any>;

    const payCurrency = metadata.paymentCurrency || (session.country === 'KE' ? 'KES' : session.country === 'UG' ? 'UGX' : 'USD');
    const payAmount = metadata.paymentAmount != null
      ? Number(metadata.paymentAmount)
      : new Prisma.Decimal(session.requestedAmount.toString()).mul(new Prisma.Decimal(session.exchangeRate.toString())).toDecimalPlaces(0).toNumber();

    const mockLiveStatus: PesapalTransactionStatusResponse = {
      payment_method: 'SANDBOX_SIMULATOR',
      amount: payAmount,
      created_date: new Date().toISOString(),
      confirmation_code: `SANDBOX_SIM_${Date.now()}`,
      order_tracking_id: metadata.orderTrackingId || session.id,
      payment_status_description: 'Completed',
      message: 'Sandbox mock completion',
      status_code: 1,
      merchant_reference: session.referenceCode,
      currency: payCurrency,
      error: { code: undefined, message: undefined },
      status: '200',
    };

    return this.processVerifiedSuccess(session, mockLiveStatus);
  }
}
