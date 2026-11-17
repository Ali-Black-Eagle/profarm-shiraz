import { NextRequest, NextResponse } from 'next/server';
import { farmStore } from '@/lib/db-store';
import { getSessionFromRequest } from '@/lib/session';

export const dynamic = 'force-dynamic';

function maskSecret(str?: string | null): string {
  if (!str) return '';
  if (str.length <= 6) return '••••••••';
  return str.slice(0, 3) + '••••••••' + str.slice(-3);
}

function getMaskedSettings(settings: ReturnType<typeof farmStore.getEmailSettings>) {
  return {
    ...settings,
    smtpPass: maskSecret(settings.smtpPass),
    hasSmtpPass: Boolean(settings.smtpPass && settings.smtpPass.trim().length > 0),
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'دسترسی غیرمجاز به تنظیمات وب‌سرویس ایمیل' },
        { status: 403 }
      );
    }

    const settings = farmStore.getEmailSettings();
    return NextResponse.json({
      success: true,
      settings: getMaskedSettings(settings),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'خطا در بارگذاری تنظیمات ایمیل' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'دسترسی غیرمجاز به تنظیمات وب‌سرویس ایمیل' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const current = farmStore.getEmailSettings();

    // Preserve real password if client sent masked string
    let smtpPass = current.smtpPass;
    if (typeof body.smtpPass === 'string') {
      const trimmed = body.smtpPass.trim();
      if (trimmed.length > 0 && !trimmed.includes('••••')) {
        smtpPass = trimmed;
      }
    }

    const updated = farmStore.updateEmailSettings({
      isEnabled: typeof body.isEnabled === 'boolean' ? body.isEnabled : current.isEnabled,
      provider: body.provider === 'MOCK' ? 'MOCK' : 'SMTP',
      smtpHost: typeof body.smtpHost === 'string' ? body.smtpHost.trim() : current.smtpHost,
      smtpPort: body.smtpPort ? parseInt(body.smtpPort, 10) : current.smtpPort,
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
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'خطا در ذخیره تنظیمات ایمیل' },
      { status: 500 }
    );
  }
}
