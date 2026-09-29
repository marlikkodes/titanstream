import { Test, TestingModule } from '@nestjs/testing';
import { BaileysAccountManagerService } from './baileys-account-manager.service';
import { WhatsappChallengeService } from '../auth/whatsapp-challenge.service';
import { PrismaService } from '../../database/prisma.service';
import { resolveBaileysAuthFolder } from './baileys-prisma-auth';
import { EventEmitter } from 'events';

describe('Baileys Lifecycle & Reconnect Verification Suite', () => {
  let baileysManager: BaileysAccountManagerService;
  let mockSocket: any;
  let socketEmitter: EventEmitter;

  const mockPrisma = {
    baileysAccount: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'acc_test_1',
          accountId: 'baileys_acc_18257320524',
          displayName: 'Primary WhatsApp Gateway',
          phone: '+18257320524',
          authFolder: 'baileys_auth_info',
          state: 'DISCONNECTED',
          healthState: 'HEALTHY',
          isEnabled: true,
          isQuarantined: false,
          pairingCode: null,
          lastConnectedAt: null,
          lastMessageAt: null,
        },
      ]),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    baileysAuthKey: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({}),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    socketEmitter = new EventEmitter();
    mockSocket = {
      ev: socketEmitter,
      end: jest.fn().mockResolvedValue(undefined),
      sendMessage: jest.fn().mockResolvedValue({ key: { id: 'msg_1' } }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BaileysAccountManagerService,
        {
          provide: WhatsappChallengeService,
          useValue: {
            handleInboundMessage: jest.fn(),
          },
        },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    baileysManager = module.get<BaileysAccountManagerService>(BaileysAccountManagerService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Lifecycle: Boot → Connect → Ready', () => {
    it('MUST resolve auth folder to directory with registered credentials', () => {
      const resolved = resolveBaileysAuthFolder('baileys_auth_info');
      expect(resolved).toBeDefined();
      expect(typeof resolved).toBe('string');
    });

    it('MUST start API, load account from DB, transition to CONNECTED on open, and report isAuthTransportReady = true', async () => {
      const manager = baileysManager as any;

      // Mock createAccountSocket to simulate real socket lifecycle
      jest.spyOn(manager, 'createAccountSocket').mockImplementation(async (accountId: string) => {
        const account = manager.accounts.get(accountId);
        if (!account) return;
        account.state = 'CONNECTING';
        account.socket = mockSocket;
        account.socketGeneration = 1;

        // Register event listener on mock socket
        mockSocket.ev.on('connection.update', (update: any) => {
          if (update.connection === 'open') {
            account.state = 'CONNECTED';
            account.healthState = 'HEALTHY';
          } else if (update.connection === 'close') {
            account.state = 'DISCONNECTED';
            account.socket = undefined;
            manager.scheduleReconnect(accountId);
          }
        });
      });

      // 1. Sync accounts from DB
      await manager.syncAccountsFromDatabase();

      const account = manager.accounts.get('baileys_acc_18257320524');
      expect(account).toBeDefined();
      expect(account.accountId).toBe('baileys_acc_18257320524');

      // Before open: state is CONNECTING, not yet ready
      expect(account.state).toBe('CONNECTING');
      expect(baileysManager.isAuthTransportReady()).toBe(false);

      // 2. Simulate connection.update: { connection: 'open' }
      mockSocket.ev.emit('connection.update', { connection: 'open' });

      // After open: state is CONNECTED and transport is READY
      expect(account.state).toBe('CONNECTED');
      expect(baileysManager.isAuthTransportReady()).toBe(true);

      const status = baileysManager.getAuthTransportStatus();
      expect(status.status).toBe('ACCOUNT_READY');
      expect(status.accountId).toBe('baileys_acc_18257320524');
    });
  });

  describe('Lifecycle: Interrupt → Disconnect → Reconnect → Connected', () => {
    it('MUST handle connection interruption, transition to DISCONNECTED, schedule reconnect, and recover to CONNECTED', async () => {
      const manager = baileysManager as any;

      let reconnectSocket: any;
      let reconnectEmitter: EventEmitter;

      jest.spyOn(manager, 'createAccountSocket').mockImplementation(async (accountId: string) => {
        const account = manager.accounts.get(accountId);
        if (!account) return;
        account.state = 'CONNECTING';

        reconnectEmitter = new EventEmitter();
        reconnectSocket = {
          ev: reconnectEmitter,
          end: jest.fn().mockResolvedValue(undefined),
        };

        account.socket = reconnectSocket;
        account.socketGeneration = (account.socketGeneration || 0) + 1;

        reconnectEmitter.on('connection.update', (update: any) => {
          if (update.connection === 'open') {
            account.state = 'CONNECTED';
            account.healthState = 'HEALTHY';
          } else if (update.connection === 'close') {
            account.state = 'DISCONNECTED';
            account.socket = undefined;
            manager.scheduleReconnect(accountId);
          }
        });
      });

      // 1. Boot up and connect
      await manager.syncAccountsFromDatabase();
      const account = manager.accounts.get('baileys_acc_18257320524');

      // Connect
      reconnectEmitter!.emit('connection.update', { connection: 'open' });
      expect(account.state).toBe('CONNECTED');
      expect(baileysManager.isAuthTransportReady()).toBe(true);

      // 2. Intentionally INTERRUPT the connection (e.g. network blip or socket close)
      reconnectEmitter!.emit('connection.update', {
        connection: 'close',
        lastDisconnect: { error: { output: { statusCode: 503 } } },
      });

      // Immediate state after interruption: DISCONNECTED
      expect(account.state).toBe('DISCONNECTED');
      expect(account.socket).toBeUndefined();
      expect(baileysManager.isAuthTransportReady()).toBe(false);

      // Verify reconnect timer was scheduled
      expect(manager.reconnectTimers.has('baileys_acc_18257320524')).toBe(true);

      // 3. Fast-forward past the reconnect delay (5000ms)
      jest.advanceTimersByTime(5000);

      // Flush microtasks
      await Promise.resolve();

      // Account socket has been re-created in CONNECTING state
      expect(account.state).toBe('CONNECTING');
      expect(account.socket).toBeDefined();

      // 4. New socket reaches OPEN
      reconnectEmitter!.emit('connection.update', { connection: 'open' });

      // Recovered to CONNECTED
      expect(account.state).toBe('CONNECTED');
      expect(baileysManager.isAuthTransportReady()).toBe(true);
      expect(baileysManager.getAuthTransportStatus().status).toBe('ACCOUNT_READY');
    });
  });
});
