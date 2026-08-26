import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Search, RefreshCw, ShieldCheck, Download } from 'lucide-react';
import { api } from '@/services/api';
import { showToast } from '@/components/Toast';

export interface AuditExplorerEntry {
  id: string;
  telegramUserId: string;
  eventType: string;
  description: string;
  severity: string;
  source: string;
  correlationId?: string;
  metadata?: any;
  createdAt: string;
}

const severityVariant: Record<string, 'info' | 'warning' | 'danger'> = {
  INFO: 'info',
  LOW: 'info',
  MEDIUM: 'warning',
  HIGH: 'warning',
  CRITICAL: 'danger',
};

export const AuditPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [auditLogs, setAuditLogs] = useState<AuditExplorerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchAuditLogs = useCallback(async (pageNum: number = 1, searchQuery: string = '') => {
    setLoading(true);
    try {
      const res = await api.get(
        `/admin/intelligence/audit-explorer?page=${pageNum}&limit=50&search=${encodeURIComponent(searchQuery)}`
      );
      const data = res.data?.data || res.data;
      setAuditLogs(data?.items || []);
      setTotalPages(data?.pagination?.totalPages || 1);
      setPage(pageNum);
    } catch {
      setAuditLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuditLogs(1, '');
  }, [fetchAuditLogs]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAuditLogs(1, search);
  };

  const handleExportCSV = () => {
    if (auditLogs.length === 0) {
      showToast('No audit logs to export', 'error');
      return;
    }
    const headers = 'ID,Actor/User,Event Type,Description,Severity,Source,CreatedAt\n';
    const rows = auditLogs
      .map(
        (e) =>
          `"${e.id}","${e.telegramUserId}","${e.eventType}","${(e.description || '').replace(/"/g, '""')}","${e.severity}","${e.source}","${e.createdAt}"`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `titan-stream-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Audit log CSV exported successfully', 'success');
  };

  return (
    <div className="space-y-4">
      {/* Header Search & Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card-bg p-4 rounded-2xl border border-white/10 shadow-lg">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by actor, event type, description, or source..."
            className="w-full bg-control-bg text-text-primary rounded-xl pl-9 pr-3 py-2 text-xs border border-white/10 focus:border-usdt-green focus:outline-none placeholder:text-text-tertiary"
          />
        </form>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-control-bg border border-usdt-green/40 text-usdt-green font-extrabold text-xs flex items-center gap-1.5 cursor-pointer hover:bg-usdt-green/10"
          >
            <Download size={14} /> Export CSV
          </button>
          <button
            onClick={() => fetchAuditLogs(page, search)}
            disabled={loading}
            className="p-2 rounded-xl bg-control-bg border border-white/10 hover:bg-white/5 text-text-secondary disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center bg-card-bg rounded-xl border border-white/5 text-xs text-text-tertiary">
          Loading immutable audit trail...
        </div>
      ) : auditLogs.length === 0 ? (
        <div className="p-8 text-center bg-card-bg rounded-xl border border-white/5 space-y-1">
          <p className="text-xs font-bold text-text-primary">No audit log entries recorded yet</p>
          <p className="text-[11px] text-text-tertiary">System audit events and administrative actions will appear here.</p>
        </div>
      ) : (
        <div className="bg-card-bg rounded-2xl border border-white/10 overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-white/10 bg-control-bg text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Actor / User</th>
                  <th className="px-4 py-3">Event Type</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {auditLogs.map((entry) => (
                  <tr key={entry.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-text-tertiary whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-bold text-text-primary">
                      {entry.telegramUserId}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-[11px] bg-control-bg px-2 py-0.5 rounded text-ton-blue font-bold">
                        {entry.eventType}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-text-secondary max-w-sm truncate">
                      {entry.description}
                    </td>
                    <td className="px-4 py-3 text-text-tertiary text-[11px]">
                      {entry.source}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={entry.severity?.toUpperCase() || 'INFO'}
                        variant={severityVariant[entry.severity?.toUpperCase()] || 'info'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center p-3 border-t border-white/10 text-xs text-text-tertiary">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => fetchAuditLogs(page - 1, search)}
                className="px-3 py-1 rounded-lg bg-control-bg border border-white/10 disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => fetchAuditLogs(page + 1, search)}
                className="px-3 py-1 rounded-lg bg-control-bg border border-white/10 disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
