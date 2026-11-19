import React, { useEffect, useRef, useState } from 'react';
import {
  EUROPEAN_WHEEL_SEQUENCE,
  PocketColor,
  getPocketColor,
  getWheelIndex,
} from './rouletteRules';

interface RouletteWheelProps {
  winningNumber: number | null;
  isSpinning: boolean;
  roundId: string;
  animations: boolean;
  onSpinComplete?: () => void;
}

const TOTAL_POCKETS = EUROPEAN_WHEEL_SEQUENCE.length; // 37
const SLICE_DEG = 360 / TOTAL_POCKETS;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function createWedgePath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number
): string {
  const p1 = polarToCartesian(cx, cy, rOuter, startAngle);
  const p2 = polarToCartesian(cx, cy, rOuter, endAngle);
  const p3 = polarToCartesian(cx, cy, rInner, endAngle);
  const p4 = polarToCartesian(cx, cy, rInner, startAngle);

  return [
    `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 0 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 0 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export const RouletteWheel: React.FC<RouletteWheelProps> = ({
  winningNumber,
  isSpinning,
  roundId,
  animations,
  onSpinComplete,
}) => {
  const [wheelRotation, setWheelRotation] = useState<number>(0);
  const [ballAngle, setBallAngle] = useState<number>(0);
  const [ballRadius, setBallRadius] = useState<number>(112); // rests in pocket ring (~112) vs outer track (~158)
  const [showBall, setShowBall] = useState<boolean>(false);

  const wheelRotRef = useRef<number>(0);
  const ballAngleRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const onSpinCompleteRef = useRef(onSpinComplete);
  onSpinCompleteRef.current = onSpinComplete;

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isSpinning || winningNumber === null) return;

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const pocketIdx = getWheelIndex(winningNumber);
    const pocketLocalDeg = pocketIdx * SLICE_DEG;

    const startWheel = wheelRotRef.current;
    // Wheel turns counter-clockwise 3 full rotations + deterministic offset
    const targetWheel = startWheel - (3 * 360 + ((pocketIdx * 17) % 180) + 45);
    // Final world angle of the winning pocket on the rotor
    const finalPocketWorldDeg = targetWheel + pocketLocalDeg;

    // Ball orbits clockwise 5+ revolutions and drops precisely into finalPocketWorldDeg
    const startBall = ((ballAngleRef.current % 360) + 360) % 360;
    const normalizedTarget = ((finalPocketWorldDeg % 360) + 360) % 360;
    const clockwiseDelta = ((normalizedTarget - startBall + 360) % 360) + 5 * 360;
    const targetBall = startBall + clockwiseDelta;

    setShowBall(true);

    if (!animations || prefersReducedMotion) {
      wheelRotRef.current = targetWheel;
      ballAngleRef.current = targetBall;
      setWheelRotation(targetWheel);
      setBallAngle(targetBall);
      setBallRadius(107);

      const timer = window.setTimeout(() => {
        onSpinCompleteRef.current?.();
      }, 150);
      return () => clearTimeout(timer);
    }

    const durationMs = 2600;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);

      const wProgress = easeOutCubic(t);
      const bProgress = easeOutQuart(t);

      const currentW = startWheel + (targetWheel - startWheel) * wProgress;
      const currentB = startBall + (targetBall - startBall) * bProgress;

      // Ball stays on outer mahogany track (r=157) until t=0.58, then drops inward to pocket (r=107)
      let currentR = 157;
      if (t > 0.58) {
        const dropT = Math.min(1, (t - 0.58) / 0.34);
        const dropEase = 1 - Math.pow(1 - dropT, 2);
        // Subtle bounce right as it enters the pocket fret
        const bounce = dropT > 0.72 && dropT < 1 ? Math.sin((dropT - 0.72) * 14) * 3.2 : 0;
        currentR = 157 - (157 - 107) * dropEase + bounce;
      }

      wheelRotRef.current = currentW;
      ballAngleRef.current = currentB;
      setWheelRotation(currentW);
      setBallAngle(currentB);
      setBallRadius(currentR);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        onSpinCompleteRef.current?.();
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isSpinning, winningNumber, roundId, animations]);

  const cx = 180;
  const cy = 180;
  const ballPos = polarToCartesian(cx, cy, ballRadius, ballAngle);

  const settledColor: PocketColor | null =
    !isSpinning && winningNumber !== null ? getPocketColor(winningNumber) : null;

  return (
    <div className="flex flex-col items-center justify-center select-none">
      <div
        data-testid="roulette-wheel"
        data-spinning={isSpinning ? 'true' : 'false'}
        data-winning-number={winningNumber !== null ? String(winningNumber) : ''}
        className="relative mx-auto w-[196px] h-[196px] sm:w-[264px] sm:h-[264px] lg:w-[300px] lg:h-[300px] flex items-center justify-center"
      >
        {/* Subtle emerald ambient glow */}
        <div className="pointer-events-none absolute inset-4 rounded-full bg-emerald-500/10 blur-2xl" />

        <svg
          viewBox="0 0 360 360"
          className="w-full h-full drop-shadow-[0_14px_28px_rgba(0,0,0,0.65)]"
          role="img"
          aria-label={
            isSpinning
              ? 'European Roulette wheel spinning'
              : winningNumber !== null
              ? `European Roulette wheel showing winning pocket ${winningNumber}`
              : 'European Roulette wheel ready'
          }
        >
          <defs>
            <radialGradient id="bowlRimGrad" cx="50%" cy="45%" r="55%">
              <stop offset="0%" stopColor="#2c1912" />
              <stop offset="72%" stopColor="#1b0f0a" />
              <stop offset="100%" stopColor="#0d0806" />
            </radialGradient>
            <radialGradient id="trackGrad" cx="50%" cy="50%" r="50%">
              <stop offset="76%" stopColor="#0b1017" />
              <stop offset="92%" stopColor="#1a120e" />
              <stop offset="100%" stopColor="#2b1b14" />
            </radialGradient>
            <radialGradient id="turretGold" cx="38%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="45%" stopColor="#d4af37" />
              <stop offset="100%" stopColor="#785616" />
            </radialGradient>
            <radialGradient id="ivoryBall" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="60%" stopColor="#e2e8f0" />
              <stop offset="100%" stopColor="#94a3b8" />
            </radialGradient>
          </defs>

          {/* Outer Mahogany & Gold Bowl */}
          <circle cx={cx} cy={cy} r={176} fill="url(#bowlRimGrad)" stroke="#b48a2e" strokeWidth="2.5" />
          <circle cx={cx} cy={cy} r={166} fill="url(#trackGrad)" stroke="#7c5e1f" strokeWidth="1.2" />

          {/* 8 Brass Diamond Ball Deflectors on Bowl Track */}
          {Array.from({ length: 8 }, (_, idx) => {
            const angle = idx * 45 + 22.5;
            const pos = polarToCartesian(cx, cy, 159, angle);
            return (
              <polygon
                key={idx}
                points={`${pos.x},${pos.y - 3} ${pos.x + 3},${pos.y} ${pos.x},${pos.y + 3} ${pos.x - 3},${pos.y}`}
                fill="#d4af37"
                opacity={0.75}
              />
            );
          })}

          {/* Rotating 37-Pocket Rotor */}
          <g transform={`rotate(${wheelRotation} ${cx} ${cy})`}>
            {/* Rotor backing */}
            <circle cx={cx} cy={cy} r={146} fill="#0a0f16" stroke="#d4af37" strokeWidth="2" />

            {EUROPEAN_WHEEL_SEQUENCE.map((num, idx) => {
              const startAngle = idx * SLICE_DEG - SLICE_DEG / 2;
              const endAngle = startAngle + SLICE_DEG;
              const midAngle = idx * SLICE_DEG;
              const color = getPocketColor(num);

              const outerFill =
                color === 'green'
                  ? '#059669'
                  : color === 'red'
                  ? '#b91c1c'
                  : '#111827';

              const innerFill =
                color === 'green'
                  ? '#047857'
                  : color === 'red'
                  ? '#991b1b'
                  : '#090d14';

              const isWinningPocket = !isSpinning && winningNumber === num;
              const textPos = polarToCartesian(cx, cy, 130, midAngle);

              return (
                <g key={num}>
                  {/* Number Ring Segment */}
                  <path
                    d={createWedgePath(cx, cy, 144, 117, startAngle, endAngle)}
                    fill={outerFill}
                    stroke="#c9a227"
                    strokeWidth="0.9"
                  />
                  {/* Pocket Well Segment */}
                  <path
                    d={createWedgePath(cx, cy, 117, 94, startAngle, endAngle)}
                    fill={innerFill}
                    stroke="#b48a2e"
                    strokeWidth="0.9"
                  />
                  {/* Highlight Winning Pocket */}
                  {isWinningPocket && (
                    <path
                      d={createWedgePath(cx, cy, 144, 94, startAngle, endAngle)}
                      fill="rgba(251, 191, 36, 0.24)"
                      stroke="#fbbf24"
                      strokeWidth="2"
                    />
                  )}
                  {/* Number Label */}
                  <text
                    x={textPos.x}
                    y={textPos.y}
                    fill={isWinningPocket ? '#fef08a' : '#f8fafc'}
                    fontSize="10"
                    fontWeight="700"
                    fontFamily="var(--font-mono), monospace"
                    textAnchor="middle"
                    dominantBaseline="central"
                    transform={`rotate(${midAngle} ${textPos.x} ${textPos.y})`}
                  >
                    {num}
                  </text>
                </g>
              );
            })}

            {/* Inner Brass Ring & Felt Hub */}
            <circle cx={cx} cy={cy} r={94} fill="#06281c" stroke="#d4af37" strokeWidth="2.5" />
            <circle cx={cx} cy={cy} r={84} fill="none" stroke="#10b981" strokeOpacity="0.25" strokeWidth="1" />

            {/* 4 Gold Turret Spokes */}
            {[0, 90, 180, 270].map((angle) => {
              const p1 = polarToCartesian(cx, cy, 24, angle);
              const p2 = polarToCartesian(cx, cy, 86, angle);
              return (
                <g key={angle}>
                  <line
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke="url(#turretGold)"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                  />
                  <circle cx={p2.x} cy={p2.y} r="4.5" fill="url(#turretGold)" />
                </g>
              );
            })}

            {/* Center Brass Cap */}
            <circle cx={cx} cy={cy} r={26} fill="url(#turretGold)" stroke="#fef3c7" strokeWidth="1" />
            <circle cx={cx} cy={cy} r={10} fill="#141b24" stroke="#d4af37" strokeWidth="1.5" />
          </g>

          {/* Ivory Roulette Ball */}
          {showBall && (
            <g>
              <circle
                cx={ballPos.x + 1.5}
                cy={ballPos.y + 2}
                r={5.8}
                fill="rgba(0,0,0,0.55)"
              />
              <circle
                cx={ballPos.x}
                cy={ballPos.y}
                r={5.5}
                fill="url(#ivoryBall)"
                stroke="#ffffff"
                strokeWidth="0.6"
              />
            </g>
          )}
        </svg>
      </div>

      {/* Compact Pocket Readout Pill-Free Bar */}
      <div className="mt-1 sm:mt-2 min-h-[32px] flex items-center justify-center">
        {isSpinning ? (
          <span className="text-xs font-mono uppercase tracking-widest text-amber-300">
            Ball in Motion...
          </span>
        ) : winningNumber !== null && settledColor ? (
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-[#0d141b] border border-amber-500/35 shadow-sm">
            <span
              className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-mono font-bold text-white border ${
                settledColor === 'green'
                  ? 'bg-emerald-600 border-emerald-400'
                  : settledColor === 'red'
                  ? 'bg-red-700 border-red-500'
                  : 'bg-slate-900 border-slate-600'
              }`}
            >
              {winningNumber}
            </span>
            <span className="text-xs font-mono uppercase tracking-wider text-slate-200 font-semibold">
              {settledColor === 'green'
                ? 'Zero · Green'
                : settledColor === 'red'
                ? 'Red'
                : 'Black'}
            </span>
          </div>
        ) : (
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
            European Single Zero · 37 Pockets
          </span>
        )}
      </div>
    </div>
  );
};
