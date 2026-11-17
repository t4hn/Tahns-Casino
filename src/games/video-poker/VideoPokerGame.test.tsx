// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react';
import { VideoPokerGame } from './VideoPokerGame';
import { RoundResult } from '../../types/casino';
import * as deckModule from '../blackjack/deck';
import { Card, Rank, Suit } from '../blackjack/deck';

const c = (rank: Rank, suit: Suit = 'spades'): Card => ({
  id: `${rank}_${suit}`,
  rank,
  suit,
});

describe('VideoPokerGame Component', () => {
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
      minBet: 20,
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
   * Builds a deterministic 52-card deck where indices 0..4 are the initial deal
   * and indices 5..9 are sequential draw replacements.
   */
  const mockDeterministicDeck = (topCards: Card[]) => {
    const full = deckModule.createDeck();
    const topIds = new Set(topCards.map((card) => card.id));
    const rest = full.filter((card) => !topIds.has(card.id));
    vi.spyOn(deckModule, 'shuffleDeck').mockReturnValue([...topCards, ...rest]);
  };

  it('renders the Jacks or Better paytable and disables Deal when balance is below minBet', () => {
    const props = createProps({ balance: 15, minBet: 20 });
    render(<VideoPokerGame {...props} />);

    const paytable = screen.getByLabelText('Jacks or Better Paytable');
    expect(within(paytable).getByText('Royal Flush')).toBeTruthy();
    expect(within(paytable).getByText('250:1')).toBeTruthy();
    expect(within(paytable).getByText('Jacks or Better')).toBeTruthy();
    expect(within(paytable).getByText('1:1')).toBeTruthy();

    // DRAW button must NOT be present before initial deal
    expect(screen.queryByRole('button', { name: /draw/i })).toBeNull();

    const dealBtn = screen.getByRole('button', {
      name: /you need at least 20 credits to play/i,
    }) as HTMLButtonElement;
    expect(dealBtn.disabled).toBe(true);
  });

  it('allows selecting and unselecting HOLD cards, replaces unheld cards on DRAW, and settles once', () => {
    // Initial 5: J♠, 2♥, J♦, 7♣, 9♠ -> hold slot 0 & 2 (pair of Jacks);
    // Replacements: A♣, K♥, Q♦ -> final hand retains J♠ & J♦ (Jacks or Better 1:1 -> 40 payout on 20 bet)
    mockDeterministicDeck([
      c('J', 'spades'),   // slot 0
      c('2', 'hearts'),   // slot 1
      c('J', 'diamonds'), // slot 2
      c('7', 'clubs'),    // slot 3
      c('9', 'spades'),   // slot 4
      c('A', 'clubs'),    // replacement 1
      c('K', 'hearts'),   // replacement 2
      c('Q', 'diamonds'), // replacement 3
    ]);

    const props = createProps({ animations: false });
    render(<VideoPokerGame {...props} />);

    const dealBtn = screen.getByRole('button', { name: /deal hand · 20 credits/i });
    fireEvent.click(dealBtn);
    fireEvent.click(dealBtn); // Rapid double tap ignored

    expect(props.placeBet).toHaveBeenCalledTimes(1);
    expect(props.placeBet).toHaveBeenCalledWith(20, 40); // Dealt Jacks or Better stand-pat payout

    // Select slot 0, slot 1, slot 2, then unselect slot 1
    const card0 = screen.getByTestId('poker-card-0');
    const card1 = screen.getByTestId('poker-card-1');
    const card2 = screen.getByTestId('poker-card-2');

    fireEvent.click(card0);
    fireEvent.click(card1);
    fireEvent.click(card2);
    fireEvent.click(card1); // change selection before drawing

    expect(card0.getAttribute('aria-pressed')).toBe('true');
    expect(card1.getAttribute('aria-pressed')).toBe('false');
    expect(card2.getAttribute('aria-pressed')).toBe('true');

    // Draw button shows Replace 3 Cards
    const drawBtn = screen.getByRole('button', { name: /draw · replace 3 cards/i });
    fireEvent.click(drawBtn);
    fireEvent.click(drawBtn); // Prevent duplicate draw

    expect(props.updatePendingRound).toHaveBeenCalledWith(20, 40);
    expect(props.resolveRound).toHaveBeenCalledTimes(1);
    expect(props.resolveRound).toHaveBeenCalledWith(20, 40);

    // Held cards kept, unheld replaced
    expect(screen.getByTestId('poker-card-0').getAttribute('aria-label')).toContain('Jack of Spades');
    expect(screen.getByTestId('poker-card-2').getAttribute('aria-label')).toContain('Jack of Diamonds');
    expect(screen.getByTestId('poker-card-1').getAttribute('aria-label')).toContain('Ace of Clubs');

    expect(screen.getByText(/Jacks or Better! Won \+20 Credits/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /new hand · 20 credits/i })).toBeTruthy();
  });

  it('supports holding all 5 cards (Stand Pat) and settles full flush payout', () => {
    mockDeterministicDeck([
      c('A', 'hearts'),
      c('J', 'hearts'),
      c('8', 'hearts'),
      c('4', 'hearts'),
      c('2', 'hearts'),
    ]);

    const props = createProps({ animations: false });
    render(<VideoPokerGame {...props} />);

    // Select 100 wager preset
    fireEvent.click(screen.getByRole('button', { name: '100' }));
    fireEvent.click(screen.getByRole('button', { name: /deal hand · 100 credits/i }));

    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByTestId(`poker-card-${i}`));
    }

    const drawBtn = screen.getByRole('button', { name: /draw · keep all 5 cards/i });
    fireEvent.click(drawBtn);

    // Flush 6:1 on 100 bet -> +600 net, 700 total return
    expect(props.resolveRound).toHaveBeenCalledTimes(1);
    expect(props.resolveRound).toHaveBeenCalledWith(100, 700);
    expect(screen.getByText(/Flush! Won \+600 Credits/i)).toBeTruthy();
  });

  it('handles mid-draw re-render with new resolveRound callback without cancelling animation', () => {
    // Initial 5: 10♠, J♠, Q♠, K♠, 2♥ -> hold 0..3, draw A♠ for Royal Flush!
    mockDeterministicDeck([
      c('10', 'spades'),
      c('J', 'spades'),
      c('Q', 'spades'),
      c('K', 'spades'),
      c('2', 'hearts'),
      c('A', 'spades'),
    ]);

    const initialProps = createProps({ animations: true });
    const { rerender } = render(<VideoPokerGame {...initialProps} />);

    fireEvent.click(screen.getByRole('button', { name: /deal hand · 20 credits/i }));
    act(() => {
      vi.advanceTimersByTime(450);
    });

    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByTestId(`poker-card-${i}`));
    }

    fireEvent.click(screen.getByRole('button', { name: /draw · replace 1 card/i }));

    const newResolveRound = vi.fn((bet: number, payout: number): RoundResult => ({
      success: true,
      won: payout > bet,
      net: payout - bet,
      bet,
      payout,
      xpGained: 25,
      leveledUp: false,
    }));

    rerender(<VideoPokerGame {...initialProps} resolveRound={newResolveRound} />);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(initialProps.resolveRound).not.toHaveBeenCalled();
    expect(newResolveRound).toHaveBeenCalledTimes(1);
    // Royal Flush 250:1 on 20 bet -> 251 * 20 = 5,020 total payout
    expect(newResolveRound).toHaveBeenCalledWith(20, 5020);
    expect(screen.getByText(/Royal Flush! Won \+5,000 Credits/i)).toBeTruthy();
  });

  it('settles active escrow hand immediately on unmount mid-round without stray timers', () => {
    mockDeterministicDeck([
      c('2', 'spades'),
      c('4', 'hearts'),
      c('7', 'clubs'),
      c('9', 'diamonds'),
      c('K', 'spades'),
    ]);

    const props = createProps({ animations: true });
    const { unmount } = render(<VideoPokerGame {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /deal hand · 20 credits/i }));
    expect(props.placeBet).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();

    expect(props.resolveRound).toHaveBeenCalledTimes(1);
    expect(props.resolveRound).toHaveBeenCalledWith(20, 0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
