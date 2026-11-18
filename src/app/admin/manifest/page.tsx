'use client';

import React, { useMemo, useState } from 'react';
import { adminQuery, adminRequest, AdminStatus, buildCsv, downloadCsv, tehranIsoDate, useAdminFetch } from '@/components/admin/admin-client';
import { Order, OrderStatus, DailyCapacityItem } from '@/types';

/** Order as the admin API returns it (the stored order plus the statuses it may move to now). */
type AdminOrder = Order & { allowedNextStatuses?: OrderStatus[] };
import { formatToman, toPersianDigits } from '@/lib/formatters';
import { isDigitalOrder } from '@/lib/order-utils';
import { getOrderStatusMeta } from '@/lib/site-config';
import { useToast, useConfirm } from '@/components/ui/ToastProvider';
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
  ChevronDown,
  ChevronUp,
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
  const toast = useToast();
  const confirm = useConfirm();
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);
  const capacitiesState = useAdminFetch<{ dailyCapacities: DailyCapacityItem[] }>('/api/admin?type=dailyCapacities');
  const capacities = useMemo(() => capacitiesState.data?.dailyCapacities ?? [], [capacitiesState.data]);
  // The date filter goes to the server (deliverySlot.isoDate). Without a date the first 100 orders are loaded.
  const ordersState = useAdminFetch<{ orders: AdminOrder[] }>(
    adminQuery('/api/admin/orders', { status: 'ALL', date: selectedDateFilter, pageSize: 100 })
  );
  const [editingDateIso, setEditingDateIso] = useState<string | null>(null);
  const [editingCapacityInput, setEditingCapacityInput] = useState<number>(30);
  const [isCapacityOpen, setIsCapacityOpen] = useState<boolean>(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const refreshCapacities = () => {
    void capacitiesState.reload();
  };

  /** Capacity and closing actions go to the server; the list is refreshed from its answer. */
  const callAdminAction = async (action: string, payload: Record<string, unknown>) => {
    const result = await adminRequest<{ dailyCapacities?: DailyCapacityItem[] }>('/api/admin', {
      method: 'POST',
      body: { action, payload },
    });
    if (!result.ok) {
      throw new Error(result.message || 'ثبت تغییر روی سرور انجام نشد.');
    }
    return result.data;
  };

  const filterManifestOrders = (all: AdminOrder[]): AdminOrder[] => {
    // Only physical Shiraz orders in active/deliverable statuses belong in the driver manifest.
    // Digital and subscription orders are excluded by their structured fields.
    return all.filter(
      (o) =>
        !isDigitalOrder(o) &&
        o.address?.isShiraz !== false &&
        (o.status === 'PROCESSING' || o.status === 'OUT_FOR_DELIVERY' || o.status === 'DELIVERED')
    );
  };

  const orders = useMemo(() => filterManifestOrders(ordersState.data?.orders ?? []), [ordersState.data]);

  const handleMarkDelivered = async (order: Order) => {
    if (order.status === 'DELIVERED') return;
    const confirmed = await confirm({
      title: 'تایید تحویل سفارش',
      description: `آیا از ثبت تحویل موفق سفارش ${order.orderNumber} (${order.address?.recipientName || 'مشتری'}) اطمینان دارید؟ ممکن است پیامک اطلاع‌رسانی برای مشتری ارسال شود.`,
      confirmLabel: 'ثبت تحویل موفق',
      cancelLabel: 'انصراف',
      variant: 'primary',
    });
    if (!confirmed) return;

    setUpdatingOrderId(order.id);
    setStatusFeedback(null);
    const previousStatus = order.status;
    // Optimistic update of the list; rolled back if the server refuses
    ordersState.setData((prev) =>
      prev ? { ...prev, orders: prev.orders.map((o) => (o.id === order.id ? { ...o, status: 'DELIVERED' } : o)) } : prev
    );
    const result = await adminRequest<{ order: AdminOrder }>('/api/admin/orders', {
      method: 'PATCH',
      body: { orderId: order.id, status: 'DELIVERED' },
    });
    setUpdatingOrderId(null);
    if (!result.ok) {
      ordersState.setData((prev) =>
        prev ? { ...prev, orders: prev.orders.map((o) => (o.id === order.id ? { ...o, status: previousStatus } : o)) } : prev
      );
      setStatusFeedback({ type: 'error', text: result.message });
      toast.error(result.message);
      return;
    }
    const okMsg = `سفارش ${order.orderNumber} با موفقیت به عنوان «تحویل داده شد» ثبت گردید.`;
    setStatusFeedback({ type: 'success', text: okMsg });
    toast.success(okMsg);
    void ordersState.reload();
  };

  const handleToggleCloseDay = async (dateIso: string) => {
    const current = capacities.find((c) => c.dateIso === dateIso);
    try {
      await callAdminAction('toggleDayClosed', { isoDate: dateIso, closed: !current?.isClosedManually });
      await refreshCapacities();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ثبت تغییر روی سرور انجام نشد.');
    }
  };

  const handleSaveCapacity = async (dateIso: string) => {
    if (editingCapacityInput > 0) {
      try {
        await callAdminAction('setDailyCapacity', { isoDate: dateIso, maxOrders: editingCapacityInput });
        await refreshCapacities();
        setEditingDateIso(null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'ثبت ظرفیت روی سرور انجام نشد.');
      }
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
      'تاریخ تحویل',
      'بازه زمانی',
      'اقلام و بسته‌ها',
      'مبلغ (تومان)',
      'وضعیت',
    ];
    const rows = filteredOrders.map((o) => [
      o.orderNumber,
      o.address?.recipientName ?? '',
      o.address?.phone ?? '',
      `${o.address?.streetAddress ?? ''} - ${o.address?.unit || ''}`,
      o.deliverySlot?.isoDate ?? o.deliverySlot?.date ?? '',
      o.deliverySlot?.window ?? o.deliverySlot?.timeWindow ?? '',
      (o.items ?? []).map((i) => `${i.product?.title ?? ''} (${i.quantity} عدد)`).join(' | '),
      o.totalAmount,
      getOrderStatusMeta(o.status).label,
    ]);

    const dateTag = selectedDateFilter ?? tehranIsoDate();
    const csv = buildCsv(headers, rows);
    const filename = `peyk_shiraz_manifest_${dateTag}.csv`;
    if (typeof window !== 'undefined' && (window as any).AndroidBridge?.saveBase64File) {
      const base64 = btoa(unescape(encodeURIComponent(csv)));
      (window as any).AndroidBridge.saveBase64File(base64, filename, 'text/csv;charset=utf-8');
      return;
    }
    downloadCsv(filename, csv);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls (hidden in print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-farm-border no-print">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#D4A373]">
            <Truck className="w-4 h-4 text-farm-primary" />
            <span>پیک اختصاصی تحویل شهری مزارع شیراز</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-farm-primary mt-0.5">
            پیک شیراز
          </h1>
          <p className="text-xs text-gray-500">
            برگه مانیفست روزانه و برنامه تحویل رانندگان پیک شیراز | بازه زمانی انحصاری:{' '}
            <strong className="text-farm-primary">۳ ظهر الی ۲۱ شب (۱۵:۰۰ الی ۲۱:۰۰)</strong>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 rounded-xl bg-white border border-farm-border text-farm-primary hover:bg-gray-50 text-xs font-bold transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>خروجی اکسل (CSV)</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-5 py-2.5 rounded-xl bg-farm-primary text-white hover:bg-farm-primary-dark text-xs font-bold transition-colors flex items-center gap-2 shadow-md cursor-pointer"
          >
            <Printer className="w-4 h-4 text-[#D4A373]" />
            <span>چاپ برگه توزیع راننده</span>
          </button>
        </div>
      </div>

      {/* Status Feedback Banner */}
      <AdminStatus
        hasData={ordersState.data !== null}
        loading={ordersState.loading || capacitiesState.loading}
        error={ordersState.error || capacitiesState.error}
        onRetry={() => {
          void ordersState.reload();
          void capacitiesState.reload();
        }}
      />

      {statusFeedback && (
        <div
          role={statusFeedback.type === 'error' ? 'alert' : 'status'}
          className={`p-3.5 rounded-2xl border text-xs sm:text-sm font-bold flex items-center gap-2.5 no-print ${
            statusFeedback.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-900'
              : 'bg-emerald-50 border-emerald-300 text-emerald-950'
          }`}
        >
          {statusFeedback.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
          )}
          <span>{statusFeedback.text}</span>
        </div>
      )}

      {/* Info & Delivery Slot Notice Bar (Primary Driver View First) */}
      <div className="bg-farm-bg-warm rounded-2xl p-4 border border-farm-border flex flex-col sm:flex-row items-center justify-between gap-3 no-print text-xs">
        <div className="flex flex-wrap items-center gap-2 text-gray-700">
          <Clock className="w-4 h-4 text-farm-primary shrink-0" />
          <span>
            بازه استاندارد تحویل پیک شیراز: <strong>۱۵:۰۰ الی ۲۱:۰۰ (۳ ظهر الی ۹ شب)</strong> | تعداد کل
            مرسولات آماده توزیع: <strong>{toPersianDigits(filteredOrders.length)} آدرس</strong>
          </span>
          {selectedDateFilter && (
            <button
              type="button"
              onClick={() => setSelectedDateFilter(null)}
              className="text-xs text-rose-700 hover:text-rose-900 font-bold underline px-2 py-0.5 cursor-pointer"
            >
              حذف فیلتر روز ({selectedDateFilter})
            </button>
          )}
        </div>

        <input
          type="text"
          placeholder="جستجو در نام، شماره یا خیابان..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="px-3.5 py-2 rounded-xl border border-farm-border bg-white text-sm sm:text-xs text-gray-800 w-full sm:w-64 focus:outline-none focus:border-farm-primary"
        />
      </div>

      {/* Shiraz Urban Delivery Zones Filter (for optimized courier route dispatch) */}
      <div className="flex flex-wrap items-center gap-2 no-print">
        <span className="text-xs font-bold text-gray-600 ml-1 flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-farm-primary" />
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
                  ? 'bg-farm-primary text-white shadow-xs'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-farm-border'
              }`}
            >
              <span>{zone.label.split('(')[0].trim()}</span>
              <span className={`mr-1 px-1.5 py-0.2 rounded-md text-xs ${isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
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
          <div className="bg-white rounded-2xl border border-farm-border p-8 text-center space-y-2">
            <p className="text-sm font-bold text-gray-700">هیچ مقصد فیزیکی فعالی برای توزیع در این فیلتر وجود ندارد.</p>
          </div>
        ) : (
          filteredOrders.map((order, idx) => {
            const zoneBadge = getShirazZoneForAddress(order.address?.streetAddress || '');
            const statusMeta = getOrderStatusMeta(order.status);
            const isDelivered = order.status === 'DELIVERED';
            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-farm-border p-4 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between border-b border-farm-bg-warm pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-farm-primary text-white text-xs font-bold flex items-center justify-center">
                      {toPersianDigits(idx + 1)}
                    </span>
                    <span className="font-mono font-bold text-xs text-farm-primary">
                      #{order.orderNumber}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold">
                      <MapPin className="w-3 h-3 text-emerald-600" />
                      <span>{zoneBadge}</span>
                    </span>
                  </div>
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
                      <Phone className="w-3.5 h-3.5" />
                      <span>{order.address.phone}</span>
                    </a>
                  )}
                </div>

                <div className="text-xs text-gray-700 bg-gray-50 p-2.5 rounded-xl leading-relaxed">
                  <div className="font-bold text-gray-900 mb-0.5">نشانی دقیق شیراز:</div>
                  <div>{order.address?.streetAddress}</div>
                  {order.address?.unit && (
                    <span className="text-gray-600 font-bold block mt-1">واحد: {order.address.unit}</span>
                  )}
                </div>

                <div className="bg-farm-bg p-2.5 rounded-xl space-y-1.5 text-xs">
                  <div className="font-bold text-gray-600 text-xs">بسته‌های بارگیری‌شده:</div>
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center text-gray-800">
                      <span>• {item.product.title}</span>
                      <strong className="text-farm-primary">{toPersianDigits(item.quantity)} بسته</strong>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-gray-600">زمان تحویل: ۳ ظهر الی ۹ شب</span>
                  <span className="px-2.5 py-1 rounded-lg bg-farm-primary/10 text-farm-primary font-bold text-xs">
                    مبلغ: {formatToman(order.totalAmount)}
                  </span>
                </div>

                <div className="pt-2 border-t border-farm-bg-warm flex items-center justify-between gap-2">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${statusMeta.badgeClass}`}>
                    {statusMeta.label}
                  </span>
                  {isDelivered ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-800 font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>تحویل ثبت شده</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={updatingOrderId === order.id}
                      onClick={() => handleMarkDelivered(order)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-farm-primary hover:bg-farm-primary-dark text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <CheckSquare className="w-4 h-4" />
                      <span>{updatingOrderId === order.id ? 'در حال ثبت...' : 'تحویل داده شد ✓'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Manifest Table (Desktop & Print — fits 1280px & A4 without horizontal clipping) */}
      <div className="hidden md:block print:block bg-white rounded-3xl border border-farm-border shadow-farm overflow-hidden print:border-black print:rounded-none print:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full table-auto text-right text-xs lg:text-sm print:text-xs">
            <thead className="bg-farm-bg border-b border-farm-border print:bg-gray-100 print:border-black">
              <tr className="text-farm-primary print:text-black">
                <th className="py-3.5 px-2.5 font-black whitespace-nowrap">ردیف</th>
                <th className="py-3.5 px-2.5 font-black whitespace-nowrap">سفارش</th>
                <th className="py-3.5 px-2.5 font-black">تحویل‌گیرنده / تلفن</th>
                <th className="py-3.5 px-2.5 font-black">نشانی دقیق در شیراز</th>
                <th className="py-3.5 px-2.5 font-black">اقلام بارگیری</th>
                <th className="py-3.5 px-2.5 font-black whitespace-nowrap">ساعت تحویل</th>
                <th className="py-3.5 px-2.5 font-black whitespace-nowrap text-center no-print">وضعیت تحویل</th>
                <th className="py-3.5 px-2.5 font-black whitespace-nowrap text-center hidden print:table-cell">امضای مشتری</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-farm-border print:divide-black">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-gray-500 font-medium">
                    هیچ مقصد فیزیکی فعالی برای توزیع در این فیلتر وجود ندارد.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order, idx) => {
                  const zoneBadge = getShirazZoneForAddress(order.address?.streetAddress || '');
                  const statusMeta = getOrderStatusMeta(order.status);
                  const isDelivered = order.status === 'DELIVERED';

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-gray-50/70 transition-colors print:hover:bg-white align-top"
                    >
                      <td className="py-3.5 px-2.5 font-bold text-gray-500 whitespace-nowrap">
                        {toPersianDigits(idx + 1)}
                      </td>
                      <td className="py-3.5 px-2.5 font-mono font-bold text-farm-primary print:text-black text-xs whitespace-nowrap">
                        {order.orderNumber}
                      </td>
                      <td className="py-3.5 px-2.5">
                        <div className="font-bold text-gray-900">{order.address?.recipientName}</div>
                        <div className="font-mono text-gray-600 text-xs pt-0.5" dir="ltr">
                          {order.address?.phone}
                        </div>
                      </td>
                      <td className="py-3.5 px-2.5 max-w-[230px]">
                        <div className="mb-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-farm-primary/10 text-farm-primary text-xs font-bold">
                            <MapPin className="w-3 h-3" />
                            <span>{zoneBadge}</span>
                          </span>
                        </div>
                        <div className="text-gray-800 leading-relaxed font-medium text-xs break-words">
                          {order.address?.streetAddress}
                        </div>
                        {order.address?.unit && (
                          <span className="inline-block mt-1 px-2 py-0.5 rounded bg-gray-100 text-xs text-gray-600 print:bg-transparent print:border print:border-gray-400">
                            واحد: {order.address?.unit}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-2.5 max-w-[220px]">
                        <div className="space-y-1 leading-relaxed">
                          {order.items.map((item) => (
                            <div key={item.id} className="text-gray-800 flex items-start gap-1.5 text-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-farm-primary print:bg-black shrink-0 mt-1.5" />
                              <span>
                                {item.product.title} (
                                <strong className="text-farm-primary print:text-black">
                                  {toPersianDigits(item.quantity)} بسته
                                </strong>
                                )
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-xl bg-farm-bg-warm text-farm-primary font-bold text-xs whitespace-nowrap print:bg-transparent print:border print:border-black">
                          ۱۵:۰۰ الی ۲۱:۰۰
                        </span>
                      </td>
                      <td className="py-3.5 px-2.5 text-center whitespace-nowrap no-print">
                        {isDelivered ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>تحویل شد</span>
                          </span>
                        ) : (
                          <div className="flex flex-col items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${statusMeta.badgeClass}`}>
                              {statusMeta.label}
                            </span>
                            <button
                              type="button"
                              disabled={updatingOrderId === order.id}
                              onClick={() => handleMarkDelivered(order)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-farm-primary hover:bg-farm-primary-dark text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <CheckSquare className="w-3.5 h-3.5" />
                              <span>{updatingOrderId === order.id ? 'ثبت...' : 'تحویل داده شد ✓'}</span>
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-2.5 text-center whitespace-nowrap hidden print:table-cell">
                        <div className="w-20 h-10 border border-dashed border-gray-400 rounded-lg print:border-black mx-auto" />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Collapsible Admin Capacity Management Widget (Below Driver Delivery List, Collapsed by Default) */}
      <div className="bg-white rounded-3xl border border-farm-border shadow-farm overflow-hidden no-print">
        <button
          type="button"
          onClick={() => setIsCapacityOpen((prev) => !prev)}
          aria-expanded={isCapacityOpen}
          className="w-full p-5 flex items-center justify-between gap-3 text-right hover:bg-farm-bg transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-700 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-farm-primary">
                  پایش و مدیریت ظرفیت پذیرش روزانه پیک پروفارم شیراز
                </h3>
                <span className="text-xs bg-amber-100 text-amber-900 font-bold px-2.5 py-0.5 rounded-full border border-amber-200">
                  {toPersianDigits(capacities.filter((c) => !c.isClosedManually && c.status !== 'FULL').length)} روز باز
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-0.5">
                تنظیم سقف روزانه، بستن دستی روزها و فیلتر مانیفست بر اساس تاریخ تحویل
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 text-farm-primary text-xs font-bold">
            <span className="hidden sm:inline">{isCapacityOpen ? 'بستن تنظیمات ظرفیت' : 'مدیریت ظرفیت روزها'}</span>
            {isCapacityOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </button>

        {isCapacityOpen && (
          <div className="p-6 pt-0 space-y-5 border-t border-farm-bg-warm">
            <div className="flex flex-wrap items-center justify-between gap-2 pt-4">
              <p className="text-xs text-gray-600">
                کاربران عادی در صفحه تسویه حساب جزئیات این آمار را نمی‌بینند و فقط در صورت تکمیل ظرفیت یک روز، برچسب قرمز «تکمیل ظرفیت» را مشاهده می‌کنند.
              </p>

              <div className="flex items-center gap-2">
                {selectedDateFilter && (
                  <button
                    type="button"
                    onClick={() => setSelectedDateFilter(null)}
                    className="text-xs text-rose-700 hover:text-rose-900 font-bold underline px-2 py-1 cursor-pointer"
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
                        ? 'border-farm-primary bg-farm-bg-warm/60 shadow-sm ring-2 ring-farm-primary/20'
                        : cap.isClosedManually || cap.status === 'FULL'
                        ? 'border-rose-200 bg-rose-50/40'
                        : cap.status === 'NEAR_FULL'
                        ? 'border-amber-200 bg-amber-50/30'
                        : 'border-farm-border bg-farm-bg'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-xs font-bold text-gray-800 block">
                            {cap.dayOfWeek}
                          </span>
                          <span className="text-xs text-gray-600 block">
                            {cap.jalaliFormatted}
                          </span>
                        </div>

                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-md border ${
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
                          <span className="text-gray-600">سفارشات رزرو:</span>
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
                                : 'bg-farm-primary'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-xs text-gray-600 pt-0.5">
                          <span>ظرفیت خالی:</span>
                          <span className="font-semibold text-farm-primary">
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
                            className="w-16 px-2 py-1 text-xs border border-farm-border rounded-lg bg-white text-center"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveCapacity(cap.dateIso)}
                            className="flex-1 py-1 px-2 rounded-lg bg-emerald-700 text-white font-bold text-xs hover:bg-emerald-800 cursor-pointer"
                          >
                            ذخیره سقف
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingDateIso(null)}
                            className="py-1 px-2 rounded-lg bg-gray-200 text-gray-700 text-xs hover:bg-gray-300 cursor-pointer"
                          >
                            انصراف
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleCloseDay(cap.dateIso)}
                            className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
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
                            className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 cursor-pointer"
                            title="تنظیم سقف ظرفیت"
                            aria-label={`تنظیم سقف ظرفیت ${cap.dayOfWeek}`}
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedDateFilter(isFilterActive ? null : cap.dateIso)}
                            className={`p-2 rounded-xl transition-colors cursor-pointer ${
                              isFilterActive
                                ? 'bg-farm-primary text-white'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            }`}
                            title="فیلتر سفارشات جدول راننده"
                            aria-label={`فیلتر سفارشات ${cap.dayOfWeek}`}
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
        )}
      </div>

      {/* Driver Instructions & Signature Block (print-ready) */}
      <div className="p-6 rounded-3xl bg-white border border-farm-border text-xs space-y-4 print:border-black print:rounded-none">
        <div className="flex items-center gap-2 font-bold text-farm-primary print:text-black">
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
