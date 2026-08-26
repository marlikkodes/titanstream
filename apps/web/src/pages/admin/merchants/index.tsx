import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/services/api';
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
  ArrowRight,
  Wallet,
  Layers,
  MessageSquare,
  ShieldCheck,
  Zap,
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
    <div className="space-y-6">
      {/* ─── 1. HERO SECTION: SETTLEMENT COCKPIT ─────────────────────────────── */}
      <div className="relative overflow-hidden bg-card-bg border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-usdt-green/10 border border-usdt-green/40 text-usdt-green shrink-0 shadow-lg">
              <Store size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-usdt-green bg-usdt-green/10 px-2 py-0.5 rounded border border-usdt-green/30">
                  Peer-to-Peer Fiat Settlement Desk
                </span>
                <span className="text-xs text-text-tertiary">·</span>
                <span className="text-xs text-text-secondary font-mono flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${claims.length > 0 ? 'bg-amber-400 animate-pulse' : 'bg-usdt-green'}`} />
                  {claims.length > 0 ? `${claims.length} Claims Awaiting Match` : 'Claims Queue Clear'}
                </span>
              </div>
              <h1 className="text-xl font-black text-text-primary tracking-tight mt-1">
                Merchant Settlement & Peer-to-Peer Fulfillment
              </h1>
              <p className="text-xs text-text-secondary mt-0.5">
                Reconciliation engine matching customer telco deposit claims with verified merchant till accounts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end lg:self-center">
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2.5 rounded-xl bg-control-bg border border-white/10 text-text-secondary hover:text-text-primary disabled:opacity-50 cursor-pointer transition-colors shadow-sm"
              title="Refresh Settlement Data"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Live Settlement KPI Matrix */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-white/5">
          <div className="p-3.5 rounded-2xl bg-control-bg/60 border border-white/5 space-y-1">
            <span className="text-[10px] font-bold uppercase text-text-tertiary flex items-center gap-1">
              <FileText size={12} className="text-amber-400" /> Pending Claims Queue
            </span>
            <div className="text-lg font-black font-mono text-text-primary">
              {claims.length} <span className="text-xs text-text-tertiary font-normal">claims</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-control-bg/60 border border-white/5 space-y-1">
            <span className="text-[10px] font-bold uppercase text-text-tertiary flex items-center gap-1">
              <Store size={12} className="text-usdt-green" /> Active Outlets
            </span>
            <div className="text-lg font-black font-mono text-usdt-green">
              {activeMerchantsCount} <span className="text-xs text-text-tertiary font-normal">/ {merchants.length} registered</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-control-bg/60 border border-white/5 space-y-1">
            <span className="text-[10px] font-bold uppercase text-text-tertiary flex items-center gap-1">
              <ShieldCheck size={12} className="text-ton-blue" /> Ingestion Pipeline
            </span>
            <div className="text-lg font-black font-mono text-text-primary">
              Real-Time
            </div>
          </div>
        </div>
      </div>

      {/* ─── 2. NAVIGATION TABS ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setTab('CLAIMS')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            tab === 'CLAIMS'
              ? 'bg-usdt-green text-app-bg shadow-lg shadow-usdt-green/20'
              : 'bg-control-bg text-text-secondary border border-white/10 hover:text-text-primary'
          }`}
        >
          Pending Claims Queue ({claims.length})
        </button>
        <button
          onClick={() => setTab('ROSTER')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            tab === 'ROSTER'
              ? 'bg-usdt-green text-app-bg shadow-lg shadow-usdt-green/20'
              : 'bg-control-bg text-text-secondary border border-white/10 hover:text-text-primary'
          }`}
        >
          Merchant Outlets Roster ({merchants.length})
        </button>
        <button
          onClick={() => setTab('INGEST')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            tab === 'INGEST'
              ? 'bg-usdt-green text-app-bg shadow-lg shadow-usdt-green/20'
              : 'bg-control-bg text-text-secondary border border-white/10 hover:text-text-primary'
          }`}
        >
          Telco Transaction Ingest
        </button>
      </div>

      {/* ─── 3. TAB 1: CLAIMS QUEUE ──────────────────────────────────────────── */}
      {tab === 'CLAIMS' && (
        <div className="bg-card-bg rounded-3xl p-5 sm:p-6 border border-white/10 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h3 className="text-sm font-black text-text-primary flex items-center gap-2">
                <FileText size={16} className="text-usdt-green" /> Peer-to-Peer Customer Deposit Claims
              </h3>
              <p className="text-xs text-text-tertiary mt-0.5">
                Claims submitted by customers with telco transaction IDs requiring operator settlement verification.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {claims.map((cl) => (
              <div
                key={cl.claimId}
                className="p-4 rounded-2xl bg-control-bg border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono shadow-sm hover:border-white/10 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-text-primary">TxRef: {cl.transactionReference}</span>
                    <span className="text-usdt-green font-black text-sm">
                      {Number(cl.amount).toLocaleString()} {cl.currency || 'UGX'}
                    </span>
                  </div>
                  <div className="text-[11px] text-text-tertiary">
                    Sender: <strong>{cl.senderPhone || 'Unknown Phone'}</strong> · Merchant: <strong>{cl.merchantName || cl.merchantId}</strong> · Date: {new Date(cl.createdAt).toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => handleVerifyAndSettle(cl.claimId)}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-xl bg-usdt-green text-app-bg font-black text-xs uppercase tracking-wider shadow-md hover:brightness-110 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-transform active:scale-95"
                  >
                    <CheckCircle2 size={14} /> Verify & Settle
                  </button>
                  <button
                    onClick={() => handleRejectClaim(cl.claimId)}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-black text-xs uppercase tracking-wider border border-rose-500/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <XCircle size={14} /> Reject
                  </button>
                </div>
              </div>
            ))}

            {claims.length === 0 && !loading && (
              <div className="p-8 text-center bg-control-bg rounded-2xl border border-white/5 space-y-1">
                <p className="text-xs font-bold text-text-primary">No pending customer payment claims</p>
                <p className="text-[11px] text-text-tertiary">All peer-to-peer mobile money claims have been reconciled.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── 4. TAB 2: MERCHANT ROSTER ───────────────────────────────────────── */}
      {tab === 'ROSTER' && (
        <div className="bg-card-bg rounded-3xl p-5 sm:p-6 border border-white/10 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h3 className="text-sm font-black text-text-primary flex items-center gap-2">
                <Store size={16} className="text-usdt-green" /> Registered Merchant Outlets ({merchants.length})
              </h3>
              <p className="text-xs text-text-tertiary mt-0.5">
                Authorized mobile money merchant agents receiving customer local currency deposits.
              </p>
            </div>
            <button
              onClick={() => setModalOpen(true)}
              className="px-4 py-2 rounded-2xl bg-usdt-green text-app-bg font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md cursor-pointer hover:brightness-110"
            >
              <Plus size={14} /> Onboard Outlet
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {merchants.map((m) => (
              <div
                key={m.id}
                className="p-4 rounded-2xl bg-control-bg border border-white/5 space-y-3 text-xs font-mono shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-text-primary text-sm">{m.merchantName}</span>
                  <StatusBadge label={m.status} variant={m.status === 'ACTIVE' ? 'success' : 'danger'} dot />
                </div>
                <div className="space-y-1 text-text-secondary text-[11px]">
                  <div>Till/Agent Code: <strong className="text-usdt-green font-mono">{m.merchantNumber}</strong></div>
                  <div>Network: <strong>{m.network}</strong> ({m.country})</div>
                  <div>Daily Cap: <strong>${Number(m.dailyLimit || 0).toLocaleString()}</strong></div>
                </div>
                <div className="pt-2 border-t border-white/5 flex justify-end">
                  <button
                    onClick={() => handleToggleStatus(m.id, m.status)}
                    className="text-[10px] font-bold px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-text-primary cursor-pointer transition-colors"
                  >
                    {m.status === 'ACTIVE' ? 'Suspend Outlet' : 'Activate Outlet'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── 5. TAB 3: INGEST TRANSACTIONS ───────────────────────────────────── */}
      {tab === 'INGEST' && (
        <div className="bg-card-bg rounded-3xl p-5 sm:p-6 border border-white/10 space-y-4 shadow-xl max-w-lg">
          <h3 className="text-sm font-black text-text-primary flex items-center gap-2">
            <Smartphone size={18} className="text-ton-blue" /> Direct Telco Payment Ingestion Engine
          </h3>
          <p className="text-xs text-text-tertiary">
            Simulate or ingest a received mobile money confirmation SMS from telco gateway for instant customer claim reconciliation.
          </p>

          <form onSubmit={handleIngestTransaction} className="space-y-3 text-xs font-mono">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-text-tertiary">Network</label>
                <select
                  value={ingestNetwork}
                  onChange={(e) => setIngestNetwork(e.target.value)}
                  className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-text-primary focus:border-usdt-green focus:outline-none"
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
                  className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-text-primary focus:border-usdt-green focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-text-tertiary">Telco TxID Reference</label>
              <input
                type="text"
                required
                placeholder="e.g. 19283748291"
                value={ingestTxRef}
                onChange={(e) => setIngestTxRef(e.target.value)}
                className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-text-primary focus:border-usdt-green focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-text-tertiary">Sender Phone (Optional)</label>
              <input
                type="text"
                placeholder="e.g. 256771234567"
                value={ingestSenderPhone}
                onChange={(e) => setIngestSenderPhone(e.target.value)}
                className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-text-primary focus:border-usdt-green focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submittingIngest}
              className="w-full py-2.5 rounded-xl bg-ton-blue text-white font-black text-xs uppercase tracking-wider shadow-lg hover:brightness-110 disabled:opacity-50 cursor-pointer"
            >
              {submittingIngest ? 'Ingesting Transaction...' : 'Ingest & Match Payment'}
            </button>
          </form>
        </div>
      )}

      {/* ─── 6. UNIFIED OS CROSS-SYSTEM NAVIGATION HUB (NO DEAD ENDS!) ───────── */}
      <div className="space-y-3">
        <h2 className="text-xs font-black uppercase tracking-wider text-text-secondary flex items-center gap-2">
          <Zap size={14} className="text-usdt-green" /> Unified Control Plane Integrations & Workflows
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Link
            to="/admin/payment-rails"
            className="group p-4 rounded-2xl bg-card-bg border border-white/10 hover:border-usdt-green/50 transition-all space-y-2 shadow-md"
          >
            <div className="flex items-center justify-between text-usdt-green">
              <Smartphone size={18} />
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
            <div className="font-extrabold text-xs text-text-primary">Payment Rails Registry</div>
            <p className="text-[11px] text-text-tertiary">
              Configure country codes, network prefixes, and USSD push dialing codes.
            </p>
          </Link>

          <Link
            to="/admin/treasury"
            className="group p-4 rounded-2xl bg-card-bg border border-white/10 hover:border-ton-blue/50 transition-all space-y-2 shadow-md"
          >
            <div className="flex items-center justify-between text-ton-blue">
              <Wallet size={18} />
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
            <div className="font-extrabold text-xs text-text-primary">Treasury Liquidity</div>
            <p className="text-[11px] text-text-tertiary">
              Monitor vault reserves and crypto wallet backing for merchant claims.
            </p>
          </Link>

          <Link
            to="/admin/orders"
            className="group p-4 rounded-2xl bg-card-bg border border-white/10 hover:border-purple-400/50 transition-all space-y-2 shadow-md"
          >
            <div className="flex items-center justify-between text-purple-400">
              <Layers size={18} />
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
            <div className="font-extrabold text-xs text-text-primary">Payment Orders Desk</div>
            <p className="text-[11px] text-text-tertiary">
              Track universal payment orders through their complete lifecycle state machine.
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
              Ensure delivery sockets are active to dispatch deposit settlement confirmations.
            </p>
          </Link>
        </div>
      </div>

      {/* ─── 7. ONBOARD MERCHANT MODAL ─────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-app-bg border border-usdt-green/40 rounded-3xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-black text-text-primary flex items-center gap-2">
              <Store size={18} className="text-usdt-green" /> Onboard Merchant Outlet
            </h3>
            <form onSubmit={handleAddMerchant} className="space-y-3 text-xs font-mono">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-text-tertiary">Outlet Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kampala Central Express"
                  value={merchantName}
                  onChange={(e) => setMerchantName(e.target.value)}
                  className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-text-primary focus:border-usdt-green focus:outline-none font-sans"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-text-tertiary">Till / Agent Code Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 612891"
                  value={merchantNumber}
                  onChange={(e) => setMerchantNumber(e.target.value)}
                  className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-text-primary focus:border-usdt-green focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-text-tertiary">Network</label>
                  <select
                    value={network}
                    onChange={(e) => setNetwork(e.target.value)}
                    className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-text-primary focus:border-usdt-green focus:outline-none"
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
                    className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-text-primary focus:border-usdt-green focus:outline-none"
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
                  className="px-4 py-2 rounded-xl bg-usdt-green text-app-bg font-black text-xs uppercase tracking-wider shadow-lg hover:brightness-110 disabled:opacity-50"
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
