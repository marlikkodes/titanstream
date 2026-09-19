import { Test, TestingModule } from '@nestjs/testing';
import { PaymentIntentService } from './payment-intent.service';
import { PrismaService } from '../../database/prisma.service';
import { FinancialOrchestratorService } from '../financial-orchestration/financial-orchestrator.service';
import { ExchangeRateService } from '../financial/exchange-rate.service';
import { NotificationService } from '../notification/notification.service';
import { AuditService } from '../audit/audit.service';
import { PaymentIdempotencyService } from './payment-idempotency.service';
import { AdminFourEyesService } from './admin-four-eyes.service';
import { PaymentIntentStatus, PaymentMethod, AuditEventType } from '@prisma/client';

describe('PaymentIntentService', () => {
  let service: PaymentIntentService;
  let prisma: PrismaService;
  let orchestrator: FinancialOrchestratorService;
  let idempotency: PaymentIdempotencyService;
  let fourEyes: AdminFourEyesService;

  const mockPrisma = {
    paymentIntent: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    paymentVerification: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
    paymentAttempt: {
      create: jest.fn(),
    },
    usdtConfig: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  const mockOrchestrator = {
    requestOperation: jest.fn(),
  };

  const mockExchangeRate = {
    lockRateForSettlement: jest.fn().mockResolvedValue({ userRate: 1.0 }),
  };

  const mockNotification = {
    createNotification: jest.fn(),
  };

  const mockAudit = {
    create: jest.fn(),
  };

  const mockIdempotency = {
    hasActivePaymentIntent: jest.fn().mockResolvedValue(false),
    acquireVerificationLock: jest.fn().mockResolvedValue(true),
    releaseVerificationLock: jest.fn(),
    ensureNotSettled: jest.fn(),
  };

  const mockFourEyes = {
    validateAdminAction: jest.fn().mockResolvedValue(true),
    canApprovePayment: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentIntentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FinancialOrchestratorService, useValue: mockOrchestrator },
        { provide: ExchangeRateService, useValue: mockExchangeRate },
        { provide: NotificationService, useValue: mockNotification },
        { provide: AuditService, useValue: mockAudit },
        { provide: PaymentIdempotencyService, useValue: mockIdempotency },
        { provide: AdminFourEyesService, useValue: mockFourEyes },
      ],
    }).compile();

    service = module.get<PaymentIntentService>(PaymentIntentService);
    prisma = module.get<PrismaService>(PrismaService);
    orchestrator = module.get<FinancialOrchestratorService>(FinancialOrchestratorService);
    idempotency = module.get<PaymentIdempotencyService>(PaymentIdempotencyService);
    fourEyes = module.get<AdminFourEyesService>(AdminFourEyesService);

    jest.clearAllMocks();
  });

  describe('createPaymentIntent', () => {
    it('should create a payment intent successfully', async () => {
      const dto = {
        telegramUserId: BigInt(123456),
        paymentMethod: PaymentMethod.USDT_TRC20,
        requestedAmount: 100,
        currency: 'USDT',
      };

      mockPrisma.paymentIntent.findFirst.mockResolvedValue(null);
      mockPrisma.usdtConfig.findUnique.mockResolvedValue({
        receivingAddress: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
      });
      const createdIntent = {
        id: 'pay-123',
        reference: 'PAY-ABC123',
        status: PaymentIntentStatus.CREATED,
        paymentMethod: PaymentMethod.USDT_TRC20,
        requestedAmount: 100,
        expectedCryptoAmount: 100,
        currency: 'USDT',
        usdtAddress: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
        expiresAt: new Date(),
        idempotencyKey: 'pay_intent_123456_123',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.paymentIntent.create.mockResolvedValue(createdIntent);
      mockPrisma.paymentIntent.findUnique.mockResolvedValue(createdIntent);
      mockPrisma.paymentIntent.update.mockResolvedValue({
        ...createdIntent,
        status: PaymentIntentStatus.AWAITING_PAYMENT,
      });

      const result = await service.createPaymentIntent(dto);

      expect(result).toBeDefined();
      expect(result.status).toBe(PaymentIntentStatus.AWAITING_PAYMENT);
      expect(mockPrisma.paymentIntent.create).toHaveBeenCalled();
      expect(mockPrisma.paymentIntent.update).toHaveBeenCalled();
    });

    it('should reject duplicate active payment intents', async () => {
      const dto = {
        telegramUserId: BigInt(123456),
        paymentMethod: PaymentMethod.USDT_TRC20,
        requestedAmount: 100,
      };

      mockIdempotency.hasActivePaymentIntent.mockResolvedValue(true);

      await expect(service.createPaymentIntent(dto)).rejects.toThrow('ACTIVE_PAYMENT_INTENT_EXISTS');
    });

    it('should reject if USDT receiving address not configured', async () => {
      const dto = {
        telegramUserId: BigInt(123456),
        paymentMethod: PaymentMethod.USDT_TRC20,
        requestedAmount: 100,
      };

      mockIdempotency.hasActivePaymentIntent.mockResolvedValue(false);
      mockPrisma.usdtConfig.findUnique.mockResolvedValue(null);

      await expect(service.createPaymentIntent(dto)).rejects.toThrow('USDT_RECEIVING_ADDRESS_NOT_CONFIGURED');
    });
  });

  describe('verifyPaymentIntent', () => {
    it('should verify payment intent successfully', async () => {
      const paymentIntentId = 'pay-123';
      const adminId = 'admin-1';
      const adminEmail = 'admin@tetherstream.com';

      mockPrisma.paymentIntent.findUnique.mockResolvedValue({
        id: paymentIntentId,
        telegramUserId: BigInt(123456),
        reference: 'PAY-ABC123',
        status: PaymentIntentStatus.VERIFYING,
        requestedAmount: 100,
        currency: 'USDT',
        asset: 'USDT',
        expectedCryptoAmount: 100,
        exchangeRate: 1,
        expiresAt: new Date(),
        createdAt: new Date(),
      });
      mockPrisma.paymentVerification.upsert.mockResolvedValue({});
      mockPrisma.paymentIntent.update.mockResolvedValue({
        id: paymentIntentId,
        status: PaymentIntentStatus.VERIFIED,
        requestedAmount: 100,
        currency: 'USDT',
        asset: 'USDT',
        expectedCryptoAmount: 100,
        exchangeRate: 1,
        expiresAt: new Date(),
        createdAt: new Date(),
      });

      const result = await service.verifyPaymentIntent(
        paymentIntentId,
        adminId,
        adminEmail,
        100,
        'USDT',
      );

      expect(result.status).toBe(PaymentIntentStatus.VERIFIED);
      expect(mockPrisma.paymentVerification.upsert).toHaveBeenCalled();
      expect(fourEyes.validateAdminAction).toHaveBeenCalledWith(adminId, 'APPROVE');
      expect(fourEyes.canApprovePayment).toHaveBeenCalledWith(adminId, paymentIntentId);
    });

    it('should reject self-approval (four-eyes violation)', async () => {
      const paymentIntentId = 'pay-123';
      const adminId = 'admin-1';
      const adminEmail = 'admin@tetherstream.com';

      mockPrisma.paymentIntent.findUnique.mockResolvedValue({
        id: paymentIntentId,
        telegramUserId: BigInt(123456),
        reference: 'PAY-ABC123',
        status: PaymentIntentStatus.DETECTED,
        requestedAmount: 100,
        currency: 'USDT',
      });
      mockFourEyes.canApprovePayment.mockResolvedValue(false);

      await expect(
        service.verifyPaymentIntent(paymentIntentId, adminId, adminEmail, 100, 'USDT'),
      ).rejects.toThrow('FOUR_EYES_VIOLATION');
    });

    it('should reject amount mismatch', async () => {
      const paymentIntentId = 'pay-123';
      const adminId = 'admin-1';
      const adminEmail = 'admin@tetherstream.com';

      mockPrisma.paymentIntent.findUnique.mockResolvedValue({
        id: paymentIntentId,
        telegramUserId: BigInt(123456),
        reference: 'PAY-ABC123',
        status: PaymentIntentStatus.DETECTED,
        requestedAmount: 100,
        currency: 'USDT',
      });
      mockFourEyes.canApprovePayment.mockResolvedValue(true);
      mockIdempotency.acquireVerificationLock.mockResolvedValue(true);

      await expect(
        service.verifyPaymentIntent(paymentIntentId, adminId, adminEmail, 95, 'USDT'),
      ).rejects.toThrow('AMOUNT_MISMATCH');
    });

    it('should reject verification lock conflict', async () => {
      const paymentIntentId = 'pay-123';
      const adminId = 'admin-1';
      const adminEmail = 'admin@tetherstream.com';

      mockPrisma.paymentIntent.findUnique.mockResolvedValue({
        id: paymentIntentId,
        telegramUserId: BigInt(123456),
        reference: 'PAY-ABC123',
        status: PaymentIntentStatus.DETECTED,
        requestedAmount: 100,
        currency: 'USDT',
      });
      mockFourEyes.canApprovePayment.mockResolvedValue(true);
      mockIdempotency.acquireVerificationLock.mockResolvedValue(false);

      await expect(
        service.verifyPaymentIntent(paymentIntentId, adminId, adminEmail, 100, 'USDT'),
      ).rejects.toThrow('VERIFICATION_LOCK_FAILED');
    });
  });

  describe('settlePaymentIntent', () => {
    it('should settle payment through FinancialOrchestrator', async () => {
      const paymentIntentId = 'pay-123';

      mockPrisma.paymentIntent.findUnique.mockResolvedValue({
        id: paymentIntentId,
        telegramUserId: BigInt(123456),
        reference: 'PAY-ABC123',
        status: PaymentIntentStatus.VERIFIED,
        asset: 'USDT',
        expectedCryptoAmount: 100,
        currency: 'USDT',
        expiresAt: new Date(),
        createdAt: new Date(),
      });
      mockPrisma.paymentIntent.update.mockResolvedValueOnce({
        id: paymentIntentId,
        status: PaymentIntentStatus.SETTLEMENT_PENDING,
        expiresAt: new Date(),
        createdAt: new Date(),
      }).mockResolvedValueOnce({
        id: paymentIntentId,
        status: PaymentIntentStatus.SETTLED,
        expiresAt: new Date(),
        createdAt: new Date(),
      });
      mockOrchestrator.requestOperation.mockResolvedValue({});

      const result = await service.settlePaymentIntent(paymentIntentId);

      expect(result.status).toBe(PaymentIntentStatus.SETTLED);
      expect(mockOrchestrator.requestOperation).toHaveBeenCalledWith({
        telegramUserId: BigInt(123456),
        operationType: 'SYSTEM_ALLOCATION',
        assetCode: 'USDT',
        amount: '100',
        idempotencyKey: expect.stringContaining('pay_settle_'),
        reference: expect.stringContaining('pay_settle_'),
        metadata: expect.objectContaining({
          source: 'payment_intent_settlement',
          paymentIntentId,
        }),
      });
    });

    it('should reject settlement from non-verified status', async () => {
      const paymentIntentId = 'pay-123';

      mockPrisma.paymentIntent.findUnique.mockResolvedValue({
        id: paymentIntentId,
        status: PaymentIntentStatus.DETECTED,
      });

      await expect(service.settlePaymentIntent(paymentIntentId)).rejects.toThrow('INVALID_STATE_TRANSITION');
    });
  });

  describe('rejectPaymentIntent', () => {
    it('should reject payment intent successfully', async () => {
      const paymentIntentId = 'pay-123';
      const adminId = 'admin-1';
      const adminEmail = 'admin@tetherstream.com';

      mockPrisma.paymentIntent.findUnique.mockResolvedValue({
        id: paymentIntentId,
        telegramUserId: BigInt(123456),
        reference: 'PAY-ABC123',
        status: PaymentIntentStatus.VERIFYING,
        requestedAmount: 100,
        currency: 'USDT',
        asset: 'USDT',
        expectedCryptoAmount: 100,
        exchangeRate: 1,
        expiresAt: new Date(),
        createdAt: new Date(),
      });
      mockPrisma.paymentVerification.upsert.mockResolvedValue({});
      mockPrisma.paymentIntent.update.mockResolvedValue({
        id: paymentIntentId,
        status: PaymentIntentStatus.REJECTED,
        requestedAmount: 100,
        currency: 'USDT',
        asset: 'USDT',
        expectedCryptoAmount: 100,
        exchangeRate: 1,
        expiresAt: new Date(),
        createdAt: new Date(),
      });

      const result = await service.rejectPaymentIntent(
        paymentIntentId,
        adminId,
        adminEmail,
        'Test rejection',
      );

      expect(result.status).toBe(PaymentIntentStatus.REJECTED);
      expect(mockPrisma.paymentVerification.upsert).toHaveBeenCalled();
    });

    it('should reject if payment already settled', async () => {
      const paymentIntentId = 'pay-123';

      mockPrisma.paymentIntent.findUnique.mockResolvedValue({
        id: paymentIntentId,
        status: PaymentIntentStatus.SETTLED,
      });

      await expect(
        service.rejectPaymentIntent(paymentIntentId, 'admin-1', 'admin@test.com', 'Reason'),
      ).rejects.toThrow('CANNOT_REJECT_SETTLED_OR_REJECTED_PAYMENT');
    });
  });

  describe('cancelPaymentIntent', () => {
    it('should cancel payment intent successfully', async () => {
      const paymentIntentId = 'pay-123';
      const telegramUserId = BigInt(123456);

      mockPrisma.paymentIntent.findFirst.mockResolvedValue({
        id: paymentIntentId,
        telegramUserId,
        status: PaymentIntentStatus.AWAITING_PAYMENT,
        expiresAt: new Date(),
        createdAt: new Date(),
      });
      mockPrisma.paymentIntent.findUnique.mockResolvedValue({
        id: paymentIntentId,
        telegramUserId,
        status: PaymentIntentStatus.AWAITING_PAYMENT,
        expiresAt: new Date(),
        createdAt: new Date(),
      });
      mockPrisma.paymentIntent.update.mockResolvedValue({
        id: paymentIntentId,
        status: PaymentIntentStatus.CANCELLED,
        expiresAt: new Date(),
        createdAt: new Date(),
      });

      const result = await service.cancelPaymentIntent(paymentIntentId, telegramUserId);

      expect(result.status).toBe(PaymentIntentStatus.CANCELLED);
    });

    it('should reject cancellation of settled payment', async () => {
      const paymentIntentId = 'pay-123';
      const telegramUserId = BigInt(123456);

      mockPrisma.paymentIntent.findFirst.mockResolvedValue({
        id: paymentIntentId,
        telegramUserId,
        status: PaymentIntentStatus.SETTLED,
      });

      await expect(service.cancelPaymentIntent(paymentIntentId, telegramUserId)).rejects.toThrow(
        'CANNOT_CANCEL_SETTLED_PAYMENT',
      );
    });
  });

  describe('expirePaymentIntents', () => {
    it('should expire old payment intents', async () => {
      const oldIntents = [
        { id: 'pay-1', status: PaymentIntentStatus.AWAITING_PAYMENT },
        { id: 'pay-2', status: PaymentIntentStatus.AWAITING_PAYMENT },
      ];

      mockPrisma.paymentIntent.findMany.mockResolvedValue(oldIntents);
      mockPrisma.paymentIntent.update.mockResolvedValue({});

      const result = await service.expirePaymentIntents();

      expect(result.expired).toBe(2);
      expect(mockPrisma.paymentIntent.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('getPendingPaymentIntents', () => {
    it('should return pending payment intents for admin queue', async () => {
      const pendingIntents = [
        {
          id: 'pay-1',
          reference: 'PAY-ABC123',
          status: PaymentIntentStatus.DETECTED,
          paymentMethod: PaymentMethod.MOBILE_MONEY,
          requestedAmount: 100,
          currency: 'USDT',
          asset: 'USDT',
          country: 'UG',
          network: 'MTN',
          exchangeRate: 3700,
          expectedCryptoAmount: 100,
          expiresAt: new Date(),
          createdAt: new Date(),
          attempts: [],
          verification: null,
        },
      ];

      mockPrisma.paymentIntent.findMany.mockResolvedValue(pendingIntents);

      const result = await service.getPendingPaymentIntents(50, 0);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(PaymentIntentStatus.DETECTED);
    });
  });
});
