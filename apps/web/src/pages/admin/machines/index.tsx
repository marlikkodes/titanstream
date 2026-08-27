import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { MetricCard, MetricCardGrid } from '@/components/admin/MetricCard';
import { showToast } from '@/components/Toast';
import {
  Cpu,
  RefreshCw,
  Plus,
  Zap,
  ShieldCheck,
  Play,
  Key,
  Layers,
  Settings,
  AlertTriangle,
  Lock,
  Unlock,
  Sliders,
  DollarSign,
  TrendingUp,
  Clock,
  Calendar,
  Tag,
  Edit3,
} from 'lucide-react';

export interface MachineCatalogItemRecord {
  id: string;
  tierCode: string;
  name: string;
  description: string;
  category: string;
  priceUsdt: string;
  capacityGhs: string;
  dailyYieldEstimateUsdt: string;
  status: string;
  displayOrder: number;
  outputs: Array<{
    id: string;
    assetCode: string;
    baseYieldRate: string;
    multiplier: string;
    minimumLicense?: string;
    status: string;
  }>;
  _count?: { userFleet: number };
}

export interface UserAssetLicenseRecord {
  id: string;
  telegramUserId: string;
  userName: string;
  asset: string;
  status: string;
  licenseType: string;
  activatedAt: string;
  expiresAt?: string;
  grantedBy?: string;
}

export interface EconomyProfileRecord {
  id: string;
  code: string;
  name: string;
  version: number;
  yieldMultiplier: string;
  referralMultiplier: string;
  rewardMultiplier: string;
  isActive: boolean;
  priority: number;
}

import { MACHINE_CATALOG } from '@/data/machines';

const DEFAULT_MACHINES: MachineCatalogItemRecord[] = MACHINE_CATALOG.map((m, idx) => ({
  id: m.id,
  tierCode: m.tierCode,
  name: m.name,
  description: m.description,
  category: m.tierLabel || 'STANDARD',
  priceUsdt: m.priceUsdt.toFixed(2),
  capacityGhs: m.capacityGhs.toFixed(1),
  dailyYieldEstimateUsdt: (m.dailyYieldUsdt || 0).toFixed(2),
  status: m.status === 'AVAILABLE' ? 'ACTIVE' : m.status,
  displayOrder: idx + 1,
  outputs: [
    { id: `out_${m.id}_usdt`, assetCode: 'USDT', baseYieldRate: '1.0', multiplier: '1.0', status: 'ACTIVE' },
    ...(m.tierCode === 'TS_Q2500' || m.tierCode === 'TS_X1000'
      ? [{ id: `out_${m.id}_ton`, assetCode: 'TON', baseYieldRate: '0.05', multiplier: '1.2', status: 'ACTIVE' }]
      : []),
  ],
  _count: { userFleet: 0 },
}));

const DEFAULT_PROFILES: EconomyProfileRecord[] = [
  {
    id: 'ep_prod_1',
    code: 'STANDARD_PROD',
    name: 'Authoritative Production Matrix',
    version: 1,
    yieldMultiplier: '1.00',
    referralMultiplier: '1.00',
    rewardMultiplier: '1.00',
    isActive: true,
    priority: 1,
  },
  {
    id: 'ep_boost_2',
    code: 'WEEKEND_BOOST',
    name: 'Promotional Weekend Surge',
    version: 2,
    yieldMultiplier: '1.25',
    referralMultiplier: '1.10',
    rewardMultiplier: '1.50',
    isActive: false,
    priority: 2,
  },
];

const extractArray = <T,>(resData: any, fallback: T[] = []): T[] => {
  if (!resData) return fallback;
  if (Array.isArray(resData)) return resData.length > 0 ? resData : fallback;
  if (Array.isArray(resData?.data)) return resData.data.length > 0 ? resData.data : fallback;
  if (Array.isArray(resData?.items)) return resData.items.length > 0 ? resData.items : fallback;
  return fallback;
};

export const MachineControlCenterPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'CATALOG' | 'LICENSES' | 'ECONOMY' | 'SIMULATOR' | 'MAINTENANCE'>('CATALOG');
  const [loading, setLoading] = useState(false);

  // Machine Catalog State
  const [machines, setMachines] = useState<MachineCatalogItemRecord[]>(DEFAULT_MACHINES);

  // Real Ownership Statistics (live from backend / user DB)
  const [ownershipStats, setOwnershipStats] = useState<{
    totalOwnedMachines: number;
    activeComputingFleet: number;
    totalNetworkHashrateGhs: number;
    tierCounts: Record<string, number>;
  }>({ totalOwnedMachines: 0, activeComputingFleet: 0, totalNetworkHashrateGhs: 0, tierCounts: {} });

  // Asset Licenses State
  const [licenses, setLicenses] = useState<UserAssetLicenseRecord[]>([]);

  // Economy Profiles State
  const [profiles, setProfiles] = useState<EconomyProfileRecord[]>(DEFAULT_PROFILES);

  // Simulator State
  const [simDays, setSimDays] = useState<30 | 90 | 180>(90);
  const [repowerMult, setRepowerMult] = useState(1.0);
  const [payoutMult, setPayoutMult] = useState(1.0);
  const [yieldMult, setYieldMult] = useState(1.0);
  const [simResults, setSimResults] = useState<any>(null);
  const [simulating, setSimulating] = useState(false);

  // Create Machine Modal State
  const [showCreateMachineModal, setShowCreateMachineModal] = useState(false);
  const [tierCode, setTierCode] = useState('');
  const [machineName, setMachineName] = useState('');
  const [machineDesc, setMachineDesc] = useState('');
  const [priceUsdt, setPriceUsdt] = useState('');
  const [capacityGhs, setCapacityGhs] = useState('');
  const [dailyYield, setDailyYield] = useState('');
  const [submittingMachine, setSubmittingMachine] = useState(false);

  // Edit Machine Modal State
  const [editingMachine, setEditingMachine] = useState<MachineCatalogItemRecord | null>(null);
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Grant License Modal State
  const [showGrantLicenseModal, setShowGrantLicenseModal] = useState(false);
  const [grantUserId, setGrantUserId] = useState('');
  const [grantAsset, setGrantAsset] = useState('TON');
  const [grantDuration, setGrantDuration] = useState('30');
  const [grantReason, setGrantReason] = useState('');
  const [submittingGrant, setSubmittingGrant] = useState(false);

  // Fetch Machine Catalog + Real Ownership Stats
  const fetchMachines = useCallback(() => {
    setLoading(true);

    // Fetch catalog and real stats in parallel
    Promise.all([
      api.get('/admin/machines-hq/catalog').catch(() => null),
      api.get('/admin/machines-hq/stats').catch(() => null),
    ]).then(([catalogRes, statsRes]) => {
      // Process catalog
      const catalogData = extractArray(catalogRes?.data, DEFAULT_MACHINES);

      // Process real ownership stats
      const statsData = statsRes?.data?.data || statsRes?.data || {};
      const tierCounts: Record<string, number> = statsData.tierCounts || {};

      setOwnershipStats({
        totalOwnedMachines: statsData.totalOwnedMachines || 0,
        activeComputingFleet: statsData.activeComputingFleet || 0,
        totalNetworkHashrateGhs: statsData.totalNetworkHashrateGhs || 0,
        tierCounts,
      });

      // Merge real ownership counts into catalog items
      const mergedCatalog = catalogData.map((m: MachineCatalogItemRecord) => ({
        ...m,
        _count: { userFleet: tierCounts[m.tierCode] || m._count?.userFleet || 0 },
      }));
      setMachines(mergedCatalog);
    }).catch(() => {
      setMachines(DEFAULT_MACHINES);
    }).finally(() => setLoading(false));
  }, []);

  // Fetch Asset Licenses
  const fetchLicenses = useCallback(() => {
    api.get('/admin/machines-hq/licenses')
      .then((res) => setLicenses(extractArray(res.data, [])))
      .catch(() => setLicenses([]));
  }, []);

  // Fetch Economy Profiles
  const fetchProfiles = useCallback(() => {
    api.get('/admin/machines-hq/economy/profiles')
      .then((res) => setProfiles(extractArray(res.data, DEFAULT_PROFILES)))
      .catch(() => setProfiles(DEFAULT_PROFILES));
  }, []);

  useEffect(() => {
    fetchMachines();
    fetchLicenses();
    fetchProfiles();
  }, [fetchMachines, fetchLicenses, fetchProfiles]);

  const handleTabChange = (tab: 'CATALOG' | 'LICENSES' | 'ECONOMY' | 'SIMULATOR' | 'MAINTENANCE') => {
    setActiveTab(tab);
    if (tab === 'CATALOG') fetchMachines();
    if (tab === 'LICENSES') fetchLicenses();
    if (tab === 'ECONOMY') fetchProfiles();
  };

  // Submit Create Machine
  const handleCreateMachine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tierCode.trim() || !machineName.trim() || !priceUsdt) {
      showToast('Tier Code, Machine Name, and Price are mandatory', 'error');
      return;
    }

    setSubmittingMachine(true);
    api.post('/admin/machines-hq/catalog', {
      tierCode: tierCode.trim(),
      name: machineName.trim(),
      description: machineDesc.trim(),
      priceUsdt: parseFloat(priceUsdt),
      capacityGhs: parseFloat(capacityGhs) || 1.0,
      dailyYieldEstimateUsdt: parseFloat(dailyYield) || 0.5,
    })
      .then(() => {
        showToast('Machine created successfully in database catalog.', 'success');
        setShowCreateMachineModal(false);
        setTierCode('');
        setMachineName('');
        setMachineDesc('');
        setPriceUsdt('');
        setCapacityGhs('');
        setDailyYield('');
        fetchMachines();
      })
      .catch((err) => showToast(err.response?.data?.message || 'Failed to create machine', 'error'))
      .finally(() => setSubmittingMachine(false));
  };

  // Submit Edit Machine
  const handleSaveEditMachine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMachine) return;
    if (!editingMachine.name.trim() || !editingMachine.priceUsdt) {
      showToast('Machine Name and Price are mandatory', 'error');
      return;
    }

    setSubmittingEdit(true);
    api.put(`/admin/machines-hq/catalog/${editingMachine.id}`, {
      name: editingMachine.name.trim(),
      description: (editingMachine.description || '').trim(),
      category: editingMachine.category,
      priceUsdt: parseFloat(editingMachine.priceUsdt),
      capacityGhs: parseFloat(editingMachine.capacityGhs) || 1.0,
      dailyYieldEstimateUsdt: parseFloat(editingMachine.dailyYieldEstimateUsdt) || 0.5,
      status: editingMachine.status,
    })
      .then(() => {
        showToast(`Machine specifications for "${editingMachine.name}" updated successfully.`, 'success');
        setEditingMachine(null);
        fetchMachines();
      })
      .catch((err) => showToast(err.response?.data?.message || 'Failed to update machine specifications', 'error'))
      .finally(() => setSubmittingEdit(false));
  };

  // Submit Grant License
  const handleGrantLicense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantUserId.trim() || !grantReason.trim()) {
      showToast('User ID and mandatory administrative reason required', 'error');
      return;
    }

    setSubmittingGrant(true);
    api.post('/admin/machines-hq/licenses/grant', {
      telegramUserId: grantUserId.trim(),
      asset: grantAsset,
      durationDays: parseInt(grantDuration) || 30,
      reason: grantReason.trim(),
    })
      .then(() => {
        showToast(`Asset license for ${grantAsset} granted to user.`, 'success');
        setShowGrantLicenseModal(false);
        setGrantUserId('');
        setGrantReason('');
        fetchLicenses();
      })
      .catch((err) => showToast(err.response?.data?.message || 'Failed to grant license', 'error'))
      .finally(() => setSubmittingGrant(false));
  };

  // Execute Economy Simulation Dry-Run
  const handleRunSimulation = () => {
    setSimulating(true);
    api.post('/admin/machines-hq/economy/simulate', {
      daysToProject: simDays,
      repowerPriceMultiplier: repowerMult,
      payoutRateMultiplier: payoutMult,
      yieldMultiplierOverride: yieldMult,
    })
      .then((res) => {
        setSimResults(res.data);
        showToast('Dry-run economy simulation completed with zero DB mutations.', 'success');
      })
      .catch((err) => showToast(err.response?.data?.message || 'Simulation failed', 'error'))
      .finally(() => setSimulating(false));
  };

  // Activate Profile
  const handleActivateProfile = (code: string) => {
    if (!confirm(`Activate Economy Profile '${code}'? This will govern all production earning calculations.`)) return;
    api.post(`/admin/machines-hq/economy/profiles/${code}/activate`)
      .then(() => {
        showToast(`Economy profile '${code}' is now active.`, 'success');
        fetchProfiles();
      })
      .catch((err) => showToast(err.response?.data?.message || 'Activation failed', 'error'));
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-card-bg border border-white/10 rounded-2xl p-5 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center border border-usdt-green bg-usdt-green/10 text-usdt-green">
            <Cpu size={24} />
          </div>
          <div>
            <span className="text-xs text-text-tertiary font-bold uppercase tracking-wider">Machine & Economy Control Plane</span>
            <h3 className="text-lg font-extrabold text-text-primary">Titan Mining Fleet & Economy Engine</h3>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateMachineModal(true)}
            className="px-4 py-2.5 rounded-xl bg-usdt-green text-app-bg text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-md hover:brightness-110"
          >
            <Plus size={16} /> Create Machine
          </button>
          <button
            onClick={() => setShowGrantLicenseModal(true)}
            className="px-4 py-2.5 rounded-xl bg-control-bg border border-usdt-green/40 text-usdt-green text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow"
          >
            <Key size={16} /> Grant License
          </button>
          <button
            onClick={fetchMachines}
            disabled={loading}
            className="p-2.5 rounded-xl bg-control-bg border border-white/10 text-text-secondary hover:text-text-primary"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <MetricCardGrid columns={4}>
        <MetricCard
          label="Total Owned Machines"
          value={String(ownershipStats.totalOwnedMachines)}
          change={0}
          icon="Cpu"
          variant="green"
        />
        <MetricCard
          label="Active Computing Fleet"
          value={String(ownershipStats.activeComputingFleet)}
          change={0}
          icon="Zap"
          variant="green"
        />
        <MetricCard
          label="Network Hashrate"
          value={`${ownershipStats.totalNetworkHashrateGhs.toFixed(1)} GH/s`}
          change={0}
          icon="TrendingUp"
          variant="gold"
        />
        <MetricCard
          label="Catalog Tiers"
          value={String(machines.length)}
          change={0}
          icon="Sliders"
          variant="default"
        />
      </MetricCardGrid>

      {/* Navigation Tabs */}
      <div className="flex border-b border-white/10 gap-6 text-xs font-bold">
        <button
          onClick={() => handleTabChange('CATALOG')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${activeTab === 'CATALOG' ? 'border-usdt-green text-usdt-green' : 'border-transparent text-text-tertiary'}`}
        >
          <Cpu size={14} /> Machine Catalog ({machines.length})
        </button>
        <button
          onClick={() => handleTabChange('LICENSES')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${activeTab === 'LICENSES' ? 'border-usdt-green text-usdt-green' : 'border-transparent text-text-tertiary'}`}
        >
          <Key size={14} /> Asset Licenses ({licenses.length})
        </button>
        <button
          onClick={() => handleTabChange('ECONOMY')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${activeTab === 'ECONOMY' ? 'border-usdt-green text-usdt-green' : 'border-transparent text-text-tertiary'}`}
        >
          <Sliders size={14} /> Economy Profiles
        </button>
        <button
          onClick={() => handleTabChange('SIMULATOR')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${activeTab === 'SIMULATOR' ? 'border-usdt-green text-usdt-green' : 'border-transparent text-text-tertiary'}`}
        >
          <Play size={14} /> Economy Simulator
        </button>
      </div>

      {/* TAB 1: MACHINE CATALOG */}
      {activeTab === 'CATALOG' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {machines.map((m) => (
            <div key={m.id} className="p-5 rounded-xl bg-card-bg border border-white/10 space-y-4 shadow-lg flex flex-col justify-between hover:border-white/20 transition-colors">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-usdt-green">{m.tierCode}</span>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-usdt-green/10 text-usdt-green border border-usdt-green/30 uppercase">
                      {m.status}
                    </span>
                    <button
                      onClick={() => setEditingMachine({ ...m })}
                      className="p-1 rounded-md bg-control-bg hover:bg-usdt-green/20 border border-white/10 text-text-secondary hover:text-usdt-green transition-colors cursor-pointer"
                      title="Edit Machine Specifications"
                    >
                      <Edit3 size={13} />
                    </button>
                  </div>
                </div>
                <h4 className="font-extrabold text-text-primary text-base">{m.name}</h4>
                <p className="text-xs text-text-tertiary">{m.description || 'No description'}</p>

                <div className="p-3 rounded-lg bg-control-bg space-y-1 font-mono text-xs border border-white/5">
                  <div className="flex justify-between"><span className="text-text-tertiary">Price:</span> <strong className="text-usdt-green">${m.priceUsdt} USDT</strong></div>
                  <div className="flex justify-between"><span className="text-text-tertiary">Capacity:</span> <span>{m.capacityGhs} GH/s</span></div>
                  <div className="flex justify-between"><span className="text-text-tertiary">Daily Yield:</span> <span>${m.dailyYieldEstimateUsdt} USDT</span></div>
                </div>

                {/* Multi-Asset Output Streams */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-bold uppercase text-text-tertiary block">Multi-Asset Output Streams ({(m.outputs || []).length})</span>
                  <div className="flex flex-wrap gap-1">
                    {(m.outputs || []).map((out) => (
                      <span key={out.id} className="px-2 py-1 rounded bg-control-bg border border-white/10 text-[10px] font-mono text-text-secondary">
                        {out.assetCode} ({out.status})
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-text-tertiary border-t border-white/5 pt-2 flex items-center justify-between">
                <span>Fleet Owned: <strong className="text-text-primary font-mono">{m._count?.userFleet || 0}</strong></span>
                <button
                  onClick={() => setEditingMachine({ ...m })}
                  className="text-[11px] font-bold text-usdt-green hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 size={12} /> Edit Specs
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: ASSET LICENSES */}
      {activeTab === 'LICENSES' && (
        <div className="space-y-3">
          {licenses.map((l) => (
            <div key={l.id} className="p-4 rounded-xl bg-card-bg border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-text-primary">{l.asset} License</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${l.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                    {l.status}
                  </span>
                  <span className="text-[10px] text-text-tertiary uppercase">({l.licenseType})</span>
                </div>
                <div className="text-xs text-text-secondary mt-1 font-mono">
                  Owner Telegram: {l.telegramUserId} ({l.userName}) | Granted By: {l.grantedBy || 'SYSTEM'}
                </div>
              </div>

              <div className="text-xs font-mono text-text-tertiary">
                Activated: {new Date(l.activatedAt).toLocaleDateString()}
              </div>
            </div>
          ))}
          {licenses.length === 0 && (
            <div className="p-8 text-center bg-card-bg rounded-xl border border-white/5 text-xs text-text-tertiary">
              No asset licenses granted yet.
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ECONOMY PROFILES */}
      {activeTab === 'ECONOMY' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {profiles.map((p) => (
            <div key={p.id} className="p-5 rounded-xl bg-card-bg border border-white/10 space-y-3 shadow-lg flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-usdt-green">{p.code} (v{p.version})</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.isActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-control-bg text-text-tertiary'}`}>
                    {p.isActive ? 'ACTIVE PRODUCTION' : 'INACTIVE'}
                  </span>
                </div>
                <h4 className="font-extrabold text-text-primary text-base">{p.name}</h4>

                <div className="p-3 rounded-lg bg-control-bg space-y-1 font-mono text-xs border border-white/5">
                  <div className="flex justify-between"><span className="text-text-tertiary">Yield Mult:</span> <strong>{p.yieldMultiplier}x</strong></div>
                  <div className="flex justify-between"><span className="text-text-tertiary">Referral Mult:</span> <span>{p.referralMultiplier}x</span></div>
                  <div className="flex justify-between"><span className="text-text-tertiary">Reward Mult:</span> <span>{p.rewardMultiplier}x</span></div>
                </div>
              </div>

              {!p.isActive && (
                <button
                  onClick={() => handleActivateProfile(p.code)}
                  className="w-full py-2 rounded-xl bg-usdt-green text-app-bg text-xs font-bold uppercase tracking-wider"
                >
                  Activate Profile
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* TAB 4: ECONOMY SIMULATOR */}
      {activeTab === 'SIMULATOR' && (
        <div className="bg-card-bg border border-white/10 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-text-primary flex items-center gap-2">
              <Play size={16} className="text-usdt-green" /> Isolated Economy Simulator (Zero DB Mutations)
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Projection Horizon</label>
              <select
                value={simDays}
                onChange={(e) => setSimDays(Number(e.target.value) as any)}
                className="w-full bg-control-bg text-text-primary text-xs rounded-xl p-2.5 border border-white/10"
              >
                <option value={30}>30 Days</option>
                <option value={90}>90 Days</option>
                <option value={180}>180 Days</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Repower Price Mult ({repowerMult}x)</label>
              <input
                type="range"
                min={0.5}
                max={2.0}
                step={0.1}
                value={repowerMult}
                onChange={(e) => setRepowerMult(parseFloat(e.target.value))}
                className="w-full accent-usdt-green"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Payout Rate Mult ({payoutMult}x)</label>
              <input
                type="range"
                min={0.5}
                max={2.0}
                step={0.1}
                value={payoutMult}
                onChange={(e) => setPayoutMult(parseFloat(e.target.value))}
                className="w-full accent-usdt-green"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Yield Override ({yieldMult}x)</label>
              <input
                type="range"
                min={0.5}
                max={2.0}
                step={0.1}
                value={yieldMult}
                onChange={(e) => setYieldMult(parseFloat(e.target.value))}
                className="w-full accent-usdt-green"
              />
            </div>
          </div>

          <button
            onClick={handleRunSimulation}
            disabled={simulating}
            className="px-4 py-2.5 rounded-xl bg-usdt-green text-app-bg text-xs font-black uppercase tracking-wider flex items-center gap-2 disabled:opacity-50"
          >
            <Play size={14} /> {simulating ? 'Running Isolated Dry-Run Scenario...' : 'Execute Economy Simulation'}
          </button>

          {simResults && (
            <div className="p-4 rounded-xl bg-control-bg border border-usdt-green/30 space-y-2 mt-4 text-xs font-mono">
              <div className="flex items-center justify-between font-bold">
                <span>Solvency Status: <strong className="text-usdt-green">{simResults.results?.solvencyStatus}</strong></span>
                <span>Reserve Ratio: <strong>{simResults.results?.projectedReserveRatio}%</strong></span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px] pt-2 border-t border-white/5">
                <div>Total Inflow: <strong>${simResults.results?.totalProjectedInflow}</strong></div>
                <div>Total Outflow: <strong>${simResults.results?.totalProjectedOutflow}</strong></div>
                <div>Net Solvency Delta: <strong>${simResults.results?.netSolvencyDelta}</strong></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CREATE MACHINE MODAL */}
      {showCreateMachineModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-app-bg-secondary border border-usdt-green/40 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-extrabold text-text-primary uppercase tracking-wider flex items-center gap-2">
                <Cpu size={18} className="text-usdt-green" /> Create Database Machine Tier
              </h3>
              <button onClick={() => setShowCreateMachineModal(false)} className="text-text-tertiary hover:text-text-primary">✕</button>
            </div>

            <form onSubmit={handleCreateMachine} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Tier Code</label>
                  <input
                    type="text"
                    placeholder="e.g. TS_RIPPLE_X"
                    value={tierCode}
                    onChange={(e) => setTierCode(e.target.value)}
                    className="w-full bg-control-bg text-text-primary text-xs rounded-xl p-3 border border-white/10"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Machine Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Ripple X14"
                    value={machineName}
                    onChange={(e) => setMachineName(e.target.value)}
                    className="w-full bg-control-bg text-text-primary text-xs rounded-xl p-3 border border-white/10"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Description</label>
                <textarea
                  placeholder="Machine technical description..."
                  value={machineDesc}
                  onChange={(e) => setMachineDesc(e.target.value)}
                  className="w-full bg-control-bg text-text-primary text-xs rounded-xl p-3 border border-white/10"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Price (USDT)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="10.99"
                    value={priceUsdt}
                    onChange={(e) => setPriceUsdt(e.target.value)}
                    className="w-full bg-control-bg text-text-primary text-xs rounded-xl p-3 border border-white/10"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Capacity (GH/s)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="5.0"
                    value={capacityGhs}
                    onChange={(e) => setCapacityGhs(e.target.value)}
                    className="w-full bg-control-bg text-text-primary text-xs rounded-xl p-3 border border-white/10"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Est. Daily Yield ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.27"
                    value={dailyYield}
                    onChange={(e) => setDailyYield(e.target.value)}
                    className="w-full bg-control-bg text-text-primary text-xs rounded-xl p-3 border border-white/10"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateMachineModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-control-bg border border-white/10 text-xs font-bold text-text-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingMachine}
                  className="flex-1 py-2.5 rounded-xl bg-usdt-green text-app-bg text-xs font-black uppercase tracking-wider"
                >
                  {submittingMachine ? 'Creating...' : 'Create Machine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MACHINE MODAL */}
      {editingMachine && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-app-bg-secondary border border-usdt-green/40 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-extrabold text-text-primary uppercase tracking-wider flex items-center gap-2">
                <Edit3 size={18} className="text-usdt-green" /> Edit Machine Specs ({editingMachine.tierCode})
              </h3>
              <button onClick={() => setEditingMachine(null)} className="text-text-tertiary hover:text-text-primary cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveEditMachine} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Tier Code</label>
                  <input
                    type="text"
                    value={editingMachine.tierCode}
                    disabled
                    className="w-full bg-control-bg text-text-tertiary font-mono text-xs rounded-xl p-3 border border-white/5 opacity-70 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Machine Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Ripple X14"
                    value={editingMachine.name}
                    onChange={(e) => setEditingMachine({ ...editingMachine, name: e.target.value })}
                    className="w-full bg-control-bg text-text-primary text-xs rounded-xl p-3 border border-white/10 focus:border-usdt-green"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Category / Tier Label</label>
                <input
                  type="text"
                  placeholder="e.g. Tier 1 Machine"
                  value={editingMachine.category}
                  onChange={(e) => setEditingMachine({ ...editingMachine, category: e.target.value })}
                  className="w-full bg-control-bg text-text-primary text-xs rounded-xl p-3 border border-white/10 focus:border-usdt-green"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Description</label>
                <textarea
                  placeholder="Machine technical description..."
                  value={editingMachine.description}
                  onChange={(e) => setEditingMachine({ ...editingMachine, description: e.target.value })}
                  className="w-full bg-control-bg text-text-primary text-xs rounded-xl p-3 border border-white/10 focus:border-usdt-green"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Price (USDT)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="10.99"
                    value={editingMachine.priceUsdt}
                    onChange={(e) => setEditingMachine({ ...editingMachine, priceUsdt: e.target.value })}
                    className="w-full bg-control-bg text-text-primary text-xs rounded-xl p-3 border border-white/10 focus:border-usdt-green"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Capacity (GH/s)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="5.0"
                    value={editingMachine.capacityGhs}
                    onChange={(e) => setEditingMachine({ ...editingMachine, capacityGhs: e.target.value })}
                    className="w-full bg-control-bg text-text-primary text-xs rounded-xl p-3 border border-white/10 focus:border-usdt-green"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Est. Daily Yield ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.27"
                    value={editingMachine.dailyYieldEstimateUsdt}
                    onChange={(e) => setEditingMachine({ ...editingMachine, dailyYieldEstimateUsdt: e.target.value })}
                    className="w-full bg-control-bg text-text-primary text-xs rounded-xl p-3 border border-white/10 focus:border-usdt-green"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Status</label>
                <select
                  value={editingMachine.status}
                  onChange={(e) => setEditingMachine({ ...editingMachine, status: e.target.value })}
                  className="w-full bg-control-bg text-text-primary text-xs rounded-xl p-3 border border-white/10 focus:border-usdt-green"
                >
                  <option value="ACTIVE">ACTIVE (Available for Purchase & Computing)</option>
                  <option value="AVAILABLE">AVAILABLE</option>
                  <option value="PAUSED">PAUSED (Temporarily Maintenance)</option>
                  <option value="COMING_SOON">COMING_SOON</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingMachine(null)}
                  className="flex-1 py-2.5 rounded-xl bg-control-bg border border-white/10 text-xs font-bold text-text-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="flex-1 py-2.5 rounded-xl bg-usdt-green text-app-bg text-xs font-black uppercase tracking-wider cursor-pointer hover:brightness-110 disabled:opacity-50"
                >
                  {submittingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GRANT LICENSE MODAL */}
      {showGrantLicenseModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-app-bg-secondary border border-usdt-green/40 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-extrabold text-text-primary uppercase tracking-wider flex items-center gap-2">
                <Key size={18} className="text-usdt-green" /> Grant Asset License
              </h3>
              <button onClick={() => setShowGrantLicenseModal(false)} className="text-text-tertiary hover:text-text-primary">✕</button>
            </div>

            <form onSubmit={handleGrantLicense} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Target Telegram User ID</label>
                <input
                  type="text"
                  placeholder="e.g. 123456789"
                  value={grantUserId}
                  onChange={(e) => setGrantUserId(e.target.value)}
                  className="w-full bg-control-bg text-text-primary text-xs rounded-xl p-3 border border-white/10"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Asset</label>
                  <select
                    value={grantAsset}
                    onChange={(e) => setGrantAsset(e.target.value)}
                    className="w-full bg-control-bg text-text-primary text-xs rounded-xl p-3 border border-white/10"
                  >
                    <option value="TON">TON</option>
                    <option value="XRP">XRP</option>
                    <option value="BTC">BTC</option>
                    <option value="ETH">ETH</option>
                    <option value="SOL">SOL</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Duration (Days)</label>
                  <input
                    type="number"
                    value={grantDuration}
                    onChange={(e) => setGrantDuration(e.target.value)}
                    className="w-full bg-control-bg text-text-primary text-xs rounded-xl p-3 border border-white/10"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-text-tertiary block mb-1">Mandatory Administrative Reason</label>
                <textarea
                  placeholder="Reason for granting asset license..."
                  value={grantReason}
                  onChange={(e) => setGrantReason(e.target.value)}
                  className="w-full bg-control-bg text-text-primary text-xs rounded-xl p-3 border border-white/10"
                  rows={2}
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGrantLicenseModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-control-bg border border-white/10 text-xs font-bold text-text-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingGrant}
                  className="flex-1 py-2.5 rounded-xl bg-usdt-green text-app-bg text-xs font-black uppercase tracking-wider"
                >
                  {submittingGrant ? 'Granting...' : 'Grant License'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
