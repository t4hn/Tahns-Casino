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
  Crown,
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
  const maxAllowedWager = Math.max(
    minBet,
    Math.floor(Math.min(maxBet, balance) / 10) * 10 || minBet
  );

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

  const isRoyalOrStraightFlush =
    gameState.phase === 'SETTLED' &&
    Boolean(
      gameState.resolution?.won &&
        (gameState.resolution.category === 'royal_flush' ||
          gameState.resolution.category === 'straight_flush')
    );

  const isMajorHand =
    gameState.phase === 'SETTLED' &&
    Boolean(
      gameState.resolution?.won &&
        (gameState.resolution.category === 'royal_flush' ||
          gameState.resolution.category === 'straight_flush' ||
          gameState.resolution.category === 'four_of_a_kind')
    );

  const [royalEntry, ...otherPaytableEntries] = JACKS_OR_BETTER_PAYTABLE;
  const primaryGoldCtaClass =
    'bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 hover:from-amber-300 hover:via-amber-200 hover:to-amber-300 text-slate-950 border border-amber-200/50 shadow-lg shadow-amber-500/20 active:scale-[0.99] cursor-pointer';

  const renderPaytableRow = (
    entry: (typeof JACKS_OR_BETTER_PAYTABLE)[number],
    featuredSpan = false
  ) => {
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
        className={`relative overflow-hidden flex items-center justify-between gap-1 px-1.5 sm:px-2 py-1 rounded-md border transition-colors ${
          featuredSpan ? 'col-span-2' : ''
        } ${
          isMatchedSettled
            ? `bg-amber-400/20 text-amber-100 border-amber-400/80 shadow-[0_0_14px_rgba(251,191,36,0.22)] font-semibold ${
                isRoyalOrStraightFlush && animations !== false
                  ? 'vp-jackpot-enter'
                  : ''
              }`
            : isDealtHint
            ? 'bg-emerald-500/15 text-emerald-100 border-emerald-400/50 font-medium'
            : featuredSpan
            ? 'bg-amber-500/[0.06] text-amber-100/95 border-amber-400/20'
            : 'text-slate-300 border-transparent'
        }`}
      >
        {isMatchedSettled && isRoyalOrStraightFlush && animations !== false && (
          <span
            aria-hidden="true"
            className="vp-royal-sweep pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-amber-200/25 to-transparent"
          />
        )}
        <span className="font-sans tracking-tight sm:tracking-normal whitespace-nowrap">
          {entry.name}
        </span>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <span
            className={
              isMatchedSettled
                ? 'text-amber-300 font-bold'
                : isDealtHint
                ? 'text-emerald-300 font-semibold'
                : featuredSpan
                ? 'text-amber-300 font-semibold'
                : 'text-emerald-400'
            }
          >
            {entry.odds}:1
          </span>
          <span
            className={`text-[9.5px] sm:text-[10px] text-right sm:min-w-[64px] ${
              isMatchedSettled ? 'text-amber-200' : 'text-slate-400'
            }`}
          >
            +{netWinForWager.toLocaleString()}
            <span className="hidden sm:inline"> Cr</span>
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-2.5 sm:space-y-3.5 pb-2 sm:pb-6">
      {/* ── Primary Video Poker Cabinet Card ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#0c241b] via-[#0a1915] to-[#080f14] border border-emerald-500/35 p-2.5 sm:p-5 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.12)_0%,transparent_70%)] pointer-events-none" />

        <div className="relative space-y-2.5 sm:space-y-3.5">
          {/* Header Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-emerald-500/15 text-[11px]">
            <div className="flex items-center gap-1.5 text-emerald-300/90 font-medium">
              <Layers size={13} className="text-amber-300 shrink-0" />
              <span>Jacks or Better · 9/6 Full Pay</span>
            </div>

            <div className="flex items-center gap-2.5 font-mono tabular-nums">
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

          {/* ── Compact 2-Column Jacks or Better Paytable ── */}
          <section
            aria-label="Jacks or Better Paytable"
            className="rounded-xl bg-[#07110e]/90 border border-emerald-500/20 p-2 sm:p-2.5"
          >
            <div className="flex items-center justify-between gap-2 mb-1.5 pb-1 border-b border-slate-800/80 text-[10px] text-slate-400">
              <span className="font-semibold text-slate-200 tracking-wide">
                Paytable · Net Credits
              </span>
              <span className="font-mono text-slate-400 truncate">
                <span className="sm:hidden">Odds · stake returned</span>
                <span className="hidden sm:inline">
                  Odds relative to wager (stake returned on win)
                </span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1 sm:gap-x-3 sm:gap-y-1 text-[10px] sm:text-[11px] font-mono tabular-nums">
              {renderPaytableRow(royalEntry, true)}
              {otherPaytableEntries.map((entry) => renderPaytableRow(entry))}
            </div>
          </section>

          {/* ── Five-Card Horizontal Row ── */}
          <div
            data-testid="video-poker-hand"
            className={`rounded-xl border px-1.5 py-2.5 sm:px-3 sm:py-3.5 transition-colors ${
              gameState.phase === 'DEALT'
                ? 'bg-[#081913]/90 border-emerald-400/30'
                : gameState.phase === 'SETTLED' && gameState.resolution?.won
                ? 'bg-[#091812]/90 border-amber-400/30'
                : 'bg-[#07130f]/80 border-emerald-500/20'
            }`}
          >
            <div className="grid grid-cols-5 gap-1 sm:gap-2.5 place-items-center">
              {[0, 1, 2, 3, 4].map((slotIdx) => {
                const card = gameState.hand[slotIdx];
                const isVisible = card && slotIdx < visibleDealCount;
                const isHeld = gameState.heldIndices[slotIdx];
                const isHiddenFlip = hiddenReplaceSlots.has(slotIdx);
                const isInteractive = gameState.phase === 'DEALT' && !isAnimating;
                const isWinCard = activeWinSet.has(slotIdx);
                const dimNonWinningCard =
                  gameState.phase === 'SETTLED' &&
                  Boolean(gameState.resolution?.won) &&
                  !isWinCard;

                if (!isVisible) {
                  return (
                    <div
                      key={slotIdx}
                      className="flex flex-col items-center gap-1"
                    >
                      <span
                        aria-hidden="true"
                        className="h-[20px] text-[9px] font-mono opacity-0 select-none"
                      >
                        HOLD
                      </span>
                      <div className="w-[56px] h-[80px] sm:w-[76px] sm:h-[108px] rounded-lg sm:rounded-xl border border-dashed border-emerald-500/30 bg-[#091b14]/70 flex items-center justify-center shadow-inner">
                        <span className="text-emerald-400/35 font-display text-sm sm:text-base font-bold tracking-wider">
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

                const showHoldBadge =
                  gameState.phase === 'DEALT' ||
                  gameState.phase === 'DRAWING' ||
                  (gameState.phase === 'SETTLED' && isHeld);

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
                    className={`group flex flex-col items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-xl p-0.5 transition-transform duration-150 ${
                      isInteractive ? 'cursor-pointer' : 'cursor-default'
                    } ${
                      isHeld && gameState.phase === 'DEALT'
                        ? '-translate-y-2'
                        : isWinCard
                        ? '-translate-y-1.5'
                        : isInteractive
                        ? 'hover:-translate-y-0.5'
                        : ''
                    }`}
                  >
                    {/* Clear Emerald HOLD Indicator */}
                    <span
                      className={`h-[20px] px-1.5 sm:px-2 rounded text-[9px] sm:text-[10px] font-mono tracking-wider flex items-center justify-center gap-0.5 transition-all whitespace-nowrap ${
                        !showHoldBadge
                          ? 'opacity-0 pointer-events-none'
                          : isHeld && gameState.phase === 'DEALT'
                          ? 'bg-emerald-400 text-slate-950 font-bold border border-emerald-200/80 shadow-[0_2px_10px_rgba(16,185,129,0.45)]'
                          : isHeld
                          ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-400/40'
                          : 'bg-[#071510]/85 text-emerald-400/50 font-medium border border-emerald-500/25 group-hover:text-emerald-200 group-hover:border-emerald-400/60 group-hover:bg-emerald-950/60'
                      }`}
                    >
                      {isHeld && <Check size={9} strokeWidth={3} />}
                      <span>HOLD</span>
                    </span>

                    {/* Reuse existing PlayingCard asset cleanly */}
                    <div
                      className={`rounded-lg sm:rounded-xl transition-all duration-150 [&>div]:w-[56px] [&>div]:h-[80px] sm:[&>div]:w-[76px] sm:[&>div]:h-[108px] ${
                        isHeld && gameState.phase === 'DEALT'
                          ? 'ring-2 ring-emerald-400 shadow-[0_6px_18px_rgba(16,185,129,0.4)]'
                          : isWinCard && isMajorHand && animations !== false
                          ? 'vp-jackpot-enter drop-shadow-[0_0_16px_rgba(251,191,36,0.45)]'
                          : dimNonWinningCard
                          ? 'opacity-55'
                          : isInteractive
                          ? 'opacity-95 group-hover:opacity-100'
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

          {/* ── Prominent Center State & Result Banner ── */}
          <div
            data-testid="video-poker-status"
            className="min-h-[38px] w-full flex items-center justify-center text-center"
          >
            {gameState.phase === 'SETTLED' && gameState.resolution ? (
              gameState.resolution.won ? (
                <div
                  className={`relative overflow-hidden w-full rounded-xl px-3 py-1.5 sm:py-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 border ${
                    isRoyalOrStraightFlush
                      ? 'border-amber-400/80 bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-amber-500/20 shadow-[0_0_24px_rgba(251,191,36,0.22)]'
                      : isMajorHand
                      ? 'border-amber-400/65 bg-gradient-to-r from-amber-500/15 via-emerald-950/80 to-amber-500/15'
                      : 'border-amber-400/45 bg-emerald-950/65'
                  } ${
                    isRoyalOrStraightFlush && animations !== false
                      ? 'vp-jackpot-enter'
                      : 'animate-in fade-in duration-150'
                  }`}
                >
                  {isRoyalOrStraightFlush && animations !== false && (
                    <span
                      aria-hidden="true"
                      className="vp-royal-sweep pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-amber-200/30 to-transparent"
                    />
                  )}
                  {isRoyalOrStraightFlush ? (
                    <Crown size={16} className="text-amber-300 shrink-0" />
                  ) : (
                    <Sparkles size={15} className="text-amber-300 shrink-0" />
                  )}
                  <span className="font-display text-sm sm:text-base font-bold text-amber-200 tracking-wide">
                    {gameState.resolution.name}! Won +
                    {gameState.resolution.netWinnings.toLocaleString()} Credits
                  </span>
                  <span className="text-[11px] font-mono text-emerald-300/90 tabular-nums">
                    (Payout {gameState.resolution.totalPayout.toLocaleString()})
                  </span>
                </div>
              ) : (
                <div className="w-full rounded-lg bg-slate-900/60 border border-rose-500/20 px-3 py-1.5 text-rose-300/95 text-xs font-mono font-medium animate-in fade-in duration-150">
                  {gameState.resolution.name} · Lost{' '}
                  {gameState.bet.toLocaleString()} Credits
                </div>
              )
            ) : errorMsg ? (
              <span className="text-rose-400 font-sans text-xs font-medium">
                {errorMsg}
              </span>
            ) : gameState.phase === 'DRAWING' ||
              (gameState.phase === 'DEALT' && isAnimating) ? (
              <span className="text-amber-300 font-mono text-xs">
                {gameState.phase === 'DRAWING'
                  ? 'Drawing replacement cards...'
                  : 'Dealing five cards...'}
              </span>
            ) : gameState.phase === 'DEALT' ? (
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-xs">
                {gameState.initialEvaluation?.won && (
                  <span className="font-semibold text-amber-300">
                    Dealt {gameState.initialEvaluation.name}
                    <span aria-hidden="true" className="text-slate-500 ml-2">
                      ·
                    </span>
                  </span>
                )}
                <span className="text-emerald-300 font-sans font-medium">
                  {heldCount === 0
                    ? 'Select cards to HOLD, then press Draw'
                    : `${heldCount} ${
                        heldCount === 1 ? 'card' : 'cards'
                      } held · Tap cards to adjust or press Draw`}
                </span>
              </div>
            ) : balance < minBet ? (
              <span className="text-amber-400 font-sans text-xs font-medium">
                You need at least {minBet} credits to play
              </span>
            ) : (
              <span className="text-slate-300/80 font-sans text-xs">
                Ready to play · Set wager and press Deal Hand
              </span>
            )}
          </div>

          {/* ── Primary Action Controls (Unified Gold for DEAL & DRAW) ── */}
          <div>
            {isIdle ? (
              <button
                key="deal-action"
                type="button"
                onClick={handleDeal}
                disabled={isAnimating || balance < minBet}
                className={`w-full py-2.5 px-4 rounded-xl font-display font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all min-h-[44px] ${
                  isAnimating || balance < minBet
                    ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                    : primaryGoldCtaClass
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
                className={`w-full py-2.5 px-4 rounded-xl font-display font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all min-h-[44px] ${
                  isAnimating || gameState.phase !== 'DEALT'
                    ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                    : primaryGoldCtaClass
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

      {/* ── Sleek Wager Adjustment Bar (active in READY / SETTLED) ── */}
      <div
        className={`bg-[#0b1311]/90 border border-emerald-500/20 rounded-xl px-2.5 py-2 transition-opacity ${
          !isIdle ? 'opacity-55' : ''
        }`}
      >
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-1.5">
          {/* Stepper & Active Wager Pill */}
          <div className="order-1 flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => adjustWager(-10)}
              disabled={!isIdle || isAnimating || wager <= minBet}
              className="h-[38px] min-w-[38px] px-2 rounded-lg bg-slate-900/90 border border-slate-700/80 hover:bg-slate-800 hover:border-slate-600 disabled:opacity-40 text-slate-200 text-xs font-mono font-bold flex items-center justify-center transition-colors shrink-0 cursor-pointer disabled:cursor-not-allowed"
              title="Decrease wager by 10"
            >
              -10
            </button>

            <div className="h-[38px] min-w-[78px] px-2.5 rounded-lg bg-[#060c0a] border border-amber-400/50 flex items-center justify-center gap-1 shrink-0">
              <span className="text-sm font-bold font-mono text-amber-300 tabular-nums">
                {wager.toLocaleString()}
              </span>
              <span className="text-[10px] font-mono text-amber-200/70">Cr</span>
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
              className="h-[38px] min-w-[38px] px-2 rounded-lg bg-slate-900/90 border border-slate-700/80 hover:bg-slate-800 hover:border-slate-600 disabled:opacity-40 text-slate-200 text-xs font-mono font-bold flex items-center justify-center transition-colors shrink-0 cursor-pointer disabled:cursor-not-allowed"
              title="Increase wager by 10"
            >
              +10
            </button>
          </div>

          <div className="hidden sm:block h-6 w-px bg-emerald-500/20 shrink-0" />

          {/* Chip Presets (Emerald Selection State) */}
          <div className="order-3 sm:order-2 basis-full sm:basis-auto sm:flex-1 grid grid-cols-5 sm:flex sm:items-center sm:justify-end gap-1">
            {chipPresets.map((preset) => {
              const isOverLimit = preset > maxBet || preset > balance;
              const isSelected = wager === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleSelectChip(preset)}
                  disabled={!isIdle || isAnimating || isOverLimit}
                  aria-pressed={isSelected}
                  className={`h-[38px] px-1.5 sm:px-2.5 rounded-lg text-xs font-mono transition-all flex items-center justify-center shrink-0 ${
                    isSelected
                      ? 'bg-emerald-500/25 text-emerald-100 border border-emerald-400 ring-1 ring-emerald-400/50 font-bold shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                      : 'bg-slate-900/90 text-slate-300 border border-slate-800 hover:border-emerald-500/35 hover:bg-slate-800 font-medium'
                  } ${
                    !isIdle || isOverLimit
                      ? 'opacity-35 cursor-not-allowed'
                      : 'cursor-pointer active:scale-95'
                  }`}
                >
                  <span>{preset}</span>
                </button>
              );
            })}
          </div>

          {/* Distinct MAX Control */}
          <button
            type="button"
            onClick={() => handleSelectChip(maxAllowedWager)}
            disabled={!isIdle || isAnimating || balance < minBet}
            aria-pressed={wager === maxAllowedWager && balance >= minBet}
            className={`order-2 sm:order-3 ml-auto sm:ml-0 h-[38px] px-3 rounded-lg text-[11px] font-display font-bold tracking-wider transition-all shrink-0 flex items-center justify-center border ${
              wager === maxAllowedWager && balance >= minBet
                ? 'bg-emerald-500/25 text-emerald-100 border-emerald-300 ring-1 ring-emerald-400/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                : 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50 hover:bg-emerald-900/70 hover:border-emerald-400'
            } ${
              !isIdle || balance < minBet
                ? 'opacity-40 cursor-not-allowed'
                : 'cursor-pointer active:scale-95'
            }`}
          >
            MAX
          </button>
        </div>
      </div>

      {/* ── Collapsed Rules & Hand Rankings ── */}
      <details className="group rounded-xl bg-[#090d13] border border-slate-800/80 px-3 py-2.5 text-xs text-slate-400">
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
        <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-1 text-[11px] leading-relaxed text-slate-400">
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
