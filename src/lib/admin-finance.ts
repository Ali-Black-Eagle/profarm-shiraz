/**
 * Server-side financial reporting for /api/admin/finance and the admin dashboard.
 *
 * Only countable sales are included (isCountableSaleOrder): online orders once paid or in processing, and cash or
 * card-on-delivery orders once delivered. Cancelled and unpaid orders never count.
 *
 * Figures per order:
 * - gross     = sum of item line totals before discounts (items[].totalPrice)
 * - discount  = tier discount (tierDiscountAmount) + coupon (couponDiscountAmount)
 * - shipping  = shipping actually charged (shippingFee)
 * - net       = totalAmount, the amount the customer paid
 * - cost      = costPriceAtSale snapshot of each line. Orders created before the snapshot existed use the current
 *               product cost and are flagged costEstimated.
 * - profit    = net - cost. It can be negative, and nothing is clamped.
 *
 * Buckets use the Asia/Tehran calendar: 4 shifts (00-06, 06-12, 12-18, 18-24), 7 weekdays starting Saturday, and the
 * 12 months of the Jalali year. Periods: day, week (Saturday to Friday), Jalali month, Jalali year.
 * Cash-on-delivery orders are dated by their delivery time, every other order by its creation time.
 */
import 'server-only';
import { farmStore } from './db-store';
import { isCodOrder, isCountableSaleOrder } from './order-utils';
import { getEffectiveTier } from './subscription';
import {
  addDaysIso,
  formatIsoDateToJalali,
  getTehranIsoDate,
  gregorianToJalali,
  isoWeekdayIndex,
  jalaliToGregorian,
  PERSIAN_MONTHS,
  parseIsoDate,
  TEHRAN_TZ,
} from './jalali';
import { toPersianDigits } from './formatters';
import type {
  CategoryRevenue,
  DailyShiftStat,
  FinancialRecord,
  FinancialSummary,
  GatewayRevenue,
  MonthlyFinancialStat,
  Order,
  SubscriptionTier,
  TierRevenue,
  WeeklyDayStat,
} from '@/types';

export type FinancePeriodType = 'day' | 'week' | 'month' | 'year';
export const FINANCE_PERIOD_TYPES: FinancePeriodType[] = ['day', 'week', 'month', 'year'];

/** Saturday first, the order the store works in. */
const WEEKDAY_NAMES = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];

const SHIFTS = [
  { name: 'بامداد (۰۰ تا ۰۶)', from: 0 },
  { name: 'صبح (۰۶ تا ۱۲)', from: 6 },
  { name: 'ظهر (۱۲ تا ۱۸)', from: 12 },
  { name: 'شب (۱۸ تا ۲۴)', from: 18 },
];

const TIER_LABELS: Record<SubscriptionTier, string> = {
  PRO: 'مشترکین طلایی پرو',
  PLUS: 'مشترکین نقره‌ای پلاس',
  FREE: 'کاربران عمومی و عادی',
};

const TIER_CSV_LABELS: Record<SubscriptionTier, string> = {
  PRO: 'مشترک پرو',
  PLUS: 'مشترک پلاس',
  FREE: 'کاربر عادی',
};

export interface ResolvedFinancePeriod {
  type: FinancePeriodType;
  /** Anchor date the period was resolved from (YYYY-MM-DD). */
  anchorDate: string;
  /** First civil day included (YYYY-MM-DD). */
  startDate: string;
  /** First civil day NOT included (YYYY-MM-DD). */
  endDate: string;
  label: string;
  jalaliYear: number;
  /** Jalali month of the anchor (1-12). Null for week and year. */
  jalaliMonth: number | null;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isoFromJalali(jy: number, jm: number, jd: number): string {
  const g = jalaliToGregorian(jy, jm, jd);
  if (!g) throw new Error(`Invalid Jalali date ${jy}/${jm}/${jd}`);
  return `${String(g.y).padStart(4, '0')}-${pad2(g.m)}-${pad2(g.d)}`;
}

/** Start and exclusive end of the Jalali year that contains the anchor date. */
function jalaliYearWindow(jy: number): { start: string; end: string } {
  return { start: isoFromJalali(jy, 1, 1), end: isoFromJalali(jy + 1, 1, 1) };
}

export function resolveFinancePeriod(type: FinancePeriodType, anchorDate: string): ResolvedFinancePeriod {
  const parsed = parseIsoDate(anchorDate);
  if (!parsed) throw new Error(`Invalid ISO date: ${anchorDate}`);
  const [jy, jm] = gregorianToJalali(parsed.year, parsed.month, parsed.day);

  if (type === 'day') {
    return {
      type,
      anchorDate,
      startDate: anchorDate,
      endDate: addDaysIso(anchorDate, 1),
      label: formatIsoDateToJalali(anchorDate).jalaliLabel,
      jalaliYear: jy,
      jalaliMonth: jm,
    };
  }

  if (type === 'week') {
    // Saturday-based week: Saturday is offset 0, Friday is offset 6.
    const dow = isoWeekdayIndex(anchorDate);
    const offset = (dow + 1) % 7;
    const startDate = addDaysIso(anchorDate, -offset);
    const lastDay = addDaysIso(startDate, 6);
    return {
      type,
      anchorDate,
      startDate,
      endDate: addDaysIso(startDate, 7),
      label: `هفته ${formatIsoDateToJalali(startDate).shortDate} تا ${formatIsoDateToJalali(lastDay).shortDate}`,
      jalaliYear: jy,
      jalaliMonth: null,
    };
  }

  if (type === 'month') {
    const nextYear = jm === 12 ? jy + 1 : jy;
    const nextMonth = jm === 12 ? 1 : jm + 1;
    return {
      type,
      anchorDate,
      startDate: isoFromJalali(jy, jm, 1),
      endDate: isoFromJalali(nextYear, nextMonth, 1),
      label: `${PERSIAN_MONTHS[jm - 1]} ${toPersianDigits(jy)}`,
      jalaliYear: jy,
      jalaliMonth: jm,
    };
  }

  const window = jalaliYearWindow(jy);
  return {
    type,
    anchorDate,
    startDate: window.start,
    endDate: window.end,
    label: `سال ${toPersianDigits(jy)}`,
    jalaliYear: jy,
    jalaliMonth: null,
  };
}

function tehranHour(instant: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TEHRAN_TZ,
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  return Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
}

interface GatewayInfo {
  key: string;
  label: string;
}

function gatewayInfo(order: Order): GatewayInfo {
  if (order.manualPaymentMethod === 'paid-offline') return { key: 'manual-paid', label: 'ثبت دستی (پرداخت شده)' };
  if (order.manualPaymentMethod === 'cash') return { key: 'manual-cash', label: 'نقدی در محل (ثبت مدیر)' };
  if (order.manualPaymentMethod === 'card-on-delivery') {
    return { key: 'manual-card', label: 'کارت‌خوان در محل (ثبت مدیر)' };
  }
  if (isCodOrder(order)) return { key: 'cod', label: 'پرداخت در محل' };
  const gateway = String(order.payment?.gateway || '').toLowerCase();
  if (gateway === 'zarinpal') return { key: 'zarinpal', label: 'زرین‌پال' };
  if (gateway === 'snapppay') return { key: 'snapppay', label: 'اسنپ‌پی' };
  return { key: 'other', label: gateway || 'سایر' };
}

/** One countable order, computed once and reused by every bucket. */
interface OrderRow {
  orderId: string;
  orderNumber: string;
  /** Instant used for bucketing (ISO). */
  recognizedAt: string;
  /** Civil day of recognizedAt in Asia/Tehran (YYYY-MM-DD). */
  dayIso: string;
  hour: number;
  isSubscription: boolean;
  customerName: string;
  customerPhone: string;
  customerTier: SubscriptionTier;
  itemCount: number;
  gross: number;
  tierDiscount: number;
  couponDiscount: number;
  discount: number;
  shipping: number;
  net: number;
  cost: number;
  costEstimated: boolean;
  profit: number;
  reconciled: boolean;
  gateway: GatewayInfo;
  paymentStatus: 'INITIATED' | 'SUCCESS' | 'FAILED';
  orderStatus: Order['status'];
  settlementRef: string;
  source: 'ONLINE' | 'ADMIN_MANUAL';
  lines: { productId: string; title: string; category: string; revenue: number; cost: number; quantity: number }[];
}

function buildRows(now: Date): OrderRow[] {
  const users = new Map(farmStore.getAllUsers().map((u) => [u.id, u] as const));
  const products = new Map<string, { costPrice?: number }>();
  for (const p of farmStore.getProducts()) {
    products.set(p.id, p);
    products.set(p.slug, p);
  }

  return farmStore
    .getOrders()
    .filter(isCountableSaleOrder)
    .map((order): OrderRow => {
      const recognizedAt = isCodOrder(order) && order.deliveredAt ? order.deliveredAt : order.createdAt;
      const instant = new Date(recognizedAt);
      const validInstant = Number.isFinite(instant.getTime()) ? instant : new Date(0);

      const account = users.get(order.userId);
      const customerTier: SubscriptionTier = account
        ? getEffectiveTier(account, now.getTime())
        : order.user
          ? getEffectiveTier(order.user, now.getTime())
          : 'FREE';

      let gross = 0;
      let cost = 0;
      let costEstimated = false;
      let itemCount = 0;
      const lines: OrderRow['lines'] = [];
      for (const item of order.items || []) {
        const lineRevenue =
          typeof item.totalPrice === 'number' ? item.totalPrice : (item.unitPrice || 0) * (item.quantity || 0);
        gross += lineRevenue;
        itemCount += item.quantity || 0;

        let lineCost = 0;
        const isSubLine = !item.productId || item.productId.startsWith('sub-');
        if (!isSubLine) {
          if (typeof item.costPriceAtSale === 'number' && item.costPriceAtSale >= 0) {
            lineCost = item.costPriceAtSale * item.quantity;
          } else {
            costEstimated = true;
            const current = products.get(item.productId) ?? item.product;
            const unit = typeof current?.costPrice === 'number' && current.costPrice >= 0 ? current.costPrice : 0;
            lineCost = unit * item.quantity;
          }
        }
        cost += lineCost;
        lines.push({
          productId: item.productId,
          title: item.product?.title || item.productId,
          category: item.product?.category || 'محصولات مزرعه',
          revenue: lineRevenue,
          cost: lineCost,
          quantity: item.quantity || 0,
        });
      }
      if (order.isSubscription) {
        cost = 0;
        costEstimated = false;
      }

      const tierDiscount = order.tierDiscountAmount ?? 0;
      const couponDiscount = order.couponDiscountAmount ?? 0;
      const discount = tierDiscount + couponDiscount;
      const shipping = order.shippingFee ?? 0;
      const net = order.totalAmount;

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        recognizedAt: validInstant.toISOString(),
        dayIso: getTehranIsoDate(validInstant),
        hour: tehranHour(validInstant),
        isSubscription: Boolean(order.isSubscription),
        customerName: order.address?.recipientName || order.user?.name || 'مشتری پروفارم',
        customerPhone: order.address?.phone || order.user?.phone || account?.phone || '-',
        customerTier,
        itemCount,
        gross,
        tierDiscount,
        couponDiscount,
        discount,
        shipping,
        net,
        cost,
        costEstimated,
        profit: net - cost,
        reconciled: Math.round(gross - discount + shipping) === Math.round(net),
        gateway: gatewayInfo(order),
        paymentStatus: isCodOrder(order) ? 'SUCCESS' : order.payment?.status || 'SUCCESS',
        orderStatus: order.status,
        settlementRef: order.payment?.refId || order.orderNumber,
        source: order.source === 'ADMIN_MANUAL' ? 'ADMIN_MANUAL' : 'ONLINE',
        lines,
      };
    });
}

interface Accumulator {
  orders: number;
  gross: number;
  discount: number;
  net: number;
  profit: number;
  shipping: number;
  gateways: Map<string, { label: string; count: number }>;
  products: Map<string, { title: string; revenue: number }>;
}

function emptyAccumulator(): Accumulator {
  return { orders: 0, gross: 0, discount: 0, net: 0, profit: 0, shipping: 0, gateways: new Map(), products: new Map() };
}

function addRow(acc: Accumulator, row: OrderRow): void {
  acc.orders++;
  acc.gross += row.gross;
  acc.discount += row.discount;
  acc.net += row.net;
  acc.profit += row.profit;
  acc.shipping += row.shipping;
  const g = acc.gateways.get(row.gateway.key) ?? { label: row.gateway.label, count: 0 };
  g.count++;
  acc.gateways.set(row.gateway.key, g);
  for (const line of row.lines) {
    if (line.productId.startsWith('sub-')) continue;
    const p = acc.products.get(line.productId) ?? { title: line.title, revenue: 0 };
    p.revenue += line.revenue;
    acc.products.set(line.productId, p);
  }
}

function topGatewayLabel(acc: Accumulator): string | undefined {
  let best: { label: string; count: number } | undefined;
  for (const g of acc.gateways.values()) {
    if (!best || g.count > best.count) best = g;
  }
  return best?.label;
}

function topProductTitle(acc: Accumulator): string | undefined {
  let best: { title: string; revenue: number } | undefined;
  for (const p of acc.products.values()) {
    if (!best || p.revenue > best.revenue) best = p;
  }
  return best?.title;
}

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export interface FinanceSummary extends FinancialSummary {
  /** Sum of cost-price snapshots (or estimates) of the countable orders. */
  estimatedCostOrders: number;
  unreconciledOrders: number;
  topProducts: { productId: string; title: string; quantity: number; revenue: number; cost: number; profit: number }[];
}

export interface FinanceReport {
  period: ResolvedFinancePeriod;
  summary: FinanceSummary;
  records: FinanceRecord[];
  /** Header row followed by one row per record, raw numbers, ready to be written as CSV. */
  csvRows: (string | number)[][];
}

export interface FinanceRecord extends FinancialRecord {
  id: string;
  isSubscription: boolean;
  recognizedAt: string;
  costEstimated: boolean;
  reconciled: boolean;
  source: 'ONLINE' | 'ADMIN_MANUAL';
}

const CSV_HEADERS = [
  'ردیف',
  'شماره سفارش',
  'تاریخ ثبت',
  'نام خریدار',
  'شماره موبایل',
  'سطح اشتراک',
  'تعداد اقلام',
  'مبلغ ناخالص کالاها (تومان)',
  'تخفیف اعطا شده (تومان)',
  'کرایه حمل (تومان)',
  'مبلغ خالص پرداختی (تومان)',
  'بهای تمام شده (تومان)',
  'سود سفارش (تومان)',
  'درگاه و روش پرداخت',
  'وضعیت پرداخت',
  'وضعیت سفارش',
  'کد رهگیری',
];

/** Builds the report for a period. anchorDate is any civil date (YYYY-MM-DD) inside the period. */
export function buildFinanceReport(type: FinancePeriodType, anchorDate: string, now: Date = new Date()): FinanceReport {
  const period = resolveFinancePeriod(type, anchorDate);
  const allRows = buildRows(now);
  const inRange = (day: string, start: string, end: string) => day >= start && day < end;
  const rows = allRows
    .filter((r) => inRange(r.dayIso, period.startDate, period.endDate))
    .sort((a, b) => (a.recognizedAt < b.recognizedAt ? 1 : -1));

  // Period totals
  const total = emptyAccumulator();
  rows.forEach((r) => addRow(total, r));

  // Gateways
  const gatewayBreakdown: GatewayRevenue[] = Array.from(total.gateways.entries())
    .map(([key, g]) => {
      const amount = rows.filter((r) => r.gateway.key === key).reduce((s, r) => s + r.net, 0);
      return { gateway: key, label: g.label, totalAmount: amount, count: g.count, percentage: percent(amount, total.net) };
    })
    .sort((a, b) => b.totalAmount - a.totalAmount);

  // Categories (line totals before order-level discounts)
  const catMap = new Map<string, { revenue: number; quantity: number }>();
  for (const r of rows) {
    for (const line of r.lines) {
      const c = catMap.get(line.category) ?? { revenue: 0, quantity: 0 };
      c.revenue += line.revenue;
      c.quantity += line.quantity;
      catMap.set(line.category, c);
    }
  }
  const lineRevenueTotal = Array.from(catMap.values()).reduce((s, c) => s + c.revenue, 0);
  const categoryRevenues: CategoryRevenue[] = Array.from(catMap.entries())
    .map(([category, c]) => ({
      category,
      revenue: c.revenue,
      ordersCount: c.quantity,
      percentage: percent(c.revenue, lineRevenueTotal),
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // Tiers
  const tierAcc: Record<SubscriptionTier, { revenue: number; count: number }> = {
    PRO: { revenue: 0, count: 0 },
    PLUS: { revenue: 0, count: 0 },
    FREE: { revenue: 0, count: 0 },
  };
  for (const r of rows) {
    tierAcc[r.customerTier].revenue += r.net;
    tierAcc[r.customerTier].count++;
  }
  const tierRevenues: TierRevenue[] = (['PRO', 'PLUS', 'FREE'] as SubscriptionTier[]).map((tier) => ({
    tier,
    label: TIER_LABELS[tier],
    revenue: tierAcc[tier].revenue,
    ordersCount: tierAcc[tier].count,
    percentage: percent(tierAcc[tier].revenue, total.net),
  }));

  // Shifts (4 buckets of 6 hours, Tehran time)
  const dailyStats: DailyShiftStat[] = SHIFTS.map((shift, index) => {
    const acc = emptyAccumulator();
    rows.filter((r) => Math.floor(r.hour / 6) === index).forEach((r) => addRow(acc, r));
    return {
      shiftName: shift.name,
      ordersCount: acc.orders,
      grossRevenue: acc.gross,
      totalDiscount: acc.discount,
      netRevenue: acc.net,
      grossProfit: acc.profit,
      averageOrderValue: acc.orders ? Math.round(acc.net / acc.orders) : 0,
      topProduct: topProductTitle(acc),
    };
  });

  // Weekdays, Saturday first
  const weeklyStats: WeeklyDayStat[] = WEEKDAY_NAMES.map((dayName, index) => {
    const acc = emptyAccumulator();
    rows.filter((r) => (isoWeekdayIndex(r.dayIso) + 1) % 7 === index).forEach((r) => addRow(acc, r));
    // A concrete date is shown only when the period is a single day or a week (a weekday in a month has many dates)
    let date = '';
    if (period.type === 'day' || period.type === 'week') {
      for (let offset = 0; offset < 7; offset++) {
        const candidate = addDaysIso(period.startDate, offset);
        if (candidate >= period.endDate) break;
        if ((isoWeekdayIndex(candidate) + 1) % 7 === index) {
          date = formatIsoDateToJalali(candidate).shortDate;
          break;
        }
      }
    }
    return {
      dayName,
      date,
      ordersCount: acc.orders,
      grossRevenue: acc.gross,
      totalDiscount: acc.discount,
      netRevenue: acc.net,
      grossProfit: acc.profit,
      averageOrderValue: acc.orders ? Math.round(acc.net / acc.orders) : 0,
      topGateway: topGatewayLabel(acc),
      isToday: false,
    };
  });

  // Months of the Jalali year that contains the anchor (independent of the selected period)
  const yearWindow = jalaliYearWindow(period.jalaliYear);
  const yearRows = allRows.filter((r) => inRange(r.dayIso, yearWindow.start, yearWindow.end));
  const todayParsed = parseIsoDate(getTehranIsoDate(now));
  const todayJalali = todayParsed ? gregorianToJalali(todayParsed.year, todayParsed.month, todayParsed.day) : [0, 0, 0];
  const monthlyStats: MonthlyFinancialStat[] = PERSIAN_MONTHS.map((monthName, index) => {
    const monthNumber = index + 1;
    const acc = emptyAccumulator();
    for (const r of yearRows) {
      const p = parseIsoDate(r.dayIso);
      if (!p) continue;
      const [, jm] = gregorianToJalali(p.year, p.month, p.day);
      if (jm === monthNumber) addRow(acc, r);
    }
    return {
      monthIndex: monthNumber,
      monthName,
      year: period.jalaliYear,
      ordersCount: acc.orders,
      grossRevenue: acc.gross,
      totalDiscount: acc.discount,
      netRevenue: acc.net,
      grossProfit: acc.profit,
      averageOrderValue: acc.orders ? Math.round(acc.net / acc.orders) : 0,
      topGateway: topGatewayLabel(acc),
      isCurrentMonth: monthNumber === todayJalali[1] && period.jalaliYear === todayJalali[0],
    };
  });

  // Top products (line revenue after subscription discounts, before the coupon)
  const productTotals = new Map<string, { title: string; quantity: number; revenue: number; cost: number }>();
  for (const r of rows) {
    for (const line of r.lines) {
      if (line.productId.startsWith('sub-')) continue;
      const p = productTotals.get(line.productId) ?? { title: line.title, quantity: 0, revenue: 0, cost: 0 };
      p.quantity += line.quantity;
      p.revenue += line.revenue;
      p.cost += line.cost;
      productTotals.set(line.productId, p);
    }
  }
  const topProducts = Array.from(productTotals.entries())
    .map(([productId, p]) => ({ productId, ...p, profit: p.revenue - p.cost }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const subscriptionRevenue = rows.filter((r) => r.isSubscription).reduce((s, r) => s + r.net, 0);
  const selectedPeriodLabel = period.label;
  const summary: FinanceSummary = {
    grossRevenue: total.gross,
    totalDiscount: total.discount,
    netRevenue: total.net,
    totalShipping: total.shipping,
    averageOrderValue: total.orders ? Math.round(total.net / total.orders) : 0,
    totalOrdersCount: total.orders,
    subscriptionRevenue,
    totalCost: rows.reduce((s, r) => s + r.cost, 0),
    grossProfit: total.profit,
    profitMarginPercent: percent(total.profit, total.net),
    gatewayBreakdown,
    categoryRevenues,
    tierRevenues,
    monthlyStats,
    weeklyStats,
    dailyStats,
    selectedPeriodLabel,
    selectedMonthName: selectedPeriodLabel,
    estimatedCostOrders: rows.filter((r) => r.costEstimated).length,
    unreconciledOrders: rows.filter((r) => !r.reconciled).length,
    topProducts,
  };

  const records: FinanceRecord[] = rows.map((r) => ({
    id: r.orderId,
    orderNumber: r.orderNumber,
    createdAt: r.recognizedAt,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    customerTier: r.customerTier,
    grossAmount: r.gross,
    discountAmount: r.discount,
    shippingFee: r.shipping,
    netPayableAmount: r.net,
    paymentGateway: r.gateway.label,
    paymentStatus: r.paymentStatus,
    orderStatus: r.orderStatus,
    itemCount: r.itemCount,
    costAmount: r.cost,
    profitAmount: r.profit,
    settlementStatus: 'SETTLED',
    settlementRef: r.settlementRef,
    isSubscription: r.isSubscription,
    recognizedAt: r.recognizedAt,
    costEstimated: r.costEstimated,
    reconciled: r.reconciled,
    source: r.source,
  }));

  const orderStatusLabel: Record<string, string> = {
    PENDING_PAYMENT: 'در انتظار پرداخت',
    PROCESSING: 'در حال پردازش',
    OUT_FOR_DELIVERY: 'تحویل به پیک',
    DELIVERED: 'تحویل داده شده',
    CANCELLED: 'لغو شده',
  };
  const csvRows: (string | number)[][] = [
    CSV_HEADERS,
    ...records.map((r, index) => [
      index + 1,
      r.orderNumber,
      r.createdAt,
      r.customerName,
      r.customerPhone,
      TIER_CSV_LABELS[r.customerTier],
      r.itemCount,
      r.grossAmount,
      r.discountAmount,
      r.shippingFee,
      r.netPayableAmount,
      r.costAmount ?? 0,
      r.profitAmount ?? 0,
      r.paymentGateway,
      r.paymentStatus === 'SUCCESS' ? 'موفق' : 'ناموفق',
      orderStatusLabel[r.orderStatus] || r.orderStatus,
      r.settlementRef || '-',
    ]),
  ];

  return { period, summary, records, csvRows };
}
