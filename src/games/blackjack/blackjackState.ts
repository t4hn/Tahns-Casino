import { Card, createDeck, drawCard, shuffleDeck } from './deck';
import {
  BlackjackResolution,
  evaluateHand,
  playDealerHand,
  resolveBlackjackHand,
} from './blackjackRules';

export type BlackjackPhase =
  | 'BETTING'
  | 'DEALING'
  | 'PLAYER_TURN'
  | 'DEALER_TURN'
  | 'SETTLED';

export interface BlackjackGameState {
  roundId: string;
  phase: BlackjackPhase;
  deck: Card[];
  playerCards: Card[];
  dealerCards: Card[];
  dealerHoleHidden: boolean;
  initialBet: number;
  currentBet: number;
  doubledDown: boolean;
  resolution: BlackjackResolution | null;
  settlementClaimed: boolean;
}

export function createInitialBlackjackState(): BlackjackGameState {
  return {
    roundId: '',
    phase: 'BETTING',
    deck: [],
    playerCards: [],
    dealerCards: [],
    dealerHoleHidden: true,
    initialBet: 0,
    currentBet: 0,
    doubledDown: false,
    resolution: null,
    settlementClaimed: false,
  };
}

/**
 * Simulates standing immediately on current player cards and playing out dealer's turn from deck.
 * Used to persist an accurate predetermined payout in escrow if the player refreshes or leaves mid-hand.
 */
export function computeAutoStandPayout(
  playerCards: readonly Card[],
  dealerCards: readonly Card[],
  deck: readonly Card[],
  wager: number
): number {
  const playerEval = evaluateHand(playerCards);
  if (playerEval.isBust) {
    return 0;
  }
  if (playerEval.isNaturalBlackjack || evaluateHand(dealerCards).isNaturalBlackjack) {
    return resolveBlackjackHand(playerCards, dealerCards, wager).payout;
  }
  const { dealerCards: finalDealer } = playDealerHand(dealerCards, deck);
  return resolveBlackjackHand(playerCards, finalDealer, wager).payout;
}

/**
 * Deals a fresh single-deck hand: 2 cards to player, 2 cards to dealer (1 hidden).
 * Checks immediately for Natural Blackjack on either or both sides.
 */
export function dealInitialHand(
  wager: number,
  customRng?: () => number,
  roundId: string = `bj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
): {
  state: BlackjackGameState;
  predeterminedAutoStandPayout: number;
  immediateNaturalResolution: boolean;
} {
  const shuffled = shuffleDeck(createDeck(), customRng);

  // Standard alternating deal: P1, D1 (up), P2, D2 (hole)
  const d1 = drawCard(shuffled);
  const d2 = drawCard(d1.remainingDeck);
  const d3 = drawCard(d2.remainingDeck);
  const d4 = drawCard(d3.remainingDeck);

  const playerCards = [d1.card, d3.card];
  const dealerCards = [d2.card, d4.card];
  const remainingDeck = d4.remainingDeck;

  const playerEval = evaluateHand(playerCards);
  const dealerEval = evaluateHand(dealerCards);
  const hasNaturalBlackjack =
    playerEval.isNaturalBlackjack || dealerEval.isNaturalBlackjack;

  if (hasNaturalBlackjack) {
    const resolution = resolveBlackjackHand(playerCards, dealerCards, wager);
    return {
      state: {
        roundId,
        phase: 'DEALING',
        deck: remainingDeck,
        playerCards,
        dealerCards,
        dealerHoleHidden: false,
        initialBet: wager,
        currentBet: wager,
        doubledDown: false,
        resolution,
        settlementClaimed: false,
      },
      predeterminedAutoStandPayout: resolution.payout,
      immediateNaturalResolution: true,
    };
  }

  const autoStandPayout = computeAutoStandPayout(
    playerCards,
    dealerCards,
    remainingDeck,
    wager
  );

  return {
    state: {
      roundId,
      phase: 'PLAYER_TURN',
      deck: remainingDeck,
      playerCards,
      dealerCards,
      dealerHoleHidden: true,
      initialBet: wager,
      currentBet: wager,
      doubledDown: false,
      resolution: null,
      settlementClaimed: false,
    },
    predeterminedAutoStandPayout: autoStandPayout,
    immediateNaturalResolution: false,
  };
}

/**
 * Player Hits: draws 1 card from deck.
 * - If player busts (> 21): resolves immediately as player_bust (payout 0).
 * - If player hits 21: automatically completes dealer turn and resolves.
 * - Otherwise remains in PLAYER_TURN with updated auto-stand escrow payout.
 */
export function playerHit(state: BlackjackGameState): {
  state: BlackjackGameState;
  autoStandPayout: number;
  handResolved: boolean;
  playerBusted: boolean;
  hit21: boolean;
} {
  if (state.phase !== 'PLAYER_TURN') {
    throw new Error(`Cannot hit during phase "${state.phase}".`);
  }

  const { card, remainingDeck } = drawCard(state.deck);
  const nextPlayerCards = [...state.playerCards, card];
  const playerEval = evaluateHand(nextPlayerCards);

  if (playerEval.isBust) {
    const resolution = resolveBlackjackHand(
      nextPlayerCards,
      state.dealerCards,
      state.currentBet
    );
    return {
      state: {
        ...state,
        deck: remainingDeck,
        playerCards: nextPlayerCards,
        dealerHoleHidden: false,
        phase: 'DEALER_TURN',
        resolution,
      },
      autoStandPayout: 0,
      handResolved: true,
      playerBusted: true,
      hit21: false,
    };
  }

  if (playerEval.total === 21) {
    const { dealerCards: finalDealer, remainingDeck: deckAfterDealer } = playDealerHand(
      state.dealerCards,
      remainingDeck
    );
    const resolution = resolveBlackjackHand(
      nextPlayerCards,
      finalDealer,
      state.currentBet
    );
    return {
      state: {
        ...state,
        deck: deckAfterDealer,
        playerCards: nextPlayerCards,
        dealerCards: finalDealer,
        dealerHoleHidden: false,
        phase: 'DEALER_TURN',
        resolution,
      },
      autoStandPayout: resolution.payout,
      handResolved: true,
      playerBusted: false,
      hit21: true,
    };
  }

  const autoStandPayout = computeAutoStandPayout(
    nextPlayerCards,
    state.dealerCards,
    remainingDeck,
    state.currentBet
  );

  return {
    state: {
      ...state,
      deck: remainingDeck,
      playerCards: nextPlayerCards,
    },
    autoStandPayout,
    handResolved: false,
    playerBusted: false,
    hit21: false,
  };
}

/**
 * Player Stands: reveals dealer hole card, plays out dealer hand (>= 17), and computes final resolution.
 */
export function playerStand(state: BlackjackGameState): {
  state: BlackjackGameState;
  resolution: BlackjackResolution;
} {
  if (state.phase !== 'PLAYER_TURN') {
    throw new Error(`Cannot stand during phase "${state.phase}".`);
  }

  const { dealerCards: finalDealer, remainingDeck } = playDealerHand(
    state.dealerCards,
    state.deck
  );
  const resolution = resolveBlackjackHand(
    state.playerCards,
    finalDealer,
    state.currentBet
  );

  return {
    state: {
      ...state,
      deck: remainingDeck,
      dealerCards: finalDealer,
      dealerHoleHidden: false,
      phase: 'DEALER_TURN',
      resolution,
    },
    resolution,
  };
}

/**
 * Checks whether Double Down is legal on the current state and balance.
 */
export function canDoubleDown(state: BlackjackGameState, availableBalance: number): boolean {
  return (
    state.phase === 'PLAYER_TURN' &&
    state.playerCards.length === 2 &&
    !state.doubledDown &&
    availableBalance >= state.initialBet
  );
}

/**
 * Player Doubles Down:
 * - Only allowed on initial 2 cards.
 * - Doubles the wager (currentBet = initialBet * 2).
 * - Draws exactly 1 card.
 * - If player busts, loses immediately; otherwise dealer draws to 17+ and resolves.
 */
export function playerDoubleDown(state: BlackjackGameState): {
  state: BlackjackGameState;
  additionalWager: number;
  resolution: BlackjackResolution;
} {
  if (state.phase !== 'PLAYER_TURN') {
    throw new Error(`Cannot double down during phase "${state.phase}".`);
  }
  if (state.playerCards.length !== 2 || state.doubledDown) {
    throw new Error('Double Down is only permitted on the initial two cards.');
  }

  const additionalWager = state.initialBet;
  const totalBet = state.initialBet + additionalWager;

  const { card, remainingDeck } = drawCard(state.deck);
  const nextPlayerCards = [...state.playerCards, card];
  const playerEval = evaluateHand(nextPlayerCards);

  if (playerEval.isBust) {
    const resolution = resolveBlackjackHand(
      nextPlayerCards,
      state.dealerCards,
      totalBet
    );
    return {
      state: {
        ...state,
        deck: remainingDeck,
        playerCards: nextPlayerCards,
        dealerHoleHidden: false,
        currentBet: totalBet,
        doubledDown: true,
        phase: 'DEALER_TURN',
        resolution,
      },
      additionalWager,
      resolution,
    };
  }

  const { dealerCards: finalDealer, remainingDeck: deckAfterDealer } = playDealerHand(
    state.dealerCards,
    remainingDeck
  );
  const resolution = resolveBlackjackHand(
    nextPlayerCards,
    finalDealer,
    totalBet
  );

  return {
    state: {
      ...state,
      deck: deckAfterDealer,
      playerCards: nextPlayerCards,
      dealerCards: finalDealer,
      dealerHoleHidden: false,
      currentBet: totalBet,
      doubledDown: true,
      phase: 'DEALER_TURN',
      resolution,
    },
    additionalWager,
    resolution,
  };
}

/**
 * Marks a hand as settled once and returns the claim flag.
 * Prevents duplicate settlement if called more than once for the same round.
 */
export function claimSettlement(state: BlackjackGameState): {
  state: BlackjackGameState;
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
