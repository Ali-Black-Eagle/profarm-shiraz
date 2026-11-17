'use client';

import React from 'react';
import { AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Dialog } from './Dialog';
import { Button } from './Button';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Accessible Confirmation Dialog built on native <dialog>.
 * Automatically focuses the Cancel button for destructive actions to prevent accidental Enter confirmations.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmLabel = 'تایید و ادامه',
  cancelLabel = 'انصراف',
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  const isDestructive = variant === 'danger' || variant === 'warning';

  const icon =
    variant === 'danger' ? (
      <ShieldAlert className="w-5 h-5 text-rose-700" />
    ) : variant === 'warning' ? (
      <AlertTriangle className="w-5 h-5 text-amber-700" />
    ) : (
      <CheckCircle2 className="w-5 h-5 text-farm-primary" />
    );

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      icon={icon}
      size="sm"
      closeOnBackdrop={!isLoading}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            size="md"
            autoFocus={isDestructive}
            disabled={isLoading}
            onClick={onCancel}
            className="border-farm-border text-gray-700 hover:bg-gray-100"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === 'danger' ? 'danger' : variant === 'warning' ? 'secondary' : 'primary'}
            size="md"
            autoFocus={!isDestructive}
            isLoading={isLoading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
        {description}
      </div>
    </Dialog>
  );
};
