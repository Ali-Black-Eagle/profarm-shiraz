'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { farmStore } from '@/lib/db-store';
import { ProductReview, ReviewStatus, Product } from '@/types';
import { toPersianDigits } from '@/lib/formatters';
import { useToast, useConfirm } from '@/components/ui/ToastProvider';
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
  Sparkles,
  Search,
  Filter,
  Check,
  AlertTriangle,
} from 'lucide-react';

export default function AdminReviewsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | ReviewStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Reply state
  const [replyingReviewId, setReplyingReviewId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const refreshData = () => {
    setReviews(farmStore.getAllReviews());
    setProducts(farmStore.getProducts());
  };

  useEffect(() => {
    refreshData();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Status updates
  const handleApprove = (reviewId: string) => {
    const res = farmStore.updateReviewStatus(reviewId, 'APPROVED');
    if (res) {
      showToast('دیدگاه با موفقیت تایید شد و اکنون در صفحه محصول نمایش داده می‌شود.');
      refreshData();
    }
  };

  const handleReject = (reviewId: string) => {
    const res = farmStore.updateReviewStatus(reviewId, 'REJECTED');
    if (res) {
      showToast('دیدگاه رد شد و از دید عموم مخفی گردید.');
      refreshData();
    }
  };

  const handleDelete = async (reviewId: string) => {
    const ok = await confirm({
      title: 'حذف دائمی دیدگاه',
      description: 'آیا از حذف دائمی این دیدگاه اطمینان دارید؟ این عملیات غیرقابل بازگشت است.',
      confirmLabel: 'حذف دائمی',
      cancelLabel: 'انصراف',
      variant: 'danger',
    });
    if (!ok) return;
    const res = farmStore.deleteReview(reviewId);
    if (res) {
      showToast('دیدگاه به طور کامل حذف شد.');
      toast.success('دیدگاه به طور کامل حذف شد.');
      refreshData();
    }
  };

  const handleSaveReply = (reviewId: string) => {
    if (!replyText.trim()) return;
    const currentRev = reviews.find((r) => r.id === reviewId);
    const status = currentRev?.status || 'APPROVED';
    const res = farmStore.updateReviewStatus(reviewId, status, replyText.trim());
    if (res) {
      showToast('پاسخ رسمی ادمین با موفقیت ثبت شد.');
      setReplyingReviewId(null);
      setReplyText('');
      refreshData();
    }
  };

  // Metrics
  const pendingCount = reviews.filter((r) => r.status === 'PENDING').length;
  const approvedCount = reviews.filter((r) => r.status === 'APPROVED').length;
  const rejectedCount = reviews.filter((r) => r.status === 'REJECTED').length;
  const averageRating =
    reviews.length > 0
      ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
      : '0.0';

  // Filtered reviews
  const filteredReviews = reviews.filter((r) => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchText =
        r.userName.toLowerCase().includes(q) ||
        (r.userPhone && r.userPhone.includes(q)) ||
        r.comment.toLowerCase().includes(q) ||
        (r.title && r.title.toLowerCase().includes(q)) ||
        r.productTitle.toLowerCase().includes(q);
      if (!matchText) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-50 bg-[#1E3520] text-white px-5 py-3 rounded-2xl shadow-xl border border-[#D4A373]/30 flex items-center gap-3 animate-fade-in text-sm font-bold">
          <CheckCircle2 className="w-5 h-5 text-[#D4AF37]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[#E6E1D5] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
              <Star className="w-6 h-6 fill-amber-400" />
            </span>
            <h1 className="text-2xl font-black text-gray-900">نظرات و بازخورد خریداران واقعی</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            بررسی و تایید دیدگاه‌های مشتریان مزارع فارس • فقط کاربران با سفارش تحویل‌شده مجاز به ثبت دیدگاه هستند
          </p>
        </div>

        {pendingCount > 0 && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold animate-pulse">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>{toPersianDigits(pendingCount)} دیدگاه جدید در انتظار تایید شماست</span>
          </div>
        )}
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#E6E1D5] shadow-xs">
          <div className="flex items-center justify-between text-gray-500 text-xs font-bold mb-2">
            <span>کل نظرات ثبت‌شده</span>
            <MessageSquare className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-2xl font-black text-gray-900">{toPersianDigits(reviews.length)}</div>
          <span className="text-[11px] text-gray-400 mt-1 block">از خریداران محصولات ارگانیک</span>
        </div>

        <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-200/80 shadow-xs">
          <div className="flex items-center justify-between text-amber-800 text-xs font-bold mb-2">
            <span>در انتظار تایید ادمین</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700">{toPersianDigits(pendingCount)}</div>
          <span className="text-[11px] text-amber-600/80 mt-1 block">نیازمند بررسی قبل از انتشار</span>
        </div>

        <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-200/80 shadow-xs">
          <div className="flex items-center justify-between text-emerald-800 text-xs font-bold mb-2">
            <span>تایید شده و عمومی</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">{toPersianDigits(approvedCount)}</div>
          <span className="text-[11px] text-emerald-600/80 mt-1 block">در صفحه محصولات فعال است</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E6E1D5] shadow-xs">
          <div className="flex items-center justify-between text-gray-500 text-xs font-bold mb-2">
            <span>میانگین امتیاز رضایت</span>
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
          </div>
          <div className="text-2xl font-black text-gray-900 flex items-baseline gap-1">
            <span>{toPersianDigits(averageRating)}</span>
            <span className="text-xs text-gray-400 font-normal">از ۵</span>
          </div>
          <span className="text-[11px] text-gray-400 mt-1 block">شاخص کیفی ارگانیک مزارع</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E6E1D5] flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'ALL'
                ? 'bg-[#2C4A2E] text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            همه نظرات ({toPersianDigits(reviews.length)})
          </button>
          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              statusFilter === 'PENDING'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>در انتظار بررسی ({toPersianDigits(pendingCount)})</span>
          </button>
          <button
            onClick={() => setStatusFilter('APPROVED')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              statusFilter === 'APPROVED'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>تایید شده ({toPersianDigits(approvedCount)})</span>
          </button>
          <button
            onClick={() => setStatusFilter('REJECTED')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              statusFilter === 'REJECTED'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>رد شده ({toPersianDigits(rejectedCount)})</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="جستجو در متن نظر، نام خریدار یا محصول..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-10 pl-4 py-2 rounded-xl border border-gray-200 text-xs text-gray-800 bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E]"
          />
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {filteredReviews.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-[#E6E1D5]">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-bold text-gray-700 text-base">هیچ دیدگاهی در این بخش یافت نشد</h3>
            <p className="text-xs text-gray-400 mt-1">با تغییر فیلترها یا جستجو می‌توانید نتایج دیگری را ببینید.</p>
          </div>
        ) : (
          filteredReviews.map((review) => {
            const product = products.find((p) => p.slug === review.productSlug);
            const isReplying = replyingReviewId === review.id;

            return (
              <div
                key={review.id}
                className={`bg-white rounded-3xl border transition-all p-6 space-y-4 ${
                  review.status === 'PENDING'
                    ? 'border-amber-300 shadow-md ring-2 ring-amber-100'
                    : review.status === 'REJECTED'
                    ? 'border-rose-200 opacity-75'
                    : 'border-[#E6E1D5] hover:border-gray-300'
                }`}
              >
                {/* Review Top Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                  {/* Product Details */}
                  <div className="flex items-center gap-3">
                    {product?.images?.[0] ? (
                      <img
                        src={product.images[0]}
                        alt={review.productTitle}
                        className="w-12 h-12 object-cover rounded-xl border border-gray-200 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                        <MessageSquare className="w-5 h-5 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/products/${review.productSlug}`}
                          target="_blank"
                          className="font-black text-gray-900 hover:text-[#2C4A2E] text-sm flex items-center gap-1 group"
                        >
                          <span>{review.productTitle}</span>
                          <ExternalLink className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#2C4A2E]" />
                        </Link>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        <span className="font-bold text-gray-700">{review.userName}</span>
                        <span>•</span>
                        <span dir="ltr" className="font-mono text-gray-400">
                          {review.userPhone}
                        </span>
                        {review.isVerifiedBuyer && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            <span>خریدار تایید شده</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Badge & Rating */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-4 h-4 ${
                            s <= review.rating
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-gray-200 fill-gray-200'
                          }`}
                        />
                      ))}
                      <span className="text-xs font-bold text-gray-700 mr-1.5">
                        ({toPersianDigits(review.rating)} از ۵)
                      </span>
                    </div>

                    <div>
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
                </div>

                {/* Review Body */}
                <div className="space-y-2">
                  {review.title && (
                    <h4 className="font-bold text-gray-900 text-sm">{review.title}</h4>
                  )}
                  <p className="text-gray-700 text-xs leading-relaxed">{review.comment}</p>

                  {/* Pros & Cons */}
                  {((review.pros && review.pros.length > 0) || (review.cons && review.cons.length > 0)) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      {review.pros && review.pros.length > 0 && (
                        <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100 space-y-1">
                          <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
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
                          <span className="text-[11px] font-bold text-rose-800 flex items-center gap-1">
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

                  {/* Recommendation */}
                  {review.isRecommended !== undefined && (
                    <div className="text-xs font-bold pt-1">
                      {review.isRecommended ? (
                        <span className="text-emerald-700 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>این کالا را به دیگران پیشنهاد می‌کنم</span>
                        </span>
                      ) : (
                        <span className="text-gray-500 flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5 text-gray-400" />
                          <span>خرید این کالا را به دیگران پیشنهاد نمی‌کنم</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Existing Admin Reply if any */}
                {review.adminResponse && (
                  <div className="p-3.5 rounded-2xl bg-[#2C4A2E]/5 border border-[#2C4A2E]/20 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#2C4A2E]">
                      <CornerDownLeft className="w-3.5 h-3.5" />
                      <span>پاسخ رسمی پشتیبانی پروفارم:</span>
                    </div>
                    <p className="text-xs text-gray-800 pr-5 leading-relaxed">{review.adminResponse}</p>
                  </div>
                )}

                {/* Inline Reply Form */}
                {isReplying && (
                  <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-3 animate-fade-in">
                    <label className="block text-xs font-bold text-gray-700">
                      پاسخ رسمی ادمین به نظر «{review.userName}»:
                    </label>
                    <textarea
                      rows={3}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="متن پاسخ رسمی مزرعه را بنویسید (در صفحه محصول به عنوان پاسخ رسمی ادمین نمایش داده می‌شود)..."
                      className="w-full p-3 rounded-xl border border-gray-200 bg-white text-xs font-medium text-gray-800 focus:outline-none focus:border-[#2C4A2E]"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingReviewId(null);
                          setReplyText('');
                        }}
                        className="px-4 py-1.5 rounded-xl border border-gray-300 text-gray-600 text-xs font-bold hover:bg-gray-100 transition-colors cursor-pointer"
                      >
                        انصراف
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveReply(review.id)}
                        className="px-4 py-1.5 rounded-xl bg-[#2C4A2E] text-white text-xs font-bold hover:bg-[#1E3520] transition-colors cursor-pointer"
                      >
                        ثبت پاسخ رسمی
                      </button>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100 text-xs">
                  <div className="text-gray-400 text-[11px]">
                    تاریخ ثبت: {new Date(review.createdAt).toLocaleDateString('fa-IR')} • کد رهگیری سفارش:{' '}
                    <span className="font-mono">{review.orderId}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Approve button */}
                    {review.status !== 'APPROVED' && (
                      <button
                        type="button"
                        onClick={() => handleApprove(review.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>تایید و انتشار</span>
                      </button>
                    )}

                    {/* Reject button */}
                    {review.status !== 'REJECTED' && (
                      <button
                        type="button"
                        onClick={() => handleReject(review.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>رد دیدگاه</span>
                      </button>
                    )}

                    {/* Reply button */}
                    {!isReplying && (
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingReviewId(review.id);
                          setReplyText(review.adminResponse || '');
                        }}
                        className="px-3.5 py-1.5 rounded-xl border border-gray-200 hover:border-[#2C4A2E] hover:text-[#2C4A2E] text-gray-700 font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <CornerDownLeft className="w-3.5 h-3.5" />
                        <span>{review.adminResponse ? 'ویرایش پاسخ' : 'پاسخ رسمی ادمین'}</span>
                      </button>
                    )}

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => handleDelete(review.id)}
                      className="p-2 rounded-xl text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="حذف دائمی"
                    >
                      <Trash2 className="w-4 h-4" />
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
