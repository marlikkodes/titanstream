import { UnauthorizedException } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { AdminAuthService } from './admin-auth.service';

describe('AdminAuthService', () => {
  const prisma = {
    adminUser: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    adminDevice: {
      upsert: jest.fn(),
    },
    adminSession: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
  const audit = { logAction: jest.fn() };
  const authVerification = { verify: jest.fn() };

  let service: AdminAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminAuthService(prisma as any, audit as any, authVerification as any);
  });

  it('authenticates valid admin user via Telegram initData and returns session token', async () => {
    const telegramId = 5387655307n;
    authVerification.verify.mockReturnValue({
      telegramId,
      firstName: 'Super',
      lastName: 'Admin',
      username: 'superadmin',
    });

    prisma.adminUser.findFirst.mockResolvedValue({
      id: 'admin_1',
      username: 'admin_tg_5387655307',
      email: 'admin_5387655307@titanstream.internal',
      role: AdminRole.SUPER_ADMIN,
      isActive: true,
    });

    prisma.adminDevice.upsert.mockResolvedValue({});
    prisma.adminSession.create.mockResolvedValue({
      tokenHash: 'adm_sess_1234567890',
      expiresAt: new Date(Date.now() + 86400000),
    });

    const res = await service.loginWithTelegram({
      initData: 'query_id=123&user=test',
      fingerprint: 'fp_123',
    });

    expect(res.token).toMatch(/^adm_sess_[a-f0-9]{64}$/);
    expect(res.admin.role).toBe(AdminRole.SUPER_ADMIN);
    expect(audit.logAction).toHaveBeenCalledWith(expect.objectContaining({ action: 'ADMIN_TELEGRAM_LOGIN' }));
  });

  it('rejects invalid Telegram authentication with UnauthorizedException', async () => {
    authVerification.verify.mockImplementation(() => {
      throw new Error('Invalid HMAC signature');
    });

    await expect(
      service.loginWithTelegram({
        initData: 'invalid_data',
        fingerprint: 'fp_123',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});

