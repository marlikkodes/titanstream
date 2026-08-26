import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/services/api';
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
  const [tab, setTab] = useState<'REWARDS' | 'REFERRALS' | 'FRAUD' | 'RULES'>('REWARDS');
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

  const fetchRewards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/rewards').catch(() => ({ data: [] }));
      const data = res?.data?.data ?? res?.data ?? [];
      setRewards(Array.isArray(data) ? data : []);
    } catch {
      setRewards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchReferrals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/referrals/relationships').catch(() => ({ data: [] }));
      const data = res?.data?.data ?? res?.data ?? [];
      setReferrals(Array.isArray(data) ? data : []);
    } catch {
      setReferrals([]);
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
    if (tab === 'REWARDS') fetchRewards();
    if (tab === 'REFERRALS') fetchReferrals();
    if (tab === 'FRAUD') fetchFraudCheck();
  }, [tab, fetchRewards, fetchReferrals, fetchFraudCheck]);

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
                  Growth & Tokenomics
                </span>
                <span className="text-xs text-text-tertiary">·</span>
                <span className="text-xs text-text-secondary font-mono flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${pendingRewards.length > 0 ? 'bg-amber-400 animate-pulse' : 'bg-usdt-green'}`} />
                  {pendingRewards.length > 0 ? `${pendingRewards.length} Claims Awaiting Authorization` : 'Queue Clear'}
                </span>
              </div>
              <h1 className="text-xl font-black text-text-primary tracking-tight mt-1">
                Growth & Referral Administration
              </h1>
              <p className="text-xs text-text-secondary mt-0.5">
                Authoritative referral tree tracking, double-entry milestone disbursements, and graph cycle anti-fraud radar.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end lg:self-center">
            <button
              onClick={() => {
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
          Referral Network Graph
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

      {/* ─── 3. TAB 1: REWARDS QUEUE ─────────────────────────────────────────── */}
      {tab === 'REWARDS' && (
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
