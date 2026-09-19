import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { SettlementProviderId, SettlementStatus } from '@prisma/client';
import { PesapalClient } from './pesapal.client';
import { PesapalProvider } from './pesapal.provider';

describe('PesapalProvider Unit Tests', () => {
  let provider: PesapalProvider;
  let mockPrisma: any;
  let mockEvents: any;
  let mockOrchestrator: any;
  let mockPesapalClient: any;
  let mockRiskService: any;

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn().mockImplementation((cb) => cb(mockPrisma)),
      settlementSession: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      settlementEvent: {
        create: jest.fn(),
      },
    };

    mockRiskService = {
      evaluateUserRisk: jest.fn().mockResolvedValue({ allowed: true, requiresManualReview: false }),
      assertSessionCreationRisk: jest.fn().mockResolvedValue(undefined),
    };

    mockEvents = {
      emit: jest.fn().mockResolvedValue(true),
    };

    mockOrchestrator = {
      requestOperation: jest.fn().mockResolvedValue({ id: 'op_123' }),
    };

    mockPesapalClient = {
      isConfigured: jest.fn().mockReturnValue(true),
      getDiagnostics: jest.fn().mockReturnValue({ configured: true, environment: 'sandbox' }),
      submitOrder: jest.fn().mockResolvedValue({
        order_tracking_id: 'trk_pesapal_999',
        merchant_reference: 'PSP-123456',
        redirect_url: 'https://cyb3r.pesapal.com/pesapalv3/checkout',
        status: '200',
      }),
      getTransactionStatus: jest.fn().mockResolvedValue({
        status_code: 1,
        payment_status_description: 'Completed',
        amount: 100,
        currency: 'KES',
        merchant_reference: 'PSP-123456',
        order_tracking_id: 'trk_pesapal_999',
      }),
      getIpnId: jest.fn().mockResolvedValue('ipn_uuid_123'),
    };

    const mockExchangeRateService = {
      getRate: jest.fn().mockResolvedValue({ baseRate: 130, appliedRate: 132.6, userRate: 132.6, source: 'coingecko' }),
      lockRateForSettlement: jest.fn().mockResolvedValue({
        baseRate: 130, appliedRate: 132.6, userRate: 132.6, rateTimestamp: new Date().toISOString(), source: 'coingecko',
      }),
    };

    provider = new PesapalProvider(
      mockPrisma,
      mockEvents,
      mockOrchestrator,
      mockPesapalClient,
      mockRiskService,
      mockExchangeRateService as any,
    );
  });

  // ──────────────────────────────────────────────────────
  // SECTION 27: Provider Contract Tests
  // ──────────────────────────────────────────────────────

  describe('Capabilities & Identification', () => {
    it('returns correct manifest and providerId', () => {
      expect(provider.providerId).toBe(SettlementProviderId.PESAPAL);
      const manifest = provider.getCapabilities();
      expect(manifest.provider).toBe(SettlementProviderId.PESAPAL);
      expect(manifest.supports_buy).toBe(true);
      expect(manifest.supports_webhooks).toBe(true);
      expect(manifest.supported_assets).toContain('USDT');
    });
  });

  describe('Status Normalization', () => {
    it('normalizes status_code=1 to COMPLETED', () => {
      expect(provider.normalizeStatus({ status_code: 1 })).toBe('COMPLETED');
    });

    it('normalizes status_code=2 to FAILED', () => {
      expect(provider.normalizeStatus({ status_code: 2 })).toBe('FAILED');
    });

    it('normalizes status_code=0 to PENDING', () => {
      expect(provider.normalizeStatus({ status_code: 0 })).toBe('PENDING');
    });

    it('normalizes unknown status_code to UNKNOWN (Section 8-9)', () => {
      expect(provider.normalizeStatus({ status_code: 99 })).toBe('UNKNOWN');
      expect(provider.normalizeStatus({ status_code: -1 })).toBe('UNKNOWN');
      expect(provider.normalizeStatus({})).toBe('UNKNOWN');
    });

    it('normalizes payment_status_description strings case-insensitively', () => {
      expect(provider.normalizeStatus({ payment_status_description: 'Completed' })).toBe('COMPLETED');
      expect(provider.normalizeStatus({ payment_status_description: 'completed' })).toBe('COMPLETED');
      expect(provider.normalizeStatus({ payment_status_description: 'Failed' })).toBe('FAILED');
      expect(provider.normalizeStatus({ payment_status_description: 'Pending' })).toBe('PENDING');
    });
  });

  // ──────────────────────────────────────────────────────
  // SECTION 28: Financial Controls — Threshold & Approval
  // ──────────────────────────────────────────────────────

  describe('createSettlement — Risk Service Integration', () => {
    const telegramUserId = BigInt(12345);
    const baseDto = {
      asset: 'USDT',
      requestedAmount: '50',
      expectedCryptoAmount: '50',
      exchangeRate: '1.0',
      country: 'KE',
      mobileMoneyNetwork: 'PESAPAL',
    };

    it('creates session without admin approval when risk service does not require manual review', async () => {
      mockRiskService.evaluateUserRisk.mockResolvedValue({ allowed: true, requiresManualReview: false });

      const fakeSession = {
        id: 'sess_1', telegramUserId, provider: SettlementProviderId.PESAPAL,
        asset: 'USDT', requestedAmount: '50', expectedCryptoAmount: '50',
        exchangeRate: '1.0', country: 'KE', referenceCode: 'PSP-100',
        status: SettlementStatus.WAITING_FOR_PAYMENT, expiresAt: new Date(),
        providerMetadata: {},
      };
      mockPrisma.settlementSession.create.mockResolvedValue(fakeSession);
      mockPrisma.settlementSession.findUnique.mockResolvedValue(fakeSession);
      mockPrisma.settlementSession.update.mockResolvedValue({
        ...fakeSession,
        providerMetadata: { orderTrackingId: 'trk_999', redirectUrl: 'https://cyb3r.pesapal.com/...' },
      });

      const res = await provider.createSettlement(telegramUserId, baseDto);

      expect(mockRiskService.evaluateUserRisk).toHaveBeenCalledWith(telegramUserId, 50);
      expect(mockPesapalClient.submitOrder).toHaveBeenCalled();
      expect(res.requiresAdminApproval).toBe(false);
    });

    it('defers submission when risk service requires manual review (Section 6)', async () => {
      mockRiskService.evaluateUserRisk.mockResolvedValue({
        allowed: true, requiresManualReview: true, riskCode: 'MANUAL_REVIEW_THRESHOLD',
      });

      const fakeSession = {
        id: 'sess_high', telegramUserId, provider: SettlementProviderId.PESAPAL,
        asset: 'USDT', requestedAmount: '1000', expectedCryptoAmount: '1000',
        exchangeRate: '1.0', country: 'KE', referenceCode: 'PSP-1000',
        status: SettlementStatus.CREATED, expiresAt: new Date(),
        providerMetadata: { requiresAdminApproval: true },
      };
      mockPrisma.settlementSession.create.mockResolvedValue(fakeSession);
      mockPrisma.settlementSession.findUnique.mockResolvedValue(fakeSession);

      const res = await provider.createSettlement(telegramUserId, {
        ...baseDto, requestedAmount: '1000', expectedCryptoAmount: '1000',
      });

      expect(mockPesapalClient.submitOrder).not.toHaveBeenCalled();
      expect(res.requiresAdminApproval).toBe(true);
      expect(res.status).toBe(SettlementStatus.CREATED);
    });

    it('rejects session when risk service disallows (hard limit exceeded)', async () => {
      mockRiskService.evaluateUserRisk.mockResolvedValue({
        allowed: false, reason: 'Daily limit exceeded.',
      });

      await expect(provider.createSettlement(telegramUserId, baseDto))
        .rejects.toThrow('SETTLEMENT_RISK_REJECTED');
      expect(mockPrisma.settlementSession.create).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────
  // SECTION 28: Admin Approval & Rejection
  // ──────────────────────────────────────────────────────

  describe('approveSettlement & rejectSettlement', () => {
    const basePendingSession = {
      id: 'sess_pending_appr', telegramUserId: BigInt(12345),
      provider: SettlementProviderId.PESAPAL, referenceCode: 'PSP-1000',
      asset: 'USDT', requestedAmount: '1000', expectedCryptoAmount: '1000',
      exchangeRate: '1.0', country: 'KE', status: SettlementStatus.CREATED,
      expiresAt: new Date(),
      providerMetadata: { requiresAdminApproval: true, approvedAmount: '1000', approvedAsset: 'USDT' },
    };

    it('submits order to Pesapal after Admin approval', async () => {
      mockPrisma.settlementSession.findUnique.mockResolvedValue(basePendingSession);
      mockPrisma.settlementSession.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.settlementSession.update.mockResolvedValue({
        ...basePendingSession, status: SettlementStatus.WAITING_FOR_PAYMENT,
      });

      const res = await provider.approveSettlement('sess_pending_appr', { adminId: 'adm_1' });

      expect(mockPrisma.settlementSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sess_pending_appr', status: SettlementStatus.CREATED },
          data: { status: SettlementStatus.APPROVED },
        })
      );
      expect(mockPesapalClient.submitOrder).toHaveBeenCalled();
      expect(res.payUrl).toBeDefined();
    });

    it('rejects settlement permanently and blocks provider submission', async () => {
      const fakeSession = { ...basePendingSession, id: 'sess_to_reject' };
      mockPrisma.settlementSession.findUnique.mockResolvedValue(fakeSession);
      mockPrisma.settlementSession.update.mockResolvedValue({
        ...fakeSession, status: SettlementStatus.REJECTED,
      });

      const res = await provider.rejectSettlement('sess_to_reject', 'Risk flag raised');

      expect(mockPesapalClient.submitOrder).not.toHaveBeenCalled();
      expect(res.status).toBe(SettlementStatus.REJECTED);
    });

    it('detects material field mutation and blocks approval (INVARIANT 6)', async () => {
      const mutatedSession = {
        ...basePendingSession,
        requestedAmount: '2000', // Amount changed after creation
        providerMetadata: { approvedAmount: '1000', approvedAsset: 'USDT' },
      };
      mockPrisma.settlementSession.findUnique.mockResolvedValue(mutatedSession);

      await expect(provider.approveSettlement('sess_pending_appr'))
        .rejects.toThrow('MUTATED_TRANSACTION_APPROVAL_INVALID');
      expect(mockPesapalClient.submitOrder).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────
  // SECTION 32: Concurrency Tests
  // ──────────────────────────────────────────────────────

  describe('Concurrency Safety', () => {
    it('prevents two concurrent approvals — second gets count=0 (GAP 1)', async () => {
      const fakeSession = {
        id: 'sess_concurrent', telegramUserId: BigInt(12345),
        provider: SettlementProviderId.PESAPAL, referenceCode: 'PSP-CONC',
        asset: 'USDT', requestedAmount: '1000', expectedCryptoAmount: '1000',
        exchangeRate: '1.0', status: SettlementStatus.CREATED,
        expiresAt: new Date(),
        providerMetadata: { requiresAdminApproval: true, approvedAmount: '1000', approvedAsset: 'USDT' },
      };

      // First approval succeeds
      mockPrisma.settlementSession.findUnique
        .mockResolvedValueOnce(fakeSession) // load in approveSettlement
        .mockResolvedValueOnce({ ...fakeSession, status: SettlementStatus.APPROVED }) // load after atomic
        .mockResolvedValueOnce({ ...fakeSession, status: SettlementStatus.APPROVED }); // second call load

      mockPrisma.settlementSession.updateMany
        .mockResolvedValueOnce({ count: 1 })  // first approval succeeds
        .mockResolvedValueOnce({ count: 0 }); // second approval blocked by atomic gate

      mockPrisma.settlementSession.update.mockResolvedValue({
        ...fakeSession, status: SettlementStatus.WAITING_FOR_PAYMENT,
      });

      // First approval
      await provider.approveSettlement('sess_concurrent', { adminId: 'admin_A' });
      expect(mockPesapalClient.submitOrder).toHaveBeenCalledTimes(1);

      // Second concurrent approval — should NOT submit again
      mockPrisma.settlementSession.findUnique.mockResolvedValue({
        ...fakeSession, status: SettlementStatus.APPROVED,
      });
      const res2 = await provider.approveSettlement('sess_concurrent', { adminId: 'admin_B' });
      expect(mockPesapalClient.submitOrder).toHaveBeenCalledTimes(1); // Still only 1 call
    });

    it('prevents double submission when orderTrackingId already exists (GAP 2)', async () => {
      const alreadySubmitted = {
        id: 'sess_submitted', telegramUserId: BigInt(12345),
        provider: SettlementProviderId.PESAPAL, referenceCode: 'PSP-SUB',
        asset: 'USDT', requestedAmount: '100', expectedCryptoAmount: '100',
        exchangeRate: '1.0', status: SettlementStatus.CREATED,
        expiresAt: new Date(),
        providerMetadata: {
          orderTrackingId: 'trk_already_exists', // Already submitted!
          approvedAmount: '100', approvedAsset: 'USDT',
        },
      };
      mockPrisma.settlementSession.findUnique.mockResolvedValue(alreadySubmitted);

      await expect(provider.approveSettlement('sess_submitted'))
        .rejects.toThrow('ORDER_ALREADY_SUBMITTED');
      expect(mockPesapalClient.submitOrder).not.toHaveBeenCalled();
    });

    it('only one financial settlement occurs from duplicate IPNs (INVARIANT 5)', async () => {
      const fakeSession = {
        id: 'sess_dup_ipn', telegramUserId: BigInt(12345),
        provider: SettlementProviderId.PESAPAL, referenceCode: 'PSP-DUP',
        asset: 'USDT', requestedAmount: '100', expectedCryptoAmount: '100',
        exchangeRate: '1.0', status: SettlementStatus.WAITING_FOR_PAYMENT,
        expiresAt: new Date(),
        providerMetadata: { paymentAmount: 100, paymentCurrency: 'KES' },
      };

      mockPesapalClient.getTransactionStatus.mockResolvedValue({
        status_code: 1, payment_status_description: 'Completed',
        amount: 100, currency: 'KES', merchant_reference: 'PSP-DUP', order_tracking_id: 'trk_1',
      });

      mockPrisma.settlementSession.findFirst.mockResolvedValue(fakeSession);
      // First IPN: atomic update succeeds
      mockPrisma.settlementSession.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.settlementSession.findUnique.mockResolvedValue({
        ...fakeSession, status: SettlementStatus.COMPLETED,
      });

      await provider.handleIpn('trk_1', 'PSP-DUP');
      expect(mockOrchestrator.requestOperation).toHaveBeenCalledTimes(1);

      // Second IPN: session already COMPLETED, early return
      mockPrisma.settlementSession.findFirst.mockResolvedValue({
        ...fakeSession, status: SettlementStatus.COMPLETED,
      });

      await provider.handleIpn('trk_1', 'PSP-DUP');
      expect(mockOrchestrator.requestOperation).toHaveBeenCalledTimes(1); // Still only 1
    });

    it('concurrent IPN + polling — only one triggers settlement (INVARIANT 5)', async () => {
      const fakeSession = {
        id: 'sess_race', telegramUserId: BigInt(12345),
        provider: SettlementProviderId.PESAPAL, referenceCode: 'PSP-RACE',
        asset: 'USDT', requestedAmount: '100', expectedCryptoAmount: '100',
        exchangeRate: '1.0', status: SettlementStatus.WAITING_FOR_PAYMENT,
        expiresAt: new Date(), providerMetadata: { orderTrackingId: 'trk_race', paymentAmount: 100, paymentCurrency: 'KES' },
      };

      mockPesapalClient.getTransactionStatus.mockResolvedValue({
        status_code: 1, payment_status_description: 'Completed',
        amount: 100, currency: 'KES', merchant_reference: 'PSP-RACE', order_tracking_id: 'trk_race',
      });

      mockPrisma.settlementSession.findFirst.mockResolvedValue(fakeSession);
      mockPrisma.settlementSession.findUnique.mockResolvedValue(fakeSession);

      // First concurrent request wins
      mockPrisma.settlementSession.updateMany.mockResolvedValueOnce({ count: 1 });
      // Second concurrent request loses
      mockPrisma.settlementSession.updateMany.mockResolvedValueOnce({ count: 0 });

      const [ipnResult, pollResult] = await Promise.all([
        provider.handleIpn('trk_race', 'PSP-RACE'),
        provider.getSettlementStatus('sess_race'),
      ]);

      expect(mockOrchestrator.requestOperation).toHaveBeenCalledTimes(1);
    });
  });

  // ──────────────────────────────────────────────────────
  // SECTION 29: Attack Tests — Client-Controlled Bypass
  // ──────────────────────────────────────────────────────

  describe('Attack Resistance — Client-Controlled Fields', () => {
    it('client cannot force approval via DTO fields (INVARIANT 3)', async () => {
      // Even if a client sends approved=true, status=COMPLETED, etc. in the DTO,
      // createSettlement only reads: asset, requestedAmount, expectedCryptoAmount, exchangeRate, country
      // The status is determined server-side by risk evaluation
      mockRiskService.evaluateUserRisk.mockResolvedValue({ allowed: true, requiresManualReview: true });

      const fakeSession = {
        id: 'sess_attack', telegramUserId: BigInt(999),
        provider: SettlementProviderId.PESAPAL,
        asset: 'USDT', requestedAmount: '1000', expectedCryptoAmount: '1000',
        exchangeRate: '1.0', country: 'KE', referenceCode: 'PSP-ATK',
        status: SettlementStatus.CREATED, expiresAt: new Date(),
        providerMetadata: { requiresAdminApproval: true },
      };
      mockPrisma.settlementSession.create.mockResolvedValue(fakeSession);
      mockPrisma.settlementSession.findUnique.mockResolvedValue(fakeSession);

      // Client tries to inject approved=true via any field
      const res = await provider.createSettlement(BigInt(999), {
        asset: 'USDT', requestedAmount: '1000', expectedCryptoAmount: '1000',
        exchangeRate: '1.0', country: 'KE', mobileMoneyNetwork: 'PESAPAL',
      } as any);

      // Status is CREATED (pending approval), NOT COMPLETED or APPROVED
      expect(res.status).toBe(SettlementStatus.CREATED);
      expect(res.requiresAdminApproval).toBe(true);
      expect(mockPesapalClient.submitOrder).not.toHaveBeenCalled();
    });

    it('client cannot mutate amount after approval (INVARIANT 6)', async () => {
      const session = {
        id: 'sess_mutated', telegramUserId: BigInt(12345),
        provider: SettlementProviderId.PESAPAL, referenceCode: 'PSP-MUT',
        asset: 'USDT',
        requestedAmount: '500', // Changed from 100 to 500 after creation!
        expectedCryptoAmount: '500',
        exchangeRate: '1.0', status: SettlementStatus.CREATED,
        expiresAt: new Date(),
        providerMetadata: { approvedAmount: '100', approvedAsset: 'USDT' }, // Original was 100
      };
      mockPrisma.settlementSession.findUnique.mockResolvedValue(session);

      await expect(provider.approveSettlement('sess_mutated'))
        .rejects.toThrow('MUTATED_TRANSACTION_APPROVAL_INVALID');
    });
  });

  // ──────────────────────────────────────────────────────
  // SECTION 30: Callback Attack Tests
  // ──────────────────────────────────────────────────────

  describe('Callback Attack Resistance', () => {
    it('rejects IPN with unknown merchant reference', async () => {
      mockPrisma.settlementSession.findFirst.mockResolvedValue(null);

      await expect(provider.handleIpn('trk_unknown', 'PSP-NONEXISTENT'))
        .rejects.toThrow('SETTLEMENT_NOT_FOUND');
      expect(mockOrchestrator.requestOperation).not.toHaveBeenCalled();
    });

    it('rejects IPN with mismatched merchant reference (reference mismatch attack)', async () => {
      const session = {
        id: 'sess_mismatch', telegramUserId: BigInt(12345),
        provider: SettlementProviderId.PESAPAL, referenceCode: 'PSP-REAL',
        asset: 'USDT', requestedAmount: '100', expectedCryptoAmount: '100',
        exchangeRate: '1.0', status: SettlementStatus.WAITING_FOR_PAYMENT,
        expiresAt: new Date(),
      };
      mockPrisma.settlementSession.findFirst.mockResolvedValue(session);

      // Provider returns a DIFFERENT merchant_reference
      mockPesapalClient.getTransactionStatus.mockResolvedValue({
        status_code: 1,
        payment_status_description: 'Completed',
        merchant_reference: 'PSP-ATTACKER-REF', // Mismatch!
        order_tracking_id: 'trk_mismatch',
      });

      await expect(provider.handleIpn('trk_mismatch', 'PSP-REAL'))
        .rejects.toThrow('PESAPAL_MERCHANT_REFERENCE_MISMATCH');
      expect(mockOrchestrator.requestOperation).not.toHaveBeenCalled();
    });

    it('ignores IPN for already completed session (replay attack)', async () => {
      const completedSession = {
        id: 'sess_done', telegramUserId: BigInt(12345),
        provider: SettlementProviderId.PESAPAL, referenceCode: 'PSP-DONE',
        asset: 'USDT', requestedAmount: '100', expectedCryptoAmount: '100',
        exchangeRate: '1.0', status: SettlementStatus.COMPLETED,
        expiresAt: new Date(),
      };
      mockPrisma.settlementSession.findFirst.mockResolvedValue(completedSession);

      const res = await provider.handleIpn('trk_replay', 'PSP-DONE');
      expect(mockPesapalClient.getTransactionStatus).not.toHaveBeenCalled();
      expect(mockOrchestrator.requestOperation).not.toHaveBeenCalled();
      expect(res.status).toBe(SettlementStatus.COMPLETED);
    });

    it('does not settle on provider FAILED status (INVARIANT 8)', async () => {
      const session = {
        id: 'sess_fail', telegramUserId: BigInt(12345),
        provider: SettlementProviderId.PESAPAL, referenceCode: 'PSP-FAIL',
        asset: 'USDT', requestedAmount: '100', expectedCryptoAmount: '100',
        exchangeRate: '1.0', status: SettlementStatus.WAITING_FOR_PAYMENT,
        expiresAt: new Date(),
      };
      mockPrisma.settlementSession.findFirst.mockResolvedValue(session);
      mockPrisma.settlementSession.findUnique.mockResolvedValue({
        ...session, status: SettlementStatus.FAILED,
      });
      mockPesapalClient.getTransactionStatus.mockResolvedValue({
        status_code: 2, payment_status_description: 'Failed',
        merchant_reference: 'PSP-FAIL',
      });

      await provider.handleIpn('trk_fail', 'PSP-FAIL');
      expect(mockOrchestrator.requestOperation).not.toHaveBeenCalled();
    });

    it('does not settle on UNKNOWN provider status (INVARIANT 9)', async () => {
      const session = {
        id: 'sess_unknown', telegramUserId: BigInt(12345),
        provider: SettlementProviderId.PESAPAL, referenceCode: 'PSP-UNK',
        asset: 'USDT', requestedAmount: '100', expectedCryptoAmount: '100',
        exchangeRate: '1.0', status: SettlementStatus.WAITING_FOR_PAYMENT,
        expiresAt: new Date(),
      };
      mockPrisma.settlementSession.findFirst.mockResolvedValue(session);
      mockPrisma.settlementSession.findUnique.mockResolvedValue({
        ...session, status: SettlementStatus.VERIFYING,
      });
      mockPesapalClient.getTransactionStatus.mockResolvedValue({
        status_code: 99, payment_status_description: 'SomethingNew',
        merchant_reference: 'PSP-UNK',
      });

      await provider.handleIpn('trk_unk', 'PSP-UNK');
      expect(mockOrchestrator.requestOperation).not.toHaveBeenCalled();
      // Should transition to VERIFYING, not SUCCESS
      expect(mockPrisma.settlementSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: SettlementStatus.VERIFYING }),
        })
      );
    });
  });

  // ──────────────────────────────────────────────────────
  // SECTION 31: Ledger Invariant Tests
  // ──────────────────────────────────────────────────────

  describe('Ledger Invariants', () => {
    it('verified provider success triggers exactly one DEPOSIT_SETTLEMENT with correct fields', async () => {
      const session = {
        id: 'sess_ledger', telegramUserId: BigInt(12345),
        provider: SettlementProviderId.PESAPAL, referenceCode: 'PSP-LEDGER',
        asset: 'USDT', requestedAmount: '100', expectedCryptoAmount: '100',
        exchangeRate: '1.0', country: 'KE',
        status: SettlementStatus.WAITING_FOR_PAYMENT,
        expiresAt: new Date(),
        providerMetadata: { paymentAmount: 100, paymentCurrency: 'KES' },
      };

      mockPrisma.settlementSession.findFirst.mockResolvedValue(session);
      mockPrisma.settlementSession.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.settlementSession.findUnique.mockResolvedValue({
        ...session, status: SettlementStatus.COMPLETED,
      });
      mockPesapalClient.getTransactionStatus.mockResolvedValue({
        status_code: 1, payment_status_description: 'Completed',
        merchant_reference: 'PSP-LEDGER', order_tracking_id: 'trk_ledger',
        amount: 100, currency: 'KES',
      });

      await provider.handleIpn('trk_ledger', 'PSP-LEDGER');

      expect(mockOrchestrator.requestOperation).toHaveBeenCalledTimes(1);
      expect(mockOrchestrator.requestOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          telegramUserId: BigInt(12345),
          operationType: 'DEPOSIT_SETTLEMENT',
          assetCode: 'USDT',
          amount: '100',
          idempotencyKey: 'pesapal_settlement_sess_ledger',
          reference: 'pesapal_settlement_sess_ledger',
        }),
        expect.anything(),
      );
    });

    it('no balance mutation occurs on provider failure', async () => {
      const session = {
        id: 'sess_nofx', telegramUserId: BigInt(12345),
        provider: SettlementProviderId.PESAPAL, referenceCode: 'PSP-NOFX',
        asset: 'USDT', requestedAmount: '100', expectedCryptoAmount: '100',
        exchangeRate: '1.0', status: SettlementStatus.WAITING_FOR_PAYMENT,
        expiresAt: new Date(),
      };
      mockPrisma.settlementSession.findFirst.mockResolvedValue(session);
      mockPrisma.settlementSession.findUnique.mockResolvedValue({
        ...session, status: SettlementStatus.FAILED,
      });
      mockPesapalClient.getTransactionStatus.mockResolvedValue({
        status_code: 2, payment_status_description: 'Failed',
        merchant_reference: 'PSP-NOFX',
      });

      await provider.handleIpn('trk_nofx', 'PSP-NOFX');
      expect(mockOrchestrator.requestOperation).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────
  // SECTION 33: Secret Leakage Prevention
  // ──────────────────────────────────────────────────────

  describe('Secret Leakage Prevention', () => {
    it('provider independent view never contains credentials', async () => {
      const session = {
        id: 'sess_safe', telegramUserId: BigInt(12345),
        provider: SettlementProviderId.PESAPAL, referenceCode: 'PSP-SAFE',
        asset: 'USDT', requestedAmount: '100', expectedCryptoAmount: '100',
        exchangeRate: '1.0', status: SettlementStatus.COMPLETED,
        expiresAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
        providerMetadata: { orderTrackingId: 'trk_safe', redirectUrl: 'https://example.com' },
      };
      mockPrisma.settlementSession.findUnique.mockResolvedValue(session);

      const view = await provider.getSettlementStatus('sess_safe');
      const viewStr = JSON.stringify(view);

      expect(viewStr).not.toContain('consumer_key');
      expect(viewStr).not.toContain('consumer_secret');
      expect(viewStr).not.toContain('Bearer');
      expect(viewStr).not.toContain('PESAPAL_CONSUMER');
    });
  });
});
