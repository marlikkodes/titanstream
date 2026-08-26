import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { MetricCard, MetricCardGrid } from '@/components/admin/MetricCard';
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
      const res = await api.get('/admin/rewards');
      setRewards(Array.isArray(res.data) ? res.data : res.data?.data || []);
    } catch {
      setRewards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchReferrals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/referrals/relationships');
      setReferrals(Array.isArray(res.data) ? res.data : res.data?.data || []);
    } catch {
      setReferrals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFraudCheck = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/referrals/fraud-check');
      setFraudData(res.data?.data || res.data);
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
    <div className="space-y-4 sm:space-y-6">
      <MetricCardGrid columns={3}>
        <MetricCard label="Pending Rewards Queue" value={pendingRewards.length.toString()} icon="Gift" variant={pendingRewards.length > 0 ? 'gold' : 'green'} />
        <MetricCard label="Total Disbursed Rewards" value={`$${totalDisbursed.toLocaleString()} USDT`} icon="Award" variant="green" />
        <MetricCard label="Audited Relationships" value={referrals.length.toString()} icon="Share2" variant="blue" />
      </MetricCardGrid>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setTab('REWARDS')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-colors cursor-pointer shrink-0 ${
            tab === 'REWARDS'
              ? 'bg-usdt-green text-app-bg shadow-md'
              : 'bg-control-bg text-text-secondary border border-white/10 hover:text-text-primary'
          }`}
        >
          Pending Rewards ({pendingRewards.length})
        </button>
        <button
          onClick={() => setTab('REFERRALS')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-colors cursor-pointer shrink-0 ${
            tab === 'REFERRALS'
              ? 'bg-usdt-green text-app-bg shadow-md'
              : 'bg-control-bg text-text-secondary border border-white/10 hover:text-text-primary'
          }`}
        >
          Referral Network Graph
        </button>
        <button
          onClick={() => setTab('FRAUD')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-colors cursor-pointer shrink-0 ${
            tab === 'FRAUD'
              ? 'bg-usdt-green text-app-bg shadow-md'
              : 'bg-control-bg text-text-secondary border border-white/10 hover:text-text-primary'
          }`}
        >
          Sybil & Fraud Radar
        </button>
        <button
          onClick={() => setTab('RULES')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-colors cursor-pointer shrink-0 ${
            tab === 'RULES'
              ? 'bg-usdt-green text-app-bg shadow-md'
              : 'bg-control-bg text-text-secondary border border-white/10 hover:text-text-primary'
          }`}
        >
          Reward Rule Engine
        </button>
      </div>

      {/* TAB 1: REWARDS */}
      {tab === 'REWARDS' && (
        <div className="bg-card-bg rounded-2xl p-4 sm:p-5 border border-white/10 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-text-primary flex items-center gap-2">
                <Gift size={18} className="text-usdt-green" /> Authoritative Reward Approval Queue
              </h3>
              <p className="text-xs text-text-tertiary mt-0.5">
                Milestone and referral reward claims awaiting operator authorization before ledger disbursement.
              </p>
            </div>
            <button
              onClick={fetchRewards}
              disabled={loading}
              className="p-2 rounded-xl bg-control-bg border border-white/10 text-text-secondary hover:text-text-primary disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="space-y-2.5">
            {rewards.map((r) => (
              <div
                key={r.id}
                className="p-3.5 rounded-xl bg-control-bg border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-text-primary">User #{r.telegramUserId}</span>
                    <span className="text-usdt-green font-extrabold">${r.amount} USDT</span>
                    <span className="text-[10px] text-text-tertiary">({r.rewardType})</span>
                  </div>
                  <div className="text-[11px] text-text-tertiary">Ref: {r.reference} · Created: {new Date(r.createdAt).toLocaleString()}</div>
                </div>

                <div className="flex items-center gap-2">
                  <StatusBadge label={r.status} variant={r.status === 'APPROVED' ? 'success' : r.status === 'PENDING' ? 'warning' : 'default'} dot />
                  {r.status === 'PENDING' && (
                    <button
                      onClick={() => handleApproveReward(r.id)}
                      disabled={approvingId === r.id}
                      className="px-3.5 py-1.5 rounded-xl bg-usdt-green text-app-bg font-extrabold text-xs shadow hover:brightness-110 disabled:opacity-50 cursor-pointer"
                    >
                      {approvingId === r.id ? 'Disbursing...' : 'Approve & Disburse'}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {rewards.length === 0 && !loading && (
              <div className="p-8 text-center text-xs text-text-tertiary">No reward claims recorded in database</div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: REFERRALS */}
      {tab === 'REFERRALS' && (
        <div className="space-y-4">
          {/* User Graph Search Bar */}
          <form onSubmit={handleSearchUserGraph} className="bg-card-bg rounded-2xl p-4 border border-white/10 flex gap-2 shadow-lg">
            <input
              type="text"
              required
              placeholder="Enter Telegram User ID to inspect referral tree (e.g. 88102931)..."
              value={searchUserId}
              onChange={(e) => setSearchUserId(e.target.value)}
              className="flex-1 px-3.5 py-2 rounded-xl bg-control-bg text-xs font-mono text-text-primary border border-white/10 focus:border-usdt-green focus:outline-none"
            />
            <button
              type="submit"
              disabled={searchingGraph}
              className="px-4 py-2 rounded-xl bg-usdt-green text-app-bg font-extrabold text-xs flex items-center gap-1.5 shadow cursor-pointer disabled:opacity-50"
            >
              <Search size={14} /> {searchingGraph ? 'Inspecting...' : 'Inspect User Tree'}
            </button>
          </form>

          {userGraph && (
            <div className="bg-card-bg rounded-2xl p-5 border border-usdt-green/30 space-y-3 shadow-xl font-mono text-xs">
              <h4 className="font-extrabold text-sm text-usdt-green flex items-center gap-2">
                <Share2 size={16} /> Downstream Graph Tree: {userGraph.telegramUserId}
              </h4>
              <div className="p-3 rounded-xl bg-control-bg text-text-primary space-y-1">
                <div>Total Downstream Members: <strong className="text-usdt-green">{userGraph.downstream || 0}</strong></div>
                <div>Direct Referees (Tier 1): <strong className="text-text-primary">{userGraph.tree?.length || 0}</strong></div>
              </div>
            </div>
          )}

          {/* Referral Relationships Table */}
          <div className="bg-card-bg rounded-2xl p-4 sm:p-5 border border-white/10 space-y-3 shadow-xl">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-text-primary">Recent Qualified Relationships</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/10 bg-control-bg text-[10px] uppercase text-text-tertiary">
                    <th className="p-3">Referrer</th>
                    <th className="p-3">Referee</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Rewards</th>
                    <th className="p-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {referrals.map((rf) => (
                    <tr key={rf.id}>
                      <td className="p-3 text-text-primary font-bold">{rf.referrerName || rf.referrerId}</td>
                      <td className="p-3 text-text-secondary">{rf.refereeName || rf.refereeId}</td>
                      <td className="p-3"><StatusBadge label={rf.status} variant={rf.status === 'QUALIFIED' ? 'success' : 'default'} dot /></td>
                      <td className="p-3 text-usdt-green font-bold">{rf.rewards?.length || 0} Grants</td>
                      <td className="p-3 text-text-tertiary">{new Date(rf.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FRAUD */}
      {tab === 'FRAUD' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card-bg rounded-2xl p-5 border border-white/10 space-y-3 shadow-xl">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <Flame size={16} /> IP Address Cluster Radar
            </h4>
            <p className="text-xs text-text-tertiary">Detects multi-account clusters originating from identical IP addresses.</p>
            <div className="p-3 rounded-xl bg-control-bg text-xs font-mono text-text-secondary">
              {fraudData?.ipClusters ? JSON.stringify(fraudData.ipClusters, null, 2) : 'No high-density IP clusters detected.'}
            </div>
          </div>

          <div className="bg-card-bg rounded-2xl p-5 border border-white/10 space-y-3 shadow-xl">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-rose-400 flex items-center gap-2">
              <ShieldAlert size={16} /> Circular Referral Cycle Detection
            </h4>
            <p className="text-xs text-text-tertiary">Detects cyclic loops where accounts attempt to mutually earn commissions.</p>
            <div className="p-3 rounded-xl bg-control-bg text-xs font-mono text-text-secondary">
              {fraudData?.graphCycles ? JSON.stringify(fraudData.graphCycles, null, 2) : '0 circular loops detected in graph topology.'}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: RULES */}
      {tab === 'RULES' && (
        <div className="bg-card-bg rounded-2xl p-5 border border-white/10 space-y-4 shadow-xl max-w-lg">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-text-primary flex items-center gap-2">
            <Sparkles size={16} className="text-usdt-green" /> Configure Reward Rule Parameters
          </h4>

          <form onSubmit={handleSaveRule} className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-text-tertiary">Rule Code</label>
              <input
                type="text"
                required
                value={ruleCode}
                onChange={(e) => setRuleCode(e.target.value)}
                className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-xs font-mono text-text-primary focus:outline-none focus:border-usdt-green"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-text-tertiary">Display Name</label>
              <input
                type="text"
                required
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-xs text-text-primary focus:outline-none focus:border-usdt-green"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-text-tertiary">Reward Amount (USDT)</label>
              <input
                type="text"
                required
                value={ruleAmount}
                onChange={(e) => setRuleAmount(e.target.value)}
                className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-xs font-mono text-text-primary focus:outline-none focus:border-usdt-green"
              />
            </div>

            <button
              type="submit"
              disabled={submittingRule}
              className="w-full py-2.5 rounded-xl bg-usdt-green text-app-bg font-extrabold text-xs shadow-md hover:brightness-110 disabled:opacity-50 cursor-pointer"
            >
              {submittingRule ? 'Persisting Rule...' : 'Save & Activate Reward Rule'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
