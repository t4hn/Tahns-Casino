import React, { useMemo } from 'react';
import { KENO_DRAW_COUNT } from './kenoRules';
import { KenoPhase } from './kenoState';
import { KenoIcon } from './KenoIcon';

interface KenoDrawChamberProps {
  drawnSequence: number[];
  revealedCount: number;
  selectedNumbers: number[];
  phase: KenoPhase;
}

export const KenoDrawChamber: React.FC<KenoDrawChamberProps> = ({
  drawnSequence,
  revealedCount,
  selectedNumbers,
  phase,
}) => {
  const selectedSet = useMemo(() => new Set(selectedNumbers), [selectedNumbers]);
  const revealedBalls = useMemo(
    () => drawnSequence.slice(0, revealedCount),
    [drawnSequence, revealedCount]
  );

  const latestBall =
    revealedBalls.length > 0 ? revealedBalls[revealedBalls.length - 1] : null;
  const latestIsHit = latestBall !== null && selectedSet.has(latestBall);

  const revealedMatchesCount = useMemo(
    () => revealedBalls.filter((n) => selectedSet.has(n)).length,
    [revealedBalls, selectedSet]
  );

  return (
    <div
      data-testid="keno-draw-chamber"
      className="rounded-2xl bg-gradient-to-b from-[#121924] to-[#0c1118] border border-slate-800/90 p-4 space-y-3.5 shadow-xl"
    >
      {/* Chamber Header & Draw Counter */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <KenoIcon size={20} />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
            Draw Chamber
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs tabular-nums">
          <span className="text-slate-500">Drawn</span>
          <span
            data-testid="keno-draw-counter"
            className="text-amber-300 font-bold"
          >
            {revealedCount}/{KENO_DRAW_COUNT}
          </span>
        </div>
      </div>

      {/* Live Spotlight Sphere */}
      <div className="flex items-center justify-between gap-3 rounded-xl bg-[#090d14] border border-slate-800/90 px-3.5 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            aria-live="polite"
            data-testid="keno-spotlight-ball"
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full shrink-0 flex items-center justify-center font-mono text-lg sm:text-xl font-extrabold tabular-nums border-2 transition-transform duration-200 ${
              latestBall === null
                ? 'bg-slate-900 border-slate-700 text-slate-500'
                : latestIsHit
                ? 'bg-gradient-to-br from-emerald-300 via-emerald-400 to-amber-300 border-amber-200 text-slate-950 shadow-[0_0_16px_rgba(251,191,36,0.4)] scale-105'
                : 'bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 border-amber-100 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.28)]'
            }`}
          >
            {latestBall ?? '--'}
          </div>

          <div className="min-w-0">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block">
              {phase === 'DRAWING'
                ? latestIsHit
                  ? 'Matched Selection'
                  : 'Ball Drawn'
                : phase === 'SETTLED'
                ? 'Draw Complete'
                : 'Awaiting Ticket'}
            </span>
            <p className="text-xs sm:text-sm font-semibold text-slate-100 truncate">
              {latestBall === null
                ? 'Select 1–10 spots to begin'
                : latestIsHit
                ? `Ball #${latestBall} hits your ticket!`
                : `Ball #${latestBall} drawn`}
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className="text-[10px] font-mono uppercase text-slate-500 block">
            Hits
          </span>
          <span
            data-testid="keno-live-hits"
            className={`font-mono text-base font-bold tabular-nums ${
              revealedMatchesCount > 0 ? 'text-emerald-400' : 'text-slate-300'
            }`}
          >
            {revealedMatchesCount}
          </span>
        </div>
      </div>

      {/* 20-Ball Sequential Dispenser Tray */}
      <div
        aria-label="20 drawn Keno numbers"
        data-testid="keno-drawn-tray"
        className="grid grid-cols-10 lg:grid-cols-5 gap-1.5"
      >
        {Array.from({ length: KENO_DRAW_COUNT }).map((_, idx) => {
          const ball = revealedBalls[idx];
          const isRevealed = ball !== undefined;
          const isHit = isRevealed && selectedSet.has(ball);
          const isNewest = isRevealed && idx === revealedBalls.length - 1 && phase === 'DRAWING';

          return (
            <div
              key={idx}
              className={`h-8 rounded-full flex items-center justify-center font-mono text-[11px] font-bold tabular-nums border transition-all duration-150 ${
                !isRevealed
                  ? 'bg-[#0b1017] border-slate-800/70 text-slate-700'
                  : isHit
                  ? 'bg-gradient-to-br from-emerald-400 to-amber-300 border-amber-200 text-slate-950 shadow-sm'
                  : 'bg-[#171f2e] border-amber-500/45 text-amber-200'
              } ${isNewest ? 'scale-110 ring-2 ring-amber-300/70' : ''}`}
            >
              {isRevealed ? ball : '·'}
            </div>
          );
        })}
      </div>
    </div>
  );
};
