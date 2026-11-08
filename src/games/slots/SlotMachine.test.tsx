// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { SlotMachine } from './SlotMachine';
import { DEFAULT_SLOTS_CONFIG } from './slotsConfig';
import { RoundResult } from '../../types/casino';

describe('SlotMachine Component', () => {
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
      net: 150,
      bet: 50,
      payout: 200,
      xpGained: 20,
      leveledUp: false,
    } as RoundResult);
    const settle = vi.fn();

    return {
      balance: 1000,
      minBet: 10,
      maxBet: 500,
      settle,
      placeBet,
      resolveRound,
      animations: true,
      config: DEFAULT_SLOTS_CONFIG,
      ...overrides,
    };
  };

  it('spins, re-renders with a NEW resolveRound function mid-spin, reels finish, calls resolveRound exactly once, and re-enables Spin button', () => {
    const initialProps = createProps();
    const { rerender } = render(<SlotMachine {...initialProps} />);

    const spinButton = screen.getByRole('button', { name: /spin · 50 credits/i }) as HTMLButtonElement;
    expect(spinButton.disabled).toBe(false);

    // 1. Initiate spin
    fireEvent.click(spinButton);
    expect(initialProps.placeBet).toHaveBeenCalledTimes(1);

    // Button should be in spinning state
    const spinningButton = screen.getByRole('button', { name: /spinning reels/i }) as HTMLButtonElement;
    expect(spinningButton.disabled).toBe(true);

    // 2. Advance time partially during spin (reels are cycling)
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // 3. Re-render with a brand new resolveRound function reference (simulating parent context update)
    const newResolveRound = vi.fn().mockReturnValue({
      success: true,
      won: true,
      net: 200,
      bet: 50,
      payout: 250,
      xpGained: 20,
      leveledUp: false,
    } as RoundResult);

    rerender(<SlotMachine {...initialProps} resolveRound={newResolveRound} />);

    // Prior resolveRound must not have been called prematurely
    expect(initialProps.resolveRound).not.toHaveBeenCalled();
    expect(newResolveRound).not.toHaveBeenCalled();

    // 4. Advance timers through all reel stops (base 600ms + 300ms + 300ms = 1200ms)
    act(() => {
      vi.advanceTimersByTime(1200);
    });

    // Exactly one resolution must happen, using the latest resolveRound function
    expect(initialProps.resolveRound).not.toHaveBeenCalled();
    expect(newResolveRound).toHaveBeenCalledTimes(1);
    expect(newResolveRound).toHaveBeenCalledWith(50, expect.any(Number));

    // The Spin button is re-enabled with normal label
    const finishedButton = screen.getByRole('button', { name: /spin · 50 credits/i }) as HTMLButtonElement;
    expect(finishedButton.disabled).toBe(false);

    // The result strip displays a result
    const resultStrip = screen.getByText(/(Won|Push|No win|Lost)/i);
    expect(resultStrip).toBeTruthy();
  });

  it('spins, unmounts mid-spin, resolves immediately exactly once with decided payout and leaves no timers running', () => {
    const props = createProps();
    const { unmount } = render(<SlotMachine {...props} />);

    const spinButton = screen.getByRole('button', { name: /spin · 50 credits/i });
    fireEvent.click(spinButton);
    expect(props.placeBet).toHaveBeenCalledTimes(1);

    // Timers are active
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    // Advance 300ms mid-spin
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(props.resolveRound).not.toHaveBeenCalled();

    // Unmount mid-spin
    unmount();

    // Must resolve immediately upon unmount with decided payout
    expect(props.resolveRound).toHaveBeenCalledTimes(1);
    expect(props.resolveRound).toHaveBeenCalledWith(50, expect.any(Number));

    // All intervals and timeouts must be cancelled
    expect(vi.getTimerCount()).toBe(0);

    // Advancing timers further should NOT trigger another resolveRound
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(props.resolveRound).toHaveBeenCalledTimes(1);
  });

  it('prevents double-tap on Spin: places only one bet', () => {
    const props = createProps();
    render(<SlotMachine {...props} />);

    const spinButton = screen.getByRole('button', { name: /spin · 50 credits/i });

    // Double tap rapidly
    fireEvent.click(spinButton);
    fireEvent.click(spinButton);

    expect(props.placeBet).toHaveBeenCalledTimes(1);

    // Finish spin
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(props.resolveRound).toHaveBeenCalledTimes(1);
  });
});
