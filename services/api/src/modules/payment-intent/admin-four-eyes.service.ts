import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AdminRole } from '@prisma/client';

/**
 * Admin Four-Eyes Control Service
 * Prevents self-approval and enforces separation of duties
 */
@Injectable()
export class AdminFourEyesService {
  private readonly logger = new Logger(AdminFourEyesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if an admin can approve a payment
   * Prevents self-approval
   */
  async canApprovePayment(adminId: string, paymentIntentId: string): Promise<boolean> {
    const intent = await this.prisma.paymentIntent.findUnique({
      where: { id: paymentIntentId },
      include: { verification: true },
    });

    if (!intent) {
      return false;
    }

    const metadata = intent.metadata as any;
    // Check if the same admin initiated the payment
    if (metadata?.initiatedByAdminId === adminId) {
      this.logger.warn(`[FourEyes] Admin ${adminId} attempted to approve payment they initiated`);
      return false;
    }

    // Check if the same admin already verified it
    if (intent.verification?.verifiedByAdminId === adminId) {
      this.logger.warn(`[FourEyes] Admin ${adminId} attempted to re-approve payment they already verified`);
      return false;
    }

    return true;
  }

  /**
   * Check if an admin has sufficient role for payment approval
   */
  async hasApprovalRole(adminId: string): Promise<boolean> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      return false;
    }

    return [
      AdminRole.SUPER_ADMIN,
      AdminRole.OPERATIONS_ADMIN,
      AdminRole.FINANCE_ADMIN,
    ].includes(admin.role as any);
  }

  /**
   * Require four-eyes approval for high-value payments
   */
  async requiresFourEyesApproval(amount: number): Promise<boolean> {
    // Payments above 1000 USDT require two-approval
    return amount > 1000;
  }

  /**
   * Check if payment has required approvals
   */
  async hasRequiredApprovals(paymentIntentId: string): Promise<boolean> {
    const intent = await this.prisma.paymentIntent.findUnique({
      where: { id: paymentIntentId },
    });

    if (!intent) {
      return false;
    }

    const amount = Number(intent.requestedAmount);
    const requiresFourEyes = await this.requiresFourEyesApproval(amount);

    if (!requiresFourEyes) {
      return true; // Single approval sufficient
    }

    // Check for secondary approval
    const verification = await this.prisma.paymentVerification.findUnique({
      where: { paymentIntentId },
    });

    if (!verification) {
      return false;
    }

    const metadata = verification.metadata as any;
    // For four-eyes, we need two different admins to have approved
    // This is a simplified check - in production, track all approvals
    return metadata?.secondaryApproval === true;
  }

  /**
   * Record secondary approval for four-eyes requirement
   */
  async recordSecondaryApproval(
    paymentIntentId: string,
    adminId: string,
    adminEmail: string,
  ): Promise<void> {
    await this.prisma.paymentVerification.update({
      where: { paymentIntentId },
      data: {
        metadata: {
          secondaryApproval: true,
          secondaryApprovedBy: adminId,
          secondaryApprovedByEmail: adminEmail,
          secondaryApprovedAt: new Date().toISOString(),
        },
      },
    });

    this.logger.log(`[FourEyes] Secondary approval recorded for payment ${paymentIntentId} by ${adminEmail}`);
  }

  /**
   * Validate admin action against role permissions
   */
  async validateAdminAction(
    adminId: string,
    action: 'APPROVE' | 'REJECT' | 'ESCALATE' | 'SETTLE',
  ): Promise<boolean> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
    });

    if (!admin || !admin.isActive) {
      return false;
    }

    // Role-based action permissions
    const rolePermissions: Record<AdminRole, string[]> = {
      [AdminRole.SUPER_ADMIN]: ['APPROVE', 'REJECT', 'ESCALATE', 'SETTLE'],
      [AdminRole.OPERATIONS_ADMIN]: ['APPROVE', 'REJECT', 'ESCALATE'],
      [AdminRole.FINANCE_ADMIN]: ['APPROVE', 'REJECT', 'SETTLE'],
      [AdminRole.RISK_OPERATOR]: ['ESCALATE'],
      [AdminRole.MERCHANT_MANAGER]: ['APPROVE', 'REJECT'],
      [AdminRole.SUPPORT_AGENT]: [],
    };

    const allowedActions = rolePermissions[admin.role] || [];
    return allowedActions.includes(action);
  }
}
