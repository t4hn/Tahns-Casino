import React from 'react';
import { Coins } from 'lucide-react';
import { useCasino } from '../context/CasinoContext';

interface CurrencyDisplayProps {
  amount?: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
  onClick?: () => void;
}

export const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({
  amount,
  size = 'md',
  showLabel = true,
  className = '',
  onClick,
}) => {
  const { profile, settings } = useCasino();
  const value = amount !== undefined ? amount : (profile ? profile.credits : 0);

  const formatNumber = (num: number) => {
    if (settings.currencyNotation === 'abbreviated') {
      if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
      if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
      return num.toLocaleString();
    }
    return num.toLocaleString();
  };

  const sizeClasses = {
    sm: 'text-xs px-2.5 py-1 gap-1.5',
    md: 'text-sm px-3 py-1.5 gap-2',
    lg: 'text-base sm:text-lg px-4 py-2 gap-2.5',
  };

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 20,
  };

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`inline-flex items-center rounded-lg bg-[#141b24] border border-amber-500/25 text-amber-300 font-medium shadow-sm transition-all duration-150 ${
        onClick ? 'cursor-pointer hover:border-amber-400/50 hover:bg-[#1a2330] active:scale-[0.98]' : ''
      } ${sizeClasses[size]} ${className}`}
    >
      <div className="flex items-center justify-center rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 text-slate-950 p-0.5 shadow-xs shrink-0">
        <Coins size={iconSizes[size]} strokeWidth={2.5} className="text-[#0a0d12]" />
      </div>
      <span className="font-mono font-semibold tracking-tight tabular-nums text-amber-200">
        {formatNumber(value)}
      </span>
      {showLabel && (
        <span className="text-amber-400/80 font-normal text-xs uppercase tracking-wider">
          Credits
        </span>
      )}
    </div>
  );
};
