import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
  Optional,
  Inject,
} from '@nestjs/common';
import { IdentityProvider, UserState, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditEventType } from '../../common/interfaces/user-state.enum';
import {
  IdentityContext,
  ResolveByChannelDto,
  RegisterIdentityDto,
  AuthenticateIdentityDto,
  LinkChannelDto,
  UnlinkChannelDto,
} from './interfaces/identity-master.interface';

@Injectable()
export class IdentityMasterEngineService {
  private readonly logger = new Logger(IdentityMasterEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly auditService?: AuditService,
  ) {}

  /**
   * Deterministically normalizes channel identifiers (E.164 for WhatsApp/Phone, trimmed for Telegram).
   */
  normalizeIdentifier(provider: IdentityProvider, identifier: string): string {
    if (!identifier) return '';

    if (provider === IdentityProvider.WHATSAPP || provider === IdentityProvider.PHONE) {
      let cleaned = identifier.replace(/[\s\-\(\)]/g, '');
      if (cleaned.startsWith('0') && cleaned.length === 10) {
        cleaned = '+256' + cleaned.substring(1);
      } else if (cleaned.startsWith('256')) {
        cleaned = '+' + cleaned;
      } else if (!cleaned.startsWith('+') && /^\d+$/.test(cleaned)) {
        cleaned = '+' + cleaned;
      }
      return cleaned;
    }

    return identifier.trim();
  }

  // In-memory cache for identity resolution during DB unavailability (cache-only, no fallback creation)
  // Cache entries expire after 5 minutes to prevent serving stale data
  private inMemoryIdentities = new Map<string, { channelIdentity: any; identity: any; user: any; context: IdentityContext; expiresAt: number }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Resolves a ChannelIdentity, bound UniversalIdentity, and canonical Titan User.
   */
  async resolveByChannel(provider: IdentityProvider, rawIdentifier: string) {
    const identifier = this.normalizeIdentifier(provider, rawIdentifier);
    const key = `${provider}:${identifier}`;
    try {
      const channelIdentity = await this.prisma.channelIdentity.findUnique({
        where: {
          provider_identifier: {
            provider,
            identifier,
          },
        },
        include: {
          identity: {
            include: {
              user: {
                include: {
                  financialAccount: true,
                  userPreferences: true,
                },
              },
            },
          },
        },
      });

      if (!channelIdentity) return null;

      const identityObj = (channelIdentity as any).identity;
      const user = identityObj?.user || (identityObj?.users ? identityObj.users[0] : null);
      
      // Cache successfully resolved identity for DB unavailability scenarios
      const result = {
        channelIdentity,
        identity: (channelIdentity as any).identity,
        user,
      };
      
      this.inMemoryIdentities.set(key, {
        channelIdentity: result.channelIdentity,
        identity: result.identity,
        user: result.user,
        context: null as any, // Context not cached
        expiresAt: Date.now() + this.CACHE_TTL_MS,
      });
      
      return result;
    } catch (err: any) {
      // CRITICAL: Never use fallback identity resolution - fail instead
      // This prevents catastrophic trust failures where returning users appear as "new users"
      const errorMsg = `Database unreachable during identity resolution for ${provider}:${identifier}. Authentication failed to prevent account duplication.`;
      this.logger.error(`[IDENTITY_ENGINE] ${errorMsg} Original error: ${err.message}`);
      
      // Check in-memory cache for existing resolved identities (acceptable cache hit)
      const mem = this.inMemoryIdentities.get(key);
      if (mem && mem.expiresAt > Date.now()) {
        this.logger.log(`[IDENTITY_ENGINE] Cache hit for ${provider}:${identifier} during DB unavailability`);
        return { channelIdentity: mem.channelIdentity, identity: mem.identity, user: mem.user };
      } else if (mem) {
        // Cache entry expired, remove it
        this.logger.log(`[IDENTITY_ENGINE] Cache entry expired for ${provider}:${identifier}, removing`);
        this.inMemoryIdentities.delete(key);
      }

      // If not in cache, fail authentication rather than creating fallback
      return null;
    }
  }

  /**
   * Race-safe, transactionally isolated registration of a new Titan Identity & User.
   */
  async register(dto: RegisterIdentityDto): Promise<IdentityContext> {
    const normalizedId = this.normalizeIdentifier(dto.provider, dto.identifier);
    const key = `${dto.provider}:${normalizedId}`;
    const existing = await this.resolveByChannel(dto.provider, normalizedId);
    if (existing && existing.user) {
      throw new ConflictException('IDENTITY_ALREADY_EXISTS');
    }

    try {
      return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // 1. Create UniversalIdentity (id = UUID)
        const identity = await tx.universalIdentity.create({
          data: {
            displayName: dto.displayName || dto.firstName || `${dto.provider}_${normalizedId}`,
            avatarUrl: dto.avatarUrl,
          },
        });

        const isTelegram = dto.provider === IdentityProvider.TELEGRAM;
        const isWhatsapp = dto.provider === IdentityProvider.WHATSAPP;
        const numericIdentifier = normalizedId.replace(/\D/g, '').slice(0, 15);
        // `telegram_user_id` is retained as the legacy numeric key used by
        // several financial tables. Keep WhatsApp identities in a separate
        // namespace so a phone number can never collide with a Telegram ID.
        // Existing WhatsApp identities are resolved by ChannelIdentity and
        // keep their original value; this only applies to new registrations.
        const telegramUserIdBig = isTelegram && /^\d+$/.test(normalizedId)
          ? BigInt(normalizedId)
          : isWhatsapp && numericIdentifier
            ? -BigInt(numericIdentifier)
            : BigInt(numericIdentifier || Date.now());

        // 2. Create User (id = identity.id to guarantee User.id === UniversalIdentity.id)
        const user = await tx.user.create({
          data: {
            id: identity.id,
            identityId: identity.id,
            telegramUserId: telegramUserIdBig,
            firstName: dto.firstName || dto.displayName || (isWhatsapp ? `WhatsApp User (${normalizedId.slice(-4)})` : `User_${normalizedId}`),
            lastName: dto.lastName,
            telegramUsername: dto.telegramUsername,
            phoneNumber: isWhatsapp || dto.phoneNumber ? (dto.phoneNumber || normalizedId) : undefined,
            phoneVerified: isWhatsapp || Boolean(dto.phoneVerified),
            phoneVerifiedAt: isWhatsapp ? new Date() : undefined,
            languageCode: dto.languageCode || 'en',
            photoUrl: dto.avatarUrl,
            state: UserState.READY,
            lastActiveAt: new Date(),
            lastLoginAt: new Date(),
            loginCount: 1,
          },
        });

        // 3. Create bound ChannelIdentity
        const channelIdentity = await tx.channelIdentity.create({
          data: {
            identityId: identity.id,
            provider: dto.provider,
            identifier: normalizedId,
            ...(isTelegram && normalizedId && { telegramId: normalizedId }),
            verified: true,
            metadata: dto.metadata || {},
          },
        });

        // 4. Initialize Domain Subsystems
        await tx.financialAccount.create({
          data: {
            userId: user.id,
            telegramUserId: user.telegramUserId,
            status: 'ACTIVE',
            activatedAt: new Date(),
          },
        });

        await tx.onboardingProgress.create({
          data: {
            telegramUserId: user.telegramUserId,
            currentStep: 'welcome',
            stepsCompleted: [],
          },
        });

        const refCodeStr = `TITAN_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        await tx.referralCode.create({
          data: {
            telegramUserId: user.telegramUserId,
            code: refCodeStr,
            metadata: { generatedAt: new Date().toISOString(), provider: dto.provider },
          },
        });

        await tx.userTrustProfile.create({
          data: {
            telegramUserId: user.telegramUserId,
            trustScore: 50,
            completedSettlements: 0,
            failedSettlements: 0,
            successRate: 100.0,
            accountAgeDays: 0,
            verificationStatus: 'UNVERIFIED',
          },
        });

        await tx.userLevelRecord.create({
          data: {
            telegramUserId: user.telegramUserId,
            currentLevel: 'NEW',
          },
        });

        await tx.notificationPreference.create({
          data: {
            telegramUserId: user.telegramUserId,
            telegramEnabled: isTelegram,
            inAppEnabled: true,
            marketingEnabled: false,
          },
        });

        if (this.auditService) {
          await this.auditService.createWithClient(tx, {
            telegramUserId: telegramUserIdBig || undefined,
            eventType: AuditEventType.USER_CREATED,
            description: `Identity created via ${dto.provider}:${normalizedId}`,
            metadata: { provider: dto.provider, identifier: normalizedId, userId: user.id },
          });
        }

        this.logger.log(`[IDENTITY_AUDIT] USER_CREATED: userId=${user.id}, identityId=${identity.id}, provider=${dto.provider}, identifier=${normalizedId}, telegramUserId=${telegramUserIdBig?.toString() || 'N/A'}`);

        return {
          userId: user.id,
          universalIdentityId: identity.id,
          channel: dto.provider,
          channelIdentityId: channelIdentity.id,
          providerSubject: normalizedId,
          assuranceLevel: (isTelegram || dto.provider === IdentityProvider.WHATSAPP ? 'MEDIUM' : 'LOW') as any,
          role: 'USER',
          userState: user.state,
          telegramUserId: telegramUserIdBig || undefined,
        };
      });
    } catch (err: any) {
      // Handle concurrent registration race condition
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        this.logger.warn(`[IDENTITY_AUDIT] REGISTRATION_RACE: provider=${dto.provider}, identifier=${normalizedId}, error=P2002 duplicate key`);
        const winner = await this.resolveByChannel(dto.provider, normalizedId);
        if (winner && winner.user) {
          this.logger.log(`[IDENTITY_AUDIT] RACE_RESOLVED: userId=${winner.user.id}, existingIdentity=${winner.identity.id}, provider=${dto.provider}, identifier=${normalizedId}`);
          return {
            userId: winner.user.id,
            universalIdentityId: winner.identity.id,
            channel: dto.provider,
            channelIdentityId: winner.channelIdentity.id,
            providerSubject: normalizedId,
            assuranceLevel: 'MEDIUM',
            role: 'USER',
            userState: winner.user.state,
            telegramUserId: winner.user.telegramUserId ? winner.user.telegramUserId : undefined,
          };
        }
      }

      // Re-throw known business logic exceptions
      if (err instanceof ConflictException || err.message?.startsWith('FAIL_AT_') || err.message?.includes('DATABASE_WRITE_ERROR')) {
        this.logger.error(`[IDENTITY_ENGINE] Registration failed for ${dto.provider}:${normalizedId}: ${err.message}`);
        throw err;
      }

      // CRITICAL: Never create fallback identities - fail authentication instead
      // This prevents catastrophic trust failures where returning users appear as "new users"
      const errorMsg = `Database unreachable during identity registration for ${dto.provider}:${normalizedId}. Authentication failed to prevent account duplication.`;
      this.logger.error(`[IDENTITY_ENGINE] ${errorMsg} Original error: ${err.message}`);
      
      throw new InternalServerErrorException(errorMsg);
    }
  }

  /**
   * Authenticates or registers a channel credential and returns a canonical IdentityContext.
   */
  async authenticate(dto: AuthenticateIdentityDto): Promise<IdentityContext> {
    const normalizedId = this.normalizeIdentifier(dto.provider, dto.identifier);
    const resolved = await this.resolveByChannel(dto.provider, normalizedId);

    if (!resolved || !resolved.user) {
      return this.register({
        provider: dto.provider,
        identifier: normalizedId,
        displayName: dto.displayName,
        avatarUrl: dto.avatarUrl,
        metadata: dto.metadata,
      });
    }

    const { user, identity, channelIdentity } = resolved;

    // Enforce Identity Lifecycle States (Gate 9)
    const BLOCKED_STATES: UserState[] = [UserState.SUSPENDED_USER, UserState.BANNED_USER, UserState.FROZEN, UserState.DELETED_USER];
    if (BLOCKED_STATES.includes(user.state)) {
      throw new UnauthorizedException({
        code: user.state === UserState.FROZEN ? 'ACCOUNT_FROZEN' : 'ACCOUNT_SUSPENDED',
        message: `Titan Identity ${user.id} access blocked due to account state: ${user.state}`,
      });
    }

    // Update login timestamp safely (resilient to DB connection status)
    try {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          lastActiveAt: new Date(),
          loginCount: { increment: 1 },
          ...(dto.ipAddress && { lastActiveIp: dto.ipAddress }),
        },
      });
    } catch (dbErr: any) {
      this.logger.warn(`[IDENTITY_DB_WARN] Could not update user login timestamp: ${dbErr.message}`);
    }

    return {
      userId: user.id,
      universalIdentityId: identity.id,
      channel: dto.provider,
      channelIdentityId: channelIdentity.id,
      providerSubject: dto.identifier,
      assuranceLevel: 'HIGH',
      role: 'USER',
      userState: user.state,
      telegramUserId: user.telegramUserId ? BigInt(user.telegramUserId) : undefined,
    };
  }

  /**
   * Binds an additional authentication channel (e.g. WhatsApp number) to an existing Titan User.
   */
  async linkChannel(dto: LinkChannelDto) {
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('USER_NOT_FOUND');

    const existingChannel = await this.prisma.channelIdentity.findUnique({
      where: {
        provider_identifier: {
          provider: dto.provider,
          identifier: dto.identifier,
        },
      },
    });

    if (existingChannel) {
      if (existingChannel.identityId === user.identityId) {
        return existingChannel; // Already linked to this user
      }
      // Security Enforcement: Do NOT silently merge accounts
      throw new ConflictException({
        code: 'CHANNEL_BOUND_TO_DIFFERENT_IDENTITY',
        message: `Channel ${dto.provider}:${dto.identifier} is already attached to another Titan account.`,
      });
    }

    return this.prisma.channelIdentity.create({
      data: {
        identityId: user.identityId!,
        provider: dto.provider,
        identifier: dto.identifier,
        phone: dto.phone,
        telegramId: dto.telegramId,
        verified: true,
        metadata: dto.metadata || {},
      },
    });
  }

  /**
   * Unlinks an authentication channel while enforcing that at least one verified channel remains.
   */
  async unlinkChannel(dto: UnlinkChannelDto) {
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user || !user.identityId) throw new NotFoundException('USER_NOT_FOUND');

    const channels = await this.prisma.channelIdentity.findMany({
      where: { identityId: user.identityId },
    });

    if (channels.length <= 1) {
      throw new BadRequestException({
        code: 'CANNOT_UNLINK_LAST_CHANNEL',
        message: 'At least one authentication channel must remain bound to the account.',
      });
    }

    const target = channels.find((c) => c.provider === dto.provider && c.identifier === dto.identifier);
    if (!target) throw new NotFoundException('CHANNEL_NOT_FOUND');

    return this.prisma.channelIdentity.delete({
      where: { id: target.id },
    });
  }

  /**
   * Reconciles duplicate identities by merging data from multiple User records
   * that may have been created by the old fallback system.
   */
  async reconcileDuplicateIdentities(provider: IdentityProvider, identifier: string): Promise<IdentityContext> {
    const normalizedId = this.normalizeIdentifier(provider, identifier);
    this.logger.log(`[IDENTITY_RECONCILIATION] Starting reconciliation for ${provider}:${normalizedId}`);
    
    // Find all potential duplicates by searching for users with matching telegramUserId or channel identities
    const potentialDuplicates = await this.prisma.user.findMany({
      where: {
        OR: [
          { telegramUserId: BigInt(normalizedId.replace(/\D/g, '')) },
          { identity: { channels: { some: { provider, identifier: normalizedId } } } },
        ],
      },
      include: {
        identity: {
          include: {
            channels: true,
          },
        },
        financialAccount: true,
        onboardingProgress: true,
        referralCode: true,
        userMachines: true,
        referralAsReferrer: true,
        qualificationHistory: true,
      },
    });

    if (potentialDuplicates.length === 0) {
      this.logger.log(`[IDENTITY_RECONCILIATION] No duplicates found for ${provider}:${normalizedId}`);
      throw new NotFoundException('No identities found to reconcile');
    }

    if (potentialDuplicates.length === 1) {
      const single = potentialDuplicates[0];
      this.logger.log(`[IDENTITY_RECONCILIATION] Single identity found, no reconciliation needed: userId=${single.id}`);
      return {
        userId: single.id,
        universalIdentityId: single.identityId,
        channel: provider,
        channelIdentityId: single.identity?.channels?.[0]?.id || single.id,
        providerSubject: normalizedId,
        assuranceLevel: 'HIGH',
        role: 'USER',
        userState: single.state,
        telegramUserId: single.telegramUserId,
      };
    }

    this.logger.warn(`[IDENTITY_RECONCILIATION] Found ${potentialDuplicates.length} potential duplicates for ${provider}:${normalizedId}`);

    // Robust canonical selection: score each candidate based on multiple factors
    const scoredCandidates = potentialDuplicates.map(user => {
      let score = 0;
      
      // Factor 1: userId === identityId (preferred structure) - +100 points
      if (user.id === user.identityId) {
        score += 100;
      }
      
      // Factor 2: Has financial account - +50 points
      if (user.financialAccount) {
        score += 50;
      }
      
      // Factor 3: Has referral code - +30 points
      if (user.referralCode) {
        score += 30;
      }
      
      // Factor 4: Recent activity (lastActiveAt within 30 days) - +20 points
      if (user.lastActiveAt) {
        const daysSinceActive = (Date.now() - new Date(user.lastActiveAt).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceActive <= 30) {
          score += 20;
        } else if (daysSinceActive <= 90) {
          score += 10;
        }
      }
      
      // Factor 5: Higher login count - +1 point per login (max 20)
      score += Math.min(user.loginCount, 20);
      
      // Factor 6: More qualified referrals - +5 per referral (max 50)
      score += Math.min(user.qualifiedReferrals * 5, 50);
      
      // Factor 7: More paying referrals - +10 per referral (max 100)
      score += Math.min(user.payingReferrals * 10, 100);
      
      return { user, score };
    });
    
    // Sort by score descending, select highest as canonical
    scoredCandidates.sort((a, b) => b.score - a.score);
    const canonical = scoredCandidates[0].user;
    const duplicates = potentialDuplicates.filter(u => u.id !== canonical.id);
    
    this.logger.log(`[IDENTITY_RECONCILIATION] Canonical selection: userId=${canonical.id}, score=${scoredCandidates[0].score}`);
    this.logger.log(`[IDENTITY_RECONCILIATION] All candidates: ${scoredCandidates.map(s => `${s.user.id}(${s.score})`).join(', ')}`);
    this.logger.log(`[IDENTITY_RECONCILIATION] Duplicates to merge: ${duplicates.map(u => u.id).join(', ')}`);

    // Merge data from duplicates into canonical identity
    try {
      await this.prisma.$transaction(async (tx) => {
        // CRITICAL: Financial merge using ledger reconciliation (not naive balance field)
        const financialAccounts = [canonical.financialAccount, ...duplicates.map(d => d.financialAccount).filter(Boolean)];
        
        if (financialAccounts.length > 0) {
          // Calculate actual balance from ledger entries for each account
          const accountBalances = await Promise.all(
            financialAccounts.map(async (fa) => {
              if (!fa) return { account: fa, ledgerBalance: 0 };
              
              const ledgerEntries = await tx.ledgerEntry.findMany({
                where: { financialAccountId: fa.id },
              });
              
              const ledgerBalance = ledgerEntries.reduce((sum, entry) => {
                const amount = Number(entry.amount);
                // Debit entries (negative amounts from debit accounts)
                // Credit entries (positive amounts from credit accounts)
                return sum + amount;
              }, 0);
              
              return { account: fa, ledgerBalance, ledgerEntryCount: ledgerEntries.length };
            })
          );
          
          // Select account with highest ledger balance (actual balance, not stale field)
          const richestAccount = accountBalances.reduce((max, acc) => 
            acc.ledgerBalance > max.ledgerBalance ? acc : max
          );
          
          if (!richestAccount.account) {
            this.logger.warn(`[IDENTITY_RECONCILIATION] No valid financial account found for migration`);
            return;
          }
          
          this.logger.log(`[IDENTITY_RECONCILIATION] Financial account selection by ledger balance: ${richestAccount.account.id} (ledgerBalance=${richestAccount.ledgerBalance}, entries=${richestAccount.ledgerEntryCount})`);
          
          // Merge ledger entries from all accounts into the selected account
          for (const acc of accountBalances) {
            if (!acc.account || acc.account.id === richestAccount.account.id) continue; // Skip the selected account
            
            // Reassign ledger entries to the selected financial account
            const entriesToMigrate = await tx.ledgerEntry.findMany({
              where: { financialAccountId: acc.account.id },
            });
            
            for (const entry of entriesToMigrate) {
              await tx.ledgerEntry.update({
                where: { id: entry.id },
                data: { financialAccountId: richestAccount.account.id },
              });
            }
            
            this.logger.log(`[IDENTITY_RECONCILIATION] Migrated ${entriesToMigrate.length} ledger entries from ${acc.account.id} to ${richestAccount.account.id}`);
          }
          
          // Reassign financial account to canonical user
          if (richestAccount.account.id !== canonical.financialAccount?.id) {
            this.logger.log(`[IDENTITY_RECONCILIATION] Reassigning financial account: ${richestAccount.account.id} -> canonical userId=${canonical.id}`);
            await tx.financialAccount.update({
              where: { id: richestAccount.account.id },
              data: { userId: canonical.id },
            });
          }
          
          // Create reconciliation audit entry
          const reconciliationReference = `IDENTITY_RECONCILIATION_${canonical.id}_${Date.now()}`;
          this.logger.log(`[IDENTITY_RECONCILIATION] Creating ledger reconciliation entry: ${reconciliationReference}`);
          // Note: Actual ledger entry creation would require proper ledger account and entry type configuration
          // This is logged for audit trail but not implemented to avoid breaking ledger constraints
        }

        // Merge referral codes (preserve the one with referrals)
        const referralCodes = [canonical.referralCode, ...duplicates.map(d => d.referralCode).filter(Boolean)];
        const activeReferralCode = referralCodes.find(rc => (rc as any)._count?.ReferralRelationship > 0) || canonical.referralCode;
        
        if (activeReferralCode && activeReferralCode.id !== canonical.referralCode?.id) {
          this.logger.log(`[IDENTITY_RECONCILIATION] Merging referral code: ${activeReferralCode.id} -> ${canonical.id}`);
          await tx.referralCode.update({
            where: { id: activeReferralCode.id },
            data: { telegramUserId: canonical.telegramUserId },
          });
        }

        // Merge referral relationships from duplicates into canonical
        for (const duplicate of duplicates) {
          if (duplicate.referralAsReferrer && duplicate.referralAsReferrer.length > 0) {
            this.logger.log(`[IDENTITY_RECONCILIATION] Merging ${duplicate.referralAsReferrer.length} referral relationships (as referrer) from ${duplicate.id} to ${canonical.id}`);
            for (const relationship of duplicate.referralAsReferrer) {
              await tx.referralRelationship.update({
                where: { id: relationship.id },
                data: { referrerId: canonical.telegramUserId },
              });
            }
          }
        }

        // Merge referral qualification history from duplicates into canonical
        for (const duplicate of duplicates) {
          if (duplicate.qualificationHistory && duplicate.qualificationHistory.length > 0) {
            this.logger.log(`[IDENTITY_RECONCILIATION] Merging ${duplicate.qualificationHistory.length} qualification history records from ${duplicate.id} to ${canonical.id}`);
            for (const history of duplicate.qualificationHistory) {
              await tx.referralQualificationHistory.update({
                where: { id: history.id },
                data: { telegramUserId: canonical.telegramUserId },
              });
            }
          }
        }

        // Merge machine ownership from duplicates into canonical
        for (const duplicate of duplicates) {
          if (duplicate.userMachines && duplicate.userMachines.length > 0) {
            this.logger.log(`[IDENTITY_RECONCILIATION] Merging ${duplicate.userMachines.length} machines from ${duplicate.id} to ${canonical.id}`);
            for (const machine of duplicate.userMachines) {
              await tx.userMachine.update({
                where: { id: machine.id },
                data: { telegramUserId: canonical.telegramUserId },
              });
            }
          }
        }

        // Mark duplicate users as DELETED_USER for audit trail
        for (const duplicate of duplicates) {
          this.logger.log(`[IDENTITY_RECONCILIATION] Marking duplicate as DELETED: userId=${duplicate.id}`);
          await tx.user.update({
            where: { id: duplicate.id },
            data: { 
              state: UserState.DELETED_USER,
              identityId: canonical.identityId, // Point to canonical identity
            },
          });
          
          // Update channel identities to point to canonical identity
          if (duplicate.identityId) {
            await tx.channelIdentity.updateMany({
              where: { identityId: duplicate.identityId },
              data: { identityId: canonical.identityId },
            });
          }
        }

        // Log reconciliation to audit trail
        if (this.auditService) {
          await this.auditService.createWithClient(tx, {
            telegramUserId: canonical.telegramUserId,
            eventType: AuditEventType.USER_STATE_CHANGED,
            description: `Identity reconciliation: ${duplicates.length} duplicates merged into canonical userId=${canonical.id}`,
            metadata: {
              canonicalUserId: canonical.id,
              canonicalIdentityId: canonical.identityId,
              duplicateUserIds: duplicates.map(d => d.id),
              provider,
              identifier: normalizedId,
              financialAccountsMerged: financialAccounts.length,
              ledgerEntriesMigrated: true,
            },
          });
        }
      });

      // Invalidate cache for all affected identities after successful reconciliation
      for (const duplicate of duplicates) {
        for (const channel of duplicate.identity?.channels || []) {
          const cacheKey = `${channel.provider}:${channel.identifier}`;
          this.inMemoryIdentities.delete(cacheKey);
          this.logger.log(`[IDENTITY_RECONCILIATION] Cache invalidated for ${cacheKey}`);
        }
      }
      // Also invalidate canonical's channels
      for (const channel of canonical.identity?.channels || []) {
        const cacheKey = `${channel.provider}:${channel.identifier}`;
        this.inMemoryIdentities.delete(cacheKey);
        this.logger.log(`[IDENTITY_RECONCILIATION] Cache invalidated for ${cacheKey}`);
      }

      this.logger.log(`[IDENTITY_RECONCILIATION] Successfully merged ${duplicates.length} duplicates into canonical userId=${canonical.id}`);
      
      return {
        userId: canonical.id,
        universalIdentityId: canonical.identityId,
        channel: provider,
        channelIdentityId: canonical.identity?.channels?.[0]?.id || canonical.id,
        providerSubject: normalizedId,
        assuranceLevel: 'HIGH',
        role: 'USER',
        userState: canonical.state,
        telegramUserId: canonical.telegramUserId,
      };
    } catch (err: any) {
      this.logger.error(`[IDENTITY_RECONCILIATION] Failed to merge duplicates: ${err.message}`);
      throw new InternalServerErrorException('Identity reconciliation failed');
    }
  }

  /**
   * Constructs the full canonical IdentityContext for a given User ID.
   */
  async getIdentityContext(userId: string): Promise<IdentityContext> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        identity: {
          include: {
            channels: true,
          },
        },
      },
    });

    if (!user || !user.identity) {
      throw new NotFoundException('IDENTITY_NOT_FOUND');
    }

    const primaryChannel = user.identity.channels[0];

    return {
      userId: user.id,
      universalIdentityId: user.identity.id,
      channel: primaryChannel?.provider || IdentityProvider.INTERNAL,
      channelIdentityId: primaryChannel?.id || user.id,
      providerSubject: primaryChannel?.identifier || user.id,
      assuranceLevel: 'HIGH',
      role: 'USER',
      userState: user.state,
      telegramUserId: user.telegramUserId ? BigInt(user.telegramUserId) : undefined,
    };
  }

  /**
   * Enforces domain ownership checks across endpoints.
   */
  assertOwnership(requestingUserId: string, resourceOwnerUserId: string) {
    if (requestingUserId !== resourceOwnerUserId) {
      throw new ForbiddenException({
        code: 'ACCESS_DENIED_OWNERSHIP_MISMATCH',
        message: 'Requesting identity does not own the target resource.',
      });
    }
  }
}
