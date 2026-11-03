import React from 'react';
import {
  Gamepad2,
  Trophy,
  Sparkles,
  ArrowUpRight,
  Clock,
  ChevronRight,
  TrendingUp,
  Award,
  Zap,
} from 'lucide-react';
import { useCasino } from '../context/CasinoContext';
import { CharacterCard } from '../components/CharacterCard';
import { GameCard } from '../components/GameCard';
import { soundManager } from '../utils/sound';

export const HomeView: React.FC = () => {
  const {
    games,
    activities,
    setCurrentTab,
    openDailyBonusModal,
    isDailyBonusAvailable,
  } = useCasino();

  const featuredGame = games.find((g) => g.featured) || games[0];

  const formatActivityTime = (timestamp: number) => {
    const diffMs = Date.now() - timestamp;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) return 'Just now';
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'daily_bonus':
        return <Sparkles size={14} className="text-amber-400" />;
      case 'level_up':
        return <TrendingUp size={14} className="text-emerald-400" />;
      case 'achievement':
        return <Award size={14} className="text-amber-300" />;
      case 'wager_won':
        return <TrendingUp size={14} className="text-emerald-400" />;
      case 'wager_lost':
        return <Zap size={14} className="text-rose-400" />;
      case 'wager_placed':
        return <Zap size={14} className="text-slate-400" />;
      default:
        return <Zap size={14} className="text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* ── Home Hero / App Title ── */}
      <section className="relative pt-2 pb-1">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono tracking-wider uppercase mb-1">
              <span>Patron Lounge</span>
              <span aria-hidden="true" className="text-slate-700">/</span>
              <span>Floor Overview</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-bold font-display text-slate-100 tracking-tight">
              Tahn&apos;s Casino
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 max-w-sm">
            Experience high-stakes virtual table gaming, daily patron rewards, and level progression.
          </p>
        </div>
      </section>

      {/* ── Character Profile Card ── */}
      <section aria-label="Character Profile">
        <CharacterCard />
      </section>

      {/* ── Quick Access Buttons ── */}
      <section aria-label="Quick Access" className="grid grid-cols-3 gap-2.5 sm:gap-4">
        {/* Games Button */}
        <button
          onClick={() => {
            soundManager.playClick();
            setCurrentTab('games');
          }}
          className="group relative flex flex-col items-center justify-center p-3.5 sm:p-5 rounded-2xl bg-[#0f141d] border border-slate-800 hover:border-emerald-500/40 hover:bg-[#131b26] transition-all min-h-[76px] sm:min-h-[96px] text-center shadow-md active:scale-[0.98]"
        >
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-slate-900 border border-slate-700/60 text-slate-300 group-hover:text-emerald-400 group-hover:border-emerald-500/50 group-hover:bg-emerald-950/30 transition-all mb-2">
            <Gamepad2 size={20} />
          </div>
          <span className="text-xs sm:text-sm font-semibold text-slate-200 group-hover:text-white">
            Games
          </span>
          <span className="text-[10px] text-slate-500 hidden sm:block mt-0.5">
            4 Mini-Games Ready
          </span>
        </button>

        {/* Achievements Button */}
        <button
          onClick={() => {
            soundManager.playClick();
            setCurrentTab('achievements');
          }}
          className="group relative flex flex-col items-center justify-center p-3.5 sm:p-5 rounded-2xl bg-[#0f141d] border border-slate-800 hover:border-amber-500/40 hover:bg-[#161a22] transition-all min-h-[76px] sm:min-h-[96px] text-center shadow-md active:scale-[0.98]"
        >
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-slate-900 border border-slate-700/60 text-slate-300 group-hover:text-amber-400 group-hover:border-amber-500/50 group-hover:bg-amber-950/30 transition-all mb-2">
            <Trophy size={20} />
          </div>
          <span className="text-xs sm:text-sm font-semibold text-slate-200 group-hover:text-white">
            Achievements
          </span>
          <span className="text-[10px] text-slate-500 hidden sm:block mt-0.5">
            Claim Patron XP
          </span>
        </button>

        {/* Daily Bonus Button */}
        <button
          onClick={() => {
            soundManager.playClick();
            openDailyBonusModal();
          }}
          className={`group relative flex flex-col items-center justify-center p-3.5 sm:p-5 rounded-2xl border transition-all min-h-[76px] sm:min-h-[96px] text-center shadow-md active:scale-[0.98] ${
            isDailyBonusAvailable
              ? 'bg-gradient-to-b from-amber-950/30 to-[#121620] border-amber-500/40 hover:border-amber-400 ring-1 ring-amber-500/20'
              : 'bg-[#0f141d] border-slate-800 hover:border-slate-700 hover:bg-[#131b26]'
          }`}
        >
          <div
            className={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl border mb-2 transition-all ${
              isDailyBonusAvailable
                ? 'bg-amber-500/20 border-amber-400/60 text-amber-300 shadow-sm shadow-amber-500/30'
                : 'bg-slate-900 border-slate-700/60 text-slate-400 group-hover:text-amber-300'
            }`}
          >
            <Sparkles size={20} className={isDailyBonusAvailable ? 'animate-pulse' : ''} />
          </div>
          <span className="text-xs sm:text-sm font-semibold text-slate-200 group-hover:text-white">
            Daily Bonus
          </span>
          <span className="text-[10px] text-amber-400/90 hidden sm:block mt-0.5 font-mono">
            {isDailyBonusAvailable ? '+1,000 Cr Ready' : 'On Cooldown'}
          </span>
        </button>
      </section>

      {/* ── Featured Game Card ── */}
      <section aria-label="Featured Casino Game">
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
            <h2 className="text-lg font-bold font-display text-slate-100 whitespace-nowrap">
              Featured Table
            </h2>
            <span className="text-xs text-slate-500 whitespace-nowrap hidden xs:inline sm:inline">
              · Handpicked for your tier
            </span>
          </div>

          <button
            onClick={() => {
              soundManager.playClick();
              setCurrentTab('games');
            }}
            className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium transition-colors"
          >
            <span>View All</span>
            <ChevronRight size={14} />
          </button>
        </div>

        <GameCard game={featuredGame} featured={true} />
      </section>

      {/* ── Recent Activity Feed ── */}
      <section aria-label="Recent Activity" className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Clock size={14} className="text-slate-500" />
            <h3 className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">
              Recent Activity
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            Last {activities.length} entries
          </span>
        </div>

        <div className="rounded-2xl bg-[#0f141d] border border-slate-800/80 divide-y divide-slate-800/60 overflow-hidden shadow-md">
          {activities.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              No recent casino activity logged yet.
            </div>
          ) : (
            activities.slice(0, 5).map((act) => (
              <div
                key={act.id}
                className="flex items-center justify-between p-3.5 sm:p-4 hover:bg-slate-900/40 transition-colors gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 shrink-0">
                    {getActivityIcon(act.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-slate-200 truncate">
                      {act.title}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {act.description}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  {act.creditsDelta !== undefined && act.creditsDelta !== 0 && (
                    <span
                      className={`font-mono text-xs font-semibold block ${
                        act.creditsDelta > 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {act.creditsDelta > 0 ? '+' : '-'}
                      {Math.abs(act.creditsDelta).toLocaleString()} Cr
                    </span>
                  )}
                  <span className="text-[10px] text-slate-500 font-mono block">
                    {formatActivityTime(act.timestamp)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ── Virtual Currency Guarantee Note ── */}
      <footer className="pt-4 pb-2 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left text-[11px] text-slate-400">
        <div>
          <span>Tahn&apos;s Casino Entertainment Suite · 100% Virtual Currency System</span>
          <span className="hidden sm:inline mx-2">·</span>
          <span className="block sm:inline text-slate-400">No real money gambling or payouts</span>
        </div>
        <button
          onClick={() => {
            soundManager.playClick();
            setCurrentTab('settings');
          }}
          className="text-slate-400 hover:text-slate-300 underline underline-offset-2 flex items-center gap-1"
        >
          <span>Preferences</span>
          <ArrowUpRight size={12} />
        </button>
      </footer>
    </div>
  );
};
