import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Gift, Loader2, ChevronRight, Rocket, Target, Lock } from 'lucide-react';
import { useRewardQueueStore } from '../../store/useRewardQueueStore';
import { useMissionRunnerStore } from '../../store/useMissionRunnerStore';
import { useWalletStore } from '../../store/useWalletStore';
import type { MissionItem } from '../../services/growthService';
import { ClaimSuccessModal } from './ClaimSuccessModal';

const REWARD_TYPE_META: Record<string, { icon: string; color: string }> = {
  REFERRAL: { icon: '👥', color: 'text-sky-400' },
  MILESTONE: { icon: '🏆', color: 'text-amber-400' },
  LOYALTY: { icon: '🎁', color: 'text-purple-400' },
  CAMPAIGN: { icon: '📣', color: 'text-pink-400' },
};

const CATEGORY_LABEL: Record<string, string> = {
  referral: 'Referral',
  settlement: 'Settlement',
  machine: 'Machine',
  profile: 'Profile',
  campaign: 'Campaign',
};

const DIFFICULTY_STYLE: Record<string, string> = {
  EASY: 'text-usdt-green bg-usdt-green/10 border-usdt-green/25',
  MEDIUM: 'text-gold bg-gold/10 border-gold/25',
  HARD: 'text-error-red bg-error-red/10 border-error-red/25',
};

const getTypeMeta = (type: string) => REWARD_TYPE_META[type] || REWARD_TYPE_META.MILESTONE;

interface RewardQueueProps {
  compact?: boolean;
}

export const RewardQueue: React.FC<RewardQueueProps> = ({ compact = false }) => {
  const { missions, isLoading, fetchMissions } = useRewardQueueStore();
  const { openRunner } = useMissionRunnerStore();
  const [claimed, setClaimed] = useState<MissionItem | null>(null);

  useEffect(() => {
    fetchMissions();
  }, [fetchMissions]);

  const handleClaimSuccess = (reward: MissionItem) => {
    setClaimed(reward);
    useWalletStore.getState().fetchBalanceFromEngine();
  };

  const safeMissions = (Array.isArray(missions) ? missions : []).filter((m) => m.status !== 'CLAIMED');
  const claimableCount = safeMissions.filter((m) => m.eligible).length;

  return (
    <>
      <div className="web3-card rounded-2xl p-4 relative overflow-hidden space-y-3">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-1.5">
            <Gift size={16} className="text-usdt-green" />
            <h2 className="text-xs font-black uppercase text-text-primary tracking-widest">MISSIONS</h2>
          </div>
          <span className="text-[10px] font-mono font-bold text-usdt-green bg-usdt-green/10 border border-usdt-green/20 px-2 py-0.5 rounded-full">
            {isLoading ? 'Syncing…' : `${claimableCount} ready · ${safeMissions.length} total`}
          </span>
        </div>

        {isLoading && safeMissions.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-6 text-text-tertiary text-xs">
            <Loader2 size={14} className="animate-spin" />
            <span>Loading missions…</span>
          </div>
        ) : safeMissions.length === 0 ? (
          <div className="text-center py-6 px-4">
            <div className="text-2xl mb-2">🏗️</div>
            <div className="text-xs font-bold text-text-primary">No missions available right now</div>
            <div className="text-[10px] text-text-tertiary mt-1 leading-relaxed">
              Complete settlements, refer friends or complete campaigns — missions appear here automatically.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <AnimatePresence mode="popLayout">
              {safeMissions.map((mission, idx) => {
                const pct = mission.progressPercent ?? (mission.requirement
                  ? Math.min(100, (mission.requirement.current / Math.max(1, mission.requirement.required)) * 100)
                  : 100);
                const processing = mission.status === 'CLAIM_PENDING';
                return (
                  <motion.div
                    key={mission.id}
                    layout
                    initial={{ opacity: 0, y: 12, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96, height: 0, marginTop: 0, marginBottom: 0, overflow: 'hidden', transition: { duration: 0.22, ease: 'easeInOut' } }}
                    transition={{ duration: 0.28, delay: compact ? 0 : idx * 0.05, ease: [0.16, 1, 0.3, 1] }}
                    className={`bg-control-bg/40 border p-3 rounded-2xl relative overflow-hidden flex flex-col justify-between ${
                      processing
                        ? 'border-amber-500/30'
                        : mission.eligible
                          ? 'border-usdt-green/30'
                          : 'border-white/10'
                    }`}
                  >
                    {/* Top row: icon, difficulty, category */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg">{getTypeMeta(mission.rewardType).icon}</span>
                      <div className="flex items-center gap-1">
                        {mission.category && (
                          <span className="text-[8px] font-bold uppercase text-text-tertiary bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-full">
                            {CATEGORY_LABEL[mission.category] || mission.category}
                          </span>
                        )}
                        {mission.difficulty && (
                          <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${DIFFICULTY_STYLE[mission.difficulty] || DIFFICULTY_STYLE.EASY}`}>
                            {mission.difficulty}
                          </span>
                        )}
                        <span
                          className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${
                            mission.status === 'CLAIMED'
                              ? 'bg-white/5 text-text-tertiary border-white/10'
                              : processing
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                : mission.eligible
                                  ? 'bg-usdt-green/20 text-usdt-green border-usdt-green/30'
                                  : 'bg-white/5 text-text-tertiary border-white/10'
                          }`}
                        >
                          {mission.status === 'CLAIMED' ? 'Claimed ✓' : processing ? 'Processing' : mission.eligible ? 'Ready' : 'In Progress'}
                        </span>
                      </div>
                    </div>

                    {/* Body */}
                    <div>
                      <div className="text-xs font-black text-text-primary">{mission.ruleName || 'Mission'}</div>
                      <div className="text-[10px] text-text-secondary mt-0.5 line-clamp-2">{mission.description}</div>
                    </div>

                    {/* Progress */}
                    <div className="mt-2.5">
                      <div className="flex items-center justify-between text-[9px] font-mono">
                        <span className="text-text-tertiary">
                          {mission.requirement
                            ? `${mission.requirement.current}/${mission.requirement.required} ${mission.requirement.unit}`
                            : '—'}
                        </span>
                        <span className={mission.status === 'CLAIMED' || mission.eligible ? 'text-usdt-green font-bold' : 'text-sky-400 font-bold'}>{pct}%</span>
                      </div>
                      <div className="mt-1 w-full h-1 bg-control-bg rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${mission.status === 'CLAIMED' || mission.eligible ? 'bg-usdt-green' : 'bg-sky-400'}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                        />
                      </div>
                      <div className="mt-1 text-[8px] text-text-tertiary font-mono">
                        {mission.status === 'CLAIMED' ? 'Claimed' : mission.estimatedRemaining}
                      </div>
                    </div>

                    {/* CTA */}
                    {mission.status === 'CLAIMED' ? (
                      <div className="mt-2.5 w-full py-1.5 rounded-xl text-[10px] font-bold bg-white/5 border border-white/10 text-text-tertiary flex items-center justify-center gap-1 cursor-default">
                        Claimed ✓
                      </div>
                    ) : (
                      <button
                        disabled={processing}
                        onClick={() => openRunner(mission)}
                        className={`mt-2.5 w-full py-1.5 rounded-xl text-[10px] font-extrabold press-feedback shadow-sm flex items-center justify-center gap-1 ${
                          processing
                            ? 'bg-control-bg/40 text-text-tertiary cursor-not-allowed'
                            : mission.eligible
                              ? 'bg-usdt-green text-app-bg hover:brightness-110'
                              : 'bg-sky-500/15 border border-sky-500/30 text-sky-400 hover:brightness-110'
                        }`}
                      >
                        {processing ? (
                          <>
                            <Loader2 size={10} className="animate-spin" /> Processing…
                          </>
                        ) : mission.eligible ? (
                          <>
                            <Rocket size={10} /> Claim <ChevronRight size={10} />
                          </>
                        ) : (
                          <>
                            <Target size={10} /> Run Mission <ChevronRight size={10} />
                          </>
                        )}
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-[9px] text-text-tertiary">
          <Lock size={10} className="text-usdt-green" />
          <span>In-progress missions guide you live and auto-claim when complete.</span>
        </div>
      </div>

      <ClaimSuccessModal
        reward={claimed}
        isOpen={!!claimed}
        onClose={() => setClaimed(null)}
      />
    </>
  );
};
