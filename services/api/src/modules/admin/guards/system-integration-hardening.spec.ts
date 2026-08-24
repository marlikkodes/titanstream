import { AdminManagementService } from '../services/admin-management.service';
import { CommandCenterConfigService } from '../services/command-center-config.service';
import { PlatformOperationsEngineService } from '../services/platform-operations-engine.service';
import { AdminRole } from '@prisma/client';

describe('System-Wide Integration Hardening & Source-of-Truth Test Suite', () => {
  let prismaMock: any;
  let auditServiceMock: any;
  let userInvestigationMock: any;
  let financialAdminMock: any;
  let adminManagementService: AdminManagementService;
  let commandCenterConfigService: CommandCenterConfigService;
  let platformOperationsEngine: PlatformOperationsEngineService;

  beforeEach(() => {
    prismaMock = {
      adminUser: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      mobileMoneyMerchant: {
        findMany: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
      },
      usdtConfig: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      platformOperationalConfig: {
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
      },
      operationsQueueItem: { count: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      riskEvent: { count: jest.fn() },
      supportCase: { count: jest.fn() },
      user: { count: jest.fn() },
      auditEvent: { findMany: jest.fn() },
      settlementProviderHealth: { findMany: jest.fn() },
      $transaction: jest.fn((cb) => cb(prismaMock)),
    };

    auditServiceMock = {
      logAction: jest.fn().mockResolvedValue({ id: 'audit_1' }),
    };

    userInvestigationMock = {};
    financialAdminMock = {};

    adminManagementService = new AdminManagementService(prismaMock as any);
    commandCenterConfigService = new CommandCenterConfigService(prismaMock as any);
    platformOperationsEngine = new PlatformOperationsEngineService(
      prismaMock as any,
      auditServiceMock as any,
      userInvestigationMock as any,
      financialAdminMock as any,
    );
  });

  describe('1. Authoritative Admin Identity & Persistence', () => {
    it('1.1 Should read admin accounts from PostgreSQL AdminUser table', async () => {
      prismaMock.adminUser.findMany.mockResolvedValue([
        {
          id: 'admin_db_1',
          username: 'super_admin_1',
          email: 'super@titanstream.io',
          role: AdminRole.SUPER_ADMIN,
          isActive: true,
          updatedAt: new Date(),
          createdAt: new Date(),
        },
      ]);

      const admins = await adminManagementService.getAdminAccounts();
      expect(prismaMock.adminUser.findMany).toHaveBeenCalled();
      expect(admins.length).toBe(1);
      expect(admins[0].id).toBe('admin_db_1');
      expect(admins[0].role).toBe(AdminRole.SUPER_ADMIN);
    });

    it('1.2 Should persist invited admin users to PostgreSQL AdminUser table', async () => {
      prismaMock.adminUser.create.mockResolvedValue({
        id: 'admin_db_new',
        username: 'ops_lead_881923',
        email: 'ops_lead_881923@titanstream.io',
        role: AdminRole.OPERATIONS_ADMIN,
        isActive: true,
        createdAt: new Date(),
      });

      const invited = await adminManagementService.inviteAdmin({
        telegramUserId: '881923',
        name: 'Ops Lead',
        role: AdminRole.OPERATIONS_ADMIN,
      });

      expect(prismaMock.adminUser.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          role: AdminRole.OPERATIONS_ADMIN,
          isActive: true,
        }),
      });
      expect(invited.id).toBe('admin_db_new');
    });
  });

  describe('2. Authoritative Treasury & Receiving Config Persistence', () => {
    it('2.1 Should query MobileMoneyMerchant PostgreSQL table for registry', async () => {
      prismaMock.mobileMoneyMerchant.findMany.mockResolvedValue([
        {
          id: 'mmm_1',
          network: 'MTN',
          merchantName: 'TitanUG Escrow',
          merchantNumber: '234654',
          country: 'UG',
          currency: 'UGX',
          status: 'ACTIVE',
          priority: 1,
          dailyLimit: 10000000,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const registry = await commandCenterConfigService.getMobileMoneyRegistry();
      expect(prismaMock.mobileMoneyMerchant.findMany).toHaveBeenCalled();
      expect(registry.length).toBe(1);
      expect(registry[0].phoneNumber).toBe('234654');
    });

    it('2.2 Should persist USDT receiving wallet to UsdtConfig database table', async () => {
      prismaMock.usdtConfig.upsert.mockResolvedValue({
        id: 'default',
        receivingAddress: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
        network: 'TRON',
        enabled: true,
        configuredByAdminId: 'super_admin_id',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await commandCenterConfigService.upsertCryptoWalletConfig(
        { address: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf', network: 'TRON' },
        'super_admin_id',
      );

      expect(prismaMock.usdtConfig.upsert).toHaveBeenCalled();
      expect(result.address).toBe('TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf');
    });
  });

  describe('3. Operational Kill Switches & Mode Invariants', () => {
    it('3.1 Should throw ForbiddenException when operational mode asserts maintenanceMode', async () => {
      prismaMock.platformOperationalConfig.findUnique.mockResolvedValue({
        id: 'AUTHORITATIVE_PLATFORM_CONFIG',
        version: 2,
        maintenanceMode: true,
        readOnlyMode: false,
        disableRegistrations: false,
        disablePurchases: false,
        disableWithdrawals: false,
        disableClaims: false,
        disableSettlements: false,
        disabledAssets: [],
        disabledMachineCategories: [],
        updatedBy: 'admin_1',
        updatedAt: new Date(),
      });

      await expect(platformOperationsEngine.assertOperationalModeAllowed('PURCHASE')).rejects.toThrow(
        'PLATFORM_MAINTENANCE_ACTIVE',
      );
    });

    it('3.2 Should throw ForbiddenException when withdrawals switch is disabled', async () => {
      prismaMock.platformOperationalConfig.findUnique.mockResolvedValue({
        id: 'AUTHORITATIVE_PLATFORM_CONFIG',
        version: 3,
        maintenanceMode: false,
        readOnlyMode: false,
        disableRegistrations: false,
        disablePurchases: false,
        disableWithdrawals: true,
        disableClaims: false,
        disableSettlements: false,
        disabledAssets: [],
        disabledMachineCategories: [],
        updatedBy: 'admin_1',
        updatedAt: new Date(),
      });

      await expect(platformOperationsEngine.assertOperationalModeAllowed('WITHDRAWAL')).rejects.toThrow(
        'WITHDRAWALS_DISABLED',
      );
    });
  });
});
