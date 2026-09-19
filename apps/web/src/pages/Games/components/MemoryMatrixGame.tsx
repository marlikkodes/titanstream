import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Brain, Volume2, VolumeX, ShieldCheck, CheckCircle2 } from 'lucide-react';
import type { GameStartSession, GameEndResult } from '../../../services/gamesService';
import { gamesService } from '../../../services/gamesService';
import { gameAudio } from '../../../utils/gameAudio';

interface MemoryMatrixGameProps {
  session: GameStartSession;
  onClose: () => void;
  onComplete: (result: GameEndResult) => void;
}

const MAX_LEVEL = 12;
const SHOW_MS = 420;
const TAP_TIMEOUT_MS = 6000;

type Phase = 'idle' | 'showing' | 'input' | 'feedback' | 'over';

// Pentatonic musical scale for the 9 matrix cells
const CELL_NOTES = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99];

export const MemoryMatrixGame: React.FC<MemoryMatrixGameProps> = ({ session, onClose, onComplete }) => {
  const [sequence, setSequence] = useState<number[]>([]);
  const [inputIndex, setInputIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [litCell, setLitCell] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [shakeCell, setShakeCell] = useState<number | null>(null);
  const [tapTimeRemaining, setTapTimeRemaining] = useState(100);
  const [muted, setMuted] = useState(gameAudio.getMuted());

  const sessionStartMs = useRef(Date.now());
  const telemetry = useRef<Array<{ action: string; t: number }>>([]);
  const inputTimeout = useRef<number | null>(null);
  const tapTimerInterval = useRef<number | null>(null);
  const tapTimerStart = useRef(0);
  const tapsRef = useRef(0);
  const correctTapsRef = useRef(0);

  const handleToggleMute = () => {
    const isMute = gameAudio.toggleMute();
    setMuted(isMute);
  };

  const playCellTone = (cell: number) => {
    const freq = CELL_NOTES[cell % CELL_NOTES.length];
    gameAudio.playWheelTick(freq / 500);
    gameAudio.haptic('light');
  };

  const startRound = () => {
    setPhase('showing');
    setInputIndex(0);
    setShakeCell(null);
    setTapTimeRemaining(100);

    const nextSequence = Array.from({ length: Math.min(level + 2, MAX_LEVEL) }, () => Math.floor(Math.random() * 9));
    setSequence(nextSequence);

    telemetry.current.push({ action: 'round_start', t: Date.now() - sessionStartMs.current });

    let idx = 0;
    const showTimer = setInterval(() => {
      if (idx < nextSequence.length) {
        const cell = nextSequence[idx];
        setLitCell(cell);
        playCellTone(cell);
        idx += 1;
      } else {
        clearInterval(showTimer);
        setLitCell(null);
        setPhase('input');
        armTapTimeout();
      }
    }, SHOW_MS);
  };

  useEffect(() => {
    startRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const armTapTimeout = () => {
    if (inputTimeout.current) clearTimeout(inputTimeout.current);
    if (tapTimerInterval.current) clearInterval(tapTimerInterval.current);

    tapTimerStart.current = Date.now();
    setTapTimeRemaining(100);

    tapTimerInterval.current = window.setInterval(() => {
      const elapsed = Date.now() - tapTimerStart.current;
      const remaining = Math.max(0, 100 - (elapsed / TAP_TIMEOUT_MS) * 100);
      setTapTimeRemaining(remaining);
      if (remaining <= 0 && tapTimerInterval.current) {
        clearInterval(tapTimerInterval.current);
      }
    }, 50);

    inputTimeout.current = window.setTimeout(() => {
      if (tapTimerInterval.current) clearInterval(tapTimerInterval.current);
      endGame(false);
    }, TAP_TIMEOUT_MS);
  };

  const handleCellTap = (cell: number) => {
    if (phase !== 'input') return;
    if (inputTimeout.current) clearTimeout(inputTimeout.current);
    if (tapTimerInterval.current) clearInterval(tapTimerInterval.current);

    telemetry.current.push({ action: 'tap', t: Date.now() - sessionStartMs.current });
    tapsRef.current += 1;
    playCellTone(cell);

    if (cell === sequence[inputIndex]) {
      correctTapsRef.current += 1;
      const nextIndex = inputIndex + 1;
      if (nextIndex >= sequence.length) {
        // Level cleared
        const nextScore = score + 1;
        setScore(nextScore);
        setLevel((l) => l + 1);
        setPhase('feedback');
        telemetry.current.push({ action: 'level_clear', t: Date.now() - sessionStartMs.current });
        gameAudio.playScore(nextScore);
        gameAudio.haptic('success');

        window.setTimeout(() => {
          if (nextScore >= MAX_LEVEL) {
            endGame(true);
          } else {
            startRound();
          }
        }, 750);
      } else {
        setInputIndex(nextIndex);
        armTapTimeout();
      }
    } else {
      // Wrong sequence — shake and end
      setShakeCell(cell);
      gameAudio.playGameOver();
      gameAudio.haptic('error');
      setTimeout(() => setShakeCell(null), 400);
      endGame(false);
    }
  };

  const endGame = (cleared: boolean) => {
    if (submitting) return;
    setPhase('over');
    setSubmitting(true);
    if (tapTimerInterval.current) clearInterval(tapTimerInterval.current);
    telemetry.current.push({ action: 'round_end', t: Date.now() - sessionStartMs.current });
    void submitResult(cleared);
  };

  const submitResult = async (cleared: boolean) => {
    const durationMs = Date.now() - sessionStartMs.current;
    const taps = tapsRef.current;
    try {
      const result = await gamesService.endSession(session.gameId, session.sessionId, {
        score,
        durationMs,
        telemetry: telemetry.current,
        stats: {
          levelsCompleted: score,
          moves: taps,
          accuracy: taps > 0 ? Math.round((correctTapsRef.current / taps) * 100) : 0,
          perfect: cleared && taps === correctTapsRef.current,
        },
      });
      onComplete(result);
    } catch {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#050608]/95 backdrop-blur-2xl flex flex-col items-center justify-center p-3 select-none touch-none">
      <div className="w-full max-w-[420px] relative flex flex-col items-center animate-fade-in">
        {/* ═══ Top Header ═══ */}
        <div className="w-full flex items-center justify-between mb-2.5 px-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00e5ff]/25 to-transparent border border-[#00e5ff]/40 flex items-center justify-center shadow-lg">
              <Brain size={18} className="text-[#00e5ff]" />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-wide leading-tight flex items-center gap-1.5">
                CYBER MATRIX
              </h2>
              <p className="text-[10px] text-text-tertiary">Memorize &amp; Decrypt Sequence</p>
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
        <div className="w-full grid grid-cols-3 gap-2 mb-2.5">
          <div className="bg-gradient-to-br from-white/[0.04] to-transparent border border-white/10 rounded-2xl py-1.5 px-2 flex flex-col items-center shadow-md">
            <span className="text-[8px] font-extrabold uppercase tracking-wider text-text-tertiary">Level</span>
            <span className="font-mono text-base text-gold font-black mt-0.5">#{level}</span>
          </div>
          <div className="bg-gradient-to-br from-white/[0.04] to-transparent border border-white/10 rounded-2xl py-1.5 px-2 flex flex-col items-center shadow-md">
            <span className="text-[8px] font-extrabold uppercase tracking-wider text-text-tertiary">Decrypted</span>
            <span className="font-mono text-base text-usdt-green font-black mt-0.5">{score} 🧠</span>
          </div>
          <div className="bg-gradient-to-br from-white/[0.04] to-transparent border border-white/10 rounded-2xl py-1.5 px-2 flex flex-col items-center shadow-md">
            <span className="text-[8px] font-extrabold uppercase tracking-wider text-text-tertiary">Status</span>
            <span className="font-mono text-xs font-black mt-1 text-[#00e5ff] uppercase">
              {phase === 'showing' ? 'MEMORIZE' : phase === 'input' ? 'REPEAT' : 'SYNCING'}
            </span>
          </div>
        </div>

        {/* ═══ Response Countdown Bar ═══ */}
        {phase === 'input' && (
          <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden mb-3">
            <div
              className="h-full rounded-full transition-all duration-75"
              style={{
                width: `${tapTimeRemaining}%`,
                background: tapTimeRemaining < 30 ? '#ff3d00' : '#00e5ff',
                boxShadow: `0 0 8px ${tapTimeRemaining < 30 ? '#ff3d00' : '#00e5ff'}`,
              }}
            />
          </div>
        )}

        {/* ═══ The Matrix 3x3 Grid ═══ */}
        <div className="relative w-full aspect-square max-w-[340px] rounded-3xl overflow-hidden border border-white/15 bg-gradient-to-b from-[#111422] via-[#0c0e18] to-[#07080f] shadow-[0_8px_32px_rgba(0,0,0,0.7)] p-3 mb-2.5 flex items-center justify-center">
          <div className="grid grid-cols-3 gap-3 w-full h-full">
            {Array.from({ length: 9 }, (_, cell) => {
              const isLit = litCell === cell;
              const isShaking = shakeCell === cell;

              return (
                <button
                  key={cell}
                  onClick={() => handleCellTap(cell)}
                  disabled={phase !== 'input'}
                  className={`relative rounded-2xl border transition-all duration-150 press-feedback flex items-center justify-center ${
                    isShaking ? 'animate-shake border-error-red bg-error-red/20' : ''
                  }`}
                  style={{
                    background: isLit
                      ? 'radial-gradient(circle, rgba(0, 229, 255, 0.7) 0%, rgba(0, 150, 255, 0.95) 100%)'
                      : 'rgba(255, 255, 255, 0.03)',
                    borderColor: isLit ? '#00e5ff' : 'rgba(255, 255, 255, 0.08)',
                    boxShadow: isLit ? '0 0 24px rgba(0, 229, 255, 0.8), inset 0 0 12px #ffffff' : 'none',
                  }}
                >
                  <span className={`text-xl font-mono font-black ${isLit ? 'text-white' : 'text-white/20'}`}>
                    {cell + 1}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Level Complete Flash */}
          {phase === 'feedback' && (
            <div className="absolute inset-0 z-20 bg-[#00e5ff]/20 backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in">
              <CheckCircle2 size={36} className="text-[#00e5ff] animate-bounce mb-1" />
              <p className="text-sm font-black text-white uppercase tracking-wider">SEQUENCE DECRYPTED!</p>
            </div>
          )}

          {/* Round Over */}
          {phase === 'over' && (
            <div className="absolute inset-0 z-30 bg-[#050608]/85 backdrop-blur-md flex flex-col items-center justify-center gap-3 animate-fade-in">
              <div className="w-14 h-14 rounded-2xl bg-gold/15 border border-gold/30 flex items-center justify-center shadow-lg">
                <ShieldCheck size={28} className="text-gold animate-bounce" />
              </div>
              <p className="text-lg font-black text-white uppercase tracking-widest">Session Complete!</p>
              <div className="flex items-center gap-2 text-xs text-[#a7ffeb]">
                <Sparkles size={14} className="animate-spin-slow" />
                <span>Validating score &amp; crediting crystals...</span>
              </div>
            </div>
          )}
        </div>

        {/* ═══ Footer Info ═══ */}
        <div className="flex items-center justify-between w-full px-3 text-[10px] text-text-tertiary">
          <span className="flex items-center gap-1">
            <Sparkles size={11} className="text-[#00e5ff]" /> Memorize flashing sequence
          </span>
          <span className="flex items-center gap-1">
            <Brain size={11} className="text-gold" /> Repeat in correct order
          </span>
        </div>
      </div>
    </div>
  );
};
