import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/user-auth';
import { farmStore, sanitizeUser } from '@/lib/db-store';
import { apiErrorResponse } from '@/lib/api-errors';
import { consumeEmailCode } from '@/lib/email-verification';
import { toEnglishDigits } from '@/lib/formatters';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/email/verify  { code }
 * Confirms the pending address of the signed-in account with the 6-digit code sent to it.
 * On success the address becomes the account email (verified) and the pending value is cleared.
 */
export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json().catch(() => ({}));
    const code = toEnglishDigits(typeof body?.code === 'string' ? body.code : String(body?.code ?? '')).replace(/\D/g, '');
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ success: false, message: 'لطفاً کد تایید ۶ رقمی را کامل وارد نمایید.' }, { status: 400 });
    }

    const pending = auth.user.pendingEmail?.trim().toLowerCase();
    if (!pending) {
      return NextResponse.json(
        { success: false, message: 'در حال حاضر ایمیلی در انتظار تایید برای حساب شما نیست.' },
        { status: 400 }
      );
    }

    const checked = consumeEmailCode('change', pending, code, auth.user.id);
    if (!checked.ok) {
      return NextResponse.json({ success: false, message: checked.message }, { status: 400 });
    }

    const confirmed = farmStore.confirmPendingEmail(auth.user.id, pending);
    if (!confirmed.success || !confirmed.user) {
      return NextResponse.json(
        { success: false, message: confirmed.message || 'خطا در تایید ایمیل' },
        { status: confirmed.status ?? 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: confirmed.message || 'ایمیل شما با موفقیت تایید شد.',
      user: sanitizeUser(confirmed.user),
    });
  } catch (err: unknown) {
    return apiErrorResponse(err, 'auth/email/verify', 'خطا در تایید ایمیل');
  }
}
