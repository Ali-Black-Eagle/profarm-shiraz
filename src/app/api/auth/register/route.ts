import { NextRequest, NextResponse } from 'next/server';
import { farmStore, sanitizeUser } from '@/lib/db-store';
import { setSessionCookie, verifyPhoneProof } from '@/lib/session';
import { getSecureClientIp, normalizePhoneNumber, toEnglishDigits } from '@/lib/formatters';
import { isValidEmail } from '@/lib/email';
import { consumeEmailCode } from '@/lib/email-verification';
import { checkDistributedRateLimit } from '@/lib/sms';
import { apiErrorResponse } from '@/lib/api-errors';
import { getEffectiveTier } from '@/lib/subscription';
import type { User } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { name, email, phone, password, phoneProof, emailCode } = body;

    const rawName = typeof name === 'string' ? name : '';
    const rawEmail = typeof email === 'string' ? email : '';
    const rawPassword = typeof password === 'string' ? password : '';
    if (rawName.length > 100 || rawEmail.length > 254 || rawPassword.length > 128) {
      return NextResponse.json(
        { success: false, message: 'طول یکی از فیلدها بیش از حد مجاز است.' },
        { status: 400 }
      );
    }

    const cleanName = rawName.trim();
    const cleanEmail = rawEmail.trim().toLowerCase();
    const cleanPhone = typeof phone === 'string' && phone.trim() ? normalizePhoneNumber(phone) : '';
    const cleanPassword = rawPassword.trim();

    // Registration abuse limits: per IP (only when the IP is known), per phone and per email, and a global cap.
    // Checked before any account lookup or password hashing.
    const ip = getSecureClientIp(req);
    const limitChecks = [
      checkDistributedRateLimit('register_global', 60, 600),
      ip !== 'unknown' ? checkDistributedRateLimit(`register_ip:${ip}`, 5, 600) : null,
      cleanPhone ? checkDistributedRateLimit(`register_phone:${cleanPhone}`, 5, 600) : null,
      cleanEmail ? checkDistributedRateLimit(`register_email:${cleanEmail}`, 5, 600) : null,
    ];
    for (const check of limitChecks) {
      if (!check) continue;
      const result = await check;
      if (!result.allowed) {
        const retry = Math.max(1, Math.ceil(Number(result.retryAfterSeconds) || 60));
        return NextResponse.json(
          {
            success: false,
            message: `تعداد درخواست‌های ثبت‌نام بیش از حد مجاز است. لطفاً ${retry} ثانیه دیگر مجدداً تلاش نمایید.`,
          },
          { status: 429, headers: { 'Retry-After': String(retry) } }
        );
      }
    }

    if (!cleanName || cleanName.length < 2) {
      return NextResponse.json(
        { success: false, message: 'لطفاً نام و نام خانوادگی خود را کامل وارد فرمایید.' },
        { status: 400 }
      );
    }

    if (!cleanEmail && !cleanPhone) {
      return NextResponse.json(
        { success: false, message: 'آدرس پست الکترونیک (ایمیل) معتبر الزامی است.' },
        { status: 400 }
      );
    }

    // SECURITY: a phone number can only be attached to a new account after an OTP verification
    // for that exact number (phoneProof issued by POST /api/auth/otp, valid for 10 minutes).
    if (cleanPhone && !verifyPhoneProof(phoneProof, cleanPhone)) {
      return NextResponse.json(
        { success: false, message: 'شماره همراه شما تایید نشده است. لطفاً ابتدا شماره خود را با کد پیامکی تایید کنید.' },
        { status: 400 }
      );
    }

    if (cleanEmail && !isValidEmail(cleanEmail)) {
      return NextResponse.json(
        { success: false, message: 'فرمت آدرس ایمیل نامعتبر است (مانند user@example.com).' },
        { status: 400 }
      );
    }

    if (cleanPassword && cleanPassword.length < 8) {
      return NextResponse.json(
        { success: false, message: 'رمز عبور باید حداقل ۸ کاراکتر باشد.' },
        { status: 400 }
      );
    }

    // SECURITY: an email is stored only after its 6-digit code was entered (POST /api/auth/email/register-code).
    // Without a valid code the account is not created. A valid code is used up, so it cannot create a second account.
    if (cleanEmail) {
      const codeDigits = toEnglishDigits(typeof emailCode === 'string' ? emailCode : '').replace(/\D/g, '');
      if (!/^\d{6}$/.test(codeDigits)) {
        return NextResponse.json(
          { success: false, message: 'برای ثبت ایمیل، کد تایید ۶ رقمی ارسال‌شده به آن را وارد نمایید.' },
          { status: 400 }
        );
      }
      const codeCheck = consumeEmailCode('register', cleanEmail, codeDigits, null);
      if (!codeCheck.ok) {
        return NextResponse.json({ success: false, message: codeCheck.message }, { status: 400 });
      }
    }
    const emailVerified = Boolean(cleanEmail);

    // A phone account created by OTP sign-in (POST /api/auth/otp verify) has no password yet.
    // The OTP-verified owner completes it here instead of getting a 409.
    const existingPhoneUser = cleanPhone ? farmStore.getUserByPhone(cleanPhone) : undefined;
    let user: User;
    if (existingPhoneUser && !existingPhoneUser.password) {
      const completed = farmStore.completePhoneRegistration(existingPhoneUser.id, {
        name: cleanName,
        email: cleanEmail || undefined,
        emailVerified,
        password: cleanPassword || undefined,
      });
      if (!completed.success || !completed.user) {
        return NextResponse.json(
          { success: false, message: completed.message || 'خطا در تکمیل ثبت‌نام' },
          { status: completed.status || 409 }
        );
      }
      user = completed.user;
    } else {
      // No username is derived from the email or phone: the store generates a unique `user_` name
      user = farmStore.registerUser({
        name: cleanName,
        email: cleanEmail || undefined,
        emailVerified,
        phone: cleanPhone || undefined,
        phoneVerified: Boolean(cleanPhone),
        password: cleanPassword || undefined,
      });
    }

    const safeUser = sanitizeUser(user);
    const res = NextResponse.json({
      success: true,
      message: `حساب کاربری «${cleanName}» با موفقیت ایجاد شد. خوش آمدید!`,
      user: safeUser,
    });

    setSessionCookie(res, {
      userId: user.id,
      sv: user.sessionVersion ?? 0,
      phone: user.phone || '',
      name: user.name || cleanName,
      role: user.role,
      tier: getEffectiveTier(user),
      isProMember: getEffectiveTier(user) === 'PRO',
    });

    return res;
  } catch (error: unknown) {
    return apiErrorResponse(error, 'auth/register', 'خطا در ثبت‌نام و ساخت حساب کاربری');
  }
}
