import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
  Minus,
  Loader2,
  Target,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Copy,
  Check,
  Share2,
  Zap,
} from 'lucide-react';
import type { MissionItem } from '../../services/growthService';
import { useRewardQueueStore } from '../../store/useRewardQueueStore';
import { useNavigationStore } from '../../store/useNavigationStore';
import { useTelegram } from '../../context/TelegramContext';
import { showToast } from '../Toast';

interface MissionRunnerProps {
  mission: MissionItem | null;
  isOpen: boolean;
  onClose: () => void;
  onClaimed: (reward: MissionItem) => void;
}

const TAB_LABEL: Record<string, string> = {
  friends: 'Invite Friends',
  wallet: 'Wallet',
  mine: 'Mining',
  boost: 'Cloud Machines',
  growth: 'Growth Hub',
  rewards: 'Rewards',
};

const ACTION_HINT: Record<string, string> = {
  REFERRAL_QUALIFIED: 'Invite a friend, guide them through onboarding and a first settlement.',
  REFERRAL_PAYING: 'Your friend must complete their first payment.',
  SETTLEMENT_COUNT: 'Complete a settlement from the wallet screen.',
  MACHINE_CAPACITY: 'Purchase and activate a mining machine.',
  USER_LEVEL: 'Grow your trust score and settlement history to rank up.',
};

export const MissionRunner: React.FC<MissionRunnerProps> = ({ mission, isOpen, onClose, onClaimed }) => {
  const { missions, fetchMissions, autoClaim, isClaiming, claimingId } = useRewardQueueStore();
  const { setActiveTab } = useNavigationStore();
  const { hapticFeedback } = useTelegram();
  const [minimized, setMinimized] = useState(false);
  const [copied, setCopied] = useState(false);
  const [autoClaimed, setAutoClaimed] = useState(false);
  const claimedForRef = useRef<string | null>(null);

  const liveMission = useMemo(() => {
    if (!mission) return null;
    const match = mission.id.startsWith('rule:')
      ? missions.find((m) => m.ruleCode && m.ruleCode === mission.ruleCode)
      : missions.find((m) => m.id === mission.id);
    return match || mission;
  }, [mission, missions]);

  useEffect(() => {
    if (isOpen) {
      setMinimized(false);
      setAutoClaimed(false);
      claimedForRef.current = null;
      hapticFeedback.impactOccurred('light');
      const tab = liveMission?.requirement?.actionTab || 'rewards';
      if (tab !== 'rewards') setActiveTab(tab as any);
    }
  }, [isOpen, mission?.id]);

  // Live progress polling — the runner escorts the user while they act.
  useEffect(() => {
    if (!isOpen) return;
    const poll = setInterval(() => {
      fetchMissions();
    }, 4000);
    return () => clearInterval(poll);
  }, [isOpen, fetchMissions]);

  // Auto-claim the instant the requirement is met (fires exactly once per mission).
  useEffect(() => {
    if (!isOpen || !liveMission || autoClaimed) return;
    if (!liveMission.eligible || liveMission.status === 'CLAIM_PENDING' || liveMission.status === 'CLAIMED') return;
    if (claimedForRef.current === liveMission.id) return;

    claimedForRef.current = liveMission.id;
    setAutoClaimed(true);
    hapticFeedback.notificationOccurred('success');
    autoClaim(liveMission.id)
      .then((res) => {
        if (res.success && res.reward) {
          showToast(`Mission complete — ${Number(res.reward?.amount)?.toFixed(2)} USDT claimed!`, 'success');
          onClaimed({ ...liveMission, status: 'CLAIMED' });
          onClose();
        } else if (res.error) {
          showToast(res.error, 'error');
        }
      })
      .catch((err: any) => {
        console.warn('Auto-claim error:', err);
      });
  }, [
    isOpen,
    liveMission?.id,
    liveMission?.eligible,
    liveMission?.status,
    autoClaimed,
    autoClaim,
    onClaimed,
    onClose,
  ]);

  if (!isOpen || !liveMission) return null;

  const requirement = liveMission.requirement;
  const progressPct = requirement
    ? Math.min(100, (requirement.current / Math.max(1, requirement.required)) * 100)
    : 100;
  const isEligible = !!liveMission.eligible;
  const isProcessing = isEligible && (liveMission.status === 'CLAIM_PENDING' || (claimingId === liveMission.id && isClaiming));
  const tab = requirement?.actionTab || 'rewards';
  const missionAmt = liveMission.amount ?? liveMission.rewardAmount ?? '0.50';
  const missionAsset = liveMission.assetCode || 'USDT';
  const shareText = `🚀 TITAN MISSION 🚀\nI'm completing the "${liveMission.ruleName || liveMission.title || 'Mission'}" on Titan Stream — ${missionAmt} ${missionAsset} on the line!\nJoin me: https://t.me/tetherstream_bot`;

  const handleNavigate = () => {
    hapticFeedback.impactOccurred('light');
    setActiveTab(tab as any);
  };

  const handleCopyShare = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    showToast('Mission share link copied!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleManualClaim = async () => {
    hapticFeedback.impactOccurred('medium');
    
    // Check eligibility before attempting claim
    if (!isEligible) {
      showToast('Mission requirement not yet completed. Complete the requirement first.', 'error');
      onClose();
      return;
    }
    
    const res = await autoClaim(liveMission.id);
    if (res.success && res.reward) {
      onClaimed({ ...liveMission, status: 'CLAIMED' });
      onClose();
    } else {
      showToast(res.error || 'Claim failed. Please try again.', 'error');
    }
  };

  return (
    <AnimatePresence>
      {minimized ? (
        <motion.button
          key="runner-min"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          onClick={() => setMinimized(false)}
          className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-md bg-gradient-to-r from-usdt-green/20 to-gold/10 border border-usdt-green/40 rounded-2xl p-3 flex items-center gap-2.5 shadow-2xl shadow-usdt-green/20 press-feedback"
        >
          <Loader2 size={14} className="animate-spin text-usdt-green flex-shrink-0" />
          <div className="flex-1 min-w-0 text-left">
            <div className="text-[10px] font-black text-text-primary truncate">{liveMission.ruleName}</div>
            <div className="text-[8px] text-usdt-green font-mono">{progressPct}% — running in background</div>
          </div>
          <div className="w-20 h-1.5 bg-control-bg rounded-full overflow-hidden flex-shrink-0">
            <motion.div
              className="h-full bg-usdt-green"
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </motion.button>
      ) : (
        <motion.div
          key="runner"
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-md web3-card rounded-3xl border border-usdt-green/40 p-4 shadow-2xl shadow-usdt-green/25"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-usdt-green/15 border border-usdt-green/30 flex items-center justify-center">
                {isEligible || isProcessing ? <Zap size={14} className="text-usdt-green" /> : <Target size={14} className="text-sky-400" />}
              </div>
              <div>
                <div className="text-[9px] text-text-tertiary uppercase font-extrabold tracking-widest leading-none">
                  Mission Runner
                </div>
                <div className="text-xs font-black text-text-primary mt-0.5 truncate max-w-[200px]">
                  {liveMission.ruleName || 'Mission'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setMinimized(true)} className="p-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10">
                <Minus size={13} />
              </button>
              <button onClick={onClose} className="p-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10">
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Reward */}
          <div className="mt-3 flex items-center justify-between bg-control-bg/40 border border-white/5 rounded-xl px-3 py-2">
            <span className="text-[10px] text-text-secondary">{liveMission.description}</span>
            <span className="text-xs font-black font-mono text-usdt-green flex-shrink-0 ml-2">
              +{Number(liveMission.amount ?? liveMission.rewardAmount ?? 0.50).toFixed(2)} {liveMission.assetCode || 'USDT'}
            </span>
          </div>

          {/* Live progress */}
          <div className="mt-2.5">
            <div className="flex items-center justify-between text-[10px] font-bold">
              <span className="text-text-secondary uppercase tracking-wider font-extrabold text-[9px]">Requirement</span>
              <span className="font-mono text-sky-400">
                {requirement ? `${requirement.current}/${requirement.required} ${requirement.unit}` : 'Complete'}
              </span>
            </div>
            <div className="mt-1.5 w-full h-2 bg-control-bg rounded-full overflow-hidden p-0.5 border border-white/5">
              <motion.div
                className={`h-full rounded-full ${progressPct >= 100 ? 'bg-usdt-green' : 'bg-sky-400'}`}
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            {requirement && !requirement.completed && (
              <div className="mt-1 text-[9px] text-text-tertiary font-mono flex items-center justify-between">
                <span>{requirement.current >= requirement.required ? 'Requirement met — claiming…' : liveMission.estimatedRemaining}</span>
                <span className="flex items-center gap-0.5">
                  <Loader2 size={8} className="animate-spin" /> live
                </span>
              </div>
            )}
          </div>

          {/* Hint + action */}
          {!isEligible && (
            <div className="mt-2.5 flex items-start gap-2 bg-white/[0.03] border border-white/5 rounded-xl p-2.5">
              <Sparkles size={12} className="text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-[10px] text-text-secondary leading-relaxed">
                {ACTION_HINT[requirement?.key || ''] || liveMission.reason || 'Complete the requirement to claim.'}
                {tab !== 'rewards' && (
                  <button onClick={handleNavigate} className="ml-1 text-usdt-green font-bold underline underline-offset-2">
                    Open {TAB_LABEL[tab] || tab}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Referral share shortcut */}
          {liveMission.rewardType === 'REFERRAL' && !isEligible && (
            <button
              onClick={handleCopyShare}
              className="mt-2 w-full py-2 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 text-[10px] font-extrabold flex items-center justify-center gap-1.5 press-feedback"
            >
              {copied ? <Check size={11} /> : <Share2 size={11} />}
              {copied ? 'Invite link copied!' : 'Copy invite link to share'}
            </button>
          )}

          {/* Actions */}
          <div className="mt-3 flex gap-2">
            {isEligible && (
              <button
                disabled={isProcessing || isClaiming}
                onClick={handleManualClaim}
                className="flex-1 py-2.5 rounded-xl bg-usdt-green text-app-bg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 press-feedback disabled:opacity-60"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={11} className="animate-spin" /> Claiming…
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={11} /> Claim Now
                  </>
                )}
              </button>
            )}
            {!isEligible && tab !== 'rewards' && (
              <button
                onClick={handleNavigate}
                className="flex-1 py-2.5 rounded-xl bg-control-bg border border-white/10 text-[10px] font-extrabold text-text-primary flex items-center justify-center gap-1 press-feedback"
              >
                Complete requirement <ArrowRight size={10} />
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-control-bg/40 border border-white/5 text-[10px] font-bold text-text-secondary press-feedback"
            >
              Later
            </button>
          </div>

          {/* Auto-claim notice */}
          {!isEligible && requirement && (
            <div className="mt-2 text-center text-[8px] text-text-tertiary font-mono flex items-center justify-center gap-1">
              <Zap size={8} className="text-gold" />
              Auto-claims the moment your requirement completes
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
