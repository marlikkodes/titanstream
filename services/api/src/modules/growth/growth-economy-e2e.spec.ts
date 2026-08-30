import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { GrowthContributionService } from './growth-contribution.service';
import { RewardService } from './reward.service';
import { ReferralService } from './referral.service';
import { GrowthAnalyticsService } from './growth-analytics.service';
import { FinancialOrchestratorService } from '../financial-orchestration/financial-orchestrator.service';
import { GrowthEventService } from './growth-event.service';
import { GrowthNotificationService } from './growth-notification.service';
import { AchievementService } from './achievement.service';
import { RewardType, RewardStatus, ReferralStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('Growth Economy & Value Attribution Engine (E2E Unit Certification)', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let contributionService: GrowthContributionService;
  let rewardService: RewardService;
  let referralService: ReferralService;
  let analyticsService: GrowthAnalyticsService;

  const mockPrisma = {
    referralRelationship: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    referralCode: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    referralEvent: {
      create: jest.fn(),
    },
    referralAnalytics: {
      create: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    growthContribution: {
      create: jest.fn(),
      findFirst: jest.fn(),
      aggregate: jest.fn(),
    },
    rewardRule: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    reward: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    promotionCampaignRecord: {
      findMany: jest.fn(),
    },
    trustEvent: {
      create: jest.fn(),
    },
    userTrustProfile: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockOrchestrator = {
    requestOperation: jest.fn().mockResolvedValue({ id: 'op_test_123', status: 'COMPLETED' }),
  };

  const mockGrowthEventService = {
    publish: jest.fn(),
    on: jest.fn(),
  };

  const mockNotificationService = {
    sendNotification: jest.fn(),
  };

  const mockAchievementService = {
    checkAndUnlock: jest.fn(),
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        GrowthContributionService,
        RewardService,
        ReferralService,
        GrowthAnalyticsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FinancialOrchestratorService, useValue: mockOrchestrator },
        { provide: GrowthEventService, useValue: mockGrowthEventService },
        { provide: GrowthNotificationService, useValue: mockNotificationService },
        { provide: AchievementService, useValue: mockAchievementService },
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    contributionService = module.get<GrowthContributionService>(GrowthContributionService);
    rewardService = module.get<RewardService>(RewardService);
    referralService = module.get<ReferralService>(ReferralService);
    analyticsService = module.get<GrowthAnalyticsService>(GrowthAnalyticsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Attribution Ingestion & Referral Binding', () => {
    it('should ingest UTM campaign attribution and persist to ReferralAnalytics', async () => {
      mockPrisma.referralCode.findUnique.mockResolvedValue({
        id: 'code_123',
        code: 'TS8888',
        telegramUserId: BigInt(8888),
      });
      mockPrisma.referralRelationship.findFirst.mockResolvedValue(null);
      mockPrisma.referralRelationship.findUnique.mockResolvedValue(null);
      mockPrisma.referralRelationship.create.mockResolvedValue({
        id: 'rel_9999',
        referrerId: BigInt(8888),
        refereeId: BigInt(9999),
        status: ReferralStatus.REGISTERED,
      });

      const attribution = {
        channel: 'TELEGRAM',
        campaign: 'UGANDA_LAUNCH_AUGUST',
        medium: 'TELEGRAM_CHANNEL',
        landingPage: '/ref/TS8888',
      };

      const result = await referralService.registerReferral('TS8888', BigInt(9999), attribution);

      expect(result).toBeDefined();
      expect(mockPrisma.referralAnalytics.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          inviterId: BigInt(8888),
          inviteeId: BigInt(9999),
          channel: 'TELEGRAM',
          campaign: 'UGANDA_LAUNCH_AUGUST',
          medium: 'TELEGRAM_CHANNEL',
          landingPage: '/ref/TS8888',
          registered: true,
        }),
      });
    });
  });

  describe('2. Economic Contribution Recording (Settlements & Machines)', () => {
    it('should compute net contribution for settlement fee with provider cost basis', async () => {
      mockPrisma.referralRelationship.findUnique.mockResolvedValue({ id: 'rel_9999' });
      mockPrisma.referralAnalytics.findFirst.mockResolvedValue({ campaign: 'UGANDA_LAUNCH_AUGUST' });
      mockPrisma.growthContribution.create.mockImplementation(({ data }) => Promise.resolve({ id: 'gc_1', ...data }));

      const res = await contributionService.recordSettlementContribution(
        'settle_session_101',
        BigInt(9999),
        '10.00', // Gross fee
        '100.00', // Volume
      );

      expect(res).toBeDefined();
      expect(mockPrisma.growthContribution.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          telegramUserId: BigInt(9999),
          economicEventType: 'SETTLEMENT_FEE',
          economicEventId: 'settle_session_101',
          campaignCode: 'UGANDA_LAUNCH_AUGUST',
          referralRelationshipId: 'rel_9999',
        }),
      });
    });

    it('should compute net contribution for machine purchase with 30% hardware margin basis', async () => {
      mockPrisma.referralRelationship.findUnique.mockResolvedValue({ id: 'rel_9999' });
      mockPrisma.referralAnalytics.findFirst.mockResolvedValue({ campaign: 'UGANDA_LAUNCH_AUGUST' });
      mockPrisma.growthContribution.create.mockImplementation(({ data }) => Promise.resolve({ id: 'gc_2', ...data }));

      const res = await contributionService.recordMachineContribution(
        'mach_pro_500',
        BigInt(9999),
        '250.00', // Purchase price
        'TS-PRO-500',
      );

      expect(res).toBeDefined();
      expect(mockPrisma.growthContribution.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          telegramUserId: BigInt(9999),
          economicEventType: 'MACHINE_PURCHASE',
          economicEventId: 'mach_pro_500',
        }),
      });
    });

    it('should enforce strict event idempotency on duplicate event recording', async () => {
      mockPrisma.growthContribution.findFirst.mockResolvedValue({
        id: 'gc_existing_1',
        economicEventType: 'SETTLEMENT_FEE',
        economicEventId: 'settle_session_101',
        netContributionUsdt: '6.50',
      });

      const res = await contributionService.recordSettlementContribution(
        'settle_session_101',
        BigInt(9999),
        '10.00',
        '100.00',
      );

      expect(res).toBeDefined();
      expect(res?.id).toBe('gc_existing_1');
      expect(mockPrisma.growthContribution.create).not.toHaveBeenCalled();
    });
  });

  describe('3. Campaign Budget Guardrails & Liability Reservation', () => {
    it('should block reward creation if rule budget limit would be exceeded', async () => {
      mockPrisma.reward.findUnique.mockResolvedValue(null);
      mockPrisma.rewardRule.findUnique.mockResolvedValue({
        id: 'rule_ref_5',
        code: 'REFERRAL_DEFAULT_5USDT',
        amount: '5.00',
        budgetLimitUsdt: '100.00',
        committedLiabilityUsdt: '80.00',
        disbursedSpendUsdt: '20.00', // Total committed + disbursed = $100.00 (limit reached)
      });

      await expect(
        rewardService.createReward({
          telegramUserId: BigInt(8888),
          rewardType: RewardType.REFERRAL,
          amount: '5.00',
          ruleCode: 'REFERRAL_DEFAULT_5USDT',
          reference: 'ref_rwd_overflow',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should increment committed liability when within campaign budget', async () => {
      mockPrisma.reward.findUnique.mockResolvedValue(null);
      mockPrisma.rewardRule.findUnique.mockResolvedValue({
        id: 'rule_ref_5',
        code: 'REFERRAL_DEFAULT_5USDT',
        amount: '5.00',
        budgetLimitUsdt: '100.00',
        committedLiabilityUsdt: '10.00',
        disbursedSpendUsdt: '10.00',
      });
      mockPrisma.reward.create.mockResolvedValue({
        id: 'rwd_new_1',
        telegramUserId: BigInt(8888),
        amount: '5.00',
        status: RewardStatus.AVAILABLE,
        reference: 'ref_rwd_valid',
      });

      const reward = await rewardService.createReward({
        telegramUserId: BigInt(8888),
        rewardType: RewardType.REFERRAL,
        amount: '5.00',
        ruleCode: 'REFERRAL_DEFAULT_5USDT',
        reference: 'ref_rwd_valid',
      });

      expect(reward).toBeDefined();
      expect(mockPrisma.rewardRule.update).toHaveBeenCalledWith({
        where: { id: 'rule_ref_5' },
        data: {
          committedLiabilityUsdt: { increment: expect.anything() },
        },
      });
    });
  });

  describe('4. Growth Economy Aggregation & ROI Metrics', () => {
    it('should aggregate net growth contribution, CAC, LTV and overall ROI', async () => {
      mockPrisma.growthContribution.aggregate.mockResolvedValue({
        _sum: {
          grossRevenueUsdt: 10000,
          directCostUsdt: 3000,
          rewardCostUsdt: 1000,
          netContributionUsdt: 6000,
        },
      });

      mockPrisma.promotionCampaignRecord.findMany.mockResolvedValue([
        { campaignCode: 'UGANDA_LAUNCH_AUGUST', title: 'Uganda August Launch' },
      ]);

      mockPrisma.referralAnalytics.count.mockResolvedValue(100);
      mockPrisma.referralAnalytics.findMany.mockResolvedValue([]);
      mockPrisma.referralRelationship.groupBy.mockResolvedValue([]);

      const metrics = await analyticsService.getGrowthEconomyMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.totalGrossRevenueUsdt).toBe(10000);
      expect(metrics.totalDirectCostUsdt).toBe(3000);
      expect(metrics.totalRewardSpendUsdt).toBe(1000);
      expect(metrics.netGrowthContributionUsdt).toBe(6000);
      expect(metrics.overallGrowthRoi).toBe(6.0); // 6000 / 1000 = 6.0x ROI
    });
  });
});
