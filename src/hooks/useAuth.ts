'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, UserRole, SubscriptionTier, Address } from '@/types';

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
  togglePro: () => void;
  setTier: (tier: SubscriptionTier) => void;
  updateUser: (updates: Partial<User>) => void;
  addAddress: (address: Omit<Address, 'id' | 'userId'>) => void;
  updateAddress: (id: string, updates: Partial<Address>) => void;
  deleteAddress: (id: string) => void;
  setDefaultAddress: (id: string) => void;
  refreshProfile: () => Promise<void>;
}

export const useAuth = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,

      login: (user: User) => {
        set({ user, isAuthenticated: true });
      },

      logout: () => {
        try {
          fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
        } catch {}
        set({ user: null, isAuthenticated: false });
      },

      togglePro: () => {
        const current = get().user;
        if (!current) return;
        const newProStatus = !current.isProMember;
        set({
          user: {
            ...current,
            isProMember: newProStatus,
            tier: newProStatus ? 'PRO' : 'FREE',
            proExpiresAt: newProStatus ? '۱۴۰۵/۱۲/۲۹' : null,
          },
        });
      },


      setTier: (tier: SubscriptionTier) => {
        const current = get().user;
        if (!current) return;
        const hasAccess = tier === 'PRO' || tier === 'PLUS';
        set({
          user: {
            ...current,
            tier,
            isProMember: hasAccess,
            proExpiresAt: hasAccess ? '۱۴۰۵/۱۲/۲۹' : null,
          },
        });
      },

      updateUser: (updates: Partial<User>) => {
        const current = get().user;
        if (!current) return;
        set({ user: { ...current, ...updates } });
      },

      addAddress: (addr: Omit<Address, 'id' | 'userId'>) => {
        const current = get().user;
        if (!current) return;
        const newAddr: Address = {
          ...addr,
          id: `addr-${Date.now()}`,
          userId: current.id,
          createdAt: new Date().toLocaleDateString('fa-IR'),
          isDefault: (current.addresses || []).length === 0 ? true : !!addr.isDefault,
        };
        let updatedAddresses = [...(current.addresses || [])];
        if (newAddr.isDefault) {
          updatedAddresses = updatedAddresses.map((a) => ({ ...a, isDefault: false }));
        }
        updatedAddresses.push(newAddr);
        set({ user: { ...current, addresses: updatedAddresses } });
      },

      updateAddress: (id: string, updates: Partial<Address>) => {
        const current = get().user;
        if (!current || !current.addresses) return;
        let updated = current.addresses.map((a) => (a.id === id ? { ...a, ...updates } : a));
        if (updates.isDefault) {
          updated = updated.map((a) => (a.id === id ? a : { ...a, isDefault: false }));
        }
        set({ user: { ...current, addresses: updated } });
      },

      deleteAddress: (id: string) => {
        const current = get().user;
        if (!current || !current.addresses) return;
        const updated = current.addresses.filter((a) => a.id !== id);
        if (updated.length > 0 && !updated.some((a) => a.isDefault)) {
          updated[0].isDefault = true;
        }
        set({ user: { ...current, addresses: updated } });
      },

      setDefaultAddress: (id: string) => {
        const current = get().user;
        if (!current || !current.addresses) return;
        const updated = current.addresses.map((a) => ({
          ...a,
          isDefault: a.id === id,
        }));
        set({ user: { ...current, addresses: updated } });
      },

      refreshProfile: async () => {
        try {
          const res = await fetch('/api/auth/me');
          if (!res.ok) return;
          const data = await res.json();
          if (data.authenticated && data.user) {
            set((state) => ({
              isAuthenticated: true,
              user: state.user ? { ...state.user, ...data.user } : data.user,
            }));
          }
        } catch {
          // ignore network errors
        }
      },
    }),
    {
      name: 'profarm_auth_storage',
      // L-4 Security Remediation: Only persist minimal public claims to localStorage.
      // Excludes sensitive PII (nationalId, birthDate, and home addresses)
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
              avatarUrl: state.user.avatarUrl,
            }
          : null,
      }),
    }
  )
);
