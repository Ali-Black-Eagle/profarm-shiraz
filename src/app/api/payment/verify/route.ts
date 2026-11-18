import { NextRequest, NextResponse } from 'next/server';
import { verifyPayment } from '@/lib/zarinpal';
import { verifySnappPayPayment } from '@/lib/snapppay';
import { farmStore } from '@/lib/db-store';
import { isMockGatewayEnabled, verifyMockAuthority, MOCK_AUTHORITY_PREFIX } from '@/lib/mock-gateway';
import { withOrderLock } from '@/lib/order-lock';
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

function successPath(orderNumber: string, refId: string, gateway: string): string {
  return `/checkout/success?orderNumber=${encodeURIComponent(orderNumber)}&refId=${encodeURIComponent(refId)}&gateway=${gateway}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const gateway = searchParams.get('gateway') === 'snapppay' ? 'snapppay' : 'zarinpal';
  const authority = searchParams.get('Authority') || searchParams.get('authority');
  const token = searchParams.get('token') || searchParams.get('paymentToken');
  const status = searchParams.get('Status') || searchParams.get('status');
  const orderNumber = searchParams.get('orderNumber');

  if (!orderNumber) {
    return NextResponse.redirect(new URL('/checkout?error=missing_order_number', req.url));
  }

  // Callbacks for the same order run one at a time, so the state check and the status change cannot interleave.
  return withOrderLock(orderNumber, () =>
    processCallback(req, { gateway, authority, token, status, orderNumber })
  );
}

async function processCallback(
  req: NextRequest,
  p: { gateway: 'zarinpal' | 'snapppay'; authority: string | null; token: string | null; status: string | null; orderNumber: string }
): Promise<NextResponse> {
  const { gateway, authority, token, status, orderNumber } = p;
  const redirect = (path: string) => NextResponse.redirect(new URL(path, req.url));

  // Only this order is looked at. The global expiry sweep never runs here: that is what used to cancel an order
  // while its own payment was being verified.
  const order = farmStore.getOrderById(orderNumber);
  if (!order) return redirect('/checkout?error=order_not_found');

  // Replay of a paid order: nothing changes, show the success page again
  if (order.status === 'PROCESSING' || order.status === 'OUT_FOR_DELIVERY' || order.status === 'DELIVERED') {
    return redirect(successPath(orderNumber, order.payment?.refId || 'PAID', gateway));
  }
  if (order.status === 'CANCELLED' && order.paidAfterCancel) {
    return redirect('/checkout?error=paid_after_cancel');
  }

  // SECURITY: the callback's authority must match the one registered on this order
  const incomingAuthority = (authority || token || '').trim();
  if (!order.payment?.authority || !incomingAuthority || incomingAuthority !== order.payment.authority) {
    console.warn(`[Security Alert] Authority mismatch or missing for order ${orderNumber}.`);
    return redirect('/checkout?error=invalid_payment_authority');
  }

  // 1. The customer cancelled on the gateway page: release the order (stock, slot, coupon)
  if (status !== 'OK') {
    if (order.status === 'PENDING_PAYMENT') {
      await farmStore.updateOrderStatus(orderNumber, 'CANCELLED');
    }
    return redirect('/checkout?error=payment_cancelled_or_failed');
  }

  // Payment deadline. An unpaid order past its deadline is released here. A payment that still arrives may revive it,
  //    but only when stock, slot and coupon can be taken again. Otherwise the gateway is NOT asked: ZarinPal reverses
  //    payments it cannot verify, so the customer keeps their money and sees an expiry message.
  farmStore.expireOrderIfDue(orderNumber);
  const current = farmStore.getOrderById(orderNumber) ?? order;
  let reviveExpired = false;
  if (current.status === 'CANCELLED' && current.cancelledByExpiry) {
    const check = farmStore.canReviveExpiredOrder(current);
    if (!check.ok) {
      console.warn(`[Payment] Order ${orderNumber} expired and cannot be revived (${check.reason}). Gateway not called.`);
      return redirect('/checkout?error=order_expired');
    }
    reviveExpired = true;
  } else if (current.status !== 'PENDING_PAYMENT') {
    // Cancelled by a customer or an admin: no online payment applies, so the gateway is not asked.
    return redirect('/checkout?error=order_not_payable');
  }

  // Use the immutable server-side total (ignore any query param tampering)
  const amountToVerify = current.totalAmount;

  // 2. Ask the gateway
  let verifyResult: { success: boolean; refId?: string; message?: string };
  if (gateway === 'snapppay') {
    const paymentToken = (token || authority || '').trim();
    if (!paymentToken) return redirect('/checkout?error=invalid_payment_token');
    verifyResult = await verifySnappPayPayment({ paymentToken, amount: amountToVerify, orderNumber });
  } else {
    if (!authority) return redirect('/checkout?error=invalid_authority');
    if (authority.startsWith(MOCK_AUTHORITY_PREFIX)) {
      // Mock authorities (dev only) are accepted only when the mock gateway is enabled, and only with a valid
      // HMAC for this order and its server-side total. The query string cannot enable them.
      const mockCheck = isMockGatewayEnabled() ? verifyMockAuthority(authority, orderNumber, amountToVerify) : null;
      if (!mockCheck) {
        console.warn(`[Security Alert] Invalid mock payment authority for order ${orderNumber}.`);
        return redirect('/checkout?error=invalid_payment_authority');
      }
      verifyResult = { success: true, refId: 'MOCK-' + mockCheck.timestamp, message: 'پرداخت تستی با موفقیت ثبت شد.' };
    } else {
      verifyResult = await verifyPayment({ authority, amount: amountToVerify, orderId: orderNumber });
    }
  }

  if (!verifyResult.success) {
    console.error(`[Payment Verification Failed - ${gateway}]`, { orderNumber, message: verifyResult.message });
    // The order stays PENDING_PAYMENT, so the customer can retry until the timeout releases it.
    return redirect(
      gateway === 'snapppay' ? '/checkout?error=snapppay_verification_failed' : '/checkout?error=payment_verification_failed'
    );
  }

  // 3. Record the confirmed payment. A pending order becomes paid; an order released by expiry is revived, or the
  //    payment is flagged PAID_AFTER_CANCEL when its resources have gone in the meantime (refund needed).
  const refId = verifyResult.refId || (gateway === 'snapppay' ? 'SNP-' : 'REF-') + Date.now();
  const recorded = reviveExpired
    ? farmStore.reviveExpiredOrder(orderNumber, { refId, gateway })
    : farmStore.recordSuccessfulPayment(orderNumber, { refId, gateway });

  switch (recorded.outcome) {
    case 'PAID': {
      if (recorded.order) {
        // Send the ORDER_PLACED notification now that payment is confirmed
        farmStore.sendOrderPlacedSms(recorded.order);
        activateSubscriptionFromOrder(recorded.order);
      }
      farmStore.saveServerState();
      return redirect(successPath(orderNumber, refId, gateway));
    }
    case 'ALREADY_PAID':
      return redirect(successPath(orderNumber, recorded.order?.payment?.refId || refId, gateway));
    case 'PAID_AFTER_CANCEL':
      console.error(
        `[Payment] Order ${orderNumber} was paid (refId ${refId}) after it was cancelled. It was not revived. Refund required.`
      );
      return redirect('/checkout?error=paid_after_cancel');
    default:
      console.error(`[Payment] Order ${orderNumber} is not payable in its current state.`);
      return redirect('/checkout?error=order_not_payable');
  }
}
