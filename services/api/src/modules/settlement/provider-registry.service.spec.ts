import { BadRequestException } from '@nestjs/common';
import { Prisma, SettlementProviderHealthStatus, SettlementProviderId, SettlementProviderStatus } from '@prisma/client';
import { ProviderRegistryService } from './provider-registry.service';

describe('ProviderRegistryService', () => {
  const prisma = {
    settlementProvider: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    settlementSession: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };
  const operatorProvider = {
    providerId: SettlementProviderId.INTERNAL_OPERATIONS,
    manifest: {
      provider: SettlementProviderId.INTERNAL_OPERATIONS,
      supports_buy: true,
      supports_sell: false,
      supports_refunds: false,
      supports_webhooks: false,
      supports_manual_review: true,
      supports_partial_payments: false,
      supported_assets: ['USDT'],
    },
    createSettlement: jest.fn(),
    cancelSettlement: jest.fn(),
  };
  const pesapalProvider = {
    providerId: SettlementProviderId.PESAPAL,
    manifest: {
      provider: SettlementProviderId.PESAPAL,
      supports_buy: true,
      supports_sell: false,
      supports_refunds: true,
      supports_webhooks: true,
      supports_manual_review: true,
      supports_partial_payments: false,
      supported_assets: ['USDT'],
    },
    createSettlement: jest.fn(),
    approveSettlement: jest.fn(),
    cancelSettlement: jest.fn(),
  };
  const cryptobotProvider = {
    providerId: SettlementProviderId.CRYPTOBOT,
    manifest: {
      provider: SettlementProviderId.CRYPTOBOT,
      supports_buy: false,
      supports_sell: false,
      supports_refunds: false,
      supports_webhooks: false,
      supports_manual_review: false,
      supports_partial_payments: false,
      supported_assets: ['USDT'],
    },
    createSettlement: jest.fn(),
    approveSettlement: jest.fn(),
    cancelSettlement: jest.fn(),
  };
  const service = new ProviderRegistryService(prisma as any, operatorProvider as any, cryptobotProvider as any, undefined, pesapalProvider as any);

  beforeEach(() => jest.clearAllMocks());

  it('returns capability manifests for active enabled healthy providers (excluding CRYPTOBOT)', async () => {
    prisma.settlementProvider.findMany.mockResolvedValue([
      {
        id: SettlementProviderId.PESAPAL,
        displayName: 'Pesapal (Card & Mobile Money)',
        status: SettlementProviderStatus.ENABLED,
        priority: 10,
        supportedAssets: ['USDT'],
        supportedCountries: ['KE', 'UG', 'US'],
        capabilityManifest: pesapalProvider.manifest,
        health: { healthStatus: SettlementProviderHealthStatus.HEALTHY },
      },
    ]);

    await expect(service.listProviders({ asset: 'USDT', buyOnly: true })).resolves.toEqual([
      expect.objectContaining({
        provider: SettlementProviderId.PESAPAL,
        capabilityManifest: expect.objectContaining({ supports_webhooks: true, supported_assets: ['USDT'] }),
      }),
    ]);
  });

  it('rejects creation attempt for retired CRYPTOBOT provider', async () => {
    await expect(
      service.routeCreate(123n, {
        provider: SettlementProviderId.CRYPTOBOT,
        asset: 'USDT',
        requestedAmount: '10',
        expectedCryptoAmount: '10',
        exchangeRate: '1',
        country: 'KE',
        mobileMoneyNetwork: 'CRYPTOBOT',
      }),
    ).rejects.toThrow('UNSUPPORTED_PROVIDER: CryptoBot settlement has been retired');
  });

  it('routes creation to Pesapal provider after active-session check', async () => {
    prisma.settlementSession.findFirst.mockResolvedValue(null);
    prisma.settlementProvider.findUnique.mockResolvedValue({
      id: SettlementProviderId.PESAPAL,
      status: SettlementProviderStatus.ENABLED,
      supportedCountries: ['KE', 'UG', 'US'],
      capabilityManifest: pesapalProvider.manifest,
      health: { healthStatus: SettlementProviderHealthStatus.HEALTHY },
    });
    pesapalProvider.createSettlement.mockResolvedValue({ settlementId: 'set_psp_1' });

    await expect(
      service.routeCreate(123n, {
        provider: SettlementProviderId.PESAPAL,
        asset: 'USDT',
        requestedAmount: '10',
        expectedCryptoAmount: '10',
        exchangeRate: '1',
        country: 'KE',
        mobileMoneyNetwork: 'PESAPAL',
      }),
    ).resolves.toEqual({ settlementId: 'set_psp_1' });
  });

  it('routes MOBILE_MONEY and CARD paymentMethods to Pesapal provider', async () => {
    prisma.settlementSession.findFirst.mockResolvedValue(null);
    prisma.settlementProvider.findUnique.mockResolvedValue({
      id: SettlementProviderId.PESAPAL,
      status: SettlementProviderStatus.ENABLED,
      supportedCountries: ['KE', 'UG', 'US'],
      capabilityManifest: pesapalProvider.manifest,
      health: { healthStatus: SettlementProviderHealthStatus.HEALTHY },
    });
    pesapalProvider.createSettlement.mockResolvedValue({ settlementId: 'set_momo_1' });

    await expect(
      service.routeCreate(123n, {
        paymentMethod: 'MOBILE_MONEY',
        paymentNetwork: 'AIRTEL',
        asset: 'USDT',
        requestedAmount: '50',
        expectedCryptoAmount: '50',
        exchangeRate: '1',
        country: 'UG',
      }),
    ).resolves.toEqual({ settlementId: 'set_momo_1' });

    expect(pesapalProvider.createSettlement).toHaveBeenCalledWith(
      123n,
      expect.objectContaining({ paymentMethod: 'MOBILE_MONEY', paymentNetwork: 'AIRTEL' }),
    );
  });

  it('strictly routes USDT paymentMethod to USDT provider rail even if provider: PESAPAL is passed', async () => {
    const usdtProvider = {
      providerId: SettlementProviderId.USDT,
      manifest: {
        provider: SettlementProviderId.USDT,
        supports_buy: true,
        supports_sell: true,
        supported_assets: ['USDT'],
      },
      createSettlement: jest.fn().mockResolvedValue({ settlementId: 'set_usdt_trc20' }),
    };

    const serviceWithUsdt = new ProviderRegistryService(
      prisma as any,
      operatorProvider as any,
      cryptobotProvider as any,
      undefined,
      pesapalProvider as any,
      usdtProvider as any,
    );

    prisma.settlementSession.findFirst.mockResolvedValue(null);
    prisma.settlementProvider.findUnique.mockResolvedValue({
      id: SettlementProviderId.USDT,
      status: SettlementProviderStatus.ENABLED,
      supportedCountries: [],
      capabilityManifest: usdtProvider.manifest,
      health: { healthStatus: SettlementProviderHealthStatus.HEALTHY },
    });

    // Attempt to force provider: PESAPAL with paymentMethod: 'USDT'
    const res = await serviceWithUsdt.routeCreate(123n, {
      provider: SettlementProviderId.PESAPAL,
      paymentMethod: 'USDT',
      asset: 'USDT',
      requestedAmount: '100',
      expectedCryptoAmount: '100',
      exchangeRate: '1',
      country: 'UG',
    });

    expect(res).toEqual({ settlementId: 'set_usdt_trc20' });
    expect(usdtProvider.createSettlement).toHaveBeenCalled();
    expect(pesapalProvider.createSettlement).not.toHaveBeenCalled();
  });

  it('blocks a second active settlement for the same user and asset', async () => {
    prisma.settlementSession.findFirst.mockResolvedValue({ id: 'existing' });

    await expect(
      service.routeCreate(123n, {
        provider: SettlementProviderId.PESAPAL,
        asset: 'USDT',
        requestedAmount: '10',
        expectedCryptoAmount: '10',
        exchangeRate: '1',
        country: 'KE',
        mobileMoneyNetwork: 'PESAPAL',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
