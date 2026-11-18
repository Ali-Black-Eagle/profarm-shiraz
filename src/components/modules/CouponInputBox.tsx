'use client';

import React, { useState } from 'react';
import { formatToman } from '@/lib/formatters';
import { TicketPercent, X, AlertCircle } from 'lucide-react';
import { useCart } from '@/hooks/useCart';

interface CouponInputBoxProps {
  /** Delivery slot and city, when known, so the coupon is checked against the same rules as the order. */
  slotId?: string | null;
  city?: string;
  province?: string;
  /** Discount the server calculated for the applied code (from the latest quote). */
  appliedDiscount?: number;
  /** Called after the server accepted or removed a code. */
  onChange?: (code: string | null) => void;
  className?: string;
}

/**
 * Coupon entry. Every code is checked by POST /api/coupons with the cart's lines, which runs the same pricing as the order.
 * The amount shown is recalculated by the quote, so this box never decides a discount by itself.
 */
export function CouponInputBox({ slotId, city, province, appliedDiscount, onChange, className = '' }: CouponInputBoxProps) {
  const { lines, appliedCouponCode, setAppliedCouponCode } = useCart();
  const [inputCode, setInputCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleApply = async () => {
    const code = inputCode.trim().toUpperCase();
    setErrorMessage(null);
    setSuccessMessage(null);
    if (!code) {
      setErrorMessage('لطفاً کد تخفیف را وارد کنید.');
      return;
    }
    if (lines.length === 0) {
      setErrorMessage('ابتدا کالایی به سبد خرید اضافه کنید.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
          slotId: slotId || undefined,
          address: city !== undefined ? { city, province: province || 'فارس' } : undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.isValid) {
        setErrorMessage(data?.message || 'کد تخفیف نامعتبر است.');
        return;
      }
      setAppliedCouponCode(code);
      setInputCode('');
      setSuccessMessage(data.message || 'کد تخفیف اعمال شد.');
      onChange?.(code);
    } catch {
      setErrorMessage('ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش فرمایید.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = () => {
    setAppliedCouponCode(null);
    setErrorMessage(null);
    setSuccessMessage(null);
    onChange?.(null);
  };

  return (
    <div className={`bg-white rounded-3xl p-5 border border-farm-border shadow-farm space-y-3.5 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-emerald-100 text-farm-primary flex items-center justify-center">
            <TicketPercent className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-gray-800">کد تخفیف</span>
        </div>
        {appliedCouponCode && (
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            اعمال‌شده
          </span>
        )}
      </div>

      {appliedCouponCode ? (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <span className="font-mono font-black text-xs text-emerald-900 tracking-wider break-all">
              {appliedCouponCode}
            </span>
            {typeof appliedDiscount === 'number' && appliedDiscount > 0 && (
              <div className="text-xs text-emerald-700 font-bold">
                مبلغ کسر شده: <span className="text-sm font-black">{formatToman(appliedDiscount)}</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleRemove}
            aria-label={`حذف کد تخفیف ${appliedCouponCode}`}
            className="min-w-11 min-h-11 flex items-center justify-center rounded-xl hover:bg-rose-100 text-gray-600 hover:text-rose-700 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex gap-2">
            <label htmlFor="coupon-code-input" className="sr-only">
              کد تخفیف
            </label>
            <input
              id="coupon-code-input"
              type="text"
              placeholder="کد تخفیف"
              value={inputCode}
              onChange={(e) => {
                setInputCode(e.target.value.toUpperCase());
                setErrorMessage(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleApply();
                }
              }}
              className="flex-1 min-w-0 min-h-11 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-base sm:text-xs font-mono tracking-wider text-left focus:bg-white focus:border-farm-primary outline-none transition-all"
              dir="ltr"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => void handleApply()}
              disabled={isLoading}
              className="min-h-11 px-5 py-2.5 rounded-xl bg-farm-primary hover:bg-farm-primary-dark text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-80 disabled:cursor-wait flex items-center justify-center shrink-0"
            >
              {isLoading ? 'در حال بررسی...' : 'اعمال کد'}
            </button>
          </div>

          {errorMessage && (
            <div role="alert" className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}
          {successMessage && (
            <div role="status" className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
              {successMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
