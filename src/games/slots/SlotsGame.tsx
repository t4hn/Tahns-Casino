import React from 'react';
import { GameProps } from '../../types/casino';
import { DEFAULT_SLOTS_CONFIG } from './slotsConfig';
import { SlotMachine } from './SlotMachine';

/**
 * Lucky Slots Game (v1: classic 3-reel, single payline).
 * Wraps the generic SlotMachine engine with DEFAULT_SLOTS_CONFIG.
 */
export const SlotsGame: React.FC<GameProps> = (props) => {
  return <SlotMachine {...props} config={DEFAULT_SLOTS_CONFIG} />;
};
