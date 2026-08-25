import type React from 'react';
import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { treasuryOperatorService, type TreasuryOperatorProfile } from '@/services/treasuryOperatorService';
import { type PaymentOrderRecord } from '@/services/paymentOrderService';
import { MetricCard, MetricCardGrid } from '@/components/admin/MetricCard';
import { ShieldCheck, AlertCircle, RefreshCw, CheckCircle2, XCircle, UserCheck, Play, Lock, ShieldAlert } from 'lucide-react';
import { showToast } from '@/components/Toast';

interface TreasuryMetrics {
  totalLiquidity: number;
  userLiabilities: number;
  reserveRatio: number;
  projectedPayouts: number;
  settlementExposure: number;
  capacityRemaining: number;
  healthStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  riskScore: 'LOW' | 'MEDIUM' | 'HIGH';
}

export const TreasuryPage: React.FC = () => {
  const [metrics, setMetrics] = useState<TreasuryMetrics | null>(null);
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
      const [healthRes, rosterData, queueData] = await Promise.all([
        api.get('/admin/treasury/health').catch(() => ({ data: null })),
        treasuryOperatorService.getRoster().catch(() => []),
        treasuryOperatorService.getQueue().catch(() => []),
      ]);

      if (healthRes.data) setMetrics(healthRes.data);
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

  const displayMetrics: TreasuryMetrics = metrics || {
    totalLiquidity: 0,
    userLiabilities: 0,
    reserveRatio: 100,
    projectedPayouts: 0,
    settlementExposure: 0,
    capacityRemaining: 100,
    healthStatus: 'HEALTHY',
    riskScore: 'LOW',
  };

  return (
    <div className="space-y-6">
      {/* Treasury Header */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-card-bg border border-white/10 rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center border border-usdt-green bg-usdt-green/10 text-usdt-green">
            <ShieldCheck size={24} />
          </div>
          <div>
            <span className="text-xs text-text-tertiary font-bold uppercase tracking-wider">Treasury Operations HQ</span>
            <div className="flex items-center gap-2 mt-0.5">
              <h3 className="text-lg font-extrabold text-text-primary">Titan Escrow Engine & Financial Control</h3>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border border-usdt-green/30 text-usdt-green bg-usdt-green/10">
                {displayMetrics.healthStatus}
              </span>
            </div>
          </div>
        </div>

        <button 
          onClick={fetchTreasuryData} 
          disabled={loading}
          className="p-2.5 rounded-xl bg-control-bg border border-white/10 hover:bg-white/5 text-text-secondary disabled:opacity-50 min-h-[40px]"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Verification Queue Workstation */}
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

      {/* FINANCIAL SIMULATION LAB */}
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
          <div className="p-4 rounded-xl bg-control-bg border border-usdt-green/30 space-y-2 mt-4 text-xs">
            <div className="flex items-center justify-between font-bold">
              <span>Status: <strong className="text-usdt-green">{simResults.results.solvencyStatus}</strong></span>
              <span>Reserve Ratio: <strong>{simResults.results.projectedReserveRatio}%</strong></span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div>Inflow: <strong>${simResults.results.totalProjectedInflow}</strong></div>
              <div>Outflow: <strong>${simResults.results.totalProjectedOutflow}</strong></div>
              <div>Net Solvency Delta: <strong>${simResults.results.netSolvencyDelta}</strong></div>
            </div>
          </div>
        )}
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
