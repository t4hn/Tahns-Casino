import React, { useState } from 'react';
import { ShieldCheck, Edit3, Sparkles } from 'lucide-react';
import { useCasino } from '../context/CasinoContext';
import { CurrencyDisplay } from './CurrencyDisplay';
import { EditProfileModal } from './EditProfileModal';
import { soundManager } from '../utils/sound';

interface CharacterCardProps {
  onBonusClick?: () => void;
  className?: string;
}

export const CharacterCard: React.FC<CharacterCardProps> = ({ className = '' }) => {
  const { profile, levelInfo, isDailyBonusAvailable, openDailyBonusModal } = useCasino();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  if (!profile) return null;

  return (
    <>
      <div
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#131922] to-[#0d1219] border border-slate-800/80 p-5 shadow-xl ${className}`}
      >
        {/* Subtle decorative emerald ambient glow */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-amber-500/5 blur-3xl" />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Avatar & Patron Details */}
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="h-16 w-16 sm:h-18 sm:w-18 rounded-xl overflow-hidden border-2 border-emerald-500/40 bg-[#0a0d12] shadow-md shadow-emerald-950/20">
                {!imageError && profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.name}
                    referrerPolicy="no-referrer"
                    onError={() => setImageError(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#121c24] to-[#081017] text-emerald-400 font-display text-xl font-bold">
                    {profile.name.charAt(0)}
                  </div>
                )}
              </div>
              {/* Level badge overlapping avatar corner */}
              <div className="absolute -bottom-1.5 -right-1.5 flex h-6 items-center justify-center rounded-md bg-emerald-600 px-1.5 border border-emerald-400/50 shadow-sm text-[11px] font-mono font-bold text-slate-950">
                LV.{levelInfo.level}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-semibold text-slate-100 truncate tracking-tight">
                  {profile.name}
                </h2>
                <button
                  onClick={() => {
                    soundManager.playClick();
                    setIsEditOpen(true);
                  }}
                  title="Edit patron profile"
                  className="min-h-[32px] min-w-[32px] p-1 text-slate-500 hover:text-slate-300 transition-colors inline-flex items-center justify-center rounded-md hover:bg-slate-800/60"
                >
                  <Edit3 size={14} />
                </button>
              </div>

              {/* Status and Tier (unboxed metadata) */}
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <ShieldCheck size={13} className="text-emerald-400 inline" />
                  {levelInfo.title}
                </span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span>{profile.dailyStreak > 0 ? `Day ${profile.dailyStreak} Streak` : 'New Patron'}</span>
              </div>

              {/* Mobile Balance Quickview */}
              <div className="mt-2 block sm:hidden">
                <CurrencyDisplay size="sm" onClick={openDailyBonusModal} />
              </div>
            </div>
          </div>

          {/* Desktop Balance & Action */}
          <div className="hidden sm:flex flex-col items-end gap-2 shrink-0">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
              Virtual Credit Balance
            </span>
            <CurrencyDisplay size="lg" onClick={openDailyBonusModal} />
            {isDailyBonusAvailable && (
              <button
                onClick={openDailyBonusModal}
                className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <Sparkles size={12} className="text-emerald-400 animate-pulse" />
                <span className="underline decoration-emerald-500/50 underline-offset-2">Daily Bonus Ready</span>
              </button>
            )}
          </div>
        </div>

        {/* XP Progression Section */}
        <div className="mt-4 pt-3.5 border-t border-slate-800/60">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <div className="flex items-center gap-1.5 text-slate-300 font-medium">
              <span>Progression to Level {levelInfo.level + 1}</span>
            </div>
            <div className="font-mono text-slate-400 tabular-nums">
              <span className="text-emerald-400 font-semibold">{levelInfo.currentLevelXp.toLocaleString()}</span>
              <span className="text-slate-600 mx-1">/</span>
              <span>{levelInfo.nextLevelTargetXp.toLocaleString()} XP</span>
              <span className="text-slate-500 ml-1.5 text-[11px]">({Math.round(levelInfo.progressPercent)}%)</span>
            </div>
          </div>

          {/* Clean XP Progress Bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-900/90 border border-slate-800/80 p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500 ease-out shadow-xs shadow-emerald-500/30"
              style={{ width: `${levelInfo.progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <EditProfileModal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} />
    </>
  );
};
