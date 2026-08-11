import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { FinancialOrchestratorService } from '../financial-orchestration/financial-orchestrator.service';
import { GrowthEventService } from './growth-event.service';
import { ReferralService } from './referral.service';
import { RewardService } from './reward.service';
import { AchievementService } from './achievement.service';
import { TrustProfileService } from './trust-profile.service';
import { GrowthNotificationService } from './growth-notification.service';
import { RewardStatus, RewardType } from '@prisma/client';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

describe('Missions & Quests Forensic Audit Security Suite', () => {
  let rewardService: RewardService;
  let mockPrismaService: any;
  let mockOrchestrator: any;

  beforeEach(async () => {
    mockOrchestrator = {
      requestOperation: jest.fn().mockResolvedValue({ id: 'op_ledger_123', status: 'POSTED' }),
    };

    mockPrismaService = {
      rewardRule: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      reward: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'rw_test_1', ...args.data })),
        update: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'rw_test_1', ...args.data })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ qualifiedReferrals: 0, payingReferrals: 0 }),
      },
      settlementSession: {
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: { expectedCryptoAmount: 0 } }),
      },
      userMachine: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { capacityGhs: 0 } }),
      },
      userLevelRecord: {
        findUnique: jest.fn().mockResolvedValue({ currentLevel: 'NEW' }),
      },
      referralRelationship: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
      },
      userTrustProfile: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'prof_1',
          telegramUserId: 1001n,
          trustScore: 50,
        }),
        update: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'prof_1', ...args.data })),
      },
      trustEvent: {
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'tevt_1', ...args.data })),
      },
      achievement: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RewardService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: FinancialOrchestratorService, useValue: mockOrchestrator },
        { provide: GrowthEventService, useValue: { publish: jest.fn() } },
        { provide: GrowthNotificationService, useValue: { sendNotification: jest.fn() } },
        { provide: AchievementService, useValue: { reconcileAchievements: jest.fn(), getClaimStreakInfo: jest.fn().mockResolvedValue({ current: 1, best: 1 }) } },
        { provide: ReferralService, useValue: { markRewarded: jest.fn() } },
      ],
    }).compile();

    rewardService = module.get<RewardService>(RewardService);
  });

  describe('1. Server Authority & Requirements Integrity', () => {
    it('should reject claiming a mission when requirements are not genuinely satisfied in DB', async () => {
      // Reward definition exists but requirement (settlement count) is 0 in DB
      mockPrismaService.reward.findUnique.mockResolvedValue({
        id: 'rw_incomplete',
        telegramUserId: 1001n,
        ruleId: 'rule_settlement_1',
        rewardType: RewardType.MILESTONE,
        amount: '2.000000',
        assetCode: 'USDT',
        status: RewardStatus.AVAILABLE,
        reference: 'rule_MILESTONE_FIRST_SETTLEMENT_1001',
      });
      mockPrismaService.rewardRule.findUnique.mockResolvedValue({
        id: 'rule_settlement_1',
        code: 'MILESTONE_FIRST_SETTLEMENT',
        parameters: { requirementType: 'SETTLEMENT_COUNT', requirementCount: 1 },
      });
      mockPrismaService.settlementSession.count.mockResolvedValue(0);

      await expect(rewardService.claimReward(1001n, 'rw_incomplete')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should approve claiming when requirements are genuinely satisfied in DB', async () => {
      mockPrismaService.reward.findUnique.mockResolvedValue({
        id: 'rw_complete',
        telegramUserId: 1001n,
        ruleId: 'rule_settlement_1',
        rewardType: RewardType.MILESTONE,
        amount: '2.000000',
        assetCode: 'USDT',
        status: RewardStatus.AVAILABLE,
        reference: 'rule_MILESTONE_FIRST_SETTLEMENT_1001',
      });
      mockPrismaService.rewardRule.findUnique.mockResolvedValue({
        id: 'rule_settlement_1',
        code: 'MILESTONE_FIRST_SETTLEMENT',
        enabled: true,
        parameters: { requirementType: 'SETTLEMENT_COUNT', requirementCount: 1 },
      });
      mockPrismaService.settlementSession.count.mockResolvedValue(1);

      const result = await rewardService.claimReward(1001n, 'rw_complete');

      expect(result.status).toBe(RewardStatus.CLAIMED);
      expect(result.amount).toBe('2.000000');
      expect(mockOrchestrator.requestOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          telegramUserId: 1001n,
          amount: '2.000000',
          operationType: 'SYSTEM_ALLOCATION',
        }),
      );
    });
  });

  describe('2. Duplicate & Concurrent Claim Protection', () => {
    it('should reject duplicate claims on an already claimed reward', async () => {
      mockPrismaService.reward.findUnique.mockResolvedValue({
        id: 'rw_claimed',
        telegramUserId: 1001n,
        rewardType: RewardType.MILESTONE,
        status: RewardStatus.CLAIMED,
      });

      await expect(rewardService.claimReward(1001n, 'rw_claimed')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject claim if atomic database lock (updateMany count === 0) fails due to concurrency', async () => {
      mockPrismaService.reward.findUnique.mockResolvedValue({
        id: 'rw_concurrent',
        telegramUserId: 1001n,
        rewardType: RewardType.MILESTONE,
        amount: '2.000000',
        status: RewardStatus.AVAILABLE,
      });
      mockPrismaService.rewardRule.findUnique.mockResolvedValue({
        id: 'rule_1',
        enabled: true,
        parameters: { requirementType: 'SETTLEMENT_COUNT', requirementCount: 0 },
      });
      // Simulate another thread winning the race condition
      mockPrismaService.reward.updateMany.mockResolvedValue({ count: 0 });

      await expect(rewardService.claimReward(1001n, 'rw_concurrent')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('3. User Substitution & IDOR Prevention', () => {
    it('should throw ForbiddenException if user attempts to claim another user reward', async () => {
      mockPrismaService.reward.findUnique.mockResolvedValue({
        id: 'rw_other_user',
        telegramUserId: 9999n, // belongs to user 9999
        rewardType: RewardType.MILESTONE,
        status: RewardStatus.AVAILABLE,
      });

      await expect(rewardService.claimReward(1001n, 'rw_other_user')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('4. Server-Side Safety Score Increment (+2)', () => {
    it('should increment user trust score server-side by exactly +2 upon valid claim', async () => {
      mockPrismaService.reward.findUnique.mockResolvedValue({
        id: 'rw_trust',
        telegramUserId: 1001n,
        rewardType: RewardType.MILESTONE,
        amount: '2.000000',
        assetCode: 'USDT',
        status: RewardStatus.AVAILABLE,
      });
      mockPrismaService.rewardRule.findUnique.mockResolvedValue({
        id: 'rule_1',
        enabled: true,
        parameters: { requirementType: 'SETTLEMENT_COUNT', requirementCount: 0 },
      });
      mockPrismaService.userTrustProfile.findUnique.mockResolvedValue({
        id: 'prof_1001',
        telegramUserId: 1001n,
        trustScore: 50,
      });

      await rewardService.claimReward(1001n, 'rw_trust');

      expect(mockPrismaService.userTrustProfile.update).toHaveBeenCalledWith({
        where: { telegramUserId: 1001n },
        data: { trustScore: 52 },
      });
      expect(mockPrismaService.trustEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          profileId: 'prof_1001',
          telegramUserId: 1001n,
          scoreDelta: 2,
          newScore: 52,
          reason: 'Reward Claim Bonus: rw_trust',
        }),
      });
    });
  });
});
