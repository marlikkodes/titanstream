import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { FinancialOrchestratorService } from '../financial-orchestration/financial-orchestrator.service';
import { GrowthEventService } from './growth-event.service';
import { ReferralService } from './referral.service';
import { RewardService } from './reward.service';
import { AchievementService } from './achievement.service';
import { GameAntiCheatService } from '../games/game-anti-cheat.service';
import { GameRewardService } from '../games/game-reward.service';
import { GameEventService } from '../games/game-event.service';
import { RewardStatus, RewardType, ReferralStatus } from '@prisma/client';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

describe('Titan Stream Master Reward Economy Audit & Security Suite', () => {
  let referralService: ReferralService;
  let rewardService: RewardService;
  let gameAntiCheatService: GameAntiCheatService;
  let gameRewardService: GameRewardService;
  let mockPrismaService: any;
  let mockOrchestrator: any;

  beforeEach(async () => {
    mockOrchestrator = {
      requestOperation: jest.fn().mockResolvedValue({ id: 'op_master_ledger_99', status: 'POSTED' }),
    };

    mockPrismaService = {
      referralCode: {
        findUnique: jest.fn(),
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'code_ref_1', ...args.data })),
        upsert: jest.fn(),
      },
      referralRelationship: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'rel_ref_1', ...args.data })),
        update: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'rel_ref_1', ...args.data })),
      },
      referralEvent: {
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'evt_ref_1', ...args.data })),
      },
      referralReward: {
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'rrw_ref_1', ...args.data })),
      },
      rewardRule: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      reward: {
        findUnique: jest.fn(),
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'rw_m_1', ...args.data })),
        update: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'rw_m_1', ...args.data })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findUnique: jest.fn(),
      },
      settlementSession: {
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: { expectedCryptoAmount: 0 } }),
      },
      userTrustProfile: {
        findUnique: jest.fn().mockResolvedValue({ id: 'prof_m1', trustScore: 50 }),
        update: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'prof_m1', ...args.data })),
      },
      trustEvent: {
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'tevt_m1', ...args.data })),
      },
      achievement: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralService,
        RewardService,
        GameAntiCheatService,
        GameRewardService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: FinancialOrchestratorService, useValue: mockOrchestrator },
        { provide: GrowthEventService, useValue: { publish: jest.fn() } },
        { provide: GameEventService, useValue: { resolveMultipliers: jest.fn().mockResolvedValue({}) } },
        { provide: AchievementService, useValue: { reconcileAchievements: jest.fn(), getClaimStreakInfo: jest.fn().mockResolvedValue({ current: 1, best: 1 }) } },
      ],
    }).compile();

    referralService = module.get<ReferralService>(ReferralService);
    rewardService = module.get<RewardService>(RewardService);
    gameAntiCheatService = module.get<GameAntiCheatService>(GameAntiCheatService);
    gameRewardService = module.get<GameRewardService>(GameRewardService);
  });

  describe('1. Referral Economy Hardening', () => {
    it('should reject self-referral attempts', async () => {
      mockPrismaService.referralCode.findUnique.mockResolvedValue({
        id: 'code_self',
        telegramUserId: 1001n,
        code: 'TS1001',
      });

      await expect(referralService.registerReferral('TS1001', 1001n)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject circular referral attempts (A refers B, B refers A)', async () => {
      mockPrismaService.referralCode.findUnique.mockResolvedValue({
        id: 'code_user_b',
        telegramUserId: 2002n,
        code: 'TS2002',
      });
      // User A (1001) is already referrer of User B (2002)
      mockPrismaService.referralRelationship.findFirst.mockResolvedValue({
        id: 'rel_a_to_b',
        referrerId: 1001n,
        refereeId: 2002n,
      });

      // User B (2002) tries to register User A (1001) as referee
      await expect(referralService.registerReferral('TS2002', 1001n)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should enforce that referral qualification requires a completed DB settlement session', async () => {
      mockPrismaService.referralRelationship.findUnique.mockResolvedValue({
        id: 'rel_qual_check',
        referrerId: 1001n,
        refereeId: 2002n,
        status: ReferralStatus.REGISTERED,
      });
      mockPrismaService.user.findUnique.mockResolvedValue({ isReady: true });
      mockPrismaService.settlementSession.count.mockResolvedValue(0); // 0 settlements completed

      const result = await referralService.evaluateQualification(2002n);

      expect(result.status).toBe(ReferralStatus.REGISTERED); // Remains REGISTERED, not QUALIFIED
    });
  });

  describe('2. Mini-Game Anti-Cheat & Score Rate Validation', () => {
    it('should reject impossible score rates exceeding physical bounds', () => {
      const mockGame: any = {
        gameId: 'hoop_masters',
        estimatedDurationSec: 30,
        rewardConfig: { maxScorePerSecond: 5 },
      };
      const mockSession: any = {
        serverStartedAt: new Date(Date.now() - 10000), // 10s ago
      };

      // Score = 500 in 10s => 50 pts/sec (exceeds 5/sec limit)
      const verdict = gameAntiCheatService.validate(mockGame, mockSession, 500, 10000);

      expect(verdict.ok).toBe(false);
      expect(verdict.status).toBe('REJECTED');
      expect(verdict.reasons).toContain('SCORE_RATE_EXCEEDS_PHYSICS_LIMIT (50.00/s > 5/s)');
    });

    it('should void session if server duration limit is exceeded', () => {
      const mockGame: any = {
        gameId: 'roulette',
        estimatedDurationSec: 10,
        rewardConfig: { maxDurationMs: 15000 },
      };
      const mockSession: any = {
        serverStartedAt: new Date(Date.now() - 60000), // 60s ago (exceeds 15s limit)
      };

      const verdict = gameAntiCheatService.validate(mockGame, mockSession, 10, 10000);

      expect(verdict.ok).toBe(false);
      expect(verdict.status).toBe('VOID');
      expect(verdict.reasons).toContain('SESSION_EXCEEDED_MAX_DURATION');
    });
  });

  describe('3. Financial Orchestration & Universal Idempotency', () => {
    it('should disburse valid claims via Financial Orchestrator double-entry operation', async () => {
      mockPrismaService.reward.findUnique.mockResolvedValue({
        id: 'rw_orchestrated',
        telegramUserId: 1001n,
        rewardType: RewardType.REFERRAL,
        amount: '5.000000',
        assetCode: 'USDT',
        status: RewardStatus.AVAILABLE,
        reference: 'ref_rw_rel_100',
      });
      mockPrismaService.rewardRule.findUnique.mockResolvedValue({
        id: 'rule_ref',
        enabled: true,
        parameters: { requirementType: 'REFERRAL_QUALIFIED' },
      });
      mockPrismaService.user.findUnique.mockResolvedValue({ qualifiedReferrals: 1 });

      const result = await rewardService.claimReward(1001n, 'rw_orchestrated');

      expect(result.status).toBe(RewardStatus.CLAIMED);
      expect(mockOrchestrator.requestOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          telegramUserId: 1001n,
          amount: '5.000000',
          operationType: 'SYSTEM_ALLOCATION',
        }),
      );
    });

    it('should guarantee idempotency when concurrent claim requests race', async () => {
      mockPrismaService.reward.findUnique.mockResolvedValue({
        id: 'rw_race_condition',
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
      // Simulate another process updating status first
      mockPrismaService.reward.updateMany.mockResolvedValue({ count: 0 });

      await expect(rewardService.claimReward(1001n, 'rw_race_condition')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
