import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Flame, Volume2, VolumeX, AlertTriangle, ShieldCheck, Activity } from 'lucide-react';
import type { GameStartSession, GameEndResult } from '../../../services/gamesService';
import { gamesService } from '../../../services/gamesService';
import { CountdownOverlay } from './CountdownOverlay';
import { gameAudio } from '../../../utils/gameAudio';

interface TitanReactorProps {
  session: GameStartSession;
  onClose: () => void;
  onComplete: (result: GameEndResult) => void;
}

interface Node {
  id: number;
  cell: number;
  bornAt: number;
  duration: number;
  type: 'standard' | 'critical' | 'coolant';
}

const GRID_COLS = 4;
const GRID_ROWS = 3;
const CELL_COUNT = GRID_COLS * GRID_ROWS;
const ROUND_MS = 45_000;
const BASE_POINTS = 10;
const MISS_PENALTY = 8;
const MAX_COMBO_BONUS = 5;

export const TitanReactor: React.FC<TitanReactorProps> = ({ session, onClose, onComplete }) => {
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_MS / 1000);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [phase, setPhase] = useState<'countdown' | 'playing' | 'over'>('countdown');
  const [feedback, setFeedback] = useState<{ id: number; kind: 'fast' | 'hit' | 'miss' | 'critical'; points: number } | null>(null);
  const [roundOver, setRoundOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [missFlash, setMissFlash] = useState(false);
  const [coreHeat, setCoreHeat] = useState(20);
  const [muted, setMuted] = useState(gameAudio.getMuted());

  const sessionStartMs = useRef(Date.now());
  const playStartMs = useRef(0);
  const telemetry = useRef<Array<{ action: string; t: number }>>([]);
  const reactionTimes = useRef<number[]>([]);

  const stateRef = useRef({
    score: 0,
    combo: 0,
    bestCombo: 0,
    hits: 0,
    misses: 0,
    nodes: [] as Node[],
    nextId: 1,
    difficulty: 1400,
    coreHeat: 20,
  });

  const handleToggleMute = () => {
    const isMute = gameAudio.toggleMute();
    setMuted(isMute);
  };

  // ── Node spawner & tick loop ───────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return;

    const interval = window.setInterval(() => {
      const s = stateRef.current;
      const now = Date.now();
      const elapsed = now - playStartMs.current;
      const progress = Math.min(elapsed / ROUND_MS, 1);

      // Node lifespan ramps from 1350ms down to 680ms
      s.difficulty = 1350 - 670 * progress;

      // Calculate Core Heat (climbs with time and misses, drops with successful hits)
      const targetHeat = Math.min(98, Math.max(10, Math.round(20 + progress * 40 + s.misses * 6 - s.hits * 1.5)));
      s.coreHeat = targetHeat;
      setCoreHeat(targetHeat);

      // Node spawning
      const maxActive = Math.min(1 + Math.floor(progress * 2.8) + (s.difficulty < 950 ? 1 : 0), CELL_COUNT - 1);
      const activeCount = s.nodes.length;

      if (activeCount < maxActive && Math.random() < 0.38 + progress * 0.45) {
        const occupied = new Set(s.nodes.map((n) => n.cell));
        const free = Array.from({ length: CELL_COUNT }, (_, i) => i).filter((c) => !occupied.has(c));
        if (free.length > 0) {
          const cell = free[Math.floor(Math.random() * free.length)];
          const isCrit = Math.random() < 0.2;
          const isCoolant = !isCrit && Math.random() < 0.15;
          const nodeType: Node['type'] = isCrit ? 'critical' : isCoolant ? 'coolant' : 'standard';

          const node: Node = {
            id: s.nextId++,
            cell,
            bornAt: now,
            duration: s.difficulty * (isCrit ? 0.8 : 1.0),
            type: nodeType,
          };
          s.nodes.push(node);
          telemetry.current.push({ action: 'node_spawn', t: now - sessionStartMs.current });
          setNodes([...s.nodes]);
        }
      }

      // Expired nodes (Missed coolant / reactor vent failures)
      const now2 = Date.now();
      const expired = s.nodes.filter((n) => now2 - n.bornAt > n.duration);
      if (expired.length > 0) {
        for (const n of expired) {
          s.misses += 1;
          s.combo = 0;
          s.score = Math.max(0, s.score - MISS_PENALTY);
          telemetry.current.push({ action: 'miss', t: now2 - sessionStartMs.current });
          setFeedback({ id: n.id, kind: 'miss', points: -MISS_PENALTY });
          gameAudio.playBackboardHit();
          gameAudio.haptic('medium');
          window.setTimeout(() => setFeedback((f) => (f?.id === n.id ? null : f)), 300);
        }

        setMissFlash(true);
        window.setTimeout(() => setMissFlash(false), 260);

        s.nodes = s.nodes.filter((n) => now2 - n.bornAt <= n.duration);
        setNodes([...s.nodes]);
        setMisses(s.misses);
        setCombo(0);
        setScore(s.score);
      }
    }, 150);

    return () => window.clearInterval(interval);
  }, [phase]);

  // ── Round timer ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((ROUND_MS - (Date.now() - playStartMs.current)) / 1000));
      setTimeLeft(remaining);

      if (remaining <= 5 && remaining > 0) {
        gameAudio.haptic('warning');
      }

      if (remaining <= 0) endRound();
    }, 250);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const endRound = () => {
    if (roundOver || submitting) return;
    setPhase('over');
    setRoundOver(true);
    setSubmitting(true);
    gameAudio.playGameOver();
    void submitResult();
  };

  const tapNode = (nodeId: number) => {
    const s = stateRef.current;
    const now = Date.now();
    const node = s.nodes.find((n) => n.id === nodeId);
    if (!node || phase !== 'playing') return;

    s.nodes = s.nodes.filter((n) => n.id !== nodeId);
    setNodes([...s.nodes]);

    const latency = now - node.bornAt;
    reactionTimes.current.push(latency);
    telemetry.current.push({ action: 'tap', t: now - sessionStartMs.current });

    const fastWindow = node.duration * 0.55;
    const isFast = latency <= fastWindow;
    const multiplier = Math.min(MAX_COMBO_BONUS, 1 + s.combo * 0.12);

    let earnedPoints = Math.round(BASE_POINTS * multiplier);
    if (node.type === 'critical') earnedPoints = Math.round(earnedPoints * 1.8);
    if (node.type === 'coolant') earnedPoints = Math.round(earnedPoints * 1.3);

    s.combo = isFast || node.type === 'critical' ? s.combo + 1 : 1;
    s.bestCombo = Math.max(s.bestCombo, s.combo);
    s.hits += 1;
    s.score += earnedPoints;

    if (s.combo === 5) {
      gameAudio.playFireMode();
    } else if (isFast || node.type === 'critical') {
      gameAudio.playScore(s.combo);
    } else {
      gameAudio.playWhoosh();
      gameAudio.haptic('light');
    }

    setCombo(s.combo);
    setBestCombo(s.bestCombo);
    setHits(s.hits);
    setScore(s.score);
    setFeedback({
      id: nodeId,
      kind: node.type === 'critical' ? 'critical' : isFast ? 'fast' : 'hit',
      points: earnedPoints,
    });
    window.setTimeout(() => setFeedback((f) => (f?.id === nodeId ? null : f)), 240);
  };

  const submitResult = async () => {
    const durationMs = Date.now() - sessionStartMs.current;
    const s = stateRef.current;
    const accuracy = s.hits + s.misses > 0 ? Math.round((s.hits / (s.hits + s.misses)) * 100) : 0;
    const avgReaction = reactionTimes.current.length
      ? Math.round(reactionTimes.current.reduce((a, b) => a + b, 0) / reactionTimes.current.length)
      : 0;

    try {
      const result = await gamesService.endSession(session.gameId, session.sessionId, {
        score: s.score,
        durationMs,
        telemetry: telemetry.current,
        stats: {
          combo: s.bestCombo,
          accuracy,
          reactionMs: avgReaction,
          perfect: s.hits > 0 && s.misses === 0,
        },
      });
      onComplete(result);
    } catch {
      onClose();
    }
  };

  const currentMultiplier = Math.min(MAX_COMBO_BONUS, 1 + combo * 0.12);

  return (
    <div className="fixed inset-0 z-50 bg-[#050608]/95 backdrop-blur-2xl flex flex-col items-center justify-center p-3 select-none touch-none">
      {/* Red screen alarm perimeter flash on miss */}
      {missFlash && (
        <div
          className="fixed inset-0 z-[55] pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 100px 35px rgba(255, 61, 0, 0.65)',
            animation: 'fade-out 0.25s ease-out forwards',
          }}
        />
      )}

      <div className="w-full max-w-[420px] relative flex flex-col items-center animate-fade-in">
        {/* ═══ Top Header ═══ */}
        <div className="w-full flex items-center justify-between mb-2.5 px-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#ff007f]/25 to-transparent border border-[#ff007f]/40 flex items-center justify-center shadow-lg">
              <Activity size={18} className="text-[#ff007f]" />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-wide leading-tight flex items-center gap-1.5">
                TITAN REACTOR
              </h2>
              <p className="text-[10px] text-text-tertiary">Vent Reactor Overheat · 45s Rush</p>
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

        {/* ═══ Dashboard Status Cards ═══ */}
        <div className="w-full grid grid-cols-4 gap-2 mb-2.5">
          {/* Score */}
          <div className="bg-gradient-to-br from-white/[0.04] to-transparent border border-white/10 rounded-2xl py-1.5 px-2 flex flex-col items-center shadow-md">
            <span className="text-[8px] font-extrabold uppercase tracking-wider text-text-tertiary">Score</span>
            <span className="font-mono text-base text-usdt-green font-black mt-0.5">{score} ⚡</span>
          </div>

          {/* Streak / Combo */}
          <div className="bg-gradient-to-br from-white/[0.04] to-transparent border border-white/10 rounded-2xl py-1.5 px-2 flex flex-col items-center relative overflow-hidden shadow-md">
            {combo >= 5 && <div className="absolute inset-0 bg-[#ff3d00]/15 animate-pulse pointer-events-none" />}
            <span className="text-[8px] font-extrabold uppercase tracking-wider text-text-tertiary flex items-center gap-0.5">
              Streak
              {combo >= 5 && <Flame size={10} className="text-[#ff3d00] animate-bounce" />}
            </span>
            <span className={`font-mono text-base font-black mt-0.5 transition-all ${combo >= 5 ? 'text-[#ff3d00] animate-pulse' : 'text-white'}`}>
              x{combo}
            </span>
          </div>

          {/* Multiplier */}
          <div className="bg-gradient-to-br from-white/[0.04] to-transparent border border-white/10 rounded-2xl py-1.5 px-2 flex flex-col items-center shadow-md">
            <span className="text-[8px] font-extrabold uppercase tracking-wider text-text-tertiary">Power</span>
            <span className="font-mono text-base text-gold font-black mt-0.5">×{currentMultiplier.toFixed(1)}</span>
          </div>

          {/* Time Remaining */}
          <div className={`bg-gradient-to-br from-white/[0.04] to-transparent border rounded-2xl py-1.5 px-2 flex flex-col items-center shadow-md ${
            timeLeft <= 10 ? 'border-error-red/40 bg-error-red/5' : 'border-white/10'
          }`}>
            <span className="text-[8px] font-extrabold uppercase tracking-wider text-text-tertiary">Time</span>
            <span className={`font-mono text-base font-black mt-0.5 ${timeLeft <= 10 ? 'text-error-red animate-pulse' : 'text-[#a7ffeb]'}`}>
              {timeLeft}s
            </span>
          </div>
        </div>

        {/* ═══ Core Heat / Pressure Bar ═══ */}
        {phase === 'playing' && (
          <div className="w-full bg-gradient-to-r from-white/[0.03] to-transparent border border-white/10 rounded-2xl py-1.5 px-3 mb-2.5 flex items-center gap-2.5 shadow-inner">
            <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-text-tertiary shrink-0">
              <AlertTriangle size={11} className={coreHeat > 70 ? 'text-[#ff3d00] animate-pulse' : 'text-gold'} />
              <span>Core Heat</span>
            </div>
            <div className="flex-1 h-2 rounded-full bg-black/40 border border-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${coreHeat}%`,
                  background:
                    coreHeat > 75
                      ? 'linear-gradient(90deg, #ff9100, #ff007f)'
                      : coreHeat > 40
                        ? 'linear-gradient(90deg, #ffd700, #ff9100)'
                        : 'linear-gradient(90deg, #00e676, #ffd700)',
                  boxShadow: coreHeat > 75 ? '0 0 10px rgba(255,0,127,0.7)' : '0 0 6px rgba(255,179,0,0.4)',
                }}
              />
            </div>
            <span className={`text-[10px] font-mono font-black shrink-0 ${coreHeat > 75 ? 'text-[#ff007f]' : 'text-white'}`}>
              {coreHeat}%
            </span>
          </div>
        )}

        {/* ═══ Reactor Chamber Grid ═══ */}
        <div className="relative w-full rounded-3xl overflow-hidden border border-white/15 bg-gradient-to-b from-[#131522] via-[#0d0e17] to-[#080910] shadow-[0_8px_32px_rgba(0,0,0,0.7)] p-3 mb-2.5">
          <div
            className="grid gap-2.5"
            style={{
              gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${GRID_ROWS}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: CELL_COUNT }, (_, cell) => {
              const node = nodes.find((n) => n.cell === cell);
              const progress = node ? Math.min((Date.now() - node.bornAt) / node.duration, 1) : 0;
              const danger = progress > 0.65;
              const isHit = feedback?.id === node?.id;

              return (
                <button
                  key={cell}
                  onClick={() => node && tapNode(node.id)}
                  disabled={!node || phase !== 'playing'}
                  className="relative aspect-square rounded-2xl border transition-transform active:scale-95 press-feedback overflow-hidden flex items-center justify-center"
                  style={{
                    background: node
                      ? node.type === 'critical'
                        ? 'radial-gradient(circle, rgba(255,0,127,0.45) 0%, rgba(30,10,22,0.95) 100%)'
                        : danger
                          ? 'radial-gradient(circle, rgba(255,61,0,0.4) 0%, rgba(28,12,10,0.95) 100%)'
                          : 'radial-gradient(circle, rgba(0,230,118,0.25) 0%, rgba(10,24,18,0.95) 100%)'
                      : 'rgba(255,255,255,0.02)',
                    borderColor: node
                      ? node.type === 'critical'
                        ? 'rgba(255,0,127,0.7)'
                        : danger
                          ? 'rgba(255,61,0,0.65)'
                          : 'rgba(0,230,118,0.45)'
                      : 'rgba(255,255,255,0.06)',
                    boxShadow: node
                      ? node.type === 'critical'
                        ? '0 0 20px rgba(255,0,127,0.5)'
                        : danger
                          ? '0 0 16px rgba(255,61,0,0.4)'
                          : '0 0 12px rgba(0,230,118,0.3)'
                      : 'none',
                  }}
                >
                  {node && (
                    <>
                      {/* Energy charge fill */}
                      <div
                        className="absolute bottom-0 left-0 right-0 transition-[height] duration-100"
                        style={{
                          height: `${progress * 100}%`,
                          background:
                            node.type === 'critical'
                              ? 'linear-gradient(to top, rgba(255,0,127,0.6), transparent)'
                              : danger
                                ? 'linear-gradient(to top, rgba(255,61,0,0.6), transparent)'
                                : 'linear-gradient(to top, rgba(0,230,118,0.5), transparent)',
                        }}
                      />

                      {/* Icon */}
                      <span className="relative z-10 text-xl font-black drop-shadow-md animate-pulse">
                        {node.type === 'critical' ? '💥' : node.type === 'coolant' ? '❄️' : '⚡'}
                      </span>

                      {/* Floating Feedback */}
                      <AnimatePresence>
                        {isHit && (
                          <motion.div
                            key="hit"
                            initial={{ scale: 1.5, opacity: 1 }}
                            animate={{ scale: 0.5, opacity: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.22 }}
                            className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
                          >
                            <span className="text-xs font-black text-white px-2 py-0.5 rounded-full bg-black/60 shadow-lg">
                              +{feedback?.points}
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  )}
                </button>
              );
            })}
          </div>

          {/* Ignition Countdown Overlay */}
          {phase === 'countdown' && (
            <CountdownOverlay
              label="Core Ignition"
              onDone={() => {
                playStartMs.current = Date.now();
                setPhase('playing');
              }}
            />
          )}

          {/* Round Over Overlay */}
          {roundOver && (
            <div className="absolute inset-0 z-30 bg-[#050608]/85 backdrop-blur-md flex flex-col items-center justify-center gap-3 animate-fade-in">
              <div className="w-14 h-14 rounded-2xl bg-gold/15 border border-gold/30 flex items-center justify-center shadow-lg">
                <ShieldCheck size={28} className="text-gold animate-bounce" />
              </div>
              <p className="text-lg font-black text-white uppercase tracking-widest">Core Stabilized!</p>
              <div className="flex items-center gap-2 text-xs text-[#a7ffeb]">
                <Zap size={14} className="animate-spin-slow" />
                <span>Validating energy score &amp; crediting crystals...</span>
              </div>
            </div>
          )}
        </div>

        {/* ═══ Footer Info ═══ */}
        <div className="flex items-center justify-between w-full px-3 text-[10px] text-text-tertiary">
          <span className="flex items-center gap-1">
            <Zap size={11} className="text-gold" /> Tap critical nodes (💥) for 1.8x pts
          </span>
          <span className="flex items-center gap-1">
            <Flame size={11} className="text-[#ff3d00]" /> Streak x5 = Fire Surge
          </span>
        </div>
      </div>
    </div>
  );
};
