import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGrowthStore } from '../store/useGrowthStore';
import { useRewardQueueStore } from '../store/useRewardQueueStore';
import { useNavigationStore } from '../store/useNavigationStore';
import { 
  Zap, 
  ArrowRight, 
  Sparkles, 
  Gift, 
  ShieldCheck, 
  Wallet, 
  Users, 
  Layers, 
  Cpu
} from 'lucide-react';
import { CurrencyDisplay } from './DualCurrencyDisplay';

interface NextBestActionCardProps {
  compact?: boolean;
  className?: string;
  onlyIfRewards?: boolean;
}

export const NextBestActionCard: React.FC<NextBestActionCardProps> = ({
  compact = false,
  className = '',
  onlyIfRewards = false,
}) => {
  const { nextBestAction, fetchNextBestAction } = useGrowthStore();
  const { missions, queue, fetchMissions } = useRewardQueueStore();
  const { setActiveTab } = useNavigationStore();

  useEffect(() => {
    fetchNextBestAction();
    fetchMissions();
  }, [fetchNextBestAction, fetchMissions]);

  if (!nextBestAction) return null;

  const claimableMissions = Array.isArray(missions)
    ? missions.filter((m) => m.eligible && m.status !== 'CLAIMED')
    : [];
  const claimableQueue = Array.isArray(queue)
    ? queue.filter((r) => r.status === 'AVAILABLE')
    : [];
  const hasClaimableRewards = claimableMissions.length > 0 || claimableQueue.length > 0;

  // Strict guard: only appear when there are real rewards to claim
  if (onlyIfRewards && !hasClaimableRewards) {
    return null;
  }

  if (nextBestAction.actionType === 'CLAIM_REWARD' && !hasClaimableRewards) {
    return null;
  }

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'CLAIM_REWARD':
        return <Gift size={18} className="text-gold" />;
      case 'COMPLETE_ONBOARDING':
        return <ShieldCheck size={18} className="text-cyan-400" />;
      case 'EXECUTE_FIRST_SETTLEMENT':
      case 'FUND_ACCOUNT':
        return <Wallet size={18} className="text-usdt-green" />;
      case 'EXPLORE_MACHINES':
      case 'EXPAND_FLEET':
        return <Cpu size={18} className="text-purple-400" />;
      case 'INVITE_FRIENDS':
        return <Users size={18} className="text-cyan-400" />;
      default:
        return <Zap size={18} className="text-cyan-400" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      case 'HIGH':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'MEDIUM':
        return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
      default:
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    }
  };

  const handleAction = () => {
    if (nextBestAction.destinationTab) {
      setActiveTab(nextBestAction.destinationTab);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl p-4 bg-gradient-to-r from-[#081825] via-card-bg to-[#08131d] border border-cyan-500/30 shadow-lg relative overflow-hidden space-y-3 ${className}`}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* HEADER: BADGE & PRIORITY */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1">
            <Sparkles size={12} className="text-cyan-400" />
            RECOMMENDED NEXT STEP
          </span>
          {nextBestAction.badge && (
            <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/10 text-text-primary border border-white/10">
              {nextBestAction.badge}
            </span>
          )}
        </div>

        <span className={`text-[9px] font-mono font-extrabold px-2 py-0.5 rounded-full border uppercase ${getPriorityBadge(nextBestAction.priority)}`}>
          {nextBestAction.priority}
        </span>
      </div>

      {/* CONTENT & DESCRIPTION */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
          {getActionIcon(nextBestAction.actionType)}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-black text-text-primary tracking-tight">
            {nextBestAction.title}
          </h4>
          <p className="text-[11px] text-text-secondary leading-relaxed mt-0.5">
            {nextBestAction.description}
          </p>
        </div>
      </div>

      {/* UNLOCK VALUE & CTA BUTTON */}
      <div className="flex items-center justify-between pt-1 border-t border-white/5 text-xs">
        <div className="text-[10px] font-mono text-text-tertiary">
          Potential Economic Value:{' '}
          <strong className="text-usdt-green font-black font-sans">
            +${(Number(nextBestAction?.potentialUnlockUsdt) || 0).toFixed(2)} USDT
          </strong>
        </div>

        <button
          onClick={handleAction}
          className="py-1.5 px-3.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 font-bold hover:bg-cyan-500/25 transition-colors press-feedback flex items-center gap-1.5 text-xs font-mono"
        >
          <span>Take Action</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </motion.div>
  );
};
