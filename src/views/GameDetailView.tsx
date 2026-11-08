import React from 'react';
import { ArrowLeft, Clock, Shield, Sparkles, Layers, Info } from 'lucide-react';
import { useCasino } from '../context/CasinoContext';
import { CurrencyDisplay } from '../components/CurrencyDisplay';
import { gameRegistry } from '../games/registry';
import { soundManager } from '../utils/sound';

export const GameDetailView: React.FC = () => {
  const { activeGame, exitGame, profile, executeRound, placeBet, resolveRound, settings } = useCasino();

  if (!activeGame || !profile) return null;

  // Check if an interactive GameModule is registered
  const module = gameRegistry.getModule(activeGame.id);

  if (module?.component) {
    const GameComponent = module.component;
    return (
      <div className="space-y-3 sm:space-y-4 animate-in fade-in duration-200">
        <div className="flex items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
          <button
            onClick={() => {
              soundManager.playClick();
              exitGame();
            }}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors py-1.5 px-2.5 -ml-1 rounded-xl hover:bg-slate-800/60 min-h-[40px]"
          >
            <ArrowLeft size={16} />
            <span>Back to Casino Floor</span>
          </button>
        </div>

        <GameComponent
          balance={profile.credits}
          minBet={activeGame.minBet}
          maxBet={activeGame.maxBet}
          settle={(bet, payout) => executeRound(activeGame.id, activeGame.name, bet, payout)}
          placeBet={(bet) => placeBet(activeGame.id, activeGame.name, bet)}
          resolveRound={(bet, payout) => resolveRound(activeGame.id, activeGame.name, bet, payout)}
          animations={settings.animations !== false}
        />
      </div>
    );
  }

  // Clear, polished "Coming Soon" table view when no module is plugged in
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── Top Bar with Back Navigation & Live Balance ── */}
      <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <button
          onClick={() => {
            soundManager.playClick();
            exitGame();
          }}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors py-2 px-3 rounded-xl hover:bg-slate-800/60 min-h-[44px]"
        >
          <ArrowLeft size={16} />
          <span>Back to Casino Floor</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 uppercase font-mono hidden sm:inline">
            Patron Balance:
          </span>
          <CurrencyDisplay size="md" />
        </div>
      </div>

      {/* ── Game Hero Showcase ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#131b26] to-[#0c1118] border border-emerald-500/30 p-5 sm:p-7 shadow-2xl">
        <div className="flex flex-col lg:flex-row items-stretch gap-6">
          {/* Table Visual Artwork */}
          <div className="relative w-full lg:w-1/2 aspect-video lg:aspect-auto min-h-[240px] rounded-xl overflow-hidden border border-slate-800 bg-[#0a0d12]">
            <img
              src={activeGame.imageUrl}
              alt={activeGame.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-[#0a0d12]/85 backdrop-blur-md border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center gap-1.5">
              <Clock size={13} className="text-amber-400 animate-pulse" />
              <span>Coming Soon</span>
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

          {/* Table Specs & Coming Soon Status Panel */}
          <div className="flex flex-col justify-between flex-1 space-y-4">
            <div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {activeGame.description}
              </p>

              {/* Specs & Limits */}
              <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-center font-mono text-xs mt-3.5">
                <div>
                  <span className="text-[10px] uppercase font-sans text-slate-500 block">Target RTP</span>
                  <span className="text-emerald-400 font-semibold">{activeGame.payoutRate}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-sans text-slate-500 block">Min Table Bet</span>
                  <span className="text-amber-300 font-semibold">{activeGame.minBet} Cr</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-sans text-slate-500 block">Max Table Bet</span>
                  <span className="text-amber-300 font-semibold">{activeGame.maxBet.toLocaleString()} Cr</span>
                </div>
              </div>
            </div>

            {/* Coming Soon Notice Card */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-amber-500/30 space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                  <Sparkles size={18} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                    <span>Table Under Preparation</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      V2 Plug-in Ready
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    The croupiers and pit bosses at Tahn's Casino are currently calibrating the mechanics and odds for this table. Real interactive mini-games will be plugged into the casino floor in an upcoming release.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <button
                  onClick={() => {
                    soundManager.playClick();
                    exitGame();
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center justify-center gap-2 min-h-[42px]"
                >
                  <ArrowLeft size={14} />
                  <span>Explore Other Casino Salons</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <Layers size={13} className="text-slate-400 shrink-0" />
              <span>Plug-in Interface: <code className="text-slate-400">GameModule</code> with atomic <code className="text-emerald-400">settle(bet, payout)</code> economy binding.</span>
            </div>
          </div>
        </div>
      </div>

      {/* House Rules Note */}
      <div className="rounded-xl bg-[#0f141d] border border-slate-800 p-4 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-emerald-400 shrink-0" />
          <span>All games share your unified virtual patron bankroll with strict zero-overdraft guarantees.</span>
        </div>
        <button
          onClick={() => {
            soundManager.playClick();
            exitGame();
          }}
          className="text-slate-400 hover:text-white underline underline-offset-2 shrink-0"
        >
          Return to Games
        </button>
      </div>
    </div>
  );
};
