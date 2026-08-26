import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { MetricCard, MetricCardGrid } from '@/components/admin/MetricCard';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { showToast } from '@/components/Toast';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  CheckCircle2,
  RefreshCw,
  Plus,
  AlertTriangle,
  Flame,
  Search,
  Check,
  Filter,
} from 'lucide-react';

interface SecurityCheck {
  code: string;
  name: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  details: string;
}

interface SecurityAuditReport {
  securityPosture: 'HARDENED' | 'WARNING' | 'COMPROMISED';
  checks: SecurityCheck[];
  rateLimitingStatus: 'ENABLED' | 'DEGRADED';
  idempotencyEngineStatus: 'ACTIVE' | 'DISABLED';
  auditIntegrityStatus: 'VERIFIED' | 'UNVERIFIED';
  auditedAt: string;
}

interface RiskEventRecord {
  id: string;
  entityType: string;
  entityId: string;
  ruleTriggered: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'INVESTIGATING' | 'MITIGATED' | 'RESOLVED' | 'FALSE_POSITIVE';
  assignedOperatorId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

const severityBadgeVariant: Record<string, 'info' | 'warning' | 'danger' | 'default'> = {
  LOW: 'info',
  MEDIUM: 'warning',
  HIGH: 'warning',
  CRITICAL: 'danger',
};

const statusBadgeVariant: Record<string, 'warning' | 'info' | 'success' | 'default'> = {
  OPEN: 'warning',
  INVESTIGATING: 'info',
  MITIGATED: 'info',
  RESOLVED: 'success',
  FALSE_POSITIVE: 'default',
};

export const RiskPage: React.FC = () => {
  const [tab, setTab] = useState<'INCIDENTS' | 'HARDENING'>('INCIDENTS');
  const [riskEvents, setRiskEvents] = useState<RiskEventRecord[]>([]);
  const [auditReport, setAuditReport] = useState<SecurityAuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Create event modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [entityType, setEntityType] = useState('USER');
  const [entityId, setEntityId] = useState('');
  const [ruleTriggered, setRuleTriggered] = useState('RAPID_WITHDRAWAL_VELOCITY');
  const [severity, setSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchRiskEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/risk-events', {
        params: {
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          limit: 100,
        },
      });
      const data = res.data?.data || res.data;
      setRiskEvents(data?.items || []);
    } catch {
      setRiskEvents([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchSecurityAudit = useCallback(async () => {
    try {
      const res = await api.get('/admin/readiness/security-audit');
      setAuditReport(res.data?.data || res.data);
    } catch (err) {
      console.warn('Failed to load security audit:', err);
    }
  }, []);

  useEffect(() => {
    if (tab === 'INCIDENTS') {
      fetchRiskEvents();
    } else {
      fetchSecurityAudit();
    }
  }, [tab, fetchRiskEvents, fetchSecurityAudit]);

  const handleCreateRiskEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId.trim()) {
      showToast('Entity ID is required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/admin/risk-events', {
        entityType,
        entityId: entityId.trim(),
        ruleTriggered,
        severity,
        notes: notes.trim() || undefined,
      });
      showToast('Risk event flagged and registered into queue!', 'success');
      setCreateModalOpen(false);
      setEntityId('');
      setNotes('');
      fetchRiskEvents();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to create risk event', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: RiskEventRecord['status']) => {
    const note = prompt(`Update notes for transitioning event to ${newStatus}:`, `Transitioned to ${newStatus}`);
    if (note === null) return;
    try {
      await api.patch(`/admin/risk-events/${id}`, {
        status: newStatus,
        notes: note.trim() || undefined,
      });
      showToast(`Risk event updated to ${newStatus}`, 'success');
      fetchRiskEvents();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to update event', 'error');
    }
  };

  const handleTestIdempotency = async () => {
    try {
      const testKey = `IDEM-TEST-${Date.now()}`;
      await api.post('/admin/readiness/verify-idempotency', { idempotencyKey: testKey });
      showToast(`Key '${testKey}' passed initial processing!`, 'success');

      try {
        await api.post('/admin/readiness/verify-idempotency', { idempotencyKey: testKey });
      } catch {
        showToast(`🟢 Collision Guard Worked: Duplicate key '${testKey}' was rejected!`, 'success');
      }
    } catch {
      showToast('Idempotency verification failed', 'error');
    }
  };

  const openIncidentsCount = riskEvents.filter((r) => r.status === 'OPEN' || r.status === 'INVESTIGATING').length;
  const criticalCount = riskEvents.filter((r) => r.severity === 'CRITICAL' && r.status !== 'RESOLVED').length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <MetricCardGrid columns={3}>
        <MetricCard label="Active Risk Flags" value={openIncidentsCount.toString()} icon="ShieldAlert" variant={openIncidentsCount > 0 ? 'gold' : 'green'} />
        <MetricCard label="Critical Severity" value={criticalCount.toString()} icon="AlertTriangle" variant={criticalCount > 0 ? 'red' : 'green'} />
        <MetricCard label="System Posture" value={auditReport?.securityPosture || 'HARDENED'} icon="ShieldCheck" variant="green" />
      </MetricCardGrid>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setTab('INCIDENTS')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-colors cursor-pointer ${
            tab === 'INCIDENTS'
              ? 'bg-usdt-green text-app-bg shadow-md'
              : 'bg-control-bg text-text-secondary border border-white/10 hover:text-text-primary'
          }`}
        >
          Risk Incidents & Flags ({openIncidentsCount})
        </button>
        <button
          onClick={() => setTab('HARDENING')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-colors cursor-pointer ${
            tab === 'HARDENING'
              ? 'bg-usdt-green text-app-bg shadow-md'
              : 'bg-control-bg text-text-secondary border border-white/10 hover:text-text-primary'
          }`}
        >
          Security Hardening & Posture
        </button>
      </div>

      {tab === 'INCIDENTS' && (
        <div className="space-y-4">
          {/* Header & Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-card-bg p-4 rounded-2xl border border-white/10 shadow-lg">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {['ALL', 'OPEN', 'INVESTIGATING', 'MITIGATED', 'RESOLVED', 'FALSE_POSITIVE'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-colors cursor-pointer shrink-0 ${
                    statusFilter === st
                      ? 'bg-usdt-green text-app-bg shadow-sm'
                      : 'bg-control-bg text-text-tertiary hover:text-text-primary border border-white/5'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCreateModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-usdt-green text-app-bg font-extrabold text-xs flex items-center gap-1.5 shadow-md cursor-pointer hover:brightness-110"
              >
                <Plus size={14} /> Flag Risk Event
              </button>
              <button
                onClick={fetchRiskEvents}
                disabled={loading}
                className="p-2 rounded-xl bg-control-bg border border-white/10 text-text-secondary hover:text-text-primary disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Risk Events Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {riskEvents.map((event) => (
              <div
                key={event.id}
                className={`bg-card-bg rounded-2xl p-4 border transition-all space-y-3 shadow-lg ${
                  event.severity === 'CRITICAL'
                    ? 'border-rose-500/40 bg-rose-500/5'
                    : 'border-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-extrabold text-usdt-green">#{event.id.substring(0, 8)}</span>
                    <StatusBadge label={event.severity} variant={severityBadgeVariant[event.severity] || 'warning'} />
                  </div>
                  <StatusBadge label={event.status} variant={statusBadgeVariant[event.status] || 'default'} dot />
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-extrabold text-text-primary flex items-center gap-1.5">
                    <Flame size={14} className="text-amber-400" /> {event.ruleTriggered}
                  </div>
                  <div className="text-xs font-mono text-text-secondary">
                    Target: <strong className="text-text-primary">{event.entityType}:{event.entityId}</strong>
                  </div>
                  {event.notes && (
                    <p className="text-[11px] text-text-tertiary bg-control-bg p-2 rounded-lg border border-white/5 mt-1">
                      {event.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px] font-mono text-text-tertiary">
                  <span>{new Date(event.createdAt).toLocaleString()}</span>
                  <div className="flex items-center gap-1.5">
                    {event.status !== 'RESOLVED' && (
                      <button
                        onClick={() => handleUpdateStatus(event.id, 'RESOLVED')}
                        className="px-2.5 py-1 rounded bg-usdt-green/20 hover:bg-usdt-green/30 text-usdt-green font-extrabold border border-usdt-green/40 cursor-pointer"
                      >
                        Resolve
                      </button>
                    )}
                    {event.status === 'OPEN' && (
                      <button
                        onClick={() => handleUpdateStatus(event.id, 'INVESTIGATING')}
                        className="px-2.5 py-1 rounded bg-ton-blue/20 hover:bg-ton-blue/30 text-ton-blue font-extrabold border border-ton-blue/40 cursor-pointer"
                      >
                        Investigate
                      </button>
                    )}
                    {event.status !== 'FALSE_POSITIVE' && event.status !== 'RESOLVED' && (
                      <button
                        onClick={() => handleUpdateStatus(event.id, 'FALSE_POSITIVE')}
                        className="px-2.5 py-1 rounded bg-control-bg hover:bg-white/10 text-text-tertiary font-bold border border-white/10 cursor-pointer"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {riskEvents.length === 0 && !loading && (
              <div className="col-span-full p-8 text-center bg-card-bg rounded-2xl border border-white/5 space-y-1">
                <p className="text-xs font-bold text-text-primary">No risk events in queue</p>
                <p className="text-[11px] text-text-tertiary">Platform anti-fraud radar is clean.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'HARDENING' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-card-bg p-4 rounded-2xl border border-white/10 shadow-lg">
            <div>
              <h2 className="text-sm font-extrabold text-text-primary flex items-center gap-2">
                <ShieldCheck size={18} className="text-usdt-green" /> TitanStream Platform Hardening Engine
              </h2>
              <p className="text-xs text-text-tertiary mt-0.5">
                Automated verification of financial zero-bypass, idempotency guards, RBAC gating, and rate-limiting.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleTestIdempotency}
                className="px-3.5 py-2 rounded-xl bg-usdt-green/20 hover:bg-usdt-green/30 border border-usdt-green/40 text-usdt-green font-extrabold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Lock size={14} /> Test Idempotency Guard
              </button>
              <button
                onClick={fetchSecurityAudit}
                disabled={loading}
                className="p-2 rounded-xl bg-control-bg border border-white/10 hover:bg-white/5 text-text-secondary disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          <div className="bg-card-bg border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg">
            <h3 className="text-sm font-extrabold text-text-primary flex items-center gap-2">
              <CheckCircle2 size={16} className="text-usdt-green" /> Automated Security Verification Checklist
            </h3>

            <div className="space-y-3">
              {auditReport?.checks.map((check) => (
                <div key={check.code} className="p-3.5 rounded-xl bg-control-bg/60 border border-white/5 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-usdt-green">{check.code}</span>
                      <span className="text-xs font-extrabold text-text-primary">{check.name}</span>
                    </div>
                    <p className="text-xs text-text-secondary">{check.details}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-usdt-green/20 text-usdt-green font-mono font-bold text-[10px] border border-usdt-green/30 shrink-0">
                    {check.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Flag Risk Event Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md bg-app-bg border border-white/10 rounded-3xl p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-extrabold text-text-primary">Flag New Risk Incident</h3>
            <form onSubmit={handleCreateRiskEvent} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-text-tertiary">Entity Type</label>
                  <select
                    value={entityType}
                    onChange={(e) => setEntityType(e.target.value)}
                    className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-xs text-text-primary focus:outline-none focus:border-usdt-green"
                  >
                    <option value="USER">User Account</option>
                    <option value="WITHDRAWAL">Withdrawal Session</option>
                    <option value="MERCHANT">Merchant Claim</option>
                    <option value="PAYMENT_ORDER">Payment Order</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-text-tertiary">Severity</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as any)}
                    className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-xs text-text-primary focus:outline-none focus:border-usdt-green"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-text-tertiary">Entity ID / Telegram User ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 88102931 or ORD-9921"
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                  className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-xs font-mono text-text-primary focus:outline-none focus:border-usdt-green"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-text-tertiary">Trigger Rule</label>
                <select
                  value={ruleTriggered}
                  onChange={(e) => setRuleTriggered(e.target.value)}
                  className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-xs text-text-primary focus:outline-none focus:border-usdt-green"
                >
                  <option value="RAPID_WITHDRAWAL_VELOCITY">RAPID_WITHDRAWAL_VELOCITY</option>
                  <option value="SYBIL_MULTI_ACCOUNT_CLUSTER">SYBIL_MULTI_ACCOUNT_CLUSTER</option>
                  <option value="SUSPICIOUS_HIGH_VALUE_DEPOSIT">SUSPICIOUS_HIGH_VALUE_DEPOSIT</option>
                  <option value="DEVICE_FINGERPRINT_MISMATCH">DEVICE_FINGERPRINT_MISMATCH</option>
                  <option value="MANUAL_OPERATOR_REVIEW">MANUAL_OPERATOR_REVIEW</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-text-tertiary">Operator Investigation Notes</label>
                <textarea
                  rows={2}
                  placeholder="Details of the flagged behavior..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2.5 bg-control-bg border border-white/10 rounded-xl text-xs text-text-primary focus:outline-none focus:border-usdt-green"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-text-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-usdt-green text-app-bg text-xs font-extrabold shadow-md hover:brightness-110 disabled:opacity-50"
                >
                  {submitting ? 'Registering...' : 'Register Risk Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
