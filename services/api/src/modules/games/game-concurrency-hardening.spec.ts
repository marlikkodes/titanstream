import { Test, TestingModule } from '@nestjs/testing';
import { GameCrystalService } from './game-crystal.service';
import { GameRewardService } from './game-reward.service';
import { EconomicIntelligenceService } from './economic-intelligence.service';
import { PrismaService } from '../../database/prisma.service';
import { RewardService } from '../growth/reward.service';
import { GameEventService } from './game-event.service';
import { GameCatalogService } from './game-catalog.service';
import { CrystalTransactionType } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('Game Economy & Crystal Concurrency Hardening (Unit & Invariant Spec)', () => {
  let crystalService: GameCrystalService;
  let rewardService: GameRewardService;
  let economicService: EconomicIntelligenceService;
  let mockPrisma: any;

  beforeEach(async () => {
    const mockAccounts = new Map<string, any>();
    const mockTransactions = new Map<string, any>();

    mockPrisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'user-1', telegramUserId: BigInt(123456789) }),
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1', telegramUserId: BigInt(123456789) }),
        upsert: jest.fn().mockResolvedValue({ telegramUserId: BigInt(123456789) }),
      },
      crystalAccount: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          const key = where.telegramUserId?.toString() || where.id;
          return Promise.resolve(mockAccounts.get(key) || null);
        }),
        findUniqueOrThrow: jest.fn().mockImplementation(({ where }) => {
          const key = where.telegramUserId?.toString() || where.id;
          const acc = mockAccounts.get(key);
          if (!acc) throw new Error('Account not found');
          return Promise.resolve(acc);
        }),
        create: jest.fn().mockImplementation(({ data }) => {
          const acc = {
            id: `ca_${data.telegramUserId}`,
            telegramUserId: data.telegramUserId,
            balance: data.balance ?? 100,
            lifetimeEarned: data.balance ?? 100,
            lifetimeSpent: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockAccounts.set(data.telegramUserId.toString(), acc);
          mockAccounts.set(acc.id, acc);
          return Promise.resolve(acc);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const key = where.telegramUserId?.toString() || where.id;
          const acc = mockAccounts.get(key);
          if (!acc) throw new Error('Account not found');

          if (data.balance?.increment) {
            acc.balance += data.balance.increment;
            acc.lifetimeEarned += data.balance.increment;
          }
          if (data.balance?.decrement) {
            acc.balance -= data.balance.decrement;
            acc.lifetimeSpent += data.balance.decrement;
          }
          acc.updatedAt = new Date();
          return Promise.resolve({ ...acc });
        }),
        updateMany: jest.fn().mockImplementation(({ where, data }) => {
          const key = where.id;
          const acc = mockAccounts.get(key);
          if (!acc) return Promise.resolve({ count: 0 });

          if (where.balance?.gte !== undefined && acc.balance < where.balance.gte) {
            return Promise.resolve({ count: 0 });
          }

          if (data.balance?.decrement) {
            acc.balance -= data.balance.decrement;
            acc.lifetimeSpent += data.balance.decrement;
          }
          return Promise.resolve({ count: 1 });
        }),
        aggregate: jest.fn().mockResolvedValue({
          _sum: { balance: 5000, lifetimeEarned: 10000, lifetimeSpent: 5000 },
          _count: { _all: 50 },
        }),
        count: jest.fn().mockResolvedValue(50),
      },
      crystalTransaction: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          return Promise.resolve(mockTransactions.get(where.reference) || null);
        }),
        create: jest.fn().mockImplementation(({ data }) => {
          const tx = { id: `ctx_${Date.now()}_${Math.random()}`, ...data, createdAt: new Date() };
          mockTransactions.set(data.reference, tx);
          return Promise.resolve(tx);
        }),
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 10000 } }),
      },
      gameSession: {
        count: jest.fn().mockResolvedValue(120),
        findMany: jest.fn().mockResolvedValue([]),
      },
      reward: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: { toNumber: () => 15.5 } } }),
      },
      growthContribution: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { netContributionUsdt: { toNumber: () => 45.0 } } }),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => {
        if (typeof cb === 'function') {
          return cb(mockPrisma);
        }
        return Promise.all(cb);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameCrystalService,
        GameRewardService,
        EconomicIntelligenceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RewardService, useValue: { createReward: jest.fn() } },
        { provide: GameEventService, useValue: { resolveMultipliers: jest.fn().mockResolvedValue({ crystalMultiplier: 1, usdtMultiplier: 1, events: [] }) } },
        {
          provide: GameCatalogService,
          useValue: {
            listGames: jest.fn().mockResolvedValue([
              { gameId: 'crypto-roulette', name: 'Crypto Roulette' },
              { gameId: 'hoop-masters', name: 'Hoop Masters' },
            ]),
          },
        },
      ],
    }).compile();

    crystalService = module.get<GameCrystalService>(GameCrystalService);
    rewardService = module.get<GameRewardService>(GameRewardService);
    economicService = module.get<EconomicIntelligenceService>(EconomicIntelligenceService);
  });

  describe('1. Atomic Concurrency & Invariant Guarantees', () => {
    it('enforces non-negative balance invariant: debit fails when balance is insufficient', async () => {
      const tgId = BigInt(999001);
      // Create initial account with 10 crystals
      await mockPrisma.crystalAccount.create({ data: { telegramUserId: tgId, balance: 10 } });

      // Attempt to debit 15 crystals
      await expect(
        crystalService.debit(tgId, 15, CrystalTransactionType.GAME_ENTRY, 'ref_fail_01'),
      ).rejects.toThrow(BadRequestException);

      // Verify balance was untouched
      const balance = await crystalService.getBalance(tgId);
      expect(balance).toBe(10);
    });

    it('handles concurrent debits safely: only permitted debits succeed and balance never goes negative', async () => {
      const tgId = BigInt(999002);
      await mockPrisma.crystalAccount.create({ data: { telegramUserId: tgId, balance: 10 } });

      // Send 5 concurrent debits of 5 crystals (only 2 can succeed with balance=10)
      const attempts = [1, 2, 3, 4, 5].map((i) =>
        crystalService
          .debit(tgId, 5, CrystalTransactionType.GAME_ENTRY, `ref_conc_${i}`)
          .then((bal) => ({ success: true, bal }))
          .catch((err) => ({ success: false, error: err.message })),
      );

      const results = await Promise.all(attempts);
      const successes = results.filter((r) => r.success);
      const failures = results.filter((r) => !r.success);

      expect(successes.length).toBe(2);
      expect(failures.length).toBe(3);

      const finalBalance = await crystalService.getBalance(tgId);
      expect(finalBalance).toBe(0);
      expect(finalBalance).toBeGreaterThanOrEqual(0);
    });

    it('enforces strict idempotency: replaying a credit with identical reference returns cached balance', async () => {
      const tgId = BigInt(999003);
      await mockPrisma.crystalAccount.create({ data: { telegramUserId: tgId, balance: 100 } });

      const bal1 = await crystalService.credit(tgId, 25, CrystalTransactionType.DAILY_LOGIN, 'ref_idempotent_01');
      expect(bal1).toBe(125);

      // Replay same reference
      const bal2 = await crystalService.credit(tgId, 25, CrystalTransactionType.DAILY_LOGIN, 'ref_idempotent_01');
      expect(bal2).toBe(125);

      const finalBalance = await crystalService.getBalance(tgId);
      expect(finalBalance).toBe(125);
    });

    it('enforces strict idempotency on debits: replaying a debit returns existing balanceAfter without double-charging', async () => {
      const tgId = BigInt(999004);
      await mockPrisma.crystalAccount.create({ data: { telegramUserId: tgId, balance: 50 } });

      const bal1 = await crystalService.debit(tgId, 10, CrystalTransactionType.GAME_ENTRY, 'ref_debit_idem_01');
      expect(bal1).toBe(40);

      const bal2 = await crystalService.debit(tgId, 10, CrystalTransactionType.GAME_ENTRY, 'ref_debit_idem_01');
      expect(bal2).toBe(40);

      const finalBalance = await crystalService.getBalance(tgId);
      expect(finalBalance).toBe(40);
    });
  });

  describe('2. Cryptographic RNG & Randomness Guarantees', () => {
    it('produces valid outcomes across chance game sectors using cryptographic entropy', async () => {
      const mockGame: any = {
        gameId: 'crypto-roulette',
        rewardConfig: {
          chanceGame: true,
          sectors: [
            { label: '2 💎', type: 'CRYSTALS', value: 2, weight: 40 },
            { label: '5 💎', type: 'CRYSTALS', value: 5, weight: 25 },
            { label: '10 💎', type: 'CRYSTALS', value: 10, weight: 15 },
          ],
        },
      };

      for (let i = 0; i < 20; i++) {
        const outcome = await rewardService.decideOutcome(mockGame, `ref_rnd_${i}`);
        expect(outcome).not.toBeNull();
        expect(outcome!.sectorIndex).toBeGreaterThanOrEqual(0);
        expect(outcome!.sectorIndex).toBeLessThan(3);
      }
    });
  });

  describe('3. Economic Intelligence & Shadow Governor', () => {
    it('reports governor status in strictly OBSERVE mode without live mutation authority', () => {
      const status = economicService.getGovernorStatus();
      expect(status.mode).toBe('OBSERVE');
      expect(status.activePolicy.status).toBe('ACTIVE');
      expect(status.activePolicy.version).toBe('v1.0.0-baseline');
      expect(status.shadowPolicies.length).toBeGreaterThan(0);
    });

    it('executes deterministic, read-only policy simulation and evaluates inflation risk', async () => {
      const result = await economicService.simulateScenario({
        scenarioName: 'Test High Reward Scenario',
        proposedCostDeltaPercent: 0,
        proposedRewardMultiplier: 2.5,
        simulatedDau: 500,
        timeHorizonDays: 14,
      });

      expect(result.mode).toBe('READ_ONLY_SIMULATION');
      expect(result.governorRecommendation).toBe('REJECTED_HIGH_INFLATION');
      expect(typeof result.baselineProjectedEmission).toBe('number');
      expect(typeof result.simulatedProjectedEmission).toBe('number');
    });

    it('calculates Net Economic Value (NEV) with documented data provenance', async () => {
      const nevReport = await economicService.calculateNetEconomicValue();
      expect(nevReport.period).toBe('LIFETIME_TO_DATE');
      expect(nevReport.confidence).toBe('MEASURED');
      expect(nevReport.dataSources.measuredGrossPlatformMarginUsdt).toBe('OBSERVED_DATABASE');
      expect(nevReport.dataSources.directRewardCostUsdt).toBe('OBSERVED_DATABASE');
      expect(nevReport.dataSources.infrastructureCostEstimateUsdt).toBe('ESTIMATED_INFRA');
    });
  });
});
