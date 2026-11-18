import { NextRequest, NextResponse } from 'next/server';
import { farmStore } from '@/lib/db-store';
import { requireAdmin } from '@/lib/admin-auth';
import { apiErrorResponse } from '@/lib/api-errors';
import { matchesSearch, toPublicProduct } from '@/lib/public-api';

export const dynamic = 'force-dynamic';

/**
 * GET /api/products
 * ?slug=<slug>          one active product + related products (same category first, max ?limit, default 4)
 * ?category=, ?search=  filters (search ignores case, ي/ك vs ی/ک and spacing inside words)
 * ?organic=true, ?bulk=true, ?limit=<1..200>
 * Inactive products (isAvailable === false) are never listed. costPrice is never returned.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug')?.trim() || '';
    const category = searchParams.get('category');
    const search = searchParams.get('search')?.trim() || '';
    const organicOnly = searchParams.get('organic') === 'true';
    const bulkOnly = searchParams.get('bulk') === 'true';
    const limitRaw = searchParams.get('limit');
    const parsedLimit = Math.floor(Number(limitRaw));
    const limit = limitRaw && Number.isFinite(parsedLimit) ? Math.min(200, Math.max(1, parsedLimit)) : null;

    const visible = farmStore.getProducts().filter((p) => p.isAvailable !== false);

    if (slug) {
      const product = visible.find((p) => p.slug === slug || p.id === slug);
      if (!product) {
        return NextResponse.json({ success: false, message: 'محصول مورد نظر یافت نشد.' }, { status: 404 });
      }
      const others = visible.filter((p) => p.id !== product.id);
      const sameCategory = others.filter((p) => p.category === product.category);
      const rest = others.filter((p) => p.category !== product.category);
      const related = [...sameCategory, ...rest].slice(0, limit ?? 4);
      return NextResponse.json({
        success: true,
        product: toPublicProduct(product),
        related: related.map((p) => toPublicProduct(p)),
      });
    }

    let products = visible;
    if (category && category !== 'همه محصولات') {
      products = products.filter((p) => p.category === category);
    }
    if (search) {
      products = products.filter((p) => matchesSearch([p.title, p.description, p.category], search));
    }
    if (organicOnly) {
      products = products.filter((p) => p.isOrganicCertified);
    }
    if (bulkOnly) {
      products = products.filter((p) => p.isBulkEligible);
    }

    const count = products.length;
    if (limit !== null) products = products.slice(0, limit);

    return NextResponse.json({
      success: true,
      products: products.map((p) => toPublicProduct(p)),
      count,
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'products GET', 'خطا در دریافت لیست محصولات');
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json().catch(() => ({}));
    const { id, updates } = body;

    if (!id || typeof id !== 'string' || !updates || typeof updates !== 'object') {
      return NextResponse.json({ success: false, message: 'اطلاعات درخواست ناقص یا نامعتبر است.' }, { status: 400 });
    }

    const allowedKeys = [
      'title',
      'description',
      'category',
      'price',
      'stock',
      'unit',
      'isAvailable',
      'discountPercent',
      'isOrganicCertified',
      'isBulkEligible',
      'bulkMinQuantity',
      'bulkDiscountPercent',
    ];

    const safeUpdates: any = {};
    for (const key of allowedKeys) {
      if (key in updates) {
        safeUpdates[key] = updates[key];
      }
    }

    if (safeUpdates.price !== undefined) {
      const numPrice = Number(safeUpdates.price);
      if (!Number.isFinite(numPrice) || numPrice < 0) {
        return NextResponse.json({ success: false, message: 'قیمت محصول باید یک عدد نامنفی باشد.' }, { status: 400 });
      }
      safeUpdates.price = Math.round(numPrice);
    }

    if (safeUpdates.stock !== undefined) {
      const numStock = Number(safeUpdates.stock);
      if (!Number.isSafeInteger(numStock) || numStock < 0) {
        return NextResponse.json({ success: false, message: 'موجودی انبار باید یک عدد صحیح نامنفی باشد.' }, { status: 400 });
      }
      safeUpdates.stock = numStock;
    }

    if (safeUpdates.discountPercent !== undefined) {
      const numDisc = Number(safeUpdates.discountPercent);
      if (!Number.isFinite(numDisc) || numDisc < 0 || numDisc > 100) {
        return NextResponse.json({ success: false, message: 'درصد تخفیف باید عددی بین ۰ تا ۱۰۰ باشد.' }, { status: 400 });
      }
      safeUpdates.discountPercent = Math.round(numDisc);
    }

    const updated = farmStore.updateProduct(id.trim(), safeUpdates);
    if (!updated) {
      return NextResponse.json({ success: false, message: 'محصول مورد نظر یافت نشد.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, product: updated });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'products POST', 'خطا در ویرایش محصول');
  }
}
