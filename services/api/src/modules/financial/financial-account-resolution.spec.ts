import { Test, TestingModule } from '@nestjs/testing';
import { FinancialAccountService } from './financial-account.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FinancialAccountRepository } from './financial-account.repository';

describe('FinancialAccount Resolution - Post-Fix Verification', () => {
  let service: FinancialAccountService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialAccountService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
            },
            financialAccount: {
              findFirst: jest.fn(),
              create: jest.fn(),
            },
          },
        },
        {
          provide: FinancialAccountRepository,
          useValue: {},
        },
        {
          provide: AuditService,
          useValue: {
            createWithClient: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FinancialAccountService>(FinancialAccountService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should resolve existing financial account by userId when populated', async () => {
    // Mock user with UUID
    const mockUser = {
      id: '132a143c-f57b-469d-98ed-94fd20605ac6',
      telegramUserId: BigInt(256752762181),
      state: 'READY',
      isReady: true,
    };

    // Mock financial account with userId populated (POST-FIX state)
    const mockFinancialAccount = {
      id: '2721eddc-9601-4dcb-afd9-b5e8adf399d7',
      telegramUserId: BigInt(256752762181),
      userId: '132a143c-f57b-469d-98ed-94fd20605ac6', // POPULATED
      status: 'ACTIVE',
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (prisma.financialAccount.findFirst as jest.Mock).mockResolvedValue(mockFinancialAccount);

    const result = await service.getOrCreateForReadyUser('132a143c-f57b-469d-98ed-94fd20605ac6');

    // Verify the lookup was called with userId
    expect(prisma.financialAccount.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { userId: '132a143c-f57b-469d-98ed-94fd20605ac6' },
          { telegramUserId: BigInt(256752762181) }
        ]
      }
    });

    // Verify existing account was returned (no new creation)
    expect(result).toEqual(mockFinancialAccount);
    expect(prisma.financialAccount.create).not.toHaveBeenCalled();
  });

  it('should fallback to telegramUserId lookup if userId is NULL (legacy data)', async () => {
    // Mock user with UUID
    const mockUser = {
      id: '132a143c-f57b-469d-98ed-94fd20605ac6',
      telegramUserId: BigInt(256752762181),
      state: 'READY',
      isReady: true,
    };

    // Mock financial account with userId NULL (PRE-FIX state - should still work)
    const mockFinancialAccount = {
      id: '2721eddc-9601-4dcb-afd9-b5e8adf399d7',
      telegramUserId: BigInt(256752762181),
      userId: null, // NULL (legacy data)
      status: 'ACTIVE',
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (prisma.financialAccount.findFirst as jest.Mock).mockResolvedValue(mockFinancialAccount);

    const result = await service.getOrCreateForReadyUser('132a143c-f57b-469d-98ed-94fd20605ac6');

    // Verify the lookup was called with both userId and telegramUserId
    expect(prisma.financialAccount.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { userId: '132a143c-f57b-469d-98ed-94fd20605ac6' },
          { telegramUserId: BigInt(256752762181) }
        ]
      }
    });

    // Verify existing account was returned via telegramUserId fallback
    expect(result).toEqual(mockFinancialAccount);
    expect(prisma.financialAccount.create).not.toHaveBeenCalled();
  });

  it('should create new account with both userId and telegramUserId when none exists', async () => {
    const mockUser = {
      id: 'new-user-id-12345',
      telegramUserId: BigInt(999888777),
      state: 'READY',
      isReady: true,
    };

    const mockNewAccount = {
      id: 'new-financial-account-id',
      telegramUserId: BigInt(999888777),
      userId: 'new-user-id-12345', // MUST be populated
      status: 'ACTIVE',
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (prisma.financialAccount.findFirst as jest.Mock).mockResolvedValue(null); // No existing account
    (prisma.financialAccount.create as jest.Mock).mockResolvedValue(mockNewAccount);

    const result = await service.getOrCreateForReadyUser('new-user-id-12345');

    // Verify new account creation includes userId
    expect(prisma.financialAccount.create).toHaveBeenCalledWith({
      data: {
        userId: 'new-user-id-12345',
        telegramUserId: BigInt(999888777),
        status: 'ACTIVE',
        activatedAt: expect.any(Date),
      }
    });

    expect(result).toEqual(mockNewAccount);
  });
});