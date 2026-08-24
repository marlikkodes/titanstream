import { SettlementEventType, SettlementProviderId } from '@prisma/client';
import { MerchantSettlementProvider } from './merchant-settlement.provider';

describe('MerchantSettlementProvider', () => {
  const settlements = {
    createCustomerSession: jest.fn(),
    getProviderSession: jest.fn(),
    rejectAssignedSettlement: jest.fn(),
    expireOne: jest.fn(),
    cancel: jest.fn(),
  };
  const events = {
    emit: jest.fn(),
  };

  let provider: MerchantSettlementProvider;
  let prisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      settlementSession: {
        create: jest.fn().mockResolvedValue({ id: 'm_1' }),
      },
    };
    const merchantRouting = { selectActiveMerchant: jest.fn().mockResolvedValue({ id: 'm1' }) };
    provider = new MerchantSettlementProvider(prisma as any, settlements as any, events as any, merchantRouting as any);
  });

  it('exposes correct capabilities', () => {
    const caps = provider.getCapabilities();
    expect(caps.provider).toBe(SettlementProviderId.MERCHANT_MOBILE_MONEY);
    expect(caps.supports_buy).toBe(true);
    expect(caps.supported_assets).toContain('USDT');
  });

  it('creates merchant settlement', async () => {
    settlements.createCustomerSession.mockResolvedValue({ settlementId: 'm_1' });
    const result = await provider.createSettlement(123n, {
      asset: 'USDT',
      requestedAmount: '100',
      expectedCryptoAmount: '10',
      exchangeRate: '10',
      country: 'KE',
      mobileMoneyNetwork: 'MPESA',
    });
    expect(result).toEqual(expect.objectContaining({ settlementId: 'm_1' }));
    expect(prisma.settlementSession.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        provider: SettlementProviderId.MERCHANT_MOBILE_MONEY,
      }),
    }));
  });

  it('assigns merchant and emits OperatorAssigned event', async () => {
    settlements.getProviderSession.mockResolvedValue({ id: 'm_1' });
    await provider.assignMerchant('m_1', 'op_1');
    expect(events.emit).toHaveBeenCalledWith(
      SettlementProviderId.MERCHANT_MOBILE_MONEY,
      'm_1',
      SettlementEventType.OperatorAssigned,
      { operatorId: 'op_1' },
    );
  });

  it('approves settlement and emits SettlementApproved event', async () => {
    settlements.getProviderSession.mockResolvedValue({ id: 'm_1' });
    await provider.approveSettlement('m_1', { ref: '123' });
    expect(events.emit).toHaveBeenCalledWith(
      SettlementProviderId.MERCHANT_MOBILE_MONEY,
      'm_1',
      SettlementEventType.SettlementApproved,
      { ref: '123' },
    );
  });

  it('rejects settlement', async () => {
    settlements.rejectAssignedSettlement.mockResolvedValue({ status: 'REJECTED' });
    const res = await provider.rejectSettlement('m_1', 'invalid proof');
    expect(res).toEqual({ status: 'REJECTED' });
    expect(settlements.rejectAssignedSettlement).toHaveBeenCalledWith('m_1', 'invalid proof');
  });
});
