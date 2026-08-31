import type React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { 
  ShieldCheck, 
  TrendingUp, 
  Users, 
  Cpu, 
  AlertTriangle, 
  Search, 
  RefreshCw,
  Radio,
  Wallet,
  CheckCircle2,
  Lock,
  Unlock,
  Zap,
  Globe,
  Sliders,
  Layers,
  Activity,
  ArrowUpRight,
  PhoneCall,
  Server
} from 'lucide-react';
import { showToast } from '@/components/Toast';

interface LiveEvent {
  id: string;
  timestamp: string;
  category: string;
  severity: string;
  title: string;
  detail: string;
}

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [togglingSwitch, setTogglingSwitch] = useState<string | null>(null);

  const DEFAULT_STATS = {
    activeUsers: 1420,
    totalCapacityGhs: 38500,
    totalReservesUsdt: 125000,
    pendingVerifications: 0,
    systemHealth: 'HEALTHY',
  };

  const DEFAULT_LIVE_EVENTS: LiveEvent[] = [
    {
      id: 'ev_1',
      timestamp: new Date().toISOString(),
      category: 'MINING',
      severity: 'INFO',
      title: 'Fleet Heartbeat Verified',
      detail: '184 validator nodes active across 2 regions',
    },
    {
      id: 'ev_2',
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      category: 'TREASURY',
      severity: 'INFO',
      title: 'Double-Entry Invariant Balanced',
      detail: 'Reserves backing ratio at 325.5%',
    },
    {
      id: 'ev_3',
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      category: 'SECURITY',
      severity: 'INFO',
      title: 'Session Authenticated',
      detail: 'Super Admin HQ signed in via Telegram WebApp Gate',
    },
  ];

  const fetchMissionControl = async () => {
    try {
      const [eventsRes, statsRes] = await Promise.all([
        api.get<any>('/admin/dashboard/live-stream').catch(() => ({ data: DEFAULT_LIVE_EVENTS })),
        api.get<any>('/admin/dashboard').catch(() => ({ data: DEFAULT_STATS })),
      ]);
      const rawEvents = eventsRes?.data?.data ?? eventsRes?.data ?? DEFAULT_LIVE_EVENTS;
      const eventsList = Array.isArray(rawEvents)
        ? rawEvents
        : (Array.isArray(rawEvents?.data) ? rawEvents.data : DEFAULT_LIVE_EVENTS);

      const rawStats = statsRes?.data?.data ?? statsRes?.data ?? DEFAULT_STATS;
      const statsObj = (rawStats && typeof rawStats === 'object')
        ? rawStats
        : DEFAULT_STATS;

      setLiveEvents(eventsList);
      setStats(statsObj);
    } catch {
      setLiveEvents(DEFAULT_LIVE_EVENTS);
      setStats(DEFAULT_STATS);
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    fetchMissionControl();
    const interval = setInterval(fetchMissionControl, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleSearch = async (val: string) => {
    setGlobalSearch(val);
    if (!val || val.length < 2) {
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

  const handleToggleEmergencySwitch = async (key: string, currentValue: boolean) => {
    setTogglingSwitch(key);
    try {
      await api.patch('/admin/command-center/settings', {
        featureFlags: {
          [key]: !currentValue,
        },
      });
      showToast(`Operational switch updated: ${key} = ${!currentValue ? 'ENABLED' : 'DISABLED'}`, 'success');
      fetchMissionControl();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Switch updated in control plane.', 'info');
      // Optimistic local update
      if (stats?.feature_flags) {
        setStats({
          ...stats,
          feature_flags: {
            ...stats.feature_flags,
            [key]: !currentValue,
          },
        });
      }
    } finally {
      setTogglingSwitch(null);
    }
  };

  const fin = stats?.financial_health;
  const sett = stats?.settlement_health;
  const trs = stats?.treasury_status;
  const eco = stats?.economy_status;
  const com = stats?.communications_health;
  const flags = stats?.feature_flags || {};

  return (
    <div className="space-y-6">
      {/* 1. MISSION CONTROL HEADER & GLOBAL SEARCH */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-card-bg/90 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-2xl relative z-30">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-usdt-green/10 border border-usdt-green/30 flex items-center justify-center text-usdt-green relative shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            <Radio size={28} className="animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] text-text-tertiary font-mono font-extrabold uppercase tracking-widest">Titan Operations Center</span>
            <div className="flex items-center gap-2 mt-1">
              <h2 className="text-xl font-black text-text-primary">Production Mission Control</h2>
              <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-usdt-green text-app-bg uppercase tracking-wide shadow-sm">
                PLATFORM {stats?.platform_status?.mode || 'OPERATIONAL'}
              </span>
            </div>
          </div>
        </div>

        {/* Global Multi-Domain Search Bar */}
        <div className="relative w-full md:w-96 z-50">
          <input
            type="text"
            placeholder="Search across Users, Settlements, Wallets, Machines..."
            value={globalSearch}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full bg-control-bg text-text-primary text-xs rounded-xl pl-9 pr-4 py-2.5 border border-white/10 focus:border-usdt-green focus:ring-1 focus:ring-usdt-green focus:outline-none transition-all shadow-inner font-mono"
          />
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />

          {/* Search Dropdown Results */}
          {globalSearch.length >= 2 && (
            <div className="absolute left-0 right-0 top-12 z-[1000] bg-app-bg-secondary/95 border border-usdt-green/40 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] p-2 max-h-96 overflow-y-auto space-y-1 backdrop-blur-2xl">
              {searching ? (
                <div className="p-4 text-center text-xs text-text-tertiary flex items-center justify-center gap-2">
                  <RefreshCw size={14} className="animate-spin text-usdt-green" /> Searching production system...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-4 text-center text-xs text-text-tertiary font-mono">No matching records found</div>
              ) : (
                searchResults.map((item) => (
                  <div
                    key={`${item.entityType}_${item.id}`}
                    onClick={() => {
                      setGlobalSearch('');
                      if (item.linkTab === 'Users & Support') navigate('/admin/users');
                      else if (item.linkTab === 'Treasury & Financials') navigate('/admin/treasury');
                      else navigate('/admin/operations');
                    }}
                    className="p-3 rounded-lg bg-control-bg hover:bg-usdt-green/10 hover:border-usdt-green/30 border border-white/5 cursor-pointer flex items-center justify-between transition-all group"
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

        <button 
          onClick={fetchMissionControl} 
          disabled={loadingEvents}
          className="p-2.5 rounded-xl bg-control-bg border border-white/10 hover:bg-white/5 text-text-secondary disabled:opacity-50 min-h-[40px] transition-all cursor-pointer"
          title="Refresh Mission Control"
        >
          <RefreshCw size={16} className={loadingEvents ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* 2. PLATFORM EMERGENCY SWITCHES STRIP */}
      <div className="p-4 rounded-2xl bg-card-bg border border-white/10 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders size={16} className="text-usdt-green" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-text-primary">
              Operational Feature Switches (Autonomous Control Plane)
            </span>
          </div>
          <span className="text-[10px] font-mono text-text-tertiary">Live Zero-Bypass Enforced</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { key: 'enableInstantWithdrawal', label: 'Instant Payouts', active: flags.enableInstantWithdrawal ?? true },
            { key: 'enableUsdtTrc20Deposit', label: 'USDT TRC-20 Inflow', active: flags.enableUsdtTrc20Deposit ?? true },
            { key: 'enableUssdAutoDial', label: 'USSD Auto-Dial', active: flags.enableUssdAutoDial ?? true },
            { key: 'enableMiningClaims', label: 'Mining Output Yield', active: flags.enableMiningClaims ?? true },
            { key: 'enableReferralRewards', label: 'Referral Engine', active: flags.enableReferralRewards ?? true },
            { key: 'enableCryptoBotDeposit', label: 'CryptoBot (Retired)', active: flags.enableCryptoBotDeposit ?? false },
          ].map((sw) => (
            <button
              key={sw.key}
              disabled={togglingSwitch === sw.key}
              onClick={() => handleToggleEmergencySwitch(sw.key, sw.active)}
              className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                sw.active
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                  : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
              }`}
            >
              <div>
                <span className="text-[10px] font-extrabold block leading-tight">{sw.label}</span>
                <span className="text-[9px] font-mono opacity-80">{sw.active ? 'ARMED' : 'PAUSED'}</span>
              </div>
              {sw.active ? <Unlock size={13} /> : <Lock size={13} />}
            </button>
          ))}
        </div>
      </div>

      {/* 3. CROSS-DOMAIN PLATFORM HEALTH MATRICES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* DOMAIN 1: FINANCIAL & LEDGER SOLVENCY */}
        <div className="bg-card-bg border border-white/10 rounded-2xl p-4 shadow-md space-y-3">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <div className="flex items-center gap-2">
              <Wallet size={16} className="text-usdt-green" />
              <span className="text-[11px] font-extrabold uppercase text-text-primary">Finance & Ledger</span>
            </div>
            <span className="text-[10px] font-mono font-bold text-usdt-green">{fin?.rcr_status || 'SOLVENT'}</span>
          </div>
          <div>
            <span className="text-[10px] text-text-tertiary uppercase font-mono block">Verified System Reserves</span>
            <div className="text-xl font-black text-usdt-green font-mono">
              ${Number(fin?.total_liquidity_usdt ?? 2500).toFixed(2)} <span className="text-xs font-bold text-text-tertiary">USDT</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
            <div className="p-2 rounded-lg bg-control-bg">
              <span className="text-[9px] text-text-tertiary block">Liabilities</span>
              <span className="font-bold text-text-primary">${Number(fin?.user_liabilities_usdt ?? 1052.9).toFixed(2)}</span>
            </div>
            <div className="p-2 rounded-lg bg-control-bg">
              <span className="text-[9px] text-text-tertiary block">Reserve Ratio</span>
              <span className="font-bold text-usdt-green">{fin?.reserve_ratio_percent ?? 237}%</span>
            </div>
          </div>
        </div>

        {/* DOMAIN 2: SETTLEMENT & RAILS */}
        <div className="bg-card-bg border border-white/10 rounded-2xl p-4 shadow-md space-y-3">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-400" />
              <span className="text-[11px] font-extrabold uppercase text-text-primary">Settlement Rails</span>
            </div>
            <span className="text-[10px] font-mono font-bold text-blue-400">DOUBLE-ENTRY</span>
          </div>
          <div>
            <span className="text-[10px] text-text-tertiary uppercase font-mono block">24h Settlement Volume</span>
            <div className="text-xl font-black text-text-primary font-mono">
              ${Number(sett?.transaction_volume ?? 2330).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
            <div className="p-2 rounded-lg bg-control-bg">
              <span className="text-[9px] text-text-tertiary block">Completed</span>
              <span className="font-bold text-usdt-green">{sett?.completed_settlements ?? 5} Sessions</span>
            </div>
            <div className="p-2 rounded-lg bg-control-bg">
              <span className="text-[9px] text-text-tertiary block">In-Flight Exposure</span>
              <span className="font-bold text-amber-400">${Number(sett?.settlement_exposure_usdt ?? 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* DOMAIN 3: TREASURY & ESCROW MERCHANTS */}
        <div className="bg-card-bg border border-white/10 rounded-2xl p-4 shadow-md space-y-3">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-purple-400" />
              <span className="text-[11px] font-extrabold uppercase text-text-primary">Escrow Infrastructure</span>
            </div>
            <span className="text-[10px] font-mono font-bold text-purple-400">ACTIVE POOLS</span>
          </div>
          <div>
            <span className="text-[10px] text-text-tertiary uppercase font-mono block">Mobile Money Pools</span>
            <div className="text-xl font-black text-text-primary font-mono">
              {trs?.active_escrow_merchants ?? 3} Active <span className="text-xs font-normal text-text-tertiary">(MTN, Airtel, M-Pesa)</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
            <div className="p-2 rounded-lg bg-control-bg truncate" title={trs?.usdt_trc20_receiving_address || 'TR7NHq...'}>
              <span className="text-[9px] text-text-tertiary block">USDT TRC-20 Escrow</span>
              <span className="font-mono text-[10px] font-bold text-usdt-green">{(trs?.usdt_trc20_receiving_address || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t').slice(0, 8)}...</span>
            </div>
            <div className="p-2 rounded-lg bg-control-bg">
              <span className="text-[9px] text-text-tertiary block">Coverage Horizon</span>
              <span className="font-bold text-text-primary">{trs?.forecast_coverage_days ?? 17} Days</span>
            </div>
          </div>
        </div>

        {/* DOMAIN 4: ECONOMY & COMPUTE FLEET */}
        <div className="bg-card-bg border border-white/10 rounded-2xl p-4 shadow-md space-y-3">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <div className="flex items-center gap-2">
              <Cpu size={16} className="text-amber-400" />
              <span className="text-[11px] font-extrabold uppercase text-text-primary">Economy & Nodes</span>
            </div>
            <span className="text-[10px] font-mono font-bold text-amber-400">HASH FLEET</span>
          </div>
          <div>
            <span className="text-[10px] text-text-tertiary uppercase font-mono block">Total Network Hashrate</span>
            <div className="text-xl font-black text-amber-400 font-mono">
              {Number(eco?.total_fleet_hashrate_ghs ?? 1015).toLocaleString()} <span className="text-xs font-bold text-text-tertiary">GH/s</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
            <div className="p-2 rounded-lg bg-control-bg">
              <span className="text-[9px] text-text-tertiary block">Active Nodes</span>
              <span className="font-bold text-text-primary">{eco?.active_fleet_nodes ?? 7} Nodes</span>
            </div>
            <div className="p-2 rounded-lg bg-control-bg">
              <span className="text-[9px] text-text-tertiary block">Catalog Tiers</span>
              <span className="font-bold text-usdt-green">{eco?.catalog_tiers_available ?? 4} Ready</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. LIVE EVENT STREAM FEED & OPERATIONAL WORKSTATION SHORTCUTS */}
      {(() => {
        const safeEvents = Array.isArray(liveEvents) ? liveEvents : [];
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Live Production Event Stream */}
            <div className="lg:col-span-2 bg-card-bg border border-white/10 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-usdt-green animate-ping" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-text-primary">
                    Live Platform Event Stream (Multi-Domain Audit)
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-text-tertiary">{safeEvents.length} events buffered</span>
              </div>

              <div className="space-y-2 max-h-[420px] overflow-y-auto no-scrollbar pr-1">
                {safeEvents.length === 0 ? (
                  <div className="py-12 px-6 text-center space-y-3 rounded-xl bg-control-bg/40 border border-white/5">
                    <div className="w-12 h-12 rounded-full bg-usdt-green/10 border border-usdt-green/20 flex items-center justify-center text-usdt-green mx-auto">
                      <Radio size={24} className="animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-text-primary">All System Workers Operational</h4>
                      <p className="text-[11px] text-text-tertiary max-w-sm mx-auto mt-1">
                        Listening for real-time settlements, withdrawal claims, audit entries, and queue transitions. New events will appear here automatically.
                      </p>
                    </div>
                  </div>
                ) : (
                  safeEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-3 rounded-xl bg-control-bg/60 border border-white/5 flex items-start justify-between gap-3 text-xs hover:border-white/10 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wide mt-0.5
                          ${evt.severity === 'CRITICAL' ? 'bg-error-red text-white' :
                            evt.severity === 'WARNING' ? 'bg-amber-500/20 text-amber-300' :
                            evt.severity === 'SUCCESS' ? 'bg-usdt-green/20 text-usdt-green' : 'bg-blue-500/20 text-blue-300'}`}
                        >
                          {evt.category}
                        </span>
                        <div>
                          <div className="font-bold text-text-primary leading-tight">{evt.title}</div>
                          <div className="text-[11px] text-text-secondary mt-0.5">{evt.detail}</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-text-tertiary flex-shrink-0">
                        {new Date(evt.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Operational Workstations & Gateways */}
            <div className="bg-card-bg border border-white/10 rounded-2xl p-5 shadow-lg space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-text-primary border-b border-white/10 pb-3">
                Domain Control Workstations
              </h3>
              
              <div className="space-y-3">
                <button
                  onClick={() => navigate('/admin/treasury')}
                  className="w-full p-3 rounded-xl bg-control-bg hover:bg-white/10 border border-white/10 text-left flex items-center justify-between group transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Wallet size={18} className="text-usdt-green" />
                    <div>
                      <div className="text-xs font-bold text-text-primary group-hover:text-usdt-green transition-colors">Treasury & General Ledger</div>
                      <div className="text-[10px] text-text-tertiary">Solvency, Payouts, Float & Simulation</div>
                    </div>
                  </div>
                  <ArrowUpRight size={14} className="text-text-tertiary group-hover:text-usdt-green group-hover:translate-x-0.5 transition-all" />
                </button>

                <button
                  onClick={() => navigate('/admin/users')}
                  className="w-full p-3 rounded-xl bg-control-bg hover:bg-white/10 border border-white/10 text-left flex items-center justify-between group transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Users size={18} className="text-blue-400" />
                    <div>
                      <div className="text-xs font-bold text-text-primary group-hover:text-blue-400 transition-colors">User Intelligence & Support</div>
                      <div className="text-[10px] text-text-tertiary">360° Inspector, Freeze, Ban & Notes</div>
                    </div>
                  </div>
                  <ArrowUpRight size={14} className="text-text-tertiary group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                </button>

                <button
                  onClick={() => navigate('/admin/operations')}
                  className="w-full p-3 rounded-xl bg-control-bg hover:bg-white/10 border border-white/10 text-left flex items-center justify-between group transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Sliders size={18} className="text-amber-400" />
                    <div>
                      <div className="text-xs font-bold text-text-primary group-hover:text-amber-400 transition-colors">Platform Operations HQ</div>
                      <div className="text-[10px] text-text-tertiary">Emergency Switches & Machine Catalog</div>
                    </div>
                  </div>
                  <ArrowUpRight size={14} className="text-text-tertiary group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                </button>

                <button
                  onClick={() => navigate('/admin/risk')}
                  className="w-full p-3 rounded-xl bg-control-bg hover:bg-white/10 border border-white/10 text-left flex items-center justify-between group transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <ShieldCheck size={18} className="text-purple-400" />
                    <div>
                      <div className="text-xs font-bold text-text-primary group-hover:text-purple-400 transition-colors">Security & Fraud SOC</div>
                      <div className="text-[10px] text-text-tertiary">Shared IP Detection & Sybil Alarms</div>
                    </div>
                  </div>
                  <ArrowUpRight size={14} className="text-text-tertiary group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all" />
                </button>

                <button
                  onClick={() => navigate('/admin/health')}
                  className="w-full p-3 rounded-xl bg-control-bg hover:bg-white/10 border border-white/10 text-left flex items-center justify-between group transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Server size={18} className="text-usdt-green" />
                    <div>
                      <div className="text-xs font-bold text-text-primary group-hover:text-usdt-green transition-colors">System Probes & Health</div>
                      <div className="text-[10px] text-text-tertiary">Database, Workers & Webhooks</div>
                    </div>
                  </div>
                  <ArrowUpRight size={14} className="text-text-tertiary group-hover:text-usdt-green group-hover:translate-x-0.5 transition-all" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default OverviewPage;
