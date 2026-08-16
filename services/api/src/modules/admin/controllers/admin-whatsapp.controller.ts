import { Controller, Get, Post, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { RbacGuard } from '../guards/rbac.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { AdminPermission } from '../interfaces/admin-permissions.enum';
import { BaileysAccountManagerService } from '../../notification/baileys-account-manager.service';

@ApiTags('Admin WhatsApp Accounts')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard, RbacGuard)
@Controller('admin/whatsapp/accounts')
export class AdminWhatsappController {
  constructor(private readonly baileysAccountManager: BaileysAccountManagerService) {}

  @Get()
  @Permissions(AdminPermission.OPERATIONS_VIEW)
  @ApiOperation({ summary: 'List all managed Baileys transport accounts and health telemetry' })
  async listAccounts() {
    return { success: true, data: this.baileysAccountManager.listAccounts() };
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @Permissions(AdminPermission.OPERATIONS_CONTROL)
  @ApiOperation({ summary: 'Register a new Baileys transport account' })
  async addAccount(@Body() body: { phone: string; displayName?: string }) {
    return { success: true, data: await this.baileysAccountManager.addAccount(body.phone, body.displayName) };
  }

  @Post(':id/action')
  @HttpCode(HttpStatus.OK)
  @Permissions(AdminPermission.OPERATIONS_CONTROL)
  @ApiOperation({ summary: 'Execute administrative action on a Baileys transport account' })
  async executeAccountAction(
    @Param('id') accountId: string,
    @Body('action') action: 'connect' | 'disconnect' | 'reconnect' | 'enable' | 'disable' | 'quarantine' | 'unquarantine' | 'remove',
  ) {
    return { success: true, data: await this.baileysAccountManager.executeAccountAction(accountId, action) };
  }

  @Post(':id/pairing-code')
  @HttpCode(HttpStatus.OK)
  @Permissions(AdminPermission.OPERATIONS_CONTROL)
  @ApiOperation({ summary: 'Request an 8-digit pairing code for linking a WhatsApp phone number' })
  async requestPairingCode(@Param('id') accountId: string, @Body('phone') phone?: string) {
    return { success: true, data: await this.baileysAccountManager.requestPairingCode(accountId, phone) };
  }
}
