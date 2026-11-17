'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { farmStore } from '@/lib/db-store';
import { Order } from '@/types';
import { formatToman, toPersianDigits } from '@/lib/formatters';
import {
  CheckCircle2,
  Package,
  Truck,
  MapPin,
  Calendar,
  CreditCard,
  Printer,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  Phone,
  FileText,
  Crown,
  Sparkles,
  Zap,
} from 'lucide-react';

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get('orderNumber') || '';
  const refId = searchParams.get('refId') || 'تراکنش موفق';
  const gateway = searchParams.get('gateway') || 'zarinpal';

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderNumber) {
      const found = farmStore.getOrderById(orderNumber);
      if (found) {
        setOrder(found);
      }
    }
    setLoading(false);
  }, [orderNumber]);

  const gatewayName =
    gateway === 'snapppay' ? 'پرداخت اقساطی اسنپ‌پی' : 'درگاه پرداخت شاپرک زرین‌پال';

  const isSubscription = Boolean(order?.isSubscription);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      {/* Top Success Banner */}
      <div className="bg-white rounded-3xl p-8 sm:p-10 border border-[#E6E1D5] shadow-farm text-center space-y-4 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-emerald-50 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-[#D4A373]/10 rounded-full blur-2xl pointer-events-none" />

        <div className="w-20 h-20 rounded-3xl bg-emerald-100/80 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto shadow-inner animate-in zoom-in-50 duration-500">
          {isSubscription ? (
            <Crown className="w-10 h-10 text-[#D4AF37]" />
          ) : (
            <CheckCircle2 className="w-10 h-10" />
          )}
        </div>

        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5" />
            {isSubscription ? 'اشتراک شما با موفقیت فعال شد' : 'تراکنش مالی و سفارش تایید شد'}
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-[#2C4A2E]">
            {isSubscription
              ? `خوش آمدید به باشگاه مشترکین ویژه پروفارم!`
              : 'از خرید شما از مزارع ارگانیک شیراز سپاسگزاریم!'}
          </h1>
          <p className="text-sm text-gray-600 max-w-lg mx-auto leading-relaxed">
            {isSubscription
              ? `عضویت ۳۰ روزه شما با موفقیت فعال گردید. از هم‌اکنون در تمامی خریدهای خود امکان انتخاب بازه ارسال ۶ روز در هفته و تخفیف‌های ویژه ارگانیک را خواهید داشت.`
              : 'سفارش شما با موفقیت ثبت گردید و جهت چینش و آماده‌سازی به واحد انبار مرکزی پروفارم در شیراز ارسال شد.'}
          </p>
        </div>

        {/* Tracking & Ref badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-[#F3EFE6] max-w-2xl mx-auto text-xs">
          <div className="bg-[#F9F8F5] p-3 rounded-2xl border border-[#E6E1D5]">
            <span className="text-gray-500 block mb-1">شماره فاکتور:</span>
            <span className="font-black text-[#2C4A2E] text-sm">
              {toPersianDigits(orderNumber || 'PRF-1405')}
            </span>
          </div>
          <div className="bg-[#F9F8F5] p-3 rounded-2xl border border-[#E6E1D5]">
            <span className="text-gray-500 block mb-1">کد پیگیری بانکی:</span>
            <span className="font-bold text-gray-800 text-xs break-all">
              {refId}
            </span>
          </div>
          <div className="bg-[#F9F8F5] p-3 rounded-2xl border border-[#E6E1D5]">
            <span className="text-gray-500 block mb-1">روش پرداخت:</span>
            <span className="font-bold text-[#2C4A2E] text-xs">
              {gatewayName}
            </span>
          </div>
        </div>
      </div>

      {/* Delivery & Order Details */}
      {order && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Subscription or Delivery Details Card */}
          {isSubscription ? (
            <div className="bg-white rounded-3xl p-6 border border-[#E6E1D5] shadow-farm space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[#F3EFE6] text-[#2C4A2E] font-bold">
                <Crown className="w-5 h-5 text-[#D4AF37]" />
                <h3>مشخصات عضویت مشترک</h3>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                  <div>
                    <span className="text-gray-500 inline-block ml-1">طرح فعال:</span>
                    <span className="text-gray-900 font-bold">
                      {order.subscriptionPlan === 'PLUS'
                        ? 'اشتراک نقره‌ای پروفارم پلاس'
                        : 'اشتراک طلایی پروفارم پرو'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                  <div>
                    <span className="text-gray-500 inline-block ml-1">مدت اعتبار:</span>
                    <span className="text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg">
                      ۳۰ روز دسترسی کامل
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Truck className="w-4 h-4 text-gray-400 shrink-0" />
                  <div>
                    <span className="text-gray-500 inline-block ml-1">امکان ارسال سفارشات:</span>
                    <span className="text-gray-800 font-semibold">
                      ۶ روز در هفته (شنبه تا پنج‌شنبه در شیراز)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                  <div>
                    <span className="text-gray-500 inline-block ml-1">تخفیف تخم‌مرغ محلی:</span>
                    <span className="text-emerald-800 font-bold">
                      {order.subscriptionPlan === 'PLUS' ? '۵٪ تخفیف (تا ۲۰۰ عدد)' : '۱۰٪ تخفیف (تا ۶۰۰ عدد)'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Truck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="text-gray-500 inline-block ml-1">تخفیف هزینه پیک:</span>
                    <span className="text-gray-800 font-semibold">
                      {order.subscriptionPlan === 'PRO' ? '۲۰٪ تخفیف دائمی' : 'ندارد (تعرفه عادی پیک)'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                  <div>
                    <span className="text-gray-500 inline-block ml-1">مشترک:</span>
                    <span className="text-gray-800 font-semibold">
                      {order.address?.recipientName} ({toPersianDigits(order.address?.phone || '')})
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-6 border border-[#E6E1D5] shadow-farm space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[#F3EFE6] text-[#2C4A2E] font-bold">
                <Truck className="w-5 h-5 text-[#D4AF37]" />
                <h3>اطلاعات ارسال با پیک پروفارم</h3>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-gray-500 block">نشانی تحویل:</span>
                    <span className="text-gray-800 font-semibold leading-relaxed">
                      {order.address?.province || 'فارس'}، {order.address?.city || 'شیراز'}، {order.address?.streetAddress} {order.address?.unit ? `(${order.address.unit})` : ''}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                  <div>
                    <span className="text-gray-500 inline-block ml-1">تحویل‌گیرنده:</span>
                    <span className="text-gray-800 font-semibold">
                      {order.address?.recipientName} ({toPersianDigits(order.address?.phone || '')})
                    </span>
                  </div>
                </div>

                {order.deliverySlot && (
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                    <div>
                      <span className="text-gray-500 inline-block ml-1">بازه تحویل:</span>
                      <span className="text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg">
                        {(order.deliverySlot as any).dayName || order.deliverySlot.dayOfWeek} {toPersianDigits((order.deliverySlot as any).dateJalali || order.deliverySlot.date)} ({order.deliverySlot.timeWindow})
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Items & Payment Card */}
          <div className="bg-white rounded-3xl p-6 border border-[#E6E1D5] shadow-farm space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-[#F3EFE6] text-[#2C4A2E] font-bold">
              <Package className="w-5 h-5 text-[#D4AF37]" />
              <h3>اقلام فاکتور ({toPersianDigits(order.items?.length || 0)} مورد)</h3>
            </div>

            <div className="divide-y divide-[#F3EFE6] max-h-48 overflow-y-auto pr-1 space-y-2 text-xs">
              {order.items?.map((item, idx) => (
                <div key={idx} className="pt-2 first:pt-0 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="font-bold text-gray-800">{item.product?.title || 'محصول ارگانیک'}</p>
                    <p className="text-gray-500 text-[11px]">
                      {toPersianDigits(item.quantity)} عدد × {formatToman(item.unitPrice)}
                    </p>
                  </div>
                  <span className="font-bold text-[#2C4A2E]">
                    {formatToman(item.totalPrice)}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-[#F3EFE6] flex items-center justify-between text-sm font-black text-[#2C4A2E]">
              <span>مبلغ نهایی پرداخت‌شده:</span>
              <span>{formatToman(order.totalAmount)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
        <Link
          href="/account?tab=orders"
          className="w-full sm:w-auto px-6 py-3.5 bg-[#2C4A2E] text-white font-bold text-sm rounded-2xl hover:bg-[#223924] transition-all flex items-center justify-center gap-2 shadow-sm"
        >
          <FileText className="w-4 h-4" />
          مشاهده در حساب کاربری
        </Link>

        <button
          onClick={() => window.print()}
          className="w-full sm:w-auto px-6 py-3.5 bg-white border border-[#E6E1D5] text-[#2C4A2E] font-bold text-sm rounded-2xl hover:bg-[#F9F8F5] transition-all flex items-center justify-center gap-2 shadow-xs"
        >
          <Printer className="w-4 h-4" />
          چاپ فاکتور سفارش
        </button>

        <Link
          href="/products"
          className="w-full sm:w-auto px-6 py-3.5 bg-[#F9F8F5] border border-[#E6E1D5] text-gray-700 font-bold text-sm rounded-2xl hover:bg-[#EAE5D9] transition-all flex items-center justify-center gap-2"
        >
          <ShoppingBag className="w-4 h-4" />
          خرید محصولات ارگانیک
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto px-4 py-16 text-center text-gray-500">
          در حال بارگذاری اطلاعات سفارش...
        </div>
      }
    >
      <CheckoutSuccessContent />
    </Suspense>
  );
}
