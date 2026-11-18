import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { farmStore } from '@/lib/db-store';
import { requireAdmin } from '@/lib/admin-auth';
import { apiErrorResponse } from '@/lib/api-errors';
import {
  jsonError,
  jsonOk,
  normalizeNumeric,
  pageParams,
  paginate,
  parseWith,
  readObjectBody,
  textField,
} from '@/lib/admin-api';
import { canTransitionReturn } from '@/lib/order-utils';
import { normalizePhoneNumber, toEnglishDigits } from '@/lib/formatters';
import { normalizeSearchText } from '@/lib/public-api';
import type { ReturnRequest, ReturnStatus } from '@/types';

export const dynamic = 'force-dynamic';

const RETURN_STATUSES: ReturnStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'REFUNDED'];

const patchSchema = z.object({
  id: textField(200, 'شناسه مرجوعی'),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'REFUNDED'], {
    errorMap: () => ({ message: 'وضعیت مرجوعی نامعتبر است' }),
  }),
  refundAmount: z.preprocess(normalizeNumeric, z.number().int().min(0).max(1_000_000_000_000).optional()).optional(),
  adminNote: z.string().trim().max(1000, 'یادداشت مدیر نمی‌تواند بیشتر از ۱۰۰۰ نویسه باشد').nullable().optional(),
});

function matchesReturn(request: ReturnRequest, rawQuery: string): boolean {
  const query = rawQuery.trim();
  if (!query) return true;
  const digits = toEnglishDigits(query).replace(/\s+/g, '');
  if (request.orderNumber.toLowerCase().includes(query.toLowerCase())) return true;
  if (/^\d{3,}$/.test(digits) && normalizePhoneNumber(request.customerPhone || '').includes(digits)) return true;
  return normalizeSearchText(request.customerName || '').includes(normalizeSearchText(query));
}

export async function GET(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'ALL';
    const q = searchParams.get('q') || '';

    const all = farmStore.getReturnRequests();
    const counts: Record<ReturnStatus, number> = { PENDING: 0, APPROVED: 0, REJECTED: 0, REFUNDED: 0 };
    all.forEach((r) => {
      if (counts[r.status] !== undefined) counts[r.status]++;
    });

    let list = all;
    if (status !== 'ALL') {
      if (!RETURN_STATUSES.includes(status as ReturnStatus)) return jsonError(400, 'وضعیت فیلتر نامعتبر است.');
      list = list.filter((r) => r.status === status);
    }
    if (q) list = list.filter((r) => matchesReturn(r, q));

    const { page, pageSize } = pageParams(searchParams, { pageSize: 20, maxPageSize: 100 });
    const { items, pagination } = paginate(list, page, pageSize);
    return jsonOk({ returns: items, pagination, counts });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/returns GET', 'خطا در دریافت درخواست‌های مرجوعی');
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await readObjectBody(req);
    const parsed = parseWith(patchSchema, body ?? {});
    if ('response' in parsed) return parsed.response;
    const { id, status, refundAmount, adminNote } = parsed.data;

    const existing = farmStore.getReturnRequests().find((r) => r.id === id);
    if (!existing) return jsonError(404, 'درخواست مرجوعی مورد نظر یافت نشد.');

    const transition = canTransitionReturn(existing.status, status);
    if (!transition.allowed) return jsonError(409, transition.reason || 'تغییر وضعیت مرجوعی مجاز نیست.');

    if (refundAmount !== undefined && existing.status === 'REFUNDED' && refundAmount !== existing.refundAmount) {
      return jsonError(409, 'مبلغ عودت پس از ثبت عودت وجه قابل تغییر نیست.');
    }
    if (refundAmount !== undefined && refundAmount > 0 && status === 'REJECTED') {
      return jsonError(400, 'برای درخواست رد شده مبلغ عودت ثبت نمی‌شود.');
    }

    // The store checks the refund cap (not more than the amount paid) before it changes anything.
    const updated = farmStore.updateReturnStatus(id, status, adminNote === undefined ? undefined : adminNote ?? '', {
      refundAmount,
    });
    if (!updated) return jsonError(404, 'درخواست مرجوعی مورد نظر یافت نشد.');
    return jsonOk({ request: updated });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/returns PATCH', 'خطا در بروزرسانی درخواست مرجوعی');
  }
}
