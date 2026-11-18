import { NextResponse } from 'next/server';
import { farmStore } from '@/lib/db-store';
import { isMockGatewayEnabled } from '@/lib/mock-gateway';
import { apiErrorResponse } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';

/**
 * GET /api/payment-options: which payment methods checkout may offer. Credentials and merchant ids are never returned.
 * zarinpal.enabled is also true while the dev-only mock gateway is active (it replaces ZarinPal locally).
 */
export async function GET() {
  try {
    const settings = farmStore.getClientPaymentSettings();
    const mockGateway = isMockGatewayEnabled();

    return NextResponse.json(
      {
        success: true,
        currency: settings.general.currency,
        paymentTimeoutMinutes: settings.general.paymentTimeoutMinutes,
        guideMessage: settings.general.guideMessage ?? '',
        gateways: {
          zarinpal: { enabled: settings.zarinpal.enabled || mockGateway },
          snapppay: { enabled: settings.snapppay.enabled, minAmount: settings.snapppay.minAmount },
          cod: { enabled: settings.general.allowCashOnDelivery },
        },
        mockGateway,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    return apiErrorResponse(error, 'payment-options GET', 'خطا در دریافت روش‌های پرداخت');
  }
}
