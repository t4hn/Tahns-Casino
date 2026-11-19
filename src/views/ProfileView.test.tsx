// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CasinoProvider } from '../context/CasinoContext';
import { ProfileView } from './ProfileView';
import { HomeView } from './HomeView';
import { GamesView } from './GamesView';
import { AVATAR_OPTIONS } from '../data/initialData';
import {
  createEmptyStatsState,
  recordRoundWithHistory,
  serializeStatsPayload,
  serializeHistoryPayload,
  RoundRecord,
} from '../economy/stats';

const STORAGE_KEY = 'tahns_casino_v2';

function seedProfile(overrides: Record<string, unknown> = {}) {
  localStorage.setItem(
    `${STORAGE_KEY}_profile`,
    JSON.stringify({
      id: 'patron_ui_test',
      name: 'Tahn',
      avatarUrl: AVATAR_OPTIONS[0].url,
      xp: 300,
      credits: 1500,
      gamesPlayed: 0,
      totalWinnings: 0,
      totalLosses: 0,
      createdAt: Date.now() - 86400000,
      dailyStreak: 1,
      ...overrides,
    })
  );
}

describe('Casino Record UI & Out-of-Credits Banners', () => {
  beforeEach(() => {
    localStorage.clear();
    window.scrollTo = vi.fn();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('renders empty state cleanly on ProfileView when no rounds have been played', () => {
    seedProfile();
    render(
      <CasinoProvider>
        <ProfileView />
      </CasinoProvider>
    );

    expect(screen.getByRole('heading', { name: 'Casino Record' })).toBeTruthy();
    expect(screen.getByText('No rounds yet - hit the tables!')).toBeTruthy();
    expect(screen.getAllByText('Not played yet').length).toBe(7);
    expect(
      screen.getByText("Results are random; past rounds don't affect future ones.")
    ).toBeTruthy();
  });

  it('renders populated stats, expandable per-game rows, and Show more history toggle for >20 rounds', () => {
    seedProfile();
    let stats = createEmptyStatsState();
    let history: RoundRecord[] = [];

    for (let i = 1; i <= 25; i++) {
      const rec: RoundRecord = {
        id: `hist_${i}`,
        gameId: i % 2 === 0 ? 'blackjack' : 'dice',
        gameName: i % 2 === 0 ? 'Blackjack' : 'Dice',
        timestamp: Date.now() - (26 - i) * 60_000,
        bet: 20,
        payout: i % 3 === 0 ? 0 : 40,
        net: i % 3 === 0 ? -20 : 20,
        multiplier: i % 3 === 0 ? 0 : 2,
        detail: `Test round #${i}`,
        ...(i === 25 ? { recovered: true } : {}),
      };
      const res = recordRoundWithHistory(stats, history, rec);
      stats = res.stats;
      history = res.history;
    }

    localStorage.setItem(`${STORAGE_KEY}_stats`, JSON.stringify(serializeStatsPayload(stats)));
    localStorage.setItem(
      `${STORAGE_KEY}_history`,
      JSON.stringify(serializeHistoryPayload(history))
    );

    render(
      <CasinoProvider>
        <ProfileView />
      </CasinoProvider>
    );

    // 20 initially visible out of 25
    expect(screen.getByText('Showing 20 of 25')).toBeTruthy();
    expect(screen.getByText('Test round #25')).toBeTruthy();
    expect(screen.getByText('Recovered')).toBeTruthy();
    expect(screen.queryByText('Test round #1')).toBeNull();

    // Expand "Show more"
    fireEvent.click(screen.getByRole('button', { name: /show more/i }));
    expect(screen.getByText('Showing 25 of 25')).toBeTruthy();
    expect(screen.getByText('Test round #1')).toBeTruthy();

    // Expand Dice per-game row
    const diceRow = screen.getByRole('button', { name: /dice/i });
    expect(diceRow.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(diceRow);
    expect(diceRow.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('W / L / P')).toBeTruthy();
  });

  it('displays OutOfCreditsBanner on HomeView and GamesView with ready state and cooldown countdown', () => {
    // 1. Out of credits & Daily Bonus ready
    seedProfile({ credits: 5, lastDailyClaim: undefined });
    const { unmount } = render(
      <CasinoProvider>
        <HomeView />
      </CasinoProvider>
    );
    expect(screen.getByText('Your Daily Bonus is ready to claim.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Claim Daily Bonus' })).toBeTruthy();
    unmount();

    // 2. Out of credits & Daily Bonus on cooldown -> renders countdown on GamesView
    seedProfile({ credits: 0, lastDailyClaim: Date.now() - 60_000 });
    render(
      <CasinoProvider>
        <GamesView />
      </CasinoProvider>
    );
    expect(
      screen.getByText(/You're out of credits\. Your next Daily Bonus will be ready in/i)
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'View Daily Bonus' })).toBeTruthy();
  });
});
