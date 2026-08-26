import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { MetricCard, MetricCardGrid } from '@/components/admin/MetricCard';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { showToast } from '@/components/Toast';
import {
  Store,
  RefreshCw,
  Plus,
  CheckCircle2,
  XCircle,
  FileText,
  Smartphone,
  CreditCard,
  Send,
  UserCheck,
} from 'lucide-react';

interface MerchantRecord {
  id: string;
  network: string;
  merchantName: string;
  merchantNumber: string;
  country?: string;
  currency?: string;
  status: string;
  dailyLimit?: string | number;
  perTransactionLimit?: string | number;
  createdAt: string;
}

interface PendingClaim {
  claimId: string;
  merchantId: string;
  merchantName?: string;
  transactionReference: string;
  senderPhone?: string;
  amount: number | string;
  currency?: string;
  status: string;
  createdAt: string;
}

export const MerchantsAdminPage: React.FC = () => {
  const [tab, setTab] = useState<'CLAIMS' | 'ROSTER' | 'INGEST'>('CLAIMS');
  const [merchants, setMerchants] = useState<MerchantRecord[]>([]);
  const [claims, setClaims] = useState<PendingClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // New Merchant State
  const [modalOpen, setModalOpen] = useState(false);
  const [merchantName, setMerchantName] = useState('');
  const [merchantNumber, setMerchantNumber] = useState('');
  const [network, setNetwork] = useState('MTN');
  const [country, setCountry] = useState('UG');
  const [dailyLimit, setDailyLimit] = useState('50000');
  const [submitting, setSubmitting] = useState(false);

  // Ingest Transaction State
  const [ingestMerchantId, setIngestMerchantId] = useState('');
  const [ingestNetwork, setIngestNetwork] = useState('MTN');
  const [ingestTxRef, setIngestTxRef] = useState('');
  const [ingestAmount, setIngestAmount] = useState('');
  const [ingestSenderPhone, setIngestSenderPhone] = useState('');
  const [submittingIngest, setSubmittingIngest] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [merchRes, claimsRes] = await Promise.all([
        api.get('/admin/merchant-settlements/merchants').catch(() => null),
        api.get('/admin/merchant-settlements/pending').catch(() => null),
      ]);
      const merchData = merchRes?.data?.data || merchRes?.data;
      const claimsData = claimsRes?.data?.data || claimsRes?.data;
      setMerchants(Array.isArray(merchData) ? merchData : []);
      setClaims(Array.isArray(claimsData) ? claimsData : []);
    } catch {
      setMerchants([]);
      setClaims([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleVerifyAndSettle = async (claimId: string) => {
    if (!window.confirm('Confirm verifying payment and releasing funds to user?')) return;
    setActionLoading(true);
    try {
      await api.post(`/admin/merchant-settlements/claims/${claimId}/verify-and-settle`, {});
      showToast('Payment claim verified and settled into ledger!', 'success');
      fetchData();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Verification failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectClaim = async (claimId: string) => {
    const reason = prompt('Rejection reason (user will be notified):');
    if (reason === null) return;
    setActionLoading(true);
    try {
      await api.post(`/admin/merchant-settlements/claims/${claimId}/reject`, { reason: reason.trim() });
      showToast('Payment claim rejected', 'info');
      fetchData();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to reject claim', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddMerchant = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/admin/merchant-settlements/merchants', {
        merchantName: merchantName.trim(),
        merchantNumber: merchantNumber.trim(),
        network,
        country,
        currency: country === 'UG' ? 'UGX' : 'KES',
        dailyLimit: Number(dailyLimit) || 50000,
        status: 'ACTIVE',
      });
      showToast('Merchant registered cleanly in database!', 'success');
      setModalOpen(false);
      setMerchantName('');
      setMerchantNumber('');
      fetchData();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to add merchant', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleIngestTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingIngest(true);
    try {
      await api.post('/admin/merchant-settlements/transactions/ingest', {
        merchantId: ingestMerchantId.trim() || undefined,
        network: ingestNetwork,
        transactionReference: ingestTxRef.trim(),
        amount: Number(ingestAmount),
        currency: 'UGX',
        senderPhone: ingestSenderPhone.trim() || undefined,
      });
      showToast('Telco transaction ingested! Auto-matching initiated.', 'success');
      setIngestTxRef('');
      setIngestAmount('');
      setIngestSenderPhone('');
      fetchData();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Ingestion failed', 'error');
    } finally {
      setSubmittingIngest(false);
    }
  };

  const handleToggleStatus = async (merchantId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await api.post(`/admin/merchant-settlements/merchants/${merchantId}/status`, { status: nextStatus });
      showToast(`Merchant status updated to ${nextStatus}`, 'info');
      fetchData();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to update merchant status', 'error');
    }
  };

  const activeMerchantsCount = merchants.filter((m) => m.status === 'ACTIVE').length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <MetricCardGrid columns={3}>
        <MetricCard label="Pending Payment Claims" value={claims.length.toString()} icon="FileText" variant={claims.length > 0 ? 'gold' : 'green'} />
        <MetricCard label="Active Merchant Outlets" value={activeMerchantsCount.toString()} icon="Store" variant="green" />
        <MetricCard label="Total Registered Outlets" value={merchants.length.toString()} icon="Smartphone" variant="blue" />
      </MetricCardGrid>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setTab('CLAIMS')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-colors cursor-pointer ${
            tab === 'CLAIMS'
              ? 'bg-usdt-green text-app-bg shadow-md'
              : 'bg-control-bg text-text-secondary border border-white/10 hover:text-text-primary'
          }`}
        >
          Pending Claims Queue ({claims.length})
        </button>
        <button
          onClick={() => setTab('ROSTER')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-colors cursor-pointer ${
            tab === 'ROSTER'
              ? 'bg-usdt-green text-app-bg shadow-md'
              : 'bg-control-bg text-text-secondary border border-white/10 hover:text-text-primary'
          }`}
        >
          Merchant Outlets Roster
        </button>
        <button
          onClick={() => setTab('INGEST')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-colors cursor-pointer ${
            tab === 'INGEST'
              ? 'bg-usdt-green text-app-bg shadow-md'
              : 'bg-control-bg text-text-secondary border border-white/10 hover:text-text-primary'
          }`}
        >
          Telco Transaction Ingest
        </button>
      </div>

      {/* TAB 1: CLAIMS */}
      {tab === 'CLAIMS' && (
        <div className="bg-card-bg rounded-2xl p-4 sm:p-5 border border-white/10 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-text-primary flex items-center gap-2">
                <FileText size={18} className="text-usdt-green" /> Peer-to-Peer Customer Payment Claims
              </h3>
              <p className="text-xs text-text-tertiary mt-0.5">
                Claims submitted by customers with telco transaction IDs requiring operator settlement matching.
              </p>
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-xl bg-control-bg border border-white/10 text-text-secondary hover:text-text-primary disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="space-y-3">
            {claims.map((cl) => (
              <div
                key={cl.claimId}
                className="p-4 rounded-xl bg-control-bg border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-text-primary">TxRef: {cl.transactionReference}</span>
                    <span className="text-usdt-green font-extrabold">{Number(cl.amount).toLocaleString()} {cl.currency || 'UGX'}</span>
                  </div>
                  <div className="text-[11px] text-text-tertiary">
                    Sender: {cl.senderPhone || 'Unknown'} · Merchant: {cl.merchantName || cl.merchantId} · Date: {new Date(cl.createdAt).toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleVerifyAndSettle(cl.claimId)}
                    disabled={actionLoading}
                    className="px-3 py-1.5 rounded-xl bg-usdt-green text-app-bg font-extrabold text-xs shadow hover:brightness-110 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 size={14} /> Verify & Settle
                  </button>
                  <button
                    onClick={() => handleRejectClaim(cl.claimId)}
                    disabled={actionLoading}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-extrabold text-xs border border-rose-500/30 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <XCircle size={14} /> Reject
                  </button>
                </div>
              </div>
            ))}

            {claims.length === 0 && !loading && (
              <div className="p-8 text-center bg-control-bg rounded-xl border border-white/5 space-y-1 text-xs text-text-tertiary">
                No pending customer payment claims awaiting verification.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ROSTER */}
      {tab === 'ROSTER' && (
        <div className="bg-card-bg rounded-2xl p-4 sm:p-5 border border-white/10 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-sm font-extrabold text-text-primary flex items-center gap-2">
              <Store size={18} className="text-usdt-green" /> Registered Merchant Outlets
            </h3>
            <button
              onClick={() => setModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-usdt-green text-app-bg font-extrabold text-xs flex items-center gap-1.5 shadow cursor-pointer hover:brightness-110"
            >
              <Plus size={14} /> Onboard Merchant
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {merchants.map((m) => (
              <div
                key={m.id}
                className="p-4 rounded-xl bg-control-bg border border-white/5 space-y-2 text-xs font-mono"
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-text-primary">{m.merchantName}</span>
                  <StatusBadge label={m.status} variant={m.status === 'ACTIVE' ? 'success' : 'danger'} dot />
                </div>
                <div className="space-y-0.5 text-text-secondary">
                  <div>Code: <strong className="text-usdt-green">{m.merchantNumber}</strong></div>
                  <div>Network: {m.network} ({m.country})</div>
                  <div>Daily Cap: ${Number(m.dailyLimit || 0).toLocaleString()}</div>
                </div>
                <div className="pt-2 border-t border-white/5 flex justify-end">
                  <button
                    onClick={() => handleToggleStatus(m.id, m.status)}
                    className="text-[10px] font-bold px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-text-primary cursor-pointer"
                  >
                    {m.status === 'ACTIVE' ? 'Suspend Outlet' : 'Activate Outlet'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: INGEST */}
      {tab === 'INGEST' && (
        <div className="bg-card-bg rounded-2xl p-5 border border-white/10 space-y-4 shadow-xl max-w-lg">
          <h3 className="text-sm font-extrabold text-text-primary flex items-center gap-2">
            <Smartphone size={18} className="text-ton-blue" /> Direct Telco Payment Ingestion
          </h3>
          <p className="text-xs text-text-tertiary">
            Simulate or ingest a received mobile money confirmation SMS from telco gateway for instant customer claim reconciliation.
          </p>

          <form onSubmit={handleIngestTransaction} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-text-tertiary">Network</label>
                <select
                  value={ingestNetwork}
                  onChange={(e) => setIngestNetwork(e.target.value)}
                  className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-text-primary"
                >
                  <option value="MTN">MTN Mobile Money</option>
                  <option value="AIRTEL">Airtel Money</option>
                  <option value="MPESA">M-Pesa</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-text-tertiary">Amount (Local Fiat)</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 50000"
                  value={ingestAmount}
                  onChange={(e) => setIngestAmount(e.target.value)}
                  className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-text-primary font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-text-tertiary">Telco Transaction Reference (TxID)</label>
              <input
                type="text"
                required
                placeholder="e.g. 19283748291"
                value={ingestTxRef}
                onChange={(e) => setIngestTxRef(e.target.value)}
                className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-text-primary font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-text-tertiary">Sender Phone (Optional)</label>
              <input
                type="text"
                placeholder="e.g. 256771234567"
                value={ingestSenderPhone}
                onChange={(e) => setIngestSenderPhone(e.target.value)}
                className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-text-primary font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={submittingIngest}
              className="w-full py-2.5 rounded-xl bg-ton-blue text-white font-extrabold text-xs shadow-md hover:brightness-110 disabled:opacity-50 cursor-pointer"
            >
              {submittingIngest ? 'Ingesting Transaction...' : 'Ingest & Match Payment'}
            </button>
          </form>
        </div>
      )}

      {/* Onboard Merchant Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md bg-app-bg border border-white/10 rounded-3xl p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-extrabold text-text-primary">Onboard Merchant Outlet</h3>
            <form onSubmit={handleAddMerchant} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-text-tertiary">Outlet / Merchant Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kampala Central Express"
                  value={merchantName}
                  onChange={(e) => setMerchantName(e.target.value)}
                  className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-text-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-text-tertiary">Merchant Till / Agent Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 612891"
                  value={merchantNumber}
                  onChange={(e) => setMerchantNumber(e.target.value)}
                  className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-text-primary font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-text-tertiary">Network</label>
                  <select
                    value={network}
                    onChange={(e) => setNetwork(e.target.value)}
                    className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-text-primary"
                  >
                    <option value="MTN">MTN</option>
                    <option value="AIRTEL">Airtel</option>
                    <option value="MPESA">M-Pesa</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-text-tertiary">Country</label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-text-primary"
                  >
                    <option value="UG">Uganda (UG)</option>
                    <option value="KE">Kenya (KE)</option>
                    <option value="TZ">Tanzania (TZ)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-text-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-usdt-green text-app-bg font-extrabold text-xs shadow hover:brightness-110 disabled:opacity-50"
                >
                  {submitting ? 'Registering...' : 'Register Merchant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
