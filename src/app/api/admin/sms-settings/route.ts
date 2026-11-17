import { NextRequest, NextResponse } from 'next/server';
import { farmStore } from '@/lib/db-store';
import { requireAdmin } from '@/lib/admin-auth';
import { apiErrorResponse } from '@/lib/api-errors';

const MASK = '••••••••';

// Provider hosts that lib/sms.ts actually talks to. A custom apiUrl may only point at these, over https.
const ALLOWED_SMS_API_HOSTS = new Set(['api.kavenegar.com', 'ippanel.com']);

function isAllowedSmsApiUrl(value: string): boolean {
  if (!value) return true; // empty = not configured
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      ALLOWED_SMS_API_HOSTS.has(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

function getMaskedSettings(settings: ReturnType<typeof farmStore.getSmsSettings>) {
  return {
    ...settings,
    apiKey: settings.apiKey ? MASK : '',
    hasApiKey: Boolean(settings.apiKey && settings.apiKey.trim().length > 0),
  };
}

export async function GET(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const settings = farmStore.getSmsSettings();
    return NextResponse.json({
      success: true,
      settings: getMaskedSettings(settings),
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/sms-settings GET', 'خطا در بارگذاری تنظیمات وب‌سرویس پیامک');
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json().catch(() => ({}));
    const current = farmStore.getSmsSettings();

    // Whitelist allowed fields
    const allowedProviders = ['KAVENEGAR', 'MELIPAYAMAK', 'FARAZ_SMS', 'CUSTOM', 'MOCK'];
    const provider = allowedProviders.includes(body.provider) ? body.provider : current.provider;

    // A masked or empty key keeps the stored secret
    let apiKey = current.apiKey;
    if (typeof body.apiKey === 'string' && body.apiKey.trim().length > 0 && !body.apiKey.includes('••')) {
      apiKey = body.apiKey.trim();
    }

    const requestedApiUrl = typeof body.apiUrl === 'string' ? body.apiUrl.trim().slice(0, 200) : current.apiUrl || '';
    if (!isAllowedSmsApiUrl(requestedApiUrl)) {
      return NextResponse.json(
        {
          success: false,
          message: 'نشانی وب‌سرویس پیامک باید یک آدرس https معتبر از سرویس‌دهنده‌های مجاز باشد.',
        },
        { status: 400 }
      );
    }

    const updated = farmStore.updateSmsSettings({
      provider,
      apiKey,
      senderNumber: typeof body.senderNumber === 'string' ? body.senderNumber.trim().slice(0, 30) : current.senderNumber,
      patternCode: typeof body.patternCode === 'string' ? body.patternCode.trim().slice(0, 60) : current.patternCode,
      apiUrl: requestedApiUrl,
      isEnabled: body.isEnabled !== undefined ? Boolean(body.isEnabled) : current.isEnabled,
      testPhone: typeof body.testPhone === 'string' ? body.testPhone.trim().slice(0, 15) : current.testPhone,
    });

    return NextResponse.json({
      success: true,
      message: 'تنظیمات اتصال به وب‌سرویس پیامک با موفقیت ذخیره شد.',
      settings: getMaskedSettings(updated),
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/sms-settings POST', 'خطا در ذخیره تنظیمات وب‌سرویس پیامک');
  }
}
