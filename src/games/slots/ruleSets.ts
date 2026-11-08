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

export function registerRuleSet(def: RuleSetDefinition): void {
  ruleSets.set(def.id, def);
}

export function getRuleSet(id: string): RuleSetDefinition | undefined {
  return ruleSets.get(id);
}
