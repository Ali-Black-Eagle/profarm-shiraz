/**
 * Subscription tier resolution. Use getEffectiveTier wherever the tier affects pricing, delivery days,
 * the egg quota, the session or an API response. The stored `tier` alone is not enough, because a paid
 * plan stops applying when its expiry passes.
 */
import type { SubscriptionTier, User } from '@/types';
import { parseTehranDateValue } from './jalali';

type TierFields = Pick<User, 'tier' | 'subscriptionTier' | 'isProMember' | 'proExpiresAt' | 'plusExpiresAt'>;

/** The tier as stored on the account, before expiry is checked. */
export function getStoredTier(user: Partial<TierFields> | null | undefined): SubscriptionTier {
  if (!user) return 'FREE';
  const explicit = user.tier ?? user.subscriptionTier;
  if (explicit === 'PRO' || explicit === 'PLUS' || explicit === 'FREE') return explicit;
  return user.isProMember ? 'PRO' : 'FREE';
}

/**
 * Expiry instant of the paid plan (ms since epoch), or null when there is no readable date.
 * Date-only values (Jalali or Gregorian) expire at the end of that Tehran day.
 */
export function getSubscriptionExpiryMs(user: Partial<TierFields>, tier: SubscriptionTier): number | null {
  if (tier === 'PRO') return parseTehranDateValue(user.proExpiresAt, true);
  if (tier === 'PLUS') return parseTehranDateValue(user.plusExpiresAt, true);
  return null;
}

/**
 * The tier that applies right now:
 * - FREE stays FREE.
 * - The stored paid plan applies while its expiry is in the future, or while it has no readable expiry
 *   (accounts set by admins without a date).
 * - When the stored plan has expired, the other paid plan applies if it is still running (for example a PRO
 *   that ended while a PLUS bought earlier is still active). It needs a readable future expiry to apply.
 * - Otherwise the account is FREE.
 */
export function getEffectiveTier(
  user: Partial<TierFields> | null | undefined,
  nowMs: number = Date.now()
): SubscriptionTier {
  const stored = getStoredTier(user);
  if (stored === 'FREE' || !user) return 'FREE';
  const expiry = getSubscriptionExpiryMs(user, stored);
  if (expiry === null || expiry > nowMs) return stored;

  const other: SubscriptionTier = stored === 'PRO' ? 'PLUS' : 'PRO';
  const otherExpiry = getSubscriptionExpiryMs(user, other);
  if (otherExpiry !== null && otherExpiry > nowMs) return other;
  return 'FREE';
}

/** Days left on the plan that applies now (0 when none). */
export function getDaysRemaining(
  user: Partial<TierFields> | null | undefined,
  nowMs: number = Date.now()
): number {
  const tier = getEffectiveTier(user, nowMs);
  if (tier === 'FREE' || !user) return 0;
  const expiry = getSubscriptionExpiryMs(user, tier);
  if (expiry === null) return Infinity;
  return Math.max(0, Math.ceil((expiry - nowMs) / (24 * 60 * 60 * 1000)));
}
