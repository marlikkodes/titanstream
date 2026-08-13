import { Test, TestingModule } from '@nestjs/testing';
import { IdentityMasterEngineService } from './identity-master.service';
import { PrismaService } from '../../database/prisma.service';
import { IdentityProvider, UserState } from '@prisma/client';
import { ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';

describe('IdentityMasterEngineService', () => {
  let service: IdentityMasterEngineService;
  let prismaMock: any;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdentityMasterEngineService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<IdentityMasterEngineService>(IdentityMasterEngineService);
  });

  describe('Registration & Authentication Engine', () => {
    it('should register a new user with User.id === UniversalIdentity.id', async () => {
      const mockUuid = '550e8400-e29b-41d4-a716-446655440000';
      prismaMock.channelIdentity.findUnique.mockResolvedValue(null);
      prismaMock.universalIdentity.create.mockResolvedValue({ id: mockUuid, displayName: 'Test User' });
      prismaMock.user.create.mockResolvedValue({
        id: mockUuid,
        identityId: mockUuid,
        telegramUserId: BigInt(123456789),
        state: UserState.NEW,
      });
      prismaMock.channelIdentity.create.mockResolvedValue({
        id: 'chan_123',
        identityId: mockUuid,
        provider: IdentityProvider.TELEGRAM,
        identifier: '123456789',
      });

      const res = await service.register({
        provider: IdentityProvider.TELEGRAM,
        identifier: '123456789',
        displayName: 'Test User',
      });

      expect(res.userId).toBe(mockUuid);
      expect(res.universalIdentityId).toBe(mockUuid);
      expect(res.channel).toBe(IdentityProvider.TELEGRAM);
      expect(prismaMock.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id: mockUuid,
            identityId: mockUuid,
          }),
        }),
      );
    });

    it('should register a WhatsApp-only user without a Telegram ID', async () => {
      const mockUuid = 'wa-uuid-9999-8888';
      prismaMock.channelIdentity.findUnique.mockResolvedValue(null);
      prismaMock.universalIdentity.create.mockResolvedValue({ id: mockUuid, displayName: '+256770000000' });
      prismaMock.user.create.mockResolvedValue({
        id: mockUuid,
        identityId: mockUuid,
        telegramUserId: null,
        state: UserState.NEW,
      });
      prismaMock.channelIdentity.create.mockResolvedValue({
        id: 'chan_wa_1',
        identityId: mockUuid,
        provider: IdentityProvider.WHATSAPP,
        identifier: '+256770000000',
      });

      const res = await service.register({
        provider: IdentityProvider.WHATSAPP,
        identifier: '+256770000000',
      });

      expect(res.userId).toBe(mockUuid);
      expect(res.channel).toBe(IdentityProvider.WHATSAPP);
      expect(res.providerSubject).toBe('+256770000000');
    });

    it('should authenticate an existing identity without duplicate creation', async () => {
      const mockUuid = 'existing-uuid-1111';
      prismaMock.channelIdentity.findUnique.mockResolvedValue({
        id: 'chan_1',
        identityId: mockUuid,
        provider: IdentityProvider.TELEGRAM,
        identifier: '123456789',
        identity: {
          id: mockUuid,
          users: [
            {
              id: mockUuid,
              identityId: mockUuid,
              telegramUserId: BigInt(123456789),
              state: UserState.ACTIVE_USER,
            },
          ],
        },
      });
      prismaMock.user.update.mockResolvedValue({ id: mockUuid });

      const res = await service.authenticate({
        provider: IdentityProvider.TELEGRAM,
        identifier: '123456789',
      });

      expect(res.userId).toBe(mockUuid);
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });
  });

  describe('Multi-Channel Account Linking & Conflict Safeguards', () => {
    it('should link a new WhatsApp channel to an existing Telegram user', async () => {
      const userId = 'user-uuid-1';
      const identityId = 'identity-uuid-1';
      prismaMock.user.findUnique.mockResolvedValue({ id: userId, identityId });
      prismaMock.channelIdentity.findUnique.mockResolvedValue(null);
      prismaMock.channelIdentity.create.mockResolvedValue({
        id: 'chan_wa_new',
        identityId,
        provider: IdentityProvider.WHATSAPP,
        identifier: '+256771112223',
      });

      const res = await service.linkChannel({
        userId,
        provider: IdentityProvider.WHATSAPP,
        identifier: '+256771112223',
      });

      expect(res.id).toBe('chan_wa_new');
      expect(prismaMock.channelIdentity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            identityId,
            provider: IdentityProvider.WHATSAPP,
            identifier: '+256771112223',
          }),
        }),
      );
    });

    it('should throw ConflictException when linking a channel bound to a different Titan account', async () => {
      const userId = 'user-uuid-1';
      prismaMock.user.findUnique.mockResolvedValue({ id: userId, identityId: 'identity-uuid-1' });
      prismaMock.channelIdentity.findUnique.mockResolvedValue({
        id: 'chan_wa_other',
        identityId: 'identity-uuid-OTHER',
        provider: IdentityProvider.WHATSAPP,
        identifier: '+256771112223',
      });

      await expect(
        service.linkChannel({
          userId,
          provider: IdentityProvider.WHATSAPP,
          identifier: '+256771112223',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should prevent unlinking the sole anchor channel of an account', async () => {
      const userId = 'user-uuid-1';
      prismaMock.user.findUnique.mockResolvedValue({ id: userId, identityId: 'identity-uuid-1' });
      prismaMock.channelIdentity.findMany.mockResolvedValue([
        { id: 'c1', provider: IdentityProvider.TELEGRAM, identifier: '123456' },
      ]);

      await expect(
        service.unlinkChannel({
          userId,
          provider: IdentityProvider.TELEGRAM,
          identifier: '123456',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Ownership Assertion', () => {
    it('should pass when requesting userId matches resource owner', () => {
      expect(() => service.assertOwnership('user-1', 'user-1')).not.toThrow();
    });

    it('should throw ForbiddenException when requesting userId does not match resource owner', () => {
      expect(() => service.assertOwnership('user-1', 'user-2')).toThrow(ForbiddenException);
    });
  });
});
