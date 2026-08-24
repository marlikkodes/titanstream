import { Test } from '@nestjs/testing';
import { AchievementService } from './achievement.service';
import { PrismaService } from '../../database/prisma.service';

describe('AchievementService', () => {
  let service: AchievementService;
  let prisma: any;

  const mockPrisma = {
    reward: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ qualifiedReferrals: 0 }),
    },
    userMachine: {
      count: jest.fn().mockResolvedValue(0),
    },
    settlementSession: {
      count: jest.fn().mockResolvedValue(0),
    },
    userLevelRecord: {
      findUnique: jest.fn().mockResolvedValue({ currentLevel: 'NEW' }),
    },
    gameSession: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    gamePlayerStat: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    achievement: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'a1', ...data })),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'a1', ...data })),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [AchievementService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<AchievementService>(AchievementService);
    prisma = module.get(PrismaService);
  });

  describe('streak computation', () => {
    it('computes a current streak anchored at today', async () => {
      const today = new Date();
      const days = [today];
      for (let i = 1; i <= 3; i++) {
        const d = new Date(today);
        d.setUTCDate(d.getUTCDate() - i);
        days.push(d);
      }
      prisma.reward.findMany.mockResolvedValue(
        days.map((d) => ({ processedAt: d })),
      );

      const { current, best } = await service.getClaimStreakInfo(100n);
      expect(current).toBe(4);
      expect(best).toBe(4);
    });

    it('returns 0 current when the streak was broken yesterday', async () => {
      const today = new Date();
      const d1 = new Date(today);
      d1.setUTCDate(d1.getUTCDate() - 2);
      const d2 = new Date(today);
      d2.setUTCDate(d2.getUTCDate() - 3);

      prisma.reward.findMany.mockResolvedValue([{ processedAt: d1 }, { processedAt: d2 }]);

      const { current, best } = await service.getClaimStreakInfo(100n);
      expect(current).toBe(0);
      expect(best).toBe(2);
    });
  });

  describe('reconcileAchievements', () => {
    it('creates achievement rows and reports newly unlocked ones', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ qualifiedReferrals: 3 });
      mockPrisma.userMachine.count.mockResolvedValue(2);
      mockPrisma.settlementSession.count.mockResolvedValue(5);
      mockPrisma.reward.count.mockResolvedValue(1);

      const unlocked = await service.reconcileAchievements(100n);
      expect(prisma.achievement.create).toHaveBeenCalled();
      const created = prisma.achievement.create.mock.calls.map((c: any) => c[0].data);
      expect(created.some((c: any) => c.code === 'NETWORK_BUILDER' && c.achievedAt)).toBe(true);
      expect(created.some((c: any) => c.code === 'FIRST_SETTLEMENT' && c.achievedAt)).toBe(true);
      expect(created.some((c: any) => c.code === 'FIRST_MACHINE' && c.achievedAt)).toBe(true);
      expect(created.some((c: any) => c.code === 'FIRST_REWARD' && c.achievedAt)).toBe(true);
      expect(created.some((c: any) => c.code === 'SETTLEMENT_VETERAN' && c.achievedAt)).toBe(false);
      expect(unlocked.some((u) => u.code === 'NETWORK_BUILDER')).toBe(true);
    });
  });
});
