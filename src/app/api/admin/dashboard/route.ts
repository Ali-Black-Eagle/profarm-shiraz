import { NextRequest, NextResponse } from 'next/server';
import { farmStore } from '@/lib/db-store';
import { requireAdmin } from '@/lib/admin-auth';
import { apiErrorResponse } from '@/lib/api-errors';
import { jsonOk } from '@/lib/admin-api';
import { buildFinanceReport } from '@/lib/admin-finance';
import { listAdminOrders, countOrdersByStatus } from '@/lib/admin-orders';
import { getTehranIsoDate } from '@/lib/jalali';
import { getEffectiveTier } from '@/lib/subscription';
import type { SubscriptionTier } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * GET ?threshold=5 (low stock limit). Only real numbers from stored data: no visit or traffic figures.
 * pendingOrders = orders waiting for payment, processing or on their way (not delivered, not cancelled).
 */
export async function GET(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const thresholdParam = Number(new URL(req.url).searchParams.get('threshold'));
    const threshold = Number.isFinite(thresholdParam) && thresholdParam >= 0 ? Math.floor(thresholdParam) : 5;

    const now = new Date();
    const todayIso = getTehranIsoDate(now);
    const today = buildFinanceReport('day', todayIso, now).summary;
    const month = buildFinanceReport('month', todayIso, now).summary;

    const orders = farmStore.getOrders();
    const ordersToday = orders.filter(
      (o) => o.status !== 'CANCELLED' && getTehranIsoDate(new Date(o.createdAt)) === todayIso
    ).length;

    const byStatus = countOrdersByStatus();
    const pendingOrders = byStatus.PENDING_PAYMENT + byStatus.PROCESSING + byStatus.OUT_FOR_DELIVERY;

    const lowStock = farmStore
      .getProducts()
      .filter((p) => (p.stock ?? 0) <= threshold)
      .map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        stock: p.stock ?? 0,
        status: p.status ?? 'AVAILABLE',
        isAvailable: p.isAvailable !== false,
      }))
      .sort((a, b) => a.stock - b.stock);

    const recentOrders = listAdminOrders({})
      .slice(0, 10)
      .map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        totalAmount: o.totalAmount,
        createdAt: o.createdAt,
        customerName: o.address?.recipientName || o.user?.name || 'مشتری پروفارم',
        isSubscription: Boolean(o.isSubscription),
        jalaliDeliveryLabel: o.deliverySlot?.jalaliLabel ?? null,
      }));

    const now_ms = now.getTime();
    const subscribers: Record<SubscriptionTier | 'total', number> = { FREE: 0, PLUS: 0, PRO: 0, total: 0 };
    for (const user of farmStore.getAllUsers()) {
      if (user.role === 'ADMIN') continue;
      subscribers[getEffectiveTier(user, now_ms)]++;
      subscribers.total++;
    }
    const settings = farmStore.getSubscriptionSettings();

    const reviews = farmStore.getAllReviews();
    const returns = farmStore.getReturnRequests();

    return jsonOk({
      generatedAt: now.toISOString(),
      todayIso,
      ordersToday,
      pendingOrders,
      ordersByStatus: byStatus,
      revenueToday: today.netRevenue,
      revenueMonth: month.netRevenue,
      revenueMonthOrders: month.totalOrdersCount,
      lowStockThreshold: threshold,
      lowStock,
      recentOrders,
      subscribers: {
        ...subscribers,
        capacity: { PRO: settings.proMaxCapacity, PLUS: settings.plusMaxCapacity },
      },
      pending: {
        returns: returns.filter((r) => r.status === 'PENDING').length,
        reviews: reviews.filter((r) => r.status === 'PENDING').length,
        bulkInquiries: farmStore.getBulkInquiries().filter((b) => b.status === 'PENDING').length,
      },
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/dashboard GET', 'خطا در بارگذاری داشبورد');
  }
}
