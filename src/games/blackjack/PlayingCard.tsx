import React from 'react';
import {
  Card,
  formatCardAccessibleName,
  getSuitSymbol,
  isRedSuit,
} from './deck';

export interface PlayingCardProps {
  card: Card;
  hidden?: boolean;
  highlight?: boolean;
  animateDeal?: boolean;
  index?: number;
}

export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  hidden = false,
  highlight = false,
  animateDeal = true,
  index = 0,
}) => {
  const overlapClass = index > 0 ? '-ml-4 sm:-ml-3' : '';
  const animClass = animateDeal
    ? 'animate-in fade-in slide-in-from-top-3 duration-200'
    : '';

  if (hidden) {
    return (
      <div
        aria-label="Hidden dealer card"
        className={`relative w-[62px] h-[88px] sm:w-[76px] sm:h-[108px] rounded-lg sm:rounded-xl bg-gradient-to-br from-[#0e2d22] via-[#081d16] to-[#04110c] border border-amber-400/50 p-1.5 shadow-[0_6px_16px_rgba(0,0,0,0.65)] select-none shrink-0 transition-transform ${overlapClass} ${animClass}`}
      >
        {/* Outer ivory rim + inner gold lattice */}
        <div className="w-full h-full rounded-[6px] sm:rounded-[8px] border border-amber-300/40 bg-[#071913] relative overflow-hidden flex items-center justify-center">
          <svg
            aria-hidden="true"
            className="absolute inset-0 w-full h-full opacity-25"
            viewBox="0 0 60 90"
            preserveAspectRatio="none"
          >
            <defs>
              <pattern
                id="bjCardBackLattice"
                width="12"
                height="12"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M6 0 L12 6 L6 12 L0 6 Z"
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="0.8"
                />
              </pattern>
            </defs>
            <rect width="60" height="90" fill="url(#bjCardBackLattice)" />
          </svg>
          <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-amber-400/60 bg-[#0b261c]/90 flex items-center justify-center shadow-inner">
            <span className="text-amber-300 font-display font-bold text-xs sm:text-sm">
              T
            </span>
          </div>
        </div>
      </div>
    );
  }

  const red = isRedSuit(card.suit);
  const suitSymbol = getSuitSymbol(card.suit);
  const inkClass = red ? 'text-rose-600' : 'text-slate-900';
  const isFaceCard =
    card.rank === 'J' || card.rank === 'Q' || card.rank === 'K';
  const isAce = card.rank === 'A';

  return (
    <div
      aria-label={formatCardAccessibleName(card)}
      className={`relative w-[62px] h-[88px] sm:w-[76px] sm:h-[108px] rounded-lg sm:rounded-xl bg-gradient-to-br from-[#ffffff] via-[#f8fafc] to-[#e9eef5] border ${
        highlight
          ? 'border-amber-400 ring-2 ring-amber-400/80 shadow-[0_0_16px_rgba(251,191,36,0.4)]'
          : 'border-slate-300/90 shadow-[0_6px_16px_rgba(0,0,0,0.55)]'
      } select-none shrink-0 transition-transform ${overlapClass} ${animClass}`}
    >
      {/* Top-Left Corner Index (remains exposed when fanned) */}
      <div
        className={`absolute top-1 left-1.5 flex flex-col items-center leading-none ${inkClass}`}
      >
        <span className="font-sans font-bold text-[13px] sm:text-[15px] tracking-tighter">
          {card.rank}
        </span>
        <span className="text-[11px] sm:text-[13px] -mt-0.5">{suitSymbol}</span>
      </div>

      {/* Center Suit / Court Emblem */}
      <div className="w-full h-full flex items-center justify-center">
        {isFaceCard ? (
          <div
            className={`w-8 h-11 sm:w-10 sm:h-14 rounded border ${
              red ? 'border-rose-200 bg-rose-50/70' : 'border-slate-200 bg-slate-100/80'
            } flex flex-col items-center justify-center ${inkClass}`}
          >
            <span className="font-display font-bold text-base sm:text-xl leading-none">
              {card.rank}
            </span>
            <span className="text-xs sm:text-sm leading-none mt-0.5">
              {suitSymbol}
            </span>
          </div>
        ) : isAce ? (
          <span
            className={`text-2xl sm:text-3xl leading-none drop-shadow-xs ${inkClass}`}
          >
            {suitSymbol}
          </span>
        ) : (
          <span className={`text-xl sm:text-2xl leading-none opacity-85 ${inkClass}`}>
            {suitSymbol}
          </span>
        )}
      </div>

      {/* Bottom-Right Inverted Index */}
      <div
        aria-hidden="true"
        className={`absolute bottom-1 right-1.5 flex flex-col items-center leading-none rotate-180 ${inkClass}`}
      >
        <span className="font-sans font-bold text-[13px] sm:text-[15px] tracking-tighter">
          {card.rank}
        </span>
        <span className="text-[11px] sm:text-[13px] -mt-0.5">{suitSymbol}</span>
      </div>
    </div>
  );
};
