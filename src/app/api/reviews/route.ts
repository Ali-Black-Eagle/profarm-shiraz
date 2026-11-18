import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { farmStore } from '@/lib/db-store';
import { requireUser } from '@/lib/user-auth';
import { apiErrorResponse } from '@/lib/api-errors';
import { withOrderLock } from '@/lib/order-lock';
import { publicReview } from '@/lib/public-api';

export const dynamic = 'force-dynamic';

const reviewSchema = z.object({
  productSlug: z.string().trim().min(1).max(200),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  comment: z.string().trim().min(3, 'متن دیدگاه کوتاه است.').max(2000),
  pros: z.array(z.string().trim().max(100)).max(10).optional(),
  cons: z.array(z.string().trim().max(100)).max(10).optional(),
  isRecommended: z.boolean().optional(),
});

/**
 * GET /api/reviews?productSlug=<slug>
 * Approved reviews of one product, newest first, with the aggregate rating { average, count }.
 */
export async function GET(req: NextRequest) {
  try {
    const productSlug = new URL(req.url).searchParams.get('productSlug')?.trim() || '';
    if (!productSlug) {
      return NextResponse.json({ success: false, message: 'شناسه محصول (productSlug) الزامی است.' }, { status: 400 });
    }

    const product = farmStore.getProductBySlug(productSlug);
    if (!product) {
      return NextResponse.json({ success: false, message: 'محصول مورد نظر یافت نشد.' }, { status: 404 });
    }

    const approved = farmStore.getProductReviews(product.slug, true);
    const count = approved.length;
    const average = count === 0 ? 0 : Math.round((approved.reduce((sum, r) => sum + r.rating, 0) / count) * 10) / 10;

    return NextResponse.json(
      {
        success: true,
        productSlug: product.slug,
        reviews: approved.map(publicReview),
        aggregate: { average, count },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    return apiErrorResponse(error, 'reviews GET', 'خطا در دریافت دیدگاه‌ها');
  }
}

/**
 * POST /api/reviews (session required)
 * Allowed once per account and product, and only for a DELIVERED order that contains the product.
 * The review is stored as PENDING until an admin approves it.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = requireUser(req);
    if (auth instanceof NextResponse) return auth;
    const session = auth.session;

    const body = await req.json().catch(() => null);
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || 'اطلاعات دیدگاه نامعتبر است.' },
        { status: 400 }
      );
    }
    const input = parsed.data;

    const user = farmStore.getAllUsers().find((u) => u.id === session.userId);
    if (!user) {
      return NextResponse.json({ success: false, message: 'حساب کاربری یافت نشد.' }, { status: 401 });
    }

    const product = farmStore.getProductBySlug(input.productSlug);
    if (!product) {
      return NextResponse.json({ success: false, message: 'محصول مورد نظر یافت نشد.' }, { status: 404 });
    }

    // The eligibility check and the insert run under one lock, so a double submit cannot create two reviews.
    const result = await withOrderLock(`review:${user.id}:${product.slug}`, () => {
      const check = farmStore.canUserReviewProduct(user.id, product.slug);
      if (!check.canReview) {
        return {
          ok: false as const,
          status: check.alreadyReviewed ? 409 : 403,
          message: check.reason || 'ثبت دیدگاه برای این محصول مجاز نیست.',
        };
      }
      const review = farmStore.addProductReview({
        productId: product.id,
        productSlug: product.slug,
        productTitle: product.title,
        userId: user.id,
        userName: user.name || 'کاربر',
        userAvatar: user.avatarUrl ?? null,
        rating: input.rating,
        title: input.title || undefined,
        comment: input.comment,
        pros: input.pros ?? [],
        cons: input.cons ?? [],
        isRecommended: input.isRecommended,
        isVerifiedBuyer: true,
        orderId: check.orderId,
        status: 'PENDING',
      });
      return { ok: true as const, review };
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, message: result.message }, { status: result.status });
    }

    return NextResponse.json(
      {
        success: true,
        review: publicReview(result.review),
        message: 'دیدگاه شما ثبت شد و پس از تایید مدیریت منتشر می‌شود.',
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    return apiErrorResponse(error, 'reviews POST', 'خطا در ثبت دیدگاه');
  }
}
