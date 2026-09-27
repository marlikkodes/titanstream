import { Test, TestingModule } from '@nestjs/testing';
import { PremiumService } from './premium.service';
import { PrismaService } from '../../database/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PremiumTier } from '@prisma/client';

describe('PremiumService - $1,000 Premium Gate Enforcement', () => {
  let service: PremiumService;
  let prisma: PrismaService;

  const mockPrisma = {
    userPremiumEntitlement: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const createDecimalMock = (value: number) => ({
    toNumber: () => value,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PremiumService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<PremiumService>(PremiumService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('premium access enforcement', () => {
    it('should return false for users without premium entitlement', async () => {
      const telegramUserId = BigInt(123456789);

      mockPrisma.userPremiumEntitlement.findUnique.mockResolvedValue(null);

      const hasAccess = await service.hasPremiumAccess(telegramUserId);

      expect(hasAccess).toBe(false);
    });

    it('should return false for users with STANDARD tier', async () => {
      const telegramUserId = BigInt(123456789);

      mockPrisma.userPremiumEntitlement.findUnique.mockResolvedValue({
        telegramUserId,
        tier: PremiumTier.STANDARD,
        unlockedAt: null,
      });

      const hasAccess = await service.hasPremiumAccess(telegramUserId);

      expect(hasAccess).toBe(false);
    });

    it('should return true for users with PREMIUM tier and unlock date', async () => {
      const telegramUserId = BigInt(123456789);

      mockPrisma.userPremiumEntitlement.findUnique.mockResolvedValue({
        telegramUserId,
        tier: PremiumTier.PREMIUM,
        requiredAmount: createDecimalMock(1000.0),
        totalLifetimePayment: createDecimalMock(1200.0),
        lastPaymentAmount: createDecimalMock(0.0),
        unlockedAt: new Date(),
      });

      const hasAccess = await service.hasPremiumAccess(telegramUserId);

      expect(hasAccess).toBe(true);
    });

    it('should throw error when asserting premium access without entitlement', async () => {
      const telegramUserId = BigInt(123456789);

      mockPrisma.userPremiumEntitlement.findUnique.mockResolvedValue({
        telegramUserId,
        tier: PremiumTier.STANDARD,
        requiredAmount: createDecimalMock(1000.0),
        totalLifetimePayment: createDecimalMock(0.0),
        lastPaymentAmount: createDecimalMock(0.0),
        unlockedAt: null,
      });

      await expect(
        service.assertPremiumAccess(telegramUserId, 'test operation')
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.assertPremiumAccess(telegramUserId, 'test operation')
      ).rejects.toThrow('Premium access required');
    });
  });

  describe('payment processing for premium unlock', () => {
    it('should unlock premium when threshold is reached', async () => {
      const telegramUserId = BigInt(123456789);
      const paymentReference = 'PAY-TEST-123';

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        // Simulate existing entitlement below threshold
        mockPrisma.userPremiumEntitlement.findUnique.mockResolvedValue({
          telegramUserId,
          tier: PremiumTier.STANDARD,
          requiredAmount: createDecimalMock(1000.0),
          totalLifetimePayment: createDecimalMock(800.0),
          lastPaymentAmount: createDecimalMock(0.0),
          unlockedAt: null,
        });

        // Simulate update after payment
        mockPrisma.userPremiumEntitlement.update.mockResolvedValue({
          telegramUserId,
          tier: PremiumTier.PREMIUM,
          requiredAmount: createDecimalMock(1000.0),
          totalLifetimePayment: createDecimalMock(1200.0),
          lastPaymentAmount: createDecimalMock(400.0),
          unlockedAt: new Date(),
          unlockedByPaymentReference: paymentReference,
        });

        return callback(mockPrisma);
      });

      const result = await service.processPaymentForPremium(
        telegramUserId,
        400.0,
        paymentReference
      );

      expect(result.unlocked).toBe(true);
      expect(result.tier).toBe(PremiumTier.PREMIUM);
    });

    it('should not unlock premium when threshold is not reached', async () => {
      const telegramUserId = BigInt(123456789);
      const paymentReference = 'PAY-TEST-123';

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        mockPrisma.userPremiumEntitlement.findUnique.mockResolvedValue({
          telegramUserId,
          tier: PremiumTier.STANDARD,
          requiredAmount: createDecimalMock(1000.0),
          totalLifetimePayment: createDecimalMock(500.0),
          lastPaymentAmount: createDecimalMock(0.0),
          unlockedAt: null,
        });

        mockPrisma.userPremiumEntitlement.update.mockResolvedValue({
          telegramUserId,
          tier: PremiumTier.STANDARD,
          requiredAmount: createDecimalMock(1000.0),
          totalLifetimePayment: createDecimalMock(700.0),
          lastPaymentAmount: createDecimalMock(200.0),
          unlockedAt: null,
        });

        return callback(mockPrisma);
      });

      const result = await service.processPaymentForPremium(
        telegramUserId,
        200.0,
        paymentReference
      );

      expect(result.unlocked).toBe(false);
      expect(result.tier).toBe(PremiumTier.STANDARD);
    });

    it('should create new entitlement record for first-time users', async () => {
      const telegramUserId = BigInt(123456789);
      const paymentReference = 'PAY-TEST-123';

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        mockPrisma.userPremiumEntitlement.findUnique.mockResolvedValue(null);

        mockPrisma.userPremiumEntitlement.create.mockResolvedValue({
          telegramUserId,
          tier: PremiumTier.STANDARD,
          requiredAmount: createDecimalMock(1000.0),
          totalLifetimePayment: createDecimalMock(200.0),
          lastPaymentAmount: createDecimalMock(200.0),
          unlockedAt: null,
        });

        return callback(mockPrisma);
      });

      const result = await service.processPaymentForPremium(
        telegramUserId,
        200.0,
        paymentReference
      );

      expect(mockPrisma.userPremiumEntitlement.create).toHaveBeenCalled();
      expect(result.unlocked).toBe(false);
    });
  });

  describe('admin premium management', () => {
    it('should grant premium access for admin', async () => {
      const telegramUserId = BigInt(123456789);
      const adminReason = 'Manual grant for testing';

      mockPrisma.userPremiumEntitlement.upsert.mockResolvedValue({
        telegramUserId,
        tier: PremiumTier.PREMIUM,
        unlockedAt: new Date(),
      });

      await service.grantPremium(telegramUserId, adminReason);

      expect(mockPrisma.userPremiumEntitlement.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            tier: PremiumTier.PREMIUM,
            unlockedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should revoke premium access for admin', async () => {
      const telegramUserId = BigInt(123456789);
      const adminReason = 'Manual revoke for policy violation';

      mockPrisma.userPremiumEntitlement.update.mockResolvedValue({
        telegramUserId,
        tier: PremiumTier.STANDARD,
        unlockedAt: null,
      });

      await service.revokePremium(telegramUserId, adminReason);

      expect(mockPrisma.userPremiumEntitlement.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { telegramUserId },
          data: expect.objectContaining({
            tier: PremiumTier.STANDARD,
            unlockedAt: null,
          }),
        })
      );
    });
  });
});
