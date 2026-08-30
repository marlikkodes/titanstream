import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { GrowthAnalyticsService } from './growth-analytics.service';

describe('Growth Conversion & Next Best Action Engine (Phase 2 Unit Certification)', () => {
  let analyticsService: GrowthAnalyticsService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    universalIdentity: {
      findUnique: jest.fn(),
    },
    financialTransaction: {
      count: jest.fn(),
    },
    settlementSession: {
      count: jest.fn(),
    },
    userMachine: {
      count: jest.fn(),
    },
    referralRelationship: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      groupBy: jest.fn(),
    },
    reward: {
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    growthContribution: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GrowthAnalyticsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    analyticsService = module.get<GrowthAnalyticsService>(GrowthAnalyticsService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Next Best Action Engine (getNextBestAction)', () => {
    it('returns COMPLETE_ONBOARDING when user is not ready', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isReady: false, qualifiedReferrals: 0 });
      mockPrisma.reward.count.mockResolvedValue(0);

      const nba = await analyticsService.getNextBestAction(123456789n);

      expect(nba.actionType).toBe('COMPLETE_ONBOARDING');
      expect(nba.destinationTab).toBe('wallet');
      expect(nba.priority).toBe('HIGH');
    });

    it('returns CLAIM_REWARD with URGENT priority when user has unclaimed available rewards', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isReady: true });
      mockPrisma.reward.count.mockResolvedValue(2);

      const nba = await analyticsService.getNextBestAction(123456789n);

      expect(nba.actionType).toBe('CLAIM_REWARD');
      expect(nba.priority).toBe('URGENT');
      expect(nba.potentialUnlockUsdt).toBe(10.0);
    });

    it('returns EXECUTE_FIRST_SETTLEMENT when user has no completed settlements', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isReady: true, qualifiedReferrals: 0 });
      mockPrisma.reward.count.mockResolvedValue(0);
      mockPrisma.settlementSession.count.mockResolvedValue(0);

      const nba = await analyticsService.getNextBestAction(123456789n);

      expect(nba.actionType).toBe('EXECUTE_FIRST_SETTLEMENT');
      expect(nba.priority).toBe('HIGH');
    });

    it('returns EXPLORE_MACHINES when user has funded but owns 0 machines', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isReady: true, qualifiedReferrals: 0 });
      mockPrisma.reward.count.mockResolvedValue(0);
      mockPrisma.settlementSession.count.mockResolvedValue(2);
      mockPrisma.userMachine.count.mockResolvedValue(0);

      const nba = await analyticsService.getNextBestAction(123456789n);

      expect(nba.actionType).toBe('EXPLORE_MACHINES');
      expect(nba.priority).toBe('MEDIUM');
    });

    it('returns INVITE_FRIENDS when user owns a machine but has < 5 qualified referrals', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isReady: true, qualifiedReferrals: 2 });
      mockPrisma.reward.count.mockResolvedValue(0);
      mockPrisma.settlementSession.count.mockResolvedValue(3);
      mockPrisma.userMachine.count.mockResolvedValue(1);

      const nba = await analyticsService.getNextBestAction(123456789n);

      expect(nba.actionType).toBe('INVITE_FRIENDS');
      expect(nba.priority).toBe('MEDIUM');
    });

    it('returns EXPAND_FLEET when user is fully qualified', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isReady: true, qualifiedReferrals: 7 });
      mockPrisma.reward.count.mockResolvedValue(0);
      mockPrisma.settlementSession.count.mockResolvedValue(10);
      mockPrisma.userMachine.count.mockResolvedValue(2);

      const nba = await analyticsService.getNextBestAction(123456789n);

      expect(nba.actionType).toBe('EXPAND_FLEET');
      expect(nba.priority).toBe('LOW');
    });
  });

  describe('Reward Liability Exposure (getRewardLiabilityBreakdown)', () => {
    it('accurately segments available, committed, and disbursed liabilities against budget cap', async () => {
      mockPrisma.reward.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 5000.0 } }) // CLAIMED
        .mockResolvedValueOnce({ _sum: { amount: 1500.0 } }) // AVAILABLE
        .mockResolvedValueOnce({ _sum: { amount: 800.0 } });  // CLAIM_PENDING

      const breakdown = await analyticsService.getRewardLiabilityBreakdown();

      expect(breakdown.disbursedSpendUsdt).toBe(5000.0);
      expect(breakdown.availableLiabilityUsdt).toBe(1500.0);
      expect(breakdown.committedLiabilityUsdt).toBe(800.0);
      expect(breakdown.remainingBudgetUsdt).toBe(25000.0 - 5000.0 - 800.0);
      expect(breakdown.budgetUtilizationPercent).toBe(20.0);
    });
  });

  describe('Referral Activation Assistance (getReferralActivationAssistance)', () => {
    it('generates helper instructions for unlinked referee', async () => {
      mockPrisma.referralRelationship.findFirst.mockResolvedValue({
        id: 'rel_1',
        referrerId: 222n,
        refereeId: 111n,
        status: 'REGISTERED',
        referee: { firstName: 'Alex', telegramUsername: 'alex_t', isReady: false },
      });
      mockPrisma.settlementSession.count.mockResolvedValue(0);

      const assistance = await analyticsService.getReferralActivationAssistance(222n, 111n);

      expect(assistance).not.toBeNull();
      expect(assistance!.missingStep).toBe('Link Mobile Money Rail');
      expect(assistance!.helperMessage).toContain('Alex');
    });

    it('generates 1st settlement helper for onboarded referee', async () => {
      mockPrisma.referralRelationship.findFirst.mockResolvedValue({
        id: 'rel_2',
        referrerId: 222n,
        refereeId: 111n,
        status: 'REGISTERED',
        referee: { firstName: 'Alex', telegramUsername: 'alex_t', isReady: true },
      });
      mockPrisma.settlementSession.count.mockResolvedValue(0);

      const assistance = await analyticsService.getReferralActivationAssistance(222n, 111n);

      expect(assistance).not.toBeNull();
      expect(assistance!.missingStep).toBe('Execute 1st Mobile Money Settlement');
      expect(assistance!.helperMessage).toContain('first instant settlement');
    });

    it('returns null when no referral relationship exists', async () => {
      mockPrisma.referralRelationship.findFirst.mockResolvedValue(null);

      const assistance = await analyticsService.getReferralActivationAssistance(222n, 999n);
      expect(assistance).toBeNull();
    });
  });
});
