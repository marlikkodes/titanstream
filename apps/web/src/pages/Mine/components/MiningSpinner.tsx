import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useMiningStore } from '../../../store/useMiningStore';
import { useWalletStore } from '../../../store/useWalletStore';
import { useTreasuryStore } from '../../../store/useTreasuryStore';
import { useHaptics } from '../../../hooks/useHaptics';
import { Flame, Thermometer, ChevronLeft, ChevronRight, Lock, Clock, Sparkles, CheckCircle, Zap } from 'lucide-react';
import { showToast } from '../../../components/Toast';
import { useNavigationStore } from '../../../store/useNavigationStore';
import { useCountryStore } from '../../../store/useCountryStore';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { QuantumLoopReactor, type QuantumLoopReactorRef } from './QuantumLoopReactor';
import { useMachineOwnershipStore } from '../../../store/useMachineOwnershipStore';

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotSpeed: number;
  text: string;
}

interface SmokeParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
}

import { MACHINE_CATALOG, getMachineYieldDetails, type FrontendMachineModel } from '../../../data/machines';

interface SpinnerModel {
  id: string;
  tierCode: string;
  name: string;
  desc: string;
  technicalSummary: string;
  simpleExplanation: string;
  icon: string;
  color: string;
  minBoostGhs: number;
  baseSpeedMultiplier: number;
  payoutMultiplier: number;
  spinDurationSeconds: number;
  powerRatingW: number;
  dailyYieldUsdt: number;
  earningsCap?: number;
  durationHours?: number;
  promoSpinnerSpeedMultiplier?: number;
  promoOutputCap?: number;
  promoYieldRate?: number;
}

const USDT_SPINNERS: SpinnerModel[] = MACHINE_CATALOG.map((m, idx) => {
  const spinDurationSeconds = Math.max(0.8, 4.5 / m.spinnerSpeedMultiplier);
  return {
    id: m.id,
    tierCode: m.tierCode,
    name: m.name,
    desc: m.description,
    technicalSummary: m.technicalSummary,
    simpleExplanation: m.simpleExplanation,
    icon: m.icon,
    color: m.tierCode === 'TS_C10' ? '#26a17b'
         : m.tierCode === 'TS_A50' ? '#ff9100'
         : m.tierCode === 'TS_P250' ? '#10b981'
         : m.tierCode === 'TS_X1000' ? '#e040fb'
         : '#00b0ff',
    minBoostGhs: idx === 0 ? 0 : m.capacityGhs,
    baseSpeedMultiplier: m.spinnerSpeedMultiplier,
    payoutMultiplier: m.dailyYieldUsdt,
    spinDurationSeconds,
    powerRatingW: m.powerRatingW,
    dailyYieldUsdt: m.dailyYieldUsdt,
    earningsCap: m.earningsCap,
    durationHours: m.durationHours,
    promoSpinnerSpeedMultiplier: m.promoSpinnerSpeedMultiplier,
    promoOutputCap: m.promoOutputCap,
    promoYieldRate: m.promoYieldRate,
  };
});

const TON_SPINNERS: SpinnerModel[] = MACHINE_CATALOG.map((m, idx) => {
  const spinDurationSeconds = Math.max(0.6, 3.6 / (m.spinnerSpeedMultiplier * 1.25));
  return {
    id: `ton-${m.id}`,
    tierCode: m.tierCode,
    name: `TON ${m.name}`,
    desc: `TON-optimized ${m.description.toLowerCase()}`,
    technicalSummary: m.technicalSummary,
    simpleExplanation: `TON Node: ${m.simpleExplanation}`,
    icon: '💎',
    color: m.tierCode === 'TS_C10' ? '#00b0ff'
         : m.tierCode === 'TS_A50' ? '#00e5ff'
         : m.tierCode === 'TS_P250' ? '#3f51b5'
         : m.tierCode === 'TS_X1000' ? '#7c4dff'
         : '#00e676',
    minBoostGhs: idx === 0 ? 0 : m.capacityGhs * 1.2,
    baseSpeedMultiplier: m.spinnerSpeedMultiplier * 1.25,
    payoutMultiplier: m.dailyYieldUsdt * 1.15,
    spinDurationSeconds,
    powerRatingW: Math.round(m.powerRatingW * 1.1),
    dailyYieldUsdt: m.dailyYieldUsdt * 1.15,
    earningsCap: m.earningsCap,
    durationHours: m.durationHours,
    promoSpinnerSpeedMultiplier: m.promoSpinnerSpeedMultiplier ? m.promoSpinnerSpeedMultiplier * 1.25 : undefined,
    promoOutputCap: m.promoOutputCap,
    promoYieldRate: m.promoYieldRate ? m.promoYieldRate * 1.15 : undefined,
  };
});

export const MiningSpinner = React.memo(() => {
  // Stable individual selectors from useMiningStore to prevent redundant renders
  const activeCurrency = useMiningStore((s) => s.activeCurrency);
  const tap = useMiningStore((s) => s.tap);
  const coolerMultiplier = useMiningStore((s) => s.coolerMultiplier);
  const maxMultiplier = useMiningStore((s) => s.maxMultiplier);
  const isOverheated = useMiningStore((s) => s.isOverheated);
  const cooldownRemaining = useMiningStore((s) => s.cooldownRemaining);
  const baseSpeedGhs = useMiningStore((s) => s.baseSpeedGhs);
  const tapsToday = useMiningStore((s) => s.tapsToday);
  const tapsThisWeek = useMiningStore((s) => s.tapsThisWeek);
  const tapsThisMonth = useMiningStore((s) => s.tapsThisMonth);
  const dailyTapLimit = useMiningStore((s) => s.dailyTapLimit);
  const weeklyTapLimit = useMiningStore((s) => s.weeklyTapLimit);
  const monthlyTapLimit = useMiningStore((s) => s.monthlyTapLimit);
  const usdtSpinnerIdx = useMiningStore((s) => s.usdtSpinnerIdx);
  const tonSpinnerIdx = useMiningStore((s) => s.tonSpinnerIdx);
  const setUsdtSpinnerIdx = useMiningStore((s) => s.setUsdtSpinnerIdx);
  const setTonSpinnerIdx = useMiningStore((s) => s.setTonSpinnerIdx);
  const hasPurchasedMachine = useMiningStore((s) => s.hasPurchasedMachine);
  const isMiningLocked = useMiningStore((s) => s.isMiningLocked);
  const isMachineOwned = useMiningStore((s) => s.isMachineOwned);
  const machineMode = useMiningStore((s) => s.machineMode);
  const displayPromoOutput = useMiningStore((s) => s.displayPromoOutput);
  const tapYieldPerTap = useMiningStore((s) => s.tapYieldPerTap);
  const upgradeLimits = useMiningStore((s) => s.upgradeLimits);
  const ownedTierCodes = useMiningStore((s) => s.ownedTierCodes);
  const userMachines = useMiningStore((s) => s.userMachines);
  const ownerships = useMachineOwnershipStore((s) => s.ownerships);

  const { setActiveTab } = useNavigationStore();

  // Stable settings selectors
  const preferLocalCurrency = useSettingsStore((s) => s.preferLocalCurrency);
  const graphicsQuality = useSettingsStore((s) => s.graphicsQuality);
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);

  const { selectedCountry, getLocalAmount } = useCountryStore();
  const showLocal = preferLocalCurrency && !!selectedCountry && selectedCountry.code !== 'US';

  const isDailyLimitReached = tapsToday >= dailyTapLimit;
  const isWeeklyLimitReached = tapsThisWeek >= weeklyTapLimit;
  const isMonthlyLimitReached = tapsThisMonth >= monthlyTapLimit;
  const reactorRef = React.useRef<QuantumLoopReactorRef | null>(null);

  // V2 AI & Mechanical Telemetry State
  const AI_COMPUTE_STATUSES = [
    'Calibrating Compressor Intake Stage',
    'Balancing Counter-Turbine Discs',
    'Aligning Marine Hydrofoil Stream',
    'Locking Gyroscopic Gimbal Matrix',
    'Synchronizing Rotor Frequencies',
    'Stabilizing Quantum Reactor Core',
    'Optimizing Fluid Velocity Vectors',
    'Routing Neural Energy Packets',
    'Actuating Thermal Cooling Vanes',
    'Synchronizing Distributed Compute',
  ];
  const BOOT_STEPS = [
    'Connecting to Titan Grid...',
    'Synchronizing AI Core...',
    'Loading Quantum Reactor...',
    'Operator Connected.',
  ];

  const [statusIdx, setStatusIdx] = useState(0);
  const [discoveryToast, setDiscoveryToast] = useState<string | null>(null);
  const [isBooting, setIsBooting] = useState(() => {
    if (typeof window !== 'undefined') {
      const booted = sessionStorage.getItem('tether_reactor_booted');
      return !booted;
    }
    return false;
  });
  const [bootStep, setBootStep] = useState(0);

  // Status Ticker Timer (Req 11)
  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIdx((prev) => (prev + 1) % AI_COMPUTE_STATUSES.length);
    }, 9000);
    return () => clearInterval(interval);
  }, []);

  // Session Boot Sequence (Req 19)
  useEffect(() => {
    if (!isBooting) return;
    const interval = setInterval(() => {
      setBootStep((prev) => {
        if (prev >= BOOT_STEPS.length - 1) {
          clearInterval(interval);
          setTimeout(() => {
            setIsBooting(false);
            sessionStorage.setItem('tether_reactor_booted', 'true');
          }, 400);
          return prev;
        }
        return prev + 1;
      });
    }, 450);

    return () => clearInterval(interval);
  }, [isBooting]);

  const handleDiscoveryEvent = (title: string) => {
    setDiscoveryToast(title);
    setTimeout(() => {
      setDiscoveryToast(null);
    }, 2800);
  };

  const isAnyLimitReached = isDailyLimitReached || isWeeklyLimitReached || isMonthlyLimitReached;
  const isUsdt = activeCurrency === 'USDT';
  const { impactOccurred } = useHaptics();
  const [particles, setParticles] = useState<Particle[]>([]);
  const [smoke, setSmoke] = useState<SmokeParticle[]>([]);
  
  // Retrieve active spinner values from store
  const activeSpinners = isUsdt ? USDT_SPINNERS : TON_SPINNERS;
  const activeSpinnerIdx = isUsdt ? usdtSpinnerIdx : tonSpinnerIdx;
  const activeSpinner = activeSpinners[activeSpinnerIdx];

  const currentTierCode = (activeSpinner?.tierCode || 'TS_TRIAL').toUpperCase();
  const currentMachineRecord = ownerships[currentTierCode] || useMachineOwnershipStore.getState().getRecordByTier(currentTierCode);
  const isMachinePaused = currentMachineRecord?.status === 'PAUSED';

  // DOM Refs for direct GPU-accelerated rotation updates (Phase 3 & Phase 5)
  const rotorPrimaryRef = React.useRef<HTMLDivElement>(null);
  const rotorSecondaryRef = React.useRef<HTMLDivElement>(null);
  const rotorTertiaryRef = React.useRef<HTMLDivElement>(null);

  // Fan spinning speed — driven entirely by unified mining state and updated via DOM Refs
  useEffect(() => {
    let animFrame: number;
    let lastTime = performance.now();
    let currentRotation = 0;
    const isLocked = isMiningLocked();

    const animate = (time: number) => {
      const delta = time - lastTime;
      lastTime = time;

      const configMultiplier =
        machineMode === 'PROMOTIONAL' && activeSpinner.promoSpinnerSpeedMultiplier
          ? activeSpinner.promoSpinnerSpeedMultiplier
          : activeSpinner.baseSpeedMultiplier;

      const intensity = 0.4 + 0.6 * Math.min(1, (Number(coolerMultiplier) || 1) / maxMultiplier);
      const tapSurgeFactor = 1.0 + Math.max(0, coolerMultiplier - 1.0) * 2.0;
      const revolutionsPerSec = configMultiplier * intensity * tapSurgeFactor * 2.8;
      
      // Maintain continuous smooth rotation so spinner NEVER freezes or gets stuck unless paused
      const speedFactor = isMachinePaused ? 0 : (isOverheated ? 0.35 : (isLocked ? 0.2 : 1.0));
      const rotationSpeed = reducedMotion
        ? 0
        : (((revolutionsPerSec * speedFactor * 360) / 1000) * delta);

      currentRotation = (currentRotation + rotationSpeed) % 360;

      // Direct style updates bypass React reconciliation completely for maximum performance
      if (rotorPrimaryRef.current) {
        let factor = 1.0;
        if (activeSpinner.id === 'ripple-x14') factor = 1.2;
        else if (activeSpinner.id === 'surge-r28') factor = 1.1;
        else if (activeSpinner.id === 'torrent-v63') factor = 1.4;
        else if (activeSpinner.id === 'cascade-m91') factor = 1.8;
        else if (activeSpinner.id === 'streamtitan-2028' || activeSpinner.id === 'free-trial') factor = 1.3;
        rotorPrimaryRef.current.style.transform = `rotate(${currentRotation * factor}deg)`;
      }

      if (rotorSecondaryRef.current) {
        let factor = -1.5;
        if (activeSpinner.id === 'cascade-m91') factor = -1.3;
        else if (activeSpinner.id === 'streamtitan-2028') factor = -1.7;
        rotorSecondaryRef.current.style.transform = `rotate(${currentRotation * factor}deg)`;
      }

      if (rotorTertiaryRef.current) {
        const factor = 0.4;
        rotorTertiaryRef.current.style.transform = `rotate(${currentRotation * factor}deg)`;
      }

      animFrame = requestAnimationFrame(animate);
    };

    // Phase 6: Minimize / Tab visibility optimization
    const handleVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(animFrame);
      } else {
        lastTime = performance.now();
        animFrame = requestAnimationFrame(animate);
      }
    };

    animFrame = requestAnimationFrame(animate);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelAnimationFrame(animFrame);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [coolerMultiplier, isAnyLimitReached, isOverheated, activeSpinner.baseSpeedMultiplier, activeSpinner.promoSpinnerSpeedMultiplier, isMiningLocked, machineMode, maxMultiplier, reducedMotion, activeSpinner.id, isMachinePaused]);

  // Heat smoke generation when multiplier is high or overheated (Phase 8: battery optimization - skipped on low graphics)
  useEffect(() => {
    if (coolerMultiplier < 6.0 && !isOverheated) {
      if (smoke.length > 0) setSmoke([]);
      return;
    }
    if (graphicsQuality === 'low' || reducedMotion) {
      if (smoke.length > 0) setSmoke([]);
      return;
    }

    const interval = setInterval(() => {
      setSmoke((prev) => [
        ...prev.map((s) => ({
          ...s,
          y: s.y - 1.5,
          x: s.x + (Math.random() - 0.5) * 1.2,
          opacity: s.opacity - 0.05,
          size: s.size + 0.3,
        })).filter((s) => s.opacity > 0),
        {
          id: Math.random() + Date.now(),
          x: (Math.random() - 0.5) * 30,
          y: (Math.random() - 0.5) * 30 - 20,
          size: Math.random() * 4 + 4,
          opacity: 0.8,
        },
      ]);
    }, 80);

    return () => clearInterval(interval);
  }, [coolerMultiplier, isOverheated, smoke.length, graphicsQuality, reducedMotion]);

  // Live coin particle physics updating loop (skipped if low graphics)
  useEffect(() => {
    if (particles.length === 0) return;

    const interval = setInterval(() => {
      setParticles((prev) =>
        prev
          .map((p) => ({
            ...p,
            y: p.y + p.vy,
            x: p.x + p.vx,
            vy: p.vy + 0.12,
            rotation: p.rotation + p.rotSpeed,
          }))
          .filter((p) => p.y < 350)
      );
    }, 30);

    return () => clearInterval(interval);
  }, [particles.length]);

  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isOverheated) {
      impactOccurred('heavy');
      showToast(`🔥 Spinner overheated! Cool down period active (${cooldownRemaining || 15}s). No funds credited.`, 'error');
      return;
    }

    if (isAnyLimitReached) {
      impactOccurred('heavy');
      showToast(`Cooler threshold reached! Upgrade limit to resume.`, 'error');
      return;
    }

    if (isMiningLocked()) {
      impactOccurred('heavy');
      showToast(`This Machine tier is locked! Redirecting to the Cloud Machines hub.`, 'info');
      setActiveTab('boost');
      return;
    }

    const tapYield = tap(); // Triggers store tap action; server state becomes authoritative.
    if (tapYield < 0) {
      impactOccurred('heavy');
      showToast(`🔥 Spinner overheated! Cooler bar is full. Waiting for cool down.`, 'error');
      return;
    }

    impactOccurred('medium');
    reactorRef.current?.triggerTap();

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    const newParticle: Particle = {
      id: Date.now() + Math.random(),
      x: x + (Math.random() * 20 - 10),
      y: y - 10,
      vx: (Math.random() - 0.5) * 4,
      vy: -Math.random() * 5 - 4,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 12,
      text: isUsdt && showLocal && selectedCountry
        ? `+${selectedCountry.currencySymbol}${(tapYield * (Number(selectedCountry.exchangeRate) || 1)).toLocaleString(undefined, selectedCountry.numberFormat || { maximumFractionDigits: 2 })}`
        : `+${(Number(tapYield) || 0).toFixed(4)} ${activeCurrency}`,
    };

    setParticles((prev) => [...prev.slice(-12), newParticle]);
  };

  const temperature = Math.min(99.9, 30 + (coolerMultiplier - 1.0) * 3.2);

  // Derive dynamic color by blending currency theme and chosen spinner baseline theme color
  let dynamicColor = activeSpinner.color;
  if (isOverheated || temperature > 70) {
    dynamicColor = '#ff1744';
  } else if (temperature > 50) {
    const factor = Math.min(1.0, (temperature - 50) / 40);
    if (isUsdt) {
      dynamicColor = factor > 0.6 ? '#ff1744' : '#ff5722';
    } else {
      dynamicColor = factor > 0.6 ? '#d500f9' : '#00e5ff';
    }
  }

  const prevSpinner = () => {
    impactOccurred('light');
    if (isUsdt) {
      const prevVal = usdtSpinnerIdx === 0 ? USDT_SPINNERS.length - 1 : usdtSpinnerIdx - 1;
      setUsdtSpinnerIdx(prevVal);
    } else {
      const prevVal = tonSpinnerIdx === 0 ? TON_SPINNERS.length - 1 : tonSpinnerIdx - 1;
      setTonSpinnerIdx(prevVal);
    }
  };

  const nextSpinner = () => {
    impactOccurred('light');
    if (isUsdt) {
      const nextVal = usdtSpinnerIdx === USDT_SPINNERS.length - 1 ? 0 : usdtSpinnerIdx + 1;
      setUsdtSpinnerIdx(nextVal);
    } else {
      const nextVal = tonSpinnerIdx === TON_SPINNERS.length - 1 ? 0 : tonSpinnerIdx + 1;
      setTonSpinnerIdx(nextVal);
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center my-4 py-2 select-none w-full">
      
      {/* Ambient background glow aura */}
      <div
        className="absolute w-[290px] h-[290px] rounded-full blur-3xl opacity-45 pointer-events-none transition-all duration-500"
        style={{
          background: `radial-gradient(circle, ${dynamicColor} 0%, rgba(0,0,0,0) 70%)`,
        }}
      />

      {/* Overheat warning / Machine status banner overlay */}
      {isOverheated ? (
        <div className="mb-3.5 z-20 bg-rose-600/30 border border-rose-500 text-rose-300 text-[10px] font-black px-4 py-1.5 rounded-full flex items-center gap-1.5 uppercase tracking-widest shadow-xl animate-pulse backdrop-blur-md">
          <Flame size={14} className="animate-bounce text-rose-400" />
          <span>OVERHEATED — COOLING DOWN ({Math.ceil(cooldownRemaining)}s)</span>
        </div>
      ) : activeSpinner.id === 'free-trial' ? (
        <div className="mb-3.5 z-20 text-[10px] font-black px-4 py-1.5 rounded-full flex items-center gap-1.5 uppercase tracking-wider shadow-lg backdrop-blur-md transition-all bg-usdt-green/15 border border-usdt-green/40 text-usdt-green shadow-[0_0_12px_rgba(38,161,123,0.25)]">
          {machineMode === 'PROMOTIONAL' ? (
            <>
              <Clock size={13} className="animate-pulse text-usdt-green shrink-0" />
              <span>
                TITAN CORE • PROMOTIONAL ({showLocal ? `${getLocalAmount(displayPromoOutput)} / ${getLocalAmount(5.0)}` : `$${(Number(displayPromoOutput) || 0).toFixed(2)} / $5.00`})
              </span>
            </>
          ) : (
            <>
              <Sparkles size={13} className="text-usdt-green shrink-0" />
              <span>TITAN CORE • STANDARD MODE</span>
            </>
          )}
        </div>
      ) : isMachineOwned(activeSpinner.tierCode) ? (
        <div className="mb-3.5 z-20 bg-usdt-green/15 border border-usdt-green/40 text-usdt-green text-[10px] font-black px-4 py-1.5 rounded-full flex items-center gap-1.5 uppercase tracking-wider shadow-lg backdrop-blur-md">
          <CheckCircle size={13} className="text-usdt-green shrink-0" />
          <span>{activeSpinner.name.toUpperCase()} • PREMIUM ACTIVE</span>
        </div>
      ) : (
        <button
          onClick={() => setActiveTab('boost')}
          className="mb-3.5 z-20 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-400 text-[10px] font-black px-4 py-1.5 rounded-full flex items-center gap-1.5 uppercase tracking-wider shadow-lg backdrop-blur-md transition-all press-feedback"
        >
          <Lock size={13} className="text-amber-400 shrink-0" />
          <span>{activeSpinner.name.toUpperCase()} • LOCKED (TAP TO UNLOCK)</span>
        </button>
      )}

      {temperature > 70 ? (
        <div className="mb-3.5 z-20 bg-error-red/20 border border-error-red/40 text-error-red text-[9px] font-black px-3.5 py-1.5 rounded-full flex items-center gap-1 uppercase tracking-widest shadow-lg animate-pulse backdrop-blur-md">
          <Flame size={12} className="animate-bounce" /> OVERCLOCK ACTIVE
        </div>
      ) : null}

      {/* Interactive coin physics display overlays */}
      <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center overflow-visible">
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute flex flex-col items-center justify-center transition-opacity duration-300"
            style={{
              transform: `translate(${p.x}px, ${p.y}px)`,
              opacity: p.y > 250 ? 0 : 1, // fade near bottom
            }}
          >
            {/* Visual Coin Icon */}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center font-black text-sm border shadow-lg"
              style={{
                transform: `rotate(${p.rotation}deg)`,
                backgroundColor: `${dynamicColor}15`,
                borderColor: dynamicColor,
                color: dynamicColor,
                textShadow: `0 0 8px ${dynamicColor}`,
                boxShadow: `0 0 10px ${dynamicColor}40`,
              }}
            >
              {isUsdt ? (showLocal ? selectedCountry.currencySymbol : '₮') : '💎'}
            </div>

            {/* Float value text tag */}
            <span
              className="font-black text-[10px] font-mono whitespace-nowrap mt-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] px-1.5 py-0.5 rounded-md bg-[#090b11]/80 border border-white/5"
              style={{ color: dynamicColor }}
            >
              {p.text}
            </span>
          </div>
        ))}
      </div>

      {/* MAIN TURBINE INTERACTIVE WHEEL CONTAINER */}
      <div className="flex items-center justify-between w-full max-w-[320px] relative px-1">
        {/* Left selector arrow */}
        <button
          onClick={prevSpinner}
          className="press-feedback w-9 h-9 rounded-full bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 flex items-center justify-center text-text-secondary hover:text-text-primary transition-all z-20 shadow-md"
        >
          <ChevronLeft size={18} />
        </button>

        <motion.div
          onClick={handleTap}
          whileTap={!isMiningLocked() ? { scale: 0.93 } : { scale: 1.0 }}
          className="relative w-[216px] h-[216px] rounded-full glass-panel flex items-center justify-center cursor-pointer shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
          style={{
            boxShadow: `0 0 35px ${dynamicColor}25, inset 0 0 15px ${dynamicColor}10`,
            borderColor: `${dynamicColor}35`,
          }}
        >
          {/* Animated steam/smoke particles */}
          <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center overflow-visible">
            {smoke.map((s) => (
              <div
                key={s.id}
                className="absolute rounded-full bg-white/10 blur-[2px]"
                style={{
                  width: s.size,
                  height: s.size,
                  transform: `translate(${s.x}px, ${s.y}px)`,
                  opacity: s.opacity,
                }}
              />
            ))}
          </div>

          {/* INTERACTIVE TAP & HEAT BOOST PROGRESS RING (RESTORED AROUND SPINNER WHEEL) */}
          <svg className="absolute -inset-1.5 w-[228px] h-[228px] pointer-events-none z-20 overflow-visible">
            {/* Background progress track */}
            <circle
              cx="114"
              cy="114"
              r="108"
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="5"
            />
            {/* Active glowing boost progress arc */}
            <circle
              cx="114"
              cy="114"
              r="108"
              fill="none"
              stroke={dynamicColor}
              strokeWidth="5"
              strokeDasharray="678.58"
              strokeDashoffset={678.58 * (1 - Math.min(1.0, Math.max(0, (coolerMultiplier - 1.0) / Math.max(1, maxMultiplier - 1.0))))}
              strokeLinecap="round"
              style={{
                transformOrigin: '114px 114px',
                transform: 'rotate(-90deg)',
                transition: 'stroke-dashoffset 0.5s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.4s ease',
                filter: `drop-shadow(0 0 6px ${dynamicColor})`,
              }}
            />
          </svg>

          {/* Liquid Water cooling pipe loop for legacy mechanical machines */}
          {activeSpinner.id !== 'free-trial' && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
              <circle
                cx="108"
                cy="108"
                r="98"
                fill="none"
                stroke={`${dynamicColor}20`}
                strokeWidth="3"
              />
              <circle
                cx="108"
                cy="108"
                r="98"
                fill="none"
                stroke={dynamicColor}
                strokeWidth="3.5"
                strokeDasharray="12, 180"
                style={{
                  transformOrigin: 'center',
                  animation: isMachinePaused ? 'none' : `spin ${Math.max(0.5, 5 - coolerMultiplier * 0.2)}s linear infinite`,
                }}
              />
            </svg>
          )}

          <div className="absolute inset-2.5 rounded-full border border-white/5 pointer-events-none" />

          {/* DYNAMIC SPINNER RENDERING ENGINE */}
          
          {/* Floating Holographic Telemetry Data (Req 16) */}
          <div className="absolute -top-3 -left-2 z-20 pointer-events-none flex flex-col opacity-75 animate-pulse">
            <span className="text-[7px] font-mono font-bold text-cyan-400 uppercase tracking-tighter">AI LOAD</span>
            <span className="text-[9px] font-mono font-black text-cyan-200">
              {93 + Math.floor((Math.sin(Date.now() / 3500) + 1) * 2.5)}%
            </span>
          </div>
          <div className="absolute -top-3 -right-2 z-20 pointer-events-none flex flex-col items-end opacity-75 animate-pulse">
            <span className="text-[7px] font-mono font-bold text-cyan-400 uppercase tracking-tighter">COMPUTE</span>
            <span className="text-[9px] font-mono font-black text-cyan-200">
              {(8.1 + (Math.cos(Date.now() / 4000) + 1) * 0.25).toFixed(1)} TH/s
            </span>
          </div>
          <div className="absolute -bottom-2 right-1 z-20 pointer-events-none flex flex-col items-end opacity-75">
            <span className="text-[7px] font-mono font-bold text-emerald-400 uppercase tracking-tighter">NETWORK</span>
            <span className="text-[8px] font-mono font-bold text-emerald-300">SYNCED</span>
          </div>

          {/* Rare Discovery Event Toast (Req 18) */}
          {discoveryToast && (
            <div className="absolute -top-12 z-30 bg-cyan-950/80 border border-cyan-400 text-cyan-200 text-[9px] font-mono font-black px-3 py-1 rounded-full flex items-center gap-1.5 uppercase tracking-widest shadow-[0_0_20px_rgba(0,242,254,0.5)] animate-bounce backdrop-blur-md">
              <Sparkles size={12} className="text-cyan-300 animate-spin" />
              <span>{discoveryToast}</span>
            </div>
          )}

          {/* Session Boot Experience Overlay (Req 19) */}
          {isBooting && (
            <div className="absolute inset-0 rounded-full bg-black/90 backdrop-blur-md z-30 flex flex-col items-center justify-center p-4 text-center border border-cyan-500/40 animate-fade-in pointer-events-none">
              <div className="w-7 h-7 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mb-1.5" />
              <span className="text-[9px] font-mono font-black text-cyan-300 uppercase tracking-widest">
                {BOOT_STEPS[bootStep]}
              </span>
            </div>
          )}

          {/* Paused Machine Visual Overlay */}
          {isMachinePaused && (
            <div className="absolute inset-0 rounded-full bg-black/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-4 text-center border border-amber-500/40 animate-fade-in pointer-events-none">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-black text-lg mb-1 shadow-lg shadow-amber-500/20">
                ⏸️
              </div>
              <span className="text-[10px] font-mono font-black text-amber-400 uppercase tracking-widest">
                HASHING PAUSED
              </span>
              <span className="text-[8px] text-text-tertiary font-mono mt-0.5">
                Resume machine to generate yield
              </span>
            </div>
          )}

          {/* Canvas Physics Core Engine */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <QuantumLoopReactor
              ref={reactorRef}
              coolerMultiplier={coolerMultiplier}
              isOverheated={isOverheated}
              isLocked={isMiningLocked()}
              isPaused={isMachinePaused}
              onDiscoveryEvent={handleDiscoveryEvent}
              tierCode={activeSpinner.tierCode}
              tierIndex={activeSpinnerIdx}
            />
          </div>

          {/* TIER-SPECIFIC ROTORS & FANS OVERLAY ENGINE */}
          {(() => {
            const cleanId = activeSpinner.id.replace(/^ton-/, '');

            switch (cleanId) {
              case 'free-trial': // Tier 0: Titan Core — Experimental 3-Blade Micro-Rotor & Stabilization Fins
                return (
                  <>
                    <div className="absolute inset-0 pointer-events-none z-15">
                      <svg className="w-full h-full" viewBox="0 0 216 216">
                        <circle
                          cx="108"
                          cy="108"
                          r="88"
                          fill="none"
                          stroke={dynamicColor}
                          strokeWidth="1"
                          strokeDasharray="20 120"
                          opacity="0.3"
                          style={{
                            transformOrigin: 'center',
                            animation: isMachinePaused ? 'none' : `spin ${Math.max(0.3, 3.5 - coolerMultiplier * 0.2)}s linear infinite`,
                          }}
                        />
                      </svg>
                    </div>
                    {/* 3-Blade Micro-Rotor */}
                    <div
                      ref={rotorPrimaryRef}
                      className="absolute inset-4 rounded-full flex items-center justify-center pointer-events-none z-15"
                    >
                      {[...Array(3)].map((_, i) => (
                        <div
                          key={i}
                          className="absolute w-[24px] h-[76px] origin-bottom"
                          style={{
                            bottom: '50%',
                            transform: `rotate(${i * 120}deg)`,
                          }}
                        >
                          <svg className="w-full h-full" viewBox="0 0 24 76">
                            <path
                              d="M 12 76 L 9 20 L 2 5 L 12 0 L 22 5 L 15 20 Z"
                              fill={dynamicColor}
                              fillOpacity="0.4"
                              stroke={dynamicColor}
                              strokeWidth="1"
                            />
                            <circle cx="12" cy="5" r="2.5" fill="#ffffff" />
                          </svg>
                        </div>
                      ))}
                    </div>
                  </>
                );
 
              case 'ripple-x14': // Tier 1: Ripple X14 — 10-Blade Titanium Intake Compressor Stage
                return (
                  <>
                    <div className="absolute inset-0 pointer-events-none z-15">
                      <svg className="w-full h-full" viewBox="0 0 216 216">
                        <circle
                          cx="108"
                          cy="108"
                          r="92"
                          fill="none"
                          stroke={dynamicColor}
                          strokeWidth="1.8"
                          strokeDasharray="14 50"
                          opacity="0.4"
                          style={{
                            transformOrigin: 'center',
                            animation: `spin-reverse ${Math.max(0.15, 1.8 - coolerMultiplier * 0.1)}s linear infinite`,
                          }}
                        />
                      </svg>
                    </div>
                    {/* 10 Angled Compressor Blades */}
                    <div
                      ref={rotorPrimaryRef}
                      className="absolute inset-5 rounded-full flex items-center justify-center pointer-events-none z-15"
                    >
                      {[...Array(10)].map((_, i) => (
                        <div
                          key={i}
                          className="absolute w-[16px] h-[82px] origin-bottom rounded-t-sm"
                          style={{
                            bottom: '50%',
                            transform: `rotate(${i * 36}deg) skewY(18deg)`,
                            background: `linear-gradient(180deg, ${dynamicColor} 0%, rgba(15,23,42,0.95) 80%)`,
                            borderTop: `1.5px solid ${dynamicColor}`,
                            boxShadow: `0 0 8px ${dynamicColor}30`,
                          }}
                        />
                      ))}
                    </div>
                  </>
                );

              case 'surge-r28': // Tier 2: Surge R28 — Dual Counter-Rotating Turbine Discs
                return (
                  <>
                    {/* Outer Turbine Stage (Clockwise, 12 Curved Blades) */}
                    <div
                      ref={rotorPrimaryRef}
                      className="absolute inset-4 rounded-full flex items-center justify-center pointer-events-none z-15"
                    >
                      {[...Array(12)].map((_, i) => (
                        <div
                          key={i}
                          className="absolute w-[14px] h-[84px] origin-bottom rounded-t-full"
                          style={{
                            bottom: '50%',
                            transform: `rotate(${i * 30}deg)`,
                            background: `linear-gradient(180deg, ${dynamicColor} 0%, rgba(30,20,40,0.85) 85%)`,
                            opacity: 0.85,
                            boxShadow: `0 0 6px ${dynamicColor}25`,
                          }}
                        />
                      ))}
                    </div>

                    {/* Inner Turbine Stage (Counter-Clockwise, 12 Blades) */}
                    <div
                      ref={rotorSecondaryRef}
                      className="absolute inset-9 rounded-full flex items-center justify-center pointer-events-none z-15"
                    >
                      {[...Array(12)].map((_, i) => (
                        <div
                          key={i}
                          className="absolute w-[10px] h-[58px] origin-bottom rounded-t-full"
                          style={{
                            bottom: '50%',
                            transform: `rotate(${i * 30}deg)`,
                            background: `linear-gradient(180deg, #ffffff 0%, rgba(20,10,30,0.95) 90%)`,
                            opacity: 0.9,
                            boxShadow: `0 0 8px #ffffff40`,
                          }}
                        />
                      ))}
                    </div>
                  </>
                );

              case 'torrent-v63': // Tier 3: Torrent V63 — Ducted Marine Hydrofoil Impeller
                return (
                  <>
                    {/* Outer Marine Duct Ring */}
                    <div className="absolute inset-0 pointer-events-none z-15">
                      <svg className="w-full h-full" viewBox="0 0 216 216">
                        <circle
                          cx="108"
                          cy="108"
                          r="90"
                          fill="none"
                          stroke={dynamicColor}
                          strokeWidth="3"
                          strokeDasharray="45 130"
                          opacity="0.6"
                          style={{
                            transformOrigin: 'center',
                            animation: `spin ${Math.max(0.12, 1.4 - coolerMultiplier * 0.08)}s linear infinite`,
                          }}
                        />
                      </svg>
                    </div>
                    {/* 5 Wide Curved Hydrofoil Impellers */}
                    <div
                      ref={rotorPrimaryRef}
                      className="absolute inset-4 rounded-full flex items-center justify-center pointer-events-none z-15"
                    >
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className="absolute w-[32px] h-[80px] origin-bottom"
                          style={{
                            bottom: '50%',
                            transform: `rotate(${i * 72}deg)`,
                          }}
                        >
                          <svg className="w-full h-full" viewBox="0 0 32 80">
                            <path
                              d="M 16 80 Q 28 40 32 10 Q 16 0 4 10 Q 8 40 16 80 Z"
                              fill={dynamicColor}
                              fillOpacity="0.75"
                              stroke="#ffffff"
                              strokeWidth="0.8"
                            />
                          </svg>
                        </div>
                      ))}
                    </div>
                  </>
                );

              case 'cascade-m91': // Tier 4: Cascade M91 — Multi-Axis Gyroscopic Gimbal & Articulated Flywheel
                return (
                  <>
                    {/* Outer Pitch Gimbal Ring */}
                    <div
                      className="absolute inset-3 rounded-full border-2 border-dashed border-purple-400/50 pointer-events-none z-15 animate-spin"
                      style={{ animationDuration: `${Math.max(1.2, 4.0 - coolerMultiplier * 0.3)}s` }}
                    />
                    {/* Inner Roll Gimbal Ring */}
                    <div
                      ref={rotorSecondaryRef}
                      className="absolute inset-7 rounded-full border-2 border-cyan-400/60 pointer-events-none z-15"
                    />
                    {/* Central 6-Blade Articulated Flywheel */}
                    <div
                      ref={rotorPrimaryRef}
                      className="absolute inset-8 rounded-full flex items-center justify-center pointer-events-none z-15"
                    >
                      {[...Array(6)].map((_, i) => (
                        <div
                          key={i}
                          className="absolute w-[18px] h-[64px] origin-bottom rounded-t-xl"
                          style={{
                            bottom: '50%',
                            transform: `rotate(${i * 60}deg)`,
                            background: `linear-gradient(180deg, #e040fb 0%, rgba(15,23,42,0.95) 85%)`,
                            boxShadow: `0 0 12px #e040fb60`,
                          }}
                        />
                      ))}
                    </div>
                  </>
                );

              case 'streamtitan-2028': // Tier 5: StreamTitan 2028 — Flagship Hyperscale Integrated Array
              default:
                return (
                  <>
                    {/* Outer 14-Blade Compressor Rotor Ring (CW) */}
                    <div
                      ref={rotorPrimaryRef}
                      className="absolute inset-3 rounded-full flex items-center justify-center pointer-events-none z-15"
                    >
                      {[...Array(14)].map((_, i) => (
                        <div
                          key={i}
                          className="absolute w-[12px] h-[88px] origin-bottom rounded-t-sm"
                          style={{
                            bottom: '50%',
                            transform: `rotate(${i * (360 / 14)}deg) skewY(12deg)`,
                            background: `linear-gradient(180deg, ${dynamicColor} 0%, rgba(20,15,5,0.95) 80%)`,
                            borderTop: `1.5px solid ${dynamicColor}`,
                            boxShadow: `0 0 8px ${dynamicColor}40`,
                          }}
                        />
                      ))}
                    </div>

                    {/* Inner 14-Blade Counter-Rotating Turbine Disc (CCW) */}
                    <div
                      ref={rotorSecondaryRef}
                      className="absolute inset-8 rounded-full flex items-center justify-center pointer-events-none z-15"
                    >
                      {[...Array(14)].map((_, i) => (
                        <div
                          key={i}
                          className="absolute w-[8px] h-[62px] origin-bottom rounded-t-sm"
                          style={{
                            bottom: '50%',
                            transform: `rotate(${i * (360 / 14)}deg)`,
                            background: `linear-gradient(180deg, #38bdf8 0%, rgba(10,20,30,0.95) 85%)`,
                            opacity: 0.9,
                            boxShadow: `0 0 8px #38bdf840`,
                          }}
                        />
                      ))}
                    </div>

                    {/* 8 Autonomous Thermal Cooling Vanes */}
                    <div
                      ref={rotorTertiaryRef}
                      className="absolute inset-1 rounded-full flex items-center justify-center pointer-events-none z-15"
                    >
                      {[...Array(8)].map((_, i) => (
                        <div
                          key={i}
                          className="absolute w-[16px] h-[98px] origin-bottom"
                          style={{
                            bottom: '50%',
                            transform: `rotate(${i * 45}deg)`,
                          }}
                        >
                          <div
                            className="w-full h-3 bg-amber-400/80 rounded-t-xs border border-white/40 shadow-[0_0_8px_rgba(251,191,36,0.6)]"
                          />
                        </div>
                      ))}
                    </div>
                  </>
                );
            }
          })()}

          {/* Center Metal Hub Casing */}
          <div
            className={
              activeSpinner.id === 'free-trial'
                ? "absolute w-[72px] h-[72px] rounded-full bg-[#080b15]/60 backdrop-blur-xs border border-cyan-400/40 shadow-[0_0_20px_rgba(0,176,255,0.3)] flex flex-col items-center justify-center transition-all duration-300 z-20 pointer-events-none"
                : "absolute inset-16 rounded-full bg-[#161822] border-2 shadow-[0_4px_15px_rgba(0,0,0,0.8),inset_0_2px_4px_rgba(255,255,255,0.08)] flex flex-col items-center justify-center transition-all duration-300 z-20 pointer-events-none"
            }
            style={{ borderColor: dynamicColor }}
          >
            <span className="text-[12px] font-black text-white tracking-widest leading-none font-mono">
              TAP
            </span>
            <span className="text-[7px] font-extrabold uppercase tracking-widest leading-none mt-1 flex items-center gap-0.5" style={{ color: dynamicColor }}>
              <Zap size={7} /> BOOST
            </span>
          </div>



          {/* Lock Screen Overlay */}
          {isMiningLocked() && (
            <div className="absolute inset-0 rounded-full bg-black/85 backdrop-blur-[3px] flex flex-col items-center justify-center z-20 text-center p-4 border border-white/10 animate-fade-in">
              <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gold mb-2 animate-pulse">
                <Lock size={15} />
              </div>
              <span className="text-[10px] font-black text-white tracking-widest uppercase font-sans">Locked Machine</span>
              <span className="text-[8px] font-extrabold text-gold mt-1 font-mono">
                Requires: {((Number(activeSpinner?.minBoostGhs) || 0) * 10).toFixed(0)} Machine Power
              </span>
              <span className="text-[8px] text-text-tertiary mt-1 max-w-[125px] leading-tight font-sans font-medium">
                Buy a faster machine in the Machine Shop to unlock.
              </span>
            </div>
          )}

          {/* Threshold Limit Exceeded Overlay */}
          {isAnyLimitReached && (
            <div className="absolute inset-0 rounded-full bg-black/90 backdrop-blur-[4px] flex flex-col items-center justify-center z-25 text-center p-3 border border-error-red/30 animate-fade-in">
              <div className="w-9 h-9 rounded-full bg-error-red/10 border border-error-red/30 flex items-center justify-center text-error-red mb-1.5 animate-bounce">
                <Flame size={18} />
              </div>
              <span className="text-[10px] font-black text-error-red tracking-widest uppercase font-sans">Capacity Limit!</span>
              <span className="text-[9px] font-bold text-white mt-1 font-sans">
                {isDailyLimitReached && 'Daily Earning Capacity Reached'}
                {!isDailyLimitReached && isWeeklyLimitReached && 'Weekly Earning Capacity Reached'}
                {!isDailyLimitReached && !isWeeklyLimitReached && isMonthlyLimitReached && 'Monthly Earning Capacity Reached'}
              </span>
              <span className="text-[8px] text-text-tertiary mt-0.5 max-w-[125px] leading-tight font-sans font-medium">
                Compute capacity threshold reached. Upgrade limits to resume.
              </span>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  impactOccurred('heavy');
                  upgradeLimits();
                  showToast("Cooler threshold limits upgraded! Capacity expanded. ⚡", "success");
                }}
                className="mt-2.5 press-feedback font-extrabold text-[9px] px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-gold to-gold-bright text-app-bg uppercase tracking-wider shadow-md hover:brightness-110"
              >
                Upgrade Limit ⚡
              </button>
            </div>
          )}
        </motion.div>

        {/* Right selector arrow */}
        <button
          onClick={nextSpinner}
          className="press-feedback w-9 h-9 rounded-full bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 flex items-center justify-center text-text-secondary hover:text-text-primary transition-all z-20 shadow-md"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* AI Compute Status Ticker (Req 11) for Quantum Loop Reactor */}
      {(activeSpinner.id === 'free-trial' || !['berp-heli', 'jet-turbine', 'co-axial', 'plasma-coil', 'quantum-core', 'neural-net', 'crystal-array', 'plasma-fusion'].includes(activeSpinner.id)) && (
        <div className="mt-3 flex items-center justify-center gap-1.5 text-[9px] font-mono font-extrabold text-cyan-300/90 uppercase tracking-widest bg-cyan-950/30 border border-cyan-500/20 px-3.5 py-1 rounded-full backdrop-blur-xs shadow-[0_0_12px_rgba(0,176,255,0.15)] transition-all duration-500">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
          <span>{AI_COMPUTE_STATUSES[statusIdx]}</span>
        </div>
      )}

      {/* Live Stream Stats Panel below Spinner Wheel */}

      {(() => {
        // Output / Tap is published by the mining engine — the UI only renders it
        const currentTapYieldVal = Number(tapYieldPerTap) || 0;

        const formatOutputPerTap = (val: number) => {
          if (isUsdt && showLocal && selectedCountry) {
            const localVal = val * (Number(selectedCountry.exchangeRate) || 1);
            const fmt = selectedCountry.numberFormat && typeof selectedCountry.numberFormat === 'object'
              ? selectedCountry.numberFormat
              : { maximumFractionDigits: 2 };
            return `+${selectedCountry.currencySymbol}${localVal.toLocaleString(undefined, fmt)}`;
          }
          return `+${isUsdt ? '₮' : '💎'}${val.toFixed(4)}`;
        };

        return (
          <div className="w-full max-w-[320px] mt-4 grid grid-cols-2 gap-2 text-center text-xs font-mono">
            <div className="bg-control-bg/70 border border-white/10 rounded-2xl p-2 flex flex-col items-center justify-center shadow-sm">
              <span className="text-[9px] text-text-tertiary font-bold font-sans uppercase">Output / Tap</span>
              <span className="font-extrabold text-usdt-green text-xs mt-0.5">{formatOutputPerTap(currentTapYieldVal)}</span>
            </div>
            <div className="bg-control-bg/70 border border-white/10 rounded-2xl p-2 flex flex-col items-center justify-center shadow-sm">
              <span className="text-[9px] text-text-tertiary font-bold font-sans uppercase">Core Multiplier</span>
              <span className="font-extrabold text-gold text-xs mt-0.5">×{(Number(coolerMultiplier) || 1).toFixed(1)}</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
});
