import { Injectable, Logger, BadGatewayException, UnauthorizedException } from '@nestjs/common';
import {
  PesapalAuthResponse,
  PesapalEnvironment,
  PesapalIpnRegisterPayload,
  PesapalIpnRegisterResponse,
  PesapalOrderRequestPayload,
  PesapalOrderResponse,
  PesapalTransactionStatusResponse,
} from './pesapal.types';

@Injectable()
export class PesapalClient {
  private readonly logger = new Logger(PesapalClient.name);

  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  private get environment(): PesapalEnvironment {
    const env = (process.env.PESAPAL_ENVIRONMENT as PesapalEnvironment) || 'sandbox';
    return env;
  }

  private get baseUrl(): string {
    if (process.env.PESAPAL_BASE_URL) {
      return process.env.PESAPAL_BASE_URL.replace(/\/+$/, '');
    }
    return this.environment === 'production'
      ? 'https://pay.pesapal.com/v3'
      : 'https://cybqa.pesapal.com/pesapalv3';
  }

  private get consumerKey(): string {
    return process.env.PESAPAL_CONSUMER_KEY || '';
  }

  private get consumerSecret(): string {
    return process.env.PESAPAL_CONSUMER_SECRET || '';
  }

  private get configuredIpnId(): string {
    return process.env.PESAPAL_IPN_ID || '';
  }

  /**
   * Fail closed if configuration environment and base URL are inconsistent.
   * Ensures sandbox mode uses cybqa sandbox URL and production mode uses pay.pesapal.com URL.
   */
  private assertValidEnvironment() {
    if (this.environment === 'sandbox' && this.baseUrl.includes('pay.pesapal.com')) {
      throw new BadGatewayException('PESAPAL_ENVIRONMENT_MISMATCH: Production base URL detected while in Sandbox mode.');
    }
    if (this.environment === 'production' && this.baseUrl.includes('cybqa.pesapal.com')) {
      throw new BadGatewayException('PESAPAL_ENVIRONMENT_MISMATCH: Sandbox base URL detected while in Production mode.');
    }
  }

  /**
   * Check whether Pesapal credentials are present in runtime environment.
   */
  isConfigured(): boolean {
    return Boolean(this.consumerKey && this.consumerSecret);
  }

  /**
   * Safe status check (never leaks secrets).
   */
  getDiagnostics() {
    return {
      configured: this.isConfigured(),
      environment: this.environment,
      baseUrl: this.baseUrl,
      hasIpnId: Boolean(this.configuredIpnId),
    };
  }

  /**
   * Authenticate with Pesapal v3 Sandbox API and retrieve bearer access token.
   * Token is cached until 1 minute before expiry.
   */
  async getAuthToken(): Promise<string> {
    this.assertValidEnvironment();

    if (!this.isConfigured()) {
      this.logger.warn('[PesapalClient] Missing Pesapal consumer key or secret');
      throw new UnauthorizedException('Pesapal sandbox credentials are not configured in the runtime environment.');
    }

    const now = Date.now();
    if (this.cachedToken && now < this.tokenExpiresAt - 60000) {
      return this.cachedToken;
    }

    const url = `${this.baseUrl}/api/Auth/RequestToken`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          consumer_key: this.consumerKey,
          consumer_secret: this.consumerSecret,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const resJson = (await response.json()) as PesapalAuthResponse;
      if (!resJson.token) {
        const errMsg = resJson.error?.message || resJson.message || 'Token absent in Pesapal auth response';
        throw new Error(`Authentication failed: ${errMsg}`);
      }

      this.cachedToken = resJson.token;
      const expiryMs = resJson.expiryDate ? new Date(resJson.expiryDate).getTime() : now + 300000;
      this.tokenExpiresAt = Number.isNaN(expiryMs) || expiryMs <= now ? now + 300000 : expiryMs;

      this.logger.log(`[PesapalClient] Authentication successful. Token cached for environment=${this.environment}`);
      return this.cachedToken;
    } catch (err: any) {
      this.logger.error(`[PesapalClient] Auth failed: ${err?.message}`);
      this.cachedToken = null;
      this.tokenExpiresAt = 0;
      throw new BadGatewayException('PESAPAL_AUTH_FAILED: Provider authentication failed.');
    }
  }

  /**
   * Register IPN URL with Pesapal v3 API to obtain an IPN ID.
   */
  async registerIpnUrl(callbackUrl: string): Promise<string> {
    const token = await this.getAuthToken();
    const url = `${this.baseUrl}/api/URLSetup/RegisterIPN`;

    const payload: PesapalIpnRegisterPayload = {
      url: callbackUrl,
      ipn_notification_type: 'GET',
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const resJson = (await response.json()) as PesapalIpnRegisterResponse;
      if (!resJson.ipn_id) {
        const errMsg = resJson.error?.message || 'IPN registration returned no ipn_id';
        throw new Error(errMsg);
      }

      this.logger.log(`[PesapalClient] Registered IPN URL: ipnId=${resJson.ipn_id}`);
      return resJson.ipn_id;
    } catch (err: any) {
      this.logger.error(`[PesapalClient] RegisterIPN failed: ${err?.message}`);
      throw new BadGatewayException(`PESAPAL_IPN_REGISTRATION_FAILED: ${err?.message}`);
    }
  }

  /**
   * Get configured IPN ID or register callbackUrl if none configured.
   */
  async getIpnId(fallbackCallbackUrl?: string): Promise<string> {
    if (this.configuredIpnId) {
      return this.configuredIpnId;
    }
    if (fallbackCallbackUrl) {
      return this.registerIpnUrl(fallbackCallbackUrl);
    }
    throw new BadGatewayException('PESAPAL_IPN_NOT_CONFIGURED: No IPN ID or callback URL available.');
  }

  /**
   * Submit an order to Pesapal v3 API.
   */
  async submitOrder(payload: PesapalOrderRequestPayload): Promise<PesapalOrderResponse> {
    const token = await this.getAuthToken();
    const url = `${this.baseUrl}/api/Transactions/SubmitOrderRequest`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const resJson = (await response.json()) as PesapalOrderResponse;
      if (!resJson.order_tracking_id || !resJson.redirect_url) {
        const errMsg = resJson.error?.message || resJson.message || 'Malformed order response';
        throw new Error(`Submit order rejected by provider: ${errMsg}`);
      }

      this.logger.log(`[PesapalClient] Order submitted successfully: orderTrackingId=${resJson.order_tracking_id}, merchantRef=${payload.id}`);
      return resJson;
    } catch (err: any) {
      this.logger.error(`[PesapalClient] SubmitOrder failed: ${err?.message}`);
      throw new BadGatewayException(`PESAPAL_SUBMIT_ORDER_FAILED: ${err?.message}`);
    }
  }

  /**
   * Fetch transaction status from Pesapal v3 API using orderTrackingId.
   */
  async getTransactionStatus(orderTrackingId: string): Promise<PesapalTransactionStatusResponse> {
    const token = await this.getAuthToken();
    const queryParams = new URLSearchParams({ orderTrackingId });
    const url = `${this.baseUrl}/api/Transactions/GetTransactionStatus?${queryParams.toString()}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const resJson = (await response.json()) as PesapalTransactionStatusResponse;
      this.logger.log(`[PesapalClient] Status fetched for orderTrackingId=${orderTrackingId}: status_code=${resJson.status_code}, status_desc=${resJson.payment_status_description}`);
      return resJson;
    } catch (err: any) {
      this.logger.error(`[PesapalClient] GetTransactionStatus failed for orderTrackingId=${orderTrackingId}: ${err?.message}`);
      throw new BadGatewayException(`PESAPAL_STATUS_FETCH_FAILED: ${err?.message}`);
    }
  }

  /**
   * Provider health check. Attempts authentication to determine operational status.
   * Returns a structured health state safe for reporting (never exposes secrets).
   */
  async checkHealth(): Promise<{
    status: 'HEALTHY' | 'DEGRADED' | 'AUTHENTICATION_FAILURE' | 'CONFIGURATION_ERROR' | 'PROVIDER_UNAVAILABLE';
    message: string;
    checkedAt: string;
  }> {
    const checkedAt = new Date().toISOString();

    if (!this.isConfigured()) {
      return {
        status: 'CONFIGURATION_ERROR',
        message: 'Pesapal sandbox credentials are not configured in the runtime environment.',
        checkedAt,
      };
    }

    try {
      this.assertValidEnvironment();
    } catch {
      return {
        status: 'CONFIGURATION_ERROR',
        message: 'Pesapal environment configuration is invalid or points to production.',
        checkedAt,
      };
    }

    try {
      await this.getAuthToken();
      return {
        status: 'HEALTHY',
        message: 'Pesapal sandbox authentication successful.',
        checkedAt,
      };
    } catch (err: any) {
      const errMsg = err?.message || 'Unknown authentication error';
      if (errMsg.includes('AUTH_FAILED')) {
        return {
          status: 'AUTHENTICATION_FAILURE',
          message: 'Pesapal sandbox authentication failed. Credentials may be invalid or expired.',
          checkedAt,
        };
      }
      return {
        status: 'PROVIDER_UNAVAILABLE',
        message: 'Pesapal sandbox API is unreachable or returned an unexpected error.',
        checkedAt,
      };
    }
  }
}
