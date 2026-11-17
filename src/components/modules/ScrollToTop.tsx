'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Component that guarantees the viewport resets to the very top (0, 0)
 * immediately upon navigating between different routes in the application.
 * Prevents Next.js / browser from retaining scroll offsets of previous pages.
 */
export function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    // Disable native automatic scroll restoration which often retains previous scroll offsets
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Immediately reset window scroll position to top
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'instant' as ScrollBehavior,
      });

      // Secondary fallback for cross-browser compatibility
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [pathname]);

  return null;
}
