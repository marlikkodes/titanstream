import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PaymentOrderService, CreatePaymentOrderDto } from './payment-order.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CanonicalUserId } from '../../common/decorators/canonical-user-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminAuthGuard } from '../admin/guards/admin-auth.guard';
import { CurrentAdmin, AuthenticatedAdmin } from '../admin/decorators/current-admin.decorator';

@ApiTags('Payment Orders - LEGACY')
@Controller('payment-orders')
export class PaymentOrderController {
  constructor(private readonly service: PaymentOrderService) {}

  @Get('destinations')
  @ApiOperation({ summary: 'Get active Mobile Money receiving destinations & USSD templates' })
  getDestinations() {
    return {
      success: true,
      data: this.service.getDestinationConfigs(),
    };
  }

  @Get('my')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'List current user payment orders (newest first)' })
  async getMyOrders(@CurrentUser() user: any) {
    const data = await this.service.listMyOrders(this.service.resolveTelegramUserId(user));
    return {
      success: true,
      data,
    };
  }

  @Get('admin/list')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Admin list recent payment orders' })
  async adminListOrders(@Query('limit') limit?: string) {
    const parsed = limit ? parseInt(limit, 10) : 100;
    const data = await this.service.adminListOrders(Number.isFinite(parsed) ? parsed : 100);
    return {
      success: true,
      data,
    };
  }

  @Post(':id/verify')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Submit own payment order for verification after paying' })
  async submitForVerification(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body?: any,
  ) {
    const data = await this.service.submitForVerification(
      id,
      this.service.resolveTelegramUserId(user),
      body?.reference,
    );
    return {
      success: true,
      data,
    };
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get own payment order by id or reference code' })
  async getOrder(@Param('id') id: string, @CurrentUser() user: any) {
    const data = await this.service.getOrderForUser(id, this.service.resolveTelegramUserId(user));
    return {
      success: true,
      data,
    };
  }

  @Post('admin/destinations/:id')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Admin update receiving destination configuration or USSD template' })
  adminUpdateDestination(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const cfg = this.service.updateDestinationConfig(id, body);
    return {
      success: true,
      data: cfg,
    };
  }
}
