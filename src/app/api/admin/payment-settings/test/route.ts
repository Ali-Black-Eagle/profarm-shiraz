import { NextRequest, NextResponse } from 'next/server';
import { testZarinpalConnection } from '@/lib/zarinpal';
import { testSnappPayConnection } from '@/lib/snapppay';
import { getSessionFromRequest } from '@/lib/session';
import { farmStore } from '@/lib/db-store';

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'دسترسی غیرمجاز: فقط ادمین امکان تست درگاه را دارد.' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { gateway, ...params } = body;
    const currentSettings = farmStore.getPaymentSettings();

    if (gateway === 'zarinpal') {
      let { merchantId, sandbox } = params;
      if (!merchantId || merchantId.includes('••')) {
        merchantId = currentSettings?.zarinpal?.merchantId || process.env.ZARINPAL_MERCHANT_ID || '';
      }
      const isSandbox = sandbox !== undefined ? Boolean(sandbox) : (currentSettings?.zarinpal?.sandbox ?? false);
      const res = await testZarinpalConnection(merchantId, isSandbox);
      return NextResponse.json({
        gateway: 'zarinpal',
        ...res,
      });
    }

    if (gateway === 'snapppay') {
      let { clientId, clientSecret, baseUrl } = params;
      if (!clientId || clientId.includes('••')) {
        clientId = currentSettings?.snapppay?.clientId || process.env.SNAPPPAY_CLIENT_ID || '';
      }
      if (!clientSecret || clientSecret.includes('••')) {
        clientSecret = currentSettings?.snapppay?.clientSecret || process.env.SNAPPPAY_CLIENT_SECRET || '';
      }
      if (!baseUrl) {
        baseUrl = currentSettings?.snapppay?.baseUrl || process.env.SNAPPPAY_BASE_URL || 'https://api.snapppay.ir/api/online/v1';
      }
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
  } catch (error: any) {
    console.error('Test connection API error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'خطا در آزمون اتصال درگاه' },
      { status: 500 }
    );
  }
}
