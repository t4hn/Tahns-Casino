import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GameProps, RoundResult } from '../../types/casino';
import {
  BlackjackGameState,
  createInitialBlackjackState,
  dealInitialHand,
  playerHit,
  playerStand,
  playerDoubleDown,
  canDoubleDown,
  claimSettlement,
} from './blackjackState';
import {
  BlackjackResolution,
  evaluateHand,
  isValidBlackjackBet,
} from './blackjackRules';
import { getCardPointValue } from './deck';
import { PlayingCard } from './PlayingCard';
import { soundManager } from '../../utils/sound';
import {
  Sparkles,
  ChevronDown,
  TrendingUp,
  Spade,
  Hand,
  Plus,
  Layers,
} from 'lucide-react';

const CHIP_PRESETS = [25, 50, 100, 250, 500];

export const BlackjackGame: React.FC<GameProps> = ({
  balance,
  minBet,
  maxBet,
  placeBet,
  resolveRound,
  updatePendingRound,
  animations,
}) => {
  const [wager, setWager] = useState<number>(() => {
    const defaultTarget = Math.max(minBet, 50);
    const clamped = Math.min(defaultTarget, maxBet, Math.max(minBet, balance));
    return Math.max(minBet, Math.floor(clamped / 25) * 25 || minBet);
  });

  const [gameState, setGameState] = useState<BlackjackGameState>(() =>
    createInitialBlackjackState()
  );
  const [visiblePlayerCount, setVisiblePlayerCount] = useState<number>(0);
  const [visibleDealerCount, setVisibleDealerCount] = useState<number>(0);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastRoundResult, setLastRoundResult] = useState<RoundResult | null>(null);

  // Refs to prevent rapid double-tap bugs, stale callbacks across re-renders, and stranded escrow on unmount
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

  // Unmount cleanup ONLY (empty deps): clear timers and immediately settle any active escrow hand once
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

  // Clamp wager during BETTING/SETTLED if balance changes below selected wager
  useEffect(() => {
    const isIdle = gameState.phase === 'BETTING' || gameState.phase === 'SETTLED';
    if (isIdle && balance >= minBet && wager > balance) {
      const clamped = Math.max(minBet, Math.floor(balance / 25) * 25 || minBet);
      setWager(clamped);
    }
  }, [balance, minBet, wager, gameState.phase]);

  const chipPresets = useMemo(
    () => CHIP_PRESETS.filter((p) => p >= minBet && p <= maxBet),
    [minBet, maxBet]
  );

  const settleHandOnce = (
    stateSnapshot: BlackjackGameState,
    resolution: BlackjackResolution
  ) => {
    if (settledRoundIdsRef.current.has(stateSnapshot.roundId)) {
      return;
    }
    const claim = claimSettlement(stateSnapshot);
    if (!claim.claimed) {
      return;
    }

    settledRoundIdsRef.current.add(stateSnapshot.roundId);
    pendingEscrowRef.current = null;

    const roundRes = resolveRoundRef.current(stateSnapshot.currentBet, resolution.payout);
    setLastRoundResult(roundRes);
    setGameState(claim.state);
    setIsAnimating(false);
    actionLockRef.current = false;

    if (!roundRes.success) {
      setErrorMsg(roundRes.error || 'Failed to settle Blackjack hand.');
      return;
    }

    if (resolution.won) {
      soundManager.playCoin();
    } else {
      soundManager.playClick();
    }
  };

  const isBettingIdle =
    gameState.phase === 'BETTING' || gameState.phase === 'SETTLED';

  const handleSelectChip = (amount: number) => {
    if (!isBettingIdle || isAnimating || actionLockRef.current) return;
    soundManager.playClick();
    const clamped = Math.max(minBet, Math.min(amount, maxBet, balance));
    const rounded = Math.max(minBet, Math.floor(clamped / 5) * 5);
    setWager(rounded);
    setErrorMsg(null);
  };

  const adjustWager = (delta: number) => {
    if (!isBettingIdle || isAnimating || actionLockRef.current) return;
    soundManager.playClick();
    const raw = Math.max(minBet, Math.min(wager + delta, maxBet, balance));
    const newBet = Math.max(minBet, Math.floor(raw / 5) * 5);
    setWager(newBet);
    setErrorMsg(null);
  };

  const scheduleTimeout = (fn: () => void, delayMs: number) => {
    const id = window.setTimeout(fn, delayMs);
    timeoutsRef.current.push(id);
    return id;
  };

  const handleDeal = () => {
    if (actionLockRef.current || isAnimating || !isBettingIdle) return;

    const validation = isValidBlackjackBet(wager, minBet, maxBet, balance);
    if (!validation.valid) {
      soundManager.playLocked();
      setErrorMsg(validation.reason || 'Invalid wager.');
      return;
    }

    actionLockRef.current = true;
    clearAllTimers();

    // 1. Deal fresh 52-card deck hand & precompute escrow outcome
    const {
      state: dealtState,
      predeterminedAutoStandPayout,
      immediateNaturalResolution,
    } = dealInitialHand(wager);

    // 2. Place bet into escrow atomically BEFORE any animation
    const betResult = placeBetRef.current(wager, predeterminedAutoStandPayout);
    if (!betResult.success) {
      actionLockRef.current = false;
      soundManager.playLocked();
      setErrorMsg(betResult.error || 'Failed to place wager.');
      return;
    }

    pendingEscrowRef.current = {
      roundId: dealtState.roundId,
      bet: wager,
      payout: predeterminedAutoStandPayout,
    };

    setErrorMsg(null);
    setLastRoundResult(null);
    soundManager.playClick();

    const useAnimations = animations !== false;

    if (!useAnimations) {
      setGameState(dealtState);
      setVisiblePlayerCount(dealtState.playerCards.length);
      setVisibleDealerCount(dealtState.dealerCards.length);

      if (immediateNaturalResolution && dealtState.resolution) {
        settleHandOnce(dealtState, dealtState.resolution);
      } else {
        setIsAnimating(false);
        actionLockRef.current = false;
      }
      return;
    }

    // Animated deal sequence (P1 -> D1 -> P2 -> D2)
    setIsAnimating(true);
    setGameState({
      ...dealtState,
      phase: 'DEALING',
      dealerHoleHidden: true,
    });
    setVisiblePlayerCount(1);
    setVisibleDealerCount(0);

    scheduleTimeout(() => {
      soundManager.playClick();
      setVisibleDealerCount(1);
    }, 120);

    scheduleTimeout(() => {
      soundManager.playClick();
      setVisiblePlayerCount(2);
    }, 240);

    scheduleTimeout(() => {
      soundManager.playClick();
      setVisibleDealerCount(2);
    }, 360);

    scheduleTimeout(() => {
      if (immediateNaturalResolution && dealtState.resolution) {
        setGameState(dealtState);
        settleHandOnce(dealtState, dealtState.resolution);
      } else {
        setGameState(dealtState);
        setIsAnimating(false);
        actionLockRef.current = false;
      }
    }, 500);
  };

  const runDealerRevealSequence = (
    nextState: BlackjackGameState,
    resolution: BlackjackResolution,
    totalBet: number,
    initialDealerVisibleCount: number
  ) => {
    // Sync pending escrow with final predetermined outcome immediately
    pendingEscrowRef.current = {
      roundId: nextState.roundId,
      bet: totalBet,
      payout: resolution.payout,
    };
    updatePendingRoundRef.current?.(totalBet, resolution.payout);

    const useAnimations = animations !== false;
    if (!useAnimations) {
      setGameState(nextState);
      setVisiblePlayerCount(nextState.playerCards.length);
      setVisibleDealerCount(nextState.dealerCards.length);
      settleHandOnce(nextState, resolution);
      return;
    }

    setIsAnimating(true);
    setGameState(nextState);
    setVisiblePlayerCount(nextState.playerCards.length);
    setVisibleDealerCount(initialDealerVisibleCount);

    const extraDraws = Math.max(0, nextState.dealerCards.length - initialDealerVisibleCount);
    if (extraDraws === 0) {
      scheduleTimeout(() => {
        settleHandOnce(nextState, resolution);
      }, 280);
      return;
    }

    for (let i = 1; i <= extraDraws; i++) {
      scheduleTimeout(() => {
        soundManager.playClick();
        setVisibleDealerCount(initialDealerVisibleCount + i);
      }, i * 320);
    }

    scheduleTimeout(() => {
      settleHandOnce(nextState, resolution);
    }, extraDraws * 320 + 260);
  };

  const handleHit = () => {
    if (actionLockRef.current || isAnimating || gameState.phase !== 'PLAYER_TURN') {
      return;
    }

    actionLockRef.current = true;
    soundManager.playClick();

    const hitResult = playerHit(gameState);
    const nextState = hitResult.state;

    // Update persisted escrow payout immediately
    pendingEscrowRef.current = {
      roundId: nextState.roundId,
      bet: nextState.currentBet,
      payout: hitResult.autoStandPayout,
    };
    updatePendingRoundRef.current?.(nextState.currentBet, hitResult.autoStandPayout);

    if (hitResult.playerBusted && nextState.resolution) {
      setGameState(nextState);
      setVisiblePlayerCount(nextState.playerCards.length);
      setVisibleDealerCount(nextState.dealerCards.length);
      if (animations === false) {
        settleHandOnce(nextState, nextState.resolution);
      } else {
        setIsAnimating(true);
        scheduleTimeout(() => {
          settleHandOnce(nextState, nextState.resolution!);
        }, 280);
      }
      return;
    }

    if (hitResult.hit21 && nextState.resolution) {
      setVisiblePlayerCount(nextState.playerCards.length);
      runDealerRevealSequence(
        nextState,
        nextState.resolution,
        nextState.currentBet,
        2
      );
      return;
    }

    setGameState(nextState);
    setVisiblePlayerCount(nextState.playerCards.length);
    actionLockRef.current = false;
  };

  const handleStand = () => {
    if (actionLockRef.current || isAnimating || gameState.phase !== 'PLAYER_TURN') {
      return;
    }

    actionLockRef.current = true;
    soundManager.playClick();

    const { state: nextState, resolution } = playerStand(gameState);
    runDealerRevealSequence(nextState, resolution, nextState.currentBet, 2);
  };

  const handleDoubleDown = () => {
    if (
      actionLockRef.current ||
      isAnimating ||
      !canDoubleDown(gameState, balance)
    ) {
      return;
    }

    actionLockRef.current = true;

    const { state: nextState, additionalWager, resolution } = playerDoubleDown(gameState);

    // Deduct additional wager into escrow before revealing cards
    const extraBetRes = placeBetRef.current(additionalWager, resolution.payout);
    if (!extraBetRes.success) {
      actionLockRef.current = false;
      soundManager.playLocked();
      setErrorMsg(extraBetRes.error || 'Insufficient credits to double down.');
      return;
    }

    soundManager.playClick();
    setVisiblePlayerCount(nextState.playerCards.length);
    runDealerRevealSequence(nextState, resolution, nextState.currentBet, 2);
  };

  // Derived visible cards and scores
  const shownPlayerCards = gameState.playerCards.slice(0, visiblePlayerCount);
  const shownDealerCards = gameState.dealerCards.slice(0, visibleDealerCount);

  const playerEval = useMemo(
    () => (shownPlayerCards.length > 0 ? evaluateHand(shownPlayerCards) : null),
    [shownPlayerCards]
  );

  const dealerScoreLabel = useMemo(() => {
    if (shownDealerCards.length === 0) return '--';
    if (gameState.dealerHoleHidden) {
      const upcard = shownDealerCards[0];
      return `${getCardPointValue(upcard.rank)} + ?`;
    }
    return evaluateHand(shownDealerCards).displayTotal;
  }, [shownDealerCards, gameState.dealerHoleHidden]);

  const isPlayerTurn = gameState.phase === 'PLAYER_TURN' && !isAnimating;
  const allowDouble = canDoubleDown(gameState, balance);
  const activeResolution =
    gameState.phase === 'SETTLED' ? gameState.resolution : null;

  return (
    <div className="w-full max-w-lg mx-auto space-y-3.5 pb-6">
      {/* ── Primary Blackjack Felt Table Card ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#0c241b] via-[#0a1915] to-[#080f14] border border-emerald-500/35 p-3.5 sm:p-5 shadow-xl">
        {/* Subtle radial table lighting */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.12)_0%,transparent_70%)] pointer-events-none" />

        <div className="relative space-y-3.5">
          {/* Table Info Strip: Rules Summary | Current Wager & Player Balance */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-emerald-500/15 text-[11px]">
            <div className="flex items-center gap-1.5 text-emerald-300/90 font-medium">
              <Spade size={13} className="text-amber-300 shrink-0" />
              <span>Single Deck · Pays 3:2</span>
            </div>

            <div className="flex items-center gap-3 font-mono tabular-nums">
              <span className="text-slate-300">
                Wager:{' '}
                <strong className="text-amber-300">
                  {(isBettingIdle ? wager : gameState.currentBet).toLocaleString()}
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

          {/* ── Dealer Area ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 tracking-wide">
                Dealer
              </span>
              <span
                data-testid="dealer-score"
                className={`text-xs font-mono font-bold tabular-nums px-2 py-0.5 rounded bg-[#07110e]/90 border ${
                  activeResolution && activeResolution.dealerEval.isBust
                    ? 'border-emerald-500/40 text-emerald-300'
                    : activeResolution && activeResolution.dealerEval.isNaturalBlackjack
                    ? 'border-rose-500/40 text-rose-300'
                    : 'border-slate-700/80 text-slate-200'
                }`}
              >
                {dealerScoreLabel}
              </span>
            </div>

            <div
              data-testid="dealer-cards"
              className="min-h-[92px] sm:min-h-[112px] flex items-center justify-center rounded-xl bg-[#07130f]/75 border border-emerald-500/15 px-3 py-2"
            >
              {shownDealerCards.length > 0 ? (
                <div className="flex items-center justify-center">
                  {shownDealerCards.map((card, idx) => (
                    <PlayingCard
                      key={card.id}
                      card={card}
                      index={idx}
                      hidden={idx === 1 && gameState.dealerHoleHidden}
                      animateDeal={animations !== false}
                      highlight={Boolean(
                        activeResolution &&
                          (activeResolution.outcome === 'dealer_blackjack' ||
                            activeResolution.outcome === 'dealer_win')
                      )}
                    />
                  ))}
                </div>
              ) : (
                <span className="text-xs text-slate-500 font-sans">
                  Dealer cards appear here
                </span>
              )}
            </div>
          </div>

          {/* ── Compact Center Outcome / Status Strip ── */}
          <div
            data-testid="blackjack-status"
            className="min-h-[28px] w-full flex items-center justify-center text-xs font-mono px-2 text-center"
          >
            {activeResolution ? (
              activeResolution.won ? (
                <div className="flex items-center gap-1.5 text-emerald-300 font-semibold animate-in fade-in duration-150">
                  <Sparkles size={13} className="text-amber-300 shrink-0" />
                  <span>
                    {activeResolution.outcome === 'player_blackjack'
                      ? `Blackjack! Won +${activeResolution.net.toLocaleString()} Credits (3:2)`
                      : `Won +${activeResolution.net.toLocaleString()} Credits · ${activeResolution.message}`}
                  </span>
                </div>
              ) : activeResolution.isPush ? (
                <div className="text-slate-200 font-semibold animate-in fade-in duration-150">
                  {activeResolution.message} · {gameState.currentBet.toLocaleString()} Credits returned
                </div>
              ) : (
                <div className="text-rose-300 font-semibold animate-in fade-in duration-150">
                  Lost {gameState.currentBet.toLocaleString()} Credits · {activeResolution.message}
                </div>
              )
            ) : errorMsg ? (
              <span className="text-rose-400 font-sans text-[11px] font-medium">
                {errorMsg}
              </span>
            ) : gameState.phase === 'DEALING' ? (
              <span className="text-amber-300 text-[11px]">Dealing cards...</span>
            ) : gameState.phase === 'DEALER_TURN' ? (
              <span className="text-amber-300 text-[11px]">
                Dealer playing hand...
              </span>
            ) : gameState.phase === 'PLAYER_TURN' ? (
              <span className="text-emerald-300 font-sans text-[11px] font-medium">
                Your turn — Hit, Stand{allowDouble ? ', or Double Down' : ''}
              </span>
            ) : balance < minBet ? (
              <span className="text-amber-400 font-sans text-[11px] font-medium">
                You need at least {minBet} credits to play
              </span>
            ) : (
              <span className="text-slate-400 font-sans text-[11px]">
                Dealer stands on all 17s · Place your wager to deal
              </span>
            )}
          </div>

          {/* ── Player Area ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-300 tracking-wide">
                  Your Hand
                </span>
                {gameState.doubledDown && (
                  <span className="text-[10px] font-mono font-semibold text-amber-300">
                    · 2x Doubled
                  </span>
                )}
              </div>
              <span
                data-testid="player-score"
                className={`text-xs font-mono font-bold tabular-nums px-2 py-0.5 rounded bg-[#07110e]/90 border ${
                  playerEval?.isNaturalBlackjack
                    ? 'border-amber-400/60 text-amber-300'
                    : playerEval?.isBust
                    ? 'border-rose-500/40 text-rose-300'
                    : playerEval
                    ? 'border-emerald-500/40 text-emerald-300'
                    : 'border-slate-700/80 text-slate-400'
                }`}
              >
                {playerEval ? playerEval.displayTotal : '--'}
              </span>
            </div>

            <div
              data-testid="player-cards"
              className="min-h-[92px] sm:min-h-[112px] flex items-center justify-center rounded-xl bg-[#07130f]/75 border border-emerald-500/15 px-3 py-2"
            >
              {shownPlayerCards.length > 0 ? (
                <div className="flex items-center justify-center">
                  {shownPlayerCards.map((card, idx) => (
                    <PlayingCard
                      key={card.id}
                      card={card}
                      index={idx}
                      animateDeal={animations !== false}
                      highlight={Boolean(
                        activeResolution &&
                          (activeResolution.won ||
                            activeResolution.outcome === 'player_blackjack')
                      )}
                    />
                  ))}
                </div>
              ) : (
                <span className="text-xs text-slate-500 font-sans">
                  Your cards appear here
                </span>
              )}
            </div>
          </div>

          {/* ── Table Action Buttons ── */}
          <div className="pt-1">
            {isBettingIdle ? (
              <button
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
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={handleHit}
                  disabled={!isPlayerTurn}
                  className={`min-h-[44px] px-3 py-2 rounded-xl font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all ${
                    isPlayerTurn
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-slate-950 shadow-md shadow-emerald-500/20 cursor-pointer active:scale-[0.98]'
                      : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  }`}
                >
                  <Plus size={15} className="shrink-0" />
                  <span>Hit</span>
                </button>

                <button
                  type="button"
                  onClick={handleStand}
                  disabled={!isPlayerTurn}
                  className={`min-h-[44px] px-3 py-2 rounded-xl font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all border ${
                    isPlayerTurn
                      ? 'bg-[#121c28] hover:bg-[#1a2738] text-slate-100 border-slate-600 cursor-pointer active:scale-[0.98]'
                      : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                  }`}
                >
                  <Hand size={15} className="shrink-0" />
                  <span>Stand</span>
                </button>

                <button
                  type="button"
                  onClick={handleDoubleDown}
                  disabled={!isPlayerTurn || !allowDouble}
                  title={
                    !allowDouble && isPlayerTurn
                      ? gameState.playerCards.length > 2
                        ? 'Double Down only available on initial 2 cards'
                        : `Requires ${gameState.initialBet} additional credits`
                      : 'Double your wager and receive 1 final card'
                  }
                  className={`min-h-[44px] px-2.5 py-2 rounded-xl font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-1 transition-all border ${
                    isPlayerTurn && allowDouble
                      ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-400/60 cursor-pointer active:scale-[0.98]'
                      : 'bg-slate-800/70 text-slate-500 border-slate-700/80 cursor-not-allowed'
                  }`}
                >
                  <span className="truncate">Double</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Wager Row: Steppers + Presets + MAX (active between hands) ── */}
      <div className="bg-[#0f141d] border border-slate-800 rounded-xl p-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
          {/* Stepper Group */}
          <div className="flex items-center justify-between sm:justify-start gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => adjustWager(-25)}
              disabled={!isBettingIdle || isAnimating || wager <= minBet}
              className="min-h-[40px] min-w-[40px] px-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 text-slate-200 text-xs font-bold flex items-center justify-center transition-colors shrink-0"
              title="Decrease wager by 25"
            >
              -25
            </button>

            <div className="flex-1 sm:flex-none min-w-[70px] text-center px-2 py-1 rounded-lg bg-[#090d13] border border-slate-800 shrink-0">
              <span className="text-sm font-bold font-mono text-amber-300 tabular-nums">
                {wager.toLocaleString()}
              </span>
              <span className="block text-[9px] text-slate-400 font-sans uppercase -mt-0.5">
                Credits
              </span>
            </div>

            <button
              type="button"
              onClick={() => adjustWager(25)}
              disabled={
                !isBettingIdle ||
                isAnimating ||
                wager + 25 > maxBet ||
                wager + 25 > balance
              }
              className="min-h-[40px] min-w-[40px] px-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 text-slate-200 text-xs font-bold flex items-center justify-center transition-colors shrink-0"
              title="Increase wager by 25"
            >
              +25
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
                  disabled={!isBettingIdle || isAnimating || isOverLimit}
                  className={`min-h-[40px] px-1.5 sm:px-2.5 rounded-lg text-xs font-mono font-semibold transition-all flex items-center justify-center shrink-0 ${
                    isSelected
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-400/80 shadow-xs'
                      : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700 hover:bg-slate-800'
                  } ${
                    !isBettingIdle || isOverLimit
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
                    Math.floor(Math.min(maxBet, balance) / 25) * 25 || minBet
                  )
                )
              }
              disabled={!isBettingIdle || isAnimating || balance < minBet}
              className="min-h-[40px] px-2 sm:px-2.5 rounded-lg text-xs font-sans font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-40 transition-colors shrink-0 flex items-center justify-center"
            >
              MAX
            </button>
          </div>
        </div>
      </div>

      {/* ── Collapsed Rules & Payouts Section ── */}
      <details className="group rounded-xl bg-[#090d13] border border-slate-800/80 p-3 text-xs text-slate-400">
        <summary className="flex items-center justify-between cursor-pointer list-none select-none text-slate-300 font-medium">
          <div className="flex items-center gap-1.5">
            <TrendingUp size={13} className="text-emerald-400" />
            <span className="text-xs">Rules & payouts</span>
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
            Shuffled freshly before every hand using cryptographic randomness.
          </p>
          <p>
            • <strong className="text-slate-200">Natural Blackjack</strong>: Ace
            + 10-value card on initial deal pays{' '}
            <strong className="text-amber-300">3:2</strong> and beats a
            dealer&apos;s non-natural 21. Two natural Blackjacks push.
          </p>
          <p>
            • <strong className="text-slate-200">Standard Win & Push</strong>:
            Winning hands pay <strong className="text-emerald-400">1:1</strong>.
            Ties return your original wager.
          </p>
          <p>
            • <strong className="text-slate-200">Dealer Rules</strong>: Dealer
            stands on all 17s, including soft 17.
          </p>
          <p>
            • <strong className="text-slate-200">Double Down</strong>: Double
            your initial wager on your first two cards to receive one final
            card.
          </p>
          <div className="pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span>
              Limits: {minBet} - {maxBet.toLocaleString()} Credits
            </span>
            <span>Target RTP: 99.5%</span>
          </div>
        </div>
      </details>

      {lastRoundResult && !lastRoundResult.success && lastRoundResult.error && (
        <p className="sr-only">{lastRoundResult.error}</p>
      )}
    </div>
  );
};
