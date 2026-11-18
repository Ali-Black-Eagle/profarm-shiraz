/**
 * Order administration shared by /api/admin/orders, /api/admin?type=orders and the legacy /api/admin POST.
 * Every status change goes through one function, under the order lock, and sends its SMS once (inside the store).
 */
import 'server-only';
import { farmStore, sanitizeUser } from './db-store';
import { canTransition, getAllowedNextStatuses, isCodOrder } from './order-utils';
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

/** Statuses of orders that are paid, confirmed or already with the courier. */
const DELIVERABLE_STATUSES: OrderStatus[] = ['PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED'];

/** Payment method values that mean cash or card on delivery (the stored values differ by source). */
const COD_PAYMENT_METHODS = ['cod', 'cash', 'card-on-delivery'];

/**
 * Orders the driver takes out today: confirmed orders in DELIVERABLE_STATUSES, plus cash-on-delivery orders that
 * are still PENDING_PAYMENT (nothing is charged online, so they wait for the admin, but the driver still delivers them).
 */
export function isDeliverableOrder(order: Order): boolean {
  if (DELIVERABLE_STATUSES.includes(order.status)) return true;
  if (order.status !== 'PENDING_PAYMENT') return false;
  const method = String(order.paymentMethod || '').toLowerCase();
  return isCodOrder(order) || COD_PAYMENT_METHODS.includes(method);
}

/** Status filter: 'ALL', 'DELIVERABLE', one status, or a comma-separated list of statuses. */
export type OrderStatusFilter = 'ALL' | 'DELIVERABLE' | OrderStatus[];

/** Parses the status query value. Returns null when a name is not a known status. */
export function parseOrderStatusFilter(raw: string | null | undefined): OrderStatusFilter | null {
  const value = (raw || '').trim();
  if (!value || value === 'ALL') return 'ALL';
  if (value === 'DELIVERABLE') return 'DELIVERABLE';
  const parts = value.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const statuses: OrderStatus[] = [];
  for (const part of parts) {
    if (!ORDER_STATUSES.includes(part as OrderStatus)) return null;
    if (!statuses.includes(part as OrderStatus)) statuses.push(part as OrderStatus);
  }
  return statuses;
}

function matchesStatusFilter(order: Order, filter: OrderStatusFilter): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'DELIVERABLE') return isDeliverableOrder(order);
  return filter.includes(order.status);
}

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
  /** 'ALL' (default), 'DELIVERABLE', one status, or a comma-separated list of statuses. */
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
  // An unknown status name matches nothing rather than everything (the API rejects it before this point).
  const statusFilter = parseOrderStatusFilter(filters.status) ?? [];
  const rawQuery = (filters.q || '').trim();
  const digitsQuery = toEnglishDigits(rawQuery).replace(/\s+/g, '');
  const textQuery = normalizeSearchText(rawQuery);
  const phoneQuery = /^\d{3,}$/.test(digitsQuery) ? digitsQuery : null;

  return farmStore
    .getOrders()
    .filter((order) => {
      if (!matchesStatusFilter(order, statusFilter)) return false;
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
