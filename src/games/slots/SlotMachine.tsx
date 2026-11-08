import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GameProps, RoundResult } from '../../types/casino';
import {
  SlotsConfig,
  getStopsPerReel,
} from './slotsConfig';
import {
  evaluateSpin,
  getWindow,
  calculateRtp,
  calculateHitStats,
  SpinEvaluation,
} from './slotsRules';
import { SlotSymbolIcon } from './symbols/SlotSymbolIcon';
import { randomInt } from '../shared/rng';
import { isValidBet } from '../shared/betValidation';
import { soundManager } from '../../utils/sound';
import {
  Sparkles,
  ChevronDown,
  TrendingUp,
  CircleDot,
} from 'lucide-react';

const CHIP_PRESETS = [10, 20, 50, 100, 250];

export interface SlotMachineProps extends GameProps {
  config: SlotsConfig;
}

export const SlotMachine: React.FC<SlotMachineProps> = ({
  balance,
  minBet,
  maxBet,
  placeBet,
  resolveRound,
  animations,
  config,
}) => {
  const numReels = config.reelStrips.length;
  const stopsLengths = useMemo(() => getStopsPerReel(config), [config]);

  const [wager, setWager] = useState<number>(() =>
    Math.floor(Math.max(minBet, Math.min(50, maxBet, balance)) / 10) * 10
  );

  // Initial neutral stops [4, 2, 3, ...] (blanks on center payline if available)
  const [stops, setStops] = useState<number[]>(() => {
    return Array.from({ length: numReels }, (_, i) => {
      const defaultStops = [4, 2, 3];
      const fallback = defaultStops[i % defaultStops.length];
      return Math.min(fallback, (stopsLengths[i] || 20) - 1);
    });
  });

  const [reelSpinning, setReelSpinning] = useState<boolean[]>(() =>
    new Array(numReels).fill(false)
  );
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<SpinEvaluation | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Double-tap ref guard and escrow unmount resolution ref
  const spinningRef = useRef<boolean>(false);
  const pendingResolutionRef = useRef<{
    wager: number;
    payout: number;
    spinEval: SpinEvaluation;
  } | null>(null);
  const intervalsRef = useRef<number[]>([]);
  const timeoutsRef = useRef<number[]>([]);

  // Cleanup timers on unmount and resolve any pending escrow spin immediately
  useEffect(() => {
    return () => {
      intervalsRef.current.forEach(clearInterval);
      timeoutsRef.current.forEach(clearTimeout);

      // If the component unmounts mid-spin, resolve immediately with the already-decided payout
      if (pendingResolutionRef.current) {
        const { wager: pendingWager, payout: pendingPayout } = pendingResolutionRef.current;
        pendingResolutionRef.current = null;
        resolveRound(pendingWager, pendingPayout);
      }
    };
  }, [resolveRound]);

  // Clamp wager if balance changes, rounded down to multiple of 10
  useEffect(() => {
    if (balance > 0 && wager > balance) {
      setWager(Math.floor(Math.max(minBet, balance) / 10) * 10);
    }
  }, [balance, minBet, wager]);

  // Derived theoretical RTP for paytable display
  const rtpPercent = useMemo(() => {
    return (calculateRtp(config) * 100).toFixed(1);
  }, [config]);

  // Dynamic hit stats calculated directly from config
  const hitStats = useMemo(() => {
    return calculateHitStats(config);
  }, [config]);

  // Derive visible window symbols from current stops
  const currentWindow = useMemo(() => {
    return getWindow(stops, config);
  }, [stops, config]);

  const handleSelectChip = (amount: number) => {
    if (isSpinning || spinningRef.current) return;
    soundManager.playClick();
    const clamped = Math.floor(Math.max(minBet, Math.min(amount, maxBet, balance)) / 10) * 10;
    setWager(clamped);
    setErrorMsg(null);
  };

  const adjustWager = (delta: number) => {
    if (isSpinning || spinningRef.current) return;
    soundManager.playClick();
    const raw = Math.max(minBet, Math.min(wager + delta, maxBet, balance));
    const newBet = Math.floor(raw / 10) * 10;
    setWager(newBet);
    setErrorMsg(null);
  };

  const handleSpin = () => {
    // 1. Guard against double-tap or active spinning
    if (spinningRef.current || isSpinning) return;

    // 2. Validate bet against bankroll and limits (steps of 10 enforced)
    const validation = isValidBet(wager, minBet, maxBet, balance);
    if (!validation.valid) {
      soundManager.playLocked();
      setErrorMsg(validation.reason || 'Invalid wager.');
      return;
    }

    // 3. Compute full outcome BEFORE any animation (no engineered near-misses)
    const nextStops: number[] = stopsLengths.map((len) => randomInt(len));
    const spinEval = evaluateSpin(nextStops, wager, config);

    // 4. Atomically deduct wager into escrow and persist pending round with decided payout
    const betResult = placeBet(wager, spinEval.payout);
    if (!betResult.success) {
      soundManager.playLocked();
      setErrorMsg(betResult.error || 'Failed to place wager.');
      return;
    }

    // 5. Mark spinning state atomically
    spinningRef.current = true;
    setIsSpinning(true);
    setErrorMsg(null);
    setLastResult(null); // Clear previous result at start of new spin
    soundManager.playClick();

    // Store pending resolution in ref for safe resolution on unmount
    pendingResolutionRef.current = {
      wager,
      payout: spinEval.payout,
      spinEval,
    };

    // 6. Check if animations are enabled
    const useAnimation = animations !== false;

    if (!useAnimation) {
      // Instant settlement
      setStops(nextStops);
      setReelSpinning(new Array(numReels).fill(false));

      pendingResolutionRef.current = null;
      const roundRes: RoundResult = resolveRound(wager, spinEval.payout);

      if (!roundRes.success) {
        setErrorMsg(roundRes.error || 'Failed to resolve spin round.');
      } else {
        if (spinEval.won) {
          soundManager.playCoin();
        }
        setLastResult(spinEval);
      }

      setIsSpinning(false);
      spinningRef.current = false;
      return;
    }

    // 7. Sequential animated reel spin (stopping left-to-right: ~600ms, ~900ms, ~1200ms...)
    setReelSpinning(new Array(numReels).fill(true));

    // Cycling intervals for all reels while spinning
    const intervals: number[] = [];
    for (let r = 0; r < numReels; r++) {
      const intervalId = window.setInterval(() => {
        setStops((prev) => {
          const updated = [...prev];
          const reelLen = stopsLengths[r] || 20;
          updated[r] = (updated[r] + 1) % reelLen;
          return updated;
        });
      }, 55);
      intervals.push(intervalId);
    }
    intervalsRef.current = intervals;

    const baseDelay = 600;
    const stepDelay = 300;

    stopsLengths.forEach((_, reelIdx) => {
      const delay = baseDelay + reelIdx * stepDelay;
      const timeoutId = window.setTimeout(() => {
        // Stop reel interval
        if (intervalsRef.current[reelIdx]) {
          clearInterval(intervalsRef.current[reelIdx]);
        }

        // Lock reel to predetermined stop
        setStops((prev) => {
          const updated = [...prev];
          updated[reelIdx] = nextStops[reelIdx];
          return updated;
        });

        setReelSpinning((prev) => {
          const updated = [...prev];
          updated[reelIdx] = false;
          return updated;
        });

        // Click / tick sound on reel lock
        soundManager.playClick();

        // When the final reel stops, resolve round exactly once
        if (reelIdx === numReels - 1) {
          const pending = pendingResolutionRef.current;
          if (pending) {
            pendingResolutionRef.current = null;
            const roundRes: RoundResult = resolveRound(pending.wager, pending.payout);

            if (!roundRes.success) {
              setErrorMsg(roundRes.error || 'Failed to resolve spin round.');
            } else {
              if (pending.spinEval.won) {
                soundManager.playCoin();
              }
              setLastResult(pending.spinEval);
            }
          }

          setIsSpinning(false);
          spinningRef.current = false;
        }
      }, delay);

      timeoutsRef.current.push(timeoutId);
    });
  };

  const winningLine = lastResult?.lines[0];

  return (
    <div className="w-full max-w-lg mx-auto space-y-3.5 pb-6">
      {/* ── Sticky Top Panel: Reel Window + Result Strip + Spin Button ── */}
      <div className="sticky top-16 z-30 overflow-hidden rounded-2xl bg-[#0c121a]/95 backdrop-blur-md border border-emerald-500/30 p-3 sm:p-4 shadow-xl">
        {/* Table felt glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.06)_0%,transparent_70%)] pointer-events-none" />

        <div className="relative flex flex-col items-center">
          {/* Reel Machine Frame */}
          <div className="relative w-full max-w-[320px] sm:max-w-[360px] rounded-xl bg-gradient-to-b from-[#090d13] via-[#0e1520] to-[#070b10] border-2 border-slate-800 p-2 sm:p-2.5 shadow-inner">
            {/* Payline Indicator Markers (Left & Right) */}
            <div className="absolute left-1 top-1/2 -translate-y-1/2 z-20 flex items-center">
              <div className="px-1 py-0.5 rounded bg-amber-500/20 border border-amber-400/80 text-[8px] font-mono font-bold text-amber-300">
                LINE
              </div>
            </div>
            <div className="absolute right-1 top-1/2 -translate-y-1/2 z-20 flex items-center">
              <div className="px-1 py-0.5 rounded bg-amber-500/20 border border-amber-400/80 text-[8px] font-mono font-bold text-amber-300">
                LINE
              </div>
            </div>

            {/* Payline Highlight Overlay Frame across middle row */}
            <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-13 sm:h-15 rounded-lg border-2 border-amber-400/80 bg-amber-500/5 pointer-events-none z-10 shadow-[0_0_12px_rgba(245,158,11,0.25)]" />

            {/* Reels Display (grid dynamically adapts to reel count) */}
            <div
              className="grid gap-2 px-6"
              style={{
                gridTemplateColumns: `repeat(${numReels}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: numReels }, (_, reelIdx) => {
                const spinning = reelSpinning[reelIdx];
                return (
                  <div
                    key={reelIdx}
                    className="relative flex flex-col items-center justify-around bg-[#070a0f] rounded-lg border border-slate-800/80 overflow-hidden py-1 h-[142px] sm:h-[160px]"
                  >
                    {/* Top Row (Above Payline) */}
                    <div className="h-10 sm:h-12 flex items-center justify-center opacity-30 scale-85 transition-opacity">
                      <SlotSymbolIcon symbol={currentWindow[0]?.[reelIdx] || 'blank'} />
                    </div>

                    {/* Middle Row (CENTER PAYLINE) */}
                    <div
                      className={`h-12 sm:h-14 w-full flex items-center justify-center z-15 transition-transform ${
                        spinning ? 'blur-[0.5px]' : ''
                      } ${winningLine?.won && !isSpinning ? 'scale-108' : ''}`}
                    >
                      <SlotSymbolIcon
                        symbol={currentWindow[1]?.[reelIdx] || 'blank'}
                        isWinning={winningLine?.won && !isSpinning}
                      />
                    </div>

                    {/* Bottom Row (Below Payline) */}
                    <div className="h-10 sm:h-12 flex items-center justify-center opacity-30 scale-85 transition-opacity">
                      <SlotSymbolIcon symbol={currentWindow[2]?.[reelIdx] || 'blank'} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Compact One-Line Result Strip */}
          <div className="h-6 my-2 w-full flex items-center justify-center text-xs font-mono overflow-hidden px-2 text-center">
            {lastResult ? (
              lastResult.won ? (
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold truncate animate-in fade-in duration-150">
                  <Sparkles size={13} className="text-amber-300 shrink-0" />
                  <span className="truncate">
                    {lastResult.net > 0
                      ? `Won +${lastResult.net.toLocaleString()} Credits · ${winningLine?.matchDescription}`
                      : `Push · ${winningLine?.matchDescription}`}
                  </span>
                </div>
              ) : (
                <div className="text-slate-400 font-medium truncate animate-in fade-in duration-150">
                  No win · Lost {lastResult.bet.toLocaleString()} Credits
                </div>
              )
            ) : isSpinning ? (
              <span className="text-amber-400 font-mono text-[11px] animate-pulse">
                Reels spinning...
              </span>
            ) : errorMsg ? (
              <span className="text-rose-400 font-sans text-[11px] font-medium truncate">
                {errorMsg}
              </span>
            ) : (
              <span className="text-slate-500 font-sans text-[11px]">
                Match symbols on the center payline
              </span>
            )}
          </div>

          {/* Spin Button */}
          <button
            type="button"
            onClick={handleSpin}
            disabled={isSpinning || balance < minBet}
            className={`w-full py-2.5 px-4 rounded-xl text-slate-950 font-display font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg transition-all min-h-[44px] ${
              isSpinning || balance < minBet
                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 hover:from-emerald-400 hover:to-emerald-300 shadow-emerald-500/20 active:scale-[0.99] cursor-pointer'
            }`}
          >
            <CircleDot size={18} className={isSpinning ? 'animate-spin shrink-0' : 'shrink-0'} />
            <span className="truncate">
              {isSpinning ? 'Spinning Reels...' : `Spin · ${wager.toLocaleString()} Credits`}
            </span>
          </button>
        </div>
      </div>

      {/* ── ONE Wager Row: Steppers + Presets + MAX ── */}
      <div className="bg-[#0f141d] border border-slate-800 rounded-xl p-2 sm:p-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {/* Stepper -10 */}
          <button
            type="button"
            onClick={() => adjustWager(-10)}
            disabled={isSpinning || wager <= minBet}
            className="min-h-[44px] min-w-[42px] px-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 text-slate-200 text-xs font-bold flex items-center justify-center transition-colors shrink-0"
            title="Decrease wager by 10"
          >
            -10
          </button>

          {/* Current Wager Display */}
          <div className="min-w-[80px] text-center px-2 py-1.5 rounded-lg bg-[#090d13] border border-slate-800 shrink-0">
            <span className="text-sm font-bold font-mono text-amber-300 tabular-nums">
              {wager.toLocaleString()}
            </span>
            <span className="block text-[9px] text-slate-400 font-sans uppercase -mt-0.5">
              Credits
            </span>
          </div>

          {/* Stepper +10 */}
          <button
            type="button"
            onClick={() => adjustWager(10)}
            disabled={isSpinning || wager + 10 > maxBet || wager + 10 > balance}
            className="min-h-[44px] min-w-[42px] px-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 text-slate-200 text-xs font-bold flex items-center justify-center transition-colors shrink-0"
            title="Increase wager by 10"
          >
            +10
          </button>

          {/* Vertical Separator */}
          <div className="h-7 w-px bg-slate-800 shrink-0 mx-0.5" />

          {/* Quick Presets */}
          {CHIP_PRESETS.map((preset) => {
            const isOverLimit = preset > maxBet || preset > balance;
            const isSelected = wager === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => handleSelectChip(preset)}
                disabled={isSpinning || isOverLimit}
                className={`min-h-[44px] px-3 rounded-lg text-xs font-mono font-semibold transition-all flex items-center justify-center shrink-0 ${
                  isSelected
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-400/80 shadow-xs'
                    : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700 hover:bg-slate-800'
                } ${isOverLimit ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
              >
                <span>{preset}</span>
              </button>
            );
          })}

          {/* MAX Button */}
          <button
            type="button"
            onClick={() => handleSelectChip(Math.floor(Math.min(maxBet, balance) / 10) * 10)}
            disabled={isSpinning || balance < minBet}
            className="min-h-[44px] px-3.5 rounded-lg text-xs font-sans font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-40 transition-colors shrink-0 flex items-center justify-center"
          >
            MAX
          </button>
        </div>
      </div>

      {/* ── Collapsed Dynamic Paytable & Odds Section ── */}
      <details className="group rounded-xl bg-[#090d13] border border-slate-800/80 p-3 text-xs text-slate-400">
        <summary className="flex items-center justify-between cursor-pointer list-none select-none text-slate-300 font-medium">
          <div className="flex items-center gap-1.5">
            <TrendingUp size={13} className="text-emerald-400" />
            <span className="text-xs">Paytable & odds</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500">
            <span className="text-[10px] font-mono group-open:hidden">Tap to inspect</span>
            <ChevronDown size={14} className="transition-transform duration-200 group-open:rotate-180" />
          </div>
        </summary>

        <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-2 text-[11px]">
          <div className="grid grid-cols-1 gap-1.5">
            {config.paytable.map((item) => {
              const hits = hitStats.hitsByMatch[item.id] || 0;
              const oneInN = hits > 0 ? Math.round(hitStats.totalSpins / hits) : 0;
              const oddsPercent = ((hits / hitStats.totalSpins) * 100).toFixed(hits < 10 ? 2 : 1);
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/60"
                >
                  <div>
                    <span className="font-semibold text-slate-200 block">{item.name}</span>
                    <span className="text-[10px] text-slate-500">{item.description}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-amber-300 text-xs block">
                      {item.multiplier}x
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {hits}/{hitStats.totalSpins.toLocaleString()} (1 in {oneInN.toLocaleString()} · {oddsPercent}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span>Payline: Center row only</span>
            <span>Target RTP: {rtpPercent}%</span>
          </div>
        </div>
      </details>
    </div>
  );
};
