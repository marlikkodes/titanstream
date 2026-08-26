import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { MetricCard, MetricCardGrid } from '@/components/admin/MetricCard';
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
  QrCode,
  Smartphone,
  RotateCw,
} from 'lucide-react';

interface WhatsappAccount {
  id: string;
  phone: string;
  displayName: string;
  status: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'QUARANTINED' | 'DISABLED';
  pairingCode?: string;
  qrCode?: string;
  uptimeSeconds?: number;
  lastConnectedAt?: string;
  error?: string;
}

const statusBadgeVariant: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  CONNECTED: 'success',
  CONNECTING: 'warning',
  DISCONNECTED: 'default',
  QUARANTINED: 'danger',
  DISABLED: 'default',
};

export const WhatsappAdminPage: React.FC = () => {
  const [accounts, setAccounts] = useState<WhatsappAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // New account form
  const [newPhone, setNewPhone] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Pairing code dialog
  const [pairingData, setPairingData] = useState<{ accountId: string; code: string } | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/whatsapp/accounts');
      const list = res.data?.data || res.data || [];
      setAccounts(Array.isArray(list) ? list : []);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhone.trim()) {
      showToast('Phone number is required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/admin/whatsapp/accounts', {
        phone: newPhone.trim(),
        displayName: newDisplayName.trim() || undefined,
      });
      showToast('WhatsApp transport line registered successfully!', 'success');
      setNewPhone('');
      setNewDisplayName('');
      fetchAccounts();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to add WhatsApp account', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExecuteAction = async (
    accountId: string,
    action: 'connect' | 'disconnect' | 'reconnect' | 'enable' | 'disable' | 'quarantine' | 'unquarantine' | 'remove',
  ) => {
    if (action === 'remove' && !window.confirm('Confirm removing this WhatsApp transport instance?')) return;
    setActionLoading(true);
    try {
      await api.post(`/admin/whatsapp/accounts/${accountId}/action`, { action });
      showToast(`Action "${action.toUpperCase()}" executed cleanly on line ${accountId}`, 'success');
      fetchAccounts();
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
      setPairingData({ accountId, code: String(code) });
      showToast(`Pairing code generated: ${code}`, 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to generate pairing code', 'error');
    }
  };

  const connectedCount = accounts.filter((a) => a.status === 'CONNECTED').length;
  const quarantinedCount = accounts.filter((a) => a.status === 'QUARANTINED').length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <MetricCardGrid columns={3}>
        <MetricCard label="Active Sockets" value={connectedCount.toString()} icon="Radio" variant="green" />
        <MetricCard label="Total Transport Lines" value={accounts.length.toString()} icon="Smartphone" variant="blue" />
        <MetricCard label="Quarantined Lines" value={quarantinedCount.toString()} icon="ShieldAlert" variant={quarantinedCount > 0 ? 'red' : 'green'} />
      </MetricCardGrid>

      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card-bg p-4 rounded-2xl border border-white/10 shadow-lg">
        <div>
          <h2 className="text-sm font-extrabold text-text-primary flex items-center gap-2">
            <MessageSquare size={18} className="text-usdt-green" /> WhatsApp Multi-Device Transport Fleet
          </h2>
          <p className="text-xs text-text-tertiary mt-0.5">
            Baileys transport socket instances providing automated OTPs, deposit alerts, and 2FA notifications.
          </p>
        </div>

        <button
          onClick={fetchAccounts}
          disabled={loading}
          className="p-2 rounded-xl bg-control-bg border border-white/10 text-text-secondary hover:text-text-primary disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Accounts Fleet Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className={`bg-card-bg rounded-2xl p-4 border transition-all space-y-3 shadow-lg ${
              acc.status === 'CONNECTED'
                ? 'border-usdt-green/30'
                : acc.status === 'QUARANTINED'
                  ? 'border-rose-500/40 bg-rose-500/5'
                  : 'border-white/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-usdt-green" />
                <span className="font-extrabold text-xs text-text-primary">{acc.displayName || acc.phone}</span>
              </div>
              <StatusBadge label={acc.status} variant={statusBadgeVariant[acc.status] || 'default'} dot />
            </div>

            <div className="space-y-1 text-xs font-mono">
              <div>Phone: <strong className="text-text-primary">{acc.phone}</strong></div>
              <div className="text-[10px] text-text-tertiary">ID: {acc.id}</div>
              {acc.error && (
                <div className="text-[10px] text-rose-400 bg-rose-500/10 p-1.5 rounded">
                  {acc.error}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => handleExecuteAction(acc.id, acc.status === 'CONNECTED' ? 'disconnect' : 'connect')}
                  disabled={actionLoading}
                  className="px-2.5 py-1 rounded-lg bg-control-bg text-text-primary hover:bg-white/10 text-[10px] font-bold border border-white/10 flex items-center gap-1 cursor-pointer"
                >
                  <Power size={12} /> {acc.status === 'CONNECTED' ? 'Disconnect' : 'Connect'}
                </button>

                <button
                  onClick={() => handleExecuteAction(acc.id, 'reconnect')}
                  disabled={actionLoading}
                  className="px-2.5 py-1 rounded-lg bg-control-bg text-text-primary hover:bg-white/10 text-[10px] font-bold border border-white/10 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCw size={12} /> Reconnect
                </button>

                <button
                  onClick={() => handleRequestPairingCode(acc.id, acc.phone)}
                  className="px-2.5 py-1 rounded-lg bg-ton-blue/20 text-ton-blue hover:bg-ton-blue/30 text-[10px] font-bold border border-ton-blue/30 flex items-center gap-1 cursor-pointer"
                >
                  <Key size={12} /> Pairing Code
                </button>

                <button
                  onClick={() => handleExecuteAction(acc.id, acc.status === 'QUARANTINED' ? 'unquarantine' : 'quarantine')}
                  disabled={actionLoading}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[10px] font-bold border border-amber-500/30 flex items-center gap-1 cursor-pointer"
                >
                  <ShieldAlert size={12} /> {acc.status === 'QUARANTINED' ? 'Unquarantine' : 'Quarantine'}
                </button>

                <button
                  onClick={() => handleExecuteAction(acc.id, 'remove')}
                  disabled={actionLoading}
                  className="px-2 py-1 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 text-[10px] font-bold border border-rose-500/30 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          </div>
        ))}

        {accounts.length === 0 && !loading && (
          <div className="col-span-full p-8 text-center bg-card-bg rounded-2xl border border-white/5 space-y-1">
            <p className="text-xs font-bold text-text-primary">No WhatsApp transport lines connected</p>
            <p className="text-[11px] text-text-tertiary">Register a new phone number to initialize the Baileys socket.</p>
          </div>
        )}
      </div>

      {/* Pairing Code Banner Modal */}
      {pairingData && (
        <div className="p-4 rounded-2xl bg-usdt-green/10 border border-usdt-green/40 space-y-2 shadow-lg">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold text-usdt-green flex items-center gap-2">
              <Key size={16} /> WhatsApp 8-Digit Pairing Code Generated
            </h4>
            <button
              onClick={() => setPairingData(null)}
              className="text-xs text-text-tertiary hover:text-text-primary font-bold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
          <p className="text-xs text-text-secondary">
            Open WhatsApp on the device → Linked Devices → Link with phone number → Enter this pairing code:
          </p>
          <div className="p-3 bg-control-bg rounded-xl font-mono text-lg font-black text-usdt-green tracking-widest text-center border border-usdt-green/30">
            {pairingData.code}
          </div>
        </div>
      )}

      {/* Register New Transport Account */}
      <form onSubmit={handleAddAccount} className="bg-card-bg rounded-2xl p-4 sm:p-5 border border-white/10 space-y-3 shadow-xl">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
          <Plus size={14} className="text-usdt-green" /> Register New WhatsApp Transport Number
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            required
            placeholder="Phone Number with Country Code (e.g. 256771234567)"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            className="h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-xs font-mono text-text-primary focus:outline-none focus:border-usdt-green"
          />
          <input
            type="text"
            placeholder="Display Identifier (e.g. Primary OTP Line)"
            value={newDisplayName}
            onChange={(e) => setNewDisplayName(e.target.value)}
            className="h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-xs text-text-primary focus:outline-none focus:border-usdt-green"
          />
          <button
            type="submit"
            disabled={submitting}
            className="h-10 px-4 rounded-xl bg-usdt-green text-app-bg font-extrabold text-xs shadow-md hover:brightness-110 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Plus size={14} /> {submitting ? 'Initializing Socket...' : 'Initialize Transport Line'}
          </button>
        </div>
      </form>
    </div>
  );
};
