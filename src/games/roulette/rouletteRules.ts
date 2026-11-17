/**
 * Pure European Single-Zero Roulette Rules, Layout Topology & Payout Engine.
 * No React, no DOM, no sound, no side-effects.
 */

import { randomInt } from '../shared/rng';

export type PocketColor = 'green' | 'red' | 'black';

export type RouletteBetType =
  | 'straight'
  | 'split'
  | 'street'
  | 'corner'
  | 'six_line'
  | 'dozen'
  | 'column'
  | 'red'
  | 'black'
  | 'even'
  | 'odd'
  | 'low'
  | 'high';

export interface RouletteBetSpot {
  id: string;
  type: RouletteBetType;
  label: string;
  numbers: number[];
  /** Profit odds (e.g. 35 means 35:1, so gross return is 36x stake). */
  payoutOdds: number;
}

export interface PlacedRouletteBet {
  spotId: string;
  type: RouletteBetType;
  label: string;
  numbers: number[];
  payoutOdds: number;
  amount: number;
}

export interface EvaluatedBetResult extends PlacedRouletteBet {
  won: boolean;
  profit: number;
  grossPayout: number;
}

export interface SpinEvaluation {
  winningNumber: number;
  winningColor: PocketColor;
  totalWager: number;
  totalGrossPayout: number;
  net: number;
  won: boolean;
  betResults: EvaluatedBetResult[];
  winningSpotIds: string[];
}

/**
 * Standard clockwise European single-zero Roulette wheel sequence (37 pockets).
 */
export const EUROPEAN_WHEEL_SEQUENCE: readonly number[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
] as const;

export const RED_NUMBERS = new Set<number>([
  1, 3, 5, 7, 9, 12, 14, 16, 18,
  19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export const BLACK_NUMBERS = new Set<number>([
  2, 4, 6, 8, 10, 11, 13, 15, 17,
  20, 22, 24, 26, 28, 29, 31, 33, 35,
]);

export const ROULETTE_CHIP_VALUES: readonly number[] = [5, 10, 25, 50, 100, 500] as const;

export const PAYOUT_ODDS: Record<RouletteBetType, number> = {
  straight: 35,
  split: 17,
  street: 11,
  corner: 8,
  six_line: 5,
  dozen: 2,
  column: 2,
  red: 1,
  black: 1,
  even: 1,
  odd: 1,
  low: 1,
  high: 1,
};

export const PAYTABLE_INFO: ReadonlyArray<{
  type: RouletteBetType;
  name: string;
  coverage: string;
  oddsLabel: string;
  payoutOdds: number;
}> = [
  { type: 'straight', name: 'Straight Up', coverage: 'Single number (0–36)', oddsLabel: '35:1', payoutOdds: 35 },
  { type: 'split', name: 'Split', coverage: '2 adjacent numbers', oddsLabel: '17:1', payoutOdds: 17 },
  { type: 'street', name: 'Street', coverage: '3 numbers in a row/street', oddsLabel: '11:1', payoutOdds: 11 },
  { type: 'corner', name: 'Corner', coverage: '4 numbers meeting at a corner', oddsLabel: '8:1', payoutOdds: 8 },
  { type: 'six_line', name: 'Six Line', coverage: '6 numbers across two streets', oddsLabel: '5:1', payoutOdds: 5 },
  { type: 'dozen', name: 'Dozen', coverage: '1st / 2nd / 3rd 12 (0 loses)', oddsLabel: '2:1', payoutOdds: 2 },
  { type: 'column', name: 'Column', coverage: '12 numbers in a column (0 loses)', oddsLabel: '2:1', payoutOdds: 2 },
  { type: 'red', name: 'Red / Black', coverage: '18 numbers by colour (0 loses)', oddsLabel: '1:1', payoutOdds: 1 },
  { type: 'even', name: 'Even / Odd', coverage: '18 even or odd numbers (0 loses)', oddsLabel: '1:1', payoutOdds: 1 },
  { type: 'low', name: 'Low / High', coverage: '1–18 or 19–36 (0 loses)', oddsLabel: '1:1', payoutOdds: 1 },
];

export function getPocketColor(num: number): PocketColor {
  if (num === 0) return 'green';
  if (RED_NUMBERS.has(num)) return 'red';
  return 'black';
}

export function getWheelIndex(pocket: number): number {
  const idx = EUROPEAN_WHEEL_SEQUENCE.indexOf(pocket);
  return idx >= 0 ? idx : 0;
}

/**
 * Generates the canonical map of every legal European Roulette bet spot.
 */
function buildBetSpots(): Map<string, RouletteBetSpot> {
  const spots = new Map<string, RouletteBetSpot>();

  // 1. Straight Up (0..36) -> 35:1
  for (let n = 0; n <= 36; n++) {
    spots.set(`straight:${n}`, {
      id: `straight:${n}`,
      type: 'straight',
      label: `Straight ${n}`,
      numbers: [n],
      payoutOdds: PAYOUT_ODDS.straight,
    });
  }

  // 2. Zero Splits (0-1, 0-2, 0-3) -> 17:1
  for (const n of [1, 2, 3]) {
    spots.set(`split:0-${n}`, {
      id: `split:0-${n}`,
      type: 'split',
      label: `Split 0/${n}`,
      numbers: [0, n],
      payoutOdds: PAYOUT_ODDS.split,
    });
  }

  // 3. Zero Trio Streets (0-1-2, 0-2-3) -> 11:1
  spots.set('street:0-1-2', {
    id: 'street:0-1-2',
    type: 'street',
    label: 'Trio 0/1/2',
    numbers: [0, 1, 2],
    payoutOdds: PAYOUT_ODDS.street,
  });
  spots.set('street:0-2-3', {
    id: 'street:0-2-3',
    type: 'street',
    label: 'Trio 0/2/3',
    numbers: [0, 2, 3],
    payoutOdds: PAYOUT_ODDS.street,
  });

  // 4. Inside Table Splits (vertical within street + horizontal across streets) -> 17:1
  for (let col = 0; col < 12; col++) {
    const base = col * 3 + 1; // 1, 4, 7, ..., 34
    // Vertical splits within the street: (base, base+1) and (base+1, base+2)
    spots.set(`split:${base}-${base + 1}`, {
      id: `split:${base}-${base + 1}`,
      type: 'split',
      label: `Split ${base}/${base + 1}`,
      numbers: [base, base + 1],
      payoutOdds: PAYOUT_ODDS.split,
    });
    spots.set(`split:${base + 1}-${base + 2}`, {
      id: `split:${base + 1}-${base + 2}`,
      type: 'split',
      label: `Split ${base + 1}/${base + 2}`,
      numbers: [base + 1, base + 2],
      payoutOdds: PAYOUT_ODDS.split,
    });

    // Horizontal splits to next street (col < 11)
    if (col < 11) {
      for (let offset = 0; offset < 3; offset++) {
        const a = base + offset;
        const b = a + 3;
        spots.set(`split:${a}-${b}`, {
          id: `split:${a}-${b}`,
          type: 'split',
          label: `Split ${a}/${b}`,
          numbers: [a, b],
          payoutOdds: PAYOUT_ODDS.split,
        });
      }
    }
  }

  // 5. Streets (3 numbers: 1-2-3, 4-5-6, ..., 34-35-36) -> 11:1
  for (let col = 0; col < 12; col++) {
    const base = col * 3 + 1;
    const nums = [base, base + 1, base + 2];
    const id = `street:${base}-${base + 2}`;
    spots.set(id, {
      id,
      type: 'street',
      label: `Street ${base}-${base + 2}`,
      numbers: nums,
      payoutOdds: PAYOUT_ODDS.street,
    });
  }

  // 6. Corners (4 numbers at 2x2 intersections) -> 8:1
  for (let col = 0; col < 11; col++) {
    const base = col * 3 + 1;
    // Lower corner: [base, base+1, base+3, base+4]
    const lowerNums = [base, base + 1, base + 3, base + 4];
    const lowerId = `corner:${lowerNums.join('-')}`;
    spots.set(lowerId, {
      id: lowerId,
      type: 'corner',
      label: `Corner ${lowerNums.join('/')}`,
      numbers: lowerNums,
      payoutOdds: PAYOUT_ODDS.corner,
    });

    // Upper corner: [base+1, base+2, base+4, base+5]
    const upperNums = [base + 1, base + 2, base + 4, base + 5];
    const upperId = `corner:${upperNums.join('-')}`;
    spots.set(upperId, {
      id: upperId,
      type: 'corner',
      label: `Corner ${upperNums.join('/')}`,
      numbers: upperNums,
      payoutOdds: PAYOUT_ODDS.corner,
    });
  }

  // 7. Six Lines (6 numbers across two adjacent streets) -> 5:1
  for (let col = 0; col < 11; col++) {
    const base = col * 3 + 1;
    const nums = [base, base + 1, base + 2, base + 3, base + 4, base + 5];
    const id = `six_line:${base}-${base + 5}`;
    spots.set(id, {
      id,
      type: 'six_line',
      label: `Six Line ${base}-${base + 5}`,
      numbers: nums,
      payoutOdds: PAYOUT_ODDS.six_line,
    });
  }

  // 8. Dozens (2:1)
  spots.set('dozen:1', {
    id: 'dozen:1',
    type: 'dozen',
    label: '1st 12 (1–12)',
    numbers: Array.from({ length: 12 }, (_, i) => i + 1),
    payoutOdds: PAYOUT_ODDS.dozen,
  });
  spots.set('dozen:2', {
    id: 'dozen:2',
    type: 'dozen',
    label: '2nd 12 (13–24)',
    numbers: Array.from({ length: 12 }, (_, i) => i + 13),
    payoutOdds: PAYOUT_ODDS.dozen,
  });
  spots.set('dozen:3', {
    id: 'dozen:3',
    type: 'dozen',
    label: '3rd 12 (25–36)',
    numbers: Array.from({ length: 12 }, (_, i) => i + 25),
    payoutOdds: PAYOUT_ODDS.dozen,
  });

  // 9. Columns (2:1) — Column 1 (1,4..34), Column 2 (2,5..35), Column 3 (3,6..36)
  for (const colRow of [1, 2, 3]) {
    const nums = Array.from({ length: 12 }, (_, i) => i * 3 + colRow);
    spots.set(`column:${colRow}`, {
      id: `column:${colRow}`,
      type: 'column',
      label: `Column ${colRow} (2:1)`,
      numbers: nums,
      payoutOdds: PAYOUT_ODDS.column,
    });
  }

  // 10. Even-money outside bets (1:1; 0 loses all)
  const oneTo36 = Array.from({ length: 36 }, (_, i) => i + 1);

  spots.set('low', {
    id: 'low',
    type: 'low',
    label: '1 to 18 (Low)',
    numbers: oneTo36.filter((n) => n <= 18),
    payoutOdds: PAYOUT_ODDS.low,
  });
  spots.set('high', {
    id: 'high',
    type: 'high',
    label: '19 to 36 (High)',
    numbers: oneTo36.filter((n) => n >= 19),
    payoutOdds: PAYOUT_ODDS.high,
  });
  spots.set('even', {
    id: 'even',
    type: 'even',
    label: 'Even',
    numbers: oneTo36.filter((n) => n % 2 === 0),
    payoutOdds: PAYOUT_ODDS.even,
  });
  spots.set('odd', {
    id: 'odd',
    type: 'odd',
    label: 'Odd',
    numbers: oneTo36.filter((n) => n % 2 === 1),
    payoutOdds: PAYOUT_ODDS.odd,
  });
  spots.set('red', {
    id: 'red',
    type: 'red',
    label: 'Red',
    numbers: oneTo36.filter((n) => RED_NUMBERS.has(n)),
    payoutOdds: PAYOUT_ODDS.red,
  });
  spots.set('black', {
    id: 'black',
    type: 'black',
    label: 'Black',
    numbers: oneTo36.filter((n) => BLACK_NUMBERS.has(n)),
    payoutOdds: PAYOUT_ODDS.black,
  });

  return spots;
}

export const ROULETTE_SPOTS: ReadonlyMap<string, RouletteBetSpot> = buildBetSpots();

export function getRouletteSpot(spotId: string): RouletteBetSpot | undefined {
  return ROULETTE_SPOTS.get(spotId);
}

export function getAllRouletteSpots(): RouletteBetSpot[] {
  return Array.from(ROULETTE_SPOTS.values());
}

/**
 * Cryptographically secure unbiased pocket draw (0–36).
 */
export function spinRoulettePocket(customRng?: () => number): number {
  return randomInt(37, customRng);
}

/**
 * Evaluates a single placed roulette bet against a winning pocket number.
 * Gross payout includes the returned stake when the bet wins (`amount * (payoutOdds + 1)`).
 */
export function evaluateRouletteBet(
  bet: PlacedRouletteBet,
  winningNumber: number
): EvaluatedBetResult {
  if (!Number.isInteger(winningNumber) || winningNumber < 0 || winningNumber > 36) {
    return {
      ...bet,
      won: false,
      profit: -bet.amount,
      grossPayout: 0,
    };
  }

  const won = bet.numbers.includes(winningNumber);
  if (!won) {
    return {
      ...bet,
      won: false,
      profit: -bet.amount,
      grossPayout: 0,
    };
  }

  const profit = bet.amount * bet.payoutOdds;
  const grossPayout = bet.amount + profit;

  return {
    ...bet,
    won: true,
    profit,
    grossPayout,
  };
}

/**
 * Evaluates all placed bets in a spin simultaneously.
 */
export function evaluateRouletteSpin(
  bets: PlacedRouletteBet[],
  winningNumber: number
): SpinEvaluation {
  const winningColor = getPocketColor(winningNumber);
  const betResults = bets.map((b) => evaluateRouletteBet(b, winningNumber));

  const totalWager = bets.reduce((sum, b) => sum + b.amount, 0);
  const totalGrossPayout = betResults.reduce((sum, r) => sum + r.grossPayout, 0);
  const net = totalGrossPayout - totalWager;
  const winningSpotIds = betResults.filter((r) => r.won).map((r) => r.spotId);

  return {
    winningNumber,
    winningColor,
    totalWager,
    totalGrossPayout,
    net,
    won: totalGrossPayout > 0 && net >= 0 ? net > 0 : false,
    betResults,
    winningSpotIds,
  };
}

export function calculateTotalWager(bets: ReadonlyArray<{ amount: number }>): number {
  return bets.reduce((sum, b) => sum + b.amount, 0);
}

/**
 * Validates the current board's total wager against table limits and available patron credits.
 */
export function validateRouletteWager(
  bets: PlacedRouletteBet[],
  minBet: number,
  maxBet: number,
  balance: number
): { valid: boolean; totalWager: number; reason?: string } {
  const totalWager = calculateTotalWager(bets);

  if (bets.length === 0 || totalWager <= 0) {
    return { valid: false, totalWager, reason: 'Place at least one chip on the table before spinning.' };
  }

  if (bets.some((b) => !Number.isFinite(b.amount) || b.amount <= 0)) {
    return { valid: false, totalWager, reason: 'All placed bets must be positive amounts.' };
  }

  if (totalWager > balance) {
    return { valid: false, totalWager, reason: 'Insufficient credits for the total table wager.' };
  }

  if (totalWager < minBet) {
    return {
      valid: false,
      totalWager,
      reason: `Minimum table wager is ${minBet.toLocaleString()} credits.`,
    };
  }

  if (totalWager > maxBet) {
    return {
      valid: false,
      totalWager,
      reason: `Maximum table wager is ${maxBet.toLocaleString()} credits.`,
    };
  }

  return { valid: true, totalWager };
}
