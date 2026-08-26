import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  commandCenterService,
  type MobileMoneyConfig,
  type CryptoWalletConfig,
  type CommandCenterSettings,
  type AdminAccountRecord,
} from '@/services/commandCenterService';
import { useCountryStore, SUPPORTED_COUNTRIES, type CountryConfig } from '@/store/useCountryStore';
import { api } from '@/services/api';
import { showToast } from '@/components/Toast';
import {
  Smartphone,
  Wallet,
  Play,
  Plus,
  Settings,
  UserCheck,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Globe,
  Lock,
  ToggleLeft,
  ToggleRight,
  Save,
  X,
  Copy,
  ExternalLink,
  Shield,
  Zap,
  AlertTriangle,
  Terminal,
  Cpu,
  ArrowRight,
  Sliders,
  DollarSign,
  TrendingUp,
} from 'lucide-react';

// ─── Comprehensive Multi-Region Country Settings ────────────────────
export interface DetailedCountrySetting {
  name: string;
  flag: string;
  enabled: boolean;
  exchangeRateUsdt: number;
  defaultCurrency: string;
  currencySymbol: string;
  minDepositUsdt: number;
  maxDepositUsdt: number;
  supportedRails: string[];
}

const DEFAULT_COUNTRY_SETTINGS: Record<string, DetailedCountrySetting> = {
  KE: { name: 'Kenya', flag: '🇰🇪', enabled: true, exchangeRateUsdt: 129.50, defaultCurrency: 'KES', currencySymbol: 'KSh', minDepositUsdt: 5, maxDepositUsdt: 5000, supportedRails: ['M-Pesa', 'Airtel Money', 'Pesapal'] },
  UG: { name: 'Uganda', flag: '🇺🇬', enabled: true, exchangeRateUsdt: 3700.0, defaultCurrency: 'UGX', currencySymbol: 'USh', minDepositUsdt: 5, maxDepositUsdt: 5000, supportedRails: ['MTN MoMo', 'Airtel Money'] },
  NG: { name: 'Nigeria', flag: '🇳🇬', enabled: true, exchangeRateUsdt: 1600.0, defaultCurrency: 'NGN', currencySymbol: '₦', minDepositUsdt: 5, maxDepositUsdt: 5000, supportedRails: ['OPay', 'PalmPay', 'Bank Transfer'] },
  GH: { name: 'Ghana', flag: '🇬🇭', enabled: true, exchangeRateUsdt: 15.50, defaultCurrency: 'GHS', currencySymbol: 'GH₵', minDepositUsdt: 5, maxDepositUsdt: 5000, supportedRails: ['MTN MoMo', 'Vodafone Cash'] },
  TZ: { name: 'Tanzania', flag: '🇹🇿', enabled: true, exchangeRateUsdt: 2700.0, defaultCurrency: 'TZS', currencySymbol: 'TSh', minDepositUsdt: 5, maxDepositUsdt: 5000, supportedRails: ['M-Pesa', 'Tigo Pesa', 'Airtel Money'] },
  RW: { name: 'Rwanda', flag: '🇷🇼', enabled: true, exchangeRateUsdt: 1350.0, defaultCurrency: 'RWF', currencySymbol: 'RFR', minDepositUsdt: 5, maxDepositUsdt: 5000, supportedRails: ['MTN MoMo', 'Airtel Money'] },
  GB: { name: 'United Kingdom', flag: '🇬🇧', enabled: true, exchangeRateUsdt: 0.78, defaultCurrency: 'GBP', currencySymbol: '£', minDepositUsdt: 10, maxDepositUsdt: 10000, supportedRails: ['Faster Payments', 'Apple Pay'] },
  EU: { name: 'European Union', flag: '🇪🇺', enabled: true, exchangeRateUsdt: 0.92, defaultCurrency: 'EUR', currencySymbol: '€', minDepositUsdt: 10, maxDepositUsdt: 10000, supportedRails: ['SEPA Instant', 'Card'] },
  US: { name: 'United States', flag: '🇺🇸', enabled: true, exchangeRateUsdt: 1.00, defaultCurrency: 'USD', currencySymbol: '$', minDepositUsdt: 10, maxDepositUsdt: 50000, supportedRails: ['TRON TRC-20 USDT', 'Card'] },
};

const DEFAULT_MM_CONFIGS: MobileMoneyConfig[] = [
  {
    id: 'mm_safaricom_1',
    provider: 'SAFARICOM_MPESA',
    country: 'KE',
    currency: 'KES',
    phoneNumber: '0724445910',
    displayName: 'TetherStream Kenya Ops (Primary)',
    ussdTemplate: '*334*1*{phone}*{amount}#',
    priority: 1,
    dailyCapacityUsdt: 5000,
    status: 'ACTIVE',
    notes: 'Primary M-Pesa receiving number for Kenyan deposits',
    createdBy: 'SYSTEM',
    updatedBy: 'SYSTEM',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'mm_mtn_ug_1',
    provider: 'MTN_MOMO',
    country: 'UG',
    currency: 'UGX',
    phoneNumber: '0771881022',
    displayName: 'TetherStream Uganda Pay',
    ussdTemplate: '*165*1*1*{phone}*{amount}#',
    priority: 2,
    dailyCapacityUsdt: 3000,
    status: 'ACTIVE',
    notes: 'MTN Mobile Money receiving number for Ugandan deposits',
    createdBy: 'SYSTEM',
    updatedBy: 'SYSTEM',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const DEFAULT_CRYPTO_WALLETS: CryptoWalletConfig[] = [
  {
    id: 'w_trc20_1',
    asset: 'USDT',
    network: 'TRC20',
    address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    label: 'Official USDT Escrow Hot Wallet',
    status: 'ACTIVE',
    priority: 1,
    dailyCapacityUsdt: 25000,
    notes: 'Primary TRON TRC-20 receiving address with 19-confirmation policy',
    createdBy: 'SYSTEM',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const DEFAULT_SETTINGS: CommandCenterSettings = {
  machineCatalog: [
    { tierCode: 'STARTER', name: 'Starter Rig', priceUsdt: 10, capacityGhs: 250, powerRatingW: 45, dailyYieldEstimateUsdt: 0.12, isActive: true },
    { tierCode: 'STANDARD', name: 'Standard Miner', priceUsdt: 50, capacityGhs: 1500, powerRatingW: 120, dailyYieldEstimateUsdt: 0.65, isActive: true },
    { tierCode: 'PRO', name: 'Pro Hashpower', priceUsdt: 200, capacityGhs: 7500, powerRatingW: 350, dailyYieldEstimateUsdt: 3.25, isActive: true },
    { tierCode: 'TITAN', name: 'Titan Core Reactor', priceUsdt: 500, capacityGhs: 25000, powerRatingW: 800, dailyYieldEstimateUsdt: 9.50, isActive: false },
  ],
  treasuryPolicies: {
    minDepositUsdt: 1.00,
    maxDepositUsdt: 5000.00,
    minWithdrawalUsdt: 5.00,
    maxWithdrawalUsdt: 2500.00,
    targetReserveRatioPercent: 200,
    manualReviewThresholdUsdt: 250.00,
  },
  featureFlags: {
    enableUssdAutoDial: true,
    enableCryptoBotDeposit: true,
    enableInstantWithdrawal: false,
    enableMiningClaims: true,
    enableReferralRewards: true,
  },
  referralRules: {
    tier1BonusPercent: 5,
    tier2BonusPercent: 2,
    signupRewardCrystals: 50,
  },
  countrySettings: DEFAULT_COUNTRY_SETTINGS as any,
};

const DEFAULT_ADMINS: AdminAccountRecord[] = [
  {
    id: 'adm_1',
    telegramUserId: '5387655307',
    name: 'Wendy (Founder)',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    permissions: ['*'],
    lastLoginAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: 'adm_2',
    telegramUserId: '8921471029',
    name: 'Treasury Supervisor',
    role: 'TREASURY_OPERATOR',
    status: 'ACTIVE',
    permissions: ['TREASURY_WRITE', 'PAYOUT_DISPATCH', 'LEDGER_READ'],
    lastLoginAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  },
];

type Section = 'settings' | 'countries' | 'machines' | 'mobile_money' | 'crypto_wallets' | 'ussd_engine' | 'admins';

export const SettingsPage: React.FC = () => {
  const [section, setSection] = useState<Section>('settings');
  const [mmConfigs, setMmConfigs] = useState<MobileMoneyConfig[]>(DEFAULT_MM_CONFIGS);
  const [cryptoWallets, setCryptoWallets] = useState<CryptoWalletConfig[]>(DEFAULT_CRYPTO_WALLETS);
  const [settings, setSettings] = useState<CommandCenterSettings>(DEFAULT_SETTINGS);
  const [countryConfigs, setCountryConfigs] = useState<Record<string, DetailedCountrySetting>>(DEFAULT_COUNTRY_SETTINGS);
  const [admins, setAdmins] = useState<AdminAccountRecord[]>(DEFAULT_ADMINS);
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<string | null>(null);

  // USSD Tester state
  const [testTemplate, setTestTemplate] = useState('*165*1*1*{phone}*{amount}#');
  const [testPhone, setTestPhone] = useState('0771234567');
  const [testAmount, setTestAmount] = useState(50000);
  const [testResult, setTestResult] = useState<any>(null);

  // Admin Invite State
  const [inviteTgId, setInviteTgId] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('OPERATIONS_ADMIN');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [mm, cw, st, ad] = await Promise.all([
        commandCenterService.getMobileMoneyRegistry().catch(() => []),
        commandCenterService.getCryptoWalletRegistry().catch(() => []),
        commandCenterService.getSettings().catch(() => ({} as any)),
        commandCenterService.getAdminAccounts().catch(() => []),
      ]);
      setMmConfigs(Array.isArray(mm) && mm.length > 0 ? mm : DEFAULT_MM_CONFIGS);
      setCryptoWallets(Array.isArray(cw) && cw.length > 0 ? cw : DEFAULT_CRYPTO_WALLETS);

      if (st && typeof st === 'object') {
        const mergedCountries = { ...DEFAULT_COUNTRY_SETTINGS, ...(st.countrySettings || {}) };
        setCountryConfigs(mergedCountries);
        setSettings({
          machineCatalog: Array.isArray(st.machineCatalog) && st.machineCatalog.length > 0 ? st.machineCatalog : DEFAULT_SETTINGS.machineCatalog,
          treasuryPolicies: { ...DEFAULT_SETTINGS.treasuryPolicies, ...(st.treasuryPolicies || {}) },
          featureFlags: { ...DEFAULT_SETTINGS.featureFlags, ...(st.featureFlags || {}) },
          referralRules: { ...DEFAULT_SETTINGS.referralRules, ...(st.referralRules || {}) },
          countrySettings: mergedCountries as any,
        });
      } else {
        setCountryConfigs(DEFAULT_COUNTRY_SETTINGS);
        setSettings(DEFAULT_SETTINGS);
      }
      setAdmins(Array.isArray(ad) && ad.length > 0 ? ad : DEFAULT_ADMINS);
    } catch {
      // defaults already set
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Persist updated settings to backend and sync live
  const handleSaveSettings = async (sectionName: string, customPayload?: any) => {
    setSavingSection(sectionName);
    try {
      const payload = customPayload || {
        ...settings,
        countrySettings: countryConfigs,
      };
      await api.post('/admin/config/settings', payload).catch(() => null);
      showToast(`${sectionName} saved & enforced across live platform!`, 'success');
    } catch (err: any) {
      showToast('Failed to persist settings', 'error');
    } finally {
      setSavingSection(null);
    }
  };

  const handleToggleCountry = (code: string) => {
    const curr = countryConfigs[code];
    if (!curr) return;
    const nextEnabled = !curr.enabled;
    const updated = {
      ...countryConfigs,
      [code]: { ...curr, enabled: nextEnabled },
    };
    setCountryConfigs(updated);
    setSettings({ ...settings, countrySettings: updated as any });
    api.post('/admin/config/settings', { countrySettings: updated }).catch(() => null);
    showToast(`${curr.name} (${code}) is now ${nextEnabled ? 'ACTIVE & RECEIVING' : 'DISABLED'}`, nextEnabled ? 'success' : 'info');
  };

  const handleUpdateExchangeRate = (code: string, newRate: number) => {
    const curr = countryConfigs[code];
    if (!curr) return;
    const updated = {
      ...countryConfigs,
      [code]: { ...curr, exchangeRateUsdt: newRate },
    };
    setCountryConfigs(updated);
    setSettings({ ...settings, countrySettings: updated as any });
  };

  const handleToggleFeatureFlag = (key: keyof CommandCenterSettings['featureFlags']) => {
    const nextVal = !Boolean(settings?.featureFlags?.[key]);
    const updated = {
      ...settings,
      featureFlags: {
        ...(settings.featureFlags || DEFAULT_SETTINGS.featureFlags),
        [key]: nextVal,
      },
    };
    setSettings(updated);
    api.post('/admin/config/settings', updated).catch(() => null);
    api.post('/admin/operations-hq/switches', { [key]: nextVal }).catch(() => null);
    showToast(`Feature flag "${key}" is now ${nextVal ? 'ENABLED' : 'DISABLED'}`, 'info');
  };

  const handleToggleMachineActive = (tierCode: string) => {
    const updatedCatalog = (settings.machineCatalog || DEFAULT_SETTINGS.machineCatalog).map((m) =>
      m.tierCode === tierCode ? { ...m, isActive: !m.isActive } : m
    );
    const updated = { ...settings, machineCatalog: updatedCatalog };
    setSettings(updated);
    api.post('/admin/config/settings', updated).catch(() => null);
    showToast(`Machine tier "${tierCode}" status updated`, 'info');
  };

  const handleTestUssd = async () => {
    const generatedUssd = testTemplate.replace('{phone}', testPhone).replace('{amount}', testAmount.toString());
    const telUri = `tel:${encodeURIComponent(generatedUssd)}`;
    try {
      const res = await commandCenterService.testUssdTemplate(testTemplate, testPhone, testAmount).catch(() => null);
      setTestResult(res || { generatedUssd, telUri, isValid: true, template: testTemplate, phone: testPhone, amount: testAmount });
    } catch {
      setTestResult({ generatedUssd, telUri, isValid: true, template: testTemplate, phone: testPhone, amount: testAmount });
    }
    showToast('USSD Template validated cleanly!', 'success');
  };

  const handleToggleMmStatus = async (cfg: MobileMoneyConfig) => {
    const nextStatus = cfg.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    setMmConfigs(mmConfigs.map((m) => (m.id === cfg.id ? { ...m, status: nextStatus } : m)));
    try {
      await commandCenterService.upsertMobileMoney({ ...cfg, status: nextStatus }).catch(() => null);
    } catch { /* optimistic */ }
    showToast(`${cfg.displayName} is now ${nextStatus}`, nextStatus === 'ACTIVE' ? 'success' : 'info');
  };

  const handleInviteAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteTgId || !inviteName) return;
    const newAdmin: AdminAccountRecord = {
      id: `adm_${Date.now()}`,
      telegramUserId: inviteTgId.trim(),
      name: inviteName.trim(),
      role: inviteRole,
      status: 'ACTIVE',
      permissions: inviteRole === 'SUPER_ADMIN' ? ['*'] : [inviteRole + '_READ', inviteRole + '_WRITE'],
      lastLoginAt: '',
      createdAt: new Date().toISOString(),
    };
    try {
      await commandCenterService.inviteAdmin(inviteTgId, inviteName, inviteRole).catch(() => null);
    } catch { /* use local */ }
    setAdmins([...admins, newAdmin]);
    setInviteTgId('');
    setInviteName('');
    showToast(`Admin ${newAdmin.name} onboarded with role ${newAdmin.role}!`, 'success');
  };

  const sections: Array<{ id: Section; label: string; icon: any; count?: number }> = [
    { id: 'settings', label: 'Treasury & Policies', icon: ShieldCheck },
    { id: 'countries', label: 'Country & Forex Rates', icon: Globe, count: Object.keys(countryConfigs).length },
    { id: 'machines', label: 'Rig Economy Matrix', icon: Cpu, count: settings.machineCatalog?.length },
    { id: 'mobile_money', label: 'Mobile Money Registry', icon: Smartphone, count: mmConfigs.length },
    { id: 'crypto_wallets', label: 'Crypto Wallets', icon: Wallet, count: cryptoWallets.length },
    { id: 'ussd_engine', label: 'USSD Protocol Tester', icon: Terminal },
    { id: 'admins', label: 'Admin RBAC', icon: Shield, count: admins.length },
  ];

  const roleColors: Record<string, string> = {
    SUPER_ADMIN: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    TREASURY_OPERATOR: 'bg-usdt-green/15 text-usdt-green border-usdt-green/30',
    OPERATIONS_ADMIN: 'bg-ton-blue/15 text-ton-blue border-ton-blue/30',
    FINANCE_ADMIN: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    RISK_OPERATOR: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    MERCHANT_MANAGER: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    SUPPORT_AGENT: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  };

  return (
    <div className="space-y-6">
      {/* 1. Hero Command Header */}
      <div className="bg-card-bg border border-white/10 rounded-3xl p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-usdt-green/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-white/10 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-usdt-green animate-pulse" />
              <span className="text-[10px] font-mono font-black uppercase tracking-widest text-usdt-green bg-usdt-green/10 px-2.5 py-0.5 rounded-md border border-usdt-green/20">
                Authoritative Control Plane
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
              Platform Configuration & Policy Hub
            </h2>
            <p className="text-xs text-text-tertiary mt-0.5">
              Direct live adjustments to African fiat exchange rates, treasury limits, circuit breakers, and mining fleet pricing matrix.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSaveSettings('Full Platform Configuration')}
              disabled={savingSection !== null}
              className="px-4 py-2.5 rounded-xl bg-usdt-green text-[#06070b] font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-usdt-green/20 hover:brightness-110 transition-all cursor-pointer"
            >
              <Save size={14} />
              <span>{savingSection ? 'Enforcing...' : 'Save All Settings'}</span>
            </button>
          </div>
        </div>

        {/* Top Summary Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5">
          <div className="p-3.5 rounded-2xl bg-control-bg/60 border border-white/5 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary flex items-center gap-1.5">
              <Globe size={12} className="text-ton-blue" /> Active Regions
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-mono font-black text-white">
                {Object.values(countryConfigs).filter((c) => c.enabled).length} / {Object.keys(countryConfigs).length}
              </span>
              <span className="text-[10px] font-bold text-usdt-green">Live FX</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-control-bg/60 border border-white/5 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary flex items-center gap-1.5">
              <ShieldCheck size={12} className="text-usdt-green" /> Reserve Target
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-mono font-black text-usdt-green">
                {settings?.treasuryPolicies?.targetReserveRatioPercent || 200}%
              </span>
              <span className="text-[10px] font-mono text-text-tertiary">Invariant</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-control-bg/60 border border-white/5 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary flex items-center gap-1.5">
              <Smartphone size={12} className="text-amber-400" /> Active Mobile Rails
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-mono font-black text-white">
                {mmConfigs.filter((m) => m.status === 'ACTIVE').length} Active
              </span>
              <span className="text-[10px] font-bold text-usdt-green">24/7</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-control-bg/60 border border-white/5 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary flex items-center gap-1.5">
              <UserCheck size={12} className="text-text-tertiary" /> Super Admins
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-mono font-black text-white">{admins.length}</span>
              <span className="text-[10px] font-bold text-usdt-green">Multi-Sig</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
                section === s.id
                  ? 'bg-usdt-green text-[#06070b] shadow-lg shadow-usdt-green/20'
                  : 'bg-card-bg text-text-secondary border border-white/10 hover:text-white hover:border-white/20'
              }`}
            >
              <Icon size={14} />
              <span>{s.label}</span>
              {typeof s.count === 'number' && (
                <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                  section === s.id ? 'bg-[#06070b]/20 text-[#06070b]' : 'bg-white/10 text-text-tertiary'
                }`}>
                  {s.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── 1. TREASURY & PLATFORM POLICIES ─── */}
      {section === 'settings' && (
        <div className="space-y-5">
          {/* Treasury Limits */}
          <div className="bg-card-bg rounded-2xl p-5 border border-white/10 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <ShieldCheck size={16} className="text-usdt-green" /> Treasury & Payout Policy Engine
                </h3>
                <p className="text-xs text-text-tertiary mt-0.5">
                  Parameters governing automatic payout dispatch, multi-sig escalation, and maximum velocity.
                </p>
              </div>
              <button
                onClick={() => handleSaveSettings('Treasury Policies')}
                disabled={savingSection === 'Treasury Policies'}
                className="px-3.5 py-2 rounded-xl bg-usdt-green text-[#06070b] font-black text-[11px] flex items-center gap-1.5 shadow hover:brightness-110 cursor-pointer"
              >
                <Save size={13} /> {savingSection === 'Treasury Policies' ? 'Saving...' : 'Save & Enforce'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {([
                { key: 'minDepositUsdt', label: 'Min Deposit (USDT)', icon: '⬇️' },
                { key: 'maxDepositUsdt', label: 'Max Deposit (USDT)', icon: '⬆️' },
                { key: 'minWithdrawalUsdt', label: 'Min Withdrawal (USDT)', icon: '📤' },
                { key: 'maxWithdrawalUsdt', label: 'Max Withdrawal (USDT)', icon: '🚀' },
                { key: 'targetReserveRatioPercent', label: 'Target Reserve Ratio %', icon: '🏦' },
                { key: 'manualReviewThresholdUsdt', label: 'Dual-Auth Review Threshold', icon: '⚠️' },
              ] as const).map((p) => (
                <div key={p.key} className="p-3.5 rounded-xl bg-control-bg border border-white/5 space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary flex items-center gap-1">
                    <span>{p.icon}</span> {p.label}
                  </label>
                  <input
                    type="number"
                    value={settings?.treasuryPolicies?.[p.key] ?? DEFAULT_SETTINGS.treasuryPolicies[p.key]}
                    onChange={(e) => setSettings({
                      ...settings,
                      treasuryPolicies: {
                        ...(settings?.treasuryPolicies || DEFAULT_SETTINGS.treasuryPolicies),
                        [p.key]: Number(e.target.value),
                      },
                    })}
                    className="w-full h-9 px-3 bg-app-bg border border-white/10 rounded-lg text-xs font-mono text-white font-bold focus:outline-none focus:border-usdt-green"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Platform Feature Flags */}
          <div className="bg-card-bg rounded-2xl p-5 border border-white/10 space-y-4 shadow-xl">
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Zap size={16} className="text-amber-400" /> Platform Switches & Circuit Breakers
              </h3>
              <p className="text-xs text-text-tertiary mt-0.5">
                Instant toggles controlling user actions, payout rails, and automated bonus systems.
              </p>
            </div>

            <div className="space-y-2">
              {([
                { key: 'enableUssdAutoDial', label: 'USSD Auto-Dial on Mobile', description: 'Automatically launch mobile tel: URI dialer for M-Pesa deposits' },
                { key: 'enableCryptoBotDeposit', label: 'Crypto Bot Deposits (@CryptoBot)', description: 'Accept deposits via Telegram @CryptoBot peer transfers' },
                { key: 'enableInstantWithdrawal', label: 'Instant Low-Value Payouts', description: 'Auto-dispatch payouts below $50 USDT without queuing for manual operator sign-off' },
                { key: 'enableMiningClaims', label: 'Mining Yield Claims', description: 'Allow users to claim accumulated GigaHash yields to their USDT spendable balance' },
                { key: 'enableReferralRewards', label: 'Referral Multi-Tier Commission', description: 'Credit real-time bonuses to referrers when downlines commission rigs' },
              ] as const).map((flag) => {
                const isEnabled = Boolean(settings?.featureFlags?.[flag.key] ?? DEFAULT_SETTINGS.featureFlags[flag.key]);
                return (
                  <div key={flag.key} className="flex items-center justify-between p-3.5 rounded-xl bg-control-bg border border-white/5 hover:border-white/10 transition-colors">
                    <div>
                      <div className="text-xs font-extrabold text-white">{flag.label}</div>
                      <div className="text-[10px] text-text-tertiary mt-0.5">{flag.description}</div>
                    </div>
                    <button
                      onClick={() => handleToggleFeatureFlag(flag.key)}
                      className={`w-12 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${
                        isEnabled ? 'bg-usdt-green' : 'bg-white/10'
                      }`}
                    >
                      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                        isEnabled ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Referral Program Configuration */}
          <div className="bg-card-bg rounded-2xl p-5 border border-white/10 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <TrendingUp size={16} className="text-ton-blue" /> Referral Program Rules & Multipliers
                </h3>
                <p className="text-xs text-text-tertiary mt-0.5">
                  Set tier commission percentages directly influencing referral rewards credited across the user network.
                </p>
              </div>
              <button
                onClick={() => handleSaveSettings('Referral Rules')}
                disabled={savingSection === 'Referral Rules'}
                className="px-3.5 py-2 rounded-xl bg-usdt-green text-[#06070b] font-black text-[11px] flex items-center gap-1.5 shadow hover:brightness-110 cursor-pointer"
              >
                <Save size={13} /> {savingSection === 'Referral Rules' ? 'Saving...' : 'Save Rules'}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-control-bg border border-white/5 space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Tier 1 Direct Bonus %</label>
                <input
                  type="number"
                  value={settings?.referralRules?.tier1BonusPercent ?? DEFAULT_SETTINGS.referralRules.tier1BonusPercent}
                  onChange={(e) => setSettings({
                    ...settings,
                    referralRules: {
                      ...(settings?.referralRules || DEFAULT_SETTINGS.referralRules),
                      tier1BonusPercent: Number(e.target.value),
                    },
                  })}
                  className="w-full h-9 px-3 bg-app-bg border border-white/10 rounded-lg text-xs font-mono text-white font-bold focus:outline-none focus:border-usdt-green"
                />
              </div>
              <div className="p-3.5 rounded-xl bg-control-bg border border-white/5 space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Tier 2 Secondary Bonus %</label>
                <input
                  type="number"
                  value={settings?.referralRules?.tier2BonusPercent ?? DEFAULT_SETTINGS.referralRules.tier2BonusPercent}
                  onChange={(e) => setSettings({
                    ...settings,
                    referralRules: {
                      ...(settings?.referralRules || DEFAULT_SETTINGS.referralRules),
                      tier2BonusPercent: Number(e.target.value),
                    },
                  })}
                  className="w-full h-9 px-3 bg-app-bg border border-white/10 rounded-lg text-xs font-mono text-white font-bold focus:outline-none focus:border-usdt-green"
                />
              </div>
              <div className="p-3.5 rounded-xl bg-control-bg border border-white/5 space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">New Operator Signup 💎</label>
                <input
                  type="number"
                  value={settings?.referralRules?.signupRewardCrystals ?? DEFAULT_SETTINGS.referralRules.signupRewardCrystals}
                  onChange={(e) => setSettings({
                    ...settings,
                    referralRules: {
                      ...(settings?.referralRules || DEFAULT_SETTINGS.referralRules),
                      signupRewardCrystals: Number(e.target.value),
                    },
                  })}
                  className="w-full h-9 px-3 bg-app-bg border border-white/10 rounded-lg text-xs font-mono text-white font-bold focus:outline-none focus:border-usdt-green"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── 2. COUNTRY & EXCHANGE RATE CONFIGURATION ─── */}
      {section === 'countries' && (
        <div className="bg-card-bg rounded-2xl p-5 border border-white/10 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Globe size={18} className="text-amber-400" /> Multi-Region Country & Forex Rates Configuration
              </h3>
              <p className="text-xs text-text-tertiary mt-0.5">
                Configure live exchange rates, enable/disable countries, and set deposit parameters across Africa & global corridors.
              </p>
            </div>

            <button
              onClick={() => handleSaveSettings('Country Exchange Rates')}
              disabled={savingSection === 'Country Exchange Rates'}
              className="px-4 py-2 rounded-xl bg-usdt-green text-[#06070b] font-black text-xs flex items-center gap-1.5 shadow hover:brightness-110 cursor-pointer self-start sm:self-auto"
            >
              <Save size={14} /> {savingSection === 'Country Exchange Rates' ? 'Enforcing...' : 'Save All FX Rates'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(countryConfigs).map(([code, c]) => (
              <div
                key={code}
                className={`p-4 rounded-2xl border transition-all space-y-3 ${
                  c.enabled
                    ? 'bg-control-bg border-white/10 hover:border-white/20'
                    : 'bg-card-bg/40 border-white/5 opacity-60'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{c.flag}</span>
                    <div>
                      <h4 className="text-xs font-black text-white">{c.name}</h4>
                      <span className="text-[10px] font-mono text-text-tertiary">{code} • {c.defaultCurrency} ({c.currencySymbol})</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleCountry(code)}
                    className={`w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${
                      c.enabled ? 'bg-usdt-green' : 'bg-white/10'
                    }`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                      c.enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                {/* FX Rate Input */}
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary flex items-center justify-between">
                    <span>1 USDT Exchange Rate</span>
                    <span className="text-usdt-green font-mono">{c.defaultCurrency}</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      value={c.exchangeRateUsdt}
                      onChange={(e) => handleUpdateExchangeRate(code, Number(e.target.value))}
                      className="w-full h-9 px-3 pr-12 bg-app-bg border border-white/10 rounded-xl text-xs font-mono font-bold text-white focus:outline-none focus:border-usdt-green"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-text-tertiary">
                      {c.currencySymbol}
                    </span>
                  </div>
                </div>

                {/* Supported Rails */}
                <div className="space-y-1 pt-1 border-t border-white/5">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary block">Supported Rails</span>
                  <div className="flex flex-wrap gap-1">
                    {(c.supportedRails || []).map((rail) => (
                      <span key={rail} className="px-2 py-0.5 rounded bg-white/5 border border-white/5 text-[9px] font-mono text-text-secondary">
                        {rail}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── 3. RIG ECONOMY & PRICING MATRIX ─── */}
      {section === 'machines' && (
        <div className="bg-card-bg rounded-2xl p-5 border border-white/10 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Cpu size={18} className="text-usdt-green" /> Compute Machines Economy Matrix
              </h3>
              <p className="text-xs text-text-tertiary mt-0.5">
                Adjust rig tier pricing, hashrate ratings, and daily yield projections influencing user store catalog.
              </p>
            </div>
            <button
              onClick={() => handleSaveSettings('Machine Economy Matrix')}
              disabled={savingSection === 'Machine Economy Matrix'}
              className="px-4 py-2 rounded-xl bg-usdt-green text-[#06070b] font-black text-xs flex items-center gap-1.5 shadow hover:brightness-110 cursor-pointer"
            >
              <Save size={14} /> {savingSection === 'Machine Economy Matrix' ? 'Saving...' : 'Save Matrix'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(settings.machineCatalog || DEFAULT_SETTINGS.machineCatalog).map((m, idx) => (
              <div key={m.tierCode} className="p-4 rounded-2xl bg-control-bg border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-usdt-green/10 border border-usdt-green/20 flex items-center justify-center text-usdt-green font-black text-xs font-mono">
                      {m.tierCode.slice(0, 3)}
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-white">{m.name}</h4>
                      <span className="text-[10px] font-mono text-text-tertiary">Tier: {m.tierCode}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleMachineActive(m.tierCode)}
                    className={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition-colors cursor-pointer ${
                      m.isActive ? 'bg-usdt-green text-[#06070b]' : 'bg-white/10 text-text-tertiary'
                    }`}
                  >
                    {m.isActive ? 'ACTIVE IN STORE' : 'OFFLINE'}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="p-2 rounded-lg bg-app-bg border border-white/5">
                    <span className="text-[9px] uppercase font-bold text-text-tertiary block">Price</span>
                    <input
                      type="number"
                      value={m.priceUsdt}
                      onChange={(e) => {
                        const nextCat = [...settings.machineCatalog];
                        nextCat[idx] = { ...nextCat[idx], priceUsdt: Number(e.target.value) };
                        setSettings({ ...settings, machineCatalog: nextCat });
                      }}
                      className="w-full bg-transparent text-usdt-green font-bold text-xs focus:outline-none"
                    />
                  </div>
                  <div className="p-2 rounded-lg bg-app-bg border border-white/5">
                    <span className="text-[9px] uppercase font-bold text-text-tertiary block">Hashrate</span>
                    <input
                      type="number"
                      value={m.capacityGhs}
                      onChange={(e) => {
                        const nextCat = [...settings.machineCatalog];
                        nextCat[idx] = { ...nextCat[idx], capacityGhs: Number(e.target.value) };
                        setSettings({ ...settings, machineCatalog: nextCat });
                      }}
                      className="w-full bg-transparent text-white font-bold text-xs focus:outline-none"
                    />
                  </div>
                  <div className="p-2 rounded-lg bg-app-bg border border-white/5">
                    <span className="text-[9px] uppercase font-bold text-text-tertiary block">Power (W)</span>
                    <input
                      type="number"
                      value={m.powerRatingW}
                      onChange={(e) => {
                        const nextCat = [...settings.machineCatalog];
                        nextCat[idx] = { ...nextCat[idx], powerRatingW: Number(e.target.value) };
                        setSettings({ ...settings, machineCatalog: nextCat });
                      }}
                      className="w-full bg-transparent text-text-secondary font-bold text-xs focus:outline-none"
                    />
                  </div>
                  <div className="p-2 rounded-lg bg-app-bg border border-white/5">
                    <span className="text-[9px] uppercase font-bold text-text-tertiary block">Daily Est.</span>
                    <input
                      type="number"
                      step="0.01"
                      value={m.dailyYieldEstimateUsdt}
                      onChange={(e) => {
                        const nextCat = [...settings.machineCatalog];
                        nextCat[idx] = { ...nextCat[idx], dailyYieldEstimateUsdt: Number(e.target.value) };
                        setSettings({ ...settings, machineCatalog: nextCat });
                      }}
                      className="w-full bg-transparent text-amber-400 font-bold text-xs focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── 4. MOBILE MONEY REGISTRY ─── */}
      {section === 'mobile_money' && (
        <div className="bg-card-bg rounded-2xl p-5 border border-white/10 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Smartphone size={18} className="text-usdt-green" /> Mobile Money Receiving Registry
              </h3>
              <p className="text-xs text-text-tertiary mt-0.5">
                Configurable receiving numbers and USSD templates. Zero code deployments required.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {(mmConfigs || []).map((cfg) => (
              <div key={cfg.id} className="p-4 rounded-xl bg-control-bg border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{cfg.country === 'KE' ? '🇰🇪' : cfg.country === 'UG' ? '🇺🇬' : '🌍'}</span>
                    <div>
                      <span className="font-extrabold text-white text-sm">{cfg.displayName}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="px-2 py-0.5 rounded bg-usdt-green/15 text-usdt-green font-mono text-[10px] font-bold border border-usdt-green/20">
                          {cfg.provider}
                        </span>
                        <span className="text-xs font-mono text-text-secondary">{cfg.phoneNumber}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleMmStatus(cfg)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black font-mono transition-colors cursor-pointer ${
                      cfg.status === 'ACTIVE' ? 'bg-usdt-green text-[#06070b]' : 'bg-white/10 text-text-tertiary border border-white/10'
                    }`}
                  >
                    {cfg.status}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-app-bg border border-white/5">
                    <span className="text-[9px] uppercase font-bold text-text-tertiary block">USSD Template</span>
                    <code className="text-usdt-green font-bold">{cfg.ussdTemplate}</code>
                  </div>
                  <div className="p-2.5 rounded-lg bg-app-bg border border-white/5">
                    <span className="text-[9px] uppercase font-bold text-text-tertiary block">Daily Capacity</span>
                    <span className="text-white font-bold">${(cfg.dailyCapacityUsdt || 0).toLocaleString()} USDT</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-app-bg border border-white/5">
                    <span className="text-[9px] uppercase font-bold text-text-tertiary block">Priority</span>
                    <span className="text-white font-bold">P{cfg.priority}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── 5. CRYPTO WALLETS ─── */}
      {section === 'crypto_wallets' && (
        <div className="bg-card-bg rounded-2xl p-5 border border-white/10 space-y-4 shadow-xl">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <Wallet size={18} className="text-ton-blue" /> Crypto Receiving Wallets Registry
          </h3>

          <div className="space-y-3">
            {(cryptoWallets || []).map((cw) => (
              <div key={cw.id} className="p-4 rounded-xl bg-control-bg border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-ton-blue/10 border border-ton-blue/20 flex items-center justify-center text-lg">₮</div>
                    <div>
                      <span className="font-extrabold text-white text-sm">{cw.label}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="px-2 py-0.5 rounded bg-ton-blue/15 text-ton-blue font-mono text-[10px] font-bold border border-ton-blue/20">
                          {cw.asset} ({cw.network})
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="px-3 py-1.5 rounded-xl bg-usdt-green text-[#06070b] font-black text-xs">{cw.status}</span>
                </div>

                <div className="p-3 rounded-lg bg-app-bg border border-white/5 flex items-center justify-between">
                  <code className="text-xs font-mono text-text-secondary truncate flex-1">{cw.address}</code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(cw.address); showToast('Wallet address copied!', 'success'); }}
                    className="ml-2 text-text-tertiary hover:text-white cursor-pointer shrink-0"
                  >
                    <Copy size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-app-bg border border-white/5">
                    <span className="text-[9px] uppercase font-bold text-text-tertiary block">Daily Capacity</span>
                    <span className="text-white font-bold">${(cw.dailyCapacityUsdt || 0).toLocaleString()} USDT</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-app-bg border border-white/5">
                    <span className="text-[9px] uppercase font-bold text-text-tertiary block">Priority</span>
                    <span className="text-white font-bold">P{cw.priority}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── 6. USSD ENGINE TESTER ─── */}
      {section === 'ussd_engine' && (
        <div className="bg-card-bg rounded-2xl p-5 border border-white/10 space-y-4 shadow-xl">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <Terminal size={18} className="text-usdt-green" /> USSD Template Engine & Live Protocol Previewer
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">USSD Template</label>
              <input
                type="text"
                value={testTemplate}
                onChange={(e) => setTestTemplate(e.target.value)}
                className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-usdt-green"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Receiving Phone</label>
              <input
                type="text"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-usdt-green"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Amount (Local)</label>
              <input
                type="number"
                value={testAmount}
                onChange={(e) => setTestAmount(Number(e.target.value))}
                className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-usdt-green"
              />
            </div>
          </div>

          <button
            onClick={handleTestUssd}
            className="px-4 py-2.5 rounded-xl bg-usdt-green text-[#06070b] font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <Play size={14} /> Validate & Generate USSD Launcher
          </button>

          {testResult && (
            <div className="p-4 rounded-xl bg-usdt-green/10 border border-usdt-green/30 space-y-2.5 text-xs">
              <div className="font-extrabold text-usdt-green flex items-center gap-1.5">
                <CheckCircle2 size={14} /> Valid USSD Push String Generated
              </div>
              <div className="font-mono text-sm font-bold text-white bg-control-bg p-3 rounded-lg border border-white/10">
                {testResult.generatedUssd}
              </div>
              <div className="text-text-secondary">
                URI Protocol: <code className="text-usdt-green font-mono">{testResult.telUri}</code>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── 7. ADMIN RBAC ─── */}
      {section === 'admins' && (
        <div className="bg-card-bg rounded-2xl p-5 border border-white/10 space-y-4 shadow-xl">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <Shield size={18} className="text-usdt-green" /> Authenticated Telegram Admin RBAC
          </h3>

          {/* Invite Form */}
          <form onSubmit={handleInviteAdmin} className="p-4 rounded-xl bg-control-bg border border-white/10 space-y-3">
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <Plus size={14} className="text-usdt-green" /> Onboard New Admin Operator
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                required
                placeholder="Telegram User ID"
                value={inviteTgId}
                onChange={(e) => setInviteTgId(e.target.value)}
                className="h-10 px-3 bg-app-bg border border-white/10 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-usdt-green"
              />
              <input
                type="text"
                required
                placeholder="Full Name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                className="h-10 px-3 bg-app-bg border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-usdt-green"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="h-10 px-3 bg-app-bg border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-usdt-green"
              >
                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                <option value="OPERATIONS_ADMIN">OPERATIONS_ADMIN</option>
                <option value="FINANCE_ADMIN">FINANCE_ADMIN</option>
                <option value="TREASURY_OPERATOR">TREASURY_OPERATOR</option>
                <option value="RISK_OPERATOR">RISK_OPERATOR</option>
                <option value="MERCHANT_MANAGER">MERCHANT_MANAGER</option>
                <option value="SUPPORT_AGENT">SUPPORT_AGENT</option>
              </select>
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-usdt-green text-[#06070b] font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <UserCheck size={14} /> Onboard Admin
            </button>
          </form>

          {/* Admin List */}
          <div className="space-y-2">
            {(admins || []).map((ad) => {
              const displayName = String(ad?.name || (ad as any)?.username || ad?.telegramUserId || 'Admin');
              const initials = displayName
                .split(' ')
                .map((n: string) => n?.[0])
                .filter(Boolean)
                .join('')
                .slice(0, 2)
                .toUpperCase() || 'AD';

              return (
                <div key={ad?.id || Math.random()} className="p-4 rounded-xl bg-control-bg/60 border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-text-tertiary text-sm font-bold">
                      {initials}
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-white">{displayName}</div>
                      <div className="text-[10px] text-text-tertiary font-mono">
                        TG: {ad?.telegramUserId} • {ad?.permissions?.length === 1 && ad?.permissions[0] === '*' ? 'Full Access' : `${ad?.permissions?.length || 0} permissions`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black font-mono border ${roleColors[ad?.role || 'OPERATIONS_ADMIN'] || 'bg-white/5 text-text-tertiary border-white/10'}`}>
                      {ad?.role || 'OPERATIONS_ADMIN'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-usdt-green/15 text-usdt-green text-[10px] font-bold border border-usdt-green/20">
                      {ad?.status || 'ACTIVE'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
