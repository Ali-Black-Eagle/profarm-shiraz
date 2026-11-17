import { Order, OrderStatus } from '@/types';

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

/**
 * Valid order status transitions enforced on the server API.
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'PROCESSING', 'CANCELLED'],
  DELIVERED: ['DELIVERED'],
  CANCELLED: ['CANCELLED'],
};

export function isValidOrderStatusTransition(
  currentStatus: OrderStatus | string | undefined,
  nextStatus: OrderStatus | string,
  paymentGateway?: string | null
): { allowed: boolean; reason?: string } {
  if (!currentStatus) return { allowed: true };
  if (currentStatus === nextStatus) return { allowed: true };

  // COD orders may transition from PENDING_PAYMENT -> OUT_FOR_DELIVERY -> DELIVERED
  const isCod = String(paymentGateway || '').toUpperCase() === 'COD';
  if (isCod && currentStatus === 'PENDING_PAYMENT' && nextStatus === 'OUT_FOR_DELIVERY') {
    return { allowed: true };
  }

  const allowed = ALLOWED_TRANSITIONS[currentStatus as OrderStatus];
  if (!allowed) return { allowed: false, reason: 'وضعیت فعلی سفارش نامعتبر است.' };

  if (!allowed.includes(nextStatus as OrderStatus)) {
    return {
      allowed: false,
      reason: `تغییر وضعیت از «${currentStatus}» به «${nextStatus}» مجاز نمی‌باشد.`,
    };
  }

  return { allowed: true };
}
