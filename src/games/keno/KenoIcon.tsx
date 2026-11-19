import React from 'react';

interface KenoIconProps {
  size?: number;
  className?: string;
}

/**
 * Custom vector emblem for Keno: brushed gold lottery sphere and emerald ticket motif.
 */
export const KenoIcon: React.FC<KenoIconProps> = ({ size = 22, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <radialGradient id="kenoBallGrad" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="55%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#92400e" />
        </radialGradient>
        <linearGradient id="kenoCardGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#065f46" />
          <stop offset="100%" stopColor="#022c22" />
        </linearGradient>
      </defs>

      {/* Ticket frame */}
      <rect
        x="3"
        y="6"
        width="20"
        height="22"
        rx="3.5"
        fill="url(#kenoCardGrad)"
        stroke="#34d399"
        strokeWidth="1.5"
      />
      {/* Mini grid spots */}
      <circle cx="8" cy="12" r="1.5" fill="#6ee7b7" />
      <circle cx="13" cy="12" r="1.5" fill="#10b981" opacity="0.5" />
      <circle cx="8" cy="17.5" r="1.5" fill="#10b981" opacity="0.5" />
      <circle cx="13" cy="17.5" r="1.5" fill="#fde68a" />
      <circle cx="8" cy="23" r="1.5" fill="#fde68a" />
      <circle cx="13" cy="23" r="1.5" fill="#10b981" opacity="0.5" />

      {/* Highlighted numbered Keno sphere */}
      <circle
        cx="21.5"
        cy="12.5"
        r="8"
        fill="url(#kenoBallGrad)"
        stroke="#fef3c7"
        strokeWidth="1.4"
      />
      <circle cx="21.5" cy="12.5" r="4.6" fill="#0f172a" />
      <text
        x="21.5"
        y="14.7"
        textAnchor="middle"
        fill="#fde68a"
        fontSize="6.5"
        fontWeight="700"
        fontFamily="monospace"
      >
        80
      </text>
    </svg>
  );
};
