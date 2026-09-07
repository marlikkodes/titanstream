import { BadRequestException } from '@nestjs/common';
import { FinancialOperationType, AdminRole, Prisma } from '@prisma/client';
import { FinancialOrchestrationController } from './financial-orchestration.controller';
import { AdminPermission } from '../admin/interfaces/admin-permissions.enum';
import { MachineService } from '../machine/machine.service';

describe('Phase 1: Financial Security Lockdown (Adversarial Tests)', () => {
  describe('Financial Orchestration Security Gates', () => {
    let controller: FinancialOrchestrationController;
    let mockOrchestrator: any;
    let mockReconciliation: any;
    let mockPrisma: any;

    beforeEach(() => {
      mockOrchestrator = {
        requestOperation: jest.fn().mockResolvedValue({ status: 'COMPLETED', operationId: 'op_1' }),
      };
      mockReconciliation = {
        runFullReconciliation: jest.fn().mockResolvedValue({ status: 'AUDIT_SUCCESS' }),
        getRecentRuns: jest.fn().mockResolvedValue([]),
      };
      mockPrisma = {
        user: { findUnique: jest.fn() },
        financialOperation: { findMany: jest.fn() },
      };

      controller = new FinancialOrchestrationController(
        mockOrchestrator,
        mockReconciliation,
        mockPrisma,
      );
    });

    it('ADVERSARIAL: AdminAuthGuard and RbacGuard decorate requestOperation with BALANCE_ADJUST permission', () => {
      const guards = Reflect.getMetadata('__guards__', FinancialOrchestrationController.prototype.requestOperation);
      expect(guards).toBeDefined();
      expect(guards.length).toBeGreaterThanOrEqual(2);

      const permissions = Reflect.getMetadata('permissions', FinancialOrchestrationController.prototype.requestOperation);
      expect(permissions).toContain(AdminPermission.BALANCE_ADJUST);
    });

    it('ADVERSARIAL: Reconciliation endpoints require AdminAuthGuard and RECONCILIATION_RUN permission', () => {
      const triggerGuards = Reflect.getMetadata('__guards__', FinancialOrchestrationController.prototype.triggerReconciliation);
      expect(triggerGuards).toBeDefined();
      const triggerPermissions = Reflect.getMetadata('permissions', FinancialOrchestrationController.prototype.triggerReconciliation);
      expect(triggerPermissions).toContain(AdminPermission.RECONCILIATION_RUN);

      const runsGuards = Reflect.getMetadata('__guards__', FinancialOrchestrationController.prototype.listReconciliationRuns);
      expect(runsGuards).toBeDefined();
      const runsPermissions = Reflect.getMetadata('permissions', FinancialOrchestrationController.prototype.listReconciliationRuns);
      expect(runsPermissions).toContain(AdminPermission.RECONCILIATION_RUN);
    });

    it('Authorized admin can execute operation and audit metadata is stamped', async () => {
      const mockAdmin = {
        id: 'admin_super_1',
        username: 'super_cfo',
        email: 'cfo@titanstream.io',
        role: AdminRole.SUPER_ADMIN,
      };

      const dto = {
        idempotencyKey: 'adm_adj_101',
        operationType: FinancialOperationType.SYSTEM_ALLOCATION,
        assetCode: 'USDT',
        amount: '500.00',
        telegramUserId: '99887766',
        reference: 'audit_correction',
      };

      const result = await controller.requestOperation(mockAdmin as any, dto as any);

      expect(mockOrchestrator.requestOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operationType: FinancialOperationType.SYSTEM_ALLOCATION,
          amount: '500.00',
          telegramUserId: BigInt('99887766'),
          metadata: expect.objectContaining({
            executedByAdminId: 'admin_super_1',
            executedByAdminUsername: 'super_cfo',
          }),
        }),
      );
      expect(result).toEqual({ status: 'COMPLETED', operationId: 'op_1' });
    });
  });

  describe('Machine Purchasing Security & Sandbox Elimination', () => {
    let machineService: MachineService;
    let mockPrisma: any;
    let mockOrchestrator: any;
    let mockBalanceService: any;
    let mockPaymentOrderService: any;
    let mockNotification: any;
    let mockAudit: any;

    beforeEach(() => {
      mockPrisma = {
        user: { findFirst: jest.fn().mockResolvedValue({ telegramUserId: BigInt(123456) }) },
        userMachine: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
        financialAccount: { findUnique: jest.fn().mockResolvedValue({ id: 'acc_1', telegramUserId: BigInt(123456) }) },
        referralRelationship: { findUnique: jest.fn().mockResolvedValue(null) },
        growthContribution: { create: jest.fn() },
      };
      mockOrchestrator = {
        requestOperation: jest.fn().mockResolvedValue({ status: 'COMPLETED' }),
      };
      mockBalanceService = {
        getBalances: jest.fn().mockResolvedValue({
          balances: [{ assetCode: 'USDT', availableBalance: '0.00' }],
        }),
      };
      mockPaymentOrderService = {
        createOrder: jest.fn().mockResolvedValue({
          id: 'po_1',
          reference: 'PO-TEST-100',
          amount: 50,
          status: 'PENDING',
        }),
      };
      mockNotification = { createNotification: jest.fn() };
      mockAudit = { create: jest.fn() };

      machineService = new MachineService(
        mockPrisma,
        mockAudit,
        mockNotification,
        mockBalanceService,
        mockOrchestrator,
        mockPaymentOrderService,
      );
    });

    it('ADVERSARIAL: Rejects attempt to "purchase" TS_TRIAL complimentary core', async () => {
      await expect(
        machineService.purchaseMachine(BigInt(123456), 'TS_TRIAL'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        machineService.purchaseMachine(BigInt(123456), 'TS_TRIAL'),
      ).rejects.toThrow('CANNOT_PURCHASE_TRIAL_MACHINE');
    });

    it('ADVERSARIAL: Client cannot bypass payment via isSandbox or missing balance', async () => {
      // User has 0 available USDT balance
      const result = await machineService.purchaseMachine(BigInt(123456), 'TS_C10');

      // Must require funding and initiate deposit order; NEVER fulfill for free
      expect(result.success).toBe(false);
      expect(result.requiresFunding).toBe(true);
      expect(result.paymentOrder).toBeDefined();
      expect(result.paymentOrder?.reference).toBe('PO-TEST-100');
      expect(mockPrisma.userMachine.create).not.toHaveBeenCalled();
    });

    it('Legitimate purchase with sufficient balance executes real balance reservation', async () => {
      // Set user available balance to $100 USDT (sufficient for $10.99 TS_C10)
      mockBalanceService.getBalances.mockResolvedValueOnce({
        balances: [{ assetCode: 'USDT', availableBalance: '100.00' }],
      });
      mockPrisma.userMachine.create.mockResolvedValueOnce({
        id: 'mach_c10_1',
        telegramUserId: BigInt(123456),
        tierCode: 'TS_C10',
        name: 'Ripple X14',
        purchasePrice: new Prisma.Decimal(10.99),
        currency: 'USDT',
        status: 'ACTIVE',
        capacityGhs: new Prisma.Decimal(5.0),
        lifetimeEarnings: new Prisma.Decimal(0.0),
        purchasedAt: new Date(),
        activatedAt: new Date(),
      });

      const result = await machineService.purchaseMachine(BigInt(123456), 'TS_C10');

      expect(result.success).toBe(true);
      expect(result.requiresFunding).toBe(false);
      expect(result.machine).toBeDefined();
      expect(result.machine?.tierCode).toBe('TS_C10');

      // Double-entry reserve balance operation MUST be requested through orchestrator
      expect(mockOrchestrator.requestOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operationType: FinancialOperationType.WITHDRAWAL_RESERVE,
          amount: '10.99',
          assetCode: 'USDT',
          telegramUserId: BigInt(123456),
        }),
      );
    });
  });
});
