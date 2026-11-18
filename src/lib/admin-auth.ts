import 'server-only';
import { NextResponse } from 'next/server';
import { farmStore } from './db-store';
import { getSessionFromRequest, isSessionStale, SessionPayload } from './session';
import type { User } from '@/types';

/**
 * Validates the session AND re-checks the current role in the store.
 * A token that still says ADMIN is not enough: the user must still exist and still be ADMIN,
 * so a demoted or deleted admin loses API access immediately.
 *
 * Usage:
 *   const auth = requireAdmin(req);
 *   if (auth instanceof NextResponse) return auth;
 *   // auth.session, auth.user
 */
export function requireAdmin(
  req: Request
): { session: SessionPayload; user: User } | NextResponse {
  const session = getSessionFromRequest(req);
  if (!session || !session.userId) {
    return NextResponse.json(
      { success: false, message: 'دسترسی غیرمجاز: لطفا ابتدا وارد حساب مدیر شوید.' },
      { status: 401 }
    );
  }

  const user = farmStore.getAllUsers().find((u) => u.id === session.userId);
  if (!user) {
    return NextResponse.json(
      { success: false, message: 'دسترسی غیرمجاز: حساب کاربری یافت نشد.' },
      { status: 401 }
    );
  }

  // Token issued before the latest password change: reject (the admin must sign in again)
  if (isSessionStale(session, user)) {
    return NextResponse.json(
      { success: false, message: 'نشست شما منقضی شده است. لطفاً دوباره وارد شوید.' },
      { status: 401 }
    );
  }

  if (user.role !== 'ADMIN') {
    return NextResponse.json(
      { success: false, message: 'دسترسی ممنوع: فقط مدیر ارشد سیستم مجاز به انجام این عملیات است.' },
      { status: 403 }
    );
  }

  return { session, user };
}
