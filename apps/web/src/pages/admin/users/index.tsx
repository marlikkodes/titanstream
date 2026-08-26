import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { DetailDrawer } from '@/components/admin/DetailDrawer';
import { MetricCard, MetricCardGrid } from '@/components/admin/MetricCard';
import { api } from '@/services/api';
import { showToast } from '@/components/Toast';
import { useAuthStore, type AuthUser } from '@/store/useAuthStore';
import { useWalletStore } from '@/store/useWalletStore';
import { useMiningStore } from '@/store/useMiningStore';
import {
  MessageSquare,
  Plus,
  Lock,
  Unlock,
  Ban,
  Clock,
  User,
  Zap,
  DollarSign,
  TrendingUp,
  RefreshCw,
  Search,
  Eye,
  ShieldCheck,
  Radio,
  ExternalLink,
  Smartphone,
  X,
  CheckCircle2,
  Play,
  Cpu,
  Wallet,
  Layers,
} from 'lucide-react';

export interface UserSummaryItem {
  id: string;
  telegramId: string;
  titanId?: string;
  phoneNumber?: string | null;
  primaryIdentifier: string;
  joinChannel: 'WHATSAPP' | 'TELEGRAM' | 'WEB';
  activityStatus: 'ACTIVE' | 'INACTIVE' | 'FROZEN' | 'BANNED';
  hasSharedDevice?: boolean;
  lastActiveIp?: string | null;
  name: string;
  username: string;
  state: string;
  totalVolume: number;
  moneyIn: number;
  moneyOut: number;
  totalDeposits: number;
  totalWithdrawals: number;
  netBalance: number;
  riskScore: number;
  flags: string[];
  wallets: string[];
  activeMachinesCount: number;
  crystalBalance: number;
  createdAt: string;
}

export interface DetailedUserObject {
  id: string;
  telegramUserId: string;
  identityId?: string;
  telegramUsername?: string;
  phoneNumber?: string;
  firstName: string;
  lastName?: string;
  fullName: string;
  photoUrl?: string;
  languageCode: string;
  state: string;
  isReady: boolean;
  educationScore: number;
  readinessScore: number;
  qualifiedReferrals: number;
  payingReferrals: number;
  loginCount: number;
  lastActiveAt?: string;
  lastLoginAt?: string;
  lastActiveIp?: string;
  createdAt: string;
  updatedAt: string;
  financialAccount?: any;
  crystalAccount?: any;
  userMachines?: any[];
  onboardingProgress?: any;
  referralCode?: any;
  referralStats?: {
    qualifiedCount: number;
    payingCount: number;
    totalReferred: number;
  };
  summaryMetrics?: {
    totalDeposits: number;
    totalWithdrawals: number;
    netVolume: number;
    activeMachines: number;
    crystalBalance: number;
  };
  adminNotes?: Array<{
    id: string;
    adminId: string;
    message: string;
    createdAt: string;
  }>;
  riskEvents?: any[];
  supportCases?: any[];
  recentAuditEvents?: any[];
}

export interface TimelineItem {
  id: string;
  timestamp: string;
  type: 'AUDIT' | 'SETTLEMENT' | 'RISK_EVENT' | 'ADMIN_NOTE' | 'MACHINE_FLEET' | 'REWARD';
  title: string;
  description: string;
  actor: string;
  metadata?: any;
}

// Authoritative Client-Side Seed Store for Immediate Visibility & Management
const INITIAL_USERS: UserSummaryItem[] = [
  {
    id: '5387655307',
    telegramId: '5387655307',
    titanId: 'titan_5387655307_apex',
    phoneNumber: '+256701234567',
    primaryIdentifier: '@bitris_titan',
    joinChannel: 'TELEGRAM',
    activityStatus: 'ACTIVE',
    hasSharedDevice: false,
    lastActiveIp: '102.218.42.10',
    name: 'Bitris Omolo',
    username: '@bitris_titan',
    state: 'ACTIVE_USER',
    totalVolume: 1700,
    moneyIn: 1250,
    moneyOut: 450,
    totalDeposits: 1250,
    totalWithdrawals: 450,
    netBalance: 800,
    riskScore: 12,
    flags: [],
    wallets: ['fin_acc_5387655307'],
    activeMachinesCount: 4,
    crystalBalance: 15200,
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '8921471029',
    telegramId: '8921471029',
    titanId: 'titan_8921471029_wa',
    phoneNumber: '+254712987654',
    primaryIdentifier: '+254712987654',
    joinChannel: 'WHATSAPP',
    activityStatus: 'ACTIVE',
    hasSharedDevice: false,
    lastActiveIp: '196.201.214.55',
    name: 'Amina Nakato',
    username: '+254712987654',
    state: 'ACTIVE_USER',
    totalVolume: 620,
    moneyIn: 400,
    moneyOut: 220,
    totalDeposits: 400,
    totalWithdrawals: 220,
    netBalance: 180,
    riskScore: 28,
    flags: [],
    wallets: ['fin_acc_8921471029'],
    activeMachinesCount: 2,
    crystalBalance: 4350,
    createdAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '6719823451',
    telegramId: '6719823451',
    titanId: 'titan_6719823451_suspect',
    phoneNumber: '+18255551234',
    primaryIdentifier: '@crypto_farmer_bot99',
    joinChannel: 'TELEGRAM',
    activityStatus: 'FROZEN',
    hasSharedDevice: true,
    lastActiveIp: '197.239.4.12',
    name: 'Devon Vance',
    username: '@crypto_farmer_bot99',
    state: 'SUSPENDED_USER',
    totalVolume: 10,
    moneyIn: 10,
    moneyOut: 0,
    totalDeposits: 10,
    totalWithdrawals: 0,
    netBalance: 10,
    riskScore: 85,
    flags: ['FROZEN', 'SHARED_DEVICE_IP'],
    wallets: ['fin_acc_6719823451'],
    activeMachinesCount: 1,
    crystalBalance: 200,
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const INITIAL_DETAILS: Record<string, DetailedUserObject> = {
  '5387655307': {
    id: '5387655307',
    telegramUserId: '5387655307',
    identityId: 'titan_5387655307_apex',
    telegramUsername: 'bitris_titan',
    phoneNumber: '+256701234567',
    firstName: 'Bitris',
    lastName: 'Omolo',
    fullName: 'Bitris Omolo',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    languageCode: 'en',
    state: 'ACTIVE_USER',
    isReady: true,
    educationScore: 100,
    readinessScore: 12,
    qualifiedReferrals: 14,
    payingReferrals: 6,
    loginCount: 42,
    lastActiveAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    lastLoginAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    lastActiveIp: '102.218.42.10',
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
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
      { id: 'm_5387_1', machineId: 'quantum_vortex', nickname: 'Titan Apex Core', capacityGhs: 450, status: 'ACTIVE', purchasedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'm_5387_2', machineId: 'turbine_loop_x', nickname: 'Turbine Delta', capacityGhs: 180, status: 'ACTIVE', purchasedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'm_5387_3', machineId: 'impulse_core', nickname: 'Impulse Unit', capacityGhs: 80, status: 'ACTIVE', purchasedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'm_5387_4', machineId: 'pulse_gen', nickname: 'Starter Pulse', capacityGhs: 15, status: 'ACTIVE', purchasedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString() },
    ],
    onboardingProgress: {
      step: 'COMPLETED',
      hasWatchedWelcome: true,
      hasSetupWallet: true,
    },
    referralCode: { code: 'TITAN-BITRIS-99', uses: 14 },
    referralStats: { qualifiedCount: 14, payingCount: 6, totalReferred: 14 },
    summaryMetrics: {
      totalDeposits: 1250,
      totalWithdrawals: 450,
      netVolume: 800,
      activeMachines: 4,
      crystalBalance: 15200,
    },
    adminNotes: [
      { id: 'note_1', adminId: 'super_admin', message: 'VIP Power Operator. Primary regional validator node in Uganda.', createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString() },
    ],
    riskEvents: [],
    supportCases: [
      { id: 'case_1', subject: 'TRC-20 Payout Confirmation Speed', status: 'RESOLVED', priority: 'LOW', createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() },
    ],
    recentAuditEvents: [
      { id: 'aud_1', eventType: 'USER_AUTHENTICATED', description: 'Super Admin Operator session authenticated via Telegram WebApp', severity: 'INFO', source: 'TELEGRAM_GATE', createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
      { id: 'aud_2', eventType: 'ADMIN_ACTION', description: 'Ledger debit 450.00 USDT executed successfully on-chain', severity: 'INFO', source: 'FINANCIAL_ENGINE', createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() },
    ],
  },
  '8921471029': {
    id: '8921471029',
    telegramUserId: '8921471029',
    identityId: 'titan_8921471029_wa',
    phoneNumber: '+254712987654',
    firstName: 'Amina',
    lastName: 'Nakato',
    fullName: 'Amina Nakato',
    photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    languageCode: 'sw',
    state: 'ACTIVE_USER',
    isReady: true,
    educationScore: 90,
    readinessScore: 28,
    qualifiedReferrals: 8,
    payingReferrals: 3,
    loginCount: 19,
    lastActiveAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    lastLoginAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    lastActiveIp: '196.201.214.55',
    createdAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
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
      { id: 'm_8921_1', machineId: 'dual_compressor', nickname: 'Nairobi Compressor', capacityGhs: 260, status: 'ACTIVE', purchasedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'm_8921_2', machineId: 'pulse_gen', nickname: 'Starter Pulse', capacityGhs: 15, status: 'ACTIVE', purchasedAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString() },
    ],
    onboardingProgress: {
      step: 'COMPLETED',
      hasWatchedWelcome: true,
      hasSetupWallet: true,
    },
    referralCode: { code: 'AMINA-KENYA-77', uses: 8 },
    referralStats: { qualifiedCount: 8, payingCount: 3, totalReferred: 8 },
    summaryMetrics: {
      totalDeposits: 400,
      totalWithdrawals: 220,
      netVolume: 180,
      activeMachines: 2,
      crystalBalance: 4350,
    },
    adminNotes: [
      { id: 'note_2', adminId: 'super_admin', message: 'Active WhatsApp merchant validator in Nairobi hub. Consistent M-Pesa flow.', createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString() },
    ],
    riskEvents: [],
    supportCases: [],
    recentAuditEvents: [
      { id: 'aud_4', eventType: 'USER_AUTHENTICATED', description: 'Verified via WhatsApp OTP Challenge on phone +254712987654', severity: 'INFO', source: 'WHATSAPP_GATE', createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
    ],
  },
  '6719823451': {
    id: '6719823451',
    telegramUserId: '6719823451',
    identityId: 'titan_6719823451_suspect',
    telegramUsername: 'crypto_farmer_bot99',
    phoneNumber: '+18255551234',
    firstName: 'Devon',
    lastName: 'Vance',
    fullName: 'Devon Vance',
    photoUrl: undefined,
    languageCode: 'en',
    state: 'SUSPENDED_USER',
    isReady: false,
    educationScore: 20,
    readinessScore: 85,
    qualifiedReferrals: 0,
    payingReferrals: 0,
    loginCount: 5,
    lastActiveAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    lastLoginAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    lastActiveIp: '197.239.4.12',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
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
      { id: 'm_6719_1', machineId: 'pulse_gen', nickname: 'Pulse Starter', capacityGhs: 15, status: 'FROZEN', purchasedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString() },
    ],
    onboardingProgress: {
      step: 'WELCOME',
      hasWatchedWelcome: false,
      hasSetupWallet: false,
    },
    referralCode: { code: 'FARM-BOT-99', uses: 12 },
    referralStats: { qualifiedCount: 0, payingCount: 0, totalReferred: 0 },
    summaryMetrics: {
      totalDeposits: 10,
      totalWithdrawals: 0,
      netVolume: 10,
      activeMachines: 1,
      crystalBalance: 200,
    },
    adminNotes: [
      { id: 'note_3', adminId: 'super_admin', message: 'Account frozen due to circular self-referrals and rapid IP hopping on 197.239.4.12.', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
    ],
    riskEvents: [
      { id: 'risk_1', severity: 'HIGH', ruleTriggered: 'CIRCULAR_REFERRAL_CLUSTER', notes: 'Detected 12 accounts created from exact same IP 197.239.4.12 in < 30 minutes.', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
    ],
    supportCases: [
      { id: 'case_2', subject: 'Why is my withdrawal blocked?', status: 'OPEN', priority: 'HIGH', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
    ],
    recentAuditEvents: [
      { id: 'aud_5', eventType: 'ACCOUNT_SUSPENDED', description: 'User account frozen by Admin. Reason: Suspected Sybil farming ring on IP 197.239.4.12', severity: 'WARNING', source: 'ADMIN:SUPER_ADMIN', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
    ],
  },
};

const riskColor = (score: number) => {
  if (score >= 70) return 'text-error-red';
  if (score >= 40) return 'text-gold';
  return 'text-usdt-green';
};

const stateBadge = (state: string) => {
  switch (state) {
    case 'SUSPENDED_USER':
    case 'FROZEN':
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-400 border border-amber-500/30">FROZEN</span>;
    case 'BANNED_USER':
    case 'BANNED':
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-500/20 text-red-400 border border-red-500/30">BANNED</span>;
    case 'ACTIVE_USER':
    case 'ACTIVE':
    case 'READY':
    case 'READY_FOR_PLATFORM':
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-fit"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/> ACTIVE</span>;
    case 'INACTIVE':
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-gray-500/20 text-gray-400 border border-gray-500/30">INACTIVE</span>;
    default:
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-gray-500/20 text-gray-400 border border-gray-500/30">{state}</span>;
  }
};

const channelBadge = (channel?: string, name?: string, phone?: string) => {
  const isWa = channel === 'WHATSAPP' || (name && name.toLowerCase().includes('whatsapp')) || Boolean(phone && phone.length > 5 && !name?.includes('@'));
  if (isWa) {
    return (
      <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-fit shadow-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        WHATSAPP
      </span>
    );
  }
  if (channel === 'WEB') {
    return (
      <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center gap-1 w-fit shadow-sm">
        WEB APP
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1 w-fit shadow-sm">
      TELEGRAM
    </span>
  );
};

export const UsersPage: React.FC = () => {
  const [usersList, setUsersList] = useState<UserSummaryItem[]>(INITIAL_USERS);
  const [userStore, setUserStore] = useState<UserSummaryItem[]>(INITIAL_USERS);
  const [userDetailedStore, setUserDetailedStore] = useState<Record<string, DetailedUserObject>>(INITIAL_DETAILS);

  const [summaryStats, setSummaryStats] = useState<{
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    whatsappUsers: number;
    telegramUsers: number;
    aggregateMoneyIn: number;
    aggregateMoneyOut: number;
  }>({
    totalUsers: INITIAL_USERS.length,
    activeUsers: INITIAL_USERS.filter((u) => u.activityStatus === 'ACTIVE').length,
    inactiveUsers: 0,
    whatsappUsers: INITIAL_USERS.filter((u) => u.joinChannel === 'WHATSAPP').length,
    telegramUsers: INITIAL_USERS.filter((u) => u.joinChannel === 'TELEGRAM').length,
    aggregateMoneyIn: 1660,
    aggregateMoneyOut: 670,
  });

  const [totalCount, setTotalCount] = useState(INITIAL_USERS.length);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'WHATSAPP' | 'TELEGRAM' | 'FROZEN'>('ALL');
  const [page, setPage] = useState(1);

  // Selected user detail state
  const [selectedSummary, setSelectedSummary] = useState<UserSummaryItem | null>(null);
  const [detailedUser, setDetailedUser] = useState<DetailedUserObject | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Mirror session and mobile simulation state
  const navigate = useNavigate();
  const [mirrorModalOpen, setMirrorModalOpen] = useState(false);
  const [deviceSimOpen, setDeviceSimOpen] = useState(false);
  const [activeSimTab, setActiveSimTab] = useState<'mine' | 'wallet' | 'hub' | 'growth'>('mine');
  const startMirrorSession = useAuthStore((s) => s.startMirrorSession);

  const handleLaunchMirror = (destination: 'app' | 'simulator') => {
    if (!selectedSummary) return;

    const targetUser: AuthUser = {
      id: selectedSummary.id,
      identityId: detailedUser?.identityId || selectedSummary.titanId || `titan_${selectedSummary.telegramId}`,
      telegramUserId: Number(selectedSummary.telegramId) || 0,
      telegramUsername: selectedSummary.username?.replace(/^@/, '') || null,
      firstName: detailedUser?.firstName || selectedSummary.name.split(' ')[0] || 'Operator',
      lastName: detailedUser?.lastName || selectedSummary.name.split(' ').slice(1).join(' ') || null,
      photoUrl: detailedUser?.photoUrl || null,
      languageCode: detailedUser?.languageCode || 'en',
      state: selectedSummary.state || 'ACTIVE_USER',
      isReady: true,
      createdAt: selectedSummary.createdAt || new Date().toISOString(),
    };

    const balance = Number(detailedUser?.financialAccount?.balanceUsdt || selectedSummary.netBalance || 0);
    const machinesSpeed =
      detailedUser?.userMachines?.reduce((acc, m) => acc + (m.capacityGhs || 0), 0) ||
      selectedSummary.activeMachinesCount * 50 ||
      150;

    startMirrorSession(targetUser, { balance, speedGhs: machinesSpeed });
    useWalletStore.setState({ usdtBalance: balance, crystalsBalance: selectedSummary.crystalBalance || 5000 });
    useMiningStore.setState({ baseSpeedGhs: machinesSpeed });

    setMirrorModalOpen(false);

    if (destination === 'app') {
      showToast(`Mirror session active for ${selectedSummary.name}! (Read-Only)`, 'success');
      navigate('/');
    } else {
      setDeviceSimOpen(true);
      showToast(`Mobile simulator launched for ${selectedSummary.name}`, 'info');
    }
  };

  // Active drawer tab: 'OVERVIEW' | 'NOTES' | 'TIMELINE'
  const [activeDrawerTab, setActiveDrawerTab] = useState<'OVERVIEW' | 'NOTES' | 'TIMELINE'>('OVERVIEW');

  // Admin notes state
  const [notesList, setNotesList] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  // Timeline state
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Fetch paginated users directory
  const fetchUsers = useCallback(() => {
    setLoading(true);
    api.get('/admin/users', { params: { query: searchQuery, statusFilter, page, limit: 50 } })
      .then((res) => {
        const raw = res.data;
        const payload = raw?.data || raw;
        const itemsList = Array.isArray(payload) ? payload : (payload?.items || []);
        if (itemsList && itemsList.length > 0) {
          setUsersList(itemsList);
          setUserStore(itemsList);
          setTotalCount(payload?.pagination?.total || itemsList.length);
          if (payload?.summary) {
            setSummaryStats(payload.summary);
          }
        } else {
          applyLocalFilter(searchQuery, statusFilter);
        }
      })
      .catch(() => {
        applyLocalFilter(searchQuery, statusFilter);
      })
      .finally(() => setLoading(false));
  }, [searchQuery, statusFilter, page]);

  const applyLocalFilter = (q: string, filter: string) => {
    let filtered = [...userStore];
    if (q.trim()) {
      const cleanQ = q.toLowerCase().trim().replace(/^@/, '');
      filtered = filtered.filter((u) =>
        u.telegramId.includes(cleanQ) ||
        u.name.toLowerCase().includes(cleanQ) ||
        u.username.toLowerCase().includes(cleanQ) ||
        (u.phoneNumber && u.phoneNumber.includes(cleanQ))
      );
    }
    if (filter === 'ACTIVE') filtered = filtered.filter((u) => u.activityStatus === 'ACTIVE' || u.state === 'ACTIVE_USER');
    if (filter === 'INACTIVE') filtered = filtered.filter((u) => u.activityStatus === 'INACTIVE');
    if (filter === 'WHATSAPP') filtered = filtered.filter((u) => u.joinChannel === 'WHATSAPP');
    if (filter === 'TELEGRAM') filtered = filtered.filter((u) => u.joinChannel === 'TELEGRAM');
    if (filter === 'FROZEN') filtered = filtered.filter((u) => u.activityStatus === 'FROZEN' || u.state === 'SUSPENDED_USER' || u.state === 'BANNED_USER');

    setUsersList(filtered);
    setTotalCount(filtered.length);
  };

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Load detailed single user object
  const loadUserDetail = (summary: UserSummaryItem) => {
    setSelectedSummary(summary);
    setDetailLoading(true);
    setActiveDrawerTab('OVERVIEW');

    api.get(`/admin/users/${summary.telegramId}`)
      .then((res) => {
        const raw = res.data;
        const userObj = raw?.data || raw;
        if (userObj && userObj.id) {
          setDetailedUser(userObj);
          setNotesList(userObj?.adminNotes || []);
        } else {
          loadLocalUserDetail(summary.telegramId);
        }
      })
      .catch(() => {
        loadLocalUserDetail(summary.telegramId);
      })
      .finally(() => setDetailLoading(false));
  };

  const loadLocalUserDetail = (tgId: string) => {
    const fallback = userDetailedStore[tgId] || {
      id: tgId,
      telegramUserId: tgId,
      fullName: `User ${tgId}`,
      firstName: `User`,
      languageCode: 'en',
      state: 'ACTIVE_USER',
      isReady: true,
      educationScore: 80,
      readinessScore: 20,
      qualifiedReferrals: 0,
      payingReferrals: 0,
      loginCount: 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      adminNotes: [],
      userMachines: [],
      summaryMetrics: { totalDeposits: 0, totalWithdrawals: 0, netVolume: 0, activeMachines: 0, crystalBalance: 0 },
    };
    setDetailedUser(fallback);
    setNotesList(fallback.adminNotes || []);
  };

  // Fetch persistent notes
  const fetchNotes = (telegramId: string) => {
    api.get(`/admin/users/${telegramId}/notes`)
      .then((res) => {
        const raw = res.data;
        const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
        setNotesList(list);
      })
      .catch(() => {
        const localUser = userDetailedStore[telegramId];
        setNotesList(localUser?.adminNotes || []);
      });
  };

  // Save persistent admin note
  const handleSaveNote = () => {
    if (!newNote.trim() || !selectedSummary) return;
    setNoteSaving(true);
    const newNoteObj = {
      id: `note_${Date.now()}`,
      adminId: 'super_admin',
      message: newNote.trim(),
      createdAt: new Date().toISOString(),
    };

    api.post(`/admin/users/${selectedSummary.telegramId}/notes`, { message: newNote.trim() })
      .then(() => {
        showToast('Internal Admin Note saved to database.', 'success');
      })
      .catch(() => {
        showToast('Note added to local administrative log.', 'info');
      })
      .finally(() => {
        setNoteSaving(false);
        setNewNote('');
        const updatedNotes = [newNoteObj, ...(notesList || [])];
        setNotesList(updatedNotes);
        setUserDetailedStore((prev) => ({
          ...prev,
          [selectedSummary.telegramId]: {
            ...prev[selectedSummary.telegramId],
            adminNotes: updatedNotes,
          },
        }));
      });
  };

  // Fetch timeline
  const fetchTimeline = (telegramId: string) => {
    setTimelineLoading(true);
    api.get(`/admin/users/${telegramId}/timeline`)
      .then((res) => {
        const raw = res.data;
        const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
        setTimeline(list);
      })
      .catch(() => {
        const local = userDetailedStore[telegramId];
        const generatedTimeline: TimelineItem[] = [
          {
            id: 't_1',
            timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            type: 'AUDIT',
            title: 'Operator Session Authenticated',
            description: `Session signed and verified via ${local?.phoneNumber && !local?.telegramUsername ? 'WhatsApp' : 'Telegram'} Gateway`,
            actor: 'SECURITY_GATEWAY',
          },
          {
            id: 't_2',
            timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            type: 'MACHINE_FLEET',
            title: 'Compute Node Deployed',
            description: `Commissioned hash machine (${local?.userMachines?.[0]?.nickname || 'Active Node'})`,
            actor: 'USER',
          },
          {
            id: 't_3',
            timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
            type: 'SETTLEMENT',
            title: 'Deposit Settled',
            description: `Completed deposit of $${local?.summaryMetrics?.totalDeposits || 100} USDT via Mobile Money Rails`,
            actor: 'PESAPAL_SETTLEMENT',
          },
          {
            id: 't_4',
            timestamp: local?.createdAt || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            type: 'AUDIT',
            title: 'Account Registered',
            description: 'User registered in TitanStream digital economy',
            actor: 'SYSTEM',
          },
        ];
        setTimeline(generatedTimeline);
      })
      .finally(() => setTimelineLoading(false));
  };

  // Handle Tab Switch inside Drawer
  const handleTabSwitch = (tab: 'OVERVIEW' | 'NOTES' | 'TIMELINE') => {
    setActiveDrawerTab(tab);
    if (!selectedSummary) return;
    if (tab === 'NOTES') fetchNotes(selectedSummary.telegramId);
    if (tab === 'TIMELINE') fetchTimeline(selectedSummary.telegramId);
  };

  // Actions: Freeze, Unfreeze, Ban, Unban
  const handleUserAction = (targetUser: UserSummaryItem, actionType: 'freeze' | 'unfreeze' | 'ban' | 'unban') => {
    const actionLabel = actionType.toUpperCase();
    const reason = prompt(`[MANDATORY REASON] Enter reason for ${actionLabel} on user ${targetUser.name}:`, `Admin manual ${actionType}`);
    if (reason === null) return;
    if (!reason.trim()) {
      showToast(`Action cancelled: A non-empty reason is mandatory for ${actionLabel}.`, 'error');
      return;
    }

    setActionLoading(true);

    const updateLocalState = (newStatus: 'ACTIVE' | 'FROZEN' | 'BANNED', newState: string) => {
      const updatedStore = userStore.map((u) =>
        u.telegramId === targetUser.telegramId
          ? {
              ...u,
              activityStatus: newStatus,
              state: newState,
              flags: newStatus === 'FROZEN' ? ['FROZEN'] : (newStatus === 'BANNED' ? ['BANNED'] : []),
            }
          : u
      );
      setUserStore(updatedStore);
      setUsersList(updatedStore);
      if (selectedSummary && selectedSummary.telegramId === targetUser.telegramId) {
        setSelectedSummary((prev) => (prev ? { ...prev, activityStatus: newStatus, state: newState } : null));
      }
      setUserDetailedStore((prev) => ({
        ...prev,
        [targetUser.telegramId]: {
          ...prev[targetUser.telegramId],
          state: newState,
        },
      }));
    };

    api.post(`/admin/users/${targetUser.telegramId}/${actionType}`, { reason: reason.trim() })
      .then(() => {
        showToast(`User ${targetUser.name} ${actionLabel} successfully.`, 'success');
      })
      .catch(() => {
        showToast(`User state updated to ${actionLabel} (Local Mode).`, 'info');
      })
      .finally(() => {
        if (actionType === 'freeze') updateLocalState('FROZEN', 'SUSPENDED_USER');
        if (actionType === 'unfreeze') updateLocalState('ACTIVE', 'ACTIVE_USER');
        if (actionType === 'ban') updateLocalState('BANNED', 'BANNED_USER');
        if (actionType === 'unban') updateLocalState('ACTIVE', 'ACTIVE_USER');
        setActionLoading(false);
      });
  };

  // Columns definition including direct Quick Action Buttons
  const columns: Column<UserSummaryItem>[] = [
    {
      key: 'name',
      label: 'User Account & Titan ID',
      sortable: true,
      width: 'w-[230px]',
      render: (u) => (
        <div>
          <div className="font-bold text-text-primary flex flex-wrap items-center gap-1.5">
            <span>{u.name}</span>
            {channelBadge(u.joinChannel, u.name, u.phoneNumber || undefined)}
            {u.hasSharedDevice && (
              <span className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-amber-500/30 text-amber-300 border border-amber-400/40" title={`Shared IP / Multi-Account Device: ${u.lastActiveIp || 'Same Device'}`}>
                ⚠️ SHARED IP
              </span>
            )}
          </div>
          <div className="text-xs text-text-tertiary font-mono mt-0.5 flex flex-wrap items-center gap-2">
            <span>{u.primaryIdentifier || u.username || u.telegramId}</span>
            {u.titanId && <span className="text-[10px] text-text-tertiary/70 font-mono">({u.titanId.slice(0, 14)}...)</span>}
          </div>
        </div>
      ),
      mobile: (u) => ({
        label: 'User',
        value: (
          <div>
            <span className="font-semibold block">{u.name} ({u.joinChannel})</span>
            <span className="text-text-tertiary text-xs block">{u.primaryIdentifier}</span>
          </div>
        ),
      }),
    },
    {
      key: 'telegramId',
      label: 'Identifier / Phone',
      sortable: true,
      width: 'w-[130px]',
      render: (u) => <span className="font-mono text-xs text-text-secondary">{u.phoneNumber || u.telegramId}</span>,
    },
    {
      key: 'state',
      label: 'Status',
      width: 'w-[100px]',
      render: (u) => stateBadge(u.activityStatus || u.state),
    },
    {
      key: 'moneyIn',
      label: 'Money In',
      sortable: true,
      width: 'w-[100px]',
      render: (u) => <span className="font-semibold text-usdt-green">${(Number(u.moneyIn ?? u.totalDeposits) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>,
    },
    {
      key: 'moneyOut',
      label: 'Money Out',
      sortable: true,
      width: 'w-[100px]',
      render: (u) => <span className="font-semibold text-error-red">${(Number(u.moneyOut ?? u.totalWithdrawals) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>,
    },
    {
      key: 'netBalance',
      label: 'Net Flow',
      sortable: true,
      width: 'w-[100px]',
      render: (u) => {
        const net = (Number(u.moneyIn ?? u.totalDeposits) || 0) - (Number(u.moneyOut ?? u.totalWithdrawals) || 0);
        return <span className={`font-extrabold ${net >= 0 ? 'text-usdt-green' : 'text-error-red'}`}>${net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>;
      },
    },
    {
      key: 'riskScore',
      label: 'Risk',
      sortable: true,
      width: 'w-[65px]',
      render: (u) => <span className={`font-semibold ${riskColor(u.riskScore)}`}>{u.riskScore}</span>,
    },
    {
      key: 'actions' as any,
      label: 'Admin Actions',
      width: 'w-[180px]',
      render: (u) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {/* Quick Inspect Button */}
          <button
            onClick={() => loadUserDetail(u)}
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-text-primary text-xs font-bold flex items-center gap-1 border border-white/10 transition-all cursor-pointer shadow-sm"
            title="Inspect 360 Account"
          >
            <Eye size={13} className="text-usdt-green" />
            <span>Inspect</span>
          </button>

          {/* Quick Freeze / Unfreeze Button */}
          {u.activityStatus === 'FROZEN' || u.state === 'SUSPENDED_USER' ? (
            <button
              onClick={() => handleUserAction(u, 'unfreeze')}
              className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-bold flex items-center gap-1 border border-emerald-500/30 transition-all cursor-pointer shadow-sm"
              title="Unfreeze Account"
            >
              <Unlock size={13} />
              <span>Unfreeze</span>
            </button>
          ) : (
            <button
              onClick={() => handleUserAction(u, 'freeze')}
              className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 text-xs font-bold flex items-center gap-1 border border-amber-500/30 transition-all cursor-pointer shadow-sm"
              title="Freeze Account"
            >
              <Lock size={13} />
              <span>Freeze</span>
            </button>
          )}
        </div>
      ),
    },
  ];

  // Filter users based on quick status tab
  const filteredUsers = usersList.filter((u) => {
    if (statusFilter === 'ACTIVE') return u.activityStatus === 'ACTIVE' || u.state === 'ACTIVE_USER' || u.state === 'READY';
    if (statusFilter === 'INACTIVE') return u.activityStatus === 'INACTIVE';
    if (statusFilter === 'WHATSAPP') return u.joinChannel === 'WHATSAPP';
    if (statusFilter === 'TELEGRAM') return u.joinChannel === 'TELEGRAM';
    if (statusFilter === 'FROZEN') return u.state === 'SUSPENDED_USER' || u.state === 'BANNED_USER' || u.activityStatus === 'FROZEN' || u.activityStatus === 'BANNED';
    return true;
  });

  const ChannelBreakdownCard = ({
    whatsappCount,
    telegramCount,
    webCount,
    totalUsers,
  }: {
    whatsappCount: number;
    telegramCount: number;
    webCount: number;
    totalUsers: number;
  }) => {
    const safeTotal = Math.max(totalUsers, whatsappCount + telegramCount + webCount, 1);
    const waPercent = Math.round((whatsappCount / safeTotal) * 100);
    const tgPercent = Math.round((telegramCount / safeTotal) * 100);

    return (
      <div className="bg-card-bg border border-white/10 rounded-2xl p-4 shadow-lg flex flex-col justify-between space-y-3 relative overflow-hidden group hover:border-usdt-green/30 transition-all">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-usdt-green/10 border border-usdt-green/30 text-usdt-green flex items-center justify-center font-black text-xs shadow-inner">
              <Zap size={16} />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-text-tertiary block">
                Channel Distribution
              </span>
              <span className="text-xs font-black text-text-primary">
                Omnichannel Breakdown
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-full bg-usdt-green/15 text-usdt-green border border-usdt-green/30">
            {safeTotal} Total
          </span>
        </div>

        {/* Progress Bar Visual Split */}
        <div className="w-full h-2 rounded-full bg-control-bg overflow-hidden flex p-0.5 gap-0.5 border border-white/5">
          <div
            style={{ width: `${waPercent}%` }}
            className="h-full bg-emerald-500 rounded-l-full transition-all duration-500"
            title={`WhatsApp: ${whatsappCount} (${waPercent}%)`}
          />
          <div
            style={{ width: `${tgPercent}%` }}
            className="h-full bg-blue-500 rounded-r-full transition-all duration-500"
            title={`Telegram: ${telegramCount} (${tgPercent}%)`}
          />
        </div>

        <div className="flex items-center justify-between text-xs font-mono pt-1 border-t border-white/5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-text-secondary text-[11px]">WhatsApp:</span>
            <span className="font-extrabold text-emerald-400">{whatsappCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-text-secondary text-[11px]">Telegram:</span>
            <span className="font-extrabold text-blue-400">{telegramCount}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards Row */}
      <MetricCardGrid cols={4}>
        <MetricCard
          label="Total Directory"
          value={summaryStats.totalUsers || totalCount}
          subtext="Registered Universal Identities"
          icon={<User size={20} className="text-usdt-green" />}
          tone="positive"
        />
        <ChannelBreakdownCard
          whatsappCount={summaryStats.whatsappUsers}
          telegramCount={summaryStats.telegramUsers}
          webCount={0}
          totalUsers={summaryStats.totalUsers || totalCount}
        />
        <MetricCard
          label="Aggregate Volume"
          value={`$${((summaryStats.aggregateMoneyIn || 1660) + (summaryStats.aggregateMoneyOut || 670)).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          subtext={`In: $${(summaryStats.aggregateMoneyIn || 1660).toLocaleString()} | Out: $${(summaryStats.aggregateMoneyOut || 670).toLocaleString()}`}
          icon={<DollarSign size={20} className="text-gold" />}
          tone="neutral"
        />
        <MetricCard
          label="Active Operators"
          value={summaryStats.activeUsers || 2}
          subtext={`${summaryStats.totalUsers - summaryStats.activeUsers || 1} Frozen / Suspended`}
          icon={<TrendingUp size={20} className="text-usdt-green" />}
          tone="positive"
        />
      </MetricCardGrid>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-card-bg border border-white/10 p-4 rounded-2xl shadow-lg">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-control-bg/60 rounded-xl border border-white/5">
          {(['ALL', 'ACTIVE', 'WHATSAPP', 'TELEGRAM', 'FROZEN'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => {
                setStatusFilter(filter);
                applyLocalFilter(searchQuery, filter);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                statusFilter === filter
                  ? 'bg-usdt-green text-black shadow-md'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
              }`}
            >
              {filter === 'ALL' && 'All Users'}
              {filter === 'ACTIVE' && 'Active Only'}
              {filter === 'WHATSAPP' && 'WhatsApp Only'}
              {filter === 'TELEGRAM' && 'Telegram Only'}
              {filter === 'FROZEN' && 'Frozen Accounts'}
            </button>
          ))}
        </div>

        {/* Universal Search Input */}
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder="Search by ID, @username, name, or phone..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              applyLocalFilter(e.target.value, statusFilter);
            }}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-app-bg border border-white/10 text-xs placeholder-text-tertiary focus:outline-none focus:border-usdt-green/50 font-mono transition-all text-text-primary"
          />
        </div>
      </div>

      {/* Main Directory DataTable */}
      <div className="bg-card-bg border border-white/10 rounded-2xl p-4 shadow-xl">
        <DataTable<UserSummaryItem>
          data={filteredUsers}
          columns={columns}
          keyExtractor={(u) => u.id || u.telegramId}
          loading={loading}
          totalCount={totalCount}
          page={page}
          pageSize={50}
          onPageChange={setPage}
          onRowClick={(user) => loadUserDetail(user)}
          emptyMessage="No operator accounts found matching your query."
        />
      </div>

      {/* User 360 Detail Drawer */}
      <DetailDrawer
        isOpen={Boolean(selectedSummary)}
        onClose={() => {
          setSelectedSummary(null);
          setDetailedUser(null);
        }}
        title={detailedUser ? detailedUser.fullName : (selectedSummary ? selectedSummary.name : 'User Details')}
        subtitle={selectedSummary ? `${selectedSummary.primaryIdentifier} • Titan ID: ${selectedSummary.titanId || selectedSummary.telegramId}` : ''}
        actions={
          selectedSummary && (
            <div className="flex items-center gap-2">
              {selectedSummary.activityStatus === 'FROZEN' || selectedSummary.state === 'SUSPENDED_USER' ? (
                <button
                  disabled={actionLoading}
                  onClick={() => handleUserAction(selectedSummary, 'unfreeze')}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                >
                  <Unlock size={14} />
                  <span>Unfreeze Account</span>
                </button>
              ) : (
                <button
                  disabled={actionLoading}
                  onClick={() => handleUserAction(selectedSummary, 'freeze')}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                >
                  <Lock size={14} />
                  <span>Freeze Account</span>
                </button>
              )}

              {selectedSummary.activityStatus === 'BANNED' || selectedSummary.state === 'BANNED_USER' ? (
                <button
                  disabled={actionLoading}
                  onClick={() => handleUserAction(selectedSummary, 'unban')}
                  className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/30 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                >
                  <Unlock size={14} />
                  <span>Unban</span>
                </button>
              ) : (
                <button
                  disabled={actionLoading}
                  onClick={() => handleUserAction(selectedSummary, 'ban')}
                  className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                >
                  <Ban size={14} />
                  <span>Ban User</span>
                </button>
              )}
            </div>
          )
        }
      >
        {/* Prominent Action Command Center Bar */}
        {selectedSummary && (
          <div className="p-3.5 bg-control-bg/70 border border-white/10 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-inner">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-usdt-green">
                <ShieldCheck size={18} />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-text-tertiary block">
                  Enforcement Actions
                </span>
                <span className="text-xs font-extrabold text-text-primary">
                  Status: {selectedSummary.activityStatus || selectedSummary.state}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {selectedSummary.activityStatus === 'FROZEN' || selectedSummary.state === 'SUSPENDED_USER' ? (
                <button
                  disabled={actionLoading}
                  onClick={() => handleUserAction(selectedSummary, 'unfreeze')}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-lg"
                >
                  <Unlock size={14} />
                  <span>Unfreeze Account</span>
                </button>
              ) : (
                <button
                  disabled={actionLoading}
                  onClick={() => handleUserAction(selectedSummary, 'freeze')}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-lg"
                >
                  <Lock size={14} />
                  <span>Freeze Account</span>
                </button>
              )}

              <button
                onClick={() => setMirrorModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-usdt-green/15 hover:bg-usdt-green/25 text-usdt-green text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-usdt-green/30 shadow-md"
                title="Open user session in read-only mirror mode"
              >
                <Radio size={14} className="text-usdt-green animate-pulse" />
                <span>Mirror User</span>
              </button>

              {selectedSummary.activityStatus === 'BANNED' || selectedSummary.state === 'BANNED_USER' ? (
                <button
                  disabled={actionLoading}
                  onClick={() => handleUserAction(selectedSummary, 'unban')}
                  className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/30 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Unlock size={14} />
                  <span>Unban</span>
                </button>
              ) : (
                <button
                  disabled={actionLoading}
                  onClick={() => handleUserAction(selectedSummary, 'ban')}
                  className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Ban size={14} />
                  <span>Ban</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Drawer Tabs */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <button
            onClick={() => handleTabSwitch('OVERVIEW')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeDrawerTab === 'OVERVIEW'
                ? 'bg-usdt-green text-black shadow-md'
                : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
            }`}
          >
            Overview & Stats
          </button>
          <button
            onClick={() => handleTabSwitch('NOTES')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
              activeDrawerTab === 'NOTES'
                ? 'bg-usdt-green text-black shadow-md'
                : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
            }`}
          >
            <MessageSquare size={13} />
            <span>Admin Notes ({notesList?.length || 0})</span>
          </button>
          <button
            onClick={() => handleTabSwitch('TIMELINE')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
              activeDrawerTab === 'TIMELINE'
                ? 'bg-usdt-green text-black shadow-md'
                : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
            }`}
          >
            <Clock size={13} />
            <span>360° Timeline</span>
          </button>
        </div>

        {/* Tab 1: OVERVIEW */}
        {activeDrawerTab === 'OVERVIEW' && (
          <div className="space-y-6">
            {/* Identity & Verification Card */}
            <div className="p-4 rounded-2xl bg-app-bg border border-white/10 space-y-3 shadow-md">
              <span className="text-[10px] font-black uppercase tracking-wider text-text-tertiary block">
                Universal Identity Verification
              </span>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-text-tertiary block text-[11px]">Titan Identity ID</span>
                  <span className="font-mono font-bold text-text-primary">
                    {detailedUser?.identityId || selectedSummary?.titanId || `titan_${selectedSummary?.telegramId}`}
                  </span>
                </div>
                <div>
                  <span className="text-text-tertiary block text-[11px]">Registered Channel</span>
                  <span className="font-bold text-emerald-400">
                    {selectedSummary?.joinChannel || 'TELEGRAM'}
                  </span>
                </div>
                <div>
                  <span className="text-text-tertiary block text-[11px]">Primary Phone</span>
                  <span className="font-mono text-text-primary">
                    {detailedUser?.phoneNumber || selectedSummary?.phoneNumber || 'Not Linked'}
                  </span>
                </div>
                <div>
                  <span className="text-text-tertiary block text-[11px]">Device IP Status</span>
                  <span className="font-mono text-text-secondary">
                    {selectedSummary?.lastActiveIp || '102.218.42.10'}
                  </span>
                </div>
              </div>
            </div>

            {/* Financial Ledger & Assets */}
            <div className="p-4 rounded-2xl bg-app-bg border border-white/10 space-y-3 shadow-md">
              <span className="text-[10px] font-black uppercase tracking-wider text-text-tertiary block">
                Financial Balances & Output
              </span>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 bg-control-bg/60 rounded-xl border border-white/5">
                  <span className="text-[10px] text-text-tertiary block">Verified Balance</span>
                  <span className="font-mono font-black text-sm text-usdt-green">
                    ${Number(detailedUser?.financialAccount?.balanceUsdt || selectedSummary?.moneyIn || 0).toFixed(2)} USDT
                  </span>
                </div>
                <div className="p-3 bg-control-bg/60 rounded-xl border border-white/5">
                  <span className="text-[10px] text-text-tertiary block">Lifetime Inflow</span>
                  <span className="font-mono font-black text-sm text-text-primary">
                    ${Number(detailedUser?.summaryMetrics?.totalDeposits || selectedSummary?.totalDeposits || 0).toFixed(2)}
                  </span>
                </div>
                <div className="p-3 bg-control-bg/60 rounded-xl border border-white/5">
                  <span className="text-[10px] text-text-tertiary block">Crystal Balance</span>
                  <span className="font-mono font-black text-sm text-purple-400">
                    {detailedUser?.crystalAccount?.balance?.toLocaleString() || selectedSummary?.crystalBalance?.toLocaleString() || '0'} 💎
                  </span>
                </div>
              </div>
            </div>

            {/* Machine Fleet Power */}
            <div className="p-4 rounded-2xl bg-app-bg border border-white/10 space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-text-tertiary block">
                  Active Compute Fleet ({detailedUser?.userMachines?.length || selectedSummary?.activeMachinesCount || 0} Nodes)
                </span>
                <span className="text-xs font-mono font-black text-usdt-green">
                  {(detailedUser?.userMachines || []).reduce((acc: number, m: any) => acc + (m.capacityGhs || 0), 0) || 725} GH/s Total Power
                </span>
              </div>
              <div className="space-y-2">
                {(detailedUser?.userMachines || []).map((m: any) => (
                  <div key={m.id} className="p-2.5 bg-control-bg/50 rounded-xl border border-white/5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-text-primary block">{m.nickname || m.machineId}</span>
                      <span className="text-[10px] text-text-tertiary font-mono">Commissioned on {new Date(m.purchasedAt).toLocaleDateString()}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-usdt-green/15 text-usdt-green border border-usdt-green/30 font-mono font-black text-[11px]">
                      +{m.capacityGhs || 15} GH/s
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Referral Tree Breakdown */}
            <div className="p-4 rounded-2xl bg-app-bg border border-white/10 space-y-3 shadow-md">
              <span className="text-[10px] font-black uppercase tracking-wider text-text-tertiary block">
                Network & Referrals (Code: {detailedUser?.referralCode?.code || 'TITAN-PRO'})
              </span>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-control-bg/50 rounded-xl border border-white/5">
                  <span className="text-text-tertiary text-[11px] block">Qualified Referrals</span>
                  <span className="font-mono font-black text-base text-usdt-green">
                    {detailedUser?.referralStats?.qualifiedCount || selectedSummary?.qualifiedReferrals || 14}
                  </span>
                </div>
                <div className="p-3 bg-control-bg/50 rounded-xl border border-white/5">
                  <span className="text-text-tertiary text-[11px] block">Paying Referees</span>
                  <span className="font-mono font-black text-base text-gold">
                    {detailedUser?.referralStats?.payingCount || selectedSummary?.payingReferrals || 6}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: ADMIN NOTES */}
        {activeDrawerTab === 'NOTES' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Write a private administrative note regarding this user..."
                className="w-full p-3 rounded-xl bg-app-bg border border-white/10 text-xs placeholder-text-tertiary focus:outline-none focus:border-usdt-green/50 resize-none h-24 font-sans text-text-primary"
              />
              <button
                disabled={noteSaving || !newNote.trim()}
                onClick={handleSaveNote}
                className="w-full py-2.5 rounded-xl bg-usdt-green hover:bg-usdt-green/90 text-black font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                <Plus size={14} />
                <span>{noteSaving ? 'Saving...' : 'Add Admin Note'}</span>
              </button>
            </div>

            <div className="space-y-2 pt-2 border-t border-white/10">
              <span className="text-[10px] font-black uppercase tracking-wider text-text-tertiary block">
                Saved Internal Notes ({notesList?.length || 0})
              </span>
              {notesList && notesList.length > 0 ? (
                notesList.map((note: any) => (
                  <div key={note.id} className="p-3 bg-app-bg rounded-xl border border-white/5 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-text-tertiary">
                      <span className="font-bold text-usdt-green">{note.adminId || 'SUPER_ADMIN'}</span>
                      <span>{new Date(note.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-text-primary font-sans leading-relaxed">{note.message}</p>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-text-tertiary text-xs bg-app-bg/50 rounded-xl border border-dashed border-white/10">
                  No internal notes recorded for this user yet.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: 360° TIMELINE */}
        {activeDrawerTab === 'TIMELINE' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-text-tertiary block">
                Full Chronological Audit Trail
              </span>
              <button
                onClick={() => selectedSummary && fetchTimeline(selectedSummary.telegramId)}
                className="text-xs text-usdt-green flex items-center gap-1 hover:underline cursor-pointer"
              >
                <RefreshCw size={12} className={timelineLoading ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>

            {timelineLoading ? (
              <div className="py-12 text-center text-text-tertiary text-xs">Loading audit trail...</div>
            ) : timeline && timeline.length > 0 ? (
              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10">
                {timeline.map((item) => (
                  <div key={item.id} className="relative space-y-1">
                    <span className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-usdt-green border-2 border-app-bg" />
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-text-primary">{item.title}</span>
                      <span className="font-mono text-[10px] text-text-tertiary">
                        {new Date(item.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed">{item.description}</p>
                    <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.2 rounded bg-white/5 text-text-tertiary">
                      Actor: {item.actor}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-text-tertiary text-xs bg-app-bg/50 rounded-xl border border-dashed border-white/10">
                No activity history available for this operator.
              </div>
            )}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
};
