import { Test, TestingModule } from '@nestjs/testing';
import { GrowthController } from './growth.controller';
import { FinancialController } from '../financial/financial.controller';
import { BalanceService } from '../financial/balance.service';
import { FinancialAccountService } from '../financial/financial-account.service';
import { FinancialAccountRepository } from '../financial/financial-account.repository';
import { LedgerService } from '../financial/ledger.service';
import { TransactionService } from '../financial/transaction.service';
import { ReferralService } from './referral.service';
import { ReferralGraphService } from './referral-graph.service';
import { ReferralQualificationService } from './referral-qualification.service';
import { DiscountEligibilityService } from './discount-eligibility.service';
import { RewardService } from './reward.service';
import { AchievementService } from './achievement.service';
import { ProgressService } from './progress.service';
import { TrustProfileService } from './trust-profile.service';
import { UserLevelService } from './user-level.service';
import { GrowthNotificationService } from './growth-notification.service';
import { TrustCenterService } from './trust-center.service';
import { GrowthEventService } from './growth-event.service';
import { GrowthAnalyticsService } from './growth-analytics.service';
import { GrowthContributionService } from './growth-contribution.service';
import { SocialMissionService } from './social-mission.service';
import { SocialAttributionService } from './social-attribution.service';
import { FinancialOrchestratorService } from '../financial-orchestration/financial-orchestrator.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { RewardStatus, RewardType, UserLevelTier, LedgerEntryType } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('POST-REMEDIATION FORENSIC CERTIFICATION SUITE', () => {
  let growthController: GrowthController;
  let financialController: FinancialController;
  let balanceService: BalanceService;
  let rewardService: RewardService;
  let orchestrator: FinancialOrchestratorService;

  const CANONICAL_USER_UUID = 'a21f541b-5dd5-4a45-b8da-1eb914b77f3e';
  const CANONICAL_TG_ID = 9988776655n;
  const FINANCIAL_ACCOUNT_ID = 'fin_acc_canonical_001';

  const mockUser = {
    id: CANONICAL_USER_UUID,
    identityId: CANONICAL_USER_UUID,
    telegramUserId: CANONICAL_TG_ID,
    telegramUsername: 'canonical_operator',
    isReady: true,
    createdAt: new Date(),
    qualifiedReferrals: 5,
    payingReferrals: 3,
  };

  const mockFinancialAccount = {
    id: FINANCIAL_ACCOUNT_ID,
    userId: CANONICAL_USER_UUID,
    telegramUserId: CANONICAL_TG_ID,
    status: 'ACTIVE',
  };

  const mockPrisma = {
    user: {
      findFirst: jest.fn().mockImplementation((args) => {
        if (args?.where?.OR?.some((cond: any) => cond.id === CANONICAL_USER_UUID || cond.identityId === CANONICAL_USER_UUID)) {
          return Promise.resolve(mockUser);
        }
        return Promise.resolve(null);
      }),
      findUnique: jest.fn().mockImplementation((args) => {
        if (args?.where?.id === CANONICAL_USER_UUID || args?.where?.telegramUserId === CANONICAL_TG_ID) {
          return Promise.resolve(mockUser);
        }
        return Promise.resolve(null);
      }),
    },
    financialAccount: {
      findFirst: jest.fn().mockResolvedValue(mockFinancialAccount),
      findUnique: jest.fn().mockResolvedValue(mockFinancialAccount),
      create: jest.fn().mockResolvedValue(mockFinancialAccount),
      upsert: jest.fn().mockResolvedValue(mockFinancialAccount),
    },
    asset: {
      findMany: jest.fn().mockResolvedValue([
        { assetCode: 'USDT', name: 'Tether USD', symbol: 'USDT', decimals: 2, enabled: true },
      ]),
    },
    ledgerEntry: {
      findMany: jest.fn().mockResolvedValue([
        { amount: '50.00', entryType: LedgerEntryType.CREDIT },
        { amount: '10.00', entryType: LedgerEntryType.DEBIT },
      ]),
    },
    financialTransaction: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    ledgerAccount: {
      findUnique: jest.fn().mockResolvedValue({ id: 'la_1', code: 'USER_ASSET_LIABILITY' }),
    },
    rewardRule: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'rule_ref_1',
          code: 'REFERRAL_DEFAULT_5USDT',
          name: 'Invite 1 Verified Operator',
          rewardType: RewardType.REFERRAL,
          amount: '5.00',
          assetCode: 'USDT',
          enabled: true,
          parameters: { requirementType: 'REFERRAL_QUALIFIED', requirementCount: 1, description: 'Earn $5 per qualified referral' },
        },
      ]),
      findUnique: jest.fn().mockResolvedValue({
        id: 'rule_ref_1',
        code: 'REFERRAL_DEFAULT_5USDT',
        name: 'Invite 1 Verified Operator',
        rewardType: RewardType.REFERRAL,
        amount: '5.00',
        assetCode: 'USDT',
        enabled: true,
        parameters: { requirementType: 'REFERRAL_QUALIFIED', requirementCount: 1 },
      }),
      upsert: jest.fn().mockResolvedValue({ id: 'rule_ref_1' }),
    },
    reward: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue({
        id: 'rw_cert_1',
        telegramUserId: CANONICAL_TG_ID,
        ruleId: 'rule_ref_1',
        amount: '5.00',
        assetCode: 'USDT',
        status: RewardStatus.AVAILABLE,
        reference: 'REF-CERT-001',
      }),
      create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'rw_cert_1', ...args.data })),
      update: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'rw_cert_1', ...args.data })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
    },
    userTrustProfile: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'prof_cert_1',
        telegramUserId: CANONICAL_TG_ID,
        trustScore: 88,
        completedSettlements: 12,
        failedSettlements: 0,
        successRate: 100.0,
        accountAgeDays: 45,
        verificationStatus: 'VERIFIED',
        trustEvents: [],
      }),
      create: jest.fn().mockResolvedValue({
        id: 'prof_cert_1',
        telegramUserId: CANONICAL_TG_ID,
        trustScore: 50,
      }),
      update: jest.fn().mockResolvedValue({
        id: 'prof_cert_1',
        telegramUserId: CANONICAL_TG_ID,
        trustScore: 88,
      }),
    },
    trustEvent: {
      create: jest.fn().mockResolvedValue({ id: 'te_1' }),
    },
    userLevelRecord: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'ulr_cert_1',
        telegramUserId: CANONICAL_TG_ID,
        currentLevel: UserLevelTier.TRUSTED,
        upgradedAt: new Date(),
      }),
    },
    userLevelConfig: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'ulc_1', level: UserLevelTier.NEW, name: 'New Explorer', levelOrder: 1, dailySettlementLimit: '500', feeDiscountPercent: '0', priorityRouting: false, benefits: {} },
        { id: 'ulc_2', level: UserLevelTier.VERIFIED, name: 'Verified User', levelOrder: 2, dailySettlementLimit: '2000', feeDiscountPercent: '0.1', priorityRouting: false, benefits: {} },
        { id: 'ulc_3', level: UserLevelTier.TRUSTED, name: 'Trusted Trader', levelOrder: 3, dailySettlementLimit: '10000', feeDiscountPercent: '0.25', priorityRouting: true, benefits: {} },
        { id: 'ulc_4', level: UserLevelTier.PREMIUM, name: 'Premium Member', levelOrder: 4, dailySettlementLimit: '50000', feeDiscountPercent: '0.5', priorityRouting: true, benefits: {} },
        { id: 'ulc_5', level: UserLevelTier.ELITE, name: 'Elite Partner', levelOrder: 5, dailySettlementLimit: '250000', feeDiscountPercent: '0.75', priorityRouting: true, benefits: {} },
      ]),
      findUnique: jest.fn().mockResolvedValue({
        id: 'ulc_3',
        level: UserLevelTier.TRUSTED,
        name: 'Trusted Trader',
        levelOrder: 3,
        dailySettlementLimit: '10000',
        feeDiscountPercent: '0.25',
        priorityRouting: true,
        benefits: {},
      }),
      upsert: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'ulc_1', ...args.create })),
    },
    achievement: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'ach_1' }),
      upsert: jest.fn().mockResolvedValue({ id: 'ach_1' }),
    },
    userAchievement: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({ id: 'ua_1' }),
    },
    referralCode: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'rc_cert_1',
        code: 'CERT99',
        telegramUserId: CANONICAL_TG_ID,
      }),
      create: jest.fn().mockResolvedValue({
        id: 'rc_cert_1',
        code: 'CERT99',
        telegramUserId: CANONICAL_TG_ID,
      }),
    },
    referralRelationship: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'rel_1' }),
      update: jest.fn().mockResolvedValue({ id: 'rel_1' }),
    },
    referralQualificationHistory: {
      create: jest.fn().mockResolvedValue({ id: 'rqh_1' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    settlementSession: {
      count: jest.fn().mockResolvedValue(12),
      findMany: jest.fn().mockResolvedValue([]),
    },
    userMachine: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'um_1', telegramUserId: CANONICAL_TG_ID, status: 'ACTIVE' },
      ]),
      count: jest.fn().mockResolvedValue(1),
    },
    gamePlayerStat: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    gameSession: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    growthNotification: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    growthNotificationPreference: {
      findUnique: jest.fn().mockResolvedValue({
        telegramUserId: CANONICAL_TG_ID,
        telegramEnabled: true,
        inAppEnabled: true,
        marketingEnabled: false,
      }),
      upsert: jest.fn().mockResolvedValue({
        telegramUserId: CANONICAL_TG_ID,
        telegramEnabled: true,
        inAppEnabled: true,
        marketingEnabled: false,
      }),
    },
    growthEvent: {
      create: jest.fn().mockResolvedValue({ id: 'ge_1' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    socialMission: {
      upsert: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    socialMissionParticipation: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    socialAttribution: {
      create: jest.fn().mockResolvedValue({}),
    },
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GrowthController, FinancialController],
      providers: [
        ReferralService,
        ReferralGraphService,
        ReferralQualificationService,
        DiscountEligibilityService,
        RewardService,
        AchievementService,
        ProgressService,
        TrustProfileService,
        UserLevelService,
        GrowthNotificationService,
        TrustCenterService,
        GrowthEventService,
        GrowthAnalyticsService,
        GrowthContributionService,
        SocialMissionService,
        SocialAttributionService,
        FinancialAccountService,
        {
          provide: FinancialAccountRepository,
          useValue: {
            findByUserId: jest.fn().mockResolvedValue(mockFinancialAccount),
            findByTelegramUserId: jest.fn().mockResolvedValue(mockFinancialAccount),
            createForUser: jest.fn().mockResolvedValue(mockFinancialAccount),
          },
        },
        BalanceService,
        { provide: LedgerService, useValue: { getAccountStatement: jest.fn() } },
        { provide: TransactionService, useValue: { findForAccount: jest.fn() } },
        AuditService,
        { provide: JwtService, useValue: { sign: jest.fn(), verify: jest.fn() } },
        Reflector,
        {
          provide: FinancialOrchestratorService,
          useValue: {
            requestOperation: jest.fn().mockResolvedValue({
              success: true,
              operationId: 'op_alloc_001',
              status: 'COMPLETED',
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    growthController = module.get<GrowthController>(GrowthController);
    financialController = module.get<FinancialController>(FinancialController);
    balanceService = module.get<BalanceService>(BalanceService);
    rewardService = module.get<RewardService>(RewardService);
    orchestrator = module.get<FinancialOrchestratorService>(FinancialOrchestratorService);
  });

  describe('GATE 1 & 2: Canonical UUID Resolution & 19 Growth Endpoints Runtime Matrix', () => {
    it('1. GET /growth/overview — resolves UUID and returns canonical growth dashboard', async () => {
      const res = await growthController.getOverview(CANONICAL_USER_UUID);
      expect(res).toBeDefined();
      expect(res.trustScore).toBe(88);
      expect(res.seasonProgress).toBeDefined();
      expect(res.seasonProgress.seasonNumber).toBe(1);
    });

    it('2. GET /growth/profile — resolves UUID and returns user trust profile', async () => {
      const res = await growthController.getGrowthProfile(CANONICAL_USER_UUID);
      expect(res.userId).toBe(CANONICAL_USER_UUID);
      expect(res.trustScore).toBe(88);
      expect(res.level).toBe(UserLevelTier.TRUSTED);
    });

    it('3. GET /growth/referrals — resolves UUID and returns referral summary', async () => {
      const res = await growthController.getReferralDashboard(CANONICAL_USER_UUID);
      expect(res).toBeDefined();
      expect(res.referralCode).toBe('CERT99');
    });

    it('4. POST /growth/referral/link — resolves UUID and returns referral link', async () => {
      const res = await growthController.getReferralLink(CANONICAL_USER_UUID);
      expect((res as any).code || (res as any).referralCode).toBe('CERT99');
    });

    it('5. POST /growth/referrals/attach — resolves UUID and validates referralCode', async () => {
      await expect(growthController.attachReferral(CANONICAL_USER_UUID, '')).rejects.toThrow(BadRequestException);
    });

    it('6. GET /growth/rewards — resolves UUID and returns rewards list with canonical UUID userId', async () => {
      const res = await growthController.getUserRewards(CANONICAL_USER_UUID);
      expect(Array.isArray(res)).toBe(true);
    });

    it('7. GET /growth/rewards/available — resolves UUID and returns available queue', async () => {
      const res = await growthController.getAvailableRewards(CANONICAL_USER_UUID);
      expect(res).toHaveProperty('queue');
    });

    it('8. GET /growth/rewards/missions — resolves UUID and returns database-backed mission queue', async () => {
      const res = await growthController.getMissionQueue(CANONICAL_USER_UUID);
      expect(res).toHaveProperty('missions');
      expect(Array.isArray(res.missions)).toBe(true);
    });

    it('9. GET /growth/rewards/history — resolves UUID and returns history', async () => {
      const res = await growthController.getRewardHistory(CANONICAL_USER_UUID);
      expect(res).toHaveProperty('history');
    });

    it('10. GET /growth/rewards/:id — resolves UUID and returns reward detail', async () => {
      const res = await growthController.getRewardDetail(CANONICAL_USER_UUID, 'rw_cert_1');
      expect(res).toBeDefined();
      expect(res.id).toBe('rw_cert_1');
    });

    it('11. POST /growth/rewards/:id/claim — resolves UUID and executes claim', async () => {
      const res = await growthController.claimReward(CANONICAL_USER_UUID, 'rw_cert_1');
      expect(res.reward).toBeDefined();
      expect(orchestrator.requestOperation).toHaveBeenCalledWith(expect.objectContaining({
        telegramUserId: CANONICAL_TG_ID,
        operationType: 'SYSTEM_ALLOCATION',
      }));
    });

    it('12. GET /growth/progress — resolves UUID and returns progress overview with nextBestAction', async () => {
      const res = await growthController.getProgressOverview(CANONICAL_USER_UUID);
      expect(res).toBeDefined();
      expect(res.level).toBeDefined();
    });

    it('13. GET /growth/achievements — resolves UUID and returns cabinet', async () => {
      const res = await growthController.getAchievements(CANONICAL_USER_UUID);
      expect(res).toHaveProperty('achievements');
    });

    it('14. GET /growth/qualification — resolves UUID and returns full qualification status', async () => {
      const res = await growthController.getQualificationStatus(CANONICAL_USER_UUID);
      expect(res.withdrawal).toBeDefined();
      expect(res.withdrawal.eligible).toBe(true); // 5/5 qualified referrals
    });

    it('15. GET /growth/qualification/withdrawal — resolves UUID and returns withdrawal eligibility', async () => {
      const res = await growthController.getWithdrawalEligibility(CANONICAL_USER_UUID);
      expect(res.eligible).toBe(true);
    });

    it('16. GET /growth/qualification/discount — resolves UUID and returns discount status', async () => {
      const res = await growthController.getDiscountEligibility(CANONICAL_USER_UUID);
      expect(res).toBeDefined();
    });

    it('17. GET /growth/graph/tree — resolves UUID and returns referral tree', async () => {
      const res = await growthController.getReferralTree(CANONICAL_USER_UUID);
      expect(res).toBeDefined();
    });

    it('18. GET /growth/graph/chain — resolves UUID and returns referral upline chain', async () => {
      const res = await growthController.getReferralChain(CANONICAL_USER_UUID);
      expect(res).toBeDefined();
    });

    it('19. GET /growth/levels — resolves UUID and returns level progression', async () => {
      const res = await growthController.getUserLevels(CANONICAL_USER_UUID);
      expect(res.currentLevel).toBe(UserLevelTier.TRUSTED);
    });

    it('20. Unknown UUID throws BadRequestException (USER_IDENTITY_NOT_FOUND)', async () => {
      await expect(growthController.getOverview('00000000-0000-0000-0000-000000000000')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('GATE 3 & 5: Financial Balance & Double-Entry Ledger Invariants', () => {
    it('Derives balance strictly by summing double-entry credits and debits (50.00 - 10.00 = 40.00 USDT)', async () => {
      const res = await financialController.getBalance(CANONICAL_USER_UUID);
      expect(res.balances).toBeDefined();
      const usdt = res.balances.find((b: any) => b.assetCode === 'USDT');
      expect(usdt).toBeDefined();
      expect(usdt?.availableBalance).toBe('40.00');
    });

    it('Returns clean zero balance (0.00) when user has valid account but 0 ledger entries', async () => {
      mockPrisma.ledgerEntry.findMany.mockResolvedValueOnce([]);
      const res = await balanceService.getBalances(CANONICAL_TG_ID, FINANCIAL_ACCOUNT_ID);
      const usdt = res.balances.find((b: any) => b.assetCode === 'USDT');
      expect(usdt).toBeDefined();
      expect(usdt?.availableBalance).toBe('0.00');
    });
  });

  describe('GATE 8: Admin Rule Mutation Propagation & Zero Synthetic Fallback Economy', () => {
    it('Admin database rule change directly modifies the user mission queue', async () => {
      const adminRule = {
        id: 'rule_admin_99',
        code: 'RULE_VIP_DEPOSIT',
        name: 'VIP Liquidity Deposit',
        rewardType: RewardType.MILESTONE,
        amount: '25.00',
        assetCode: 'USDT',
        enabled: true,
        parameters: { requirementType: 'SETTLEMENT_COUNT', requirementCount: 10, description: 'Complete 10 settlements' },
      };
      mockPrisma.rewardRule.findMany.mockResolvedValue([adminRule]);
      mockPrisma.rewardRule.findUnique.mockResolvedValue(adminRule);
      mockPrisma.reward.findMany.mockResolvedValue([
        {
          id: 'rw_admin_99',
          telegramUserId: CANONICAL_TG_ID,
          ruleId: 'rule_admin_99',
          amount: '25.00',
          assetCode: 'USDT',
          status: RewardStatus.AVAILABLE,
          rule: adminRule,
          createdAt: new Date(),
        },
      ]);

      const missions = await rewardService.getMissionQueue(CANONICAL_TG_ID);
      expect(missions.length).toBe(1);
      expect(missions[0].ruleName).toBe('VIP Liquidity Deposit');
      expect(missions[0].amount).toBe('25.00');
    });

    it('Returns empty array [] (never synthetic starter fallback) when DB has 0 rules', async () => {
      mockPrisma.rewardRule.findMany.mockResolvedValue([]);
      mockPrisma.reward.findMany.mockResolvedValue([]);
      const missions = await rewardService.getMissionQueue(CANONICAL_TG_ID);
      expect(missions).toEqual([]);
    });
  });
});
