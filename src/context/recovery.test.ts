import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveRound as resolveRoundPure, placeBet as placeBetPure, WalletProfile } from '../economy/wallet';

const STORAGE_KEY = 'tahns_casino_v2';

const createMockProfile = (overrides: Partial<WalletProfile> = {}): WalletProfile => ({
  id: 'test_patron_recovery',
  name: 'Tahn',
  avatarUrl: '/images/character_avatar_1793671261002.jpg',
  xp: 150,
  credits: 1000,
  gamesPlayed: 5,
  totalWinnings: 200,
  totalLosses: 100,
  createdAt: 1000000,
  dailyStreak: 1,
  ...overrides,
});

/**
 * Emulates the app initialization recovery logic from CasinoContext loadInitialState()
 */
function emulateAppInit(storage: Storage): {
  profile: WalletProfile | null;
  recoveredActivity: boolean;
} {
  let profile: WalletProfile | null = null;
  let recoveredActivity = false;

  const savedProfile = storage.getItem(`${STORAGE_KEY}_profile`);
  if (savedProfile) {
    profile = JSON.parse(savedProfile);
  }

  const savedPending = storage.getItem(`${STORAGE_KEY}_pending_round`);
  if (savedPending && profile) {
    const pending = JSON.parse(savedPending) as {
      gameId: string;
      gameName: string;
      bet: number;
      payout?: number;
      timestamp: number;
    };

    // Guard: Clear pending record immediately to prevent double-crediting
    storage.removeItem(`${STORAGE_KEY}_pending_round`);

    const recoveryPayout = typeof pending.payout === 'number' ? pending.payout : 0;
    const { profile: updatedProfile } = resolveRoundPure(
      profile,
      pending.bet,
      recoveryPayout
    );
    profile = updatedProfile;

    // Persist recovered profile immediately
    storage.setItem(`${STORAGE_KEY}_profile`, JSON.stringify(profile));
    recoveredActivity = true;
  }

  return { profile, recoveredActivity };
}

class MemoryStorage implements Storage {
  private store: Map<string, string> = new Map();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] || null;
  }
}

const mockStorage = new MemoryStorage();
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as unknown as { localStorage: Storage }).localStorage = mockStorage;
}

describe('Round-in-Progress Interruption & Crash Recovery', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('reloads with pending winning round and credits payout once, without double-crediting on second reload', () => {
    // 1. Patron starts with 1,000 credits
    const initialProfile = createMockProfile({ credits: 1000 });

    // 2. Patron places a 50 credit bet with predetermined 400 credit payout (3 bells, 8x)
    const bet = 50;
    const payout = 400;
    const betRes = placeBetPure(initialProfile, bet);
    expect(betRes.profile.credits).toBe(950);

    // Save state to localStorage as placeBet does
    localStorage.setItem(`${STORAGE_KEY}_profile`, JSON.stringify(betRes.profile));
    localStorage.setItem(
      `${STORAGE_KEY}_pending_round`,
      JSON.stringify({
        gameId: 'lucky-slots',
        gameName: 'Lucky Slots',
        bet,
        payout,
        timestamp: Date.now(),
      })
    );

    // 3. User reloads / opens app: recovery fires
    const firstInit = emulateAppInit(localStorage);
    expect(firstInit.recoveredActivity).toBe(true);
    expect(firstInit.profile).not.toBeNull();

    // 950 (deducted in escrow) + 400 (payout) = 1350 credits
    expect(firstInit.profile!.credits).toBe(1350);
    expect(firstInit.profile!.gamesPlayed).toBe(6);
    expect(firstInit.profile!.totalWinnings).toBe(550); // 200 + (400 - 50 net)

    // Pending round record was removed
    expect(localStorage.getItem(`${STORAGE_KEY}_pending_round`)).toBeNull();

    // 4. Second reload occurs immediately: no double-crediting
    const secondInit = emulateAppInit(localStorage);
    expect(secondInit.recoveredActivity).toBe(false);
    expect(secondInit.profile!.credits).toBe(1350);
    expect(secondInit.profile!.gamesPlayed).toBe(6);
  });

  it('reloads with pending round without payout and resolves as loss', () => {
    // 1. Patron starts with 1,000 credits
    const initialProfile = createMockProfile({ credits: 1000, totalLosses: 100 });

    // 2. Patron places a 100 credit bet, but browser terminates before payout was decided (payout is undefined)
    const bet = 100;
    const betRes = placeBetPure(initialProfile, bet);
    expect(betRes.profile.credits).toBe(900);

    localStorage.setItem(`${STORAGE_KEY}_profile`, JSON.stringify(betRes.profile));
    localStorage.setItem(
      `${STORAGE_KEY}_pending_round`,
      JSON.stringify({
        gameId: 'dice',
        gameName: 'Dice',
        bet,
        timestamp: Date.now(),
      })
    );

    // 3. App reloads: missing payout defaults to 0 (resolved as loss)
    const init = emulateAppInit(localStorage);
    expect(init.recoveredActivity).toBe(true);
    expect(init.profile).not.toBeNull();

    // Credits remain 900 (already deducted), losses increment by 100, gamesPlayed increments by 1
    expect(init.profile!.credits).toBe(900);
    expect(init.profile!.totalLosses).toBe(200); // 100 + 100
    expect(init.profile!.gamesPlayed).toBe(6);

    // Pending round record was cleared
    expect(localStorage.getItem(`${STORAGE_KEY}_pending_round`)).toBeNull();
  });

  it('normal round flow leaves no pending record in localStorage', () => {
    const patron = createMockProfile({ credits: 1000 });
    const bet = 20;
    const payout = 40;

    // Simulate placeBet
    const betRes = placeBetPure(patron, bet);
    localStorage.setItem(
      `${STORAGE_KEY}_pending_round`,
      JSON.stringify({
        gameId: 'lucky-slots',
        gameName: 'Lucky Slots',
        bet,
        payout,
        timestamp: Date.now(),
      })
    );
    expect(localStorage.getItem(`${STORAGE_KEY}_pending_round`)).not.toBeNull();

    // Simulate resolveRound
    const resolveRes = resolveRoundPure(betRes.profile, bet, payout);
    localStorage.removeItem(`${STORAGE_KEY}_pending_round`);
    localStorage.setItem(`${STORAGE_KEY}_profile`, JSON.stringify(resolveRes.profile));

    // Verify localStorage has no pending round
    expect(localStorage.getItem(`${STORAGE_KEY}_pending_round`)).toBeNull();

    // Subsequent reload does not trigger recovery
    const init = emulateAppInit(localStorage);
    expect(init.recoveredActivity).toBe(false);
    expect(init.profile!.credits).toBe(1020);
  });
});
