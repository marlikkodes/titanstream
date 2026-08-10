import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { UserState, AuditEventType } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { OperationalAuditService } from './operational-audit.service';

export interface SearchUsersParams {
  query?: string;
  telegramUserId?: string;
  telegramUsername?: string;
  state?: UserState;
  settlementReference?: string;
  transactionReference?: string;
  limit?: number;
  offset?: number;
  page?: number;
}

export interface AdminNoteCreateDto {
  message: string;
  visibility?: string;
}

@Injectable()
export class UserInvestigationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: OperationalAuditService,
  ) {}

  private parseBigInt(idString?: string): bigint | undefined {
    if (!idString) return undefined;
    const clean = idString.trim();
    if (!/^\d+$/.test(clean)) {
      throw new BadRequestException(`INVALID_USER_ID: '${idString}' must be a numeric Telegram User ID`);
    }
    try {
      return BigInt(clean);
    } catch {
      throw new BadRequestException(`INVALID_USER_ID: Failed to parse '${idString}'`);
    }
  }

  async searchUsers(params: SearchUsersParams) {
    const limit = Math.min(Math.max(Number(params.limit) || 20, 1), 100);
    const page = Math.max(Number(params.page) || 1, 1);
    const offset = params.offset !== undefined ? Math.max(0, Number(params.offset)) : (page - 1) * limit;

    let searchTelegramId: bigint | undefined;
    if (params.telegramUserId) {
      searchTelegramId = this.parseBigInt(params.telegramUserId);
    }

    // If searching by settlement reference
    if (params.settlementReference) {
      const session = await this.prisma.settlementSession.findUnique({
        where: { referenceCode: params.settlementReference.trim() },
        select: { telegramUserId: true },
      });
      if (session) {
        searchTelegramId = session.telegramUserId;
      }
    }

    const where: any = {};
    if (searchTelegramId) {
      where.telegramUserId = searchTelegramId;
    }
    if (params.telegramUsername) {
      where.telegramUsername = { contains: params.telegramUsername.trim(), mode: 'insensitive' };
    }
    if (params.state) {
      where.state = params.state;
    }
    if (params.query && !searchTelegramId && !params.telegramUsername) {
      const q = params.query.trim().replace(/^@/, '');
      const isNumeric = /^\d+$/.test(q);
      where.OR = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { telegramUsername: { contains: q, mode: 'insensitive' } },
        ...(isNumeric ? [{ telegramUserId: BigInt(q) }] : []),
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          telegramUserId: true,
          telegramUsername: true,
          firstName: true,
          lastName: true,
          state: true,
          readinessScore: true,
          createdAt: true,
          lastActiveAt: true,
          financialAccount: { select: { id: true, status: true } },
          crystalAccount: { select: { balance: true } },
          userMachines: { select: { id: true } },
          settlementSessions: {
            select: { requestedAmount: true, sessionType: true, status: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    const formattedItems = items.map((user: any) => {
      const totalDeposits = (user.settlementSessions || [])
        .filter((s: any) => s.sessionType === 'DEPOSIT' && s.status === 'COMPLETED')
        .reduce((sum: number, s: any) => sum + Number(s.requestedAmount || 0), 0);

      const totalWithdrawals = (user.settlementSessions || [])
        .filter((s: any) => s.sessionType === 'PAYOUT' && s.status === 'COMPLETED')
        .reduce((sum: number, s: any) => sum + Number(s.requestedAmount || 0), 0);

      const flags: string[] = [];
      if (user.state === UserState.SUSPENDED_USER) flags.push('FROZEN');
      if (user.state === UserState.BANNED_USER) flags.push('BANNED');

      return {
        id: user.telegramUserId.toString(),
        telegramId: user.telegramUserId.toString(),
        name: [user.firstName, user.lastName].filter(Boolean).join(' ') || `User ${user.telegramUserId}`,
        username: user.telegramUsername ? `@${user.telegramUsername}` : 'No handle',
        state: user.state,
        totalVolume: totalDeposits + totalWithdrawals,
        totalDeposits,
        totalWithdrawals,
        riskScore: user.readinessScore || 0,
        flags,
        wallets: user.financialAccount ? [user.financialAccount.id] : [],
        activeMachinesCount: user.userMachines ? user.userMachines.length : 0,
        crystalBalance: user.crystalAccount?.balance || 0,
        createdAt: user.createdAt,
        lastActiveAt: user.lastActiveAt,
      };
    });

    return {
      items: formattedItems,
      pagination: {
        total,
        limit,
        offset,
        page,
        totalPages,
      },
    };
  }

  async getUserDetail(rawId: string | bigint) {
    const telegramUserId = typeof rawId === 'bigint' ? rawId : this.parseBigInt(rawId)!;

    const user = await this.prisma.user.findUnique({
      where: { telegramUserId },
      include: {
        financialAccount: true,
        crystalAccount: true,
        userMachines: true,
        onboardingProgress: true,
        referralCode: true,
        referralAsReferrer: { take: 10 },
        referralAsReferee: true,
        rewards: { orderBy: { createdAt: 'desc' }, take: 10 },
        adminNotes: { orderBy: { createdAt: 'desc' } },
        settlementSessions: { orderBy: { createdAt: 'desc' }, take: 15 },
      },
    });

    if (!user) throw new NotFoundException(`USER_NOT_FOUND: User ID ${telegramUserId.toString()} does not exist`);

    const [riskEvents, supportCases, auditEvents] = await Promise.all([
      this.prisma.riskEvent.findMany({
        where: { entityType: 'USER', entityId: telegramUserId.toString() },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.supportCase.findMany({
        where: { userId: telegramUserId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.auditEvent.findMany({
        where: { telegramUserId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const totalDeposits = (user.settlementSessions || [])
      .filter((s: any) => s.sessionType === 'DEPOSIT' && s.status === 'COMPLETED')
      .reduce((sum: number, s: any) => sum + Number(s.requestedAmount || 0), 0);

    const totalWithdrawals = (user.settlementSessions || [])
      .filter((s: any) => s.sessionType === 'PAYOUT' && s.status === 'COMPLETED')
      .reduce((sum: number, s: any) => sum + Number(s.requestedAmount || 0), 0);

    return {
      id: user.telegramUserId.toString(),
      telegramUserId: user.telegramUserId.toString(),
      telegramUsername: user.telegramUsername,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: [user.firstName, user.lastName].filter(Boolean).join(' '),
      photoUrl: user.photoUrl,
      languageCode: user.languageCode,
      state: user.state,
      isReady: user.isReady,
      educationScore: user.educationScore,
      readinessScore: user.readinessScore,
      qualifiedReferrals: user.qualifiedReferrals,
      payingReferrals: user.payingReferrals,
      loginCount: user.loginCount,
      lastActiveAt: user.lastActiveAt,
      lastLoginAt: user.lastLoginAt,
      lastActiveIp: user.lastActiveIp,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      financialAccount: user.financialAccount
        ? {
            ...user.financialAccount,
            telegramUserId: user.financialAccount.telegramUserId.toString(),
          }
        : null,
      crystalAccount: user.crystalAccount
        ? {
            ...user.crystalAccount,
            telegramUserId: user.crystalAccount.telegramUserId.toString(),
          }
        : null,
      userMachines: (user.userMachines || []).map((m) => ({
        ...m,
        telegramUserId: m.telegramUserId.toString(),
      })),
      onboardingProgress: user.onboardingProgress
        ? {
            ...user.onboardingProgress,
            telegramUserId: user.onboardingProgress.telegramUserId.toString(),
          }
        : null,
      referralCode: user.referralCode,
      referralStats: {
        qualifiedCount: user.qualifiedReferrals,
        payingCount: user.payingReferrals,
        totalReferred: user.referralAsReferrer ? user.referralAsReferrer.length : 0,
      },
      settlementSessions: user.settlementSessions.map((s) => ({
        ...s,
        telegramUserId: s.telegramUserId.toString(),
        requestedAmount: s.requestedAmount.toString(),
        expectedCryptoAmount: s.expectedCryptoAmount.toString(),
      })),
      summaryMetrics: {
        totalDeposits,
        totalWithdrawals,
        netVolume: totalDeposits - totalWithdrawals,
        activeMachines: user.userMachines ? user.userMachines.length : 0,
        crystalBalance: user.crystalAccount?.balance || 0,
      },
      adminNotes: (user.adminNotes || []).map((n) => ({
        ...n,
        telegramUserId: n.telegramUserId.toString(),
      })),
      riskEvents,
      supportCases: supportCases.map((c) => ({
        ...c,
        userId: c.userId?.toString(),
      })),
      recentAuditEvents: auditEvents.map((a) => ({
        ...a,
        telegramUserId: a.telegramUserId?.toString(),
      })),
    };
  }

  /**
   * Atomic Freeze User inside Prisma Transaction
   */
  async freezeUser(admin: { id: string; role: string }, rawId: string | bigint, reason: string) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('ACTION_REASON_REQUIRED: Mandatory reason string required for account freeze');
    }
    const telegramUserId = typeof rawId === 'bigint' ? rawId : this.parseBigInt(rawId)!;
    const cleanReason = reason.trim();

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { telegramUserId } });
      if (!user) throw new NotFoundException(`USER_NOT_FOUND: User ${telegramUserId.toString()} does not exist`);

      const updated = await tx.user.update({
        where: { telegramUserId },
        data: { state: UserState.SUSPENDED_USER },
      });

      await tx.auditEvent.create({
        data: {
          telegramUserId,
          eventType: AuditEventType.ACCOUNT_SUSPENDED,
          description: `User account frozen by admin ${admin.id}. Reason: ${cleanReason}`,
          severity: 'WARNING',
          source: `ADMIN:${admin.role}`,
          metadata: {
            actorId: admin.id,
            actorRole: admin.role,
            action: 'USER_FROZEN',
            previousState: user.state,
            newState: updated.state,
            reason: cleanReason,
            timestamp: new Date().toISOString(),
          },
        },
      });

      return {
        status: 'FROZEN',
        telegramUserId: telegramUserId.toString(),
        previousState: user.state,
        currentState: updated.state,
        reason: cleanReason,
      };
    });
  }

  /**
   * Atomic Unfreeze User inside Prisma Transaction
   */
  async unfreezeUser(admin: { id: string; role: string }, rawId: string | bigint, reason: string) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('ACTION_REASON_REQUIRED: Mandatory reason string required for account unfreeze');
    }
    const telegramUserId = typeof rawId === 'bigint' ? rawId : this.parseBigInt(rawId)!;
    const cleanReason = reason.trim();

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { telegramUserId } });
      if (!user) throw new NotFoundException(`USER_NOT_FOUND: User ${telegramUserId.toString()} does not exist`);

      const updated = await tx.user.update({
        where: { telegramUserId },
        data: { state: UserState.ACTIVE_USER },
      });

      await tx.auditEvent.create({
        data: {
          telegramUserId,
          eventType: AuditEventType.ADMIN_ACTION,
          description: `User account unfrozen by admin ${admin.id}. Reason: ${cleanReason}`,
          severity: 'INFO',
          source: `ADMIN:${admin.role}`,
          metadata: {
            actorId: admin.id,
            actorRole: admin.role,
            action: 'USER_UNFROZEN',
            previousState: user.state,
            newState: updated.state,
            reason: cleanReason,
            timestamp: new Date().toISOString(),
          },
        },
      });

      return {
        status: 'UNFROZEN',
        telegramUserId: telegramUserId.toString(),
        previousState: user.state,
        currentState: updated.state,
        reason: cleanReason,
      };
    });
  }

  /**
   * Atomic Ban User inside Prisma Transaction
   */
  async banUser(admin: { id: string; role: string }, rawId: string | bigint, reason: string) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('ACTION_REASON_REQUIRED: Mandatory reason string required for account ban');
    }
    const telegramUserId = typeof rawId === 'bigint' ? rawId : this.parseBigInt(rawId)!;
    const cleanReason = reason.trim();

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { telegramUserId } });
      if (!user) throw new NotFoundException(`USER_NOT_FOUND: User ${telegramUserId.toString()} does not exist`);

      const updated = await tx.user.update({
        where: { telegramUserId },
        data: { state: UserState.BANNED_USER },
      });

      await tx.auditEvent.create({
        data: {
          telegramUserId,
          eventType: AuditEventType.ACCOUNT_BANNED,
          description: `User account permanently banned by admin ${admin.id}. Reason: ${cleanReason}`,
          severity: 'CRITICAL',
          source: `ADMIN:${admin.role}`,
          metadata: {
            actorId: admin.id,
            actorRole: admin.role,
            action: 'USER_BANNED',
            previousState: user.state,
            newState: updated.state,
            reason: cleanReason,
            timestamp: new Date().toISOString(),
          },
        },
      });

      return {
        status: 'BANNED',
        telegramUserId: telegramUserId.toString(),
        previousState: user.state,
        currentState: updated.state,
        reason: cleanReason,
      };
    });
  }

  /**
   * Atomic Unban User inside Prisma Transaction
   */
  async unbanUser(admin: { id: string; role: string }, rawId: string | bigint, reason: string) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('ACTION_REASON_REQUIRED: Mandatory reason string required for account unban');
    }
    const telegramUserId = typeof rawId === 'bigint' ? rawId : this.parseBigInt(rawId)!;
    const cleanReason = reason.trim();

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { telegramUserId } });
      if (!user) throw new NotFoundException(`USER_NOT_FOUND: User ${telegramUserId.toString()} does not exist`);

      const updated = await tx.user.update({
        where: { telegramUserId },
        data: { state: UserState.ACTIVE_USER },
      });

      await tx.auditEvent.create({
        data: {
          telegramUserId,
          eventType: AuditEventType.ADMIN_ACTION,
          description: `User account unbanned by admin ${admin.id}. Reason: ${cleanReason}`,
          severity: 'INFO',
          source: `ADMIN:${admin.role}`,
          metadata: {
            actorId: admin.id,
            actorRole: admin.role,
            action: 'USER_UNBANNED',
            previousState: user.state,
            newState: updated.state,
            reason: cleanReason,
            timestamp: new Date().toISOString(),
          },
        },
      });

      return {
        status: 'UNBANNED',
        telegramUserId: telegramUserId.toString(),
        previousState: user.state,
        currentState: updated.state,
        reason: cleanReason,
      };
    });
  }

  /**
   * Persistent Admin Note Creation
   */
  async addAdminNote(admin: { id: string; role: string }, rawId: string | bigint, dto: AdminNoteCreateDto) {
    if (!dto.message || !dto.message.trim()) {
      throw new BadRequestException('NOTE_MESSAGE_REQUIRED: Admin note message cannot be empty');
    }
    const telegramUserId = typeof rawId === 'bigint' ? rawId : this.parseBigInt(rawId)!;

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { telegramUserId } });
      if (!user) throw new NotFoundException(`USER_NOT_FOUND: User ${telegramUserId.toString()} does not exist`);

      const note = await tx.adminNote.create({
        data: {
          telegramUserId,
          adminId: admin.id,
          message: dto.message.trim(),
          visibility: dto.visibility || 'INTERNAL',
        },
      });

      await tx.auditEvent.create({
        data: {
          telegramUserId,
          eventType: AuditEventType.ADMIN_ACTION,
          description: `Internal admin note added by ${admin.id}`,
          severity: 'INFO',
          source: `ADMIN:${admin.role}`,
          metadata: {
            actorId: admin.id,
            action: 'ADMIN_NOTE_CREATED',
            noteId: note.id,
            snippet: dto.message.slice(0, 50),
          },
        },
      });

      return {
        ...note,
        telegramUserId: note.telegramUserId.toString(),
      };
    });
  }

  async getAdminNotes(rawId: string | bigint) {
    const telegramUserId = typeof rawId === 'bigint' ? rawId : this.parseBigInt(rawId)!;
    const notes = await this.prisma.adminNote.findMany({
      where: { telegramUserId },
      orderBy: { createdAt: 'desc' },
    });

    return notes.map((n) => ({
      ...n,
      telegramUserId: n.telegramUserId.toString(),
    }));
  }

  /**
   * Comprehensive 360-Degree Chronological User Activity Timeline
   */
  async getUserTimeline(rawId: string | bigint) {
    const telegramUserId = typeof rawId === 'bigint' ? rawId : this.parseBigInt(rawId)!;

    const user = await this.prisma.user.findUnique({ where: { telegramUserId } });
    if (!user) throw new NotFoundException(`USER_NOT_FOUND: User ${telegramUserId.toString()} does not exist`);

    const [
      auditEvents,
      settlementSessions,
      riskEvents,
      adminNotes,
      crystalTxs,
      userMachines,
      gameGrants,
    ] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where: { telegramUserId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.settlementSession.findMany({
        where: { telegramUserId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      this.prisma.riskEvent.findMany({
        where: { entityType: 'USER', entityId: telegramUserId.toString() },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      this.prisma.adminNote.findMany({
        where: { telegramUserId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      this.prisma.crystalTransaction.findMany({
        where: { telegramUserId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      this.prisma.userMachine.findMany({
        where: { telegramUserId },
        orderBy: { purchasedAt: 'desc' },
        take: 20,
      }),
      this.prisma.gameRewardGrant.findMany({
        where: { telegramUserId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const timelineItems: Array<{
      id: string;
      timestamp: Date;
      type: 'AUDIT' | 'SETTLEMENT' | 'RISK_EVENT' | 'ADMIN_NOTE' | 'CRYSTAL_TX' | 'MACHINE_FLEET' | 'REWARD';
      title: string;
      description: string;
      actor: string;
      metadata?: any;
    }> = [];

    // 1. Account creation event
    timelineItems.push({
      id: `created-${user.telegramUserId}`,
      timestamp: user.createdAt,
      type: 'AUDIT',
      title: 'Account Created',
      description: `User account registered via Telegram (${user.telegramUsername ? '@' + user.telegramUsername : user.telegramUserId})`,
      actor: 'SYSTEM',
    });

    // 2. Audit events
    auditEvents.forEach((a) => {
      timelineItems.push({
        id: `audit-${a.id}`,
        timestamp: a.createdAt,
        type: 'AUDIT',
        title: a.eventType,
        description: a.description || `Audit log ${a.eventType}`,
        actor: a.source || 'SYSTEM',
        metadata: a.metadata,
      });
    });

    // 3. Settlement sessions (Deposits & Payouts)
    settlementSessions.forEach((s) => {
      timelineItems.push({
        id: `settlement-${s.id}`,
        timestamp: s.createdAt,
        type: 'SETTLEMENT',
        title: `${s.sessionType} Settlement (${s.status})`,
        description: `Requested ${s.requestedAmount.toString()} ${s.asset} via ${s.mobileMoneyNetwork}`,
        actor: `USER / ${s.provider}`,
        metadata: { referenceCode: s.referenceCode, status: s.status },
      });
    });

    // 4. Risk incidents
    riskEvents.forEach((r) => {
      timelineItems.push({
        id: `risk-${r.id}`,
        timestamp: r.createdAt,
        type: 'RISK_EVENT',
        title: `Risk Incident [${r.severity}]`,
        description: r.notes || `Risk rule ${r.ruleTriggered} triggered`,
        actor: 'RISK_ENGINE',
        metadata: { ruleCode: r.ruleTriggered, scoreImpact: null },
      });
    });

    // 5. Database Admin Notes
    adminNotes.forEach((n) => {
      timelineItems.push({
        id: `note-${n.id}`,
        timestamp: n.createdAt,
        type: 'ADMIN_NOTE',
        title: 'Internal Admin Note',
        description: n.message,
        actor: n.adminId,
      });
    });

    // 6. Crystal Transactions
    crystalTxs.forEach((c) => {
      timelineItems.push({
        id: `crystal-${c.id}`,
        timestamp: c.createdAt,
        type: 'CRYSTAL_TX',
        title: `Crystal Movement (${c.type})`,
        description: `${c.amount > 0 ? '+' : ''}${c.amount} Crystals (Balance after: ${c.balanceAfter})`,
        actor: 'GAME_ENGINE',
        metadata: { txType: c.type, reference: c.reference },
      });
    });

    // 7. Machine Fleet Purchases
    userMachines.forEach((m) => {
      timelineItems.push({
        id: `machine-${m.id}`,
        timestamp: m.purchasedAt,
        type: 'MACHINE_FLEET',
        title: `Mining Machine Deployed (${m.status})`,
        description: `Machine ID ${m.id} active with hash speed ${m.capacityGhs || 'standard'}`,
        actor: 'USER',
      });
    });

    // 8. Game / Reward Grants
    gameGrants.forEach((g) => {
      timelineItems.push({
        id: `reward-${g.id}`,
        timestamp: g.createdAt,
        type: 'REWARD',
        title: `Reward Grant (${g.type})`,
        description: `Issued +${g.amount} ${g.type} grant (Ref: ${g.reference})`,
        actor: 'REWARD_ENGINE',
      });
    });

    // Sort descending by timestamp
    timelineItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return timelineItems;
  }
}
