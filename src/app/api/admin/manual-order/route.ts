import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { farmStore } from '@/lib/db-store';
import { requireAdmin } from '@/lib/admin-auth';
import { apiErrorResponse } from '@/lib/api-errors';
import { intField, jsonError, jsonOk, parseWith, readObjectBody, textField } from '@/lib/admin-api';
import { safeAccount, serializeAdminOrder } from '@/lib/admin-orders';
import { isValidIranPhone, normalizePhoneNumber, toEnglishDigits } from '@/lib/formatters';
import { quoteCart } from '@/lib/pricing';
import type { Order, OrderItem, Product } from '@/types';

export const dynamic = 'force-dynamic';

const manualSchema = z.object({
  customer: z.object({
    name: textField(100, 'نام مشتری'),
    phone: textField(20, 'شماره موبایل مشتری'),
  }),
  address: z.object({
    city: textField(50, 'شهر'),
    province: z.string().trim().max(50).optional(),
    streetAddress: textField(300, 'نشانی'),
    postalCode: z.string().trim().max(20).optional(),
    unit: z.string().trim().max(20).optional(),
  }),
  items: z
    .array(
      z.object({
        productId: textField(200, 'شناسه کالا'),
        quantity: intField(1, 1000, 'تعداد'),
      })
    )
    .min(1, 'حداقل یک کالا لازم است')
    .max(100, 'تعداد اقلام بیش از حد مجاز است'),
  slotId: textField(100, 'سانس تحویل'),
  paymentMethod: z.enum(['cash', 'card-on-delivery', 'paid-offline'], {
    error: 'روش پرداخت نامعتبر است (cash، card-on-delivery یا paid-offline)',
  }),
  couponCode: z.string().trim().max(40).nullable().optional(),
});

/** Product snapshot stored on an order item. The cost price is kept separately (costPriceAtSale). */
function publicProductSnapshot(product: Product): Product {
  const { costPrice: _cost, ...rest } = product;
  return rest as Product;
}

/**
 * Creates an order entered by an admin (phone sale or counter sale). Pricing and stock go through quoteCart, the same
 * function the customer checkout uses, with the FREE tier unless the phone belongs to an existing account.
 * - paid-offline: recorded as paid, starts in PROCESSING.
 * - cash / card-on-delivery: a COD order in PENDING_PAYMENT, which the admin moves to PROCESSING on delivery.
 * No SMS is sent for manual orders.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await readObjectBody(req);
    const parsed = parseWith(manualSchema, body ?? {});
    if ('response' in parsed) return parsed.response;
    const data = parsed.data;

    const phone = normalizePhoneNumber(data.customer.phone);
    if (!isValidIranPhone(phone)) return jsonError(400, 'شماره موبایل مشتری معتبر نیست.');

    const postal = toEnglishDigits(data.address.postalCode || '').replace(/\s+/g, '');
    if (postal && !/^\d{10}$/.test(postal)) return jsonError(400, 'کد پستی باید ۱۰ رقم باشد.');

    const account = farmStore.getUserByPhone(phone) ?? null;
    const province = data.address.province?.trim() || 'فارس';

    await farmStore.releaseExpiredPendingOrdersLocked();

    const couponCode = typeof data.couponCode === 'string' && data.couponCode.trim() ? data.couponCode.trim() : null;
    const quote = quoteCart({
      user: account,
      items: data.items,
      couponCode,
      slotId: data.slotId,
      city: data.address.city,
      province,
      requireSlot: true,
    });
    if (!quote.ok) {
      return jsonError(quote.stockIssue ? 409 : 400, quote.errors[0] || 'اطلاعات سفارش نامعتبر است.', {
        errors: quote.errors,
        ...(quote.stockIssue ? { errorCode: 'INSUFFICIENT_STOCK' } : {}),
      });
    }

    const method = data.paymentMethod;
    const isPaidOffline = method === 'paid-offline';
    const addressId = `addr-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();

    const orderItems: OrderItem[] = quote.lines.map((line, idx) => ({
      id: `item-${Date.now()}-${idx}-${crypto.randomBytes(2).toString('hex')}`,
      productId: line.productId,
      product: publicProductSnapshot(line.product),
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      totalPrice: line.lineTotal,
      discountAmount: line.discount,
      eggDiscountedCount: line.eggDiscountedCount,
      costPriceAtSale: line.costPrice,
    }));

    const orderNumber = `PRF-1405-${Date.now().toString(36).toUpperCase()}-${crypto
      .randomBytes(3)
      .toString('hex')
      .toUpperCase()}`;

    const payment = isPaidOffline
      ? {
          id: `pay-${Date.now()}`,
          orderId: orderNumber,
          amount: quote.total,
          gateway: 'manual',
          authority: null,
          refId: null,
          status: 'SUCCESS' as const,
          createdAt: now,
        }
      : {
          id: `pay-${Date.now()}`,
          orderId: orderNumber,
          amount: quote.total,
          gateway: 'COD',
          authority: null,
          status: 'INITIATED' as const,
          createdAt: now,
        };

    let order: Order;
    try {
      order = farmStore.createOrder({
        orderNumber,
        userId: account?.id ?? '',
        user: account ? safeAccount(account.id) ?? undefined : undefined,
        addressId,
        address: {
          id: addressId,
          userId: account?.id ?? '',
          recipientName: data.customer.name,
          phone,
          province,
          city: data.address.city,
          postalCode: postal,
          streetAddress: data.address.streetAddress,
          unit: data.address.unit ? data.address.unit : null,
          isShiraz: quote.isShiraz,
        },
        deliverySlotId: quote.slot?.id ?? null,
        deliverySlot: quote.slot,
        totalAmount: quote.total,
        status: isPaidOffline ? 'PROCESSING' : 'PENDING_PAYMENT',
        isBulkOrder: quote.isBulk,
        isSubscription: false,
        items: orderItems,
        subtotal: quote.subtotal,
        tierDiscountAmount: quote.tierDiscount,
        shippingFee: quote.shipping,
        couponCode: quote.couponCode,
        couponDiscountAmount: quote.couponDiscount,
        couponCounted: false,
        payment,
        paymentMethod: isPaidOffline ? 'manual' : 'cod',
        isShiraz: quote.isShiraz,
        source: 'ADMIN_MANUAL',
        manualPaymentMethod: method,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('INSUFFICIENT_STOCK')) {
        return jsonError(409, message.replace('INSUFFICIENT_STOCK: ', ''), { errorCode: 'INSUFFICIENT_STOCK' });
      }
      throw err;
    }

    // Manual orders are final at creation, so their coupon use counts now (released again if cancelled).
    if (quote.couponCode) farmStore.countOrderCoupon(orderNumber);

    return jsonOk({ order: serializeAdminOrder(farmStore.getOrderById(orderNumber) ?? order) }, 201);
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/manual-order POST', 'خطا در ثبت سفارش دستی');
  }
}
