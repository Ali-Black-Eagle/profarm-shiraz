import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { farmStore } from '@/lib/db-store';
import { requireAdmin } from '@/lib/admin-auth';
import { apiErrorResponse } from '@/lib/api-errors';
import {
  intField,
  jsonError,
  jsonOk,
  normalizeNumeric,
  paginate,
  pageParams,
  parseWith,
  readObjectBody,
  textField,
} from '@/lib/admin-api';
import { generateSeoSlug, sanitizeSlugInput } from '@/lib/seo-utils';
import { matchesSearch } from '@/lib/public-api';
import type { Product, ProductStatus } from '@/types';

export const dynamic = 'force-dynamic';

const PRODUCT_STATUSES = ['AVAILABLE', 'OUT_OF_STOCK', 'COMING_SOON'] as const;
const OPEN_ORDER_STATUSES = ['PENDING_PAYMENT', 'PROCESSING', 'OUT_FOR_DELIVERY'];

const money = () => intField(0, 1_000_000_000_000, 'مبلغ');
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const textList = (maxItem: number, maxCount: number) => z.array(z.string().trim().max(maxItem)).max(maxCount);

/** Fields an admin may set. Anything else in the body (id, createdAt, costPriceAtSale, ...) is dropped by zod. */
const productFields = {
  title: textField(200, 'عنوان کالا'),
  category: textField(80, 'دسته‌بندی'),
  price: money(),
  costPrice: money(),
  stock: intField(0, 1_000_000_000, 'موجودی'),
  description: z.string().trim().max(5000),
  slug: z.string().trim().max(120),
  isAvailable: z.boolean(),
  status: z.enum(PRODUCT_STATUSES),
  packSize: optionalText(120),
  eggPackSize: z.preprocess(normalizeNumeric, z.number().int().min(1).max(1000).nullable()).optional(),
  weightKg: z.preprocess(normalizeNumeric, z.number().min(0).max(100_000).nullable()).optional(),
  dimensions: optionalText(200),
  images: textList(500, 20),
  isOrganicCertified: z.boolean(),
  isDigital: z.boolean(),
  isBulkEligible: z.boolean(),
  minBulkQuantity: intField(1, 100_000, 'حداقل تعداد عمده'),
  specifications: z
    .array(z.object({ key: z.string().trim().max(100), value: z.string().trim().max(500) }))
    .max(50),
  highlights: textList(300, 30),
  storageInstructions: z.string().trim().max(2000),
  nutritionalInfo: z.record(z.string().max(200)),
  faqs: z
    .array(z.object({ question: z.string().trim().max(500), answer: z.string().trim().max(2000) }))
    .max(30),
  originLocation: z.string().trim().max(200),
  shelfLife: z.string().trim().max(200),
  seoTitle: z.string().trim().max(200),
  seoDescription: z.string().trim().max(500),
  seoKeywords: textList(100, 30),
};

const productCreateSchema = z.object({
  title: productFields.title,
  category: productFields.category,
  price: productFields.price,
  costPrice: productFields.costPrice.optional(),
  stock: productFields.stock.optional(),
  description: productFields.description.optional(),
  slug: productFields.slug.optional(),
  isAvailable: productFields.isAvailable.optional(),
  status: productFields.status.optional(),
  packSize: productFields.packSize,
  eggPackSize: productFields.eggPackSize,
  weightKg: productFields.weightKg,
  dimensions: productFields.dimensions,
  images: productFields.images.optional(),
  isOrganicCertified: productFields.isOrganicCertified.optional(),
  isDigital: productFields.isDigital.optional(),
  isBulkEligible: productFields.isBulkEligible.optional(),
  minBulkQuantity: productFields.minBulkQuantity.optional(),
  specifications: productFields.specifications.optional(),
  highlights: productFields.highlights.optional(),
  storageInstructions: productFields.storageInstructions.optional(),
  nutritionalInfo: productFields.nutritionalInfo.optional(),
  faqs: productFields.faqs.optional(),
  originLocation: productFields.originLocation.optional(),
  shelfLife: productFields.shelfLife.optional(),
  seoTitle: productFields.seoTitle.optional(),
  seoDescription: productFields.seoDescription.optional(),
  seoKeywords: productFields.seoKeywords.optional(),
});

const productUpdateSchema = productCreateSchema.partial();

const restockSchema = z.object({ id: textField(200, 'شناسه کالا'), quantity: intField(1, 1_000_000, 'تعداد ورودی') });
const statusSchema = z
  .object({
    id: textField(200, 'شناسه کالا'),
    isAvailable: z.boolean().optional(),
    status: z.enum(PRODUCT_STATUSES).optional(),
  })
  .refine((v) => v.isAvailable !== undefined || v.status !== undefined, 'حداقل یکی از فیلدهای نمایش یا وضعیت لازم است.');

function findProductById(id: string): Product | undefined {
  return farmStore.getProducts().find((p) => p.id === id);
}

/** Slug rules: a typed slug is sanitized and must be unique; without one, the SEO generator makes a unique slug. */
function resolveSlug(
  requested: string | undefined,
  title: string,
  selfId: string | null
): { ok: true; slug: string } | { ok: false; response: NextResponse } {
  const taken = new Set(farmStore.getProducts().filter((p) => p.id !== selfId).map((p) => p.slug));
  if (requested !== undefined) {
    const clean = sanitizeSlugInput(requested);
    if (!clean) {
      return {
        ok: false,
        response: jsonError(400, 'نامک (slug) نامعتبر است. از حروف لاتین، عدد، حروف فارسی و خط تیره استفاده کنید.'),
      };
    }
    if (taken.has(clean)) {
      return { ok: false, response: jsonError(409, 'این نامک قبلاً برای کالای دیگری استفاده شده است.') };
    }
    return { ok: true, slug: clean };
  }
  return { ok: true, slug: generateSeoSlug(title, Array.from(taken)) };
}

function categoryExists(category: string): boolean {
  return farmStore.getCategories().includes(category) && category !== 'همه محصولات';
}

export async function GET(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() || '';
    const category = searchParams.get('category')?.trim() || '';
    const visibility = searchParams.get('visibility') || 'all';
    const status = searchParams.get('status') || '';

    const all = farmStore.getProducts();
    let list = all;
    if (category) list = list.filter((p) => p.category === category);
    if (visibility === 'active') list = list.filter((p) => p.isAvailable !== false);
    if (visibility === 'hidden') list = list.filter((p) => p.isAvailable === false);
    if (status) list = list.filter((p) => (p.status || 'AVAILABLE') === status);
    if (q) list = list.filter((p) => matchesSearch([p.title, p.slug, p.category, p.id], q));

    const counts = {
      total: all.length,
      active: all.filter((p) => p.isAvailable !== false).length,
      hidden: all.filter((p) => p.isAvailable === false).length,
      lowStock: all.filter((p) => (p.stock ?? 0) <= 5).length,
    };

    // Without ?page the full list is returned (the catalog is small). With ?page the list is paginated.
    if (searchParams.has('page')) {
      const { page, pageSize } = pageParams(searchParams, { pageSize: 50, maxPageSize: 200 });
      const { items, pagination } = paginate(list, page, pageSize);
      return jsonOk({ products: items, pagination, counts });
    }
    return jsonOk({ products: list, counts });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/products GET', 'خطا در دریافت فهرست کالاها');
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const action = new URL(req.url).searchParams.get('action');

    if (action === 'clone') {
      const body = await readObjectBody(req);
      const parsed = parseWith(z.object({ id: textField(200, 'شناسه کالا') }), body ?? {});
      if ('response' in parsed) return parsed.response;
      const product = findProductById(parsed.data.id);
      if (!product) return jsonError(404, 'کالای مورد نظر یافت نشد.');
      const copy = farmStore.cloneProduct(product.id);
      if (!copy) return jsonError(404, 'کالای مورد نظر یافت نشد.');
      return jsonOk({ product: copy, message: 'رونوشت کالا به‌صورت پیش‌نویس (غیرفعال) ساخته شد.' }, 201);
    }

    if (action === 'restock') {
      const body = await readObjectBody(req);
      const parsed = parseWith(restockSchema, body ?? {});
      if ('response' in parsed) return parsed.response;
      const product = findProductById(parsed.data.id);
      if (!product) return jsonError(404, 'کالای مورد نظر یافت نشد.');
      const updated = farmStore.updateProductStock(product.id, (product.stock ?? 0) + parsed.data.quantity);
      return jsonOk({ product: updated });
    }

    if (action === 'status') {
      const body = await readObjectBody(req);
      const parsed = parseWith(statusSchema, body ?? {});
      if ('response' in parsed) return parsed.response;
      const product = findProductById(parsed.data.id);
      if (!product) return jsonError(404, 'کالای مورد نظر یافت نشد.');
      const updates: Partial<Product> = {};
      if (parsed.data.isAvailable !== undefined) updates.isAvailable = parsed.data.isAvailable;
      if (parsed.data.status !== undefined) updates.status = parsed.data.status as ProductStatus;
      const updated = farmStore.updateProduct(product.id, updates);
      return jsonOk({ product: updated });
    }

    if (action) return jsonError(400, 'عملیات درخواستی نامعتبر است.');

    const body = await readObjectBody(req);
    if (!body) return jsonError(400, 'اطلاعات ارسالی نامعتبر است.');
    const parsed = parseWith(productCreateSchema, body);
    if ('response' in parsed) return parsed.response;
    const data = parsed.data;

    if (!categoryExists(data.category)) {
      return jsonError(400, 'دسته‌بندی انتخابی وجود ندارد. ابتدا دسته‌بندی را در بخش دسته‌بندی‌ها تعریف کنید.');
    }
    const slugResult = resolveSlug(data.slug, data.title, null);
    if (!slugResult.ok) return slugResult.response;

    const stock = data.stock ?? 0;
    const status: ProductStatus =
      data.status ?? (stock > 0 ? 'AVAILABLE' : 'OUT_OF_STOCK');

    const product = farmStore.addProduct({
      id: `prod-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      slug: slugResult.slug,
      title: data.title,
      category: data.category,
      description: data.description ?? '',
      price: data.price,
      costPrice: data.costPrice ?? 0,
      stock,
      status,
      isAvailable: data.isAvailable ?? true,
      packSize: data.packSize ?? null,
      eggPackSize: data.eggPackSize ?? null,
      weightKg: data.weightKg ?? null,
      dimensions: data.dimensions ?? null,
      images: data.images ?? [],
      isOrganicCertified: data.isOrganicCertified ?? false,
      isDigital: data.isDigital ?? false,
      isBulkEligible: data.isBulkEligible ?? false,
      minBulkQuantity: data.minBulkQuantity ?? 1,
      specifications: data.specifications,
      highlights: data.highlights,
      storageInstructions: data.storageInstructions,
      nutritionalInfo: data.nutritionalInfo as Product['nutritionalInfo'],
      faqs: data.faqs,
      originLocation: data.originLocation,
      shelfLife: data.shelfLife,
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      seoKeywords: data.seoKeywords,
    } as Parameters<typeof farmStore.addProduct>[0]);

    return jsonOk({ product }, 201);
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/products POST', 'خطا در ایجاد کالا');
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await readObjectBody(req);
    const id = typeof body?.id === 'string' ? body.id.trim() : '';
    if (!id) return jsonError(400, 'شناسه کالا الزامی است.');

    const product = findProductById(id);
    if (!product) return jsonError(404, 'کالای مورد نظر یافت نشد.');

    // The id is taken from the lookup above and is never part of the update (zod drops it).
    const parsed = parseWith(productUpdateSchema, body);
    if ('response' in parsed) return parsed.response;
    const updates: Record<string, unknown> = { ...parsed.data };

    if (updates.category !== undefined && !categoryExists(String(updates.category))) {
      return jsonError(400, 'دسته‌بندی انتخابی وجود ندارد. ابتدا دسته‌بندی را تعریف کنید.');
    }
    if (updates.slug !== undefined) {
      const slugResult = resolveSlug(String(updates.slug), String(updates.title ?? product.title), product.id);
      if (!slugResult.ok) return slugResult.response;
      updates.slug = slugResult.slug;
    }
    // Keep the status consistent with stock when the admin changes stock but not the status.
    if (updates.stock !== undefined && updates.status === undefined && product.status !== 'COMING_SOON') {
      if (updates.stock === 0) updates.status = 'OUT_OF_STOCK';
      else if (product.status === 'OUT_OF_STOCK') updates.status = 'AVAILABLE';
    }

    const updated = farmStore.updateProduct(product.id, updates as Partial<Product>);
    return jsonOk({ product: updated });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/products PATCH', 'خطا در ویرایش کالا');
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const id = new URL(req.url).searchParams.get('id')?.trim() || '';
    if (!id) return jsonError(400, 'شناسه کالا الزامی است.');

    const product = findProductById(id);
    if (!product) return jsonError(404, 'کالای مورد نظر یافت نشد.');

    const openOrders = farmStore
      .getOrders()
      .filter(
        (o) =>
          OPEN_ORDER_STATUSES.includes(o.status) &&
          o.items.some((i) => i.productId === product.id || i.productId === product.slug)
      ).length;
    if (openOrders > 0) {
      return jsonError(
        409,
        `این کالا در ${openOrders} سفارش باز (در انتظار پرداخت، پردازش یا ارسال) استفاده شده است. ابتدا آن سفارش‌ها را ببندید یا کالا را غیرفعال کنید.`
      );
    }

    farmStore.deleteProduct(product.id);
    return jsonOk({ message: 'کالا حذف شد.' });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/products DELETE', 'خطا در حذف کالا');
  }
}
