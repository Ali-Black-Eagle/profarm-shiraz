import { NextRequest, NextResponse } from 'next/server';
import { farmStore } from '@/lib/db-store';
import { getSessionFromRequest } from '@/lib/session';
import { checkDistributedRateLimit } from '@/lib/sms';
import { normalizePhoneNumber } from '@/lib/formatters';

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json(
      { success: false, message: 'دسترسی غیرمجاز: مشاهده استعلام‌های عمده منحصراً در اختیار مدیر است.' },
      { status: 403 }
    );
  }

  const inquiries = farmStore.getBulkInquiries();
  return NextResponse.json({ success: true, inquiries });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { success: false, message: 'بدنه درخواست نامعتبر است (فرمت JSON معتبر نیست).' },
        { status: 400 }
      );
    }
    const { name, phone, companyName, city, message } = body;

    if (!name || !phone || !city || !message) {
      return NextResponse.json(
        { success: false, message: 'لطفاً تمام فیلدهای الزامی را تکمیل نمایید.' },
        { status: 400 }
      );
    }

    const cleanPhone = normalizePhoneNumber(phone);
    if (!cleanPhone || cleanPhone.length < 10) {
      return NextResponse.json(
        { success: false, message: 'شماره تلفن وارد شده معتبر نیست.' },
        { status: 400 }
      );
    }

    // SECURITY: Rate limiting - Max 5 inquiries per 15 minutes per IP/Phone
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'anon';
    const rateCheck = await checkDistributedRateLimit(`inquiry:${cleanPhone || ip}`, 5, 900);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: `تعداد درخواست‌های استعلام شما بیش از حد مجاز است. لطفاً ${rateCheck.retryAfterSeconds} ثانیه دیگر مجدداً تلاش نمایید.`,
        },
        { status: 429 }
      );
    }

    const inquiry = farmStore.createBulkInquiry({
      name: escapeHtml(String(name).trim()).slice(0, 100),
      phone: cleanPhone,
      companyName: companyName ? escapeHtml(String(companyName).trim()).slice(0, 150) : undefined,
      city: escapeHtml(String(city).trim()).slice(0, 80),
      message: escapeHtml(String(message).trim()).slice(0, 2000),
    });

    return NextResponse.json({ success: true, inquiry });
  } catch (error: any) {
    console.error('Bulk inquiry submission error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'خطا در ثبت استعلام عمده' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'دسترسی غیرمجاز: تغییر وضعیت استعلام تنها توسط مدیر مجاز است.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { success: false, message: 'شناسه و وضعیت استعلام الزامی است.' },
        { status: 400 }
      );
    }

    const updated = farmStore.updateBulkInquiryStatus(id, status);
    if (!updated) {
      return NextResponse.json(
        { success: false, message: 'استعلام مورد نظر یافت نشد.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, inquiry: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'خطای سرور در ویرایش وضعیت استعلام' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'دسترسی غیرمجاز: حذف استعلام تنها توسط مدیر مجاز است.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'شناسه استعلام الزامی است.' },
        { status: 400 }
      );
    }

    farmStore.deleteBulkInquiry(id);
    return NextResponse.json({ success: true, message: 'استعلام با موفقیت حذف شد.' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'خطای سرور در حذف استعلام' },
      { status: 500 }
    );
  }
}
