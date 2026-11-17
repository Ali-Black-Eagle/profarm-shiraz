'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Sparkles,
  Truck,
  ShieldCheck,
  Crown,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Package,
  Layers,
  Leaf,
  ChevronLeft,
  Zap,
  Percent,
  MapPin,
  AlertCircle,
  Users,
  Check,
  Egg,
} from 'lucide-react';
import { ProductCard } from '@/components/modules/ProductCard';
import { INITIAL_PRODUCTS, INITIAL_CATEGORIES } from '@/lib/initial-data';
import {
  farmStore,
  DEFAULT_SITE_CONTENT,
  DEFAULT_SUBSCRIPTION_SETTINGS,
} from '@/lib/db-store';
import { useAuth } from '@/hooks/useAuth';
import { formatToman, toPersianDigits, getDeduplicatedPerks } from '@/lib/formatters';
import { SiteContent, SubscriptionSettings, SubscriptionStats, Product } from '@/types';

export default function HomePage() {
  const { user, isAuthenticated } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [products, setProducts] = useState<Product[]>([...INITIAL_PRODUCTS]);
  const [categories, setCategories] = useState<string[]>([...INITIAL_CATEGORIES]);
  const [selectedCategory, setSelectedCategory] = useState('همه محصولات');
  const [content, setContent] = useState<SiteContent>({ ...DEFAULT_SITE_CONTENT });
  const [subSettings, setSubSettings] = useState<SubscriptionSettings>({
    ...DEFAULT_SUBSCRIPTION_SETTINGS,
  });
  const [stats, setStats] = useState<SubscriptionStats | null>(null);

  const loadData = () => {
    setContent(farmStore.getSiteContent());
    setSubSettings(farmStore.getSubscriptionSettings());
    setStats(farmStore.getSubscriptionStats());
    setProducts([...farmStore.getProducts()]);
    setCategories([...farmStore.getCategories()]);
  };

  useEffect(() => {
    setMounted(true);
    loadData();

    // Authoritative sync with server API
    farmStore.syncSubscriptionSettings().then((synced) => {
      setSubSettings({ ...synced });
      setStats(farmStore.getSubscriptionStats());
    });

    const handleUpdate = () => {
      loadData();
    };

    // Re-sync when page regains focus or tab is made visible
    const handleFocus = () => {
      farmStore.syncSubscriptionSettings().then((synced) => {
        setSubSettings({ ...synced });
        setStats(farmStore.getSubscriptionStats());
      });
    };

    window.addEventListener('profarm_subscription_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      window.removeEventListener('profarm_subscription_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  const isUserLoggedIn = mounted && isAuthenticated && !!user;
  const userTier = isUserLoggedIn ? user?.tier || (user?.isProMember ? 'PRO' : 'FREE') : 'FREE';

  const filteredProducts =
    selectedCategory === 'همه محصولات'
      ? products
      : products.filter((p) => p.category === selectedCategory);

  return (
    <div className="space-y-16 pb-16">
      {/* 1. Dynamic Hero Section (Managed via Admin CMS) */}
      <section className="relative overflow-hidden pt-8 pb-16 md:pt-14 md:pb-24 bg-gradient-to-b from-[#F3EFE6] via-[#F9F8F5] to-[#F9F8F5] border-b border-[#E6E1D5]">
        {/* Subtle decorative background circles */}
        <div className="absolute top-0 right-10 w-96 h-96 bg-[#2C4A2E]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-80 h-80 bg-[#D4A373]/10 rounded-full blur-2xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left/Main Column: Dynamic Typography & CTAs (Centered on mobile, right-aligned on desktop) */}
            <div className="w-full lg:col-span-7 space-y-6 text-center lg:text-right flex flex-col items-center lg:items-start">
              <div className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#E6E1D5] shadow-xs text-xs font-semibold text-[#2C4A2E] mx-auto lg:mx-0">
                <span className="w-2 h-2 rounded-full bg-[#2C4A2E] animate-ping" />
                <span>{content.heroBadgeText}</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-[#2C4A2E] leading-tight tracking-tight text-center lg:text-right w-full">
                {content.heroTitlePart1} <br />
                <span className="text-[#D4A373]">{content.heroTitleHighlight}</span>
              </h1>

              <p className="text-sm sm:text-base text-gray-600 leading-relaxed max-w-2xl font-normal mx-auto lg:mx-0 text-center lg:text-right w-full">
                {content.heroSubtitle}
              </p>

              {/* CTAs with Enhanced Color, Gradients & Eye-Catching Micro-Animations */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2 w-full">
                <Link
                  href="/products"
                  className="relative group overflow-hidden px-7 py-4 rounded-2xl bg-gradient-to-r from-[#2C4A2E] via-[#385e3b] to-[#1E3520] text-white text-sm font-black shadow-[0_10px_25px_-5px_rgba(44,74,46,0.35)] hover:shadow-[0_15px_30px_-5px_rgba(44,74,46,0.5)] hover:scale-105 active:scale-95 transition-all duration-300 flex items-center gap-2.5 border border-emerald-500/20"
                >
                  {/* Shimmer sweep */}
                  <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

                  {/* Pulsing indicator dot */}
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
                  </span>

                  <span>{content.heroCtaProductsText}</span>
                  <ArrowLeft className="w-4 h-4 text-[#D4A373] group-hover:-translate-x-1.5 transition-transform duration-300" />
                </Link>

                <Link
                  href="/pro"
                  className="relative group overflow-hidden px-7 py-4 rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#B8860B] text-slate-950 text-sm font-black shadow-[0_10px_25px_-5px_rgba(212,175,55,0.4)] hover:shadow-[0_15px_30px_-5px_rgba(212,175,55,0.65)] hover:scale-105 active:scale-95 transition-all duration-300 flex items-center gap-2.5 ring-2 ring-[#D4AF37]/60 ring-offset-2 ring-offset-[#F9F8F5]"
                >
                  {/* Shimmer sweep */}
                  <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />

                  {/* Golden Crown with micro-rotation on hover */}
                  <Crown className="w-4 h-4 text-amber-950 group-hover:rotate-12 group-hover:scale-110 transition-transform duration-300" />

                  <span>{content.heroCtaProText}</span>
                  <Sparkles className="w-4 h-4 text-amber-900 animate-pulse" />
                </Link>
              </div>

              {/* Shiraz Trust Highlights (Dynamic) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 border-t border-[#E6E1D5]/60 text-xs w-full">
                <div className="flex items-center justify-center lg:justify-start gap-2">
                  <Truck className="w-4 h-4 text-[#2C4A2E] shrink-0" />
                  <span className="text-gray-700 font-medium">{content.trustItem1}</span>
                </div>
                <div className="flex items-center justify-center lg:justify-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#2C4A2E] shrink-0" />
                  <span className="text-gray-700 font-medium">{content.trustItem2}</span>
                </div>
                <div className="flex items-center justify-center lg:justify-start gap-2">
                  <Sparkles className="w-4 h-4 text-[#2C4A2E] shrink-0" />
                  <span className="text-gray-700 font-medium">{content.trustItem3}</span>
                </div>
              </div>
            </div>

            {/* Right Column: Hero Visual Card (Dynamic Image with High Priority LCP) */}
            <div className="lg:col-span-5 relative w-full max-w-md mx-auto lg:max-w-none">
              <div className="relative rounded-3xl overflow-hidden border-2 border-white shadow-2xl bg-white aspect-4/3 sm:aspect-square">
                <Image
                  src={
                    content.heroImageUrl ||
                    '/images/hero-shiraz-farm.jpg'
                  }
                  alt="مزارع سرسبز ارگانیک فارس و شیراز"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 42vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex flex-col justify-end p-6 text-white z-10">
                  <span className="text-xs text-[#D4A373] font-semibold">
                    {content.heroImageTag || 'تضمین ۱۰۰٪ ارگانیک و محلی'}
                  </span>
                  <p className="text-base font-bold mt-0.5">
                    {content.heroImageCaption ||
                      'برداشت صبحگاهی و تحویل همان روز در شیراز با پیک پروفارم'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Products Catalog Grid (Dynamic Categories) - Placed directly after Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-[#D4A373] tracking-wide">
              {content.productsBadgeText || 'پکیج‌های آماده و شناسنامه‌دار'}
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-[#2C4A2E] mt-1">
              {content.productsSectionTitle || 'تازه‌ترین محصولات ارگانیک باغات و مزارع فارس'}
            </h2>
          </div>
          <Link
            href="/products"
            className="text-xs font-bold text-[#2C4A2E] hover:text-[#1E3520] flex items-center gap-1"
          >
            <span>مشاهده همه محصولات</span>
            <ChevronLeft className="w-4 h-4" />
          </Link>
        </div>

        {/* Categories Tab Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#2C4A2E] text-white shadow-xs'
                  : 'bg-white text-gray-600 border border-[#E6E1D5] hover:bg-[#F3EFE6]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* 3. Pro & Plus Membership Plans Comparison (Dynamic Titles) - Placed after Products */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-[#2C4A2E] via-[#243c26] to-[#1a301c] rounded-3xl p-8 sm:p-12 text-white relative overflow-hidden shadow-farm">
          <div className="absolute top-0 left-0 w-80 h-80 bg-[#D4A373]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-3xl mb-8 space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-semibold">
              <Crown className="w-3.5 h-3.5" />
              <span>باشگاه مشترکین طلایی مزارع شیراز</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black">
              {content.proSectionTitle}
            </h2>
            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
              {content.proSectionSubtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {/* Card 1: Regular / Free */}
            <div
              className={`relative overflow-hidden rounded-3xl p-6 sm:p-8 flex flex-col justify-between space-y-6 text-gray-900 transition-all duration-300 bg-gradient-to-b from-[#F8FAFC] via-[#F1F5F9] to-[#E2E8F0] border-2 ${
                userTier === 'FREE'
                  ? 'border-slate-400 ring-2 ring-slate-400/30 shadow-xl'
                  : 'border-slate-300/90 hover:border-slate-400 shadow-lg hover:shadow-xl'
              }`}
            >
              {/* Decorative cool slate ambient blur */}
              <div className="absolute -top-12 -right-12 w-36 h-36 bg-slate-300/35 rounded-full blur-2xl pointer-events-none" />

              <div className="space-y-5 relative z-10">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-gradient-to-r from-slate-200 to-slate-300/80 text-slate-800 text-[10px] font-bold border border-slate-300">
                    <span>{subSettings.freeSubtitle || 'طرح پایه'}</span>
                  </div>
                  <h3 className="text-xl font-black text-slate-800">{subSettings.freeTitle || 'کاربر عادی'}</h3>
                  <p className="text-xs text-slate-600">سفارش‌های گاه‌به‌گاه و خرید آزمایشی</p>
                </div>

                <div className="pt-2 pb-4 border-b border-slate-200">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-slate-900">{subSettings.freePriceLabel || 'رایگان'}</span>
                  </div>
                  <span className="text-[11px] text-slate-500">{subSettings.freePriceSubtext || 'بدون نیاز به پرداخت ماهانه'}</span>
                </div>

                <ul className="space-y-3 text-xs text-slate-700">
                  {(Array.isArray(subSettings.freeFeatures)
                    ? subSettings.freeFeatures
                    : DEFAULT_SUBSCRIPTION_SETTINGS.freeFeatures
                  ).map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 font-medium text-slate-700">
                      <Check className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 border-t border-slate-200/80 relative z-10">
                <div className="w-full py-3.5 px-4 rounded-2xl text-xs font-bold text-center bg-slate-200/80 text-slate-700 border border-slate-300/80">
                  {userTier === 'FREE' ? (subSettings.freeButtonText || 'طرح فعلی شما (رایگان) ✓') : 'طرح پایه عادی'}
                </div>
              </div>
            </div>

            {/* Card 2: Plus Membership */}
            <div
              className={`relative overflow-hidden rounded-3xl p-6 sm:p-8 flex flex-col justify-between space-y-6 text-gray-900 transition-all duration-300 bg-gradient-to-b from-[#ECFDF5] via-[#F0FDF4] to-[#D1FAE5] border-2 ${
                userTier === 'PLUS'
                  ? 'border-emerald-600 ring-4 ring-emerald-500/35 shadow-2xl'
                  : 'border-emerald-400 hover:border-emerald-500 shadow-xl shadow-emerald-950/10 hover:shadow-2xl ring-2 ring-emerald-400/20'
              }`}
            >
              {/* Decorative vibrant emerald ambient blur */}
              <div className="absolute -top-12 -right-12 w-40 h-40 bg-emerald-400/25 rounded-full blur-2xl pointer-events-none" />

              <div className="space-y-5 relative z-10">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[10px] font-black shadow-sm">
                    <Zap className="w-3 h-3 text-emerald-100" />
                    <span>{subSettings.plusBadgeText || 'اقتصادی'}</span>
                  </div>
                  <h3 className="text-xl font-black text-emerald-950">{subSettings.plusTitle || 'اشتراک پلاس'}</h3>
                  <p className="text-xs text-emerald-800 font-medium">{subSettings.plusSubtitle || 'تحویل همه روزه + تخفیف تخم‌مرغ محلی'}</p>
                </div>

                <div className="pt-2 pb-4 border-b border-emerald-200">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-emerald-950">
                      {formatToman(subSettings.plusMonthlyPrice)}
                    </span>
                    <span className="text-xs font-bold text-emerald-800"> / ماهانه</span>
                  </div>
                  <span className="text-[11px] text-emerald-700 font-bold">
                    {subSettings.plusPriceSubtext || 'صرفه‌جویی تضمین‌شده در خرید هفتگی'}
                  </span>
                </div>

                {/* Capacity alert badge */}
                {stats?.isPlusFull ? (
                  <div className="p-2 rounded-xl bg-rose-100 text-rose-800 text-xs font-bold text-center border border-rose-300">
                    تکمیل ظرفیت این دوره
                  </div>
                ) : stats && subSettings.plusMaxCapacity > 0 && stats.plusRemaining !== null && stats.plusRemaining <= 3 && stats.plusRemaining > 0 ? (
                  <div className="p-2 rounded-xl bg-amber-100 text-amber-900 text-xs font-bold text-center border border-amber-300 animate-pulse">
                    تنها {toPersianDigits(stats.plusRemaining)} اشتراک باقیمانده!
                  </div>
                ) : null}

                <ul className="space-y-3 text-xs text-gray-700">
                  {(Array.isArray(subSettings.plusFeatures)
                    ? subSettings.plusFeatures
                    : DEFAULT_SUBSCRIPTION_SETTINGS.plusFeatures
                  ).map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 font-semibold text-emerald-950">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 border-t border-emerald-200/80 relative z-10">
                {userTier === 'PLUS' ? (
                  <div className="w-full py-3.5 px-4 rounded-2xl text-center text-xs font-black bg-emerald-200 text-emerald-950 border border-emerald-400">
                    اشتراک پلاس فعال است ✓
                  </div>
                ) : (
                  <Link
                    href="/checkout?subscriptionPlan=PLUS"
                    className="w-full py-3.5 px-4 rounded-2xl text-center text-xs font-black bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white transition-all shadow-lg shadow-emerald-700/25 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    <Zap className="w-4 h-4 text-emerald-200" />
                    <span>
                      {stats?.isPlusFull
                        ? 'تکمیل ظرفیت این دوره'
                        : subSettings.plusButtonText || `خرید اشتراک پلاس (${formatToman(subSettings.plusMonthlyPrice)})`}
                    </span>
                  </Link>
                )}
              </div>
            </div>

            {/* Card 3: Pro (VIP Golden Club) */}
            <div
              className={`relative overflow-hidden rounded-3xl p-6 sm:p-8 flex flex-col justify-between space-y-6 text-gray-900 transition-all duration-300 bg-gradient-to-b from-[#FFFDF2] via-[#FEF9E7] to-[#FDE68A]/75 border-2 ${
                userTier === 'PRO'
                  ? 'border-amber-500 ring-4 ring-amber-400/50 shadow-2xl'
                  : 'border-[#D4AF37] shadow-2xl shadow-amber-500/25 ring-4 ring-amber-400/30 hover:border-amber-500 hover:shadow-amber-500/35'
              }`}
            >
              {/* Floating Top Left Ribbon */}
              <div className="absolute top-4 left-4 bg-gradient-to-r from-amber-600 via-amber-500 to-[#D4AF37] text-white text-[10px] font-black px-3.5 py-1 rounded-full shadow-md z-20">
                ★ {subSettings.proTopLabel || 'طلایی'}
              </div>

              {/* Decorative royal gold ambient blur */}
              <div className="absolute -top-12 -right-12 w-44 h-44 bg-amber-400/35 rounded-full blur-2xl pointer-events-none" />

              <div className="space-y-5 relative z-10">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-gradient-to-r from-amber-200 to-yellow-200 text-amber-950 text-[10px] font-bold border border-amber-300">
                    <Crown className="w-3 h-3 text-amber-700" />
                    <span>{subSettings.proBadgeText || 'اشتراک طلایی پروفارم پرو'}</span>
                  </div>
                  <h3 className="text-xl font-black text-amber-950">{subSettings.proTitle || 'اشتراک پرو (Pro)'}</h3>
                  <p className="text-xs text-amber-800 font-medium">{subSettings.proSubtitle || 'حداکثر تخفیف و بیشترین انعطاف در دریافت'}</p>
                </div>

                <div className="pt-2 pb-4 border-b border-amber-300/80">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-amber-950">
                      {formatToman(subSettings.proMonthlyPrice)}
                    </span>
                    <span className="text-xs font-bold text-amber-800"> / ماهانه</span>
                  </div>
                  <span className="text-[11px] text-amber-800 font-bold">
                    {subSettings.proPriceSubtext ||
                      `${toPersianDigits(subSettings.proEggDiscountPercent)}٪ تخم‌مرغ + ${toPersianDigits(subSettings.proOtherDiscountPercent)}٪ سایر محصولات + ${toPersianDigits(subSettings.proShippingDiscountPercent)}٪ تخفیف ارسال`}
                  </span>
                </div>

                {/* Capacity alert badge */}
                {stats?.isProFull ? (
                  <div className="p-2 rounded-xl bg-rose-100 text-rose-800 text-xs font-bold text-center border border-rose-300">
                    تکمیل ظرفیت این دوره
                  </div>
                ) : stats && subSettings.proMaxCapacity > 0 && stats.proRemaining !== null && stats.proRemaining <= 3 && stats.proRemaining > 0 ? (
                  <div className="p-2 rounded-xl bg-amber-200/90 text-amber-950 text-xs font-bold text-center border border-amber-400 animate-pulse">
                    تنها {toPersianDigits(stats.proRemaining)} اشتراک باقیمانده!
                  </div>
                ) : null}

                <ul className="space-y-3 text-xs text-gray-800">
                  {(Array.isArray(subSettings.proFeatures)
                    ? subSettings.proFeatures
                    : DEFAULT_SUBSCRIPTION_SETTINGS.proFeatures
                  ).map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 font-semibold text-amber-950">
                      <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 border-t border-amber-200/80 relative z-10">
                {stats?.isProFull ? (
                  <span className="block w-full py-3.5 px-4 rounded-2xl text-center text-xs font-black bg-gray-200 text-gray-500 cursor-not-allowed">
                    تکمیل ظرفیت پرو
                  </span>
                ) : userTier === 'PRO' ? (
                  <div className="w-full py-3.5 px-4 rounded-2xl text-center text-xs font-black bg-amber-200 text-amber-950 border border-amber-400">
                    اشتراک پرو فعال است ✓
                  </div>
                ) : (
                  <Link
                    href="/checkout?subscriptionPlan=PRO"
                    className="w-full py-3.5 px-4 rounded-2xl text-center text-xs font-black bg-gradient-to-r from-amber-600 via-amber-500 to-[#D4AF37] hover:brightness-110 text-white shadow-xl shadow-amber-600/35 flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition-all"
                  >
                    <Crown className="w-4 h-4 text-amber-100" />
                    <span>
                      {subSettings.proButtonText || `خرید اشتراک پرو (${formatToman(subSettings.proMonthlyPrice)})`}
                    </span>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Shiraz Farm Story & Heritage Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 content-auto">
        <div className="bg-white rounded-3xl border border-[#E6E1D5] shadow-farm overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-center">
            <div className="lg:col-span-7 p-8 sm:p-12 space-y-5">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#D4A373]/15 text-[#2C4A2E] text-xs font-bold">
                <Leaf className="w-4 h-4 text-[#D4A373]" />
                <span>{content.storyBadgeText || 'اصالت سرزمین فارس'}</span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-black text-[#2C4A2E] leading-tight">
                {content.storyTitle || 'از دامنه‌های زاگرس تا سفره‌های شیراز'}
              </h2>

              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed font-normal">
                {content.storyDescription ||
                  'پروفارم با گردآوری بیش از ۲۴ مزرعه‌دار سنتی در مناطق کامفیروز، دشت ارژن، سپیدان، فیروزآباد و میمند، واسطه‌ها را حذف کرده تا محصولات طبیعی با حداکثر طراوت و بهای عادلانه به دست مصرف‌کننده برسد.'}
              </p>

              <div className="flex items-center gap-2 text-xs font-bold text-[#2C4A2E] pt-2">
                <MapPin className="w-4 h-4 text-[#D4A373]" />
                <span>مزارع تحت پوشش: {content.storyLocation || 'دشت ارژن، کامفیروز، سپیدان و میمند فارس'}</span>
              </div>
            </div>

            <div className="lg:col-span-5 h-72 sm:h-96 relative overflow-hidden bg-gray-100">
              <Image
                src={
                  content.storyImageUrl ||
                  '/images/story-fars-farms.jpg'
                }
                alt={content.storyTitle || 'داستان مزارع فارس'}
                fill
                loading="lazy"
                sizes="(max-width: 1024px) 100vw, 42vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent z-10" />
            </div>
          </div>
        </div>
      </section>

      {/* 5. Shiraz Logistics & Wholesale Notice Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 content-auto">
        <div className="bg-[#F3EFE6] rounded-3xl border border-[#E6E1D5] overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-12 items-center">
            <div className="md:col-span-8 p-8 flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#2C4A2E] flex items-center justify-center text-[#D4A373] shrink-0">
                <Package className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                 <div className="inline-block text-[11px] font-bold text-[#D4A373]">
                  {content.bulkBadgeText || 'فروش مستقیم کارگاهی و مزارع'}
                </div>
                <h3 className="text-base sm:text-lg font-black text-[#2C4A2E]">
                  {content.bulkSectionTitle || 'خارج از شیراز هستید و تمایل به خرید عمده محصولات دارید؟'}
                </h3>
                <p className="text-xs text-gray-600 leading-relaxed max-w-xl">
                  {content.bulkSectionSubtitle ||
                    'خرده‌فروشی مزارع ما صرفاً در شیراز عرضه می‌شود. اما با بخش «خرید عمده» می‌توانید سفارش‌های بالای ۱۰ بسته یا ۵ میلیون تومان را به مقصد تمام شهرهای ایران ثبت کنید.'}
                </p>
                <div className="pt-2">
                  <Link
                    href="/bulk"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#2C4A2E] text-white text-xs font-bold hover:bg-[#1E3520] transition-colors shadow-xs"
                  >
                    <span>{content.bulkCtaText || 'ورود به سامانه سفارش عمده'}</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>

            <div className="md:col-span-4 h-48 md:h-full min-h-[180px] relative overflow-hidden bg-gray-200">
              <Image
                src={
                  content.bulkSectionImageUrl ||
                  '/images/bulk-logistics.jpg'
                }
                alt="تامین عمده مزارع فارس"
                fill
                loading="lazy"
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
