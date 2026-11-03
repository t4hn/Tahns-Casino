import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface DailyBonusCountdownProps {
  lastDailyClaim?: number;
  className?: string;
  showIcon?: boolean;
}

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

export const DailyBonusCountdown: React.FC<DailyBonusCountdownProps> = ({
  lastDailyClaim,
  className = '',
  showIcon = true,
}) => {
  const calculateRemaining = () => {
    if (!lastDailyClaim) return 0;
    return Math.max(0, COOLDOWN_MS - (Date.now() - lastDailyClaim));
  };

  const [remainingMs, setRemainingMs] = useState<number>(calculateRemaining);

  useEffect(() => {
    // Only set up 1-second interval if on cooldown
    const initial = calculateRemaining();
    setRemainingMs(initial);

    if (initial <= 0) return;

    const timer = setInterval(() => {
      const nextRemaining = calculateRemaining();
      setRemainingMs(nextRemaining);
      if (nextRemaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [lastDailyClaim]);

  if (remainingMs <= 0) {
    return <span className={className}>Ready to claim</span>;
  }

  const hours = Math.floor(remainingMs / (1000 * 60 * 60));
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);

  const formatted = `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return (
    <span className={`inline-flex items-center gap-1.5 tabular-nums ${className}`}>
      {showIcon && <Clock size={13} className="text-amber-400 shrink-0" />}
      <span>{formatted}</span>
    </span>
  );
};
