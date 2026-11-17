import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'organic' | 'pro' | 'warning' | 'neutral' | 'success' | 'bulk' | 'danger' | 'info';
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  children,
  className,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold tracking-normal transition-colors';

  const variantClasses: Record<NonNullable<BadgeProps['variant']>, string> = {
    organic:
      'bg-farm-primary/10 text-farm-primary border border-farm-primary/25',
    pro:
      'bg-gradient-to-l from-farm-primary via-farm-primary-dark to-[#7A5614] text-[#F8E7B5] border border-farm-accent/40 shadow-xs',
    warning:
      'bg-amber-100 text-amber-950 border border-amber-300',
    neutral:
      'bg-farm-bg-warm text-farm-primary border border-farm-border',
    success:
      'bg-emerald-100 text-emerald-900 border border-emerald-300',
    bulk:
      'bg-orange-100 text-orange-950 border border-orange-300',
    danger:
      'bg-rose-100 text-rose-900 border border-rose-300',
    info:
      'bg-sky-100 text-sky-900 border border-sky-300',
  };

  return (
    <span className={cn(baseClasses, variantClasses[variant], className)} {...props}>
      {children}
    </span>
  );
};
