import { Achievement, ActivityItem, CasinoSettings } from '../types/casino';
import { WalletProfile } from '../economy/wallet';
import { gameRegistry } from '../games/registry';

export const DEFAULT_CHARACTER_NAME = 'Tahn';
export const STARTING_CREDITS = 1000;
export const STARTING_LEVEL = 1;
export const STARTING_XP = 0;

export const AVATAR_OPTIONS = [
  { id: 'avatar_1', label: 'Tuxedo Patron', url: '/images/character_avatar_1793671261002.jpg' },
  { id: 'avatar_2', label: 'Emerald VIP', url: '/images/casino_featured_game_1793671235087.jpg' },
  { id: 'avatar_3', label: 'Card Master', url: '/images/game_blackjack_1793671236023.jpg' },
  { id: 'avatar_4', label: 'Dice Baron', url: '/images/game_dice_1793671261314.jpg' },
];

export const INITIAL_PROFILE: WalletProfile = {
  id: 'patron_tahn_v2',
  name: DEFAULT_CHARACTER_NAME,
  avatarUrl: AVATAR_OPTIONS[0].url,
  xp: STARTING_XP,
  credits: STARTING_CREDITS,
  gamesPlayed: 0,
  totalWinnings: 0,
  totalLosses: 0,
  createdAt: Date.now(),
  dailyStreak: 0,
  lastDailyClaim: undefined,
};

export const INITIAL_SETTINGS: CasinoSettings = {
  soundEffects: true,
  music: false,
  compactView: false,
  currencyNotation: 'standard',
  animations: true,
};

export const INITIAL_GAMES = gameRegistry.deriveFloorGames(STARTING_LEVEL);

export const INITIAL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_steps',
    title: 'First Steps',
    description: 'Create your patron identity and register at Tahn\'s Casino',
    rewardCredits: 250,
    rewardXp: 50,
    progress: 1,
    maxProgress: 1,
    unlocked: true,
    claimed: false,
    iconName: 'Award',
  },
  {
    id: 'first_wager',
    title: 'Place Your Bet',
    description: 'Play your first round at any casino table or machine',
    rewardCredits: 500,
    rewardXp: 100,
    progress: 0,
    maxProgress: 1,
    unlocked: false,
    claimed: false,
    iconName: 'Coins',
  },
  {
    id: 'daily_patron',
    title: 'Dedicated Patron',
    description: 'Claim the Daily Bonus virtual credit allowance 3 times',
    rewardCredits: 1500,
    rewardXp: 250,
    progress: 0,
    maxProgress: 3,
    unlocked: false,
    claimed: false,
    iconName: 'CalendarCheck',
  },
  {
    id: 'level_two',
    title: 'Rising Star',
    description: 'Attain Player Progression Level 2',
    rewardCredits: 1000,
    rewardXp: 200,
    progress: 0,
    maxProgress: 500,
    unlocked: false,
    claimed: false,
    iconName: 'Zap',
  },
  {
    id: 'floor_tour',
    title: 'Floor Explorer',
    description: 'Explore the casino floor by inspecting all 4 premier table games',
    rewardCredits: 1000,
    rewardXp: 150,
    progress: 0,
    maxProgress: 4,
    unlocked: false,
    claimed: false,
    iconName: 'Compass',
  },
  {
    id: 'high_roller',
    title: 'High Roller',
    description: 'Accumulate a balance of 5,000 virtual credits',
    rewardCredits: 2500,
    rewardXp: 400,
    progress: 1000,
    maxProgress: 5000,
    unlocked: false,
    claimed: false,
    iconName: 'Crown',
  },
];

export const INITIAL_ACTIVITIES: ActivityItem[] = [
  {
    id: 'act_init',
    type: 'system',
    title: 'Patron Membership Activated',
    description: 'Welcome to Tahn\'s Casino. 1,000 complimentary credits issued.',
    timestamp: Date.now(),
    creditsDelta: 1000,
  },
];
