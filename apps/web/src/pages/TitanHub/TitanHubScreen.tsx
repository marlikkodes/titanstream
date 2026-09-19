import type React from 'react';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MiningModeToggle } from '../Mine/components/MiningModeToggle';
import { MiningSpinner } from '../Mine/components/MiningSpinner';
import { BalanceDisplay } from '../Mine/components/BalanceDisplay';
import { CoolerSlider } from '../Mine/components/CoolerSlider';
import { useMiningStore } from '../../store/useMiningStore';
import { useWalletStore } from '../../store/useWalletStore';
import { useTreasuryStore } from '../../store/useTreasuryStore';
import { useNavigationStore } from '../../store/useNavigationStore';
import { useMachineOwnershipStore } from '../../store/useMachineOwnershipStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useTitanState, useTitanContext, useTitanStateEngine } from '../../store/useTitanStateEngine';
import { MACHINE_CATALOG } from '../../data/machines';
import { Cpu, Zap, TrendingUp, Activity, Calendar, Sparkles, ArrowRight, Play, ShoppingCart, HelpCircle, AlertTriangle, ShieldCheck, Flame, CheckCircle, RefreshCw } from 'lucide-react';
import { MachineEducationModal } from '../../components/MachineEducationModal';
import { CurrencyDisplay } from '../../components/DualCurrencyDisplay';
import { MachineControlCenter } from './components/MachineControlCenter';
import { MachineOwnersManualModal } from './components/MachineOwnersManualModal';
import { MachineActivationModal } from './components/MachineActivationModal';
import { MachineCertificateModal } from './components/MachineCertificateModal';
import { MachineHealthModal } from './components/MachineHealthModal';
import { FleetOverviewCard } from './components/FleetOverviewCard';
import { NextBestActionCard } from '../../components/NextBestActionCard';
import { formatCurrencyWithLocalFallback } from '../../store/useCountryStore';

export const TitanHubScreen: React.FC = () => {
  const fetchMiningState = useMiningStore((s) => s.fetchMiningState);
  const fetchUserMachines = useMiningStore((s) => s.fetchUserMachines);
  const baseSpeedGhs = useMiningStore((s) => s.baseSpeedGhs);
  const unclaimedBalance = useMiningStore((s) => s.unclaimedBalance);
  const isMachineOwned = useMiningStore((s) => s.isMachineOwned);
  const isOverheated = useMiningStore((s) => s.isOverheated);
  const coolerMultiplier = useMiningStore((s) => s.coolerMultiplier);
  const ownedTierCodes = useMiningStore((s) => s.ownedTierCodes);

  const fetchBalanceFromEngine = useWalletStore((s) => s.fetchBalanceFromEngine);
  const events = useTreasuryStore((s) => s.events);

  const openGames = useNavigationStore((s) => s.openGames);
  const openShop = useNavigationStore((s) => s.openShop);

  const initializeDefaultCore = useMachineOwnershipStore((s) => s.initializeDefaultCore);
  const getRecordByTier = useMachineOwnershipStore((s) => s.getRecordByTier);
  const openOwnersManual = useMachineOwnershipStore((s) => s.openOwnersManual);
  const openCertificate = useMachineOwnershipStore((s) => s.openCertificate);

  const titanState = useTitanState();
  const titanContext = useTitanContext();

  const updateMachineStatus = useTitanStateEngine((state) => state.updateMachineStatus);
  const updateRewardStatus = useTitanStateEngine((state) => state.updateRewardStatus);
  const updateSyncStatus = useTitanStateEngine((state) => state.updateSyncStatus);
  const refreshState = useTitanStateEngine((state) => state.refreshState);
  
  const [syncStep, setSyncStep] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showEducationModal, setShowEducationModal] = useState(false);
  const [showShopSection, setShowShopSection] = useState(false);
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [selectedTierCode, setSelectedTierCode] = useState<string>('TS_TRIAL');

  const syncSteps = [
    'Synchronizing Titan...',
    'Connecting Machines...',
    'Updating Earnings...',
    'Checking Rewards...',
    'Loading Events...',
    'Restoring Session...',
    'Ready.'
  ];

  // 1. Initial boot-up synchronization (runs only on mount)
  useEffect(() => {
    initializeDefaultCore();

    const syncSequence = async () => {
      // If sync already completed in this session, just refresh silently in the background
      const alreadySynced = typeof window !== 'undefined' && sessionStorage.getItem('titan_hub_boot_synced') === 'true';
      if (alreadySynced || titanState.syncStatus === 'COMPLETE') {
        try {
          await Promise.allSettled([
            fetchMiningState(),
            fetchBalanceFromEngine(),
            fetchUserMachines(),
          ]);
        } catch (err) {
          console.warn('[SYNC] Background refresh notice:', err);
        }
        return;
      }

      setIsSyncing(true);
      updateSyncStatus('SYNCING');

      // Animate through sync steps (non-blocking visual only)
      for (let i = 0; i < syncSteps.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        setSyncStep(i);
      }

      // Parallel backend state hydration with a hard 5-second timeout
      // so the UI never hangs on "Synchronizing Titan..." permanently.
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Sync timeout after 5s')), 5000)
        );
        await Promise.race([
          Promise.allSettled([
            fetchMiningState(),
            fetchBalanceFromEngine(),
            fetchUserMachines(),
          ]),
          timeoutPromise,
        ]);
      } catch (err) {
        console.warn('[SYNC] Hydration failed or timed out:', err);
      } finally {
        // ALWAYS mark synced and dismiss the sync overlay regardless of success/failure/timeout
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('titan_hub_boot_synced', 'true');
        }
        updateSyncStatus('COMPLETE');
        setIsSyncing(false);

        const hasSeen = localStorage.getItem('has_seen_machine_education_v2');
        if (!hasSeen) {
          setShowEducationModal(true);
        }
      }
    };

    syncSequence();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Synchronize machine status changes to the Titan State Engine (without 100ms multiplier re-render loop)
  const activeRecord = getRecordByTier(selectedTierCode);
  const isSelectedPaused = activeRecord?.status === 'PAUSED';

  useEffect(() => {
    const { activeGhs } = useMiningStore.getState().syncMachineStatus();
    const currentCooler = useMiningStore.getState().coolerMultiplier || 1.0;

    updateMachineStatus(
      isOverheated ? 'OVERHEATED' : isSelectedPaused ? 'PAUSED' : 'RUNNING',
      activeGhs * 10,
      currentCooler,
      isOverheated ? 85 : isSelectedPaused ? 30 : 45
    );
  }, [isOverheated, isSelectedPaused, updateMachineStatus]);

  // 3. Synchronize reward status changes to the Titan State Engine
  useEffect(() => {
    updateRewardStatus(
      unclaimedBalance > 0 ? 'READY' : 'PENDING',
      unclaimedBalance,
      0
    );
  }, [unclaimedBalance, updateRewardStatus]);

  // 4. Compute initial context on mount
  useEffect(() => {
    refreshState();
  }, [refreshState]);

  // 5. Relogin / Session welcome popup toast
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const welcomed = sessionStorage.getItem('welcome_toast_shown');
      if (!welcomed) {
        import('../../components/Toast').then(({ showToast }) => {
          showToast('🟢 WELCOME BACK: Titan Core Prime online • Systems operational', 'info');
        });
        sessionStorage.setItem('welcome_toast_shown', 'true');
      }
    }
  }, []);

  if (isSyncing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] gap-6 p-4 select-none">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-usdt-green to-emerald-600 border border-usdt-green/40 flex items-center justify-center shadow-2xl shadow-usdt-green/30 animate-pulse">
          <Cpu size={44} className="text-app-bg" />
        </div>
        <div className="text-center space-y-2">
          <div className="text-base font-black text-text-primary animate-pulse tracking-wide font-mono">
            {syncSteps[syncStep]}
          </div>
          <div className="flex gap-1.5 justify-center">
            {syncSteps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i <= syncStep ? 'w-5 bg-usdt-green' : 'w-1.5 bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const activeCatalog = MACHINE_CATALOG.find((m) => m.tierCode.toUpperCase() === selectedTierCode.toUpperCase()) || MACHINE_CATALOG[0];

  const getMoodColor = (mood: typeof titanContext.titanMood) => {
    switch (mood) {
      case 'CRITICAL': return 'from-red-500 to-red-600 border-red-400';
      case 'WARNING': return 'from-amber-500 to-orange-500 border-amber-400';
      case 'FOCUSED': return 'from-blue-500 to-cyan-500 border-blue-400';
      case 'EXCITED': return 'from-purple-500 to-pink-500 border-purple-400';
      case 'RESTING': return 'from-usdt-green to-emerald-600 border-usdt-green';
    }
  };

  const getMoodIcon = (mood: typeof titanContext.titanMood) => {
    switch (mood) {
      case 'CRITICAL': return <AlertTriangle size={20} />;
      case 'WARNING': return <Flame size={20} />;
      case 'FOCUSED': return <Cpu size={20} />;
      case 'EXCITED': return <Sparkles size={20} />;
      case 'RESTING': return <CheckCircle size={20} />;
    }
  };

  return (
    <div className="flex flex-col min-h-full animate-fade-in pb-28 px-4 pt-2 gap-4 select-none">
      {/* SECTION 1: HERO - Centered Signature Spinner */}
      <div className="flex flex-col gap-3">
        <MiningModeToggle />
        <MiningSpinner />
        <BalanceDisplay />
      </div>

      {/* CANONICAL NEXT BEST ACTION (Only displayed when there are active claimable rewards) */}
      <NextBestActionCard onlyIfRewards={true} />

      {/* DYNAMIC PRIORITY BANNER: Unclaimed Yield Ready */}
      {unclaimedBalance > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-2xl bg-gradient-to-r from-usdt-green/20 to-emerald-600/20 border border-usdt-green/40 flex items-center justify-between shadow-lg"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-usdt-green/20 text-usdt-green flex items-center justify-center font-bold">
              <Zap size={16} />
            </div>
            <div>
              <div className="text-xs font-black text-text-primary">
                <CurrencyDisplay amount={unclaimedBalance} size="sm" showCurrencyLabel={true} /> Ready to Collect
              </div>
              <div className="text-[10px] text-text-tertiary">
                Min. collection: {formatCurrencyWithLocalFallback(3.0)} • Earned by your machines.
              </div>
            </div>
          </div>
          <button
            onClick={() => useMiningStore.getState().claimMinedYield()}
            className="py-1.5 px-3 rounded-xl bg-usdt-green text-app-bg font-black text-xs shadow-md press-feedback"
          >
            Collect Now
          </button>
        </motion.div>
      )}

      {/* SECTION 2: FLEET OVERVIEW & INTEGRATED MACHINE CONTROLS */}
      <FleetOverviewCard
        onOpenShop={() => openShop()}
        onSelectTier={(tier) => setSelectedTierCode(tier)}
        selectedTierCode={selectedTierCode}
        onOpenHowItWorks={() => setShowEducationModal(true)}
        onOpenHealthModal={() => setShowHealthModal(true)}
      />

      {/* QUICK ACTIONS ROW */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <h3 className="text-xs font-extrabold text-text-tertiary uppercase tracking-wider mb-2.5 flex items-center gap-2">
          <Zap size={14} className="text-amber-400" />
          Quick Actions
        </h3>
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => openShop()}
            className="web3-card p-2.5 rounded-xl border border-white/10 flex flex-col items-center gap-1.5 hover:border-usdt-green/30 transition-colors press-feedback"
          >
            <div className="w-8 h-8 rounded-lg bg-usdt-green/10 text-usdt-green flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
            <span className="text-[10px] font-extrabold text-text-primary">Upgrade</span>
          </button>
          <button
            onClick={() => useMiningStore.getState().claimMinedYield()}
            className="web3-card p-2.5 rounded-xl border border-white/10 flex flex-col items-center gap-1.5 hover:border-gold/30 transition-colors press-feedback"
          >
            <div className="w-8 h-8 rounded-lg bg-gold/10 text-gold flex items-center justify-center">
              <Activity size={16} />
            </div>
            <span className="text-[10px] font-extrabold text-text-primary">Collect</span>
          </button>
          <button 
            onClick={() => openShop()}
            className="web3-card p-2.5 rounded-xl border border-white/10 flex flex-col items-center gap-1.5 hover:border-ton-blue/30 transition-colors press-feedback"
          >
            <div className="w-8 h-8 rounded-lg bg-ton-blue/10 text-ton-blue flex items-center justify-center">
              <ShoppingCart size={16} />
            </div>
            <span className="text-[10px] font-extrabold text-text-primary">Shop</span>
          </button>
          <button
            onClick={() => openOwnersManual(selectedTierCode)}
            className="web3-card p-2.5 rounded-xl border border-white/10 flex flex-col items-center gap-1.5 hover:border-purple-400/30 transition-colors press-feedback"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <HelpCircle size={16} />
            </div>
            <span className="text-[10px] font-extrabold text-text-primary">Manual</span>
          </button>
        </div>
      </motion.div>

      {/* SHOP SECTION (Collapsible) */}
      <AnimatePresence>
        {showShopSection && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-text-tertiary uppercase tracking-wider flex items-center gap-2">
                  <ShoppingCart size={14} className="text-ton-blue" />
                  Machine Shop
                </h3>
                <button
                  onClick={() => setShowEducationModal(true)}
                  className="text-[10px] font-bold text-text-tertiary hover:text-usdt-green flex items-center gap-1 bg-white/5 border border-white/10 px-2 py-1 rounded-full transition-colors"
                >
                  <HelpCircle size={11} />
                  <span>How it works</span>
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {MACHINE_CATALOG.filter((m) => m.id !== 'free-trial').slice(0, 3).map((machine) => {
                  const isOwned = isMachineOwned(machine.tierCode);

                  return (
                    <div
                      key={machine.id}
                      className={`relative rounded-2xl p-4 flex flex-col gap-3 border transition-all shadow-lg ${
                        isOwned
                          ? 'bg-gradient-to-br from-usdt-green/20 via-card-bg to-[#0d1319] border-usdt-green/40'
                          : machine.isPopular
                          ? 'bg-gradient-to-br from-usdt-green/15 via-card-bg to-[#0d1319] border-usdt-green/50'
                          : 'bg-card-bg/95 border-white/10 hover:border-usdt-green/30'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-usdt-green/20 to-ton-blue/20 border border-white/10 flex items-center justify-center text-2xl">
                            ⚡
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-extrabold text-text-primary">{machine.name}</h4>
                              {isOwned && (
                                <span className="text-[9px] font-bold text-usdt-green bg-usdt-green/20 px-2 py-0.5 rounded-full border border-usdt-green/30 uppercase">
                                  Owned
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-text-secondary mt-0.5">{machine.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-black text-text-primary font-mono">
                            <CurrencyDisplay amount={machine.priceUsdt} size="lg" showCurrencyLabel={true} />
                          </div>
                          <div className="text-[10px] text-text-tertiary">One-time</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                        <div className="bg-white/5 rounded-lg p-2">
                          <div className="text-[9px] font-bold text-text-tertiary uppercase">Daily Earnings</div>
                          <div className="text-xs font-extrabold text-usdt-green font-mono mt-0.5">
                            <CurrencyDisplay amount={machine.dailyYieldUsdt} size="sm" showCurrencyLabel={true} />
                          </div>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2">
                          <div className="text-[9px] font-bold text-text-tertiary uppercase">Power</div>
                          <div className="text-xs font-extrabold text-text-primary font-mono mt-0.5">
                            {machine.capacityGhs} GH/s
                          </div>
                        </div>
                      </div>

                      {!isOwned && (
                        <button
                          onClick={() => openShop()}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-usdt-green to-[#00c853] text-app-bg font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-usdt-green/20 press-feedback"
                        >
                          <ShoppingCart size={14} />
                          Buy Machine
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SECTION 4: DAILY CHALLENGE */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="web3-card-gold rounded-2xl p-4 border border-gold/30 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-gold/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-extrabold text-gold uppercase tracking-wider flex items-center gap-2">
              <Sparkles size={14} />
              Daily Challenge
            </h3>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              titanState.challengeStatus === 'COMPLETED' ? 'text-usdt-green bg-usdt-green/20 border border-usdt-green/30' :
              'text-gold bg-gold/20'
            }`}>
              +50 Crystals
            </span>
          </div>
          <p className="text-sm font-extrabold text-text-primary mb-3">
            Play Titan Reactor 3 times today
          </p>
          <button
            onClick={() => openGames()}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-gold to-gold-bright text-app-bg font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-gold/20 press-feedback"
          >
            <Play size={14} />
            Start Challenge
            <ArrowRight size={14} />
          </button>
        </div>
      </motion.div>

      {/* SECTION 5: MINI GAMES LAUNCHER GRID */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <h3 className="text-xs font-extrabold text-text-tertiary uppercase tracking-wider mb-2.5 flex items-center gap-2">
          <Play size={14} className="text-purple-400" />
          Mini Games
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => openGames('crypto-roulette')}
            className="web3-card p-3 rounded-xl border border-white/10 flex flex-col items-center text-center gap-1.5 hover:border-purple-400/30 transition-colors press-feedback"
          >
            <div className="text-2xl">🎰</div>
            <div className="text-xs font-extrabold text-text-primary">Roulette</div>
            <div className="text-[10px] text-text-tertiary">Win up to 100 Crystals</div>
          </button>
          <button
            onClick={() => openGames('hoop-masters')}
            className="web3-card p-3 rounded-xl border border-white/10 flex flex-col items-center text-center gap-1.5 hover:border-purple-400/30 transition-colors press-feedback"
          >
            <div className="text-2xl">🏀</div>
            <div className="text-xs font-extrabold text-text-primary">Titan Hoop</div>
            <div className="text-[10px] text-text-tertiary">Score shots for rewards</div>
          </button>
          <button
            onClick={() => openGames('titan-core-reactor')}
            className="web3-card p-3 rounded-xl border border-white/10 flex flex-col items-center text-center gap-1.5 hover:border-purple-400/30 transition-colors press-feedback"
          >
            <div className="text-2xl">⚛️</div>
            <div className="text-xs font-extrabold text-text-primary">Titan Reactor</div>
            <div className="text-[10px] text-text-tertiary">Chain reactions</div>
          </button>
          <button
            onClick={() => openGames('power-grid')}
            className="web3-card p-3 rounded-xl border border-white/10 flex flex-col items-center text-center gap-1.5 hover:border-purple-400/30 transition-colors press-feedback"
          >
            <div className="text-2xl">⚡</div>
            <div className="text-xs font-extrabold text-text-primary">Power Grid</div>
            <div className="text-[10px] text-text-tertiary">Connect the power</div>
          </button>
        </div>
      </motion.div>

      {/* SECTION 6: EVENTS */}
      {Array.isArray(events) && events.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="text-xs font-extrabold text-text-tertiary uppercase tracking-wider mb-2.5 flex items-center gap-2">
            <Calendar size={14} className="text-usdt-green" />
            Active Events
          </h3>
          <div className="flex flex-col gap-2">
            {events.map((evt) => (
              <div
                key={evt.id}
                className="web3-card p-3 rounded-xl border border-white/10 flex items-center justify-between"
              >
                <div className="flex flex-col">
                  <span className="text-xs font-extrabold text-text-primary">{evt.title}</span>
                  <span className="text-[10px] text-text-tertiary">{evt.description}</span>
                </div>
                {evt.badge && (
                  <span className="text-[9px] font-bold text-usdt-green bg-usdt-green/10 border border-usdt-green/20 px-2 py-0.5 rounded-full uppercase">
                    {evt.badge}
                  </span>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* SECTION 7: COOLER SLIDER */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <CoolerSlider />
      </motion.div>

      {/* SECTION 8: SYSTEM RECOMMENDATIONS */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="web3-card rounded-2xl p-4 border border-white/10 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-extrabold text-text-tertiary uppercase tracking-wider flex items-center gap-2 font-mono">
              <Sparkles size={14} className="text-cyan-400 animate-pulse" />
              Suggested Next Step
            </h3>
          </div>

          {titanState.upgradeStatus === 'RECOMMENDED' && titanState.recommendedMachine ? (
            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <span className="font-extrabold block text-white text-[13px] mb-1">
                  ⭐ Recommended: {titanState.recommendedMachine} Upgrade
                </span>
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  {titanState.upgradeBenefit || 'A stronger machine earns more money every day.'}
                </p>
              </div>
              <button
                onClick={() => openShop()}
                className="w-full py-3 rounded-2xl bg-cyan-500 text-app-bg font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/20 press-feedback"
              >
                <ShoppingCart size={14} />
                <span>Get This Machine</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-3.5 text-xs text-text-secondary">
              <CheckCircle size={18} className="text-usdt-green shrink-0" />
              <span>All your machines are running great! No upgrades needed right now.</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* MODALS */}
      <MachineOwnersManualModal />
      <MachineActivationModal />
      <MachineCertificateModal />
      <MachineHealthModal
        isOpen={showHealthModal}
        onClose={() => setShowHealthModal(false)}
        tierCode={selectedTierCode}
      />
      <MachineEducationModal
        isOpen={showEducationModal}
        onClose={() => {
          setShowEducationModal(false);
          localStorage.setItem('has_seen_machine_education_v2', 'true');
        }}
      />
    </div>
  );
};
