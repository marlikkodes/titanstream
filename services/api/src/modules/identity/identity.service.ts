import { Injectable, NotFoundException } from '@nestjs/common';
import { IdentityProvider } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface ResolveIdentityDto {
  provider: IdentityProvider;
  identifier: string;
  displayName?: string;
  avatarUrl?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class IdentityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * @deprecated Use IdentityMasterEngineService.authenticate() instead.
   * Resolves or creates a Universal Identity bound to a channel identifier (Telegram ID, WhatsApp #, etc.).
   */
  async resolveOrCreateIdentity(dto: ResolveIdentityDto) {
    const existingChannel = await this.prisma.channelIdentity.findUnique({
      where: {
        provider_identifier: {
          provider: dto.provider,
          identifier: dto.identifier,
        },
      },
      include: { identity: true },
    });

    if (existingChannel) {
      return existingChannel.identity;
    }

    // Create new Universal Identity & bound channel identity
    const identity = await this.prisma.universalIdentity.create({
      data: {
        displayName: dto.displayName || `${dto.provider}_${dto.identifier}`,
        avatarUrl: dto.avatarUrl,
        channels: {
          create: {
            provider: dto.provider,
            identifier: dto.identifier,
            metadata: dto.metadata || {},
          },
        },
      },
      include: { channels: true },
    });

    return identity;
  }

  /**
   * Links an additional channel (e.g. WhatsApp or Phone) to an existing Universal Identity.
   */
  async linkChannelToIdentity(identityId: string, provider: IdentityProvider, identifier: string, metadata?: Record<string, any>) {
    const identity = await this.prisma.universalIdentity.findUnique({ where: { id: identityId } });
    if (!identity) throw new NotFoundException('UNIVERSAL_IDENTITY_NOT_FOUND');

    return this.prisma.channelIdentity.create({
      data: {
        identityId,
        provider,
        identifier,
        metadata: metadata || {},
      },
    });
  }

  /**
   * Gets a Universal Identity with all connected channels and notes.
   */
  async getIdentityDetails(identityId: string) {
    const identity = await this.prisma.universalIdentity.findUnique({
      where: { id: identityId },
      include: {
        channels: true,
        adminNotes: true,
        supportCases: true,
      },
    });
    if (!identity) throw new NotFoundException('UNIVERSAL_IDENTITY_NOT_FOUND');
    return identity;
  }

  /**
   * Resolves a Titan User by Universal Identity ID.
   */
  async resolveUserByIdentity(identityId: string) {
    return this.prisma.user.findFirst({
      where: { identityId },
      include: {
        financialAccount: true,
        userPreferences: true,
      },
    });
  }

  /**
   * Guarantees that a legacy user record has a bound Universal Identity and Telegram ChannelIdentity.
   */
  async ensureUserIdentityBinding(user: { id: string; telegramUserId: bigint; identityId?: string | null; firstName?: string }) {
    if (user.identityId) {
      const existing = await this.prisma.universalIdentity.findUnique({ where: { id: user.identityId } });
      if (existing) return existing;
    }

    // Resolve or create Telegram channel identity
    const identity = await this.resolveOrCreateIdentity({
      provider: IdentityProvider.TELEGRAM,
      identifier: user.telegramUserId.toString(),
      displayName: user.firstName || `User_${user.telegramUserId}`,
    });

    // Update User record with identity binding if missing
    if (!user.identityId || user.identityId !== identity.id) {
      await this.prisma.user.update({
        where: { telegramUserId: user.telegramUserId },
        data: { identityId: identity.id },
      });
    }

    return identity;
  }
}
