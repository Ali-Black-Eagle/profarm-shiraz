'use client';

import React, { useMemo, useState } from 'react';
import { BulkInquiry } from '@/types';
import {
  Package,
  Phone,
  MapPin,
  Building,
  Clock,
  Trash2,
  RefreshCw,
  Calendar,
  CheckCheck,
} from 'lucide-react';
import { toPersianDigits } from '@/lib/formatters';
import { useToast } from '@/components/ui/ToastProvider';
import { adminRequest, AdminStatus, useAdminFetch } from '@/components/admin/admin-client';

type InquiryStatus = 'PENDING' | 'REVIEWED' | 'COMPLETED';
type Filter = 'ALL' | InquiryStatus;

export default function AdminBulkPage() {
  const toast = useToast();
  const { data, error, loading, reload, setData } = useAdminFetch<{ inquiries: BulkInquiry[] }>('/api/bulk-inquiries');
  const inquiries = useMemo(() => data?.inquiries ?? [], [data]);
  const [filterStatus, setFilterStatus] = useState<Filter>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleStatusChange = async (id: string, newStatus: InquiryStatus) => {
    const previous = inquiries.find((inq) => inq.id === id);
    if (!previous || busyId) return;
    const previousStatus = previous.status;
    setBusyId(id);
    // Optimistic update, rolled back if the server refuses
    setData((prev) =>
      prev ? { ...prev, inquiries: prev.inquiries.map((inq) => (inq.id === id ? { ...inq, status: newStatus } : inq)) } : prev
    );
    const result = await adminRequest<{ inquiry: BulkInquiry }>('/api/bulk-inquiries', {
      method: 'PATCH',
      body: { id, status: newStatus },
    });
    setBusyId(null);
    if (!result.ok) {
      setData((prev) =>
        prev
          ? {
              ...prev,
              inquiries: prev.inquiries.map((inq) => (inq.id === id ? { ...inq, status: previousStatus } : inq)),
            }
          : prev
      );
      toast.error(result.message);
      return;
    }
    toast.success('وضعیت استعلام با موفقیت بروزرسانی شد.');
  };

  const handleDelete = async (id: string) => {
    if (busyId) return;
    const ok = await toast.confirm({
      title: 'حذف استعلام خرید عمده',
      description: 'آیا از حذف دائمی این درخواست خرید عمده اطمینان دارید؟',
      confirmLabel: 'حذف درخواست',
      cancelLabel: 'انصراف',
      variant: 'danger',
    });
    if (!ok) return;

    setBusyId(id);
    const result = await adminRequest(`/api/bulk-inquiries?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setData((prev) => (prev ? { ...prev, inquiries: prev.inquiries.filter((inq) => inq.id !== id) } : prev));
    toast.success('استعلام با موفقیت حذف شد.');
  };

  const filteredInquiries = inquiries.filter((inq) => {
    if (filterStatus === 'ALL') return true;
    return (inq.status || 'PENDING') === filterStatus;
  });

  const pendingCount = inquiries.filter((i) => !i.status || i.status === 'PENDING').length;
  const reviewedCount = inquiries.filter((i) => i.status === 'REVIEWED').length;
  const completedCount = inquiries.filter((i) => i.status === 'COMPLETED').length;

  const filterButton = (value: Filter, label: string, count: number, activeClass: string) => (
    <button
      type="button"
      onClick={() => setFilterStatus(value)}
      aria-pressed={filterStatus === value}
      className={`min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
        filterStatus === value ? activeClass : 'bg-white text-gray-600 border border-farm-border hover:bg-gray-50'
      }`}
    >
      {label} ({toPersianDigits(count)})
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-farm-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-farm-primary">
            استعلام‌ها و درخواست‌های خرید عمده (خارج از شیراز)
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            بررسی درخواست‌های سازمانی، فروشگاهی و رستورانی برای ارسال کانتینری و باربری به سراسر کشور
          </p>
        </div>

        <button
          type="button"
          onClick={() => void reload()}
          disabled={loading}
          className="min-h-[44px] px-4 rounded-xl bg-white border border-farm-border hover:bg-farm-bg-warm text-xs font-bold text-farm-primary transition-colors flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>بروزرسانی لیست</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-farm-border shadow-xs">
          <div className="text-xs text-gray-500">کل درخواست‌ها</div>
          <div className="text-xl sm:text-2xl font-black text-farm-primary mt-1">{toPersianDigits(inquiries.length)}</div>
        </div>
        <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200/80 shadow-xs">
          <div className="text-xs text-amber-900 font-bold flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>در انتظار تماس</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-700 mt-1">{toPersianDigits(pendingCount)}</div>
        </div>
        <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-200/80 shadow-xs">
          <div className="text-xs text-blue-900 font-bold flex items-center gap-1">
            <Phone className="w-3.5 h-3.5 text-blue-600" />
            <span>تماس گرفته شده</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-blue-700 mt-1">{toPersianDigits(reviewedCount)}</div>
        </div>
        <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200/80 shadow-xs">
          <div className="text-xs text-emerald-900 font-bold flex items-center gap-1">
            <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>تکمیل و نهایی شده</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-1">{toPersianDigits(completedCount)}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {filterButton('ALL', 'همه درخواست‌ها', inquiries.length, 'bg-farm-primary text-white')}
        {filterButton('PENDING', 'در انتظار تماس', pendingCount, 'bg-amber-600 text-white')}
        {filterButton('REVIEWED', 'بررسی و تماس گرفته شد', reviewedCount, 'bg-blue-600 text-white')}
        {filterButton('COMPLETED', 'تکمیل شده', completedCount, 'bg-emerald-600 text-white')}
      </div>

      {/* List */}
      <AdminStatus
        hasData={data !== null}
        loading={loading}
        error={error}
        onRetry={() => void reload()}
        isEmpty={data !== null && filteredInquiries.length === 0}
        emptyText="هیچ درخواست استعلامی در این بخش وجود ندارد. درخواست‌های ثبت‌شده در صفحه خرید عمده در این بخش نمایش داده می‌شوند."
      />

      <div className="grid grid-cols-1 gap-4">
        {filteredInquiries.map((inq, idx) => {
          const currentStatus: InquiryStatus = (inq.status as InquiryStatus) || 'PENDING';
          const isBusy = busyId === inq.id;
          return (
            <div
              key={inq.id || `inq-${idx}`}
              className="bg-white rounded-3xl p-6 border border-farm-border shadow-farm space-y-4 transition-all hover:border-farm-primary/40"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#D4A373]/20 flex items-center justify-center text-[#D4A373] shrink-0">
                    <Package className="w-5 h-5 text-farm-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm text-farm-primary">{inq.name}</h3>
                      {inq.createdAt && (
                        <span className="text-xs text-gray-600 flex items-center gap-1" dir="ltr">
                          <Calendar className="w-3 h-3" />
                          {new Date(inq.createdAt).toLocaleDateString('fa-IR')}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-0.5">
                      {inq.companyName && (
                        <span className="flex items-center gap-1">
                          <Building className="w-3.5 h-3.5 text-gray-500" />
                          <span>{inq.companyName}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-gray-500" />
                        <span>مقصد: {inq.city}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`tel:${inq.phone}`}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-farm-bg-warm text-farm-primary hover:bg-farm-border text-xs font-mono font-bold flex items-center gap-1.5 transition-colors"
                    dir="ltr"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{inq.phone}</span>
                  </a>

                  {currentStatus === 'PENDING' && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>در انتظار تماس</span>
                    </span>
                  )}
                  {currentStatus === 'REVIEWED' && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300 flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      <span>تماس گرفته شد</span>
                    </span>
                  )}
                  {currentStatus === 'COMPLETED' && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                      <CheckCheck className="w-3 h-3" />
                      <span>تکمیل و ثبت باربری</span>
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => void handleDelete(inq.id)}
                    disabled={isBusy}
                    aria-label="حذف استعلام"
                    title="حذف استعلام"
                    className="min-w-[44px] min-h-[44px] p-2 rounded-xl text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4 mx-auto" />
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-farm-bg border border-farm-border text-xs text-gray-700 leading-relaxed whitespace-pre-line break-words">
                <span className="font-bold text-farm-primary block mb-1">شرح اقلام و نیازمندی متقاضی:</span>
                {inq.message}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-100 text-xs">
                <span className="text-xs text-gray-500 font-medium">تغییر وضعیت استعلام:</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      ['PENDING', 'در انتظار', 'bg-amber-600'],
                      ['REVIEWED', 'تماس گرفته شد', 'bg-blue-600'],
                      ['COMPLETED', 'تکمیل سفارش', 'bg-emerald-600'],
                    ] as const
                  ).map(([value, label, activeBg]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => void handleStatusChange(inq.id, value)}
                      disabled={isBusy}
                      aria-pressed={currentStatus === value}
                      className={`min-h-[44px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
                        currentStatus === value ? `${activeBg} text-white` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
