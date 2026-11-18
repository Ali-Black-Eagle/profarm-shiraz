import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { farmStore } from '@/lib/db-store';
import { getSessionFromRequest } from '@/lib/session';
import { apiErrorResponse } from '@/lib/api-errors';
import { withOrderLock } from '@/lib/order-lock';
import { publicReturn } from '@/lib/public-api';
import type { Order, OrderItem } from '@/types';

export const dynamic = 'force-dynamic';

/** A delivered order can be returned for this long after delivery. */
const RETURN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const RETURN_REASONS = [
  'DAMAGE',
  'DAMAGE_IN_TRANSIT',
  'QUALITY',
  'QUALITY_ISSUE',
  'WRONG_ITEM',
  'CUSTOMER_CANCEL',
] as const;

const returnSchema = z.object({
  orderNumber: z.string().trim().min(1).max(64),
  reason: z.enum(RETURN_REASONS, { errorMap: () => ({ message: 'دلیل مرجوعی نامعتبر است.' }) }),
  description: z.string().trim().max(1000).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().trim().min(1).max(200),
        quantity: z.number().int().min(1).max(1000),
      })
    )
    .min(1, 'حداقل یک کالا برای مرجوعی انتخاب کنید.')
    .max(100),
});

function findOrderItem(order: Order, productId: string): OrderItem | undefined {
  return order.items.find(
    (i) => i.productId === productId || i.product?.slug === productId || i.product?.id === productId
  );
}

/** Quantity of one line already requested for return (pending or approved; rejected requests do not count). */
function alreadyRequestedQuantity(orderNumber: string, item: OrderItem): number {
  return farmStore
    .getReturnRequests()
    .filter(
      (r) =>
        r.orderNumber === orderNumber &&
        r.status !== 'REJECTED' &&
        (r.productId ? r.productId === item.productId : r.productTitle === item.product?.title)
    )
    .reduce((sum, r) => sum + (r.quantity ?? 0), 0);
}

/**
 * GET /api/returns: the caller's own return requests (session required).
 */
export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ success: false, message: 'لطفاً ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
    }

    const ownOrderNumbers = new Set(
      farmStore
        .getOrders()
        .filter((o) => o.userId === session.userId)
        .map((o) => o.orderNumber)
    );
    const returns = farmStore
      .getReturnRequests()
      .filter((r) => ownOrderNumbers.has(r.orderNumber))
      .map(publicReturn);

    return NextResponse.json({ success: true, returns }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'returns GET', 'خطا در دریافت درخواست‌های مرجوعی');
  }
}

/**
 * POST /api/returns (session required)
 * Body: { orderNumber, reason, description?, items: [{ productId, quantity }] }
 * Rules: the order belongs to the caller, is DELIVERED, was delivered within 7 days, and the items are lines of
 * that order. One request is created per product line, with status PENDING. The refund is the paid goods value of
 * the returned units (shipping is not refunded).
 */
export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ success: false, message: 'لطفاً ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const parsed = returnSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || 'اطلاعات مرجوعی نامعتبر است.' },
        { status: 400 }
      );
    }
    const input = parsed.data;

    const user = farmStore.getAllUsers().find((u) => u.id === session.userId);
    const order = farmStore
      .getOrders()
      .find((o) => o.orderNumber === input.orderNumber && o.userId === session.userId);
    if (!order) {
      return NextResponse.json(
        { success: false, message: 'سفارش مورد نظر یافت نشد یا متعلق به حساب کاربری شما نیست.' },
        { status: 404 }
      );
    }
    if (order.isSubscription) {
      return NextResponse.json({ success: false, message: 'اشتراک‌ها قابل مرجوعی نیستند.' }, { status: 409 });
    }
    if (order.status !== 'DELIVERED') {
      return NextResponse.json(
        { success: false, message: 'فقط سفارش‌های تحویل‌داده‌شده قابل مرجوعی هستند.' },
        { status: 409 }
      );
    }
    const deliveredAt = Date.parse(order.deliveredAt || order.updatedAt || order.createdAt);
    if (!Number.isFinite(deliveredAt) || Date.now() - deliveredAt > RETURN_WINDOW_MS) {
      return NextResponse.json(
        { success: false, message: 'مهلت ۷ روزه ثبت مرجوعی برای این سفارش به پایان رسیده است.' },
        { status: 409 }
      );
    }

    // Duplicate lines in the body are merged before the checks.
    const wanted = new Map<string, number>();
    for (const line of input.items) {
      wanted.set(line.productId, (wanted.get(line.productId) ?? 0) + line.quantity);
    }

    const result = await withOrderLock(`return:${order.orderNumber}`, () => {
      const lines: { item: OrderItem; quantity: number }[] = [];
      for (const [productId, quantity] of Array.from(wanted.entries())) {
        const item = findOrderItem(order, productId);
        if (!item) {
          return { ok: false as const, status: 400, message: 'یکی از کالاهای انتخابی در این سفارش وجود ندارد.' };
        }
        const title = item.product?.title || 'کالا';
        if (quantity + alreadyRequestedQuantity(order.orderNumber, item) > item.quantity) {
          return {
            ok: false as const,
            status: 409,
            message: `تعداد مرجوعی برای «${title}» بیش از تعداد خریداری‌شده در این سفارش است.`,
          };
        }
        lines.push({ item, quantity });
      }

      // Goods actually paid (order total without shipping), spread over the line values.
      const itemsNet = order.items.reduce((sum, it) => sum + Math.max(0, it.totalPrice - (it.discountAmount ?? 0)), 0);
      const goodsPaid = Math.max(0, order.totalAmount - (order.shippingFee ?? 0));
      const ratio = itemsNet > 0 ? Math.min(1, goodsPaid / itemsNet) : 0;

      const created = lines.map(({ item, quantity }) => {
        const unitNet = (item.totalPrice - (item.discountAmount ?? 0)) / Math.max(1, item.quantity);
        return farmStore.createReturnRequest({
          orderNumber: order.orderNumber,
          userId: session.userId,
          productId: item.productId,
          customerName: order.address?.recipientName || user?.name || 'مشتری',
          customerPhone: order.address?.phone || user?.phone || '',
          productTitle: item.product?.title,
          quantity,
          reason: input.reason,
          description: input.description ?? '',
          refundAmount: Math.round(unitNet * quantity * ratio),
          status: 'PENDING',
        });
      });
      return { ok: true as const, created };
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, message: result.message }, { status: result.status });
    }

    return NextResponse.json(
      {
        success: true,
        returns: result.created.map(publicReturn),
        message: 'درخواست مرجوعی شما ثبت شد و پس از بررسی به آن پاسخ داده می‌شود.',
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    return apiErrorResponse(error, 'returns POST', 'خطا در ثبت درخواست مرجوعی');
  }
}
