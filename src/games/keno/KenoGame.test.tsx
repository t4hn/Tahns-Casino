// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { KenoGame } from './KenoGame';
import { gameRegistry } from '../registry';
import { KENO_HISTORY_STORAGE_KEY, KENO_STATS_STORAGE_KEY } from './kenoStorage';

function createDefaultProps(overrides: Partial<React.ComponentProps<typeof KenoGame>> = {}) {
  return {
    balance: 1000,
    minBet: 10,
    maxBet: 1000,
    settle: vi.fn((bet: number, payout: number) => ({
      success: true,
      won: payout > bet,
      net: payout - bet,
      bet,
      payout,
      xpGained: payout > bet ? 20 : 10,
      leveledUp: false,
    })),
    placeBet: vi.fn(() => ({ success: true })),
    resolveRound: vi.fn((bet: number, payout: number) => ({
      success: true,
      won: payout > bet,
      net: payout - bet,
      bet,
      payout,
      xpGained: payout > bet ? 20 : 10,
      leveledUp: false,
    })),
    updatePendingRound: vi.fn(),
    animations: false,
    ...overrides,
  };
}

describe('KenoGame Component & Registry Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    localStorage.clear();
  });

  it('registers Keno in the game registry as Table Open with derived RTP and playable module', () => {
    const floorGames = gameRegistry.deriveFloorGames();
    const keno = floorGames.find((g) => g.id === 'keno');
    expect(keno).toBeDefined();
    expect(keno?.name).toBe('Keno');
    expect(keno?.status).toBe('Table Open');
    expect(keno?.hasPlayableModule).toBe(true);
    expect(keno?.payoutRate).toMatch(/^\d+\.\d%$/);
    expect(gameRegistry.getModule('keno')).toBeDefined();
  });

  it('renders 1-80 grid, enforces 10-spot selection limit, supports Clear & Quick Pick, and blocks play with 0 spots', () => {
    const props = createDefaultProps();
    render(<KenoGame {...props} />);

    const playBtn = screen.getByRole('button', { name: /play keno/i }) as HTMLButtonElement;
    expect(playBtn.disabled).toBe(true);

    // Select 10 spots
    for (let n = 1; n <= 10; n++) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Number ${n},`) }));
    }
    expect(screen.getByTestId('keno-selection-count').textContent).toBe('10/10');
    expect(playBtn.disabled).toBe(false);

    // 11th number is blocked with alert message
    fireEvent.click(screen.getByRole('button', { name: /^Number 11,/ }));
    expect(screen.getByTestId('keno-selection-count').textContent).toBe('10/10');
    expect(screen.getByRole('alert').textContent).toMatch(/10/);

    // Clear Selection resets to 0/10 and disables PLAY KENO
    fireEvent.click(screen.getByRole('button', { name: /clear selection/i }));
    expect(screen.getByTestId('keno-selection-count').textContent).toBe('0/10');
    expect(playBtn.disabled).toBe(true);

    // Quick Pick populates spots according to selector
    fireEvent.change(screen.getByLabelText(/quick pick number count/i), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByRole('button', { name: /quick pick/i }));
    expect(screen.getByTestId('keno-selection-count').textContent).toBe('5/10');
    expect(playBtn.disabled).toBe(false);
  });

  it('executes round, deducts & settles wallet exactly once, updates persisted history/stats, and supports Repeat Bet', () => {
    const props = createDefaultProps();
    const { unmount } = render(<KenoGame {...props} />);

    // Pick 4 numbers and set wager to 50
    for (const n of [5, 12, 29, 64]) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Number ${n},`) }));
    }
    fireEvent.click(screen.getByRole('button', { name: /set 50 credit wager/i }));
    fireEvent.click(screen.getByRole('button', { name: /play keno/i }));

    expect(props.placeBet).toHaveBeenCalledTimes(1);
    expect(props.placeBet).toHaveBeenCalledWith(
      50,
      expect.any(Number),
      expect.objectContaining({
        roundId: expect.any(String),
        kenoResult: expect.objectContaining({
          spotCount: 4,
          wager: 50,
        }),
      })
    );
    expect(props.resolveRound).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('keno-draw-counter').textContent).toBe('20/20');
    expect(screen.getByTestId('keno-result-summary')).toBeTruthy();
    expect(screen.getByTestId('keno-stat-rounds').textContent).toBe('1');

    // Clear selection and use Repeat Bet
    fireEvent.click(screen.getByRole('button', { name: /clear selection/i }));
    fireEvent.click(screen.getByRole('button', { name: /set 10 credit wager/i }));
    fireEvent.click(screen.getByRole('button', { name: /repeat bet/i }));
    expect(screen.getByTestId('keno-selection-count').textContent).toBe('4/10');
    expect(screen.getByRole('button', { name: /set 50 credit wager/i }).getAttribute('aria-pressed')).toBe('true');

    // Remount preserves history & stats without duplication
    unmount();
    const props2 = createDefaultProps();
    render(<KenoGame {...props2} />);
    expect(screen.getByTestId('keno-stat-rounds').textContent).toBe('1');
    expect(screen.getByTestId('keno-history-list').children).toHaveLength(1);
    expect(localStorage.getItem(KENO_HISTORY_STORAGE_KEY)).not.toBeNull();
    expect(localStorage.getItem(KENO_STATS_STORAGE_KEY)).not.toBeNull();
  });

  it('animates 20 balls sequentially, blocks duplicate draws, and settles mid-draw unmount once', () => {
    vi.useFakeTimers();
    const props = createDefaultProps({ animations: true });
    const { unmount } = render(<KenoGame {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /^Number 1,/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Number 2,/ }));
    fireEvent.click(screen.getByRole('button', { name: /play keno/i }));

    expect(props.placeBet).toHaveBeenCalledTimes(1);
    expect(props.resolveRound).not.toHaveBeenCalled();

    // Advance partway through draw (5 balls * 350ms = 1750ms)
    act(() => {
      vi.advanceTimersByTime(1750);
    });
    expect(screen.getByTestId('keno-draw-counter').textContent).toBe('5/20');
    expect(props.resolveRound).not.toHaveBeenCalled();

    // Play button remains disabled during active draw
    const drawingBtn = screen.getByRole('button', { name: /drawing 20 balls/i }) as HTMLButtonElement;
    expect(drawingBtn.disabled).toBe(true);
    fireEvent.click(drawingBtn);
    expect(props.placeBet).toHaveBeenCalledTimes(1);

    // Unmount mid-draw settles round and persists history once
    unmount();
    expect(props.resolveRound).toHaveBeenCalledTimes(1);

    // Remount shows 1 completed round cleanly
    render(<KenoGame {...createDefaultProps({ animations: true })} />);
    expect(screen.getByTestId('keno-stat-rounds').textContent).toBe('1');
  });
});
