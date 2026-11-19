import { describe, it, expect } from 'vitest';
import {
  STATS_STORAGE_VERSION,
  HISTORY_STORAGE_VERSION,
  MAX_HISTORY_RECORDS,
  createEmptyStatsState,
  recordRound,
  appendRoundHistory,
  recordRoundWithHistory,
  sanitizeStatsState,
  sanitizeHistory,
  serializeStatsPayload,
  deserializeStatsPayload,
  serializeHistoryPayload,
  deserializeHistoryPayload,
  classifyRoundOutcome,
  computeRoundMultiplier,
  formatRelativeTime,
  RoundRecord,
} from './stats';

function makeRecord(overrides: Partial<RoundRecord> = {}): RoundRecord {
  const bet = overrides.bet ?? 50;
  const payout = overrides.payout ?? 100;
  return {
    id: overrides.id ?? `r_${Math.random().toString(36).slice(2, 8)}`,
    gameId: overrides.gameId ?? 'dice',
    gameName: overrides.gameName ?? 'Dice',
    timestamp: overrides.timestamp ?? 1_700_000_000_000,
    bet,
    payout,
    net: overrides.net ?? payout - bet,
    multiplier: overrides.multiplier ?? computeRoundMultiplier(bet, payout),
    ...(overrides.detail !== undefined ? { detail: overrides.detail } : {}),
    ...(overrides.recovered !== undefined ? { recovered: overrides.recovered } : {}),
  };
}

describe('Pure Stats & Round History Engine', () => {
  it('classifies wins, losses, and pushes strictly by payout vs bet', () => {
    expect(classifyRoundOutcome(50, 100)).toBe('win');
    expect(classifyRoundOutcome(50, 50)).toBe('push');
    expect(classifyRoundOutcome(50, 0)).toBe('loss');
    expect(classifyRoundOutcome(50, 25)).toBe('loss');
  });

  it('tracks wins, pushes, losses, streaks, biggest win, and favouriteGame immutably', () => {
    const empty = createEmptyStatsState();

    // 1. Win on Dice (+50 net, 2x)
    const s1 = recordRound(
      empty,
      makeRecord({ id: 'r1', gameId: 'dice', gameName: 'Dice', bet: 50, payout: 100, timestamp: 1000 })
    );
    expect(empty.overall.rounds).toBe(0); // immutable
    expect(s1.overall.rounds).toBe(1);
    expect(s1.overall.wins).toBe(1);
    expect(s1.overall.currentWinStreak).toBe(1);
    expect(s1.overall.bestWinStreak).toBe(1);
    expect(s1.overall.biggestWin).toBe(50);
    expect(s1.overall.biggestMultiplier).toBe(2);
    expect(s1.overall.favouriteGame).toBe('Dice');

    // 2. Push on Blackjack leaves win streak intact without incrementing wins
    const s2 = recordRound(
      s1,
      makeRecord({ id: 'r2', gameId: 'blackjack', gameName: 'Blackjack', bet: 100, payout: 100, timestamp: 2000 })
    );
    expect(s2.overall.rounds).toBe(2);
    expect(s2.overall.wins).toBe(1);
    expect(s2.overall.pushes).toBe(1);
    expect(s2.overall.currentWinStreak).toBe(1);
    expect(s2.overall.bestWinStreak).toBe(1);

    // 3. Another Win on Blackjack (+150 net, 2.5x) -> streak becomes 2
    const s3 = recordRound(
      s2,
      makeRecord({ id: 'r3', gameId: 'blackjack', gameName: 'Blackjack', bet: 100, payout: 250, timestamp: 3000 })
    );
    expect(s3.overall.wins).toBe(2);
    expect(s3.overall.currentWinStreak).toBe(2);
    expect(s3.overall.bestWinStreak).toBe(2);
    expect(s3.overall.biggestWin).toBe(150);
    expect(s3.overall.biggestMultiplier).toBe(2.5);
    expect(s3.overall.favouriteGame).toBe('Blackjack'); // 2 rounds vs Dice 1 round

    // 4. Loss resets currentWinStreak to 0 while keeping bestWinStreak = 2
    const s4 = recordRound(
      s3,
      makeRecord({ id: 'r4', gameId: 'dice', gameName: 'Dice', bet: 20, payout: 0, timestamp: 4000 })
    );
    expect(s4.overall.losses).toBe(1);
    expect(s4.overall.currentWinStreak).toBe(0);
    expect(s4.overall.bestWinStreak).toBe(2);
    expect(s4.overall.totalWagered).toBe(270);
    expect(s4.overall.totalReturned).toBe(450);
    expect(s4.overall.net).toBe(180);
  });

  it('ignores duplicate round IDs idempotently across stats and history', () => {
    const empty = createEmptyStatsState();
    const rec = makeRecord({ id: 'dup_round_1', gameId: 'roulette', gameName: 'Roulette', bet: 25, payout: 900 });

    const first = recordRoundWithHistory(empty, [], rec);
    expect(first.recorded).toBe(true);
    expect(first.stats.overall.rounds).toBe(1);
    expect(first.history).toHaveLength(1);

    const second = recordRoundWithHistory(first.stats, first.history, rec);
    expect(second.recorded).toBe(false);
    expect(second.stats.overall.rounds).toBe(1);
    expect(second.history).toHaveLength(1);
  });

  it('caps round history ring buffer at 50 records with newest first', () => {
    let history: RoundRecord[] = [];
    for (let i = 1; i <= 65; i++) {
      history = appendRoundHistory(
        history,
        makeRecord({ id: `r_${i}`, timestamp: 1000 + i, detail: `Round #${i}` })
      );
    }

    expect(history).toHaveLength(MAX_HISTORY_RECORDS);
    expect(history[0].id).toBe('r_65');
    expect(history[49].id).toBe('r_16');
  });

  it('sanitizes corrupt, NaN, and negative persisted stats and history payloads safely', () => {
    const corruptStatsJson = JSON.stringify({
      version: 99,
      stats: {
        overall: { currentWinStreak: -5, bestWinStreak: 'bad' },
        byGame: {
          dice: {
            gameId: 'dice',
            gameName: 'Dice',
            rounds: -10,
            wins: 3,
            losses: -4,
            pushes: 1,
            totalWagered: -500,
            totalReturned: 300,
            biggestWin: Number.NaN,
            biggestMultiplier: -2,
            currentWinStreak: 2,
            bestWinStreak: 1,
            lastPlayedAt: -100,
          },
          '': { rounds: 5 },
        },
        recordedRoundIds: ['ok_1', '', 123, 'ok_1'],
      },
    });

    const cleanStats = deserializeStatsPayload(corruptStatsJson);
    expect(cleanStats.byGame['dice'].rounds).toBe(4); // max(0, wins(3)+losses(0)+pushes(1))
    expect(cleanStats.byGame['dice'].totalWagered).toBe(0);
    expect(cleanStats.byGame['dice'].bestWinStreak).toBe(2);
    expect(cleanStats.byGame['dice'].lastPlayedAt).toBeNull();
    expect(cleanStats.recordedRoundIds).toEqual(['ok_1']);

    expect(deserializeStatsPayload('{bad json')).toEqual(createEmptyStatsState());
    expect(sanitizeStatsState(null)).toEqual(createEmptyStatsState());

    const corruptHistory = sanitizeHistory({
      records: [
        null,
        { id: '', gameId: 'dice' },
        { id: 'valid_1', gameId: 'keno', bet: -20, payout: 100, timestamp: -1 },
        { id: 'valid_1', gameId: 'keno', bet: 10, payout: 0 },
      ],
    });
    expect(corruptHistory).toHaveLength(1);
    expect(corruptHistory[0].bet).toBe(0);
    expect(corruptHistory[0].payout).toBe(100);
    expect(deserializeHistoryPayload('{bad')).toEqual([]);
  });

  it('serializes and deserializes versioned payloads accurately', () => {
    const rec = makeRecord({
      id: 'ser_1',
      gameId: 'keno',
      gameName: 'Keno',
      bet: 20,
      payout: 100,
      detail: 'Keno 5 spots, 4 hits',
      recovered: true,
    });
    const { stats, history } = recordRoundWithHistory(createEmptyStatsState(), [], rec);

    const statsPayload = serializeStatsPayload(stats);
    expect(statsPayload.version).toBe(STATS_STORAGE_VERSION);
    expect(deserializeStatsPayload(JSON.stringify(statsPayload))).toEqual(stats);

    const historyPayload = serializeHistoryPayload(history);
    expect(historyPayload.version).toBe(HISTORY_STORAGE_VERSION);
    expect(deserializeHistoryPayload(JSON.stringify(historyPayload))).toEqual(history);
  });

  it('formats relative timestamps cleanly', () => {
    const now = 1_700_000_000_000;
    expect(formatRelativeTime(null, now)).toBe('Never');
    expect(formatRelativeTime(now - 10_000, now)).toBe('Just now');
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe('5m ago');
    expect(formatRelativeTime(now - 3 * 3_600_000, now)).toBe('3h ago');
    expect(formatRelativeTime(now - 2 * 86_400_000, now)).toBe('2d ago');
  });
});
