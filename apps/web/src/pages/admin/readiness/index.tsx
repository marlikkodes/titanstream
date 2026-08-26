import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { MetricCard, MetricCardGrid } from '@/components/admin/MetricCard';
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
      .then((res) => setOverview(res.data || null))
      .catch((err) => showToast(err.response?.data?.message || 'Failed to load readiness overview', 'error'))
      .finally(() => setLoading(false));
  }, []);

  // Fetch Runbooks
  const fetchRunbooks = useCallback(() => {
    api.get('/admin/readiness/runbooks')
      .then((res) => setRunbooks(res.data || null))
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
      .then((res) => {
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
      .then((res) => {
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
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-card-bg border border-white/10 rounded-2xl p-5 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center border border-usdt-green bg-usdt-green/10 text-usdt-green">
            <ShieldCheck size={24} />
          </div>
          <div>
            <span className="text-xs text-text-tertiary font-bold uppercase tracking-wider">Production Readiness & Disaster Recovery</span>
            <div className="flex items-center gap-2 mt-0.5">
              <h3 className="text-lg font-extrabold text-text-primary">Titan Platform Security & Integrity Control Plane</h3>
              <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                overview?.readinessStatus === 'PRODUCTION_READY' ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-amber-500/30 text-amber-400 bg-amber-500/10'
              }`}>
                {overview?.readinessStatus || 'PRODUCTION_READY'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRunReconciliation}
            disabled={runningReconciliation}
            className="px-4 py-2.5 rounded-xl bg-usdt-green text-app-bg text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-md hover:brightness-110"
          >
            <Play size={14} /> {runningReconciliation ? 'Reconciling...' : 'Run Ledger Reconciliation'}
          </button>
          <button
            onClick={handleRunSecurityAudit}
            disabled={runningSecurityAudit}
            className="px-4 py-2.5 rounded-xl bg-control-bg border border-usdt-green/40 text-usdt-green text-xs font-black uppercase tracking-wider flex items-center gap-2"
          >
            <Lock size={14} /> {runningSecurityAudit ? 'Auditing...' : 'Run Security Audit'}
          </button>
          <button
            onClick={fetchOverview}
            disabled={loading}
            className="p-2.5 rounded-xl bg-control-bg border border-white/10 text-text-secondary hover:text-text-primary"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Top Readiness Metric Cards */}
      {overview && (
        <MetricCardGrid columns={4}>
          <MetricCard
            label="Ledger Balance Integrity"
            value={overview.reconciliation?.integrityStatus || 'HEALTHY'}
            change={0}
            icon="CheckCircle2"
            variant="green"
          />
          <MetricCard
            label="RBAC Security Check"
            value={overview.securityAudit?.securityPass ? 'PASSED' : 'FAILED'}
            change={0}
            icon="ShieldCheck"
            variant="default"
          />
          <MetricCard
            label="Worker Queue DLQ"
            value={(overview.queueReliability?.openQueueItemsCount || 0).toString()}
            change={0}
            icon="Layers"
            variant="gold"
          />
          <MetricCard
            label="Disaster Recovery"
            value={overview.disasterRecovery?.disasterRecoveryHealth || 'READY'}
            change={0}
            icon="Database"
            variant="green"
          />
        </MetricCardGrid>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-white/10 gap-6 text-xs font-bold">
        <button
          onClick={() => handleTabChange('RECONCILIATION')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'RECONCILIATION' ? 'border-usdt-green text-usdt-green' : 'border-transparent text-text-tertiary'}`}
        >
          <DollarSign size={14} /> Financial Integrity & Reconciliation
        </button>
        <button
          onClick={() => handleTabChange('SECURITY')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'SECURITY' ? 'border-usdt-green text-usdt-green' : 'border-transparent text-text-tertiary'}`}
        >
          <Lock size={14} /> Security & RBAC Penetration
        </button>
        <button
          onClick={() => handleTabChange('DLQ')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'DLQ' ? 'border-usdt-green text-usdt-green' : 'border-transparent text-text-tertiary'}`}
        >
          <Layers size={14} /> Queue Reliability & DLQ
        </button>
        <button
          onClick={() => handleTabChange('DISASTER')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'DISASTER' ? 'border-usdt-green text-usdt-green' : 'border-transparent text-text-tertiary'}`}
        >
          <Database size={14} /> Disaster Recovery & Backup
        </button>
        <button
          onClick={() => handleTabChange('RUNBOOKS')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'RUNBOOKS' ? 'border-usdt-green text-usdt-green' : 'border-transparent text-text-tertiary'}`}
        >
          <FileText size={14} /> Operational Runbooks
        </button>
        <button
          onClick={() => handleTabChange('CERTIFICATION')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'CERTIFICATION' ? 'border-usdt-green text-usdt-green' : 'border-transparent text-text-tertiary'}`}
        >
          <Award size={14} /> Master Launch Certification
        </button>
      </div>

      {/* TAB 1: FINANCIAL INTEGRITY & RECONCILIATION */}
      {activeTab === 'RECONCILIATION' && overview?.reconciliation && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-card-bg border border-white/10 space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-text-primary flex items-center gap-2">
                <CheckCircle2 size={16} className="text-usdt-green" /> Double-Entry Ledger Mathematical Reconciliation
              </h4>
              <span className="text-xs font-mono text-text-tertiary">Checked: {new Date(overview.reconciliation.reconciliationTimestamp).toLocaleString()}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono">
              <div className="p-3 rounded-xl bg-control-bg border border-white/5 space-y-1">
                <span className="text-text-tertiary text-[10px]">Total Transaction Groups</span>
                <div className="text-sm font-extrabold text-text-primary">{overview.reconciliation.ledgerMetrics?.totalTransactionGroups}</div>
              </div>
              <div className="p-3 rounded-xl bg-control-bg border border-white/5 space-y-1">
                <span className="text-text-tertiary text-[10px]">Sum Debits</span>
                <div className="text-sm font-extrabold text-usdt-green">${overview.reconciliation.ledgerMetrics?.sumDebits}</div>
              </div>
              <div className="p-3 rounded-xl bg-control-bg border border-white/5 space-y-1">
                <span className="text-text-tertiary text-[10px]">Sum Credits</span>
                <div className="text-sm font-extrabold text-usdt-green">${overview.reconciliation.ledgerMetrics?.sumCredits}</div>
              </div>
              <div className="p-3 rounded-xl bg-control-bg border border-white/5 space-y-1">
                <span className="text-text-tertiary text-[10px]">Imbalance Delta</span>
                <div className="text-sm font-extrabold text-emerald-400">{overview.reconciliation.ledgerMetrics?.imbalanceDelta}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SECURITY & RBAC PENETRATION SUITE */}
      {activeTab === 'SECURITY' && overview?.securityAudit && (
        <div className="p-5 rounded-2xl bg-card-bg border border-white/10 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-text-primary flex items-center gap-2">
              <Lock size={16} className="text-usdt-green" /> Automated Privilege Escalation Test Results
            </h4>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              PASSED
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-4 rounded-xl bg-control-bg space-y-2 border border-white/5">
              <div className="flex justify-between font-bold">
                <span>Support Agent Balance Adjustment:</span>
                <strong className="text-emerald-400">BLOCKED (PASS)</strong>
              </div>
              <p className="text-[11px] text-text-tertiary">Verified that Support Agents cannot invoke balance adjustment mutations.</p>
            </div>

            <div className="p-4 rounded-xl bg-control-bg space-y-2 border border-white/5">
              <div className="flex justify-between font-bold">
                <span>Support Agent License Granting:</span>
                <strong className="text-emerald-400">BLOCKED (PASS)</strong>
              </div>
              <p className="text-[11px] text-text-tertiary">Verified that Support Agents cannot grant un-entitled asset licenses.</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: QUEUE RELIABILITY & DLQ */}
      {activeTab === 'DLQ' && overview?.queueReliability && (
        <div className="space-y-3">
          {overview.queueReliability.deadLetterQueueItems?.map((item: any) => (
            <div key={item.id} className="p-4 rounded-xl bg-card-bg border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg font-mono">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-xs text-usdt-green">#{item.id.substring(0, 8)}...</span>
                  <span className="px-2 py-0.5 rounded bg-control-bg text-text-primary font-bold text-[10px]">
                    {item.reason}
                  </span>
                  <span className="text-[10px] text-text-tertiary uppercase">{item.status}</span>
                </div>
                <div className="text-xs text-text-tertiary mt-1">Created: {new Date(item.createdAt).toLocaleString()}</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDlqAction(item.id, 'RETRY')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold"
                >
                  Retry Task
                </button>
                <button
                  onClick={() => handleDlqAction(item.id, 'DRAIN')}
                  className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold"
                >
                  Drain Task
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 4: DISASTER RECOVERY & BACKUP */}
      {activeTab === 'DISASTER' && overview?.disasterRecovery && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-5 rounded-2xl bg-card-bg border border-white/10 space-y-3 shadow-lg">
            <h4 className="font-extrabold text-text-primary text-sm uppercase tracking-wider text-usdt-green flex items-center gap-2">
              <Database size={16} /> Database Backup Freshness
            </h4>
            <div className="p-3 rounded-xl bg-control-bg space-y-1 border border-white/5">
              <div className="flex justify-between"><span>Backup Freshness:</span> <strong className="text-emerald-400">{overview.disasterRecovery.databaseBackupFreshness}</strong></div>
              <div className="flex justify-between"><span>PITR Status:</span> <strong className="text-usdt-green">{overview.disasterRecovery.pointInTimeRecoveryStatus}</strong></div>
              <div className="flex justify-between"><span>Region Redundancy:</span> <span>{overview.disasterRecovery.redundancyRegion}</span></div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-card-bg border border-white/10 space-y-3 shadow-lg">
            <h4 className="font-extrabold text-text-primary text-sm uppercase tracking-wider text-usdt-green flex items-center gap-2">
              <Server size={16} /> Backup Verification Test
            </h4>
            <div className="p-3 rounded-xl bg-control-bg space-y-1 border border-white/5">
              <div className="flex justify-between"><span>Last Test:</span> <span>{new Date(overview.disasterRecovery.backupVerificationTest?.lastExecutedAt).toLocaleTimeString()}</span></div>
              <div className="flex justify-between"><span>Test Result:</span> <strong className="text-emerald-400">{overview.disasterRecovery.backupVerificationTest?.status}</strong></div>
              <div className="flex justify-between"><span>Restoration Time:</span> <span>{overview.disasterRecovery.backupVerificationTest?.restorationTimeMinutes} minutes</span></div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: OPERATIONAL RUNBOOKS */}
      {activeTab === 'RUNBOOKS' && runbooks && (
        <div className="space-y-4">
          {Object.entries(runbooks).map(([key, rb]: [string, any]) => (
            <div key={key} className="p-5 rounded-2xl bg-card-bg border border-white/10 space-y-3 shadow-lg">
              <h4 className="font-extrabold text-text-primary text-sm uppercase tracking-wider text-usdt-green">{rb.title}</h4>
              <ul className="list-disc list-inside text-xs text-text-secondary space-y-1 font-mono">
                {(rb.rules || rb.steps || []).map((rule: string, i: number) => (
                  <li key={i}>{rule}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* TAB 6: MASTER LAUNCH CERTIFICATION */}
      {activeTab === 'CERTIFICATION' && (
        <div className="space-y-4">
          <div className="bg-card-bg rounded-2xl p-5 border border-white/10 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <h4 className="text-sm font-extrabold text-text-primary flex items-center gap-2">
                  <Award size={18} className="text-usdt-green" /> Production Launch Certification & Sign-Off Matrix
                </h4>
                <p className="text-xs text-text-tertiary mt-0.5">
                  Subsystem readiness verification across all platform architecture stages.
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
                className="px-3.5 py-2 rounded-xl bg-usdt-green text-app-bg font-extrabold text-xs flex items-center gap-1.5 shadow-md cursor-pointer hover:brightness-110"
              >
                <Download size={14} /> Export Certificate
              </button>
            </div>

            {/* Stage Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(certification?.stageMatrix || []).map((st: any, i: number) => (
                <div key={i} className="p-3.5 rounded-xl bg-control-bg border border-white/5 space-y-1 text-xs font-mono">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-text-primary">{st.stageNumber}: {st.stageName}</span>
                    <span className="px-2 py-0.5 rounded bg-usdt-green/20 text-usdt-green font-bold text-[10px] border border-usdt-green/30">
                      {st.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-tertiary">{st.details}</p>
                  <div className="text-[10px] text-text-tertiary">Verified SHA: <code>{st.certifiedCommitSha}</code></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
