import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Sparkles, Flame, Volume2, VolumeX, RotateCcw, Trophy, Zap } from 'lucide-react';
import type { GameStartSession, GameEndResult } from '../../../services/gamesService';
import { gamesService } from '../../../services/gamesService';
import { gameAudio } from '../../../utils/gameAudio';

interface BasketballGameProps {
  session: GameStartSession;
  onClose: () => void;
  onComplete: (result: GameEndResult) => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  color: string;
  glow?: boolean;
}

interface FireParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  color: string;
}

const ROUND_SECONDS = 60;
const VIEW_WIDTH = 380;
const VIEW_HEIGHT = 540;
const GRAVITY = 0.38;
const BALL_RADIUS = 16;
const FLOOR_Y = 470;
const BASE_HOOP_Y = 135;
const HOOP_RADIUS = 28; // width = 56px

export const BasketballGame: React.FC<BasketballGameProps> = ({ session, onClose, onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [active, setActive] = useState(true);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [roundOver, setRoundOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [swishMessage, setSwishMessage] = useState<string | null>(null);
  const [muted, setMuted] = useState(gameAudio.getMuted());
  const [showInstructions, setShowInstructions] = useState(true);

  const sessionStartMs = useRef(Date.now());
  const telemetry = useRef<Array<{ action: string; t: number }>>([]);
  const launchesRef = useRef(0);
  const bestComboRef = useRef(0);
  const consecutiveSwishes = useRef(0);

  // Drag gesture variables in logical canvas coordinates
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const dragCurrent = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const dragMode = useRef<'forward' | 'slingshot'>('forward');

  // Particles & Visual effects
  const particles = useRef<Particle[]>([]);
  const fireParticles = useRef<FireParticle[]>([]);
  const rimRipple = useRef<{ active: boolean; x: number; y: number; radius: number; opacity: number } | null>(null);
  const netWave = useRef<{ intensity: number; direction: number }>({ intensity: 0, direction: 0 });

  // Game physics state
  const gameState = useRef({
    ball: {
      x: VIEW_WIDTH / 2,
      y: 430,
      vx: 0,
      vy: 0,
      radius: BALL_RADIUS,
      rotation: 0,
      isLaunched: false,
      touchedRim: false,
      scoredThisLaunch: false,
    },
    hoop: {
      x: VIEW_WIDTH / 2,
      y: BASE_HOOP_Y,
      vx: 1.6,
      width: HOOP_RADIUS * 2,
      direction: 1,
      baseSpeed: 1.6,
    },
    backboard: {
      x: VIEW_WIDTH / 2 + HOOP_RADIUS + 8,
      y: BASE_HOOP_Y - 24,
      width: 12,
      height: 70,
    },
    flashIntensity: 0,
    time: 0,
    resetTimeoutId: null as number | null,
  });

  // Toggle Mute
  const handleToggleMute = () => {
    const isMute = gameAudio.toggleMute();
    setMuted(isMute);
  };

  // Round countdown timer
  useEffect(() => {
    if (!active || roundOver) return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, ROUND_SECONDS - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 5 && remaining > 0) {
        gameAudio.haptic('warning');
      }

      if (remaining <= 0) {
        clearInterval(timer);
        endRound();
      }
    }, 250);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, roundOver]);

  const endRound = () => {
    if (roundOver || submitting) return;
    setRoundOver(true);
    setSubmitting(true);
    setActive(false);
    gameAudio.playGameOver();
    void submitResult();
  };

  const submitResult = async () => {
    const durationMs = Date.now() - sessionStartMs.current;
    const makes = score;
    const launches = launchesRef.current;
    try {
      const result = await gamesService.endSession(session.gameId, session.sessionId, {
        score,
        durationMs,
        telemetry: telemetry.current,
        stats: {
          combo: bestComboRef.current,
          accuracy: launches > 0 ? Math.round((makes / launches) * 100) : 0,
          perfect: launches > 0 && makes === launches,
        },
      });
      onComplete(result);
    } catch {
      onClose();
    }
  };

  // Trigger celebration explosion
  const triggerConfetti = (hx: number, hy: number, isSwish: boolean) => {
    const colors = isSwish
      ? ['#a7ffeb', '#00e676', '#ffd700', '#ffffff', '#00e5ff']
      : ['#00e676', '#ffb300', '#ff3d00', '#00e5ff', '#ff007f'];

    const count = isSwish ? 32 : 20;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = Math.random() * 5 + 3;
      particles.current.push({
        x: hx,
        y: hy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: Math.random() * 4 + 3,
        opacity: 1.0,
        color: colors[Math.floor(Math.random() * colors.length)],
        glow: true,
      });
    }
  };

  // Reset ball to starting position
  const resetBall = useCallback(() => {
    const state = gameState.current;
    state.ball.isLaunched = false;
    state.ball.x = VIEW_WIDTH / 2;
    state.ball.y = 430;
    state.ball.vx = 0;
    state.ball.vy = 0;
    state.ball.rotation = 0;
    state.ball.touchedRim = false;
    state.ball.scoredThisLaunch = false;
    fireParticles.current = [];
  }, []);

  // Main Canvas Render & Physics Loop
  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const updatePhysics = () => {
      const state = gameState.current;
      state.time += 0.02;

      // 1. Move Hoop (Moving target progression)
      if (score >= 2) {
        const speedMultiplier = Math.min(1 + score * 0.06, 2.2);
        state.hoop.x += state.hoop.baseSpeed * speedMultiplier * state.hoop.direction;

        // Subtle vertical oscillation on higher scores
        if (score >= 6) {
          state.hoop.y = BASE_HOOP_Y + Math.sin(state.time * 2.5) * 14;
        } else {
          state.hoop.y = BASE_HOOP_Y;
        }

        // Bounce hoop off boundaries
        const minX = HOOP_RADIUS + 30;
        const maxX = VIEW_WIDTH - HOOP_RADIUS - 35;
        if (state.hoop.x < minX) {
          state.hoop.x = minX;
          state.hoop.direction = 1;
        } else if (state.hoop.x > maxX) {
          state.hoop.x = maxX;
          state.hoop.direction = -1;
        }
      } else {
        state.hoop.x = VIEW_WIDTH / 2;
        state.hoop.y = BASE_HOOP_Y;
      }

      // Sync backboard position
      state.backboard.x = state.hoop.x + HOOP_RADIUS + 8;
      state.backboard.y = state.hoop.y - 24;

      // 2. Net wave decay
      if (netWave.current.intensity > 0) {
        netWave.current.intensity = Math.max(0, netWave.current.intensity - 0.04);
      }

      // 3. Update Particles
      particles.current = particles.current
        .map((p) => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: p.vy + 0.18,
          opacity: p.opacity - 0.025,
          size: Math.max(0, p.size - 0.06),
        }))
        .filter((p) => p.opacity > 0 && p.size > 0);

      // 4. Update Fire Particles (Fire mode at combo >= 3)
      if (combo >= 3 && state.ball.isLaunched) {
        const fireColors = ['#ff3d00', '#ff9100', '#ffea00', '#ffffff'];
        for (let i = 0; i < 3; i++) {
          fireParticles.current.push({
            x: state.ball.x + (Math.random() - 0.5) * 16,
            y: state.ball.y + (Math.random() - 0.5) * 16,
            vx: (Math.random() - 0.5) * 1.5 - state.ball.vx * 0.15,
            vy: (Math.random() - 0.5) * 1.5 - state.ball.vy * 0.15,
            size: Math.random() * 8 + 6,
            opacity: 1.0,
            color: fireColors[Math.floor(Math.random() * fireColors.length)],
          });
        }
      }

      fireParticles.current = fireParticles.current
        .map((p) => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy - 0.4,
          size: Math.max(0, p.size - 0.22),
          opacity: p.opacity - 0.04,
        }))
        .filter((p) => p.size > 0 && p.opacity > 0);

      // 5. Update Rim Ripple
      if (rimRipple.current && rimRipple.current.active) {
        rimRipple.current.radius += 2.2;
        rimRipple.current.opacity -= 0.045;
        if (rimRipple.current.opacity <= 0) {
          rimRipple.current.active = false;
        }
      }

      // 6. Ball In-Flight Physics
      const b = state.ball;
      if (b.isLaunched) {
        b.vy += GRAVITY;
        b.x += b.vx;
        b.y += b.vy;
        b.rotation += b.vx * 0.05;

        // Wall collisions
        if (b.x - b.radius < 10) {
          b.x = 10 + b.radius;
          b.vx = -b.vx * 0.65;
          gameAudio.playBackboardHit();
        } else if (b.x + b.radius > VIEW_WIDTH - 10) {
          b.x = VIEW_WIDTH - 10 - b.radius;
          b.vx = -b.vx * 0.65;
          gameAudio.playBackboardHit();
        }

        // Backboard collision (Vertical glass surface)
        const bb = state.backboard;
        if (
          b.x + b.radius >= bb.x - bb.width / 2 &&
          b.x - b.radius <= bb.x + bb.width / 2 &&
          b.y + b.radius >= bb.y - bb.height / 2 &&
          b.y - b.radius <= bb.y + bb.height / 2
        ) {
          b.x = bb.x - bb.width / 2 - b.radius;
          b.vx = -Math.abs(b.vx) * 0.65 - 1.5;
          b.vy *= 0.8;
          b.touchedRim = true;
          gameAudio.playBackboardHit();
        }

        // Rim collisions (Left Pin & Right Pin elastic collision)
        const hoopY = state.hoop.y;
        const leftPinX = state.hoop.x - HOOP_RADIUS;
        const rightPinX = state.hoop.x + HOOP_RADIUS;

        // Check left pin
        const distLeft = Math.hypot(b.x - leftPinX, b.y - hoopY);
        if (distLeft < b.radius + 4) {
          const angle = Math.atan2(b.y - hoopY, b.x - leftPinX);
          b.x = leftPinX + Math.cos(angle) * (b.radius + 4);
          b.y = hoopY + Math.sin(angle) * (b.radius + 4);
          const normalSpeed = b.vx * Math.cos(angle) + b.vy * Math.sin(angle);
          b.vx -= 1.6 * normalSpeed * Math.cos(angle);
          b.vy -= 1.6 * normalSpeed * Math.sin(angle);
          b.touchedRim = true;
          gameAudio.playRimHit();
        }

        // Check right pin
        const distRight = Math.hypot(b.x - rightPinX, b.y - hoopY);
        if (distRight < b.radius + 4) {
          const angle = Math.atan2(b.y - hoopY, b.x - rightPinX);
          b.x = rightPinX + Math.cos(angle) * (b.radius + 4);
          b.y = hoopY + Math.sin(angle) * (b.radius + 4);
          const normalSpeed = b.vx * Math.cos(angle) + b.vy * Math.sin(angle);
          b.vx -= 1.6 * normalSpeed * Math.cos(angle);
          b.vy -= 1.6 * normalSpeed * Math.sin(angle);
          b.touchedRim = true;
          gameAudio.playRimHit();
        }

        // Hoop Scoring Gate Detection (Passing downwards through the cylinder)
        if (
          !b.scoredThisLaunch &&
          b.vy > 0 &&
          b.y >= hoopY &&
          b.y - b.vy <= hoopY + 14 &&
          b.x >= leftPinX + 4 &&
          b.x <= rightPinX - 4
        ) {
          b.scoredThisLaunch = true;
          state.flashIntensity = 12;
          netWave.current = { intensity: 1.0, direction: b.vx > 0 ? 1 : -1 };
          rimRipple.current = { active: true, x: state.hoop.x, y: hoopY, radius: 10, opacity: 1.0 };

          const isCleanSwish = !b.touchedRim;
          if (isCleanSwish) {
            consecutiveSwishes.current += 1;
            setSwishMessage(consecutiveSwishes.current >= 2 ? `PERFECT SWISH! x${consecutiveSwishes.current} 🌟` : 'CLEAN SWISH! 🌟');
            gameAudio.playSwish();
            triggerConfetti(state.hoop.x, hoopY, true);
          } else {
            consecutiveSwishes.current = 0;
            setSwishMessage(null);
            gameAudio.playScore(combo + 1);
            triggerConfetti(state.hoop.x, hoopY, false);
          }

          telemetry.current.push({ action: isCleanSwish ? 'swish' : 'hoop', t: Date.now() - sessionStartMs.current });

          // Score & Combo Update
          setScore((s) => {
            const nextScore = s + (isCleanSwish ? 2 : 1);
            setCombo((c) => {
              const nextCombo = c + 1;
              bestComboRef.current = Math.max(bestComboRef.current, nextCombo);
              if (nextCombo === 3) {
                gameAudio.playFireMode();
              }
              return nextCombo;
            });
            return nextScore;
          });
        }

        // Out of Bounds / Reset condition
        if (b.y - b.radius > VIEW_HEIGHT) {
          if (!b.scoredThisLaunch) {
            setCombo(0);
            consecutiveSwishes.current = 0;
            setSwishMessage(null);
          }
          resetBall();
        }
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
      const state = gameState.current;

      // ── Background Atmosphere & Court Perspective ───────────────────────────
      const bgGrad = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
      bgGrad.addColorStop(0, '#090b10');
      bgGrad.addColorStop(0.65, '#0d1017');
      bgGrad.addColorStop(1, '#131722');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

      // Cyber Hex Grid Floor
      ctx.strokeStyle = 'rgba(0, 230, 118, 0.07)';
      ctx.lineWidth = 1;
      const floorStart = FLOOR_Y - 40;
      for (let y = floorStart; y <= VIEW_HEIGHT; y += 18) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(VIEW_WIDTH, y);
        ctx.stroke();
      }
      for (let x = 20; x < VIEW_WIDTH; x += 36) {
        ctx.beginPath();
        ctx.moveTo(x, floorStart);
        ctx.lineTo(x + (x - VIEW_WIDTH / 2) * 0.4, VIEW_HEIGHT);
        ctx.stroke();
      }

      // Three-point Key Arch
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(VIEW_WIDTH / 2, FLOOR_Y + 10, 140, 50, 0, Math.PI, 0);
      ctx.stroke();

      // Green Flash on Score
      if (state.flashIntensity > 0) {
        ctx.fillStyle = `rgba(0, 230, 118, ${state.flashIntensity / 35})`;
        ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
        state.flashIntensity--;
      }

      // ── Ball Floor Shadow ──────────────────────────────────────────────────
      const b = state.ball;
      const heightAboveFloor = Math.max(0, FLOOR_Y - b.y);
      const shadowScale = Math.max(0.2, 1 - heightAboveFloor / 300);
      const shadowOpacity = Math.max(0.04, 0.4 - heightAboveFloor / 450);

      ctx.fillStyle = `rgba(0, 0, 0, ${shadowOpacity})`;
      ctx.beginPath();
      ctx.ellipse(b.x, FLOOR_Y + 12, b.radius * 1.5 * shadowScale, b.radius * 0.45 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();

      // ── Confetti & Sparkle Particles ───────────────────────────────────────
      particles.current.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        if (p.glow) {
          ctx.shadowBlur = 8;
          ctx.shadowColor = p.color;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });
      ctx.globalAlpha = 1.0;

      // ── Fire Particles ─────────────────────────────────────────────────────
      fireParticles.current.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.shadowBlur = p.size * 1.6;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;
      ctx.shadowBlur = 0;

      // ── Hoop Structure & Backboard ─────────────────────────────────────────
      const hoop = state.hoop;
      const bb = state.backboard;

      // Backboard Mast Support
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(bb.x, bb.y);
      ctx.lineTo(bb.x + 30, bb.y - 40);
      ctx.lineTo(VIEW_WIDTH + 20, bb.y - 40);
      ctx.stroke();

      // Glass Backboard Panel
      ctx.fillStyle = 'rgba(18, 24, 38, 0.75)';
      ctx.strokeStyle = 'rgba(0, 230, 118, 0.45)';
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(0, 230, 118, 0.25)';
      ctx.beginPath();
      ctx.roundRect(bb.x - bb.width / 2, bb.y - bb.height / 2, bb.width, bb.height, 4);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Inner Target Box on Backboard
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.strokeRect(bb.x - bb.width / 2 + 1, bb.y - 12, bb.width - 2, 24);

      // Hoop Mounting Arm
      ctx.strokeStyle = '#ff9100';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bb.x - bb.width / 2, hoop.y);
      ctx.lineTo(hoop.x + HOOP_RADIUS, hoop.y);
      ctx.stroke();

      // ── Cloth/Chain Net Simulation ─────────────────────────────────────────
      const netLeft = hoop.x - HOOP_RADIUS;
      const netRight = hoop.x + HOOP_RADIUS;
      const netBottomY = hoop.y + 26 + netWave.current.intensity * 8;
      const waveShift = netWave.current.intensity * netWave.current.direction * 12;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();

      // Outer Net Outline
      ctx.moveTo(netLeft, hoop.y);
      ctx.quadraticCurveTo(netLeft + 6 + waveShift, hoop.y + 14, netLeft + 8 + waveShift, netBottomY);
      ctx.lineTo(netRight - 8 + waveShift, netBottomY);
      ctx.quadraticCurveTo(netRight - 6 + waveShift, hoop.y + 14, netRight, hoop.y);
      ctx.stroke();

      // Net Mesh Lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.beginPath();
      ctx.moveTo(netLeft + 10, hoop.y);
      ctx.lineTo(netLeft + 12 + waveShift, netBottomY);
      ctx.moveTo(netRight - 10, hoop.y);
      ctx.lineTo(netRight - 12 + waveShift, netBottomY);
      ctx.moveTo(hoop.x, hoop.y);
      ctx.lineTo(hoop.x + waveShift, netBottomY);
      // Horizontal Rungs
      ctx.moveTo(netLeft + 3, hoop.y + 9);
      ctx.lineTo(netRight - 3, hoop.y + 9);
      ctx.moveTo(netLeft + 6, hoop.y + 18);
      ctx.lineTo(netRight - 6, hoop.y + 18);
      ctx.stroke();

      // ── Metallic Neon Rim ──────────────────────────────────────────────────
      const isFire = combo >= 3;
      const rimColor = isFire ? '#ff3d00' : '#ff9100';
      ctx.strokeStyle = rimColor;
      ctx.lineWidth = 4;
      ctx.shadowBlur = isFire ? 14 : 8;
      ctx.shadowColor = rimColor;
      ctx.beginPath();
      ctx.moveTo(netLeft, hoop.y);
      ctx.lineTo(netRight, hoop.y);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Rim Pins (Left & Right bumper caps)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(netLeft, hoop.y, 3, 0, Math.PI * 2);
      ctx.arc(netRight, hoop.y, 3, 0, Math.PI * 2);
      ctx.fill();

      // Rim Ripple on Goal
      if (rimRipple.current && rimRipple.current.active) {
        ctx.strokeStyle = `rgba(0, 230, 118, ${rimRipple.current.opacity})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(rimRipple.current.x, rimRipple.current.y, rimRipple.current.radius, rimRipple.current.radius * 0.45, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // ── Trajectory Prediction Arc (Aiming Dots) ────────────────────────────
      if (isDragging.current && dragStart.current && dragCurrent.current && !b.isLaunched) {
        const rawDx = dragCurrent.current.x - dragStart.current.x;
        const rawDy = dragCurrent.current.y - dragStart.current.y;

        let vx = 0;
        let vy = 0;

        if (dragMode.current === 'forward') {
          // Forward flick: swipe up towards hoop
          const clampedDx = Math.max(-100, Math.min(100, rawDx));
          const clampedDy = Math.max(-140, Math.min(-20, rawDy));
          vx = clampedDx * 0.13;
          vy = clampedDy * 0.15;
        } else {
          // Slingshot: pull back and release
          const clampedDx = Math.max(-100, Math.min(100, -rawDx));
          const clampedDy = Math.max(20, Math.min(120, rawDy));
          vx = clampedDx * 0.13;
          vy = -clampedDy * 0.15;
        }

        // Clamp total launch velocity
        vy = Math.max(-16.5, Math.min(-10.5, vy));

        let simX = b.x;
        let simY = b.y;
        let simVx = vx;
        let simVy = vy;

        for (let i = 1; i <= 14; i++) {
          simVy += GRAVITY;
          simX += simVx;
          simY += simVy;

          if (simY > FLOOR_Y + 10) break;

          const dotProgress = i / 14;
          const dotSize = Math.max(2, 4.5 * (1 - dotProgress * 0.5));
          const dotAlpha = Math.max(0.2, 0.85 - dotProgress * 0.5);

          ctx.fillStyle = isFire ? '#ff9100' : '#00e676';
          ctx.globalAlpha = dotAlpha;
          ctx.shadowBlur = 6;
          ctx.shadowColor = isFire ? '#ff3d00' : '#00e676';
          ctx.beginPath();
          ctx.arc(simX, simY, dotSize, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;
      }

      // ── 3D Basketball with Realistic Shader & Spin ─────────────────────────
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rotation);

      // Radial Sphere Gradient
      const ballGrad = ctx.createRadialGradient(-b.radius * 0.35, -b.radius * 0.35, 2, 0, 0, b.radius);
      if (isFire) {
        ballGrad.addColorStop(0, '#fff59d');
        ballGrad.addColorStop(0.3, '#ff9100');
        ballGrad.addColorStop(0.75, '#e65100');
        ballGrad.addColorStop(1, '#bf360c');
      } else {
        ballGrad.addColorStop(0, '#ffb74d');
        ballGrad.addColorStop(0.35, '#f57c00');
        ballGrad.addColorStop(0.8, '#d84315');
        ballGrad.addColorStop(1, '#8e2400');
      }

      ctx.fillStyle = ballGrad;
      ctx.strokeStyle = isFire ? '#ffe082' : '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Basketball Seams (Curved Ribs)
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.lineWidth = 1.4;

      ctx.beginPath();
      ctx.arc(-b.radius * 0.45, 0, b.radius * 0.85, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(b.radius * 0.45, 0, b.radius * 0.85, Math.PI * 0.55, Math.PI * 1.45);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-b.radius, 0);
      ctx.lineTo(b.radius, 0);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, -b.radius);
      ctx.lineTo(0, b.radius);
      ctx.stroke();

      ctx.restore();
    };

    const renderLoop = () => {
      updatePhysics();
      draw();
      animationFrameId = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [active, score, combo, resetBall]);

  // ── Unified Pointer & Coordinate Handlers ──────────────────────────────────
  const getCanvasCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = VIEW_WIDTH / rect.width;
    const scaleY = VIEW_HEIGHT / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameState.current.ball.isLaunched || roundOver) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    const coords = getCanvasCoords(e.clientX, e.clientY);
    const b = gameState.current.ball;

    // Allow interaction if touching within reasonable distance of the lower court
    const distToBall = Math.hypot(coords.x - b.x, coords.y - b.y);
    if (distToBall < 90 || coords.y > 330) {
      dragStart.current = coords;
      dragCurrent.current = coords;
      isDragging.current = true;
      dragMode.current = 'forward'; // default to forward swipe
      if (showInstructions) setShowInstructions(false);
      gameAudio.haptic('light');
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging.current || !dragStart.current) return;
    const coords = getCanvasCoords(e.clientX, e.clientY);
    dragCurrent.current = coords;

    // Determine mode based on initial drag vector
    const dy = coords.y - dragStart.current.y;
    if (dy > 15) {
      dragMode.current = 'slingshot'; // Dragging downward = pull-back slingshot
    } else if (dy < -10) {
      dragMode.current = 'forward'; // Dragging upward = forward flick
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging.current || !dragStart.current || !dragCurrent.current) return;
    isDragging.current = false;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const rawDx = dragCurrent.current.x - dragStart.current.x;
    const rawDy = dragCurrent.current.y - dragStart.current.y;
    const dist = Math.hypot(rawDx, rawDy);

    // Minimum gesture threshold
    if (dist > 16) {
      const state = gameState.current;
      launchesRef.current += 1;

      let vx = 0;
      let vy = 0;

      if (dragMode.current === 'forward') {
        // Forward swipe: launch in swipe direction
        const clampedDx = Math.max(-100, Math.min(100, rawDx));
        const clampedDy = Math.max(-140, Math.min(-25, rawDy));
        vx = clampedDx * 0.13;
        vy = clampedDy * 0.15;
      } else {
        // Slingshot: launch in opposite direction
        const clampedDx = Math.max(-100, Math.min(100, -rawDx));
        const clampedDy = Math.max(25, Math.min(120, rawDy));
        vx = clampedDx * 0.13;
        vy = -clampedDy * 0.15;
      }

      // Clamp velocities to safe, realistic physics limits
      state.ball.vx = Math.max(-8, Math.min(8, vx));
      state.ball.vy = Math.max(-16.5, Math.min(-10.5, vy));
      state.ball.isLaunched = true;

      gameAudio.playWhoosh();
      gameAudio.haptic('light');

      telemetry.current.push({ action: 'throw', t: Date.now() - sessionStartMs.current });
    }

    dragStart.current = null;
    dragCurrent.current = null;
  };

  const close = () => {
    setActive(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#050608]/95 backdrop-blur-2xl flex flex-col items-center justify-center p-3 select-none touch-none">
      <div className="w-full max-w-[420px] relative flex flex-col items-center animate-fade-in">
        {/* ═══ Top Navigation Bar ═══ */}
        <div className="w-full flex items-center justify-between mb-2.5 px-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0088cc]/25 to-transparent border border-[#0088cc]/40 flex items-center justify-center shadow-lg">
              <span className="text-xl">🏀</span>
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-wide leading-tight flex items-center gap-1.5">
                TITAN HOOP
              </h2>
              <p className="text-[10px] text-text-tertiary">Swipe or aim to shoot · 60s Round</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio Mute Toggle */}
            <button
              onClick={handleToggleMute}
              className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-text-secondary active:scale-95 transition-transform"
            >
              {muted ? <VolumeX size={15} /> : <Volume2 size={15} className="text-[#a7ffeb]" />}
            </button>
            {/* Close Button */}
            <button
              onClick={close}
              className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-text-secondary active:scale-95 transition-transform"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ═══ Dashboard Status Cards ═══ */}
        <div className="w-full grid grid-cols-4 gap-2 mb-2.5">
          {/* Score */}
          <div className="bg-gradient-to-br from-white/[0.04] to-transparent border border-white/10 rounded-2xl py-1.5 px-2 flex flex-col items-center shadow-md">
            <span className="text-[8px] font-extrabold uppercase tracking-wider text-text-tertiary">Score</span>
            <span className="font-mono text-base text-usdt-green font-black mt-0.5">{score} 🏀</span>
          </div>

          {/* Combo / Streak */}
          <div className="bg-gradient-to-br from-white/[0.04] to-transparent border border-white/10 rounded-2xl py-1.5 px-2 flex flex-col items-center relative overflow-hidden shadow-md">
            {combo >= 3 && <div className="absolute inset-0 bg-[#ff3d00]/10 animate-pulse pointer-events-none" />}
            <span className="text-[8px] font-extrabold uppercase tracking-wider text-text-tertiary flex items-center gap-0.5">
              Streak
              {combo >= 3 && <Flame size={10} className="text-[#ff3d00] animate-bounce" />}
            </span>
            <span className={`font-mono text-base font-black mt-0.5 transition-all ${combo >= 3 ? 'text-[#ff3d00] animate-pulse' : 'text-white'}`}>
              x{combo}
            </span>
          </div>

          {/* Accuracy */}
          <div className="bg-gradient-to-br from-white/[0.04] to-transparent border border-white/10 rounded-2xl py-1.5 px-2 flex flex-col items-center shadow-md">
            <span className="text-[8px] font-extrabold uppercase tracking-wider text-text-tertiary">Accuracy</span>
            <span className="font-mono text-base text-gold font-black mt-0.5">
              {launchesRef.current > 0 ? Math.round((score / launchesRef.current) * 100) : 100}%
            </span>
          </div>

          {/* Time Countdown */}
          <div className={`bg-gradient-to-br from-white/[0.04] to-transparent border rounded-2xl py-1.5 px-2 flex flex-col items-center shadow-md ${
            timeLeft <= 10 ? 'border-error-red/40 bg-error-red/5' : 'border-white/10'
          }`}>
            <span className="text-[8px] font-extrabold uppercase tracking-wider text-text-tertiary">Time</span>
            <span className={`font-mono text-base font-black mt-0.5 ${timeLeft <= 10 ? 'text-error-red animate-pulse' : 'text-[#a7ffeb]'}`}>
              {timeLeft}s
            </span>
          </div>
        </div>

        {/* ═══ Game Arena Canvas Container ═══ */}
        <div
          ref={containerRef}
          className="relative w-full aspect-[380/540] max-h-[540px] rounded-3xl overflow-hidden border border-white/15 bg-[#090b10] shadow-[0_8px_32px_rgba(0,0,0,0.6)] mb-2.5"
        >
          <canvas
            ref={canvasRef}
            width={VIEW_WIDTH}
            height={VIEW_HEIGHT}
            className="w-full h-full block cursor-grab active:cursor-grabbing touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />

          {/* Swish Banner Alert */}
          {swishMessage && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#a7ffeb]/20 via-[#00e676]/30 to-[#a7ffeb]/20 border border-[#a7ffeb]/60 text-[#a7ffeb] text-[11px] font-black px-4 py-1.5 rounded-full shadow-[0_0_20px_rgba(0,230,118,0.4)] animate-bounce z-20 whitespace-nowrap">
              {swishMessage}
            </div>
          )}

          {/* Fire Mode Banner */}
          {combo >= 3 && !swishMessage && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#ff3d00]/20 border border-[#ff3d00]/50 text-[#ff9100] text-[10px] font-black px-3.5 py-1 rounded-full flex items-center gap-1.5 uppercase tracking-wider shadow-[0_0_15px_rgba(255,61,0,0.35)] animate-pulse z-20">
              <Flame size={13} className="text-[#ff3d00] animate-bounce" /> FIRE MODE 2X PAYOUT
            </div>
          )}

          {/* First Time Gesture Tutorial */}
          {showInstructions && !roundOver && (
            <div className="absolute inset-x-0 bottom-16 flex flex-col items-center justify-center gap-2 pointer-events-none z-20 animate-fade-in">
              <div className="w-12 h-12 rounded-full bg-[#00e676]/20 border border-[#00e676]/40 flex items-center justify-center text-xl animate-bounce shadow-lg">
                👆
              </div>
              <div className="bg-black/75 backdrop-blur-md px-4 py-2 rounded-xl border border-white/15 text-center">
                <p className="text-xs font-black text-white uppercase tracking-wider">Swipe Up to Shoot!</p>
                <p className="text-[10px] text-text-secondary">Drag towards the basket and release</p>
              </div>
            </div>
          )}

          {/* Round Over Loading Overlay */}
          {roundOver && (
            <div className="absolute inset-0 z-30 bg-[#050608]/85 backdrop-blur-md flex flex-col items-center justify-center gap-3 animate-fade-in">
              <div className="w-14 h-14 rounded-2xl bg-gold/15 border border-gold/30 flex items-center justify-center shadow-lg">
                <Trophy size={28} className="text-gold animate-bounce" />
              </div>
              <p className="text-lg font-black text-white uppercase tracking-widest">Round Complete!</p>
              <div className="flex items-center gap-2 text-xs text-[#a7ffeb]">
                <Zap size={14} className="animate-spin-slow" />
                <span>Verifying score &amp; crediting crystals...</span>
              </div>
            </div>
          )}
        </div>

        {/* ═══ Footer Info Strip ═══ */}
        <div className="flex items-center justify-between w-full px-3 text-[10px] text-text-tertiary">
          <span className="flex items-center gap-1">
            <Sparkles size={11} className="text-[#a7ffeb]" /> Clean swishes = +2 pts
          </span>
          <span className="flex items-center gap-1">
            <Flame size={11} className="text-[#ff3d00]" /> Streak x3 = Fire Mode
          </span>
        </div>
      </div>
    </div>
  );
};
