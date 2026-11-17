import { Card, Rank, SUITS, RANKS } from '../blackjack/deck';
import { isValidBet } from '../shared/betValidation';

export type PokerHandCategory =
  | 'royal_flush'
  | 'straight_flush'
  | 'four_of_a_kind'
  | 'full_house'
  | 'flush'
  | 'straight'
  | 'three_of_a_kind'
  | 'two_pair'
  | 'jacks_or_better'
  | 'none';

export interface PaytableEntry {
  category: Exclude<PokerHandCategory, 'none'>;
  name: string;
  odds: number; // Winnings multiplier relative to wager (e.g. 9 means 9:1 winnings, 10x total return)
}

/**
 * Standard 9/6 Jacks or Better paytable (winnings relative to wager).
 * Sorted from highest payout to lowest.
 */
export const JACKS_OR_BETTER_PAYTABLE: readonly PaytableEntry[] = [
  { category: 'royal_flush', name: 'Royal Flush', odds: 250 },
  { category: 'straight_flush', name: 'Straight Flush', odds: 50 },
  { category: 'four_of_a_kind', name: 'Four of a Kind', odds: 25 },
  { category: 'full_house', name: 'Full House', odds: 9 },
  { category: 'flush', name: 'Flush', odds: 6 },
  { category: 'straight', name: 'Straight', odds: 4 },
  { category: 'three_of_a_kind', name: 'Three of a Kind', odds: 3 },
  { category: 'two_pair', name: 'Two Pair', odds: 2 },
  { category: 'jacks_or_better', name: 'Jacks or Better', odds: 1 },
] as const;

const PAYTABLE_BY_CATEGORY = new Map<PokerHandCategory, PaytableEntry>(
  JACKS_OR_BETTER_PAYTABLE.map((entry) => [entry.category, entry])
);

const RANK_VALUES: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

const VALID_RANKS = new Set<string>(RANKS);
const VALID_SUITS = new Set<string>(SUITS);

export interface PokerHandEvaluation {
  category: PokerHandCategory;
  name: string;
  odds: number;
  won: boolean;
  winningCardIndices: number[];
}

export interface VideoPokerResolution extends PokerHandEvaluation {
  wager: number;
  netWinnings: number;
  totalPayout: number;
}

/**
 * Validates that a poker hand contains exactly 5 unique, valid playing cards.
 * Throws a clear Error on malformed or duplicate hands.
 */
export function validatePokerHand(cards: readonly Card[]): void {
  if (!Array.isArray(cards) || cards.length !== 5) {
    throw new Error(
      `Invalid poker hand: expected exactly 5 cards, received ${Array.isArray(cards) ? cards.length : typeof cards}.`
    );
  }

  const seen = new Set<string>();
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (!card || typeof card !== 'object') {
      throw new Error(`Invalid card at index ${i}: expected Card object.`);
    }
    if (!VALID_RANKS.has(card.rank)) {
      throw new Error(`Invalid card rank "${String(card.rank)}" at index ${i}.`);
    }
    if (!VALID_SUITS.has(card.suit)) {
      throw new Error(`Invalid card suit "${String(card.suit)}" at index ${i}.`);
    }
    const key = `${card.rank}_${card.suit}`;
    if (seen.has(key)) {
      throw new Error(`Invalid poker hand: duplicate card ${card.rank} of ${card.suit}.`);
    }
    seen.add(key);
  }
}

/**
 * Checks whether 5 distinct rank values form a straight (including A-2-3-4-5 wheel and 10-J-Q-K-A broadway).
 */
function checkStraight(distinctSortedAsc: readonly number[]): {
  isStraight: boolean;
  isRoyalSequence: boolean;
} {
  if (distinctSortedAsc.length !== 5) {
    return { isStraight: false, isRoyalSequence: false };
  }

  const [v0, v1, v2, v3, v4] = distinctSortedAsc;

  // Standard consecutive 5-card sequence (covers 2-3-4-5-6 up to 10-J-Q-K-A)
  if (v4 - v0 === 4 && v1 === v0 + 1 && v2 === v1 + 1 && v3 === v2 + 1) {
    const isRoyalSequence = v0 === 10 && v4 === 14;
    return { isStraight: true, isRoyalSequence };
  }

  // Ace-low wheel straight: A-2-3-4-5 -> sorted values [2, 3, 4, 5, 14]
  if (v0 === 2 && v1 === 3 && v2 === 4 && v3 === 5 && v4 === 14) {
    return { isStraight: true, isRoyalSequence: false };
  }

  return { isStraight: false, isRoyalSequence: false };
}

/**
 * Evaluates a 5-card Jacks or Better Video Poker hand.
 * Pure, deterministic, and guarantees mutually exclusive category detection.
 */
export function evaluatePokerHand(cards: readonly Card[]): PokerHandEvaluation {
  validatePokerHand(cards);

  const rankCounts = new Map<Rank, number[]>();
  const firstSuit = cards[0].suit;
  let isFlush = true;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (card.suit !== firstSuit) {
      isFlush = false;
    }
    const indices = rankCounts.get(card.rank);
    if (indices) {
      indices.push(i);
    } else {
      rankCounts.set(card.rank, [i]);
    }
  }

  // Sort rank groups by multiplicity descending, then rank value descending
  const groups = Array.from(rankCounts.entries())
    .map(([rank, indices]) => ({
      rank,
      value: RANK_VALUES[rank],
      count: indices.length,
      indices,
    }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

  const countsSignature = groups.map((g) => g.count).join(',');
  const allIndices = [0, 1, 2, 3, 4];

  // Straight / Flush checks only apply when all 5 ranks are distinct
  let isStraight = false;
  let isRoyalSequence = false;
  if (groups.length === 5) {
    const sortedAsc = groups.map((g) => g.value).sort((a, b) => a - b);
    const straightCheck = checkStraight(sortedAsc);
    isStraight = straightCheck.isStraight;
    isRoyalSequence = straightCheck.isRoyalSequence;
  }

  // Evaluate strictly from highest category to lowest (no overlapping false positives)
  if (isFlush && isStraight && isRoyalSequence) {
    const entry = PAYTABLE_BY_CATEGORY.get('royal_flush')!;
    return {
      category: 'royal_flush',
      name: entry.name,
      odds: entry.odds,
      won: true,
      winningCardIndices: allIndices,
    };
  }

  if (isFlush && isStraight) {
    const entry = PAYTABLE_BY_CATEGORY.get('straight_flush')!;
    return {
      category: 'straight_flush',
      name: entry.name,
      odds: entry.odds,
      won: true,
      winningCardIndices: allIndices,
    };
  }

  if (countsSignature === '4,1') {
    const entry = PAYTABLE_BY_CATEGORY.get('four_of_a_kind')!;
    return {
      category: 'four_of_a_kind',
      name: entry.name,
      odds: entry.odds,
      won: true,
      winningCardIndices: [...groups[0].indices],
    };
  }

  if (countsSignature === '3,2') {
    const entry = PAYTABLE_BY_CATEGORY.get('full_house')!;
    return {
      category: 'full_house',
      name: entry.name,
      odds: entry.odds,
      won: true,
      winningCardIndices: allIndices,
    };
  }

  if (isFlush) {
    const entry = PAYTABLE_BY_CATEGORY.get('flush')!;
    return {
      category: 'flush',
      name: entry.name,
      odds: entry.odds,
      won: true,
      winningCardIndices: allIndices,
    };
  }

  if (isStraight) {
    const entry = PAYTABLE_BY_CATEGORY.get('straight')!;
    return {
      category: 'straight',
      name: entry.name,
      odds: entry.odds,
      won: true,
      winningCardIndices: allIndices,
    };
  }

  if (countsSignature === '3,1,1') {
    const entry = PAYTABLE_BY_CATEGORY.get('three_of_a_kind')!;
    return {
      category: 'three_of_a_kind',
      name: entry.name,
      odds: entry.odds,
      won: true,
      winningCardIndices: [...groups[0].indices],
    };
  }

  if (countsSignature === '2,2,1') {
    const entry = PAYTABLE_BY_CATEGORY.get('two_pair')!;
    return {
      category: 'two_pair',
      name: entry.name,
      odds: entry.odds,
      won: true,
      winningCardIndices: [...groups[0].indices, ...groups[1].indices].sort((a, b) => a - b),
    };
  }

  if (countsSignature === '2,1,1,1') {
    const pairGroup = groups[0];
    if (pairGroup.value >= RANK_VALUES.J) {
      const entry = PAYTABLE_BY_CATEGORY.get('jacks_or_better')!;
      return {
        category: 'jacks_or_better',
        name: entry.name,
        odds: entry.odds,
        won: true,
        winningCardIndices: [...pairGroup.indices],
      };
    }

    return {
      category: 'none',
      name: 'Low Pair (No Pay)',
      odds: 0,
      won: false,
      winningCardIndices: [],
    };
  }

  return {
    category: 'none',
    name: 'No Winning Hand',
    odds: 0,
    won: false,
    winningCardIndices: [],
  };
}

/**
 * Calculates Video Poker payout using the shared casino economy convention:
 * - Paytable odds (e.g. 9:1) represent net winnings relative to the wager.
 * - On any winning hand, totalPayout = wager + (wager * odds) = wager * (odds + 1).
 * - On a non-winning hand, totalPayout = 0 (net = -wager).
 */
export function calculateVideoPokerPayout(
  category: PokerHandCategory,
  wager: number
): { netWinnings: number; totalPayout: number; odds: number } {
  if (wager <= 0 || category === 'none') {
    return { netWinnings: 0, totalPayout: 0, odds: 0 };
  }

  const entry = PAYTABLE_BY_CATEGORY.get(category);
  if (!entry) {
    return { netWinnings: 0, totalPayout: 0, odds: 0 };
  }

  const netWinnings = Math.round(wager * entry.odds);
  const totalPayout = wager + netWinnings;

  return {
    netWinnings,
    totalPayout,
    odds: entry.odds,
  };
}

/**
 * Evaluates a 5-card hand and computes its full payout resolution for a given wager.
 */
export function resolveVideoPokerHand(
  cards: readonly Card[],
  wager: number
): VideoPokerResolution {
  const evaluation = evaluatePokerHand(cards);
  const { netWinnings, totalPayout } = calculateVideoPokerPayout(evaluation.category, wager);

  return {
    ...evaluation,
    wager,
    netWinnings,
    totalPayout,
  };
}

/**
 * Validates a Video Poker wager against table limits and patron balance.
 */
export function isValidVideoPokerBet(
  bet: number,
  minBet: number,
  maxBet: number,
  balance: number
): { valid: boolean; reason?: string } {
  if (!Number.isFinite(bet) || !Number.isInteger(bet)) {
    return { valid: false, reason: 'Wager must be a whole number.' };
  }
  return isValidBet(bet, minBet, maxBet, balance);
}
