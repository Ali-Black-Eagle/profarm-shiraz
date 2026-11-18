import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { farmStore, sanitizeUser } from '@/lib/db-store';
import { Order, OrderItem, Product } from '@/types';
import { requireUser } from '@/lib/user-auth';
import { isValidIranPhone, normalizeOrderNumberInput, normalizePhoneNumber } from '@/lib/formatters';
import { checkDistributedRateLimit } from '@/lib/sms';
import { requireAdmin } from '@/lib/admin-auth';
import { apiErrorResponse } from '@/lib/api-errors';
import { initOnlinePayment, OnlinePaymentMethod } from '@/lib/payment-init';
import { quoteCart } from '@/lib/pricing';
import { withOrderLock } from '@/lib/order-lock';

const PAYMENT_METHODS = ['zarinpal', 'snapppay', 'cod'];

/** Unconfirmed cash-on-delivery orders one account may have open at the same time. */
const MAX_OPEN_COD_ORDERS = 3;

/** Unconfirmed cash-on-delivery orders that may be open for one delivery phone number, across all accounts. */
const MAX_OPEN_COD_ORDERS_PER_PHONE = 3;

function sanitizeText(str?: string | null, maxLen = 200): string {
  if (!str) return '';
  return String(str).trim().slice(0, maxLen).replace(/<[^>]*>?/gm, '');
}

/** Product snapshot stored on an order item. Cost price is kept separately (costPriceAtSale), never exposed here. */
function publicProductSnapshot(product: Product): Product {
  const { costPrice: _cost, ...rest } = product;
  return rest as Product;
}

/**
 * Pagination for GET /api/orders. Only when ?page is present; without it the response keeps its original shape.
 * ?pageSize defaults to 20 (max 50). Orders are returned newest first, as stored.
 */
function paginatedOrdersResponse(list: Order[], searchParams: URLSearchParams): NextResponse | null {
  if (!searchParams.has('page')) return null;
  const pageSize = Math.min(50, Math.max(1, Math.floor(Number(searchParams.get('pageSize')) || 20)));
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(totalPages, Math.max(1, Math.floor(Number(searchParams.get('page')) || 1)));
  return NextResponse.json({
    success: true,
    orders: list.slice((page - 1) * pageSize, page * pageSize),
    pagination: { page, pageSize, total, totalPages },
  });
}

export async function GET(req: NextRequest) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const session = auth.session;

  const { searchParams } = new URL(req.url);
  const orderNumberParam = normalizeOrderNumberInput(searchParams.get('orderNumber')) || undefined;

  const allOrders = farmStore.getOrders();

  // Admin branch only when the stored account is still ADMIN (a token claim alone is not trusted)
  const adminAuth = session.role === 'ADMIN' ? requireAdmin(req) : null;
  if (adminAuth && !(adminAuth instanceof NextResponse)) {
    if (orderNumberParam) {
      const single = allOrders.find(
        (o) => o.orderNumber === orderNumberParam || o.id === orderNumberParam
      );
      return NextResponse.json({ success: true, order: single || null, orders: single ? [single] : [] });
    }
    return paginatedOrdersResponse(allOrders, searchParams) ?? NextResponse.json({ success: true, orders: allOrders });
  }

  // SECURITY: customers see only orders linked to their account id.
  // Phone numbers on addresses or user snapshots are never used for matching.
  const userOrders = allOrders.filter((o) => o.userId === session.userId);

  if (orderNumberParam) {
    const matchedOrder = userOrders.find(
      (o) => o.orderNumber === orderNumberParam || o.id === orderNumberParam
    );
    if (!matchedOrder) {
      return NextResponse.json(
        { success: false, message: 'سفارش مورد نظر یافت نشد یا متعلق به حساب کاربری شما نمی‌باشد.' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, order: matchedOrder, orders: [matchedOrder] });
  }

  return paginatedOrdersResponse(userOrders, searchParams) ?? NextResponse.json({ success: true, orders: userOrders });
}

export async function POST(req: NextRequest) {
  try {
    // SECURITY: Require valid authenticated session to create orders
    const auth = requireUser(req);
    if (auth instanceof NextResponse) return auth;
    const session = auth.session;

    // SECURITY: Rate limit order creations (Max 10 orders per 5 minutes per user)
    const rateKey = `order_create:${session.userId}`;
    const rateCheck = await checkDistributedRateLimit(rateKey, 10, 300);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: `تعداد درخواست‌های ثبت سفارش بیش از حد مجاز است. لطفاً ${rateCheck.retryAfterSeconds} ثانیه دیگر مجدداً تلاش نمایید.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, message: 'اطلاعات ارسالی نامعتبر است.' }, { status: 400 });
    }
    const {
      recipientName,
      phone,
      province,
      city,
      streetAddress,
      unit,
      postalCode,
      deliverySlot,
      isSubscription,
      subscriptionPlan,
      items,
      appliedCouponCode,
      paymentMethod = 'zarinpal',
    } = body;

    // The client's isShiraz / isBulkOrder / jalali fields are ignored: the server derives them.
    const isSub = isSubscription === true;
    const method = String(paymentMethod || 'zarinpal');
    if (!PAYMENT_METHODS.includes(method)) {
      return NextResponse.json({ success: false, message: 'روش پرداخت انتخابی نامعتبر است.' }, { status: 400 });
    }
    if (method === 'cod') {
      if (isSub) {
        return NextResponse.json(
          { success: false, message: 'اشتراک فقط به‌صورت پرداخت آنلاین قابل خرید است.' },
          { status: 400 }
        );
      }
      if (!farmStore.getPaymentSettings().general?.allowCashOnDelivery) {
        return NextResponse.json({ success: false, message: 'پرداخت در محل در حال حاضر فعال نیست.' }, { status: 400 });
      }
    }

    // Account is resolved strictly by the session id. The phone typed at checkout never links to an account.
    const user = farmStore.getAllUsers().find((u) => u.id === session.userId);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'حساب کاربری شما یافت نشد. لطفاً مجدداً وارد حساب شوید.' },
        { status: 401 }
      );
    }

    const slotId =
      typeof deliverySlot === 'string' ? deliverySlot : deliverySlot && typeof deliverySlot === 'object' ? deliverySlot.id : null;

    // Unpaid orders past their payment deadline give back stock, slot and coupon first (each under its order lock)
    await farmStore.releaseExpiredPendingOrdersLocked();

    // ONE pricing function: the quote decides the total that is charged.
    const quote = quoteCart({
      user,
      items: isSub ? [] : items,
      couponCode: typeof appliedCouponCode === 'string' ? appliedCouponCode : null,
      slotId: isSub ? null : slotId,
      city: isSub ? undefined : typeof city === 'string' ? city : '',
      province: typeof province === 'string' ? province : undefined,
      requireSlot: !isSub,
      isSubscription: isSub,
      subscriptionPlan,
    });

    if (!quote.ok) {
      if (quote.stockIssue) {
        return NextResponse.json(
          { success: false, errorCode: 'INSUFFICIENT_STOCK', message: quote.errors[0], errors: quote.errors },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { success: false, message: quote.errors[0], errors: quote.errors },
        { status: 400 }
      );
    }

    // Per-customer cap on unconfirmed COD orders. The sweep above already released the expired ones, and nothing
    // awaits between this check and createOrder, so two requests cannot both pass it.
    if (method === 'cod' && farmStore.countOpenCodOrders(user.id) >= MAX_OPEN_COD_ORDERS) {
      return NextResponse.json(
        {
          success: false,
          message: 'شما ۳ سفارش پرداخت در محل تأیید‌نشده دارید. لطفاً ابتدا سفارش‌های قبلی را پرداخت یا لغو کنید.',
        },
        { status: 409 }
      );
    }

    // Persian or Arabic digits are normalized first. A phone that was typed must be a valid Iranian mobile.
    const phoneInput = typeof phone === 'string' ? phone.trim() : '';
    if (phoneInput && !isValidIranPhone(phoneInput)) {
      return NextResponse.json(
        { success: false, message: 'شماره تلفن وارد شده معتبر نیست. نمونه صحیح: ۰۹۱۲۳۴۵۶۷۸۹' },
        { status: 400 }
      );
    }
    const cleanPhone = normalizePhoneNumber(phoneInput);

    // The same cap per delivery phone: several accounts cannot stack unconfirmed COD orders on one number.
    // Synchronous from here to createOrder, like the per-account check above.
    const deliveryPhone = normalizePhoneNumber(cleanPhone || user.phone || '');
    if (method === 'cod' && deliveryPhone && farmStore.countOpenCodOrdersByPhone(deliveryPhone) >= MAX_OPEN_COD_ORDERS_PER_PHONE) {
      return NextResponse.json(
        {
          success: false,
          message: 'برای این شماره تلفن ۳ سفارش پرداخت در محل تأیید‌نشده ثبت شده است. لطفاً ابتدا سفارش‌های قبلی را پرداخت یا لغو کنید.',
        },
        { status: 409 }
      );
    }

    const cityName = sanitizeText(city, 50) || 'شیراز';
    const addressId = `addr-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    const orderItems: OrderItem[] = quote.lines.map((line, idx) => ({
      id: `item-${Date.now()}-${idx}`,
      productId: line.productId,
      product: publicProductSnapshot(line.product),
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      totalPrice: line.lineTotal,
      discountAmount: line.discount,
      eggDiscountedCount: line.eggDiscountedCount,
      costPriceAtSale: line.costPrice,
    }));

    // Cryptographically secure, unpredictable order number
    const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const orderNumber = `PRF-1405-${Date.now().toString(36).toUpperCase()}-${randomSuffix}`;

    let newOrder: Order;
    try {
      newOrder = farmStore.createOrder({
        orderNumber,
        userId: user.id,
        user: sanitizeUser(user),
        addressId,
        address: {
          id: addressId,
          userId: user.id,
          recipientName: sanitizeText(recipientName, 100) || user.name || 'کاربر',
          phone: cleanPhone || user.phone || '',
          province: sanitizeText(province, 50) || 'فارس',
          city: isSub ? 'شیراز' : cityName,
          postalCode: sanitizeText(postalCode, 20) || '',
          streetAddress: sanitizeText(streetAddress, 300) || 'فعال‌سازی سرویس دیجیتال مشترک',
          unit: unit ? sanitizeText(unit, 20) : null,
          isShiraz: quote.isShiraz,
        },
        deliverySlotId: isSub ? null : quote.slot?.id ?? null,
        deliverySlot: isSub ? null : quote.slot,
        totalAmount: quote.total,
        status: 'PENDING_PAYMENT',
        isBulkOrder: !isSub && quote.isBulk,
        isSubscription: isSub,
        subscriptionPlan: isSub && quote.subscriptionPlan ? quote.subscriptionPlan : undefined,
        items: orderItems,
        subtotal: quote.subtotal,
        tierDiscountAmount: quote.tierDiscount,
        shippingFee: quote.shipping,
        couponCode: quote.couponCode,
        couponDiscountAmount: quote.couponDiscount,
        couponCounted: false,
        paymentMethod: method,
        isShiraz: quote.isShiraz,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('INSUFFICIENT_STOCK')) {
        return NextResponse.json(
          { success: false, errorCode: 'INSUFFICIENT_STOCK', message: message.replace('INSUFFICIENT_STOCK: ', '') },
          { status: 409 }
        );
      }
      throw err;
    }

    const amount = quote.total;

    // Cash on delivery: no online payment. The coupon counts now, because the order is final at creation.
    if (method === 'cod') {
      farmStore.attachPaymentToOrder(orderNumber, {
        id: `pay-${Date.now()}`,
        orderId: orderNumber,
        amount,
        gateway: 'COD',
        authority: null,
        status: 'INITIATED',
        createdAt: new Date().toISOString(),
      });
      farmStore.countOrderCoupon(orderNumber);
      return NextResponse.json({ success: true, order: newOrder, gateway: 'cod' });
    }

    // Online payment. If the gateway refuses the request, the order is cancelled at once so its stock is released.
    const failAndRelease = async (message: string) => {
      await withOrderLock(orderNumber, () => farmStore.updateOrderStatus(orderNumber, 'CANCELLED'));
      return NextResponse.json({ success: false, message }, { status: 400 });
    };

    const payment = await initOnlinePayment({
      orderNumber,
      amount,
      method: method as OnlinePaymentMethod,
      mobile: cleanPhone || user.phone || '',
    });
    if (!payment.success) {
      return failAndRelease(payment.message);
    }

    if (payment.gateway === 'snapppay') {
      return NextResponse.json({
        success: true,
        order: newOrder,
        paymentToken: payment.paymentToken,
        paymentUrl: payment.paymentUrl,
        plan: payment.plan,
        gateway: 'snapppay',
      });
    }

    return NextResponse.json({
      success: true,
      order: newOrder,
      authority: payment.authority,
      paymentUrl: payment.paymentUrl,
      gateway: 'zarinpal',
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'orders/post', 'خطای سرور در ایجاد سفارش');
  }
}
