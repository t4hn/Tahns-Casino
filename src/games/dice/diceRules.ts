/**
 * Pure Dice Game Rules & Payout Calculation for Tahn's Casino.
 * No React, no DOM, no randomness, no external dependencies.
 */

export type BetType = 'low' | 'high' | 'seven' | 'doubles';

export interface BetOption {
  type: BetType;
  label: string;
  targetDescription: string;
  multiplier: number;
  probability: string;
}

export const MULTIPLIERS: Record<BetType, number> = {
  low: 2.3,
  high: 2.3,
  seven: 5.9,
  doubles: 5.9,
};

export const BET_OPTIONS: BetOption[] = [
  {
    type: 'low',
    label: 'Low',
    targetDescription: 'Totals 2 to 6 (7 Loses)',
    multiplier: MULTIPLIERS.low,
    probability: '41.7%',
  },
  {
    type: 'seven',
    label: 'Lucky 7',
    targetDescription: 'Total exactly 7',
    multiplier: MULTIPLIERS.seven,
    probability: '16.7%',
  },
  {
    type: 'high',
    label: 'High',
    targetDescription: 'Totals 8 to 12 (7 Loses)',
    multiplier: MULTIPLIERS.high,
    probability: '41.7%',
  },
  {
    type: 'doubles',
    label: 'Doubles',
    targetDescription: 'Any matching pair (1-1 to 6-6)',
    multiplier: MULTIPLIERS.doubles,
    probability: '16.7%',
  },
];

export interface RollResolution {
  total: number;
  isWin: boolean;
  payout: number;
}

/**
 * Resolves a dice roll against a chosen bet type.
 * Multiplier is total return including stake.
 * Payout is rounded to nearest whole credit.
 */
export function resolveRoll(
  betType: BetType,
  d1: number,
  d2: number,
  bet: number
): RollResolution {
  const total = d1 + d2;
  let isWin = false;

  switch (betType) {
    case 'low':
      // Low wins on total 2 through 6. 7 loses.
      isWin = total >= 2 && total <= 6;
      break;
    case 'high':
      // High wins on total 8 through 12. 7 loses.
      isWin = total >= 8 && total <= 12;
      break;
    case 'seven':
      // Seven wins on exact total 7.
      isWin = total === 7;
      break;
    case 'doubles':
      // Doubles win when both dice match.
      isWin = d1 === d2;
      break;
  }

  const payout = isWin ? Math.round(bet * MULTIPLIERS[betType]) : 0;

  return {
    total,
    isWin,
    payout,
  };
}

/**
 * Enumerates all 36 combinations of two 6-sided dice to compute exact RTP.
 */
export function calculateRtp(betType: BetType): number {
  let wins = 0;
  const totalOutcomes = 36;

  for (let d1 = 1; d1 <= 6; d1++) {
    for (let d2 = 1; d2 <= 6; d2++) {
      const res = resolveRoll(betType, d1, d2, 100);
      if (res.isWin) {
        wins++;
      }
    }
  }

  return (wins / totalOutcomes) * MULTIPLIERS[betType];
}

export { isValidBet } from '../shared/betValidation';

