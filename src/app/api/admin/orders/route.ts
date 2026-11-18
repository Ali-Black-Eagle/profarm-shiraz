import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { farmStore } from '@/lib/db-store';
import { apiErrorResponse } from '@/lib/api-errors';
import { isIsoDate, jsonError, jsonOk, pageParams, paginate, parseWith, readObjectBody, textField } from '@/lib/admin-api';
import {
  changeOrderStatus,
  countOrdersByStatus,
  listAdminOrders,
  ORDER_STATUSES,
  parseOrderStatusFilter,
  serializeAdminOrder,
} from '@/lib/admin-orders';
import type { OrderStatus } from '@/types';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  orderId: textField(200, 'شناسه سفارش'),
  status: z.enum(ORDER_STATUSES as [OrderStatus, ...OrderStatus[]], {
    error: 'وضعیت سفارش نامعتبر است',
  }),
});

/**
 * GET ?status=ALL|DELIVERABLE|PENDING_PAYMENT|...|PROCESSING,OUT_FOR_DELIVERY, &date=YYYY-MM-DD (delivery day),
 * &q= (order number, phone or name), &page=, &pageSize= (default 20, max 100). Every order carries allowedNextStatuses.
 * DELIVERABLE is the driver set: PROCESSING, OUT_FOR_DELIVERY, DELIVERED, and cash-on-delivery PENDING_PAYMENT orders.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    // Unconfirmed cash-on-delivery orders past their window are cancelled first, so the list and the stock are current
    await farmStore.releaseExpiredPendingOrdersLocked();

    const { searchParams } = new URL(req.url);
    const statusFilter = parseOrderStatusFilter(searchParams.get('status'));
    const date = searchParams.get('date') || undefined;
    const q = searchParams.get('q') || undefined;

    if (statusFilter === null) {
      return jsonError(400, 'وضعیت فیلتر سفارش نامعتبر است.');
    }
    if (date !== undefined && !isIsoDate(date)) {
      return jsonError(400, 'تاریخ فیلتر باید به صورت YYYY-MM-DD و معتبر باشد.');
    }

    const list = listAdminOrders({ status: searchParams.get('status') || 'ALL', date, q });
    const { page, pageSize } = pageParams(searchParams, { pageSize: 20, maxPageSize: 100 });
    const { items, pagination } = paginate(list, page, pageSize);
    return jsonOk({
      orders: items.map(serializeAdminOrder),
      pagination,
      counts: { ...countOrdersByStatus(), matching: list.length },
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/orders GET', 'خطا در دریافت سفارش‌ها');
  }
}

/** Body: { orderId, status }. Only transitions allowed by canTransition are applied (409 otherwise). */
export async function PATCH(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await readObjectBody(req);
    const parsed = parseWith(patchSchema, body ?? {});
    if ('response' in parsed) return parsed.response;

    const result = await changeOrderStatus(parsed.data.orderId, parsed.data.status);
    if (!result.ok) {
      return jsonError(result.reason === 'NOT_FOUND' ? 404 : 409, result.message);
    }
    return jsonOk({ order: serializeAdminOrder(result.order) });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/orders PATCH', 'خطا در تغییر وضعیت سفارش');
  }
}
