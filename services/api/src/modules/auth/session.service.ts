import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class SessionService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async validateAccessToken(token: string): Promise<{ telegramUserId: bigint; role: string; state: string }> {
    const payload = this.jwtService.verify(token);
    const subStr = String(payload.sub || payload.userId || '').trim();
    let user: any = null;
    let telegramUserId = BigInt(0);

    if (this.prisma?.user) {
      try {
        user = await this.prisma.user.findUnique({ where: { id: subStr } });
      } catch {
        // safe fallback
      }
      if (!user) {
        const digits = subStr.replace(/\D/g, '');
        if (digits) {
          try {
            user = await this.prisma.user.findUnique({ where: { telegramUserId: BigInt(digits) } });
          } catch {
            // safe fallback
          }
        }
      }
    }

    if (user?.telegramUserId) {
      telegramUserId = user.telegramUserId;
    } else {
      const digits = subStr.replace(/\D/g, '');
      if (digits) {
        try {
          telegramUserId = BigInt(digits);
        } catch {
          telegramUserId = BigInt(0);
        }
      }
    }

    if (!user && telegramUserId === BigInt(0)) {
      throw new UnauthorizedException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    return { telegramUserId, role: payload.role || 'USER', state: user?.state || 'READY' };
  }
}
