import React from 'react';
import Link from 'next/link';
import { Home, ShoppingBag, ArrowRight, Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center space-y-6 bg-white p-8 sm:p-10 rounded-3xl border border-[#E6E1D5] shadow-farm relative overflow-hidden">
        {/* Background accent */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#2C4A2E]/5 rounded-full blur-xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-[#D4A373]/10 rounded-full blur-xl pointer-events-none" />

        {/* 404 graphic icon */}
        <div className="w-20 h-20 rounded-3xl bg-[#F3EFE6] border border-[#E6E1D5] text-[#2C4A2E] flex items-center justify-center mx-auto shadow-inner">
          <Compass className="w-10 h-10 animate-spin-slow" />
        </div>

        <div className="space-y-2">
          <span className="text-4xl sm:text-5xl font-black text-[#2C4A2E] tracking-tight">
            ۴۰۴
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-gray-800">
            صفحه مورد نظر در مزرعه یافت نشد!
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 leading-relaxed max-w-sm mx-auto">
            احتمالاً این صفحه جابه‌جا شده یا آدرس وارد شده نادرست است. می‌توانید از بخش‌های زیر مسیر خود را پیدا کنید:
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="w-full sm:w-auto px-5 py-3 bg-[#2C4A2E] text-white font-bold text-xs rounded-2xl hover:bg-[#223924] transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <Home className="w-4 h-4" />
            صفحه اصلی
          </Link>
          <Link
            href="/products"
            className="w-full sm:w-auto px-5 py-3 bg-[#F9F8F5] border border-[#E6E1D5] text-gray-700 font-bold text-xs rounded-2xl hover:bg-[#EAE5D9] transition-all flex items-center justify-center gap-2"
          >
            <ShoppingBag className="w-4 h-4" />
            کاتالوگ محصولات
          </Link>
        </div>
      </div>
    </div>
  );
}
