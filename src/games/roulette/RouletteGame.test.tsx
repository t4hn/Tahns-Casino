// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { RouletteGame } from './RouletteGame';
import { gameRegistry } from '../registry';
import { RoundResult } from '../../types/casino';

describe('RouletteGame Component & Registry Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  const createProps = (overrides = {}) => {
    const placeBet = vi.fn().mockReturnValue({ success: true });
    const resolveRound = vi.fn().mockReturnValue({
      success: true,
      won: true,
      net: 25,
      bet: 25,
      payout: 50,
      xpGained: 15,
      leveledUp: false,
    } as RoundResult);
    const updatePendingRound = vi.fn();
    const settle = vi.fn();

    return {
      balance: 1000,
      minBet: 10,
      maxBet: 1500,
      settle,
      placeBet,
      resolveRound,
      updatePendingRound,
      animations: false,
      ...overrides,
    };
  };

  it('registers roulette as an open playable table in the casino game registry', () => {
    const floor = gameRegistry.deriveFloorGames();
    const roulette = floor.find((g) => g.id === 'roulette');
    expect(roulette).toBeDefined();
    expect(roulette?.status).toBe('Table Open');
    expect(roulette?.hasPlayableModule).toBe(true);
    expect(roulette?.payoutRate).toBe('97.3%');
  });

  it('places chips across multiple spots, supports individual removal/clear, and prevents overdraft', () => {
    const props = createProps({ balance: 60 });
    render(<RouletteGame {...props} />);

    // Default active chip is 25
    fireEvent.click(screen.getByRole('button', { name: /bet red \(1:1\)/i }));
    expect(screen.getByTestId('total-wager-value').textContent).toBe('25 Cr');

    // Switch to 10 chip and place on Straight 17
    fireEvent.click(screen.getByRole('button', { name: /select 10 credit chip/i }));
    fireEvent.click(screen.getByRole('button', { name: /bet straight 17/i }));
    expect(screen.getByTestId('total-wager-value').textContent).toBe('35 Cr');

    // Try adding 50 chip when only 25 credits remain -> blocks overdraft cleanly
    fireEvent.click(screen.getByRole('button', { name: /select 50 credit chip/i }));
    fireEvent.click(screen.getByRole('button', { name: /bet black \(1:1\)/i }));
    expect(screen.getByRole('alert').textContent).toMatch(/insufficient credits/i);

    // Remove individual Red bet -> total drops to 10 Cr
    fireEvent.click(screen.getByRole('button', { name: /remove red bet/i }));
    expect(screen.getByTestId('total-wager-value').textContent).toBe('10 Cr');

    // Clear all bets
    fireEvent.click(screen.getByRole('button', { name: /^clear$/i }));
    expect(screen.getByTestId('total-wager-value').textContent).toBe('0 Cr');
  });

  it('spins, locks betting, settles once with newest resolveRound callback even if re-rendered mid-spin, and supports New Round & Repeat', () => {
    const initialProps = createProps({ animations: false });
    const { rerender } = render(<RouletteGame {...initialProps} />);

    // Place 25 on Red
    fireEvent.click(screen.getByRole('button', { name: /bet red \(1:1\)/i }));

    // Spin
    const spinBtn = screen.getByRole('button', { name: /^spin$/i });
    fireEvent.click(spinBtn);

    expect(initialProps.placeBet).toHaveBeenCalledTimes(1);
    expect(initialProps.placeBet).toHaveBeenCalledWith(25, expect.any(Number));
    expect(screen.getByTestId('roulette-wheel').getAttribute('data-spinning')).toBe('true');

    // Simulate parent re-render with a fresh resolveRound arrow mid-spin
    const updatedResolveRound = vi.fn().mockReturnValue({
      success: true,
      won: true,
      net: 25,
      bet: 25,
      payout: 50,
      xpGained: 15,
      leveledUp: false,
    } as RoundResult);
    rerender(<RouletteGame {...initialProps} balance={975} resolveRound={updatedResolveRound} />);

    // Fast-forward non-animated spin timer (150ms)
    act(() => {
      vi.advanceTimersByTime(250);
    });

    // Latest resolveRound called strictly once; initial resolveRound not called
    expect(initialProps.resolveRound).not.toHaveBeenCalled();
    expect(updatedResolveRound).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('roulette-result-summary')).toBeTruthy();

    // New Round clears current board, Repeat restores previous 25 Red bet
    fireEvent.click(screen.getByRole('button', { name: /new round/i }));
    expect(screen.getByTestId('total-wager-value').textContent).toBe('0 Cr');

    fireEvent.click(screen.getByRole('button', { name: /^repeat$/i }));
    expect(screen.getByTestId('total-wager-value').textContent).toBe('25 Cr');
  });

  it('settles an in-flight spin immediately on unmount so escrowed wagers are never stranded', () => {
    const props = createProps({ animations: false });
    const { unmount } = render(<RouletteGame {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /bet red \(1:1\)/i }));
    fireEvent.click(screen.getByRole('button', { name: /^spin$/i }));
    expect(props.placeBet).toHaveBeenCalledTimes(1);
    expect(props.resolveRound).not.toHaveBeenCalled();

    unmount();
    expect(props.resolveRound).toHaveBeenCalledTimes(1);
  });

  it('toggles compact European Roulette rules and payout odds panel', () => {
    const props = createProps();
    render(<RouletteGame {...props} />);

    const toggle = screen.getByRole('button', {
      name: /european roulette rules & payout odds/i,
    });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Straight Up')).toBeTruthy();
    expect(screen.getAllByText('35:1').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('17:1').length).toBeGreaterThanOrEqual(2);
  });
});
