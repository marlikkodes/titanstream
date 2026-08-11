import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from '../../database/prisma.service';
import { OperationalAuditService } from '../admin/services/operational-audit.service';

describe('UserService - deleteAccount', () => {
  let userService: UserService;
  let prismaMock: any;
  let auditServiceMock: any;

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn().mockImplementation((cb) => cb(prismaMock)),
      userMachine: { findMany: jest.fn().mockResolvedValue([]) },
      machineOutput: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      settlementSession: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      settlementEvent: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      financialOperation: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      financialIdempotencyRecord: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      financialDomainEvent: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      financialAccount: { findUnique: jest.fn().mockResolvedValue(null), delete: jest.fn().mockResolvedValue({}) },
      financialTransaction: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      ledgerEntry: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      assetBalance: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      userAssetLicense: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      userMiningState: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      userMachineFleetItem: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      crystalAccount: { findUnique: jest.fn().mockResolvedValue(null), delete: jest.fn().mockResolvedValue({}) },
      crystalTransaction: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      gameSession: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      gamePlayerStat: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      gameRewardGrant: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      gameChallengeCompletion: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      gameProfile: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      achievement: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      userAchievement: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      productSubscription: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      paymentInvoice: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      channelVerificationEvent: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      referralRelationship: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      referralCode: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      referralQualificationHistory: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      reward: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      growthEvent: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      notificationRecord: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      notificationPreference: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      userBenefit: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      benefitHistory: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      userLevelRecord: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      trustEvent: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      userTrustProfile: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      userPreferences: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      onboardingProgress: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      educationCompletion: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      userConsent: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      readinessScore: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      readinessHistory: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      userStateTransition: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      adminNote: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      universalIdentity: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      user: { delete: jest.fn().mockResolvedValue({}) },
    };

    auditServiceMock = {
      create: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: OperationalAuditService, useValue: auditServiceMock },
      ],
    }).compile();

    userService = module.get<UserService>(UserService);
  });

  it('should delete user account and all child records completely', async () => {
    const res = await userService.deleteAccount(123456n);
    expect(res).toEqual({ success: true, message: 'Account deleted successfully' });
    expect(prismaMock.user.delete).toHaveBeenCalledWith({ where: { telegramUserId: 123456n } });
    expect(auditServiceMock.create).toHaveBeenCalled();
  });
});
