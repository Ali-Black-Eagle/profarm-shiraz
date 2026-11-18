import { Order, OrderStatus, ReturnStatus } from '@/types';

/**
 * Explicit definition of a countable (realized / paid) order for financial reporting:
 * - Excludes CANCELLED and unpaid PENDING_PAYMENT orders.
 * - Online paid orders count once in PROCESSING, OUT_FOR_DELIVERY, DELIVERED, or payment.status === 'SUCCESS'.
 * - Cash-on-delivery (COD) orders count only once DELIVERED (cash collected at door).
 */
export function isCountableSaleOrder(order: Order | null | undefined): boolean {
  if (!order) return false;
  if (order.status === 'CANCELLED') return false;

  const gateway = String(order.payment?.gateway || '').toUpperCase();
  if (gateway === 'COD') {
    return order.status === 'DELIVERED';
  }

  return (
    order.status === 'PROCESSING' ||
    order.status === 'OUT_FOR_DELIVERY' ||
    order.status === 'DELIVERED' ||
    order.payment?.status === 'SUCCESS'
  );
}

/**
 * Structural check for digital / non-physical orders (e.g., online Pro/Plus subscriptions).
 * Relies strictly on structured order/item fields (never title string matching).
 */
export function isDigitalOrder(order: Order | null | undefined): boolean {
  if (!order) return false;
  if (order.isSubscription === true) return true;
  if (order.subscriptionPlan === 'PRO' || order.subscriptionPlan === 'PLUS') return true;

  if (Array.isArray(order.items) && order.items.length > 0) {
    const allDigitalCategory = order.items.every((item) => {
      const cat = String(item.product?.category || '').toUpperCase();
      return cat === 'SUBSCRIPTION' || cat === 'DIGITAL' || item.product?.isDigital === true;
    });
    if (allDigitalCategory) return true;
  } else if (!order.deliverySlot) {
    // Legacy subscription orders with zero physical items and no delivery slot
    return true;
  }

  return false;
}

/** Cash on delivery: the customer pays the courier, so no online payment is required first. */
export function isCodOrder(order: Pick<Order, 'payment' | 'paymentMethod'> | null | undefined): boolean {
  if (!order) return false;
  return String(order.payment?.gateway || order.paymentMethod || '').toUpperCase() === 'COD';
}

/** Payment methods (stored values differ by source) that mean cash or card on delivery. */
const COD_METHOD_VALUES = ['cod', 'cash', 'card-on-delivery'];

/**
 * A cash-on-delivery order that nobody has confirmed yet: still PENDING_PAYMENT. Such an order holds stock until
 * codConfirmationHours pass, after which the expiry sweep cancels it. Manual paid-offline orders are never included.
 */
export function isUnconfirmedCodOrder(
  order: Pick<Order, 'status' | 'payment' | 'paymentMethod'> | null | undefined
): boolean {
  if (!order || order.status !== 'PENDING_PAYMENT') return false;
  return isCodOrder(order) || COD_METHOD_VALUES.includes(String(order.paymentMethod || '').toLowerCase());
}

/** Online payment confirmed by the gateway (payment.status SUCCESS). */
export function isOnlinePaid(order: Pick<Order, 'payment'> | null | undefined): boolean {
  return order?.payment?.status === 'SUCCESS';
}

/** Statuses from which an order can no longer move (except nothing: they are final). */
const FINAL_STATUSES: OrderStatus[] = ['CANCELLED', 'DELIVERED'];

/**
 * The single source of truth for order status changes.
 * - Staying on the same status is always allowed (a no-op).
 * - Any non-final order can be CANCELLED (the caller must run the cancel side effects).
 * - PENDING_PAYMENT -> PROCESSING only when the online payment is confirmed (payment.status SUCCESS) or the order is COD.
 * - PENDING_PAYMENT -> OUT_FOR_DELIVERY only for COD.
 * - PROCESSING -> OUT_FOR_DELIVERY | DELIVERED.
 * - OUT_FOR_DELIVERY -> DELIVERED | PROCESSING.
 * - CANCELLED and DELIVERED are final.
 */
export function canTransition(
  order: Pick<Order, 'status' | 'payment' | 'paymentMethod'> | null | undefined,
  next: OrderStatus
): { allowed: boolean; reason?: string } {
  if (!order) return { allowed: false, reason: 'سفارش یافت نشد.' };
  const current = order.status;
  if (current === next) return { allowed: true };

  const blocked = (reason: string) => ({ allowed: false, reason });
  const label = (s: OrderStatus) => STATUS_LABELS[s] || s;

  if (FINAL_STATUSES.includes(current)) {
    return blocked(`سفارش در وضعیت «${label(current)}» است و دیگر قابل تغییر نیست.`);
  }
  if (next === 'CANCELLED') return { allowed: true };

  const cod = isCodOrder(order);

  if (current === 'PENDING_PAYMENT') {
    if (next === 'PROCESSING') {
      if (cod || isOnlinePaid(order)) return { allowed: true };
      return blocked('این سفارش هنوز پرداخت نشده است و تا تأیید پرداخت نمی‌تواند وارد پردازش شود.');
    }
    if (next === 'OUT_FOR_DELIVERY' && cod) return { allowed: true };
    return blocked(`تغییر وضعیت از «${label(current)}» به «${label(next)}» مجاز نمی‌باشد.`);
  }

  if (current === 'PROCESSING') {
    if (next === 'OUT_FOR_DELIVERY' || next === 'DELIVERED') return { allowed: true };
    return blocked(`تغییر وضعیت از «${label(current)}» به «${label(next)}» مجاز نمی‌باشد.`);
  }

  if (current === 'OUT_FOR_DELIVERY') {
    if (next === 'DELIVERED' || next === 'PROCESSING') return { allowed: true };
    return blocked(`تغییر وضعیت از «${label(current)}» به «${label(next)}» مجاز نمی‌باشد.`);
  }

  return blocked('وضعیت فعلی سفارش نامعتبر است.');
}

/** Statuses an order may move to right now (excludes its current status). Used by admin dropdowns. */
export function getAllowedNextStatuses(
  order: Pick<Order, 'status' | 'payment' | 'paymentMethod'> | null | undefined
): OrderStatus[] {
  const all: OrderStatus[] = ['PENDING_PAYMENT', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
  return all.filter((s) => s !== order?.status && canTransition(order, s).allowed);
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'در انتظار پرداخت',
  PROCESSING: 'در حال پردازش',
  OUT_FOR_DELIVERY: 'تحویل به پیک',
  DELIVERED: 'تحویل داده شده',
  CANCELLED: 'لغو شده',
};

/**
 * Return request status transitions:
 * PENDING -> APPROVED | REJECTED; APPROVED -> REFUNDED | REJECTED. REFUNDED and REJECTED are final.
 * Re-saving the same status (for example to edit notes) is allowed.
 */
export function canTransitionReturn(
  current: ReturnStatus,
  next: ReturnStatus
): { allowed: boolean; reason?: string } {
  if (current === next) return { allowed: true };
  const table: Record<ReturnStatus, ReturnStatus[]> = {
    PENDING: ['APPROVED', 'REJECTED'],
    APPROVED: ['REFUNDED', 'REJECTED'],
    REFUNDED: [],
    REJECTED: [],
  };
  if (table[current]?.includes(next)) return { allowed: true };
  return { allowed: false, reason: `تغییر وضعیت مرجوعی از «${current}» به «${next}» مجاز نیست.` };
}
