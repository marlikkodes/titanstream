import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PremiumTier } from '@prisma/client';

@Injectable()
export class PremiumService {
  private readonly logger = new Logger(PremiumService.name);
  private readonly PREMIUM_THRESHOLD = 1000.0;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get user's premium entitlement status
   */
  async getPremiumEntitlement(telegramUserId: bigint) {
    let entitlement = await this.prisma.userPremiumEntitlement.findUnique({
      where: { telegramUserId },
    });

    if (!entitlement) {
      entitlement = await this.prisma.userPremiumEntitlement.create({
        data: {
          telegramUserId,
          tier: PremiumTier.STANDARD,
          requiredAmount: this.PREMIUM_THRESHOLD,
        },
      });
    }

    return {
      tier: entitlement.tier,
      isPremium: entitlement.tier !== PremiumTier.STANDARD,
      requiredAmount: entitlement.requiredAmount.toNumber(),
      totalLifetimePayment: entitlement.totalLifetimePayment.toNumber(),
      lastPaymentAmount: entitlement.lastPaymentAmount.toNumber(),
      unlockedAt: entitlement.unlockedAt,
      unlockedByPaymentReference: entitlement.unlockedByPaymentReference,
    };
  }

  /**
   * Check if user has premium access (server-enforced gate)
   */
  async hasPremiumAccess(telegramUserId: bigint): Promise<boolean> {
    const entitlement = await this.prisma.userPremiumEntitlement.findUnique({
      where: { telegramUserId },
    });

    if (!entitlement) {
      return false;
    }

    return entitlement.tier !== PremiumTier.STANDARD && entitlement.unlockedAt !== null;
  }

  /**
   * Process payment and potentially unlock premium
   * Called after successful payment verification
   */
  async processPaymentForPremium(
    telegramUserId: bigint,
    amount: number,
    paymentReference: string,
  ): Promise<{ unlocked: boolean; tier: PremiumTier }> {
    const result = await this.prisma.$transaction(async (tx) => {
      let entitlement = await tx.userPremiumEntitlement.findUnique({
        where: { telegramUserId },
      });

      if (!entitlement) {
        entitlement = await tx.userPremiumEntitlement.create({
          data: {
            telegramUserId,
            tier: PremiumTier.STANDARD,
            requiredAmount: this.PREMIUM_THRESHOLD,
            totalLifetimePayment: amount,
            lastPaymentAmount: amount,
          },
        });
      } else {
        const newTotal = entitlement.totalLifetimePayment.toNumber() + amount;
        entitlement = await tx.userPremiumEntitlement.update({
          where: { telegramUserId },
          data: {
            totalLifetimePayment: newTotal,
            lastPaymentAmount: amount,
          },
        });
      }

      // Check if threshold met and not already unlocked
      const isUnlocked = entitlement.tier !== PremiumTier.STANDARD && entitlement.unlockedAt !== null;
      const thresholdMet = entitlement.totalLifetimePayment.toNumber() >= this.PREMIUM_THRESHOLD;

      if (thresholdMet && !isUnlocked) {
        // Unlock premium
        entitlement = await tx.userPremiumEntitlement.update({
          where: { telegramUserId },
          data: {
            tier: PremiumTier.PREMIUM,
            unlockedAt: new Date(),
            unlockedByPaymentReference: paymentReference,
          },
        });
      }

      return {
        unlocked: entitlement.tier !== PremiumTier.STANDARD && entitlement.unlockedAt !== null,
        tier: entitlement.tier,
      };
    });

    return result;
  }

  /**
   * Assert premium access - throws if user doesn't have premium
   * Use this as a guard before premium operations
   */
  async assertPremiumAccess(telegramUserId: bigint, operation: string): Promise<void> {
    const hasAccess = await this.hasPremiumAccess(telegramUserId);

    if (!hasAccess) {
      const entitlement = await this.getPremiumEntitlement(telegramUserId);
      const remaining = this.PREMIUM_THRESHOLD - entitlement.totalLifetimePayment;

      this.logger.warn(`[PREMIUM_GATE] User ${telegramUserId} denied premium access for ${operation}. Required: $${this.PREMIUM_THRESHOLD.toFixed(2)}, Paid: $${entitlement.totalLifetimePayment.toFixed(2)}`);
      
      throw new BadRequestException({
        code: 'PREMIUM_REQUIRED',
        message: `Premium access required for ${operation}. Required: $${this.PREMIUM_THRESHOLD.toFixed(2)}, Paid: $${entitlement.totalLifetimePayment.toFixed(2)}, Remaining: $${remaining.toFixed(2)}`,
        requiredAmount: this.PREMIUM_THRESHOLD,
        paidAmount: entitlement.totalLifetimePayment,
        remainingAmount: remaining,
      });
    }
  }

  /**
   * Admin: Manually grant premium to a user
   */
  async grantPremium(telegramUserId: bigint, adminReason: string): Promise<void> {
    this.logger.log(`[PREMIUM_ADMIN] Granting premium access to user ${telegramUserId}. Reason: ${adminReason}`);
    await this.prisma.userPremiumEntitlement.upsert({
      where: { telegramUserId },
      create: {
        telegramUserId,
        tier: PremiumTier.PREMIUM,
        requiredAmount: this.PREMIUM_THRESHOLD,
        unlockedAt: new Date(),
        unlockedByPaymentReference: `ADMIN_GRANT: ${adminReason}`,
      },
      update: {
        tier: PremiumTier.PREMIUM,
        unlockedAt: new Date(),
        unlockedByPaymentReference: `ADMIN_GRANT: ${adminReason}`,
      },
    });
  }

  /**
   * Admin: Revoke premium from a user
   */
  async revokePremium(telegramUserId: bigint, adminReason: string): Promise<void> {
    this.logger.warn(`[PREMIUM_ADMIN] Revoking premium access from user ${telegramUserId}. Reason: ${adminReason}`);
    await this.prisma.userPremiumEntitlement.update({
      where: { telegramUserId },
      data: {
        tier: PremiumTier.STANDARD,
        unlockedAt: null,
        unlockedByPaymentReference: `ADMIN_REVOKE: ${adminReason}`,
      },
    });
  }
}
