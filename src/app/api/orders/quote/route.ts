import { NextRequest, NextResponse } from 'next/server';
import { farmStore } from '@/lib/db-store';
import { getSessionFromRequest } from '@/lib/session';
import { getSecureClientIp } from '@/lib/formatters';
import { checkDistributedRateLimit } from '@/lib/sms';
import { apiErrorResponse } from '@/lib/api-errors';
import { quoteCart, CartQuote } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

/** Quote without the internal product snapshots (cost prices never leave the server). */
function publicQuote(quote: CartQuote) {
  return {
    ...quote,
    lines: quote.lines.map(({ product: _product, costPrice: _cost, ...line }) => line),
  };
}

/**
 * POST /api/orders/quote
 * Body: { items: [{productId, quantity}], couponCode?, slotId? | deliverySlot?, city?, isSubscription?, subscriptionPlan? }
 * The session is optional: guests are priced as FREE. Returns the same quote that POST /api/orders charges.
 * Errors are reported in quote.errors with ok=false (HTTP 200), so the UI can show them next to the cart total.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getSecureClientIp(req);
    const rate = await checkDistributedRateLimit(`order_quote:${ip}`, 60, 300);
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, message: `تعداد درخواست‌ها بیش از حد مجاز است. لطفاً ${rate.retryAfterSeconds} ثانیه دیگر تلاش نمایید.` },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, message: 'اطلاعات ارسالی نامعتبر است.' }, { status: 400 });
    }

    const session = getSessionFromRequest(req);
    const user = session ? farmStore.getAllUsers().find((u) => u.id === session.userId) ?? null : null;

    const slotId =
      typeof body.slotId === 'string'
        ? body.slotId
        : body.deliverySlot && typeof body.deliverySlot === 'object' && typeof body.deliverySlot.id === 'string'
        ? body.deliverySlot.id
        : null;
    // city undefined = no address yet (preview): the Shiraz rule is then not evaluated
    const city = body.city === undefined || body.city === null ? undefined : String(body.city);

    const quote = quoteCart({
      user,
      items: Array.isArray(body.items) ? body.items : [],
      couponCode: typeof body.couponCode === 'string' ? body.couponCode : null,
      slotId,
      city,
      requireSlot: false,
      isSubscription: body.isSubscription === true,
      subscriptionPlan: body.subscriptionPlan,
    });

    return NextResponse.json({ success: true, quote: publicQuote(quote) });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'orders/quote', 'خطا در محاسبه مبلغ سفارش');
  }
}
