import { Controller, Get, Post, Patch, Delete, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UserService } from './user.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CanonicalUserId } from '../../common/decorators/canonical-user-id.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateAccountSetupDto } from './dto/account-setup.dto';

@ApiTags('Users')
@Controller()
@UseGuards(AuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(['users/me', 'user/profile'])
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@CanonicalUserId() userId: string) {
    return this.userService.getProfile(userId);
  }

  @Patch(['users/me', 'user/profile'])
  @ApiOperation({ summary: 'Update user profile' })
  async updateProfile(
    @CanonicalUserId() userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.userService.updateProfile(userId, dto);
  }

  @Get(['user/trust', 'user/trust-profile', 'user/trust/profile'])
  @ApiOperation({ summary: 'Get current user trust profile' })
  async getTrustProfile(@CanonicalUserId() userId: string) {
    return this.userService.getTrustProfile(userId);
  }

  @Post('users/me/phone')
  @ApiOperation({ summary: 'Update verified phone number' })
  async updatePhone(
    @CanonicalUserId() userId: string,
    @Body() body: { phoneNumber: string },
  ) {
    return this.userService.updateVerifiedPhoneNumber(userId, body.phoneNumber);
  }

  @Post('users/me/usdt-address')
  @ApiOperation({ summary: 'Update verified USDT address' })
  async updateUsdtAddress(
    @CanonicalUserId() userId: string,
    @Body() body: { address: string },
  ) {
    return this.userService.updateVerifiedUsdtAddress(userId, body.address);
  }

  @Post('users/me/withdrawal-phone')
  @ApiOperation({ summary: 'Update explicit Mobile Money Withdrawal Number' })
  async updateWithdrawalPhone(
    @CanonicalUserId() userId: string,
    @Body() body: { withdrawalPhoneNumber: string; phoneNumber?: string },
  ) {
    const raw = body.withdrawalPhoneNumber || body.phoneNumber || '';
    return this.userService.updateWithdrawalPhoneNumber(userId, raw);
  }

  @Get('users/me/account-setup')
  @ApiOperation({ summary: 'Get canonical Account Setup state (backend-authoritative completion)' })
  async getAccountSetup(@CanonicalUserId() userId: string) {
    return this.userService.getAccountSetup(userId);
  }

  @Patch('users/me/account-setup')
  @ApiOperation({ summary: 'Save Account Setup personalization (idempotent, canonical user only)' })
  async updateAccountSetup(@CanonicalUserId() userId: string, @Body() dto: UpdateAccountSetupDto) {
    return this.userService.updateAccountSetup(userId, dto);
  }

  @Delete(['users/me', 'user/delete'])
  @ApiOperation({ summary: 'Delete user account completely' })
  async deleteAccount(@CanonicalUserId() userId: string) {
    return this.userService.deleteAccount(userId);
  }
}
