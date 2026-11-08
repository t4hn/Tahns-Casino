import React, { useState } from 'react';
import { Play, Layers, Clock } from 'lucide-react';
import { GameItem } from '../types/casino';
import { useCasino } from '../context/CasinoContext';

interface GameCardProps {
  game: GameItem;
  featured?: boolean;
}

export const GameCard: React.FC<GameCardProps> = ({ game, featured = false }) => {
  const { openGame, profile } = useCasino();
  const [imageFailed, setImageFailed] = useState(false);

  const isAffordable = profile ? profile.credits >= game.minBet : true;
  const isPlayable = game.status === 'Table Open';

  const handlePlayClick = () => {
    openGame(game);
  };

  if (featured) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#131b26] to-[#0c1118] border border-emerald-500/30 p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col md:flex-row items-stretch gap-5">
          {/* Featured Image */}
          <div className="relative w-full md:w-3/5 aspect-video md:aspect-auto md:min-h-[220px] rounded-xl overflow-hidden border border-slate-800 bg-[#0a0d12]">
            {!imageFailed && game.imageUrl ? (
              <img
                src={game.imageUrl}
                alt={game.name}
                referrerPolicy="no-referrer"
                onError={() => setImageFailed(true)}
                className="w-full h-full object-cover transition-transform duration-500 hover:scale-103"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-emerald-950/40 to-slate-900 p-6 text-center">
                <Layers size={32} className="text-emerald-400 mb-2" />
                <span className="font-display font-bold text-slate-100">{game.name}</span>
              </div>
            )}
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0a0d12]/80 backdrop-blur-md border border-amber-500/30 text-amber-300 text-xs font-medium">
              <span>Featured Game</span>
            </div>
          </div>

          {/* Featured Content Details */}
          <div className="flex flex-col justify-between flex-1 py-1">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1.5">
                <span className="text-emerald-400 font-medium uppercase tracking-wider">{game.category}</span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span>RTP {game.payoutRate}</span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span>{game.volatility} Volatility</span>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold font-display text-slate-100 tracking-tight">
                {game.name}
              </h3>

              <p className="mt-2 text-xs sm:text-sm text-slate-300 line-clamp-3 leading-relaxed">
                {game.description}
              </p>

              <div className="mt-3.5 flex items-center gap-4 text-xs font-mono text-slate-400">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-sans">Min Wager</span>
                  <span className="text-amber-300 font-semibold">{game.minBet.toLocaleString()} Credits</span>
                </div>
                <div className="h-6 w-px bg-slate-800" />
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-sans">Max Wager</span>
                  <span className="text-amber-300 font-semibold">{game.maxBet.toLocaleString()} Credits</span>
                </div>
                {!isAffordable && (
                  <>
                    <div className="h-6 w-px bg-slate-800" />
                    <div className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-400/30 text-amber-400 font-sans text-[11px]">
                      Min bet {game.minBet.toLocaleString()}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={handlePlayClick}
                className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all min-h-[44px] cursor-pointer"
              >
                <Play size={15} fill="currentColor" />
                <span>Play Now</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-[#0f141d] border border-slate-800 hover:border-slate-700/80 transition-all duration-200 shadow-md hover:shadow-xl">
      {/* Thumbnail */}
      <div className="relative aspect-4/3 w-full overflow-hidden bg-[#090c10]">
        {!imageFailed && game.imageUrl ? (
          <img
            src={game.imageUrl}
            alt={game.name}
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-104"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950 p-4">
            <Layers size={28} className="text-slate-600 mb-2" />
            <span className="text-xs text-slate-400 font-medium">{game.name}</span>
          </div>
        )}

        {/* Category tag over image */}
        <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-[#0a0d12]/80 backdrop-blur-md border border-slate-800 text-[11px] font-medium text-slate-300">
          {game.category}
        </div>
      </div>

      {/* Card Content */}
      <div className="flex flex-col justify-between flex-1 p-4">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="text-base font-semibold text-slate-100 group-hover:text-emerald-400 transition-colors truncate">
              {game.name}
            </h4>
            <span className="font-mono text-[11px] text-slate-400 shrink-0 tabular-nums">
              RTP {game.payoutRate}
            </span>
          </div>

          <p className="mt-1.5 text-xs text-slate-400 line-clamp-2 leading-relaxed">
            {game.description}
          </p>

          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 font-mono pt-2.5 border-t border-slate-800/80">
            <div className="flex items-center gap-1.5 truncate mr-2">
              <span className={isPlayable ? 'text-emerald-400/90 font-medium' : 'text-slate-400'}>
                {game.status}
              </span>
              {!isAffordable && (
                <span className="text-[10px] text-amber-400/90 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-400/25 shrink-0 font-sans">
                  Min bet {game.minBet.toLocaleString()}
                </span>
              )}
            </div>
            <span className="shrink-0">Limits: {game.minBet}-{game.maxBet.toLocaleString()}</span>
          </div>
        </div>

        <div className="mt-4 pt-1">
          <button
            onClick={handlePlayClick}
            className={`w-full py-2.5 px-4 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all min-h-[44px] cursor-pointer ${
              isPlayable
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500 hover:text-slate-950 active:scale-[0.98]'
                : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-white active:scale-[0.98]'
            }`}
          >
            {isPlayable ? (
              <>
                <Play size={13} fill="currentColor" />
                <span>Play</span>
              </>
            ) : (
              <>
                <Clock size={13} className="text-amber-400/80" />
                <span>Coming Soon</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
