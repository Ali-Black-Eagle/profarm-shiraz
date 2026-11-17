import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie, getSessionFromRequest, revokeSession, SESSION_COOKIE_NAME } from '@/lib/session';

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (session?.jti) {
      revokeSession(session.jti, session.exp);
    }
    const rawCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (rawCookie) {
      revokeSession(rawCookie);
    }
  } catch {
    // Continue clearing cookie even if session parse fails
  }

  const res = NextResponse.json({
    success: true,
    message: 'خروج با موفقیت انجام شد.',
  });
  clearSessionCookie(res);
  return res;
}
