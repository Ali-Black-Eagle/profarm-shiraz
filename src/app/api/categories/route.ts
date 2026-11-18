import { NextResponse } from 'next/server';
import { farmStore } from '@/lib/db-store';
import { apiErrorResponse } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';

/** GET /api/categories: category names (without the "all products" pseudo category). */
export async function GET() {
  try {
    const categories = farmStore
      .getCategories()
      .filter((c) => typeof c === 'string' && c.trim() && c !== 'همه محصولات');
    return NextResponse.json(
      { success: true, categories },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    return apiErrorResponse(error, 'categories GET', 'خطا در دریافت دسته‌بندی‌ها');
  }
}
