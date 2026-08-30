import { Test, TestingModule } from '@nestjs/testing';
import { SocialMissionService } from './social-mission.service';
import { SocialAttributionService } from './social-attribution.service';
import { PrismaService } from '../../database/prisma.service';
import { RewardService } from './reward.service';
import { GrowthContributionService } from './growth-contribution.service';
import { Prisma, SocialMissionTier, SocialParticipationStatus } from '@prisma/client';

describe('Titan Social Growth Economy & Over-Settlement Gate', () => {
  let socialMissionService: SocialMissionService;
  let socialAttributionService: SocialAttributionService;
  let mockPrisma: any;
  let mockRewardService: any;
  let mockContributionService: any;

  beforeEach(async () => {
    mockPrisma = {
      socialMission: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      socialMissionParticipation: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      socialAttribution: {
        create: jest.fn(),
      },
      growthContribution: {
        aggregate: jest.fn(),
      },
      user: {
        update: jest.fn(),
      },
    };

    mockRewardService = {
      createReward: jest.fn(),
    };

    mockContributionService = {
      recordContribution: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialMissionService,
        SocialAttributionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RewardService, useValue: mockRewardService },
        { provide: GrowthContributionService, useValue: mockContributionService },
      ],
    }).compile();

    socialMissionService = module.get<SocialMissionService>(SocialMissionService);
    socialAttributionService = module.get<SocialAttributionService>(SocialAttributionService);
  });

  describe('Economy A — Virtual Reward Isolation', () => {
    it('grants virtual crystals and XP without creating any USDT liability', async () => {
      mockPrisma.socialMission.findFirst.mockResolvedValue({
        id: 'soc_tg',
        code: 'SOCIAL_JOIN_TG',
        virtualRewardCrystals: 250,
        virtualRewardXp: 100,
        maxRewardUsdt: new Prisma.Decimal(0),
      });

      mockPrisma.socialMissionParticipation.findUnique.mockResolvedValue({
        id: 'part_1',
        socialMissionId: 'soc_tg',
        telegramUserId: 123456789n,
        virtualRewardsClaimed: false,
      });

      mockPrisma.socialMissionParticipation.update.mockResolvedValue({
        id: 'part_1',
        virtualRewardsClaimed: true,
      });

      const res = await socialMissionService.claimVirtualReward(123456789n, 'SOCIAL_JOIN_TG');

      expect(res.success).toBe(true);
      expect(res.crystals).toBe(250);
      expect(res.xp).toBe(100);
      expect(mockRewardService.createReward).not.toHaveBeenCalled(); // ZERO monetary liability created
    });
  });

  describe('Economy B — Over-Settlement Gate & Platform Margin Invariant', () => {
    it('keeps USDT reward locked when attributed net contribution is below threshold', async () => {
      mockPrisma.socialMissionParticipation.findUnique.mockResolvedValue({
        id: 'part_circle',
        status: SocialParticipationStatus.TRACKING,
        mission: {
          id: 'soc_circle',
          maxRewardUsdt: new Prisma.Decimal(2.0),
          requiredContributionUsdt: new Prisma.Decimal(10.0),
          rewardRate: new Prisma.Decimal(0.20),
          platformMarginBufferUsdt: new Prisma.Decimal(8.0),
        },
        attributions: [
          { refereeId: 222222222n, stage: 'SETTLED' },
        ],
      });

      // Referees only generated $4.00 net contribution (below $10.00 required)
      mockPrisma.growthContribution.aggregate.mockResolvedValue({
        _sum: { netContributionUsdt: new Prisma.Decimal(4.00) },
      });

      mockPrisma.socialMissionParticipation.update.mockImplementation(({ data }: any) => ({
        ...data,
      }));

      const res = await socialMissionService.evaluateOverSettlement('part_circle');

      expect(res).not.toBeNull();
      expect(res!.status).toBe(SocialParticipationStatus.VALUE_GENERATING);
      expect(Number(res!.verifiedContributionUsdt)).toBe(4.0);
      expect(Number(res!.unlockedRewardUsdt)).toBe(0.8); // 4 * 0.2
      expect(Number(res!.retainedMarginUsdt)).toBe(3.2);
    });

    it('unlocks USDT reward upon verified over-settlement while preserving 80% platform retained margin', async () => {
      mockPrisma.socialMissionParticipation.findUnique.mockResolvedValue({
        id: 'part_circle',
        status: SocialParticipationStatus.VALUE_GENERATING,
        mission: {
          id: 'soc_circle',
          maxRewardUsdt: new Prisma.Decimal(2.0),
          requiredContributionUsdt: new Prisma.Decimal(10.0),
          rewardRate: new Prisma.Decimal(0.20),
          platformMarginBufferUsdt: new Prisma.Decimal(8.0),
        },
        attributions: [
          { refereeId: 222222222n, stage: 'SETTLED' },
          { refereeId: 333333333n, stage: 'SETTLED' },
        ],
      });

      // Referees generated $11.00 net contribution (exceeds $10.00 threshold)
      mockPrisma.growthContribution.aggregate.mockResolvedValue({
        _sum: { netContributionUsdt: new Prisma.Decimal(11.00) },
      });

      mockPrisma.socialMissionParticipation.update.mockImplementation(({ data }: any) => ({
        ...data,
      }));

      const res = await socialMissionService.evaluateOverSettlement('part_circle');

      expect(res).not.toBeNull();
      expect(res!.status).toBe(SocialParticipationStatus.ELIGIBLE);
      expect(Number(res!.verifiedContributionUsdt)).toBe(11.0);
      expect(Number(res!.unlockedRewardUsdt)).toBe(2.0); // capped at maxRewardUsdt $2.00
      expect(Number(res!.retainedMarginUsdt)).toBe(9.0); // Titan retains $9.00 ($11.00 - $2.00 >= $8.00 buffer)
    });
  });

  describe('Anti-Fraud & Attribution Integrity', () => {
    it('detects and rejects self-referral attempts', async () => {
      mockPrisma.socialMissionParticipation.findUnique.mockResolvedValue({
        id: 'part_self',
        telegramUserId: 123456789n,
      });

      const res = await socialAttributionService.recordAttribution({
        trackingCode: 'TSG-CIRC-1234',
        refereeId: 123456789n, // Same user attempting self-attribution
        stage: 'CLICK',
      });

      expect(res).toBeNull();
      expect(mockPrisma.socialAttribution.create).not.toHaveBeenCalled();
    });
  });

  describe('Value Bank Analytical Aggregation', () => {
    it('aggregates value generated, unlocked cash, and retained protocol surplus accurately', async () => {
      mockPrisma.socialMissionParticipation.findMany.mockResolvedValue([
        {
          verifiedContributionUsdt: new Prisma.Decimal(10.0),
          unlockedRewardUsdt: new Prisma.Decimal(2.0),
          retainedMarginUsdt: new Prisma.Decimal(8.0),
          virtualRewardsClaimed: true,
          status: SocialParticipationStatus.CLAIMED,
          mission: { virtualRewardCrystals: 500 },
        },
        {
          verifiedContributionUsdt: new Prisma.Decimal(15.0),
          unlockedRewardUsdt: new Prisma.Decimal(3.0),
          retainedMarginUsdt: new Prisma.Decimal(12.0),
          virtualRewardsClaimed: true,
          status: SocialParticipationStatus.ELIGIBLE,
          mission: { virtualRewardCrystals: 1500 },
        },
      ]);

      const valueBank = await socialMissionService.getUserValueBank(123456789n);

      expect(valueBank.totalValueGeneratedUsdt).toBe(25.0);
      expect(valueBank.unlockedRewardsUsdt).toBe(5.0);
      expect(valueBank.retainedContributionUsdt).toBe(20.0);
      expect(valueBank.totalCrystalsEarned).toBe(2000);
      expect(valueBank.completedMissionsCount).toBe(2);
    });
  });
});
