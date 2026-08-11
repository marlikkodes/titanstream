import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { FinancialOrchestratorService } from '../financial-orchestration/financial-orchestrator.service';
import { GrowthEventService } from './growth-event.service';
import { RewardService } from './reward.service';
import { GrowthNotificationService } from './growth-notification.service';
import { AchievementService } from './achievement.service';
import { ReferralService } from './referral.service';
import { RewardStatus, RewardType } from '@prisma/client';

describe('Titan Stream Platform-First Reward Economy & Surprise Engine Test Suite', () => {
  let rewardService: RewardService;
  let mockPrismaService: any;
  let mockOrchestrator: any;

  beforeEach(async () => {
    mockOrchestrator = {
      requestOperation: jest.fn().mockResolvedValue({ id: 'op_surprise_101', status: 'POSTED' }),
    };

    mockPrismaService = {
      $transaction: jest.fn().mockImplementation((cb) => cb(mockPrismaService)),
      emergencyControlState: {
        findUnique: jest.fn().mockResolvedValue({ rewardsPaused: false }),
      },
      growthEvent: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'evt_surp_1', ...args.data })),
      },
      reward: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'rw_surp_1', ...args.data })),
        findUnique: jest.fn(),
      },
      rewardRule: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      crystalAccount: {
        findUnique: jest.fn().mockResolvedValue({ id: 'c_acc_1', balance: 100, lifetimeEarned: 100 }),
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'c_acc_1', ...args.data })),
        update: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'c_acc_1', ...args.data })),
      },
      crystalTransaction: {
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'ctx_surp_1', ...args.data })),
      },
      userTrustProfile: {
        findUnique: jest.fn().mockResolvedValue({ id: 'prof_surp_1', trustScore: 50 }),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RewardService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: FinancialOrchestratorService, useValue: mockOrchestrator },
        { provide: GrowthEventService, useValue: { publish: jest.fn() } },
        { provide: GrowthNotificationService, useValue: { sendNotification: jest.fn() } },
        { provide: AchievementService, useValue: { reconcileAchievements: jest.fn(), getClaimStreakInfo: jest.fn().mockResolvedValue({ current: 1 }) } },
        { provide: ReferralService, useValue: { markRewarded: jest.fn() } },
      ],
    }).compile();

    rewardService = module.get<RewardService>(RewardService);
  });

  describe('1. Emergency Control Kill Switch', () => {
    it('should halt surprise reward issuance when emergency control rewardsPaused is TRUE', async () => {
      mockPrismaService.emergencyControlState.findUnique.mockResolvedValue({ rewardsPaused: true });

      const result = await rewardService.evaluateSurpriseReward(1001n, 'SETTLEMENT_COMPLETED');

      expect(result).toBeNull(); // Zero rewards minted
      expect(mockPrismaService.reward.create).not.toHaveBeenCalled();
    });
  });

  describe('2. Controlled Daily USDT Budget Cap ($2.00 Cap)', () => {
    it('should automatically downgrade monetary surprise to UNCOMMON Crystals when daily USDT cap is reached', async () => {
      // Force random roll to hit LEGENDARY / EPIC USDT tier
      jest.spyOn(Math, 'random').mockReturnValue(0.001); // Hit 0.1% roll

      // Simulate $2.00 already disbursed today
      mockPrismaService.reward.aggregate.mockResolvedValue({ _sum: { amount: 2.0 } });

      const result = await rewardService.evaluateSurpriseReward(1001n, 'SETTLEMENT_COMPLETED');

      expect(result).not.toBeNull();
      expect(result?.tier).toBe('UNCOMMON');
      expect(result?.assetCode).toBe('CRYSTALS');
      expect(result?.amount).toBe('100');

      jest.spyOn(Math, 'random').mockRestore();
    });
  });

  describe('3. Diminishing Returns Probability Decay', () => {
    it('should reduce monetary surprise probability exponentially on repeated daily triggers', async () => {
      // User has already triggered 3 surprise rewards today
      mockPrismaService.growthEvent.count.mockResolvedValue(3); // decayMultiplier = 0.5^3 = 0.125

      jest.spyOn(Math, 'random').mockReturnValue(0.2); // Normally RARE (7%), but with decay (0.875%) it falls through to UNCOMMON / COMMON

      const result = await rewardService.evaluateSurpriseReward(1001n, 'LOYALTY_SURPRISE');

      expect(result?.assetCode).toBe('CRYSTALS');

      jest.spyOn(Math, 'random').mockRestore();
    });
  });

  describe('4. Ledger & Accounting Integration', () => {
    it('should disburse USDT surprise drops via FinancialOrchestrator double-entry operation', async () => {
      // Force roll to hit RARE (0.10 USDT)
      jest.spyOn(Math, 'random').mockReturnValue(0.001);
      mockPrismaService.reward.aggregate.mockResolvedValue({ _sum: { amount: 0 } }); // $0 spent today

      const result = await rewardService.evaluateSurpriseReward(1001n, 'SETTLEMENT_COMPLETED');

      expect(result?.assetCode).toBe('USDT');
      expect(mockOrchestrator.requestOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          telegramUserId: 1001n,
          amount: expect.any(String),
          operationType: 'SYSTEM_ALLOCATION',
        }),
      );

      jest.spyOn(Math, 'random').mockRestore();
    });
  });
});
