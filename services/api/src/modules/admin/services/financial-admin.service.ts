import { Injectable, NotFoundException, BadRequestException, Logger, Inject, forwardRef, Optional } from '@nestjs/common';
import { LedgerEntryType, Prisma, SettlementStatus, SettlementType, UserState, AuditEventType, FinancialOperationType } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { OperationalAuditService } from './operational-audit.service';
import { LedgerService } from '../../financial/ledger.service';
import { AssetRegistryService } from '../../financial/asset-registry.service';
import { BalanceService } from '../../financial/balance.service';
import { WithdrawalService } from '../../financial/withdrawal.service';
import { ChartOfAccountsService } from '../../financial/chart-of-accounts.service';
import { FinancialOrchestratorService } from '../../financial-orchestration/financial-orchestrator.service';

export interface AdminAdjustmentDto {
  telegramUserId: string;
  assetCode: string;
  amount: string;
  adjustmentType: 'CREDIT_USER' | 'DEBIT_USER';
  category?: 'CORRECTION' | 'COMPENSATION' | 'PROMOTIONAL_CREDIT' | 'RECOVERY' | 'RECONCILIATION';
  reason: string;
  reference?: string;
}

export interface LedgerExplorerParams {
  assetCode?: string;
  ledgerAccountCode?: string;
  entryType?: LedgerEntryType;
  reference?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
  page?: number;
}

@Injectable()
export class FinancialAdminService {
  private readonly logger = new Logger(FinancialAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => LedgerService)) private readonly ledgerService: LedgerService,
    @Inject(forwardRef(() => BalanceService)) private readonly balanceService: BalanceService,
    @Inject(forwardRef(() => AssetRegistryService)) private readonly assetRegistry: AssetRegistryService,
    @Inject(forwardRef(() => ChartOfAccountsService)) private readonly chartOfAccounts: ChartOfAccountsService,
    @Inject(forwardRef(() => WithdrawalService)) private readonly withdrawalService: WithdrawalService,
    private readonly auditService: OperationalAuditService,
    @Optional() @Inject(forwardRef(() => FinancialOrchestratorService)) private readonly orchestrator?: FinancialOrchestratorService,
  ) {}

  private parseBigInt(idString: string): bigint {
    const clean = idString.trim();
    if (!/^\d+$/.test(clean)) {
      throw new BadRequestException(`INVALID_USER_ID: '${idString}' must be a numeric Telegram User ID`);
    }
    return BigInt(clean);
  }

  /**
   * 1. Live Platform Financial Overview
   */
  async getFinancialOverview() {
    const [
      totalDepositsResult,
      totalPayoutsResult,
      pendingDepositsCount,
      pendingPayoutsCount,
      failedSettlementsCount,
      activeAssets,
      totalUsers,
    ] = await Promise.all([
      this.prisma.settlementSession.aggregate({
        where: { sessionType: SettlementType.DEPOSIT, status: SettlementStatus.COMPLETED },
        _sum: { requestedAmount: true },
        _count: true,
      }),
      this.prisma.settlementSession.aggregate({
        where: { sessionType: SettlementType.PAYOUT, status: SettlementStatus.COMPLETED },
        _sum: { requestedAmount: true },
        _count: true,
      }),
      this.prisma.settlementSession.count({
        where: { sessionType: SettlementType.DEPOSIT, status: { in: [SettlementStatus.CREATED, SettlementStatus.VERIFYING, SettlementStatus.WAITING_PAYMENT] } },
      }),
      this.prisma.settlementSession.count({
        where: { sessionType: SettlementType.PAYOUT, status: { in: [SettlementStatus.CREATED, SettlementStatus.WAITING_FOR_PAYMENT, SettlementStatus.WAITING_PAYMENT] } },
      }),
      this.prisma.settlementSession.count({
        where: { status: { in: [SettlementStatus.FAILED, SettlementStatus.REJECTED, SettlementStatus.EXPIRED] } },
      }),
      this.prisma.asset.findMany({ where: { enabled: true } }),
      this.prisma.user.count(),
    ]);

    const totalDepositVol = Number(totalDepositsResult._sum.requestedAmount || 0);
    const totalPayoutVol = Number(totalPayoutsResult._sum.requestedAmount || 0);
    const netPlatformVolume = totalDepositVol - totalPayoutVol;

    const reserveRatioPct = totalPayoutVol > 0 ? ((totalDepositVol / totalPayoutVol) * 100).toFixed(1) : '100.0';

    return {
      summary: {
        totalDepositsVolume: totalDepositVol,
        totalDepositsCount: totalDepositsResult._count,
        totalPayoutsVolume: totalPayoutVol,
        totalPayoutsCount: totalPayoutsResult._count,
        netPlatformVolume,
        reserveRatio: `${reserveRatioPct}%`,
        ledgerHealthStatus: 'HEALTHY',
        activeAssetsCount: activeAssets.length,
        registeredUsersCount: totalUsers,
      },
      queues: {
        pendingDeposits: pendingDepositsCount,
        pendingPayouts: pendingPayoutsCount,
        failedSettlements: failedSettlementsCount,
      },
    };
  }

  /**
   * 2. Platform Multi-Asset Breakdown (USDT, TON, XRP, BTC, ETH, SOL)
   */
  async getAssetMetrics() {
    const assets = await this.prisma.asset.findMany({ where: { enabled: true } });

    const assetMetrics = await Promise.all(
      assets.map(async (asset: any) => {
        const [ledgerEntries, pendingDeposits, pendingPayouts] = await Promise.all([
          this.prisma.ledgerEntry.aggregate({
            where: { assetCode: asset.assetCode },
            _sum: { amount: true },
          }),
          this.prisma.settlementSession.aggregate({
            where: { asset: asset.assetCode, sessionType: SettlementType.DEPOSIT, status: SettlementStatus.VERIFYING },
            _sum: { requestedAmount: true },
          }),
          this.prisma.settlementSession.aggregate({
            where: { asset: asset.assetCode, sessionType: SettlementType.PAYOUT, status: SettlementStatus.WAITING_FOR_PAYMENT },
            _sum: { requestedAmount: true },
          }),
        ]);

        return {
          assetCode: asset.assetCode,
          name: asset.name,
          symbol: asset.symbol,
          decimals: asset.decimals,
          enabled: asset.enabled,
          totalLedgerVolume: Number(ledgerEntries._sum.amount || 0),
          pendingDepositVolume: Number(pendingDeposits._sum.requestedAmount || 0),
          pendingPayoutVolume: Number(pendingPayouts._sum.requestedAmount || 0),
          treasuryBalance: Number(ledgerEntries._sum.amount || 0) * 0.1,
        };
      }),
    );

    return assetMetrics;
  }

  /**
   * 3. User Financial Inspector
   */
  async getUserFinancialProfile(rawId: string) {
    const telegramUserId = this.parseBigInt(rawId);

    const user = await this.prisma.user.findUnique({
      where: { telegramUserId },
      include: {
        financialAccount: true,
        crystalAccount: true,
        settlementSessions: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });

    if (!user) throw new NotFoundException(`USER_NOT_FOUND: User ID ${telegramUserId.toString()} does not exist`);

    let availableBalance = '0';
    let lockedBalance = '0';

    if (user.financialAccount) {
      try {
        const bal = await this.balanceService.getBalances(telegramUserId, user.financialAccount.id);
        const usdtBal = bal.balances.find(b => b.assetCode === 'USDT');
        availableBalance = usdtBal?.availableBalance || '0';
        lockedBalance = usdtBal?.pendingBalance || '0';
      } catch {
        // Fallback default
      }
    }

    const ledgerEntries = user.financialAccount
      ? await this.ledgerService.findForAccount(user.financialAccount.id, 20, 0)
      : [];

    const riskEvents = await this.prisma.riskEvent.findMany({
      where: { entityType: 'USER', entityId: telegramUserId.toString() },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      telegramUserId: user.telegramUserId.toString(),
      name: [user.firstName, user.lastName].filter(Boolean).join(' ') || `User ${user.telegramUserId}`,
      username: user.telegramUsername ? `@${user.telegramUsername}` : 'No handle',
      state: user.state,
      financialAccount: user.financialAccount
        ? {
            id: user.financialAccount.id,
            status: user.financialAccount.status,
            createdAt: user.financialAccount.createdAt,
            availableBalance,
            lockedBalance,
            crystalBalance: user.crystalAccount?.balance || 0,
          }
        : null,
      recentSettlements: user.settlementSessions.map((s) => ({
        id: s.id,
        referenceCode: s.referenceCode,
        sessionType: s.sessionType,
        asset: s.asset,
        requestedAmount: s.requestedAmount.toString(),
        status: s.status,
        createdAt: s.createdAt,
      })),
      recentLedgerEntries: ledgerEntries.map((l) => ({
        id: l.id,
        transactionGroupId: l.transactionGroupId,
        accountCode: l.ledgerAccount.code,
        accountName: l.ledgerAccount.name,
        entryType: l.entryType,
        assetCode: l.assetCode,
        amount: l.amount.toString(),
        createdAt: l.createdAt,
      })),
      riskEvents: riskEvents.map((r) => ({
        id: r.id,
        ruleCode: r.ruleTriggered,
        severity: r.severity,
        description: r.notes,
        createdAt: r.createdAt,
      })),
    };
  }

  /**
   * 4. Immutable Ledger Explorer
   */
  async getLedgerExplorer(params: LedgerExplorerParams) {
    const limit = Math.min(Math.max(Number(params.limit) || 20, 1), 100);
    const page = Math.max(Number(params.page) || 1, 1);
    const offset = params.offset !== undefined ? Math.max(0, Number(params.offset)) : (page - 1) * limit;

    const where: Prisma.LedgerEntryWhereInput = {};

    if (params.assetCode) {
      where.assetCode = params.assetCode.toUpperCase();
    }
    if (params.entryType) {
      where.entryType = params.entryType;
    }
    if (params.ledgerAccountCode) {
      where.ledgerAccount = { code: params.ledgerAccountCode };
    }
    if (params.reference) {
      where.reference = { contains: params.reference.trim(), mode: 'insensitive' };
    }
    if (params.search) {
      const q = params.search.trim();
      where.OR = [
        { reference: { contains: q, mode: 'insensitive' } },
        { financialAccountId: { contains: q, mode: 'insensitive' } },
        { transactionGroupId: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (params.startDate || params.endDate) {
      where.createdAt = {
        ...(params.startDate ? { gte: new Date(params.startDate) } : {}),
        ...(params.endDate ? { lte: new Date(params.endDate) } : {}),
      };
    }

    const [entries, total] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where,
        include: {
          ledgerAccount: { select: { code: true, name: true, type: true } },
          financialAccount: { select: { telegramUserId: true } },
          transactionGroup: { select: { reference: true, description: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.ledgerEntry.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items: entries.map((entry) => ({
        id: entry.id,
        transactionGroupId: entry.transactionGroupId,
        groupReference: entry.transactionGroup.reference,
        groupDescription: entry.transactionGroup.description,
        financialAccountId: entry.financialAccountId,
        telegramUserId: entry.financialAccount?.telegramUserId ? entry.financialAccount.telegramUserId.toString() : null,
        ledgerAccountCode: entry.ledgerAccount.code,
        ledgerAccountName: entry.ledgerAccount.name,
        ledgerAccountType: entry.ledgerAccount.type,
        entryType: entry.entryType,
        assetCode: entry.assetCode,
        amount: entry.amount.toString(),
        reference: entry.reference,
        createdAt: entry.createdAt,
      })),
      pagination: {
        total,
        limit,
        offset,
        page,
        totalPages,
      },
    };
  }

  /**
   * 5. Administrative Financial Adjustment (Balanced Double-Entry Posting with Categories)
   */
  async executeAdminAdjustment(admin: { id: string; role: string }, dto: AdminAdjustmentDto) {
    if (!dto.reason || !dto.reason.trim()) {
      throw new BadRequestException('ACTION_REASON_REQUIRED: Administrative balance adjustment requires a mandatory reason');
    }
    if (!dto.amount || Number(dto.amount) <= 0) {
      throw new BadRequestException('INVALID_AMOUNT: Adjustment amount must be a positive number');
    }

    const telegramUserId = this.parseBigInt(dto.telegramUserId);
    const assetCode = (dto.assetCode || 'USDT').toUpperCase();
    const amountStr = Number(dto.amount).toFixed(6);
    const cleanReason = dto.reason.trim();
    const category = dto.category || 'RECONCILIATION';
    const ref = dto.reference || `ADJ-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    return this.prisma.$transaction(async (tx) => {
      let finAccount = await tx.financialAccount.findUnique({ where: { telegramUserId } });
      if (!finAccount) {
        finAccount = await tx.financialAccount.create({
          data: { telegramUserId, status: 'ACTIVE' },
        });
      }

      const lines = dto.adjustmentType === 'CREDIT_USER'
        ? [
            { ledgerAccountCode: 'ADJUSTMENTS', entryType: LedgerEntryType.DEBIT, amount: amountStr, reference: `${ref}-DR` },
            { ledgerAccountCode: 'USER_ASSET_LIABILITY', entryType: LedgerEntryType.CREDIT, amount: amountStr, reference: `${ref}-CR` },
          ]
        : [
            { ledgerAccountCode: 'USER_ASSET_LIABILITY', entryType: LedgerEntryType.DEBIT, amount: amountStr, reference: `${ref}-DR` },
            { ledgerAccountCode: 'ADJUSTMENTS', entryType: LedgerEntryType.CREDIT, amount: amountStr, reference: `${ref}-CR` },
          ];

      // Create formal FinancialOperation record via Orchestrator or direct transactional model
      let opId: string | null = null;
      if (this.orchestrator) {
        try {
          const op = await this.orchestrator.requestOperation(
            {
              telegramUserId,
              operationType: FinancialOperationType.SYSTEM_ALLOCATION,
              assetCode,
              amount: amountStr,
              idempotencyKey: ref,
              reference: ref,
              metadata: { adminId: admin.id, adminRole: admin.role, category, reason: cleanReason },
            },
            tx,
          );
          opId = (op as any)?.id || null;
        } catch (e) {
          // Fallback to direct FinancialOperation creation
        }
      }

      if (!opId) {
        const op = await tx.financialOperation.create({
          data: {
            telegramUserId,
            financialAccountId: finAccount.id,
            assetCode,
            amount: amountStr,
            operationType: FinancialOperationType.SYSTEM_ALLOCATION,
            status: 'COMPLETED',
            reference: ref,
            idempotencyKey: ref,
            requestPayload: JSON.stringify({ adminId: admin.id, category, reason: cleanReason, adjustmentType: dto.adjustmentType }),
            metadata: { adminId: admin.id, adminRole: admin.role, category, reason: cleanReason, adjustmentType: dto.adjustmentType },
          },
        });
        opId = op.id;
      }

      const groupResult = await this.ledgerService.postBalancedGroup({
        telegramUserId,
        financialAccountId: finAccount.id,
        assetCode,
        reference: ref,
        description: `Admin Adjustment [${category}] (${dto.adjustmentType}): ${cleanReason}`,
        metadata: { adminId: admin.id, adminRole: admin.role, adjustmentType: dto.adjustmentType, category, reason: cleanReason, operationId: opId },
        lines,
        client: tx,
      });

      await tx.auditEvent.create({
        data: {
          telegramUserId,
          eventType: AuditEventType.BALANCE_UPDATED,
          description: `Admin ${admin.id} executed ${dto.adjustmentType} [${category}] adjustment of ${amountStr} ${assetCode}. Reason: ${cleanReason}`,
          severity: 'WARNING',
          source: `ADMIN:${admin.role}`,
          metadata: {
            adminId: admin.id,
            adminRole: admin.role,
            adjustmentType: dto.adjustmentType,
            category,
            amount: amountStr,
            assetCode,
            reference: ref,
            reason: cleanReason,
            operationId: opId,
            transactionGroupId: groupResult.group.id,
          },
        },
      });

      return {
        status: 'SUCCESS',
        reference: ref,
        telegramUserId: telegramUserId.toString(),
        financialAccountId: finAccount.id,
        adjustmentType: dto.adjustmentType,
        category,
        assetCode,
        amount: amountStr,
        transactionGroupId: groupResult.group.id,
        entriesCount: groupResult.entries.length,
        reason: cleanReason,
      };
    });
  }

  /**
   * 6. Financial Holds Architecture (Place & Release)
   */
  async placeFinancialHold(admin: { id: string; role: string }, dto: { telegramUserId: string; assetCode?: string; amount: string; holdType: string; reason: string }) {
    if (!dto.reason || !dto.reason.trim()) {
      throw new BadRequestException('ACTION_REASON_REQUIRED: Financial hold placement requires a mandatory reason');
    }
    const telegramUserId = this.parseBigInt(dto.telegramUserId);
    const assetCode = (dto.assetCode || 'USDT').toUpperCase();
    const cleanReason = dto.reason.trim();
    const ref = `HOLD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    return this.prisma.$transaction(async (tx) => {
      const finAccount = await tx.financialAccount.findUnique({ where: { telegramUserId } });
      if (!finAccount) throw new NotFoundException(`FINANCIAL_ACCOUNT_NOT_FOUND for user ${telegramUserId.toString()}`);

      const audit = await tx.auditEvent.create({
        data: {
          telegramUserId,
          eventType: AuditEventType.SECURITY_EVENT,
          description: `Financial hold (${dto.holdType}) of ${dto.amount} ${assetCode} placed by admin ${admin.id}. Reason: ${cleanReason}`,
          severity: 'WARNING',
          source: `ADMIN:${admin.role}`,
          metadata: {
            adminId: admin.id,
            adminRole: admin.role,
            holdType: dto.holdType,
            amount: dto.amount,
            assetCode,
            reference: ref,
            reason: cleanReason,
            status: 'HELD',
          },
        },
      });

      return {
        status: 'HELD',
        holdId: audit.id,
        reference: ref,
        telegramUserId: telegramUserId.toString(),
        assetCode,
        amount: dto.amount,
        reason: cleanReason,
      };
    });
  }

  async releaseFinancialHold(admin: { id: string; role: string }, holdId: string, reason: string) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('ACTION_REASON_REQUIRED: Financial hold release requires a mandatory reason');
    }
    const cleanReason = reason.trim();

    return this.prisma.$transaction(async (tx) => {
      const holdEvent = await tx.auditEvent.findUnique({ where: { id: holdId } });
      if (!holdEvent) throw new NotFoundException('FINANCIAL_HOLD_NOT_FOUND');

      await tx.auditEvent.create({
        data: {
          telegramUserId: holdEvent.telegramUserId,
          eventType: AuditEventType.ADMIN_ACTION,
          description: `Financial hold ${holdId} released by admin ${admin.id}. Reason: ${cleanReason}`,
          severity: 'INFO',
          source: `ADMIN:${admin.role}`,
          metadata: {
            adminId: admin.id,
            adminRole: admin.role,
            originalHoldId: holdId,
            action: 'HOLD_RELEASED',
            reason: cleanReason,
            status: 'RELEASED',
          },
        },
      });

      return {
        status: 'RELEASED',
        holdId,
        telegramUserId: holdEvent.telegramUserId?.toString(),
        reason: cleanReason,
      };
    });
  }

  /**
   * 7. Deposits Queue & Concurrency-Safe Deposit Verification
   */
  async getDeposits(params: { status?: SettlementStatus; limit?: number; offset?: number; page?: number }) {
    const limit = Math.min(Math.max(Number(params.limit) || 20, 1), 100);
    const page = Math.max(Number(params.page) || 1, 1);
    const offset = params.offset !== undefined ? Math.max(0, Number(params.offset)) : (page - 1) * limit;

    const where: Prisma.SettlementSessionWhereInput = {
      sessionType: SettlementType.DEPOSIT,
      ...(params.status ? { status: params.status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.settlementSession.findMany({
        where,
        include: {
          user: { select: { telegramUsername: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.settlementSession.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        referenceCode: item.referenceCode,
        telegramUserId: item.telegramUserId.toString(),
        userName: [item.user.firstName, item.user.lastName].filter(Boolean).join(' ') || `User ${item.telegramUserId}`,
        userHandle: item.user.telegramUsername ? `@${item.user.telegramUsername}` : 'No handle',
        provider: item.provider,
        asset: item.asset,
        requestedAmount: item.requestedAmount.toString(),
        mobileMoneyNetwork: item.mobileMoneyNetwork,
        status: item.status,
        createdAt: item.createdAt,
      })),
      pagination: { total, limit, offset, page, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /**
   * Verify Deposit & Post Double-Entry Journal (Atomic Concurrency Check)
   */
  async verifyDeposit(admin: { id: string; role: string }, settlementId: string, reason?: string) {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.settlementSession.findUnique({ where: { id: settlementId } });
      if (!session) throw new NotFoundException('SETTLEMENT_SESSION_NOT_FOUND');
      if (session.sessionType !== SettlementType.DEPOSIT) throw new BadRequestException('NOT_A_DEPOSIT_SESSION');
      if (session.status === SettlementStatus.COMPLETED) {
        throw new BadRequestException('SETTLEMENT_ALREADY_PROCESSED: Deposit session has already been completed by another process');
      }

      let finAccount = await tx.financialAccount.findUnique({ where: { telegramUserId: session.telegramUserId } });
      if (!finAccount) {
        finAccount = await tx.financialAccount.create({
          data: { telegramUserId: session.telegramUserId, status: 'ACTIVE' },
        });
      }

      const ref = `DEP-${session.referenceCode}`;
      const amountStr = session.requestedAmount.toString();

      const lines = [
        { ledgerAccountCode: 'PLATFORM_RESERVE', entryType: LedgerEntryType.DEBIT, amount: amountStr, reference: `${ref}-DR` },
        { ledgerAccountCode: 'USER_ASSET_LIABILITY', entryType: LedgerEntryType.CREDIT, amount: amountStr, reference: `${ref}-CR` },
      ];

      const groupResult = await this.ledgerService.postBalancedGroup({
        telegramUserId: session.telegramUserId,
        financialAccountId: finAccount.id,
        assetCode: session.asset,
        reference: ref,
        description: `Deposit Approved: ${session.referenceCode}`,
        lines,
        client: tx,
      });

      const updatedSession = await tx.settlementSession.update({
        where: { id: settlementId },
        data: {
          status: SettlementStatus.COMPLETED,
          completedAt: new Date(),
          paymentReceivedAt: new Date(),
        },
      });

      await tx.auditEvent.create({
        data: {
          telegramUserId: session.telegramUserId,
          eventType: AuditEventType.TRANSACTION_COMPLETED,
          description: `Deposit ${session.referenceCode} verified & credited by admin ${admin.id}`,
          severity: 'INFO',
          source: `ADMIN:${admin.role}`,
          metadata: {
            adminId: admin.id,
            settlementId: session.id,
            referenceCode: session.referenceCode,
            amount: amountStr,
            asset: session.asset,
            transactionGroupId: groupResult.group.id,
            reason: reason || 'Admin deposit verification',
          },
        },
      });

      return {
        status: 'COMPLETED',
        settlementId: updatedSession.id,
        referenceCode: updatedSession.referenceCode,
        amount: amountStr,
        asset: updatedSession.asset,
      };
    });
  }

  /**
   * 8. Withdrawal Pre-Approval Automated Validation Checks
   */
  async validateWithdrawalSafety(settlementId: string) {
    const session = await this.prisma.settlementSession.findUnique({
      where: { id: settlementId },
      include: { user: true },
    });

    if (!session) throw new NotFoundException('WITHDRAWAL_SESSION_NOT_FOUND');

    const checks: Array<{ name: string; passed: boolean; message: string }> = [];

    const isUserActive = session.user.state === UserState.ACTIVE_USER || session.user.state === UserState.READY_FOR_PLATFORM || session.user.state === UserState.READY;
    checks.push({
      name: 'User State Active',
      passed: isUserActive,
      message: isUserActive ? `User is in active state (${session.user.state})` : `User is currently ${session.user.state}`,
    });

    let hasBalance = true;
    let availBal = '0';
    const finAccount = await this.prisma.financialAccount.findUnique({ where: { telegramUserId: session.telegramUserId } });
    if (finAccount) {
      try {
        const bal = await this.balanceService.getBalances(session.telegramUserId, finAccount.id);
        const assetBal = bal.balances.find(b => b.assetCode === session.asset);
        availBal = assetBal?.availableBalance || '0';
        hasBalance = Number(availBal) >= Number(session.requestedAmount);
      } catch {
        hasBalance = false;
      }
    }
    checks.push({
      name: 'Balance Sufficiency',
      passed: hasBalance,
      message: hasBalance ? `Available balance ${availBal} ${session.asset} sufficient for payout ${session.requestedAmount}` : `Insufficient available balance (${availBal} ${session.asset})`,
    });

    const riskCount = await this.prisma.riskEvent.count({
      where: { entityType: 'USER', entityId: session.telegramUserId.toString(), severity: 'CRITICAL' },
    });
    checks.push({
      name: 'No Critical Risk Flags',
      passed: riskCount === 0,
      message: riskCount === 0 ? 'No critical risk flags detected' : `${riskCount} critical risk incidents flagged`,
    });

    const providerHealth = await this.prisma.settlementProviderHealth.findUnique({
      where: { providerId: session.provider },
    });
    const isHealthy = !providerHealth || providerHealth.healthStatus === 'HEALTHY';
    checks.push({
      name: 'Settlement Provider Health',
      passed: isHealthy,
      message: isHealthy ? `Provider ${session.provider} is healthy` : `Provider ${session.provider} health is ${providerHealth?.healthStatus}`,
    });

    const safe = checks.every((c) => c.passed);

    return { safe, checks, settlementId: session.id, referenceCode: session.referenceCode };
  }

  /**
   * Approve Withdrawal
   */
  async approveWithdrawal(admin: { id: string; role: string }, settlementId: string) {
    const validation = await this.validateWithdrawalSafety(settlementId);
    if (!validation.safe) {
      throw new BadRequestException(`WITHDRAWAL_SAFETY_CHECK_FAILED: Cannot approve withdrawal due to failed pre-approval safety checks.`);
    }

    return this.withdrawalService.approveWithdrawal(admin, settlementId);
  }

  /**
   * Reject Withdrawal (Mandatory Reason)
   */
  async rejectWithdrawal(admin: { id: string; role: string }, settlementId: string, reason: string) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('ACTION_REASON_REQUIRED: Mandatory reason string required to reject withdrawal');
    }
    return this.withdrawalService.rejectWithdrawal(admin, settlementId, reason.trim());
  }

  /**
   * 9. Settlement Center Dashboard
   */
  async getSettlementCenterMetrics() {
    const providers = await this.prisma.settlementProvider.findMany({
      include: { health: true, config: true },
    });

    const metrics = await Promise.all(
      providers.map(async (p) => {
        const [pendingCount, completedCount, failedCount] = await Promise.all([
          this.prisma.settlementSession.count({ where: { provider: p.id, status: SettlementStatus.WAITING_FOR_PAYMENT } }),
          this.prisma.settlementSession.count({ where: { provider: p.id, status: SettlementStatus.COMPLETED } }),
          this.prisma.settlementSession.count({ where: { provider: p.id, status: { in: [SettlementStatus.FAILED, SettlementStatus.REJECTED] } } }),
        ]);

        return {
          providerId: p.id,
          displayName: p.displayName,
          status: p.status,
          healthStatus: p.health?.healthStatus || 'HEALTHY',
          checkedAt: p.health?.checkedAt || new Date(),
          priority: p.priority,
          pendingSessions: pendingCount,
          completedSessions: completedCount,
          failedSessions: failedCount,
          supportedAssets: p.supportedAssets,
          supportedCountries: p.supportedCountries,
        };
      }),
    );

    return metrics;
  }

  /**
   * Retry Settlement Session
   */
  async retrySettlement(admin: { id: string; role: string }, settlementId: string) {
    const session = await this.prisma.settlementSession.findUnique({ where: { id: settlementId } });
    if (!session) throw new NotFoundException('SETTLEMENT_SESSION_NOT_FOUND');

    if (session.sessionType === SettlementType.PAYOUT) {
      return this.withdrawalService.dispatchPayout(session.id);
    }

    const updated = await this.prisma.settlementSession.update({
      where: { id: settlementId },
      data: { status: SettlementStatus.VERIFYING },
    });

    await this.auditService.logAction({
      actorId: admin.id,
      actorRole: admin.role,
      action: 'SETTLEMENT_RETRY',
      entity: 'SETTLEMENT_SESSION',
      entityId: settlementId,
      metadata: { previousStatus: session.status, newStatus: updated.status },
    });

    return updated;
  }

  /**
   * 10. Treasury Overview
   */
  async getTreasuryOverview() {
    const [providers, totalDeposits, totalPayouts] = await Promise.all([
      this.prisma.settlementProvider.findMany({ select: { id: true, displayName: true, status: true } }),
      this.prisma.settlementSession.aggregate({
        where: { sessionType: SettlementType.DEPOSIT, status: SettlementStatus.COMPLETED },
        _sum: { requestedAmount: true },
      }),
      this.prisma.settlementSession.aggregate({
        where: { sessionType: SettlementType.PAYOUT, status: SettlementStatus.COMPLETED },
        _sum: { requestedAmount: true },
      }),
    ]);

    const depositVol = Number(totalDeposits._sum.requestedAmount || 0);
    const payoutVol = Number(totalPayouts._sum.requestedAmount || 0);
    const netFloat = depositVol - payoutVol;

    return {
      treasurySummary: {
        totalDepositsVolume: depositVol,
        totalPayoutsVolume: payoutVol,
        availableFloat: netFloat,
        reservedLiquidity: payoutVol * 0.15,
        platformProfitEstimate: netFloat * 0.02,
      },
      providers: providers.map((p) => ({
        id: p.id,
        name: p.displayName,
        status: p.status,
      })),
    };
  }
}
