'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log client error
    console.error('App Error Boundary caught:', error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center space-y-6 bg-white p-8 sm:p-10 rounded-3xl border border-rose-100 shadow-farm relative overflow-hidden">
        {/* Error icon */}
        <div className="w-16 h-16 rounded-3xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-black text-gray-800">
            خطایی در بارگذاری رخ داده است!
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 leading-relaxed max-w-sm mx-auto">
            متأسفانه هنگام پردازش درخواست مشکلی پیش آمد. نگران نباشید، داده‌های شما محفوظ است.
          </p>
          {error.digest && (
            <p className="text-xs text-gray-600 font-mono">
              شناسه خطا: {error.digest}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto px-5 py-3 bg-farm-primary text-white font-bold text-xs rounded-2xl hover:bg-farm-primary-dark transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            تلاش مجدد
          </button>
          <Link
            href="/"
            className="w-full sm:w-auto px-5 py-3 bg-farm-bg border border-farm-border text-gray-700 font-bold text-xs rounded-2xl hover:bg-[#EAE5D9] transition-all flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            صفحه اصلی
          </Link>
        </div>
      </div>
    </div>
  );
}
