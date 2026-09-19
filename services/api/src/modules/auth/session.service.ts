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

    if (this.prisma?.user) {
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
    }

    if (!user) {
      throw new UnauthorizedException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    return {
      telegramUserId: user.telegramUserId || BigInt(0),
      role: payload.role || 'USER',
      state: user.state || 'READY',
    };
  }
}
