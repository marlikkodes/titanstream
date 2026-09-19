import { BadRequestException } from '@nestjs/common';
import { FinancialOperationType, Prisma, SettlementProviderId, SettlementStatus, UsdtTxProcessingStatus } from '@prisma/client';
import { UsdtAddressValidator } from './usdt/usdt.address-validator';
import { UsdtDepositMatchingService } from './usdt/usdt.deposit-matching.service';
import { UsdtProvider } from './usdt/usdt.provider';

describe('USDT Static-Address Funding Rail (Phase H Verification)', () => {
  describe('UsdtAddressValidator', () => {
    it('accepts valid TRON base58 addresses starting with T and 34 chars long', () => {
      expect(() => UsdtAddressValidator.validateOrThrow('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', 'TRON')).not.toThrow();
      expect(() => UsdtAddressValidator.validateOrThrow('TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf', 'TRON')).not.toThrow();
    });

    it('rejects malformed addresses, short strings, and burn addresses', () => {
      expect(() => UsdtAddressValidator.validateOrThrow('invalid_addr', 'TRON')).toThrow('INVALID_USDT_ADDRESS');
      expect(() => UsdtAddressValidator.validateOrThrow('0x1234567890123456789012345678901234567890', 'TRON')).toThrow('INVALID_USDT_ADDRESS');
      expect(() => UsdtAddressValidator.validateOrThrow('T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb', 'TRON')).toThrow('INVALID_USDT_ADDRESS');
    });
  });

  describe('UsdtDepositMatchingService', () => {
    const prismaMock = {
      usdtAddressHistory: {
        findFirst: jest.fn(),
      },
      usdtBlockchainTransaction: {
        findUnique: jest.fn(),
      },
      settlementSession: {
        findMany: jest.fn(),
      },
    };

    let matcher: UsdtDepositMatchingService;

    beforeEach(() => {
      jest.clearAllMocks();
      matcher = new UsdtDepositMatchingService(prismaMock as any);
    });

    it('returns INVALID_RECIPIENT when recipient address does not match active or historical receiving address', async () => {
      prismaMock.usdtAddressHistory.findFirst.mockResolvedValue(null);

      const result = await matcher.matchTransaction(
        {
          transactionHash: 'tx_111',
          network: 'TRON',
          tokenContract: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
          blockNumber: 100n,
          blockTimestamp: new Date(),
          senderAddress: 'TSender...',
          recipientAddress: 'TWrongRecipient...',
          rawTokenAmount: '50000000',
          normalizedAmount: '50.000000',
          confirmations: 20,
          onChainStatus: 'SUCCESS',
        },
        'TActiveRecipient...',
        'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        19,
      );

      expect(result.status).toBe(UsdtTxProcessingStatus.INVALID_RECIPIENT);
    });

    it('returns CONFIRMING when confirmations count is less than required', async () => {
      const result = await matcher.matchTransaction(
        {
          transactionHash: 'tx_222',
          network: 'TRON',
          tokenContract: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
          blockNumber: 100n,
          blockTimestamp: new Date(),
          senderAddress: 'TSender...',
          recipientAddress: 'TActiveRecipient...',
          rawTokenAmount: '50000000',
          normalizedAmount: '50.000000',
          confirmations: 5, // < 19
          onChainStatus: 'SUCCESS',
        },
        'TActiveRecipient...',
        'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        19,
      );

      expect(result.status).toBe(UsdtTxProcessingStatus.CONFIRMING);
    });

    it('returns DUPLICATE when transaction hash was already settled', async () => {
      prismaMock.usdtBlockchainTransaction.findUnique.mockResolvedValue({
        id: 'db_tx_1',
        processingStatus: UsdtTxProcessingStatus.SETTLED,
        settlementSessionId: 'session_already_settled',
      });

      const result = await matcher.matchTransaction(
        {
          transactionHash: 'tx_already_settled',
          network: 'TRON',
          tokenContract: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
          blockNumber: 100n,
          blockTimestamp: new Date(),
          senderAddress: 'TSender...',
          recipientAddress: 'TActiveRecipient...',
          rawTokenAmount: '50000000',
          normalizedAmount: '50.000000',
          confirmations: 20,
          onChainStatus: 'SUCCESS',
        },
        'TActiveRecipient...',
        'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        19,
      );

      expect(result.status).toBe(UsdtTxProcessingStatus.DUPLICATE);
    });

    it('returns MATCHED when exactly one candidate session matches exact amount', async () => {
      prismaMock.usdtBlockchainTransaction.findUnique.mockResolvedValue(null);
      prismaMock.settlementSession.findMany.mockResolvedValue([
        {
          id: 'session_target_123',
          expectedCryptoAmount: new Prisma.Decimal('50.000000'),
          createdAt: new Date(),
        },
      ]);

      const result = await matcher.matchTransaction(
        {
          transactionHash: 'tx_clean_match',
          network: 'TRON',
          tokenContract: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
          blockNumber: 100n,
          blockTimestamp: new Date(),
          senderAddress: 'TSender...',
          recipientAddress: 'TActiveRecipient...',
          rawTokenAmount: '50000000',
          normalizedAmount: '50.000000',
          confirmations: 20,
          onChainStatus: 'SUCCESS',
        },
        'TActiveRecipient...',
        'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        19,
      );

      expect(result.status).toBe(UsdtTxProcessingStatus.MATCHED);
      expect(result.matchedSessionId).toBe('session_target_123');
    });

    it('returns AMBIGUOUS_MATCH when multiple active sessions match the exact amount', async () => {
      prismaMock.usdtBlockchainTransaction.findUnique.mockResolvedValue(null);
      prismaMock.settlementSession.findMany.mockResolvedValue([
        { id: 'session_1', expectedCryptoAmount: new Prisma.Decimal('50.000000') },
        { id: 'session_2', expectedCryptoAmount: new Prisma.Decimal('50.000000') },
      ]);

      const result = await matcher.matchTransaction(
        {
          transactionHash: 'tx_ambiguous',
          network: 'TRON',
          tokenContract: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
          blockNumber: 100n,
          blockTimestamp: new Date(),
          senderAddress: 'TSender...',
          recipientAddress: 'TActiveRecipient...',
          rawTokenAmount: '50000000',
          normalizedAmount: '50.000000',
          confirmations: 20,
          onChainStatus: 'SUCCESS',
        },
        'TActiveRecipient...',
        'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        19,
      );

      expect(result.status).toBe(UsdtTxProcessingStatus.AMBIGUOUS_MATCH);
      expect(result.matchedSessionId).toBeUndefined();
    });

    it('returns UNDERPAYMENT when deposit amount is less than expected session amount', async () => {
      prismaMock.usdtBlockchainTransaction.findUnique.mockResolvedValue(null);
      prismaMock.settlementSession.findMany.mockResolvedValue([
        { id: 'session_under', expectedCryptoAmount: new Prisma.Decimal('100.000000') },
      ]);

      const result = await matcher.matchTransaction(
        {
          transactionHash: 'tx_under',
          network: 'TRON',
          tokenContract: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
          blockNumber: 100n,
          blockTimestamp: new Date(),
          senderAddress: 'TSender...',
          recipientAddress: 'TActiveRecipient...',
          rawTokenAmount: '40000000',
          normalizedAmount: '40.000000', // Expected 100
          confirmations: 20,
          onChainStatus: 'SUCCESS',
        },
        'TActiveRecipient...',
        'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        19,
      );

      expect(result.status).toBe(UsdtTxProcessingStatus.UNDERPAYMENT);
    });
  });

  describe('UsdtProvider Financial Orchestration', () => {
    const prismaMock = {
      settlementSession: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
    };
    const orchestratorMock = {
      requestOperation: jest.fn(),
    };
    const eventsMock = {
      emit: jest.fn(),
    };

    let provider: UsdtProvider;

    beforeEach(() => {
      jest.clearAllMocks();
      provider = new UsdtProvider(prismaMock as any, eventsMock as any, orchestratorMock as any, {} as any);
    });

    it('executes atomic updateMany and requests DEPOSIT_SETTLEMENT operation on orchestrator', async () => {
      prismaMock.settlementSession.findUnique.mockResolvedValue({
        id: 'session_usdt_777',
        telegramUserId: 500n,
        provider: SettlementProviderId.USDT,
        asset: 'USDT',
        expectedCryptoAmount: new Prisma.Decimal('75.00'),
        status: SettlementStatus.WAITING_FOR_PAYMENT,
      });

      prismaMock.settlementSession.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.settlementSession.update.mockResolvedValue({
        id: 'session_usdt_777',
        status: SettlementStatus.COMPLETED,
        orchestratorReference: 'usdt_settlement_session_usdt_777',
      });

      const res = await provider.approveSettlement('session_usdt_777', { txHash: 'tx_hash_777' });

      expect(prismaMock.settlementSession.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'session_usdt_777',
          status: { in: [SettlementStatus.CREATED, SettlementStatus.WAITING_FOR_PAYMENT, SettlementStatus.VERIFYING] },
        },
        data: { status: SettlementStatus.APPROVED },
      });

      expect(orchestratorMock.requestOperation).toHaveBeenCalledWith({
        telegramUserId: 500n,
        operationType: FinancialOperationType.DEPOSIT_SETTLEMENT,
        assetCode: 'USDT',
        amount: '75',
        idempotencyKey: 'usdt_settlement_session_usdt_777',
        reference: 'usdt_settlement_session_usdt_777',
        metadata: expect.objectContaining({
          source: 'usdt_blockchain_settlement',
          settlementId: 'session_usdt_777',
          provider: SettlementProviderId.USDT,
        }),
      });

      expect(res.status).toBe(SettlementStatus.COMPLETED);
    });
  });
});
