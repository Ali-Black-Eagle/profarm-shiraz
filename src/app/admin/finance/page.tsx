'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  CircleDollarSign,
  FileSpreadsheet,
  Printer,
  Calendar,
  CheckCircle2,
  CreditCard,
  Percent,
  Crown,
  Zap,
  Clock,
  Search,
  Building2,
  Receipt,
  X,
  CalendarDays,
  Sun,
  Sunrise,
  Sunset,
  Moon,
  TrendingUp,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import { farmStore } from '@/lib/db-store';
import { formatToman, toPersianDigits } from '@/lib/formatters';
import { PERSIAN_MONTHS, formatToJalali } from '@/lib/jalali';
import { SITE_CONFIG } from '@/lib/site-config';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/ToastProvider';
import {
  FinancialRecord,
  FinancialSummary,
  SubscriptionTier,
  MonthlyFinancialStat,
  WeeklyDayStat,
  DailyShiftStat,
} from '@/types';

type MonitorPeriodMode = 'DAILY' | 'WEEKLY' | 'MONTHLY';

const WEEKDAYS_LIST = [
  { name: 'شنبه', label: 'شنبه' },
  { name: 'یکشنبه', label: 'یکشنبه' },
  { name: 'دوشنبه', label: 'دوشنبه' },
  { name: 'سه‌شنبه', label: 'سه‌شنبه' },
  { name: 'چهارشنبه', label: 'چهارشنبه' },
  { name: 'پنج‌شنبه', label: 'پنج‌شنبه' },
  { name: 'جمعه', label: 'جمعه' },
];

export default function AdminFinancePage() {
  const toast = useToast();
  // Period Mode: Daily, Weekly, or Monthly
  const [periodMode, setPeriodMode] = useState<MonitorPeriodMode>('MONTHLY');

  // Active filters inside each mode (default ALL so real paid orders appear immediately)
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [selectedWeekday, setSelectedWeekday] = useState<string>('ALL');
  const [selectedShift, setSelectedShift] = useState<string>('ALL');

  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<'ALL' | SubscriptionTier>('ALL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedInvoiceRecord, setSelectedInvoiceRecord] = useState<FinancialRecord | null>(null);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);

  // Compute active timeframe query string based on periodMode and sub-selectors
  const activeTimeframe = useMemo(() => {
    if (periodMode === 'DAILY') {
      return 'TODAY';
    }
    if (periodMode === 'WEEKLY') {
      return selectedWeekday === 'ALL' ? 'WEEK' : selectedWeekday;
    }
    // Monthly mode
    return selectedMonth;
  }, [periodMode, selectedMonth, selectedWeekday]);

  const loadData = () => {
    const rawRecords = farmStore.getFinancialRecords(activeTimeframe);
    setRecords(rawRecords);
    const sum = farmStore.getFinancialSummary(activeTimeframe);
    setSummary(sum);
  };

  useEffect(() => {
    loadData();
  }, [activeTimeframe]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Filter records based on search and tier
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchesTier = tierFilter === 'ALL' || r.customerTier === tierFilter;
      const matchesSearch =
        !searchQuery.trim() ||
        r.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.customerPhone.includes(searchQuery);

      return matchesTier && matchesSearch;
    });
  }, [records, tierFilter, searchQuery]);

  // Handle Export to Excel (CSV with UTF-8 BOM for Persian Windows Excel)
  const handleExportExcel = () => {
    if (records.length === 0) {
      showToast('در بازه زمانی انتخاب‌شده هیچ سفارش پرداخت‌شده‌ای برای صدور اکسل ثبت نشده است.');
      return;
    }
    try {
      const csvData = farmStore.exportFinancialCsv(activeTimeframe);
      const timestamp = new Date().toLocaleDateString('fa-IR').replace(/\//g, '-');
      const modeSlug =
        periodMode === 'DAILY'
          ? 'daily-today'
          : periodMode === 'WEEKLY'
          ? `weekly-${selectedWeekday}`
          : `monthly-${selectedMonth}`;
      const filename = `profarm-finance-${modeSlug}-${timestamp}.csv`;

      if (typeof window !== 'undefined' && (window as any).AndroidBridge?.saveBase64File) {
        const base64 = btoa(unescape(encodeURIComponent(csvData)));
        (window as any).AndroidBridge.saveBase64File(base64, filename, 'text/csv;charset=utf-8');
        showToast(`گزارش مالی دوره (${summary?.selectedPeriodLabel || 'انتخاب‌شده'}) در قالب اکسل ذخیره گردید.`);
        return;
      }

      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast(`گزارش مالی دوره (${summary?.selectedPeriodLabel || 'انتخاب‌شده'}) در قالب اکسل ذخیره گردید.`);
    } catch {
      toast.error('خطا در صدور فایل اکسل. لطفاً مجدداً تلاش کنید.');
    }
  };

  const handleOpenInvoice = (record: FinancialRecord) => {
    setSelectedInvoiceRecord(record);
    setIsInvoiceOpen(true);
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined' && (window as any).AndroidBridge?.printPage) {
      (window as any).AndroidBridge.printPage();
    } else {
      window.print();
    }
  };

  if (!summary) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 rounded-full border-3 border-[#2C4A2E] border-t-transparent animate-spin" />
      </div>
    );
  }

  const monthlyStats: MonthlyFinancialStat[] = summary.monthlyStats || [];
  const weeklyStats: WeeklyDayStat[] = summary.weeklyStats || [];
  const dailyStats: DailyShiftStat[] = summary.dailyStats || [];

  const totalYearlyNet = monthlyStats.reduce((sum, m) => sum + m.netRevenue, 0);
  const totalYearlyGross = monthlyStats.reduce((sum, m) => sum + m.grossRevenue, 0);
  const totalYearlyOrders = monthlyStats.reduce((sum, m) => sum + m.ordersCount, 0);
  const totalYearlyProfit = monthlyStats.reduce((sum, m) => sum + m.grossProfit, 0);
  const totalYearlyDiscount = monthlyStats.reduce((sum, m) => sum + m.totalDiscount, 0);

  const totalWeeklyNet = weeklyStats.reduce((sum, w) => sum + w.netRevenue, 0);
  const totalWeeklyGross = weeklyStats.reduce((sum, w) => sum + w.grossRevenue, 0);
  const totalWeeklyOrders = weeklyStats.reduce((sum, w) => sum + w.ordersCount, 0);
  const totalWeeklyProfit = weeklyStats.reduce((sum, w) => sum + w.grossProfit, 0);
  const totalWeeklyDiscount = weeklyStats.reduce((sum, w) => sum + w.totalDiscount, 0);

  const totalDailyNet = dailyStats.reduce((sum, d) => sum + d.netRevenue, 0);
  const totalDailyGross = dailyStats.reduce((sum, d) => sum + d.grossRevenue, 0);
  const totalDailyOrders = dailyStats.reduce((sum, d) => sum + d.ordersCount, 0);
  const totalDailyProfit = dailyStats.reduce((sum, d) => sum + d.grossProfit, 0);
  const totalDailyDiscount = dailyStats.reduce((sum, d) => sum + d.totalDiscount, 0);

  return (
    <div className="space-y-8 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-50 p-4 rounded-2xl bg-[#2C4A2E] text-white text-xs sm:text-sm font-bold flex items-center gap-3 shadow-2xl border border-emerald-400/40 animate-in fade-in slide-in-from-bottom-4 no-print">
          <CheckCircle2 className="w-5 h-5 text-[#D4A373] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-5 border-b border-[#E6E1D5] no-print">
        <div>
          <div className="flex items-center gap-2.5 text-xs text-gray-500 mb-1">
            <Link href="/admin" className="hover:text-[#2C4A2E] font-semibold">
              پنل مدیریت
            </Link>
            <span>/</span>
            <span className="text-[#2C4A2E] font-bold">مدیریت مالی و گزارشات درآمدی</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-[#2C4A2E] tracking-tight">
              میز پایش و تراز مالی هوشمند
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200">
              <CalendarDays className="w-3.5 h-3.5 text-emerald-700" />
              <span>دوره فعال: {summary.selectedPeriodLabel || 'شهریور ۱۴۰۵'}</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 leading-relaxed">
            پایش آنلاین درآمد روزانه، هفتگی و ماهانه مزرعه، بررسی کانال‌های پرداخت و صدور آنی فاکتور رسمی
          </p>
        </div>

        {/* Action Button: Excel Export */}
        <div className="flex flex-wrap items-center gap-3 self-start lg:self-center">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#2C4A2E] hover:bg-[#1E3520] text-white text-xs sm:text-sm font-black shadow-farm hover:shadow-farm-hover transition-all cursor-pointer group"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#D4A373] group-hover:scale-110 transition-transform" />
            <span>دانلود فایل اکسل دوره فعال (CSV)</span>
          </button>
        </div>
      </div>

      {/* Primary Period Mode Switcher (پایش روزانه | پایش هفتگی | پایش ماهانه) */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-[#E6E1D5] shadow-farm space-y-4 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
            <TrendingUp className="w-4 h-4 text-[#2C4A2E]" />
            <span>بازه پایش عملکرد مالی:</span>
          </div>

          {/* 3 Main Mode Switcher Buttons (320px-safe responsive grid) */}
          <div className="grid grid-cols-3 sm:inline-flex gap-1 p-1 rounded-2xl bg-farm-bg border border-farm-border w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setPeriodMode('DAILY')}
              className={`flex items-center justify-center gap-1.5 px-2 sm:px-4 py-2 min-h-[40px] rounded-xl text-xs font-black transition-all cursor-pointer ${
                periodMode === 'DAILY'
                  ? 'bg-farm-primary text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
              }`}
            >
              <Clock className="w-3.5 h-3.5 shrink-0 hidden min-[380px]:block" />
              <span className="truncate">
                <span className="sm:hidden">روزانه</span>
                <span className="hidden sm:inline">پایش روزانه</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPeriodMode('WEEKLY')}
              className={`flex items-center justify-center gap-1.5 px-2 sm:px-4 py-2 min-h-[40px] rounded-xl text-xs font-black transition-all cursor-pointer ${
                periodMode === 'WEEKLY'
                  ? 'bg-farm-primary text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 shrink-0 hidden min-[380px]:block" />
              <span className="truncate">
                <span className="sm:hidden">هفتگی</span>
                <span className="hidden sm:inline">پایش هفتگی</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPeriodMode('MONTHLY')}
              className={`flex items-center justify-center gap-1.5 px-2 sm:px-4 py-2 min-h-[40px] rounded-xl text-xs font-black transition-all cursor-pointer ${
                periodMode === 'MONTHLY'
                  ? 'bg-farm-primary text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5 shrink-0 hidden min-[380px]:block" />
              <span className="truncate">
                <span className="sm:hidden">ماهانه</span>
                <span className="hidden sm:inline">پایش ماهانه</span>
              </span>
            </button>
          </div>
        </div>

        {/* Dynamic Sub-selector based on active Period Mode */}
        {periodMode === 'DAILY' && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold">پایش بلادرنگ امروز:</span>
              <span className="font-mono font-bold text-[#2C4A2E]">
                {new Date().toLocaleDateString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-gray-500 bg-[#F9F8F5] px-3 py-1.5 rounded-xl border border-gray-100">
              <span>شیفت‌های فعال ۴ گانه: تامین صبح، پردازش انبار، توزیع پیک عصر، سفارش‌های شبانه</span>
            </div>
          </div>
        )}

        {periodMode === 'WEEKLY' && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>انتخاب روز مشخص از هفته جاری جهت بررسی دقیق‌تر:</span>
              <span className="text-[11px] text-gray-400">چهارشنبه روز اصلی ارسال مرسولات شیراز</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
              <button
                onClick={() => setSelectedWeekday('ALL')}
                className={`px-3 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                  selectedWeekday === 'ALL'
                    ? 'bg-[#2C4A2E] text-white shadow-sm ring-2 ring-emerald-500/20'
                    : 'bg-[#F9F8F5] text-gray-700 hover:bg-gray-100 border border-gray-100'
                }`}
              >
                <span className="font-black">کل ۷ روز هفته</span>
                <span className={`text-[10px] ${selectedWeekday === 'ALL' ? 'text-emerald-200' : 'text-gray-400'}`}>
                  مجموع دوره
                </span>
              </button>

              {WEEKDAYS_LIST.map((w) => {
                const isSelected = selectedWeekday === w.name;
                const dayStat = weeklyStats.find((s) => s.dayName === w.name);
                const isToday = Boolean(dayStat?.isToday);

                return (
                  <button
                    key={w.name}
                    onClick={() => setSelectedWeekday(w.name)}
                    className={`px-3 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 relative ${
                      isSelected
                        ? 'bg-[#2C4A2E] text-white shadow-sm ring-2 ring-emerald-500/20'
                        : isToday
                        ? 'bg-emerald-50 text-emerald-900 border-2 border-emerald-300 hover:bg-emerald-100/70'
                        : 'bg-[#F9F8F5] text-gray-800 hover:bg-gray-100 border border-gray-100'
                    }`}
                  >
                    {isToday && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                    )}
                    <span className="font-black">{w.name}</span>
                    <span
                      className={`text-[9px] font-mono ${
                        isSelected ? 'text-emerald-200' : isToday ? 'text-emerald-700 font-bold' : 'text-gray-400'
                      }`}
                    >
                      {dayStat ? `${toPersianDigits(dayStat.ordersCount)} سفارش` : '-'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {periodMode === 'MONTHLY' && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>انتخاب ماه مالی سال ۱۴۰۵ جهت بررسی جزئیات و درآمد:</span>
              <span className="text-[11px] text-gray-400">شهریور ماه جاری با آمار لحظه‌ای متصل به درگاه</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 lg:grid-cols-13 gap-2">
              <button
                onClick={() => setSelectedMonth('ALL')}
                className={`px-3 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                  selectedMonth === 'ALL'
                    ? 'bg-[#2C4A2E] text-white shadow-md ring-2 ring-emerald-500/30'
                    : 'bg-[#F9F8F5] text-gray-700 hover:bg-gray-100 border border-gray-100'
                }`}
              >
                <span>کل سال</span>
                <span className={`text-[10px] font-normal ${selectedMonth === 'ALL' ? 'text-emerald-200' : 'text-gray-400'}`}>
                  ۱۴۰۵
                </span>
              </button>

              {PERSIAN_MONTHS.map((mName) => {
                const isSelected = selectedMonth === mName;
                const mStat = monthlyStats.find((s) => s.monthName === mName);
                const isCurrent = Boolean(mStat?.isCurrentMonth);
                const hasData = Boolean(mStat && mStat.ordersCount > 0);

                return (
                  <button
                    key={mName}
                    onClick={() => setSelectedMonth(mName)}
                    className={`px-3 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-1 relative ${
                      isSelected
                        ? 'bg-[#2C4A2E] text-white shadow-md ring-2 ring-emerald-500/30'
                        : isCurrent
                        ? 'bg-emerald-50 text-emerald-900 border-2 border-emerald-300 hover:bg-emerald-100/70'
                        : hasData
                        ? 'bg-[#F9F8F5] text-gray-800 hover:bg-gray-100 border border-gray-100'
                        : 'bg-gray-50/60 text-gray-400 hover:bg-gray-100 border border-transparent'
                    }`}
                  >
                    {isCurrent && (
                      <span className="absolute -top-1.5 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                    )}
                    <span className="font-black">{mName}</span>
                    <span
                      className={`text-[9px] font-mono ${
                        isSelected
                          ? 'text-emerald-200'
                          : isCurrent
                          ? 'text-emerald-700 font-bold'
                          : 'text-gray-400'
                      }`}
                    >
                      {hasData && mStat ? `${toPersianDigits(mStat.ordersCount)} سفارش` : 'بدون سفارش'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 4 Clean High-Value Executive KPI Cards (No Settlement Clutter) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 no-print">
        {/* KPI 1: Net Revenue (Hero Card) */}
        <div className="bg-gradient-to-bl from-[#2C4A2E] via-[#1E3520] to-[#142616] text-white rounded-3xl p-6 shadow-farm relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-200">
                خالص درآمد دوره ({summary.selectedPeriodLabel})
              </span>
              <div className="w-9 h-9 rounded-2xl bg-white/10 text-[#D4A373] flex items-center justify-center border border-white/10">
                <CircleDollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-black text-white tracking-tight">
              {formatToman(summary.netRevenue)}
            </div>
            <div className="flex items-center gap-2 text-xs text-[#F3E5AB]">
              <span className="font-bold">بر مبنای {toPersianDigits(summary.totalOrdersCount)} سفارش شاپرک</span>
              <span>•</span>
              <span>وصول خودکار در درگاه</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-emerald-200/90">
            <span>میانگین هر سفارش (AOV): {formatToman(summary.averageOrderValue)}</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-400/20">
              تایید شاپرک
            </span>
          </div>
        </div>

        {/* KPI 2: Total Orders & Traffic */}
        <div className="bg-white rounded-3xl p-6 border border-[#E6E1D5] shadow-farm space-y-3 relative group hover:border-[#2C4A2E]/40 transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[#2C4A2E]">
              <span className="text-xs font-bold text-gray-500">تعداد سفارشات تکمیل‌شده</span>
              <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5" />
              </div>
            </div>

            <div className="text-3xl font-black text-gray-900 mt-2">
              {toPersianDigits(summary.totalOrdersCount)}{' '}
              <span className="text-sm font-normal text-gray-500">سفارش</span>
            </div>

            <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
              <span>کرایه لجستیک شیراز:</span>
              <span className="font-bold text-gray-800">{formatToman(summary.totalShipping)}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100 text-[10px] text-gray-400 font-medium flex items-center justify-between">
            <span>درآمد اشتراک‌های فعال:</span>
            <span className="font-bold text-[#2C4A2E]">{formatToman(summary.subscriptionRevenue)}</span>
          </div>
        </div>

        {/* KPI 3: Gross Volume & Discounts */}
        <div className="bg-white rounded-3xl p-6 border border-[#E6E1D5] shadow-farm space-y-3 relative group hover:border-amber-400/50 transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[#2C4A2E]">
              <span className="text-xs font-bold text-gray-500">فروش ناخالص و تخفیف‌ها</span>
              <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center">
                <Percent className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-gray-900 mt-2">
              {formatToman(summary.grossRevenue)}
            </div>
            <div className="text-xs text-amber-700 font-bold mt-1">
              تخفیف اعطا شده: -{formatToman(summary.totalDiscount)}
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100 text-[10px] text-gray-400">
            شامل تخفیف‌های ویژه پرو/پلاس و کدهای تبلیغاتی
          </div>
        </div>

        {/* KPI 4: Gross Profit & Farm Margin */}
        <div className="bg-emerald-950 text-white rounded-3xl p-6 shadow-farm space-y-3 relative border border-emerald-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-white">
              <span className="text-xs font-bold text-emerald-300">سود ناخالص و حاشیه سود</span>
              <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-black">
                {toPersianDigits(summary.profitMarginPercent ?? 0)}٪ مارجین
              </span>
            </div>
            <div className="text-2xl font-black text-emerald-300 mt-2">
              {formatToman(summary.grossProfit || 0)}
            </div>
          </div>

          <div className="pt-2 border-t border-emerald-900 text-[10px] text-emerald-300/70 font-medium">
            بهای خرید از کشاورزان: {formatToman(summary.totalCost || 0)}
          </div>
        </div>
      </div>

      {/* DETAILED PERIOD BREAKDOWN TABLES (Replaces charts completely) */}

      {/* 1. DAILY SHIFTS TABLE (Shown when DAILY mode is active) */}
      {periodMode === 'DAILY' && (
        <div className="bg-white rounded-3xl border border-[#E6E1D5] shadow-farm overflow-hidden p-6 space-y-4 no-print">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
            <div>
              <h3 className="text-base sm:text-lg font-black text-[#2C4A2E] flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#D4A373]" />
                <span>پایش تفکیکی شیفت‌ها و ساعات کاری امروز مزرعه</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                بررسی حجم سفارشات، فروش ناخالص، درآمد خالص و محصول پرفروش در هر بازه زمانی ۴ گانه روز
              </p>
            </div>

            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 self-start sm:self-auto">
              توزیع زمانی امروز: {toPersianDigits(totalDailyOrders)} سفارش موفق
            </span>
          </div>

          {totalDailyOrders === 0 ? (
            <div className="p-8 rounded-2xl bg-[#F9F8F5] border border-dashed border-[#E6E1D5] text-center space-y-1.5">
              <p className="text-sm font-bold text-gray-700">هنوز سفارش پرداخت‌شده‌ای در شیفت‌های امروز ثبت نشده است.</p>
              <p className="text-xs text-gray-500">آمار واقعی به محض تسویه سفارش‌های جدید یا تحویل سفارش‌های پرداخت در محل در این جدول نمایش داده می‌شود.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
              <thead className="bg-[#F9F8F5] border-b border-[#E6E1D5] text-[#2C4A2E]">
                <tr>
                  <th className="py-3.5 px-4 font-black">شیفت کاری</th>
                  <th className="py-3.5 px-4 font-black text-center">تعداد سفارشات</th>
                  <th className="py-3.5 px-4 font-black">فروش ناخالص (تومان)</th>
                  <th className="py-3.5 px-4 font-black">تخفیف اعطا شده</th>
                  <th className="py-3.5 px-4 font-black">درآمد خالص دریافتی (تومان)</th>
                  <th className="py-3.5 px-4 font-black">سود ناخالص</th>
                  <th className="py-3.5 px-4 font-black">میانگین سبد (AOV)</th>
                  <th className="py-3.5 px-4 font-black">محصول شاخص شیفت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dailyStats.map((shift, idx) => {
                  const icons = [
                    <Sunrise key="1" className="w-4 h-4 text-amber-500 inline mr-1" />,
                    <Sun key="2" className="w-4 h-4 text-amber-600 inline mr-1" />,
                    <Sunset key="3" className="w-4 h-4 text-orange-500 inline mr-1" />,
                    <Moon key="4" className="w-4 h-4 text-indigo-500 inline mr-1" />,
                  ];

                  return (
                    <tr key={shift.shiftName} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-gray-900 flex items-center gap-2">
                        {icons[idx % icons.length]}
                        <span>{shift.shiftName}</span>
                      </td>

                      <td className="py-3.5 px-4 text-center font-bold text-[#2C4A2E]">
                        {toPersianDigits(shift.ordersCount)}
                      </td>

                      <td className="py-3.5 px-4 text-gray-700">
                        {formatToman(shift.grossRevenue)}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-amber-700">
                        {shift.totalDiscount > 0 ? `-${formatToman(shift.totalDiscount)}` : '۰ تومان'}
                      </td>

                      <td className="py-3.5 px-4 font-black text-[#2C4A2E] text-sm">
                        {formatToman(shift.netRevenue)}
                      </td>

                      <td className="py-3.5 px-4 text-emerald-800 font-bold">
                        {formatToman(shift.grossProfit)}
                      </td>

                      <td className="py-3.5 px-4 text-gray-600">
                        {formatToman(shift.averageOrderValue)}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 text-[11px] font-bold">
                          {shift.topProduct || 'محصولات عمومی'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-300 font-black text-gray-900 text-xs">
                <tr>
                  <td className="py-3 px-4">مجموع عملکرد امروز مزرعه:</td>
                  <td className="py-3 px-4 text-center text-[#2C4A2E]">
                    {toPersianDigits(totalDailyOrders)} سفارش
                  </td>
                  <td className="py-3 px-4 text-gray-800">
                    {formatToman(totalDailyGross)}
                  </td>
                  <td className="py-3 px-4 text-amber-700">
                    -{formatToman(totalDailyDiscount)}
                  </td>
                  <td className="py-3 px-4 text-[#2C4A2E] text-sm">
                    {formatToman(totalDailyNet)}
                  </td>
                  <td className="py-3 px-4 text-emerald-800">
                    {formatToman(totalDailyProfit)}
                  </td>
                  <td colSpan={2} className="py-3 px-4 text-left text-gray-500 text-[11px]">
                    تسویه خودکار در حساب‌های شاپرک
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          )}
        </div>
      )}

      {/* 2. WEEKLY 7-DAY TABLE (Shown when WEEKLY mode is active) */}
      {periodMode === 'WEEKLY' && (
        <div className="bg-white rounded-3xl border border-[#E6E1D5] shadow-farm overflow-hidden p-6 space-y-4 no-print">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
            <div>
              <h3 className="text-base sm:text-lg font-black text-[#2C4A2E] flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#D4A373]" />
                <span>جدول صورت و پایش مالی ۷ روز هفته جاری</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                بررسی میزان فروش، تعداد سفارشات، میانگین سبد خرید و درگاه‌های پرداخت در هر یک از روزهای هفته
              </p>
            </div>

            <span className="text-xs font-bold text-gray-600 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 self-start sm:self-auto">
              مجموع هفته: {toPersianDigits(totalWeeklyOrders)} سفارش
            </span>
          </div>

          {totalWeeklyOrders === 0 ? (
            <div className="p-8 rounded-2xl bg-[#F9F8F5] border border-dashed border-[#E6E1D5] text-center space-y-1.5">
              <p className="text-sm font-bold text-gray-700">هنوز سفارش پرداخت‌شده‌ای در هفته جاری ثبت نشده است.</p>
              <p className="text-xs text-gray-500">آمار واقعی روزهای هفته به محض ثبت و پرداخت سفارش‌های جدید نمایش داده می‌شود.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
              <thead className="bg-[#F9F8F5] border-b border-[#E6E1D5] text-[#2C4A2E]">
                <tr>
                  <th className="py-3.5 px-4 font-black">روز هفته</th>
                  <th className="py-3.5 px-4 font-black">تاریخ تقویمی</th>
                  <th className="py-3.5 px-4 font-black text-center">تعداد سفارشات</th>
                  <th className="py-3.5 px-4 font-black">فروش ناخالص (تومان)</th>
                  <th className="py-3.5 px-4 font-black">تخفیف اعطا شده</th>
                  <th className="py-3.5 px-4 font-black">درآمد خالص دریافتی (تومان)</th>
                  <th className="py-3.5 px-4 font-black">سود ناخالص</th>
                  <th className="py-3.5 px-4 font-black">میانگین سبد (AOV)</th>
                  <th className="py-3.5 px-4 font-black">درگاه پرکاربرد</th>
                  <th className="py-3.5 px-4 font-black text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {weeklyStats.map((w) => {
                  const isSelected = selectedWeekday === w.dayName;
                  const isToday = w.isToday;

                  return (
                    <tr
                      key={w.dayName}
                      onClick={() => setSelectedWeekday(w.dayName)}
                      className={`transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50/90 font-semibold'
                          : isToday
                          ? 'bg-amber-50/40 hover:bg-amber-50/80'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-gray-900">{w.dayName}</span>
                          {isToday && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[9px] font-bold">
                              امروز
                            </span>
                          )}
                          {isSelected && (
                            <span className="px-2 py-0.5 rounded-md bg-[#2C4A2E] text-white text-[9px] font-bold">
                              انتخاب‌شده
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-gray-500">
                        {toPersianDigits(w.date)}
                      </td>

                      <td className="py-3 px-4 text-center font-bold text-gray-800">
                        {toPersianDigits(w.ordersCount)}
                      </td>

                      <td className="py-3 px-4 text-gray-700">
                        {formatToman(w.grossRevenue)}
                      </td>

                      <td className="py-3 px-4 font-bold text-amber-700">
                        {w.totalDiscount > 0 ? `-${formatToman(w.totalDiscount)}` : '۰ تومان'}
                      </td>

                      <td className="py-3 px-4 font-black text-[#2C4A2E] text-sm">
                        {formatToman(w.netRevenue)}
                      </td>

                      <td className="py-3 px-4 text-emerald-800 font-bold">
                        {formatToman(w.grossProfit)}
                      </td>

                      <td className="py-3 px-4 text-gray-600">
                        {formatToman(w.averageOrderValue)}
                      </td>

                      <td className="py-3 px-4 text-gray-600 text-[11px]">
                        {w.topGateway || 'شاپرک'}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedWeekday(w.dayName);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#2C4A2E] text-white shadow-xs'
                              : 'bg-white border border-[#E6E1D5] text-[#2C4A2E] hover:bg-emerald-50'
                          }`}
                        >
                          {isSelected ? 'در حال پایش' : 'مشاهده روز'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-300 font-black text-gray-900 text-xs">
                <tr>
                  <td colSpan={2} className="py-3 px-4">
                    مجموع عملکرد ۷ روز هفته جاری:
                  </td>
                  <td className="py-3 px-4 text-center text-[#2C4A2E]">
                    {toPersianDigits(totalWeeklyOrders)} سفارش
                  </td>
                  <td className="py-3 px-4 text-gray-800">
                    {formatToman(totalWeeklyGross)}
                  </td>
                  <td className="py-3 px-4 text-amber-700">
                    -{formatToman(totalWeeklyDiscount)}
                  </td>
                  <td className="py-3 px-4 text-[#2C4A2E] text-sm">
                    {formatToman(totalWeeklyNet)}
                  </td>
                  <td className="py-3 px-4 text-emerald-800">
                    {formatToman(totalWeeklyProfit)}
                  </td>
                  <td colSpan={2} className="py-3 px-4 text-left text-gray-500 text-[11px]">
                    شاپرک متصل به حساب تجاری
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          )}
        </div>
      )}

      {/* 3. MONTHLY 12-MONTH TABLE (Shown when MONTHLY mode is active) */}
      {periodMode === 'MONTHLY' && (
        <div className="bg-white rounded-3xl border border-[#E6E1D5] shadow-farm overflow-hidden p-6 space-y-4 no-print">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
            <div>
              <h3 className="text-base sm:text-lg font-black text-[#2C4A2E] flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-[#D4A373]" />
                <span>جدول صورت مالی و مقایسه تفکیکی ماه‌های سال ۱۴۰۵</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                نمایش میزان فروش ناخالص، خالص دریافتی، تعداد تراکنش‌ها و سود به تفکیک ۱۲ ماه سال (جهت فیلتر روی هر ماه کلیک کنید)
              </p>
            </div>

            <span className="text-xs font-bold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 self-start sm:self-auto">
              سال مالی ۱۴۰۵ پروفارم شیراز
            </span>
          </div>

          {totalYearlyOrders === 0 ? (
            <div className="p-8 rounded-2xl bg-[#F9F8F5] border border-dashed border-[#E6E1D5] text-center space-y-1.5">
              <p className="text-sm font-bold text-gray-700">هنوز سفارش پرداخت‌شده‌ای در سال مالی جاری ثبت نشده است.</p>
              <p className="text-xs text-gray-500">آمار واقعی ماهانه پس از تایید پرداخت یا تحویل سفارش‌های پرداخت در محل محاسبه می‌شود.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
              <thead className="bg-[#F9F8F5] border-b border-[#E6E1D5] text-[#2C4A2E]">
                <tr>
                  <th className="py-3.5 px-4 font-black">ردیف</th>
                  <th className="py-3.5 px-4 font-black">ماه مالی</th>
                  <th className="py-3.5 px-4 font-black text-center">تعداد سفارشات</th>
                  <th className="py-3.5 px-4 font-black">فروش ناخالص (تومان)</th>
                  <th className="py-3.5 px-4 font-black">تخفیف اعطا شده</th>
                  <th className="py-3.5 px-4 font-black">درآمد خالص دریافتی (تومان)</th>
                  <th className="py-3.5 px-4 font-black">سود ناخالص</th>
                  <th className="py-3.5 px-4 font-black">میانگین سبد (AOV)</th>
                  <th className="py-3.5 px-4 font-black">درگاه اصلی پرداخت</th>
                  <th className="py-3.5 px-4 font-black text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {monthlyStats.map((m) => {
                  const isSelected = selectedMonth === m.monthName;
                  const isCurrent = m.isCurrentMonth;
                  const hasOrders = m.ordersCount > 0;

                  return (
                    <tr
                      key={m.monthIndex}
                      onClick={() => setSelectedMonth(m.monthName)}
                      className={`transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50/90 font-semibold'
                          : isCurrent
                          ? 'bg-amber-50/40 hover:bg-amber-50/80'
                          : hasOrders
                          ? 'hover:bg-gray-50'
                          : 'opacity-60 hover:opacity-100 hover:bg-gray-50/50'
                      }`}
                    >
                      <td className="py-3 px-4 font-mono text-gray-500">
                        {toPersianDigits(m.monthIndex)}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-gray-900">{m.monthName}</span>
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[9px] font-bold">
                              ماه جاری
                            </span>
                          )}
                          {isSelected && (
                            <span className="px-2 py-0.5 rounded-md bg-[#2C4A2E] text-white text-[9px] font-bold">
                              انتخاب‌شده
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center font-bold text-gray-800">
                        {hasOrders ? toPersianDigits(m.ordersCount) : '-'}
                      </td>

                      <td className="py-3 px-4 text-gray-700">
                        {hasOrders ? formatToman(m.grossRevenue) : '-'}
                      </td>

                      <td className="py-3 px-4 font-bold text-amber-700">
                        {m.totalDiscount > 0 ? `-${formatToman(m.totalDiscount)}` : hasOrders ? '۰ تومان' : '-'}
                      </td>

                      <td className="py-3 px-4 font-black text-[#2C4A2E] text-sm">
                        {hasOrders ? formatToman(m.netRevenue) : '-'}
                      </td>

                      <td className="py-3 px-4 text-emerald-800 font-bold">
                        {hasOrders ? formatToman(m.grossProfit) : '-'}
                      </td>

                      <td className="py-3 px-4 text-gray-600">
                        {hasOrders ? formatToman(m.averageOrderValue) : '-'}
                      </td>

                      <td className="py-3 px-4 text-gray-600 text-[11px]">
                        {hasOrders ? m.topGateway : 'دوره آینده'}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMonth(m.monthName);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#2C4A2E] text-white shadow-xs'
                              : 'bg-white border border-[#E6E1D5] text-[#2C4A2E] hover:bg-emerald-50'
                          }`}
                        >
                          {isSelected ? 'در حال پایش' : 'مشاهده جزئیات'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-300 font-black text-gray-900 text-xs">
                <tr>
                  <td colSpan={2} className="py-3 px-4">
                    مجموع عملکرد ۱۲ ماه سال مالی ۱۴۰۵:
                  </td>
                  <td className="py-3 px-4 text-center text-[#2C4A2E]">
                    {toPersianDigits(totalYearlyOrders)} سفارش
                  </td>
                  <td className="py-3 px-4 text-gray-800">
                    {formatToman(totalYearlyGross)}
                  </td>
                  <td className="py-3 px-4 text-amber-700">
                    -{formatToman(totalYearlyDiscount)}
                  </td>
                  <td className="py-3 px-4 text-[#2C4A2E] text-sm">
                    {formatToman(totalYearlyNet)}
                  </td>
                  <td className="py-3 px-4 text-emerald-800">
                    {formatToman(totalYearlyProfit)}
                  </td>
                  <td colSpan={2} className="py-3 px-4 text-left text-gray-500 text-[11px]">
                    وصول مستقیم در کلیه درگاه‌های بانکی
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          )}
        </div>
      )}

      {/* Breakdown Section: Payment Channels & Subscription Tier Share (Grid 2 cols) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 no-print">
        {/* Payment Gateways Distribution Card */}
        <div className="bg-white rounded-3xl p-6 border border-[#E6E1D5] shadow-farm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h3 className="font-bold text-sm text-[#2C4A2E]">
                تفکیک کانال‌های پرداخت و درگاه‌ها ({summary.selectedPeriodLabel})
              </h3>
              <p className="text-[11px] text-gray-400">سهم نقدینگی هر یک از درگاه‌های آنلاین و پوز شیراز</p>
            </div>
            <CreditCard className="w-4 h-4 text-[#2C4A2E]" />
          </div>

          <div className="space-y-3.5">
            {(summary.gatewayBreakdown || []).length === 0 ? (
              <div className="py-6 px-4 rounded-2xl bg-[#F9F8F5] border border-dashed border-[#E6E1D5] text-center text-xs text-gray-500">
                تراکنش پرداخت‌شده‌ای در این بازه زمانی برای نمایش سهم درگاه‌ها وجود ندارد.
              </div>
            ) : (
              (summary.gatewayBreakdown || []).map((gw) => (
                <div key={gw.gateway} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-gray-800 truncate max-w-[220px]">{gw.label}</span>
                    <span className="text-[#2C4A2E]">{toPersianDigits(gw.percentage)}٪</span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-700 transition-all"
                      style={{ width: `${gw.percentage > 0 ? Math.max(8, gw.percentage) : 0}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-500">
                    <span>{formatToman(gw.totalAmount)}</span>
                    <span>{toPersianDigits(gw.count)} تراکنش</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Subscription Tier Share Card */}
        <div className="bg-white rounded-3xl p-6 border border-[#E6E1D5] shadow-farm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h3 className="font-bold text-sm text-[#2C4A2E]">
                سهم درآمد بر اساس سطح عضویت ({summary.selectedPeriodLabel})
              </h3>
              <p className="text-[11px] text-gray-400">درآمد حاصل از مشترکین پرو، پلاس و خریداران عادی</p>
            </div>
            <Crown className="w-4 h-4 text-[#D4A373]" />
          </div>

          <div className="space-y-3.5">
            {summary.totalOrdersCount === 0 ? (
              <div className="py-6 px-4 rounded-2xl bg-[#F9F8F5] border border-dashed border-[#E6E1D5] text-center text-xs text-gray-500">
                سفارش پرداخت‌شده‌ای در این بازه زمانی برای تفکیک سطوح کاربری وجود ندارد.
              </div>
            ) : (
              summary.tierRevenues.map((t) => (
                <div key={t.tier} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-gray-800 flex items-center gap-1.5">
                      {t.tier === 'PRO' && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                      {t.tier === 'PLUS' && <Zap className="w-3.5 h-3.5 text-emerald-600" />}
                      <span>{t.label}</span>
                    </span>
                    <span className="text-[#2C4A2E]">{toPersianDigits(t.percentage)}٪</span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        t.tier === 'PRO'
                          ? 'bg-amber-500'
                          : t.tier === 'PLUS'
                          ? 'bg-emerald-600'
                          : 'bg-gray-400'
                      }`}
                      style={{ width: `${t.percentage > 0 ? Math.max(8, t.percentage) : 0}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-500">
                    <span>{formatToman(t.revenue)}</span>
                    <span>{toPersianDigits(t.ordersCount)} سفارش</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Transaction Ledger Table (No Settlement Filter / Toggle / Badge) */}
      <div className="bg-white rounded-3xl border border-[#E6E1D5] shadow-farm overflow-hidden space-y-4 p-6 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-black text-[#2C4A2E]">
              دفتر کل تراکنش‌های {summary.selectedPeriodLabel}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              رهگیری کدهای شاپرک، بررسی سفارش‌های مشتریان و صدور فاکتور رسمی مالیاتی
            </p>
          </div>

          {/* Search & Tier Filter Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute right-3 top-3" />
              <input
                type="text"
                placeholder="جستجو سفارش، نام، تلفن..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-9 pl-4 py-2 rounded-xl border border-[#E6E1D5] text-xs bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E] w-56 sm:w-64"
              />
            </div>

            {/* Membership Tier Filter */}
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value as 'ALL' | SubscriptionTier)}
              className="px-3 py-2 rounded-xl border border-[#E6E1D5] text-xs bg-[#F9F8F5] font-bold text-gray-800 focus:outline-none focus:border-[#2C4A2E] cursor-pointer"
            >
              <option value="ALL">همه سطوح کاربری</option>
              <option value="PRO">فقط طلایی پرو</option>
              <option value="PLUS">فقط نقره‌ای پلاس</option>
              <option value="FREE">کاربران عادی</option>
            </select>
          </div>
        </div>

        {/* Clean Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-[#F9F8F5] border-b border-[#E6E1D5] text-[#2C4A2E]">
              <tr>
                <th className="py-3.5 px-4 font-black">شماره سفارش</th>
                <th className="py-3.5 px-4 font-black">تاریخ و زمان ثبت</th>
                <th className="py-3.5 px-4 font-black">مشتری</th>
                <th className="py-3.5 px-4 font-black">مبلغ خالص پرداختی</th>
                <th className="py-3.5 px-4 font-black">تخفیف اعطا شده</th>
                <th className="py-3.5 px-4 font-black">درگاه و کانال پرداخت</th>
                <th className="py-3.5 px-4 font-black">کد رهگیری شاپرک</th>
                <th className="py-3.5 px-4 font-black text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500">
                    هیچ رکورد مالی با مشخصات انتخابی در این بازه یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  return (
                    <tr key={rec.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-[#2C4A2E]">
                        {rec.orderNumber}
                      </td>

                      <td className="py-3.5 px-4 text-gray-600">
                        {new Date(rec.createdAt).toLocaleDateString('fa-IR')}
                        <span className="block text-[10px] text-gray-400">
                          {new Date(rec.createdAt).toLocaleTimeString('fa-IR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900">{rec.customerName}</div>
                        <div className="text-[10px] text-gray-400">{toPersianDigits(rec.customerPhone)}</div>
                      </td>

                      <td className="py-3.5 px-4 font-black text-[#2C4A2E] text-sm">
                        {formatToman(rec.netPayableAmount)}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-amber-700">
                        {rec.discountAmount > 0 ? `-${formatToman(rec.discountAmount)}` : '۰ تومان'}
                      </td>

                      <td className="py-3.5 px-4 text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="truncate max-w-[140px]">{rec.paymentGateway}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-mono text-[11px] font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded-lg">
                          {rec.settlementRef || `SHP-${rec.orderNumber.replace(/[^0-9]/g, '').slice(-6)}`}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleOpenInvoice(rec)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold transition-colors cursor-pointer"
                        >
                          <Receipt className="w-3.5 h-3.5 text-emerald-700" />
                          <span>فاکتور رسمی</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Ledger Footer Summary */}
        <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-bold text-gray-700">
          <div>
            نمایش <strong>{toPersianDigits(filteredRecords.length)}</strong> رکورد از مجموع{' '}
            <strong>{toPersianDigits(records.length)}</strong> تراکنش {summary.selectedPeriodLabel}
          </div>

          <div className="flex items-center gap-4">
            <span className="text-gray-500">مجموع مبالغ لیست فعلی:</span>
            <span className="text-base font-black text-[#2C4A2E]">
              {formatToman(filteredRecords.reduce((sum, r) => sum + r.netPayableAmount, 0))}
            </span>
          </div>
        </div>
      </div>

      {/* Official Persian Tax Invoice Modal (Native <dialog>) */}
      <Dialog
        open={Boolean(isInvoiceOpen && selectedInvoiceRecord)}
        onClose={() => setIsInvoiceOpen(false)}
        title="پیش‌نمایش صورتحساب رسمی فروش کالا (دارایی)"
        icon={<Receipt className="w-5 h-5 text-farm-gold-text" />}
        size="3xl"
        headerActions={
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-farm-primary text-white text-xs font-bold hover:bg-farm-primary-dark transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>چاپ فاکتور (A4)</span>
          </button>
        }
      >
        {selectedInvoiceRecord && (
            <div className="border-2 border-gray-800 rounded-2xl p-6 sm:p-8 space-y-6 bg-white text-gray-900 printable-invoice">
              {/* Header Box */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-gray-800">
                <div className="space-y-1">
                  <h2 className="text-xl font-black text-gray-900">
                    صورتحساب فروش کالا و خدمات
                  </h2>
                  <p className="text-xs text-gray-600">شرکت کشت و صنعت سلامت‌محور پروفارم شیراز (سهامی خاص)</p>
                </div>

                <div className="text-left text-xs space-y-1 font-mono">
                  <div>
                    <span className="text-gray-500 font-sans">شماره سریال فاکتور:</span>{' '}
                    <strong>{selectedInvoiceRecord.orderNumber}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500 font-sans">تاریخ صدور:</span>{' '}
                    <strong>{new Date(selectedInvoiceRecord.createdAt).toLocaleDateString('fa-IR')}</strong>
                  </div>
                </div>
              </div>

              {/* Seller & Buyer Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Seller Box */}
                <div className="p-4 rounded-xl border border-gray-300 bg-gray-50/50 space-y-1">
                  <div className="font-black text-gray-900 border-b border-gray-200 pb-1 mb-2 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-[#2C4A2E]" />
                    <span>مشخصات فروشنده:</span>
                  </div>
                  <div><strong>نام شخص حقوقی:</strong> شرکت کشت و صنعت پروفارم شیراز</div>
                  <div><strong>شناسه ملی:</strong> ۱۰۸۶۰۱۲۳۴۵۶ | <strong>کد اقتصادی:</strong> ۴۱۱۵۶۷۸۹۱۲۳۴</div>
                  <div><strong>نشانی:</strong> استان فارس، شیراز، بلوار ارم، مجتمع پروفارم</div>
                  <div><strong>تلفن پشتیبانی و پیگیری:</strong> {SITE_CONFIG.contact.supportPhoneDisplay}</div>
                </div>

                {/* Buyer Box */}
                <div className="p-4 rounded-xl border border-gray-300 bg-gray-50/50 space-y-1">
                  <div className="font-black text-gray-900 border-b border-gray-200 pb-1 mb-2">
                    مشخصات خریدار:
                  </div>
                  <div><strong>نام خریدار:</strong> {selectedInvoiceRecord.customerName}</div>
                  <div><strong>شماره تماس:</strong> {toPersianDigits(selectedInvoiceRecord.customerPhone)}</div>
                  <div><strong>مقصد تحویل:</strong> استان فارس، شهر شیراز</div>
                  <div>
                    <strong>سطح اشتراک:</strong>{' '}
                    {selectedInvoiceRecord.customerTier === 'PRO'
                      ? 'عضو طلایی پرو (PRO)'
                      : selectedInvoiceRecord.customerTier === 'PLUS'
                      ? 'عضو نقره‌ای پلاس (PLUS)'
                      : 'مشتری عادی'}
                  </div>
                </div>
              </div>

              {/* Invoice Breakdown Table */}
              <div className="border border-gray-300 rounded-xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-gray-100 border-b border-gray-300 font-black text-gray-800">
                    <tr>
                      <th className="py-2.5 px-3">ردیف</th>
                      <th className="py-2.5 px-3">شرح کالا یا خدمات ارگانیک</th>
                      <th className="py-2.5 px-3">تعداد</th>
                      <th className="py-2.5 px-3">مبلغ ناخالص (تومان)</th>
                      <th className="py-2.5 px-3">تخفیف (تومان)</th>
                      <th className="py-2.5 px-3">مبلغ نهایی (تومان)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="py-2.5 px-3">۱</td>
                      <td className="py-2.5 px-3 font-medium">
                        مجموع محصولات ارگانیک مزرعه طبق سفارش {selectedInvoiceRecord.orderNumber}
                      </td>
                      <td className="py-2.5 px-3">{toPersianDigits(selectedInvoiceRecord.itemCount)}</td>
                      <td className="py-2.5 px-3">{formatToman(selectedInvoiceRecord.grossAmount)}</td>
                      <td className="py-2.5 px-3 text-amber-700">
                        {selectedInvoiceRecord.discountAmount > 0
                          ? `-${formatToman(selectedInvoiceRecord.discountAmount)}`
                          : '۰'}
                      </td>
                      <td className="py-2.5 px-3 font-bold">
                        {formatToman(selectedInvoiceRecord.grossAmount - selectedInvoiceRecord.discountAmount)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3">۲</td>
                      <td className="py-2.5 px-3 font-medium">
                        خدمات لجستیک و توزیع با پیک اختصاصی پروفارم شیراز
                      </td>
                      <td className="py-2.5 px-3">۱</td>
                      <td className="py-2.5 px-3">{formatToman(selectedInvoiceRecord.shippingFee)}</td>
                      <td className="py-2.5 px-3 text-gray-500">۰</td>
                      <td className="py-2.5 px-3 font-bold">{formatToman(selectedInvoiceRecord.shippingFee)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Invoice Totals Box */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-gray-50 border border-gray-300 text-xs">
                <div className="space-y-1 text-gray-600">
                  <div>
                    <strong>روش و درگاه پرداخت:</strong> {selectedInvoiceRecord.paymentGateway}
                  </div>
                  <div>
                    <strong>کد رهگیری شاپرک:</strong>{' '}
                    <span className="font-mono font-bold text-gray-800">
                      {selectedInvoiceRecord.settlementRef || `SHP-${selectedInvoiceRecord.orderNumber.replace(/[^0-9]/g, '').slice(-6)}`}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-500">
                    * محصولات خام کشاورزی مطابق ماده ۹ قانون مالیات بر ارزش افزوده از مالیات معاف می‌باشند.
                  </div>
                </div>

                <div className="text-left space-y-1">
                  <div className="text-gray-600">
                    جمع کل قابل پرداخت:
                  </div>
                  <div className="text-xl font-black text-[#2C4A2E]">
                    {formatToman(selectedInvoiceRecord.netPayableAmount)}
                  </div>
                </div>
              </div>

              {/* Signature & Stamp Boxes */}
              <div className="grid grid-cols-2 gap-6 pt-6 border-t border-gray-200 text-xs text-center text-gray-600">
                <div className="h-24 border border-dashed border-gray-300 rounded-xl p-3 flex flex-col justify-between">
                  <span>امضای خریدار / گیرنده مرسوله:</span>
                  <span className="text-[10px] text-gray-400">صحت سفارش و سلامت فیزیکی بار تایید شد</span>
                </div>

                <div className="h-24 border border-dashed border-gray-300 rounded-xl p-3 flex flex-col justify-between">
                  <span>مهر و امضای امور مالی شرکت پروفارم:</span>
                  <span className="text-[10px] text-emerald-800 font-bold">✓ تایید تراکنش شاپرک</span>
                </div>
              </div>
            </div>
        )}
      </Dialog>
    </div>
  );
}
