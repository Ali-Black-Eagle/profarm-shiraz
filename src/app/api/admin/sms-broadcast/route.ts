import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { farmStore } from '@/lib/db-store';
import { requireAdmin } from '@/lib/admin-auth';
import { apiErrorResponse } from '@/lib/api-errors';
import { jsonError, jsonOk, pageParams, paginate, parseWith, readObjectBody } from '@/lib/admin-api';
import { checkDistributedRateLimit, dispatchRealSms, getActiveSmsConfig } from '@/lib/sms';
import { getEffectiveTier } from '@/lib/subscription';
import { isValidIranPhone, normalizePhoneNumber } from '@/lib/formatters';
import type { SmsBroadcast, SmsTargetSegment, SubscriptionTier } from '@/types';

export const dynamic = 'force-dynamic';

/** Hard cap per request. A larger audience is refused (never silently truncated). */
const MAX_RECIPIENTS = 500;
const MAX_MESSAGE_LENGTH = 600;
const SEND_CONCURRENCY = 10;

const SEGMENTS: Record<'ALL' | SubscriptionTier, { target: SmsTargetSegment; title: string }> = {
  ALL: { target: 'ALL', title: 'همه کاربران دارای شماره معتبر' },
  FREE: { target: 'FREE_USERS', title: 'کاربران عادی (FREE)' },
  PLUS: { target: 'PLUS_MEMBERS', title: 'اعضای پلاس' },
  PRO: { target: 'PRO_MEMBERS', title: 'اعضای پرو' },
};

const sendSchema = z.object({
  segment: z.enum(['ALL', 'FREE', 'PLUS', 'PRO'], { errorMap: () => ({ message: 'بخش مخاطبان نامعتبر است' }) }),
  message: z
    .string()
    .trim()
    .min(1, 'متن پیام نمی‌تواند خالی باشد')
    .max(MAX_MESSAGE_LENGTH, `متن پیام نمی‌تواند بیشتر از ${MAX_MESSAGE_LENGTH} نویسه باشد`),
  title: z.string().trim().max(120).optional(),
  confirm: z.literal(true, {
    errorMap: () => ({ message: 'برای ارسال، تایید صریح لازم است (confirm: true).' }),
  }),
});

/** Recipients: unique normalized phones of accounts that accept SMS (default yes) and fall in the segment. */
function recipientsFor(segment: 'ALL' | SubscriptionTier): string[] {
  const now = Date.now();
  const phones = new Set<string>();
  for (const user of farmStore.getAllUsers()) {
    if (user.smsNotificationEnabled === false) continue;
    if (!user.phone || !isValidIranPhone(user.phone)) continue;
    if (segment !== 'ALL' && getEffectiveTier(user, now) !== segment) continue;
    phones.add(normalizePhoneNumber(user.phone));
  }
  return Array.from(phones);
}

export async function GET(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);

    // ?segment=ALL|FREE|PLUS|PRO returns how many numbers a broadcast to that segment would reach (no sending).
    const segmentParam = searchParams.get('segment');
    if (segmentParam !== null) {
      if (!(segmentParam in SEGMENTS)) return jsonError(400, 'بخش مخاطبان نامعتبر است.');
      return jsonOk({ segment: segmentParam, recipientCount: recipientsFor(segmentParam as 'ALL' | SubscriptionTier).length });
    }

    const broadcasts = farmStore.getSmsBroadcasts();
    const { page, pageSize } = pageParams(searchParams, { pageSize: 20, maxPageSize: 100 });
    const { items, pagination } = paginate(broadcasts, page, pageSize);
    return jsonOk({ broadcasts: items, pagination });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/sms-broadcast GET', 'خطا در دریافت تاریخچه پیامک‌ها');
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await readObjectBody(req);
    if (!body) return jsonError(400, 'اطلاعات ارسالی نامعتبر است.');
    const parsed = parseWith(sendSchema, body);
    if ('response' in parsed) return parsed.response;
    const { segment, message, confirm: _confirm } = parsed.data;
    const title = parsed.data.title || 'پیام همگانی';

    // A broadcast is a deliberate, costly action. The shared limiter uses its default window (4 requests per 10 minutes
    // per key; its in-memory fallback does not take a custom maximum).
    const rate = await checkDistributedRateLimit(`sms_broadcast:${auth.user.id}`);
    if (!rate.allowed) {
      return jsonError(429, `تعداد ارسال‌های همگانی بیش از حد مجاز است. ${rate.retryAfterSeconds} ثانیه دیگر تلاش کنید.`);
    }

    const config = getActiveSmsConfig();
    const isMock = config.provider === 'MOCK';
    if (!isMock && (!config.isEnabled || !config.apiKey)) {
      return jsonError(409, 'سرویس پیامک فعال یا کامل پیکربندی نشده است. ابتدا تنظیمات پیامک را ذخیره کنید.');
    }

    const recipients = recipientsFor(segment);
    if (recipients.length === 0) {
      return jsonError(400, 'گیرنده‌ای با شماره معتبر و پذیرش پیامک در این بخش وجود ندارد.');
    }
    if (recipients.length > MAX_RECIPIENTS) {
      return jsonError(
        400,
        `تعداد گیرندگان (${recipients.length}) از سقف ${MAX_RECIPIENTS} نفر در هر درخواست بیشتر است. بخش کوچک‌تری را انتخاب کنید.`,
        { recipientCount: recipients.length, limit: MAX_RECIPIENTS }
      );
    }

    // Each recipient is counted by what the dispatcher reports. Nothing is estimated.
    let sentCount = 0;
    let failedCount = 0;
    for (let i = 0; i < recipients.length; i += SEND_CONCURRENCY) {
      const chunk = recipients.slice(i, i + SEND_CONCURRENCY);
      const results = await Promise.all(
        chunk.map(async (phone) => {
          try {
            const result = await dispatchRealSms(phone, message);
            return result.success === true;
          } catch {
            return false;
          }
        })
      );
      for (const ok of results) {
        if (ok) sentCount++;
        else failedCount++;
      }
    }

    const status: SmsBroadcast['status'] =
      sentCount === 0 ? 'FAILED' : failedCount > 0 ? 'PARTIAL' : 'SENT';

    const broadcast = farmStore.createSmsBroadcast({
      title,
      message,
      targetSegment: SEGMENTS[segment].target,
      targetSegmentTitle: SEGMENTS[segment].title,
      recipientCount: recipients.length,
      sentCount,
      failedCount,
      status,
      provider: config.provider,
      sentBy: auth.user.id,
    });

    return jsonOk(
      {
        broadcast,
        recipientCount: recipients.length,
        sentCount,
        failedCount,
        mode: isMock ? 'MOCK' : 'LIVE',
      },
      201
    );
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/sms-broadcast POST', 'خطا در ارسال پیام همگانی');
  }
}
