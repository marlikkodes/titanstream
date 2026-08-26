import React, { Component, type ErrorInfo, useState } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, Search } from 'lucide-react';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
  width?: string;
  hideable?: boolean;
  mobile?: (item: T) => { label: string; value: React.ReactNode };
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackMessage?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class DataTableErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[DataTable] Render safely recovered from error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center bg-card-bg rounded-xl border border-white/10 space-y-2">
          <div className="text-xs font-bold text-text-primary">Data table safely recovered</div>
          <div className="text-[11px] text-text-tertiary">
            {this.props.fallbackMessage || 'The table encountered an unexpected property format and safely recovered.'}
          </div>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-2 px-3 py-1.5 rounded-lg bg-control-bg text-xs font-bold text-usdt-green border border-white/10 hover:bg-white/5"
          >
            Refresh Table
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor?: (item: T) => string;
  onRowClick?: (item: T) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchKeys?: string[];
  pageSize?: number;
  className?: string;
  mobileCard?: boolean;
  mobileCardRender?: (item: T) => React.ReactNode;
  loading?: boolean;
  totalCount?: number;
  page?: number;
  onPageChange?: (page: number) => void;
  emptyMessage?: string;
}

function DataTableInner<T extends Record<string, unknown>>({
  columns = [],
  data = [],
  keyExtractor,
  onRowClick,
  searchable = false,
  searchPlaceholder = 'Search...',
  searchKeys,
  pageSize = 10,
  className = '',
  mobileCard = false,
  mobileCardRender,
  loading = false,
  totalCount,
  page: controlledPage,
  onPageChange,
  emptyMessage = 'No results found',
}: DataTableProps<T>) {
  const safeData: T[] = Array.isArray(data)
    ? data
    : Array.isArray((data as any)?.data)
    ? (data as any).data
    : Array.isArray((data as any)?.items)
    ? (data as any).items
    : [];

  const safeColumns = Array.isArray(columns) ? columns : [];

  const getKey = (item: T, idx: number): string => {
    if (typeof keyExtractor === 'function') {
      try {
        const k = keyExtractor(item);
        if (k != null) return String(k);
      } catch {}
    }
    const anyItem = item as any;
    return String(anyItem?.id ?? anyItem?.key ?? anyItem?.telegramId ?? anyItem?.reference ?? anyItem?.code ?? `row-${idx}`);
  };

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [internalPage, setInternalPage] = useState(0);
  const isControlled = controlledPage !== undefined && typeof onPageChange === 'function';
  const page = isControlled ? (controlledPage > 0 ? controlledPage - 1 : controlledPage) : internalPage;

  const filtered = safeData.filter((item) => {
    if (!item) return false;
    if (!search) return true;
    return safeColumns.some((col) => {
      const val = item[col.key];
      return val != null && String(val).toLowerCase().includes(search.toLowerCase());
    });
  });

  const sorted = [...filtered].sort((a, b) => {
    if (!sortKey) return 0;
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (aVal == null || bVal == null) return 0;
    const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalCountFinal = totalCount !== undefined ? totalCount : sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalCountFinal / pageSize));
  const paged = isControlled ? safeData : sorted.slice(page * pageSize, (page + 1) * pageSize);

  const handlePageChange = (newPage: number) => {
    if (isControlled && onPageChange) {
      onPageChange(newPage + 1); // 1-indexed for controlled APIs
    } else {
      setInternalPage(newPage);
    }
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <div className={`bg-card-bg rounded-xl overflow-hidden ${className}`}>
      {searchable && (
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setInternalPage(0); }}
              placeholder={searchPlaceholder}
              className="w-full bg-control-bg/50 text-text-primary rounded-lg pl-9 pr-3 py-2.5 sm:py-2 text-sm border border-white/5 focus:border-usdt-green focus:outline-none placeholder:text-text-tertiary"
            />
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="p-12 text-center space-y-2">
          <div className="w-6 h-6 border-2 border-usdt-green border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-xs text-text-tertiary">Loading data...</div>
        </div>
      ) : (
        <>
          {/* Mobile card view */}
          {mobileCard && (
            <div className="sm:hidden divide-y divide-border/40">
              {paged.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-text-tertiary">{emptyMessage}</div>
              ) : (
                paged.map((item, idx) => (
                  <div
                    key={getKey(item, idx)}
                    onClick={() => onRowClick?.(item)}
                    className={`px-4 py-3 ${onRowClick ? 'cursor-pointer active:bg-white/[0.03]' : ''}`}
                  >
                    {mobileCardRender ? (
                      mobileCardRender(item)
                    ) : (
                      <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-sm">
                        {safeColumns.filter(c => typeof c.mobile === 'function').map((col) => {
                          try {
                            const m = col.mobile!(item);
                            if (!m) return null;
                            return (
                              <div key={col.key}>
                                <span className="text-[10px] font-semibold text-text-tertiary uppercase block">{m.label}</span>
                                <span className="text-text-primary">{m.value}</span>
                              </div>
                            );
                          } catch {
                            return null;
                          }
                        })}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Desktop table */}
          <div className={`overflow-x-auto ${mobileCard ? 'hidden sm:block' : ''}`}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {safeColumns.map((col) => (
                    <th
                      key={col.key}
                      className={`text-left text-xs font-semibold text-text-secondary uppercase tracking-wider px-3 py-3 ${col.sortable ? 'cursor-pointer hover:text-text-primary select-none' : ''} ${col.width || ''}`}
                      onClick={() => col.sortable && handleSort(col.key)}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        {col.sortable && (
                          <span className="text-text-tertiary">
                            {sortKey === col.key ? (
                              sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                            ) : <ChevronsUpDown size={14} />}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {paged.map((item, idx) => (
                  <tr
                    key={getKey(item, idx)}
                    onClick={() => onRowClick?.(item)}
                    className={`hover:bg-white/[0.02] transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                  >
                    {safeColumns.map((col) => (
                      <td key={col.key} className="px-3 py-3 text-sm text-text-primary whitespace-nowrap">
                        {col.render ? (
                          (() => {
                            try {
                              return col.render(item);
                            } catch {
                              return String(item[col.key] ?? '');
                            }
                          })()
                        ) : (
                          String(item[col.key] ?? '')
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                {paged.length === 0 && (
                  <tr>
                    <td colSpan={Math.max(1, safeColumns.length)} className="px-3 py-8 text-center text-sm text-text-tertiary">
                      {emptyMessage}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-3 border-t border-border">
          <span className="text-xs text-text-tertiary">
            Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalCountFinal)} of {totalCountFinal}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => handlePageChange(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 min-h-[32px] text-xs rounded-lg bg-control-bg text-text-primary disabled:opacity-40 hover:bg-white/10 transition-colors"
            >
              Prev
            </button>
            <button
              onClick={() => handlePageChange(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 min-h-[32px] text-xs rounded-lg bg-control-bg text-text-primary disabled:opacity-40 hover:bg-white/10 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function DataTable<T extends Record<string, unknown>>(props: DataTableProps<T>) {
  return (
    <DataTableErrorBoundary fallbackMessage={props.emptyMessage}>
      <DataTableInner {...props} />
    </DataTableErrorBoundary>
  );
}

