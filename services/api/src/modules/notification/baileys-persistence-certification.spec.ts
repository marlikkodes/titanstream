import { Test, TestingModule } from '@nestjs/testing';
import { BaileysAccountManagerService } from './baileys-account-manager.service';
import { WhatsappChallengeService } from '../auth/whatsapp-challenge.service';
import { PrismaService } from '../../database/prisma.service';
import { IdentityMasterEngineService } from '../identity/identity-master.service';
import { AuthService } from '../auth/auth.service';
import { ConversationalRouterService } from '../conversational/conversational-router.service';
import { BotNotificationService } from '../bot/bot-notification.service';
import { RewardService } from '../growth/reward.service';

import { BaileysService } from './baileys.service';

describe('Baileys Account Persistence & Conversational Certification Suite', () => {
  let baileysManager: BaileysAccountManagerService;
  let whatsappChallenge: WhatsappChallengeService;
  let prisma: PrismaService;

  const mockPrisma = {
    baileysAccount: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
    baileysAuthKey: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    universalIdentity: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    channelIdentity: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };

  const mockIdentityMaster = {
    authenticate: jest.fn().mockResolvedValue({
      userId: 'usr_test_123',
      universalIdentityId: 'uni_test_123',
      userState: 'READY',
      role: 'USER',
    }),
  };

  const mockAuthService = {
    createTokensForUser: jest.fn().mockResolvedValue({
      accessToken: 'test_access_token',
      refreshToken: 'test_refresh_token',
      user: { id: 'usr_test_123' },
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BaileysAccountManagerService,
        WhatsappChallengeService,
        ConversationalRouterService,
        { provide: BaileysService, useValue: { sendTextMessage: jest.fn().mockResolvedValue({ success: true }) } },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: IdentityMasterEngineService, useValue: mockIdentityMaster },
        { provide: AuthService, useValue: mockAuthService },
        { provide: BotNotificationService, useValue: { sendDirectMessage: jest.fn().mockResolvedValue(true) } },
        { provide: RewardService, useValue: {} },
      ],
    }).compile();

    baileysManager = module.get<BaileysAccountManagerService>(BaileysAccountManagerService);
    whatsappChallenge = module.get<WhatsappChallengeService>(WhatsappChallengeService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('P0 GATE 1: Baileys Account Persistence & Identity Invariant', () => {
    it('MUST coalesce concurrent socket initialization requests for the same account', async () => {
      const manager = baileysManager as any;
      let releaseInitialization: (() => void) | undefined;
      const pendingInitialization = new Promise<void>((resolve) => {
        releaseInitialization = resolve;
      });
      const createSocket = jest
        .spyOn(manager, 'createAccountSocket')
        .mockReturnValue(pendingInitialization);

      const first = manager.initAccountSocket('baileys_acc_18257320524');
      const second = manager.initAccountSocket('baileys_acc_18257320524');

      expect(first).toBe(second);
      expect(createSocket).toHaveBeenCalledTimes(1);

      releaseInitialization?.();
      await first;
    });

    it('MUST reuse existing database account on re-login/reconnect without creating duplicates', async () => {
      const testPhone = '+18257320524';
      const expectedAccountId = 'baileys_acc_18257320524';
      jest.spyOn(baileysManager as any, 'initAccountSocket').mockResolvedValue(undefined);

      // 1. Initial creation simulation
      mockPrisma.baileysAccount.findFirst.mockResolvedValueOnce(null);
      mockPrisma.baileysAccount.create.mockResolvedValueOnce({
        id: 'uuid-1',
        accountId: expectedAccountId,
        phone: testPhone,
        displayName: 'Gateway (+18257320524)',
        authFolder: 'baileys_auth_18257320524',
        state: 'DISCONNECTED',
        healthState: 'HEALTHY',
        isEnabled: true,
        isQuarantined: false,
      });

      const acc1 = await baileysManager.addAccount(testPhone);
      expect(acc1.accountId).toBe(expectedAccountId);

      // 2. Reconnect / Re-authenticate simulation (existing account returned from DB)
      mockPrisma.baileysAccount.findFirst.mockResolvedValue({
        id: 'uuid-1',
        accountId: expectedAccountId,
        phone: testPhone,
        displayName: 'Gateway (+18257320524)',
        authFolder: 'baileys_auth_18257320524',
        state: 'CONNECTED',
        healthState: 'HEALTHY',
        isEnabled: true,
        isQuarantined: false,
      });

      const acc2 = await baileysManager.addAccount(testPhone);
      const acc3 = await baileysManager.addAccount(testPhone);

      expect(acc2.accountId).toBe(expectedAccountId);
      expect(acc3.accountId).toBe(expectedAccountId);

      // Verify create was only called ONCE for the phone number
      expect(mockPrisma.baileysAccount.create).toHaveBeenCalledTimes(1);
    });

    it('MUST sustain concurrent reconnect requests without violating database uniqueness', async () => {
      const testPhone = '+256770000000';
      const expectedAccountId = 'baileys_acc_256770000000';
      jest.spyOn(baileysManager as any, 'initAccountSocket').mockResolvedValue(undefined);

      mockPrisma.baileysAccount.findFirst.mockResolvedValue({
        id: 'uuid-2',
        accountId: expectedAccountId,
        phone: testPhone,
        displayName: 'Gateway (+256770000000)',
        authFolder: 'baileys_auth_256770000000',
        state: 'CONNECTED',
        healthState: 'HEALTHY',
        isEnabled: true,
        isQuarantined: false,
      });

      // Simulate 5 parallel reconnect calls
      const results = await Promise.all([
        baileysManager.addAccount(testPhone),
        baileysManager.addAccount(testPhone),
        baileysManager.addAccount(testPhone),
        baileysManager.addAccount(testPhone),
        baileysManager.addAccount(testPhone),
      ]);

      const accountIds = results.map((r) => r.accountId);
      const uniqueAccountIds = new Set(accountIds);

      expect(uniqueAccountIds.size).toBe(1);
      expect(Array.from(uniqueAccountIds)[0]).toBe(expectedAccountId);
    });
  });

  describe('P0 GATE 2: First WhatsApp Message & Instant 1-Tap Approval Flow', () => {
    it('MUST receive the opaque START token from WhatsApp before issuing session tokens', async () => {
      // 1. Browser creates challenge
      const challengeInfo = whatsappChallenge.createChallenge('Chrome 120 Linux');
      const approvalToken = new URL(challengeInfo.waDeepLink).searchParams.get('text')?.replace('START ', '');
      expect(approvalToken).toBeDefined();

      // 2. User sends the deep-link token over WhatsApp
      const handled = await whatsappChallenge.handleInboundMessage('256770000000@s.whatsapp.net', `START ${approvalToken}`);
      expect(handled).toBe(true);

      // 3. Verify challenge status transitioned to APPROVED & tokens issued
      const statusObj = whatsappChallenge.getChallengeStatus(challengeInfo.challengeId, challengeInfo.browserProof) as any;
      expect(statusObj.status).toBe('APPROVED');
      expect(statusObj.accessToken).toBe('test_access_token');

      // Browser session credentials are a one-time handoff and cannot be replayed.
      expect(whatsappChallenge.getChallengeStatus(challengeInfo.challengeId, challengeInfo.browserProof)).toEqual({ status: 'EXPIRED' });
    });

    it('MUST also approve challenge if 1/YES is received during an active challenge', async () => {
      const challengeInfo = whatsappChallenge.createChallenge('Mobile Chrome');
      // Set status manually to AWAITING_APPROVAL to test 1/YES handler
      const ch = (whatsappChallenge as any).challenges.get(challengeInfo.challengeId);
      ch.status = 'AWAITING_APPROVAL';
      ch.phone = '+256770000000';
      (whatsappChallenge as any).phoneToActiveChallengeId.set('+256770000000', challengeInfo.challengeId);

      // User sends 1 to approve
      const approvedHandled = await whatsappChallenge.handleInboundMessage('256770000000@s.whatsapp.net', '1');
      expect(approvedHandled).toBe(true);

      const statusObj = whatsappChallenge.getChallengeStatus(challengeInfo.challengeId, challengeInfo.browserProof) as any;
      expect(statusObj.status).toBe('APPROVED');
      expect(statusObj.accessToken).toBe('test_access_token');
    });
  });

  describe('P0 GATE 3: Database-Backed Auth State Persistence (usePrismaAuthState)', () => {
    it('MUST save and re-hydrate creds and key stores directly from PostgreSQL', async () => {
      const { usePrismaAuthState } = await import('./baileys-prisma-auth');
      const accountId = 'baileys_acc_18257320524';

      // 1. Initial auth state load
      mockPrisma.baileysAuthKey.findUnique.mockResolvedValueOnce(null);
      const authState1 = await usePrismaAuthState(prisma, accountId);
      expect(authState1.state.creds).toBeDefined();
      expect(authState1.state.creds.registered).toBe(false);

      // 2. Save creds
      authState1.state.creds.registered = true;
      await authState1.saveCreds();
      expect(mockPrisma.baileysAuthKey.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { accountId_keyId: { accountId, keyId: 'creds' } },
        }),
      );

      // 3. Simulate server restart: re-hydrate from DB
      mockPrisma.baileysAuthKey.findUnique.mockResolvedValueOnce({
        accountId,
        keyId: 'creds',
        data: { registered: true, me: { id: '18257320524:0@s.whatsapp.net' } },
      });

      const authState2 = await usePrismaAuthState(prisma, accountId);
      expect(authState2.state.creds.registered).toBe(true);
      expect(authState2.state.creds.me.id).toBe('18257320524:0@s.whatsapp.net');
    });
  });
});
