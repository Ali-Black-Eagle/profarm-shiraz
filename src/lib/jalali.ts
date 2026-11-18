/**
 * Jalali (Shamsi) calendar conversion and delivery slot helpers.
 *
 * All calendar math is done on civil dates (YYYY-MM-DD) in the Asia/Tehran time zone, never on the
 * server's or the browser's local time zone. Iran has used a fixed UTC+03:30 offset since it abolished
 * DST in 2022, so end-of-day expiry instants use that offset explicitly.
 */
import { SubscriptionTier } from '@/types';

export const TEHRAN_TZ = 'Asia/Tehran';
const TEHRAN_OFFSET = '+03:30';
const DAY_MS = 24 * 60 * 60 * 1000;

/** Default daily delivery capacity (orders per day) when the admin has not overridden it. */
export const DEFAULT_DAILY_CAPACITY = 30;
/** How far ahead customers can book a delivery slot, in days. */
export const MAX_BOOKING_DAYS_AHEAD = 30;

/** Delivery windows. Shiraz currently has a single window: 15:00 to 21:00. */
export const SLOT_WINDOWS = {
  '15-21': 'بازه ۱۵:۰۰ الی ۲۱:۰۰ (۳ ظهر الی ۹ شب)',
} as const;
export const DEFAULT_SLOT_WINDOW = '15-21';
export const SLOT_TIME_LABEL = '۱۵:۰۰ الی ۲۱:۰۰ (۳ ظهر الی ۹ شب)';

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

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
function toFa(input: string | number): string {
  return String(input).replace(/[0-9]/g, (w) => PERSIAN_DIGITS[+w]);
}
function toEn(input: string): string {
  return input.replace(/[۰-۹]/g, (c) => String(PERSIAN_DIGITS.indexOf(c)));
}

/**
 * Converts a Gregorian civil date to Jalali [year, month, day].
 * Pure arithmetic on the given y/m/d; it does not depend on any time zone.
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

/**
 * Converts a Jalali civil date to a Gregorian {y, m, d} (m is 1-based).
 * Found by binary search over the monotone gregorianToJalali mapping, so it stays exact.
 * Returns null for dates outside a sane range or for days that do not exist (e.g. 1404/12/30 in a non-leap year).
 */
export function jalaliToGregorian(jy: number, jm: number, jd: number): { y: number; m: number; d: number } | null {
  if (!Number.isInteger(jy) || !Number.isInteger(jm) || !Number.isInteger(jd)) return null;
  if (jy < 1000 || jy > 1600 || jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
  const target = [jy, jm, jd];
  const cmp = (a: number[], b: number[]) => {
    for (let i = 0; i < 3; i++) {
      if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
    }
    return 0;
  };
  // Gregorian year is roughly jy + 621. Search a window around it.
  let lo = Math.floor(Date.UTC(jy + 620, 0, 1) / DAY_MS);
  let hi = Math.floor(Date.UTC(jy + 623, 11, 31) / DAY_MS);
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const dt = new Date(mid * DAY_MS);
    const j = gregorianToJalali(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
    const c = cmp(j, target);
    if (c === 0) {
      return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
    }
    if (c < 0) lo = mid + 1;
    else hi = mid - 1;
  }
  return null;
}

/** Civil date parts (Tehran) of an instant. */
export function getTehranParts(date: Date = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TEHRAN_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

/** Tehran civil date of an instant, as YYYY-MM-DD. */
export function getTehranIsoDate(date: Date = new Date()): string {
  const { year, month, day } = getTehranParts(date);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Parses YYYY-MM-DD strictly (must be a real calendar date). */
export function parseIsoDate(iso: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) return null;
  return { year, month, day };
}

/** Day of week (0 = Sunday ... 6 = Saturday) of a civil date. Time-zone independent. */
export function isoWeekdayIndex(iso: string): number {
  const p = parseIsoDate(iso);
  if (!p) return -1;
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
}

/** Adds n days to a civil date (YYYY-MM-DD). Time-zone independent. */
export function addDaysIso(iso: string, n: number): string {
  const p = parseIsoDate(iso);
  if (!p) throw new Error(`Invalid ISO date: ${iso}`);
  const dt = new Date(Date.UTC(p.year, p.month - 1, p.day + n));
  return dt.toISOString().slice(0, 10);
}

/** Jalali parts and labels for a civil date (YYYY-MM-DD). */
export function formatIsoDateToJalali(iso: string): FormattedJalaliDate {
  const p = parseIsoDate(iso);
  if (!p) throw new Error(`Invalid ISO date: ${iso}`);
  const [jy, jm, jd] = gregorianToJalali(p.year, p.month, p.day);
  const dayOfWeekIndex = isoWeekdayIndex(iso);
  const dayOfWeek = PERSIAN_WEEKDAYS[dayOfWeekIndex];
  const monthName = PERSIAN_MONTHS[jm - 1];
  return {
    year: jy,
    month: jm,
    day: jd,
    monthName,
    dayOfWeek,
    dayOfWeekIndex,
    formattedDate: `${dayOfWeek} ${toFa(jd)} ${monthName}`,
    jalaliLabel: `${dayOfWeek} ${toFa(jd)} ${monthName} ${toFa(jy)}`,
    shortDate: toFa(`${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`),
    isoDateString: iso,
  };
}

export interface FormattedJalaliDate {
  year: number;
  month: number;
  day: number;
  monthName: string;
  dayOfWeek: string; // 'شنبه', 'یکشنبه', ...
  dayOfWeekIndex: number; // 0 to 6 (Tehran calendar)
  formattedDate: string; // "یکشنبه ۱۸ شهریور"
  jalaliLabel: string; // "یکشنبه ۱۸ شهریور ۱۴۰۵"
  shortDate: string; // "۱۴۰۵/۰۶/۱۸"
  isoDateString: string; // "2026-09-09" (Tehran civil date)
}

/** Jalali parts for an instant, using the Asia/Tehran civil date. */
export function formatToJalali(date: Date = new Date()): FormattedJalaliDate {
  return formatIsoDateToJalali(getTehranIsoDate(date));
}

/** Canonical slot id for a civil date and window, e.g. `2026-11-22_15-21`. */
export function buildSlotId(isoDate: string, window: string = DEFAULT_SLOT_WINDOW): string {
  return `${isoDate}_${window}`;
}

/**
 * Parses a slot id. Returns null for anything that is not a canonical id of a known window on a real date.
 * dayOfWeekIndex is derived from the date (Tehran calendar), never supplied by the client.
 */
export function parseSlotId(
  id: unknown
): { isoDate: string; window: string; dayOfWeekIndex: number } | null {
  if (typeof id !== 'string') return null;
  const m = /^(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2})$/.exec(id.trim());
  if (!m) return null;
  const [, isoDate, window] = m;
  if (!(window in SLOT_WINDOWS)) return null;
  if (!parseIsoDate(isoDate)) return null;
  return { isoDate, window, dayOfWeekIndex: isoWeekdayIndex(isoDate) };
}

/**
 * Parses an expiry or start value and returns an epoch-ms instant.
 * - ISO timestamps (YYYY-MM-DDTHH:mm...) are exact instants.
 * - Date-only values are Tehran civil dates. Gregorian ones (year >= 1500) and Jalali ones (year < 1500,
 *   written with - or /, Persian digits allowed) are both accepted. The `end` flag returns the last
 *   millisecond of that day, and otherwise the first millisecond.
 * Returns null when the value cannot be read.
 */
export function parseTehranDateValue(value: unknown, end: boolean): number | null {
  if (value === null || value === undefined) return null;
  const s = toEn(String(value)).trim().replace(/\//g, '-');
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const ms = Date.parse(s);
    return Number.isNaN(ms) ? null : ms;
  }

  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  let g: { y: number; m: number; d: number } | null;
  if (y < 1500) {
    g = jalaliToGregorian(y, mo, d);
  } else {
    g = parseIsoDate(`${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
      ? { y, m: mo, d }
      : null;
  }
  if (!g) return null;
  const iso = `${g.y}-${String(g.m).padStart(2, '0')}-${String(g.d).padStart(2, '0')}`;
  const time = end ? 'T23:59:59.999' : 'T00:00:00.000';
  const ms = Date.parse(`${iso}${time}${TEHRAN_OFFSET}`);
  return Number.isNaN(ms) ? null : ms;
}

/** Whether a delivery day is allowed for a tier (Friday is always closed). */
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

export interface SlotCapacityOverride {
  maxCapacity?: number;
  currentBookings?: number;
  isClosedManually?: boolean;
}

/**
 * Generates the next `daysAhead` delivery slots, starting tomorrow (Tehran calendar).
 * Deterministic: the same date always gives the same id and the same numbers for the same overrides.
 * capacityOverrides is keyed by civil date (YYYY-MM-DD). Without an override a day has no bookings.
 */
export function generateDeliverySlots(
  tierOrIsPro: SubscriptionTier | boolean = false,
  daysAhead = 12,
  capacityOverrides?: Record<string, SlotCapacityOverride>,
  filterDisallowedDays = false,
  now: Date = new Date()
): SlotOption[] {
  const slots: SlotOption[] = [];
  const today = getTehranIsoDate(now);

  for (let i = 1; i <= daysAhead; i++) {
    const isoDate = addDaysIso(today, i);
    const jalali = formatIsoDateToJalali(isoDate);
    const dayOfWeekIndex = jalali.dayOfWeekIndex;
    // Friday is holiday
    if (dayOfWeekIndex === 5) continue;

    const isAllowedForTier = isDayAllowedForUser(dayOfWeekIndex, tierOrIsPro);
    if (filterDisallowedDays && !isAllowedForTier) {
      continue;
    }

    const override = capacityOverrides?.[isoDate];
    const maxCapacity = override?.maxCapacity ?? DEFAULT_DAILY_CAPACITY;
    const currentBookings = Math.min(maxCapacity, Math.max(0, override?.currentBookings ?? 0));
    const isClosedManually = override?.isClosedManually ?? false;

    const remainingCapacity = isClosedManually ? 0 : Math.max(0, maxCapacity - currentBookings);
    const isAvailable = isAllowedForTier && !isClosedManually && remainingCapacity > 0;

    slots.push({
      id: buildSlotId(isoDate, DEFAULT_SLOT_WINDOW),
      dateStr: jalali.jalaliLabel,
      jalali,
      timeWindow: SLOT_TIME_LABEL,
      timeWindowId: DEFAULT_SLOT_WINDOW,
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
