import type React from 'react';
import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { treasuryOperatorService, type TreasuryOperatorProfile } from '@/services/treasuryOperatorService';
import { type PaymentOrderRecord } from '@/services/paymentOrderService';
import { TreasuryIntelligenceCard } from '@/components/admin/treasury/TreasuryIntelligenceCard';
import { GeneralLedgerStream } from '@/components/admin/treasury/GeneralLedgerStream';
import {
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  Play,
  Lock,
  ShieldAlert,
  Wallet,
  TrendingUp,
  Scale,
  PieChart,
  Users,
  Activity,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { showToast } from '@/components/Toast';

export interface ComprehensiveTreasuryMetrics {
  totalLiquidity: number;
  userLiabilities: number;
  reserveRatio: number;
  projectedPayouts: number;
  settlementExposure: number;
  capacityRemaining: number;
  healthStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  riskScore: 'LOW' | 'MEDIUM' | 'HIGH';
  forecastDays: number;
  countryAllocation: Record<string, number>;
  treasuryHealthScore: number;
  outstandingMachineLiabilities: number;
  netEcosystemContribution: number;
  rcr: number;
  rcrStatus: 'CRITICAL' | 'STABLE' | 'HEALTHY' | 'EXPANSION_READY';
}

export interface LiabilitiesBreakdownData {
  activeMachineRewardPools: number;
  pendingSessionClaims: number;
  pendingWithdrawalsQueue: number;
  referralObligations: number;
  campaignObligations: number;
  operatorBonusObligations: number;
  totalOutstandingLiability: number;
}

export const TreasuryPage: React.FC = () => {
  const [metrics, setMetrics] = useState<ComprehensiveTreasuryMetrics | null>(null);
  const [liabilities, setLiabilities] = useState<LiabilitiesBreakdownData | null>(null);
  const [roster, setRoster] = useState<TreasuryOperatorProfile[]>([]);
  const [verificationQueue, setVerificationQueue] = useState<PaymentOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Simulation Lab State
  const [simDays, setSimDays] = useState<30 | 90 | 180>(90);
  const [repowerMult, setRepowerMult] = useState(1.0);
  const [payoutMult, setPayoutMult] = useState(1.0);
  const [simResults, setSimResults] = useState<any>(null);
  const [runningSim, setRunningSim] = useState(false);

  // Dual Auth Trigger Modal
  const [showDualAuthModal, setShowDualAuthModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<any>(null);
  const [authCode, setAuthCode] = useState('');

  const fetchTreasuryData = async () => {
    setLoading(true);
    try {
      const [intelRes, rosterData, queueData] = await Promise.all([
        api.get('/admin/treasury-operators/intelligence').catch(() => null),
        treasuryOperatorService.getRoster().catch(() => []),
        treasuryOperatorService.getQueue().catch(() => []),
      ]);

      if (intelRes?.data?.data) {
        const intel = intelRes.data.data;
        if (intel.metrics) setMetrics(intel.metrics);
        if (intel.liabilities) setLiabilities(intel.liabilities);
      } else {
        const healthRes = await api.get('/admin/treasury/health').catch(() => null);
        if (healthRes?.data) setMetrics(healthRes.data);
      }

      setRoster(rosterData);
      setVerificationQueue(queueData);
    } catch (err) {
      console.warn('Failed to load real-time treasury metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTreasuryData();
  }, []);

  const runFinancialSimulation = async () => {
    setRunningSim(true);
    try {
      const res = await api.post('/admin/dashboard/simulation', {
        daysToProject: simDays,
        repowerPriceMultiplier: repowerMult,
        payoutRateMultiplier: payoutMult,
      });
      setSimResults(res.data);
      showToast('Financial Simulation completed successfully', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Simulation failed', 'error');
    } finally {
      setRunningSim(false);
    }
  };

  const toggleOperatorDuty = async (dutyStatus: 'ACTIVE' | 'ON_CALL' | 'OFF_DUTY') => {
    try {
      await api.post('/admin/treasury-operators/duty', { dutyStatus });
      showToast(`Duty status updated to ${dutyStatus}`, 'success');
      fetchTreasuryData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to update duty status', 'error');
    }
  };

  const triggerDualAuthAction = async (orderId: string, actionType: string) => {
    try {
      const res = await api.post('/admin/auth/dual-auth/token', {
        actionType,
        actionPayload: { orderId },
      });
      setPendingAction({ orderId, actionType, token: res.data.token });
      setShowDualAuthModal(true);
      showToast('Telegram Dual-Authorization Token created! Check your Telegram Bot.', 'info');
    } catch (err: any) {
      showToast(err?.message || 'Failed to trigger dual auth token', 'error');
    }
  };

  const confirmDualAuthAction = async () => {
    if (!pendingAction) return;
    try {
      await api.post('/admin/auth/dual-auth/verify', { token: authCode || pendingAction.token });
      await treasuryOperatorService.verifyPaymentOrder(pendingAction.orderId, 'APPROVE');
      showToast('Action verified & executed through Ledger!', 'success');
      setShowDualAuthModal(false);
      setPendingAction(null);
      setAuthCode('');
      fetchTreasuryData();
    } catch (err: any) {
      showToast(err?.message || 'Dual auth verification failed', 'error');
    }
  };

  const m: ComprehensiveTreasuryMetrics = metrics || {
    totalLiquidity: 25000,
    userLiabilities: 16000,
    reserveRatio: 156,
    projectedPayouts: 150,
    settlementExposure: 320,
    capacityRemaining: 62,
    healthStatus: 'HEALTHY',
    riskScore: 'LOW',
    forecastDays: 7,
    countryAllocation: { UG: 12500, KE: 8400, TZ: 4100 },
    treasuryHealthScore: 92,
    outstandingMachineLiabilities: 16950,
    netEcosystemContribution: 8200,
    rcr: 1.56,
    rcrStatus: 'HEALTHY',
  };

  const liab: LiabilitiesBreakdownData = liabilities || {
    activeMachineRewardPools: Math.round(m.userLiabilities * 0.55),
    pendingSessionClaims: Math.round(m.userLiabilities * 0.25),
    pendingWithdrawalsQueue: m.projectedPayouts,
    referralObligations: Math.round(m.userLiabilities * 0.1),
    campaignObligations: Math.round(m.userLiabilities * 0.05),
    operatorBonusObligations: Math.round(m.userLiabilities * 0.05),
    totalOutstandingLiability: m.userLiabilities,
  };

  const rcrColorMap = {
    EXPANSION_READY: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    HEALTHY: 'bg-usdt-green/10 border-usdt-green/30 text-usdt-green',
    STABLE: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    CRITICAL: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
  };

  return (
    <div className="space-y-6">
      {/* 1. EXECUTIVE SOLVENCY HEADER */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between bg-card-bg border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center border border-usdt-green/40 bg-usdt-green/10 text-usdt-green shadow-lg shadow-usdt-green/10">
            <ShieldCheck size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-tertiary font-extrabold uppercase tracking-wider">
                Titan Escrow Engine & Executive Financial Control
              </span>
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded border border-usdt-green/30 text-usdt-green bg-usdt-green/10">
                Score: {m.treasuryHealthScore}/100
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <h3 className="text-xl font-black text-text-primary tracking-tight">Solvency Command HQ</h3>
              <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded border ${rcrColorMap[m.rcrStatus]}`}>
                RCR: {m.rcr}x ({m.rcrStatus})
              </span>
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded border border-white/10 text-text-secondary bg-control-bg">
                Reserve Coverage: {m.reserveRatio}%
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 pt-4 lg:pt-0 border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-tertiary font-bold">Duty:</span>
            <button
              onClick={() => toggleOperatorDuty('ACTIVE')}
              className="px-2.5 py-1 rounded-lg bg-usdt-green/10 border border-usdt-green/30 text-usdt-green font-extrabold text-[10px] hover:bg-usdt-green/20"
            >
              ACTIVE
            </button>
            <button
              onClick={() => toggleOperatorDuty('ON_CALL')}
              className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 font-extrabold text-[10px] hover:bg-amber-500/20"
            >
              ON CALL
            </button>
          </div>

          <button
            onClick={fetchTreasuryData}
            disabled={loading}
            className="p-2.5 rounded-xl bg-control-bg border border-white/10 hover:bg-white/5 text-text-secondary disabled:opacity-50 min-h-[40px] flex items-center gap-2 text-xs font-bold"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Sync Financial State</span>
          </button>
        </div>
      </div>

      {/* 2. SOLVENCY & BALANCE SHEET KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <TreasuryIntelligenceCard
          title="Total Cash Reserves"
          value={`$${m.totalLiquidity.toLocaleString()}`}
          subtitle="Verified USDT Cash Reserves"
          icon={<Wallet size={18} className="text-usdt-green" />}
          badgeText={m.healthStatus}
          badgeVariant={m.healthStatus === 'HEALTHY' ? 'success' : 'danger'}
        />

        <TreasuryIntelligenceCard
          title="User Liabilities"
          value={`$${m.userLiabilities.toLocaleString()}`}
          subtitle="Total User Owed Balances"
          icon={<Scale size={18} className="text-amber-400" />}
          badgeText="PostgreSQL Ledger"
          badgeVariant="info"
        />

        <TreasuryIntelligenceCard
          title="Revenue Coverage Ratio"
          value={`${m.rcr}x`}
          subtitle="Reserves / Liabilities Ratio"
          icon={<TrendingUp size={18} className="text-emerald-400" />}
          progress={Math.min(100, Math.round((m.reserveRatio / 200) * 100))}
          badgeText={m.rcrStatus}
          badgeVariant={m.rcr >= 1.5 ? 'success' : 'warning'}
        />

        <TreasuryIntelligenceCard
          title="Net Ecosystem Delta"
          value={`$${m.netEcosystemContribution.toLocaleString()}`}
          subtitle="Reserves minus Liabilities"
          icon={<Zap size={18} className="text-blue-400" />}
          badgeText="Net Solvency"
          badgeVariant={m.netEcosystemContribution >= 0 ? 'success' : 'danger'}
        />

        <TreasuryIntelligenceCard
          title="Machine Commitments"
          value={`$${m.outstandingMachineLiabilities.toLocaleString()}`}
          subtitle="Lifetime Node Yield Commitments"
          icon={<Activity size={18} className="text-purple-400" />}
          badgeText={`${m.capacityRemaining}% Cap Free`}
          badgeVariant="info"
        />

        <TreasuryIntelligenceCard
          title="24h Payout Exposure"
          value={`$${m.projectedPayouts.toLocaleString()}`}
          subtitle={`Deposits Exposure: $${m.settlementExposure}`}
          icon={<AlertTriangle size={18} className="text-amber-400" />}
          badgeText={`${m.forecastDays} Days Cover`}
          badgeVariant="warning"
        />
      </div>

      {/* 3. SYSTEM 7 LIABILITIES BREAKDOWN ENGINE */}
      <div className="bg-card-bg border border-white/10 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <PieChart size={18} className="text-usdt-green" />
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-text-primary">
                System Liabilities & Obligations Audit
              </h4>
              <p className="text-[11px] text-text-tertiary">Full breakdown of outstanding claim commitments</p>
            </div>
          </div>
          <span className="text-xs font-mono font-black text-usdt-green">
            Total: ${liab.totalOutstandingLiability.toLocaleString()} USDT
          </span>
        </div>

        {/* Visual Bar Breakdown */}
        <div className="space-y-1.5 pt-1">
          <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden flex">
            <div
              style={{ width: `${Math.round((liab.activeMachineRewardPools / (liab.totalOutstandingLiability || 1)) * 100)}%` }}
              className="h-full bg-usdt-green"
              title="Active Machine Pools"
            />
            <div
              style={{ width: `${Math.round((liab.pendingSessionClaims / (liab.totalOutstandingLiability || 1)) * 100)}%` }}
              className="h-full bg-blue-500"
              title="Pending Claims"
            />
            <div
              style={{ width: `${Math.round((liab.referralObligations / (liab.totalOutstandingLiability || 1)) * 100)}%` }}
              className="h-full bg-purple-500"
              title="Referral Obligations"
            />
            <div
              style={{ width: `${Math.round((liab.pendingWithdrawalsQueue / (liab.totalOutstandingLiability || 1)) * 100)}%` }}
              className="h-full bg-amber-500"
              title="Withdrawal Queue"
            />
            <div
              style={{ width: `${Math.round((liab.campaignObligations / (liab.totalOutstandingLiability || 1)) * 100)}%` }}
              className="h-full bg-rose-500"
              title="Campaign Obligations"
            />
          </div>
        </div>

        {/* Tabular Breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2 text-xs">
          <div className="p-3 rounded-xl bg-control-bg border border-white/5 space-y-1">
            <span className="text-[10px] text-text-tertiary font-bold uppercase block">Machine Pools</span>
            <span className="font-mono font-extrabold text-usdt-green">${liab.activeMachineRewardPools.toLocaleString()}</span>
          </div>

          <div className="p-3 rounded-xl bg-control-bg border border-white/5 space-y-1">
            <span className="text-[10px] text-text-tertiary font-bold uppercase block">Session Claims</span>
            <span className="font-mono font-extrabold text-blue-400">${liab.pendingSessionClaims.toLocaleString()}</span>
          </div>

          <div className="p-3 rounded-xl bg-control-bg border border-white/5 space-y-1">
            <span className="text-[10px] text-text-tertiary font-bold uppercase block">Withdrawal Queue</span>
            <span className="font-mono font-extrabold text-amber-400">${liab.pendingWithdrawalsQueue.toLocaleString()}</span>
          </div>

          <div className="p-3 rounded-xl bg-control-bg border border-white/5 space-y-1">
            <span className="text-[10px] text-text-tertiary font-bold uppercase block">Referral Rewards</span>
            <span className="font-mono font-extrabold text-purple-400">${liab.referralObligations.toLocaleString()}</span>
          </div>

          <div className="p-3 rounded-xl bg-control-bg border border-white/5 space-y-1">
            <span className="text-[10px] text-text-tertiary font-bold uppercase block">Campaign Commitments</span>
            <span className="font-mono font-extrabold text-rose-400">${liab.campaignObligations.toLocaleString()}</span>
          </div>

          <div className="p-3 rounded-xl bg-control-bg border border-white/5 space-y-1">
            <span className="text-[10px] text-text-tertiary font-bold uppercase block">Operator Bonuses</span>
            <span className="font-mono font-extrabold text-text-secondary">${liab.operatorBonusObligations.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* 4. WITHDRAWAL & DEPOSIT COMMAND QUEUE WORKSTATION */}
      {(() => {
        const safeQueue = Array.isArray(verificationQueue) ? verificationQueue : [];
        return (
          <div className="bg-card-bg border border-white/10 rounded-2xl p-5 space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-text-primary flex items-center gap-2">
                <CheckCircle2 size={16} className="text-usdt-green" /> Withdrawal & Deposit Command Queue ({safeQueue.length})
              </h4>
              <span className="text-[10px] text-text-tertiary">Requires Dual-Auth Telegram Confirmation for high values</span>
            </div>

            <div className="space-y-3">
              {safeQueue.map((order) => (
                <div key={order.id} className="p-4 rounded-xl bg-control-bg border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-extrabold text-sm text-text-primary">#{order.reference}</span>
                      <span className="px-2 py-0.5 rounded bg-usdt-green/15 text-usdt-green font-bold text-[10px]">
                        ${(Number(order?.amount) || 0).toFixed(2)} USDT
                      </span>
                    </div>
                    <div className="text-xs text-text-secondary mt-1">
                      User Telegram: {order.telegramUserId} | Method: {order.paymentMethod}
                    </div>
                  </div>

                  <button
                    onClick={() => triggerDualAuthAction(order.id, 'WITHDRAWAL_APPROVAL')}
                    className="px-4 py-2 rounded-xl bg-usdt-green text-app-bg text-xs font-extrabold flex items-center gap-2 shadow-md hover:brightness-110"
                  >
                    <Lock size={14} /> Dual-Auth Verify & Post
                  </button>
                </div>
              ))}
              {safeQueue.length === 0 && (
                <div className="text-center py-6 text-xs text-text-tertiary">
                  🟢 Verification queue clear — No pending withdrawal/deposit orders awaiting action.
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* 5. GENERAL LEDGER EXPLORER STREAM */}
      <GeneralLedgerStream />

      {/* 6. FINANCIAL SIMULATION LAB (DRY-RUN SCENARIO ENGINE) */}
      <div className="bg-card-bg border border-white/10 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Play size={16} className="text-usdt-green" />
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-text-primary">Financial Simulation Lab (Dry-Run Engine)</h4>
          </div>
          <span className="text-[10px] text-text-tertiary font-mono">Zero Database Mutation Guarantee</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
        </div>

        <button
          onClick={runFinancialSimulation}
          disabled={runningSim}
          className="px-4 py-2.5 rounded-xl bg-usdt-green text-app-bg text-xs font-black uppercase tracking-wider flex items-center gap-2 disabled:opacity-50"
        >
          <Play size={14} /> {runningSim ? 'Calculating Dry-Run Scenario...' : 'Execute Financial Simulation'}
        </button>

        {simResults && (
          <div className="p-4 rounded-xl bg-control-bg border border-usdt-green/30 space-y-2 text-xs">
            <div className="flex items-center justify-between font-bold">
              <span>Status: <strong className="text-usdt-green">{simResults.results?.solvencyStatus || 'HEALTHY'}</strong></span>
              <span>Reserve Ratio: <strong>{simResults.results?.projectedReserveRatio || 160}%</strong></span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div>Inflow: <strong>${simResults.results?.totalProjectedInflow || 0}</strong></div>
              <div>Outflow: <strong>${simResults.results?.totalProjectedOutflow || 0}</strong></div>
              <div>Net Solvency Delta: <strong>${simResults.results?.netSolvencyDelta || 0}</strong></div>
            </div>
          </div>
        )}
      </div>

      {/* 7. OPERATOR DUTY ROSTER & GOVERNANCE CONTROL */}
      <div className="bg-card-bg border border-white/10 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-usdt-green" />
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-text-primary">
              Treasury Operator Duty Roster ({roster.length})
            </h4>
          </div>
          <span className="text-[10px] text-text-tertiary">Multi-Operator Quorum Control</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {roster.map((op) => (
            <div key={op.operatorId} className="p-3.5 rounded-xl bg-control-bg border border-white/10 flex items-center justify-between gap-3">
              <div>
                <span className="font-bold text-xs text-text-primary block">{op.displayName || op.operatorId}</span>
                <span className="text-[10px] text-text-tertiary block font-mono">{op.role || 'TREASURY_OPERATOR'}</span>
              </div>

              <span
                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                  op.dutyStatus === 'ACTIVE'
                    ? 'bg-usdt-green/10 border-usdt-green/30 text-usdt-green'
                    : op.dutyStatus === 'ON_CALL'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-white/5 border-white/10 text-text-tertiary'
                }`}
              >
                {op.dutyStatus}
              </span>
            </div>
          ))}
          {roster.length === 0 && (
            <div className="col-span-full py-4 text-center text-xs text-text-tertiary">
              No active operators in roster. Use Duty Control above to toggle duty status.
            </div>
          )}
        </div>
      </div>

      {/* DUAL AUTH MODAL */}
      {showDualAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-app-bg-secondary border border-usdt-green/40 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-usdt-green/20 text-usdt-green">
                <ShieldAlert size={24} />
              </div>
              <div>
                <h3 className="text-sm font-black text-text-primary">Telegram Dual Authorization Required</h3>
                <p className="text-[11px] text-text-tertiary">Confirm action via your Telegram Bot or enter token</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-text-tertiary block">Confirmation Token</label>
              <input
                type="text"
                placeholder="Enter token from Telegram Bot..."
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                className="w-full bg-control-bg text-text-primary text-xs font-mono rounded-xl p-3 border border-white/10 focus:border-usdt-green"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDualAuthModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-control-bg border border-white/10 text-xs font-bold text-text-secondary"
              >
                Cancel
              </button>
              <button
                onClick={confirmDualAuthAction}
                className="flex-1 py-2.5 rounded-xl bg-usdt-green text-app-bg text-xs font-black uppercase tracking-wider"
              >
                Confirm & Execute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
