export interface PlayerProfile {
  id: string;
  name: string;
  avatarUrl: string;
  level: number;
  xp: number;
  credits: number;
  title: string;
  gamesPlayed: number;
  totalWinnings: number;
  totalLosses: number;
  createdAt: number;
  dailyStreak: number;
  lastDailyClaim?: number;
}

export type GameCategory = 'Slots' | 'Cards' | 'Table' | 'Dice';

export interface GameItem {
  id: string;
  name: string;
  category: GameCategory;
  description: string;
  imageUrl: string;
  minLevel: number;
  isLocked: boolean;
  status: string;
  payoutRate: string;
  minBet: number;
  maxBet: number;
  volatility: 'Low' | 'Medium' | 'High' | 'VIP';
  featured?: boolean;
}

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
  type: 'daily_bonus' | 'level_up' | 'achievement' | 'game_played' | 'game_preview' | 'system';
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
