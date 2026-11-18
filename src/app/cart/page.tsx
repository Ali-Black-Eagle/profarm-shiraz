'use client';

import React from 'react';
import Link from 'next/link';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { useQuote } from '@/hooks/useQuote';
import { formatToman, toPersianDigits } from '@/lib/formatters';
import { SITE_CONFIG } from '@/lib/site-config';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ArrowLeft,
  Crown,
  Truck,
  ShieldCheck,
  Package,
  AlertCircle,
  Zap,
  Tag,
  TicketPercent,
} from 'lucide-react';
import { CouponInputBox } from '@/components/modules/CouponInputBox';
import { useConfirm } from '@/components/ui/ToastProvider';

interface PlanPrices {
  PLUS?: { monthlyPrice: number };
  PRO?: { monthlyPrice: number };
}

export default function CartPage() {
  const confirm = useConfirm();
  const [mounted, setMounted] = React.useState(false);
  const [plans, setPlans] = React.useState<PlanPrices>({});
  const {
    items,
    lines,
    updateQuantity,
    removeItem,
    clearCart,
    catalogLoaded,
    catalogError,
    refreshCatalog,
    notice,
    clearNotice,
    appliedCouponCode,
  } = useCart();
  const { user } = useAuth();
  const [retryingCatalog, setRetryingCatalog] = React.useState(false);

  const retryCatalog = async () => {
    setRetryingCatalog(true);
    try {
      await refreshCatalog();
    } finally {
      setRetryingCatalog(false);
    }
  };

  React.useEffect(() => {
    setMounted(true);
    fetch('/api/subscriptions', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.plans) setPlans(data.plans);
      })
      .catch(() => {});
  }, []);

  // Preview without an address: the Shiraz shipping rate is shown, and checkout re-prices once the address is known.
  const quoteRequest = React.useMemo(
    () =>
      lines.length > 0
        ? {
            items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
            couponCode: appliedCouponCode,
          }
        : null,
    [lines, appliedCouponCode]
  );
  const { quote, loading: quoteLoading, error: quoteError, rateLimitedSeconds } = useQuote(quoteRequest);
  // Catalog failed and some lines have no product data: show a retry notice instead of a spinner or an empty list.
  const catalogMissing = catalogLoaded && catalogError && items.length < lines.length;

  const totalCount = lines.reduce((sum, l) => sum + l.quantity, 0);
  const userTier = user?.tier || (user?.isProMember ? 'PRO' : 'FREE');
  const meetsBulk = quote?.isBulk === true;

  if (!mounted) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 min-h-[50vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-farm-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="w-24 h-24 rounded-full bg-farm-bg-warm border border-farm-border flex items-center justify-center mx-auto text-farm-primary">
          <ShoppingBag className="w-10 h-10 text-gray-500" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-farm-primary">سبد خرید شما خالی است</h1>
          <p className="text-xs sm:text-sm text-gray-500">هنوز محصول ارگانیکی به سبد خرید خود اضافه نکرده‌اید.</p>
        </div>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-farm-primary text-white text-sm font-bold shadow-md hover:bg-farm-primary-dark transition-all"
        >
          <span>مشاهده محصولات ارگانیک شیراز</span>
          <ArrowLeft className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  if (!catalogLoaded) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 rounded-full border-2 border-farm-primary border-t-transparent animate-spin" />
        <span className="sr-only">در حال بارگذاری سبد خرید</span>
      </div>
    );
  }

  const subtotalShown = quote?.subtotal ?? 0;
  const payable = quote?.total ?? 0;
  const savings = (quote?.tierDiscount ?? 0) + (quote?.shippingDiscount ?? 0) + (quote?.couponDiscount ?? 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex items-center justify-between pb-4 border-b border-farm-border gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-farm-primary">سبد خرید شما</h1>
          <p className="text-xs text-gray-500 mt-1">
            شامل {toPersianDigits(totalCount)} بسته از فرآورده‌های طبیعی مزارع فارس
          </p>
        </div>

        <button
          type="button"
          onClick={async () => {
            const ok = await confirm({
              title: 'خالی کردن سبد خرید',
              description: 'همه کالاهای سبد حذف می‌شوند. آیا مطمئن هستید؟',
              confirmLabel: 'بله، خالی شود',
              cancelLabel: 'انصراف',
              variant: 'danger',
            });
            if (ok) clearCart();
          }}
          className="text-xs min-h-11 px-2 text-rose-600 hover:text-rose-800 font-medium flex items-center gap-1.5 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          <span>خالی کردن سبد</span>
        </button>
      </div>

      {catalogMissing && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" aria-hidden="true" />
            <span className="leading-relaxed">
              اطلاعات کالاهای سبد خرید در حال حاضر دریافت نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش نمایید.
            </span>
          </div>
          <button
            type="button"
            onClick={retryCatalog}
            disabled={retryingCatalog}
            className="min-h-11 px-4 rounded-xl bg-farm-primary text-white font-bold hover:bg-farm-primary-dark transition-colors disabled:opacity-60 cursor-pointer"
          >
            {retryingCatalog ? 'در حال تلاش...' : 'تلاش دوباره'}
          </button>
        </div>
      )}

      {notice && (
        <div role="status" className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-start justify-between gap-3">
          <span>{notice}</span>
          <button type="button" onClick={clearNotice} className="min-h-11 min-w-11 -m-2 px-2 text-amber-800 underline">
            متوجه شدم
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Cart Items List */}
        <div className="lg:col-span-8 space-y-4">
          {items.map(({ product, quantity }) => (
            <div
              key={product.id}
              className="bg-white rounded-3xl p-4 sm:p-5 border border-farm-border shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4 w-full sm:w-auto min-w-0">
                <img
                  src={product.images?.[0] || '/images/hero-shiraz-farm.jpg'}
                  alt=""
                  className="w-20 h-20 rounded-2xl object-cover border border-farm-border shrink-0"
                />
                <div className="space-y-1 min-w-0">
                  {product.packSize && <span className="text-xs text-[#8A6218] font-bold">{product.packSize}</span>}
                  <Link href={`/products/${product.slug}`}>
                    <h2 className="text-sm sm:text-base font-bold text-farm-primary hover:underline line-clamp-1">
                      {product.title}
                    </h2>
                  </Link>
                  <div className="text-xs text-gray-500">فی هر بسته: {formatToman(product.price)}</div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                {/* Quantity Controls (44px touch targets) */}
                <div className="flex items-center gap-1 bg-farm-bg border border-farm-border rounded-xl p-1">
                  <button
                    type="button"
                    onClick={() => updateQuantity(product.id, quantity - 1)}
                    aria-label={`کاهش تعداد ${product.title}`}
                    className="w-11 h-11 rounded-lg bg-white flex items-center justify-center text-farm-primary hover:bg-rose-600 hover:text-white transition-colors cursor-pointer"
                  >
                    <Minus className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <span className="w-8 text-center text-sm font-black text-farm-primary">{toPersianDigits(quantity)}</span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(product.id, quantity + 1)}
                    disabled={quantity >= product.stock}
                    aria-label={`افزایش تعداد ${product.title}`}
                    className="w-11 h-11 rounded-lg bg-white flex items-center justify-center text-farm-primary hover:bg-farm-primary hover:text-white transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="text-left min-w-20">
                  <span className="block text-sm sm:text-base font-black text-farm-primary">
                    {formatToman(product.price * quantity)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => removeItem(product.id)}
                  aria-label={`حذف ${product.title} از سبد`}
                  className="text-gray-600 hover:text-rose-600 min-w-11 min-h-11 flex items-center justify-center rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}

          {/* Bulk status: decided by the server rule (quote.isBulk), not by a customer switch */}
          <div className="bg-farm-bg-warm rounded-3xl p-5 border border-farm-border space-y-3">
            <div className="flex items-center gap-2.5">
              <Package className="w-5 h-5 text-farm-primary" aria-hidden="true" />
              <span className="text-sm font-bold text-farm-primary">سفارش عمده و ارسال خارج از شیراز</span>
            </div>
            <p className="text-xs text-gray-700 leading-relaxed">
              خرده‌فروشی مختص شهر شیراز است. برای ارسال به سایر شهرها، سبد خرید شما باید {SITE_CONFIG.policies.bulkThresholdLabel} داشته باشد.
            </p>
            <div
              className={`p-2.5 rounded-xl text-xs font-medium ${
                meetsBulk ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'
              }`}
            >
              {quoteLoading && !quote
                ? 'در حال بررسی شرایط سفارش...'
                : meetsBulk
                ? 'سبد خرید شما شرایط سفارش عمده را دارد.'
                : `سبد شما هنوز شرایط سفارش عمده را ندارد (${toPersianDigits(totalCount)} بسته).`}
            </div>
          </div>
        </div>

        {/* Order Summary Column */}
        <div className="lg:col-span-4 space-y-5">
          <CouponInputBox
            appliedDiscount={quote?.couponDiscount}
            onChange={() => {
              /* the quote refreshes from the store */
            }}
          />

          <div className="bg-white rounded-3xl p-6 border border-farm-border shadow-farm space-y-5 sticky top-28">
            <h2 className="text-base font-bold text-farm-primary pb-3 border-b border-farm-bg-warm">خلاصه فاکتور سفارش</h2>

            {quoteError && (
              <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                {quoteError}
              </div>
            )}

            {rateLimitedSeconds !== null && (
              <div role="status" className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                بروزرسانی مبلغ کمی کند شده است. مبلغ قبلی نمایش داده می‌شود و حدود {toPersianDigits(rateLimitedSeconds)} ثانیه دیگر
                دوباره محاسبه می‌شود.
              </div>
            )}

            {quote && quote.errors.length > 0 && (
              <ul role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1.5 list-disc pr-4">
                {quote.errors.map((msg) => (
                  <li key={msg}>{msg}</li>
                ))}
              </ul>
            )}

            <div className="space-y-3 text-xs text-gray-600">
              <div className="flex items-center justify-between">
                <span>تعداد کل بسته‌ها:</span>
                <span className="font-bold text-farm-primary">{toPersianDigits(totalCount)} بسته</span>
              </div>

              <div className="flex items-center justify-between">
                <span>مجموع ارزش کالاها:</span>
                <span className="font-bold text-farm-primary">{formatToman(subtotalShown)}</span>
              </div>

              {quote && quote.eggDiscount > 0 && (
                <div className="flex items-center justify-between text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200">
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                    <span>
                      تخفیف تخم‌مرغ (تا {toPersianDigits(quote.eggQuota.limit)} عدد در ماه):
                    </span>
                  </div>
                  <span className="font-bold">- {formatToman(quote.eggDiscount)}</span>
                </div>
              )}

              {quote && quote.otherDiscount > 0 && (
                <div className="flex items-center justify-between text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200">
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                    <span>تخفیف سایر محصولات (پرو):</span>
                  </div>
                  <span className="font-bold">- {formatToman(quote.otherDiscount)}</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <span>هزینه ارسال با پیک پروفارم:</span>
                  {quote && quote.shippingDiscount > 0 && (
                    <span className="text-xs text-amber-700 font-bold">(۲۰٪ تخفیف پرو)</span>
                  )}
                </span>
                <span className="font-bold text-farm-primary">{formatToman(quote?.shipping ?? 0)}</span>
              </div>

              {quote && quote.couponDiscount > 0 && (
                <div className="flex items-center justify-between text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200">
                  <div className="flex items-center gap-1.5">
                    <TicketPercent className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                    <span>کد تخفیف ({quote.couponCode}):</span>
                  </div>
                  <span className="font-bold">- {formatToman(quote.couponDiscount)}</span>
                </div>
              )}

              {savings > 0 && (
                <div className="flex items-center justify-between text-xs font-bold text-emerald-700 pt-1 border-t border-dashed border-gray-200">
                  <span>سود شما از این خرید:</span>
                  <span>{formatToman(savings)} سود</span>
                </div>
              )}
            </div>

            {/* Tier perks (prices come from the subscription settings) */}
            {userTier === 'PRO' ? (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                <div className="flex items-center gap-2 font-bold">
                  <Crown className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
                  <span>
                    عضویت پرو فعال{plans.PRO ? ` (${formatToman(plans.PRO.monthlyPrice)}/ماه)` : ''}
                  </span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  تحویل ۶ روز در هفته (شنبه تا پنج‌شنبه) و تخفیف‌های تخم‌مرغ، سایر کالاها و ارسال طبق طرح
                </p>
              </div>
            ) : userTier === 'PLUS' ? (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                <div className="flex items-center gap-2 font-bold">
                  <Zap className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                  <span>
                    عضویت پلاس فعال{plans.PLUS ? ` (${formatToman(plans.PLUS.monthlyPrice)}/ماه)` : ''}
                  </span>
                </div>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  تحویل ۶ روز در هفته (شنبه تا پنج‌شنبه) و تخفیف تخم‌مرغ تا سقف ماهانه طرح
                </p>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-farm-bg border border-farm-border text-xs text-gray-600 space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <Truck className="w-4 h-4 text-farm-primary shrink-0" aria-hidden="true" />
                  <span>کاربر عادی: تحویل فقط یکشنبه و چهارشنبه</span>
                </div>
                <div className="flex items-center justify-between text-xs text-farm-primary font-bold">
                  <span>تحویل ۶ روزه (شنبه تا پنج‌شنبه) و تخفیف‌ها:</span>
                  <Link href="/pro" className="underline hover:text-farm-primary-dark min-h-11 inline-flex items-center">
                    طرح‌های پلاس و پرو
                  </Link>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-farm-bg-warm flex items-baseline justify-between">
              <span className="text-sm font-bold text-gray-800">مبلغ نهایی قابل پرداخت:</span>
              <span className="text-xl font-black text-farm-primary" aria-live="polite">
                {quote ? formatToman(payable) : quoteLoading ? '...' : '—'}
              </span>
            </div>

            <Link
              href="/checkout"
              aria-disabled={quote ? !quote.ok : true}
              className="w-full min-h-11 py-4 px-6 rounded-2xl bg-farm-primary text-white text-sm font-bold shadow-md hover:bg-farm-primary-dark active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              <span>ثبت آدرس و زمان‌بندی تحویل</span>
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            </Link>

            {quote && !quote.ok && (
              <p className="text-xs text-rose-700 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>برای ادامه، موارد بالا را برطرف کنید.</span>
              </p>
            )}

            <div className="flex items-center justify-center gap-2 text-xs text-gray-600 pt-1">
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              <span>اتصال مستقیم به درگاه بانکی با پروتکل امن</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
