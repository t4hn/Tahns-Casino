import { GameModule } from '../types/casino';
import { CasinoGameMetadata, GameFloorItem } from './types';
import { calculateRtp } from './dice/diceRules';
import { DiceGame } from './dice/DiceGame';
import { calculateRtp as calculateSlotsRtp } from './slots/slotsRules';
import { DEFAULT_SLOTS_CONFIG } from './slots/slotsConfig';
import { SlotsGame } from './slots/SlotsGame';

const DICE_RTP_RANGE = `${(calculateRtp('low') * 100).toFixed(1)}% - ${(calculateRtp('seven') * 100).toFixed(1)}%`;
const SLOTS_RTP = `${(calculateSlotsRtp(DEFAULT_SLOTS_CONFIG) * 100).toFixed(1)}%`;

export const DEFAULT_GAMES: CasinoGameMetadata[] = [
  {
    id: 'lucky-slots',
    name: 'Lucky Slots',
    category: 'Slots',
    description: 'Emerald 3-reel luxury slot featuring classic lucky sevens, golden cherries, and progressive line multipliers.',
    imageUrl: '/images/game_lucky_slots_1793671235711.jpg',
    minLevel: 1,
    minBet: 10,
    maxBet: 500,
    payoutRate: SLOTS_RTP,
    volatility: 'Medium',
    featured: true,
  },
  {
    id: 'blackjack',
    name: 'Blackjack',
    category: 'Cards',
    description: 'Premier single-deck table. Dealer stands on all 17s; blackjack awards 3 to 2 with insurance options.',
    imageUrl: '/images/game_blackjack_1793671236023.jpg',
    minLevel: 1,
    minBet: 25,
    maxBet: 1000,
    payoutRate: '99.5%',
    volatility: 'Low',
  },
  {
    id: 'roulette',
    name: 'Roulette',
    category: 'Table',
    description: 'Single zero European wheel with ivory ball, inside straight-up bets, split options, and outside dozens.',
    imageUrl: '/images/game_roulette_1793671260984.jpg',
    minLevel: 1,
    minBet: 10,
    maxBet: 1500,
    payoutRate: '97.3%',
    volatility: 'Medium',
  },
  {
    id: 'dice',
    name: 'Dice',
    category: 'Dice',
    description: 'Polished translucent emerald dice duel. Wager on Hi-Lo totals, natural 7s, or roll exact doubles.',
    imageUrl: '/images/game_dice_1793671261314.jpg',
    minLevel: 1,
    minBet: 10,
    maxBet: 800,
    payoutRate: DICE_RTP_RANGE,
    volatility: 'Medium',
  },
  {
    id: 'baccarat-vip',
    name: 'High-Roller Baccarat',
    category: 'Cards',
    description: 'Private salon Punto Banco. Bet on Player, Banker, or Tie with high table limits and VIP rewards.',
    imageUrl: '/images/casino_featured_game_1793671235087.jpg',
    minLevel: 4,
    minBet: 100,
    maxBet: 5000,
    payoutRate: '98.9%',
    volatility: 'High',
  },
  {
    id: 'video-poker',
    name: 'Video Poker Deluxe',
    category: 'Cards',
    description: 'Jacks or Better 9/6 full paytable with instant draw decisions and royal flush bonus multipliers.',
    imageUrl: '/images/game_blackjack_1793671236023.jpg',
    minLevel: 3,
    minBet: 20,
    maxBet: 1000,
    payoutRate: '99.2%',
    volatility: 'Medium',
  },
];

/**
 * Module registry mapping game IDs to interactive GameModule plug-ins.
 * Games plug in by implementing the GameProps interface and registering here.
 */
class GameRegistry {
  private gamesCatalog: Map<string, CasinoGameMetadata> = new Map();
  private modules: Map<string, GameModule> = new Map();

  constructor(initialGames: CasinoGameMetadata[] = DEFAULT_GAMES) {
    initialGames.forEach((g) => this.gamesCatalog.set(g.id, g));
  }

  public registerModule(module: GameModule): void {
    this.modules.set(module.id, module);
  }

  public getModule(id: string): GameModule | undefined {
    return this.modules.get(id);
  }

  public hasModule(id: string): boolean {
    return this.modules.has(id);
  }

  public getGame(id: string): CasinoGameMetadata | undefined {
    return this.gamesCatalog.get(id);
  }

  public getAllGames(): CasinoGameMetadata[] {
    return Array.from(this.gamesCatalog.values());
  }

  /**
   * Pure derivation of floor games based on current player level.
   * Lock state & status are derived purely from level.
   */
  public deriveFloorGames(playerLevel: number): GameFloorItem[] {
    return this.getAllGames().map((game) => {
      const isLocked = playerLevel < game.minLevel;
      return {
        ...game,
        isLocked,
        status: isLocked ? `Requires Level ${game.minLevel}` : 'Table Open',
      };
    });
  }
}

export const gameRegistry = new GameRegistry();
 
export function registerGameModule(module: GameModule): void {
  gameRegistry.registerModule(module);
}

export function getGameModule(id: string): GameModule | undefined {
  return gameRegistry.getModule(id);
}

// Register interactive casino game modules
registerGameModule({
  id: 'dice',
  component: DiceGame,
});

registerGameModule({
  id: 'lucky-slots',
  component: SlotsGame,
});

