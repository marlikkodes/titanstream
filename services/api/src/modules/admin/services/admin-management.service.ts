import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AdminRole } from '@prisma/client';

export interface AdminAccountRecord {
  id: string;
  telegramUserId: string;
  name: string;
  role: AdminRole;
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  permissions: string[];
  lastLoginAt: string;
  createdAt: string;
}

@Injectable()
export class AdminManagementService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminAccounts(): Promise<AdminAccountRecord[]> {
    const users = await this.prisma.adminUser.findMany({
      orderBy: { createdAt: 'desc' },
    });

    if (users.length === 0) {
      // Return authoritative empty array if no admin users present in DB
      return [];
    }

    return users.map((u) => ({
      id: u.id,
      telegramUserId: u.username,
      name: u.username,
      role: u.role,
      status: u.isActive ? 'ACTIVE' : 'SUSPENDED',
      permissions: [u.role],
      lastLoginAt: u.updatedAt.toISOString(),
      createdAt: u.createdAt.toISOString(),
    }));
  }

  async inviteAdmin(dto: { telegramUserId: string; channelUserId?: string; name?: string; role?: AdminRole }): Promise<AdminAccountRecord> {
    const cleanName = dto.name?.trim() || `Admin_${dto.telegramUserId}`;
    const username = `${cleanName.toLowerCase().replace(/\s+/g, '_')}_${dto.telegramUserId}`;
    const email = `${username}@titanstream.io`;

    const user = await this.prisma.adminUser.create({
      data: {
        username,
        email,
        passwordHash: 'TELEGRAM_AUTH_ONLY',
        role: dto.role || AdminRole.OPERATIONS_ADMIN,
        isActive: true,
      },
    });

    return {
      id: user.id,
      telegramUserId: dto.telegramUserId,
      name: cleanName,
      role: user.role,
      status: user.isActive ? 'ACTIVE' : 'SUSPENDED',
      permissions: [user.role],
      lastLoginAt: user.createdAt.toISOString(),
      createdAt: user.createdAt.toISOString(),
    };
  }

  async updateAdminRole(id: string, role: AdminRole): Promise<AdminAccountRecord> {
    const user = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('ADMIN_NOT_FOUND');

    const updated = await this.prisma.adminUser.update({
      where: { id },
      data: { role },
    });

    return {
      id: updated.id,
      telegramUserId: updated.username,
      name: updated.username,
      role: updated.role,
      status: updated.isActive ? 'ACTIVE' : 'SUSPENDED',
      permissions: [updated.role],
      lastLoginAt: updated.updatedAt.toISOString(),
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async toggleAdminStatus(id: string, status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED'): Promise<AdminAccountRecord> {
    const user = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('ADMIN_NOT_FOUND');

    const isActive = status === 'ACTIVE';
    const updated = await this.prisma.adminUser.update({
      where: { id },
      data: { isActive },
    });

    return {
      id: updated.id,
      telegramUserId: updated.username,
      name: updated.username,
      role: updated.role,
      status: updated.isActive ? 'ACTIVE' : 'SUSPENDED',
      permissions: [updated.role],
      lastLoginAt: updated.updatedAt.toISOString(),
      createdAt: updated.createdAt.toISOString(),
    };
  }
}
