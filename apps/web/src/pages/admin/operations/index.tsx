import type React from 'react';
import { useState, useEffect } from 'react';
import { operationsService, type OperationsQueueRecord, type SystemIncidentRecord } from '@/services/operationsService';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { MetricCard, MetricCardGrid } from '@/components/admin/MetricCard';
import { Clock, ArrowUpRight, CheckCircle, RefreshCw, AlertTriangle, ShieldAlert, User, Plus } from 'lucide-react';
import { showToast } from '@/components/Toast';

export const OperationsPage: React.FC = () => {
  const [queueItems, setQueueItems] = useState<OperationsQueueRecord[]>([]);
  const [incidents, setIncidents] = useState<SystemIncidentRecord[]>([]);
  const [switches, setSwitches] = useState<any>({
    maintenanceMode: false,
    readOnlyMode: false,
    disableWithdrawals: false,
    disablePurchases: false,
    disableClaims: false,
    disableRegistrations: false,
    disableSettlements: false,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'switches' | 'queue' | 'incidents'>('switches');
  const [savingSwitch, setSavingSwitch] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [qItems, incs, sws] = await Promise.all([
        operationsService.getOperationsQueue().catch(() => []),
        operationsService.getIncidents().catch(() => []),
        operationsService.getGlobalSwitches().catch(() => ({})),
      ]);
      setQueueItems(qItems || []);
      setIncidents(incs || []);
      if (sws && typeof sws === 'object') {
        setSwitches((prev: any) => ({ ...prev, ...sws }));
      }
    } catch (err: any) {
      console.warn('Failed to load operations data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleSwitch = async (key: string, currentVal: boolean) => {
    const actionLabel = currentVal ? 'DISABLE / TURN OFF' : 'ENABLE / TURN ON';
    const reason = prompt(`[MANDATORY AUDIT REASON] Reason for ${actionLabel} on ${key}:`, `Admin operational toggle: ${key}`);
    if (reason === null) return;
    if (!reason.trim()) {
      showToast('Action cancelled: Audit reason is mandatory.', 'error');
      return;
    }

    const updated = { ...switches, [key]: !currentVal };
    setSavingSwitch(true);
    try {
      await operationsService.updateGlobalSwitches(updated, reason.trim());
      setSwitches(updated);
      showToast(`Operational Switch '${key}' updated successfully.`, 'success');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update operational switch', 'error');
    } finally {
      setSavingSwitch(false);
    }
  };

  const handleResolveQueueItem = async (id: string) => {
    try {
      await operationsService.resolveQueueItem(id, 'Resolved via Operations HQ');
      showToast('Queue item resolved successfully', 'success');
      loadData();
    } catch (err: any) {
      showToast('Failed to resolve queue item', 'error');
    }
  };

  const handleRetryQueueItem = async (id: string) => {
    try {
      await operationsService.retryQueueItem(id);
      showToast('Re-triggered queue execution', 'info');
      loadData();
    } catch (err: any) {
      showToast('Failed to retry queue item', 'error');
    }
  };

  const handleResolveIncident = async (id: string) => {
    try {
      await operationsService.resolveIncident(id, 'Mitigated and verified');
      showToast('Incident marked as RESOLVED', 'success');
      loadData();
    } catch (err: any) {
      showToast('Failed to resolve incident', 'error');
    }
  };

  const safeQueue = Array.isArray(queueItems) ? queueItems : [];
  const safeIncidents = Array.isArray(incidents) ? incidents : [];
  const openQueueCount = safeQueue.filter((q) => q.status === 'OPEN').length;
  const activeIncidentCount = safeIncidents.filter((i) => i.status !== 'RESOLVED').length;
  const activeSwitchesCount = Object.values(switches).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <MetricCardGrid columns={3}>
        <MetricCard label="Active Emergency Locks" value={activeSwitchesCount.toString()} change={0} icon="Cpu" variant={activeSwitchesCount > 0 ? 'red' : 'green'} />
        <MetricCard label="Operations Queue" value={openQueueCount.toString()} change={0} icon="Clock" variant="gold" />
        <MetricCard label="Active Incidents" value={activeIncidentCount.toString()} change={0} icon="ShieldAlert" variant="red" />
      </MetricCardGrid>

      {/* Tab Selector */}
      <div className="flex items-center gap-2 border-b border-border/50 pb-2">
        <button
          onClick={() => setActiveTab('switches')}
          className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-colors cursor-pointer ${
            activeTab === 'switches' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Emergency Kill Switches ({activeSwitchesCount} Active)
        </button>
        <button
          onClick={() => setActiveTab('queue')}
          className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-colors cursor-pointer ${
            activeTab === 'queue' ? 'bg-usdt-green/15 text-usdt-green border border-usdt-green/30' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Operations Queue ({openQueueCount})
        </button>
        <button
          onClick={() => setActiveTab('incidents')}
          className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-colors cursor-pointer ${
            activeTab === 'incidents' ? 'bg-error-red/15 text-error-red border border-error-red/30' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          System Incidents ({activeIncidentCount})
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-xs text-text-tertiary">Loading operational controls...</div>
      ) : activeTab === 'switches' ? (
        <div className="space-y-4">
          <div className="bg-card-bg border border-white/10 rounded-2xl p-5 shadow-lg space-y-4">
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-text-primary">Persistent Platform Emergency Switches</h3>
              <p className="text-[11px] text-text-tertiary mt-1">
                Toggling any switch updates the single database authority in real-time. API controllers globally block restricted endpoints when active.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: 'maintenanceMode', label: 'Platform Maintenance Mode', desc: 'Blocks all non-admin user HTTP API traffic' },
                { key: 'readOnlyMode', label: 'Global Read-Only Mode', desc: 'Blocks all state-mutating requests platform-wide' },
                { key: 'disableWithdrawals', label: 'Disable Withdrawals', desc: 'Halts user withdrawal requests & worker processing' },
                { key: 'disablePurchases', label: 'Disable Machine Purchases', desc: 'Blocks new machine catalog license orders' },
                { key: 'disableClaims', label: 'Disable Reward Claims', desc: 'Halts mining yield & achievement claims' },
                { key: 'disableRegistrations', label: 'Disable New Registrations', desc: 'Blocks new Telegram user registrations' },
                { key: 'disableSettlements', label: 'Disable Settlement Engine', desc: 'Halts CryptoBot & Merchant settlement execution' },
              ].map((sw) => {
                const isActive = Boolean(switches[sw.key]);
                return (
                  <div
                    key={sw.key}
                    className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                      isActive ? 'bg-error-red/10 border-error-red/40' : 'bg-control-bg border-white/10'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-extrabold text-text-primary flex items-center gap-2">
                        {sw.label}
                        {isActive && <span className="px-2 py-0.5 rounded text-[9px] font-black bg-error-red text-white">ACTIVE LOCK</span>}
                      </div>
                      <div className="text-[11px] text-text-tertiary mt-0.5">{sw.desc}</div>
                    </div>

                    <button
                      onClick={() => handleToggleSwitch(sw.key, isActive)}
                      disabled={savingSwitch}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex-shrink-0 ${
                        isActive
                          ? 'bg-usdt-green text-app-bg hover:opacity-90 shadow-md'
                          : 'bg-error-red/20 text-error-red border border-error-red/40 hover:bg-error-red hover:text-white'
                      }`}
                    >
                      {isActive ? 'UNLOCK' : 'LOCK'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : activeTab === 'queue' ? (
        <div className="space-y-3">
          {queueItems.map((item) => (
            <div key={item.id} className="bg-card-bg rounded-xl p-4 border border-border/50 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-text-primary">{item.reason}</span>
                  <StatusBadge label={item.status} variant={item.status === 'RESOLVED' ? 'success' : 'warning'} dot />
                </div>
                <span className="text-[10px] font-mono text-text-tertiary">
                  {new Date(item.createdAt).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-xs text-text-secondary font-mono bg-app-bg p-2 rounded-lg border border-white/5 truncate">
                {JSON.stringify(item.payload)}
              </p>
              {item.status === 'OPEN' && (
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => handleRetryQueueItem(item.id)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-text-secondary hover:text-text-primary flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw size={12} /> Retry
                  </button>
                  <button
                    onClick={() => handleResolveQueueItem(item.id)}
                    className="px-3 py-1.5 rounded-lg bg-usdt-green text-app-bg text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCircle size={12} /> Resolve
                  </button>
                </div>
              )}
            </div>
          ))}
          {queueItems.length === 0 && (
            <div className="text-center py-8 text-xs text-text-tertiary">Operations Queue is clear (0 failure items)</div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.map((inc) => (
            <div key={inc.id} className="bg-card-bg rounded-xl p-4 border border-border/50 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-text-primary">{inc.reference}: {inc.title}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    inc.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-gold/20 text-gold border border-gold/30'
                  }`}>
                    {inc.severity}
                  </span>
                </div>
                <StatusBadge label={inc.status} variant={inc.status === 'RESOLVED' ? 'success' : 'danger'} dot />
              </div>
              <p className="text-xs text-text-secondary">{inc.description}</p>
              <div className="flex items-center justify-between text-[11px] text-text-tertiary font-mono pt-1">
                <span>Component: {inc.affectedComponent}</span>
                <span>Owner: {inc.ownerName || 'Unassigned'}</span>
              </div>
              {inc.status !== 'RESOLVED' && (
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => handleResolveIncident(inc.id)}
                    className="px-3 py-1.5 rounded-lg bg-usdt-green text-app-bg text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCircle size={12} /> Mark Resolved
                  </button>
                </div>
              )}
            </div>
          ))}
          {incidents.length === 0 && (
            <div className="text-center py-8 text-xs text-text-tertiary">No active system incidents reported</div>
          )}
        </div>
      )}
    </div>
  );
};
