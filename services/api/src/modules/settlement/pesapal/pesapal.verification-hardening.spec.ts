import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SettlementProviderId, SettlementStatus, SettlementEventType, Prisma } from '@prisma/client';
import { PesapalProvider } from './pesapal.provider';

/**
 * TITAN STREAM — PAYMENT VERIFICATION HARDENING TESTS
 *
 * Tests 7 verification categories:
 * 1. Payment Verification Hardening (fail-closed)
 * 2. Atomicity Failure Injection
 * 3. Amount Verification (currency-specific absolute tolerances)
 * 4. Currency Verification
 * 5. Missing-Data Fail-Closed
 * 6. Underpayment Protection
 * 7. Concurrency (single-credit guarantee)
 */
describe('Payment Verification Hardening', () => {
  let provider: PesapalProvider;
  let mockPrisma: any;
  let mockEvents: any;
  let mockOrchestrator: any;
  let mockPesapalClient: any;
  let mockRiskService: any;
  let mockExchangeRateService: any;

  // Standard UGX session: 50 USDT × 3700 = 185,000 UGX
  const baseUgxSession = {
    id: 'sess_ugx_1',
    telegramUserId: BigInt(12345),
    provider: SettlementProviderId.PESAPAL,
    referenceCode: 'PSP-UGX-1',
    asset: 'USDT',
    requestedAmount: new Prisma.Decimal('50'),
    expectedCryptoAmount: new Prisma.Decimal('50'),
    exchangeRate: new Prisma.Decimal('3700'),
    country: 'UG',
    status: SettlementStatus.WAITING_FOR_PAYMENT,
    expiresAt: new Date(),
    providerMetadata: {
      paymentCurrency: 'UGX',
      paymentAmount: 185000,
      orderTrackingId: 'trk_ugx_1',
    },
  };

  // Standard KES session: 50 USDT × 130 = 6,500 KES
  const baseKesSession = {
    ...baseUgxSession,
    id: 'sess_kes_1',
    referenceCode: 'PSP-KES-1',
    exchangeRate: new Prisma.Decimal('130'),
    country: 'KE',
    providerMetadata: {
      paymentCurrency: 'KES',
      paymentAmount: 6500,
      orderTrackingId: 'trk_kes_1',
    },
  };

  beforeEach(() => {
    mockPrisma = {
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
      $transaction: jest.fn(),
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
        order_tracking_id: 'trk_test',
        merchant_reference: 'PSP-TEST',
        redirect_url: 'https://cyb3r.pesapal.com/pesapalv3/checkout',
      }),
      getTransactionStatus: jest.fn(),
      getIpnId: jest.fn().mockResolvedValue('ipn_test'),
    };

    mockRiskService = {
      evaluateUserRisk: jest.fn().mockResolvedValue({ allowed: true, requiresManualReview: false }),
    };

    mockExchangeRateService = {
      getRate: jest.fn().mockResolvedValue({ baseRate: 3700, appliedRate: 3793, userRate: 3793, source: 'coingecko' }),
      lockRateForSettlement: jest.fn().mockResolvedValue({
        baseRate: 3700, appliedRate: 3793, userRate: 3793,
        rateTimestamp: new Date().toISOString(), source: 'coingecko',
      }),
    };

    provider = new PesapalProvider(
      mockPrisma,
      mockEvents,
      mockOrchestrator,
      mockPesapalClient,
      mockRiskService,
      mockExchangeRateService,
    );
  });

  // ════════════════════════════════════════════════════════════════
  // CATEGORY 1: MISSING-DATA FAIL-CLOSED
  // ════════════════════════════════════════════════════════════════

  describe('Missing-Data Fail-Closed', () => {
    it('REJECTS COMPLETED + missing amount — NO CREDIT', async () => {
      mockPrisma.settlementSession.findFirst.mockResolvedValue(baseUgxSession);
      mockPrisma.settlementSession.findUnique.mockResolvedValue({
        ...baseUgxSession, status: SettlementStatus.VERIFYING,
      });

      mockPesapalClient.getTransactionStatus.mockResolvedValue({
        status_code: 1,
        payment_status_description: 'Completed',
        // amount is MISSING
        currency: 'UGX',
        merchant_reference: 'PSP-UGX-1',
        order_tracking_id: 'trk_ugx_1',
      });

      const result = await provider.handleIpn('trk_ugx_1', 'PSP-UGX-1');

      // NO credit issued
      expect(mockOrchestrator.requestOperation).not.toHaveBeenCalled();
      // Session held in VERIFYING for reconciliation
      expect(mockPrisma.settlementSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: SettlementStatus.VERIFYING }),
        }),
      );
      expect(result.status).toBe(SettlementStatus.VERIFYING);
    });

    it('REJECTS COMPLETED + missing currency — NO CREDIT', async () => {
      mockPrisma.settlementSession.findFirst.mockResolvedValue(baseUgxSession);
      mockPrisma.settlementSession.findUnique.mockResolvedValue({
        ...baseUgxSession, status: SettlementStatus.VERIFYING,
      });

      mockPesapalClient.getTransactionStatus.mockResolvedValue({
        status_code: 1,
        payment_status_description: 'Completed',
        amount: 185000,
        // currency is MISSING
        merchant_reference: 'PSP-UGX-1',
        order_tracking_id: 'trk_ugx_1',
      });

      const result = await provider.handleIpn('trk_ugx_1', 'PSP-UGX-1');

      expect(mockOrchestrator.requestOperation).not.toHaveBeenCalled();
      expect(mockPrisma.settlementSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: SettlementStatus.VERIFYING }),
        }),
      );
      expect(result.status).toBe(SettlementStatus.VERIFYING);
    });

    it('REJECTS COMPLETED + both amount AND currency missing — NO CREDIT', async () => {
      mockPrisma.settlementSession.findFirst.mockResolvedValue(baseUgxSession);
      mockPrisma.settlementSession.findUnique.mockResolvedValue({
        ...baseUgxSession, status: SettlementStatus.VERIFYING,
      });

      mockPesapalClient.getTransactionStatus.mockResolvedValue({
        status_code: 1,
        payment_status_description: 'Completed',
        // BOTH amount AND currency MISSING
        merchant_reference: 'PSP-UGX-1',
        order_tracking_id: 'trk_ugx_1',
      });

      const result = await provider.handleIpn('trk_ugx_1', 'PSP-UGX-1');

      expect(mockOrchestrator.requestOperation).not.toHaveBeenCalled();
      expect(result.status).toBe(SettlementStatus.VERIFYING);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // CATEGORY 2: CURRENCY VERIFICATION
  // ════════════════════════════════════════════════════════════════

  describe('Currency Verification', () => {
    it('ACCEPTS matching currency: 185,000 UGX → 185,000 UGX', async () => {
      mockPrisma.settlementSession.findFirst.mockResolvedValue(baseUgxSession);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn({
        settlementSession: mockPrisma.settlementSession,
        settlementEvent: mockPrisma.settlementEvent,
      }));
      mockPrisma.settlementSession.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.settlementSession.findUnique.mockResolvedValue({
        ...baseUgxSession, status: SettlementStatus.COMPLETED,
      });

      mockPesapalClient.getTransactionStatus.mockResolvedValue({
        status_code: 1,
        payment_status_description: 'Completed',
        amount: 185000,
        currency: 'UGX',
        merchant_reference: 'PSP-UGX-1',
        order_tracking_id: 'trk_ugx_1',
      });

      const result = await provider.handleIpn('trk_ugx_1', 'PSP-UGX-1');
      expect(result.status).toBe(SettlementStatus.COMPLETED);
    });

    it('REJECTS wrong currency: expected UGX, received KES — NO CREDIT', async () => {
      mockPrisma.settlementSession.findFirst.mockResolvedValue(baseUgxSession);
      mockPrisma.settlementSession.findUnique.mockResolvedValue({
        ...baseUgxSession, status: SettlementStatus.VERIFYING,
      });

      mockPesapalClient.getTransactionStatus.mockResolvedValue({
        status_code: 1,
        payment_status_description: 'Completed',
        amount: 185000,
        currency: 'KES', // WRONG — expected UGX
        merchant_reference: 'PSP-UGX-1',
        order_tracking_id: 'trk_ugx_1',
      });

      const result = await provider.handleIpn('trk_ugx_1', 'PSP-UGX-1');

      expect(mockOrchestrator.requestOperation).not.toHaveBeenCalled();
      expect(result.status).toBe(SettlementStatus.VERIFYING);
    });

    it('ACCEPTS case-insensitive currency match: ugx vs UGX', async () => {
      mockPrisma.settlementSession.findFirst.mockResolvedValue(baseUgxSession);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn({
        settlementSession: mockPrisma.settlementSession,
        settlementEvent: mockPrisma.settlementEvent,
      }));
      mockPrisma.settlementSession.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.settlementSession.findUnique.mockResolvedValue({
        ...baseUgxSession, status: SettlementStatus.COMPLETED,
      });

      mockPesapalClient.getTransactionStatus.mockResolvedValue({
        status_code: 1,
        payment_status_description: 'Completed',
        amount: 185000,
        currency: 'ugx', // lowercase — should still match UGX
        merchant_reference: 'PSP-UGX-1',
        order_tracking_id: 'trk_ugx_1',
      });

      const result = await provider.handleIpn('trk_ugx_1', 'PSP-UGX-1');
      expect(result.status).toBe(SettlementStatus.COMPLETED);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // CATEGORY 3: AMOUNT VERIFICATION (ABSOLUTE TOLERANCE)
  // ════════════════════════════════════════════════════════════════

  describe('Amount Verification — UGX (±1 UGX tolerance)', () => {
    it('ACCEPTS exact match: 185,000 → 185,000', async () => {
      mockPrisma.settlementSession.findFirst.mockResolvedValue(baseUgxSession);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn({
        settlementSession: mockPrisma.settlementSession,
        settlementEvent: mockPrisma.settlementEvent,
      }));
      mockPrisma.settlementSession.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.settlementSession.findUnique.mockResolvedValue({
        ...baseUgxSession, status: SettlementStatus.COMPLETED,
      });

      mockPesapalClient.getTransactionStatus.mockResolvedValue({
        status_code: 1, payment_status_description: 'Completed',
        amount: 185000, currency: 'UGX',
        merchant_reference: 'PSP-UGX-1', order_tracking_id: 'trk_ugx_1',
      });

      const result = await provider.handleIpn('trk_ugx_1', 'PSP-UGX-1');
      expect(result.status).toBe(SettlementStatus.COMPLETED);
    });

    it('ACCEPTS within tolerance: 185,000 → 184,999 (1 UGX difference)', async () => {
      mockPrisma.settlementSession.findFirst.mockResolvedValue(baseUgxSession);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn({
        settlementSession: mockPrisma.settlementSession,
        settlementEvent: mockPrisma.settlementEvent,
      }));
      mockPrisma.settlementSession.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.settlementSession.findUnique.mockResolvedValue({
        ...baseUgxSession, status: SettlementStatus.COMPLETED,
      });

      mockPesapalClient.getTransactionStatus.mockResolvedValue({
        status_code: 1, payment_status_description: 'Completed',
        amount: 184999, currency: 'UGX', // 1 UGX less = within tolerance
        merchant_reference: 'PSP-UGX-1', order_tracking_id: 'trk_ugx_1',
      });

      const result = await provider.handleIpn('trk_ugx_1', 'PSP-UGX-1');
      expect(result.status).toBe(SettlementStatus.COMPLETED);
    });

    it('REJECTS material underpayment: 185,000 → 184,000 (1,000 UGX difference)', async () => {
      mockPrisma.settlementSession.findFirst.mockResolvedValue(baseUgxSession);
      mockPrisma.settlementSession.findUnique.mockResolvedValue({
        ...baseUgxSession, status: SettlementStatus.VERIFYING,
      });

      mockPesapalClient.getTransactionStatus.mockResolvedValue({
        status_code: 1, payment_status_description: 'Completed',
        amount: 184000, currency: 'UGX', // 1,000 UGX less
        merchant_reference: 'PSP-UGX-1', order_tracking_id: 'trk_ugx_1',
      });

      const result = await provider.handleIpn('trk_ugx_1', 'PSP-UGX-1');
      expect(mockOrchestrator.requestOperation).not.toHaveBeenCalled();
      expect(result.status).toBe(SettlementStatus.VERIFYING);
    });

    it('REJECTS ~1% underpayment: 185,000 → 183,150 (1,850 UGX = ~1%)', async () => {
      mockPrisma.settlementSession.findFirst.mockResolvedValue(baseUgxSession);
      mockPrisma.settlementSession.findUnique.mockResolvedValue({
        ...baseUgxSession, status: SettlementStatus.VERIFYING,
      });

      mockPesapalClient.getTransactionStatus.mockResolvedValue({
        status_code: 1, payment_status_description: 'Completed',
        amount: 183150, currency: 'UGX', // 1,850 UGX less = ~1%
        merchant_reference: 'PSP-UGX-1', order_tracking_id: 'trk_ugx_1',
      });

      const result = await provider.handleIpn('trk_ugx_1', 'PSP-UGX-1');
      expect(mockOrchestrator.requestOperation).not.toHaveBeenCalled();
      expect(result.status).toBe(SettlementStatus.VERIFYING);
    });

    it('REJECTS massive underpayment: 185,000 → 100,000', async () => {
      mockPrisma.settlementSession.findFirst.mockResolvedValue(baseUgxSession);
      mockPrisma.settlementSession.findUnique.mockResolvedValue({
        ...baseUgxSession, status: SettlementStatus.VERIFYING,
      });

      mockPesapalClient.getTransactionStatus.mockResolvedValue({
        status_code: 1, payment_status_description: 'Completed',
        amount: 100000, currency: 'UGX', // 85,000 UGX short
        merchant_reference: 'PSP-UGX-1', order_tracking_id: 'trk_ugx_1',
      });

      const result = await provider.handleIpn('trk_ugx_1', 'PSP-UGX-1');
      expect(mockOrchestrator.requestOperation).not.toHaveBeenCalled();
    });
  });

  describe('Amount Verification — USD (±0.01 tolerance)', () => {
    const baseUsdSession = {
      ...baseUgxSession,
      id: 'sess_usd_1',
      referenceCode: 'PSP-USD-1',
      exchangeRate: new Prisma.Decimal('1'),
      country: 'US',
      providerMetadata: {
        paymentCurrency: 'USD',
        paymentAmount: 50,
        orderTrackingId: 'trk_usd_1',
      },
    };

    it('ACCEPTS exact USD match: 50.00 → 50.00', async () => {
      mockPrisma.settlementSession.findFirst.mockResolvedValue(baseUsdSession);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn({
        settlementSession: mockPrisma.settlementSession,
        settlementEvent: mockPrisma.settlementEvent,
      }));
      mockPrisma.settlementSession.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.settlementSession.findUnique.mockResolvedValue({
        ...baseUsdSession, status: SettlementStatus.COMPLETED,
      });

      mockPesapalClient.getTransactionStatus.mockResolvedValue({
        status_code: 1, payment_status_description: 'Completed',
        amount: 50.00, currency: 'USD',
        merchant_reference: 'PSP-USD-1', order_tracking_id: 'trk_usd_1',
      });

      const result = await provider.handleIpn('trk_usd_1', 'PSP-USD-1');
      expect(result.status).toBe(SettlementStatus.COMPLETED);
    });

    it('ACCEPTS cent-level rounding: 50.00 → 49.99', async () => {
      mockPrisma.settlementSession.findFirst.mockResolvedValue(baseUsdSession);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn({
        settlementSession: mockPrisma.settlementSession,
        settlementEvent: mockPrisma.settlementEvent,
      }));
      mockPrisma.settlementSession.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.settlementSession.findUnique.mockResolvedValue({
        ...baseUsdSession, status: SettlementStatus.COMPLETED,
      });

      mockPesapalClient.getTransactionStatus.mockResolvedValue({
        status_code: 1, payment_status_description: 'Completed',
        amount: 49.99, currency: 'USD', // 1 cent difference
        merchant_reference: 'PSP-USD-1', order_tracking_id: 'trk_usd_1',
      });

      const result = await provider.handleIpn('trk_usd_1', 'PSP-USD-1');
      expect(result.status).toBe(SettlementStatus.COMPLETED);
    });

    it('REJECTS USD underpayment beyond tolerance: 50.00 → 49.50', async () => {
      mockPrisma.settlementSession.findFirst.mockResolvedValue(baseUsdSession);
      mockPrisma.settlementSession.findUnique.mockResolvedValue({
        ...baseUsdSession, status: SettlementStatus.VERIFYING,
      });

      mockPesapalClient.getTransactionStatus.mockResolvedValue({
        status_code: 1, payment_status_description: 'Completed',
        amount: 49.50, currency: 'USD', // 50 cents short
        merchant_reference: 'PSP-USD-1', order_tracking_id: 'trk_usd_1',
      });

      const result = await provider.handleIpn('trk_usd_1', 'PSP-USD-1');
      expect(mockOrchestrator.requestOperation).not.toHaveBeenCalled();
    });
  });

  // ════════════════════════════════════════════════════════════════
  // CATEGORY 4: ATOMICITY FAILURE-INJECTION
  // ════════════════════════════════════════════════════════════════

  describe('Atomicity Failure-Injection', () => {
    it('rolls back COMPLETED status when ledger posting fails inside $transaction', async () => {
      mockPrisma.settlementSession.findFirst.mockResolvedValue(baseUgxSession);

      mockPrisma.$transaction.mockRejectedValueOnce(
        new Error('LEDGER_POSTING_FAILED: simulated failure'),
      );

      mockPesapalClient.getTransactionStatus.mockResolvedValue({
        status_code: 1, payment_status_description: 'Completed',
        amount: 185000, currency: 'UGX',
        merchant_reference: 'PSP-UGX-1', order_tracking_id: 'trk_ugx_1',
      });

      mockPrisma.settlementSession.findUnique.mockResolvedValue({
        ...baseUgxSession, status: SettlementStatus.WAITING_FOR_PAYMENT,
      });

      try {
        await provider.handleIpn('trk_ugx_1', 'PSP-UGX-1');
      } catch (err: any) {
        expect(err.message).toContain('LEDGER_POSTING_FAILED');
      }

      expect(mockOrchestrator.requestOperation).not.toHaveBeenCalled();
    });

    it('retry after failure succeeds — exactly one ledger credit', async () => {
      mockPrisma.settlementSession.findFirst.mockResolvedValue(baseUgxSession);

      mockPrisma.$transaction.mockRejectedValueOnce(
        new Error('LEDGER_POSTING_FAILED'),
      );

      mockPesapalClient.getTransactionStatus.mockResolvedValue({
        status_code: 1, payment_status_description: 'Completed',
        amount: 185000, currency: 'UGX',
        merchant_reference: 'PSP-UGX-1', order_tracking_id: 'trk_ugx_1',
      });

      try {
        await provider.handleIpn('trk_ugx_1', 'PSP-UGX-1');
      } catch (err: any) {
        expect(err.message).toContain('LEDGER_POSTING_FAILED');
      }

      mockPrisma.settlementSession.findFirst.mockResolvedValue({
        ...baseUgxSession, status: SettlementStatus.WAITING_FOR_PAYMENT,
      });

      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn({
        settlementSession: mockPrisma.settlementSession,
        settlementEvent: mockPrisma.settlementEvent,
      }));
      mockPrisma.settlementSession.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.settlementSession.findUnique.mockResolvedValue({
        ...baseUgxSession, status: SettlementStatus.COMPLETED,
      });

      const result = await provider.handleIpn('trk_ugx_1', 'PSP-UGX-1');

      expect(result.status).toBe(SettlementStatus.COMPLETED);
      expect(mockOrchestrator.requestOperation).toHaveBeenCalledTimes(1);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // CATEGORY 5: CONCURRENCY — TWO SIMULTANEOUS CALLBACKS
  // ════════════════════════════════════════════════════════════════

  describe('Concurrency — Two Simultaneous Valid Callbacks', () => {
    it('only one of two concurrent valid callbacks produces a ledger credit', async () => {
      mockPrisma.settlementSession.findFirst.mockResolvedValue(baseUgxSession);

      mockPesapalClient.getTransactionStatus.mockResolvedValue({
        status_code: 1, payment_status_description: 'Completed',
        amount: 185000, currency: 'UGX',
        merchant_reference: 'PSP-UGX-1', order_tracking_id: 'trk_ugx_1',
      });

      let transactionCallCount = 0;

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        transactionCallCount++;
        const mockTx = {
          settlementSession: {
            ...mockPrisma.settlementSession,
            updateMany: jest.fn().mockResolvedValue(
              transactionCallCount === 1 ? { count: 1 } : { count: 0 },
            ),
          },
          settlementEvent: mockPrisma.settlementEvent,
        };
        return fn(mockTx);
      });

      mockPrisma.settlementSession.findUnique.mockResolvedValue({
        ...baseUgxSession, status: SettlementStatus.COMPLETED,
      });

      const [result1, result2] = await Promise.all([
        provider.handleIpn('trk_ugx_1', 'PSP-UGX-1'),
        provider.handleIpn('trk_ugx_1', 'PSP-UGX-1'),
      ]);

      expect(mockOrchestrator.requestOperation).toHaveBeenCalledTimes(1);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // CATEGORY 6: UNDERPAYMENT PROTECTION
  // ════════════════════════════════════════════════════════════════

  describe('Underpayment Protection', () => {
    it('does NOT convert material underpayment into full settlement', async () => {
      mockPrisma.settlementSession.findFirst.mockResolvedValue(baseUgxSession);
      mockPrisma.settlementSession.findUnique.mockResolvedValue({
        ...baseUgxSession, status: SettlementStatus.VERIFYING,
      });

      mockPesapalClient.getTransactionStatus.mockResolvedValue({
        status_code: 1, payment_status_description: 'Completed',
        amount: 170000, currency: 'UGX', // 15,000 UGX short
        merchant_reference: 'PSP-UGX-1', order_tracking_id: 'trk_ugx_1',
      });

      const result = await provider.handleIpn('trk_ugx_1', 'PSP-UGX-1');

      expect(mockOrchestrator.requestOperation).not.toHaveBeenCalled();
      expect(result.status).toBe(SettlementStatus.VERIFYING);
    });

    it('does NOT accept overpayment beyond tolerance either', async () => {
      mockPrisma.settlementSession.findFirst.mockResolvedValue(baseUgxSession);
      mockPrisma.settlementSession.findUnique.mockResolvedValue({
        ...baseUgxSession, status: SettlementStatus.VERIFYING,
      });

      mockPesapalClient.getTransactionStatus.mockResolvedValue({
        status_code: 1, payment_status_description: 'Completed',
        amount: 200000, currency: 'UGX', // 15,000 UGX over
        merchant_reference: 'PSP-UGX-1', order_tracking_id: 'trk_ugx_1',
      });

      const result = await provider.handleIpn('trk_ugx_1', 'PSP-UGX-1');

      expect(mockOrchestrator.requestOperation).not.toHaveBeenCalled();
      expect(result.status).toBe(SettlementStatus.VERIFYING);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // CATEGORY 7: PAYMENT VERIFICATION HARDENING (END-TO-END)
  // ════════════════════════════════════════════════════════════════

  describe('Payment Verification Hardening — Full Valid Payment', () => {
    it('accepts valid complete payment and credits exactly once', async () => {
      mockPrisma.settlementSession.findFirst.mockResolvedValue(baseUgxSession);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn({
        settlementSession: mockPrisma.settlementSession,
        settlementEvent: mockPrisma.settlementEvent,
      }));
      mockPrisma.settlementSession.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.settlementSession.findUnique.mockResolvedValue({
        ...baseUgxSession, status: SettlementStatus.COMPLETED,
      });

      mockPesapalClient.getTransactionStatus.mockResolvedValue({
        status_code: 1,
        payment_status_description: 'Completed',
        amount: 185000,
        currency: 'UGX',
        merchant_reference: 'PSP-UGX-1',
        order_tracking_id: 'trk_ugx_1',
      });

      const result = await provider.handleIpn('trk_ugx_1', 'PSP-UGX-1');

      expect(result.status).toBe(SettlementStatus.COMPLETED);
      expect(mockOrchestrator.requestOperation).toHaveBeenCalledTimes(1);
      expect(mockOrchestrator.requestOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          telegramUserId: BigInt(12345),
          operationType: 'SYSTEM_ALLOCATION',
          assetCode: 'USDT',
          amount: '50',
          idempotencyKey: 'pesapal_settlement_sess_ugx_1',
        }),
        expect.anything(),
      );
    });

    it('status_code=1 alone does NOT authorize credit when financial data is missing', async () => {
      mockPrisma.settlementSession.findFirst.mockResolvedValue(baseUgxSession);
      mockPrisma.settlementSession.findUnique.mockResolvedValue({
        ...baseUgxSession, status: SettlementStatus.VERIFYING,
      });

      mockPesapalClient.getTransactionStatus.mockResolvedValue({
        status_code: 1,
        payment_status_description: 'Completed',
        merchant_reference: 'PSP-UGX-1',
        order_tracking_id: 'trk_ugx_1',
      });

      const result = await provider.handleIpn('trk_ugx_1', 'PSP-UGX-1');

      expect(mockOrchestrator.requestOperation).not.toHaveBeenCalled();
      expect(result.status).toBe(SettlementStatus.VERIFYING);
    });
  });
});
