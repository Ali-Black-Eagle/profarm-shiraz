/**
 * SMS service & OTP management with in-memory Rate Limiting and mock provider support
 */
import 'server-only';
import crypto from 'crypto';
import { normalizePhoneNumber, isValidEmail } from './formatters';

async function triggerFallbackEmail(options: any) {
  try {
    const req = eval('require');
    const emailMod = req('./email');
    if (emailMod && typeof emailMod.sendEmail === 'function') {
      return await emailMod.sendEmail(options);
    }
  } catch (err) {
    console.error('[FallbackEmail Error]', err);
  }
}

interface StoredOtp {
  phone: string;
  code: string;
  expiresAt: number; // timestamp ms
  attempts: number;
}

interface RateLimitRecord {
  count: number;
  resetAt: number; // timestamp ms
}

// Persistent stores for OTPs and rate limits on globalThis singleton
const g = (typeof globalThis !== 'undefined' ? globalThis : global) as unknown as {
  __PROFARM_OTP_STORE__?: Map<string, StoredOtp>;
  __PROFARM_RATELIMIT_STORE__?: Map<string, RateLimitRecord>;
  farmStore?: any;
};
const otpStore = g.__PROFARM_OTP_STORE__ || (g.__PROFARM_OTP_STORE__ = new Map<string, StoredOtp>());
const rateLimitStore = g.__PROFARM_RATELIMIT_STORE__ || (g.__PROFARM_RATELIMIT_STORE__ = new Map<string, RateLimitRecord>());

const OTP_TTL_MS = 2 * 60 * 1000; // 2 minutes expiration
const MAX_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS_PER_WINDOW = 4;
// Upper bound for in-memory maps so that rotating keys cannot grow memory without limit
const MAX_IN_MEMORY_KEYS = 10000;
// Only this provider host may be used for Faraz/IPPanel dispatch (matches admin sms-settings allowlist)
const FARAZ_ALLOWED_HOSTS = new Set(['ippanel.com']);
const FARAZ_DEFAULT_ENDPOINT = 'https://ippanel.com/api/select';

/** Resolves the Faraz/IPPanel endpoint: admin-configured apiUrl when https and allowlisted, else the default. */
export function resolveFarazEndpoint(apiUrl?: string | null): string {
  if (apiUrl) {
    try {
      const url = new URL(apiUrl.trim());
      if (
        url.protocol === 'https:' &&
        !url.username &&
        !url.password &&
        !url.port &&
        FARAZ_ALLOWED_HOSTS.has(url.hostname.toLowerCase())
      ) {
        return `${url.origin}/api/select`;
      }
    } catch {
      // fall through to the default endpoint
    }
  }
  return FARAZ_DEFAULT_ENDPOINT;
}

/**
 * Retrieves the currently active SMS provider settings
 */
export function getActiveSmsConfig() {
  const storeSettings = g.farmStore?.getSmsSettings?.();
  const provider = (storeSettings?.provider || process.env.SMS_PROVIDER || 'MOCK') as string;
  const apiKey = (storeSettings?.apiKey || process.env.SMS_API_KEY || '').trim();
  const senderNumber = (storeSettings?.senderNumber || process.env.SMS_SENDER_LINE || '10008585').trim();
  const patternCode = (storeSettings?.patternCode || process.env.SMS_PATTERN_CODE || 'profarm-otp').trim();
  const apiUrl = (storeSettings?.apiUrl || '').trim();
  const isEnabled = storeSettings?.isEnabled ?? true;
  return { provider, apiKey, senderNumber, patternCode, apiUrl, isEnabled };
}

/**
 * The plain OTP code may appear in an API response only in non-production with the MOCK provider.
 * Real deployments never expose it.
 */
function canExposeDebugOtp(): boolean {
  return process.env.NODE_ENV !== 'production' && getActiveSmsConfig().provider === 'MOCK';
}

/**
 * Dispatches real SMS through Kavenegar REST API
 */
async function sendViaKavenegar(
  apiKey: string,
  receptor: string,
  message: string,
  sender: string,
  otpCode?: string,
  pattern?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // If OTP code and pattern code are available, use fast Kavenegar Lookup service
    if (otpCode && pattern && pattern !== 'none') {
      const lookupUrl = `https://api.kavenegar.com/v1/${encodeURIComponent(apiKey)}/verify/lookup.json?receptor=${encodeURIComponent(receptor)}&token=${encodeURIComponent(otpCode)}&template=${encodeURIComponent(pattern)}`;
      const res = await fetch(lookupUrl, { method: 'GET', cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (data?.return?.status === 200) {
        return { success: true, messageId: data.entries?.[0]?.messageid?.toString() };
      }
      console.warn('[Kavenegar Lookup Notice] Lookup failed or template pending, falling back to standard send:', data?.return?.message);
    }

    const sendUrl = `https://api.kavenegar.com/v1/${encodeURIComponent(apiKey)}/sms/send.json`;
    const params = new URLSearchParams({
      receptor,
      message,
      sender: sender || '10008585',
    });
    const res = await fetch(sendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    if (data?.return?.status === 200) {
      return { success: true, messageId: data.entries?.[0]?.messageid?.toString() };
    }
    return { success: false, error: data?.return?.message || 'خطا در وب‌سرویس کاوه‌نگار' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'خطای شبکه در ارسال پیامک کاوه‌نگار' };
  }
}

/**
 * Dispatches real SMS through FarazSMS / IPPanel API
 */
async function sendViaFarazSms(
  apiKey: string,
  receptor: string,
  message: string,
  sender: string,
  otpCode?: string,
  pattern?: string,
  apiUrl?: string
): Promise<{ success: boolean; error?: string }> {
  const endpoint = resolveFarazEndpoint(apiUrl);
  try {
    if (otpCode && pattern) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          op: 'pattern',
          user: apiKey,
          pass: '',
          fromNum: sender || '3000505',
          toNum: receptor,
          patternCode: pattern,
          inputData: [{ code: otpCode }],
        }),
        cache: 'no-store',
      });
      if (res.ok) return { success: true };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        op: 'send',
        uname: apiKey,
        pass: '',
        message,
        from: sender || '3000505',
        to: [receptor],
      }),
      cache: 'no-store',
    });
    return { success: res.ok };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

/**
 * Universal dispatcher for outbound SMS
 */
export async function dispatchRealSms(
  phone: string,
  message: string,
  otpCode?: string
): Promise<{ success: boolean; error?: string }> {
  const config = getActiveSmsConfig();
  if (!config.isEnabled || config.provider === 'MOCK' || !config.apiKey || config.apiKey === 'mock_sms_api_key_for_testing') {
    return { success: true };
  }

  if (config.provider === 'KAVENEGAR') {
    return await sendViaKavenegar(config.apiKey, phone, message, config.senderNumber, otpCode, config.patternCode);
  }

  if (config.provider === 'FARAZ_SMS' || config.provider === 'MELIPAYAMAK') {
    return await sendViaFarazSms(
      config.apiKey,
      phone,
      message,
      config.senderNumber,
      otpCode,
      config.patternCode,
      config.apiUrl
    );
  }

  return { success: true };
}

/**
 * Mask phone number for security and privacy in server logs (e.g. 0917***567)
 */
export function maskPhoneNumber(phone?: string | null): string {
  if (!phone) return '***';
  const clean = phone.trim();
  return clean.length >= 7 ? `${clean.slice(0, 4)}***${clean.slice(-3)}` : '09***';
}

export interface SendOtpResult {
  success: boolean;
  message: string;
  retryAfterSeconds?: number;
  debugCode?: string;
}

export interface VerifyOtpResult {
  success: boolean;
  message: string;
  phone?: string;
}

function cleanupExpiredRecords(): void {
  const now = Date.now();
  for (const [key, val] of otpStore.entries()) {
    if (now > val.expiresAt) {
      otpStore.delete(key);
    }
  }
  for (const [key, val] of rateLimitStore.entries()) {
    if (now > val.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}

/** Keeps the in-memory rate-limit map below MAX_IN_MEMORY_KEYS: drops expired keys, then the oldest ones. */
function makeRoomForNewKey(now: number): void {
  if (rateLimitStore.size < MAX_IN_MEMORY_KEYS) return;
  for (const [key, val] of rateLimitStore.entries()) {
    if (now > val.resetAt) rateLimitStore.delete(key);
  }
  while (rateLimitStore.size >= MAX_IN_MEMORY_KEYS) {
    const oldest = rateLimitStore.keys().next().value;
    if (oldest === undefined) break;
    rateLimitStore.delete(oldest);
  }
}

/**
 * In-memory rate limit for a key (phone, IP or any scoped key).
 * Allows at most `maxRequests` requests per `windowMs`.
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = MAX_REQUESTS_PER_WINDOW,
  windowMs: number = RATE_LIMIT_WINDOW_MS
): { allowed: boolean; retryAfterSeconds?: number } {
  cleanupExpiredRecords();
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetAt) {
    if (record) rateLimitStore.delete(key);
    makeRoomForNewKey(now);
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (record.count >= maxRequests) {
    const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  record.count += 1;
  return { allowed: true };
}

/**
 * Optional distributed Upstash Redis rate-limit verification for multi-instance deployments (H-2)
 */
export async function checkDistributedRateLimit(
  key: string,
  maxRequests = MAX_REQUESTS_PER_WINDOW,
  windowSeconds = 600
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!upstashUrl || !upstashToken) {
    return checkRateLimit(key, maxRequests, windowSeconds * 1000);
  }

  try {
    const redisKey = `ratelimit:sms:${key}`;
    // Increment counter in Upstash Redis
    const res = await fetch(`${upstashUrl}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${upstashToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', redisKey],
        ['EXPIRE', redisKey, windowSeconds, 'NX'],
        ['TTL', redisKey],
      ]),
      cache: 'no-store',
    });

    if (res.ok) {
      const results = await res.json();
      const currentCount = results?.[0]?.result || 1;
      const ttl = results?.[2]?.result || windowSeconds;

      if (currentCount > maxRequests) {
        return { allowed: false, retryAfterSeconds: ttl > 0 ? ttl : windowSeconds };
      }
      return { allowed: true };
    }
  } catch (err) {
    console.warn('[Distributed RateLimit] Upstash call failed, falling back to in-memory:', err);
  }

  return checkRateLimit(key, maxRequests, windowSeconds * 1000);
}

/**
 * Generates and sends a 5-digit OTP to the phone number
 */
export async function sendOtp(rawPhone: string, accountEmail?: string | null): Promise<SendOtpResult> {
  // SECURITY: accountEmail must be the email already stored on the account for this phone
  // (resolved by the caller from the store). It is never taken from the request body.
  const phone = normalizePhoneNumber(rawPhone);

  const rateCheck = await checkDistributedRateLimit(phone);
  if (!rateCheck.allowed) {
    // If rate limited on SMS and fallback email is provided, deliver OTP safely to user email with strict independent rate limiting
    if (accountEmail && isValidEmail(accountEmail)) {
      const emailRateCheck = await checkDistributedRateLimit(`otp_email:${accountEmail.toLowerCase()}`, 3, 600);
      if (!emailRateCheck.allowed) {
        return {
          success: false,
          message: `تعداد درخواست‌های کد به ایمیل بیش از حد مجاز است. لطفاً ${emailRateCheck.retryAfterSeconds} ثانیه دیگر مجدداً تلاش کنید.`,
          retryAfterSeconds: emailRateCheck.retryAfterSeconds,
        };
      }

      const code = crypto.randomInt(10000, 100000).toString();
      const expiresAt = Date.now() + OTP_TTL_MS;
      otpStore.set(phone, { phone, code, expiresAt, attempts: 0 });
      await triggerFallbackEmail({
        to: accountEmail,
        subject: 'کد تایید ورود و احراز هویت پروفارم شیراز (جایگزین پیامک)',
        text: `کد تایید ورود و احراز هویت شما:\n\n${code}\n\nاین کد تا ۲ دقیقه معتبر است.`,
        fallbackForSms: true,
      });
      return {
        success: true,
        message: 'کد تایید از طریق ایمیل برای شما ارسال شد.',
        debugCode: canExposeDebugOtp() ? code : undefined,
      };
    }

    return {
      success: false,
      message: `تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً ${rateCheck.retryAfterSeconds} ثانیه دیگر مجدداً تلاش کنید.`,
      retryAfterSeconds: rateCheck.retryAfterSeconds,
    };
  }

  // SECURITY (CSPRNG): Generate 5-digit cryptographically secure random code
  const code = crypto.randomInt(10000, 100000).toString();
  const expiresAt = Date.now() + OTP_TTL_MS;

  otpStore.set(phone, {
    phone,
    code,
    expiresAt,
    attempts: 0,
  });

  // Mask phone number for server logs (L-3 Fix)
  const maskedPhone = maskPhoneNumber(phone);

  // SECURITY: Never leak OTP codes in production server logs
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[SMS OTP DEV] To: ${maskedPhone} | Code: ${code} | Valid for 2 mins`);
  } else {
    console.log(`[SMS OTP] Sent verification code to ${maskedPhone}`);
  }

  // Attempt real SMS dispatch via configured provider (Kavenegar / FarazSMS)
  const realSmsResult = await dispatchRealSms(
    phone,
    `کد تایید ورود و احراز هویت پروفارم شیراز: ${code}\nاعتبار: ۲ دقیقه`,
    code
  );

  // Optional dual-dispatch / fallback to email if email provided or if SMS failed
  if (accountEmail && isValidEmail(accountEmail)) {
    try {
      await triggerFallbackEmail({
        to: accountEmail,
        subject: 'کد تایید ورود و تایید حساب پروفارم شیراز',
        text: `کد تایید شما برای ورود یا تایید شماره در مزارع ارگانیک پروفارم شیراز:\n\n${code}\n\nاین کد تا ۲ دقیقه دارای اعتبار است.`,
        fallbackForSms: !realSmsResult.success,
      });
    } catch (e) {
      console.warn('[sendOtp Email Dispatch Error]', e);
    }
  }

  return {
    success: true,
    message: 'کد تایید ۵ رقمی برای شماره شما ارسال شد.',
    debugCode: canExposeDebugOtp() ? code : undefined,
  };
}

/**
 * Verifies the OTP code submitted by the user
 */
export async function verifyOtp(rawPhone: string, code: string): Promise<VerifyOtpResult> {
  const phone = normalizePhoneNumber(rawPhone);
  const record = otpStore.get(phone);

  if (!record) {
    return {
      success: false,
      message: 'کد تاییدی برای این شماره ثبت نشده یا منقضی گردیده است.',
    };
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(phone);
    return {
      success: false,
      message: 'کد تایید منقضی شده است. لطفاً مجدداً درخواست کد دهید.',
    };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(phone);
    return {
      success: false,
      message: 'تعداد دفعات ورود اشتباه بیش از حد مجاز بود. کد جدید دریافت کنید.',
    };
  }

  const codeBuf = Buffer.from(code.trim());
  const expectedBuf = Buffer.from(record.code);
  const isMatch =
    codeBuf.length === expectedBuf.length &&
    crypto.timingSafeEqual(codeBuf, expectedBuf);

  if (!isMatch) {
    record.attempts += 1;
    return {
      success: false,
      message: `کد وارد شده نامعتبر است. (${MAX_ATTEMPTS - record.attempts} تلاش باقیمانده)`,
    };
  }

  // Valid! Remove used OTP to avoid replay attacks
  otpStore.delete(phone);

  return {
    success: true,
    message: 'احراز هویت با موفقیت انجام شد.',
    phone,
  };
}

/**
 * Sends order status change notification SMS with automatic email fallback
 */
export async function sendOrderStatusSms(
  phone: string,
  orderNumber: string,
  statusFarsi: string,
  accountEmail?: string | null
): Promise<boolean> {
  const maskedPhone = maskPhoneNumber(phone);
  const message = `پروفارم شیراز\nمشتری گرامی، وضعیت سفارش ${orderNumber} به «${statusFarsi}» تغییر یافت.\nپیگیری: profarm.ir`;
  let smsFailed = false;

  try {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[SMS Notification DEV] To: ${maskedPhone} | Content:\n${message}`);
    } else {
      console.log(`[SMS Notification] Order ${orderNumber} status SMS sent to ${maskedPhone}`);
    }
    const realSend = await dispatchRealSms(phone, message);
    if (!realSend.success) smsFailed = true;
  } catch (err) {
    console.warn('[SMS Notification Failed, Triggering Email Fallback]', err);
    smsFailed = true;
  }

  // Automatic Email Fallback
  if ((smsFailed || accountEmail) && accountEmail && isValidEmail(accountEmail)) {
    try {
      await triggerFallbackEmail({
        to: accountEmail,
        subject: `بروزرسانی وضعیت سفارش ${orderNumber} - مزارع ارگانیک پروفارم شیراز`,
        text: message,
        fallbackForSms: true,
      });
    } catch (emailErr) {
      console.warn('[sendOrderStatusSms Email Fallback Failed]', emailErr);
    }
  }

  return true;
}

/**
 * Sends custom automated event-triggered SMS with automatic email fallback
 */
export async function sendCustomSms(
  phone: string,
  message: string,
  accountEmail?: string | null
): Promise<boolean> {
  const maskedPhone = maskPhoneNumber(phone);
  let smsFailed = false;

  try {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[AUTOMATED EVENT SMS DEV] To: ${maskedPhone} | Content:\n${message}`);
    } else {
      console.log(`[AUTOMATED EVENT SMS] Dispatched custom event SMS to ${maskedPhone}`);
    }
    const realSend = await dispatchRealSms(phone, message);
    if (!realSend.success) smsFailed = true;
  } catch (err) {
    console.warn('[AUTOMATED EVENT SMS Failed, Triggering Email Fallback]', err);
    smsFailed = true;
  }

  // Automatic Email Fallback
  if ((smsFailed || accountEmail) && accountEmail && isValidEmail(accountEmail)) {
    try {
      await triggerFallbackEmail({
        to: accountEmail,
        subject: 'پیام اختصاصی از مزارع ارگانیک پروفارم شیراز',
        text: message,
        fallbackForSms: true,
      });
    } catch (e) {
      console.warn('[sendCustomSms Email Fallback Failed]', e);
    }
  }

  return true;
}
