import { NextResponse } from 'next/server';
import { farmStore } from '@/lib/db-store';
import { apiErrorResponse } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';

/**
 * GET /api/site-content: the CMS texts and links the admin edits (home page, footer, contact).
 * Every field is public by design, so the whole record is returned. Never cached, so edits show at once.
 */
export async function GET() {
  try {
    return NextResponse.json(
      { success: true, content: farmStore.getSiteContent() },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (error: unknown) {
    return apiErrorResponse(error, 'site-content GET', 'خطا در دریافت محتوای سایت');
  }
}
