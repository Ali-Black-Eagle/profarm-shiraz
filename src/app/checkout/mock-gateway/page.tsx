'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ShieldAlert, ArrowLeft, Phone, CheckCircle2, XCircle } from 'lucide-react';
import { SITE_CONFIG } from '@/lib/site-config';
import { formatToman } from '@/lib/formatters';

/** Shown outside development, where the mock gateway does not exist. */
function UnavailableCard() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 bg-farm-bg">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-farm-border shadow-xl text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-700 shadow-xs">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold text-farm-primary bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 inline-block">
            سامانه پرداخت امن شاپرک
          </span>
          <h1 className="text-xl font-black text-gray-900">
            درگاه پرداخت آنلاین موقتاً در دسترس نیست
          </h1>
          <p className="text-sm text-gray-600 leading-relaxed">
            کلیه پرداخت‌های {SITE_CONFIG.brandName} منحصراً از طریق درگاه‌های رسمی بانکی انجام می‌شود. لطفاً به صفحه تسویه‌حساب بازگردید و مجدداً تلاش کنید یا با پشتیبانی تماس بگیرید.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-farm-bg border border-farm-border text-xs text-gray-700 text-right space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-farm-primary">
            <Phone className="w-4 h-4 text-farm-primary" />
            <span>پشتیبانی مستقیم مشتریان:</span>
          </div>
          <p className="text-sm font-mono font-bold text-gray-900" dir="ltr">
            <a href={`tel:${SITE_CONFIG.contact.supportPhoneTel}`} className="hover:underline">
              {SITE_CONFIG.contact.supportPhoneDisplay}
            </a>
          </p>
          <p className="text-xs text-gray-600">{SITE_CONFIG.contact.supportHours}</p>
        </div>

        <div className="pt-2">
          <Link
            href="/checkout"
            className="w-full py-3.5 px-4 rounded-2xl bg-farm-primary hover:bg-farm-primary-dark text-white text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2"
          >
            <span>بازگشت به صفحه تسویه‌حساب</span>
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function MockGatewayContent() {
  const searchParams = useSearchParams();

  // Build-time constant: this page only runs the mock flow in `next dev`.
  if (process.env.NODE_ENV !== 'development') {
    return <UnavailableCard />;
  }

  const orderNumber = searchParams.get('orderNumber')?.trim() || '';
  const authority = searchParams.get('Authority')?.trim() || '';
  const amount = Number(searchParams.get('amount'));

  if (!orderNumber || !authority) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4 bg-farm-bg">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-farm-border shadow-xl text-center space-y-4">
          <h1 className="text-lg font-black text-gray-900">اطلاعات پرداخت آزمایشی ناقص است</h1>
          <Link href="/checkout" className="text-sm font-bold text-farm-primary hover:underline">
            بازگشت به صفحه تسویه‌حساب
          </Link>
        </div>
      </div>
    );
  }

  const callbackQuery = (status: 'OK' | 'NOK') =>
    `/api/payment/verify?${new URLSearchParams({
      orderNumber,
      gateway: 'zarinpal',
      Authority: authority,
      Status: status,
    }).toString()}`;

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 bg-farm-bg">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-farm-border shadow-xl text-center space-y-6">
        <div className="space-y-2">
          <span className="text-xs font-bold text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 inline-block">
            درگاه آزمایشی (فقط محیط توسعه)
          </span>
          <h1 className="text-xl font-black text-gray-900">تایید پرداخت آزمایشی</h1>
        </div>

        <div className="p-4 rounded-2xl bg-farm-bg border border-farm-border text-sm text-gray-800 text-right space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-600">شماره سفارش</span>
            <span className="font-mono font-bold" dir="ltr">{orderNumber}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-600">مبلغ قابل پرداخت</span>
            <span className="font-bold">
              {formatToman(Number.isFinite(amount) && amount > 0 ? amount : 0)}
            </span>
          </div>
          <p className="text-xs text-gray-500 pt-1">
            مبلغ نهایی از سمت سرور و بر اساس سفارش ثبت‌شده تایید می‌شود.
          </p>
        </div>

        <div className="space-y-3">
          <a
            href={callbackQuery('OK')}
            className="w-full py-3.5 px-4 rounded-2xl bg-farm-primary hover:bg-farm-primary-dark text-white text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>پرداخت موفق</span>
          </a>
          <a
            href={callbackQuery('NOK')}
            className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-gray-50 text-red-700 border border-red-200 text-sm font-bold transition-all flex items-center justify-center gap-2"
          >
            <XCircle className="w-4 h-4" />
            <span>لغو پرداخت</span>
          </a>
        </div>
      </div>
    </div>
  );
}

export default function MockGatewayPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[80vh] flex items-center justify-center p-4 bg-farm-bg">
          <p className="text-sm text-gray-600">در حال بارگذاری...</p>
        </div>
      }
    >
      <MockGatewayContent />
    </Suspense>
  );
}
