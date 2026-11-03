import React, { useState } from 'react';
import { X, Sparkles, Gift, Clock, Check, Calendar } from 'lucide-react';
import { useCasino } from '../context/CasinoContext';
import { CurrencyDisplay } from './CurrencyDisplay';
import { soundManager } from '../utils/sound';

export const DailyBonusModal: React.FC = () => {
  const {
    isDailyBonusModalOpen,
    closeDailyBonusModal,
    isDailyBonusAvailable,
    dailyBonusCountdown,
    claimDailyBonus,
    profile,
  } = useCasino();

  const [justClaimed, setJustClaimed] = useState(false);

  if (!isDailyBonusModalOpen) return null;

  const handleClaim = () => {
    const success = claimDailyBonus();
    if (success) {
      setJustClaimed(true);
      setTimeout(() => {
        setJustClaimed(false);
      }, 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-2xl bg-[#0f141d] border border-amber-500/30 p-6 shadow-2xl text-center overflow-hidden">
        {/* Ambient background glows */}
        <div className="pointer-events-none absolute -top-12 -left-12 h-32 w-32 rounded-full bg-amber-500/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 -right-12 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" />

        <button
          onClick={() => {
            soundManager.playClick();
            closeDailyBonusModal();
          }}
          aria-label="Close daily bonus modal"
          className="absolute top-3.5 right-3.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 text-slate-950 shadow-lg shadow-amber-500/20">
          <Gift size={32} strokeWidth={2} />
        </div>

        <h3 className="font-display text-xl font-bold text-slate-100">
          Daily Patron Allowance
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          Complimentary virtual credits awarded once every 24 hours.
        </p>

        {/* Reward presentation */}
        <div className="my-5 rounded-xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Calendar size={13} className="text-emerald-400" />
              <span>Consecutive Streak</span>
            </span>
            <span className="font-mono text-emerald-400 font-semibold">
              {profile && profile.dailyStreak > 0 ? `Day ${profile.dailyStreak}` : 'Day 1'}
            </span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
            <span className="text-xs text-slate-300">Allowance Value</span>
            <CurrencyDisplay amount={1000} size="sm" />
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Progression Reward</span>
            <span className="font-mono font-medium text-emerald-400">+200 XP</span>
          </div>
        </div>

        {justClaimed ? (
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-300 flex items-center justify-center gap-2 font-medium">
            <Check size={16} />
            <span>+1,000 Credits & +200 XP Added!</span>
          </div>
        ) : isDailyBonusAvailable ? (
          <button
            onClick={handleClaim}
            className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all min-h-[44px]"
          >
            <Sparkles size={16} />
            <span>Claim 1,000 Credits</span>
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-400">
              <Clock size={14} className="text-amber-400" />
              <span>Next allowance in:</span>
              <span className="text-amber-300 font-bold tabular-nums">{dailyBonusCountdown}</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Come back tomorrow for your next patron refill!
            </p>
          </div>
        )}

        <p className="mt-4 text-[10px] text-slate-500">
          Virtual game currency only. No real money value.
        </p>
      </div>
    </div>
  );
};
