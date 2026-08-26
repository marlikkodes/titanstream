import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { DetailDrawer } from '@/components/admin/DetailDrawer';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { MetricCard, MetricCardGrid } from '@/components/admin/MetricCard';
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

  // Proof form state
  const [showProofForm, setShowProofForm] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [notes, setNotes] = useState('');

  const loadWithdrawals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminWithdrawalService.listWithdrawals({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        limit: 100,
      });
      setWithdrawalsList(res?.items || []);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to load withdrawal queue', 'error');
      setWithdrawalsList([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadWithdrawals();
  }, [loadWithdrawals]);

  const handleSelectRow = async (record: AdminWithdrawalRecord) => {
    setSelected(record);
    setShowProofForm(false);
    setInstructions(null);
    try {
      const inst = await adminWithdrawalService.getPayoutInstructions(record.id);
      setInstructions(inst);
    } catch {
      // Non-blocking
    }
  };

  const handleClaim = async (id: string) => {
    setActionLoading(true);
    try {
      const updated = await adminWithdrawalService.claimWithdrawal(id);
      showToast('Withdrawal successfully claimed for execution', 'success');
      setSelected(updated);
      loadWithdrawals();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to claim withdrawal', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkExecuted = async (id: string) => {
    setActionLoading(true);
    try {
      const updated = await adminWithdrawalService.markExecuted(id);
      showToast('Payout marked as EXECUTED', 'success');
      setSelected(updated);
      loadWithdrawals();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to mark executed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setActionLoading(true);
    try {
      const updated = await adminWithdrawalService.submitProof(selected.id, {
        txHash: txHash.trim(),
        notes: notes.trim(),
      });
      showToast('Payout proof submitted cleanly', 'success');
      setShowProofForm(false);
      setTxHash('');
      setNotes('');
      setSelected(updated);
      loadWithdrawals();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to submit payout proof', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    if (!window.confirm('Confirm approving and settling this withdrawal? Ledger balance will be finalized.')) return;
    setActionLoading(true);
    try {
      const updated = await adminWithdrawalService.approveWithdrawal(id);
      showToast('Withdrawal approved and settled!', 'success');
      setSelected(updated);
      loadWithdrawals();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to approve withdrawal', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Mandatory rejection reason (user will be notified):');
    if (reason === null) return;
    if (!reason.trim()) {
      showToast('Rejection reason is required', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const updated = await adminWithdrawalService.rejectWithdrawal(id, reason.trim());
      showToast('Withdrawal rejected and funds unlocked', 'info');
      setSelected(updated);
      loadWithdrawals();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to reject withdrawal', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetry = async (id: string) => {
    setActionLoading(true);
    try {
      const updated = await adminWithdrawalService.retryPayout(id);
      showToast('Withdrawal re-queued for execution', 'info');
      setSelected(updated);
      loadWithdrawals();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to retry payout', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const pendingCount = withdrawalsList.filter(
    (w) => w.status === 'CREATED' || w.status === 'PAYOUT_CLAIMED' || w.status === 'PAYOUT_PROOF_SUBMITTED',
  ).length;
  const settledCount = withdrawalsList.filter((w) => w.status === 'SETTLED').length;
  const totalVolume = withdrawalsList.reduce((acc, w) => acc + (Number(w.requestedAmount) || 0), 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      <MetricCardGrid columns={3}>
        <MetricCard label="Pending Action" value={pendingCount.toString()} icon="Clock" variant={pendingCount > 0 ? 'gold' : 'green'} />
        <MetricCard label="Settled Payouts" value={settledCount.toString()} icon="CheckCircle" variant="green" />
        <MetricCard label="Total Volume" value={`$${totalVolume.toLocaleString()} USDT`} icon="ArrowUpFromLine" variant="blue" />
      </MetricCardGrid>

      {/* Filter and Refresh Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card-bg p-4 rounded-2xl border border-white/10 shadow-lg">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {['ALL', 'CREATED', 'PAYOUT_CLAIMED', 'PAYOUT_EXECUTED', 'PAYOUT_PROOF_SUBMITTED', 'SETTLED', 'REJECTED'].map(
            (status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-colors cursor-pointer shrink-0 ${
                  statusFilter === status
                    ? 'bg-usdt-green text-app-bg shadow-sm'
                    : 'bg-control-bg text-text-tertiary hover:text-text-primary border border-white/5'
                }`}
              >
                {status}
              </button>
            ),
          )}
        </div>

        <button
          onClick={loadWithdrawals}
          disabled={loading}
          className="p-2 rounded-xl bg-control-bg border border-white/10 hover:bg-white/5 text-text-secondary disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center bg-card-bg rounded-xl border border-white/5 text-xs text-text-tertiary">
          Loading authoritative withdrawal queue...
        </div>
      ) : withdrawalsList.length === 0 ? (
        <div className="p-8 text-center bg-card-bg rounded-xl border border-white/5 space-y-1">
          <p className="text-xs font-bold text-text-primary">No withdrawal requests found</p>
          <p className="text-[11px] text-text-tertiary">Requests matching the selected filter will appear here.</p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={withdrawalsList}
          keyExtractor={(w) => w.id}
          onRowClick={(w) => handleSelectRow(w)}
          searchable
          searchPlaceholder="Search by ID, User, or Amount..."
          pageSize={10}
        />
      )}

      {selected && (
        <DetailDrawer
          isOpen={!!selected}
          onClose={() => setSelected(null)}
          title={`Withdrawal Session #${selected.id.substring(0, 8)}`}
        >
          <div className="space-y-4 text-xs">
            {/* Status & Amount Banner */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-control-bg border border-white/10">
              <StatusBadge label={selected.status} variant={statusVariant[selected.status] || 'default'} dot />
              <div className="text-right">
                <div className="font-extrabold text-sm text-usdt-green">${selected.netPayoutAmount} USDT</div>
                <div className="text-[10px] text-text-tertiary">Gross: ${selected.requestedAmount} | Fee: ${selected.feeAmount}</div>
              </div>
            </div>

            {/* User & Destination Details */}
            <div className="bg-card-bg rounded-xl p-4 border border-white/10 space-y-2.5">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-text-tertiary">Recipient Details</h4>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-text-tertiary">Telegram User:</span>
                  <span className="font-bold text-text-primary">@{selected.user?.telegramUsername || selected.telegramUserId}</span>
                </div>
                {selected.user?.phoneNumber && (
                  <div className="flex justify-between">
                    <span className="text-text-tertiary">Phone Number:</span>
                    <span className="text-text-primary">{selected.user.phoneNumber}</span>
                  </div>
                )}
                {selected.user?.verifiedUsdtAddress && (
                  <div className="space-y-0.5">
                    <span className="text-text-tertiary">Verified USDT Address:</span>
                    <div className="p-2 rounded bg-app-bg text-[10px] text-usdt-green break-all">
                      {selected.user.verifiedUsdtAddress}
                    </div>
                  </div>
                )}
                {selected.networkTxId && (
                  <div className="space-y-0.5">
                    <span className="text-text-tertiary">Transaction Hash:</span>
                    <div className="p-2 rounded bg-app-bg text-[10px] text-ton-blue break-all">
                      {selected.networkTxId}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Payout Instructions Box */}
            {instructions && (
              <div className="bg-control-bg/60 rounded-xl p-4 border border-white/5 space-y-2">
                <h4 className="text-[11px] font-black uppercase tracking-wider text-usdt-green">Authoritative Payout Protocol</h4>
                <div className="space-y-1 text-xs font-mono">
                  <div>Method: <strong className="text-text-primary">{instructions.paymentMethod}</strong></div>
                  <div>Destination: <strong className="text-text-primary">{instructions.destinationAddress}</strong></div>
                  {instructions.ussdPushString && (
                    <div className="p-2 bg-app-bg rounded text-usdt-green text-[11px]">
                      USSD: <code>{instructions.ussdPushString}</code>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons Panel */}
            <div className="space-y-2 pt-2">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-text-tertiary">Administrative Actions</h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {selected.status === 'CREATED' && (
                  <button
                    onClick={() => handleClaim(selected.id)}
                    disabled={actionLoading}
                    className="p-2.5 rounded-xl bg-ton-blue/20 hover:bg-ton-blue/30 text-ton-blue font-extrabold text-xs flex items-center justify-center gap-1.5 border border-ton-blue/40 cursor-pointer disabled:opacity-50"
                  >
                    <HandMetal size={14} /> Claim for Execution
                  </button>
                )}

                {(selected.status === 'CREATED' || selected.status === 'PAYOUT_CLAIMED') && (
                  <button
                    onClick={() => handleMarkExecuted(selected.id)}
                    disabled={actionLoading}
                    className="p-2.5 rounded-xl bg-usdt-green/20 hover:bg-usdt-green/30 text-usdt-green font-extrabold text-xs flex items-center justify-center gap-1.5 border border-usdt-green/40 cursor-pointer disabled:opacity-50"
                  >
                    <Send size={14} /> Mark Executed
                  </button>
                )}

                {(selected.status === 'PAYOUT_CLAIMED' || selected.status === 'PAYOUT_EXECUTED') && (
                  <button
                    onClick={() => setShowProofForm(!showProofForm)}
                    className="p-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 font-extrabold text-xs flex items-center justify-center gap-1.5 border border-amber-500/40 cursor-pointer"
                  >
                    <FileCheck size={14} /> {showProofForm ? 'Cancel Proof' : 'Submit Proof'}
                  </button>
                )}

                {selected.status !== 'SETTLED' && selected.status !== 'REJECTED' && (
                  <button
                    onClick={() => handleApprove(selected.id)}
                    disabled={actionLoading}
                    className="p-2.5 rounded-xl bg-usdt-green text-app-bg font-black text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 size={14} /> Approve & Settle
                  </button>
                )}

                {selected.status !== 'SETTLED' && selected.status !== 'REJECTED' && (
                  <button
                    onClick={() => handleReject(selected.id)}
                    disabled={actionLoading}
                    className="p-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 font-extrabold text-xs flex items-center justify-center gap-1.5 border border-rose-500/40 cursor-pointer disabled:opacity-50"
                  >
                    <XCircle size={14} /> Reject
                  </button>
                )}

                {selected.status === 'REJECTED' && (
                  <button
                    onClick={() => handleRetry(selected.id)}
                    disabled={actionLoading}
                    className="p-2.5 rounded-xl bg-control-bg border border-white/10 text-text-primary font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw size={14} /> Retry Payout
                  </button>
                )}
              </div>

              {/* Submit Proof Inline Form */}
              {showProofForm && (
                <form onSubmit={handleSubmitProof} className="p-3.5 rounded-xl bg-control-bg border border-amber-500/30 space-y-2.5 mt-2">
                  <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <FileCheck size={14} /> Payout Execution Proof
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Blockchain Tx Hash or Telco Ref ID"
                    value={txHash}
                    onChange={(e) => setTxHash(e.target.value)}
                    className="w-full h-9 px-3 bg-app-bg border border-white/10 rounded-lg text-xs font-mono text-text-primary focus:outline-none focus:border-amber-500"
                  />
                  <input
                    type="text"
                    placeholder="Operator Notes (optional)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full h-9 px-3 bg-app-bg border border-white/10 rounded-lg text-xs text-text-primary focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="w-full py-2 rounded-lg bg-amber-500 text-app-bg font-extrabold text-xs shadow-md disabled:opacity-50 cursor-pointer"
                  >
                    Confirm Proof Submission
                  </button>
                </form>
              )}
            </div>
          </div>
        </DetailDrawer>
      )}
    </div>
  );
};
