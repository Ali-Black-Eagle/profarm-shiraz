import 'server-only';
import { NextResponse } from 'next/server';
import { farmStore } from './db-store';
import { getSessionFromRequest, isSessionStale, SessionPayload } from './session';
import type { User } from '@/types';

export interface UserAuth {
  session: SessionPayload;
  user: User;
}

const SESSION_EXPIRED_MESSAGE = 'نشست شما منقضی شده است. لطفاً دوباره وارد شوید.';

/**
 * Resolves the signed-in customer for a request and checks the session version.
 * The token alone is not enough: the account must still exist, and the token must not predate the account's
 * latest password change (User.sessionVersion). Anything else is rejected with 401.
 *
 * Usage:
 *   const auth = requireUser(req);
 *   if (auth instanceof NextResponse) return auth;
 *   // auth.session, auth.user
 */
export function requireUser(req: Request): UserAuth | NextResponse {
  const session = getSessionFromRequest(req);
  const user = session?.userId ? farmStore.getUserById(session.userId) : undefined;
  if (!session || !user || isSessionStale(session, user)) {
    return NextResponse.json({ success: false, message: SESSION_EXPIRED_MESSAGE }, { status: 401 });
  }
  return { session, user };
}

/**
 * Same check for routes where signing in is optional (guests are priced as FREE, for example).
 * A missing, unknown or stale session is treated as anonymous and returns null. It never rejects.
 */
export function getOptionalUser(req: Request): UserAuth | null {
  const session = getSessionFromRequest(req);
  const user = session?.userId ? farmStore.getUserById(session.userId) : undefined;
  if (!session || !user || isSessionStale(session, user)) return null;
  return { session, user };
}
