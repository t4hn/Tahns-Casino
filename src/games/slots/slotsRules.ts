/**
 * Pure rules engine and payout evaluator for Lucky Slots.
 * No React, no DOM, no randomness, no side-effects.
 * Designed to easily extend to arbitrary reel counts and payline sets.
 */

import {
  DEFAULT_SLOTS_CONFIG,
  SlotsConfig,
  SymbolId,
} from './slotsConfig';

export interface LineEvaluation {
  paylineIndex: number;
  paylineId: string;
  multiplier: number;
  matchId: string;
  matchDescription: string;
  symbols: SymbolId[];
  won: boolean;
}

export interface SpinEvaluation {
  stops: number[];
  /** 3 rows x N reels window: window[row][reel] */
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
  const { visibleRows, stopsPerReel, reelStrips } = config;
  const result: SymbolId[][] = [];

  for (let row = 0; row < visibleRows; row++) {
    const rowSymbols: SymbolId[] = [];
    for (let reel = 0; reel < stops.length; reel++) {
      const strip = reelStrips[reel];
      const stopIdx = stops[reel];
      // Row 0 is above payline (-1), Row 1 is center payline (0), Row 2 is below (+1)
      const offset = row - 1;
      const index = (stopIdx + offset + stopsPerReel) % stopsPerReel;
      rowSymbols.push(strip[index]);
    }
    result.push(rowSymbols);
  }

  return result;
}

/**
 * Evaluates a single payline according to classic 3-reel slot rules.
 * Hierarchy:
 * 1. Three-of-a-kind (Seven 500x, Emerald 60x, Bar 25x, Bell 8x, Cherry 4x)
 * 2. Exactly two cherries anywhere on the payline (2x)
 * 3. Exactly one cherry on Reel 1 only (1x, stake returned)
 * 4. Anything else: 0x
 */
export function evaluateLine(
  symbolsOnLine: SymbolId[],
  config: SlotsConfig = DEFAULT_SLOTS_CONFIG
): { multiplier: number; matchId: string; matchDescription: string; won: boolean } {
  const [s0, s1, s2] = symbolsOnLine;
  let matchId: string | null = null;

  // 1. Three-of-a-kind check (Seven, Emerald, Bar, Bell, Cherry)
  if (s0 === s1 && s1 === s2) {
    switch (s0) {
      case 'seven':
        matchId = 'three_sevens';
        break;
      case 'emerald':
        matchId = 'three_emeralds';
        break;
      case 'bar':
        matchId = 'three_bars';
        break;
      case 'bell':
        matchId = 'three_bells';
        break;
      case 'cherry':
        matchId = 'three_cherries';
        break;
      case 'blank':
      default:
        // 3 blanks do not pay
        break;
    }
  }

  if (!matchId) {
    // Count occurrences of cherry on this payline
    let cherryCount = 0;
    for (let i = 0; i < symbolsOnLine.length; i++) {
      if (symbolsOnLine[i] === 'cherry') cherryCount++;
    }

    // 2. Exactly two cherries anywhere on the payline
    if (cherryCount === 2) {
      matchId = 'two_cherries';
    } else if (cherryCount === 1 && s0 === 'cherry') {
      // 3. Cherry on Reel 1 only (exactly one cherry on the line, located at reel index 0)
      matchId = 'one_cherry_reel_1';
    }
  }

  if (matchId) {
    const payItem = config.paytable.find((p) => p.id === matchId);
    if (payItem) {
      return {
        multiplier: payItem.multiplier,
        matchId: payItem.id,
        matchDescription: payItem.name,
        won: payItem.multiplier > 0,
      };
    }
  }

  // 4. No paying combination
  return {
    multiplier: 0,
    matchId: 'no_win',
    matchDescription: 'No Win',
    won: false,
  };
}

/**
 * Evaluates a complete spin across all configured paylines.
 * NOTE: In v1 there is exactly one payline (the center row), so payout = Math.round(bet * lineMultiplier).
 * Future multi-line play will split the bet across active lines (e.g. betPerLine = bet / paylines.length).
 */
export function evaluateSpin(
  stops: number[],
  bet: number,
  config: SlotsConfig = DEFAULT_SLOTS_CONFIG
): SpinEvaluation {
  const window = getWindow(stops, config);
  const lines: LineEvaluation[] = [];
  let totalMultiplier = 0;

  config.paylines.forEach((payline, index) => {
    // Extract the symbols along this payline
    const symbolsOnLine: SymbolId[] = payline.rows.map(
      (rowIdx, reelIdx) => window[rowIdx][reelIdx]
    );

    const lineEval = evaluateLine(symbolsOnLine, config);
    totalMultiplier += lineEval.multiplier;

    lines.push({
      paylineIndex: index,
      paylineId: payline.id,
      multiplier: lineEval.multiplier,
      matchId: lineEval.matchId,
      matchDescription: lineEval.matchDescription,
      symbols: symbolsOnLine,
      won: lineEval.won,
    });
  });

  const payout = Math.round(bet * totalMultiplier);
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
 * Calculates theoretical Return to Player (RTP) by exhaustively enumerating
 * all 8,000 equally likely combinations (20 stops ^ 3 reels).
 */
export function calculateRtp(config: SlotsConfig = DEFAULT_SLOTS_CONFIG): number {
  const totalOutcomes = config.stopsPerReel * config.stopsPerReel * config.stopsPerReel;
  let totalReturn = 0;

  for (let s0 = 0; s0 < config.stopsPerReel; s0++) {
    for (let s1 = 0; s1 < config.stopsPerReel; s1++) {
      for (let s2 = 0; s2 < config.stopsPerReel; s2++) {
        const spin = evaluateSpin([s0, s1, s2], 100, config);
        totalReturn += spin.payout;
      }
    }
  }

  return totalReturn / (totalOutcomes * 100);
}

/**
 * Calculates hit statistics across all 8,000 combinations:
 * - Hit frequency (any return >= 1x)
 * - Profit frequency (returns > 1x)
 * - Counts per paytable match ID
 */
export function calculateHitStats(config: SlotsConfig = DEFAULT_SLOTS_CONFIG): HitStats {
  const totalSpins = config.stopsPerReel * config.stopsPerReel * config.stopsPerReel;
  let totalHits = 0;
  let totalProfits = 0;
  const hitsByMatch: Record<string, number> = {
    three_sevens: 0,
    three_emeralds: 0,
    three_bars: 0,
    three_bells: 0,
    three_cherries: 0,
    two_cherries: 0,
    one_cherry_reel_1: 0,
    no_win: 0,
  };

  for (let s0 = 0; s0 < config.stopsPerReel; s0++) {
    for (let s1 = 0; s1 < config.stopsPerReel; s1++) {
      for (let s2 = 0; s2 < config.stopsPerReel; s2++) {
        const spin = evaluateSpin([s0, s1, s2], 100, config);
        const line = spin.lines[0];

        hitsByMatch[line.matchId] = (hitsByMatch[line.matchId] || 0) + 1;

        if (spin.won) {
          totalHits++;
        }
        if (spin.isProfit) {
          totalProfits++;
        }
      }
    }
  }

  return {
    totalSpins,
    totalHits,
    totalProfits,
    hitFrequency: totalHits / totalSpins,
    profitFrequency: totalProfits / totalSpins,
    hitsByMatch,
  };
}
