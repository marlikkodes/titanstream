import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, Loader2, Inbox, Hash } from 'lucide-react';
import type { RewardHistoryItem } from '../../services/growthService';
import { useRewardQueueStore } from '../../store/useRewardQueueStore';

const formatClaimDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
};

const REWARD_ICONS: Record<string, string> = {
  REFERRAL: '👥',
  MILESTONE: '🏆',
  LOYALTY: '🎁',
  CAMPAIGN: '📣',
};

type HistoryFilter = 'ALL' | 'CLAIMED' | 'EXPIRED';

export const RewardHistorySection: React.FC = () => {
  const { history, isLoading, fetchHistory } = useRewardQueueStore();
  const [filter, setFilter] = useState<HistoryFilter>('ALL');

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const safeHistory = Array.isArray(history) ? history : [];

  const filtered = useMemo(
    () => (filter === 'ALL' ? safeHistory : safeHistory.filter((h) => h.status === filter)),
    [safeHistory, filter],
  );

  const tabs: Array<{ key: HistoryFilter; label: string }> = [
    { key: 'ALL', label: 'All' },
    { key: 'CLAIMED', label: 'Claimed' },
    { key: 'EXPIRED', label: 'Expired' },
  ];

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-1.5">
        {tabs.map((t) => {
          const active = filter === t.key;
          const count =
            t.key === 'ALL'
              ? safeHistory.length
              : safeHistory.filter((h) => h.status === t.key).length;
          return (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-extrabold border press-feedback transition-colors ${
                active
                  ? 'bg-usdt-green/15 text-usdt-green border-usdt-green/30'
                  : 'bg-control-bg/30 text-text-tertiary border-white/5'
              }`}
            >
              {t.label} <span className="font-mono opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {isLoading && safeHistory.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-4 text-text-tertiary text-xs">
          <Loader2 size={13} className="animate-spin" />
          <span>Loading reward history…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-5">
          <Inbox size={18} className="text-text-tertiary mx-auto mb-1.5" />
          <div className="text-[11px] text-text-tertiary">
            {safeHistory.length === 0
              ? 'No claimed rewards yet. Your completions will appear here.'
              : 'No records match this filter.'}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <AnimatePresence mode="popLayout">
            {filtered.map((item, idx) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, height: 0, marginTop: 0, marginBottom: 0, overflow: 'hidden', transition: { duration: 0.18 } }}
                transition={{ delay: Math.min(idx * 0.04, 0.3), duration: 0.25 }}
                className="bg-control-bg/30 border border-white/5 rounded-2xl p-3 flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-base flex-shrink-0">
                  {REWARD_ICONS[item.rewardType] || '🎖️'}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black text-text-primary truncate">
                      {item.ruleName || 'Reward'}
                    </span>
                    <span
                      className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full border flex-shrink-0 ${
                        item.status === 'CLAIMED'
                          ? 'bg-usdt-green/15 text-usdt-green border-usdt-green/25'
                          : 'bg-text-tertiary/10 text-text-tertiary border-white/10'
                      }`}
                    >
                      {item.status === 'CLAIMED' ? 'Claimed' : 'Expired'}
                    </span>
                  </div>
                  <div className="text-[9px] text-text-tertiary mt-0.5">{formatClaimDate(item.claimedAt)}</div>
                  <div className="flex items-center gap-1 mt-1 text-[9px] font-mono text-text-tertiary">
                    <Hash size={8} className="flex-shrink-0" />
                    <span className="truncate">TX {item.transactionReference}</span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="text-xs font-black font-mono text-usdt-green">
                    +{Number(item.amount)?.toFixed(2)} {item.assetCode}
                  </div>
                  <div className="text-[8px] text-text-tertiary uppercase mt-0.5 flex items-center gap-0.5 justify-end">
                    <Activity size={8} /> {item.rewardType}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
