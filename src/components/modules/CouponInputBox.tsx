'use client';

import React, { useState, useEffect } from 'react';
import { farmStore } from '@/lib/db-store';
import { CouponValidationResult, CartItem } from '@/types';
import { formatToman, toPersianDigits } from '@/lib/formatters';
import { TicketPercent, Check, X, AlertCircle, Sparkles, Tag, ArrowLeft } from 'lucide-react';
import { useCart } from '@/hooks/useCart';

interface CouponInputBoxProps {
  cartItems: CartItem[];
  itemsSubtotal: number;
  shippingFee: number;
  onCouponChange: (result: CouponValidationResult | null) => void;
  className?: string;
  showSuggestions?: boolean;
}

export function CouponInputBox({
  cartItems,
  itemsSubtotal,
  shippingFee,
  onCouponChange,
  className = '',
  showSuggestions = false,
}: CouponInputBoxProps) {
  const { appliedCouponCode, setAppliedCouponCode } = useCart();
  const [inputCode, setInputCode] = useState(appliedCouponCode || '');
  const [appliedResult, setAppliedResult] = useState<CouponValidationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Validate on mount if appliedCouponCode exists
  useEffect(() => {
    if (appliedCouponCode && cartItems.length > 0) {
      const res = farmStore.validateAndApplyCoupon(
        appliedCouponCode,
        cartItems,
        shippingFee,
        itemsSubtotal
      );
      if (res.isValid) {
        setAppliedResult(res);
        onCouponChange(res);
      } else {
        setAppliedCouponCode(null);
        setAppliedResult(null);
        onCouponChange(null);
      }
    }
  }, [appliedCouponCode, cartItems, shippingFee, itemsSubtotal]);

  const handleApply = (codeToApply?: string) => {
    const code = (codeToApply || inputCode).trim().toUpperCase();
    setErrorMessage(null);

    if (!code) {
      setErrorMessage('لطفاً کد تخفیف را وارد کنید.');
      return;
    }

    setIsLoading(true);
    const res = farmStore.validateAndApplyCoupon(
      code,
      cartItems,
      shippingFee,
      itemsSubtotal
    );
    setIsLoading(false);

    if (res.isValid) {
      setAppliedResult(res);
      setAppliedCouponCode(code);
      setInputCode(code);
      onCouponChange(res);
    } else {
      setAppliedResult(null);
      setErrorMessage(res.message);
      onCouponChange(null);
    }
  };

  const handleRemove = () => {
    setAppliedResult(null);
    setAppliedCouponCode(null);
    setInputCode('');
    setErrorMessage(null);
    onCouponChange(null);
  };

  const sampleCoupons = [
    { code: 'SHIRAZ1403', label: '۱۵٪ کل سبد' },
    { code: 'FREESHIP', label: 'ارسال رایگان' },
    { code: 'HONEY50', label: '۵۰ هزارتومان عسل' },
  ];

  return (
    <div className={`bg-white rounded-3xl p-5 border border-[#E6E1D5] shadow-farm space-y-3.5 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-emerald-100 text-[#2C4A2E] flex items-center justify-center">
            <TicketPercent className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-gray-800">کد تخفیف مزارع شیراز</span>
        </div>

        {appliedResult && (
          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            فعال و اعمال‌شده
          </span>
        )}
      </div>

      {appliedResult ? (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between animate-in fade-in">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-xs text-emerald-900 tracking-wider">
                {appliedResult.coupon?.code}
              </span>
              <span className="text-xs font-bold text-emerald-800">
                ({appliedResult.coupon?.title})
              </span>
            </div>
            <div className="text-[11px] text-emerald-700 font-bold">
              مبلغ کسر شده:{' '}
              <span className="text-sm font-black">
                {formatToman(appliedResult.discountAmount)} تخفیف
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRemove}
            aria-label="حذف کد تخفیف"
            className="p-2 rounded-xl hover:bg-rose-100 text-gray-600 hover:text-rose-700 transition-colors cursor-pointer"
            title="حذف کد تخفیف"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex gap-2">
            <input
              type="text"
              aria-label="کد تخفیف"
              placeholder="کد تخفیف (مثلاً SHIRAZ1403)"
              value={inputCode}
              onChange={(e) => {
                setInputCode(e.target.value.toUpperCase());
                setErrorMessage(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleApply();
                }
              }}
              className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-base sm:text-xs font-mono tracking-wider text-left focus:bg-white focus:border-[#2C4A2E] outline-none transition-all"
              dir="ltr"
            />
            <button
              type="button"
              onClick={() => handleApply()}
              disabled={isLoading}
              className="px-5 py-2.5 rounded-xl bg-[#2C4A2E] hover:bg-[#1E3520] active:scale-95 text-white text-xs font-bold shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-90 disabled:cursor-wait flex items-center justify-center gap-1.5 shrink-0"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>اعمال کد</span>
              )}
            </button>
          </div>

          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px] flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Quick Clickable Suggestions (Hidden by default, especially on checkout) */}
          {showSuggestions && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-gray-500 font-medium">کدهای تخفیف فعال:</span>
              {sampleCoupons.map((s) => (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => {
                    setInputCode(s.code);
                    handleApply(s.code);
                  }}
                  className="px-2 py-1 rounded-lg bg-gray-100 hover:bg-emerald-50 hover:text-emerald-800 text-gray-600 text-[10px] font-mono transition-colors cursor-pointer border border-transparent hover:border-emerald-200"
                >
                  {s.code} ({s.label})
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
