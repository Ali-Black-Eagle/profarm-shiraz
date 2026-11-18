'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';
import { useCart } from '@/hooks/useCart';

const CHECKOUT_DRAFT_KEY = 'profarm_checkout_draft';

/**
 * Removes what belonged to the signed-in customer on this browser: the cart (with its applied coupon) and the
 * checkout draft. Each step is guarded, because storage may be unavailable.
 */
function clearCustomerBrowserState() {
  try {
    useCart.getState().clearCart();
  } catch {
    // cart store unavailable
  }
  try {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
  } catch {
    // sessionStorage unavailable
  }
}

/**
 * Session state for the browser. The HttpOnly session cookie is the source of truth: refreshProfile asks the
 * server (GET /api/auth/me) and clears the user on 401. Only non-sensitive display fields are persisted.
 * Addresses, orders and subscription data are never kept here; the pages load them from the API.
 */
interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  /** true once the first /api/auth/me answer has arrived, so pages do not flash the logged-out state. */
  profileLoaded: boolean;
  login: (user: User) => void;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

export const useAuth = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      profileLoaded: false,

      login: (user: User) => {
        set({ user, isAuthenticated: true, profileLoaded: true });
      },

      logout: () => {
        try {
          fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
        } catch {
          // ignore
        }
        clearCustomerBrowserState();
        set({ user: null, isAuthenticated: false, profileLoaded: true });
      },

      refreshProfile: async () => {
        try {
          const res = await fetch('/api/auth/me', { cache: 'no-store' });
          if (res.status === 401) {
            // Only a session that ended while signed in clears the cart. Guests get a 401 on every page load
            // (StorefrontSync), and their cart must stay.
            const wasSignedIn = get().isAuthenticated || get().user !== null;
            set({ user: null, isAuthenticated: false, profileLoaded: true });
            if (wasSignedIn) clearCustomerBrowserState();
            return;
          }
          if (!res.ok) return;
          const data = await res.json();
          if (data?.authenticated && data.user) {
            set({ user: data.user as User, isAuthenticated: true, profileLoaded: true });
          }
        } catch {
          // Network error: keep what we have.
        }
      },
    }),
    {
      name: 'profarm_auth_v2',
      // Minimal public claims only: no addresses and no national ID or birth date.
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user
          ? {
              id: state.user.id,
              name: state.user.name,
              phone: state.user.phone,
              email: state.user.email,
              role: state.user.role,
              tier: state.user.tier,
              isProMember: state.user.isProMember,
              isPhoneVerified: state.user.isPhoneVerified,
              avatarUrl: state.user.avatarUrl,
            }
          : null,
      }),
    }
  )
);
