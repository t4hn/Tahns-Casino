/**
 * Persistent localStorage helper for European Roulette settled round history.
 * Uses the existing `tahns_casino_v2` storage key prefix and safely handles
 * corrupt, partial, or missing storage data.
 */

import { getPocketColor } from './rouletteRules';
import type { SpinHistoryEntry } from './rouletteState';

export const ROULETTE_HISTORY_STORAGE_KEY = 'tahns_casino_v2_roulette_history';
export const MAX_ROULETTE_HISTORY = 15;

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

export function isValidHistoryEntry(candidate: unknown): candidate is SpinHistoryEntry {
  if (!candidate || typeof candidate !== 'object') return false;
  const item = candidate as Record<string, unknown>;

  if (typeof item.roundId !== 'string' || item.roundId.trim().length === 0) return false;
  if (
    typeof item.number !== 'number' ||
    !Number.isInteger(item.number) ||
    item.number < 0 ||
    item.number > 36
  ) {
    return false;
  }
  const expectedColor = getPocketColor(item.number);
  if (item.color !== expectedColor) return false;
  if (typeof item.timestamp !== 'number' || !Number.isFinite(item.timestamp)) return false;
  if (typeof item.totalWager !== 'number' || !Number.isFinite(item.totalWager) || item.totalWager < 0) {
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

  return true;
}

/**
 * Sanitizes, deduplicates by `roundId`, and caps history to MAX_ROULETTE_HISTORY (15).
 */
export function sanitizeRouletteHistory(raw: unknown): SpinHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const seenRoundIds = new Set<string>();
  const cleaned: SpinHistoryEntry[] = [];

  for (const item of raw) {
    if (!isValidHistoryEntry(item)) continue;
    if (seenRoundIds.has(item.roundId)) continue;
    seenRoundIds.add(item.roundId);
    cleaned.push({
      roundId: item.roundId,
      number: item.number,
      color: item.color,
      timestamp: item.timestamp,
      totalWager: item.totalWager,
      grossPayout: item.grossPayout,
      net: item.net,
    });
    if (cleaned.length >= MAX_ROULETTE_HISTORY) break;
  }

  return cleaned;
}

export function loadRouletteHistory(storage: Storage | null = getDefaultStorage()): SpinHistoryEntry[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(ROULETTE_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return sanitizeRouletteHistory(parsed);
  } catch {
    return [];
  }
}

export function saveRouletteHistory(
  entries: SpinHistoryEntry[],
  storage: Storage | null = getDefaultStorage()
): SpinHistoryEntry[] {
  const sanitized = sanitizeRouletteHistory(entries);
  if (storage) {
    try {
      storage.setItem(ROULETTE_HISTORY_STORAGE_KEY, JSON.stringify(sanitized));
    } catch {
      // Ignore storage quota or restricted context errors
    }
  }
  return sanitized;
}

/**
 * Atomically prepends a settled roulette spin to persistent storage if its `roundId`
 * has not already been recorded, protecting against duplicate entries during
 * remounts, unmount settlement, or crash recovery.
 */
export function appendRouletteHistoryEntry(
  entry: SpinHistoryEntry,
  storage: Storage | null = getDefaultStorage()
): SpinHistoryEntry[] {
  const existing = loadRouletteHistory(storage);
  if (!isValidHistoryEntry(entry)) {
    return existing;
  }
  if (existing.some((item) => item.roundId === entry.roundId)) {
    return existing;
  }
  const updated = [entry, ...existing].slice(0, MAX_ROULETTE_HISTORY);
  return saveRouletteHistory(updated, storage);
}

export function clearRouletteHistory(storage: Storage | null = getDefaultStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(ROULETTE_HISTORY_STORAGE_KEY);
  } catch {
    // Ignore storage removal errors
  }
}
