import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  PlayerProfile,
  GameItem,
  Achievement,
  ActivityItem,
  CasinoSettings,
  NavTab,
} from '../types/casino';
import {
  STARTING_CREDITS,
  STARTING_LEVEL,
  STARTING_XP,
  INITIAL_GAMES,
  INITIAL_ACHIEVEMENTS,
  INITIAL_ACTIVITIES,
  INITIAL_SETTINGS,
} from '../data/initialData';
import { soundManager } from '../utils/sound';

export interface LevelInfo {
  level: number;
  currentLevelXp: number;
  nextLevelTargetXp: number;
  progressPercent: number;
  title: string;
}

export function calculateLevelInfo(totalXp: number): LevelInfo {
  const thresholds = [
    { level: 1, minXp: 0, maxXp: 500, title: 'Bronze Patron' },
    { level: 2, minXp: 500, maxXp: 1200, title: 'Silver Cardholder' },
    { level: 3, minXp: 1200, maxXp: 2200, title: 'Gold Member' },
    { level: 4, minXp: 2200, maxXp: 3500, title: 'Platinum Roller' },
    { level: 5, minXp: 3500, maxXp: 5200, title: 'Black Tier Elite' },
    { level: 6, minXp: 5200, maxXp: 7500, title: 'Casino Royalty' },
  ];

  let currentTier = thresholds[0];
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (totalXp >= thresholds[i].minXp) {
      currentTier = thresholds[i];
      break;
    }
  }

  const xpInLevel = totalXp - currentTier.minXp;
  const xpNeededForLevel = currentTier.maxXp - currentTier.minXp;
  const progressPercent = Math.min(100, Math.max(0, (xpInLevel / xpNeededForLevel) * 100));

  return {
    level: currentTier.level,
    currentLevelXp: xpInLevel,
    nextLevelTargetXp: xpNeededForLevel,
    progressPercent,
    title: currentTier.title,
  };
}

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
  dailyBonusCountdown: string;
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
  addCredits: (amount: number, reason: string) => void;
  deductCredits: (amount: number, reason: string) => boolean;
  awardXp: (amount: number, reason: string) => void;
  updateAchievementProgress: (achievementId: string, value: number, isAbsolute?: boolean) => void;
  playGameRound: (gameId: string, betAmount: number) => { success: boolean; won: boolean; winAmount: number; message: string };
}

const CasinoContext = createContext<CasinoContextType | undefined>(undefined);

const STORAGE_KEY = 'tahns_casino_v2';

export const CasinoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Check if player profile exists in localStorage; if null, user will see character creation
  const [profile, setProfile] = useState<PlayerProfile | null>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_profile`);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return null;
  });

  const [games, setGames] = useState<GameItem[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_games`);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_GAMES;
  });

  const [achievements, setAchievements] = useState<Achievement[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_achievements`);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_ACHIEVEMENTS;
  });

  const [activities, setActivities] = useState<ActivityItem[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_activities`);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_ACTIVITIES;
  });

  const [settings, setSettings] = useState<CasinoSettings>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_settings`);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_SETTINGS;
  });

  const [currentTab, setCurrentTabState] = useState<NavTab>('home');
  const [activeGame, setActiveGame] = useState<GameItem | null>(null);
  const [isDailyBonusModalOpen, setIsDailyBonusModalOpen] = useState(false);
  const [visitedGames, setVisitedGames] = useState<string[]>([]);
  const [, setCountdownTick] = useState(0);

  // Sync sound settings
  useEffect(() => {
    soundManager.setEnabled(settings.soundEffects);
  }, [settings.soundEffects]);

  // Persist state to localStorage
  useEffect(() => {
    try {
      if (profile) {
        localStorage.setItem(`${STORAGE_KEY}_profile`, JSON.stringify(profile));
      } else {
        localStorage.removeItem(`${STORAGE_KEY}_profile`);
      }
    } catch (e) {
      console.warn('Storage failed for profile', e);
    }
  }, [profile]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_achievements`, JSON.stringify(achievements));
    } catch (e) {
      console.warn('Storage failed for achievements', e);
    }
  }, [achievements]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_activities`, JSON.stringify(activities));
    } catch (e) {
      console.warn('Storage failed for activities', e);
    }
  }, [activities]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_settings`, JSON.stringify(settings));
    } catch (e) {
      console.warn('Storage failed for settings', e);
    }
  }, [settings]);

  // Level info
  const levelInfo = profile
    ? calculateLevelInfo(profile.xp)
    : { level: 1, currentLevelXp: 0, nextLevelTargetXp: 500, progressPercent: 0, title: 'Bronze Patron' };

  // Keep profile title & level synced if XP changes
  useEffect(() => {
    if (profile && (profile.level !== levelInfo.level || profile.title !== levelInfo.title)) {
      setProfile((prev) => (prev ? { ...prev, level: levelInfo.level, title: levelInfo.title } : null));
    }
  }, [levelInfo.level, levelInfo.title, profile]);

  // Unlock games according to player level
  useEffect(() => {
    if (!profile) return;
    setGames((prevGames) =>
      prevGames.map((game) => ({
        ...game,
        isLocked: profile.level < game.minLevel,
        status: profile.level < game.minLevel ? `Requires Level ${game.minLevel}` : 'Table Open',
      }))
    );
  }, [profile?.level]);

  // Daily bonus calculations (24 hours cooldown)
  const COOLDOWN_MS = 24 * 60 * 60 * 1000;
  const lastClaim = profile?.lastDailyClaim || 0;
  const isDailyBonusAvailable = !profile?.lastDailyClaim || Date.now() - lastClaim >= COOLDOWN_MS;

  // Countdown timer ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdownTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const remainingMs = Math.max(0, COOLDOWN_MS - (Date.now() - lastClaim));
  const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
  const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
  const remainingSeconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
  const dailyBonusCountdown = isDailyBonusAvailable
    ? 'Ready to claim'
    : `${remainingHours.toString().padStart(2, '0')}:${remainingMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;

  const setCurrentTab = (tab: NavTab) => {
    soundManager.playClick();
    setActiveGame(null); // Exit active game when navigating tabs
    setCurrentTabState(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const recordActivity = useCallback((item: Omit<ActivityItem, 'id' | 'timestamp'>) => {
    const newActivity: ActivityItem = {
      ...item,
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
    };
    setActivities((prev) => [newActivity, ...prev.slice(0, 19)]);
  }, []);

  const updateAchievementProgress = useCallback(
    (achievementId: string, value: number, isAbsolute: boolean = false) => {
      setAchievements((prev) =>
        prev.map((ach) => {
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
        })
      );
    },
    []
  );

  const addCredits = useCallback(
    (amount: number, reason: string) => {
      if (amount <= 0) return;
      setProfile((prev) => {
        if (!prev) return null;
        const nextCredits = prev.credits + amount;
        const nextWinnings = prev.totalWinnings + amount;
        updateAchievementProgress('high_roller', nextCredits, true);
        return {
          ...prev,
          credits: nextCredits,
          totalWinnings: nextWinnings,
        };
      });
      recordActivity({
        type: 'daily_bonus',
        title: 'Credits Credited',
        description: reason,
        creditsDelta: amount,
      });
    },
    [recordActivity, updateAchievementProgress]
  );

  const deductCredits = useCallback(
    (amount: number, reason: string): boolean => {
      if (amount <= 0) return false;
      let succeeded = false;

      setProfile((prev) => {
        if (!prev || prev.credits < amount) {
          succeeded = false;
          return prev;
        }
        succeeded = true;
        const nextCredits = prev.credits - amount;
        const nextLosses = prev.totalLosses + amount;
        return {
          ...prev,
          credits: nextCredits,
          totalLosses: nextLosses,
        };
      });

      if (succeeded) {
        recordActivity({
          type: 'game_played',
          title: 'Wager Placed',
          description: reason,
          creditsDelta: -amount,
        });
      } else {
        soundManager.playLocked();
      }

      return succeeded;
    },
    [recordActivity]
  );

  const awardXp = useCallback(
    (amount: number, reason: string) => {
      if (amount <= 0) return;
      setProfile((prev) => {
        if (!prev) return null;
        const prevLevel = calculateLevelInfo(prev.xp).level;
        const nextXp = prev.xp + amount;
        const nextLevelInfo = calculateLevelInfo(nextXp);

        if (nextLevelInfo.level > prevLevel) {
          soundManager.playLevelUp();
          const bonusCredits = 500 * nextLevelInfo.level;
          recordActivity({
            type: 'level_up',
            title: `Level Up: Level ${nextLevelInfo.level}`,
            description: `Attained ${nextLevelInfo.title}. Promotion bonus: +${bonusCredits.toLocaleString()} Credits`,
            creditsDelta: bonusCredits,
            xpDelta: amount,
          });
          updateAchievementProgress('level_two', nextXp, true);
          return {
            ...prev,
            xp: nextXp,
            level: nextLevelInfo.level,
            title: nextLevelInfo.title,
            credits: prev.credits + bonusCredits,
          };
        }

        updateAchievementProgress('level_two', nextXp, true);
        return { ...prev, xp: nextXp };
      });
    },
    [recordActivity, updateAchievementProgress]
  );

  const createCharacter = (name: string, avatarUrl: string) => {
    soundManager.playBonusClaim();
    const cleanName = name.trim() || 'Tahn';
    const newProfile: PlayerProfile = {
      id: `patron_${Date.now()}`,
      name: cleanName,
      avatarUrl: avatarUrl,
      level: STARTING_LEVEL,
      xp: STARTING_XP,
      credits: STARTING_CREDITS,
      title: 'Bronze Patron',
      gamesPlayed: 0,
      totalWinnings: 0,
      totalLosses: 0,
      createdAt: Date.now(),
      dailyStreak: 0,
      lastDailyClaim: undefined,
    };

    setProfile(newProfile);
    setActivities([
      {
        id: `act_${Date.now()}`,
        type: 'system',
        title: 'Patron Membership Activated',
        description: `Welcome to Tahn's Casino, ${cleanName}. ${STARTING_CREDITS.toLocaleString()} starting credits loaded.`,
        timestamp: Date.now(),
        creditsDelta: STARTING_CREDITS,
      },
    ]);
    setCurrentTabState('home');
  };

  const claimDailyBonus = (): boolean => {
    if (!profile || !isDailyBonusAvailable) {
      soundManager.playLocked();
      return false;
    }

    const BONUS_CREDITS = 1000;
    const BONUS_XP = 200;

    soundManager.playBonusClaim();

    setProfile((prev) => {
      if (!prev) return null;
      const nextCredits = prev.credits + BONUS_CREDITS;
      const nextXp = prev.xp + BONUS_XP;
      const nextStreak = (prev.dailyStreak || 0) + 1;
      return {
        ...prev,
        credits: nextCredits,
        xp: nextXp,
        lastDailyClaim: Date.now(),
        dailyStreak: nextStreak,
      };
    });

    recordActivity({
      type: 'daily_bonus',
      title: 'Daily Allowance Claimed',
      description: `Complimentary daily allowance: +${BONUS_CREDITS.toLocaleString()} Credits`,
      creditsDelta: BONUS_CREDITS,
      xpDelta: BONUS_XP,
    });

    updateAchievementProgress('daily_patron', 1, false);
    return true;
  };

  const fastForwardDailyBonus = () => {
    setProfile((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        lastDailyClaim: Date.now() - 25 * 60 * 60 * 1000,
      };
    });
    soundManager.playCoin();
  };

  const claimAchievement = (achievementId: string) => {
    const ach = achievements.find((a) => a.id === achievementId);
    if (!ach || !ach.unlocked || ach.claimed || !profile) {
      soundManager.playLocked();
      return;
    }

    soundManager.playCoin();

    setAchievements((prev) =>
      prev.map((a) => (a.id === achievementId ? { ...a, claimed: true } : a))
    );

    setProfile((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        credits: prev.credits + ach.rewardCredits,
        xp: prev.xp + ach.rewardXp,
      };
    });

    recordActivity({
      type: 'achievement',
      title: 'Honors Reward Claimed',
      description: `Completed "${ach.title}" — +${ach.rewardCredits.toLocaleString()} Credits & +${ach.rewardXp} XP`,
      creditsDelta: ach.rewardCredits,
      xpDelta: ach.rewardXp,
    });
  };

  const openGame = (game: GameItem) => {
    if (game.isLocked) {
      soundManager.playLocked();
      return;
    }
    soundManager.playClick();
    setActiveGame(game);

    if (!visitedGames.includes(game.id)) {
      const nextVisited = [...visitedGames, game.id];
      setVisitedGames(nextVisited);
      updateAchievementProgress('floor_tour', nextVisited.length, true);
    }
  };

  const exitGame = () => {
    soundManager.playClick();
    setActiveGame(null);
  };

  const playGameRound = (
    gameId: string,
    betAmount: number
  ): { success: boolean; won: boolean; winAmount: number; message: string } => {
    if (!profile) return { success: false, won: false, winAmount: 0, message: 'No patron profile found.' };
    if (profile.credits < betAmount) {
      soundManager.playLocked();
      return { success: false, won: false, winAmount: 0, message: 'Insufficient credits for this wager.' };
    }

    // Deduct wager safely
    const deducted = deductCredits(betAmount, `Table wager on ${activeGame?.name || gameId}`);
    if (!deducted) {
      return { success: false, won: false, winAmount: 0, message: 'Wager deduction failed.' };
    }

    // Simulate outcome based on RNG
    const won = Math.random() < 0.48; // ~48% win probability
    const winMultiplier = won ? (Math.random() < 0.2 ? 3 : 2) : 0;
    const winAmount = won ? Math.round(betAmount * winMultiplier) : 0;

    // Increment games played
    setProfile((prev) => (prev ? { ...prev, gamesPlayed: prev.gamesPlayed + 1 } : null));
    updateAchievementProgress('first_wager', 1, true);

    if (won) {
      soundManager.playCoin();
      addCredits(winAmount, `Winnings on ${activeGame?.name || gameId}`);
      awardXp(Math.max(15, Math.round(betAmount * 0.4)), 'Round won XP');
      return {
        success: true,
        won: true,
        winAmount,
        message: `Winner! Payout: +${winAmount.toLocaleString()} Credits!`,
      };
    } else {
      awardXp(Math.max(10, Math.round(betAmount * 0.2)), 'Round participation XP');
      return {
        success: true,
        won: false,
        winAmount: 0,
        message: 'House wins this hand. Better luck on the next turn!',
      };
    }
  };

  const openDailyBonusModal = () => {
    soundManager.playClick();
    setIsDailyBonusModalOpen(true);
  };

  const closeDailyBonusModal = () => {
    soundManager.playClick();
    setIsDailyBonusModalOpen(false);
  };

  const updateSettings = (newSettings: Partial<CasinoSettings>) => {
    soundManager.playClick();
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const updateProfile = (name: string, avatarUrl: string) => {
    soundManager.playClick();
    setProfile((prev) => (prev ? { ...prev, name: name.trim() || 'Tahn', avatarUrl } : null));
    recordActivity({
      type: 'system',
      title: 'Patron Profile Updated',
      description: `Name updated to ${name.trim() || 'Tahn'}`,
    });
  };

  const resetProgress = () => {
    soundManager.playClick();
    // Wipe all saved local storage items
    localStorage.removeItem(`${STORAGE_KEY}_profile`);
    localStorage.removeItem(`${STORAGE_KEY}_achievements`);
    localStorage.removeItem(`${STORAGE_KEY}_activities`);
    localStorage.removeItem(`${STORAGE_KEY}_games`);
    localStorage.removeItem(`${STORAGE_KEY}_settings`);

    // Reset runtime state
    setProfile(null); // Direct return to Character Creation!
    setActiveGame(null);
    setGames(INITIAL_GAMES);
    setAchievements(INITIAL_ACHIEVEMENTS);
    setActivities(INITIAL_ACTIVITIES);
    setSettings(INITIAL_SETTINGS);
    setVisitedGames([]);
    setCurrentTabState('home');
  };

  return (
    <CasinoContext.Provider
      value={{
        profile,
        games,
        achievements,
        activities,
        settings,
        currentTab,
        activeGame,
        levelInfo,
        isDailyBonusAvailable,
        dailyBonusCountdown,
        isDailyBonusModalOpen,
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
        addCredits,
        deductCredits,
        awardXp,
        updateAchievementProgress,
        playGameRound,
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
