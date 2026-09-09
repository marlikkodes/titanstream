import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import { OperationalAuditService } from './operational-audit.service';

export interface CreateConfirmationTokenDto {
  adminUserId: string;
  actionType: 'WITHDRAWAL_APPROVAL' | 'SYSTEM_CONFIG' | 'EMERGENCY_KILL' | 'TREASURY_ADJUST' | 'ADMIN_MODIFICATION';
  actionPayload: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

function hashConfirmationToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class DualAuthorizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: OperationalAuditService,
  ) {}

  /**
   * Generates a short-lived single-use confirmation token for sensitive administrative actions.
   */
  async createToken(dto: CreateConfirmationTokenDto) {
    const token = `cfm_${crypto.randomBytes(32).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

    const record = await this.prisma.telegramConfirmationToken.create({
      data: {
        token: hashConfirmationToken(token),
        adminUserId: dto.adminUserId,
        actionType: dto.actionType,
        actionPayload: dto.actionPayload,
        status: 'PENDING',
        expiresAt,
      },
    });

    await this.auditService.logAction({
      actorId: dto.adminUserId,
      actorRole: 'ADMIN',
      action: 'DUAL_AUTH_TOKEN_CREATED',
      entity: 'CONFIRMATION_TOKEN',
      entityId: record.id,
      metadata: {
        actionType: dto.actionType,
        expiresAt: expiresAt.toISOString(),
      },
    });

    return {
      tokenId: record.id,
      token,
      expiresAt: record.expiresAt.toISOString(),
      status: record.status,
    };
  }

  /**
   * Verifies if a token has been confirmed via Telegram bot and is valid for execution.
   */
  async verifyAndConsumeToken(
    tokenStr: string,
    adminUserId: string,
    expected?: Pick<CreateConfirmationTokenDto, 'actionType' | 'actionPayload'>,
  ): Promise<boolean> {
    const record = await this.prisma.telegramConfirmationToken.findUnique({
      where: { token: hashConfirmationToken(tokenStr) },
    });

    if (!record) {
      throw new BadRequestException('INVALID_CONFIRMATION_TOKEN');
    }

    if (record.adminUserId !== adminUserId) {
      throw new UnauthorizedException('TOKEN_ADMIN_MISMATCH');
    }

    if (expected && record.actionType !== expected.actionType) {
      throw new UnauthorizedException('TOKEN_ACTION_MISMATCH');
    }

    if (expected) {
      const payload = record.actionPayload as Record<string, unknown>;
      const matchesPayload = Object.entries(expected.actionPayload).every(
        ([key, value]) => payload[key] === value,
      );
      if (!matchesPayload) {
        throw new UnauthorizedException('TOKEN_ACTION_PAYLOAD_MISMATCH');
      }
    }

    if (record.expiresAt < new Date()) {
      await this.prisma.telegramConfirmationToken.update({
        where: { id: record.id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('CONFIRMATION_TOKEN_EXPIRED');
    }

    if (record.status === 'REJECTED') {
      throw new BadRequestException('CONFIRMATION_TOKEN_REJECTED');
    }

    if (record.status !== 'CONFIRMED') {
      throw new BadRequestException('CONFIRMATION_TOKEN_NOT_CONFIRMED_YET');
    }

    // Single-use: Mark consumed
    await this.prisma.telegramConfirmationToken.update({
      where: { id: record.id },
      data: { status: 'CONSUMED' },
    });

    await this.auditService.logAction({
      actorId: adminUserId,
      actorRole: 'ADMIN',
      action: 'DUAL_AUTH_TOKEN_CONSUMED',
      entity: 'CONFIRMATION_TOKEN',
      entityId: record.id,
      metadata: { actionType: record.actionType },
    });

    return true;
  }

  /**
   * Callback handler when admin clicks Confirm or Reject in Telegram Bot
   */
  async handleTelegramCallback(tokenStr: string, isConfirmed: boolean, telegramUserId: bigint) {
    const record = await this.prisma.telegramConfirmationToken.findUnique({
      where: { token: hashConfirmationToken(tokenStr) },
    });

    if (!record) return { success: false, reason: 'TOKEN_NOT_FOUND' };

    if (record.expiresAt < new Date()) {
      await this.prisma.telegramConfirmationToken.update({
        where: { id: record.id },
        data: { status: 'EXPIRED' },
      });
      return { success: false, reason: 'TOKEN_EXPIRED' };
    }

    const newStatus = isConfirmed ? 'CONFIRMED' : 'REJECTED';
    await this.prisma.telegramConfirmationToken.update({
      where: { id: record.id },
      data: {
        status: newStatus,
        confirmedAt: new Date(),
      },
    });

    await this.auditService.logAction({
      actorId: record.adminUserId,
      actorRole: 'ADMIN',
      action: isConfirmed ? 'DUAL_AUTH_CONFIRMED' : 'DUAL_AUTH_REJECTED',
      entity: 'CONFIRMATION_TOKEN',
      entityId: record.id,
      metadata: { telegramUserId: telegramUserId.toString() },
    });

    return { success: true, status: newStatus, actionType: record.actionType };
  }
}
