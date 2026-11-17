'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product, CartItem, SubscriptionTier, SubscriptionSettings } from '@/types';
import { farmStore } from '@/lib/db-store';
import { calculateCartDiscounts as baseCalculateCartDiscounts, CartDiscounts } from '@/lib/formatters';

export type { CartDiscounts };

export function calculateCartDiscounts(
  items: CartItem[],
  tier: SubscriptionTier = 'FREE',
  customSettings?: SubscriptionSettings,
  usedEggQuotaThisMonth: number = 0
): CartDiscounts {
  const settings = customSettings || farmStore.getSubscriptionSettings();
  return baseCalculateCartDiscounts(items, tier, settings, usedEggQuotaThisMonth);
}

interface CartStore {
  items: CartItem[];
  isBulkOrder: boolean;
  bulkNotes: string;
  appliedCouponCode: string | null;
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  setBulkOrder: (isBulk: boolean) => void;
  setBulkNotes: (notes: string) => void;
  setAppliedCouponCode: (code: string | null) => void;
  getTotalPrice: () => number;
  getTotalItemsCount: () => number;
  isEligibleForBulkCheckout: () => boolean;
  getDiscounts: (tier?: SubscriptionTier) => CartDiscounts;
}

const BULK_MIN_TOTAL_PRICE = 5000000; // 5,000,000 Tomans
const BULK_MIN_ITEM_COUNT = 10; // 10 packages

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isBulkOrder: false,
      bulkNotes: '',
      appliedCouponCode: null,

      addItem: (product: Product, quantity = 1) => {
        const currentItems = get().items;
        const existingIndex = currentItems.findIndex((i) => i.product.id === product.id);

        if (existingIndex > -1) {
          const updated = [...currentItems];
          const newQty = Math.min(product.stock, updated[existingIndex].quantity + quantity);
          updated[existingIndex] = { ...updated[existingIndex], quantity: newQty };
          set({ items: updated });
        } else {
          set({
            items: [...currentItems, { product, quantity: Math.min(product.stock, quantity) }],
          });
        }
      },

      removeItem: (productId: string) => {
        set({ items: get().items.filter((i) => i.product.id !== productId) });
      },

      updateQuantity: (productId: string, quantity: number) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }

        const updated = get().items.map((item) => {
          if (item.product.id === productId) {
            return {
              ...item,
              quantity: Math.min(item.product.stock, quantity),
            };
          }
          return item;
        });

        set({ items: updated });
      },

      clearCart: () => {
        set({ items: [], isBulkOrder: false, bulkNotes: '', appliedCouponCode: null });
      },

      setBulkOrder: (isBulk: boolean) => {
        set({ isBulkOrder: isBulk });
      },

      setBulkNotes: (notes: string) => {
        set({ bulkNotes: notes });
      },

      setAppliedCouponCode: (code: string | null) => {
        set({ appliedCouponCode: code });
      },

      getTotalPrice: () => {
        return get().items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
      },

      getTotalItemsCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },

      isEligibleForBulkCheckout: () => {
        const totalCount = get().getTotalItemsCount();
        const totalPrice = get().getTotalPrice();
        return totalCount >= BULK_MIN_ITEM_COUNT || totalPrice >= BULK_MIN_TOTAL_PRICE;
      },

      getDiscounts: (tier = 'FREE') => {
        return calculateCartDiscounts(get().items, tier);
      },
    }),
    {
      name: 'profarm_cart_storage',
    }
  )
);

