import { describe, it, expect } from 'vitest';
import {
  EUROPEAN_WHEEL_SEQUENCE,
  RED_NUMBERS,
  BLACK_NUMBERS,
  getPocketColor,
  getRouletteSpot,
  evaluateRouletteBet,
  evaluateRouletteSpin,
  spinRoulettePocket,
  validateRouletteWager,
  PlacedRouletteBet,
} from './rouletteRules';
import {
  createInitialRouletteState,
  placeChipOnSpot,
  removeBetSpot,
  clearTableBets,
  repeatPreviousTableBets,
  startRouletteSpin,
  claimRouletteSettlement,
  startNewRouletteRound,
  SpinHistoryEntry,
} from './rouletteState';
import {
  ROULETTE_HISTORY_STORAGE_KEY,
  appendRouletteHistoryEntry,
  clearRouletteHistory,
  loadRouletteHistory,
  sanitizeRouletteHistory,
} from './rouletteHistoryStorage';

function makeBet(spotId: string, amount: number): PlacedRouletteBet {
  const spot = getRouletteSpot(spotId);
  if (!spot) {
    throw new Error(`Missing spot ${spotId}`);
  }
  return {
    spotId: spot.id,
    type: spot.type,
    label: spot.label,
    numbers: [...spot.numbers],
    payoutOdds: spot.payoutOdds,
    amount,
  };
}

describe('European Roulette Rules & Payout Engine', () => {
  it('defines standard 37-pocket European single-zero wheel (1 green, 18 red, 18 black)', () => {
    expect(EUROPEAN_WHEEL_SEQUENCE).toHaveLength(37);
    const unique = new Set(EUROPEAN_WHEEL_SEQUENCE);
    expect(unique.size).toBe(37);
    for (let n = 0; n <= 36; n++) {
      expect(unique.has(n)).toBe(true);
    }

    expect(RED_NUMBERS.size).toBe(18);
    expect(BLACK_NUMBERS.size).toBe(18);
    expect(getPocketColor(0)).toBe('green');
    expect(getPocketColor(1)).toBe('red');
    expect(getPocketColor(2)).toBe('black');
    expect(getPocketColor(32)).toBe('red');
    expect(getPocketColor(17)).toBe('black');
  });

  it('calculates exact gross payouts (stake returned + profit) for every individual bet type', () => {
    // Straight Up (35:1): 10 -> 360
    const straightRes = evaluateRouletteBet(makeBet('straight:17', 10), 17);
    expect(straightRes.won).toBe(true);
    expect(straightRes.profit).toBe(350);
    expect(straightRes.grossPayout).toBe(360);

    // Split (17:1): 10 -> 180
    const splitRes = evaluateRouletteBet(makeBet('split:17-20', 10), 20);
    expect(splitRes.won).toBe(true);
    expect(splitRes.profit).toBe(170);
    expect(splitRes.grossPayout).toBe(180);

    // Street (11:1): 10 -> 120
    const streetRes = evaluateRouletteBet(makeBet('street:4-6', 10), 5);
    expect(streetRes.won).toBe(true);
    expect(streetRes.profit).toBe(110);
    expect(streetRes.grossPayout).toBe(120);

    // Corner (8:1): 10 -> 90
    const cornerRes = evaluateRouletteBet(makeBet('corner:17-18-20-21', 10), 21);
    expect(cornerRes.won).toBe(true);
    expect(cornerRes.profit).toBe(80);
    expect(cornerRes.grossPayout).toBe(90);

    // Six Line (5:1): 10 -> 60
    const sixLineRes = evaluateRouletteBet(makeBet('six_line:1-6', 10), 6);
    expect(sixLineRes.won).toBe(true);
    expect(sixLineRes.profit).toBe(50);
    expect(sixLineRes.grossPayout).toBe(60);

    // Dozen (2:1): 10 -> 30
    const dozenRes = evaluateRouletteBet(makeBet('dozen:2', 10), 24);
    expect(dozenRes.won).toBe(true);
    expect(dozenRes.profit).toBe(20);
    expect(dozenRes.grossPayout).toBe(30);

    // Column (2:1): 10 -> 30
    const colRes = evaluateRouletteBet(makeBet('column:3', 10), 36);
    expect(colRes.won).toBe(true);
    expect(colRes.profit).toBe(20);
    expect(colRes.grossPayout).toBe(30);

    // Red / Black / Even / Odd / Low / High (1:1): 10 -> 20
    expect(evaluateRouletteBet(makeBet('red', 10), 3).grossPayout).toBe(20);
    expect(evaluateRouletteBet(makeBet('black', 10), 2).grossPayout).toBe(20);
    expect(evaluateRouletteBet(makeBet('even', 10), 14).grossPayout).toBe(20);
    expect(evaluateRouletteBet(makeBet('odd', 10), 15).grossPayout).toBe(20);
    expect(evaluateRouletteBet(makeBet('low', 10), 18).grossPayout).toBe(20);
    expect(evaluateRouletteBet(makeBet('high', 10), 19).grossPayout).toBe(20);
  });

  it('handles losing bets accurately with zero gross payout', () => {
    const loseStraight = evaluateRouletteBet(makeBet('straight:17', 25), 18);
    expect(loseStraight.won).toBe(false);
    expect(loseStraight.profit).toBe(-25);
    expect(loseStraight.grossPayout).toBe(0);

    const loseOutside = evaluateRouletteBet(makeBet('red', 50), 2);
    expect(loseOutside.won).toBe(false);
    expect(loseOutside.grossPayout).toBe(0);
  });

  it('makes Zero (0) lose all standard outside bets while allowing inside zero bets to win', () => {
    const outsideSpots = [
      'red',
      'black',
      'even',
      'odd',
      'low',
      'high',
      'dozen:1',
      'dozen:2',
      'dozen:3',
      'column:1',
      'column:2',
      'column:3',
    ];
    const outsideBets = outsideSpots.map((id) => makeBet(id, 10));
    const zeroOutsideEval = evaluateRouletteSpin(outsideBets, 0);
    expect(zeroOutsideEval.winningColor).toBe('green');
    expect(zeroOutsideEval.totalWager).toBe(120);
    expect(zeroOutsideEval.totalGrossPayout).toBe(0);
    expect(zeroOutsideEval.net).toBe(-120);
    expect(zeroOutsideEval.winningSpotIds).toHaveLength(0);

    const insideZeroBets = [
      makeBet('straight:0', 10), // 360
      makeBet('split:0-2', 10), // 180
      makeBet('street:0-1-2', 10), // 120
      makeBet('red', 10), // 0
    ];
    const zeroMixedEval = evaluateRouletteSpin(insideZeroBets, 0);
    expect(zeroMixedEval.totalWager).toBe(40);
    expect(zeroMixedEval.totalGrossPayout).toBe(660);
    expect(zeroMixedEval.net).toBe(620);
    expect(zeroMixedEval.won).toBe(true);
  });

  it('sums multiple simultaneous and overlapping winning bets correctly', () => {
    // Winning number 17 (Black, Odd, Low 1-18, 2nd 12, Column 2)
    const bets = [
      makeBet('straight:17', 10), // 360
      makeBet('split:17-20', 10), // 180
      makeBet('corner:17-18-20-21', 10), // 90
      makeBet('dozen:2', 20), // 60
      makeBet('column:2', 20), // 60
      makeBet('black', 25), // 50
      makeBet('red', 25), // 0
    ];

    const evalResult = evaluateRouletteSpin(bets, 17);
    expect(evalResult.totalWager).toBe(120);
    expect(evalResult.totalGrossPayout).toBe(800);
    expect(evalResult.net).toBe(680);
    expect(evalResult.won).toBe(true);
    expect(evalResult.winningSpotIds).toEqual([
      'straight:17',
      'split:17-20',
      'corner:17-18-20-21',
      'dozen:2',
      'column:2',
      'black',
    ]);
  });

  it('validates minimum wager, maximum wager, and insufficient balance', () => {
    expect(validateRouletteWager([], 10, 1500, 1000).valid).toBe(false);
    expect(validateRouletteWager([makeBet('red', 5)], 10, 1500, 1000).valid).toBe(false);
    expect(validateRouletteWager([makeBet('red', 100)], 10, 1500, 50).valid).toBe(false);
    expect(validateRouletteWager([makeBet('red', 1600)], 10, 1500, 5000).valid).toBe(false);
    expect(validateRouletteWager([makeBet('red', 100)], 10, 1500, 1000).valid).toBe(true);
  });

  it('returns unbiased pocket integers in 0..36 from spinRoulettePocket', () => {
    for (let i = 0; i < 500; i++) {
      const pocket = spinRoulettePocket();
      expect(Number.isInteger(pocket)).toBe(true);
      expect(pocket).toBeGreaterThanOrEqual(0);
      expect(pocket).toBeLessThanOrEqual(36);
    }
    expect(spinRoulettePocket(() => 0)).toBe(0);
    expect(spinRoulettePocket(() => 17)).toBe(17);
  });
});

describe('European Roulette State Machine', () => {
  it('supports adding, incrementing, removing, clearing, and repeating bets without exceeding balance', () => {
    let state = createInitialRouletteState();

    // Add 25 to Red, +25 to Red (=50), +10 to Straight 17
    let res = placeChipOnSpot(state, 'red', 25, 1500, 100);
    expect(res.placed).toBe(true);
    state = res.state;

    res = placeChipOnSpot(state, 'red', 25, 1500, 100);
    expect(res.placed).toBe(true);
    state = res.state;

    res = placeChipOnSpot(state, 'straight:17', 10, 1500, 100);
    expect(res.placed).toBe(true);
    state = res.state;
    expect(state.bets).toHaveLength(2);

    // Insufficient balance check (60 placed, 100 balance -> adding 50 fails)
    const overdraft = placeChipOnSpot(state, 'black', 50, 1500, 100);
    expect(overdraft.placed).toBe(false);
    expect(overdraft.reason).toMatch(/insufficient/i);

    // Remove individual spot
    state = removeBetSpot(state, 'straight:17');
    expect(state.bets).toHaveLength(1);
    expect(state.bets[0].spotId).toBe('red');

    // Clear all bets
    state = clearTableBets(state);
    expect(state.bets).toHaveLength(0);

    // Spin and settle a 50-credit Red bet on pocket 3 (Red)
    state = placeChipOnSpot(state, 'red', 50, 1500, 1000).state;
    const spin = startRouletteSpin(state, 10, 1500, 1000, () => 3);
    expect(spin.started).toBe(true);
    state = spin.state;

    // Cannot start second spin, clear, or place bets while SPINNING
    expect(startRouletteSpin(state, 10, 1500, 1000).started).toBe(false);
    expect(placeChipOnSpot(state, 'black', 10, 1500, 1000).placed).toBe(false);
    expect(clearTableBets(state).phase).toBe('SPINNING');

    // Settlement succeeds strictly once
    const firstClaim = claimRouletteSettlement(state);
    expect(firstClaim.claimed).toBe(true);
    expect(firstClaim.state.phase).toBe('SETTLED');
    expect(firstClaim.state.history[0].number).toBe(3);
    expect(firstClaim.state.history[0].grossPayout).toBe(100);

    const secondClaim = claimRouletteSettlement(firstClaim.state);
    expect(secondClaim.claimed).toBe(false);

    // Start new round clears board but preserves previousBets for Repeat
    state = startNewRouletteRound(firstClaim.state);
    expect(state.bets).toHaveLength(0);
    expect(state.previousBets).toHaveLength(1);

    // Repeat fails if balance too low
    const failedRepeat = repeatPreviousTableBets(state, 1500, 20);
    expect(failedRepeat.repeated).toBe(false);

    // Repeat succeeds when affordable
    const repeated = repeatPreviousTableBets(state, 1500, 500);
    expect(repeated.repeated).toBe(true);
    expect(repeated.state.bets[0]).toMatchObject({ spotId: 'red', amount: 50 });
  });
});

describe('Persistent Roulette History Storage', () => {
  class MemoryStorage implements Storage {
    private map = new Map<string, string>();
    get length() {
      return this.map.size;
    }
    clear() {
      this.map.clear();
    }
    getItem(key: string) {
      return this.map.has(key) ? this.map.get(key)! : null;
    }
    setItem(key: string, val: string) {
      this.map.set(key, String(val));
    }
    removeItem(key: string) {
      this.map.delete(key);
    }
    key(idx: number) {
      return Array.from(this.map.keys())[idx] ?? null;
    }
  }

  it('persists up to 15 settled entries, deduplicates identical roundIds, and safely handles malformed storage', () => {
    const storage = new MemoryStorage();

    // Append 16 unique rounds; oldest should be evicted to maintain max 15
    for (let i = 1; i <= 16; i++) {
      const pocket = i % 37;
      const color = getPocketColor(pocket);
      const entry: SpinHistoryEntry = {
        roundId: `round_${i}`,
        number: pocket,
        color,
        timestamp: 1700000000000 + i * 1000,
        totalWager: 25,
        grossPayout: i % 2 === 0 ? 50 : 0,
        net: i % 2 === 0 ? 25 : -25,
      };
      appendRouletteHistoryEntry(entry, storage);
    }

    const loaded = loadRouletteHistory(storage);
    expect(loaded).toHaveLength(15);
    expect(loaded[0].roundId).toBe('round_16');
    expect(loaded[14].roundId).toBe('round_2');

    // Duplicate roundId must not insert a duplicate entry
    appendRouletteHistoryEntry(loaded[0], storage);
    expect(loadRouletteHistory(storage)).toHaveLength(15);
    expect(loadRouletteHistory(storage)[0].roundId).toBe('round_16');

    // Corrupt JSON does not throw and safely returns []
    storage.setItem(ROULETTE_HISTORY_STORAGE_KEY, '{not-valid-json');
    expect(loadRouletteHistory(storage)).toEqual([]);

    // Mixed valid + malformed entries sanitize cleanly
    const cleaned = sanitizeRouletteHistory([
      { roundId: '', number: 7, color: 'red', timestamp: 1000, totalWager: 10, grossPayout: 20, net: 10 },
      { roundId: 'bad_num', number: 37, color: 'red', timestamp: 1000, totalWager: 10, grossPayout: 0, net: -10 },
      { roundId: 'bad_color', number: 0, color: 'red', timestamp: 1000, totalWager: 10, grossPayout: 0, net: -10 },
      { roundId: 'valid_zero', number: 0, color: 'green', timestamp: 2000, totalWager: 10, grossPayout: 360, net: 350 },
      { roundId: 'valid_zero', number: 0, color: 'green', timestamp: 2000, totalWager: 10, grossPayout: 360, net: 350 },
    ]);
    expect(cleaned).toHaveLength(1);
    expect(cleaned[0].roundId).toBe('valid_zero');

    clearRouletteHistory(storage);
    expect(loadRouletteHistory(storage)).toEqual([]);
  });
});
