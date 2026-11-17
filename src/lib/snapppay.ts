/**
 * SnappPay (اسنپ‌پی) Buy Now, Pay Later (BNPL) Integration
 * 4-installment zero-interest payment workflow with REST API and gateway verification
 */

export interface SnappPayInstallment {
  installmentNumber: number;
  title: string;
  amount: number;
  dueDate: string; // Persian date or relative label (امروز، ۱ ماه بعد...)
  isPaid: boolean;
}

export interface SnappPayPlan {
  totalAmount: number;
  installmentCount: number;
  installmentAmount: number;
  fee: number;
  installments: SnappPayInstallment[];
}

export interface SnappPayRequestOptions {
  amount: number; // in Tomans
  orderNumber: string;
  mobile: string;
  callbackUrl: string;
  description?: string;
}

export interface SnappPayRequestResult {
  success: boolean;
  paymentToken?: string;
  paymentUrl?: string;
  plan?: SnappPayPlan;
  message?: string;
}

export interface SnappPayVerifyOptions {
  paymentToken: string;
  amount: number;
  orderNumber: string;
}

export interface SnappPayVerifyResult {
  success: boolean;
  refId?: string;
  trackingCode?: string;
  plan?: SnappPayPlan;
  message?: string;
}

import { farmStore } from '@/lib/db-store';

export function getActiveSnappPayConfig() {
  const storeSettings = farmStore.getPaymentSettings()?.snapppay;
  const baseUrl = (storeSettings?.baseUrl || process.env.SNAPPPAY_BASE_URL || 'https://api.snapppay.ir/api/online/v1').trim();
  const clientId = (storeSettings?.clientId || process.env.SNAPPPAY_CLIENT_ID || '').trim();
  const clientSecret = (storeSettings?.clientSecret || process.env.SNAPPPAY_CLIENT_SECRET || '').trim();
  const isEnabled = storeSettings !== undefined ? Boolean(storeSettings.enabled) : true;
  const minAmount = storeSettings?.minAmount ?? 200000;
  return { baseUrl, clientId, clientSecret, isEnabled, minAmount };
}

/**
 * Calculates 4 equal installments for SnappPay BNPL (0% interest, 0% fee)
 */
export function calculateSnappPayPlan(totalAmount: number): SnappPayPlan {
  const installmentCount = 4;
  const eachAmount = Math.ceil(totalAmount / installmentCount);

  // Generate 4 monthly installments
  const installments: SnappPayInstallment[] = [
    {
      installmentNumber: 1,
      title: 'قسط اول (هنگام ثبت سفارش)',
      amount: eachAmount,
      dueDate: 'امروز',
      isPaid: true,
    },
    {
      installmentNumber: 2,
      title: 'قسط دوم',
      amount: eachAmount,
      dueDate: '۳۰ روز بعد',
      isPaid: false,
    },
    {
      installmentNumber: 3,
      title: 'قسط سوم',
      amount: eachAmount,
      dueDate: '۶۰ روز بعد',
      isPaid: false,
    },
    {
      installmentNumber: 4,
      title: 'قسط چهارم',
      amount: totalAmount - eachAmount * 3, // balance remainder
      dueDate: '۹۰ روز بعد',
      isPaid: false,
    },
  ];

  return {
    totalAmount,
    installmentCount,
    installmentAmount: eachAmount,
    fee: 0,
    installments,
  };
}

/**
 * Requests an installment payment token from SnappPay
 */
export async function requestSnappPayPayment(
  options: SnappPayRequestOptions
): Promise<SnappPayRequestResult> {
  const plan = calculateSnappPayPlan(options.amount);
  const config = getActiveSnappPayConfig();

  if (!config.isEnabled) {
    return {
      success: false,
      plan,
      message: 'درگاه پرداخت اقساطی اسنپ‌پی در حال حاضر توسط مدیریت غیرفعال شده است.',
    };
  }

  if (options.amount < config.minAmount) {
    return {
      success: false,
      plan,
      message: `حداقل مبلغ سفارش جهت استفاده از پرداخت اقساطی اسنپ‌پی ${config.minAmount.toLocaleString('fa-IR')} تومان است.`,
    };
  }

  // If live credentials are configured
  if (config.clientId && config.clientSecret) {
    try {
      const res = await fetch(`${config.baseUrl}/payment/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
        },
        body: JSON.stringify({
          amount: options.amount,
          orderId: options.orderNumber,
          mobile: options.mobile,
          returnUrl: options.callbackUrl,
          description: options.description || `خرید اقساطی مزارع پروفارم کد ${options.orderNumber}`,
        }),
      });

      const data = await res.json();

      if (data.successful && data.response?.paymentToken) {
        return {
          success: true,
          paymentToken: data.response.paymentToken,
          paymentUrl: `https://payment.snapppay.ir/payment/${data.response.paymentToken}`,
          plan,
        };
      }
      return {
        success: false,
        plan,
        message: data.errorData?.message || 'خطا در برقراری ارتباط با درگاه اسنپ‌پی',
      };
    } catch (err: any) {
      console.error('SnappPay Live API Error:', err);
      return {
        success: false,
        plan,
        message: 'خطای شبکه در برقراری ارتباط با درگاه اقساطی اسنپ‌پی',
      };
    }
  }

  return {
    success: false,
    plan,
    message:
      'درگاه پرداخت اقساطی اسنپ‌پی روی سرور پیکربندی نشده است. لطفاً از پنل ادمین > تنظیمات درگاه پرداخت، مقادیر Client ID و Client Secret اسنپ‌پی را وارد فرمایید.',
  };
}

/**
 * Verifies SnappPay payment settlement strictly through live API
 */
export async function verifySnappPayPayment(
  options: SnappPayVerifyOptions
): Promise<SnappPayVerifyResult> {
  const plan = calculateSnappPayPlan(options.amount);
  const config = getActiveSnappPayConfig();

  if (!config.clientId || !config.clientSecret) {
    return {
      success: false,
      plan,
      message: 'تنظیمات درگاه اسنپ‌پی جهت تایید تراکنش بر روی سرور موجود نیست.',
    };
  }

  try {
    const res = await fetch(`${config.baseUrl}/payment/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
      },
      body: JSON.stringify({
        paymentToken: options.paymentToken,
        amount: options.amount,
      }),
    });

    const data = await res.json();
    if (data.successful) {
      return {
        success: true,
        refId: data.response?.transactionId || `SNP-TX-${Date.now()}`,
        trackingCode: data.response?.trackingCode,
        plan,
        message: 'پرداخت اقساطی اسنپ‌پی با موفقیت انجام و تایید گردید.',
      };
    } else {
      return {
        success: false,
        plan,
        message: data.errorData?.message || 'تاییدیه پرداخت از سوی درگاه اسنپ‌پی دریافت نشد.',
      };
    }
  } catch (err) {
    console.error('SnappPay Live Verify Error:', err);
    return {
      success: false,
      plan,
      message: 'خطای شبکه در ارتباط با سرور اعتبارسنجی اسنپ‌پی',
    };
  }
}

/**
 * Diagnostic tool: Tests connection and authentication with SnappPay REST API
 */
export async function testSnappPayConnection(
  clientId: string,
  clientSecret: string,
  baseUrl: string
): Promise<{
  success: boolean;
  message: string;
  latencyMs?: number;
  statusCode?: number;
}> {
  const cleanId = (clientId || '').trim();
  const cleanSecret = (clientSecret || '').trim();
  const cleanBaseUrl = (baseUrl || 'https://api.snapppay.ir/api/online/v1').trim();

  if (!cleanId || !cleanSecret) {
    return {
      success: false,
      message: 'شناسه کلاینت (Client ID) یا کلید امنیتی (Client Secret) وارد نشده است.',
    };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(cleanBaseUrl);
  } catch {
    return {
      success: false,
      message: 'آدرس پایه درگاه اسنپ‌پی نامعتبر است.',
    };
  }

  // SSRF Protection: Restrict destination host to official SnappPay endpoints
  const allowedHosts = ['api.snapppay.ir', 'staging.snapppay.ir', 'api-staging.snapppay.ir'];
  const isAllowedHost =
    allowedHosts.includes(parsedUrl.hostname.toLowerCase()) ||
    (process.env.NODE_ENV !== 'production' && (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1'));

  if (!isAllowedHost) {
    return {
      success: false,
      message: 'دامنه آدرس پایه درگاه اسنپ‌پی نامعتبر و غیرمجاز است. فقط دامنه‌های رسمی اسنپ‌پی مجاز می‌باشند.',
    };
  }

  const startTime = Date.now();
  try {
    const res = await fetch(`${cleanBaseUrl}/payment/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${cleanId}:${cleanSecret}`).toString('base64')}`,
      },
      body: JSON.stringify({
        amount: 10000,
        merchantIdentificationToken: cleanId,
        mobile: '09000000000',
        paymentMethodTypeDto: 'INSTALLMENT',
        returnUrl: 'https://profarm-shiraz.ir/test-callback',
      }),
      signal: AbortSignal.timeout(8000),
    });

    const latencyMs = Date.now() - startTime;
    const data = await res.json().catch(() => null);

    if (res.ok && data?.successful) {
      return {
        success: true,
        message: 'اتصال به وب‌سرویس اسنپ‌پی با موفقیت تایید شد و کلیدها معتبر هستند.',
        latencyMs,
        statusCode: res.status,
      };
    } else if (res.status === 401 || res.status === 403) {
      return {
        success: false,
        message: 'احراز هویت در وب‌سرویس اسنپ‌پی ناموفق بود. لطفاً Client ID و Client Secret را مجدداً بررسی کنید (کد ۴۰۱/۴۰۳).',
        latencyMs,
        statusCode: res.status,
      };
    } else {
      return {
        success: false,
        message: data?.errorData?.message || data?.error?.message || `پاسخ وب‌سرویس اسنپ‌پی با کد وضعیت ${res.status}`,
        latencyMs,
        statusCode: res.status,
      };
    }
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      message: `عدم برقراری ارتباط با وب‌سرویس اسنپ‌پی: ${err.message || 'خطای تایم‌اوت یا دسترسی شبکه'}`,
      latencyMs,
    };
  }
}
