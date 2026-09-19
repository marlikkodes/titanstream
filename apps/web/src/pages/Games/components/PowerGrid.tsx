import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, RotateCw, Volume2, VolumeX, ShieldCheck, CheckCircle2 } from 'lucide-react';
import type { GameStartSession, GameEndResult } from '../../../services/gamesService';
import { gamesService } from '../../../services/gamesService';
import { CountdownOverlay } from './CountdownOverlay';
import { gameAudio } from '../../../utils/gameAudio';

interface PowerGridProps {
  session: GameStartSession;
  onClose: () => void;
  onComplete: (result: GameEndResult) => void;
}

type Dir = 'N' | 'E' | 'S' | 'W';
type BitMask = number; // N=1, E=2, S=4, W=8

interface Tile {
  bits: BitMask;
  rot: number; // quarter turns
}

const ROWS = 4;
const COLS = 4;
const CELL_COUNT = ROWS * COLS;
const ROUND_MS = 120_000;
const MAX_MOVES_PER_LEVEL = 30;

const OPPOSITE: Record<Dir, Dir> = { N: 'S', S: 'N', E: 'W', W: 'E' };
const BIT: Record<Dir, BitMask> = { N: 1, E: 2, S: 4, W: 8 };
const DELTAS: Record<Dir, [number, number]> = { N: [-1, 0], S: [1, 0], E: [0, 1], W: [0, -1] };
const ALL_DIRS: Dir[] = ['N', 'E', 'S', 'W'];

const rotateBits = (bits: BitMask, q: number): BitMask => {
  let b = bits;
  for (let i = 0; i < ((q % 4) + 4) % 4; i++) {
    b = ((b << 1) | (b >> 3)) & 0xf;
  }
  return b;
};

interface Level {
  tiles: Tile[];
  path: { cell: number; dir: Dir }[];
  startCell: number;
}

const generateLevel = (pathLength: number): Level => {
  const startCol = Math.floor(Math.random() * COLS);
  const startCell = startCol;

  const path: { cell: number; dir: Dir }[] = [];
  const visited = new Set<number>([startCell]);
  let r = 0;
  let c = startCol;
  let lastDir: Dir = 'N';
  path.push({ cell: startCell, dir: lastDir });
  let ended = false;
  let guard = 0;

  while (!ended && guard++ < 200) {
    if (r === ROWS - 1) {
      ended = true;
      break;
    }
    const options: { dir: Dir; nr: number; nc: number }[] = [];
    for (const d of ALL_DIRS) {
      const [dr, dc] = DELTAS[d];
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
      const cell = nr * COLS + nc;
      if (visited.has(cell)) continue;
      options.push({ dir: d, nr, nc });
    }
    if (options.length === 0) break;
    const weights = options.map((o) => (o.dir === 'S' ? 0.45 : o.dir === 'N' ? 0.15 : 0.2));
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    let pick = options[0];
    for (let i = 0; i < options.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        pick = options[i];
        break;
      }
    }
    const { dir, nr, nc } = pick;
    visited.add(nr * COLS + nc);
    path.push({ cell: nr * COLS + nc, dir });
    lastDir = dir;
    r = nr;
    c = nc;
  }
  if (!ended && guard >= 200) return generateLevel(pathLength);

  const maxLen = Math.max(3, pathLength);
  const trimmed = path.slice(0, maxLen);

  const tiles: Tile[] = Array.from({ length: CELL_COUNT }, () => ({ bits: 0, rot: 0 }));
  const orientAt = (cell: number, entrance: Dir, exit: Dir | null): BitMask => {
    if (!exit) return BIT[entrance] | BIT[OPPOSITE[entrance]];
    return BIT[entrance] | BIT[exit];
  };

  for (let i = 0; i < trimmed.length; i++) {
    const entrance = trimmed[i].dir;
    const exit = i < trimmed.length - 1 ? trimmed[i + 1].dir : null;
    const correct = orientAt(trimmed[i].cell, entrance, exit);
    const scrambleRot = Math.floor(Math.random() * 3) + 1;
    tiles[trimmed[i].cell] = {
      bits: rotateBits(correct, -scrambleRot),
      rot: 0,
    };
  }

  for (let i = 0; i < CELL_COUNT; i++) {
    if (tiles[i].bits === 0) {
      const patterns = [3, 6, 9, 12, 5, 10];
      tiles[i] = {
        bits: patterns[Math.floor(Math.random() * patterns.length)],
        rot: 0,
      };
    }
  }

  return { tiles, path: trimmed, startCell };
};

export const PowerGrid: React.FC<PowerGridProps> = ({ session, onClose, onComplete }) => {
  const [levelIndex, setLevelIndex] = useState(1);
  const [score, setScore] = useState(0);
  const [movesLeft, setMovesLeft] = useState(MAX_MOVES_PER_LEVEL);
  const [totalMoves, setTotalMoves] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_MS / 1000);
  const [phase, setPhase] = useState<'countdown' | 'playing' | 'over'>('countdown');
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [startCol, setStartCol] = useState(0);
  const [endCol, setEndCol] = useState(0);
  const [poweredCells, setPoweredCells] = useState<Set<number>>(new Set());
  const [levelComplete, setLevelComplete] = useState(false);
  const [roundOver, setRoundOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [muted, setMuted] = useState(gameAudio.getMuted());

  const sessionStartMs = useRef(Date.now());
  const playStartMs = useRef(0);
  const telemetry = useRef<Array<{ action: string; t: number }>>([]);
  const totalMovesRef = useRef(0);
  const levelsSolvedRef = useRef(0);

  const handleToggleMute = () => {
    const isMute = gameAudio.toggleMute();
    setMuted(isMute);
  };

  const loadLevel = useCallback((lvl: number) => {
    const targetPathLen = 4 + Math.min(lvl, 4);
    const lvlData = generateLevel(targetPathLen);
    setTiles(lvlData.tiles);
    setStartCol(lvlData.startCell % COLS);
    const lastCell = lvlData.path[lvlData.path.length - 1].cell;
    setEndCol(lastCell % COLS);
    setMovesLeft(MAX_MOVES_PER_LEVEL);
    setLevelComplete(false);
  }, []);

  useEffect(() => {
    if (phase === 'playing' && tiles.length === 0) {
      loadLevel(1);
    }
  }, [phase, tiles.length, loadLevel]);

  // Compute energized circuit path
  useEffect(() => {
    if (tiles.length !== CELL_COUNT) return;
    const powered = new Set<number>();
    const startCell = startCol;
    const startTile = tiles[startCell];
    const effStart = rotateBits(startTile.bits, startTile.rot);

    if ((effStart & BIT.N) === 0) {
      setPoweredCells(powered);
      return;
    }

    const queue: { cell: number; fromDir: Dir }[] = [{ cell: startCell, fromDir: 'N' }];
    powered.add(startCell);

    while (queue.length > 0) {
      const { cell, fromDir } = queue.shift()!;
      const t = tiles[cell];
      const eff = rotateBits(t.bits, t.rot);
      const r = Math.floor(cell / COLS);
      const c = cell % COLS;

      for (const d of ALL_DIRS) {
        if (d === fromDir) continue;
        if ((eff & BIT[d]) === 0) continue;

        const [dr, dc] = DELTAS[d];
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;

        const nCell = nr * COLS + nc;
        const nTile = tiles[nCell];
        const nEff = rotateBits(nTile.bits, nTile.rot);
        const requiredFrom = OPPOSITE[d];

        if ((nEff & BIT[requiredFrom]) !== 0 && !powered.has(nCell)) {
          powered.add(nCell);
          queue.push({ cell: nCell, fromDir: requiredFrom });
        }
      }
    }

    setPoweredCells(powered);

    // Check win condition
    const bottomRow = Array.from({ length: COLS }, (_, c) => (ROWS - 1) * COLS + c);
    const completed = bottomRow.some((c) => {
      if (!powered.has(c)) return false;
      const t = tiles[c];
      const eff = rotateBits(t.bits, t.rot);
      return (eff & BIT.S) !== 0 && c % COLS === endCol;
    });

    if (completed && !levelComplete && phase === 'playing') {
      setLevelComplete(true);
      levelsSolvedRef.current += 1;
      const pts = 25 + movesLeft * 2;
      setScore((s) => s + pts);
      telemetry.current.push({ action: 'level_complete', t: Date.now() - sessionStartMs.current });
      gameAudio.playScore(levelIndex);
      gameAudio.haptic('success');

      window.setTimeout(() => {
        setLevelIndex((idx) => {
          const next = idx + 1;
          loadLevel(next);
          return next;
        });
      }, 1100);
    }
  }, [tiles, startCol, endCol, levelComplete, phase, levelIndex, movesLeft, loadLevel]);

  // Round countdown
  useEffect(() => {
    if (phase !== 'playing') return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((ROUND_MS - (Date.now() - playStartMs.current)) / 1000));
      setTimeLeft(remaining);
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

  const rotateTile = (idx: number) => {
    if (phase !== 'playing' || levelComplete || movesLeft <= 0) return;
    const next = [...tiles];
    next[idx] = { ...next[idx], rot: (next[idx].rot + 1) % 4 };
    setTiles(next);

    setMovesLeft((m) => {
      const nextM = m - 1;
      if (nextM <= 0) {
        window.setTimeout(() => loadLevel(levelIndex), 350);
      }
      return nextM;
    });

    totalMovesRef.current += 1;
    setTotalMoves(totalMovesRef.current);
    telemetry.current.push({ action: 'rotate', t: Date.now() - sessionStartMs.current });
    gameAudio.playWheelTick(1.3);
  };

  const submitResult = async () => {
    const durationMs = Date.now() - sessionStartMs.current;
    try {
      const result = await gamesService.endSession(session.gameId, session.sessionId, {
        score,
        durationMs,
        telemetry: telemetry.current,
        stats: {
          levelsCompleted: levelsSolvedRef.current,
          moves: totalMovesRef.current,
          accuracy: totalMovesRef.current > 0 ? Math.min(100, Math.round((levelsSolvedRef.current * 8 / totalMovesRef.current) * 100)) : 0,
        },
      });
      onComplete(result);
    } catch {
      onClose();
    }
  };

  const renderTileConductors = (bits: BitMask, isPowered: boolean) => {
    const strokeColor = isPowered ? '#00e676' : 'rgba(255, 255, 255, 0.25)';
    const glowShadow = isPowered ? 'drop-shadow(0 0 6px #00e676)' : 'none';

    return (
      <svg className="w-full h-full p-2" viewBox="0 0 100 100" style={{ filter: glowShadow }}>
        {/* Center Node */}
        <circle cx="50" cy="50" r="8" fill={strokeColor} />

        {/* N Conductor */}
        {(bits & BIT.N) !== 0 && (
          <line x1="50" y1="50" x2="50" y2="0" stroke={strokeColor} strokeWidth="10" strokeLinecap="round" />
        )}
        {/* S Conductor */}
        {(bits & BIT.S) !== 0 && (
          <line x1="50" y1="50" x2="50" y2="100" stroke={strokeColor} strokeWidth="10" strokeLinecap="round" />
        )}
        {/* E Conductor */}
        {(bits & BIT.E) !== 0 && (
          <line x1="50" y1="50" x2="100" y2="50" stroke={strokeColor} strokeWidth="10" strokeLinecap="round" />
        )}
        {/* W Conductor */}
        {(bits & BIT.W) !== 0 && (
          <line x1="50" y1="50" x2="0" y2="50" stroke={strokeColor} strokeWidth="10" strokeLinecap="round" />
        )}
      </svg>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#050608]/95 backdrop-blur-2xl flex flex-col items-center justify-center p-3 select-none touch-none">
      <div className="w-full max-w-[420px] relative flex flex-col items-center animate-fade-in">
        {/* ═══ Top Header ═══ */}
        <div className="w-full flex items-center justify-between mb-2.5 px-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#ffb300]/25 to-transparent border border-[#ffb300]/40 flex items-center justify-center shadow-lg">
              <Zap size={18} className="text-[#ffb300]" />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-wide leading-tight flex items-center gap-1.5">
                CYBER GRID
              </h2>
              <p className="text-[10px] text-text-tertiary">Route Power to Generator · 120s Run</p>
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
          {/* Level */}
          <div className="bg-gradient-to-br from-white/[0.04] to-transparent border border-white/10 rounded-2xl py-1.5 px-2 flex flex-col items-center shadow-md">
            <span className="text-[8px] font-extrabold uppercase tracking-wider text-text-tertiary">Stage</span>
            <span className="font-mono text-base text-gold font-black mt-0.5">#{levelIndex}</span>
          </div>

          {/* Score */}
          <div className="bg-gradient-to-br from-white/[0.04] to-transparent border border-white/10 rounded-2xl py-1.5 px-2 flex flex-col items-center shadow-md">
            <span className="text-[8px] font-extrabold uppercase tracking-wider text-text-tertiary">Score</span>
            <span className="font-mono text-base text-usdt-green font-black mt-0.5">{score} ⚡</span>
          </div>

          {/* Moves Left */}
          <div className="bg-gradient-to-br from-white/[0.04] to-transparent border border-white/10 rounded-2xl py-1.5 px-2 flex flex-col items-center shadow-md">
            <span className="text-[8px] font-extrabold uppercase tracking-wider text-text-tertiary">Moves</span>
            <span className={`font-mono text-base font-black mt-0.5 ${movesLeft <= 5 ? 'text-[#ff3d00]' : 'text-white'}`}>
              {movesLeft}
            </span>
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

        {/* ═══ Circuit Chamber Grid ═══ */}
        <div className="relative w-full rounded-3xl overflow-hidden border border-white/15 bg-gradient-to-b from-[#111422] via-[#0c0e18] to-[#07080f] shadow-[0_8px_32px_rgba(0,0,0,0.7)] p-3 mb-2.5">
          {/* Top Source Power Line */}
          <div className="w-full flex justify-around mb-2">
            {Array.from({ length: COLS }, (_, c) => (
              <div
                key={c}
                className={`w-6 h-3 rounded-full transition-all duration-300 ${
                  c === startCol ? 'bg-[#00e676] shadow-[0_0_12px_#00e676]' : 'bg-white/10'
                }`}
              />
            ))}
          </div>

          {/* Circuit Tiles 4x4 Grid */}
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`,
            }}
          >
            {tiles.map((t, idx) => {
              const isPowered = poweredCells.has(idx);
              const effBits = rotateBits(t.bits, t.rot);

              return (
                <button
                  key={idx}
                  onClick={() => rotateTile(idx)}
                  disabled={phase !== 'playing' || levelComplete}
                  className="relative aspect-square rounded-2xl border transition-all duration-200 press-feedback overflow-hidden flex items-center justify-center"
                  style={{
                    background: isPowered
                      ? 'radial-gradient(circle, rgba(0,230,118,0.2) 0%, rgba(8,24,16,0.95) 100%)'
                      : 'rgba(255,255,255,0.025)',
                    borderColor: isPowered ? 'rgba(0,230,118,0.5)' : 'rgba(255,255,255,0.08)',
                    boxShadow: isPowered ? '0 0 16px rgba(0,230,118,0.35)' : 'none',
                  }}
                >
                  <motion.div
                    animate={{ rotate: t.rot * 90 }}
                    transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                    className="w-full h-full flex items-center justify-center pointer-events-none"
                  >
                    {renderTileConductors(t.bits, isPowered)}
                  </motion.div>
                </button>
              );
            })}
          </div>

          {/* Bottom Destination Terminal Target */}
          <div className="w-full flex justify-around mt-2">
            {Array.from({ length: COLS }, (_, c) => (
              <div
                key={c}
                className={`w-6 h-3 rounded-full transition-all duration-300 ${
                  c === endCol
                    ? levelComplete
                      ? 'bg-[#00e676] shadow-[0_0_16px_#00e676] animate-pulse'
                      : 'bg-gold shadow-[0_0_10px_#ffb300]'
                    : 'bg-white/10'
                }`}
              />
            ))}
          </div>

          {/* Level Complete Flash Banner */}
          {levelComplete && (
            <div className="absolute inset-0 z-20 bg-[#00e676]/20 backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in">
              <CheckCircle2 size={36} className="text-[#00e676] animate-bounce mb-1" />
              <p className="text-sm font-black text-white uppercase tracking-wider">CIRCUIT CONNECTED!</p>
              <p className="text-xs text-gold font-bold">+25 PTS + BONUS</p>
            </div>
          )}

          {/* Ignition Countdown Overlay */}
          {phase === 'countdown' && (
            <CountdownOverlay
              label="Grid Startup"
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
              <p className="text-lg font-black text-white uppercase tracking-widest">Grid Run Complete!</p>
              <div className="flex items-center gap-2 text-xs text-[#a7ffeb]">
                <Zap size={14} className="animate-spin-slow" />
                <span>Validating solver score &amp; crediting crystals...</span>
              </div>
            </div>
          )}
        </div>

        {/* ═══ Footer Info ═══ */}
        <div className="flex items-center justify-between w-full px-3 text-[10px] text-text-tertiary">
          <span className="flex items-center gap-1">
            <Zap size={11} className="text-gold" /> Tap tiles to rotate circuit paths
          </span>
          <span className="flex items-center gap-1">
            <RotateCw size={11} className="text-[#a7ffeb]" /> Connect Top to Bottom Target
          </span>
        </div>
      </div>
    </div>
  );
};
