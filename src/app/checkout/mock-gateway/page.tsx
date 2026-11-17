'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft, Lock } from 'lucide-react';

export default function MockGatewayPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 bg-[#F8F7F4]">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-rose-200 shadow-xl text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-600 shadow-xs">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-3 py-1 rounded-full border border-rose-200 inline-block">
            سامانه پرداخت رسمی و پایدار شاپرک
          </span>
          <h1 className="text-xl font-black text-gray-900">
            درگاه آزمایشی غیرفعال است
          </h1>
          <p className="text-xs text-gray-600 leading-relaxed">
            جهت حفظ امنیت تراکنش‌ها و رعایت استانداردهای شاپرک، کلیه پرداخت‌های پروفارم منحصراً از طریق درگاه‌های رسمی و دارای مجوز (زرین‌پال و اسنپ‌پی) انجام می‌پذیرند.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 text-xs text-gray-600 text-right space-y-2">
          <div className="flex items-center gap-2 font-bold text-gray-800">
            <Lock className="w-4 h-4 text-emerald-700" />
            <span>نحوه اتصال به درگاه واقعی روی سرور:</span>
          </div>
          <p className="text-[11px] leading-relaxed text-gray-500">
            برای فعال‌سازی درگاه زرین‌پال، شناسه مرچنت اختصاصی خود را در فایل متغیرهای محیطی (<code className="font-mono text-emerald-800">.env</code>) تحت عنوان <code className="font-mono text-emerald-800">ZARINPAL_MERCHANT_ID</code> قرار دهید.
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/checkout"
            className="w-full py-3.5 px-4 rounded-2xl bg-[#2C4A2E] hover:bg-[#1E3520] text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
          >
            <span>بازگشت به صفحه تسویه‌حساب</span>
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
