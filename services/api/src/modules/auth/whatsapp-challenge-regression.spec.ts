import { Test, TestingModule } from '@nestjs/testing';
import { WhatsappChallengeService } from './whatsapp-challenge.service';
import { IdentityMasterEngineService } from '../identity/identity-master.service';
import { AuthService } from './auth.service';
import { BaileysService } from '../notification/baileys.service';
import { PrismaService } from '../../database/prisma.service';
import { UnauthorizedException } from '@nestjs/common';

describe('WhatsApp Challenge Regression Tests', () => {
  let service: WhatsappChallengeService;
  let mockIdentityMaster: jest.Mocked<IdentityMasterEngineService>;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockBaileysService: jest.Mocked<BaileysService>;
  let mockPrisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    mockIdentityMaster = {
      authenticate: jest.fn(),
    } as any;

    mockAuthService = {
      createTokensForUser: jest.fn(),
    } as any;

    mockBaileysService = {
      sendTextMessage: jest.fn().mockResolvedValue(undefined),
      getAuthTransportStatus: jest.fn().mockReturnValue({ status: 'ACCOUNT_READY', hasCreds: true }),
      isAuthTransportReady: jest.fn().mockReturnValue(true),
    } as any;

    mockPrisma = {
      baileysAuthKey: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsappChallengeService,
        {
          provide: IdentityMasterEngineService,
          useValue: mockIdentityMaster,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: BaileysService,
          useValue: mockBaileysService,
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<WhatsappChallengeService>(WhatsappChallengeService);
  });

  describe('Session Creation', () => {
    it('should create a valid challenge with 6-digit approval token', () => {
      const result = service.createChallenge('Test Device');
      
      expect(result).toBeDefined();
      expect(result.challengeId).toMatch(/^wa_ch_/);
      expect(result.browserProof).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.waDeepLink).toContain('wa.me/');
      expect(result.waDeepLink).toContain('START%20');
      expect(result.transportReady).toBe(true);
    });

    it('should generate unique challenge IDs', () => {
      const challenge1 = service.createChallenge('Device1');
      const challenge2 = service.createChallenge('Device2');
      
      expect(challenge1.challengeId).not.toBe(challenge2.challengeId);
      expect(challenge1.browserProof).not.toBe(challenge2.browserProof);
    });

    it('should set 10-minute expiration on challenges', () => {
      const now = Date.now();
      const result = service.createChallenge('Test Device');
      
      const expiresAt = new Date(result.expiresAt).getTime();
      const expectedExpiry = now + 10 * 60 * 1000;
      
      expect(expiresAt).toBeGreaterThan(expectedExpiry - 1000); // Allow 1s tolerance
      expect(expiresAt).toBeLessThan(expectedExpiry + 1000);
    });
  });

  describe('QR Generation and Delivery', () => {
    it('should generate WhatsApp deep link with 6-digit code', () => {
      const result = service.createChallenge('Test Device');
      
      expect(result.waDeepLink).toMatch(/https:\/\/wa\.me\/\d+\?text=START%20\d{6}/);
    });

    it('should include bot phone from environment', () => {
      process.env.WHATSAPP_BOT_PHONE = '+1234567890';
      const result = service.createChallenge('Test Device');
      
      expect(result.waDeepLink).toContain('1234567890');
    });
  });

  describe('Scan/Handshake Transition', () => {
    it('should reject malformed START messages', async () => {
      const handled = await service.handleInboundMessage('+1234567890@s.whatsapp.net', 'START invalid', {
        rawJid: '+1234567890@s.whatsapp.net',
      });

      expect(handled).toBe(false);
    });

    it('should reject unknown challenge codes', async () => {
      const handled = await service.handleInboundMessage('+1234567890@s.whatsapp.net', 'START 999999', {
        rawJid: '+1234567890@s.whatsapp.net',
      });

      expect(handled).toBe(false);
    });
  });

  describe('Connection Update States', () => {
    it('should return PENDING status for active challenges', () => {
      const challenge = service.createChallenge('Test Device');
      
      const status = service.getChallengeStatus(challenge.challengeId, challenge.browserProof);
      
      expect(status.status).toBe('PENDING');
    });

    it('should reject invalid browser proof', () => {
      const challenge = service.createChallenge('Test Device');
      
      expect(() => {
        service.getChallengeStatus(challenge.challengeId, 'invalid-proof');
      }).toThrow(UnauthorizedException);
    });
  });

  describe('Identity Resolution', () => {
    it('should handle START {code} message and approve challenge', async () => {
      const challenge = service.createChallenge('Test Device');
      const codeMatch = challenge.waDeepLink.match(/START%20(\d{6})/);
      const code = codeMatch ? codeMatch[1] : '000000';
      
      mockIdentityMaster.authenticate.mockResolvedValue({
        userId: 'test-user-id',
        universalIdentityId: 'test-identity-id',
        channel: 'WHATSAPP',
        channelIdentityId: 'test-channel-id',
        providerSubject: '+1234567890',
        assuranceLevel: 'HIGH',
        role: 'USER',
        userState: 'READY',
        telegramUserId: undefined,
      });

      mockAuthService.createTokensForUser.mockResolvedValue({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        user: { 
          id: 'test-user-id',
          identityId: 'test-identity-id',
          telegramUserId: 123456789,
          telegramUsername: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          photoUrl: null,
          languageCode: 'en',
          state: 'READY',
          isReady: true,
          createdAt: new Date().toISOString(),
        },
      });

      const handled = await service.handleInboundMessage('+1234567890@s.whatsapp.net', `START ${code}`, {
        rawJid: '+1234567890@s.whatsapp.net',
        pushName: 'Test User',
      });

      expect(handled).toBe(true);
      expect(mockIdentityMaster.authenticate).toHaveBeenCalledWith({
        provider: 'WHATSAPP',
        identifier: '+1234567890',
        displayName: expect.any(String),
        metadata: expect.any(Object),
      });
    });

    it('should use canonical Titan user ID for JWT subject', async () => {
      const challenge = service.createChallenge('Test Device');
      
      mockIdentityMaster.authenticate.mockResolvedValue({
        userId: 'canonical-user-id',
        universalIdentityId: 'canonical-identity-id',
        channel: 'WHATSAPP',
        channelIdentityId: 'test-channel-id',
        providerSubject: '+1234567890',
        assuranceLevel: 'HIGH',
        role: 'USER',
        userState: 'READY',
        telegramUserId: undefined,
      });

      mockAuthService.createTokensForUser.mockResolvedValue({
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        user: { 
          id: 'canonical-user-id',
          identityId: 'canonical-identity-id',
          telegramUserId: 123456789,
          telegramUsername: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          photoUrl: null,
          languageCode: 'en',
          state: 'READY',
          isReady: true,
          createdAt: new Date().toISOString(),
        },
      });

      const codeMatch = challenge.waDeepLink.match(/START%20(\d{6})/);
      const code = codeMatch ? codeMatch[1] : '000000';

      await service.handleInboundMessage('+1234567890@s.whatsapp.net', `START ${code}`, {
        rawJid: '+1234567890@s.whatsapp.net',
        pushName: 'Test User',
      });

      expect(mockAuthService.createTokensForUser).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'canonical-user-id',
          identityId: 'canonical-identity-id',
        })
      );
    });
  });

  describe('No Fallback User Creation', () => {
    it('should never create User directly in challenge approval', async () => {
      const challenge = service.createChallenge('Test Device');
      
      mockIdentityMaster.authenticate.mockResolvedValue({
        userId: 'existing-user-id',
        universalIdentityId: 'existing-identity-id',
        channel: 'WHATSAPP',
        channelIdentityId: 'test-channel-id',
        providerSubject: '+1234567890',
        assuranceLevel: 'HIGH',
        role: 'USER',
        userState: 'READY',
        telegramUserId: undefined,
      });

      mockAuthService.createTokensForUser.mockResolvedValue({
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        user: { 
          id: 'existing-user-id',
          identityId: 'existing-identity-id',
          telegramUserId: 123456789,
          telegramUsername: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          photoUrl: null,
          languageCode: 'en',
          state: 'READY',
          isReady: true,
          createdAt: new Date().toISOString(),
        },
      });

      const codeMatch = challenge.waDeepLink.match(/START%20(\d{6})/);
      const code = codeMatch ? codeMatch[1] : '000000';

      await service.handleInboundMessage('+1234567890@s.whatsapp.net', `START ${code}`, {
        rawJid: '+1234567890@s.whatsapp.net',
        pushName: 'Test User',
      });

      // Verify that identity resolution is used, not direct user creation
      expect(mockIdentityMaster.authenticate).toHaveBeenCalled();
      expect(mockIdentityMaster.authenticate).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'WHATSAPP',
        })
      );
    });

    it('should fail authentication if IdentityMasterEngine fails', async () => {
      const challenge = service.createChallenge('Test Device');
      
      mockIdentityMaster.authenticate.mockRejectedValue(new Error('Identity resolution failed'));

      const codeMatch = challenge.waDeepLink.match(/START%20(\d{6})/);
      const code = codeMatch ? codeMatch[1] : '000000';

      await expect(
        service.handleInboundMessage('+1234567890@s.whatsapp.net', `START ${code}`, {
          rawJid: '+1234567890@s.whatsapp.net',
          pushName: 'Test User',
        })
      ).rejects.toThrow('Identity resolution failed');
    });
  });

  describe('Duplicate Socket Prevention', () => {
    it('should handle multiple concurrent challenge requests safely', () => {
      const challenge1 = service.createChallenge('Device1');
      const challenge2 = service.createChallenge('Device2');
      const challenge3 = service.createChallenge('Device3');

      expect(challenge1.challengeId).not.toBe(challenge2.challengeId);
      expect(challenge2.challengeId).not.toBe(challenge3.challengeId);
      expect(challenge1.challengeId).not.toBe(challenge3.challengeId);
    });

    it('should maintain separate challenge states', async () => {
      const challenge1 = service.createChallenge('Device1');
      const challenge2 = service.createChallenge('Device2');

      // Approve first challenge
      mockIdentityMaster.authenticate.mockResolvedValue({
        userId: 'user-1',
        universalIdentityId: 'identity-1',
        channel: 'WHATSAPP',
        channelIdentityId: 'channel-1',
        providerSubject: '+1111111111',
        assuranceLevel: 'HIGH',
        role: 'USER',
        userState: 'READY',
        telegramUserId: undefined,
      });

      mockAuthService.createTokensForUser.mockResolvedValue({
        accessToken: 'token-1',
        refreshToken: 'refresh-1',
        user: { 
          id: 'user-1',
          identityId: 'identity-1',
          telegramUserId: 1111111111,
          telegramUsername: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          photoUrl: null,
          languageCode: 'en',
          state: 'READY',
          isReady: true,
          createdAt: new Date().toISOString(),
        },
      });

      const code1Match = challenge1.waDeepLink.match(/START%20(\d{6})/);
      const code1 = code1Match ? code1Match[1] : '000000';

      await service.handleInboundMessage('+1111111111@s.whatsapp.net', `START ${code1}`, {
        rawJid: '+1111111111@s.whatsapp.net',
      });

      // Second challenge should still be pending
      const status2 = service.getChallengeStatus(challenge2.challengeId, challenge2.browserProof);
      expect(status2.status).toBe('PENDING');
    });
  });

  describe('Failed Authentication', () => {
    it('should not create session on invalid challenge', async () => {
      const handled = await service.handleInboundMessage('+1234567890@s.whatsapp.net', 'START 999999', {
        rawJid: '+1234567890@s.whatsapp.net',
      });

      expect(handled).toBe(false);
      expect(mockIdentityMaster.authenticate).not.toHaveBeenCalled();
      expect(mockAuthService.createTokensForUser).not.toHaveBeenCalled();
    });

    it('should not create session on malformed message', async () => {
      const handled = await service.handleInboundMessage('+1234567890@s.whatsapp.net', 'INVALID_START_DATA', {
        rawJid: '+1234567890@s.whatsapp.net',
      });

      expect(handled).toBe(true); // Delegated to conversational router
      expect(mockIdentityMaster.authenticate).not.toHaveBeenCalled();
    });
  });

  describe('Phone Normalization', () => {
    it('should normalize phone numbers to E.164 format', async () => {
      const challenge = service.createChallenge('Test Device');
      
      mockIdentityMaster.authenticate.mockResolvedValue({
        userId: 'test-user-id',
        universalIdentityId: 'test-identity-id',
        channel: 'WHATSAPP',
        channelIdentityId: 'test-channel-id',
        providerSubject: '+1234567890',
        assuranceLevel: 'HIGH',
        role: 'USER',
        userState: 'READY',
        telegramUserId: undefined,
      });

      mockAuthService.createTokensForUser.mockResolvedValue({
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        user: { 
          id: 'test-user-id',
          identityId: 'test-identity-id',
          telegramUserId: 123456789,
          telegramUsername: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          photoUrl: null,
          languageCode: 'en',
          state: 'READY',
          isReady: true,
          createdAt: new Date().toISOString(),
        },
      });

      const codeMatch = challenge.waDeepLink.match(/START%20(\d{6})/);
      const code = codeMatch ? codeMatch[1] : '000000';

      // Test various phone formats
      await service.handleInboundMessage('1234567890@s.whatsapp.net', `START ${code}`, {
        rawJid: '1234567890@s.whatsapp.net',
      });

      expect(mockIdentityMaster.authenticate).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: '+1234567890',
        })
      );
    });
  });
});