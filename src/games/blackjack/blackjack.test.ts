import { describe, it, expect } from 'vitest';
import {
  Card,
  Rank,
  Suit,
  createDeck,
  shuffleDeck,
  drawCard,
  getCardPointValue,
} from './deck';
import {
  evaluateHand,
  shouldDealerHit,
  playDealerHand,
  calculatePayout,
  resolveBlackjackHand,
  isValidBlackjackBet,
} from './blackjackRules';
import {
  createInitialBlackjackState,
  dealInitialHand,
  playerHit,
  playerStand,
  canDoubleDown,
  playerDoubleDown,
  claimSettlement,
  BlackjackGameState,
} from './blackjackState';
import {
  placeBet as walletPlaceBet,
  resolveRound as walletResolveRound,
  settleRound as walletSettleRound,
  WalletProfile,
} from '../../economy/wallet';

const c = (rank: Rank, suit: Suit = 'spades'): Card => ({
  id: `${rank}_${suit}`,
  rank,
  suit,
});

const createMockProfile = (credits = 1000): WalletProfile => ({
  id: 'test_patron_bj',
  name: 'Tahn',
  avatarUrl: '/images/character_avatar_1793671261002.jpg',
  xp: 0,
  credits,
  gamesPlayed: 0,
  totalWinnings: 0,
  totalLosses: 0,
  createdAt: 1000,
  dailyStreak: 1,
});

describe('Blackjack Deck Utilities', () => {
  it('creates a standard 52-card deck with 52 unique rank/suit combinations', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    const ids = new Set(deck.map((card) => card.id));
    expect(ids.size).toBe(52);
  });

  it('assigns accurate base point values to all ranks', () => {
    expect(getCardPointValue('A')).toBe(11);
    expect(getCardPointValue('K')).toBe(10);
    expect(getCardPointValue('Q')).toBe(10);
    expect(getCardPointValue('J')).toBe(10);
    expect(getCardPointValue('10')).toBe(10);
    expect(getCardPointValue('9')).toBe(9);
    expect(getCardPointValue('2')).toBe(2);
  });

  it('shuffleDeck preserves all 52 cards and supports deterministic RNG without mutating input', () => {
    const original = createDeck();
    const firstOrder = [...original];

    let seed = 0.42;
    const detRng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const shuffled = shuffleDeck(original, detRng);
    expect(original).toEqual(firstOrder); // Input unmutated
    expect(shuffled).toHaveLength(52);
    expect(new Set(shuffled.map((card) => card.id)).size).toBe(52);
    expect(shuffled.map((card) => card.id)).not.toEqual(original.map((card) => card.id));
  });

  it('drawCard removes the top card immutably and throws on empty deck', () => {
    const deck = [c('A', 'spades'), c('K', 'hearts')];
    const { card, remainingDeck } = drawCard(deck);
    expect(card.rank).toBe('A');
    expect(remainingDeck).toHaveLength(1);
    expect(deck).toHaveLength(2);
    expect(() => drawCard([])).toThrow();
  });
});

describe('Blackjack Rules: Ace Handling, Soft Totals & Busts', () => {
  it('counts Ace as 11 when hand total stays <= 21 (soft hand)', () => {
    const evalSoft18 = evaluateHand([c('A', 'spades'), c('7', 'hearts')]);
    expect(evalSoft18.total).toBe(18);
    expect(evalSoft18.isSoft).toBe(true);
    expect(evalSoft18.isBust).toBe(false);
    expect(evalSoft18.displayTotal).toBe('Soft 18');
  });

  it('downgrades Ace from 11 to 1 when counting as 11 would bust (hard hand)', () => {
    const evalHard17 = evaluateHand([c('A', 'spades'), c('6', 'hearts'), c('10', 'clubs')]);
    expect(evalHard17.total).toBe(17);
    expect(evalHard17.isSoft).toBe(false);
    expect(evalHard17.isBust).toBe(false);
    expect(evalHard17.displayTotal).toBe('17');

    const evalHard12 = evaluateHand([c('A', 'spades'), c('6', 'hearts'), c('5', 'diamonds')]);
    expect(evalHard12.total).toBe(12);
    expect(evalHard12.isSoft).toBe(false);
  });

  it('handles multiple Aces accurately (one soft, rest 1, or all 1)', () => {
    const twoAces = evaluateHand([c('A', 'spades'), c('A', 'hearts')]);
    expect(twoAces.total).toBe(12);
    expect(twoAces.isSoft).toBe(true);
    expect(twoAces.displayTotal).toBe('Soft 12');

    const twoAcesPlusNine = evaluateHand([c('A', 'spades'), c('A', 'hearts'), c('9', 'clubs')]);
    expect(twoAcesPlusNine.total).toBe(21);
    expect(twoAcesPlusNine.isSoft).toBe(true);
    expect(twoAcesPlusNine.isNaturalBlackjack).toBe(false); // 3 cards != natural

    const fourAcesPlusTen = evaluateHand([
      c('A', 'spades'),
      c('A', 'hearts'),
      c('A', 'diamonds'),
      c('A', 'clubs'),
      c('10', 'spades'),
    ]);
    expect(fourAcesPlusTen.total).toBe(14);
    expect(fourAcesPlusTen.isSoft).toBe(false);
  });

  it('detects natural Blackjack ONLY on initial 2-card 21', () => {
    const naturalAceKing = evaluateHand([c('A', 'spades'), c('K', 'diamonds')]);
    expect(naturalAceKing.total).toBe(21);
    expect(naturalAceKing.isNaturalBlackjack).toBe(true);
    expect(naturalAceKing.displayTotal).toBe('Blackjack');

    const threeCard21 = evaluateHand([c('7', 'spades'), c('7', 'hearts'), c('7', 'clubs')]);
    expect(threeCard21.total).toBe(21);
    expect(threeCard21.isNaturalBlackjack).toBe(false);
    expect(threeCard21.displayTotal).toBe('21');
  });

  it('flags bust when minimum total exceeds 21', () => {
    const busted = evaluateHand([c('10', 'spades'), c('8', 'hearts'), c('5', 'clubs')]);
    expect(busted.total).toBe(23);
    expect(busted.isBust).toBe(true);
    expect(busted.displayTotal).toBe('Bust (23)');
  });
});

describe('Blackjack Rules: Dealer Play & Hand Resolution', () => {
  it('dealer hits on 16 or less (including Soft 16) and stands on ALL 17s (including Soft 17)', () => {
    expect(shouldDealerHit([c('10', 'spades'), c('6', 'hearts')])).toBe(true);
    expect(shouldDealerHit([c('A', 'spades'), c('5', 'hearts')])).toBe(true); // Soft 16 hits
    expect(shouldDealerHit([c('10', 'spades'), c('7', 'hearts')])).toBe(false); // Hard 17 stands
    expect(shouldDealerHit([c('A', 'spades'), c('6', 'hearts')])).toBe(false); // Soft 17 stands
    expect(shouldDealerHit([c('A', 'spades'), c('8', 'hearts')])).toBe(false); // Soft 19 stands
  });

  it('playDealerHand stops immediately on Soft 17 without drawing extra cards', () => {
    const initialDealer = [c('A', 'spades'), c('6', 'hearts')];
    const deck = [c('4', 'clubs'), c('10', 'diamonds')];
    const result = playDealerHand(initialDealer, deck);
    expect(result.dealerCards).toHaveLength(2);
    expect(result.remainingDeck).toHaveLength(2);
  });

  it('playDealerHand draws sequentially until dealer reaches 17+', () => {
    const initialDealer = [c('10', 'spades'), c('4', 'hearts')];
    const deck = [c('2', 'clubs'), c('5', 'diamonds'), c('K', 'spades')];
    const result = playDealerHand(initialDealer, deck);
    expect(result.dealerCards.map((x) => x.rank)).toEqual(['10', '4', '2', '5']); // 14 -> 16 -> 21
    expect(result.remainingDeck).toHaveLength(1);
  });

  it('calculates exact payouts: 3:2 natural Blackjack, 1:1 win, 1x push, 0 loss', () => {
    expect(calculatePayout('player_blackjack', 100)).toBe(250);
    expect(calculatePayout('player_blackjack', 50)).toBe(125);
    expect(calculatePayout('player_blackjack', 25)).toBe(63); // Math.round(62.5)
    expect(calculatePayout('player_win', 100)).toBe(200);
    expect(calculatePayout('dealer_bust', 100)).toBe(200);
    expect(calculatePayout('push', 100)).toBe(100);
    expect(calculatePayout('dealer_win', 100)).toBe(0);
    expect(calculatePayout('player_bust', 100)).toBe(0);
    expect(calculatePayout('dealer_blackjack', 100)).toBe(0);
  });

  it('natural Blackjack beats dealer non-natural 21 and pays 3:2', () => {
    const player = [c('A', 'spades'), c('J', 'hearts')];
    const dealerNonNatural21 = [c('7', 'spades'), c('7', 'hearts'), c('7', 'diamonds')];
    const res = resolveBlackjackHand(player, dealerNonNatural21, 100);
    expect(res.outcome).toBe('player_blackjack');
    expect(res.won).toBe(true);
    expect(res.payout).toBe(250);
    expect(res.net).toBe(150);
  });

  it('both natural Blackjacks result in a Push', () => {
    const player = [c('A', 'spades'), c('Q', 'hearts')];
    const dealer = [c('10', 'clubs'), c('A', 'diamonds')];
    const res = resolveBlackjackHand(player, dealer, 100);
    expect(res.outcome).toBe('push');
    expect(res.isPush).toBe(true);
    expect(res.won).toBe(false);
    expect(res.payout).toBe(100);
    expect(res.net).toBe(0);
  });

  it('player bust always loses even if dealer hand would also be weak or bust', () => {
    const bustedPlayer = [c('10', 'spades'), c('8', 'hearts'), c('6', 'clubs')]; // 24
    const dealer = [c('10', 'diamonds'), c('6', 'spades')];
    const res = resolveBlackjackHand(bustedPlayer, dealer, 50);
    expect(res.outcome).toBe('player_bust');
    expect(res.payout).toBe(0);
    expect(res.net).toBe(-50);
  });

  it('dealer bust awards 1:1 win to standing player', () => {
    const player = [c('10', 'spades'), c('2', 'hearts')]; // 12
    const bustedDealer = [c('10', 'diamonds'), c('6', 'spades'), c('8', 'clubs')]; // 24
    const res = resolveBlackjackHand(player, bustedDealer, 50);
    expect(res.outcome).toBe('dealer_bust');
    expect(res.won).toBe(true);
    expect(res.payout).toBe(100);
    expect(res.net).toBe(50);
  });
});

describe('Blackjack Wager Validation & State Transitions', () => {
  it('validates Blackjack bets including minBet 25 and rejects invalid amounts', () => {
    expect(isValidBlackjackBet(25, 25, 1000, 500).valid).toBe(true);
    expect(isValidBlackjackBet(100, 25, 1000, 500).valid).toBe(true);
    expect(isValidBlackjackBet(0, 25, 1000, 500).valid).toBe(false);
    expect(isValidBlackjackBet(-25, 25, 1000, 500).valid).toBe(false);
    expect(isValidBlackjackBet(25.5, 25, 1000, 500).valid).toBe(false);
    expect(isValidBlackjackBet(20, 25, 1000, 500).valid).toBe(false);
    expect(isValidBlackjackBet(1200, 25, 1000, 2000).valid).toBe(false);
    expect(isValidBlackjackBet(600, 25, 1000, 500).valid).toBe(false);
  });

  it('dealInitialHand deals 2 cards each and never contains duplicates across cards and deck', () => {
    const { state } = dealInitialHand(50);
    const allIds = [
      ...state.playerCards.map((x) => x.id),
      ...state.dealerCards.map((x) => x.id),
      ...state.deck.map((x) => x.id),
    ];
    expect(state.playerCards).toHaveLength(2);
    expect(state.dealerCards).toHaveLength(2);
    expect(allIds).toHaveLength(52);
    expect(new Set(allIds).size).toBe(52);
  });

  it('playerHit busts immediately on >21 and auto-stands when reaching 21', () => {
    const baseState: BlackjackGameState = {
      ...createInitialBlackjackState(),
      roundId: 'bj_test_hit',
      phase: 'PLAYER_TURN',
      playerCards: [c('10', 'spades'), c('6', 'hearts')],
      dealerCards: [c('9', 'clubs'), c('8', 'diamonds')], // 17
      deck: [c('10', 'diamonds'), c('2', 'clubs')],
      initialBet: 50,
      currentBet: 50,
    };

    const bustResult = playerHit(baseState);
    expect(bustResult.playerBusted).toBe(true);
    expect(bustResult.handResolved).toBe(true);
    expect(bustResult.state.resolution?.outcome).toBe('player_bust');
    expect(bustResult.state.resolution?.payout).toBe(0);

    const hit21State: BlackjackGameState = {
      ...baseState,
      deck: [c('5', 'diamonds'), c('2', 'clubs')], // 16 + 5 = 21 vs dealer 17
    };
    const hit21Result = playerHit(hit21State);
    expect(hit21Result.hit21).toBe(true);
    expect(hit21Result.handResolved).toBe(true);
    expect(hit21Result.state.resolution?.outcome).toBe('player_win');
    expect(hit21Result.state.resolution?.payout).toBe(100);
  });

  it('Double Down is only permitted on initial 2 cards and when balance covers additional wager', () => {
    const twoCardState: BlackjackGameState = {
      ...createInitialBlackjackState(),
      roundId: 'bj_test_dd',
      phase: 'PLAYER_TURN',
      playerCards: [c('5', 'spades'), c('6', 'hearts')], // 11
      dealerCards: [c('10', 'clubs'), c('7', 'diamonds')], // 17
      deck: [c('10', 'diamonds'), c('2', 'clubs')],
      initialBet: 50,
      currentBet: 50,
    };

    expect(canDoubleDown(twoCardState, 50)).toBe(true);
    expect(canDoubleDown(twoCardState, 49)).toBe(false);

    const ddOutcome = playerDoubleDown(twoCardState);
    expect(ddOutcome.additionalWager).toBe(50);
    expect(ddOutcome.state.currentBet).toBe(100);
    expect(ddOutcome.state.doubledDown).toBe(true);
    expect(ddOutcome.state.playerCards).toHaveLength(3); // Draws exactly 1 card
    expect(ddOutcome.resolution.outcome).toBe('player_win'); // 21 vs 17
    expect(ddOutcome.resolution.payout).toBe(200);

    // Cannot double down a second time or with 3 cards
    expect(canDoubleDown(ddOutcome.state, 500)).toBe(false);
    const threeCardState: BlackjackGameState = {
      ...twoCardState,
      playerCards: [c('5', 'spades'), c('4', 'hearts'), c('2', 'clubs')],
    };
    expect(canDoubleDown(threeCardState, 500)).toBe(false);
    expect(() => playerDoubleDown(threeCardState)).toThrow();
  });

  it('playerStand reveals dealer hole card and plays dealer to 17+', () => {
    const state: BlackjackGameState = {
      ...createInitialBlackjackState(),
      roundId: 'bj_test_stand',
      phase: 'PLAYER_TURN',
      playerCards: [c('10', 'spades'), c('9', 'hearts')], // 19
      dealerCards: [c('10', 'clubs'), c('5', 'diamonds')], // 15
      deck: [c('3', 'hearts'), c('9', 'spades')], // Draws 3 -> 18
      initialBet: 100,
      currentBet: 100,
    };

    const stood = playerStand(state);
    expect(stood.state.dealerHoleHidden).toBe(false);
    expect(stood.state.dealerCards).toHaveLength(3);
    expect(stood.resolution.outcome).toBe('player_win');
    expect(stood.resolution.payout).toBe(200);
  });

  it('prevents duplicate settlement for the same round via claimSettlement', () => {
    const state: BlackjackGameState = {
      ...createInitialBlackjackState(),
      roundId: 'bj_once',
      phase: 'DEALER_TURN',
    };
    const first = claimSettlement(state);
    expect(first.claimed).toBe(true);
    expect(first.state.phase).toBe('SETTLED');
    expect(first.state.settlementClaimed).toBe(true);

    const second = claimSettlement(first.state);
    expect(second.claimed).toBe(false);
  });
});

describe('Blackjack Wallet & Escrow Economy Integration', () => {
  it('escrow placeBet + resolveRound matches settleRound for Blackjack 3:2 win, push, and Double Down', () => {
    // 1. Natural Blackjack 3:2 on 50 bet -> payout 125, net +75
    const start1 = createMockProfile(1000);
    const escrowBet1 = walletPlaceBet(start1, 50);
    expect(escrowBet1.success).toBe(true);
    expect(escrowBet1.profile.credits).toBe(950);

    const escrowResolved1 = walletResolveRound(escrowBet1.profile, 50, 125);
    const singleShot1 = walletSettleRound(start1, 50, 125);
    expect(escrowResolved1.profile).toEqual(singleShot1.profile);
    expect(escrowResolved1.profile.credits).toBe(1075);
    expect(escrowResolved1.profile.totalWinnings).toBe(75);

    // 2. Push on 50 bet -> payout 50, net 0
    const escrowBet2 = walletPlaceBet(start1, 50);
    const escrowResolved2 = walletResolveRound(escrowBet2.profile, 50, 50);
    const singleShot2 = walletSettleRound(start1, 50, 50);
    expect(escrowResolved2.profile).toEqual(singleShot2.profile);
    expect(escrowResolved2.profile.credits).toBe(1000);
    expect(escrowResolved2.profile.totalWinnings).toBe(0);
    expect(escrowResolved2.profile.totalLosses).toBe(0);

    // 3. Double Down (initial 50 + extra 50 = 100 total bet) winning 200
    const ddStep1 = walletPlaceBet(start1, 50);
    const ddStep2 = walletPlaceBet(ddStep1.profile, 50);
    expect(ddStep2.profile.credits).toBe(900);
    const ddResolved = walletResolveRound(ddStep2.profile, 100, 200);
    const ddSingleShot = walletSettleRound(start1, 100, 200);
    expect(ddResolved.profile).toEqual(ddSingleShot.profile);
    expect(ddResolved.profile.credits).toBe(1100);
    expect(ddResolved.profile.gamesPlayed).toBe(1);
    expect(ddResolved.profile.totalWinnings).toBe(100);
  });
});
