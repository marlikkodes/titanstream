import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PaymentOrderService, CreatePaymentOrderDto } from './payment-order.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CanonicalUserId } from '../../common/decorators/canonical-user-id.decorator';
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
