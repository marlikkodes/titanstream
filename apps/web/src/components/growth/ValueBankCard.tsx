import type React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, TrendingUp, ShieldCheck, Lock, Award, Info } from 'lucide-react';
import type { UserValueBank } from '../../services/growthService';

interface ValueBankCardProps {
  valueBank: UserValueBank | null;
  isLoading?: boolean;
}

export const ValueBankCard: React.FC<ValueBankCardProps> = ({ valueBank, isLoading }) => {
  const totalGenerated = valueBank?.totalValueGeneratedUsdt ?? 0;
  const unlockedRewards = valueBank?.unlockedRewardsUsdt ?? 0;
  const retainedContribution = valueBank?.retainedContributionUsdt ?? 0;
  const crystals = valueBank?.totalCrystalsEarned ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl p-5 bg-gradient-to-br from-[#0a1f2f] via-card-bg to-[#06121c] border border-cyan-500/30 shadow-2xl relative overflow-hidden space-y-4"
    >
      <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
            <Sparkles size={16} />
          </div>
          <div>
            <span className="text-[9px] font-mono font-black uppercase tracking-widest text-cyan-400 block">
              REWARDS & BONUS VAULT
            </span>
            <h3 className="text-sm font-black text-text-primary tracking-tight">Earnings Summary</h3>
          </div>
        </div>

        <span className="text-[9px] font-mono font-bold px-2.5 py-1 rounded-full bg-usdt-green/10 text-usdt-green border border-usdt-green/20 flex items-center gap-1">
          <ShieldCheck size={11} /> Realized Earnings
        </span>
      </div>

      {/* VALUE TRIAD GRID */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        {/* 1. Value Generated */}
        <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
          <span className="text-[9px] text-text-tertiary font-mono uppercase">Total Generated</span>
          <div className="text-base font-black text-cyan-400 font-sans mt-1">
            ${totalGenerated.toFixed(2)}
          </div>
          <span className="text-[8px] text-text-tertiary mt-0.5">From your network</span>
        </div>

        {/* 2. Unlocked Rewards */}
        <div className="p-3 rounded-2xl bg-usdt-green/10 border border-usdt-green/25 flex flex-col justify-between">
          <span className="text-[9px] text-usdt-green font-mono uppercase">Cash Earned</span>
          <div className="text-base font-black text-usdt-green font-sans mt-1">
            +${unlockedRewards.toFixed(2)}
          </div>
          <span className="text-[8px] text-text-tertiary mt-0.5">Credited to wallet</span>
        </div>

        {/* 3. Retained Platform Margin */}
        <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
          <span className="text-[9px] text-text-tertiary font-mono uppercase">Community Pool</span>
          <div className="text-base font-black text-gold font-sans mt-1">
            ${retainedContribution.toFixed(2)}
          </div>
          <span className="text-[8px] text-text-tertiary mt-0.5">Network rewards</span>
        </div>
      </div>

      {/* VIRTUAL SUMMARY & DISCLAIMER */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px] text-text-tertiary">
        <div className="flex items-center gap-1.5 font-mono">
          <span>💎 {crystals} Crystals Earned</span>
        </div>
        <div className="flex items-center gap-1 text-[9px]">
          <Info size={11} className="text-cyan-400" />
          <span>Instant settlements to your wallet balance</span>
        </div>
      </div>
    </motion.div>
  );
};
