import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Prisma } from '@prisma/client';
import { UserState, AuditEventType, TransactionMethod } from '../../common/interfaces/user-state.enum';
import { UpdateAccountSetupDto } from './dto/account-setup.dto';

// ─── Account Setup (personalized onboarding) validation ─────────────────────
// Server-side authoritative validation. Frontend validation is UX only.

const PERSON_NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} .'\-]*$/u;
const TRANSACTION_NUMBER_RE = /^\+?[0-9]{8,15}$/;

export function normalizePersonName(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
}

export function isValidPersonName(raw: unknown): boolean {
  const value = normalizePersonName(raw);
  return value.length >= 1 && value.length <= 60 && PERSON_NAME_RE.test(value);
}

export function normalizeTransactionNumber(raw: unknown): string {
  // Canonical normalization, identical to updateWithdrawalPhoneNumber:
  // trim + strip all whitespace. No reformatting of legacy local formats.
  return typeof raw === 'string' ? raw.trim().replace(/\s+/g, '') : '';
}

export function isValidTransactionNumber(raw: unknown): boolean {
  return TRANSACTION_NUMBER_RE.test(normalizeTransactionNumber(raw));
}

export interface AccountSetupState {
  firstName: string | null;
  lastName: string | null;
  withdrawalPhoneNumber: string | null;
  preferredTransactionMethod: TransactionMethod | null;
  completed: boolean;
}

export function isAccountSetupComplete(state: {
  firstName: unknown;
  lastName: unknown;
  withdrawalPhoneNumber: unknown;
  preferredTransactionMethod: unknown;
}): boolean {
  const method = state.preferredTransactionMethod;
  const methodValid = method === TransactionMethod.MOBILE_MONEY || method === TransactionMethod.CRYPTO;
  if (!methodValid) return false;
  if (!isValidPersonName(state.firstName) || !isValidPersonName(state.lastName)) return false;
  if (method === TransactionMethod.CRYPTO) return true;
  return isValidTransactionNumber(state.withdrawalPhoneNumber);
}

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
  displayName?: string;
  lastName?: string;
  phoneNumber?: string;
  connectedWhatsApp?: string;
  photoUrl?: string;
  languageCode?: string;
}

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        financialAccount: true,
        miningState: true,
        userPreferences: true,
        onboardingProgress: true,
      },
    });
  }

  async findByIdentityId(identityId: string) {
    return this.prisma.user.findFirst({
      where: { identityId },
      include: {
        financialAccount: true,
        miningState: true,
        userPreferences: true,
        onboardingProgress: true,
      },
    });
  }

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

  async getProfile(userKey: string | bigint) {
    let user: any = null;

    if (typeof userKey === 'string') {
      const trimmed = userKey.trim();
      if (/^\d+$/.test(trimmed)) {
        user = await this.findByTelegramUserId(BigInt(trimmed));
      } else {
        user = (await this.findById(trimmed)) || (await this.findByIdentityId(trimmed));
      }
    } else if (typeof userKey === 'bigint') {
      user = await this.findByTelegramUserId(userKey);
    }

    if (!user) {
      throw new NotFoundException('USER_NOT_FOUND');
    }

    return user;
  }

  async updateProfile(userKey: string | bigint, dto: UpdateUserData) {
    const user = await this.getProfile(userKey);
    const updateData: any = {};
    const chosenName = (dto.displayName || dto.firstName || '').trim();
    if (chosenName) {
      updateData.firstName = chosenName;
    }
    if (dto.lastName) updateData.lastName = dto.lastName.trim();
    if (dto.photoUrl) updateData.photoUrl = dto.photoUrl;
    if (dto.languageCode) updateData.languageCode = dto.languageCode;
    if (dto.phoneNumber || dto.connectedWhatsApp) {
      updateData.phoneNumber = (dto.phoneNumber || dto.connectedWhatsApp)!.trim();
    }
    if (dto.telegramUsername) updateData.telegramUsername = dto.telegramUsername.trim();

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    return updated;
  }

  async getTrustProfile(userKey: string | bigint) {
    const user = await this.getProfile(userKey);
    if (!user.telegramUserId) {
      throw new NotFoundException('TRUST_PROFILE_NOT_FOUND');
    }

    const trust = await this.prisma.userTrustProfile.findFirst({
      where: { telegramUserId: user.telegramUserId },
    });
    if (!trust) {
      throw new NotFoundException('TRUST_PROFILE_NOT_FOUND');
    }
    return trust;
  }

  async createUser(data: CreateUserData) {
    const existing = await this.prisma.user.findUnique({
      where: { telegramUserId: data.telegramUserId },
    });

    if (existing) {
      throw new ConflictException('User already exists');
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const identity = await tx.universalIdentity.create({
        data: {
          displayName: data.firstName ? `${data.firstName} ${data.lastName || ''}`.trim() : `User_${data.telegramUserId}`,
          avatarUrl: data.photoUrl,
        },
      });

      const user = await tx.user.create({
        data: {
          id: identity.id,
          identityId: identity.id,
          telegramUserId: data.telegramUserId,
          telegramUsername: data.telegramUsername,
          firstName: data.firstName,
          lastName: data.lastName,
          photoUrl: data.photoUrl,
          languageCode: data.languageCode || 'en',
          state: UserState.NEW as any,
        },
      });

      await tx.channelIdentity.create({
        data: {
          identityId: identity.id,
          provider: 'TELEGRAM',
          identifier: String(data.telegramUserId),
          telegramId: String(data.telegramUserId),
          verified: true,
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

  async deleteAccount(userKey: string | bigint) {
    const user = await this.getProfile(userKey);
    const telegramUserId = user.telegramUserId || BigInt(0);

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

  private serializeUser(user: any) {
    if (!user) return user;
    return {
      ...user,
      telegramUserId: user.telegramUserId ? user.telegramUserId.toString() : null,
    };
  }

  async updateVerifiedPhoneNumber(userIdOrTelegramId: string | bigint, rawPhone: string) {
    const cleaned = (rawPhone || '').trim();
    if (!cleaned || cleaned.length < 8) {
      throw new ConflictException('INVALID_PHONE_NUMBER');
    }
    const coolingUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const where: any = typeof userIdOrTelegramId === 'bigint' || (typeof userIdOrTelegramId === 'string' && /^\d+$/.test(userIdOrTelegramId))
      ? { telegramUserId: BigInt(userIdOrTelegramId) }
      : { id: userIdOrTelegramId as string };

    const user = await this.prisma.user.update({
      where,
      data: {
        phoneNumber: cleaned,
        phoneVerified: true,
        phoneVerifiedAt: new Date(),
        recipientCoolingUntil: coolingUntil,
      },
    });

    try {
      await this.auditService.create({
        telegramUserId: user.telegramUserId,
        eventType: AuditEventType.USER_UPDATED,
        description: 'Verified phone number updated (Cooling period activated)',
        metadata: { phoneNumber: cleaned, recipientCoolingUntil: coolingUntil.toISOString() },
      });
    } catch {
      // ignore
    }

    return this.serializeUser(user);
  }

  async updateVerifiedUsdtAddress(userIdOrTelegramId: string | bigint, address: string) {
    const cleaned = (address || '').trim();
    if (!cleaned || cleaned.length < 10) {
      throw new ConflictException('INVALID_USDT_ADDRESS');
    }
    const coolingUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const where: any = typeof userIdOrTelegramId === 'bigint' || (typeof userIdOrTelegramId === 'string' && /^\d+$/.test(userIdOrTelegramId))
      ? { telegramUserId: BigInt(userIdOrTelegramId) }
      : { id: userIdOrTelegramId as string };

    const user = await this.prisma.user.update({
      where,
      data: {
        verifiedUsdtAddress: cleaned,
        usdtAddressVerified: true,
        usdtAddressVerifiedAt: new Date(),
        recipientCoolingUntil: coolingUntil,
      },
    });

    try {
      await this.auditService.create({
        telegramUserId: user.telegramUserId,
        eventType: AuditEventType.USER_UPDATED,
        description: 'Verified USDT address updated (Cooling period activated)',
        metadata: { verifiedUsdtAddress: cleaned, recipientCoolingUntil: coolingUntil.toISOString() },
      });
    } catch {
      // ignore
    }

    return this.serializeUser(user);
  }

  // ─── Account Setup (personalized onboarding) ──────────────────────────────
  // Backend-authoritative personalization attached to the already authenticated
  // canonical User. These paths NEVER create users, identities, or financial
  // records: getProfile() throws USER_NOT_FOUND (fail safely, no fallbacks).

  private toAccountSetupState(user: any): AccountSetupState {
    // Minimal shape: only fields the setup UI consumes. Verified crypto
    // destinations stay out of this response (privacy minimization).
    const state = {
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      withdrawalPhoneNumber: user.withdrawalPhoneNumber ?? null,
      preferredTransactionMethod: (user.preferredTransactionMethod ?? null) as TransactionMethod | null,
      completed: false,
    };
    state.completed = isAccountSetupComplete(state);
    return state;
  }

  async getAccountSetup(userKey: string | bigint): Promise<AccountSetupState> {
    const user = await this.getProfile(userKey);
    return this.toAccountSetupState(user);
  }

  async updateAccountSetup(userKey: string | bigint, dto: UpdateAccountSetupDto): Promise<AccountSetupState> {
    const user = await this.getProfile(userKey);

    const firstName = normalizePersonName(dto.firstName);
    const lastName = normalizePersonName(dto.lastName);
    if (!isValidPersonName(firstName)) {
      throw new ConflictException('INVALID_FIRST_NAME');
    }
    if (!isValidPersonName(lastName)) {
      throw new ConflictException('INVALID_LAST_NAME');
    }

    const method = dto.preferredTransactionMethod as TransactionMethod;
    if (method !== TransactionMethod.MOBILE_MONEY && method !== TransactionMethod.CRYPTO) {
      throw new ConflictException('INVALID_TRANSACTION_METHOD');
    }

    // Mobile Money requires an explicit withdrawal number (user declaration,
    // not provider verification). Crypto ignores the field and preserves any
    // existing destination — onboarding must not force wallet configuration.
    let normalizedPhone: string | null = null;
    if (method === TransactionMethod.MOBILE_MONEY) {
      normalizedPhone = normalizeTransactionNumber(dto.withdrawalPhoneNumber);
      if (!isValidTransactionNumber(normalizedPhone)) {
        throw new ConflictException('INVALID_WITHDRAWAL_NUMBER');
      }
    }

    const wasComplete = isAccountSetupComplete({
      firstName: user.firstName,
      lastName: user.lastName,
      withdrawalPhoneNumber: user.withdrawalPhoneNumber,
      preferredTransactionMethod: user.preferredTransactionMethod,
    });

    const nameChanged = user.firstName !== firstName || (user.lastName ?? null) !== lastName;
    const methodChanged = (user.preferredTransactionMethod ?? null) !== method;
    const phoneChanged =
      method === TransactionMethod.MOBILE_MONEY &&
      (user.withdrawalPhoneNumber ?? null) !== normalizedPhone;

    // Single idempotent update of the canonical user. Repeated identical
    // submissions rewrite the same values; nothing else is created or reset.
    const data: any = {
      firstName,
      lastName,
      preferredTransactionMethod: method,
    };
    if (phoneChanged) {
      data.withdrawalPhoneNumber = normalizedPhone;
      data.withdrawalPhoneVerified = true;
      data.withdrawalPhoneVerifiedAt = new Date();
      data.recipientCoolingUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data,
    });

    // Audit field-level changes without logging PII values.
    try {
      if (nameChanged) {
        await this.auditService.create({
          telegramUserId: user.telegramUserId,
          eventType: AuditEventType.PROFILE_NAME_UPDATED,
          description: 'Account Setup: profile name updated',
        });
      }
      if (methodChanged) {
        await this.auditService.create({
          telegramUserId: user.telegramUserId,
          eventType: AuditEventType.TRANSACTION_METHOD_CHANGED,
          description: 'Account Setup: transaction method changed',
          metadata: { from: user.preferredTransactionMethod ?? null, to: method },
        });
      }
      if (phoneChanged) {
        await this.auditService.create({
          telegramUserId: user.telegramUserId,
          eventType: AuditEventType.WITHDRAWAL_PHONE_CHANGED,
          description: 'Account Setup: Mobile Money withdrawal number updated (24h cooling period activated)',
          metadata: { recipientCoolingUntil: data.recipientCoolingUntil.toISOString() },
        });
      }
      const nowComplete = isAccountSetupComplete({
        firstName: updated.firstName,
        lastName: updated.lastName,
        withdrawalPhoneNumber: updated.withdrawalPhoneNumber,
        preferredTransactionMethod: updated.preferredTransactionMethod,
      });
      if (nowComplete && !wasComplete) {
        await this.auditService.create({
          telegramUserId: user.telegramUserId,
          eventType: AuditEventType.ACCOUNT_SETUP_COMPLETED,
          description: 'Account Setup completed with valid canonical profile',
        });
      }
    } catch {
      // Audit failures must never fail the setup save.
    }

    return this.toAccountSetupState(updated);
  }

  async updateWithdrawalPhoneNumber(userIdOrTelegramId: string | bigint, rawPhone: string) {
    const cleaned = (rawPhone || '').trim().replace(/\s+/g, '');
    if (!cleaned || cleaned.length < 8) {
      throw new ConflictException('INVALID_PHONE_NUMBER');
    }
    const coolingUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const where: any = typeof userIdOrTelegramId === 'bigint' || (typeof userIdOrTelegramId === 'string' && /^\d+$/.test(userIdOrTelegramId))
      ? { telegramUserId: BigInt(userIdOrTelegramId) }
      : { id: userIdOrTelegramId as string };

    const user = await this.prisma.user.update({
      where,
      data: {
        withdrawalPhoneNumber: cleaned,
        withdrawalPhoneVerified: true,
        withdrawalPhoneVerifiedAt: new Date(),
        recipientCoolingUntil: coolingUntil,
      },
    });

    try {
      await this.auditService.create({
        telegramUserId: user.telegramUserId,
        eventType: AuditEventType.USER_UPDATED,
        description: 'Mobile Money Withdrawal Number updated (24h cooling period activated)',
        metadata: { withdrawalPhoneNumber: cleaned, recipientCoolingUntil: coolingUntil.toISOString() },
      });
    } catch {
      // ignore
    }

    return this.serializeUser(user);
  }
}