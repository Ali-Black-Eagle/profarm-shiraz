import React from 'react';

interface BadgeProps {
  variant?: 'organic' | 'pro' | 'warning' | 'neutral' | 'success' | 'bulk';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  children,
  className = '',
}) => {
  const baseClasses =
    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium tracking-wide transition-colors';

  const variantClasses = {
    organic:
      'bg-[#2C4A2E]/10 text-[#2C4A2E] border border-[#2C4A2E]/25 font-semibold',
    pro:
      'bg-gradient-to-r from-[#2C4A2E] via-[#243c26] to-[#B8860B] text-amber-200 border border-amber-300/40 shadow-xs',
    warning:
      'bg-amber-100 text-amber-900 border border-amber-300',
    neutral:
      'bg-[#F3EFE6] text-[#2C4A2E] border border-[#E6E1D5]',
    success:
      'bg-emerald-100 text-emerald-800 border border-emerald-300',
    bulk:
      'bg-orange-100 text-orange-800 border border-orange-300',
  };

  return (
    <span className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
};
