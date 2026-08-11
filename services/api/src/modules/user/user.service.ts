import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Prisma } from '@prisma/client';
import { UserState, AuditEventType } from '../../common/interfaces/user-state.enum';

export interface CreateUserData {
  telegramUserId: bigint;
  telegramUsername?: string;
  firstName: string;
  lastName?: string;
  photoUrl?: string;
  languageCode?: string;
}

export interface UpdateUserData {
  telegramUsername?: string;
  firstName?: string;
  lastName?: string;
  photoUrl?: string;
  languageCode?: string;
}

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findByTelegramUserId(telegramUserId: bigint) {
    return this.prisma.user.findUnique({
      where: { telegramUserId },
      include: {
        financialAccount: true,
        miningState: true,
        userPreferences: true,
        onboardingProgress: true,
      },
    });
  }

  async getProfile(telegramUserId: bigint) {
    const user = await this.findByTelegramUserId(telegramUserId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateProfile(telegramUserId: bigint, dto: UpdateUserData) {
    return this.updateUser(telegramUserId, dto);
  }

  async getTrustProfile(telegramUserId: bigint) {
    return this.prisma.userTrustProfile.findUnique({
      where: { telegramUserId },
    });
  }

  async createUser(data: CreateUserData) {
    const existing = await this.prisma.user.findUnique({
      where: { telegramUserId: data.telegramUserId },
    });

    if (existing) {
      throw new ConflictException('User already exists');
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.create({
        data: {
          telegramUserId: data.telegramUserId,
          telegramUsername: data.telegramUsername,
          firstName: data.firstName,
          lastName: data.lastName,
          photoUrl: data.photoUrl,
          languageCode: data.languageCode || 'en',
          state: UserState.NEW as any,
        },
      });

      await this.auditService.createWithClient(tx, {
        telegramUserId: user.telegramUserId,
        eventType: AuditEventType.USER_CREATED,
        description: 'User registered via Telegram',
        metadata: {
          telegramUsername: data.telegramUsername,
          languageCode: data.languageCode,
        },
      });

      return user;
    });
  }

  async updateUser(telegramUserId: bigint, data: UpdateUserData) {
    const user = await this.findByTelegramUserId(telegramUserId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.user.update({
        where: { telegramUserId },
        data: {
          ...(data.telegramUsername !== undefined && { telegramUsername: data.telegramUsername }),
          ...(data.firstName !== undefined && { firstName: data.firstName }),
          ...(data.lastName !== undefined && { lastName: data.lastName }),
          ...(data.photoUrl !== undefined && { photoUrl: data.photoUrl }),
          ...(data.languageCode !== undefined && { languageCode: data.languageCode }),
        },
      });

      await this.auditService.createWithClient(tx, {
        telegramUserId: updated.telegramUserId,
        eventType: AuditEventType.USER_UPDATED,
        description: 'User profile updated',
        metadata: data as Record<string, unknown>,
      });

      return updated;
    });
  }

  async updateState(telegramUserId: bigint, state: UserState, metadata?: Record<string, unknown>) {
    const user = await this.findByTelegramUserId(telegramUserId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const previousState = user.state;

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.user.update({
        where: { telegramUserId },
        data: { state: state as any },
      });

      await tx.userStateTransition.create({
        data: {
          telegramUserId,
          fromState: previousState,
          toState: state as any,
          reason: (metadata?.reason as string) || 'State transition requested',
          metadata: metadata ? (metadata as any) : undefined,
        },
      });

      await this.auditService.createWithClient(tx, {
        telegramUserId: updated.telegramUserId,
        eventType: AuditEventType.USER_STATE_CHANGED,
        description: `User state changed from ${previousState} to ${state}`,
        metadata: { previousState, newState: state, ...metadata },
      });

      return updated;
    });
  }

  async recordLogin(telegramUserId: bigint, ip?: string) {
    const user = await this.findByTelegramUserId(telegramUserId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { telegramUserId },
      data: {
        loginCount: { increment: 1 },
        lastLoginAt: new Date(),
        lastActiveAt: new Date(),
        ...(ip && { lastActiveIp: ip }),
      },
    });
  }

  async deleteAccount(telegramUserId: bigint) {
    const user = await this.findByTelegramUserId(telegramUserId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Delete MachineOutput records (child of UserMachine)
      const userMachines = await tx.userMachine.findMany({
        where: { telegramUserId },
        select: { id: true },
      });
      if (userMachines.length > 0) {
        const machineIds = userMachines.map((m: { id: string }) => m.id);
        await tx.machineOutput.deleteMany({
          where: { userMachineId: { in: machineIds } },
        });
      }

      // 2. Delete SettlementNote & SettlementEvent records (child of SettlementSession)
      const settlementSessions = await tx.settlementSession.findMany({
        where: { telegramUserId },
        select: { id: true },
      });
      if (settlementSessions.length > 0) {
        const sessionIds = settlementSessions.map((s: { id: string }) => s.id);
        await tx.settlementNote.deleteMany({
          where: { settlementId: { in: sessionIds } },
        });
        await tx.settlementEvent.deleteMany({
          where: { settlementId: { in: sessionIds } },
        });
      }

      // 3. Delete FinancialWorkflowStep records (child of FinancialOperation)
      const ops = await tx.financialOperation.findMany({
        where: { telegramUserId },
        select: { id: true },
      });
      if (ops.length > 0) {
        const opIds = ops.map((op: { id: string }) => op.id);
        await tx.financialWorkflowStep.deleteMany({
          where: { operationId: { in: opIds } },
        });
      }

      // 4. Delete RiskEvent records for user
      await tx.riskEvent.deleteMany({
        where: { entityType: 'USER', entityId: telegramUserId.toString() },
      });

      // 5. Delete financial operations & idempotency records & domain events
      await tx.financialOperation.deleteMany({ where: { telegramUserId } });
      await tx.financialIdempotencyRecord.deleteMany({ where: { telegramUserId } });
      await tx.financialDomainEvent.deleteMany({ where: { telegramUserId } });

      // 6. Delete settlement sessions
      await tx.settlementSession.deleteMany({ where: { telegramUserId } });

      // 7. Delete financial account and transactions/ledger entries
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

      // 8. Delete AssetBalances & UserAssetLicenses
      await tx.assetBalance.deleteMany({ where: { telegramUserId } });
      await tx.userAssetLicense.deleteMany({ where: { telegramUserId } });

      // 9. Delete mining state, fleet items, machines
      await tx.userMiningState.deleteMany({ where: { telegramUserId } });
      await tx.userMachineFleetItem.deleteMany({ where: { telegramUserId } });
      await tx.userMachine.deleteMany({ where: { telegramUserId } });

      // 10. Delete crystal account & transactions
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

      // 11. Delete game data
      await tx.gameSession.deleteMany({ where: { telegramUserId } });
      await tx.gamePlayerStat.deleteMany({ where: { telegramUserId } });
      await tx.gameRewardGrant.deleteMany({ where: { telegramUserId } });
      await tx.gameChallengeCompletion.deleteMany({ where: { telegramUserId } });
      await tx.gameProfile.deleteMany({ where: { telegramUserId } });

      // 12. Delete achievements & user achievements
      await tx.userAchievement.deleteMany({ where: { telegramUserId } });
      await tx.achievement.deleteMany({ where: { telegramUserId } });

      // 13. Delete product subscriptions & payment invoices
      await tx.productSubscription.deleteMany({ where: { telegramUserId } });
      await tx.paymentInvoice.deleteMany({ where: { telegramUserId } });
      await tx.channelVerificationEvent.deleteMany({ where: { telegramUserId } });

      // 14. Delete referral relationships, referral events, and referral rewards
      const refRels = await tx.referralRelationship.findMany({
        where: { OR: [{ referrerId: telegramUserId }, { refereeId: telegramUserId }] },
        select: { id: true },
      });
      if (refRels.length > 0) {
        const relIds = refRels.map((r: { id: string }) => r.id);
        await tx.referralEvent.deleteMany({
          where: { relationshipId: { in: relIds } },
        });
        await tx.referralReward.deleteMany({
          where: { relationshipId: { in: relIds } },
        });
      }
      await tx.referralReward.deleteMany({
        where: { reward: { telegramUserId } },
      });

      await tx.referralRelationship.deleteMany({ where: { referrerId: telegramUserId } });
      await tx.referralRelationship.deleteMany({ where: { refereeId: telegramUserId } });
      await tx.referralCode.deleteMany({ where: { telegramUserId } });
      await tx.referralQualificationHistory.deleteMany({ where: { telegramUserId } });

      // 15. Delete growth data & rewards
      await tx.reward.deleteMany({ where: { telegramUserId } });
      await tx.growthEvent.deleteMany({ where: { telegramUserId } });

      // 16. Delete notification records & preferences
      await tx.notificationRecord.deleteMany({ where: { telegramUserId } });
      await tx.notificationPreference.deleteMany({ where: { telegramUserId } });

      // 17. Delete user benefits & benefit history
      await tx.userBenefit.deleteMany({ where: { telegramUserId } });
      await tx.benefitHistory.deleteMany({ where: { telegramUserId } });

      // 18. Delete user level record
      await tx.userLevelRecord.deleteMany({ where: { telegramUserId } });

      // 19. Delete trust profile & events via profileId
      const trustProfiles = await tx.userTrustProfile.findMany({
        where: { telegramUserId },
        select: { id: true },
      });
      if (trustProfiles.length > 0) {
        const profileIds = trustProfiles.map((p: { id: string }) => p.id);
        await tx.trustEvent.deleteMany({
          where: { profileId: { in: profileIds } },
        });
      }
      await tx.userTrustProfile.deleteMany({ where: { telegramUserId } });

      // 20. Delete user preferences & consents & onboarding
      await tx.userPreferences.deleteMany({ where: { telegramUserId } });
      await tx.onboardingProgress.deleteMany({ where: { telegramUserId } });
      await tx.educationCompletion.deleteMany({ where: { telegramUserId } });
      await tx.userConsent.deleteMany({ where: { telegramUserId } });
      await tx.readinessScore.deleteMany({ where: { telegramUserId } });
      await tx.readinessHistory.deleteMany({ where: { telegramUserId } });
      await tx.userStateTransition.deleteMany({ where: { telegramUserId } });

      // 21. Delete admin notes
      await tx.adminNote.deleteMany({ where: { telegramUserId } });

      // 22. Create audit event for account deletion inside the transaction BEFORE deleting user
      try {
        await this.auditService.createWithClient(tx, {
          telegramUserId,
          eventType: AuditEventType.ACCOUNT_DELETED,
          description: 'User account completely deleted',
          metadata: { deletedAt: new Date().toISOString() },
        });
      } catch (err) {
        // Ignore audit log error if any
      }

      // 23. Finally delete the user record
      await tx.user.delete({
        where: { telegramUserId },
      });

      return { success: true, message: 'Account deleted successfully' };
    });
  }
}