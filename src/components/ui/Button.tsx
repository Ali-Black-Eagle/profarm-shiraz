'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'gold' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      loadingText = 'لطفاً شکیبا باشید...',
      children,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseClasses =
      'inline-flex items-center justify-center font-bold rounded-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none';

    const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
      // Compact visual height with expanded touch target on coarse pointers via ::after
      sm: 'relative text-xs px-3.5 py-2 min-h-[36px] gap-1.5 after:content-[""] after:absolute after:-inset-y-1 after:inset-x-0',
      md: 'text-sm px-4 py-2.5 min-h-[44px] gap-2',
      lg: 'text-base px-6 py-3.5 min-h-[48px] gap-2.5 shadow-sm',
      icon: 'min-w-[44px] min-h-[44px] p-2',
    };

    const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
      primary:
        'bg-farm-primary text-white hover:bg-farm-primary-dark hover:shadow-md active:bg-[#162717]',
      // Accessible dark ink (#172419) on gold/sand fill (>= 7.5:1 contrast)
      secondary:
        'bg-farm-accent text-farm-gold-ink hover:bg-[#c59261] active:bg-[#b88352] shadow-sm',
      outline:
        'border border-farm-primary text-farm-primary bg-transparent hover:bg-farm-primary/10',
      gold:
        'bg-gradient-to-l from-[#D4AF37] to-[#E7C869] text-farm-gold-ink font-extrabold shadow-sm hover:brightness-105 active:brightness-95',
      ghost:
        'text-farm-primary hover:bg-farm-primary/10 active:bg-farm-primary/20',
      danger:
        'bg-rose-700 text-white hover:bg-rose-800 active:bg-rose-900 shadow-xs',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseClasses, sizeClasses[size], variantClasses[variant], className)}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            <span>{loadingText}</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
