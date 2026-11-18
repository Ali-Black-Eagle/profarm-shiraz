'use client';

import React from 'react';
import Link from 'next/link';
import { MapPin, Package, ArrowLeft, ShieldAlert, ShoppingCart } from 'lucide-react';
import {
  toPersianDigits,
  formatToman,
  isShirazAddress,
  BULK_MIN_ITEMS,
  BULK_MIN_SUBTOTAL,
} from '@/lib/formatters';

interface ShirazGuardAlertProps {
  city: string;
  /** Province from the address form. Empty means Fars, as on the server. */
  province?: string;
  isBulkOrder: boolean;
  totalItemsCount: number;
  totalPrice: number;
}

export const ShirazGuardAlert: React.FC<ShirazGuardAlertProps> = ({
  city,
  province = '',
  isBulkOrder,
  totalItemsCount,
  totalPrice,
}) => {
  // Same rule as the server quote (pricing.ts): the city is Shiraz AND the province is Fars (or not given).
  // An empty city is left to the form validation and is not judged here.
  const isShiraz = !city.trim() || isShirazAddress(city, province);

  // If inside Shiraz, everything is regular and fine
  if (isShiraz) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
        <MapPin className="w-5 h-5 text-emerald-700 shrink-0" />
        <div>
          <strong className="block text-emerald-950 font-bold">
            نشانی در محدوده ارسال اختصاصی شیراز است
          </strong>
          <span>
            سفارش شما با پیک پروفارم مستقیماً درب منزل تحویل داده می‌شود.
          </span>
        </div>
      </div>
    );
  }

  // Outside Shiraz: the cart must meet the bulk rule (the same rule the server applies)
  const meetsBulkCriteria = totalItemsCount >= BULK_MIN_ITEMS || totalPrice >= BULK_MIN_SUBTOTAL;

  if (isBulkOrder && meetsBulkCriteria) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-300 text-xs text-amber-900">
        <Package className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <strong className="block text-amber-950 font-bold">
            سفارش عمده خارج از شیراز (شهر {city})
          </strong>
          <span>
            سفارش شما با {toPersianDigits(totalItemsCount)} بسته واجد شرایط ارسال عمده به سراسر کشور
            است و از طریق باربری تخصصی ارسال خواهد شد.
          </span>
        </div>
      </div>
    );
  }

  // Outside Shiraz and NOT meeting the bulk rule: checkout is blocked
  return (
    <div className="p-5 rounded-3xl bg-rose-50 border-2 border-rose-300 text-rose-950 space-y-4 shadow-sm animate-in fade-in">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-rose-200/80 flex items-center justify-center text-rose-800 shrink-0">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div>
          <h4 className="text-sm font-black text-rose-950">
            امکان ثبت سفارش خرده‌فروشی خارج از شیراز وجود ندارد
          </h4>
          <p className="text-xs text-rose-800 mt-1 leading-relaxed">
            فروشگاه خرده‌فروشی پروفارم به دلیل حفظ کیفیت و طراوت محصولات ارگانیک، در حال حاضر صرفاً
            مختص نشانی‌های واقع در شهر <strong>شیراز</strong> (استان فارس) است. آدرس ثبت‌شده شما در شهر «{city}»
            قرار دارد.
          </p>
        </div>
      </div>

      <div className="bg-white/80 rounded-2xl p-4 border border-rose-200 text-xs space-y-2 text-gray-800">
        <p className="font-bold text-rose-900">شرایط ثبت سفارش برای سایر شهرستان‌ها:</p>
        <ul className="list-disc list-inside space-y-1 text-gray-600">
          <li>
            سبد خرید شما باید حداقل {toPersianDigits(BULK_MIN_ITEMS)} بسته (از هر محصولی) یا مبلغ{' '}
            {formatToman(BULK_MIN_SUBTOTAL)} داشته باشد.
          </li>
          <li>
            برای هماهنگی خرید عمده و استعلام قیمت، فرم استعلام عمده را تکمیل کنید.
          </li>
        </ul>
        <p className="text-xs text-gray-500 pt-1">
          سبد خرید فعلی شما: {toPersianDigits(totalItemsCount)} بسته (مبلغ:{' '}
          {formatToman(totalPrice)})
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-1">
        <Link
          href="/cart"
          className="flex-1 min-h-11 py-2.5 px-4 rounded-xl text-xs font-bold bg-farm-primary text-white hover:bg-farm-primary-dark transition-colors text-center flex items-center justify-center gap-1.5"
        >
          <ShoppingCart className="w-4 h-4" />
          <span>بازگشت به سبد خرید</span>
        </Link>
        <Link
          href="/bulk"
          className="flex-1 min-h-11 py-2.5 px-4 rounded-xl text-xs font-bold bg-white border border-rose-300 text-rose-800 hover:bg-rose-100 transition-colors text-center flex items-center justify-center gap-1.5"
        >
          <span>فرم استعلام و هماهنگی خرید عمده</span>
          <ArrowLeft className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};
