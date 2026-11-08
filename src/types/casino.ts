import React from 'react';
import { WalletProfile, SettleResult } from '../economy/wallet';
import { GameFloorItem } from '../games/types';

export type RoundResult = SettleResult;

export interface GameProps {
  balance: number;
  minBet: number;
  maxBet: number;
  settle: (bet: number, payout: number) => RoundResult;
  placeBet: (bet: number) => { success: boolean; error?: string };
  resolveRound: (bet: number, payout: number) => RoundResult;
  animations: boolean;
}

export interface GameModule {
  id: string;
  component: React.FC<GameProps>;
}

export type GameCategory = 'Slots' | 'Cards' | 'Table' | 'Dice';

/**
 * Derived player profile for UI presentation:
 * Level and Title are derived purely from XP.
 */
export interface PlayerProfile extends WalletProfile {
  level: number;
  title: string;
}

export type GameItem = GameFloorItem;

export interface Achievement {
  id: string;
  title: string;
  description: string;
  rewardCredits: number;
  rewardXp: number;
  progress: number;
  maxProgress: number;
  unlocked: boolean;
  claimed: boolean;
  iconName: string;
}

export interface ActivityItem {
  id: string;
  type:
    | 'daily_bonus'
    | 'level_up'
    | 'achievement'
    | 'wager_placed'
    | 'wager_won'
    | 'wager_lost'
    | 'game_played'
    | 'game_preview'
    | 'system';
  title: string;
  description: string;
  timestamp: number;
  creditsDelta?: number;
  xpDelta?: number;
}

export interface CasinoSettings {
  soundEffects: boolean;
  music: boolean;
  compactView: boolean;
  currencyNotation: 'standard' | 'abbreviated';
  animations: boolean;
}

export type NavTab = 'home' | 'games' | 'achievements' | 'settings';
