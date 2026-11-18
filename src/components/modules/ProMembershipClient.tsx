'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { formatToman, toPersianDigits } from '@/lib/formatters';
import {
  Crown,
  Sparkles,
  Zap,
  ArrowLeft,
  Clock,
  Check,
  HelpCircle,
  AlertCircle,
  Edit3,
} from 'lucide-react';
import type { SubscriptionSettings, SubscriptionStats } from '@/types';
import { useToast } from '@/components/ui/ToastProvider';

interface ProMembershipClientProps {
  /** Subscription settings from the admin, read on the server (prices, quotas, texts, FAQ, comparison). */
  subSettings: SubscriptionSettings;
  /** Aggregate capacity figures only. */
  stats: SubscriptionStats | null;
}

export default function ProMembershipClient({ subSettings, stats }: ProMembershipClientProps) {
  const router = useRouter();
  const toast = useToast();
  const [mounted, setMounted] = useState(false);
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isUserLoggedIn = mounted && isAuthenticated && !!user;

  const userTier = isUserLoggedIn ? user?.tier || (user?.isProMember ? 'PRO' : 'FREE') : 'FREE';

  const handleSelectTier = (tier: 'PLUS' | 'PRO') => {
    // A current PRO member may renew even when the plan is full (renewal does not add a member).
    if (tier === 'PRO' && stats?.isProFull && userTier !== 'PRO') {
      toast.warning('ظرفیت اشتراک طلایی پرو در این دوره تکمیل شده است.');
      return;
    }
    if (tier === 'PLUS' && stats?.isPlusFull) {
      toast.warning('ظرفیت اشتراک اقتصادی پلاس در این دوره تکمیل شده است.');
      return;
    }
    if (!isUserLoggedIn) {
      router.push(`/login?redirect=${encodeURIComponent(`/checkout?subscriptionPlan=${tier}`)}`);
      return;
    }
    router.push(`/checkout?subscriptionPlan=${tier}`);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
      {/* Admin Quick Access Bar */}
      {isUserLoggedIn && user?.role === 'ADMIN' && (
        <div className="bg-gradient-to-r from-emerald-800 to-farm-primary-dark text-white p-3.5 sm:p-4 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-4 border border-emerald-500/30 animate-in fade-in">
          <div className="flex items-center gap-2 text-xs font-bold">
            <Sparkles className="w-4 h-4 text-[#D4AF37]" />
            <span>
              شما با دسترسی مدیریت وارد شده‌اید. می‌توانید تمام متن‌ها و نوشته‌های این صفحه را به صورت زنده تغییر دهید.
            </span>
          </div>
          <Link
            href="/admin/subscriptions"
            className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-gray-950 text-xs font-black transition-all flex items-center gap-1.5 shrink-0 shadow-md"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>ویرایشگر زنده و بصری صفحه اشتراک</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Hero Banner */}
      <div className="bg-gradient-to-br from-farm-primary via-[#203622] to-[#122314] rounded-3xl p-8 sm:p-14 text-white relative overflow-hidden shadow-2xl border border-[#D4A373]/40">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#D4AF37]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-3xl space-y-5 relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold border border-amber-400/30">
            <Crown className="w-4 h-4 text-[#D4AF37]" />
            <span>{subSettings.heroBadgeText || 'باشگاه مشترکین ویژه «پروفارم شیراز»'}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black leading-tight text-white">
            {subSettings.heroTitle || 'طراوت هر روزه با تحویل ۶ روز هفته و تخفیف‌های ویژه مزارع فارس'}
          </h1>

          <p className="text-xs sm:text-base text-gray-300 leading-relaxed whitespace-pre-line">
            {subSettings.heroDescription ||
              'کاربران عادی تنها ۲ روز در هفته (یکشنبه و چهارشنبه) امکان دریافت سفارش دارند. با اشتراک‌های پلاس یا پرو، از شنبه تا پنج‌شنبه هر روزی که بخواهید سفارشتان با پیک پروفارم ارسال شده و از تخفیف‌های دائمی خرید تخم‌مرغ محلی و محصولات ارگانیک بهره‌مند می‌شوید.'}
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-amber-200 bg-black/20 px-3.5 py-2 rounded-xl border border-white/10">
              <Sparkles className="w-4 h-4 text-[#D4AF37]" />
              <span>
                طرح فعال شما:{' '}
                <strong>
                  {userTier === 'PRO'
                    ? `اشتراک پرو (${formatToman(subSettings.proMonthlyPrice)})`
                    : userTier === 'PLUS'
                    ? `اشتراک پلاس (${formatToman(subSettings.plusMonthlyPrice)})`
                    : 'کاربر عادی (رایگان)'}
                </strong>
              </span>
            </div>

            <Link
              href="/products"
              className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-md transition-all flex items-center gap-1.5"
            >
              <span>{subSettings.heroCtaText || 'مشاهده محصولات مزارع'}</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* 3 Pricing Cards */}
      <div className="space-y-8">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <span className="text-xs font-bold text-[#D4A373]">{subSettings.sectionSubheader || 'انتخاب پلن مناسب نیاز شما'}</span>
          <h2 className="text-2xl sm:text-3xl font-black text-farm-primary">
            {subSettings.sectionTitle || 'مقایسه و انتخاب اشتراک ماهانه پروفارم'}
          </h2>
          <p className="text-xs sm:text-sm text-gray-600">
            {subSettings.sectionDescription || 'برای خانواده‌هایی که سلامت و کیفیت تغذیه روزمره‌شان در اولویت است'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {/* 1. Free Tier */}
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
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-gradient-to-r from-slate-200 to-slate-300/80 text-slate-800 text-xs font-bold border border-slate-300">
                  <span>{subSettings.freeSubtitle || 'طرح پایه'}</span>
                </div>
                <h3 className="text-xl font-black text-slate-800">{subSettings.freeTitle || 'کاربر عادی'}</h3>
                <p className="text-xs text-slate-600">سفارش‌های گاه‌به‌گاه و خرید آزمایشی</p>
              </div>

              <div className="pt-2 pb-4 border-b border-slate-200">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-slate-900">{subSettings.freePriceLabel || 'رایگان'}</span>
                </div>
                <span className="text-xs text-slate-500">{subSettings.freePriceSubtext || 'بدون نیاز به پرداخت ماهانه'}</span>
              </div>

              <ul className="space-y-3 text-xs text-slate-700">
                {(Array.isArray(subSettings.freeFeatures) ? subSettings.freeFeatures : []).map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5 font-medium text-slate-700">
                    <Check className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-8 border-t border-slate-200/80 relative z-10">
              <div
                className={`w-full py-3.5 px-4 rounded-2xl text-xs font-bold text-center border ${
                  userTier === 'FREE'
                    ? 'bg-slate-200/90 text-slate-800 border-slate-300'
                    : 'bg-white/80 text-slate-700 border-slate-200 hover:bg-white'
                }`}
              >
                {userTier === 'FREE' ? (subSettings.freeButtonText || 'طرح فعلی شما (رایگان) ✓') : 'طرح پایه عادی'}
              </div>
            </div>
          </div>

          {/* 2. Plus Tier */}
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
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-black shadow-sm">
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
                <span className="text-xs text-emerald-700 font-bold">
                  {subSettings.plusPriceSubtext || 'صرفه‌جویی تضمین‌شده در خرید هفتگی'}
                </span>
              </div>

              {/* Capacity notification badge */}
              {stats?.isPlusFull ? (
                <div className="p-2.5 rounded-xl bg-rose-100 text-rose-800 text-xs font-black flex items-center gap-2 border border-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>تکمیل ظرفیت این دوره (امکان ثبت‌نام جدید نیست)</span>
                </div>
              ) : stats && subSettings.plusMaxCapacity > 0 && stats.plusRemaining !== null && stats.plusRemaining <= 3 && stats.plusRemaining > 0 ? (
                <div className="p-2 rounded-xl bg-amber-100 text-amber-900 text-xs font-black flex items-center gap-2 border border-amber-300 animate-pulse">
                  <Clock className="w-3.5 h-3.5 shrink-0 text-amber-700" />
                  <span>
                    تنها {toPersianDigits(stats.plusRemaining)} جایگاه باقی‌مانده!
                  </span>
                </div>
              ) : null}

              <ul className="space-y-3 text-xs text-gray-700">
                {(Array.isArray(subSettings.plusFeatures) ? subSettings.plusFeatures : []).map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5 font-semibold text-emerald-950">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-8 border-t border-emerald-200/80 relative z-10">
              <button
                onClick={() => handleSelectTier('PLUS')}
                disabled={userTier === 'PLUS' || stats?.isPlusFull}
                className={`w-full py-3.5 px-4 rounded-2xl text-xs font-black shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  userTier === 'PLUS'
                    ? 'bg-emerald-200 text-emerald-950 border border-emerald-400 cursor-default shadow-none'
                    : stats?.isPlusFull
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed shadow-none'
                    : 'bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-emerald-700/25 active:scale-98'
                }`}
              >
                <Zap className="w-4 h-4 text-emerald-200" />
                <span>
                  {userTier === 'PLUS'
                    ? 'اشتراک پلاس فعال است ✓'
                    : stats?.isPlusFull
                    ? 'تکمیل ظرفیت این دوره'
                    : subSettings.plusButtonText || `خرید اشتراک پلاس (${formatToman(subSettings.plusMonthlyPrice)})`}
                </span>
              </button>
            </div>
          </div>

          {/* 3. Pro Tier (Featured / Most Popular) */}
          <div
            className={`relative overflow-hidden rounded-3xl p-6 sm:p-8 flex flex-col justify-between space-y-6 text-gray-900 transition-all duration-300 bg-gradient-to-b from-[#FFFDF2] via-[#FEF9E7] to-[#FDE68A]/75 border-2 ${
              userTier === 'PRO'
                ? 'border-amber-500 ring-4 ring-amber-400/50 shadow-2xl'
                : 'border-[#D4AF37] shadow-2xl shadow-amber-500/25 ring-4 ring-amber-400/30 hover:border-amber-500 hover:shadow-amber-500/35'
            }`}
          >
            {/* Floating Top Left Ribbon */}
            <div className="absolute top-4 left-4 bg-gradient-to-r from-amber-600 via-amber-500 to-[#D4AF37] text-white text-xs font-black px-3.5 py-1 rounded-full shadow-md z-20">
              ★ {subSettings.proTopLabel || 'طلایی'}
            </div>

            {/* Decorative royal gold ambient blur */}
            <div className="absolute -top-12 -right-12 w-44 h-44 bg-amber-400/35 rounded-full blur-2xl pointer-events-none" />

            <div className="space-y-5 relative z-10">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-gradient-to-r from-amber-200 to-yellow-200 text-amber-950 text-xs font-bold border border-amber-300">
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
                <span className="text-xs text-amber-800 font-bold">
                  {subSettings.proPriceSubtext ||
                    `${toPersianDigits(subSettings.proEggDiscountPercent)}٪ تخم‌مرغ + ${toPersianDigits(subSettings.proOtherDiscountPercent)}٪ سایر محصولات + ${toPersianDigits(subSettings.proShippingDiscountPercent)}٪ تخفیف ارسال`}
                </span>
              </div>

              {/* Capacity notification badge */}
              {stats?.isProFull ? (
                <div className="p-2.5 rounded-xl bg-rose-100 text-rose-800 text-xs font-black flex items-center gap-2 border border-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>تکمیل ظرفیت این دوره (خرید موقتاً مسدود است)</span>
                </div>
              ) : stats && subSettings.proMaxCapacity > 0 && stats.proRemaining !== null && stats.proRemaining <= 3 && stats.proRemaining > 0 ? (
                <div className="p-2 rounded-xl bg-amber-200/90 text-amber-950 text-xs font-black flex items-center gap-2 border border-amber-400 animate-pulse">
                  <Clock className="w-3.5 h-3.5 shrink-0 text-amber-700" />
                  <span>
                    تنها {toPersianDigits(stats.proRemaining)} جایگاه باقی‌مانده!
                  </span>
                </div>
              ) : null}

              <ul className="space-y-3 text-xs text-gray-800">
                {(Array.isArray(subSettings.proFeatures) ? subSettings.proFeatures : []).map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5 font-semibold text-amber-950">
                    <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-8 border-t border-amber-200/80 relative z-10">
              <button
                onClick={() => handleSelectTier('PRO')}
                disabled={userTier !== 'PRO' && Boolean(stats?.isProFull)}
                className={`w-full py-4 px-4 rounded-2xl text-xs font-black shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  userTier !== 'PRO' && stats?.isProFull
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed shadow-none'
                    : 'bg-gradient-to-r from-amber-600 via-amber-500 to-[#D4AF37] hover:brightness-110 text-white shadow-amber-600/35 active:scale-98'
                }`}
              >
                <Crown className="w-4 h-4 text-amber-100" />
                <span>
                  {userTier === 'PRO'
                    ? 'تمدید اشتراک پرو'
                    : stats?.isProFull
                    ? 'تکمیل ظرفیت این دوره'
                    : subSettings.proButtonText || `خرید اشتراک پرو (${formatToman(subSettings.proMonthlyPrice)})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Comparison Table */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-farm-border shadow-farm space-y-6">
        <h3 className="text-xl font-black text-farm-primary">
          {subSettings.comparisonTitle || 'جدول مقایسه جامع ویژگی‌های پلن‌ها'}
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-3 px-4 font-bold text-gray-700">
                  {subSettings.comparisonFeatureHeader || 'ویژگی و امکانات'}
                </th>
                <th className="py-3 px-4 text-center font-bold text-gray-700">
                  {subSettings.comparisonFreeHeader || 'کاربر عادی'}
                </th>
                <th className="py-3 px-4 text-center font-bold text-emerald-800 bg-emerald-50/50 rounded-t-xl">
                  {subSettings.comparisonPlusHeader || 'اشتراک پلاس'}
                </th>
                <th className="py-3 px-4 text-center font-bold text-amber-900 bg-amber-50/50 rounded-t-xl">
                  {subSettings.comparisonProHeader || 'اشتراک پرو'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(Array.isArray(subSettings.comparisonRows) ? subSettings.comparisonRows : []).map((row, idx) => (
                <tr key={row.id || idx}>
                  <td className="py-3.5 px-4 font-bold text-gray-800">{row.title}</td>
                  <td className="py-3.5 px-4 text-center text-gray-600">{row.free}</td>
                  <td className="py-3.5 px-4 text-center font-bold text-emerald-800 bg-emerald-50/30">
                    {row.plus}
                  </td>
                  <td className="py-3.5 px-4 text-center font-black text-amber-900 bg-amber-50/30">
                    {row.pro}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold text-[#D4A373]">{subSettings.faqSubheader || 'پرسش‌های متداول'}</span>
          <h2 className="text-2xl font-black text-farm-primary">{subSettings.faqTitle || 'سوالاتی که ممکن است داشته باشید'}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(subSettings.faqItems || []).map((faq, idx) => (
            <div key={faq.id || idx} className="bg-white rounded-2xl p-5 border border-farm-border shadow-xs space-y-2">
              <h4 className="text-sm font-bold text-farm-primary flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>{faq.q}</span>
              </h4>
              <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
