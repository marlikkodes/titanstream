import { IdentityProvider, UserState } from '@prisma/client';

export type IdentityAssuranceLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'STEP_UP';

export interface IdentityContext {
  userId: string; // UUID (User.id === UniversalIdentity.id)
  universalIdentityId: string; // UUID
  channel: IdentityProvider; // TELEGRAM | WHATSAPP | PHONE | EMAIL | etc.
  channelIdentityId: string; // UUID
  providerSubject: string; // e.g. "123456789" or "+256770000000"
  assuranceLevel: IdentityAssuranceLevel;
  role: string;
  userState: UserState;
  sessionId?: string;
  telegramUserId?: bigint;
}

export interface ResolveByChannelDto {
  provider: IdentityProvider;
  identifier: string;
}

export interface RegisterIdentityDto {
  provider: IdentityProvider;
  identifier: string;
  displayName?: string;
  avatarUrl?: string;
  firstName?: string;
  lastName?: string;
  telegramUsername?: string;
  phoneNumber?: string;
  phoneVerified?: boolean;
  languageCode?: string;
  metadata?: Record<string, any>;
}

export interface AuthenticateIdentityDto {
  provider: IdentityProvider;
  identifier: string;
  displayName?: string;
  avatarUrl?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export interface LinkChannelDto {
  userId: string;
  provider: IdentityProvider;
  identifier: string;
  phone?: string;
  telegramId?: string;
  metadata?: Record<string, any>;
}

export interface UnlinkChannelDto {
  userId: string;
  provider: IdentityProvider;
  identifier: string;
}
