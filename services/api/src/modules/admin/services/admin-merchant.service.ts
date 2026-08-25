import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { MerchantPaymentMatchingService, MatchingFailureReason } from '../../settlement/merchant-payment-matching.service';
import { SettlementService } from '../../settlement/settlement.service';

@Injectable()
export class AdminMerchantService {
  private readonly logger = new Logger(AdminMerchantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matchingService: MerchantPaymentMatchingService,
    private readonly settlementService: SettlementService,
  ) {}

  /**
   * Retrieves pending claims in AWAITING_VERIFICATION queue for Admin UI review.
   */
  async getPendingVerificationQueue() {
    const claims = await this.prisma.merchantPaymentClaim.findMany({
      where: {
        status: { in: ['AWAITING_VERIFICATION', 'REFERENCE_SUBMITTED'] },
      },
      include: {
        settlement: true,
        merchant: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return claims.map((c) => ({
      claimId: c.id,
      settlementId: c.settlementId,
      telegramUserId: c.telegramUserId.toString(),
      network: c.network,
      merchantName: c.merchant.merchantName,
      merchantNumber: c.merchant.merchantNumber,
      expectedAmountUsdt: c.settlement.expectedCryptoAmount.toString(),
      expectedLocalAmountUgx: c.expectedAmount.toString(),
      submittedReference: c.submittedReference,
      submittedAt: c.submittedAt,
      status: c.status,
      failureReason: c.failureReason || MatchingFailureReason.REFERENCE_NOT_FOUND,
      createdAt: c.createdAt,
    }));
  }

  /**
   * Admin "Verify & Settle" action.
   * Ingests authoritative reference if missing and triggers authoritative matching/settlement idempotently.
   */
  async verifyAndSettle(claimId: string, adminUserId: string) {
    const claim = await this.prisma.merchantPaymentClaim.findUnique({
      where: { id: claimId },
      include: { settlement: true, merchant: true },
    });

    if (!claim || !claim.settlement) {
      throw new NotFoundException('CLAIM_NOT_FOUND');
    }

    if (claim.settlement.status === 'COMPLETED') {
      return { success: true, message: 'Settlement already completed', claimId };
    }

    this.logger.log(`[ADMIN_VERIFY_SETTLE] Admin [${adminUserId}] executing Verify & Settle for claim [${claimId}] ref "${claim.submittedReference}"`);

    // Ingest reference to ensure transaction record exists
    await this.matchingService.ingestMerchantTransaction({
      merchantId: claim.merchantId,
      network: claim.network,
      transactionReference: claim.submittedReference,
      amount: claim.expectedAmount.toNumber(),
      currency: 'UGX',
      recipientMerchant: claim.merchant.merchantName,
      rawMetadata: { adminApprovedBy: adminUserId, approvedAt: new Date() },
    });

    // Execute matching
    const result = await this.matchingService.attemptMatchClaim(claimId);
    if (result.matched) {
      return { success: true, settlementId: claim.settlementId, status: 'COMPLETED' };
    }

    throw new BadRequestException(`VERIFICATION_FAILED: ${result.failureReason || 'Verification failed'}`);
  }

  /**
   * Admin "Reject Claim" action.
   */
  async rejectClaim(claimId: string, adminUserId: string, reason?: string) {
    const claim = await this.prisma.merchantPaymentClaim.findUnique({
      where: { id: claimId },
    });

    if (!claim) {
      throw new NotFoundException('CLAIM_NOT_FOUND');
    }

    await this.prisma.merchantPaymentClaim.update({
      where: { id: claimId },
      data: {
        status: 'EXPIRED',
        failureReason: MatchingFailureReason.SUSPICIOUS_TRANSACTION,
      },
    });

    this.logger.log(`[AdminMerchant] Claim ${claimId} rejected by admin ${adminUserId}. Reason: ${reason || 'Manual Admin Rejection'}`);
    return { success: true, claimId, status: 'EXPIRED' };
  }

  /**
   * List all registered Mobile Money Merchants & Paybills.
   */
  async listMerchants() {
    const merchants = await this.prisma.mobileMoneyMerchant.findMany({
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });
    return merchants.map((m) => ({
      id: m.id,
      network: m.network,
      merchantName: m.merchantName,
      merchantNumber: m.merchantNumber,
      country: m.country,
      currency: m.currency,
      status: m.status,
      priority: m.priority,
      dailyLimit: m.dailyLimit.toString(),
      perTransactionLimit: m.perTransactionLimit.toString(),
      createdAt: m.createdAt,
    }));
  }

  /**
   * Create or update a Mobile Money Merchant Paybill code.
   */
  async upsertMerchant(dto: {
    id?: string;
    network: string;
    merchantName: string;
    merchantNumber: string;
    country?: string;
    currency?: string;
    status?: string;
    dailyLimit?: number | string;
    perTransactionLimit?: number | string;
  }) {
    if (!dto.network || !dto.merchantName || !dto.merchantNumber) {
      throw new BadRequestException('MISSING_FIELDS: network, merchantName, and merchantNumber are required');
    }

    const data: any = {
      network: dto.network.toUpperCase(),
      merchantName: dto.merchantName.trim(),
      merchantNumber: dto.merchantNumber.trim(),
      country: (dto.country || 'UG').toUpperCase(),
      currency: (dto.currency || 'UGX').toUpperCase(),
      status: dto.status || 'ACTIVE',
      dailyLimit: dto.dailyLimit ? Number(dto.dailyLimit) : 10000000,
      perTransactionLimit: dto.perTransactionLimit ? Number(dto.perTransactionLimit) : 5000000,
    };

    if (dto.id) {
      const updated = await this.prisma.mobileMoneyMerchant.update({
        where: { id: dto.id },
        data,
      });
      return { success: true, merchant: updated };
    }

    const created = await this.prisma.mobileMoneyMerchant.create({
      data,
    });
    return { success: true, merchant: created };
  }

  /**
   * Toggle merchant active / paused status.
   */
  async toggleMerchantStatus(id: string, status: string) {
    const updated = await this.prisma.mobileMoneyMerchant.update({
      where: { id },
      data: { status: status.toUpperCase() },
    });
    return { success: true, merchant: updated };
  }
}
