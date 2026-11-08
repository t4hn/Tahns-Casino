import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  PlayerProfile,
  GameItem,
  Achievement,
  ActivityItem,
  CasinoSettings,
  NavTab,
} from '../types/casino';
import {
  WalletProfile,
  LevelInfo,
  calculateLevelInfo,
  settleRound,
  placeBet as placeBetPure,
  resolveRound as resolveRoundPure,
  applyDailyBonus,
  applyAchievementReward,
  SettleResult,
} from '../economy/wallet';
import {
  STARTING_CREDITS,
  STARTING_XP,
  INITIAL_ACHIEVEMENTS,
  INITIAL_ACTIVITIES,
  INITIAL_SETTINGS,
} from '../data/initialData';
import { gameRegistry } from '../games/registry';
import { soundManager } from '../utils/sound';

const STORAGE_KEY = 'tahns_casino_v2';
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

// ── State Definition ──
interface CasinoState {
  profile: WalletProfile | null;
  achievements: Achievement[];
  activities: ActivityItem[];
  settings: CasinoSettings;
  currentTab: NavTab;
  activeGameId: string | null;
  visitedGameIds: string[];
  isDailyBonusModalOpen: boolean;
}

// ── Action Definitions ──
type CasinoAction =
  | { type: 'CREATE_CHARACTER'; payload: { name: string; avatarUrl: string } }
  | { type: 'UPDATE_PROFILE'; payload: { name: string; avatarUrl: string } }
  | { type: 'PLACE_BET'; payload: { updatedProfile: WalletProfile } }
  | { type: 'RESOLVE_ROUND'; payload: { updatedProfile: WalletProfile } }
  | { type: 'SETTLE_ROUND'; payload: { updatedProfile: WalletProfile } }
  | { type: 'CLAIM_DAILY_BONUS'; payload: { updatedProfile: WalletProfile } }
  | { type: 'FAST_FORWARD_DAILY_BONUS' }
  | { type: 'CLAIM_ACHIEVEMENT'; payload: { achievementId: string; updatedProfile: WalletProfile } }
  | { type: 'UPDATE_ACHIEVEMENT_PROGRESS'; payload: { achievementId: string; value: number; isAbsolute?: boolean } }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<CasinoSettings> }
  | { type: 'SET_TAB'; payload: NavTab }
  | { type: 'OPEN_GAME'; payload: string }
  | { type: 'EXIT_GAME' }
  | { type: 'SET_DAILY_BONUS_MODAL'; payload: boolean }
  | { type: 'RECORD_ACTIVITY'; payload: ActivityItem }
  | { type: 'RESET_PROGRESS' };

// ── Pure Reducer ──
function casinoReducer(state: CasinoState, action: CasinoAction): CasinoState {
  switch (action.type) {
    case 'CREATE_CHARACTER': {
      const cleanName = action.payload.name.trim() || 'Tahn';
      const newProfile: WalletProfile = {
        id: `patron_${Date.now()}`,
        name: cleanName,
        avatarUrl: action.payload.avatarUrl,
        xp: STARTING_XP,
        credits: STARTING_CREDITS,
        gamesPlayed: 0,
        totalWinnings: 0,
        totalLosses: 0,
        createdAt: Date.now(),
        dailyStreak: 0,
        lastDailyClaim: undefined,
      };
      return {
        ...state,
        profile: newProfile,
        currentTab: 'home',
        activeGameId: null,
      };
    }

    case 'UPDATE_PROFILE': {
      if (!state.profile) return state;
      return {
        ...state,
        profile: {
          ...state.profile,
          name: action.payload.name.trim() || 'Tahn',
          avatarUrl: action.payload.avatarUrl,
        },
      };
    }

    case 'PLACE_BET': {
      return {
        ...state,
        profile: action.payload.updatedProfile,
      };
    }

    case 'RESOLVE_ROUND': {
      return {
        ...state,
        profile: action.payload.updatedProfile,
      };
    }

    case 'SETTLE_ROUND': {
      return {
        ...state,
        profile: action.payload.updatedProfile,
      };
    }

    case 'CLAIM_DAILY_BONUS': {
      return {
        ...state,
        profile: action.payload.updatedProfile,
      };
    }

    case 'FAST_FORWARD_DAILY_BONUS': {
      if (!state.profile) return state;
      return {
        ...state,
        profile: {
          ...state.profile,
          lastDailyClaim: Date.now() - 25 * 60 * 60 * 1000,
        },
      };
    }

    case 'CLAIM_ACHIEVEMENT': {
      return {
        ...state,
        profile: action.payload.updatedProfile,
        achievements: state.achievements.map((ach) =>
          ach.id === action.payload.achievementId ? { ...ach, claimed: true } : ach
        ),
      };
    }

    case 'UPDATE_ACHIEVEMENT_PROGRESS': {
      return {
        ...state,
        achievements: state.achievements.map((ach) => {
          if (ach.id !== action.payload.achievementId) return ach;
          const newProgress = action.payload.isAbsolute
            ? Math.min(ach.maxProgress, action.payload.value)
            : Math.min(ach.maxProgress, ach.progress + action.payload.value);
          const unlocked = newProgress >= ach.maxProgress;
          return {
            ...ach,
            progress: newProgress,
            unlocked: ach.unlocked || unlocked,
          };
        }),
      };
    }

    case 'UPDATE_SETTINGS': {
      return {
        ...state,
        settings: {
          ...state.settings,
          ...action.payload,
        },
      };
    }

    case 'SET_TAB': {
      return {
        ...state,
        currentTab: action.payload,
        activeGameId: null,
      };
    }

    case 'OPEN_GAME': {
      const nextVisited = state.visitedGameIds.includes(action.payload)
        ? state.visitedGameIds
        : [...state.visitedGameIds, action.payload];
      return {
        ...state,
        activeGameId: action.payload,
        visitedGameIds: nextVisited,
      };
    }

    case 'EXIT_GAME': {
      return {
        ...state,
        activeGameId: null,
      };
    }

    case 'SET_DAILY_BONUS_MODAL': {
      return {
        ...state,
        isDailyBonusModalOpen: action.payload,
      };
    }

    case 'RECORD_ACTIVITY': {
      return {
        ...state,
        activities: [action.payload, ...state.activities.slice(0, 19)],
      };
    }

    case 'RESET_PROGRESS': {
      return {
        profile: null,
        achievements: INITIAL_ACHIEVEMENTS,
        activities: INITIAL_ACTIVITIES,
        settings: INITIAL_SETTINGS,
        currentTab: 'home',
        activeGameId: null,
        visitedGameIds: [],
        isDailyBonusModalOpen: false,
      };
    }

    default:
      return state;
  }
}

export interface PendingRound {
  gameId: string;
  gameName: string;
  bet: number;
  payout?: number;
  timestamp: number;
}

export function updateAchievementProgressPure(
  achievements: Achievement[],
  achievementId: string,
  value: number,
  isAbsolute?: boolean
): Achievement[] {
  return achievements.map((ach) => {
    if (ach.id !== achievementId) return ach;
    const newProgress = isAbsolute
      ? Math.min(ach.maxProgress, value)
      : Math.min(ach.maxProgress, ach.progress + value);
    const unlocked = newProgress >= ach.maxProgress;
    return {
      ...ach,
      progress: newProgress,
      unlocked: ach.unlocked || unlocked,
    };
  });
}

export interface RecoveryOutcome {
  profile: WalletProfile;
  achievements: Achievement[];
  activities: ActivityItem[];
  recovered: boolean;
  result?: SettleResult;
}

export function recoverInterruptedRound(
  profile: WalletProfile,
  achievements: Achievement[],
  activities: ActivityItem[],
  pending: PendingRound
): RecoveryOutcome {
  const recoveryPayout = typeof pending.payout === 'number' ? pending.payout : 0;
  const { profile: updatedProfile, result } = resolveRoundPure(
    profile,
    pending.bet,
    recoveryPayout
  );

  const recoveryActivity: ActivityItem = {
    id: `act_${pending.timestamp || Date.now()}_recovery`,
    type: result.won ? 'wager_won' : result.net === 0 ? 'game_played' : 'wager_lost',
    title: 'Interrupted round recovered',
    description: `Interrupted round on ${pending.gameName || 'game'} recovered. ${
      result.won
        ? `+${result.net.toLocaleString()} Credits awarded.`
        : 'Round completed as settled.'
    }`,
    timestamp: Date.now(),
    creditsDelta: result.net,
    xpDelta: result.xpGained,
  };

  let updatedActivities = [recoveryActivity, ...activities.slice(0, 19)];

  if (result.leveledUp && result.newLevel) {
    const promotionCredits = result.promotionCredits || 500 * result.newLevel;
    const levelActivity: ActivityItem = {
      id: `act_${Date.now()}_lvl`,
      type: 'level_up',
      title: `Promoted to Level ${result.newLevel}`,
      description: `Promotion bonus credited: +${promotionCredits.toLocaleString()} Credits`,
      timestamp: Date.now() + 1,
      creditsDelta: promotionCredits,
    };
    updatedActivities = [levelActivity, ...updatedActivities.slice(0, 19)];
  }

  // Update achievements exactly like a normally resolved round
  let updatedAchievements = updateAchievementProgressPure(
    achievements,
    'first_wager',
    1,
    true
  );
  updatedAchievements = updateAchievementProgressPure(
    updatedAchievements,
    'high_roller',
    updatedProfile.credits,
    true
  );
  updatedAchievements = updateAchievementProgressPure(
    updatedAchievements,
    'level_two',
    updatedProfile.xp,
    true
  );

  return {
    profile: updatedProfile,
    achievements: updatedAchievements,
    activities: updatedActivities,
    recovered: true,
    result,
  };
}

// ── Initial State Loader (Pure from storage inputs, without side-effects) ──
function loadInitialState(): CasinoState {
  let profile: WalletProfile | null = null;
  let achievements: Achievement[] = INITIAL_ACHIEVEMENTS;
  let activities: ActivityItem[] = INITIAL_ACTIVITIES;
  let settings: CasinoSettings = INITIAL_SETTINGS;

  try {
    const savedProfile = localStorage.getItem(`${STORAGE_KEY}_profile`);
    if (savedProfile) {
      const parsed = JSON.parse(savedProfile);
      // Ensure level and title are never stored in the profile
      const { level, title, ...cleanWalletProfile } = parsed;
      profile = cleanWalletProfile as WalletProfile;
    }
  } catch {
    // ignore
  }

  try {
    const savedAchievements = localStorage.getItem(`${STORAGE_KEY}_achievements`);
    if (savedAchievements) {
      achievements = JSON.parse(savedAchievements);
    }
  } catch {
    // ignore
  }

  try {
    const savedActivities = localStorage.getItem(`${STORAGE_KEY}_activities`);
    if (savedActivities) {
      activities = JSON.parse(savedActivities);
    }
  } catch {
    // ignore
  }

  try {
    const savedSettings = localStorage.getItem(`${STORAGE_KEY}_settings`);
    if (savedSettings) {
      settings = JSON.parse(savedSettings);
    }
  } catch {
    // ignore
  }

  let visitedGameIds: string[] = [];
  try {
    const savedVisited = localStorage.getItem(`${STORAGE_KEY}_visited_games`);
    if (savedVisited) {
      visitedGameIds = JSON.parse(savedVisited);
    }
  } catch {
    // ignore
  }

  // Recover any interrupted round-in-progress purely without state-initializer side-effects
  try {
    const savedPending = localStorage.getItem(`${STORAGE_KEY}_pending_round`);
    if (savedPending && profile) {
      const pending = JSON.parse(savedPending) as PendingRound;
      const recovery = recoverInterruptedRound(profile, achievements, activities, pending);
      profile = recovery.profile;
      achievements = recovery.achievements;
      activities = recovery.activities;
    }
  } catch {
    // ignore
  }

  return {
    profile,
    achievements,
    activities,
    settings,
    currentTab: 'home',
    activeGameId: null,
    visitedGameIds,
    isDailyBonusModalOpen: false,
  };
}

// ── Context Interface ──
interface CasinoContextType {
  profile: PlayerProfile | null;
  games: GameItem[];
  achievements: Achievement[];
  activities: ActivityItem[];
  settings: CasinoSettings;
  currentTab: NavTab;
  activeGame: GameItem | null;
  levelInfo: LevelInfo;
  isDailyBonusAvailable: boolean;
  isDailyBonusModalOpen: boolean;
  createCharacter: (name: string, avatarUrl: string) => void;
  setCurrentTab: (tab: NavTab) => void;
  openGame: (game: GameItem) => void;
  exitGame: () => void;
  openDailyBonusModal: () => void;
  closeDailyBonusModal: () => void;
  claimDailyBonus: () => boolean;
  fastForwardDailyBonus: () => void;
  claimAchievement: (achievementId: string) => void;
  updateSettings: (newSettings: Partial<CasinoSettings>) => void;
  updateProfile: (name: string, avatarUrl: string) => void;
  resetProgress: () => void;
  recordActivity: (item: Omit<ActivityItem, 'id' | 'timestamp'>) => void;
  placeBet: (
    gameId: string,
    gameName: string,
    bet: number,
    payout?: number
  ) => { success: boolean; error?: string };
  resolveRound: (
    gameId: string,
    gameName: string,
    bet: number,
    payout: number,
    customXp?: number
  ) => SettleResult;
  executeRound: (
    gameId: string,
    gameName: string,
    bet: number,
    payout: number,
    customXp?: number
  ) => SettleResult;
}

const CasinoContext = createContext<CasinoContextType | undefined>(undefined);

export const CasinoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(casinoReducer, undefined, loadInitialState);

  // Profile ref updated on every render to ensure latest state is read without stale closures
  const profileRef = useRef<WalletProfile | null>(state.profile);
  profileRef.current = state.profile;

  // Sync sound settings with soundManager
  useEffect(() => {
    soundManager.setEnabled(state.settings.soundEffects);
  }, [state.settings.soundEffects]);

  // One-time cleanup effect on mount: ensure pending round is cleared from storage once loaded
  useEffect(() => {
    try {
      localStorage.removeItem(`${STORAGE_KEY}_pending_round`);
    } catch {
      // ignore
    }
  }, []);

  // Persistence effects: profile is persisted without derived level or title
  useEffect(() => {
    try {
      if (state.profile) {
        const {
          id,
          name,
          avatarUrl,
          xp,
          credits,
          gamesPlayed,
          totalWinnings,
          totalLosses,
          createdAt,
          dailyStreak,
          lastDailyClaim,
        } = state.profile;
        const pureProfile: WalletProfile = {
          id,
          name,
          avatarUrl,
          xp,
          credits,
          gamesPlayed,
          totalWinnings,
          totalLosses,
          createdAt,
          dailyStreak,
          lastDailyClaim,
        };
        localStorage.setItem(`${STORAGE_KEY}_profile`, JSON.stringify(pureProfile));
      } else {
        localStorage.removeItem(`${STORAGE_KEY}_profile`);
      }
    } catch (e) {
      console.warn('Storage failed for profile', e);
    }
  }, [state.profile]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_achievements`, JSON.stringify(state.achievements));
    } catch (e) {
      console.warn('Storage failed for achievements', e);
    }
  }, [state.achievements]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_activities`, JSON.stringify(state.activities));
    } catch (e) {
      console.warn('Storage failed for activities', e);
    }
  }, [state.activities]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_settings`, JSON.stringify(state.settings));
    } catch (e) {
      console.warn('Storage failed for settings', e);
    }
  }, [state.settings]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_visited_games`, JSON.stringify(state.visitedGameIds));
    } catch (e) {
      console.warn('Storage failed for visited games', e);
    }
  }, [state.visitedGameIds]);

  // ── Derived Level & Title ──
  const levelInfo = useMemo(() => {
    return calculateLevelInfo(state.profile?.xp || 0);
  }, [state.profile?.xp]);

  // ── Derived Profile with Level & Title ──
  const derivedProfile: PlayerProfile | null = useMemo(() => {
    if (!state.profile) return null;
    return {
      ...state.profile,
      level: levelInfo.level,
      title: levelInfo.title,
    };
  }, [state.profile, levelInfo]);

  // ── Derived Games List from Registry ──
  // Note: Games are NEVER stored stale in localStorage!
  const derivedGames: GameItem[] = useMemo(() => {
    return gameRegistry.deriveFloorGames();
  }, []);

  // ── Derived Active Game ──
  const activeGame: GameItem | null = useMemo(() => {
    if (!state.activeGameId) return null;
    return derivedGames.find((g) => g.id === state.activeGameId) || null;
  }, [state.activeGameId, derivedGames]);

  // ── Derived Daily Bonus Availability (NO 1-second interval re-render in context!) ──
  const isDailyBonusAvailable = useMemo(() => {
    if (!state.profile || !state.profile.lastDailyClaim) return true;
    return Date.now() - state.profile.lastDailyClaim >= COOLDOWN_MS;
  }, [state.profile?.lastDailyClaim]);

  // ── Action Handlers (All side effects, sounds, logs, and achievement updates live here) ──

  const recordActivity = useCallback((item: Omit<ActivityItem, 'id' | 'timestamp'>) => {
    const activity: ActivityItem = {
      ...item,
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
    };
    dispatch({ type: 'RECORD_ACTIVITY', payload: activity });
  }, []);

  const createCharacter = useCallback((name: string, avatarUrl: string) => {
    const cleanName = name.trim() || 'Tahn';
    dispatch({ type: 'CREATE_CHARACTER', payload: { name: cleanName, avatarUrl } });

    soundManager.playBonusClaim();

    const activity: ActivityItem = {
      id: `act_${Date.now()}`,
      type: 'system',
      title: 'Patron Membership Activated',
      description: `Welcome to Tahn's Casino, ${cleanName}. ${STARTING_CREDITS.toLocaleString()} starting credits loaded.`,
      timestamp: Date.now(),
      creditsDelta: STARTING_CREDITS,
    };
    dispatch({ type: 'RECORD_ACTIVITY', payload: activity });
  }, []);

  const updateProfile = useCallback((name: string, avatarUrl: string) => {
    soundManager.playClick();
    const cleanName = name.trim() || 'Tahn';
    dispatch({ type: 'UPDATE_PROFILE', payload: { name: cleanName, avatarUrl } });

    const activity: ActivityItem = {
      id: `act_${Date.now()}`,
      type: 'system',
      title: 'Patron Profile Updated',
      description: `Patron identity updated to ${cleanName}`,
      timestamp: Date.now(),
    };
    dispatch({ type: 'RECORD_ACTIVITY', payload: activity });
  }, []);

  const placeBet = useCallback(
    (
      gameId: string,
      gameName: string,
      bet: number,
      payout?: number
    ): { success: boolean; error?: string } => {
      const currentProfile = profileRef.current;
      if (!currentProfile) {
        return { success: false, error: 'No active patron profile.' };
      }

      const betRes = placeBetPure(currentProfile, bet);
      if (!betRes.success) {
        soundManager.playLocked();
        return { success: false, error: betRes.error };
      }

      profileRef.current = betRes.profile;

      // Persist pending round and latest profile to localStorage immediately
      try {
        const pending = {
          gameId,
          gameName,
          bet,
          payout,
          timestamp: Date.now(),
        };
        localStorage.setItem(`${STORAGE_KEY}_pending_round`, JSON.stringify(pending));
        localStorage.setItem(`${STORAGE_KEY}_profile`, JSON.stringify(betRes.profile));
      } catch (e) {
        console.warn('Storage failed for pending round', e);
      }

      dispatch({ type: 'PLACE_BET', payload: { updatedProfile: betRes.profile } });

      return { success: true };
    },
    []
  );

  const resolveRound = useCallback(
    (
      gameId: string,
      gameName: string,
      bet: number,
      payout: number,
      customXp?: number
    ): SettleResult => {
      // Clear pending round from localStorage immediately upon resolution
      try {
        localStorage.removeItem(`${STORAGE_KEY}_pending_round`);
      } catch (e) {
        console.warn('Storage cleanup failed for pending round', e);
      }

      const currentProfile = profileRef.current;
      if (!currentProfile) {
        return {
          success: false,
          won: false,
          net: 0,
          bet,
          payout: 0,
          xpGained: 0,
          leveledUp: false,
          error: 'No active patron profile.',
        };
      }

      const { profile: updatedProfile, result } = resolveRoundPure(
        currentProfile,
        bet,
        payout,
        customXp
      );

      profileRef.current = updatedProfile;
      dispatch({ type: 'RESOLVE_ROUND', payload: { updatedProfile } });

      // Side effects: Sounds
      if (result.leveledUp) {
        soundManager.playLevelUp();
      } else if (result.won) {
        soundManager.playCoin();
      } else {
        soundManager.playClick();
      }

      // Side effects: Activity logging with ACCURATE types
      const activityType: ActivityItem['type'] = result.won
        ? 'wager_won'
        : result.net === 0
        ? 'game_played'
        : 'wager_lost';

      const activityTitle = result.won
        ? `Won on ${gameName}`
        : result.net === 0
        ? `Push on ${gameName}`
        : `Played ${gameName}`;

      const activityDesc = result.won
        ? `Won +${result.net.toLocaleString()} Credits on a ${bet} Credit bet (+${result.xpGained} XP)`
        : `Wagered ${bet} Credits (+${result.xpGained} XP)`;

      const mainActivity: ActivityItem = {
        id: `act_${Date.now()}_round`,
        type: activityType,
        title: activityTitle,
        description: activityDesc,
        timestamp: Date.now(),
        creditsDelta: result.net,
        xpDelta: result.xpGained,
      };
      dispatch({ type: 'RECORD_ACTIVITY', payload: mainActivity });

      if (result.leveledUp && result.newLevel) {
        const promotionCredits = result.promotionCredits || 500 * result.newLevel;
        const levelActivity: ActivityItem = {
          id: `act_${Date.now()}_lvl`,
          type: 'level_up',
          title: `Promoted to Level ${result.newLevel}`,
          description: `Promotion bonus credited: +${promotionCredits.toLocaleString()} Credits`,
          timestamp: Date.now() + 1,
          creditsDelta: promotionCredits,
        };
        dispatch({ type: 'RECORD_ACTIVITY', payload: levelActivity });
      }

      // Milestone progress
      dispatch({
        type: 'UPDATE_ACHIEVEMENT_PROGRESS',
        payload: { achievementId: 'first_wager', value: 1, isAbsolute: true },
      });
      dispatch({
        type: 'UPDATE_ACHIEVEMENT_PROGRESS',
        payload: { achievementId: 'high_roller', value: updatedProfile.credits, isAbsolute: true },
      });
      dispatch({
        type: 'UPDATE_ACHIEVEMENT_PROGRESS',
        payload: { achievementId: 'level_two', value: updatedProfile.xp, isAbsolute: true },
      });

      return result;
    },
    []
  );

  const executeRound = useCallback(
    (
      gameId: string,
      gameName: string,
      bet: number,
      payout: number,
      customXp?: number
    ): SettleResult => {
      const betRes = placeBet(gameId, gameName, bet, payout);
      if (!betRes.success) {
        return {
          success: false,
          won: false,
          net: 0,
          bet,
          payout: 0,
          xpGained: 0,
          leveledUp: false,
          error: betRes.error,
        };
      }
      return resolveRound(gameId, gameName, bet, payout, customXp);
    },
    [placeBet, resolveRound]
  );

  const claimDailyBonus = useCallback((): boolean => {
    const currentProfile = profileRef.current;
    if (!currentProfile || !isDailyBonusAvailable) {
      soundManager.playLocked();
      return false;
    }

    const { profile: updatedProfile, creditsAwarded, xpAwarded, leveledUp, newLevel } = applyDailyBonus(
      currentProfile
    );

    profileRef.current = updatedProfile;
    dispatch({ type: 'CLAIM_DAILY_BONUS', payload: { updatedProfile } });

    soundManager.playBonusClaim();
    if (leveledUp) {
      soundManager.playLevelUp();
    }

    const activity: ActivityItem = {
      id: `act_${Date.now()}_bonus`,
      type: 'daily_bonus',
      title: 'Daily Allowance Claimed',
      description: `Complimentary daily allowance: +${creditsAwarded.toLocaleString()} Credits & +${xpAwarded} XP`,
      timestamp: Date.now(),
      creditsDelta: creditsAwarded,
      xpDelta: xpAwarded,
    };
    dispatch({ type: 'RECORD_ACTIVITY', payload: activity });

    dispatch({
      type: 'UPDATE_ACHIEVEMENT_PROGRESS',
      payload: { achievementId: 'daily_patron', value: 1, isAbsolute: false },
    });
    dispatch({
      type: 'UPDATE_ACHIEVEMENT_PROGRESS',
      payload: { achievementId: 'high_roller', value: updatedProfile.credits, isAbsolute: true },
    });

    return true;
  }, [isDailyBonusAvailable]);

  const fastForwardDailyBonus = useCallback(() => {
    dispatch({ type: 'FAST_FORWARD_DAILY_BONUS' });
    soundManager.playCoin();
  }, []);

  const claimAchievement = useCallback(
    (achievementId: string) => {
      const currentProfile = profileRef.current;
      const ach = state.achievements.find((a) => a.id === achievementId);
      if (!ach || !ach.unlocked || ach.claimed || !currentProfile) {
        soundManager.playLocked();
        return;
      }

      const { profile: updatedProfile, leveledUp } = applyAchievementReward(
        currentProfile,
        ach.rewardCredits,
        ach.rewardXp
      );

      profileRef.current = updatedProfile;
      dispatch({ type: 'CLAIM_ACHIEVEMENT', payload: { achievementId, updatedProfile } });

      soundManager.playCoin();
      if (leveledUp) {
        soundManager.playLevelUp();
      }

      const activity: ActivityItem = {
        id: `act_${Date.now()}_ach`,
        type: 'achievement',
        title: 'Honors Reward Claimed',
        description: `Completed "${ach.title}" — +${ach.rewardCredits.toLocaleString()} Credits & +${ach.rewardXp} XP`,
        timestamp: Date.now(),
        creditsDelta: ach.rewardCredits,
        xpDelta: ach.rewardXp,
      };
      dispatch({ type: 'RECORD_ACTIVITY', payload: activity });

      dispatch({
        type: 'UPDATE_ACHIEVEMENT_PROGRESS',
        payload: { achievementId: 'high_roller', value: updatedProfile.credits, isAbsolute: true },
      });
    },
    [state.achievements]
  );

  const setCurrentTab = useCallback((tab: NavTab) => {
    soundManager.playClick();
    dispatch({ type: 'SET_TAB', payload: tab });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const CORE_FLOOR_GAMES = ['lucky-slots', 'blackjack', 'roulette', 'dice'];

  const openGame = useCallback(
    (game: GameItem) => {
      soundManager.playClick();
      dispatch({ type: 'OPEN_GAME', payload: game.id });
      window.scrollTo({ top: 0, behavior: 'instant' });

      // Track floor explorer achievement across the 4 main casino games
      const nextVisited = new Set(state.visitedGameIds);
      nextVisited.add(game.id);
      const visitedCoreCount = CORE_FLOOR_GAMES.filter((id) => nextVisited.has(id)).length;
      dispatch({
        type: 'UPDATE_ACHIEVEMENT_PROGRESS',
        payload: { achievementId: 'floor_tour', value: visitedCoreCount, isAbsolute: true },
      });
    },
    [state.visitedGameIds]
  );

  const exitGame = useCallback(() => {
    soundManager.playClick();
    dispatch({ type: 'EXIT_GAME' });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const openDailyBonusModal = useCallback(() => {
    soundManager.playClick();
    dispatch({ type: 'SET_DAILY_BONUS_MODAL', payload: true });
  }, []);

  const closeDailyBonusModal = useCallback(() => {
    soundManager.playClick();
    dispatch({ type: 'SET_DAILY_BONUS_MODAL', payload: false });
  }, []);

  const updateSettings = useCallback((newSettings: Partial<CasinoSettings>) => {
    soundManager.playClick();
    dispatch({ type: 'UPDATE_SETTINGS', payload: newSettings });
  }, []);

  const resetProgress = useCallback(() => {
    soundManager.playClick();
    try {
      localStorage.removeItem(`${STORAGE_KEY}_profile`);
      localStorage.removeItem(`${STORAGE_KEY}_achievements`);
      localStorage.removeItem(`${STORAGE_KEY}_activities`);
      localStorage.removeItem(`${STORAGE_KEY}_settings`);
      localStorage.removeItem(`${STORAGE_KEY}_games`);
      localStorage.removeItem(`${STORAGE_KEY}_visited_games`);
      localStorage.removeItem(`${STORAGE_KEY}_pending_round`);
    } catch {
      // ignore
    }
    dispatch({ type: 'RESET_PROGRESS' });
  }, []);

  return (
    <CasinoContext.Provider
      value={{
        profile: derivedProfile,
        games: derivedGames,
        achievements: state.achievements,
        activities: state.activities,
        settings: state.settings,
        currentTab: state.currentTab,
        activeGame,
        levelInfo,
        isDailyBonusAvailable,
        isDailyBonusModalOpen: state.isDailyBonusModalOpen,
        createCharacter,
        setCurrentTab,
        openGame,
        exitGame,
        openDailyBonusModal,
        closeDailyBonusModal,
        claimDailyBonus,
        fastForwardDailyBonus,
        claimAchievement,
        updateSettings,
        updateProfile,
        resetProgress,
        recordActivity,
        placeBet,
        resolveRound,
        executeRound,
      }}
    >
      {children}
    </CasinoContext.Provider>
  );
};

export const useCasino = (): CasinoContextType => {
  const ctx = useContext(CasinoContext);
  if (!ctx) {
    throw new Error('useCasino must be used within a CasinoProvider');
  }
  return ctx;
};
