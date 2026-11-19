// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import App from '../App';
import { AVATAR_OPTIONS } from '../data/initialData';

const STORAGE_PREFIX = 'tahns_casino_v2';

function seedPatronProfile(overrides: Record<string, unknown> = {}) {
  const profile = {
    id: 'patron_test_1',
    name: 'Tahn',
    avatarUrl: AVATAR_OPTIONS[0].url,
    xp: 750,
    credits: 2450,
    gamesPlayed: 12,
    totalWinnings: 1800,
    totalLosses: 350,
    createdAt: Date.now() - 86400000 * 3,
    dailyStreak: 4,
    ...overrides,
  };
  localStorage.setItem(`${STORAGE_PREFIX}_profile`, JSON.stringify(profile));
  return profile;
}

describe('Mobile Navigation, Branding & Player Profile Redesign', () => {
  beforeEach(() => {
    localStorage.clear();
    window.scrollTo = vi.fn();
    seedPatronProfile();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('renders 4-item mobile bottom navigation with Home, Games, LV badge Profile, and Achievements (no Settings)', () => {
    render(<App />);

    const mobileNav = screen.getByRole('navigation', { name: /mobile navigation/i });
    const buttons = within(mobileNav).getAllByRole('button');
    expect(buttons).toHaveLength(4);

    expect(within(mobileNav).getByRole('button', { name: /home/i })).toBeTruthy();
    expect(within(mobileNav).getByRole('button', { name: /games/i })).toBeTruthy();
    expect(within(mobileNav).getByRole('button', { name: /player profile, level 2/i })).toBeTruthy();
    expect(within(mobileNav).getByRole('button', { name: /achievements/i })).toBeTruthy();
    expect(within(mobileNav).queryByRole('button', { name: /settings/i })).toBeNull();
    expect(within(mobileNav).getByText('LV. 2')).toBeTruthy();
  });

  it('uses the emerald spade brand mark and hides wordmark text on mobile top header', () => {
    render(<App />);

    const logoImg = screen.getByAltText("Tahn's Casino") as HTMLImageElement;
    expect(logoImg.getAttribute('src')).toContain('file_0000000095b881fabff7dfd6b625b264_d8f23d09.png');

    const homeButton = screen.getByRole('button', { name: "Tahn's Casino Home" });
    const wordmarkContainer = homeButton.querySelector('div.hidden.lg\\:block');
    expect(wordmarkContainer).toBeTruthy();
  });

  it('navigates to dedicated Player Profile page from bottom nav level indicator and edits identity with persistence', () => {
    render(<App />);

    const mobileNav = screen.getByRole('navigation', { name: /mobile navigation/i });
    const levelProfileBtn = within(mobileNav).getByRole('button', {
      name: /player profile, level 2/i,
    });
    fireEvent.click(levelProfileBtn);

    // Breadcrumb & identity details
    expect(screen.getByText('Patron Dossier')).toBeTruthy();
    expect(screen.getByText('Player Profile')).toBeTruthy();
    expect(screen.getAllByText('Silver Cardholder').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('4 Days')).toBeTruthy();
    expect(screen.getAllByText('2,450').length).toBeGreaterThanOrEqual(1);
    // Level 2 has minXp=500, maxXp=1200 -> 250 / 700 XP = 36%
    expect(screen.getByText('36%')).toBeTruthy();

    // Edit display name and preset avatar
    fireEvent.click(screen.getByRole('button', { name: /edit identity/i }));
    const nameInput = screen.getByLabelText(/display name/i) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Ace Patron' } });
    fireEvent.click(screen.getByRole('button', { name: /select card master avatar/i }));
    fireEvent.click(screen.getByRole('button', { name: /save identity/i }));

    expect(screen.getByText('Ace Patron')).toBeTruthy();
    const persisted = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}_profile`) || '{}');
    expect(persisted.name).toBe('Ace Patron');
    expect(persisted.avatarUrl).toBe(AVATAR_OPTIONS[2].url);
  });

  it('keeps Settings accessible via the hamburger menu drawer and removes redundant page h1 headings across views', () => {
    render(<App />);

    // Home view retains green breadcrumb without redundant h1
    expect(screen.getByText('Patron Lounge')).toBeTruthy();
    expect(screen.getByText('Floor Overview')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: "Tahn's Casino" })).toBeNull();

    // Games view retains green breadcrumb without redundant h1
    const mobileNav = screen.getByRole('navigation', { name: /mobile navigation/i });
    fireEvent.click(within(mobileNav).getByRole('button', { name: /^games$/i }));
    expect(screen.getByText('Casino Floor')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Casino Games' })).toBeNull();

    // Achievements view retains green breadcrumb without redundant h1
    fireEvent.click(within(mobileNav).getByRole('button', { name: /^achievements$/i }));
    expect(screen.getByText('Patron Honors')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Patron Achievements' })).toBeNull();

    // Open hamburger drawer and navigate to Settings
    fireEvent.click(screen.getByRole('button', { name: /open menu drawer/i }));
    const drawer = screen.getByRole('complementary');
    expect(within(drawer).getByText('Player Profile')).toBeTruthy();
    expect(within(drawer).getByText('Settings')).toBeTruthy();
    expect(within(drawer).getByText('Daily Bonus')).toBeTruthy();

    fireEvent.click(within(drawer).getByRole('button', { name: /^settings$/i }));
    expect(screen.getByText('Patron Preferences')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Casino Settings' })).toBeNull();
  });

  it('omits "Back to Casino Floor" from playable game screens and returns to Casino Floor via hamburger drawer', () => {
    render(<App />);

    // Open Casino Floor
    const desktopNav = screen.getByRole('navigation', { name: /desktop navigation/i });
    fireEvent.click(within(desktopNav).getByRole('button', { name: /^games$/i }));
    expect(screen.getByText('Casino Floor')).toBeTruthy();

    // Launch all 7 playable games sequentially via their Play buttons and verify no Back to Casino Floor link exists
    const playButtons = screen.getAllByRole('button', { name: /^play$/i });
    expect(playButtons.length).toBe(7);

    // Test first game (Lucky Slots) and return via hamburger menu drawer
    fireEvent.click(playButtons[0]);
    expect(screen.queryByText(/back to casino floor/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /open menu drawer/i }));
    const drawer = screen.getByRole('complementary');
    fireEvent.click(within(drawer).getByRole('button', { name: /^games$/i }));
    expect(screen.getByText('Casino Floor')).toBeTruthy();

    // Verify every remaining playable game renders without "Back to Casino Floor"
    for (let i = 1; i < playButtons.length; i++) {
      const currentPlayButtons = screen.getAllByRole('button', { name: /^play$/i });
      fireEvent.click(currentPlayButtons[i]);
      expect(screen.queryByText(/back to casino floor/i)).toBeNull();
      fireEvent.click(within(desktopNav).getByRole('button', { name: /^games$/i }));
      expect(screen.getByText('Casino Floor')).toBeTruthy();
    }
  });
});
