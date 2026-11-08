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

    case 'galaxy':
      return (
        <div className={`relative flex items-center justify-center select-none ${isWinning ? 'animate-pulse' : ''} ${className}`}>
          <svg viewBox="0 0 36 36" className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow-md" fill="none">
            <defs>
              <radialGradient id="galaxyCore" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="30%" stopColor="#f472b6" />
                <stop offset="70%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#3b0764" />
              </radialGradient>
              <linearGradient id="armCyan" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#c084fc" />
              </linearGradient>
            </defs>
            {/* Outer halo */}
            <circle cx="18" cy="18" r="14" fill="#a855f7" opacity="0.15" />
            {/* Spiral arms */}
            <path
              d="M18 18 C22 13, 29 14, 30 20 C31 25, 25 30, 20 31 C15 32, 9 27, 8 21 C7 14, 13 8, 19 6 C25 4, 32 8, 33 15"
              stroke="url(#armCyan)"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.85"
            />
            <path
              d="M18 18 C14 23, 7 22, 6 16 C5 11, 11 6, 16 5 C21 4, 27 9, 28 15 C29 22, 23 28, 17 30"
              stroke="#e879f9"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.75"
            />
            {/* Glowing core */}
            <circle cx="18" cy="18" r="5" fill="url(#galaxyCore)" />
            {/* Sparkling stars */}
            <circle cx="12" cy="10" r="1" fill="#ffffff" opacity="0.9" />
            <circle cx="26" cy="24" r="1.2" fill="#ffffff" opacity="0.9" />
            <circle cx="27" cy="11" r="0.8" fill="#bae6fd" />
            <circle cx="9" cy="25" r="0.8" fill="#fbcfe8" />
          </svg>
        </div>
      );

    case 'planet':
      return (
        <div className={`relative flex items-center justify-center select-none ${isWinning ? 'animate-pulse' : ''} ${className}`}>
          <svg viewBox="0 0 36 36" className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow-md" fill="none">
            <defs>
              <radialGradient id="planetBody" cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="40%" stopColor="#f59e0b" />
                <stop offset="85%" stopColor="#b45309" />
                <stop offset="100%" stopColor="#78350f" />
              </radialGradient>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef3c7" />
                <stop offset="50%" stopColor="#d97706" />
                <stop offset="100%" stopColor="#78350f" />
              </linearGradient>
            </defs>
            {/* Back ring segment */}
            <path
              d="M4 16 C8 10, 28 8, 32 15"
              stroke="url(#ringGrad)"
              strokeWidth="3.2"
              strokeLinecap="round"
              opacity="0.5"
            />
            {/* Planet sphere */}
            <circle cx="18" cy="18" r="9.5" fill="url(#planetBody)" stroke="#92400e" strokeWidth="1" />
            {/* Atmosphere surface band */}
            <path
              d="M9.5 15 C13 18, 23 18, 26.5 15"
              stroke="#fef08a"
              strokeWidth="1.2"
              fill="none"
              opacity="0.5"
            />
            <path
              d="M10 20 C14 23, 22 23, 26 20"
              stroke="#92400e"
              strokeWidth="1.2"
              fill="none"
              opacity="0.6"
            />
            {/* Front ring segment */}
            <path
              d="M32 15 C34 18, 30 24, 23 26 C15 28, 6 25, 4 20 C3 18, 5 16, 8 15"
              stroke="url(#ringGrad)"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            <path
              d="M31 16 C33 18, 29 23, 23 25 C16 27, 7 24, 5 20"
              stroke="#fef9c3"
              strokeWidth="1"
              strokeLinecap="round"
              opacity="0.7"
            />
          </svg>
        </div>
      );

    case 'rocket':
      return (
        <div className={`relative flex items-center justify-center select-none ${isWinning ? 'animate-pulse' : ''} ${className}`}>
          <svg viewBox="0 0 36 36" className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow-md" fill="none">
            <defs>
              <linearGradient id="rocketBody" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="40%" stopColor="#e2e8f0" />
                <stop offset="100%" stopColor="#94a3b8" />
              </linearGradient>
              <linearGradient id="exhaustFlame" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="50%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
            </defs>
            {/* Thruster exhaust flame */}
            <path
              d="M12 25 L8 33 L15 28 L17 34 L19 26 Z"
              fill="url(#exhaustFlame)"
              opacity="0.9"
            />
            {/* Left fin */}
            <path d="M12 20 L7 25 L13 26 Z" fill="#ef4444" stroke="#991b1b" strokeWidth="0.8" />
            {/* Right fin */}
            <path d="M22 17 L28 22 L22 24 Z" fill="#ef4444" stroke="#991b1b" strokeWidth="0.8" />
            {/* Fuselage / Rocket Hull */}
            <path
              d="M27 9 C27 9, 21 8, 16 13 C12 17, 11 22, 14 25 C17 28, 22 27, 26 23 C31 18, 30 12, 27 9 Z"
              fill="url(#rocketBody)"
              stroke="#475569"
              strokeWidth="1"
            />
            {/* Nosecone red cap */}
            <path
              d="M27 9 C25 10, 24 11, 23 12 C25 14, 27 16, 29 14 C29 12, 28 10, 27 9 Z"
              fill="#ef4444"
            />
            {/* Porthole */}
            <circle cx="20" cy="17" r="3.2" fill="#38bdf8" stroke="#0284c7" strokeWidth="1" />
            <circle cx="19" cy="16" r="1" fill="#ffffff" opacity="0.8" />
          </svg>
        </div>
      );

    case 'alien':
      return (
        <div className={`relative flex items-center justify-center select-none ${isWinning ? 'animate-pulse' : ''} ${className}`}>
          <svg viewBox="0 0 36 36" className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow-md" fill="none">
            <defs>
              <radialGradient id="alienGreen" cx="40%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#86efac" />
                <stop offset="50%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#15803d" />
              </radialGradient>
            </defs>
            {/* Antennae */}
            <path d="M14 11 L10 5" stroke="#16a34a" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="9" cy="4.5" r="2.2" fill="#4ade80" stroke="#15803d" strokeWidth="0.8" />
            <path d="M22 11 L26 5" stroke="#16a34a" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="27" cy="4.5" r="2.2" fill="#4ade80" stroke="#15803d" strokeWidth="0.8" />
            {/* Alien head (classic bulbous dome) */}
            <path
              d="M18 10 C10 10, 7 16, 9 23 C11 28, 14 31, 18 31 C22 31, 25 28, 27 23 C29 16, 26 10, 18 10 Z"
              fill="url(#alienGreen)"
              stroke="#14532d"
              strokeWidth="1.2"
            />
            {/* Large dark cosmic eyes */}
            <ellipse cx="13.5" cy="19.5" rx="3.5" ry="5" fill="#090d16" stroke="#022c22" strokeWidth="0.8" transform="rotate(-15 13.5 19.5)" />
            <ellipse cx="22.5" cy="19.5" rx="3.5" ry="5" fill="#090d16" stroke="#022c22" strokeWidth="0.8" transform="rotate(15 22.5 19.5)" />
            {/* Eye glints */}
            <circle cx="12.5" cy="17.5" r="1.2" fill="#a7f3d0" />
            <circle cx="21.5" cy="17.5" r="1.2" fill="#a7f3d0" />
            {/* Subtle smile */}
            <path d="M15.5 27 Q18 29 20.5 27" stroke="#14532d" strokeWidth="1" strokeLinecap="round" fill="none" />
          </svg>
        </div>
      );

    case 'moon':
      return (
        <div className={`relative flex items-center justify-center select-none ${isWinning ? 'animate-pulse' : ''} ${className}`}>
          <svg viewBox="0 0 36 36" className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow-md" fill="none">
            <defs>
              <linearGradient id="moonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="35%" stopColor="#bae6fd" />
                <stop offset="80%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>
            </defs>
            {/* Crescent moon shape */}
            <path
              d="M24 7 C15 7, 8 14, 8 23 C8 27.5, 10 30.5, 12 32 C9 29, 7 24, 7 19 C7 11, 14 5, 23 5 C25 5, 27 5.5, 29 6.5 C27.5 6.8, 25.5 7, 24 7 Z"
              fill="url(#moonGrad)"
              stroke="#0369a1"
              strokeWidth="1"
            />
            {/* Surface craters */}
            <circle cx="14" cy="15" r="1.8" fill="#0284c7" opacity="0.4" />
            <circle cx="12" cy="22" r="2.2" fill="#0284c7" opacity="0.4" />
            <circle cx="16" cy="27" r="1.4" fill="#0284c7" opacity="0.4" />
            {/* Sparkle star beside moon */}
            <path
              d="M26 15 L27 18 L30 19 L27 20 L26 23 L25 20 L22 19 L25 18 Z"
              fill="#fef08a"
              opacity="0.9"
            />
          </svg>
        </div>
      );

    case 'star':
      return (
        <div className={`relative flex items-center justify-center select-none ${isWinning ? 'animate-pulse' : ''} ${className}`}>
          <svg viewBox="0 0 36 36" className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow-md" fill="none">
            <defs>
              <radialGradient id="starGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="35%" stopColor="#fef08a" />
                <stop offset="75%" stopColor="#eab308" />
                <stop offset="100%" stopColor="#a16207" />
              </radialGradient>
            </defs>
            {/* Radiant glow backdrop */}
            <circle cx="18" cy="18" r="14" fill="#fef08a" opacity="0.15" />
            {/* 4-point radiant star crystal */}
            <path
              d="M18 4 L21 14 L31 18 L21 22 L18 32 L15 22 L5 18 L15 14 Z"
              fill="url(#starGlow)"
              stroke="#ca8a04"
              strokeWidth="1"
            />
            {/* Diagonal secondary facets */}
            <path
              d="M18 10 L20 15 L25 18 L20 21 L18 26 L16 21 L11 18 L16 15 Z"
              fill="#fef9c3"
              opacity="0.6"
            />
            {/* Core brilliance */}
            <circle cx="18" cy="18" r="2.5" fill="#ffffff" />
          </svg>
        </div>
      );

    case 'meteor':
      return (
        <div className={`relative flex items-center justify-center select-none ${isWinning ? 'animate-pulse' : ''} ${className}`}>
          <svg viewBox="0 0 36 36" className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow-md" fill="none">
            <defs>
              <linearGradient id="meteorTail" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ef4444" opacity="0" />
                <stop offset="40%" stopColor="#f97316" opacity="0.6" />
                <stop offset="80%" stopColor="#eab308" />
                <stop offset="100%" stopColor="#ffffff" />
              </linearGradient>
              <radialGradient id="rockCore" cx="40%" cy="40%" r="60%">
                <stop offset="0%" stopColor="#fb923c" />
                <stop offset="45%" stopColor="#9a3412" />
                <stop offset="100%" stopColor="#431407" />
              </radialGradient>
            </defs>
            {/* Fire trail */}
            <path
              d="M6 6 Q16 10 23 21 L20 24 Q10 16 6 6 Z"
              fill="url(#meteorTail)"
            />
            <path
              d="M9 5 Q17 12 21 21 L18 23 Q12 15 9 5 Z"
              fill="#fef08a"
              opacity="0.8"
            />
            {/* Craggy burning rock head */}
            <polygon
              points="21,17 26,17 30,22 28,28 22,29 18,25 17,20"
              fill="url(#rockCore)"
              stroke="#f97316"
              strokeWidth="1.2"
            />
            {/* Incandescent fiery highlights */}
            <circle cx="23" cy="22" r="1.5" fill="#ffedd5" />
            <circle cx="26" cy="24" r="1" fill="#fef08a" />
          </svg>
        </div>
      );

    case 'comet':
      return (
        <div className={`relative flex items-center justify-center select-none ${isWinning ? 'animate-pulse scale-105' : ''} ${className}`}>
          <svg viewBox="0 0 36 36" className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow-lg" fill="none">
            <defs>
              <linearGradient id="cometTail" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0284c7" opacity="0" />
                <stop offset="40%" stopColor="#06b6d4" opacity="0.5" />
                <stop offset="70%" stopColor="#2dd4bf" opacity="0.9" />
                <stop offset="100%" stopColor="#ffffff" />
              </linearGradient>
              <radialGradient id="cometHead" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="40%" stopColor="#67e8f9" />
                <stop offset="80%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#0e7490" />
              </radialGradient>
            </defs>
            {/* Blazing stardust ion tail */}
            <path
              d="M5 8 C12 12, 18 16, 24 23 C20 25, 15 22, 5 8 Z"
              fill="url(#cometTail)"
            />
            {/* Inner stream */}
            <path
              d="M8 7 L24 23 L18 25 L6 10 Z"
              fill="#cffafe"
              opacity="0.75"
            />
            {/* Sparkling ice head */}
            <circle cx="24" cy="23" r="6" fill="url(#cometHead)" stroke="#a5f3fc" strokeWidth="1" />
            <circle cx="23" cy="22" r="2.2" fill="#ffffff" />
            {/* Prominent "WILD" badge pill */}
            <g transform="translate(14, 26)">
              <rect
                x="-12"
                y="-3"
                width="24"
                height="8.5"
                rx="4"
                fill="#042f2e"
                stroke="#2dd4bf"
                strokeWidth="0.8"
                className="drop-shadow"
              />
              <text
                x="0"
                y="3.2"
                textAnchor="middle"
                fontSize="6"
                fontWeight="900"
                fontFamily="system-ui, sans-serif"
                fill="#5eead4"
                letterSpacing="0.5"
              >
                WILD
              </text>
            </g>
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
