import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Loader2, Target, Sparkles, Wallet, TrendingUp, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import type { RewardQueueItem } from '../../services/growthService';
import { useRewardQueueStore } from '../../store/useRewardQueueStore';
import { useNavigationStore } from '../../store/useNavigationStore';
import { useTelegram } from '../../context/TelegramContext';
import { showToast } from '../Toast';

interface ClaimFlowModalProps {
  reward: RewardQueueItem | null;
  isOpen: boolean;
  onClose: () => void;
  onClaimed: (reward: RewardQueueItem) => void;
}

const ACTION_TAB_LABEL: Record<string, string> = {
  friends: 'Invite Friends',
  wallet: 'Open Wallet',
  mine: 'Open Mining',
  boost: 'Open Cloud Machines',
  growth: 'Open Growth Hub',
};

export const ClaimFlowModal: React.FC<ClaimFlowModalProps> = ({ reward, isOpen, onClose, onClaimed }) => {
  const { claimReward, isClaiming, refreshAfterClaim } = useRewardQueueStore();
  const { setActiveTab } = useNavigationStore();
  const { hapticFeedback } = useTelegram();
  const [claimError, setClaimError] = React.useState<string | null>(null);

  if (!reward) return null;

  const requirement = reward.requirement;
  const progressPct = requirement
    ? Math.min(100, (requirement.current / Math.max(1, requirement.required)) * 100)
    : 100;
  const remaining = requirement ? Math.max(0, requirement.required - requirement.current) : 0;
  const actionTab = (requirement?.actionTab || 'friends') as 'friends' | 'boost' | 'mine' | 'treasury' | 'wallet' | 'growth';

  const handleNavigateToRequirement = () => {
    hapticFeedback.impactOccurred('light');
    setActiveTab(actionTab);
    onClose();
    showToast(`Complete the requirement in ${ACTION_TAB_LABEL[actionTab] || 'the app'} — your reward is reserved.`, 'info');
  };

  const handleClaim = async () => {
    setClaimError(null);
    hapticFeedback.impactOccurred('medium');
    const result = await claimReward(reward.id);
    if (result.success) {
      hapticFeedback.notificationOccurred('success');
      await refreshAfterClaim(reward.id);
      onClaimed(reward);
    } else {
      hapticFeedback.notificationOccurred('error');
      setClaimError(result.error || 'Claim failed. Please try again.');
      showToast(result.error || 'Claim failed. Please try again.', 'error');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div role="dialog" aria-modal="true" aria-label="Claim reward" className="fixed inset-0 z-50 flex items-center justify-center rewards-modal-backdrop p-4 overflow-y-auto">
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-sm rewards-modal-surface border border-usdt-green/40 rounded-3xl p-6 space-y-4 text-text-primary my-auto max-h-[calc(100dvh-2rem)] overflow-y-auto no-scrollbar"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target size={18} className="text-usdt-green" />
                <h3 className="text-sm font-black uppercase tracking-wider">Claim Reward</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>

            {/* Reward summary */}
            <div className="rounded-2xl p-4 border border-usdt-green/40 bg-gradient-to-br from-usdt-green/15 via-black to-control-bg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-black text-text-primary">{reward.ruleName || 'Reward'}</div>
                  <div className="text-[10px] text-text-secondary mt-0.5">{reward.description}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 bg-usdt-green/10 border border-usdt-green/25 rounded-xl p-2.5">
                <Wallet size={14} className="text-usdt-green" />
                <span className="text-xs text-text-secondary">You receive</span>
                <span className="ml-auto text-sm font-black font-mono text-usdt-green">
                  +{Number(reward.amount)?.toFixed(2)} {reward.assetCode}
                </span>
              </div>
            </div>

            {/* What is required */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-text-secondary">
                <Target size={12} className="text-sky-400" />
                What is required
              </div>
              <div className="bg-control-bg/30 border border-white/5 rounded-xl p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-primary font-bold">
                    {requirement ? `${requirement.label} (${requirement.current}/${requirement.required})` : 'Requirement met'}
                  </span>
                  {requirement && requirement.completed && (
                    <CheckCircle2 size={14} className="text-usdt-green" />
                  )}
                </div>
                {requirement && (
                  <div className="mt-2 w-full h-1.5 bg-control-bg rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${progressPct >= 100 ? 'bg-usdt-green' : 'bg-sky-400'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                )}
                {requirement && !requirement.completed && (
                  <div className="mt-1.5 text-[9px] text-text-tertiary font-mono">
                    {remaining} more {requirement.unit} needed
                  </div>
                )}
              </div>

              {/* Why they qualify */}
              <div className="flex items-start gap-2 bg-white/[0.03] border border-white/5 rounded-xl p-3">
                <Sparkles size={13} className="text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-text-secondary mb-0.5">
                    Why you qualify
                  </div>
                  <div className="text-[11px] text-text-secondary leading-relaxed">{reward.reason || 'Requirement unlocked.'}</div>
                </div>
              </div>
            </div>

            {/* Error state — card is never removed on failure */}
            {claimError && (
              <div className="flex items-center gap-2 bg-error-red/10 border border-error-red/30 rounded-xl p-2.5 text-[11px] text-error-red">
                <AlertCircle size={14} className="flex-shrink-0" />
                <span>{claimError}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <button
                disabled={isClaiming || reward.status === 'CLAIM_PENDING' || (requirement ? !requirement.completed : false)}
                onClick={handleClaim}
                className="w-full py-3 rounded-2xl bg-usdt-green text-app-bg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-usdt-green/20 press-feedback disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isClaiming || reward.status === 'CLAIM_PENDING' ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Processing…
                  </>
                ) : (
                  <>
                    <TrendingUp size={14} /> Claim Reward
                  </>
                )}
              </button>

              {requirement && !requirement.completed && (
                <button
                  onClick={handleNavigateToRequirement}
                  className="w-full py-2.5 rounded-2xl bg-control-bg border border-white/10 text-xs font-bold text-text-primary flex items-center justify-center gap-1 hover:border-usdt-green/30 press-feedback"
                >
                  Complete requirement <ArrowRight size={12} />
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
