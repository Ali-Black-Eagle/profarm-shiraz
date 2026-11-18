/**
 * Development-only mock payment gateway.
 *
 * Enabled ONLY when NODE_ENV === 'development' AND PAYMENT_MOCK_GATEWAY === '1'.
 * When enabled, order creation issues a signed mock authority instead of calling ZarinPal.
 * The authority is MOCK-<orderNumber>-<timestamp>-<hmac>, where hmac is HMAC-SHA256 with the
 * session secret over `${orderNumber}:${amount}:${timestamp}`. Verification recomputes it, so a
 * client cannot forge a successful payment or change the amount.
 */
import 'server-only';
import crypto from 'crypto';
import { getSessionSecret } from './session';

export const MOCK_AUTHORITY_PREFIX = 'MOCK-';

export function isMockGatewayEnabled(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.PAYMENT_MOCK_GATEWAY === '1';
}

function computeMac(orderNumber: string, amount: number, timestamp: string): string {
  return crypto
    .createHmac('sha256', getSessionSecret())
    .update(`${orderNumber}:${amount}:${timestamp}`)
    .digest('hex');
}

/** Creates the signed mock authority for an order. Only call when isMockGatewayEnabled() is true. */
export function createMockAuthority(orderNumber: string, amount: number): string {
  const timestamp = Date.now().toString();
  const mac = computeMac(orderNumber, amount, timestamp);
  return `${MOCK_AUTHORITY_PREFIX}${orderNumber}-${timestamp}-${mac}`;
}

/**
 * Verifies a mock authority for the given order and total. Returns the issue timestamp when valid.
 * Returns null when the format, order number, amount or signature does not match.
 */
export function verifyMockAuthority(
  authority: string,
  orderNumber: string,
  amount: number
): { timestamp: string } | null {
  if (!authority.startsWith(MOCK_AUTHORITY_PREFIX)) return null;
  const match = /^MOCK-(.+)-(\d{1,20})-([0-9a-f]{64})$/.exec(authority);
  if (!match) return null;

  const [, authOrderNumber, timestamp, givenMac] = match;
  if (authOrderNumber !== orderNumber) return null;

  const expected = Buffer.from(computeMac(orderNumber, amount, timestamp), 'hex');
  const given = Buffer.from(givenMac, 'hex');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;

  return { timestamp };
}
