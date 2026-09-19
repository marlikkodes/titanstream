import { Test, TestingModule } from '@nestjs/testing';
import { IdentityMasterEngineService } from './identity-master.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { IdentityProvider, UserState } from '@prisma/client';

describe('IdentityMasterEngineService - Financial Account Fix Verification', () => {
  let service: IdentityMasterEngineService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdentityMasterEngineService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn(),
            universalIdentity: {
              create: jest.fn(),
            },
            user: {
              create: jest.fn(),
            },
            channelIdentity: {
              create: jest.fn(),
            },
            financialAccount: {
              create: jest.fn(),
            },
            onboardingProgress: {
              create: jest.fn(),
            },
            referralCode: {
              create: jest.fn(),
            },
            userTrustProfile: {
              create: jest.fn(),
            },
            userLevelRecord: {
              create: jest.fn(),
            },
            notificationPreference: {
              create: jest.fn(),
            },
          },
        },
        {
          provide: AuditService,
          useValue: {
            createWithClient: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<IdentityMasterEngineService>(IdentityMasterEngineService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should create FinancialAccount with userId populated during registration', async () => {
    const mockIdentity = {
      id: 'test-identity-id',
      displayName: 'Test User',
    };

    const mockUser = {
      id: 'test-identity-id', // User.id === UniversalIdentity.id
      identityId: 'test-identity-id',
      telegramUserId: BigInt(123456789),
      firstName: 'Test',
      lastName: 'User',
      state: UserState.READY,
    };

    const mockChannelIdentity = {
      id: 'test-channel-id',
      identityId: 'test-identity-id',
      provider: IdentityProvider.TELEGRAM,
      identifier: '123456789',
    };

    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      return callback(prisma);
    });

    (prisma.universalIdentity.create as jest.Mock).mockResolvedValue(mockIdentity);
    (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);
    (prisma.channelIdentity.create as jest.Mock).mockResolvedValue(mockChannelIdentity);
    (prisma.financialAccount.create as jest.Mock).mockResolvedValue({
      id: 'test-financial-account-id',
      telegramUserId: BigInt(123456789),
      userId: 'test-identity-id', // MUST be populated
      status: 'ACTIVE',
    });

    await service.register({
      provider: IdentityProvider.TELEGRAM,
      identifier: '123456789',
      displayName: 'Test User',
      firstName: 'Test',
    });

    // CRITICAL VERIFY: FinancialAccount creation must include userId
    expect(prisma.financialAccount.create).toHaveBeenCalledWith({
      data: {
        userId: 'test-identity-id', // ← THIS MUST BE PRESENT
        telegramUserId: BigInt(123456789),
        status: 'ACTIVE',
        activatedAt: expect.any(Date),
      }
    });
  });

  it('should maintain User.id === UniversalIdentity.id invariant', async () => {
    const mockIdentity = {
      id: 'invariant-test-id',
      displayName: 'Invariant Test',
    };

    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      return callback(prisma);
    });

    (prisma.universalIdentity.create as jest.Mock).mockResolvedValue(mockIdentity);
    (prisma.user.create as jest.Mock).mockResolvedValue({
      id: 'invariant-test-id', // MUST equal identity.id
      identityId: 'invariant-test-id', // MUST equal identity.id
      telegramUserId: BigInt(987654321),
      firstName: 'Invariant',
      state: UserState.READY,
    });

    await service.register({
      provider: IdentityProvider.TELEGRAM,
      identifier: '987654321',
      displayName: 'Invariant Test',
      firstName: 'Invariant',
    });

    // Verify User.id === UniversalIdentity.id
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'invariant-test-id',
        identityId: 'invariant-test-id',
      })
    });
  });
});