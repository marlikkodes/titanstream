import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Volume2, VolumeX, ShieldCheck, Zap, Award, Flame } from 'lucide-react';
import type { GameStartSession, GameEndResult } from '../../../services/gamesService';
import { gamesService } from '../../../services/gamesService';
import { gameAudio } from '../../../utils/gameAudio';

export interface Sector {
  label: string;
  type: 'USDT' | 'CRYSTALS' | 'BOOST';
  value: number;
  premium: boolean;
  badge?: string;
  color?: string;
}

interface RouletteGameProps {
  session: GameStartSession;
  sectors: Sector[];
  onClose: () => void;
  onComplete: (result: GameEndResult) => void;
}

const DEFAULT_SECTORS: Sector[] = [
  { label: '₮50.00', type: 'USDT', value: 50.0, premium: true, badge: 'GRAND VAULT' },
  { label: '15 💎', type: 'CRYSTALS', value: 15, premium: false, badge: 'LUCKY' },
  { label: '₮25.00', type: 'USDT', value: 25.0, premium: true, badge: 'MEGA VAULT' },
  { label: '10 💎', type: 'CRYSTALS', value: 10, premium: false, badge: 'WIN' },
  { label: '₮10.00', type: 'USDT', value: 10.0, premium: true, badge: 'TITAN POT' },
  { label: '⚡×2.0', type: 'BOOST', value: 2.0, premium: true, badge: 'BOOST' },
  { label: '₮1.00', type: 'USDT', value: 1.0, premium: true, badge: 'JACKPOT' },
  { label: '50 💎', type: 'CRYSTALS', value: 50, premium: true, badge: 'BIG POT' },
  { label: '₮0.50', type: 'USDT', value: 0.50, premium: true, badge: 'HIGH ROLLER' },
  { label: '100 💎', type: 'CRYSTALS', value: 100, premium: true, badge: 'MEGA POT' },
  { label: '₮0.25', type: 'USDT', value: 0.25, premium: true, badge: 'VAULT' },
  { label: '⚡×1.5', type: 'BOOST', value: 1.5, premium: false, badge: 'BOOST' },
];

interface SectorStyleConfig {
  outerColor: string;
  midColor: string;
  innerColor: string;
  textColor: string;
  badgeBg: string;
  badgeText: string;
  glow: string;
  icon: string;
  symbol: string;
}

const SECTOR_STYLES: Record<string, SectorStyleConfig> = {
  GRAND: {
    outerColor: '#ffd700',
    midColor: '#d50000',
    innerColor: '#3e0007',
    textColor: '#ffffff',
    badgeBg: 'rgba(213, 0, 0, 0.45)',
    badgeText: '#ffd700',
    glow: 'rgba(255, 215, 0, 0.95)',
    icon: '👑',
    symbol: '₮',
  },
  JACKPOT: {
    outerColor: '#ffd700',
    midColor: '#ff9100',
    innerColor: '#3a2000',
    textColor: '#fff9c4',
    badgeBg: 'rgba(255, 215, 0, 0.3)',
    badgeText: '#ffd700',
    glow: 'rgba(255, 215, 0, 0.8)',
    icon: '👑',
    symbol: '₮',
  },
  USDT: {
    outerColor: '#00e676',
    midColor: '#00a152',
    innerColor: '#052414',
    textColor: '#e8f5e9',
    badgeBg: 'rgba(0, 230, 118, 0.25)',
    badgeText: '#69f0ae',
    glow: 'rgba(0, 230, 118, 0.6)',
    icon: '💵',
    symbol: '₮',
  },
  CRYSTALS: {
    outerColor: '#00e5ff',
    midColor: '#0091ea',
    innerColor: '#051e34',
    textColor: '#e1f5fe',
    badgeBg: 'rgba(0, 229, 255, 0.25)',
    badgeText: '#80d8ff',
    glow: 'rgba(0, 229, 255, 0.6)',
    icon: '💎',
    symbol: '💎',
  },
  BOOST: {
    outerColor: '#e040fb',
    midColor: '#aa00ff',
    innerColor: '#270338',
    textColor: '#f3e5f5',
    badgeBg: 'rgba(224, 64, 251, 0.25)',
    badgeText: '#ea80fc',
    glow: 'rgba(224, 64, 251, 0.6)',
    icon: '⚡',
    symbol: '⚡',
  },
};

export const RouletteGame: React.FC<RouletteGameProps> = ({ session, sectors, onClose, onComplete }) => {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [showPrizeModal, setShowPrizeModal] = useState(false);
  const [tickerDeflection, setTickerDeflection] = useState(0);
  const [coins, setCoins] = useState<Array<{ id: number; x: number; y: number; vy: number; vx: number; rotation: number; rotSpeed: number; scale: number; symbol: string; color: string }>>([]);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; color: string; size: number }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [muted, setMuted] = useState(gameAudio.getMuted());
  const [ledPhase, setLedPhase] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentAngle = useRef(0);
  const animFrame = useRef<number | null>(null);
  const lastSectorPassed = useRef(-1);

  const activeSectors: Sector[] = useMemo(() => {
    if (sectors && sectors.length >= 4) {
      return sectors.map((s, idx) => ({
        ...s,
        badge: s.badge || (s.premium ? 'MEGA' : s.type === 'USDT' ? 'CASH' : s.type === 'CRYSTALS' ? 'WIN' : 'BOOST'),
      }));
    }
    return DEFAULT_SECTORS;
  }, [sectors]);

  const numSectors = activeSectors.length;
  const sectorDegrees = 360 / numSectors;

  const outcomeIndex = session.outcomeSectorIndex != null && session.outcomeSectorIndex >= 0 && session.outcomeSectorIndex < numSectors
    ? session.outcomeSectorIndex
    : Math.floor(Math.random() * numSectors);

  const wonSector = activeSectors[outcomeIndex] ?? activeSectors[0];

  const handleToggleMute = () => {
    const isMute = gameAudio.toggleMute();
    setMuted(isMute);
  };

  // ─── High-DPI Canvas Sector Rendering ───────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 2;
    const size = 680; // internal high-res canvas size
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 12;

    ctx.clearRect(0, 0, size, size);

    const arcStep = (2 * Math.PI) / numSectors;

    activeSectors.forEach((sector, i) => {
      const startAngle = i * arcStep;
      const endAngle = startAngle + arcStep;
      const midAngle = startAngle + arcStep / 2;

      const styleKey = sector.value >= 10.0 && sector.type === 'USDT'
        ? 'GRAND'
        : sector.value >= 1.0 && sector.type === 'USDT'
          ? 'JACKPOT'
          : sector.type;
      const style = SECTOR_STYLES[styleKey] || SECTOR_STYLES.USDT;

      // 1. Sector Wedge Path
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();

      // Multi-stop Radial Gradient
      const grad = ctx.createRadialGradient(cx, cy, radius * 0.15, cx, cy, radius);
      grad.addColorStop(0, style.innerColor);
      grad.addColorStop(0.55, style.midColor);
      grad.addColorStop(0.92, style.outerColor);
      grad.addColorStop(1, '#ffffff');

      ctx.fillStyle = grad;
      ctx.fill();

      // Subtle cyber laser grid lines on sector
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.75, startAngle, endAngle);
      ctx.arc(cx, cy, radius * 0.52, startAngle, endAngle);
      ctx.stroke();

      ctx.restore();

      // 2. Sector Divider Ribs (Chrome Metallic lines)
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(startAngle) * radius, cy + Math.sin(startAngle) * radius);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Peg / Stud at perimeter
      const pegX = cx + Math.cos(startAngle) * (radius - 10);
      const pegY = cy + Math.sin(startAngle) * (radius - 10);
      ctx.beginPath();
      ctx.arc(pegX, pegY, 4.5, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fill();
      ctx.restore();

      // 3. Radial Typography & Icon
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(midAngle);

      // Primary Prize Label (Large, bold, high contrast)
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.font = '900 24px "Inter", "Cabinet Grotesk", system-ui, sans-serif';

      // Deep Drop Shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      // Dark Outline for Maximum Legibility
      ctx.strokeStyle = '#05070a';
      ctx.lineWidth = 4.5;
      ctx.lineJoin = 'round';
      ctx.strokeText(sector.label, radius - 30, 0);

      // Vivid Fill
      ctx.fillStyle = style.textColor;
      ctx.fillText(sector.label, radius - 30, 0);

      // Badge Pill (e.g. JACKPOT, MEGA, CASH, 2x BOOST)
      const badgeText = sector.badge || (sector.premium ? '★ MEGA ★' : sector.type);
      ctx.font = '800 11px "Inter", system-ui, sans-serif';
      ctx.textAlign = 'center';
      const badgeX = radius * 0.52;
      const badgeY = 0;

      // Pill Background
      ctx.fillStyle = 'rgba(5, 7, 10, 0.75)';
      ctx.beginPath();
      const bw = 54;
      const bh = 18;
      ctx.roundRect(badgeX - bw / 2, badgeY - bh / 2, bw, bh, 9);
      ctx.fill();

      ctx.strokeStyle = style.outerColor;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.fillStyle = style.outerColor;
      ctx.shadowBlur = 4;
      ctx.shadowColor = style.glow;
      ctx.fillText(badgeText, badgeX, badgeY + 1);

      ctx.restore();
    });

    // Outer Chrome Rim Boundary
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();

  }, [activeSectors, numSectors]);

  // ─── LED Chase Engine ───────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setLedPhase((p) => (p + 1) % 24);
    }, spinning ? 35 : 180);
    return () => clearInterval(interval);
  }, [spinning]);

  // ─── Spin Logic & Arcade Deceleration ───────────────────────────────────────
  const handleSpin = () => {
    if (spinning || submitting) return;
    setSpinning(true);
    gameAudio.playWhoosh();
    gameAudio.haptic('medium');

    // Pointer is at TOP (12 o'clock / 270 degrees in standard circle math).
    // Target angle calculation:
    // When wheel rotation is R, sector outcomeIndex (which starts at angle outcomeIndex * sectorDegrees)
    // should be centered at -90deg (or 270deg).
    // Center of sector outcomeIndex is: (outcomeIndex * sectorDegrees + sectorDegrees / 2)
    // We need: (centerAngle + R) % 360 == 270 deg.
    // Therefore: R_offset = (270 - (outcomeIndex * sectorDegrees + sectorDegrees / 2)) % 360.
    const centerSectorAngle = outcomeIndex * sectorDegrees + sectorDegrees / 2;
    let targetOffset = (270 - centerSectorAngle) % 360;
    if (targetOffset < 0) targetOffset += 360;

    const extraSpins = 8 * 360; // 8 full revolutions
    const startRot = rotation % 360;
    const totalRotation = startRot + extraSpins + ((targetOffset - (startRot % 360) + 360) % 360);

    const duration = 5800; // ms
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Custom arcade cubic deceleration
      const easeOut = (t: number) => 1 - Math.pow(1 - t, 3.8);
      const currentRot = startRot + (totalRotation - startRot) * easeOut(progress);

      setRotation(currentRot);
      currentAngle.current = currentRot;

      // Track peg / sector crossings for realistic mechanical needle tick
      const needleAngle = 270;
      const normalizedAngle = (needleAngle - (currentRot % 360) + 360) % 360;
      const currentSectorIdx = Math.floor(normalizedAngle / sectorDegrees);

      if (currentSectorIdx !== lastSectorPassed.current) {
        lastSectorPassed.current = currentSectorIdx;
        setTickerDeflection(22);
        setTimeout(() => setTickerDeflection(0), 40);

        // Modulate pitch based on speed
        const speedRatio = 1 - progress;
        gameAudio.playWheelTick(0.75 + speedRatio * 0.9);
      }

      if (progress < 1) {
        animFrame.current = requestAnimationFrame(animate);
      } else {
        setSpinning(false);
        setShowPrizeModal(true);
        spawnCelebrationParticles();

        if (wonSector.premium || wonSector.type === 'USDT' || wonSector.value >= 50) {
          gameAudio.playJackpotFanfare();
        } else {
          gameAudio.playScore(3);
        }
      }
    };

    animFrame.current = requestAnimationFrame(animate);
  };

  const spawnCelebrationParticles = () => {
    const list: Array<{ id: number; x: number; y: number; color: string; size: number }> = [];
    const colors = ['#ffd700', '#00e676', '#00e5ff', '#ff007f', '#ffffff'];
    for (let i = 0; i < 50; i++) {
      list.push({
        id: Date.now() + i,
        x: Math.random() * 260 - 130,
        y: Math.random() * 260 - 130,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
      });
    }
    setParticles(list);

    const falling: Array<{ id: number; x: number; y: number; vy: number; vx: number; rotation: number; rotSpeed: number; scale: number; symbol: string; color: string }> = [];
    const symbol = wonSector.type === 'USDT' ? '₮' : wonSector.type === 'CRYSTALS' ? '💎' : '⚡';
    const color = wonSector.type === 'USDT' ? '#00e676' : wonSector.type === 'CRYSTALS' ? '#00e5ff' : '#ffd700';
    for (let i = 0; i < 40; i++) {
      falling.push({
        id: Math.random() + i,
        x: Math.random() * window.innerWidth,
        y: -60 - Math.random() * 350,
        vy: Math.random() * 4.5 + 3.5,
        vx: (Math.random() - 0.5) * 3.5,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 8,
        scale: Math.random() * 0.5 + 0.8,
        symbol,
        color,
      });
    }
    setCoins(falling);
  };

  useEffect(() => {
    if (!showPrizeModal) {
      if (coins.length > 0) setCoins([]);
      return;
    }
    let coinAnimId: number;
    const updateCoins = () => {
      setCoins((prev) =>
        prev
          .map((c) => ({ ...c, y: c.y + c.vy, x: c.x + c.vx, rotation: c.rotation + c.rotSpeed }))
          .filter((c) => c.y < window.innerHeight + 80)
      );
      coinAnimId = requestAnimationFrame(updateCoins);
    };
    coinAnimId = requestAnimationFrame(updateCoins);
    return () => cancelAnimationFrame(coinAnimId);
  }, [showPrizeModal, coins.length]);

  useEffect(() => {
    return () => {
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
    };
  }, []);

  const finalizeSession = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const durationMs = Date.now() - new Date(session.serverStartedAt).getTime();
      const result = await gamesService.endSession(session.gameId, session.sessionId, {
        score: wonSector.type === 'USDT' ? Math.round(wonSector.value * 100) : wonSector.value,
        durationMs,
        telemetry: [{ action: 'spin', t: durationMs }],
      });
      setShowPrizeModal(false);
      onComplete(result);
    } catch {
      setSubmitting(false);
      setShowPrizeModal(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#06080d]/98 backdrop-blur-2xl flex flex-col items-center justify-between p-4 select-none overflow-y-auto no-scrollbar">
      {/* ═══ Ambient Glow Stage ═══ */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
        <div className="w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-[#00e676]/15 via-[#ffd700]/10 to-[#00e5ff]/15 blur-[100px]" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[#00e676]/10 to-transparent pointer-events-none" />
      </div>

      <div className="w-full max-w-[420px] relative flex flex-col items-center z-10 my-auto">
        {/* ═══ Top Header ═══ */}
        <div className="w-full flex items-center justify-between mb-3 px-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-gold/30 via-gold/10 to-transparent border border-gold/50 flex items-center justify-center shadow-[0_0_20px_rgba(255,215,0,0.2)]">
              <span className="text-xl">🎡</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-black text-white tracking-wider leading-none">TITAN VAULT WHEEL</h2>
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-gold/20 text-gold border border-gold/40">
                  PRO
                </span>
              </div>
              <p className="text-[10px] text-text-secondary mt-0.5">High-Stakes Titanium Vault · Instant Payouts</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleMute}
              className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-text-secondary active:scale-95 transition-transform"
            >
              {muted ? <VolumeX size={15} /> : <Volume2 size={15} className="text-[#a7ffeb]" />}
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-text-secondary active:scale-95 transition-transform"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ═══ Status & Security Strip ═══ */}
        <div className="w-full bg-gradient-to-r from-white/[0.06] via-white/[0.03] to-white/[0.06] border border-white/12 rounded-2xl py-2 px-4 flex items-center justify-between mb-4 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-text-tertiary">Spin Cost:</span>
            <span className="font-mono text-xs text-gold font-extrabold flex items-center gap-1">💎 {session.crystalCost}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-usdt-green font-bold">
            <ShieldCheck size={14} className="text-usdt-green" />
            <span>Server-Authoritative RNG</span>
          </div>
        </div>

        {/* ═══ The 3D Titanium Vault Wheel Stage ═══ */}
        <div className="relative w-[340px] h-[340px] flex items-center justify-center mb-4">
          {/* Outer Multi-Layered Titanium Casing */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-b from-[#2a2e3d] via-[#141620] to-[#0a0b12] border-[6px] border-[#383d52] shadow-[0_12px_45px_rgba(0,0,0,0.9),0_0_35px_rgba(0,230,118,0.2),inset_0_4px_12px_rgba(255,255,255,0.2)] flex items-center justify-center">
            {/* 24 Perimeter LED Stud Bulbs */}
            {[...Array(24)].map((_, i) => {
              const isLit = spinning
                ? (i + ledPhase) % 4 === 0
                : i % 2 === ledPhase % 2;
              const bulbColor = isLit
                ? i % 3 === 0
                  ? 'bg-gold shadow-[0_0_12px_#ffd700]'
                  : i % 3 === 1
                    ? 'bg-usdt-green shadow-[0_0_12px_#00e676]'
                    : 'bg-[#00e5ff] shadow-[0_0_12px_#00e5ff]'
                : 'bg-white/20 shadow-none';

              return (
                <div
                  key={i}
                  className={`absolute w-2.5 h-2.5 rounded-full transition-colors duration-150 ${bulbColor}`}
                  style={{
                    transform: `rotate(${i * 15}deg) translateY(-161px)`,
                  }}
                />
              );
            })}
          </div>

          {/* 3D Spring-Loaded Mechanical Ticker Flapper (12 o'clock) */}
          <motion.div
            animate={{ rotate: tickerDeflection ? -22 : 0 }}
            transition={{ type: 'spring', stiffness: 700, damping: 14 }}
            className="absolute -top-4 left-1/2 -translate-x-1/2 z-40 w-10 h-14 flex flex-col items-center pointer-events-none filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.95)]"
            style={{ transformOrigin: 'top center' }}
          >
            {/* Golden Ticker Head */}
            <div className="w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[32px] border-t-gold filter drop-shadow-[0_2px_6px_rgba(255,215,0,0.8)]" />
            {/* Ruby Stud Pivot */}
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#ff1744] via-[#d50000] to-[#880000] border-2 border-white -mt-[34px] shadow-[0_0_10px_#ff1744]" />
          </motion.div>

          {/* Rotating High-DPI Canvas Wheel Disc */}
          <div
            className="w-[304px] h-[304px] rounded-full overflow-hidden relative border-[3px] border-gold/60 shadow-[inset_0_4px_30px_rgba(0,0,0,0.9),0_0_20px_rgba(255,215,0,0.3)] bg-[#090b12] z-10 flex items-center justify-center"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <canvas
              ref={canvasRef}
              className="w-full h-full object-contain pointer-events-none"
              style={{ width: '304px', height: '304px' }}
            />
          </div>

          {/* ═══ 3D Fusion Core Center Spin Button ═══ */}
          <button
            onClick={handleSpin}
            disabled={spinning || submitting}
            className="absolute z-30 w-24 h-24 rounded-full bg-gradient-to-b from-[#2e3448] via-[#1a1c29] to-[#0d0e17] border-[3px] border-gold/70 shadow-[0_10px_30px_rgba(0,0,0,0.95),inset_0_3px_8px_rgba(255,255,255,0.25),0_0_25px_rgba(255,215,0,0.35)] flex flex-col items-center justify-center active:scale-95 transition-transform disabled:opacity-95 cursor-pointer group"
          >
            <div className="absolute inset-1 rounded-full border border-white/10 bg-gradient-to-b from-white/[0.08] to-transparent pointer-events-none" />
            <Sparkles
              size={18}
              className={`text-gold mb-0.5 ${spinning ? 'animate-spin text-usdt-green' : 'group-hover:scale-110 transition-transform'}`}
            />
            <span className="text-xs font-black tracking-widest text-white leading-tight uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              {spinning ? 'SPINNING' : 'SPIN'}
            </span>
            <span className="text-[9px] font-mono font-bold text-gold/90 mt-0.5 flex items-center gap-0.5">
              💎 {session.crystalCost}
            </span>
          </button>
        </div>

        {/* ═══ Payoff & Live Sector Indicator ═══ */}
        <div className="w-full bg-white/[0.03] border border-white/8 rounded-2xl p-3 flex items-center justify-between shadow-inner">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center text-sm">
              👑
            </div>
            <div>
              <p className="text-[9px] uppercase font-black tracking-wider text-gold">Top Jackpot</p>
              <p className="text-xs font-mono font-extrabold text-white">₮ 50.00 USDT · GRAND VAULT</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase font-black tracking-wider text-text-tertiary">Payout Mode</p>
            <p className="text-xs font-mono font-extrabold text-usdt-green flex items-center justify-end gap-1">
              <Zap size={11} className="text-gold" /> INSTANT REWARD
            </p>
          </div>
        </div>

        {/* ═══ Falling Celebration Coins ═══ */}
        {showPrizeModal && coins.length > 0 && (
          <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
            {coins.map((c) => (
              <div
                key={c.id}
                className="absolute flex items-center justify-center select-none font-bold font-mono"
                style={{
                  transform: `translate(${c.x}px, ${c.y}px) rotate(${c.rotation}deg) scale(${c.scale})`,
                  color: c.color,
                  fontSize: c.symbol === '₮' ? '32px' : '24px',
                  textShadow: `0 0 16px ${c.color}cc, 0 4px 16px rgba(0,0,0,0.9)`,
                }}
              >
                {c.symbol}
              </div>
            ))}
          </div>
        )}

        {/* ═══ Celebration Victory Modal ═══ */}
        <AnimatePresence>
          {showPrizeModal && wonSector && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-[#050608]/96 flex flex-col items-center justify-center p-6 overflow-hidden backdrop-blur-2xl"
            >
              {/* Radial Sunburst rays */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-35">
                <div className="w-[600px] h-[600px] rounded-full border border-gold/20 bg-[radial-gradient(circle,_rgba(255,215,0,0.12)_0%,_transparent_70%)] animate-spin-slow" />
              </div>

              {/* Exploding Particles */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {particles.map((p) => (
                  <motion.div
                    key={p.id}
                    initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                    animate={{ x: p.x * 3.2, y: p.y * 3.2, scale: 0, opacity: 0 }}
                    transition={{ duration: 1.8, ease: 'easeOut' }}
                    className="absolute rounded-full"
                    style={{ width: p.size, height: p.size, backgroundColor: p.color, boxShadow: `0 0 14px ${p.color}` }}
                  />
                ))}
              </div>

              {/* Victory Card */}
              <motion.div
                initial={{ scale: 0.8, y: 30 }}
                animate={{ scale: 1, y: 0 }}
                className="w-full max-w-[340px] bg-gradient-to-b from-[#202434] to-[#0c0e16] border border-gold/40 rounded-3xl p-6 flex flex-col items-center text-center shadow-[0_0_60px_rgba(255,215,0,0.25)] relative"
              >
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mb-3 bg-gradient-to-br from-gold/25 to-transparent border border-gold/50 shadow-[0_0_30px_rgba(255,215,0,0.4)]">
                  {wonSector.type === 'USDT' ? '💵' : wonSector.type === 'CRYSTALS' ? '💎' : '⚡'}
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold/15 border border-gold/40 text-gold text-[10px] font-black uppercase tracking-wider mb-2">
                  <Flame size={12} className="text-gold" />
                  {wonSector.premium ? 'VAULT JACKPOT UNLOCKED' : 'PRIZE REVEALED'}
                </div>

                <h3 className="text-2xl font-black text-white tracking-wide uppercase">
                  {wonSector.premium ? 'MEGA WIN!' : 'CONGRATULATIONS!'}
                </h3>
                <p className="text-xs text-text-secondary mt-0.5 mb-5">Your Vault Wheel Outcome:</p>

                <div className="w-full bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/15 rounded-2xl px-6 py-5 mb-6 shadow-inner flex flex-col items-center justify-center relative overflow-hidden">
                  <span className="text-4xl font-mono font-black tracking-wide text-white drop-shadow-[0_2px_12px_rgba(255,215,0,0.5)]">
                    {wonSector.type === 'USDT'
                      ? `₮ ${wonSector.value.toFixed(2)}`
                      : wonSector.type === 'CRYSTALS'
                        ? `+${wonSector.value} 💎`
                        : `×${wonSector.value} Boost ⚡`}
                  </span>
                  <span className="text-[11px] text-gold mt-2 uppercase font-black tracking-widest">
                    {wonSector.label} · {wonSector.badge}
                  </span>
                </div>

                <button
                  onClick={finalizeSession}
                  disabled={submitting}
                  className="w-full py-4 bg-gradient-to-r from-usdt-green via-[#00e676] to-[#00c853] text-[#07190f] rounded-2xl text-sm font-black tracking-wider shadow-[0_8px_25px_rgba(0,230,118,0.35)] active:scale-95 transition-transform disabled:opacity-60"
                >
                  {submitting ? 'CLAIMING...' : 'CLAIM TO REWARDS'}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
