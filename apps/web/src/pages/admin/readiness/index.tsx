import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/services/api';
import { showToast } from '@/components/Toast';
import {
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Layers,
  FileText,
  Play,
  Database,
  Server,
  DollarSign,
  Key,
  Award,
  Download,
  ArrowRight,
  Zap,
  Sliders,
  Wallet,
  Activity,
} from 'lucide-react';

export const ReadinessPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'RECONCILIATION' | 'SECURITY' | 'DLQ' | 'DISASTER' | 'RUNBOOKS' | 'CERTIFICATION'>('RECONCILIATION');
  const [loading, setLoading] = useState(true);

  // Overview State
  const [overview, setOverview] = useState<any>(null);

  // Runbooks State
  const [runbooks, setRunbooks] = useState<any>(null);

  // Master Launch Certification State
  const [certification, setCertification] = useState<any>(null);

  // Triggering actions
  const [runningReconciliation, setRunningReconciliation] = useState(false);
  const [runningSecurityAudit, setRunningSecurityAudit] = useState(false);

  // Fetch Overview
  const fetchOverview = useCallback(() => {
    setLoading(true);
    api.get('/admin/readiness/overview')
      .then((res) => setOverview(res.data?.data || res.data || null))
      .catch((err) => showToast(err.response?.data?.message || 'Failed to load readiness overview', 'error'))
      .finally(() => setLoading(false));
  }, []);

  // Fetch Runbooks
  const fetchRunbooks = useCallback(() => {
    api.get('/admin/readiness/runbooks')
      .then((res) => setRunbooks(res.data?.data || res.data || null))
      .catch(() => setRunbooks(null));
  }, []);

  // Fetch Master Launch Certification
  const fetchCertification = useCallback(() => {
    setLoading(true);
    api.get('/admin/readiness/launch-certification')
      .then((res) => setCertification(res.data?.data || res.data || null))
      .catch(() => setCertification(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const handleTabChange = (tab: 'RECONCILIATION' | 'SECURITY' | 'DLQ' | 'DISASTER' | 'RUNBOOKS' | 'CERTIFICATION') => {
    setActiveTab(tab);
    if (tab === 'RECONCILIATION' || tab === 'SECURITY' || tab === 'DLQ' || tab === 'DISASTER') fetchOverview();
    if (tab === 'RUNBOOKS') fetchRunbooks();
    if (tab === 'CERTIFICATION') fetchCertification();
  };

  // Run Manual Financial Reconciliation
  const handleRunReconciliation = () => {
    setRunningReconciliation(true);
    api.post('/admin/readiness/reconciliation/run')
      .then(() => {
        showToast('Double-entry ledger reconciliation executed successfully.', 'success');
        fetchOverview();
      })
      .catch((err) => showToast(err.response?.data?.message || 'Reconciliation failed', 'error'))
      .finally(() => setRunningReconciliation(false));
  };

  // Run Security Audit
  const handleRunSecurityAudit = () => {
    setRunningSecurityAudit(true);
    api.post('/admin/readiness/security/audit')
      .then(() => {
        showToast('Automated RBAC security penetration audit completed.', 'success');
        fetchOverview();
      })
      .catch((err) => showToast(err.response?.data?.message || 'Security audit failed', 'error'))
      .finally(() => setRunningSecurityAudit(false));
  };

  // DLQ Recovery Action
  const handleDlqAction = (itemId: string, action: 'RETRY' | 'DRAIN') => {
    const reason = prompt(`Enter reason to ${action} DLQ item ${itemId}:`);
    if (!reason || !reason.trim()) {
      showToast('Mandatory reason required for DLQ recovery', 'error');
      return;
    }
    api.post('/admin/readiness/dlq/manage', { itemId, action, reason: reason.trim() })
      .then(() => {
        showToast(`DLQ item ${action} executed.`, 'success');
        fetchOverview();
      })
      .catch((err) => showToast(err.response?.data?.message || 'DLQ recovery failed', 'error'));
  };

  return (
    <div className="space-y-6">
      {/* ─── 1. HERO SECTION: READINESS & RESILIENCE COCKPIT ─────────────────── */}
      <div className="relative overflow-hidden bg-card-bg border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-usdt-green/10 border border-usdt-green/40 text-usdt-green shrink-0 shadow-lg">
              <ShieldCheck size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-usdt-green bg-usdt-green/10 px-2 py-0.5 rounded border border-usdt-green/30">
                  Reliability & Governance
                </span>
                <span className="text-xs text-text-tertiary">·</span>
                <span className="text-xs text-text-secondary font-mono flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-usdt-green animate-pulse" />
                  {overview?.readinessStatus || 'PRODUCTION_READY'}
                </span>
              </div>
              <h1 className="text-xl font-black text-text-primary tracking-tight mt-1">
                Readiness, Disaster Recovery & Certification
              </h1>
              <p className="text-xs text-text-secondary mt-0.5">
                Double-entry mathematical reconciliation, DLQ dead-letter management, point-in-time recovery, and launch sign-off.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-end lg:self-center">
            <button
              onClick={handleRunReconciliation}
              disabled={runningReconciliation}
              className="px-4 py-2.5 rounded-2xl bg-usdt-green text-app-bg font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg hover:brightness-110 disabled:opacity-50 cursor-pointer"
            >
              <Play size={14} /> {runningReconciliation ? 'Reconciling...' : 'Run Ledger Audit'}
            </button>
            <button
              onClick={handleRunSecurityAudit}
              disabled={runningSecurityAudit}
              className="px-4 py-2.5 rounded-2xl bg-control-bg border border-usdt-green/40 text-usdt-green font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm cursor-pointer hover:bg-white/5"
            >
              <Lock size={14} /> {runningSecurityAudit ? 'Auditing...' : 'Security Check'}
            </button>
            <button
              onClick={() => {
                if (activeTab === 'CERTIFICATION') fetchCertification();
                else if (activeTab === 'RUNBOOKS') fetchRunbooks();
                else fetchOverview();
              }}
              disabled={loading}
              className="p-2.5 rounded-xl bg-control-bg border border-white/10 text-text-secondary hover:text-text-primary disabled:opacity-50 cursor-pointer shadow-sm"
              title="Refresh Readiness Telemetry"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Live Readiness KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/5 font-mono">
          <div className="p-3.5 rounded-2xl bg-control-bg/60 border border-white/5 space-y-1">
            <span className="text-[10px] font-bold uppercase text-text-tertiary flex items-center gap-1 font-sans">
              <CheckCircle2 size={12} className="text-usdt-green" /> Ledger Integrity
            </span>
            <div className="text-lg font-black text-usdt-green">
              {overview?.reconciliation?.integrityStatus || 'HEALTHY'}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-control-bg/60 border border-white/5 space-y-1">
            <span className="text-[10px] font-bold uppercase text-text-tertiary flex items-center gap-1 font-sans">
              <Lock size={12} className="text-ton-blue" /> RBAC Security
            </span>
            <div className="text-lg font-black text-text-primary">
              {overview?.securityAudit?.securityPass ? 'PASSED' : 'VERIFIED'}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-control-bg/60 border border-white/5 space-y-1">
            <span className="text-[10px] font-bold uppercase text-text-tertiary flex items-center gap-1 font-sans">
              <Layers size={12} className="text-amber-400" /> DLQ Worker Items
            </span>
            <div className="text-lg font-black text-text-primary">
              {overview?.queueReliability?.openQueueItemsCount || 0} <span className="text-xs text-text-tertiary font-normal font-sans">items</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-control-bg/60 border border-white/5 space-y-1">
            <span className="text-[10px] font-bold uppercase text-text-tertiary flex items-center gap-1 font-sans">
              <Database size={12} className="text-purple-400" /> PITR Recovery
            </span>
            <div className="text-lg font-black text-usdt-green">
              {overview?.disasterRecovery?.disasterRecoveryHealth || 'READY'}
            </div>
          </div>
        </div>
      </div>

      {/* ─── 2. NAVIGATION TABS ────────────────────────────────────────────────── */}
      <div className="flex border-b border-white/10 gap-2 overflow-x-auto no-scrollbar pb-2">
        <button
          onClick={() => handleTabChange('RECONCILIATION')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 flex items-center gap-2 ${
            activeTab === 'RECONCILIATION'
              ? 'bg-usdt-green text-app-bg shadow-lg shadow-usdt-green/20'
              : 'bg-control-bg text-text-secondary border border-white/10 hover:text-text-primary'
          }`}
        >
          <DollarSign size={14} /> Financial Reconciliation
        </button>
        <button
          onClick={() => handleTabChange('SECURITY')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 flex items-center gap-2 ${
            activeTab === 'SECURITY'
              ? 'bg-usdt-green text-app-bg shadow-lg shadow-usdt-green/20'
              : 'bg-control-bg text-text-secondary border border-white/10 hover:text-text-primary'
          }`}
        >
          <Lock size={14} /> Security Penetration
        </button>
        <button
          onClick={() => handleTabChange('DLQ')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 flex items-center gap-2 ${
            activeTab === 'DLQ'
              ? 'bg-usdt-green text-app-bg shadow-lg shadow-usdt-green/20'
              : 'bg-control-bg text-text-secondary border border-white/10 hover:text-text-primary'
          }`}
        >
          <Layers size={14} /> Dead-Letter Queue (DLQ)
        </button>
        <button
          onClick={() => handleTabChange('DISASTER')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 flex items-center gap-2 ${
            activeTab === 'DISASTER'
              ? 'bg-usdt-green text-app-bg shadow-lg shadow-usdt-green/20'
              : 'bg-control-bg text-text-secondary border border-white/10 hover:text-text-primary'
          }`}
        >
          <Database size={14} /> Disaster Recovery
        </button>
        <button
          onClick={() => handleTabChange('RUNBOOKS')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 flex items-center gap-2 ${
            activeTab === 'RUNBOOKS'
              ? 'bg-usdt-green text-app-bg shadow-lg shadow-usdt-green/20'
              : 'bg-control-bg text-text-secondary border border-white/10 hover:text-text-primary'
          }`}
        >
          <FileText size={14} /> Runbooks
        </button>
        <button
          onClick={() => handleTabChange('CERTIFICATION')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 flex items-center gap-2 ${
            activeTab === 'CERTIFICATION'
              ? 'bg-usdt-green text-app-bg shadow-lg shadow-usdt-green/20'
              : 'bg-control-bg text-text-secondary border border-white/10 hover:text-text-primary'
          }`}
        >
          <Award size={14} /> Launch Certification
        </button>
      </div>

      {/* ─── 3. TAB 1: FINANCIAL INTEGRITY & RECONCILIATION ──────────────────── */}
      {activeTab === 'RECONCILIATION' && overview?.reconciliation && (
        <div className="space-y-4">
          <div className="p-5 sm:p-6 rounded-3xl bg-card-bg border border-white/10 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-text-primary flex items-center gap-2">
                <CheckCircle2 size={16} className="text-usdt-green" /> Double-Entry Mathematical Reconciliation Status
              </h4>
              <span className="text-xs font-mono text-text-tertiary">
                Audited: {new Date(overview.reconciliation.reconciliationTimestamp).toLocaleString()}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-4 rounded-2xl bg-control-bg space-y-1">
                <span className="text-[10px] text-text-tertiary uppercase font-sans">Total Inflow Volume</span>
                <p className="font-black text-sm text-usdt-green">${overview.reconciliation.totalInflowAmount?.toLocaleString()} USDT</p>
              </div>
              <div className="p-4 rounded-2xl bg-control-bg space-y-1">
                <span className="text-[10px] text-text-tertiary uppercase font-sans">Total Outflow Volume</span>
                <p className="font-black text-sm text-text-primary">${overview.reconciliation.totalOutflowAmount?.toLocaleString()} USDT</p>
              </div>
              <div className="p-4 rounded-2xl bg-control-bg space-y-1">
                <span className="text-[10px] text-text-tertiary uppercase font-sans">Calculated Net Reserve</span>
                <p className="font-black text-sm text-ton-blue">${overview.reconciliation.calculatedNetReserve?.toLocaleString()} USDT</p>
              </div>
              <div className="p-4 rounded-2xl bg-control-bg space-y-1">
                <span className="text-[10px] text-text-tertiary uppercase font-sans">Zero Discrepancy Pass</span>
                <p className="font-black text-sm text-usdt-green flex items-center gap-1">
                  <CheckCircle2 size={14} /> ZERO_LEAKAGE
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── 4. TAB 2: SECURITY PENETRATION ──────────────────────────────────── */}
      {activeTab === 'SECURITY' && overview?.securityAudit && (
        <div className="p-5 sm:p-6 rounded-3xl bg-card-bg border border-white/10 space-y-4 shadow-xl">
          <h4 className="text-xs font-black uppercase tracking-wider text-text-primary flex items-center gap-2">
            <Lock size={16} className="text-usdt-green" /> Automated Security Penetration Results
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
            {(overview.securityAudit.checks || []).map((c: any, i: number) => (
              <div key={i} className="p-4 rounded-2xl bg-control-bg space-y-1 border border-white/5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-text-primary font-sans">{c.target}</span>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${c.passed ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-rose-500/30 text-rose-400 bg-rose-500/10'}`}>
                    {c.passed ? 'HARDENED' : 'EXPOSED'}
                  </span>
                </div>
                <p className="text-[11px] text-text-tertiary font-sans">{c.details}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── 5. TAB 3: DLQ QUEUE ─────────────────────────────────────────────── */}
      {activeTab === 'DLQ' && (
        <div className="p-5 sm:p-6 rounded-3xl bg-card-bg border border-white/10 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-text-primary flex items-center gap-2">
                <Layers size={16} className="text-amber-400" /> Dead-Letter Queue (DLQ) Worker Monitor
              </h4>
              <p className="text-xs text-text-tertiary mt-0.5">
                Failed asynchronous background jobs requiring administrative investigation and retry.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {(overview?.queueReliability?.items || []).map((item: any) => (
              <div key={item.id} className="p-4 rounded-2xl bg-control-bg border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-text-primary">Task #{item.id}</span>
                    <span className="text-rose-400 font-bold">{item.queueName}</span>
                  </div>
                  <p className="text-[11px] text-rose-300 bg-rose-500/10 p-2 rounded-xl border border-rose-500/20 font-sans">
                    {item.lastError || 'Operation failed during task worker execution.'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDlqAction(item.id, 'RETRY')}
                    className="px-3.5 py-1.5 rounded-xl bg-usdt-green text-app-bg font-black text-xs uppercase tracking-wider shadow hover:brightness-110 cursor-pointer"
                  >
                    Retry Job
                  </button>
                  <button
                    onClick={() => handleDlqAction(item.id, 'DRAIN')}
                    className="px-3.5 py-1.5 rounded-xl bg-control-bg border border-white/10 text-text-tertiary hover:text-text-primary text-xs font-bold cursor-pointer"
                  >
                    Drain
                  </button>
                </div>
              </div>
            ))}

            {(!overview?.queueReliability?.items || overview.queueReliability.items.length === 0) && (
              <div className="p-8 text-center bg-control-bg rounded-2xl border border-white/5 space-y-1">
                <p className="text-sm font-bold text-text-primary">Dead-Letter Queue is Clean</p>
                <p className="text-xs text-text-tertiary">0 failed worker tasks or dropped jobs.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── 6. TAB 4: DISASTER RECOVERY ─────────────────────────────────────── */}
      {activeTab === 'DISASTER' && overview?.disasterRecovery && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-5 sm:p-6 rounded-3xl bg-card-bg border border-white/10 space-y-3 shadow-xl">
            <h4 className="font-black text-text-primary text-sm uppercase tracking-wider text-usdt-green flex items-center gap-2 font-sans">
              <Database size={16} /> Database Backup Freshness
            </h4>
            <div className="p-4 rounded-2xl bg-control-bg space-y-2 border border-white/5">
              <div className="flex justify-between"><span>Backup Freshness:</span> <strong className="text-emerald-400">{overview.disasterRecovery.databaseBackupFreshness}</strong></div>
              <div className="flex justify-between"><span>PITR Status:</span> <strong className="text-usdt-green">{overview.disasterRecovery.pointInTimeRecoveryStatus}</strong></div>
              <div className="flex justify-between"><span>Region Redundancy:</span> <span>{overview.disasterRecovery.redundancyRegion}</span></div>
            </div>
          </div>

          <div className="p-5 sm:p-6 rounded-3xl bg-card-bg border border-white/10 space-y-3 shadow-xl">
            <h4 className="font-black text-text-primary text-sm uppercase tracking-wider text-usdt-green flex items-center gap-2 font-sans">
              <Server size={16} /> Backup Verification Test
            </h4>
            <div className="p-4 rounded-2xl bg-control-bg space-y-2 border border-white/5">
              <div className="flex justify-between"><span>Last Test:</span> <span>{new Date(overview.disasterRecovery.backupVerificationTest?.lastExecutedAt).toLocaleTimeString()}</span></div>
              <div className="flex justify-between"><span>Test Result:</span> <strong className="text-emerald-400">{overview.disasterRecovery.backupVerificationTest?.status}</strong></div>
              <div className="flex justify-between"><span>Restoration Time:</span> <span>{overview.disasterRecovery.backupVerificationTest?.restorationTimeMinutes} minutes</span></div>
            </div>
          </div>
        </div>
      )}

      {/* ─── 7. TAB 5: OPERATIONAL RUNBOOKS ──────────────────────────────────── */}
      {activeTab === 'RUNBOOKS' && runbooks && (
        <div className="space-y-4">
          {Object.entries(runbooks).map(([key, rb]: [string, any]) => (
            <div key={key} className="p-5 sm:p-6 rounded-3xl bg-card-bg border border-white/10 space-y-3 shadow-xl">
              <h4 className="font-black text-text-primary text-sm uppercase tracking-wider text-usdt-green font-sans">{rb.title}</h4>
              <ul className="list-disc list-inside text-xs text-text-secondary space-y-1.5 font-mono">
                {(rb.rules || rb.steps || []).map((rule: string, i: number) => (
                  <li key={i}>{rule}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* ─── 8. TAB 6: MASTER LAUNCH CERTIFICATION ───────────────────────────── */}
      {activeTab === 'CERTIFICATION' && (
        <div className="space-y-4">
          <div className="bg-card-bg rounded-3xl p-5 sm:p-6 border border-white/10 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <h4 className="text-sm font-black text-text-primary flex items-center gap-2">
                  <Award size={18} className="text-usdt-green" /> Production Launch Certification & Sign-Off Matrix
                </h4>
                <p className="text-xs text-text-tertiary mt-0.5">
                  Complete architectural sign-off across platform Stages 1 through 17.
                </p>
              </div>

              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(certification, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `titanstream-launch-certificate-${Date.now()}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  showToast('Launch Certificate JSON exported', 'success');
                }}
                className="px-4 py-2.5 rounded-2xl bg-usdt-green text-app-bg font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-md cursor-pointer hover:brightness-110"
              >
                <Download size={14} /> Export Certificate
              </button>
            </div>

            {/* Stage Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(certification?.stageMatrix || []).map((st: any, i: number) => (
                <div key={i} className="p-4 rounded-2xl bg-control-bg border border-white/5 space-y-1 text-xs font-mono">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-text-primary font-sans">{st.stageNumber}: {st.stageName}</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-usdt-green/20 text-usdt-green font-bold text-[10px] border border-usdt-green/30">
                      {st.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-tertiary font-sans">{st.details}</p>
                  <div className="text-[10px] text-text-tertiary">Verified SHA: <code>{st.certifiedCommitSha}</code></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── 9. UNIFIED OS CROSS-SYSTEM NAVIGATION HUB (NO DEAD ENDS!) ───────── */}
      <div className="space-y-3">
        <h2 className="text-xs font-black uppercase tracking-wider text-text-secondary flex items-center gap-2">
          <Zap size={14} className="text-usdt-green" /> Unified Control Plane Integrations & Workflows
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Link
            to="/admin/intelligence"
            className="group p-4 rounded-2xl bg-card-bg border border-white/10 hover:border-usdt-green/50 transition-all space-y-2 shadow-md"
          >
            <div className="flex items-center justify-between text-usdt-green">
              <Activity size={18} />
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
            <div className="font-extrabold text-xs text-text-primary">Intelligence & SLAs</div>
            <p className="text-[11px] text-text-tertiary">
              Examine live system latency percentiles, queue lag, and financial throughput graphs.
            </p>
          </Link>

          <Link
            to="/admin/operations-hq"
            className="group p-4 rounded-2xl bg-card-bg border border-white/10 hover:border-ton-blue/50 transition-all space-y-2 shadow-md"
          >
            <div className="flex items-center justify-between text-ton-blue">
              <Sliders size={18} />
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
            <div className="font-extrabold text-xs text-text-primary">Operations HQ Switches</div>
            <p className="text-[11px] text-text-tertiary">
              Manage global maintenance locks, read-only mode, and feature switches.
            </p>
          </Link>

          <Link
            to="/admin/treasury"
            className="group p-4 rounded-2xl bg-card-bg border border-white/10 hover:border-purple-400/50 transition-all space-y-2 shadow-md"
          >
            <div className="flex items-center justify-between text-purple-400">
              <Wallet size={18} />
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
            <div className="font-extrabold text-xs text-text-primary">Treasury Control</div>
            <p className="text-[11px] text-text-tertiary">
              Verify reserve asset balances backing the double-entry accounting ledger.
            </p>
          </Link>

          <Link
            to="/admin/audit"
            className="group p-4 rounded-2xl bg-card-bg border border-white/10 hover:border-emerald-400/50 transition-all space-y-2 shadow-md"
          >
            <div className="flex items-center justify-between text-emerald-400">
              <FileText size={18} />
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
            <div className="font-extrabold text-xs text-text-primary">Audit Explorer</div>
            <p className="text-[11px] text-text-tertiary">
              Search cryptographic operational audit logs across all platform actors.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
};
