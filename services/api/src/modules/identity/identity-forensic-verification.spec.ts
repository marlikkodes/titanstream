import { Test, TestingModule } from '@nestjs/testing';
import { IdentityMasterEngineService } from './identity-master.service';
import { UserService } from '../user/user.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { IdentityProvider, UserState } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

describe('Identity Persistence Forensic Verification', () => {
  let identityEngine: IdentityMasterEngineService;
  let userService: UserService;
  let prismaMock: any;
  let auditMock: any;

  const CANONICAL_UUID = '550e8400-e29b-41d4-a716-446655440000';
  const TELEGRAM_USER_ID = 987654321n;
  const WHATSAPP_PHONE = '+256700112233';

  beforeEach(async () => {
    prismaMock = {
      channelIdentity: {
        findUnique: jest.fn(),
        create: jest.fn(),
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
      financialAccount: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      onboardingProgress: { create: jest.fn() },
      referralCode: { create: jest.fn() },
      userTrustProfile: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      userLevelRecord: { create: jest.fn() },
      notificationPreference: { create: jest.fn() },
      $transaction: jest.fn((cb) => cb(prismaMock)),
    };

    auditMock = {
      createWithClient: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdentityMasterEngineService,
        UserService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();

    identityEngine = module.get<IdentityMasterEngineService>(IdentityMasterEngineService);
    userService = module.get<UserService>(UserService);
  });

  describe('Scenario 1: Returning Telegram User Stability', () => {
    it('reliably resolves to the existing canonical UUID and existing user without creating new records', async () => {
      const existingChannel = {
        id: 'chan_tg_existing',
        identityId: CANONICAL_UUID,
        provider: IdentityProvider.TELEGRAM,
        identifier: String(TELEGRAM_USER_ID),
        identity: {
          id: CANONICAL_UUID,
          displayName: 'Test Operator',
          user: {
            id: CANONICAL_UUID,
            identityId: CANONICAL_UUID,
            telegramUserId: TELEGRAM_USER_ID,
            state: UserState.ACTIVE_USER,
          },
        },
      };

      prismaMock.channelIdentity.findUnique.mockResolvedValue(existingChannel);
      prismaMock.user.update.mockResolvedValue(existingChannel.identity.user);

      // Authenticate multiple times
      const auth1 = await identityEngine.authenticate({
        provider: IdentityProvider.TELEGRAM,
        identifier: String(TELEGRAM_USER_ID),
      });

      const auth2 = await identityEngine.authenticate({
        provider: IdentityProvider.TELEGRAM,
        identifier: String(TELEGRAM_USER_ID),
      });

      expect(auth1.userId).toBe(CANONICAL_UUID);
      expect(auth2.userId).toBe(CANONICAL_UUID);
      expect(auth1.universalIdentityId).toBe(CANONICAL_UUID);
      expect(auth2.universalIdentityId).toBe(CANONICAL_UUID);

      // Verify zero creation calls
      expect(prismaMock.user.create).not.toHaveBeenCalled();
      expect(prismaMock.universalIdentity.create).not.toHaveBeenCalled();
      expect(prismaMock.financialAccount.create).not.toHaveBeenCalled();
    });
  });

  describe('Scenario 2: Returning WhatsApp User Stability', () => {
    it('reliably resolves to the existing canonical UUID without creating duplicate accounts', async () => {
      const existingChannel = {
        id: 'chan_wa_existing',
        identityId: CANONICAL_UUID,
        provider: IdentityProvider.WHATSAPP,
        identifier: WHATSAPP_PHONE,
        identity: {
          id: CANONICAL_UUID,
          displayName: 'WhatsApp Operator',
          user: {
            id: CANONICAL_UUID,
            identityId: CANONICAL_UUID,
            telegramUserId: 256700112233n,
            state: UserState.ACTIVE_USER,
          },
        },
      };

      prismaMock.channelIdentity.findUnique.mockResolvedValue(existingChannel);
      prismaMock.user.update.mockResolvedValue(existingChannel.identity.user);

      const auth = await identityEngine.authenticate({
        provider: IdentityProvider.WHATSAPP,
        identifier: WHATSAPP_PHONE,
      });

      expect(auth.userId).toBe(CANONICAL_UUID);
      expect(auth.universalIdentityId).toBe(CANONICAL_UUID);
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });
  });

  describe('Scenario 3: Zero Phantom User Fabrication in UserService', () => {
    it('throws NotFoundException and does NOT return Operator / ACTIVE_USER when user is missing', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(userService.getProfile(CANONICAL_UUID)).rejects.toThrow(NotFoundException);
      await expect(userService.getProfile(TELEGRAM_USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException and does NOT fabricate trust score 85 when trust profile is missing', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: CANONICAL_UUID,
        telegramUserId: TELEGRAM_USER_ID,
      });
      prismaMock.userTrustProfile.findFirst.mockResolvedValue(null);

      await expect(userService.getTrustProfile(CANONICAL_UUID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('Scenario 4: Identifier Type Safety', () => {
    it('preserves UUID format and queries by id/identityId without digit-stripping', async () => {
      const mockUser = {
        id: CANONICAL_UUID,
        identityId: CANONICAL_UUID,
        telegramUserId: TELEGRAM_USER_ID,
      };
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      await userService.getProfile(CANONICAL_UUID);

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: CANONICAL_UUID },
        include: expect.any(Object),
      });
    });

    it('properly routes numeric string to telegramUserId lookup', async () => {
      const mockUser = {
        id: CANONICAL_UUID,
        telegramUserId: TELEGRAM_USER_ID,
      };
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      await userService.getProfile(String(TELEGRAM_USER_ID));

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { telegramUserId: TELEGRAM_USER_ID },
        include: expect.any(Object),
      });
    });
  });
});
