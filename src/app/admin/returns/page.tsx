'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { farmStore } from '@/lib/db-store';
import { ReturnRequest, ReturnStatus } from '@/types';
import { formatToman, toPersianDigits } from '@/lib/formatters';
import {
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  CreditCard,
  Phone,
  Package,
  Search,
  CheckCircle,
  FileText,
  Filter,
  Eye,
  X,
  Save,
  ShieldCheck,
} from 'lucide-react';

export default function AdminReturnsPage() {
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | ReturnStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Detail / Review Modal State
  const [selectedRequest, setSelectedRequest] = useState<ReturnRequest | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<ReturnStatus>('PENDING');
  const [adminNote, setAdminNote] = useState('');

  const loadReturns = () => {
    setReturns(farmStore.getReturnRequests());
  };

  useEffect(() => {
    loadReturns();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleOpenReview = (req: ReturnRequest) => {
    setSelectedRequest(req);
    setNewStatus(req.status);
    setAdminNote(req.adminNotes || req.adminNote || '');
    setIsModalOpen(true);
  };

  const handleSaveReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    const updated = farmStore.updateReturnStatus(selectedRequest.id, newStatus, adminNote);
    if (updated) {
      loadReturns();
      setIsModalOpen(false);
      showToast(`وضعیت مرجوعی سفارش ${selectedRequest.orderNumber} با موفقیت به‌روزرسانی شد.`);
    }
  };

  const filteredReturns = returns.filter((r) => {
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    const matchesSearch =
      !searchQuery.trim() ||
      r.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.customerPhone.includes(searchQuery) ||
      (r.productTitle && r.productTitle.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesStatus && matchesSearch;
  });

  const pendingCount = returns.filter((r) => r.status === 'PENDING').length;
  const approvedCount = returns.filter((r) => r.status === 'APPROVED').length;
  const refundedCount = returns.filter((r) => r.status === 'REFUNDED').length;
  const totalRefundedMoney = returns
    .filter((r) => r.status === 'REFUNDED')
    .reduce((sum, r) => sum + r.refundAmount, 0);

  const getReasonLabel = (reason: ReturnRequest['reason']) => {
    switch (reason) {
      case 'DAMAGE':
        return 'شکستگی یا آسیب حین حمل پیک';
      case 'QUALITY':
        return 'عدم رضایت از تازگی یا کیفیت محصول';
      case 'WRONG_ITEM':
        return 'ارسال اشتباه کالا یا عدم تطابق';
      case 'CUSTOMER_CANCEL':
        return 'انصراف مشتری قبل از مصرف';
      default:
        return 'نامشخص';
    }
  };

  const getStatusBadge = (status: ReturnStatus) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>در انتظار بررسی کیفیت</span>
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300">
            <CheckCircle className="w-3.5 h-3.5 text-blue-600" />
            <span>تایید شد - در نوبت واریز</span>
          </span>
        );
      case 'REFUNDED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>مبلغ عودت داده شد (مختومه)</span>
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-900 border border-rose-300">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>درخواست رد شد</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-50 p-4 rounded-2xl bg-[#2C4A2E] text-white text-xs sm:text-sm font-bold flex items-center gap-3 shadow-2xl border border-emerald-400/40 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-[#D4A373] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E6E1D5]">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#D4A373]">
            <RotateCcw className="w-4 h-4 text-[#2C4A2E]" />
            <span>سامانه تضمین کیفیت ۱۰۰٪ و خدمات پس از فروش پروفارم</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#2C4A2E] mt-0.5">
            مدیریت مرجوعی کالا، تضمین کیفیت و بازگشت وجه
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            بررسی شکایات مشتریان، تایید عودت کالا (شکستگی، تازگی، اشتباه پیک) و ثبت استرداد وجه بانکی
          </p>
        </div>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-[#E6E1D5] shadow-farm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500">
            <span>در انتظار بررسی کارشناس</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-700">
            {toPersianDigits(pendingCount)} درخواست
          </div>
          <div className="text-[11px] text-gray-500">نیازمند تماس و بررسی ادعا</div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-[#E6E1D5] shadow-farm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500">
            <span>تایید شده (در نوبت استرداد)</span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-800">
            {toPersianDigits(approvedCount)} مورد
          </div>
          <div className="text-[11px] text-gray-500">آماده واریز به شماره شبا</div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-[#E6E1D5] shadow-farm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500">
            <span>مجموع بازگشت وجه انجام‌شده</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#2C4A2E]">
            {formatToman(totalRefundedMoney)}
          </div>
          <div className="text-[11px] text-emerald-700 font-medium">
            تعداد {toPersianDigits(refundedCount)} فقره تسویه موفق
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-[#E6E1D5] shadow-farm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500">
            <span>نرخ سلامت محموله‌های شیراز</span>
            <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-teal-900">۹۸.۶٪</div>
          <div className="text-[11px] text-teal-700 font-medium">رضایت تضمین کیفیت مزارع</div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-[#2C4A2E] text-white shadow-xs'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-[#E6E1D5]'
            }`}
          >
            همه موارد ({toPersianDigits(returns.length)})
          </button>

          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'PENDING'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            در انتظار بررسی ({toPersianDigits(pendingCount)})
          </button>

          <button
            onClick={() => setStatusFilter('APPROVED')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'APPROVED'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 text-blue-900 hover:bg-blue-100 border border-blue-200'
            }`}
          >
            تایید شده ({toPersianDigits(approvedCount)})
          </button>

          <button
            onClick={() => setStatusFilter('REFUNDED')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'REFUNDED'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            عودت داده شده ({toPersianDigits(refundedCount)})
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute right-3 top-2.5" />
          <input
            type="text"
            placeholder="جستجو سفارش، مشتری، محصول..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-9 pl-3 py-2 rounded-xl border border-[#E6E1D5] bg-white text-xs text-gray-800 w-full sm:w-60 focus:outline-none focus:border-[#2C4A2E]"
          />
        </div>
      </div>

      {/* Returns Table */}
      <div className="bg-white rounded-3xl border border-[#E6E1D5] shadow-farm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs sm:text-sm">
            <thead className="bg-[#F9F8F5] border-b border-[#E6E1D5] text-[#2C4A2E]">
              <tr>
                <th className="py-3.5 px-5 font-black">کد سفارش</th>
                <th className="py-3.5 px-5 font-black">مشتری و تماس</th>
                <th className="py-3.5 px-5 font-black">محصول و تعداد</th>
                <th className="py-3.5 px-5 font-black">علت مرجوعی</th>
                <th className="py-3.5 px-5 font-black">مبلغ استرداد</th>
                <th className="py-3.5 px-5 font-black">وضعیت</th>
                <th className="py-3.5 px-5 font-black">تاریخ ثبت</th>
                <th className="py-3.5 px-5 font-black">اقدام ادمین</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E1D5]">
              {filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500 font-medium">
                    هیچ درخواست مرجوعی با شرایط فوق یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredReturns.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-4 px-5 font-bold text-[#2C4A2E] font-mono">
                      {req.orderNumber}
                    </td>

                    <td className="py-4 px-5">
                      <div className="font-bold text-gray-900">{req.customerName}</div>
                      <div className="text-[11px] text-gray-500 font-mono" dir="ltr">
                        {toPersianDigits(req.customerPhone)}
                      </div>
                    </td>

                    <td className="py-4 px-5">
                      <div className="font-bold text-gray-800">{req.productTitle}</div>
                      <div className="text-xs text-gray-500">
                        تعداد: {toPersianDigits(req.quantity)} بسته
                      </div>
                    </td>

                    <td className="py-4 px-5">
                      <div className="font-medium text-gray-800">{getReasonLabel(req.reason)}</div>
                      {req.description && (
                        <div className="text-[11px] text-gray-500 line-clamp-1 max-w-xs mt-0.5">
                          «{req.description}»
                        </div>
                      )}
                    </td>

                    <td className="py-4 px-5 font-black text-[#2C4A2E]">
                      {formatToman(req.refundAmount)}
                    </td>

                    <td className="py-4 px-5">{getStatusBadge(req.status)}</td>

                    <td className="py-4 px-5 text-gray-500 text-xs">
                      {new Date(req.createdAt).toLocaleDateString('fa-IR')}
                    </td>

                    <td className="py-4 px-5">
                      <button
                        onClick={() => handleOpenReview(req)}
                        className="px-3.5 py-1.5 rounded-xl bg-gray-100 hover:bg-[#2C4A2E] hover:text-white text-gray-800 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>بررسی و تعیین تکلیف</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Modal */}
      {isModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-[#E6E1D5] shadow-2xl space-y-6 animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-[#F3EFE6]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-800">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#2C4A2E]">
                    بررسی درخواست مرجوعی کالا
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    سفارش {selectedRequest.orderNumber} - {selectedRequest.customerName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveReview} className="space-y-4 text-xs sm:text-sm">
              {/* Product and Claim Details */}
              <div className="p-4 rounded-2xl bg-[#F9F8F5] border border-[#E6E1D5] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">کالای مرجوعی:</span>
                  <span className="font-bold text-gray-800">
                    {selectedRequest.productTitle} ({toPersianDigits(selectedRequest.quantity)} بسته)
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-500">علت اعلامی مشتری:</span>
                  <span className="font-bold text-amber-800">
                    {getReasonLabel(selectedRequest.reason)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-500">مبلغ استرداد وجه:</span>
                  <span className="font-black text-[#2C4A2E] text-sm">
                    {formatToman(selectedRequest.refundAmount)}
                  </span>
                </div>

                {selectedRequest.description && (
                  <div className="pt-2 border-t border-gray-200">
                    <span className="text-gray-500 block mb-1">توضیحات تکمیلی مشتری:</span>
                    <p className="text-gray-700 bg-white p-2.5 rounded-xl border border-gray-200 text-xs leading-relaxed">
                      {selectedRequest.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Status Decision Selector */}
              <div className="space-y-2">
                <label className="block font-black text-gray-800 text-xs">
                  تصمیم کارشناس تضمین کیفیت پروفارم:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewStatus('PENDING')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      newStatus === 'PENDING'
                        ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    در انتظار بررسی
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewStatus('APPROVED')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      newStatus === 'APPROVED'
                        ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    تایید عودت کالا
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewStatus('REFUNDED')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      newStatus === 'REFUNDED'
                        ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    استرداد وجه انجام شد
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewStatus('REJECTED')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      newStatus === 'REJECTED'
                        ? 'bg-rose-700 text-white border-rose-800 shadow-xs'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    رد ادعای مرجوعی
                  </button>
                </div>
              </div>

              {/* Admin Internal Note */}
              <div className="space-y-1.5">
                <label className="block font-black text-gray-800 text-xs">
                  یادداشت و نتیجه پیگیری ادمین (کد پیگیری شبا، علت رد و...):
                </label>
                <textarea
                  rows={3}
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="مثال: تماس گرفته شد، با هماهنگی مشتری مبلغ به کارت بانک ملی ایشان پایا گردید."
                  className="w-full p-3 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white text-xs font-medium text-gray-800 focus:outline-none focus:border-[#2C4A2E]"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 text-xs font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-[#2C4A2E] text-white text-xs font-bold hover:bg-[#1E3520] shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4 text-[#D4A373]" />
                  <span>ثبت تغییرات وضعیت</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
