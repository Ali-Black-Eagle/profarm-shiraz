import { NextRequest, NextResponse } from 'next/server';
import { sendOtp, verifyOtp, checkDistributedRateLimit } from '@/lib/sms';
import { farmStore, sanitizeUser } from '@/lib/db-store';
import { setSessionCookie, getSessionFromRequest } from '@/lib/session';
import { normalizePhoneNumber, getSecureClientIp } from '@/lib/formatters';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, phone, code, name, fallbackEmail } = body;
    const cleanPhone = normalizePhoneNumber(phone || '');

    if (!cleanPhone) {
      return NextResponse.json(
        { success: false, message: 'شماره تلفن همراه معتبر الزامی است.' },
        { status: 400 }
      );
    }

    const session = getSessionFromRequest(req);

    // Resolve fallback email if available
    let emailForFallback = fallbackEmail;
    if (!emailForFallback && session?.userId) {
      const sessionUser = farmStore.getAllUsers().find((u) => u.id === session.userId);
      if (sessionUser?.email) emailForFallback = sessionUser.email;
    }

    if (action === 'send' || action === 'send-checkout-otp' || action === 'send-checkout-phone') {
      // SECURITY: IP-level rate limiting to prevent SMS toll fraud & SMS bombing (resistant to X-Forwarded-For spoofing)
      const ip = getSecureClientIp(req);
      const ipRateCheck = await checkDistributedRateLimit(`otp_ip:${ip}`, 10, 600);
      if (!ipRateCheck.allowed) {
        return NextResponse.json(
          {
            success: false,
            message: `تعداد درخواست‌های پیامک از این شبکه بیش از حد مجاز است. لطفاً ${ipRateCheck.retryAfterSeconds} ثانیه دیگر مجدداً تلاش نمایید.`,
          },
          { status: 429 }
        );
      }

      const result = await sendOtp(cleanPhone, emailForFallback);
      return NextResponse.json(result);
    }

    // CHECKOUT PHONE VERIFICATION ACTION
    if (action === 'verify-checkout-phone') {
      if (!code) {
        return NextResponse.json(
          { success: false, message: 'کد تایید الزامی است.' },
          { status: 400 }
        );
      }

      const verifyResult = await verifyOtp(cleanPhone, code);
      if (!verifyResult.success) {
        return NextResponse.json(verifyResult, { status: 400 });
      }

      if (!session) {
        return NextResponse.json(
          { success: false, message: 'جهت تایید شماره همراه، ابتدا وارد حساب کاربری شوید.' },
          { status: 401 }
        );
      }

      // Attach verified phone to user
      const attachResult = farmStore.attachVerifiedPhoneToUser(session.userId, cleanPhone);
      if (!attachResult.success || !attachResult.user) {
        return NextResponse.json(
          { success: false, message: attachResult.message || 'خطا در ثبت شماره تلفن' },
          { status: 400 }
        );
      }

      const res = NextResponse.json({
        success: true,
        message: 'شماره همراه شما با موفقیت تایید و در حساب کاربری ثبت شد.',
        user: attachResult.user,
      });

      // Update session cookie with verified phone
      setSessionCookie(res, {
        userId: attachResult.user.id,
        phone: cleanPhone,
        name: attachResult.user.name || 'کاربر گرامی',
        role: attachResult.user.role,
        tier: attachResult.user.tier,
        isProMember: attachResult.user.isProMember,
      });

      return res;
    }

    if (action === 'verify') {
      if (!code) {
        return NextResponse.json(
          { success: false, message: 'کد تایید الزامی است.' },
          { status: 400 }
        );
      }

      // SECURITY: Rate limit verification attempts per IP to prevent brute-force attacks (resistant to spoofing)
      const ip = getSecureClientIp(req);
      const verifyRateCheck = await checkDistributedRateLimit(`otp_verify_ip:${ip}`, 20, 300);
      if (!verifyRateCheck.allowed) {
        return NextResponse.json(
          {
            success: false,
            message: `تعداد تلاش‌های تایید کد بیش از حد مجاز است. لطفاً ${verifyRateCheck.retryAfterSeconds} ثانیه دیگر مجدداً تلاش نمایید.`,
          },
          { status: 429 }
        );
      }

      const verifyResult = await verifyOtp(cleanPhone, code);
      if (!verifyResult.success) {
        return NextResponse.json(verifyResult, { status: 400 });
      }

      // SECURITY: Never allow accounts with ADMIN role to authenticate via OTP alone.
      const existingUser = farmStore.getUserByPhone(cleanPhone);
      if (existingUser && existingUser.role === 'ADMIN') {
        return NextResponse.json(
          { success: false, message: 'برای این حساب کاربری، ورود با کلمه عبور الزامی است.' },
          { status: 403 }
        );
      }

      // Get or create customer user (with optional registered name)
      const user = farmStore.getOrCreateUser(verifyResult.phone || cleanPhone, name);
      if (!user) {
        return NextResponse.json(
          { success: false, message: 'خطا در ثبت یا بازیابی حساب کاربری.' },
          { status: 500 }
        );
      }

      user.isPhoneVerified = true;
      const safeUser = sanitizeUser(user);

      const res = NextResponse.json({
        success: true,
        message: 'ورود موفقیت‌آمیز بود.',
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

    return NextResponse.json(
      { success: false, message: 'عملیات درخواستی نامعتبر است.' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('OTP API Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'خطای سرور' },
      { status: 500 }
    );
  }
}
