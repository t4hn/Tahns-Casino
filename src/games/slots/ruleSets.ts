import { SymbolId, SlotsConfig } from './slotsConfig';

export interface LineEvaluationResult {
  multiplier: number;
  matchId: string;
  matchDescription: string;
  won: boolean;
}

export type LineEvaluator = (
  symbolsOnLine: SymbolId[],
  config: SlotsConfig
) => LineEvaluationResult;

export interface MatchOddsResult {
  totalOutcomesPerLine: number;
  hitsByMatch: Record<string, number>;
}

export type AnalyticalRtpCalculator = (config: SlotsConfig) => number;
export type MatchOddsCalculator = (config: SlotsConfig) => MatchOddsResult;

export interface RuleSetDefinition {
  id: string;
  name: string;
  evaluateLine: LineEvaluator;
  calculateAnalyticalRtp?: AnalyticalRtpCalculator;
  calculateMatchOdds?: MatchOddsCalculator;
}

const ruleSets: Map<string, RuleSetDefinition> = new Map();

/**
 * Evaluator for the classic 3-reel cherry & 7s rule set.
 * Hierarchy:
 * 1. Three-of-a-kind (Seven 500x, Emerald 60x, Bar 25x, Bell 8x, Cherry 4x)
 * 2. Exactly two cherries anywhere on the payline (2x)
 * 3. Exactly one cherry on Reel 1 only (1x, stake returned)
 * 4. Anything else: 0x
 */
export const classicCherry3ReelEvaluator: LineEvaluator = (symbolsOnLine, config) => {
  const [s0, s1, s2] = symbolsOnLine;
  let matchId: string | null = null;

  // 1. Three-of-a-kind check (Seven, Emerald, Bar, Bell, Cherry)
  if (symbolsOnLine.length === 3 && s0 === s1 && s1 === s2) {
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
};

/**
 * Exact analytical match frequencies for 1 payline of the classic 3-reel cherry machine.
 * Computes exact count of equally likely outcomes producing each paytable match.
 */
export const classicCherry3ReelMatchOdds: MatchOddsCalculator = (config) => {
  const numReels = config.reelStrips.length;
  if (numReels < 3) return { totalOutcomesPerLine: 0, hitsByMatch: {} };

  const len0 = config.reelStrips[0].length;
  const len1 = config.reelStrips[1].length;
  const len2 = config.reelStrips[2].length;
  const totalOutcomesPerLine = len0 * len1 * len2;

  const countSym = (reelIdx: number, sym: SymbolId) =>
    config.reelStrips[reelIdx].filter((s) => s === sym).length;

  const c0 = countSym(0, 'cherry');
  const c1 = countSym(1, 'cherry');
  const c2 = countSym(2, 'cherry');

  const nc0 = len0 - c0;
  const nc1 = len1 - c1;
  const nc2 = len2 - c2;

  // 3 of a kind frequencies
  const hits7 = countSym(0, 'seven') * countSym(1, 'seven') * countSym(2, 'seven');
  const hitsEmerald = countSym(0, 'emerald') * countSym(1, 'emerald') * countSym(2, 'emerald');
  const hitsBar = countSym(0, 'bar') * countSym(1, 'bar') * countSym(2, 'bar');
  const hitsBell = countSym(0, 'bell') * countSym(1, 'bell') * countSym(2, 'bell');
  const hitsCherry = c0 * c1 * c2;

  // Exactly 2 cherries
  const hits2Cherries = c0 * c1 * nc2 + c0 * nc1 * c2 + nc0 * c1 * c2;

  // Exactly 1 cherry on reel 1 (index 0)
  const hits1CherryReel1 = c0 * nc1 * nc2;

  const hitsByMatch: Record<string, number> = {
    three_sevens: hits7,
    three_emeralds: hitsEmerald,
    three_bars: hitsBar,
    three_bells: hitsBell,
    three_cherries: hitsCherry,
    two_cherries: hits2Cherries,
    one_cherry_reel_1: hits1CherryReel1,
  };

  const payingHits = hits7 + hitsEmerald + hitsBar + hitsBell + hitsCherry + hits2Cherries + hits1CherryReel1;
  hitsByMatch['no_win'] = totalOutcomesPerLine - payingHits;

  return {
    totalOutcomesPerLine,
    hitsByMatch,
  };
};

/**
 * Fast analytical RTP calculation for classic 3-reel cherry machine.
 * Computes exact return without enumerating all reel permutations.
 */
export const classicCherry3ReelAnalyticalRtp: AnalyticalRtpCalculator = (config) => {
  const odds = classicCherry3ReelMatchOdds(config);
  if (odds.totalOutcomesPerLine === 0) return 0;

  let totalReturn = 0;
  for (const item of config.paytable) {
    const hits = odds.hitsByMatch[item.id] || 0;
    totalReturn += hits * item.multiplier;
  }

  return totalReturn / odds.totalOutcomesPerLine;
};

// Register default classic rule set
registerRuleSet({
  id: 'classic-cherry-3reel',
  name: 'Classic Cherry 3-Reel',
  evaluateLine: classicCherry3ReelEvaluator,
  calculateAnalyticalRtp: classicCherry3ReelAnalyticalRtp,
  calculateMatchOdds: classicCherry3ReelMatchOdds,
});

/**
 * Line evaluator for left-to-right matching with wild substitution ('left-to-right-wild').
 * - Takes symbol on reel 1 (index 0) as base symbol.
 * - Counts consecutive symbols from the left matching the base symbol or wild ('comet').
 * - Run lengths of 3, 4, or 5 pay according to config paytable.
 * - Only the longest run per line counts.
 * - Wilds appear only on reels 2, 3, 4 so reel 1 is never wild.
 */
export const leftToRightWildEvaluator: LineEvaluator = (symbolsOnLine, config) => {
  if (symbolsOnLine.length < 3) {
    return { multiplier: 0, matchId: 'no_win', matchDescription: 'No Win', won: false };
  }

  const s0 = symbolsOnLine[0];
  // Reel 1 cannot be a wild or blank
  if (s0 === 'blank' || s0 === 'comet') {
    return { multiplier: 0, matchId: 'no_win', matchDescription: 'No Win', won: false };
  }

  let runLength = 1;
  for (let i = 1; i < symbolsOnLine.length; i++) {
    const sym = symbolsOnLine[i];
    if (sym === s0 || sym === 'comet') {
      runLength++;
    } else {
      break;
    }
  }

  if (runLength >= 3) {
    const matchId = `${s0}_${runLength}`;
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

  return { multiplier: 0, matchId: 'no_win', matchDescription: 'No Win', won: false };
};

/**
 * Fast analytical match odds for 1 payline of the left-to-right-wild rule set.
 * Exact outcome counts computed from per-reel symbol distributions across all 24^5 combinations.
 */
export const leftToRightWildMatchOdds: MatchOddsCalculator = (config) => {
  const numReels = config.reelStrips.length;
  if (numReels < 5) return { totalOutcomesPerLine: 0, hitsByMatch: {} };

  const lengths = config.reelStrips.map((strip) => strip.length);
  const totalOutcomesPerLine = lengths.reduce((acc, len) => acc * len, 1);

  const countSym = (reelIdx: number, sym: SymbolId) =>
    config.reelStrips[reelIdx].filter((s) => s === sym).length;

  const hitsByMatch: Record<string, number> = {};
  let payingHits = 0;

  // Extract distinct base symbols defined in the paytable (ignoring the length suffix)
  const baseSymbols = Array.from(
    new Set(
      config.paytable
        .map((p) => p.id.split('_')[0] as SymbolId)
        .filter((sym) => sym !== 'comet' && sym !== 'blank')
    )
  );

  for (const sym of baseSymbols) {
    const c0 = countSym(0, sym);
    if (c0 === 0) continue;

    // Reels 1, 2, 3 have sym + comet
    const m1 = countSym(1, sym) + countSym(1, 'comet');
    const m2 = countSym(2, sym) + countSym(2, 'comet');
    const m3 = countSym(3, sym) + countSym(3, 'comet');
    const nm3 = lengths[3] - m3;

    // Reel 4 has no comets
    const m4 = countSym(4, sym);
    const nm4 = lengths[4] - m4;

    // 5-of-a-kind: reels 0, 1, 2, 3, 4 all match
    const hits5 = c0 * m1 * m2 * m3 * m4;
    // 4-of-a-kind: reels 0, 1, 2, 3 match, reel 4 does not match
    const hits4 = c0 * m1 * m2 * m3 * nm4;
    // 3-of-a-kind: reels 0, 1, 2 match, reel 3 does not match, reel 4 can be anything
    const hits3 = c0 * m1 * m2 * nm3 * lengths[4];

    hitsByMatch[`${sym}_5`] = hits5;
    hitsByMatch[`${sym}_4`] = hits4;
    hitsByMatch[`${sym}_3`] = hits3;

    payingHits += hits5 + hits4 + hits3;
  }

  hitsByMatch['no_win'] = totalOutcomesPerLine - payingHits;

  return {
    totalOutcomesPerLine,
    hitsByMatch,
  };
};

/**
 * Fast exact analytical RTP calculation for left-to-right-wild rule set.
 * Returns exact return across all combinations without permutation loops.
 */
export const leftToRightWildAnalyticalRtp: AnalyticalRtpCalculator = (config) => {
  const odds = leftToRightWildMatchOdds(config);
  if (odds.totalOutcomesPerLine === 0) return 0;

  let totalReturn = 0;
  for (const item of config.paytable) {
    const hits = odds.hitsByMatch[item.id] || 0;
    totalReturn += hits * item.multiplier;
  }

  return totalReturn / odds.totalOutcomesPerLine;
};

// Register left-to-right-wild rule set
registerRuleSet({
  id: 'left-to-right-wild',
  name: 'Left-to-Right Wild',
  evaluateLine: leftToRightWildEvaluator,
  calculateAnalyticalRtp: leftToRightWildAnalyticalRtp,
  calculateMatchOdds: leftToRightWildMatchOdds,
});

export function registerRuleSet(def: RuleSetDefinition): void {
  ruleSets.set(def.id, def);
}

export function getRuleSet(id: string): RuleSetDefinition | undefined {
  return ruleSets.get(id);
}
