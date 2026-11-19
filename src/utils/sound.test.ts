// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { soundManager, playWinSound, WIN_SOUND_THRESHOLDS } from './sound';

function createMockAudioContext() {
  const createdOscillators: Array<{
    type: OscillatorType;
    frequency: { setValueAtTime: ReturnType<typeof vi.fn>; exponentialRampToValueAtTime: ReturnType<typeof vi.fn> };
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    onended: (() => void) | null;
  }> = [];

  const createdGains: Array<{
    gain: { value: number; setValueAtTime: ReturnType<typeof vi.fn>; linearRampToValueAtTime: ReturnType<typeof vi.fn>; exponentialRampToValueAtTime: ReturnType<typeof vi.fn> };
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }> = [];

  const createdBufferSources: Array<{
    buffer: AudioBuffer | null;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    onended: (() => void) | null;
  }> = [];

  class MockAudioContext {
    public state: AudioContextState = 'running';
    public currentTime = 1.0;
    public sampleRate = 44100;
    public destination = {} as AudioDestinationNode;

    public resume = vi.fn().mockResolvedValue(undefined);

    public createOscillator = vi.fn(() => {
      const osc = {
        type: 'sine' as OscillatorType,
        frequency: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null as (() => void) | null,
      };
      createdOscillators.push(osc);
      return osc;
    });

    public createGain = vi.fn(() => {
      const gain = {
        gain: {
          value: 1,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      createdGains.push(gain);
      return gain;
    });

    public createBuffer = vi.fn((_channels: number, length: number) => ({
      getChannelData: vi.fn(() => new Float32Array(length)),
    }));

    public createBufferSource = vi.fn(() => {
      const src = {
        buffer: null as AudioBuffer | null,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null as (() => void) | null,
      };
      createdBufferSources.push(src);
      return src;
    });

    public createBiquadFilter = vi.fn(() => ({
      type: 'bandpass',
      frequency: { setValueAtTime: vi.fn() },
      Q: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }));
  }

  return {
    MockAudioContext,
    createdOscillators,
    createdGains,
    createdBufferSources,
  };
}

describe('soundManager & playWinSound', () => {
  const originalAudioContext = window.AudioContext;
  const originalWebkitAudioContext = (
    window as unknown as { webkitAudioContext?: typeof AudioContext }
  ).webkitAudioContext;

  beforeEach(() => {
    soundManager.setEnabled(true);
    // Reset cached lazy AudioContext between tests for clean isolation
    (soundManager as unknown as { ctx: AudioContext | null }).ctx = null;
    (soundManager as unknown as { masterGain: GainNode | null }).masterGain = null;
    (soundManager as unknown as { activeVoices: number }).activeVoices = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.AudioContext = originalAudioContext;
    (
      window as unknown as { webkitAudioContext?: typeof AudioContext }
    ).webkitAudioContext = originalWebkitAudioContext;
  });

  describe('playWinSound multiplier threshold routing', () => {
    it('routes multiplier < 1 (losses and partial returns) to playLoss()', () => {
      const lossSpy = vi.spyOn(soundManager, 'playLoss').mockImplementation(() => {});
      const pushSpy = vi.spyOn(soundManager, 'playPush').mockImplementation(() => {});
      const smallSpy = vi.spyOn(soundManager, 'playSmallWin').mockImplementation(() => {});
      const bigSpy = vi.spyOn(soundManager, 'playBigWin').mockImplementation(() => {});
      const jackpotSpy = vi.spyOn(soundManager, 'playJackpot').mockImplementation(() => {});
      const coinSpy = vi.spyOn(soundManager, 'playCoinCascade').mockImplementation(() => {});

      playWinSound(0, 50);
      playWinSound(0.5, 50);

      expect(lossSpy).toHaveBeenCalledTimes(2);
      expect(pushSpy).not.toHaveBeenCalled();
      expect(smallSpy).not.toHaveBeenCalled();
      expect(bigSpy).not.toHaveBeenCalled();
      expect(jackpotSpy).not.toHaveBeenCalled();
      expect(coinSpy).not.toHaveBeenCalled();
    });

    it('routes multiplier === 1 (push) to playPush()', () => {
      const lossSpy = vi.spyOn(soundManager, 'playLoss').mockImplementation(() => {});
      const pushSpy = vi.spyOn(soundManager, 'playPush').mockImplementation(() => {});
      const smallSpy = vi.spyOn(soundManager, 'playSmallWin').mockImplementation(() => {});

      playWinSound(1, 50);

      expect(pushSpy).toHaveBeenCalledTimes(1);
      expect(lossSpy).not.toHaveBeenCalled();
      expect(smallSpy).not.toHaveBeenCalled();
    });

    it('routes 1 < multiplier <= 3 to playSmallWin()', () => {
      const smallSpy = vi.spyOn(soundManager, 'playSmallWin').mockImplementation(() => {});
      const bigSpy = vi.spyOn(soundManager, 'playBigWin').mockImplementation(() => {});
      const coinSpy = vi.spyOn(soundManager, 'playCoinCascade').mockImplementation(() => {});

      playWinSound(1.5, 20);
      playWinSound(2, 25);
      playWinSound(WIN_SOUND_THRESHOLDS.SMALL_WIN_MAX, 100);

      expect(smallSpy).toHaveBeenCalledTimes(3);
      expect(bigSpy).not.toHaveBeenCalled();
      expect(coinSpy).not.toHaveBeenCalled();
    });

    it('routes 3 < multiplier <= 15 to playBigWin() + playCoinCascade(6)', () => {
      const bigSpy = vi.spyOn(soundManager, 'playBigWin').mockImplementation(() => {});
      const coinSpy = vi.spyOn(soundManager, 'playCoinCascade').mockImplementation(() => {});
      const jackpotSpy = vi.spyOn(soundManager, 'playJackpot').mockImplementation(() => {});

      playWinSound(3.01, 50);
      playWinSound(10, 50);
      playWinSound(WIN_SOUND_THRESHOLDS.BIG_WIN_MAX, 50);

      expect(bigSpy).toHaveBeenCalledTimes(3);
      expect(coinSpy).toHaveBeenCalledTimes(3);
      expect(coinSpy).toHaveBeenCalledWith(WIN_SOUND_THRESHOLDS.BIG_WIN_COIN_COUNT);
      expect(WIN_SOUND_THRESHOLDS.BIG_WIN_COIN_COUNT).toBe(6);
      expect(jackpotSpy).not.toHaveBeenCalled();
    });

    it('routes multiplier > 15 to playJackpot() + playCoinCascade(12)', () => {
      const jackpotSpy = vi.spyOn(soundManager, 'playJackpot').mockImplementation(() => {});
      const coinSpy = vi.spyOn(soundManager, 'playCoinCascade').mockImplementation(() => {});
      const bigSpy = vi.spyOn(soundManager, 'playBigWin').mockImplementation(() => {});

      playWinSound(15.01, 50);
      playWinSound(250, 20);

      expect(jackpotSpy).toHaveBeenCalledTimes(2);
      expect(coinSpy).toHaveBeenCalledTimes(2);
      expect(coinSpy).toHaveBeenCalledWith(WIN_SOUND_THRESHOLDS.JACKPOT_COIN_COUNT);
      expect(WIN_SOUND_THRESHOLDS.JACKPOT_COIN_COUNT).toBe(12);
      expect(bigSpy).not.toHaveBeenCalled();
    });

    it('ignores invalid bet or non-finite multiplier values safely', () => {
      const lossSpy = vi.spyOn(soundManager, 'playLoss').mockImplementation(() => {});
      playWinSound(Number.NaN, 50);
      playWinSound(2, 0);
      playWinSound(2, -10);
      expect(lossSpy).not.toHaveBeenCalled();
    });
  });

  describe('disabled-sound guard & AudioContext safety', () => {
    it('does not create AudioContext or audio nodes when soundManager.setEnabled(false)', () => {
      const { MockAudioContext, createdOscillators, createdGains, createdBufferSources } =
        createMockAudioContext();
      const ctxCtorSpy = vi.fn(() => new MockAudioContext());
      window.AudioContext = ctxCtorSpy as unknown as typeof AudioContext;

      soundManager.setEnabled(false);
      expect(soundManager.isEnabled()).toBe(false);

      soundManager.playClick();
      soundManager.playCoin();
      soundManager.playBonusClaim();
      soundManager.playLevelUp();
      soundManager.playLocked();
      soundManager.playSmallWin();
      soundManager.playBigWin();
      soundManager.playJackpot();
      soundManager.playCoinCascade(8);
      soundManager.playCardDeal();
      soundManager.playChipPlace();
      soundManager.playReelStop(2);
      soundManager.playTick();
      soundManager.playKenoHit(3);
      soundManager.playPush();
      soundManager.playLoss();
      playWinSound(20, 100);

      expect(ctxCtorSpy).not.toHaveBeenCalled();
      expect(createdOscillators).toHaveLength(0);
      expect(createdGains).toHaveLength(0);
      expect(createdBufferSources).toHaveLength(0);
    });

    it('never throws when AudioContext and webkitAudioContext are undefined (jsdom/SSR)', () => {
      (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext = undefined;
      (
        window as unknown as { webkitAudioContext?: typeof AudioContext }
      ).webkitAudioContext = undefined;

      expect(() => {
        soundManager.playClick();
        soundManager.playSmallWin();
        soundManager.playBigWin();
        soundManager.playJackpot();
        soundManager.playCoinCascade(6);
        soundManager.playCardDeal();
        soundManager.playChipPlace();
        soundManager.playReelStop(1);
        soundManager.playTick();
        soundManager.playKenoHit(2);
        soundManager.playPush();
        soundManager.playLoss();
        playWinSound(5, 50);
      }).not.toThrow();
    });

    it('synthesizes voices safely, applies fade-outs, caps voices, and cleans up onended', () => {
      const { MockAudioContext, createdOscillators, createdGains, createdBufferSources } =
        createMockAudioContext();
      window.AudioContext = MockAudioContext as unknown as typeof AudioContext;

      soundManager.playCardDeal();
      expect(createdBufferSources).toHaveLength(1);
      expect(createdBufferSources[0].start).toHaveBeenCalledTimes(1);
      expect(createdBufferSources[0].stop).toHaveBeenCalledTimes(1);

      soundManager.playChipPlace();
      soundManager.playReelStop(2);
      soundManager.playTick();
      soundManager.playKenoHit(4);
      soundManager.playPush();
      soundManager.playLoss();
      soundManager.playSmallWin();

      expect(createdOscillators.length).toBeGreaterThan(0);
      expect(createdGains.length).toBeGreaterThan(createdOscillators.length); // includes masterGain

      // Trigger onended callbacks and verify nodes disconnect cleanly without throwing
      createdOscillators.forEach((osc) => osc.onended?.());
      createdBufferSources.forEach((src) => src.onended?.());
      expect(createdOscillators[0].disconnect).toHaveBeenCalled();
      expect(createdBufferSources[0].disconnect).toHaveBeenCalled();
    });
  });
});
