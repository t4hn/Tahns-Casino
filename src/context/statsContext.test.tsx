// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { CasinoProvider, useCasino } from './CasinoContext';
import { AVATAR_OPTIONS } from '../data/initialData';

const STORAGE_KEY = 'tahns_casino_v2';

function seedProfile(credits = 1000) {
  localStorage.setItem(
    `${STORAGE_KEY}_profile`,
    JSON.stringify({
      id: 'patron_ctx_test',
      name: 'Tahn',
      avatarUrl: AVATAR_OPTIONS[0].url,
      xp: 0,
      credits,
      gamesPlayed: 0,
      totalWinnings: 0,
      totalLosses: 0,
      createdAt: Date.now(),
      dailyStreak: 0,
    })
  );
}

const ContextProbe: React.FC<{ onReady: (ctx: ReturnType<typeof useCasino>) => void }> = ({
  onReady,
}) => {
  const ctx = useCasino();
  React.useEffect(() => {
    onReady(ctx);
  });
  return (
    <div>
      <span data-testid="rounds">{ctx.stats.overall.rounds}</span>
      <span data-testid="history-len">{ctx.roundHistory.length}</span>
      <span data-testid="ach-count">{ctx.achievements.length}</span>
      <span data-testid="credits">{ctx.profile?.credits ?? 'none'}</span>
    </div>
  );
};

describe('CasinoContext Stats, History, Recovery & Migration Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    window.scrollTo = vi.fn();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('persists stats & history once per settled round with round detail', () => {
    seedProfile(1000);
    let latestCtx!: ReturnType<typeof useCasino>;

    render(
      <CasinoProvider>
        <ContextProbe onReady={(ctx) => { latestCtx = ctx; }} />
      </CasinoProvider>
    );

    act(() => {
      const res = latestCtx.executeRound('dice', 'Dice', 50, 250, undefined, {
        roundId: 'dice_round_1',
        detail: 'Lucky 7 · Rolled 7',
      });
      expect(res.success).toBe(true);
    });

    expect(screen.getByTestId('rounds').textContent).toBe('1');
    expect(screen.getByTestId('history-len').textContent).toBe('1');
    expect(screen.getByTestId('credits').textContent).toBe('1200');

    const storedStats = JSON.parse(localStorage.getItem(`${STORAGE_KEY}_stats`) || '{}');
    expect(storedStats.version).toBe(1);
    expect(storedStats.stats.overall.rounds).toBe(1);
    expect(storedStats.stats.byGame.dice.biggestWin).toBe(200);

    const storedHistory = JSON.parse(localStorage.getItem(`${STORAGE_KEY}_history`) || '{}');
    expect(storedHistory.version).toBe(1);
    expect(storedHistory.records).toHaveLength(1);
    expect(storedHistory.records[0].detail).toBe('Lucky 7 · Rolled 7');
  });

  it('records crash-recovered round once with recovered: true flag', () => {
    seedProfile(950);
    localStorage.setItem(
      `${STORAGE_KEY}_pending_round`,
      JSON.stringify({
        gameId: 'blackjack',
        gameName: 'Blackjack',
        bet: 50,
        payout: 125,
        timestamp: Date.now(),
        meta: {
          roundId: 'bj_recover_1',
          detail: 'Blackjack 3:2',
          facts: { blackjackNatural: true },
        },
      })
    );

    let latestCtx!: ReturnType<typeof useCasino>;
    render(
      <CasinoProvider>
        <ContextProbe onReady={(ctx) => { latestCtx = ctx; }} />
      </CasinoProvider>
    );

    expect(screen.getByTestId('rounds').textContent).toBe('1');
    expect(screen.getByTestId('history-len').textContent).toBe('1');
    expect(screen.getByTestId('credits').textContent).toBe('1075');
    expect(latestCtx.roundHistory[0].recovered).toBe(true);
    expect(latestCtx.roundHistory[0].detail).toBe('Blackjack 3:2');
    expect(latestCtx.achievements.find((a) => a.id === 'bj_natural')?.unlocked).toBe(true);
  });

  it('does not record stats or history when settlement fails', () => {
    seedProfile(10); // insufficient for a 50 Cr bet
    let latestCtx!: ReturnType<typeof useCasino>;

    render(
      <CasinoProvider>
        <ContextProbe onReady={(ctx) => { latestCtx = ctx; }} />
      </CasinoProvider>
    );

    act(() => {
      const res = latestCtx.executeRound('dice', 'Dice', 50, 100);
      expect(res.success).toBe(false);
    });

    expect(screen.getByTestId('rounds').textContent).toBe('0');
    expect(screen.getByTestId('history-len').textContent).toBe('0');
    expect(screen.getByTestId('credits').textContent).toBe('10');
  });

  it('wipes stats and history state & storage on resetProgress()', () => {
    seedProfile(1000);
    let latestCtx!: ReturnType<typeof useCasino>;

    render(
      <CasinoProvider>
        <ContextProbe onReady={(ctx) => { latestCtx = ctx; }} />
      </CasinoProvider>
    );

    act(() => {
      latestCtx.executeRound('keno', 'Keno', 20, 100, undefined, {
        roundId: 'keno_reset_test',
        detail: 'Keno 4 spots, 3 hits',
      });
    });
    expect(screen.getByTestId('rounds').textContent).toBe('1');

    act(() => {
      latestCtx.resetProgress();
    });

    expect(screen.getByTestId('rounds').textContent).toBe('0');
    expect(screen.getByTestId('history-len').textContent).toBe('0');
    expect(screen.getByTestId('credits').textContent).toBe('none');
  });

  it('migrates an old 6-achievement localStorage save cleanly on mount without resetting claimed status', () => {
    seedProfile(1000);
    localStorage.setItem(
      `${STORAGE_KEY}_achievements`,
      JSON.stringify([
        { id: 'first_steps', progress: 1, unlocked: true, claimed: true },
        { id: 'first_wager', progress: 1, unlocked: true, claimed: false },
      ])
    );

    let latestCtx!: ReturnType<typeof useCasino>;
    render(
      <CasinoProvider>
        <ContextProbe onReady={(ctx) => { latestCtx = ctx; }} />
      </CasinoProvider>
    );

    expect(screen.getByTestId('ach-count').textContent).toBe('25');
    expect(latestCtx.achievements.find((a) => a.id === 'first_steps')?.claimed).toBe(true);
    expect(latestCtx.achievements.find((a) => a.id === 'bj_wins_25')?.progress).toBe(0);
  });
});
