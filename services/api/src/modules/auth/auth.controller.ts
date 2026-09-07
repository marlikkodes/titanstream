import { Controller, Post, Get, Body, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AuthTelegramDto } from './dto/auth-telegram.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CanonicalUserId } from '../../common/decorators/canonical-user-id.decorator';

import { WebAuthSessionService } from './web-auth-session.service';
import { WhatsappChallengeService } from './whatsapp-challenge.service';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly webAuthSessionService: WebAuthSessionService,
    private readonly whatsappChallengeService: WhatsappChallengeService,
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
    return this.whatsappChallengeService.getChallengeStatus(challengeId);
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
}
