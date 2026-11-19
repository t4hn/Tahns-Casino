/**
 * Pure Casino Statistics & Round History Engine
 *
 * Strictly pure TypeScript (zero React, zero DOM, zero localStorage access).
 * All functions return new immutable structures and sanitize untrusted input safely.
 */

export const STATS_STORAGE_VERSION = 1;
export const HISTORY_STORAGE_VERSION = 1;
export const MAX_HISTORY_RECORDS = 50;
export const MAX_DEDUPE_IDS = 200;

export type RoundOutcome = 'win' | 'loss' | 'push';

export interface RoundRecord {
  id: string;
  gameId: string;
  gameName: string;
  timestamp: number;
  bet: number;
  payout: number;
  net: number;
  multiplier: number;
  detail?: string;
  recovered?: boolean;
}

export interface GameStats {
  gameId: string;
  gameName: string;
  rounds: number;
  wins: number;
  losses: number;
  pushes: number;
  totalWagered: number;
  totalReturned: number;
  net: number;
  biggestWin: number;
  biggestMultiplier: number;
  currentWinStreak: number;
  bestWinStreak: number;
  lastPlayedAt: number | null;
}

export interface OverallStats {
  rounds: number;
  wins: number;
  losses: number;
  pushes: number;
  totalWagered: number;
  totalReturned: number;
  net: number;
  biggestWin: number;
  biggestMultiplier: number;
  currentWinStreak: number;
  bestWinStreak: number;
  lastPlayedAt: number | null;
  favouriteGame: string | null;
}

export interface StatsState {
  overall: OverallStats;
  byGame: Record<string, GameStats>;
  recordedRoundIds: string[];
}

export interface PersistedStatsPayload {
  version: number;
  stats: StatsState;
}

export interface PersistedHistoryPayload {
  version: number;
  records: RoundRecord[];
}

function clampNonNegativeNumber(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, value);
}

function clampNonNegativeInt(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function sanitizeFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return value;
}

function sanitizeTimestamp(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.floor(value);
}

export function classifyRoundOutcome(bet: number, payout: number): RoundOutcome {
  if (payout > bet) return 'win';
  if (payout === bet) return 'push';
  return 'loss';
}

export function computeRoundMultiplier(bet: number, payout: number): number {
  if (!Number.isFinite(bet) || bet <= 0 || !Number.isFinite(payout) || payout <= 0) {
    return 0;
  }
  return Number((payout / bet).toFixed(2));
}

export function createEmptyGameStats(gameId: string, gameName: string = gameId): GameStats {
  return {
    gameId,
    gameName,
    rounds: 0,
    wins: 0,
    losses: 0,
    pushes: 0,
    totalWagered: 0,
    totalReturned: 0,
    net: 0,
    biggestWin: 0,
    biggestMultiplier: 0,
    currentWinStreak: 0,
    bestWinStreak: 0,
    lastPlayedAt: null,
  };
}

export function createEmptyOverallStats(): OverallStats {
  return {
    rounds: 0,
    wins: 0,
    losses: 0,
    pushes: 0,
    totalWagered: 0,
    totalReturned: 0,
    net: 0,
    biggestWin: 0,
    biggestMultiplier: 0,
    currentWinStreak: 0,
    bestWinStreak: 0,
    lastPlayedAt: null,
    favouriteGame: null,
  };
}

export function createEmptyStatsState(): StatsState {
  return {
    overall: createEmptyOverallStats(),
    byGame: {},
    recordedRoundIds: [],
  };
}

/**
 * Normalizes a RoundRecord so negative bets/payouts or missing fields never corrupt stats.
 */
export function sanitizeRoundRecord(raw: unknown): RoundRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || r.id.trim().length === 0) return null;
  if (typeof r.gameId !== 'string' || r.gameId.trim().length === 0) return null;

  const gameId = r.gameId.trim();
  const gameName =
    typeof r.gameName === 'string' && r.gameName.trim().length > 0
      ? r.gameName.trim()
      : gameId;
  const bet = clampNonNegativeNumber(r.bet, 0);
  const payout = clampNonNegativeNumber(r.payout, 0);
  const net = payout - bet;
  const multiplier =
    typeof r.multiplier === 'number' && Number.isFinite(r.multiplier) && r.multiplier >= 0
      ? Number(r.multiplier.toFixed(2))
      : computeRoundMultiplier(bet, payout);
  const timestamp =
    typeof r.timestamp === 'number' && Number.isFinite(r.timestamp) && r.timestamp > 0
      ? Math.floor(r.timestamp)
      : 0;

  const clean: RoundRecord = {
    id: r.id.trim(),
    gameId,
    gameName,
    timestamp,
    bet,
    payout,
    net,
    multiplier,
  };

  if (typeof r.detail === 'string' && r.detail.trim().length > 0) {
    clean.detail = r.detail.trim();
  }
  if (r.recovered === true) {
    clean.recovered = true;
  }

  return clean;
}

/**
 * Derives aggregate fields from per-game stats while preserving cross-game overall win streaks.
 */
export function recomputeOverallStats(
  byGame: Record<string, GameStats>,
  streakState: { currentWinStreak: number; bestWinStreak: number } = {
    currentWinStreak: 0,
    bestWinStreak: 0,
  }
): OverallStats {
  const gameList = Object.values(byGame);
  if (gameList.length === 0) {
    return {
      ...createEmptyOverallStats(),
      currentWinStreak: clampNonNegativeInt(streakState.currentWinStreak),
      bestWinStreak: clampNonNegativeInt(streakState.bestWinStreak),
    };
  }

  let rounds = 0;
  let wins = 0;
  let losses = 0;
  let pushes = 0;
  let totalWagered = 0;
  let totalReturned = 0;
  let net = 0;
  let biggestWin = 0;
  let biggestMultiplier = 0;
  let lastPlayedAt: number | null = null;
  let favouriteEntry: GameStats | null = null;

  for (const game of gameList) {
    rounds += game.rounds;
    wins += game.wins;
    losses += game.losses;
    pushes += game.pushes;
    totalWagered += game.totalWagered;
    totalReturned += game.totalReturned;
    net += game.net;
    biggestWin = Math.max(biggestWin, game.biggestWin);
    biggestMultiplier = Math.max(biggestMultiplier, game.biggestMultiplier);

    if (game.lastPlayedAt !== null) {
      lastPlayedAt =
        lastPlayedAt === null ? game.lastPlayedAt : Math.max(lastPlayedAt, game.lastPlayedAt);
    }

    if (
      game.rounds > 0 &&
      (!favouriteEntry ||
        game.rounds > favouriteEntry.rounds ||
        (game.rounds === favouriteEntry.rounds &&
          (game.lastPlayedAt ?? 0) > (favouriteEntry.lastPlayedAt ?? 0)))
    ) {
      favouriteEntry = game;
    }
  }

  const currentWinStreak = clampNonNegativeInt(streakState.currentWinStreak);
  const maxPerGameStreak = gameList.reduce(
    (max, g) => Math.max(max, g.bestWinStreak),
    0
  );
  const bestWinStreak = Math.max(
    clampNonNegativeInt(streakState.bestWinStreak),
    currentWinStreak,
    maxPerGameStreak
  );

  return {
    rounds,
    wins,
    losses,
    pushes,
    totalWagered,
    totalReturned,
    net,
    biggestWin,
    biggestMultiplier,
    currentWinStreak,
    bestWinStreak,
    lastPlayedAt,
    favouriteGame: favouriteEntry ? favouriteEntry.gameName : null,
  };
}

/**
 * Pure immutable round recorder.
 * - Win if payout > bet, push if payout === bet, else loss.
 * - Pushes leave win streaks intact without incrementing wins; losses reset currentWinStreak to 0.
 * - Duplicate record.id is ignored (idempotent).
 */
export function recordRound(stats: StatsState, record: RoundRecord): StatsState {
  const cleanRecord = sanitizeRoundRecord(record);
  if (!cleanRecord) return stats;

  if (stats.recordedRoundIds.includes(cleanRecord.id)) {
    return stats;
  }

  const outcome = classifyRoundOutcome(cleanRecord.bet, cleanRecord.payout);
  const existingGame =
    stats.byGame[cleanRecord.gameId] ||
    createEmptyGameStats(cleanRecord.gameId, cleanRecord.gameName);

  let nextGameCurrentStreak = existingGame.currentWinStreak;
  let nextOverallCurrentStreak = stats.overall.currentWinStreak;

  if (outcome === 'win') {
    nextGameCurrentStreak += 1;
    nextOverallCurrentStreak += 1;
  } else if (outcome === 'loss') {
    nextGameCurrentStreak = 0;
    nextOverallCurrentStreak = 0;
  }

  const nextGameBestStreak = Math.max(
    existingGame.bestWinStreak,
    nextGameCurrentStreak
  );
  const nextOverallBestStreak = Math.max(
    stats.overall.bestWinStreak,
    nextOverallCurrentStreak,
    nextGameBestStreak
  );

  const nextGame: GameStats = {
    gameId: cleanRecord.gameId,
    gameName: cleanRecord.gameName,
    rounds: existingGame.rounds + 1,
    wins: existingGame.wins + (outcome === 'win' ? 1 : 0),
    losses: existingGame.losses + (outcome === 'loss' ? 1 : 0),
    pushes: existingGame.pushes + (outcome === 'push' ? 1 : 0),
    totalWagered: existingGame.totalWagered + cleanRecord.bet,
    totalReturned: existingGame.totalReturned + cleanRecord.payout,
    net: existingGame.net + cleanRecord.net,
    biggestWin:
      outcome === 'win'
        ? Math.max(existingGame.biggestWin, cleanRecord.net)
        : existingGame.biggestWin,
    biggestMultiplier:
      outcome === 'win'
        ? Math.max(existingGame.biggestMultiplier, cleanRecord.multiplier)
        : existingGame.biggestMultiplier,
    currentWinStreak: nextGameCurrentStreak,
    bestWinStreak: nextGameBestStreak,
    lastPlayedAt:
      existingGame.lastPlayedAt === null
        ? cleanRecord.timestamp
        : Math.max(existingGame.lastPlayedAt, cleanRecord.timestamp),
  };

  const nextByGame: Record<string, GameStats> = {
    ...stats.byGame,
    [cleanRecord.gameId]: nextGame,
  };

  const nextRecordedIds = [cleanRecord.id, ...stats.recordedRoundIds].slice(
    0,
    MAX_DEDUPE_IDS
  );

  return {
    overall: recomputeOverallStats(nextByGame, {
      currentWinStreak: nextOverallCurrentStreak,
      bestWinStreak: nextOverallBestStreak,
    }),
    byGame: nextByGame,
    recordedRoundIds: nextRecordedIds,
  };
}

/**
 * Pure ring buffer append: newest first, maximum `maxRecords` (default 50), deduplicated by `id`.
 */
export function appendRoundHistory(
  history: readonly RoundRecord[],
  record: RoundRecord,
  maxRecords: number = MAX_HISTORY_RECORDS
): RoundRecord[] {
  const cleanRecord = sanitizeRoundRecord(record);
  if (!cleanRecord) return [...history];

  if (history.some((item) => item.id === cleanRecord.id)) {
    return [...history];
  }

  const limit = Math.max(1, Math.floor(maxRecords));
  return [cleanRecord, ...history].slice(0, limit);
}

/**
 * Atomically updates both cumulative stats and the 50-record history ring buffer.
 * Guarantees neither updates if `record.id` was already recorded.
 */
export function recordRoundWithHistory(
  stats: StatsState,
  history: readonly RoundRecord[],
  record: RoundRecord,
  maxHistory: number = MAX_HISTORY_RECORDS
): { stats: StatsState; history: RoundRecord[]; recorded: boolean } {
  const cleanRecord = sanitizeRoundRecord(record);
  if (!cleanRecord) {
    return { stats, history: [...history], recorded: false };
  }

  const alreadyRecorded =
    stats.recordedRoundIds.includes(cleanRecord.id) ||
    history.some((item) => item.id === cleanRecord.id);

  if (alreadyRecorded) {
    return { stats, history: [...history], recorded: false };
  }

  return {
    stats: recordRound(stats, cleanRecord),
    history: appendRoundHistory(history, cleanRecord, maxHistory),
    recorded: true,
  };
}

/**
 * Sanitizes untrusted/corrupt stats input loaded from storage.
 */
export function sanitizeStatsState(raw: unknown): StatsState {
  if (!raw || typeof raw !== 'object') {
    return createEmptyStatsState();
  }

  const candidate =
    'stats' in raw && (raw as Record<string, unknown>).stats
      ? ((raw as Record<string, unknown>).stats as Record<string, unknown>)
      : (raw as Record<string, unknown>);

  if (!candidate || typeof candidate !== 'object') {
    return createEmptyStatsState();
  }

  const sanitizedByGame: Record<string, GameStats> = {};
  const rawByGame = candidate.byGame;

  if (rawByGame && typeof rawByGame === 'object' && !Array.isArray(rawByGame)) {
    for (const [key, value] of Object.entries(rawByGame as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue;
      const g = value as Record<string, unknown>;
      const gameId =
        typeof g.gameId === 'string' && g.gameId.trim().length > 0
          ? g.gameId.trim()
          : key.trim();
      if (!gameId) continue;

      const gameName =
        typeof g.gameName === 'string' && g.gameName.trim().length > 0
          ? g.gameName.trim()
          : gameId;

      const wins = clampNonNegativeInt(g.wins);
      const losses = clampNonNegativeInt(g.losses);
      const pushes = clampNonNegativeInt(g.pushes);
      const rounds = Math.max(clampNonNegativeInt(g.rounds), wins + losses + pushes);
      const totalWagered = clampNonNegativeNumber(g.totalWagered);
      const totalReturned = clampNonNegativeNumber(g.totalReturned);
      const net =
        typeof g.net === 'number' && Number.isFinite(g.net)
          ? sanitizeFiniteNumber(g.net)
          : totalReturned - totalWagered;
      const currentWinStreak = clampNonNegativeInt(g.currentWinStreak);
      const bestWinStreak = Math.max(
        clampNonNegativeInt(g.bestWinStreak),
        currentWinStreak
      );

      sanitizedByGame[gameId] = {
        gameId,
        gameName,
        rounds,
        wins,
        losses,
        pushes,
        totalWagered,
        totalReturned,
        net,
        biggestWin: clampNonNegativeNumber(g.biggestWin),
        biggestMultiplier: clampNonNegativeNumber(g.biggestMultiplier),
        currentWinStreak,
        bestWinStreak,
        lastPlayedAt: sanitizeTimestamp(g.lastPlayedAt),
      };
    }
  }

  const rawOverall =
    candidate.overall && typeof candidate.overall === 'object'
      ? (candidate.overall as Record<string, unknown>)
      : {};

  const currentStreak = clampNonNegativeInt(rawOverall.currentWinStreak);
  const bestStreak = clampNonNegativeInt(rawOverall.bestWinStreak);

  const recordedRoundIds: string[] = [];
  if (Array.isArray(candidate.recordedRoundIds)) {
    const seen = new Set<string>();
    for (const entry of candidate.recordedRoundIds) {
      if (typeof entry === 'string' && entry.trim().length > 0 && !seen.has(entry)) {
        seen.add(entry);
        recordedRoundIds.push(entry.trim());
        if (recordedRoundIds.length >= MAX_DEDUPE_IDS) break;
      }
    }
  }

  return {
    overall: recomputeOverallStats(sanitizedByGame, {
      currentWinStreak: currentStreak,
      bestWinStreak: bestStreak,
    }),
    byGame: sanitizedByGame,
    recordedRoundIds,
  };
}

/**
 * Sanitizes untrusted/corrupt round history loaded from storage.
 */
export function sanitizeHistory(
  raw: unknown,
  maxRecords: number = MAX_HISTORY_RECORDS
): RoundRecord[] {
  if (!raw) return [];

  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).records)
    ? ((raw as Record<string, unknown>).records as unknown[])
    : null;

  if (!list) return [];

  const clean: RoundRecord[] = [];
  const seenIds = new Set<string>();
  const limit = Math.max(1, Math.floor(maxRecords));

  for (const item of list) {
    const rec = sanitizeRoundRecord(item);
    if (!rec || seenIds.has(rec.id)) continue;
    seenIds.add(rec.id);
    clean.push(rec);
    if (clean.length >= limit) break;
  }

  return clean;
}

export function serializeStatsPayload(stats: StatsState): PersistedStatsPayload {
  return {
    version: STATS_STORAGE_VERSION,
    stats,
  };
}

export function deserializeStatsPayload(rawJson: string | null | undefined): StatsState {
  if (!rawJson) return createEmptyStatsState();
  try {
    const parsed = JSON.parse(rawJson);
    return sanitizeStatsState(parsed);
  } catch {
    return createEmptyStatsState();
  }
}

export function serializeHistoryPayload(
  records: readonly RoundRecord[]
): PersistedHistoryPayload {
  return {
    version: HISTORY_STORAGE_VERSION,
    records: records.slice(0, MAX_HISTORY_RECORDS),
  };
}

export function deserializeHistoryPayload(
  rawJson: string | null | undefined,
  maxRecords: number = MAX_HISTORY_RECORDS
): RoundRecord[] {
  if (!rawJson) return [];
  try {
    const parsed = JSON.parse(rawJson);
    return sanitizeHistory(parsed, maxRecords);
  } catch {
    return [];
  }
}

export function formatRelativeTime(timestamp: number | null, now: number = Date.now()): string {
  if (!timestamp || !Number.isFinite(timestamp) || timestamp <= 0) return 'Never';
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (diffSec < 45) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
