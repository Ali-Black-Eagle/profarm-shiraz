'use client';

import React, { useState, useEffect } from 'react';
import { farmStore } from '@/lib/db-store';
import { BulkInquiry } from '@/types';
import {
  Package,
  Phone,
  MapPin,
  Building,
  CheckCircle2,
  Clock,
  Trash2,
  RefreshCw,
  AlertCircle,
  Calendar,
  CheckCheck,
  Filter,
} from 'lucide-react';
import { toPersianDigits } from '@/lib/formatters';
import { useToast, useConfirm } from '@/components/ui/ToastProvider';

export default function AdminBulkPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [inquiries, setInquiries] = useState<BulkInquiry[]>([]);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'REVIEWED' | 'COMPLETED'>('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadInquiries = async () => {
    setIsLoading(true);
    try {
      // First attempt to fetch from API
      const res = await fetch('/api/bulk-inquiries');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.inquiries)) {
          // Merge API inquiries with farmStore local inquiries
          const apiList = data.inquiries as BulkInquiry[];
          const localList = farmStore.getBulkInquiries();
          const idSet = new Set(apiList.map((i) => i.id));
          localList.forEach((inq) => {
            if (!idSet.has(inq.id)) {
              apiList.push(inq);
              idSet.add(inq.id);
            }
          });
          setInquiries([...apiList]);
          return;
        }
      }
    } catch (e) {
      console.error('Failed to load from API:', e);
    } finally {
      setIsLoading(false);
    }

    // Fallback to client-side farmStore
    setInquiries([...farmStore.getBulkInquiries()]);
  };

  useEffect(() => {
    loadInquiries();
  }, []);

  const handleStatusChange = async (id: string, newStatus: 'PENDING' | 'REVIEWED' | 'COMPLETED') => {
    // 1. Optimistic update
    farmStore.updateBulkInquiryStatus(id, newStatus);
    setInquiries((prev) =>
      prev.map((inq) => (inq.id === id ? { ...inq, status: newStatus } : inq))
    );

    // 2. Call API
    try {
      const res = await fetch('/api/bulk-inquiries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (!res.ok) {
        toast.error('خطا در ذخیره وضعیت استعلام در سرور.');
        return;
      }
      showToast('وضعیت استعلام با موفقیت بروزرسانی شد.');
      toast.success('وضعیت استعلام با موفقیت بروزرسانی شد.');
    } catch {
      toast.error('خطا در ارتباط با سرور؛ وضعیت در سرور ذخیره نشد.');
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'حذف استعلام خرید عمده',
      description: 'آیا از حذف دائمی این درخواست خرید عمده اطمینان دارید؟',
      confirmLabel: 'حذف درخواست',
      cancelLabel: 'انصراف',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/bulk-inquiries?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        toast.error('خطا در حذف استعلام از سرور.');
        return;
      }
      farmStore.deleteBulkInquiry(id);
      setInquiries((prev) => prev.filter((inq) => inq.id !== id));
      showToast('استعلام با موفقیت حذف شد.');
      toast.success('استعلام با موفقیت حذف شد.');
    } catch {
      toast.error('خطا در ارتباط با سرور؛ استعلام حذف نشد.');
    }
  };

  const filteredInquiries = inquiries.filter((inq) => {
    if (filterStatus === 'ALL') return true;
    const status = inq.status || 'PENDING';
    return status === filterStatus;
  });

  const pendingCount = inquiries.filter((i) => !i.status || i.status === 'PENDING').length;
  const reviewedCount = inquiries.filter((i) => i.status === 'REVIEWED').length;
  const completedCount = inquiries.filter((i) => i.status === 'COMPLETED').length;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-50 bg-[#2C4A2E] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-4 h-4 text-[#D4A373]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E6E1D5]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#2C4A2E]">
            استعلام‌ها و درخواست‌های خرید عمده (خارج از شیراز)
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            بررسی درخواست‌های سازمانی، فروشگاهی و رستورانی برای ارسال کانتینری و باربری به سراسر کشور
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadInquiries}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl bg-white border border-[#E6E1D5] hover:bg-[#F3EFE6] text-xs font-bold text-[#2C4A2E] transition-colors flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>بروزرسانی لیست</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-[#E6E1D5] shadow-xs">
          <div className="text-xs text-gray-500">کل درخواست‌ها</div>
          <div className="text-xl sm:text-2xl font-black text-[#2C4A2E] mt-1">
            {toPersianDigits(inquiries.length)}
          </div>
        </div>

        <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200/80 shadow-xs">
          <div className="text-xs text-amber-900 font-bold flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>در انتظار تماس</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-700 mt-1">
            {toPersianDigits(pendingCount)}
          </div>
        </div>

        <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-200/80 shadow-xs">
          <div className="text-xs text-blue-900 font-bold flex items-center gap-1">
            <Phone className="w-3.5 h-3.5 text-blue-600" />
            <span>تماس گرفته شده</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-blue-700 mt-1">
            {toPersianDigits(reviewedCount)}
          </div>
        </div>

        <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200/80 shadow-xs">
          <div className="text-xs text-emerald-900 font-bold flex items-center gap-1">
            <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>تکمیل و نهایی شده</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-1">
            {toPersianDigits(completedCount)}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setFilterStatus('ALL')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            filterStatus === 'ALL'
              ? 'bg-[#2C4A2E] text-white'
              : 'bg-white text-gray-600 border border-[#E6E1D5] hover:bg-gray-50'
          }`}
        >
          همه درخواست‌ها ({toPersianDigits(inquiries.length)})
        </button>
        <button
          onClick={() => setFilterStatus('PENDING')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            filterStatus === 'PENDING'
              ? 'bg-amber-600 text-white'
              : 'bg-white text-gray-600 border border-[#E6E1D5] hover:bg-gray-50'
          }`}
        >
          در انتظار تماس ({toPersianDigits(pendingCount)})
        </button>
        <button
          onClick={() => setFilterStatus('REVIEWED')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            filterStatus === 'REVIEWED'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-600 border border-[#E6E1D5] hover:bg-gray-50'
          }`}
        >
          بررسی و تماس گرفته شد ({toPersianDigits(reviewedCount)})
        </button>
        <button
          onClick={() => setFilterStatus('COMPLETED')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            filterStatus === 'COMPLETED'
              ? 'bg-emerald-600 text-white'
              : 'bg-white text-gray-600 border border-[#E6E1D5] hover:bg-gray-50'
          }`}
        >
          تکمیل شده ({toPersianDigits(completedCount)})
        </button>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredInquiries.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-[#E6E1D5] space-y-3">
            <Package className="w-12 h-12 text-gray-300 mx-auto" />
            <h3 className="font-bold text-gray-700">هیچ درخواست استعلامی در این بخش وجود ندارد</h3>
            <p className="text-xs text-gray-500">
              درخواست‌های ثبت‌شده در صفحه خرید عمده بلافاصله در این بخش نمایش داده می‌شوند.
            </p>
          </div>
        ) : (
          filteredInquiries.map((inq, idx) => {
            const currentStatus = inq.status || 'PENDING';
            return (
              <div
                key={inq.id || `inq-${idx}`}
                className="bg-white rounded-3xl p-6 border border-[#E6E1D5] shadow-farm space-y-4 transition-all hover:border-[#2C4A2E]/40"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#D4A373]/20 flex items-center justify-center text-[#D4A373] shrink-0">
                      <Package className="w-5 h-5 text-[#2C4A2E]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-[#2C4A2E]">{inq.name}</h3>
                        {inq.createdAt && (
                          <span className="text-[10px] text-gray-400 flex items-center gap-1" dir="ltr">
                            <Calendar className="w-3 h-3" />
                            {new Date(inq.createdAt).toLocaleDateString('fa-IR')}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500 mt-0.5">
                        {inq.companyName && (
                          <span className="flex items-center gap-1">
                            <Building className="w-3.5 h-3.5 text-gray-400" />
                            <span>{inq.companyName}</span>
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" />
                          <span>مقصد: {inq.city}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`tel:${inq.phone}`}
                      className="px-3.5 py-2 rounded-xl bg-[#F3EFE6] text-[#2C4A2E] hover:bg-[#E6E1D5] text-xs font-mono font-bold flex items-center gap-1.5 transition-colors"
                      dir="ltr"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>{inq.phone}</span>
                    </a>

                    {/* Status Badge */}
                    {currentStatus === 'PENDING' && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>در انتظار تماس</span>
                      </span>
                    )}
                    {currentStatus === 'REVIEWED' && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-300 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        <span>تماس گرفته شد</span>
                      </span>
                    )}
                    {currentStatus === 'COMPLETED' && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                        <CheckCheck className="w-3 h-3" />
                        <span>تکمیل و ثبت باربری</span>
                      </span>
                    )}

                    {/* Delete button */}
                    <button
                      onClick={() => handleDelete(inq.id)}
                      title="حذف استعلام"
                      className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#F9F8F5] border border-[#E6E1D5] text-xs text-gray-700 leading-relaxed">
                  <span className="font-bold text-[#2C4A2E] block mb-1">
                    شرح اقلام و نیازمندی متقاضی:
                  </span>
                  {inq.message}
                </div>

                {/* Status Switcher Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-100 text-xs">
                  <span className="text-[11px] text-gray-500 font-medium">تغییر وضعیت استعلام:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleStatusChange(inq.id, 'PENDING')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                        currentStatus === 'PENDING'
                          ? 'bg-amber-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      در انتظار
                    </button>
                    <button
                      onClick={() => handleStatusChange(inq.id, 'REVIEWED')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                        currentStatus === 'REVIEWED'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      تماس گرفته شد
                    </button>
                    <button
                      onClick={() => handleStatusChange(inq.id, 'COMPLETED')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                        currentStatus === 'COMPLETED'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      تکمیل سفارش
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
