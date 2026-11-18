/**
 * Creates the gateway payment (authority or token) for an existing unpaid order.
 * Shared by POST /api/orders (first payment) and POST /api/orders/[id]/retry-payment (new authority).
 *
 * The caller decides what a failure means: POST /api/orders cancels the new order, retry keeps it pending.
 * On success the payment is attached to the order (replacing any earlier, unpaid attempt).
 */
import { farmStore } from './db-store';
import { requestPayment } from './zarinpal';
import { requestSnappPayPayment } from './snapppay';
import { isMockGatewayEnabled, createMockAuthority } from './mock-gateway';

export type OnlinePaymentMethod = 'zarinpal' | 'snapppay';

export interface InitOnlinePaymentInput {
  orderNumber: string;
  /** Server-side order total (IRT). */
  amount: number;
  method: OnlinePaymentMethod;
  /** Phone the gateway may use for its own notification. */
  mobile?: string;
}

export type InitOnlinePaymentResult =
  | {
      success: true;
      gateway: OnlinePaymentMethod;
      authority: string | null;
      paymentToken?: string | null;
      paymentUrl: string;
      plan?: unknown;
    }
  | { success: false; message: string };

export async function initOnlinePayment(input: InitOnlinePaymentInput): Promise<InitOnlinePaymentResult> {
  const { orderNumber, amount, method, mobile } = input;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const callbackBase = `${appUrl}/api/payment/verify?orderNumber=${encodeURIComponent(orderNumber)}`;

  if (method === 'snapppay') {
    const snappPayReq = await requestSnappPayPayment({
      amount,
      description: `خرید اقساطی ۴ ماهه اسنپ‌پی سفارش کد ${orderNumber}`,
      orderNumber,
      callbackUrl: `${callbackBase}&gateway=snapppay`,
      mobile: mobile ?? '',
    });

    if (!snappPayReq.success || !snappPayReq.paymentUrl) {
      return {
        success: false,
        message: snappPayReq.message || 'خطا در برقراری ارتباط با درگاه پرداخت اقساطی اسنپ‌پی',
      };
    }

    farmStore.attachPaymentToOrder(orderNumber, {
      id: `pay-${Date.now()}`,
      orderId: orderNumber,
      amount,
      gateway: 'snapppay',
      authority: snappPayReq.paymentToken || null,
      status: 'INITIATED',
      createdAt: new Date().toISOString(),
    });

    return {
      success: true,
      gateway: 'snapppay',
      authority: snappPayReq.paymentToken || null,
      paymentToken: snappPayReq.paymentToken,
      paymentUrl: snappPayReq.paymentUrl,
      plan: snappPayReq.plan,
    };
  }

  // DEV ONLY: mock gateway (lib/mock-gateway.ts). Never active outside NODE_ENV=development with PAYMENT_MOCK_GATEWAY=1.
  if (isMockGatewayEnabled()) {
    const mockAuthority = createMockAuthority(orderNumber, amount);
    farmStore.attachPaymentToOrder(orderNumber, {
      id: `pay-${Date.now()}`,
      orderId: orderNumber,
      amount,
      gateway: 'zarinpal',
      authority: mockAuthority,
      status: 'INITIATED',
      createdAt: new Date().toISOString(),
    });

    return {
      success: true,
      gateway: 'zarinpal',
      authority: mockAuthority,
      paymentUrl: `/checkout/mock-gateway?orderNumber=${encodeURIComponent(orderNumber)}&Authority=${encodeURIComponent(mockAuthority)}&amount=${amount}`,
    };
  }

  const paymentReq = await requestPayment({
    amount,
    description: `سفارش محصولات ارگانیک شیراز کد ${orderNumber}`,
    orderNumber,
    callbackUrl: `${callbackBase}&gateway=zarinpal`,
    mobile: mobile ?? '',
  });

  if (!paymentReq.success || !paymentReq.paymentUrl) {
    return {
      success: false,
      message: paymentReq.message || 'خطا در برقراری ارتباط با درگاه پرداخت زرین‌پال',
    };
  }

  farmStore.attachPaymentToOrder(orderNumber, {
    id: `pay-${Date.now()}`,
    orderId: orderNumber,
    amount,
    gateway: 'zarinpal',
    authority: paymentReq.authority || null,
    status: 'INITIATED',
    createdAt: new Date().toISOString(),
  });

  return {
    success: true,
    gateway: 'zarinpal',
    authority: paymentReq.authority || null,
    paymentUrl: paymentReq.paymentUrl,
  };
}
