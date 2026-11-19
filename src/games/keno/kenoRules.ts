/**
 * Pure 80-Ball Keno Rules, Uniform Draw RNG, Paytable, and Analytical RTP.
 * Zero React or DOM dependencies.
 */

import { randomInt } from '../shared/rng';
import { isValidBet } from '../shared/betValidation';

export const KENO_MIN_NUMBER = 1;
export const KENO_MAX_NUMBER = 80;
export const KENO_POOL_SIZE = 80;
export const KENO_DRAW_COUNT = 20;
export const KENO_MIN_SPOTS = 1;
export const KENO_MAX_SPOTS = 10;
export const KENO_DEFAULT_QUICK_PICK_SPOTS = 6;
export const KENO_CHIP_PRESETS = [10, 20, 50, 100, 250] as const;

/**
 * Conventional casino 80-ball Keno paytable expressed as GROSS stake multipliers
 * (payout = round(wager * multiplier)).
 * - 0 means losing hit count (returns 0 credits).
 * - 1 means stake returned (push, net 0).
 * - >1 includes original stake plus net profit.
 *
 * Calibrated across all 1–10 spot counts via exact hypergeometric probabilities
 * to yield ~92.6%–95.3% theoretical RTP (average ~94.0%).
 */
export const KENO_PAYTABLE: Readonly<Record<number, Readonly<Record<number, number>>>> = {
  1: { 1: 3.8 },
  2: { 2: 15.8 },
  3: { 2: 2, 3: 48 },
  4: { 2: 1, 3: 6, 4: 155 },
  5: { 3: 3, 4: 24, 5: 600 },
  6: { 3: 2, 4: 8, 5: 80, 6: 1500 },
  7: { 3: 1, 4: 4, 5: 25, 6: 350, 7: 3500 },
  8: { 4: 2, 5: 17, 6: 100, 7: 1100, 8: 9000 },
  9: { 4: 1, 5: 7, 6: 48, 7: 350, 8: 3000, 9: 15000 },
  10: { 5: 4, 6: 25, 7: 160, 8: 1200, 9: 6000, 10: 25000 },
};

export interface PaytableRow {
  hits: number;
  multiplier: number;
}

export interface KenoEvaluation {
  selectedNumbers: number[];
  drawnNumbers: number[];
  matchedNumbers: number[];
  spotCount: number;
  hits: number;
  multiplier: number;
  wager: number;
  grossPayout: number;
  net: number;
  isWin: boolean;
  isPush: boolean;
}

function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  const effectiveK = Math.min(k, n - k);
  for (let i = 1; i <= effectiveK; i++) {
    result = (result * (n - i + 1)) / i;
  }
  return result;
}

/**
 * Exact hypergeometric probability of hitting `hits` out of `spotCount`
 * when 20 unique balls are drawn uniformly from 1..80.
 */
export function calculateKenoHitProbability(spotCount: number, hits: number): number {
  if (
    spotCount < KENO_MIN_SPOTS ||
    spotCount > KENO_MAX_SPOTS ||
    hits < 0 ||
    hits > spotCount
  ) {
    return 0;
  }
  const totalDraws = combinations(KENO_POOL_SIZE, KENO_DRAW_COUNT);
  const hitWays = combinations(spotCount, hits);
  const missWays = combinations(KENO_POOL_SIZE - spotCount, KENO_DRAW_COUNT - hits);
  return (hitWays * missWays) / totalDraws;
}

/**
 * Analytical theoretical RTP for a given spot count (0..1 scale, e.g. 0.94 = 94.0%).
 */
export function calculateKenoAnalyticalRtp(spotCount: number): number {
  const schedule = KENO_PAYTABLE[spotCount];
  if (!schedule) return 0;
  let expectedReturn = 0;
  for (const [hitsStr, multiplier] of Object.entries(schedule)) {
    const hits = Number(hitsStr);
    expectedReturn += calculateKenoHitProbability(spotCount, hits) * multiplier;
  }
  return expectedReturn;
}

/**
 * Average theoretical RTP across all 1–10 spot selections.
 */
export function calculateKenoAverageRtp(): number {
  let total = 0;
  for (let spots = KENO_MIN_SPOTS; spots <= KENO_MAX_SPOTS; spots++) {
    total += calculateKenoAnalyticalRtp(spots);
  }
  return total / (KENO_MAX_SPOTS - KENO_MIN_SPOTS + 1);
}

/**
 * Returns the sorted paying hit tiers for a given spot count.
 */
export function getKenoPaytableForSpots(spotCount: number): PaytableRow[] {
  const schedule = KENO_PAYTABLE[spotCount];
  if (!schedule) return [];
  return Object.entries(schedule)
    .map(([hitsStr, multiplier]) => ({
      hits: Number(hitsStr),
      multiplier,
    }))
    .sort((a, b) => a.hits - b.hits);
}

export function getKenoMultiplier(spotCount: number, hits: number): number {
  const schedule = KENO_PAYTABLE[spotCount];
  if (!schedule) return 0;
  return schedule[hits] ?? 0;
}

export function isValidKenoNumber(num: number): boolean {
  return Number.isInteger(num) && num >= KENO_MIN_NUMBER && num <= KENO_MAX_NUMBER;
}

/**
 * Deduplicates, validates range (1..80), caps at 10 spots, and sorts ascending.
 */
export function normalizeKenoSelection(numbers: number[]): number[] {
  const seen = new Set<number>();
  for (const num of numbers) {
    if (!isValidKenoNumber(num)) continue;
    seen.add(num);
    if (seen.size >= KENO_MAX_SPOTS) break;
  }
  return Array.from(seen).sort((a, b) => a - b);
}

/**
 * Toggles a single number (1..80) in the player's Keno ticket.
 * Blocks adding more than 10 numbers.
 */
export function toggleKenoNumber(
  selected: number[],
  num: number
): { selected: number[]; changed: boolean; reason?: string } {
  if (!isValidKenoNumber(num)) {
    return { selected, changed: false, reason: 'Number must be between 1 and 80.' };
  }

  const normalized = normalizeKenoSelection(selected);
  if (normalized.includes(num)) {
    return {
      selected: normalized.filter((n) => n !== num),
      changed: true,
    };
  }

  if (normalized.length >= KENO_MAX_SPOTS) {
    return {
      selected: normalized,
      changed: false,
      reason: `You can select up to ${KENO_MAX_SPOTS} numbers per ticket.`,
    };
  }

  return {
    selected: [...normalized, num].sort((a, b) => a - b),
    changed: true,
  };
}

/**
 * Draws `count` unique numbers uniformly without replacement from 1..80
 * using partial Fisher-Yates shuffle over cryptographically secure `randomInt`.
 */
function drawUniqueWithoutReplacement(count: number, customRng?: () => number): number[] {
  const pool = Array.from({ length: KENO_POOL_SIZE }, (_, idx) => idx + 1);
  const safeCount = Math.max(0, Math.min(KENO_POOL_SIZE, Math.floor(count)));
  const drawn: number[] = [];

  for (let i = 0; i < safeCount; i++) {
    const remaining = pool.length - i;
    const pickedOffset = randomInt(remaining, customRng);
    const swapIndex = i + pickedOffset;
    const pickedValue = pool[swapIndex];
    pool[swapIndex] = pool[i];
    pool[i] = pickedValue;
    drawn.push(pickedValue);
  }

  return drawn;
}

/**
 * Generates a sorted Quick Pick selection of `spotCount` (clamped 1..10) unique numbers.
 */
export function generateQuickPick(spotCount: number, customRng?: () => number): number[] {
  const safeCount = Number.isFinite(spotCount) ? spotCount : KENO_DEFAULT_QUICK_PICK_SPOTS;
  const clampedCount = Math.max(
    KENO_MIN_SPOTS,
    Math.min(KENO_MAX_SPOTS, Math.round(safeCount))
  );
  return drawUniqueWithoutReplacement(clampedCount, customRng).sort((a, b) => a - b);
}

/**
 * Draws exactly 20 unique numbers uniformly without replacement from 1..80.
 * Preserves sequential draw order for chamber animation.
 */
export function drawKenoNumbers(customRng?: () => number): number[] {
  return drawUniqueWithoutReplacement(KENO_DRAW_COUNT, customRng);
}

/**
 * Validates player selection and wager before starting a round.
 */
export function validateKenoRound(
  selected: number[],
  wager: number,
  minBet: number,
  maxBet: number,
  balance: number
): { valid: boolean; reason?: string } {
  if (!Array.isArray(selected) || selected.length < KENO_MIN_SPOTS) {
    return { valid: false, reason: 'Select at least 1 number (up to 10) to play Keno.' };
  }
  if (selected.length > KENO_MAX_SPOTS) {
    return { valid: false, reason: `Maximum ${KENO_MAX_SPOTS} numbers allowed per ticket.` };
  }

  const unique = new Set<number>();
  for (const num of selected) {
    if (!isValidKenoNumber(num)) {
      return { valid: false, reason: 'All selected numbers must be integers from 1 to 80.' };
    }
    if (unique.has(num)) {
      return { valid: false, reason: 'Duplicate numbers are not permitted on a Keno ticket.' };
    }
    unique.add(num);
  }

  return isValidBet(wager, minBet, maxBet, balance);
}

/**
 * Evaluates a Keno round purely from the selected numbers, actual 20-number draw, and wager.
 * Gross payout includes the original stake on winning/push hits and equals 0 on loss.
 */
export function evaluateKenoRound(
  selected: number[],
  drawnNumbers: number[],
  wager: number
): KenoEvaluation {
  const cleanSelected = normalizeKenoSelection(selected);
  if (cleanSelected.length < KENO_MIN_SPOTS) {
    throw new Error('Cannot evaluate Keno round without at least 1 selected number.');
  }

  const drawSet = new Set<number>();
  const cleanDrawn: number[] = [];
  for (const n of drawnNumbers) {
    if (!isValidKenoNumber(n) || drawSet.has(n)) continue;
    drawSet.add(n);
    cleanDrawn.push(n);
  }
  if (cleanDrawn.length !== KENO_DRAW_COUNT) {
    throw new Error(`Keno draw must contain exactly ${KENO_DRAW_COUNT} unique numbers.`);
  }

  const matchedNumbers = cleanSelected.filter((num) => drawSet.has(num));
  const spotCount = cleanSelected.length;
  const hits = matchedNumbers.length;
  const multiplier = getKenoMultiplier(spotCount, hits);
  const grossPayout = wager > 0 ? Math.round(wager * multiplier) : 0;
  const net = grossPayout - wager;

  return {
    selectedNumbers: cleanSelected,
    drawnNumbers: cleanDrawn,
    matchedNumbers,
    spotCount,
    hits,
    multiplier,
    wager,
    grossPayout,
    net,
    isWin: net > 0,
    isPush: net === 0 && grossPayout > 0,
  };
}
