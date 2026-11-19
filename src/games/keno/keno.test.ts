import { describe, it, expect, beforeEach } from 'vitest';
import {
  KENO_DRAW_COUNT,
  KENO_MAX_NUMBER,
  KENO_MAX_SPOTS,
  KENO_MIN_NUMBER,
  KENO_MIN_SPOTS,
  KENO_PAYTABLE,
  calculateKenoAnalyticalRtp,
  drawKenoNumbers,
  evaluateKenoRound,
  generateQuickPick,
  getKenoMultiplier,
  getKenoPaytableForSpots,
  toggleKenoNumber,
  validateKenoRound,
} from './kenoRules';
import {
  KENO_HISTORY_STORAGE_KEY,
  KENO_STATS_STORAGE_KEY,
  MAX_KENO_HISTORY,
  clearKenoPersistence,
  loadKenoHistory,
  loadKenoStats,
  recordCompletedKenoRound,
  sanitizeKenoHistory,
  sanitizeKenoStats,
} from './kenoStorage';
import {
  advanceKenoReveal,
  applyQuickPick,
  claimKenoSettlement,
  clearKenoSelection,
  createInitialKenoState,
  repeatPreviousKenoBet,
  setKenoWager,
  startKenoDraw,
  toggleSpotInState,
} from './kenoState';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
}

describe('Keno Pure Rules, Uniform Draw, Paytable & RTP', () => {
  it('draws exactly 20 unique numbers within 1..80 without replacement', () => {
    for (let trial = 0; trial < 25; trial++) {
      const drawn = drawKenoNumbers();
      expect(drawn).toHaveLength(KENO_DRAW_COUNT);
      const unique = new Set(drawn);
      expect(unique.size).toBe(KENO_DRAW_COUNT);
      for (const n of drawn) {
        expect(Number.isInteger(n)).toBe(true);
        expect(n).toBeGreaterThanOrEqual(KENO_MIN_NUMBER);
        expect(n).toBeLessThanOrEqual(KENO_MAX_NUMBER);
      }
    }
  });

  it('generates sorted unique Quick Pick selections clamped to 1..10', () => {
    for (let count = 1; count <= 10; count++) {
      const pick = generateQuickPick(count);
      expect(pick).toHaveLength(count);
      expect(new Set(pick).size).toBe(count);
      expect([...pick].sort((a, b) => a - b)).toEqual(pick);
    }
    expect(generateQuickPick(0)).toHaveLength(KENO_MIN_SPOTS);
    expect(generateQuickPick(15)).toHaveLength(KENO_MAX_SPOTS);
  });

  it('enforces selection limits (1..10), allows deselecting, and blocks an 11th spot', () => {
    let selected: number[] = [];
    for (let n = 1; n <= 10; n++) {
      const res = toggleKenoNumber(selected, n);
      expect(res.changed).toBe(true);
      selected = res.selected;
    }
    expect(selected).toHaveLength(10);

    // 11th number rejected
    const eleventh = toggleKenoNumber(selected, 11);
    expect(eleventh.changed).toBe(false);
    expect(eleventh.selected).toHaveLength(10);
    expect(eleventh.reason).toMatch(/10/);

    // Deselecting an existing number works cleanly
    const deselect = toggleKenoNumber(selected, 5);
    expect(deselect.changed).toBe(true);
    expect(deselect.selected).toHaveLength(9);
    expect(deselect.selected).not.toContain(5);
  });

  it('defines paytable schedules for every spot count 1–10 with balanced <100% analytical RTP', () => {
    for (let spots = 1; spots <= 10; spots++) {
      expect(KENO_PAYTABLE[spots]).toBeDefined();
      const rows = getKenoPaytableForSpots(spots);
      expect(rows.length).toBeGreaterThanOrEqual(1);
      for (const row of rows) {
        expect(row.hits).toBeGreaterThanOrEqual(1);
        expect(row.hits).toBeLessThanOrEqual(spots);
        expect(row.multiplier).toBeGreaterThan(0);
      }
      const rtp = calculateKenoAnalyticalRtp(spots);
      expect(rtp).toBeGreaterThan(0.9);
      expect(rtp).toBeLessThan(0.97);
    }
  });

  it('calculates gross payout vs net profit accurately for wins, pushes, and losses', () => {
    const draw = Array.from({ length: 20 }, (_, i) => i + 1); // 1..20

    // Winning 3-of-3 on 3-spot (48x gross multiplier)
    const winEval = evaluateKenoRound([1, 2, 3], draw, 50);
    expect(winEval.hits).toBe(3);
    expect(winEval.multiplier).toBe(48);
    expect(winEval.grossPayout).toBe(2400);
    expect(winEval.net).toBe(2350);
    expect(winEval.isWin).toBe(true);
    expect(winEval.isPush).toBe(false);

    // Push 2-of-4 on 4-spot (1x gross multiplier -> stake returned, net 0)
    const pushEval = evaluateKenoRound([1, 2, 50, 51], draw, 40);
    expect(pushEval.hits).toBe(2);
    expect(pushEval.multiplier).toBe(getKenoMultiplier(4, 2));
    expect(pushEval.multiplier).toBe(1);
    expect(pushEval.grossPayout).toBe(40);
    expect(pushEval.net).toBe(0);
    expect(pushEval.isWin).toBe(false);
    expect(pushEval.isPush).toBe(true);

    // Losing round: 0 matches returns 0 gross and -wager net
    const lossEval = evaluateKenoRound([21, 22, 23, 24], draw, 50);
    expect(lossEval.hits).toBe(0);
    expect(lossEval.multiplier).toBe(0);
    expect(lossEval.grossPayout).toBe(0);
    expect(lossEval.net).toBe(-50);
    expect(lossEval.isWin).toBe(false);
    expect(lossEval.isPush).toBe(false);
  });

  it('rejects invalid wagers and invalid ticket selections', () => {
    // 0 selected numbers
    expect(validateKenoRound([], 20, 10, 1000, 500).valid).toBe(false);
    // Duplicate selection
    expect(validateKenoRound([5, 5], 20, 10, 1000, 500).valid).toBe(false);
    // Out-of-range number
    expect(validateKenoRound([0, 81], 20, 10, 1000, 500).valid).toBe(false);
    // Invalid bets
    expect(validateKenoRound([1, 2], 0, 10, 1000, 500).valid).toBe(false);
    expect(validateKenoRound([1, 2], -20, 10, 1000, 500).valid).toBe(false);
    expect(validateKenoRound([1, 2], 5, 10, 1000, 500).valid).toBe(false);
    expect(validateKenoRound([1, 2], 1500, 10, 1000, 2000).valid).toBe(false);
    expect(validateKenoRound([1, 2], 600, 10, 1000, 500).valid).toBe(false);
    expect(validateKenoRound([1, 2], 25, 10, 1000, 500).valid).toBe(false);
    // Valid
    expect(validateKenoRound([1, 2, 3], 50, 10, 1000, 500).valid).toBe(true);
  });
});

describe('Keno State Machine (Quick Pick, Repeat Bet, Duplicate Settlement Guard)', () => {
  it('handles Quick Pick, Clear, Repeat Bet, Draw, Reveal, and idempotent Settlement', () => {
    let state = createInitialKenoState(30);
    state = applyQuickPick(state, 5);
    expect(state.selectedNumbers).toHaveLength(5);

    state = clearKenoSelection(state);
    expect(state.selectedNumbers).toHaveLength(0);

    // Toggle 3 numbers manually
    for (const n of [7, 14, 21]) {
      state = toggleSpotInState(state, n).state;
    }
    state = setKenoWager(state, 50, 10, 1000, 500);
    expect(state.wager).toBe(50);

    const started = startKenoDraw(state, 10, 1000, 500);
    expect(started.started).toBe(true);
    expect(started.state.phase).toBe('DRAWING');
    expect(started.state.drawnSequence).toHaveLength(20);

    // Prevent starting a second draw while active
    const blockedSecond = startKenoDraw(started.state, 10, 1000, 500);
    expect(blockedSecond.started).toBe(false);

    // Advance reveals to 20
    let drawingState = started.state;
    for (let i = 0; i < 20; i++) {
      drawingState = advanceKenoReveal(drawingState);
    }
    expect(drawingState.revealedCount).toBe(20);

    // First settlement succeeds, duplicate settlement rejected
    const firstClaim = claimKenoSettlement(drawingState);
    expect(firstClaim.claimed).toBe(true);
    expect(firstClaim.state.phase).toBe('SETTLED');

    const duplicateClaim = claimKenoSettlement(firstClaim.state);
    expect(duplicateClaim.claimed).toBe(false);

    // Clear and Repeat Bet restores previous numbers & wager
    let next = clearKenoSelection(firstClaim.state);
    next = setKenoWager(next, 10, 10, 1000, 500);
    const repeated = repeatPreviousKenoBet(next, 10, 1000, 500);
    expect(repeated.repeated).toBe(true);
    expect(repeated.state.selectedNumbers).toEqual([7, 14, 21]);
    expect(repeated.state.wager).toBe(50);
  });
});

describe('Keno Persistence, 15-Round Cap, Deduplication & Corrupt Data Recovery', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    clearKenoPersistence(storage);
  });

  const makeEntry = (idx: number, hits = 3) => {
    const selected = [1, 2, 3, 4];
    const drawn = Array.from({ length: 20 }, (_, i) => (hits === 3 ? i + 2 : i + 10));
    const matched = selected.filter((n) => drawn.includes(n));
    const evaluation = evaluateKenoRound(selected, drawn, 20);
    return {
      roundId: `keno_round_${idx}`,
      timestamp: 1000 + idx,
      selectedNumbers: evaluation.selectedNumbers,
      drawnNumbers: evaluation.drawnNumbers,
      matchedNumbers: matched,
      spotCount: evaluation.spotCount,
      hits: evaluation.hits,
      multiplier: evaluation.multiplier,
      wager: evaluation.wager,
      grossPayout: evaluation.grossPayout,
      net: evaluation.net,
    };
  };

  it('caps history at 15 rounds, tracks stats accurately, and prevents duplicate roundId recording', () => {
    for (let i = 1; i <= 18; i++) {
      const res = recordCompletedKenoRound(makeEntry(i), storage);
      expect(res.recorded).toBe(true);
    }

    const history = loadKenoHistory(storage);
    const stats = loadKenoStats(storage);

    expect(history).toHaveLength(MAX_KENO_HISTORY);
    expect(history[0].roundId).toBe('keno_round_18');
    expect(stats.totalRounds).toBe(18);
    expect(stats.winningRounds).toBe(18); // 3 of 4 hits pays 6x

    // Attempting to record an already-recorded roundId (even round #1 evicted from last 15) is ignored!
    const dupRecent = recordCompletedKenoRound(makeEntry(18), storage);
    expect(dupRecent.recorded).toBe(false);
    const dupEvicted = recordCompletedKenoRound(makeEntry(1), storage);
    expect(dupEvicted.recorded).toBe(false);
    expect(loadKenoStats(storage).totalRounds).toBe(18);
  });

  it('handles corrupt JSON and invalid/tampered records safely without crashing', () => {
    storage.setItem(KENO_HISTORY_STORAGE_KEY, '{not-valid-json');
    storage.setItem(KENO_STATS_STORAGE_KEY, 'corrupt!');

    expect(loadKenoHistory(storage)).toEqual([]);
    expect(loadKenoStats(storage).totalRounds).toBe(0);

    // Mix valid and tampered entries
    const valid = makeEntry(99);
    const tamperedNet = { ...valid, roundId: 'tampered_1', net: 999999 };
    const tamperedDrawLen = { ...valid, roundId: 'tampered_2', drawnNumbers: [1, 2, 3] };

    const sanitizedHist = sanitizeKenoHistory([null, 42, tamperedNet, tamperedDrawLen, valid]);
    expect(sanitizedHist).toHaveLength(1);
    expect(sanitizedHist[0].roundId).toBe('keno_round_99');

    const sanitizedStats = sanitizeKenoStats({
      totalRounds: 5,
      winningRounds: 99, // impossible > totalRounds -> clamped to 5
      bestHits: 99, // out of 0..10 range -> reset to 0
      biggestGrossPayout: -50, // negative -> reset to 0
      totalNet: NaN, // non-finite -> reset to 0
      recordedRoundIds: ['r1', 123, '', 'r1'],
    });
    expect(sanitizedStats).toEqual({
      totalRounds: 5,
      winningRounds: 5,
      bestHits: 0,
      biggestGrossPayout: 0,
      totalNet: 0,
      recordedRoundIds: ['r1'],
    });
  });
});
