/**
 * Pure European Roulette Round State Machine & Bet Ledger Transitions.
 * No React, no DOM, no side-effects.
 */

import {
  PlacedRouletteBet,
  SpinEvaluation,
  calculateTotalWager,
  evaluateRouletteSpin,
  getRouletteSpot,
  spinRoulettePocket,
  validateRouletteWager,
} from './rouletteRules';

export type RoulettePhase = 'BETTING' | 'SPINNING' | 'SETTLED';

export interface SpinHistoryEntry {
  roundId: string;
  number: number;
  color: 'green' | 'red' | 'black';
  totalWager: number;
  grossPayout: number;
  net: number;
}

export interface RouletteGameState {
  phase: RoulettePhase;
  roundId: string;
  bets: PlacedRouletteBet[];
  previousBets: PlacedRouletteBet[];
  evaluation: SpinEvaluation | null;
  history: SpinHistoryEntry[];
  settled: boolean;
}

let roundCounter = 0;
function nextRoundId(): string {
  roundCounter += 1;
  return `roulette_${Date.now()}_${roundCounter}`;
}

export function createInitialRouletteState(): RouletteGameState {
  return {
    phase: 'BETTING',
    roundId: nextRoundId(),
    bets: [],
    previousBets: [],
    evaluation: null,
    history: [],
    settled: false,
  };
}

/**
 * Adds a chip of `chipValue` to a specific table spot.
 * Prevents adding bets during spinning or exceeding balance/maxBet.
 */
export function placeChipOnSpot(
  state: RouletteGameState,
  spotId: string,
  chipValue: number,
  maxBet: number,
  balance: number
): { state: RouletteGameState; placed: boolean; reason?: string } {
  if (state.phase === 'SPINNING') {
    return { state, placed: false, reason: 'Betting is locked while the wheel is spinning.' };
  }

  if (chipValue <= 0 || !Number.isFinite(chipValue)) {
    return { state, placed: false, reason: 'Invalid chip denomination.' };
  }

  const spot = getRouletteSpot(spotId);
  if (!spot) {
    return { state, placed: false, reason: 'Unknown table bet position.' };
  }

  // If currently viewing a settled round and user taps a spot, start fresh board for the new round
  const baseBets = state.phase === 'SETTLED' ? [] : state.bets;
  const currentTotal = calculateTotalWager(baseBets);

  if (currentTotal + chipValue > balance) {
    return { state, placed: false, reason: 'Insufficient credits to add this chip.' };
  }

  if (currentTotal + chipValue > maxBet) {
    return {
      state,
      placed: false,
      reason: `Cannot exceed table limit of ${maxBet.toLocaleString()} credits.`,
    };
  }

  const existingIdx = baseBets.findIndex((b) => b.spotId === spotId);
  const nextBets =
    existingIdx >= 0
      ? baseBets.map((b, idx) =>
          idx === existingIdx ? { ...b, amount: b.amount + chipValue } : b
        )
      : [
          ...baseBets,
          {
            spotId: spot.id,
            type: spot.type,
            label: spot.label,
            numbers: [...spot.numbers],
            payoutOdds: spot.payoutOdds,
            amount: chipValue,
          },
        ];

  return {
    state: {
      ...state,
      phase: 'BETTING',
      bets: nextBets,
      evaluation: state.phase === 'SETTLED' ? null : state.evaluation,
      settled: false,
    },
    placed: true,
  };
}

/**
 * Removes an entire bet spot from the current betting board.
 */
export function removeBetSpot(
  state: RouletteGameState,
  spotId: string
): RouletteGameState {
  if (state.phase !== 'BETTING') return state;
  return {
    ...state,
    bets: state.bets.filter((b) => b.spotId !== spotId),
  };
}

/**
 * Clears all placed bets on the current board (while preserving previousBets for Repeat).
 */
export function clearTableBets(state: RouletteGameState): RouletteGameState {
  if (state.phase === 'SPINNING') return state;
  return {
    ...state,
    phase: 'BETTING',
    bets: [],
    evaluation: null,
    settled: false,
  };
}

/**
 * Repeats the previous round's bets onto the current table if affordable and within table limits.
 */
export function repeatPreviousTableBets(
  state: RouletteGameState,
  maxBet: number,
  balance: number
): { state: RouletteGameState; repeated: boolean; reason?: string } {
  if (state.phase === 'SPINNING') {
    return { state, repeated: false, reason: 'Betting is locked while the wheel is spinning.' };
  }

  if (state.previousBets.length === 0) {
    return { state, repeated: false, reason: 'No previous round bets to repeat.' };
  }

  const prevTotal = calculateTotalWager(state.previousBets);
  if (prevTotal > balance) {
    return {
      state,
      repeated: false,
      reason: `Insufficient credits to repeat last bet (${prevTotal.toLocaleString()} credits required).`,
    };
  }

  if (prevTotal > maxBet) {
    return {
      state,
      repeated: false,
      reason: `Previous wager exceeds table limit of ${maxBet.toLocaleString()} credits.`,
    };
  }

  const clonedBets = state.previousBets.map((b) => ({
    ...b,
    numbers: [...b.numbers],
  }));

  return {
    state: {
      ...state,
      phase: 'BETTING',
      roundId: state.phase === 'SETTLED' ? nextRoundId() : state.roundId,
      bets: clonedBets,
      evaluation: null,
      settled: false,
    },
    repeated: true,
  };
}

/**
 * Locks the round, determines the winning pocket independently of the animation,
 * evaluates every placed bet, and transitions to SPINNING.
 */
export function startRouletteSpin(
  state: RouletteGameState,
  minBet: number,
  maxBet: number,
  balance: number,
  customRng?: () => number
): { state: RouletteGameState; started: boolean; reason?: string } {
  if (state.phase === 'SPINNING') {
    return { state, started: false, reason: 'A spin is already in progress.' };
  }

  const validation = validateRouletteWager(state.bets, minBet, maxBet, balance);
  if (!validation.valid) {
    return { state, started: false, reason: validation.reason };
  }

  const winningNumber = spinRoulettePocket(customRng);
  const evaluation = evaluateRouletteSpin(state.bets, winningNumber);
  const roundId = nextRoundId();
  const clonedBets = state.bets.map((b) => ({ ...b, numbers: [...b.numbers] }));

  return {
    state: {
      ...state,
      phase: 'SPINNING',
      roundId,
      previousBets: clonedBets,
      evaluation,
      settled: false,
    },
    started: true,
  };
}

/**
 * Transitions from SPINNING to SETTLED atomically, ensuring a given round can only settle once.
 */
export function claimRouletteSettlement(
  state: RouletteGameState
): { state: RouletteGameState; claimed: boolean } {
  if (state.phase !== 'SPINNING' || state.settled || !state.evaluation) {
    return { state, claimed: false };
  }

  const entry: SpinHistoryEntry = {
    roundId: state.roundId,
    number: state.evaluation.winningNumber,
    color: state.evaluation.winningColor,
    totalWager: state.evaluation.totalWager,
    grossPayout: state.evaluation.totalGrossPayout,
    net: state.evaluation.net,
  };

  return {
    state: {
      ...state,
      phase: 'SETTLED',
      settled: true,
      history: [entry, ...state.history.slice(0, 14)],
    },
    claimed: true,
  };
}

/**
 * Clears the settled board to begin placing bets for a fresh round while keeping previousBets and history.
 */
export function startNewRouletteRound(state: RouletteGameState): RouletteGameState {
  if (state.phase === 'SPINNING') return state;
  return {
    ...state,
    phase: 'BETTING',
    roundId: nextRoundId(),
    bets: [],
    evaluation: null,
    settled: false,
  };
}
