import { describe, it, expect } from 'vitest';
import {
  BetType,
  resolveRoll,
  calculateRtp,
  isValidBet,
  MULTIPLIERS,
} from './diceRules';
import { rollDie } from './rng';
import { settleRound, WalletProfile } from '../../economy/wallet';

const createTestProfile = (overrides: Partial<WalletProfile> = {}): WalletProfile => ({
  id: 'test_patron',
  name: 'Tahn',
  avatarUrl: '/images/character_avatar_1793671261002.jpg',
  xp: 100,
  credits: 1000,
  gamesPlayed: 5,
  totalWinnings: 200,
  totalLosses: 100,
  createdAt: 1000000,
  dailyStreak: 1,
  ...overrides,
});

describe('Dice Mini-Game Rules & Mechanics', () => {
  describe('All 36 Combinations Enumeration', () => {
    const allOutcomes: [number, number][] = [];
    for (let d1 = 1; d1 <= 6; d1++) {
      for (let d2 = 1; d2 <= 6; d2++) {
        allOutcomes.push([d1, d2]);
      }
    }

    it('has exactly 36 distinct dice combinations', () => {
      expect(allOutcomes.length).toBe(36);
    });

    it('Low wins exactly 15 combinations (totals 2-6)', () => {
      let winCount = 0;
      allOutcomes.forEach(([d1, d2]) => {
        const res = resolveRoll('low', d1, d2, 100);
        if (res.isWin) winCount++;
      });
      expect(winCount).toBe(15);
    });

    it('High wins exactly 15 combinations (totals 8-12)', () => {
      let winCount = 0;
      allOutcomes.forEach(([d1, d2]) => {
        const res = resolveRoll('high', d1, d2, 100);
        if (res.isWin) winCount++;
      });
      expect(winCount).toBe(15);
    });

    it('Lucky Seven wins exactly 6 combinations (total 7)', () => {
      let winCount = 0;
      allOutcomes.forEach(([d1, d2]) => {
        const res = resolveRoll('seven', d1, d2, 100);
        if (res.isWin) winCount++;
      });
      expect(winCount).toBe(6);
    });

    it('Doubles wins exactly 6 combinations (matching pairs 1-1 to 6-6)', () => {
      let winCount = 0;
      allOutcomes.forEach(([d1, d2]) => {
        const res = resolveRoll('doubles', d1, d2, 100);
        if (res.isWin) winCount++;
      });
      expect(winCount).toBe(6);
    });

    it('verifies a roll of 7 loses Low and loses High', () => {
      const sevens: [number, number][] = [
        [1, 6],
        [2, 5],
        [3, 4],
        [4, 3],
        [5, 2],
        [6, 1],
      ];

      sevens.forEach(([d1, d2]) => {
        expect(d1 + d2).toBe(7);

        const lowRes = resolveRoll('low', d1, d2, 100);
        expect(lowRes.isWin).toBe(false);
        expect(lowRes.payout).toBe(0);

        const highRes = resolveRoll('high', d1, d2, 100);
        expect(highRes.isWin).toBe(false);
        expect(highRes.payout).toBe(0);

        const sevenRes = resolveRoll('seven', d1, d2, 100);
        expect(sevenRes.isWin).toBe(true);
        expect(sevenRes.payout).toBe(Math.round(100 * MULTIPLIERS.seven));
      });
    });
  });

  describe('Payouts Whole Number Rounding', () => {
    it('verifies payouts are whole numbers across bets 10..1000 in steps of 10 for all bet types', () => {
      const betTypes: BetType[] = ['low', 'high', 'seven', 'doubles'];

      for (let bet = 10; bet <= 1000; bet += 10) {
        betTypes.forEach((type) => {
          // Test with a winning roll for this bet type
          const [d1, d2]: [number, number] =
            type === 'low'
              ? [1, 2]
              : type === 'high'
              ? [5, 4]
              : type === 'seven'
              ? [3, 4]
              : [3, 3];

          const winRes = resolveRoll(type, d1, d2, bet);
          expect(winRes.isWin).toBe(true);
          expect(Number.isInteger(winRes.payout)).toBe(true);
          expect(winRes.payout).toBe(Math.round(bet * MULTIPLIERS[type]));

          // Test with a losing roll
          const loseRes = resolveRoll(type, 7, 0, bet); // impossible sum or opposite
          // Using a guaranteed losing outcome
          const [loseD1, loseD2]: [number, number] =
            type === 'low' ? [6, 6] : type === 'high' ? [1, 1] : type === 'seven' ? [1, 1] : [1, 2];
          const loseOutcome = resolveRoll(type, loseD1, loseD2, bet);
          expect(loseOutcome.isWin).toBe(false);
          expect(loseOutcome.payout).toBe(0);
        });
      }
    });
  });

  describe('RTP (Return to Player) Precision', () => {
    it('matches expected theoretical RTP within 0.0001 precision', () => {
      // Low: 15 / 36 * 2.3 = 0.958333...
      const rtpLow = calculateRtp('low');
      expect(rtpLow).toBeCloseTo(0.9583, 3);
      expect(Math.abs(rtpLow - 0.9583333333333334)).toBeLessThan(0.0001);

      // High: 15 / 36 * 2.3 = 0.958333...
      const rtpHigh = calculateRtp('high');
      expect(rtpHigh).toBeCloseTo(0.9583, 3);
      expect(Math.abs(rtpHigh - 0.9583333333333334)).toBeLessThan(0.0001);

      // Seven: 6 / 36 * 5.9 = 0.983333...
      const rtpSeven = calculateRtp('seven');
      expect(rtpSeven).toBeCloseTo(0.9833, 3);
      expect(Math.abs(rtpSeven - 0.9833333333333334)).toBeLessThan(0.0001);

      // Doubles: 6 / 36 * 5.9 = 0.983333...
      const rtpDoubles = calculateRtp('doubles');
      expect(rtpDoubles).toBeCloseTo(0.9833, 3);
      expect(Math.abs(rtpDoubles - 0.9833333333333334)).toBeLessThan(0.0001);
    });
  });

  describe('Bet Validation (isValidBet)', () => {
    const minBet = 10;
    const maxBet = 800;
    const balance = 500;

    it('rejects bet <= 0', () => {
      const res0 = isValidBet(0, minBet, maxBet, balance);
      expect(res0.valid).toBe(false);
      expect(res0.reason).toMatch(/greater than zero/i);

      const resNeg = isValidBet(-25, minBet, maxBet, balance);
      expect(resNeg.valid).toBe(false);
      expect(resNeg.reason).toMatch(/greater than zero/i);
    });

    it('rejects bet > balance', () => {
      const res = isValidBet(550, minBet, maxBet, balance);
      expect(res.valid).toBe(false);
      expect(res.reason).toMatch(/insufficient/i);
    });

    it('rejects bet < minBet', () => {
      const res = isValidBet(5, minBet, maxBet, balance);
      expect(res.valid).toBe(false);
      expect(res.reason).toMatch(/at least/i);
    });

    it('rejects bet > maxBet', () => {
      const highBalance = 2000;
      const res = isValidBet(900, minBet, maxBet, highBalance);
      expect(res.valid).toBe(false);
      expect(res.reason).toMatch(/cannot exceed/i);
    });

    it('rejects bets that are not multiples of 10 (e.g. 15 and 237)', () => {
      const res15 = isValidBet(15, minBet, maxBet, balance);
      expect(res15.valid).toBe(false);
      expect(res15.reason).toBe('Wagers must be in steps of 10.');

      const res237 = isValidBet(237, minBet, maxBet, balance);
      expect(res237.valid).toBe(false);
      expect(res237.reason).toBe('Wagers must be in steps of 10.');
    });

    it('accepts valid bets within boundaries', () => {
      expect(isValidBet(10, minBet, maxBet, balance).valid).toBe(true);
      expect(isValidBet(100, minBet, maxBet, balance).valid).toBe(true);
      expect(isValidBet(500, minBet, maxBet, balance).valid).toBe(true);
    });
  });

  describe('RNG Bounds & Deterministic Test Injection', () => {
    it('produces only integers 1..6 over 10,000 rolls with default crypto RNG', () => {
      const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

      for (let i = 0; i < 10000; i++) {
        const roll = rollDie();
        expect(Number.isInteger(roll)).toBe(true);
        expect(roll).toBeGreaterThanOrEqual(1);
        expect(roll).toBeLessThanOrEqual(6);
        counts[roll]++;
      }

      // Every face should be sampled reasonably in 10,000 rolls
      for (let face = 1; face <= 6; face++) {
        expect(counts[face]).toBeGreaterThan(1200);
      }
    });

    it('accepts an injected mock RNG sequence for deterministic testing', () => {
      const sequence = [1, 2, 3, 4, 5, 6];
      let idx = 0;
      const mockRng = () => sequence[idx++];

      for (let expected = 1; expected <= 6; expected++) {
        expect(rollDie(mockRng)).toBe(expected);
      }
    });
  });

  describe('Integration with Central Economy (settleRound)', () => {
    it('settles a winning Seven roll with bet 100: awards net +490, updates balance and increments gamesPlayed', () => {
      const initialProfile = createTestProfile({ credits: 1000, gamesPlayed: 3, totalWinnings: 0 });

      // Roll 3 + 4 = 7 on 'seven' bet
      const rollRes = resolveRoll('seven', 3, 4, 100);
      expect(rollRes.isWin).toBe(true);
      expect(rollRes.payout).toBe(590); // 100 * 5.9 = 590 total returned

      // Pass directly to settleRound
      const { profile: updated, result } = settleRound(initialProfile, 100, rollRes.payout);

      expect(result.success).toBe(true);
      expect(result.won).toBe(true);
      expect(result.net).toBe(490); // Net profit: 590 - 100 = 490
      expect(result.bet).toBe(100);
      expect(result.payout).toBe(590);

      // Final balance: 1000 - 100 (bet) + 590 (payout) = 1490
      expect(updated.credits).toBe(1490);
      expect(updated.gamesPlayed).toBe(4);
      expect(updated.totalWinnings).toBe(490);
    });

    it('settles a losing roll with bet 100: deducts net -100, updates balance and increments gamesPlayed', () => {
      const initialProfile = createTestProfile({ credits: 1000, gamesPlayed: 3, totalLosses: 0 });

      // Roll 3 + 4 = 7 on 'low' bet (7 loses Low)
      const rollRes = resolveRoll('low', 3, 4, 100);
      expect(rollRes.isWin).toBe(false);
      expect(rollRes.payout).toBe(0);

      const { profile: updated, result } = settleRound(initialProfile, 100, rollRes.payout);

      expect(result.success).toBe(true);
      expect(result.won).toBe(false);
      expect(result.net).toBe(-100);
      expect(updated.credits).toBe(900);
      expect(updated.gamesPlayed).toBe(4);
      expect(updated.totalLosses).toBe(100);
    });
  });
});
