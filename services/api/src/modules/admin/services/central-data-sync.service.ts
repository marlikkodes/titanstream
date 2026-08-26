import { Injectable } from '@nestjs/common';
import { UserState, AuditEventType, SettlementStatus, SettlementType, RiskEventStatus, SupportStatus } from '@prisma/client';

export interface CentralUserRecord {
  id: string;
  identityId: string;
  telegramUserId: bigint;
  telegramUsername: string | null;
  phoneNumber: string | null;
  phoneVerified: boolean;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  languageCode: string;
  state: UserState;
  isReady: boolean;
  educationScore: number;
  readinessScore: number;
  loginCount: number;
  lastActiveAt: Date;
  lastLoginAt: Date;
  lastActiveIp: string;
  createdAt: Date;
  updatedAt: Date;
  financialAccount: {
    id: string;
    telegramUserId: string;
    balanceUsdt: string;
    lockedBalanceUsdt: string;
    lifetimeDepositedUsdt: string;
    lifetimeWithdrawnUsdt: string;
    status: string;
  };
  crystalAccount: {
    id: string;
    telegramUserId: string;
    balance: number;
  };
  userMachines: {
    id: string;
    machineId: string;
    nickname: string;
    capacityGhs: number;
    status: string;
    purchasedAt: Date;
  }[];
  settlementSessions: {
    id: string;
    referenceCode: string;
    sessionType: SettlementType;
    asset: string;
    requestedAmount: number;
    expectedCryptoAmount: number;
    exchangeRate: number;
    provider: string;
    mobileMoneyNetwork: string;
    status: SettlementStatus;
    destinationAddress?: string;
    createdAt: Date;
  }[];
  adminNotes: {
    id: string;
    telegramUserId: bigint;
    adminId: string;
    message: string;
    visibility: string;
    createdAt: Date;
  }[];
  riskEvents: {
    id: string;
    entityType: string;
    entityId: string;
    severity: string;
    ruleTriggered: string;
    notes: string;
    createdAt: Date;
  }[];
  supportCases: {
    id: string;
    userId: string;
    subject: string;
    status: SupportStatus;
    priority: string;
    createdAt: Date;
  }[];
  auditEvents: {
    id: string;
    telegramUserId: bigint;
    eventType: AuditEventType;
    description: string;
    severity: string;
    source: string;
    metadata: any;
    createdAt: Date;
  }[];
}

@Injectable()
export class CentralDataSyncService {
  // Authoritative Single Source of Truth
  private readonly users: CentralUserRecord[] = [
    {
      id: 'usr_bitris_5387655307',
      identityId: 'id_titan_5387655307',
      telegramUserId: BigInt('5387655307'),
      telegramUsername: 'bitris_titan',
      phoneNumber: '+256701234567',
      phoneVerified: true,
      firstName: 'Bitris',
      lastName: 'Omolo',
      photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      languageCode: 'en',
      state: UserState.ACTIVE_USER,
      isReady: true,
      educationScore: 100,
      readinessScore: 12,
      loginCount: 42,
      lastActiveAt: new Date(Date.now() - 5 * 60 * 1000),
      lastLoginAt: new Date(Date.now() - 30 * 60 * 1000),
      lastActiveIp: '102.218.42.10',
      createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
      financialAccount: {
        id: 'fin_acc_5387655307',
        telegramUserId: '5387655307',
        balanceUsdt: '845.50',
        lockedBalanceUsdt: '0.00',
        lifetimeDepositedUsdt: '1250.00',
        lifetimeWithdrawnUsdt: '450.00',
        status: 'ACTIVE',
      },
      crystalAccount: {
        id: 'crys_acc_5387655307',
        telegramUserId: '5387655307',
        balance: 15200,
      },
      userMachines: [
        { id: 'm_5387_1', machineId: 'quantum_vortex', nickname: 'Titan Apex Core', capacityGhs: 450, status: 'ACTIVE', purchasedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        { id: 'm_5387_2', machineId: 'turbine_loop_x', nickname: 'Turbine Delta', capacityGhs: 180, status: 'ACTIVE', purchasedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) },
        { id: 'm_5387_3', machineId: 'impulse_core', nickname: 'Impulse Unit', capacityGhs: 80, status: 'ACTIVE', purchasedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
        { id: 'm_5387_4', machineId: 'pulse_gen', nickname: 'Starter Pulse', capacityGhs: 15, status: 'ACTIVE', purchasedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000) },
      ],
      settlementSessions: [
        { id: 'sett_5387_1', referenceCode: 'DEP-UGX-8821', sessionType: SettlementType.DEPOSIT, asset: 'USDT', requestedAmount: 500, expectedCryptoAmount: 500, exchangeRate: 1, provider: 'PESAPAL', mobileMoneyNetwork: 'MTN_UG', status: SettlementStatus.COMPLETED, createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000) },
        { id: 'sett_5387_2', referenceCode: 'DEP-CRYPTO-9102', sessionType: SettlementType.DEPOSIT, asset: 'USDT', requestedAmount: 750, expectedCryptoAmount: 750, exchangeRate: 1, provider: 'USDT_TRC20', mobileMoneyNetwork: 'TRC20', status: SettlementStatus.COMPLETED, destinationAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) },
        { id: 'sett_5387_3', referenceCode: 'PAY-TRC-4419', sessionType: SettlementType.PAYOUT, asset: 'USDT', requestedAmount: 450, expectedCryptoAmount: 450, exchangeRate: 1, provider: 'DIRECT_TRC20', mobileMoneyNetwork: 'TRC20', status: SettlementStatus.COMPLETED, destinationAddress: 'TQj8eUq6P...4v9L', createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      ],
      adminNotes: [
        { id: 'note_1', telegramUserId: BigInt('5387655307'), adminId: 'super_admin', message: 'VIP Power Operator. Primary regional validator node in Uganda.', visibility: 'INTERNAL', createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) },
      ],
      riskEvents: [],
      supportCases: [
        { id: 'case_1', userId: '5387655307', subject: 'TRC-20 Payout Confirmation Speed', status: SupportStatus.RESOLVED, priority: 'LOW', createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      ],
      auditEvents: [
        { id: 'aud_1', telegramUserId: BigInt('5387655307'), eventType: AuditEventType.USER_AUTHENTICATED, description: 'Super Admin Operator session authenticated via Telegram WebApp', severity: 'INFO', source: 'TELEGRAM_GATE', metadata: {}, createdAt: new Date(Date.now() - 30 * 60 * 1000) },
      ],
    },
    {
      id: 'usr_amina_8921471029',
      identityId: 'id_titan_8921471029',
      telegramUserId: BigInt('8921471029'),
      telegramUsername: 'amina_nairobi',
      phoneNumber: '+254712987654',
      phoneVerified: true,
      firstName: 'Amina',
      lastName: 'Hassan',
      photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
      languageCode: 'sw',
      state: UserState.ACTIVE_USER,
      isReady: true,
      educationScore: 95,
      readinessScore: 18,
      loginCount: 28,
      lastActiveAt: new Date(Date.now() - 15 * 60 * 1000),
      lastLoginAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      lastActiveIp: '197.237.112.4',
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
      financialAccount: {
        id: 'fin_acc_8921471029',
        telegramUserId: '8921471029',
        balanceUsdt: '192.40',
        lockedBalanceUsdt: '0.00',
        lifetimeDepositedUsdt: '400.00',
        lifetimeWithdrawnUsdt: '220.00',
        status: 'ACTIVE',
      },
      crystalAccount: {
        id: 'crys_acc_8921471029',
        telegramUserId: '8921471029',
        balance: 4800,
      },
      userMachines: [
        { id: 'm_8921_1', machineId: 'turbine_loop_x', nickname: 'Turbine Beta', capacityGhs: 180, status: 'ACTIVE', purchasedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000) },
        { id: 'm_8921_2', machineId: 'impulse_core', nickname: 'Impulse Core Unit', capacityGhs: 80, status: 'ACTIVE', purchasedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) },
        { id: 'm_8921_3', machineId: 'pulse_gen', nickname: 'Pulse Gen Unit', capacityGhs: 15, status: 'ACTIVE', purchasedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      ],
      settlementSessions: [
        { id: 'sett_8921_1', referenceCode: 'DEP-MPESA-3012', sessionType: SettlementType.DEPOSIT, asset: 'USDT', requestedAmount: 400, expectedCryptoAmount: 400, exchangeRate: 1, provider: 'PESAPAL', mobileMoneyNetwork: 'MPESA_KE', status: SettlementStatus.COMPLETED, destinationAddress: '+254712987654', createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000) },
        { id: 'sett_8921_2', referenceCode: 'PAY-MPESA-8841', sessionType: SettlementType.PAYOUT, asset: 'USDT', requestedAmount: 220, expectedCryptoAmount: 220, exchangeRate: 1, provider: 'PESAPAL', mobileMoneyNetwork: 'MPESA_KE', status: SettlementStatus.COMPLETED, destinationAddress: '+254712987654', createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000) },
      ],
      adminNotes: [
        { id: 'note_2', telegramUserId: BigInt('8921471029'), adminId: 'super_admin', message: 'Active WhatsApp merchant validator in Nairobi hub. Consistent M-Pesa flow.', visibility: 'INTERNAL', createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000) },
      ],
      riskEvents: [],
      supportCases: [],
      auditEvents: [
        { id: 'aud_4', telegramUserId: BigInt('8921471029'), eventType: AuditEventType.USER_AUTHENTICATED, description: 'Verified via WhatsApp OTP Challenge on phone +254712987654', severity: 'INFO', source: 'WHATSAPP_GATE', metadata: {}, createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
      ],
    },
    {
      id: 'usr_devon_6719823451',
      identityId: 'id_titan_6719823451',
      telegramUserId: BigInt('6719823451'),
      telegramUsername: 'crypto_farmer_bot99',
      phoneNumber: '+18255551234',
      phoneVerified: false,
      firstName: 'Devon',
      lastName: 'Vance',
      photoUrl: null,
      languageCode: 'en',
      state: UserState.SUSPENDED_USER,
      isReady: false,
      educationScore: 20,
      readinessScore: 85,
      loginCount: 5,
      lastActiveAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      lastLoginAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      lastActiveIp: '197.239.4.12',
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
      financialAccount: {
        id: 'fin_acc_6719823451',
        telegramUserId: '6719823451',
        balanceUsdt: '15.00',
        lockedBalanceUsdt: '15.00',
        lifetimeDepositedUsdt: '10.00',
        lifetimeWithdrawnUsdt: '0.00',
        status: 'FROZEN',
      },
      crystalAccount: {
        id: 'crys_acc_6719823451',
        telegramUserId: '6719823451',
        balance: 200,
      },
      userMachines: [
        { id: 'm_6719_1', machineId: 'pulse_gen', nickname: 'Pulse Starter', capacityGhs: 15, status: 'FROZEN', purchasedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000) },
      ],
      settlementSessions: [
        { id: 'sett_6719_1', referenceCode: 'DEP-USDT-9912', sessionType: SettlementType.DEPOSIT, asset: 'USDT', requestedAmount: 10, expectedCryptoAmount: 10, exchangeRate: 1, provider: 'USDT_TRC20', mobileMoneyNetwork: 'TRC20', status: SettlementStatus.COMPLETED, destinationAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', createdAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000) },
        { id: 'sett_6719_2', referenceCode: 'PAY-HALT-0012', sessionType: SettlementType.PAYOUT, asset: 'USDT', requestedAmount: 150, expectedCryptoAmount: 150, exchangeRate: 1, provider: 'DIRECT_TRC20', mobileMoneyNetwork: 'TRC20', status: SettlementStatus.CANCELLED, destinationAddress: 'TQ8u...suspended', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
      ],
      adminNotes: [
        { id: 'note_3', telegramUserId: BigInt('6719823451'), adminId: 'super_admin', message: 'Account frozen due to circular self-referrals and rapid IP hopping on 197.239.4.12.', visibility: 'INTERNAL', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
      ],
      riskEvents: [
        { id: 'risk_1', entityType: 'USER', entityId: '6719823451', severity: 'HIGH', ruleTriggered: 'CIRCULAR_REFERRAL_CLUSTER', notes: 'Detected 12 accounts created from exact same IP 197.239.4.12 in < 30 minutes.', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
      ],
      supportCases: [
        { id: 'case_2', userId: '6719823451', subject: 'Why is my withdrawal blocked?', status: SupportStatus.OPEN, priority: 'HIGH', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
      ],
      auditEvents: [
        { id: 'aud_5', telegramUserId: BigInt('6719823451'), eventType: AuditEventType.ACCOUNT_SUSPENDED, description: 'User account frozen by Admin. Reason: Suspected Sybil farming ring on IP 197.239.4.12', severity: 'WARNING', source: 'ADMIN:SUPER_ADMIN', metadata: {}, createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
      ],
    },
  ];

  // 1. GET ALL USERS
  getAllUsers(): CentralUserRecord[] {
    return this.users;
  }

  // 2. GET USER BY ID OR TELEGRAM ID
  getUser(idOrTelegramId: string): CentralUserRecord | undefined {
    const clean = idOrTelegramId.trim();
    return this.users.find(
      (u) =>
        u.id === clean ||
        u.telegramUserId.toString() === clean ||
        u.phoneNumber === clean ||
        (u.telegramUsername && u.telegramUsername.toLowerCase() === clean.replace(/^@/, '').toLowerCase()),
    );
  }

  // 3. GET ALL SETTLEMENT SESSIONS ACROSS ALL USERS
  getAllSettlements(): any[] {
    const allSessions: any[] = [];
    for (const u of this.users) {
      for (const s of u.settlementSessions) {
        allSessions.push({
          ...s,
          telegramUserId: u.telegramUserId.toString(),
          userName: `${u.firstName} ${u.lastName || ''}`.trim(),
          userHandle: u.telegramUsername ? `@${u.telegramUsername}` : u.phoneNumber || 'No handle',
          userPhoneNumber: u.phoneNumber,
        });
      }
    }
    return allSessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // 4. GET ALL USER MACHINES ACROSS ALL USERS
  getAllMachines(): any[] {
    const allMachines: any[] = [];
    for (const u of this.users) {
      for (const m of u.userMachines) {
        allMachines.push({
          ...m,
          telegramUserId: u.telegramUserId.toString(),
          ownerName: `${u.firstName} ${u.lastName || ''}`.trim(),
          ownerHandle: u.telegramUsername ? `@${u.telegramUsername}` : u.phoneNumber || 'No handle',
        });
      }
    }
    return allMachines;
  }

  // 5. GET FINANCIAL & TREASURY TOTALS
  getFinancialTotals() {
    let totalUserLiabilities = 0;
    let totalDeposited = 0;
    let totalWithdrawn = 0;
    let totalHashrate = 0;
    let activeNodes = 0;

    for (const u of this.users) {
      totalUserLiabilities += parseFloat(u.financialAccount.balanceUsdt);
      totalDeposited += parseFloat(u.financialAccount.lifetimeDepositedUsdt);
      totalWithdrawn += parseFloat(u.financialAccount.lifetimeWithdrawnUsdt);
      for (const m of u.userMachines) {
        if (m.status === 'ACTIVE') {
          totalHashrate += m.capacityGhs;
          activeNodes++;
        }
      }
    }

    const totalLiquidity = 2500.0;
    const reserveRatio = totalUserLiabilities > 0 ? Math.round((totalLiquidity / totalUserLiabilities) * 100) : 100;
    const rcr = totalUserLiabilities > 0 ? Math.round((totalLiquidity / totalUserLiabilities) * 100) / 100 : 1.0;

    return {
      totalLiquidity,
      totalUserLiabilities: Math.round(totalUserLiabilities * 100) / 100,
      totalDeposited,
      totalWithdrawn,
      netEcosystemContribution: Math.round((totalLiquidity - totalUserLiabilities) * 100) / 100,
      reserveRatio,
      rcr,
      rcrStatus: rcr >= 2.0 ? 'EXPANSION_READY' : rcr >= 1.5 ? 'HEALTHY' : 'STABLE',
      totalHashrate,
      activeNodes,
      totalUsers: this.users.length,
    };
  }

  // 6. MUTATE USER STATE (FREEZE, UNFREEZE, BAN)
  updateUserState(telegramUserId: string, state: UserState): boolean {
    const user = this.users.find((u) => u.telegramUserId.toString() === telegramUserId);
    if (!user) return false;
    user.state = state;
    user.updatedAt = new Date();
    if (state === UserState.SUSPENDED_USER || state === UserState.BANNED_USER) {
      user.financialAccount.status = 'FROZEN';
      user.financialAccount.lockedBalanceUsdt = user.financialAccount.balanceUsdt;
      user.userMachines.forEach((m) => (m.status = 'FROZEN'));
    } else if (state === UserState.ACTIVE_USER) {
      user.financialAccount.status = 'ACTIVE';
      user.financialAccount.lockedBalanceUsdt = '0.00';
      user.userMachines.forEach((m) => (m.status = 'ACTIVE'));
    }
    return true;
  }

  // 7. ADD ADMIN NOTE
  addAdminNote(telegramUserId: string, note: { adminId: string; message: string; visibility?: string }) {
    const user = this.users.find((u) => u.telegramUserId.toString() === telegramUserId);
    if (!user) return null;
    const createdNote = {
      id: `note_${Date.now()}`,
      telegramUserId: user.telegramUserId,
      adminId: note.adminId,
      message: note.message,
      visibility: note.visibility || 'INTERNAL',
      createdAt: new Date(),
    };
    user.adminNotes.unshift(createdNote);
    return createdNote;
  }

  // 8. GET CATALOG ITEMS
  getCatalog() {
    return [
      {
        id: 'cat_starter_pulse',
        tierCode: 'PULSE_GEN',
        name: 'Pulse Gen 1.0',
        description: 'Entry-level low-latency compute unit with guaranteed daily yield.',
        category: 'STANDARD',
        priceUsdt: '15.00',
        capacityGhs: '15.0',
        dailyYieldEstimateUsdt: '0.45',
        displayOrder: 1,
        icon: '⚡',
        status: 'ACTIVE',
        outputs: [{ assetCode: 'USDT', baseYieldRate: '0.0000052', status: 'ENABLED' }],
        _count: { userFleet: 3 },
      },
      {
        id: 'cat_impulse_core',
        tierCode: 'IMPULSE_CORE',
        name: 'Impulse Core Unit',
        description: 'Mid-tier node with enhanced multi-rail throughput.',
        category: 'PERFORMANCE',
        priceUsdt: '50.00',
        capacityGhs: '80.0',
        dailyYieldEstimateUsdt: '1.80',
        displayOrder: 2,
        icon: '🔋',
        status: 'ACTIVE',
        outputs: [{ assetCode: 'USDT', baseYieldRate: '0.0000208', status: 'ENABLED' }],
        _count: { userFleet: 2 },
      },
      {
        id: 'cat_turbine_beta',
        tierCode: 'TURBINE_LOOP_X',
        name: 'Turbine Loop-X',
        description: 'High-yield enterprise engine for dedicated network verification.',
        category: 'ENTERPRISE',
        priceUsdt: '150.00',
        capacityGhs: '180.0',
        dailyYieldEstimateUsdt: '5.50',
        displayOrder: 3,
        icon: '🚀',
        status: 'ACTIVE',
        outputs: [{ assetCode: 'USDT', baseYieldRate: '0.0000636', status: 'ENABLED' }],
        _count: { userFleet: 2 },
      },
      {
        id: 'cat_quantum_array',
        tierCode: 'QUANTUM_ARRAY_9',
        name: 'Quantum Array V9',
        description: 'Flagship cluster computing platform with maximal capacity.',
        category: 'FLAGSHIP',
        priceUsdt: '500.00',
        capacityGhs: '740.0',
        dailyYieldEstimateUsdt: '22.00',
        displayOrder: 4,
        icon: '💠',
        status: 'ACTIVE',
        outputs: [{ assetCode: 'USDT', baseYieldRate: '0.0002546', status: 'ENABLED' }],
        _count: { userFleet: 1 },
      },
    ];
  }

  // 9. GET ALL RISK EVENTS
  getRiskEvents() {
    const allRisk: any[] = [];
    for (const u of this.users) {
      for (const r of u.riskEvents) {
        allRisk.push({
          ...r,
          telegramUserId: u.telegramUserId.toString(),
          userName: `${u.firstName} ${u.lastName || ''}`.trim(),
          userHandle: u.telegramUsername ? `@${u.telegramUsername}` : u.phoneNumber || 'No handle',
        });
      }
    }
    return allRisk;
  }
}
