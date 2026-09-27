import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: any;
  let prisma: any;
  let reflector: any;

  const mockExecutionContext = (headers: Record<string, string> = {}, url = '/api/profile'): ExecutionContext => {
    const request = {
      headers,
      url,
      identity: null,
      user: null,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    jwtService = {
      verify: jest.fn(),
    };
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
    };
    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        { provide: JwtService, useValue: jwtService },
        { provide: PrismaService, useValue: prisma },
        { provide: Reflector, useValue: reflector },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
  });

  it('should allow public endpoints without checking JWT', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const context = mockExecutionContext();

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(jwtService.verify).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException when authorization header is missing', async () => {
    const context = mockExecutionContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when JWT signature is invalid', async () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('invalid token');
    });
    const context = mockExecutionContext({ authorization: 'Bearer invalid.token.here' });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw ServiceUnavailableException (503) when database is unavailable (fail closed)', async () => {
    jwtService.verify.mockReturnValue({
      sub: '550e8400-e29b-41d4-a716-446655440000',
      role: 'USER',
    });
    prisma.user.findUnique.mockRejectedValue(new Error('Connection lost to PostgreSQL'));

    const context = mockExecutionContext({ authorization: 'Bearer valid.jwt.token' });

    await expect(guard.canActivate(context)).rejects.toThrow(ServiceUnavailableException);
  });

  it('should throw UnauthorizedException when authenticated user does not exist in DB (no phantom user)', async () => {
    jwtService.verify.mockReturnValue({
      sub: '550e8400-e29b-41d4-a716-446655440000',
      role: 'USER',
    });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue(null);

    const context = mockExecutionContext({ authorization: 'Bearer valid.jwt.token' });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should hydrate request.identity and request.user with verified DB user on success', async () => {
    const canonicalId = '550e8400-e29b-41d4-a716-446655440000';
    const mockDbUser = {
      id: canonicalId,
      identityId: canonicalId,
      telegramUserId: 123456789n,
      state: 'ACTIVE_USER',
    };

    jwtService.verify.mockReturnValue({
      sub: canonicalId,
      role: 'USER',
    });
    prisma.user.findUnique.mockResolvedValue(mockDbUser);

    const context = mockExecutionContext({ authorization: 'Bearer valid.jwt.token' });
    const req = context.switchToHttp().getRequest();

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(req.identity.userId).toBe(canonicalId);
    expect(req.identity.universalIdentityId).toBe(canonicalId);
    expect(req.identity.telegramUserId).toBe(123456789n);
    expect(req.user.id).toBe(canonicalId);
    expect(req.user.telegramUserId).toBe('123456789');
  });
});
