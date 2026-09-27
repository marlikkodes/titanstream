import { Test, TestingModule } from '@nestjs/testing';
import { MiningService } from './mining.service';
import { PrismaService } from '../../database/prisma.service';
import { FinancialOrchestratorService } from '../financial-orchestration/financial-orchestrator.service';
import { MachineService } from '../machine/machine.service';
import { BadRequestException } from '@nestjs/common';

describe('MiningService - Trial Limit Enforcement', () => {
  let service: MiningService;
  let prisma: PrismaService;

  const mockPrisma = {
    userMiningState: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
    userMachine: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    financialIdempotencyRecord: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  };

  const mockOrchestrator = {
    requestOperation: jest.fn(),
  };

  const mockMachineService = {
    getUserMachines: jest.fn(),
    getCatalog: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MiningService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: FinancialOrchestratorService,
          useValue: mockOrchestrator,
        },
        {
          provide: MachineService,
          useValue: mockMachineService,
        },
      ],
    }).compile();

    service = module.get<MiningService>(MiningService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('tap with trial limit enforcement', () => {
    it('should enforce trial limit with atomic database transaction', async () => {
      const telegramUserId = '123456789';
      const tgBigInt = BigInt(telegramUserId);

      mockMachineService.getUserMachines.mockResolvedValue([
        { tierCode: 'TS_TRIAL', status: 'ACTIVE', capacityGhs: 1.0 },
      ]);

      mockMachineService.getCatalog.mockReturnValue([
        {
          tierCode: 'TS_TRIAL',
          promoOutputCap: 5.0,
          interactiveBonusCap: 0.10,
          maxMultiplier: 10.1,
          dailyYieldEstimateUsdt: 2.0,
          interactiveBaseRate: 0.0005,
        },
      ]);

      // Mock the transaction to simulate atomic limit check
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        // Simulate locked row data
        const lockedRow = {
          telegram_user_id: tgBigInt,
          active_currency: 'USDT',
          unclaimed_balance: 2.0,
          cooler_multiplier: 1.0,
          lifetime_promotional_output: 4.5, // Below limit
          interactive_promotional_output: 0.08,
          machine_mode: 'PROMOTIONAL',
        };

        mockPrisma.$queryRaw.mockResolvedValue([lockedRow]);
        mockPrisma.userMiningState.update.mockResolvedValue({});
        mockPrisma.financialIdempotencyRecord.create.mockResolvedValue({});
        mockPrisma.userMachine.findFirst.mockResolvedValue({
          id: 'trial-machine-id',
          trialLimitAmount: { toNumber: () => 5.0 },
          trialUsedAmount: { toNumber: () => 4.5 },
        });
        mockPrisma.userMachine.update.mockResolvedValue({});

        return callback(mockPrisma);
      });

      mockPrisma.userMiningState.findUnique.mockResolvedValue({
        telegramUserId: tgBigInt,
        activeCurrency: 'USDT',
        baseSpeedGhs: 1.0,
        coolerMultiplier: 1.0,
        unclaimedBalance: 2.0,
        machineMode: 'PROMOTIONAL',
        lifetimePromotionalOutput: 4.5,
        interactivePromotionalOutput: 0.08,
      });

      const result = await service.tap(telegramUserId, 'test-idempotency-key');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });

    it('should throw error when trial limit is exceeded', async () => {
      const telegramUserId = '123456789';
      const tgBigInt = BigInt(telegramUserId);

      mockMachineService.getUserMachines.mockResolvedValue([
        { tierCode: 'TS_TRIAL', status: 'ACTIVE', capacityGhs: 1.0 },
      ]);

      mockMachineService.getCatalog.mockReturnValue([
        {
          tierCode: 'TS_TRIAL',
          promoOutputCap: 5.0,
          interactiveBonusCap: 0.10,
          maxMultiplier: 10.1,
          dailyYieldEstimateUsdt: 2.0,
          interactiveBaseRate: 0.0005,
        },
      ]);

      // Mock transaction to return data exceeding limit
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const lockedRow = {
          telegram_user_id: tgBigInt,
          active_currency: 'USDT',
          unclaimed_balance: 5.0,
          cooler_multiplier: 1.0,
          lifetime_promotional_output: 5.0, // At limit
          interactive_promotional_output: 0.10,
          machine_mode: 'PROMOTIONAL',
        };

        mockPrisma.$queryRaw.mockResolvedValue([lockedRow]);
        mockPrisma.userMachine.findFirst.mockResolvedValue({
          trialLimitAmount: { toNumber: () => 5.0 },
          trialUsedAmount: { toNumber: () => 5.0 },
        });

        // The callback should throw when limit is exceeded
        try {
          await callback(mockPrisma);
        } catch (error) {
          throw error;
        }
      });

      await expect(service.tap(telegramUserId)).rejects.toThrow(BadRequestException);
      await expect(service.tap(telegramUserId)).rejects.toThrow('Trial limit exceeded');
    });

    it('should handle idempotency keys to prevent duplicate taps', async () => {
      const telegramUserId = '123456789';
      const tgBigInt = BigInt(telegramUserId);
      const idempotencyKey = 'test-key-123';

      mockPrisma.financialIdempotencyRecord.findUnique.mockResolvedValue({
        telegramUserId: tgBigInt,
        idempotencyKey: `mining_tap_${telegramUserId}_${idempotencyKey}`,
        status: 'COMPLETED',
        responsePayload: { yield: 0.05 },
      });

      const result = await service.tap(telegramUserId, idempotencyKey);

      // Should not proceed to transaction if idempotency record exists
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('BTC currency conversion', () => {
    it('should convert TON currency to BTC on session load', async () => {
      const telegramUserId = '123456789';
      const tgBigInt = BigInt(telegramUserId);

      mockPrisma.userMiningState.findUnique.mockResolvedValue({
        telegramUserId: tgBigInt,
        activeCurrency: 'TON', // Legacy TON value
        baseSpeedGhs: 1.0,
        coolerMultiplier: 1.0,
        unclaimedBalance: 0.0,
        machineMode: 'PROMOTIONAL',
        lifetimePromotionalOutput: 0.0,
        interactivePromotionalOutput: 0.0,
      });

      mockMachineService.getUserMachines.mockResolvedValue([
        { tierCode: 'TS_TRIAL', status: 'ACTIVE', capacityGhs: 1.0 },
      ]);

      mockPrisma.userMachine.findFirst.mockResolvedValue({
        trialLimitAmount: { toNumber: () => 5.0 },
        trialUsedAmount: { toNumber: () => 0.0 },
      });

      const session = await service.getOrCreateSession(telegramUserId);

      expect(session.activeCurrency).toBe('BTC'); // Should be converted
    });

    it('should accept BTC currency in toggle operation', async () => {
      const telegramUserId = '123456789';

      mockPrisma.userMiningState.findUnique.mockResolvedValue({
        telegramUserId: BigInt(telegramUserId),
        activeCurrency: 'USDT',
        baseSpeedGhs: 1.0,
        coolerMultiplier: 1.0,
        unclaimedBalance: 0.0,
        machineMode: 'PROMOTIONAL',
        lifetimePromotionalOutput: 0.0,
        interactivePromotionalOutput: 0.0,
      });

      mockPrisma.userMiningState.update.mockResolvedValue({});
      mockMachineService.getUserMachines.mockResolvedValue([
        { tierCode: 'TS_TRIAL', status: 'ACTIVE', capacityGhs: 1.0 },
      ]);

      mockPrisma.userMachine.findFirst.mockResolvedValue({
        trialLimitAmount: { toNumber: () => 5.0 },
        trialUsedAmount: { toNumber: () => 0.0 },
      });

      const result = await service.toggleCurrency(telegramUserId, 'BTC');

      expect(result.activeCurrency).toBe('BTC');
    });
  });
});
