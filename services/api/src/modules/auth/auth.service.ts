import { Injectable, UnauthorizedException, Logger, BadRequestException, Optional } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { IdentityProvider } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TelegramAuthService } from './strategies/telegram-auth.service';
import { IdentityService } from '../identity/identity.service';
import { IdentityMasterEngineService } from '../identity/identity-master.service';
import { UserState, AuditEventType } from '../../common/interfaces/user-state.enum';
import { AuditService } from '../audit/audit.service';
import { requiredEnv } from '../../common/config/env.util';
import { BaileysService } from '../notification/baileys.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly telegramAuth: TelegramAuthService,
    private readonly identityService: IdentityService,
    private readonly identityMasterEngine: IdentityMasterEngineService,
    private readonly auditService: AuditService,
    @Optional() private readonly baileysService?: BaileysService,
  ) {}

  async authenticate(initData: string, ipAddress?: string, userAgent?: string) {
    const traceId = this.createTraceId();
    this.logAuth(traceId, 'mini_app.request_received', `initData length=${initData?.length ?? 0}`);
    try {
      const parsed = this.telegramAuth.parseInitData(initData);
      if (!parsed) throw new UnauthorizedException('INVALID_INIT_DATA');
      this.logAuth(traceId, 'mini_app.signature_verified', `telegramUserId=${parsed.telegramUserId}`);
      return this.authenticateTelegramIdentity(parsed, 'telegram_mini_app', traceId, ipAddress, userAgent);
    } catch (error: any) {
      this.logAuthFailure(traceId, 'mini_app.failed', error);
      throw error;
    }
  }

  private readonly webAuthSessions = new Map<string, {
    status: 'PENDING' | 'AUTHENTICATED' | 'EXPIRED';
    data?: any;
    createdAt: number;
  }>();

  createWebAuthSession() {
    const sessionCode = `wa_${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`;
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'titanstream_bot';
    const deepLink = `https://t.me/${botUsername}?start=${sessionCode}`;

    this.webAuthSessions.set(sessionCode, {
      status: 'PENDING',
      createdAt: Date.now(),
    });

    const tenMinsAgo = Date.now() - 10 * 60 * 1000;
    for (const [code, sess] of this.webAuthSessions.entries()) {
      if (sess.createdAt < tenMinsAgo) this.webAuthSessions.delete(code);
    }

    return { sessionCode, deepLink };
  }

  pollWebAuthSession(sessionCode: string) {
    const session = this.webAuthSessions.get(sessionCode);
    if (!session) {
      return { status: 'EXPIRED' };
    }

    if (Date.now() - session.createdAt > 10 * 60 * 1000) {
      this.webAuthSessions.delete(sessionCode);
      return { status: 'EXPIRED' };
    }

    if (session.status === 'AUTHENTICATED' && session.data) {
      return { status: 'AUTHENTICATED', ...session.data };
    }

    return { status: 'PENDING' };
  }

  async authorizeWebSessionViaTelegram(sessionCode: string, telegramUser: {
    id: number | bigint;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    photo_url?: string;
  }) {
    const session = this.webAuthSessions.get(sessionCode);
    if (!session || session.status === 'EXPIRED') {
      this.logger.warn(`Attempted deep link web auth for unknown or expired session ${sessionCode}`);
      return false;
    }

    const parsed = {
      telegramUserId: telegramUser.id,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name,
      username: telegramUser.username,
      languageCode: telegramUser.language_code,
      photoUrl: telegramUser.photo_url,
    };

    const authResult = await this.authenticateTelegramIdentity(parsed, 'telegram_deep_link_bot', `deeplink_${sessionCode}`);

    this.webAuthSessions.set(sessionCode, {
      status: 'AUTHENTICATED',
      data: authResult,
      createdAt: session.createdAt,
    });

    this.logger.log(`Web auth session ${sessionCode} successfully authorized for Telegram ID ${telegramUser.id}`);
    return true;
  }

  private readonly activeNonces = new Map<string, { createdAt: number; used: boolean }>();

  createTelegramNonce() {
    const nonce = `tgn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
    this.activeNonces.set(nonce, { createdAt: Date.now(), used: false });

    const tenMinsAgo = Date.now() - 10 * 60 * 1000;
    for (const [code, item] of this.activeNonces.entries()) {
      if (item.createdAt < tenMinsAgo) this.activeNonces.delete(code);
    }

    return { nonce };
  }

  validateAndConsumeNonce(nonce?: string): boolean {
    if (!nonce) {
      throw new UnauthorizedException({ code: 'MISSING_NONCE', message: 'Authentication nonce is required.' });
    }

    const record = this.activeNonces.get(nonce);
    if (!record) {
      throw new UnauthorizedException({ code: 'INVALID_NONCE', message: 'Authentication nonce is invalid or expired.' });
    }

    if (record.used) {
      throw new UnauthorizedException({ code: 'REPLAYED_NONCE', message: 'Authentication nonce has already been consumed.' });
    }

    if (Date.now() - record.createdAt > 10 * 60 * 1000) {
      this.activeNonces.delete(nonce);
      throw new UnauthorizedException({ code: 'EXPIRED_NONCE', message: 'Authentication nonce has expired.' });
    }

    this.activeNonces.delete(nonce);
    return true;
  }

  async authenticateWebLogin(payload: any, ipAddress?: string, userAgent?: string) {
    const traceId = this.createTraceId();
    this.logAuth(traceId, 'web_login.request_received', `telegramPayloadId=${payload?.id ?? 'missing'} nonce=${payload?.nonce || 'none'}`);
    try {
      if (!payload?.nonce && !payload?.id_token) {
        throw new UnauthorizedException({ code: 'MISSING_NONCE', message: 'Authentication nonce is required.' });
      }
      // Nonce is required for replay protection on the hash flow. The id_token
      // flow binds the nonce inside the JWT itself (verified cryptographically).
      if (payload?.nonce) {
        this.validateAndConsumeNonce(payload.nonce);
      }

      const parsed = await this.telegramAuth.parseWebLoginPayloadAsync(payload);
      // referralCode / referral_code are TitanStream control fields, never
      // Telegram-signed. Attach them as startParam without affecting verification.
      const referralCode: string | undefined =
        (typeof payload?.referralCode === 'string' && payload.referralCode) ||
        (typeof payload?.referral_code === 'string' && payload.referral_code) ||
        undefined;
      const parsedWithReferral = {
        ...parsed,
        startParam: parsed.startParam || referralCode || undefined,
      };
      this.logAuth(traceId, 'web_login.signature_verified', `telegramUserId=${parsed.telegramUserId}`);
      return this.authenticateTelegramIdentity(parsedWithReferral, 'telegram_login_library', traceId, ipAddress, userAgent);
    } catch (error: any) {
      this.logAuthFailure(traceId, 'web_login.failed', error);
      throw error;
    }
  }

  private async authenticateTelegramIdentity(parsed: any, provider: string, traceId: string, ipAddress?: string, userAgent?: string) {
    const { telegramUserId, firstName, lastName, username, languageCode, photoUrl, startParam } = parsed;
    const identifierStr = String(telegramUserId);

    this.logAuth(traceId, 'telegram_identity_resolution.started', `telegramUserId=${identifierStr}, username=${username}, provider=${provider}`);

    let identityContext;
    try {
      identityContext = await this.identityMasterEngine.authenticate({
        provider: IdentityProvider.TELEGRAM,
        identifier: identifierStr,
        displayName: firstName ? `${firstName} ${lastName || ''}`.trim() : `Telegram_${identifierStr}`,
        avatarUrl: photoUrl,
        ipAddress,
        userAgent,
        metadata: { traceId, username, startParam },
      });

      this.logAuth(traceId, 'telegram_identity_resolution.success', `userId=${identityContext.userId}, universalIdentityId=${identityContext.universalIdentityId}, telegramUserId=${identityContext.telegramUserId?.toString()}`);
    } catch (engineErr: any) {
      this.logger.error(`[AUTH_ENGINE] IdentityMasterEngine failed for user ${identifierStr}: ${engineErr.message}`);
      this.logAuthFailure(traceId, 'telegram_identity_resolution.failed', engineErr);
      // CRITICAL: Never create fallback identity - fail authentication instead.
      // A database/identity failure must NOT become an authenticated session.
      if (engineErr instanceof UnauthorizedException) throw engineErr;
      throw new UnauthorizedException({
        code: 'TELEGRAM_IDENTITY_RESOLUTION_FAILED',
        message: 'Identity resolution failed. Authentication rejected to prevent account duplication.',
      });
    }

    // Best-effort referral attach for new web logins. Never fails authentication.
    if (startParam) {
      try {
        await this.attachWebLoginReferral(BigInt(identifierStr), String(startParam), traceId);
      } catch (refErr: any) {
        this.logger.warn(`[AUTH_REFERRAL] referral attach skipped: ${refErr?.message || refErr}`);
      }
    }

    // Resolve the canonical user + onboarding BEFORE issuing any JWT.
    // DB failure or missing user here is a controlled rejection — never a
    // synthetic user and never a signed token for an unverified identity.
    let canonicalUser: any = null;
    try {
      canonicalUser = await this.prisma.user.findUnique({
        where: { id: identityContext.userId },
        include: { onboardingProgress: true },
      });
    } catch (dbErr: any) {
      this.logger.error(`[AUTH_ENGINE] canonical user lookup failed for ${identityContext.userId}: ${dbErr?.message || dbErr}`);
      throw new UnauthorizedException({
        code: 'TELEGRAM_IDENTITY_RESOLUTION_FAILED',
        message: 'Identity resolution failed. Authentication rejected to prevent account duplication.',
      });
    }
    if (!canonicalUser) {
      this.logger.error(`[AUTH_ENGINE] canonical user missing after identity resolution: userId=${identityContext.userId}`);
      throw new UnauthorizedException({
        code: 'TELEGRAM_IDENTITY_RESOLUTION_FAILED',
        message: 'Identity resolution failed. Authentication rejected to prevent account duplication.',
      });
    }

    const payload = {
      sub: identityContext.universalIdentityId, // Always use canonical UniversalIdentity.id
      userId: identityContext.userId,
      titanUserId: identityContext.userId,
      telegramUserId: identityContext.telegramUserId ? Number(identityContext.telegramUserId) : Number(identifierStr),
      provider: 'TELEGRAM',
      channelIdentityId: identityContext.channelIdentityId,
      providerSubject: identityContext.providerSubject,
      state: identityContext.userState,
      role: identityContext.role,
    };

    const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || requiredEnv('JWT_REFRESH_SECRET', 'dev-refresh-secret');
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(
      { sub: identityContext.universalIdentityId, telegramUserId: payload.telegramUserId, type: 'refresh' },
      { expiresIn: '30d', secret: refreshSecret },
    );

    this.logAuth(traceId, 'jwt.issued', `userId=${identityContext.userId} telegramUserId=${identifierStr}`);
    this.logAuth(traceId, 'auth.completed', `provider=TELEGRAM`);

    const isNewUser = (canonicalUser.loginCount ?? 0) <= 1;
    const onboarding = {
      currentStep: canonicalUser.onboardingProgress?.currentStep || 'welcome',
      isCompleted:
        canonicalUser.onboardingProgress?.isCompleted ??
        [UserState.ELIGIBLE_USER, UserState.ACTIVE_USER, UserState.READY].includes(canonicalUser.state as UserState),
    };

    // Log authentication to audit trail (best-effort; never fails auth)
    try {
      if (this.auditService) {
        await this.auditService.create({
          telegramUserId: BigInt(identifierStr),
          eventType: AuditEventType.USER_STATE_CHANGED,
          description: `Authentication completed via ${provider}: userId=${identityContext.userId}, universalIdentityId=${identityContext.universalIdentityId}`,
          metadata: {
            provider,
            userId: identityContext.userId,
            universalIdentityId: identityContext.universalIdentityId,
            telegramUserId: identifierStr,
            assuranceLevel: identityContext.assuranceLevel,
            ipAddress,
            userAgent,
          },
        });
      }
    } catch (auditErr: any) {
      this.logger.warn(`[AUTH_AUDIT] audit log skipped: ${auditErr?.message || auditErr}`);
    }

    return {
      accessToken,
      refreshToken,
      user: this.sanitizeUser(canonicalUser),
      onboarding,
      isNewUser,
      traceId,
    };
  }

  /**
   * Best-effort referral attach for standalone web logins.
   * Runs after canonical identity resolution; failures are swallowed by the caller.
   */
  private async attachWebLoginReferral(telegramUserId: bigint, startParam: string, traceId: string) {
    const referralCode = startParam.startsWith('ref_') ? startParam.replace('ref_', '') : startParam;
    if (!referralCode) return;
    const codeRecord = await this.prisma.referralCode.findUnique({ where: { code: referralCode } });
    if (!codeRecord) {
      this.logAuth(traceId, 'referral.skipped', `reason=code_not_found code=${referralCode}`);
      return;
    }
    if (codeRecord.telegramUserId === telegramUserId) {
      this.logAuth(traceId, 'referral.skipped', 'reason=self_referral');
      return;
    }
    await this.prisma.referralRelationship.upsert({
      where: { refereeId: telegramUserId },
      update: {},
      create: {
        referrerId: codeRecord.telegramUserId,
        refereeId: telegramUserId,
        referralCodeId: codeRecord.id,
        status: 'CREATED',
        metadata: { source: 'auth_web_login', referralCode, traceId },
      },
    });
    this.logAuth(traceId, 'referral.attached', `refereeId=${telegramUserId.toString()} code=${referralCode}`);
  }

  private async ensureIdentityResources(telegramUserId: bigint, traceId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.onboardingProgress.upsert({
        where: { telegramUserId },
        update: {},
        create: { telegramUserId, currentStep: 'welcome', stepsCompleted: [] },
      });
      await tx.financialAccount.upsert({
        where: { telegramUserId },
        update: {},
        create: { telegramUserId, status: 'ACTIVE', activatedAt: new Date() },
      });
      await tx.referralCode.upsert({
        where: { telegramUserId },
        update: {},
        create: {
          telegramUserId,
          code: await this.generateUniqueReferralCode(tx),
          metadata: { generatedAt: new Date().toISOString(), traceId },
        },
      });
      await tx.userTrustProfile.upsert({
        where: { telegramUserId },
        update: {},
        create: {
          telegramUserId,
          trustScore: 50,
          completedSettlements: 0,
          failedSettlements: 0,
          successRate: 100.0,
          accountAgeDays: 0,
          verificationStatus: 'UNVERIFIED',
        },
      });
      await tx.userLevelRecord.upsert({
        where: { telegramUserId },
        update: {},
        create: { telegramUserId, currentLevel: 'NEW' },
      });
      await tx.notificationPreference.upsert({
        where: { telegramUserId },
        update: {},
        create: { telegramUserId, telegramEnabled: true, inAppEnabled: true, marketingEnabled: false },
      });
    });
    this.logAuth(traceId, 'identity.resources_verified', `telegramUserId=${telegramUserId.toString()}`);
  }

  private async attachReferralIfPresent(tx: any, telegramUserId: bigint, startParam: string | undefined, traceId: string) {
    if (!startParam) return;

    const referralCode = startParam.startsWith('ref_') ? startParam.replace('ref_', '') : startParam;
    const codeRecord = await tx.referralCode.findUnique({ where: { code: referralCode } });
    if (!codeRecord) {
      this.logAuth(traceId, 'referral.skipped', `reason=code_not_found code=${referralCode}`);
      return;
    }

    if (codeRecord.telegramUserId === telegramUserId) {
      this.logAuth(traceId, 'referral.skipped', 'reason=self_referral');
      return;
    }

    await tx.referralRelationship.upsert({
      where: { refereeId: telegramUserId },
      update: {},
      create: {
        referrerId: codeRecord.telegramUserId,
        refereeId: telegramUserId,
        referralCodeId: codeRecord.id,
        status: 'CREATED',
        metadata: { source: 'auth', referralCode, traceId },
      },
    });
    this.logAuth(traceId, 'referral.attached', `refereeId=${telegramUserId.toString()} code=${referralCode}`);
  }

  private async generateUniqueReferralCode(tx: any): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = `TS${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const existing = await tx.referralCode.findUnique({ where: { code } });
      if (!existing) return code;
    }
    throw new BadRequestException('REFERRAL_CODE_GENERATION_FAILED');
  }

  async refreshTokens(refreshToken: string) {
    const traceId = this.createTraceId();
    this.logAuth(traceId, 'refresh.request_received', 'refresh token submitted');
    const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || requiredEnv('JWT_REFRESH_SECRET', 'dev-refresh-secret');
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: refreshSecret,
      });
      if (payload.type !== 'refresh') throw new UnauthorizedException('INVALID_REFRESH_TOKEN');

      const subStr = String(payload.sub || '');
      const isUuid = subStr.includes('-');

      let user: any = null;
      if (isUuid) {
        user = await this.prisma.user.findFirst({ where: { identityId: subStr } });
      }
      if (!user && (payload.telegramUserId || (!isUuid && subStr))) {
        const rawId = payload.telegramUserId || subStr;
        if (!isNaN(Number(rawId))) {
          user = await this.prisma.user.findUnique({ where: { telegramUserId: BigInt(rawId) } });
        }
      }

      if (!user) throw new UnauthorizedException('USER_NOT_FOUND');

      // Rolling 14-day inactivity window check
      const INACTIVITY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
      const lastActive = user.lastActiveAt ? new Date(user.lastActiveAt).getTime() : Date.now();
      if (Date.now() - lastActive > INACTIVITY_WINDOW_MS) {
        this.logAuth(traceId, 'refresh.expired', `Inactivity limit exceeded for user ${user.telegramUserId}`);
        this.logAuthFailure(traceId, 'refresh.expired', new Error('14-day inactivity exceeded'));
        throw new UnauthorizedException({ code: 'SESSION_EXPIRED', message: 'Session expired due to 14 days of inactivity. Please sign in again.' });
      }

      // Update lastActiveAt to renew rolling window
      await this.prisma.user.update({
        where: { telegramUserId: user.telegramUserId },
        data: { lastActiveAt: new Date() },
      });
      
      this.logAuth(traceId, 'session.renewed', `userId=${user.id}, telegramUserId=${user.telegramUserId?.toString()}`);
      
      // Log token refresh to audit trail
      if (this.auditService) {
        await this.auditService.create({
          telegramUserId: user.telegramUserId,
          eventType: AuditEventType.USER_STATE_CHANGED,
          description: `Session token refreshed: userId=${user.id}, inactivityDays=${Math.floor((Date.now() - lastActive) / (24 * 60 * 60 * 1000))}`,
          metadata: {
            userId: user.id,
            identityId: user.identityId,
            telegramUserId: user.telegramUserId?.toString(),
            lastActiveAt: user.lastActiveAt,
            daysSinceLastActive: Math.floor((Date.now() - lastActive) / (24 * 60 * 60 * 1000)),
          },
        });
      }

      const canonicalId = user.identityId || subStr;
      const newPayload = {
        sub: canonicalId, // Always use UniversalIdentity.id (canonical identity)
        titanUserId: canonicalId,
        telegramUserId: Number(user.telegramUserId),
        state: user.state,
        role: 'USER',
      };

      const newAccessToken = this.jwtService.sign(newPayload, { expiresIn: '15m' });
      const newRefreshToken = this.jwtService.sign(
        { sub: canonicalId, telegramUserId: Number(user.telegramUserId), type: 'refresh' },
        { expiresIn: '30d', secret: refreshSecret },
      );

      this.logAuth(traceId, 'refresh.completed', `canonicalId=${canonicalId}`);
      return { accessToken: newAccessToken, refreshToken: newRefreshToken, traceId };
    } catch (error: any) {
      this.logAuthFailure(traceId, 'refresh.failed', error);
      throw new UnauthorizedException(error.response || 'TOKEN_EXPIRED');
    }
  }

  async getProfile(userKey: string | bigint) {
    let user: any = null;

    if (typeof userKey === 'string') {
      user = await this.prisma.user.findUnique({
        where: { id: userKey },
        include: {
          onboardingProgress: true,
          educationCompletions: true,
          userConsents: true,
          readinessScores: true,
        },
      });

      if (!user && !isNaN(Number(userKey))) {
        const telegramUserId = BigInt(userKey);
        user = await this.prisma.user.findUnique({
          where: { telegramUserId },
          include: {
            onboardingProgress: true,
            educationCompletions: true,
            userConsents: true,
            readinessScores: true,
          },
        });
      }
    } else if (typeof userKey === 'bigint') {
      user = await this.prisma.user.findUnique({
        where: { telegramUserId: userKey },
        include: {
          onboardingProgress: true,
          educationCompletions: true,
          userConsents: true,
          readinessScores: true,
        },
      });
    }

    if (!user) throw new UnauthorizedException('USER_NOT_FOUND: User does not exist in database');
    return {
      user: this.sanitizeUser(user),
      onboarding: user.onboardingProgress,
      education: user.educationCompletions,
      consents: user.userConsents,
      readiness: user.readinessScores,
    };
  }

  async verifyIdentity(userKey: string | bigint) {
    const traceId = this.createTraceId();
    this.logAuth(traceId, 'identity_verification.started', `userKey=${userKey}`);
    
    let user: any = null;

    if (typeof userKey === 'string') {
      user = await this.prisma.user.findUnique({
        where: { id: userKey },
        include: {
          identity: {
            include: {
              channels: true,
            },
          },
          financialAccount: true,
        },
      });

      if (!user && !isNaN(Number(userKey))) {
        const telegramUserId = BigInt(userKey);
        user = await this.prisma.user.findUnique({
          where: { telegramUserId },
          include: {
            identity: {
              include: {
                channels: true,
              },
            },
            financialAccount: true,
          },
        });
      }
    } else if (typeof userKey === 'bigint') {
      user = await this.prisma.user.findUnique({
        where: { telegramUserId: userKey },
        include: {
          identity: {
            include: {
              channels: true,
            },
          },
          financialAccount: true,
        },
      });
    }

    if (!user) {
      this.logAuthFailure(traceId, 'identity_verification.failed', new Error('User not found'));
      throw new UnauthorizedException('IDENTITY_VERIFICATION_FAILED: User does not exist');
    }

    // Verify canonical identity mapping
    const userId = user.id;
    const identityId = user.identityId;
    const telegramUserId = user.telegramUserId;
    
    const isMappingConsistent = userId === identityId;
    const hasFinancialAccount = !!user.financialAccount;
    const hasChannels = user.identity?.channels && user.identity.channels.length > 0;
    
    this.logAuth(traceId, 'identity_verification.completed', `userId=${userId}, identityId=${identityId}, telegramUserId=${telegramUserId?.toString()}, mappingConsistent=${isMappingConsistent}, hasFinancialAccount=${hasFinancialAccount}, hasChannels=${hasChannels}`);
    
    // Log identity verification to audit trail
    if (this.auditService) {
      await this.auditService.create({
        telegramUserId: telegramUserId || undefined,
        eventType: AuditEventType.USER_STATE_CHANGED,
        description: `Identity verification: userId=${userId}, identityId=${identityId}, mappingConsistent=${isMappingConsistent}`,
        metadata: {
          userId,
          identityId,
          telegramUserId: telegramUserId?.toString(),
          mappingConsistent: isMappingConsistent,
          hasFinancialAccount,
          hasChannels,
          channels: user.identity?.channels?.map((ch: any) => ({
            provider: ch.provider,
            identifier: ch.identifier,
          })),
        },
      });
    }

    return {
      verified: true,
      userId,
      identityId,
      telegramUserId: telegramUserId?.toString(),
      mappingConsistent: isMappingConsistent,
      hasFinancialAccount,
      hasChannels,
      channels: user.identity?.channels?.map((ch: any) => ({
        provider: ch.provider,
        identifier: ch.identifier,
      })),
    };
  }

  private async evaluateReadiness(telegramUserId: bigint) {
    try {
      const readiness = await this.prisma.readinessScore.findUnique({
        where: { telegramUserId },
      });
      return {
        isReady: readiness?.isReady ?? true,
        readiness: readiness || { isReady: true, score: 100 },
      };
    } catch (err: any) {
      this.logger.warn(`[AUTH_FALLBACK] evaluateReadiness failed: ${err.message}`);
      return {
        isReady: true,
        readiness: { isReady: true, score: 100 },
      };
    }
  }

  private async transitionUserState(telegramUserId: bigint, newState: UserState, reason: string) {
    try {
      const user = await this.prisma.user.findUnique({ where: { telegramUserId } });
      if (!user) return { state: newState } as any;

      const updatedUser = await this.prisma.user.update({
        where: { telegramUserId },
        data: { state: newState },
      });

      await this.prisma.userStateTransition.create({
        data: {
          telegramUserId,
          fromState: user.state as UserState,
          toState: newState,
          reason,
          triggerEvent: 'auth_service',
        },
      });

      await this.auditService.create({
        telegramUserId,
        eventType: AuditEventType.USER_STATE_CHANGED,
        description: `State transition: ${user.state} -> ${newState}`,
        metadata: { fromState: user.state, toState: newState, reason },
      });

      return updatedUser;
    } catch (err: any) {
      this.logger.warn(`[AUTH_FALLBACK] transitionUserState failed: ${err.message}`);
      return { state: newState } as any;
    }
  }

  private async getCurrentOnboardingStep(telegramUserId: bigint): Promise<string> {
    try {
      const progress = await this.prisma.onboardingProgress.findUnique({
        where: { telegramUserId },
      });
      return progress?.currentStep || 'welcome';
    } catch {
      return 'welcome';
    }
  }

  // ─── WhatsApp OTP Authentication ──────────────────────────────────────────
  private inMemoryOtpMap = new Map<string, { otpHash: string; attempts: number; verified: boolean; expiresAt: Date; createdAt: Date }>();

  async requestWhatsAppOtp(phoneInput: string) {
    const traceId = this.createTraceId();
    this.logger.log(`[WHATSAPP_OTP:${traceId}] Starting OTP request for phone: ${phoneInput}`);
    const phone = this.identityMasterEngine.normalizeIdentifier(IdentityProvider.WHATSAPP, phoneInput);
    this.logger.log(`[WHATSAPP_OTP:${traceId}] Normalized phone: ${phone}`);
    if (!phone || phone.length < 8) {
      throw new BadRequestException('INVALID_PHONE_NUMBER');
    }

    // Rate limiting: check recent active challenges in the last 1 minute
    const oneMinAgo = new Date(Date.now() - 60 * 1000);
    try {
      const recent = await this.prisma.otpChallenge.findFirst({
        where: { phone, createdAt: { gte: oneMinAgo } },
      });
      if (recent) {
        return { success: true, message: 'If this number is eligible, a verification code will be sent.' };
      }
    } catch {
      const memRecent = this.inMemoryOtpMap.get(phone);
      if (memRecent && memRecent.createdAt >= oneMinAgo && !memRecent.verified) {
        return { success: true, message: 'If this number is eligible, a verification code will be sent.' };
      }
    }

    // Generate cryptographically secure 6-digit OTP
    const code = String(randomInt(100000, 1000000));
    const otpHash = createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    try {
      await this.prisma.otpChallenge.create({
        data: {
          phone,
          otpHash,
          attempts: 0,
          verified: false,
          expiresAt,
        },
      });
    } catch (dbErr: any) {
      this.logger.warn(`[WHATSAPP_OTP:${traceId}] DB unreachable (${dbErr.message}). Storing OTP challenge in memory.`);
      this.inMemoryOtpMap.set(phone, {
        otpHash,
        attempts: 0,
        verified: false,
        expiresAt,
        createdAt: new Date(),
      });
    }

    this.logger.log(`[WHATSAPP_OTP:${traceId}] OTP challenge created for ${phone}.`);

    // Dispatch OTP over Baileys transport if available
    if (this.baileysService) {
      try {
        await this.baileysService.sendOtpMessage(phone, code);
      } catch (dispErr: any) {
        this.logger.warn(`[WHATSAPP_OTP:${traceId}] Baileys dispatch issue: ${dispErr.message}`);
      }
    }

    return { success: true, message: 'If this number is eligible, a verification code will be sent.' };
  }

  async verifyWhatsAppOtp(phoneInput: string, code: string, ipAddress?: string, userAgent?: string) {
    const traceId = this.createTraceId();
    const phone = this.identityMasterEngine.normalizeIdentifier(IdentityProvider.WHATSAPP, phoneInput);

    let challenge: { id?: string; otpHash: string; attempts: number; verified: boolean; expiresAt: Date } | null = null;
    let isMemory = false;

    try {
      challenge = await this.prisma.otpChallenge.findFirst({
        where: { phone, verified: false, expiresAt: { gte: new Date() } },
        orderBy: { createdAt: 'desc' },
      });
    } catch {
      const mem = this.inMemoryOtpMap.get(phone);
      if (mem && !mem.verified && mem.expiresAt >= new Date()) {
        challenge = mem;
        isMemory = true;
      }
    }

    if (!challenge) {
      throw new BadRequestException('INVALID_OR_EXPIRED_OTP');
    }

    if (challenge.attempts >= 3) {
      throw new BadRequestException('TOO_MANY_ATTEMPTS');
    }

    const inputHash = createHash('sha256').update(code).digest('hex');
    const isMatch = timingSafeEqual(Buffer.from(inputHash), Buffer.from(challenge.otpHash));

    if (!isMatch) {
      if (!isMemory && challenge.id) {
        try {
          await this.prisma.otpChallenge.update({
            where: { id: challenge.id },
            data: { attempts: { increment: 1 } },
          });
        } catch {}
      } else {
        challenge.attempts += 1;
      }
      throw new UnauthorizedException('INVALID_OTP');
    }

    // Mark challenge verified
    if (!isMemory && challenge.id) {
      try {
        await this.prisma.otpChallenge.update({
          where: { id: challenge.id },
          data: { verified: true },
        });
      } catch {}
    } else {
      challenge.verified = true;
    }

    // Authenticate / Register provider-neutrally via IdentityMasterEngine
    const identityContext = await this.identityMasterEngine.authenticate({
      provider: IdentityProvider.WHATSAPP,
      identifier: phone,
      displayName: `WhatsApp User (${phone.slice(-4)})`,
      metadata: { phone, verifiedAt: new Date().toISOString() },
      ipAddress,
    });

    let user: any = await this.prisma.user.findUnique({
      where: { id: identityContext.userId },
      include: { onboardingProgress: true },
    }).catch(() => null);

    if (!user) {
      this.logger.error(`[WHATSAPP_AUTH] User not found after identity resolution: userId=${identityContext.userId}, phone=${phone}`);
      throw new UnauthorizedException('USER_NOT_FOUND: Identity resolution succeeded but user record not found in database');
    }

    const payload = {
      sub: identityContext.universalIdentityId, // Always use canonical UniversalIdentity.id
      userId: user.id,
      titanUserId: user.id,
      telegramUserId: user.telegramUserId ? Number(user.telegramUserId) : undefined,
      provider: 'WHATSAPP',
      state: user.state,
      role: 'USER',
    };

    const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || requiredEnv('JWT_REFRESH_SECRET', 'dev-refresh-secret');
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(
      { sub: identityContext.universalIdentityId, userId: user.id, telegramUserId: user.telegramUserId ? Number(user.telegramUserId) : undefined, type: 'refresh' },
      { expiresIn: '30d', secret: refreshSecret },
    );

    const isNewUser = !user || !user.createdAt || user.state === UserState.NEW;
    const cleanDigits = phone.replace(/\D/g, '');
    const canonicalTitanId = `titan_wa_${cleanDigits}`;

    // Send Instant WhatsApp Sign-In / Sign-Up Success Confirmation Message over Baileys
    if (this.baileysService) {
      try {
        const primaryTarget = `${cleanDigits}@s.whatsapp.net`;
        const confirmText = isNewUser
          ? (
              `⚡ *TITAN STREAM* — *Welcome to Titan Stream!*\n\n` +
              `🎉 *Signup Approved & Account Created*\n` +
              `• Status: *Active & Verified*\n` +
              `• Phone: *${phone}*\n` +
              `• Titan ID: *${canonicalTitanId}*\n` +
              `• Welcome Bonus: *+50 Energy Crystals Credited*\n\n` +
              `🌐 *Browser Authenticated*: Your browser window is now unlocked and ready to stream!\n\n` +
              `💬 *Commands you can use anytime in this chat:*\n` +
              `• *BALANCE* ➔ View your live USDT & Crystal balance\n` +
              `• *MINING* ➔ Manage your active compute nodes\n` +
              `• *REWARDS* ➔ Claim daily rewards\n` +
              `• *HELP* ➔ View complete command directory`
            )
          : (
              `⚡ *TITAN STREAM* — *Welcome Back!*\n\n` +
              `✅ *Login Approved*\n` +
              `• Status: *Active & Online*\n` +
              `• Phone: *${phone}*\n` +
              `• Titan ID: *${canonicalTitanId}*\n` +
              `• Security: *Browser Session Authorized*\n\n` +
              `🌐 *Browser Authenticated*: Head back to your browser screen to continue using Titan Stream!\n\n` +
              `💬 *Commands you can use anytime in this chat:*\n` +
              `• *BALANCE* ➔ Check your live USDT & Crystal balance\n` +
              `• *MINING* ➔ Compute nodes status & yield\n` +
              `• *REWARDS* ➔ Claim daily rewards\n` +
              `• *HELP* ➔ View command directory`
            );

        await this.baileysService.sendTextMessage(primaryTarget, confirmText, 'CRITICAL');
        this.logger.log(`[WA_OTP_CONFIRMATION_SENT] ${isNewUser ? 'Signup' : 'Login'} OTP confirmation sent to ${primaryTarget}`);
      } catch (msgErr: any) {
        this.logger.warn(`[WA_OTP_CONFIRMATION_WARN] Failed to send OTP confirmation to ${phone}: ${msgErr.message}`);
      }
    }

    return {
      accessToken,
      refreshToken,
      user: this.sanitizeUser(user),
      onboarding: {
        currentStep: user.onboardingProgress?.currentStep || 'welcome',
        isCompleted: user.state === UserState.ELIGIBLE_USER || user.state === UserState.ACTIVE_USER || user.state === UserState.READY,
      },
    };
  }

  async createTokensForUser(userPayload: any, universalIdentityId?: string) {
    const sub = universalIdentityId || userPayload.identityId || userPayload.id;
    const payload = {
      sub: sub, // Always use canonical UniversalIdentity.id if available
      titanUserId: userPayload.id,
      userId: userPayload.id,
      telegramUserId: userPayload.telegramUserId ? Number(userPayload.telegramUserId) : undefined,
      provider: 'WHATSAPP',
      state: userPayload.state || UserState.READY,
      role: 'USER',
    };

    const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || requiredEnv('JWT_REFRESH_SECRET', 'dev-refresh-secret');
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(
      { sub: sub, userId: userPayload.id, telegramUserId: payload.telegramUserId, type: 'refresh' },
      { expiresIn: '30d', secret: refreshSecret },
    );

    return {
      accessToken,
      refreshToken,
      user: this.sanitizeUser(userPayload),
    };
  }

  // ─── Step-Up Authentication ──────────────────────────────────────────────

  async requestStepUpChallenge(userId: string) {
    const traceId = this.createTraceId();
    const context = await this.identityMasterEngine.getIdentityContext(userId);
    const channel = context.channel;

    const code = String(randomInt(100000, 1000000));
    const otpHash = createHash('sha256').update(code).digest('hex');

    await this.prisma.otpChallenge.create({
      data: {
        phone: userId,
        otpHash,
        attempts: 0,
        verified: false,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    if (this.baileysService && (channel === IdentityProvider.WHATSAPP || channel === IdentityProvider.PHONE)) {
      try {
        await this.baileysService.sendOtpMessage(context.providerSubject, code);
      } catch (err: any) {
        this.logger.warn(`[STEP_UP:${traceId}] Failed to deliver step-up OTP via WhatsApp: ${err.message}`);
      }
    }

    this.logger.log(`[STEP_UP:${traceId}] Step-up challenge generated for user ${userId}.`);
    return { success: true, channel, expiresAt: new Date(Date.now() + 300000) };
  }

  async verifyStepUpChallenge(userId: string, code: string) {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { phone: userId, verified: false, expiresAt: { gte: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) throw new BadRequestException('INVALID_OR_EXPIRED_STEP_UP_CODE');

    const inputHash = createHash('sha256').update(code).digest('hex');
    const isMatch = timingSafeEqual(Buffer.from(inputHash), Buffer.from(challenge.otpHash));

    if (!isMatch) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('INVALID_STEP_UP_CODE');
    }

    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { verified: true },
    });

    // Get canonical identity ID for consistent JWT subject
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { identityId: true },
    });
    const canonicalId = user?.identityId || userId;

    // Issue 5-minute step-up authorization token
    const stepUpToken = this.jwtService.sign(
      { sub: canonicalId, type: 'step_up', purpose: 'financial_authorization' },
      { expiresIn: '5m' },
    );

    return { stepUpToken, expiresAt: Date.now() + 5 * 60 * 1000 };
  }

  private sanitizeUser(user: any) {
    return {
      id: user.identityId || String(user.telegramUserId),
      identityId: user.identityId || String(user.telegramUserId),
      telegramUserId: Number(user.telegramUserId),
      telegramUsername: user.telegramUsername,
      firstName: user.firstName,
      lastName: user.lastName,
      photoUrl: user.photoUrl,
      languageCode: user.languageCode,
      state: user.state,
      isReady: user.isReady,
      createdAt: user.createdAt,
    };
  }

  private createTraceId() {
    return `auth_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private logAuth(traceId: string, stage: string, detail: string) {
    this.logger.log(`[AUTH_TRACE:${traceId}] ${stage} ${detail}`);
  }

  private logAuthFailure(traceId: string, stage: string, error: any) {
    const code = error?.response?.code || error?.message || 'AUTHENTICATION_FAILED';
    this.logger.error(`[AUTH_TRACE:${traceId}] ${stage} code=${code}`);
  }
}
