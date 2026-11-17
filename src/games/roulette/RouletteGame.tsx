import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  Coins,
  Eraser,
  Info,
  RotateCcw,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import { GameProps, RoundResult } from '../../types/casino';
import {
  PAYTABLE_INFO,
  ROULETTE_CHIP_VALUES,
  calculateTotalWager,
  validateRouletteWager,
} from './rouletteRules';
import {
  RouletteGameState,
  claimRouletteSettlement,
  clearTableBets,
  createInitialRouletteState,
  placeChipOnSpot,
  removeBetSpot,
  repeatPreviousTableBets,
  startNewRouletteRound,
  startRouletteSpin,
} from './rouletteState';
import { RouletteWheel } from './RouletteWheel';
import { RouletteTable } from './RouletteTable';
import { soundManager } from '../../utils/sound';

function getChipButtonPalette(value: number): string {
  switch (value) {
    case 5:
      return 'from-red-600 to-red-800 border-red-300 text-white';
    case 10:
      return 'from-sky-600 to-sky-800 border-sky-300 text-white';
    case 25:
      return 'from-emerald-600 to-emerald-800 border-emerald-300 text-white';
    case 50:
      return 'from-amber-500 to-amber-700 border-amber-200 text-slate-950';
    case 100:
      return 'from-slate-800 to-slate-950 border-amber-400 text-amber-200';
    default:
      return 'from-purple-700 to-purple-950 border-amber-300 text-amber-100';
  }
}

export const RouletteGame: React.FC<GameProps> = ({
  balance,
  minBet,
  maxBet,
  placeBet,
  resolveRound,
  updatePendingRound,
  animations,
}) => {
  const [selectedChip, setSelectedChip] = useState<number>(25);
  const [gameState, setGameState] = useState<RouletteGameState>(() =>
    createInitialRouletteState()
  );
  const [removeMode, setRemoveMode] = useState<boolean>(false);
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastRoundResult, setLastRoundResult] = useState<RoundResult | null>(null);

  // Refs for double-spin prevention, latest callbacks, and unmount escrow recovery
  const actionLockRef = useRef<boolean>(false);
  const pendingEscrowRef = useRef<{
    roundId: string;
    bet: number;
    payout: number;
  } | null>(null);
  const settledRoundIdsRef = useRef<Set<string>>(new Set());
  const latestGameStateRef = useRef<RouletteGameState>(gameState);
  latestGameStateRef.current = gameState;

  const placeBetRef = useRef(placeBet);
  placeBetRef.current = placeBet;
  const resolveRoundRef = useRef(resolveRound);
  resolveRoundRef.current = resolveRound;
  const updatePendingRoundRef = useRef(updatePendingRound);
  updatePendingRoundRef.current = updatePendingRound;

  // Unmount-only cleanup: settle any active in-flight spin once if patron leaves mid-spin
  useEffect(() => {
    return () => {
      const pending = pendingEscrowRef.current;
      if (pending && !settledRoundIdsRef.current.has(pending.roundId)) {
        settledRoundIdsRef.current.add(pending.roundId);
        pendingEscrowRef.current = null;
        resolveRoundRef.current(pending.bet, pending.payout);
      }
    };
  }, []);

  const isSpinning = gameState.phase === 'SPINNING';
  const isSettled = gameState.phase === 'SETTLED';
  const totalWager = useMemo(() => calculateTotalWager(gameState.bets), [gameState.bets]);

  const wagerValidation = useMemo(
    () => validateRouletteWager(gameState.bets, minBet, maxBet, balance),
    [gameState.bets, minBet, maxBet, balance]
  );

  const handleSelectChip = (value: number) => {
    if (isSpinning) return;
    soundManager.playClick();
    setSelectedChip(value);
    setRemoveMode(false);
    setErrorMsg(null);
  };

  const handlePlaceChipOnSpot = (spotId: string) => {
    if (isSpinning || actionLockRef.current) return;
    const res = placeChipOnSpot(gameState, spotId, selectedChip, maxBet, balance);
    if (!res.placed) {
      soundManager.playLocked();
      setErrorMsg(res.reason || 'Cannot place chip.');
      return;
    }
    soundManager.playClick();
    setGameState(res.state);
    setErrorMsg(null);
    if (isSettled) {
      setLastRoundResult(null);
    }
  };

  const handleRemoveSpot = (spotId: string) => {
    if (isSpinning || actionLockRef.current) return;
    soundManager.playClick();
    const next = removeBetSpot(gameState, spotId);
    setGameState(next);
    setErrorMsg(null);
    if (next.bets.length === 0) {
      setRemoveMode(false);
    }
  };

  const handleClearBets = () => {
    if (isSpinning || actionLockRef.current) return;
    soundManager.playClick();
    setGameState((prev) => clearTableBets(prev));
    setRemoveMode(false);
    setErrorMsg(null);
    setLastRoundResult(null);
  };

  const handleRepeatBets = () => {
    if (isSpinning || actionLockRef.current) return;
    const res = repeatPreviousTableBets(gameState, maxBet, balance);
    if (!res.repeated) {
      soundManager.playLocked();
      setErrorMsg(res.reason || 'Cannot repeat previous bets.');
      return;
    }
    soundManager.playClick();
    setGameState(res.state);
    setRemoveMode(false);
    setErrorMsg(null);
    setLastRoundResult(null);
  };

  const handleNewRound = () => {
    if (isSpinning || actionLockRef.current) return;
    soundManager.playClick();
    setGameState((prev) => startNewRouletteRound(prev));
    setRemoveMode(false);
    setErrorMsg(null);
    setLastRoundResult(null);
  };

  const handleSpin = () => {
    if (actionLockRef.current || isSpinning) return;

    const prepared = startRouletteSpin(gameState, minBet, maxBet, balance);
    if (!prepared.started || !prepared.state.evaluation) {
      soundManager.playLocked();
      setErrorMsg(prepared.reason || 'Place valid bets before spinning.');
      return;
    }

    const total = prepared.state.evaluation.totalWager;
    const expectedPayout = prepared.state.evaluation.totalGrossPayout;

    actionLockRef.current = true;
    setRemoveMode(false);
    setErrorMsg(null);
    setLastRoundResult(null);

    const betResult = placeBetRef.current(total, expectedPayout);
    if (!betResult.success) {
      soundManager.playLocked();
      actionLockRef.current = false;
      setErrorMsg(betResult.error || 'Unable to place wager.');
      return;
    }

    pendingEscrowRef.current = {
      roundId: prepared.state.roundId,
      bet: total,
      payout: expectedPayout,
    };
    updatePendingRoundRef.current?.(total, expectedPayout);

    soundManager.playClick();
    setGameState(prepared.state);
  };

  const handleWheelSpinComplete = () => {
    const current = latestGameStateRef.current;
    if (current.phase !== 'SPINNING' || !current.evaluation) return;
    if (settledRoundIdsRef.current.has(current.roundId)) return;

    const claim = claimRouletteSettlement(current);
    if (!claim.claimed) return;

    settledRoundIdsRef.current.add(current.roundId);
    pendingEscrowRef.current = null;

    const { totalWager: roundBet, totalGrossPayout, net } = current.evaluation;
    const settledRes = resolveRoundRef.current(roundBet, totalGrossPayout);

    setGameState(claim.state);
    setLastRoundResult(settledRes);
    actionLockRef.current = false;

    if (!settledRes.success) {
      setErrorMsg(settledRes.error || 'Failed to settle roulette spin.');
      return;
    }

    if (totalGrossPayout > 0 && net >= 0) {
      soundManager.playCoin();
    } else {
      soundManager.playClick();
    }
  };

  const evaluation = gameState.evaluation;
  const displayedWinningNumber =
    isSettled && evaluation ? evaluation.winningNumber : null;
  const displayedWinningSpotIds =
    isSettled && evaluation ? evaluation.winningSpotIds : [];

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* ── Table Status & Balance Strip ── */}
      <div className="rounded-2xl bg-[#0f141d] border border-slate-800/90 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-x-3 gap-y-0.5 text-xs">
          <span className="font-display font-bold text-sm sm:text-base text-slate-100 tracking-wide">
            European Roulette
          </span>
          <span aria-hidden="true" className="text-slate-700 hidden sm:inline">·</span>
          <span className="text-emerald-400 font-mono">Single Zero (97.3% RTP)</span>
          <span aria-hidden="true" className="text-slate-700 hidden sm:inline">·</span>
          <span className="text-slate-400 font-mono hidden sm:inline">
            Limits {minBet}–{maxBet.toLocaleString()} Cr
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div>
            <span className="text-slate-500 mr-1.5">Wager:</span>
            <span
              data-testid="total-wager-value"
              className="text-amber-300 font-bold tabular-nums"
            >
              {totalWager.toLocaleString()} Cr
            </span>
          </div>
          <div>
            <span className="text-slate-500 mr-1.5">Balance:</span>
            <span className="text-emerald-300 font-bold tabular-nums">
              {balance.toLocaleString()} Cr
            </span>
          </div>
        </div>
      </div>

      {/* ── Recent Winning Numbers Marquee ── */}
      {gameState.history.length > 0 && (
        <div
          aria-label="Recent winning numbers"
          className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none"
        >
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 shrink-0">
            Recent:
          </span>
          <div className="flex items-center gap-1.5">
            {gameState.history.slice(0, 12).map((entry, idx) => (
              <span
                key={entry.roundId}
                title={`Spin #${idx + 1}: ${entry.number} (${entry.color})`}
                className={`inline-flex h-7 min-w-[28px] px-1.5 items-center justify-center rounded-md text-xs font-mono font-bold border ${
                  idx === 0 ? 'ring-1 ring-amber-400/70' : 'opacity-85'
                } ${
                  entry.color === 'green'
                    ? 'bg-emerald-700 border-emerald-400 text-white'
                    : entry.color === 'red'
                    ? 'bg-red-800 border-red-500/70 text-white'
                    : 'bg-slate-900 border-slate-700 text-slate-200'
                }`}
              >
                {entry.number}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Main Roulette Table & Wheel Grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[310px_1fr] gap-5 items-start">
        {/* Left Column: European Wheel & Spin Result Summary */}
        <div className="rounded-2xl bg-gradient-to-b from-[#121822] to-[#0c1118] border border-slate-800/90 p-4 sm:p-5 flex flex-col items-center gap-4 shadow-xl">
          <RouletteWheel
            winningNumber={evaluation ? evaluation.winningNumber : null}
            isSpinning={isSpinning}
            roundId={gameState.roundId}
            animations={animations}
            onSpinComplete={handleWheelSpinComplete}
          />

          {/* Settlement Feedback Panel */}
          {isSettled && evaluation && (
            <div
              role="status"
              data-testid="roulette-result-summary"
              className={`w-full rounded-xl border p-3.5 space-y-2.5 animate-in fade-in duration-200 ${
                evaluation.net > 0
                  ? 'bg-emerald-950/35 border-emerald-500/45'
                  : evaluation.net === 0 && evaluation.totalGrossPayout > 0
                  ? 'bg-amber-950/25 border-amber-500/40'
                  : 'bg-rose-950/25 border-rose-500/35'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {evaluation.net > 0 ? (
                    <Sparkles size={15} className="text-amber-300 shrink-0" />
                  ) : (
                    <TrendingUp size={15} className="text-slate-400 shrink-0" />
                  )}
                  <span className="text-xs font-semibold text-slate-100">
                    {evaluation.net > 0
                      ? `Won +${evaluation.net.toLocaleString()} Credits`
                      : evaluation.net === 0 && evaluation.totalGrossPayout > 0
                      ? 'Break Even · Stake Returned'
                      : `Lost ${Math.abs(evaluation.net).toLocaleString()} Credits`}
                  </span>
                </div>
                {lastRoundResult && lastRoundResult.xpGained > 0 && (
                  <span className="text-[11px] font-mono text-emerald-400">
                    +{lastRoundResult.xpGained} XP
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/70 text-[11px] font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px]">Wager</span>
                  <span className="text-slate-200 font-semibold tabular-nums">
                    {evaluation.totalWager.toLocaleString()} Cr
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Gross Payout</span>
                  <span className="text-amber-300 font-semibold tabular-nums">
                    {evaluation.totalGrossPayout.toLocaleString()} Cr
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px]">Net</span>
                  <span
                    className={`font-semibold tabular-nums ${
                      evaluation.net > 0
                        ? 'text-emerald-400'
                        : evaluation.net === 0
                        ? 'text-amber-300'
                        : 'text-rose-400'
                    }`}
                  >
                    {evaluation.net > 0 ? '+' : ''}
                    {evaluation.net.toLocaleString()} Cr
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Betting Felt, Chip Rack & Action Controls */}
        <div className="space-y-4">
          <RouletteTable
            bets={gameState.bets}
            disabled={isSpinning}
            winningNumber={displayedWinningNumber}
            winningSpotIds={displayedWinningSpotIds}
            removeMode={removeMode}
            onPlaceBet={handlePlaceChipOnSpot}
            onRemoveSpot={handleRemoveSpot}
          />

          {/* Error Feedback */}
          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl bg-rose-950/40 border border-rose-500/40 px-3.5 py-2.5 text-xs text-rose-200 flex items-center justify-between gap-2"
            >
              <span>{errorMsg}</span>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                aria-label="Dismiss error"
                className="text-rose-300 hover:text-white p-1"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Placed Bets Ledger (Allows quick 1-tap removal of individual bets) */}
          {gameState.bets.length > 0 && (
            <div className="rounded-xl bg-[#0f141d] border border-slate-800/90 p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Active Table Bets ({gameState.bets.length})</span>
                <span className="text-amber-300 font-semibold">
                  Total: {totalWager.toLocaleString()} Cr
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {gameState.bets.map((bet) => {
                  const betOutcome = isSettled
                    ? evaluation?.betResults.find((r) => r.spotId === bet.spotId)
                    : undefined;
                  return (
                    <div
                      key={bet.spotId}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono ${
                        betOutcome
                          ? betOutcome.won
                            ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200'
                            : 'bg-slate-900/80 border-slate-800 text-slate-500'
                          : 'bg-slate-900 border-slate-700/80 text-slate-200'
                      }`}
                    >
                      <span>{bet.label}</span>
                      <span className="text-amber-300 font-semibold">
                        {bet.amount.toLocaleString()} Cr
                      </span>
                      {betOutcome && betOutcome.won && (
                        <span className="text-emerald-400 font-bold">
                          → {betOutcome.grossPayout.toLocaleString()}
                        </span>
                      )}
                      {!isSpinning && !isSettled && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSpot(bet.spotId)}
                          aria-label={`Remove ${bet.label} bet`}
                          className="ml-0.5 text-slate-400 hover:text-rose-300 p-0.5 rounded cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Chip Denominations & Table Controls ── */}
          <div className="rounded-2xl bg-[#0f141d] border border-slate-800/90 p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block">
                  Select Chip Value
                </span>
                <span className="text-xs text-amber-300 font-mono font-semibold">
                  Active Chip: {selectedChip} Credits
                </span>
              </div>

              {/* 6 Virtual Chip Denominations */}
              <div
                role="group"
                aria-label="Chip denominations"
                className="flex flex-wrap items-center gap-2"
              >
                {ROULETTE_CHIP_VALUES.map((val) => {
                  const isSelected = selectedChip === val;
                  const tooExpensive = val > balance || val > maxBet;
                  return (
                    <button
                      key={val}
                      type="button"
                      disabled={isSpinning}
                      aria-label={`Select ${val} credit chip`}
                      aria-pressed={isSelected}
                      onClick={() => handleSelectChip(val)}
                      className={`relative h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-gradient-to-b border-2 border-dashed font-mono text-xs font-bold shadow-md transition-all flex items-center justify-center cursor-pointer disabled:opacity-40 ${getChipButtonPalette(
                        val
                      )} ${
                        isSelected
                          ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-[#0f141d] -translate-y-0.5 scale-105'
                          : tooExpensive
                          ? 'opacity-50'
                          : 'opacity-85 hover:opacity-100 hover:-translate-y-0.5'
                      }`}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Primary & Secondary Action Bar */}
            <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              {/* Secondary Bet Utilities */}
              <div className="grid grid-cols-3 sm:flex sm:items-center gap-2">
                <button
                  type="button"
                  disabled={isSpinning || isSettled || gameState.bets.length === 0}
                  onClick={() => {
                    soundManager.playClick();
                    setRemoveMode((v) => !v);
                  }}
                  className={`px-3 py-2.5 rounded-xl text-xs font-medium border transition-colors flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    removeMode
                      ? 'bg-rose-500/20 border-rose-400/60 text-rose-200'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <Eraser size={14} />
                  <span>{removeMode ? 'Removing' : 'Remove'}</span>
                </button>

                <button
                  type="button"
                  disabled={isSpinning || gameState.bets.length === 0}
                  onClick={handleClearBets}
                  className="px-3 py-2.5 rounded-xl text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 size={14} />
                  <span>Clear</span>
                </button>

                <button
                  type="button"
                  disabled={isSpinning || gameState.previousBets.length === 0}
                  onClick={handleRepeatBets}
                  className="px-3 py-2.5 rounded-xl text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-300 hover:border-emerald-500/40 transition-colors flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <RotateCcw size={14} />
                  <span>Repeat</span>
                </button>
              </div>

              {/* Primary CTA: SPIN or NEW ROUND */}
              {isSettled ? (
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleNewRound}
                    className="flex-1 sm:flex-initial px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-slate-950 font-bold text-sm tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition-all min-h-[46px] cursor-pointer"
                  >
                    <Coins size={16} />
                    <span>NEW ROUND</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={isSpinning || !wagerValidation.valid}
                  onClick={handleSpin}
                  className="px-7 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-sm tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 disabled:shadow-none active:scale-[0.98] transition-all min-h-[46px] cursor-pointer disabled:cursor-not-allowed"
                >
                  <Sparkles size={16} />
                  <span>
                    {isSpinning
                      ? 'SPINNING...'
                      : totalWager > 0 && totalWager < minBet
                      ? `MIN BET ${minBet} CR`
                      : 'SPIN'}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* ── Compact Collapsible Rules & Payouts Panel ── */}
          <div className="rounded-2xl bg-[#0f141d] border border-slate-800/90 overflow-hidden">
            <button
              type="button"
              aria-expanded={isRulesOpen}
              onClick={() => {
                soundManager.playClick();
                setIsRulesOpen((v) => !v);
              }}
              className="w-full px-4 py-3 flex items-center justify-between text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-900/60 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Info size={14} className="text-emerald-400" />
                <span>European Roulette Rules &amp; Payout Odds</span>
              </span>
              <ChevronDown
                size={15}
                className={`text-slate-400 transition-transform ${
                  isRulesOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isRulesOpen && (
              <div className="px-4 pb-4 pt-1 border-t border-slate-800/80 space-y-3 text-xs">
                <p className="text-slate-400 leading-relaxed">
                  Single-zero European wheel with 37 pockets (0 green, 18 red, 18 black).
                  Winning payouts return your original stake plus profit odds (e.g., a 10-credit
                  Straight Up win at 35:1 returns 360 credits). Green 0 loses all outside bets
                  (Red/Black, Even/Odd, Low/High, Dozens, Columns).
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {PAYTABLE_INFO.map((row) => (
                    <div
                      key={row.type}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900/70 border border-slate-800/80"
                    >
                      <div>
                        <span className="text-slate-200 font-medium block">{row.name}</span>
                        <span className="text-[11px] text-slate-500">{row.coverage}</span>
                      </div>
                      <span className="font-mono font-bold text-amber-300 shrink-0 ml-2">
                        {row.oddsLabel}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
