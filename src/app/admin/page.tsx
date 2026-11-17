'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  ShoppingBag,
  Truck,
  Crown,
  Package,
  Calendar,
  ArrowLeft,
  Clock,
  CheckCircle2,
  Users,
  Eye,
  Activity,
  Globe,
  CircleDollarSign,
  FileSpreadsheet,
  TicketPercent,
  CreditCard,
  AlertTriangle,
  RotateCcw,
  MessageSquare,
  Plus,
  Percent,
  Sparkles,
  X,
} from 'lucide-react';
import { farmStore } from '@/lib/db-store';
import { formatToman, toPersianDigits } from '@/lib/formatters';
import { getOrderStatusMeta } from '@/lib/site-config';
import { isCountableSaleOrder } from '@/lib/order-utils';
import { Order, FinancialSummary, Product, ReturnRequest } from '@/types';
import { SalesChart } from '@/components/admin/SalesChart';

export default function AdminOverviewPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [salesData, setSalesData] = useState<{ day: string; amount: number; orderCount: number }[]>([]);
  const [finSummary, setFinSummary] = useState<FinancialSummary | null>(null);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Custom restock state for dashboard
  const [restockAmounts, setRestockAmounts] = useState<Record<string, number>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedModalProductId, setSelectedModalProductId] = useState<string>('');
  const [modalAmount, setModalAmount] = useState<number>(10);

  const refreshData = () => {
    setOrders(farmStore.getOrders());
    setSalesData(farmStore.getWeeklySalesData());
    setFinSummary(farmStore.getFinancialSummary());
    setLowStockProducts(farmStore.getLowStockProducts(5));
    const prods = farmStore.getProducts();
    setAllProducts(prods);
    if (prods.length > 0 && !selectedModalProductId) {
      setSelectedModalProductId(prods[0].id);
    }
    setReturnRequests(farmStore.getReturnRequests());
  };

  useEffect(() => {
    refreshData();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleCustomRestock = (prodId: string, customAmount?: number) => {
    const amount = customAmount !== undefined ? customAmount : (restockAmounts[prodId] ?? 10);
    if (!amount || amount <= 0) {
      showToast('لطفاً یک مقدار معتبر (بزرگتر از صفر) جهت افزایش موجودی وارد نمایید.');
      return;
    }
    const prod = farmStore.getProductBySlug(prodId);
    if (prod) {
      const newStock = (prod.stock || 0) + amount;
      farmStore.updateProductStock(prodId, newStock);
      refreshData();
      showToast(`موجودی «${prod.title}» با موفقیت ${toPersianDigits(amount)} عدد افزایش یافت. (موجودی فعلی: ${toPersianDigits(newStock)} عدد)`);
    }
  };

  const handleModalRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedModalProductId) return;
    const amount = Number(modalAmount);
    if (isNaN(amount) || amount <= 0) {
      showToast('لطفاً مقداری معتبر و بزرگتر از صفر برای افزایش موجودی وارد کنید.');
      return;
    }
    const prod = farmStore.getProductBySlug(selectedModalProductId);
    if (prod) {
      const newStock = (prod.stock || 0) + amount;
      farmStore.updateProductStock(selectedModalProductId, newStock);
      refreshData();
      setIsModalOpen(false);
      showToast(`موجودی «${prod.title}» با موفقیت ${toPersianDigits(amount)} عدد افزایش یافت. (موجودی جدید: ${toPersianDigits(newStock)} عدد)`);
    }
  };

  const paidOrders = orders.filter(isCountableSaleOrder);
  const totalRevenue = finSummary?.netRevenue ?? paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const processingCount = orders.filter((o) => o.status === 'PROCESSING').length;
  const outForDeliveryCount = orders.filter((o) => o.status === 'OUT_FOR_DELIVERY').length;
  const users = farmStore.getAllUsers();
  const proUsersCount = users.filter((u) => u.tier === 'PRO' || u.isProMember).length;
  const plusUsersCount = users.filter((u) => u.tier === 'PLUS').length;
  const visits = farmStore.getSiteVisits();
  const pendingReturns = returnRequests.filter((r) => r.status === 'PENDING').length;

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-5 left-5 z-50 bg-[#2C4A2E] text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Title */}
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-[#2C4A2E]">
          داشبورد مدیریت و مرکز فرماندهی مزارع شیراز
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          پایش لحظه‌ای موجودی انبار، آمار فروش و سود ناخالص، توزیع پیک شیراز و امور مشتریان
        </p>
      </div>

      {/* Executive Quick Actions Command Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* 1. Returns */}
        <Link
          href="/admin/returns"
          className="flex items-center gap-2.5 p-3 rounded-2xl bg-white border border-[#E6E1D5] hover:border-[#2C4A2E] hover:shadow-md transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-gray-900 truncate">مرجوعی‌ها</span>
              {pendingReturns > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black">
                  {toPersianDigits(pendingReturns)}
                </span>
              )}
            </div>
            <span className="text-[10px] text-gray-400 block truncate">بررسی درخواست‌ها</span>
          </div>
        </Link>

        {/* 2. Stock Restock */}
        <button
          type="button"
          onClick={() => {
            if (allProducts.length > 0 && !selectedModalProductId) {
              setSelectedModalProductId(allProducts[0].id);
            }
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2.5 p-3 rounded-2xl bg-white border border-[#E6E1D5] hover:border-[#2C4A2E] hover:shadow-md transition-all group text-right cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Package className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold text-gray-900 truncate block">شارژ موجودی</span>
            <span className="text-[10px] text-gray-400 block truncate">افزایش انبار کالا</span>
          </div>
        </button>

        {/* 3. SMS Hub */}
        <Link
          href="/admin/sms"
          className="flex items-center gap-2.5 p-3 rounded-2xl bg-white border border-[#E6E1D5] hover:border-[#2C4A2E] hover:shadow-md transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold text-gray-900 truncate block">ارسال پیامک</span>
            <span className="text-[10px] text-gray-400 block truncate">اطلاع‌رسانی سریع</span>
          </div>
        </Link>

        {/* 4. Finance */}
        <Link
          href="/admin/finance"
          className="flex items-center gap-2.5 p-3 rounded-2xl bg-white border border-[#E6E1D5] hover:border-[#2C4A2E] hover:shadow-md transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <CircleDollarSign className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold text-gray-900 truncate block">گزارش مالی</span>
            <span className="text-[10px] text-gray-400 block truncate">سود و تراکنش‌ها</span>
          </div>
        </Link>

        {/* 5. Shiraz Manifest */}
        <Link
          href="/admin/manifest"
          className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#2C4A2E] text-white hover:bg-[#1E3520] hover:shadow-md transition-all group col-span-2 sm:col-span-1"
        >
          <div className="w-10 h-10 rounded-xl bg-white/15 text-[#D4AF37] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Truck className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-black text-white truncate block">پیک شیراز</span>
            <span className="text-[10px] text-emerald-200 block truncate">مانیفست توزیع</span>
          </div>
        </Link>
      </div>

      {/* Critical Stock Alert Banner (Low Stock & Out-of-Stock Products) */}
      {lowStockProducts.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 via-rose-50 to-amber-50 rounded-3xl p-5 border border-amber-300 shadow-sm space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-amber-200/80">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <AlertTriangle className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-rose-950">
                  هشدار کسری موجودی انبار ({toPersianDigits(lowStockProducts.length)} محصول نیاز به شارژ دارد)
                </h3>
                <p className="text-[11px] text-rose-700">
                  محصولات زیر موجودی‌شان به اتمام رسیده یا کمتر از ۵ عدد است. مقدار دلخواه افزایش موجودی را تایین نموده و دکمه شارژ را بزنید.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (allProducts.length > 0 && !selectedModalProductId) {
                    setSelectedModalProductId(allProducts[0].id);
                  }
                  setIsModalOpen(true);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>شارژ دستی هر کالا</span>
              </button>

              <Link
                href="/admin/products"
                className="text-xs font-bold text-[#2C4A2E] hover:underline flex items-center gap-1"
              >
                <span>مدیریت کامل انبار</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
            {lowStockProducts.map((prod) => {
              const currentInputVal = restockAmounts[prod.id] ?? 10;
              return (
                <div
                  key={prod.id}
                  className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-xs flex flex-col justify-between gap-3 hover:border-amber-300 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <p className="text-xs font-black text-gray-900 truncate" title={prod.title}>
                        {prod.title}
                      </p>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                            (prod.stock || 0) === 0
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {(prod.stock || 0) === 0
                            ? 'اتمام موجودی'
                            : `موجودی فعلی: ${toPersianDigits(prod.stock || 0)} عدد`}
                        </span>
                        <span className="text-[10px] text-gray-500">{prod.category}</span>
                      </div>
                    </div>
                  </div>

                  {/* Custom Restock Input & Presets */}
                  <div className="pt-2.5 border-t border-gray-100 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-gray-500 font-bold">
                      <span>مقدار افزایش موجودی:</span>
                      <div className="flex items-center gap-1">
                        {[5, 10, 25, 50].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() =>
                              setRestockAmounts((prev) => ({
                                ...prev,
                                [prod.id]: preset,
                              }))
                            }
                            className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                              currentInputVal === preset
                                ? 'bg-[#2C4A2E] text-white border-[#2C4A2E]'
                                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            +{toPersianDigits(preset)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 flex items-center">
                        <input
                          type="number"
                          min="1"
                          value={currentInputVal === 0 ? '' : currentInputVal}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setRestockAmounts((prev) => ({
                              ...prev,
                              [prod.id]: isNaN(val) ? 0 : Math.max(0, val),
                            }));
                          }}
                          className="w-full text-center py-1.5 px-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-black text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2C4A2E]"
                          placeholder="تعداد دلخواه..."
                        />
                        <span className="absolute left-2 text-[10px] text-gray-400 pointer-events-none">
                          عدد
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCustomRestock(prod.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#2C4A2E] hover:bg-[#1E3520] text-white text-[11px] font-black flex items-center gap-1 shrink-0 transition-all cursor-pointer shadow-xs active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>شارژ موجودی</span>
                      </button>
                    </div>

                    <div className="text-[10px] text-gray-400 flex items-center justify-between">
                      <span>موجودی پس از شارژ:</span>
                      <span className="font-bold text-[#2C4A2E]">
                        {toPersianDigits((prod.stock || 0) + (currentInputVal || 0))} عدد
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Metrics Grid (Including Revenue, Profit Margin, Accounts, and Visits) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric 1: Total Revenue */}
        <div className="bg-white rounded-3xl p-6 border border-[#E6E1D5] shadow-farm space-y-3">
          <div className="flex items-center justify-between text-[#2C4A2E]">
            <span className="text-xs font-bold text-gray-500">فروش کل ثبت‌شده</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#2C4A2E]">{formatToman(totalRevenue)}</div>
          <span className="text-[11px] text-emerald-700 font-medium">
            تراکنش‌های تایید شده با شاپرک/زرین‌پال
          </span>
        </div>

        {/* Metric 2: Gross Profit & Margin */}
        <div className="bg-white rounded-3xl p-6 border border-[#E6E1D5] shadow-farm space-y-3">
          <div className="flex items-center justify-between text-[#2C4A2E]">
            <span className="text-xs font-bold text-gray-500">سود ناخالص مزارع (تخمینی)</span>
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-800">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-900">
            {formatToman(finSummary?.grossProfit ?? 0)}
          </div>
          <span className="text-[11px] text-amber-800 font-medium">
            حاشیه سود واقعی: {toPersianDigits(finSummary?.profitMarginPercent ?? 0)}٪ از {toPersianDigits(paidOrders.length)} سفارش تاییدشده
          </span>
        </div>

        {/* Metric 3: Total User Accounts */}
        <div className="bg-white rounded-3xl p-6 border border-[#E6E1D5] shadow-farm space-y-3">
          <div className="flex items-center justify-between text-[#2C4A2E]">
            <span className="text-xs font-bold text-gray-500">کاربران و باشگاه مشتریان</span>
            <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-purple-800">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#2C4A2E]">
            {toPersianDigits(users.length)} حساب کاربری
          </div>
          <span className="text-[11px] text-purple-700 font-medium">
            {toPersianDigits(proUsersCount)} مشترک پرو | {toPersianDigits(plusUsersCount)} مشترک پلاس
          </span>
        </div>

        {/* Metric 4: Shiraz Active Orders & Traffic */}
        <div className="bg-white rounded-3xl p-6 border border-[#E6E1D5] shadow-farm space-y-3">
          <div className="flex items-center justify-between text-[#2C4A2E]">
            <span className="text-xs font-bold text-gray-500">سفارش‌های جاری شیراز</span>
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-800">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#2C4A2E]">
            {toPersianDigits(processingCount + outForDeliveryCount)} سفارش
          </div>
          <span className="text-[11px] text-blue-700 font-medium">
            بازدید امروز: {toPersianDigits(visits.daily)} مراجعه‌کننده
          </span>
        </div>
      </div>

      {/* Sales Chart Section */}
      <SalesChart data={salesData} />

      {/* Financial Health & Excel Export Banner */}
      <div className="bg-gradient-to-l from-[#2C4A2E] to-[#1E3520] rounded-3xl p-6 text-white shadow-farm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-emerald-200 text-xs font-bold border border-white/10">
            <CircleDollarSign className="w-4 h-4 text-[#D4A373]" />
            <span>خلاصه گزارش مالی مزارع شیراز</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            تحلیل درآمد، بهای خرید کالا و تراز سود خالص
          </h2>
          <p className="text-xs text-white/80 max-w-2xl leading-relaxed">
            مجموع فروش خالص تا کنون: <strong>{formatToman(finSummary?.netRevenue || totalRevenue)}</strong> |{' '}
            بهای خرید از کشاورزان: <strong>{formatToman(finSummary?.totalCost || Math.round(totalRevenue * 0.68))}</strong> |{' '}
            سود ناخالص حاصله: <strong className="text-emerald-300">{formatToman(finSummary?.grossProfit || Math.round(totalRevenue * 0.32))}</strong>
          </p>
        </div>

        <Link
          href="/admin/finance"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#D4A373] text-[#1E3520] font-black text-xs hover:bg-[#F3E5AB] transition-all shrink-0 shadow-lg cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>ورود به بخش مالی و دانلود اکسل</span>
          <ArrowLeft className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Recent Orders Overview */}
      <div className="bg-white rounded-3xl p-6 border border-[#E6E1D5] shadow-farm space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#2C4A2E]" />
            <h3 className="font-bold text-base text-[#2C4A2E]">آخرین سفارشات ثبت‌شده</h3>
          </div>
          <Link
            href="/admin/orders"
            className="text-xs text-[#2C4A2E] hover:underline font-semibold flex items-center gap-1"
          >
            <span>مدیریت تمام سفارشات و چاپ فاکتور</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-gray-100 text-gray-500">
                <th className="py-3 px-3 font-semibold">شماره سفارش</th>
                <th className="py-3 px-3 font-semibold">مشتری</th>
                <th className="py-3 px-3 font-semibold">نشانی / شهر</th>
                <th className="py-3 px-3 font-semibold">اسلات تحویل پیک شیراز</th>
                <th className="py-3 px-3 font-semibold">مبلغ</th>
                <th className="py-3 px-3 font-semibold">وضعیت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.slice(0, 5).map((order) => (
                <tr key={order.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="py-3.5 px-3 font-mono font-bold text-[#2C4A2E]">
                    {order.orderNumber}
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="font-bold text-gray-800">{order.address?.recipientName}</div>
                    <div className="text-[11px] text-gray-400 font-mono">
                      {order.address?.phone}
                    </div>
                  </td>
                  <td className="py-3.5 px-3 max-w-xs truncate text-gray-600">
                    {order.address?.city} - {order.address?.streetAddress}
                  </td>
                  <td className="py-3.5 px-3 text-gray-700">
                    {order.deliverySlot
                      ? `${order.deliverySlot.date} (۱۵:۰۰ الی ۲۱:۰۰)`
                      : order.isSubscription
                      ? 'عضویت دیجیتال مشترک'
                      : 'سفارش عمده / باربری'}
                  </td>
                  <td className="py-3.5 px-3 font-bold text-[#2C4A2E]">
                    {formatToman(order.totalAmount)}
                  </td>
                  <td className="py-3.5 px-3">
                    {(() => {
                      const statusMeta = getOrderStatusMeta(order.status);
                      return (
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${statusMeta.badgeClass}`}
                        >
                          {statusMeta.shortLabel}
                        </span>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Universal Stock Restock Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-gray-100 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-[#2C4A2E]">
                <Package className="w-5 h-5 text-[#D4A373]" />
                <h3 className="font-black text-base">شارژ موجودی انبار (تعیین مقدار دلخواه)</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleModalRestockSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-700 font-bold mb-1.5">
                  انتخاب کالای مورد نظر جهت شارژ:
                </label>
                <select
                  value={selectedModalProductId}
                  onChange={(e) => setSelectedModalProductId(e.target.value)}
                  className="w-full py-2.5 px-3 bg-gray-50 border border-gray-300 rounded-2xl font-bold text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2C4A2E]"
                >
                  {allProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.category}) - موجودی فعلی: {toPersianDigits(p.stock || 0)} عدد
                    </option>
                  ))}
                </select>
              </div>

              {/* Display Current Selected Item Info */}
              {(() => {
                const targetProd = allProducts.find((p) => p.id === selectedModalProductId);
                const currentStock = targetProd?.stock || 0;
                const addQty = Number(modalAmount) || 0;
                const afterStock = currentStock + addQty;
                return (
                  <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 font-bold">موجودی فعلی در انبار:</span>
                      <span className="font-black text-amber-900">
                        {toPersianDigits(currentStock)} عدد
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 font-bold">مقدار افزایشی جدید:</span>
                      <span className="font-black text-emerald-700">
                        +{toPersianDigits(addQty)} عدد
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-amber-200 font-black">
                      <span className="text-[#2C4A2E]">موجودی کل پس از شارژ:</span>
                      <span className="text-sm text-[#2C4A2E]">{toPersianDigits(afterStock)} عدد</span>
                    </div>
                  </div>
                );
              })()}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-gray-700 font-bold">
                    مقداری که می‌خواهید به موجودی اضافه شود:
                  </label>
                  <div className="flex items-center gap-1">
                    {[5, 10, 20, 50, 100].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setModalAmount(preset)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                          modalAmount === preset
                            ? 'bg-[#2C4A2E] text-white border-[#2C4A2E]'
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        +{toPersianDigits(preset)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    value={modalAmount === 0 ? '' : modalAmount}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setModalAmount(isNaN(val) ? 0 : Math.max(0, val));
                    }}
                    required
                    placeholder="مثلاً: 25"
                    className="w-full py-2.5 px-3 bg-gray-50 border border-gray-300 rounded-2xl font-black text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2C4A2E]"
                  />
                  <span className="absolute left-3.5 top-2.5 text-xs text-gray-400 pointer-events-none">
                    عدد بسته
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold transition-colors cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-2xl bg-[#2C4A2E] hover:bg-[#1E3520] text-white font-black flex items-center gap-1.5 shadow-md hover:shadow-lg transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />
                  <span>تایید و ثبت افزایش موجودی</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
