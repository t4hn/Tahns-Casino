/**
 * Pure rules engine and payout evaluator for Lucky Slots.
 * No React, no DOM, no randomness, no side-effects.
 * Designed to easily extend to arbitrary reel counts and payline sets.
 */

import {
  DEFAULT_SLOTS_CONFIG,
  SlotsConfig,
  SymbolId,
  getStopsPerReel,
} from './slotsConfig';
import {
  getRuleSet,
  classicCherry3ReelEvaluator,
  classicCherry3ReelAnalyticalRtp,
} from './ruleSets';

export interface LineEvaluation {
  paylineIndex: number;
  paylineId: string;
  multiplier: number;
  matchId: string;
  matchDescription: string;
  symbols: SymbolId[];
  won: boolean;
  payout?: number;
}

export interface SpinEvaluation {
  stops: number[];
  /** rows x reels window: window[row][reel] */
  window: SymbolId[][];
  lines: LineEvaluation[];
  totalMultiplier: number;
  bet: number;
  payout: number;
  won: boolean;
  isProfit: boolean;
  net: number;
}

export interface HitStats {
  totalSpins: number;
  totalHits: number;
  totalProfits: number;
  hitFrequency: number;
  profitFrequency: number;
  hitsByMatch: Record<string, number>;
}

/**
 * Derives the visible symbols in the slot window from the chosen reel stops.
 * Returns a 2D array of rows: [topRow, middleRow (payline), bottomRow].
 */
export function getWindow(
  stops: number[],
  config: SlotsConfig = DEFAULT_SLOTS_CONFIG
): SymbolId[][] {
  const { visibleRows, reelStrips } = config;
  const stopsPerReel = getStopsPerReel(config);
  const result: SymbolId[][] = [];

  for (let row = 0; row < visibleRows; row++) {
    const rowSymbols: SymbolId[] = [];
    for (let reel = 0; reel < stops.length; reel++) {
      const strip = reelStrips[reel];
      const stopIdx = stops[reel];
      const reelStops = stopsPerReel[reel] || strip.length;
      // Row 0 is above center (-1), Row 1 is center (0), Row 2 is below (+1)
      const offset = row - 1;
      const index = (stopIdx + offset + reelStops) % reelStops;
      rowSymbols.push(strip[index]);
    }
    result.push(rowSymbols);
  }

  return result;
}

/**
 * Evaluates a single payline according to the configured ruleSet.
 */
export function evaluateLine(
  symbolsOnLine: SymbolId[],
  config: SlotsConfig = DEFAULT_SLOTS_CONFIG
): { multiplier: number; matchId: string; matchDescription: string; won: boolean } {
  const ruleSetId = config.ruleSet || 'classic-cherry-3reel';
  const ruleSetDef = getRuleSet(ruleSetId);
  const evaluator = ruleSetDef ? ruleSetDef.evaluateLine : classicCherry3ReelEvaluator;

  return evaluator(symbolsOnLine, config);
}

/**
 * Evaluates a complete spin across all configured paylines.
 * Supports multi-line split where betPerLine = bet / paylines.length.
 */
export function evaluateSpin(
  stops: number[],
  bet: number,
  config: SlotsConfig = DEFAULT_SLOTS_CONFIG
): SpinEvaluation {
  const window = getWindow(stops, config);
  const lines: LineEvaluation[] = [];
  let totalMultiplier = 0;

  const numPaylines = Math.max(1, config.paylines.length);
  const betPerLine = Math.max(1, Math.floor(bet / numPaylines));
  let totalPayout = 0;

  config.paylines.forEach((payline, index) => {
    // Extract the symbols along this payline
    const symbolsOnLine: SymbolId[] = payline.rows.map(
      (rowIdx, reelIdx) => window[rowIdx][reelIdx]
    );

    const lineEval = evaluateLine(symbolsOnLine, config);
    totalMultiplier += lineEval.multiplier;
    const linePayout = Math.round(betPerLine * lineEval.multiplier);
    totalPayout += linePayout;

    lines.push({
      paylineIndex: index,
      paylineId: payline.id,
      multiplier: lineEval.multiplier,
      matchId: lineEval.matchId,
      matchDescription: lineEval.matchDescription,
      symbols: symbolsOnLine,
      won: lineEval.won,
      payout: linePayout,
    });
  });

  const payout = totalPayout;
  const won = payout > 0;
  const isProfit = payout > bet;
  const net = payout - bet;

  return {
    stops,
    window,
    lines,
    totalMultiplier,
    bet,
    payout,
    won,
    isProfit,
    net,
  };
}

/**
 * Fast exact RTP calculation method that computes expected return analytically
 * without full combinatorial enumeration where available.
 */
export function calculateAnalyticalRtp(config: SlotsConfig = DEFAULT_SLOTS_CONFIG): number {
  const ruleSetId = config.ruleSet || 'classic-cherry-3reel';
  const ruleSetDef = getRuleSet(ruleSetId);

  if (ruleSetDef?.calculateAnalyticalRtp) {
    return ruleSetDef.calculateAnalyticalRtp(config);
  }

  // Fallback to enumeration if no analytical formula is defined
  return calculateRtp(config);
}

/**
 * Calculates theoretical Return to Player (RTP) by exhaustively enumerating
 * all equally likely combinations generically across any reel count and stop lengths.
 */
export function calculateRtp(config: SlotsConfig = DEFAULT_SLOTS_CONFIG): number {
  const stopsLengths = getStopsPerReel(config);
  const numReels = config.reelStrips.length;
  const totalOutcomes = stopsLengths.reduce((acc, len) => acc * len, 1);

  if (totalOutcomes === 0) return 0;

  let totalReturn = 0;
  const currentStops = new Array(numReels).fill(0);

  for (let i = 0; i < totalOutcomes; i++) {
    const spin = evaluateSpin([...currentStops], 100, config);
    totalReturn += spin.payout;

    // Advance odometer
    for (let r = numReels - 1; r >= 0; r--) {
      currentStops[r]++;
      if (currentStops[r] < stopsLengths[r]) {
        break;
      }
      currentStops[r] = 0;
    }
  }

  return totalReturn / (totalOutcomes * 100);
}

/**
 * Calculates hit statistics across all combinations generically for any reel count:
 * - Hit frequency (any return >= 1x)
 * - Profit frequency (returns > 1x)
 * - Counts per paytable match ID
 */
export function calculateHitStats(config: SlotsConfig = DEFAULT_SLOTS_CONFIG): HitStats {
  const stopsLengths = getStopsPerReel(config);
  const numReels = config.reelStrips.length;
  const totalSpins = stopsLengths.reduce((acc, len) => acc * len, 1);

  let totalHits = 0;
  let totalProfits = 0;
  const hitsByMatch: Record<string, number> = {};

  config.paytable.forEach((item) => {
    hitsByMatch[item.id] = 0;
  });
  hitsByMatch['no_win'] = 0;

  const currentStops = new Array(numReels).fill(0);

  for (let i = 0; i < totalSpins; i++) {
    const spin = evaluateSpin([...currentStops], 100, config);
    const line = spin.lines[0];

    if (line) {
      hitsByMatch[line.matchId] = (hitsByMatch[line.matchId] || 0) + 1;
    }

    if (spin.won) {
      totalHits++;
    }
    if (spin.isProfit) {
      totalProfits++;
    }

    // Advance odometer
    for (let r = numReels - 1; r >= 0; r--) {
      currentStops[r]++;
      if (currentStops[r] < stopsLengths[r]) {
        break;
      }
      currentStops[r] = 0;
    }
  }

  return {
    totalSpins,
    totalHits,
    totalProfits,
    hitFrequency: totalSpins > 0 ? totalHits / totalSpins : 0,
    profitFrequency: totalSpins > 0 ? totalProfits / totalSpins : 0,
    hitsByMatch,
  };
}
