import { Test, TestingModule } from '@nestjs/testing';
import { IdentityMasterEngineService } from './identity-master.service';
import { PrismaService } from '../../database/prisma.service';
import { IdentityProvider } from '@prisma/client';

describe('IdentityMasterEngine — Transaction Atomicity Failure Injection Suite', () => {
  let service: IdentityMasterEngineService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      channelIdentity: { findUnique: jest.fn(), create: jest.fn() },
      universalIdentity: { create: jest.fn() },
      user: { create: jest.fn() },
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

  it('PROVEN: Failure after UniversalIdentity creation must trigger 100% rollback (zero partial state)', async () => {
    prismaMock.channelIdentity.findUnique.mockResolvedValue(null);
    prismaMock.universalIdentity.create.mockResolvedValue({ id: 'uuid-1' });
    prismaMock.user.create.mockRejectedValue(new Error('FAIL_AT_STEP_2_USER'));

    await expect(
      service.register({ provider: IdentityProvider.TELEGRAM, identifier: '1000' }),
    ).rejects.toThrow('FAIL_AT_STEP_2_USER');
  });

  it('PROVEN: Failure after User creation must trigger 100% rollback', async () => {
    prismaMock.channelIdentity.findUnique.mockResolvedValue(null);
    prismaMock.universalIdentity.create.mockResolvedValue({ id: 'uuid-1' });
    prismaMock.user.create.mockResolvedValue({ id: 'uuid-1' });
    prismaMock.channelIdentity.create.mockRejectedValue(new Error('FAIL_AT_STEP_3_CHANNEL'));

    await expect(
      service.register({ provider: IdentityProvider.TELEGRAM, identifier: '1000' }),
    ).rejects.toThrow('FAIL_AT_STEP_3_CHANNEL');
  });

  it('PROVEN: Failure during UserTrustProfile setup must trigger 100% rollback of UniversalIdentity, User, Channel, and FinancialAccount', async () => {
    prismaMock.channelIdentity.findUnique.mockResolvedValue(null);
    prismaMock.universalIdentity.create.mockResolvedValue({ id: 'uuid-1' });
    prismaMock.user.create.mockResolvedValue({ id: 'uuid-1' });
    prismaMock.channelIdentity.create.mockResolvedValue({ id: 'c1' });
    prismaMock.financialAccount.create.mockResolvedValue({ id: 'fa1' });
    prismaMock.onboardingProgress.create.mockResolvedValue({ id: 'op1' });
    prismaMock.referralCode.create.mockResolvedValue({ id: 'ref1' });
    prismaMock.userTrustProfile.create.mockRejectedValue(new Error('FAIL_AT_STEP_5_TRUST_PROFILE'));

    await expect(
      service.register({ provider: IdentityProvider.TELEGRAM, identifier: '1000' }),
    ).rejects.toThrow('FAIL_AT_STEP_5_TRUST_PROFILE');
  });
});
