import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { farmStore, sanitizeUser } from '@/lib/db-store';
import { requestPayment } from '@/lib/zarinpal';
import { requestSnappPayPayment } from '@/lib/snapppay';
import { Order, OrderItem, Product } from '@/types';
import { getSessionFromRequest } from '@/lib/session';
import { normalizePhoneNumber } from '@/lib/formatters';
import { checkDistributedRateLimit } from '@/lib/sms';
import { requireAdmin } from '@/lib/admin-auth';
import { apiErrorResponse } from '@/lib/api-errors';
import { isMockGatewayEnabled, createMockAuthority } from '@/lib/mock-gateway';
import { quoteCart } from '@/lib/pricing';

const PAYMENT_METHODS = ['zarinpal', 'snapppay', 'cod'];

function sanitizeText(str?: string | null, maxLen = 200): string {
  if (!str) return '';
  return String(str).trim().slice(0, maxLen).replace(/<[^>]*>?/gm, '');
}

/** Product snapshot stored on an order item. Cost price is kept separately (costPriceAtSale), never exposed here. */
function publicProductSnapshot(product: Product): Product {
  const { costPrice: _cost, ...rest } = product;
  return rest as Product;
}

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json(
      { success: false, message: 'لطفاً ابتدا وارد حساب کاربری شوید.' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const orderNumberParam = searchParams.get('orderNumber')?.trim();

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
    return NextResponse.json({ success: true, orders: allOrders });
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

  return NextResponse.json({ success: true, orders: userOrders });
}

export async function POST(req: NextRequest) {
  try {
    // SECURITY: Require valid authenticated session to create orders
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'جهت ثبت سفارش و پرداخت، لطفاً ابتدا وارد حساب کاربری خود شوید.' },
        { status: 401 }
      );
    }

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

    // ONE pricing function: the quote decides the total that is charged.
    const quote = quoteCart({
      user,
      items: isSub ? [] : items,
      couponCode: typeof appliedCouponCode === 'string' ? appliedCouponCode : null,
      slotId: isSub ? null : slotId,
      city: isSub ? undefined : typeof city === 'string' ? city : '',
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

    const cleanPhone = normalizePhoneNumber(typeof phone === 'string' ? phone : '');
    const cityName = sanitizeText(city, 50) || 'شیراز';
    const addressId = `addr-${Date.now()}`;

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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const callbackBase = `${appUrl}/api/payment/verify?orderNumber=${encodeURIComponent(orderNumber)}`;

    const failAndRelease = async (message: string) => {
      await farmStore.updateOrderStatus(orderNumber, 'CANCELLED');
      return NextResponse.json({ success: false, message }, { status: 400 });
    };

    if (method === 'snapppay') {
      const snappPayReq = await requestSnappPayPayment({
        amount,
        description: `خرید اقساطی ۴ ماهه اسنپ‌پی سفارش کد ${orderNumber}`,
        orderNumber,
        callbackUrl: `${callbackBase}&gateway=snapppay`,
        mobile: phone,
      });

      if (!snappPayReq.success || !snappPayReq.paymentUrl) {
        return failAndRelease(snappPayReq.message || 'خطا در برقراری ارتباط با درگاه پرداخت اقساطی اسنپ‌پی');
      }

      farmStore.attachPaymentToOrder(orderNumber, {
        id: `pay-${Date.now()}`,
        orderId: orderNumber,
        amount,
        gateway: 'snapppay',
        authority: snappPayReq.paymentToken || null,
        status: 'INITIATED',
        createdAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        order: newOrder,
        paymentToken: snappPayReq.paymentToken,
        paymentUrl: snappPayReq.paymentUrl,
        plan: snappPayReq.plan,
        gateway: 'snapppay',
      });
    }

    // DEV ONLY: mock gateway (lib/mock-gateway.ts). Never active outside NODE_ENV=development with PAYMENT_MOCK_GATEWAY=1.
    if (isMockGatewayEnabled()) {
      const mockAuthority = createMockAuthority(orderNumber, amount);
      farmStore.attachPaymentToOrder(orderNumber, {
        id: `pay-${Date.now()}`,
        orderId: orderNumber,
        amount,
        gateway: 'zarinpal',
        authority: mockAuthority,
        status: 'INITIATED',
        createdAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        order: newOrder,
        authority: mockAuthority,
        paymentUrl: `/checkout/mock-gateway?orderNumber=${encodeURIComponent(orderNumber)}&Authority=${encodeURIComponent(mockAuthority)}&amount=${amount}`,
        gateway: 'zarinpal',
      });
    }

    const paymentReq = await requestPayment({
      amount,
      description: `سفارش محصولات ارگانیک شیراز کد ${orderNumber}`,
      orderNumber,
      callbackUrl: `${callbackBase}&gateway=zarinpal`,
      mobile: phone,
    });

    if (!paymentReq.success || !paymentReq.paymentUrl) {
      return failAndRelease(paymentReq.message || 'خطا در برقراری ارتباط با درگاه پرداخت زرین‌پال');
    }

    farmStore.attachPaymentToOrder(orderNumber, {
      id: `pay-${Date.now()}`,
      orderId: orderNumber,
      amount,
      gateway: 'zarinpal',
      authority: paymentReq.authority || null,
      status: 'INITIATED',
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      order: newOrder,
      authority: paymentReq.authority,
      paymentUrl: paymentReq.paymentUrl,
      gateway: 'zarinpal',
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'orders/post', 'خطای سرور در ایجاد سفارش');
  }
}
