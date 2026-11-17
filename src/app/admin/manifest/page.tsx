'use client';

import React, { useState, useEffect } from 'react';
import { farmStore } from '@/lib/db-store';
import { Order, DailyCapacityItem } from '@/types';
import { formatToman, toPersianDigits } from '@/lib/formatters';
import {
  Printer,
  FileSpreadsheet,
  Truck,
  MapPin,
  Phone,
  Package,
  Calendar,
  Clock,
  CheckSquare,
  ShieldCheck,
  Lock,
  Unlock,
  AlertCircle,
  CheckCircle2,
  SlidersHorizontal,
  RefreshCw,
} from 'lucide-react';

const SHIRAZ_ZONES = [
  { id: 'ALL', label: 'همه مناطق شیراز' },
  { id: 'ZONE_1', label: 'منطقه ۱ (قصرالدشت، ارم، چمران، عفیف‌آباد)', keywords: ['قصرالدشت', 'قصردشت', 'ارم', 'چمران', 'عفیف'] },
  { id: 'ZONE_2', label: 'منطقه ۲ (معالی‌آباد، فرهنگ‌شهر، تاچارا)', keywords: ['معالی', 'معالی‌آباد', 'فرهنگ', 'تاچارا', 'گلدشت', 'صنایع'] },
  { id: 'ZONE_3', label: 'منطقه ۳ (ستارخان، قدوسی، بعثت، زرگری)', keywords: ['ستارخان', 'قدوسی', 'بعثت', 'زرگری', 'مطهری'] },
  { id: 'ZONE_4', label: 'منطقه ۴ (زند، گاز، اطلسی، حافظیه)', keywords: ['زند', 'گاز', 'اطلسی', 'حافظ', 'سعدی', 'کریمخان'] },
  { id: 'ZONE_OTHER', label: 'سایر نواحی شیراز' },
];

export function getShirazZoneForAddress(address: string): string {
  if (!address) return 'سایر نواحی شیراز';
  for (const z of SHIRAZ_ZONES) {
    if (z.keywords && z.keywords.some((kw) => address.includes(kw))) {
      return z.label.split(' ')[0] + ' ' + z.label.split(' ')[1];
    }
  }
  return 'سایر نواحی';
}

export default function DailyManifestPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [capacities, setCapacities] = useState<DailyCapacityItem[]>([]);
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);
  const [editingDateIso, setEditingDateIso] = useState<string | null>(null);
  const [editingCapacityInput, setEditingCapacityInput] = useState<number>(30);

  const refreshCapacities = () => {
    setCapacities(farmStore.getDailyCapacities());
  };

  useEffect(() => {
    // Only Shiraz orders belong in the driver urban delivery manifest
    const all = farmStore.getOrders();
    const shirazOrders = all.filter((o) => o.address?.isShiraz !== false);
    setOrders(shirazOrders);
    refreshCapacities();
  }, []);

  const handleToggleCloseDay = (dateIso: string) => {
    const updated = farmStore.toggleDailyCapacityClose(dateIso);
    setCapacities(updated);
  };

  const handleSaveCapacity = (dateIso: string) => {
    if (editingCapacityInput > 0) {
      const updated = farmStore.setDailyCapacity(dateIso, { maxCapacity: editingCapacityInput });
      setCapacities(updated);
      setEditingDateIso(null);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (selectedDateFilter) {
      const slotDate = o.deliverySlot?.isoDate || o.deliverySlot?.date || '';
      if (!slotDate.includes(selectedDateFilter)) return false;
    }

    if (selectedZone !== 'ALL') {
      const addr = o.address?.streetAddress || '';
      const zoneObj = SHIRAZ_ZONES.find((z) => z.id === selectedZone);
      if (zoneObj && zoneObj.keywords) {
        const matches = zoneObj.keywords.some((kw) => addr.includes(kw));
        if (!matches) return false;
      } else if (selectedZone === 'ZONE_OTHER') {
        const allKw = SHIRAZ_ZONES.flatMap((z) => z.keywords || []);
        const matchesAny = allKw.some((kw) => addr.includes(kw));
        if (matchesAny) return false;
      }
    }

    if (!searchFilter.trim()) return true;
    const query = searchFilter.toLowerCase();
    return (
      o.orderNumber.toLowerCase().includes(query) ||
      o.address?.recipientName.toLowerCase().includes(query) ||
      o.address?.streetAddress.toLowerCase().includes(query) ||
      o.address?.phone.includes(query)
    );
  });

  const handlePrint = () => {
    if (typeof window !== 'undefined' && (window as any).AndroidBridge?.printPage) {
      (window as any).AndroidBridge.printPage();
    } else {
      window.print();
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'شماره سفارش',
      'گیرنده',
      'شماره تماس',
      'نشانی کامل شیراز',
      'بازه زمانی تحویل',
      'اقلام و بسته‌ها',
      'مبلغ (تومان)',
      'وضعیت',
    ];
    const rows = filteredOrders.map((o) => [
      o.orderNumber,
      o.address?.recipientName,
      o.address?.phone,
      `"${o.address?.streetAddress} - ${o.address?.unit || ''}"`,
      o.deliverySlot ? `"${o.deliverySlot.date} (۱۵:۰۰ الی ۲۱:۰۰)"` : '۱۵:۰۰ الی ۲۱:۰۰ (۳ ظهر الی ۹ شب)',
      `"${o.items.map((i) => `${i.product.title} (${i.quantity} عدد)`).join(' | ')}"`,
      o.totalAmount,
      o.status,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const filename = `peyk_shiraz_manifest_${Date.now()}.csv`;
    if (typeof window !== 'undefined' && (window as any).AndroidBridge?.saveBase64File) {
      const base64 = btoa(unescape(encodeURIComponent(csvContent)));
      (window as any).AndroidBridge.saveBase64File(base64, filename, 'text/csv;charset=utf-8');
      return;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls (hidden in print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E6E1D5] no-print">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#D4A373]">
            <Truck className="w-4 h-4 text-[#2C4A2E]" />
            <span>پیک اختصاصی تحویل شهری مزارع شیراز</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#2C4A2E] mt-0.5">
            پیک شیراز
          </h1>
          <p className="text-xs text-gray-500">
            برگه مانیفست روزانه و برنامه تحویل رانندگان پیک شیراز | بازه زمانی انحصاری:{' '}
            <strong className="text-[#2C4A2E]">۳ ظهر الی ۲۱ شب (۱۵:۰۰ الی ۲۱:۰۰)</strong>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 rounded-xl bg-white border border-[#E6E1D5] text-[#2C4A2E] hover:bg-gray-50 text-xs font-bold transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>خروجی اکسل (CSV)</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-5 py-2.5 rounded-xl bg-[#2C4A2E] text-white hover:bg-[#1E3520] text-xs font-bold transition-colors flex items-center gap-2 shadow-md cursor-pointer"
          >
            <Printer className="w-4 h-4 text-[#D4A373]" />
            <span>چاپ برگه توزیع راننده</span>
          </button>
        </div>
      </div>

      {/* Admin Exclusive: Daily Fleet Delivery Capacity Monitor & Control Widget */}
      <div className="bg-white rounded-3xl p-6 border border-[#E6E1D5] shadow-farm space-y-5 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#F3EFE6]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-700">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#2C4A2E]">
                  پایش و مدیریت ظرفیت پذیرش روزانه پیک پروفارم شیراز
                </h3>
                <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-200">
                  مختص پنل مدیریت
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                کاربران عادی در صفحه تسویه حساب جزئیات این آمار را نمی‌بینند و فقط در صورت تکمیل ظرفیت یک روز، برچسب قرمز «تکمیل ظرفیت» را مشاهده می‌کنند.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedDateFilter && (
              <button
                type="button"
                onClick={() => setSelectedDateFilter(null)}
                className="text-xs text-rose-600 hover:text-rose-800 font-bold underline px-2 py-1"
              >
                حذف فیلتر روز ({selectedDateFilter})
              </button>
            )}
            <button
              type="button"
              onClick={refreshCapacities}
              className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="بروزرسانی وضعیت ظرفیت‌ها"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">بروزرسانی</span>
            </button>
          </div>
        </div>

        {/* Days Capacity Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {capacities.map((cap) => {
            const isFilterActive = selectedDateFilter === cap.dateIso;
            const percent = Math.min(100, Math.round((cap.bookedCount / cap.maxCapacity) * 100));
            const isEditing = editingDateIso === cap.dateIso;

            return (
              <div
                key={cap.dateIso}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                  isFilterActive
                    ? 'border-[#2C4A2E] bg-[#F3EFE6]/60 shadow-sm ring-2 ring-[#2C4A2E]/20'
                    : cap.isClosedManually || cap.status === 'FULL'
                    ? 'border-rose-200 bg-rose-50/40'
                    : cap.status === 'NEAR_FULL'
                    ? 'border-amber-200 bg-amber-50/30'
                    : 'border-[#E6E1D5] bg-[#F9F8F5]'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-gray-800 block">
                        {cap.dayOfWeek}
                      </span>
                      <span className="text-[11px] text-gray-500 block">
                        {cap.jalaliFormatted}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                        cap.isClosedManually || cap.status === 'FULL'
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : cap.status === 'NEAR_FULL'
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      }`}
                    >
                      {cap.isClosedManually
                        ? 'تکمیل دستی'
                        : cap.status === 'FULL'
                        ? 'تکمیل ظرفیت'
                        : cap.status === 'NEAR_FULL'
                        ? 'نزدیک به تکمیل'
                        : 'ظرفیت باز'}
                    </span>
                  </div>

                  {/* Progress Bar & Stats */}
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">سفارشات رزرو:</span>
                      <span className="font-bold text-gray-800">
                        {toPersianDigits(cap.bookedCount)} از {toPersianDigits(cap.maxCapacity)}
                      </span>
                    </div>

                    <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          cap.isClosedManually || cap.status === 'FULL'
                            ? 'bg-rose-500'
                            : cap.status === 'NEAR_FULL'
                            ? 'bg-amber-500'
                            : 'bg-[#2C4A2E]'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-gray-500 pt-0.5">
                      <span>ظرفیت خالی:</span>
                      <span className="font-semibold text-[#2C4A2E]">
                        {cap.isClosedManually ? '۰ سفارش' : `${toPersianDigits(cap.remainingCapacity)} سفارش`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Controls */}
                <div className="pt-2 border-t border-gray-200/60 space-y-2 text-xs">
                  {isEditing ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="5"
                        max="100"
                        value={editingCapacityInput}
                        onChange={(e) => setEditingCapacityInput(Number(e.target.value))}
                        className="w-16 px-2 py-1 text-xs border border-[#E6E1D5] rounded-lg bg-white text-center"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveCapacity(cap.dateIso)}
                        className="flex-1 py-1 px-2 rounded-lg bg-emerald-700 text-white font-bold text-[11px] hover:bg-emerald-800 cursor-pointer"
                      >
                        ذخیره سقف
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingDateIso(null)}
                        className="py-1 px-2 rounded-lg bg-gray-200 text-gray-700 text-[11px] hover:bg-gray-300 cursor-pointer"
                      >
                        انصراف
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleCloseDay(cap.dateIso)}
                        className={`flex-1 py-1 px-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          cap.isClosedManually
                            ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300'
                            : 'bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-300'
                        }`}
                        title={cap.isClosedManually ? 'بازگشایی مجدد پذیرش سفارش' : 'بستن دستی و تکمیل ظرفیت'}
                      >
                        {cap.isClosedManually ? (
                          <>
                            <Unlock className="w-3 h-3" />
                            <span>بازگشایی</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3 h-3" />
                            <span>تکمیل ظرفیت</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingDateIso(cap.dateIso);
                          setEditingCapacityInput(cap.maxCapacity);
                        }}
                        className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 cursor-pointer"
                        title="تنظیم سقف ظرفیت"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedDateFilter(isFilterActive ? null : cap.dateIso)}
                        className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                          isFilterActive
                            ? 'bg-[#2C4A2E] text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                        title="فیلتر سفارشات جدول راننده"
                      >
                        <Truck className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info & Delivery Slot Notice Bar */}
      <div className="bg-[#F3EFE6] rounded-2xl p-4 border border-[#E6E1D5] flex flex-col sm:flex-row items-center justify-between gap-3 no-print text-xs">
        <div className="flex items-center gap-2 text-gray-700">
          <Clock className="w-4 h-4 text-[#2C4A2E] shrink-0" />
          <span>
            بازه استاندارد تحویل پیک شیراز: <strong>۱۵:۰۰ الی ۲۱:۰۰ (۳ ظهر الی ۹ شب)</strong> | تعداد کل
            مرسولات آماده توزیع: <strong>{toPersianDigits(filteredOrders.length)} آدرس</strong>
          </span>
        </div>

        <input
          type="text"
          placeholder="جستجو در نام، شماره یا خیابان..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="px-3.5 py-1.5 rounded-xl border border-[#E6E1D5] bg-white text-xs text-gray-800 w-full sm:w-64 focus:outline-none focus:border-[#2C4A2E]"
        />
      </div>

      {/* Shiraz Urban Delivery Zones Filter (for optimized courier route dispatch) */}
      <div className="flex flex-wrap items-center gap-2 no-print">
        <span className="text-xs font-bold text-gray-600 ml-1 flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-[#2C4A2E]" />
          <span>تفکیک بر اساس مناطق شهری شیراز:</span>
        </span>

        {SHIRAZ_ZONES.map((zone) => {
          const isSelected = selectedZone === zone.id;
          const countInZone = orders.filter((o) => {
            if (zone.id === 'ALL') return true;
            const addr = o.address?.streetAddress || '';
            if (zone.keywords) return zone.keywords.some((kw) => addr.includes(kw));
            if (zone.id === 'ZONE_OTHER') {
              const allKw = SHIRAZ_ZONES.flatMap((z) => z.keywords || []);
              return !allKw.some((kw) => addr.includes(kw));
            }
            return false;
          }).length;

          return (
            <button
              key={zone.id}
              type="button"
              onClick={() => setSelectedZone(zone.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#2C4A2E] text-white shadow-xs'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-[#E6E1D5]'
              }`}
            >
              <span>{zone.label.split('(')[0].trim()}</span>
              <span className={`mr-1 px-1.5 py-0.2 rounded-md text-[10px] ${isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {toPersianDigits(countInZone)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Official Print Header (styled for paper print) */}
      <div className="hidden print:block text-center pb-6 border-b-2 border-black space-y-2">
        <div className="text-xl font-black text-black">
          پیک شیراز - مزارع ارگانیک پروفارم
        </div>
        <div className="text-base font-bold text-black">
          برگه مانیفست توزیع و تحویل راننده (بازه زمانی: ۳ بعد از ظهر الی ۹ شب)
        </div>
        <div className="text-xs flex justify-between pt-2">
          <span>مرکز بارگیری: انبار مرکزی پروفارم (بلوار ارم شیراز)</span>
          <span>تعداد کل مقاصد شیراز: {toPersianDigits(filteredOrders.length)} سفارش</span>
        </div>
      </div>

      {/* Mobile Manifest Cards (for driver/admin on mobile phones - zero horizontal scrolling) */}
      <div className="md:hidden flex flex-col gap-3.5 print:hidden">
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E6E1D5] p-8 text-center space-y-2">
            <p className="text-sm font-bold text-gray-700">هیچ مقصدی برای توزیع در این فیلتر وجود ندارد.</p>
          </div>
        ) : (
          filteredOrders.map((order, idx) => {
            const zoneBadge = getShirazZoneForAddress(order.address?.streetAddress || '');
            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-[#E6E1D5] p-4 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between border-b border-[#F3EFE6] pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#2C4A2E] text-white text-xs font-bold flex items-center justify-center">
                      {toPersianDigits(idx + 1)}
                    </span>
                    <span className="font-mono font-bold text-xs text-[#2C4A2E]">
                      #{order.orderNumber}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold">
                    <MapPin className="w-3 h-3 text-emerald-600" />
                    <span>{zoneBadge}</span>
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="font-bold text-gray-900">
                    {order.address?.recipientName}
                  </div>
                  {order.address?.phone && (
                    <a
                      href={`tel:${order.address.phone}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold"
                      dir="ltr"
                    >
                      <span>{order.address.phone}</span>
                      <span>📞</span>
                    </a>
                  )}
                </div>

                <div className="text-xs text-gray-700 bg-gray-50 p-2.5 rounded-xl leading-relaxed">
                  <div className="font-bold text-gray-900 mb-0.5">نشانی دقیق شیراز:</div>
                  <div>{order.address?.streetAddress}</div>
                  {order.address?.unit && (
                    <span className="text-gray-500 font-bold block mt-1">واحد: {order.address.unit}</span>
                  )}
                </div>

                <div className="bg-[#F9F8F5] p-2.5 rounded-xl space-y-1.5 text-xs">
                  <div className="font-bold text-gray-500 text-[11px]">بسته‌های بارگیری‌شده:</div>
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center text-gray-800">
                      <span>• {item.product.title}</span>
                      <strong className="text-[#2C4A2E]">{toPersianDigits(item.quantity)} بسته</strong>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-gray-500">زمان تحویل: ۳ ظهر الی ۹ شب</span>
                  <span className="px-2.5 py-1 rounded-lg bg-[#2C4A2E]/10 text-[#2C4A2E] font-bold text-[11px]">
                    مبلغ: {formatToman(order.totalAmount)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Manifest Table (Desktop & Print) */}
      <div className="hidden md:block print:block bg-white rounded-3xl border border-[#E6E1D5] shadow-farm overflow-hidden print:border-black print:rounded-none print:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-right text-sm print:text-[11px]">
            <thead className="bg-[#F9F8F5] border-b border-[#E6E1D5] print:bg-gray-100 print:border-black">
              <tr className="text-[#2C4A2E] print:text-black">
                <th className="py-4 px-4 font-black whitespace-nowrap">ردیف</th>
                <th className="py-4 px-4 font-black whitespace-nowrap">کد سفارش</th>
                <th className="py-4 px-4 font-black whitespace-nowrap min-w-[140px]">تحویل‌گیرنده / تلفن</th>
                <th className="py-4 px-4 font-black min-w-[220px]">نشانی دقیق در شیراز</th>
                <th className="py-4 px-4 font-black min-w-[240px]">بسته‌های بارگیری‌شده</th>
                <th className="py-4 px-4 font-black whitespace-nowrap">ساعت تحویل پیک</th>
                <th className="py-4 px-4 font-black whitespace-nowrap text-center">امضای مشتری</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E1D5] print:divide-black">
              {filteredOrders.map((order, idx) => {
                const zoneBadge = getShirazZoneForAddress(order.address?.streetAddress || '');

                return (
                  <tr
                    key={order.id}
                    className="hover:bg-gray-50/70 transition-colors print:hover:bg-white"
                  >
                    <td className="py-4 px-4 font-bold text-gray-500 whitespace-nowrap">
                      {toPersianDigits(idx + 1)}
                    </td>
                    <td className="py-4 px-4 font-mono font-bold text-[#2C4A2E] print:text-black whitespace-nowrap">
                      {order.orderNumber}
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="font-bold text-gray-900">{order.address?.recipientName}</div>
                      <div className="font-mono text-gray-500 text-xs pt-0.5" dir="ltr">
                        {order.address?.phone}
                      </div>
                    </td>
                    <td className="py-4 px-4 min-w-[220px] max-w-xs">
                      <div className="mb-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#2C4A2E]/10 text-[#2C4A2E] text-[11px] font-bold">
                          <MapPin className="w-3 h-3" />
                          <span>{zoneBadge}</span>
                        </span>
                      </div>
                      <div className="text-gray-800 leading-relaxed font-medium">
                        {order.address?.streetAddress}
                      </div>
                      {order.address?.unit && (
                        <span className="inline-block mt-1 px-2 py-0.5 rounded bg-gray-100 text-xs text-gray-600 print:bg-transparent print:border print:border-gray-400">
                          واحد: {order.address?.unit}
                        </span>
                      )}
                    </td>
                  <td className="py-4 px-4 min-w-[240px]">
                    <div className="space-y-1.5 leading-relaxed">
                      {order.items.map((item) => (
                        <div key={item.id} className="text-gray-800 flex items-center gap-1.5 text-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#2C4A2E] print:bg-black shrink-0" />
                          <span>
                            {item.product.title} (
                            <strong className="text-[#2C4A2E] print:text-black">
                              {toPersianDigits(item.quantity)} بسته
                            </strong>
                            )
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-[#F3EFE6] text-[#2C4A2E] font-bold text-xs whitespace-nowrap print:bg-transparent print:border print:border-black">
                      ۱۵:۰۰ الی ۲۱:۰۰ (۳ ظهر الی ۹ شب)
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center whitespace-nowrap">
                    <div className="w-24 h-12 border border-dashed border-gray-300 rounded-xl print:border-black mx-auto" />
                  </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Driver Instructions & Signature Block (print-ready) */}
      <div className="p-6 rounded-3xl bg-white border border-[#E6E1D5] text-xs space-y-4 print:border-black print:rounded-none">
        <div className="flex items-center gap-2 font-bold text-[#2C4A2E] print:text-black">
          <ShieldCheck className="w-4 h-4" />
          <span>تعهدات الزامی سفیر پیک پروفارم شیراز (بازه ۱۵:۰۰ تا ۲۱:۰۰):</span>
        </div>
        <ul className="list-disc list-inside space-y-1 text-gray-600 print:text-black leading-relaxed">
          <li>تمامی تحویل‌ها در بازه مقرر ۳ عصر الی ۹ شب انجام می‌پذیرد.</li>
          <li>حفظ سلامت، بهداشت و بسته‌بندی ایمن کالاها در تمام طول مسیر الزامی است.</li>
          <li>قبل از حرکت به سمت هر مقصد، حتماً تماس هماهنگی با مشتری برقرار گردد.</li>
          <li>بسته‌های تخم‌مرغ و شیشه‌های عسل در سبدهای ضربه‌گیر اختصاصی حمل شوند.</li>
        </ul>

        <div className="grid grid-cols-2 gap-8 pt-4 border-t border-gray-200 text-center font-bold">
          <div>
            <span>نام و امضای سفیر پیک پروفارم: ____________________</span>
          </div>
          <div>
            <span>تایید سرپرست انبار مرکزی پروفارم: ____________________</span>
          </div>
        </div>
      </div>
    </div>
  );
}
