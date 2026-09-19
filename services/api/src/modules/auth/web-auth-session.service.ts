import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import { UserState } from '../../common/interfaces/user-state.enum';
import { requiredEnv } from '../../common/config/env.util';
import { IdentityMasterEngineService } from '../identity/identity-master.service';
import { IdentityProvider } from '@prisma/client';

@Injectable()
export class WebAuthSessionService {
  private readonly logger = new Logger(WebAuthSessionService.name);
  private readonly webAuthSessions = new Map<string, {
    status: 'PENDING' | 'AUTHENTICATED' | 'EXPIRED';
    data?: any;
    createdAt: number;
  }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly identityMasterEngine: IdentityMasterEngineService,
  ) {}

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

    const identifierStr = String(telegramUser.id);
    let identityContext: any = null;

    try {
      identityContext = await this.identityMasterEngine.authenticate({
        provider: IdentityProvider.TELEGRAM,
        identifier: identifierStr,
        displayName: telegramUser.first_name ? `${telegramUser.first_name} ${telegramUser.last_name || ''}`.trim() : `Telegram_${identifierStr}`,
        avatarUrl: telegramUser.photo_url,
        metadata: {
          sessionCode,
          username: telegramUser.username,
          languageCode: telegramUser.language_code,
          authorizedVia: 'web_auth_session',
        },
      });
    } catch (dbErr: any) {
      this.logger.error(`[WEB_AUTH] IdentityMaster resolution failed for Telegram user ${telegramUser.id}: ${dbErr.message}`);
      throw new UnauthorizedException('AUTHENTICATION_FAILED: Unable to resolve canonical identity');
    }

    const canonicalUserId = identityContext.userId;
    const payload = {
      sub: canonicalUserId,
      userId: canonicalUserId,
      titanUserId: canonicalUserId,
      telegramUserId: Number(telegramUser.id),
      provider: 'TELEGRAM',
      channelIdentityId: identityContext.channelIdentityId,
      state: identityContext.userState || 'READY',
      role: identityContext.role || 'USER',
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(
      { sub: canonicalUserId, userId: canonicalUserId, telegramUserId: Number(telegramUser.id), type: 'refresh' },
      { expiresIn: '30d', secret: process.env.JWT_REFRESH_SECRET || requiredEnv('JWT_REFRESH_SECRET', 'dev-refresh-secret') },
    );

    this.webAuthSessions.set(sessionCode, {
      status: 'AUTHENTICATED',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: canonicalUserId,
          identityId: identityContext.universalIdentityId,
          telegramUserId: String(telegramUser.id),
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name,
          username: telegramUser.username,
          state: identityContext.userState || UserState.READY,
        },
        isNewUser: identityContext.assuranceLevel !== 'HIGH',
      },
      createdAt: session.createdAt,
    });

    this.logger.log(`Web auth session ${sessionCode} successfully authorized for canonical User ${canonicalUserId} (Telegram ID ${telegramUser.id})`);
    return true;
  }
}
