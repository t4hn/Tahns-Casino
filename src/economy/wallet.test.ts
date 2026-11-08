import { describe, it, expect } from 'vitest';
import {
  WalletProfile,
  applyWager,
  applyPayout,
  applyXp,
  placeBet,
  resolveRound,
  settleRound,
  applyDailyBonus,
  applyAchievementReward,
  calculateLevelInfo,
} from './wallet';

const createMockProfile = (overrides: Partial<WalletProfile> = {}): WalletProfile => ({
  id: 'test_patron',
  name: 'Tahn',
  avatarUrl: '/images/character_avatar_1793671261002.jpg',
  xp: 0,
  credits: 1000,
  gamesPlayed: 0,
  totalWinnings: 0,
  totalLosses: 0,
  createdAt: 1000000,
  dailyStreak: 0,
  ...overrides,
});

describe('Pure Wallet & Economy Logic', () => {
  describe('Overdraft Prevention', () => {
    it('rejects a wager that exceeds current credit balance', () => {
      const profile = createMockProfile({ credits: 100 });
      const result = applyWager(profile, 150);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/insufficient/i);
      expect(result.profile.credits).toBe(100);
    });

    it('rejects zero or negative wagers', () => {
      const profile = createMockProfile({ credits: 500 });

      const zeroRes = applyWager(profile, 0);
      expect(zeroRes.success).toBe(false);
      expect(zeroRes.profile.credits).toBe(500);

      const negRes = applyWager(profile, -50);
      expect(negRes.success).toBe(false);
      expect(negRes.profile.credits).toBe(500);
    });

    it('settleRound refuses wagers that exceed balance or are non-positive', () => {
      const profile = createMockProfile({ credits: 200 });

      const overdraftRes = settleRound(profile, 250, 500);
      expect(overdraftRes.result.success).toBe(false);
      expect(overdraftRes.result.error).toMatch(/insufficient/i);
      expect(overdraftRes.profile.credits).toBe(200);

      const negBetRes = settleRound(profile, -10, 0);
      expect(negBetRes.result.success).toBe(false);
      expect(negBetRes.profile.credits).toBe(200);

      const zeroBetRes = settleRound(profile, 0, 0);
      expect(zeroBetRes.result.success).toBe(false);
      expect(zeroBetRes.profile.credits).toBe(200);
    });

    it('ensures balance never drops below zero on valid boundary wagers', () => {
      const profile = createMockProfile({ credits: 50 });
      const res = settleRound(profile, 50, 0);

      expect(res.result.success).toBe(true);
      expect(res.profile.credits).toBe(0);
      expect(res.profile.credits).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Net Win/Loss Accounting', () => {
    it('records net winnings on a winning round', () => {
      const profile = createMockProfile({ credits: 1000, totalWinnings: 0, totalLosses: 0 });
      // Wager 100, payout 300 -> net +200
      const { profile: updated, result } = settleRound(profile, 100, 300);

      expect(result.success).toBe(true);
      expect(result.won).toBe(true);
      expect(result.net).toBe(200);
      expect(result.bet).toBe(100);
      expect(result.payout).toBe(300);

      expect(updated.credits).toBe(1200);
      expect(updated.totalWinnings).toBe(200);
      expect(updated.totalLosses).toBe(0);
      expect(updated.gamesPlayed).toBe(1);
    });

    it('records net losses on a losing round', () => {
      const profile = createMockProfile({ credits: 1000, totalWinnings: 100, totalLosses: 50 });
      // Wager 100, payout 0 -> net -100
      const { profile: updated, result } = settleRound(profile, 100, 0);

      expect(result.success).toBe(true);
      expect(result.won).toBe(false);
      expect(result.net).toBe(-100);

      expect(updated.credits).toBe(900);
      expect(updated.totalWinnings).toBe(100);
      expect(updated.totalLosses).toBe(150);
      expect(updated.gamesPlayed).toBe(1);
    });

    it('records a push without altering winnings or losses', () => {
      const profile = createMockProfile({ credits: 500, totalWinnings: 50, totalLosses: 50 });
      // Wager 100, payout 100 -> net 0
      const { profile: updated, result } = settleRound(profile, 100, 100);

      expect(result.success).toBe(true);
      expect(result.won).toBe(false);
      expect(result.net).toBe(0);

      expect(updated.credits).toBe(500);
      expect(updated.totalWinnings).toBe(50);
      expect(updated.totalLosses).toBe(50);
      expect(updated.gamesPlayed).toBe(1);
    });
  });

  describe('Level-up Bonus Triggers from Every XP Source', () => {
    it('triggers level-up promotion credits from round play XP', () => {
      // Threshold for Level 2 is 500 XP. Start at 490 XP.
      const profile = createMockProfile({ credits: 1000, xp: 490 });
      const { profile: updated, result } = settleRound(profile, 50, 100, 20);

      expect(result.leveledUp).toBe(true);
      expect(result.newLevel).toBe(2);
      expect(result.promotionCredits).toBe(1000); // 500 * level 2 = 1000
      expect(updated.xp).toBe(510);
      // Balance: 1000 (starting) - 50 (bet) + 100 (payout) + 1000 (promotion bonus) = 2050
      expect(updated.credits).toBe(2050);
    });

    it('triggers level-up promotion credits from daily bonus XP', () => {
      // Start at 400 XP. Daily bonus awards 200 XP -> 600 XP (Level 2).
      const profile = createMockProfile({ credits: 500, xp: 400 });
      const { profile: updated, leveledUp, newLevel, creditsAwarded, xpAwarded } = applyDailyBonus(
        profile,
        1000,
        200
      );

      expect(leveledUp).toBe(true);
      expect(newLevel).toBe(2);
      expect(xpAwarded).toBe(200);
      expect(creditsAwarded).toBe(1000);
      expect(updated.xp).toBe(600);
      // Balance: 500 + 1000 (bonus) + 1000 (level 2 promotion bonus) = 2500
      expect(updated.credits).toBe(2500);
    });

    it('triggers level-up promotion credits from achievement reward XP', () => {
      // Start at 450 XP. Achievement gives 100 XP -> 550 XP (Level 2).
      const profile = createMockProfile({ credits: 200, xp: 450 });
      const { profile: updated, leveledUp, newLevel, promotionCredits } = applyAchievementReward(
        profile,
        500,
        100
      );

      expect(leveledUp).toBe(true);
      expect(newLevel).toBe(2);
      expect(promotionCredits).toBe(1000);
      expect(updated.xp).toBe(550);
      // Balance: 200 + 500 (achievement reward) + 1000 (promotion bonus) = 1700
      expect(updated.credits).toBe(1700);
    });

    it('triggers level-up promotion credits directly through applyXp', () => {
      const profile = createMockProfile({ credits: 300, xp: 480 });
      const xpRes = applyXp(profile, 50);

      expect(xpRes.leveledUp).toBe(true);
      expect(xpRes.newLevel).toBe(2);
      expect(xpRes.promotionCredits).toBe(1000);
      expect(xpRes.profile.xp).toBe(530);
      expect(xpRes.profile.credits).toBe(1300);
    });

    it('pays promotion credits for EVERY level crossed when crossing several levels', () => {
      // Start at Level 1 with 0 XP and 1000 credits.
      // Thresholds: Level 2 at 500 XP, Level 3 at 1200 XP.
      // Award 1300 XP -> crosses Level 2 (500*2 = 1000) AND Level 3 (500*3 = 1500).
      // Total bonus should be 1000 + 1500 = 2500 credits.
      const profile = createMockProfile({ credits: 1000, xp: 0 });
      const xpRes = applyXp(profile, 1300);

      expect(xpRes.leveledUp).toBe(true);
      expect(xpRes.newLevel).toBe(3);
      expect(xpRes.promotionCredits).toBe(2500);
      expect(xpRes.profile.xp).toBe(1300);
      expect(xpRes.profile.credits).toBe(3500); // 1000 + 2500
    });
  });

  describe('settleRound Atomicity', () => {
    it('applies bet debit, payout credit, net totals, and XP in a single atomic update', () => {
      const initial = createMockProfile({ credits: 800, xp: 100, gamesPlayed: 5, totalWinnings: 200, totalLosses: 100 });
      const { profile: next, result } = settleRound(initial, 100, 250, 40);

      expect(result.success).toBe(true);
      expect(result.won).toBe(true);
      expect(result.net).toBe(150);
      expect(result.xpGained).toBe(40);

      // Verify all changes atomically applied together
      expect(next.credits).toBe(950);
      expect(next.xp).toBe(140);
      expect(next.gamesPlayed).toBe(6);
      expect(next.totalWinnings).toBe(350);
      expect(next.totalLosses).toBe(100);

      // Verify initial object immutability
      expect(initial.credits).toBe(800);
      expect(initial.gamesPlayed).toBe(5);
    });

    it('settleRound and placeBet followed by resolveRound produce identical results and profiles', () => {
      const initial = createMockProfile({ credits: 1500, xp: 200, gamesPlayed: 10, totalWinnings: 600, totalLosses: 300 });

      // Scenario A: Win
      const singleShotWin = settleRound(initial, 100, 300, 50);
      const escrowBetWin = placeBet(initial, 100);
      expect(escrowBetWin.success).toBe(true);
      expect(escrowBetWin.profile.credits).toBe(1400);
      const escrowResolveWin = resolveRound(escrowBetWin.profile, 100, 300, 50);

      expect(escrowResolveWin.profile).toEqual(singleShotWin.profile);
      expect(escrowResolveWin.result).toEqual(singleShotWin.result);

      // Scenario B: Loss
      const singleShotLoss = settleRound(initial, 150, 0, 20);
      const escrowBetLoss = placeBet(initial, 150);
      expect(escrowBetLoss.success).toBe(true);
      expect(escrowBetLoss.profile.credits).toBe(1350);
      const escrowResolveLoss = resolveRound(escrowBetLoss.profile, 150, 0, 20);

      expect(escrowResolveLoss.profile).toEqual(singleShotLoss.profile);
      expect(escrowResolveLoss.result).toEqual(singleShotLoss.result);

      // Scenario C: Push
      const singleShotPush = settleRound(initial, 50, 50, 10);
      const escrowBetPush = placeBet(initial, 50);
      const escrowResolvePush = resolveRound(escrowBetPush.profile, 50, 50, 10);

      expect(escrowResolvePush.profile).toEqual(singleShotPush.profile);
      expect(escrowResolvePush.result).toEqual(singleShotPush.result);
    });

    it('leaves profile unchanged if settleRound encounters invalid wager', () => {
      const initial = createMockProfile({ credits: 50, gamesPlayed: 2 });
      const { profile: next, result } = settleRound(initial, 100, 200);

      expect(result.success).toBe(false);
      expect(next).toBe(initial);
      expect(next.credits).toBe(50);
      expect(next.gamesPlayed).toBe(2);
    });
  });

  describe('Level and Title Derivation', () => {
    it('calculates proper level thresholds and titles', () => {
      expect(calculateLevelInfo(0).level).toBe(1);
      expect(calculateLevelInfo(0).title).toBe('Bronze Patron');

      expect(calculateLevelInfo(500).level).toBe(2);
      expect(calculateLevelInfo(500).title).toBe('Silver Cardholder');

      expect(calculateLevelInfo(1200).level).toBe(3);
      expect(calculateLevelInfo(1200).title).toBe('Gold Member');

      expect(calculateLevelInfo(2200).level).toBe(4);
      expect(calculateLevelInfo(2200).title).toBe('Platinum Roller');

      expect(calculateLevelInfo(3500).level).toBe(5);
      expect(calculateLevelInfo(3500).title).toBe('Black Tier Elite');

      expect(calculateLevelInfo(5200).level).toBe(6);
      expect(calculateLevelInfo(5200).title).toBe('Casino Royalty');
    });
  });
});
