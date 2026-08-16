import type React from 'react';
import { motion } from 'framer-motion';
import { Cpu, Zap, Activity, ShieldCheck, PlusCircle, HelpCircle } from 'lucide-react';
import { useMiningStore } from '../../../store/useMiningStore';
import { useMachineOwnershipStore } from '../../../store/useMachineOwnershipStore';
import { MACHINE_CATALOG } from '../../../data/machines';

interface FleetOverviewCardProps {
  onOpenShop: () => void;
  onSelectTier: (tierCode: string) => void;
  selectedTierCode: string;
  onOpenHowItWorks?: () => void;
}

export const FleetOverviewCard: React.FC<FleetOverviewCardProps> = ({
  onOpenShop,
  onSelectTier,
  selectedTierCode,
  onOpenHowItWorks,
}) => {
  const { userMachines, ownedTierCodes, baseSpeedGhs } = useMiningStore();
  const { ownerships } = useMachineOwnershipStore();

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="web3-card rounded-2xl p-4 border border-white/10 relative overflow-hidden"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-extrabold text-text-tertiary uppercase tracking-wider flex items-center gap-2">
          <Cpu size={14} className="text-usdt-green" />
          Your Machines
        </h3>
        <div className="flex items-center gap-2">
          {onOpenHowItWorks && (
            <button
              onClick={onOpenHowItWorks}
              className="text-[10px] font-extrabold text-gold bg-gold/10 px-2 py-0.5 rounded-full border border-gold/30 flex items-center gap-1 hover:bg-gold/20 active:scale-95 transition-all"
            >
              <HelpCircle size={10} /> How It Works & FAQs
            </button>
          )}
          <span className="text-[10px] font-mono text-usdt-green bg-usdt-green/10 px-2 py-0.5 rounded-full border border-usdt-green/20">
            {activeCount}/{totalMachinesCount} ACTIVE
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-control-bg/60 rounded-xl p-2.5 border border-white/5">
          <div className="text-[9px] font-bold text-text-tertiary uppercase">Total Power</div>
          <div className="text-sm font-black text-text-primary font-mono mt-1">
            {(baseSpeedGhs * 10).toFixed(0)} Power
          </div>
        </div>

        <div className="bg-control-bg/60 rounded-xl p-2.5 border border-white/5">
          <div className="text-[9px] font-bold text-text-tertiary uppercase">Machine Health</div>
          <div className="text-sm font-black text-usdt-green font-mono mt-1">
            {fleetHealth}%
          </div>
        </div>

        <div className="bg-control-bg/60 rounded-xl p-2.5 border border-white/5">
          <div className="text-[9px] font-bold text-text-tertiary uppercase">Status</div>
          <div className="text-sm font-black text-ton-blue font-mono mt-1">
            OPTIMAL
          </div>
        </div>
      </div>

      {/* Selector pills for owned machines */}
      <div className="flex gap-2 items-center overflow-x-auto no-scrollbar pt-1">
        {(Array.isArray(ownedTierCodes) ? ownedTierCodes : ['TS_TRIAL']).map((tierCode) => {
          const isSelected = selectedTierCode.toUpperCase() === tierCode.toUpperCase();
          const catalogItem = MACHINE_CATALOG.find((m) => m.tierCode.toUpperCase() === tierCode.toUpperCase()) || MACHINE_CATALOG[0];
          const rec = ownerships[tierCode.toUpperCase()];
          const displayName = rec?.nickname || catalogItem.name;

          return (
            <button
              key={tierCode}
              onClick={() => onSelectTier(tierCode)}
              className={`py-1.5 px-3 rounded-xl border text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition-all press-feedback ${
                isSelected
                  ? 'bg-usdt-green/20 border-usdt-green text-usdt-green shadow-md shadow-usdt-green/10'
                  : 'bg-white/5 border-white/10 text-text-secondary hover:border-white/20'
              }`}
            >
              <Zap size={12} className={isSelected ? 'text-usdt-green' : 'text-text-tertiary'} />
              <span>{displayName}</span>
            </button>
          );
        })}

        <button
          onClick={onOpenShop}
          className="py-1.5 px-3 rounded-xl border border-dashed border-usdt-green/40 text-usdt-green hover:bg-usdt-green/10 text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap transition-colors"
        >
          <PlusCircle size={13} />
          <span>Add Machine</span>
        </button>
      </div>
    </motion.div>
  );
};
