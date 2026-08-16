import { Test, TestingModule } from '@nestjs/testing';
import { SettlementProviderId, SettlementStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { FinancialOrchestratorService } from '../../financial-orchestration/financial-orchestrator.service';
import { ProviderEventService } from '../provider-event.service';
import { SettlementRiskService } from '../settlement-risk.service';
import { ExchangeRateService } from '../../financial/exchange-rate.service';
import { PesapalClient } from './pesapal.client';
import { PesapalController } from './pesapal.controller';
import { PesapalProvider } from './pesapal.provider';

describe('Pesapal End-to-End Integration Flow', () => {
  let provider: PesapalProvider;
  let controller: PesapalController;
  let mockPrisma: any;
  let mockOrchestrator: any;
  let mockPesapalClient: any;

  beforeEach(async () => {
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

    mockOrchestrator = {
      requestOperation: jest.fn().mockResolvedValue({ id: 'op_e2e_1' }),
    };

    mockPesapalClient = {
      isConfigured: jest.fn().mockReturnValue(true),
      getDiagnostics: jest.fn().mockReturnValue({ configured: true, environment: 'sandbox' }),
      submitOrder: jest.fn().mockResolvedValue({
        order_tracking_id: 'order_trk_e2e',
        merchant_reference: 'PSP-E2E-1',
        redirect_url: 'https://cyb3r.pesapal.com/pesapalv3/checkout',
        status: '200',
      }),
      getTransactionStatus: jest.fn().mockResolvedValue({
        status_code: 1,
        payment_status_description: 'Completed',
        amount: 50,
        currency: 'KES',
        merchant_reference: 'PSP-E2E-1',
        order_tracking_id: 'order_trk_e2e',
      }),
      getIpnId: jest.fn().mockResolvedValue('ipn_e2e_uuid'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PesapalController],
      providers: [
        PesapalProvider,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FinancialOrchestratorService, useValue: mockOrchestrator },
        { provide: PesapalClient, useValue: mockPesapalClient },
        { provide: ProviderEventService, useValue: { emit: jest.fn().mockResolvedValue(true) } },
        { provide: SettlementRiskService, useValue: { evaluateUserRisk: jest.fn().mockResolvedValue({ allowed: true, requiresManualReview: false }), assertSessionCreationRisk: jest.fn().mockResolvedValue(undefined) } },
        { provide: ExchangeRateService, useValue: { getRate: jest.fn().mockResolvedValue({ userRate: 1.0, source: 'coingecko' }), lockRateForSettlement: jest.fn().mockResolvedValue({ userRate: 1.0, source: 'coingecko' }) } },
      ],
    }).compile();

    provider = module.get<PesapalProvider>(PesapalProvider);
    controller = module.get<PesapalController>(PesapalController);
  });

  it('completes full end-to-end sandbox flow: Session -> Order Submission -> IPN -> Double-Entry Settlement', async () => {
    const telegramUserId = BigInt(998877);
    const dto = {
      asset: 'USDT',
      requestedAmount: '50',
      expectedCryptoAmount: '50',
      exchangeRate: '1.0',
      country: 'KE',
      mobileMoneyNetwork: 'PESAPAL',
    };

    const fakeSessionInitial = {
      id: 'sess_e2e_1',
      telegramUserId,
      provider: SettlementProviderId.PESAPAL,
      referenceCode: 'PSP-E2E-1',
      asset: 'USDT',
      requestedAmount: '50',
      expectedCryptoAmount: '50',
      exchangeRate: '1.0',
      country: 'KE',
      status: SettlementStatus.WAITING_FOR_PAYMENT,
      expiresAt: new Date(),
      providerMetadata: {},
    };

    const fakeSessionWithOrder = {
      ...fakeSessionInitial,
      providerMetadata: { orderTrackingId: 'order_trk_e2e', redirectUrl: 'https://cyb3r.pesapal.com/pesapalv3/checkout', paymentAmount: 50, paymentCurrency: 'KES' },
    };

    mockPrisma.settlementSession.create.mockResolvedValue(fakeSessionInitial);
    mockPrisma.settlementSession.update.mockResolvedValue(fakeSessionWithOrder);
    mockPrisma.settlementSession.findUnique.mockResolvedValue(fakeSessionWithOrder);

    // Step 1: User creates settlement session
    const createdSession = await provider.createSettlement(telegramUserId, dto);
    expect(createdSession.payUrl).toBe('https://cyb3r.pesapal.com/pesapalv3/checkout');
    expect(createdSession.orderTrackingId).toBe('order_trk_e2e');

    // Step 2: Pesapal sends IPN notification to Controller
    mockPrisma.settlementSession.findFirst.mockResolvedValue(fakeSessionWithOrder);
    mockPrisma.settlementSession.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.settlementSession.findUnique.mockResolvedValue({
      ...fakeSessionWithOrder,
      status: SettlementStatus.COMPLETED,
    });

    const ipnResponse = await controller.handleIpnGet({
      OrderTrackingId: 'order_trk_e2e',
      OrderMerchantReference: 'PSP-E2E-1',
      OrderNotificationType: 'IPNCHANGE',
    });

    expect(ipnResponse.status).toBe('200');
    expect(ipnResponse.resultStatus).toBe(SettlementStatus.COMPLETED);

    // Step 3: Verify double-entry financial orchestrator operation was requested
    expect(mockOrchestrator.requestOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        telegramUserId,
        operationType: 'SYSTEM_ALLOCATION',
        amount: '50',
        idempotencyKey: 'pesapal_settlement_sess_e2e_1',
      }),
      expect.anything(),
    );
  });
});
