import type React from 'react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { showToast } from '../../components/Toast';
import { useMiningStore } from '../../store/useMiningStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useWalletStore } from '../../store/useWalletStore';
import { useTreasuryStore } from '../../store/useTreasuryStore';
import { useGrowthStore } from '../../store/useGrowthStore';
import { useReferralStore } from '../../store/useReferralStore';
import { useTelegram } from '../../context/TelegramContext';
import { machineService } from '../../services/machineService';
import { MACHINE_CATALOG, getMachineYieldDetails, type FrontendMachineModel } from '../../data/machines';
import { MachineEducationModal } from '../../components/MachineEducationModal';
import { ComputeNodeSvg } from '../../components/ComputeNodeSvg';
import { FundingModal } from '../../components/funding/FundingModal';
import { 
  Gauge, 
  Sparkles, 
  AlertCircle, 
  ArrowUpRight, 
  TrendingUp, 
  Clock, 
  Smartphone,
  Bot,
  CheckCircle2,
  X,
  QrCode,
  HelpCircle,
  Zap,
  Cpu,
  BarChart3,
  Layers
} from 'lucide-react';

export const BoostScreen: React.FC = () => {
  const { baseSpeedGhs, upgradeBaseSpeed, fetchMiningState, fetchUserMachines, isMachineOwned } = useMiningStore();
  const { preferLocalCurrency } = useSettingsStore();
  const { hapticFeedback } = useTelegram();
  const { transactions } = useWalletStore();
  const { fetchTreasuryState } = useTreasuryStore();

  // Onboarding education modal state
  const [showEducationModal, setShowEducationModal] = useState(false);
  const [isFundingModalOpen, setIsFundingModalOpen] = useState(false);

  // Payment & Commissioning states
  const [selectedMachine, setSelectedMachine] = useState<FrontendMachineModel | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState<'WALLET' | 'MOBILE_MONEY' | 'USDT'>('WALLET');
  const [checkoutStep, setCheckoutStep] = useState<'SELECT' | 'TOPUP' | 'COMMISSION' | 'ACTIVATED'>('SELECT');
  const [phoneNo, setPhoneNo] = useState('+256 771 234 567');
  const [mnoNetwork, setMnoNetwork] = useState('MTN Momo');
  const [invoiceId, setInvoiceId] = useState('');
  const [timeLeft, setTimeLeft] = useState(900); // 15 minutes
  const [isCommissioning, setIsCommissioning] = useState(false);
  const { usdtBalance, fetchBalanceFromEngine } = useWalletStore();

  // Auto show machine education modal on first visit & fetch authoritative machine state
  useEffect(() => {
    fetchMiningState();
    fetchUserMachines();
    fetchBalanceFromEngine();
    const hasSeen = localStorage.getItem('has_seen_machine_education_v2');
    if (!hasSeen) {
      setShowEducationModal(true);
    }
  }, [fetchMiningState, fetchUserMachines, fetchBalanceFromEngine]);

  useEffect(() => {
    let interval: number;
    if (checkoutStep === 'TOPUP' && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((t) => t - 1);
      }, 1000) as any;
    }
    return () => clearInterval(interval);
  }, [checkoutStep, timeLeft]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleBuy = (machine: FrontendMachineModel) => {
    hapticFeedback.impactOccurred('medium');
    setSelectedMachine(machine);
    setShowCheckout(true);
    setCheckoutStep('SELECT');
    setPaymentProvider('WALLET');
    setInvoiceId(`INV-${machine.tierCode}-${Math.floor(100000 + Math.random() * 900000)}`);
    setTimeLeft(900);
  };

  const handleWalletPurchase = async () => {
    if (!selectedMachine) return;
    hapticFeedback.impactOccurred('heavy');

    try {
      const res = await machineService.purchaseMachine(selectedMachine.tierCode);
      if (res.success && res.machine) {
        hapticFeedback.notificationOccurred('success');
        upgradeBaseSpeed(res.machine.capacityGhs, res.machine.tierCode, res.machine);
        await Promise.allSettled([
          fetchUserMachines(),
          fetchMiningState(),
          useWalletStore.getState().fetchBalanceFromEngine(),
          useWalletStore.getState().fetchTransactions(),
          fetchTreasuryState(),
          useGrowthStore.getState().fetchGrowthProfile(),
          useGrowthStore.getState().fetchQualification(),
          useReferralStore.getState().fetchReferrals(),
        ]);

        // Transition to Memorable Machine Commissioning Ceremony
        setCheckoutStep('COMMISSION');
      } else if (res.requiresFunding) {
        showToast(`Insufficient wallet balance ($${(res.missingAmountUsdt || 0).toFixed(2)} USDT short)`, 'warning');
        setCheckoutStep('TOPUP');
      } else {
        showToast(res.message || 'Purchase failed', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Purchase failed', 'error');
    }
  };

  const handleCommissionMachine = async () => {
    if (!selectedMachine) return;
    setIsCommissioning(true);
    hapticFeedback.notificationOccurred('success');

    setTimeout(() => {
      setIsCommissioning(false);
      setCheckoutStep('ACTIVATED');
      showToast(`🎉 ${selectedMachine.name} commissioned & running!`, 'success');
    }, 1200);
  };

  const handlePaymentSuccess = async () => {
    if (!selectedMachine) return;
    hapticFeedback.notificationOccurred('success');

    try {
      const res = await machineService.purchaseMachine(selectedMachine.tierCode);
      if (!res.success || !res.machine) {
        showToast(res.message || 'Payment could not be confirmed', 'error');
        return;
      }

      upgradeBaseSpeed(res.machine.capacityGhs, res.machine.tierCode, res.machine);
      await Promise.allSettled([
        fetchUserMachines(),
        fetchMiningState(),
        useWalletStore.getState().fetchBalanceFromEngine(),
        useWalletStore.getState().fetchTransactions(),
        fetchTreasuryState(),
        useGrowthStore.getState().fetchGrowthProfile(),
        useGrowthStore.getState().fetchQualification(),
        useReferralStore.getState().fetchReferrals(),
      ]);

      setCheckoutStep('COMMISSION');
    } catch (err: any) {
      console.warn('Backend sync error on purchase confirm:', err);
      showToast(err?.message || 'Failed to complete machine activation', 'error');
    }
  };

  return (
    <div className="p-4 sm:p-5 flex flex-col gap-5 select-none relative z-10 max-w-lg mx-auto pb-24 font-sans">
      {/* Page Title & Intro */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-1.5"
      >
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-black tracking-widest text-usdt-green bg-usdt-green/15 px-3 py-1 rounded-full border border-usdt-green/30 flex items-center gap-1.5 uppercase">
            <Zap size={11} className="text-usdt-green" /> Machine Shop
          </div>
          <button
            onClick={() => setShowEducationModal(true)}
            className="text-[11px] font-bold text-text-tertiary hover:text-usdt-green flex items-center gap-1 bg-white/5 border border-white/10 px-3 py-1 rounded-full transition-colors"
          >
            <HelpCircle size={13} />
            <span>How it works</span>
          </button>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-text-primary tracking-tight mt-1">
          Machine Marketplace
        </h1>
        <p className="text-xs text-text-secondary leading-relaxed font-medium">
          Buy a machine to earn daily money automatically. Bigger machines generate higher daily profits.
        </p>
      </motion.div>

      {/* Active Capacity Dashboard Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass-panel rounded-2xl p-4 flex items-center justify-between relative overflow-hidden border border-usdt-green/30 bg-gradient-to-r from-usdt-green/10 via-card-bg to-control-bg/60 shadow-lg"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-usdt-green/20 border border-usdt-green/40 flex items-center justify-center text-usdt-green shadow-md">
            <Gauge size={22} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-text-tertiary uppercase tracking-wider">Total Machine Power</span>
            <span className="text-xl font-black text-text-primary font-mono mt-0.5">{((Number(baseSpeedGhs) || 0) * 10).toFixed(0)} Machine Power</span>
          </div>
        </div>

        <span className="text-[9px] font-black text-usdt-green bg-usdt-green/20 px-3 py-1 rounded-full border border-usdt-green/40 tracking-wider animate-pulse uppercase">
          Running
        </span>
      </motion.div>

      {/* Section Header */}
      <div className="flex items-center justify-between mt-1">
        <h2 className="text-xs font-black text-text-tertiary tracking-widest uppercase flex items-center gap-2">
          <TrendingUp size={13} className="text-usdt-green" /> Machines Catalog
        </h2>
        <span className="text-xs font-mono text-usdt-green bg-usdt-green/10 border border-usdt-green/30 px-2.5 py-0.5 rounded-full font-extrabold">
          5 Machines Available
        </span>
      </div>

      {/* Machines Marketplace Cards */}
      <div className="flex flex-col gap-5">
        {MACHINE_CATALOG.filter((m) => m.id !== 'free-trial').map((machine, idx) => {
          const yieldDetails = getMachineYieldDetails(machine);
          const isOwned = isMachineOwned(machine.tierCode);

          return (
            <motion.div
              key={machine.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.3 }}
              className={`relative rounded-3xl p-5 flex flex-col gap-4 border transition-all shadow-xl overflow-hidden ${
                isOwned
                  ? 'bg-gradient-to-br from-usdt-green/20 via-card-bg to-[#0d1319] border-usdt-green shadow-usdt-green/20'
                  : machine.isPopular
                  ? 'bg-gradient-to-br from-usdt-green/20 via-card-bg to-[#0d1319] border-usdt-green/60 shadow-usdt-green/15'
                  : machine.tierCode === 'TS_Q2500'
                  ? 'bg-gradient-to-br from-amber-500/15 via-card-bg to-[#17120a] border-amber-500/50 shadow-amber-500/10'
                  : machine.tierCode === 'TS_X1000'
                  ? 'bg-gradient-to-br from-purple-500/15 via-card-bg to-[#130b1c] border-purple-500/50 shadow-purple-500/10'
                  : 'bg-card-bg/95 border-white/10 hover:border-usdt-green/40'
              }`}
            >
              {/* Most Popular or Owned Badge */}
              {isOwned ? (
                <div className="absolute top-0 right-0 bg-usdt-green text-app-bg font-black text-[9px] px-3.5 py-1 rounded-bl-2xl uppercase tracking-wider flex items-center gap-1 shadow-md">
                  <CheckCircle2 size={11} /> Your Machine
                </div>
              ) : machine.isPopular ? (
                <div className="absolute top-0 right-0 bg-usdt-green text-app-bg font-black text-[9px] px-3.5 py-1 rounded-bl-2xl uppercase tracking-wider flex items-center gap-1 shadow-md">
                  <Sparkles size={10} /> Most Popular
                </div>
              ) : null}

              {/* LEVEL 1: ESTIMATED DAILY EARNINGS */}
              <div className="bg-app-bg/90 border border-white/10 rounded-2xl p-4 flex flex-col gap-1.5 shadow-inner">
                <span className="text-[10px] font-black text-text-tertiary uppercase tracking-widest flex items-center gap-1.5">
                  <BarChart3 size={12} className="text-usdt-green" /> Daily Earnings
                </span>

                <div className="flex items-baseline gap-2 mt-0.5">
                  <div className="text-2xl sm:text-3xl font-black text-usdt-green font-mono tracking-tight">
                    {yieldDetails.daily.local}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono font-bold text-text-secondary border-t border-white/5 pt-1.5 mt-1">
                  <span>≈ ${(Number(machine?.dailyYieldUsdt) || 0).toFixed(2)} USDT / day</span>
                  <span className="text-text-tertiary font-normal">Monthly: <strong className="text-text-primary">{yieldDetails.monthly.local}</strong></span>
                </div>
              </div>

              {/* LEVEL 2: MACHINE PRICE */}
              <div className="flex items-center justify-between px-1">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-text-tertiary uppercase tracking-wider">Machine Price</span>
                  <span className="text-xl font-black text-text-primary font-mono tracking-tight">
                    {yieldDetails.price.local}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-usdt-green">
                    ≈ ${(Number(machine?.priceUsdt) || 0).toFixed(2)} USDT
                  </span>
                </div>

                {/* Performance Badge */}
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[9px] font-black text-usdt-green bg-usdt-green/15 px-3 py-1 rounded-full border border-usdt-green/30 uppercase tracking-wider">
                    {machine.performanceLevel}
                  </span>
                  <span className="text-[9px] font-bold text-text-tertiary font-mono">{machine.tierLabel}</span>
                </div>
              </div>

              {/* LEVEL 3 & 4: MACHINE NAME */}
              <div className="flex items-center gap-3.5 pt-1">
                <ComputeNodeSvg tierCode={machine.tierCode} isPopular={machine.isPopular} />
                <div>
                  <h3 className="text-base font-black text-text-primary tracking-tight">{machine.name}</h3>
                  <span className="text-xs font-semibold text-usdt-green block mt-0.5">
                    {machine.targetUser}
                  </span>
                </div>
              </div>

              {/* LEVEL 5: SHORT EXPLANATION */}
              <p className="text-xs text-text-secondary leading-relaxed font-medium">
                {machine.simpleExplanation}
              </p>

              {/* LEVEL 6: ACQUIRE / OWNED BUTTON */}
              {isOwned ? (
                <div className="w-full py-3.5 rounded-2xl font-black text-xs tracking-wider uppercase flex items-center justify-center gap-2 bg-usdt-green/15 text-usdt-green border border-usdt-green/40 shadow-inner cursor-default">
                  <CheckCircle2 size={16} className="text-usdt-green" />
                  <span>Your Machine</span>
                </div>
              ) : (
                <button
                  onClick={() => handleBuy(machine)}
                  className={`w-full press-feedback py-3.5 rounded-2xl font-black text-xs tracking-wider uppercase flex items-center justify-center gap-2 border transition-all shadow-lg ${
                    machine.isPopular
                      ? 'bg-gradient-to-r from-usdt-green to-[#00c853] text-app-bg border-usdt-green hover:brightness-110 shadow-usdt-green/20'
                      : 'bg-gradient-to-r from-white/15 to-white/5 text-text-primary border-white/20 hover:bg-white/20'
                  }`}
                >
                  <span>Buy {machine.name}</span>
                  <ArrowUpRight size={16} />
                </button>
              )}

              {/* LEVEL 7: TECHNICAL INFORMATION */}
              <div className="flex flex-col gap-2 bg-white/[0.02] border border-white/5 rounded-2xl p-3 text-xs">
                {/* Visual Capacity Allocation Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-wider">
                    <span className="text-text-tertiary flex items-center gap-1">
                      <Layers size={11} className="text-usdt-green" /> Machine Power
                    </span>
                    <span className="text-text-primary font-mono">{machine.computeCapacityText}</span>
                  </div>
                  <div className="w-full h-2 bg-control-bg rounded-full overflow-hidden border border-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-usdt-green/60 to-usdt-green rounded-full transition-all duration-500"
                      style={{ width: `${machine.capacityScore}%` }}
                    />
                  </div>
                </div>

                {/* Rating Badges */}
                <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-text-tertiary pt-1">
                  <div>Priority: <strong className="text-text-primary">{machine.processingPriority}</strong></div>
                  <div>Rating: <strong className="text-text-primary">{machine.dailyOutputRating}</strong></div>
                </div>

                {/* Upgrade Comparison Statement */}
                {machine.comparisonText && (
                  <div className="text-[10px] font-extrabold text-usdt-green bg-usdt-green/10 border border-usdt-green/20 px-3 py-1.5 rounded-xl flex items-center gap-1.5 mt-1">
                    <Sparkles size={12} className="shrink-0 text-usdt-green" />
                    <span>{machine.comparisonText}</span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Onboarding Education Modal */}
      <MachineEducationModal
        isOpen={showEducationModal}
        onClose={() => setShowEducationModal(false)}
      />

      {/* Canonical Wallet Funding Module Modal */}
      <FundingModal
        isOpen={isFundingModalOpen}
        onClose={() => {
          setIsFundingModalOpen(false);
          fetchBalanceFromEngine();
        }}
      />

      {/* DYNAMIC CHECKOUT & MACHINE DETAILS MODAL */}
      <AnimatePresence>
        {showCheckout && selectedMachine && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 pb-20 sm:pb-4">
            {/* Backdrop click closer */}
            {checkoutStep !== 'ACTIVATED' && (
              <div 
                className="absolute inset-0 z-10" 
                onClick={() => {
                  hapticFeedback.impactOccurred('light');
                  setShowCheckout(false);
                  setSelectedMachine(null);
                }}
              />
            )}

            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              className="w-full max-w-md bg-app-bg border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl overflow-y-auto max-h-[90vh] z-20 font-sans"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Zap size={18} className="text-usdt-green" />
                  <h3 className="text-base font-black text-text-primary">
                    {checkoutStep === 'COMMISSION' 
                      ? 'Unbox & Commission Machine' 
                      : checkoutStep === 'ACTIVATED' 
                      ? 'Machine Running' 
                      : checkoutStep === 'TOPUP'
                      ? 'Top Up Wallet Balance'
                      : 'Machine Purchase Details'}
                  </h3>
                </div>
                {checkoutStep !== 'COMMISSION' && checkoutStep !== 'ACTIVATED' && (
                  <button
                    onClick={() => {
                      hapticFeedback.impactOccurred('light');
                      setShowCheckout(false);
                      setSelectedMachine(null);
                    }}
                    className="press-feedback p-1.5 rounded-full bg-white/5 border border-white/10 text-text-secondary hover:text-text-primary"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* STEP 1: WALLET PURCHASE FLOW */}
              {checkoutStep === 'SELECT' && (
                <div className="space-y-4">
                  {/* Machine Summary Card */}
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-base font-black text-text-primary">{selectedMachine.name}</h4>
                        <span className="text-xs font-extrabold text-usdt-green">{selectedMachine.targetUser}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-text-primary font-mono block">
                          {getMachineYieldDetails(selectedMachine).price.local}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-usdt-green">
                          ≈ ${selectedMachine.priceUsdt.toFixed(2)} USDT
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-app-bg p-3 rounded-xl border border-white/5 text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-text-tertiary block font-sans uppercase">Daily Earnings</span>
                        <strong className="text-usdt-green text-sm">{getMachineYieldDetails(selectedMachine).daily.local}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-text-tertiary block font-sans uppercase">Monthly Earnings</span>
                        <strong className="text-text-primary text-sm">{getMachineYieldDetails(selectedMachine).monthly.local}</strong>
                      </div>
                    </div>
                  </div>

                  {/* USER WALLET BALANCE DISPLAY */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-usdt-green/15 via-card-bg to-control-bg/80 border border-usdt-green/40 space-y-2 shadow-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles size={12} className="text-usdt-green" /> Internal Wallet Balance
                      </span>
                      <span className="text-[9px] font-black font-mono text-usdt-green bg-usdt-green/20 px-2 py-0.5 rounded-full border border-usdt-green/40 uppercase">
                        Available
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-black font-mono text-text-primary">
                        ${usdtBalance.toFixed(2)} <span className="text-xs text-usdt-green">USDT</span>
                      </span>
                      <span className="text-xs font-mono text-text-secondary font-bold">
                        Cost: ${(selectedMachine.priceUsdt).toFixed(2)} USDT
                      </span>
                    </div>

                    {usdtBalance >= selectedMachine.priceUsdt ? (
                      <div className="text-[10px] font-mono text-usdt-green bg-usdt-green/10 border border-usdt-green/20 p-2 rounded-xl flex justify-between items-center">
                        <span>Balance after purchase:</span>
                        <strong>${(usdtBalance - selectedMachine.priceUsdt).toFixed(2)} USDT</strong>
                      </div>
                    ) : (
                      <div className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2 rounded-xl flex justify-between items-center">
                        <span>Short by:</span>
                        <strong>${(selectedMachine.priceUsdt - usdtBalance).toFixed(2)} USDT</strong>
                      </div>
                    )}
                  </div>

                  {/* PRIMARY ACTION BUTTON */}
                  {usdtBalance >= selectedMachine.priceUsdt ? (
                    <button
                      onClick={handleWalletPurchase}
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-usdt-green to-[#00c853] text-app-bg font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-usdt-green/25 hover:brightness-110 press-feedback"
                    >
                      <Sparkles size={16} />
                      <span>Pay ${selectedMachine.priceUsdt.toFixed(2)} USDT from Wallet</span>
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => {
                          hapticFeedback.impactOccurred('medium');
                          setIsFundingModalOpen(true);
                        }}
                        className="w-full py-3.5 rounded-2xl bg-amber-500 text-app-bg font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 hover:brightness-110 press-feedback"
                      >
                        <Smartphone size={16} />
                        <span>Top Up Wallet (${(selectedMachine.priceUsdt - usdtBalance).toFixed(2)} Needed)</span>
                      </button>
                      <span className="text-[10px] text-text-tertiary text-center block">
                        Deposit funds via Mobile Money, Card, or USDT to complete purchase from your wallet balance.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: TOP-UP WALLET FALLBACK */}
              {checkoutStep === 'TOPUP' && (
                <div className="space-y-4 font-sans">
                  <div className="p-4 rounded-2xl bg-[#090b11]/80 border border-white/10 space-y-2 text-center">
                    <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest block">
                      Wallet Top-Up Needed
                    </span>
                    <span className="text-lg font-mono font-black text-text-primary block">
                      ${(selectedMachine.priceUsdt - usdtBalance).toFixed(2)} USDT
                    </span>
                    <span className="text-xs text-text-secondary block">
                      Deposit to top up your internal wallet balance using standard platform deposit rails (Mobile Money, Card, or USDT).
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      hapticFeedback.impactOccurred('medium');
                      setIsFundingModalOpen(true);
                    }}
                    className="w-full py-3.5 rounded-xl bg-usdt-green text-app-bg font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md hover:brightness-110 press-feedback"
                  >
                    <Smartphone size={15} />
                    <span>Open Wallet Top-Up Module</span>
                  </button>

                  <button
                    onClick={() => setCheckoutStep('SELECT')}
                    className="w-full text-center text-xs text-text-tertiary hover:text-text-primary pt-2 block"
                  >
                    ← Back to Machine Details
                  </button>
                </div>
              )}

              {/* STEP 3: MEMORABLE MACHINE COMMISSIONING CEREMONY */}
              {checkoutStep === 'COMMISSION' && (
                <div className="py-4 flex flex-col items-center justify-center text-center space-y-4 font-sans">
                  <motion.div
                    initial={{ scale: 0.7, opacity: 0, rotate: -10 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-usdt-green/30 via-usdt-green/10 to-transparent border-2 border-usdt-green flex items-center justify-center relative shadow-2xl shadow-usdt-green/30"
                  >
                    <ComputeNodeSvg tierCode={selectedMachine.tierCode} isPopular={selectedMachine.isPopular} />
                    <span className="absolute -top-2 -right-2 bg-usdt-green text-app-bg font-black text-[8px] px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                      Delivered
                    </span>
                  </motion.div>

                  <div className="space-y-1">
                    <h3 className="text-lg font-black text-text-primary tracking-tight">
                      {selectedMachine.name} Delivered!
                    </h3>
                    <p className="text-xs text-text-secondary max-w-xs leading-relaxed font-medium">
                      Your new hardware node has arrived at your facility. Commission it now to power on hash generation!
                    </p>
                  </div>

                  <div className="w-full bg-white/[0.03] border border-white/10 rounded-2xl p-3 text-xs font-mono space-y-1 text-left">
                    <div className="flex justify-between text-text-tertiary text-[10px] uppercase">
                      <span>Serial Certificate</span>
                      <span className="text-usdt-green">Ready</span>
                    </div>
                    <div className="text-text-primary font-bold">
                      CERT-{selectedMachine.tierCode}-{Math.floor(100000 + Math.random() * 900000)}
                    </div>
                  </div>

                  <button
                    onClick={handleCommissionMachine}
                    disabled={isCommissioning}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-usdt-green via-[#00c853] to-usdt-green text-app-bg font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-usdt-green/30 hover:brightness-110 press-feedback"
                  >
                    {isCommissioning ? (
                      <span className="animate-pulse flex items-center gap-2">
                        <Zap size={16} className="animate-spin" /> Commissioning Node...
                      </span>
                    ) : (
                      <>
                        <Zap size={18} className="text-app-bg" />
                        <span>Commission & Power On Machine ⚡</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* STEP 4: MACHINE RUNNING & CELEBRATION */}
              {checkoutStep === 'ACTIVATED' && (
                <div className="py-5 flex flex-col items-center justify-center text-center space-y-4 font-sans">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-16 h-16 rounded-full bg-usdt-green/20 border border-usdt-green flex items-center justify-center shadow-xl shadow-usdt-green/20"
                  >
                    <CheckCircle2 size={36} className="text-usdt-green animate-bounce" />
                  </motion.div>

                  <div className="space-y-1">
                    <h3 className="text-lg font-black text-text-primary">Machine Online & Earning!</h3>
                    <p className="text-xs text-text-secondary max-w-xs leading-relaxed font-medium">
                      <strong>{selectedMachine.name}</strong> is commissioned, linked to your cluster, and earning daily money!
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setShowCheckout(false);
                      setSelectedMachine(null);
                    }}
                    className="w-full py-3.5 rounded-2xl bg-usdt-green text-app-bg font-black text-xs uppercase tracking-wider shadow-lg hover:brightness-110"
                  >
                    Done & Return to Marketplace
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}

      </AnimatePresence>
    </div>
  );
};
