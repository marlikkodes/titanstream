/**
 * TitanStream Game Audio & Haptics Engine.
 *
 * Uses the Web Audio API to synthesize punchy arcade sound effects with
 * zero external audio file dependencies, zero network requests, and zero latency.
 * Integrates directly with Telegram WebApp HapticFeedback API.
 */

class GameAudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // Check localStorage for persisted mute preference
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('titan_game_sound_muted');
        if (saved !== null) {
          this.isMuted = saved === 'true';
        }
      } catch {}
    }
  }

  private getContext(): AudioContext | null {
    if (this.isMuted) return null;
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    return this.ctx;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    try {
      localStorage.setItem('titan_game_sound_muted', String(this.isMuted));
    } catch {}
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Telegram WebApp Haptic feedback wrapper
   */
  public haptic(type: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' | 'success' | 'warning' | 'error') {
    try {
      const tg = window.Telegram?.WebApp;
      if (!tg) return;
      if (typeof tg.isVersionAtLeast === 'function' && !tg.isVersionAtLeast('6.1')) {
        return;
      }
      const haptic = tg.HapticFeedback;
      if (!haptic) return;

      if (type === 'success' || type === 'warning' || type === 'error') {
        haptic.notificationOccurred?.(type);
      } else {
        haptic.impactOccurred?.(type);
      }
    } catch {}
  }

  /**
   * Sound: Ball launch / whoosh
   */
  public playWhoosh() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    } catch {}
  }

  /**
   * Sound: Rim collision (metallic ping / clank)
   */
  public playRimHit() {
    this.haptic('medium');
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(680, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.13);
    } catch {}
  }

  /**
   * Sound: Backboard bounce (solid thud)
   */
  public playBackboardHit() {
    this.haptic('light');
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.13);
    } catch {}
  }

  /**
   * Sound: Net Swish (crisp, satisfying high-frequency sweep)
   */
  public playSwish() {
    this.haptic('success');
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const bufferSize = Math.floor(ctx.sampleRate * 0.18);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1800, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.18);
      filter.Q.value = 3.5;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start();
      noise.stop(ctx.currentTime + 0.19);
    } catch {}
  }

  /**
   * Sound: Standard Basket Make (warm chime)
   */
  public playScore(combo = 1) {
    this.haptic('success');
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const baseFreq = 440 + Math.min(combo * 40, 300);
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, ctx.currentTime + 0.15);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(baseFreq * 2, ctx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(baseFreq * 2.5, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);

      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc2.start();
      osc.stop(ctx.currentTime + 0.23);
      osc2.stop(ctx.currentTime + 0.23);
    } catch {}
  }

  /**
   * Sound: Fire mode activation (whoosh + high chord)
   */
  public playFireMode() {
    this.haptic('warning');
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.05);

        gain.gain.setValueAtTime(0.2, ctx.currentTime + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + idx * 0.05 + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + idx * 0.05);
        osc.stop(ctx.currentTime + idx * 0.05 + 0.26);
      });
    } catch {}
  }

  /**
   * Sound: Game Over
   */
  public playGameOver() {
    this.haptic('warning');
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      [440, 392, 349.23, 261.63].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);

        gain.gain.setValueAtTime(0.25, ctx.currentTime + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + idx * 0.1 + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + idx * 0.1);
        osc.stop(ctx.currentTime + idx * 0.1 + 0.26);
      });
    } catch {}
  }

  /**
   * Sound: Roulette Wheel Ticker Click (crisp wood/metal mechanical ratchet)
   */
  public playWheelTick(pitch = 1) {
    this.haptic('light');
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      const baseFreq = 820 * Math.max(0.6, Math.min(1.8, pitch));
      osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + 0.025);

      gain.gain.setValueAtTime(0.28, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.03);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.035);
    } catch {}
  }

  /**
   * Sound: Jackpot / Big Win Fanfare
   */
  public playJackpotFanfare() {
    this.haptic('success');
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      // Arpeggiated triumph fanfare: C5, E5, G5, C6
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc2.type = 'triangle';

        const startTime = ctx.currentTime + idx * 0.08;
        osc.frequency.setValueAtTime(freq, startTime);
        osc2.frequency.setValueAtTime(freq * 1.5, startTime);

        gain.gain.setValueAtTime(0.3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);

        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc2.start(startTime);
        osc.stop(startTime + 0.42);
        osc2.stop(startTime + 0.42);
      });
    } catch {}
  }
}

export const gameAudio = new GameAudioEngine();

