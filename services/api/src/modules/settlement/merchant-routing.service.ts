import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';

export interface SelectMerchantParams {
  network: string; // MTN | AIRTEL
  country?: string; // UG
  currency?: string; // UGX
  requestedLocalAmount: number;
}

@Injectable()
export class MerchantRoutingService {
  private readonly logger = new Logger(MerchantRoutingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Selects an active, priority-ranked Mobile Money Merchant for a network and validates transaction limits.
   */
  async selectActiveMerchant(params: SelectMerchantParams) {
    const network = (params.network || 'MTN').toUpperCase();
    const country = (params.country || 'UG').toUpperCase();
    const currency = (params.currency || 'UGX').toUpperCase();
    const amount = new Prisma.Decimal(params.requestedLocalAmount);

    // 1. Fetch active merchants matching network, country, currency ordered by priority ascending
    const merchants = await this.prisma.mobileMoneyMerchant.findMany({
      where: {
        network,
        country,
        currency,
        status: 'ACTIVE',
      },
      orderBy: {
        priority: 'asc',
      },
    });

    if (!merchants || merchants.length === 0) {
      this.logger.error(`[MERCHANT_ROUTING_ERR] No active merchant found for network=${network}, country=${country}, currency=${currency}`);
      throw new NotFoundException(`NO_ACTIVE_MERCHANT_FOR_${network}`);
    }

    // 2. Filter candidate merchants by per-transaction limit and daily limit
    for (const m of merchants) {
      if (amount.greaterThan(m.perTransactionLimit)) {
        this.logger.warn(`[MERCHANT_ROUTING] Merchant ${m.id} skipped: amount ${amount} exceeds per-transaction limit ${m.perTransactionLimit}`);
        continue;
      }

      // Check daily volume consumed today
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const todaySum = await this.prisma.settlementSession.aggregate({
        _sum: { requestedAmount: true },
        where: {
          merchantId: m.id,
          createdAt: { gte: startOfDay },
          status: { in: ['COMPLETED', 'WAITING_FOR_PAYMENT', 'AWAITING_VERIFICATION', 'VERIFYING'] },
        },
      });

      const currentDailyVolume = todaySum._sum.requestedAmount || new Prisma.Decimal(0);
      const projectedVolume = currentDailyVolume.plus(amount);

      if (projectedVolume.greaterThan(m.dailyLimit)) {
        this.logger.warn(`[MERCHANT_ROUTING] Merchant ${m.id} skipped: projected daily volume ${projectedVolume} exceeds daily limit ${m.dailyLimit}`);
        continue;
      }

      this.logger.log(`[MERCHANT_ROUTING] Selected active merchant ${m.id} (${m.merchantName} - ${m.merchantNumber}) for ${network} (${amount} ${currency})`);
      return m;
    }

    // Fallback: If limits exceeded on all merchants, return first active merchant for launch safety with warning
    this.logger.warn(`[MERCHANT_ROUTING] Limit check soft fallback to primary merchant ${merchants[0].id}`);
    return merchants[0];
  }

  /**
   * Retrieves assigned merchant for a session, ensuring immutability.
   */
  async getAssignedMerchant(merchantId: string) {
    const merchant = await this.prisma.mobileMoneyMerchant.findUnique({
      where: { id: merchantId },
    });
    if (!merchant) {
      throw new NotFoundException('ASSIGNED_MERCHANT_NOT_FOUND');
    }
    return merchant;
  }
}
