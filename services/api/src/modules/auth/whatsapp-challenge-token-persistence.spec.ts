import { Test, TestingModule } from '@nestjs/testing';
import { WhatsappChallengeService } from './whatsapp-challenge.service';
import { IdentityMasterEngineService } from '../identity/identity-master.service';
import { AuthService } from './auth.service';
import { BaileysService } from '../notification/baileys.service';
import { ConversationalRouterService } from '../conversational/conversational-router.service';
import { PrismaService } from '../../database/prisma.service';

describe('WhatsappChallengeService - Token Persistence Fix', () => {
  let service: WhatsappChallengeService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsappChallengeService,
        {
          provide: IdentityMasterEngineService,
          useValue: {
            authenticate: jest.fn().mockResolvedValue({
              userId: 'test-user-id',
              universalIdentityId: 'test-identity-id',
              assuranceLevel: 'HIGH',
              role: 'USER',
              userState: 'READY',
              telegramUserId: undefined,
            }),
          },
        },
        {
          provide: AuthService,
          useValue: {
            createTokensForUser: jest.fn().mockResolvedValue({
              accessToken: 'test-access-token',
              refreshToken: 'test-refresh-token',
              user: { id: 'test-user-id', telegramUserId: undefined },
            }),
          },
        },
        {
          provide: BaileysService,
          useValue: {
            sendTextMessage: jest.fn().mockResolvedValue({
              success: true,
              messageId: 'test-message-id',
            }),
            getAuthTransportStatus: jest.fn().mockReturnValue({
              status: 'ACCOUNT_READY',
              hasCreds: true,
            }),
            isAuthTransportReady: jest.fn().mockReturnValue(true),
          },
        },
        {
          provide: ConversationalRouterService,
          useValue: {},
        },
        {
          provide: PrismaService,
          useValue: {
            baileysAccount: {
              findMany: jest.fn().mockResolvedValue([]),
            },
          },
        },
      ],
    }).compile();

    service = module.get<WhatsappChallengeService>(WhatsappChallengeService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Token Persistence after Challenge Approval', () => {
    it('should persist sessionTokens to shared file when challenge is approved', async () => {
      // Create a challenge
      const { challengeId, browserProof } = service.createChallenge('Test Device');

      // Simulate admin approval
      const challenge = service['challenges'].get(challengeId);
      expect(challenge).toBeDefined();
      expect(challenge?.status).toBe('PENDING');

      // Approve the challenge
      await service['approveChallengeDirect'](challenge!, '+1234567890');

      // Verify the challenge status changed to APPROVED
      const approvedChallenge = service['challenges'].get(challengeId);
      expect(approvedChallenge?.status).toBe('APPROVED');
      expect(approvedChallenge?.sessionTokens).toBeDefined();
      expect(approvedChallenge?.sessionTokens?.accessToken).toBe('test-access-token');
      expect(approvedChallenge?.sessionTokens?.refreshToken).toBe('test-refresh-token');

      // Load the challenge from shared file to verify persistence
      const status = service.getChallengeStatus(challengeId, browserProof);
      expect(status.status).toBe('APPROVED');
      // The actual return includes tokens when approved
      expect(status).toHaveProperty('accessToken', 'test-access-token');
      expect(status).toHaveProperty('refreshToken', 'test-refresh-token');
      expect(status).toHaveProperty('user');
    });

    it('should return EXPIRED if challenge is APPROVED but sessionTokens are missing', async () => {
      // Create a challenge
      const { challengeId, browserProof } = service.createChallenge('Test Device');

      // Manually set status to APPROVED without tokens (simulating the bug)
      const challenge = service['challenges'].get(challengeId);
      if (challenge) {
        challenge.status = 'APPROVED';
        // Intentionally don't set sessionTokens
      }

      // The status check should return EXPIRED when tokens are missing
      const status = service.getChallengeStatus(challengeId, browserProof);
      expect(status.status).toBe('EXPIRED');
    });

    it('should properly handle confirmation message send failures', async () => {
      // Mock sendTextMessage to fail
      const baileysService = service['baileysService'];
      (baileysService.sendTextMessage as jest.Mock).mockResolvedValue({
        success: false,
        error: 'BAILEYS_SOCKET_DISCONNECTED',
      });

      // Create and approve a challenge
      const { challengeId } = service.createChallenge('Test Device');
      const challenge = service['challenges'].get(challengeId);
      
      // This should not throw even if message send fails
      await expect(service['approveChallengeDirect'](challenge!, '+1234567890')).resolves.not.toThrow();

      // Challenge should still be approved
      const approvedChallenge = service['challenges'].get(challengeId);
      expect(approvedChallenge?.status).toBe('APPROVED');
      expect(approvedChallenge?.sessionTokens).toBeDefined();
    });
  });

  describe('Challenge Status Retrieval', () => {
    it('should restore sessionTokens from shared file', async () => {
      // Create a challenge
      const { challengeId, browserProof } = service.createChallenge('Test Device');

      // Approve the challenge
      const challenge = service['challenges'].get(challengeId);
      await service['approveChallengeDirect'](challenge!, '+1234567890');

      // Clear in-memory cache to simulate process restart
      service['challenges'].clear();
      service['approvalTokenHashToChallengeId'].clear();

      // Load from shared file should restore tokens
      const status = service.getChallengeStatus(challengeId, browserProof);
      expect(status.status).toBe('APPROVED');
      expect(status).toHaveProperty('accessToken', 'test-access-token');
      expect(status).toHaveProperty('refreshToken', 'test-refresh-token');
    });
  });
});