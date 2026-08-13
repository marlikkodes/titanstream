import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
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
    if (isPublic) return true;

    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException({ code: 'TOKEN_MISSING', message: 'Authorization header required' });
    }

    const token = authHeader.substring(7);

    try {
      const payload = this.jwtService.verify(token);
      let user: any = null;
      let userState = payload.state || 'READY';

      const subStr = String(payload.sub || '');
      const isUuid = subStr.includes('-');

      try {
        if (isUuid) {
          // Look up user by identityId (UniversalIdentity.id)
          user = await this.prisma.user.findFirst({ where: { identityId: subStr } });
        }
        if (!user && (payload.telegramUserId || (!isUuid && subStr))) {
          const rawId = payload.telegramUserId || subStr;
          if (!isNaN(Number(rawId))) {
            const telegramUserId = BigInt(rawId);
            user = await this.prisma.user.findUnique({ where: { telegramUserId } });
          }
        }
        if (user) userState = user.state;
      } catch (dbErr) {
        // Fallback user state on database connection lag/blip
      }

      const canonicalTitanId = user?.identityId || (isUuid ? subStr : (payload.titanUserId || subStr));
      const legacyTelegramUserId = user ? user.telegramUserId.toString() : (payload.telegramUserId ? String(payload.telegramUserId) : (!isUuid ? subStr : undefined));

      request.user = {
        id: canonicalTitanId,
        sub: canonicalTitanId,
        titanUserId: canonicalTitanId,
        telegramUserId: legacyTelegramUserId,
        provider: payload.provider || 'TELEGRAM',
        state: userState,
        role: payload.role || 'USER',
      };
      return true;
    } catch (error: any) {
      throw new UnauthorizedException({ code: error.code || 'TOKEN_INVALID', message: error.message });
    }
  }
}
