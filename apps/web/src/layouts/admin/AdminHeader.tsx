import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Search, Bell, Menu, X, ShieldAlert, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/Badge';
import { useNavigate } from 'react-router-dom';
import { operationsService } from '@/services/operationsService';
import { showToast } from '@/components/Toast';
import { api } from '@/services/api';

interface AdminHeaderProps {
  title: string;
  onMenuToggle?: () => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({ title, onMenuToggle }) => {
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [killModalOpen, setKillModalOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [switchesLoading, setSwitchesLoading] = useState(false);
  const [backendSwitches, setBackendSwitches] = useState<{
    maintenanceMode?: boolean;
    readOnlyMode?: boolean;
    disableWithdrawals?: boolean;
    disablePurchases?: boolean;
    disableClaims?: boolean;
    disableRegistrations?: boolean;
    disableSettlements?: boolean;
  }>({});

  const fetchSwitches = useCallback(async () => {
    try {
      const sw = await operationsService.getGlobalSwitches();
      if (sw && typeof sw === 'object') {
        setBackendSwitches(sw);
      }
    } catch {
      // Non-blocking
    }
  }, []);

  useEffect(() => {
    fetchSwitches();
  }, [fetchSwitches]);

  const isWarningActive = Boolean(
    backendSwitches.maintenanceMode ||
    backendSwitches.readOnlyMode ||
    backendSwitches.disableWithdrawals ||
    backendSwitches.disableSettlements
  );

  const handleToggleSwitch = async (key: string, currentVal: boolean, label: string) => {
    const action = currentVal ? 'UNLOCK / RESUME' : 'LOCK / PAUSE';
    const reason = prompt(`[MANDATORY AUDIT REASON] Reason for ${action} on ${label}:`);
    if (reason === null) return;
    if (!reason.trim()) {
      showToast('Mandatory audit reason required', 'error');
      return;
    }
    setSwitchesLoading(true);
    try {
      const updated = { ...backendSwitches, [key]: !currentVal };
      await operationsService.updateGlobalSwitches(updated, reason.trim());
      setBackendSwitches(updated);
      showToast(`${label} state updated in backend engine!`, 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to update switch', 'error');
    } finally {
      setSwitchesLoading(false);
    }
  };

  const handleSearch = async (val: string) => {
    setHeaderSearch(val);
    if (!val || val.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await api.get<any[]>(`/admin/dashboard/search?q=${encodeURIComponent(val)}`);
      setSearchResults(res.data || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <header className="h-14 bg-app-bg-secondary border-b border-border flex items-center justify-between px-3 sm:px-6 sticky top-0 z-50">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-control-bg transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
          aria-label="Open menu"
        >
          <Menu size={20} className="text-text-secondary" />
        </button>
        <h1 className="text-base sm:text-lg font-bold text-text-primary truncate">{title}</h1>
        
        {/* Dashboard Health Status Banner */}
        <button
          onClick={() => setKillModalOpen(true)}
          className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider transition-colors ${
            backendSwitches.maintenanceMode
              ? 'bg-rose-600/30 text-rose-300 border border-rose-500 animate-pulse'
              : backendSwitches.disableWithdrawals || backendSwitches.disablePurchases
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'bg-usdt-green/15 text-usdt-green border border-usdt-green/30'
          }`}
          title="Click to manage Global Emergency Controls"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isWarningActive ? 'bg-rose-400 animate-ping' : 'bg-usdt-green'}`} />
          <span>
            {backendSwitches.maintenanceMode
              ? '🔴 Maintenance Mode Active'
              : backendSwitches.disableWithdrawals
              ? '🟡 Withdrawals Paused'
              : backendSwitches.disablePurchases
              ? '🟡 Purchases Paused'
              : backendSwitches.readOnlyMode
              ? '🟡 Read-Only Mode'
              : '🟢 All Systems Operational'}
          </span>
        </button>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Emergency Kill Switches Quick Trigger */}
        <button
          onClick={() => setKillModalOpen(true)}
          className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 font-extrabold text-xs flex items-center gap-1.5"
          title="Emergency Control Panel"
        >
          <ShieldAlert size={14} />
          <span className="hidden md:inline">Emergency Controls</span>
        </button>

        {/* Desktop search */}
        <div className="relative hidden md:block z-[100]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search orders, users, operators..."
            value={headerSearch}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-48 lg:w-64 bg-control-bg/50 text-text-primary rounded-lg pl-9 pr-3 py-2 text-sm border border-white/10 focus:border-usdt-green focus:outline-none placeholder:text-text-tertiary transition-all"
          />

          {/* Floating Dropdown Results */}
          {headerSearch.trim().length >= 2 && (
            <div className="absolute right-0 top-11 w-80 lg:w-96 z-[1000] bg-app-bg-secondary/95 border border-usdt-green/40 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] p-2 max-h-96 overflow-y-auto space-y-1 backdrop-blur-2xl">
              {searching ? (
                <div className="p-3 text-center text-xs text-text-tertiary">Searching production system...</div>
              ) : searchResults.length === 0 ? (
                <div className="p-3 text-center text-xs text-text-tertiary">No matching entities found</div>
              ) : (
                searchResults.map((item) => (
                  <div
                    key={`header_${item.entityType}_${item.id}`}
                    onClick={() => {
                      setHeaderSearch('');
                      if (item.linkTab === 'Users & Support') navigate('/admin/users');
                      else if (item.linkTab === 'Treasury & Financials') navigate('/admin/treasury');
                      else navigate('/admin/operations');
                    }}
                    className="p-2.5 rounded-lg bg-control-bg hover:bg-usdt-green/10 hover:border-usdt-green/30 border border-white/5 cursor-pointer flex items-center justify-between transition-all group"
                  >
                    <div>
                      <div className="text-xs font-bold text-text-primary group-hover:text-usdt-green transition-colors">{item.title}</div>
                      <div className="text-[10px] text-text-tertiary mt-0.5">{item.subtitle}</div>
                    </div>
                    {item.badge && (
                      <span className="text-[9px] font-extrabold px-2 py-0.5 rounded bg-usdt-green/20 text-usdt-green border border-usdt-green/30 flex-shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Mobile search toggle */}
        <button
          onClick={() => setSearchOpen(!searchOpen)}
          className="md:hidden p-2 rounded-lg hover:bg-control-bg transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
          aria-label="Search"
        >
          {searchOpen ? <X size={18} className="text-text-secondary" /> : <Search size={18} className="text-text-secondary" />}
        </button>

        <button
          className="relative p-2 rounded-lg hover:bg-control-bg transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
          onClick={() => navigate('/admin/notifications')}
          aria-label="Notifications"
        >
          <Bell size={18} className="text-text-secondary" />
          <Badge count={3} variant="red" className="absolute -top-0.5 -right-0.5" />
        </button>

        <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-border">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-usdt-green/15 text-usdt-green flex items-center justify-center text-xs font-bold flex-shrink-0">
            AD
          </div>
          <div className="hidden sm:block min-w-0">
            <p className="text-sm font-semibold text-text-primary truncate">Admin (Founder)</p>
            <p className="text-xs text-text-tertiary truncate">admin@titanstream.io</p>
          </div>
        </div>
      </div>

      {/* Emergency Control Modal */}
      {killModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-app-bg border border-white/10 rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-extrabold text-text-primary flex items-center gap-2">
                <ShieldAlert size={18} className="text-rose-400" /> Global Emergency Safety Controls
              </h3>
              <button onClick={() => setKillModalOpen(false)} className="p-1 rounded-full bg-white/5 text-text-tertiary hover:text-text-primary">
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-text-tertiary leading-relaxed">
              Instantly toggle platform emergency kill switches. All administrative actions require safety confirmation and create permanent audit logs.
            </p>

            <div className="space-y-3">
              {[
                { key: 'maintenanceMode', label: 'Maintenance Mode', state: Boolean(backendSwitches.maintenanceMode), desc: 'Place full ecosystem in maintenance mode (blocks non-admin API traffic).' },
                { key: 'disableWithdrawals', label: 'Pause Withdrawals', state: Boolean(backendSwitches.disableWithdrawals), desc: 'Halt all instant withdrawal executions and queue processing.' },
                { key: 'readOnlyMode', label: 'Read-Only Mode', state: Boolean(backendSwitches.readOnlyMode), desc: 'Block all state-mutating requests platform-wide.' },
                { key: 'disableSettlements', label: 'Pause Settlements', state: Boolean(backendSwitches.disableSettlements), desc: 'Halt CryptoBot & Merchant settlement execution.' },
              ].map((sw) => (
                <div key={sw.key} className="flex items-center justify-between p-3 rounded-2xl bg-control-bg border border-white/10">
                  <div>
                    <div className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                      {sw.label}
                      {sw.state && <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-500 text-white">LOCKED</span>}
                    </div>
                    <div className="text-[11px] text-text-tertiary">{sw.desc}</div>
                  </div>
                  <button
                    onClick={() => handleToggleSwitch(sw.key, sw.state, sw.label)}
                    disabled={switchesLoading}
                    className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition-colors cursor-pointer disabled:opacity-50 ${
                      sw.state
                        ? 'bg-rose-500 text-white shadow-md'
                        : 'bg-white/5 border border-white/10 text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {sw.state ? 'ACTIVE LOCK' : 'NORMAL'}
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-2 text-right">
              <button onClick={() => setKillModalOpen(false)} className="px-4 py-2 rounded-xl bg-usdt-green text-app-bg font-extrabold text-xs">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile search bar */}
      {searchOpen && (
        <div className="fixed left-0 right-0 top-14 z-30 p-3 bg-app-bg-secondary border-b border-border md:hidden animate-fade-in">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search orders, users, operators..."
              className="w-full bg-control-bg/80 text-text-primary rounded-lg pl-9 pr-3 py-3 text-sm border border-white/10 focus:border-usdt-green focus:outline-none placeholder:text-text-tertiary"
              autoFocus
            />
          </div>
        </div>
      )}
    </header>
  );
};
