/**
 * ZarinPal Payment Gateway REST API v4 Integration with Idempotency Support
 */

interface PaymentRequestOptions {
  amount: number; // in Tomans
  description: string;
  orderNumber: string;
  callbackUrl: string;
  mobile?: string;
  email?: string;
}

interface PaymentRequestResult {
  success: boolean;
  authority?: string;
  paymentUrl?: string;
  code?: number;
  message?: string;
}

interface PaymentVerifyOptions {
  authority: string;
  amount: number; // in Tomans
  orderId: string;
}

interface PaymentVerifyResult {
  success: boolean;
  refId?: string;
  code?: number;
  message?: string;
  isAlreadyVerified?: boolean;
}

import 'server-only';
import { farmStore } from '@/lib/db-store';

// In-memory idempotency cache to prevent double-charging or duplicate verification requests
const g = (typeof globalThis !== 'undefined' ? globalThis : global) as unknown as {
  __PROFARM_VERIFIED_TRANSACTIONS__?: Map<string, { refId: string; timestamp: number }>;
};
const verifiedTransactions =
  g.__PROFARM_VERIFIED_TRANSACTIONS__ ||
  (g.__PROFARM_VERIFIED_TRANSACTIONS__ = new Map<string, { refId: string; timestamp: number }>());

export function getActiveZarinpalConfig() {
  const storeSettings = farmStore.getPaymentSettings()?.zarinpal;
  const merchantId = (storeSettings?.merchantId || process.env.ZARINPAL_MERCHANT_ID || '').trim();
  const isSandbox = storeSettings ? Boolean(storeSettings.sandbox) : process.env.ZARINPAL_SANDBOX === 'true';
  const isEnabled = storeSettings !== undefined ? Boolean(storeSettings.enabled) : true;
  const defaultDescription = storeSettings?.defaultDescription || 'سفارش محصولات ارگانیک شیراز';
  const baseUrl = isSandbox
    ? 'https://sandbox.zarinpal.com/pg/v4/payment'
    : 'https://api.zarinpal.com/pg/v4/payment';
  const startPayUrl = isSandbox
    ? 'https://sandbox.zarinpal.com/pg/StartPay/'
    : 'https://payment.zarinpal.com/pg/StartPay/';
  return { merchantId, isSandbox, isEnabled, baseUrl, startPayUrl, defaultDescription };
}

/**
 * Initiates a real payment session with ZarinPal API v4
 */
export async function requestPayment(
  options: PaymentRequestOptions
): Promise<PaymentRequestResult> {
  const config = getActiveZarinpalConfig();

  if (!config.isEnabled) {
    return {
      success: false,
      code: -2,
      message: 'درگاه پرداخت زرین‌پال در حال حاضر توسط مدیریت غیرفعال شده است.',
    };
  }

  // Check if real merchant is configured
  if (
    !config.merchantId ||
    config.merchantId === '00000000-0000-0000-0000-000000000000' ||
    config.merchantId.length < 30
  ) {
    return {
      success: false,
      code: -1,
      message:
        'درگاه پرداخت زرین‌پال روی سرور پیکربندی نشده است. لطفاً از پنل ادمین > تنظیمات درگاه پرداخت، کد مرچنت ۳۶ کاراکتری زرین‌پال را وارد و ذخیره فرمایید.',
    };
  }

  const payload = {
    merchant_id: config.merchantId,
    amount: options.amount,
    currency: 'IRT',
    description: options.description,
    callback_url: options.callbackUrl,
    metadata: {
      mobile: options.mobile,
      email: options.email,
      order_id: options.orderNumber,
    },
  };

  try {
    const res = await fetch(`${config.baseUrl}/request.json`, {
      method: 'POST',
      // Gateway calls time out after 8 s; a timeout is handled as a failed request by the catch below
      signal: AbortSignal.timeout(8000),
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (data.data && data.data.code === 100) {
      const authority = data.data.authority;
      return {
        success: true,
        authority,
        paymentUrl: `${config.startPayUrl}${authority}`,
        code: 100,
        message: 'هدایت به درگاه پرداخت شاپرک زرین‌پال',
      };
    } else {
      return {
        success: false,
        code: data.errors?.code || -1,
        message: data.errors?.message || 'خطا در برقراری ارتباط با درگاه شاپرک زرین‌پال',
      };
    }
  } catch (error) {
    console.error('Zarinpal request error:', error);
    return {
      success: false,
      message: 'خطای شبکه در برقراری ارتباط با درگاه پرداخت بانکی',
    };
  }
}

/**
 * Verifies a payment with ZarinPal API v4, enforcing Idempotency
 */
export async function verifyPayment(
  options: PaymentVerifyOptions
): Promise<PaymentVerifyResult> {
  const { authority, amount, orderId } = options;
  const config = getActiveZarinpalConfig();

  if (!config.merchantId || config.merchantId === '00000000-0000-0000-0000-000000000000') {
    return {
      success: false,
      message: 'کد پذیرنده درگاه زرین‌پال تنظیم نشده است.',
    };
  }

  // Idempotency check: if already processed and verified, return cached confirmation
  const existing = verifiedTransactions.get(authority);
  if (existing) {
    return {
      success: true,
      refId: existing.refId,
      code: 101, // 101 in Zarinpal means "verified previously"
      message: 'تراکنش قبلاً با موفقیت تایید شده است.',
      isAlreadyVerified: true,
    };
  }

  try {
    const res = await fetch(`${config.baseUrl}/verify.json`, {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        merchant_id: config.merchantId,
        amount,
        authority,
      }),
    });

    const data = await res.json();

    if (data.data && (data.data.code === 100 || data.data.code === 101)) {
      const refId = data.data.ref_id?.toString() || 'REF-' + Date.now();
      verifiedTransactions.set(authority, { refId, timestamp: Date.now() });
      if (verifiedTransactions.size > 2000) {
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        for (const [key, val] of verifiedTransactions.entries()) {
          if (val.timestamp < oneDayAgo) {
            verifiedTransactions.delete(key);
          }
        }
      }
      return {
        success: true,
        refId,
        code: data.data.code,
        message:
          data.data.code === 100
            ? 'تراکنش با موفقیت انجام و تایید شد.'
            : 'تراکنش قبلاً تایید گردیده است.',
      };
    } else {
      return {
        success: false,
        code: data.errors?.code || -1,
        message: data.errors?.message || 'تراکنش ناموفق بود یا توسط کاربر لغو شد.',
      };
    }
  } catch (error) {
    console.error('Zarinpal verify error:', error);
    return {
      success: false,
      message: 'خطا در اعتبارسنجی پرداخت از زرین‌پال',
    };
  }
}

/**
 * Diagnostic tool: Validates and tests connection to ZarinPal REST API v4
 */
export async function testZarinpalConnection(
  merchantId: string,
  sandbox: boolean
): Promise<{
  success: boolean;
  status: 'CONNECTED' | 'INVALID_MERCHANT' | 'NETWORK_ERROR' | 'SANDBOX_READY';
  message: string;
  latencyMs?: number;
  code?: number;
}> {
  const cleanId = (merchantId || '').trim();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!cleanId || cleanId === '00000000-0000-0000-0000-000000000000') {
    return {
      success: false,
      status: 'INVALID_MERCHANT',
      message: 'کد مرچنت وارد نشده یا کد صفر تستی پیش‌فرض است.',
    };
  }

  if (!uuidRegex.test(cleanId)) {
    return {
      success: false,
      status: 'INVALID_MERCHANT',
      message: 'فرمت مرچنت کد نامعتبر است. مرچنت کد زرین‌پال باید یک رشته ۳۶ کاراکتری استاندارد (UUID) باشد.',
    };
  }

  const baseUrl = sandbox
    ? 'https://sandbox.zarinpal.com/pg/v4/payment'
    : 'https://api.zarinpal.com/pg/v4/payment';

  const startTime = Date.now();
  try {
    const res = await fetch(`${baseUrl}/request.json`, {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        merchant_id: cleanId,
        amount: 1000,
        currency: 'IRT',
        description: 'تست اتصال درگاه پروفارم شیراز',
        callback_url: 'https://profarm-shiraz.ir/test-callback',
      }),
    });

    const latencyMs = Date.now() - startTime;
    const data = await res.json();

    if (data.data && data.data.code === 100) {
      return {
        success: true,
        status: sandbox ? 'SANDBOX_READY' : 'CONNECTED',
        message: `اتصال به وب‌سرویس زرین‌پال کاملاً برقرار است. توکن آزمایشی دریافت شد (${data.data.authority}).`,
        latencyMs,
        code: 100,
      };
    } else if (data.errors) {
      const errCode = data.errors.code;
      let errMsg = data.errors.message || 'خطای وب‌سرویس زرین‌پال';
      if (errCode === -10) {
        errMsg = 'آی‌پی سرور شما در پنل زرین‌پال ثبت نشده یا دسترسی مجاز ندارد (کد -10).';
      } else if (errCode === -9) {
        errMsg = 'اطلاعات ارسالی یا مرچنت کد در سیستم زرین‌پال تایید نشد (کد -9).';
      }
      return {
        success: false,
        status: 'INVALID_MERCHANT',
        message: errMsg,
        latencyMs,
        code: errCode,
      };
    }

    return {
      success: false,
      status: 'NETWORK_ERROR',
      message: 'پاسخ نامشخص از وب‌سرویس زرین‌پال دریافت شد.',
      latencyMs,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      status: 'NETWORK_ERROR',
      message: `خطای اتصال به اینترنت یا سرور زرین‌پال: ${err.message || 'پاسخی دریافت نشد'}`,
      latencyMs,
    };
  }
}
