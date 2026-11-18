import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { farmStore } from '@/lib/db-store';
import { requireAdmin } from '@/lib/admin-auth';
import { apiErrorResponse } from '@/lib/api-errors';
import { jsonError, jsonOk, pageParams, paginate, parseWith, readObjectBody, textField } from '@/lib/admin-api';
import type { ProductReview, ReviewStatus } from '@/types';

export const dynamic = 'force-dynamic';

const REVIEW_STATUSES: ReviewStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

const patchSchema = z.object({
  id: textField(200, 'شناسه دیدگاه'),
  status: z.enum(['APPROVED', 'REJECTED'], {
    error: 'وضعیت دیدگاه باید «APPROVED» یا «REJECTED» باشد',
  }),
  adminReply: z.string().trim().max(1000, 'پاسخ مدیر نمی‌تواند بیشتر از ۱۰۰۰ نویسه باشد').nullable().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'ALL';
    const productSlug = searchParams.get('productSlug')?.trim() || '';
    const q = (searchParams.get('q') || '').trim().toLowerCase();

    const all = farmStore.getAllReviews();
    const counts: Record<ReviewStatus, number> = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
    all.forEach((r) => {
      if (counts[r.status] !== undefined) counts[r.status]++;
    });

    let list: ProductReview[] = all;
    if (status !== 'ALL') {
      if (!REVIEW_STATUSES.includes(status as ReviewStatus)) return jsonError(400, 'وضعیت فیلتر نامعتبر است.');
      list = list.filter((r) => r.status === status);
    }
    if (productSlug) list = list.filter((r) => r.productSlug === productSlug || r.productId === productSlug);
    if (q) {
      list = list.filter((r) =>
        [r.userName, r.userPhone || '', r.comment, r.title || '', r.productTitle, r.orderId || ''].some((value) =>
          value.toLowerCase().includes(q)
        )
      );
    }

    const { page, pageSize } = pageParams(searchParams, { pageSize: 20, maxPageSize: 100 });
    const { items, pagination } = paginate(list, page, pageSize);
    return jsonOk({ reviews: items, pagination, counts });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/reviews GET', 'خطا در دریافت دیدگاه‌ها');
  }
}

/** DELETE ?id= removes a review permanently. The customer's order is not affected. */
export async function DELETE(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const id = (new URL(req.url).searchParams.get('id') || '').trim();
    if (!id) return jsonError(400, 'شناسه دیدگاه الزامی است.');
    if (!farmStore.deleteReview(id)) return jsonError(404, 'دیدگاه مورد نظر یافت نشد.');
    return jsonOk({ message: 'دیدگاه به طور کامل حذف شد.' });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/reviews DELETE', 'خطا در حذف دیدگاه');
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await readObjectBody(req);
    const parsed = parseWith(patchSchema, body ?? {});
    if ('response' in parsed) return parsed.response;
    const { id, status, adminReply } = parsed.data;

    const existing = farmStore.getReviewById(id);
    if (!existing) return jsonError(404, 'دیدگاه مورد نظر یافت نشد.');

    // undefined keeps the current reply, null or '' clears it
    const reply = adminReply === undefined ? undefined : adminReply ?? '';
    const review = farmStore.updateReviewStatus(id, status, reply);
    return jsonOk({ review });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/reviews PATCH', 'خطا در بروزرسانی دیدگاه');
  }
}
