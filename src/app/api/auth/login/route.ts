import { NextRequest, NextResponse } from 'next/server';
import { farmStore, sanitizeUser } from '@/lib/db-store';
import { sendOtp, verifyOtp, checkDistributedRateLimit } from '@/lib/sms';
import { setSessionCookie } from '@/lib/session';
import { getSecureClientIp, isValidIranPhone, normalizePhoneNumber } from '@/lib/formatters';
import { apiErrorResponse } from '@/lib/api-errors';
import { getEffectiveTier } from '@/lib/subscription';

interface FailureRecord {
  attempts: number;
  resetAt: number;
}

type LimitKind = 'ip' | 'pair' | 'identifier';

interface LimitConfig {
  /** Namespace used for the Upstash key (ratelimit:<ns>:<key>) */
  ns: string;
  /** Failures allowed inside one window */
  max: number;
  windowMs: number;
  store: Map<string, FailureRecord>;
}

const g = (typeof globalThis !== 'undefined' ? globalThis : global) as unknown as {
  __PROFARM_IP_RATELIMIT_STORE__?: Map<string, FailureRecord>;
  __PROFARM_PWD_RATELIMIT_STORE__?: Map<string, FailureRecord>;
  __PROFARM_IDENTIFIER_RATELIMIT_STORE__?: Map<string, FailureRecord>;
};
const ipStore = g.__PROFARM_IP_RATELIMIT_STORE__ || (g.__PROFARM_IP_RATELIMIT_STORE__ = new Map<string, FailureRecord>());
const pairStore = g.__PROFARM_PWD_RATELIMIT_STORE__ || (g.__PROFARM_PWD_RATELIMIT_STORE__ = new Map<string, FailureRecord>());
const identifierStore =
  g.__PROFARM_IDENTIFIER_RATELIMIT_STORE__ ||
  (g.__PROFARM_IDENTIFIER_RATELIMIT_STORE__ = new Map<string, FailureRecord>());

const TEN_MINUTES_MS = 10 * 60 * 1000;

const LIMITS: Record<LimitKind, LimitConfig> = {
  // All failed password logins from one IP (credential stuffing across many accounts)
  ip: { ns: 'ip_login', max: 30, windowMs: TEN_MINUTES_MS, store: ipStore },
  // Failed logins for one account from one IP: only that IP is locked out for that account
  pair: { ns: 'pwd', max: 5, windowMs: TEN_MINUTES_MS, store: pairStore },
  // Failed logins for one account from ANY IP: a global cap that does not depend on IP headers
  identifier: { ns: 'id_login', max: 10, windowMs: 15 * 60 * 1000, store: identifierStore },
};

// Upper bound for each in-memory map (IP and identifier keys can be rotated by an attacker)
const MAX_IN_MEMORY_KEYS = 10000;

function makeRoom(store: Map<string, FailureRecord>, now: number): void {
  if (store.size < MAX_IN_MEMORY_KEYS) return;
  for (const [key, record] of store.entries()) {
    if (now > record.resetAt) store.delete(key);
  }
  while (store.size >= MAX_IN_MEMORY_KEYS) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

/** Sends a Redis pipeline to Upstash when configured. Returns null when unavailable (local store is used). */
async function upstashPipeline(commands: Array<Array<string | number>>): Promise<any[] | null> {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!upstashUrl || !upstashToken) return null;
  try {
    const res = await fetch(`${upstashUrl}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${upstashToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data : null;
  } catch (err) {
    console.warn('[Distributed RateLimit] Upstash call failed, using local store:', err);
    return null;
  }
}

async function checkLimit(kind: LimitKind, key: string): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const cfg = LIMITS[kind];
  const redisKey = `ratelimit:${cfg.ns}:${key}`;

  const results = await upstashPipeline([
    ['GET', redisKey],
    ['TTL', redisKey],
  ]);
  if (results) {
    const attempts = parseInt(String(results[0]?.result ?? '0'), 10) || 0;
    const ttl = Number(results[1]?.result);
    if (attempts >= cfg.max) {
      return { allowed: false, retryAfterSeconds: ttl > 0 ? ttl : Math.ceil(cfg.windowMs / 1000) };
    }
    return { allowed: true };
  }

  const now = Date.now();
  const record = cfg.store.get(key);
  if (!record) return { allowed: true };
  if (now > record.resetAt) {
    cfg.store.delete(key);
    return { allowed: true };
  }
  if (record.attempts >= cfg.max) {
    return { allowed: false, retryAfterSeconds: Math.ceil((record.resetAt - now) / 1000) };
  }
  return { allowed: true };
}

async function recordFailure(kind: LimitKind, key: string): Promise<void> {
  const cfg = LIMITS[kind];
  const redisKey = `ratelimit:${cfg.ns}:${key}`;
  await upstashPipeline([
    ['INCR', redisKey],
    ['EXPIRE', redisKey, Math.ceil(cfg.windowMs / 1000), 'NX'],
  ]);

  const now = Date.now();
  const record = cfg.store.get(key);
  if (!record || now > record.resetAt) {
    if (record) cfg.store.delete(key);
    makeRoom(cfg.store, now);
    cfg.store.set(key, { attempts: 1, resetAt: now + cfg.windowMs });
  } else {
    record.attempts += 1;
  }
}

async function clearLimit(kind: LimitKind, key: string): Promise<void> {
  const cfg = LIMITS[kind];
  await upstashPipeline([['DEL', `ratelimit:${cfg.ns}:${key}`]]);
  cfg.store.delete(key);
}

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const { phone, identifier, username, password, code } = body;
    const rawIdentifier = identifier || username || phone;
    const userIdentifier = typeof rawIdentifier === 'string' ? rawIdentifier.trim() : '';

    // Length bounds are checked before any map lookup or password hashing
    if (userIdentifier.length > 100) {
      return NextResponse.json(
        { success: false, message: 'شناسه ورود نامعتبر است.' },
        { status: 400 }
      );
    }
    if (typeof password === 'string' && password.length > 128) {
      return NextResponse.json(
        { success: false, message: 'رمز عبور وارد شده بیش از حد طولانی است.' },
        { status: 400 }
      );
    }

    // Per-IP cap across all accounts (credential stuffing). When the IP is 'unknown' (no trusted proxy
    // header) this limiter is skipped; the per-account and global-per-identifier limits still apply.
    const clientIp = getSecureClientIp(req);
    const ipKnown = clientIp !== 'unknown';
    if (ipKnown) {
      const ipCheck = await checkLimit('ip', clientIp);
      if (!ipCheck.allowed) {
        return NextResponse.json(
          {
            success: false,
            message: `تعداد تلاش‌های ناموفق ورود از این آدرس IP بیش از حد مجاز است. لطفاً ${ipCheck.retryAfterSeconds} ثانیه دیگر مجدداً تلاش فرمایید.`,
          },
          { status: 429 }
        );
      }
    }

    // 1. Password Login Mode (with brute-force limits)
    if (password && typeof password === 'string' && userIdentifier) {
      const accountKey = userIdentifier.toLowerCase();

      // Global per-account cap, independent of IP, so rotating IPs or headers cannot bypass it
      const accountCheck = await checkLimit('identifier', accountKey);
      if (!accountCheck.allowed) {
        return NextResponse.json(
          {
            success: false,
            message: `تعداد تلاش‌های ناموفق برای این حساب کاربری بیش از حد مجاز است. لطفاً ${accountCheck.retryAfterSeconds} ثانیه دیگر مجدداً تلاش فرمایید.`,
          },
          { status: 429 }
        );
      }

      // Lockout key combines IP and identifier so one IP cannot lock the account for everyone.
      // Only used when the IP is known; with 'unknown' the account-wide identifier limit above applies.
      const pairKey = `${clientIp}:${accountKey}`;
      if (ipKnown) {
        const pairCheck = await checkLimit('pair', pairKey);
        if (!pairCheck.allowed) {
          return NextResponse.json(
            {
              success: false,
              message: `تعداد تلاش‌های ناموفق ورود بیش از حد مجاز است. لطفاً ${pairCheck.retryAfterSeconds} ثانیه دیگر مجدداً تلاش فرمایید.`,
            },
            { status: 429 }
          );
        }
      }

      const user = farmStore.verifyUserPassword(userIdentifier, password);
      if (!user) {
        if (ipKnown) {
          await recordFailure('pair', pairKey);
          await recordFailure('ip', clientIp);
        }
        await recordFailure('identifier', accountKey);
        return NextResponse.json(
          { success: false, message: 'شماره تلفن/ایمیل یا رمز عبور وارد شده نادرست است.' },
          { status: 401 }
        );
      }

      // Success! Clear failed attempts for this account
      if (ipKnown) await clearLimit('pair', pairKey);
      await clearLimit('identifier', accountKey);

      const safeUser = sanitizeUser(user);
      const res = NextResponse.json({
        success: true,
        message: 'ورود با رمز عبور موفقیت‌آمیز بود.',
        user: safeUser,
      });

      setSessionCookie(res, {
        userId: user.id,
        sv: user.sessionVersion ?? 0,
        phone: user.phone || '',
        name: user.name || 'کاربر گرامی',
        role: user.role,
        tier: getEffectiveTier(user),
        isProMember: getEffectiveTier(user) === 'PRO',
      });

      return res;
    }

    // 2. OTP Verification Mode
    if (code && userIdentifier) {
      if (!isValidIranPhone(userIdentifier)) {
        return NextResponse.json(
          { success: false, message: 'لطفاً شماره موبایل معتبر ۱۱ رقمی وارد نمایید (مانند ۰۹۱۷۱۲۳۴۵۶۷).' },
          { status: 400 }
        );
      }
      const phone = normalizePhoneNumber(userIdentifier);

      // Same verify limiters as POST /api/auth/otp: per IP and per phone
      if (ipKnown) {
        const verifyIpCheck = await checkDistributedRateLimit(`otp_verify_ip:${clientIp}`, 20, 300);
        if (!verifyIpCheck.allowed) {
          return NextResponse.json(
            {
              success: false,
              message: `تعداد تلاش‌های تایید کد بیش از حد مجاز است. لطفاً ${verifyIpCheck.retryAfterSeconds} ثانیه دیگر مجدداً تلاش نمایید.`,
            },
            { status: 429 }
          );
        }
      }
      const verifyPhoneCheck = await checkDistributedRateLimit(`otp_verify_phone:${phone}`, 10, 900);
      if (!verifyPhoneCheck.allowed) {
        return NextResponse.json(
          {
            success: false,
            message: `تعداد تلاش‌های تایید کد برای این شماره بیش از حد مجاز است. لطفاً ${verifyPhoneCheck.retryAfterSeconds} ثانیه دیگر مجدداً تلاش نمایید.`,
          },
          { status: 429 }
        );
      }

      const verifyResult = await verifyOtp(phone, code);
      if (!verifyResult.success) {
        return NextResponse.json(verifyResult, { status: 400 });
      }

      // SECURITY: Block ADMIN role escalation via customer OTP.
      // Admin accounts MUST authenticate via password or dedicated admin portal.
      const existingUser = farmStore.getUserByPhone(verifyResult.phone!);
      if (existingUser && existingUser.role === 'ADMIN') {
        return NextResponse.json(
          {
            success: false,
            message: 'برای این حساب کاربری، ورود با کلمه عبور الزامی است.',
          },
          { status: 403 }
        );
      }

      const user = farmStore.getOrCreateUser(verifyResult.phone!);
      const safeUser = sanitizeUser(user);
      const res = NextResponse.json({
        success: true,
        message: 'ورود با موفقیت انجام شد.',
        user: safeUser,
      });

      setSessionCookie(res, {
        userId: user.id,
        sv: user.sessionVersion ?? 0,
        phone: user.phone || '',
        name: user.name || 'کاربر گرامی',
        role: user.role,
        tier: getEffectiveTier(user),
        isProMember: getEffectiveTier(user) === 'PRO',
      });

      return res;
    }

    // 3. Send OTP Mode (with IP rate limiting to prevent SMS toll fraud & bombing)
    if (userIdentifier) {
      if (!isValidIranPhone(userIdentifier)) {
        return NextResponse.json(
          { success: false, message: 'لطفاً شماره موبایل معتبر ۱۱ رقمی وارد نمایید (مانند ۰۹۱۷۱۲۳۴۵۶۷).' },
          { status: 400 }
        );
      }

      if (ipKnown) {
        const ipRateCheck = await checkDistributedRateLimit(`otp_ip:${clientIp}`, 10, 600);
        if (!ipRateCheck.allowed) {
          return NextResponse.json(
            {
              success: false,
              message: `تعداد درخواست‌های پیامک از طرف شبکه شما بیش از حد مجاز است. لطفاً ${ipRateCheck.retryAfterSeconds} ثانیه دیگر مجدداً تلاش فرمایید.`,
            },
            { status: 429 }
          );
        }
      }

      const sendResult = await sendOtp(normalizePhoneNumber(userIdentifier));
      return NextResponse.json(sendResult);
    }

    return NextResponse.json(
      { success: false, message: 'شماره تلفن یا شناسه کاربری الزامی است.' },
      { status: 400 }
    );
  } catch (error: unknown) {
    return apiErrorResponse(error, 'auth/login', 'خطای ورود به سیستم. لطفاً دوباره تلاش نمایید.');
  }
}
