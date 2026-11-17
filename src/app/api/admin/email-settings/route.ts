import { NextRequest, NextResponse } from 'next/server';
import { farmStore } from '@/lib/db-store';
import { requireAdmin } from '@/lib/admin-auth';
import { apiErrorResponse } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';

const MASK = '••••••••';

/** SMTP password is never returned. Only a fixed mask and a flag saying whether one is stored. */
function getMaskedSettings(settings: ReturnType<typeof farmStore.getEmailSettings>) {
  return {
    ...settings,
    smtpPass: settings.smtpPass ? MASK : '',
    hasSmtpPass: Boolean(settings.smtpPass && settings.smtpPass.trim().length > 0),
  };
}

export async function GET(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const settings = farmStore.getEmailSettings();
    return NextResponse.json({
      success: true,
      settings: getMaskedSettings(settings),
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/email-settings GET', 'خطا در بارگذاری تنظیمات ایمیل');
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json().catch(() => ({}));
    const current = farmStore.getEmailSettings();

    // A masked or empty password keeps the stored one
    let smtpPass = current.smtpPass;
    if (typeof body.smtpPass === 'string') {
      const trimmed = body.smtpPass.trim();
      if (trimmed.length > 0 && !trimmed.includes('••')) {
        smtpPass = trimmed;
      }
    }

    const parsedPort = body.smtpPort ? parseInt(String(body.smtpPort), 10) : NaN;
    const smtpPort = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535 ? parsedPort : current.smtpPort;

    const updated = farmStore.updateEmailSettings({
      isEnabled: typeof body.isEnabled === 'boolean' ? body.isEnabled : current.isEnabled,
      provider: body.provider === 'MOCK' ? 'MOCK' : 'SMTP',
      smtpHost: typeof body.smtpHost === 'string' ? body.smtpHost.trim() : current.smtpHost,
      smtpPort,
      smtpUser: typeof body.smtpUser === 'string' ? body.smtpUser.trim() : current.smtpUser,
      smtpPass,
      smtpSecure: typeof body.smtpSecure === 'boolean' ? body.smtpSecure : current.smtpSecure,
      fromEmail: typeof body.fromEmail === 'string' ? body.fromEmail.trim() : current.fromEmail,
      fromName: typeof body.fromName === 'string' ? body.fromName.trim() : current.fromName,
    });

    return NextResponse.json({
      success: true,
      message: 'تنظیمات وب‌سرویس ایمیل با موفقیت ذخیره شد.',
      settings: getMaskedSettings(updated),
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/email-settings POST', 'خطا در ذخیره تنظیمات ایمیل');
  }
}
