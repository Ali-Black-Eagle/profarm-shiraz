/**
 * Utility functions for Persian digits, formatting currency, and strings
 */

import { CartItem, SubscriptionTier, SubscriptionSettings } from '@/types';

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
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
    str = str.replace(new RegExp(PERSIAN_DIGITS[i], 'g'), ENGLISH_DIGITS[i]);
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
}

export function calculateCartDiscounts(
  items: CartItem[],
  tier: SubscriptionTier = 'FREE',
  settings?: SubscriptionSettings,
  usedEggQuotaThisMonth: number = 0
): CartDiscounts {
  const effectiveSettings = settings || ({
    baseShippingFee: 49000,
    plusEggMaxQuota: 200,
    plusEggDiscountPercent: 15,
    proEggMaxQuota: 600,
    proEggDiscountPercent: 25,
    proOtherDiscountPercent: 10,
    proShippingDiscountPercent: 100,
  } as SubscriptionSettings);

  const itemsSubtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const baseShipping = items.length > 0 ? (effectiveSettings.baseShippingFee ?? 49000) : 0;

  let totalEggCount = 0;
  let eggItemsTotal = 0;
  let otherItemsTotal = 0;

  for (const item of items) {
    const isEgg =
      item.product.category === 'تخم‌مرغ و ماکیان' ||
      item.product.title.includes('تخم‌مرغ') ||
      item.product.id.includes('egg');

    if (isEgg) {
      const packStr = item.product.packSize || '';
      const eggsPerPack =
        packStr.includes('20') || packStr.includes('۲۰') ? 20 : 30;
      totalEggCount += eggsPerPack * item.quantity;
      eggItemsTotal += item.product.price * item.quantity;
    } else {
      otherItemsTotal += item.product.price * item.quantity;
    }
  }

  let eggDiscount = 0;
  let eggQuota = 0;
  let remainingEggQuota = 0;
  let eggCapExceeded = false;
  let otherDiscount = 0;
  let shippingDiscount = 0;

  if (tier === 'PRO') {
    eggQuota = effectiveSettings.proEggMaxQuota ?? 600;
    remainingEggQuota = Math.max(0, eggQuota - usedEggQuotaThisMonth);
    const eligibleEggs = Math.min(remainingEggQuota, totalEggCount);
    eggCapExceeded = (totalEggCount + usedEggQuotaThisMonth) > eggQuota;
    const eligibleFraction = totalEggCount > 0 ? eligibleEggs / totalEggCount : 0;
    eggDiscount = Math.round(
      eggItemsTotal * eligibleFraction * ((effectiveSettings.proEggDiscountPercent ?? 25) / 100)
    );
    otherDiscount = Math.round(otherItemsTotal * ((effectiveSettings.proOtherDiscountPercent ?? 10) / 100));
    shippingDiscount =
      baseShipping > 0
        ? Math.round(baseShipping * ((effectiveSettings.proShippingDiscountPercent ?? 100) / 100))
        : 0;
  } else if (tier === 'PLUS') {
    eggQuota = effectiveSettings.plusEggMaxQuota ?? 200;
    remainingEggQuota = Math.max(0, eggQuota - usedEggQuotaThisMonth);
    const eligibleEggs = Math.min(remainingEggQuota, totalEggCount);
    eggCapExceeded = (totalEggCount + usedEggQuotaThisMonth) > eggQuota;
    const eligibleFraction = totalEggCount > 0 ? eligibleEggs / totalEggCount : 0;
    eggDiscount = Math.round(
      eggItemsTotal * eligibleFraction * ((effectiveSettings.plusEggDiscountPercent ?? 15) / 100)
    );
    otherDiscount = 0;
    shippingDiscount = 0;
  }

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
  };
}

/**
 * Safely extracts client IP address, resistant to X-Forwarded-For spoofing.
 * Prioritizes trusted CDN and reverse proxy headers:
 * 1. ArvanCloud edge header: ar-real-ip
 * 2. Cloudflare edge header: cf-connecting-ip
 * 3. True-Client-IP
 * 4. X-Real-IP
 * 5. Rightmost untrusted entry in X-Forwarded-For (closest to proxy)
 */
export function getSecureClientIp(req: any): string {
  if (!req || !req.headers) return '127.0.0.1';

  // Helper to extract header value from NextRequest or plain headers map
  const getHeader = (name: string): string | null => {
    try {
      if (typeof req.headers.get === 'function') {
        return req.headers.get(name);
      }
      return req.headers[name] || req.headers[name.toLowerCase()] || null;
    } catch {
      return null;
    }
  };

  // 1. ArvanCloud edge header (cannot be forged when served through ArvanCloud CDN)
  const arvanIp = getHeader('ar-real-ip');
  if (arvanIp && typeof arvanIp === 'string') {
    const clean = arvanIp.trim();
    if (isValidIp(clean)) return clean;
  }

  // 2. Cloudflare connecting IP (cannot be forged when behind Cloudflare)
  const cfIp = getHeader('cf-connecting-ip');
  if (cfIp && typeof cfIp === 'string') {
    const clean = cfIp.trim();
    if (isValidIp(clean)) return clean;
  }

  // 3. True-Client-IP (Akamai, Enterprise CDNs)
  const trueClientIp = getHeader('true-client-ip');
  if (trueClientIp && typeof trueClientIp === 'string') {
    const clean = trueClientIp.trim();
    if (isValidIp(clean)) return clean;
  }

  // 4. X-Real-IP (Standard reverse proxy / Nginx socket IP)
  const xRealIp = getHeader('x-real-ip');
  if (xRealIp && typeof xRealIp === 'string') {
    const clean = xRealIp.trim();
    if (isValidIp(clean)) return clean;
  }

  // 5. X-Forwarded-For: Take the rightmost valid entry (closest proxy/client, preventing client spoofing the left entry)
  const xForwardedFor = getHeader('x-forwarded-for');
  if (xForwardedFor && typeof xForwardedFor === 'string') {
    const parts = xForwardedFor.split(',').map((p: string) => p.trim()).filter(Boolean);
    for (let i = parts.length - 1; i >= 0; i--) {
      const candidate = parts[i];
      if (isValidIp(candidate)) return candidate;
    }
  }

  return '127.0.0.1';
}

function isValidIp(ip: string): boolean {
  if (!ip || ip.length > 45) return false;
  const ipv4Regex = /^(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::$|^::1$|^([0-9a-fA-F]{1,4}:){1,7}:$|^:(:[0-9a-fA-F]{1,4}){1,7}$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}
