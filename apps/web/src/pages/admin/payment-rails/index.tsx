import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { MetricCard, MetricCardGrid } from '@/components/admin/MetricCard';
import {
  commandCenterService,
  type MobileMoneyConfig,
} from '@/services/commandCenterService';
import { paymentOrderService, type PaymentDestinationConfig } from '@/services/paymentOrderService';
import { showToast } from '@/components/Toast';
import { Smartphone, CreditCard, DollarSign, Plus, RefreshCw, CheckCircle2, ShieldCheck } from 'lucide-react';

export const PaymentRailsPage: React.FC = () => {
  const [mmConfigs, setMmConfigs] = useState<MobileMoneyConfig[]>([]);
  const [rails, setRails] = useState<PaymentDestinationConfig[]>([]);
  const [loading, setLoading] = useState(true);

  // Add new phone state
  const [newPhone, setNewPhone] = useState('');
  const [newProvider, setNewProvider] = useState('MTN');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newCountry, setNewCountry] = useState('UG');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [mmData, railsData] = await Promise.all([
        commandCenterService.getMobileMoneyRegistry().catch(() => []),
        paymentOrderService.getDestinations().catch(() => []),
      ]);
      setMmConfigs(Array.isArray(mmData) ? mmData : []);
      setRails(Array.isArray(railsData) ? railsData : []);
    } catch (err: any) {
      showToast('Failed to load payment rails data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhone.trim()) {
      showToast('Phone number is required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const ussd = newProvider === 'AIRTEL'
        ? '*185*1*1*{phone}*{amount}#'
        : '*165*1*1*{phone}*{amount}#';

      await commandCenterService.upsertMobileMoney({
        provider: newProvider,
        country: newCountry,
        currency: newCountry === 'UG' ? 'UGX' : newCountry === 'KE' ? 'KES' : 'TZS',
        phoneNumber: newPhone.trim(),
        displayName: newDisplayName.trim() || `${newProvider} Escrow ${newPhone.trim().slice(-4)}`,
        ussdTemplate: ussd,
        priority: mmConfigs.length + 1,
        dailyCapacityUsdt: 50000,
        status: 'ACTIVE',
        notes: 'Configured via Payment Rails HQ',
      });

      showToast(`Receiving number ${newPhone.trim()} persisted to database!`, 'success');
      setNewPhone('');
      setNewDisplayName('');
      loadData();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to save receiving number', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (cfg: MobileMoneyConfig) => {
    const nextStatus = cfg.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      await commandCenterService.upsertMobileMoney({
        ...cfg,
        status: nextStatus,
      });
      showToast(`Receiving number ${cfg.phoneNumber} is now ${nextStatus}`, 'info');
      loadData();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to update status', 'error');
    }
  };

  const activeMmCount = mmConfigs.filter((c) => c.status === 'ACTIVE').length;
  const activeRailsCount = rails.filter((r) => r.isActive).length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <MetricCardGrid columns={3}>
        <MetricCard label="Active MM Receivers" value={activeMmCount.toString()} icon="Smartphone" variant="green" />
        <MetricCard label="Active Payment Rails" value={activeRailsCount.toString()} icon="CreditCard" variant="blue" />
        <MetricCard label="Total Gateway Capacity" value={`$${mmConfigs.reduce((acc, c) => acc + (Number(c.dailyCapacityUsdt) || 0), 0).toLocaleString()}`} icon="DollarSign" variant="gold" />
      </MetricCardGrid>

      {/* Authoritative Mobile Money Receiving Registry */}
      <div className="bg-card-bg rounded-2xl p-4 sm:p-5 border border-white/10 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-text-primary flex items-center gap-2">
              <Smartphone size={18} className="text-usdt-green" /> Authoritative Mobile Money Receiving Registry
            </h3>
            <p className="text-xs text-text-tertiary mt-0.5">
              Receiving phone numbers and USSD push routes persisted in PostgreSQL database. Zero browser-local fragility.
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-xl bg-control-bg border border-white/10 hover:bg-white/5 text-text-secondary disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* List of active numbers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {mmConfigs.map((cfg) => (
            <div
              key={cfg.id}
              className={`p-3.5 rounded-2xl border transition-colors space-y-2.5 ${
                cfg.status === 'ACTIVE'
                  ? 'bg-control-bg border-usdt-green/30'
                  : 'bg-control-bg/60 border-white/5 opacity-70'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xs text-text-primary">{cfg.displayName}</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                    cfg.status === 'ACTIVE' ? 'bg-usdt-green/20 text-usdt-green border border-usdt-green/40' : 'bg-white/10 text-text-tertiary'
                  }`}
                >
                  {cfg.status}
                </span>
              </div>

              <div className="space-y-1 text-xs font-mono">
                <div className="text-text-primary font-bold">{cfg.phoneNumber}</div>
                <div className="text-[10px] text-text-tertiary">
                  {cfg.provider} · {cfg.country} ({cfg.currency}) · Pri: {cfg.priority}
                </div>
                <div className="text-[10px] text-usdt-green truncate">
                  <code>{cfg.ussdTemplate}</code>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-white/5 text-xs">
                <span className="text-[10px] text-text-tertiary">
                  Cap: ${Number(cfg.dailyCapacityUsdt || 0).toLocaleString()}
                </span>
                <button
                  onClick={() => handleToggleStatus(cfg)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold font-mono transition-colors cursor-pointer ${
                    cfg.status === 'ACTIVE'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-usdt-green text-app-bg'
                  }`}
                >
                  {cfg.status === 'ACTIVE' ? 'Pause' : 'Activate'}
                </button>
              </div>
            </div>
          ))}

          {mmConfigs.length === 0 && !loading && (
            <div className="col-span-full p-6 text-center text-xs text-text-tertiary bg-control-bg rounded-xl">
              No receiving phone numbers configured in backend database.
            </div>
          )}
        </div>

        {/* Add new receiving number form */}
        <form onSubmit={handleAddPhone} className="p-4 rounded-xl bg-control-bg border border-white/10 space-y-3 pt-3">
          <div className="text-xs font-extrabold text-text-primary flex items-center gap-1.5">
            <Plus size={14} className="text-usdt-green" /> Register New Receiving Mobile Money Line
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <input
              type="text"
              required
              placeholder="Phone Number (e.g. 0771234567)"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              className="h-10 px-3 bg-app-bg border border-white/10 rounded-xl text-xs font-mono text-text-primary focus:outline-none focus:border-usdt-green"
            />
            <input
              type="text"
              placeholder="Display Name (optional)"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              className="h-10 px-3 bg-app-bg border border-white/10 rounded-xl text-xs text-text-primary focus:outline-none focus:border-usdt-green"
            />
            <select
              value={newProvider}
              onChange={(e) => setNewProvider(e.target.value)}
              className="h-10 px-3 bg-app-bg border border-white/10 rounded-xl text-xs text-text-primary focus:outline-none focus:border-usdt-green"
            >
              <option value="MTN">MTN Mobile Money</option>
              <option value="AIRTEL">Airtel Money</option>
              <option value="MPESA">M-Pesa Safaricom</option>
            </select>
            <select
              value={newCountry}
              onChange={(e) => setNewCountry(e.target.value)}
              className="h-10 px-3 bg-app-bg border border-white/10 rounded-xl text-xs text-text-primary focus:outline-none focus:border-usdt-green"
            >
              <option value="UG">Uganda (UGX)</option>
              <option value="KE">Kenya (KES)</option>
              <option value="TZ">Tanzania (TZS)</option>
            </select>
          </div>
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl bg-usdt-green text-app-bg font-extrabold text-xs shadow-md hover:brightness-110 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <Plus size={14} /> {submitting ? 'Persisting...' : 'Save Receiving Line'}
            </button>
          </div>
        </form>
      </div>

      {/* Payment Destinations Matrix */}
      <div className="bg-card-bg rounded-2xl p-4 sm:p-5 border border-white/10 space-y-4 shadow-xl">
        <h3 className="text-sm font-extrabold text-text-primary flex items-center gap-2">
          <CreditCard size={18} className="text-ton-blue" /> Payment Routing Destinations & Limits
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rails.map((rail) => (
            <div key={rail.id} className="bg-control-bg rounded-xl p-4 border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${rail.isActive ? 'bg-usdt-green' : 'bg-error-red'}`} />
                  <span className="text-xs font-bold text-text-primary">{rail.network} ({rail.country})</span>
                </div>
                <StatusBadge label={rail.isActive ? 'active' : 'disabled'} variant={rail.isActive ? 'success' : 'danger'} dot />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div><span className="text-text-tertiary text-[10px]">Currency:</span> <div className="text-text-primary font-bold">{rail.currency}</div></div>
                <div><span className="text-text-tertiary text-[10px]">Rate:</span> <div className="text-text-primary font-bold">{rail.exchangeRateUsdt}</div></div>
                <div className="col-span-2"><span className="text-text-tertiary text-[10px]">Receiving Target:</span> <div className="text-usdt-green text-[11px] truncate">{rail.receivingNumber} ({rail.receivingName})</div></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
