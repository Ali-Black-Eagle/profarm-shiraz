'use client';

import React, { useId } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  containerClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, error, id, className, containerClassName, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText ? `${inputId}-helper` : undefined;

    return (
      <div className={cn('space-y-1.5', containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs sm:text-sm font-bold text-farm-text"
          >
            {label}
            {props.required && <span className="text-rose-600 mr-1">*</span>}
          </label>
        )}

        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={[errorId, helperId].filter(Boolean).join(' ') || undefined}
          className={cn(
            // text-base (16px) on mobile prevents iOS Safari auto-zoom on focus
            'w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border bg-farm-bg text-base sm:text-sm text-farm-text placeholder:text-gray-500 transition-colors focus:bg-white focus:outline-none',
            error
              ? 'border-rose-500 bg-rose-50/30 focus:border-rose-600'
              : 'border-farm-border focus:border-farm-primary',
            className
          )}
          {...props}
        />

        {error && (
          <p id={errorId} role="alert" className="text-xs font-semibold text-rose-700">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={helperId} className="text-xs text-farm-text-muted">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
  containerClassName?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, helperText, error, id, className, containerClassName, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText ? `${inputId}-helper` : undefined;

    return (
      <div className={cn('space-y-1.5', containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs sm:text-sm font-bold text-farm-text"
          >
            {label}
            {props.required && <span className="text-rose-600 mr-1">*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          id={inputId}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={[errorId, helperId].filter(Boolean).join(' ') || undefined}
          className={cn(
            'w-full px-3.5 py-2.5 rounded-xl border bg-farm-bg text-base sm:text-sm text-farm-text placeholder:text-gray-500 transition-colors focus:bg-white focus:outline-none',
            error
              ? 'border-rose-500 bg-rose-50/30 focus:border-rose-600'
              : 'border-farm-border focus:border-farm-primary',
            className
          )}
          {...props}
        />

        {error && (
          <p id={errorId} role="alert" className="text-xs font-semibold text-rose-700">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={helperId} className="text-xs text-farm-text-muted">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
