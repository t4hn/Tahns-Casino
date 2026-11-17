import { Card, drawCard, getCardPointValue } from './deck';

export interface HandEvaluation {
  total: number;
  isSoft: boolean;
  isBust: boolean;
  isNaturalBlackjack: boolean;
  displayTotal: string;
}

export type BlackjackOutcomeType =
  | 'player_blackjack'
  | 'dealer_blackjack'
  | 'player_win'
  | 'dealer_win'
  | 'push'
  | 'player_bust'
  | 'dealer_bust';

export interface BlackjackResolution {
  outcome: BlackjackOutcomeType;
  payout: number;
  net: number;
  won: boolean;
  isPush: boolean;
  message: string;
  playerEval: HandEvaluation;
  dealerEval: HandEvaluation;
}

/**
 * Evaluates a Blackjack hand with Ace soft/hard adjustment.
 * Aces count as 11 unless doing so would bust the hand (> 21), in which case they downgrade to 1.
 */
export function evaluateHand(cards: readonly Card[]): HandEvaluation {
  let total = 0;
  let softAces = 0;

  for (const card of cards) {
    const val = getCardPointValue(card.rank);
    total += val;
    if (card.rank === 'A') {
      softAces += 1;
    }
  }

  while (total > 21 && softAces > 0) {
    total -= 10;
    softAces -= 1;
  }

  const isSoft = softAces > 0 && total <= 21;
  const isBust = total > 21;
  const isNaturalBlackjack = cards.length === 2 && total === 21;

  let displayTotal = `${total}`;
  if (isNaturalBlackjack) {
    displayTotal = 'Blackjack';
  } else if (isBust) {
    displayTotal = `Bust (${total})`;
  } else if (isSoft) {
    displayTotal = `Soft ${total}`;
  }

  return {
    total,
    isSoft,
    isBust,
    isNaturalBlackjack,
    displayTotal,
  };
}

/**
 * Dealer hits on 16 or less, and stands on ALL 17s (including soft 17).
 */
export function shouldDealerHit(dealerCards: readonly Card[]): boolean {
  const evaluation = evaluateHand(dealerCards);
  return evaluation.total < 17;
}

/**
 * Plays out the dealer's turn from the top of the provided deck until reaching 17 or higher.
 * Pure and immutable.
 */
export function playDealerHand(
  dealerCards: readonly Card[],
  deck: readonly Card[]
): { dealerCards: Card[]; remainingDeck: Card[] } {
  let currentDealer = [...dealerCards];
  let currentDeck = [...deck];

  while (shouldDealerHit(currentDealer) && currentDeck.length > 0) {
    const { card, remainingDeck } = drawCard(currentDeck);
    currentDealer = [...currentDealer, card];
    currentDeck = remainingDeck;
  }

  return {
    dealerCards: currentDealer,
    remainingDeck: currentDeck,
  };
}

/**
 * Calculates total returned payout (including the original wager) for a given outcome.
 * - Natural Blackjack: 3:2 (wager + 1.5 * wager = 2.5 * wager, rounded to nearest credit)
 * - Normal win / dealer bust: 1:1 (2 * wager)
 * - Push: 1x (wager returned)
 * - Loss / bust: 0
 */
export function calculatePayout(outcome: BlackjackOutcomeType, wager: number): number {
  if (wager <= 0) return 0;

  switch (outcome) {
    case 'player_blackjack':
      return Math.round(wager * 2.5);
    case 'player_win':
    case 'dealer_bust':
      return wager * 2;
    case 'push':
      return wager;
    case 'dealer_blackjack':
    case 'player_bust':
    case 'dealer_win':
      return 0;
  }
}

/**
 * Resolves a completed Blackjack hand between player and dealer.
 * Enforces:
 * - Both natural Blackjacks -> Push
 * - Player natural Blackjack beats dealer's non-natural 21 (and pays 3:2)
 * - Dealer natural Blackjack beats player's non-natural 21
 * - Player bust loses immediately
 * - Dealer bust wins for player
 * - Higher total wins 1:1, equal totals push
 */
export function resolveBlackjackHand(
  playerCards: readonly Card[],
  dealerCards: readonly Card[],
  wager: number
): BlackjackResolution {
  const playerEval = evaluateHand(playerCards);
  const dealerEval = evaluateHand(dealerCards);

  let outcome: BlackjackOutcomeType;
  let message: string;

  if (playerEval.isNaturalBlackjack && dealerEval.isNaturalBlackjack) {
    outcome = 'push';
    message = 'Both Blackjack · Push';
  } else if (playerEval.isNaturalBlackjack) {
    outcome = 'player_blackjack';
    message = 'Blackjack! Pays 3:2';
  } else if (dealerEval.isNaturalBlackjack) {
    outcome = 'dealer_blackjack';
    message = 'Dealer Blackjack';
  } else if (playerEval.isBust) {
    outcome = 'player_bust';
    message = `Bust (${playerEval.total})`;
  } else if (dealerEval.isBust) {
    outcome = 'dealer_bust';
    message = `Dealer Bust (${dealerEval.total})`;
  } else if (playerEval.total > dealerEval.total) {
    outcome = 'player_win';
    message = `${playerEval.total} beats ${dealerEval.total}`;
  } else if (playerEval.total < dealerEval.total) {
    outcome = 'dealer_win';
    message = `Dealer ${dealerEval.total} beats ${playerEval.total}`;
  } else {
    outcome = 'push';
    message = `Push at ${playerEval.total}`;
  }

  const payout = calculatePayout(outcome, wager);
  const net = payout - wager;

  return {
    outcome,
    payout,
    net,
    won: net > 0,
    isPush: outcome === 'push',
    message,
    playerEval,
    dealerEval,
  };
}

/**
 * Validates a Blackjack initial wager against table limits and current patron balance.
 */
export function isValidBlackjackBet(
  bet: number,
  minBet: number,
  maxBet: number,
  balance: number
): { valid: boolean; reason?: string } {
  if (!Number.isFinite(bet) || !Number.isInteger(bet)) {
    return { valid: false, reason: 'Wager must be a whole number.' };
  }
  if (bet <= 0) {
    return { valid: false, reason: 'Wager must be greater than zero.' };
  }
  if (bet > balance) {
    return { valid: false, reason: 'Insufficient credits for this wager.' };
  }
  if (bet < minBet) {
    return { valid: false, reason: `Wager must be at least ${minBet} credits.` };
  }
  if (bet > maxBet) {
    return { valid: false, reason: `Wager cannot exceed ${maxBet} credits.` };
  }
  return { valid: true };
}
