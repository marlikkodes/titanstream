import { Injectable, Logger, OnModuleInit, NotFoundException, BadRequestException, ServiceUnavailableException, Inject, forwardRef } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../database/prisma.service';
import { WhatsappChallengeService } from '../auth/whatsapp-challenge.service';

export interface ManagedBaileysAccount {
  id?: string;
  accountId: string;
  displayName: string;
  phone: string;
  authFolder: string;
  state: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'QUARANTINED' | 'DISABLED';
  healthState: 'HEALTHY' | 'DEGRADED' | 'QUARANTINED';
  isEnabled: boolean;
  isQuarantined: boolean;
  pairingCode?: string;
  socket?: any;
  metrics: {
    lastConnectedAt?: Date;
    lastMessageAt?: Date;
    lastSuccessfulMessageAt?: Date;
    messageSuccesses: number;
    messageFailures: number;
    authenticationFailures: number;
  };
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  accountId?: string;
  error?: string;
}

interface QueuedOutboundMessage {
  phone: string;
  text: string;
  priority: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
  createdAt: Date;
  resolve: (value: SendMessageResult) => void;
  reject: (reason: any) => void;
}

function extractMessageText(msg: any): string | null {
  if (!msg || !msg.message) return null;
  const m = msg.message;
  const raw = (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.buttonsResponseMessage?.selectedButtonId ||
    m.templateButtonReplyMessage?.selectedId ||
    m.interactiveResponseMessage?.body?.text ||
    m.ephemeralMessage?.message?.conversation ||
    m.ephemeralMessage?.message?.extendedTextMessage?.text ||
    m.viewOnceMessage?.message?.conversation ||
    m.viewOnceMessage?.message?.extendedTextMessage?.text
  );
  return typeof raw === 'string' ? raw.trim() : null;
}

@Injectable()
export class BaileysAccountManagerService implements OnModuleInit {
  private readonly logger = new Logger(BaileysAccountManagerService.name);
  private readonly accounts = new Map<string, ManagedBaileysAccount>();

  // Operational Outbound Throttle & Rate Control Configuration
  private readonly maxConcurrency = parseInt(process.env.WHATSAPP_MAX_CONCURRENCY || '2', 10);
  private readonly minSendIntervalMs = parseInt(process.env.WHATSAPP_MIN_SEND_INTERVAL_MS || '300', 10);
  private readonly maxQueueDepth = parseInt(process.env.WHATSAPP_MAX_QUEUE_DEPTH || '1000', 10);

  private readonly outboundQueue: QueuedOutboundMessage[] = [];
  private activeSends = 0;
  private lastSendTime = 0;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => WhatsappChallengeService))
    private readonly whatsappChallengeService: WhatsappChallengeService,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing Persistent Multi-Account Baileys Transport Infrastructure...');
    
    // 1. Sync accounts from persistent PostgreSQL database asynchronously (non-blocking)
    setImmediate(() => {
      this.syncAccountsFromDatabase().catch((err) => {
        this.logger.warn(`[BAILEYS_SYNC_WARN] ${err.message}`);
      });
    });

    // 2. Start bounded queue processor tick
    setInterval(() => {
      this.processOutboundQueue().catch((err) => {
        this.logger.error(`[BAILEYS_QUEUE_ERROR] ${err.message}`);
      });
    }, 100);

    // 3. Start Safety Net Watchdog Loop to keep main account active for new users
    this.startSafetyNetWatchdog();
  }

  /**
   * Safety Net Watchdog: Continuously monitors account health every 15 seconds.
   * Auto-reconnects disconnected sockets and self-heals degraded/logged-out sessions.
   */
  private startSafetyNetWatchdog() {
    this.logger.log('🛡️  Starting Baileys Safety Net Watchdog (15s health heartbeat loop)...');
    setInterval(async () => {
      try {
        const primaryPhone = process.env.WHATSAPP_BOT_PHONE || '+18257320524';
        const cleanDigits = primaryPhone.replace(/\D/g, '');
        const primaryAccountId = `baileys_acc_${cleanDigits}`;

        let primaryAccount = this.accounts.get(primaryAccountId);

        // If primary account is missing from memory map, re-sync/register it
        if (!primaryAccount) {
          this.logger.warn(`[SAFETY_NET] Primary account ${primaryAccountId} missing from memory map. Re-syncing...`);
          await this.syncAccountsFromDatabase().catch(() => null);
          primaryAccount = this.accounts.get(primaryAccountId);
        }

        if (primaryAccount && primaryAccount.isEnabled && !primaryAccount.isQuarantined) {
          // Case 1: Account is DISCONNECTED or socket dropped
          if (primaryAccount.state !== 'CONNECTED' || !primaryAccount.socket) {
            if (primaryAccount.state !== 'CONNECTING') {
              this.logger.log(`[SAFETY_NET_RECOVER] Primary account [${primaryAccount.accountId}] is ${primaryAccount.state}. Triggering socket reconnect...`);
              await this.initAccountSocket(primaryAccount.accountId);
            }
          }

          // Case 2: Account was logged out / DEGRADED -> reset stale auth folder and re-init pairing
          if (primaryAccount.healthState === 'DEGRADED' && primaryAccount.state === 'DISCONNECTED') {
            this.logger.warn(`[SAFETY_NET_SELF_HEAL] Primary account [${primaryAccount.accountId}] is DEGRADED (logged out). Resetting credentials for fresh pairing...`);
            const authFolderPath = path.resolve(process.cwd(), primaryAccount.authFolder);
            if (fs.existsSync(authFolderPath)) {
              try {
                fs.rmSync(authFolderPath, { recursive: true, force: true });
                this.logger.log(`[SAFETY_NET_SELF_HEAL] Cleaned stale auth folder: ${authFolderPath}`);
              } catch (rmErr: any) {
                this.logger.error(`[SAFETY_NET_SELF_HEAL_ERR] ${rmErr.message}`);
              }
            }
            primaryAccount.healthState = 'HEALTHY';
            await this.updateDbAccountState(primaryAccount.accountId, 'DISCONNECTED', 'HEALTHY');
            await this.initAccountSocket(primaryAccount.accountId);
          }
        }
      } catch (watchdogErr: any) {
        this.logger.error(`[SAFETY_NET_WATCHDOG_ERROR] ${watchdogErr.message}`);
      }
    }, 15000);
  }

  /**
   * Loads or creates persistent accounts from PostgreSQL database and initializes sockets.
   */
  private async syncAccountsFromDatabase() {
    try {
      let dbAccounts = await this.prisma.baileysAccount.findMany({
        where: { isEnabled: true },
      });

      // If database has no account records yet, create primary account
      if (dbAccounts.length === 0) {
        const primaryPhone = process.env.WHATSAPP_BOT_PHONE || '+18257320524';
        const primaryAccount = await this.getOrCreatePersistentAccount(primaryPhone, 'Primary WhatsApp Gateway');
        dbAccounts = [primaryAccount];
      }

      for (const dbAcc of dbAccounts) {
        const managed: ManagedBaileysAccount = {
          id: dbAcc.id,
          accountId: dbAcc.accountId,
          displayName: dbAcc.displayName,
          phone: dbAcc.phone,
          authFolder: dbAcc.authFolder,
          state: dbAcc.state as any,
          healthState: dbAcc.healthState as any,
          isEnabled: dbAcc.isEnabled,
          isQuarantined: dbAcc.isQuarantined,
          pairingCode: dbAcc.pairingCode || undefined,
          metrics: {
            lastConnectedAt: dbAcc.lastConnectedAt || undefined,
            lastMessageAt: dbAcc.lastMessageAt || undefined,
            messageSuccesses: 0,
            messageFailures: 0,
            authenticationFailures: 0,
          },
        };

        this.accounts.set(managed.accountId, managed);
        await this.initAccountSocket(managed.accountId);
      }
    } catch (err: any) {
      this.logger.error(`[BAILEYS_DB_SYNC_ERROR] Failed to sync accounts from database: ${err.message}`);
      // Fallback in-memory registration if DB is temporarily unreachable on startup
      const primaryPhone = process.env.WHATSAPP_BOT_PHONE || '+18257320524';
      const cleanDigits = primaryPhone.replace(/\D/g, '');
      const accountId = `baileys_acc_${cleanDigits}`;
      const defaultAuthFolder = fs.existsSync(path.resolve(process.cwd(), 'baileys_auth_info', 'creds.json'))
        ? 'baileys_auth_info'
        : `baileys_auth_${cleanDigits}`;
      this.registerAccountMemory(accountId, 'Primary WhatsApp Gateway', '+' + cleanDigits, defaultAuthFolder);
      await this.initAccountSocket(accountId);
    }
  }

  /**
   * Finds or creates a persistent BaileysAccount database row using PostgreSQL unique constraints.
   */
  async getOrCreatePersistentAccount(phone: string, displayName?: string) {
    const cleanDigits = phone.replace(/\D/g, '');
    const cleanPhone = '+' + cleanDigits;
    const accountId = `baileys_acc_${cleanDigits}`;
    const name = displayName || `Gateway (${cleanPhone})`;
    const authFolder = fs.existsSync(path.resolve(process.cwd(), 'baileys_auth_info', 'creds.json'))
      ? 'baileys_auth_info'
      : `baileys_auth_${cleanDigits}`;

    // Lookup existing account by phone or accountId
    const existing = await this.prisma.baileysAccount.findFirst({
      where: { OR: [{ phone: cleanPhone }, { accountId }] },
    });

    if (existing) {
      this.logger.log(`[BAILEYS_PERSISTENCE] Reusing persistent BaileysAccount row: accountId=${existing.accountId} phone=${existing.phone}`);
      return existing;
    }

    try {
      const created = await this.prisma.baileysAccount.create({
        data: {
          accountId,
          phone: cleanPhone,
          displayName: name,
          authFolder,
          state: 'DISCONNECTED',
          healthState: 'HEALTHY',
          isEnabled: true,
          isQuarantined: false,
        },
      });
      this.logger.log(`[BAILEYS_PERSISTENCE] Created new persistent BaileysAccount row: accountId=${created.accountId} phone=${created.phone}`);
      return created;
    } catch (err: any) {
      // Handle parallel creation race conditions by re-fetching
      const found = await this.prisma.baileysAccount.findFirst({
        where: { OR: [{ phone: cleanPhone }, { accountId }] },
      });
      if (found) return found;
      throw err;
    }
  }

  private registerAccountMemory(
    accountId: string,
    displayName: string,
    phone: string,
    authFolder: string,
  ): ManagedBaileysAccount {
    const account: ManagedBaileysAccount = {
      accountId,
      displayName,
      phone,
      authFolder,
      state: 'DISCONNECTED',
      healthState: 'HEALTHY',
      isEnabled: true,
      isQuarantined: false,
      metrics: {
        messageSuccesses: 0,
        messageFailures: 0,
        authenticationFailures: 0,
      },
    };
    this.accounts.set(accountId, account);
    return account;
  }

  /**
   * Admin API: Lists all managed persistent Baileys accounts with telemetry metrics.
   */
  async listAccounts() {
    try {
      const dbAccounts = await this.prisma.baileysAccount.findMany();
      return dbAccounts.map((dbAcc) => {
        const memAcc = this.accounts.get(dbAcc.accountId);
        return {
          accountId: dbAcc.accountId,
          displayName: dbAcc.displayName,
          phone: dbAcc.phone,
          state: memAcc?.state || dbAcc.state,
          healthState: memAcc?.healthState || dbAcc.healthState,
          isEnabled: dbAcc.isEnabled,
          isQuarantined: dbAcc.isQuarantined,
          pairingCode: dbAcc.pairingCode || memAcc?.pairingCode,
          metrics: memAcc ? { ...memAcc.metrics } : {},
          lastConnectedAt: dbAcc.lastConnectedAt,
        };
      });
    } catch {
      return Array.from(this.accounts.values()).map((acc) => ({
        accountId: acc.accountId,
        displayName: acc.displayName,
        phone: acc.phone,
        state: acc.state,
        healthState: acc.healthState,
        isEnabled: acc.isEnabled,
        isQuarantined: acc.isQuarantined,
        pairingCode: acc.pairingCode,
        metrics: { ...acc.metrics },
      }));
    }
  }

  /**
   * Admin API: Add/register or reconnect a persistent Baileys transport account.
   * Guaranteed: Re-authenticating or adding an existing phone REUSES the persistent account record.
   */
  async addAccount(phone: string, displayName?: string) {
    const cleanDigits = phone.replace(/\D/g, '');
    const cleanPhone = '+' + cleanDigits;
    const accountId = `baileys_acc_${cleanDigits}`;

    // Get or create persistent DB record
    const dbAccount = await this.getOrCreatePersistentAccount(cleanPhone, displayName);

    let managed = this.accounts.get(accountId);
    if (!managed) {
      managed = {
        id: dbAccount.id,
        accountId: dbAccount.accountId,
        displayName: dbAccount.displayName,
        phone: dbAccount.phone,
        authFolder: dbAccount.authFolder,
        state: 'DISCONNECTED',
        healthState: 'HEALTHY',
        isEnabled: true,
        isQuarantined: false,
        metrics: {
          messageSuccesses: 0,
          messageFailures: 0,
          authenticationFailures: 0,
        },
      };
      this.accounts.set(accountId, managed);
    }

    await this.initAccountSocket(accountId);
    this.logger.log(`[BAILEYS_ACCOUNT_PERSISTENT] Reconnected/initialized account ${accountId} (${cleanPhone}).`);

    return {
      accountId: managed.accountId,
      displayName: managed.displayName,
      phone: managed.phone,
      state: managed.state,
      healthState: managed.healthState,
    };
  }

  /**
   * Selects an eligible, connected, healthy, non-quarantined account for outbound messaging.
   */
  getEligibleAccount(): ManagedBaileysAccount | null {
    const connectedList = Array.from(this.accounts.values()).filter(
      (acc) => acc.isEnabled && !acc.isQuarantined && acc.healthState !== 'QUARANTINED' && acc.state === 'CONNECTED' && acc.socket
    );

    if (connectedList.length === 0) return null;

    connectedList.sort((a, b) => a.metrics.messageFailures - b.metrics.messageFailures);
    return connectedList[0];
  }

  /**
   * Returns explicit authentication transport readiness state.
   */
  getAuthTransportStatus(): {
    status: 'ACCOUNT_NOT_CONFIGURED' | 'ACCOUNT_DISCONNECTED' | 'ACCOUNT_CONNECTING' | 'ACCOUNT_CONNECTED' | 'ACCOUNT_READY';
    accountId?: string;
    phone?: string;
    hasCreds: boolean;
  } {
    const primary = Array.from(this.accounts.values())[0];
    if (!primary) {
      return { status: 'ACCOUNT_NOT_CONFIGURED', hasCreds: false };
    }

    const possiblePaths = [
      path.resolve(process.cwd(), primary.authFolder, 'creds.json'),
      path.resolve(process.cwd(), 'baileys_auth_info', 'creds.json'),
      path.resolve(process.cwd(), 'baileys_auth_18257320524', 'creds.json'),
      path.resolve(process.cwd(), '..', '..', 'baileys_auth_18257320524', 'creds.json'),
    ];

    const hasCreds = possiblePaths.some((p) => fs.existsSync(p));

    if (primary.state === 'CONNECTED' && primary.socket) {
      return { status: 'ACCOUNT_READY', accountId: primary.accountId, phone: primary.phone, hasCreds: true };
    } else if (primary.state === 'CONNECTED') {
      return { status: 'ACCOUNT_CONNECTED', accountId: primary.accountId, phone: primary.phone, hasCreds: true };
    } else if (primary.state === 'CONNECTING') {
      return { status: 'ACCOUNT_CONNECTING', accountId: primary.accountId, phone: primary.phone, hasCreds: true };
    } else {
      return { status: 'ACCOUNT_DISCONNECTED', accountId: primary.accountId, phone: primary.phone, hasCreds: true };
    }
  }

  isAuthTransportReady(): boolean {
    const status = this.getAuthTransportStatus();
    return status.status !== 'ACCOUNT_NOT_CONFIGURED';
  }

  /**
   * Initializes or reconnects a Baileys socket for a given account.
   */
  private async initAccountSocket(accountId: string) {
    const account = this.accounts.get(accountId);
    if (!account || !account.isEnabled || account.isQuarantined) return;
    if (account.state === 'CONNECTING') return;

    if (account.socket) {
      try {
        account.socket.ws?.close();
        account.socket.ev?.removeAllListeners();
      } catch {}
      account.socket = null;
    }

    try {
      const baileys = await import('@whiskeysockets/baileys').catch(() => null);
      if (!baileys) {
        this.logger.warn(`[BAILEYS] @whiskeysockets/baileys package not available for account ${accountId}.`);
        account.state = 'DISCONNECTED';
        return;
      }

      const bAny = baileys as any;
      const makeWASocket = bAny.makeWASocket || bAny.default?.makeWASocket || bAny.default;
      const useMultiFileAuthState = bAny.useMultiFileAuthState || bAny.default?.useMultiFileAuthState;
      const DisconnectReason = bAny.DisconnectReason || bAny.default?.DisconnectReason;
      const { state, saveCreds } = await useMultiFileAuthState(account.authFolder);

      const pinoLogger: any = {
        level: 'silent',
        info: () => {},
        error: () => {},
        warn: () => {},
        trace: () => {},
        debug: () => {},
        child: () => pinoLogger,
      };

      account.state = 'CONNECTING';
      await this.updateDbAccountState(accountId, 'CONNECTING', account.healthState);

      const socket = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pinoLogger,
        browser: ['Ubuntu', 'Chrome', '120.0.0.0'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 15000,
        retryRequestDelayMs: 2500,
      });

      account.socket = socket;
      socket.ev.on('creds.update', saveCreds);

      // Inbound listener for conversational approval
      socket.ev.on('messages.upsert', async (m: any) => {
        try {
          if (!m.messages || !m.messages.length) return;
          for (const msg of m.messages) {
            if (msg.key && !msg.key.fromMe && msg.key.remoteJid) {
              const text = extractMessageText(msg);
              if (text && this.whatsappChallengeService) {
                this.logger.log(`[BAILEYS_INBOUND] Account [${account.accountId}] received message from ${msg.key.remoteJid}: "${text}"`);
                await this.whatsappChallengeService.handleInboundMessage(msg.key.remoteJid, text);
              }
            }
          }
        } catch (inboundErr: any) {
          this.logger.error(`[BAILEYS_INBOUND_ERROR] ${inboundErr.message}`);
        }
      });

      // Track whether we've already requested a pairing code for this socket lifecycle
      let pairingCodeRequested = false;

      socket.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        // When Baileys emits a QR, request a pairing code instead
        if (qr && !state.creds.registered && !pairingCodeRequested) {
          pairingCodeRequested = true;
          const phoneForPairing = account.phone.replace(/\D/g, '');
          try {
            const pairingCode = await socket.requestPairingCode(phoneForPairing);
            account.pairingCode = pairingCode;
            this.logger.log(`\n` +
              `╔══════════════════════════════════════════════════════════════╗\n` +
              `║         WHATSAPP PAIRING CODE FOR ${account.phone}          ║\n` +
              `║                                                            ║\n` +
              `║   Code:  ${pairingCode.padEnd(48)}║\n` +
              `║                                                            ║\n` +
              `║   Open WhatsApp on your phone → Linked Devices             ║\n` +
              `║   → Link a Device → Link with phone number instead         ║\n` +
              `║   → Enter this code                                        ║\n` +
              `╚══════════════════════════════════════════════════════════════╝`);
            // Persist pairing code to DB so admin endpoints can read it
            try {
              await this.prisma.baileysAccount.update({
                where: { accountId },
                data: { pairingCode },
              });
            } catch {}
          } catch (pairErr: any) {
            this.logger.error(`[BAILEYS_PAIRING_ERROR] Failed to request pairing code for ${account.phone}: ${pairErr.message}`);
            pairingCodeRequested = false; // Allow retry on next QR cycle
          }
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          this.logger.warn(`[BAILEYS_DISCONNECT] Account ${accountId} disconnected (Reason ${statusCode}). Reconnect: ${shouldReconnect}`);
          account.state = 'DISCONNECTED';
          account.socket = undefined;
          await this.updateDbAccountState(accountId, 'DISCONNECTED', account.healthState);

          if (shouldReconnect && account.isEnabled && !account.isQuarantined) {
            // Use longer delay (10s) to avoid rapid reconnect loops
            setTimeout(() => this.initAccountSocket(accountId), 10000);
          } else if (statusCode === DisconnectReason.loggedOut) {
            account.healthState = 'DEGRADED';
            await this.updateDbAccountState(accountId, 'DISCONNECTED', 'DEGRADED');
          }
        } else if (connection === 'open') {
          account.state = 'CONNECTED';
          account.healthState = 'HEALTHY';
          account.pairingCode = undefined;
          account.metrics.lastConnectedAt = new Date();
          this.logger.log(`[BAILEYS] ✅ WhatsApp account [${accountId}] connected successfully.`);
          await this.updateDbAccountState(accountId, 'CONNECTED', 'HEALTHY', new Date());
        }
      });
    } catch (err: any) {
      account.state = 'DISCONNECTED';
      await this.updateDbAccountState(accountId, 'DISCONNECTED', account.healthState);
      this.logger.error(`[BAILEYS_INIT_ERROR] Account ${accountId}: ${err.message}`);
    }
  }

  /**
   * Helper to persist runtime status changes into PostgreSQL database.
   */
  private async updateDbAccountState(accountId: string, state: string, healthState: string, lastConnectedAt?: Date) {
    try {
      await this.prisma.baileysAccount.update({
        where: { accountId },
        data: {
          state,
          healthState,
          ...(lastConnectedAt ? { lastConnectedAt } : {}),
        },
      });
    } catch {
      // Ignore if DB is unreachable during rapid event firing
    }
  }

  /**
   * Admin API: Executes operational actions on a persistent account.
   */
  async executeAccountAction(accountId: string, action: 'connect' | 'disconnect' | 'reconnect' | 'enable' | 'disable' | 'quarantine' | 'unquarantine' | 'remove') {
    const account = this.accounts.get(accountId);
    if (!account) throw new NotFoundException(`Account ${accountId} not found.`);

    switch (action) {
      case 'connect':
      case 'reconnect':
        account.isEnabled = true;
        account.isQuarantined = false;
        await this.prisma.baileysAccount.update({
          where: { accountId },
          data: { isEnabled: true, isQuarantined: false },
        }).catch(() => null);
        await this.initAccountSocket(accountId);
        break;

      case 'disconnect':
        if (account.socket) {
          try {
            await account.socket.end(new Error('Manual admin disconnect'));
          } catch {}
        }
        account.state = 'DISCONNECTED';
        account.socket = undefined;
        await this.updateDbAccountState(accountId, 'DISCONNECTED', account.healthState);
        break;

      case 'disable':
        account.isEnabled = false;
        if (account.socket) {
          try {
            await account.socket.end(new Error('Admin disabled account'));
          } catch {}
        }
        account.state = 'DISABLED';
        account.socket = undefined;
        await this.prisma.baileysAccount.update({
          where: { accountId },
          data: { isEnabled: false, state: 'DISABLED' },
        }).catch(() => null);
        break;

      case 'quarantine':
        account.isQuarantined = true;
        account.healthState = 'QUARANTINED';
        account.state = 'QUARANTINED';
        if (account.socket) {
          try {
            await account.socket.end(new Error('Admin quarantined account'));
          } catch {}
        }
        account.socket = undefined;
        await this.prisma.baileysAccount.update({
          where: { accountId },
          data: { isQuarantined: true, healthState: 'QUARANTINED', state: 'QUARANTINED' },
        }).catch(() => null);
        break;

      case 'unquarantine':
        account.isQuarantined = false;
        account.healthState = 'HEALTHY';
        await this.prisma.baileysAccount.update({
          where: { accountId },
          data: { isQuarantined: false, healthState: 'HEALTHY' },
        }).catch(() => null);
        await this.initAccountSocket(accountId);
        break;

      case 'remove':
        if (account.socket) {
          try {
            await account.socket.end(new Error('Account removed'));
          } catch {}
        }
        this.accounts.delete(accountId);
        await this.prisma.baileysAccount.delete({
          where: { accountId },
        }).catch(() => null);
        break;
    }

    return {
      accountId: account.accountId,
      state: account.state,
      healthState: account.healthState,
      isEnabled: account.isEnabled,
      isQuarantined: account.isQuarantined,
    };
  }

  /**
   * Requests a WhatsApp phone pairing code for account authorization.
   */
  async requestPairingCode(accountId: string, phone?: string) {
    const account = this.accounts.get(accountId);
    if (!account) throw new NotFoundException(`Account ${accountId} not found.`);

    const targetPhone = phone || account.phone;
    const cleanDigits = targetPhone.replace(/\D/g, '');
    if (account.socket && typeof account.socket.requestPairingCode === 'function') {
      try {
        const code = await account.socket.requestPairingCode(cleanDigits);
        account.pairingCode = code;
        await this.prisma.baileysAccount.update({
          where: { accountId },
          data: { pairingCode: code },
        }).catch(() => null);
        return { pairingCode: code };
      } catch (err: any) {
        this.logger.error(`Failed to request pairing code for ${accountId}: ${err.message}`);
        throw new BadRequestException(`Pairing code request failed: ${err.message}`);
      }
    }

    const code = `${Math.floor(100000 + Math.random() * 900000)}`;
    account.pairingCode = code;
    return { pairingCode: code };
  }

  /**
   * Dispatches high-priority security OTP authentication message.
   */
  async sendOtpMessage(phone: string, code: string): Promise<SendMessageResult> {
    const text = `Titan Stream 🔐 Security Verification Code:\n\n*${code}*\n\nThis code expires in 5 minutes. Do not share it with anyone.`;
    return this.sendTextMessage(phone, text, 'CRITICAL');
  }

  /**
   * Enqueues an outbound text message with operational rate limiting.
   */
  async sendTextMessage(phone: string, text: string, priority: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW' = 'NORMAL'): Promise<SendMessageResult> {
    if (this.outboundQueue.length >= this.maxQueueDepth) {
      throw new ServiceUnavailableException(`WhatsApp outbound queue at capacity (${this.outboundQueue.length}/${this.maxQueueDepth})`);
    }

    return new Promise<SendMessageResult>((resolve, reject) => {
      const item: QueuedOutboundMessage = {
        phone,
        text,
        priority,
        createdAt: new Date(),
        resolve,
        reject,
      };

      if (priority === 'CRITICAL' || priority === 'HIGH') {
        this.outboundQueue.unshift(item);
      } else {
        this.outboundQueue.push(item);
      }
    });
  }

  /**
   * Drain and dispatch outbound messages from queue.
   */
  private async processOutboundQueue() {
    if (this.outboundQueue.length === 0) return;
    if (this.activeSends >= this.maxConcurrency) return;

    const now = Date.now();
    const timeSinceLast = now - this.lastSendTime;
    if (timeSinceLast < this.minSendIntervalMs) return;

    const item = this.outboundQueue.shift();
    if (!item) return;

    this.activeSends++;
    this.lastSendTime = Date.now();

    try {
      const result = await this.dispatchDirectSend(item.phone, item.text);
      item.resolve(result);
    } catch (err) {
      item.reject(err);
    } finally {
      this.activeSends--;
    }
  }

  private async dispatchDirectSend(phoneOrJid: string, text: string): Promise<SendMessageResult> {
    const account = this.getEligibleAccount();
    if (!account || !account.socket) {
      this.logger.warn(`[BAILEYS_SEND_FAILED] No eligible connected account available to dispatch message to ${phoneOrJid}`);
      return { success: false, error: 'NO_CONNECTED_BAILEYS_ACCOUNT' };
    }

    try {
      let jid = phoneOrJid.trim();
      if (!jid.includes('@')) {
        const cleanDigits = phoneOrJid.replace(/\D/g, '');
        jid = `${cleanDigits}@s.whatsapp.net`;
      }

      const res = await account.socket.sendMessage(jid, { text });

      account.metrics.messageSuccesses++;
      account.metrics.lastMessageAt = new Date();
      account.metrics.lastSuccessfulMessageAt = new Date();

      const msgId = res?.key?.id || (res as any)?.id || `msg_${Date.now()}`;
      this.logger.log(`[BAILEYS_SEND_SUCCESS] Message ${msgId} sent via persistent account [${account.accountId}] to ${jid}`);
      return {
        success: true,
        messageId: msgId,
        accountId: account.accountId,
      };
    } catch (err: any) {
      account.metrics.messageFailures++;
      this.logger.error(`[BAILEYS_SEND_ERROR] Failed to send via persistent account [${account.accountId}]: ${err.message}`);
      return {
        success: false,
        accountId: account.accountId,
        error: err.message,
      };
    }
  }
}
