'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useCart } from '@/hooks/useCart';
import { formatToman, toPersianDigits } from '@/lib/formatters';
import { ShoppingBag, ArrowLeft, ChevronDown, ChevronUp, Plus, Minus, Trash2 } from 'lucide-react';

export const CartFloatingPopup: React.FC = () => {
  const pathname = usePathname();
  const { items, updateQuantity, removeItem, getTotalPrice, getTotalItemsCount } = useCart();
  const [isMounted, setIsMounted] = useState(false);
  // Initially starts in closed/minimized state as requested
  const [isOpen, setIsOpen] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const totalCount = getTotalItemsCount();
  const totalPrice = getTotalPrice();

  // Exclude cart page, checkout / gateway / success steps, admin pages, and login page
  const isExcluded = useMemo(() => {
    if (!pathname) return false;
    const cleanPath = pathname.toLowerCase();
    return (
      cleanPath === '/cart' ||
      cleanPath.startsWith('/cart/') ||
      cleanPath === '/checkout' ||
      cleanPath.startsWith('/checkout/') ||
      cleanPath.startsWith('/admin') ||
      cleanPath === '/login' ||
      cleanPath.startsWith('/login/')
    );
  }, [pathname]);

  if (!isMounted || isExcluded || totalCount <= 0 || items.length === 0) {
    return null;
  }

  // Adjust bottom offset on product detail page to avoid colliding with sticky action bar on mobile
  const isProductDetailPage = pathname?.startsWith('/products/');
  const positionClass = isProductDetailPage
    ? 'bottom-20 sm:bottom-6 left-3 right-3 sm:right-auto sm:left-6'
    : 'bottom-4 sm:bottom-6 left-3 right-3 sm:right-auto sm:left-6';

  // ================= 1. حالت بسته (Minimized Pill) =================
  if (!isOpen) {
    return (
      <aside
        aria-label="سبد خرید شناور"
        className={`fixed z-30 no-print animate-in fade-in ${
          isProductDetailPage
            ? 'bottom-24 sm:bottom-6 left-4 sm:left-6'
            : 'bottom-4 sm:bottom-6 left-4 sm:left-6'
        }`}
      >
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-3 min-h-[48px] bg-farm-primary text-white px-4 py-2.5 rounded-2xl shadow-xl hover:bg-farm-primary-dark active:scale-98 transition-all cursor-pointer border border-farm-accent/40 group"
          title="مشاهده و باز کردن سبد خرید"
        >
          <div className="relative flex items-center justify-center shrink-0">
            <ShoppingBag className="w-5 h-5 text-farm-accent group-hover:scale-105 transition-transform" />
            <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 bg-farm-accent-warm text-white text-xs font-black rounded-full flex items-center justify-center border-2 border-farm-primary">
              {toPersianDigits(totalCount)}
            </span>
          </div>

          <div className="flex flex-col text-right">
            <span className="text-xs font-black leading-tight text-white">
              سبد خرید ({toPersianDigits(totalCount)})
            </span>
            <span className="text-xs text-[#F3E5AB] font-bold mt-0.5">
              {formatToman(totalPrice)}
            </span>
          </div>

          <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors mr-1">
            <ChevronUp className="w-4 h-4 text-emerald-200 group-hover:-translate-y-0.5 transition-transform" />
          </div>
        </button>
      </aside>
    );
  }

  // ================= 2. حالت باز شده (Expanded Modal / Card) =================
  return (
    <aside
      aria-label="پاپ آپ سبد خرید"
      className={`fixed ${positionClass} sm:w-[380px] z-30 no-print animate-in slide-in-from-bottom-4`}
    >
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-farm-primary/25 overflow-hidden ring-1 ring-black/5 flex flex-col">
        {/* Header with Minimize Button (Closed cart + Down arrow) */}
        <div className="bg-gradient-to-l from-farm-primary to-farm-primary-dark text-white px-3.5 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative flex items-center justify-center w-7 h-7 rounded-lg bg-white/15 border border-white/20">
              <ShoppingBag className="w-3.5 h-3.5 text-[#D4A373]" />
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-[#E76F51] text-white text-xs font-black rounded-full flex items-center justify-center">
                {toPersianDigits(totalCount)}
              </span>
            </div>
            <div>
              <div className="text-xs font-black flex items-center gap-1.5 text-white">
                <span>سبد خرید شما</span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
            </div>
          </div>

          {/* Minimize button: Closed cart icon with down arrow indicating minimizing */}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="flex items-center justify-center gap-1 min-h-11 min-w-11 px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white transition-all cursor-pointer group"
            title="کوچک کردن پنجره سبد خرید"
            aria-label="کوچک کردن سبد خرید"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-[#D4A373]" />
            <ChevronDown className="w-4 h-4 text-emerald-200 group-hover:translate-y-0.5 transition-transform" />
            <span className="text-xs font-bold text-white/90">بستن</span>
          </button>
        </div>

        {/* Compact Items List: Optimized footprint so at least 5 items fit comfortably */}
        <div className="p-2.5 bg-white space-y-1.5 max-h-[250px] overflow-y-auto overscroll-contain">
          {items.map((item) => {
            const maxStock = item.product.stock || 1;
            const itemTotal = item.product.price * item.quantity;

            return (
              <div
                key={item.product.id}
                className="py-1 px-2 rounded-xl bg-farm-bg hover:bg-farm-bg-warm/80 transition-colors border border-farm-border/70 flex items-center justify-between gap-2"
              >
                {/* Mini Image */}
                <div className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-gray-200 bg-white">
                  <Image
                    src={item.product.images[0] || '/images/prod-eggs.jpg'}
                    alt={item.product.title}
                    fill
                    sizes="36px"
                    className="object-cover"
                  />
                </div>

                {/* Title & Price */}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-gray-900 truncate leading-tight">
                    {item.product.title}
                  </div>
                  <div className="text-xs text-farm-primary font-medium mt-0.5 flex items-center gap-1.5">
                    <span className="font-bold">{formatToman(itemTotal)}</span>
                    {item.quantity > 1 && (
                      <span className="text-gray-600 text-xs">
                        ({toPersianDigits(item.quantity)} × {formatToman(item.product.price)})
                      </span>
                    )}
                  </div>
                </div>

                {/* Quantity Controls & Delete */}
                <div className="flex items-center gap-1 shrink-0">
                  <div className="flex items-center bg-white border border-farm-border rounded-lg p-0.5 shadow-xs">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      disabled={item.quantity >= maxStock}
                      className="min-w-11 min-h-11 rounded flex items-center justify-center text-gray-700 hover:bg-farm-primary hover:text-white transition-colors disabled:opacity-25 cursor-pointer"
                      title="افزایش تعداد"
                      aria-label={`افزایش تعداد ${item.product.title}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>

                    <span className="w-6 text-center text-xs font-black text-farm-primary">
                      {toPersianDigits(item.quantity)}
                    </span>

                    <button
                      type="button"
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      className="min-w-11 min-h-11 rounded flex items-center justify-center text-gray-700 hover:bg-rose-700 hover:text-white transition-colors cursor-pointer"
                      title={item.quantity === 1 ? 'حذف محصول' : 'کاهش تعداد'}
                      aria-label={`کاهش تعداد ${item.product.title}`}
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Direct Trash/Remove button */}
                  <button
                    type="button"
                    onClick={() => removeItem(item.product.id)}
                    className="w-10 h-10 rounded-lg text-gray-500 hover:text-rose-700 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                    title="حذف کامل از سبد"
                    aria-label={`حذف کامل ${item.product.title}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer: Price Summary & CTA Button */}
        <div className="p-2.5 bg-gradient-to-t from-gray-50 to-white border-t border-gray-100 space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-gray-600 font-medium">
              مجموع خرید ({toPersianDigits(totalCount)} قلم):
            </span>
            <span className="text-sm font-black text-farm-primary">
              {formatToman(totalPrice)}
            </span>
          </div>

          <Link
            href="/cart"
            className="w-full py-2.5 px-3 rounded-xl bg-farm-primary text-white text-xs font-black hover:bg-farm-primary-dark active:scale-98 transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg cursor-pointer"
          >
            <span>مشاهده و تکمیل سفارش در سبد خرید</span>
            <ArrowLeft className="w-3.5 h-3.5 text-[#D4A373]" />
          </Link>
        </div>
      </div>
    </aside>
  );
};
