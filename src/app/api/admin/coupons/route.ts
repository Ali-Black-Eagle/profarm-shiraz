import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { farmStore } from '@/lib/db-store';
import { requireAdmin } from '@/lib/admin-auth';
import { apiErrorResponse } from '@/lib/api-errors';
import { jsonError, jsonOk, normalizeNumeric, parseWith, readObjectBody, textField } from '@/lib/admin-api';
import { parseTehranDateValue } from '@/lib/jalali';
import type { Coupon } from '@/types';

export const dynamic = 'force-dynamic';

const TARGET_TYPES = ['ALL_PRODUCTS', 'SPECIFIC_PRODUCT', 'SHIPPING'] as const;
const DISCOUNT_TYPES = ['PERCENTAGE', 'FIXED_AMOUNT'] as const;

const codeSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toUpperCase() : value),
  z
    .string({ required_error: 'کد تخفیف الزامی است', invalid_type_error: 'کد تخفیف باید متن باشد' })
    .regex(/^[A-Z0-9-]{3,40}$/, 'کد تخفیف فقط می‌تواند شامل حروف انگلیسی بزرگ، عدد و خط تیره باشد (۳ تا ۴۰ نویسه)')
);

const optionalNumber = (min: number, max: number) =>
  z.preprocess(normalizeNumeric, z.number().min(min).max(max).nullable()).optional();

const dateField = z
  .string()
  .trim()
  .max(40)
  .refine((value) => parseTehranDateValue(value, false) !== null, 'تاریخ نامعتبر است (مثال: 2026-12-29 یا ۱۴۰۵-۰۹-۰۸)')
  .nullable()
  .optional();

const couponFields = {
  code: codeSchema,
  title: textField(200, 'عنوان کد تخفیف'),
  description: z.string().trim().max(1000).optional(),
  targetType: z.enum(TARGET_TYPES),
  targetProductId: z.string().trim().max(200).nullable().optional(),
  discountType: z.enum(DISCOUNT_TYPES),
  discountValue: z.preprocess(normalizeNumeric, z.number({ invalid_type_error: 'مقدار تخفیف باید عدد باشد' }).min(0)),
  minOrderAmount: optionalNumber(0, 1_000_000_000_000),
  maxDiscountAmount: optionalNumber(0, 1_000_000_000_000),
  usageLimit: z.preprocess(normalizeNumeric, z.number().int().min(1).max(10_000_000).nullable()).optional(),
  perUserLimit: z.preprocess(normalizeNumeric, z.number().int().min(1).max(10_000).nullable()).optional(),
  isActive: z.boolean().optional(),
  startsAt: dateField,
  expiresAt: dateField,
};

const couponCreateSchema = z.object(couponFields);
const couponUpdateSchema = z.object(couponFields).partial();

/** Shared rules for the create and update paths. Returns a Persian message, or null when valid. */
function checkCouponRules(input: {
  discountType?: string;
  discountValue?: number;
  targetType?: string;
  targetProductId?: string | null;
  startsAt?: string | null;
  expiresAt?: string | null;
}): string | null {
  if (input.discountType === 'PERCENTAGE' && typeof input.discountValue === 'number' && input.discountValue > 100) {
    return 'درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد.';
  }
  if (input.targetType === 'SPECIFIC_PRODUCT' && !input.targetProductId) {
    return 'برای کد تخفیف کالای مشخص، کالای مورد نظر را انتخاب کنید.';
  }
  if (input.startsAt && input.expiresAt) {
    const start = parseTehranDateValue(input.startsAt, false);
    const end = parseTehranDateValue(input.expiresAt, true);
    if (start !== null && end !== null && start > end) return 'تاریخ شروع نمی‌تواند بعد از تاریخ انقضا باشد.';
  }
  return null;
}

function productForTarget(productId: string) {
  return farmStore.getProducts().find((p) => p.id === productId || p.slug === productId);
}

export async function GET(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const active = new URL(req.url).searchParams.get('active');
    let coupons = farmStore.getCoupons();
    if (active === 'true') coupons = coupons.filter((c) => c.isActive);
    if (active === 'false') coupons = coupons.filter((c) => !c.isActive);
    return jsonOk({ coupons });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/coupons GET', 'خطا در دریافت کدهای تخفیف');
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await readObjectBody(req);
    if (!body) return jsonError(400, 'اطلاعات ارسالی نامعتبر است.');
    const parsed = parseWith(couponCreateSchema, body);
    if ('response' in parsed) return parsed.response;
    const data = parsed.data;

    const ruleError = checkCouponRules(data);
    if (ruleError) return jsonError(400, ruleError);

    let targetProductName: string | undefined;
    let targetProductId: string | undefined;
    if (data.targetType === 'SPECIFIC_PRODUCT') {
      const product = productForTarget(String(data.targetProductId));
      if (!product) return jsonError(400, 'کالای انتخاب‌شده برای کد تخفیف یافت نشد.');
      targetProductId = product.id;
      targetProductName = product.title;
    }

    const coupon = farmStore.createCoupon({
      code: data.code,
      title: data.title,
      description: data.description,
      targetType: data.targetType,
      targetProductId,
      targetProductName,
      discountType: data.discountType,
      discountValue: data.discountValue,
      minOrderAmount: data.minOrderAmount ?? undefined,
      maxDiscountAmount: data.maxDiscountAmount ?? undefined,
      usageLimit: data.usageLimit ?? undefined,
      perUserLimit: data.perUserLimit ?? undefined,
      isActive: data.isActive ?? true,
      startsAt: data.startsAt ?? null,
      expiresAt: data.expiresAt ?? null,
    } as Omit<Coupon, 'id' | 'createdAt' | 'usageCount'>);

    return jsonOk({ coupon }, 201);
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/coupons POST', 'خطا در ایجاد کد تخفیف');
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await readObjectBody(req);
    const id = typeof body?.id === 'string' ? body.id.trim() : '';
    if (!id) return jsonError(400, 'شناسه کد تخفیف الزامی است.');

    const current = farmStore.getCouponById(id);
    if (!current) return jsonError(404, 'کد تخفیف مورد نظر یافت نشد.');

    if (body?.action === 'toggle') {
      const toggled = farmStore.toggleCouponActive(id);
      return jsonOk({ coupon: toggled });
    }

    // usageCount, id and createdAt are not in the schema, so they can never be written from here.
    const parsed = parseWith(couponUpdateSchema, body);
    if ('response' in parsed) return parsed.response;
    const updates = parsed.data;

    const merged = {
      discountType: updates.discountType ?? current.discountType,
      discountValue: updates.discountValue ?? current.discountValue,
      targetType: updates.targetType ?? current.targetType,
      targetProductId: updates.targetProductId !== undefined ? updates.targetProductId : current.targetProductId,
      startsAt: updates.startsAt !== undefined ? updates.startsAt : current.startsAt,
      expiresAt: updates.expiresAt !== undefined ? updates.expiresAt : current.expiresAt,
    };
    const ruleError = checkCouponRules(merged);
    if (ruleError) return jsonError(400, ruleError);

    const patch: Partial<Coupon> = { ...(updates as Partial<Coupon>) };
    if (updates.targetType !== undefined || updates.targetProductId !== undefined) {
      if (merged.targetType === 'SPECIFIC_PRODUCT') {
        const product = productForTarget(String(merged.targetProductId));
        if (!product) return jsonError(400, 'کالای انتخاب‌شده برای کد تخفیف یافت نشد.');
        patch.targetProductId = product.id;
        patch.targetProductName = product.title;
      } else {
        patch.targetProductId = undefined;
        patch.targetProductName = undefined;
      }
    }
    for (const key of ['minOrderAmount', 'maxDiscountAmount', 'usageLimit', 'perUserLimit'] as const) {
      if (patch[key] === null) patch[key] = undefined;
    }

    const updated = farmStore.updateCoupon(id, patch);
    if (!updated) return jsonError(404, 'کد تخفیف مورد نظر یافت نشد.');
    return jsonOk({ coupon: updated });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/coupons PATCH', 'خطا در ویرایش کد تخفیف');
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const id = new URL(req.url).searchParams.get('id')?.trim() || '';
    if (!id) return jsonError(400, 'شناسه کد تخفیف الزامی است.');
    if (!farmStore.getCouponById(id)) return jsonError(404, 'کد تخفیف مورد نظر یافت نشد.');

    farmStore.deleteCoupon(id);
    return jsonOk({ message: 'کد تخفیف حذف شد.' });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/coupons DELETE', 'خطا در حذف کد تخفیف');
  }
}
