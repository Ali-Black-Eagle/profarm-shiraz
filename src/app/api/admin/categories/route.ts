import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { farmStore } from '@/lib/db-store';
import { requireAdmin } from '@/lib/admin-auth';
import { apiErrorResponse } from '@/lib/api-errors';
import { jsonError, jsonOk, parseWith, readObjectBody, textField } from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

const ALL_PRODUCTS = 'همه محصولات';

const nameSchema = textField(80, 'نام دسته‌بندی').refine(
  (value) => value !== ALL_PRODUCTS,
  'این نام برای دسته‌بندی مجاز نیست.'
);

function listWithCounts() {
  const products = farmStore.getProducts();
  return farmStore
    .getCategories()
    .filter((c) => typeof c === 'string' && c.trim() && c !== ALL_PRODUCTS)
    .map((name) => ({ name, productCount: products.filter((p) => p.category === name).length }));
}

export async function GET(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    return jsonOk({ categories: listWithCounts() });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/categories GET', 'خطا در دریافت دسته‌بندی‌ها');
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await readObjectBody(req);
    const parsed = parseWith(z.object({ name: nameSchema }), body ?? {});
    if ('response' in parsed) return parsed.response;

    const result = farmStore.addCategory(parsed.data.name);
    if (!result.success) return jsonError(409, result.message);
    return jsonOk({ message: result.message, categories: listWithCounts() }, 201);
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/categories POST', 'خطا در افزودن دسته‌بندی');
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await readObjectBody(req);
    const parsed = parseWith(z.object({ name: textField(80, 'نام فعلی'), newName: nameSchema }), body ?? {});
    if ('response' in parsed) return parsed.response;
    const { name, newName } = parsed.data;

    if (name === ALL_PRODUCTS) return jsonError(400, 'دسته‌بندی مرجع «همه محصولات» قابل ویرایش نیست.');
    if (!farmStore.getCategories().includes(name)) return jsonError(404, 'دسته‌بندی مورد نظر یافت نشد.');
    if (newName === name) return jsonOk({ message: 'تغییری ایجاد نشد.', categories: listWithCounts() });
    if (farmStore.getCategories().includes(newName)) {
      return jsonError(409, 'دسته‌بندی دیگری با این نام وجود دارد.');
    }

    const result = farmStore.renameCategory(name, newName);
    if (!result.success) return jsonError(404, result.message);
    return jsonOk({ message: result.message, categories: listWithCounts() });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/categories PATCH', 'خطا در ویرایش دسته‌بندی');
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const name = new URL(req.url).searchParams.get('name') ?? '';
    const parsed = parseWith(textField(80, 'نام دسته‌بندی'), name);
    if ('response' in parsed) return parsed.response;
    const target = parsed.data;

    if (target === ALL_PRODUCTS) return jsonError(400, 'دسته‌بندی مرجع «همه محصولات» قابل حذف نیست.');
    if (!farmStore.getCategories().includes(target)) return jsonError(404, 'دسته‌بندی مورد نظر یافت نشد.');

    const inUse = farmStore.getProducts().filter((p) => p.category === target).length;
    if (inUse > 0) {
      return jsonError(
        409,
        `این دسته‌بندی برای ${inUse} کالا استفاده می‌شود. ابتدا کالاها را به دسته‌بندی دیگری منتقل کنید.`,
        { productCount: inUse }
      );
    }

    const result = farmStore.deleteCategory(target);
    return jsonOk({ message: result.message, categories: listWithCounts() });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/categories DELETE', 'خطا در حذف دسته‌بندی');
  }
}
