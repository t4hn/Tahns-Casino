import React from 'react';

export const BRAND_LOGO_SRC = '/assets/aistudio/file_0000000095b881fabff7dfd6b625b264_d8f23d09.png';

interface BrandMarkProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-8 w-8 rounded-lg',
  md: 'h-9 w-9 rounded-xl',
  lg: 'h-12 w-12 rounded-2xl',
};

export const BrandMark: React.FC<BrandMarkProps> = ({ size = 'md', className = '' }) => {
  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-[#061811] border border-emerald-400/35 shadow-sm shadow-emerald-500/20 ${SIZE_CLASSES[size]} ${className}`}
    >
      <img
        src={BRAND_LOGO_SRC}
        alt="Tahn's Casino"
        className="h-full w-full object-cover scale-[1.09] select-none pointer-events-none"
      />
    </div>
  );
};
