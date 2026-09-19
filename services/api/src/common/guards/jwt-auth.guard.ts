import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ServiceUnavailableException,
  HttpException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const url = request.url || '';
    if (isPublic || url.includes('/admin/') || url.includes('/admin-auth/')) return true;

    const authHeader = request.headers.authorization || request.headers.Authorization;

    if (!authHeader) {
      throw new UnauthorizedException({ code: 'TOKEN_MISSING', message: 'Authorization header required' });
    }

    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : String(authHeader);

    try {
      let payload: any = {};
      try {
        payload = this.jwtService.verify(token);
      } catch {
        throw new UnauthorizedException({ code: 'TOKEN_INVALID', message: 'Invalid JWT signature' });
      }

      const subStr = String(payload.sub || payload.userId || '').trim();
      let user: any = null;

      try {
        if (subStr) {
          if (/^\d+$/.test(subStr)) {
            user = await this.prisma.user.findUnique({ where: { telegramUserId: BigInt(subStr) } });
          } else {
            user = (await this.prisma.user.findUnique({ where: { id: subStr } })) ||
                   (await this.prisma.user.findFirst({ where: { identityId: subStr } }));
          }
        }
        if (!user && payload.telegramUserId) {
          const rawTgId = String(payload.telegramUserId).trim();
          if (/^\d+$/.test(rawTgId)) {
            user = await this.prisma.user.findUnique({ where: { telegramUserId: BigInt(rawTgId) } });
          }
        }
      } catch (dbErr: any) {
        throw new ServiceUnavailableException({
          code: 'DATABASE_UNAVAILABLE',
          message: 'Database unavailable during identity validation',
        });
      }

      if (!user) {
        throw new UnauthorizedException({
          code: 'USER_NOT_FOUND',
          message: 'Authenticated user does not exist in database',
        });
      }

      const canonicalUserId = user.id;
      const universalIdentityId = user.identityId || user.id;
      const legacyTelegramUserId = user.telegramUserId
        ? user.telegramUserId.toString()
        : (payload.telegramUserId ? String(payload.telegramUserId) : undefined);
      const userState = user.state;

      const identityContext = {
        userId: canonicalUserId,
        universalIdentityId,
        channel: payload.provider || 'TELEGRAM',
        channelIdentityId: payload.channelIdentityId || canonicalUserId,
        providerSubject: payload.providerSubject || legacyTelegramUserId || canonicalUserId,
        assuranceLevel: payload.assuranceLevel || 'HIGH',
        role: payload.role || 'USER',
        userState,
        telegramUserId: user.telegramUserId || (legacyTelegramUserId && /^\d+$/.test(legacyTelegramUserId) ? BigInt(legacyTelegramUserId) : undefined),
      };

      request.identity = identityContext;
      request.user = {
        ...identityContext,
        id: canonicalUserId,
        sub: canonicalUserId,
        titanUserId: canonicalUserId,
        telegramUserId: legacyTelegramUserId,
      };
      return true;
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new UnauthorizedException({ code: error.code || 'TOKEN_INVALID', message: error.message });
    }
  }
}
