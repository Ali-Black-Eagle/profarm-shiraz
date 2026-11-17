import { NextRequest, NextResponse } from 'next/server';
import { farmStore } from '@/lib/db-store';
import { getSessionFromRequest } from '@/lib/session';
import { sendEmail, isValidEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'دسترسی غیرمجاز: ورود به عنوان مدیر ارشد الزامی است.' },
        { status: 403 }
      );
    }

    const logs = farmStore.getEmailLogs();
    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'خطا در بارگذاری تاریخچه ایمیل‌ها' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'دسترسی غیرمجاز: این عملیات منحصراً در اختیار مدیر ارشد سیستم است.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { target, recipientEmail, recipientName, subject, content } = body;

    const cleanSubject = (subject || '').trim();
    const cleanContent = (content || '').trim();

    if (!cleanSubject) {
      return NextResponse.json(
        { success: false, message: 'لطفاً موضوع ایمیل را وارد فرمایید.' },
        { status: 400 }
      );
    }

    if (!cleanContent) {
      return NextResponse.json(
        { success: false, message: 'لطفاً متن پیام ایمیل را وارد فرمایید.' },
        { status: 400 }
      );
    }

    // 1. Single Custom Recipient
    if (target === 'CUSTOM') {
      const cleanEmail = (recipientEmail || '').trim().toLowerCase();
      if (!isValidEmail(cleanEmail)) {
        return NextResponse.json(
          { success: false, message: 'آدرس ایمیل گیرنده نامعتبر است.' },
          { status: 400 }
        );
      }

      const sendResult = await sendEmail({
        to: cleanEmail,
        recipientName: recipientName || undefined,
        subject: cleanSubject,
        text: cleanContent,
      });

      if (!sendResult.success) {
        return NextResponse.json(
          { success: false, message: sendResult.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `ایمیل با موفقیت به ${cleanEmail} ارسال گردید.`,
        countSent: 1,
      });
    }

    // 2. Specific Registered User
    if (target === 'USER') {
      const cleanEmail = (recipientEmail || '').trim().toLowerCase();
      if (!isValidEmail(cleanEmail)) {
        return NextResponse.json(
          { success: false, message: 'کاربر مورد نظر دارای آدرس ایمیل معتبر نمی‌باشد.' },
          { status: 400 }
        );
      }

      const sendResult = await sendEmail({
        to: cleanEmail,
        recipientName: recipientName || undefined,
        subject: cleanSubject,
        text: cleanContent,
      });

      return NextResponse.json({
        success: true,
        message: `ایمیل با موفقیت به کاربر ${recipientName || cleanEmail} ارسال شد.`,
        countSent: 1,
      });
    }

    // 3. Broadcast to All Registered Users with an Email
    if (target === 'ALL') {
      const allUsers = farmStore.getAllUsers();
      const recipients = allUsers.filter(
        (u) => u.email && isValidEmail(u.email)
      );

      if (recipients.length === 0) {
        return NextResponse.json(
          { success: false, message: 'هیچ کاربری با آدرس ایمیل ثبت‌شده در سیستم یافت نشد.' },
          { status: 400 }
        );
      }

      let countSuccess = 0;
      for (const u of recipients) {
        try {
          const res = await sendEmail({
            to: u.email!,
            recipientName: u.name || undefined,
            subject: cleanSubject,
            text: cleanContent,
          });
          if (res.success) countSuccess++;
        } catch (e) {
          console.warn(`[Broadcast Email Error] To: ${u.email}`, e);
        }
      }

      return NextResponse.json({
        success: true,
        message: `ایمیل با موفقیت به ${countSuccess} کاربر ارسال گردید.`,
        countSent: countSuccess,
      });
    }

    return NextResponse.json(
      { success: false, message: 'نوع هدف ارسال ایمیل نامعتبر است.' },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'خطای سرور در ارسال ایمیل' },
      { status: 500 }
    );
  }
}
