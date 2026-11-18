'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ReturnRequest, ReturnStatus } from '@/types';
import { formatToman, toPersianDigits } from '@/lib/formatters';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/ToastProvider';
import {
  RotateCcw,
  CheckCircle2,
  Clock,
  XCircle,
  CreditCard,
  Search,
  CheckCircle,
  Eye,
  Save,
  RefreshCw,
} from 'lucide-react';
import {
  adminQuery,
  adminRequest,
  AdminPager,
  AdminPagination,
  AdminStatus,
  useAdminFetch,
} from '@/components/admin/admin-client';

type StatusFilter = 'ALL' | ReturnStatus;

interface ReturnsPayload {
  returns: ReturnRequest[];
  pagination: AdminPagination;
  counts: Record<ReturnStatus, number>;
}

const EMPTY_COUNTS: Record<ReturnStatus, number> = { PENDING: 0, APPROVED: 0, REJECTED: 0, REFUNDED: 0 };

function getReasonLabel(reason: string | undefined): string {
  switch (reason) {
    case 'DAMAGE':
    case 'DAMAGE_IN_TRANSIT':
      return 'شکستگی یا آسیب حین حمل پیک';
    case 'QUALITY':
    case 'QUALITY_ISSUE':
      return 'عدم رضایت از تازگی یا کیفیت محصول';
    case 'WRONG_ITEM':
      return 'ارسال اشتباه کالا یا عدم تطابق';
    case 'CUSTOMER_CANCEL':
      return 'انصراف مشتری قبل از مصرف';
    default:
      return reason || 'نامشخص';
  }
}

function StatusBadge({ status }: { status: ReturnStatus }) {
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
    default:
      return null;
  }
}

export default function AdminReturnsPage() {
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  // Debounce the search box so each keystroke does not hit the server
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const url = adminQuery('/api/admin/returns', {
    status: statusFilter,
    q: searchQuery,
    page,
    pageSize: 20,
  });
  const { data, error, loading, reload, setData } = useAdminFetch<ReturnsPayload>(url);
  const returns = useMemo(() => data?.returns ?? [], [data]);
  const counts = data?.counts ?? EMPTY_COUNTS;
  const totalAll = counts.PENDING + counts.APPROVED + counts.REJECTED + counts.REFUNDED;

  // Review modal state
  const [selected, setSelected] = useState<ReturnRequest | null>(null);
  const [newStatus, setNewStatus] = useState<ReturnStatus>('PENDING');
  const [adminNote, setAdminNote] = useState('');
  const [refundInput, setRefundInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openReview = (req: ReturnRequest) => {
    setSelected(req);
    setNewStatus(req.status);
    setAdminNote(req.adminNotes || req.adminNote || '');
    setRefundInput(String(req.refundAmount ?? 0));
    setFormError(null);
  };

  const closeReview = () => {
    if (saving) return;
    setSelected(null);
  };

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || saving) return;
    setFormError(null);

    const refund = Number(refundInput);
    const refundChanged = refundInput.trim() !== '' && refund !== selected.refundAmount;
    if (newStatus !== 'REJECTED') {
      if (!Number.isInteger(refund) || refund < 0) {
        setFormError('مبلغ عودت باید عدد صحیح و بزرگ‌تر یا مساوی صفر باشد.');
        return;
      }
    }

    if (newStatus === 'REFUNDED' || newStatus === 'REJECTED') {
      const ok = await toast.confirm({
        title: newStatus === 'REFUNDED' ? 'تایید استرداد وجه مرجوعی' : 'تایید رد درخواست مرجوعی',
        description:
          newStatus === 'REFUNDED'
            ? `آیا از ثبت استرداد مبلغ ${formatToman(refund)} برای سفارش ${selected.orderNumber} اطمینان دارید؟ این عملیات پس از ثبت قابل تغییر مبلغ نیست.`
            : `آیا از رد ادعای مرجوعی سفارش ${selected.orderNumber} اطمینان دارید؟`,
        confirmLabel: newStatus === 'REFUNDED' ? 'تایید استرداد وجه' : 'رد درخواست',
        cancelLabel: 'انصراف',
        variant: newStatus === 'REJECTED' ? 'danger' : 'warning',
      });
      if (!ok) return;
    }

    const body: Record<string, unknown> = {
      id: selected.id,
      status: newStatus,
      adminNote,
    };
    if (newStatus !== 'REJECTED' && (refundChanged || newStatus === 'REFUNDED')) {
      body.refundAmount = refund;
    }

    setSaving(true);
    const result = await adminRequest<{ request: ReturnRequest }>('/api/admin/returns', {
      method: 'PATCH',
      body,
    });
    setSaving(false);
    if (!result.ok) {
      setFormError(result.message);
      toast.error(result.message);
      return;
    }
    const updated = result.data.request;
    // Keep the list in step with the server's answer, then reload so the counts are exact
    setData((prev) =>
      prev && updated
        ? { ...prev, returns: prev.returns.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)) }
        : prev
    );
    setSelected(null);
    toast.success(`وضعیت مرجوعی سفارش ${selected.orderNumber} با موفقیت به‌روزرسانی شد.`);
    void reload();
  };

  const filterButton = (value: StatusFilter, label: string, count: number, active: string, idle: string) => (
    <button
      type="button"
      aria-pressed={statusFilter === value}
      onClick={() => {
        setStatusFilter(value);
        setPage(1);
      }}
      className={`min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
        statusFilter === value ? active : idle
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
          <div className="flex items-center gap-2 text-xs font-bold text-[#D4A373]">
            <RotateCcw className="w-4 h-4 text-farm-primary" />
            <span>خدمات پس از فروش پروفارم</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-farm-primary mt-0.5">
            مدیریت مرجوعی کالا، تضمین کیفیت و بازگشت وجه
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            بررسی شکایات مشتریان، تایید عودت کالا (شکستگی، تازگی، اشتباه پیک) و ثبت استرداد وجه بانکی
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          disabled={loading}
          className="min-h-[44px] px-4 rounded-xl bg-white border border-farm-border text-xs font-bold text-farm-primary flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>بروزرسانی</span>
        </button>
      </div>

      {/* Summary cards (counts come from the server) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-farm-border shadow-farm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500">
            <span>در انتظار بررسی کارشناس</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-700">{toPersianDigits(counts.PENDING)} درخواست</div>
          <div className="text-xs text-gray-500">نیازمند تماس و بررسی ادعا</div>
        </div>
        <div className="bg-white rounded-3xl p-5 border border-farm-border shadow-farm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500">
            <span>تایید شده (در نوبت استرداد)</span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-800">{toPersianDigits(counts.APPROVED)} مورد</div>
          <div className="text-xs text-gray-500">آماده واریز به حساب مشتری</div>
        </div>
        <div className="bg-white rounded-3xl p-5 border border-farm-border shadow-farm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500">
            <span>عودت داده شده (مختومه)</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-farm-primary">{toPersianDigits(counts.REFUNDED)} فقره</div>
          <div className="text-xs text-emerald-700 font-medium">تسویه ثبت‌شده</div>
        </div>
        <div className="bg-white rounded-3xl p-5 border border-farm-border shadow-farm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500">
            <span>کل درخواست‌ها</span>
            <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-teal-900">{toPersianDigits(totalAll)}</div>
          <div className="text-xs text-teal-700 font-medium">رد شده: {toPersianDigits(counts.REJECTED)}</div>
        </div>
      </div>

      {/* Filters and search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div className="flex flex-wrap items-center gap-2">
          {filterButton('ALL', 'همه موارد', totalAll, 'bg-farm-primary text-white shadow-xs', 'bg-white text-gray-700 hover:bg-gray-100 border border-farm-border')}
          {filterButton('PENDING', 'در انتظار بررسی', counts.PENDING, 'bg-amber-600 text-white shadow-xs', 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200')}
          {filterButton('APPROVED', 'تایید شده', counts.APPROVED, 'bg-blue-600 text-white shadow-xs', 'bg-blue-50 text-blue-900 hover:bg-blue-100 border border-blue-200')}
          {filterButton('REFUNDED', 'عودت داده شده', counts.REFUNDED, 'bg-emerald-700 text-white shadow-xs', 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border border-emerald-200')}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-gray-500 absolute right-3 top-3.5" aria-hidden="true" />
          <label htmlFor="returns-search" className="sr-only">
            جستجوی مرجوعی
          </label>
          <input
            id="returns-search"
            type="search"
            placeholder="جستجو سفارش، مشتری، شماره تماس..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pr-9 pl-3 py-2.5 rounded-xl border border-farm-border bg-white text-xs text-gray-800 w-full sm:w-64 min-h-[44px] focus:outline-none focus:border-farm-primary"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-farm-border shadow-farm overflow-hidden">
        <AdminStatus
          hasData={data !== null}
          loading={loading}
          error={error}
          onRetry={() => void reload()}
          isEmpty={data !== null && returns.length === 0}
          emptyText="هیچ درخواست مرجوعی با شرایط فوق یافت نشد."
        />
        {returns.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs sm:text-sm">
              <thead className="bg-farm-bg border-b border-farm-border text-farm-primary">
                <tr>
                  <th scope="col" className="py-3.5 px-5 font-black">کد سفارش</th>
                  <th scope="col" className="py-3.5 px-5 font-black">مشتری و تماس</th>
                  <th scope="col" className="py-3.5 px-5 font-black">محصول و تعداد</th>
                  <th scope="col" className="py-3.5 px-5 font-black">علت مرجوعی</th>
                  <th scope="col" className="py-3.5 px-5 font-black">مبلغ استرداد</th>
                  <th scope="col" className="py-3.5 px-5 font-black">وضعیت</th>
                  <th scope="col" className="py-3.5 px-5 font-black">تاریخ ثبت</th>
                  <th scope="col" className="py-3.5 px-5 font-black">اقدام ادمین</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-farm-border">
                {returns.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-4 px-5 font-bold text-farm-primary font-mono" dir="ltr">{req.orderNumber}</td>
                    <td className="py-4 px-5">
                      <div className="font-bold text-gray-900">{req.customerName}</div>
                      <div className="text-xs text-gray-500 font-mono" dir="ltr">{toPersianDigits(req.customerPhone)}</div>
                    </td>
                    <td className="py-4 px-5">
                      <div className="font-bold text-gray-800">{req.productTitle}</div>
                      <div className="text-xs text-gray-500">تعداد: {toPersianDigits(req.quantity ?? 1)} بسته</div>
                    </td>
                    <td className="py-4 px-5">
                      <div className="font-medium text-gray-800">{req.reasonTitle || getReasonLabel(req.reason)}</div>
                      {req.description && (
                        <div className="text-xs text-gray-500 line-clamp-1 max-w-xs mt-0.5">«{req.description}»</div>
                      )}
                    </td>
                    <td className="py-4 px-5 font-black text-farm-primary">{formatToman(req.refundAmount)}</td>
                    <td className="py-4 px-5"><StatusBadge status={req.status} /></td>
                    <td className="py-4 px-5 text-gray-500 text-xs">{new Date(req.createdAt).toLocaleDateString('fa-IR')}</td>
                    <td className="py-4 px-5">
                      <button
                        type="button"
                        onClick={() => openReview(req)}
                        className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-gray-100 hover:bg-farm-primary hover:text-white text-gray-800 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>بررسی و تعیین تکلیف</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <AdminPager pagination={data?.pagination} onPage={setPage} disabled={loading} />

      {/* Review modal */}
      <Dialog
        open={selected !== null}
        onClose={closeReview}
        title="بررسی درخواست مرجوعی کالا"
        description={selected ? `سفارش ${selected.orderNumber} - ${selected.customerName}` : undefined}
        icon={<RotateCcw className="w-5 h-5 text-amber-800" />}
        size="lg"
      >
        {selected && (
          <form onSubmit={handleSaveReview} className="space-y-4 text-xs sm:text-sm">
            <div className="p-4 rounded-2xl bg-farm-bg border border-farm-border space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">کالای مرجوعی:</span>
                <span className="font-bold text-gray-800 text-left">
                  {selected.productTitle} ({toPersianDigits(selected.quantity ?? 1)} بسته)
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">علت اعلامی مشتری:</span>
                <span className="font-bold text-amber-800">{selected.reasonTitle || getReasonLabel(selected.reason)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">مبلغ استرداد ثبت‌شده:</span>
                <span className="font-black text-farm-primary">{formatToman(selected.refundAmount)}</span>
              </div>
              {selected.description && (
                <div className="pt-2 border-t border-gray-200">
                  <span className="text-gray-500 block mb-1">توضیحات تکمیلی مشتری:</span>
                  <p className="text-gray-700 bg-white p-2.5 rounded-xl border border-gray-200 text-xs leading-relaxed whitespace-pre-line break-words">
                    {selected.description}
                  </p>
                </div>
              )}
            </div>

            <fieldset className="space-y-2">
              <legend className="block font-black text-gray-800 text-xs mb-2">تصمیم کارشناس تضمین کیفیت:</legend>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['PENDING', 'در انتظار بررسی', 'bg-amber-600 border-amber-700'],
                    ['APPROVED', 'تایید عودت کالا', 'bg-blue-600 border-blue-700'],
                    ['REFUNDED', 'استرداد وجه انجام شد', 'bg-emerald-700 border-emerald-800'],
                    ['REJECTED', 'رد ادعای مرجوعی', 'bg-rose-700 border-rose-800'],
                  ] as const
                ).map(([value, label, activeClass]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={newStatus === value}
                    onClick={() => setNewStatus(value)}
                    className={`min-h-[44px] p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      newStatus === value ? `${activeClass} text-white` : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>

            {newStatus !== 'REJECTED' && (
              <div className="space-y-1.5">
                <label htmlFor="return-refund" className="block font-black text-gray-800 text-xs">
                  مبلغ استرداد (تومان):
                </label>
                <input
                  id="return-refund"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={refundInput}
                  onChange={(e) => setRefundInput(e.target.value)}
                  disabled={selected.status === 'REFUNDED'}
                  className="w-full min-h-[44px] p-3 rounded-xl border border-farm-border bg-farm-bg text-xs font-medium text-gray-800 focus:outline-none focus:border-farm-primary disabled:opacity-60"
                  dir="ltr"
                />
                {selected.status === 'REFUNDED' && (
                  <p className="text-[11px] text-gray-500">پس از ثبت استرداد، مبلغ قابل تغییر نیست.</p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="return-note" className="block font-black text-gray-800 text-xs">
                یادداشت و نتیجه پیگیری ادمین:
              </label>
              <textarea
                id="return-note"
                rows={3}
                maxLength={1000}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                className="w-full p-3 rounded-xl border border-farm-border bg-farm-bg focus:bg-white text-xs font-medium text-gray-800 focus:outline-none focus:border-farm-primary"
              />
            </div>

            {formError && (
              <p role="alert" className="text-xs font-bold text-rose-700">
                {formError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={closeReview}
                disabled={saving}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-[44px] px-6 py-2 rounded-xl bg-farm-primary text-white text-xs font-bold hover:bg-farm-primary-dark shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4 text-[#D4A373]" />
                <span>{saving ? 'در حال ثبت...' : 'ثبت تغییرات وضعیت'}</span>
              </button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
