import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { DetailDrawer } from '@/components/admin/DetailDrawer';
import { MetricCard, MetricCardGrid } from '@/components/admin/MetricCard';
import { api } from '@/services/api';
import { showToast } from '@/components/Toast';
import {
  ShieldAlert,
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
  type: 'AUDIT' | 'SETTLEMENT' | 'RISK_EVENT' | 'ADMIN_NOTE';
  title: string;
  description: string;
  actor: string;
  metadata?: any;
}

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

const channelBadge = (channel?: string) => {
  const ch = channel || 'TELEGRAM';
  if (ch === 'WHATSAPP') {
    return <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">WHATSAPP</span>;
  }
  if (ch === 'WEB') {
    return <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-400 border border-purple-500/30">WEB APP</span>;
  }
  return <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30">TELEGRAM</span>;
};

const columns: Column<UserSummaryItem>[] = [
  {
    key: 'name',
    label: 'User Account & Titan ID',
    sortable: true,
    width: 'w-[240px]',
    render: (u) => (
      <div>
        <div className="font-bold text-text-primary flex flex-wrap items-center gap-1.5">
          <span>{u.name}</span>
          {channelBadge(u.joinChannel)}
          {u.hasSharedDevice && (
            <span className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-amber-500/30 text-amber-300 border border-amber-400/40" title={`Shared IP / Multi-Account Device: ${u.lastActiveIp || 'Same Device'}`}>
              ⚠️ SHARED IP
            </span>
          )}
        </div>
        <div className="text-xs text-text-tertiary font-mono mt-0.5 flex flex-wrap items-center gap-2">
          <span>{u.primaryIdentifier || u.username || u.telegramId}</span>
          {u.titanId && <span className="text-[10px] text-text-tertiary/70 font-mono">({u.titanId.slice(0, 13)}...)</span>}
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
    width: 'w-[140px]',
    render: (u) => <span className="font-mono text-xs text-text-secondary">{u.phoneNumber || u.telegramId}</span>,
  },
  {
    key: 'state',
    label: 'Status',
    width: 'w-[110px]',
    render: (u) => stateBadge(u.activityStatus || u.state),
  },
  {
    key: 'moneyIn',
    label: 'Money In',
    sortable: true,
    width: 'w-[110px]',
    render: (u) => <span className="font-semibold text-usdt-green">${(Number(u.moneyIn ?? u.totalDeposits) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>,
  },
  {
    key: 'moneyOut',
    label: 'Money Out',
    sortable: true,
    width: 'w-[110px]',
    render: (u) => <span className="font-semibold text-error-red">${(Number(u.moneyOut ?? u.totalWithdrawals) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>,
  },
  {
    key: 'netBalance',
    label: 'Net Flow',
    sortable: true,
    width: 'w-[110px]',
    render: (u) => {
      const net = (Number(u.moneyIn ?? u.totalDeposits) || 0) - (Number(u.moneyOut ?? u.totalWithdrawals) || 0);
      return <span className={`font-extrabold ${net >= 0 ? 'text-usdt-green' : 'text-error-red'}`}>${net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>;
    },
  },
  {
    key: 'riskScore',
    label: 'Risk',
    sortable: true,
    width: 'w-[70px]',
    render: (u) => <span className={`font-semibold ${riskColor(u.riskScore)}`}>{u.riskScore}</span>,
  },
];

export const UsersPage: React.FC = () => {
  const [usersList, setUsersList] = useState<UserSummaryItem[]>([]);
  const [summaryStats, setSummaryStats] = useState<{
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    whatsappUsers: number;
    telegramUsers: number;
    aggregateMoneyIn: number;
    aggregateMoneyOut: number;
  }>({
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    whatsappUsers: 0,
    telegramUsers: 0,
    aggregateMoneyIn: 0,
    aggregateMoneyOut: 0,
  });
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'WHATSAPP' | 'TELEGRAM' | 'FROZEN'>('ALL');
  const [page, setPage] = useState(1);

  // Selected user detail state
  const [selectedSummary, setSelectedSummary] = useState<UserSummaryItem | null>(null);
  const [detailedUser, setDetailedUser] = useState<DetailedUserObject | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

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
    api.get('/admin/users', { params: { query: searchQuery, page, limit: 50 } })
      .then((res) => {
        const raw = res.data;
        const payload = raw?.data || raw;
        const itemsList = Array.isArray(payload) ? payload : (payload?.items || []);
        const paginationTotal = payload?.pagination?.total || itemsList.length;

        setUsersList(itemsList);
        setTotalCount(paginationTotal);
        if (payload?.summary) {
          setSummaryStats(payload.summary);
        }
      })
      .catch((err) => {
        showToast(err.response?.data?.message || 'Failed to load user directory', 'error');
        setUsersList([]);
        setTotalCount(0);
      })
      .finally(() => setLoading(false));
  }, [searchQuery, page]);

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
        setDetailedUser(userObj);
        setNotesList(userObj?.adminNotes || []);
      })
      .catch((err) => {
        showToast(err.response?.data?.message || 'Failed to fetch detailed user record', 'error');
      })
      .finally(() => setDetailLoading(false));
  };

  // Fetch persistent notes
  const fetchNotes = (telegramId: string) => {
    api.get(`/admin/users/${telegramId}/notes`)
      .then((res) => {
        const raw = res.data;
        const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
        setNotesList(list);
      })
      .catch(() => setNotesList([]));
  };

  // Save persistent admin note
  const handleSaveNote = () => {
    if (!newNote.trim() || !selectedSummary) return;
    setNoteSaving(true);
    api.post(`/admin/users/${selectedSummary.telegramId}/notes`, { message: newNote.trim() })
      .then(() => {
        showToast('Internal Admin Note saved to database.', 'success');
        setNewNote('');
        fetchNotes(selectedSummary.telegramId);
      })
      .catch((err) => {
        showToast(err.response?.data?.message || 'Failed to save admin note', 'error');
      })
      .finally(() => setNoteSaving(false));
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
      .catch(() => setTimeline([]))
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
  const handleUserAction = (actionType: 'freeze' | 'unfreeze' | 'ban' | 'unban') => {
    if (!selectedSummary) return;
    const actionLabel = actionType.toUpperCase();
    const reason = prompt(`[MANDATORY REASON] Enter reason for ${actionLabel} on user ${selectedSummary.name}:`, `Admin manual ${actionType}`);
    if (reason === null) return;
    if (!reason.trim()) {
      showToast(`Action cancelled: A non-empty reason is mandatory for ${actionLabel}.`, 'error');
      return;
    }

    setActionLoading(true);
    api.post(`/admin/users/${selectedSummary.telegramId}/${actionType}`, { reason: reason.trim() })
      .then(() => {
        showToast(`User ${selectedSummary.name} ${actionLabel} successfully.`, 'success');
        fetchUsers();
        loadUserDetail(selectedSummary);
      })
      .catch((err) => {
        showToast(err.response?.data?.message || `Failed to ${actionType} user`, 'error');
      })
      .finally(() => setActionLoading(false));
  };

  // Filter users based on quick status tab
  const filteredUsers = usersList.filter((u) => {
    if (statusFilter === 'ACTIVE') return u.activityStatus === 'ACTIVE' || u.state === 'ACTIVE_USER' || u.state === 'READY';
    if (statusFilter === 'INACTIVE') return u.activityStatus === 'INACTIVE';
    if (statusFilter === 'WHATSAPP') return u.joinChannel === 'WHATSAPP';
    if (statusFilter === 'TELEGRAM') return u.joinChannel === 'TELEGRAM';
    if (statusFilter === 'FROZEN') return u.state === 'SUSPENDED_USER' || u.state === 'BANNED_USER' || u.activityStatus === 'FROZEN' || u.activityStatus === 'BANNED';
    return true;
  });

  const safeNotes = Array.isArray(notesList) ? notesList : [];
  const safeTimeline = Array.isArray(timeline) ? timeline : [];

  return (
    <div className="space-y-4">
      {/* Top Metrics Cards */}
      <MetricCardGrid columns={4}>
        <MetricCard
          label="Total Accounts"
          value={totalCount.toString()}
          subValue={`Active: ${summaryStats.activeUsers ?? usersList.filter(u => u.activityStatus === 'ACTIVE').length} | Inactive: ${summaryStats.inactiveUsers ?? usersList.filter(u => u.activityStatus === 'INACTIVE').length}`}
          change={0}
          icon="Users"
          variant="green"
        />
        <MetricCard
          label="Channel Breakdown"
          value={`📱 WA: ${summaryStats.whatsappUsers} | ✈️ TG: ${summaryStats.telegramUsers}`}
          subValue="Multi-Channel Omnichannel Identity"
          change={0}
          icon="Zap"
          variant="blue"
        />
        <MetricCard
          label="Aggregate Money In (Deposits)"
          value={`$${(summaryStats.aggregateMoneyIn || usersList.reduce((s, u) => s + (u.moneyIn || 0), 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          subValue="Total Verified Escrow Inflows"
          change={0}
          icon="DollarSign"
          variant="green"
        />
        <MetricCard
          label="Aggregate Money Out (Payouts)"
          value={`$${(summaryStats.aggregateMoneyOut || usersList.reduce((s, u) => s + (u.moneyOut || 0), 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          subValue="Total Approved Ledger Claims"
          change={0}
          icon="TrendingUp"
          variant="gold"
        />
      </MetricCardGrid>

      {/* Filter Tabs & Search Toolbar */}
      <div className="space-y-3 bg-card-bg p-4 rounded-xl border border-white/5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {(['ALL', 'ACTIVE', 'INACTIVE', 'WHATSAPP', 'TELEGRAM', 'FROZEN'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wide transition-all ${
                  statusFilter === filter
                    ? 'bg-usdt-green text-app-bg shadow-md'
                    : 'bg-control-bg text-text-tertiary hover:text-text-primary border border-white/5'
                }`}
              >
                {filter === 'ALL' ? `All (${totalCount})` :
                 filter === 'ACTIVE' ? `Active` :
                 filter === 'INACTIVE' ? `Inactive` :
                 filter === 'WHATSAPP' ? `WhatsApp` :
                 filter === 'TELEGRAM' ? `Telegram` : `Frozen / Banned`}
              </button>
            ))}
          </div>

          <button
            onClick={fetchUsers}
            className="px-3 py-1.5 rounded-lg bg-control-bg text-text-secondary text-xs font-bold flex items-center gap-1.5 hover:text-text-primary border border-white/10"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search by Name, Username, Phone Number, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-control-bg text-text-primary text-xs pl-9 pr-3 py-2 rounded-lg border border-white/10 focus:outline-none focus:border-usdt-green"
          />
        </div>
      </div>

      {/* User Directory Data Table */}
      {loading ? (
        <div className="p-8 text-center bg-card-bg rounded-xl border border-white/5 text-xs text-text-tertiary">
          Loading production user directory...
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="p-8 text-center bg-card-bg rounded-xl border border-white/5 space-y-1">
          <p className="text-xs font-bold text-text-primary">No user accounts found matching query</p>
          <p className="text-[11px] text-text-tertiary font-mono">Registered members across Telegram, WhatsApp, and Web will appear here automatically.</p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filteredUsers}
          keyExtractor={(u) => u.id}
          onRowClick={(u) => loadUserDetail(u)}
          pageSize={20}
          mobileCard
        />
      )}

      {/* Single Authoritative User Inspector Drawer */}
      {selectedSummary && (
        <DetailDrawer
          isOpen={!!selectedSummary}
          onClose={() => {
            setSelectedSummary(null);
            setDetailedUser(null);
          }}
          title={selectedSummary.name || 'User Inspector'}
        >
          <div className="space-y-4">
            {/* Header info */}
            <div className="p-4 rounded-xl bg-control-bg border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-text-primary">{selectedSummary.name}</h3>
                    {channelBadge(selectedSummary.joinChannel)}
                  </div>
                  <p className="text-xs font-mono text-text-tertiary mt-0.5">
                    Primary: {selectedSummary.primaryIdentifier} | ID: {selectedSummary.telegramId}
                  </p>
                </div>
                {stateBadge(selectedSummary.activityStatus || detailedUser?.state || selectedSummary.state)}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                {(detailedUser?.state || selectedSummary.state) === 'SUSPENDED_USER' ? (
                  <button
                    disabled={actionLoading}
                    onClick={() => handleUserAction('unfreeze')}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-500/30"
                  >
                    <Unlock size={14} /> Unfreeze Account
                  </button>
                ) : (
                  <button
                    disabled={actionLoading}
                    onClick={() => handleUserAction('freeze')}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 hover:bg-amber-500/30"
                  >
                    <Lock size={14} /> Freeze Account
                  </button>
                )}

                {(detailedUser?.state || selectedSummary.state) === 'BANNED_USER' ? (
                  <button
                    disabled={actionLoading}
                    onClick={() => handleUserAction('unban')}
                    className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-bold flex items-center gap-1.5 hover:bg-blue-500/30"
                  >
                    <Unlock size={14} /> Unban Account
                  </button>
                ) : (
                  <button
                    disabled={actionLoading}
                    onClick={() => handleUserAction('ban')}
                    className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold flex items-center gap-1.5 hover:bg-red-500/30"
                  >
                    <Ban size={14} /> Ban Account
                  </button>
                )}
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-white/10 gap-4 text-xs font-bold">
              <button
                onClick={() => handleTabSwitch('OVERVIEW')}
                className={`pb-2 border-b-2 transition-colors ${activeDrawerTab === 'OVERVIEW' ? 'border-usdt-green text-usdt-green' : 'border-transparent text-text-tertiary'}`}
              >
                Overview
              </button>
              <button
                onClick={() => handleTabSwitch('NOTES')}
                className={`pb-2 border-b-2 transition-colors ${activeDrawerTab === 'NOTES' ? 'border-usdt-green text-usdt-green' : 'border-transparent text-text-tertiary'}`}
              >
                Admin Notes ({safeNotes.length})
              </button>
              <button
                onClick={() => handleTabSwitch('TIMELINE')}
                className={`pb-2 border-b-2 transition-colors ${activeDrawerTab === 'TIMELINE' ? 'border-usdt-green text-usdt-green' : 'border-transparent text-text-tertiary'}`}
              >
                Activity Timeline
              </button>
            </div>

            {/* TAB 1: OVERVIEW */}
            {activeDrawerTab === 'OVERVIEW' && (
              <div className="space-y-4">
                {detailLoading ? (
                  <div className="p-4 text-center text-xs text-text-tertiary">Fetching single-object user record...</div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-control-bg border border-white/5 space-y-1">
                        <span className="text-[10px] text-text-tertiary uppercase font-bold">Money In (Deposits)</span>
                        <p className="text-sm font-bold text-usdt-green">
                          ${(selectedSummary.moneyIn || detailedUser?.summaryMetrics?.totalDeposits || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-control-bg border border-white/5 space-y-1">
                        <span className="text-[10px] text-text-tertiary uppercase font-bold">Money Out (Payouts)</span>
                        <p className="text-sm font-bold text-error-red">
                          ${(selectedSummary.moneyOut || detailedUser?.summaryMetrics?.totalWithdrawals || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-control-bg border border-white/5 space-y-2">
                      <h4 className="text-xs font-bold text-text-primary uppercase">Identity & Channel Metadata</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div><span className="text-text-tertiary">Channel:</span> {selectedSummary.joinChannel}</div>
                        <div><span className="text-text-tertiary">Phone:</span> {selectedSummary.phoneNumber || 'N/A'}</div>
                        <div><span className="text-text-tertiary">Logins:</span> {detailedUser?.loginCount || 0}</div>
                        <div><span className="text-text-tertiary">Registered:</span> {new Date(detailedUser?.createdAt || selectedSummary.createdAt || Date.now()).toLocaleDateString()}</div>
                        <div><span className="text-text-tertiary">Last Active:</span> {selectedSummary.lastActiveAt ? new Date(selectedSummary.lastActiveAt).toLocaleDateString() : 'N/A'}</div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* TAB 2: PERSISTENT ADMIN NOTES */}
            {activeDrawerTab === 'NOTES' && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add persistent internal note..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="flex-1 bg-control-bg text-text-primary text-xs rounded-xl px-3 py-2 border border-white/10 focus:outline-none"
                  />
                  <button
                    disabled={noteSaving || !newNote.trim()}
                    onClick={handleSaveNote}
                    className="px-3 py-2 rounded-xl bg-usdt-green text-app-bg text-xs font-bold flex items-center gap-1 disabled:opacity-50"
                  >
                    <Plus size={14} /> Save
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {safeNotes.length === 0 ? (
                    <p className="text-xs text-text-tertiary text-center py-4">No database admin notes recorded yet.</p>
                  ) : (
                    safeNotes.map((note) => (
                      <div key={note.id} className="p-3 rounded-xl bg-control-bg border border-white/5 text-xs space-y-1">
                        <div className="flex justify-between text-text-tertiary text-[10px]">
                          <span>Admin: {note.adminId}</span>
                          <span>{new Date(note.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-text-primary font-medium">{note.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: USER ACTIVITY TIMELINE */}
            {activeDrawerTab === 'TIMELINE' && (
              <div className="space-y-3">
                {timelineLoading ? (
                  <div className="p-4 text-center text-xs text-text-tertiary">Building chronological activity stream...</div>
                ) : safeTimeline.length === 0 ? (
                  <p className="text-xs text-text-tertiary text-center py-4">No activity history recorded.</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {safeTimeline.map((item) => (
                      <div key={item.id} className="p-3 rounded-xl bg-control-bg border border-white/5 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-text-primary flex items-center gap-1.5">
                            <Clock size={12} className="text-usdt-green" /> {item.title}
                          </span>
                          <span className="text-[10px] text-text-tertiary">{new Date(item.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-text-secondary">{item.description}</p>
                        <span className="text-[10px] font-mono text-text-tertiary block">Actor: {item.actor}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </DetailDrawer>
      )}
    </div>
  );
};

