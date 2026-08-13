import { Test, TestingModule } from '@nestjs/testing';
import { IdentityMasterEngineService } from './identity-master.service';
import { PrismaService } from '../../database/prisma.service';
import { IdentityProvider, UserState, Prisma } from '@prisma/client';

describe('IdentityMasterEngine — Concurrency & Race Certification Suite', () => {
  let service: IdentityMasterEngineService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      channelIdentity: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      universalIdentity: {
        create: jest.fn(),
      },
      user: {
        create: jest.fn(),
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

  it('PROVEN: Should gracefully catch Prisma P2002 race condition on concurrent registration and return winning identity', async () => {
    const mockUuid = 'uuid-winning-race';
    const provider = IdentityProvider.WHATSAPP;
    const identifier = '+256770000000';

    prismaMock.channelIdentity.findUnique
      .mockResolvedValueOnce(null) // Step 1 pre-check returns null
      .mockResolvedValueOnce({    // Step 2 re-resolve finds winning row!
        id: 'chan_winner',
        identityId: mockUuid,
        provider,
        identifier,
        identity: {
          id: mockUuid,
          users: [{ id: mockUuid, identityId: mockUuid, state: UserState.NEW }],
        },
      });

    // Simulate Prisma P2002 error when creating ChannelIdentity inside transaction
    const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.0.0',
    });
    prismaMock.$transaction.mockRejectedValueOnce(p2002Error);

    const result = await service.register({ provider, identifier });

    expect(result.userId).toBe(mockUuid);
    expect(result.universalIdentityId).toBe(mockUuid);
    expect(result.channel).toBe(provider);
  });
});
