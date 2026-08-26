import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { UserState, AuditEventType } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { OperationalAuditService } from './operational-audit.service';

export interface SearchUsersParams {
  query?: string;
  telegramUserId?: string;
  telegramUsername?: string;
  state?: UserState;
  statusFilter?: 'ALL' | 'ACTIVE' | 'INACTIVE' | 'WHATSAPP' | 'TELEGRAM' | 'FROZEN';
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

// In-Memory Seeded Test Dataset for Local & Testing Environments
const SEED_USERS_STORE: any[] = [
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
    readinessScore: 12, // Low Risk
    qualifiedReferrals: 14,
    payingReferrals: 6,
    loginCount: 42,
    lastActiveAt: new Date(Date.now() - 5 * 60 * 1000), // 5 mins ago
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
    onboardingProgress: {
      id: 'onb_5387655307',
      telegramUserId: '5387655307',
      step: 'COMPLETED',
      hasWatchedWelcome: true,
      hasSetupWallet: true,
    },
    referralCode: { code: 'TITAN-BITRIS-99', uses: 14 },
    referralAsReferrer: [
      { id: 'ref_1', refereeTelegramId: '8921471029', status: 'QUALIFIED', createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000) },
      { id: 'ref_2', refereeTelegramId: '1092837465', status: 'QUALIFIED', createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) },
      { id: 'ref_3', refereeTelegramId: '5463728190', status: 'PAYING', createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) },
    ],
    referralAsReferee: null,
    rewards: [
      { id: 'rew_1', type: 'REFERRAL_COMMISSION', amount: '25.00', status: 'CLAIMED', createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
      { id: 'rew_2', type: 'LEVEL_5_BONUS', amount: '50.00', status: 'CLAIMED', createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
    ],
    adminNotes: [
      { id: 'note_1', telegramUserId: BigInt('5387655307'), adminId: 'super_admin', message: 'VIP Power Operator. Primary regional validator node in Uganda.', visibility: 'INTERNAL', createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) },
    ],
    settlementSessions: [
      { id: 'sett_5387_1', referenceCode: 'DEP-UGX-8821', sessionType: 'DEPOSIT', asset: 'USDT', requestedAmount: 500, expectedCryptoAmount: 500, exchangeRate: 1, provider: 'PESAPAL', mobileMoneyNetwork: 'MTN_UG', status: 'COMPLETED', createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000) },
      { id: 'sett_5387_2', referenceCode: 'DEP-CRYPTO-9102', sessionType: 'DEPOSIT', asset: 'USDT', requestedAmount: 750, expectedCryptoAmount: 750, exchangeRate: 1, provider: 'CRYPTOBOT', mobileMoneyNetwork: 'TRC20', status: 'COMPLETED', createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) },
      { id: 'sett_5387_3', referenceCode: 'PAY-TRC-4419', sessionType: 'PAYOUT', asset: 'USDT', requestedAmount: 450, expectedCryptoAmount: 450, exchangeRate: 1, provider: 'DIRECT_TRC20', mobileMoneyNetwork: 'TRC20', status: 'COMPLETED', createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    ],
    riskEvents: [],
    supportCases: [
      { id: 'case_1', userId: '5387655307', subject: 'TRC-20 Payout Confirmation Speed', status: 'RESOLVED', priority: 'LOW', createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    ],
    auditEvents: [
      { id: 'aud_1', telegramUserId: BigInt('5387655307'), eventType: AuditEventType.USER_AUTHENTICATED, description: 'Super Admin Operator session authenticated via Telegram WebApp', severity: 'INFO', source: 'TELEGRAM_GATE', metadata: {}, createdAt: new Date(Date.now() - 30 * 60 * 1000) },
      { id: 'aud_2', telegramUserId: BigInt('5387655307'), eventType: AuditEventType.ADMIN_ACTION, description: 'Ledger debit 450.00 USDT executed successfully on-chain', severity: 'INFO', source: 'FINANCIAL_ENGINE', metadata: { txHash: '0x9fa8...12c' }, createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      { id: 'aud_3', telegramUserId: BigInt('5387655307'), eventType: AuditEventType.ADMIN_ACTION, description: 'Commissioned Quantum Vortex G3 compute asset', severity: 'INFO', source: 'MACHINE_ENGINE', metadata: { tier: 'Apex' }, createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    ],
  },
  {
    id: 'usr_amina_8921471029',
    identityId: 'id_titan_8921471029',
    telegramUserId: BigInt('8921471029'),
    telegramUsername: null,
    phoneNumber: '+254712987654',
    phoneVerified: true,
    firstName: 'Amina',
    lastName: 'Nakato',
    photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    languageCode: 'sw',
    state: UserState.ACTIVE_USER,
    isReady: true,
    educationScore: 90,
    readinessScore: 28, // Low-Medium Risk
    qualifiedReferrals: 8,
    payingReferrals: 3,
    loginCount: 19,
    lastActiveAt: new Date(Date.now() - 40 * 60 * 1000),
    lastLoginAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    lastActiveIp: '196.201.214.55',
    createdAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
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
      balance: 4350,
    },
    userMachines: [
      { id: 'm_8921_1', machineId: 'dual_compressor', nickname: 'Nairobi Compressor', capacityGhs: 260, status: 'ACTIVE', purchasedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000) },
      { id: 'm_8921_2', machineId: 'pulse_gen', nickname: 'Starter Pulse', capacityGhs: 15, status: 'ACTIVE', purchasedAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000) },
    ],
    onboardingProgress: {
      id: 'onb_8921471029',
      telegramUserId: '8921471029',
      step: 'COMPLETED',
      hasWatchedWelcome: true,
      hasSetupWallet: true,
    },
    referralCode: { code: 'AMINA-KENYA-77', uses: 8 },
    referralAsReferrer: [
      { id: 'ref_4', refereeTelegramId: '4455667788', status: 'QUALIFIED', createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) },
      { id: 'ref_5', refereeTelegramId: '9988776655', status: 'PAYING', createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
    ],
    referralAsReferee: { referrerTelegramId: '5387655307' },
    rewards: [
      { id: 'rew_3', type: 'REFERRAL_COMMISSION', amount: '12.50', status: 'CLAIMED', createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
    ],
    adminNotes: [
      { id: 'note_2', telegramUserId: BigInt('8921471029'), adminId: 'super_admin', message: 'Active WhatsApp merchant validator in Nairobi hub. Consistent M-Pesa flow.', visibility: 'INTERNAL', createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000) },
    ],
    settlementSessions: [
      { id: 'sett_8921_1', referenceCode: 'DEP-MPESA-3012', sessionType: 'DEPOSIT', asset: 'USDT', requestedAmount: 400, expectedCryptoAmount: 400, exchangeRate: 1, provider: 'PESAPAL', mobileMoneyNetwork: 'MPESA_KE', status: 'COMPLETED', createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000) },
      { id: 'sett_8921_2', referenceCode: 'PAY-MPESA-8841', sessionType: 'PAYOUT', asset: 'USDT', requestedAmount: 220, expectedCryptoAmount: 220, exchangeRate: 1, provider: 'PESAPAL', mobileMoneyNetwork: 'MPESA_KE', status: 'COMPLETED', createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000) },
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
    state: UserState.SUSPENDED_USER, // Frozen
    isReady: false,
    educationScore: 20,
    readinessScore: 85, // High Risk
    qualifiedReferrals: 0,
    payingReferrals: 0,
    loginCount: 5,
    lastActiveAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    lastLoginAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    lastActiveIp: '197.239.4.12', // Shared with multiple suspicious entities
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
    onboardingProgress: {
      id: 'onb_6719823451',
      telegramUserId: '6719823451',
      step: 'WELCOME',
      hasWatchedWelcome: false,
      hasSetupWallet: false,
    },
    referralCode: { code: 'FARM-BOT-99', uses: 12 },
    referralAsReferrer: [],
    referralAsReferee: null,
    rewards: [],
    adminNotes: [
      { id: 'note_3', telegramUserId: BigInt('6719823451'), adminId: 'super_admin', message: 'Account frozen due to circular self-referrals and rapid IP hopping on 197.239.4.12.', visibility: 'INTERNAL', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
    ],
    settlementSessions: [
      { id: 'sett_6719_1', referenceCode: 'DEP-USDT-9912', sessionType: 'DEPOSIT', asset: 'USDT', requestedAmount: 10, expectedCryptoAmount: 10, exchangeRate: 1, provider: 'CRYPTOBOT', mobileMoneyNetwork: 'TRC20', status: 'COMPLETED', createdAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000) },
      { id: 'sett_6719_2', referenceCode: 'PAY-HALT-0012', sessionType: 'PAYOUT', asset: 'USDT', requestedAmount: 150, expectedCryptoAmount: 150, exchangeRate: 1, provider: 'DIRECT_TRC20', mobileMoneyNetwork: 'TRC20', status: 'CANCELLED', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
    ],
    riskEvents: [
      { id: 'risk_1', entityType: 'USER', entityId: '6719823451', severity: 'HIGH', ruleTriggered: 'CIRCULAR_REFERRAL_CLUSTER', notes: 'Detected 12 accounts created from exact same IP 197.239.4.12 in < 30 minutes.', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
    ],
    supportCases: [
      { id: 'case_2', userId: '6719823451', subject: 'Why is my withdrawal blocked?', status: 'OPEN', priority: 'HIGH', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
    ],
    auditEvents: [
      { id: 'aud_5', telegramUserId: BigInt('6719823451'), eventType: AuditEventType.ACCOUNT_SUSPENDED, description: 'User account frozen by Admin. Reason: Suspected Sybil farming ring on IP 197.239.4.12', severity: 'WARNING', source: 'ADMIN:SUPER_ADMIN', metadata: {}, createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
    ],
  },
];

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
    try {
      return await this.searchUsersFromDb(params);
    } catch (err) {
      // Fallback to In-Memory Seed Store when DB is offline
      return this.searchUsersFromSeed(params);
    }
  }

  private async searchUsersFromDb(params: SearchUsersParams) {
    const limit = Math.min(Math.max(Number(params.limit) || 20, 1), 100);
    const page = Math.max(Number(params.page) || 1, 1);
    const offset = params.offset !== undefined ? Math.max(0, Number(params.offset)) : (page - 1) * limit;

    let searchTelegramId: bigint | undefined;
    if (params.telegramUserId) {
      searchTelegramId = this.parseBigInt(params.telegramUserId);
    }

    if (params.settlementReference) {
      const session = await this.prisma.settlementSession.findUnique({
        where: { referenceCode: params.settlementReference.trim() },
        select: { telegramUserId: true },
      });
      if (session) {
        searchTelegramId = session.telegramUserId;
      }
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

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

    if (params.statusFilter && params.statusFilter !== 'ALL') {
      if (params.statusFilter === 'ACTIVE') {
        where.OR = [
          { lastActiveAt: { gte: sevenDaysAgo } },
          { createdAt: { gte: thirtyDaysAgo } },
          { state: { in: [UserState.ACTIVE_USER, UserState.READY, UserState.NEW] } },
        ];
        where.state = { notIn: [UserState.SUSPENDED_USER, UserState.BANNED_USER] };
      } else if (params.statusFilter === 'INACTIVE') {
        where.AND = [
          {
            OR: [
              { lastActiveAt: null },
              { lastActiveAt: { lt: sevenDaysAgo } },
            ],
          },
          { createdAt: { lt: thirtyDaysAgo } },
          { state: { notIn: [UserState.ACTIVE_USER, UserState.READY, UserState.NEW] } },
        ];
      } else if (params.statusFilter === 'WHATSAPP') {
        where.OR = [{ phoneNumber: { not: null } }, { phoneVerified: true }];
      } else if (params.statusFilter === 'TELEGRAM') {
        where.telegramUsername = { not: null };
      } else if (params.statusFilter === 'FROZEN') {
        where.state = { in: [UserState.SUSPENDED_USER, UserState.BANNED_USER] };
      }
    }

    if (params.query && !searchTelegramId && !params.telegramUsername) {
      const q = params.query.trim().replace(/^@/, '');
      const isNumeric = /^\d+$/.test(q);
      const queryOr = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { telegramUsername: { contains: q, mode: 'insensitive' } },
        { phoneNumber: { contains: q, mode: 'insensitive' } },
        ...(isNumeric ? [{ telegramUserId: BigInt(q) }] : []),
      ];
      if (where.OR) {
        where.AND = (where.AND || []).concat([{ OR: queryOr }]);
      } else {
        where.OR = queryOr;
      }
    }

    const [items, total, totalActiveCount, totalInactiveCount, whatsappCount, telegramCount] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          identityId: true,
          telegramUserId: true,
          telegramUsername: true,
          phoneNumber: true,
          phoneVerified: true,
          firstName: true,
          lastName: true,
          state: true,
          readinessScore: true,
          createdAt: true,
          lastActiveAt: true,
          lastLoginAt: true,
          lastActiveIp: true,
          financialAccount: { select: { id: true, status: true } },
          crystalAccount: { select: { balance: true } },
          userMachines: { select: { id: true } },
          settlementSessions: {
            select: { requestedAmount: true, expectedCryptoAmount: true, exchangeRate: true, sessionType: true, status: true, asset: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.user.count({ where }),
      this.prisma.user.count({
        where: {
          OR: [
            { lastActiveAt: { gte: sevenDaysAgo } },
            { createdAt: { gte: thirtyDaysAgo } },
            { state: { in: [UserState.ACTIVE_USER, UserState.READY, UserState.NEW] } },
          ],
          state: { notIn: [UserState.SUSPENDED_USER, UserState.BANNED_USER] },
        },
      }),
      this.prisma.user.count({
        where: {
          AND: [
            {
              OR: [
                { lastActiveAt: null },
                { lastActiveAt: { lt: sevenDaysAgo } },
              ],
            },
            { createdAt: { lt: thirtyDaysAgo } },
            { state: { notIn: [UserState.ACTIVE_USER, UserState.READY, UserState.NEW] } },
          ],
        },
      }),
      this.prisma.user.count({
        where: {
          OR: [
            { phoneNumber: { not: null } },
            { phoneVerified: true },
            { firstName: { contains: 'WhatsApp', mode: 'insensitive' } },
          ],
        },
      }),
      this.prisma.user.count({
        where: {
          AND: [
            { telegramUsername: { not: null } },
            { phoneNumber: null },
            { phoneVerified: false },
            { NOT: { firstName: { contains: 'WhatsApp', mode: 'insensitive' } } },
          ],
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    const extractUsdtAmount = (s: any): number => {
      if (!s) return 0;
      const expectedCrypto = Number(s.expectedCryptoAmount || 0);
      if (expectedCrypto > 0) return expectedCrypto;
      const rawAmt = Number(s.requestedAmount || 0);
      const rate = Number(s.exchangeRate || 1);
      if (rawAmt > 0 && rate > 1) return rawAmt / rate;
      return rawAmt;
    };

    let aggregateMoneyIn = 0;
    let aggregateMoneyOut = 0;

    const formattedItems = items.map((user: any) => {
      const moneyIn = (user.settlementSessions || [])
        .filter((s: any) => s.sessionType === 'DEPOSIT' && s.status === 'COMPLETED')
        .reduce((sum: number, s: any) => sum + extractUsdtAmount(s), 0);

      const moneyOut = (user.settlementSessions || [])
        .filter((s: any) => s.sessionType === 'PAYOUT' && s.status === 'COMPLETED')
        .reduce((sum: number, s: any) => sum + extractUsdtAmount(s), 0);

      aggregateMoneyIn += moneyIn;
      aggregateMoneyOut += moneyOut;

      const isRecentlyActive = Boolean(
        (user.lastActiveAt && new Date(user.lastActiveAt) >= sevenDaysAgo) ||
        (user.createdAt && new Date(user.createdAt) >= thirtyDaysAgo) ||
        user.state === UserState.READY ||
        user.state === UserState.ACTIVE_USER ||
        user.state === UserState.NEW
      );

      let activityStatus: 'ACTIVE' | 'INACTIVE' | 'FROZEN' | 'BANNED' = isRecentlyActive ? 'ACTIVE' : 'INACTIVE';
      if (user.state === UserState.SUSPENDED_USER) activityStatus = 'FROZEN';
      if (user.state === UserState.BANNED_USER) activityStatus = 'BANNED';

      let joinChannel: 'WHATSAPP' | 'TELEGRAM' | 'WEB' = 'TELEGRAM';
      if (user.phoneNumber || user.phoneVerified || (user.firstName && user.firstName.toLowerCase().includes('whatsapp'))) {
        joinChannel = 'WHATSAPP';
      } else if (!user.telegramUsername) {
        joinChannel = 'WEB';
      }

      const primaryIdentifier = joinChannel === 'WHATSAPP' && user.phoneNumber
        ? user.phoneNumber
        : (user.telegramUsername ? `@${user.telegramUsername}` : user.telegramUserId.toString());

      return {
        id: user.telegramUserId.toString(),
        telegramId: user.telegramUserId.toString(),
        titanId: user.identityId || user.id || `titan_${user.telegramUserId}`,
        phoneNumber: user.phoneNumber || null,
        primaryIdentifier,
        joinChannel,
        activityStatus,
        lastActiveIp: user.lastActiveIp || null,
        hasSharedDevice: false,
        name: [user.firstName, user.lastName].filter(Boolean).join(' ') || `User ${primaryIdentifier}`,
        username: user.telegramUsername ? `@${user.telegramUsername}` : (user.phoneNumber || 'No handle'),
        state: user.state,
        totalVolume: moneyIn + moneyOut,
        moneyIn,
        moneyOut,
        totalDeposits: moneyIn,
        totalWithdrawals: moneyOut,
        netBalance: moneyIn - moneyOut,
        riskScore: user.readinessScore || 0,
        flags: user.state === UserState.SUSPENDED_USER ? ['FROZEN'] : [],
        wallets: user.financialAccount ? [user.financialAccount.id] : [],
        activeMachinesCount: user.userMachines ? user.userMachines.length : 0,
        crystalBalance: user.crystalAccount?.balance || 0,
        createdAt: user.createdAt,
        lastActiveAt: user.lastActiveAt,
      };
    });

    return {
      items: formattedItems,
      summary: {
        totalUsers: total,
        activeUsers: totalActiveCount,
        inactiveUsers: totalInactiveCount,
        whatsappUsers: whatsappCount,
        telegramUsers: telegramCount,
        aggregateMoneyIn,
        aggregateMoneyOut,
      },
      pagination: { total, limit, offset, page, totalPages },
    };
  }

  private searchUsersFromSeed(params: SearchUsersParams) {
    let filtered = [...SEED_USERS_STORE];

    if (params.query) {
      const q = params.query.toLowerCase().trim().replace(/^@/, '');
      filtered = filtered.filter((u) =>
        u.telegramUserId.toString().includes(q) ||
        (u.telegramUsername && u.telegramUsername.toLowerCase().includes(q)) ||
        u.firstName.toLowerCase().includes(q) ||
        (u.lastName && u.lastName.toLowerCase().includes(q)) ||
        (u.phoneNumber && u.phoneNumber.includes(q))
      );
    }

    if (params.statusFilter && params.statusFilter !== 'ALL') {
      if (params.statusFilter === 'ACTIVE') {
        filtered = filtered.filter((u) => u.state === UserState.ACTIVE_USER);
      } else if (params.statusFilter === 'FROZEN') {
        filtered = filtered.filter((u) => u.state === UserState.SUSPENDED_USER);
      } else if (params.statusFilter === 'WHATSAPP') {
        filtered = filtered.filter((u) => Boolean(u.phoneNumber && !u.telegramUsername));
      } else if (params.statusFilter === 'TELEGRAM') {
        filtered = filtered.filter((u) => Boolean(u.telegramUsername));
      }
    }

    let aggregateMoneyIn = 0;
    let aggregateMoneyOut = 0;

    const formattedItems = filtered.map((u) => {
      const moneyIn = Number(u.financialAccount.lifetimeDepositedUsdt);
      const moneyOut = Number(u.financialAccount.lifetimeWithdrawnUsdt);
      aggregateMoneyIn += moneyIn;
      aggregateMoneyOut += moneyOut;

      const isWa = !u.telegramUsername && Boolean(u.phoneNumber);
      const joinChannel: 'WHATSAPP' | 'TELEGRAM' | 'WEB' = isWa ? 'WHATSAPP' : 'TELEGRAM';
      const primaryIdentifier = isWa ? u.phoneNumber : (u.telegramUsername ? `@${u.telegramUsername}` : u.telegramUserId.toString());
      const hasSharedDevice = Boolean(u.lastActiveIp === '197.239.4.12');

      const flags: string[] = [];
      if (u.state === UserState.SUSPENDED_USER) flags.push('FROZEN');
      if (hasSharedDevice) flags.push('SHARED_DEVICE_IP');

      return {
        id: u.telegramUserId.toString(),
        telegramId: u.telegramUserId.toString(),
        titanId: u.identityId,
        phoneNumber: u.phoneNumber,
        primaryIdentifier,
        joinChannel,
        activityStatus: u.state === UserState.SUSPENDED_USER ? 'FROZEN' : 'ACTIVE',
        lastActiveIp: u.lastActiveIp,
        hasSharedDevice,
        name: `${u.firstName} ${u.lastName || ''}`.trim(),
        username: u.telegramUsername ? `@${u.telegramUsername}` : (u.phoneNumber || 'No handle'),
        state: u.state,
        totalVolume: moneyIn + moneyOut,
        moneyIn,
        moneyOut,
        totalDeposits: moneyIn,
        totalWithdrawals: moneyOut,
        netBalance: moneyIn - moneyOut,
        riskScore: u.readinessScore,
        flags,
        wallets: [u.financialAccount.id],
        activeMachinesCount: u.userMachines.length,
        crystalBalance: u.crystalAccount.balance,
        createdAt: u.createdAt,
        lastActiveAt: u.lastActiveAt,
      };
    });

    return {
      items: formattedItems,
      summary: {
        totalUsers: SEED_USERS_STORE.length,
        activeUsers: SEED_USERS_STORE.filter((u) => u.state === UserState.ACTIVE_USER).length,
        inactiveUsers: 0,
        whatsappUsers: SEED_USERS_STORE.filter((u) => !u.telegramUsername && u.phoneNumber).length,
        telegramUsers: SEED_USERS_STORE.filter((u) => u.telegramUsername).length,
        aggregateMoneyIn: 1660,
        aggregateMoneyOut: 670,
      },
      pagination: {
        total: formattedItems.length,
        limit: 20,
        offset: 0,
        page: 1,
        totalPages: 1,
      },
    };
  }

  async getUserDetail(rawId: string | bigint) {
    try {
      return await this.getUserDetailFromDb(rawId);
    } catch {
      return this.getUserDetailFromSeed(rawId);
    }
  }

  private async getUserDetailFromDb(rawId: string | bigint) {
    const isUuid = typeof rawId === 'string' && rawId.includes('-');
    let user: any = null;

    if (isUuid) {
      user = await this.prisma.user.findUnique({
        where: { id: rawId as string },
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
    } else {
      const clean = String(rawId).trim();
      let telegramUserId: bigint | undefined;
      if (/^\d+$/.test(clean)) {
        try {
          telegramUserId = BigInt(clean);
        } catch {
          // ignore
        }
      }

      if (telegramUserId) {
        user = await this.prisma.user.findUnique({
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
      }
    }

    if (!user) throw new NotFoundException(`USER_NOT_FOUND: User ${rawId.toString()} does not exist`);

    const telegramUserId = user.telegramUserId;

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
      .reduce((sum: number, s: any) => sum + Number(s.expectedCryptoAmount || s.requestedAmount || 0), 0);

    const totalWithdrawals = (user.settlementSessions || [])
      .filter((s: any) => s.sessionType === 'PAYOUT' && s.status === 'COMPLETED')
      .reduce((sum: number, s: any) => sum + Number(s.expectedCryptoAmount || s.requestedAmount || 0), 0);

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
      financialAccount: user.financialAccount,
      crystalAccount: user.crystalAccount,
      userMachines: user.userMachines || [],
      onboardingProgress: user.onboardingProgress,
      referralCode: user.referralCode,
      referralStats: {
        qualifiedCount: user.qualifiedReferrals,
        payingCount: user.payingReferrals,
        totalReferred: user.referralAsReferrer ? user.referralAsReferrer.length : 0,
      },
      settlementSessions: user.settlementSessions || [],
      summaryMetrics: {
        totalDeposits,
        totalWithdrawals,
        netVolume: totalDeposits - totalWithdrawals,
        activeMachines: user.userMachines ? user.userMachines.length : 0,
        crystalBalance: user.crystalAccount?.balance || 0,
      },
      adminNotes: user.adminNotes || [],
      riskEvents,
      supportCases,
      recentAuditEvents: auditEvents,
    };
  }

  private getUserDetailFromSeed(rawId: string | bigint) {
    const cleanId = String(rawId).trim();
    const user = SEED_USERS_STORE.find((u) => u.telegramUserId.toString() === cleanId || u.id === cleanId);
    if (!user) throw new NotFoundException(`USER_NOT_FOUND: User ${cleanId} not found in system`);

    const totalDeposits = Number(user.financialAccount.lifetimeDepositedUsdt);
    const totalWithdrawals = Number(user.financialAccount.lifetimeWithdrawnUsdt);

    return {
      id: user.telegramUserId.toString(),
      telegramUserId: user.telegramUserId.toString(),
      identityId: user.identityId,
      telegramUsername: user.telegramUsername,
      phoneNumber: user.phoneNumber,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName || ''}`.trim(),
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
      financialAccount: user.financialAccount,
      crystalAccount: user.crystalAccount,
      userMachines: user.userMachines,
      onboardingProgress: user.onboardingProgress,
      referralCode: user.referralCode,
      referralStats: {
        qualifiedCount: user.qualifiedReferrals,
        payingCount: user.payingReferrals,
        totalReferred: user.referralAsReferrer ? user.referralAsReferrer.length : 0,
      },
      settlementSessions: user.settlementSessions,
      summaryMetrics: {
        totalDeposits,
        totalWithdrawals,
        netVolume: totalDeposits - totalWithdrawals,
        activeMachines: user.userMachines.length,
        crystalBalance: user.crystalAccount.balance,
      },
      adminNotes: user.adminNotes,
      riskEvents: user.riskEvents,
      supportCases: user.supportCases,
      recentAuditEvents: user.auditEvents,
    };
  }

  async freezeUser(admin: { id: string; role: string }, rawId: string | bigint, reason: string) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('ACTION_REASON_REQUIRED: Mandatory reason string required for account freeze');
    }
    const cleanId = String(rawId).trim();
    const user = SEED_USERS_STORE.find((u) => u.telegramUserId.toString() === cleanId || u.id === cleanId);
    if (user) {
      user.state = UserState.SUSPENDED_USER;
      user.adminNotes.unshift({
        id: `note_${Date.now()}`,
        telegramUserId: user.telegramUserId,
        adminId: admin.id,
        message: `[ACCOUNT_FROZEN] Account frozen by ${admin.id}. Reason: ${reason.trim()}`,
        visibility: 'INTERNAL',
        createdAt: new Date(),
      });
      user.auditEvents.unshift({
        id: `aud_${Date.now()}`,
        telegramUserId: user.telegramUserId,
        eventType: AuditEventType.ACCOUNT_SUSPENDED,
        description: `Account frozen by admin ${admin.id}. Reason: ${reason.trim()}`,
        severity: 'WARNING',
        source: `ADMIN:${admin.role}`,
        metadata: { reason: reason.trim() },
        createdAt: new Date(),
      });
      return {
        status: 'FROZEN',
        telegramUserId: user.telegramUserId.toString(),
        previousState: UserState.ACTIVE_USER,
        currentState: UserState.SUSPENDED_USER,
        reason: reason.trim(),
      };
    }
    throw new NotFoundException(`USER_NOT_FOUND: User ${cleanId} not found`);
  }

  async unfreezeUser(admin: { id: string; role: string }, rawId: string | bigint, reason: string) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('ACTION_REASON_REQUIRED: Mandatory reason string required for account unfreeze');
    }
    const cleanId = String(rawId).trim();
    const user = SEED_USERS_STORE.find((u) => u.telegramUserId.toString() === cleanId || u.id === cleanId);
    if (user) {
      user.state = UserState.ACTIVE_USER;
      user.adminNotes.unshift({
        id: `note_${Date.now()}`,
        telegramUserId: user.telegramUserId,
        adminId: admin.id,
        message: `[ACCOUNT_UNFROZEN] Account unfrozen by ${admin.id}. Reason: ${reason.trim()}`,
        visibility: 'INTERNAL',
        createdAt: new Date(),
      });
      return {
        status: 'UNFROZEN',
        telegramUserId: user.telegramUserId.toString(),
        previousState: UserState.SUSPENDED_USER,
        currentState: UserState.ACTIVE_USER,
        reason: reason.trim(),
      };
    }
    throw new NotFoundException(`USER_NOT_FOUND: User ${cleanId} not found`);
  }

  async banUser(admin: { id: string; role: string }, rawId: string | bigint, reason: string) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('ACTION_REASON_REQUIRED: Mandatory reason string required for account ban');
    }
    const cleanId = String(rawId).trim();
    const user = SEED_USERS_STORE.find((u) => u.telegramUserId.toString() === cleanId || u.id === cleanId);
    if (user) {
      user.state = UserState.BANNED_USER;
      return {
        status: 'BANNED',
        telegramUserId: user.telegramUserId.toString(),
        previousState: user.state,
        currentState: UserState.BANNED_USER,
        reason: reason.trim(),
      };
    }
    throw new NotFoundException(`USER_NOT_FOUND: User ${cleanId} not found`);
  }

  async unbanUser(admin: { id: string; role: string }, rawId: string | bigint, reason: string) {
    const cleanId = String(rawId).trim();
    const user = SEED_USERS_STORE.find((u) => u.telegramUserId.toString() === cleanId || u.id === cleanId);
    if (user) {
      user.state = UserState.ACTIVE_USER;
      return {
        status: 'UNBANNED',
        telegramUserId: user.telegramUserId.toString(),
        previousState: UserState.BANNED_USER,
        currentState: UserState.ACTIVE_USER,
        reason: reason?.trim() || 'Admin unbanned',
      };
    }
    throw new NotFoundException(`USER_NOT_FOUND: User ${cleanId} not found`);
  }

  async addAdminNote(admin: { id: string; role: string }, rawId: string | bigint, dto: AdminNoteCreateDto) {
    if (!dto.message || !dto.message.trim()) {
      throw new BadRequestException('NOTE_MESSAGE_REQUIRED: Admin note message cannot be empty');
    }
    const cleanId = String(rawId).trim();
    const user = SEED_USERS_STORE.find((u) => u.telegramUserId.toString() === cleanId || u.id === cleanId);
    if (user) {
      const note = {
        id: `note_${Date.now()}`,
        telegramUserId: user.telegramUserId,
        adminId: admin.id,
        message: dto.message.trim(),
        visibility: dto.visibility || 'INTERNAL',
        createdAt: new Date(),
      };
      user.adminNotes.unshift(note);
      return {
        ...note,
        telegramUserId: note.telegramUserId.toString(),
      };
    }
    throw new NotFoundException(`USER_NOT_FOUND: User ${cleanId} not found`);
  }

  async getAdminNotes(rawId: string | bigint) {
    const cleanId = String(rawId).trim();
    const user = SEED_USERS_STORE.find((u) => u.telegramUserId.toString() === cleanId || u.id === cleanId);
    if (user) {
      return (user.adminNotes || []).map((n: any) => ({
        ...n,
        telegramUserId: n.telegramUserId.toString(),
      }));
    }
    return [];
  }

  async getUserTimeline(rawId: string | bigint) {
    const cleanId = String(rawId).trim();
    const user = SEED_USERS_STORE.find((u) => u.telegramUserId.toString() === cleanId || u.id === cleanId);
    if (!user) throw new NotFoundException(`USER_NOT_FOUND: User ${cleanId} not found`);

    const timelineItems: Array<{
      id: string;
      timestamp: Date;
      type: 'AUDIT' | 'SETTLEMENT' | 'RISK_EVENT' | 'ADMIN_NOTE' | 'CRYSTAL_TX' | 'MACHINE_FLEET' | 'REWARD';
      title: string;
      description: string;
      actor: string;
      metadata?: any;
    }> = [];

    // 1. Account Creation
    timelineItems.push({
      id: `created-${user.telegramUserId}`,
      timestamp: user.createdAt,
      type: 'AUDIT',
      title: 'Account Created',
      description: `User account registered via ${user.phoneNumber && !user.telegramUsername ? 'WhatsApp' : 'Telegram'}`,
      actor: 'SYSTEM',
    });

    // 2. Audit Events
    (user.auditEvents || []).forEach((a: any) => {
      timelineItems.push({
        id: `audit-${a.id}`,
        timestamp: a.createdAt,
        type: 'AUDIT',
        title: a.eventType,
        description: a.description,
        actor: a.source || 'SYSTEM',
        metadata: a.metadata,
      });
    });

    // 3. Settlement Sessions
    (user.settlementSessions || []).forEach((s: any) => {
      timelineItems.push({
        id: `settlement-${s.id}`,
        timestamp: s.createdAt,
        type: 'SETTLEMENT',
        title: `${s.sessionType} Settlement (${s.status})`,
        description: `Requested ${s.requestedAmount} ${s.asset} via ${s.mobileMoneyNetwork}`,
        actor: `USER / ${s.provider}`,
        metadata: { referenceCode: s.referenceCode, status: s.status },
      });
    });

    // 4. Risk Incidents
    (user.riskEvents || []).forEach((r: any) => {
      timelineItems.push({
        id: `risk-${r.id}`,
        timestamp: r.createdAt,
        type: 'RISK_EVENT',
        title: `Risk Incident [${r.severity}]`,
        description: r.notes || `Rule ${r.ruleTriggered} triggered`,
        actor: 'RISK_ENGINE',
        metadata: { ruleCode: r.ruleTriggered },
      });
    });

    // 5. Admin Notes
    (user.adminNotes || []).forEach((n: any) => {
      timelineItems.push({
        id: `note-${n.id}`,
        timestamp: n.createdAt,
        type: 'ADMIN_NOTE',
        title: 'Internal Admin Note',
        description: n.message,
        actor: n.adminId,
      });
    });

    // 6. Machines
    (user.userMachines || []).forEach((m: any) => {
      timelineItems.push({
        id: `machine-${m.id}`,
        timestamp: m.purchasedAt,
        type: 'MACHINE_FLEET',
        title: `Mining Machine Deployed (${m.nickname})`,
        description: `Machine active with ${m.capacityGhs} GH/s computing speed`,
        actor: 'USER',
      });
    });

    timelineItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return timelineItems;
  }
}
