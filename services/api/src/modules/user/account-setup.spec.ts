import { Test, TestingModule } from '@nestjs/testing';
import {
  UserService,
  isAccountSetupComplete,
  isValidPersonName,
  isValidTransactionNumber,
  normalizePersonName,
  normalizeTransactionNumber,
} from './user.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TransactionMethod } from '../../common/interfaces/user-state.enum';

describe('AccountSetup validation', () => {
  it('accepts unicode names and trims/collapses whitespace', () => {
    expect(normalizePersonName('  Adaeze   Okafor  ')).toBe('Adaeze Okafor');
    expect(isValidPersonName('Adaeze Okafor')).toBe(true);
    expect(isValidPersonName('José María')).toBe(true);
    expect(isValidPersonName("O'Brien-Smith")).toBe(true);
  });

  it('rejects empty, whitespace-only, overlong, and malformed names', () => {
    expect(isValidPersonName('')).toBe(false);
    expect(isValidPersonName('   ')).toBe(false);
    expect(isValidPersonName('a'.repeat(61))).toBe(false);
    expect(isValidPersonName('John123')).toBe(false);
    expect(isValidPersonName('user@example.com')).toBe(false);
    expect(isValidPersonName(undefined)).toBe(false);
  });

  it('normalizes transaction numbers like the withdrawal-phone path', () => {
    expect(normalizeTransactionNumber(' +256 772 123 456 ')).toBe('+256772123456');
    expect(isValidTransactionNumber('+256772123456')).toBe(true);
    expect(isValidTransactionNumber('0772123456')).toBe(true);
  });

  it('rejects invalid transaction numbers', () => {
    expect(isValidTransactionNumber('')).toBe(false);
    expect(isValidTransactionNumber('12345')).toBe(false);
    expect(isValidTransactionNumber('not-a-number')).toBe(false);
    expect(isValidTransactionNumber(undefined)).toBe(false);
  });

  it('derives completion: crypto needs no number, mobile money does', () => {
    const base = { firstName: 'Ama', lastName: 'Mensah', withdrawalPhoneNumber: null };
    expect(
      isAccountSetupComplete({ ...base, preferredTransactionMethod: TransactionMethod.CRYPTO }),
    ).toBe(true);
    expect(
      isAccountSetupComplete({ ...base, preferredTransactionMethod: TransactionMethod.MOBILE_MONEY }),
    ).toBe(false);
    expect(
      isAccountSetupComplete({
        ...base,
        withdrawalPhoneNumber: '+233241234567',
        preferredTransactionMethod: TransactionMethod.MOBILE_MONEY,
      }),
    ).toBe(true);
    expect(
      isAccountSetupComplete({ ...base, preferredTransactionMethod: null }),
    ).toBe(false);
    expect(
      isAccountSetupComplete({
        firstName: '',
        lastName: 'Mensah',
        withdrawalPhoneNumber: null,
        preferredTransactionMethod: TransactionMethod.CRYPTO,
      }),
    ).toBe(false);
    expect(
      isAccountSetupComplete({
        ...base,
        withdrawalPhoneNumber: null,
        preferredTransactionMethod: 'mobile' as any,
      }),
    ).toBe(false);
  });
});

describe('UserService - account setup', () => {
  let userService: UserService;
  let prismaMock: any;
  let auditMock: any;

  const UUID = '550e8400-e29b-41d4-a716-446655440000';
  const baseUser = {
    id: UUID,
    identityId: UUID,
    telegramUserId: 998877n,
    firstName: 'Ama',
    lastName: 'Mensah',
    withdrawalPhoneNumber: null,
    preferredTransactionMethod: null,
    verifiedUsdtAddress: null,
  };

  beforeEach(async () => {
    prismaMock = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ ...baseUser }),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...baseUser, ...data })),
        create: jest.fn(),
      },
    };
    auditMock = { create: jest.fn().mockResolvedValue({}), createWithClient: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();

    userService = module.get<UserService>(UserService);
  });

  it('getAccountSetup returns canonical values with backend-derived completion', async () => {
    const state = await userService.getAccountSetup(UUID);
    expect(state).toEqual({
      firstName: 'Ama',
      lastName: 'Mensah',
      withdrawalPhoneNumber: null,
      preferredTransactionMethod: null,
      completed: false,
    });
    // Privacy: verified crypto destinations are not exposed by this endpoint.
    expect(state).not.toHaveProperty('verifiedUsdtAddress');
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it('getAccountSetup reports complete users as complete', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...baseUser,
      preferredTransactionMethod: TransactionMethod.CRYPTO,
    });
    const state = await userService.getAccountSetup(UUID);
    expect(state.completed).toBe(true);
  });

  it('getAccountSetup fails safely when the canonical user is missing (no fallback creation)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.findFirst.mockResolvedValue(null);
    await expect(userService.getAccountSetup(UUID)).rejects.toThrow('USER_NOT_FOUND');
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it('saves a valid Mobile Money setup with cooling semantics and audits', async () => {
    const state = await userService.updateAccountSetup(UUID, {
      firstName: ' Ama ',
      lastName: 'Mensah',
      preferredTransactionMethod: TransactionMethod.MOBILE_MONEY,
      withdrawalPhoneNumber: '+256 772 123456',
    } as any);

    expect(prismaMock.user.create).not.toHaveBeenCalled();
    expect(prismaMock.user.update).toHaveBeenCalledTimes(1);
    const [{ where, data }] = prismaMock.user.update.mock.calls[0];
    expect(where).toEqual({ id: UUID });
    expect(data.firstName).toBe('Ama');
    expect(data.preferredTransactionMethod).toBe(TransactionMethod.MOBILE_MONEY);
    expect(data.withdrawalPhoneNumber).toBe('+256772123456');
    expect(data.withdrawalPhoneVerified).toBe(true);
    expect(data.recipientCoolingUntil).toBeInstanceOf(Date);
    expect(state.completed).toBe(true);
    expect(state.withdrawalPhoneNumber).toBe('+256772123456');
    const auditTypes = auditMock.create.mock.calls.map((c: any) => c[0].eventType);
    expect(auditTypes).toContain('TRANSACTION_METHOD_CHANGED');
    expect(auditTypes).toContain('WITHDRAWAL_PHONE_CHANGED');
    expect(auditTypes).toContain('ACCOUNT_SETUP_COMPLETED');
    // No PII values in audit metadata
    for (const call of auditMock.create.mock.calls) {
      const serialized = JSON.stringify(call[0], (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      );
      expect(serialized).not.toContain('256772123456');
    }
  });

  it('saves a valid Crypto setup without requiring a number and preserves existing destination', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...baseUser,
      withdrawalPhoneNumber: '+256772000000',
    });
    prismaMock.user.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...baseUser, withdrawalPhoneNumber: '+256772000000', ...data }),
    );

    const state = await userService.updateAccountSetup(UUID, {
      firstName: 'Ama',
      lastName: 'Mensah',
      preferredTransactionMethod: TransactionMethod.CRYPTO,
    } as any);

    const [{ data }] = prismaMock.user.update.mock.calls[0] as any;
    expect(data.withdrawalPhoneNumber).toBeUndefined();
    expect(state.completed).toBe(true);
    expect(state.withdrawalPhoneNumber).toBe('+256772000000');
  });

  it('rejects missing/invalid names without touching the database', async () => {
    await expect(
      userService.updateAccountSetup(UUID, {
        firstName: '   ',
        lastName: 'Mensah',
        preferredTransactionMethod: TransactionMethod.CRYPTO,
      } as any),
    ).rejects.toThrow('INVALID_FIRST_NAME');
    await expect(
      userService.updateAccountSetup(UUID, {
        firstName: 'Ama1',
        lastName: 'Mensah',
        preferredTransactionMethod: TransactionMethod.CRYPTO,
      } as any),
    ).rejects.toThrow('INVALID_FIRST_NAME');
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('rejects Mobile Money without a valid withdrawal number', async () => {
    await expect(
      userService.updateAccountSetup(UUID, {
        firstName: 'Ama',
        lastName: 'Mensah',
        preferredTransactionMethod: TransactionMethod.MOBILE_MONEY,
      } as any),
    ).rejects.toThrow('INVALID_WITHDRAWAL_NUMBER');
    await expect(
      userService.updateAccountSetup(UUID, {
        firstName: 'Ama',
        lastName: 'Mensah',
        preferredTransactionMethod: TransactionMethod.MOBILE_MONEY,
        withdrawalPhoneNumber: 'abc',
      } as any),
    ).rejects.toThrow('INVALID_WITHDRAWAL_NUMBER');
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('rejects arbitrary transaction method strings', async () => {
    await expect(
      userService.updateAccountSetup(UUID, {
        firstName: 'Ama',
        lastName: 'Mensah',
        preferredTransactionMethod: 'mobile' as any,
      } as any),
    ).rejects.toThrow('INVALID_TRANSACTION_METHOD');
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('is idempotent: repeated identical submissions only rewrite the same canonical values', async () => {
    const dto = {
      firstName: 'Ama',
      lastName: 'Mensah',
      preferredTransactionMethod: TransactionMethod.CRYPTO,
    } as any;
    await userService.updateAccountSetup(UUID, dto);
    prismaMock.user.findUnique.mockResolvedValue({ ...baseUser, preferredTransactionMethod: TransactionMethod.CRYPTO });
    await userService.updateAccountSetup(UUID, dto);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
    expect(prismaMock.user.update).toHaveBeenCalledTimes(2);
    expect(prismaMock.user.update.mock.calls[1][0].where).toEqual({ id: UUID });
  });

  it('never creates users or identities from the setup path', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.findFirst.mockResolvedValue(null);
    await expect(
      userService.updateAccountSetup(UUID, {
        firstName: 'Ama',
        lastName: 'Mensah',
        preferredTransactionMethod: TransactionMethod.CRYPTO,
      } as any),
    ).rejects.toThrow('USER_NOT_FOUND');
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });
});
