/**
 * Pure configuration data for Nova Voyager (5 reels x 3 rows, 10 fixed paylines).
 * High volatility cosmic slot machine with Comet wilds and left-to-right evaluation.
 */

import { Payline, PaytableItem, SlotsConfig, SymbolId } from './slotsConfig';

/**
 * Reel strips for Reels 1 and 5 (24 stops each):
 * 1 Galaxy, 2 Planet, 2 Rocket, 3 Alien, 4 Moon, 6 Star, 6 Meteor.
 * Identical symbols are clustered / non-adjacent where possible.
 */
export const NOVA_REEL_1_5_STRIP: SymbolId[] = [
  'galaxy', 'planet', 'planet', 'rocket', 'rocket', 'alien', 'alien', 'alien',
  'moon', 'moon', 'moon', 'moon',
  'star', 'star', 'star', 'star', 'star', 'star',
  'meteor', 'meteor', 'meteor', 'meteor', 'meteor', 'meteor',
];

/**
 * Reel strips for Reels 2, 3, 4 (24 stops each):
 * 1 Galaxy, 2 Planet, 2 Rocket, 2 Alien, 3 Moon, 5 Star, 5 Meteor, 4 Comet.
 */
export const NOVA_REEL_2_3_4_STRIP: SymbolId[] = [
  'galaxy', 'planet', 'planet', 'rocket', 'rocket', 'alien', 'alien',
  'moon', 'moon', 'moon',
  'star', 'star', 'star', 'star', 'star',
  'meteor', 'meteor', 'meteor', 'meteor', 'meteor',
  'comet', 'comet', 'comet', 'comet',
];

export const NOVA_PAYLINES: Payline[] = [
  { id: 'line_1', name: 'Center Row', rows: [1, 1, 1, 1, 1] },
  { id: 'line_2', name: 'Top Row', rows: [0, 0, 0, 0, 0] },
  { id: 'line_3', name: 'Bottom Row', rows: [2, 2, 2, 2, 2] },
  { id: 'line_4', name: 'V-Shape Down', rows: [0, 1, 2, 1, 0] },
  { id: 'line_5', name: 'Inverted V Up', rows: [2, 1, 0, 1, 2] },
  { id: 'line_6', name: 'Top-to-Bottom Slope', rows: [0, 0, 1, 2, 2] },
  { id: 'line_7', name: 'Bottom-to-Top Slope', rows: [2, 2, 1, 0, 0] },
  { id: 'line_8', name: 'Center-Top-Center', rows: [1, 0, 0, 0, 1] },
  { id: 'line_9', name: 'Center-Bottom-Center', rows: [1, 2, 2, 2, 1] },
  { id: 'line_10', name: 'Zig-Zag Top-Center', rows: [0, 1, 0, 1, 0] },
];

export const NOVA_PAYTABLE: PaytableItem[] = [
  // Galaxy (Top symbol)
  {
    id: 'galaxy_5',
    name: '5x Spiral Galaxy',
    multiplier: 5000,
    description: '5 Galaxies on an active payline',
  },
  {
    id: 'galaxy_4',
    name: '4x Spiral Galaxy',
    multiplier: 200,
    description: '4 Galaxies from leftmost reel',
  },
  {
    id: 'galaxy_3',
    name: '3x Spiral Galaxy',
    multiplier: 20,
    description: '3 Galaxies from leftmost reel',
  },

  // Ringed Planet
  {
    id: 'planet_5',
    name: '5x Ringed Planet',
    multiplier: 300,
    description: '5 Planets on an active payline',
  },
  {
    id: 'planet_4',
    name: '4x Ringed Planet',
    multiplier: 50,
    description: '4 Planets from leftmost reel',
  },
  {
    id: 'planet_3',
    name: '3x Ringed Planet',
    multiplier: 12,
    description: '3 Planets from leftmost reel',
  },

  // Cosmic Rocket
  {
    id: 'rocket_5',
    name: '5x Cosmic Rocket',
    multiplier: 150,
    description: '5 Rockets on an active payline',
  },
  {
    id: 'rocket_4',
    name: '4x Cosmic Rocket',
    multiplier: 25,
    description: '4 Rockets from leftmost reel',
  },
  {
    id: 'rocket_3',
    name: '3x Cosmic Rocket',
    multiplier: 8,
    description: '3 Rockets from leftmost reel',
  },

  // Martian Alien
  {
    id: 'alien_5',
    name: '5x Alien Traveler',
    multiplier: 75,
    description: '5 Aliens on an active payline',
  },
  {
    id: 'alien_4',
    name: '4x Alien Traveler',
    multiplier: 20,
    description: '4 Aliens from leftmost reel',
  },
  {
    id: 'alien_3',
    name: '3x Alien Traveler',
    multiplier: 5,
    description: '3 Aliens from leftmost reel',
  },

  // Crescent Moon
  {
    id: 'moon_5',
    name: '5x Crescent Moon',
    multiplier: 40,
    description: '5 Moons on an active payline',
  },
  {
    id: 'moon_4',
    name: '4x Crescent Moon',
    multiplier: 12,
    description: '4 Moons from leftmost reel',
  },
  {
    id: 'moon_3',
    name: '3x Crescent Moon',
    multiplier: 4,
    description: '3 Moons from leftmost reel',
  },

  // Radiant Star
  {
    id: 'star_5',
    name: '5x Radiant Star',
    multiplier: 30,
    description: '5 Stars on an active payline',
  },
  {
    id: 'star_4',
    name: '4x Radiant Star',
    multiplier: 8,
    description: '4 Stars from leftmost reel',
  },
  {
    id: 'star_3',
    name: '3x Radiant Star',
    multiplier: 3,
    description: '3 Stars from leftmost reel',
  },

  // Blazing Meteor
  {
    id: 'meteor_5',
    name: '5x Blazing Meteor',
    multiplier: 15,
    description: '5 Meteors on an active payline',
  },
  {
    id: 'meteor_4',
    name: '4x Blazing Meteor',
    multiplier: 4,
    description: '4 Meteors from leftmost reel',
  },
  {
    id: 'meteor_3',
    name: '3x Blazing Meteor',
    multiplier: 2,
    description: '3 Meteors from leftmost reel',
  },
];

export const NOVA_VOYAGER_CONFIG: SlotsConfig = {
  reelsCount: 5,
  visibleRows: 3,
  stopsPerReel: [24, 24, 24, 24, 24],
  reelStrips: [
    NOVA_REEL_1_5_STRIP,
    NOVA_REEL_2_3_4_STRIP,
    NOVA_REEL_2_3_4_STRIP,
    NOVA_REEL_2_3_4_STRIP,
    NOVA_REEL_1_5_STRIP,
  ],
  paylines: NOVA_PAYLINES,
  paytable: NOVA_PAYTABLE,
  ruleSet: 'left-to-right-wild',
};
