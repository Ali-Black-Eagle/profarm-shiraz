import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { farmStore, sanitizeUser } from '@/lib/db-store';

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

  // Fetch full user record from farmStore
  let fullUser = farmStore.getUserByPhone(session.phone);
  if (!fullUser) {
    fullUser = farmStore.getAllUsers().find((u) => u.id === session.userId);
  }

  // Gracefully recover if user record was deleted or reloaded
  if (!fullUser && session.phone) {
    fullUser = farmStore.getOrCreateUser(session.phone, session.name);
  }

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

  // Sanitize user (stripping password hash, secret salt, etc.)
  const safeUser = sanitizeUser(fullUser);
  const usedEggQuotaThisMonth = farmStore.getUserRolling30DaysEggDiscountUsed(safeUser.id, safeUser.phone || session.phone);
  safeUser.eggDiscountUsed = usedEggQuotaThisMonth;

  return NextResponse.json({
    authenticated: true,
    user: safeUser,
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
    const body = await req.json();
    const result = farmStore.updateUserProfile(session.userId || session.phone, body);
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json({ success: true, user: result.user, message: result.message });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message || 'خطا در به‌روزرسانی اطلاعات حساب' },
      { status: 500 }
    );
  }
}

