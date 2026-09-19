import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import { FinancialOrchestratorService } from '../financial-orchestration/financial-orchestrator.service';
import { MachineService } from '../machine/machine.service';
import { FinancialOperationType, AuditEventType } from '@prisma/client';

/**
 * DEPRECATED: PaymentOrderService is quarantined.
 * Use PaymentIntentService for all new payment flows.
 * This service is retained only for historical data reference.
 */

export type PaymentOrderType = 'DEPOSIT' | 'WITHDRAWAL' | 'MACHINE_PURCHASE' | 'REFUND' | 'ADJUSTMENT';
export type PaymentOrderStatus = 
  | 'CREATED' 
  | 'AWAITING_PAYMENT' 
  | 'AWAITING_VERIFICATION' 
  | 'APPROVED' 
  | 'POSTING_TO_LEDGER' 
  | 'COMPLETED' 
  | 'REJECTED' 
  | 'EXPIRED' 
  | 'CANCELLED';

export interface CreatePaymentOrderDto {
  type: PaymentOrderType;
  amount: number; // in USDT or fiat equivalent
  currency?: string; // USDT, UGX, KES
  paymentMethod?: 'MOBILE_MONEY' | 'CARD' | 'USDT';
  network?: string; // MTN, AIRTEL
  country?: string; // UG, KE
  mobileNumber?: string;
  metadata?: Record<string, any>;
}

export interface PaymentDestinationConfig {
  id: string;
  network: string;
  country: string;
  currency: string;
  receivingNumber: string;
  receivingName: string;
  ussdTemplate: string;
  exchangeRateUsdt: number;
  minAmountUsdt: number;
  maxAmountUsdt: number;
  isActive: boolean;
}

const paymentOrderTypeFromSession = (sessionType: string, metaType?: PaymentOrderType): PaymentOrderType =>
  metaType || (sessionType === 'PAYOUT' ? 'WITHDRAWAL' : 'DEPOSIT');

@Injectable()
export class PaymentOrderService {
  private readonly logger = new Logger(PaymentOrderService.name);
  private readonly QUARANTINED = true;

  // Configurable Command Center destinations for mobile money receiving
  private readonly defaultConfigs: PaymentDestinationConfig[] = [
    {
      id: 'cfg_mtn_ug',
      network: 'MTN',
      country: 'UG',
      currency: 'UGX',
      receivingNumber: '234654',
      receivingName: 'TitanStream Escrow UG',
      ussdTemplate: '*165*1*1*{phone}*{amount}#',
      exchangeRateUsdt: 3700,
      minAmountUsdt: 1.0,
      maxAmountUsdt: 5000.0,
      isActive: true,
    },
    {
      id: 'cfg_airtel_ug',
      network: 'AIRTEL',
      country: 'UG',
      currency: 'UGX',
      receivingNumber: '7183443',
      receivingName: 'TitanStream Escrow UG',
      ussdTemplate: '*185*9*{phone}*{amount}#',
      exchangeRateUsdt: 3700,
      minAmountUsdt: 1.0,
      maxAmountUsdt: 5000.0,
      isActive: true,
    },
  ];

  // In-memory PaymentOrder store (persists orders across operational flows)
  private readonly orders = new Map<string, any>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notification: NotificationService,
    private readonly orchestrator: FinancialOrchestratorService,
    @Inject(forwardRef(() => MachineService))
    private readonly machineService?: MachineService,
  ) {
    this.logger.warn('[DEPRECATED] PaymentOrderService is quarantined. Use PaymentIntentService for all new payment flows.');
  }

  getDestinationConfigs(): PaymentDestinationConfig[] {
    return this.defaultConfigs.filter((c) => c.isActive);
  }

  updateDestinationConfig(id: string, dto: Partial<PaymentDestinationConfig>) {
    const idx = this.defaultConfigs.findIndex((c) => c.id === id);
    if (idx !== -1) {
      this.defaultConfigs[idx] = { ...this.defaultConfigs[idx], ...dto };
      return this.defaultConfigs[idx];
    }
    const newCfg: PaymentDestinationConfig = {
      id,
      network: dto.network || 'MTN',
      country: dto.country || 'UG',
      currency: dto.currency || 'UGX',
      receivingNumber: dto.receivingNumber || '0770000000',
      receivingName: dto.receivingName || 'TitanStream Escrow',
      ussdTemplate: dto.ussdTemplate || '*165*1*1*{phone}*{amount}#',
      exchangeRateUsdt: dto.exchangeRateUsdt || 3700,
      minAmountUsdt: dto.minAmountUsdt || 1.0,
      maxAmountUsdt: dto.maxAmountUsdt || 5000.0,
      isActive: dto.isActive ?? true,
    };
    this.defaultConfigs.push(newCfg);
    return newCfg;
  }

  private toBigIntUserId(userKey: string | bigint): bigint {
    if (typeof userKey === 'bigint') return userKey;
    const str = String(userKey || '').trim();
    const digits = str.replace(/\D/g, '');
    if (digits.length > 0) {
      try {
        return BigInt(digits);
      } catch {
        // safe fallback to hash
      }
    }
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return BigInt(Math.abs(hash) + 100000);
  }

  async createOrder(userKey: bigint | string, dto: CreatePaymentOrderDto) {
    // BLOCK: This service is quarantined
    throw new BadRequestException('PAYMENT_ORDER_SERVICE_QUARANTINED: Use PaymentIntentService via POST /api/v1/payment-intents for all new payment flows. PaymentOrderService is deprecated and retained only for historical data reference.');
  }

  async getOrder(orderId: string) {
    const session = await this.prisma.settlementSession.findFirst({
      where: { OR: [{ id: orderId }, { referenceCode: orderId }] },
    });
    if (!session) throw new NotFoundException('PAYMENT_ORDER_NOT_FOUND');
    const meta = (session.providerMetadata as any) || {};

    return {
      id: session.id,
      reference: session.referenceCode,
      userId: session.telegramUserId.toString(),
      telegramUserId: session.telegramUserId.toString(),
      type: paymentOrderTypeFromSession(session.sessionType, meta.type),
      amount: Number(session.requestedAmount),
      localAmount: meta.localAmount || Number(session.requestedAmount) * Number(session.exchangeRate),
      currency: meta.currency || 'USDT',
      asset: session.asset,
      paymentMethod: meta.paymentMethod || 'MOBILE_MONEY',
      network: session.mobileMoneyNetwork,
      country: session.country,
      status: session.status as any,
      receivingNumber: meta.receivingNumber || '234654',
      receivingName: meta.receivingName || 'TitanStream Escrow',
      ussdCode: meta.ussdCode || '*165*1*1*234654*10000#',
      telUri: meta.telUri || 'tel:*165*1*1*234654*10000%23',
      expiresAt: session.expiresAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      metadata: meta.metadata || {},
    };
  }
}
