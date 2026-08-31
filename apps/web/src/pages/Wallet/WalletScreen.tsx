import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusCircle,
  History,
  ShieldCheck,
  ChevronRight,
  ArrowDownLeft,
  TrendingUp,
  Cpu,
  Coins,
  CheckCircle,
  Zap,
  ArrowUpRight,
  Lock,
  PieChart,
  HelpCircle,
} from 'lucide-react';
import { useWalletStore } from '../../store/useWalletStore';
import { useMiningStore } from '../../store/useMiningStore';
import { useNavigationStore } from '../../store/useNavigationStore';
import { FundingModal } from '../../components/funding/FundingModal';
import { WithdrawModal } from '../../components/funding/WithdrawModal';
import { TransactionHistoryView } from '../../components/funding/TransactionHistoryView';
import { CurrencyDisplay } from '../../components/DualCurrencyDisplay';
import { EmptyState } from '../../components/EmptyState';
import { DestinationLoader } from '../../components/DestinationLoader';
import { useTelegram } from '../../context/TelegramContext';

import { useCountryStore } from '../../store/useCountryStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useGrowthStore } from '../../store/useGrowthStore';
import { Users } from 'lucide-react';

export const WalletScreen: React.FC = () => {
  const [isFundingModalOpen, setIsFundingModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);

  const usdtBalance = useWalletStore((s) => s.usdtBalance);
  const pendingSettlements = useWalletStore((s) => s.pendingSettlements);
  const transactions = useWalletStore((s) => s.transactions);
  const isLoadingBalance = useWalletStore((s) => s.isLoadingBalance);
  const lifetimeDeposits = useWalletStore((s) => s.lifetimeDeposits);
  const lifetimeWithdrawals = useWalletStore((s) => s.lifetimeWithdrawals);
  const activeMachines = useWalletStore((s) => s.activeMachines);

  const unclaimedBalance = useMiningStore((s) => s.unclaimedBalance);
  const baseSpeedGhs = useMiningStore((s) => s.baseSpeedGhs);

  const { setActiveTab } = useNavigationStore();
  const { hapticFeedback, user } = useTelegram();
  const { selectedCountry, getLocalAmount } = useCountryStore();
  const { preferLocalCurrency, hideEarnings } = useSettingsStore();

  const { qualification, fetchQualification } = useGrowthStore();

  useEffect(() => {
    fetchQualification();
  }, [fetchQualification]);

  const isWithdrawalLocked = qualification?.withdrawal ? !qualification.withdrawal.canWithdraw : false;
  const qualifiedCount = qualification?.withdrawal?.qualifiedCount ?? 0;
  const requirementCount = qualification?.withdrawal?.requirement ?? 5;
  const remainingNeeded = qualification?.withdrawal?.remainingNeeded ?? 5;

  const isLocalPreferred = preferLocalCurrency && !!selectedCountry && selectedCountry.code !== 'US';

  const hasFetchedBalanceOnce = useWalletStore((s) => s.hasFetchedBalanceOnce);

  useEffect(() => {
    if (!hasFetchedBalanceOnce) {
      useWalletStore.getState().fetchBalanceFromEngine();
    }
    useWalletStore.getState().fetchSettlementHistory();
    useWalletStore.getState().fetchTransactions(5, 0);
    useMiningStore.getState().fetchUserMachines();
  }, [hasFetchedBalanceOnce]);

  const authUser = useAuthStore((s) => s.user);
  const displayName = useSettingsStore((s) => s.displayName);

  const handleRefresh = () => {
    hapticFeedback.impactOccurred('light');
    useWalletStore.getState().fetchBalanceFromEngine();
    useWalletStore.getState().fetchSettlementHistory();
    useWalletStore.getState().fetchTransactions(5, 0);
    useMiningStore.getState().fetchUserMachines();
  };

  const isModalActive = isFundingModalOpen || isWithdrawModalOpen || isHistoryModalOpen;

  if (isLoadingBalance && usdtBalance === 0 && !hasFetchedBalanceOnce && !isModalActive) {
    return <DestinationLoader destination="wallet" />;
  }

  const username = displayName || authUser?.firstName || user?.first_name || 'User';
  const totalAssetsUsdt = usdtBalance + unclaimedBalance;

  return (
    <div className="w-full space-y-5 p-4 pb-28 select-none bg-[#07090e] min-h-full">
      {/* DESTINATION HEADER — Calm, Professional Financial Banking Feel */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-usdt-green font-mono">
            Your Wallet
          </span>
          <h1 className="text-2xl font-black text-text-primary tracking-tight">My Wallet</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-text-tertiary hover:text-text-primary transition-colors"
            title="Refresh balance"
          >
            <ShieldCheck size={18} className="text-usdt-green" />
          </button>
        </div>
      </div>

      {/* HERO SECTION — Total Portfolio & Financial Assets (60% Focal Point) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl p-5 bg-gradient-to-br from-[#0c141d] via-card-bg to-[#07090e] border border-usdt-green/30 relative overflow-hidden shadow-2xl"
      >
        <div className="absolute top-0 right-0 w-48 h-48 bg-usdt-green/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col gap-1 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-text-tertiary">
              Your Total Balance
            </span>
            <span className="text-[10px] font-mono font-bold text-usdt-green bg-usdt-green/10 px-2 py-0.5 rounded-full border border-usdt-green/20">
              VERIFIED
            </span>
          </div>

          {hideEarnings ? (
            <div className="text-3xl font-black text-text-primary font-mono tracking-tight mt-1">
              ••••••
            </div>
          ) : isLocalPreferred ? (
            <div className="mt-1">
              <div className="text-3xl font-black text-text-primary font-mono tracking-tight">
                {getLocalAmount(totalAssetsUsdt)}
              </div>
              <div className="text-xs font-bold font-mono text-text-tertiary mt-0.5">
                ≈ {totalAssetsUsdt.toFixed(2)} USDT
              </div>
            </div>
          ) : (
            <div className="mt-1">
              <div className="text-3xl font-black text-text-primary font-mono tracking-tight">
                {totalAssetsUsdt.toFixed(2)} USDT
              </div>
              {selectedCountry && selectedCountry.code !== 'US' && (
                <div className="text-xs font-bold font-mono text-text-tertiary mt-0.5">
                  ≈ {getLocalAmount(totalAssetsUsdt)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Assets Breakdown Grid */}
        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/10">
          <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
            <div className="flex items-center justify-between text-[10px] text-text-tertiary uppercase font-extrabold mb-1">
              <span>Available</span>
              <Coins size={12} className="text-usdt-green" />
            </div>
            <div className="text-base font-black text-usdt-green font-mono">
              <CurrencyDisplay amount={usdtBalance} size="sm" />
            </div>
            <div className="text-[9px] text-text-tertiary">Wallet Balance</div>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
            <div className="flex items-center justify-between text-[10px] text-text-tertiary uppercase font-extrabold mb-1">
              <span>Ready to Collect</span>
              <Lock size={12} className="text-amber-400" />
            </div>
            <div className="text-base font-black text-amber-400 font-mono">
              <CurrencyDisplay amount={unclaimedBalance} size="sm" />
            </div>
            <div className="text-[9px] text-text-tertiary">From your machines</div>
          </div>
        </div>

        {/* PRIMARY ACTION BUTTONS */}
        <div className="grid grid-cols-2 gap-2.5 mt-4">
          <button
            onClick={() => setIsFundingModalOpen(true)}
            className="py-3 rounded-2xl bg-usdt-green text-app-bg font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-usdt-green/20 press-feedback"
          >
            <PlusCircle size={16} />
            <span>Add Money</span>
          </button>

          <button
            onClick={() => setIsWithdrawModalOpen(true)}
            className={`py-3 rounded-2xl border font-black text-xs flex items-center justify-center gap-2 transition-colors press-feedback ${
              isWithdrawalLocked
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                : 'bg-white/10 border-white/15 text-text-primary hover:bg-white/15'
            }`}
          >
            {isWithdrawalLocked ? <Lock size={15} className="text-amber-400" /> : <ArrowDownLeft size={16} />}
            <span>Take Out Money {isWithdrawalLocked && `(${qualifiedCount}/${requirementCount})`}</span>
          </button>
        </div>
      </motion.div>

      {/* WITHDRAWAL UNLOCK PROGRESS CARD */}
      {isWithdrawalLocked && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-3xl bg-amber-500/10 border border-amber-500/25 space-y-3 relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold shrink-0">
                <Lock size={16} />
              </div>
              <div>
                <span className="text-xs font-black text-text-primary block">
                  Withdrawals Locked ({qualifiedCount}/{requirementCount} Referrals)
                </span>
                <span className="text-[10px] text-amber-300/90 block">
                  Invite 5 qualified members to unlock cash payouts
                </span>
              </div>
            </div>
            <span className="text-[11px] font-mono font-black text-amber-400 bg-amber-500/15 px-2.5 py-1 rounded-full border border-amber-500/30 shrink-0">
              {qualifiedCount} / {requirementCount}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (qualifiedCount / requirementCount) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-text-tertiary font-mono">
              <span>{Math.round((qualifiedCount / requirementCount) * 100)}% Completed</span>
              <span>{remainingNeeded} more {remainingNeeded === 1 ? 'member' : 'members'} needed</span>
            </div>
          </div>

          <button
            onClick={() => {
              hapticFeedback.impactOccurred('medium');
              setActiveTab('grow');
            }}
            className="w-full py-2.5 rounded-xl bg-amber-500 text-app-bg font-extrabold text-xs flex items-center justify-center gap-1.5 hover:brightness-110 press-feedback"
          >
            <Users size={14} />
            <span>Invite Members to Unlock ({remainingNeeded} Left)</span>
          </button>
        </motion.div>
      )}

      {/* CROSS-PAGE CONTINUITY BANNER (No Dead Ends) */}
      {unclaimedBalance > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setActiveTab('hub')}
          className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between cursor-pointer hover:border-amber-500/50 transition-colors press-feedback"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Zap size={16} />
            </div>
            <div>
              <div className="text-xs font-black text-text-primary flex items-center gap-1">
                <CurrencyDisplay amount={unclaimedBalance} size="sm" /> Earnings Ready to Collect
              </div>
              <div className="text-[10px] text-text-secondary">
                Your machine is earning money! Tap to collect.
              </div>
            </div>
          </div>
          <ChevronRight size={16} className="text-amber-400" />
        </motion.div>
      )}



      {/* DISCOVERY & GUARANTEE SECTION */}
      <div className="web3-card rounded-2xl p-4 border border-white/10 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-usdt-green/10 border border-usdt-green/20 text-usdt-green flex items-center justify-center shrink-0">
          <ShieldCheck size={20} />
        </div>
        <div>
          <h3 className="text-xs font-black text-text-primary">Your Money Is 100% Safe</h3>
          <p className="text-[10px] text-text-secondary leading-relaxed">
            All your money is fully protected and verified.
          </p>
        </div>
      </div>

      {/* SINGLE UNIFIED TRANSACTION HISTORY SECTION */}
      <div className="pt-2">
        <TransactionHistoryView />
      </div>

      {/* MODALS */}
      <FundingModal
        isOpen={isFundingModalOpen}
        onClose={() => setIsFundingModalOpen(false)}
      />
      <WithdrawModal
        isOpen={isWithdrawModalOpen}
        onClose={() => setIsWithdrawModalOpen(false)}
      />
    </div>
  );
};
