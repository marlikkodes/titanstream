import { Test, TestingModule } from '@nestjs/testing';
import { IdentityMasterEngineService } from './identity-master.service';
import { WebAuthSessionService } from '../auth/web-auth-session.service';
import { WhatsappChallengeService } from '../auth/whatsapp-challenge.service';
import { AuthService } from '../auth/auth.service';
import { BotGateService } from '../bot/bot-gate.service';
import { ProviderRegistryService } from '../settlement/provider-registry.service';
import { WithdrawalService } from '../financial/withdrawal.service';
import { PaymentOrderService } from '../payment-order/payment-order.service';
import { PrismaService } from '../../database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { IdentityProvider, UserState } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { BaileysService } from '../notification/baileys.service';

import { TelegramClientService } from '../bot/telegram-client.service';
import { AuditService } from '../audit/audit.service';

describe('DEEP IDENTITY PERSISTENCE E2E ACCEPTANCE TEST (Phases 1-15)', () => {
  let identityMaster: IdentityMasterEngineService;
  let webAuthSession: WebAuthSessionService;
  let whatsappChallenge: WhatsappChallengeService;
  let authService: AuthService;
  let botGate: BotGateService;
  let providerRegistry: ProviderRegistryService;
  let withdrawalService: WithdrawalService;
  let paymentOrderService: PaymentOrderService;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let baileysServiceMock: any;

  const BASELINE_UUID = '132a143c-f57b-469d-98ed-94fd20605ac6';
  const BASELINE_TELEGRAM_ID = 256752762181;
  const BASELINE_PHONE = '+256752762181';

  let sentMessages: Array<{ target: string; message: string; priority: string }> = [];

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  beforeAll(async () => {
    baileysServiceMock = {
      sendTextMessage: jest.fn().mockImplementation((target, text, priority) => {
        sentMessages.push({ target, message: text, priority });
        return Promise.resolve({ status: 'SENT' });
      }),
      sendOtpMessage: jest.fn().mockResolvedValue({ status: 'SENT' }),
      getTransportReadinessStatus: jest.fn().mockReturnValue({ status: 'ACCOUNT_READY', hasCreds: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdentityMasterEngineService,
        WebAuthSessionService,
        WhatsappChallengeService,
        BotGateService,
        PrismaService,
        {
          provide: JwtService,
          useValue: new JwtService({ secret: 'test-jwt-secret-at-least-32-chars-long-12345' }),
        },
        {
          provide: AuthService,
          useFactory: (jwt: JwtService, p: PrismaService, im: IdentityMasterEngineService) => {
            return {
              createTokensForUser: (user: any) => {
                const payload = {
                  sub: user.id,
                  titanUserId: user.id,
                  userId: user.id,
                  telegramUserId: user.telegramUserId,
                  state: user.state,
                  role: 'USER',
                };
                return {
                  accessToken: jwt.sign(payload, { expiresIn: '15m' }),
                  refreshToken: jwt.sign({ sub: user.id, type: 'refresh' }, { expiresIn: '30d' }),
                  user,
                };
              },
            };
          },
          inject: [JwtService, PrismaService, IdentityMasterEngineService],
        },
        {
          provide: BaileysService,
          useValue: baileysServiceMock,
        },
        {
          provide: TelegramClientService,
          useValue: {
            sendMessage: jest.fn().mockResolvedValue({ message_id: 1 }),
            getChatMember: jest.fn().mockResolvedValue({ status: 'member' }),
          },
        },
        {
          provide: AuditService,
          useValue: {
            create: jest.fn().mockResolvedValue({}),
            createWithClient: jest.fn().mockResolvedValue({}),
          },
        },
        ProviderRegistryService,
        {
          provide: WithdrawalService,
          useFactory: (p: PrismaService) => new WithdrawalService(p, null as any, null as any, null as any, null as any),
          inject: [PrismaService],
        },
        {
          provide: PaymentOrderService,
          useFactory: (p: PrismaService) => new PaymentOrderService(p, null as any, null as any, null as any),
          inject: [PrismaService],
        },
      ],
    }).compile();

    identityMaster = module.get<IdentityMasterEngineService>(IdentityMasterEngineService);
    webAuthSession = module.get<WebAuthSessionService>(WebAuthSessionService);
    whatsappChallenge = module.get<WhatsappChallengeService>(WhatsappChallengeService);
    botGate = module.get<BotGateService>(BotGateService);
    providerRegistry = module.get<ProviderRegistryService>(ProviderRegistryService);
    withdrawalService = module.get<WithdrawalService>(WithdrawalService);
    paymentOrderService = module.get<PaymentOrderService>(PaymentOrderService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  beforeEach(() => {
    sentMessages = [];
  });

  // ─────────────────────────────────────────────────────────────
  // PHASE 1: Baseline Account Verification
  // ─────────────────────────────────────────────────────────────
  describe('Phase 1: Baseline Account Verification', () => {
    it('verifies baseline account state in PostgreSQL', async () => {
      const user = await prisma.user.findUnique({
        where: { id: BASELINE_UUID },
        include: {
          identity: { include: { channels: true } },
          financialAccount: true,
          userMachines: true,
          referralCode: true,
        },
      });

      expect(user).toBeDefined();
      expect(user!.id).toBe(BASELINE_UUID);
      expect(user!.identityId).toBe(BASELINE_UUID);
      expect(user!.identity.id).toBe(BASELINE_UUID);
      expect(user!.telegramUserId).toBe(BigInt(BASELINE_TELEGRAM_ID));
      expect(user!.financialAccount).toBeDefined();
      expect(user!.referralCode).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PHASE 2 & 3: Incident Path & JWT Claims Verification
  // ─────────────────────────────────────────────────────────────
  describe('Phase 2 & 3: WebAuthSession Incident Path & JWT Subject', () => {
    it('authorizes web session for baseline Telegram user and sets JWT.sub === canonical User UUID', async () => {
      const { sessionCode } = webAuthSession.createWebAuthSession();

      const authorized = await webAuthSession.authorizeWebSessionViaTelegram(sessionCode, {
        id: BASELINE_TELEGRAM_ID,
        first_name: 'Marlik',
        last_name: 'Marvin',
        username: 'marlikm',
      });

      expect(authorized).toBe(true);

      const session: any = webAuthSession.pollWebAuthSession(sessionCode);
      expect(session.status).toBe('AUTHENTICATED');
      expect(session.user.id).toBe(BASELINE_UUID);
      expect(session.user.identityId).toBe(BASELINE_UUID);

      // Verify JWT Claims
      const decoded: any = jwtService.verify(session.accessToken);
      expect(decoded.sub).toBe(BASELINE_UUID);
      expect(decoded.userId).toBe(BASELINE_UUID);
      expect(decoded.titanUserId).toBe(BASELINE_UUID);
      expect(decoded.telegramUserId).toBe(BASELINE_TELEGRAM_ID);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PHASE 6: Repeat Login Idempotency Test (3 Logins -> Same UUID)
  // ─────────────────────────────────────────────────────────────
  describe('Phase 6: Repeat Login Idempotency', () => {
    it('produces identical User UUID and JWT.sub across 3 consecutive authentications', async () => {
      // Login #1
      const auth1 = await identityMaster.authenticate({
        provider: IdentityProvider.WHATSAPP,
        identifier: BASELINE_PHONE,
      });

      // Login #2
      const auth2 = await identityMaster.authenticate({
        provider: IdentityProvider.WHATSAPP,
        identifier: BASELINE_PHONE,
      });

      // Login #3
      const auth3 = await identityMaster.authenticate({
        provider: IdentityProvider.WHATSAPP,
        identifier: BASELINE_PHONE,
      });

      expect(auth1.userId).toBe(BASELINE_UUID);
      expect(auth2.userId).toBe(BASELINE_UUID);
      expect(auth3.userId).toBe(BASELINE_UUID);
      expect(auth1.universalIdentityId).toBe(BASELINE_UUID);
      expect(auth2.universalIdentityId).toBe(BASELINE_UUID);
      expect(auth3.universalIdentityId).toBe(BASELINE_UUID);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PHASE 8: Approval Message Verification (START & Interactive)
  // ─────────────────────────────────────────────────────────────
  describe('Phase 8: Sign-In Approval Message Verification', () => {
    it('Path A (START <pin>) sends rich confirmation containing Titan ID, Phone, and UUID', async () => {
      const challenge = await whatsappChallenge.createChallenge('E2E Browser');
      expect(challenge.waDeepLink).toBeDefined();

      const shortPin = challenge.waDeepLink.split('START%20')[1];
      expect(shortPin).toBeDefined();

      const handled = await whatsappChallenge.handleInboundMessage(
        `${BASELINE_TELEGRAM_ID}@s.whatsapp.net`,
        `START ${shortPin}`,
        { pushName: 'Marlik Marvin' }
      );

      expect(handled).toBe(true);
      expect(sentMessages.length).toBeGreaterThanOrEqual(1);

      const approvalMsg = sentMessages[sentMessages.length - 1].message;
      expect(approvalMsg).toContain('TITAN STREAM');
      expect(approvalMsg).toContain('titan_wa_256752762181');
      expect(approvalMsg).toContain(BASELINE_PHONE);
      expect(approvalMsg).toContain(BASELINE_UUID);
      expect(approvalMsg).toContain('BALANCE');
    });

    it('Path B (Interactive APPROVE / 1) sends rich confirmation containing Titan ID, Phone, and UUID', async () => {
      const challenge = await whatsappChallenge.createChallenge('E2E Interactive Browser');
      const pendingChal = (whatsappChallenge as any).challenges.get(challenge.challengeId);
      (whatsappChallenge as any).bindPhoneToChallenge(BASELINE_PHONE, challenge.challengeId);

      const handled = await whatsappChallenge.handleInboundMessage(
        `${BASELINE_TELEGRAM_ID}@s.whatsapp.net`,
        '1',
        { pushName: 'Marlik Marvin' }
      );

      expect(handled).toBe(true);
      expect(sentMessages.length).toBeGreaterThanOrEqual(1);

      const approvalMsg = sentMessages[sentMessages.length - 1].message;
      expect(approvalMsg).toContain('TITAN STREAM');
      expect(approvalMsg).toContain('titan_wa_256752762181');
      expect(approvalMsg).toContain(BASELINE_PHONE);
      expect(approvalMsg).toContain(BASELINE_UUID);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PHASE 9: Database Duplicate & Null Invariant Check
  // ─────────────────────────────────────────────────────────────
  describe('Phase 9: Database Null & Duplicate Integrity', () => {
    it('verifies 0 users with identity_id IS NULL in database', async () => {
      const nullCount = await prisma.user.count({
        where: { identityId: null as any },
      });
      expect(nullCount).toBe(0);

      // Verify baseline user is unique
      const users = await prisma.user.findMany({
        where: { telegramUserId: BigInt(BASELINE_TELEGRAM_ID) },
      });
      expect(users.length).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PHASE 11: Genuinely New Identity Test (Create Once, Resolve Next)
  // ─────────────────────────────────────────────────────────────
  describe('Phase 11: Genuinely New Identity Creation and Resolution', () => {
    it('creates brand new identity exactly once, then resolves on second login', async () => {
      const newPhone = `+256700${Math.floor(100000 + Math.random() * 900000)}`;

      // First authentication -> registers
      const authNew1 = await identityMaster.authenticate({
        provider: IdentityProvider.WHATSAPP,
        identifier: newPhone,
        displayName: 'New Operator',
      });

      expect(authNew1.userId).toBeDefined();
      expect(authNew1.universalIdentityId).toBe(authNew1.userId);
      expect(authNew1.assuranceLevel).toBe('MEDIUM');

      // Verify all domain records created
      const newCreatedUser = await prisma.user.findUnique({
        where: { id: authNew1.userId },
        include: {
          financialAccount: true,
          onboardingProgress: true,
          referralCode: true,
          trustProfile: true,
        },
      });

      expect(newCreatedUser).toBeDefined();
      expect(newCreatedUser!.identityId).toBe(authNew1.userId);
      expect(newCreatedUser!.financialAccount).toBeDefined();
      expect(newCreatedUser!.referralCode).toBeDefined();

      // Second authentication -> resolves existing
      const authNew2 = await identityMaster.authenticate({
        provider: IdentityProvider.WHATSAPP,
        identifier: newPhone,
      });

      expect(authNew2.userId).toBe(authNew1.userId);
      expect(authNew2.universalIdentityId).toBe(authNew1.userId);
      expect(authNew2.assuranceLevel).toBe('HIGH');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PHASE 12: Concurrent Authentication Race Condition Protection
  // ─────────────────────────────────────────────────────────────
  describe('Phase 12: Concurrent Authentication Race Protection', () => {
    it('handles parallel registration requests safely without duplicating accounts', async () => {
      const concurrentPhone = `+256788${Math.floor(100000 + Math.random() * 900000)}`;

      const [resA, resB] = await Promise.all([
        identityMaster.authenticate({
          provider: IdentityProvider.WHATSAPP,
          identifier: concurrentPhone,
          displayName: 'Concurrent User A',
        }),
        identityMaster.authenticate({
          provider: IdentityProvider.WHATSAPP,
          identifier: concurrentPhone,
          displayName: 'Concurrent User B',
        }),
      ]);

      expect(resA.userId).toBe(resB.userId);
      expect(resA.universalIdentityId).toBe(resB.universalIdentityId);

      // Verify only 1 User row exists for this phone
      const cleanDigits = concurrentPhone.replace(/\D/g, '');
      const channelIdentities = await prisma.channelIdentity.findMany({
        where: { provider: IdentityProvider.WHATSAPP, identifier: concurrentPhone },
      });
      expect(channelIdentities.length).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PHASE 14: Verification of All Identified Rogue Services
  // ─────────────────────────────────────────────────────────────
  describe('Phase 14: Verification of All Identified Rogue Services', () => {
    it('BotGateService resolves existing baseline user without creating duplicates', async () => {
      const { user, isNew } = await botGate.ensureUserIdentity({
        id: BigInt(BASELINE_TELEGRAM_ID),
        firstName: 'Marlik',
        lastName: 'Marvin',
        username: 'marlikm',
      });

      expect(user.id).toBe(BASELINE_UUID);
      expect(user.identityId).toBe(BASELINE_UUID);
      expect(isNew).toBe(false);
    });

    it('ProviderRegistryService resolves canonical user and does not auto-provision orphan', async () => {
      const { user, telegramUserId } = await providerRegistry.resolveUserAndTelegramId(BASELINE_UUID);
      expect(user).toBeDefined();
      expect(user.id).toBe(BASELINE_UUID);
      expect(telegramUserId).toBe(BigInt(BASELINE_TELEGRAM_ID));

      // Unknown string key must return user = null, NEVER create an orphan user
      const unknown = await providerRegistry.resolveUserAndTelegramId('non-existent-user-key-12345');
      expect(unknown.user).toBeNull();
    });

    it('WithdrawalService strictly throws NotFoundException for non-existent user', async () => {
      await expect(
        withdrawalService.initiateWithdrawal({
          telegramUserId: BigInt(999999999999),
          userId: 'non-existent-uuid',
          amount: 10,
          asset: 'USDT',
          network: 'TRC20',
          destinationAddress: 'T1234567890',
        } as any)
      ).rejects.toThrow(NotFoundException);
    });

    it('PaymentOrderService strictly throws NotFoundException for non-existent user', async () => {
      await expect(
        paymentOrderService.createOrder(BigInt(999999999999), {
          amount: 10,
          currency: 'UGX',
          network: 'MTN',
          country: 'UG',
          type: 'DEPOSIT',
        } as any)
      ).rejects.toThrow(NotFoundException);
    });
  });
});
