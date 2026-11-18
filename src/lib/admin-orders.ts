/**
 * Order administration shared by /api/admin/orders, /api/admin?type=orders and the legacy /api/admin POST.
 * Every status change goes through one function, under the order lock, and sends its SMS once (inside the store).
 */
import { farmStore, sanitizeUser } from './db-store';
import { canTransition, getAllowedNextStatuses } from './order-utils';
import { withOrderLock } from './order-lock';
import { normalizePhoneNumber, toEnglishDigits } from './formatters';
import { normalizeSearchText } from './public-api';
import type { Order, OrderStatus } from '@/types';

export const ORDER_STATUSES: OrderStatus[] = [
  'PENDING_PAYMENT',
  'PROCESSING',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
];

/** Order as the admin sees it: every stored field plus the statuses it may move to right now. */
export function serializeAdminOrder(order: Order) {
  return { ...order, allowedNextStatuses: getAllowedNextStatuses(order) };
}

export type StatusChangeResult =
  | { ok: true; order: Order }
  | { ok: false; reason: 'NOT_FOUND' | 'TRANSITION'; message: string };

/**
 * Moves an order to a new status. Runs under the order's lock and checks the transition again inside it, so a
 * payment callback or an expiry sweep cannot interleave. Cancelling restores stock, slot and coupon once.
 */
export async function changeOrderStatus(orderId: string, status: OrderStatus): Promise<StatusChangeResult> {
  const existing = farmStore.getOrderById(orderId);
  if (!existing) {
    return { ok: false, reason: 'NOT_FOUND', message: 'سفارش مورد نظر یافت نشد.' };
  }
  return withOrderLock(existing.orderNumber, async (): Promise<StatusChangeResult> => {
    const current = farmStore.getOrderById(orderId);
    if (!current) {
      return { ok: false, reason: 'NOT_FOUND', message: 'سفارش مورد نظر یافت نشد.' };
    }
    const transition = canTransition(current, status);
    if (!transition.allowed) {
      return { ok: false, reason: 'TRANSITION', message: transition.reason || 'تغییر وضعیت سفارش مجاز نیست.' };
    }
    const order = await farmStore.updateOrderStatus(orderId, status);
    if (!order) {
      return { ok: false, reason: 'NOT_FOUND', message: 'سفارش مورد نظر یافت نشد.' };
    }
    return { ok: true, order };
  });
}

export interface AdminOrderFilters {
  /** One status, or undefined / 'ALL' for every status. */
  status?: string;
  /** Delivery day (YYYY-MM-DD, Asia/Tehran civil date). Subscriptions have no slot and are excluded. */
  date?: string;
  /** Order number, phone (digits, any Persian/Arabic form) or recipient / account name. */
  q?: string;
}

function slotIsoDate(order: Order): string | undefined {
  if (order.deliverySlot?.isoDate) return order.deliverySlot.isoDate;
  if (order.deliverySlotId) return order.deliverySlotId.slice(0, 10);
  return undefined;
}

function orderCreatedMs(order: Order): number {
  const ms = new Date(order.createdAt).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/** Filtered list, newest first. Filters are applied to the stored orders (no client-side trust). */
export function listAdminOrders(filters: AdminOrderFilters = {}): Order[] {
  const status = filters.status && filters.status !== 'ALL' ? filters.status : null;
  const rawQuery = (filters.q || '').trim();
  const digitsQuery = toEnglishDigits(rawQuery).replace(/\s+/g, '');
  const textQuery = normalizeSearchText(rawQuery);
  const phoneQuery = /^\d{3,}$/.test(digitsQuery) ? digitsQuery : null;

  return farmStore
    .getOrders()
    .filter((order) => {
      if (status && order.status !== status) return false;
      if (filters.date) {
        if (order.isSubscription || slotIsoDate(order) !== filters.date) return false;
      }
      if (textQuery) {
        const name = normalizeSearchText(order.address?.recipientName || order.user?.name || '');
        const numberMatch = order.orderNumber.toLowerCase().includes(rawQuery.toLowerCase());
        const nameMatch = name.includes(textQuery);
        let phoneMatch = false;
        if (phoneQuery) {
          const phones = [order.address?.phone, order.user?.phone]
            .map((p) => normalizePhoneNumber(p || ''))
            .join(' ');
          phoneMatch = phones.includes(phoneQuery);
        }
        if (!numberMatch && !nameMatch && !phoneMatch) return false;
      }
      return true;
    })
    .sort((a, b) => orderCreatedMs(b) - orderCreatedMs(a));
}

/** Count of stored orders per status (all orders, ignoring filters). */
export function countOrdersByStatus(): Record<OrderStatus, number> {
  const counts: Record<OrderStatus, number> = {
    PENDING_PAYMENT: 0,
    PROCESSING: 0,
    OUT_FOR_DELIVERY: 0,
    DELIVERED: 0,
    CANCELLED: 0,
  };
  for (const order of farmStore.getOrders()) {
    if (counts[order.status] !== undefined) counts[order.status]++;
  }
  return counts;
}

/** Account view without the password hash. */
export function safeAccount(userId: string | undefined | null) {
  if (!userId) return null;
  const user = farmStore.getAllUsers().find((u) => u.id === userId);
  return user ? sanitizeUser(user) : null;
}
