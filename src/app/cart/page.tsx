'use client';

import React from 'react';
import Link from 'next/link';
import { useCart, calculateCartDiscounts } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { formatToman, toPersianDigits } from '@/lib/formatters';
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
  Sparkles,
  Zap,
  Tag,
  TicketPercent,
} from 'lucide-react';
import { CouponInputBox } from '@/components/modules/CouponInputBox';
import { CouponValidationResult } from '@/types';

export default function CartPage() {
  const [mounted, setMounted] = React.useState(false);
  const {
    items,
    updateQuantity,
    removeItem,
    clearCart,
    getTotalPrice,
    getTotalItemsCount,
    isBulkOrder,
    setBulkOrder,
  } = useCart();

  const { user } = useAuth();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const totalCount = getTotalItemsCount();
  const userTier = user?.tier || (user?.isProMember ? 'PRO' : 'FREE');
  const discounts = calculateCartDiscounts(items, userTier);
  const [couponResult, setCouponResult] = React.useState<CouponValidationResult | null>(null);

  const couponDiscount = couponResult?.discountAmount || 0;
  const finalPayable = Math.max(0, discounts.finalPayable - couponDiscount);
  const totalSavings = discounts.totalDiscount + couponDiscount;

  const meetsBulkThreshold = totalCount >= 10 || discounts.itemsSubtotal >= 5000000;

  if (!mounted) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 min-h-[50vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#2C4A2E] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="w-24 h-24 rounded-full bg-[#F3EFE6] border border-[#E6E1D5] flex items-center justify-center mx-auto text-[#2C4A2E]">
          <ShoppingBag className="w-10 h-10 text-gray-400" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-[#2C4A2E]">سبد خرید شما خالی است</h1>
          <p className="text-xs sm:text-sm text-gray-500">
            هنوز محصول ارگانیکی به سبد خرید خود اضافه نکرده‌اید.
          </p>
        </div>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-[#2C4A2E] text-white text-sm font-bold shadow-md hover:bg-[#1E3520] transition-all"
        >
          <span>مشاهده محصولات ارگانیک شیراز</span>
          <ArrowLeft className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex items-center justify-between pb-4 border-b border-[#E6E1D5]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#2C4A2E]">سبد خرید شما</h1>
          <p className="text-xs text-gray-500 mt-1">
            شامل {toPersianDigits(totalCount)} بسته از فرآورده‌های طبیعی مزارع فارس
          </p>
        </div>

        <button
          onClick={clearCart}
          className="text-xs text-rose-600 hover:text-rose-800 font-medium flex items-center gap-1.5 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          <span>خالی کردن سبد</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Cart Items List */}
        <div className="lg:col-span-8 space-y-4">
          {items.map(({ product, quantity }) => (
            <div
              key={product.id}
              className="bg-white rounded-3xl p-4 sm:p-5 border border-[#E6E1D5] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <img
                  src={product.images[0]}
                  alt={product.title}
                  className="w-20 h-20 rounded-2xl object-cover border border-[#E6E1D5] shrink-0"
                />
                <div className="space-y-1">
                  <span className="text-[11px] text-[#D4A373] font-bold">
                    {product.packSize}
                  </span>
                  <Link href={`/products/${product.slug}`}>
                    <h3 className="text-sm sm:text-base font-bold text-[#2C4A2E] hover:underline line-clamp-1">
                      {product.title}
                    </h3>
                  </Link>
                  <div className="text-xs text-gray-500">
                    فی هر بسته: {formatToman(product.price)}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                {/* Quantity Controls */}
                <div className="flex items-center gap-2 bg-[#F9F8F5] border border-[#E6E1D5] rounded-xl p-1">
                  <button
                    onClick={() => updateQuantity(product.id, quantity + 1)}
                    disabled={quantity >= product.stock}
                    className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-[#2C4A2E] hover:bg-[#2C4A2E] hover:text-white transition-colors cursor-pointer disabled:opacity-30"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-6 text-center text-xs font-black text-[#2C4A2E]">
                    {toPersianDigits(quantity)}
                  </span>
                  <button
                    onClick={() => updateQuantity(product.id, quantity - 1)}
                    className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-[#2C4A2E] hover:bg-rose-600 hover:text-white transition-colors cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Total Line Item Price */}
                <div className="text-left">
                  <span className="block text-sm sm:text-base font-black text-[#2C4A2E]">
                    {formatToman(product.price * quantity)}
                  </span>
                </div>

                <button
                  onClick={() => removeItem(product.id)}
                  className="text-gray-400 hover:text-rose-600 p-1 transition-colors"
                  title="حذف"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {/* Wholesale Mode Toggle Card */}
          <div className="bg-[#F3EFE6] rounded-3xl p-5 border border-[#E6E1D5] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Package className="w-5 h-5 text-[#2C4A2E]" />
                <span className="text-sm font-bold text-[#2C4A2E]">
                  آیا این سفارش برای خارج از شهر شیراز یا به صورت عمده است؟
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBulkOrder}
                  onChange={(e) => setBulkOrder(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2C4A2E]"></div>
              </label>
            </div>

            {isBulkOrder && (
              <div className="pt-2 text-xs text-gray-700 space-y-2 border-t border-[#E6E1D5]">
                <p>
                  برای ارسال به شهرستان‌های خارج از شیراز، سفارش باید حداقل شامل ۱۰ بسته یا ۵ میلیون
                  تومان باشد.
                </p>
                <div
                  className={`p-2.5 rounded-xl font-medium ${
                    meetsBulkThreshold
                      ? 'bg-emerald-100 text-emerald-900'
                      : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  {meetsBulkThreshold
                    ? '✓ سبد خرید شما شرایط سفارش عمده و خروج از شیراز را داراست.'
                    : `⚠️ سبد شما هنوز به سقف خرید عمده نرسیده است (${toPersianDigits(totalCount)} از ۱۰ بسته).`}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Order Summary Column */}
        <div className="lg:col-span-4 space-y-5">
          {/* Coupon Input Box */}
          <CouponInputBox
            cartItems={items}
            itemsSubtotal={discounts.itemsSubtotal}
            shippingFee={discounts.finalShipping}
            onCouponChange={(res) => setCouponResult(res)}
          />

          <div className="bg-white rounded-3xl p-6 border border-[#E6E1D5] shadow-farm space-y-5 sticky top-28">
            <h3 className="text-base font-bold text-[#2C4A2E] pb-3 border-b border-[#F3EFE6]">
              خلاصه فاکتور سفارش
            </h3>

            <div className="space-y-3 text-xs text-gray-600">
              <div className="flex items-center justify-between">
                <span>تعداد کل بسته‌ها:</span>
                <span className="font-bold text-[#2C4A2E]">
                  {toPersianDigits(totalCount)} بسته
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span>مجموع ارزش کالاها:</span>
                <span className="font-bold text-[#2C4A2E]">{formatToman(discounts.itemsSubtotal)}</span>
              </div>

              {/* Egg Quota Discount */}
              {discounts.eggDiscount > 0 && (
                <div className="flex items-center justify-between text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200">
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-emerald-600" />
                    <span>
                      تخفیف تخم‌مرغ ({userTier === 'PRO' ? '۱۰٪ پرو' : '۵٪ پلاس'} - تا {toPersianDigits(discounts.eggQuota)} عدد):
                    </span>
                  </div>
                  <span className="font-bold">- {formatToman(discounts.eggDiscount)}</span>
                </div>
              )}

              {/* Other Products Discount (Pro Only) */}
              {discounts.otherDiscount > 0 && (
                <div className="flex items-center justify-between text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200">
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-emerald-600" />
                    <span>تخفیف ۵٪ سایر محصولات (پرو):</span>
                  </div>
                  <span className="font-bold">- {formatToman(discounts.otherDiscount)}</span>
                </div>
              )}

              {/* Shipping Fee */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <span>هزینه ارسال با پیک پروفارم:</span>
                  {discounts.shippingDiscount > 0 && (
                    <span className="text-[10px] text-amber-600 font-bold">(۲۰٪ تخفیف پرو)</span>
                  )}
                </span>
                <span className="font-bold text-[#2C4A2E]">
                  {formatToman(discounts.finalShipping)}
                </span>
              </div>

              {/* Coupon Discount */}
              {couponDiscount > 0 && (
                <div className="flex items-center justify-between text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200">
                  <div className="flex items-center gap-1.5">
                    <TicketPercent className="w-3.5 h-3.5 text-emerald-600" />
                    <span>کد تخفیف ({couponResult?.coupon?.code}):</span>
                  </div>
                  <span className="font-bold">- {formatToman(couponDiscount)}</span>
                </div>
              )}

              {/* Total Discount Saved */}
              {totalSavings > 0 && (
                <div className="flex items-center justify-between text-xs font-bold text-emerald-700 pt-1 border-t border-dashed border-gray-200">
                  <span>سود شما از این خرید:</span>
                  <span>{formatToman(totalSavings)} سود</span>
                </div>
              )}
            </div>

            {/* Tier Perks Notice in Summary */}
            {userTier === 'PRO' ? (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                <div className="flex items-center gap-2 font-bold">
                  <Crown className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>عضویت پرو فعال (۳۲۹,۰۰۰ تومان/ماه)</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  تحویل ۶ روز در هفته (شنبه تا ۵‌شنبه) + ۱۰٪ تخفیف تخم‌مرغ تا ۶۰۰ عدد + ۵٪ بقیه کالاها + ۲۰٪ تخفیف ارسال
                </p>
              </div>
            ) : userTier === 'PLUS' ? (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                <div className="flex items-center gap-2 font-bold">
                  <Zap className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>عضویت پلاس فعال (۱۴۹,۰۰۰ تومان/ماه)</span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  تحویل ۶ روز در هفته (شنبه تا ۵‌شنبه) + ۵٪ تخفیف خرید تخم‌مرغ تا سقف ۲۰۰ عدد در ماه
                </p>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-[#F9F8F5] border border-[#E6E1D5] text-xs text-gray-600 space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <Truck className="w-4 h-4 text-[#2C4A2E] shrink-0" />
                  <span>کاربر عادی: تحویل فقط ۱شنبه و ۴شنبه</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#2C4A2E] font-bold">
                  <span>ارسال ۶ روزه + تخفیف تخم‌مرغ و ارسال:</span>
                  <Link href="/pro" className="underline hover:text-[#1E3520]">
                    طرح‌های پلاس و پرو
                  </Link>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-[#F3EFE6] flex items-baseline justify-between">
              <span className="text-sm font-bold text-gray-800">مبلغ نهایی قابل پرداخت:</span>
              <span className="text-xl font-black text-[#2C4A2E]">
                {formatToman(finalPayable)}
              </span>
            </div>

            <Link
              href="/checkout"
              className="w-full py-4 px-6 rounded-2xl bg-[#2C4A2E] text-white text-sm font-bold shadow-md hover:bg-[#1E3520] active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              <span>ثبت آدرس و زمان‌بندی تحویل</span>
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div className="flex items-center justify-center gap-2 text-[11px] text-gray-400 pt-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>اتصال مستقیم به درگاه بانکی شاپرک با پروتکل امن</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
