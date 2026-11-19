import { describe, it, expect } from 'vitest';
import { INITIAL_ACHIEVEMENTS } from '../data/initialData';
import {
  createEmptyStatsState,
  recordRound,
  computeRoundMultiplier,
  RoundRecord,
} from './stats';
import {
  evaluateRoundAchievements,
  mergeAchievements,
  PLAYABLE_GAME_IDS,
} from './achievements';
import { RoundAchievementFacts } from '../types/casino';

function runRound(
  state: {
    stats: ReturnType<typeof createEmptyStatsState>;
    achievements: ReturnType<typeof mergeAchievements>;
  },
  params: {
    id: string;
    gameId: string;
    gameName: string;
    bet: number;
    payout: number;
    detail?: string;
    facts?: RoundAchievementFacts;
    profileCredits?: number;
    profileXp?: number;
  }
) {
  const record: RoundRecord = {
    id: params.id,
    gameId: params.gameId,
    gameName: params.gameName,
    timestamp: Date.now(),
    bet: params.bet,
    payout: params.payout,
    net: params.payout - params.bet,
    multiplier: computeRoundMultiplier(params.bet, params.payout),
    ...(params.detail ? { detail: params.detail } : {}),
  };

  const nextStats = recordRound(state.stats, record);
  const res = evaluateRoundAchievements({
    achievements: state.achievements,
    stats: nextStats,
    record,
    facts: params.facts,
    profileCredits: params.profileCredits ?? 1500,
    profileXp: params.profileXp ?? 200,
  });

  return {
    stats: nextStats,
    achievements: res.achievements,
    newlyUnlocked: res.newlyUnlocked,
  };
}

describe('Achievement Evaluator & Old-Save Migration', () => {
  it('migrates old 6-achievement saves preserving claimed status and initializing new achievements at 0', () => {
    const oldSave = [
      { id: 'first_steps', progress: 1, unlocked: true, claimed: true },
      { id: 'first_wager', progress: 1, unlocked: true, claimed: true },
      { id: 'high_roller', progress: 2200, unlocked: false, claimed: false },
    ];

    const merged = mergeAchievements(oldSave, INITIAL_ACHIEVEMENTS);
    expect(merged).toHaveLength(25);

    const firstSteps = merged.find((a) => a.id === 'first_steps');
    expect(firstSteps?.claimed).toBe(true);
    expect(firstSteps?.unlocked).toBe(true);

    const highRoller = merged.find((a) => a.id === 'high_roller');
    expect(highRoller?.progress).toBe(2200);
    expect(highRoller?.unlocked).toBe(false);

    const bjNatural = merged.find((a) => a.id === 'bj_natural');
    expect(bjNatural?.progress).toBe(0);
    expect(bjNatural?.unlocked).toBe(false);
    expect(bjNatural?.claimed).toBe(false);
  });

  it('unlocks Blackjack achievements (Natural Talent & Double Trouble)', () => {
    const initial = {
      stats: createEmptyStatsState(),
      achievements: INITIAL_ACHIEVEMENTS.map((a) => ({ ...a })),
    };

    const s1 = runRound(initial, {
      id: 'bj_1',
      gameId: 'blackjack',
      gameName: 'Blackjack',
      bet: 50,
      payout: 125,
      detail: 'Blackjack 3:2',
      facts: { blackjackNatural: true },
    });
    expect(s1.achievements.find((a) => a.id === 'bj_natural')?.unlocked).toBe(true);
    expect(s1.newlyUnlocked.some((a) => a.id === 'bj_natural')).toBe(true);

    const s2 = runRound(s1, {
      id: 'bj_2',
      gameId: 'blackjack',
      gameName: 'Blackjack',
      bet: 100,
      payout: 200,
      detail: 'Win (2×)',
      facts: { blackjackDoubledWin: true },
    });
    expect(s2.achievements.find((a) => a.id === 'bj_double_win')?.unlocked).toBe(true);
  });

  it('unlocks Video Poker achievements (Full House Party & Royal Treatment)', () => {
    let state = {
      stats: createEmptyStatsState(),
      achievements: INITIAL_ACHIEVEMENTS.map((a) => ({ ...a })),
    };

    state = runRound(state, {
      id: 'vp_1',
      gameId: 'video-poker',
      gameName: 'Video Poker Deluxe',
      bet: 20,
      payout: 180,
      facts: { videoPokerCategory: 'full_house' },
    });
    expect(state.achievements.find((a) => a.id === 'vp_full_house')?.unlocked).toBe(true);
    expect(state.achievements.find((a) => a.id === 'vp_royal')?.unlocked).toBe(false);

    state = runRound(state, {
      id: 'vp_2',
      gameId: 'video-poker',
      gameName: 'Video Poker Deluxe',
      bet: 20,
      payout: 5000,
      facts: { videoPokerCategory: 'royal_flush' },
    });
    expect(state.achievements.find((a) => a.id === 'vp_royal')?.unlocked).toBe(true);
  });

  it('unlocks Roulette achievements (Lucky Number & Colour Blind)', () => {
    let state = {
      stats: createEmptyStatsState(),
      achievements: INITIAL_ACHIEVEMENTS.map((a) => ({ ...a })),
    };

    state = runRound(state, {
      id: 'roul_1',
      gameId: 'roulette',
      gameName: 'Roulette',
      bet: 20,
      payout: 380,
      facts: { rouletteWonStraightUp: true, rouletteRedBlackWins: 1 },
    });
    expect(state.achievements.find((a) => a.id === 'roul_straight_win')?.unlocked).toBe(true);
    expect(state.achievements.find((a) => a.id === 'roul_red_black_10')?.progress).toBe(1);

    for (let i = 2; i <= 10; i++) {
      state = runRound(state, {
        id: `roul_${i}`,
        gameId: 'roulette',
        gameName: 'Roulette',
        bet: 10,
        payout: 20,
        facts: { rouletteRedBlackWins: 1 },
      });
    }
    expect(state.achievements.find((a) => a.id === 'roul_red_black_10')?.unlocked).toBe(true);
  });

  it('unlocks Keno achievements (Close Call & Perfect Picks)', () => {
    let state = {
      stats: createEmptyStatsState(),
      achievements: INITIAL_ACHIEVEMENTS.map((a) => ({ ...a })),
    };

    state = runRound(state, {
      id: 'keno_1',
      gameId: 'keno',
      gameName: 'Keno',
      bet: 20,
      payout: 400,
      facts: { kenoSpots: 5, kenoHits: 5 },
    });
    expect(state.achievements.find((a) => a.id === 'keno_hits_5')?.unlocked).toBe(true);
    expect(state.achievements.find((a) => a.id === 'keno_perfect_6')?.unlocked).toBe(false);

    state = runRound(state, {
      id: 'keno_2',
      gameId: 'keno',
      gameName: 'Keno',
      bet: 20,
      payout: 2000,
      facts: { kenoSpots: 6, kenoHits: 6 },
    });
    expect(state.achievements.find((a) => a.id === 'keno_perfect_6')?.unlocked).toBe(true);
  });

  it('unlocks Slots achievements (Reel Deal, Space Cadet, Big Winner)', () => {
    let state = {
      stats: createEmptyStatsState(),
      achievements: INITIAL_ACHIEVEMENTS.map((a) => ({ ...a })),
    };

    // 25x win on Nova Voyager
    state = runRound(state, {
      id: 'nova_1',
      gameId: 'nova-voyager',
      gameName: 'Nova Voyager',
      bet: 10,
      payout: 250,
    });
    expect(state.achievements.find((a) => a.id === 'slots_big_20x')?.unlocked).toBe(true);
    expect(state.achievements.find((a) => a.id === 'slots_wins_10')?.progress).toBe(1);
    expect(state.achievements.find((a) => a.id === 'nova_spins_50')?.progress).toBe(1);

    // 9 more wins across Lucky Slots & Nova Voyager
    for (let i = 2; i <= 10; i++) {
      state = runRound(state, {
        id: `slot_${i}`,
        gameId: i % 2 === 0 ? 'lucky-slots' : 'nova-voyager',
        gameName: i % 2 === 0 ? 'Lucky Slots' : 'Nova Voyager',
        bet: 10,
        payout: 20,
      });
    }
    expect(state.achievements.find((a) => a.id === 'slots_wins_10')?.unlocked).toBe(true);
  });

  it('unlocks Hot Streak (5 wins in a row) and Well Rounded (win in all 7 playable games)', () => {
    let state = {
      stats: createEmptyStatsState(),
      achievements: INITIAL_ACHIEVEMENTS.map((a) => ({ ...a })),
    };

    PLAYABLE_GAME_IDS.forEach((gameId, idx) => {
      state = runRound(state, {
        id: `all_${idx}`,
        gameId,
        gameName: gameId,
        bet: 10,
        payout: 20,
      });
    });

    expect(state.achievements.find((a) => a.id === 'hot_streak_5')?.unlocked).toBe(true);
    expect(state.achievements.find((a) => a.id === 'well_rounded')?.unlocked).toBe(true);
  });
});
