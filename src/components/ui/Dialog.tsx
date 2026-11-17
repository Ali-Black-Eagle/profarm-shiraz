'use client';

import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
  className?: string;
  bodyClassName?: string;
  headerActions?: React.ReactNode;
}

const SIZE_CLASSES: Record<NonNullable<DialogProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
};

/**
 * Accessible Modal Dialog built on the native HTML <dialog> element and showModal().
 * - Automatic top-layer rendering, inert background, and Esc-to-close.
 * - Restores keyboard focus to the triggering element on close.
 * - Pointerdown/pointerup backdrop detection avoids closing during text selection drags.
 */
export const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  size = 'lg',
  closeOnBackdrop = true,
  showCloseButton = true,
  className,
  bodyClassName,
  headerActions,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const backdropPointerDownRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) {
        openerRef.current = document.activeElement as HTMLElement | null;
        try {
          dialog.showModal();
        } catch {
          // Fallback if browser/WebView already considers dialog open
        }
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Ensure focus returns to opener when dialog closes (including older Android WebViews)
  const restoreFocus = () => {
    const opener = openerRef.current;
    openerRef.current = null;
    if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
      requestAnimationFrame(() => opener.focus());
    }
  };

  const handleClose = () => {
    restoreFocus();
    onClose();
  };

  const handleCancel = (e: React.SyntheticEvent<HTMLDialogElement>) => {
    e.preventDefault();
    handleClose();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDialogElement>) => {
    backdropPointerDownRef.current = e.target === dialogRef.current;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDialogElement>) => {
    if (
      closeOnBackdrop &&
      backdropPointerDownRef.current &&
      e.target === dialogRef.current
    ) {
      handleClose();
    }
    backdropPointerDownRef.current = false;
  };

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      dir="rtl"
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={handleCancel}
      onClose={() => {
        // Sync React state if closed natively (e.g., via closedby="any" or form method="dialog")
        restoreFocus();
        if (open) onClose();
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      {...(closeOnBackdrop ? ({ closedby: 'any' } as Record<string, string>) : {})}
      className={cn(
        'profarm-dialog fixed inset-0 m-auto p-0 w-[calc(100vw-2rem)] max-h-[90dvh] rounded-3xl bg-white border border-farm-border shadow-2xl text-right overflow-hidden open:flex open:flex-col',
        SIZE_CLASSES[size],
        className
      )}
    >
      {(title || showCloseButton || headerActions) && (
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b border-farm-bg-warm bg-white shrink-0 no-print">
          <div className="flex items-start gap-3 min-w-0">
            {icon && (
              <div className="w-10 h-10 rounded-2xl bg-farm-primary/10 text-farm-primary flex items-center justify-center shrink-0">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              {title && (
                <h2 id={titleId} className="text-base sm:text-lg font-black text-farm-primary leading-snug">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descriptionId} className="text-xs text-farm-text-muted mt-0.5 leading-relaxed">
                  {description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {headerActions}
            {showCloseButton && (
              <button
                type="button"
                onClick={handleClose}
                aria-label="بستن پنجره"
                className="min-w-[44px] min-h-[44px] -ml-1.5 flex items-center justify-center rounded-xl text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className={cn('flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 py-5', bodyClassName)}>
        {children}
      </div>

      {footer && (
        <div className="px-5 sm:px-6 py-4 border-t border-farm-bg-warm bg-farm-bg/60 flex flex-wrap items-center justify-end gap-2.5 shrink-0 no-print">
          {footer}
        </div>
      )}
    </dialog>
  );
};
