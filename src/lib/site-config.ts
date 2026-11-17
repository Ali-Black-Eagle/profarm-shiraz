/**
 * Single source of truth for ProFarm Shiraz business policies,
 * official contact channels, return windows, and bulk thresholds.
 */

export const SITE_CONFIG = {
  brandName: 'پروفارم شیراز',
  brandFullName: 'مزارع ارگانیک و محلی پروفارم شیراز',

  contact: {
    /** Official retail customer support landline */
    supportPhoneDisplay: '۰۷۱-۳۶۲۸۰۰۰۰',
    supportPhoneTel: '+987136280000',
    supportHours: 'همه‌روزه از ۸ صبح الی ۲۲ شب',

    /** Official wholesale & B2B desk landline */
    wholesalePhoneDisplay: '۰۷۱-۳۲۲۲۱۱۰۰',
    wholesalePhoneTel: '+987132221100',
    wholesaleHours: 'شنبه تا چهارشنبه: ۸ صبح الی ۱۷ عصر',

    /** Official headquarters address */
    address: 'شیراز، بلوار ارم، مرکز پخش و کنترل کیفیت مزارع پروفارم',
    email: 'support@profarm-shiraz.ir',
  },

  policies: {
    /** Fresh perishable farm products return window */
    freshReturnHours: 24,
    freshReturnLabel: 'ضمانت بازگشت و تعویض تا ۲۴ ساعت پس از تحویل',
    freshReturnShort: 'بازگشت کالا تا ۲۴ ساعت',

    /** Subscription cancellation / refund guarantee (separate from perishable produce) */
    subscriptionRefundDays: 7,
    subscriptionRefundLabel: 'ضمانت بازگشت وجه اشتراک تا ۷ روز (در صورت عدم استفاده از مزایا)',

    /** Wholesale / bulk threshold standardized across all pages */
    bulkMinPacks: 10,
    bulkThresholdLabel: 'حداقل ۱۰ بسته از یک محصول',
    bulkDeliveryScope: 'ارسال به سراسر کشور (فارس، تهران، اصفهان، بوشهر و کلیه استان‌ها)',
    retailDeliveryScope: 'تحویل اختصاصی با پیک یخچالی در مناطق شهری شیراز (ساعت ۱۵:۰۰ الی ۲۱:۰۰)',
  },
} as const;

/**
 * Shared Persian order status labels & badge styles (single source of truth
 * across Account, Admin Dashboard, Orders, and Manifest).
 */
export const ORDER_STATUS_META: Record<
  string,
  { label: string; shortLabel: string; badgeClass: string }
> = {
  PENDING_PAYMENT: {
    label: 'در انتظار پرداخت',
    shortLabel: 'در انتظار پرداخت',
    badgeClass: 'bg-amber-100 text-amber-900 border border-amber-200',
  },
  PROCESSING: {
    label: 'در حال آماده‌سازی در مزرعه',
    shortLabel: 'آماده‌سازی',
    badgeClass: 'bg-sky-100 text-sky-900 border border-sky-200',
  },
  OUT_FOR_DELIVERY: {
    label: 'تحویل به پیک شیراز',
    shortLabel: 'ارسال با پیک',
    badgeClass: 'bg-indigo-100 text-indigo-900 border border-indigo-200',
  },
  DELIVERED: {
    label: 'تحویل داده شد',
    shortLabel: 'تحویل‌شده',
    badgeClass: 'bg-emerald-100 text-emerald-900 border border-emerald-200',
  },
  CANCELLED: {
    label: 'لغو شده',
    shortLabel: 'لغوشده',
    badgeClass: 'bg-rose-100 text-rose-900 border border-rose-200',
  },
};

export function getOrderStatusMeta(status: string | undefined | null) {
  if (!status) return ORDER_STATUS_META.PENDING_PAYMENT;
  return (
    ORDER_STATUS_META[status] || {
      label: status,
      shortLabel: status,
      badgeClass: 'bg-gray-100 text-gray-800 border border-gray-200',
    }
  );
}
