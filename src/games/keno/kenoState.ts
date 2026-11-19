/**
 * Pure state machine for Keno round lifecycle, selections, Quick Pick,
 * Repeat Bet, sequential draw reveal, and idempotent settlement.
 */

import {
  KENO_DEFAULT_QUICK_PICK_SPOTS,
  KENO_DRAW_COUNT,
  KENO_MAX_SPOTS,
  KENO_MIN_SPOTS,
  KenoEvaluation,
  drawKenoNumbers,
  evaluateKenoRound,
  generateQuickPick,
  normalizeKenoSelection,
  toggleKenoNumber,
  validateKenoRound,
} from './kenoRules';
import {
  EMPTY_KENO_STATS,
  KenoHistoryEntry,
  KenoStats,
} from './kenoStorage';

export type KenoPhase = 'IDLE' | 'DRAWING' | 'SETTLED';

export interface KenoGameState {
  roundId: string;
  phase: KenoPhase;
  selectedNumbers: number[];
  quickPickCount: number;
  wager: number;
  drawnSequence: number[];
  revealedCount: number;
  evaluation: KenoEvaluation | null;
  previousSelection: number[] | null;
  previousWager: number | null;
  history: KenoHistoryEntry[];
  stats: KenoStats;
  settledRoundIds: string[];
}

function generateKenoRoundId(): string {
  return `keno_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createInitialKenoState(
  initialWager: number = 20,
  initialHistory: KenoHistoryEntry[] = [],
  initialStats: KenoStats = { ...EMPTY_KENO_STATS, recordedRoundIds: [] }
): KenoGameState {
  const safeWager = Math.max(10, Math.floor(initialWager / 10) * 10);
  const lastEntry = initialHistory[0];
  return {
    roundId: generateKenoRoundId(),
    phase: 'IDLE',
    selectedNumbers: [],
    quickPickCount: KENO_DEFAULT_QUICK_PICK_SPOTS,
    wager: safeWager,
    drawnSequence: [],
    revealedCount: 0,
    evaluation: null,
    previousSelection: lastEntry ? [...lastEntry.selectedNumbers] : null,
    previousWager: lastEntry ? lastEntry.wager : null,
    history: [...initialHistory],
    stats: {
      ...initialStats,
      recordedRoundIds: [...initialStats.recordedRoundIds],
    },
    settledRoundIds: [],
  };
}

/**
 * Toggles a number on the player's ticket when not drawing.
 * If currently SETTLED, returns to IDLE and clears previous draw visuals.
 */
export function toggleSpotInState(
  state: KenoGameState,
  num: number
): { state: KenoGameState; changed: boolean; reason?: string } {
  if (state.phase === 'DRAWING') {
    return { state, changed: false, reason: 'Draw in progress.' };
  }

  const res = toggleKenoNumber(state.selectedNumbers, num);
  if (!res.changed) {
    return { state, changed: false, reason: res.reason };
  }

  const nextSpotCount = res.selected.length;
  return {
    changed: true,
    state: {
      ...state,
      phase: 'IDLE',
      selectedNumbers: res.selected,
      quickPickCount:
        nextSpotCount >= KENO_MIN_SPOTS && nextSpotCount <= KENO_MAX_SPOTS
          ? nextSpotCount
          : state.quickPickCount,
      drawnSequence: [],
      revealedCount: 0,
      evaluation: null,
    },
  };
}

export function setQuickPickSpotCount(
  state: KenoGameState,
  spotCount: number
): KenoGameState {
  if (state.phase === 'DRAWING') return state;
  const safeCount = Number.isFinite(spotCount) ? spotCount : KENO_DEFAULT_QUICK_PICK_SPOTS;
  const clamped = Math.max(
    KENO_MIN_SPOTS,
    Math.min(KENO_MAX_SPOTS, Math.round(safeCount))
  );
  return {
    ...state,
    quickPickCount: clamped,
  };
}

/**
 * Generates a Quick Pick ticket of `desiredCount` (or current spot count / quickPickCount).
 */
export function applyQuickPick(
  state: KenoGameState,
  desiredCount?: number,
  customRng?: () => number
): KenoGameState {
  if (state.phase === 'DRAWING') return state;
  const count =
    desiredCount !== undefined
      ? Math.max(KENO_MIN_SPOTS, Math.min(KENO_MAX_SPOTS, Math.round(desiredCount)))
      : state.selectedNumbers.length > 0
      ? state.selectedNumbers.length
      : state.quickPickCount;

  const picked = generateQuickPick(count, customRng);
  return {
    ...state,
    phase: 'IDLE',
    selectedNumbers: picked,
    quickPickCount: picked.length,
    drawnSequence: [],
    revealedCount: 0,
    evaluation: null,
  };
}

export function clearKenoSelection(state: KenoGameState): KenoGameState {
  if (state.phase === 'DRAWING') return state;
  return {
    ...state,
    phase: 'IDLE',
    selectedNumbers: [],
    drawnSequence: [],
    revealedCount: 0,
    evaluation: null,
  };
}

export function setKenoWager(
  state: KenoGameState,
  wager: number,
  minBet: number,
  maxBet: number,
  balance: number
): KenoGameState {
  if (state.phase === 'DRAWING') return state;
  const maxAllowed = balance > 0 ? Math.min(maxBet, balance) : maxBet;
  const clamped = Math.max(minBet, Math.min(wager, maxAllowed));
  const rounded = Math.max(minBet, Math.floor(clamped / 10) * 10);
  return {
    ...state,
    wager: rounded,
  };
}

export function repeatPreviousKenoBet(
  state: KenoGameState,
  minBet: number,
  maxBet: number,
  balance: number
): { state: KenoGameState; repeated: boolean; reason?: string } {
  if (state.phase === 'DRAWING') {
    return { state, repeated: false, reason: 'Draw in progress.' };
  }
  if (!state.previousSelection || state.previousSelection.length === 0 || !state.previousWager) {
    return { state, repeated: false, reason: 'No previous Keno ticket to repeat.' };
  }

  const cleanPrev = normalizeKenoSelection(state.previousSelection);
  if (cleanPrev.length === 0) {
    return { state, repeated: false, reason: 'Previous ticket has no valid numbers.' };
  }

  if (balance < minBet || state.previousWager > balance) {
    return { state, repeated: false, reason: 'Insufficient credits to repeat previous wager.' };
  }

  const boundedWager = Math.max(minBet, Math.min(state.previousWager, maxBet, balance));
  const cleanWager = Math.floor(boundedWager / 10) * 10;

  return {
    repeated: true,
    state: {
      ...state,
      phase: 'IDLE',
      selectedNumbers: cleanPrev,
      quickPickCount: cleanPrev.length,
      wager: cleanWager,
      drawnSequence: [],
      revealedCount: 0,
      evaluation: null,
    },
  };
}

/**
 * Transitions from IDLE/SETTLED to DRAWING:
 * - Validates selection (1..10) & wager against wallet/table limits.
 * - Generates the full 20-ball draw and computes evaluation immediately from real draw.
 */
export function startKenoDraw(
  state: KenoGameState,
  minBet: number,
  maxBet: number,
  balance: number,
  customRng?: () => number
): { state: KenoGameState; started: boolean; reason?: string; historyEntry?: KenoHistoryEntry } {
  if (state.phase === 'DRAWING') {
    return { state, started: false, reason: 'A Keno draw is already in progress.' };
  }

  const validation = validateKenoRound(
    state.selectedNumbers,
    state.wager,
    minBet,
    maxBet,
    balance
  );
  if (!validation.valid) {
    return { state, started: false, reason: validation.reason };
  }

  const roundId = generateKenoRoundId();
  const drawnSequence = drawKenoNumbers(customRng);
  const evaluation = evaluateKenoRound(state.selectedNumbers, drawnSequence, state.wager);

  const historyEntry: KenoHistoryEntry = {
    roundId,
    timestamp: Date.now(),
    selectedNumbers: evaluation.selectedNumbers,
    drawnNumbers: evaluation.drawnNumbers,
    matchedNumbers: evaluation.matchedNumbers,
    spotCount: evaluation.spotCount,
    hits: evaluation.hits,
    multiplier: evaluation.multiplier,
    wager: evaluation.wager,
    grossPayout: evaluation.grossPayout,
    net: evaluation.net,
  };

  return {
    started: true,
    historyEntry,
    state: {
      ...state,
      roundId,
      phase: 'DRAWING',
      drawnSequence,
      revealedCount: 0,
      evaluation,
      previousSelection: [...evaluation.selectedNumbers],
      previousWager: evaluation.wager,
    },
  };
}

export function advanceKenoReveal(state: KenoGameState): KenoGameState {
  if (state.phase !== 'DRAWING') return state;
  const nextCount = Math.min(KENO_DRAW_COUNT, state.revealedCount + 1);
  return {
    ...state,
    revealedCount: nextCount,
  };
}

/**
 * Idempotently settles the active DRAWING round into SETTLED.
 * Prevents duplicate settlement for the same `roundId`.
 */
export function claimKenoSettlement(
  state: KenoGameState,
  persistedHistory?: KenoHistoryEntry[],
  persistedStats?: KenoStats
): { state: KenoGameState; claimed: boolean; entry?: KenoHistoryEntry } {
  if (state.phase !== 'DRAWING' || !state.evaluation) {
    return { state, claimed: false };
  }
  if (state.settledRoundIds.includes(state.roundId)) {
    return { state, claimed: false };
  }

  const entry: KenoHistoryEntry = {
    roundId: state.roundId,
    timestamp: Date.now(),
    selectedNumbers: state.evaluation.selectedNumbers,
    drawnNumbers: state.evaluation.drawnNumbers,
    matchedNumbers: state.evaluation.matchedNumbers,
    spotCount: state.evaluation.spotCount,
    hits: state.evaluation.hits,
    multiplier: state.evaluation.multiplier,
    wager: state.evaluation.wager,
    grossPayout: state.evaluation.grossPayout,
    net: state.evaluation.net,
  };

  return {
    claimed: true,
    entry,
    state: {
      ...state,
      phase: 'SETTLED',
      revealedCount: KENO_DRAW_COUNT,
      history: persistedHistory ?? [entry, ...state.history].slice(0, 15),
      stats: persistedStats ?? state.stats,
      settledRoundIds: [...state.settledRoundIds, state.roundId],
    },
  };
}
