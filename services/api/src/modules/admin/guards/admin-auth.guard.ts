import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { hashAdminSessionToken } from '../services/admin-auth.service';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'] || request.headers['x-admin-token'];

    if (!authHeader) {
      throw new UnauthorizedException('MISSING_ADMIN_AUTH_TOKEN');
    }

    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    let session = null;
    try {
      const tokenHash = hashAdminSessionToken(String(token));
      session = await this.prisma.adminSession.findFirst({
        where: {
          tokenHash,
          revokedAt: null,
          expiresAt: { gte: new Date() },
        },
        include: { adminUser: true },
      });
    } catch {
      session = null;
    }

    if (session && session.adminUser && session.adminUser.isActive) {
      request.admin = {
        id: session.adminUser.id,
        username: session.adminUser.username,
        email: session.adminUser.email,
        role: session.adminUser.role,
      };
      return true;
    }

    throw new UnauthorizedException('INVALID_OR_EXPIRED_ADMIN_SESSION');
  }
}
