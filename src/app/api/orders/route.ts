import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { farmStore, sanitizeUser } from '@/lib/db-store';
import { requestPayment } from '@/lib/zarinpal';
import { requestSnappPayPayment } from '@/lib/snapppay';
import { Order, OrderItem } from '@/types';
import { getSessionFromRequest } from '@/lib/session';
import { normalizePhoneNumber, calculateCartDiscounts } from '@/lib/formatters';
import { checkDistributedRateLimit } from '@/lib/sms';
import { isDayAllowedForUser } from '@/lib/jalali';
import { requireAdmin } from '@/lib/admin-auth';
import { apiErrorResponse } from '@/lib/api-errors';
import { isMockGatewayEnabled, createMockAuthority } from '@/lib/mock-gateway';

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

    const body = await req.json();
    const {
      recipientName,
      phone,
      province,
      city,
      streetAddress,
      unit,
      postalCode,
      isShiraz,
      deliverySlot,
      isBulkOrder,
      isSubscription,
      subscriptionPlan,
      items,
      appliedCouponCode,
      paymentMethod = 'zarinpal',
    } = body;

    const isCityShiraz =
      city?.trim() === 'شیراز' || city?.trim() === 'شهر شیراز' || isShiraz === true;

    // 1. Geographic validation (only required for physical goods, not subscriptions)
    if (!isSubscription) {
      const totalItems = items?.reduce((sum: number, i: any) => sum + (Number(i.quantity) || 0), 0) || 0;
      if (!isCityShiraz && !(isBulkOrder && totalItems >= 10)) {
        return NextResponse.json(
          {
            success: false,
            message:
              'خرده‌فروشی صرفاً مختص شهر شیراز است. سفارش‌های خارج از شیراز باید به صورت عمده (حداقل ۱۰ بسته) ثبت شوند.',
          },
          { status: 400 }
        );
      }
    }

    // 2. Resolve the account strictly by the id in the session.
    // SECURITY: the phone typed at checkout never links or attaches to an account.
    const cleanPhone = normalizePhoneNumber(typeof phone === 'string' ? phone : '');
    const user = farmStore.getAllUsers().find((u) => u.id === session.userId);

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'حساب کاربری شما یافت نشد. لطفاً مجدداً وارد شوید.' },
        { status: 401 }
      );
    }

    const subSettings = farmStore.getSubscriptionSettings();

    // 3. SERVER-SIDE PRICE & ITEM CALCULATION (Never trust client totalAmount)
    let fullItems: OrderItem[] = [];
    let itemsSubtotal = 0;
    let finalTotalAmount = 0;

    function sanitizeText(str?: string | null, maxLen = 200): string {
      if (!str) return '';
      return String(str).trim().slice(0, maxLen).replace(/<[^>]*>?/gm, '');
    }

    if (isSubscription) {
      const planPrice =
        subscriptionPlan === 'PLUS'
          ? subSettings.plusMonthlyPrice
          : subSettings.proMonthlyPrice;

      finalTotalAmount = planPrice;
      fullItems = [
        {
          id: `item-sub-${Date.now()}`,
          productId: `sub-${(subscriptionPlan || 'pro').toLowerCase()}`,
          product: {
            id: `sub-${(subscriptionPlan || 'pro').toLowerCase()}`,
            slug: `sub-${(subscriptionPlan || 'pro').toLowerCase()}`,
            title:
              subscriptionPlan === 'PLUS'
                ? 'اشتراک نقره‌ای پروفارم پلاس (۱ ماهه)'
                : 'اشتراک طلایی پروفارم پرو (۱ ماهه)',
            category: 'اشتراک',
            price: planPrice,
            images: ['/images/hero-shiraz-farm.jpg'],
            stock: 9999,
            isAvailable: true,
            description: 'ارسال ۶ روز در هفته و تخفیف‌های ویژه مزارع فارس',
          } as any,
          quantity: 1,
          unitPrice: planPrice,
          totalPrice: planPrice,
        },
      ];
    } else {
      if (!items || !Array.isArray(items) || items.length === 0) {
        return NextResponse.json(
          { success: false, message: 'سبد خرید نمی‌تواند خالی باشد.' },
          { status: 400 }
        );
      }

      if (items.length > 100) {
        return NextResponse.json(
          { success: false, message: 'تعداد اقلام سفارش بیش از حد مجاز است.' },
          { status: 400 }
        );
      }

      for (let idx = 0; idx < items.length; idx++) {
        const i = items[idx];
        if (!i || typeof i !== 'object' || !i.productId || typeof i.productId !== 'string') {
          return NextResponse.json(
            { success: false, message: 'اطلاعات کالا در سبد خرید نامعتبر است.' },
            { status: 400 }
          );
        }

        const prod = farmStore.getProductBySlug(i.productId);

        if (!prod) {
          return NextResponse.json(
            { success: false, message: `محصول «${i.productId}» در فروشگاه یافت نشد.` },
            { status: 400 }
          );
        }

        const rawQty = Number(i.quantity);
        if (!Number.isSafeInteger(rawQty) || rawQty < 1 || rawQty > 1000) {
          return NextResponse.json(
            { success: false, message: `تعداد انتخابی برای محصول «${prod.title}» نامعتبر است (باید بین ۱ تا ۱۰۰۰ باشد).` },
            { status: 400 }
          );
        }
        const qty = rawQty;
        const serverUnitPrice = prod.price;
        const itemTotal = serverUnitPrice * qty;
        itemsSubtotal += itemTotal;

        fullItems.push({
          id: `item-${Date.now()}-${idx}`,
          productId: prod.slug,
          product: prod,
          quantity: qty,
          unitPrice: serverUnitPrice,
          totalPrice: itemTotal,
        });
      }

      // Validate delivery slot against user's subscription tier and remaining capacity
      const userTier = user.tier || (user.isProMember ? 'PRO' : 'FREE');
      if (deliverySlot) {
        const slotDayIndex = deliverySlot.jalali?.dayOfWeekIndex;
        if (slotDayIndex !== undefined && !isDayAllowedForUser(Number(slotDayIndex), userTier)) {
          return NextResponse.json(
            {
              success: false,
              message:
                userTier === 'PRO'
                  ? 'روز تحویل انتخابی مجاز نمی‌باشد.'
                  : 'روز تحویل انتخابی با سطح اشتراک شما مطابقت ندارد. اعضای عادی فقط روزهای یکشنبه و چهارشنبه مجاز به دریافت سفارش هستند.',
            },
            { status: 400 }
          );
        }

        if (deliverySlot.id) {
          const capCheck = farmStore.checkSlotCapacity(deliverySlot.id);
          if (!capCheck.isAvailable || capCheck.remainingCapacity <= 0) {
            return NextResponse.json(
              {
                success: false,
                message: 'متاسفانه ظرفیت سانس تحویل انتخابی در شیراز تکمیل شده است. لطفاً سانس یا تاریخ دیگری را انتخاب فرمایید.',
              },
              { status: 400 }
            );
          }
        }
      }

      // Compute server-side subscription discounts on items (eggs & other goods) & shipping fee
      const cartItemsForCalc = fullItems.map((fi) => ({
        product: fi.product,
        quantity: fi.quantity,
      }));
      // Fetch user's rolling 30-day egg quota usage (including active pending orders to prevent race conditions)
      const usedEggQuota = farmStore.getUserRolling30DaysEggDiscountUsed(user.id, user.phone || cleanPhone);
      const subDiscounts = calculateCartDiscounts(cartItemsForCalc, userTier, subSettings, usedEggQuota);

      const subItemDiscount = subDiscounts.eggDiscount + subDiscounts.otherDiscount;
      const shippingFee = isCityShiraz ? subDiscounts.finalShipping : 0;

      // Validate discount coupon strictly on server
      let couponDiscountAmount = 0;
      if (appliedCouponCode) {
        const couponVal = farmStore.validateAndApplyCoupon(
          appliedCouponCode,
          cartItemsForCalc as any,
          shippingFee,
          Math.max(0, itemsSubtotal - subItemDiscount)
        );
        if (couponVal.isValid) {
          couponDiscountAmount = couponVal.discountAmount;
          farmStore.incrementCouponUsage(appliedCouponCode);
        }
      }

      finalTotalAmount = Math.max(0, itemsSubtotal + shippingFee - subItemDiscount - couponDiscountAmount);
    }

    // 4. ATOMIC ORDER CREATION (Fails with 409 if any item has insufficient stock)
    // Cryptographically secure, unpredictable order number (Fix for H-5 & L-2)
    const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const orderNumber = `PRF-1405-${Date.now().toString(36).toUpperCase()}-${randomSuffix}`;

    let newOrder: Order;
    try {
      newOrder = farmStore.createOrder({
        orderNumber,
        userId: user.id,
        user: sanitizeUser(user),
        addressId: `addr-${Date.now()}`,
        address: {
          id: `addr-${Date.now()}`,
          userId: user.id,
          recipientName: sanitizeText(recipientName, 100) || user.name || 'کاربر',
          phone: cleanPhone || user.phone || '',
          province: sanitizeText(province, 50) || 'فارس',
          city: sanitizeText(city, 50) || 'شیراز',
          postalCode: sanitizeText(postalCode, 20) || '',
          streetAddress: sanitizeText(streetAddress, 300) || 'فعال‌سازی سرویس دیجیتال مشترک',
          unit: unit ? sanitizeText(unit, 20) : null,
          isShiraz: isCityShiraz,
        },
        deliverySlotId: isSubscription ? null : deliverySlot?.id || null,
        deliverySlot: isSubscription ? null : deliverySlot || null,
        totalAmount: finalTotalAmount,
        status: 'PENDING_PAYMENT',
        isBulkOrder: !!isBulkOrder,
        isSubscription: !!isSubscription,
        subscriptionPlan: isSubscription ? subscriptionPlan : undefined,
        items: fullItems,
      });
    } catch (err: any) {
      if (err.message && err.message.includes('INSUFFICIENT_STOCK')) {
        return NextResponse.json(
          {
            success: false,
            errorCode: 'INSUFFICIENT_STOCK',
            message: err.message.replace('INSUFFICIENT_STOCK: ', ''),
          },
          { status: 409 }
        );
      }
      throw err;
    }

    // 5. Request Payment with Server-Calculated Amount
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const callbackBase = `${appUrl}/api/payment/verify?orderNumber=${encodeURIComponent(orderNumber)}`;

    if (paymentMethod === 'snapppay') {
      const snappPayReq = await requestSnappPayPayment({
        amount: finalTotalAmount,
        description: `خرید اقساطی ۴ ماهه اسنپ‌پی سفارش کد ${orderNumber}`,
        orderNumber,
        callbackUrl: `${callbackBase}&gateway=snapppay`,
        mobile: phone,
      });

      if (!snappPayReq.success || !snappPayReq.paymentUrl) {
        return NextResponse.json(
          {
            success: false,
            message: snappPayReq.message || 'خطا در برقراری ارتباط با درگاه پرداخت اقساطی اسنپ‌پی',
          },
          { status: 400 }
        );
      }

      // Record payment token for secure verification (prevents H-5 attack)
      farmStore.attachPaymentToOrder(orderNumber, {
        id: `pay-${Date.now()}`,
        orderId: orderNumber,
        amount: finalTotalAmount,
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
      const mockAuthority = createMockAuthority(orderNumber, finalTotalAmount);
      farmStore.attachPaymentToOrder(orderNumber, {
        id: `pay-${Date.now()}`,
        orderId: orderNumber,
        amount: finalTotalAmount,
        gateway: 'zarinpal',
        authority: mockAuthority,
        status: 'INITIATED',
        createdAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        order: newOrder,
        authority: mockAuthority,
        paymentUrl: `/checkout/mock-gateway?orderNumber=${encodeURIComponent(orderNumber)}&Authority=${encodeURIComponent(mockAuthority)}&amount=${finalTotalAmount}`,
        gateway: 'zarinpal',
      });
    }

    const paymentReq = await requestPayment({
      amount: finalTotalAmount,
      description: `سفارش محصولات ارگانیک شیراز کد ${orderNumber}`,
      orderNumber,
      callbackUrl: `${callbackBase}&gateway=zarinpal`,
      mobile: phone,
    });

    if (!paymentReq.success || !paymentReq.paymentUrl) {
      return NextResponse.json(
        {
          success: false,
          message: paymentReq.message || 'خطا در برقراری ارتباط با درگاه پرداخت زرین‌پال',
        },
        { status: 400 }
      );
    }

    // Record ZarinPal payment authority for secure verification (prevents H-5 attack)
    farmStore.attachPaymentToOrder(orderNumber, {
      id: `pay-${Date.now()}`,
      orderId: orderNumber,
      amount: finalTotalAmount,
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
