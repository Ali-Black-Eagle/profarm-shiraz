'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { farmStore } from '@/lib/db-store';
import { useCart } from '@/hooks/useCart';
import { Order } from '@/types';
import { formatToman, toPersianDigits } from '@/lib/formatters';
import { getOrderStatusMeta } from '@/lib/site-config';
import {
  CheckCircle2,
  Package,
  Truck,
  MapPin,
  Calendar,
  Printer,
  ShoppingBag,
  ShieldCheck,
  Phone,
  FileText,
  Crown,
  Sparkles,
  AlertTriangle,
  Clock,
} from 'lucide-react';

const PAID_STATUSES = new Set(['PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED']);

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get('orderNumber')?.trim() || '';
  const refIdParam = searchParams.get('refId')?.trim() || '';
  const gateway = searchParams.get('gateway') || 'zarinpal';

  const { clearCart } = useCart();
  const hasClearedCartRef = useRef(false);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorReason, setErrorReason] = useState<'MISSING' | 'UNAUTH' | 'NOT_FOUND' | 'NETWORK' | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function verifyOrderFromServer() {
      if (!orderNumber) {
        setErrorReason('MISSING');
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/orders?orderNumber=${encodeURIComponent(orderNumber)}`, {
          cache: 'no-store',
        });

        if (cancelled) return;

        if (res.status === 401) {
          setErrorReason('UNAUTH');
          setLoading(false);
          return;
        }

        if (!res.ok) {
          setErrorReason('NOT_FOUND');
          setLoading(false);
          return;
        }

        const data = await res.json();
        const serverOrder: Order | null = data?.order || null;

        if (!serverOrder || serverOrder.orderNumber !== orderNumber) {
          setErrorReason('NOT_FOUND');
          setLoading(false);
          return;
        }

        setOrder(serverOrder);
        try {
          farmStore.syncOrderFromApi(serverOrder);
        } catch {
          // ignore local cache sync failures
        }

        // Clear cart ONLY when the server verifies the matching order is genuinely paid/confirmed
        const isConfirmedPaid =
          PAID_STATUSES.has(serverOrder.status) || serverOrder.payment?.status === 'SUCCESS';

        if (isConfirmedPaid && !hasClearedCartRef.current) {
          hasClearedCartRef.current = true;
          if (!serverOrder.isSubscription) {
            clearCart();
          }
          try {
            sessionStorage.removeItem('profarm_checkout_draft');
          } catch {
            // ignore storage errors
          }
        }
      } catch {
        if (!cancelled) {
          setErrorReason('NETWORK');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    verifyOrderFromServer();
    return () => {
      cancelled = true;
    };
  }, [orderNumber, clearCart]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white rounded-3xl p-10 border border-[#E6E1D5] shadow-farm text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-3 border-[#2C4A2E] border-t-transparent animate-spin mx-auto" />
          <p className="text-sm font-bold text-[#2C4A2E]">در حال استعلام و تایید نهایی سفارش از سرور...</p>
        </div>
      </div>
    );
  }

  // Genuine Not Found / Missing / Unauthorized State (never show fake success!)
  if (!order || errorReason) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-[#E6E1D5] shadow-farm text-center space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-black text-gray-900">
              {errorReason === 'UNAUTH'
                ? 'برای مشاهده رسید سفارش وارد حساب خود شوید'
                : errorReason === 'NETWORK'
                ? 'خطا در استعلام وضعیت سفارش'
                : 'سفارش معتبری یافت نشد'}
            </h1>
            <p className="text-sm text-gray-600 leading-relaxed max-w-md mx-auto">
              {errorReason === 'UNAUTH'
                ? 'برای حفظ امنیت اطلاعات، مشاهده رسید پرداخت تنها با حساب کاربری ثبت‌کننده سفارش امکان‌پذیر است.'
                : errorReason === 'NETWORK'
                ? 'امکان برقراری ارتباط با سرور برای تایید وضعیت پرداخت وجود نداشت. لطفاً صفحه را مجدداً بارگذاری کنید یا از حساب کاربری پیگیری نمایید.'
                : 'شماره سفارش معتبری در سیستم یافت نشد یا پرداخت آن هنوز نهایی نشده است. سبد خرید شما دست‌نخورده باقی مانده است.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            {errorReason === 'UNAUTH' ? (
              <Link
                href={`/login?redirect=${encodeURIComponent(
                  `/checkout/success?orderNumber=${encodeURIComponent(orderNumber)}`
                )}`}
                className="w-full sm:w-auto px-6 py-3.5 bg-[#2C4A2E] text-white font-bold text-sm rounded-2xl hover:bg-[#1E3520] transition-all"
              >
                ورود به حساب کاربری
              </Link>
            ) : (
              <Link
                href="/account?tab=orders"
                className="w-full sm:w-auto px-6 py-3.5 bg-[#2C4A2E] text-white font-bold text-sm rounded-2xl hover:bg-[#1E3520] transition-all flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                <span>پیگیری سفارش‌ها در حساب کاربری</span>
              </Link>
            )}

            <Link
              href="/checkout"
              className="w-full sm:w-auto px-6 py-3.5 bg-[#F9F8F5] border border-[#E6E1D5] text-gray-800 font-bold text-sm rounded-2xl hover:bg-[#EAE5D9] transition-all"
            >
              بازگشت به تسویه‌حساب
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isPaidConfirmed = PAID_STATUSES.has(order.status) || order.payment?.status === 'SUCCESS';
  const statusMeta = getOrderStatusMeta(order.status);
  const gatewayName =
    gateway === 'snapppay' || order.payment?.gateway === 'SNAPPPAY'
      ? 'پرداخت اقساطی اسنپ‌پی'
      : 'درگاه پرداخت شاپرک زرین‌پال';
  const displayRefId = order.payment?.refId || refIdParam || 'ثبت در سیستم بانکی';
  const isSubscription = Boolean(order.isSubscription);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      {/* Top Status Banner */}
      <div className="bg-white rounded-3xl p-8 sm:p-10 border border-[#E6E1D5] shadow-farm text-center space-y-4 relative overflow-hidden">
        <div className="w-20 h-20 rounded-3xl bg-emerald-100/80 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto shadow-inner">
          {!isPaidConfirmed ? (
            <Clock className="w-10 h-10 text-amber-700" />
          ) : isSubscription ? (
            <Crown className="w-10 h-10 text-[#8A6218]" />
          ) : (
            <CheckCircle2 className="w-10 h-10" />
          )}
        </div>

        <div className="space-y-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
              isPaidConfirmed
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : statusMeta.badgeClass
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {!isPaidConfirmed
              ? `وضعیت فعلی سفارش: ${statusMeta.label}`
              : isSubscription
              ? 'اشتراک شما با موفقیت فعال شد'
              : 'تراکنش مالی و سفارش تایید شد'}
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-[#2C4A2E]">
            {!isPaidConfirmed
              ? 'سفارش ثبت شده اما پرداخت هنوز تایید نشده است'
              : isSubscription
              ? 'خوش آمدید به باشگاه مشترکین ویژه پروفارم!'
              : 'از خرید شما از مزارع ارگانیک شیراز سپاسگزاریم!'}
          </h1>
          <p className="text-sm text-gray-600 max-w-lg mx-auto leading-relaxed">
            {!isPaidConfirmed
              ? 'در صورت کسر وجه از حساب شما، نتیجه ظرف چند دقیقه بروزرسانی می‌شود. می‌توانید وضعیت را در حساب کاربری پیگیری کنید.'
              : isSubscription
              ? 'عضویت ۳۰ روزه شما با موفقیت فعال گردید. از هم‌اکنون در تمامی خریدهای خود امکان انتخاب بازه ارسال ۶ روز در هفته و تخفیف‌های ویژه ارگانیک را خواهید داشت.'
              : 'سفارش شما با موفقیت تایید گردید و جهت چینش و آماده‌سازی به واحد انبار مرکزی پروفارم در شیراز ارسال شد.'}
          </p>
        </div>

        {/* Tracking & Ref badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-[#F3EFE6] max-w-2xl mx-auto text-xs">
          <div className="bg-[#F9F8F5] p-3 rounded-2xl border border-[#E6E1D5]">
            <span className="text-gray-600 block mb-1">شماره فاکتور:</span>
            <span className="font-black text-[#2C4A2E] text-sm font-mono">
              {toPersianDigits(order.orderNumber)}
            </span>
          </div>
          <div className="bg-[#F9F8F5] p-3 rounded-2xl border border-[#E6E1D5]">
            <span className="text-gray-600 block mb-1">کد پیگیری بانکی:</span>
            <span className="font-bold text-gray-800 text-xs break-all font-mono">
              {displayRefId}
            </span>
          </div>
          <div className="bg-[#F9F8F5] p-3 rounded-2xl border border-[#E6E1D5]">
            <span className="text-gray-600 block mb-1">روش پرداخت:</span>
            <span className="font-bold text-[#2C4A2E] text-xs">{gatewayName}</span>
          </div>
        </div>
      </div>

      {/* Delivery & Order Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isSubscription ? (
          <div className="bg-white rounded-3xl p-6 border border-[#E6E1D5] shadow-farm space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-[#F3EFE6] text-[#2C4A2E] font-bold">
              <Crown className="w-5 h-5 text-[#8A6218]" />
              <h3>مشخصات عضویت مشترک</h3>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <span className="text-gray-600 inline-block ml-1">طرح فعال:</span>
                  <span className="text-gray-900 font-bold">
                    {order.subscriptionPlan === 'PLUS'
                      ? 'اشتراک نقره‌ای پروفارم پلاس'
                      : 'اشتراک طلایی پروفارم پرو'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-gray-500 shrink-0" />
                <div>
                  <span className="text-gray-600 inline-block ml-1">مدت اعتبار:</span>
                  <span className="text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg">
                    ۳۰ روز دسترسی کامل
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-gray-500 shrink-0" />
                <div>
                  <span className="text-gray-600 inline-block ml-1">مشترک:</span>
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
              <Truck className="w-5 h-5 text-[#8A6218]" />
              <h3>اطلاعات ارسال سفارش</h3>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                <div>
                  <span className="text-gray-600 block">نشانی تحویل:</span>
                  <span className="text-gray-800 font-semibold leading-relaxed">
                    {order.address?.province || 'فارس'}، {order.address?.city || 'شیراز'}،{' '}
                    {order.address?.streetAddress}{' '}
                    {order.address?.unit ? `(${order.address.unit})` : ''}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-gray-500 shrink-0" />
                <div>
                  <span className="text-gray-600 inline-block ml-1">تحویل‌گیرنده:</span>
                  <span className="text-gray-800 font-semibold">
                    {order.address?.recipientName} ({toPersianDigits(order.address?.phone || '')})
                  </span>
                </div>
              </div>

              {order.deliverySlot && (
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-gray-500 shrink-0" />
                  <div>
                    <span className="text-gray-600 inline-block ml-1">بازه تحویل:</span>
                    <span className="text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg">
                      {(order.deliverySlot as any).dayName || order.deliverySlot.dayOfWeek}{' '}
                      {toPersianDigits((order.deliverySlot as any).dateJalali || order.deliverySlot.date)} (
                      {order.deliverySlot.timeWindow})
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
            <Package className="w-5 h-5 text-[#8A6218]" />
            <h3>اقلام فاکتور ({toPersianDigits(order.items?.length || 0)} مورد)</h3>
          </div>

          <div className="divide-y divide-[#F3EFE6] max-h-48 overflow-y-auto pr-1 space-y-2 text-xs">
            {order.items?.map((item, idx) => (
              <div key={idx} className="pt-2 first:pt-0 flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="font-bold text-gray-800">{item.product?.title || 'محصول ارگانیک'}</p>
                  <p className="text-gray-600 text-xs">
                    {toPersianDigits(item.quantity)} بسته × {formatToman(item.unitPrice)}
                  </p>
                </div>
                <span className="font-bold text-[#2C4A2E]">{formatToman(item.totalPrice)}</span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-[#F3EFE6] flex items-center justify-between text-sm font-black text-[#2C4A2E]">
            <span>مبلغ نهایی سفارش:</span>
            <span>{formatToman(order.totalAmount)}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 no-print">
        <Link
          href="/account?tab=orders"
          className="w-full sm:w-auto px-6 py-3.5 bg-[#2C4A2E] text-white font-bold text-sm rounded-2xl hover:bg-[#1E3520] transition-all flex items-center justify-center gap-2 shadow-sm"
        >
          <FileText className="w-4 h-4" />
          <span>مشاهده در حساب کاربری</span>
        </Link>

        <button
          type="button"
          onClick={() => window.print()}
          className="w-full sm:w-auto px-6 py-3.5 bg-white border border-[#E6E1D5] text-[#2C4A2E] font-bold text-sm rounded-2xl hover:bg-[#F9F8F5] transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>چاپ فاکتور سفارش</span>
        </button>

        <Link
          href="/products"
          className="w-full sm:w-auto px-6 py-3.5 bg-[#F9F8F5] border border-[#E6E1D5] text-gray-700 font-bold text-sm rounded-2xl hover:bg-[#EAE5D9] transition-all flex items-center justify-center gap-2"
        >
          <ShoppingBag className="w-4 h-4" />
          <span>خرید محصولات ارگانیک</span>
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto px-4 py-16 text-center text-gray-600">
          در حال بارگذاری اطلاعات سفارش...
        </div>
      }
    >
      <CheckoutSuccessContent />
    </Suspense>
  );
}
