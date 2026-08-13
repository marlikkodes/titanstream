import { Test, TestingModule } from '@nestjs/testing';
import { IdentityMasterEngineService } from './identity-master.service';
import { PrismaService } from '../../database/prisma.service';
import { ForbiddenException } from '@nestjs/common';

describe('IdentityMasterEngine — Adversarial Financial & Asset Isolation Suite', () => {
  let service: IdentityMasterEngineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdentityMasterEngineService,
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    service = module.get<IdentityMasterEngineService>(IdentityMasterEngineService);
  });

  it('PROVEN: User B must never be able to claim ownership over User A resources', () => {
    const userA = '550e8400-e29b-41d4-a716-446655440001';
    const userB = '550e8400-e29b-41d4-a716-446655440002';

    // Authorized request (User A requesting User A's resource)
    expect(() => service.assertOwnership(userA, userA)).not.toThrow();

    // Adversarial request (User B attempting operation on User A's resource)
    expect(() => service.assertOwnership(userB, userA)).toThrow(ForbiddenException);
  });
});
