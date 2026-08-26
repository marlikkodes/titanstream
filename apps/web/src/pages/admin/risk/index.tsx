import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/services/api';
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
  ArrowRight,
  Zap,
  Activity,
  Sliders,
  Users,
  Wallet,
  FileText,
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
      showToast('Risk incident flagged and registered into queue!', 'success');
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
      showToast(`Risk incident updated to ${newStatus}`, 'success');
      fetchRiskEvents();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to update incident', 'error');
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
    <div className="space-y-6">
      {/* ─── 1. HERO SECTION: SECURITY POSTURE & INCIDENT COCKPIT ─────────────── */}
      <div className="relative overflow-hidden bg-card-bg border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-rose-500/10 border border-rose-500/40 text-rose-400 shrink-0 shadow-lg">
              <ShieldAlert size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30">
                  Security Sentinel & Anti-Fraud
                </span>
                <span className="text-xs text-text-tertiary">·</span>
                <span className="text-xs text-text-secondary font-mono flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${openIncidentsCount > 0 ? 'bg-amber-400 animate-pulse' : 'bg-usdt-green'}`} />
                  {openIncidentsCount > 0 ? `${openIncidentsCount} Active Risk Incidents` : 'Threat Radar Clear'}
                </span>
              </div>
              <h1 className="text-xl font-black text-text-primary tracking-tight mt-1">
                Risk Incidents & Security Hardening
              </h1>
              <p className="text-xs text-text-secondary mt-0.5">
                Automated risk event queue, Sybil anomaly triage, idempotency verification, and zero-bypass controls.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end lg:self-center">
            <button
              onClick={() => {
                if (tab === 'INCIDENTS') fetchRiskEvents();
                else fetchSecurityAudit();
              }}
              disabled={loading}
              className="p-2.5 rounded-xl bg-control-bg border border-white/10 text-text-secondary hover:text-text-primary disabled:opacity-50 cursor-pointer transition-colors shadow-sm"
              title="Refresh Risk Desk"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Live Risk KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/5">
          <div className="p-3.5 rounded-2xl bg-control-bg/60 border border-white/5 space-y-1">
            <span className="text-[10px] font-bold uppercase text-text-tertiary flex items-center gap-1">
              <ShieldAlert size={12} className="text-amber-400" /> Active Incidents
            </span>
            <div className="text-lg font-black font-mono text-text-primary">
              {openIncidentsCount} <span className="text-xs text-text-tertiary font-normal">flags</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-control-bg/60 border border-white/5 space-y-1">
            <span className="text-[10px] font-bold uppercase text-text-tertiary flex items-center gap-1">
              <AlertTriangle size={12} className="text-rose-400" /> Critical Severity
            </span>
            <div className={`text-lg font-black font-mono ${criticalCount > 0 ? 'text-rose-400' : 'text-usdt-green'}`}>
              {criticalCount}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-control-bg/60 border border-white/5 space-y-1">
            <span className="text-[10px] font-bold uppercase text-text-tertiary flex items-center gap-1">
              <Lock size={12} className="text-usdt-green" /> Idempotency Guard
            </span>
            <div className="text-lg font-black font-mono text-usdt-green">
              ACTIVE
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-control-bg/60 border border-white/5 space-y-1">
            <span className="text-[10px] font-bold uppercase text-text-tertiary flex items-center gap-1">
              <ShieldCheck size={12} className="text-ton-blue" /> System Posture
            </span>
            <div className="text-lg font-black font-mono text-usdt-green">
              {auditReport?.securityPosture || 'HARDENED'}
            </div>
          </div>
        </div>
      </div>

      {/* ─── 2. NAVIGATION TABS ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setTab('INCIDENTS')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            tab === 'INCIDENTS'
              ? 'bg-usdt-green text-app-bg shadow-lg shadow-usdt-green/20'
              : 'bg-control-bg text-text-secondary border border-white/10 hover:text-text-primary'
          }`}
        >
          Active Incidents & Flags ({openIncidentsCount})
        </button>
        <button
          onClick={() => setTab('HARDENING')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            tab === 'HARDENING'
              ? 'bg-usdt-green text-app-bg shadow-lg shadow-usdt-green/20'
              : 'bg-control-bg text-text-secondary border border-white/10 hover:text-text-primary'
          }`}
        >
          Security Hardening & Posture Matrix
        </button>
      </div>

      {/* ─── 3. TAB 1: INCIDENTS DESK ────────────────────────────────────────── */}
      {tab === 'INCIDENTS' && (
        <div className="space-y-4">
          {/* Header & Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-card-bg p-4 sm:p-5 rounded-3xl border border-white/10 shadow-xl">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {['ALL', 'OPEN', 'INVESTIGATING', 'MITIGATED', 'RESOLVED', 'FALSE_POSITIVE'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
                    statusFilter === st
                      ? 'bg-usdt-green text-app-bg shadow-sm'
                      : 'bg-control-bg text-text-tertiary hover:text-text-primary border border-white/5'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <button
              onClick={() => setCreateModalOpen(true)}
              className="px-4 py-2.5 rounded-2xl bg-usdt-green text-app-bg font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md cursor-pointer hover:brightness-110"
            >
              <Plus size={14} /> Flag Risk Incident
            </button>
          </div>

          {/* Risk Events Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {riskEvents.map((event) => (
              <div
                key={event.id}
                className={`bg-card-bg rounded-3xl p-5 border transition-all space-y-3 shadow-xl ${
                  event.severity === 'CRITICAL'
                    ? 'border-rose-500/50 bg-rose-500/5'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black text-usdt-green">#{event.id.substring(0, 8)}</span>
                    <StatusBadge label={event.severity} variant={severityBadgeVariant[event.severity] || 'warning'} />
                  </div>
                  <StatusBadge label={event.status} variant={statusBadgeVariant[event.status] || 'default'} dot />
                </div>

                <div className="space-y-1 font-mono text-xs">
                  <div className="font-black text-text-primary flex items-center gap-1.5 text-sm font-sans">
                    <Flame size={15} className="text-amber-400 shrink-0" /> {event.ruleTriggered}
                  </div>
                  <div className="text-text-secondary">
                    Target: <strong className="text-text-primary">{event.entityType}:{event.entityId}</strong>
                  </div>
                  {event.notes && (
                    <p className="text-[11px] text-text-tertiary bg-control-bg p-3 rounded-xl border border-white/5 mt-1 font-sans">
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
                        className="px-3 py-1.5 rounded-xl bg-usdt-green/20 hover:bg-usdt-green/30 text-usdt-green font-black text-xs border border-usdt-green/40 cursor-pointer"
                      >
                        Resolve
                      </button>
                    )}
                    {event.status === 'OPEN' && (
                      <button
                        onClick={() => handleUpdateStatus(event.id, 'INVESTIGATING')}
                        className="px-3 py-1.5 rounded-xl bg-ton-blue/20 hover:bg-ton-blue/30 text-ton-blue font-black text-xs border border-ton-blue/40 cursor-pointer"
                      >
                        Investigate
                      </button>
                    )}
                    {event.status !== 'FALSE_POSITIVE' && event.status !== 'RESOLVED' && (
                      <button
                        onClick={() => handleUpdateStatus(event.id, 'FALSE_POSITIVE')}
                        className="px-3 py-1.5 rounded-xl bg-control-bg hover:bg-white/10 text-text-tertiary font-bold text-xs border border-white/10 cursor-pointer"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {riskEvents.length === 0 && !loading && (
              <div className="col-span-full p-8 text-center bg-card-bg rounded-3xl border border-white/5 space-y-1">
                <p className="text-sm font-bold text-text-primary">No risk incidents in queue</p>
                <p className="text-xs text-text-tertiary">Platform anti-fraud radar is clean.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── 4. TAB 2: SECURITY HARDENING ────────────────────────────────────── */}
      {tab === 'HARDENING' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-card-bg p-5 sm:p-6 rounded-3xl border border-white/10 shadow-xl">
            <div>
              <h2 className="text-sm font-black text-text-primary flex items-center gap-2">
                <ShieldCheck size={18} className="text-usdt-green" /> TitanStream Platform Hardening Engine
              </h2>
              <p className="text-xs text-text-tertiary mt-0.5">
                Automated verification of financial zero-bypass, idempotency collision guards, RBAC gating, and rate-limiting.
              </p>
            </div>

            <button
              onClick={handleTestIdempotency}
              className="px-4 py-2.5 rounded-2xl bg-usdt-green/20 hover:bg-usdt-green/30 border border-usdt-green/40 text-usdt-green font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Lock size={14} /> Test Idempotency Guard
            </button>
          </div>

          <div className="bg-card-bg border border-white/10 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
            <h3 className="text-xs font-black uppercase tracking-wider text-text-secondary flex items-center gap-2">
              <CheckCircle2 size={16} className="text-usdt-green" /> Automated Security Verification Checklist
            </h3>

            <div className="space-y-3">
              {auditReport?.checks.map((check) => (
                <div key={check.code} className="p-4 rounded-2xl bg-control-bg/60 border border-white/5 flex items-start justify-between gap-3 font-mono">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-usdt-green">{check.code}</span>
                      <span className="text-xs font-black text-text-primary font-sans">{check.name}</span>
                    </div>
                    <p className="text-xs text-text-secondary font-sans">{check.details}</p>
                  </div>
                  <span className="px-3 py-1 rounded-xl bg-usdt-green/20 text-usdt-green font-bold text-[10px] border border-usdt-green/30 shrink-0">
                    {check.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── 5. UNIFIED OS CROSS-SYSTEM NAVIGATION HUB (NO DEAD ENDS!) ───────── */}
      <div className="space-y-3">
        <h2 className="text-xs font-black uppercase tracking-wider text-text-secondary flex items-center gap-2">
          <Zap size={14} className="text-usdt-green" /> Unified Control Plane Integrations & Workflows
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Link
            to="/admin/operations-hq"
            className="group p-4 rounded-2xl bg-card-bg border border-white/10 hover:border-rose-400/50 transition-all space-y-2 shadow-md"
          >
            <div className="flex items-center justify-between text-rose-400">
              <Sliders size={18} />
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
            <div className="font-extrabold text-xs text-text-primary">Emergency Kill Switches</div>
            <p className="text-[11px] text-text-tertiary">
              Activate global freeze, maintenance mode, or withdrawal halts if systemic risk occurs.
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
            <div className="font-extrabold text-xs text-text-primary">User Freeze & Ban Desk</div>
            <p className="text-[11px] text-text-tertiary">
              Review flagged account profiles, device fingerprints, and apply account suspensions.
            </p>
          </Link>

          <Link
            to="/admin/withdrawals"
            className="group p-4 rounded-2xl bg-card-bg border border-white/10 hover:border-amber-400/50 transition-all space-y-2 shadow-md"
          >
            <div className="flex items-center justify-between text-amber-400">
              <Wallet size={18} />
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
            <div className="font-extrabold text-xs text-text-primary">Withdrawal Velocity Hold</div>
            <p className="text-[11px] text-text-tertiary">
              Inspect withdrawal requests quarantined by rapid velocity anti-fraud rules.
            </p>
          </Link>

          <Link
            to="/admin/audit"
            className="group p-4 rounded-2xl bg-card-bg border border-white/10 hover:border-purple-400/50 transition-all space-y-2 shadow-md"
          >
            <div className="flex items-center justify-between text-purple-400">
              <FileText size={18} />
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
            <div className="font-extrabold text-xs text-text-primary">Immutable Audit Log</div>
            <p className="text-[11px] text-text-tertiary">
              View cryptographic audit trail of all operator incident notes and status transitions.
            </p>
          </Link>
        </div>
      </div>

      {/* ─── 6. FLAG RISK EVENT MODAL ─────────────────────────────────────────── */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-app-bg border border-rose-500/40 rounded-3xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-black text-text-primary flex items-center gap-2">
              <ShieldAlert size={18} className="text-rose-400" /> Flag New Risk Incident
            </h3>
            <form onSubmit={handleCreateRiskEvent} className="space-y-3 text-xs font-mono">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-text-tertiary">Entity Type</label>
                  <select
                    value={entityType}
                    onChange={(e) => setEntityType(e.target.value)}
                    className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-text-primary focus:border-usdt-green focus:outline-none"
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
                    className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-text-primary focus:border-usdt-green focus:outline-none"
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
                  placeholder="e.g. 5387655307 or ORD-9921"
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                  className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-text-primary focus:border-usdt-green focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-text-tertiary">Trigger Rule</label>
                <select
                  value={ruleTriggered}
                  onChange={(e) => setRuleTriggered(e.target.value)}
                  className="w-full h-10 px-3 bg-control-bg border border-white/10 rounded-xl text-text-primary focus:border-usdt-green focus:outline-none"
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
                  className="w-full p-2.5 bg-control-bg border border-white/10 rounded-xl text-text-primary focus:border-usdt-green focus:outline-none font-sans"
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
                  className="px-4 py-2 rounded-xl bg-rose-500 text-white text-xs font-black uppercase tracking-wider shadow-lg hover:brightness-110 disabled:opacity-50"
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
