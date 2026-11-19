import React, { useState } from 'react';
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  Clock,
  Flame,
  History,
  Info,
  Trophy,
} from 'lucide-react';
import { useCasino } from '../context/CasinoContext';
import { formatRelativeTime } from '../economy/stats';
import { soundManager } from '../utils/sound';

const INITIAL_HISTORY_VISIBLE = 20;

export const CasinoRecordSection: React.FC = () => {
  const { stats, roundHistory, games } = useCasino();
  const [expandedGames, setExpandedGames] = useState<Record<string, boolean>>({});
  const [showAllHistory, setShowAllHistory] = useState(false);

  const playableGames = games.filter((g) => g.hasPlayableModule);
  const { overall } = stats;

  const overallWinRate =
    overall.rounds > 0 ? Math.round((overall.wins / overall.rounds) * 100) : 0;

  const toggleGameExpanded = (gameId: string) => {
    soundManager.playClick();
    setExpandedGames((prev) => ({
      ...prev,
      [gameId]: !prev[gameId],
    }));
  };

  const formatSignedCredits = (value: number) => {
    if (value > 0) return `+${value.toLocaleString()} Cr`;
    if (value < 0) return `-${Math.abs(value).toLocaleString()} Cr`;
    return '0 Cr';
  };

  const visibleHistory = showAllHistory
    ? roundHistory
    : roundHistory.slice(0, INITIAL_HISTORY_VISIBLE);

  return (
    <section
      aria-label="Casino Record"
      className="rounded-2xl bg-[#0f141d] border border-slate-800 p-5 sm:p-6 space-y-6"
    >
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 shrink-0">
            <BarChart3 size={18} />
          </div>
          <div>
            <h3 className="text-base font-bold font-display text-slate-100">
              Casino Record
            </h3>
            <p className="text-xs text-slate-400">
              Lifetime table results and recent round ledger
            </p>
          </div>
        </div>

        {overall.favouriteGame && (
          <div className="self-start sm:self-auto px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300">
            Most Played: <span className="text-emerald-400 font-semibold">{overall.favouriteGame}</span>
          </div>
        )}
      </div>

      {/* ── Overall Summary Tiles (6 tiles: 2x3 mobile, 3x2 tablet+) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-3.5 min-w-0">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
            Rounds Played
          </span>
          <p className="text-base sm:text-lg font-bold font-mono tabular-nums text-slate-100 mt-1 truncate">
            {overall.rounds.toLocaleString()}
          </p>
          <p className="text-[10px] font-mono text-slate-500 mt-0.5 truncate">
            {overall.wins}W · {overall.losses}L · {overall.pushes}P
          </p>
        </div>

        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-3.5 min-w-0">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
            Win Rate
          </span>
          <p className="text-base sm:text-lg font-bold font-mono tabular-nums text-emerald-300 mt-1 truncate">
            {overallWinRate}%
          </p>
          <p className="text-[10px] font-mono text-slate-500 mt-0.5 truncate">
            {overall.rounds > 0 ? `${overall.wins} of ${overall.rounds} won` : 'No rounds yet'}
          </p>
        </div>

        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-3.5 min-w-0">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
            Total Wagered
          </span>
          <p className="text-base sm:text-lg font-bold font-mono tabular-nums text-amber-200 mt-1 truncate">
            {overall.totalWagered.toLocaleString()} Cr
          </p>
          <p className="text-[10px] font-mono text-slate-500 mt-0.5 truncate">
            Returned: {overall.totalReturned.toLocaleString()} Cr
          </p>
        </div>

        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-3.5 min-w-0">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
            Net Result
          </span>
          <p
            className={`text-base sm:text-lg font-bold font-mono tabular-nums mt-1 truncate ${
              overall.net > 0
                ? 'text-emerald-400'
                : overall.net < 0
                ? 'text-rose-400'
                : 'text-slate-300'
            }`}
          >
            {formatSignedCredits(overall.net)}
          </p>
          <p className="text-[10px] font-mono text-slate-500 mt-0.5 truncate">
            Across all games
          </p>
        </div>

        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-3.5 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 leading-tight">
              Biggest Win
            </span>
            <Trophy size={12} className="text-amber-400 shrink-0" />
          </div>
          <p className="text-base sm:text-lg font-bold font-mono tabular-nums text-amber-300 mt-1 truncate">
            {overall.biggestWin.toLocaleString()} Cr
          </p>
          <p className="text-[10px] font-mono text-slate-500 mt-0.5 leading-tight">
            {overall.biggestMultiplier > 0
              ? `Top: ${overall.biggestMultiplier}×`
              : 'No win yet'}
          </p>
        </div>

        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-3.5 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 leading-tight">
              Best Win Streak
            </span>
            <Flame size={12} className="text-amber-400 shrink-0" />
          </div>
          <p className="text-base sm:text-lg font-bold font-mono tabular-nums text-slate-100 mt-1 truncate">
            {overall.bestWinStreak} {overall.bestWinStreak === 1 ? 'Win' : 'Wins'}
          </p>
          <p className="text-[10px] font-mono text-slate-500 mt-0.5 leading-tight">
            Current: {overall.currentWinStreak}
          </p>
        </div>
      </div>

      {/* ── By Game Breakdown ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400">
            By Game
          </h4>
          <span className="text-[11px] font-mono text-slate-500">
            Tap any game for details
          </span>
        </div>

        <div className="divide-y divide-slate-800/80 rounded-xl border border-slate-800 bg-[#0b0f16] overflow-hidden">
          {playableGames.map((game) => {
            const gStats = stats.byGame[game.id];
            const isPlayed = Boolean(gStats && gStats.rounds > 0);
            const isExpanded = Boolean(expandedGames[game.id]);
            const winPct =
              isPlayed && gStats.rounds > 0
                ? Math.round((gStats.wins / gStats.rounds) * 100)
                : 0;

            return (
              <div key={game.id}>
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => toggleGameExpanded(game.id)}
                  className="w-full px-3.5 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-900/60 transition-colors min-h-[48px] cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-semibold text-slate-100 truncate">
                      {game.name}
                    </p>
                    {!isPlayed ? (
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Not played yet
                      </p>
                    ) : (
                      <p className="text-[11px] font-mono text-slate-400 mt-0.5 truncate">
                        {gStats.rounds} {gStats.rounds === 1 ? 'round' : 'rounds'} · {winPct}% win rate
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {isPlayed && (
                      <span
                        className={`text-xs font-mono font-semibold tabular-nums ${
                          gStats.net > 0
                            ? 'text-emerald-400'
                            : gStats.net < 0
                            ? 'text-rose-400'
                            : 'text-slate-300'
                        }`}
                      >
                        {formatSignedCredits(gStats.net)}
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronUp size={15} className="text-slate-400" />
                    ) : (
                      <ChevronDown size={15} className="text-slate-500" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-3.5 pb-3.5 pt-2 bg-slate-900/40 border-t border-slate-800/60">
                    {!isPlayed ? (
                      <p className="text-xs text-slate-400 py-1">
                        Not played yet. Visit the Casino Floor to record your first round on {game.name}.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px]">
                        <div className="rounded-lg bg-slate-900/80 border border-slate-800/80 px-2.5 py-2">
                          <span className="text-slate-500 font-mono block text-[10px]">W / L / P</span>
                          <span className="font-mono font-semibold text-slate-200 tabular-nums">
                            {gStats.wins} / {gStats.losses} / {gStats.pushes}
                          </span>
                        </div>
                        <div className="rounded-lg bg-slate-900/80 border border-slate-800/80 px-2.5 py-2">
                          <span className="text-slate-500 font-mono block text-[10px]">Total Wagered</span>
                          <span className="font-mono font-semibold text-amber-200 tabular-nums">
                            {gStats.totalWagered.toLocaleString()} Cr
                          </span>
                        </div>
                        <div className="rounded-lg bg-slate-900/80 border border-slate-800/80 px-2.5 py-2">
                          <span className="text-slate-500 font-mono block text-[10px]">Total Returned</span>
                          <span className="font-mono font-semibold text-slate-200 tabular-nums">
                            {gStats.totalReturned.toLocaleString()} Cr
                          </span>
                        </div>
                        <div className="rounded-lg bg-slate-900/80 border border-slate-800/80 px-2.5 py-2">
                          <span className="text-slate-500 font-mono block text-[10px]">Net</span>
                          <span
                            className={`font-mono font-semibold tabular-nums ${
                              gStats.net > 0
                                ? 'text-emerald-400'
                                : gStats.net < 0
                                ? 'text-rose-400'
                                : 'text-slate-300'
                            }`}
                          >
                            {formatSignedCredits(gStats.net)}
                          </span>
                        </div>
                        <div className="rounded-lg bg-slate-900/80 border border-slate-800/80 px-2.5 py-2">
                          <span className="text-slate-500 font-mono block text-[10px]">Biggest Win</span>
                          <span className="font-mono font-semibold text-amber-300 tabular-nums">
                            {gStats.biggestWin.toLocaleString()} Cr
                          </span>
                        </div>
                        <div className="rounded-lg bg-slate-900/80 border border-slate-800/80 px-2.5 py-2">
                          <span className="text-slate-500 font-mono block text-[10px]">Top Multiplier</span>
                          <span className="font-mono font-semibold text-emerald-300 tabular-nums">
                            {gStats.biggestMultiplier > 0 ? `${gStats.biggestMultiplier}×` : '—'}
                          </span>
                        </div>
                        <div className="rounded-lg bg-slate-900/80 border border-slate-800/80 px-2.5 py-2">
                          <span className="text-slate-500 font-mono block text-[10px]">Streaks (Cur / Best)</span>
                          <span className="font-mono font-semibold text-slate-200 tabular-nums">
                            {gStats.currentWinStreak} / {gStats.bestWinStreak}
                          </span>
                        </div>
                        <div className="rounded-lg bg-slate-900/80 border border-slate-800/80 px-2.5 py-2">
                          <span className="text-slate-500 font-mono block text-[10px]">Last Played</span>
                          <span className="font-mono font-semibold text-slate-300 tabular-nums">
                            {formatRelativeTime(gStats.lastPlayedAt)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Recent Rounds Ledger ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <History size={14} className="text-slate-400" />
            <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Recent Rounds
            </h4>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            {roundHistory.length > 0
              ? `Showing ${visibleHistory.length} of ${roundHistory.length}`
              : '0 recorded'}
          </span>
        </div>

        {roundHistory.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-[#0b0f16] p-6 text-center text-xs text-slate-400">
            No rounds yet - hit the tables!
          </div>
        ) : (
          <div className="space-y-2">
            <div className="divide-y divide-slate-800/80 rounded-xl border border-slate-800 bg-[#0b0f16] overflow-hidden">
              {visibleHistory.map((record) => {
                const isWin = record.net > 0;
                const isPush = record.net === 0 && record.payout === record.bet;
                return (
                  <div
                    key={record.id}
                    className="px-3.5 py-3 flex items-start sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-semibold text-slate-100 truncate">
                          {record.gameName}
                        </span>
                        {record.recovered && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-[10px] font-mono font-medium text-amber-300">
                            Recovered
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-400">
                        {record.detail && (
                          <>
                            <span className="text-slate-300 truncate max-w-[200px] sm:max-w-xs">
                              {record.detail}
                            </span>
                            <span aria-hidden="true" className="text-slate-700">·</span>
                          </>
                        )}
                        <span className="inline-flex items-center gap-1 font-mono text-slate-500">
                          <Clock size={10} />
                          <span>{formatRelativeTime(record.timestamp)}</span>
                        </span>
                      </div>

                      <div className="text-[10px] font-mono text-slate-500 tabular-nums">
                        Bet {record.bet.toLocaleString()} Cr · Return {record.payout.toLocaleString()} Cr
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-xs sm:text-sm font-mono font-semibold tabular-nums block ${
                          isWin
                            ? 'text-emerald-400'
                            : isPush
                            ? 'text-slate-300'
                            : 'text-rose-400'
                        }`}
                      >
                        {formatSignedCredits(record.net)}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 tabular-nums block">
                        {record.multiplier > 0 ? `${record.multiplier}×` : '0×'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {roundHistory.length > INITIAL_HISTORY_VISIBLE && (
              <button
                type="button"
                onClick={() => {
                  soundManager.playClick();
                  setShowAllHistory((prev) => !prev);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 transition-colors min-h-[44px] cursor-pointer"
              >
                {showAllHistory
                  ? `Show fewer (${INITIAL_HISTORY_VISIBLE})`
                  : `Show more (${roundHistory.length - INITIAL_HISTORY_VISIBLE} older)`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Neutral Statistical Footnote ── */}
      <p className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-1.5">
        <Info size={13} className="text-slate-500 shrink-0" />
        <span>Results are random; past rounds don&apos;t affect future ones.</span>
      </p>
    </section>
  );
};
