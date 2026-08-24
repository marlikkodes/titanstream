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
    return {
      success: result.matched,
      claimId,
      matched: result.matched,
      failureReason: result.failureReason,
    };
  }

  /**
   * Admin "Reject" action.
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
        status: 'REJECTED',
        failureReason: reason || 'REJECTED_BY_ADMIN',
      },
    });

    this.logger.log(`[ADMIN_REJECT_CLAIM] Admin [${adminUserId}] rejected claim [${claimId}]: ${reason}`);
    return { success: true, claimId, status: 'REJECTED' };
  }
}
