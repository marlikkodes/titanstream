import React, { useState, useEffect, useCallback } from 'react';
import { ShieldAlert, CheckCircle2, AlertTriangle, RefreshCw, Plus, Power, Trash2, Key, Loader2, Smartphone, Radio } from 'lucide-react';
import { api } from '../../services/api';

export interface BaileysAccountDto {
  accountId: string;
  displayName: string;
  phone: string;
  state: string;
  healthState: string;
  isEnabled: boolean;
  isQuarantined: boolean;
  pairingCode?: string;
  metrics: {
    lastConnectedAt?: string;
    lastDisconnectedAt?: string;
    lastSuccessfulMessageAt?: string;
    lastErrorAt?: string;
    reconnectAttempts: number;
    messageSuccesses: number;
    messageFailures: number;
    authenticationFailures: number;
  };
}

export const WhatsAppAccountsManagement: React.FC = () => {
  const [accounts, setAccounts] = useState<BaileysAccountDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Add Account Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/admin/whatsapp/accounts');
      const data = res.data?.data || res.data;
      if (Array.isArray(data)) {
        setAccounts(data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to fetch WhatsApp accounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleExecuteAction = async (accountId: string, action: string) => {
    setActionMessage(null);
    try {
      const res = await api.post(`/admin/whatsapp/accounts/${accountId}/action`, { action });
      const payload = res.data?.data || res.data;
      setActionMessage(`Action "${action}" executed on ${accountId}.`);
      fetchAccounts();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || `Failed to execute ${action}.`);
    }
  };

  const handleRequestPairingCode = async (accountId: string) => {
    setActionMessage(null);
    try {
      const res = await api.post(`/admin/whatsapp/accounts/${accountId}/pairing-code`, {});
      const payload = res.data?.data || res.data;
      if (payload?.pairingCode) {
        setActionMessage(`Pairing Code for ${accountId}: ${payload.pairingCode}`);
      }
      fetchAccounts();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to generate pairing code.');
    }
  };

  const handleAddAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhone) return;
    setAddLoading(true);
    setError(null);
    try {
      await api.post('/admin/whatsapp/accounts', { phone: newPhone, displayName: newDisplayName });
      setShowAddModal(false);
      setNewPhone('');
      setNewDisplayName('');
      setActionMessage(`WhatsApp account ${newPhone} registered.`);
      fetchAccounts();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to register account.');
    } finally {
      setAddLoading(false);
    }
  };

  const getStateBadge = (state: string, healthState: string) => {
    if (state === 'CONNECTED' && healthState === 'HEALTHY') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold">
          <CheckCircle2 size={12} /> CONNECTED
        </span>
      );
    }
    if (healthState === 'QUARANTINED' || state === 'QUARANTINED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/30 text-[11px] font-bold">
          <ShieldAlert size={12} /> QUARANTINED
        </span>
      );
    }
    if (state === 'DEGRADED' || healthState === 'DEGRADED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[11px] font-bold">
          <AlertTriangle size={12} /> DEGRADED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/30 text-[11px] font-bold">
        <Radio size={12} /> {state}
      </span>
    );
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Smartphone className="text-emerald-400" size={22} />
            WhatsApp Managed Transport Accounts
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Operational multi-account Baileys transport gateways, health telemetry, and administrative quarantine controls.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchAccounts}
            disabled={loading}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 transition-colors border border-white/10"
            title="Refresh Account Telemetry"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
          >
            <Plus size={16} />
            <span>Add WhatsApp Account</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold text-center">
          {error}
        </div>
      )}
      {actionMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold text-center">
          {actionMessage}
        </div>
      )}

      {/* Account Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.map((acc) => (
          <div
            key={acc.accountId}
            className="p-5 rounded-3xl bg-[#0f111a] border border-white/10 space-y-4 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-white text-base">{acc.displayName}</h3>
                  <span className="font-mono text-xs text-gray-400">{acc.phone}</span>
                </div>
                {getStateBadge(acc.state, acc.healthState)}
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-[#141722] border border-white/5 text-center text-[11px]">
                <div>
                  <span className="text-gray-500 block font-medium">Sent</span>
                  <span className="font-bold text-white">{acc.metrics.messageSuccesses}</span>
                </div>
                <div>
                  <span className="text-gray-500 block font-medium">Failures</span>
                  <span className={`font-bold ${acc.metrics.messageFailures > 0 ? 'text-amber-400' : 'text-gray-300'}`}>
                    {acc.metrics.messageFailures}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block font-medium">Reconnects</span>
                  <span className="font-bold text-gray-300">{acc.metrics.reconnectAttempts}</span>
                </div>
              </div>

              {acc.pairingCode && (
                <div className="mt-3 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs">
                  <span className="text-emerald-400 font-medium">Pairing Code:</span>
                  <span className="font-mono font-black text-white tracking-widest text-sm">{acc.pairingCode}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-white/5 flex flex-wrap gap-2 justify-end">
              <button
                onClick={() => handleRequestPairingCode(acc.accountId)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-white/10"
                title="Get Pairing Code"
              >
                <Key size={14} />
                <span>Pair Code</span>
              </button>

              {acc.state !== 'CONNECTED' ? (
                <button
                  onClick={() => handleExecuteAction(acc.accountId, 'connect')}
                  className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-emerald-500/30"
                >
                  <Power size={14} />
                  <span>Connect</span>
                </button>
              ) : (
                <button
                  onClick={() => handleExecuteAction(acc.accountId, 'disconnect')}
                  className="p-2 rounded-xl bg-gray-500/10 hover:bg-gray-500/20 text-gray-400 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-gray-500/30"
                >
                  <Power size={14} />
                  <span>Disconnect</span>
                </button>
              )}

              {acc.isQuarantined ? (
                <button
                  onClick={() => handleExecuteAction(acc.accountId, 'unquarantine')}
                  className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-emerald-500/30"
                >
                  <ShieldAlert size={14} />
                  <span>Unquarantine</span>
                </button>
              ) : (
                <button
                  onClick={() => handleExecuteAction(acc.accountId, 'quarantine')}
                  className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-red-500/30"
                >
                  <ShieldAlert size={14} />
                  <span>Quarantine</span>
                </button>
              )}

              <button
                onClick={() => handleExecuteAction(acc.accountId, 'remove')}
                className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors border border-red-500/20"
                title="Remove Account"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-3xl bg-[#0f111a] border border-white/10 space-y-4">
            <h3 className="text-lg font-bold text-white">Register WhatsApp Gateway Account</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Enter phone number (with country code) to provision a new Baileys transport gateway.
            </p>
            <form onSubmit={handleAddAccountSubmit} className="space-y-3">
              <input
                type="text"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="Gateway Display Name (e.g. EU Gateway)"
                className="w-full px-4 py-3 rounded-2xl bg-[#141722] border border-white/10 text-white text-xs font-medium focus:outline-none focus:border-emerald-500"
              />
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="+1 825 732 0524"
                className="w-full px-4 py-3 rounded-2xl bg-[#141722] border border-white/10 text-white font-mono text-xs font-semibold focus:outline-none focus:border-emerald-500"
                required
              />
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-1/2 py-3 rounded-2xl bg-white/10 text-gray-300 font-bold text-xs hover:bg-white/15"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading || !newPhone}
                  className="w-1/2 py-3 rounded-2xl bg-emerald-500 text-white font-bold text-xs hover:bg-emerald-600 flex items-center justify-center gap-1.5"
                >
                  {addLoading ? <Loader2 size={16} className="animate-spin" /> : 'Register Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
