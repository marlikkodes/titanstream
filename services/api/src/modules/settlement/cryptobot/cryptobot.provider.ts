import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { FinancialOperationType, PaymentInvoiceStatus, Prisma, SettlementEventType, SettlementProviderId, SettlementStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { FinancialOrchestratorService } from '../../financial-orchestration/financial-orchestrator.service';
import { CreateSettlementSessionDto } from '../dto/create-settlement-session.dto';
import { ProviderEventService } from '../provider-event.service';
import { SettlementCapabilityManifest, SettlementProvider } from '../settlement-provider.interface';
import { CryptoBotClient } from './cryptobot.client';

@Injectable()
export class CryptoBotProvider implements SettlementProvider {
  private readonly logger = new Logger(CryptoBotProvider.name);

  readonly providerId = SettlementProviderId.CRYPTOBOT;
  readonly manifest: SettlementCapabilityManifest = {
    provider: SettlementProviderId.CRYPTOBOT,
    supports_buy: true,
    supports_sell: false,
    supports_refunds: false,
    supports_webhooks: true,
    supports_manual_review: false,
    supports_partial_payments: false,
    supported_assets: ['USDT'],
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: ProviderEventService,
    private readonly orchestrator: FinancialOrchestratorService,
    private readonly cryptoBotClient: CryptoBotClient,
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
    const session = await this.validateSettlement(settlementId);
    await this.emitSettlementEvent(settlementId, SettlementEventType.SettlementVerificationStarted, { provider: this.providerId });
    return this.toProviderIndependentView(session);
  }

  /**
   * Create a live CryptoBot payment invoice and save a local SettlementSession & PaymentInvoice.
   */
  async createSettlement(_telegramUserId: bigint, _dto: CreateSettlementSessionDto): Promise<any> {
    throw new BadRequestException('UNSUPPORTED_PROVIDER: CryptoBot funding has been retired. Please use Pesapal Mobile Money or Card.');
  }

  async validateSettlement(settlementId: string) {
    const session = await this.load(settlementId);
    if (session.provider !== SettlementProviderId.CRYPTOBOT) throw new BadRequestException('WRONG_SETTLEMENT_PROVIDER');
    if (session.expiresAt <= new Date()) throw new BadRequestException('SETTLEMENT_EXPIRED');
    return session;
  }

  monitorSettlement(settlementId: string) {
    return this.load(settlementId);
  }

  async approveSettlement(settlementId: string, context: Record<string, unknown> = {}) {
    const session = await this.validateSettlement(settlementId);
    if (session.status === SettlementStatus.COMPLETED) return this.toProviderIndependentView(session);
    if (session.status !== SettlementStatus.WAITING_FOR_PAYMENT && session.status !== SettlementStatus.VERIFYING) {
      throw new BadRequestException(`INVALID_SETTLEMENT_TRANSITION:${session.status}->APPROVED`);
    }

    await this.prisma.settlementSession.update({
      where: { id: settlementId },
      data: {
        status: SettlementStatus.APPROVED,
        events: { create: { eventType: SettlementEventType.SettlementApproved, actorType: 'PROVIDER', actorId: this.providerId, payload: context as Prisma.InputJsonValue } },
      },
    });
    await this.emitSettlementEvent(settlementId, SettlementEventType.SettlementApproved, context);

    const reference = `settlement_${settlementId}`;
    await this.orchestrator.requestOperation({
      telegramUserId: session.telegramUserId,
      operationType: FinancialOperationType.SYSTEM_ALLOCATION,
      assetCode: session.asset,
      amount: session.expectedCryptoAmount.toString(),
      idempotencyKey: reference,
      reference,
      metadata: { source: 'cryptobot_settlement', settlementId, provider: this.providerId, ...context },
    });

    const completed = await this.prisma.settlementSession.update({
      where: { id: settlementId },
      data: {
        status: SettlementStatus.COMPLETED,
        completedAt: new Date(),
        orchestratorReference: reference,
        events: { create: { eventType: SettlementEventType.SettlementCompleted, actorType: 'SYSTEM', actorId: this.providerId, payload: { reference } } },
      },
    });
    await this.emitSettlementEvent(settlementId, SettlementEventType.SettlementCompleted, { reference });
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
    if (session.status === SettlementStatus.COMPLETED) throw new BadRequestException('SETTLEMENT_ALREADY_COMPLETED');
    const updated = await this.prisma.settlementSession.update({
      where: { id: settlementId },
      data: { status, events: { create: { eventType, actorType: 'PROVIDER', actorId: this.providerId, payload: payload as Prisma.InputJsonValue } } },
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
    };
  }
}
