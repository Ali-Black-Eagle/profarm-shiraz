'use client';

import React, { useState, useEffect } from 'react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import Link from 'next/link';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { formatToman, toPersianDigits } from '@/lib/formatters';
import { SITE_CONFIG } from '@/lib/site-config';
import { ProductCard } from '@/components/modules/ProductCard';
import type { Product } from '@/types';
import {
  Sparkles,
  Truck,
  ShieldCheck,
  Package,
  Plus,
  Minus,
  CheckCircle2,
  ChevronRight,
  Scale,
  Maximize2,
  Warehouse,
  ShoppingBag,
  Star,
  Flame,
  Info,
  Check,
  X,
  HelpCircle,
  ThumbsUp,
  ThumbsDown,
  CornerDownLeft,
  Share2,
  MapPin,
  Calendar,
  AlertCircle,
  ChevronDown,
  Award,
  Lock,
} from 'lucide-react';

/** Approved review as the public API shapes it: masked reviewer name, no contact data. */
export interface StorefrontReview {
  id: string;
  rating: number;
  title: string | null;
  comment: string;
  pros: string[];
  cons: string[];
  isRecommended: boolean | null;
  isVerifiedBuyer: boolean;
  adminResponse: string | null;
  userName: string;
  /** Persian calendar date, formatted on the server. */
  dateLabel: string;
}

interface ProductDetailClientProps {
  product: Product;
  reviews: StorefrontReview[];
  related: Product[];
  /** True when the visitor came from the post-delivery SMS link (?review=true). */
  openReview?: boolean;
}

export default function ProductDetailClient({
  product,
  reviews,
  related,
  openReview = false,
}: ProductDetailClientProps) {
  const { user, isAuthenticated } = useAuth();
  const { items, addItem, updateQuantity } = useCart();

  const [activeTab, setActiveTab] = useState<'specs' | 'nutrition' | 'faqs' | 'reviews'>('specs');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [selectedImage, setSelectedImage] = useState<string>(product.images[0] || '/images/prod-eggs.jpg');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Review Form Modal State
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isEligibilityModalOpen, setIsEligibilityModalOpen] = useState(false);
  useEscapeKey(isEligibilityModalOpen, () => setIsEligibilityModalOpen(false));
  useEscapeKey(isReviewModalOpen, () => setIsReviewModalOpen(false));
  const [ineligibilityReason, setIneligibilityReason] = useState<string>('');

  // Review Input Fields
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewPros, setReviewPros] = useState<string[]>([]);
  const [proInput, setProInput] = useState('');
  const [reviewCons, setReviewCons] = useState<string[]>([]);
  const [conInput, setConInput] = useState('');
  const [isRecommended, setIsRecommended] = useState<boolean>(true);
  const [reviewSubmittedSuccess, setReviewSubmittedSuccess] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewFormError, setReviewFormError] = useState<string | null>(null);

  // Sticky Bar visibility
  const [showStickyBar, setShowStickyBar] = useState(false);

  // Quantity picked on the page before the item is in the cart
  const [selectedQty, setSelectedQty] = useState(1);
  const cartItem = items.find((i) => i.product.id === product.id);

  // Synchronize selectedQty with cart quantity if item exists in cart
  useEffect(() => {
    if (cartItem) {
      setSelectedQty(cartItem.quantity);
    }
  }, [cartItem]);

  // Post-delivery SMS link (?review=true): open the reviews tab and, for signed-in buyers, the form
  useEffect(() => {
    if (!openReview) return;
    setActiveTab('reviews');
    const timer = window.setTimeout(() => {
      document.getElementById('reviews-section')?.scrollIntoView({ behavior: 'smooth' });
      handleOpenReviewModal();
    }, 500);
    return () => window.clearTimeout(timer);
    // Runs once per page view; the handler reads the current user at call time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openReview]);

  // Scroll listener for sticky bottom bar
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 500) {
        setShowStickyBar(true);
      } else {
        setShowStickyBar(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleAddToCart = () => {
    addItem(product, selectedQty);
    showToast(`تعداد ${toPersianDigits(selectedQty)} بسته با موفقیت به سبد خرید افزوده شد.`);
  };

  const handleIncreaseQty = () => {
    const maxStock = product.stock || 1;
    if (cartItem) {
      const next = Math.min(maxStock, cartItem.quantity + 1);
      if (next !== cartItem.quantity) {
        updateQuantity(product.id, next);
        showToast(`تعداد سفارش به ${toPersianDigits(next)} بسته افزایش یافت.`);
      }
    } else {
      setSelectedQty((prev) => Math.min(maxStock, prev + 1));
    }
  };

  const handleDecreaseQty = () => {
    if (cartItem) {
      const next = cartItem.quantity - 1;
      if (next <= 0) {
        updateQuantity(product.id, 0);
        setSelectedQty(1);
        showToast('محصول از سبد خرید حذف شد.');
      } else {
        updateQuantity(product.id, next);
        showToast(`تعداد سفارش به ${toPersianDigits(next)} بسته کاهش یافت.`);
      }
    } else {
      setSelectedQty((prev) => Math.max(1, prev - 1));
    }
  };

  // Opens the review form for signed-in visitors. Whether the visitor bought and received the product is
  // decided by the server when the review is submitted (403 otherwise), so there is no client-side guess.
  const handleOpenReviewModal = () => {
    if (!user || !user.id) {
      setIneligibilityReason('جهت ثبت نظر برای این کالا ابتدا باید وارد حساب کاربری خود شوید.');
      setIsEligibilityModalOpen(true);
      return;
    }
    setReviewFormError(null);
    setIsReviewModalOpen(true);
  };

  const handleAddPro = () => {
    if (proInput.trim()) {
      setReviewPros((prev) => [...prev, proInput.trim()]);
      setProInput('');
    }
  };

  const handleRemovePro = (idx: number) => {
    setReviewPros((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddCon = () => {
    if (conInput.trim()) {
      setReviewCons((prev) => [...prev, conInput.trim()]);
      setConInput('');
    }
  };

  const handleRemoveCon = (idx: number) => {
    setReviewCons((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || reviewSubmitting) return;
    if (!reviewComment.trim()) {
      setReviewFormError('لطفاً متن نظر خود را وارد فرمایید.');
      return;
    }

    setReviewFormError(null);
    setReviewSubmitting(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productSlug: product.slug,
          rating: reviewRating,
          title: reviewTitle.trim() || undefined,
          comment: reviewComment.trim(),
          pros: reviewPros,
          cons: reviewCons,
          isRecommended,
        }),
      });
      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        setReviewSubmittedSuccess(true);
        setTimeout(() => {
          setIsReviewModalOpen(false);
          setReviewSubmittedSuccess(false);
          setReviewRating(5);
          setReviewTitle('');
          setReviewComment('');
          setReviewPros([]);
          setReviewCons([]);
          showToast(data?.message || 'دیدگاه شما ثبت شد و پس از تایید مدیریت منتشر می‌شود.');
        }, 2500);
        return;
      }

      const message = data?.message || 'ثبت دیدگاه با خطا مواجه شد. لطفاً دوباره تلاش کنید.';
      if (res.status === 401 || res.status === 403) {
        // Not signed in, or not a delivered buyer of this product: explain the rule
        setIsReviewModalOpen(false);
        setIneligibilityReason(message);
        setIsEligibilityModalOpen(true);
      } else if (res.status === 409) {
        setIsReviewModalOpen(false);
        showToast(message);
      } else {
        setReviewFormError(message);
      }
    } catch {
      setReviewFormError('ارتباط با سرور برقرار نشد. لطفاً اتصال اینترنت خود را بررسی کنید.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  // Calculations for Ratings (never invent 5.0 when there are no reviews)
  const totalApprovedReviews = reviews.length;
  const averageRating =
    totalApprovedReviews > 0
      ? (reviews.reduce((acc, r) => acc + r.rating, 0) / totalApprovedReviews).toFixed(1)
      : null;

  // Related products come from the server (same category first)
  const relatedProducts = related;

  const isAvailable =
    product.status !== 'COMING_SOON' &&
    product.status !== 'OUT_OF_STOCK' &&
    (product.stock || 0) > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div role="status" className="fixed top-24 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-2rem)] bg-farm-primary-dark text-white px-5 py-3 rounded-2xl shadow-2xl border border-farm-accent/30 flex items-center gap-3 animate-in fade-in text-sm font-bold">
          <CheckCircle2 className="w-5 h-5 text-[#D4AF37]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-gray-500 font-medium">
        <Link href="/" className="hover:text-farm-primary transition-colors">
          صفحه اصلی
        </Link>
        <ChevronRight className="w-3.5 h-3.5 rotate-180 text-gray-500" />
        <Link href="/products" className="hover:text-farm-primary transition-colors">
          محصولات ارگانیک
        </Link>
        <ChevronRight className="w-3.5 h-3.5 rotate-180 text-gray-500" />
        <Link
          href={`/products?category=${encodeURIComponent(product.category)}`}
          className="hover:text-farm-primary transition-colors"
        >
          {product.category}
        </Link>
        <ChevronRight className="w-3.5 h-3.5 rotate-180 text-gray-500" />
        <span className="text-farm-primary font-bold truncate max-w-xs">{product.title}</span>
      </nav>

      {/* ================= HERO SECTION ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
        {/* Left: Image Gallery */}
        <div className="lg:col-span-6 space-y-4">
          <div className="relative aspect-4/3 sm:aspect-square w-full rounded-3xl overflow-hidden bg-white border border-farm-border shadow-farm group">
            <img
              src={selectedImage || product.images[0]}
              alt={product.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />

            {/* Badges on image */}
            <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
              {product.isOrganicCertified && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white/95 backdrop-blur-md shadow-md text-farm-primary font-bold text-xs">
                  <Sparkles className="w-3.5 h-3.5 text-[#D4A373]" />
                  <span>تاییدیه ۱۰۰٪ ارگانیک فارس</span>
                </span>
              )}
              {product.originLocation && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-farm-primary/90 backdrop-blur-md shadow-md text-white font-bold text-xs">
                  <MapPin className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>{product.originLocation}</span>
                </span>
              )}
            </div>
          </div>

          {/* Thumbnails */}
          {product.images.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-2">
              {product.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(img)}
                  className={`w-20 h-20 rounded-2xl overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${
                    selectedImage === img
                      ? 'border-farm-primary ring-2 ring-farm-primary/20 scale-102'
                      : 'border-gray-200 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt={`تصویر ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Key Info, Highlights & Purchase Controls */}
        <div className="lg:col-span-6 space-y-6">
          {/* Header & Badges */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-xl bg-amber-500/10 text-amber-800 text-xs font-bold">
                {product.category}
              </span>
              <span className="px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-800 text-xs font-bold flex items-center gap-1">
                <Truck className="w-3 h-3 text-emerald-600" />
                <span>تحویل با پیک اختصاصی در شیراز</span>
              </span>
              {product.shelfLife && (
                <span className="px-3 py-1 rounded-xl bg-blue-50 text-blue-800 text-xs font-bold flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-blue-600" />
                  <span>ماندگاری: {product.shelfLife}</span>
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-farm-primary leading-snug">
              {product.title}
            </h1>

            {/* Ratings Summary (Honest: no fake 5-star fallback when 0 reviews) */}
            <div className="flex items-center gap-3 pt-1">
              {totalApprovedReviews > 0 && averageRating ? (
                <>
                  <div className="flex items-center gap-1" aria-hidden="true">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= Math.round(Number(averageRating))
                            ? 'text-amber-500 fill-amber-500'
                            : 'text-gray-200 fill-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-black text-gray-800 flex items-baseline gap-1">
                    <span>{toPersianDigits(averageRating)}</span>
                    <span className="text-gray-600 font-normal">از ۵</span>
                  </span>
                </>
              ) : (
                <span className="text-xs font-medium text-gray-600">هنوز امتیازی ثبت نشده</span>
              )}
              <span className="text-gray-300">•</span>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('reviews');
                  const el = document.getElementById('reviews-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-xs text-farm-primary hover:underline font-bold cursor-pointer"
              >
                {totalApprovedReviews > 0
                  ? `${toPersianDigits(totalApprovedReviews)} دیدگاه خریداران واقعی`
                  : 'ثبت اولین دیدگاه'}
              </button>
            </div>
          </div>

          {/* Description */}
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed font-medium">
            {product.description}
          </p>

          {/* Key Highlights Checklist */}
          {product.highlights && product.highlights.length > 0 && (
            <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 space-y-2.5">
              <span className="text-xs font-bold text-farm-primary flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#D4A373]" />
                <span>مزایای برجسته و ویژگی‌های ممتاز این محصول:</span>
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700">
                {product.highlights.map((hl, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="p-0.5 rounded-full bg-emerald-600 text-white mt-0.5 shrink-0">
                      <Check className="w-2.5 h-2.5" />
                    </span>
                    <span>{hl}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Specs Pill Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-white border border-farm-border text-xs">
            {product.packSize && (
              <div className="space-y-1">
                <span className="text-gray-600 flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-farm-primary" />
                  <span>فرمت بسته‌بندی:</span>
                </span>
                <span className="font-bold text-farm-primary">{product.packSize}</span>
              </div>
            )}

            {Boolean(product.weightKg != null && Number(product.weightKg) > 0) && (
              <div className="space-y-1">
                <span className="text-gray-600 flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5 text-farm-primary" />
                  <span>وزن خالص:</span>
                </span>
                <span className="font-bold text-farm-primary">
                  {toPersianDigits(product.weightKg)} کیلوگرم
                </span>
              </div>
            )}

            <div className="space-y-1">
              <span className="text-gray-600 flex items-center gap-1">
                <Warehouse className="w-3.5 h-3.5 text-farm-primary" />
                <span>موجودی انبار شیراز:</span>
              </span>
              <span
                className={`font-bold ${
                  product.status === 'COMING_SOON'
                    ? 'text-purple-700'
                    : product.status === 'OUT_OF_STOCK' || (product.stock || 0) <= 0
                    ? 'text-rose-600'
                    : (product.stock || 0) <= 5
                    ? 'text-amber-600'
                    : 'text-emerald-700'
                }`}
              >
                {product.status === 'COMING_SOON'
                  ? '⌛ به زودی در مزرعه'
                  : product.status === 'OUT_OF_STOCK' || (product.stock || 0) <= 0
                  ? '✕ اتمام موجودی'
                  : `✓ ${toPersianDigits(product.stock)} بسته موجود`}
              </span>
            </div>
          </div>

          {/* Stock Urgency Meter */}
          {isAvailable && (product.stock || 0) <= 8 && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                تنها {toPersianDigits(product.stock)} بسته در انبار شیراز باقی مانده است! سفارش‌های
                امروز در اولویت ارسال قرار دارند.
              </span>
            </div>
          )}

          {/* Price & Purchase Box */}
          <div className="p-6 rounded-3xl bg-white border border-farm-border shadow-farm space-y-5">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-gray-500 font-bold">قیمت واحد کالا:</span>
              <div className="text-left">
                <span className="text-3xl font-black text-farm-primary">
                  {formatToman(product.price)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {product.status === 'COMING_SOON' ? (
                <button
                  disabled
                  className="w-full py-4 px-6 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 text-sm font-bold flex items-center justify-center gap-2 cursor-not-allowed"
                >
                  <span>⌛ به زودی در برداشت بعدی مزارع شیراز عرضه خواهد شد</span>
                </button>
              ) : product.status === 'OUT_OF_STOCK' || (product.stock || 0) <= 0 ? (
                <button
                  disabled
                  className="w-full py-4 px-6 rounded-2xl bg-gray-100 border border-gray-200 text-gray-500 text-sm font-bold flex items-center justify-center gap-2 cursor-not-allowed"
                >
                  <span>✕ در حال حاضر موجودی این کالا به اتمام رسیده است</span>
                </button>
              ) : (
                <>
                  <div className="flex items-center gap-3 bg-farm-bg border border-farm-border rounded-2xl p-1.5">
                    <button
                      type="button"
                      onClick={handleIncreaseQty}
                      disabled={
                        cartItem
                          ? cartItem.quantity >= (product.stock || 1)
                          : selectedQty >= (product.stock || 1)
                      }
                      className="w-11 h-11 rounded-xl bg-white flex items-center justify-center text-farm-primary hover:bg-farm-primary hover:text-white transition-colors cursor-pointer disabled:opacity-30"
                      aria-label="افزایش تعداد"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center text-sm font-black text-farm-primary">
                      {toPersianDigits(cartItem ? cartItem.quantity : selectedQty)}
                    </span>
                    <button
                      type="button"
                      onClick={handleDecreaseQty}
                      disabled={!cartItem && selectedQty <= 1}
                      className="w-11 h-11 rounded-xl bg-white flex items-center justify-center text-farm-primary hover:bg-rose-600 hover:text-white transition-colors cursor-pointer disabled:opacity-30"
                      aria-label="کاهش تعداد"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  </div>

                  {cartItem ? (
                    <Link
                      href="/cart"
                      className="flex-1 py-4 px-6 rounded-2xl bg-farm-primary text-white text-sm font-bold hover:bg-farm-primary-dark active:scale-98 transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer hover:shadow-lg"
                    >
                      <ShoppingBag className="w-4 h-4 text-[#D4A373]" />
                      <span>رفتن به سبد خرید</span>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={handleAddToCart}
                      className="flex-1 py-4 px-6 rounded-2xl bg-farm-primary text-white text-sm font-bold hover:bg-farm-primary-dark active:scale-98 transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer hover:shadow-lg"
                    >
                      <ShoppingBag className="w-4 h-4 text-[#D4A373]" />
                      <span>
                        {selectedQty > 1
                          ? `افزودن ${toPersianDigits(selectedQty)} عدد به سبد خرید`
                          : 'افزودن به سبد خرید'}
                      </span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Trust Guarantees */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-2xl bg-farm-bg border border-farm-border flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-farm-primary shrink-0" />
              <div>
                <div className="font-bold text-gray-900 text-xs">{SITE_CONFIG.policies.freshReturnShort}</div>
                <div className="text-xs text-gray-600">تضمین سلامت و کیفیت ارگانیک</div>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-farm-bg border border-farm-border flex items-center gap-2.5">
              <Truck className="w-5 h-5 text-farm-primary shrink-0" />
              <div>
                <div className="font-bold text-gray-900 text-xs">پیک اختصاصی شیراز</div>
                <div className="text-xs text-gray-500">ارسال با زنجیره سرد بهداشتی</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= TABS SYSTEM ================= */}
      <div id="reviews-section" className="pt-8 border-t border-farm-border space-y-6">
        {/* Tab Buttons (Responsive 4-column segmented control on mobile, horizontal pill bar on desktop) */}
        <div className="grid grid-cols-4 gap-1 p-1.5 bg-gray-100/90 rounded-2xl border border-gray-200/80 sm:bg-transparent sm:border-0 sm:border-b sm:border-gray-200 sm:p-0 sm:flex sm:items-center sm:gap-2 sm:rounded-none">
          <button
            type="button"
            onClick={() => setActiveTab('specs')}
            aria-pressed={activeTab === 'specs'}
            className={`w-full py-2.5 px-1 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl font-bold transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-center ${
              activeTab === 'specs'
                ? 'bg-farm-primary text-white shadow-sm'
                : 'text-gray-600 hover:bg-white/80 sm:hover:bg-gray-100'
            }`}
          >
            <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="text-xs sm:text-sm leading-tight">
              <span className="sm:hidden">مشخصات</span>
              <span className="hidden sm:inline">مشخصات فنی و شناسنامه</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('nutrition')}
            aria-pressed={activeTab === 'nutrition'}
            className={`w-full py-2.5 px-1 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl font-bold transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-center ${
              activeTab === 'nutrition'
                ? 'bg-farm-primary text-white shadow-sm'
                : 'text-gray-600 hover:bg-white/80 sm:hover:bg-gray-100'
            }`}
          >
            <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
            <span className="text-xs sm:text-sm leading-tight">
              <span className="sm:hidden">ارزش غذایی</span>
              <span className="hidden sm:inline">ارزش غذایی و نگهداری</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('faqs')}
            aria-pressed={activeTab === 'faqs'}
            className={`w-full py-2.5 px-1 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl font-bold transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-center ${
              activeTab === 'faqs'
                ? 'bg-farm-primary text-white shadow-sm'
                : 'text-gray-600 hover:bg-white/80 sm:hover:bg-gray-100'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="text-xs sm:text-sm leading-tight">
              <span className="sm:hidden">سوالات ({toPersianDigits(product.faqs?.length || 0)})</span>
              <span className="hidden sm:inline">سوالات متداول ({toPersianDigits(product.faqs?.length || 0)})</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reviews')}
            aria-pressed={activeTab === 'reviews'}
            className={`w-full py-2.5 px-1 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl font-bold transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-center ${
              activeTab === 'reviews'
                ? 'bg-farm-primary text-white shadow-sm'
                : 'text-gray-600 hover:bg-white/80 sm:hover:bg-gray-100'
            }`}
          >
            <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 fill-amber-400 shrink-0" />
            <span className="text-xs sm:text-sm leading-tight">
              <span className="sm:hidden">نظرات ({toPersianDigits(totalApprovedReviews)})</span>
              <span className="hidden sm:inline">دیدگاه‌ها و نظرات ({toPersianDigits(totalApprovedReviews)})</span>
            </span>
          </button>
        </div>

        {/* TAB 1: Specifications */}
        {activeTab === 'specs' && (
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-farm-border shadow-xs space-y-6">
            <div>
              <h3 className="text-lg font-black text-farm-primary">
                جدول مشخصات فنی و ویژگی‌های تولید
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                اطلاعات شناسنامه‌ای تنظیم‌شده توسط کارشناسان ارگانیک مزارع پروفارم شیراز
              </p>
            </div>

            <div className="divide-y divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden">
              {/* Origin Location */}
              {product.originLocation && (
                <div className="grid grid-cols-3 sm:grid-cols-4 p-3.5 text-xs bg-gray-50/50">
                  <span className="font-bold text-gray-500">محل دقیق تولید و برداشت:</span>
                  <span className="col-span-2 sm:col-span-3 font-bold text-gray-900">
                    {product.originLocation}
                  </span>
                </div>
              )}

              {/* Shelf Life */}
              {product.shelfLife && (
                <div className="grid grid-cols-3 sm:grid-cols-4 p-3.5 text-xs">
                  <span className="font-bold text-gray-500">مدت زمان ماندگاری:</span>
                  <span className="col-span-2 sm:col-span-3 font-bold text-gray-900">
                    {product.shelfLife}
                  </span>
                </div>
              )}

              {/* Pack Size */}
              {product.packSize && (
                <div className="grid grid-cols-3 sm:grid-cols-4 p-3.5 text-xs bg-gray-50/50">
                  <span className="font-bold text-gray-500">نوع بسته‌بندی:</span>
                  <span className="col-span-2 sm:col-span-3 font-bold text-gray-900">
                    {product.packSize}
                  </span>
                </div>
              )}

              {/* Weight */}
              {Boolean(product.weightKg != null && Number(product.weightKg) > 0) && (
                <div className="grid grid-cols-3 sm:grid-cols-4 p-3.5 text-xs">
                  <span className="font-bold text-gray-500">وزن خالص:</span>
                  <span className="col-span-2 sm:col-span-3 font-bold text-gray-900">
                    {toPersianDigits(product.weightKg)} کیلوگرم
                  </span>
                </div>
              )}

              {/* Dynamic Specifications configured by Admin */}
              {product.specifications &&
                product.specifications.map((spec, sIdx) => (
                  <div
                    key={sIdx}
                    className={`grid grid-cols-3 sm:grid-cols-4 p-3.5 text-xs ${
                      sIdx % 2 === 0 ? 'bg-gray-50/50' : 'bg-white'
                    }`}
                  >
                    <span className="font-bold text-gray-500">{spec.key}:</span>
                    <span className="col-span-2 sm:col-span-3 font-bold text-gray-900">
                      {spec.value}
                    </span>
                  </div>
                ))}

              {/* Organic Certification */}
              <div className="grid grid-cols-3 sm:grid-cols-4 p-3.5 text-xs bg-emerald-50/30">
                <span className="font-bold text-emerald-800">گواهینامه سلامت:</span>
                <span className="col-span-2 sm:col-span-3 font-bold text-emerald-900 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>تاییدیه سلامت و عدم استفاده از سموم شیمیایی و هورمون‌های سنتزی</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Nutritional Info & Storage */}
        {activeTab === 'nutrition' && (
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-farm-border shadow-xs space-y-6">
            <div>
              <h3 className="text-lg font-black text-farm-primary">
                ارزش غذایی تقریبی و دستورالعمل نگهداری
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                اطلاعات ثبت‌شده جهت آگاهی و سلامت تغذیه مصرف‌کنندگان
              </p>
            </div>

            {/* Nutrition Cards (Only render real recorded data; never invent egg nutrition for other products) */}
            {product.nutritionalInfo &&
            (product.nutritionalInfo.calories ||
              product.nutritionalInfo.protein ||
              product.nutritionalInfo.fat ||
              product.nutritionalInfo.carbs) ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {product.nutritionalInfo.calories && (
                  <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 text-center space-y-1">
                    <span className="text-xs text-gray-600 font-bold block">انرژی / کالری</span>
                    <span className="text-2xl font-black text-amber-800">
                      {toPersianDigits(product.nutritionalInfo.calories)}
                    </span>
                    <span className="text-xs text-gray-600 block">کیلوکالری در هر ۱۰۰ گرم</span>
                  </div>
                )}

                {product.nutritionalInfo.protein && (
                  <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200/80 text-center space-y-1">
                    <span className="text-xs text-gray-600 font-bold block">پروتئین خالص</span>
                    <span className="text-2xl font-black text-blue-800">
                      {toPersianDigits(product.nutritionalInfo.protein)}
                    </span>
                    <span className="text-xs text-gray-600 block">گرم در هر ۱۰۰ گرم</span>
                  </div>
                )}

                {product.nutritionalInfo.fat && (
                  <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200/80 text-center space-y-1">
                    <span className="text-xs text-gray-600 font-bold block">چربی کل</span>
                    <span className="text-2xl font-black text-rose-800">
                      {toPersianDigits(product.nutritionalInfo.fat)}
                    </span>
                    <span className="text-xs text-gray-600 block">گرم چربی طبیعی</span>
                  </div>
                )}

                {product.nutritionalInfo.carbs && (
                  <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 text-center space-y-1">
                    <span className="text-xs text-gray-600 font-bold block">کربوهیدرات</span>
                    <span className="text-2xl font-black text-emerald-800">
                      {toPersianDigits(product.nutritionalInfo.carbs)}
                    </span>
                    <span className="text-xs text-gray-600 block">گرم در هر ۱۰۰ گرم</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-farm-bg border border-farm-border text-sm text-gray-600">
                جدول ارزش غذایی دقیق برای این محصول هنوز توسط واحد کنترل کیفیت ثبت نشده است.
              </div>
            )}

            {/* Storage Instructions Banner */}
            <div className="p-5 rounded-2xl bg-farm-bg border border-farm-border space-y-2">
              <span className="text-xs font-bold text-farm-primary flex items-center gap-1.5">
                <Info className="w-4 h-4" />
                <span>بهترین شرایط نگهداری جهت حفظ حداکثر طراوت و ارزش غذایی:</span>
              </span>
              <p className="text-xs text-gray-700 leading-relaxed pr-5">
                {product.storageInstructions ||
                  'در دمای ۲ الی ۶ درجه سانتی‌گراد درون یخچال نگهداری شود. دور از تابش مستقیم نور خورشید و رطوبت قرار گیرد.'}
              </p>
            </div>
          </div>
        )}

        {/* TAB 3: FAQs */}
        {activeTab === 'faqs' && (
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-farm-border shadow-xs space-y-6">
            <div>
              <h3 className="text-lg font-black text-farm-primary">
                سوالات متداول مشتریان درباره این محصول
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                پاسخ به رایج‌ترین پرسش‌های مطرح‌شده توسط خریداران شیراز
              </p>
            </div>

            {(!product.faqs || product.faqs.length === 0) ? (
              <div className="p-8 text-center text-xs text-gray-600 bg-farm-bg rounded-2xl border border-gray-200">
                در حال حاضر سوال متداولی برای این محصول ثبت نشده است. در صورت نیاز می‌توانید با
                پشتیبانی پروفارم به شماره {SITE_CONFIG.contact.supportPhoneDisplay} تماس بگیرید.
              </div>
            ) : (
              <div className="space-y-3">
                {product.faqs.map((faq, fIdx) => {
                  const isOpen = openFaqIndex === fIdx;
                  return (
                    <div
                      key={fIdx}
                      className="rounded-2xl border border-gray-200 overflow-hidden transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaqIndex(isOpen ? null : fIdx)}
                        aria-expanded={isOpen}
                        className="w-full p-4 text-right flex items-center justify-between gap-3 bg-gray-50/50 hover:bg-gray-100/70 transition-colors cursor-pointer"
                      >
                        <span className="font-bold text-gray-900 text-xs sm:text-sm">
                          {faq.question}
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 text-gray-500 transition-transform ${
                            isOpen ? 'rotate-180 text-farm-primary' : ''
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className="p-4 bg-white text-xs text-gray-700 leading-relaxed border-t border-gray-100 font-medium">
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Reviews & Verified Buyer Moderation */}
        {activeTab === 'reviews' && (
          <div className="space-y-6">
            {/* Reviews Summary & Call to Action */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-farm-border shadow-xs flex flex-col md:flex-row gap-6 items-center justify-between">
              {/* Score Left */}
              <div className="flex items-center gap-5">
                <div className="text-center p-4 rounded-2xl bg-farm-primary/5 border border-farm-primary/15">
                  <div className="text-3xl font-black text-farm-primary">
                    {totalApprovedReviews > 0 && averageRating ? toPersianDigits(averageRating) : '—'}
                  </div>
                  <div className="flex items-center justify-center gap-0.5 mt-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-3.5 h-3.5 ${
                          averageRating && s <= Math.round(Number(averageRating))
                            ? 'text-amber-500 fill-amber-500'
                            : 'text-gray-200 fill-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-gray-600 mt-1 block">
                    {totalApprovedReviews > 0 ? 'از ۵ امتیاز رضایت' : 'بدون امتیاز'}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-base font-black text-gray-900">
                    دیدگاه‌ها و نظرات خریداران واقعی
                  </h3>
                  <p className="text-xs text-gray-500">
                    تنها خریداران تایید شده که سفارش آنها تحویل شده است مجاز به ثبت نظر می‌باشند.
                  </p>
                  <div className="text-xs text-emerald-800 font-bold flex items-center gap-1.5 pt-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>۱۰۰٪ نظرات توسط خریداران واقعی مزارع شیراز ثبت شده‌اند</span>
                  </div>
                </div>
              </div>

              {/* Submit Review Button */}
              <button
                type="button"
                onClick={handleOpenReviewModal}
                className="px-6 py-3.5 rounded-2xl bg-farm-primary hover:bg-farm-primary-dark text-white text-xs font-bold transition-all shadow-sm shrink-0 flex items-center gap-2 cursor-pointer hover:scale-102"
              >
                <Star className="w-4 h-4 text-[#D4AF37] fill-[#D4AF37]" />
                <span>ثبت نظر برای این محصول (ویژه خریداران)</span>
              </button>
            </div>

            {/* List of Approved Reviews */}
            {reviews.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-farm-border">
                <Star className="w-12 h-12 text-amber-300 fill-amber-100 mx-auto mb-3" />
                <h4 className="font-bold text-gray-800 text-sm">هنوز نظری برای این کالا ثبت نشده است</h4>
                <p className="text-xs text-gray-600 mt-1">
                  اگر این محصول را دریافت کرده‌اید، اولین خریدار باشید که نظر خود را به اشتراک می‌گذارد.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="bg-white rounded-3xl border border-farm-border p-6 space-y-3.5 shadow-xs"
                  >
                    {/* Reviewer Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-full bg-farm-primary/10 text-farm-primary flex items-center justify-center font-bold text-xs">
                          {rev.userName ? rev.userName.charAt(0) : 'خ'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 text-xs sm:text-sm">
                              {rev.userName}
                            </span>
                            {rev.isVerifiedBuyer && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-xs">
                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                <span>خریدار تایید شده</span>
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-600 mt-0.5 block">
                            {rev.dateLabel}
                          </span>
                        </div>
                      </div>

                      {/* Stars */}
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${
                              s <= rev.rating
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-gray-200 fill-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Review Title & Body */}
                    <div className="space-y-1.5">
                      {rev.title && (
                        <h5 className="font-bold text-gray-900 text-xs sm:text-sm">{rev.title}</h5>
                      )}
                      <p className="text-gray-700 text-xs leading-relaxed font-medium">
                        {rev.comment}
                      </p>
                    </div>

                    {/* Pros and Cons */}
                    {((rev.pros && rev.pros.length > 0) || (rev.cons && rev.cons.length > 0)) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                        {rev.pros && rev.pros.length > 0 && (
                          <div className="space-y-1">
                            {rev.pros.map((p, pIdx) => (
                              <div
                                key={pIdx}
                                className="flex items-center gap-1.5 text-xs text-emerald-900"
                              >
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>{p}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {rev.cons && rev.cons.length > 0 && (
                          <div className="space-y-1">
                            {rev.cons.map((c, cIdx) => (
                              <div
                                key={cIdx}
                                className="flex items-center gap-1.5 text-xs text-rose-900"
                              >
                                <X className="w-3 h-3 text-rose-500" />
                                <span>{c}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Recommendation */}
                    {typeof rev.isRecommended === 'boolean' && (
                      <div className="text-xs font-bold pt-1">
                        {rev.isRecommended ? (
                          <span className="text-emerald-700 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>خرید این کالا را به دیگران پیشنهاد می‌کنم</span>
                          </span>
                        ) : (
                          <span className="text-gray-600 flex items-center gap-1">
                            <X className="w-3.5 h-3.5 text-rose-400" />
                            <span>خرید این کالا را پیشنهاد نمی‌کنم</span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Official Farm Reply */}
                    {rev.adminResponse && (
                      <div className="p-3.5 rounded-2xl bg-farm-primary/5 border border-farm-primary/15 space-y-1 mt-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-farm-primary">
                          <CornerDownLeft className="w-3.5 h-3.5" />
                          <span>پاسخ رسمی پشتیبانی مزارع پروفارم شیراز:</span>
                        </div>
                        <p className="text-xs text-gray-800 pr-5 leading-relaxed font-medium">
                          {rev.adminResponse}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================= RELATED PRODUCTS ================= */}
      {relatedProducts.length > 0 && (
        <div className="pt-8 border-t border-farm-border space-y-6">
          <div>
            <span className="text-xs font-bold text-farm-gold-text">
              پیشنهادات ویژه مزرعه
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-farm-primary">
              سایر محصولات ارگانیک منتخب
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}

      {/* ================= MODAL: INELIGIBLE BUYER RULE NOTICE ================= */}
      {isEligibilityModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div role="dialog" aria-modal="true" aria-label="قوانین خرید عمده و شرایط ثبت دیدگاه" className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 border border-farm-border shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h4 className="text-base font-black text-gray-900">
                قوانین ثبت دیدگاه در مزارع پروفارم
              </h4>
              <p className="text-xs text-gray-600 leading-relaxed">{ineligibilityReason}</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200 text-xs text-gray-500 space-y-1">
              <div className="font-bold text-gray-700 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>چرا فقط خریداران واقعی؟</span>
              </div>
              <p className="text-xs leading-relaxed">
                جهت اطمینان از اصالت دیدگاه‌ها و جلوگیری از نظرات غیرواقعی، سامانه پروفارم ثبت نظر را
                منحصر به افرادی نموده است که کالا را سفارش داده و آن را دریافت نموده‌اند.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsEligibilityModalOpen(false)}
              className="w-full py-3 rounded-xl bg-farm-primary text-white text-xs font-bold hover:bg-farm-primary-dark transition-colors cursor-pointer"
            >
              متوجه شدم
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL: SUBMIT VERIFIED REVIEW ================= */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div role="dialog" aria-modal="true" aria-label="ثبت دیدگاه" className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 border border-farm-border shadow-2xl my-8">
            {reviewSubmittedSuccess ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h4 className="text-lg font-black text-gray-900">دیدگاه شما با موفقیت ثبت گردید</h4>
                <p className="text-xs text-gray-600 max-w-xs mx-auto leading-relaxed">
                  نظر ارزشمند شما پس از بررسی و تایید کارشناس در صفحه این محصول منتشر خواهد شد. از
                  مشارکت شما در ارتقای کیفیت محصولات سپاسگزاریم.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReview} className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                    <h4 className="text-base font-black text-gray-900">
                      ثبت تجربه خرید: {product.title}
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsReviewModalOpen(false)}
                    className="p-1 rounded-xl text-gray-600 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Rating Selector */}
                <div className="text-center py-2 space-y-2">
                  <span className="text-xs font-bold text-gray-700 block">
                    امتیاز شما به کیفیت و طراوت این محصول:
                  </span>
                  <div className="flex items-center justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewRating(star)}
                        className="p-1 cursor-pointer transition-transform hover:scale-120"
                      >
                        <Star
                          className={`w-7 h-7 ${
                            star <= reviewRating
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-gray-200 fill-gray-200'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <span className="text-xs font-bold text-amber-700">
                    {reviewRating === 5
                      ? 'عالی و بی‌نقص'
                      : reviewRating === 4
                      ? 'بسیار خوب'
                      : reviewRating === 3
                      ? 'معمولی'
                      : reviewRating === 2
                      ? 'ضعیف'
                      : 'بسیار ضعیف'}
                  </span>
                </div>

                {/* Review Title */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    عنوان دیدگاه شما:
                  </label>
                  <input
                    type="text"
                    value={reviewTitle}
                    onChange={(e) => setReviewTitle(e.target.value)}
                    placeholder="مثلاً: طعم اصیل زرده، بسته‌بندی عالی..."
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-900 focus:outline-none focus:border-farm-primary"
                  />
                </div>

                {/* Review Comment */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    متن دیدگاه و توضیحات کامل: *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="تجربه خود از عطر، طعم، بسته‌بندی و تحویل این محصول را بنویسید..."
                    className="w-full p-3 rounded-xl border border-gray-200 text-xs font-medium text-gray-900 focus:outline-none focus:border-farm-primary leading-relaxed"
                  />
                </div>

                {/* Pros Tag Input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700">
                    نقاط قوت از نظر شما:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={proInput}
                      onChange={(e) => setProInput(e.target.value)}
                      placeholder="مثلاً: طراوت فوق‌العاده"
                      className="flex-1 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-900 focus:outline-none focus:border-farm-primary"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddPro();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddPro}
                      className="px-3 py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold cursor-pointer"
                    >
                      + افزودن
                    </button>
                  </div>
                  {reviewPros.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {reviewPros.map((p, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200"
                        >
                          <span>{p}</span>
                          <button
                            type="button"
                            onClick={() => handleRemovePro(idx)}
                            className="cursor-pointer hover:text-emerald-950"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cons Tag Input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700">
                    نقاط ضعف از نظر شما:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={conInput}
                      onChange={(e) => setConInput(e.target.value)}
                      placeholder="مثلاً: قیمت نسبتاً بالا"
                      className="flex-1 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-900 focus:outline-none focus:border-farm-primary"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCon();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddCon}
                      className="px-3 py-1.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-bold cursor-pointer"
                    >
                      + افزودن
                    </button>
                  </div>
                  {reviewCons.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {reviewCons.map((c, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-800 text-xs font-bold border border-rose-200"
                        >
                          <span>{c}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCon(idx)}
                            className="cursor-pointer hover:text-rose-950"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recommendation Radio */}
                <div className="pt-2 border-t border-gray-100 space-y-1.5">
                  <span className="block text-xs font-bold text-gray-700">
                    آیا خرید این کالا را به دیگران توصیه می‌کنید؟
                  </span>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-xs font-bold text-emerald-800 cursor-pointer">
                      <input
                        type="radio"
                        checked={isRecommended === true}
                        onChange={() => setIsRecommended(true)}
                        className="text-farm-primary"
                      />
                      <span>بله، پیشنهاد می‌کنم</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs font-bold text-rose-800 cursor-pointer">
                      <input
                        type="radio"
                        checked={isRecommended === false}
                        onChange={() => setIsRecommended(false)}
                        className="text-farm-primary"
                      />
                      <span>خیر، پیشنهاد نمی‌کنم</span>
                    </label>
                  </div>
                </div>

                {reviewFormError && (
                  <div role="alert" className="p-3 rounded-xl bg-rose-50 text-rose-800 text-xs font-bold border border-rose-200">
                    {reviewFormError}
                  </div>
                )}

                {/* Notice */}
                <div className="p-3 rounded-xl bg-amber-50 text-amber-800 text-xs leading-relaxed border border-amber-200">
                  توجه: به منظور رعایت ادب و استانداردهای فروشگاه، دیدگاه‌ها پس از تایید توسط ادمین
                  در صفحه محصول نمایش داده می‌شوند.
                </div>

                {/* Submit & Cancel */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsReviewModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-xs font-bold hover:bg-gray-100 cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={reviewSubmitting}
                    className="px-6 py-2.5 rounded-xl bg-farm-primary text-white text-xs font-bold hover:bg-farm-primary-dark shadow-md cursor-pointer transition-all hover:scale-102"
                  >
                    {reviewSubmitting ? 'در حال ثبت...' : 'ثبت نهایی دیدگاه'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ================= STICKY BOTTOM ACTION BAR ================= */}
      {showStickyBar && isAvailable && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-farm-border py-3 px-4 sm:px-8 shadow-2xl animate-fade-in">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={product.images[0]}
                alt={product.title}
                className="w-12 h-12 rounded-xl object-cover border border-gray-200 shrink-0"
              />
              <div className="truncate">
                <div className="font-bold text-gray-900 text-xs sm:text-sm truncate">
                  {product.title}
                </div>
                <div className="text-xs font-black text-farm-primary mt-0.5">
                  {formatToman(product.price)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="flex items-center gap-1.5 sm:gap-2 bg-farm-bg border border-farm-border rounded-xl p-1">
                <button
                  type="button"
                  onClick={handleIncreaseQty}
                  disabled={
                    cartItem
                      ? cartItem.quantity >= (product.stock || 1)
                      : selectedQty >= (product.stock || 1)
                  }
                  className="min-h-11 min-w-11 rounded-lg bg-white flex items-center justify-center text-farm-primary hover:bg-farm-primary hover:text-white transition-colors cursor-pointer disabled:opacity-30"
                  aria-label="افزایش تعداد"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <span className="w-6 text-center text-xs sm:text-sm font-black text-farm-primary">
                  {toPersianDigits(cartItem ? cartItem.quantity : selectedQty)}
                </span>
                <button
                  type="button"
                  onClick={handleDecreaseQty}
                  disabled={!cartItem && selectedQty <= 1}
                  className="min-h-11 min-w-11 rounded-lg bg-white flex items-center justify-center text-farm-primary hover:bg-rose-600 hover:text-white transition-colors cursor-pointer disabled:opacity-30"
                  aria-label="کاهش تعداد"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
              </div>

              {cartItem ? (
                <Link
                  href="/cart"
                  className="min-h-11 py-2 px-3.5 sm:py-2.5 sm:px-6 rounded-xl bg-farm-primary text-white text-xs font-bold hover:bg-farm-primary-dark transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap"
                >
                  <ShoppingBag className="w-4 h-4 text-[#D4A373]" />
                  <span>رفتن به سبد خرید</span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="min-h-11 py-2 px-3.5 sm:py-2.5 sm:px-6 rounded-xl bg-farm-primary text-white text-xs font-bold hover:bg-farm-primary-dark transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap"
                >
                  <ShoppingBag className="w-4 h-4 text-[#D4A373]" />
                  <span>
                    {selectedQty > 1
                      ? `افزودن ${toPersianDigits(selectedQty)} عدد`
                      : 'افزودن به سبد خرید'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
