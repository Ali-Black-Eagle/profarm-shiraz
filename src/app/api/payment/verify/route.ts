import { NextRequest, NextResponse } from 'next/server';
import { verifyPayment } from '@/lib/zarinpal';
import { verifySnappPayPayment } from '@/lib/snapppay';
import { farmStore } from '@/lib/db-store';
import { isMockGatewayEnabled, verifyMockAuthority, MOCK_AUTHORITY_PREFIX } from '@/lib/mock-gateway';
import type { Order } from '@/types';

// Subscriptions are sold for one month (see POST /api/orders)
const SUBSCRIPTION_MONTHS = 1;

/**
 * Activates the paid plan for the account that placed the order (order.userId), never for a phone
 * number typed at checkout. Plans outside PLUS/PRO are ignored.
 */
function activateSubscriptionFromOrder(order: Order): void {
  const plan = order.subscriptionPlan;
  if (!order.isSubscription || (plan !== 'PLUS' && plan !== 'PRO')) return;
  if (!order.userId) {
    console.error(`[Subscription] Order ${order.orderNumber} has no owner account; plan not activated.`);
    return;
  }
  const updated = farmStore.activateSubscriptionForUser(order.userId, plan, SUBSCRIPTION_MONTHS);
  if (!updated) {
    console.error(`[Subscription] Owner account not found for order ${order.orderNumber}; plan not activated.`);
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const gateway = searchParams.get('gateway') || 'zarinpal';
  const authority = searchParams.get('Authority') || searchParams.get('authority');
  const token = searchParams.get('token') || searchParams.get('paymentToken');
  const status = searchParams.get('Status') || searchParams.get('status');
  const orderNumber = searchParams.get('orderNumber');

  if (!orderNumber) {
    return NextResponse.redirect(new URL('/checkout?error=missing_order_number', req.url));
  }

  const order = farmStore.getOrderById(orderNumber);
  if (!order) {
    return NextResponse.redirect(new URL('/checkout?error=order_not_found', req.url));
  }

  // Prevent Replay Attacks: If order is already paid, redirect straight to success
  if (order.status === 'PROCESSING' || order.status === 'OUT_FOR_DELIVERY' || order.status === 'DELIVERED') {
    return NextResponse.redirect(
      new URL(
        `/checkout/success?orderNumber=${encodeURIComponent(orderNumber)}&refId=PAID&gateway=${gateway}`,
        req.url
      )
    );
  }

  // SECURITY: Validate that the callback's authority strictly matches the one registered on this order
  const incomingAuthority = (authority || token || '').trim();
  if (!order.payment?.authority || !incomingAuthority || incomingAuthority !== order.payment.authority) {
    console.warn(`[Security Alert] Authority mismatch or missing for order ${orderNumber}.`);
    return NextResponse.redirect(
      new URL('/checkout?error=invalid_payment_authority', req.url)
    );
  }

  // 1. If user cancelled on gateway
  if (status !== 'OK') {
    if (order.status === 'PENDING_PAYMENT') {
      await farmStore.updateOrderStatus(orderNumber, 'CANCELLED');
      farmStore.restoreOrderStock(orderNumber);
    }
    return NextResponse.redirect(
      new URL('/checkout?error=payment_cancelled_or_failed', req.url)
    );
  }

  // Use immutable server-side order total amount (ignore any query param tampering)
  const amountToVerify = order.totalAmount;

  // 2. Handle SnappPay verification
  if (gateway === 'snapppay') {
    const paymentToken = (token || authority || '').trim();
    if (!paymentToken) {
      return NextResponse.redirect(
        new URL('/checkout?error=invalid_payment_token', req.url)
      );
    }
    const verifyResult = await verifySnappPayPayment({
      paymentToken,
      amount: amountToVerify,
      orderNumber,
    });

    if (verifyResult.success) {
      const refId = verifyResult.refId || 'SNP-' + Date.now();
      await farmStore.updateOrderStatus(orderNumber, 'PROCESSING');
      if (order.payment) {
        order.payment.status = 'SUCCESS';
        order.payment.refId = refId;
      }
      order.settlementRef = refId;
      order.settlementStatus = 'SETTLED';

      // Send ORDER_PLACED notification SMS now that payment is confirmed
      farmStore.sendOrderPlacedSms(order);

      activateSubscriptionFromOrder(order);
      farmStore.saveServerState();

      return NextResponse.redirect(
        new URL(
          `/checkout/success?orderNumber=${encodeURIComponent(orderNumber)}&refId=${encodeURIComponent(refId)}&gateway=snapppay`,
          req.url
        )
      );
    } else {
      console.error('[Payment Verification Failed - SnappPay]', {
        orderNumber,
        message: verifyResult.message,
      });
      return NextResponse.redirect(
        new URL('/checkout?error=snapppay_verification_failed', req.url)
      );
    }
  }

  // 3. Handle ZarinPal verification
  if (!authority) {
    return NextResponse.redirect(new URL('/checkout?error=invalid_authority', req.url));
  }

  // Mock authorities (dev only) are accepted only when the mock gateway is enabled, and only with a
  // valid HMAC for this order and its server-side total. The query string cannot enable them.
  let verifyResult: { success: boolean; refId?: string; message?: string };
  if (authority.startsWith(MOCK_AUTHORITY_PREFIX)) {
    const mockCheck = isMockGatewayEnabled()
      ? verifyMockAuthority(authority, orderNumber, amountToVerify)
      : null;
    if (!mockCheck) {
      console.warn(`[Security Alert] Invalid mock payment authority for order ${orderNumber}.`);
      return NextResponse.redirect(new URL('/checkout?error=invalid_payment_authority', req.url));
    }
    verifyResult = {
      success: true,
      refId: 'MOCK-' + mockCheck.timestamp,
      message: 'پرداخت تستی با موفقیت ثبت شد.',
    };
  } else {
    verifyResult = await verifyPayment({
      authority,
      amount: amountToVerify,
      orderId: orderNumber,
    });
  }

  if (verifyResult.success) {
    const refId = verifyResult.refId || 'REF-' + Date.now();
    // Payment verified! Advance order to PROCESSING
    await farmStore.updateOrderStatus(orderNumber, 'PROCESSING');
    if (order.payment) {
      order.payment.status = 'SUCCESS';
      order.payment.refId = refId;
    }
    order.settlementRef = refId;
    order.settlementStatus = 'SETTLED';

    // Send ORDER_PLACED notification SMS now that payment is confirmed
    farmStore.sendOrderPlacedSms(order);

    activateSubscriptionFromOrder(order);
    farmStore.saveServerState();

    return NextResponse.redirect(
      new URL(
        `/checkout/success?orderNumber=${encodeURIComponent(orderNumber)}&refId=${encodeURIComponent(refId)}&gateway=zarinpal`,
        req.url
      )
    );
  } else {
    console.error('[Payment Verification Failed - ZarinPal]', {
      orderNumber,
      message: verifyResult.message,
    });
    return NextResponse.redirect(
      new URL('/checkout?error=payment_verification_failed', req.url)
    );
  }
}
