/**
 * Persistent localStorage helper for Keno history (last 15 rounds) & statistics.
 * Uses the existing `tahns_casino_v2` storage prefix and safely handles corrupt,
 * partial, outdated, or missing storage data with strict roundId idempotency.
 */

import {
  KENO_DRAW_COUNT,
  KENO_MAX_NUMBER,
  KENO_MAX_SPOTS,
  KENO_MIN_NUMBER,
  KENO_MIN_SPOTS,
} from './kenoRules';

export const KENO_HISTORY_STORAGE_KEY = 'tahns_casino_v2_keno_history';
export const KENO_STATS_STORAGE_KEY = 'tahns_casino_v2_keno_stats';
export const MAX_KENO_HISTORY = 15;
const MAX_TRACKED_ROUND_IDS = 60;

export interface KenoHistoryEntry {
  roundId: string;
  timestamp: number;
  selectedNumbers: number[];
  drawnNumbers: number[];
  matchedNumbers: number[];
  spotCount: number;
  hits: number;
  multiplier: number;
  wager: number;
  grossPayout: number;
  net: number;
}

export interface KenoStats {
  totalRounds: number;
  winningRounds: number;
  bestHits: number;
  biggestGrossPayout: number;
  totalNet: number;
  recordedRoundIds: string[];
}

export const EMPTY_KENO_STATS: KenoStats = {
  totalRounds: 0,
  winningRounds: 0,
  bestHits: 0,
  biggestGrossPayout: 0,
  totalNet: 0,
  recordedRoundIds: [],
};

function getDefaultStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
      return (globalThis as unknown as { localStorage: Storage }).localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

function isUniqueKenoNumberArray(arr: unknown, minLen: number, maxLen: number): arr is number[] {
  if (!Array.isArray(arr) || arr.length < minLen || arr.length > maxLen) return false;
  const seen = new Set<number>();
  for (const val of arr) {
    if (
      typeof val !== 'number' ||
      !Number.isInteger(val) ||
      val < KENO_MIN_NUMBER ||
      val > KENO_MAX_NUMBER ||
      seen.has(val)
    ) {
      return false;
    }
    seen.add(val);
  }
  return true;
}

export function isValidKenoHistoryEntry(candidate: unknown): candidate is KenoHistoryEntry {
  if (!candidate || typeof candidate !== 'object') return false;
  const item = candidate as Record<string, unknown>;

  if (typeof item.roundId !== 'string' || item.roundId.trim().length === 0) return false;
  if (typeof item.timestamp !== 'number' || !Number.isFinite(item.timestamp)) return false;

  if (!isUniqueKenoNumberArray(item.selectedNumbers, KENO_MIN_SPOTS, KENO_MAX_SPOTS)) {
    return false;
  }
  if (!isUniqueKenoNumberArray(item.drawnNumbers, KENO_DRAW_COUNT, KENO_DRAW_COUNT)) {
    return false;
  }
  if (!isUniqueKenoNumberArray(item.matchedNumbers, 0, KENO_MAX_SPOTS)) {
    return false;
  }

  const selectedSet = new Set(item.selectedNumbers);
  const drawnSet = new Set(item.drawnNumbers);
  for (const m of item.matchedNumbers) {
    if (!selectedSet.has(m) || !drawnSet.has(m)) return false;
  }

  if (item.spotCount !== item.selectedNumbers.length) return false;
  if (item.hits !== item.matchedNumbers.length) return false;
  if (
    typeof item.multiplier !== 'number' ||
    !Number.isFinite(item.multiplier) ||
    item.multiplier < 0
  ) {
    return false;
  }
  if (typeof item.wager !== 'number' || !Number.isFinite(item.wager) || item.wager <= 0) {
    return false;
  }
  if (
    typeof item.grossPayout !== 'number' ||
    !Number.isFinite(item.grossPayout) ||
    item.grossPayout < 0
  ) {
    return false;
  }
  if (typeof item.net !== 'number' || !Number.isFinite(item.net)) return false;
  if (item.net !== item.grossPayout - item.wager) return false;

  return true;
}

export function sanitizeKenoHistory(raw: unknown): KenoHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const cleaned: KenoHistoryEntry[] = [];

  for (const item of raw) {
    if (!isValidKenoHistoryEntry(item)) continue;
    if (seen.has(item.roundId)) continue;
    seen.add(item.roundId);
    cleaned.push({
      roundId: item.roundId,
      timestamp: item.timestamp,
      selectedNumbers: [...item.selectedNumbers].sort((a, b) => a - b),
      drawnNumbers: [...item.drawnNumbers],
      matchedNumbers: [...item.matchedNumbers].sort((a, b) => a - b),
      spotCount: item.spotCount,
      hits: item.hits,
      multiplier: item.multiplier,
      wager: item.wager,
      grossPayout: item.grossPayout,
      net: item.net,
    });
    if (cleaned.length >= MAX_KENO_HISTORY) break;
  }

  return cleaned;
}

export function sanitizeKenoStats(raw: unknown): KenoStats {
  if (!raw || typeof raw !== 'object') {
    return { ...EMPTY_KENO_STATS, recordedRoundIds: [] };
  }
  const obj = raw as Record<string, unknown>;

  const totalRounds =
    typeof obj.totalRounds === 'number' &&
    Number.isInteger(obj.totalRounds) &&
    obj.totalRounds >= 0
      ? obj.totalRounds
      : 0;

  const rawWinning =
    typeof obj.winningRounds === 'number' &&
    Number.isInteger(obj.winningRounds) &&
    obj.winningRounds >= 0
      ? obj.winningRounds
      : 0;
  const winningRounds = Math.min(totalRounds, rawWinning);

  const bestHits =
    typeof obj.bestHits === 'number' &&
    Number.isInteger(obj.bestHits) &&
    obj.bestHits >= 0 &&
    obj.bestHits <= KENO_MAX_SPOTS
      ? obj.bestHits
      : 0;

  const biggestGrossPayout =
    typeof obj.biggestGrossPayout === 'number' &&
    Number.isFinite(obj.biggestGrossPayout) &&
    obj.biggestGrossPayout >= 0
      ? obj.biggestGrossPayout
      : 0;

  const totalNet =
    typeof obj.totalNet === 'number' && Number.isFinite(obj.totalNet)
      ? obj.totalNet
      : 0;

  const recordedRoundIds = Array.isArray(obj.recordedRoundIds)
    ? Array.from(
        new Set(
          obj.recordedRoundIds.filter(
            (id): id is string => typeof id === 'string' && id.trim().length > 0
          )
        )
      ).slice(0, MAX_TRACKED_ROUND_IDS)
    : [];

  return {
    totalRounds,
    winningRounds,
    bestHits,
    biggestGrossPayout,
    totalNet,
    recordedRoundIds,
  };
}

export function loadKenoHistory(storage: Storage | null = getDefaultStorage()): KenoHistoryEntry[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(KENO_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    return sanitizeKenoHistory(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function loadKenoStats(storage: Storage | null = getDefaultStorage()): KenoStats {
  if (!storage) return { ...EMPTY_KENO_STATS, recordedRoundIds: [] };
  try {
    const raw = storage.getItem(KENO_STATS_STORAGE_KEY);
    if (!raw) return { ...EMPTY_KENO_STATS, recordedRoundIds: [] };
    return sanitizeKenoStats(JSON.parse(raw));
  } catch {
    return { ...EMPTY_KENO_STATS, recordedRoundIds: [] };
  }
}

export function saveKenoHistory(
  entries: KenoHistoryEntry[],
  storage: Storage | null = getDefaultStorage()
): KenoHistoryEntry[] {
  const sanitized = sanitizeKenoHistory(entries);
  if (storage) {
    try {
      storage.setItem(KENO_HISTORY_STORAGE_KEY, JSON.stringify(sanitized));
    } catch {
      // Ignore storage quota or restricted context errors
    }
  }
  return sanitized;
}

export function saveKenoStats(
  stats: KenoStats,
  storage: Storage | null = getDefaultStorage()
): KenoStats {
  const sanitized = sanitizeKenoStats(stats);
  if (storage) {
    try {
      storage.setItem(KENO_STATS_STORAGE_KEY, JSON.stringify(sanitized));
    } catch {
      // Ignore storage quota or restricted context errors
    }
  }
  return sanitized;
}

/**
 * Atomically records a completed Keno round to both recent history (max 15) and
 * cumulative statistics, guaranteeing strict idempotency by `roundId`.
 */
export function recordCompletedKenoRound(
  entry: KenoHistoryEntry,
  storage: Storage | null = getDefaultStorage()
): { history: KenoHistoryEntry[]; stats: KenoStats; recorded: boolean } {
  const existingHistory = loadKenoHistory(storage);
  const existingStats = loadKenoStats(storage);

  if (!isValidKenoHistoryEntry(entry)) {
    return { history: existingHistory, stats: existingStats, recorded: false };
  }

  const alreadyRecorded =
    existingHistory.some((item) => item.roundId === entry.roundId) ||
    existingStats.recordedRoundIds.includes(entry.roundId);

  if (alreadyRecorded) {
    return { history: existingHistory, stats: existingStats, recorded: false };
  }

  const nextHistory = saveKenoHistory([entry, ...existingHistory].slice(0, MAX_KENO_HISTORY), storage);

  const nextStats = saveKenoStats(
    {
      totalRounds: existingStats.totalRounds + 1,
      winningRounds: existingStats.winningRounds + (entry.net > 0 ? 1 : 0),
      bestHits: Math.max(existingStats.bestHits, entry.hits),
      biggestGrossPayout: Math.max(existingStats.biggestGrossPayout, entry.grossPayout),
      totalNet: existingStats.totalNet + entry.net,
      recordedRoundIds: [entry.roundId, ...existingStats.recordedRoundIds].slice(
        0,
        MAX_TRACKED_ROUND_IDS
      ),
    },
    storage
  );

  return { history: nextHistory, stats: nextStats, recorded: true };
}

export function clearKenoPersistence(storage: Storage | null = getDefaultStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(KENO_HISTORY_STORAGE_KEY);
    storage.removeItem(KENO_STATS_STORAGE_KEY);
  } catch {
    // Ignore storage removal errors
  }
}
