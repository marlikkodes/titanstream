import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaymentIntentService } from '../payment-intent/payment-intent.service';
import { PaymentIntentStatus, PaymentMethod } from '@prisma/client';
import { NotificationService } from '../notification/notification.service';
import { EventBusService } from '../automation/event-bus.service';

/**
 * Mobile Money Approval Queue Service
 * Manages the queue of mobile money payments requiring admin verification
 */
@Injectable()
export class MobileMoneyApprovalQueueService {
  private readonly logger = new Logger(MobileMoneyApprovalQueueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentIntentService: PaymentIntentService,
    private readonly notification: NotificationService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * When a mobile money payment is detected, add it to the approval queue
   * and notify admins
   */
  async addToApprovalQueue(paymentIntentId: string, externalReference: string): Promise<void> {
    const intent = await this.prisma.paymentIntent.findUnique({
      where: { id: paymentIntentId },
      include: { verification: true },
    });

    if (!intent) {
      this.logger.error(`[ApprovalQueue] PaymentIntent ${paymentIntentId} not found`);
      return;
    }

    if (intent.paymentMethod !== PaymentMethod.MOBILE_MONEY) {
      this.logger.warn(`[ApprovalQueue] PaymentIntent ${paymentIntentId} is not mobile money, skipping queue`);
      return;
    }

    // Mark as detected
    await this.paymentIntentService.markPaymentDetected(paymentIntentId, externalReference);

    // Start verification process
    await this.paymentIntentService.startVerification(paymentIntentId);

    // Notify admins via multiple channels
    await this.notifyAdmins(intent);

    // Emit event for real-time listeners
    this.eventBus.publish({
      type: 'PAYMENT_APPROVAL_QUEUE_ADD',
      correlationId: `approval_queue_${paymentIntentId}`,
      actorId: intent.telegramUserId.toString(),
      payload: {
        paymentIntentId,
        reference: intent.reference,
        amount: intent.requestedAmount.toString(),
        currency: intent.currency,
        network: intent.network,
        country: intent.country,
        externalReference,
      },
    });

    this.logger.log(`[ApprovalQueue] Added ${intent.reference} to mobile money approval queue`);
  }

  /**
   * Get the current approval queue for mobile money payments
   */
  async getApprovalQueue(limit = 50, offset = 0): Promise<any[]> {
    const intents = await this.prisma.paymentIntent.findMany({
      where: {
        paymentMethod: PaymentMethod.MOBILE_MONEY,
        status: { in: [PaymentIntentStatus.DETECTED, PaymentIntentStatus.VERIFYING, PaymentIntentStatus.MANUAL_REVIEW] },
        expiresAt: { gt: new Date() },
      },
      include: { attempts: true, verification: true },
      orderBy: { createdAt: 'asc' },
      take: limit,
      skip: offset,
    });

    return intents.map(intent => ({
      id: intent.id,
      reference: intent.reference,
      telegramUserId: intent.telegramUserId,
      amount: intent.requestedAmount.toString(),
      currency: intent.currency,
      network: intent.network,
      country: intent.country,
      merchantDestination: intent.merchantDestination,
      status: intent.status,
      createdAt: intent.createdAt,
      attempts: intent.attempts,
      verification: intent.verification,
    }));
  }

  /**
   * Notify admins about a payment requiring approval
   */
  private async notifyAdmins(intent: any): Promise<void> {
    // Get admin users with OPERATIONS_ADMIN or FINANCE_ADMIN role
    const admins = await this.prisma.adminUser.findMany({
      where: {
        isActive: true,
        role: { in: ['OPERATIONS_ADMIN', 'FINANCE_ADMIN'] },
      },
    });

    for (const admin of admins) {
      await this.notification.createNotification({
        userId: BigInt(0), // System notification for admins - may need separate admin notification system
        templateCode: 'PAYMENT_APPROVAL_REQUIRED',
        message: `🔔 PAYMENT APPROVAL REQUIRED\n\nPayment: ${intent.reference}\nUser ID: ${intent.telegramUserId}\nAmount: ${intent.requestedAmount} ${intent.currency}\nNetwork: ${intent.network}\nCountry: ${intent.country}\nStatus: AWAITING VERIFICATION\n\n[VERIFY & APPROVE]\n[REJECT]\n[OPEN]`,
      });
    }

    this.logger.log(`[ApprovalQueue] Notified ${admins.length} admins about payment ${intent.reference}`);
  }

  /**
   * Auto-escalate payments that have been in VERIFYING too long
   * Called by cron job
   */
  async escalateStuckPayments(): Promise<{ escalated: number }> {
    const stuckThreshold = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes

    const stuckIntents = await this.prisma.paymentIntent.findMany({
      where: {
        status: PaymentIntentStatus.VERIFYING,
        createdAt: { lt: stuckThreshold },
        expiresAt: { gt: new Date() },
      },
    });

    for (const intent of stuckIntents) {
      await this.paymentIntentService.escalateToManualReview(
        intent.id,
        'Auto-escalated due to verification timeout',
      );
    }

    this.logger.log(`[ApprovalQueue] Escalated ${stuckIntents.length} stuck payments to manual review`);

    return { escalated: stuckIntents.length };
  }
}
