import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditEventType } from '../../common/interfaces/user-state.enum';

@Injectable()
export class UserPreferencesService {
  private readonly logger = new Logger(UserPreferencesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getPreferences(userKey: bigint | string) {
    const isUuid = typeof userKey === 'string' && userKey.includes('-');
    let user: any = null;

    if (isUuid) {
      user = await this.prisma.user.findUnique({ where: { id: userKey as string } });
    } else {
      const clean = String(userKey).trim();
      let telegramUserId: bigint | undefined;
      if (/^\d+$/.test(clean)) {
        try {
          telegramUserId = BigInt(clean);
        } catch {
          // ignore
        }
      }

      if (telegramUserId) {
        user = await this.prisma.user.findUnique({ where: { telegramUserId } });
      }

      if (!user) {
        const phoneFormatted = clean.startsWith('+') ? clean : '+' + clean;
        user = await this.prisma.user.findFirst({
          where: {
            OR: [
              { phoneNumber: clean },
              { phoneNumber: phoneFormatted },
              { id: clean },
            ],
          },
        });
      }
    }

    if (!user) {
      return {
        userId: String(userKey),
        authenticationMethod: 'WEB',
        notificationChannel: 'WEB',
        preferredShareChannel: 'WEB',
        settings: {},
      };
    }

    let prefs = await this.prisma.userPreferences.findFirst({
      where: { telegramUserId: user.telegramUserId || undefined },
    });

    if (!prefs) {
      this.logger.log(`Initializing default preferences for user ${user.id}`);
      prefs = await this.prisma.userPreferences.create({
        data: {
          telegramUserId: user.telegramUserId || BigInt(0),
          authenticationMethod: user.phoneNumber ? 'WHATSAPP' : 'TELEGRAM',
          notificationChannel: user.phoneNumber ? 'WHATSAPP' : 'TELEGRAM',
          preferredShareChannel: user.phoneNumber ? 'WHATSAPP' : 'TELEGRAM',
          settings: {},
        },
      });
    }

    return {
      userId: user.id,
      telegramUserId: prefs.telegramUserId ? prefs.telegramUserId.toString() : undefined,
      authenticationMethod: prefs.authenticationMethod,
      notificationChannel: prefs.notificationChannel,
      preferredShareChannel: prefs.preferredShareChannel,
      pushToken: prefs.pushToken,
      settings: prefs.settings || {},
    };
  }

  async updatePreferences(userKey: bigint | string, data: { settings?: any; notificationChannel?: any }) {
    const isUuid = typeof userKey === 'string' && userKey.includes('-');
    let user: any = null;

    if (isUuid) {
      user = await this.prisma.user.findUnique({ where: { id: userKey as string } });
    } else {
      const telegramUserId = typeof userKey === 'bigint' ? userKey : BigInt(userKey);
      user = await this.prisma.user.findUnique({ where: { telegramUserId } });
    }

    if (!user) throw new NotFoundException('USER_NOT_FOUND');

    let prefs = await this.prisma.userPreferences.findFirst({
      where: { telegramUserId: user.telegramUserId || undefined },
    });

    if (!prefs) {
      prefs = await this.prisma.userPreferences.create({
        data: {
          telegramUserId: user.telegramUserId || BigInt(0),
          authenticationMethod: 'TELEGRAM',
          notificationChannel: data.notificationChannel || 'TELEGRAM',
          preferredShareChannel: 'TELEGRAM',
          settings: data.settings || {},
        },
      });
    } else {
      const mergedSettings = {
        ...(prefs.settings as any || {}),
        ...(data.settings || {}),
      };

      prefs = await this.prisma.userPreferences.update({
        where: { id: prefs.id },
        data: {
          ...(data.notificationChannel && { notificationChannel: data.notificationChannel }),
          settings: mergedSettings,
        },
      });
    }

    if (user.telegramUserId) {
      await this.auditService.create({
        telegramUserId: user.telegramUserId,
        eventType: AuditEventType.USER_UPDATED,
        description: 'User settings preferences synchronized with backend',
        metadata: data,
      });
    }

    return {
      userId: user.id,
      telegramUserId: prefs.telegramUserId ? Number(prefs.telegramUserId) : undefined,
      authenticationMethod: prefs.authenticationMethod,
      notificationChannel: prefs.notificationChannel,
      preferredShareChannel: prefs.preferredShareChannel,
      pushToken: prefs.pushToken,
      settings: prefs.settings || {},
    };
  }
}
