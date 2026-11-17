import { NextResponse } from 'next/server';
import { farmStore } from '@/lib/db-store';
import { getSessionFromRequest } from '@/lib/session';
import { checkDistributedRateLimit } from '@/lib/sms';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const codeToValidate = searchParams.get('code');

    // If a code query is provided, validate it directly (allowed for customers)
    if (codeToValidate) {
      // SECURITY: Rate limit coupon validation to prevent brute-force attacks (15 attempts / 5 mins)
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'anon';
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
    const session = getSessionFromRequest(request);
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'دسترسی غیرمجاز: مشاهده لیست کدهای تخفیف منحصراً در اختیار ادمین است.' },
        { status: 403 }
      );
    }

    const coupons = farmStore.getCoupons();
    return NextResponse.json({ success: true, coupons });
  } catch (error) {
    console.error('Error fetching coupons:', error);
    return NextResponse.json({ success: false, message: 'خطا در دریافت لیست کدهای تخفیف' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Check if this is a validation request (allowed for customers)
    if (body.action === 'validate') {
      // SECURITY: Rate limit coupon validation to prevent brute-force attacks (15 attempts / 5 mins)
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'anon';
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
    const session = getSessionFromRequest(request);
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'دسترسی غیرمجاز: ایجاد کد تخفیف جدید تنها برای مدیر مجاز است.' },
        { status: 403 }
      );
    }

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
  } catch (error) {
    console.error('Error in coupons POST:', error);
    return NextResponse.json({ success: false, message: 'خطا در پردازش درخواست' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'دسترسی غیرمجاز: ویرایش کد تخفیف منحصراً در اختیار مدیر است.' },
        { status: 403 }
      );
    }

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
  } catch (error) {
    console.error('Error updating coupon:', error);
    return NextResponse.json({ success: false, message: 'خطا در ویرایش کد تخفیف' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'دسترسی غیرمجاز: حذف کد تخفیف منحصراً در اختیار مدیر است.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'شناسه کد تخفیف الزامی است.' }, { status: 400 });
    }

    const deleted = farmStore.deleteCoupon(id);
    return NextResponse.json({ success: deleted });
  } catch (error) {
    console.error('Error deleting coupon:', error);
    return NextResponse.json({ success: false, message: 'خطا در حذف کد تخفیف' }, { status: 500 });
  }
}
