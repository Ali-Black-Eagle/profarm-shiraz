import { NextRequest, NextResponse } from 'next/server';
import { farmStore } from '@/lib/db-store';
import { getSessionFromRequest } from '@/lib/session';
import { getEffectiveTier } from '@/lib/subscription';
import { apiErrorResponse } from '@/lib/api-errors';
import { formatIsoDateToJalali, MAX_BOOKING_DAYS_AHEAD } from '@/lib/jalali';

export const dynamic = 'force-dynamic';

/**
 * GET /api/delivery-slots?days=14
 * Upcoming Shiraz delivery slots for the caller's tier (guests are priced as FREE).
 * Each slot reports whether it is closed, full, allowed for the tier, and how many places remain.
 * Friday is never offered.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const daysRaw = searchParams.get('days');
    const parsedDays = daysRaw ? Math.floor(Number(daysRaw)) : NaN;
    const days = Number.isFinite(parsedDays) ? Math.min(MAX_BOOKING_DAYS_AHEAD, Math.max(1, parsedDays)) : 14;

    const session = getSessionFromRequest(req);
    const user = session ? farmStore.getAllUsers().find((u) => u.id === session.userId) ?? null : null;
    const tier = getEffectiveTier(user);

    const slots = farmStore.getAvailableSlotsForUser(user, days).map((slot) => {
      const j = formatIsoDateToJalali(slot.isoDate);
      const isFull = !slot.isClosed && slot.remainingCapacity <= 0;
      return {
        id: slot.id,
        isoDate: slot.isoDate,
        window: slot.window,
        jalaliLabel: slot.jalaliLabel,
        shortDate: j.shortDate,
        dayOfWeek: j.dayOfWeek,
        dayOfWeekIndex: slot.dayOfWeekIndex,
        maxCapacity: slot.maxCapacity,
        bookedCount: slot.bookedCount,
        remainingCapacity: slot.remainingCapacity,
        isClosed: slot.isClosed,
        isFull,
        isAllowedForTier: slot.isAllowedForTier,
        isAvailable: slot.isAvailable,
      };
    });

    return NextResponse.json(
      { success: true, tier, days, slots },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    return apiErrorResponse(error, 'delivery-slots GET', 'خطا در دریافت سانس‌های تحویل');
  }
}
