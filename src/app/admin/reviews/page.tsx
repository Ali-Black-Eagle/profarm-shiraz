'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ProductReview, ReviewStatus } from '@/types';
import { toPersianDigits } from '@/lib/formatters';
import { useToast } from '@/components/ui/ToastProvider';
import {
  Star,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  Trash2,
  CornerDownLeft,
  ExternalLink,
  ShieldCheck,
  ThumbsUp,
  ThumbsDown,
  Search,
  Check,
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

type StatusFilter = 'ALL' | ReviewStatus;

interface ReviewsPayload {
  reviews: ProductReview[];
  pagination: AdminPagination;
  counts: Record<ReviewStatus, number>;
}

const EMPTY_COUNTS: Record<ReviewStatus, number> = { PENDING: 0, APPROVED: 0, REJECTED: 0 };

export default function AdminReviewsPage() {
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const url = adminQuery('/api/admin/reviews', {
    status: statusFilter,
    q: searchQuery,
    page,
    pageSize: 20,
  });
  const { data, error, loading, reload, setData } = useAdminFetch<ReviewsPayload>(url);
  const reviews = useMemo(() => data?.reviews ?? [], [data]);
  const counts = data?.counts ?? EMPTY_COUNTS;
  const total = counts.PENDING + counts.APPROVED + counts.REJECTED;

  // Reply editor
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const replaceReview = (id: string, patch: Partial<ProductReview>) => {
    setData((prev) => (prev ? { ...prev, reviews: prev.reviews.map((r) => (r.id === id ? { ...r, ...patch } : r)) } : prev));
  };

  /** Moves a review to APPROVED or REJECTED. The list is updated at once and rolled back if the server refuses. */
  const moderate = async (review: ProductReview, status: 'APPROVED' | 'REJECTED', adminReply?: string) => {
    if (busyId) return;
    const previousStatus = review.status;
    const previousReply = review.adminResponse;
    setBusyId(review.id);
    const optimistic: Partial<ProductReview> = { status };
    if (adminReply !== undefined) optimistic.adminResponse = adminReply;
    replaceReview(review.id, optimistic);

    const body: Record<string, unknown> = { id: review.id, status };
    if (adminReply !== undefined) body.adminReply = adminReply;
    const result = await adminRequest<{ review: ProductReview }>('/api/admin/reviews', { method: 'PATCH', body });
    setBusyId(null);
    if (!result.ok) {
      replaceReview(review.id, { status: previousStatus, adminResponse: previousReply });
      toast.error(result.message);
      return false;
    }
    void reload();
    return true;
  };

  const handleApprove = async (review: ProductReview) => {
    if (await moderate(review, 'APPROVED')) {
      toast.success('دیدگاه با موفقیت تایید شد و اکنون در صفحه محصول نمایش داده می‌شود.');
    }
  };

  const handleReject = async (review: ProductReview) => {
    if (await moderate(review, 'REJECTED')) {
      toast.success('دیدگاه رد شد و از دید عموم مخفی گردید.');
    }
  };

  const handleSaveReply = async (review: ProductReview) => {
    const text = replyText.trim();
    if (!text || (review.status !== 'APPROVED' && review.status !== 'REJECTED')) return;
    const ok = await moderate(review, review.status, text);
    if (ok) {
      toast.success('پاسخ رسمی ادمین با موفقیت ثبت شد.');
      setReplyingId(null);
      setReplyText('');
    }
  };

  const handleDelete = async (review: ProductReview) => {
    if (busyId) return;
    const ok = await toast.confirm({
      title: 'حذف دائمی دیدگاه',
      description: 'آیا از حذف دائمی این دیدگاه اطمینان دارید؟ این عملیات غیرقابل بازگشت است.',
      confirmLabel: 'حذف دائمی',
      cancelLabel: 'انصراف',
      variant: 'danger',
    });
    if (!ok) return;
    setBusyId(review.id);
    const result = await adminRequest(`/api/admin/reviews?id=${encodeURIComponent(review.id)}`, { method: 'DELETE' });
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success('دیدگاه به طور کامل حذف شد.');
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
      className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold transition-all ${statusFilter === value ? active : idle}`}
    >
      {label} ({toPersianDigits(count)})
    </button>
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-farm-border shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
              <Star className="w-6 h-6 fill-amber-400" />
            </span>
            <h1 className="text-2xl font-black text-gray-900">نظرات و بازخورد خریداران</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            بررسی و تایید دیدگاه‌های مشتریان مزارع فارس. فقط کاربرانی که سفارش‌شان تحویل داده شده می‌توانند دیدگاه ثبت کنند.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {counts.PENDING > 0 && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>{toPersianDigits(counts.PENDING)} دیدگاه در انتظار تایید شماست</span>
            </div>
          )}
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
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-farm-border shadow-xs">
          <div className="flex items-center justify-between text-gray-500 text-xs font-bold mb-2">
            <span>کل نظرات ثبت‌شده</span>
            <MessageSquare className="w-4 h-4 text-gray-500" />
          </div>
          <div className="text-2xl font-black text-gray-900">{toPersianDigits(total)}</div>
        </div>
        <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-200/80 shadow-xs">
          <div className="flex items-center justify-between text-amber-800 text-xs font-bold mb-2">
            <span>در انتظار تایید ادمین</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700">{toPersianDigits(counts.PENDING)}</div>
        </div>
        <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-200/80 shadow-xs">
          <div className="flex items-center justify-between text-emerald-800 text-xs font-bold mb-2">
            <span>تایید شده و عمومی</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">{toPersianDigits(counts.APPROVED)}</div>
        </div>
      </div>

      {/* Filters and search */}
      <div className="bg-white p-4 rounded-2xl border border-farm-border flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {filterButton('ALL', 'همه نظرات', total, 'bg-farm-primary text-white shadow-sm', 'bg-gray-100 text-gray-700 hover:bg-gray-200')}
          {filterButton('PENDING', 'در انتظار بررسی', counts.PENDING, 'bg-amber-600 text-white shadow-sm', 'bg-amber-50 text-amber-800 hover:bg-amber-100')}
          {filterButton('APPROVED', 'تایید شده', counts.APPROVED, 'bg-emerald-600 text-white shadow-sm', 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100')}
          {filterButton('REJECTED', 'رد شده', counts.REJECTED, 'bg-rose-600 text-white shadow-sm', 'bg-rose-50 text-rose-800 hover:bg-rose-100')}
        </div>
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-gray-500 absolute right-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <label htmlFor="reviews-search" className="sr-only">
            جستجوی دیدگاه
          </label>
          <input
            id="reviews-search"
            type="search"
            placeholder="جستجو در متن نظر، نام خریدار یا محصول..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full min-h-[44px] pr-10 pl-4 py-2 rounded-xl border border-gray-200 text-xs text-gray-800 bg-farm-bg focus:bg-white focus:outline-none focus:border-farm-primary"
          />
        </div>
      </div>

      {/* List */}
      <AdminStatus
        hasData={data !== null}
        loading={loading}
        error={error}
        onRetry={() => void reload()}
        isEmpty={data !== null && reviews.length === 0}
        emptyText="هیچ دیدگاهی در این بخش یافت نشد. با تغییر فیلترها یا جستجو نتایج دیگری را ببینید."
      />

      <div className="space-y-4">
        {reviews.map((review) => {
          const isReplying = replyingId === review.id;
          const isBusy = busyId === review.id;
          const canReply = review.status === 'APPROVED' || review.status === 'REJECTED';
          return (
            <div
              key={review.id}
              className={`bg-white rounded-3xl border transition-all p-6 space-y-4 ${
                review.status === 'PENDING'
                  ? 'border-amber-300 shadow-md ring-2 ring-amber-100'
                  : review.status === 'REJECTED'
                  ? 'border-rose-200 opacity-80'
                  : 'border-farm-border hover:border-gray-300'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                <div className="min-w-0">
                  <Link
                    href={`/products/${review.productSlug}`}
                    target="_blank"
                    className="font-black text-gray-900 hover:text-farm-primary text-sm inline-flex items-center gap-1 group"
                  >
                    <span>{review.productTitle}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-gray-500 group-hover:text-farm-primary" />
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-0.5">
                    <span className="font-bold text-gray-700">{review.userName}</span>
                    {review.userPhone && (
                      <>
                        <span aria-hidden="true">•</span>
                        <span dir="ltr" className="font-mono text-gray-600">
                          {toPersianDigits(review.userPhone)}
                        </span>
                      </>
                    )}
                    {review.isVerifiedBuyer && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-xs">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        <span>خریدار تایید شده</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1" aria-label={`امتیاز ${toPersianDigits(review.rating)} از ۵`}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        aria-hidden="true"
                        className={`w-4 h-4 ${s <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}`}
                      />
                    ))}
                  </div>
                  {review.status === 'PENDING' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-amber-100 text-amber-800 font-bold text-xs">
                      <Clock className="w-3.5 h-3.5" />
                      <span>در انتظار تایید ادمین</span>
                    </span>
                  )}
                  {review.status === 'APPROVED' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>تایید و منتشر شده</span>
                    </span>
                  )}
                  {review.status === 'REJECTED' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-rose-100 text-rose-800 font-bold text-xs">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>رد شده (مخفی)</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {review.title && <h4 className="font-bold text-gray-900 text-sm">{review.title}</h4>}
                <p className="text-gray-700 text-xs leading-relaxed whitespace-pre-line break-words">{review.comment}</p>

                {((review.pros && review.pros.length > 0) || (review.cons && review.cons.length > 0)) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {review.pros && review.pros.length > 0 && (
                      <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100 space-y-1">
                        <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                          <ThumbsUp className="w-3 h-3 text-emerald-600" />
                          <span>نقاط قوت از نظر خریدار:</span>
                        </span>
                        <ul className="text-xs text-emerald-900 space-y-0.5 pr-2 list-disc list-inside">
                          {review.pros.map((p, idx) => (
                            <li key={idx}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {review.cons && review.cons.length > 0 && (
                      <div className="bg-rose-50/60 p-2.5 rounded-xl border border-rose-100 space-y-1">
                        <span className="text-xs font-bold text-rose-800 flex items-center gap-1">
                          <ThumbsDown className="w-3 h-3 text-rose-600" />
                          <span>نقاط ضعف از نظر خریدار:</span>
                        </span>
                        <ul className="text-xs text-rose-900 space-y-0.5 pr-2 list-disc list-inside">
                          {review.cons.map((c, idx) => (
                            <li key={idx}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {review.adminResponse && (
                <div className="p-3.5 rounded-2xl bg-farm-primary/5 border border-farm-primary/20 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-farm-primary">
                    <CornerDownLeft className="w-3.5 h-3.5" />
                    <span>پاسخ رسمی پشتیبانی پروفارم:</span>
                  </div>
                  <p className="text-xs text-gray-800 pr-5 leading-relaxed whitespace-pre-line break-words">{review.adminResponse}</p>
                </div>
              )}

              {isReplying && (
                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-3">
                  <label htmlFor={`reply-${review.id}`} className="block text-xs font-bold text-gray-700">
                    پاسخ رسمی ادمین به نظر «{review.userName}»:
                  </label>
                  <textarea
                    id={`reply-${review.id}`}
                    rows={3}
                    maxLength={1000}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="w-full p-3 rounded-xl border border-gray-200 bg-white text-xs font-medium text-gray-800 focus:outline-none focus:border-farm-primary"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setReplyingId(null);
                        setReplyText('');
                      }}
                      className="min-h-[44px] px-4 rounded-xl border border-gray-300 text-gray-600 text-xs font-bold hover:bg-gray-100 cursor-pointer"
                    >
                      انصراف
                    </button>
                    <button
                      type="button"
                      disabled={isBusy || !replyText.trim()}
                      onClick={() => void handleSaveReply(review)}
                      className="min-h-[44px] px-4 rounded-xl bg-farm-primary text-white text-xs font-bold hover:bg-farm-primary-dark cursor-pointer disabled:opacity-50"
                    >
                      ثبت پاسخ رسمی
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100 text-xs">
                <div className="text-gray-600 text-xs">
                  تاریخ ثبت: {new Date(review.createdAt).toLocaleDateString('fa-IR')}
                  {review.orderId && (
                    <>
                      {' '}• کد سفارش: <span className="font-mono" dir="ltr">{review.orderId}</span>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {review.status !== 'APPROVED' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleApprove(review)}
                      className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>تایید و انتشار</span>
                    </button>
                  )}
                  {review.status !== 'REJECTED' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleReject(review)}
                      className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>رد دیدگاه</span>
                    </button>
                  )}
                  {canReply && !isReplying && (
                    <button
                      type="button"
                      onClick={() => {
                        setReplyingId(review.id);
                        setReplyText(review.adminResponse || '');
                      }}
                      className="min-h-[44px] px-3.5 py-1.5 rounded-xl border border-gray-200 hover:border-farm-primary hover:text-farm-primary text-gray-700 font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <CornerDownLeft className="w-3.5 h-3.5" />
                      <span>{review.adminResponse ? 'ویرایش پاسخ' : 'پاسخ رسمی ادمین'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleDelete(review)}
                    aria-label="حذف دائمی دیدگاه"
                    title="حذف دائمی"
                    className="min-w-[44px] min-h-[44px] p-2 rounded-xl text-gray-600 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4 mx-auto" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <AdminPager pagination={data?.pagination} onPage={setPage} disabled={loading} />
    </div>
  );
}
