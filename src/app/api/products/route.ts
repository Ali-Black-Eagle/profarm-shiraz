import { NextRequest, NextResponse } from 'next/server';
import { farmStore } from '@/lib/db-store';
import { getSessionFromRequest } from '@/lib/session';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search')?.toLowerCase();
    const organicOnly = searchParams.get('organic') === 'true';
    const bulkOnly = searchParams.get('bulk') === 'true';

    let products = farmStore.getProducts();

    if (category && category !== 'همه محصولات') {
      products = products.filter((p) => p.category === category);
    }

    if (search) {
      products = products.filter(
        (p) =>
          p.title.toLowerCase().includes(search) ||
          p.description.toLowerCase().includes(search)
      );
    }

    if (organicOnly) {
      products = products.filter((p) => p.isOrganicCertified);
    }

    if (bulkOnly) {
      products = products.filter((p) => p.isBulkEligible);
    }

    return NextResponse.json({
      success: true,
      products,
      count: products.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'خطا در دریافت لیست محصولات' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'دسترسی غیرمجاز: ویرایش کالا تنها در اختیار مدیر ارشد سیستم است.' },
        { status: 403 }
      );
    }

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
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'خطا در ویرایش محصول' }, { status: 500 });
  }
}
