import { NextRequest, NextResponse } from 'next/server';
import { farmStore } from '@/lib/db-store';
import { getSessionFromRequest } from '@/lib/session';

function maskSecret(str?: string | null): string {
  if (!str) return '';
  if (str.length <= 6) return '••••••••';
  return str.slice(0, 3) + '••••••••' + str.slice(-3);
}

function getMaskedSettings(settings: ReturnType<typeof farmStore.getSmsSettings>) {
  return {
    ...settings,
    apiKey: maskSecret(settings.apiKey),
    hasApiKey: Boolean(settings.apiKey && settings.apiKey.trim().length > 0),
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'دسترسی غیرمجاز به تنظیمات وب‌سرویس پیامک' },
        { status: 403 }
      );
    }

    const settings = farmStore.getSmsSettings();
    return NextResponse.json({
      success: true,
      settings: getMaskedSettings(settings),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'خطا در بارگذاری تنظیمات وب‌سرویس پیامک' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'دسترسی غیرمجاز به تنظیمات وب‌سرویس پیامک' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const current = farmStore.getSmsSettings();

    // Whitelist allowed fields
    const allowedProviders = ['KAVENEGAR', 'MELIPAYAMAK', 'FARAZ_SMS', 'CUSTOM', 'MOCK'];
    const provider = allowedProviders.includes(body.provider) ? body.provider : current.provider;

    // Preserve real secret if client sent masked string
    let apiKey = current.apiKey;
    if (typeof body.apiKey === 'string' && body.apiKey.trim().length > 0) {
      if (!body.apiKey.includes('••')) {
        apiKey = body.apiKey.trim();
      }
    }

    const updated = farmStore.updateSmsSettings({
      provider,
      apiKey,
      senderNumber: typeof body.senderNumber === 'string' ? body.senderNumber.trim().slice(0, 30) : current.senderNumber,
      patternCode: typeof body.patternCode === 'string' ? body.patternCode.trim().slice(0, 60) : current.patternCode,
      apiUrl: typeof body.apiUrl === 'string' ? body.apiUrl.trim().slice(0, 200) : current.apiUrl,
      isEnabled: body.isEnabled !== undefined ? Boolean(body.isEnabled) : current.isEnabled,
      testPhone: typeof body.testPhone === 'string' ? body.testPhone.trim().slice(0, 15) : current.testPhone,
    });

    return NextResponse.json({
      success: true,
      message: 'تنظیمات اتصال به وب‌سرویس پیامک با موفقیت ذخیره شد.',
      settings: getMaskedSettings(updated),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'خطا در ذخیره تنظیمات وب‌سرویس پیامک' },
      { status: 500 }
    );
  }
}

