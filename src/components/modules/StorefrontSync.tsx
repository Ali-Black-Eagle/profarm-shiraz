'use client';

import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';

/**
 * Mounted once in the root layout. Loads the session from the server (clears a stale login on 401) and refreshes
 * the cart's product data (names, prices, stock) from the catalog API.
 */
export function StorefrontSync() {
  useEffect(() => {
    void useAuth.getState().refreshProfile();
    if (useCart.getState().lines.length > 0) {
      void useCart.getState().refreshCatalog();
    } else {
      useCart.setState({ catalogLoaded: true });
    }
  }, []);

  return null;
}
