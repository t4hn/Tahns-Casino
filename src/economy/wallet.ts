/**
 * Pure Wallet and Economy Logic for Tahn's Casino.
 * No React, no sound, no DOM, no external dependencies, no side-effects.
 */

export interface LevelInfo {
  level: number;
  currentLevelXp: number;
  nextLevelTargetXp: number;
  progressPercent: number;
  title: string;
}

export interface WalletProfile {
  id: string;
  name: string;
  avatarUrl: string;
  xp: number;
  credits: number;
  gamesPlayed: number;
  totalWinnings: number;
  totalLosses: number;
  createdAt: number;
  dailyStreak: number;
  lastDailyClaim?: number;
}

export interface SettleResult {
  success: boolean;
  won: boolean;
  net: number;
  bet: number;
  payout: number;
  xpGained: number;
  leveledUp: boolean;
  newLevel?: number;
  promotionCredits?: number;
  error?: string;
}

export interface XpResult {
  profile: WalletProfile;
  xpGained: number;
  leveledUp: boolean;
  newLevel?: number;
  promotionCredits?: number;
}

const LEVEL_THRESHOLDS = [
  { level: 1, minXp: 0, maxXp: 500, title: 'Bronze Patron' },
  { level: 2, minXp: 500, maxXp: 1200, title: 'Silver Cardholder' },
  { level: 3, minXp: 1200, maxXp: 2200, title: 'Gold Member' },
  { level: 4, minXp: 2200, maxXp: 3500, title: 'Platinum Roller' },
  { level: 5, minXp: 3500, maxXp: 5200, title: 'Black Tier Elite' },
  { level: 6, minXp: 5200, maxXp: 7500, title: 'Casino Royalty' },
];

/**
 * Pure derivation of level and title from total XP.
 */
export function calculateLevelInfo(totalXp: number): LevelInfo {
  const safeXp = Math.max(0, totalXp || 0);

  let currentTier = LEVEL_THRESHOLDS[0];
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (safeXp >= LEVEL_THRESHOLDS[i].minXp) {
      currentTier = LEVEL_THRESHOLDS[i];
      break;
    }
  }

  const xpInLevel = safeXp - currentTier.minXp;
  const xpNeededForLevel = currentTier.maxXp - currentTier.minXp;
  const progressPercent = Math.min(100, Math.max(0, (xpInLevel / xpNeededForLevel) * 100));

  return {
    level: currentTier.level,
    currentLevelXp: xpInLevel,
    nextLevelTargetXp: xpNeededForLevel,
    progressPercent,
    title: currentTier.title,
  };
}

/**
 * Pure function: deducts wager if valid and affordable.
 * Credits must never become negative.
 */
export function applyWager(
  profile: WalletProfile,
  bet: number
): { profile: WalletProfile; success: boolean; error?: string } {
  if (bet <= 0) {
    return { profile, success: false, error: 'Wager must be greater than zero.' };
  }
  if (profile.credits < bet) {
    return { profile, success: false, error: 'Insufficient credits.' };
  }

  const updated: WalletProfile = {
    ...profile,
    credits: profile.credits - bet,
  };

  return { profile: updated, success: true };
}

/**
 * Pure function: credits an arbitrary payout amount.
 */
export function applyPayout(profile: WalletProfile, amount: number): WalletProfile {
  if (amount <= 0) return profile;
  return {
    ...profile,
    credits: profile.credits + amount,
  };
}

/**
 * Pure function: adds XP and checks for level-ups.
 * Triggers promotion credits on level up.
 * All XP changes MUST go through this function.
 */
export function applyXp(profile: WalletProfile, amount: number): XpResult {
  const safeAmount = Math.max(0, Math.round(amount || 0));
  if (safeAmount === 0) {
    return {
      profile,
      xpGained: 0,
      leveledUp: false,
    };
  }

  const prevLevel = calculateLevelInfo(profile.xp).level;
  const nextXp = profile.xp + safeAmount;
  const nextLevelInfo = calculateLevelInfo(nextXp);

  const leveledUp = nextLevelInfo.level > prevLevel;
  let promotionCredits = 0;
  if (leveledUp) {
    for (let lvl = prevLevel + 1; lvl <= nextLevelInfo.level; lvl++) {
      promotionCredits += 500 * lvl;
    }
  }

  const updated: WalletProfile = {
    ...profile,
    xp: nextXp,
    credits: profile.credits + promotionCredits,
  };

  return {
    profile: updated,
    xpGained: safeAmount,
    leveledUp,
    newLevel: leveledUp ? nextLevelInfo.level : undefined,
    promotionCredits: leveledUp ? promotionCredits : undefined,
  };
}

/**
 * Pure function: settles a game round atomically.
 * - Deducts bet and adds payout atomically: newCredits = profile.credits - bet + payout.
 * - Refuses any wager that exceeds balance or is <= 0.
 * - Increments gamesPlayed.
 * - Updates totalWinnings and totalLosses by NET result.
 * - Awards XP via applyXp so level-ups always trigger.
 */
export function settleRound(
  profile: WalletProfile,
  bet: number,
  payout: number,
  customXp?: number
): { profile: WalletProfile; result: SettleResult } {
  if (bet <= 0) {
    return {
      profile,
      result: {
        success: false,
        won: false,
        net: 0,
        bet,
        payout: 0,
        xpGained: 0,
        leveledUp: false,
        error: 'Wager must be greater than zero.',
      },
    };
  }

  if (profile.credits < bet) {
    return {
      profile,
      result: {
        success: false,
        won: false,
        net: 0,
        bet,
        payout: 0,
        xpGained: 0,
        leveledUp: false,
        error: 'Insufficient credits for this wager.',
      },
    };
  }

  const safePayout = Math.max(0, Math.round(payout || 0));
  const net = safePayout - bet;
  const won = net > 0;

  // Atomically calculate new credits without ever going negative
  const creditsAfterRound = Math.max(0, profile.credits - bet + safePayout);

  // Update totals by net result
  const totalWinningsDelta = net > 0 ? net : 0;
  const totalLossesDelta = net < 0 ? Math.abs(net) : 0;

  const baseProfile: WalletProfile = {
    ...profile,
    credits: creditsAfterRound,
    gamesPlayed: profile.gamesPlayed + 1,
    totalWinnings: profile.totalWinnings + totalWinningsDelta,
    totalLosses: profile.totalLosses + totalLossesDelta,
  };

  // Determine XP to award
  const xpAmount =
    customXp !== undefined
      ? customXp
      : won
      ? Math.max(15, Math.round(bet * 0.4))
      : Math.max(10, Math.round(bet * 0.2));

  // Route through applyXp
  const xpResult = applyXp(baseProfile, xpAmount);

  return {
    profile: xpResult.profile,
    result: {
      success: true,
      won,
      net,
      bet,
      payout: safePayout,
      xpGained: xpResult.xpGained,
      leveledUp: xpResult.leveledUp,
      newLevel: xpResult.newLevel,
      promotionCredits: xpResult.promotionCredits,
    },
  };
}

/**
 * Pure function: applies daily bonus virtual credits and XP.
 * Passes XP through applyXp.
 */
export function applyDailyBonus(
  profile: WalletProfile,
  bonusCredits: number = 1000,
  bonusXp: number = 200,
  timestamp: number = Date.now()
): { profile: WalletProfile; creditsAwarded: number; xpAwarded: number; leveledUp: boolean; newLevel?: number } {
  const profileWithCredits: WalletProfile = {
    ...profile,
    credits: profile.credits + bonusCredits,
    lastDailyClaim: timestamp,
    dailyStreak: (profile.dailyStreak || 0) + 1,
  };

  const xpResult = applyXp(profileWithCredits, bonusXp);

  return {
    profile: xpResult.profile,
    creditsAwarded: bonusCredits,
    xpAwarded: xpResult.xpGained,
    leveledUp: xpResult.leveledUp,
    newLevel: xpResult.newLevel,
  };
}

/**
 * Pure function: applies achievement reward credits and XP.
 * Passes XP through applyXp.
 */
export function applyAchievementReward(
  profile: WalletProfile,
  rewardCredits: number,
  rewardXp: number
): { profile: WalletProfile; leveledUp: boolean; newLevel?: number; promotionCredits?: number } {
  const profileWithCredits: WalletProfile = {
    ...profile,
    credits: profile.credits + rewardCredits,
  };

  const xpResult = applyXp(profileWithCredits, rewardXp);

  return {
    profile: xpResult.profile,
    leveledUp: xpResult.leveledUp,
    newLevel: xpResult.newLevel,
    promotionCredits: xpResult.promotionCredits,
  };
}
