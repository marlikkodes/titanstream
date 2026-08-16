import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import { BaileysAccountManagerService } from './baileys-account-manager.service';

export type BaileysConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'QR_REQUIRED' | 'CONNECTED';

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
  accountId?: string;
}

@Injectable()
export class BaileysService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BaileysService.name);

  constructor(
    @Inject(forwardRef(() => BaileysAccountManagerService))
    private readonly baileysAccountManager: BaileysAccountManagerService,
  ) {}

  async onModuleInit() {
    this.logger.log('BaileysService proxy initializing via BaileysAccountManagerService...');
  }

  async onModuleDestroy() {
    // Delegated cleanup
  }

  /**
   * Returns current primary transport state.
   */
  getConnectionState(): BaileysConnectionState {
    const primary = this.baileysAccountManager.getEligibleAccount();
    if (!primary) return 'DISCONNECTED';
    return primary.state === 'CONNECTED' ? 'CONNECTED' : 'DISCONNECTED';
  }

  getAuthTransportStatus() {
    return this.baileysAccountManager.getAuthTransportStatus();
  }

  isAuthTransportReady(): boolean {
    return this.baileysAccountManager.isAuthTransportReady();
  }

  /**
   * Dispatches a plain text message over an eligible Baileys transport account.
   */
  async sendTextMessage(phone: string, text: string, priority: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW' = 'NORMAL'): Promise<SendMessageResult> {
    return this.baileysAccountManager.sendTextMessage(phone, text, priority);
  }

  /**
   * Dispatches a verification OTP message over an eligible Baileys transport account.
   */
  async sendOtpMessage(phone: string, code: string): Promise<SendMessageResult> {
    return this.baileysAccountManager.sendOtpMessage(phone, code);
  }
}

