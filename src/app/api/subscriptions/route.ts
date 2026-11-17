import { NextRequest, NextResponse } from 'next/server';
import { farmStore } from '@/lib/db-store';
import { getSessionFromRequest } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Ensure latest state is loaded from server database
    farmStore.loadServerState();
    const settings = farmStore.getSubscriptionSettings();
    const stats = farmStore.getSubscriptionStats();

    return NextResponse.json(
      {
        success: true,
        settings,
        stats,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'خطا در دریافت تنظیمات اشتراک‌ها',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'دسترسی غیرمجاز: تغییر تنظیمات اشتراک فقط برای مدیر مجاز است.' },
        { status: 403 }
      );
    }

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
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'خطای سرور در ذخیره تنظیمات اشتراک',
      },
      { status: 500 }
    );
  }
}
