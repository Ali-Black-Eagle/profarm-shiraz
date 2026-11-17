import { NextRequest, NextResponse } from 'next/server';
import { farmStore } from '@/lib/db-store';
import { getSessionFromRequest } from '@/lib/session';
import { testSmtpConnection, isValidEmail } from '@/lib/email';
import { EmailProviderSettings } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'دسترسی غیرمجاز: ورود به عنوان مدیر ارشد الزامی است.' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const current = farmStore.getEmailSettings();

    // Use passed password unless masked, in which case use current stored password
    let smtpPass = current.smtpPass;
    if (typeof body.smtpPass === 'string') {
      const trimmed = body.smtpPass.trim();
      if (trimmed.length > 0 && !trimmed.includes('••••')) {
        smtpPass = trimmed;
      }
    }

    const candidateSettings: EmailProviderSettings = {
      isEnabled: true,
      provider: 'SMTP',
      smtpHost: body.smtpHost || current.smtpHost,
      smtpPort: body.smtpPort ? parseInt(body.smtpPort, 10) : current.smtpPort,
      smtpUser: body.smtpUser || current.smtpUser,
      smtpPass,
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
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'خطای غیرمنتظره در تست وب‌سرویس ایمیل' },
      { status: 500 }
    );
  }
}
