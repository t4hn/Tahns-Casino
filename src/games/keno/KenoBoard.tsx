import React, { useMemo } from 'react';
import { Check } from 'lucide-react';
import { KENO_MAX_SPOTS, KENO_POOL_SIZE } from './kenoRules';
import { KenoPhase } from './kenoState';

interface KenoBoardProps {
  selectedNumbers: number[];
  revealedDrawnNumbers: number[];
  phase: KenoPhase;
  disabled: boolean;
  onToggleNumber: (num: number) => void;
}

const ALL_NUMBERS = Array.from({ length: KENO_POOL_SIZE }, (_, idx) => idx + 1);

export const KenoBoard: React.FC<KenoBoardProps> = ({
  selectedNumbers,
  revealedDrawnNumbers,
  phase,
  disabled,
  onToggleNumber,
}) => {
  const selectedSet = useMemo(() => new Set(selectedNumbers), [selectedNumbers]);
  const drawnSet = useMemo(() => new Set(revealedDrawnNumbers), [revealedDrawnNumbers]);
  const hasDrawResults = revealedDrawnNumbers.length > 0 || phase !== 'IDLE';
  const latestDrawn =
    revealedDrawnNumbers.length > 0
      ? revealedDrawnNumbers[revealedDrawnNumbers.length - 1]
      : null;

  return (
    <div className="space-y-3">
      {/* ── 8 x 10 Keno Board (Numbers 1–80) ── */}
      <div
        role="group"
        aria-label="Keno number selection grid 1 to 80"
        data-testid="keno-board-grid"
        className="grid grid-cols-10 gap-1 sm:gap-1.5"
      >
        {ALL_NUMBERS.map((num) => {
          const isSelected = selectedSet.has(num);
          const isDrawn = drawnSet.has(num);
          const isMatch = isSelected && isDrawn;
          const isLatestDrawn = latestDrawn === num && phase === 'DRAWING';
          const atLimit = selectedNumbers.length >= KENO_MAX_SPOTS && !isSelected;

          let stateLabel = 'unselected';
          if (isMatch) stateLabel = 'selected and drawn, match';
          else if (isSelected) stateLabel = 'selected';
          else if (isDrawn) stateLabel = 'drawn';

          let cellClasses =
            'bg-[#0d131d] border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white';

          if (isMatch) {
            cellClasses =
              'bg-gradient-to-br from-emerald-400 via-emerald-300 to-amber-300 border-amber-200 text-slate-950 font-extrabold shadow-[0_0_12px_rgba(251,191,36,0.45)] ring-1 ring-amber-200/80 scale-[1.03] z-10';
          } else if (isSelected && isDrawn === false) {
            cellClasses =
              'bg-emerald-600/30 border-emerald-400 text-emerald-100 ring-1 ring-emerald-400/50 font-bold shadow-[inset_0_1px_0_rgba(110,231,183,0.2)]';
          } else if (isDrawn) {
            cellClasses =
              'bg-amber-500/20 border-amber-400/85 text-amber-200 font-bold ring-1 ring-amber-400/35';
          } else if (hasDrawResults) {
            cellClasses =
              'bg-[#0b1018] border-slate-800/70 text-slate-500 hover:border-slate-700 hover:text-slate-300';
          }

          return (
            <button
              key={num}
              type="button"
              disabled={disabled}
              aria-label={`Number ${num}, ${stateLabel}`}
              aria-pressed={isSelected}
              data-state={
                isMatch ? 'match' : isSelected ? 'selected' : isDrawn ? 'drawn' : 'idle'
              }
              onClick={() => onToggleNumber(num)}
              className={`touch-manipulation relative h-10 sm:h-11 rounded-lg border font-mono text-xs sm:text-sm tabular-nums transition-all duration-150 flex items-center justify-center select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer disabled:cursor-not-allowed ${cellClasses} ${
                isLatestDrawn ? 'scale-105' : ''
              } ${atLimit && !disabled ? 'opacity-75' : ''}`}
            >
              <span>{num}</span>

              {/* Explicit non-hue state markers */}
              {isMatch && (
                <span
                  aria-hidden="true"
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-slate-950 border border-amber-300 text-amber-300 flex items-center justify-center"
                >
                  <Check size={8} strokeWidth={3} />
                </span>
              )}
              {!isMatch && isSelected && (
                <span
                  aria-hidden="true"
                  className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-300"
                />
              )}
              {!isMatch && isDrawn && (
                <span
                  aria-hidden="true"
                  className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-300"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Non-Hue State Legend ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-400">
        <div className="flex flex-wrap items-center gap-3.5">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-600/35 border border-emerald-400 inline-block" />
            <span>Selected</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-500/25 border border-amber-400 inline-block" />
            <span>Drawn</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-gradient-to-br from-emerald-400 to-amber-300 border border-amber-200 inline-block" />
            <span className="text-amber-200 font-medium">Matched (Win)</span>
          </span>
        </div>
        <span className="text-slate-500 font-mono">
          {selectedNumbers.length}/{KENO_MAX_SPOTS} spots
        </span>
      </div>
    </div>
  );
};
