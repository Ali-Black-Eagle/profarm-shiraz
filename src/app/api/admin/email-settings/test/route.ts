import { NextRequest, NextResponse } from 'next/server';
import { farmStore } from '@/lib/db-store';
import { requireAdmin } from '@/lib/admin-auth';
import { apiErrorResponse } from '@/lib/api-errors';
import { testSmtpConnection, isValidEmail } from '@/lib/email';
import { EmailProviderSettings } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json().catch(() => ({}));
    const current = farmStore.getEmailSettings();

    const requestedHost = typeof body.smtpHost === 'string' ? body.smtpHost.trim() : '';
    const hostChanged = Boolean(requestedHost) && requestedHost !== current.smtpHost;
    const suppliedPass =
      typeof body.smtpPass === 'string' && body.smtpPass.trim().length > 0 && !body.smtpPass.includes('••')
        ? body.smtpPass.trim()
        : undefined;

    // SECURITY: the stored password is only ever sent to the stored host.
    // A different host requires the admin to type the password for that host.
    if (hostChanged && !suppliedPass) {
      return NextResponse.json(
        {
          success: false,
          message: 'برای آزمون یک سرور SMTP متفاوت با سرور ذخیره‌شده، کلمه عبور را دوباره وارد فرمایید.',
        },
        { status: 400 }
      );
    }

    const candidateSettings: EmailProviderSettings = {
      isEnabled: true,
      provider: 'SMTP',
      smtpHost: requestedHost || current.smtpHost,
      smtpPort: body.smtpPort ? parseInt(String(body.smtpPort), 10) : current.smtpPort,
      smtpUser: body.smtpUser || current.smtpUser,
      smtpPass: suppliedPass ?? current.smtpPass,
      smtpSecure: typeof body.smtpSecure === 'boolean' ? body.smtpSecure : current.smtpSecure,
      fromEmail: body.fromEmail || current.fromEmail || body.smtpUser || current.smtpUser,
      fromName: body.fromName || current.fromName || 'مزارع ارگانیک پروفارم شیراز',
    };

    const testRecipient = body.testRecipient ? String(body.testRecipient).trim().toLowerCase() : undefined;
    if (testRecipient && !isValidEmail(testRecipient)) {
      return NextResponse.json(
        { success: false, message: 'آدرس ایمیل گیرنده تست نامعتبر است.' },
        { status: 400 }
      );
    }

    const result = await testSmtpConnection(candidateSettings, testRecipient);

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/email-settings/test', 'خطای غیرمنتظره در تست وب‌سرویس ایمیل');
  }
}
