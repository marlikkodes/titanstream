import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
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

  /**
   * Resolves a ChannelIdentity, bound UniversalIdentity, and canonical Titan User.
   */
  async resolveByChannel(provider: IdentityProvider, rawIdentifier: string) {
    const identifier = this.normalizeIdentifier(provider, rawIdentifier);
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
            users: {
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

    const user = channelIdentity.identity.users[0] || null;
    return {
      channelIdentity,
      identity: channelIdentity.identity,
      user,
    };
  }

  /**
   * Race-safe, transactionally isolated registration of a new Titan Identity & User.
   */
  async register(dto: RegisterIdentityDto): Promise<IdentityContext> {
    const normalizedId = this.normalizeIdentifier(dto.provider, dto.identifier);
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
        const telegramUserIdBig = isTelegram && /^\d+$/.test(normalizedId) ? BigInt(normalizedId) : null;

        // 2. Create User (id = identity.id to guarantee User.id === UniversalIdentity.id)
        const user = await tx.user.create({
          data: {
            id: identity.id,
            identityId: identity.id,
            ...(telegramUserIdBig && { telegramUserId: telegramUserIdBig }),
            firstName: dto.firstName || dto.displayName || `${dto.provider}_User`,
            lastName: dto.lastName,
            telegramUsername: dto.telegramUsername,
            languageCode: dto.languageCode || 'en',
            photoUrl: dto.avatarUrl,
            state: UserState.NEW,
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

        // 4. Initialize Domain Subsystems with userId = identity.id
        await tx.financialAccount.create({
          data: {
            userId: user.id,
            ...(telegramUserIdBig && { telegramUserId: telegramUserIdBig }),
            status: 'ACTIVE',
            activatedAt: new Date(),
          },
        });

        await tx.onboardingProgress.create({
          data: {
            userId: user.id,
            ...(telegramUserIdBig && { telegramUserId: telegramUserIdBig }),
            currentStep: 'welcome',
            stepsCompleted: [],
          },
        });

        const refCodeStr = `TITAN_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        await tx.referralCode.create({
          data: {
            userId: user.id,
            ...(telegramUserIdBig && { telegramUserId: telegramUserIdBig }),
            code: refCodeStr,
            metadata: { generatedAt: new Date().toISOString(), provider: dto.provider },
          },
        });

        await tx.userTrustProfile.create({
          data: {
            userId: user.id,
            ...(telegramUserIdBig && { telegramUserId: telegramUserIdBig }),
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
            userId: user.id,
            ...(telegramUserIdBig && { telegramUserId: telegramUserIdBig }),
            currentLevel: 'NEW',
          },
        });

        await tx.notificationPreference.create({
          data: {
            userId: user.id,
            ...(telegramUserIdBig && { telegramUserId: telegramUserIdBig }),
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

        this.logger.log(`Created new Titan Identity ${identity.id} via channel ${dto.provider}:${normalizedId}`);

        return {
          userId: user.id,
          universalIdentityId: identity.id,
          channel: dto.provider,
          channelIdentityId: channelIdentity.id,
          providerSubject: normalizedId,
          assuranceLevel: isTelegram || dto.provider === IdentityProvider.WHATSAPP ? 'MEDIUM' : 'LOW',
          role: 'USER',
          userState: user.state,
          telegramUserId: telegramUserIdBig || undefined,
        };
      });
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        this.logger.warn(`Concurrent registration race detected for ${dto.provider}:${normalizedId}. Re-resolving existing identity.`);
        const winner = await this.resolveByChannel(dto.provider, normalizedId);
        if (winner && winner.user) {
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
      throw err;
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

    // Update login timestamp
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastActiveAt: new Date(),
        loginCount: { increment: 1 },
        ...(dto.ipAddress && { lastActiveIp: dto.ipAddress }),
      },
    });

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
