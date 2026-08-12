import { Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Logger, Param, Query, Post } from '@nestjs/common';
import { Public } from '../../../common/decorators/public.decorator';
import { PesapalClient } from './pesapal.client';
import { PesapalCallbackQueryDto, PesapalIpnDto } from './pesapal.dto';
import { PesapalProvider } from './pesapal.provider';

@Controller(['settlement/pesapal', 'api/v1/settlement/pesapal'])
export class PesapalController {
  private readonly logger = new Logger(PesapalController.name);

  constructor(
    private readonly pesapalProvider: PesapalProvider,
    private readonly pesapalClient: PesapalClient,
  ) {}

  /**
   * Safe diagnostics endpoint (never returns secret keys or tokens).
   */
  @Get('diagnostics')
  getDiagnostics() {
    return this.pesapalClient.getDiagnostics();
  }

  /**
   * Provider health check endpoint. Probes Pesapal authentication
   * to determine operational status. Safe for admin dashboard consumption.
   */
  @Get('health')
  async getHealth() {
    return this.pesapalClient.checkHealth();
  }


  /**
   * Pesapal IPN callback endpoint (GET mode).
   * Pesapal sends OrderTrackingId, OrderNotificationType, OrderMerchantReference.
   */
  @Get('ipn')
  @Public()
  @HttpCode(HttpStatus.OK)
  async handleIpnGet(@Query() query: PesapalCallbackQueryDto) {
    const orderTrackingId = query.OrderTrackingId;
    const merchantRef = query.OrderMerchantReference;

    this.logger.log(`[PesapalIPN] GET IPN received: OrderTrackingId=${orderTrackingId}, MerchantRef=${merchantRef}`);

    if (!orderTrackingId || !merchantRef) {
      return { status: 'INVALID_IPN', message: 'Missing OrderTrackingId or OrderMerchantReference' };
    }

    const result = await this.pesapalProvider.handleIpn(orderTrackingId, merchantRef);
    return {
      orderNotificationType: query.OrderNotificationType || 'IPNCHANGE',
      orderTrackingId,
      orderMerchantReference: merchantRef,
      status: '200',
      resultStatus: result.status,
    };
  }

  /**
   * Pesapal IPN callback endpoint (POST mode).
   */
  @Post('ipn')
  @Public()
  @HttpCode(HttpStatus.OK)
  async handleIpnPost(@Body() body: PesapalIpnDto, @Query() query: PesapalCallbackQueryDto) {
    const orderTrackingId = body.OrderTrackingId || query.OrderTrackingId;
    const merchantRef = body.OrderMerchantReference || query.OrderMerchantReference;

    this.logger.log(`[PesapalIPN] POST IPN received: OrderTrackingId=${orderTrackingId}, MerchantRef=${merchantRef}`);

    if (!orderTrackingId || !merchantRef) {
      return { status: 'INVALID_IPN', message: 'Missing OrderTrackingId or OrderMerchantReference' };
    }

    const result = await this.pesapalProvider.handleIpn(orderTrackingId, merchantRef);
    return {
      orderNotificationType: body.OrderNotificationType || query.OrderNotificationType || 'IPNCHANGE',
      orderTrackingId,
      orderMerchantReference: merchantRef,
      status: '200',
      resultStatus: result.status,
    };
  }

  /**
   * User browser redirect completion callback endpoint.
   */
  @Get('callback')
  @Public()
  @HttpCode(HttpStatus.OK)
  async handleCallback(@Query() query: PesapalCallbackQueryDto) {
    const orderTrackingId = query.OrderTrackingId;
    const merchantRef = query.OrderMerchantReference;

    this.logger.log(`[PesapalCallback] User redirect callback: OrderTrackingId=${orderTrackingId}, MerchantRef=${merchantRef}`);

    if (orderTrackingId && merchantRef) {
      try {
        await this.pesapalProvider.handleIpn(orderTrackingId, merchantRef);
      } catch (err: any) {
        this.logger.warn(`[PesapalCallback] Error resolving callback status: ${err?.message}`);
      }
    }

    return {
      message: 'Payment verification completed. You may return to Titan Stream.',
      orderTrackingId,
      merchantReference: merchantRef,
    };
  }

  @Post('simulate-payment/:id')
  @Public()
  @HttpCode(HttpStatus.OK)
  async simulatePaymentPost(@Param('id') settlementId: string) {
    if (process.env.PESAPAL_ENVIRONMENT === 'production' || process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('SANDBOX_SIMULATOR_DISABLED: Developer simulation endpoint is strictly prohibited in production.');
    }
    this.logger.log(`[PesapalSandbox] Simulating successful payment for settlement ${settlementId}`);
    return this.pesapalProvider.simulatePayment(settlementId);
  }

  @Get('simulate-payment/:id')
  @Public()
  @HttpCode(HttpStatus.OK)
  async simulatePaymentGet(@Param('id') settlementId: string) {
    if (process.env.PESAPAL_ENVIRONMENT === 'production' || process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('SANDBOX_SIMULATOR_DISABLED: Developer simulation endpoint is strictly prohibited in production.');
    }
    this.logger.log(`[PesapalSandbox] Simulating successful payment for settlement ${settlementId}`);
    return this.pesapalProvider.simulatePayment(settlementId);
  }
}
