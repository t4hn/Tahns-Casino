// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { DiceGame } from './DiceGame';
import { RoundResult } from '../../types/casino';

describe('DiceGame Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  const createProps = (overrides = {}) => {
    const settle = vi.fn().mockReturnValue({
      success: true,
      won: true,
      net: 65,
      bet: 50,
      payout: 115,
      xpGained: 20,
      leveledUp: false,
    } as RoundResult);
    const placeBet = vi.fn().mockReturnValue({ success: true });
    const resolveRound = vi.fn();

    return {
      balance: 1000,
      minBet: 10,
      maxBet: 500,
      settle,
      placeBet,
      resolveRound,
      animations: true,
      ...overrides,
    };
  };

  it('rolls, re-renders with a NEW settle function mid-roll, roll finishes, calls new settle exactly once, and re-enables Roll button', () => {
    const initialProps = createProps();
    const { rerender } = render(<DiceGame {...initialProps} />);

    const rollButton = screen.getByRole('button', { name: /roll dice · low · 50 credits/i }) as HTMLButtonElement;
    expect(rollButton.disabled).toBe(false);

    // 1. Initiate roll
    fireEvent.click(rollButton);

    // Button should be in rolling state
    const rollingButton = screen.getByRole('button', { name: /rolling dice\.\.\./i }) as HTMLButtonElement;
    expect(rollingButton.disabled).toBe(true);

    // 2. Advance time mid-roll (e.g. 250ms of 700ms)
    act(() => {
      vi.advanceTimersByTime(250);
    });

    // 3. Re-render with a NEW settle function reference (simulating parent context or state re-render)
    const newSettle = vi.fn().mockReturnValue({
      success: true,
      won: false,
      net: -50,
      bet: 50,
      payout: 0,
      xpGained: 10,
      leveledUp: false,
    } as RoundResult);

    rerender(<DiceGame {...initialProps} settle={newSettle} />);

    // Old and new settle must not have been called yet
    expect(initialProps.settle).not.toHaveBeenCalled();
    expect(newSettle).not.toHaveBeenCalled();

    // 4. Advance through animation conclusion (700ms total)
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // Exactly one call using the latest settle callback
    expect(initialProps.settle).not.toHaveBeenCalled();
    expect(newSettle).toHaveBeenCalledTimes(1);
    expect(newSettle).toHaveBeenCalledWith(50, expect.any(Number));

    // The Roll button is re-enabled
    const finishedButton = screen.getByRole('button', { name: /roll dice · low · 50 credits/i }) as HTMLButtonElement;
    expect(finishedButton.disabled).toBe(false);

    // The result strip displays a result
    const resultStrip = screen.getByText(/(Won|Lost)/i);
    expect(resultStrip).toBeTruthy();
  });

  it('prevents double-tap on Roll: settles only once', () => {
    const props = createProps();
    render(<DiceGame {...props} />);

    const rollButton = screen.getByRole('button', { name: /roll dice · low · 50 credits/i });

    // Double tap rapidly
    fireEvent.click(rollButton);
    fireEvent.click(rollButton);

    // Complete roll
    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(props.settle).toHaveBeenCalledTimes(1);
  });

  it('disables Roll button and shows low-balance message when balance < minBet', () => {
    const props = createProps({ balance: 5, minBet: 10 });
    render(<DiceGame {...props} />);

    const rollButton = screen.getByRole('button', {
      name: /you need at least 10 credits to play/i,
    }) as HTMLButtonElement;
    expect(rollButton).toBeDefined();
    expect(rollButton.disabled).toBe(true);

    const messages = screen.getAllByText(/you need at least 10 credits to play/i);
    expect(messages.length).toBeGreaterThanOrEqual(2);
  });
});

