import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/user-auth';
import { apiErrorResponse } from '@/lib/api-errors';
import { requestEmailCode } from '@/lib/email-verification';
import { getSecureClientIp } from '@/lib/formatters';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/email/resend
 * Sends a new code to the pending address of the signed-in account. The new code replaces the old one.
 * Subject to the same limits as every code request (per address, per account, per IP).
 */
export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const pending = auth.user.pendingEmail?.trim().toLowerCase();
    if (!pending) {
      return NextResponse.json(
        { success: false, message: 'در حال حاضر ایمیلی در انتظار تایید برای حساب شما نیست.' },
        { status: 400 }
      );
    }

    const sent = await requestEmailCode({
      purpose: 'change',
      email: pending,
      userId: auth.user.id,
      ip: getSecureClientIp(req),
      recipientName: auth.user.name || undefined,
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
      pendingEmail: pending,
      ...(sent.debugCode ? { debugCode: sent.debugCode } : {}),
    });
  } catch (err: unknown) {
    return apiErrorResponse(err, 'auth/email/resend', 'خطا در ارسال مجدد کد تایید');
  }
}
