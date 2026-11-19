// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { BlackjackGame } from './BlackjackGame';
import { RoundResult } from '../../types/casino';
import * as deckModule from './deck';
import { Card, Rank, Suit } from './deck';

const c = (rank: Rank, suit: Suit = 'spades'): Card => ({
  id: `${rank}_${suit}`,
  rank,
  suit,
});

describe('BlackjackGame Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  const createProps = (overrides: Record<string, unknown> = {}) => {
    const placeBet = vi.fn().mockReturnValue({ success: true });
    const resolveRound = vi.fn((bet: number, payout: number): RoundResult => ({
      success: true,
      won: payout > bet,
      net: payout - bet,
      bet,
      payout,
      xpGained: payout > bet ? 20 : 10,
      leveledUp: false,
    }));
    const updatePendingRound = vi.fn();
    const settle = vi.fn();

    return {
      balance: 1000,
      minBet: 25,
      maxBet: 1000,
      settle,
      placeBet,
      resolveRound,
      updatePendingRound,
      animations: true,
      ...overrides,
    };
  };

  /**
   * Builds a deterministic 52-card deck where the top cards are ordered explicitly.
   * Deal sequence: P1 = [0], D1(up) = [1], P2 = [2], D2(hole) = [3], then hits/dealer draws from [4+].
   */
  const mockDeterministicDeck = (topCards: Card[]) => {
    const full = deckModule.createDeck();
    const topIds = new Set(topCards.map((card) => card.id));
    const rest = full.filter((card) => !topIds.has(card.id));
    const orderedDeck = [...topCards, ...rest];
    vi.spyOn(deckModule, 'shuffleDeck').mockReturnValue(orderedDeck);
  };

  it('renders dealer/player areas, wager controls, and disables Deal when balance is below minBet', () => {
    const lowProps = createProps({ balance: 20, minBet: 25 });
    render(<BlackjackGame {...lowProps} />);

    expect(screen.getByText('Dealer')).toBeTruthy();
    expect(screen.getByText('Your Hand')).toBeTruthy();
    const dealBtn = screen.getByRole('button', {
      name: /you need at least 25 credits to play/i,
    }) as HTMLButtonElement;
    expect(dealBtn.disabled).toBe(true);
  });

  it('prevents double-click on Deal, re-renders with new resolveRound mid-deal, and settles once on Stand', () => {
    // Player: 10 + 9 = 19, Dealer: 10 + 7 = 17 (stands) -> Player wins 1:1
    mockDeterministicDeck([
      c('10', 'spades'), // P1
      c('10', 'hearts'), // D1
      c('9', 'clubs'),   // P2
      c('7', 'diamonds'), // D2
    ]);

    const initialProps = createProps();
    const { rerender } = render(<BlackjackGame {...initialProps} />);

    const dealBtn = screen.getByRole('button', { name: /deal hand · 50 credits/i });
    fireEvent.click(dealBtn);
    fireEvent.click(dealBtn); // Rapid double tap ignored

    expect(initialProps.placeBet).toHaveBeenCalledTimes(1);
    expect(initialProps.placeBet).toHaveBeenCalledWith(
      50,
      100,
      expect.objectContaining({
        roundId: expect.any(String),
      })
    );

    // Mid-deal re-render with new resolveRound reference
    const updatedResolveRound = vi.fn((bet: number, payout: number): RoundResult => ({
      success: true,
      won: payout > bet,
      net: payout - bet,
      bet,
      payout,
      xpGained: 20,
      leveledUp: false,
    }));

    act(() => {
      vi.advanceTimersByTime(250);
    });
    rerender(<BlackjackGame {...initialProps} resolveRound={updatedResolveRound} />);

    // Finish initial deal animation (total 500ms)
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(updatedResolveRound).not.toHaveBeenCalled();

    const standBtn = screen.getByRole('button', { name: /^stand$/i }) as HTMLButtonElement;
    expect(standBtn.disabled).toBe(false);
    fireEvent.click(standBtn);
    fireEvent.click(standBtn); // Rapid double tap ignored

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(initialProps.resolveRound).not.toHaveBeenCalled();
    expect(updatedResolveRound).toHaveBeenCalledTimes(1);
    expect(updatedResolveRound).toHaveBeenCalledWith(
      50,
      100,
      expect.objectContaining({
        roundId: expect.any(String),
        detail: expect.any(String),
      })
    );

    expect(screen.getByText(/Won \+50 Credits/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /new hand · 50 credits/i })).toBeTruthy();
  });

  it('settles active escrow hand immediately on mid-hand unmount without stray timers', () => {
    // Player: 10 + 8 = 18, Dealer: 10 + 9 = 19 (auto-stand payout = 0)
    mockDeterministicDeck([
      c('10', 'spades'),
      c('10', 'hearts'),
      c('8', 'clubs'),
      c('9', 'diamonds'),
    ]);

    const props = createProps();
    const { unmount } = render(<BlackjackGame {...props} />);

    const dealBtn = screen.getByRole('button', { name: /deal hand · 50 credits/i });
    fireEvent.click(dealBtn);
    expect(props.placeBet).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    // Unmount mid-deal
    unmount();

    expect(props.resolveRound).toHaveBeenCalledTimes(1);
    expect(props.resolveRound).toHaveBeenCalledWith(
      50,
      0,
      expect.objectContaining({
        roundId: expect.any(String),
      })
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it('supports Double Down on initial 2 cards when balance covers extra wager and disables Double after Hit', () => {
    // Player: 5 + 6 = 11, next card 10 = 21; Dealer: 10 + 7 = 17
    mockDeterministicDeck([
      c('5', 'spades'),
      c('10', 'hearts'),
      c('6', 'clubs'),
      c('7', 'diamonds'),
      c('10', 'diamonds'), // Double / Hit draw -> 21
    ]);

    const props = createProps({ animations: false, balance: 100 });
    render(<BlackjackGame {...props} />);

    // Bet 50 from 100 -> 50 remaining after initial placeBet
    const dealBtn = screen.getByRole('button', { name: /deal hand · 50 credits/i });
    fireEvent.click(dealBtn);

    // Double button is enabled when balance >= 50
    const doubleBtn = screen.getByRole('button', { name: /double/i }) as HTMLButtonElement;
    expect(doubleBtn.disabled).toBe(false);

    fireEvent.click(doubleBtn);
    expect(props.placeBet).toHaveBeenCalledTimes(2);
    expect(props.placeBet).toHaveBeenNthCalledWith(
      2,
      50,
      200,
      expect.objectContaining({
        roundId: expect.any(String),
      })
    );
    expect(props.updatePendingRound).toHaveBeenLastCalledWith(
      100,
      200,
      expect.objectContaining({
        roundId: expect.any(String),
        detail: expect.stringContaining('2×'),
        facts: expect.objectContaining({ blackjackDoubledWin: true }),
      })
    );
    expect(props.resolveRound).toHaveBeenCalledTimes(1);
    expect(props.resolveRound).toHaveBeenCalledWith(
      100,
      200,
      expect.objectContaining({
        roundId: expect.any(String),
        detail: expect.stringContaining('2×'),
        facts: expect.objectContaining({ blackjackDoubledWin: true }),
      })
    );
    expect(screen.getByText(/Won \+100 Credits/i)).toBeTruthy();
  });

  it('disables Double Down when balance is insufficient or after hitting a third card', () => {
    // Player: 4 + 5 = 9, next card 2 = 11 (doesn't bust or hit 21)
    mockDeterministicDeck([
      c('4', 'spades'),
      c('10', 'hearts'),
      c('5', 'clubs'),
      c('7', 'diamonds'),
      c('2', 'diamonds'),
    ]);

    const lowDoubleProps = createProps({ animations: false, balance: 40, minBet: 25 });
    const { rerender } = render(<BlackjackGame {...lowDoubleProps} />);

    // Adjust wager to 25? Actually default wager starts at clamped floor(40/25)*25 = 25.
    // Wait: if balance is 40 and minBet is 25, initial wager is 25. Wait after placeBet, parent balance becomes 15 (< 25).
    const dealBtn = screen.getByRole('button', { name: /deal hand · 25 credits/i });
    fireEvent.click(dealBtn);

    // Simulate parent updating balance after placeBet deducted 25 (40 -> 15)
    rerender(<BlackjackGame {...lowDoubleProps} balance={15} />);

    const doubleBtn = screen.getByRole('button', { name: /double/i }) as HTMLButtonElement;
    expect(doubleBtn.disabled).toBe(true);

    // Even if balance was high, after Hit (3 cards) Double Down must be disabled
    rerender(<BlackjackGame {...lowDoubleProps} balance={500} />);
    expect((screen.getByRole('button', { name: /double/i }) as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: /^hit$/i }));
    expect((screen.getByRole('button', { name: /double/i }) as HTMLButtonElement).disabled).toBe(true);
  });
});
