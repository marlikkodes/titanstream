import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { MetricCard, MetricCardGrid } from '@/components/admin/MetricCard';
import { api } from '@/services/api';
import { showToast } from '@/components/Toast';
import {
  Send,
  Bell,
  RefreshCw,
  Radio,
  ShieldAlert,
  ShoppingCart,
  Store,
  Settings,
  ArrowUpFromLine,
  CheckCircle2,
} from 'lucide-react';

export interface AdminEventRecord {
  id: string;
  type: string;
  title?: string;
  message?: string;
  description?: string;
  severity?: string;
  channel?: string;
  source?: string;
  createdAt: string;
}

const typeIcons: Record<string, React.ReactNode> = {
  order: <ShoppingCart size={16} />,
  merchant: <Store size={16} />,
  system: <Settings size={16} />,
  alert: <ShieldAlert size={16} />,
  withdrawal: <ArrowUpFromLine size={16} />,
  broadcast: <Radio size={16} />,
};

const typeStyles: Record<string, string> = {
  order: 'text-ton-blue bg-ton-blue/15',
  merchant: 'text-usdt-green bg-usdt-green/15',
  system: 'text-text-secondary bg-white/10',
  alert: 'text-error-red bg-error-red/15',
  withdrawal: 'text-gold bg-gold/15',
  broadcast: 'text-usdt-green bg-usdt-green/15',
};

export const NotificationsPage: React.FC = () => {
  const [targetAudience, setTargetAudience] = useState('Public Channel');
  const [broadcastText, setBroadcastText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [events, setEvents] = useState<AdminEventRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAdminEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/dashboard/events').catch(() => null);
      const data = res?.data?.data || res?.data;
      if (Array.isArray(data)) {
        setEvents(data);
      } else {
        // Fallback to audit explorer
        const auditRes = await api.get('/admin/intelligence/audit-explorer?page=1&limit=30').catch(() => null);
        const auditData = auditRes?.data?.data?.items || auditRes?.data?.items || [];
        setEvents(
          auditData.map((a: any) => ({
            id: a.id,
            type: a.eventType?.toLowerCase() || 'system',
            title: a.eventType,
            message: a.description,
            severity: a.severity,
            source: a.source,
            createdAt: a.createdAt,
          })),
        );
      }
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminEvents();
  }, [fetchAdminEvents]);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastText.trim()) return;
    setIsSending(true);
    try {
      await api.post('/admin/operations-hq/broadcast', {
        targetAudience,
        message: broadcastText.trim(),
        reason: `Admin broadcast dispatch to ${targetAudience}`,
      });
      showToast(`Broadcast successfully published to ${targetAudience}!`, 'success');
      setBroadcastText('');
      fetchAdminEvents();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to dispatch broadcast notification', 'error');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <MetricCardGrid columns={3}>
        <MetricCard label="System Events Stream" value={events.length.toString()} icon="Bell" variant="green" />
        <MetricCard label="Broadcast Engine" value="ONLINE" icon="Radio" variant="blue" />
        <MetricCard label="Audience Channels" value="5 Segments" icon="Send" variant="gold" />
      </MetricCardGrid>

      {/* Telegram Broadcast Engine Composer */}
      <div className="bg-card-bg rounded-2xl p-4 sm:p-5 border border-white/10 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-text-primary flex items-center gap-2">
              <Radio size={18} className="text-usdt-green" /> Authoritative Telegram Broadcast Engine
            </h3>
            <p className="text-xs text-text-tertiary mt-0.5">
              Publish announcements directly to official Telegram public channels, private groups, or segmented user bases.
            </p>
          </div>
        </div>

        <div className="space-y-3 pt-1">
          {/* Target Audience Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-text-tertiary">Target Audience:</span>
            {['Public Channel', 'Private Group', 'Uganda Users', 'Machine Owners', 'All Users'].map((aud) => (
              <button
                key={aud}
                type="button"
                onClick={() => setTargetAudience(aud)}
                className={`px-3 py-1 rounded-xl text-xs font-extrabold transition-colors cursor-pointer ${
                  targetAudience === aud
                    ? 'bg-usdt-green text-app-bg shadow-sm'
                    : 'bg-control-bg text-text-secondary hover:text-text-primary border border-white/5'
                }`}
              >
                {aud}
              </button>
            ))}
          </div>

          <form onSubmit={handleBroadcast} className="space-y-3">
            <textarea
              rows={3}
              placeholder={`Write broadcast message for ${targetAudience}...`}
              value={broadcastText}
              onChange={(e) => setBroadcastText(e.target.value)}
              className="w-full bg-control-bg text-text-primary text-xs rounded-xl p-3 border border-white/10 focus:border-usdt-green focus:outline-none"
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-text-tertiary">
                Supports Telegram markdown, emojis & link previews
              </span>
              <button
                type="submit"
                disabled={isSending || !broadcastText.trim()}
                className="px-4 py-2.5 rounded-xl bg-usdt-green text-app-bg font-extrabold text-xs shadow-md hover:brightness-110 press-feedback disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                <Send size={14} />
                <span>{isSending ? 'Publishing...' : 'Publish Telegram Broadcast'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* System Admin Events Feed */}
      <div className="bg-card-bg rounded-2xl p-4 sm:p-5 border border-white/10 space-y-3 shadow-xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-text-primary flex items-center gap-2">
            <Bell size={16} className="text-usdt-green" /> Real-Time Platform Event Feed
          </h4>
          <button
            onClick={fetchAdminEvents}
            disabled={loading}
            className="p-1.5 rounded-xl bg-control-bg border border-white/10 text-text-secondary hover:text-text-primary disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {events.length === 0 ? (
          <div className="p-8 text-center bg-control-bg rounded-xl border border-white/5 space-y-1">
            <p className="text-xs font-bold text-text-primary">No platform events recorded yet</p>
            <p className="text-[11px] text-text-tertiary">Live administrative events and alerts will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {events.map((n) => (
              <div
                key={n.id}
                className="bg-control-bg/60 rounded-xl border border-white/5 p-3.5 flex items-start gap-3 text-xs"
              >
                <div className={`p-2 rounded-lg flex-shrink-0 ${typeStyles[n.type] || 'text-text-secondary bg-white/10'}`}>
                  {typeIcons[n.type] || <Settings size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-extrabold text-text-primary truncate">{n.title || n.type}</h4>
                    <StatusBadge label={n.severity || n.type} variant="info" />
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5">{n.message || n.description}</p>
                  <div className="flex items-center gap-3 text-[10px] text-text-tertiary mt-1 font-mono">
                    {n.source && <span>Source: {n.source}</span>}
                    <span>{new Date(n.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
