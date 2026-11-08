/**
 * Pure configuration data for Lucky Slots (v1: classic 3-reel, single payline).
 * No React, no logic, no side-effects. Easy to extend to many reels & paylines.
 */

export type SymbolId =
  | 'seven'
  | 'emerald'
  | 'bar'
  | 'bell'
  | 'cherry'
  | 'blank'
  | 'galaxy'
  | 'planet'
  | 'rocket'
  | 'alien'
  | 'moon'
  | 'star'
  | 'meteor'
  | 'comet';

export interface SymbolMeta {
  id: SymbolId;
  name: string;
  shortName: string;
  badgeColor: string;
}

export const SYMBOL_METADATA: Record<SymbolId, SymbolMeta> = {
  seven: {
    id: 'seven',
    name: 'Lucky Seven',
    shortName: '7',
    badgeColor: 'text-amber-400',
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Gem',
    shortName: 'Emerald',
    badgeColor: 'text-emerald-400',
  },
  bar: {
    id: 'bar',
    name: 'BAR Plate',
    shortName: 'BAR',
    badgeColor: 'text-amber-300',
  },
  bell: {
    id: 'bell',
    name: 'Liberty Bell',
    shortName: 'Bell',
    badgeColor: 'text-amber-400',
  },
  cherry: {
    id: 'cherry',
    name: 'Golden Cherries',
    shortName: 'Cherry',
    badgeColor: 'text-rose-400',
  },
  blank: {
    id: 'blank',
    name: 'Blank Stop',
    shortName: '—',
    badgeColor: 'text-slate-600',
  },
  galaxy: {
    id: 'galaxy',
    name: 'Spiral Galaxy',
    shortName: 'Galaxy',
    badgeColor: 'text-purple-400',
  },
  planet: {
    id: 'planet',
    name: 'Ringed Planet',
    shortName: 'Planet',
    badgeColor: 'text-amber-400',
  },
  rocket: {
    id: 'rocket',
    name: 'Cosmic Rocket',
    shortName: 'Rocket',
    badgeColor: 'text-rose-400',
  },
  alien: {
    id: 'alien',
    name: 'Martian Traveler',
    shortName: 'Alien',
    badgeColor: 'text-emerald-400',
  },
  moon: {
    id: 'moon',
    name: 'Crescent Moon',
    shortName: 'Moon',
    badgeColor: 'text-cyan-300',
  },
  star: {
    id: 'star',
    name: 'Radiant Star',
    shortName: 'Star',
    badgeColor: 'text-yellow-300',
  },
  meteor: {
    id: 'meteor',
    name: 'Blazing Meteor',
    shortName: 'Meteor',
    badgeColor: 'text-orange-400',
  },
  comet: {
    id: 'comet',
    name: 'Comet Wild',
    shortName: 'WILD',
    badgeColor: 'text-teal-300',
  },
};

export interface PaytableItem {
  id: string;
  name: string;
  multiplier: number;
  description: string;
  expectedHits?: number;
  symbol?: SymbolId;
}

export interface Payline {
  id: string;
  name: string;
  /** Row index per reel for this payline: e.g. [1, 1, 1] is middle row across 3 reels */
  rows: number[];
}

export interface SlotsConfig {
  reelsCount: number;
  visibleRows: number;
  stopsPerReel: number | number[];
  reelStrips: SymbolId[][];
  paylines: Payline[];
  paytable: PaytableItem[];
  ruleSet?: string;
}

export function getStopsPerReel(config: SlotsConfig): number[] {
  if (Array.isArray(config.stopsPerReel)) {
    return config.stopsPerReel;
  }
  if (typeof config.stopsPerReel === 'number') {
    return config.reelStrips.map(() => config.stopsPerReel as number);
  }
  return config.reelStrips.map((strip) => strip.length);
}

/**
 * 20-stop reel strips with composition:
 * 6 Cherry, 5 Bell, 3 Bar, 2 Emerald, 1 Lucky Seven, 3 Blank.
 * Identical symbols are non-adjacent across the circular strip.
 */
const REEL_0_STRIP: SymbolId[] = [
  'cherry', 'bell', 'bar', 'cherry', 'blank',
  'bell', 'emerald', 'cherry', 'bell', 'bar',
  'cherry', 'blank', 'bell', 'seven', 'cherry',
  'emerald', 'bell', 'bar', 'cherry', 'blank',
];

const REEL_1_STRIP: SymbolId[] = [
  'bell', 'cherry', 'blank', 'bar', 'cherry',
  'emerald', 'bell', 'cherry', 'blank', 'bell',
  'seven', 'cherry', 'bar', 'bell', 'cherry',
  'blank', 'bell', 'emerald', 'cherry', 'bar',
];

const REEL_2_STRIP: SymbolId[] = [
  'bar', 'cherry', 'bell', 'blank', 'cherry',
  'seven', 'bell', 'emerald', 'cherry', 'bar',
  'bell', 'blank', 'cherry', 'emerald', 'bell',
  'cherry', 'blank', 'bar', 'bell', 'cherry',
];

export const SLOTS_PAYTABLE: PaytableItem[] = [
  {
    id: 'three_sevens',
    name: '3x Lucky Seven',
    multiplier: 500,
    description: '7 · 7 · 7 on the center payline',
  },
  {
    id: 'three_emeralds',
    name: '3x Emerald Gem',
    multiplier: 60,
    description: 'Emerald · Emerald · Emerald',
  },
  {
    id: 'three_bars',
    name: '3x BAR Plate',
    multiplier: 25,
    description: 'BAR · BAR · BAR',
  },
  {
    id: 'three_bells',
    name: '3x Liberty Bell',
    multiplier: 8,
    description: 'Bell · Bell · Bell',
  },
  {
    id: 'three_cherries',
    name: '3x Golden Cherries',
    multiplier: 4,
    description: 'Cherry · Cherry · Cherry',
  },
  {
    id: 'two_cherries',
    name: 'Any 2 Cherries',
    multiplier: 2,
    description: 'Exactly 2 Cherries anywhere on payline',
  },
  {
    id: 'one_cherry_reel_1',
    name: '1 Cherry on Reel 1',
    multiplier: 1,
    description: 'Cherry on Reel 1 only (stake returned)',
  },
];

export const DEFAULT_SLOTS_CONFIG: SlotsConfig = {
  reelsCount: 3,
  visibleRows: 3,
  stopsPerReel: [20, 20, 20],
  reelStrips: [REEL_0_STRIP, REEL_1_STRIP, REEL_2_STRIP],
  paylines: [
    {
      id: 'middle',
      name: 'Center Payline',
      rows: [1, 1, 1], // Row index 1 (middle row) on reels 0, 1, 2
    },
  ],
  paytable: SLOTS_PAYTABLE,
  ruleSet: 'classic-cherry-3reel',
};
