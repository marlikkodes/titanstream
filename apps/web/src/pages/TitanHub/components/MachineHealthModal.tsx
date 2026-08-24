import type React from 'react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Thermometer,
  Wind,
  Cpu,
  RefreshCw,
  Wrench,
  CheckCircle2,
  X,
  Zap,
  Gauge,
} from 'lucide-react';
import { useMachineOwnershipStore } from '../../../store/useMachineOwnershipStore';
import { showToast } from '../../../components/Toast';

interface MachineHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  tierCode: string;
}

export const MachineHealthModal: React.FC<MachineHealthModalProps> = ({
  isOpen,
  onClose,
  tierCode,
}) => {
  const { getRecordByTier, addTimelineEvent } = useMachineOwnershipStore();
  const record = getRecordByTier(tierCode);

  const [isDiagnosticRunning, setIsDiagnosticRunning] = useState(false);
  const [diagnosticStep, setDiagnosticStep] = useState(0);
  const [diagnosticLogs, setDiagnosticLogs] = useState<string[]>([]);
  const [diagnosticComplete, setDiagnosticComplete] = useState(false);
  const [isPerformingMaintenance, setIsPerformingMaintenance] = useState(false);
  const [maintenanceSuccess, setMaintenanceSuccess] = useState(false);

  if (!isOpen || !record) return null;

  const diagnosticSteps = [
    'Initializing hardware bus diagnostic sweep...',
    'Testing Hash Board 1 & 2 chip integrity (64/64 chips)...',
    'Checking thermal sensor calibration & fan tachometers...',
    'Verifying node network ping & stratum buffer sync...',
    'Diagnostic sweep completed successfully.',
  ];

  const handleRunDiagnostic = async () => {
    setIsDiagnosticRunning(true);
    setDiagnosticComplete(false);
    setDiagnosticLogs([]);
    setDiagnosticStep(0);

    for (let i = 0; i < diagnosticSteps.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setDiagnosticStep(i);
      setDiagnosticLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${diagnosticSteps[i]}`]);
    }

    setIsDiagnosticRunning(false);
    setDiagnosticComplete(true);
    addTimelineEvent(tierCode, 'Health Check Executed', 'Hardware diagnostic pass complete: 0 chip errors detected, 100% operational integrity.');
    showToast(`🟢 Health Check Complete: ${record.nickname} systems optimal`, 'info');
  };

  const handlePerformMaintenance = async () => {
    setIsPerformingMaintenance(true);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setIsPerformingMaintenance(false);
    setMaintenanceSuccess(true);
    addTimelineEvent(tierCode, 'Thermal Maintenance', 'Thermal paste refreshed & dust cleared. Heat dissipation optimal.');
    showToast(`🛠️ Maintenance Complete: ${record.nickname} thermal load optimized`, 'info');
    setTimeout(() => setMaintenanceSuccess(false), 3000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="relative w-full max-w-lg bg-[#0d1319] border border-usdt-green/30 rounded-3xl p-5 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            {/* Header Ambient Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-24 bg-usdt-green/10 rounded-full blur-3xl pointer-events-none" />

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-text-tertiary hover:text-text-primary bg-white/5 hover:bg-white/10 rounded-full transition-colors z-10"
            >
              <X size={18} />
            </button>

            {/* Modal Title Header */}
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/10 shrink-0">
              <div className="w-11 h-11 rounded-2xl bg-usdt-green/15 border border-usdt-green/40 flex items-center justify-center text-usdt-green shadow-lg shadow-usdt-green/10">
                <Activity size={24} />
              </div>
              <div>
                <h3 className="text-base font-black text-text-primary flex items-center gap-2">
                  {record.nickname}
                  <span className="text-[10px] font-mono font-black text-usdt-green bg-usdt-green/15 border border-usdt-green/30 px-2 py-0.5 rounded-full uppercase">
                    {record.status}
                  </span>
                </h3>
                <p className="text-xs text-text-tertiary font-mono">
                  {record.serialNumber} • Machine Telemetry & Diagnostics
                </p>
              </div>
            </div>

            {/* Scrollable Content Body */}
            <div className="overflow-y-auto no-scrollbar space-y-4 pr-1">

              {/* Real-time Telemetry Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* Thermal Metric */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-text-tertiary">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                      <Thermometer size={12} className="text-amber-400" />
                      Thermal Load
                    </span>
                    <span className="text-[10px] font-mono font-bold text-usdt-green">42°C</span>
                  </div>
                  <div className="mt-2">
                    <div className="text-lg font-black font-mono text-text-primary">42.5°C</div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-usdt-green via-amber-400 to-red-500 w-[42%]" />
                    </div>
                    <div className="text-[9px] text-text-tertiary mt-1">Safe Operating Range (&lt; 75°C)</div>
                  </div>
                </div>

                {/* Cooling System */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-text-tertiary">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                      <Wind size={12} className="text-ton-blue" />
                      Cooling Fans
                    </span>
                    <span className="text-[10px] font-mono font-bold text-ton-blue">100%</span>
                  </div>
                  <div className="mt-2">
                    <div className="text-lg font-black font-mono text-text-primary">3,420 RPM</div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full bg-ton-blue w-[78%]" />
                    </div>
                    <div className="text-[9px] text-text-tertiary mt-1">Dual Tachometers Active</div>
                  </div>
                </div>

                {/* Hash Board Integrity */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-text-tertiary">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                      <Cpu size={12} className="text-usdt-green" />
                      Hash Chips
                    </span>
                    <span className="text-[10px] font-mono font-bold text-usdt-green">64/64</span>
                  </div>
                  <div className="mt-2">
                    <div className="text-lg font-black font-mono text-usdt-green">0.00% Errors</div>
                    <div className="text-[9px] text-text-tertiary mt-1">All ASICs responding nominal</div>
                  </div>
                </div>

                {/* Power Efficiency */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-text-tertiary">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                      <Zap size={12} className="text-gold" />
                      Efficiency
                    </span>
                    <span className="text-[10px] font-mono font-bold text-gold">Optimal</span>
                  </div>
                  <div className="mt-2">
                    <div className="text-lg font-black font-mono text-text-primary">0.038 J/GH</div>
                    <div className="text-[9px] text-text-tertiary mt-1">12.1 V Stable Input</div>
                  </div>
                </div>
              </div>

              {/* Diagnostic Run Console */}
              <div className="bg-black/50 border border-white/10 rounded-2xl p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                    <Gauge size={14} className="text-usdt-green" />
                    Deep Diagnostic Suite
                  </span>
                  <button
                    onClick={handleRunDiagnostic}
                    disabled={isDiagnosticRunning}
                    className="py-1.5 px-3 rounded-xl bg-usdt-green/20 hover:bg-usdt-green/30 border border-usdt-green/40 text-usdt-green font-extrabold text-xs flex items-center gap-1.5 disabled:opacity-50 transition-colors press-feedback"
                  >
                    <RefreshCw size={12} className={isDiagnosticRunning ? 'animate-spin' : ''} />
                    {isDiagnosticRunning ? 'Testing...' : 'Run Diagnostics'}
                  </button>
                </div>

                {/* Progress bar during diagnostic */}
                {isDiagnosticRunning && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-[10px] font-mono text-usdt-green">
                      <span>{diagnosticSteps[diagnosticStep]}</span>
                      <span>{Math.round(((diagnosticStep + 1) / diagnosticSteps.length) * 100)}%</span>
                    </div>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-usdt-green"
                        animate={{ width: `${((diagnosticStep + 1) / diagnosticSteps.length) * 100}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </div>
                )}

                {/* Diagnostic Console Output */}
                {diagnosticLogs.length > 0 && (
                  <div className="p-2.5 bg-black/60 rounded-xl border border-white/5 font-mono text-[10px] text-usdt-green space-y-1 max-h-32 overflow-y-auto no-scrollbar">
                    {diagnosticLogs.map((log, i) => (
                      <div key={i} className="flex items-start gap-1">
                        <span className="text-text-tertiary">&gt;</span>
                        <span>{log}</span>
                      </div>
                    ))}
                  </div>
                )}

                {diagnosticComplete && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-2.5 rounded-xl bg-usdt-green/15 border border-usdt-green/30 text-usdt-green text-xs font-bold flex items-center gap-2"
                  >
                    <CheckCircle2 size={16} className="shrink-0" />
                    <span>SYSTEM INTEGRITY 100%: All 64 hash chips online with 0 hardware faults.</span>
                  </motion.div>
                )}
              </div>

              {/* Quick Thermal Maintenance Tool */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-black text-text-primary flex items-center gap-1.5">
                    <Wrench size={14} className="text-amber-400" />
                    Thermal Maintenance
                  </div>
                  <div className="text-[10px] text-text-tertiary">
                    Clear dust filter and optimize fan voltage algorithm.
                  </div>
                </div>

                <button
                  onClick={handlePerformMaintenance}
                  disabled={isPerformingMaintenance}
                  className="py-1.5 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-400 font-black text-xs flex items-center gap-1.5 disabled:opacity-50 transition-colors press-feedback shrink-0"
                >
                  <Wrench size={12} className={isPerformingMaintenance ? 'animate-bounce' : ''} />
                  {isPerformingMaintenance ? 'Optimizing...' : 'Clean & Tune'}
                </button>
              </div>

              {maintenanceSuccess && (
                <div className="p-2 bg-amber-500/15 border border-amber-500/30 rounded-xl text-[10px] text-amber-400 font-bold flex items-center gap-1.5">
                  <CheckCircle2 size={14} />
                  <span>Thermal maintenance applied! Heat dissipation restored to 100%.</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="mt-4 pt-3 border-t border-white/10 flex justify-end shrink-0">
              <button
                onClick={onClose}
                className="py-2 px-5 rounded-xl bg-white/10 hover:bg-white/15 text-text-primary text-xs font-extrabold transition-colors press-feedback"
              >
                Close Diagnostic View
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
