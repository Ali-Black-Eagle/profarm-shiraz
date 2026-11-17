import { NextRequest, NextResponse } from 'next/server';
import { testZarinpalConnection } from '@/lib/zarinpal';
import { testSnappPayConnection, isAllowedSnappPayBaseUrl, SNAPPPAY_DEFAULT_BASE_URL } from '@/lib/snapppay';
import { requireAdmin } from '@/lib/admin-auth';
import { apiErrorResponse } from '@/lib/api-errors';
import { farmStore } from '@/lib/db-store';

function isMasked(value: unknown): boolean {
  return typeof value === 'string' && value.includes('••');
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const gateway = body.gateway;
    const currentSettings = farmStore.getPaymentSettings();

    if (gateway === 'zarinpal') {
      let merchantId = typeof body.merchantId === 'string' ? body.merchantId.trim() : '';
      if (!merchantId || isMasked(merchantId)) {
        merchantId = currentSettings?.zarinpal?.merchantId || process.env.ZARINPAL_MERCHANT_ID || '';
      }
      const isSandbox =
        typeof body.sandbox === 'boolean' ? body.sandbox : (currentSettings?.zarinpal?.sandbox ?? false);
      const res = await testZarinpalConnection(merchantId, isSandbox);
      return NextResponse.json({
        gateway: 'zarinpal',
        ...res,
      });
    }

    if (gateway === 'snapppay') {
      let clientId = typeof body.clientId === 'string' ? body.clientId.trim() : '';
      let clientSecret = typeof body.clientSecret === 'string' ? body.clientSecret.trim() : '';
      if (!clientId || isMasked(clientId)) {
        clientId = currentSettings?.snapppay?.clientId || process.env.SNAPPPAY_CLIENT_ID || '';
      }
      if (!clientSecret || isMasked(clientSecret)) {
        clientSecret = currentSettings?.snapppay?.clientSecret || process.env.SNAPPPAY_CLIENT_SECRET || '';
      }

      // SECURITY: the base URL is never taken from the request. Only the stored, validated URL is used,
      // so credentials cannot be sent to a host chosen by whoever sends the request.
      const storedBase = currentSettings?.snapppay?.baseUrl;
      const baseUrl = isAllowedSnappPayBaseUrl(storedBase) ? storedBase.trim() : SNAPPPAY_DEFAULT_BASE_URL;

      const res = await testSnappPayConnection(clientId, clientSecret, baseUrl);
      return NextResponse.json({
        gateway: 'snapppay',
        ...res,
      });
    }

    return NextResponse.json(
      { success: false, message: 'درگاه نامعتبر است. فقط zarinpal یا snapppay پشتیبانی می‌شود.' },
      { status: 400 }
    );
  } catch (error: unknown) {
    return apiErrorResponse(error, 'admin/payment-settings/test', 'خطا در آزمون اتصال درگاه');
  }
}
