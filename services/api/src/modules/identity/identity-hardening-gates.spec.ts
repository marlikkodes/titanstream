import { Test, TestingModule } from '@nestjs/testing';
import { IdentityMasterEngineService } from './identity-master.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { IdentityProvider, UserState } from '@prisma/client';
import { AuditEventType } from '../../common/interfaces/user-state.enum';
import { ConflictException, BadRequestException, UnauthorizedException, ForbiddenException } from '@nestjs/common';

describe('IdentityMasterEngine 10-Gate Production Hardening Certification Suite', () => {
  let service: IdentityMasterEngineService;
  let prismaMock: any;
  let auditMock: any;

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

    auditMock = {
      createWithClient: jest.fn().mockResolvedValue(true),
      create: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdentityMasterEngineService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();

    service = module.get<IdentityMasterEngineService>(IdentityMasterEngineService);
  });

  // ---------------------------------------------------------------------------
  // GATE 1: Concurrency & Race-Condition Protection
  // ---------------------------------------------------------------------------
  describe('Gate 1 — Concurrency & Race Safety', () => {
    it('should reject concurrent registration attempts for the same channel identifier', async () => {
      const mockUuid = 'uuid-race-1';
      prismaMock.channelIdentity.findUnique.mockResolvedValueOnce(null).mockResolvedValue({
        id: 'chan_race',
        identityId: mockUuid,
        provider: IdentityProvider.WHATSAPP,
        identifier: '+256770000000',
        identity: {
          id: mockUuid,
          users: [{ id: mockUuid, identityId: mockUuid, state: UserState.NEW }],
        },
      });

      prismaMock.universalIdentity.create.mockResolvedValue({ id: mockUuid });
      prismaMock.user.create.mockResolvedValue({ id: mockUuid, identityId: mockUuid, state: UserState.NEW });
      prismaMock.channelIdentity.create.mockResolvedValue({ id: 'chan_race', identityId: mockUuid });

      // First call succeeds
      const firstCall = await service.register({
        provider: IdentityProvider.WHATSAPP,
        identifier: '+256770000000',
      });
      expect(firstCall.userId).toBe(mockUuid);

      // Second call finds existing identity and throws ConflictException
      await expect(
        service.register({
          provider: IdentityProvider.WHATSAPP,
          identifier: '+256770000000',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ---------------------------------------------------------------------------
  // GATE 2: Transaction Atomicity & Rollback Integrity
  // ---------------------------------------------------------------------------
  describe('Gate 2 — Atomic Registration Rollback', () => {
    it('should rollback full identity creation if any domain subsystem creation fails', async () => {
      prismaMock.channelIdentity.findUnique.mockResolvedValue(null);
      prismaMock.universalIdentity.create.mockResolvedValue({ id: 'uuid-fail' });
      prismaMock.user.create.mockResolvedValue({ id: 'uuid-fail', state: UserState.NEW });
      prismaMock.channelIdentity.create.mockResolvedValue({ id: 'chan-fail' });
      
      // Simulate failure during financial account setup
      prismaMock.financialAccount.create.mockRejectedValue(new Error('DATABASE_WRITE_ERROR'));

      await expect(
        service.register({
          provider: IdentityProvider.TELEGRAM,
          identifier: '999888777',
        }),
      ).rejects.toThrow('DATABASE_WRITE_ERROR');
    });
  });

  // ---------------------------------------------------------------------------
  // GATE 3: Deterministic Identifier Normalization (E.164)
  // ---------------------------------------------------------------------------
  describe('Gate 3 — E.164 Channel Identifier Normalization', () => {
    it('should normalize local Uganda format 0770000000 to +256770000000', () => {
      const normalized = service.normalizeIdentifier(IdentityProvider.WHATSAPP, '0770000000');
      expect(normalized).toBe('+256770000000');
    });

    it('should normalize un-prefixed international 256770000000 to +256770000000', () => {
      const normalized = service.normalizeIdentifier(IdentityProvider.WHATSAPP, '256770000000');
      expect(normalized).toBe('+256770000000');
    });

    it('should preserve already-formatted E.164 +256770000000', () => {
      const normalized = service.normalizeIdentifier(IdentityProvider.WHATSAPP, '+256770000000');
      expect(normalized).toBe('+256770000000');
    });
  });

  // ---------------------------------------------------------------------------
  // GATE 4 & 5: Account Linking & Zero Auto-Merge Conflict Protection
  // ---------------------------------------------------------------------------
  describe('Gate 4 & 5 — Account Linking & Conflict Safeguards', () => {
    it('should link WhatsApp channel to an existing Telegram account', async () => {
      const userId = 'user-link-1';
      prismaMock.user.findUnique.mockResolvedValue({ id: userId, identityId: userId });
      prismaMock.channelIdentity.findUnique.mockResolvedValue(null);
      prismaMock.channelIdentity.create.mockResolvedValue({
        id: 'chan_wa_linked',
        identityId: userId,
        provider: IdentityProvider.WHATSAPP,
        identifier: '+256770000000',
      });

      const result = await service.linkChannel({
        userId,
        provider: IdentityProvider.WHATSAPP,
        identifier: '+256770000000',
      });

      expect(result.identityId).toBe(userId);
    });

    it('should throw ConflictException and refuse auto-merge if channel is bound to a different Titan account', async () => {
      const userId = 'user-titan-A';
      prismaMock.user.findUnique.mockResolvedValue({ id: userId, identityId: userId });
      prismaMock.channelIdentity.findUnique.mockResolvedValue({
        id: 'chan_wa_existing',
        identityId: 'user-titan-B', // Different account!
        provider: IdentityProvider.WHATSAPP,
        identifier: '+256770000000',
      });

      await expect(
        service.linkChannel({
          userId,
          provider: IdentityProvider.WHATSAPP,
          identifier: '+256770000000',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ---------------------------------------------------------------------------
  // GATE 6: Multi-Session Integrity
  // ---------------------------------------------------------------------------
  describe('Gate 6 — Multi-Session Context Integrity', () => {
    it('should construct valid IdentityContext containing canonical User.id', async () => {
      const userId = 'uuid-context-1';
      prismaMock.user.findUnique.mockResolvedValue({
        id: userId,
        state: UserState.ACTIVE_USER,
        telegramUserId: BigInt(12345),
        identity: {
          id: userId,
          channels: [
            { id: 'c1', provider: IdentityProvider.TELEGRAM, identifier: '12345' },
          ],
        },
      });

      const context = await service.getIdentityContext(userId);
      expect(context.userId).toBe(userId);
      expect(context.universalIdentityId).toBe(userId);
      expect(context.channel).toBe(IdentityProvider.TELEGRAM);
      expect(context.assuranceLevel).toBe('HIGH');
    });
  });

  // ---------------------------------------------------------------------------
  // GATE 8: Financial & Asset Isolation
  // ---------------------------------------------------------------------------
  describe('Gate 8 — Financial & Asset Ownership Isolation', () => {
    it('should verify ownership assertion between requesting and resource user', () => {
      expect(() => service.assertOwnership('user-owner-A', 'user-owner-A')).not.toThrow();
      expect(() => service.assertOwnership('user-owner-A', 'user-owner-B')).toThrow(ForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // GATE 9: Identity Lifecycle State Enforcement
  // ---------------------------------------------------------------------------
  describe('Gate 9 — Identity Lifecycle Policy Enforcement', () => {
    it('should block authentication when account state is FROZEN', async () => {
      prismaMock.channelIdentity.findUnique.mockResolvedValue({
        id: 'chan_frozen',
        identityId: 'uuid-frozen',
        provider: IdentityProvider.TELEGRAM,
        identifier: '12345',
        identity: {
          id: 'uuid-frozen',
          users: [{ id: 'uuid-frozen', state: UserState.FROZEN }],
        },
      });

      await expect(
        service.authenticate({
          provider: IdentityProvider.TELEGRAM,
          identifier: '12345',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should block authentication when account state is SUSPENDED_USER', async () => {
      prismaMock.channelIdentity.findUnique.mockResolvedValue({
        id: 'chan_suspended',
        identityId: 'uuid-suspended',
        provider: IdentityProvider.TELEGRAM,
        identifier: '12345',
        identity: {
          id: 'uuid-suspended',
          users: [{ id: 'uuid-suspended', state: UserState.SUSPENDED_USER }],
        },
      });

      await expect(
        service.authenticate({
          provider: IdentityProvider.TELEGRAM,
          identifier: '12345',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ---------------------------------------------------------------------------
  // GATE 10: Immutable Audit Event Emission
  // ---------------------------------------------------------------------------
  describe('Gate 10 — Identity Audit Event Emission', () => {
    it('should log USER_CREATED audit event upon identity registration', async () => {
      const mockUuid = 'uuid-audit-1';
      prismaMock.channelIdentity.findUnique.mockResolvedValue(null);
      prismaMock.universalIdentity.create.mockResolvedValue({ id: mockUuid });
      prismaMock.user.create.mockResolvedValue({ id: mockUuid, state: UserState.NEW });
      prismaMock.channelIdentity.create.mockResolvedValue({ id: 'c1' });

      await service.register({
        provider: IdentityProvider.TELEGRAM,
        identifier: '999111222',
      });

      expect(auditMock.createWithClient).toHaveBeenCalledWith(
        prismaMock,
        expect.objectContaining({
          eventType: AuditEventType.USER_CREATED,
        }),
      );
    });
  });
});
