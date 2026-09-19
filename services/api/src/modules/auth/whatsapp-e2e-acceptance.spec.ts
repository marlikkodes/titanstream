import { Test, TestingModule } from '@nestjs/testing';
import { WhatsappChallengeService } from './whatsapp-challenge.service';
import { ConversationalRouterService } from '../conversational/conversational-router.service';
import { BaileysAccountManagerService } from '../notification/baileys-account-manager.service';
import { BaileysService } from '../notification/baileys.service';
import { PrismaService } from '../../database/prisma.service';
import { IdentityMasterEngineService } from '../identity/identity-master.service';
import { AuthService } from './auth.service';
import { BotNotificationService } from '../bot/bot-notification.service';
import { RewardService } from '../growth/reward.service';

describe('Titan Stream — 22-Step WhatsApp Auth End-to-End Acceptance Suite', () => {
  let whatsappChallenge: WhatsappChallengeService;
  let baileysManager: BaileysAccountManagerService;
  let identityMaster: IdentityMasterEngineService;
  let authService: AuthService;

  const mockPrisma = {
    baileysAccount: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
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
    authenticate: jest.fn().mockImplementation((dto) => {
      return Promise.resolve({
        userId: `usr_canonical_${dto.identifier.replace(/\D/g, '')}`,
        universalIdentityId: `uni_canonical_${dto.identifier.replace(/\D/g, '')}`,
        userState: 'READY',
        role: 'USER',
      });
    }),
  };

  const mockAuthService = {
    createTokensForUser: jest.fn().mockImplementation((userPayload) => {
      return Promise.resolve({
        accessToken: `at_test_${userPayload.id}`,
        refreshToken: `rt_test_${userPayload.id}`,
        user: userPayload,
      });
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsappChallengeService,
        BaileysAccountManagerService,
        ConversationalRouterService,
        { provide: BaileysService, useValue: { sendTextMessage: jest.fn().mockResolvedValue({ success: true, messageId: 'msg_123' }) } },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: IdentityMasterEngineService, useValue: mockIdentityMaster },
        { provide: AuthService, useValue: mockAuthService },
        { provide: BotNotificationService, useValue: { sendDirectMessage: jest.fn().mockResolvedValue(true) } },
        { provide: RewardService, useValue: {} },
      ],
    }).compile();

    whatsappChallenge = module.get<WhatsappChallengeService>(WhatsappChallengeService);
    baileysManager = module.get<BaileysAccountManagerService>(BaileysAccountManagerService);
    identityMaster = module.get<IdentityMasterEngineService>(IdentityMasterEngineService);
    authService = module.get<AuthService>(AuthService);
  });

  it('MUST pass complete 22-step authentication flow with deterministic identity and token issuance', async () => {
    const testPhone = '+256770000000';

    // Step 1 - 5: Browser generates challenge
    const challenge1 = whatsappChallenge.createChallenge('Desktop Chrome 120');
    expect(challenge1.challengeId).toBeDefined();
    const approvalToken1 = new URL(challenge1.waDeepLink).searchParams.get('text')?.replace('START ', '');
    expect(approvalToken1).toBeDefined();

    // Step 6 & 7: User sends START <PIN> over WhatsApp
    const inboundHandled1 = await whatsappChallenge.handleInboundMessage(
      '256770000000@s.whatsapp.net',
      `START ${approvalToken1}`
    );
    expect(inboundHandled1).toBe(true);

    // Step 8 - 12: Browser polls challenge status and receives APPROVED + session tokens
    const status1 = whatsappChallenge.getChallengeStatus(challenge1.challengeId, challenge1.browserProof) as any;
    expect(status1.status).toBe('APPROVED');
    expect(status1.accessToken).toBe('at_test_usr_canonical_256770000000');
    expect(status1.refreshToken).toBe('rt_test_usr_canonical_256770000000');
    expect(status1.user.id).toBe('usr_canonical_256770000000');

    // Step 13 - 15: Signout & start second login challenge for same user
    const challenge2 = whatsappChallenge.createChallenge('Mobile Safari');
    expect(challenge2.challengeId).not.toBe(challenge1.challengeId);
    const approvalToken2 = new URL(challenge2.waDeepLink).searchParams.get('text')?.replace('START ', '');

    // Step 16 & 17: User sends START <PIN2> for second login
    const inboundHandled2 = await whatsappChallenge.handleInboundMessage(
      '256770000000@s.whatsapp.net',
      `START ${approvalToken2}`
    );
    expect(inboundHandled2).toBe(true);

    // Step 18 - 22: Browser polls status and receives SAME canonical identity
    const status2 = whatsappChallenge.getChallengeStatus(challenge2.challengeId, challenge2.browserProof) as any;
    expect(status2.status).toBe('APPROVED');
    expect(status2.user.id).toBe('usr_canonical_256770000000'); // Verified SAME TitanUser ID!
  });

  it('rejects browser polling without its one-time browser proof and never approves arbitrary input', async () => {
    const challenge = whatsappChallenge.createChallenge('Fresh browser');

    expect(() => whatsappChallenge.getChallengeStatus(challenge.challengeId, 'not-the-browser-proof'))
      .toThrow('WHATSAPP_CHALLENGE_BROWSER_PROOF_INVALID');

    await expect(
      whatsappChallenge.handleInboundMessage('256770000000@s.whatsapp.net', 'START attacker-controlled-value'),
    ).resolves.toBe(false);

    expect(whatsappChallenge.getChallengeStatus(challenge.challengeId, challenge.browserProof)).toMatchObject({
      status: 'PENDING',
    });
  });
});
