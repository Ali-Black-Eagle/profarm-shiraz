import { OAuth2Client } from 'google-auth-library';
import { NextRequest, NextResponse } from 'next/server';
import { farmStore, sanitizeUser } from '@/lib/db-store';
import { setSessionCookie } from '@/lib/session';
import { apiErrorResponse } from '@/lib/api-errors';

interface VerifiedGooglePayload {
  email: string;
  name?: string;
  picture?: string;
}

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Cryptographically verifies Google ID token locally using Google's public JWK certificates
 * via the official google-auth-library (fixes H-1).
 */
async function verifyGoogleToken(token: string): Promise<VerifiedGooglePayload | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  // SECURITY (H-1 Fix): In production, GOOGLE_CLIENT_ID must be configured
  if (!clientId && process.env.NODE_ENV === 'production') {
    console.error('[Google Auth Security] GOOGLE_CLIENT_ID environment variable is missing.');
    return null;
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: clientId || undefined,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email || !payload.email_verified) {
      return null;
    }

    return {
      email: payload.email.toLowerCase(),
      name: payload.name || payload.email.split('@')[0],
      picture: payload.picture,
    };
  } catch (err) {
    console.error('[Google Auth Security] Canonical token verification failed:', err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { idToken, credential } = body;
    const token = (typeof idToken === 'string' ? idToken : typeof credential === 'string' ? credential : '').trim();

    // SECURITY (C-1 Fix): Require valid Google ID token proof. Reject unverified body claims.
    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: 'توکن امنیتی گوگل (id_token یا credential) جهت احراز هویت الزامی است.',
        },
        { status: 400 }
      );
    }

    let verifiedUser: VerifiedGooglePayload | null = null;

    // Secure dev/mock test bypass with explicit non-admin constraint
    if (process.env.NODE_ENV !== 'production' && token.startsWith('mock_test_token_')) {
      const mockEmail = token.replace('mock_test_token_', '').trim().toLowerCase();
      if (mockEmail.includes('admin')) {
        return NextResponse.json(
          { success: false, message: 'ورود با حساب گوگل برای ایمیل‌های مدیریت مسدود است.' },
          { status: 403 }
        );
      }
      verifiedUser = {
        email: mockEmail,
        name: body.name || mockEmail.split('@')[0],
        picture: body.picture,
      };
    } else {
      verifiedUser = await verifyGoogleToken(token);
    }

    if (!verifiedUser) {
      return NextResponse.json(
        { success: false, message: 'توکن احراز هویت گوگل نامعتبر است یا منقضی گردیده است.' },
        { status: 401 }
      );
    }

    const cleanEmail = verifiedUser.email;

    // Retrieve or register user via verified Google identity
    // (farmStore.getOrCreateGoogleUser rejects any attempt targeting ADMIN users)
    const user = farmStore.getOrCreateGoogleUser({
      email: cleanEmail,
      name: verifiedUser.name || cleanEmail.split('@')[0],
      picture: verifiedUser.picture,
    });

    // Defense-in-depth: Never allow ADMIN role from Google OAuth
    if (user.role === 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'دسترسی غیرمجاز با حساب گوگل.' },
        { status: 403 }
      );
    }

    const safeUser = sanitizeUser(user);

    const res = NextResponse.json({
      success: true,
      message: 'ورود با حساب گوگل با موفقیت انجام شد.',
      user: safeUser,
    });

    setSessionCookie(res, {
      userId: safeUser.id,
      phone: safeUser.phone || '',
      name: safeUser.name || 'کاربر گوگل',
      role: 'USER', // Strictly USER
      tier: safeUser.tier,
      isProMember: safeUser.isProMember,
    });

    return res;
  } catch (error: unknown) {
    return apiErrorResponse(error, 'auth/google', 'خطا در ارتباط با حساب گوگل');
  }
}
