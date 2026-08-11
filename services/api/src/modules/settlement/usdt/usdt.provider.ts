import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { FinancialOperationType, Prisma, SettlementEventType, SettlementProviderId, SettlementStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { FinancialOrchestratorService } from '../../financial-orchestration/financial-orchestrator.service';
import { CreateSettlementSessionDto } from '../dto/create-settlement-session.dto';
import { ProviderEventService } from '../provider-event.service';
import { SettlementCapabilityManifest, SettlementProvider } from '../settlement-provider.interface';
import { SettlementRiskService } from '../settlement-risk.service';
import { UsdtAddressValidator } from './usdt.address-validator';
import { CANONICAL_USDT_CONTRACTS } from './usdt.types';

@Injectable()
export class UsdtProvider implements SettlementProvider {
  private readonly logger = new Logger(UsdtProvider.name);

  readonly providerId = SettlementProviderId.USDT;
  readonly manifest: SettlementCapabilityManifest = {
    provider: SettlementProviderId.USDT,
    supports_buy: true,
    supports_sell: false,
    supports_refunds: true,
    supports_webhooks: false,
    supports_manual_review: true,
    supports_partial_payments: false,
    supported_assets: ['USDT'],
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: ProviderEventService,
    private readonly orchestrator: FinancialOrchestratorService,
    private readonly riskService: SettlementRiskService,
  ) {}

  getCapabilities(): SettlementCapabilityManifest {
    return this.manifest;
  }

  async initializeSettlement(settlementId: string) {
    const session = await this.load(settlementId);
    await this.emitSettlementEvent(settlementId, SettlementEventType.SettlementInitialized, { provider: this.providerId });
    return this.toProviderIndependentView(session);
  }

  async getSettlementStatus(settlementId: string) {
    const session = await this.load(settlementId);
    return this.toProviderIndependentView(session);
  }

  async verifySettlement(settlementId: string) {
    const session = await this.load(settlementId);
    await this.emitSettlementEvent(settlementId, SettlementEventType.SettlementVerificationStarted, { provider: this.providerId });
    return this.toProviderIndependentView(session);
  }

  /**
   * Create a USDT static address deposit session.
   */
  async createSettlement(telegramUserId: bigint, dto: CreateSettlementSessionDto) {
    // 1. Load active USDT config to fetch administrator-configured receiving address
    let config = await this.prisma.usdtConfig.findUnique({ where: { id: 'default' } });
    if (!config || !config.receivingAddress) {
      // Fallback default address if not seeded yet
      const defaultAddress = process.env.USDT_RECEIVING_ADDRESS || 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf';
      config = await this.prisma.usdtConfig.upsert({
        where: { id: 'default' },
        update: {},
        create: {
          id: 'default',
          enabled: true,
          network: 'TRON',
          tokenContract: CANONICAL_USDT_CONTRACTS.TRON,
          receivingAddress: defaultAddress,
          requiredConfirmations: 19,
        },
      });
    }

    if (!config.enabled) {
      throw new BadRequestException('SETTLEMENT_PROVIDER_DISABLED: USDT funding is currently disabled by administrator');
    }

    UsdtAddressValidator.validateOrThrow(config.receivingAddress, config.network);

    const expectedCryptoUsd = Number(dto.expectedCryptoAmount);

    // 2. Risk evaluation
    const riskResult = await this.riskService.evaluateUserRisk(telegramUserId, expectedCryptoUsd);
    if (!riskResult.allowed) {
      throw new BadRequestException(`SETTLEMENT_RISK_REJECTED: ${riskResult.reason}`);
    }

    const requiresAdminApproval = riskResult.requiresManualReview === true;
    const referenceCode = `USDT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const initialStatus = requiresAdminApproval ? SettlementStatus.CREATED : SettlementStatus.WAITING_FOR_PAYMENT;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min session validity

    const session = await this.prisma.settlementSession.create({
      data: {
        telegramUserId,
        provider: SettlementProviderId.USDT,
        asset: dto.asset || 'USDT',
        requestedAmount: new Prisma.Decimal(dto.requestedAmount),
        expectedCryptoAmount: new Prisma.Decimal(dto.expectedCryptoAmount),
        exchangeRate: new Prisma.Decimal(dto.exchangeRate || '1.0'),
        country: dto.country || 'GLOBAL',
        mobileMoneyNetwork: 'TRON_TRC20',
        referenceCode,
        status: initialStatus,
        expiresAt,
        providerMetadata: {
          provider: SettlementProviderId.USDT,
          network: config.network,
          tokenContract: config.tokenContract,
          receivingAddress: config.receivingAddress,
          requiredConfirmations: config.requiredConfirmations,
          requiresAdminApproval,
          expectedCryptoUsd,
          riskCode: riskResult.riskCode || null,
        },
        events: {
          create: [
            {
              eventType: SettlementEventType.SettlementCreated,
              actorType: 'CUSTOMER',
              actorId: telegramUserId.toString(),
              payload: {
                receivingAddress: config.receivingAddress,
                network: config.network,
                requiresAdminApproval,
                amountUsd: expectedCryptoUsd,
              },
            },
          ],
        },
      },
    });

    await this.emitSettlementEvent(session.id, SettlementEventType.SettlementInitialized, {
      referenceCode,
      receivingAddress: config.receivingAddress,
      network: config.network,
    });

    return {
      ...this.toProviderIndependentView(session),
      receivingAddress: config.receivingAddress,
      network: config.network,
      tokenContract: config.tokenContract,
      requiredConfirmations: config.requiredConfirmations,
      requiresAdminApproval,
    };
  }

  /**
   * Atomic Financial Approval & Settlement Execution.
   * Atomically transitions status to APPROVED to prevent double posting,
   * then calls FinancialOrchestratorService.
   */
  async approveSettlement(settlementId: string, context: Record<string, unknown> = {}) {
    const session = await this.load(settlementId);

    if (session.status === SettlementStatus.COMPLETED) {
      return this.toProviderIndependentView(session);
    }

    // Atomic SQL check
    const updatedCount = await this.prisma.settlementSession.updateMany({
      where: {
        id: settlementId,
        status: { in: [SettlementStatus.CREATED, SettlementStatus.WAITING_FOR_PAYMENT, SettlementStatus.VERIFYING] },
      },
      data: {
        status: SettlementStatus.APPROVED,
      },
    });

    if (updatedCount.count === 0) {
      const current = await this.load(settlementId);
      if (current.status === SettlementStatus.COMPLETED) {
        return this.toProviderIndependentView(current);
      }
      throw new BadRequestException(`SETTLEMENT_TRANSITION_FAILED: Session ${settlementId} status is ${current.status}`);
    }

    await this.emitSettlementEvent(settlementId, SettlementEventType.SettlementApproved, context);

    // Call Financial Orchestrator with SYSTEM_ALLOCATION
    const orchestratorRef = `usdt_settlement_${settlementId}`;
    await this.orchestrator.requestOperation({
      telegramUserId: session.telegramUserId,
      operationType: FinancialOperationType.SYSTEM_ALLOCATION,
      assetCode: session.asset,
      amount: session.expectedCryptoAmount.toString(),
      idempotencyKey: orchestratorRef,
      reference: orchestratorRef,
      metadata: {
        source: 'usdt_blockchain_settlement',
        settlementId,
        provider: this.providerId,
        ...context,
      },
    });

    const completed = await this.prisma.settlementSession.update({
      where: { id: settlementId },
      data: {
        status: SettlementStatus.COMPLETED,
        completedAt: new Date(),
        orchestratorReference: orchestratorRef,
        events: {
          create: {
            eventType: SettlementEventType.SettlementCompleted,
            actorType: 'SYSTEM',
            actorId: this.providerId,
            payload: { reference: orchestratorRef, ...context } as Prisma.InputJsonValue,
          },
        },
      },
    });

    await this.emitSettlementEvent(settlementId, SettlementEventType.SettlementCompleted, { reference: orchestratorRef });
    return this.toProviderIndependentView(completed);
  }

  rejectSettlement(settlementId: string, reason?: string) {
    return this.close(settlementId, SettlementStatus.REJECTED, SettlementEventType.SettlementRejected, { reason });
  }

  expireSettlement(settlementId: string) {
    return this.close(settlementId, SettlementStatus.EXPIRED, SettlementEventType.SettlementExpired);
  }

  cancelSettlement(settlementId: string) {
    return this.close(settlementId, SettlementStatus.CANCELLED, SettlementEventType.SettlementCancelled);
  }

  emitSettlementEvent(settlementId: string, eventType: SettlementEventType, payload: Record<string, unknown> = {}) {
    return this.events.emit(this.providerId, settlementId, eventType, payload);
  }

  private async close(settlementId: string, status: SettlementStatus, eventType: SettlementEventType, payload: Record<string, unknown> = {}) {
    const session = await this.load(settlementId);
    if (session.status === SettlementStatus.COMPLETED) {
      throw new BadRequestException('SETTLEMENT_ALREADY_COMPLETED');
    }
    const updated = await this.prisma.settlementSession.update({
      where: { id: settlementId },
      data: {
        status,
        events: {
          create: {
            eventType,
            actorType: 'PROVIDER',
            actorId: this.providerId,
            payload: payload as Prisma.InputJsonValue,
          },
        },
      },
    });
    await this.emitSettlementEvent(settlementId, eventType, payload);
    return this.toProviderIndependentView(updated);
  }

  private async load(settlementId: string) {
    const session = await this.prisma.settlementSession.findUnique({ where: { id: settlementId } });
    if (!session) throw new BadRequestException('SETTLEMENT_NOT_FOUND');
    return session;
  }

  toProviderIndependentView(session: any) {
    const metadata = (session.providerMetadata || {}) as any;
    return {
      settlementId: session.id,
      provider: session.provider,
      reference: session.referenceCode,
      asset: session.asset,
      requestedAmount: session.requestedAmount.toString(),
      expectedAssetAmount: session.expectedCryptoAmount.toString(),
      exchangeRate: session.exchangeRate.toString(),
      status: session.status,
      expiresAt: session.expiresAt,
      receivingAddress: metadata.receivingAddress || '',
      network: metadata.network || 'TRON',
      tokenContract: metadata.tokenContract || '',
      requiresAdminApproval: metadata.requiresAdminApproval || false,
    };
  }
}
