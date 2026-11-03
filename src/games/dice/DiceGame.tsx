import React, { useState, useRef, useEffect } from 'react';
import { GameProps, RoundResult } from '../../types/casino';
import { useCasino } from '../../context/CasinoContext';
import {
  BetType,
  BET_OPTIONS,
  resolveRoll,
  isValidBet,
  RollResolution,
} from './diceRules';
import { rollDie } from './rng';
import { soundManager } from '../../utils/sound';
import {
  Dices,
  Sparkles,
  ChevronDown,
  TrendingUp,
} from 'lucide-react';

const CHIP_PRESETS = [10, 20, 50, 100, 250];

/**
 * Compact 6-sided die (~64px on mobile) with authentic pip positions.
 */
const DieFace: React.FC<{ value: number; isRolling: boolean }> = ({ value, isRolling }) => {
  const getPips = (val: number) => {
    switch (val) {
      case 1:
        return [4];
      case 2:
        return [0, 8];
      case 3:
        return [0, 4, 8];
      case 4:
        return [0, 2, 6, 8];
      case 5:
        return [0, 2, 4, 6, 8];
      case 6:
        return [0, 2, 3, 5, 6, 8];
      default:
        return [4];
    }
  };

  const activePips = getPips(value);

  return (
    <div
      className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#1b2636] via-[#141d2a] to-[#0c1219] p-2.5 sm:p-3 shadow-xl border-2 border-emerald-500/40 flex items-center justify-center transition-transform select-none ${
        isRolling ? 'animate-bounce scale-105 rotate-6' : 'hover:scale-102'
      }`}
      style={{
        boxShadow: isRolling
          ? '0 0 20px rgba(16, 185, 129, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.1)'
          : '0 8px 20px -4px rgba(0, 0, 0, 0.8), inset 0 2px 4px rgba(255, 255, 255, 0.1)',
      }}
    >
      <div className="grid grid-cols-3 grid-rows-3 w-full h-full gap-1 sm:gap-1.5">
        {Array.from({ length: 9 }).map((_, idx) => (
          <div key={idx} className="flex items-center justify-center">
            {activePips.includes(idx) && (
              <div
                className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shadow-inner ${
                  value === 1
                    ? 'bg-gradient-to-br from-amber-300 to-amber-500 shadow-amber-900/50 scale-110'
                    : 'bg-gradient-to-br from-emerald-300 to-emerald-500 shadow-emerald-950/80'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export const DiceGame: React.FC<GameProps> = ({
  balance,
  minBet,
  maxBet,
  settle,
}) => {
  const { settings } = useCasino();
  const [selectedBetType, setSelectedBetType] = useState<BetType>('low');
  const [wager, setWager] = useState<number>(() => Math.max(minBet, Math.min(50, maxBet, balance)));
  const [dice, setDice] = useState<[number, number]>([3, 4]);
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<{
    outcome: RollResolution;
    won: boolean;
    net: number;
    bet: number;
    roundResult: RoundResult;
    d1: number;
    d2: number;
    betType: BetType;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Ref guard against rapid double-tapping during roll resolution
  const rollingRef = useRef<boolean>(false);
  const animIntervalRef = useRef<number | null>(null);
  const animTimeoutRef = useRef<number | null>(null);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (animIntervalRef.current) clearInterval(animIntervalRef.current);
      if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
    };
  }, []);

  // Clamp wager if balance or table limits change
  useEffect(() => {
    if (balance > 0 && wager > balance) {
      setWager(Math.max(minBet, balance));
    }
  }, [balance, minBet, wager]);

  const handleSelectBet = (type: BetType) => {
    if (isRolling || rollingRef.current) return;
    soundManager.playClick();
    setSelectedBetType(type);
    setErrorMsg(null);
  };

  const handleSelectChip = (amount: number) => {
    if (isRolling || rollingRef.current) return;
    soundManager.playClick();
    const clamped = Math.max(minBet, Math.min(amount, maxBet, balance));
    setWager(clamped);
    setErrorMsg(null);
  };

  const adjustWager = (delta: number) => {
    if (isRolling || rollingRef.current) return;
    soundManager.playClick();
    const newBet = Math.max(minBet, Math.min(wager + delta, maxBet, balance));
    setWager(newBet);
    setErrorMsg(null);
  };

  const handleRoll = () => {
    // 1. Guard against double-tap or concurrent executions
    if (rollingRef.current || isRolling) return;

    // 2. Validate bet against bankroll and table boundaries
    const validation = isValidBet(wager, minBet, maxBet, balance);
    if (!validation.valid) {
      soundManager.playLocked();
      setErrorMsg(validation.reason || 'Invalid wager.');
      return;
    }

    // 3. Mark rolling state atomically and clear previous result for new roll
    rollingRef.current = true;
    setIsRolling(true);
    setLastResult(null);
    setErrorMsg(null);
    soundManager.playClick();

    // 4. Calculate outcome immediately
    const finalD1 = rollDie();
    const finalD2 = rollDie();
    const resolution = resolveRoll(selectedBetType, finalD1, finalD2, wager);

    // 5. Check if animations are enabled
    const useAnimation = settings.animations !== false;

    if (!useAnimation) {
      // Instant settlement
      setDice([finalD1, finalD2]);
      const roundRes = settle(wager, resolution.payout);

      if (resolution.isWin) {
        soundManager.playCoin();
      } else {
        soundManager.playClick();
      }

      setLastResult({
        outcome: resolution,
        won: resolution.isWin,
        net: resolution.payout - wager,
        bet: wager,
        roundResult: roundRes,
        d1: finalD1,
        d2: finalD2,
        betType: selectedBetType,
      });

      setIsRolling(false);
      rollingRef.current = false;
      return;
    }

    // 6. Animated tumble (~700ms) with face cycling
    animIntervalRef.current = window.setInterval(() => {
      setDice([Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1]);
    }, 70);

    animTimeoutRef.current = window.setTimeout(() => {
      if (animIntervalRef.current) {
        clearInterval(animIntervalRef.current);
        animIntervalRef.current = null;
      }

      // Settle atomically once animation concludes
      setDice([finalD1, finalD2]);
      const roundRes = settle(wager, resolution.payout);

      if (resolution.isWin) {
        soundManager.playCoin();
      } else {
        soundManager.playClick();
      }

      setLastResult({
        outcome: resolution,
        won: resolution.isWin,
        net: resolution.payout - wager,
        bet: wager,
        roundResult: roundRes,
        d1: finalD1,
        d2: finalD2,
        betType: selectedBetType,
      });

      setIsRolling(false);
      rollingRef.current = false;
    }, 700);
  };

  const selectedOption = BET_OPTIONS.find((b) => b.type === selectedBetType)!;

  // Bet label for result strip
  const resultOption = lastResult ? BET_OPTIONS.find((b) => b.type === lastResult.betType) : null;

  return (
    <div className="w-full max-w-lg mx-auto space-y-3.5 pb-6">
      {/* ── Sticky Top Game Panel: Dice + Roll-Total + One-Line Result + Roll Button ── */}
      <div className="sticky top-16 z-30 overflow-hidden rounded-2xl bg-[#0c121a]/95 backdrop-blur-md border border-emerald-500/30 p-3 sm:p-4 shadow-xl">
        {/* Subtle felt glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.06)_0%,transparent_70%)] pointer-events-none" />

        <div className="relative flex flex-col items-center">
          {/* Dice Display */}
          <div className="flex items-center justify-center gap-3 sm:gap-4 py-0.5">
            <DieFace value={dice[0]} isRolling={isRolling} />
            <div className="text-slate-600 font-display font-light text-xl sm:text-2xl select-none">+</div>
            <DieFace value={dice[1]} isRolling={isRolling} />
          </div>

          {/* Roll Total Pill */}
          <div className="mt-2 flex items-center justify-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#141d2a]/95 border border-slate-800 text-[11px] font-mono shadow-xs">
              <span className="text-slate-400 uppercase text-[10px]">Total:</span>
              <span className="font-bold text-emerald-400 tabular-nums">
                {isRolling ? '...' : dice[0] + dice[1]}
              </span>
              {!isRolling && (
                <span className="text-slate-400 text-[10px]">
                  ({dice[0]} + {dice[1]})
                </span>
              )}
            </div>
          </div>

          {/* Compact One-Line Result Strip (fixed height to prevent layout jumps/reflows) */}
          <div className="h-6 my-1.5 w-full flex items-center justify-center text-xs font-mono overflow-hidden px-2 text-center">
            {lastResult ? (
              lastResult.won ? (
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold truncate animate-in fade-in duration-150">
                  <Sparkles size={13} className="text-amber-300 shrink-0" />
                  <span className="truncate">
                    Won +{lastResult.net.toLocaleString()} Credits · {resultOption?.label || lastResult.betType} · total {lastResult.d1 + lastResult.d2}
                  </span>
                </div>
              ) : (
                <div className="text-rose-400 font-semibold truncate animate-in fade-in duration-150">
                  Lost {lastResult.bet.toLocaleString()} · total {lastResult.d1 + lastResult.d2}
                </div>
              )
            ) : isRolling ? (
              <span className="text-amber-400 font-mono text-[11px] animate-pulse">
                Rolling dice...
              </span>
            ) : errorMsg ? (
              <span className="text-rose-400 font-sans text-[11px] font-medium truncate">
                {errorMsg}
              </span>
            ) : (
              <span className="text-slate-500 font-sans text-[11px]">
                Choose target & wager below to roll
              </span>
            )}
          </div>

          {/* Roll Dice Button (disabled while rolling) */}
          <button
            type="button"
            onClick={handleRoll}
            disabled={isRolling || balance < minBet}
            className={`w-full py-2.5 px-4 rounded-xl text-slate-950 font-display font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg transition-all min-h-[44px] ${
              isRolling || balance < minBet
                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 hover:from-emerald-400 hover:to-emerald-300 shadow-emerald-500/20 active:scale-[0.99] cursor-pointer'
            }`}
          >
            <Dices size={18} className={isRolling ? 'animate-spin shrink-0' : 'shrink-0'} />
            <span className="truncate">
              {isRolling
                ? 'Rolling Dice...'
                : `Roll Dice · ${selectedOption.label} · ${wager.toLocaleString()} Credits`}
            </span>
          </button>
        </div>
      </div>

      {/* ── Compact Bet Targets: 2x2 Grid (Label + Multiplier + Chance) ── */}
      <div>
        <div className="grid grid-cols-2 gap-2">
          {BET_OPTIONS.map((opt) => {
            const isSelected = selectedBetType === opt.type;
            return (
              <button
                key={opt.type}
                type="button"
                onClick={() => handleSelectBet(opt.type)}
                disabled={isRolling}
                className={`relative px-3 py-2 rounded-xl text-left border transition-all min-h-[48px] flex flex-col justify-between ${
                  isSelected
                    ? 'bg-gradient-to-b from-[#182333] to-[#0f1622] border-emerald-400 shadow-xs'
                    : 'bg-[#0f141d] border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                } ${isRolling ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer active:scale-[0.98]'}`}
              >
                <div className="flex items-center justify-between w-full gap-1">
                  <span
                    className={`font-display font-bold text-xs sm:text-sm truncate ${
                      isSelected ? 'text-emerald-300' : 'text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </span>
                  <span className="font-mono text-[11px] font-bold text-amber-300 px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/20 shrink-0">
                    {opt.multiplier}x
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-1">
                  <span>Chance {opt.probability}</span>
                  {isSelected && <span className="text-emerald-400 text-[10px] font-bold">Active</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── ONE Wager Row: Steppers + Presets + MAX (Single Horizontally Scrollable Row) ── */}
      <div className="bg-[#0f141d] border border-slate-800 rounded-xl p-2 sm:p-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {/* Stepper -10 */}
          <button
            type="button"
            onClick={() => adjustWager(-10)}
            disabled={isRolling || wager <= minBet}
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
            disabled={isRolling || wager + 10 > maxBet || wager + 10 > balance}
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
                disabled={isRolling || isOverLimit}
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
            onClick={() => handleSelectChip(Math.min(maxBet, balance))}
            disabled={isRolling || balance < minBet}
            className="min-h-[44px] px-3.5 rounded-lg text-xs font-sans font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-40 transition-colors shrink-0 flex items-center justify-center"
          >
            MAX
          </button>
        </div>
      </div>

      {/* ── Collapsed Rules & Odds Section ── */}
      <details className="group rounded-xl bg-[#090d13] border border-slate-800/80 p-3 text-xs text-slate-400">
        <summary className="flex items-center justify-between cursor-pointer list-none select-none text-slate-300 font-medium">
          <div className="flex items-center gap-1.5">
            <TrendingUp size={13} className="text-emerald-400" />
            <span className="text-xs">Rules & odds</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500">
            <span className="text-[10px] font-mono group-open:hidden">Tap to view</span>
            <ChevronDown size={14} className="transition-transform duration-200 group-open:rotate-180" />
          </div>
        </summary>
        <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-1 text-[11px] leading-relaxed text-slate-400">
          <p>
            • <strong className="text-slate-200">Low</strong> (2.3x): Wins on totals 2 through 6. (41.7% chance)
          </p>
          <p>
            • <strong className="text-slate-200">High</strong> (2.3x): Wins on totals 8 through 12. (41.7% chance)
          </p>
          <p className="text-amber-400/90 font-mono text-[10px]">
            * Note: A total of 7 loses both Low and High bets.
          </p>
          <p>
            • <strong className="text-slate-200">Lucky 7</strong> (5.9x): Wins on exact total of 7. (16.7% chance)
          </p>
          <p>
            • <strong className="text-slate-200">Doubles</strong> (5.9x): Wins on any matching pair 1-1 to 6-6. (16.7% chance)
          </p>
          <div className="pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span>Limits: {minBet} - {maxBet.toLocaleString()} Credits</span>
            <span>Target RTP: 95.8% - 98.3%</span>
          </div>
        </div>
      </details>
    </div>
  );
};
