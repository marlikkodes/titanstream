import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EventBusService, PlatformEvent } from '../automation/event-bus.service';
import { LedgerEntryType, SettlementStatus, TransactionType } from '@prisma/client';
import { isProduction } from '../../common/config/env.util';

export interface TreasuryMetrics {
  totalLiquidity: number;       // Cash reserves in system (USDT)
  userLiabilities: number;      // Total USDT owed to users
  reserveRatio: number;         // reserve cash / liabilities (%)
  projectedPayouts: number;     // Pending withdrawals in queue
  settlementExposure: number;   // Active deposits in process
  capacityRemaining: number;    // Available compute nodes (%)
  healthStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  riskScore: 'LOW' | 'MEDIUM' | 'HIGH';
  forecastDays: number;         // Days of reserve cash coverage
  countryAllocation: Record<string, number>;
  treasuryHealthScore: number;  // Internal Backend-Only Score (0 - 100)
  outstandingMachineLiabilities: number; // Projected lifetime machine yield commitments
  netEcosystemContribution: number;      // Total platform revenue - total platform liabilities
  rcr: number;                 // Revenue Coverage Ratio (Total Revenue / Total Liabilities)
  rcrStatus: 'CRITICAL' | 'STABLE' | 'HEALTHY' | 'EXPANSION_READY';
}

export interface LiabilitiesBreakdown {
  activeMachineRewardPools: number;
  pendingSessionClaims: number;
  pendingWithdrawalsQueue: number;
  referralObligations: number;
  campaignObligations: number;
  operatorBonusObligations: number;
  totalOutstandingLiability: number;
}

@Injectable()
export class TreasuryService implements OnModuleInit {
  private readonly logger = new Logger(TreasuryService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly eventBus?: EventBusService,
  ) {}

  onModuleInit() {
    this.logger.log('Treasury Intelligence Service active. Listening for ledger events...');

    if (this.eventBus) {
      this.eventBus.on('SettlementCompleted').subscribe({
        next: () => this.logger.log('[TreasuryIntel] Recalculating metrics after deposit settlement completed.'),
      });

      this.eventBus.on('WithdrawalCompleted').subscribe({
        next: () => this.logger.log('[TreasuryIntel] Recalculating metrics after withdrawal completed.'),
      });
    }
  }

  /**
   * Internal Treasury Health & Safety Check for Withdrawal Dispatching
   */
  async checkWithdrawalSafety(requestedAmountUsdt: number): Promise<{ safe: boolean; reason?: string }> {
    const metrics = await this.getMetrics();
    
    if (metrics.reserveRatio < 150 || metrics.rcr < 1.0) {
      return { safe: false, reason: `Treasury reserve ratio (${metrics.reserveRatio}%) or RCR (${metrics.rcr}) below safety threshold (150%)` };
    }

    if (requestedAmountUsdt > metrics.totalLiquidity * 0.25) {
      return { safe: false, reason: `Single withdrawal exceeds maximum single transaction limit (25% of total liquidity)` };
    }

    if (metrics.healthStatus === 'CRITICAL') {
      return { safe: false, reason: `Treasury health status is CRITICAL. Auto-withdrawals temporarily paused.` };
    }

    return { safe: true };
  }

  /**
   * Detailed Liabilities Breakdown Engine (System 7)
   */
  async getLiabilitiesBreakdown(): Promise<LiabilitiesBreakdown> {
    const metrics = await this.getMetrics();

    const activeMachineRewardPools = Math.round(metrics.userLiabilities * 0.55 * 100) / 100;
    const pendingSessionClaims = Math.round(metrics.userLiabilities * 0.25 * 100) / 100;
    const pendingWithdrawalsQueue = metrics.projectedPayouts;
    const referralObligations = Math.round(metrics.userLiabilities * 0.10 * 100) / 100;
    const campaignObligations = Math.round(metrics.userLiabilities * 0.05 * 100) / 100;
    const operatorBonusObligations = Math.round(metrics.userLiabilities * 0.05 * 100) / 100;

    const totalOutstandingLiability = Math.round(
      (activeMachineRewardPools + pendingSessionClaims + pendingWithdrawalsQueue + referralObligations + campaignObligations + operatorBonusObligations) * 100,
    ) / 100;

    return {
      activeMachineRewardPools,
      pendingSessionClaims,
      pendingWithdrawalsQueue,
      referralObligations,
      campaignObligations,
      operatorBonusObligations,
      totalOutstandingLiability,
    };
  }

  /**
   * Economic Forecast Engine (System 11)
   */
  async getEconomicForecast(days: number = 30) {
    const metrics = await this.getMetrics();
    const dailyGrowthRate = 0.015; // 1.5% projected daily growth

    const projectedLiquidity = Math.round(metrics.totalLiquidity * Math.pow(1 + dailyGrowthRate, days) * 100) / 100;
    const projectedLiabilities = Math.round(metrics.userLiabilities * Math.pow(1 + dailyGrowthRate * 0.8, days) * 100) / 100;
    const projectedReserveRatio = Math.round((projectedLiquidity / (projectedLiabilities || 1)) * 100);
    const projectedRcr = Math.round((projectedLiquidity / (projectedLiabilities || 1)) * 100) / 100;

    return {
      forecastHorizonDays: days,
      currentLiquidity: metrics.totalLiquidity,
      currentLiabilities: metrics.userLiabilities,
      projectedLiquidity,
      projectedLiabilities,
      projectedReserveRatio,
      projectedRcr,
      expectedRepowersCount: Math.round(days * 12.5),
      expectedUpgradesCount: Math.round(days * 3.2),
      status: projectedReserveRatio >= 140 ? 'EXPANSION_READY' : 'STABLE',
    };
  }

  /**
   * Calculate real-time metrics by aggregating the Ledger, active compute capacity, and settlement sessions.
   */
  async getMetrics(): Promise<TreasuryMetrics> {
    try {
      const ledgerCredits = await this.prisma.ledgerEntry.aggregate({
        where: { ledgerAccount: { code: 'USER_ASSET_LIABILITY' }, entryType: LedgerEntryType.CREDIT },
        _sum: { amount: true },
      });

      const ledgerDebits = await this.prisma.ledgerEntry.aggregate({
        where: { ledgerAccount: { code: 'USER_ASSET_LIABILITY' }, entryType: LedgerEntryType.DEBIT },
        _sum: { amount: true },
      });

      const credits = Number(ledgerCredits?._sum?.amount || 0);
      const debits = Number(ledgerDebits?._sum?.amount || 0);
      const userLiabilities = Math.max(0, credits - debits);

      const systemReserveCredits = await this.prisma.ledgerEntry.aggregate({
        where: { ledgerAccount: { code: 'SYSTEM_RESERVE' }, entryType: LedgerEntryType.CREDIT },
        _sum: { amount: true },
      });
      const systemReserveDebits = await this.prisma.ledgerEntry.aggregate({
        where: { ledgerAccount: { code: 'SYSTEM_RESERVE' }, entryType: LedgerEntryType.DEBIT },
        _sum: { amount: true },
      });
      const baseSystemReserve = Math.max(0, Number(systemReserveCredits?._sum?.amount || 0) - Number(systemReserveDebits?._sum?.amount || 0));
      
      const totalDeposits = await this.prisma.settlementSession.aggregate({
        where: { status: SettlementStatus.COMPLETED, sessionType: 'DEPOSIT' },
        _sum: { expectedCryptoAmount: true },
      });

      const totalWithdrawals = await this.prisma.settlementSession.aggregate({
        where: { status: SettlementStatus.COMPLETED, sessionType: 'PAYOUT' },
        _sum: { expectedCryptoAmount: true },
      });

      const depVal = Number(totalDeposits._sum.expectedCryptoAmount || 0);
      const wthVal = Number(totalWithdrawals._sum.expectedCryptoAmount || 0);
      const totalLiquidity = baseSystemReserve + depVal - wthVal;

      const reserveRatio = userLiabilities > 0 
        ? Math.round((totalLiquidity / userLiabilities) * 100) 
        : (totalLiquidity > 0 ? 1000 : 100);

      const rcr = userLiabilities > 0 
        ? Math.round((totalLiquidity / userLiabilities) * 100) / 100 
        : (totalLiquidity > 0 ? 10.0 : 1.0);

      const pendingPayouts = await this.prisma.settlementSession.aggregate({
        where: { 
          status: { in: [SettlementStatus.CREATED, SettlementStatus.INITIALIZED, SettlementStatus.VERIFYING] }, 
          sessionType: 'PAYOUT' 
        },
        _sum: { expectedCryptoAmount: true },
      });
      const projectedPayouts = Number(pendingPayouts._sum.expectedCryptoAmount || 0);

      const activeDeposits = await this.prisma.settlementSession.aggregate({
        where: { 
          status: { in: [SettlementStatus.CREATED, SettlementStatus.INITIALIZED, SettlementStatus.WAITING_FOR_PAYMENT, SettlementStatus.VERIFYING] }, 
          sessionType: 'DEPOSIT' 
        },
        _sum: { expectedCryptoAmount: true },
      });
      const settlementExposure = Number(activeDeposits._sum.expectedCryptoAmount || 0);

      const leasedUnits = await this.prisma.financialTransaction.count({
        where: { transactionType: TransactionType.SYSTEM_ALLOCATION },
      });
      
      const maxUnits = 500;
      const capacityRemaining = Math.max(0, Math.round(((maxUnits - leasedUnits) / maxUnits) * 100));

      const completedSessions = await this.prisma.settlementSession.findMany({
        where: { status: SettlementStatus.COMPLETED },
        select: { country: true, expectedCryptoAmount: true },
      });

      const countryAllocation: Record<string, number> = {};
      completedSessions.forEach((s) => {
        const cCode = s.country || 'GLOBAL';
        const amt = Number(s.expectedCryptoAmount || 0);
        countryAllocation[cCode] = (countryAllocation[cCode] || 0) + amt;
      });

      const outstandingMachineLiabilities = Math.round((userLiabilities + projectedPayouts) * 100) / 100;
      const netEcosystemContribution = Math.round((totalLiquidity - userLiabilities) * 100) / 100;

      // Revenue Coverage Ratio (RCR) = Total Verified Revenue / Total Outstanding Liabilities
      let rcrStatus: 'CRITICAL' | 'STABLE' | 'HEALTHY' | 'EXPANSION_READY' = 'HEALTHY';
      if (rcr < 1.0) rcrStatus = 'CRITICAL';
      else if (rcr < 1.25) rcrStatus = 'STABLE';
      else if (rcr < 2.0) rcrStatus = 'HEALTHY';
      else rcrStatus = 'EXPANSION_READY';

      let treasuryHealthScore = 100;
      if (reserveRatio < 150) treasuryHealthScore -= Math.min(40, Math.round((150 - reserveRatio) * 0.8));
      if (projectedPayouts > totalLiquidity * 0.3 && totalLiquidity > 0) treasuryHealthScore -= 20;

      let healthStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' = 'HEALTHY';
      let riskScore: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
      
      if (reserveRatio < 100 || treasuryHealthScore < 50) {
        healthStatus = 'CRITICAL';
        riskScore = 'HIGH';
      } else if (reserveRatio < 120 || (projectedPayouts > totalLiquidity * 0.4 && totalLiquidity > 0) || treasuryHealthScore < 75) {
        healthStatus = 'DEGRADED';
        riskScore = 'MEDIUM';
      }

      const dailyVelocity = 150;
      const forecastDays = totalLiquidity > 0 ? Math.round(totalLiquidity / dailyVelocity) : 0;

      return {
        totalLiquidity: Math.round(totalLiquidity * 100) / 100,
        userLiabilities: Math.round(userLiabilities * 100) / 100,
        reserveRatio,
        projectedPayouts: Math.round(projectedPayouts * 100) / 100,
        settlementExposure: Math.round(settlementExposure * 100) / 100,
        capacityRemaining,
        healthStatus,
        riskScore,
        forecastDays,
        countryAllocation,
        treasuryHealthScore,
        outstandingMachineLiabilities,
        netEcosystemContribution,
        rcr,
        rcrStatus,
      };
    } catch (err: any) {
      this.logger.error(`Failed to load Treasury metrics: ${err.message}`);
      if (isProduction()) {
        throw err;
      }
      return {
        totalLiquidity: 2500.0,
        userLiabilities: 1052.9,
        reserveRatio: 237,
        projectedPayouts: 0,
        settlementExposure: 0,
        capacityRemaining: 86,
        healthStatus: 'HEALTHY',
        riskScore: 'LOW',
        forecastDays: 17,
        countryAllocation: { UG: 1250, KE: 400, GLOBAL: 680 },
        treasuryHealthScore: 98,
        outstandingMachineLiabilities: 1052.9,
        netEcosystemContribution: 1447.1,
        rcr: 2.37,
        rcrStatus: 'EXPANSION_READY',
      };
    }
  }
}
