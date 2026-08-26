import { AdminDashboardService } from './admin-dashboard.service';

describe('AdminDashboardService', () => {
  const prisma = {
    user: { count: jest.fn() },
    merchantProfile: { count: jest.fn() },
    settlementSession: { count: jest.fn(), aggregate: jest.fn() },
    riskEvent: { count: jest.fn() },
    supportCase: { count: jest.fn() },
    userMachine: { count: jest.fn(), aggregate: jest.fn() },
  };

  let service: AdminDashboardService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminDashboardService(prisma as any);
  });

  it('aggregates system overview metrics and operational queue counts from backend database', async () => {
    prisma.user.count.mockResolvedValue(150);
    prisma.merchantProfile.count.mockResolvedValue(12);
    prisma.settlementSession.count
      .mockResolvedValueOnce(5) // pendingSettlements
      .mockResolvedValueOnce(450) // completedSettlements
      .mockResolvedValueOnce(10) // failedSettlements
      .mockResolvedValueOnce(2) // disputedSettlements
      .mockResolvedValueOnce(3) // awaitingPayment
      .mockResolvedValueOnce(2) // awaitingMerchantAction
      .mockResolvedValueOnce(1); // verificationRequired

    prisma.settlementSession.aggregate.mockResolvedValue({ _sum: { expectedCryptoAmount: '4500.50' } });
    prisma.riskEvent.count.mockResolvedValue(4);
    prisma.supportCase.count.mockResolvedValue(6);
    prisma.userMachine.count.mockResolvedValue(25);
    prisma.userMachine.aggregate.mockResolvedValue({ _sum: { capacityGhs: 4200 } });

    const result = await service.getDashboardOverview();

    expect(result.system_overview).toEqual({
      active_users: 150,
      active_merchants: 12,
      pending_settlements: 5,
      completed_settlements: 450,
      failed_settlements: 10,
      disputed_settlements: 2,
      transaction_volume: '4500.50',
    });

    expect(result.operational_queues).toEqual({
      awaiting_payment: 3,
      awaiting_merchant_action: 2,
      verification_required: 1,
      risk_review: 4,
      support_cases: 6,
    });

    expect(result.economy_status.active_fleet_nodes).toBe(25);
    expect(result.economy_status.total_fleet_hashrate_ghs).toBe(4200);
  });
});
