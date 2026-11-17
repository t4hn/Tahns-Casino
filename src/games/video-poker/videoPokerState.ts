import { Card, createDeck, drawCard, shuffleDeck } from '../blackjack/deck';
import {
  evaluatePokerHand,
  PokerHandEvaluation,
  resolveVideoPokerHand,
  VideoPokerResolution,
} from './videoPokerRules';

export type VideoPokerPhase = 'READY' | 'DEALT' | 'DRAWING' | 'SETTLED';

export interface VideoPokerGameState {
  roundId: string;
  phase: VideoPokerPhase;
  deck: Card[];
  hand: Card[];
  heldIndices: boolean[];
  replacedIndices: number[];
  bet: number;
  initialEvaluation: PokerHandEvaluation | null;
  resolution: VideoPokerResolution | null;
  settlementClaimed: boolean;
}

export function createInitialVideoPokerState(): VideoPokerGameState {
  return {
    roundId: '',
    phase: 'READY',
    deck: [],
    hand: [],
    heldIndices: [false, false, false, false, false],
    replacedIndices: [],
    bet: 0,
    initialEvaluation: null,
    resolution: null,
    settlementClaimed: false,
  };
}

/**
 * Deals a fresh 5-card hand from a newly shuffled 52-card deck.
 * Computes the stand-pat payout so escrow persistence reflects the current hand if interrupted before draw.
 */
export function dealInitialPokerHand(
  wager: number,
  customRng?: () => number,
  roundId: string = `vp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
): {
  state: VideoPokerGameState;
  standPatPayout: number;
} {
  let deck = shuffleDeck(createDeck(), customRng);
  const hand: Card[] = [];

  for (let i = 0; i < 5; i++) {
    const drawn = drawCard(deck);
    hand.push(drawn.card);
    deck = drawn.remainingDeck;
  }

  const initialEvaluation = evaluatePokerHand(hand);
  const standPatResolution = resolveVideoPokerHand(hand, wager);

  return {
    state: {
      roundId,
      phase: 'DEALT',
      deck,
      hand,
      heldIndices: [false, false, false, false, false],
      replacedIndices: [],
      bet: wager,
      initialEvaluation,
      resolution: null,
      settlementClaimed: false,
    },
    standPatPayout: standPatResolution.totalPayout,
  };
}

/**
 * Toggles HOLD status for a card at index 0..4 while in the DEALT phase.
 */
export function toggleHoldCard(
  state: VideoPokerGameState,
  index: number
): VideoPokerGameState {
  if (state.phase !== 'DEALT') {
    return state;
  }
  if (index < 0 || index >= state.hand.length) {
    throw new Error(`Invalid card index ${index} for hold toggle.`);
  }

  const nextHeld = [...state.heldIndices];
  nextHeld[index] = !nextHeld[index];

  return {
    ...state,
    heldIndices: nextHeld,
  };
}

/**
 * Replaces all unheld cards from the remaining deck and evaluates the final 5-card hand.
 * Throws if called outside the DEALT phase (preventing duplicate draws).
 */
export function drawReplacementCards(state: VideoPokerGameState): {
  state: VideoPokerGameState;
  resolution: VideoPokerResolution;
  replacedIndices: number[];
} {
  if (state.phase !== 'DEALT') {
    throw new Error(`Cannot draw cards during phase "${state.phase}".`);
  }

  let currentDeck = [...state.deck];
  const nextHand = [...state.hand];
  const replacedIndices: number[] = [];

  for (let i = 0; i < 5; i++) {
    if (!state.heldIndices[i]) {
      const drawn = drawCard(currentDeck);
      nextHand[i] = drawn.card;
      currentDeck = drawn.remainingDeck;
      replacedIndices.push(i);
    }
  }

  const resolution = resolveVideoPokerHand(nextHand, state.bet);

  return {
    state: {
      ...state,
      phase: 'DRAWING',
      deck: currentDeck,
      hand: nextHand,
      replacedIndices,
      resolution,
    },
    resolution,
    replacedIndices,
  };
}

/**
 * Claims settlement once per round to guarantee a player cannot receive multiple payouts for one hand.
 */
export function claimVideoPokerSettlement(state: VideoPokerGameState): {
  state: VideoPokerGameState;
  claimed: boolean;
} {
  if (state.settlementClaimed) {
    return { state, claimed: false };
  }

  return {
    state: {
      ...state,
      phase: 'SETTLED',
      settlementClaimed: true,
    },
    claimed: true,
  };
}
