'use client';

import { useEffect, useRef, useState } from 'react';

/** Pricing answer from POST /api/orders/quote (the same object the order is charged with). */
export interface QuoteLineView {
  productId: string;
  title: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  discount: number;
  eggCount: number;
  eggDiscountedCount: number;
}

export interface QuoteView {
  ok: boolean;
  errors: string[];
  stockIssue: boolean;
  tier: 'FREE' | 'PLUS' | 'PRO';
  isSubscription: boolean;
  subscriptionPlan: 'PLUS' | 'PRO' | null;
  lines: QuoteLineView[];
  subtotal: number;
  tierDiscount: number;
  eggDiscount: number;
  otherDiscount: number;
  shippingBase: number;
  shippingDiscount: number;
  shipping: number;
  couponCode: string | null;
  couponDiscount: number;
  couponError: string | null;
  total: number;
  isBulk: boolean;
  isShiraz: boolean;
  eggQuota: { limit: number; usedBefore: number; remainingBefore: number };
  slot: { id: string; dayOfWeek?: string; timeWindow?: string; date?: string } | null;
}

export interface QuoteRequest {
  items?: { productId: string; quantity: number }[];
  couponCode?: string | null;
  slotId?: string | null;
  /** Omit until the customer has typed a city, so the Shiraz rule is not judged on an empty address. */
  city?: string;
  province?: string;
  isSubscription?: boolean;
  subscriptionPlan?: 'PLUS' | 'PRO';
}

const DEFAULT_RETRY_SECONDS = 10;

/**
 * Asks the server to price the request. Debounced, and an older answer never overwrites a newer one.
 * Pass null to skip the request (quote is then null).
 *
 * Rate limited (429): the previous quote stays on screen, `rateLimitedSeconds` is set, and the same request is
 * sent again after the server's retry delay. A successful answer clears `rateLimitedSeconds`.
 */
export function useQuote(request: QuoteRequest | null, delayMs = 250) {
  const [quote, setQuote] = useState<QuoteView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitedSeconds, setRateLimitedSeconds] = useState<number | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const requestKey = request ? JSON.stringify(request) : null;
  const seq = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // A new request (or a retry) replaces any scheduled retry.
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    if (requestKey === null) {
      setQuote(null);
      setLoading(false);
      setError(null);
      setRateLimitedSeconds(null);
      return;
    }
    const current = ++seq.current;
    const controller = new AbortController();
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/orders/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestKey,
          signal: controller.signal,
        });
        const data = await res.json().catch(() => null);
        if (current !== seq.current) return;

        if (res.status === 429) {
          const headerSeconds = Number(res.headers.get('Retry-After'));
          const bodySeconds = Number(data?.retryAfterSeconds);
          const seconds = Math.max(
            1,
            Math.ceil(bodySeconds || headerSeconds || DEFAULT_RETRY_SECONDS)
          );
          // The previous quote is kept on purpose; the page disables submit while it is rate limited.
          setRateLimitedSeconds(seconds);
          retryTimer.current = setTimeout(() => {
            retryTimer.current = null;
            setRetryTick((t) => t + 1);
          }, seconds * 1000);
          return;
        }

        setRateLimitedSeconds(null);
        if (!res.ok || !data?.success || !data.quote) {
          setError(data?.message || 'خطا در محاسبه مبلغ سفارش. لطفاً دوباره تلاش فرمایید.');
          setQuote(null);
        } else {
          setQuote(data.quote as QuoteView);
          setError(null);
        }
      } catch (err: unknown) {
        if (controller.signal.aborted || current !== seq.current) return;
        setError('ارتباط با سرور برقرار نشد. لطفاً اتصال اینترنت را بررسی و دوباره تلاش فرمایید.');
        setQuote(null);
      } finally {
        if (current === seq.current) setLoading(false);
      }
    }, delayMs);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [requestKey, delayMs, retryTick]);

  // No retry may fire after the component is gone.
  useEffect(
    () => () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    },
    []
  );

  return { quote, loading, error, rateLimitedSeconds };
}
