import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { DetailDrawer } from '@/components/admin/DetailDrawer';
import { StatusBadge } from '@/components/admin/StatusBadge';
import {
  adminWithdrawalService,
  type AdminWithdrawalRecord,
  type PayoutInstructions,
} from '@/services/adminWithdrawalService';
import { showToast } from '@/components/Toast';
import {
  ArrowUpFromLine,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  HandMetal,
  Send,
  FileCheck,
  RotateCcw,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Wallet,
  Users,
  MessageSquare,
  Zap,
} from 'lucide-react';

const statusVariant: Record<string, 'info' | 'default' | 'warning' | 'success' | 'danger'> = {
  CREATED: 'warning',
  PAYOUT_CLAIMED: 'info',
  PAYOUT_EXECUTED: 'info',
  PAYOUT_PROOF_SUBMITTED: 'warning',
  SETTLED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'default',
  EXPIRED: 'default',
};

const columns: Column<AdminWithdrawalRecord>[] = [
  {
    key: 'id',
    label: 'Session ID',
    sortable: true,
    width: 'w-[120px]',
    render: (w) => <span className="font-mono text-xs font-bold text-usdt-green">{w.id.substring(0, 8)}...</span>,
  },
  {
    key: 'telegramUserId',
    label: 'User',
    sortable: true,
    width: 'w-[140px]',
    render: (w) => (
      <div className="flex flex-col">
        <span className="text-xs font-bold text-text-primary">
          {w.user?.firstName || `@${w.user?.telegramUsername}` || w.telegramUserId}
        </span>
        <span className="text-[10px] font-mono text-text-tertiary">ID: {w.telegramUserId}</span>
      </div>
    ),
  },
  {
    key: 'requestedAmount',
    label: 'Requested',
    sortable: true,
    width: 'w-[110px]',
    render: (w) => <span className="font-semibold text-xs">${Number(w.requestedAmount || 0).toLocaleString()} USDT</span>,
  },
  {
    key: 'netPayoutAmount',
    label: 'Net Payout',
    sortable: true,
    width: 'w-[110px]',
    render: (w) => (
      <span className="font-extrabold text-xs text-usdt-green">
        ${Number(w.netPayoutAmount || 0).toLocaleString()} USDT
      </span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    width: 'w-[150px]',
    render: (w) => <StatusBadge label={w.status} variant={statusVariant[w.status] || 'default'} dot />,
  },
  {
    key: 'createdAt',
    label: 'Created At',
    sortable: true,
    width: 'w-[140px]',
    render: (w) => <span className="text-xs text-text-tertiary">{new Date(w.createdAt).toLocaleString()}</span>,
  },
];

export const WithdrawalsPage: React.FC = () => {
  const [withdrawalsList, setWithdrawalsList] = useState<AdminWithdrawalRecord[]>([]);
  const [selected, setSelected] = useState<AdminWithdrawalRecord | null>(null);
  const [instructions, setInstructions] = useState<PayoutInstructions | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Input states for actions
  const [reference, setReference] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [proofNotes, setProofNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [overrideFee, setOverrideFee] = useState('');

  const fetchWithdrawals = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminWithdrawalService.listWithdrawals({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      });
      setWithdrawalsList(data.items || []);
    } catch {
      setWithdrawalsList([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  const handleRowClick = async (record: AdminWithdrawalRecord) => {
    setSelected(record);
    try {
      const ins = await adminWithdrawalService.getPayoutInstructions(record.id);
      setInstructions(ins);
    } catch {
      setInstructions(null);
    }
  };

  const handleClaim = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      const updated = await adminWithdrawalService.claimWithdrawal(selected.id);
      showToast('Withdrawal claimed by operator for execution', 'success');
      setSelected(updated);
      fetchWithdrawals();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to claim withdrawal', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkExecuted = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      const updated = await adminWithdrawalService.markExecuted(selected.id, {
        reference: reference.trim() || undefined,
      });
      showToast('Withdrawal marked as executed', 'success');
      setSelected(updated);
      setReference('');
      fetchWithdrawals();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to mark executed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitProof = async () => {
    if (!selected) return;
    if (!proofUrl && !reference) {
      showToast('Proof URL or Reference is required', 'error');
      return;
    }
    setActionLoading(true);
    try {
      const updated = await adminWithdrawalService.submitProof(selected.id, {
        proofUrl: proofUrl.trim() || undefined,
        reference: reference.trim() || undefined,
        notes: proofNotes.trim() || undefined,
      });
      showToast('Payment proof submitted successfully', 'success');
      setSelected(updated);
      setProofUrl('');
      setProofNotes('');
      fetchWithdrawals();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to submit proof', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selected) return;
    if (!window.confirm('Are you sure you want to finalize and settle this withdrawal? This will permanently release the ledger hold.')) {
      return;
    }
    setActionLoading(true);
    try {
      const updated = await adminWithdrawalService.approveAndSettle(selected.id, {
        overrideFee: overrideFee ? Number(overrideFee) : undefined,
      });
      showToast('Withdrawal settled and ledger finalized!', 'success');
      setSelected(updated);
      setOverrideFee('');
      fetchWithdrawals();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Settlement failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    if (!rejectReason.trim()) {
      showToast('Rejection reason is required', 'error');
      return;
    }
    setActionLoading(true);
    try {
      const updated = await adminWithdrawalService.rejectWithdrawal(selected.id, rejectReason.trim());
      showToast('Withdrawal rejected and funds refunded to user wallet', 'info');
      setSelected(updated);
      setRejectReason('');
      fetchWithdrawals();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to reject withdrawal', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetry = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      const updated = await adminWithdrawalService.retrySettlement(selected.id);
      showToast('Settlement retry initiated', 'success');
      setSelected(updated);
      fetchWithdrawals();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Retry failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const pendingCount = withdrawalsList.filter(
    (w) => w.status === 'CREATED' || w.status === 'PAYOUT_CLAIMED' || w.status === 'PAYOUT_PROOF_SUBMITTED',
  ).length;

  const totalSettledUsdt = withdrawalsList
    .filter((w) => w.status === 'SETTLED')
    .reduce((acc, w) => acc + Number(w.netPayoutAmount || 0), 0);

  return (
    <div className="space-y-6">
      {/* ─── 1. HERO SECTION: WITHDRAWALS COCKPIT ────────────────────────────── */}
      <div className="relative overflow-hidden bg-card-bg border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-usdt-green/10 border border-usdt-green/40 text-usdt-green shrink-0 shadow-lg">
              <ArrowUpFromLine size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-usdt-green bg-usdt-green/10 px-2 py-0.5 rounded border border-usdt-green/30">
                  Outbound Capital & Settlement Desk
                </span>
                <span className="text-xs text-text-tertiary">·</span>
                <span className="text-xs text-text-secondary font-mono flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${pendingCount > 0 ? 'bg-amber-400 animate-pulse' : 'bg-usdt-green'}`} />
                  {pendingCount > 0 ? `${pendingCount} Withdrawals In Queue` : 'Queue Clear'}
                </span>
              </div>
              <h1 className="text-xl font-black text-text-primary tracking-tight mt-1">
                Withdrawal & Settlement Workstation
              </h1>
              <p className="text-xs text-text-secondary mt-0.5">
                Multi-signature operator claim workflow, proof verification, fee overrides, and double-entry hold release.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end lg:self-center">
            <button
              onClick={fetchWithdrawals}
              disabled={loading}
              className="p-2.5 rounded-xl bg-control-bg border border-white/10 text-text-secondary hover:text-text-primary disabled:opacity-50 cursor-pointer transition-colors shadow-sm"
              title="Refresh Withdrawals"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Live Withdrawal KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/5 font-mono">
          <div className="p-3.5 rounded-2xl bg-control-bg/60 border border-white/5 space-y-1">
            <span className="text-[10px] font-bold uppercase text-text-tertiary flex items-center gap-1 font-sans">
              <Clock size={12} className="text-amber-400" /> Pending Review
            </span>
            <div className="text-lg font-black text-text-primary">
              {pendingCount} <span className="text-xs text-text-tertiary font-normal font-sans">requests</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-control-bg/60 border border-white/5 space-y-1">
            <span className="text-[10px] font-bold uppercase text-text-tertiary flex items-center gap-1 font-sans">
              <CheckCircle2 size={12} className="text-usdt-green" /> Settled Volume
            </span>
            <div className="text-lg font-black text-usdt-green">
              ${totalSettledUsdt.toLocaleString()} <span className="text-xs text-text-tertiary font-normal font-sans">USDT</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-control-bg/60 border border-white/5 space-y-1">
            <span className="text-[10px] font-bold uppercase text-text-tertiary flex items-center gap-1 font-sans">
              <ShieldAlert size={12} className="text-ton-blue" /> Double-Entry Hold
            </span>
            <div className="text-lg font-black text-text-primary">
              Active Lock
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-control-bg/60 border border-white/5 space-y-1">
            <span className="text-[10px] font-bold uppercase text-text-tertiary flex items-center gap-1 font-sans">
              <RotateCcw size={12} className="text-purple-400" /> Auto Refund Guard
            </span>
            <div className="text-lg font-black text-usdt-green">
              ENABLED
            </div>
          </div>
        </div>
      </div>

      {/* ─── 2. DOMINANT FOCAL POINT: STATUS FILTER & DATA TABLE ──────────────── */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-card-bg p-4 sm:p-5 rounded-3xl border border-white/10 shadow-xl">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {['ALL', 'CREATED', 'PAYOUT_CLAIMED', 'PAYOUT_EXECUTED', 'PAYOUT_PROOF_SUBMITTED', 'SETTLED', 'REJECTED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                  statusFilter === st
                    ? 'bg-usdt-green text-app-bg shadow-sm'
                    : 'bg-control-bg text-text-tertiary hover:text-text-primary border border-white/5'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <span className="text-xs font-mono text-text-tertiary">Click any row to open operator settlement drawer</span>
        </div>

        <div className="bg-card-bg rounded-3xl p-5 border border-white/10 shadow-xl">
          <DataTable
            columns={columns}
            data={withdrawalsList}
            loading={loading}
            onRowClick={handleRowClick}
          />
        </div>
      </div>

      {/* ─── 3. UNIFIED OS CROSS-SYSTEM NAVIGATION HUB (NO DEAD ENDS!) ───────── */}
      <div className="space-y-3">
        <h2 className="text-xs font-black uppercase tracking-wider text-text-secondary flex items-center gap-2">
          <Zap size={14} className="text-usdt-green" /> Unified Control Plane Integrations & Workflows
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Link
            to="/admin/treasury"
            className="group p-4 rounded-2xl bg-card-bg border border-white/10 hover:border-usdt-green/50 transition-all space-y-2 shadow-md"
          >
            <div className="flex items-center justify-between text-usdt-green">
              <Wallet size={18} />
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
            <div className="font-extrabold text-xs text-text-primary">Treasury Liquidity</div>
            <p className="text-[11px] text-text-tertiary">
              Verify reserve vault balances backing fiat and crypto withdrawal disbursements.
            </p>
          </Link>

          <Link
            to="/admin/users"
            className="group p-4 rounded-2xl bg-card-bg border border-white/10 hover:border-ton-blue/50 transition-all space-y-2 shadow-md"
          >
            <div className="flex items-center justify-between text-ton-blue">
              <Users size={18} />
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
            <div className="font-extrabold text-xs text-text-primary">User Accounts Desk</div>
            <p className="text-[11px] text-text-tertiary">
              Inspect user KYC level, trust score, and double-entry transaction history.
            </p>
          </Link>

          <Link
            to="/admin/risk"
            className="group p-4 rounded-2xl bg-card-bg border border-white/10 hover:border-rose-400/50 transition-all space-y-2 shadow-md"
          >
            <div className="flex items-center justify-between text-rose-400">
              <ShieldAlert size={18} />
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
            <div className="font-extrabold text-xs text-text-primary">Risk Sentinel Radar</div>
            <p className="text-[11px] text-text-tertiary">
              Flag users requesting rapid withdrawal bursts across multiple mobile accounts.
            </p>
          </Link>

          <Link
            to="/admin/whatsapp"
            className="group p-4 rounded-2xl bg-card-bg border border-white/10 hover:border-emerald-400/50 transition-all space-y-2 shadow-md"
          >
            <div className="flex items-center justify-between text-emerald-400">
              <MessageSquare size={18} />
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
            <div className="font-extrabold text-xs text-text-primary">WhatsApp Fleet Desk</div>
            <p className="text-[11px] text-text-tertiary">
              Dispatch real-time SMS/WhatsApp payout execution alerts with telco transaction IDs.
            </p>
          </Link>
        </div>
      </div>

      {/* ─── 4. OPERATOR ACTION DRAWER ─────────────────────────────────────────── */}
      <DetailDrawer
        isOpen={!!selected}
        onClose={() => {
          setSelected(null);
          setInstructions(null);
        }}
        title="Withdrawal Session Actions"
        subtitle={`Session ${selected?.id}`}
      >
        {selected && (
          <div className="space-y-6 text-xs font-mono">
            {/* Header summary */}
            <div className="p-4 rounded-2xl bg-control-bg border border-white/5 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-text-tertiary uppercase font-sans">Status</span>
                <StatusBadge label={selected.status} variant={statusVariant[selected.status] || 'default'} dot />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-tertiary uppercase font-sans">Requested Amount</span>
                <span className="font-bold text-text-primary text-sm">${selected.requestedAmount} USDT</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-tertiary uppercase font-sans">Net Payout</span>
                <span className="font-black text-usdt-green text-sm">${selected.netPayoutAmount} USDT</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-tertiary uppercase font-sans">User</span>
                <span className="text-text-primary font-bold">{selected.user?.firstName || selected.telegramUserId}</span>
              </div>
            </div>

            {/* Payout Instructions */}
            {instructions && (
              <div className="p-4 rounded-2xl bg-usdt-green/5 border border-usdt-green/30 space-y-2">
                <h4 className="font-black text-usdt-green text-xs uppercase tracking-wider font-sans">
                  Payout Target Details
                </h4>
                <div className="space-y-1 text-[11px] text-text-secondary">
                  <div>Channel: <strong className="text-text-primary">{instructions.targetChannel}</strong></div>
                  <div>Account: <strong className="text-usdt-green font-mono">{instructions.targetAccount}</strong></div>
                  {instructions.accountHolderName && (
                    <div>Holder: <strong className="text-text-primary">{instructions.accountHolderName}</strong></div>
                  )}
                  <div>Fiat Amount: <strong className="text-text-primary">{instructions.fiatAmount} {instructions.fiatCurrency}</strong></div>
                </div>
              </div>
            )}

            {/* Operator Actions Accordion */}
            <div className="space-y-4 pt-2">
              {/* Action 1: Claim */}
              {selected.status === 'CREATED' && (
                <div className="p-4 rounded-2xl bg-control-bg border border-white/5 space-y-2">
                  <h4 className="font-black text-text-primary text-xs uppercase font-sans flex items-center gap-1.5">
                    <HandMetal size={14} className="text-ton-blue" /> 1. Claim For Execution
                  </h4>
                  <p className="text-[11px] text-text-tertiary font-sans">
                    Assigns this withdrawal to your operator account to prevent duplicate payout attempts.
                  </p>
                  <button
                    onClick={handleClaim}
                    disabled={actionLoading}
                    className="w-full py-2.5 rounded-xl bg-ton-blue text-white font-black text-xs uppercase tracking-wider shadow-md hover:brightness-110 disabled:opacity-50 cursor-pointer"
                  >
                    Claim Withdrawal
                  </button>
                </div>
              )}

              {/* Action 2: Mark Executed */}
              {(selected.status === 'CREATED' || selected.status === 'PAYOUT_CLAIMED') && (
                <div className="p-4 rounded-2xl bg-control-bg border border-white/5 space-y-3">
                  <h4 className="font-black text-text-primary text-xs uppercase font-sans flex items-center gap-1.5">
                    <Send size={14} className="text-usdt-green" /> 2. Mark Executed (Dispatched)
                  </h4>
                  <input
                    type="text"
                    placeholder="Bank / Telco Transaction Reference..."
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="w-full h-10 px-3 bg-app-bg border border-white/10 rounded-xl text-xs text-text-primary focus:border-usdt-green focus:outline-none"
                  />
                  <button
                    onClick={handleMarkExecuted}
                    disabled={actionLoading}
                    className="w-full py-2.5 rounded-xl bg-usdt-green text-app-bg font-black text-xs uppercase tracking-wider shadow-md hover:brightness-110 disabled:opacity-50 cursor-pointer"
                  >
                    Mark Payout Dispatched
                  </button>
                </div>
              )}

              {/* Action 3: Submit Proof */}
              {(selected.status === 'PAYOUT_CLAIMED' || selected.status === 'PAYOUT_EXECUTED') && (
                <div className="p-4 rounded-2xl bg-control-bg border border-white/5 space-y-3">
                  <h4 className="font-black text-text-primary text-xs uppercase font-sans flex items-center gap-1.5">
                    <FileCheck size={14} className="text-purple-400" /> 3. Submit Payout Proof
                  </h4>
                  <input
                    type="text"
                    placeholder="Receipt Image / PDF URL..."
                    value={proofUrl}
                    onChange={(e) => setProofUrl(e.target.value)}
                    className="w-full h-10 px-3 bg-app-bg border border-white/10 rounded-xl text-xs text-text-primary focus:border-usdt-green focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Operator Notes..."
                    value={proofNotes}
                    onChange={(e) => setProofNotes(e.target.value)}
                    className="w-full h-10 px-3 bg-app-bg border border-white/10 rounded-xl text-xs text-text-primary focus:border-usdt-green focus:outline-none"
                  />
                  <button
                    onClick={handleSubmitProof}
                    disabled={actionLoading}
                    className="w-full py-2.5 rounded-xl bg-purple-600 text-white font-black text-xs uppercase tracking-wider shadow-md hover:brightness-110 disabled:opacity-50 cursor-pointer"
                  >
                    Submit Proof
                  </button>
                </div>
              )}

              {/* Action 4: Approve & Settle */}
              {selected.status !== 'SETTLED' && selected.status !== 'REJECTED' && selected.status !== 'CANCELLED' && (
                <div className="p-4 rounded-2xl bg-usdt-green/10 border border-usdt-green/30 space-y-3">
                  <h4 className="font-black text-usdt-green text-xs uppercase font-sans flex items-center gap-1.5">
                    <CheckCircle2 size={14} /> 4. Approve & Finalize Settlement
                  </h4>
                  <p className="text-[11px] text-text-tertiary font-sans">
                    Permanently finalizes double-entry ledger entries and releases the reserved user balance.
                  </p>
                  <input
                    type="number"
                    placeholder="Override Fee (Optional, USDT)..."
                    value={overrideFee}
                    onChange={(e) => setOverrideFee(e.target.value)}
                    className="w-full h-10 px-3 bg-app-bg border border-white/10 rounded-xl text-xs text-text-primary focus:border-usdt-green focus:outline-none"
                  />
                  <button
                    onClick={handleApprove}
                    disabled={actionLoading}
                    className="w-full py-2.5 rounded-xl bg-usdt-green text-app-bg font-black text-xs uppercase tracking-wider shadow-md hover:brightness-110 disabled:opacity-50 cursor-pointer"
                  >
                    Approve & Finalize Settlement
                  </button>
                </div>
              )}

              {/* Action 5: Reject */}
              {selected.status !== 'SETTLED' && selected.status !== 'REJECTED' && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-3">
                  <h4 className="font-black text-rose-400 text-xs uppercase font-sans flex items-center gap-1.5">
                    <XCircle size={14} /> 5. Reject Withdrawal
                  </h4>
                  <p className="text-[11px] text-text-tertiary font-sans">
                    Refunds reserved USDT balance immediately back to the user's wallet.
                  </p>
                  <input
                    type="text"
                    placeholder="Reason for rejection (sent to user)..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-full h-10 px-3 bg-app-bg border border-white/10 rounded-xl text-xs text-text-primary focus:border-rose-400 focus:outline-none"
                  />
                  <button
                    onClick={handleReject}
                    disabled={actionLoading}
                    className="w-full py-2.5 rounded-xl bg-rose-500 text-white font-black text-xs uppercase tracking-wider shadow-md hover:brightness-110 disabled:opacity-50 cursor-pointer"
                  >
                    Reject & Refund User
                  </button>
                </div>
              )}

              {/* Action 6: Retry */}
              {selected.status === 'REJECTED' && (
                <div className="p-4 rounded-2xl bg-control-bg border border-white/5 space-y-2">
                  <h4 className="font-black text-text-primary text-xs uppercase font-sans flex items-center gap-1.5">
                    <RotateCcw size={14} className="text-amber-400" /> 6. Retry Failed Settlement
                  </h4>
                  <button
                    onClick={handleRetry}
                    disabled={actionLoading}
                    className="w-full py-2.5 rounded-xl bg-amber-500 text-app-bg font-black text-xs uppercase tracking-wider shadow-md hover:brightness-110 disabled:opacity-50 cursor-pointer"
                  >
                    Retry Settlement Lifecycle
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
};
