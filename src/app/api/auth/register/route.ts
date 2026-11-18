import { NextRequest, NextResponse } from 'next/server';
import { farmStore, sanitizeUser } from '@/lib/db-store';
import { setSessionCookie, verifyPhoneProof } from '@/lib/session';
import { normalizePhoneNumber } from '@/lib/formatters';
import { isValidEmail } from '@/lib/email';
import { apiErrorResponse } from '@/lib/api-errors';
import type { User } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { name, email, phone, password, phoneProof } = body;

    const cleanName = (typeof name === 'string' ? name : '').trim();
    const cleanEmail = (typeof email === 'string' ? email : '').trim().toLowerCase();
    const cleanPhone = typeof phone === 'string' && phone.trim() ? normalizePhoneNumber(phone) : '';
    const cleanPassword = (typeof password === 'string' ? password : '').trim();

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

    // A phone account created by OTP sign-in (POST /api/auth/otp verify) has no password yet.
    // The OTP-verified owner completes it here instead of getting a 409.
    const existingPhoneUser = cleanPhone ? farmStore.getUserByPhone(cleanPhone) : undefined;
    let user: User;
    if (existingPhoneUser && !existingPhoneUser.password) {
      const completed = farmStore.completePhoneRegistration(existingPhoneUser.id, {
        name: cleanName,
        email: cleanEmail || undefined,
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
      // Auto username: email or phone (no separate username field needed)
      const autoUsername = cleanEmail || cleanPhone;

      user = farmStore.registerUser({
        name: cleanName,
        email: cleanEmail || undefined,
        phone: cleanPhone || undefined,
        phoneVerified: Boolean(cleanPhone),
        username: autoUsername,
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
      phone: user.phone || '',
      name: user.name || cleanName,
      role: user.role,
      tier: user.tier,
      isProMember: user.isProMember,
    });

    return res;
  } catch (error: unknown) {
    return apiErrorResponse(error, 'auth/register', 'خطا در ثبت‌نام و ساخت حساب کاربری');
  }
}
