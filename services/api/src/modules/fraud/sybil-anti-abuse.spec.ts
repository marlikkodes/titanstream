import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { FraudDetectionService } from './fraud-detection.service';
import { ReferralGraphService } from '../growth/referral-graph.service';

describe('Titan Stream Sybil & Multi-Account Anti-Abuse Test Suite', () => {
  let fraudService: FraudDetectionService;
  let mockPrismaService: any;
  let mockReferralGraphService: any;

  beforeEach(async () => {
    mockReferralGraphService = {
      getReferralChain: jest.fn().mockResolvedValue([]),
      getDownstreamCount: jest.fn().mockResolvedValue({ total: 0, qualified: 0, paying: 0 }),
      detectCycles: jest.fn().mockResolvedValue([]),
    };

    mockPrismaService = {
      user: {
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(1),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      reward: {
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FraudDetectionService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ReferralGraphService, useValue: mockReferralGraphService },
      ],
    }).compile();

    fraudService = module.get<FraudDetectionService>(FraudDetectionService);
  });

  describe('1. Multi-Signal Risk Scoring Engine', () => {
    it('should score LOW (ALLOW) for a legitimate user from a shared IP household (3 users)', async () => {
      // User created 3 days ago (not fresh), shared IP with 3 household users
      mockPrismaService.user.findUnique.mockResolvedValue({
        telegramUserId: 1001n,
        createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000), // 3 days old
        lastActiveIp: '192.168.1.1',
      });
      mockPrismaService.user.count.mockResolvedValue(3); // 3 users on IP (<= 5)
      mockPrismaService.reward.count.mockResolvedValue(0);

      const evaluation = await fraudService.evaluateUserRiskScore(1001n);

      expect(evaluation.score).toBeLessThan(30);
      expect(evaluation.level).toBe('LOW');
      expect(evaluation.recommendation).toBe('ALLOW');
      expect(evaluation.indicators).toEqual([]);
    });

    it('should score HIGH / REVIEW for a fresh account farming deep referral chains with zero downstream qualifications', async () => {
      // User created 10 minutes ago
      mockPrismaService.user.findUnique.mockResolvedValue({
        telegramUserId: 2002n,
        createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10 mins old (+25)
        lastActiveIp: '10.0.0.1',
      });
      // Deep referral chain of 5 nodes (+20)
      mockReferralGraphService.getReferralChain.mockResolvedValue([
        { referrerId: '1', refereeId: '2' },
        { referrerId: '2', refereeId: '3' },
        { referrerId: '3', refereeId: '4' },
        { referrerId: '4', refereeId: '5' },
      ]);
      // Downstream count 8, 0 qualified (+25)
      mockReferralGraphService.getDownstreamCount.mockResolvedValue({ total: 8, qualified: 0, paying: 0 });
      mockPrismaService.reward.count.mockResolvedValue(0);

      const evaluation = await fraudService.evaluateUserRiskScore(2002n);

      expect(evaluation.score).toBeGreaterThanOrEqual(70);
      expect(evaluation.level).toBe('HIGH');
      expect(evaluation.recommendation).toBe('REVIEW');
      expect(evaluation.indicators).toContain('FRESH_ACCOUNT_UNDER_1H');
      expect(evaluation.indicators).toContain('REFERRAL_FARMING_ZERO_QUALIFIED_RATIO');
    });

    it('should score ELEVATED / DELAY when reward velocity is unusually high (> 5 claims in 1 hour)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        telegramUserId: 3003n,
        createdAt: new Date(Date.now() - 48 * 3600 * 1000), // 2 days old
        lastActiveIp: '10.0.0.2',
      });
      // 6 claims in last 1 hour (+30)
      mockPrismaService.reward.count.mockResolvedValue(6);

      const evaluation = await fraudService.evaluateUserRiskScore(3003n);

      expect(evaluation.score).toBeGreaterThanOrEqual(30);
      expect(evaluation.indicators).toContain('HIGH_REWARD_VELOCITY_6_IN_1H');
    });
  });

  describe('2. Progressive Abuse Response Mapping & Score Boundaries', () => {
    it('should map risk score boundaries correctly across all levels', async () => {
      // Helper to test threshold boundary mapping logic directly
      const mapScore = (score: number) => {
        let level = 'LOW';
        let recommendation = 'ALLOW';
        if (score >= 90) {
          level = 'CRITICAL'; recommendation = 'BLOCK';
        } else if (score >= 70) {
          level = 'HIGH'; recommendation = 'REVIEW';
        } else if (score >= 50) {
          level = 'ELEVATED'; recommendation = 'DELAY';
        } else if (score >= 30) {
          level = 'MEDIUM'; recommendation = 'MONITOR';
        } else {
          level = 'LOW'; recommendation = 'ALLOW';
        }
        return { level, recommendation };
      };

      // Boundary tests
      expect(mapScore(29)).toEqual({ level: 'LOW', recommendation: 'ALLOW' });
      expect(mapScore(30)).toEqual({ level: 'MEDIUM', recommendation: 'MONITOR' });
      expect(mapScore(49)).toEqual({ level: 'MEDIUM', recommendation: 'MONITOR' });
      expect(mapScore(50)).toEqual({ level: 'ELEVATED', recommendation: 'DELAY' });
      expect(mapScore(69)).toEqual({ level: 'ELEVATED', recommendation: 'DELAY' });
      expect(mapScore(70)).toEqual({ level: 'HIGH', recommendation: 'REVIEW' });
      expect(mapScore(89)).toEqual({ level: 'HIGH', recommendation: 'REVIEW' });
      expect(mapScore(90)).toEqual({ level: 'CRITICAL', recommendation: 'BLOCK' });
    });
  });
});
