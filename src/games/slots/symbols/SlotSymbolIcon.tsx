import React from 'react';
import { SymbolId } from '../slotsConfig';

export interface SlotSymbolIconProps {
  symbol: SymbolId;
  isWinning?: boolean;
  className?: string;
}

/**
 * Custom vector artwork for slot symbols.
 * High contrast, emerald & gold casino palette, crisp at small mobile sizes.
 */
export const SlotSymbolIcon: React.FC<SlotSymbolIconProps> = ({
  symbol,
  isWinning = false,
  className = '',
}) => {
  switch (symbol) {
    case 'seven':
      return (
        <div className={`relative flex items-center justify-center select-none ${isWinning ? 'animate-pulse' : ''} ${className}`}>
          <svg viewBox="0 0 36 36" className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow-md" fill="none">
            <defs>
              <linearGradient id="sevenGold" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="45%" stopColor="#eab308" />
                <stop offset="100%" stopColor="#ca8a04" />
              </linearGradient>
            </defs>
            {/* 7 shape */}
            <path
              d="M7 6h22v5l-12 19h-6l10-16H7V6z"
              fill="url(#sevenGold)"
              stroke="#854d0e"
              strokeWidth="1.2"
            />
            {/* Inset highlight */}
            <path
              d="M9 8h17l-1 2.5-9.5 15.5h-2L23 11H9V8z"
              fill="#fef9c3"
              opacity="0.6"
            />
          </svg>
        </div>
      );

    case 'emerald':
      return (
        <div className={`relative flex items-center justify-center select-none ${isWinning ? 'animate-pulse' : ''} ${className}`}>
          <svg viewBox="0 0 36 36" className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow-md" fill="none">
            <defs>
              <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6ee7b7" />
                <stop offset="50%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#047857" />
              </linearGradient>
            </defs>
            {/* Gem octagon */}
            <polygon
              points="12,5 24,5 31,12 31,24 24,31 12,31 5,24 5,12"
              fill="url(#emeraldGrad)"
              stroke="#a7f3d0"
              strokeWidth="1"
            />
            {/* Inner table facet */}
            <polygon
              points="14,10 22,10 26,14 26,22 22,26 14,26 10,22 10,14"
              fill="#34d399"
              opacity="0.8"
            />
            {/* Center sparkle */}
            <circle cx="18" cy="18" r="3" fill="#ecfdf5" opacity="0.9" />
          </svg>
        </div>
      );

    case 'bar':
      return (
        <div className={`relative flex items-center justify-center select-none ${isWinning ? 'animate-pulse' : ''} ${className}`}>
          <div className="w-11 h-6 sm:w-14 sm:h-7 rounded-md bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700 border border-amber-200/80 shadow-md flex items-center justify-center">
            <span className="font-display font-black text-[10px] sm:text-xs tracking-widest text-slate-950 px-1 py-0.5">
              BAR
            </span>
          </div>
        </div>
      );

    case 'bell':
      return (
        <div className={`relative flex items-center justify-center select-none ${isWinning ? 'animate-pulse' : ''} ${className}`}>
          <svg viewBox="0 0 36 36" className="w-7 h-7 sm:w-9 sm:h-9 drop-shadow-md" fill="none">
            <defs>
              <linearGradient id="bellGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#b45309" />
              </linearGradient>
            </defs>
            {/* Bell top ring */}
            <circle cx="18" cy="6" r="2.5" fill="none" stroke="#fef08a" strokeWidth="1.5" />
            {/* Bell body */}
            <path
              d="M18 9c-5 0-7 4-8 10-1 4-3 5-4 6h24c-1-1-3-2-4-6-1-6-3-10-8-10z"
              fill="url(#bellGrad)"
              stroke="#78350f"
              strokeWidth="1"
            />
            {/* Bell rim */}
            <rect x="5" y="25" width="26" height="3" rx="1.5" fill="#fde047" stroke="#92400e" strokeWidth="0.8" />
            {/* Clapper */}
            <circle cx="18" cy="29" r="2" fill="#78350f" />
          </svg>
        </div>
      );

    case 'cherry':
      return (
        <div className={`relative flex items-center justify-center select-none ${isWinning ? 'animate-pulse' : ''} ${className}`}>
          <svg viewBox="0 0 36 36" className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow-md" fill="none">
            <defs>
              <radialGradient id="cherryRed" cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#fca5a5" />
                <stop offset="40%" stopColor="#ef4444" />
                <stop offset="100%" stopColor="#991b1b" />
              </radialGradient>
            </defs>
            {/* Twin stems */}
            <path d="M12 21 C12 12, 17 8, 22 5" stroke="#15803d" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M24 23 C22 14, 20 8, 22 5" stroke="#15803d" strokeWidth="1.8" strokeLinecap="round" />
            {/* Leaf */}
            <path d="M22 5 C26 3, 29 5, 28 8 C25 8, 23 7, 22 5" fill="#22c55e" stroke="#14532d" strokeWidth="0.8" />
            {/* Left cherry */}
            <circle cx="12" cy="23" r="5.5" fill="url(#cherryRed)" stroke="#7f1d1d" strokeWidth="1" />
            <ellipse cx="10.5" cy="21" rx="1.5" ry="1" fill="#fef2f2" opacity="0.8" />
            {/* Right cherry */}
            <circle cx="23" cy="25" r="5.5" fill="url(#cherryRed)" stroke="#7f1d1d" strokeWidth="1" />
            <ellipse cx="21.5" cy="23" rx="1.5" ry="1" fill="#fef2f2" opacity="0.8" />
          </svg>
        </div>
      );

    case 'blank':
    default:
      return (
        <div className={`relative flex items-center justify-center select-none opacity-40 ${className}`}>
          <div className="w-4 h-1 sm:w-6 sm:h-1.5 rounded-full bg-slate-700" />
        </div>
      );
  }
};
