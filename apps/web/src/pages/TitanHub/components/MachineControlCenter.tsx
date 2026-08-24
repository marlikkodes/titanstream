import type React from 'react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, RotateCw, Edit3, BookOpen, Award, Activity, Check, X, RefreshCw } from 'lucide-react';
import { useMachineOwnershipStore } from '../../../store/useMachineOwnershipStore';
import { MACHINE_CATALOG } from '../../../data/machines';
import { showToast } from '../../../components/Toast';

interface MachineControlCenterProps {
  activeTierCode: string;
  onOpenShop?: () => void;
  onOpenHealthModal?: () => void;
}

export const MachineControlCenter: React.FC<MachineControlCenterProps> = ({
  activeTierCode,
  onOpenHealthModal,
}) => {
  // Subscribe reactively to state in useMachineOwnershipStore
  const ownerships = useMachineOwnershipStore((s) => s.ownerships);
  const setMachineStatus = useMachineOwnershipStore((s) => s.setMachineStatus);
  const setMachineNickname = useMachineOwnershipStore((s) => s.setMachineNickname);
  const openOwnersManual = useMachineOwnershipStore((s) => s.openOwnersManual);
  const openCertificate = useMachineOwnershipStore((s) => s.openCertificate);
  const addTimelineEvent = useMachineOwnershipStore((s) => s.addTimelineEvent);

  const normTier = (activeTierCode || 'TS_TRIAL').trim().toUpperCase();
  const record = ownerships[normTier] || useMachineOwnershipStore.getState().getRecordByTier(normTier);
  const catalogItem = MACHINE_CATALOG.find((m) => m.tierCode.toUpperCase() === normTier) || MACHINE_CATALOG[0];

  const [isEditingName, setIsEditingName] = useState(false);
  const [nicknameInput, setNicknameInput] = useState(record?.nickname || catalogItem.name);

  // Reboot State & Telemetry
  const [isRebooting, setIsRebooting] = useState(false);
  const [rebootStep, setRebootStep] = useState(0);

  if (!record) return null;

  const rebootSteps = [
    'Flushing SRAM memory buffers...',
    'Calibrating hash blade frequency...',
    'Re-establishing stratum node session...',
    'Reboot complete!',
  ];

  const handleToggleState = (targetStatus: 'RUNNING' | 'PAUSED') => {
    setMachineStatus(normTier, targetStatus);
    if (targetStatus === 'PAUSED') {
      showToast(`⏸️ ${record.nickname} Paused — Hash generation on hold`, 'warning');
    } else {
      showToast(`▶️ ${record.nickname} Resumed — Hash rate active`, 'info');
    }
  };

  const handleRestart = async () => {
    setIsRebooting(true);
    setRebootStep(0);
    setMachineStatus(normTier, 'PAUSED');

    for (let i = 0; i < rebootSteps.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setRebootStep(i);
    }

    setMachineStatus(normTier, 'RUNNING');
    addTimelineEvent(normTier, 'Hardware Reboot Completed', 'SRAM memory cleared, hash frequency recalibrated, stratum session restored.');
    showToast(`🔄 ${record.nickname} Reboot Complete — 100% capacity restored`, 'info');
    setIsRebooting(false);
  };

  const handleSaveName = () => {
    if (nicknameInput.trim()) {
      setMachineNickname(normTier, nicknameInput.trim());
      showToast(`✏️ Machine renamed to "${nicknameInput.trim()}"`, 'info');
    }
    setIsEditingName(false);
  };

  const isRunning = record.status === 'RUNNING';

  return (
    <motion.div
      key={normTier}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="bg-black/40 border border-white/10 rounded-2xl p-3.5 relative overflow-hidden flex flex-col gap-3 mt-1"
    >
      {/* Subtle mood backlight based on running state */}
      <div
        className={`absolute top-0 right-0 w-36 h-36 rounded-full blur-3xl opacity-15 pointer-events-none ${
          isRunning ? 'bg-usdt-green' : 'bg-amber-500'
        }`}
      />

      {/* MACHINE ACTION DRAWER HEADER */}
      <div className="relative flex items-center justify-between pb-2.5 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            {isEditingName ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  className="bg-black/60 border border-usdt-green/50 text-text-primary font-black text-xs px-2 py-0.5 rounded-md focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  className="p-1 text-usdt-green hover:bg-usdt-green/10 rounded-md"
                >
                  <Check size={13} />
                </button>
                <button
                  onClick={() => setIsEditingName(false)}
                  className="p-1 text-text-tertiary hover:bg-white/10 rounded-md"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <>
                <h4 className="text-xs font-black text-text-primary tracking-wide flex items-center gap-1.5">
                  {record.nickname} Actions
                </h4>
                <button
                  onClick={() => {
                    setNicknameInput(record.nickname);
                    setIsEditingName(true);
                  }}
                  className="text-text-tertiary hover:text-usdt-green p-0.5 rounded transition-colors"
                  title="Rename machine"
                >
                  <Edit3 size={12} />
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] font-mono text-text-tertiary">{record.serialNumber}</span>
            <span className="text-[9px] font-bold text-ton-blue bg-ton-blue/10 px-1.5 py-0.2 rounded border border-ton-blue/20">
              {catalogItem.tierLabel}
            </span>
          </div>
        </div>

        {/* State Pill */}
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-usdt-green animate-pulse' : 'bg-amber-400'}`} />
          <span className={`text-[10px] font-black uppercase font-mono px-2 py-0.5 rounded-md border ${
            isRunning
              ? 'text-usdt-green bg-usdt-green/10 border-usdt-green/20'
              : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
          }`}>
            {record.status}
          </span>
        </div>
      </div>

      {/* REBOOT OVERLAY PROGRESS BAR */}
      {isRebooting && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="p-2.5 bg-usdt-green/10 border border-usdt-green/30 rounded-xl space-y-1.5"
        >
          <div className="flex items-center justify-between text-xs font-mono font-bold text-usdt-green">
            <span className="flex items-center gap-1.5">
              <RefreshCw size={13} className="animate-spin text-usdt-green" />
              {rebootSteps[rebootStep]}
            </span>
            <span>{Math.round(((rebootStep + 1) / rebootSteps.length) * 100)}%</span>
          </div>
          <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-usdt-green"
              animate={{ width: `${((rebootStep + 1) / rebootSteps.length) * 100}%` }}
            />
          </div>
        </motion.div>
      )}

      {/* PRIMARY OPERATIONAL CONTROLS */}
      <div className="grid grid-cols-3 gap-2">
        {isRunning ? (
          <button
            onClick={() => handleToggleState('PAUSED')}
            disabled={isRebooting}
            className="py-2 px-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 font-extrabold text-xs flex items-center justify-center gap-1.5 hover:bg-amber-500/25 disabled:opacity-50 transition-colors press-feedback"
          >
            <Pause size={14} />
            Pause
          </button>
        ) : (
          <button
            onClick={() => handleToggleState('RUNNING')}
            disabled={isRebooting}
            className="py-2 px-3 rounded-xl bg-usdt-green/15 border border-usdt-green/30 text-usdt-green font-extrabold text-xs flex items-center justify-center gap-1.5 hover:bg-usdt-green/25 disabled:opacity-50 transition-colors press-feedback"
          >
            <Play size={14} />
            Start
          </button>
        )}

        <button
          onClick={handleRestart}
          disabled={isRebooting}
          className="py-2 px-3 rounded-xl bg-white/5 border border-white/10 text-text-secondary font-extrabold text-xs flex items-center justify-center gap-1.5 hover:border-white/20 hover:text-text-primary disabled:opacity-50 transition-colors press-feedback"
        >
          <RotateCw size={14} className={isRebooting ? 'animate-spin text-usdt-green' : ''} />
          Restart
        </button>

        <button
          onClick={onOpenHealthModal}
          disabled={isRebooting}
          className="py-2 px-3 rounded-xl bg-usdt-green/10 border border-usdt-green/25 text-usdt-green font-extrabold text-xs flex items-center justify-center gap-1.5 hover:bg-usdt-green/20 disabled:opacity-50 transition-colors press-feedback"
        >
          <Activity size={14} />
          Health
        </button>
      </div>

      {/* DOCUMENTATION & OWNERSHIP ARTIFACT ACTIONS */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
        <button
          onClick={() => openOwnersManual(normTier)}
          className="py-2 px-3 rounded-xl bg-ton-blue/10 border border-ton-blue/20 text-ton-blue font-extrabold text-xs flex items-center justify-center gap-1.5 hover:bg-ton-blue/20 transition-colors press-feedback"
        >
          <BookOpen size={14} />
          Owner's Manual
        </button>
        <button
          onClick={() => openCertificate(record.machineId)}
          className="py-2 px-3 rounded-xl bg-gold/10 border border-gold/20 text-gold font-extrabold text-xs flex items-center justify-center gap-1.5 hover:bg-gold/20 transition-colors press-feedback"
        >
          <Award size={14} />
          Certificate
        </button>
      </div>
    </motion.div>
  );
};
