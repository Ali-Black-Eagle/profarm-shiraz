/**
 * Utility functions for Persian digits, formatting currency, and strings
 */

import { CartItem, SubscriptionTier, SubscriptionSettings } from '@/types';

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
const ENGLISH_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function toPersianDigits(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '';
  const str = String(input);
  return str.replace(/[0-9]/g, (w) => PERSIAN_DIGITS[+w]);
}

export function toEnglishDigits(input: string | null | undefined): string {
  if (!input) return '';
  let str = input;
  for (let i = 0; i < 10; i++) {
    str = str
      .replace(new RegExp(PERSIAN_DIGITS[i], 'g'), ENGLISH_DIGITS[i])
      .replace(new RegExp(ARABIC_DIGITS[i], 'g'), ENGLISH_DIGITS[i]);
  }
  return str;
}

export function formatToman(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '۰ تومان';
  const formatted = amount.toLocaleString('en-US');
  return `${toPersianDigits(formatted)} تومان`;
}

export function formatNumber(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '۰';
  return toPersianDigits(amount.toLocaleString('en-US'));
}

export function normalizePhoneNumber(phone: string): string {
  const english = toEnglishDigits(phone.trim().replace(/\s+/g, ''));
  if (english.startsWith('+98')) {
    return '0' + english.substring(3);
  }
  if (english.startsWith('98')) {
    return '0' + english.substring(2);
  }
  return english;
}

export function isValidIranPhone(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  return /^09[0-9]{9}$/.test(normalized);
}

/**
 * Safely serializes an object into a JSON string suitable for inline <script type="application/ld+json">
 * tags by escaping `<`, `>`, `&`, and line separators to prevent script tag breakout and XSS.
 */
export function safeJsonLdStringify(data: any): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Deduplicates subscription visual perks against real system properties.
 * Filters out any perks that re-state numbers already shown dynamically
 * (e.g. egg discounts, quota, delivery days, shipping fee discounts).
 */
export function getDeduplicatedPerks(features: string[] | undefined | null): string[] {
  if (!features || !Array.isArray(features)) return [];

  return features.filter((perk) => {
    if (!perk || typeof perk !== 'string') return false;
    const p = perk.trim();
    if (!p) return false;

    // Check if this perk duplicates egg discount or quota
    if (p.includes('تخم‌مرغ') && (p.includes('تخفیف') || p.includes('سقف') || p.includes('عدد'))) {
      return false;
    }
    // Check if this perk duplicates delivery days
    if (p.includes('تحویل') && (p.includes('روز در هفته') || p.includes('روزهای فرد') || p.includes('شنبه تا') || p.includes('روزانه'))) {
      return false;
    }
    // Check if this perk duplicates shipping discount or shipping fee
    if ((p.includes('ارسال') || p.includes('پیک')) && (p.includes('تخفیف') || p.includes('کرایه') || p.includes('هزینه') || p.includes('تعرفه'))) {
      return false;
    }
    // Check if this perk duplicates other goods discount
    if ((p.includes('سایر') || p.includes('بقیه')) && p.includes('تخفیف')) {
      return false;
    }
    // Check if this perk duplicates "تعرفه عادی بدون تخفیف"
    if (p.includes('تعرفه عادی') && p.includes('بدون تخفیف')) {
      return false;
    }

    return true;
  });
}

export function isValidEmail(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export interface CartDiscountLine {
  /** Eggs on this line (packs * eggs per pack). */
  eggCount: number;
  /** Eggs on this line that received the subscription egg discount (within the quota). */
  eggDiscountedCount: number;
  /** Subscription discount on this line (egg + other goods), تومان. */
  discount: number;
}

export interface CartDiscounts {
  eggDiscount: number;
  eggCount: number;
  eggQuota: number;
  usedEggQuotaThisMonth: number;
  remainingEggQuota: number;
  eggCapExceeded: boolean;
  otherDiscount: number;
  shippingDiscount: number;
  totalDiscount: number;
  baseShipping: number;
  finalShipping: number;
  itemsSubtotal: number;
  finalPayable: number;
  /** Per-line breakdown, in the same order as the input items. */
  lines: CartDiscountLine[];
}

/** Default subscription settings used when none are supplied. Keep in sync with DEFAULT_SUBSCRIPTION_SETTINGS. */
const FALLBACK_SUBSCRIPTION_MATH = {
  baseShippingFee: 49000,
  plusEggMaxQuota: 200,
  plusEggDiscountPercent: 15,
  proEggMaxQuota: 600,
  proEggDiscountPercent: 25,
  proOtherDiscountPercent: 10,
  proShippingDiscountPercent: 20,
} as SubscriptionSettings;

/** Eggs per pack for a product: explicit eggPackSize first, then a packSize heuristic (20 or 30). */
export function getEggsPerPack(product: { packSize?: string | null; eggPackSize?: number | null }): number {
  const explicit = Number(product.eggPackSize);
  if (Number.isInteger(explicit) && explicit > 0) return explicit;
  const packStr = product.packSize || '';
  return packStr.includes('20') || packStr.includes('۲۰') ? 20 : 30;
}

/** "egg"/"eggs" as a whole id segment, so ids like "veggie-box" don't count as eggs. */
const EGG_ID_PATTERN = /(^|[-_])eggs?([-_]|$)/i;

/** Whether a product is an egg product (category, title or id). */
export function isEggProduct(
  product: { category?: string; title?: string; id?: string },
  productId?: string
): boolean {
  return (
    product.category === 'تخم‌مرغ و ماکیان' ||
    (product.title || '').includes('تخم‌مرغ') ||
    EGG_ID_PATTERN.test(product.id || '') ||
    EGG_ID_PATTERN.test(productId || '')
  );
}

/**
 * Subscription discounts for a cart. Shared by the storefront (display) and the server quote (charge),
 * so both always compute the same numbers. Egg quota is allocated in item order.
 */
export function calculateCartDiscounts(
  items: CartItem[],
  tier: SubscriptionTier = 'FREE',
  settings?: SubscriptionSettings,
  usedEggQuotaThisMonth: number = 0
): CartDiscounts {
  const eff = settings || FALLBACK_SUBSCRIPTION_MATH;
  const itemsSubtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const baseShipping = items.length > 0 ? (eff.baseShippingFee ?? 49000) : 0;

  let eggQuota = 0;
  let eggPct = 0;
  let otherPct = 0;
  let shipPct = 0;
  if (tier === 'PRO') {
    eggQuota = eff.proEggMaxQuota ?? 600;
    eggPct = eff.proEggDiscountPercent ?? 25;
    otherPct = eff.proOtherDiscountPercent ?? 10;
    shipPct = eff.proShippingDiscountPercent ?? 20;
  } else if (tier === 'PLUS') {
    eggQuota = eff.plusEggMaxQuota ?? 200;
    eggPct = eff.plusEggDiscountPercent ?? 15;
  }
  const hasEggQuota = tier === 'PRO' || tier === 'PLUS';
  const remainingEggQuota = hasEggQuota ? Math.max(0, eggQuota - usedEggQuotaThisMonth) : 0;
  let quotaLeft = remainingEggQuota;

  let totalEggCount = 0;
  let eggDiscount = 0;
  let otherDiscount = 0;
  const lines: CartDiscountLine[] = [];

  for (const item of items) {
    const lineTotal = item.product.price * item.quantity;
    if (isEggProduct(item.product)) {
      const eggs = getEggsPerPack(item.product) * item.quantity;
      const eligible = Math.min(eggs, quotaLeft);
      quotaLeft -= eligible;
      const discount = eggs > 0 && eligible > 0 ? Math.round(lineTotal * (eligible / eggs) * (eggPct / 100)) : 0;
      totalEggCount += eggs;
      eggDiscount += discount;
      lines.push({ eggCount: eggs, eggDiscountedCount: eligible, discount });
    } else {
      const discount = tier === 'PRO' ? Math.round(lineTotal * (otherPct / 100)) : 0;
      otherDiscount += discount;
      lines.push({ eggCount: 0, eggDiscountedCount: 0, discount });
    }
  }

  const eggCapExceeded = hasEggQuota && totalEggCount + usedEggQuotaThisMonth > eggQuota;
  const shippingDiscount = tier === 'PRO' && baseShipping > 0 ? Math.round(baseShipping * (shipPct / 100)) : 0;
  const finalShipping = Math.max(0, baseShipping - shippingDiscount);
  const totalDiscount = eggDiscount + otherDiscount + shippingDiscount;
  const finalPayable = Math.max(0, itemsSubtotal - (eggDiscount + otherDiscount) + finalShipping);

  return {
    eggDiscount,
    eggCount: totalEggCount,
    eggQuota,
    usedEggQuotaThisMonth,
    remainingEggQuota,
    eggCapExceeded,
    otherDiscount,
    shippingDiscount,
    totalDiscount,
    baseShipping,
    finalShipping,
    itemsSubtotal,
    finalPayable,
    lines,
  };
}

/** Bulk (عمده) thresholds: at least 10 packs in total, or a gross subtotal of at least 5,000,000 تومان. */
export const BULK_MIN_ITEMS = 10;
export const BULK_MIN_SUBTOTAL = 5000000;

/**
 * Single bulk rule, used by the server quote and by the storefront. `subtotal` is the gross subtotal (تومان).
 */
export function isBulkOrder(
  items: { quantity: number }[],
  subtotal: number,
  thresholds: { minItems: number; minSubtotal: number } = { minItems: BULK_MIN_ITEMS, minSubtotal: BULK_MIN_SUBTOTAL }
): boolean {
  const totalCount = items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
  return totalCount >= thresholds.minItems || subtotal >= thresholds.minSubtotal;
}

/** Normalizes Persian text for comparisons: Arabic ی/ك to Persian forms, no ZWNJ, trimmed, lowercase. */
export function normalizePersianText(input: string): string {
  return input
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[​‌‍﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Order numbers are stored with Latin digits (PRF-1405-XXXXXXXX-XXXXXX). Numbers typed or pasted with Persian or
 * Arabic digits, spaces or bidi marks are normalized here before any lookup.
 */
export function normalizeOrderNumberInput(input: unknown): string {
  if (typeof input !== 'string') return '';
  return toEnglishDigits(input).replace(/[s‌‍‎‏‪-‮]/g, '').trim();
}

/** Whether a city name is Shiraz (Persian or English spelling). */
export function isShirazCity(city?: string | null): boolean {
  if (!city || typeof city !== 'string') return false;
  const n = normalizePersianText(city);
  return n === 'شیراز' || n === 'شهر شیراز' || n === 'شهرشیراز' || n === 'shiraz';
}

/** Province check for the Shiraz rule: an empty province counts as Fars (the checkout default). */
export function isFarsProvince(province?: string | null): boolean {
  if (!province || typeof province !== 'string' || !province.trim()) return true;
  return normalizePersianText(province) === 'فارس';
}

/** Shiraz rule for a delivery address: the city is Shiraz and the province is Fars (or not given). */
export function isShirazAddress(city?: string | null, province?: string | null): boolean {
  return isShirazCity(city) && isFarsProvince(province);
}

let proxyTrustWarningLogged = false;

/**
 * Returns the client IP used as a rate-limit key.
 *
 * Client-supplied forwarding headers are never trusted on their own. When TRUST_PROXY_HEADERS=1 is set
 * (production behind the provided nginx, which sets X-Real-IP from $remote_addr and strips the other
 * headers), exactly ONE header is read:
 *   - TRUSTED_CDN=arvan      -> ar-real-ip
 *   - TRUSTED_CDN=cloudflare -> cf-connecting-ip
 *   - otherwise              -> x-real-ip
 * X-Forwarded-For and True-Client-IP are never read.
 *
 * Without TRUST_PROXY_HEADERS=1, or when the header is missing or invalid, the result is 'unknown'.
 * Callers must then skip their per-IP limiter and rely on per-phone / per-identifier / global limits,
 * so a single attacker cannot lock out every 'unknown' client.
 */
export function getSecureClientIp(req: any): string {
  if (process.env.TRUST_PROXY_HEADERS !== '1') {
    if (!proxyTrustWarningLogged) {
      proxyTrustWarningLogged = true;
      console.warn(
        '[Security] TRUST_PROXY_HEADERS is not set to 1. Per-IP rate limits are skipped; production must run behind the provided nginx with TRUST_PROXY_HEADERS=1.'
      );
    }
    return 'unknown';
  }
  if (!req || !req.headers) return 'unknown';

  const cdn = (process.env.TRUSTED_CDN || '').trim().toLowerCase();
  const headerName =
    cdn === 'arvan' ? 'ar-real-ip' : cdn === 'cloudflare' ? 'cf-connecting-ip' : 'x-real-ip';

  let raw: string | null = null;
  try {
    raw =
      typeof req.headers.get === 'function'
        ? req.headers.get(headerName)
        : req.headers[headerName] || null;
  } catch {
    raw = null;
  }
  if (typeof raw === 'string') {
    const clean = raw.trim();
    if (isValidIp(clean)) return clean;
  }

  if (!proxyTrustWarningLogged && (!raw || typeof raw !== 'string')) {
    // Proxy is trusted but the expected header is absent: most likely the proxy config is wrong.
    proxyTrustWarningLogged = true;
    console.warn(`[Security] TRUST_PROXY_HEADERS=1 but header "${headerName}" is missing; per-IP limits are skipped.`);
  }
  return 'unknown';
}

/**
 * Formats a stored subscription expiry for display. New values are ISO timestamps; legacy values
 * (Persian/Jalali strings) are returned unchanged.
 */
export function formatSubscriptionExpiry(value?: string | null): string {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const ms = Date.parse(value);
    if (!Number.isNaN(ms)) {
      return toPersianDigits(new Date(ms).toLocaleDateString('fa-IR'));
    }
  }
  return value;
}

function isValidIp(ip: string): boolean {
  if (!ip || ip.length > 45) return false;
  const ipv4Regex = /^(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::$|^::1$|^([0-9a-fA-F]{1,4}:){1,7}:$|^:(:[0-9a-fA-F]{1,4}){1,7}$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}
