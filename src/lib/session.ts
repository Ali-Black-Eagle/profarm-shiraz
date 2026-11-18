import 'server-only';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export interface SessionPayload {
  jti?: string;
  userId: string;
  phone: string;
  name: string;
  role: 'ADMIN' | 'USER';
  tier?: string;
  isProMember?: boolean;
  /** Account session version at issue time (User.sessionVersion). Missing means 0. */
  sv?: number;
  exp: number; // unix timestamp in seconds
}

export const SESSION_COOKIE_NAME = 'profarm_session';

/**
 * True when the token was issued before the account's latest password change, so it must be rejected.
 * Tokens without `sv` (issued before this field existed) count as version 0.
 */
export function isSessionStale(session: { sv?: number }, user: { sessionVersion?: number | null }): boolean {
  return (session.sv ?? 0) < (user.sessionVersion ?? 0);
}

// In-memory revocation blacklist (jti or token -> expiration timestamp)
const gGlobal = (typeof globalThis !== 'undefined' ? globalThis : global) as unknown as {
  __PROFARM_REVOKED_TOKENS__?: Map<string, number>;
};
const revokedTokenStore =
  gGlobal.__PROFARM_REVOKED_TOKENS__ ||
  (gGlobal.__PROFARM_REVOKED_TOKENS__ = new Map<string, number>());

/**
 * Revokes a session by unique token ID (jti) or token string
 */
export function revokeSession(identifier: string, expSeconds?: number): void {
  if (!identifier) return;
  const now = Math.floor(Date.now() / 1000);
  const exp = expSeconds || now + 7 * 24 * 60 * 60;
  revokedTokenStore.set(identifier, exp);

  // Periodic cleanup if store grows
  if (revokedTokenStore.size > 1000) {
    for (const [key, tokenExp] of revokedTokenStore.entries()) {
      if (tokenExp < now) {
        revokedTokenStore.delete(key);
      }
    }
  }
}

/**
 * Checks if a session has been revoked
 */
export function isSessionRevoked(identifier?: string | null): boolean {
  if (!identifier) return false;
  const exp = revokedTokenStore.get(identifier);
  if (!exp) return false;
  const now = Math.floor(Date.now() / 1000);
  if (now > exp) {
    revokedTokenStore.delete(identifier);
    return false;
  }
  return true;
}

/**
 * Retrieves the cryptographic secret key for signing session tokens.
 * Enforces strong environment variable presence in production.
 */
// Placeholder / previously hard-coded secrets that must never be used for signing
const KNOWN_WEAK_SECRETS = new Set([
  'profarm_shiraz_super_secret_jwt_key_2026',
  'replace_with_a_secure_random_32_char_secret_key', // .env.example placeholder
  'your_strong_random_secret_jwt_key_here_min_32_characters', // ARCHITECTURE.md placeholder
]);

export function getSessionSecret(): string {
  const envSecret = (process.env.NEXTAUTH_SECRET || process.env.SESSION_SECRET || '').trim();
  const isUsable = envSecret !== '' && !KNOWN_WEAK_SECRETS.has(envSecret);

  if (process.env.NODE_ENV === 'production') {
    if (!isUsable || envSecret.length < 32) {
      throw new Error(
        'CRITICAL SECURITY ERROR: NEXTAUTH_SECRET or SESSION_SECRET must be set to a unique random value of at least 32 characters in production!'
      );
    }
    return envSecret;
  }

  if (isUsable) {
    return envSecret;
  }

  // In development, create and preserve a process-isolated ephemeral 32-byte cryptographic secret
  const g = globalThis as any;
  if (!g.__DEV_EPHEMERAL_SESSION_SECRET__) {
    g.__DEV_EPHEMERAL_SESSION_SECRET__ = crypto.randomBytes(32).toString('hex');
  }
  return g.__DEV_EPHEMERAL_SESSION_SECRET__;
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return Buffer.from(str, 'base64').toString('utf-8');
}

/**
 * Creates a signed JWT-style token using HMAC-SHA256
 */
export function signSession(
  payload: Omit<SessionPayload, 'exp'>,
  expiresInDays = 7
): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInDays * 24 * 60 * 60;
  const jti = payload.jti || (crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'));
  const fullPayload: SessionPayload = { ...payload, jti, exp };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const secret = getSessionSecret();
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verifies a token and returns the payload if valid, or null if invalid or expired
 */
export function verifySession(token?: string | null): SessionPayload | null {
  if (!token) return null;
  if (isSessionRevoked(token)) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;

    const secret = getSessionSecret();
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    // Constant-time comparison to prevent timing attacks
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payload: SessionPayload = JSON.parse(base64UrlDecode(encodedPayload));
    if (payload.jti && isSessionRevoked(payload.jti)) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Extracts session payload from a NextRequest or standard Request (cookies or Authorization header)
 */
export function getSessionFromRequest(
  req: NextRequest | Request
): SessionPayload | null {
  // 1. Try Cookie
  if ('cookies' in req && typeof req.cookies?.get === 'function') {
    const cookie = req.cookies.get(SESSION_COOKIE_NAME);
    if (cookie?.value) {
      const payload = verifySession(cookie.value);
      if (payload) return payload;
    }
  }

  // 2. Try raw cookie header
  const rawCookie = req.headers.get('cookie');
  if (rawCookie) {
    const match = rawCookie
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
    if (match) {
      const token = match.substring(`${SESSION_COOKIE_NAME}=`.length);
      const payload = verifySession(token);
      if (payload) return payload;
    }
  }

  // 3. Try Authorization: Bearer <token>
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const payload = verifySession(token);
    if (payload) return payload;
  }

  return null;
}

/**
 * Determines whether cookies should require HTTPS based on environment and domain
 */
function isSecureCookie(): boolean {
  if (process.env.COOKIE_SECURE === 'true') return true;
  if (process.env.COOKIE_SECURE === 'false') return false;
  if (process.env.NODE_ENV !== 'production') return false;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').trim();
  if (appUrl.startsWith('http://localhost') || appUrl.startsWith('http://127.0.0.1')) return false;
  return appUrl ? appUrl.startsWith('https://') : true;
}

/**
 * Sets session cookie on a NextResponse object
 */
export function setSessionCookie(
  res: NextResponse,
  payload: Omit<SessionPayload, 'exp'>,
  expiresInDays = 7
) {
  const token = signSession(payload, expiresInDays);
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: 'lax',
    path: '/',
    maxAge: expiresInDays * 24 * 60 * 60,
  });
  return token;
}

// ---------------------------------------------------------------------------
// Phone proof: short-lived token issued after a successful OTP verification.
// Proves that the caller controlled the phone number when registering with it.
// Uses a distinct prefix and a domain-separated HMAC so it can never be accepted as a session.
// ---------------------------------------------------------------------------

const PHONE_PROOF_PREFIX = 'pp';
const PHONE_PROOF_TTL_SECONDS = 10 * 60;

function phoneProofMac(data: string): string {
  return crypto
    .createHmac('sha256', getSessionSecret())
    .update(`phone-proof:${data}`)
    .digest('base64url');
}

/** Issues a signed proof that `phone` was verified by OTP. Valid for 10 minutes. */
export function signPhoneProof(phone: string): string {
  const payload = {
    phone,
    purpose: 'phone-proof',
    exp: Math.floor(Date.now() / 1000) + PHONE_PROOF_TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const data = `${PHONE_PROOF_PREFIX}.${body}`;
  return `${data}.${phoneProofMac(data)}`;
}

/** Returns true only when the token is a valid, unexpired proof for exactly this phone. */
export function verifyPhoneProof(token: unknown, phone: string): boolean {
  if (typeof token !== 'string' || !phone) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== PHONE_PROOF_PREFIX) return false;

  const data = `${parts[0]}.${parts[1]}`;
  const expectedBuf = Buffer.from(phoneProofMac(data));
  const givenBuf = Buffer.from(parts[2]);
  if (givenBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(givenBuf, expectedBuf)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
    const now = Math.floor(Date.now() / 1000);
    return (
      payload.purpose === 'phone-proof' &&
      payload.phone === phone &&
      typeof payload.exp === 'number' &&
      payload.exp >= now
    );
  } catch {
    return false;
  }
}

/**
 * Clears session cookie on a NextResponse object
 */
export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
