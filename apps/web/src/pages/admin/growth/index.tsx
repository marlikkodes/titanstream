import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/services/api';
import { 
  growthService, 
  type GrowthEconomyMetrics, 
  type AttributionHealthMetrics,
  type CanonicalFunnelStage,
  type EconomicLeakItem,
  type RevenueOpportunityItem,
  type CohortEconomicsItem,
  type RewardLiabilityBreakdown,
  type ReferrerQualityItem
} from '@/services/growthService';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { showToast } from '@/components/Toast';
import {
  Gift,
  Share2,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  Search,
  UserCheck,
  Award,
  Layers,
  Sparkles,
  Play,
  Flame,
  ArrowRight,
  TrendingUp,
  Wallet,
  Users,
  AlertTriangle,
  Zap,
  Check,
  ChevronRight,
  BarChart3,
  Activity,
  Info,
  Target,
  Filter,
  AlertOctagon,
  LineChart
} from 'lucide-react';

interface RewardItem {
  id: string;
  telegramUserId: string;
  amount: string;
  status: 'PENDING' | 'APPROVED' | 'DISBURSED' | 'REJECTED';
  rewardType: string;
  reference: string;
  createdAt: string;
}

interface ReferralRelationship {
  id: string;
  referrerId: string;
  referrerName: string;
  referrerUsername?: string;
  refereeId: string;
  refereeName: string;
  refereeUsername?: string;
  status: string;
  createdAt: string;
  rewards: Array<{ id: string; amount: string; status: string; reference: string }>;
}

export const GrowthAdminPage: React.FC = () => {
  const [tab, setTab] = useState<'ECONOMICS' | 'FUNNEL' | 'OPPORTUNITIES' | 'REWARDS' | 'REFERRALS' | 'FRAUD' | 'RULES'>('ECONOMICS');
  const [economics, setEconomics] = useState<GrowthEconomyMetrics | null>(null);
  const [attributionHealth, setAttributionHealth] = useState<AttributionHealthMetrics | null>(null);
  const [funnelStages, setFunnelStages] = useState<CanonicalFunnelStage[]>([]);
  const [economicLeaks, setEconomicLeaks] = useState<EconomicLeakItem[]>([]);
  const [opportunities, setOpportunities] = useState<RevenueOpportunityItem[]>([]);
  const [cohorts, setCohorts] = useState<CohortEconomicsItem[]>([]);
  const [liabilities, setLiabilities] = useState<RewardLiabilityBreakdown | null>(null);
  const [referrerQuality, setReferrerQuality] = useState<ReferrerQualityItem[]>([]);
  const [economicsError, setEconomicsError] = useState<string | null>(null);
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [referrals, setReferrals] = useState<ReferralRelationship[]>([]);
  const [fraudData, setFraudData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // User graph search
  const [searchUserId, setSearchUserId] = useState('');
  const [userGraph, setUserGraph] = useState<any>(null);
  const [searchingGraph, setSearchingGraph] = useState(false);

  // New Rule State
  const [ruleCode, setRuleCode] = useState('REFERRAL_SIGNUP_BONUS');
  const [ruleName, setRuleName] = useState('Direct Referral USDT Commission');
  const [ruleAmount, setRuleAmount] = useState('5.0');
  const [submittingRule, setSubmittingRule] = useState(false);

  const fetchEconomics = useCallback(async () => {
    setLoading(true);
    setEconomicsError(null);
    try {
      const [ecoData, healthData, liabilitiesData] = await Promise.all([
        growthService.getGrowthEconomyMetrics().catch(() => null),
        growthService.getAttributionHealth().catch(() => null),
        growthService.getRewardLiabilities().catch(() => null),
      ]);
      if (!ecoData) {
        setEconomicsError('Unable to load canonical growth economics data from backend.');
      } else {
        setEconomics(ecoData);
      }
      setAttributionHealth(healthData);
      setLiabilities(liabilitiesData);
    } catch (err: any) {
      setEconomicsError(err?.message || 'Failed to fetch economics metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFunnel = useCallback(async () => {
    setLoading(true);
    try {
      const [funnelRes, leaksRes] = await Promise.all([
        growthService.getEconomicFunnel().catch(() => ({ stages: [] })),
        growthService.getEconomicLeaks().catch(() => []),
      ]);
      setFunnelStages(funnelRes.stages || []);
      setEconomicLeaks(leaksRes || []);
    } catch {
      setFunnelStages([]);
      setEconomicLeaks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOpportunities = useCallback(async () => {
    setLoading(true);
    try {
      const [oppsRes, cohortsRes] = await Promise.all([
        growthService.getRevenueOpportunities().catch(() => []),
        growthService.getCohortEconomics().catch(() => []),
      ]);
      setOpportunities(oppsRes || []);
      setCohorts(cohortsRes || []);
    } catch {
      setOpportunities([]);
      setCohorts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRewards = useCallback(async () => {
    setLoading(true);
    try {
      const [res, liab] = await Promise.all([
        api.get('/admin/rewards').catch(() => ({ data: [] })),
        growthService.getRewardLiabilities().catch(() => null),
      ]);
      const data = res?.data?.data ?? res?.data ?? [];
      setRewards(Array.isArray(data) ? data : []);
      setLiabilities(liab);
    } catch {
      setRewards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchReferrals = useCallback(async () => {
    setLoading(true);
    try {
      const [res, qualityRes] = await Promise.all([
        api.get('/admin/referrals/relationships').catch(() => ({ data: [] })),
        growthService.getReferrerQualityRankings().catch(() => []),
      ]);
      const data = res?.data?.data ?? res?.data ?? [];
      setReferrals(Array.isArray(data) ? data : []);
      setReferrerQuality(qualityRes || []);
    } catch {
      setReferrals([]);
      setReferrerQuality([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFraudCheck = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/referrals/fraud-check').catch(() => ({ data: null }));
      setFraudData(res?.data?.data ?? res?.data ?? null);
    } catch {
      setFraudData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'ECONOMICS') fetchEconomics();
    if (tab === 'FUNNEL') fetchFunnel();
    if (tab === 'OPPORTUNITIES') fetchOpportunities();
    if (tab === 'REWARDS') fetchRewards();
    if (tab === 'REFERRALS') fetchReferrals();
    if (tab === 'FRAUD') fetchFraudCheck();
  }, [tab, fetchEconomics, fetchFunnel, fetchOpportunities, fetchRewards, fetchReferrals, fetchFraudCheck]);

  const handleApproveReward = async (id: string) => {
    setApprovingId(id);
    try {
      await api.post(`/admin/rewards/${id}/approve`);
      showToast('Reward approved and disbursed via double-entry orchestrator!', 'success');
      fetchRewards();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to approve reward', 'error');
    } finally {
      setApprovingId(null);
    }
  };

  const handleSearchUserGraph = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchUserId.trim()) return;
    setSearchingGraph(true);
    try {
      const res = await api.get(`/admin/referrals/graph/${searchUserId.trim()}`);
      setUserGraph(res.data?.data || res.data);
      showToast(`Referral graph loaded for user ${searchUserId}`, 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to load user graph', 'error');
      setUserGraph(null);
    } finally {
      setSearchingGraph(false);
    }
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingRule(true);
    try {
      await api.post('/admin/rewards/rules', {
        code: ruleCode.trim(),
        name: ruleName.trim(),
        rewardType: 'COMMISSION_USDT',
        amount: ruleAmount.trim(),
        assetCode: 'USDT',
        enabled: true,
      });
      showToast('Reward rule persisted cleanly!', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to save reward rule', 'error');
    } finally {
      setSubmittingRule(false);
    }
  };

  const pendingRewards = rewards.filter((r) => r.status === 'PENDING');
  const totalDisbursed = rewards
    .filter((r) => r.status === 'APPROVED' || r.status === 'DISBURSED')
    .reduce((acc, r) => acc + (Number(r.amount) || 0), 0);

  return (
    <div className="space-y-6">
      {/* ─── 1. HERO SECTION: GROWTH & REWARDS COCKPIT ───────────────────────── */}
      <div className="relative overflow-hidden bg-card-bg border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-usdt-green/10 border border-usdt-green/40 text-usdt-green shrink-0 shadow-lg">
              <Gift size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-usdt-green bg-usdt-green/10 px-2 py-0.5 rounded border border-usdt-green/30">
                  Growth Economy Control Plane
                </span>
                <span className="text-xs text-text-tertiary">·</span>
                <span className="text-xs text-text-secondary font-mono flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-usdt-green" />
                  Double-Entry Ledger Verified
                </span>
              </div>
              <h1 className="text-xl font-black text-text-primary tracking-tight mt-1">
                Mission Control — Growth Economy
              </h1>
              <p className="text-xs text-text-secondary mt-0.5">
                Economic value attribution, campaign ROI governance, cost basis transparency, and referral graph telemetry.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end lg:self-center">
            <button
              onClick={() => {
                if (tab === 'ECONOMICS') fetchEconomics();
                if (tab === 'REWARDS') fetchRewards();
                if (tab === 'REFERRALS') fetchReferrals();
                if (tab === 'FRAUD') fetchFraudCheck();
              }}
              disabled={loading}
              className="p-2.5 rounded-xl bg-control-bg border border-white/10 text-text-secondary hover:text-text-primary disabled:opacity-50 cursor-pointer transition-colors shadow-sm"
              title="Refresh Growth Desk"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Live Growth KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/5">
          <div className="p-3.5 rounded-2xl bg-control-bg/60 border border-white/5 space-y-1">
            <span className="text-[10px] font-bold uppercase text-text-tertiary flex items-center gap-1">
              <Gift size={12} className="text-usdt-green" /> Pending Claims
            </span>
            <div className="text-lg font-black font-mono text-text-primary">
              {pendingRewards.length} <span className="text-xs text-text-tertiary font-normal">claims</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-control-bg/60 border border-white/5 space-y-1">
            <span className="text-[10px] font-bold uppercase text-text-tertiary flex items-center gap-1">
              <Award size={12} className="text-ton-blue" /> Disbursed Volume
            </span>
            <div className="text-lg font-black font-mono text-usdt-green">
              ${totalDisbursed.toLocaleString()} <span className="text-xs text-text-tertiary font-normal">USDT</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-control-bg/60 border border-white/5 space-y-1">
            <span className="text-[10px] font-bold uppercase text-text-tertiary flex items-center gap-1">
              <Share2 size={12} className="text-purple-400" /> Active Ties
            </span>
            <div className="text-lg font-black font-mono text-text-primary">
              {referrals.length} <span className="text-xs text-text-tertiary font-normal">relationships</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-control-bg/60 border border-white/5 space-y-1">
            <span className="text-[10px] font-bold uppercase text-text-tertiary flex items-center gap-1">
              <Flame size={12} className="text-amber-400" /> Anti-Fraud Radar
            </span>
            <div className="text-lg font-black font-mono text-usdt-green">
              Clean
            </div>
          </div>
        </div>
      </div>

      {/* ─── 2. NAVIGATION TABS ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setTab('ECONOMICS')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
            tab === 'ECONOMICS'
              ? 'bg-usdt-green text-app-bg shadow-lg shadow-usdt-green/20'
              : 'bg-control-bg text-text-secondary border border-white/10 hover:text-text-primary'
          }`}
        >
          Economics & ROI
        </button>
        <button
          onClick={() => setTab('FUNNEL')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
            tab === 'FUNNEL'
              ? 'bg-usdt-green text-app-bg shadow-lg shadow-usdt-green/20'
              : 'bg-control-bg text-text-secondary border border-white/10 hover:text-text-primary'
          }`}
        >
          9-Stage Funnel & Leaks
        </button>
        <button
          onClick={() => setTab('OPPORTUNITIES')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
            tab === 'OPPORTUNITIES'
              ? 'bg-usdt-green text-app-bg shadow-lg shadow-usdt-green/20'
              : 'bg-control-bg text-text-secondary border border-white/10 hover:text-text-primary'
          }`}
        >
          Opportunities & Cohorts
        </button>
        <button
          onClick={() => setTab('REWARDS')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
            tab === 'REWARDS'
              ? 'bg-usdt-green text-app-bg shadow-lg shadow-usdt-green/20'
              : 'bg-control-bg text-text-secondary border border-white/10 hover:text-text-primary'
          }`}
        >
          Reward Claims Queue ({pendingRewards.length})
        </button>
        <button
          onClick={() => setTab('REFERRALS')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
            tab === 'REFERRALS'
              ? 'bg-usdt-green text-app-bg shadow-lg shadow-usdt-green/20'
              : 'bg-control-bg text-text-secondary border border-white/10 hover:text-text-primary'
          }`}
        >
          Referral Network & Quality
        </button>
        <button
          onClick={() => setTab('FRAUD')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
            tab === 'FRAUD'
              ? 'bg-usdt-green text-app-bg shadow-lg shadow-usdt-green/20'
              : 'bg-control-bg text-text-secondary border border-white/10 hover:text-text-primary'
          }`}
        >
          Sybil & Fraud Radar
        </button>
        <button
          onClick={() => setTab('RULES')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
            tab === 'RULES'
              ? 'bg-usdt-green text-app-bg shadow-lg shadow-usdt-green/20'
              : 'bg-control-bg text-text-secondary border border-white/10 hover:text-text-primary'
          }`}
        >
          Reward Policy Engine
        </button>
      </div>

      {/* ─── 3. TAB 1: ECONOMICS & ROI COCKPIT ─────────────────────────────────── */}
      {tab === 'ECONOMICS' && (
        <div className="space-y-6">
          {loading && !economics ? (
            <div className="p-8 text-center text-text-secondary font-mono text-xs flex items-center justify-center gap-2">
              <RefreshCw size={16} className="animate-spin text-usdt-green" />
              Loading Growth Economy metrics from server...
            </div>
          ) : economicsError ? (
            <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs space-y-2">
              <div className="font-bold flex items-center gap-2">
                <AlertTriangle size={16} /> Error Loading Growth Economy Data
              </div>
              <div>{economicsError}</div>
              <button
                onClick={fetchEconomics}
                className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 font-bold hover:bg-rose-500/30 cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : economics ? (
            <>
              {/* Executive Summary Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="p-4 rounded-2xl bg-card-bg border border-white/10 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-text-tertiary">Gross Revenue</span>
                  <div className="text-xl font-black font-mono text-text-primary">
                    ${economics.totalGrossRevenueUsdt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <span className="text-[9px] font-bold uppercase text-cyan-400">Settlements & Machines</span>
                </div>

                <div className="p-4 rounded-2xl bg-card-bg border border-white/10 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-text-tertiary">Direct Variable Costs</span>
                  <div className="text-xl font-black font-mono text-rose-400">
                    ${economics.totalDirectCostUsdt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    ESTIMATED BASIS
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-card-bg border border-white/10 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-text-tertiary">Incentive Spend</span>
                  <div className="text-xl font-black font-mono text-amber-400">
                    ${economics.totalRewardSpendUsdt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-usdt-green/15 text-usdt-green border border-usdt-green/30">
                    EXACT LEDGER
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-card-bg border border-white/10 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-text-tertiary">Net Contribution</span>
                  <div className={`text-xl font-black font-mono ${economics.netGrowthContributionUsdt >= 0 ? 'text-usdt-green' : 'text-rose-400'}`}>
                    ${economics.netGrowthContributionUsdt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <span className="text-[9px] font-bold uppercase text-text-tertiary">Gross - Costs - Rewards</span>
                </div>

                <div className="p-4 rounded-2xl bg-card-bg border border-white/10 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-text-tertiary">Growth ROI</span>
                  <div className="text-xl font-black font-mono text-usdt-green">
                    {economics.overallGrowthRoi}x
                  </div>
                  <span className="text-[9px] font-bold uppercase text-text-tertiary">Net / Reward Spend</span>
                </div>
              </div>

              {/* Cost Basis Transparency Widget */}
              <div className="p-4 rounded-2xl bg-card-bg border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-text-primary flex items-center gap-2">
                    <Info size={14} className="text-cyan-400" /> Cost Basis Transparency & Estimation Disclosure
                  </h3>
                  <span className="text-[10px] font-mono text-text-tertiary">Analytical Accounting Invariant</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-control-bg border border-white/5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-text-tertiary font-bold">Reward Incentives</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-usdt-green/20 text-usdt-green border border-usdt-green/30 font-sans font-bold">
                        EXACT
                      </span>
                    </div>
                    <div className="text-base font-extrabold text-text-primary">
                      ${economics.costBreakdown?.exactDisbursedRewardsUsdt?.toFixed(2) || '0.00'} USDT
                    </div>
                    <div className="text-[10px] text-text-tertiary font-sans">
                      Exact double-entry SYSTEM_ALLOCATION ledger disbursement.
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-control-bg border border-white/5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-text-tertiary font-bold">Payment Rail & FX</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 font-sans font-bold">
                        ESTIMATED (35%)
                      </span>
                    </div>
                    <div className="text-base font-extrabold text-text-primary">
                      ${economics.costBreakdown?.estimatedRailCostsUsdt?.toFixed(2) || '0.00'} USDT
                    </div>
                    <div className="text-[10px] text-text-tertiary font-sans">
                      Modeled 35% provider fee & FX liquidity cost assumption.
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-control-bg border border-white/5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-text-tertiary font-bold">Hardware Provisioning</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 font-sans font-bold">
                        ESTIMATED (70%)
                      </span>
                    </div>
                    <div className="text-base font-extrabold text-text-primary">
                      ${economics.costBreakdown?.estimatedHardwareCostsUsdt?.toFixed(2) || '0.00'} USDT
                    </div>
                    <div className="text-[10px] text-text-tertiary font-sans">
                      Modeled 70% COGS basis for machine cloud hardware deployment.
                    </div>
                  </div>
                </div>
              </div>

              {/* Attribution Health Diagnostic Panel */}
              {attributionHealth && (
                <div className="p-4 rounded-2xl bg-card-bg border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-wider text-text-primary flex items-center gap-2">
                      <Activity size={14} className="text-usdt-green" /> Attribution Graph Health & Coverage
                    </h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${attributionHealth.graphHealthStatus === 'HEALTHY' ? 'bg-usdt-green/15 text-usdt-green border-usdt-green/30' : 'bg-amber-500/15 text-amber-400 border-amber-500/30'}`}>
                      {attributionHealth.graphHealthStatus}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                    <div className="p-3 rounded-xl bg-control-bg border border-white/5">
                      <span className="text-text-tertiary text-[10px] font-sans">Total Users</span>
                      <div className="text-base font-extrabold text-text-primary mt-1">{attributionHealth.totalUsers}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-control-bg border border-white/5">
                      <span className="text-text-tertiary text-[10px] font-sans">Attributed / Linked</span>
                      <div className="text-base font-extrabold text-cyan-400 mt-1">{attributionHealth.attributedUsers} ({attributionHealth.attributionCoveragePercent}%)</div>
                    </div>
                    <div className="p-3 rounded-xl bg-control-bg border border-white/5">
                      <span className="text-text-tertiary text-[10px] font-sans">Total Economic Events</span>
                      <div className="text-base font-extrabold text-usdt-green mt-1">{attributionHealth.totalEconomicEvents}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-control-bg border border-white/5">
                      <span className="text-text-tertiary text-[10px] font-sans">Exact vs. Estimated Events</span>
                      <div className="text-base font-extrabold text-text-primary mt-1">{attributionHealth.exactCostEvents} / {attributionHealth.estimatedCostEvents}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Campaign Performance Matrix Table */}
              <div className="bg-card-bg rounded-3xl border border-white/10 overflow-hidden shadow-xl">
                <div className="p-4 sm:p-5 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-text-primary flex items-center gap-2">
                      <TrendingUp size={16} className="text-usdt-green" /> Campaign Economics & ROI Matrix
                    </h3>
                    <p className="text-[11px] text-text-secondary mt-0.5">
                      Customer acquisition cost (CAC), Lifetime Value (LTV), payback velocity, and net contribution per campaign.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-text-tertiary">
                    {economics.campaigns?.length || 0} Active Campaigns
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-control-bg/50 text-[10px] font-extrabold uppercase text-text-tertiary border-b border-white/5">
                      <tr>
                        <th className="py-3 px-4">Campaign</th>
                        <th className="py-3 px-3">Budget / Available</th>
                        <th className="py-3 px-3">Acquired</th>
                        <th className="py-3 px-3">Paying</th>
                        <th className="py-3 px-3">Revenue</th>
                        <th className="py-3 px-3">Direct Cost</th>
                        <th className="py-3 px-3">Reward Spend</th>
                        <th className="py-3 px-3">Net Contribution</th>
                        <th className="py-3 px-3">Modeled Lift (85%)</th>
                        <th className="py-3 px-3">CAC</th>
                        <th className="py-3 px-3">LTV</th>
                        <th className="py-3 px-3">Payback</th>
                        <th className="py-3 px-3">ROI</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {economics.campaigns && economics.campaigns.length > 0 ? (
                        economics.campaigns.map((camp) => (
                          <tr key={camp.campaignCode} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-bold text-text-primary font-sans">{camp.title}</div>
                              <div className="text-[10px] text-text-tertiary font-mono">{camp.campaignCode}</div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="text-text-primary font-bold">${camp.budgetLimitUsdt?.toFixed(0) || '5000'}</div>
                              <div className="text-[10px] text-usdt-green">${camp.availableBudgetUsdt?.toFixed(0) || '5000'} left</div>
                            </td>
                            <td className="py-3 px-3">{camp.totalAcquiredUsers}</td>
                            <td className="py-3 px-3 text-cyan-400">{camp.totalPayingUsers}</td>
                            <td className="py-3 px-3">${camp.grossRevenueUsdt.toFixed(2)}</td>
                            <td className="py-3 px-3 text-rose-400">${camp.directCostUsdt.toFixed(2)}</td>
                            <td className="py-3 px-3 text-amber-400">${camp.rewardSpendUsdt.toFixed(2)}</td>
                            <td className={`py-3 px-3 font-bold ${camp.netContributionUsdt >= 0 ? 'text-usdt-green' : 'text-rose-400'}`}>
                              ${camp.netContributionUsdt.toFixed(2)}
                            </td>
                            <td className="py-3 px-3 text-text-secondary">${camp.incrementalContributionUsdt.toFixed(2)}</td>
                            <td className="py-3 px-3">${camp.cacUsdt.toFixed(2)}</td>
                            <td className="py-3 px-3">${camp.ltvUsdt.toFixed(2)}</td>
                            <td className="py-3 px-3">
                              {camp.paybackPeriodDays ? `${camp.paybackPeriodDays}d` : '—'}
                            </td>
                            <td className="py-3 px-3 font-bold text-usdt-green">{camp.roi}x</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase font-sans ${camp.status === 'PROFITABLE' ? 'bg-usdt-green/20 text-usdt-green border border-usdt-green/30' : camp.status === 'OPTIMIZE' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                                {camp.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={14} className="py-8 text-center text-text-tertiary font-sans">
                            No campaigns recorded yet. Launch campaigns via UTM parameters to begin attribution tracking.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Channel Breakdown & Top Referrers */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Channel Performance Breakdown */}
                <div className="bg-card-bg rounded-3xl p-5 border border-white/10 space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-text-primary flex items-center gap-2">
                    <Share2 size={16} className="text-cyan-400" /> Acquisition Channel Economics
                  </h3>
                  <div className="space-y-2 font-mono text-xs">
                    {economics.channelBreakdown?.map((ch) => (
                      <div key={ch.channel} className="p-3 rounded-xl bg-control-bg border border-white/5 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-text-primary font-sans">{ch.channel}</div>
                          <div className="text-[10px] text-text-tertiary">{ch.userCount} users acquired</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-usdt-green">${ch.netContributionUsdt.toFixed(2)} Net</div>
                          <div className="text-[10px] text-text-tertiary">ROI: {ch.roi}x</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Economic Referrers (Ranked by Downline Contribution) */}
                <div className="bg-card-bg rounded-3xl p-5 border border-white/10 space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-text-primary flex items-center gap-2">
                    <Award size={16} className="text-gold" /> Top Economic Referrers (Net Contribution)
                  </h3>
                  <div className="space-y-2 font-mono text-xs">
                    {economics.topEconomicReferrers && economics.topEconomicReferrers.length > 0 ? (
                      economics.topEconomicReferrers.map((ref) => (
                        <div key={ref.telegramUserId} className="p-3 rounded-xl bg-control-bg border border-white/5 flex items-center justify-between">
                          <div>
                            <div className="font-bold text-text-primary font-sans">{ref.username}</div>
                            <div className="text-[10px] text-text-tertiary">{ref.downlineCount} network ties</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-usdt-green">${ref.netContributionUsdt.toFixed(2)} Net</div>
                            <div className="text-[10px] text-text-tertiary">Network ROI: {ref.networkRoi}x</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-text-tertiary text-xs font-sans">
                        No downline economic activity recorded yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ─── TAB: CANONICAL 9-STAGE ECONOMIC FUNNEL & LEAKS ───────────────────── */}
      {tab === 'FUNNEL' && (
        <div className="space-y-6">
          {/* 9-STAGE FUNNEL TABLE */}
          <div className="bg-card-bg rounded-3xl p-5 sm:p-6 border border-white/10 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-black text-text-primary flex items-center gap-2">
                  <Filter size={16} className="text-cyan-400" /> Canonical 9-Stage Economic Funnel
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  End-to-end customer journey progression from arrival to repeat retention and net platform contribution.
                </p>
              </div>
              <span className="text-xs font-mono text-text-tertiary">
                {funnelStages.length} Measured Stages
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-control-bg/50 text-[10px] font-extrabold uppercase text-text-tertiary border-b border-white/5">
                  <tr>
                    <th className="py-3 px-4">Stage</th>
                    <th className="py-3 px-3">Lifecycle Step</th>
                    <th className="py-3 px-3">Users</th>
                    <th className="py-3 px-4">Progression Conversion</th>
                    <th className="py-3 px-3">Drop-off</th>
                    <th className="py-3 px-4 text-right">Net Contribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {funnelStages.map((stage, idx) => (
                    <tr key={stage.stage} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 font-bold text-text-tertiary font-sans">
                        #{idx + 1}
                      </td>
                      <td className="py-3 px-3 font-bold text-text-primary font-sans">
                        {stage.name}
                        <div className="text-[10px] text-text-tertiary font-mono">{stage.stage}</div>
                      </td>
                      <td className="py-3 px-3 font-bold text-text-primary">
                        {stage.count.toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full bg-cyan-400 rounded-full"
                              style={{ width: `${Math.min(100, stage.conversionPct)}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-bold text-cyan-400">{stage.conversionPct}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-rose-400">
                        {stage.dropoffPct > 0 ? `${stage.dropoffPct}%` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-usdt-green">
                        {stage.netContributionUsdt > 0 ? `$${stage.netContributionUsdt.toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ECONOMIC LEAK DETECTION */}
          <div className="bg-card-bg rounded-3xl p-5 sm:p-6 border border-white/10 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-black text-text-primary flex items-center gap-2">
                  <AlertOctagon size={16} className="text-rose-400" /> Economic Leak Detection
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Pinpoints highest-friction customer drop-offs and quantifies estimated lost platform contribution.
                </p>
              </div>
              <span className="text-xs font-mono text-rose-400 font-bold">
                {economicLeaks.length} Detected Leaks
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {economicLeaks.map((leak) => (
                <div key={leak.leakId} className="p-4 rounded-2xl bg-control-bg border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-text-tertiary uppercase">
                      {leak.leakId}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase font-mono ${
                      leak.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {leak.severity}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-black text-text-primary">{leak.stage}</h4>
                    <div className="text-[11px] font-mono text-rose-400 mt-1 font-bold">
                      {leak.dropoffPercent}% Drop-off ({leak.dropoffCount} users)
                    </div>
                    <div className="text-[10px] font-mono text-text-tertiary mt-0.5">
                      Estimated Lost Contribution: <strong className="text-rose-300">${leak.estimatedLostContributionUsdt.toFixed(2)} USDT</strong>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-[11px] text-text-secondary leading-relaxed">
                    <strong className="text-cyan-400">Remedy:</strong> {leak.recommendedAction}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB: REVENUE OPPORTUNITY MAP & COHORT ECONOMICS ─────────────────── */}
      {tab === 'OPPORTUNITIES' && (
        <div className="space-y-6">
          {/* RANKED REVENUE OPPORTUNITIES (P0 → P3) */}
          <div className="bg-card-bg rounded-3xl p-5 sm:p-6 border border-white/10 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-black text-text-primary flex items-center gap-2">
                  <Target size={16} className="text-gold" /> Ranked Revenue Opportunity Map
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Prioritized conversion engineering initiatives ranked by expected incremental net contribution.
                </p>
              </div>
              <span className="text-xs font-mono text-text-tertiary">
                {opportunities.length} Ranked Opportunities
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {opportunities.map((opp) => (
                <div key={opp.priority} className="p-4 rounded-2xl bg-control-bg border border-white/5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase font-mono border ${
                      opp.priority === 'P0' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : opp.priority === 'P1' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                    }`}>
                      {opp.priority} · {opp.category}
                    </span>
                    <span className="text-xs font-mono font-bold text-usdt-green">
                      +${opp.expectedIncrementalContributionUsdt.toFixed(2)} USDT Lift
                    </span>
                  </div>

                  <h4 className="text-xs font-black text-text-primary">{opp.title}</h4>
                  <p className="text-[11px] text-text-secondary leading-relaxed">{opp.description}</p>

                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-text-tertiary">
                    <span>Target Lift: <strong className="text-cyan-400">+{opp.targetLiftPercent}%</strong></span>
                    <span>Risk Level: <strong className="text-text-secondary">{opp.riskLevel}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* MONTHLY COHORT ECONOMICS */}
          <div className="bg-card-bg rounded-3xl p-5 sm:p-6 border border-white/10 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-black text-text-primary flex items-center gap-2">
                  <LineChart size={16} className="text-ton-blue" /> Monthly Cohort Economics & Retention
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Tracking acquisition quality, CAC payback, net contribution, and D30 retention across cohorts.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-control-bg/50 text-[10px] font-extrabold uppercase text-text-tertiary border-b border-white/5">
                  <tr>
                    <th className="py-3 px-4">Cohort</th>
                    <th className="py-3 px-3">Users</th>
                    <th className="py-3 px-3">Qualified</th>
                    <th className="py-3 px-3">Paying</th>
                    <th className="py-3 px-3">Revenue</th>
                    <th className="py-3 px-3">Direct Cost</th>
                    <th className="py-3 px-3">Reward Spend</th>
                    <th className="py-3 px-3">Net Contribution</th>
                    <th className="py-3 px-3">CAC</th>
                    <th className="py-3 px-3">LTV</th>
                    <th className="py-3 px-4">D30 Retention</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {cohorts.map((cohort) => (
                    <tr key={cohort.cohortMonth} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 font-bold text-text-primary font-sans">{cohort.cohortMonth}</td>
                      <td className="py-3 px-3">{cohort.totalUsers}</td>
                      <td className="py-3 px-3 text-cyan-400">{cohort.qualifiedUsers}</td>
                      <td className="py-3 px-3 text-usdt-green">{cohort.payingUsers}</td>
                      <td className="py-3 px-3">${cohort.grossRevenueUsdt.toFixed(2)}</td>
                      <td className="py-3 px-3 text-rose-400">${cohort.directCostUsdt.toFixed(2)}</td>
                      <td className="py-3 px-3 text-amber-400">${cohort.rewardSpendUsdt.toFixed(2)}</td>
                      <td className="py-3 px-3 font-bold text-usdt-green">${cohort.netContributionUsdt.toFixed(2)}</td>
                      <td className="py-3 px-3">${cohort.cacUsdt.toFixed(2)}</td>
                      <td className="py-3 px-3 font-bold">${cohort.ltvUsdt.toFixed(2)}</td>
                      <td className="py-3 px-4 text-cyan-400 font-bold">{cohort.retentionD30Percent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── 4. TAB: REWARDS QUEUE & LIABILITIES ──────────────────────────────── */}
      {tab === 'REWARDS' && (
        <div className="space-y-6">
          {/* REWARD LIABILITY GOVERNANCE CARD */}
          {liabilities && (
            <div className="bg-card-bg rounded-3xl p-5 sm:p-6 border border-white/10 space-y-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-text-primary flex items-center gap-2">
                  <Wallet size={16} className="text-usdt-green" /> Reward Liability Exposure & Capital Governance
                </h3>
                <span className="text-xs font-mono font-bold text-usdt-green">
                  {liabilities.budgetUtilizationPercent}% Budget Utilized
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                <div className="p-3 rounded-2xl bg-control-bg border border-white/5 space-y-1">
                  <div className="text-[10px] text-text-tertiary uppercase">Available Liability</div>
                  <div className="text-base font-black text-amber-400">${liabilities.availableLiabilityUsdt.toFixed(2)} USDT</div>
                  <div className="text-[9px] text-text-tertiary">Unlocked queue claims</div>
                </div>

                <div className="p-3 rounded-2xl bg-control-bg border border-white/5 space-y-1">
                  <div className="text-[10px] text-text-tertiary uppercase">Committed Liability</div>
                  <div className="text-base font-black text-purple-400">${liabilities.committedLiabilityUsdt.toFixed(2)} USDT</div>
                  <div className="text-[9px] text-text-tertiary">Pending admin review</div>
                </div>

                <div className="p-3 rounded-2xl bg-control-bg border border-white/5 space-y-1">
                  <div className="text-[10px] text-text-tertiary uppercase">Disbursed Spend</div>
                  <div className="text-base font-black text-usdt-green">${liabilities.disbursedSpendUsdt.toFixed(2)} USDT</div>
                  <div className="text-[9px] text-text-tertiary">Ledger credited</div>
                </div>

                <div className="p-3 rounded-2xl bg-control-bg border border-white/5 space-y-1">
                  <div className="text-[10px] text-text-tertiary uppercase">Remaining Budget</div>
                  <div className="text-base font-black text-cyan-400">${liabilities.remainingBudgetUsdt.toFixed(2)} USDT</div>
                  <div className="text-[9px] text-text-tertiary">Of ${liabilities.totalBudgetUsdt.toFixed(0)} cap</div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-card-bg rounded-3xl p-5 sm:p-6 border border-white/10 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-black text-text-primary flex items-center gap-2">
                  <Gift size={16} className="text-usdt-green" /> Authoritative Reward Claim Queue
                </h3>
                <p className="text-xs text-text-tertiary mt-0.5">
                  Claims authorized here are immediately disbursed into the user's wallet via the Double-Entry Ledger Orchestrator.
                </p>
              </div>
            </div>

            <div className="space-y-3">
            {rewards.map((r) => (
              <div
                key={r.id}
                className="p-4 rounded-2xl bg-control-bg border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono shadow-sm hover:border-white/10 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-text-primary">User #{r.telegramUserId}</span>
                    <span className="text-usdt-green font-black text-sm">${r.amount} USDT</span>
                    <span className="text-[10px] text-text-tertiary px-2 py-0.5 rounded bg-white/5 border border-white/5">
                      {r.rewardType}
                    </span>
                  </div>
                  <div className="text-[11px] text-text-tertiary">
                    Ref: <code>{r.reference}</code> · Created: {new Date(r.createdAt).toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <StatusBadge label={r.status} variant={r.status === 'APPROVED' ? 'success' : r.status === 'PENDING' ? 'warning' : 'default'} dot />
                  {r.status === 'PENDING' && (
                    <button
                      onClick={() => handleApproveReward(r.id)}
                      disabled={approvingId === r.id}
                      className="px-4 py-2 rounded-xl bg-usdt-green text-app-bg font-black text-xs uppercase tracking-wider shadow-md hover:brightness-110 disabled:opacity-50 cursor-pointer transition-transform active:scale-95"
                    >
                      {approvingId === r.id ? 'Disbursing...' : 'Approve & Disburse'}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {rewards.length === 0 && !loading && (
              <div className="p-8 text-center bg-control-bg rounded-2xl border border-white/5 space-y-1">
                <p className="text-xs font-bold text-text-primary">No pending reward claims</p>
                <p className="text-[11px] text-text-tertiary">All milestone and referral claims have been processed into the ledger.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* ─── 4. TAB 2: REFERRAL GRAPH ────────────────────────────────────────── */}
      {tab === 'REFERRALS' && (
        <div className="space-y-4">
          {/* User Tree Inspector */}
          <form onSubmit={handleSearchUserGraph} className="bg-card-bg rounded-3xl p-4 sm:p-5 border border-white/10 flex gap-2 shadow-xl">
            <div className="relative flex-1">
              <input
                type="text"
                required
                placeholder="Enter Telegram User ID to inspect downstream tree (e.g. 5387655307)..."
                value={searchUserId}
                onChange={(e) => setSearchUserId(e.target.value)}
                className="w-full h-11 px-4 rounded-2xl bg-control-bg text-xs font-mono text-text-primary border border-white/10 focus:border-usdt-green focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={searchingGraph}
              className="px-5 h-11 rounded-2xl bg-usdt-green text-app-bg font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50 hover:brightness-110"
            >
              <Search size={14} /> {searchingGraph ? 'Inspecting...' : 'Inspect Tree'}
            </button>
          </form>

          {userGraph && (
            <div className="bg-card-bg rounded-3xl p-5 sm:p-6 border border-usdt-green/40 space-y-3 shadow-xl font-mono text-xs">
              <h4 className="font-black text-sm text-usdt-green flex items-center gap-2">
                <Share2 size={16} /> Downstream Graph Topology: User #{userGraph.telegramUserId}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-control-bg text-text-primary">
                <div>Total Downstream Members: <strong className="text-usdt-green text-sm block">{userGraph.downstream || 0}</strong></div>
                <div>Direct Referees (Tier 1): <strong className="text-text-primary text-sm block">{userGraph.tree?.length || 0}</strong></div>
                <div>Upstream Referrer Chain: <strong className="text-ton-blue text-sm block">{userGraph.chain?.length || 0} levels</strong></div>
              </div>
            </div>
          )}

          {/* Referrer Economic Quality Score Rankings */}
          <div className="bg-card-bg rounded-3xl p-5 sm:p-6 border border-white/10 space-y-3 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-text-primary flex items-center gap-2">
                <Award size={14} className="text-cyan-400" /> Referrer Economic Quality Score Rankings
              </h4>
              <span className="text-[10px] font-mono text-text-tertiary">
                Score based on conversion rate & net contribution
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/10 bg-control-bg text-[10px] uppercase text-text-tertiary">
                    <th className="p-3.5 rounded-l-xl">Rank & Referrer</th>
                    <th className="p-3.5">Invited</th>
                    <th className="p-3.5">Qualified</th>
                    <th className="p-3.5">Paying</th>
                    <th className="p-3.5">Downline Net Contribution</th>
                    <th className="p-3.5 rounded-r-xl">Quality Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {referrerQuality.map((rq, idx) => (
                    <tr key={rq.referrerId} className="hover:bg-white/5 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-text-primary font-sans flex items-center gap-2">
                          <span className="text-[10px] text-text-tertiary">#{idx + 1}</span>
                          <span>{rq.referrerName || `User #${rq.referrerId}`}</span>
                        </div>
                        {rq.referrerUsername && (
                          <div className="text-[10px] text-cyan-400 font-mono">@{rq.referrerUsername}</div>
                        )}
                      </td>
                      <td className="p-3.5 text-text-primary">{rq.invitedCount}</td>
                      <td className="p-3.5 text-cyan-400">{rq.qualifiedCount}</td>
                      <td className="p-3.5 text-usdt-green">{rq.payingCount}</td>
                      <td className="p-3.5 font-bold text-usdt-green">${rq.downlineNetContributionUsdt.toFixed(2)}</td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${rq.qualityScore >= 70 ? 'bg-usdt-green' : rq.qualityScore >= 40 ? 'bg-cyan-400' : 'bg-amber-400'}`}
                              style={{ width: `${rq.qualityScore}%` }}
                            />
                          </div>
                          <span className="font-bold text-xs font-mono text-cyan-400">{rq.qualityScore}/100</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {referrerQuality.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-text-tertiary">
                        No referrer quality records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Qualified Ties Table */}
          <div className="bg-card-bg rounded-3xl p-5 sm:p-6 border border-white/10 space-y-3 shadow-xl">
            <h4 className="text-xs font-black uppercase tracking-wider text-text-secondary flex items-center gap-2">
              <Users size={14} className="text-usdt-green" /> Qualified Referral Relationships
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/10 bg-control-bg text-[10px] uppercase text-text-tertiary">
                    <th className="p-3.5 rounded-l-xl">Referrer</th>
                    <th className="p-3.5">Referee</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Rewards Granted</th>
                    <th className="p-3.5 rounded-r-xl">Qualified Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {referrals.map((rf) => (
                    <tr key={rf.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-3.5 text-text-primary font-bold">{rf.referrerName || `User #${rf.referrerId}`}</td>
                      <td className="p-3.5 text-text-secondary">{rf.refereeName || `User #${rf.refereeId}`}</td>
                      <td className="p-3.5"><StatusBadge label={rf.status} variant={rf.status === 'QUALIFIED' ? 'success' : 'default'} dot /></td>
                      <td className="p-3.5 text-usdt-green font-bold">{rf.rewards?.length || 0} Grants</td>
                      <td className="p-3.5 text-text-tertiary">{new Date(rf.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── 5. TAB 3: FRAUD RADAR ───────────────────────────────────────────── */}
      {tab === 'FRAUD' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card-bg rounded-3xl p-5 sm:p-6 border border-white/10 space-y-3 shadow-xl">
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <Flame size={16} /> IP Address Cluster Radar
            </h4>
            <p className="text-xs text-text-tertiary">Detects multi-account clusters originating from identical IP addresses.</p>
            <div className="p-4 rounded-2xl bg-control-bg text-xs font-mono text-text-secondary">
              {fraudData?.ipClusters ? JSON.stringify(fraudData.ipClusters, null, 2) : 'No high-density IP clusters detected.'}
            </div>
          </div>

          <div className="bg-card-bg rounded-3xl p-5 sm:p-6 border border-white/10 space-y-3 shadow-xl">
            <h4 className="text-xs font-black uppercase tracking-wider text-rose-400 flex items-center gap-2">
              <ShieldAlert size={16} /> Circular Referral Cycle Detection
            </h4>
            <p className="text-xs text-text-tertiary">Detects cyclic loops where accounts attempt to mutually earn commissions.</p>
            <div className="p-4 rounded-2xl bg-control-bg text-xs font-mono text-text-secondary">
              {fraudData?.graphCycles ? JSON.stringify(fraudData.graphCycles, null, 2) : '0 circular loops detected in graph topology.'}
            </div>
          </div>
        </div>
      )}

      {/* ─── 6. TAB 4: RULES ENGINE ──────────────────────────────────────────── */}
      {tab === 'RULES' && (
        <div className="bg-card-bg rounded-3xl p-5 sm:p-6 border border-white/10 space-y-4 shadow-xl max-w-lg">
          <h4 className="text-xs font-black uppercase tracking-wider text-text-primary flex items-center gap-2">
            <Sparkles size={16} className="text-usdt-green" /> Configure Reward Policy Rules
          </h4>

          <form onSubmit={handleSaveRule} className="space-y-3 text-xs font-mono">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-text-tertiary">Rule Code</label>
              <input
                type="text"
                required
                value={ruleCode}
                onChange={(e) => setRuleCode(e.target.value)}
                className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-text-primary focus:border-usdt-green focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-text-tertiary">Display Name</label>
              <input
                type="text"
                required
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-text-primary focus:border-usdt-green focus:outline-none font-sans"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-text-tertiary">Reward Amount (USDT)</label>
              <input
                type="text"
                required
                value={ruleAmount}
                onChange={(e) => setRuleAmount(e.target.value)}
                className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-text-primary focus:border-usdt-green focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submittingRule}
              className="w-full py-2.5 rounded-xl bg-usdt-green text-app-bg font-black text-xs uppercase tracking-wider shadow-lg hover:brightness-110 disabled:opacity-50 cursor-pointer"
            >
              {submittingRule ? 'Persisting Rule...' : 'Save & Activate Reward Rule'}
            </button>
          </form>
        </div>
      )}

      {/* ─── 7. UNIFIED OS CROSS-SYSTEM NAVIGATION HUB (NO DEAD ENDS!) ───────── */}
      <div className="space-y-3">
        <h2 className="text-xs font-black uppercase tracking-wider text-text-secondary flex items-center gap-2">
          <Zap size={14} className="text-usdt-green" /> Unified Control Plane Integrations & Workflows
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Link
            to="/admin/treasury"
            className="group p-4 rounded-2xl bg-card-bg border border-white/10 hover:border-usdt-green/50 transition-all space-y-2 shadow-md"
          >
            <div className="flex items-center justify-between text-usdt-green">
              <Wallet size={18} />
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
            <div className="font-extrabold text-xs text-text-primary">Treasury & Ledger</div>
            <p className="text-[11px] text-text-tertiary">
              Inspect double-entry ledger postings generated from approved milestone disbursements.
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
            <div className="font-extrabold text-xs text-text-primary">User Accounts & Ranks</div>
            <p className="text-[11px] text-text-tertiary">
              Manage operator progression levels, trust scores, and individual referral trees.
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
              Escalate detected Sybil clusters and cyclic loops into active risk incidents.
            </p>
          </Link>

          <Link
            to="/admin/notifications"
            className="group p-4 rounded-2xl bg-card-bg border border-white/10 hover:border-purple-400/50 transition-all space-y-2 shadow-md"
          >
            <div className="flex items-center justify-between text-purple-400">
              <Sparkles size={18} />
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
            <div className="font-extrabold text-xs text-text-primary">Milestone Broadcasts</div>
            <p className="text-[11px] text-text-tertiary">
              Send global platform congratulations to operators reaching high referral milestones.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
};
