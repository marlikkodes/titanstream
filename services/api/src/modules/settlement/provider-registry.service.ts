import { BadRequestException, Injectable, Optional, OnModuleInit, Logger } from '@nestjs/common';
import {
  Prisma,
  SettlementProviderHealthStatus,
  SettlementProviderId,
  SettlementProviderStatus,
  SettlementStatus,
  UserState,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CryptoBotProvider } from './cryptobot.provider';
import { PesapalProvider } from './pesapal/pesapal.provider';
import { UsdtProvider } from './usdt/usdt.provider';
import { CreateSettlementSessionDto } from './dto/create-settlement-session.dto';
import { MerchantSettlementProvider } from './merchant-settlement.provider';
import { InternalOperationsProvider } from './operator-settlement.provider';
import { SettlementProvider } from './settlement-provider.interface';
import { SettlementRiskService } from './settlement-risk.service';
import { normalizePaymentCountry, supportsLocalPaymentRails } from './payment-region.policy';

const ACTIVE_STATUSES = [
  SettlementStatus.CREATED,
  SettlementStatus.INITIALIZED,
  SettlementStatus.OPERATOR_ASSIGNED,
  SettlementStatus.MERCHANT_ASSIGNED,
  SettlementStatus.WAITING_FOR_PAYMENT,
  SettlementStatus.WAITING_PAYMENT,
  SettlementStatus.VERIFYING,
  SettlementStatus.APPROVED,
  SettlementStatus.POSTED,
  SettlementStatus.PAYMENT_RECEIVED,
  SettlementStatus.USDT_SENT,
];

@Injectable()
export class ProviderRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ProviderRegistryService.name);
  private readonly adapters: Map<SettlementProviderId, SettlementProvider>;

  constructor(
    private readonly prisma: PrismaService,
    operator: InternalOperationsProvider,
    cryptobot: CryptoBotProvider,
    @Optional() merchant?: MerchantSettlementProvider,
    @Optional() pesapal?: PesapalProvider,
    @Optional() usdt?: UsdtProvider,
    @Optional() private readonly riskService?: SettlementRiskService,
  ) {
    this.adapters = new Map<SettlementProviderId, SettlementProvider>([
      [operator.providerId, operator],
      [cryptobot.providerId, cryptobot],
    ]);
    if (merchant) {
      this.adapters.set(merchant.providerId, merchant);
    }
    if (pesapal) {
      this.adapters.set(pesapal.providerId, pesapal);
    }
    if (usdt) {
      this.adapters.set(usdt.providerId, usdt);
    }
  }

  async onModuleInit() {
    setImmediate(async () => {
      try {
        await Promise.all([...this.adapters.values()].map((provider) => this.ensureProvider(provider)));
      } catch (err: any) {
        if (process.env.NODE_ENV === 'production') {
          console.error('FATAL: Failed to seed default settlement providers on startup:', err?.message);
        } else {
          console.warn('Failed to seed default settlement providers on startup:', err?.message);
        }
      }
    });
  }

  registerProvider(provider: SettlementProvider) {
    this.adapters.set(provider.providerId, provider);
    return this.ensureProvider(provider);
  }

  async enableProvider(providerId: SettlementProviderId) {
    return this.prisma.settlementProvider.update({
      where: { id: providerId },
      data: { status: SettlementProviderStatus.ENABLED },
    });
  }

  async disableProvider(providerId: SettlementProviderId) {
    return this.prisma.settlementProvider.update({
      where: { id: providerId },
      data: { status: SettlementProviderStatus.DISABLED },
    });
  }

  async checkProviderHealth(providerId: SettlementProviderId) {
    const record = await this.prisma.settlementProvider.findUnique({
      where: { id: providerId },
      include: { health: true },
    });
    if (!record) throw new BadRequestException('SETTLEMENT_PROVIDER_NOT_FOUND');
    return record.health;
  }

  async getProviderCapabilities(providerId: SettlementProviderId) {
    const adapter = this.adapters.get(providerId);
    if (!adapter) throw new BadRequestException('SETTLEMENT_PROVIDER_NOT_REGISTERED');
    return adapter.manifest;
  }

  async listProviders(params: { asset?: string; country?: string; buyOnly?: boolean } = {}) {
    const providers = await this.prisma.settlementProvider.findMany({
      where: {
        status: SettlementProviderStatus.ENABLED,
        id: { not: SettlementProviderId.CRYPTOBOT },
      },
      include: { health: true, config: true },
      orderBy: { priority: 'asc' },
    });

    return providers
      .filter((provider: any) => provider.health?.healthStatus !== SettlementProviderHealthStatus.DOWN)
      .filter((provider: any) => {
        const manifest = provider.capabilityManifest || {};
        const assets = Array.isArray(manifest.supported_assets) ? manifest.supported_assets : provider.supportedAssets;
        const countries = Array.isArray(provider.supportedCountries) ? provider.supportedCountries : [];
        return (
          (!params.asset || assets.includes(params.asset)) &&
          (!params.country || countries.length === 0 || countries.includes(params.country)) &&
          (!params.buyOnly || manifest.supports_buy === true)
        );
      })
      .map((provider: any) => ({
        provider: provider.id,
        name: provider.displayName,
        displayName: provider.displayName,
        type: provider.id,
        status: provider.status,
        healthStatus: provider.health?.healthStatus || SettlementProviderHealthStatus.HEALTHY,
        priority: provider.priority,
        supported_assets: provider.supportedAssets,
        supported_countries: provider.supportedCountries,
        capabilities: provider.capabilityManifest,
        capabilityManifest: provider.capabilityManifest,
        created_at: provider.createdAt,
        updated_at: provider.updatedAt,
      }));
  }

  async resolveUserAndTelegramId(userKey: bigint | string): Promise<{ user: any; telegramUserId: bigint }> {
    let telegramUserId = BigInt(0);
    let user: any = null;

    if (typeof userKey === 'bigint') {
      telegramUserId = userKey;
      if (this.prisma?.user) {
        user = await this.prisma.user.findUnique({ where: { telegramUserId } });
      }
    } else {
      const strKey = String(userKey || '').trim();
      if (this.prisma?.user && strKey) {
        // First try finding by canonical UUID id or identityId
        user = (await this.prisma.user.findUnique({ where: { id: strKey } }).catch(() => null)) ||
               (await this.prisma.user.findFirst({ where: { identityId: strKey } }).catch(() => null));
        if (user) {
          telegramUserId = user.telegramUserId;
        } else {
          const digits = strKey.replace(/\D/g, '');
          if (digits && digits.length > 0) {
            try {
              telegramUserId = BigInt(digits);
              user = await this.prisma.user.findUnique({ where: { telegramUserId } }).catch(() => null);
            } catch {
              telegramUserId = BigInt(0);
            }
          }
        }
      }
    }

    return { user, telegramUserId };
  }

  async routeCreate(userKey: bigint | string, dto: CreateSettlementSessionDto) {
    const { user, telegramUserId } = await this.resolveUserAndTelegramId(userKey);
    const telegramUserIdBig = telegramUserId || BigInt(0);

    let providerId = dto.provider;
    if (dto.paymentMethod?.toUpperCase() === 'CARD') {
      throw new BadRequestException('CARD_PAYMENTS_UNAVAILABLE: Card payments are not available');
    }

    // Provider Routing:
    // 1. USDT -> USDT Provider
    // 2. MOBILE_MONEY -> MERCHANT_MOBILE_MONEY Provider (Merchant Direct Rail)
    // 3. CARD -> PESAPAL Provider (Card Hosted Checkout - Protected Subsystem)
    if (dto.paymentMethod?.toUpperCase() === 'USDT') {
      providerId = SettlementProviderId.USDT;
    } else if (dto.provider) {
      providerId = dto.provider as SettlementProviderId;
    } else if (dto.paymentMethod?.toUpperCase() === 'MOBILE_MONEY') {
      providerId = SettlementProviderId.MERCHANT_MOBILE_MONEY;
    }
    if (!providerId) {
      providerId = SettlementProviderId.MERCHANT_MOBILE_MONEY;
    }

    dto.country = normalizePaymentCountry(dto.country);

    if (providerId === SettlementProviderId.CRYPTOBOT || (dto.provider as string) === 'CRYPTOBOT') {
      throw new BadRequestException('UNSUPPORTED_PROVIDER: CryptoBot settlement has been retired');
    }
    if ((dto.asset || 'USDT').toUpperCase() !== 'USDT') {
      throw new BadRequestException('UNSUPPORTED_ASSET: Deposits are settled in USDT only');
    }
    if (providerId !== SettlementProviderId.USDT && !supportsLocalPaymentRails(dto.country)) {
      throw new BadRequestException('LOCAL_PAYMENT_METHOD_NOT_AVAILABLE: Outside East Africa, deposits are available via USDT (TRC-20) only');
    }

    // Only check for active sessions of the SAME provider type and SAME mobile money network
    const requestedNetwork = dto.mobileMoneyNetwork ? dto.mobileMoneyNetwork.toUpperCase() : undefined;
    const existingActive = await this.findActiveSettlementForProvider(telegramUserIdBig, dto.asset, providerId, requestedNetwork);
    if (existingActive) {
      if (providerId === SettlementProviderId.PESAPAL) {
        throw new BadRequestException('ACTIVE_SETTLEMENT_ALREADY_EXISTS');
      }
      this.logger.log(`[SETTLEMENT] Returning existing active session [${existingActive.id}] for user ${telegramUserIdBig}`);
      const independent = this.toProviderIndependentView(existingActive);
      return {
        ...independent,
        settlementId: existingActive.id,
      };
    }

    // If user is starting a session for a NEW network, cancel any active session on the old network
    if (requestedNetwork && providerId === SettlementProviderId.MERCHANT_MOBILE_MONEY) {
      await this.cancelOtherNetworkActiveSessions(telegramUserIdBig, dto.asset, requestedNetwork);
    }

    if (this.riskService && telegramUserIdBig > 0) {
      await this.riskService.assertSessionCreationRisk(telegramUserIdBig, Number(dto.requestedAmount));
    }
    const provider = await this.getEnabledAdapter(providerId, dto.asset, dto.country);
    return provider.createSettlement(telegramUserIdBig, dto);
  }

  async approve(providerId: SettlementProviderId, settlementId: string, context: Record<string, unknown> = {}) {
    const provider = await this.getEnabledAdapter(providerId);
    return provider.approveSettlement(settlementId, context);
  }

  async cancel(userKey: bigint | string, settlementId: string) {
    const { telegramUserId } = await this.resolveUserAndTelegramId(userKey);
    const session = await this.prisma.settlementSession.findFirst({ where: { id: settlementId, telegramUserId } });
    if (!session) throw new BadRequestException('SETTLEMENT_NOT_FOUND');
    const provider = await this.getEnabledAdapter(session.provider);
    return provider.cancelSettlement(settlementId);
  }

  async getSession(userKey: bigint | string, settlementId: string) {
    const { telegramUserId } = await this.resolveUserAndTelegramId(userKey);
    let session: any = null;
    try {
      session = await this.prisma.settlementSession.findFirst({ where: { id: settlementId, telegramUserId } });
      if (!session && typeof this.prisma?.settlementSession?.findFirst === 'function') {
        session = await this.prisma.settlementSession.findFirst({
          where: { id: settlementId, telegramUserId },
        });
      }
    } catch (dbErr: any) {
      this.logger.warn(`[SETTLEMENT_DB_WARN] getSession DB lookup error: ${dbErr?.message}`);
    }

    if (session) {
      const adapter = this.adapters.get(session.provider as SettlementProviderId);
      if (adapter && typeof adapter.getSettlementStatus === 'function') {
        return adapter.getSettlementStatus(settlementId);
      }
      return this.toProviderIndependentView(session);
    }

    throw new BadRequestException('SETTLEMENT_NOT_FOUND');
  }

  async history(userKey: bigint | string) {
    try {
      const { user, telegramUserId } = await this.resolveUserAndTelegramId(userKey);

      if (!telegramUserId && !user) return [];

      const sessions = await this.prisma.settlementSession.findMany({
        where: {
          ...(telegramUserId && telegramUserId > BigInt(0) ? { telegramUserId } : {}),
        },
        orderBy: { createdAt: 'desc' },
      });

      return sessions.map((session) => this.toProviderIndependentView(session));
    } catch (err: any) {
      this.logger.warn(`[SETTLEMENT_HISTORY_ERR] Failed to fetch settlement history: ${err?.message}`);
      return [];
    }
  }

  private async getEnabledAdapter(providerId: SettlementProviderId, asset?: string, country?: string) {
    let provider: any = null;
    try {
      provider = await this.prisma.settlementProvider.findUnique({ where: { id: providerId }, include: { health: true } });
    } catch (dbErr: any) {
      this.logger.warn(`[SETTLEMENT_DB_WARN] Could not query settlementProvider in DB: ${dbErr?.message}`);
    }
    if (provider && provider.status !== SettlementProviderStatus.ENABLED) throw new BadRequestException('SETTLEMENT_PROVIDER_DISABLED');
    if (provider?.health?.healthStatus === SettlementProviderHealthStatus.DOWN) throw new BadRequestException('SETTLEMENT_PROVIDER_DOWN');

    const manifest = provider?.capabilityManifest as any;
    if (provider && asset && Array.isArray(manifest?.supported_assets) && !manifest.supported_assets.includes(asset)) {
      throw new BadRequestException('SETTLEMENT_PROVIDER_UNSUPPORTED_ASSET');
    }
    const countries = Array.isArray(provider?.supportedCountries) ? provider.supportedCountries : [];
    if (provider && country && country !== 'GLOBAL' && countries.length > 0 && !countries.includes(country) && !countries.includes('GLOBAL')) {
      throw new BadRequestException('SETTLEMENT_PROVIDER_UNSUPPORTED_COUNTRY');
    }

    const adapter = this.adapters.get(providerId);
    if (!adapter) throw new BadRequestException('SETTLEMENT_PROVIDER_NOT_REGISTERED');
    return adapter;
  }

  private async ensureProvider(provider: SettlementProvider) {
    let displayName = 'Mobile Money';
    if (provider.providerId === SettlementProviderId.CRYPTOBOT) displayName = 'CryptoBot';
    if (provider.providerId === SettlementProviderId.MERCHANT_MOBILE_MONEY) displayName = 'Merchant Mobile Money';
    if (provider.providerId === SettlementProviderId.PESAPAL) displayName = 'Pesapal (Mobile Money)';
    if (provider.providerId === SettlementProviderId.USDT) displayName = 'USDT Direct Wallet';

    try {
      await this.prisma.settlementProvider.upsert({
        where: { id: provider.providerId },
        update: {
          status: provider.providerId === SettlementProviderId.CRYPTOBOT ? SettlementProviderStatus.DISABLED : undefined,
          capabilityManifest: provider.manifest as unknown as Prisma.InputJsonValue,
          supportedAssets: provider.manifest.supported_assets as Prisma.InputJsonValue,
        },
        create: {
          id: provider.providerId,
          displayName,
          status: provider.providerId === SettlementProviderId.CRYPTOBOT ? SettlementProviderStatus.DISABLED : SettlementProviderStatus.ENABLED,
          supportedAssets: provider.manifest.supported_assets as Prisma.InputJsonValue,
          supportedCountries: (provider.providerId === SettlementProviderId.CRYPTOBOT
            ? []
            : provider.providerId === SettlementProviderId.USDT
            ? ['GLOBAL']
            : ['KE', 'UG', 'US', 'GLOBAL', 'TZ', 'RW', 'GH', 'NG', 'ZA']) as Prisma.InputJsonValue,
          capabilityManifest: provider.manifest as unknown as Prisma.InputJsonValue,
          priority: provider.providerId === SettlementProviderId.CRYPTOBOT ? 99 : 10,
          config: { create: { configuration: {} } },
          health: { create: { healthStatus: SettlementProviderHealthStatus.HEALTHY, details: {} } },
        },
      });
    } catch (dbErr: any) {
      this.logger.warn(`[SETTLEMENT_DB_WARN] Could not upsert provider in DB: ${dbErr?.message}`);
    }
  }

  private async findActiveSettlementForProvider(telegramUserId: bigint, asset: string, provider: string, network?: string): Promise<any | null> {
    try {
      const whereClause: any = {
        telegramUserId,
        asset,
        provider: provider as any,
        status: { in: ACTIVE_STATUSES },
        expiresAt: { gt: new Date() }, // Only non-expired sessions
      };
      if (network) {
        whereClause.mobileMoneyNetwork = network.toUpperCase();
      }
      const existing = await this.prisma.settlementSession.findFirst({
        where: whereClause,
        include: { merchant: true },
        orderBy: { createdAt: 'desc' },
      });
      return existing;
    } catch (err: any) {
      this.logger.warn(`[SETTLEMENT_DB_WARN] Could not check active settlements for provider ${provider}: ${err?.message}`);
      return null;
    }
  }

  private async cancelOtherNetworkActiveSessions(telegramUserId: bigint, asset: string, keepNetwork: string): Promise<void> {
    try {
      const staleSessions = await this.prisma.settlementSession.findMany({
        where: {
          telegramUserId,
          asset,
          provider: SettlementProviderId.MERCHANT_MOBILE_MONEY as any,
          status: { in: ACTIVE_STATUSES },
          mobileMoneyNetwork: { not: keepNetwork.toUpperCase() },
        },
      });
      for (const sess of staleSessions) {
        this.logger.log(`[SETTLEMENT_ROUTING] Cancelling stale session [${sess.id}] (${sess.mobileMoneyNetwork}) because user selected network ${keepNetwork}`);
        await this.prisma.settlementSession.update({
          where: { id: sess.id },
          data: { status: SettlementStatus.CANCELLED },
        }).catch(() => null);
      }
    } catch (err: any) {
      this.logger.warn(`[SETTLEMENT_DB_WARN] Could not cancel other network sessions: ${err?.message}`);
    }
  }

  private async assertNoActiveSettlement(telegramUserId: bigint, asset: string): Promise<any | null> {
    try {
      const existing = await this.prisma.settlementSession.findFirst({
        where: { telegramUserId, asset, status: { in: ACTIVE_STATUSES } },
      });
      return existing;
    } catch (err: any) {
      this.logger.warn(`[SETTLEMENT_DB_WARN] Could not check active settlements in DB: ${err?.message}`);
      return null;
    }
  }

  private toProviderIndependentView(session: any) {
    const adapter = this.adapters.get(session.provider as SettlementProviderId) as any;
    if (adapter && typeof adapter.toProviderIndependentView === 'function') {
      return adapter.toProviderIndependentView(session);
    }
    const metadata = (session.providerMetadata || {}) as Record<string, any>;
    return {
      settlementId: session.id,
      provider: session.provider,
      reference: session.referenceCode,
      referenceCode: session.referenceCode,
      asset: session.asset,
      requestedAmount: session.requestedAmount?.toString() ?? '0',
      expectedAssetAmount: session.expectedCryptoAmount?.toString() ?? '0',
      expectedCryptoAmount: session.expectedCryptoAmount?.toString() ?? '0',
      exchangeRate: session.exchangeRate?.toString() ?? '1',
      status: session.status,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      payUrl: metadata.redirectUrl || null,
      paymentUrl: metadata.redirectUrl || null,
      orderTrackingId: metadata.orderTrackingId || null,
      requiresAdminApproval: metadata.requiresAdminApproval || false,
      paymentMethod: metadata.paymentMethod || null,
      mobileMoneyNetwork: metadata.mobileMoneyNetwork || session.mobileMoneyNetwork || null,
      paymentCurrency: metadata.paymentCurrency || null,
      paymentAmount: metadata.paymentAmount != null ? Number(metadata.paymentAmount) : null,
      currencySymbol: metadata.currencySymbol || null,
    };
  }
}

@Injectable()
export class SettlementProviderRegistry extends ProviderRegistryService {}
