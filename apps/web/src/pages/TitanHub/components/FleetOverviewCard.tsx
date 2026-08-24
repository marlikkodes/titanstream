import type React from 'react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, Zap, Activity, PlusCircle, HelpCircle, ShieldCheck, ChevronDown, ChevronUp, Sliders } from 'lucide-react';
import { useMiningStore } from '../../../store/useMiningStore';
import { useMachineOwnershipStore } from '../../../store/useMachineOwnershipStore';
import { MACHINE_CATALOG } from '../../../data/machines';
import { MachineControlCenter } from './MachineControlCenter';

interface FleetOverviewCardProps {
  onOpenShop: () => void;
  onSelectTier: (tierCode: string) => void;
  selectedTierCode: string;
  onOpenHowItWorks?: () => void;
  onOpenHealthModal?: () => void;
}

export const FleetOverviewCard: React.FC<FleetOverviewCardProps> = ({
  onOpenShop,
  onSelectTier,
  selectedTierCode,
  onOpenHowItWorks,
  onOpenHealthModal,
}) => {
  const ownedTierCodes = useMiningStore((s) => s.ownedTierCodes);
  const isPaused = useMiningStore((s) => s.isPaused);
  const activeSpeedGhs = useMiningStore((s) => s.activeSpeedGhs);
  const ownerships = useMachineOwnershipStore((s) => s.ownerships);

  const activeSpeed = isPaused ? 0 : activeSpeedGhs;

  // Active controls drawer tier state (null = collapsed, tierCode = expanded)
  const [activeControlsTier, setActiveControlsTier] = useState<string | null>(null);

  const safeOwnedTiers = Array.isArray(ownedTierCodes) ? ownedTierCodes : ['TS_TRIAL'];
  const totalMachinesCount = Math.max(1, safeOwnedTiers.length);
  const activeCount = Object.values(ownerships || {}).filter((r) => r?.status === 'RUNNING').length;

  const machines = Object.values(ownerships || {});
  const healthSum = machines.reduce((sum, machine) => {
    switch (machine?.status) {
      case 'RUNNING':
      case 'PAUSED':
        return sum + 100;
      case 'OVERHEATED':
        return sum + 50;
      case 'MAINTENANCE':
        return sum + 30;
      case 'OFFLINE':
      default:
        return sum + 0;
    }
  }, 0);
  const fleetHealth = machines.length > 0 ? (healthSum / machines.length).toFixed(1) : '100.0';

  const handleMachineTap = (tierCode: string) => {
    onSelectTier(tierCode);
    if (activeControlsTier === tierCode) {
      // Toggle collapse if tapping currently open machine
      setActiveControlsTier(null);
    } else {
      // Expand controls for tapped machine
      setActiveControlsTier(tierCode);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="web3-card rounded-2xl p-4 border border-white/10 relative overflow-hidden flex flex-col gap-3.5"
    >
      {/* Background Subtle Gradient */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-usdt-green/5 rounded-full blur-3xl pointer-events-none" />

      {/* HEADER ROW */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-extrabold text-text-tertiary uppercase tracking-wider flex items-center gap-2">
          <Cpu size={14} className="text-usdt-green" />
          Your Machines
        </h3>
        <div className="flex items-center gap-2">
          {onOpenHowItWorks && (
            <button
              onClick={onOpenHowItWorks}
              className="text-[10px] font-extrabold text-gold bg-gold/10 px-2.5 py-1 rounded-full border border-gold/30 flex items-center gap-1 hover:bg-gold/20 active:scale-95 transition-all"
            >
              <HelpCircle size={10} /> How It Works & FAQs
            </button>
          )}
          <span className={`text-[10px] font-mono font-black px-2.5 py-1 rounded-full border ${
            activeCount > 0
              ? 'text-usdt-green bg-usdt-green/10 border-usdt-green/20'
              : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
          }`}>
            {activeCount}/{totalMachinesCount} ACTIVE
          </span>
        </div>
      </div>

      {/* SUMMARY METRIC BAR */}
      <div className="grid grid-cols-3 gap-2 bg-control-bg/40 p-2 rounded-xl border border-white/5">
        <div className="flex items-center gap-2 px-2 py-1">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
            activeSpeed > 0 ? 'bg-usdt-green/15 text-usdt-green' : 'bg-amber-500/15 text-amber-400'
          }`}>
            <Zap size={14} />
          </div>
          <div>
            <div className="text-[9px] font-extrabold text-text-tertiary uppercase leading-tight">Total Power</div>
            <div className={`text-xs font-black font-mono leading-tight ${
              activeSpeed > 0 ? 'text-text-primary' : 'text-amber-400'
            }`}>
              {(activeSpeed * 10).toFixed(0)} Power {activeSpeed === 0 ? '(PAUSED)' : ''}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-2 py-1 border-l border-white/5">
          <div className="w-7 h-7 rounded-lg bg-usdt-green/15 text-usdt-green flex items-center justify-center shrink-0">
            <Activity size={14} />
          </div>
          <div>
            <div className="text-[9px] font-extrabold text-text-tertiary uppercase leading-tight">Health</div>
            <div className="text-xs font-black text-usdt-green font-mono leading-tight">
              {fleetHealth}%
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-2 py-1 border-l border-white/5">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
            activeCount > 0 ? 'bg-ton-blue/15 text-ton-blue' : 'bg-amber-500/15 text-amber-400'
          }`}>
            <ShieldCheck size={14} />
          </div>
          <div>
            <div className="text-[9px] font-extrabold text-text-tertiary uppercase leading-tight">Status</div>
            <div className={`text-xs font-black font-mono leading-tight ${
              activeCount > 0 ? 'text-ton-blue' : 'text-amber-400'
            }`}>
              {activeCount > 0 ? 'OPTIMAL' : 'PAUSED'}
            </div>
          </div>
        </div>
      </div>

      {/* PROMINENT MACHINE SELECTOR CARDS */}
      <div>
        <div className="text-[10px] font-extrabold text-text-tertiary uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>Tap Machine for Controls</span>
          {activeControlsTier && (
            <span className="text-[9px] text-usdt-green font-mono">Controls Active</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {(Array.isArray(ownedTierCodes) ? ownedTierCodes : ['TS_TRIAL']).map((tierCode) => {
            const isSelected = selectedTierCode.toUpperCase() === tierCode.toUpperCase();
            const isControlsOpen = activeControlsTier?.toUpperCase() === tierCode.toUpperCase();
            const catalogItem = MACHINE_CATALOG.find((m) => m.tierCode.toUpperCase() === tierCode.toUpperCase()) || MACHINE_CATALOG[0];
            const rec = ownerships[tierCode.toUpperCase()];
            const displayName = rec?.nickname || catalogItem.name;
            const isRunning = (rec?.status || 'RUNNING') === 'RUNNING';

            return (
              <button
                key={tierCode}
                onClick={() => handleMachineTap(tierCode)}
                className={`p-3 rounded-2xl border text-left flex flex-col justify-between gap-2.5 transition-all press-feedback relative overflow-hidden ${
                  isControlsOpen
                    ? 'bg-gradient-to-br from-usdt-green/25 via-[#0f171e] to-card-bg border-usdt-green text-text-primary shadow-lg shadow-usdt-green/20 ring-1 ring-usdt-green/50'
                    : isSelected
                    ? 'bg-white/10 border-usdt-green/60 text-text-primary'
                    : 'bg-white/5 border-white/10 text-text-secondary hover:border-white/20 hover:bg-white/10'
                }`}
              >
                {/* Active Indicator Top Highlight */}
                {isControlsOpen && (
                  <div className="absolute top-0 right-0 left-0 h-0.5 bg-gradient-to-r from-transparent via-usdt-green to-transparent" />
                )}

                <div className="flex items-start justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                      isControlsOpen ? 'bg-usdt-green text-app-bg' : 'bg-white/10 text-text-tertiary'
                    }`}>
                      ⚡
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-text-primary leading-tight line-clamp-1">
                        {displayName}
                      </h4>
                      <span className="text-[9px] font-mono text-text-tertiary leading-tight block">
                        {catalogItem.tierLabel || 'Trial Node'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-white/5">
                  <span className="text-[10px] font-mono font-extrabold text-usdt-green flex items-center gap-1">
                    <Zap size={11} />
                    {catalogItem.capacityGhs || 10} GH/s
                  </span>

                  <span className={`text-[9px] font-mono font-black uppercase px-1.5 py-0.5 rounded flex items-center gap-1 border ${
                    isControlsOpen
                      ? 'text-usdt-green bg-usdt-green/20 border-usdt-green/40'
                      : isRunning
                      ? 'text-usdt-green bg-usdt-green/10 border-usdt-green/20'
                      : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                  }`}>
                    <Sliders size={9} />
                    {isControlsOpen ? 'Open' : rec?.status || 'RUNNING'}
                  </span>
                </div>
              </button>
            );
          })}

          {/* Add Machine Expansion Card */}
          <button
            onClick={onOpenShop}
            className="p-3 rounded-2xl border border-dashed border-usdt-green/40 hover:border-usdt-green/70 bg-usdt-green/5 hover:bg-usdt-green/10 text-usdt-green flex flex-col items-center justify-center gap-1.5 transition-all press-feedback min-h-[86px]"
          >
            <div className="w-8 h-8 rounded-xl bg-usdt-green/15 text-usdt-green flex items-center justify-center">
              <PlusCircle size={18} />
            </div>
            <span className="text-xs font-extrabold">Add Machine</span>
            <span className="text-[9px] text-text-tertiary">Expand Fleet</span>
          </button>
        </div>

        {/* CONTROLS DRAWER: ONLY APPEARS WHEN A PARTICULAR MACHINE IS TAPPED */}
        <AnimatePresence>
          {activeControlsTier && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 10 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="overflow-hidden"
            >
              <MachineControlCenter
                activeTierCode={activeControlsTier}
                onOpenShop={onOpenShop}
                onOpenHealthModal={onOpenHealthModal}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
