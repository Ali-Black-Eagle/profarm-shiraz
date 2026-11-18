/**
 * Validation for admin-editable settings (subscription plans and CMS site content).
 *
 * The allowed keys come from the default objects in store-defaults.ts, so unknown keys are dropped
 * (zod strips them) and can never be written. Each field has a type, a length or range limit, and for
 * URLs a scheme policy. Used by POST /api/admin (legacy actions) and POST /api/subscriptions.
 */
import { z } from 'zod';
import { normalizeNumeric } from './admin-api';
import { DEFAULT_SITE_CONTENT, DEFAULT_SUBSCRIPTION_SETTINGS } from './store-defaults';

/** Largest accepted uploaded image as a data URL (the CMS caps files at 5 MB before base64 encoding). */
const MAX_DATA_IMAGE_CHARS = 7_000_000;
const DATA_IMAGE_RE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

/**
 * URL policy for CMS links and images:
 *  - empty string (no link),
 *  - a site-relative path such as /images/x.jpg (not protocol-relative, no backslashes or control characters),
 *  - an https: URL,
 *  - for image fields only: a base64 data URL of png, jpeg, webp or gif.
 * http:, javascript:, protocol-relative and any other scheme are refused.
 */
export function isAllowedCmsUrl(value: string, allowDataImage = false): boolean {
  const v = value.trim();
  if (v === '') return true;
  if (/[\\\u0000-\u001f\u007f]/.test(v)) return false;
  if (v.startsWith('/')) return !v.startsWith('//');
  if (v.startsWith('data:')) {
    return allowDataImage && v.length <= MAX_DATA_IMAGE_CHARS && DATA_IMAGE_RE.test(v);
  }
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
}

const URL_MESSAGE = 'آدرس نامعتبر است. فقط آدرس https یا مسیر داخلی سایت (مانند /images/...) مجاز است.';
const IMAGE_MESSAGE = 'تصویر نامعتبر است. فقط تصویر png، jpeg، webp یا gif با حجم مجاز مجاز است.';

// ---------------------------------------------------------------------------
// Site content (CMS). Every key of DEFAULT_SITE_CONTENT is allowed.
// ---------------------------------------------------------------------------

const siteContentShape: Record<string, z.ZodTypeAny> = {};
for (const [key, defaultValue] of Object.entries(DEFAULT_SITE_CONTENT)) {
  if (typeof defaultValue === 'boolean') {
    siteContentShape[key] = z.boolean();
  } else if (typeof defaultValue === 'number') {
    siteContentShape[key] = z.number().finite();
  } else if (/ImageUrl$/.test(key)) {
    siteContentShape[key] = z
      .string()
      .max(MAX_DATA_IMAGE_CHARS)
      .refine((v) => isAllowedCmsUrl(v, true), { message: IMAGE_MESSAGE });
  } else if (/^social/.test(key) || /Url$/.test(key)) {
    siteContentShape[key] = z
      .string()
      .max(2048)
      .refine((v) => isAllowedCmsUrl(v, false), { message: URL_MESSAGE });
  } else {
    siteContentShape[key] = z.string().max(3000, 'متن نمی‌تواند بیشتر از ۳۰۰۰ نویسه باشد');
  }
}

/** Partial update of the site content. Unknown keys are stripped. */
export const siteContentPatchSchema = z.object(siteContentShape).partial();

// ---------------------------------------------------------------------------
// Subscription settings. Every key of DEFAULT_SUBSCRIPTION_SETTINGS is allowed.
// ---------------------------------------------------------------------------

const subscriptionShape: Record<string, z.ZodTypeAny> = {};
for (const [key, defaultValue] of Object.entries(DEFAULT_SUBSCRIPTION_SETTINGS)) {
  if (Array.isArray(defaultValue)) {
    subscriptionShape[key] = z.array(z.string().max(300, 'هر مزیت نمی‌تواند بیشتر از ۳۰۰ نویسه باشد')).max(30);
  } else if (typeof defaultValue === 'number') {
    let rule = z.number().finite().min(0, 'نمی‌تواند منفی باشد');
    if (/Percent$/.test(key)) rule = rule.max(100, 'درصد نمی‌تواند بیشتر از ۱۰۰ باشد');
    if (/DeliveryDays/.test(key)) rule = rule.int().max(7, 'تعداد روز تحویل در هفته نمی‌تواند بیشتر از ۷ باشد');
    if (/Quota|MaxCapacity/.test(key)) rule = rule.int('باید عدد صحیح باشد');
    subscriptionShape[key] = z.preprocess(normalizeNumeric, rule);
  } else if (typeof defaultValue === 'string' || defaultValue === undefined) {
    subscriptionShape[key] = z.string().max(500, 'متن نمی‌تواند بیشتر از ۵۰۰ نویسه باشد');
  } else if (typeof defaultValue === 'boolean') {
    subscriptionShape[key] = z.boolean();
  }
}

/** Partial update of the subscription settings. Unknown keys are stripped. */
export const subscriptionSettingsPatchSchema = z.object(subscriptionShape).partial();

// ---------------------------------------------------------------------------
// Legacy POST /api/admin action updateUserSubscription.
// Same rules as PATCH /api/admin/users: tier FREE | PLUS | PRO, months 1 to 24.
// ---------------------------------------------------------------------------

export const legacyUserSubscriptionSchema = z.object({
  identifier: z.string().trim().min(1, 'شناسه کاربر الزامی است').max(200),
  tier: z.enum(['FREE', 'PLUS', 'PRO'], { error: 'سطح اشتراک نامعتبر است' }),
  months: z
    .preprocess(
      normalizeNumeric,
      z.number().int('مدت اشتراک باید عدد صحیح باشد').min(1, 'مدت اشتراک حداقل ۱ ماه است').max(24, 'مدت اشتراک حداکثر ۲۴ ماه است')
    )
    .optional(),
});
