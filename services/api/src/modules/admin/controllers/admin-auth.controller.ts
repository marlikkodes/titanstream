import { Body, Controller, Get, Headers, Param, Post, UseGuards, Req } from '@nestjs/common';
import { CurrentAdmin, AuthenticatedAdmin } from '../decorators/current-admin.decorator';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { AdminAuthService, TelegramAdminLoginDto } from '../services/admin-auth.service';
import { DualAuthorizationService, CreateConfirmationTokenDto } from '../services/dual-authorization.service';
import { Request } from 'express';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly authService: AdminAuthService,
    private readonly dualAuthService: DualAuthorizationService,
  ) {}

  @Post('telegram-login')
  async telegramLogin(@Body() dto: TelegramAdminLoginDto, @Req() req: Request) {
    const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
    return this.authService.loginWithTelegram({
      ...dto,
      ipAddress,
    });
  }

  @Post('logout')
  @UseGuards(AdminAuthGuard)
  async logout(
    @Headers('authorization') authHeader: string,
    @Headers('x-admin-token') tokenHeader: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    const raw = authHeader || tokenHeader || '';
    const token = raw.startsWith('Bearer ') ? raw.slice(7) : raw;
    return this.authService.revokeToken(token, admin.id);
  }

  @Get('me')
  @UseGuards(AdminAuthGuard)
  async me(@CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.authService.getMe(admin.id);
  }

  @Get('sessions')
  @UseGuards(AdminAuthGuard)
  async getSessions(@CurrentAdmin() admin: AuthenticatedAdmin) {
    const isSuperAdmin = admin.role === 'SUPER_ADMIN';
    return this.authService.getActiveSessions(isSuperAdmin ? undefined : admin.id);
  }

  @Post('sessions/:id/revoke')
  @UseGuards(AdminAuthGuard)
  async revokeSession(@Param('id') sessionId: string, @CurrentAdmin() admin: AuthenticatedAdmin) {
    const isSuperAdmin = admin.role === 'SUPER_ADMIN';
    return this.authService.revokeSession(sessionId, admin.id, isSuperAdmin);
  }

  @Post('dual-auth/token')
  @UseGuards(AdminAuthGuard)
  async requestConfirmationToken(
    @Body() dto: Omit<CreateConfirmationTokenDto, 'adminUserId'>,
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Req() req: Request,
  ) {
    return this.dualAuthService.createToken({
      ...dto,
      adminUserId: admin.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('dual-auth/verify')
  @UseGuards(AdminAuthGuard)
  async verifyConfirmationToken(
    @Body('token') token: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    const isValid = await this.dualAuthService.verifyAndConsumeToken(token, admin.id);
    return { valid: isValid };
  }
}
