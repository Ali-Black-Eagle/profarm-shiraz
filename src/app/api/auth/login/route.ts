import { NextRequest, NextResponse } from 'next/server';
import { farmStore, sanitizeUser } from '@/lib/db-store';
import { sendOtp, verifyOtp, checkDistributedRateLimit } from '@/lib/sms';
import { setSessionCookie } from '@/lib/session';

interface PasswordRateLimit {
  attempts: number;
  resetAt: number;
}
const g = (typeof globalThis !== 'undefined' ? globalThis : global) as unknown as {
  __PROFARM_PWD_RATELIMIT_STORE__?: Map<string, PasswordRateLimit>;
  __PROFARM_IP_RATELIMIT_STORE__?: Map<string, PasswordRateLimit>;
};
const passwordLimitStore = g.__PROFARM_PWD_RATELIMIT_STORE__ || (g.__PROFARM_PWD_RATELIMIT_STORE__ = new Map<string, PasswordRateLimit>());
const ipLimitStore = g.__PROFARM_IP_RATELIMIT_STORE__ || (g.__PROFARM_IP_RATELIMIT_STORE__ = new Map<string, PasswordRateLimit>());

const MAX_PWD_ATTEMPTS = 5;
const MAX_IP_ATTEMPTS = 20; // 20 failed login attempts per IP per window
const PWD_WINDOW_MS = 10 * 60 * 1000; // 10 minutes lockout
const PWD_WINDOW_SECONDS = 600;

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const ip = forwarded.split(',')[0].trim();
    if (ip) return ip;
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

async function checkIpRateLimit(ip: string): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const cleanIp = ip.trim();
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    try {
      const redisKey = `ratelimit:ip_login:${cleanIp}`;
      const res = await fetch(`${upstashUrl}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${upstashToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['GET', redisKey],
          ['TTL', redisKey],
        ]),
        cache: 'no-store',
      });
      if (res.ok) {
        const results = await res.json();
        const attempts = parseInt(results?.[0]?.result || '0', 10);
        const ttl = results?.[1]?.result || PWD_WINDOW_SECONDS;
        if (attempts >= MAX_IP_ATTEMPTS) {
          return { allowed: false, retryAfterSeconds: ttl > 0 ? ttl : PWD_WINDOW_SECONDS };
        }
        return { allowed: true };
      }
    } catch {}
  }

  const now = Date.now();
  const record = ipLimitStore.get(cleanIp);
  if (!record || now > record.resetAt) return { allowed: true };
  if (record.attempts >= MAX_IP_ATTEMPTS) {
    return { allowed: false, retryAfterSeconds: Math.ceil((record.resetAt - now) / 1000) };
  }
  return { allowed: true };
}

async function recordFailedIpAttempt(ip: string): Promise<void> {
  const cleanIp = ip.trim();
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    try {
      const redisKey = `ratelimit:ip_login:${cleanIp}`;
      await fetch(`${upstashUrl}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${upstashToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['INCR', redisKey],
          ['EXPIRE', redisKey, PWD_WINDOW_SECONDS, 'NX'],
        ]),
        cache: 'no-store',
      });
    } catch {}
  }

  const now = Date.now();
  const record = ipLimitStore.get(cleanIp);
  if (!record || now > record.resetAt) {
    ipLimitStore.set(cleanIp, { attempts: 1, resetAt: now + PWD_WINDOW_MS });
  } else {
    record.attempts += 1;
  }
}

async function checkPasswordRateLimit(identifier: string): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const cleanId = identifier.trim().toLowerCase();
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    try {
      const redisKey = `ratelimit:pwd:${cleanId}`;
      const res = await fetch(`${upstashUrl}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${upstashToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['GET', redisKey],
          ['TTL', redisKey],
        ]),
        cache: 'no-store',
      });
      if (res.ok) {
        const results = await res.json();
        const attempts = parseInt(results?.[0]?.result || '0', 10);
        const ttl = results?.[1]?.result || PWD_WINDOW_SECONDS;
        if (attempts >= MAX_PWD_ATTEMPTS) {
          return { allowed: false, retryAfterSeconds: ttl > 0 ? ttl : PWD_WINDOW_SECONDS };
        }
        return { allowed: true };
      }
    } catch (err) {
      console.warn('[Distributed RateLimit] Upstash pwd check failed, using local store:', err);
    }
  }

  const now = Date.now();
  const record = passwordLimitStore.get(cleanId);

  if (!record || now > record.resetAt) {
    return { allowed: true };
  }

  if (record.attempts >= MAX_PWD_ATTEMPTS) {
    const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true };
}

async function recordFailedPasswordAttempt(identifier: string): Promise<void> {
  const cleanId = identifier.trim().toLowerCase();
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    try {
      const redisKey = `ratelimit:pwd:${cleanId}`;
      await fetch(`${upstashUrl}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${upstashToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['INCR', redisKey],
          ['EXPIRE', redisKey, PWD_WINDOW_SECONDS, 'NX'],
        ]),
        cache: 'no-store',
      });
    } catch (err) {
      console.warn('[Distributed RateLimit] Upstash pwd fail record failed:', err);
    }
  }

  const now = Date.now();
  const record = passwordLimitStore.get(cleanId);

  if (!record || now > record.resetAt) {
    passwordLimitStore.set(cleanId, { attempts: 1, resetAt: now + PWD_WINDOW_MS });
  } else {
    record.attempts += 1;
  }
}

async function clearPasswordRateLimit(identifier: string): Promise<void> {
  const cleanId = identifier.trim().toLowerCase();
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    try {
      const redisKey = `ratelimit:pwd:${cleanId}`;
      await fetch(`${upstashUrl}/del/${redisKey}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${upstashToken}` },
        cache: 'no-store',
      });
    } catch {}
  }

  passwordLimitStore.delete(cleanId);
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
    const userIdentifier = identifier || username || phone;

    // Check IP-level rate limiting to prevent DoS against admin account and credential stuffing
    const clientIp = getClientIp(req);
    const ipCheck = await checkIpRateLimit(clientIp);
    if (!ipCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: `تعداد تلاش‌های ناموفق ورود از این آدرس IP بیش از حد مجاز است. لطفاً ${ipCheck.retryAfterSeconds} ثانیه دیگر مجدداً تلاش فرمایید.`,
        },
        { status: 429 }
      );
    }

    // 1. Password Login Mode (with Brute-Force Rate Limiting)
    if (password && userIdentifier) {
      const rateCheck = await checkPasswordRateLimit(userIdentifier);
      if (!rateCheck.allowed) {
        return NextResponse.json(
          {
            success: false,
            message: `تعداد تلاش‌های ناموفق ورود بیش از حد مجاز است. لطفاً ${rateCheck.retryAfterSeconds} ثانیه دیگر مجدداً تلاش فرمایید.`,
          },
          { status: 429 }
        );
      }

      const user = farmStore.verifyUserPassword(userIdentifier, password);
      if (!user) {
        await recordFailedPasswordAttempt(userIdentifier);
        await recordFailedIpAttempt(clientIp);
        return NextResponse.json(
          { success: false, message: 'شماره تلفن/ایمیل یا رمز عبور وارد شده نادرست است.' },
          { status: 401 }
        );
      }

      // Success! Clear failed attempts
      await clearPasswordRateLimit(userIdentifier);

      const safeUser = sanitizeUser(user);
      const res = NextResponse.json({
        success: true,
        message: 'ورود با رمز عبور موفقیت‌آمیز بود.',
        user: safeUser,
      });

      setSessionCookie(res, {
        userId: user.id,
        phone: user.phone || '',
        name: user.name || 'کاربر گرامی',
        role: user.role,
        tier: user.tier,
        isProMember: user.isProMember,
      });

      return res;
    }

    // 2. OTP Verification Mode
    if (code && userIdentifier) {
      const verifyResult = await verifyOtp(userIdentifier, code);
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
        phone: user.phone || '',
        name: user.name || 'کاربر گرامی',
        role: user.role,
        tier: user.tier,
        isProMember: user.isProMember,
      });

      return res;
    }

    // 3. Send OTP Mode (with IP rate limiting to prevent SMS toll fraud & bombing)
    if (userIdentifier) {
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

      const sendResult = await sendOtp(userIdentifier);
      return NextResponse.json(sendResult);
    }

    return NextResponse.json(
      { success: false, message: 'شماره تلفن یا شناسه کاربری الزامی است.' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Login route error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'خطای ورود به سیستم' },
      { status: 500 }
    );
  }
}
