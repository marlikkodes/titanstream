import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Clock, 
  RefreshCw, 
  AlertCircle, 
  Inbox, 
  Smartphone, 
  CreditCard, 
  Coins, 
  Gift, 
  Zap, 
  CheckCircle2 
} from 'lucide-react';
import { useWalletStore } from '../../store/useWalletStore';
import { usePaymentOrderStore } from '../../store/usePaymentOrderStore';
import { useTelegram } from '../../context/TelegramContext';

interface TransactionHistoryViewProps {
  onClose?: () => void;
}

const resolveTransactionDetails = (item: any) => {
  const type = String(item.type || '').toUpperCase();
  const desc = String(item.description || '').toLowerCase();
  const method = String(item.paymentMethod || item.channel || item.network || '').toUpperCase();
  const ref = String(item.reference || '');

  // 1. Mobile Money (MTN / Airtel / M-Pesa)
  if (method.includes('MTN') || desc.includes('mtn') || ref.includes('MTN')) {
    return {
      title: type.includes('WITHDRAW') ? 'MTN Mobile Money Cashout' : 'MTN Mobile Money Deposit',
      subtitle: item.mobileNumber ? `From ${item.mobileNumber} • MTN Uganda` : 'Via MTN Mobile Money',
      badge: 'MTN MoMo',
      badgeColor: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/25',
      iconType: 'mobile',
      isIncome: !type.includes('WITHDRAW'),
    };
  }

  if (method.includes('AIRTEL') || desc.includes('airtel') || ref.includes('AIRTEL')) {
    return {
      title: type.includes('WITHDRAW') ? 'Airtel Money Cashout' : 'Airtel Money Deposit',
      subtitle: item.mobileNumber ? `From ${item.mobileNumber} • Airtel Africa` : 'Via Airtel Money',
      badge: 'Airtel Money',
      badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/25',
      iconType: 'mobile',
      isIncome: !type.includes('WITHDRAW'),
    };
  }

  if (method.includes('MPESA') || desc.includes('mpesa') || ref.includes('MPESA')) {
    return {
      title: type.includes('WITHDRAW') ? 'M-Pesa Cashout' : 'M-Pesa Deposit',
      subtitle: item.mobileNumber ? `From ${item.mobileNumber} • Safaricom M-Pesa` : 'Via M-Pesa',
      badge: 'M-Pesa',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
      iconType: 'mobile',
      isIncome: !type.includes('WITHDRAW'),
    };
  }

  // 2. Card / Bank Transfer (Pesapal)
  if (method.includes('PESAPAL') || desc.includes('pesapal') || ref.includes('PESA')) {
    return {
      title: 'Card & Bank Deposit (Pesapal)',
      subtitle: item.localAmount && item.currency ? `${item.currency} ${Number(item.localAmount).toLocaleString()} • Visa / Mastercard / Bank` : 'Via Pesapal Secure Payment',
      badge: 'Pesapal Gateway',
      badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/25',
      iconType: 'card',
      isIncome: true,
    };
  }

  // 3. CryptoBot / Telegram Wallet
  if (method.includes('CRYPTO') || desc.includes('cryptobot') || ref.includes('CRYPTO')) {
    return {
      title: 'CryptoBot Wallet Deposit',
      subtitle: 'Via Telegram @CryptoBot Pay',
      badge: 'Telegram Wallet',
      badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25',
      iconType: 'crypto',
      isIncome: true,
    };
  }

  // 4. Mission & Task Rewards
  if (type.includes('CRYSTAL') || desc.includes('mission') || desc.includes('crystal') || ref.includes('CRYS')) {
    return {
      title: 'Bonus Mission Reward',
      subtitle: item.description || 'Earned from Community & Social Quests',
      badge: 'Task Bonus',
      badgeColor: 'bg-[#a7ffeb]/10 text-[#a7ffeb] border-[#a7ffeb]/25',
      iconType: 'reward',
      isIncome: true,
    };
  }

  // 5. Referral Bonus
  if (type.includes('REFERRAL') || desc.includes('referral') || ref.includes('REF_BONUS')) {
    return {
      title: 'Referral Cash Bonus',
      subtitle: item.description || 'Earned when an invited friend joined & traded',
      badge: 'Friend Bonus',
      badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/25',
      iconType: 'reward',
      isIncome: true,
    };
  }

  // 6. Mining & Machine Yield
  if (type.includes('MINING') || type.includes('MACHINE') || desc.includes('machine') || desc.includes('mining')) {
    return {
      title: 'Cloud Machine Mining Yield',
      subtitle: item.description || 'Daily compute capacity revenue',
      badge: 'Mining Yield',
      badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
      iconType: 'mining',
      isIncome: true,
    };
  }

  // 7. Generic Mobile Money / Deposit / Withdrawal
  if (type === 'MOBILE_MONEY' || method === 'MOBILE_MONEY') {
    return {
      title: 'Mobile Money Deposit',
      subtitle: item.mobileNumber ? `From ${item.mobileNumber}` : (item.localAmount ? `${item.currency || 'UGX'} ${Number(item.localAmount).toLocaleString()}` : 'Peer-to-Peer Mobile Money'),
      badge: 'Mobile Money',
      badgeColor: 'bg-usdt-green/10 text-usdt-green border-usdt-green/25',
      iconType: 'mobile',
      isIncome: true,
    };
  }

  if (type.includes('WITHDRAW')) {
    return {
      title: 'Money Withdrawal',
      subtitle: 'Cash payout to mobile money wallet',
      badge: 'Withdrawal',
      badgeColor: 'bg-white/10 text-text-secondary border-white/10',
      iconType: 'withdraw',
      isIncome: false,
    };
  }

  return {
    title: 'Account Deposit',
    subtitle: item.description || `Deposit to ${item.asset || 'USDT'} Balance`,
    badge: 'Deposit',
    badgeColor: 'bg-usdt-green/10 text-usdt-green border-usdt-green/25',
    iconType: 'deposit',
    isIncome: true,
  };
};

export const TransactionHistoryView: React.FC<TransactionHistoryViewProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'deposits' | 'settlements'>('all');
  const [page, setPage] = useState<number>(0);
  const limit = 20;

  const {
    transactions,
    settlementHistory,
    isLoadingTransactions,
    isLoadingSettlements,
    fetchTransactions,
    fetchSettlementHistory,
  } = useWalletStore();

  const myOrders = usePaymentOrderStore((s) => s.myOrders);
  const { hapticFeedback } = useTelegram();

  useEffect(() => {
    fetchTransactions(limit, page * limit);
    fetchSettlementHistory();
    usePaymentOrderStore.getState().fetchMyOrders().catch(() => undefined);
  }, [page, fetchTransactions, fetchSettlementHistory]);

  const handleRefresh = () => {
    hapticFeedback.impactOccurred('light');
    fetchTransactions(limit, page * limit);
    fetchSettlementHistory();
    usePaymentOrderStore.getState().fetchMyOrders().catch(() => undefined);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Just now';
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const combinedItems = React.useMemo(() => {
    // Combine transaction entries & settlement sessions for unified financial history view
    const txItems = (transactions || []).map((tx) => ({
      id: tx.id,
      type: tx.type || 'DEPOSIT',
      amount: tx.amount,
      asset: tx.asset || 'USDT',
      status: tx.status || 'COMPLETED',
      reference: tx.reference || tx.id.slice(-8),
      description: tx.description,
      date: tx.createdAt,
      source: 'ledger',
    }));

    const settlementItems = (Array.isArray(settlementHistory) ? settlementHistory : []).map((s) => ({
      id: s.settlementId,
      type: 'SETTLEMENT',
      amount: s.expectedCryptoAmount || s.expectedAssetAmount || s.requestedAmount || '0.00',
      asset: s.asset || 'USDT',
      status: s.status,
      reference: s.referenceCode || s.reference || (s.settlementId ? s.settlementId.slice(-8) : 'SETT'),
      channel: s.channel,
      currency: s.fiatCurrency,
      localAmount: s.fiatAmount,
      date: s.createdAt || s.updatedAt,
      source: 'settlement',
    }));

    const safeOrders = Array.isArray(myOrders) ? myOrders : Array.isArray((myOrders as any)?.data) ? (myOrders as any).data : [];
    const orderItems = safeOrders.map((o: any) => ({
      id: o.id,
      type: o.type || 'MOBILE_MONEY',
      amount: o.amount || 0,
      asset: o.asset || 'USDT',
      status: o.status === 'AWAITING_VERIFICATION' ? 'VERIFYING' : o.status === 'AWAITING_PAYMENT' ? 'WAITING_FOR_PAYMENT' : o.status,
      reference: o.reference || (o.id ? o.id.slice(-8) : 'ORD'),
      paymentMethod: o.paymentMethod,
      network: o.network,
      currency: o.currency,
      localAmount: o.localAmount,
      mobileNumber: o.mobileNumber,
      date: o.createdAt,
      source: 'order',
    }));

    // Deduplicate by reference if ledger entry matches settlement/order
    const map = new Map<string, any>();
    [...orderItems, ...settlementItems, ...txItems].forEach((item) => {
      if (!map.has(item.reference)) {
        map.set(item.reference, item);
      }
    });

    const merged = Array.from(map.values());
    merged.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

    if (activeTab === 'deposits') {
      return merged.filter((i) => i.status === 'COMPLETED' || i.type === 'SYSTEM_ALLOCATION' || !String(i.type).includes('WITHDRAW'));
    }
    if (activeTab === 'settlements') {
      return merged.filter((i) => i.source === 'settlement' || String(i.type).includes('WITHDRAW'));
    }

    return merged;
  }, [transactions, settlementHistory, myOrders, activeTab]);

  const isLoading = isLoadingTransactions || isLoadingSettlements;

  return (
    <div className="w-full space-y-4 font-sans">
      {/* View Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-extrabold text-text-primary">Transaction History</h3>
          <p className="text-xs text-text-tertiary">Real-time deposit and payment records</p>
        </div>

        <button
          onClick={handleRefresh}
          className="press-feedback flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-text-secondary hover:text-text-primary"
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-control-bg border border-white/10 text-[10px] sm:text-xs">
        {[
          { key: 'all', label: 'All Activity' },
          { key: 'deposits', label: 'Deposits & Inflow' },
          { key: 'settlements', label: 'Cashouts & Payments' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              hapticFeedback.selectionChanged();
              setActiveTab(tab.key as any);
            }}
            className={`flex-1 py-1.5 px-1 rounded-lg font-extrabold transition-colors whitespace-nowrap text-center ${
              activeTab === tab.key
                ? 'bg-usdt-green text-app-bg shadow-sm'
                : 'text-text-tertiary hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List Container */}
      {isLoading && combinedItems.length === 0 ? (
        /* Loading Skeleton */
        <div className="space-y-2 py-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-16 rounded-2xl glass-panel animate-pulse border border-white/5" />
          ))}
        </div>
      ) : combinedItems.length === 0 ? (
        /* Empty State */
        <div className="py-12 glass-panel rounded-2xl border border-white/10 flex flex-col items-center justify-center space-y-3 text-center">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-text-tertiary">
            <Inbox size={24} />
          </div>
          <h4 className="text-sm font-extrabold text-text-primary">No Transactions Yet</h4>
          <p className="text-xs text-text-tertiary max-w-[240px]">
            Your deposits, mining earnings, and payment transactions will appear here.
          </p>
        </div>
      ) : (
        /* Transaction List */
        <div className="space-y-2.5">
          {combinedItems.map((item) => {
            const isCompleted = item.status === 'COMPLETED';
            const isPending = ['CREATED', 'WAITING_FOR_PAYMENT', 'VERIFYING', 'USDT_SENT', 'APPROVED'].includes(item.status);
            const details = resolveTransactionDetails(item);

            return (
              <div
                key={item.id}
                className="glass-panel p-3.5 rounded-2xl border border-white/10 hover:border-white/20 flex items-center justify-between gap-3 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Category & Channel Icon */}
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold shrink-0 shadow-sm ${
                      isCompleted
                        ? details.isIncome
                          ? 'bg-usdt-green/20 text-usdt-green border border-usdt-green/30'
                          : 'bg-white/10 text-text-secondary border border-white/15'
                        : isPending
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {details.iconType === 'mobile' ? (
                      <Smartphone size={17} />
                    ) : details.iconType === 'card' ? (
                      <CreditCard size={17} />
                    ) : details.iconType === 'crypto' ? (
                      <Coins size={17} />
                    ) : details.iconType === 'reward' ? (
                      <Gift size={17} />
                    ) : details.iconType === 'mining' ? (
                      <Zap size={17} />
                    ) : details.iconType === 'withdraw' ? (
                      <ArrowUpRight size={17} />
                    ) : (
                      <ArrowDownLeft size={17} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-black text-text-primary truncate">
                        {details.title}
                      </span>
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-md border ${details.badgeColor}`}>
                        {details.badge}
                      </span>
                    </div>

                    <div className="text-[11px] text-text-secondary truncate mt-0.5 font-medium">
                      {details.subtitle}
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-text-tertiary mt-1 font-mono">
                      <span className="truncate max-w-[120px] sm:max-w-[180px]" title={item.reference}>
                        #{item.reference}
                      </span>
                      <span>•</span>
                      <span className="shrink-0">{formatDate(item.date)}</span>
                    </div>
                  </div>
                </div>

                {/* Right Amount & Status Tag */}
                <div className="text-right shrink-0">
                  <div className={`text-xs font-mono font-black ${
                    details.isIncome ? 'text-usdt-green' : 'text-text-primary'
                  }`}>
                    {details.isIncome ? '+' : '-'}{item.amount} {item.asset}
                  </div>

                  <span
                    className={`inline-block text-[9px] font-extrabold px-2 py-0.5 rounded-full mt-1 uppercase tracking-wider ${
                      isCompleted
                        ? 'text-usdt-green bg-usdt-green/10 border border-usdt-green/20'
                        : isPending
                        ? 'text-amber-300 bg-amber-500/10 border border-amber-500/20'
                        : 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
                    }`}
                  >
                    {isCompleted ? 'Completed' : isPending ? 'Processing' : item.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Simple Pagination controls */}
      <div className="flex items-center justify-between pt-2">
        <button
          disabled={page === 0}
          onClick={() => {
            hapticFeedback.selectionChanged();
            setPage((p) => Math.max(0, p - 1));
          }}
          className="press-feedback px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-text-secondary disabled:opacity-30"
        >
          Previous
        </button>

        <span className="text-xs font-mono font-bold text-text-tertiary">
          Page {page + 1}
        </span>

        <button
          disabled={combinedItems.length < limit}
          onClick={() => {
            hapticFeedback.selectionChanged();
            setPage((p) => p + 1);
          }}
          className="press-feedback px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-text-secondary disabled:opacity-30"
        >
          Next
        </button>
      </div>
    </div>
  );
};
