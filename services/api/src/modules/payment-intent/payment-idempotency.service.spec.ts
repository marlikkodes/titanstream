import { Test, TestingModule } from '@nestjs/testing';
import { PaymentIdempotencyService } from './payment-idempotency.service';
import { PrismaService } from '../../database/prisma.service';
import { PaymentIntentStatus, FinancialOperationStatus } from '@prisma/client';

describe('PaymentIdempotencyService', () => {
  let service: PaymentIdempotencyService;
  let prisma: PrismaService;

  const mockPrisma = {
    paymentIntent: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    usdtBlockchainTransaction: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    financialOperation: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentIdempotencyService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PaymentIdempotencyService>(PaymentIdempotencyService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('isReferenceUsed', () => {
    it('should return false for unused reference', async () => {
      mockPrisma.paymentIntent.findUnique.mockResolvedValue(null);

      const result = await service.isReferenceUsed('PAY-ABC123');

      expect(result).toBe(false);
    });

    it('should return true for settled payment', async () => {
      mockPrisma.paymentIntent.findUnique.mockResolvedValue({
        reference: 'PAY-ABC123',
        status: PaymentIntentStatus.SETTLED,
      });

      const result = await service.isReferenceUsed('PAY-ABC123');

      expect(result).toBe(true);
    });

    it('should return false for unverified payment', async () => {
      mockPrisma.paymentIntent.findUnique.mockResolvedValue({
        reference: 'PAY-ABC123',
        status: PaymentIntentStatus.AWAITING_PAYMENT,
      });

      const result = await service.isReferenceUsed('PAY-ABC123');

      expect(result).toBe(false);
    });
  });

  describe('isTransactionSettled', () => {
    it('should return false for new transaction', async () => {
      mockPrisma.usdtBlockchainTransaction.findFirst.mockResolvedValue(null);

      const result = await service.isTransactionSettled('tx-123', 'TRON', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');

      expect(result).toBe(false);
    });

    it('should return true for settled transaction', async () => {
      mockPrisma.usdtBlockchainTransaction.findFirst.mockResolvedValue({
        processingStatus: 'SETTLED',
        settlementSessionId: 'pay-123',
      });

      const result = await service.isTransactionSettled('tx-123', 'TRON', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');

      expect(result).toBe(true);
    });
  });

  describe('acquireVerificationLock', () => {
    it('should acquire lock successfully', async () => {
      mockPrisma.paymentIntent.findUnique.mockResolvedValue({
        id: 'pay-123',
        status: PaymentIntentStatus.DETECTED,
        metadata: {},
      });
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      });
      mockPrisma.paymentIntent.update.mockResolvedValue({});

      const result = await service.acquireVerificationLock('pay-123', 'admin-1');

      expect(result).toBe(true);
    });

    it('should reject lock for already verified payment', async () => {
      mockPrisma.paymentIntent.findUnique.mockResolvedValue({
        id: 'pay-123',
        status: PaymentIntentStatus.VERIFIED,
      });

      const result = await service.acquireVerificationLock('pay-123', 'admin-1');

      expect(result).toBe(false);
    });

    it('should reject lock for non-existent payment', async () => {
      mockPrisma.paymentIntent.findUnique.mockResolvedValue(null);

      const result = await service.acquireVerificationLock('pay-123', 'admin-1');

      expect(result).toBe(false);
    });
  });

  describe('hasActivePaymentIntent', () => {
    it('should return true for active payment', async () => {
      mockPrisma.paymentIntent.findFirst.mockResolvedValue({
        id: 'pay-123',
        status: PaymentIntentStatus.AWAITING_PAYMENT,
        expiresAt: new Date(Date.now() + 1000000),
      });

      const result = await service.hasActivePaymentIntent(BigInt(123456));

      expect(result).toBe(true);
    });

    it('should return false for no active payment', async () => {
      mockPrisma.paymentIntent.findFirst.mockResolvedValue(null);

      const result = await service.hasActivePaymentIntent(BigInt(123456));

      expect(result).toBe(false);
    });
  });

  describe('ensureNotSettled', () => {
    it('should pass for unsettled payment', async () => {
      mockPrisma.paymentIntent.findUnique.mockResolvedValue({
        id: 'pay-123',
        status: PaymentIntentStatus.VERIFIED,
      });
      mockPrisma.financialOperation.findFirst.mockResolvedValue(null);

      await expect(service.ensureNotSettled('pay-123')).resolves.not.toThrow();
    });

    it('should throw for settled payment', async () => {
      mockPrisma.paymentIntent.findUnique.mockResolvedValue({
        id: 'pay-123',
        status: PaymentIntentStatus.SETTLED,
      });

      await expect(service.ensureNotSettled('pay-123')).rejects.toThrow('PAYMENT_ALREADY_SETTLED');
    });

    it('should throw for payment with existing financial operation', async () => {
      mockPrisma.paymentIntent.findUnique.mockResolvedValue({
        id: 'pay-123',
        status: PaymentIntentStatus.VERIFIED,
      });
      mockPrisma.financialOperation.findFirst.mockResolvedValue({
        status: FinancialOperationStatus.COMPLETED,
      });

      await expect(service.ensureNotSettled('pay-123')).rejects.toThrow('FINANCIAL_OPERATION_ALREADY_EXISTS');
    });
  });

  describe('recoverStuckPayments', () => {
    it('should recover stuck payments', async () => {
      const stuckPayments = [
        {
          id: 'pay-1',
          reference: 'PAY-ABC1',
          status: PaymentIntentStatus.VERIFYING,
          metadata: { processingStartedAt: new Date(Date.now() - 600000).toISOString() },
        },
      ];

      mockPrisma.paymentIntent.findMany.mockResolvedValue(stuckPayments);
      mockPrisma.paymentIntent.update.mockResolvedValue({});

      const result = await service.recoverStuckPayments();

      expect(result.recovered).toBe(1);
      expect(mockPrisma.paymentIntent.update).toHaveBeenCalled();
    });

    it('should return zero for no stuck payments', async () => {
      mockPrisma.paymentIntent.findMany.mockResolvedValue([]);

      const result = await service.recoverStuckPayments();

      expect(result.recovered).toBe(0);
    });
  });
});
