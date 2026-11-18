import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { apiErrorResponse } from '@/lib/api-errors';
import { isIsoDate, jsonError, jsonOk } from '@/lib/admin-api';
import { buildFinanceReport, FINANCE_PERIOD_TYPES, FinancePeriodType } from '@/lib/admin-finance';
import { getTehranIsoDate } from '@/lib/jalali';

export const dynamic = 'force-dynamic';

/**
 * GET ?period=day|week|month|year (default month) &date=YYYY-MM-DD (any day inside the period, default today in Tehran).
 * Returns { period, summary, records, csvRows }. summary is a superset of the FinancialSummary the finance page reads
 * (same field names), plus estimatedCostOrders, unreconciledOrders and topProducts.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const periodParam = searchParams.get('period') || 'month';
    const dateParam = searchParams.get('date');

    if (!FINANCE_PERIOD_TYPES.includes(periodParam as FinancePeriodType)) {
      return jsonError(400, 'بازه گزارش نامعتبر است (day، week، month یا year).');
    }
    if (dateParam !== null && !isIsoDate(dateParam)) {
      return jsonError(400, 'تاریخ گزارش باید به صورت YYYY-MM-DD و معتبر باشد.');
    }

    const anchor = dateParam ?? getTehranIsoDate(new Date());
    const report = buildFinanceReport(periodParam as FinancePeriodType, anchor);
    return jsonOk({
      period: report.period,
      summary: report.summary,
      records: report.records,
      csvRows: report.csvRows,
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/finance GET', 'خطا در محاسبه گزارش مالی');
  }
}
