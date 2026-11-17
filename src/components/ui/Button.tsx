'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'gold' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

  const sizeClasses = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2.5 gap-2',
    lg: 'text-base px-6 py-3.5 gap-2.5 shadow-sm',
  };

  const variantClasses = {
    primary:
      'bg-[#2C4A2E] text-white hover:bg-[#1E3520] hover:shadow-md active:bg-[#162717]',
    secondary:
      'bg-[#D4A373] text-white hover:bg-[#c29263] active:bg-[#b08052] shadow-sm',
    outline:
      'border-1.5 border-[#2C4A2E] text-[#2C4A2E] bg-transparent hover:bg-[#2C4A2E]/10',
    gold:
      'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white font-semibold shadow-md hover:brightness-105 active:brightness-95',
    ghost:
      'text-[#2C4A2E] hover:bg-[#2C4A2E]/10 active:bg-[#2C4A2E]/20',
    danger:
      'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800',
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>لطفاً شکیبا باشید...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
};
