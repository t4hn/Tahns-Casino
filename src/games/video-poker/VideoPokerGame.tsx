import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GameProps, RoundResult } from '../../types/casino';
import {
  JACKS_OR_BETTER_PAYTABLE,
  isValidVideoPokerBet,
} from './videoPokerRules';
import {
  VideoPokerGameState,
  createInitialVideoPokerState,
  dealInitialPokerHand,
  toggleHoldCard,
  drawReplacementCards,
  claimVideoPokerSettlement,
} from './videoPokerState';
import { formatCardAccessibleName } from '../blackjack/deck';
import { PlayingCard } from '../blackjack/PlayingCard';
import { soundManager } from '../../utils/sound';
import {
  Sparkles,
  ChevronDown,
  TrendingUp,
  Layers,
  RefreshCw,
  Check,
} from 'lucide-react';

const CHIP_PRESETS = [20, 50, 100, 250, 500];

export const VideoPokerGame: React.FC<GameProps> = ({
  balance,
  minBet,
  maxBet,
  placeBet,
  resolveRound,
  updatePendingRound,
  animations,
}) => {
  const [wager, setWager] = useState<number>(() => {
    const target = Math.max(minBet, 20);
    const clamped = Math.min(target, maxBet, Math.max(minBet, balance));
    return Math.max(minBet, Math.floor(clamped / 10) * 10 || minBet);
  });

  const [gameState, setGameState] = useState<VideoPokerGameState>(() =>
    createInitialVideoPokerState()
  );
  const [visibleDealCount, setVisibleDealCount] = useState<number>(5);
  const [hiddenReplaceSlots, setHiddenReplaceSlots] = useState<Set<number>>(
    () => new Set()
  );
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastRoundResult, setLastRoundResult] = useState<RoundResult | null>(null);

  // Refs for rapid double-tap protection, stale callback avoidance, and unmount escrow settlement
  const actionLockRef = useRef<boolean>(false);
  const timeoutsRef = useRef<number[]>([]);
  const pendingEscrowRef = useRef<{
    roundId: string;
    bet: number;
    payout: number;
  } | null>(null);
  const settledRoundIdsRef = useRef<Set<string>>(new Set());

  const placeBetRef = useRef(placeBet);
  placeBetRef.current = placeBet;
  const resolveRoundRef = useRef(resolveRound);
  resolveRoundRef.current = resolveRound;
  const updatePendingRoundRef = useRef(updatePendingRound);
  updatePendingRoundRef.current = updatePendingRound;

  const clearAllTimers = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  };

  // Unmount cleanup ONLY (empty deps): clear timers and settle any active escrow hand immediately
  useEffect(() => {
    return () => {
      clearAllTimers();
      const pending = pendingEscrowRef.current;
      if (pending && !settledRoundIdsRef.current.has(pending.roundId)) {
        settledRoundIdsRef.current.add(pending.roundId);
        pendingEscrowRef.current = null;
        resolveRoundRef.current(pending.bet, pending.payout);
      }
    };
  }, []);

  const isIdle = gameState.phase === 'READY' || gameState.phase === 'SETTLED';

  // Clamp wager cleanly when balance changes between hands
  useEffect(() => {
    if (isIdle && balance >= minBet && wager > balance) {
      const clamped = Math.max(minBet, Math.floor(balance / 10) * 10 || minBet);
      setWager(clamped);
    }
  }, [balance, minBet, wager, isIdle]);

  const chipPresets = useMemo(
    () => CHIP_PRESETS.filter((p) => p >= minBet && p <= maxBet),
    [minBet, maxBet]
  );

  const scheduleTimeout = (fn: () => void, delayMs: number) => {
    const id = window.setTimeout(fn, delayMs);
    timeoutsRef.current.push(id);
    return id;
  };

  const settleHandOnce = (stateSnapshot: VideoPokerGameState) => {
    if (!stateSnapshot.resolution) return;
    if (settledRoundIdsRef.current.has(stateSnapshot.roundId)) {
      return;
    }

    const claim = claimVideoPokerSettlement(stateSnapshot);
    if (!claim.claimed) {
      return;
    }

    settledRoundIdsRef.current.add(stateSnapshot.roundId);
    pendingEscrowRef.current = null;

    const roundRes = resolveRoundRef.current(
      stateSnapshot.bet,
      stateSnapshot.resolution.totalPayout
    );
    setLastRoundResult(roundRes);
    setGameState(claim.state);
    setHiddenReplaceSlots(new Set());
    setIsAnimating(false);
    actionLockRef.current = false;

    if (!roundRes.success) {
      setErrorMsg(roundRes.error || 'Failed to settle Video Poker hand.');
      return;
    }

    if (stateSnapshot.resolution.won) {
      soundManager.playCoin();
    } else {
      soundManager.playClick();
    }
  };

  const handleSelectChip = (amount: number) => {
    if (!isIdle || isAnimating || actionLockRef.current) return;
    soundManager.playClick();
    const clamped = Math.max(minBet, Math.min(amount, maxBet, balance));
    const rounded = Math.max(minBet, Math.floor(clamped / 10) * 10);
    setWager(rounded);
    setErrorMsg(null);
  };

  const adjustWager = (delta: number) => {
    if (!isIdle || isAnimating || actionLockRef.current) return;
    soundManager.playClick();
    const raw = Math.max(minBet, Math.min(wager + delta, maxBet, balance));
    const rounded = Math.max(minBet, Math.floor(raw / 10) * 10);
    setWager(rounded);
    setErrorMsg(null);
  };

  const handleDeal = () => {
    if (actionLockRef.current || isAnimating || !isIdle) return;

    const validation = isValidVideoPokerBet(wager, minBet, maxBet, balance);
    if (!validation.valid) {
      soundManager.playLocked();
      setErrorMsg(validation.reason || 'Invalid wager.');
      return;
    }

    actionLockRef.current = true;
    clearAllTimers();

    const { state: dealtState, standPatPayout } = dealInitialPokerHand(wager);

    // Deduct wager via shared escrow BEFORE any animation
    const betRes = placeBetRef.current(wager, standPatPayout);
    if (!betRes.success) {
      actionLockRef.current = false;
      soundManager.playLocked();
      setErrorMsg(betRes.error || 'Failed to place wager.');
      return;
    }

    pendingEscrowRef.current = {
      roundId: dealtState.roundId,
      bet: wager,
      payout: standPatPayout,
    };

    setErrorMsg(null);
    setLastRoundResult(null);
    setHiddenReplaceSlots(new Set());
    setGameState(dealtState);
    soundManager.playClick();

    const useAnimations = animations !== false;
    if (!useAnimations) {
      setVisibleDealCount(5);
      setIsAnimating(false);
      actionLockRef.current = false;
      return;
    }

    setIsAnimating(true);
    setVisibleDealCount(0);

    for (let i = 1; i <= 5; i++) {
      scheduleTimeout(() => {
        soundManager.playClick();
        setVisibleDealCount(i);
      }, i * 65);
    }

    scheduleTimeout(() => {
      setIsAnimating(false);
      actionLockRef.current = false;
    }, 5 * 65 + 40);
  };

  const handleToggleHold = (index: number) => {
    if (gameState.phase !== 'DEALT' || isAnimating || actionLockRef.current) {
      return;
    }
    soundManager.playClick();
    setGameState((prev) => toggleHoldCard(prev, index));
  };

  const handleDraw = () => {
    if (
      actionLockRef.current ||
      isAnimating ||
      gameState.phase !== 'DEALT'
    ) {
      return;
    }

    actionLockRef.current = true;
    clearAllTimers();
    soundManager.playClick();

    const { state: drawingState, resolution, replacedIndices } =
      drawReplacementCards(gameState);

    // Sync persisted escrow with final predetermined outcome immediately
    pendingEscrowRef.current = {
      roundId: drawingState.roundId,
      bet: drawingState.bet,
      payout: resolution.totalPayout,
    };
    updatePendingRoundRef.current?.(drawingState.bet, resolution.totalPayout);

    const useAnimations = animations !== false;
    if (!useAnimations || replacedIndices.length === 0) {
      setGameState(drawingState);
      setVisibleDealCount(5);
      settleHandOnce(drawingState);
      return;
    }

    // Briefly flip replaced cards face-down, then reveal sequentially
    setIsAnimating(true);
    setGameState(drawingState);
    setVisibleDealCount(5);
    setHiddenReplaceSlots(new Set(replacedIndices));

    replacedIndices.forEach((slotIdx, step) => {
      scheduleTimeout(() => {
        soundManager.playClick();
        setHiddenReplaceSlots((prev) => {
          const next = new Set(prev);
          next.delete(slotIdx);
          return next;
        });
      }, 150 + step * 95);
    });

    scheduleTimeout(() => {
      settleHandOnce(drawingState);
    }, 150 + replacedIndices.length * 95 + 120);
  };

  const activeWagerDisplay = isIdle ? wager : gameState.bet;
  const heldCount = gameState.heldIndices.filter(Boolean).length;
  const replaceCount = 5 - heldCount;
  const activeWinSet = useMemo(() => {
    if (gameState.phase === 'SETTLED' && gameState.resolution?.won) {
      return new Set(gameState.resolution.winningCardIndices);
    }
    return new Set<number>();
  }, [gameState.phase, gameState.resolution]);

  const activeCategoryHighlight =
    gameState.phase === 'SETTLED' && gameState.resolution?.won
      ? gameState.resolution.category
      : gameState.phase === 'DEALT' && gameState.initialEvaluation?.won
      ? gameState.initialEvaluation.category
      : null;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-3.5 pb-6">
      {/* ── Primary Video Poker Cabinet Card ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#0c241b] via-[#0a1915] to-[#080f14] border border-emerald-500/35 p-3 sm:p-5 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.12)_0%,transparent_70%)] pointer-events-none" />

        <div className="relative space-y-3.5">
          {/* Header Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-emerald-500/15 text-[11px]">
            <div className="flex items-center gap-1.5 text-emerald-300/90 font-medium">
              <Layers size={13} className="text-amber-300 shrink-0" />
              <span>Jacks or Better · 9/6 Full Pay</span>
            </div>

            <div className="flex items-center gap-3 font-mono tabular-nums">
              <span className="text-slate-300">
                Wager:{' '}
                <strong className="text-amber-300">
                  {activeWagerDisplay.toLocaleString()}
                </strong>
              </span>
              <span className="text-slate-600" aria-hidden="true">
                ·
              </span>
              <span className="text-slate-300">
                Balance:{' '}
                <strong className="text-emerald-300">
                  {balance.toLocaleString()}
                </strong>
              </span>
            </div>
          </div>

          {/* ── Prominent Jacks or Better Paytable ── */}
          <section
            aria-label="Jacks or Better Paytable"
            className="rounded-xl bg-[#07110e]/90 border border-emerald-500/20 p-2.5 sm:p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-1 mb-2 pb-1.5 border-b border-slate-800/80 text-[10px] text-slate-400">
              <span className="font-semibold text-slate-200 tracking-wide">
                Paytable · Net Winnings
              </span>
              <span className="font-mono text-slate-400">
                Odds relative to wager (stake returned on win)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono tabular-nums">
              {JACKS_OR_BETTER_PAYTABLE.map((entry) => {
                const isMatchedSettled =
                  gameState.phase === 'SETTLED' &&
                  activeCategoryHighlight === entry.category;
                const isDealtHint =
                  gameState.phase === 'DEALT' &&
                  activeCategoryHighlight === entry.category;
                const netWinForWager = activeWagerDisplay * entry.odds;

                return (
                  <div
                    key={entry.category}
                    data-testid={`paytable-row-${entry.category}`}
                    className={`flex items-center justify-between px-2 py-0.5 rounded transition-colors ${
                      isMatchedSettled
                        ? 'bg-emerald-500/20 text-amber-200 border border-amber-400/50 font-bold'
                        : isDealtHint
                        ? 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/30'
                        : 'text-slate-300 border border-transparent'
                    }`}
                  >
                    <span className="font-sans truncate pr-2">{entry.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={
                          isMatchedSettled ? 'text-amber-300' : 'text-emerald-400'
                        }
                      >
                        {entry.odds}:1
                      </span>
                      <span className="text-slate-400 text-[10px] min-w-[66px] text-right">
                        +{netWinForWager.toLocaleString()} Cr
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Five-Card Horizontal Row ── */}
          <div
            data-testid="video-poker-hand"
            className="rounded-xl bg-[#07130f]/80 border border-emerald-500/20 px-1.5 py-3 sm:px-3 sm:py-4"
          >
            <div className="grid grid-cols-5 gap-1 sm:gap-2.5 place-items-center">
              {[0, 1, 2, 3, 4].map((slotIdx) => {
                const card = gameState.hand[slotIdx];
                const isVisible = card && slotIdx < visibleDealCount;
                const isHeld = gameState.heldIndices[slotIdx];
                const isHiddenFlip = hiddenReplaceSlots.has(slotIdx);
                const isInteractive = gameState.phase === 'DEALT' && !isAnimating;
                const isWinCard = activeWinSet.has(slotIdx);

                if (!isVisible) {
                  return (
                    <div
                      key={slotIdx}
                      className="flex flex-col items-center gap-1.5"
                    >
                      <span
                        aria-hidden="true"
                        className="h-5 text-[10px] font-mono opacity-0 select-none"
                      >
                        HOLD
                      </span>
                      <div className="w-[56px] h-[80px] sm:w-[76px] sm:h-[108px] rounded-lg sm:rounded-xl border border-dashed border-emerald-500/25 bg-[#091913]/60 flex items-center justify-center">
                        <span className="text-emerald-500/35 font-display text-sm sm:text-base font-bold">
                          VP
                        </span>
                      </div>
                    </div>
                  );
                }

                const accessibleStatus =
                  gameState.phase === 'DEALT'
                    ? isHeld
                      ? 'Held, click to release'
                      : 'Not held, click to hold'
                    : isWinCard
                    ? 'Winning card'
                    : 'Dealt card';

                return (
                  <button
                    key={`${card.id}_${slotIdx}`}
                    type="button"
                    data-testid={`poker-card-${slotIdx}`}
                    onClick={() => handleToggleHold(slotIdx)}
                    disabled={!isInteractive}
                    aria-pressed={gameState.phase === 'DEALT' ? isHeld : undefined}
                    aria-label={`Card ${slotIdx + 1}: ${formatCardAccessibleName(
                      card
                    )}, ${accessibleStatus}`}
                    className={`group flex flex-col items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-xl p-0.5 transition-transform duration-150 ${
                      isInteractive
                        ? 'cursor-pointer'
                        : 'cursor-default'
                    } ${
                      isHeld
                        ? '-translate-y-1.5'
                        : isInteractive
                        ? 'hover:-translate-y-0.5'
                        : ''
                    }`}
                  >
                    {/* Clear HOLD Badge */}
                    <span
                      className={`h-5 px-2 rounded text-[10px] font-mono font-bold tracking-wider flex items-center justify-center gap-0.5 transition-all ${
                        isHeld
                          ? 'bg-amber-400 text-slate-950 shadow-sm shadow-amber-500/40'
                          : isInteractive
                          ? 'bg-slate-800/80 text-slate-400 border border-slate-700/70 group-hover:text-slate-200 group-hover:border-slate-500'
                          : 'opacity-0'
                      }`}
                    >
                      {isHeld ? (
                        <>
                          <Check size={10} strokeWidth={3} />
                          <span>HOLD</span>
                        </>
                      ) : (
                        <span>TAP</span>
                      )}
                    </span>

                    {/* Reuse existing PlayingCard asset cleanly */}
                    <div
                      className={`rounded-lg sm:rounded-xl transition-all [&>div]:w-[56px] [&>div]:h-[80px] sm:[&>div]:w-[76px] sm:[&>div]:h-[108px] ${
                        isHeld && gameState.phase === 'DEALT'
                          ? 'ring-2 ring-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.35)]'
                          : isInteractive
                          ? 'opacity-90 group-hover:opacity-100'
                          : ''
                      }`}
                    >
                      <PlayingCard
                        card={card}
                        index={0}
                        hidden={isHiddenFlip}
                        highlight={isWinCard}
                        animateDeal={animations !== false}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Compact Center Status / Result Strip ── */}
          <div
            data-testid="video-poker-status"
            className="min-h-[30px] w-full flex items-center justify-center text-xs font-mono px-2 text-center"
          >
            {gameState.phase === 'SETTLED' && gameState.resolution ? (
              gameState.resolution.won ? (
                <div className="flex items-center gap-1.5 text-emerald-300 font-semibold animate-in fade-in duration-150">
                  <Sparkles size={13} className="text-amber-300 shrink-0" />
                  <span>
                    {gameState.resolution.name}! Won +
                    {gameState.resolution.netWinnings.toLocaleString()} Credits (Payout{' '}
                    {gameState.resolution.totalPayout.toLocaleString()})
                  </span>
                </div>
              ) : (
                <div className="text-rose-300 font-semibold animate-in fade-in duration-150">
                  {gameState.resolution.name} · Lost{' '}
                  {gameState.bet.toLocaleString()} Credits
                </div>
              )
            ) : errorMsg ? (
              <span className="text-rose-400 font-sans text-[11px] font-medium">
                {errorMsg}
              </span>
            ) : gameState.phase === 'DRAWING' ||
              (gameState.phase === 'DEALT' && isAnimating) ? (
              <span className="text-amber-300 text-[11px]">
                {gameState.phase === 'DRAWING'
                  ? 'Drawing replacement cards...'
                  : 'Dealing five cards...'}
              </span>
            ) : gameState.phase === 'DEALT' ? (
              <span className="text-emerald-300 font-sans text-[11px] font-medium">
                {gameState.initialEvaluation?.won
                  ? `Dealt ${gameState.initialEvaluation.name} · `
                  : ''}
                {heldCount === 0
                  ? 'Tap cards to HOLD, then press Draw'
                  : `${heldCount} ${heldCount === 1 ? 'card' : 'cards'} held — Tap to adjust or press Draw`}
              </span>
            ) : balance < minBet ? (
              <span className="text-amber-400 font-sans text-[11px] font-medium">
                You need at least {minBet} credits to play
              </span>
            ) : (
              <span className="text-slate-400 font-sans text-[11px]">
                Ready to play · Select wager and press Deal
              </span>
            )}
          </div>

          {/* ── Primary Action Controls (DEAL / DRAW / NEW HAND) ── */}
          <div className="pt-0.5">
            {isIdle ? (
              <button
                key="deal-action"
                type="button"
                onClick={handleDeal}
                disabled={isAnimating || balance < minBet}
                className={`w-full py-2.5 px-4 rounded-xl font-display font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg transition-all min-h-[44px] ${
                  isAnimating || balance < minBet
                    ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                    : 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 hover:from-emerald-400 hover:to-emerald-300 text-slate-950 shadow-emerald-500/20 active:scale-[0.99] cursor-pointer'
                }`}
              >
                <Layers size={18} className="shrink-0" />
                <span className="truncate">
                  {balance < minBet
                    ? `You need at least ${minBet} credits to play`
                    : gameState.phase === 'SETTLED'
                    ? `New Hand · ${wager.toLocaleString()} Credits`
                    : `Deal Hand · ${wager.toLocaleString()} Credits`}
                </span>
              </button>
            ) : (
              <button
                key="draw-action"
                type="button"
                onClick={handleDraw}
                disabled={isAnimating || gameState.phase !== 'DEALT'}
                className={`w-full py-2.5 px-4 rounded-xl font-display font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg transition-all min-h-[44px] ${
                  isAnimating || gameState.phase !== 'DEALT'
                    ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                    : 'bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 hover:from-amber-300 hover:to-amber-200 text-slate-950 shadow-amber-500/20 active:scale-[0.99] cursor-pointer'
                }`}
              >
                <RefreshCw
                  size={17}
                  className={`shrink-0 ${
                    gameState.phase === 'DRAWING' ? 'animate-spin' : ''
                  }`}
                />
                <span className="truncate">
                  {gameState.phase === 'DRAWING'
                    ? 'Drawing...'
                    : replaceCount === 0
                    ? 'Draw · Keep All 5 Cards'
                    : `Draw · Replace ${replaceCount} ${
                        replaceCount === 1 ? 'Card' : 'Cards'
                      }`}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Wager Adjustment Controls (active in READY / SETTLED) ── */}
      <div className="bg-[#0f141d] border border-slate-800 rounded-xl p-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
          {/* Stepper Group */}
          <div className="flex items-center justify-between sm:justify-start gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => adjustWager(-10)}
              disabled={!isIdle || isAnimating || wager <= minBet}
              className="min-h-[40px] min-w-[40px] px-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 text-slate-200 text-xs font-bold flex items-center justify-center transition-colors shrink-0"
              title="Decrease wager by 10"
            >
              -10
            </button>

            <div className="flex-1 sm:flex-none min-w-[74px] text-center px-2 py-1 rounded-lg bg-[#090d13] border border-slate-800 shrink-0">
              <span className="text-sm font-bold font-mono text-amber-300 tabular-nums">
                {wager.toLocaleString()}
              </span>
              <span className="block text-[9px] text-slate-400 font-sans uppercase -mt-0.5">
                Credits
              </span>
            </div>

            <button
              type="button"
              onClick={() => adjustWager(10)}
              disabled={
                !isIdle ||
                isAnimating ||
                wager + 10 > maxBet ||
                wager + 10 > balance
              }
              className="min-h-[40px] min-w-[40px] px-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 text-slate-200 text-xs font-bold flex items-center justify-center transition-colors shrink-0"
              title="Increase wager by 10"
            >
              +10
            </button>
          </div>

          <div className="hidden sm:block h-6 w-px bg-slate-800 shrink-0" />

          {/* Quick Presets + MAX */}
          <div className="grid grid-cols-6 sm:flex sm:items-center gap-1 flex-1 justify-end">
            {chipPresets.map((preset) => {
              const isOverLimit = preset > maxBet || preset > balance;
              const isSelected = wager === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleSelectChip(preset)}
                  disabled={!isIdle || isAnimating || isOverLimit}
                  className={`min-h-[40px] px-1.5 sm:px-2.5 rounded-lg text-xs font-mono font-semibold transition-all flex items-center justify-center shrink-0 ${
                    isSelected
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-400/80 shadow-xs'
                      : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700 hover:bg-slate-800'
                  } ${
                    !isIdle || isOverLimit
                      ? 'opacity-30 cursor-not-allowed'
                      : 'cursor-pointer active:scale-95'
                  }`}
                >
                  <span>{preset}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() =>
                handleSelectChip(
                  Math.max(
                    minBet,
                    Math.floor(Math.min(maxBet, balance) / 10) * 10 || minBet
                  )
                )
              }
              disabled={!isIdle || isAnimating || balance < minBet}
              className="min-h-[40px] px-2 sm:px-2.5 rounded-lg text-xs font-sans font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-40 transition-colors shrink-0 flex items-center justify-center"
            >
              MAX
            </button>
          </div>
        </div>
      </div>

      {/* ── Collapsed Rules & Hand Rankings ── */}
      <details className="group rounded-xl bg-[#090d13] border border-slate-800/80 p-3 text-xs text-slate-400">
        <summary className="flex items-center justify-between cursor-pointer list-none select-none text-slate-300 font-medium">
          <div className="flex items-center gap-1.5">
            <TrendingUp size={13} className="text-emerald-400" />
            <span className="text-xs">Rules &amp; hand rankings</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500">
            <span className="text-[10px] font-mono group-open:hidden">
              Tap to view
            </span>
            <ChevronDown
              size={14}
              className="transition-transform duration-200 group-open:rotate-180"
            />
          </div>
        </summary>
        <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-1 text-[11px] leading-relaxed text-slate-400">
          <p>
            • <strong className="text-slate-200">Single 52-Card Deck</strong>:
            Shuffled freshly before every deal using cryptographic randomness.
          </p>
          <p>
            • <strong className="text-slate-200">Hold &amp; Draw</strong>: Select
            any cards you wish to keep before pressing Draw. All unheld cards are
            replaced from the remaining 47 cards.
          </p>
          <p>
            • <strong className="text-slate-200">Jacks or Better</strong>: A
            single pair pays 1:1 only when it consists of Jacks, Queens, Kings,
            or Aces. Pairs of 2s through 10s do not pay.
          </p>
          <p>
            • <strong className="text-slate-200">Payout Convention</strong>:
            Odds (e.g. <strong className="text-emerald-400">9:1</strong> Full
            House) represent net winnings relative to your wager; winning hands
            return your original wager plus those winnings.
          </p>
          <div className="pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span>
              Limits: {minBet} - {maxBet.toLocaleString()} Credits
            </span>
            <span>Target RTP: 99.2%</span>
          </div>
        </div>
      </details>

      {lastRoundResult && !lastRoundResult.success && lastRoundResult.error && (
        <p className="sr-only">{lastRoundResult.error}</p>
      )}
    </div>
  );
};
