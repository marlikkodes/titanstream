import type React from 'react';
import { Zap, UserPlus, ChevronRight, Coins } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigationStore } from '../../../store/useNavigationStore';
import { useMiningStore } from '../../../store/useMiningStore';
import { showToast } from '../../../components/Toast';

export const ActionCards: React.FC = () => {
  const { setActiveTab } = useNavigationStore();
  const { unclaimedBalance, claimMinedYield, activeCurrency, machineMode, hasPurchasedMachine } = useMiningStore();

  const safeUnclaimed = Number(unclaimedBalance) || 0;

  const handleClaim = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await claimMinedYield();
  };

  return (
    <div className="px-4 flex flex-col gap-3 my-3">
      {/* Standard Mode Promo Banner */}
      {machineMode === 'STANDARD' && !hasPurchasedMachine && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4.5 space-y-2 text-xs relative overflow-hidden">
          <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            Titan Core — Basic Machine
          </div>
          <div className="text-text-primary font-black text-sm">
            Your machine is earning money at its regular speed.
          </div>
          <div className="text-text-secondary leading-relaxed font-medium">
            Get a faster machine to multiply your daily earnings!
          </div>
          <button
            onClick={() => setActiveTab('boost')}
            className="mt-3 w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold py-2 px-4 rounded-xl transition-colors text-center uppercase tracking-wider text-[10px] block"
          >
            Buy Faster Machine
          </button>
        </div>
      )}

      {/* Collect Earnings Card */}
      {safeUnclaimed > 0 && (
        <motion.div
          whileTap={{ scale: 0.97 }}
          onClick={handleClaim}
          className="glass-panel rounded-2xl p-4 flex items-center justify-between cursor-pointer border border-usdt-green/40 hover:border-usdt-green bg-gradient-to-r from-usdt-green/15 to-transparent transition-all shadow-lg group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-usdt-green/20 text-usdt-green border border-usdt-green/40 flex items-center justify-center shadow-[0_0_15px_rgba(0,230,118,0.3)]">
              <Coins size={22} />
            </div>
            <div>
              <div className="text-sm font-black text-usdt-green font-sans flex items-center gap-1">
                Collect Earnings
              </div>
              <div className="text-xs text-text-secondary mt-0.5 font-sans font-medium">
                Add your current earnings to your wallet.
              </div>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-usdt-green/15 border border-usdt-green/30 flex items-center justify-center text-usdt-green group-hover:bg-usdt-green group-hover:text-app-bg transition-all">
            <ChevronRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
          </div>
        </motion.div>
      )}

      {/* Buy Machine Card */}
      <motion.div
        whileTap={{ scale: 0.97 }}
        onClick={() => setActiveTab('boost')}
        className="glass-panel rounded-2xl p-4 flex items-center justify-between cursor-pointer border border-white/10 hover:border-usdt-green/40 transition-all shadow-lg group"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-usdt-green/15 text-usdt-green border border-usdt-green/30 flex items-center justify-center shadow-[0_0_15px_rgba(0,230,118,0.2)]">
            <Zap size={22} />
          </div>
          <div>
            <div className="text-sm font-black text-text-primary group-hover:text-usdt-green transition-colors font-sans">
              Buy a New Machine
            </div>
            <div className="text-xs text-text-secondary mt-0.5 font-sans font-medium">Get a new machine to increase your daily earnings</div>
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-text-secondary group-hover:text-text-primary group-hover:bg-white/10 transition-all">
          <ChevronRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
        </div>
      </motion.div>

      {/* Invite Friends Card */}
      <motion.div
        whileTap={{ scale: 0.97 }}
        onClick={() => setActiveTab('friends')}
        className="glass-panel rounded-2xl p-4 flex items-center justify-between cursor-pointer border border-white/10 hover:border-ton-blue/40 transition-all shadow-lg group"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-ton-blue/15 text-ton-blue border border-ton-blue/30 flex items-center justify-center shadow-[0_0_15px_rgba(0,136,204,0.2)]">
            <UserPlus size={22} />
          </div>
          <div>
            <div className="text-sm font-black text-text-primary group-hover:text-ton-blue transition-colors font-sans">
              Invite Friends
            </div>
            <div className="text-xs text-text-secondary mt-0.5 font-sans font-medium">Invite your friends and earn extra rewards together</div>
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-text-secondary group-hover:text-text-primary group-hover:bg-white/10 transition-all">
          <ChevronRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
        </div>
      </motion.div>
    </div>
  );
};
