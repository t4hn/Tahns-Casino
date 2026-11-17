import { describe, it, expect } from 'vitest';
import { Card, Rank, Suit } from '../blackjack/deck';
import {
  JACKS_OR_BETTER_PAYTABLE,
  evaluatePokerHand,
  calculateVideoPokerPayout,
  resolveVideoPokerHand,
  validatePokerHand,
  isValidVideoPokerBet,
} from './videoPokerRules';
import {
  dealInitialPokerHand,
  toggleHoldCard,
  drawReplacementCards,
  claimVideoPokerSettlement,
} from './videoPokerState';
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
  id: 'test_patron_vp',
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

describe('Video Poker (Jacks or Better) Hand Evaluator', () => {
  it('detects Royal Flush (250:1) regardless of card order and distinguishes it from Straight Flush', () => {
    const royalUnordered = [
      c('A', 'hearts'),
      c('10', 'hearts'),
      c('Q', 'hearts'),
      c('K', 'hearts'),
      c('J', 'hearts'),
    ];
    const evalRoyal = evaluatePokerHand(royalUnordered);
    expect(evalRoyal.category).toBe('royal_flush');
    expect(evalRoyal.name).toBe('Royal Flush');
    expect(evalRoyal.odds).toBe(250);
    expect(evalRoyal.won).toBe(true);
    expect(evalRoyal.winningCardIndices).toEqual([0, 1, 2, 3, 4]);
  });

  it('detects Straight Flush (50:1), including Ace-low wheel A-2-3-4-5 suited', () => {
    const nineHighSf = [
      c('9', 'clubs'),
      c('6', 'clubs'),
      c('8', 'clubs'),
      c('5', 'clubs'),
      c('7', 'clubs'),
    ];
    const evalSf = evaluatePokerHand(nineHighSf);
    expect(evalSf.category).toBe('straight_flush');
    expect(evalSf.odds).toBe(50);
    expect(evalSf.won).toBe(true);

    const wheelSf = [
      c('A', 'diamonds'),
      c('3', 'diamonds'),
      c('5', 'diamonds'),
      c('2', 'diamonds'),
      c('4', 'diamonds'),
    ];
    const evalWheelSf = evaluatePokerHand(wheelSf);
    expect(evalWheelSf.category).toBe('straight_flush');
    expect(evalWheelSf.odds).toBe(50);
  });

  it('detects Four of a Kind (25:1) with accurate winning indices', () => {
    const quads = [
      c('7', 'spades'),
      c('K', 'hearts'),
      c('7', 'hearts'),
      c('7', 'diamonds'),
      c('7', 'clubs'),
    ];
    const evalQuads = evaluatePokerHand(quads);
    expect(evalQuads.category).toBe('four_of_a_kind');
    expect(evalQuads.odds).toBe(25);
    expect(evalQuads.winningCardIndices).toEqual([0, 2, 3, 4]);
  });

  it('detects Full House (9:1) without misclassifying as Three of a Kind or Two Pair', () => {
    const fullHouse = [
      c('Q', 'spades'),
      c('4', 'hearts'),
      c('Q', 'diamonds'),
      c('4', 'clubs'),
      c('Q', 'clubs'),
    ];
    const evalFh = evaluatePokerHand(fullHouse);
    expect(evalFh.category).toBe('full_house');
    expect(evalFh.odds).toBe(9);
    expect(evalFh.winningCardIndices).toEqual([0, 1, 2, 3, 4]);
  });

  it('detects Flush (6:1) when all suits match without forming a straight', () => {
    const flush = [
      c('A', 'spades'),
      c('J', 'spades'),
      c('8', 'spades'),
      c('4', 'spades'),
      c('2', 'spades'),
    ];
    const evalFlush = evaluatePokerHand(flush);
    expect(evalFlush.category).toBe('flush');
    expect(evalFlush.odds).toBe(6);
  });

  it('detects Ace-high and Ace-low straights (4:1) and rejects wrap-around sequences', () => {
    const broadwayStraight = [
      c('10', 'spades'),
      c('J', 'hearts'),
      c('Q', 'clubs'),
      c('K', 'diamonds'),
      c('A', 'spades'),
    ];
    expect(evaluatePokerHand(broadwayStraight).category).toBe('straight');
    expect(evaluatePokerHand(broadwayStraight).odds).toBe(4);

    const wheelStraight = [
      c('A', 'spades'),
      c('2', 'hearts'),
      c('3', 'clubs'),
      c('4', 'diamonds'),
      c('5', 'spades'),
    ];
    expect(evaluatePokerHand(wheelStraight).category).toBe('straight');
    expect(evaluatePokerHand(wheelStraight).odds).toBe(4);

    // Wrap-around Q-K-A-2-3 is NOT a valid poker straight
    const wrapAround = [
      c('Q', 'spades'),
      c('K', 'hearts'),
      c('A', 'clubs'),
      c('2', 'diamonds'),
      c('3', 'spades'),
    ];
    expect(evaluatePokerHand(wrapAround).category).toBe('none');
    expect(evaluatePokerHand(wrapAround).won).toBe(false);
  });

  it('detects Three of a Kind (3:1) and Two Pair (2:1)', () => {
    const trips = [
      c('9', 'spades'),
      c('A', 'hearts'),
      c('9', 'diamonds'),
      c('5', 'clubs'),
      c('9', 'clubs'),
    ];
    const evalTrips = evaluatePokerHand(trips);
    expect(evalTrips.category).toBe('three_of_a_kind');
    expect(evalTrips.odds).toBe(3);
    expect(evalTrips.winningCardIndices).toEqual([0, 2, 4]);

    const twoPair = [
      c('3', 'spades'),
      c('8', 'hearts'),
      c('3', 'clubs'),
      c('A', 'diamonds'),
      c('8', 'spades'),
    ];
    const evalTwoPair = evaluatePokerHand(twoPair);
    expect(evalTwoPair.category).toBe('two_pair');
    expect(evalTwoPair.odds).toBe(2);
    expect(evalTwoPair.winningCardIndices).toEqual([0, 1, 2, 4]);
  });

  it('qualifies pairs of Jacks, Queens, Kings, and Aces (1:1) and rejects pairs 2 through 10', () => {
    const qualifyingRanks: Rank[] = ['J', 'Q', 'K', 'A'];
    for (const rank of qualifyingRanks) {
      const hand = [
        c(rank, 'spades'),
        c('2', 'hearts'),
        c(rank, 'diamonds'),
        c('5', 'clubs'),
        c('9', 'spades'),
      ];
      const res = evaluatePokerHand(hand);
      expect(res.category).toBe('jacks_or_better');
      expect(res.odds).toBe(1);
      expect(res.won).toBe(true);
      expect(res.winningCardIndices).toEqual([0, 2]);
    }

    const nonQualifyingRanks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10'];
    for (const rank of nonQualifyingRanks) {
      const hand = [
        c(rank, 'spades'),
        c('A', 'hearts'),
        c(rank, 'diamonds'),
        c('K', 'clubs'),
        c('Q', 'hearts'),
      ];
      const res = evaluatePokerHand(hand);
      expect(res.category).toBe('none');
      expect(res.odds).toBe(0);
      expect(res.won).toBe(false);
    }
  });

  it('throws clear errors for invalid, wrong-length, or duplicate-card hands', () => {
    expect(() => validatePokerHand([])).toThrow(/expected exactly 5 cards/i);
    expect(() =>
      validatePokerHand([c('A', 'spades'), c('K', 'hearts'), c('Q', 'clubs'), c('J', 'diamonds')])
    ).toThrow(/expected exactly 5 cards/i);
    expect(() =>
      validatePokerHand([
        c('A', 'spades'),
        c('K', 'hearts'),
        c('Q', 'clubs'),
        c('J', 'diamonds'),
        c('10', 'spades'),
        c('9', 'hearts'),
      ])
    ).toThrow(/expected exactly 5 cards/i);
    expect(() =>
      validatePokerHand([
        c('A', 'spades'),
        c('A', 'spades'),
        c('Q', 'clubs'),
        c('J', 'diamonds'),
        c('10', 'hearts'),
      ])
    ).toThrow(/duplicate card/i);
    expect(() =>
      validatePokerHand([
        { id: 'bad', rank: '1' as Rank, suit: 'spades' },
        c('K', 'hearts'),
        c('Q', 'clubs'),
        c('J', 'diamonds'),
        c('10', 'hearts'),
      ])
    ).toThrow(/invalid card rank/i);
  });
});

describe('Video Poker Paytable, Payout Calculation & Economy Integration', () => {
  it('computes net winnings and total returned payout across the entire 9/6 paytable', () => {
    const wager = 50;
    const expectedOdds: Record<string, number> = {
      royal_flush: 250,
      straight_flush: 50,
      four_of_a_kind: 25,
      full_house: 9,
      flush: 6,
      straight: 4,
      three_of_a_kind: 3,
      two_pair: 2,
      jacks_or_better: 1,
    };

    for (const entry of JACKS_OR_BETTER_PAYTABLE) {
      expect(entry.odds).toBe(expectedOdds[entry.category]);
      const payout = calculateVideoPokerPayout(entry.category, wager);
      expect(payout.netWinnings).toBe(wager * entry.odds);
      expect(payout.totalPayout).toBe(wager + wager * entry.odds);
    }

    const loss = calculateVideoPokerPayout('none', wager);
    expect(loss.netWinnings).toBe(0);
    expect(loss.totalPayout).toBe(0);
  });

  it('integrates escrow placeBet + resolveRound identically to settleRound', () => {
    const start = createMockProfile(1000);
    const fullHouseHand = [
      c('K', 'spades'),
      c('K', 'hearts'),
      c('K', 'diamonds'),
      c('8', 'clubs'),
      c('8', 'spades'),
    ];
    const wager = 20;
    const res = resolveVideoPokerHand(fullHouseHand, wager);
    expect(res.netWinnings).toBe(180);
    expect(res.totalPayout).toBe(200);

    const betStep = walletPlaceBet(start, wager);
    expect(betStep.success).toBe(true);
    expect(betStep.profile.credits).toBe(980);

    const resolved = walletResolveRound(betStep.profile, wager, res.totalPayout);
    const singleShot = walletSettleRound(start, wager, res.totalPayout);
    expect(resolved.profile).toEqual(singleShot.profile);
    expect(resolved.profile.credits).toBe(1180);
    expect(resolved.profile.totalWinnings).toBe(180);
    expect(resolved.profile.gamesPlayed).toBe(1);
  });

  it('rejects insufficient balance and out-of-range wagers', () => {
    expect(isValidVideoPokerBet(20, 20, 1000, 100).valid).toBe(true);
    expect(isValidVideoPokerBet(10, 20, 1000, 100).valid).toBe(false);
    expect(isValidVideoPokerBet(120, 20, 1000, 100).valid).toBe(false);
    expect(isValidVideoPokerBet(25, 20, 1000, 500).valid).toBe(false); // must be step of 10
    expect(isValidVideoPokerBet(0, 20, 1000, 500).valid).toBe(false);
    expect(isValidVideoPokerBet(-20, 20, 1000, 500).valid).toBe(false);
  });
});

describe('Video Poker State Machine: Deal, Hold All, Hold None, Partial Draw & Guards', () => {
  it('deals 5 unique cards leaving 47 in deck and supports holding all 5 cards', () => {
    const { state } = dealInitialPokerHand(20);
    expect(state.hand).toHaveLength(5);
    expect(state.deck).toHaveLength(47);

    let heldAll = state;
    for (let i = 0; i < 5; i++) {
      heldAll = toggleHoldCard(heldAll, i);
    }
    expect(heldAll.heldIndices).toEqual([true, true, true, true, true]);

    const drawn = drawReplacementCards(heldAll);
    expect(drawn.replacedIndices).toEqual([]);
    expect(drawn.state.hand).toEqual(state.hand);
    expect(drawn.state.deck).toHaveLength(47);
  });

  it('replaces all 5 cards when holding none without duplicating any card from the 52-card deck', () => {
    const { state } = dealInitialPokerHand(20);
    const originalIds = state.hand.map((card) => card.id);

    const drawn = drawReplacementCards(state);
    expect(drawn.replacedIndices).toEqual([0, 1, 2, 3, 4]);
    expect(drawn.state.deck).toHaveLength(42);

    const nextIds = drawn.state.hand.map((card) => card.id);
    for (const id of nextIds) {
      expect(originalIds).not.toContain(id);
    }
    expect(new Set([...originalIds, ...nextIds]).size).toBe(10);
  });

  it('replaces only unheld cards and rejects duplicate draws or duplicate payouts', () => {
    const { state } = dealInitialPokerHand(50);
    let updated = toggleHoldCard(state, 0);
    updated = toggleHoldCard(updated, 3);
    // Toggle off and back on to test selection adjustment
    updated = toggleHoldCard(updated, 3);
    expect(updated.heldIndices).toEqual([true, false, false, false, false]);
    updated = toggleHoldCard(updated, 3);
    expect(updated.heldIndices).toEqual([true, false, false, true, false]);

    const drawn = drawReplacementCards(updated);
    expect(drawn.replacedIndices).toEqual([1, 2, 4]);
    expect(drawn.state.hand[0]).toEqual(state.hand[0]);
    expect(drawn.state.hand[3]).toEqual(state.hand[3]);
    expect(drawn.state.hand[1]).not.toEqual(state.hand[1]);
    expect(drawn.state.hand[2]).not.toEqual(state.hand[2]);
    expect(drawn.state.hand[4]).not.toEqual(state.hand[4]);

    // Duplicate draw blocked
    expect(() => drawReplacementCards(drawn.state)).toThrow(/cannot draw cards/i);

    // Duplicate settlement blocked
    const firstClaim = claimVideoPokerSettlement(drawn.state);
    expect(firstClaim.claimed).toBe(true);
    expect(firstClaim.state.phase).toBe('SETTLED');

    const secondClaim = claimVideoPokerSettlement(firstClaim.state);
    expect(secondClaim.claimed).toBe(false);
  });
});
