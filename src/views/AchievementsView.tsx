import React, { useState } from 'react';
import {
  Trophy,
  Award,
  CalendarCheck,
  Zap,
  Compass,
  Coins,
  Crown,
  CheckCircle2,
  Lock,
  Gift,
} from 'lucide-react';
import { useCasino } from '../context/CasinoContext';
import { CurrencyDisplay } from '../components/CurrencyDisplay';
import { soundManager } from '../utils/sound';

export const AchievementsView: React.FC = () => {
  const { achievements, claimAchievement } = useCasino();
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');

  const getAchievementIcon = (name: string) => {
    switch (name) {
      case 'CalendarCheck':
        return <CalendarCheck size={18} />;
      case 'Zap':
        return <Zap size={18} />;
      case 'Compass':
        return <Compass size={18} />;
      case 'Coins':
        return <Coins size={18} />;
      case 'Crown':
        return <Crown size={18} />;
      default:
        return <Award size={18} />;
    }
  };

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const claimedCount = achievements.filter((a) => a.claimed).length;

  const filteredAchievements = achievements.filter((ach) => {
    if (filter === 'unlocked') return ach.unlocked;
    if (filter === 'locked') return !ach.unlocked;
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ── Achievements Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pt-2">
        <div>
          <div className="flex items-center gap-2 text-xs text-amber-400 font-mono tracking-wider uppercase mb-1">
            <Trophy size={14} />
            <span>Patron Honors</span>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <span>{unlockedCount} of {achievements.length} Unlocked</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-slate-100">
            Patron Achievements
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Complete milestones to earn virtual patron credits and XP ranking boosts.
          </p>
        </div>

        {/* Stats Summary */}
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs shrink-0">
          <div>
            <span className="text-[10px] text-slate-500 uppercase block font-mono">Claimed</span>
            <span className="text-emerald-400 font-bold font-mono">{claimedCount} / {achievements.length}</span>
          </div>
          <div className="h-6 w-px bg-slate-800" />
          <div>
            <span className="text-[10px] text-slate-500 uppercase block font-mono">Completed</span>
            <span className="text-amber-300 font-bold font-mono">{unlockedCount} Unlocked</span>
          </div>
        </div>
      </div>

      {/* ── Filter Tabs ── */}
      <div className="flex items-center gap-1.5 p-1 bg-[#0f141d] border border-slate-800 rounded-xl w-fit">
        <button
          onClick={() => {
            soundManager.playClick();
            setFilter('all');
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all min-h-[36px] ${
            filter === 'all'
              ? 'bg-slate-800 text-white font-semibold shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          All ({achievements.length})
        </button>
        <button
          onClick={() => {
            soundManager.playClick();
            setFilter('unlocked');
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all min-h-[36px] ${
            filter === 'unlocked'
              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 font-semibold shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Completed ({unlockedCount})
        </button>
        <button
          onClick={() => {
            soundManager.playClick();
            setFilter('locked');
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all min-h-[36px] ${
            filter === 'locked'
              ? 'bg-slate-800 text-slate-300 font-semibold shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          In Progress ({achievements.length - unlockedCount})
        </button>
      </div>

      {/* ── Achievements List ── */}
      <div className="space-y-3">
        {filteredAchievements.map((ach) => {
          const isReadyToClaim = ach.unlocked && !ach.claimed;
          const isClaimed = ach.claimed;
          const isLocked = !ach.unlocked;
          const progressPercent = Math.min(100, Math.round((ach.progress / ach.maxProgress) * 100));

          return (
            <div
              key={ach.id}
              className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 transition-all ${
                isReadyToClaim
                  ? 'bg-gradient-to-r from-[#141d24] to-[#0f151e] border-amber-500/40 shadow-lg shadow-amber-950/20 ring-1 ring-amber-500/20'
                  : isClaimed
                  ? 'bg-[#0c1017] border-slate-800/80'
                  : 'bg-[#0f141d] border-slate-800'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Icon & Details */}
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl shrink-0 mt-0.5 border ${
                      isReadyToClaim
                        ? 'bg-gradient-to-tr from-amber-600 to-amber-400 text-slate-950 border-amber-300 shadow-md shadow-amber-500/20'
                        : isClaimed
                        ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30'
                        : 'bg-slate-900 text-slate-500 border-slate-800'
                    }`}
                  >
                    {isLocked ? <Lock size={18} /> : getAchievementIcon(ach.iconName)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm sm:text-base font-semibold text-slate-100 truncate">
                        {ach.title}
                      </h3>
                      {isClaimed && (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                          <CheckCircle2 size={13} />
                          <span>Claimed</span>
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                      {ach.description}
                    </p>

                    {/* Progress Bar (if in progress or completed) */}
                    <div className="mt-3 max-w-md">
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
                        <span>Progress</span>
                        <span>
                          {ach.progress.toLocaleString()} / {ach.maxProgress.toLocaleString()} ({progressPercent}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-900 border border-slate-800">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            ach.unlocked
                              ? 'bg-emerald-400'
                              : 'bg-gradient-to-r from-amber-500/60 to-amber-400'
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rewards & Action */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80 shrink-0">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 block">
                      Reward
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <CurrencyDisplay amount={ach.rewardCredits} size="sm" showLabel={false} />
                      <span className="text-xs font-mono font-medium text-emerald-400">
                        +{ach.rewardXp} XP
                      </span>
                    </div>
                  </div>

                  {isReadyToClaim ? (
                    <button
                      onClick={() => claimAchievement(ach.id)}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-[0.98] transition-all min-h-[44px]"
                    >
                      <Gift size={14} />
                      <span>Claim</span>
                    </button>
                  ) : isClaimed ? (
                    <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-500 font-mono">
                      Completed
                    </div>
                  ) : (
                    <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-400 font-mono flex items-center gap-1">
                      <Lock size={12} />
                      <span>In Progress</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
