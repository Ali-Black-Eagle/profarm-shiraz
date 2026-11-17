import { NextRequest, NextResponse } from 'next/server';
import { farmStore } from '@/lib/db-store';
import { requireAdmin } from '@/lib/admin-auth';
import { apiErrorResponse } from '@/lib/api-errors';
import { isAllowedSnappPayBaseUrl, SNAPPPAY_DEFAULT_BASE_URL } from '@/lib/snapppay';
import { PaymentSettings } from '@/types';
import fs from 'fs';
import path from 'path';

// Store payment configuration safely outside source directory
const DATA_DIR = path.join(process.cwd(), '.data');
const JSON_BACKUP_PATH = path.join(DATA_DIR, 'payment-settings.json');

const MASK = '••••••••';

/** Gateway identifiers and secrets are never returned in full. */
function maskSettings(settings: PaymentSettings): PaymentSettings {
  return {
    ...settings,
    zarinpal: {
      ...settings.zarinpal,
      merchantId: settings.zarinpal?.merchantId ? MASK : '',
    },
    snapppay: {
      ...settings.snapppay,
      clientId: settings.snapppay?.clientId ? MASK : '',
      clientSecret: settings.snapppay?.clientSecret ? MASK : '',
    },
  };
}

function isMasked(value: unknown): boolean {
  return typeof value === 'string' && value.includes('••');
}

/** A masked value keeps the stored secret. A new string replaces it. */
function pickSecret(incoming: unknown, stored: string | undefined, maxLen: number): string {
  if (typeof incoming !== 'string' || isMasked(incoming)) return stored || '';
  return incoming.trim().slice(0, maxLen);
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export async function GET(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const settings = farmStore.getPaymentSettings();
    return NextResponse.json({
      success: true,
      settings: maskSettings(settings),
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/payment-settings GET', 'خطا در بارگذاری تنظیمات درگاه');
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = asObject(await req.json().catch(() => null));
    if (Object.keys(body).length === 0) {
      return NextResponse.json({ success: false, message: 'اطلاعات ارسالی نامعتبر است.' }, { status: 400 });
    }

    const current = farmStore.getPaymentSettings();
    const z = asObject(body.zarinpal);
    const s = asObject(body.snapppay);
    const g = asObject(body.general);

    // SnappPay base URL: only https on snapppay.ir. Any other value is rejected.
    const requestedBase = s.baseUrl === undefined ? current.snapppay?.baseUrl : s.baseUrl;
    const nextBaseUrl = typeof requestedBase === 'string' ? requestedBase.trim() : SNAPPPAY_DEFAULT_BASE_URL;
    if (!isAllowedSnappPayBaseUrl(nextBaseUrl)) {
      return NextResponse.json(
        {
          success: false,
          message: 'نشانی وب‌سرویس اسنپ‌پی باید یک آدرس https روی دامنه snapppay.ir باشد.',
        },
        { status: 400 }
      );
    }

    // Whitelisted fields only. Anything else in the request body is ignored.
    const timeoutRaw = Number(g.paymentTimeoutMinutes);
    const minAmountRaw = Number(s.minAmount);
    const sanitized = {
      zarinpal: {
        enabled: typeof z.enabled === 'boolean' ? z.enabled : Boolean(current.zarinpal?.enabled),
        merchantId: pickSecret(z.merchantId, current.zarinpal?.merchantId, 64),
        sandbox: typeof z.sandbox === 'boolean' ? z.sandbox : Boolean(current.zarinpal?.sandbox),
        defaultDescription:
          typeof z.defaultDescription === 'string'
            ? z.defaultDescription.trim().slice(0, 200)
            : current.zarinpal?.defaultDescription || '',
      },
      snapppay: {
        enabled: typeof s.enabled === 'boolean' ? s.enabled : Boolean(current.snapppay?.enabled),
        clientId: pickSecret(s.clientId, current.snapppay?.clientId, 128),
        clientSecret: pickSecret(s.clientSecret, current.snapppay?.clientSecret, 256),
        baseUrl: nextBaseUrl,
        minAmount:
          Number.isFinite(minAmountRaw) && minAmountRaw >= 0
            ? Math.round(minAmountRaw)
            : current.snapppay?.minAmount ?? 200000,
      },
      general: {
        currency: g.currency === 'IRR' || g.currency === 'IRT' ? g.currency : current.general?.currency || 'IRT',
        allowCashOnDelivery:
          typeof g.allowCashOnDelivery === 'boolean'
            ? g.allowCashOnDelivery
            : Boolean(current.general?.allowCashOnDelivery),
        paymentTimeoutMinutes:
          Number.isInteger(timeoutRaw) && timeoutRaw >= 1 && timeoutRaw <= 1440
            ? timeoutRaw
            : current.general?.paymentTimeoutMinutes ?? 15,
        guideMessage:
          typeof g.guideMessage === 'string' ? g.guideMessage.trim().slice(0, 300) : current.general?.guideMessage,
      },
    };

    // 1. Update in-memory & persisted farmStore
    const updated = farmStore.updatePaymentSettings(sanitized as Partial<PaymentSettings>);

    // 2. Sync with process.env (real values, server side only)
    if (updated.zarinpal?.merchantId !== undefined) {
      process.env.ZARINPAL_MERCHANT_ID = updated.zarinpal.merchantId;
    }
    if (updated.zarinpal?.sandbox !== undefined) {
      process.env.ZARINPAL_SANDBOX = String(updated.zarinpal.sandbox);
    }
    if (updated.snapppay?.clientId !== undefined) {
      process.env.SNAPPPAY_CLIENT_ID = updated.snapppay.clientId;
    }
    if (updated.snapppay?.clientSecret !== undefined) {
      process.env.SNAPPPAY_CLIENT_SECRET = updated.snapppay.clientSecret;
    }
    if (updated.snapppay?.baseUrl !== undefined) {
      process.env.SNAPPPAY_BASE_URL = updated.snapppay.baseUrl;
    }

    // 3. Write snapshot in secure .data/ folder (outside src/)
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(JSON_BACKUP_PATH, JSON.stringify(updated, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Could not write payment-settings.json snapshot:', e);
    }

    return NextResponse.json({
      success: true,
      message: 'تنظیمات درگاه‌های پرداخت با موفقیت ذخیره و در سرور فعال شد.',
      settings: maskSettings(updated),
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/payment-settings POST', 'خطا در ذخیره‌سازی تنظیمات درگاه');
  }
}
