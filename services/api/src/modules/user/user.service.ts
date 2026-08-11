import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditEventType } from '../../common/interfaces/user-state.enum';
import { AuditService } from '../audit/audit.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getProfile(telegramUserId: bigint) {
    const user = await this.prisma.user.findUnique({
      where: { telegramUserId },
      include: {
        onboardingProgress: true,
        educationCompletions: {
          include: { module: true },
        },
        userConsents: {
          where: { isActive: true },
        },
        readinessScores: true,
      },
    });

    if (!user) throw new NotFoundException('USER_NOT_FOUND');

    return {
      telegramUserId: Number(user.telegramUserId),
      telegramUsername: user.telegramUsername,
      firstName: user.firstName,
      lastName: user.lastName,
      photoUrl: user.photoUrl,
      languageCode: user.languageCode,
      state: user.state,
      loginCount: user.loginCount,
      lastActiveAt: user.lastActiveAt,
      createdAt: user.createdAt,
      educationScore: user.educationScore,
      readinessScore: user.readinessScore,
      isReady: user.isReady,
      onboardingProgress: user.onboardingProgress,
      educationProgress: user.educationCompletions.map((ec) => ({
        moduleId: ec.moduleId,
        moduleTitle: ec.module.title,
        status: ec.status,
        score: ec.score,
        passed: ec.passed,
        completedAt: ec.completedAt,
      })),
      consents: user.userConsents.map((c) => ({
        type: c.consentType,
        version: c.version,
        createdAt: c.createdAt,
      })),
      readiness: user.readinessScores,
    };
  }

  async updateProfile(telegramUserId: bigint, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { telegramUserId },
    });
    if (!user) throw new NotFoundException('USER_NOT_FOUND');

    const updated = await this.prisma.user.update({
      where: { telegramUserId },
      data: {
        ...(dto.firstName && { firstName: dto.firstName }),
        ...(dto.lastName && { lastName: dto.lastName }),
        ...(dto.languageCode && { languageCode: dto.languageCode }),
        ...(dto.photoUrl && { photoUrl: dto.photoUrl }),
      },
    });

    await this.auditService.create({
      telegramUserId,
      eventType: AuditEventType.USER_UPDATED,
      description: 'User profile updated',
      metadata: dto,
    });

    return this.sanitize(updated);
  }

  async getTrustProfile(telegramUserId: bigint) {
    const user = await this.prisma.user.findUnique({
      where: { telegramUserId },
      include: {
        educationCompletions: true,
        financialAccount: true,
      },
    });

    if (!user) throw new NotFoundException('USER_NOT_FOUND');

    // Real Trust Score calculation based on user state & platform activity
    let trustScore = 20; // baseline
    if (['READY', 'READY_FOR_PLATFORM', 'ELIGIBLE_USER', 'ACTIVE_USER'].includes(user.state)) {
      trustScore += 40;
    }
    trustScore += Math.min(20, (user.educationScore || 0) / 5);
    trustScore += Math.min(20, user.loginCount * 2);
    trustScore = Math.min(100, Math.max(0, trustScore));

    let reputationRank: 'Builder' | 'Guardian' | 'Architect' | 'Grandmaster' = 'Builder';
    if (trustScore >= 90) reputationRank = 'Grandmaster';
    else if (trustScore >= 75) reputationRank = 'Architect';
    else if (trustScore >= 50) reputationRank = 'Guardian';

    return {
      telegramUserId: Number(user.telegramUserId),
      trustScore,
      reputationRank,
      loginCount: user.loginCount,
      educationScore: user.educationScore,
      isReady: user.isReady,
      operatorAccess: trustScore >= 50 ? 'Unlocked' : 'Locked',
      createdAt: user.createdAt,
    };
  }

  private sanitize(user: any) {
    return {
      telegramUserId: Number(user.telegramUserId),
      telegramUsername: user.telegramUsername,
      firstName: user.firstName,
      lastName: user.lastName,
      photoUrl: user.photoUrl,
      languageCode: user.languageCode,
      state: user.state,
    };
  }

  async deleteAccount(telegramUserId: bigint) {
    // Use a transaction to ensure all deletions happen atomically
    return this.prisma.$transaction(async (tx) => {
      // 1. Delete MachineOutput records (child of UserMachine)
      const userMachines = await tx.userMachine.findMany({
        where: { telegramUserId },
        select: { id: true },
      });
      if (userMachines.length > 0) {
        const machineIds = userMachines.map((m) => m.id);
        await tx.machineOutput.deleteMany({
          where: { userMachineId: { in: machineIds } },
        });
      }

      // 2. Delete SettlementEvent records (child of SettlementSession)
      const settlementSessions = await tx.settlementSession.findMany({
        where: { telegramUserId },
        select: { id: true },
      });
      if (settlementSessions.length > 0) {
        const sessionIds = settlementSessions.map((s) => s.id);
        await tx.settlementEvent.deleteMany({
          where: { settlementId: { in: sessionIds } },
        });
      }

      // 3. Delete financial operations & idempotency records & domain events
      await tx.financialOperation.deleteMany({ where: { telegramUserId } });
      await tx.financialIdempotencyRecord.deleteMany({ where: { telegramUserId } });
      await tx.financialDomainEvent.deleteMany({ where: { telegramUserId } });

      // 4. Delete settlement sessions
      await tx.settlementSession.deleteMany({ where: { telegramUserId } });

      // 5. Delete financial account and transactions/ledger entries
      const financialAccount = await tx.financialAccount.findUnique({
        where: { telegramUserId },
      });
      if (financialAccount) {
        await tx.financialTransaction.deleteMany({
          where: { financialAccountId: financialAccount.id },
        });
        await tx.ledgerEntry.deleteMany({
          where: { financialAccountId: financialAccount.id },
        });
        await tx.financialAccount.delete({
          where: { telegramUserId },
        });
      }

      // 6. Delete AssetBalances & UserAssetLicenses
      await tx.assetBalance.deleteMany({ where: { telegramUserId } });
      await tx.userAssetLicense.deleteMany({ where: { telegramUserId } });

      // 7. Delete mining state, fleet items, machines
      await tx.userMiningState.deleteMany({ where: { telegramUserId } });
      await tx.userMachineFleetItem.deleteMany({ where: { telegramUserId } });
      await tx.userMachine.deleteMany({ where: { telegramUserId } });

      // 8. Delete crystal account & transactions
      const crystalAccount = await tx.crystalAccount.findUnique({
        where: { telegramUserId },
      });
      if (crystalAccount) {
        await tx.crystalTransaction.deleteMany({
          where: { accountId: crystalAccount.id },
        });
        await tx.crystalAccount.delete({
          where: { telegramUserId },
        });
      }
      await tx.crystalTransaction.deleteMany({ where: { telegramUserId } });

      // 9. Delete game data
      await tx.gameSession.deleteMany({ where: { telegramUserId } });
      await tx.gamePlayerStat.deleteMany({ where: { telegramUserId } });
      await tx.gameRewardGrant.deleteMany({ where: { telegramUserId } });
      await tx.gameChallengeCompletion.deleteMany({ where: { telegramUserId } });
      await tx.gameProfile.deleteMany({ where: { telegramUserId } });

      // 10. Delete achievements & user achievements
      await tx.achievement.deleteMany({ where: { telegramUserId } });
      await tx.userAchievement.deleteMany({ where: { telegramUserId } });

      // 11. Delete product subscriptions & payment invoices
      await tx.productSubscription.deleteMany({ where: { telegramUserId } });
      await tx.paymentInvoice.deleteMany({ where: { telegramUserId } });
      await tx.channelVerificationEvent.deleteMany({ where: { telegramUserId } });

      // 12. Delete referral relationships (both as referrer and referee)
      await tx.referralRelationship.deleteMany({ where: { referrerId: telegramUserId } });
      await tx.referralRelationship.deleteMany({ where: { refereeId: telegramUserId } });
      await tx.referralCode.deleteMany({ where: { telegramUserId } });
      await tx.referralQualificationHistory.deleteMany({ where: { telegramUserId } });

      // 13. Delete growth data & rewards
      await tx.reward.deleteMany({ where: { telegramUserId } });
      await tx.growthEvent.deleteMany({ where: { telegramUserId } });

      // 14. Delete notification records & preferences
      await tx.notificationRecord.deleteMany({ where: { telegramUserId } });
      await tx.notificationPreference.deleteMany({ where: { telegramUserId } });

      // 15. Delete user benefits & benefit history
      await tx.userBenefit.deleteMany({ where: { telegramUserId } });
      await tx.benefitHistory.deleteMany({ where: { telegramUserId } });

      // 16. Delete user level record
      await tx.userLevelRecord.deleteMany({ where: { telegramUserId } });

      // 17. Delete trust profile & events
      await tx.trustEvent.deleteMany({ where: { telegramUserId } });
      await tx.userTrustProfile.deleteMany({ where: { telegramUserId } });

      // 18. Delete user preferences & consents & onboarding
      await tx.userPreferences.deleteMany({ where: { telegramUserId } });
      await tx.onboardingProgress.deleteMany({ where: { telegramUserId } });
      await tx.educationCompletion.deleteMany({ where: { telegramUserId } });
      await tx.userConsent.deleteMany({ where: { telegramUserId } });
      await tx.readinessScore.deleteMany({ where: { telegramUserId } });
      await tx.readinessHistory.deleteMany({ where: { telegramUserId } });
      await tx.userStateTransition.deleteMany({ where: { telegramUserId } });

      // 19. Delete admin notes
      await tx.adminNote.deleteMany({ where: { telegramUserId } });

      // 20. Finally delete the user record
      await tx.user.delete({
        where: { telegramUserId },
      });

      // 21. Create audit event for account deletion
      await this.auditService.create({
        telegramUserId,
        eventType: AuditEventType.ACCOUNT_DELETED,
        description: 'User account completely deleted',
        metadata: { deletedAt: new Date().toISOString() },
      });

      return { success: true, message: 'Account deleted successfully' };
    });
  }
}