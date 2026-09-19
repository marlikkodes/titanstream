import { Controller, Post, Get, Body, Req, UseGuards, HttpCode, HttpStatus, ForbiddenException, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AuthTelegramDto } from './dto/auth-telegram.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CanonicalUserId } from '../../common/decorators/canonical-user-id.decorator';
import { IdentityProvider } from '@prisma/client';

import { WebAuthSessionService } from './web-auth-session.service';
import { WhatsappChallengeService } from './whatsapp-challenge.service';
import { IdentityMasterEngineService } from '../identity/identity-master.service';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly webAuthSessionService: WebAuthSessionService,
    private readonly whatsappChallengeService: WhatsappChallengeService,
    private readonly identityMasterEngine: IdentityMasterEngineService,
  ) {}

  @Public()
  @Post('telegram')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate via Telegram initData' })
  @ApiResponse({ status: 200, description: 'Authentication successful' })
  @ApiResponse({ status: 401, description: 'Invalid initData' })
  async authenticate(@Body() dto: AuthTelegramDto, @Req() req: any) {
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.authService.authenticate(dto.initData, ipAddress, userAgent);
  }

  @Public()
  @Post('web-session/create')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create a Web Auth Deep Link session' })
  async createWebSession() {
    return { success: true, data: this.webAuthSessionService.createWebAuthSession() };
  }

  @Public()
  @Post('web-session/poll')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Poll status of Web Auth Deep Link session' })
  async pollWebSession(@Body('sessionCode') sessionCode: string) {
    return { success: true, data: this.webAuthSessionService.pollWebAuthSession(sessionCode) };
  }

  @Public()
  @Post('telegram-nonce')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate a random cryptographic nonce for Telegram login authentication' })
  async getTelegramNonce() {
    return { success: true, data: this.authService.createTelegramNonce() };
  }

  @Public()
  @Post('telegram-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate via Telegram Login Library / Token' })
  @ApiResponse({ status: 200, description: 'Authentication successful' })
  @ApiResponse({ status: 401, description: 'Invalid Telegram authentication payload or nonce' })
  async authenticateWebLogin(@Body() payload: any, @Req() req: any) {
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.authService.authenticateWebLogin(payload, ipAddress, userAgent);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshTokens(refreshToken);
  }

  @UseGuards(AuthGuard)
  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@CanonicalUserId() userId: string) {
    return this.authService.getProfile(userId);
  }

  @UseGuards(AuthGuard)
  @Get('verify-identity')
  @ApiOperation({ summary: 'Verify canonical identity mapping for current session' })
  @ApiResponse({ status: 200, description: 'Identity verified successfully' })
  @ApiResponse({ status: 401, description: 'Identity verification failed' })
  async verifyIdentity(@CanonicalUserId() userId: string) {
    return this.authService.verifyIdentity(userId);
  }

  @Public()
  @Post('whatsapp/login-challenge')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create a WhatsApp browser login challenge with QR/PIN and deep link' })
  async createWhatsAppChallenge(@Req() req: any, @Body() body: any) {
    const userAgent = req.headers['user-agent'] || 'Browser';
    const info = body?.deviceInfo || userAgent;
    return this.whatsappChallengeService.createChallenge(info);
  }

  @Public()
  @Post('whatsapp/challenge-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Poll status of a WhatsApp browser login challenge' })
  async pollWhatsAppChallengeStatus(@Body() body: any) {
    const challengeId = body?.challengeId;
    return this.whatsappChallengeService.getChallengeStatus(challengeId, body?.browserProof);
  }

  @Public()
  @Post('whatsapp/request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a 6-digit WhatsApp OTP verification code' })
  async requestWhatsAppOtp(@Body('phone') phone: string) {
    return this.authService.requestWhatsAppOtp(phone);
  }

  @Public()
  @Post('whatsapp/verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify WhatsApp OTP code and issue session tokens' })
  async verifyWhatsAppOtp(@Body() body: { phone: string; code: string }, @Req() req: any) {
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.authService.verifyWhatsAppOtp(body.phone, body.code, ipAddress, userAgent);
  }

  @UseGuards(AuthGuard)
  @Post('step-up/challenge')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request high-assurance step-up re-authentication challenge' })
  async requestStepUpChallenge(@Req() req: any) {
    const userId = req.user.id || req.user.titanUserId || req.user.sub;
    return this.authService.requestStepUpChallenge(userId);
  }

  @UseGuards(AuthGuard)
  @Post('step-up/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify step-up challenge and obtain 5-minute X-StepUp-Token' })
  async verifyStepUpChallenge(@Req() req: any, @Body('code') code: string) {
    const userId = req.user.id || req.user.titanUserId || req.user.sub;
    return this.authService.verifyStepUpChallenge(userId, code);
  }

  @UseGuards(AuthGuard)
  @Post('reconcile-identity')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reconcile duplicate identities created by old fallback system (ADMIN ONLY)' })
  @ApiResponse({ status: 200, description: 'Identity reconciliation successful' })
  @ApiResponse({ status: 401, description: 'Unauthorized - admin access required' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 404, description: 'No identities found to reconcile' })
  async reconcileIdentity(@Req() req: any, @Body() body: { provider: IdentityProvider; identifier: string }) {
    // Require admin role for identity reconciliation
    const userRole = req.user?.role || req.user?.state;
    if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException('IDENTITY_RECONCILIATION_FORBIDDEN: Admin access required');
    }
    
    // Log admin action for audit trail
    this.logger.log(`[IDENTITY_RECONCILIATION] Admin ${req.user?.userId} initiating reconciliation for ${body.provider}:${body.identifier}`);
    
    return { success: true, data: await this.identityMasterEngine.reconcileDuplicateIdentities(body.provider, body.identifier) };
  }
}
