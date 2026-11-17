'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog';
import { cn } from '@/lib/utils';

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

export interface ConfirmOptions {
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogProps['variant'];
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant, durationMs?: number) => void;
  success: (message: string, durationMs?: number) => void;
  error: (message: string, durationMs?: number) => void;
  info: (message: string, durationMs?: number) => void;
  warning: (message: string, durationMs?: number) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { open: boolean }) | null>(null);
  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'info', durationMs = 4500) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, message, variant }]);
      if (durationMs > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, durationMs);
      }
    },
    [dismissToast]
  );

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      if (confirmResolverRef.current) {
        confirmResolverRef.current(false);
      }
      confirmResolverRef.current = resolve;
      setConfirmState({ ...options, open: true });
    });
  }, []);

  const handleConfirmChoice = useCallback((choice: boolean) => {
    const resolver = confirmResolverRef.current;
    confirmResolverRef.current = null;
    setConfirmState(null);
    if (resolver) resolver(choice);
  }, []);

  const contextValue = useMemo<ToastContextValue>(
    () => ({
      showToast,
      success: (msg, ms) => showToast(msg, 'success', ms),
      error: (msg, ms) => showToast(msg, 'error', ms ?? 5500),
      info: (msg, ms) => showToast(msg, 'info', ms),
      warning: (msg, ms) => showToast(msg, 'warning', ms ?? 5000),
      confirm,
    }),
    [showToast, confirm]
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      {/* Accessible 320px-safe Toast Stack (never overflows viewport) */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:left-6 sm:w-full sm:max-w-md z-[60] flex flex-col gap-2.5 pointer-events-none no-print"
      >
        {toasts.map((t) => {
          const isError = t.variant === 'error';
          const styles: Record<ToastVariant, string> = {
            success: 'bg-farm-primary text-white border-emerald-400/30',
            error: 'bg-rose-800 text-white border-rose-400/40',
            warning: 'bg-amber-950 text-amber-50 border-amber-400/40',
            info: 'bg-gray-900 text-white border-gray-700',
          };
          const Icon =
            t.variant === 'success'
              ? CheckCircle2
              : t.variant === 'error'
              ? AlertCircle
              : t.variant === 'warning'
              ? AlertTriangle
              : Info;

          return (
            <div
              key={t.id}
              role={isError ? 'alert' : 'status'}
              className={cn(
                'pointer-events-auto w-full max-w-[calc(100vw-2rem)] p-3.5 rounded-2xl border shadow-2xl flex items-start gap-2.5 text-xs sm:text-sm font-bold animate-in fade-in slide-in-from-bottom-2',
                styles[t.variant]
              )}
            >
              <Icon className="w-5 h-5 shrink-0 mt-0.5 text-farm-accent" />
              <span className="flex-1 leading-relaxed break-words">{t.message}</span>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                aria-label="بستن اعلان"
                className="min-w-[32px] min-h-[32px] -mt-1 -ml-1 flex items-center justify-center rounded-lg hover:bg-white/15 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Global Native <dialog> Confirm Provider */}
      {confirmState && (
        <ConfirmDialog
          open={confirmState.open}
          title={confirmState.title}
          description={confirmState.description}
          confirmLabel={confirmState.confirmLabel}
          cancelLabel={confirmState.cancelLabel}
          variant={confirmState.variant}
          onConfirm={() => handleConfirmChoice(true)}
          onCancel={() => handleConfirmChoice(false)}
        />
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

export function useConfirm() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within a ToastProvider');
  }
  return ctx.confirm;
}
