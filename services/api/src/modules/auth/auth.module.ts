import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { WebAuthSessionService } from './web-auth-session.service';
import { TelegramAuthService } from './strategies/telegram-auth.service';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../../database/prisma.module';
import { requiredEnv } from '../../common/config/env.util';

import { AuthVerificationService } from './auth-verification.service';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [
    PrismaModule,
    IdentityModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || requiredEnv('JWT_SECRET', 'dev-jwt-secret'),
      signOptions: { expiresIn: '15m' },
    }),
    AuditModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    WebAuthSessionService,
    AuthVerificationService,
    {
      provide: TelegramAuthService,
      useFactory: () => {
        const botToken = process.env.TELEGRAM_BOT_TOKEN || requiredEnv('TELEGRAM_BOT_TOKEN', '');
        return new TelegramAuthService(botToken);
      },
    },
  ],
  exports: [AuthService, WebAuthSessionService, AuthVerificationService, JwtModule],
})
export class AuthModule {}
