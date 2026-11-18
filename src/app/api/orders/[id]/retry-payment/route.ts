import { NextRequest, NextResponse } from 'next/server';
import { farmStore } from '@/lib/db-store';
import { requireUser } from '@/lib/user-auth';
import { apiErrorResponse } from '@/lib/api-errors';
import { normalizeOrderNumberInput } from '@/lib/formatters';
import { checkDistributedRateLimit } from '@/lib/sms';
import { withOrderLock } from '@/lib/order-lock';
import { initOnlinePayment, OnlinePaymentMethod } from '@/lib/payment-init';
import { isCodOrder } from '@/lib/order-utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/orders/[id]/retry-payment (owner only)
 * For an unpaid order that is still inside its payment window: creates a new gateway authority for the same
 * server-side total. The earlier, unpaid authority is replaced on the order.
 * Orders of other accounts answer 404, so their existence is not revealed.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    const id = normalizeOrderNumberInput(rawId) || rawId;
    const auth = requireUser(req);
    if (auth instanceof NextResponse) return auth;
    const session = auth.session;

    const rate = await checkDistributedRateLimit(`order_retry:${session.userId}`, 10, 300);
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, message: `تعداد درخواست‌ها بیش از حد مجاز است. لطفاً ${rate.retryAfterSeconds} ثانیه دیگر تلاش نمایید.` },
        { status: 429 }
      );
    }

    const found = farmStore.getOrders().find((o) => o.id === id || o.orderNumber === id);
    if (!found || found.userId !== session.userId) {
      return NextResponse.json({ success: false, message: 'سفارش مورد نظر یافت نشد.' }, { status: 404 });
    }

    const result = await withOrderLock(found.orderNumber, async () => {
      // Checked again inside the lock: a callback may have just paid or cancelled the order.
      const order = farmStore.getOrderById(found.orderNumber);
      if (!order || order.userId !== session.userId) {
        return { ok: false as const, status: 404, message: 'سفارش مورد نظر یافت نشد.' };
      }
      if (order.status !== 'PENDING_PAYMENT') {
        return { ok: false as const, status: 409, message: 'فقط سفارش‌های در انتظار پرداخت قابل پرداخت مجدد هستند.' };
      }
      if (isCodOrder(order)) {
        return { ok: false as const, status: 400, message: 'این سفارش با پرداخت در محل ثبت شده و پرداخت آنلاین ندارد.' };
      }
      if (farmStore.isPendingPaymentExpired(order)) {
        return {
          ok: false as const,
          status: 409,
          message: 'مهلت پرداخت این سفارش به پایان رسیده است. لطفاً سفارش جدیدی ثبت نمایید.',
        };
      }

      const method: OnlinePaymentMethod = order.paymentMethod === 'snapppay' ? 'snapppay' : 'zarinpal';
      const payment = await initOnlinePayment({
        orderNumber: order.orderNumber,
        amount: order.totalAmount,
        method,
        mobile: order.address?.phone || undefined,
      });
      if (!payment.success) {
        // The order stays pending: the customer can try again until the deadline.
        return { ok: false as const, status: 502, message: payment.message };
      }
      return { ok: true as const, payment, order: farmStore.getOrderById(order.orderNumber) ?? order };
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, message: result.message }, { status: result.status });
    }

    const { payment, order } = result;
    return NextResponse.json({
      success: true,
      order,
      authority: payment.authority,
      paymentToken: payment.paymentToken ?? null,
      paymentUrl: payment.paymentUrl,
      gateway: payment.gateway,
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'orders/retry-payment', 'خطا در ایجاد درخواست پرداخت مجدد');
  }
}
