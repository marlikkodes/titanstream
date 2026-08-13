import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConsentService } from './consent.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CanonicalUserId } from '../../common/decorators/canonical-user-id.decorator';
import { RecordConsentDto } from './dto/record-consent.dto';
import { ConsentType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

@ApiTags('Consent')
@Controller('consent')
@UseGuards(AuthGuard)
export class ConsentController {
  constructor(private readonly consentService: ConsentService) {}

  @Get('required')
  @ApiOperation({ summary: 'Get list of required consents' })
  async getRequiredConsents() {
    return this.consentService.getRequiredConsents();
  }

  @Get('status')
  @ApiOperation({ summary: 'Get consent status for current user' })
  async getConsentStatus(@CanonicalUserId() userId: string) {
    return this.consentService.getConsentStatus(userId as any);
  }

  @Post(':type')
  @ApiOperation({ summary: 'Record a consent' })
  async recordConsent(
    @CanonicalUserId() userId: string,
    @Param('type') type: ConsentType,
    @Body() dto: RecordConsentDto,
  ) {
    return this.consentService.recordConsent(userId as any, type, dto);
  }

  @Post(':type/revoke')
  @ApiOperation({ summary: 'Revoke a previous consent' })
  async revokeConsent(
    @CanonicalUserId() userId: string,
    @Param('type') type: ConsentType,
  ) {
    return this.consentService.revokeConsent(userId as any, type);
  }
}