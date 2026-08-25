import { Test, TestingModule } from '@nestjs/testing';
import { CommandCenterConfigService } from './command-center-config.service';
import { PrismaService } from '../../../database/prisma.service';

describe('CommandCenterConfigService', () => {
  let service: CommandCenterConfigService;
  const now = new Date('2026-08-25T00:00:00.000Z');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommandCenterConfigService,
        {
          provide: PrismaService,
          useValue: {
            mobileMoneyMerchant: {
              findMany: jest.fn().mockResolvedValue([]),
              create: jest.fn().mockResolvedValue({
                id: 'merchant_mtn_ug_1',
                network: 'MTN',
                merchantName: 'TitanStream UG Escrow Pool 1',
                merchantNumber: '234654',
                country: 'UG',
                currency: 'UGX',
                status: 'ACTIVE',
                priority: 1,
                dailyLimit: 3700000,
                createdAt: now,
                updatedAt: now,
              }),
            },
          },
        },
      ],
    }).compile();

    service = module.get<CommandCenterConfigService>(CommandCenterConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should retrieve default mobile money receiving registry', async () => {
    const registry = await service.getMobileMoneyRegistry();
    expect(registry.length).toBeGreaterThan(0);
    expect(registry[0].ussdTemplate).toContain('{phone}');
  });

  it('should validate and substitute USSD templates correctly', () => {
    const template = '*165*1*1*{phone}*{amount}#';
    const result = service.testUssdTemplate(template, '0771234567', 50000);
    expect(result.generatedUssd).toBe('*165*1*1*0771234567*50000#');
    expect(result.telUri).toBe('tel:*165*1*1*0771234567*50000%23');
  });
});
