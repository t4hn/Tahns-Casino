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
  RotateCcw,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';

const CHIP_PRESETS = [10, 20, 50, 100, 250];

/**
 * Renders a single 6-sided die with authentic pip positioning.
 */
const DieFace: React.FC<{ value: number; isRolling: boolean }> = ({ value, isRolling }) => {
  // 3x3 grid pip positions for standard dice faces 1..6
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
      className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-[#1b2636] via-[#141d2a] to-[#0c1219] p-3 sm:p-3.5 shadow-2xl border-2 border-emerald-500/40 flex items-center justify-center transition-transform select-none ${
        isRolling ? 'animate-bounce scale-105 rotate-6' : 'hover:scale-102'
      }`}
      style={{
        boxShadow: isRolling
          ? '0 0 25px rgba(16, 185, 129, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.1)'
          : '0 10px 25px -5px rgba(0, 0, 0, 0.8), inset 0 2px 4px rgba(255, 255, 255, 0.1)',
      }}
    >
      <div className="grid grid-cols-3 grid-rows-3 w-full h-full gap-1.5 sm:gap-2">
        {Array.from({ length: 9 }).map((_, idx) => (
          <div key={idx} className="flex items-center justify-center">
            {activePips.includes(idx) && (
              <div
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full shadow-inner ${
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
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Ref guard against rapid double-tapping during roll resolution
  const rollingRef = useRef<boolean>(false);
  const animIntervalRef = useRef<number | null>(null);
  const animTimeoutRef = useRef<number | null>(null);

  // Clean up timer on unmount
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
    setLastResult(null);
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

    // 3. Mark rolling state atomically
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
      });

      setIsRolling(false);
      rollingRef.current = false;
      return;
    }

    // 6. Animated tumble (~700ms) with face cycling
    let ticks = 0;
    animIntervalRef.current = window.setInterval(() => {
      ticks++;
      // Random face preview during tumble
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
      });

      setIsRolling(false);
      rollingRef.current = false;
    }, 700);
  };

  const handleRollAgain = () => {
    if (isRolling || rollingRef.current) return;
    soundManager.playClick();
    setLastResult(null);
    setErrorMsg(null);
  };

  const selectedOption = BET_OPTIONS.find((b) => b.type === selectedBetType)!;
  const potentialPayout = Math.round(wager * selectedOption.multiplier);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5 pb-6">
      {/* ── Table Felt / Dice Arena ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#111823] via-[#0c121a] to-[#070b10] border border-emerald-500/30 p-5 sm:p-8 shadow-2xl">
        {/* Subtle table felt glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.08)_0%,transparent_70%)] pointer-events-none" />

        {/* Header Strip with Limits & Live Bankroll */}
        <div className="relative flex items-center justify-between border-b border-slate-800/80 pb-4 mb-6 text-xs font-mono">
          <div className="flex items-center gap-2 text-slate-400">
            <Dices size={16} className="text-emerald-400" />
            <span className="text-slate-300 font-semibold tracking-wide">EMERALD CRAPS ARENA</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-400">
              Limits: <strong className="text-slate-200">{minBet}-{maxBet}</strong>
            </span>
            <span className="text-slate-400 hidden sm:inline">
              Bankroll: <strong className="text-amber-300">{balance.toLocaleString()}</strong>
            </span>
          </div>
        </div>

        {/* Dice Arena Display */}
        <div className="relative flex flex-col items-center justify-center py-4 sm:py-6">
          <div className="flex items-center justify-center gap-5 sm:gap-8">
            <DieFace value={dice[0]} isRolling={isRolling} />
            <div className="text-slate-600 font-display font-light text-2xl sm:text-3xl">+</div>
            <DieFace value={dice[1]} isRolling={isRolling} />
          </div>

          {/* Current Roll Total Indicator */}
          <div className="mt-5 flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#141d2a]/90 border border-slate-800 backdrop-blur-md">
            <span className="text-[11px] font-mono uppercase text-slate-400">Roll Total:</span>
            <span className="text-base sm:text-lg font-bold font-mono text-emerald-400 tabular-nums">
              {isRolling ? 'Rolling...' : dice[0] + dice[1]}
            </span>
            {!isRolling && (
              <span className="text-[11px] text-slate-400 font-mono">
                ({dice[0]} + {dice[1]})
              </span>
            )}
          </div>
        </div>

        {/* ── Round Resolution Banner ── */}
        {lastResult && !isRolling && (
          <div
            className={`mt-4 p-4 rounded-2xl border transition-all animate-in fade-in zoom-in-95 duration-200 ${
              lastResult.won
                ? 'bg-gradient-to-r from-emerald-950/70 via-emerald-900/40 to-emerald-950/70 border-emerald-500/60 text-emerald-200 shadow-lg shadow-emerald-950/50'
                : 'bg-gradient-to-r from-slate-900/80 via-rose-950/30 to-slate-900/80 border-rose-500/40 text-slate-200'
            }`}
          >
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
                    lastResult.won ? 'bg-emerald-500 text-slate-950 shadow-md' : 'bg-slate-800 text-rose-400'
                  }`}
                >
                  {lastResult.won ? <Sparkles size={20} /> : <RotateCcw size={18} />}
                </div>
                <div>
                  <h4 className="font-display font-bold text-sm sm:text-base">
                    {lastResult.won ? 'Round Won!' : 'House Took The Round'}
                  </h4>
                  <p className="text-xs text-slate-300">
                    {lastResult.won ? (
                      <>
                        Hit <strong className="text-amber-300 uppercase">{selectedBetType}</strong> with total{' '}
                        <strong>{lastResult.d1 + lastResult.d2}</strong>! Net Profit:{' '}
                        <span className="text-emerald-400 font-bold font-mono">
                          +{lastResult.net.toLocaleString()} Credits
                        </span>
                      </>
                    ) : (
                      <>
                        Total <strong>{lastResult.d1 + lastResult.d2}</strong> did not match{' '}
                        <strong className="uppercase">{selectedBetType}</strong>. Lost{' '}
                        <span className="text-rose-400 font-mono">{lastResult.bet.toLocaleString()} Credits</span>.
                      </>
                    )}
                  </p>
                </div>
              </div>

              <button
                onClick={handleRollAgain}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold flex items-center gap-1.5 transition-colors min-h-[44px] shrink-0"
              >
                <RotateCcw size={14} />
                <span>Roll Again</span>
              </button>
            </div>
          </div>
        )}

        {/* Error message notification */}
        {errorMsg && (
          <div className="mt-3 p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* ── Bet Type Selector (4 Options) ── */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            1. Select Wager Target
          </span>
          <span className="text-[11px] text-slate-400">
            Selected: <strong className="text-emerald-400 capitalize">{selectedOption.label}</strong> ({selectedOption.multiplier}x)
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {BET_OPTIONS.map((opt) => {
            const isSelected = selectedBetType === opt.type;
            return (
              <button
                key={opt.type}
                type="button"
                onClick={() => handleSelectBet(opt.type)}
                disabled={isRolling}
                className={`relative p-3.5 rounded-2xl text-left border transition-all min-h-[76px] flex flex-col justify-between ${
                  isSelected
                    ? 'bg-gradient-to-b from-[#182333] to-[#0f1622] border-emerald-400 shadow-md shadow-emerald-950/40'
                    : 'bg-[#0f141d] border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                } ${isRolling ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer active:scale-[0.98]'}`}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`font-display font-bold text-sm ${
                      isSelected ? 'text-emerald-300' : 'text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </span>
                  <span className="font-mono text-xs font-bold text-amber-300 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                    {opt.multiplier}x
                  </span>
                </div>
                <div className="mt-1">
                  <p className="text-[11px] text-slate-400 leading-tight">{opt.targetDescription}</p>
                  <p className="text-[10px] font-mono text-slate-400 mt-1">Chance: {opt.probability}</p>
                </div>
                {isSelected && (
                  <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Wager Controls & Chip Presets ── */}
      <div className="bg-[#0f141d] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
              2. Adjust Wager Amount
            </span>
            <span className="text-[11px] text-slate-400">
              Potential Return: <strong className="text-emerald-400 font-mono font-semibold">{potentialPayout.toLocaleString()} Credits</strong>
            </span>
          </div>

          {/* Stepper Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => adjustWager(-10)}
              disabled={isRolling || wager <= minBet}
              className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 text-slate-200 text-sm font-bold flex items-center justify-center transition-colors"
            >
              -10
            </button>
            <div className="min-w-[100px] text-center px-3 py-2 rounded-xl bg-[#090d13] border border-slate-800">
              <span className="text-base font-bold font-mono text-amber-300">{wager.toLocaleString()}</span>
              <span className="block text-[10px] text-slate-400 font-sans">Credits</span>
            </div>
            <button
              type="button"
              onClick={() => adjustWager(10)}
              disabled={isRolling || wager + 10 > maxBet || wager + 10 > balance}
              className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 text-slate-200 text-sm font-bold flex items-center justify-center transition-colors"
            >
              +10
            </button>
          </div>
        </div>

        {/* Chip Quick Presets */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-slate-400 uppercase font-mono mr-1">Presets:</span>
          {CHIP_PRESETS.map((preset) => {
            const isOverLimit = preset > maxBet || preset > balance;
            const isSelected = wager === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => handleSelectChip(preset)}
                disabled={isRolling || isOverLimit}
                className={`min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all flex items-center gap-1 ${
                  isSelected
                    ? 'bg-amber-500/20 text-amber-300 border-2 border-amber-400/80 shadow-xs'
                    : 'bg-slate-900/90 text-slate-300 border border-slate-800 hover:border-slate-700 hover:bg-slate-800'
                } ${isOverLimit ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
              >
                <span>{preset}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => handleSelectChip(Math.min(maxBet, balance))}
            disabled={isRolling || balance < minBet}
            className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-sans font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 disabled:opacity-40 transition-colors"
          >
            MAX
          </button>
        </div>
      </div>

      {/* ── Main Roll Action Trigger ── */}
      <div>
        <button
          type="button"
          onClick={handleRoll}
          disabled={isRolling || balance < minBet}
          className={`w-full py-4 px-6 rounded-2xl text-slate-950 font-display font-bold text-base sm:text-lg flex items-center justify-center gap-2.5 shadow-xl transition-all min-h-[56px] ${
            isRolling || balance < minBet
              ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
              : 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 hover:from-emerald-400 hover:to-emerald-300 shadow-emerald-500/25 active:scale-[0.99] cursor-pointer'
          }`}
        >
          <Dices size={22} className={isRolling ? 'animate-spin' : ''} />
          <span>
            {isRolling
              ? 'Rolling Dice...'
              : `Roll Dice (${wager.toLocaleString()} Credits)`}
          </span>
        </button>
      </div>

      {/* ── Table Rules & Odds Summary ── */}
      <div className="p-3.5 rounded-xl bg-[#090d13] border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
        <div className="flex items-center gap-1.5 font-medium text-slate-300">
          <TrendingUp size={13} className="text-emerald-400" />
          <span>Table Payout Rules</span>
        </div>
        <p className="leading-relaxed">
          Low wins on totals 2 through 6 (2.3x). High wins on totals 8 through 12 (2.3x). Total of 7 loses both Low and High. Lucky 7 wins on exact 7 (5.9x). Doubles win when both dice match (5.9x). All payouts return stake included.
        </p>
      </div>
    </div>
  );
};
