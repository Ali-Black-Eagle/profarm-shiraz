import { NextRequest, NextResponse } from 'next/server';
import { setSessionCookie } from '@/lib/session';
import { requireUser } from '@/lib/user-auth';
import { farmStore, sanitizeUser } from '@/lib/db-store';
import { apiErrorResponse } from '@/lib/api-errors';
import { getEffectiveTier } from '@/lib/subscription';
import { isValidEmail } from '@/lib/email';
import { getSecureClientIp } from '@/lib/formatters';
import { requestEmailCode } from '@/lib/email-verification';

// Fields a customer may change through POST /api/auth/me. Anything else (role, tier, phone,
// email verification, subscription data, ...) is ignored. The email is handled separately below:
// it is never stored directly, only after its code was verified (POST /api/auth/email/verify).
const PROFILE_FIELDS = [
  'name',
  'username',
  'nationalId',
  'birthDate',
  'smsNotificationEnabled',
  'password',
  'currentPassword',
] as const;

export async function GET(req: NextRequest) {
  // Missing, unknown and stale sessions (issued before a password change) are all signed out.
  // The account is looked up strictly by the id from the token (requireUser). It is never re-created from the token.
  const auth = requireUser(req);
  if (auth instanceof NextResponse) {
    return NextResponse.json(
      { authenticated: false, message: 'نشست شما منقضی شده است. لطفاً دوباره وارد شوید.', user: null },
      { status: 401 }
    );
  }
  const fullUser = auth.user;

  // Sanitize user (stripping password hash, secret salt, etc.)
  const safeUser = sanitizeUser(fullUser);
  // The tier that applies today (an expired plan is reported as FREE)
  const tier = getEffectiveTier(fullUser);
  safeUser.tier = tier;
  safeUser.subscriptionTier = tier;
  safeUser.isProMember = tier === 'PRO';
  safeUser.isPlusMember = tier === 'PLUS';
  const usedEggQuotaThisMonth = farmStore.getUserRolling30DaysEggDiscountUsed(safeUser.id);
  safeUser.eggDiscountUsed = usedEggQuotaThisMonth;

  return NextResponse.json({
    authenticated: true,
    // hasPassword tells the settings page whether a current password must be entered. The hash is never sent.
    user: { ...safeUser, hasPassword: Boolean(fullUser.password) },
    usedEggQuotaThisMonth,
  });
}

/**
 * Profile update.
 * - `email` given as a non-empty address: a 6-digit code is sent to it and the address is stored as
 *   `pendingEmail`. `email` changes only after POST /api/auth/email/verify.
 * - `email` given as an empty string or null: the email is removed at once.
 */
export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const session = auth.session;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, message: 'اطلاعات ارسالی نامعتبر است.' },
        { status: 400 }
      );
    }

    // Validate the email field before anything is saved
    let emailChange: string | null | undefined = undefined; // undefined: not in the request
    if ('email' in body) {
      const raw = body.email;
      if (raw !== null && typeof raw !== 'string') {
        return NextResponse.json({ success: false, message: 'فرمت آدرس ایمیل نامعتبر است.' }, { status: 400 });
      }
      const clean = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
      if (clean.length > 254) {
        return NextResponse.json({ success: false, message: 'آدرس ایمیل نمی‌تواند بیش از ۲۵۴ کاراکتر باشد.' }, { status: 400 });
      }
      if (clean && !isValidEmail(clean)) {
        return NextResponse.json({ success: false, message: 'فرمت آدرس ایمیل نامعتبر است.' }, { status: 400 });
      }
      emailChange = clean;
    }

    // A new address must not already belong to a verified or admin account (checked before a code is sent)
    if (emailChange) {
      const current = farmStore.getUserById(session.userId);
      const alreadyMine = current?.isEmailVerified === true && current.email?.trim().toLowerCase() === emailChange;
      if (!alreadyMine) {
        const claim = farmStore.checkEmailClaim(session.userId, emailChange);
        if (!claim.ok) {
          return NextResponse.json({ success: false, message: claim.message }, { status: claim.status });
        }
      }
    }

    const updates: Record<string, unknown> = {};
    for (const key of PROFILE_FIELDS) {
      if (key in body) updates[key] = body[key];
    }

    const result = farmStore.updateUserProfile(session.userId, updates as Parameters<typeof farmStore.updateUserProfile>[1]);
    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status ?? 400 }
      );
    }

    let message = result.message || 'اطلاعات حساب کاربری با موفقیت به‌روزرسانی شد.';
    let debugCode: string | undefined = undefined;
    let emailCodeSent = false;

    if (emailChange === '') {
      const cleared = farmStore.clearEmail(session.userId);
      if (!cleared.success) {
        return NextResponse.json({ success: false, message: cleared.message }, { status: cleared.status ?? 400 });
      }
      message = 'ایمیل حساب کاربری شما حذف شد.';
    } else if (emailChange) {
      const current = farmStore.getUserById(session.userId);
      const alreadyMine = current?.isEmailVerified === true && current.email?.trim().toLowerCase() === emailChange;
      if (alreadyMine) {
        message = 'این ایمیل هم‌اکنون برای حساب شما تایید شده است.';
      } else {
        const ip = getSecureClientIp(req);
        const sent = await requestEmailCode({
          purpose: 'change',
          email: emailChange,
          userId: session.userId,
          ip,
          recipientName: current?.name || undefined,
        });
        if (!sent.success) {
          return NextResponse.json(
            { success: false, message: sent.message, retryAfterSeconds: sent.retryAfterSeconds },
            { status: sent.status, headers: sent.retryAfterSeconds ? { 'Retry-After': String(sent.retryAfterSeconds) } : undefined }
          );
        }
        const pending = farmStore.setPendingEmail(session.userId, emailChange);
        if (!pending.success) {
          return NextResponse.json({ success: false, message: pending.message }, { status: pending.status ?? 409 });
        }
        emailCodeSent = true;
        debugCode = sent.debugCode;
        message = sent.message;
      }
    }

    const fresh = farmStore.getUserById(session.userId);
    const response = NextResponse.json({
      success: true,
      user: fresh ? sanitizeUser(fresh) : result.user,
      message,
      emailCodeSent,
      ...(debugCode ? { debugCode } : {}),
    });

    // A password change bumps sessionVersion, which invalidates other sessions. Re-issue this browser's
    // cookie with the new version so the user who made the change stays signed in.
    if (typeof updates.password === 'string' && updates.password.trim()) {
      if (fresh) {
        const tier = getEffectiveTier(fresh);
        setSessionCookie(response, {
          userId: fresh.id,
          phone: fresh.phone || '',
          name: fresh.name || 'کاربر گرامی',
          role: fresh.role,
          tier,
          isProMember: tier === 'PRO',
          sv: fresh.sessionVersion ?? 0,
        });
      }
    }

    return response;
  } catch (err: unknown) {
    return apiErrorResponse(err, 'auth/me', 'خطا در به‌روزرسانی اطلاعات حساب');
  }
}
