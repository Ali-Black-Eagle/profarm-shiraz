import { NextRequest, NextResponse } from 'next/server';
import { farmStore } from '@/lib/db-store';
import { apiErrorResponse } from '@/lib/api-errors';
import { isValidEmail } from '@/lib/email';
import { requestEmailCode } from '@/lib/email-verification';
import { getSecureClientIp } from '@/lib/formatters';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/email/register-code  { email }
 * Public. Sends a 6-digit code to an address that is about to be used for a new account.
 * POST /api/auth/register then needs this code (emailCode) to create the account with that email.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const raw = typeof body?.email === 'string' ? body.email : '';
    const email = raw.trim().toLowerCase();

    if (!email || email.length > 254 || !isValidEmail(email)) {
      return NextResponse.json(
        { success: false, message: 'لطفاً یک آدرس ایمیل معتبر وارد فرمایید (مانند user@example.com).' },
        { status: 400 }
      );
    }

    // Same answer as the registration itself would give, so no code is sent for an address that is taken
    const claim = farmStore.checkEmailClaim('', email);
    if (!claim.ok) {
      return NextResponse.json({ success: false, message: claim.message }, { status: claim.status });
    }

    const sent = await requestEmailCode({
      purpose: 'register',
      email,
      userId: null,
      ip: getSecureClientIp(req),
    });
    if (!sent.success) {
      return NextResponse.json(
        { success: false, message: sent.message, retryAfterSeconds: sent.retryAfterSeconds },
        { status: sent.status, headers: sent.retryAfterSeconds ? { 'Retry-After': String(sent.retryAfterSeconds) } : undefined }
      );
    }

    return NextResponse.json({
      success: true,
      message: sent.message,
      ...(sent.debugCode ? { debugCode: sent.debugCode } : {}),
    });
  } catch (err: unknown) {
    return apiErrorResponse(err, 'auth/email/register-code', 'خطا در ارسال کد تایید ایمیل');
  }
}
