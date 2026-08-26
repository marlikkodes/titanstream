import { Test, TestingModule } from '@nestjs/testing';
import { AdminDashboardService } from './admin-dashboard.service';
import { PrismaService } from '../../../database/prisma.service';
import { TreasuryService } from '../../treasury/treasury.service';
import { CommandCenterConfigService } from './command-center-config.service';

describe('Mission Control Cross-Domain Independence Suite', () => {
  let service: AdminDashboardService;
  let prismaMock: any;
  let treasuryMock: any;
  let configMock: any;

  beforeEach(async () => {
    prismaMock = {
      user: { count: jest.fn() },
      merchantProfile: { count: jest.fn() },
      settlementSession: { count: jest.fn(), aggregate: jest.fn() },
      riskEvent: { count: jest.fn() },
      supportCase: { count: jest.fn() },
      userMachine: { count: jest.fn(), aggregate: jest.fn() },
    };

    treasuryMock = {
      getMetrics: jest.fn(),
    };

    configMock = {
      getSettings: jest.fn(),
      getMobileMoneyRegistry: jest.fn(),
      getCryptoWalletRegistry: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminDashboardService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: TreasuryService, useValue: treasuryMock },
        { provide: CommandCenterConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<AdminDashboardService>(AdminDashboardService);
  });

  describe('PHASE 12: Zero-User Test (IF user.count === 0)', () => {
    it('should maintain 100% operational platform state when user count is 0', async () => {
      // User count is 0
      prismaMock.user.count.mockResolvedValue(0);
      prismaMock.merchantProfile.count.mockResolvedValue(3);
      prismaMock.settlementSession.count.mockResolvedValue(0);
      prismaMock.settlementSession.aggregate.mockResolvedValue({ _sum: { expectedCryptoAmount: 0 } });
      prismaMock.riskEvent.count.mockResolvedValue(0);
      prismaMock.supportCase.count.mockResolvedValue(0);
      prismaMock.userMachine.count.mockResolvedValue(0);
      prismaMock.userMachine.aggregate.mockResolvedValue({ _sum: { capacityGhs: 0 } });

      treasuryMock.getMetrics.mockResolvedValue({
        totalLiquidity: 10000.0,
        userLiabilities: 0.0,
        reserveRatio: 1000,
        rcr: 10.0,
        rcrStatus: 'EXPANSION_READY',
        treasuryHealthScore: 100,
        forecastDays: 99,
        settlementExposure: 0,
      });

      configMock.getSettings.mockReturnValue({
        machineCatalog: [
          { tierCode: 'T1', name: 'Starter', priceUsdt: 10, capacityGhs: 5, isActive: true },
          { tierCode: 'T2', name: 'Pro', priceUsdt: 50, capacityGhs: 25, isActive: true },
        ],
        featureFlags: {
          enableInstantWithdrawal: true,
          enableUsdtTrc20Deposit: true,
          enableUssdAutoDial: true,
          enableMiningClaims: true,
          enableReferralRewards: true,
        },
      });

      configMock.getMobileMoneyRegistry.mockResolvedValue([
        { id: 'mm1', provider: 'MTN', status: 'ACTIVE' },
        { id: 'mm2', provider: 'AIRTEL', status: 'ACTIVE' },
      ]);

      configMock.getCryptoWalletRegistry.mockResolvedValue([
        { asset: 'USDT', network: 'TRC20', address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' },
      ]);

      const result = await service.getDashboardOverview();

      // Verify User domain honestly reports 0
      expect(result.totalUsers).toBe(0);

      // Verify Platform Status remains OPERATIONAL
      expect(result.platform_status.mode).toBe('OPERATIONAL');
      expect(result.platform_status.security_posture).toBe('ZERO-BYPASS');

      // Verify Financial & Treasury Solvency remains intact
      expect(result.financial_health.total_liquidity_usdt).toBe(10000.0);
      expect(result.financial_health.user_liabilities_usdt).toBe(0.0);
      expect(result.financial_health.reserve_ratio_percent).toBe(1000);

      // Verify Infrastructure & Providers are configured and visible
      expect(result.treasury_status.usdt_trc20_receiving_address).toBe('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
      expect(result.treasury_status.active_escrow_merchants).toBe(2);
      expect(result.economy_status.catalog_tiers_available).toBe(2);
      expect(result.provider_health.length).toBe(3);
    });
  });

  describe('PHASE 13: Three-User Test (Production Baseline)', () => {
    it('should report exactly 3 users while keeping independent domain telemetry separated', async () => {
      prismaMock.user.count.mockResolvedValue(3);
      prismaMock.merchantProfile.count.mockResolvedValue(3);
      prismaMock.settlementSession.count.mockResolvedValue(5);
      prismaMock.settlementSession.aggregate.mockResolvedValue({ _sum: { expectedCryptoAmount: 2330 } });
      prismaMock.riskEvent.count.mockResolvedValue(1);
      prismaMock.supportCase.count.mockResolvedValue(1);
      prismaMock.userMachine.count.mockResolvedValue(7);
      prismaMock.userMachine.aggregate.mockResolvedValue({ _sum: { capacityGhs: 1015 } });

      treasuryMock.getMetrics.mockResolvedValue({
        totalLiquidity: 2500.0,
        userLiabilities: 1052.9,
        reserveRatio: 237,
        rcr: 2.37,
        rcrStatus: 'EXPANSION_READY',
        treasuryHealthScore: 98,
        forecastDays: 17,
        settlementExposure: 0,
      });

      configMock.getSettings.mockReturnValue({
        machineCatalog: [
          { tierCode: 'T1', name: 'Pulse Gen', priceUsdt: 10, capacityGhs: 15, isActive: true },
          { tierCode: 'T2', name: 'Impulse Core', priceUsdt: 50, capacityGhs: 80, isActive: true },
          { tierCode: 'T3', name: 'Turbine Loop X', priceUsdt: 100, capacityGhs: 180, isActive: true },
          { tierCode: 'T4', name: 'Quantum Vortex G3', priceUsdt: 250, capacityGhs: 450, isActive: true },
        ],
        featureFlags: {
          enableInstantWithdrawal: true,
          enableUsdtTrc20Deposit: true,
          enableUssdAutoDial: true,
          enableMiningClaims: true,
          enableReferralRewards: true,
        },
      });

      configMock.getMobileMoneyRegistry.mockResolvedValue([
        { id: 'mm1', provider: 'MTN', status: 'ACTIVE' },
        { id: 'mm2', provider: 'AIRTEL', status: 'ACTIVE' },
        { id: 'mm3', provider: 'MPESA', status: 'ACTIVE' },
      ]);

      configMock.getCryptoWalletRegistry.mockResolvedValue([
        { asset: 'USDT', network: 'TRC20', address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' },
      ]);

      const result = await service.getDashboardOverview();

      expect(result.totalUsers).toBe(3);
      expect(result.economy_status.active_fleet_nodes).toBe(7);
      expect(result.economy_status.total_fleet_hashrate_ghs).toBe(1015);
      expect(result.financial_health.reserve_ratio_percent).toBe(237);
      expect(result.financial_health.rcr).toBe(2.37);
      expect(result.treasury_status.active_escrow_merchants).toBe(3);
    });
  });

  describe('PHASE 21: High-Volume Scale Test (50,000 Users)', () => {
    it('should scale user metrics without polluting static infrastructure and controls', async () => {
      prismaMock.user.count.mockResolvedValue(50000);
      prismaMock.merchantProfile.count.mockResolvedValue(12);
      prismaMock.settlementSession.count.mockResolvedValue(1450);
      prismaMock.settlementSession.aggregate.mockResolvedValue({ _sum: { expectedCryptoAmount: 485000 } });
      prismaMock.riskEvent.count.mockResolvedValue(4);
      prismaMock.supportCase.count.mockResolvedValue(8);
      prismaMock.userMachine.count.mockResolvedValue(12500);
      prismaMock.userMachine.aggregate.mockResolvedValue({ _sum: { capacityGhs: 450000 } });

      treasuryMock.getMetrics.mockResolvedValue({
        totalLiquidity: 750000.0,
        userLiabilities: 310000.0,
        reserveRatio: 241,
        rcr: 2.41,
        rcrStatus: 'EXPANSION_READY',
        treasuryHealthScore: 99,
        forecastDays: 45,
        settlementExposure: 12000,
      });

      configMock.getSettings.mockReturnValue({
        machineCatalog: new Array(4).fill({ isActive: true }),
        featureFlags: {
          enableInstantWithdrawal: true,
          enableUsdtTrc20Deposit: true,
          enableUssdAutoDial: true,
          enableMiningClaims: true,
          enableReferralRewards: true,
        },
      });

      configMock.getMobileMoneyRegistry.mockResolvedValue(new Array(12).fill({ status: 'ACTIVE' }));
      configMock.getCryptoWalletRegistry.mockResolvedValue([
        { asset: 'USDT', network: 'TRC20', address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' },
      ]);

      const result = await service.getDashboardOverview();

      expect(result.totalUsers).toBe(50000);
      expect(result.financial_health.total_liquidity_usdt).toBe(750000.0);
      expect(result.economy_status.total_fleet_hashrate_ghs).toBe(450000);
      expect(result.platform_status.mode).toBe('OPERATIONAL');
    });
  });
});
