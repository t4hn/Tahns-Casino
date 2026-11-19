/**
 * Pure Achievement Evaluation & Old-Save Migration Engine
 *
 * Strictly pure TypeScript (no React, no DOM, no localStorage).
 */

import { Achievement, RoundAchievementFacts } from '../types/casino';
import { StatsState } from './stats';
import { RoundRecord } from './stats';

export const PLAYABLE_GAME_IDS: readonly string[] = [
  'lucky-slots',
  'blackjack',
  'roulette',
  'dice',
  'video-poker',
  'keno',
  'nova-voyager',
] as const;

const FULL_HOUSE_OR_BETTER = new Set<string>([
  'full_house',
  'four_of_a_kind',
  'straight_flush',
  'royal_flush',
]);

/**
 * Migrates saved achievements from older versions safely:
 * - Preserves progress, unlocked, and claimed flags on existing achievement IDs.
 * - Refreshes static metadata (title, description, rewards, maxProgress, iconName) from template.
 * - Appends any missing new achievements starting at 0 progress (unlocked: false, claimed: false).
 */
export function mergeAchievements(
  savedRaw: unknown,
  template: readonly Achievement[]
): Achievement[] {
  if (!Array.isArray(savedRaw)) {
    return template.map((ach) => ({ ...ach }));
  }

  const savedMap = new Map<string, Record<string, unknown>>();
  for (const item of savedRaw) {
    if (item && typeof item === 'object') {
      const rec = item as Record<string, unknown>;
      if (typeof rec.id === 'string' && rec.id.trim().length > 0) {
        savedMap.set(rec.id.trim(), rec);
      }
    }
  }

  return template.map((tpl) => {
    const saved = savedMap.get(tpl.id);
    if (!saved) {
      // Missing ID from an old save: new achievements start cleanly at 0
      return {
        ...tpl,
        progress: 0,
        unlocked: false,
        claimed: false,
      };
    }

    const rawProgress =
      typeof saved.progress === 'number' && Number.isFinite(saved.progress)
        ? Math.max(0, saved.progress)
        : tpl.progress;
    const clampedProgress = Math.min(tpl.maxProgress, rawProgress);
    const unlocked = Boolean(saved.unlocked) || clampedProgress >= tpl.maxProgress;
    const claimed = Boolean(saved.claimed) && unlocked;

    return {
      ...tpl,
      progress: unlocked ? Math.max(clampedProgress, tpl.maxProgress) : clampedProgress,
      unlocked,
      claimed,
    };
  });
}

function setAchievementProgress(
  ach: Achievement,
  value: number,
  isAbsolute: boolean
): Achievement {
  const nextRaw = isAbsolute ? value : ach.progress + value;
  const clamped = Math.max(0, Math.min(ach.maxProgress, nextRaw));
  // Never regress an already-unlocked achievement
  const nextProgress = ach.unlocked ? Math.max(ach.progress, clamped) : clamped;
  const unlocked = ach.unlocked || nextProgress >= ach.maxProgress;

  if (nextProgress === ach.progress && unlocked === ach.unlocked) {
    return ach;
  }

  return {
    ...ach,
    progress: nextProgress,
    unlocked,
  };
}

export interface EvaluateAchievementsInput {
  achievements: readonly Achievement[];
  stats: StatsState;
  record: RoundRecord;
  facts?: RoundAchievementFacts;
  profileCredits: number;
  profileXp: number;
  playableGameIds?: readonly string[];
}

export interface EvaluateAchievementsResult {
  achievements: Achievement[];
  newlyUnlocked: Achievement[];
}

/**
 * Evaluates both existing milestone achievements and all 19 game-specific / career
 * achievements after a round settles (normal or crash-recovered).
 */
export function evaluateRoundAchievements({
  achievements,
  stats,
  record,
  facts,
  profileCredits,
  profileXp,
  playableGameIds = PLAYABLE_GAME_IDS,
}: EvaluateAchievementsInput): EvaluateAchievementsResult {
  const bjStats = stats.byGame['blackjack'];
  const vpStats = stats.byGame['video-poker'];
  const roulStats = stats.byGame['roulette'];
  const kenoStats = stats.byGame['keno'];
  const luckySlotsStats = stats.byGame['lucky-slots'];
  const novaStats = stats.byGame['nova-voyager'];

  const totalSlotsWins = (luckySlotsStats?.wins ?? 0) + (novaStats?.wins ?? 0);
  const wonGameCount = playableGameIds.filter(
    (id) => (stats.byGame[id]?.wins ?? 0) > 0
  ).length;

  const isSlotsGame =
    record.gameId === 'lucky-slots' || record.gameId === 'nova-voyager';

  const newlyUnlocked: Achievement[] = [];

  const updated = achievements.map((ach) => {
    let next = ach;

    switch (ach.id) {
      // Existing round-linked milestones
      case 'first_wager':
        next = setAchievementProgress(ach, 1, true);
        break;
      case 'high_roller':
        next = setAchievementProgress(ach, profileCredits, true);
        break;
      case 'level_two':
        next = setAchievementProgress(ach, profileXp, true);
        break;

      // Blackjack
      case 'bj_natural':
        if (record.gameId === 'blackjack' && facts?.blackjackNatural) {
          next = setAchievementProgress(ach, 1, true);
        }
        break;
      case 'bj_double_win':
        if (
          record.gameId === 'blackjack' &&
          (facts?.blackjackDoubledWin || (record.payout > record.bet && record.detail?.includes('(2×)')))
        ) {
          next = setAchievementProgress(ach, 1, true);
        }
        break;
      case 'bj_wins_25':
        next = setAchievementProgress(ach, bjStats?.wins ?? 0, true);
        break;

      // Video Poker
      case 'vp_wins_10':
        next = setAchievementProgress(ach, vpStats?.wins ?? 0, true);
        break;
      case 'vp_full_house':
        if (
          record.gameId === 'video-poker' &&
          facts?.videoPokerCategory &&
          FULL_HOUSE_OR_BETTER.has(facts.videoPokerCategory)
        ) {
          next = setAchievementProgress(ach, 1, true);
        }
        break;
      case 'vp_royal':
        if (
          record.gameId === 'video-poker' &&
          facts?.videoPokerCategory === 'royal_flush'
        ) {
          next = setAchievementProgress(ach, 1, true);
        }
        break;

      // Roulette
      case 'roul_straight_win':
        if (record.gameId === 'roulette' && facts?.rouletteWonStraightUp) {
          next = setAchievementProgress(ach, 1, true);
        }
        break;
      case 'roul_red_black_10':
        if (
          record.gameId === 'roulette' &&
          typeof facts?.rouletteRedBlackWins === 'number' &&
          facts.rouletteRedBlackWins > 0
        ) {
          next = setAchievementProgress(ach, facts.rouletteRedBlackWins, false);
        }
        break;
      case 'roul_spins_50':
        next = setAchievementProgress(ach, roulStats?.rounds ?? 0, true);
        break;

      // Keno
      case 'keno_hits_5':
        if (record.gameId === 'keno' && (facts?.kenoHits ?? 0) >= 5) {
          next = setAchievementProgress(ach, 1, true);
        }
        break;
      case 'keno_perfect_6':
        if (
          record.gameId === 'keno' &&
          (facts?.kenoSpots ?? 0) >= 6 &&
          (facts?.kenoHits ?? 0) >= 6
        ) {
          next = setAchievementProgress(ach, 1, true);
        }
        break;
      case 'keno_rounds_25':
        next = setAchievementProgress(ach, kenoStats?.rounds ?? 0, true);
        break;

      // Slots
      case 'slots_wins_10':
        next = setAchievementProgress(ach, totalSlotsWins, true);
        break;
      case 'nova_spins_50':
        next = setAchievementProgress(ach, novaStats?.rounds ?? 0, true);
        break;
      case 'slots_big_20x':
        if (
          isSlotsGame &&
          record.payout > record.bet &&
          record.multiplier >= 20
        ) {
          next = setAchievementProgress(ach, 1, true);
        }
        break;

      // General milestones
      case 'hot_streak_5':
        next = setAchievementProgress(
          ach,
          Math.max(ach.progress, stats.overall.bestWinStreak),
          true
        );
        break;
      case 'well_rounded':
        next = setAchievementProgress(ach, wonGameCount, true);
        break;
      case 'century_100':
        next = setAchievementProgress(ach, stats.overall.rounds, true);
        break;
      case 'regular_500':
        next = setAchievementProgress(ach, stats.overall.rounds, true);
        break;

      default:
        break;
    }

    if (!ach.unlocked && next.unlocked) {
      newlyUnlocked.push(next);
    }

    return next;
  });

  return {
    achievements: updated,
    newlyUnlocked,
  };
}
