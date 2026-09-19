import { Test, TestingModule } from '@nestjs/testing';
import { IdentityMasterEngineService } from './identity-master.service';
import { WebAuthSessionService } from '../auth/web-auth-session.service';
import { PrismaService } from '../../database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { IdentityProvider, UserState } from '@prisma/client';

describe('Identity Persistence & Sign-in Approval Remediation (Phase 8 Verification)', () => {
  let identityService: IdentityMasterEngineService;
  let webAuthService: WebAuthSessionService;
  let prismaMock: any;
  let jwtMock: any;

  const CANONICAL_USER_UUID = '550e8400-e29b-41d4-a716-446655440000';
  const TELEGRAM_ID = 256752762181;
  const PHONE_NUMBER = '+256752762181';

  beforeEach(async () => {
    prismaMock = {
      channelIdentity: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
      },
      universalIdentity: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      financialAccount: { create: jest.fn() },
      onboardingProgress: { create: jest.fn() },
      referralCode: { create: jest.fn() },
      userTrustProfile: { create: jest.fn() },
      userLevelRecord: { create: jest.fn() },
      notificationPreference: { create: jest.fn() },
      $transaction: jest.fn((callback) => callback(prismaMock)),
    };

    jwtMock = {
      sign: jest.fn((payload) => `jwt_token_for_${payload.sub || payload.userId}`),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdentityMasterEngineService,
        WebAuthSessionService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
      ],
    }).compile();

    identityService = module.get<IdentityMasterEngineService>(IdentityMasterEngineService);
    webAuthService = module.get<WebAuthSessionService>(WebAuthSessionService);
  });

  describe('Test 1: Repeat Login Idempotency & Invariant Verification', () => {
    it('resolves the same canonical User UUID on repeated authentications without recreating accounts', async () => {
      // Mock existing canonical user
      const existingRecord = {
        id: 'chan_wa_1',
        identityId: CANONICAL_USER_UUID,
        provider: IdentityProvider.WHATSAPP,
        identifier: PHONE_NUMBER,
        identity: {
          id: CANONICAL_USER_UUID,
          displayName: 'Marlik Marvin',
          user: {
            id: CANONICAL_USER_UUID,
            identityId: CANONICAL_USER_UUID,
            telegramUserId: BigInt(TELEGRAM_ID),
            state: UserState.READY,
          },
        },
      };

      prismaMock.channelIdentity.findUnique.mockResolvedValue(existingRecord);
      prismaMock.user.update.mockResolvedValue(existingRecord.identity.user);

      // First authentication
      const auth1 = await identityService.authenticate({
        provider: IdentityProvider.WHATSAPP,
        identifier: PHONE_NUMBER,
      });

      // Second authentication
      const auth2 = await identityService.authenticate({
        provider: IdentityProvider.WHATSAPP,
        identifier: PHONE_NUMBER,
      });

      // Third authentication
      const auth3 = await identityService.authenticate({
        provider: IdentityProvider.WHATSAPP,
        identifier: PHONE_NUMBER,
      });

      // Assertions
      expect(auth1.userId).toBe(CANONICAL_USER_UUID);
      expect(auth2.userId).toBe(CANONICAL_USER_UUID);
      expect(auth3.userId).toBe(CANONICAL_USER_UUID);
      expect(auth1.universalIdentityId).toBe(CANONICAL_USER_UUID);

      // Verify zero creation calls on repeat login
      expect(prismaMock.user.create).not.toHaveBeenCalled();
      expect(prismaMock.universalIdentity.create).not.toHaveBeenCalled();
      expect(prismaMock.financialAccount.create).not.toHaveBeenCalled();
      expect(prismaMock.referralCode.create).not.toHaveBeenCalled();
    });
  });

  describe('Test 2: WebAuthSessionService Canonical Identity Integration', () => {
    it('authorizes web session using IdentityMasterEngine and sets JWT sub to canonical User UUID', async () => {
      const { sessionCode } = webAuthService.createWebAuthSession();

      const existingRecord = {
        id: 'chan_tg_1',
        identityId: CANONICAL_USER_UUID,
        provider: IdentityProvider.TELEGRAM,
        identifier: String(TELEGRAM_ID),
        identity: {
          id: CANONICAL_USER_UUID,
          displayName: 'Marlik Marvin',
          user: {
            id: CANONICAL_USER_UUID,
            identityId: CANONICAL_USER_UUID,
            telegramUserId: BigInt(TELEGRAM_ID),
            state: UserState.READY,
          },
        },
      };

      prismaMock.channelIdentity.findUnique.mockResolvedValue(existingRecord);
      prismaMock.user.update.mockResolvedValue(existingRecord.identity.user);

      const success = await webAuthService.authorizeWebSessionViaTelegram(sessionCode, {
        id: TELEGRAM_ID,
        first_name: 'Marlik',
        last_name: 'Marvin',
        username: 'marlikm',
      });

      expect(success).toBe(true);

      const pollResult: any = webAuthService.pollWebAuthSession(sessionCode);
      expect(pollResult.status).toBe('AUTHENTICATED');
      expect(pollResult.user.id).toBe(CANONICAL_USER_UUID);
      expect(pollResult.user.identityId).toBe(CANONICAL_USER_UUID);

      // Verify JWT sub is the canonical UUID, NOT the raw numeric Telegram ID
      expect(jwtMock.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: CANONICAL_USER_UUID,
          userId: CANONICAL_USER_UUID,
          titanUserId: CANONICAL_USER_UUID,
          telegramUserId: TELEGRAM_ID,
        }),
        expect.any(Object)
      );
    });
  });

  describe('Test 3: Atomic First-Time Registration', () => {
    it('atomically creates UniversalIdentity, User (User.id === UniversalIdentity.id), and domain records', async () => {
      prismaMock.channelIdentity.findUnique.mockResolvedValue(null);
      prismaMock.universalIdentity.create.mockResolvedValue({ id: CANONICAL_USER_UUID, displayName: 'New User' });
      prismaMock.user.create.mockResolvedValue({
        id: CANONICAL_USER_UUID,
        identityId: CANONICAL_USER_UUID,
        telegramUserId: BigInt(TELEGRAM_ID),
        state: UserState.READY,
      });
      prismaMock.channelIdentity.create.mockResolvedValue({
        id: 'chan_new',
        identityId: CANONICAL_USER_UUID,
        provider: IdentityProvider.TELEGRAM,
        identifier: String(TELEGRAM_ID),
      });

      const res = await identityService.register({
        provider: IdentityProvider.TELEGRAM,
        identifier: String(TELEGRAM_ID),
        displayName: 'New User',
      });

      expect(res.userId).toBe(CANONICAL_USER_UUID);
      expect(res.universalIdentityId).toBe(CANONICAL_USER_UUID);
      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(prismaMock.universalIdentity.create).toHaveBeenCalled();
      expect(prismaMock.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id: CANONICAL_USER_UUID,
            identityId: CANONICAL_USER_UUID,
          }),
        })
      );
      expect(prismaMock.financialAccount.create).toHaveBeenCalled();
      expect(prismaMock.onboardingProgress.create).toHaveBeenCalled();
      expect(prismaMock.referralCode.create).toHaveBeenCalled();
      expect(prismaMock.userTrustProfile.create).toHaveBeenCalled();
    });
  });
});
