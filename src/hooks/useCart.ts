'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, Product } from '@/types';

/**
 * Cart state. Only product ids and quantities are persisted in the browser. Names, prices and stock come from
 * GET /api/products (refreshCatalog), and every amount shown in the cart or at checkout comes from POST /api/orders/quote.
 * The catalog kept here is display data only and is never used to price an order.
 */
export interface CartLine {
  productId: string;
  quantity: number;
}

const LEGACY_STORAGE_KEY = 'profarm_cart_storage';

interface CartStore {
  /** Persisted: what the customer chose. */
  lines: CartLine[];
  /** Memory: public product data by product id, from GET /api/products. */
  catalog: Record<string, Product>;
  /** Memory: lines joined with the catalog (lines whose product is not known yet are left out). */
  items: CartItem[];
  /** Memory: true once a catalog refresh has finished, successfully or not (never left pending). */
  catalogLoaded: boolean;
  /** Memory: true when the last catalog refresh failed. The last known catalog is kept on screen. */
  catalogError: boolean;
  /** Memory: coupon code the customer applied (the server validates it on every quote). */
  appliedCouponCode: string | null;
  /** Memory: set when a refresh removed or clamped something, shown on the cart page. */
  notice: string | null;
  addItem: (product: Product, quantity?: number) => void;
  /** Adds a line by product id only (e.g. reorder). Price and stock come from the next refreshCatalog. */
  addLine: (productId: string, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  setAppliedCouponCode: (code: string | null) => void;
  clearNotice: () => void;
  refreshCatalog: () => Promise<void>;
  /** Sum of list prices (before any discount). The payable total is the quote, not this. */
  getTotalPrice: () => number;
  getTotalItemsCount: () => number;
}

function deriveItems(lines: CartLine[], catalog: Record<string, Product>): CartItem[] {
  const out: CartItem[] = [];
  for (const line of lines) {
    const product = catalog[line.productId];
    if (product) out.push({ product, quantity: line.quantity });
  }
  return out;
}

function clampToStock(quantity: number, product: Product | undefined): number {
  if (!product || !Number.isFinite(product.stock)) return quantity;
  return Math.min(quantity, Math.max(0, product.stock));
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      lines: [],
      catalog: {},
      items: [],
      catalogLoaded: false,
      catalogError: false,
      appliedCouponCode: null,
      notice: null,

      addItem: (product: Product, quantity = 1) => {
        const catalog = { ...get().catalog, [product.id]: product };
        const existing = get().lines.find((l) => l.productId === product.id);
        const wanted = (existing?.quantity ?? 0) + Math.max(1, Math.floor(quantity));
        const newQty = clampToStock(wanted, product);
        if (newQty <= 0) return;
        const lines = existing
          ? get().lines.map((l) => (l.productId === product.id ? { ...l, quantity: newQty } : l))
          : [...get().lines, { productId: product.id, quantity: newQty }];
        set({ lines, catalog, items: deriveItems(lines, catalog) });
      },

      addLine: (productId: string, quantity = 1) => {
        if (!productId) return;
        const add = Math.min(1000, Math.max(1, Math.floor(quantity) || 1));
        const existing = get().lines.find((l) => l.productId === productId);
        const lines = existing
          ? get().lines.map((l) =>
              l.productId === productId ? { ...l, quantity: Math.min(1000, l.quantity + add) } : l
            )
          : [...get().lines, { productId, quantity: add }];
        set({ lines, items: deriveItems(lines, get().catalog) });
      },

      removeItem: (productId: string) => {
        const lines = get().lines.filter((l) => l.productId !== productId);
        set({ lines, items: deriveItems(lines, get().catalog) });
      },

      updateQuantity: (productId: string, quantity: number) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }
        const next = clampToStock(Math.floor(quantity), get().catalog[productId]);
        if (next <= 0) {
          get().removeItem(productId);
          return;
        }
        const lines = get().lines.map((l) => (l.productId === productId ? { ...l, quantity: next } : l));
        set({ lines, items: deriveItems(lines, get().catalog) });
      },

      clearCart: () => {
        set({ lines: [], items: [], appliedCouponCode: null, notice: null });
      },

      setAppliedCouponCode: (code: string | null) => {
        set({ appliedCouponCode: code });
      },

      clearNotice: () => set({ notice: null }),

      refreshCatalog: async () => {
        // catalogLoaded is set on every exit path (finally), so a failed request never leaves the cart spinning.
        // On failure the last known catalog stays in memory and catalogError tells the cart page to offer a retry.
        try {
          const res = await fetch('/api/products', { cache: 'no-store' });
          if (!res.ok) {
            set({ catalogError: true });
            return;
          }
          const data = (await res.json()) as { success?: boolean; products?: Product[] };
          if (!data.success || !Array.isArray(data.products)) {
            set({ catalogError: true });
            return;
          }

          const catalog: Record<string, Product> = {};
          for (const p of data.products) catalog[p.id] = p;

          const removed: string[] = [];
          const clamped: string[] = [];
          const lines: CartLine[] = [];
          for (const line of get().lines) {
            const product = catalog[line.productId];
            if (!product) {
              removed.push(line.productId);
              continue;
            }
            const next = clampToStock(line.quantity, product);
            if (next <= 0) {
              removed.push(product.title);
              continue;
            }
            if (next < line.quantity) clamped.push(product.title);
            lines.push({ productId: line.productId, quantity: next });
          }

          const parts: string[] = [];
          if (removed.length) parts.push('برخی کالاها ناموجود یا خارج از فروش بودند و از سبد حذف شدند.');
          if (clamped.length) parts.push('تعداد برخی کالاها به میزان موجودی انبار کاهش یافت.');
          set({
            catalog,
            lines,
            items: deriveItems(lines, catalog),
            catalogError: false,
            notice: parts.length ? parts.join(' ') : get().notice,
          });
        } catch {
          // Network errors keep the last known catalog; the quote still prices the cart on the server.
          set({ catalogError: true });
        } finally {
          set({ catalogLoaded: true });
        }
      },

      getTotalPrice: () => {
        return get().items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
      },

      getTotalItemsCount: () => {
        return get().lines.reduce((sum, line) => sum + line.quantity, 0);
      },
    }),
    {
      name: 'profarm_cart_v2',
      partialize: (state) => ({ lines: state.lines }),
      onRehydrateStorage: () => () => {
        try {
          window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        } catch {
          // storage unavailable
        }
      },
    }
  )
);
