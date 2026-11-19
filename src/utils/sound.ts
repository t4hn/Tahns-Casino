/**
 * Lightweight Web Audio API synthesizer for casino sounds.
 * Guarantees zero latency, zero audio file dependencies, and zero network requests.
 */

export const WIN_SOUND_THRESHOLDS = {
  PUSH: 1,
  SMALL_WIN_MAX: 3,
  BIG_WIN_MAX: 15,
  BIG_WIN_COIN_COUNT: 6,
  JACKPOT_COIN_COUNT: 12,
} as const;

interface ToneOptions {
  type: OscillatorType;
  freq: number;
  endFreq?: number;
  startTime: number;
  duration: number;
  peakGain: number;
  attack?: number;
}

interface NoiseOptions {
  startTime: number;
  duration: number;
  peakGain: number;
  filterFreq: number;
  filterQ?: number;
}

const MAX_SIMULTANEOUS_VOICES = 18;
const MASTER_VOLUME = 0.35;

class SoundService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled: boolean = true;
  private activeVoices: number = 0;

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        try {
          this.ctx = new AudioCtx();
          if (typeof this.ctx.createGain === 'function') {
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = MASTER_VOLUME;
            this.masterGain.connect(this.ctx.destination);
          }
        } catch {
          this.ctx = null;
          this.masterGain = null;
        }
      }
    }
    if (this.ctx && this.ctx.state === 'suspended' && typeof this.ctx.resume === 'function') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private getOutputNode(): AudioNode | null {
    if (!this.ctx) return null;
    return this.masterGain ?? this.ctx.destination ?? null;
  }

  private scheduleTone({
    type,
    freq,
    endFreq,
    startTime,
    duration,
    peakGain,
    attack = 0.008,
  }: ToneOptions) {
    if (!this.ctx || this.activeVoices >= MAX_SIMULTANEOUS_VOICES) return;
    const output = this.getOutputNode();
    if (!output) return;

    this.activeVoices += 1;
    let cleaned = false;
    let osc: OscillatorNode | null = null;
    let gain: GainNode | null = null;

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      this.activeVoices = Math.max(0, this.activeVoices - 1);
      try {
        osc?.disconnect();
        gain?.disconnect();
      } catch {
        // Ignore already disconnected nodes
      }
    };

    try {
      osc = this.ctx.createOscillator();
      gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, freq), startTime);
      if (endFreq && endFreq !== freq) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(20, endFreq),
          startTime + duration
        );
      }

      const safeAttack = Math.min(attack, duration * 0.35);
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(peakGain, startTime + safeAttack);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(output);

      osc.onended = cleanup;
      osc.start(startTime);
      osc.stop(startTime + duration + 0.015);
    } catch {
      cleanup();
    }
  }

  private scheduleNoiseBurst({
    startTime,
    duration,
    peakGain,
    filterFreq,
    filterQ = 1.8,
  }: NoiseOptions) {
    if (!this.ctx || this.activeVoices >= MAX_SIMULTANEOUS_VOICES) return;
    const output = this.getOutputNode();
    if (!output) return;

    // Fallback for minimal test mocks lacking AudioBuffer APIs
    if (
      typeof this.ctx.createBuffer !== 'function' ||
      typeof this.ctx.createBufferSource !== 'function'
    ) {
      this.scheduleTone({
        type: 'triangle',
        freq: filterFreq * 0.65,
        endFreq: filterFreq * 0.3,
        startTime,
        duration,
        peakGain: peakGain * 0.6,
        attack: 0.003,
      });
      return;
    }

    this.activeVoices += 1;
    let cleaned = false;
    let source: AudioBufferSourceNode | null = null;
    let filter: BiquadFilterNode | null = null;
    let gain: GainNode | null = null;

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      this.activeVoices = Math.max(0, this.activeVoices - 1);
      try {
        source?.disconnect();
        filter?.disconnect();
        gain?.disconnect();
      } catch {
        // Ignore already disconnected nodes
      }
    };

    try {
      const sampleRate = this.ctx.sampleRate || 44100;
      const frameCount = Math.max(1, Math.floor(sampleRate * duration));
      const buffer = this.ctx.createBuffer(1, frameCount, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frameCount; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / frameCount);
      }

      source = this.ctx.createBufferSource();
      source.buffer = buffer;

      gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(peakGain, startTime + Math.min(0.004, duration * 0.25));
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      if (typeof this.ctx.createBiquadFilter === 'function') {
        filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(filterFreq, startTime);
        filter.Q.setValueAtTime(filterQ, startTime);
        source.connect(filter);
        filter.connect(gain);
      } else {
        source.connect(gain);
      }

      gain.connect(output);
      source.onended = cleanup;
      source.start(startTime);
      source.stop(startTime + duration + 0.01);
    } catch {
      cleanup();
    }
  }

  public playClick() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    this.scheduleTone({
      type: 'sine',
      freq: 420,
      endFreq: 180,
      startTime: this.ctx.currentTime,
      duration: 0.05,
      peakGain: 0.16,
      attack: 0.004,
    });
  }

  public playCoin() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    [987.77, 1318.51].forEach((freq, idx) => {
      this.scheduleTone({
        type: 'sine',
        freq,
        startTime: now + idx * 0.07,
        duration: 0.22,
        peakGain: 0.24,
      });
    });
  }

  public playBonusClaim() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 987.77, 1046.5];
    notes.forEach((freq, idx) => {
      this.scheduleTone({
        type: 'triangle',
        freq,
        startTime: now + idx * 0.08,
        duration: 0.35,
        peakGain: 0.26,
      });
    });
  }

  public playLevelUp() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      this.scheduleTone({
        type: 'sine',
        freq,
        startTime: now + idx * 0.09,
        duration: 0.4,
        peakGain: 0.28,
      });
    });
  }

  public playLocked() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    this.scheduleTone({
      type: 'sawtooth',
      freq: 140,
      endFreq: 110,
      startTime: now,
      duration: 0.14,
      peakGain: 0.12,
    });
  }

  /**
   * Short, cheerful 3-note rising arpeggio (~0.35s).
   */
  public playSmallWin() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // C5 -> E5 -> G5
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.075;
      this.scheduleTone({
        type: 'triangle',
        freq,
        startTime: start,
        duration: idx === notes.length - 1 ? 0.2 : 0.14,
        peakGain: 0.26,
      });
    });
  }

  /**
   * Brighter 6-note fanfare with octave shimmer and soft coin-cascade tail (~1.2s).
   */
  public playBigWin() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const fanfare = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98]; // C5..G6
    fanfare.forEach((freq, idx) => {
      const start = now + idx * 0.085;
      const dur = idx === fanfare.length - 1 ? 0.48 : 0.24;
      this.scheduleTone({
        type: 'triangle',
        freq,
        startTime: start,
        duration: dur,
        peakGain: 0.24,
      });
      if (idx >= 3) {
        this.scheduleTone({
          type: 'sine',
          freq: freq * 1.5,
          startTime: start + 0.02,
          duration: dur * 0.85,
          peakGain: 0.09,
        });
      }
    });

    // Soft coin-cascade tail finishing cleanly around 1.2s
    [1318.51, 1567.98, 1760.0, 2093.0].forEach((freq, idx) => {
      this.scheduleTone({
        type: 'sine',
        freq,
        startTime: now + 0.62 + idx * 0.09,
        duration: 0.22,
        peakGain: 0.12,
        attack: 0.004,
      });
    });
  }

  /**
   * Triumphant multi-layer fanfare with rising sweep & sparkling arpeggios (~2.5s).
   */
  public playJackpot() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // Layer 1: Warm rising brass/pad sweep + sustained resolve chord
    this.scheduleTone({
      type: 'triangle',
      freq: 130.81,
      endFreq: 261.63,
      startTime: now,
      duration: 0.9,
      peakGain: 0.18,
      attack: 0.05,
    });
    this.scheduleTone({
      type: 'sine',
      freq: 261.63,
      startTime: now + 0.85,
      duration: 1.55,
      peakGain: 0.16,
      attack: 0.04,
    });
    this.scheduleTone({
      type: 'sine',
      freq: 392.0,
      startTime: now + 0.95,
      duration: 1.45,
      peakGain: 0.12,
      attack: 0.04,
    });

    // Layer 2: Sparkling rising arpeggios
    const sparkle = [523.25, 659.25, 783.99, 987.77, 1046.5, 1318.51, 1567.98, 2093.0];
    sparkle.forEach((freq, idx) => {
      this.scheduleTone({
        type: 'triangle',
        freq,
        startTime: now + 0.14 + idx * 0.12,
        duration: 0.42,
        peakGain: 0.2,
      });
    });

    // Layer 3: High finale shimmer chord
    [1046.5, 1318.51, 1567.98, 2093.0].forEach((freq, idx) => {
      this.scheduleTone({
        type: 'sine',
        freq,
        startTime: now + 1.35 + idx * 0.04,
        duration: 1.05,
        peakGain: 0.14,
        attack: 0.02,
      });
    });
  }

  /**
   * Rapid sequence of coin pings with slightly varied pitch, scaled 3..12.
   */
  public playCoinCascade(count: number) {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const clampedCount = Math.max(3, Math.min(12, Math.round(count)));
    const now = this.ctx.currentTime;
    const baseNotes = [1174.66, 1318.51, 1396.91, 1567.98, 1760.0];

    for (let i = 0; i < clampedCount; i++) {
      const base = baseNotes[i % baseNotes.length];
      const pitch = base + (i % 3) * 24;
      this.scheduleTone({
        type: 'sine',
        freq: pitch,
        startTime: now + i * 0.055,
        duration: 0.16,
        peakGain: 0.14,
        attack: 0.003,
      });
    }
  }

  /**
   * Soft short filtered noise flick for dealing cards.
   */
  public playCardDeal() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    this.scheduleNoiseBurst({
      startTime: this.ctx.currentTime,
      duration: 0.042,
      peakGain: 0.24,
      filterFreq: 2100,
      filterQ: 1.4,
    });
  }

  /**
   * Woody casino chip clack when placing a chip or wager.
   */
  public playChipPlace() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    this.scheduleTone({
      type: 'triangle',
      freq: 820,
      endFreq: 320,
      startTime: now,
      duration: 0.045,
      peakGain: 0.2,
      attack: 0.002,
    });
    this.scheduleTone({
      type: 'sine',
      freq: 1950,
      endFreq: 1100,
      startTime: now,
      duration: 0.02,
      peakGain: 0.1,
      attack: 0.001,
    });
  }

  /**
   * Soft mechanical thunk for slot reel stopping, rising slightly on later reels.
   */
  public playReelStop(reelIndex: number = 0) {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const step = Math.max(0, Math.min(8, reelIndex));
    const startFreq = 135 + step * 18;
    const endFreq = 68 + step * 8;
    this.scheduleTone({
      type: 'triangle',
      freq: startFreq,
      endFreq,
      startTime: this.ctx.currentTime,
      duration: 0.075,
      peakGain: 0.22,
      attack: 0.003,
    });
  }

  /**
   * Very quiet percussive tick for roulette wheel and keno ball draws.
   */
  public playTick() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    this.scheduleTone({
      type: 'sine',
      freq: 1180,
      endFreq: 680,
      startTime: this.ctx.currentTime,
      duration: 0.024,
      peakGain: 0.08,
      attack: 0.002,
    });
  }

  /**
   * Small rising crystalline blip for matched Keno numbers.
   */
  public playKenoHit(hitCount: number = 1) {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const step = Math.max(0, Math.min(9, hitCount - 1));
    const freq = 587.33 * Math.pow(2, step / 12);
    this.scheduleTone({
      type: 'sine',
      freq,
      startTime: this.ctx.currentTime,
      duration: 0.12,
      peakGain: 0.18,
      attack: 0.004,
    });
  }

  /**
   * Neutral, friendly two-note chime for a push or returned stake.
   */
  public playPush() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    [392.0, 587.33].forEach((freq, idx) => {
      this.scheduleTone({
        type: 'sine',
        freq,
        startTime: now + idx * 0.08,
        duration: 0.18,
        peakGain: 0.16,
      });
    });
  }

  /**
   * Very gentle, short, low "soft landing" sound for losses (much quieter than wins).
   */
  public playLoss() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    this.scheduleTone({
      type: 'sine',
      freq: 210,
      endFreq: 140,
      startTime: this.ctx.currentTime,
      duration: 0.15,
      peakGain: 0.08,
      attack: 0.01,
    });
  }
}

export const soundManager = new SoundService();

/**
 * Selects and triggers the appropriate win/push/loss audio cue based on
 * total return multiplier (payout / bet).
 */
export function playWinSound(multiplier: number, bet: number): void {
  if (!Number.isFinite(multiplier) || !Number.isFinite(bet) || bet <= 0) {
    return;
  }

  if (multiplier < WIN_SOUND_THRESHOLDS.PUSH) {
    soundManager.playLoss();
    return;
  }

  if (multiplier === WIN_SOUND_THRESHOLDS.PUSH) {
    soundManager.playPush();
    return;
  }

  if (multiplier <= WIN_SOUND_THRESHOLDS.SMALL_WIN_MAX) {
    soundManager.playSmallWin();
    return;
  }

  if (multiplier <= WIN_SOUND_THRESHOLDS.BIG_WIN_MAX) {
    soundManager.playBigWin();
    soundManager.playCoinCascade(WIN_SOUND_THRESHOLDS.BIG_WIN_COIN_COUNT);
    return;
  }

  soundManager.playJackpot();
  soundManager.playCoinCascade(WIN_SOUND_THRESHOLDS.JACKPOT_COIN_COUNT);
}
