import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import { FinancialOrchestratorService } from '../financial-orchestration/financial-orchestrator.service';
import { MachineService } from '../machine/machine.service';
import { FinancialOperationType } from '@prisma/client';
import { AuditEventType } from '../../common/interfaces/user-state.enum';

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

@Injectable()
export class PaymentOrderService {
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
  ) {}

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
    const userStr = String(userKey);
    const telegramUserIdBig = this.toBigIntUserId(userKey);
    const reference = `ORD-${Date.now().toString().slice(-6)}`;
    const currency = dto.currency || 'USDT';
    const network = dto.network || 'MTN';
    const country = dto.country || 'UG';

    const config = this.defaultConfigs.find((c) => c.network === network && c.country === country) || this.defaultConfigs[0];
    
    // Calculate local amount if currency is fiat or USDT
    let localAmount = dto.amount;
    let usdtAmount = dto.amount;

    if (currency === 'USDT') {
      localAmount = Math.round(dto.amount * config.exchangeRateUsdt);
    } else {
      usdtAmount = Number((dto.amount / config.exchangeRateUsdt).toFixed(2));
    }

    // Format USSD Code from template
    const ussdCode = config.ussdTemplate
      .replace('{phone}', config.receivingNumber)
      .replace('{amount}', Math.round(localAmount).toString());

    // Encode for tel: protocol (encode # as %23)
    const telUri = `tel:${ussdCode.replace('#', '%23')}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 mins expiry

    const sessionType = dto.type === 'WITHDRAWAL' ? 'WITHDRAWAL' : 'DEPOSIT';

    // Ensure User record exists in DB for foreign key constraint
    let user = await this.prisma.user.findUnique({ where: { telegramUserId: telegramUserIdBig } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          telegramUserId: telegramUserIdBig,
          firstName: `User_${telegramUserIdBig}`,
        },
      });
    }

    const session = await this.prisma.settlementSession.create({
      data: {
        telegramUserId: telegramUserIdBig,
        sessionType: sessionType as any,
        asset: 'USDT',
        requestedAmount: usdtAmount,
        expectedCryptoAmount: usdtAmount,
        exchangeRate: config.exchangeRateUsdt,
        country,
        mobileMoneyNetwork: network,
        referenceCode: reference,
        status: 'CREATED',
        expiresAt,
        providerMetadata: {
          type: dto.type,
          currency,
          localAmount,
          paymentMethod: dto.paymentMethod || 'MOBILE_MONEY',
          receivingNumber: config.receivingNumber,
          receivingName: config.receivingName,
          ussdCode,
          telUri,
          metadata: dto.metadata || {},
        },
      },
    });

    await this.audit.create({
      telegramUserId: telegramUserIdBig,
      eventType: AuditEventType.TRANSACTION_CREATED,
      description: `Created ${dto.type} payment order ${reference}`,
      metadata: { orderId: session.id, reference, amount: usdtAmount, type: dto.type },
    });

    return {
      id: session.id,
      reference: session.referenceCode,
      userId: userStr,
      telegramUserId: userStr,
      type: dto.type,
      amount: usdtAmount,
      localAmount,
      currency,
      asset: 'USDT',
      paymentMethod: dto.paymentMethod || 'MOBILE_MONEY',
      network,
      country,
      status: 'AWAITING_PAYMENT' as PaymentOrderStatus,
      receivingNumber: config.receivingNumber,
      receivingName: config.receivingName,
      ussdCode,
      telUri,
      expiresAt: session.expiresAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      metadata: dto.metadata || {},
    };
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
      type: meta.type || (session.sessionType === 'WITHDRAWAL' ? 'WITHDRAWAL' : 'DEPOSIT'),
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

  async getUserOrders(userKey: string | bigint) {
    const telegramUserIdBig = this.toBigIntUserId(userKey);
    const sessions = await this.prisma.settlementSession.findMany({
      where: { telegramUserId: telegramUserIdBig },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return sessions.map((session) => {
      const meta = (session.providerMetadata as any) || {};
      return {
        id: session.id,
        reference: session.referenceCode,
        userId: session.telegramUserId.toString(),
        telegramUserId: session.telegramUserId.toString(),
        type: meta.type || (session.sessionType === 'WITHDRAWAL' ? 'WITHDRAWAL' : 'DEPOSIT'),
        amount: Number(session.requestedAmount),
        localAmount: meta.localAmount || Number(session.requestedAmount) * Number(session.exchangeRate),
        currency: meta.currency || 'USDT',
        asset: session.asset,
        paymentMethod: meta.paymentMethod || 'MOBILE_MONEY',
        network: session.mobileMoneyNetwork,
        country: session.country,
        status: session.status as any,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        metadata: meta.metadata || {},
      };
    });
  }

  async getAllOrders() {
    const sessions = await this.prisma.settlementSession.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return sessions.map((session) => {
      const meta = (session.providerMetadata as any) || {};
      return {
        id: session.id,
        reference: session.referenceCode,
        userId: session.telegramUserId.toString(),
        telegramUserId: session.telegramUserId.toString(),
        type: meta.type || (session.sessionType === 'WITHDRAWAL' ? 'WITHDRAWAL' : 'DEPOSIT'),
        amount: Number(session.requestedAmount),
        localAmount: meta.localAmount || Number(session.requestedAmount) * Number(session.exchangeRate),
        currency: meta.currency || 'USDT',
        asset: session.asset,
        paymentMethod: meta.paymentMethod || 'MOBILE_MONEY',
        network: session.mobileMoneyNetwork,
        country: session.country,
        status: session.status as any,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        metadata: meta.metadata || {},
      };
    });
  }

  async submitForVerification(orderId: string) {
    const session = await this.prisma.settlementSession.findFirst({
      where: { OR: [{ id: orderId }, { referenceCode: orderId }] },
    });
    if (!session) throw new NotFoundException('PAYMENT_ORDER_NOT_FOUND');

    const updated = await this.prisma.settlementSession.update({
      where: { id: session.id },
      data: { status: 'PENDING_VERIFICATION' as any },
    });

    return this.getOrder(updated.id);
  }

  async approveOrder(orderId: string, adminUserId?: string) {
    const order = await this.getOrder(orderId);
    const session = await this.prisma.settlementSession.findUnique({ where: { id: order.id } });
    if (!session) throw new NotFoundException('PAYMENT_ORDER_NOT_FOUND');

    await this.prisma.settlementSession.update({
      where: { id: session.id },
      data: {
        status: 'PROCESSING' as any,
        verifiedByAdminId: adminUserId || 'system_admin',
        verifiedAt: new Date(),
      },
    });

    const telegramUserId = this.toBigIntUserId(order.telegramUserId);
    const orchestratorRef = `po_ledger_${order.reference}`;

    // Map operation type
    let opType: FinancialOperationType = FinancialOperationType.SYSTEM_ALLOCATION;
    if (order.type === 'WITHDRAWAL') opType = FinancialOperationType.WITHDRAWAL_SETTLE;
    else if (order.type === 'MACHINE_PURCHASE') opType = FinancialOperationType.SYSTEM_ALLOCATION;

    // Post to double-entry ledger via FinancialOrchestratorService
    await this.orchestrator.requestOperation({
      telegramUserId,
      operationType: opType,
      assetCode: 'USDT',
      amount: order.amount.toString(),
      idempotencyKey: orchestratorRef,
      reference: orchestratorRef,
      metadata: { orderId: order.id, reference: order.reference, type: order.type, approvedBy: adminUserId || 'system_admin' },
    });

    if (order.type === 'MACHINE_PURCHASE' && order.metadata?.targetTierCode) {
      const targetTierCode = order.metadata.targetTierCode as string;
      if (this.machineService) {
        await this.machineService.fulfillMachineOwnershipAfterPayment(telegramUserId, targetTierCode, order.amount);
      }
    }

    const completed = await this.prisma.settlementSession.update({
      where: { id: session.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // Send User Notification
    await this.notification.createNotification({
      userId: telegramUserId,
      templateCode: 'PAYMENT_ORDER_APPROVED',
      message: `Your ${order.type.toLowerCase()} of $${order.amount.toFixed(2)} USDT (Ref: ${order.reference}) has been verified and processed to your wallet.`,
    });

    await this.audit.create({
      telegramUserId,
      eventType: AuditEventType.TRANSACTION_COMPLETED,
      description: `Payment order ${order.reference} approved and posted to ledger`,
      metadata: { orderId: order.id, reference: order.reference, adminUserId },
    });

    return this.getOrder(completed.id);
  }

  async rejectOrder(orderId: string, reason: string, adminUserId?: string) {
    const order = await this.getOrder(orderId);
    const session = await this.prisma.settlementSession.findUnique({ where: { id: order.id } });
    if (!session) throw new NotFoundException('PAYMENT_ORDER_NOT_FOUND');

    const updated = await this.prisma.settlementSession.update({
      where: { id: session.id },
      data: {
        status: 'FAILED',
        providerMetadata: {
          ...((session.providerMetadata as any) || {}),
          rejectionReason: reason,
          rejectedByAdminId: adminUserId || 'system_admin',
        },
      },
    });

    const telegramUserId = this.toBigIntUserId(order.telegramUserId);
    await this.notification.createNotification({
      userId: telegramUserId,
      templateCode: 'PAYMENT_ORDER_REJECTED',
      message: `Your ${order.type.toLowerCase()} order ${order.reference} was rejected: ${reason}`,
    });

    return this.getOrder(updated.id);
  }
}
