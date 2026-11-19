import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  Info,
  Minus,
  Plus,
  RotateCcw,
  Shuffle,
  Sparkles,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { GameProps, RoundResult } from '../../types/casino';
import {
  KENO_CHIP_PRESETS,
  KENO_DRAW_COUNT,
  KENO_MAX_SPOTS,
  KENO_MIN_SPOTS,
  calculateKenoAverageRtp,
  getKenoPaytableForSpots,
  validateKenoRound,
} from './kenoRules';
import {
  KenoGameState,
  advanceKenoReveal,
  applyQuickPick,
  claimKenoSettlement,
  clearKenoSelection,
  createInitialKenoState,
  repeatPreviousKenoBet,
  setKenoWager,
  setQuickPickSpotCount,
  startKenoDraw,
  toggleSpotInState,
} from './kenoState';
import {
  KenoHistoryEntry,
  loadKenoHistory,
  loadKenoStats,
  recordCompletedKenoRound,
} from './kenoStorage';
import { KenoBoard } from './KenoBoard';
import { KenoDrawChamber } from './KenoDrawChamber';
import { KenoIcon } from './KenoIcon';
import { soundManager } from '../../utils/sound';

const KENO_BALL_INTERVAL_MS = 350; // 20 balls * 350ms = 7.0s complete draw
const KENO_AVG_RTP_PERCENT = (calculateKenoAverageRtp() * 100).toFixed(1);

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export const KenoGame: React.FC<GameProps> = ({
  balance,
  minBet,
  maxBet,
  placeBet,
  resolveRound,
  updatePendingRound,
  animations,
}) => {
  const initialWager = Math.max(
    minBet,
    Math.min(20, maxBet, Math.floor(Math.max(minBet, balance) / 10) * 10)
  );

  const [gameState, setGameState] = useState<KenoGameState>(() =>
    createInitialKenoState(initialWager, loadKenoHistory(), loadKenoStats())
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastRoundResult, setLastRoundResult] = useState<RoundResult | null>(null);
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);

  // Refs for atomic lock, timers, latest callbacks, and unmount escrow settlement
  const actionLockRef = useRef<boolean>(false);
  const drawTimerRef = useRef<number | null>(null);
  const pendingEscrowRef = useRef<{
    roundId: string;
    wager: number;
    grossPayout: number;
    historyEntry: KenoHistoryEntry;
  } | null>(null);
  const settledRoundIdsRef = useRef<Set<string>>(new Set());
  const latestStateRef = useRef<KenoGameState>(gameState);
  latestStateRef.current = gameState;

  const placeBetRef = useRef(placeBet);
  placeBetRef.current = placeBet;
  const resolveRoundRef = useRef(resolveRound);
  resolveRoundRef.current = resolveRound;
  const updatePendingRoundRef = useRef(updatePendingRound);
  updatePendingRoundRef.current = updatePendingRound;

  const stopDrawTimer = useCallback(() => {
    if (drawTimerRef.current !== null) {
      clearInterval(drawTimerRef.current);
      drawTimerRef.current = null;
    }
  }, []);

  // Unmount cleanup: clear timer and settle any in-flight draw once
  useEffect(() => {
    return () => {
      stopDrawTimer();
      const pending = pendingEscrowRef.current;
      if (pending && !settledRoundIdsRef.current.has(pending.roundId)) {
        settledRoundIdsRef.current.add(pending.roundId);
        pendingEscrowRef.current = null;
        const res = resolveRoundRef.current(pending.wager, pending.grossPayout);
        if (res.success) {
          recordCompletedKenoRound(pending.historyEntry);
        }
      }
    };
  }, [stopDrawTimer]);

  const isDrawing = gameState.phase === 'DRAWING';
  const isSettled = gameState.phase === 'SETTLED';
  const evaluation = gameState.evaluation;

  const revealedDrawnNumbers = useMemo(
    () => gameState.drawnSequence.slice(0, gameState.revealedCount),
    [gameState.drawnSequence, gameState.revealedCount]
  );

  const activeSpotCount =
    gameState.selectedNumbers.length > 0
      ? gameState.selectedNumbers.length
      : gameState.quickPickCount;

  const paytableRows = useMemo(
    () => getKenoPaytableForSpots(activeSpotCount),
    [activeSpotCount]
  );

  const roundValidation = useMemo(
    () =>
      validateKenoRound(
        gameState.selectedNumbers,
        gameState.wager,
        minBet,
        maxBet,
        balance
      ),
    [gameState.selectedNumbers, gameState.wager, minBet, maxBet, balance]
  );

  const settleActiveDraw = useCallback(() => {
    stopDrawTimer();
    const current = latestStateRef.current;
    if (current.phase !== 'DRAWING' || !current.evaluation) return;
    if (settledRoundIdsRef.current.has(current.roundId)) return;

    settledRoundIdsRef.current.add(current.roundId);
    const pendingEntry = pendingEscrowRef.current?.historyEntry;
    pendingEscrowRef.current = null;

    const { wager, grossPayout, isWin } = current.evaluation;
    const roundRes = resolveRoundRef.current(wager, grossPayout);

    const fallbackEntry: KenoHistoryEntry = {
      roundId: current.roundId,
      timestamp: Date.now(),
      selectedNumbers: current.evaluation.selectedNumbers,
      drawnNumbers: current.evaluation.drawnNumbers,
      matchedNumbers: current.evaluation.matchedNumbers,
      spotCount: current.evaluation.spotCount,
      hits: current.evaluation.hits,
      multiplier: current.evaluation.multiplier,
      wager: current.evaluation.wager,
      grossPayout: current.evaluation.grossPayout,
      net: current.evaluation.net,
    };

    const recorded = roundRes.success
      ? recordCompletedKenoRound(pendingEntry ?? fallbackEntry)
      : { history: current.history, stats: current.stats };

    const claimed = claimKenoSettlement(current, recorded.history, recorded.stats);
    setGameState(claimed.state);
    setLastRoundResult(roundRes);
    actionLockRef.current = false;

    if (isWin) {
      soundManager.playBonusClaim();
    } else if (grossPayout > 0) {
      soundManager.playCoin();
    } else {
      soundManager.playClick();
    }
  }, [stopDrawTimer]);

  const handleToggleNumber = (num: number) => {
    if (isDrawing || actionLockRef.current) return;
    const res = toggleSpotInState(gameState, num);
    if (!res.changed) {
      soundManager.playLocked();
      setErrorMsg(res.reason || 'Maximum 10 numbers per ticket.');
      return;
    }
    soundManager.playClick();
    setGameState(res.state);
    setErrorMsg(null);
    if (isSettled) {
      setLastRoundResult(null);
    }
  };

  const handleQuickPick = (explicitCount?: number) => {
    if (isDrawing || actionLockRef.current) return;
    soundManager.playClick();
    const countToPick =
      explicitCount !== undefined
        ? explicitCount
        : gameState.selectedNumbers.length > 0
        ? gameState.selectedNumbers.length
        : gameState.quickPickCount;
    setGameState((prev) => applyQuickPick(prev, countToPick));
    setErrorMsg(null);
    setLastRoundResult(null);
  };

  const handleChangeSpotCount = (count: number) => {
    if (isDrawing || actionLockRef.current) return;
    soundManager.playClick();
    setGameState((prev) => setQuickPickSpotCount(prev, count));
    setErrorMsg(null);
  };

  const handleClearSelection = () => {
    if (isDrawing || actionLockRef.current) return;
    soundManager.playClick();
    setGameState((prev) => clearKenoSelection(prev));
    setErrorMsg(null);
    setLastRoundResult(null);
  };

  const handleRepeatBet = () => {
    if (isDrawing || actionLockRef.current) return;
    const res = repeatPreviousKenoBet(gameState, minBet, maxBet, balance);
    if (!res.repeated) {
      soundManager.playLocked();
      setErrorMsg(res.reason || 'No previous ticket available to repeat.');
      return;
    }
    soundManager.playClick();
    setGameState(res.state);
    setErrorMsg(null);
    setLastRoundResult(null);
  };

  const handleSelectChip = (amount: number) => {
    if (isDrawing || actionLockRef.current) return;
    soundManager.playClick();
    setGameState((prev) => setKenoWager(prev, amount, minBet, maxBet, balance));
    setErrorMsg(null);
  };

  const handleAdjustWager = (delta: number) => {
    if (isDrawing || actionLockRef.current) return;
    soundManager.playClick();
    setGameState((prev) => setKenoWager(prev, prev.wager + delta, minBet, maxBet, balance));
    setErrorMsg(null);
  };

  const handlePlayKeno = () => {
    if (actionLockRef.current || isDrawing) return;

    const prepared = startKenoDraw(gameState, minBet, maxBet, balance);
    if (!prepared.started || !prepared.state.evaluation || !prepared.historyEntry) {
      soundManager.playLocked();
      setErrorMsg(prepared.reason || 'Select 1–10 numbers and a valid wager to play.');
      return;
    }

    const evalRes = prepared.state.evaluation;
    actionLockRef.current = true;
    setErrorMsg(null);
    setLastRoundResult(null);

    const pendingMeta = {
      roundId: prepared.state.roundId,
      kenoResult: prepared.historyEntry,
    };

    // Deduct wager once up front and record escrow metadata for crash recovery
    const betRes = placeBetRef.current(evalRes.wager, evalRes.grossPayout, pendingMeta);
    if (!betRes.success) {
      soundManager.playLocked();
      actionLockRef.current = false;
      setErrorMsg(betRes.error || 'Unable to place Keno wager.');
      return;
    }

    pendingEscrowRef.current = {
      roundId: prepared.state.roundId,
      wager: evalRes.wager,
      grossPayout: evalRes.grossPayout,
      historyEntry: prepared.historyEntry,
    };
    updatePendingRoundRef.current?.(evalRes.wager, evalRes.grossPayout, pendingMeta);

    const useSequentialAnimation = animations !== false && !prefersReducedMotion();

    if (!useSequentialAnimation) {
      const instantState: KenoGameState = {
        ...prepared.state,
        revealedCount: KENO_DRAW_COUNT,
      };
      latestStateRef.current = instantState;
      setGameState(instantState);
      settleActiveDraw();
      return;
    }

    soundManager.playClick();
    latestStateRef.current = prepared.state;
    setGameState(prepared.state);

    const selectedLookup = new Set(evalRes.selectedNumbers);

    drawTimerRef.current = window.setInterval(() => {
      const curr = latestStateRef.current;
      if (curr.phase !== 'DRAWING') {
        stopDrawTimer();
        return;
      }

      if (curr.revealedCount >= KENO_DRAW_COUNT) {
        settleActiveDraw();
        return;
      }

      const nextBall = curr.drawnSequence[curr.revealedCount];
      const nextState = advanceKenoReveal(curr);
      latestStateRef.current = nextState;
      setGameState(nextState);

      if (selectedLookup.has(nextBall)) {
        soundManager.playCoin();
      } else {
        soundManager.playClick();
      }

      if (nextState.revealedCount >= KENO_DRAW_COUNT) {
        settleActiveDraw();
      }
    }, KENO_BALL_INTERVAL_MS);
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4 pb-6">
      {/* ── Top Status & Bankroll Strip ── */}
      <div className="rounded-2xl bg-[#0f141d] border border-slate-800/90 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-xs">
          <KenoIcon size={22} />
          <span className="font-display font-bold text-slate-100 text-sm sm:text-base">
            Keno
          </span>
          <span aria-hidden="true" className="text-slate-700">·</span>
          <span className="text-emerald-400 font-mono">
            80-Ball · Avg RTP {KENO_AVG_RTP_PERCENT}%
          </span>
          <span aria-hidden="true" className="text-slate-700 hidden sm:inline">·</span>
          <span className="text-slate-400 font-mono hidden sm:inline">
            Limits {minBet}–{maxBet.toLocaleString()} Cr
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div>
            <span className="text-slate-500 mr-1.5">Spots:</span>
            <span
              data-testid="keno-selection-count"
              className="text-emerald-300 font-bold tabular-nums"
            >
              {gameState.selectedNumbers.length}/{KENO_MAX_SPOTS}
            </span>
          </div>
          <div>
            <span className="text-slate-500 mr-1.5">Wager:</span>
            <span className="text-amber-300 font-bold tabular-nums">
              {gameState.wager.toLocaleString()} Cr
            </span>
          </div>
          <div>
            <span className="text-slate-500 mr-1.5">Balance:</span>
            <span className="text-slate-100 font-bold tabular-nums">
              {balance.toLocaleString()} Cr
            </span>
          </div>
        </div>
      </div>

      {/* ── Main Two-Column Keno Salon Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-4 sm:gap-5 items-start">
        {/* Left/Primary Column: Ticket Controls, 8x10 Board, Wager & Play CTA */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-[#0c121b] border border-slate-800/90 p-3.5 sm:p-5 space-y-4 shadow-xl">
            {/* Ticket Controls Header */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-display font-bold text-slate-100">
                  Select 1 to 10 Numbers
                </h2>
                <p className="text-xs text-slate-400">
                  Match drawn balls to win up to 25,000× your wager.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                {/* Quick Pick Spot Count Selector */}
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-300 bg-slate-900/90 border border-slate-800 rounded-xl px-2.5 min-h-[40px]">
                  <span className="text-slate-400">Pick</span>
                  <select
                    aria-label="Quick Pick number count"
                    disabled={isDrawing}
                    value={gameState.quickPickCount}
                    onChange={(e) => handleChangeSpotCount(Number(e.target.value))}
                    className="bg-transparent text-emerald-300 font-mono font-bold focus:outline-none cursor-pointer disabled:opacity-50"
                  >
                    {Array.from({ length: KENO_MAX_SPOTS }, (_, i) => i + 1).map((cnt) => (
                      <option key={cnt} value={cnt} className="bg-slate-900 text-slate-100">
                        {cnt}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  disabled={isDrawing}
                  onClick={() => handleQuickPick(gameState.quickPickCount)}
                  className="touch-manipulation px-2.5 py-2 rounded-xl text-xs font-medium bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 transition-colors flex items-center gap-1.5 min-h-[40px] whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Shuffle size={14} />
                  <span>Quick Pick</span>
                </button>

                <button
                  type="button"
                  disabled={isDrawing || gameState.selectedNumbers.length === 0}
                  onClick={handleClearSelection}
                  className="touch-manipulation px-2.5 py-2 rounded-xl text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors flex items-center gap-1.5 min-h-[40px] whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 size={14} />
                  <span>Clear Selection</span>
                </button>

                <button
                  type="button"
                  disabled={isDrawing || !gameState.previousSelection}
                  onClick={handleRepeatBet}
                  className="touch-manipulation px-2.5 py-2 rounded-xl text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300 hover:text-amber-300 hover:border-amber-500/40 transition-colors flex items-center gap-1.5 min-h-[40px] whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <RotateCcw size={14} />
                  <span>Repeat Bet</span>
                </button>
              </div>
            </div>

            {/* 8x10 Interactive Grid */}
            <KenoBoard
              selectedNumbers={gameState.selectedNumbers}
              revealedDrawnNumbers={revealedDrawnNumbers}
              phase={gameState.phase}
              disabled={isDrawing}
              onToggleNumber={handleToggleNumber}
            />

            {errorMsg && (
              <div
                role="alert"
                className="rounded-xl bg-rose-950/40 border border-rose-500/40 px-3.5 py-2 text-xs text-rose-200"
              >
                {errorMsg}
              </div>
            )}
          </div>

          {/* ── Wager Controls & Primary PLAY KENO Action ── */}
          <div className="rounded-2xl bg-[#0f141d] border border-slate-800/90 p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center justify-between sm:justify-start gap-3">
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block">
                    Ticket Wager
                  </span>
                  <span className="text-sm font-mono font-bold text-amber-300 tabular-nums">
                    {gameState.wager.toLocaleString()} Credits
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Decrease wager by 10"
                    disabled={isDrawing || gameState.wager <= minBet}
                    onClick={() => handleAdjustWager(-10)}
                    className="touch-manipulation h-10 w-10 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Minus size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label="Increase wager by 10"
                    disabled={isDrawing || gameState.wager + 10 > Math.min(maxBet, balance)}
                    onClick={() => handleAdjustWager(10)}
                    className="touch-manipulation h-10 w-10 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>

              {/* Chip Wager Presets */}
              <div
                role="group"
                aria-label="Keno wager presets"
                className="flex flex-wrap items-center gap-2"
              >
                {KENO_CHIP_PRESETS.map((preset) => {
                  const isActive = gameState.wager === preset;
                  const unavailable = preset > balance || preset > maxBet;
                  return (
                    <button
                      key={preset}
                      type="button"
                      disabled={isDrawing || unavailable}
                      aria-label={`Set ${preset} credit wager`}
                      aria-pressed={isActive}
                      onClick={() => handleSelectChip(preset)}
                      className={`touch-manipulation px-3.5 py-2 rounded-xl font-mono text-xs font-bold border min-h-[42px] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                        isActive
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-1 ring-amber-400/50'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                      }`}
                    >
                      {preset}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <p className="text-xs text-slate-400">
                {gameState.selectedNumbers.length === 0
                  ? 'Pick at least 1 number or tap Quick Pick to activate your ticket.'
                  : balance < minBet
                  ? `Insufficient credits (minimum wager ${minBet} Cr).`
                  : `Playing ${gameState.selectedNumbers.length} ${
                      gameState.selectedNumbers.length === 1 ? 'spot' : 'spots'
                    } for ${gameState.wager.toLocaleString()} Cr`}
              </p>

              <button
                type="button"
                disabled={isDrawing || !roundValidation.valid}
                onClick={handlePlayKeno}
                className="touch-manipulation px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-sm tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 disabled:shadow-none active:scale-[0.98] transition-all min-h-[48px] cursor-pointer disabled:cursor-not-allowed whitespace-nowrap shrink-0"
              >
                <Sparkles size={16} />
                <span>{isDrawing ? 'DRAWING 20 BALLS...' : 'PLAY KENO'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right/Secondary Column: Draw Chamber, Results, Dynamic Paytable, Stats & History */}
        <div className="space-y-4">
          <KenoDrawChamber
            drawnSequence={gameState.drawnSequence}
            revealedCount={gameState.revealedCount}
            selectedNumbers={gameState.selectedNumbers}
            phase={gameState.phase}
          />

          {/* ── Post-Draw Settlement Summary ── */}
          {isSettled && evaluation && (
            <div
              role="status"
              data-testid="keno-result-summary"
              className={`rounded-2xl border p-4 space-y-3 animate-in fade-in duration-200 ${
                evaluation.isWin
                  ? 'bg-emerald-950/35 border-emerald-400/50 shadow-[0_0_24px_rgba(16,185,129,0.16)]'
                  : evaluation.isPush
                  ? 'bg-amber-950/25 border-amber-400/45'
                  : 'bg-[#101620] border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {evaluation.isWin ? (
                    <TrendingUp size={16} className="text-emerald-400 shrink-0" />
                  ) : (
                    <Sparkles size={15} className="text-slate-400 shrink-0" />
                  )}
                  <span
                    className={`text-sm font-display font-bold ${
                      evaluation.isWin
                        ? 'text-emerald-300'
                        : evaluation.isPush
                        ? 'text-amber-300'
                        : 'text-slate-200'
                    }`}
                  >
                    {evaluation.isWin
                      ? `Winning Ticket · ${evaluation.multiplier}×`
                      : evaluation.isPush
                      ? 'Push · Stake Returned (1×)'
                      : 'No Winning Match'}
                  </span>
                </div>

                {lastRoundResult?.xpGained ? (
                  <span className="text-[11px] font-mono text-emerald-400/90 tabular-nums">
                    +{lastRoundResult.xpGained} XP
                  </span>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums bg-[#090d14]/80 rounded-xl border border-slate-800/80 p-3">
                <div>
                  <span className="text-[10px] font-sans uppercase text-slate-500 block">
                    Matches
                  </span>
                  <span className="text-slate-100 font-bold">
                    {evaluation.hits} / {evaluation.spotCount}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-sans uppercase text-slate-500 block">
                    Total Wager
                  </span>
                  <span className="text-slate-200 font-bold">
                    {evaluation.wager.toLocaleString()} Cr
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-sans uppercase text-slate-500 block">
                    Gross Payout
                  </span>
                  <span
                    className={
                      evaluation.grossPayout > 0
                        ? 'text-amber-300 font-bold'
                        : 'text-slate-400 font-bold'
                    }
                  >
                    {evaluation.grossPayout.toLocaleString()} Cr
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-sans uppercase text-slate-500 block">
                    Net Profit / Loss
                  </span>
                  <span
                    className={
                      evaluation.net > 0
                        ? 'text-emerald-400 font-bold'
                        : evaluation.net === 0
                        ? 'text-amber-300 font-bold'
                        : 'text-rose-400 font-bold'
                    }
                  >
                    {evaluation.net > 0
                      ? `+${evaluation.net.toLocaleString()} Cr`
                      : `${evaluation.net.toLocaleString()} Cr`}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Dynamic Spot Paytable ── */}
          <div
            data-testid="keno-paytable"
            className="rounded-2xl bg-[#0f141d] border border-slate-800/90 p-4 space-y-2.5"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">
                Paytable ({activeSpotCount}-Spot Ticket)
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                Gross Payout
              </span>
            </div>

            <div className="divide-y divide-slate-800/70 rounded-xl border border-slate-800/80 bg-[#0a0f17] overflow-hidden">
              {paytableRows.map((row) => {
                const isMatchedRow =
                  isSettled &&
                  evaluation &&
                  evaluation.spotCount === activeSpotCount &&
                  evaluation.hits === row.hits &&
                  row.multiplier > 0;
                const creditPayout = Math.round(gameState.wager * row.multiplier);

                return (
                  <div
                    key={row.hits}
                    className={`flex items-center justify-between px-3 py-2 text-xs font-mono tabular-nums ${
                      isMatchedRow
                        ? 'bg-emerald-500/20 text-emerald-200 font-bold'
                        : 'text-slate-300'
                    }`}
                  >
                    <span>
                      {row.hits} {row.hits === 1 ? 'Match' : 'Matches'}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-amber-300">{row.multiplier}×</span>
                      <span className="text-slate-400 min-w-[68px] text-right">
                        {creditPayout.toLocaleString()} Cr
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Persistent Statistics & Last 15 Rounds History ── */}
          <div
            data-testid="keno-stats-history"
            className="rounded-2xl bg-[#0f141d] border border-slate-800/90 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Session Ledger
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                Last {gameState.history.length}/15
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center font-mono tabular-nums bg-[#0a0f17] rounded-xl border border-slate-800/80 p-2.5 text-xs">
              <div>
                <span className="text-[10px] font-sans text-slate-500 block">Rounds</span>
                <span data-testid="keno-stat-rounds" className="text-slate-100 font-bold">
                  {gameState.stats.totalRounds}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-sans text-slate-500 block">Wins</span>
                <span data-testid="keno-stat-wins" className="text-emerald-400 font-bold">
                  {gameState.stats.winningRounds}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-sans text-slate-500 block">Best Hits</span>
                <span data-testid="keno-stat-best-hits" className="text-amber-300 font-bold">
                  {gameState.stats.bestHits}
                </span>
              </div>
              <div className="col-span-3 pt-1.5 mt-1 border-t border-slate-800/70 flex items-center justify-between px-1">
                <span className="text-[11px] font-sans text-slate-400">
                  Top Payout:{' '}
                  <strong className="font-mono text-amber-300">
                    {gameState.stats.biggestGrossPayout.toLocaleString()} Cr
                  </strong>
                </span>
                <span className="text-[11px] font-sans text-slate-400">
                  Net:{' '}
                  <strong
                    data-testid="keno-stat-net"
                    className={`font-mono ${
                      gameState.stats.totalNet > 0
                        ? 'text-emerald-400'
                        : gameState.stats.totalNet < 0
                        ? 'text-rose-400'
                        : 'text-slate-300'
                    }`}
                  >
                    {gameState.stats.totalNet > 0
                      ? `+${gameState.stats.totalNet.toLocaleString()}`
                      : gameState.stats.totalNet.toLocaleString()}{' '}
                    Cr
                  </strong>
                </span>
              </div>
            </div>

            {gameState.history.length > 0 ? (
              <div
                data-testid="keno-history-list"
                className="max-h-48 overflow-y-auto space-y-1.5 pr-1"
              >
                {gameState.history.map((item) => (
                  <div
                    key={item.roundId}
                    className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-[#0a0f17] border border-slate-800/70 text-[11px] font-mono tabular-nums"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-bold ${
                          item.net > 0
                            ? 'text-emerald-400'
                            : item.net === 0
                            ? 'text-amber-300'
                            : 'text-slate-400'
                        }`}
                      >
                        {item.hits}/{item.spotCount} hits
                      </span>
                      <span className="text-slate-500">·</span>
                      <span className="text-slate-400">Bet {item.wager}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-slate-300">
                        {item.grossPayout > 0 ? `${item.grossPayout.toLocaleString()} Cr` : '0 Cr'}
                      </span>
                      <span
                        className={
                          item.net > 0
                            ? 'text-emerald-400 font-bold'
                            : item.net === 0
                            ? 'text-amber-300'
                            : 'text-rose-400'
                        }
                      >
                        {item.net > 0 ? `+${item.net}` : item.net}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] font-mono text-slate-500 text-center py-2">
                No completed Keno rounds yet.
              </p>
            )}
          </div>

          {/* ── Collapsible Keno Rules ── */}
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
                <span>How to Play 80-Ball Keno</span>
              </span>
              <ChevronDown
                size={15}
                className={`text-slate-400 transition-transform ${
                  isRulesOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isRulesOpen && (
              <div className="px-4 pb-4 pt-1 border-t border-slate-800/80 space-y-2 text-xs text-slate-400 leading-relaxed">
                <p>
                  Choose between 1 and 10 unique numbers from the 1–80 board, or use Quick Pick to
                  select your spots automatically. Each round draws 20 unique balls uniformly
                  without replacement.
                </p>
                <p>
                  Payouts depend on how many spots you selected and how many numbers match the 20
                  drawn balls. All paytable multipliers represent gross payout (including your
                  original stake).
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
