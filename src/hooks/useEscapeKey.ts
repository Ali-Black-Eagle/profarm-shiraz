'use client';

import { useEffect } from 'react';

/**
 * Calls onEscape when the Escape key is pressed while `active` is true.
 * Used by custom modal overlays that are not built on the native <dialog> component.
 */
export function useEscapeKey(active: boolean, onEscape: () => void): void {
  useEffect(() => {
    if (!active) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onEscape();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [active, onEscape]);
}
