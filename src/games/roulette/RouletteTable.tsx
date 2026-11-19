import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  PlacedRouletteBet,
  RouletteBetSpot,
  RouletteBetType,
  getPocketColor,
  getRouletteSpot,
} from './rouletteRules';

export type BetPlacementMode =
  | 'all'
  | 'straight'
  | 'split'
  | 'street'
  | 'corner'
  | 'six_line';

interface RouletteTableProps {
  bets: PlacedRouletteBet[];
  disabled: boolean;
  winningNumber: number | null;
  winningSpotIds: string[];
  removeMode: boolean;
  onPlaceBet: (spotId: string) => void;
  onRemoveSpot: (spotId: string) => void;
}

type HotspotAxis = 'v-split' | 'h-split' | 'intersection' | 'street' | 'six-line';

interface HotspotCoord {
  spotId: string;
  type: RouletteBetType;
  axis: HotspotAxis;
  xPct: number;
  yPct: number;
}

function formatChipCompact(amount: number): string {
  if (amount >= 1000) {
    const k = amount / 1000;
    return Number.isInteger(k) ? `${k}k` : `${k.toFixed(1)}k`;
  }
  return String(amount);
}

function getChipBadgeStyle(amount: number): string {
  if (amount >= 500) return 'bg-purple-700 border-amber-300 text-amber-100';
  if (amount >= 100) return 'bg-slate-900 border-amber-400 text-amber-200';
  if (amount >= 50) return 'bg-amber-600 border-amber-200 text-slate-950';
  if (amount >= 25) return 'bg-emerald-600 border-emerald-200 text-white';
  if (amount >= 10) return 'bg-sky-700 border-sky-200 text-white';
  return 'bg-red-700 border-red-200 text-white';
}

const MODE_OPTIONS: ReadonlyArray<{ id: BetPlacementMode; label: string; odds?: string }> = [
  { id: 'all', label: 'Table (All)' },
  { id: 'straight', label: 'Straight', odds: '35:1' },
  { id: 'split', label: 'Split', odds: '17:1' },
  { id: 'street', label: 'Street', odds: '11:1' },
  { id: 'corner', label: 'Corner', odds: '8:1' },
  { id: 'six_line', label: 'Six Line', odds: '5:1' },
];

export const RouletteTable: React.FC<RouletteTableProps> = ({
  bets,
  disabled,
  winningNumber,
  winningSpotIds,
  removeMode,
  onPlaceBet,
  onRemoveSpot,
}) => {
  const [hoveredSpotId, setHoveredSpotId] = useState<string | null>(null);
  const [lastFeedback, setLastFeedback] = useState<{
    spotId: string;
    action: 'selected' | 'removed';
  } | null>(null);
  const [placementMode, setPlacementMode] = useState<BetPlacementMode>('all');

  // Horizontal scroll container & left/right edge scroll indicators
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollIndicators = useCallback(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    const { scrollLeft, clientWidth, scrollWidth } = el;
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll <= 4) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    updateScrollIndicators();
    const el = tableScrollRef.current;
    let observer: ResizeObserver | null = null;
    if (el && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => updateScrollIndicators());
      observer.observe(el);
    }
    window.addEventListener('resize', updateScrollIndicators);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateScrollIndicators);
    };
  }, [updateScrollIndicators]);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current !== null) {
        clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  const scrollTableBy = (delta: number) => {
    const el = tableScrollRef.current;
    if (!el) return;
    if (typeof el.scrollBy === 'function') {
      el.scrollBy({ left: delta, behavior: 'smooth' });
    } else {
      el.scrollLeft += delta;
    }
  };

  const triggerSpotFeedback = (spotId: string, action: 'selected' | 'removed') => {
    setLastFeedback({ spotId, action });
    if (feedbackTimerRef.current !== null) {
      clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = window.setTimeout(() => {
      setLastFeedback(null);
      feedbackTimerRef.current = null;
    }, 900);
  };

  const betBySpotId = useMemo(() => {
    const map = new Map<string, PlacedRouletteBet>();
    bets.forEach((b) => map.set(b.spotId, b));
    return map;
  }, [bets]);

  const winningSpotSet = useMemo(() => new Set(winningSpotIds), [winningSpotIds]);

  const activeSpotId = hoveredSpotId ?? lastFeedback?.spotId ?? null;
  const activeSpot: RouletteBetSpot | undefined = activeSpotId
    ? getRouletteSpot(activeSpotId)
    : undefined;

  const highlightedNumbers = useMemo(() => {
    if (activeSpot) {
      return new Set(activeSpot.numbers);
    }
    return new Set<number>();
  }, [activeSpot]);

  // Inside border hotspots over the 12x3 grid with non-overlapping directional hit areas
  const insideHotspots: HotspotCoord[] = useMemo(() => {
    const list: HotspotCoord[] = [];

    // Zero Splits & Zero Trios along the left edge (x = 0%)
    list.push({ spotId: 'split:0-3', type: 'split', axis: 'h-split', xPct: 0, yPct: (0.5 / 3) * 100 });
    list.push({ spotId: 'split:0-2', type: 'split', axis: 'h-split', xPct: 0, yPct: (1.5 / 3) * 100 });
    list.push({ spotId: 'split:0-1', type: 'split', axis: 'h-split', xPct: 0, yPct: (2.5 / 3) * 100 });
    list.push({ spotId: 'street:0-2-3', type: 'street', axis: 'intersection', xPct: 0, yPct: (1 / 3) * 100 });
    list.push({ spotId: 'street:0-1-2', type: 'street', axis: 'intersection', xPct: 0, yPct: (2 / 3) * 100 });

    for (let col = 0; col < 12; col++) {
      const base = col * 3 + 1;
      const colCenterX = ((col + 0.5) / 12) * 100;
      const colBorderX = ((col + 1) / 12) * 100;

      // Vertical splits within column (wide horizontally, sleek vertically so zero overlap with corners)
      list.push({
        spotId: `split:${base + 1}-${base + 2}`,
        type: 'split',
        axis: 'v-split',
        xPct: colCenterX,
        yPct: (1 / 3) * 100,
      });
      list.push({
        spotId: `split:${base}-${base + 1}`,
        type: 'split',
        axis: 'v-split',
        xPct: colCenterX,
        yPct: (2 / 3) * 100,
      });

      // Street along bottom border of column
      list.push({
        spotId: `street:${base}-${base + 2}`,
        type: 'street',
        axis: 'street',
        xPct: colCenterX,
        yPct: 100,
      });

      if (col < 11) {
        // Horizontal splits to next column (tall vertically, narrow horizontally so zero overlap with corners)
        for (let r = 0; r < 3; r++) {
          const a = base + (2 - r);
          const b = a + 3;
          list.push({
            spotId: `split:${a}-${b}`,
            type: 'split',
            axis: 'h-split',
            xPct: colBorderX,
            yPct: ((r + 0.5) / 3) * 100,
          });
        }

        // Two corners between col and col + 1
        list.push({
          spotId: `corner:${base + 1}-${base + 2}-${base + 4}-${base + 5}`,
          type: 'corner',
          axis: 'intersection',
          xPct: colBorderX,
          yPct: (1 / 3) * 100,
        });
        list.push({
          spotId: `corner:${base}-${base + 1}-${base + 3}-${base + 4}`,
          type: 'corner',
          axis: 'intersection',
          xPct: colBorderX,
          yPct: (2 / 3) * 100,
        });

        // Six Line at bottom intersection
        list.push({
          spotId: `six_line:${base}-${base + 5}`,
          type: 'six_line',
          axis: 'six-line',
          xPct: colBorderX,
          yPct: 100,
        });
      }
    }

    return list;
  }, []);

  const handleSpotInteraction = (spotId: string) => {
    if (disabled) return;
    if (removeMode) {
      if (betBySpotId.has(spotId)) {
        triggerSpotFeedback(spotId, 'removed');
        onRemoveSpot(spotId);
      }
      return;
    }
    triggerSpotFeedback(spotId, 'selected');
    onPlaceBet(spotId);
  };

  const handleSpotContextMenu = (e: React.MouseEvent, spotId: string) => {
    e.preventDefault();
    if (disabled) return;
    if (betBySpotId.has(spotId)) {
      triggerSpotFeedback(spotId, 'removed');
      onRemoveSpot(spotId);
    }
  };

  const renderChipMarker = (spotId: string) => {
    const placed = betBySpotId.get(spotId);
    if (!placed) return null;
    const isWinning = winningNumber !== null && winningSpotSet.has(spotId);
    const isDimmed = winningNumber !== null && !isWinning;
    const isRecentlyTapped = lastFeedback?.spotId === spotId && lastFeedback.action === 'selected';

    return (
      <span
        data-testid={`chip-${spotId}`}
        className={`pointer-events-none inline-flex h-6 min-w-[24px] px-1 items-center justify-center rounded-full border-2 border-dashed text-[10px] font-mono font-bold shadow-md transition-all ${getChipBadgeStyle(
          placed.amount
        )} ${
          isWinning
            ? 'ring-2 ring-amber-300 scale-110 shadow-amber-400/40'
            : isRecentlyTapped
            ? 'ring-2 ring-emerald-300 scale-110'
            : isDimmed
            ? 'opacity-50'
            : ''
        }`}
      >
        {formatChipCompact(placed.amount)}
      </span>
    );
  };

  // Standard 3 rows x 12 columns ordering: top row 3,6..36; middle row 2,5..35; bottom row 1,4..34
  const rows = [
    Array.from({ length: 12 }, (_, c) => c * 3 + 3),
    Array.from({ length: 12 }, (_, c) => c * 3 + 2),
    Array.from({ length: 12 }, (_, c) => c * 3 + 1),
  ];

  const outsideRow: ReadonlyArray<{
    spotId: string;
    label: string;
    variant?: 'red' | 'black';
  }> = [
    { spotId: 'low', label: '1–18' },
    { spotId: 'even', label: 'EVEN' },
    { spotId: 'red', label: 'RED', variant: 'red' },
    { spotId: 'black', label: 'BLACK', variant: 'black' },
    { spotId: 'odd', label: 'ODD' },
    { spotId: 'high', label: '19–36' },
  ];

  const isSpotTypeActiveInMode = (type: RouletteBetType): boolean => {
    if (placementMode === 'all') return true;
    return placementMode === type;
  };

  const getHotspotHitboxClass = (spot: HotspotCoord, isFocusedMode: boolean): string => {
    // Non-overlapping directional bounding boxes keep adjacent positions independently selectable,
    // while focused mode expands invisible touch areas safely because sibling spot types are hidden.
    if (isFocusedMode) {
      switch (spot.axis) {
        case 'intersection':
          return 'w-9 h-9 z-30';
        case 'six-line':
          return 'w-9 h-8 z-30';
        case 'street':
          return 'w-9 h-8 z-20';
        case 'v-split':
          return 'w-7 h-6 z-20';
        case 'h-split':
          return 'w-6 h-7 z-20';
      }
    }

    switch (spot.axis) {
      case 'intersection':
        return 'w-[22px] h-[22px] z-30';
      case 'six-line':
        return 'w-[22px] h-[24px] z-30';
      case 'street':
        return 'w-[26px] h-[24px] z-20';
      case 'v-split':
        return 'w-[26px] h-[20px] z-20';
      case 'h-split':
        return 'w-[20px] h-[26px] z-20';
    }
  };

  return (
    <div className="space-y-3">
      {/* ── Inside Bet Mode Selector & Live Felt Readout ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div
          role="group"
          aria-label="Inside bet selector mode"
          className="flex flex-wrap items-center gap-1.5"
        >
          {MODE_OPTIONS.map((opt) => {
            const active = placementMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled}
                onClick={() => setPlacementMode(opt.id)}
                className={`touch-manipulation px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap shrink-0 min-h-[34px] border cursor-pointer disabled:opacity-50 ${
                  active
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50 font-semibold'
                    : 'bg-[#0b1118] text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <span>{opt.label}</span>
                {opt.odds && (
                  <span className="ml-1 font-mono text-[10px] text-amber-300/90">
                    {opt.odds}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="min-h-[24px] flex items-center justify-between sm:justify-end gap-2 text-xs shrink-0">
          {removeMode ? (
            <span className="text-rose-300 font-mono text-[11px] whitespace-nowrap">
              Remove Mode: Tap any chip to remove
            </span>
          ) : activeSpot ? (
            <span
              data-testid="active-spot-readout"
              className="text-amber-300 font-mono text-[11px] truncate"
            >
              {lastFeedback && hoveredSpotId === null
                ? `${lastFeedback.action === 'removed' ? 'Removed' : 'Selected'}: `
                : ''}
              {activeSpot.label} · Pays {activeSpot.payoutOdds}:1
            </span>
          ) : (
            <span className="text-slate-400 text-[11px] sm:whitespace-nowrap">
              Tap numbers, borders, or outside bets
            </span>
          )}
        </div>
      </div>

      {/* ── Luxury Emerald Felt Roulette Layout ── */}
      <div className="relative rounded-2xl bg-gradient-to-b from-[#083525] via-[#062a1d] to-[#041d14] border border-amber-500/40 p-3 sm:p-4 shadow-[inset_0_0_40px_rgba(0,0,0,0.45)]">
        {/* Left Horizontal Scroll Edge Fade & Indicator */}
        <div
          aria-hidden={!canScrollLeft}
          data-testid="scroll-indicator-left"
          className={`pointer-events-none absolute left-0 top-3 bottom-3 w-10 z-30 rounded-l-2xl bg-gradient-to-r from-[#041d14]/90 via-[#041d14]/45 to-transparent flex items-center justify-start pl-1 transition-opacity duration-200 ${
            canScrollLeft ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <button
            type="button"
            tabIndex={canScrollLeft ? 0 : -1}
            aria-label="Scroll betting table left"
            onClick={() => scrollTableBy(-160)}
            className={`${
              canScrollLeft ? 'pointer-events-auto' : 'pointer-events-none'
            } flex h-7 w-7 items-center justify-center rounded-full bg-[#062318]/90 border border-amber-400/45 text-amber-300 shadow-md hover:bg-emerald-900/90 active:scale-95 transition-transform cursor-pointer`}
          >
            <ChevronLeft size={15} />
          </button>
        </div>

        {/* Right Horizontal Scroll Edge Fade & Indicator */}
        <div
          aria-hidden={!canScrollRight}
          data-testid="scroll-indicator-right"
          className={`pointer-events-none absolute right-0 top-3 bottom-3 w-10 z-30 rounded-r-2xl bg-gradient-to-l from-[#041d14]/90 via-[#041d14]/45 to-transparent flex items-center justify-end pr-1 transition-opacity duration-200 ${
            canScrollRight ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <button
            type="button"
            tabIndex={canScrollRight ? 0 : -1}
            aria-label="Scroll betting table right"
            onClick={() => scrollTableBy(160)}
            className={`${
              canScrollRight ? 'pointer-events-auto' : 'pointer-events-none'
            } flex h-7 w-7 items-center justify-center rounded-full bg-[#062318]/90 border border-amber-400/45 text-amber-300 shadow-md hover:bg-emerald-900/90 active:scale-95 transition-transform cursor-pointer`}
          >
            <ChevronRight size={15} />
          </button>
        </div>

        <div
          ref={tableScrollRef}
          data-testid="roulette-table-scroll"
          onScroll={updateScrollIndicators}
          className="overflow-x-auto overscroll-x-contain pb-1"
        >
          <div className="min-w-[660px] select-none">
            {/* Top Matrix: [ 0 ] + [ 12x3 Numbers + Inside Hotspots ] + [ 2:1 Columns ] */}
            <div className="grid grid-cols-[54px_1fr_54px] gap-0">
              {/* Green Zero Pocket (spans 3 rows) */}
              {(() => {
                const zeroPlaced = betBySpotId.has('straight:0');
                const zeroSelectedFlash =
                  lastFeedback?.spotId === 'straight:0' && lastFeedback.action === 'selected';
                return (
                  <button
                    type="button"
                    disabled={disabled}
                    aria-label="Bet Straight 0 (35:1)"
                    onMouseEnter={() => setHoveredSpotId('straight:0')}
                    onMouseLeave={() => setHoveredSpotId(null)}
                    onFocus={() => setHoveredSpotId('straight:0')}
                    onBlur={() => setHoveredSpotId(null)}
                    onClick={() => handleSpotInteraction('straight:0')}
                    onContextMenu={(e) => handleSpotContextMenu(e, 'straight:0')}
                    className={`touch-manipulation relative flex items-center justify-center rounded-l-xl border border-amber-500/45 font-mono text-lg font-bold transition-all min-h-[144px] cursor-pointer disabled:cursor-not-allowed ${
                      winningNumber === 0
                        ? 'bg-emerald-500 text-slate-950 ring-2 ring-amber-300 shadow-[inset_0_0_16px_rgba(251,191,36,0.6)] z-10'
                        : zeroSelectedFlash
                        ? 'bg-emerald-600 text-white ring-2 ring-amber-300 z-10'
                        : highlightedNumbers.has(0)
                        ? 'bg-emerald-600/80 text-white ring-2 ring-amber-300/80'
                        : 'bg-emerald-700/70 hover:bg-emerald-600/80 text-white'
                    }`}
                  >
                    <span
                      className={
                        zeroPlaced
                          ? 'absolute top-2 left-1/2 -translate-x-1/2 text-xs opacity-85'
                          : ''
                      }
                    >
                      0
                    </span>
                    <div className="absolute inset-0 flex items-center justify-center">
                      {renderChipMarker('straight:0')}
                    </div>
                  </button>
                );
              })()}

              {/* Center 12x3 Numbers Grid + Precision Inside Bet Overlay */}
              <div className="relative">
                <div className="grid grid-cols-12 grid-rows-3">
                  {rows.flat().map((num) => {
                    const spotId = `straight:${num}`;
                    const color = getPocketColor(num);
                    const isWinner = winningNumber === num;
                    const isHighlighted = highlightedNumbers.has(num);
                    const hasPlaced = betBySpotId.has(spotId);
                    const isSelectedFlash =
                      lastFeedback?.spotId === spotId && lastFeedback.action === 'selected';

                    return (
                      <button
                        key={num}
                        type="button"
                        disabled={disabled}
                        aria-label={`Bet Straight ${num} (${color}, 35:1)`}
                        onMouseEnter={() => setHoveredSpotId(spotId)}
                        onMouseLeave={() => setHoveredSpotId(null)}
                        onFocus={() => setHoveredSpotId(spotId)}
                        onBlur={() => setHoveredSpotId(null)}
                        onClick={() => handleSpotInteraction(spotId)}
                        onContextMenu={(e) => handleSpotContextMenu(e, spotId)}
                        className={`touch-manipulation relative h-12 sm:h-13 border-t border-r border-amber-500/35 last:border-b-0 flex items-center justify-center font-mono text-sm sm:text-base font-bold transition-all cursor-pointer disabled:cursor-not-allowed ${
                          num % 3 === 1 ? 'border-b border-amber-500/35' : ''
                        } ${
                          isWinner
                            ? 'ring-2 ring-amber-300 z-10 brightness-125 shadow-[inset_0_0_14px_rgba(251,191,36,0.7)]'
                            : isSelectedFlash
                            ? 'ring-2 ring-amber-300 brightness-125 z-10'
                            : isHighlighted
                            ? 'ring-2 ring-amber-300/75 brightness-125 z-10'
                            : ''
                        } ${
                          color === 'red'
                            ? 'bg-[#9b1c1c] hover:bg-[#b91c1c] text-white'
                            : 'bg-[#101620] hover:bg-[#1e293b] text-slate-100'
                        }`}
                      >
                        <span
                          className={
                            hasPlaced
                              ? 'absolute top-0.5 left-1 text-[10px] leading-none opacity-80'
                              : ''
                          }
                        >
                          {num}
                        </span>
                        <div className="absolute inset-0 flex items-center justify-center">
                          {renderChipMarker(spotId)}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Inside Bet Hotspots Layer (Expanded invisible hit targets with compact visual dots) */}
                <div className="pointer-events-none absolute inset-0 z-20">
                  {insideHotspots.map((spot) => {
                    const betSpot = getRouletteSpot(spot.spotId);
                    if (!betSpot) return null;
                    const hasPlaced = betBySpotId.has(spot.spotId);
                    const modeActive = isSpotTypeActiveInMode(spot.type);
                    const isFocusedMode =
                      placementMode !== 'all' && placementMode === spot.type;

                    if (!modeActive && !hasPlaced) {
                      return null;
                    }

                    const isTappedFlash =
                      lastFeedback?.spotId === spot.spotId && lastFeedback.action === 'selected';
                    const hitboxClass = getHotspotHitboxClass(spot, isFocusedMode);

                    return (
                      <button
                        key={spot.spotId}
                        type="button"
                        disabled={disabled}
                        aria-label={`Bet ${betSpot.label} (${betSpot.payoutOdds}:1)`}
                        onMouseEnter={() => setHoveredSpotId(spot.spotId)}
                        onMouseLeave={() => setHoveredSpotId(null)}
                        onFocus={() => setHoveredSpotId(spot.spotId)}
                        onBlur={() => setHoveredSpotId(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSpotInteraction(spot.spotId);
                        }}
                        onContextMenu={(e) => handleSpotContextMenu(e, spot.spotId)}
                        style={{
                          left: `${spot.xPct}%`,
                          top: `${spot.yPct}%`,
                        }}
                        className={`touch-manipulation pointer-events-auto group/spot absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full cursor-pointer disabled:cursor-not-allowed ${hitboxClass}`}
                      >
                        {hasPlaced ? (
                          renderChipMarker(spot.spotId)
                        ) : (
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none rounded-full transition-all ${
                              spot.axis === 'intersection' || spot.axis === 'six-line'
                                ? 'w-4 h-4'
                                : 'w-3.5 h-3.5'
                            } ${
                              isTappedFlash
                                ? 'bg-amber-300/75 ring-2 ring-amber-200 scale-125'
                                : isFocusedMode
                                ? 'bg-amber-400/30 border border-amber-300/80 group-hover/spot:bg-amber-400/60 group-hover/spot:scale-125 group-active/spot:scale-125'
                                : 'group-hover/spot:bg-amber-400/45 group-focus-visible/spot:bg-amber-400/55 group-active/spot:bg-amber-300/60'
                            }`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Three 2:1 Column Bets */}
              <div className="grid grid-rows-3">
                {[3, 2, 1].map((colNum, idx) => {
                  const spotId = `column:${colNum}`;
                  const isWinning = winningNumber !== null && winningSpotSet.has(spotId);
                  const hasPlaced = betBySpotId.has(spotId);
                  const isSelectedFlash =
                    lastFeedback?.spotId === spotId && lastFeedback.action === 'selected';
                  return (
                    <button
                      key={spotId}
                      type="button"
                      disabled={disabled}
                      aria-label={`Bet Column ${colNum} (2:1)`}
                      onMouseEnter={() => setHoveredSpotId(spotId)}
                      onMouseLeave={() => setHoveredSpotId(null)}
                      onFocus={() => setHoveredSpotId(spotId)}
                      onBlur={() => setHoveredSpotId(null)}
                      onClick={() => handleSpotInteraction(spotId)}
                      onContextMenu={(e) => handleSpotContextMenu(e, spotId)}
                      className={`touch-manipulation relative h-12 sm:h-13 border-t border-r border-amber-500/45 flex items-center justify-center font-mono text-xs font-bold transition-all cursor-pointer disabled:cursor-not-allowed ${
                        idx === 0 ? 'rounded-tr-xl' : ''
                      } ${
                        idx === 2 ? 'rounded-br-xl border-b border-amber-500/45' : ''
                      } ${
                        isWinning
                          ? 'bg-emerald-500/35 text-amber-200 ring-2 ring-amber-300 z-10'
                          : isSelectedFlash
                          ? 'bg-emerald-700/50 text-amber-200 ring-2 ring-amber-300 z-10'
                          : 'bg-[#05291c] hover:bg-emerald-800/45 text-amber-100'
                      }`}
                    >
                      <span
                        className={
                          hasPlaced
                            ? 'absolute top-0.5 left-1 text-[9px] leading-none opacity-75'
                            : ''
                        }
                      >
                        2:1
                      </span>
                      <div className="absolute inset-0 flex items-center justify-center">
                        {renderChipMarker(spotId)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dozens Row (Aligned under the 12 number columns) */}
            <div className="grid grid-cols-[54px_1fr_54px] mt-1.5">
              <div />
              <div className="grid grid-cols-3 border border-amber-500/40 rounded-lg overflow-hidden">
                {[
                  { id: 'dozen:1', label: '1st 12' },
                  { id: 'dozen:2', label: '2nd 12' },
                  { id: 'dozen:3', label: '3rd 12' },
                ].map((dozen, idx) => {
                  const isWinning = winningNumber !== null && winningSpotSet.has(dozen.id);
                  const hasPlaced = betBySpotId.has(dozen.id);
                  const isSelectedFlash =
                    lastFeedback?.spotId === dozen.id && lastFeedback.action === 'selected';
                  return (
                    <button
                      key={dozen.id}
                      type="button"
                      disabled={disabled}
                      aria-label={`Bet ${dozen.label} (2:1)`}
                      onMouseEnter={() => setHoveredSpotId(dozen.id)}
                      onMouseLeave={() => setHoveredSpotId(null)}
                      onFocus={() => setHoveredSpotId(dozen.id)}
                      onBlur={() => setHoveredSpotId(null)}
                      onClick={() => handleSpotInteraction(dozen.id)}
                      onContextMenu={(e) => handleSpotContextMenu(e, dozen.id)}
                      className={`touch-manipulation relative h-11 flex items-center justify-center font-display text-xs sm:text-sm font-bold tracking-wide transition-all cursor-pointer disabled:cursor-not-allowed ${
                        idx < 2 ? 'border-r border-amber-500/35' : ''
                      } ${
                        isWinning
                          ? 'bg-emerald-500/30 text-amber-200 ring-2 ring-amber-300 z-10'
                          : isSelectedFlash
                          ? 'bg-emerald-700/50 text-amber-200 ring-2 ring-amber-300 z-10'
                          : 'bg-[#052a1d] hover:bg-emerald-800/40 text-slate-100'
                      }`}
                    >
                      <span className={hasPlaced ? 'pr-7' : ''}>{dozen.label}</span>
                      {hasPlaced && (
                        <div className="pointer-events-none absolute right-2.5 inset-y-0 flex items-center">
                          {renderChipMarker(dozen.id)}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <div />
            </div>

            {/* Outside Even-Money Bets Row (1-18, EVEN, RED, BLACK, ODD, 19-36) */}
            <div className="grid grid-cols-[54px_1fr_54px] mt-1.5">
              <div />
              <div className="grid grid-cols-6 border border-amber-500/40 rounded-lg overflow-hidden">
                {outsideRow.map((item, idx) => {
                  const isWinning = winningNumber !== null && winningSpotSet.has(item.spotId);
                  const hasPlaced = betBySpotId.has(item.spotId);
                  const isSelectedFlash =
                    lastFeedback?.spotId === item.spotId && lastFeedback.action === 'selected';
                  return (
                    <button
                      key={item.spotId}
                      type="button"
                      disabled={disabled}
                      aria-label={`Bet ${item.label} (1:1)`}
                      onMouseEnter={() => setHoveredSpotId(item.spotId)}
                      onMouseLeave={() => setHoveredSpotId(null)}
                      onFocus={() => setHoveredSpotId(item.spotId)}
                      onBlur={() => setHoveredSpotId(null)}
                      onClick={() => handleSpotInteraction(item.spotId)}
                      onContextMenu={(e) => handleSpotContextMenu(e, item.spotId)}
                      className={`touch-manipulation relative h-12 flex items-center justify-center font-display text-xs sm:text-sm font-bold tracking-wider transition-all cursor-pointer disabled:cursor-not-allowed ${
                        idx < 5 ? 'border-r border-amber-500/35' : ''
                      } ${
                        isWinning || isSelectedFlash
                          ? 'ring-2 ring-amber-300 z-10 brightness-125'
                          : ''
                      } ${
                        item.variant === 'red'
                          ? 'bg-[#8f1a1a] hover:bg-[#b91c1c] text-white'
                          : item.variant === 'black'
                          ? 'bg-[#0d121a] hover:bg-[#1c2533] text-slate-100'
                          : 'bg-[#052a1d] hover:bg-emerald-800/40 text-slate-100'
                      }`}
                    >
                      {item.variant ? (
                        <span
                          className={`inline-flex items-center gap-1 ${
                            hasPlaced ? 'pr-7 text-[11px]' : ''
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`h-2.5 w-2.5 shrink-0 rotate-45 border border-amber-300/70 ${
                              item.variant === 'red' ? 'bg-red-500' : 'bg-slate-950'
                            }`}
                          />
                          <span>{item.label}</span>
                        </span>
                      ) : (
                        <span className={hasPlaced ? 'pr-7 text-[11px]' : ''}>
                          {item.label}
                        </span>
                      )}
                      {hasPlaced && (
                        <div className="pointer-events-none absolute right-1.5 inset-y-0 flex items-center">
                          {renderChipMarker(item.spotId)}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <div />
            </div>
          </div>
        </div>

        {(canScrollLeft || canScrollRight) && (
          <div className="sm:hidden flex items-center justify-center gap-1.5 text-[10px] font-mono text-emerald-300/75 mt-1.5">
            <span>{canScrollLeft ? '←' : ''}</span>
            <span>Swipe table sideways for all numbers &amp; columns</span>
            <span>{canScrollRight ? '→' : ''}</span>
          </div>
        )}
      </div>
    </div>
  );
};
