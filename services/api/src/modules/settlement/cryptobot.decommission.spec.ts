import { BadRequestException } from '@nestjs/common';
import { SettlementProviderId, SettlementProviderStatus, SettlementStatus } from '@prisma/client';
import { ProviderRegistryService } from './provider-registry.service';
import { CryptoBotController } from './cryptobot/cryptobot.controller';
import { CryptoBotProvider } from './cryptobot/cryptobot.provider';

describe('CryptoBot Decommissioning & Retirement Verification (Phase 12)', () => {
  const prismaMock = {
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

  const pesapalMock = {
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
    createSettlement: jest.fn().mockResolvedValue({ settlementId: 'pesapal_session_123' }),
    approveSettlement: jest.fn(),
    cancelSettlement: jest.fn(),
  };

  const cryptobotProviderMock = {
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
    createSettlement: jest.fn().mockRejectedValue(new BadRequestException('UNSUPPORTED_PROVIDER: CryptoBot funding has been retired')),
    approveSettlement: jest.fn(),
    cancelSettlement: jest.fn(),
  };

  const operatorMock = {
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

  let registryService: ProviderRegistryService;
  let cryptobotController: CryptoBotController;

  beforeEach(() => {
    jest.clearAllMocks();
    registryService = new ProviderRegistryService(
      prismaMock as any,
      operatorMock as any,
      cryptobotProviderMock as any,
      undefined,
      pesapalMock as any,
    );
    cryptobotController = new CryptoBotController(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('Test 1 — New CryptoBot settlement is rejected with UNSUPPORTED_PROVIDER', async () => {
    await expect(
      registryService.routeCreate(100n, {
        provider: SettlementProviderId.CRYPTOBOT,
        asset: 'USDT',
        requestedAmount: '50',
        expectedCryptoAmount: '50',
        exchangeRate: '1.0',
        country: 'KE',
        mobileMoneyNetwork: 'CRYPTOBOT',
      }),
    ).rejects.toThrow('UNSUPPORTED_PROVIDER: CryptoBot settlement has been retired');
  });

  it('Test 2 — CryptoBot is not advertised in listProviders', async () => {
    prismaMock.settlementProvider.findMany.mockResolvedValue([
      {
        id: SettlementProviderId.PESAPAL,
        displayName: 'Pesapal (Card & Mobile Money)',
        status: SettlementProviderStatus.ENABLED,
        priority: 10,
        supportedAssets: ['USDT'],
        supportedCountries: ['KE', 'UG', 'US'],
        capabilityManifest: pesapalMock.manifest,
        health: { healthStatus: 'HEALTHY' },
      },
    ]);

    const activeProviders = await registryService.listProviders({ asset: 'USDT' });
    expect(activeProviders.some((p) => p.provider === SettlementProviderId.CRYPTOBOT)).toBe(false);
    expect(activeProviders.some((p) => p.provider === SettlementProviderId.PESAPAL)).toBe(true);
  });

  it('Test 3 — Pesapal remains available and operational in registry', async () => {
    prismaMock.settlementSession.findFirst.mockResolvedValue(null);
    prismaMock.settlementProvider.findUnique.mockResolvedValue({
      id: SettlementProviderId.PESAPAL,
      status: SettlementProviderStatus.ENABLED,
      supportedCountries: ['KE', 'UG', 'US'],
      capabilityManifest: pesapalMock.manifest,
      health: { healthStatus: 'HEALTHY' },
    });

    const session = await registryService.routeCreate(100n, {
      provider: SettlementProviderId.PESAPAL,
      asset: 'USDT',
      requestedAmount: '100',
      expectedCryptoAmount: '100',
      exchangeRate: '1.0',
      country: 'KE',
      mobileMoneyNetwork: 'PESAPAL',
    });

    expect(session).toEqual({ settlementId: 'pesapal_session_123' });
    expect(pesapalMock.createSettlement).toHaveBeenCalledTimes(1);
  });

  it('Test 4 — Historical CryptoBot records remain accessible via getSession', async () => {
    const historicalSession = {
      id: 'cb_session_999',
      telegramUserId: 100n,
      provider: SettlementProviderId.CRYPTOBOT,
      referenceCode: 'CB-999',
      asset: 'USDT',
      requestedAmount: '20.00',
      expectedCryptoAmount: '20.00',
      exchangeRate: '1.00',
      status: SettlementStatus.COMPLETED,
      expiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    prismaMock.settlementSession.findUnique.mockResolvedValue(historicalSession);
    prismaMock.settlementSession.findFirst.mockResolvedValue(historicalSession);

    const result = await registryService.getSession(100n, 'cb_session_999');
    expect(result.settlementId).toBe('cb_session_999');
    expect(result.provider).toBe(SettlementProviderId.CRYPTOBOT);
    expect(result.status).toBe(SettlementStatus.COMPLETED);
  });

  it('Test 8 — CryptoBot webhook controller rejects all incoming requests', async () => {
    await expect(cryptobotController.handleWebhook()).rejects.toThrow(
      'CRYPTOBOT_PROVIDER_RETIRED: CryptoBot payment webhook is retired and no longer accepts transactions.',
    );
  });
});
