/**
 * Email ownership codes (server only).
 *
 * A 6-digit code is sent to the address being claimed. Entering it proves that the requester controls
 * that mailbox. Codes live in memory only (globalThis singleton, like the OTP store in sms.ts):
 * - stored as sha256(salt + ':' + code), never in plain text
 * - valid for 15 minutes
 * - at most 5 wrong attempts per code, then the code is discarded
 * - one live code per (purpose, address); a new request replaces the old code
 * - a 'change' code is bound to the account that requested it
 */
import 'server-only';
import crypto from 'crypto';
import { checkDistributedRateLimit } from './sms';
import { sendEmail, isEmailDeliveryMock } from './email';
import { toPersianDigits } from './formatters';

export type EmailCodePurpose = 'change' | 'register';

const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
// Upper bound for the in-memory map (addresses can be rotated by an attacker)
const MAX_ENTRIES = 5000;

interface StoredEmailCode {
  salt: string;
  hash: string;
  expiresAt: number;
  attempts: number;
  /** Account that requested the code ('change'); null for 'register'. */
  userId: string | null;
}

const g = (typeof globalThis !== 'undefined' ? globalThis : global) as unknown as {
  __PROFARM_EMAIL_CODE_STORE__?: Map<string, StoredEmailCode>;
};
const codeStore =
  g.__PROFARM_EMAIL_CODE_STORE__ || (g.__PROFARM_EMAIL_CODE_STORE__ = new Map<string, StoredEmailCode>());

function storeKey(purpose: EmailCodePurpose, email: string): string {
  return `${purpose}:${email.trim().toLowerCase()}`;
}

function hashCode(salt: string, code: string): string {
  return crypto.createHash('sha256').update(`${salt}:${code}`).digest('hex');
}

function sweepExpired(now: number): void {
  for (const [key, record] of codeStore.entries()) {
    if (now > record.expiresAt) codeStore.delete(key);
  }
  while (codeStore.size >= MAX_ENTRIES) {
    const oldest = codeStore.keys().next().value;
    if (oldest === undefined) break;
    codeStore.delete(oldest);
  }
}

/** Creates a new code for (purpose, email), replacing any earlier one. Returns the plain code (send it, never store it). */
export function createEmailCode(purpose: EmailCodePurpose, email: string, userId: string | null): string {
  const now = Date.now();
  const key = storeKey(purpose, email);
  codeStore.delete(key);
  if (codeStore.size >= MAX_ENTRIES) sweepExpired(now);
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const salt = crypto.randomBytes(16).toString('hex');
  codeStore.set(key, {
    salt,
    hash: hashCode(salt, code),
    expiresAt: now + CODE_TTL_MS,
    attempts: 0,
    userId,
  });
  return code;
}

export function discardEmailCode(purpose: EmailCodePurpose, email: string): void {
  codeStore.delete(storeKey(purpose, email));
}

export type ConsumeEmailCodeResult = { ok: true } | { ok: false; message: string };

/**
 * Checks a submitted code. A correct code is used up (one-time). A wrong one counts as an attempt; the fifth
 * wrong attempt discards the code. `userId` must match the account that requested a 'change' code.
 */
export function consumeEmailCode(
  purpose: EmailCodePurpose,
  email: string,
  code: unknown,
  userId: string | null
): ConsumeEmailCodeResult {
  const key = storeKey(purpose, email);
  const record = codeStore.get(key);
  const missing = 'کد تاییدی برای این ایمیل ثبت نشده یا منقضی شده است. لطفاً کد جدید دریافت کنید.';

  if (!record) return { ok: false, message: missing };
  if (Date.now() > record.expiresAt) {
    codeStore.delete(key);
    return { ok: false, message: 'کد تایید ایمیل منقضی شده است. لطفاً کد جدید دریافت کنید.' };
  }
  if (record.userId !== userId) {
    return { ok: false, message: 'کد تاییدی برای این حساب کاربری ثبت نشده است. لطفاً کد جدید دریافت کنید.' };
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    codeStore.delete(key);
    return { ok: false, message: 'تعداد تلاش‌های نادرست بیش از حد مجاز بود. لطفاً کد جدید دریافت کنید.' };
  }

  const clean = typeof code === 'string' ? code.trim() : '';
  const candidate = Buffer.from(hashCode(record.salt, clean));
  const expected = Buffer.from(record.hash);
  const matches =
    /^\d{6}$/.test(clean) && candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);

  if (!matches) {
    record.attempts += 1;
    if (record.attempts >= MAX_ATTEMPTS) {
      codeStore.delete(key);
      return { ok: false, message: 'تعداد تلاش‌های نادرست بیش از حد مجاز بود. لطفاً کد جدید دریافت کنید.' };
    }
    const left = MAX_ATTEMPTS - record.attempts;
    return { ok: false, message: `کد وارد شده نادرست است. (${toPersianDigits(left)} تلاش باقی‌مانده)` };
  }

  codeStore.delete(key);
  return { ok: true };
}

export interface EmailCodeRequestResult {
  success: boolean;
  status: number;
  message: string;
  retryAfterSeconds?: number;
  /** Only in non-production runs without live SMTP (MOCK mode), same pattern as the SMS OTP debugCode. */
  debugCode?: string;
}

/** The code is shown in the response only outside production and only when no real mail is sent. */
function canExposeDebugCode(): boolean {
  return process.env.NODE_ENV !== 'production' && isEmailDeliveryMock();
}

const SUBJECTS: Record<EmailCodePurpose, string> = {
  change: 'کد تایید آدرس ایمیل حساب کاربری پروفارم شیراز',
  register: 'کد تایید ثبت‌نام با ایمیل پروفارم شیراز',
};

/** Success text of a code request. Also used when an address is taken, so the answer does not reveal the account. */
export const EMAIL_CODE_SENT_MESSAGE = 'کد تایید ۶ رقمی به آدرس ایمیل شما ارسال شد. این کد تا ۱۵ دقیقه معتبر است.';

/**
 * Rate-limits, creates and sends a code to `email` (already trimmed and lower-cased, format checked by the caller).
 * Limits: 3 codes per address per 15 minutes; 10 per account per hour (when signed in); 10 per IP per hour
 * (skipped when the IP is unknown, like the other routes); 200 per hour across all addresses.
 * In production without a live SMTP provider no code is created at all (503): a code that cannot be delivered
 * is never issued.
 */
export async function requestEmailCode(input: {
  purpose: EmailCodePurpose;
  email: string;
  userId: string | null;
  ip: string;
  recipientName?: string;
}): Promise<EmailCodeRequestResult> {
  const { purpose, email, userId, ip, recipientName } = input;

  if (process.env.NODE_ENV === 'production' && isEmailDeliveryMock()) {
    return {
      success: false,
      status: 503,
      message: 'ارسال ایمیل در حال حاضر امکان‌پذیر نیست.',
    };
  }

  const checks: Array<Promise<{ allowed: boolean; retryAfterSeconds?: number }> | null> = [
    checkDistributedRateLimit('email_code_global', 200, 60 * 60),
    checkDistributedRateLimit(`email_code_addr:${email}`, 3, 15 * 60),
    userId ? checkDistributedRateLimit(`email_code_user:${userId}`, 10, 60 * 60) : null,
    ip !== 'unknown' ? checkDistributedRateLimit(`email_code_ip:${ip}`, 10, 60 * 60) : null,
  ];
  for (const check of checks) {
    if (!check) continue;
    const result = await check;
    if (!result.allowed) {
      const retry = Math.max(1, Math.ceil(Number(result.retryAfterSeconds) || 60));
      return {
        success: false,
        status: 429,
        retryAfterSeconds: retry,
        message: `تعداد درخواست‌های کد تایید ایمیل بیش از حد مجاز است. لطفاً ${toPersianDigits(retry)} ثانیه دیگر مجدداً تلاش نمایید.`,
      };
    }
  }

  const code = createEmailCode(purpose, email, userId);
  const sent = await sendEmail({
    to: email,
    recipientName,
    subject: SUBJECTS[purpose],
    text: `کد تایید ایمیل شما: ${code}\n\nاین کد تا ۱۵ دقیقه معتبر است. اگر این درخواست از سوی شما نبوده، این پیام را نادیده بگیرید و کسی را از کد آگاه نکنید.`,
    sensitive: true,
  });
  if (!sent.success) {
    discardEmailCode(purpose, email);
    return {
      success: false,
      status: 502,
      message: 'ارسال کد تایید به ایمیل با خطا مواجه شد. لطفاً دقایقی دیگر دوباره تلاش نمایید.',
    };
  }

  return {
    success: true,
    status: 200,
    message: EMAIL_CODE_SENT_MESSAGE,
    debugCode: canExposeDebugCode() ? code : undefined,
  };
}
