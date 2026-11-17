'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft, Phone } from 'lucide-react';
import { SITE_CONFIG } from '@/lib/site-config';

export default function MockGatewayPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 bg-[#F9F8F5]">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-[#E6E1D5] shadow-xl text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-700 shadow-xs">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold text-[#2C4A2E] bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 inline-block">
            سامانه پرداخت امن شاپرک
          </span>
          <h1 className="text-xl font-black text-gray-900">
            درگاه پرداخت آنلاین موقتاً در دسترس نیست
          </h1>
          <p className="text-sm text-gray-600 leading-relaxed">
            کلیه پرداخت‌های {SITE_CONFIG.brandName} منحصراً از طریق درگاه‌های رسمی بانکی انجام می‌شود. لطفاً به صفحه تسویه‌حساب بازگردید و مجدداً تلاش کنید یا با پشتیبانی تماس بگیرید.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#F9F8F5] border border-[#E6E1D5] text-xs text-gray-700 text-right space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-[#2C4A2E]">
            <Phone className="w-4 h-4 text-[#2C4A2E]" />
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
            className="w-full py-3.5 px-4 rounded-2xl bg-[#2C4A2E] hover:bg-[#1E3520] text-white text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2"
          >
            <span>بازگشت به صفحه تسویه‌حساب</span>
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
