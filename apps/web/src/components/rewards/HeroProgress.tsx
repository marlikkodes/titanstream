import React, { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Flame, Target, TrendingUp, Rocket, ChevronRight, Trophy, Zap, Loader2 } from 'lucide-react';
import { useRewardQueueStore } from '../../store/useRewardQueueStore';
import { useMissionRunnerStore } from '../../store/useMissionRunnerStore';
import { useNavigationStore } from '../../store/useNavigationStore';
import { useTelegram } from '../../context/TelegramContext';
import type { MissionItem } from '../../services/growthService';

interface HeroProgressProps {
  onRunMission?: (mission: MissionItem) => void;
}

const TIER_COLORS: Record<string, string> = {
  NEW: 'text-usdt-green',
  VERIFIED: 'text-sky-400',
  TRUSTED: 'text-gold',
  PREMIUM: 'text-purple-400',
  ELITE: 'text-fuchsia-400',
};

const TAB_LABEL: Record<string, string> = {
  grow: 'Grow Friends',
  wallet: 'Wallet',
  hub: 'Titan Hub',
  shop: 'Shop Machines',
  rewards: 'Rewards Hub',
};

export const HeroProgress: React.FC<HeroProgressProps> = ({ onRunMission }) => {
  const { progress, missions, fetchProgress, isLoading } = useRewardQueueStore();
  const { openRunner } = useMissionRunnerStore();
  const { setActiveTab } = useNavigationStore();
  const { hapticFeedback } = useTelegram();

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  const claimableMission = useMemo(
    () => (progress?.nextBestAction?.type === 'CLAIM' ? missions.find((m) => m.id === progress.nextBestAction?.missionId) || null : null),
    [progress, missions],
  );

  const runMission = (mission: MissionItem) => {
    if (onRunMission) onRunMission(mission);
    else openRunner(mission);
  };

  const handleNextBest = () => {
    hapticFeedback.impactOccurred('medium');
    const action = progress?.nextBestAction;
    if (!action) return;
    if (action.type === 'CLAIM' && claimableMission) {
      runMission(claimableMission);
      return;
    }
    if (action.type === 'COMPLETE_MISSION' && action.missionId) {
      const mission = missions.find((m) => m.id === action.missionId);
      if (mission) {
        runMission(mission);
        return;
      }
    }
    setActiveTab(action.tab as any);
  };

  if (isLoading && !progress) {
    return (
      <div className="web3-card rounded-2xl p-6 flex items-center justify-center gap-2 text-text-tertiary text-xs">
        <Loader2 size={14} className="animate-spin" /> Loading progress…
      </div>
    );
  }

  if (!progress) return null;

  const level = progress.level || { currentLevel: 'NEW', levelName: 'Titan Novice', progressPercent: 0, criteria: [] };
  const streak = progress.streak || { days: 0, best: 0 };
  const totals = progress.totals || { totalClaimed: 0, totalEarned: 0, availableCount: 0, estimatedRemaining: 0 };
  const { nextBestAction, upcomingUnlock, recentAchievements } = progress;

  const currentLevelKey = level.currentLevel || 'NEW';
  const levelColor = TIER_COLORS[currentLevelKey] || 'text-usdt-green';

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="web3-card rounded-2xl p-4 relative overflow-hidden"
    >
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-usdt-green/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-14 -left-10 w-36 h-36 bg-gold/10 rounded-full blur-2xl pointer-events-none" />

      {/* Top row: level + streak */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-usdt-green/10 border border-usdt-green/30 flex items-center justify-center text-usdt-green">
            <Trophy size={20} />
          </div>
          <div>
            <div className="text-[10px] text-text-tertiary uppercase font-extrabold tracking-widest leading-none">
              Titan Progress
            </div>
            <div className="text-base font-black text-text-primary mt-0.5 flex items-center gap-1.5">
              <span className={levelColor}>{level.levelName || 'Titan Miner'}</span>
              <span className="text-[10px] font-mono font-bold text-text-tertiary bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                {level.currentLevel || 'NEW'}
              </span>
            </div>
          </div>
        </div>
        <div className="text-right flex items-center gap-3">
          <div>
            <div className="text-[9px] text-text-tertiary uppercase font-extrabold tracking-widest">Claim Streak</div>
            <div className="text-base font-black font-mono mt-0.5 flex items-center gap-1 justify-end">
              <Flame size={14} className={streak.days > 0 ? 'text-gold' : 'text-text-tertiary'} />
              <span className={streak.days > 0 ? 'text-gold' : 'text-text-tertiary'}>
                {streak.days}
                <span className="text-[9px] ml-0.5">day{streak.days === 1 ? '' : 's'}</span>
              </span>
            </div>
          </div>
          <div>
            <div className="text-[9px] text-text-tertiary uppercase font-extrabold tracking-widest">Best</div>
            <div className="text-base font-black font-mono mt-0.5 text-text-secondary">{streak.best}</div>
          </div>
        </div>
      </div>

      {/* Level progress */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] font-bold text-text-secondary">
          <span>
            {level.nextLevel
              ? `Next: ${level.nextLevel.name}`
              : 'Maximum level reached'}
          </span>
          <span className="font-mono text-usdt-green">{level.progressPercent}%</span>
        </div>
        <div className="mt-1.5 w-full h-2 bg-control-bg rounded-full overflow-hidden p-0.5 border border-white/5">
          <motion.div
            className={`h-full rounded-full ${level.progressPercent >= 100 ? 'bg-usdt-green' : 'bg-gradient-to-r from-usdt-green to-gold'}`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, level.progressPercent)}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        {level.nextLevel && Array.isArray(level.criteria) && (
          <div className="mt-2 grid grid-cols-3 gap-1.5 text-[9px] font-semibold">
            {level.criteria.map((c) => (
              <div
                key={c.key}
                className={`bg-control-bg/30 border rounded-lg px-2 py-1 text-center ${
                  c.met ? 'border-usdt-green/25 text-usdt-green' : 'border-white/5 text-text-tertiary'
                }`}
              >
                <div className="uppercase font-extrabold tracking-wider text-[8px]">{c.label}</div>
                <div className="font-mono font-bold mt-0.5">
                  {Math.floor(c.current)}/{c.required}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Totals row */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <div className="bg-control-bg/40 rounded-xl p-2 text-center border border-white/5">
          <div className="text-[9px] text-text-tertiary uppercase font-extrabold">Claimed</div>
          <div className="text-sm font-black font-mono text-text-primary mt-0.5">{totals.totalClaimed}</div>
        </div>
        <div className="bg-control-bg/40 rounded-xl p-2 text-center border border-white/5">
          <div className="text-[9px] text-text-tertiary uppercase font-extrabold">Earned</div>
          <div className="text-sm font-black font-mono text-usdt-green mt-0.5">
            {totals.totalEarned.toFixed(2)} <span className="text-[8px]">USDT</span>
          </div>
        </div>
        <div className="bg-control-bg/40 rounded-xl p-2 text-center border border-white/5">
          <div className="text-[9px] text-text-tertiary uppercase font-extrabold">Ready</div>
          <div className="text-sm font-black font-mono text-gold mt-0.5">
            {totals.availableCount}
            {totals.estimatedRemaining > 0 && (
              <span className="text-[8px] text-text-tertiary ml-1">+{totals.estimatedRemaining.toFixed(2)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Next best action */}
      {nextBestAction && (
        <button
          onClick={handleNextBest}
          className="mt-3 w-full flex items-center gap-3 bg-gradient-to-r from-usdt-green/15 to-gold/10 border border-usdt-green/30 rounded-2xl p-3 text-left press-feedback"
        >
          <div className="w-9 h-9 rounded-xl bg-usdt-green/15 border border-usdt-green/30 flex items-center justify-center text-usdt-green flex-shrink-0">
            {nextBestAction.type === 'CLAIM' ? <Zap size={16} /> : <Rocket size={16} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-usdt-green font-black uppercase tracking-widest">Next Best Action</div>
            <div className="text-xs font-black text-text-primary truncate">{nextBestAction.title}</div>
            <div className="text-[9px] text-text-secondary line-clamp-1">{nextBestAction.message}</div>
          </div>
          <ChevronRight size={16} className="text-usdt-green flex-shrink-0" />
        </button>
      )}

      {/* Upcoming unlock */}
      {upcomingUnlock && (
        <div className="mt-2.5 bg-control-bg/30 border border-white/5 rounded-xl p-2.5">
          <div className="text-[9px] text-text-tertiary uppercase font-extrabold tracking-wider flex items-center gap-1">
            <Target size={9} className="text-sky-400" /> Almost there
          </div>
          <div className="text-[10px] font-black text-text-primary mt-1 truncate">{upcomingUnlock.name}</div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <div className="flex-1 h-1 bg-control-bg rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-400 rounded-full"
                style={{ width: `${Math.min(100, upcomingUnlock.progressPercent)}%` }}
              />
            </div>
            <span className="text-[8px] font-mono text-sky-400 font-bold">{upcomingUnlock.progressPercent}%</span>
          </div>
          <div className="text-[8px] text-text-tertiary font-mono mt-1 truncate">
            {upcomingUnlock.estimatedRemaining}
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5 mt-3 text-[9px] text-text-tertiary">
        <Target size={10} className="text-usdt-green" />
        <span>
          {nextBestAction ? `${TAB_LABEL[nextBestAction.tab] || nextBestAction.tab} · ` : ''}
          Tap to continue your journey
        </span>
      </div>
    </motion.div>
  );
};
