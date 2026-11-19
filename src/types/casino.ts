import React from 'react';
import { WalletProfile, SettleResult } from '../economy/wallet';
import { GameFloorItem } from '../games/types';

export type RoundResult = SettleResult;

export type PokerCategory =
  | 'royal_flush'
  | 'straight_flush'
  | 'four_of_a_kind'
  | 'full_house'
  | 'flush'
  | 'straight'
  | 'three_of_a_kind'
  | 'two_pair'
  | 'jacks_or_better'
  | 'none';

export interface RoundAchievementFacts {
  blackjackNatural?: boolean;
  blackjackDoubledWin?: boolean;
  videoPokerCategory?: PokerCategory;
  rouletteWonStraightUp?: boolean;
  rouletteRedBlackWins?: number;
  kenoSpots?: number;
  kenoHits?: number;
}

export interface PendingRoundMeta {
  roundId?: string;
  detail?: string;
  facts?: RoundAchievementFacts;
  rouletteResult?: {
    roundId: string;
    number: number;
    color: 'green' | 'red' | 'black';
    timestamp: number;
    totalWager: number;
    grossPayout: number;
    net: number;
  };
  kenoResult?: {
    roundId: string;
    timestamp: number;
    selectedNumbers: number[];
    drawnNumbers: number[];
    matchedNumbers: number[];
    spotCount: number;
    hits: number;
    multiplier: number;
    wager: number;
    grossPayout: number;
    net: number;
  };
}

export interface GameProps {
  balance: number;
  minBet: number;
  maxBet: number;
  settle: (bet: number, payout: number, meta?: PendingRoundMeta) => RoundResult;
  placeBet: (
    bet: number,
    payout?: number,
    meta?: PendingRoundMeta
  ) => { success: boolean; error?: string };
  resolveRound: (bet: number, payout: number, meta?: PendingRoundMeta) => RoundResult;
  updatePendingRound?: (bet: number, payout?: number, meta?: PendingRoundMeta) => void;
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

export type NavTab = 'home' | 'games' | 'profile' | 'achievements' | 'settings';
