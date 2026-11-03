import React, { useState } from 'react';
import { ArrowLeft, Play, Sparkles, AlertCircle, Shield, CheckCircle2, RotateCcw } from 'lucide-react';
import { useCasino } from '../context/CasinoContext';
import { CurrencyDisplay } from '../components/CurrencyDisplay';
import { soundManager } from '../utils/sound';

export const GameDetailView: React.FC = () => {
  const { activeGame, exitGame, profile, playGameRound } = useCasino();
  const [betAmount, setBetAmount] = useState<number>(activeGame ? activeGame.minBet : 10);
  const [roundResult, setRoundResult] = useState<{
    won: boolean;
    winAmount: number;
    message: string;
  } | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);

  if (!activeGame || !profile) return null;

  const betPresets = [activeGame.minBet, 25, 50, 100, Math.min(250, activeGame.maxBet)].filter(
    (b, i, arr) => b <= activeGame.maxBet && b >= activeGame.minBet && arr.indexOf(b) === i
  );

  const canAfford = profile.credits >= betAmount;

  const handlePlayRound = () => {
    if (!canAfford || isSpinning) return;

    soundManager.playClick();
    setIsSpinning(true);
    setRoundResult(null);

    setTimeout(() => {
      setIsSpinning(false);
      const res = playGameRound(activeGame.id, betAmount);
      if (res.success) {
        setRoundResult({
          won: res.won,
          winAmount: res.winAmount,
          message: res.message,
        });
      }
    }, 600);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── Top Bar with Back Navigation & Live Balance ── */}
      <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <button
          onClick={exitGame}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors py-2 px-3 rounded-xl hover:bg-slate-800/60 min-h-[44px]"
        >
          <ArrowLeft size={16} />
          <span>Back to Casino Floor</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 uppercase font-mono hidden sm:inline">
            Table Bankroll:
          </span>
          <CurrencyDisplay size="md" />
        </div>
      </div>

      {/* ── Game Hero Stage ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#131b26] to-[#0c1118] border border-emerald-500/30 p-5 sm:p-7 shadow-2xl">
        <div className="flex flex-col lg:flex-row items-stretch gap-6">
          {/* Table Visual Graphic */}
          <div className="relative w-full lg:w-1/2 aspect-video lg:aspect-auto min-h-[220px] rounded-xl overflow-hidden border border-slate-800 bg-[#0a0d12]">
            <img
              src={activeGame.imageUrl}
              alt={activeGame.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-[#0a0d12]/80 backdrop-blur-md border border-emerald-500/30 text-emerald-400 text-xs font-medium">
              {activeGame.status}
            </div>

            <div className="absolute bottom-3 left-4 right-4">
              <span className="text-xs uppercase font-mono tracking-wider text-slate-300 block">
                {activeGame.category} Salon
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold font-display text-white">
                {activeGame.name}
              </h1>
            </div>
          </div>

          {/* Interactive Table Wager Console */}
          <div className="flex flex-col justify-between flex-1 space-y-4">
            <div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {activeGame.description}
              </p>

              {/* Specs & Odds */}
              <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-center font-mono text-xs mt-3.5">
                <div>
                  <span className="text-[10px] uppercase font-sans text-slate-500 block">Payout (RTP)</span>
                  <span className="text-emerald-400 font-semibold">{activeGame.payoutRate}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-sans text-slate-500 block">Min Wager</span>
                  <span className="text-amber-300 font-semibold">{activeGame.minBet} Cr</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-sans text-slate-500 block">Max Wager</span>
                  <span className="text-amber-300 font-semibold">{activeGame.maxBet.toLocaleString()} Cr</span>
                </div>
              </div>
            </div>

            {/* Wager Selection & Action */}
            <div className="pt-2 space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium uppercase font-mono">Select Wager</span>
                  <span className="font-mono text-amber-300 font-bold">{betAmount} Credits</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {betPresets.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => {
                        soundManager.playClick();
                        setBetAmount(amount);
                      }}
                      className={`px-3 py-1.5 rounded-lg font-mono text-xs font-semibold transition-all min-h-[36px] ${
                        betAmount === amount
                          ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 scale-102'
                          : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {amount} Cr
                    </button>
                  ))}
                </div>
              </div>

              {/* Play Round Button */}
              <div>
                <button
                  onClick={handlePlayRound}
                  disabled={!canAfford || isSpinning}
                  className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all min-h-[48px] ${
                    canAfford
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-slate-950 shadow-emerald-500/20 active:scale-[0.98] cursor-pointer'
                      : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
                  }`}
                >
                  {isSpinning ? (
                    <>
                      <Sparkles size={16} className="animate-spin text-slate-950" />
                      <span>Dealing Round...</span>
                    </>
                  ) : canAfford ? (
                    <>
                      <Play size={15} fill="currentColor" />
                      <span>Play Round ({betAmount} Credits)</span>
                    </>
                  ) : (
                    <span>Insufficient Credits ({betAmount} Required)</span>
                  )}
                </button>
              </div>

              {/* Round Result Feedback */}
              {roundResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 animate-in fade-in duration-200 ${
                    roundResult.won
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300'
                  }`}
                >
                  {roundResult.won ? (
                    <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                  ) : (
                    <RotateCcw size={18} className="text-slate-400 shrink-0" />
                  )}
                  <span className="font-medium">{roundResult.message}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* House Rules & Virtual Note */}
      <div className="rounded-xl bg-[#0f141d] border border-slate-800 p-4 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-emerald-400 shrink-0" />
          <span>All bets and winnings use your single unified virtual patron bankroll.</span>
        </div>
        <button
          onClick={exitGame}
          className="text-slate-400 hover:text-white underline underline-offset-2 shrink-0"
        >
          Return to All Games
        </button>
      </div>
    </div>
  );
};
