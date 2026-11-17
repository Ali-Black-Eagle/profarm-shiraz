/**
 * Jalali (Shamsi) calendar conversion and delivery slot generator
 */
import { toPersianDigits } from './formatters';
import { SubscriptionTier } from '@/types';

export const PERSIAN_WEEKDAYS = [
  'یکشنبه', // 0: Sunday
  'دوشنبه', // 1: Monday
  'سه‌شنبه', // 2: Tuesday
  'چهارشنبه', // 3: Wednesday
  'پنج‌شنبه', // 4: Thursday
  'جمعه', // 5: Friday (No delivery)
  'شنبه', // 6: Saturday
];

export const PERSIAN_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

/**
 * Converts Gregorian date to Jalali date [year, month, day]
 */
export function gregorianToJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy: number;
  if (gy > 1600) {
    jy = 979;
    gy -= 1600;
  } else {
    jy = 0;
    gy -= 621;
  }
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) -
    80 +
    gd +
    g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let jm: number;
  let jd: number;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  return [jy, jm, jd];
}

export interface FormattedJalaliDate {
  year: number;
  month: number;
  day: number;
  monthName: string;
  dayOfWeek: string; // 'شنبه', 'یکشنبه', ...
  dayOfWeekIndex: number; // 0 to 6
  formattedDate: string; // "یکشنبه ۱۸ شهریور ۱۴۰۵"
  shortDate: string; // "۱۴۰۵/۰۶/۱۸"
  isoDateString: string; // "2026-09-09"
}

export function formatToJalali(date: Date): FormattedJalaliDate {
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();
  const [jy, jm, jd] = gregorianToJalali(gy, gm, gd);

  const dayOfWeekIndex = date.getDay(); // 0 is Sunday
  const dayOfWeek = PERSIAN_WEEKDAYS[dayOfWeekIndex];
  const monthName = PERSIAN_MONTHS[jm - 1];

  const paddedMonth = jm.toString().padStart(2, '0');
  const paddedDay = jd.toString().padStart(2, '0');

  return {
    year: jy,
    month: jm,
    day: jd,
    monthName,
    dayOfWeek,
    dayOfWeekIndex,
    formattedDate: `${dayOfWeek} ${toPersianDigits(jd)} ${monthName}`,
    shortDate: toPersianDigits(`${jy}/${paddedMonth}/${paddedDay}`),
    isoDateString: date.toISOString().split('T')[0],
  };
}

export interface SlotOption {
  id: string;
  dateStr: string;
  jalali: FormattedJalaliDate;
  timeWindow: string; // "۱۵:۰۰ الی ۲۱:۰۰ (۳ ظهر الی ۹ شب)"
  timeWindowId: string;
  maxCapacity: number;
  currentBookings: number;
  remainingCapacity: number;
  isAvailable: boolean;
  isAllowedForTier: boolean; // Based on Pro vs Regular
  tierRestrictionNote?: string;
}

/**
 * Core business logic for delivery day eligibility:
 * - Regular (FREE) & PLUS: Sunday (0) and Wednesday (3) (2 scheduled days per week).
 * - Pro (PRO): Saturday to Thursday (6, 0, 1, 2, 3, 4) - excluding Friday (5).
 */
export function isDayAllowedForUser(
  dayOfWeekIndex: number,
  tierOrIsPro: SubscriptionTier | boolean = false
): boolean {
  // Friday (5) is always closed (holiday/farm maintenance)
  if (dayOfWeekIndex === 5) return false;

  const isPro =
    typeof tierOrIsPro === 'boolean'
      ? tierOrIsPro
      : tierOrIsPro === 'PRO';

  if (isPro) {
    // Pro users can choose Saturday, Sunday, Monday, Tuesday, Wednesday, Thursday
    return [6, 0, 1, 2, 3, 4].includes(dayOfWeekIndex);
  } else {
    // Regular and Plus users can choose Sunday (0) and Wednesday (3)
    return [0, 3].includes(dayOfWeekIndex);
  }
}

/**
 * Generates forward delivery slots starting tomorrow for the next 10-14 days.
 * The delivery time window is exclusively 15:00 to 21:00 (3 PM to 9 PM).
 * If filterDisallowedDays is true, days not permitted for the user's tier are omitted entirely.
 */
export function generateDeliverySlots(
  tierOrIsPro: SubscriptionTier | boolean = false,
  daysAhead = 12,
  capacityOverrides?: Record<string, { maxCapacity?: number; currentBookings?: number; isClosedManually?: boolean }>,
  filterDisallowedDays = false
): SlotOption[] {
  const slots: SlotOption[] = [];
  const now = new Date();

  // Start from tomorrow (orders must be booked at least 1 day in advance for fresh harvest)
  for (let i = 1; i <= daysAhead; i++) {
    const targetDate = new Date();
    targetDate.setDate(now.getDate() + i);

    const dayOfWeekIndex = targetDate.getDay();
    // Friday is holiday
    if (dayOfWeekIndex === 5) continue;

    const jalali = formatToJalali(targetDate);
    const isAllowedForTier = isDayAllowedForUser(dayOfWeekIndex, tierOrIsPro);

    // If caller requests physical omission of disallowed days:
    if (filterDisallowedDays && !isAllowedForTier) {
      continue;
    }

    const override = capacityOverrides?.[jalali.isoDateString];
    const maxCapacity = override?.maxCapacity ?? 30;

    // Mock capacity numbers for realistic simulation or use override
    const pseudoRand = (targetDate.getDate() * 7 + i) % 15;
    const currentBookings = override?.currentBookings !== undefined
      ? override.currentBookings
      : Math.min(maxCapacity, 14 + pseudoRand);
    const isClosedManually = override?.isClosedManually ?? false;

    const remainingCapacity = isClosedManually ? 0 : Math.max(0, maxCapacity - currentBookings);
    const isAvailable = isAllowedForTier && !isClosedManually && remainingCapacity > 0;

    // Single unified delivery window for Shiraz: 15:00 to 21:00 (3 PM to 9 PM)
    slots.push({
      id: `${jalali.isoDateString}-15-21`,
      dateStr: jalali.formattedDate,
      jalali,
      timeWindow: '۱۵:۰۰ الی ۲۱:۰۰ (۳ ظهر الی ۹ شب)',
      timeWindowId: '15-21',
      maxCapacity,
      currentBookings: isClosedManually ? maxCapacity : currentBookings,
      remainingCapacity,
      isAvailable,
      isAllowedForTier,
      tierRestrictionNote: !isAllowedForTier
        ? 'مخصوص مشترکین «پروفارم پرو» (ارسال روزانه)'
        : undefined,
    });
  }

  return slots;
}

