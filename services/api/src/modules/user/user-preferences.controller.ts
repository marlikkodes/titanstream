import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UserPreferencesService } from './user-preferences.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CanonicalUserId } from '../../common/decorators/canonical-user-id.decorator';

@ApiTags('User Preferences')
@Controller('user/preferences')
@UseGuards(AuthGuard)
export class UserPreferencesController {
  constructor(private readonly preferencesService: UserPreferencesService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user settings preferences' })
  async getPreferences(@CanonicalUserId() userId: string) {
    return this.preferencesService.getPreferences(userId);
  }

  @Patch()
  @ApiOperation({ summary: 'Update user settings preferences' })
  async updatePreferences(
    @CanonicalUserId() userId: string,
    @Body() dto: { settings?: any; notificationChannel?: any },
  ) {
    return this.preferencesService.updatePreferences(userId, dto);
  }
}
