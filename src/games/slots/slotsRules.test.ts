import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import * as slotsRulesModule from './slotsRules';
import {
  DEFAULT_SLOTS_CONFIG,
  SlotsConfig,
  SymbolId,
} from './slotsConfig';
import {
  getWindow,
  evaluateLine,
  evaluateSpin,
  evaluateSpinFast,
  calculateRtp,
  calculateAnalyticalRtp,
  calculateMatchOdds,
  calculateHitStats,
} from './slotsRules';
import { registerRuleSet } from './ruleSets';
import { randomInt } from '../shared/rng';
import {
  settleRound,
  placeBet,
  resolveRound,
  applyDailyBonus,
  WalletProfile,
} from '../../economy/wallet';

const createMockProfile = (overrides: Partial<WalletProfile> = {}): WalletProfile => ({
  id: 'test_patron',
  name: 'Tahn',
  avatarUrl: '/images/character_avatar_1793671261002.jpg',
  xp: 150,
  credits: 1000,
  gamesPlayed: 10,
  totalWinnings: 500,
  totalLosses: 300,
  createdAt: 1000000,
  dailyStreak: 2,
  ...overrides,
});

describe('Lucky Slots Rules & Math Engine', () => {
  describe('Exhaustive 8,000 Stop Combinations Verification', () => {
    it('enumerates all 8,000 stop combinations and asserts exact hit frequencies', () => {
      const stats = calculateHitStats(DEFAULT_SLOTS_CONFIG);

      expect(stats.totalSpins).toBe(8000);

      // Exact combination counts requested:
      expect(stats.hitsByMatch['three_sevens']).toBe(1);
      expect(stats.hitsByMatch['three_emeralds']).toBe(8);
      expect(stats.hitsByMatch['three_bars']).toBe(27);
      expect(stats.hitsByMatch['three_bells']).toBe(125);
      expect(stats.hitsByMatch['three_cherries']).toBe(216);
      expect(stats.hitsByMatch['two_cherries']).toBe(1512);
      expect(stats.hitsByMatch['one_cherry_reel_1']).toBe(1176);

      // Total paying spins: 1 + 8 + 27 + 125 + 216 + 1512 + 1176 = 3065
      expect(stats.totalHits).toBe(3065);

      // Total spins paying more than the bet (multiplier > 1): 1 + 8 + 27 + 125 + 216 + 1512 = 1889
      expect(stats.totalProfits).toBe(1889);
    });

    it('calculates theoretical RTP equaling 0.9649 within 0.0001', () => {
      const rtp = calculateRtp(DEFAULT_SLOTS_CONFIG);

      // Exact RTP is 7719 / 8000 = 0.964875
      expect(rtp).toBeCloseTo(0.9649, 4);
      expect(Math.abs(rtp - 0.9649)).toBeLessThan(0.0001);

      const stats = calculateHitStats(DEFAULT_SLOTS_CONFIG);
      expect(stats.hitFrequency).toBeCloseTo(3065 / 8000, 5);
      expect(stats.profitFrequency).toBeCloseTo(1889 / 8000, 5);
    });

    it('fast analytical RTP calculation exactly matches full combinatorial enumeration', () => {
      const analyticalRtp = calculateAnalyticalRtp(DEFAULT_SLOTS_CONFIG);
      const enumeratedRtp = calculateRtp(DEFAULT_SLOTS_CONFIG);

      // Must match exactly (7719 / 8000 = 0.964875)
      expect(analyticalRtp).toBeCloseTo(0.964875, 6);
      expect(analyticalRtp).toBeCloseTo(enumeratedRtp, 6);
    });

    it('calculateMatchOdds for Lucky Slots equals the counts from calculateHitStats (1, 8, 27, 125, 216, 1512, 1176)', () => {
      const matchOdds = calculateMatchOdds(DEFAULT_SLOTS_CONFIG);
      expect(matchOdds).toBeDefined();
      expect(matchOdds!.totalOutcomesPerLine).toBe(8000);

      expect(matchOdds!.hitsByMatch['three_sevens']).toBe(1);
      expect(matchOdds!.hitsByMatch['three_emeralds']).toBe(8);
      expect(matchOdds!.hitsByMatch['three_bars']).toBe(27);
      expect(matchOdds!.hitsByMatch['three_bells']).toBe(125);
      expect(matchOdds!.hitsByMatch['three_cherries']).toBe(216);
      expect(matchOdds!.hitsByMatch['two_cherries']).toBe(1512);
      expect(matchOdds!.hitsByMatch['one_cherry_reel_1']).toBe(1176);

      const stats = calculateHitStats(DEFAULT_SLOTS_CONFIG);
      expect(matchOdds!.hitsByMatch['three_sevens']).toBe(stats.hitsByMatch['three_sevens']);
      expect(matchOdds!.hitsByMatch['three_emeralds']).toBe(stats.hitsByMatch['three_emeralds']);
      expect(matchOdds!.hitsByMatch['three_bars']).toBe(stats.hitsByMatch['three_bars']);
      expect(matchOdds!.hitsByMatch['three_bells']).toBe(stats.hitsByMatch['three_bells']);
      expect(matchOdds!.hitsByMatch['three_cherries']).toBe(stats.hitsByMatch['three_cherries']);
      expect(matchOdds!.hitsByMatch['two_cherries']).toBe(stats.hitsByMatch['two_cherries']);
      expect(matchOdds!.hitsByMatch['one_cherry_reel_1']).toBe(stats.hitsByMatch['one_cherry_reel_1']);
    });
  });

  describe('Runtime Safety & Efficiency', () => {
    it('throws when calculateRtp is called on large configs (>200,000 spins) without allowLarge, but works with allowLarge', () => {
      // 5 reels x 24 stops = 24^5 = 7,962,624 spins (> 200,000)
      const strip24: SymbolId[] = Array(24).fill('blank');
      strip24[0] = 'seven';

      registerRuleSet({
        id: 'test-5reel-all7',
        name: '5-Reel All 7s',
        evaluateLine: (symbols) => {
          const all7 = symbols.every((s) => s === 'seven');
          if (all7) {
            return { multiplier: 1000, matchId: 'five_sevens', matchDescription: '5x Seven', won: true };
          }
          return { multiplier: 0, matchId: 'no_win', matchDescription: 'No Win', won: false };
        },
      });

      const bigConfig: SlotsConfig = {
        reelsCount: 5,
        visibleRows: 3,
        stopsPerReel: [24, 24, 24, 24, 24],
        reelStrips: [strip24, strip24, strip24, strip24, strip24],
        paylines: [{ id: 'center', name: 'Center', rows: [1, 1, 1, 1, 1] }],
        paytable: [{ id: 'five_sevens', name: '5x Seven', multiplier: 1000, description: '7 · 7 · 7 · 7 · 7' }],
        ruleSet: 'test-5reel-all7',
      };

      // Calling calculateRtp without allowLarge throws
      expect(() => calculateRtp(bigConfig)).toThrow(/exceeds safety limit/);
      expect(() => calculateHitStats(bigConfig)).toThrow(/exceeds safety limit/);

      // With allowLarge it works and returns expected RTP (1 hit out of 7,962,624 paying 1000x)
      const rtp = calculateRtp(bigConfig, { allowLarge: true });
      expect(typeof rtp).toBe('number');
      expect(rtp).toBeCloseTo(1000 / 7962624, 6);
    });

    it('proves the lean path (evaluateSpinFast) and evaluateSpin agree on payout, multiplier, and matchIds across sample spins', () => {
      // 1. Single line DEFAULT_SLOTS_CONFIG
      const sampleStops = [
        [13, 10, 5],
        [6, 5, 7],
        [2, 3, 0],
        [1, 0, 2],
        [0, 1, 1],
        [0, 1, 3],
        [0, 0, 0],
        [4, 2, 3],
      ];

      for (const stops of sampleStops) {
        const full = evaluateSpin(stops, 100, DEFAULT_SLOTS_CONFIG);
        const lean = evaluateSpinFast(stops, 100, DEFAULT_SLOTS_CONFIG);
        expect(lean.payout).toBe(full.payout);
        expect(lean.totalMultiplier).toBe(full.totalMultiplier);
        expect(lean.won).toBe(full.won);
        expect(lean.isProfit).toBe(full.isProfit);
        expect(lean.matchIds).toEqual(full.lines.map((l) => l.matchId));
      }

      // 2. Multi-line, 3-reel config with top, middle, and bottom paylines
      const multiLineConfig: SlotsConfig = {
        ...DEFAULT_SLOTS_CONFIG,
        paylines: [
          { id: 'top', name: 'Top Line', rows: [0, 0, 0] },
          { id: 'middle', name: 'Middle Line', rows: [1, 1, 1] },
          { id: 'bottom', name: 'Bottom Line', rows: [2, 2, 2] },
        ],
      };

      for (let s0 = 0; s0 < 20; s0 += 4) {
        for (let s1 = 0; s1 < 20; s1 += 4) {
          for (let s2 = 0; s2 < 20; s2 += 4) {
            const stops = [s0, s1, s2];
            const full = evaluateSpin(stops, 90, multiLineConfig);
            const lean = evaluateSpinFast(stops, 90, multiLineConfig);
            expect(lean.payout).toBe(full.payout);
            expect(lean.totalMultiplier).toBe(full.totalMultiplier);
            expect(lean.won).toBe(full.won);
            expect(lean.isProfit).toBe(full.isProfit);
            expect(lean.matchIds).toEqual(full.lines.map((l) => l.matchId));
          }
        }
      }
    });

    it('importing the registry and rendering Lucky Slots machine does not call calculateRtp or calculateHitStats', async () => {
      const rtpSpy = vi.spyOn(slotsRulesModule, 'calculateRtp');
      const hitStatsSpy = vi.spyOn(slotsRulesModule, 'calculateHitStats');

      const { gameRegistry } = await import('../registry');
      const luckySlotsModule = gameRegistry.getModule('lucky-slots');
      expect(luckySlotsModule).toBeDefined();

      const Component = luckySlotsModule!.component;
      const { renderToString } = await import('react-dom/server');

      renderToString(
        React.createElement(Component, {
          balance: 1000,
          minBet: 10,
          maxBet: 500,
          settle: vi.fn(),
          placeBet: vi.fn(),
          resolveRound: vi.fn(),
          animations: false,
        })
      );

      expect(rtpSpy).not.toHaveBeenCalled();
      expect(hitStatsSpy).not.toHaveBeenCalled();

      rtpSpy.mockRestore();
      hitStatsSpy.mockRestore();
    });
  });

  describe('Multi-Line Hit Statistics', () => {
    it('counts hitsByMatch across all paylines and tracks spinsWithAnyWin, spinsReturningMoreThanBet, and maxMultiplier', () => {
      // 3 reels x 4 stops = 64 total spins, 2 paylines (center and top)
      const strip4: SymbolId[] = ['cherry', 'seven', 'blank', 'bell'];
      const multiLineConfig: SlotsConfig = {
        reelsCount: 3,
        visibleRows: 3,
        stopsPerReel: [4, 4, 4],
        reelStrips: [strip4, strip4, strip4],
        paylines: [
          { id: 'center', name: 'Center', rows: [1, 1, 1] },
          { id: 'top', name: 'Top', rows: [0, 0, 0] },
        ],
        paytable: DEFAULT_SLOTS_CONFIG.paytable,
        ruleSet: 'classic-cherry-3reel',
      };

      const stats = calculateHitStats(multiLineConfig);
      expect(stats.totalSpins).toBe(64);

      // Verify hits across both lines are accumulated into hitsByMatch
      const totalLineEvaluations = Object.values(stats.hitsByMatch).reduce((a, b) => a + b, 0);
      expect(totalLineEvaluations).toBe(64 * 2); // 2 lines evaluated per spin = 128 total evaluations

      expect(stats.spinsWithAnyWin).toBeGreaterThan(0);
      expect(stats.spinsReturningMoreThanBet).toBeGreaterThan(0);
      expect(stats.maxMultiplier).toBeGreaterThan(0);

      // spinsWithAnyWin cannot exceed total spins
      expect(stats.spinsWithAnyWin).toBeLessThanOrEqual(stats.totalSpins);
    });
  });

  describe('Generic N-Reel Engine Support', () => {
    it('evaluates arbitrary reel counts (e.g. 2-reel machine) with custom paylines and unequal strip lengths', () => {
      // Register custom 2-reel rule set
      registerRuleSet({
        id: 'test-2reel-match',
        name: '2-Reel Matcher',
        evaluateLine: (symbols) => {
          if (symbols[0] === symbols[1] && symbols[0] === 'seven') {
            return { multiplier: 50, matchId: 'double_seven', matchDescription: 'Double 7', won: true };
          }
          return { multiplier: 0, matchId: 'no_win', matchDescription: 'No Win', won: false };
        },
      });

      const custom2ReelConfig: SlotsConfig = {
        reelsCount: 2,
        visibleRows: 3,
        stopsPerReel: [4, 5], // Unequal strip lengths: Reel 0 has 4 stops, Reel 1 has 5 stops
        reelStrips: [
          ['seven', 'blank', 'cherry', 'bell'], // 1 seven out of 4
          ['blank', 'seven', 'bar', 'bell', 'emerald'], // 1 seven out of 5
        ],
        paylines: [
          { id: 'center', name: 'Center', rows: [1, 1] },
        ],
        paytable: [
          { id: 'double_seven', name: 'Double 7', multiplier: 50, description: '7 · 7' },
        ],
        ruleSet: 'test-2reel-match',
      };

      // Total combinations = 4 * 5 = 20
      const stats = calculateHitStats(custom2ReelConfig);
      expect(stats.totalSpins).toBe(20);
      // Double seven can hit on exactly stop (0 on reel 0, 1 on reel 1)
      expect(stats.hitsByMatch['double_seven']).toBe(1);
      expect(stats.totalHits).toBe(1);

      // RTP = (1 * 50) / 20 = 2.5 (250%)
      const rtp = calculateRtp(custom2ReelConfig);
      expect(rtp).toBe(2.5);
    });
  });

  describe('Whole-Number Payouts for Allowed Bets', () => {
    it('produces integer payouts across all allowed bets from 10 to 500 step 10 for every outcome', () => {
      const sampleStops = [
        [13, 10, 5], // 3 sevens (500x)
        [6, 5, 7],   // 3 emeralds (60x)
        [2, 3, 0],   // 3 bars (25x)
        [1, 0, 2],   // 3 bells (8x)
        [0, 1, 1],   // 3 cherries (4x)
        [0, 1, 3],   // 2 cherries (2x)
        [0, 0, 0],   // 1 cherry on reel 1 (1x)
        [4, 2, 3],   // blank / no win (0x)
      ];

      for (let bet = 10; bet <= 500; bet += 10) {
        sampleStops.forEach((stops) => {
          const spin = evaluateSpin(stops, bet, DEFAULT_SLOTS_CONFIG);
          expect(Number.isInteger(spin.payout)).toBe(true);
          expect(spin.payout % 1).toBe(0);
        });
      }
    });
  });

  describe('Middle-Row-Only Payline Rule', () => {
    it('confirms symbols on row 0 (above) and row 2 (below) never change the payout', () => {
      // Create two configs that have identical middle stops but different neighbor symbols on strips
      const stops = [0, 0, 0];
      const spin1 = evaluateSpin(stops, 100, DEFAULT_SLOTS_CONFIG);

      // The symbols on row 1 (the payline) define the win
      const lineSymbols = spin1.window[1];
      const lineEval = evaluateLine(lineSymbols, DEFAULT_SLOTS_CONFIG);

      expect(spin1.lines[0].multiplier).toBe(lineEval.multiplier);
      expect(spin1.payout).toBe(100 * lineEval.multiplier);

      // Modify the symbols above (row 0) or below (row 2) in a dummy custom config
      const modifiedConfig: SlotsConfig = {
        ...DEFAULT_SLOTS_CONFIG,
        reelStrips: DEFAULT_SLOTS_CONFIG.reelStrips.map((strip) => [...strip]),
      };
      // Change stop 19 (above stop 0) and stop 1 (below stop 0) on reel 0 to something else
      modifiedConfig.reelStrips[0][19] = 'seven';
      modifiedConfig.reelStrips[0][1] = 'seven';

      const spin2 = evaluateSpin(stops, 100, modifiedConfig);
      // Payout and multiplier must remain completely identical because only row 1 is the payline
      expect(spin2.totalMultiplier).toBe(spin1.totalMultiplier);
      expect(spin2.payout).toBe(spin1.payout);
    });
  });

  describe('Randomness & randomInt Unbiased Distribution', () => {
    it('returns exact values in range with an injected custom RNG', () => {
      const mockSequence = [0, 1, 10, 19];
      let idx = 0;
      const mockRng = () => mockSequence[idx++];

      for (let i = 0; i < mockSequence.length; i++) {
        expect(randomInt(20, mockRng)).toBe(mockSequence[i]);
      }
    });

    it('returns values strictly in [0, maxExclusive - 1] over 10,000 iterations of real crypto RNG', () => {
      const maxExclusive = 20;
      const counts: number[] = new Array(maxExclusive).fill(0);

      for (let i = 0; i < 10000; i++) {
        const val = randomInt(maxExclusive);
        expect(Number.isInteger(val)).toBe(true);
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(maxExclusive);
        counts[val]++;
      }

      // Expected ~500 occurrences per bin. Loose tolerance check (>= 300 each)
      counts.forEach((count) => {
        expect(count).toBeGreaterThan(300);
      });
    });
  });

  describe('Central Economy Integration (settleRound)', () => {
    it('correctly settles spin result through settleRound', () => {
      const initialProfile = createMockProfile({ credits: 1000, totalWinnings: 0, gamesPlayed: 5 });
      const bet = 50;

      // Spin with 3 bells -> 8x multiplier -> payout = 50 * 8 = 400
      // In REEL_0_STRIP index 1 is bell, REEL_1_STRIP index 0 is bell, REEL_2_STRIP index 2 is bell
      const stops = [1, 0, 2];
      const spin = evaluateSpin(stops, bet, DEFAULT_SLOTS_CONFIG);

      expect(spin.won).toBe(true);
      expect(spin.totalMultiplier).toBe(8);
      expect(spin.payout).toBe(400);

      const { profile: updated, result } = settleRound(initialProfile, bet, spin.payout);

      expect(result.success).toBe(true);
      expect(result.won).toBe(true);
      expect(result.bet).toBe(50);
      expect(result.payout).toBe(400);
      expect(result.net).toBe(350); // Net profit: 400 - 50 = 350

      // Balance: 1000 - 50 + 400 = 1350
      expect(updated.credits).toBe(1350);
      expect(updated.totalWinnings).toBe(350);
      expect(updated.gamesPlayed).toBe(6);
    });

    it('correctly settles a losing spin through settleRound', () => {
      const initialProfile = createMockProfile({ credits: 1000, totalLosses: 0, gamesPlayed: 5 });
      const bet = 50;

      // Spin with 3 blanks -> 0x multiplier -> payout = 0
      // In REEL_0_STRIP index 4 is blank, REEL_1_STRIP index 2 is blank, REEL_2_STRIP index 3 is blank
      const stops = [4, 2, 3];
      const spin = evaluateSpin(stops, bet, DEFAULT_SLOTS_CONFIG);

      expect(spin.won).toBe(false);
      expect(spin.totalMultiplier).toBe(0);
      expect(spin.payout).toBe(0);

      const { profile: updated, result } = settleRound(initialProfile, bet, spin.payout);

      expect(result.success).toBe(true);
      expect(result.won).toBe(false);
      expect(result.net).toBe(-50);
      expect(updated.credits).toBe(950);
      expect(updated.totalLosses).toBe(50);
      expect(updated.gamesPlayed).toBe(6);
    });
  });

  describe('Single Source of Truth: Config-Driven Multipliers & Names', () => {
    it('modifying a multiplier in a cloned config alters both payouts and paytable display data', () => {
      // Clone default config and modify the 3-sevens multiplier and name
      const clonedConfig: SlotsConfig = {
        ...DEFAULT_SLOTS_CONFIG,
        paytable: DEFAULT_SLOTS_CONFIG.paytable.map((item) =>
          item.id === 'three_sevens'
            ? { ...item, multiplier: 777, name: 'Grand Jackpot' }
            : { ...item }
        ),
      };

      const stops = [13, 10, 5]; // 3 sevens on center payline
      const bet = 100;

      // 1. Default config check
      const defaultSpin = evaluateSpin(stops, bet, DEFAULT_SLOTS_CONFIG);
      expect(defaultSpin.totalMultiplier).toBe(500);
      expect(defaultSpin.payout).toBe(50000);
      expect(defaultSpin.lines[0].matchDescription).toBe('3x Lucky Seven');

      // 2. Cloned config check: evaluateSpin must directly use the modified 777x multiplier & name
      const customSpin = evaluateSpin(stops, bet, clonedConfig);
      expect(customSpin.totalMultiplier).toBe(777);
      expect(customSpin.payout).toBe(77700);
      expect(customSpin.lines[0].matchDescription).toBe('Grand Jackpot');

      // 3. Cloned config's paytable display item reflects the update
      const payItem = clonedConfig.paytable.find((p) => p.id === 'three_sevens')!;
      expect(payItem.multiplier).toBe(777);
      expect(payItem.name).toBe('Grand Jackpot');
    });

    it('calculates hit stats dynamically from any custom or cloned config', () => {
      const stats = calculateHitStats(DEFAULT_SLOTS_CONFIG);
      expect(stats.totalSpins).toBe(8000);
      expect(stats.hitsByMatch['three_sevens']).toBe(1);
      expect(stats.hitsByMatch['three_emeralds']).toBe(8);
      expect(stats.hitsByMatch['three_bars']).toBe(27);
    });
  });

  describe('Escrow & Unmount Resolution with Fake Timers', () => {
    it('resolves immediately with already-decided payout when unmounted mid-spin', () => {
      vi.useFakeTimers();

      let patron = createMockProfile({ credits: 1000, gamesPlayed: 0 });
      const bet = 50;

      // 1. placeBet deducts the bet into escrow
      const betRes = placeBet(patron, bet);
      expect(betRes.success).toBe(true);
      patron = betRes.profile;
      expect(patron.credits).toBe(950);

      // 2. Predetermined outcome: 3 bells (8x multiplier -> payout 400)
      const winningStops = [1, 0, 2];
      const spinEval = evaluateSpin(winningStops, bet, DEFAULT_SLOTS_CONFIG);
      expect(spinEval.payout).toBe(400);

      // Emulate SlotsGame pending resolution ref and timer handles
      let pendingResolution: { wager: number; payout: number } | null = {
        wager: bet,
        payout: spinEval.payout,
      };
      let resolvedCount = 0;

      const finishResolution = (wagerAmount: number, payoutAmount: number) => {
        resolvedCount++;
        const res = resolveRound(patron, wagerAmount, payoutAmount);
        patron = res.profile;
        return res;
      };

      // Animation timer scheduled to resolve in 1200ms
      const timerId = setTimeout(() => {
        if (pendingResolution) {
          const { wager: w, payout: p } = pendingResolution;
          pendingResolution = null;
          finishResolution(w, p);
        }
      }, 1200);

      // Advance time by 400ms (mid-spin)
      vi.advanceTimersByTime(400);
      expect(resolvedCount).toBe(0);
      expect(patron.credits).toBe(950);

      // Component unmount cleanup triggers: cancels timer and resolves immediately
      clearTimeout(timerId);
      if (pendingResolution) {
        const { wager: w, payout: p } = pendingResolution;
        pendingResolution = null;
        finishResolution(w, p);
      }

      expect(resolvedCount).toBe(1);
      // Balance is credited with the 400 payout: 950 + 400 = 1350
      expect(patron.credits).toBe(1350);
      expect(patron.gamesPlayed).toBe(1);

      // Advance timers past 1200ms to guarantee no double-resolution
      vi.advanceTimersByTime(2000);
      expect(resolvedCount).toBe(1);
      expect(patron.credits).toBe(1350);

      vi.useRealTimers();
    });

    it('preserves daily bonus applied between placeBet and resolveRound', () => {
      const initialProfile = createMockProfile({ credits: 1000, gamesPlayed: 0 });
      const bet = 100;

      // 1. placeBet deducts wager into escrow
      const betRes = placeBet(initialProfile, bet);
      expect(betRes.success).toBe(true);
      expect(betRes.profile.credits).toBe(900);

      // 2. Daily bonus claimed mid-spin (+1,000 credits & +200 XP)
      const bonusRes = applyDailyBonus(betRes.profile, 1000, 200);
      expect(bonusRes.profile.credits).toBe(1900);

      // 3. Round resolves with win (e.g. payout 250 on a 100 bet -> net +150)
      const resolveRes = resolveRound(bonusRes.profile, bet, 250);
      expect(resolveRes.result.success).toBe(true);
      expect(resolveRes.result.net).toBe(150);
      expect(resolveRes.result.payout).toBe(250);

      // Balance: 900 (after bet) + 1000 (daily bonus) + 250 (payout) = 2150
      expect(resolveRes.profile.credits).toBe(2150);
      expect(resolveRes.profile.gamesPlayed).toBe(1);
    });
  });
});
