import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, isSessionStale, setSessionCookie } from '@/lib/session';
import { farmStore, sanitizeUser } from '@/lib/db-store';
import { apiErrorResponse } from '@/lib/api-errors';
import { getEffectiveTier } from '@/lib/subscription';

// Fields a customer may change through POST /api/auth/me. Anything else (role, tier, phone,
// email verification, subscription data, ...) is ignored.
const PROFILE_FIELDS = [
  'name',
  'username',
  'email',
  'nationalId',
  'birthDate',
  'smsNotificationEnabled',
  'password',
  'currentPassword',
] as const;

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json(
      {
        authenticated: false,
        user: null,
      },
      { status: 401 }
    );
  }

  // SECURITY: look up strictly by the account id from the token. Never re-create an account from the token.
  const fullUser = farmStore.getAllUsers().find((u) => u.id === session.userId);
  if (!fullUser) {
    return NextResponse.json(
      {
        authenticated: false,
        message: 'حساب کاربری یافت نشد یا غیرفعال شده است.',
        user: null,
      },
      { status: 401 }
    );
  }

  // The token was issued before the latest password change: treat as signed out
  if (isSessionStale(session, fullUser)) {
    return NextResponse.json({ authenticated: false, message: 'نشست شما منقضی شده است.', user: null }, { status: 401 });
  }

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

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json(
      { success: false, message: 'لطفاً ابتدا وارد حساب کاربری شوید.' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, message: 'اطلاعات ارسالی نامعتبر است.' },
        { status: 400 }
      );
    }

    const current = farmStore.getAllUsers().find((u) => u.id === session.userId);
    if (!current || isSessionStale(session, current)) {
      return NextResponse.json(
        { success: false, message: 'نشست شما منقضی شده است. لطفاً دوباره وارد شوید.' },
        { status: 401 }
      );
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

    const response = NextResponse.json({ success: true, user: result.user, message: result.message });

    // A password change bumps sessionVersion, which invalidates other sessions. Re-issue this browser's
    // cookie with the new version so the user who made the change stays signed in.
    if (typeof updates.password === 'string' && updates.password.trim()) {
      const fresh = farmStore.getAllUsers().find((u) => u.id === session.userId);
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
