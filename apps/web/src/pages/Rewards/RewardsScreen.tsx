import type React from 'react';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Info, Gift, Trophy, Sparkles, Award, ChevronRight, Zap, CheckCircle2 } from 'lucide-react';
import { useGrowthStore } from '../../store/useGrowthStore';
import { useNavigationStore } from '../../store/useNavigationStore';
import { RewardQueue } from '../../components/rewards/RewardQueue';
import { HeroProgress } from '../../components/rewards/HeroProgress';
import { AchievementsCabinet } from '../../components/rewards/AchievementsCabinet';
import { RewardHistorySection } from '../../components/rewards/RewardHistorySection';
import { DestinationLoader } from '../../components/DestinationLoader';
import { useMachineOwnershipStore } from '../../store/useMachineOwnershipStore';

export const RewardsScreen: React.FC = () => {
  const { dashboardData, fetchDashboardData } = useGrowthStore();
  const seasonProgress = dashboardData?.seasonProgress || {
    seasonNumber: 1,
    seasonTitle: 'Treasury Expansion',
    daysRemaining: 18,
    seasonTargetPower: 10000,
    seasonProgressPower: 0,
  };

  const { setActiveTab } = useNavigationStore();
  const ownerships = useMachineOwnershipStore((s) => s.ownerships);
  const activeMachines = Object.values(ownerships || {}).filter(
    (m) => m.status === 'RUNNING' || m.lifecycleStage === 'RUNNING',
  );
  const hasActiveMachine = activeMachines.length > 0;

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return (
    <div className="p-4 flex flex-col gap-5 select-none relative pb-28 bg-[#0c0814] min-h-full">
      {/* DESTINATION HEADER — Career Progression & Recognition */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-gold font-mono">
            Career Progression
          </span>
          <h1 className="text-2xl font-black text-text-primary tracking-tight">Rewards Hub</h1>
        </div>

        <div className="w-10 h-10 rounded-2xl bg-gold/15 border border-gold/30 text-gold flex items-center justify-center font-bold">
          <Gift size={22} />
        </div>
      </div>

      {/* HERO SECTION — Season 1 Progress Ring & Level (60% Focal Point) */}
      <HeroProgress />

      {/* CROSS-PAGE CONTINUITY BANNER (No Dead Ends) */}
      {hasActiveMachine ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setActiveTab('hub')}
          className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-between cursor-pointer hover:border-purple-500/50 transition-colors press-feedback"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
              <Zap size={16} />
            </div>
            <div>
              <div className="text-xs font-black text-text-primary">
                {activeMachines[0]?.nickname || 'Titan Core Prime'} • Active
              </div>
              <div className="text-[10px] text-text-secondary">
                Hardware core running. Telemetry and milestones synchronized with Titan Hub.
              </div>
            </div>
          </div>
          <ChevronRight size={16} className="text-purple-400" />
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setActiveTab('shop')}
          className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between cursor-pointer hover:border-amber-500/50 transition-colors press-feedback"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Zap size={16} />
            </div>
            <div>
              <div className="text-xs font-black text-text-primary">
                No Active Hardware Core
              </div>
              <div className="text-[10px] text-text-secondary">
                Acquire or activate a machine to unlock automated compute yield milestones.
              </div>
            </div>
          </div>
          <ChevronRight size={16} className="text-amber-400" />
        </motion.div>
      )}

      {/* MISSIONS & CLAIM QUEUE */}
      <RewardQueue />

      {/* ACHIEVEMENTS CABINET (30% Supporting Content) */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <AchievementsCabinet />
      </motion.div>

      {/* SEASONS PROGRESS & UPCOMING UNLOCKS (10% Discovery) */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="web3-card-gold rounded-2xl p-4 relative overflow-hidden"
      >
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
          <div className="flex items-center gap-1.5">
            <Calendar size={16} className="text-gold" />
            <h2 className="text-xs font-black uppercase text-text-primary tracking-widest">
              Season {seasonProgress.seasonNumber} • {seasonProgress.seasonTitle}
            </h2>
          </div>
          <span className="text-[10px] font-bold text-gold bg-gold/10 border border-gold/20 px-2.5 py-0.5 rounded-full font-mono">
            {seasonProgress.daysRemaining} Days Left
          </span>
        </div>

        <div className="flex flex-col gap-3.5">
          <div className="flex justify-between items-center text-xs">
            <div>
              <div className="text-text-secondary">Season Growth Points</div>
              <div className="text-sm font-black text-text-primary font-mono mt-1">
                {seasonProgress.seasonProgressPower.toLocaleString()} / {seasonProgress.seasonTargetPower.toLocaleString()}
              </div>
            </div>
            <div className="text-right">
              <div className="text-text-secondary">Season Status</div>
              <div className="text-xs font-black text-gold font-mono mt-1">
                ACTIVE
              </div>
            </div>
          </div>

          <div className="w-full h-2.5 bg-control-bg rounded-full overflow-hidden p-0.5 border border-white/5">
            <div
              className="h-full bg-gradient-to-r from-gold to-gold-bright rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(255,179,0,0.4)]"
              style={{ width: `${seasonProgress.seasonTargetPower > 0 ? (seasonProgress.seasonProgressPower / seasonProgress.seasonTargetPower) * 100 : 0}%` }}
            />
          </div>

          <div className="flex items-center gap-2 bg-white/[0.02] border border-white/5 rounded-xl p-3 text-xs text-text-secondary">
            <Info size={15} className="text-gold flex-shrink-0" />
            <span>
              All your levels and verified milestones carry over to the next season automatically.
            </span>
          </div>
        </div>
      </motion.div>

      {/* REWARD HISTORY SECTION */}
      <RewardHistorySection />
    </div>
  );
};
