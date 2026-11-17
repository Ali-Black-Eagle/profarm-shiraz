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
      <section className="relative overflow-hidden pt-8 pb-16 md:pt-14 md:pb-24 bg-gradient-to-b from-farm-bg-warm via-farm-bg to-farm-bg border-b border-farm-border">
        {/* Subtle decorative background circles */}
        <div className="absolute top-0 right-10 w-96 h-96 bg-farm-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-80 h-80 bg-farm-accent/10 rounded-full blur-2xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Main Column: Calm, Authoritative Typography & Clear Primary CTA */}
            <div className="w-full lg:col-span-7 space-y-6 text-center lg:text-right flex flex-col items-center lg:items-start">
              <div className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-farm-border shadow-xs text-xs font-bold text-farm-primary mx-auto lg:mx-0">
                <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" aria-hidden="true" />
                <span>{content.heroBadgeText}</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-farm-primary leading-[1.2] tracking-tight text-center lg:text-right w-full">
                {content.heroTitlePart1} <br />
                <span className="text-farm-gold-text">{content.heroTitleHighlight}</span>
              </h1>

              <p className="text-sm sm:text-base text-farm-text-muted leading-relaxed max-w-2xl font-normal mx-auto lg:mx-0 text-center lg:text-right w-full">
                {content.heroSubtitle}
              </p>

              {/* Single Dominant Primary CTA + Calm Secondary Link */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3.5 pt-2 w-full">
                <Link
                  href="/products"
                  className="group min-h-[48px] px-7 py-3.5 rounded-2xl bg-farm-primary hover:bg-farm-primary-dark text-white text-sm font-black shadow-md hover:shadow-lg active:scale-[0.98] transition-all flex items-center gap-2.5"
                >
                  <span>{content.heroCtaProductsText}</span>
                  <ArrowLeft className="w-4 h-4 text-farm-accent group-hover:-translate-x-1 transition-transform" />
                </Link>

                <Link
                  href="/pro"
                  className="group min-h-[48px] px-6 py-3.5 rounded-2xl bg-white hover:bg-farm-bg-warm text-farm-primary text-sm font-extrabold border border-farm-border hover:border-farm-primary/40 shadow-xs active:scale-[0.98] transition-all flex items-center gap-2"
                >
                  <Crown className="w-4 h-4 text-farm-gold-text" />
                  <span>{content.heroCtaProText}</span>
                </Link>
              </div>

              {/* Shiraz Trust Highlights (Dynamic) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 border-t border-farm-border/80 text-xs sm:text-[13px] w-full">
                <div className="flex items-center justify-center lg:justify-start gap-2">
                  <Truck className="w-4 h-4 text-farm-primary shrink-0" />
                  <span className="text-gray-800 font-medium">{content.trustItem1}</span>
                </div>
                <div className="flex items-center justify-center lg:justify-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-farm-primary shrink-0" />
                  <span className="text-gray-800 font-medium">{content.trustItem2}</span>
                </div>
                <div className="flex items-center justify-center lg:justify-start gap-2">
                  <Leaf className="w-4 h-4 text-farm-primary shrink-0" />
                  <span className="text-gray-800 font-medium">{content.trustItem3}</span>
                </div>
              </div>
            </div>

            {/* Right Column: Hero Visual Card (High Priority LCP + Readable Scrim) */}
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
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent flex flex-col justify-end p-6 text-white z-10">
                  <span className="text-xs text-[#F3E5AB] font-bold">
                    {content.heroImageTag || 'تضمین ۱۰۰٪ ارگانیک و محلی'}
                  </span>
                  <p className="text-base font-bold mt-1 leading-snug text-white">
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
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-7">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-farm-gold-text tracking-wide">
              {content.productsBadgeText || 'پکیج‌های آماده و شناسنامه‌دار'}
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-farm-primary mt-1">
              {content.productsSectionTitle || 'تازه‌ترین محصولات ارگانیک باغات و مزارع فارس'}
            </h2>
          </div>
          <Link
            href="/products"
            className="text-sm font-bold text-farm-primary hover:text-farm-primary-dark flex items-center gap-1 min-h-[44px]"
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
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-farm-primary text-white shadow-xs'
                  : 'bg-white text-gray-700 border border-farm-border hover:bg-farm-bg-warm'
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

      {/* 3. Pro & Plus Membership Plans Comparison (Unified Shiraz Emerald & Gold Palette) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-farm-primary via-[#243c26] to-farm-primary-dark rounded-3xl p-6 sm:p-10 lg:p-12 text-white relative overflow-hidden shadow-farm">
          <div className="absolute top-0 left-0 w-80 h-80 bg-farm-accent/10 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-3xl mb-8 space-y-2 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[#F3E5AB] text-xs font-bold border border-white/15">
              <Crown className="w-3.5 h-3.5" />
              <span>باشگاه مشترکین مزارع شیراز</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              {content.proSectionTitle}
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
              {content.proSectionSubtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch relative z-10">
            {/* Card 1: Regular / Free (Calm Warm Base Card) */}
            <div
              className={`relative overflow-hidden rounded-3xl p-6 sm:p-7 flex flex-col justify-between space-y-6 text-farm-text transition-all duration-300 bg-farm-bg border ${
                userTier === 'FREE'
                  ? 'border-farm-accent ring-2 ring-farm-accent/30 shadow-lg'
                  : 'border-farm-border hover:border-farm-accent/60 shadow-md'
              }`}
            >
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-farm-bg-warm text-farm-primary text-xs font-bold border border-farm-border">
                    <span>{subSettings.freeSubtitle || 'طرح پایه'}</span>
                  </div>
                  <h3 className="text-xl font-black text-farm-primary">{subSettings.freeTitle || 'کاربر عادی'}</h3>
                  <p className="text-xs text-farm-text-muted">سفارش‌های گاه‌به‌گاه و خرید آزمایشی</p>
                </div>

                <div className="pt-2 pb-4 border-b border-farm-border">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-farm-primary">{subSettings.freePriceLabel || 'رایگان'}</span>
                  </div>
                  <span className="text-xs text-farm-text-muted">{subSettings.freePriceSubtext || 'بدون هزینه ماهانه'}</span>
                </div>

                <ul className="space-y-3 text-xs sm:text-[13px] text-gray-800">
                  {(Array.isArray(subSettings.freeFeatures)
                    ? subSettings.freeFeatures
                    : DEFAULT_SUBSCRIPTION_SETTINGS.freeFeatures
                  ).map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 font-medium">
                      <Check className="w-4 h-4 text-farm-primary shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 border-t border-farm-border">
                <div className="w-full min-h-[44px] flex items-center justify-center px-4 rounded-2xl text-xs font-bold text-center bg-farm-bg-warm text-farm-primary border border-farm-border">
                  {userTier === 'FREE' ? 'طرح فعال فعلی شما ✓' : 'طرح پایه فروشگاه'}
                </div>
              </div>
            </div>

            {/* Card 2: Plus Membership (Refined Clean White + Emerald Accent) */}
            <div
              className={`relative overflow-hidden rounded-3xl p-6 sm:p-7 flex flex-col justify-between space-y-6 text-farm-text transition-all duration-300 bg-white border ${
                userTier === 'PLUS'
                  ? 'border-emerald-600 ring-2 ring-emerald-500/40 shadow-xl'
                  : 'border-farm-border hover:border-emerald-400 shadow-lg'
              }`}
            >
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-900 text-xs font-bold border border-emerald-200">
                    <Zap className="w-3.5 h-3.5 text-emerald-700" />
                    <span>{subSettings.plusBadgeText || 'اقتصادی'}</span>
                  </div>
                  <h3 className="text-xl font-black text-farm-primary">{subSettings.plusTitle || 'اشتراک پلاس'}</h3>
                  <p className="text-xs text-farm-text-muted font-medium">{subSettings.plusSubtitle || 'تحویل همه روزه + تخفیف تخم‌مرغ محلی'}</p>
                </div>

                <div className="pt-2 pb-4 border-b border-farm-border">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-farm-primary">
                      {formatToman(subSettings.plusMonthlyPrice)}
                    </span>
                    <span className="text-xs font-bold text-farm-text-muted"> / ماهانه</span>
                  </div>
                  <span className="text-xs text-emerald-800 font-semibold">
                    {subSettings.plusPriceSubtext || 'صرفه‌جویی تضمین‌شده در خرید هفتگی'}
                  </span>
                </div>

                {/* Capacity alert badge */}
                {stats?.isPlusFull ? (
                  <div className="p-2.5 rounded-xl bg-rose-50 text-rose-800 text-xs font-bold text-center border border-rose-200">
                    تکمیل ظرفیت این دوره
                  </div>
                ) : stats && subSettings.plusMaxCapacity > 0 && stats.plusRemaining !== null && stats.plusRemaining <= 3 && stats.plusRemaining > 0 ? (
                  <div className="p-2.5 rounded-xl bg-amber-50 text-amber-950 text-xs font-bold text-center border border-amber-300">
                    تنها {toPersianDigits(stats.plusRemaining)} اشتراک باقیمانده
                  </div>
                ) : null}

                <ul className="space-y-3 text-xs sm:text-[13px] text-gray-800">
                  {(Array.isArray(subSettings.plusFeatures)
                    ? subSettings.plusFeatures
                    : DEFAULT_SUBSCRIPTION_SETTINGS.plusFeatures
                  ).map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 font-medium">
                      <Check className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 border-t border-farm-border">
                {userTier === 'PLUS' ? (
                  <div className="w-full min-h-[44px] flex items-center justify-center px-4 rounded-2xl text-center text-xs font-black bg-emerald-100 text-emerald-950 border border-emerald-300">
                    اشتراک پلاس فعال است ✓
                  </div>
                ) : (
                  <Link
                    href="/checkout?subscriptionPlan=PLUS"
                    className="w-full min-h-[48px] px-4 rounded-2xl text-center text-xs sm:text-sm font-black bg-farm-primary hover:bg-farm-primary-dark text-white transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                  >
                    <Zap className="w-4 h-4 text-farm-accent" />
                    <span>
                      {stats?.isPlusFull
                        ? 'تکمیل ظرفیت این دوره'
                        : subSettings.plusButtonText || `خرید اشتراک پلاس (${formatToman(subSettings.plusMonthlyPrice)})`}
                    </span>
                  </Link>
                )}
              </div>
            </div>

            {/* Card 3: Pro (Single Clearly Recommended Hero Plan with Accessible Gold Ink) */}
            <div
              className={`relative overflow-hidden rounded-3xl p-6 sm:p-7 flex flex-col justify-between space-y-6 text-farm-text transition-all duration-300 bg-[#FFFDF7] border-2 ${
                userTier === 'PRO'
                  ? 'border-farm-gold ring-2 ring-farm-gold/40 shadow-2xl'
                  : 'border-farm-gold shadow-2xl ring-2 ring-farm-accent/35'
              }`}
            >
              {/* Single Recommended Badge (dark ink on gold >= 7.5:1 contrast) */}
              <div className="absolute top-4 left-4 bg-farm-accent text-farm-gold-ink text-xs font-black px-3 py-1 rounded-full shadow-xs z-20">
                ★ {subSettings.proTopLabel || 'پیشنهاد مزرعه'}
              </div>

              <div className="space-y-5 relative z-10">
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-100 text-farm-gold-ink text-xs font-bold border border-amber-300">
                    <Crown className="w-3.5 h-3.5 text-farm-gold-text" />
                    <span>{subSettings.proBadgeText || 'اشتراک طلایی پروفارم پرو'}</span>
                  </div>
                  <h3 className="text-xl font-black text-farm-primary">{subSettings.proTitle || 'اشتراک پرو (Pro)'}</h3>
                  <p className="text-xs text-farm-gold-text font-semibold">{subSettings.proSubtitle || 'حداکثر تخفیف و بیشترین انعطاف در دریافت'}</p>
                </div>

                <div className="pt-2 pb-4 border-b border-amber-200/90">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-farm-primary">
                      {formatToman(subSettings.proMonthlyPrice)}
                    </span>
                    <span className="text-xs font-bold text-farm-gold-text"> / ماهانه</span>
                  </div>
                  <span className="text-xs text-farm-gold-text font-bold">
                    {subSettings.proPriceSubtext ||
                      `${toPersianDigits(subSettings.proEggDiscountPercent)}٪ تخم‌مرغ + ${toPersianDigits(subSettings.proOtherDiscountPercent)}٪ سایر محصولات + ${toPersianDigits(subSettings.proShippingDiscountPercent)}٪ تخفیف ارسال`}
                  </span>
                </div>

                {/* Capacity alert badge */}
                {stats?.isProFull ? (
                  <div className="p-2.5 rounded-xl bg-rose-50 text-rose-800 text-xs font-bold text-center border border-rose-200">
                    تکمیل ظرفیت این دوره
                  </div>
                ) : stats && subSettings.proMaxCapacity > 0 && stats.proRemaining !== null && stats.proRemaining <= 3 && stats.proRemaining > 0 ? (
                  <div className="p-2.5 rounded-xl bg-amber-100 text-farm-gold-ink text-xs font-bold text-center border border-amber-300">
                    تنها {toPersianDigits(stats.proRemaining)} اشتراک باقیمانده
                  </div>
                ) : null}

                <ul className="space-y-3 text-xs sm:text-[13px] text-gray-800">
                  {(Array.isArray(subSettings.proFeatures)
                    ? subSettings.proFeatures
                    : DEFAULT_SUBSCRIPTION_SETTINGS.proFeatures
                  ).map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 font-semibold text-farm-text">
                      <Check className="w-4 h-4 text-farm-gold-text shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 border-t border-amber-200/90 relative z-10">
                {stats?.isProFull ? (
                  <span className="flex items-center justify-center w-full min-h-[48px] px-4 rounded-2xl text-center text-xs font-black bg-gray-200 text-gray-600 cursor-not-allowed">
                    تکمیل ظرفیت پرو
                  </span>
                ) : userTier === 'PRO' ? (
                  <div className="w-full min-h-[48px] flex items-center justify-center px-4 rounded-2xl text-center text-xs font-black bg-amber-100 text-farm-gold-ink border border-amber-300">
                    اشتراک پرو فعال است ✓
                  </div>
                ) : (
                  <Link
                    href="/checkout?subscriptionPlan=PRO"
                    className="w-full min-h-[48px] px-4 rounded-2xl text-center text-xs sm:text-sm font-black bg-gradient-to-l from-[#D4AF37] to-[#E7C869] hover:brightness-105 text-farm-gold-ink shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-all"
                  >
                    <Crown className="w-4 h-4 text-farm-gold-ink" />
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
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl border border-farm-border shadow-farm overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-center">
            <div className="lg:col-span-7 p-8 sm:p-12 space-y-5">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-farm-bg-warm text-farm-primary text-xs font-bold border border-farm-border">
                <Leaf className="w-4 h-4 text-farm-gold-text" />
                <span>{content.storyBadgeText || 'اصالت سرزمین فارس'}</span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-black text-farm-primary leading-tight">
                {content.storyTitle || 'از دامنه‌های زاگرس تا سفره‌های شیراز'}
              </h2>

              <p className="text-sm text-farm-text-muted leading-relaxed font-normal">
                {content.storyDescription ||
                  'پروفارم با گردآوری بیش از ۲۴ مزرعه‌دار سنتی در مناطق کامفیروز، دشت ارژن، سپیدان، فیروزآباد و میمند، واسطه‌ها را حذف کرده تا محصولات طبیعی با حداکثر طراوت و بهای عادلانه به دست مصرف‌کننده برسد.'}
              </p>

              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-farm-primary pt-2">
                <MapPin className="w-4 h-4 text-farm-gold-text shrink-0" />
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
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-farm-bg-warm rounded-3xl border border-farm-border overflow-hidden shadow-xs">
          <div className="grid grid-cols-1 md:grid-cols-12 items-center">
            <div className="md:col-span-8 p-6 sm:p-8 flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-farm-primary flex items-center justify-center text-farm-accent shrink-0">
                <Package className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <div className="inline-block text-xs font-bold text-farm-gold-text">
                  {content.bulkBadgeText || 'فروش مستقیم کارگاهی و مزارع'}
                </div>
                <h3 className="text-base sm:text-lg font-black text-farm-primary">
                  {content.bulkSectionTitle || 'خارج از شیراز هستید و تمایل به خرید عمده محصولات دارید؟'}
                </h3>
                <p className="text-xs sm:text-sm text-farm-text-muted leading-relaxed max-w-xl">
                  {content.bulkSectionSubtitle ||
                    'خرده‌فروشی مزارع ما صرفاً در شیراز عرضه می‌شود. اما با بخش «خرید عمده» می‌توانید سفارش‌های بالای ۱۰ بسته از یک محصول را به مقصد تمام شهرهای ایران ثبت کنید.'}
                </p>
                <div className="pt-2">
                  <Link
                    href="/bulk"
                    className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-farm-primary text-white text-xs sm:text-sm font-bold hover:bg-farm-primary-dark transition-colors shadow-xs"
                  >
                    <span>{content.bulkCtaText || 'ورود به سامانه سفارش عمده'}</span>
                    <ArrowLeft className="w-4 h-4" />
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
