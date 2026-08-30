import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Trophy, Loader2, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import { useRewardQueueStore } from '../../store/useRewardQueueStore';

const TIER_STYLE: Record<string, { border: string; text: string; glow: string }> = {
  BRONZE: { border: 'border-amber-700/40', text: 'text-amber-600', glow: 'shadow-[0_0_18px_rgba(180,83,9,0.25)]' },
  SILVER: { border: 'border-slate-400/40', text: 'text-slate-300', glow: 'shadow-[0_0_18px_rgba(148,163,184,0.25)]' },
  GOLD: { border: 'border-gold/50', text: 'text-gold', glow: 'shadow-[0_0_22px_rgba(255,179,0,0.3)]' },
  PLATINUM: { border: 'border-cyan-300/40', text: 'text-cyan-300', glow: 'shadow-[0_0_22px_rgba(103,232,249,0.3)]' },
  DIAMOND: { border: 'border-fuchsia-400/50', text: 'text-fuchsia-400', glow: 'shadow-[0_0_26px_rgba(232,121,249,0.35)]' },
};

export const AchievementsCabinet: React.FC = () => {
  const { achievements, totalAchievementsUnlocked, totalAchievements, fetchAchievements, isLoading } = useRewardQueueStore();
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    fetchAchievements();
  }, [fetchAchievements]);

  // Sort achievements: achieved first, then by tier, then by progress
  const safeAchievements = Array.isArray(achievements) ? achievements : [];
  const sortedAchievements = [...safeAchievements].sort((a, b) => {
    if (a.achieved !== b.achieved) {
      return a.achieved ? -1 : 1;
    }
    // If both achieved or both not achieved, sort by tier
    const tierOrder = ['DIAMOND', 'PLATINUM', 'GOLD', 'SILVER', 'BRONZE'];
    const idxA = tierOrder.indexOf((a.tier || '').toUpperCase());
    const idxB = tierOrder.indexOf((b.tier || '').toUpperCase());
    const tierA = idxA === -1 ? 99 : idxA;
    const tierB = idxB === -1 ? 99 : idxB;
    if (tierA !== tierB) {
      return tierA - tierB;
    }
    // Finally sort by progress (descending)
    return (b.progress || 0) - (a.progress || 0);
  });

  const unlocked = sortedAchievements.filter((a) => a.achieved);

  return (
    <div className="web3-card rounded-2xl p-4 relative overflow-hidden space-y-3">
      <div
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex items-center justify-between border-b border-white/5 pb-2 cursor-pointer select-none hover:opacity-90 transition-opacity"
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-1.5">
          <Trophy size={16} className="text-gold" />
          <h2 className="text-xs font-black uppercase text-text-primary tracking-widest">ACHIEVEMENTS</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold text-gold bg-gold/10 border border-gold/20 px-2 py-0.5 rounded-full">
            {isLoading ? 'Syncing…' : `${totalAchievementsUnlocked}/${totalAchievements}`}
          </span>
          <div className="p-1 rounded-full bg-white/5 border border-white/10">
            {isExpanded ? <ChevronUp size={12} className="text-text-tertiary" /> : <ChevronDown size={12} className="text-text-tertiary" />}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            {isLoading && safeAchievements.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-5 text-text-tertiary text-xs">
                <Loader2 size={13} className="animate-spin" /> Loading cabinet…
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {sortedAchievements.map((a) => {
                  const style = TIER_STYLE[a.tier] || TIER_STYLE.BRONZE;
                  const pct = Math.min(100, ((a.progress || 0) / Math.max(1, a.target || 1)) * 100);
                  return (
                    <div
                      key={a.code}
                      className={`relative rounded-2xl border p-2.5 text-center flex flex-col items-center justify-between min-h-[96px] transition-all ${
                        a.achieved
                          ? `bg-gradient-to-b from-white/[0.05] to-transparent ${style.border} ${style.glow}`
                          : 'border-white/5 bg-control-bg/20 opacity-60'
                      }`}
                    >
                      <div className="flex flex-col items-center w-full">
                        <div className={`text-2xl ${a.achieved ? '' : 'grayscale opacity-75'}`}>{a.icon || '🏅'}</div>
                        <div className={`mt-1 text-[9px] font-black uppercase tracking-wide leading-tight line-clamp-1 w-full ${a.achieved ? 'text-text-primary' : 'text-text-tertiary'}`}>
                          {a.name}
                        </div>
                      </div>
                      
                      <div className="w-full flex flex-col items-center mt-1">
                        {a.achieved ? (
                          <div className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-white/5 border ${style.border} ${style.text}`}>
                            {a.tier}
                          </div>
                        ) : (
                          <>
                            <div className="w-full h-1 bg-control-bg rounded-full overflow-hidden">
                              <div className="h-full bg-sky-400/70 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <div className="flex items-center justify-center gap-1 text-[8px] text-text-tertiary font-mono mt-0.5">
                              <Lock size={8} className="text-text-tertiary" />
                              <span>{a.progress || 0}/{a.target}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {unlocked.length > 0 && (
        <div className="flex items-center gap-1.5 text-[9px] text-text-tertiary">
          <Trophy size={10} className="text-gold" />
          <span>
            {unlocked.slice(0, 3).map((a) => a.name).join(' · ')}
            {unlocked.length > 3 ? ` +${unlocked.length - 3} more` : ''}
          </span>
        </div>
      )}
    </div>
  );
};
