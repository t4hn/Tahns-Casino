import { GameCategory } from '../types/casino';

export interface CasinoGameMetadata {
  id: string;
  name: string;
  category: GameCategory;
  description: string;
  imageUrl: string;
  minBet: number;
  maxBet: number;
  payoutRate: string;
  volatility: 'Low' | 'Medium' | 'High' | 'VIP';
  featured?: boolean;
}

export type CasinoGamePlugin = CasinoGameMetadata;

export interface GameFloorItem extends CasinoGameMetadata {
  status: 'Table Open' | 'Coming Soon' | string;
  hasPlayableModule?: boolean;
}
