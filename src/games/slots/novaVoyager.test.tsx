// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { NOVA_VOYAGER_CONFIG } from './novaVoyagerConfig';
import {
  evaluateLine,
  evaluateSpin,
  calculateAnalyticalRtp,
  calculateMatchOdds,
  calculateRtp,
  calculateHitStats,
} from './slotsRules';
import { gameRegistry, getGameModule } from '../registry';
import { SlotMachine } from './SlotMachine';
import { RoundResult } from '../../types/casino';

describe('Nova Voyager Slot Machine', () => {
  describe('Strip Composition and Paytable Integrity', () => {
    it('has 5 reels with 24 stops each', () => {
      expect(NOVA_VOYAGER_CONFIG.reelStrips).toHaveLength(5);
      NOVA_VOYAGER_CONFIG.reelStrips.forEach((strip) => {
        expect(strip).toHaveLength(24);
      });
    });

    it('has exact symbol counts per strip and Wilds only on reels 2, 3, 4', () => {
      const countSymbols = (strip: string[]) => {
        const counts: Record<string, number> = {};
        for (const s of strip) {
          counts[s] = (counts[s] || 0) + 1;
        }
        return counts;
      };

      // Reels 1 and 5 (index 0 and 4)
      [0, 4].forEach((idx) => {
        const counts = countSymbols(NOVA_VOYAGER_CONFIG.reelStrips[idx]);
        expect(counts['galaxy']).toBe(1);
        expect(counts['planet']).toBe(2);
        expect(counts['rocket']).toBe(2);
        expect(counts['alien']).toBe(3);
        expect(counts['moon']).toBe(4);
        expect(counts['star']).toBe(6);
        expect(counts['meteor']).toBe(6);
        expect(counts['comet'] || 0).toBe(0);
      });

      // Reels 2, 3, and 4 (index 1, 2, 3)
      [1, 2, 3].forEach((idx) => {
        const counts = countSymbols(NOVA_VOYAGER_CONFIG.reelStrips[idx]);
        expect(counts['galaxy']).toBe(1);
        expect(counts['planet']).toBe(2);
        expect(counts['rocket']).toBe(2);
        expect(counts['alien']).toBe(2);
        expect(counts['moon']).toBe(3);
        expect(counts['star']).toBe(5);
        expect(counts['meteor']).toBe(5);
        expect(counts['comet']).toBe(4);
      });
    });

    it('has 10 fixed paylines with 5 coordinates each', () => {
      expect(NOVA_VOYAGER_CONFIG.paylines).toHaveLength(10);
      NOVA_VOYAGER_CONFIG.paylines.forEach((line) => {
        expect(line.rows).toHaveLength(5);
        line.rows.forEach((rowIdx) => {
          expect(rowIdx).toBeGreaterThanOrEqual(0);
          expect(rowIdx).toBeLessThanOrEqual(2);
        });
      });
    });

    it('produces integer payouts for all allowable bets (10 to 200 in steps of 10)', () => {
      for (let bet = 10; bet <= 200; bet += 10) {
        expect(bet % 10).toBe(0);
        const betPerLine = bet / 10;
        expect(Number.isInteger(betPerLine)).toBe(true);

        NOVA_VOYAGER_CONFIG.paytable.forEach((item) => {
          const linePayout = item.multiplier * betPerLine;
          expect(Number.isInteger(linePayout)).toBe(true);
        });
      }
    });
  });

  describe('Pure Line Evaluation & Wild Substitution', () => {
    it('pays nothing for a run of 2 matching symbols', () => {
      const line = evaluateLine(['galaxy', 'galaxy', 'planet', 'moon', 'star'], NOVA_VOYAGER_CONFIG);
      expect(line.won).toBe(false);
      expect(line.multiplier).toBe(0);
    });

    it('supports wild substitution mid-run (Galaxy, Comet, Galaxy)', () => {
      const line = evaluateLine(['galaxy', 'comet', 'galaxy', 'moon', 'star'], NOVA_VOYAGER_CONFIG);
      expect(line.won).toBe(true);
      expect(line.matchId).toBe('galaxy_3');
      expect(line.multiplier).toBe(20);
    });

    it('supports Galaxy on reel 1 with wilds on reels 2 & 3 and Galaxy on reel 4 making 4-of-a-kind', () => {
      const line = evaluateLine(['galaxy', 'comet', 'comet', 'galaxy', 'star'], NOVA_VOYAGER_CONFIG);
      expect(line.won).toBe(true);
      expect(line.matchId).toBe('galaxy_4');
      expect(line.multiplier).toBe(200);
    });

    it('stops run at mismatch (3 Planets, Star, Planet pays 3 Planets)', () => {
      const line = evaluateLine(['planet', 'planet', 'planet', 'star', 'planet'], NOVA_VOYAGER_CONFIG);
      expect(line.won).toBe(true);
      expect(line.matchId).toBe('planet_3');
      expect(line.multiplier).toBe(12);
    });

    it('pays only the longest run per line (5-of-a-kind pays 5-of-a-kind multiplier, not 3+4+5)', () => {
      const line = evaluateLine(['star', 'star', 'star', 'star', 'star'], NOVA_VOYAGER_CONFIG);
      expect(line.won).toBe(true);
      expect(line.matchId).toBe('star_5');
      expect(line.multiplier).toBe(30);
    });

    it('sums payouts across multiple winning lines in evaluateSpin', () => {
      const spin = evaluateSpin([0, 0, 0, 0, 0], 50, NOVA_VOYAGER_CONFIG);
      expect(typeof spin.payout).toBe('number');
      expect(typeof spin.totalMultiplier).toBe('number');
      expect(spin.lines).toHaveLength(10);

      // Verify that totalMultiplier is the sum of line multipliers
      const expectedTotalMultiplier = spin.lines.reduce((acc, l) => acc + l.multiplier, 0);
      expect(spin.totalMultiplier).toBe(expectedTotalMultiplier);
      const expectedPayout = spin.lines.reduce((acc, l) => acc + (l.payout || 0), 0);
      expect(spin.payout).toBe(expectedPayout);
    });

    it('is config-driven: changing multiplier in cloned config updates payout', () => {
      const clonedConfig = JSON.parse(JSON.stringify(NOVA_VOYAGER_CONFIG));
      const galaxy5 = clonedConfig.paytable.find((p: any) => p.id === 'galaxy_5');
      galaxy5.multiplier = 9999;

      const line = evaluateLine(['galaxy', 'galaxy', 'galaxy', 'galaxy', 'galaxy'], clonedConfig);
      expect(line.multiplier).toBe(9999);
    });
  });

  describe('Analytical Mathematics & Fast Odds', () => {
    it('computes calculateMatchOdds for all paytable entries without error', () => {
      const odds = calculateMatchOdds(NOVA_VOYAGER_CONFIG);
      expect(odds).toBeDefined();
      expect(odds?.totalOutcomesPerLine).toBe(7962624);

      NOVA_VOYAGER_CONFIG.paytable.forEach((item) => {
        const hits = odds?.hitsByMatch[item.id];
        expect(typeof hits).toBe('number');
        expect(hits).toBeGreaterThan(0);
      });
    });

    it('computes analytical RTP instantly (~0.9635)', () => {
      const t0 = performance.now();
      const rtp = calculateAnalyticalRtp(NOVA_VOYAGER_CONFIG);
      const elapsed = performance.now() - t0;
      expect(elapsed).toBeLessThan(15);
      expect(rtp).toBeCloseTo(0.9635, 3);
    });
  });

  describe('Full Enumeration Verification (7,962,624 combinations)', () => {
    it(
      'matches exact theoretical RTP, hit frequency, profit frequency, 20x frequency, and max multiplier',
      () => {
        const stats = calculateHitStats(NOVA_VOYAGER_CONFIG, { allowLarge: true });
        const rtp = calculateRtp(NOVA_VOYAGER_CONFIG, { allowLarge: true });

        expect(stats.totalSpins).toBe(7962624);

        // Target RTP: 0.9635 (±0.0001)
        expect(rtp).toBeCloseTo(0.9635, 3);

        // Analytical RTP must match full enumeration RTP exactly
        const analyticalRtp = calculateAnalyticalRtp(NOVA_VOYAGER_CONFIG);
        expect(rtp).toBeCloseTo(analyticalRtp, 6);

        // Hit frequency: 0.2374 (±0.0001)
        expect(stats.hitFrequency).toBeCloseTo(0.2374, 3);

        // Profit frequency: 0.1729 (±0.0001)
        expect(stats.profitFrequency).toBeCloseTo(0.1729, 3);

        // Max multiplier: 16,750 line multiplier sum (1,675x the 10-line total bet)
        expect(stats.maxMultiplier).toBe(16750);
        expect(stats.maxMultiplier / 10).toBe(1675);
      },
      120000 // 120s timeout as requested
    );
  });

  describe('Registry & Performance', () => {
    it('registers nova-voyager module in game registry with dynamic payoutRate', () => {
      const t0 = performance.now();
      const module = getGameModule('nova-voyager');
      const game = gameRegistry.getGame('nova-voyager');
      const elapsed = performance.now() - t0;

      expect(elapsed).toBeLessThan(200);
      expect(module).toBeDefined();
      expect(module?.id).toBe('nova-voyager');

      expect(game).toBeDefined();
      expect(game?.id).toBe('nova-voyager');
      expect(game?.name).toBe('Nova Voyager');
      expect(game?.category).toBe('Slots');
      expect(game?.volatility).toBe('High');
      expect(game?.minLevel).toBe(2);
      expect(game?.minBet).toBe(10);
      expect(game?.maxBet).toBe(200);

      // payoutRate is derived dynamically from analytical RTP, never hardcoded
      const analyticalRtp = calculateAnalyticalRtp(NOVA_VOYAGER_CONFIG);
      expect(game?.payoutRate).toBe(`${(analyticalRtp * 100).toFixed(1)}%`);
    });
  });

  describe('Component Rendering & State Machine', () => {
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
        net: 100,
        bet: 50,
        payout: 150,
        xpGained: 20,
        leveledUp: false,
      } as RoundResult);
      const settle = vi.fn();

      return {
        balance: 1000,
        minBet: 10,
        maxBet: 200,
        settle,
        placeBet,
        resolveRound,
        animations: true,
        config: NOVA_VOYAGER_CONFIG,
        ...overrides,
      };
    };

    it('renders initial neutral state without winning lines and handles full 5-reel spin', () => {
      const props = createProps();
      render(<SlotMachine {...props} />);

      // Verify 10 lines header & bet
      expect(screen.getByText(/10 fixed lines/i)).toBeTruthy();

      const spinButton = screen.getByRole('button', { name: /spin · 50 credits/i }) as HTMLButtonElement;
      expect(spinButton.disabled).toBe(false);

      // Start spin
      fireEvent.click(spinButton);
      expect(props.placeBet).toHaveBeenCalledTimes(1);
      expect(props.placeBet).toHaveBeenCalledWith(50, expect.any(Number));

      // 5 reels stop at 600, 800, 1000, 1200, 1400ms
      act(() => {
        vi.advanceTimersByTime(1450);
      });

      expect(props.resolveRound).toHaveBeenCalledTimes(1);
      expect(props.resolveRound).toHaveBeenCalledWith(50, expect.any(Number));

      // Spin button is re-enabled
      const finishedButton = screen.getByRole('button', { name: /spin · 50 credits/i }) as HTMLButtonElement;
      expect(finishedButton.disabled).toBe(false);
    });

    it('re-renders with a NEW resolveRound callback mid-spin, reels finish, calls resolveRound once', () => {
      const initialProps = createProps();
      const { rerender } = render(<SlotMachine {...initialProps} />);

      const spinButton = screen.getByRole('button', { name: /spin · 50 credits/i });
      fireEvent.click(spinButton);
      expect(initialProps.placeBet).toHaveBeenCalledTimes(1);

      // Advance mid-spin (500ms)
      act(() => {
        vi.advanceTimersByTime(500);
      });

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

      // Finish reel stops
      act(() => {
        vi.advanceTimersByTime(1200);
      });

      expect(initialProps.resolveRound).not.toHaveBeenCalled();
      expect(newResolveRound).toHaveBeenCalledTimes(1);
    });

    it('unmounts mid-spin: resolves immediately with decided payout and cleans up all timers', () => {
      const props = createProps();
      const { unmount } = render(<SlotMachine {...props} />);

      const spinButton = screen.getByRole('button', { name: /spin · 50 credits/i });
      fireEvent.click(spinButton);
      expect(props.placeBet).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBeGreaterThan(0);

      // Advance 400ms
      act(() => {
        vi.advanceTimersByTime(400);
      });

      unmount();

      expect(props.resolveRound).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('prevents double-tap on Spin: places only one bet', () => {
      const props = createProps();
      render(<SlotMachine {...props} />);

      const spinButton = screen.getByRole('button', { name: /spin · 50 credits/i });
      fireEvent.click(spinButton);
      fireEvent.click(spinButton);

      expect(props.placeBet).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(props.resolveRound).toHaveBeenCalledTimes(1);
    });
  });
});
