import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';
import { RbacGuard } from './rbac.guard';
import { AdminPermission, ROLE_PERMISSIONS_MAP } from '../interfaces/admin-permissions.enum';
import { AdminRole } from '@prisma/client';
import { hashAdminSessionToken } from '../services/admin-auth.service';

describe('Admin Security Remediation Suite', () => {
  let prismaMock: any;
  let adminAuthGuard: AdminAuthGuard;
  let rbacGuard: RbacGuard;
  let reflectorMock: any;

  beforeEach(() => {
    prismaMock = {
      adminSession: {
        findFirst: jest.fn(),
      },
    };
    reflectorMock = {
      get: jest.fn(),
      getAllAndOverride: jest.fn(),
    };
    adminAuthGuard = new AdminAuthGuard(prismaMock as any);
    rbacGuard = new RbacGuard(reflectorMock as any);
  });

  function createMockContext(headers: Record<string, string>, adminCtx?: any): ExecutionContext {
    const request = {
      headers,
      admin: adminCtx,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;
  }

  describe('AdminAuthGuard Security Invariants', () => {
    it('1. Should throw UnauthorizedException when no admin auth header is present', async () => {
      const ctx = createMockContext({});
      await expect(adminAuthGuard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it('2. Should REJECT legacy fast-path bypass headers ("admin-token:SUPER_ADMIN")', async () => {
      const ctx = createMockContext({
        authorization: 'Bearer admin-token:SUPER_ADMIN:attacker_id',
      });

      prismaMock.adminSession.findFirst.mockResolvedValue(null);

      await expect(adminAuthGuard.canActivate(ctx)).rejects.toThrow(
        new UnauthorizedException('INVALID_OR_EXPIRED_ADMIN_SESSION'),
      );
      expect(prismaMock.adminSession.findFirst).toHaveBeenCalledWith({
        where: {
          tokenHash: hashAdminSessionToken('admin-token:SUPER_ADMIN:attacker_id'),
          revokedAt: null,
          expiresAt: expect.any(Object),
        },
        include: { adminUser: true },
      });
    });

    it('3. Should authenticate valid database session', async () => {
      const ctx = createMockContext({
        authorization: 'Bearer valid_db_session_token_123',
      });

      prismaMock.adminSession.findFirst.mockResolvedValue({
        id: 'sess_1',
        tokenHash: 'valid_db_session_token_123',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
        adminUser: {
          id: 'admin_user_99',
          username: 'super_admin_ops',
          email: 'admin@titanstream.io',
          role: AdminRole.SUPER_ADMIN,
          isActive: true,
        },
      });

      const result = await adminAuthGuard.canActivate(ctx);
      expect(result).toBe(true);
      const req = ctx.switchToHttp().getRequest();
      expect(req.admin).toEqual({
        id: 'admin_user_99',
        username: 'super_admin_ops',
        email: 'admin@titanstream.io',
        role: AdminRole.SUPER_ADMIN,
      });
    });
  });

  describe('RBAC Privilege Isolation & Escalation Prevention', () => {
    it('4. Should DENY OPERATIONS_ADMIN access to ADMIN_MANAGE permission', () => {
      const opsPermissions = ROLE_PERMISSIONS_MAP[AdminRole.OPERATIONS_ADMIN];
      expect(opsPermissions.includes(AdminPermission.ADMIN_MANAGE)).toBe(false);
    });

    it('5. Should ALLOW SUPER_ADMIN access to ADMIN_MANAGE permission', () => {
      const superAdminPermissions = ROLE_PERMISSIONS_MAP[AdminRole.SUPER_ADMIN];
      expect(superAdminPermissions.includes(AdminPermission.ADMIN_MANAGE)).toBe(true);
    });

    it('6. Should enforce RbacGuard check on request context', () => {
      reflectorMock.getAllAndOverride.mockReturnValue([AdminPermission.ADMIN_MANAGE]);
      const ctxOps = createMockContext({}, { role: AdminRole.OPERATIONS_ADMIN });
      expect(() => rbacGuard.canActivate(ctxOps)).toThrow();

      const ctxSuper = createMockContext({}, { role: AdminRole.SUPER_ADMIN });
      expect(rbacGuard.canActivate(ctxSuper)).toBe(true);
    });
  });
});
