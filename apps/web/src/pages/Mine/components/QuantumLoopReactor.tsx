import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { useSettingsStore } from '../../../store/useSettingsStore';

export interface QuantumLoopReactorRef {
  triggerTap: () => void;
}

interface QuantumLoopReactorProps {
  coolerMultiplier?: number;
  isOverheated?: boolean;
  isLocked?: boolean;
  isPaused?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onDiscoveryEvent?: (title: string) => void;
  tierCode?: string;
  tierIndex?: number;
}

interface Particle {
  angle: number;
  dist: number;
  speed: number;
  size: number;
  opacity: number;
  isSpark?: boolean;
}

interface InwardBeam {
  angle: number;
  dist: number;
  maxDist: number;
  speed: number;
  alpha: number;
  width?: number;
}

interface TapRipple {
  r: number;
  maxR: number;
  alpha: number;
  speed: number;
  color?: string;
}

interface Shockwave {
  r: number;
  maxR: number;
  alpha: number;
  color?: string;
  isStabilization?: boolean;
}

// Operating modes for Reactor Personality
const PERSONALITY_MODES = [
  { name: 'Stable', hueOffset: 0, speedFactor: 0.9, pulseSpeed: 0.8 },
  { name: 'Experimental', hueOffset: 35, speedFactor: 1.25, pulseSpeed: 1.3 },
  { name: 'Adaptive', hueOffset: -15, speedFactor: 1.1, pulseSpeed: 1.1 },
  { name: 'Quantum', hueOffset: 50, speedFactor: 1.4, pulseSpeed: 1.4 },
  { name: 'Precision', hueOffset: 10, speedFactor: 1.0, pulseSpeed: 0.9 },
  { name: 'Hyper Efficient', hueOffset: -30, speedFactor: 0.95, pulseSpeed: 0.85 },
  { name: 'Learning', hueOffset: 20, speedFactor: 1.15, pulseSpeed: 1.2 },
  { name: 'Autonomous', hueOffset: 40, speedFactor: 1.3, pulseSpeed: 1.35 },
];

function getDailyPersonality() {
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const index = dayOfYear % PERSONALITY_MODES.length;
  return PERSONALITY_MODES[index];
}

// Resolve machine tier index (0 to 5)
function resolveTierIndex(tierCode?: string, tierIndex?: number): number {
  if (typeof tierIndex === 'number' && tierIndex >= 0) return Math.min(5, tierIndex);
  if (!tierCode) return 0;
  switch (tierCode) {
    case 'TS_C10': return 1;
    case 'TS_A50': return 2;
    case 'TS_P250': return 3;
    case 'TS_X1000': return 4;
    case 'TS_Q2500': return 5;
    default: return 0;
  }
}

// Color palette config per machine tier generation
function getTierColors(tierIdx: number, timeSec: number, hueOffset: number = 0) {
  const tierBaseHues = [195, 168, 280, 152, 295, 43];
  const baseHue = tierBaseHues[tierIdx % tierBaseHues.length];
  const dynamicHue = (baseHue + Math.sin(timeSec * 0.5) * 15 + hueOffset + 360) % 360;

  switch (tierIdx) {
    case 1: // Tier 1: Ripple X14 — Outer Compressor Stage (Teal/Emerald Titanium)
      return {
        primaryHex: '#26a17b',
        secondaryHex: '#00e676',
        accentHex: '#80cbc4',
        metalHex: '#1b2a32',
        bladeHex: '#2c424d',
        coreGlowRgb: '38, 161, 123',
        hue: 168,
      };
    case 2: // Tier 2: Surge R28 — Dual-Stage Counter-Rotating Turbine (Amber/Violet Turbo)
      return {
        primaryHex: '#ff9100',
        secondaryHex: '#e040fb',
        accentHex: '#ffd180',
        metalHex: '#2c1e30',
        bladeHex: '#4a2840',
        coreGlowRgb: '255, 145, 0',
        hue: 280,
      };
    case 3: // Tier 3: Torrent V63 — Ducted Marine Propulsion (Emerald/Cyan Marine)
      return {
        primaryHex: '#10b981',
        secondaryHex: '#00b0ff',
        accentHex: '#a7f3d0',
        metalHex: '#112922',
        bladeHex: '#1a4337',
        coreGlowRgb: '16, 185, 129',
        hue: 152,
      };
    case 4: // Tier 4: Cascade M91 — Multi-Axis Gyroscopic Gimbals (Hyper Neon Purple/Magenta)
      return {
        primaryHex: '#e040fb',
        secondaryHex: '#00e5ff',
        accentHex: '#f50057',
        metalHex: '#281333',
        bladeHex: '#411c52',
        coreGlowRgb: '224, 64, 251',
        hue: 295,
      };
    case 5: // Tier 5: StreamTitan 2028 — Flagship Hyperscale Integrated Reactor (Gold/Titanium Multi-Spectrum)
      return {
        primaryHex: '#fbbf24',
        secondaryHex: '#38bdf8',
        accentHex: '#f43f5e',
        metalHex: '#332612',
        bladeHex: '#523c1b',
        coreGlowRgb: '251, 191, 36',
        hue: 43,
      };
    default: // Tier 0: Titan Core — Experimental Micro-Rotor Core (Cyan/Electric Blue)
      return {
        primaryHex: `hsl(${dynamicHue}, 100%, 55%)`,
        secondaryHex: `hsl(${(dynamicHue + 30) % 360}, 100%, 65%)`,
        accentHex: `hsl(${(dynamicHue - 25 + 360) % 360}, 100%, 75%)`,
        metalHex: '#142334',
        bladeHex: '#1e3850',
        coreGlowRgb: '0, 176, 255',
        hue: dynamicHue,
      };
  }
}

// Web Audio API Synth Generator with Tier-Specific Tap Soundscapes
class ReactorAudioSynth {
  private ctx: AudioContext | null = null;
  public isMuted: boolean = false;

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
  }

  public playTapSound(tierIdx: number = 0) {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const baseFreqs = [280, 340, 420, 220, 510, 360];
      const targetFreqs = [560, 680, 840, 440, 980, 1120];

      const startFreq = baseFreqs[tierIdx % baseFreqs.length];
      const endFreq = targetFreqs[tierIdx % targetFreqs.length];

      osc.type = tierIdx === 1 ? 'triangle' : tierIdx === 3 ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + (tierIdx === 5 ? 0.25 : 0.12));

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (tierIdx === 5 ? 0.28 : 0.15));

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + (tierIdx === 5 ? 0.3 : 0.16));
    } catch {
      // Audio autoplay policy fallback
    }
  }

  public playDiscoveryChime() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.35);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.42);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  public playOverheatSound() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      const now = this.ctx.currentTime;
      
      // Create a descending "stop" sound with multiple elements
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // Main descending tone - feels like something stopping
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(400, now);
      osc1.frequency.exponentialRampToValueAtTime(80, now + 0.3);

      // Secondary lower tone for impact
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(200, now);
      osc2.frequency.exponentialRampToValueAtTime(40, now + 0.25);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.35);
      osc2.stop(now + 0.35);
    } catch {
      // Audio autoplay policy fallback
    }
  }
}

const audioSynth = new ReactorAudioSynth();

// Export the audio synth for use in other components
export { audioSynth };

export const QuantumLoopReactor = forwardRef<QuantumLoopReactorRef, QuantumLoopReactorProps>(
  ({ coolerMultiplier = 1.0, isOverheated = false, isLocked = false, isPaused = false, onClick, onDiscoveryEvent, tierCode, tierIndex }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [personality] = useState(getDailyPersonality);
    const activeTierIdx = resolveTierIndex(tierCode, tierIndex);

    // Mechanical rotational state & physical tap cascade sequence tracker
    const stateRef = useRef({
      // Tier 0-5 rotational angles with independent unsynchronized rhythms
      compressorAngle: 0,
      turbineInnerAngle: 0,
      turbineOuterAngle: 0,
      statorAngle: 0,
      impellerAngle: 0,
      gyroGimbalPitch: 0,
      gyroGimbalRoll: 0,
      gyroGimbalYaw: 0,
      magneticRotorAngle: 0,
      quantumLoop1Angle: 0,
      quantumLoop2Angle: 0,
      coolingVaneOpen: 0, // 0 = flush closed, 1 = fully extended
      
      // Tap Interaction Cascade Sequence State (Steps 1 -> 7)
      tapCascadeStep: 0, // 0 = idle, 1..7 = active cascade step
      tapCascadeTimer: 0,
      intakeSurge: 0, // Step 1: outer intake speed surge
      bladeFlex: 0,   // Step 2: compressor blade reaction pitch flex
      turbineSurge: 0, // Step 3: turbine momentum gain
      conduitEnergy: 0, // Step 4: energy conduit glow
      coreAbsorption: 0, // Step 5: core absorption contraction/glow
      
      lastTime: performance.now(),
      lastTapTime: performance.now(),
      idleFactor: 0,
      tapSpeedSurge: 0,
      coreFlash: 0,
      pulseTimer: 0,
      nextPulseInterval: 5.5,
      autoEventTimer: 0,
      nextAutoEventInterval: 22.0,
      stabilizationTimer: 0,
      isStabilizing: false,
      stabilizePhase: 0,
      discoveryTimer: 0,
      ripples: [] as TapRipple[],
      shockwaves: [] as Shockwave[],
      inwardBeams: [] as InwardBeam[],
      particles: [] as Particle[],
      particleDir: 1,
    });

    // Imperative tap trigger handler executing the 7-step mechanical kinetic cascade
    useImperativeHandle(ref, () => ({
      triggerTap: () => {
        const s = stateRef.current;
        const now = performance.now();
        s.lastTapTime = now;
        s.idleFactor = 0; // Energetic awakening
        s.tapSpeedSurge = Math.min(4.0, s.tapSpeedSurge + 1.5);
        s.coreFlash = 1.0;

        audioSynth.playTapSound(activeTierIdx);

        // --- INITIATE 7-STEP MECHANICAL TAP INTERACTION CASCADE ---
        s.tapCascadeStep = 1;
        s.tapCascadeTimer = 0;
        s.intakeSurge = 1.0; // Step 1: Intake accelerates immediately

        // Tier 0 (Free Machine): Micro-Rotor Jitter & Ripple
        s.magneticRotorAngle += Math.PI * 0.25;
        s.ripples.push({
          r: 22,
          maxR: 104,
          alpha: 0.95,
          speed: 5.5,
        });

        // Generate mechanical inward beams for energy routing
        const beamCount = activeTierIdx === 5 ? 8 : activeTierIdx === 4 ? 6 : 4;
        for (let b = 0; b < beamCount; b++) {
          const angle = (b * (Math.PI * 2)) / beamCount + Math.random() * 0.2;
          s.inwardBeams.push({
            angle,
            dist: 102,
            maxDist: 102,
            speed: 220 + Math.random() * 80,
            alpha: 0.95,
            width: activeTierIdx >= 3 ? 2.5 : 1.5,
          });
        }

        // Pull particles inward toward reactor core
        s.particles.forEach((p) => {
          p.dist = Math.max(26, p.dist - 18);
          p.opacity = 1.0;
        });
      },
    }));

    // Initialize floating particle instances
    useEffect(() => {
      const isMotionReduced = useSettingsStore.getState().reducedMotion;
      const graphicsQ = useSettingsStore.getState().graphicsQuality;
      
      let particleCount = typeof window !== 'undefined' && (window.devicePixelRatio || 1) > 1.5 ? 24 : 16;
      if (graphicsQ === 'low' || isMotionReduced) {
        particleCount = 0;
      } else if (graphicsQ === 'medium') {
        particleCount = 8;
      }

      const initialParticles: Particle[] = [];

      for (let i = 0; i < particleCount; i++) {
        initialParticles.push({
          angle: Math.random() * Math.PI * 2,
          dist: 36 + Math.random() * 64,
          speed: (0.2 + Math.random() * 0.4) * (Math.random() > 0.5 ? 1 : -1),
          size: 1.4 + Math.random() * 2.0,
          opacity: 0.3 + Math.random() * 0.6,
          isSpark: Math.random() > 0.65,
        });
      }

      stateRef.current.particles = initialParticles;
    }, []);

    // 60 FPS Canvas Animation Render Loop
    useEffect(() => {
      let animFrameId: number;

      const render = (now: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        const width = 216;
        const height = 216;

        const isMotionReduced = useSettingsStore.getState().reducedMotion;
        const graphicsQ = useSettingsStore.getState().graphicsQuality;
        const glowMultiplier = (graphicsQ === 'low' || isMotionReduced) ? 0 : (graphicsQ === 'medium' ? 0.25 : 1.0);

        if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
          canvas.width = width * dpr;
          canvas.height = height * dpr;
        }

        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);

        const cx = width / 2;
        const cy = height / 2;
        const timeSec = now / 1000;
        const dt = Math.min(0.05, (now - stateRef.current.lastTime) / 1000);
        stateRef.current.lastTime = now;

        const s = stateRef.current;

        // --- IDLE AWARENESS DRIFT ---
        const timeSinceTap = (now - s.lastTapTime) / 1000;
        if (timeSinceTap > 4.0) {
          s.idleFactor = Math.min(1.0, s.idleFactor + dt * 0.4);
        } else {
          s.idleFactor = Math.max(0.0, s.idleFactor - dt * 2.0);
        }

        const idleSpeedMult = 1.0 - s.idleFactor * 0.35;
        const isActive = !isOverheated && !isLocked && !isPaused;
        const intensity = isActive ? (0.4 + 0.6 * Math.min(1.5, coolerMultiplier)) * personality.speedFactor * idleSpeedMult : 0;

        // Decays
        s.tapSpeedSurge = Math.max(0, s.tapSpeedSurge - dt * 2.5);
        s.coreFlash = Math.max(0, s.coreFlash - dt * 3.0);
        s.intakeSurge = Math.max(0, s.intakeSurge - dt * 2.8);
        s.bladeFlex = Math.max(0, s.bladeFlex - dt * 3.2);
        s.turbineSurge = Math.max(0, s.turbineSurge - dt * 2.2);
        s.conduitEnergy = Math.max(0, s.conduitEnergy - dt * 2.6);
        s.coreAbsorption = Math.max(0, s.coreAbsorption - dt * 3.5);
        s.coolingVaneOpen = Math.max(0, s.coolingVaneOpen - dt * 1.6);

        // --- 7-STEP MECHANICAL TAP CASCADE ADVANCEMENT ---
        if (s.tapCascadeStep > 0) {
          s.tapCascadeTimer += dt;

          if (s.tapCascadeStep === 1 && s.tapCascadeTimer >= 0.05) {
            s.tapCascadeStep = 2; // Step 2: Compressor blades respond & flex
            s.bladeFlex = 1.0;
          } else if (s.tapCascadeStep === 2 && s.tapCascadeTimer >= 0.12) {
            s.tapCascadeStep = 3; // Step 3: Turbine gains rotational momentum
            s.turbineSurge = 1.0;
          } else if (s.tapCascadeStep === 3 && s.tapCascadeTimer >= 0.20) {
            s.tapCascadeStep = 4; // Step 4: Energy conduits channel inward
            s.conduitEnergy = 1.0;
          } else if (s.tapCascadeStep === 4 && s.tapCascadeTimer >= 0.28) {
            s.tapCascadeStep = 5; // Step 5: Quantum Core absorbs energy
            s.coreAbsorption = 1.0;
          } else if (s.tapCascadeStep === 5 && s.tapCascadeTimer >= 0.35) {
            s.tapCascadeStep = 6; // Step 6: Controlled reactor pulse & cooling vane release
            s.coolingVaneOpen = 1.0;
            s.shockwaves.push({
              r: 22,
              maxR: 108,
              alpha: 1.0,
              color: activeTierIdx === 5 ? '#fbbf24' : activeTierIdx === 4 ? '#e040fb' : '#00e676',
            });
          } else if (s.tapCascadeStep === 6 && s.tapCascadeTimer >= 0.50) {
            s.tapCascadeStep = 7; // Step 7: Subsystems decay back to unsynchronized idle
          } else if (s.tapCascadeStep === 7 && s.tapCascadeTimer >= 1.10) {
            s.tapCascadeStep = 0; // Cascade complete
          }
        }

        // --- INTELLIGENT AUTONOMOUS REACTOR EVENTS & STABILIZATION ---
        s.autoEventTimer += dt;
        if (s.autoEventTimer >= s.nextAutoEventInterval) {
          s.autoEventTimer = 0;
          s.nextAutoEventInterval = 20.0 + Math.random() * 18.0;
          if (isActive) {
            s.particleDir *= -1;
            s.shockwaves.push({ r: 24, maxR: 102, alpha: 0.8 });
          }
        }

        s.stabilizationTimer += dt;
        if (s.stabilizationTimer >= 135.0) {
          s.stabilizationTimer = 0;
          s.isStabilizing = true;
          s.stabilizePhase = 0;
          if (isActive) {
            s.shockwaves.push({ r: 20, maxR: 106, alpha: 1.0, isStabilization: true });
          }
        }
        if (s.isStabilizing) {
          s.stabilizePhase += dt * 0.8;
          if (s.stabilizePhase >= 1.0) s.isStabilizing = false;
        }

        s.discoveryTimer += dt;
        if (s.discoveryTimer >= 75.0) {
          s.discoveryTimer = 0;
          if (isActive && Math.random() > 0.35 && onDiscoveryEvent) {
            const DISCOVERIES = [
              'Machine Intake Running Smooth',
              'Speed Turbines Synchronized',
              'Machine Cooling Running Smooth',
              'Stabilizers Perfectly Balanced',
              'Earning Speed Boost Active',
            ];
            const item = DISCOVERIES[Math.floor(Math.random() * DISCOVERIES.length)];
            audioSynth.playDiscoveryChime();
            onDiscoveryEvent(item);
          }
        }

        // --- UNSYNCHRONIZED MOTION SPEEDS (DIFF RHYTHM PER SUBSYSTEM) ---
        const speedBoost = 1 + s.tapSpeedSurge + s.intakeSurge * 0.8;
        const motionMult = isMotionReduced ? 0 : 1;

        // Subsystem speeds (never synchronized!)
        const compressorSpeed = 0.8 * intensity * speedBoost * (1 + s.bladeFlex * 0.6) * motionMult;
        const turbineInnerSpeed = 2.2 * intensity * speedBoost * (1 + s.turbineSurge * 0.9) * motionMult;
        const turbineOuterSpeed = -1.4 * intensity * speedBoost * (1 + s.turbineSurge * 0.7) * motionMult;
        const statorSpeed = 0.3 * intensity * speedBoost * motionMult;
        const impellerSpeed = 1.6 * intensity * speedBoost * motionMult;
        const gyroPitchSpeed = 0.9 * intensity * speedBoost * motionMult;
        const gyroRollSpeed = -1.3 * intensity * speedBoost * motionMult;
        const gyroYawSpeed = 0.6 * intensity * speedBoost * motionMult;
        const magneticRotorSpeed = 5.2 * intensity * speedBoost * motionMult;
        const quantumLoop1Speed = 2.5 * intensity * speedBoost * motionMult;
        const quantumLoop2Speed = -2.8 * intensity * speedBoost * motionMult;

        s.compressorAngle += compressorSpeed * dt;
        s.turbineInnerAngle += turbineInnerSpeed * dt;
        s.turbineOuterAngle += turbineOuterSpeed * dt;
        s.statorAngle += statorSpeed * dt;
        s.impellerAngle += impellerSpeed * dt;
        s.gyroGimbalPitch += gyroPitchSpeed * dt;
        s.gyroGimbalRoll += gyroRollSpeed * dt;
        s.gyroGimbalYaw += gyroYawSpeed * dt;
        s.magneticRotorAngle += magneticRotorSpeed * dt;
        s.quantumLoop1Angle += quantumLoop1Speed * dt;
        s.quantumLoop2Angle += quantumLoop2Speed * dt;

        // Color palette resolution
        const colors = getTierColors(activeTierIdx, timeSec, personality.hueOffset);
        let primaryColor = colors.primaryHex;
        let secondaryColor = colors.secondaryHex;

        if (isOverheated) {
          primaryColor = '#ff1744';
          secondaryColor = '#ff5722';
        }

        // =========================================================================
        // LAYER 0: CENTRAL QUANTUM REACTOR CORE (ALL TIERS)
        // =========================================================================
        const pulseRatio = Math.sin(timeSec * 2.4 * personality.pulseSpeed) * 0.5 + 0.5;
        const coreAbsorbOffset = s.coreAbsorption * -4 + s.coreFlash * 6;
        const coreRadius = Math.max(18, 24 + pulseRatio * 4 + coreAbsorbOffset);

        const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius * 2.8);
        coreGrad.addColorStop(0, isOverheated ? 'rgba(255, 23, 68, 0.98)' : `rgba(255, 255, 255, ${0.94 + s.coreFlash * 0.06})`);
        coreGrad.addColorStop(0.25, isOverheated ? 'rgba(255, 23, 68, 0.8)' : `rgba(${colors.coreGlowRgb}, ${0.85 + s.coreFlash * 0.15})`);
        coreGrad.addColorStop(0.65, isOverheated ? 'rgba(255, 87, 34, 0.35)' : `rgba(${colors.coreGlowRgb}, ${0.35 + s.conduitEnergy * 0.25})`);
        coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, coreRadius * 2.8, 0, Math.PI * 2);
        ctx.fill();

        // Sapphire Reactor Glass Lens Ring
        ctx.save();
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 1.8;
        ctx.globalAlpha = 0.8;
        ctx.shadowColor = primaryColor;
        ctx.shadowBlur = 12 * glowMultiplier;
        ctx.beginPath();
        ctx.arc(cx, cy, coreRadius * 0.9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // =========================================================================
        // LAYER 1: INWARD BEAMS, SHOCKWAVES & RIPPLES
        // =========================================================================
        for (let i = s.inwardBeams.length - 1; i >= 0; i--) {
          const bm = s.inwardBeams[i];
          bm.dist -= dt * bm.speed;
          bm.alpha -= dt * 0.9;

          if (bm.dist <= 16 || bm.alpha <= 0) {
            s.inwardBeams.splice(i, 1);
            continue;
          }

          const bx = cx + Math.cos(bm.angle) * bm.dist;
          const by = cy + Math.sin(bm.angle) * bm.dist;

          ctx.save();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = bm.width || 2.0;
          ctx.globalAlpha = Math.max(0, bm.alpha);
          ctx.shadowColor = primaryColor;
          ctx.shadowBlur = 14 * glowMultiplier;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(cx, cy);
          ctx.stroke();
          ctx.restore();
        }

        // Shockwaves
        for (let i = s.shockwaves.length - 1; i >= 0; i--) {
          const sw = s.shockwaves[i];
          sw.r += dt * 85;
          sw.alpha -= dt * 0.85;

          if (sw.alpha <= 0 || sw.r >= sw.maxR) {
            s.shockwaves.splice(i, 1);
            continue;
          }

          ctx.save();
          ctx.strokeStyle = sw.color || primaryColor;
          ctx.lineWidth = sw.isStabilization ? 4.0 : 2.5;
          ctx.globalAlpha = Math.max(0, sw.alpha);
          ctx.shadowColor = primaryColor;
          ctx.shadowBlur = 18 * glowMultiplier;
          ctx.beginPath();
          ctx.arc(cx, cy, sw.r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Ripples
        for (let i = s.ripples.length - 1; i >= 0; i--) {
          const rp = s.ripples[i];
          rp.r += dt * rp.speed * 34;
          rp.alpha -= dt * 1.3;

          if (rp.alpha <= 0 || rp.r >= rp.maxR) {
            s.ripples.splice(i, 1);
            continue;
          }

          ctx.save();
          ctx.strokeStyle = rp.color || secondaryColor;
          ctx.lineWidth = 2.0;
          ctx.globalAlpha = Math.max(0, rp.alpha);
          ctx.shadowColor = secondaryColor;
          ctx.shadowBlur = 14 * glowMultiplier;
          ctx.beginPath();
          ctx.arc(cx, cy, rp.r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // =========================================================================
        // LAYER 2: TIER 0 — FREE MACHINE EXPERIMENTAL MICRO-ROTOR & FIN ASSEMBLY
        // =========================================================================
        if (activeTierIdx === 0) {
          // Floating Quantum Loop Rings
          const drawQuantumLoop = (r: number, angle: number, color: string, width: number) => {
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            ctx.globalAlpha = 0.75;
            ctx.shadowColor = color;
            ctx.shadowBlur = 10 * glowMultiplier;
            ctx.beginPath();
            ctx.arc(cx, cy, r, angle, angle + Math.PI * 1.25);
            ctx.stroke();
            ctx.restore();
          };

          drawQuantumLoop(46, s.quantumLoop1Angle, primaryColor, 2.5);
          drawQuantumLoop(70, s.quantumLoop2Angle, secondaryColor, 1.8);

          // Small Central Magnetic Rotor Hub (3 teeth)
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(s.magneticRotorAngle);
          ctx.fillStyle = colors.metalHex;
          ctx.strokeStyle = primaryColor;
          ctx.lineWidth = 1.5;
          ctx.shadowColor = primaryColor;
          ctx.shadowBlur = 8 * glowMultiplier;
          for (let i = 0; i < 3; i++) {
            ctx.rotate((Math.PI * 2) / 3);
            ctx.fillRect(28, -3, 14, 6);
            ctx.strokeRect(28, -3, 14, 6);
          }
          ctx.restore();

          // Tiny Stabilization Fins (4 perimeter fins)
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(s.quantumLoop1Angle * 0.3);
          for (let i = 0; i < 4; i++) {
            ctx.rotate(Math.PI / 2);
            ctx.fillStyle = colors.accentHex;
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            ctx.moveTo(88, -4);
            ctx.lineTo(96, 0);
            ctx.lineTo(88, 4);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
        }

        // =========================================================================
        // LAYER 3: TIER 1 — RIPPLE X14 OUTER COMPRESSOR STAGE & INTAKE BLADES
        // =========================================================================
        if (activeTierIdx === 1 || activeTierIdx === 5) {
          const numBlades = 10;
          const outerR = 96;
          const bladeLen = 22 + s.intakeSurge * 4;

          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(s.compressorAngle);

          // Rotating Intake Ring
          ctx.strokeStyle = colors.primaryHex;
          ctx.lineWidth = 2.5;
          ctx.globalAlpha = 0.85;
          ctx.shadowColor = colors.primaryHex;
          ctx.shadowBlur = 10 * glowMultiplier;
          ctx.beginPath();
          ctx.arc(0, 0, outerR, 0, Math.PI * 2);
          ctx.stroke();

          // Angled Compressor Blades
          const flexAngle = 0.25 + s.bladeFlex * 0.15;
          for (let i = 0; i < numBlades; i++) {
            const angle = (i * (Math.PI * 2)) / numBlades;
            const x1 = Math.cos(angle) * (outerR - bladeLen);
            const y1 = Math.sin(angle) * (outerR - bladeLen);
            const x2 = Math.cos(angle + flexAngle) * outerR;
            const y2 = Math.sin(angle + flexAngle) * outerR;

            // Brushed Titanium Blade
            ctx.strokeStyle = i % 2 === 0 ? colors.primaryHex : '#ffffff';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
          }

          ctx.restore();

          // Radial Glowing Airflow Channels
          ctx.save();
          ctx.strokeStyle = colors.accentHex;
          ctx.lineWidth = 1.0;
          ctx.globalAlpha = 0.4 + s.intakeSurge * 0.4;
          ctx.setLineDash([4, 8]);
          for (let i = 0; i < 6; i++) {
            const angle = s.compressorAngle * 0.5 + (i * Math.PI) / 3;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(angle) * 40, cy + Math.sin(angle) * 40);
            ctx.lineTo(cx + Math.cos(angle) * 92, cy + Math.sin(angle) * 92);
            ctx.stroke();
          }
          ctx.restore();
        }

        // =========================================================================
        // LAYER 4: TIER 2 — SURGE R28 DUAL-STAGE COUNTER-ROTATING TURBINE & STATOR
        // =========================================================================
        if (activeTierIdx === 2 || activeTierIdx === 5) {
          const innerR = 56;
          const outerR = 86;
          const numTurbineBlades = 12;

          // Outer Turbine Stage (Clockwise)
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(s.turbineOuterAngle);
          ctx.strokeStyle = colors.primaryHex;
          ctx.lineWidth = 2.4;
          ctx.shadowColor = colors.primaryHex;
          ctx.shadowBlur = 12 * glowMultiplier;

          for (let i = 0; i < numTurbineBlades; i++) {
            const angle = (i * (Math.PI * 2)) / numTurbineBlades;
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * (outerR - 16), Math.sin(angle) * (outerR - 16));
            ctx.lineTo(Math.cos(angle + 0.3) * outerR, Math.sin(angle + 0.3) * outerR);
            ctx.stroke();
          }
          ctx.restore();

          // Inner Turbine Stage (Counter-Clockwise)
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(s.turbineInnerAngle);
          ctx.strokeStyle = colors.secondaryHex;
          ctx.lineWidth = 2.0;
          ctx.shadowColor = colors.secondaryHex;
          ctx.shadowBlur = 14 * glowMultiplier;

          for (let i = 0; i < numTurbineBlades; i++) {
            const angle = (i * (Math.PI * 2)) / numTurbineBlades;
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * (innerR - 14), Math.sin(angle) * (innerR - 14));
            ctx.lineTo(Math.cos(angle - 0.35) * innerR, Math.sin(angle - 0.35) * innerR);
            ctx.stroke();
          }
          ctx.restore();

          // Spinning Stator Vane Assembly (Slow Stator Guide Vanes)
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(s.statorAngle);
          ctx.fillStyle = colors.metalHex;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.0;
          ctx.globalAlpha = 0.7;

          for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            const sx = Math.cos(angle) * 70;
            const sy = Math.sin(angle) * 70;
            ctx.beginPath();
            ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
          ctx.restore();
        }

        // =========================================================================
        // LAYER 5: TIER 3 — TORRENT V63 DUCTED MARINE PROPULSION & ENERGY SHIELD
        // =========================================================================
        if (activeTierIdx === 3 || activeTierIdx === 5) {
          const ductR = 92;
          const numImpellers = 4;

          // Transparent Cylindrical Energy Shield
          ctx.save();
          ctx.strokeStyle = colors.primaryHex;
          ctx.lineWidth = 4.0;
          ctx.globalAlpha = 0.35 + Math.sin(timeSec * 3) * 0.1;
          ctx.shadowColor = colors.primaryHex;
          ctx.shadowBlur = 16 * glowMultiplier;
          ctx.beginPath();
          ctx.arc(cx, cy, ductR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          // Enclosed Ducted Marine Hydrofoil Impellers
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(s.impellerAngle);

          for (let i = 0; i < numImpellers; i++) {
            const angle = (i * (Math.PI * 2)) / numImpellers;
            ctx.save();
            ctx.rotate(angle);

            // Hydrofoil impeller shape
            ctx.fillStyle = `rgba(${colors.coreGlowRgb}, 0.85)`;
            ctx.strokeStyle = colors.secondaryHex;
            ctx.lineWidth = 1.5;
            ctx.shadowColor = colors.secondaryHex;
            ctx.shadowBlur = 10 * glowMultiplier;
            ctx.beginPath();
            ctx.moveTo(30, 0);
            ctx.quadraticCurveTo(60, 20, 88, 5);
            ctx.quadraticCurveTo(60, -10, 30, 0);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.restore();
          }
          ctx.restore();
        }

        // =========================================================================
        // LAYER 6: TIER 4 — CASCADE M91 MULTI-AXIS GYROSCOPIC GIMBALS & BEARINGS
        // =========================================================================
        if (activeTierIdx === 4 || activeTierIdx === 5) {
          // Outer Gimbal Ring (Pitch Axis Projection)
          ctx.save();
          ctx.translate(cx, cy);
          ctx.scale(1, Math.cos(s.gyroGimbalPitch * 0.8) * 0.5 + 0.6);
          ctx.rotate(s.gyroGimbalPitch);
          ctx.strokeStyle = colors.primaryHex;
          ctx.lineWidth = 3.0;
          ctx.globalAlpha = 0.9;
          ctx.shadowColor = colors.primaryHex;
          ctx.shadowBlur = 14 * glowMultiplier;
          ctx.beginPath();
          ctx.arc(0, 0, 94, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          // Inner Gimbal Ring (Roll Axis Projection)
          ctx.save();
          ctx.translate(cx, cy);
          ctx.scale(Math.sin(s.gyroGimbalRoll * 0.7) * 0.5 + 0.6, 1);
          ctx.rotate(s.gyroGimbalRoll);
          ctx.strokeStyle = colors.secondaryHex;
          ctx.lineWidth = 2.4;
          ctx.globalAlpha = 0.85;
          ctx.shadowColor = colors.secondaryHex;
          ctx.shadowBlur = 14 * glowMultiplier;
          ctx.beginPath();
          ctx.arc(0, 0, 68, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          // Magnetic Bearing Lock Nodes (4 Floating Bearings)
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(s.gyroGimbalYaw);
          for (let i = 0; i < 4; i++) {
            const angle = (i * Math.PI) / 2;
            const bx = Math.cos(angle) * 82;
            const by = Math.sin(angle) * 82;

            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = colors.accentHex;
            ctx.shadowBlur = 10 * glowMultiplier;
            ctx.beginPath();
            ctx.arc(bx, by, 4.5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }

        // =========================================================================
        // LAYER 7: TIER 5 — STREAMTITAN 2028 AUTONOMOUS COOLING VANES & HYPER-INJECTORS
        // =========================================================================
        if (activeTierIdx === 5) {
          // 8 Autonomous Cooling Vanes (Actuate Open During Reactor Pulses)
          const numVanes = 8;
          const vaneBaseR = 100;
          const vaneExtension = s.coolingVaneOpen * 10;

          ctx.save();
          ctx.translate(cx, cy);
          for (let i = 0; i < numVanes; i++) {
            const angle = (i * (Math.PI * 2)) / numVanes + s.statorAngle * 0.2;
            const vx = Math.cos(angle) * (vaneBaseR + vaneExtension);
            const vy = Math.sin(angle) * (vaneBaseR + vaneExtension);

            ctx.save();
            ctx.translate(vx, vy);
            ctx.rotate(angle + Math.PI / 2);
            ctx.fillStyle = colors.metalHex;
            ctx.strokeStyle = colors.primaryHex;
            ctx.lineWidth = 1.8;
            ctx.shadowColor = colors.primaryHex;
            ctx.shadowBlur = 10 * glowMultiplier;
            ctx.beginPath();
            ctx.rect(-6, -2, 12, 4);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }
          ctx.restore();
        }

        // =========================================================================
        // LAYER 8: SUBTLE FLOATING QUANTUM PARTICLES & SPARKS (ALL TIERS)
        // =========================================================================
        s.particles.forEach((p) => {
          p.angle += p.speed * s.particleDir * (1 + s.tapSpeedSurge * 0.5) * idleSpeedMult * dt;

          const distWobble = p.dist + Math.sin(timeSec * 3 + p.angle * 2) * 3;
          const px = cx + Math.cos(p.angle) * distWobble;
          const py = cy + Math.sin(p.angle) * distWobble;

          ctx.save();
          ctx.fillStyle = p.isSpark ? '#ffffff' : primaryColor;
          ctx.globalAlpha = p.opacity * (0.65 + s.coreFlash * 0.35) * (1 - s.idleFactor * 0.3);
          if (p.isSpark) {
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 8 * glowMultiplier;
          }
          ctx.beginPath();
          ctx.arc(px, py, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });

        ctx.restore();
        animFrameId = requestAnimationFrame(render);
      };

      const handleVisibilityChange = () => {
        if (document.hidden) {
          cancelAnimationFrame(animFrameId);
        } else {
          stateRef.current.lastTime = performance.now();
          animFrameId = requestAnimationFrame(render);
        }
      };

      animFrameId = requestAnimationFrame(render);
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        cancelAnimationFrame(animFrameId);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }, [coolerMultiplier, isOverheated, isLocked, personality, onDiscoveryEvent, activeTierIdx]);

    return (
      <div
        onClick={onClick}
        className="relative w-[216px] h-[216px] flex items-center justify-center cursor-pointer select-none"
      >
        <canvas
          ref={canvasRef}
          style={{ width: 216, height: 216 }}
          className="absolute inset-0 pointer-events-none z-10"
        />
      </div>
    );
  }
);

QuantumLoopReactor.displayName = 'QuantumLoopReactor';
