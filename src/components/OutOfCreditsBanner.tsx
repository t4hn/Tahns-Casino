import React from 'react';
import { Sparkles, Clock } from 'lucide-react';
import { useCasino } from '../context/CasinoContext';
import { DailyBonusCountdown } from './DailyBonusCountdown';
import { soundManager } from '../utils/sound';

export const OutOfCreditsBanner: React.FC = () => {
  const {
    profile,
    games,
    isDailyBonusAvailable,
    openDailyBonusModal,
  } = useCasino();

  if (!profile) return null;

  const playableGames = games.filter((g) => g.hasPlayableModule);
  const lowestMinBet =
    playableGames.length > 0
      ? Math.min(...playableGames.map((g) => g.minBet))
      : 10;

  if (profile.credits >= lowestMinBet) {
    return null;
  }

  return (
    <div
      role="status"
      className="rounded-2xl border border-amber-500/35 bg-gradient-to-r from-amber-950/35 via-[#131822] to-[#0f141d] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md"
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 shrink-0">
          {isDailyBonusAvailable ? <Sparkles size={18} /> : <Clock size={18} />}
        </div>
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-medium text-amber-100 leading-relaxed">
            {isDailyBonusAvailable ? (
              'Your Daily Bonus is ready to claim.'
            ) : (
              <>
                You&apos;re out of credits. Your next Daily Bonus will be ready in{' '}
                <DailyBonusCountdown
                  lastDailyClaim={profile.lastDailyClaim}
                  showIcon={false}
                  className="font-mono font-semibold text-amber-300"
                />
                .
              </>
            )}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Tables start at {lowestMinBet.toLocaleString()} virtual credits.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          soundManager.playClick();
          openDailyBonusModal();
        }}
        className="self-start sm:self-center shrink-0 px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-semibold text-amber-200 transition-colors min-h-[44px] cursor-pointer"
      >
        {isDailyBonusAvailable ? 'Claim Daily Bonus' : 'View Daily Bonus'}
      </button>
    </div>
  );
};
