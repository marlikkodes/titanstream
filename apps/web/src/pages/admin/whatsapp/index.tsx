import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/services/api';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { showToast } from '@/components/Toast';
import {
  MessageSquare,
  RefreshCw,
  Plus,
  Radio,
  Power,
  Key,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Smartphone,
  RotateCw,
  Send,
  Bell,
  Users,
  Activity,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Layers,
  Copy,
  Clock,
} from 'lucide-react';

interface WhatsappMetrics {
  lastConnectedAt?: string;
  lastMessageAt?: string;
  lastSuccessfulMessageAt?: string;
  messageSuccesses: number;
  messageFailures: number;
  authenticationFailures: number;
}

interface WhatsappAccount {
  accountId: string;
  displayName: string;
  phone: string;
  state: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'QUARANTINED' | 'DISABLED';
  healthState: 'HEALTHY' | 'DEGRADED' | 'QUARANTINED';
  isEnabled: boolean;
  isQuarantined: boolean;
  pairingCode?: string;
  metrics?: WhatsappMetrics;
  lastConnectedAt?: string;
}

interface FleetTelemetry {
  queueDepth: number;
  maxQueueDepth: number;
  activeSends: number;
  maxConcurrency: number;
  minSendIntervalMs: number;
  totalAccounts: number;
  connectedAccounts: number;
  degradedAccounts: number;
  quarantinedAccounts: number;
  totalDispatched: number;
  totalSuccess: number;
  totalFailures: number;
  successRatePercent: number;
}

const stateBadgeVariant: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  CONNECTED: 'success',
  CONNECTING: 'warning',
  DISCONNECTED: 'default',
  QUARANTINED: 'danger',
  DISABLED: 'default',
};

const healthBadgeVariant: Record<string, 'success' | 'warning' | 'danger'> = {
  HEALTHY: 'success',
  DEGRADED: 'warning',
  QUARANTINED: 'danger',
};

export const WhatsappAdminPage: React.FC = () => {
  const [accounts, setAccounts] = useState<WhatsappAccount[]>([]);
  const [telemetry, setTelemetry] = useState<FleetTelemetry | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals & Panels
  const [newPhone, setNewPhone] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [submittingAccount, setSubmittingAccount] = useState(false);
  const [pairingModalData, setPairingModalData] = useState<{ accountId: string; phone: string; code: string } | null>(null);

  // Test Dispatch State
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Titan Stream 🔐 Real-Time WhatsApp Fleet Verification Ping');
  const [testPriority, setTestPriority] = useState<'CRITICAL' | 'HIGH' | 'NORMAL'>('HIGH');
  const [dispatchingTest, setDispatchingTest] = useState(false);
  const [lastDispatchResult, setLastDispatchResult] = useState<any>(null);

  const fetchFleetData = useCallback(async () => {
    setLoading(true);
    try {
      const [accRes, telRes] = await Promise.all([
        api.get('/admin/whatsapp/accounts'),
        api.get('/admin/whatsapp/accounts/telemetry').catch(() => null),
      ]);
      const list = accRes.data?.data || accRes.data || [];
      setAccounts(Array.isArray(list) ? list : []);
      if (telRes?.data?.data) {
        setTelemetry(telRes.data.data);
      }
    } catch (err: any) {
      console.warn('Failed to load fleet data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFleetData();
    const interval = setInterval(fetchFleetData, 10000);
    return () => clearInterval(interval);
  }, [fetchFleetData]);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhone.trim()) {
      showToast('Phone number is required', 'error');
      return;
    }
    setSubmittingAccount(true);
    try {
      await api.post('/admin/whatsapp/accounts', {
        phone: newPhone.trim(),
        displayName: newDisplayName.trim() || undefined,
      });
      showToast('WhatsApp transport line registered successfully!', 'success');
      setNewPhone('');
      setNewDisplayName('');
      fetchFleetData();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to register WhatsApp line', 'error');
    } finally {
      setSubmittingAccount(false);
    }
  };

  const handleExecuteAction = async (
    accountId: string,
    action: 'connect' | 'disconnect' | 'reconnect' | 'enable' | 'disable' | 'quarantine' | 'unquarantine' | 'remove',
  ) => {
    if (action === 'remove' && !window.confirm('Confirm removing this WhatsApp transport socket?')) return;
    setActionLoading(true);
    try {
      await api.post(`/admin/whatsapp/accounts/${accountId}/action`, { action });
      showToast(`Action "${action.toUpperCase()}" executed cleanly on line ${accountId}`, 'success');
      fetchFleetData();
    } catch (err: any) {
      showToast(err?.response?.data?.message || `Failed to execute ${action}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestPairingCode = async (accountId: string, phone: string) => {
    try {
      const res = await api.post(`/admin/whatsapp/accounts/${accountId}/pairing-code`, { phone });
      const code = res.data?.data?.pairingCode || res.data?.pairingCode || res.data?.data;
      setPairingModalData({ accountId, phone, code: String(code) });
      showToast(`Pairing code generated: ${code}`, 'success');
      fetchFleetData();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to generate pairing code', 'error');
    }
  };

  const handleTestDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim()) {
      showToast('Recipient phone number required for test dispatch', 'error');
      return;
    }
    setDispatchingTest(true);
    setLastDispatchResult(null);
    try {
      const res = await api.post('/admin/whatsapp/accounts/test-dispatch', {
        phone: testPhone.trim(),
        text: testMessage.trim(),
        priority: testPriority,
      });
      setLastDispatchResult(res.data?.data || res.data);
      showToast('Live test message dispatched through transport fleet!', 'success');
      fetchFleetData();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Test dispatch failed', 'error');
      setLastDispatchResult({ success: false, error: err?.response?.data?.message || 'Failed' });
    } finally {
      setDispatchingTest(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!', 'info');
  };

  const connectedCount = accounts.filter((a) => a.state === 'CONNECTED').length;
  const quarantinedCount = accounts.filter((a) => a.isQuarantined || a.state === 'QUARANTINED').length;

  return (
    <div className="space-y-6">
      {/* ─── 1. HERO SECTION: FLEET TOPOLOGY & TELEMETRY COCKPIT ──────────────── */}
      <div className="relative overflow-hidden bg-card-bg border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-usdt-green/10 border border-usdt-green/40 text-usdt-green shrink-0 shadow-lg">
              <MessageSquare size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-usdt-green bg-usdt-green/10 px-2 py-0.5 rounded border border-usdt-green/30">
                  Communications Control Plane
                </span>
                <span className="text-xs text-text-tertiary">·</span>
                <span className="text-xs text-text-secondary font-mono flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${connectedCount > 0 ? 'bg-usdt-green animate-pulse' : 'bg-amber-400'}`} />
                  {connectedCount > 0 ? 'Fleet Online & Active' : 'Fleet Standby'}
                </span>
              </div>
              <h1 className="text-xl font-black text-text-primary tracking-tight mt-1">
                WhatsApp Multi-Device Fleet Command
              </h1>
              <p className="text-xs text-text-secondary mt-0.5">
                Authoritative Baileys transport socket fleet routing real-time security OTPs, yield alerts, and payment webhooks.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end lg:self-center">
            <button
              onClick={fetchFleetData}
              disabled={loading}
              className="p-2.5 rounded-xl bg-control-bg border border-white/10 text-text-secondary hover:text-text-primary disabled:opacity-50 cursor-pointer transition-colors shadow-sm"
              title="Refresh Fleet Status"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Live Telemetry KPI Matrix */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/5">
          <div className="p-3.5 rounded-2xl bg-control-bg/60 border border-white/5 space-y-1">
            <span className="text-[10px] font-bold uppercase text-text-tertiary flex items-center gap-1">
              <Radio size={12} className="text-usdt-green" /> Sockets Active
            </span>
            <div className="text-lg font-black font-mono text-text-primary">
              {connectedCount} <span className="text-xs text-text-tertiary font-normal">/ {accounts.length} lines</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-control-bg/60 border border-white/5 space-y-1">
            <span className="text-[10px] font-bold uppercase text-text-tertiary flex items-center gap-1">
              <Zap size={12} className="text-ton-blue" /> Delivery Rate
            </span>
            <div className="text-lg font-black font-mono text-usdt-green">
              {telemetry?.successRatePercent ?? 100}%
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-control-bg/60 border border-white/5 space-y-1">
            <span className="text-[10px] font-bold uppercase text-text-tertiary flex items-center gap-1">
              <Layers size={12} className="text-amber-400" /> Outbound Queue
            </span>
            <div className="text-lg font-black font-mono text-text-primary">
              {telemetry?.queueDepth ?? 0} <span className="text-xs text-text-tertiary font-normal">/ {telemetry?.maxQueueDepth ?? 1000}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-control-bg/60 border border-white/5 space-y-1">
            <span className="text-[10px] font-bold uppercase text-text-tertiary flex items-center gap-1">
              <Clock size={12} className="text-purple-400" /> Dispatch Pacing
            </span>
            <div className="text-lg font-black font-mono text-text-primary">
              {telemetry?.minSendIntervalMs ?? 300}<span className="text-xs text-text-tertiary font-normal">ms</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 2. DOMINANT FOCAL POINT: LIVE TRANSPORT SOCKET FLEET MATRIX ─────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-wider text-text-secondary flex items-center gap-2">
            <Activity size={14} className="text-usdt-green" /> Managed Transport Sockets ({accounts.length})
          </h2>
          <span className="text-[11px] font-mono text-text-tertiary">Auto-reconnects every 15s via persistent database auth</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((acc) => (
            <div
              key={acc.accountId}
              className={`relative bg-card-bg rounded-3xl p-5 border transition-all space-y-4 shadow-xl ${
                acc.state === 'CONNECTED'
                  ? 'border-usdt-green/30 hover:border-usdt-green/50'
                  : acc.isQuarantined || acc.state === 'QUARANTINED'
                    ? 'border-rose-500/40 bg-rose-500/5'
                    : 'border-white/10'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${acc.state === 'CONNECTED' ? 'bg-usdt-green animate-pulse' : 'bg-rose-400'}`} />
                    <h3 className="font-black text-sm text-text-primary tracking-tight">{acc.displayName || acc.phone}</h3>
                  </div>
                  <div className="text-xs font-mono text-usdt-green font-bold flex items-center gap-1.5">
                    <Smartphone size={12} /> {acc.phone}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <StatusBadge label={acc.state} variant={stateBadgeVariant[acc.state] || 'default'} dot />
                  {acc.healthState && (
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                      acc.healthState === 'HEALTHY'
                        ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                        : 'border-amber-500/30 text-amber-400 bg-amber-500/10'
                    }`}>
                      {acc.healthState}
                    </span>
                  )}
                </div>
              </div>

              {/* Line Telemetry Metrics */}
              <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-control-bg border border-white/5 text-center font-mono">
                <div>
                  <div className="text-[10px] uppercase text-text-tertiary">Delivered</div>
                  <div className="text-xs font-black text-usdt-green mt-0.5">{acc.metrics?.messageSuccesses || 0}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-text-tertiary">Failed</div>
                  <div className="text-xs font-black text-rose-400 mt-0.5">{acc.metrics?.messageFailures || 0}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-text-tertiary">Auth Errors</div>
                  <div className="text-xs font-black text-amber-400 mt-0.5">{acc.metrics?.authenticationFailures || 0}</div>
                </div>
              </div>

              {/* Pairing Status Banner */}
              {acc.pairingCode && (
                <div className="p-2.5 rounded-xl bg-usdt-green/10 border border-usdt-green/30 flex items-center justify-between">
                  <div className="text-[11px] font-mono text-usdt-green">
                    Active Pairing: <strong>{acc.pairingCode}</strong>
                  </div>
                  <button
                    onClick={() => copyToClipboard(acc.pairingCode!)}
                    className="p-1 rounded text-usdt-green hover:bg-usdt-green/20 cursor-pointer"
                  >
                    <Copy size={12} />
                  </button>
                </div>
              )}

              {/* Action Toolbar */}
              <div className="space-y-2 pt-2 border-t border-white/5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => handleExecuteAction(acc.accountId, acc.state === 'CONNECTED' ? 'disconnect' : 'connect')}
                    disabled={actionLoading}
                    className="px-2.5 py-1.5 rounded-xl bg-control-bg text-text-primary hover:bg-white/10 text-[11px] font-extrabold border border-white/10 flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    <Power size={12} /> {acc.state === 'CONNECTED' ? 'Disconnect' : 'Connect'}
                  </button>

                  <button
                    onClick={() => handleExecuteAction(acc.accountId, 'reconnect')}
                    disabled={actionLoading}
                    className="px-2.5 py-1.5 rounded-xl bg-control-bg text-text-primary hover:bg-white/10 text-[11px] font-extrabold border border-white/10 flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    <RotateCw size={12} /> Reconnect
                  </button>

                  <button
                    onClick={() => handleRequestPairingCode(acc.accountId, acc.phone)}
                    className="px-2.5 py-1.5 rounded-xl bg-ton-blue/20 text-ton-blue hover:bg-ton-blue/30 text-[11px] font-extrabold border border-ton-blue/30 flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Key size={12} /> Pairing Code
                  </button>

                  <button
                    onClick={() => handleExecuteAction(acc.accountId, acc.isQuarantined ? 'unquarantine' : 'quarantine')}
                    disabled={actionLoading}
                    className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[11px] font-extrabold border border-amber-500/30 flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    <ShieldAlert size={12} /> {acc.isQuarantined ? 'Release' : 'Quarantine'}
                  </button>

                  <button
                    onClick={() => handleExecuteAction(acc.accountId, 'remove')}
                    disabled={actionLoading}
                    className="p-1.5 rounded-xl bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30 flex items-center justify-center cursor-pointer shadow-sm ml-auto disabled:opacity-50"
                    title="Remove Account"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {accounts.length === 0 && !loading && (
            <div className="col-span-full p-8 text-center bg-card-bg rounded-3xl border border-white/5 space-y-2">
              <p className="text-sm font-bold text-text-primary">No WhatsApp transport sockets configured</p>
              <p className="text-xs text-text-tertiary">Register a primary phone number below to start dispatching OTPs and notifications.</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── 3. INTERACTIVE DISPATCHER & NEW LINE REGISTRATION ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Test Message Dispatch Console */}
        <div className="bg-card-bg rounded-3xl p-5 sm:p-6 border border-white/10 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h3 className="text-sm font-black text-text-primary flex items-center gap-2">
                <Send size={16} className="text-usdt-green" /> Interactive Transport Dispatcher
              </h3>
              <p className="text-xs text-text-tertiary mt-0.5">
                Send an immediate real-time verification ping through the active fleet to verify socket delivery.
              </p>
            </div>
          </div>

          <form onSubmit={handleTestDispatch} className="space-y-3 text-xs font-mono">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[10px] font-bold uppercase text-text-tertiary">Recipient Phone (with Country Code)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. +256771234567 or 256771234567"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-text-primary focus:border-usdt-green focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-text-tertiary">Priority Level</label>
                <select
                  value={testPriority}
                  onChange={(e) => setTestPriority(e.target.value as any)}
                  className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-text-primary focus:border-usdt-green focus:outline-none"
                >
                  <option value="CRITICAL">CRITICAL (OTP)</option>
                  <option value="HIGH">HIGH (Alert)</option>
                  <option value="NORMAL">NORMAL (Batch)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-text-tertiary">Message Body</label>
              <textarea
                rows={2}
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                className="w-full p-2.5 bg-control-bg border border-white/10 rounded-xl text-text-primary focus:border-usdt-green focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={dispatchingTest || connectedCount === 0}
              className="w-full py-2.5 rounded-xl bg-usdt-green text-app-bg font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg hover:brightness-110 disabled:opacity-50 cursor-pointer"
            >
              <Send size={14} /> {dispatchingTest ? 'Dispatching via Socket...' : 'Dispatch Live Test Message'}
            </button>
          </form>

          {/* Last Dispatch Result Banner */}
          {lastDispatchResult && (
            <div className={`p-3 rounded-2xl border text-xs font-mono space-y-1 ${
              lastDispatchResult.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              <div className="font-bold flex items-center gap-1.5">
                {lastDispatchResult.success ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                {lastDispatchResult.success ? 'Message Dispatched Successfully!' : 'Dispatch Failed'}
              </div>
              {lastDispatchResult.messageId && (
                <div>Message ID: <strong>{lastDispatchResult.messageId}</strong></div>
              )}
              {lastDispatchResult.accountId && (
                <div>Dispatched Via: <strong>{lastDispatchResult.accountId}</strong></div>
              )}
              {lastDispatchResult.error && (
                <div>Error: <strong>{lastDispatchResult.error}</strong></div>
              )}
            </div>
          )}
        </div>

        {/* Onboard New Transport Line Form */}
        <div className="bg-card-bg rounded-3xl p-5 sm:p-6 border border-white/10 space-y-4 shadow-xl">
          <div className="border-b border-white/10 pb-3">
            <h3 className="text-sm font-black text-text-primary flex items-center gap-2">
              <Plus size={16} className="text-usdt-green" /> Onboard WhatsApp Transport Number
            </h3>
            <p className="text-xs text-text-tertiary mt-0.5">
              Register an auxiliary SIM card or gateway number to expand concurrent dispatch capacity.
            </p>
          </div>

          <form onSubmit={handleAddAccount} className="space-y-3 text-xs font-mono">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-text-tertiary">Phone Number (with Country Code)</label>
              <input
                type="text"
                required
                placeholder="e.g. +18257320524 or +256771234567"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-text-primary focus:border-usdt-green focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-text-tertiary">Display Label / Identifier</label>
              <input
                type="text"
                placeholder="e.g. Primary OTP Line or East Africa High Velocity Gateway"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-text-primary focus:border-usdt-green focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submittingAccount}
              className="w-full py-2.5 rounded-xl bg-ton-blue text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg hover:brightness-110 disabled:opacity-50 cursor-pointer"
            >
              <Plus size={14} /> {submittingAccount ? 'Initializing Instance...' : 'Initialize New Transport Line'}
            </button>
          </form>
        </div>
      </div>

      {/* ─── 4. UNIFIED OS CROSS-SYSTEM NAVIGATION HUB (NO DEAD ENDS!) ───────── */}
      <div className="space-y-3">
        <h2 className="text-xs font-black uppercase tracking-wider text-text-secondary flex items-center gap-2">
          <Zap size={14} className="text-usdt-green" /> Unified Control Plane Integrations & Workflows
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Link
            to="/admin/notifications"
            className="group p-4 rounded-2xl bg-card-bg border border-white/10 hover:border-usdt-green/50 transition-all space-y-2 shadow-md"
          >
            <div className="flex items-center justify-between text-usdt-green">
              <Bell size={18} />
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
            <div className="font-extrabold text-xs text-text-primary">Broadcast Dispatcher</div>
            <p className="text-[11px] text-text-tertiary">
              Compose bulk notifications and system alerts routed via this WhatsApp fleet.
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
            <div className="font-extrabold text-xs text-text-primary">User OTP Verification</div>
            <p className="text-[11px] text-text-tertiary">
              Inspect user challenge logs and manual phone verification statuses.
            </p>
          </Link>

          <Link
            to="/admin/readiness"
            className="group p-4 rounded-2xl bg-card-bg border border-white/10 hover:border-purple-400/50 transition-all space-y-2 shadow-md"
          >
            <div className="flex items-center justify-between text-purple-400">
              <Layers size={18} />
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
            <div className="font-extrabold text-xs text-text-primary">DLQ & Outbox Queue</div>
            <p className="text-[11px] text-text-tertiary">
              Review and retry failed worker notification jobs and durable outbox events.
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
              Monitor accounts flagged for rapid SMS triggering or Sybil clusters.
            </p>
          </Link>
        </div>
      </div>

      {/* ─── 5. PAIRING CODE INSTRUCTION MODAL ─────────────────────────────────── */}
      {pairingModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-app-bg border border-usdt-green/40 rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-usdt-green font-black text-sm">
                <Key size={18} /> Link WhatsApp Transport Socket
              </div>
              <button
                onClick={() => setPairingModalData(null)}
                className="text-xs text-text-tertiary hover:text-text-primary font-bold cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 text-xs text-text-secondary">
              <p className="font-bold text-text-primary">
                Follow these steps on the mobile device (+{pairingModalData.phone}):
              </p>
              <ol className="list-decimal list-inside space-y-1.5 pl-1 text-[11px]">
                <li>Open <strong>WhatsApp</strong> on your phone</li>
                <li>Tap <strong>Settings (or 3 dots) → Linked Devices</strong></li>
                <li>Tap <strong>Link a Device</strong></li>
                <li>Select <strong>Link with phone number instead</strong> at the bottom</li>
                <li>Enter this 8-digit verification code:</li>
              </ol>
            </div>

            {/* 8-Digit Pairing Code Display */}
            <div className="relative group p-4 bg-control-bg rounded-2xl border border-usdt-green/40 text-center space-y-1">
              <div className="text-[10px] uppercase font-bold text-text-tertiary tracking-widest">8-Digit Pairing Code</div>
              <div className="font-mono text-3xl font-black text-usdt-green tracking-widest">
                {pairingModalData.code}
              </div>
              <button
                onClick={() => copyToClipboard(pairingModalData.code)}
                className="text-[11px] font-bold text-usdt-green hover:underline flex items-center justify-center gap-1 mx-auto pt-1 cursor-pointer"
              >
                <Copy size={12} /> Copy Code
              </button>
            </div>

            <button
              onClick={() => {
                setPairingModalData(null);
                fetchFleetData();
              }}
              className="w-full py-2.5 rounded-xl bg-usdt-green text-app-bg font-black text-xs uppercase tracking-wider shadow-lg hover:brightness-110 cursor-pointer"
            >
              Done & Verify Connection
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
