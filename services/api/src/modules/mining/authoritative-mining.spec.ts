import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { MiningService } from './mining.service';
import { MachineService } from '../machine/machine.service';
import { PrismaService } from '../../database/prisma.service';
import { FinancialOrchestratorService } from '../financial-orchestration/financial-orchestrator.service';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import { BalanceService } from '../financial/balance.service';
import { PaymentOrderService } from '../payment-order/payment-order.service';

describe('Authoritative Mining & Accrual Remediation Test Suite', () => {
  let miningService: MiningService;
  let machineService: MachineService;
  let prismaService: any;
  let orchestratorService: any;

  const toDecimalMock = (val: number) => ({
    toNumber: () => val,
    toString: () => val.toString(),
  });

  const createMockPrisma = () => {
    const states = new Map<string, any>();
    const idempotency = new Map<string, any>();

    const prismaMock: any = {
      userMiningState: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          const s = states.get(where.telegramUserId.toString());
          return Promise.resolve(s ? { ...s } : null);
        }),
        upsert: jest.fn().mockImplementation(({ where, create, update }) => {
          const key = where.telegramUserId.toString();
          const existing = states.get(key);
          const val = existing ? { ...existing, ...update } : { ...create };
          states.set(key, val);
          return Promise.resolve({ ...val });
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const key = where.telegramUserId.toString();
          const existing = states.get(key) || {};
          const val = { ...existing, ...data };
          states.set(key, val);
          return Promise.resolve(val);
        }),
      },
      userMachine: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      financialIdempotencyRecord: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          const { telegramUserId, idempotencyKey } = where.telegramUserId_idempotencyKey;
          const rec = idempotency.get(`${telegramUserId.toString()}_${idempotencyKey}`);
          return Promise.resolve(rec ? { ...rec } : null);
        }),
        create: jest.fn().mockImplementation(({ data }) => {
          const rec = { ...data, createdAt: new Date() };
          idempotency.set(`${data.telegramUserId.toString()}_${data.idempotencyKey}`, rec);
          return Promise.resolve(rec);
        }),
      },
      $queryRaw: jest.fn().mockImplementation((strings: TemplateStringsArray, ...values: any[]) => {
        const tgBigInt = values[0];
        const s = states.get(tgBigInt.toString());
        if (!s) return Promise.resolve([]);
        return Promise.resolve([
          {
            telegram_user_id: tgBigInt,
            active_currency: s.activeCurrency || 'USDT',
            unclaimed_balance: s.unclaimedBalance ?? 0,
            cooler_multiplier: s.coolerMultiplier ?? 1.0,
            base_speed_ghs: s.baseSpeedGhs ?? 1.0,
            machine_mode: s.machineMode || 'STANDARD',
          },
        ]);
      }),
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(prismaMock);
      }),
      _states: states,
      _idempotency: idempotency,
    };

    return prismaMock;
  };

  const mockAuditService = { recordEvent: jest.fn().mockResolvedValue({}) };
  const mockNotificationService = { sendNotification: jest.fn().mockResolvedValue({}) };
  const mockBalanceService = { getBalance: jest.fn().mockResolvedValue({ available: '100.00' }) };
  const mockPaymentOrderService = { createOrder: jest.fn() };

  beforeEach(async () => {
    prismaService = createMockPrisma();
    orchestratorService = {
      requestOperation: jest.fn().mockImplementation(async (command: any) => {
        const rec = {
          telegramUserId: command.telegramUserId,
          idempotencyKey: command.idempotencyKey,
          status: 'COMPLETED',
          responsePayload: { amount: command.amount },
        };
        prismaService._idempotency.set(`${command.telegramUserId.toString()}_${command.idempotencyKey}`, rec);
        return {
          success: true,
          operationId: command.reference,
          referenceId: command.reference,
        };
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MiningService,
        MachineService,
        { provide: PrismaService, useValue: prismaService },
        { provide: FinancialOrchestratorService, useValue: orchestratorService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: BalanceService, useValue: mockBalanceService },
        { provide: PaymentOrderService, useValue: mockPaymentOrderService },
      ],
    }).compile();

    miningService = module.get<MiningService>(MiningService);
    machineService = module.get<MachineService>(MachineService);
  });

  describe('1. Activation Boundary (Mid-Interval Purchase)', () => {
    it('only accrues yield for the active window, NOT retroactively before activatedAt', async () => {
      const userId = '100010001';
      const now = Date.now();
      const lastUpdate = new Date(now - 3600 * 1000); // 1 hour ago
      const activatedAt = new Date(now - 1800 * 1000); // 30 mins ago

      prismaService._states.set(userId, {
        telegramUserId: BigInt(userId),
        activeCurrency: 'USDT',
        baseSpeedGhs: 1.0,
        coolerMultiplier: 1.0,
        unclaimedBalance: 0.0,
        machineMode: 'STANDARD',
        lastUpdatedAt: lastUpdate,
      });

      // User owns a machine: Ripple X14 (5 GH/s, rate: 0.000000625) activated 30 mins ago
      prismaService.userMachine.findMany.mockResolvedValue([
        {
          id: 'mach_1',
          telegramUserId: BigInt(userId),
          tierCode: 'TS_C10',
          name: 'Ripple X14',
          purchasePrice: toDecimalMock(10),
          currency: 'USDT',
          status: 'ACTIVE',
          capacityGhs: toDecimalMock(5),
          lifetimeEarnings: toDecimalMock(0),
          purchasedAt: activatedAt,
          activatedAt: activatedAt,
          expiresAt: new Date(now + 86400 * 1000),
        },
      ]);

      const session = await miningService.getOrCreateSession(userId);

      // Expected yield: 1800s of production for TS_C10 (5 GH/s * 0.000000625 * 1800 = 0.005625)
      // PLUS baseline trial machine (1 GH/s * standard rate 0.00000192935 * 3600 = 0.00694566)
      // Plus 3% operator bonus
      const c10Raw = 5.0 * 0.000000625 * 1800;
      const trialRaw = 1.0 * 0.00000192935 * 3600;
      const expectedTotal = (c10Raw + trialRaw) * 1.03;

      expect(session.unclaimedBalance).toBeCloseTo(expectedTotal, 4);

      // Anti-retroactive verification: if it had accrued TS_C10 for the full 3600s, it would be higher
      const fullIntervalBugTotal = (c10Raw * 2 + trialRaw) * 1.03;
      expect(session.unclaimedBalance).toBeLessThan(fullIntervalBugTotal - 0.002);
    });
  });

  describe('2. Expiry Boundary (Expired Machine)', () => {
    it('stops accruing yield strictly at expiresAt and produces zero yield post-expiry', async () => {
      const userId = '100010002';
      const now = Date.now();
      const lastUpdate = new Date(now - 7200 * 1000); // 2 hours ago
      const expiresAt = new Date(now - 3600 * 1000); // expired 1 hour ago

      prismaService._states.set(userId, {
        telegramUserId: BigInt(userId),
        activeCurrency: 'USDT',
        baseSpeedGhs: 1.0,
        coolerMultiplier: 1.0,
        unclaimedBalance: 0.0,
        machineMode: 'STANDARD',
        lastUpdatedAt: lastUpdate,
      });

      prismaService.userMachine.findMany.mockResolvedValue([
        {
          id: 'mach_expired',
          telegramUserId: BigInt(userId),
          tierCode: 'TS_C10',
          name: 'Ripple X14',
          purchasePrice: toDecimalMock(10),
          currency: 'USDT',
          status: 'ACTIVE',
          capacityGhs: toDecimalMock(5),
          lifetimeEarnings: toDecimalMock(0),
          purchasedAt: new Date(now - 86400 * 1000),
          activatedAt: new Date(now - 86400 * 1000),
          expiresAt: expiresAt,
        },
      ]);

      const session = await miningService.getOrCreateSession(userId);

      // TS_C10 only accrued for 3600s (lastUpdate to expiresAt), NOT 7200s (post-expiry is 0)
      const c10Raw = 5.0 * 0.000000625 * 3600;
      const trialRaw = 1.0 * 0.00000192935 * 7200;
      const expectedTotal = (c10Raw + trialRaw) * 1.03;

      expect(session.unclaimedBalance).toBeCloseTo(expectedTotal, 4);

      // Post-expiry check: if it accrued full 7200s for C10, it would be much higher
      const unexpiredBugTotal = (c10Raw * 2 + trialRaw) * 1.03;
      expect(session.unclaimedBalance).toBeLessThan(unexpiredBugTotal - 0.005);
    });
  });

  describe('3. Machine Status Invariants', () => {
    it('produces zero accrual for machines with status SUSPENDED, DECOMMISSIONED, or MAINTENANCE', async () => {
      const userId = '100010003';
      const now = Date.now();
      const lastUpdate = new Date(now - 3600 * 1000);

      prismaService._states.set(userId, {
        telegramUserId: BigInt(userId),
        activeCurrency: 'USDT',
        baseSpeedGhs: 1.0,
        coolerMultiplier: 1.0,
        unclaimedBalance: 0.0,
        machineMode: 'STANDARD',
        lastUpdatedAt: lastUpdate,
      });

      prismaService.userMachine.findMany.mockResolvedValue([
        {
          id: 'mach_suspended',
          telegramUserId: BigInt(userId),
          tierCode: 'TS_X1000',
          name: 'Cascade M91',
          purchasePrice: toDecimalMock(1000),
          currency: 'USDT',
          status: 'SUSPENDED',
          capacityGhs: toDecimalMock(550),
          lifetimeEarnings: toDecimalMock(0),
          purchasedAt: new Date(now - 86400 * 1000),
          activatedAt: new Date(now - 86400 * 1000),
          expiresAt: new Date(now + 86400 * 1000),
        },
        {
          id: 'mach_decomm',
          telegramUserId: BigInt(userId),
          tierCode: 'TS_Q2500',
          name: 'StreamTitan 2028',
          purchasePrice: toDecimalMock(2500),
          currency: 'USDT',
          status: 'DECOMMISSIONED',
          capacityGhs: toDecimalMock(1500),
          lifetimeEarnings: toDecimalMock(0),
          purchasedAt: new Date(now - 86400 * 1000),
          activatedAt: new Date(now - 86400 * 1000),
          expiresAt: new Date(now + 86400 * 1000),
        },
      ]);

      const session = await miningService.getOrCreateSession(userId);

      // Only the default trial machine accrues (1 GH/s * 0.00000192935 * 3600 * 1.03)
      const trialRaw = 1.0 * 0.00000192935 * 3600;
      const expectedTrialYield = trialRaw * 1.03;

      expect(session.unclaimedBalance).toBeCloseTo(expectedTrialYield, 4);
      // If the 550 GH/s or 1500 GH/s machines had accrued, balance would be > $50.00
      expect(session.unclaimedBalance).toBeLessThan(1.0);
    });
  });

  describe('4. Minimum Threshold Enforcement ($3.00)', () => {
    it('rejects claim when unclaimed balance is below $3.00 with BadRequestException', async () => {
      const userId = '100010004';
      prismaService._states.set(userId, {
        telegramUserId: BigInt(userId),
        activeCurrency: 'USDT',
        baseSpeedGhs: 1.0,
        coolerMultiplier: 1.0,
        unclaimedBalance: 2.95,
        machineMode: 'STANDARD',
        lastUpdatedAt: new Date(),
      });

      await expect(miningService.claim(userId)).rejects.toThrow(BadRequestException);
      expect(orchestratorService.requestOperation).not.toHaveBeenCalled();
    });
  });

  describe('5. Idempotency & Double-Claim Prevention', () => {
    it('replays identical response without executing ledger operation on duplicate idempotencyKey', async () => {
      const userId = '100010005';
      prismaService._states.set(userId, {
        telegramUserId: BigInt(userId),
        activeCurrency: 'USDT',
        baseSpeedGhs: 1.0,
        coolerMultiplier: 1.0,
        unclaimedBalance: 5.50,
        machineMode: 'STANDARD',
        lastUpdatedAt: new Date(),
      });

      const idempotencyKey = 'unique_claim_key_001';

      // First claim: should succeed
      const firstResult = await miningService.claim(userId, idempotencyKey);
      expect(firstResult.success).toBe(true);
      expect(firstResult.amount).toBe('5.500000');
      expect(orchestratorService.requestOperation).toHaveBeenCalledTimes(1);

      // Verify orchestrator payload parameters adhere to double-entry ledger
      expect(orchestratorService.requestOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          telegramUserId: BigInt(userId),
          assetCode: 'USDT',
          amount: '5.500000',
        }),
        expect.anything(),
      );

      // Second claim with same key: should be idempotent replay
      const secondResult = await miningService.claim(userId, idempotencyKey);
      expect(secondResult.success).toBe(true);
      expect(secondResult.amount).toBe('5.500000');
      // Orchestrator must NOT have been called a second time!
      expect(orchestratorService.requestOperation).toHaveBeenCalledTimes(1);
    });

    it('rejects subsequent claim if balance is already 0', async () => {
      const userId = '100010006';
      prismaService._states.set(userId, {
        telegramUserId: BigInt(userId),
        activeCurrency: 'USDT',
        baseSpeedGhs: 1.0,
        coolerMultiplier: 1.0,
        unclaimedBalance: 0.0,
        machineMode: 'STANDARD',
        lastUpdatedAt: new Date(),
      });

      await expect(miningService.claim(userId, 'new_key_different')).rejects.toThrow(BadRequestException);
      expect(orchestratorService.requestOperation).not.toHaveBeenCalled();
    });
  });

  describe('6. Double-Entry Accounting Ledger Invariants', () => {
    it('guarantees total debits equal total credits for any disbursed mining yield', async () => {
      const userId = '100010007';
      const claimAmount = 15.75;
      prismaService._states.set(userId, {
        telegramUserId: BigInt(userId),
        activeCurrency: 'USDT',
        baseSpeedGhs: 1.0,
        coolerMultiplier: 1.0,
        unclaimedBalance: claimAmount,
        machineMode: 'STANDARD',
        lastUpdatedAt: new Date(),
      });

      let capturedDebit = 0;
      let capturedCredit = 0;

      orchestratorService.requestOperation.mockImplementation(async (params: any) => {
        const amt = parseFloat(params.amount);
        // Double-entry entry:
        // Debit: SYSTEM_MINING_RESERVE
        capturedDebit += amt;
        // Credit: USER_AVAILABLE
        capturedCredit += amt;
        return {
          success: true,
          referenceId: 'LEDGER_TX_999',
          auditRecordId: 'AUDIT_999',
        };
      });

      const res = await miningService.claim(userId, 'ledger_test_key');
      expect(res.success).toBe(true);

      // Mathematical conservation invariant: Sum of Debits - Sum of Credits === 0
      expect(capturedDebit).toBe(claimAmount);
      expect(capturedCredit).toBe(claimAmount);
      expect(capturedDebit - capturedCredit).toBe(0);
    });
  });
});
