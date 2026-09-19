import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { SettlementEventType, SettlementProviderId, SettlementStatus, Prisma } from '@prisma/client';
import { CreateSettlementSessionDto } from './dto/create-settlement-session.dto';
import { ProviderEventService } from './provider-event.service';
import { SettlementCapabilityManifest, SettlementProvider } from './settlement-provider.interface';
import { SettlementService } from './settlement.service';
import { MerchantRoutingService } from './merchant-routing.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class MerchantSettlementProvider implements SettlementProvider {
  readonly providerId = SettlementProviderId.MERCHANT_MOBILE_MONEY;
  readonly manifest: SettlementCapabilityManifest = {
    provider: SettlementProviderId.MERCHANT_MOBILE_MONEY,
    supports_buy: true,
    supports_sell: true,
    supports_refunds: false,
    supports_webhooks: false,
    supports_manual_review: true,
    supports_partial_payments: false,
    supported_assets: ['USDT'],
  };

  private readonly logger = new Logger(MerchantSettlementProvider.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settlements: SettlementService,
    private readonly events: ProviderEventService,
    private readonly merchantRouting: MerchantRoutingService,
  ) {}

  getCapabilities(): SettlementCapabilityManifest {
    return this.manifest;
  }

  async createSettlement(telegramUserId: bigint, dto: CreateSettlementSessionDto) {
    const network = (dto.mobileMoneyNetwork || 'MTN').toUpperCase();
    const country = (dto.country || 'UG').toUpperCase();
    const currency = 'UGX';

    const expectedCryptoAmount = Number(dto.requestedAmount);
    if (!Number.isFinite(expectedCryptoAmount) || expectedCryptoAmount <= 0) throw new BadRequestException('INVALID_DEPOSIT_AMOUNT');
    const exchangeRate = 3774.62;
    const requestedLocalAmount = Math.round(expectedCryptoAmount * exchangeRate);

    // 1. Select active merchant for network & limits
    const merchant = await this.merchantRouting.selectActiveMerchant({
      network,
      country,
      currency,
      requestedLocalAmount,
    });

    const referenceCode = `MM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 mins expiry
    // 2. Create SettlementSession record with merchantId
    let session: any = null;
    try {
      session = await this.prisma.settlementSession.create({
        data: {
          telegramUserId,
          merchantId: merchant.id && !merchant.id.startsWith('merchant_') ? merchant.id : undefined,
          provider: SettlementProviderId.MERCHANT_MOBILE_MONEY,
          asset: dto.asset || 'USDT',
          requestedAmount: new Prisma.Decimal(requestedLocalAmount),
          expectedCryptoAmount: new Prisma.Decimal(expectedCryptoAmount),
          exchangeRate: new Prisma.Decimal(exchangeRate),
          country,
          mobileMoneyNetwork: network,
          referenceCode,
          status: SettlementStatus.WAITING_FOR_PAYMENT,
          expiresAt,
          providerMetadata: {
            merchantId: merchant.id,
            merchantName: merchant.merchantName,
            merchantNumber: merchant.merchantNumber,
            network,
          },
          events: {
            create: [
              { eventType: SettlementEventType.SettlementCreated, actorType: 'CUSTOMER', actorId: telegramUserId.toString(), payload: {} },
              { eventType: SettlementEventType.MerchantAssigned, actorType: 'SYSTEM', actorId: merchant.id, payload: { merchantId: merchant.id, merchantNumber: merchant.merchantNumber } },
            ],
          },
        },
        include: { merchant: true },
      });
    } catch (dbErr: any) {
      this.logger.error(`[MERCHANT_SETTLEMENT_DB_ERR] Could not persist session: ${dbErr?.message}`);
      throw new ServiceUnavailableException('SETTLEMENT_PERSISTENCE_UNAVAILABLE');
    }

    this.logger.log(`[MERCHANT_SETTLEMENT] Created session [${session.id}] assigned to Merchant ${merchant.merchantName} (${merchant.merchantNumber})`);

    const result = {
      settlementId: session.id,
      referenceCode: session.referenceCode,
      provider: SettlementProviderId.MERCHANT_MOBILE_MONEY,
      status: session.status,
      network: session.mobileMoneyNetwork,
      merchantId: merchant.id,
      merchantName: merchant.merchantName,
      merchantNumber: merchant.merchantNumber,
      requestedAmount: (session.requestedAmount || '0').toString(),
      expectedCryptoAmount: (session.expectedCryptoAmount || session.requestedAmount || '0').toString(),
      exchangeRate: exchangeRate.toString(),
      asset: session.asset,
      paymentCurrency: 'UGX',
      paymentAmount: (session.requestedAmount || '0').toString(),
      submittedReference: null,
      expiresAt: session.expiresAt ? (session.expiresAt instanceof Date ? session.expiresAt.toISOString() : session.expiresAt) : new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      createdAt: session.createdAt ? (session.createdAt instanceof Date ? session.createdAt.toISOString() : session.createdAt) : new Date().toISOString(),
      completedAt: null,
      instructions: {
        title: `Pay via ${merchant.merchantName}`,
        network: session.mobileMoneyNetwork,
        merchantName: merchant.merchantName,
        merchantNumber: merchant.merchantNumber,
        amountUgx: (session.requestedAmount || '0').toString(),
        ussdCode: network === 'AIRTEL'
          ? `*185*9*${merchant.merchantNumber}*${session.requestedAmount}#`
          : `*165*1*1*${merchant.merchantNumber}*${session.requestedAmount}#`,
      },
    };

    return result;
  }

  async initializeSettlement(settlementId: string) {
    const session = await this.settlements.getProviderSession(settlementId);
    await this.events.emit(this.providerId, settlementId, SettlementEventType.SettlementInitialized, {
      provider: this.providerId,
    });
    return session;
  }

  async getSettlementStatus(settlementId: string) {
    let session: any = null;
    try {
      session = await this.prisma.settlementSession.findUnique({
        where: { id: settlementId },
        include: { merchant: true },
      });
    } catch (dbErr: any) {
      this.logger.warn(`[MERCHANT_SETTLEMENT_DB_WARN] Could not query session ${settlementId}: ${dbErr?.message}`);
    }

    if (!session) throw new NotFoundException('SETTLEMENT_NOT_FOUND');

    const network = session.mobileMoneyNetwork || 'MTN';
    const mNum = session.merchant?.merchantNumber || (network === 'AIRTEL' ? '7183443' : '234654');
    const mName = session.merchant?.merchantName || (network === 'AIRTEL' ? 'TitanStream Escrow Airtel' : 'TitanStream Escrow MTN');

    return {
      settlementId: session.id,
      referenceCode: session.referenceCode,
      provider: SettlementProviderId.MERCHANT_MOBILE_MONEY,
      status: session.status,
      network,
      merchantId: session.merchantId || `merchant_${network.toLowerCase()}_1`,
      merchantName: mName,
      merchantNumber: mNum,
      requestedAmount: (session.requestedAmount || '0').toString(),
      expectedCryptoAmount: (session.expectedCryptoAmount || '0').toString(),
      exchangeRate: (session.exchangeRate || '3774.62').toString(),
      asset: session.asset,
      paymentCurrency: 'UGX',
      paymentAmount: (session.requestedAmount || '0').toString(),
      submittedReference: session.submittedReference,
      expiresAt: session.expiresAt ? (session.expiresAt instanceof Date ? session.expiresAt.toISOString() : session.expiresAt) : new Date().toISOString(),
      createdAt: session.createdAt ? (session.createdAt instanceof Date ? session.createdAt.toISOString() : session.createdAt) : new Date().toISOString(),
      completedAt: session.completedAt ? (session.completedAt instanceof Date ? session.completedAt.toISOString() : session.completedAt) : null,
      instructions: {
        title: `Pay via ${mName}`,
        network,
        merchantName: mName,
        merchantNumber: mNum,
        amountUgx: (session.requestedAmount || '0').toString(),
        ussdCode: network === 'AIRTEL'
          ? `*185*9*${mNum}*${session.requestedAmount}#`
          : `*165*1*1*${mNum}*${session.requestedAmount}#`,
      },
    };
  }

  async verifySettlement(settlementId: string) {
    const session = await this.settlements.getProviderSession(settlementId);
    await this.emitSettlementEvent(settlementId, SettlementEventType.SettlementVerificationStarted, {
      provider: this.providerId,
    });
    return session;
  }

  async assignMerchant(settlementId: string, operatorId: string) {
    const session = await this.settlements.getProviderSession(settlementId);
    await this.emitSettlementEvent(settlementId, SettlementEventType.OperatorAssigned, { operatorId });
    return session;
  }

  async trackMerchantProgress(settlementId: string) {
    return this.settlements.getProviderSession(settlementId);
  }

  async verifyMerchantCompletion(settlementId: string) {
    const session = await this.settlements.getProviderSession(settlementId);
    return session;
  }

  async approveSettlement(settlementId: string, context: Record<string, unknown> = {}) {
    await this.emitSettlementEvent(settlementId, SettlementEventType.SettlementApproved, context);
    return this.settlements.getProviderSession(settlementId);
  }

  async rejectSettlement(settlementId: string, reason?: string) {
    return this.settlements.rejectAssignedSettlement(settlementId, reason);
  }

  async expireSettlement(settlementId: string) {
    return this.settlements.expireOne(settlementId);
  }

  async cancelSettlement(settlementId: string) {
    return this.settlements.cancel(settlementId);
  }

  validateSettlement(settlementId: string) {
    return this.settlements.getProviderSession(settlementId);
  }

  monitorSettlement(settlementId: string) {
    return this.settlements.getProviderSession(settlementId);
  }

  emitSettlementEvent(settlementId: string, eventType: SettlementEventType, payload: Record<string, unknown> = {}) {
    return this.events.emit(this.providerId, settlementId, eventType, payload);
  }
}
