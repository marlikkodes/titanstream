import { Injectable, OnModuleInit, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import { ROLE_PERMISSIONS_MAP } from '../interfaces/admin-permissions.enum';
import { OperationalAuditService } from './operational-audit.service';
import { AuthVerificationService } from '../../auth/auth-verification.service';
import { isProduction, requiredEnv } from '../../../common/config/env.util';

export interface TelegramAdminLoginDto {
  initData: string;
  fingerprint: string;
  deviceModel?: string;
  os?: string;
  browser?: string;
  ipAddress?: string;
}

export function hashAdminSessionToken(token: string): string {
  const pepper = requiredEnv('ADMIN_SESSION_PEPPER', process.env.JWT_SECRET || 'dev-admin-session-pepper');
  return crypto.createHmac('sha256', pepper).update(token).digest('hex');
}

@Injectable()
export class AdminAuthService implements OnModuleInit {
  private readonly superAdminTelegramIds: Set<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: OperationalAuditService,
    private readonly authVerification: AuthVerificationService,
  ) {
    const rawEnv = isProduction()
      ? requiredEnv('SUPER_ADMIN_TELEGRAM_IDS')
      : process.env.SUPER_ADMIN_TELEGRAM_IDS || '';
    this.superAdminTelegramIds = new Set(
      rawEnv.split(',').map((id) => id.trim()).filter(Boolean)
    );
  }

  async onModuleInit() {
    // Bootstrap Super Admin users from environment if needed
    try {
      await this.verifyAndBootstrapEnvironmentSuperAdmins();
    } catch (err: any) {
      console.warn('Environment Super Admin bootstrap check complete:', err?.message);
    }
  }

  private async verifyAndBootstrapEnvironmentSuperAdmins() {
    for (const tgId of this.superAdminTelegramIds) {
      const username = `admin_tg_${tgId}`;
      const email = `admin_${tgId}@titanstream.internal`;

      const existing = await this.prisma.adminUser.findFirst({
        where: { OR: [{ username }, { email }] },
      });

      if (!existing) {
        await this.prisma.adminUser.create({
          data: {
            username,
            email,
            passwordHash: 'TELEGRAM_AUTH_ONLY', // Zero password login allowed
            role: AdminRole.SUPER_ADMIN,
            isActive: true,
          },
        });
      }
    }
  }

  /**
   * Telegram-native Passwordless Administrator Authentication
   */
  async loginWithTelegram(dto: TelegramAdminLoginDto) {
    // 1. Verify Telegram signature
    let verified;
    try {
      verified = this.authVerification.verify(dto.initData);
    } catch (err) {
      throw new UnauthorizedException('INVALID_TELEGRAM_AUTHENTICATION');
    }

    const tgIdStr = verified.telegramId.toString();
    const isSuperAdminEnv = this.superAdminTelegramIds.has(tgIdStr);

    // 2. Find or bootstrap AdminUser
    const username = `admin_tg_${tgIdStr}`;
    let admin = await this.prisma.adminUser.findFirst({
      where: { username },
    });

    if (!admin && isSuperAdminEnv) {
      admin = await this.prisma.adminUser.create({
        data: {
          username,
          email: `${username}@titanstream.internal`,
          passwordHash: 'TELEGRAM_AUTH_ONLY',
          role: AdminRole.SUPER_ADMIN,
          isActive: true,
        },
      });
    }

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('UNAUTHORIZED_ADMINISTRATOR_ACCESS');
    }

    // 3. Track / Update Trusted Device
    const fingerprint = dto.fingerprint || 'unknown_device_fingerprint';
    const ipAddress = dto.ipAddress || '127.0.0.1';

    await this.prisma.adminDevice.upsert({
      where: {
        adminUserId_fingerprint: {
          adminUserId: admin.id,
          fingerprint,
        },
      },
      update: {
        lastIp: ipAddress,
        lastSeenAt: new Date(),
        os: dto.os,
        browser: dto.browser,
        deviceModel: dto.deviceModel,
      },
      create: {
        adminUserId: admin.id,
        fingerprint,
        lastIp: ipAddress,
        os: dto.os,
        browser: dto.browser,
        deviceModel: dto.deviceModel,
        isTrusted: true,
      },
    });

    // 4. Create Session
    const token = `adm_sess_${crypto.randomBytes(32).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const session = await this.prisma.adminSession.create({
      data: {
        adminUserId: admin.id,
        tokenHash: hashAdminSessionToken(token),
        expiresAt,
      },
    });

    await this.auditService.logAction({
      actorId: admin.id,
      actorRole: admin.role,
      action: 'ADMIN_TELEGRAM_LOGIN',
      entity: 'ADMIN_USER',
      entityId: admin.id,
      metadata: {
        telegramId: tgIdStr,
        ipAddress,
        fingerprint,
      },
    });

    return {
      token,
      expiresAt: session.expiresAt.toISOString(),
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        permissions: ROLE_PERMISSIONS_MAP[admin.role as keyof typeof ROLE_PERMISSIONS_MAP] || [],
      },
    };
  }

  /**
   * Terminate a session (self or Super Admin remote termination)
   */
  async revokeSession(sessionId: string, actorId: string, isSuperAdmin: boolean) {
    const session = await this.prisma.adminSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new BadRequestException('SESSION_NOT_FOUND');

    if (session.adminUserId !== actorId && !isSuperAdmin) {
      throw new UnauthorizedException('CANNOT_REVOKE_OTHER_ADMIN_SESSION');
    }

    await this.prisma.adminSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    await this.auditService.logAction({
      actorId,
      actorRole: 'ADMIN',
      action: 'ADMIN_SESSION_REVOKED',
      entity: 'ADMIN_SESSION',
      entityId: sessionId,
    });

    return { status: 'SESSION_REVOKED' };
  }

  async revokeToken(rawToken: string, actorId: string) {
    const tokenHash = hashAdminSessionToken(rawToken);
    const session = await this.prisma.adminSession.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gte: new Date() },
      },
    });
    if (!session) throw new BadRequestException('SESSION_NOT_FOUND');
    return this.revokeSession(session.id, actorId, false);
  }

  /**
   * List active sessions for an administrator or all administrators
   */
  async getActiveSessions(adminUserId?: string) {
    return this.prisma.adminSession.findMany({
      where: {
        ...(adminUserId ? { adminUserId } : {}),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        adminUser: {
          select: { id: true, username: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMe(adminId: string) {
    const user = await this.prisma.adminUser.findUnique({ where: { id: adminId } });
    if (!user) throw new UnauthorizedException('ADMIN_NOT_FOUND');

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions: ROLE_PERMISSIONS_MAP[user.role as keyof typeof ROLE_PERMISSIONS_MAP] || [],
    };
  }
}
