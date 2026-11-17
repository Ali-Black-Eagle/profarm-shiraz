import { NextRequest, NextResponse } from 'next/server';
import { farmStore, sanitizeUser } from '@/lib/db-store';
import { setSessionCookie } from '@/lib/session';
import { normalizePhoneNumber } from '@/lib/formatters';
import { isValidEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { name, email, phone, password } = body;

    const cleanName = (name || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPhone = phone ? normalizePhoneNumber(phone) : '';
    const cleanPassword = (password || '').trim();

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

    if (cleanEmail && !isValidEmail(cleanEmail)) {
      return NextResponse.json(
        { success: false, message: 'فرمت آدرس ایمیل نامعتبر است (مانند user@example.com).' },
        { status: 400 }
      );
    }

    if (cleanPassword && cleanPassword.length < 4) {
      return NextResponse.json(
        { success: false, message: 'رمز عبور باید حداقل ۴ کاراکتر باشد.' },
        { status: 400 }
      );
    }

    // Auto username: email or phone (no separate username field needed)
    const autoUsername = cleanEmail || cleanPhone;

    const user = farmStore.registerUser({
      name: cleanName,
      email: cleanEmail || undefined,
      phone: cleanPhone || undefined,
      username: autoUsername,
      password: cleanPassword || undefined,
    });

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
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'خطا در ثبت‌نام و ساخت حساب کاربری' },
      { status: 500 }
    );
  }
}
