import { NextRequest, NextResponse } from 'next/server';
import { farmStore } from '@/lib/db-store';
import { requireAdmin } from '@/lib/admin-auth';
import { apiErrorResponse } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = farmStore.getSubscriptionSettings();
    const stats = farmStore.getSubscriptionStats();

    // Public plan summary for the membership page. Prices, quotas and percentages come from the admin settings;
    // member counts are aggregates only (no member names, phones or emails).
    const plans = {
      PLUS: {
        monthlyPrice: settings.plusMonthlyPrice,
        eggDiscountPercent: settings.plusEggDiscountPercent,
        eggQuota: settings.plusEggMaxQuota,
        deliveryDaysPerWeek: settings.plusDeliveryDaysPerWeek,
        maxCapacity: settings.plusMaxCapacity,
        remainingCapacity: stats.plusRemaining,
        isFull: stats.isPlusFull,
        features: settings.plusFeatures,
      },
      PRO: {
        monthlyPrice: settings.proMonthlyPrice,
        eggDiscountPercent: settings.proEggDiscountPercent,
        eggQuota: settings.proEggMaxQuota,
        otherDiscountPercent: settings.proOtherDiscountPercent,
        shippingDiscountPercent: settings.proShippingDiscountPercent,
        deliveryDaysPerWeek: settings.proDeliveryDaysPerWeek,
        maxCapacity: settings.proMaxCapacity,
        remainingCapacity: stats.proRemaining,
        isFull: stats.isProFull,
        features: settings.proFeatures,
      },
    };

    return NextResponse.json(
      {
        success: true,
        settings,
        stats,
        plans,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error: unknown) {
    return apiErrorResponse(error, 'subscriptions GET', 'خطا در دریافت تنظیمات اشتراک‌ها');
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json().catch(() => ({}));
    const newSettings = body.settings || body.payload?.settings || body;

    if (!newSettings || typeof newSettings !== 'object') {
      return NextResponse.json(
        { success: false, message: 'تنظیمات ارسال‌شده نامعتبر است.' },
        { status: 400 }
      );
    }

    const updated = farmStore.updateSubscriptionSettings(newSettings);
    const stats = farmStore.getSubscriptionStats();

    return NextResponse.json({
      success: true,
      settings: updated,
      stats,
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'subscriptions POST', 'خطای سرور در ذخیره تنظیمات اشتراک');
  }
}
