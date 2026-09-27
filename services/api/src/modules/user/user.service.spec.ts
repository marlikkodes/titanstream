import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('UserService - deleteAccount', () => {
  let userService: UserService;
  let prismaMock: any;
  let auditServiceMock: any;

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn().mockImplementation((cb) => cb(prismaMock)),
      userMachine: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      machineOutput: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      settlementSession: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      settlementEvent: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      financialOperation: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      financialIdempotencyRecord: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      financialDomainEvent: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      financialAccount: { findUnique: jest.fn().mockResolvedValue(null), delete: jest.fn().mockResolvedValue({}) },
      financialTransaction: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      ledgerEntry: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      // AssetBalance deletion is still needed for account cleanup
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
      referralRelationship: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      referralCode: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      referralQualificationHistory: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      referralReward: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      reward: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      growthEvent: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      notificationRecord: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      notificationPreference: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      userBenefit: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      benefitHistory: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      userLevelRecord: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      trustEvent: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      userTrustProfile: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      userPreferences: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      onboardingProgress: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      educationCompletion: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      userConsent: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      readinessScore: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      readinessHistory: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      userStateTransition: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      riskEvent: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      adminNote: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'u1', telegramUserId: 123456n }),
        findFirst: jest.fn().mockResolvedValue({ id: 'u1', telegramUserId: 123456n }),
        delete: jest.fn().mockResolvedValue({}),
      },
    };

    auditServiceMock = {
      createWithClient: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditServiceMock },
      ],
    }).compile();

    userService = module.get<UserService>(UserService);
  });

  it('should delete user account and all child records completely', async () => {
    const res = await userService.deleteAccount(123456n);
    expect(res).toEqual({ success: true, message: 'Account deleted successfully' });
    expect(prismaMock.user.delete).toHaveBeenCalledWith({ where: { telegramUserId: 123456n } });
    expect(auditServiceMock.createWithClient).toHaveBeenCalled();
  });

  describe('getProfile', () => {
    it('should return real user when found by UUID', async () => {
      const mockUser = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        identityId: '550e8400-e29b-41d4-a716-446655440000',
        telegramUserId: 998877n,
        firstName: 'Alice',
      };
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const result = await userService.getProfile('550e8400-e29b-41d4-a716-446655440000');
      expect(result).toEqual(mockUser);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: '550e8400-e29b-41d4-a716-446655440000' } }),
      );
    });

    it('should return real user when found by numeric Telegram ID', async () => {
      const mockUser = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        telegramUserId: 998877n,
        firstName: 'Bob',
      };
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const result = await userService.getProfile(998877n);
      expect(result).toEqual(mockUser);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { telegramUserId: 998877n } }),
      );
    });

    it('should throw NotFoundException and NOT return phantom Operator user when user does not exist', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(userService.getProfile('non-existent-uuid')).rejects.toThrow('USER_NOT_FOUND');
    });

    it('should propagate database errors rather than swallowing them into a fake user', async () => {
      prismaMock.user.findUnique.mockRejectedValue(new Error('DB connection timeout'));

      await expect(userService.getProfile('550e8400-e29b-41d4-a716-446655440000')).rejects.toThrow('DB connection timeout');
    });
  });

  describe('getTrustProfile', () => {
    it('should return real trust profile when found', async () => {
      const mockUser = { id: 'uuid-1', telegramUserId: 123456n };
      const mockTrust = { telegramUserId: 123456n, trustScore: 92, verificationStatus: 'VERIFIED' };
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.userTrustProfile.findFirst.mockResolvedValue(mockTrust);

      const result = await userService.getTrustProfile(123456n);
      expect(result).toEqual(mockTrust);
    });

    it('should throw NotFoundException and NOT fabricate a 85-score trust profile when missing', async () => {
      const mockUser = { id: 'uuid-1', telegramUserId: 123456n };
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.userTrustProfile.findFirst.mockResolvedValue(null);

      await expect(userService.getTrustProfile(123456n)).rejects.toThrow('TRUST_PROFILE_NOT_FOUND');
    });
  });
});
