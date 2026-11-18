import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { farmStore } from '@/lib/db-store';
import { requireAdmin } from '@/lib/admin-auth';
import { apiErrorResponse } from '@/lib/api-errors';
import { jsonError, jsonOk, parseWith, readObjectBody } from '@/lib/admin-api';
import type { SmsEventType } from '@/types';

export const dynamic = 'force-dynamic';

const EVENT_IDS = [
  'ORDER_PLACED',
  'ORDER_PROCESSING',
  'ORDER_OUT_FOR_DELIVERY',
  'ORDER_DELIVERED',
  'ORDER_CANCELLED',
  'SUBSCRIPTION_ACTIVATED',
  'RETURN_STATUS_CHANGED',
] as const;

const MAX_TEMPLATE_LENGTH = 600;

const templateItem = z.object({
  id: z.enum(EVENT_IDS, { error: 'رویداد پیامک نامعتبر است' }),
  template: z
    .string()
    .trim()
    .min(1, 'متن پیامک نمی‌تواند خالی باشد')
    .max(MAX_TEMPLATE_LENGTH, `متن پیامک نمی‌تواند بیشتر از ${MAX_TEMPLATE_LENGTH} نویسه باشد`)
    .optional(),
  isEnabled: z.boolean().optional(),
});

const bodySchema = z.union([
  z.object({ templates: z.array(templateItem).min(1).max(EVENT_IDS.length) }),
  templateItem,
]);

const resetSchema = z.object({
  action: z.literal('reset'),
  id: z.enum(EVENT_IDS, { error: 'رویداد پیامک نامعتبر است' }),
});

export async function GET(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    return jsonOk({ templates: farmStore.getSmsEventTemplates() });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/sms-templates GET', 'خطا در دریافت قالب‌های پیامک');
  }
}

/**
 * Body: { templates: [{ id, template?, isEnabled? }] } or one { id, template?, isEnabled? }.
 * Body: { action: 'reset', id } restores the default text of one event.
 */
export async function PUT(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await readObjectBody(req);
    if (!body) return jsonError(400, 'اطلاعات ارسالی نامعتبر است.');
    const parsed = parseWith(bodySchema, body);
    if ('response' in parsed) return parsed.response;

    const items = 'templates' in parsed.data ? parsed.data.templates : [parsed.data];
    const known = new Set(farmStore.getSmsEventTemplates().map((t) => t.id as SmsEventType));
    for (const item of items) {
      if (!known.has(item.id)) return jsonError(400, `رویداد «${item.id}» تعریف نشده است.`);
      if (item.template === undefined && item.isEnabled === undefined) {
        return jsonError(400, `برای رویداد «${item.id}» متن یا وضعیت فعال بودن لازم است.`);
      }
    }

    for (const item of items) {
      farmStore.updateSmsEventTemplate(item.id, {
        ...(item.template !== undefined ? { template: item.template } : {}),
        ...(item.isEnabled !== undefined ? { isEnabled: item.isEnabled } : {}),
      });
    }
    return jsonOk({ templates: farmStore.getSmsEventTemplates() });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/sms-templates PUT', 'خطا در ذخیره قالب‌های پیامک');
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await readObjectBody(req);
    const parsed = parseWith(resetSchema, body ?? {});
    if ('response' in parsed) return parsed.response;

    const template = farmStore.resetSmsEventTemplate(parsed.data.id);
    if (!template) return jsonError(404, 'قالب پیامک مورد نظر یافت نشد.');
    return jsonOk({ template, templates: farmStore.getSmsEventTemplates() });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/sms-templates POST', 'خطا در بازنشانی قالب پیامک');
  }
}
