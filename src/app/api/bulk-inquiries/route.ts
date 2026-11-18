import { NextRequest, NextResponse } from 'next/server';
import { farmStore } from '@/lib/db-store';
import { requireAdmin } from '@/lib/admin-auth';
import { checkDistributedRateLimit } from '@/lib/sms';
import { normalizePhoneNumber, getSecureClientIp, isValidIranPhone, toEnglishDigits } from '@/lib/formatters';
import { apiErrorResponse } from '@/lib/api-errors';

const BULK_STATUSES = ['PENDING', 'REVIEWED', 'COMPLETED'];

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

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
    const { name, phone, companyName, city, message } = body as Record<string, unknown>;

    // Trim first: whitespace-only values count as empty. Persian messages are shown field by field in the form.
    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanCity = typeof city === 'string' ? city.trim() : '';
    const cleanMessage = typeof message === 'string' ? message.trim() : '';
    const cleanCompany = typeof companyName === 'string' ? companyName.trim() : '';
    if (!cleanName || !cleanCity || !cleanMessage) {
      return NextResponse.json(
        { success: false, message: 'لطفاً تمام فیلدهای الزامی را تکمیل نمایید.' },
        { status: 400 }
      );
    }
    if (cleanName.length > 100 || cleanCity.length > 80 || cleanMessage.length > 2000 || cleanCompany.length > 150) {
      return NextResponse.json(
        { success: false, message: 'طول یکی از فیلدها بیش از حد مجاز است.' },
        { status: 400 }
      );
    }

    const rawPhone = typeof phone === 'string' ? toEnglishDigits(phone).trim() : '';
    if (!rawPhone || !isValidIranPhone(rawPhone)) {
      return NextResponse.json(
        { success: false, message: 'شماره تلفن وارد شده معتبر نیست. نمونه صحیح: ۰۹۱۲۳۴۵۶۷۸۹' },
        { status: 400 }
      );
    }
    const cleanPhone = normalizePhoneNumber(rawPhone);

    // SECURITY: rate limits by phone (5 per 15 minutes) AND by client IP (20 per 15 minutes), so rotating
    // phone numbers cannot flood the wholesale desk. The IP is spoof-resistant (see getSecureClientIp).
    const ip = getSecureClientIp(req);
    const phoneCheck = await checkDistributedRateLimit(`inquiry:${cleanPhone}`, 5, 900);
    const ipCheck = await checkDistributedRateLimit(`inquiry-ip:${ip}`, 20, 900);
    const blocked = !phoneCheck.allowed ? phoneCheck : !ipCheck.allowed ? ipCheck : null;
    if (blocked) {
      return NextResponse.json(
        {
          success: false,
          message: `تعداد درخواست‌های استعلام شما بیش از حد مجاز است. لطفاً ${blocked.retryAfterSeconds} ثانیه دیگر مجدداً تلاش نمایید.`,
        },
        { status: 429 }
      );
    }

    const inquiry = farmStore.createBulkInquiry({
      name: escapeHtml(cleanName).slice(0, 100),
      phone: cleanPhone,
      companyName: cleanCompany ? escapeHtml(cleanCompany).slice(0, 150) : undefined,
      city: escapeHtml(cleanCity).slice(0, 80),
      message: escapeHtml(cleanMessage).slice(0, 2000),
    });

    return NextResponse.json({ success: true, inquiry });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'bulk-inquiries POST', 'خطا در ثبت استعلام عمده');
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json().catch(() => null);
    const { id, status } = body && typeof body === 'object' ? body : ({} as Record<string, unknown>);

    if (!id || !status) {
      return NextResponse.json(
        { success: false, message: 'شناسه و وضعیت استعلام الزامی است.' },
        { status: 400 }
      );
    }
    if (!BULK_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, message: 'وضعیت استعلام نامعتبر است (PENDING، REVIEWED یا COMPLETED).' },
        { status: 400 }
      );
    }

    const updated = farmStore.updateBulkInquiryStatus(String(id), status);
    if (!updated) {
      return NextResponse.json(
        { success: false, message: 'استعلام مورد نظر یافت نشد.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, inquiry: updated });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'bulk-inquiries PATCH', 'خطای سرور در ویرایش وضعیت استعلام');
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'شناسه استعلام الزامی است.' },
        { status: 400 }
      );
    }

    if (!farmStore.deleteBulkInquiry(id)) {
      return NextResponse.json(
        { success: false, message: 'استعلام مورد نظر یافت نشد.' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, message: 'استعلام با موفقیت حذف شد.' });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'bulk-inquiries DELETE', 'خطای سرور در حذف استعلام');
  }
}
