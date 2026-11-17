import { NextResponse } from 'next/server';
import { farmStore } from '@/lib/db-store';
import { requireAdmin } from '@/lib/admin-auth';
import { checkDistributedRateLimit } from '@/lib/sms';
import { getSecureClientIp } from '@/lib/formatters';
import { apiErrorResponse } from '@/lib/api-errors';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const codeToValidate = searchParams.get('code');

    // If a code query is provided, validate it directly (allowed for customers)
    if (codeToValidate) {
      // SECURITY: Rate limit coupon validation to prevent brute-force attacks (15 attempts / 5 mins)
      // The IP comes from edge/proxy headers that clients cannot spoof (see getSecureClientIp).
      const ip = getSecureClientIp(request);
      const rateCheck = await checkDistributedRateLimit(`coupon_check:${ip}`, 15, 300);
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
      return NextResponse.json(result);
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

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Check if this is a validation request (allowed for customers)
    if (body.action === 'validate') {
      // SECURITY: Rate limit coupon validation to prevent brute-force attacks (15 attempts / 5 mins)
      const ip = getSecureClientIp(request);
      const rateCheck = await checkDistributedRateLimit(`coupon_check:${ip}`, 15, 300);
      if (!rateCheck.allowed) {
        return NextResponse.json(
          {
            success: false,
            message: `تعداد تلاش‌های بررسی کد تخفیف بیش از حد مجاز است. لطفاً ${rateCheck.retryAfterSeconds} ثانیه دیگر مجدداً تلاش نمایید.`,
          },
          { status: 429 }
        );
      }

      const { code, cartItems = [], shippingFee = 0, itemsSubtotal = 0 } = body;
      const result = farmStore.validateAndApplyCoupon(code, cartItems, shippingFee, itemsSubtotal);
      return NextResponse.json(result);
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
