import type React from 'react';
import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Search, RefreshCw, FileText, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

export interface LedgerEntryRecord {
  id: string;
  transactionGroupId: string;
  financialAccountId: string;
  assetCode: string;
  amount: string;
  entryType: 'DEBIT' | 'CREDIT';
  reference: string;
  createdAt: string;
  ledgerAccount?: {
    code: string;
    name: string;
    type: string;
  };
}

export const GeneralLedgerStream: React.FC = () => {
  const [entries, setEntries] = useState<LedgerEntryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<string>('ALL');

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/financial/ledger', {
        params: { limit: 50, accountCode: selectedAccount !== 'ALL' ? selectedAccount : undefined },
      }).catch(() => ({ data: [] }));
      const data = res?.data?.data || res?.data?.items || res?.data;
      if (Array.isArray(data)) {
        setEntries(data);
      } else if (Array.isArray(data?.entries)) {
        setEntries(data.entries);
      } else {
        setEntries([]);
      }
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, [selectedAccount]);

  const filteredEntries = entries.filter((e) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      e.reference?.toLowerCase().includes(term) ||
      e.ledgerAccount?.code?.toLowerCase().includes(term) ||
      e.ledgerAccount?.name?.toLowerCase().includes(term) ||
      e.id.toLowerCase().includes(term)
    );
  });

  return (
    <div className="bg-card-bg border border-white/10 rounded-2xl p-5 shadow-lg space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-usdt-green" />
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-text-primary">
              General Ledger Live Explorer
            </h4>
            <p className="text-[11px] text-text-tertiary">Real-time double-entry audit stream & Chart of Accounts</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Account Filter */}
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="bg-control-bg text-text-primary text-xs rounded-xl p-2 border border-white/10 focus:border-usdt-green font-mono"
          >
            <option value="ALL">All Account Codes</option>
            <option value="USER_ASSET_LIABILITY">USER_ASSET_LIABILITY</option>
            <option value="SYSTEM_RESERVE">SYSTEM_RESERVE</option>
            <option value="PLATFORM_REVENUE">PLATFORM_REVENUE</option>
            <option value="WITHDRAWAL_ESCROW">WITHDRAWAL_ESCROW</option>
            <option value="COMMISSION_EXPENSE">COMMISSION_EXPENSE</option>
          </select>

          {/* Search */}
          <div className="relative flex-1 sm:w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="Filter by ref, code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-control-bg text-text-primary text-xs rounded-xl pl-8 pr-3 py-2 border border-white/10 focus:border-usdt-green"
            />
          </div>

          <button
            onClick={fetchLedger}
            disabled={loading}
            className="p-2 rounded-xl bg-control-bg border border-white/10 hover:bg-white/5 text-text-secondary disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Entry List Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-white/10 text-text-tertiary font-extrabold uppercase text-[10px] tracking-wider">
              <th className="py-2.5 px-3">Type</th>
              <th className="py-2.5 px-3">Account Code</th>
              <th className="py-2.5 px-3">Reference</th>
              <th className="py-2.5 px-3 text-right">Amount</th>
              <th className="py-2.5 px-3 text-right">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-mono">
            {filteredEntries.map((entry) => {
              const isDebit = entry.entryType === 'DEBIT';
              return (
                <tr key={entry.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-extrabold text-[10px] ${
                        isDebit
                          ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                          : 'bg-usdt-green/15 text-usdt-green border border-usdt-green/30'
                      }`}
                    >
                      {isDebit ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
                      {entry.entryType}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-text-primary font-bold">
                    {entry.ledgerAccount?.code || 'GENERAL_LEDGER'}
                    <span className="block text-[10px] text-text-tertiary font-sans font-normal">
                      {entry.ledgerAccount?.name || 'Standard Entry'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-text-secondary">{entry.reference || entry.transactionGroupId}</td>
                  <td
                    className={`py-2.5 px-3 text-right font-extrabold ${
                      isDebit ? 'text-blue-400' : 'text-usdt-green'
                    }`}
                  >
                    {isDebit ? '-' : '+'}${Number(entry.amount).toFixed(2)} {entry.assetCode || 'USDT'}
                  </td>
                  <td className="py-2.5 px-3 text-right text-text-tertiary text-[10px]">
                    {new Date(entry.createdAt).toLocaleString()}
                  </td>
                </tr>
              );
            })}
            {filteredEntries.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-text-tertiary font-sans text-xs">
                  {loading ? 'Fetching double-entry ledger records...' : 'No ledger entries found for selected filter.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
