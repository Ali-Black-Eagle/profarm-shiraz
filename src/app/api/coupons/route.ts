import { NextResponse } from 'next/server';
import { farmStore } from '@/lib/db-store';
import { requireAdmin } from '@/lib/admin-auth';
import { checkDistributedRateLimit } from '@/lib/sms';
import { getSecureClientIp } from '@/lib/formatters';
import { apiErrorResponse } from '@/lib/api-errors';
import { getOptionalUser } from '@/lib/user-auth';
import { quoteCart } from '@/lib/pricing';
import { publicCoupon, publicQuote } from '@/lib/public-api';

/**
 * Coupon-code guessing limit. Known IP: 15 checks per 5 minutes per IP. Unknown IP (no trusted proxy
 * header): the per-IP bucket is skipped and a global cap applies instead, so one client cannot exhaust
 * a shared 'unknown' bucket for everyone.
 */
async function couponCheckLimit(ip: string) {
  if (ip !== 'unknown') return checkDistributedRateLimit(`coupon_check:${ip}`, 15, 300);
  return checkDistributedRateLimit('coupon_check_global', 300, 300);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const codeToValidate = searchParams.get('code');

    // If a code query is provided, validate it directly (allowed for customers)
    if (codeToValidate) {
      // SECURITY: Rate limit coupon validation to prevent brute-force attacks (15 attempts / 5 mins)
      // The IP comes from edge/proxy headers that clients cannot spoof (see getSecureClientIp).
      const ip = getSecureClientIp(request);
      const rateCheck = await couponCheckLimit(ip);
      if (!rateCheck.allowed) {
        return NextResponse.json(
          {
            success: false,
            message: `تعداد تلاش‌های بررسی کد تخفیف بیش از حد مجاز است. لطفاً ${rateCheck.retryAfterSeconds} ثانیه دیگر مجدداً تلاش نمایید.`,
          },
          { status: 429 }
        );
      }

      const subtotal = Number(searchParams.get('subtotal')) || 0;
      const shipping = Number(searchParams.get('shipping')) || 0;
      const itemsParam = searchParams.get('items');
      let cartItems = [];
      try {
        if (itemsParam) cartItems = JSON.parse(itemsParam);
      } catch (e) {
        // ignore parse error
      }

      const result = farmStore.validateAndApplyCoupon(codeToValidate, cartItems, shipping, subtotal);
      // success reports whether the code applies (same as isValid); clients may check either.
      return NextResponse.json({ ...result, success: result.isValid === true });
    }

    // Listing all coupons requires ADMIN privileges
    const auth = requireAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const coupons = farmStore.getCoupons();
    return NextResponse.json({ success: true, coupons });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'coupons GET', 'خطا در دریافت لیست کدهای تخفیف');
  }
}

/** Legacy cart shape ({ product: { id | slug }, quantity }) mapped to { productId, quantity }. */
function legacyCartItems(cartItems: unknown): { productId: string; quantity: number }[] {
  if (!Array.isArray(cartItems)) return [];
  return cartItems.map((ci: any) => ({
    productId: String(ci?.productId ?? ci?.product?.slug ?? ci?.product?.id ?? ''),
    quantity: Number(ci?.quantity),
  }));
}

/** Prices the cart with the session account (guests as FREE) and reports whether the coupon applies. */
function validateCouponForCart(request: Request, body: any) {
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const items = Array.isArray(body.items) ? body.items : legacyCartItems(body.cartItems);
  const user = getOptionalUser(request)?.user ?? null;
  const address = body.address && typeof body.address === 'object' ? body.address : {};
  const city = typeof address.city === 'string' ? address.city : typeof body.city === 'string' ? body.city : undefined;
  const province =
    typeof address.province === 'string' ? address.province : typeof body.province === 'string' ? body.province : undefined;
  const slotId = typeof body.slotId === 'string' ? body.slotId : null;

  if (!code) {
    return { success: false, isValid: false, valid: false, message: 'لطفاً کد تخفیف را وارد نمایید.', discountAmount: 0 };
  }

  const quote = quoteCart({ user, items, couponCode: code, slotId, city, province, requireSlot: false });
  const coupon = quote.couponCode ? farmStore.getCouponByCode(quote.couponCode) : undefined;
  const valid = Boolean(coupon) && quote.lines.length > 0;
  const message = valid
    ? quote.couponMessage ?? ''
    : quote.couponError ?? (quote.lines.length === 0 ? 'سبد خرید خالی است.' : 'کد تخفیف وارد شده معتبر نمی‌باشد.');

  // success: false when the code does not apply (expired, used up, wrong product or cart), with the reason in message.
  return {
    success: valid,
    isValid: valid,
    valid,
    message,
    discountAmount: valid ? quote.couponDiscount : 0,
    targetType: coupon?.targetType,
    coupon: valid && coupon ? publicCoupon(coupon) : undefined,
    quote: publicQuote(quote),
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validation (customers, also guests): priced through quoteCart, the same function that charges the order.
    // Body: { code, items: [{productId, quantity}], slotId?, address?: {city, province} }.
    // The legacy body { action: 'validate', code, cartItems, shippingFee, itemsSubtotal } is still accepted.
    if (body.action === 'validate' || Array.isArray(body.items)) {
      // SECURITY: Rate limit coupon validation to prevent brute-force attacks (15 attempts / 5 mins)
      const ip = getSecureClientIp(request);
      const rateCheck = await couponCheckLimit(ip);
      if (!rateCheck.allowed) {
        return NextResponse.json(
          {
            success: false,
            message: `تعداد تلاش‌های بررسی کد تخفیف بیش از حد مجاز است. لطفاً ${rateCheck.retryAfterSeconds} ثانیه دیگر مجدداً تلاش نمایید.`,
          },
          { status: 429 }
        );
      }

      return NextResponse.json(validateCouponForCart(request, body));
    }

    // Otherwise it's coupon creation -> requires ADMIN
    const auth = requireAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const {
      code,
      title,
      description,
      targetType,
      targetProductId,
      targetProductName,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscountAmount,
      usageLimit,
      isActive = true,
      expiresAt,
    } = body;

    if (!code || !title || !targetType || !discountType || discountValue === undefined) {
      return NextResponse.json(
        { success: false, message: 'لطفاً تمامی فیلدهای الزامی کد تخفیف را تکمیل نمایید.' },
        { status: 400 }
      );
    }

    // Check if code already exists
    const existing = farmStore.getCouponByCode(code);
    if (existing) {
      return NextResponse.json(
        { success: false, message: 'این کد تخفیف قبلاً تعریف شده است. لطفاً کد دیگری انتخاب کنید.' },
        { status: 409 }
      );
    }

    const created = farmStore.createCoupon({
      code,
      title,
      description,
      targetType,
      targetProductId,
      targetProductName,
      discountType,
      discountValue: Number(discountValue),
      minOrderAmount: minOrderAmount ? Number(minOrderAmount) : undefined,
      maxDiscountAmount: maxDiscountAmount ? Number(maxDiscountAmount) : undefined,
      usageLimit: usageLimit ? Number(usageLimit) : undefined,
      isActive: Boolean(isActive),
      expiresAt: expiresAt || null,
    });

    return NextResponse.json({ success: true, coupon: created });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'coupons POST', 'خطا در پردازش درخواست');
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = requireAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { id, action, ...updates } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: 'شناسه کد تخفیف الزامی است.' }, { status: 400 });
    }

    if (action === 'toggle') {
      const toggled = farmStore.toggleCouponActive(id);
      if (!toggled) {
        return NextResponse.json({ success: false, message: 'کد تخفیف مورد نظر یافت نشد.' }, { status: 404 });
      }
      return NextResponse.json({ success: true, coupon: toggled });
    }

    const updated = farmStore.updateCoupon(id, updates);
    if (!updated) {
      return NextResponse.json({ success: false, message: 'کد تخفیف مورد نظر یافت نشد.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, coupon: updated });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'coupons PATCH', 'خطا در ویرایش کد تخفیف');
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = requireAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'شناسه کد تخفیف الزامی است.' }, { status: 400 });
    }

    const deleted = farmStore.deleteCoupon(id);
    return NextResponse.json({ success: deleted });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'coupons DELETE', 'خطا در حذف کد تخفیف');
  }
}
