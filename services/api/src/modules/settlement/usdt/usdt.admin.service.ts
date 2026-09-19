import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma, UsdtTxProcessingStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { UsdtAddressValidator } from './usdt.address-validator';
import { UsdtBlockchainMonitorService } from './usdt-blockchain-monitor.service';
import { UsdtProvider } from './usdt.provider';
import { CANONICAL_USDT_CONTRACTS } from './usdt.types';

@Injectable()
export class UsdtAdminService {
  private readonly logger = new Logger(UsdtAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly monitor: UsdtBlockchainMonitorService,
    private readonly provider: UsdtProvider,
  ) {}

  /**
   * Get USDT Configuration, Address History, and Scanner Health.
   */
  async getConfig() {
    let config = await this.prisma.usdtConfig.findUnique({ where: { id: 'default' } });
    if (!config) {
      const defaultAddr = process.env.USDT_RECEIVING_ADDRESS?.trim();
      if (!defaultAddr) throw new BadRequestException('USDT_RECEIVING_ADDRESS_NOT_CONFIGURED');
      config = await this.prisma.usdtConfig.create({
        data: {
          id: 'default',
          enabled: true,
          network: 'TRON',
          tokenContract: CANONICAL_USDT_CONTRACTS.TRON,
          receivingAddress: defaultAddr,
          requiredConfirmations: 19,
        },
      });
    }

    const addressHistory = await this.prisma.usdtAddressHistory.findMany({
      orderBy: { activatedAt: 'desc' },
      take: 20,
    });

    const health = await this.monitor.getScannerHealth();

    return {
      config: {
        ...config,
        lastScannedBlock: config.lastScannedBlock.toString(),
      },
      health,
      addressHistory,
    };
  }

  /**
   * Update active receiving address or scanner configuration.
   */
  async updateConfig(
    adminId: string,
    dto: {
      enabled?: boolean;
      network?: string;
      tokenContract?: string;
      receivingAddress?: string;
      requiredConfirmations?: number;
      reason?: string;
    },
  ) {
    let current = await this.prisma.usdtConfig.findUnique({ where: { id: 'default' } });
    const network = dto.network || current?.network || 'TRON';
    const receivingAddress = dto.receivingAddress?.trim() || current?.receivingAddress;

    if (!receivingAddress) {
      throw new BadRequestException('RECEIVING_ADDRESS_REQUIRED');
    }

    // Validate receiving address syntax & network
    UsdtAddressValidator.validateOrThrow(receivingAddress, network);

    // If receiving address is changing, record history entry
    if (current && current.receivingAddress !== receivingAddress) {
      await this.prisma.usdtAddressHistory.updateMany({
        where: { deactivatedAt: null },
        data: { deactivatedAt: new Date() },
      });

      await this.prisma.usdtAddressHistory.create({
        data: {
          address: receivingAddress,
          network,
          tokenContract: dto.tokenContract || current.tokenContract,
          configuredByAdminId: adminId,
          reason: dto.reason || 'Admin address rotation',
        },
      });

      this.logger.log(`[UsdtAdminService] Admin ${adminId} rotated USDT receiving address to ${receivingAddress}`);
    }

    const updated = await this.prisma.usdtConfig.upsert({
      where: { id: 'default' },
      update: {
        enabled: dto.enabled !== undefined ? dto.enabled : current?.enabled ?? true,
        network,
        tokenContract: dto.tokenContract || current?.tokenContract || CANONICAL_USDT_CONTRACTS.TRON,
        receivingAddress,
        requiredConfirmations: dto.requiredConfirmations || current?.requiredConfirmations || 19,
        configuredByAdminId: adminId,
      },
      create: {
        id: 'default',
        enabled: dto.enabled !== undefined ? dto.enabled : true,
        network,
        tokenContract: dto.tokenContract || CANONICAL_USDT_CONTRACTS.TRON,
        receivingAddress,
        requiredConfirmations: dto.requiredConfirmations || 19,
        configuredByAdminId: adminId,
      },
    });

    return {
      ...updated,
      lastScannedBlock: updated.lastScannedBlock.toString(),
    };
  }

  /**
   * List observed blockchain transactions for admin monitoring.
   */
  async listTransactions(query: { status?: string; limit?: number; offset?: number }) {
    const limit = query.limit || 50;
    const offset = query.offset || 0;

    const where: Prisma.UsdtBlockchainTransactionWhereInput = {};
    if (query.status) {
      where.processingStatus = query.status as UsdtTxProcessingStatus;
    }

    const [total, items] = await Promise.all([
      this.prisma.usdtBlockchainTransaction.count({ where }),
      this.prisma.usdtBlockchainTransaction.findMany({
        where,
        orderBy: { blockTimestamp: 'desc' },
        take: limit,
        skip: offset,
      }),
    ]);

    return {
      total,
      limit,
      offset,
      data: items.map((item) => ({
        ...item,
        blockNumber: item.blockNumber.toString(),
        normalizedAmount: item.normalizedAmount.toString(),
      })),
    };
  }

  /**
   * Admin resolution of ambiguous/anomalous blockchain transaction.
   */
  async resolveAmbiguousTransaction(
    adminId: string,
    txId: string,
    targetSettlementSessionId: string,
    reason: string,
  ) {
    const tx = await this.prisma.usdtBlockchainTransaction.findUnique({ where: { id: txId } });
    if (!tx) throw new BadRequestException('BLOCKCHAIN_TRANSACTION_NOT_FOUND');

    if (tx.processingStatus === UsdtTxProcessingStatus.SETTLED) {
      throw new BadRequestException('TRANSACTION_ALREADY_SETTLED');
    }

    const session = await this.prisma.settlementSession.findUnique({ where: { id: targetSettlementSessionId } });
    if (!session) throw new BadRequestException('SETTLEMENT_SESSION_NOT_FOUND');

    this.logger.log(`[UsdtAdminService] Admin ${adminId} resolving tx ${tx.transactionHash} -> session ${targetSettlementSessionId}`);

    // Call provider approval to execute financial orchestrator system allocation
    await this.provider.approveSettlement(targetSettlementSessionId, {
      resolvedByAdminId: adminId,
      resolutionReason: reason || 'Manual admin transaction resolution',
      txHash: tx.transactionHash,
      blockNumber: tx.blockNumber.toString(),
    });

    // Update database transaction status
    const updated = await this.prisma.usdtBlockchainTransaction.update({
      where: { id: txId },
      data: {
        processingStatus: UsdtTxProcessingStatus.SETTLED,
        settlementSessionId: targetSettlementSessionId,
        anomalyReason: `Resolved by admin ${adminId}: ${reason}`,
        finalizedAt: new Date(),
      },
    });

    return {
      ...updated,
      blockNumber: updated.blockNumber.toString(),
      normalizedAmount: updated.normalizedAmount.toString(),
    };
  }
}
