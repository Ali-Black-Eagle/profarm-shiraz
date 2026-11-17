'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Crown,
  Zap,
  Users,
  CheckCircle2,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Eye,
  Percent,
  Truck,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  Check,
  ChevronLeft,
  Clock,
  Sliders,
  Tag,
  HelpCircle,
  Info,
  Egg,
  Layers,
  Edit3,
} from 'lucide-react';
import { farmStore } from '@/lib/db-store';
import { SubscriptionSettings, SubscriptionStats } from '@/types';
import { formatToman, toPersianDigits, getDeduplicatedPerks } from '@/lib/formatters';
import SubscriptionLiveEditor from '@/components/modules/SubscriptionLiveEditor';

export default function AdminSubscriptionsPage() {
  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] = useState<SubscriptionSettings>(() =>
    farmStore.getSubscriptionSettings()
  );
  const [stats, setStats] = useState<SubscriptionStats | null>(null);
  const [activeTab, setActiveTab] = useState<'live_editor' | 'pro' | 'plus' | 'free' | 'preview'>('live_editor');
  const [previewMode, setPreviewMode] = useState<'user' | 'admin'>('user');

  // New perk input states
  const [newProPerk, setNewProPerk] = useState('');
  const [newPlusPerk, setNewPlusPerk] = useState('');
  const [newFreePerk, setNewFreePerk] = useState('');

  // Feedback toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const refreshData = () => {
    const currentSettings = farmStore.getSubscriptionSettings();
    setSettings({ ...currentSettings });
    setStats(farmStore.getSubscriptionStats());
  };

  useEffect(() => {
    setMounted(true);
    refreshData();

    // Authoritative sync with server
    farmStore.syncSubscriptionSettings().then((synced) => {
      setSettings({ ...synced });
      setStats(farmStore.getSubscriptionStats());
    });

    const handleUpdate = () => {
      refreshData();
    };

    window.addEventListener('profarm_subscription_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('profarm_subscription_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const sanitizedSettings: SubscriptionSettings = {
        ...settings,
        freeFeatures: Array.isArray(settings.freeFeatures)
          ? settings.freeFeatures.map((p) => (typeof p === 'string' ? p.trim() : '')).filter(Boolean)
          : [],
        plusFeatures: Array.isArray(settings.plusFeatures)
          ? settings.plusFeatures.map((p) => (typeof p === 'string' ? p.trim() : '')).filter(Boolean)
          : [],
        proFeatures: Array.isArray(settings.proFeatures)
          ? settings.proFeatures.map((p) => (typeof p === 'string' ? p.trim() : '')).filter(Boolean)
          : [],
        faqItems: Array.isArray(settings.faqItems)
          ? settings.faqItems.filter((item) => item && (item.q || item.a))
          : [],
        comparisonRows: Array.isArray(settings.comparisonRows)
          ? settings.comparisonRows.filter(
              (r) => r && (r.title?.trim() || r.free?.trim() || r.plus?.trim() || r.pro?.trim())
            )
          : [],
      };
      setSettings(sanitizedSettings);

      let serverSaved = false;
      try {
        const res = await fetch('/api/subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings: sanitizedSettings }),
        });
        if (res.ok) {
          serverSaved = true;
        } else {
          // Fallback to /api/admin
          const adminRes = await fetch('/api/admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'updateSubscriptionSettings',
              payload: { settings: sanitizedSettings },
            }),
          });
          if (adminRes.ok) {
            serverSaved = true;
          }
        }
      } catch {
        serverSaved = false;
      }

      if (!serverSaved) {
        showToast('خطا در ذخیره تنظیمات اشتراک در سرور. لطفاً اتصال خود را بررسی کرده و مجدداً تلاش کنید.');
        return;
      }

      farmStore.updateSubscriptionSettings(sanitizedSettings);
      setStats(farmStore.getSubscriptionStats());
      showToast('تنظیمات اشتراک‌ها با موفقیت در سرور ذخیره و در سراسر سایت اعمال شد.');
    } catch (err) {
      showToast('خطا در ذخیره‌سازی تنظیمات');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (
      window.confirm(
        'آیا از بازنشانی کلیه تنظیمات، قیمت‌ها، ظرفیت‌ها و مزایای اشتراک به مقادیر پیش‌فرض مزارع اطمینان دارید؟'
      )
    ) {
      const reset = farmStore.resetSubscriptionSettings();
      try {
        const res = await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'updateSubscriptionSettings',
            payload: { settings: reset },
          }),
        });
        if (!res.ok) {
          showToast('خطا در بازنشانی تنظیمات در سرور.');
          return;
        }
      } catch {
        showToast('خطا در ارتباط با سرور؛ بازنشانی انجام نشد.');
        return;
      }
      refreshData();
      showToast('تنظیمات اشتراک با موفقیت به مقادیر اولیه بازگردانی شد.');
    }
  };

  // Add perk handler
  const handleAddPerk = (tier: 'PRO' | 'PLUS' | 'FREE') => {
    if (tier === 'PRO') {
      if (!newProPerk.trim()) return;
      setSettings((prev) => ({
        ...prev,
        proFeatures: [...(prev.proFeatures || []), newProPerk.trim()],
      }));
      setNewProPerk('');
    } else if (tier === 'PLUS') {
      if (!newPlusPerk.trim()) return;
      setSettings((prev) => ({
        ...prev,
        plusFeatures: [...(prev.plusFeatures || []), newPlusPerk.trim()],
      }));
      setNewPlusPerk('');
    } else {
      if (!newFreePerk.trim()) return;
      setSettings((prev) => ({
        ...prev,
        freeFeatures: [...(prev.freeFeatures || []), newFreePerk.trim()],
      }));
      setNewFreePerk('');
    }
  };

  // Delete perk handler
  const handleDeletePerk = (tier: 'PRO' | 'PLUS' | 'FREE', index: number) => {
    if (tier === 'PRO') {
      setSettings((prev) => ({
        ...prev,
        proFeatures: prev.proFeatures.filter((_, i) => i !== index),
      }));
    } else if (tier === 'PLUS') {
      setSettings((prev) => ({
        ...prev,
        plusFeatures: prev.plusFeatures.filter((_, i) => i !== index),
      }));
    } else {
      setSettings((prev) => ({
        ...prev,
        freeFeatures: prev.freeFeatures.filter((_, i) => i !== index),
      }));
    }
  };

  // Edit perk inline
  const handleEditPerk = (tier: 'PRO' | 'PLUS' | 'FREE', index: number, value: string) => {
    if (tier === 'PRO') {
      const updated = [...(settings.proFeatures || [])];
      updated[index] = value;
      setSettings((prev) => ({ ...prev, proFeatures: updated }));
    } else if (tier === 'PLUS') {
      const updated = [...(settings.plusFeatures || [])];
      updated[index] = value;
      setSettings((prev) => ({ ...prev, plusFeatures: updated }));
    } else {
      const updated = [...(settings.freeFeatures || [])];
      updated[index] = value;
      setSettings((prev) => ({ ...prev, freeFeatures: updated }));
    }
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-[#2C4A2E] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const proUsagePercent =
    stats && stats.proCapacity > 0
      ? Math.min(100, Math.round((stats.proCount / stats.proCapacity) * 100))
      : 0;

  const plusUsagePercent =
    stats && stats.plusCapacity > 0
      ? Math.min(100, Math.round((stats.plusCount / stats.plusCapacity) * 100))
      : 0;

  return (
    <div className="space-y-8 pb-16 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-50 bg-[#1E3520] text-white px-5 py-4 rounded-2xl shadow-2xl border border-emerald-500/30 flex items-center gap-3 animate-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold leading-relaxed">{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E6E1D5] pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1.5 font-bold">
            <Link href="/admin" className="hover:text-[#2C4A2E]">
              پنل مدیریت
            </Link>
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="text-[#2C4A2E]">مدیریت جامع اشتراک‌ها و باشگاه مشتریان</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 flex items-center gap-3">
            <Crown className="w-8 h-8 text-[#D4AF37]" />
            <span>مدیریت جامع اشتراک‌ها و باشگاه مشتریان</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            تعیین ظرفیت مجاز اعضا، قیمت‌های واقعی درگاه، درصدهای تخفیف سبد خرید و ویرایش محتوای بصری کارت‌ها
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setActiveTab('live_editor')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 border shadow-xs cursor-pointer ${
              activeTab === 'live_editor'
                ? 'bg-gradient-to-r from-emerald-800 via-[#2C4A2E] to-[#1E3520] text-white border-emerald-600 shadow-md ring-2 ring-emerald-500/30'
                : 'bg-emerald-50 text-emerald-950 border-emerald-300 hover:bg-emerald-100'
            }`}
          >
            <Edit3 className="w-4 h-4 text-[#D4AF37]" />
            <span>ویرایش زنده صفحه اشتراک‌ها</span>
          </button>

          <button
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 border shadow-xs cursor-pointer ${
              activeTab === 'preview'
                ? 'bg-[#2C4A2E] text-white border-[#2C4A2E]'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Eye className="w-4 h-4 text-[#D4AF37]" />
            <span>پیش‌نمایش زنده کارت‌ها</span>
          </button>

          <button
            onClick={handleReset}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>بازنشانی پیش‌فرض</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-[#2C4A2E] to-[#1E3520] hover:brightness-110 text-white shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-[#D4AF37]" />
            <span>{isSaving ? 'در حال ذخیره‌سازی...' : 'ذخیره و انتشار آنی'}</span>
          </button>
        </div>
      </div>

      {/* Distinction Guide Card: Real (Functional) vs Visual (Display) */}
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-[#1E3520] via-[#2C4A2E] to-[#122315] text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 border border-emerald-500/20">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#D4AF37] text-gray-900 text-[10px] font-black">
              راهنمای تفکیک کادرها
            </span>
            <h3 className="text-sm font-black text-white">
              تفکیک خصوصیات واقعی (سیستمی) از خصوصیات بصری (نمایشی)
            </h3>
          </div>
          <p className="text-xs text-emerald-100/90 leading-relaxed">
            • <strong>کادرهای سبز / خصوصیت واقعی (⚙️):</strong> مقادیری مانند بهای پرداختی در درگاه، سقف ظرفیت، درصدهای تخفیف و سهمیه‌ها که مستقیماً در درگاه شاپرک، فرمول‌های سبد خرید و فاکتور نهایی اعمال می‌شوند.
            <br />
            • <strong>کادرهای بنفش / خصوصیت بصری (🎨):</strong> متون نمایشی، برچسب‌ها (Badge) و فهرست مزایا (Bullet Points) که صرفاً برای نمایش ظاهری، بازاریابی و زیبایی در کارت‌های اشتراک استفاده می‌شوند.
          </p>
        </div>
      </div>

      {/* KPI & Live Capacity Dashboard Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* PRO Tier Stats */}
        <div className="bg-gradient-to-br from-amber-50 to-white p-5 rounded-3xl border-2 border-amber-300 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-600" />
              <span className="text-xs font-black text-amber-950">مشترکین طلایی پرو</span>
            </div>
            <span
              className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                stats?.isProFull
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {stats?.isProFull ? 'تکمیل ظرفیت' : 'ظرفیت باز'}
            </span>
          </div>

          <div className="mt-2 flex items-baseline justify-between">
            <div className="text-2xl font-black text-amber-950">
              {toPersianDigits(stats?.proCount || 0)}{' '}
              <span className="text-xs font-normal text-gray-500">عضو فعال</span>
            </div>
            <div className="text-xs font-bold text-gray-600">
              سقف:{' '}
              {settings.proMaxCapacity > 0
                ? `${toPersianDigits(settings.proMaxCapacity)} نفر`
                : 'نامحدود'}
            </div>
          </div>

          {settings.proMaxCapacity > 0 ? (
            <div className="mt-3 space-y-1">
              <div className="w-full bg-amber-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    stats?.isProFull ? 'bg-rose-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${proUsagePercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-gray-500">
                <span>{toPersianDigits(proUsagePercent)}٪ پر شده</span>
                <span>
                  {stats?.proRemaining !== null
                    ? `${toPersianDigits(stats?.proRemaining)} نفر مانده`
                    : ''}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-gray-400 mt-2">ثبت‌نام بدون محدودیت ظرفیت فعال است</p>
          )}
        </div>

        {/* PLUS Tier Stats */}
        <div className="bg-gradient-to-br from-emerald-50 to-white p-5 rounded-3xl border-2 border-emerald-300 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-600" />
              <span className="text-xs font-black text-emerald-950">مشترکین اقتصادی پلاس</span>
            </div>
            <span
              className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                stats?.isPlusFull
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {stats?.isPlusFull ? 'تکمیل ظرفیت' : 'ظرفیت باز'}
            </span>
          </div>

          <div className="mt-2 flex items-baseline justify-between">
            <div className="text-2xl font-black text-emerald-950">
              {toPersianDigits(stats?.plusCount || 0)}{' '}
              <span className="text-xs font-normal text-gray-500">عضو فعال</span>
            </div>
            <div className="text-xs font-bold text-gray-600">
              سقف:{' '}
              {settings.plusMaxCapacity > 0
                ? `${toPersianDigits(settings.plusMaxCapacity)} نفر`
                : 'نامحدود'}
            </div>
          </div>

          {settings.plusMaxCapacity > 0 ? (
            <div className="mt-3 space-y-1">
              <div className="w-full bg-emerald-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    stats?.isPlusFull ? 'bg-rose-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${plusUsagePercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-gray-500">
                <span>{toPersianDigits(plusUsagePercent)}٪ پر شده</span>
                <span>
                  {stats?.plusRemaining !== null
                    ? `${toPersianDigits(stats?.plusRemaining)} نفر مانده`
                    : ''}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-gray-400 mt-2">ثبت‌نام بدون محدودیت ظرفیت فعال است</p>
          )}
        </div>

        {/* FREE Tier Users */}
        <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-500" />
              <span className="text-xs font-black text-gray-800">کاربران عادی (رایگان)</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              پایه
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-gray-900">
            {toPersianDigits(stats?.freeCount || 0)}{' '}
            <span className="text-xs font-normal text-gray-500">کاربر</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-3">
            خریداران بدون حق عضویت ویژه با ارسال عادی
          </p>
        </div>

        {/* Total Registered Users */}
        <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#2C4A2E]" />
              <span className="text-xs font-black text-[#2C4A2E]">کل پایگاه کاربران</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800">
              تایید شده
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-gray-900">
            {toPersianDigits(stats?.totalUsers || 0)}{' '}
            <span className="text-xs font-normal text-gray-500">کل اعضا</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-3">
            مجموع کاربران پرو، پلاس و اعضای عادی ثبت‌شده
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('live_editor')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black transition-all cursor-pointer shrink-0 ${
            activeTab === 'live_editor'
              ? 'bg-gradient-to-r from-emerald-800 via-[#2C4A2E] to-[#1E3520] text-white shadow-md'
              : 'text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300/80'
          }`}
        >
          <Edit3 className="w-4 h-4 text-[#D4AF37]" />
          <span>ویرایشگر زنده و بصری صفحه اشتراک (/pro)</span>
        </button>

        <button
          onClick={() => setActiveTab('pro')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black transition-all cursor-pointer shrink-0 ${
            activeTab === 'pro'
              ? 'bg-amber-100 text-amber-950 border border-amber-300 shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Crown className="w-4 h-4 text-amber-600" />
          <span>تنظیمات پلن طلایی پرو</span>
        </button>

        <button
          onClick={() => setActiveTab('plus')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black transition-all cursor-pointer shrink-0 ${
            activeTab === 'plus'
              ? 'bg-emerald-100 text-emerald-950 border border-emerald-300 shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Zap className="w-4 h-4 text-emerald-600" />
          <span>تنظیمات پلن اقتصادی پلاس</span>
        </button>

        <button
          onClick={() => setActiveTab('free')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black transition-all cursor-pointer shrink-0 ${
            activeTab === 'free'
              ? 'bg-gray-100 text-gray-950 border border-gray-300 shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Truck className="w-4 h-4 text-gray-600" />
          <span>پلن پایه (عادی) و تعرفه ارسال</span>
        </button>

        <button
          onClick={() => setActiveTab('preview')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black transition-all cursor-pointer shrink-0 ${
            activeTab === 'preview'
              ? 'bg-[#2C4A2E] text-white shadow-md'
              : 'text-[#2C4A2E] hover:bg-emerald-50 font-black'
          }`}
        >
          <Eye className="w-4 h-4 text-[#D4AF37]" />
          <span>پیش‌نمایش زنده در صفحه مشتریان</span>
        </button>
      </div>

      {/* ==================================================== */}
      {/* TAB 0: LIVE IN-PLACE VISUAL EDITOR                   */}
      {/* ==================================================== */}
      {activeTab === 'live_editor' && (
        <div className="animate-in fade-in">
          <SubscriptionLiveEditor
            settings={settings}
            onChange={setSettings}
            onSave={handleSave}
            onReset={handleReset}
            isSaving={isSaving}
          />
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 1: PRO TIER SETTINGS                             */}
      {/* ==================================================== */}
      {activeTab === 'pro' && (
        <div className="space-y-6 animate-in fade-in">
          {/* 1. REAL / OPERATIONAL PROPERTIES (Green-bordered Container) */}
          <div className="bg-emerald-50/20 rounded-3xl p-6 sm:p-8 border-2 border-emerald-500/40 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-emerald-200">
              <div className="space-y-1">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-black w-fit shadow-xs">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>خصوصیت واقعی (اعمال سیستمی در درگاه پرداخت، سبد خرید و قوانین سفارش)</span>
                </div>
                <h3 className="text-base font-black text-gray-900 mt-1">
                  تعرفه واقعی، سقف ظرفیت و فرمول‌های محاسباتی تخفیف اشتراک پرو
                </h3>
                <p className="text-xs text-gray-600">
                  این مقادیر منطق محاسباتی سیستم را تعیین می‌کنند و مستقیماً روی درگاه شاپرک، کسر تخفیف در فاکتور و وضعیت ظرفیت اثر دارند.
                </p>
              </div>
              <span className="text-xs font-black px-3 py-1 bg-amber-100 text-amber-900 rounded-full shrink-0">
                پلن طلایی پرو
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 text-xs">
              {/* Field 1: Monthly Price (Real) */}
              <div className="p-4 rounded-2xl bg-white border border-emerald-200/80 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-gray-800 font-black">
                    بهای اشتراک ماهانه در درگاه:
                  </label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    خصوصیت واقعی
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step={1000}
                    value={settings.proMonthlyPrice}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        proMonthlyPrice: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-emerald-600 font-bold text-gray-900"
                  />
                  <span className="absolute left-3 top-2.5 text-gray-400">تومان</span>
                </div>
                <span className="text-[11px] text-gray-500 mt-1 block">
                  مبلغ پرداخت درگاه: <strong>{formatToman(settings.proMonthlyPrice)}</strong>
                </span>
              </div>

              {/* Field 2: Max Capacity (Real) */}
              <div className="p-4 rounded-2xl bg-white border border-emerald-200/80 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-gray-800 font-black">
                    سقف ظرفیت پذیرش اعضا:
                  </label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    خصوصیت واقعی
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={settings.proMaxCapacity}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        proMaxCapacity: Math.max(0, Number(e.target.value)),
                      }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-emerald-600 font-bold text-gray-900"
                    placeholder="0 برای نامحدود"
                  />
                  <span className="absolute left-3 top-2.5 text-gray-400">نفر</span>
                </div>
                <span className="text-[11px] text-gray-500 mt-1 block">
                  {settings.proMaxCapacity > 0
                    ? `محدود به ${toPersianDigits(settings.proMaxCapacity)} نفر (اعضا: ${toPersianDigits(stats?.proCount || 0)})`
                    : '۰ به معنای ظرفیت نامحدود است'}
                </span>
              </div>

              {/* Field 3: Egg Discount % (Real) */}
              <div className="p-4 rounded-2xl bg-white border border-emerald-200/80 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-gray-800 font-black">
                    درصد تخفیف تخم‌مرغ محلی:
                  </label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    خصوصیت واقعی
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={settings.proEggDiscountPercent}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        proEggDiscountPercent: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-emerald-600 font-bold text-gray-900"
                  />
                  <span className="absolute left-3 top-2.5 text-gray-400">٪</span>
                </div>
                <span className="text-[11px] text-gray-500 mt-1 block">
                  اعمال خودکار روی سبد خرید مشترک
                </span>
              </div>

              {/* Field 4: Egg Max Quota (Real) */}
              <div className="p-4 rounded-2xl bg-white border border-emerald-200/80 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-gray-800 font-black">
                    سقف سهمیه ماهانه تخم‌مرغ:
                  </label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    خصوصیت واقعی
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step={10}
                    value={settings.proEggMaxQuota}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        proEggMaxQuota: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-emerald-600 font-bold text-gray-900"
                  />
                  <span className="absolute left-3 top-2.5 text-gray-400">عدد</span>
                </div>
                <span className="text-[11px] text-gray-500 mt-1 block">
                  معادل {toPersianDigits(Math.round(settings.proEggMaxQuota / 30))} شانه ۳۰ عددی
                </span>
              </div>

              {/* Field 5: Other Discount % (Real) */}
              <div className="p-4 rounded-2xl bg-white border border-emerald-200/80 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-gray-800 font-black">
                    درصد تخفیف سایر کالاها:
                  </label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    خصوصیت واقعی
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={settings.proOtherDiscountPercent}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        proOtherDiscountPercent: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-emerald-600 font-bold text-gray-900"
                  />
                  <span className="absolute left-3 top-2.5 text-gray-400">٪</span>
                </div>
                <span className="text-[11px] text-gray-500 mt-1 block">
                  تخفیف خودکار روی عسل، عرقیات و لبنیات
                </span>
              </div>

              {/* Field 6: Shipping Discount % (Real) */}
              <div className="p-4 rounded-2xl bg-white border border-emerald-200/80 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-gray-800 font-black">
                    تخفیف هزینه ارسال پیک:
                  </label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    خصوصیت واقعی
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={settings.proShippingDiscountPercent}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        proShippingDiscountPercent: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-emerald-600 font-bold text-gray-900"
                  />
                  <span className="absolute left-3 top-2.5 text-gray-400">٪</span>
                </div>
                <span className="text-[11px] text-gray-500 mt-1 block">
                  کسر از کرایه مصوب پیک در تسویه‌حساب
                </span>
              </div>

              {/* Field 7: Delivery Days Per Week (Real) */}
              <div className="p-4 rounded-2xl bg-white border border-emerald-200/80 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-gray-800 font-black">
                    تعداد روزهای مجاز تحویل:
                  </label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    خصوصیت واقعی
                  </span>
                </div>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={settings.proDeliveryDaysPerWeek}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      proDeliveryDaysPerWeek: Number(e.target.value),
                    }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-emerald-600 font-bold text-gray-900"
                />
                <span className="text-[11px] text-gray-500 mt-1 block">
                  شنبه تا پنج‌شنبه ({toPersianDigits(settings.proDeliveryDaysPerWeek)} روز در هفته)
                </span>
              </div>
            </div>
          </div>

          {/* 2. VISUAL / MARKETING PROPERTIES (Purple/Amber Container) */}
          <div className="bg-purple-50/20 rounded-3xl p-6 sm:p-8 border-2 border-purple-400/40 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-purple-200">
              <div className="space-y-1">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-700 text-white text-[11px] font-black w-fit shadow-xs">
                  <Eye className="w-3.5 h-3.5" />
                  <span>خصوصیت بصری (صرفاً جهت نمایش ظاهری، معرفی پلن و بازاریابی در سایت)</span>
                </div>
                <h3 className="text-base font-black text-gray-900 mt-1">
                  نشان برچسب، عناوین نمایشی و لیست مزایای اشتراک طلایی پرو
                </h3>
                <p className="text-xs text-gray-600">
                  این موارد جنبه زیبایی‌شناختی و تبلیغاتی دارند و بر محاسبات مالی و فاکتور اثر نمی‌گذارند.
                </p>
              </div>
              <span className="text-xs font-bold text-purple-900 bg-purple-100 px-3 py-1 rounded-full">
                {toPersianDigits(settings.proFeatures?.length || 0)} مزیت نمایشی
              </span>
            </div>

            <div className="space-y-4">
              {/* Badge Text (Visual) */}
              <div className="p-4 rounded-2xl bg-white border border-purple-200/80 shadow-xs max-w-md space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <label className="block text-gray-800 font-black">
                    عنوان برچسب نشان پلن (Badge):
                  </label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                    خصوصیت بصری
                  </span>
                </div>
                <input
                  type="text"
                  value={settings.proBadgeText || 'طلایی'}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, proBadgeText: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-purple-600 font-bold text-gray-900"
                />
                <span className="text-[11px] text-gray-500 mt-1 block">
                  برچسب بالای کارت، مانند: «طلایی»، «پیشنهاد ویژه» یا «محبوب‌ترین»
                </span>
              </div>

              {/* Dynamic Perks List (Visual) */}
              <div className="p-5 rounded-2xl bg-white border border-purple-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-gray-800 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span>فهرست مزایا و امکانات نمایشی کارت (Bullet Points):</span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                    خصوصیت بصری
                  </span>
                </div>

                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <span>
                    <strong>راهنمای جلوگیری از تکرار:</strong> مواردی همچون درصد تخفیف تخم‌مرغ محلی ({toPersianDigits(settings.proEggDiscountPercent)}٪)، سقف سهمیه ({toPersianDigits(settings.proEggMaxQuota)} عدد)، تخفیف ارسال، تخفیف سایر کالاها و روزهای تحویل در بالا به عنوان <em>خصوصیت واقعی</em> تعریف شده و به صورت خودکار روی بنرها نمایش داده می‌شوند. بنابراین نیازی به تکرار آن‌ها در این لیست نیست تا موارد ۲ بار در بنر گفته نشوند.
                  </span>
                </div>

                <div className="space-y-2.5">
                  {settings.proFeatures && settings.proFeatures.length > 0 ? (
                    settings.proFeatures.map((perk, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 bg-purple-50/40 rounded-2xl border border-purple-200/70 hover:border-purple-400 transition-all"
                      >
                        <CheckCircle2 className="w-5 h-5 text-purple-600 shrink-0" />
                        <input
                          type="text"
                          value={perk}
                          onChange={(e) => handleEditPerk('PRO', index, e.target.value)}
                          className="flex-1 bg-transparent text-xs sm:text-sm font-bold text-gray-800 focus:outline-none focus:bg-white focus:px-3 focus:py-1.5 focus:rounded-xl focus:border focus:border-purple-400"
                        />
                        <button
                          type="button"
                          onClick={() => handleDeletePerk('PRO', index)}
                          title="حذف این مزیت"
                          className="p-2 rounded-xl text-rose-500 hover:bg-rose-100 transition-all cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-xs text-gray-400">
                      هنوز مزیتی برای این اشتراک تعریف نشده است.
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="عنوان مزیت جدید را وارد کنید (مثلاً: اولویت ارسال و تخفیف ویژه)..."
                    value={newProPerk}
                    onChange={(e) => setNewProPerk(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddPerk('PRO');
                      }
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-xs sm:text-sm font-medium focus:outline-none focus:border-purple-600 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddPerk('PRO')}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>افزودن مزیت</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 2: PLUS TIER SETTINGS                            */}
      {/* ==================================================== */}
      {activeTab === 'plus' && (
        <div className="space-y-6 animate-in fade-in">
          {/* 1. REAL / OPERATIONAL PROPERTIES */}
          <div className="bg-emerald-50/20 rounded-3xl p-6 sm:p-8 border-2 border-emerald-500/40 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-emerald-200">
              <div className="space-y-1">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-black w-fit shadow-xs">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>خصوصیت واقعی (اعمال سیستمی در درگاه پرداخت، سبد خرید و سهمیه‌ها)</span>
                </div>
                <h3 className="text-base font-black text-gray-900 mt-1">
                  تعرفه واقعی، سقف ظرفیت و تخفیف‌های اشتراک اقتصادی پلاس
                </h3>
                <p className="text-xs text-gray-600">
                  این فیلدها فرمول‌های ریاضی و نرخ‌های مالی کسرشده از خریدار در درگاه و فاکتور را کنترل می‌کنند.
                </p>
              </div>
              <span className="text-xs font-black px-3 py-1 bg-emerald-100 text-emerald-900 rounded-full shrink-0">
                پلن اقتصادی پلاس
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 text-xs">
              {/* Plus Monthly Price */}
              <div className="p-4 rounded-2xl bg-white border border-emerald-200/80 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-gray-800 font-black">
                    بهای اشتراک ماهانه در درگاه:
                  </label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    خصوصیت واقعی
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step={1000}
                    value={settings.plusMonthlyPrice}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        plusMonthlyPrice: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-emerald-600 font-bold text-gray-900"
                  />
                  <span className="absolute left-3 top-2.5 text-gray-400">تومان</span>
                </div>
                <span className="text-[11px] text-gray-500 mt-1 block">
                  مبلغ پرداخت درگاه: <strong>{formatToman(settings.plusMonthlyPrice)}</strong>
                </span>
              </div>

              {/* Plus Max Capacity */}
              <div className="p-4 rounded-2xl bg-white border border-emerald-200/80 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-gray-800 font-black">
                    سقف ظرفیت پذیرش اعضا:
                  </label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    خصوصیت واقعی
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={settings.plusMaxCapacity}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        plusMaxCapacity: Math.max(0, Number(e.target.value)),
                      }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-emerald-600 font-bold text-gray-900"
                    placeholder="0 برای نامحدود"
                  />
                  <span className="absolute left-3 top-2.5 text-gray-400">نفر</span>
                </div>
                <span className="text-[11px] text-gray-500 mt-1 block">
                  {settings.plusMaxCapacity > 0
                    ? `محدود به ${toPersianDigits(settings.plusMaxCapacity)} نفر (اعضا: ${toPersianDigits(stats?.plusCount || 0)})`
                    : '۰ به معنای ظرفیت نامحدود است'}
                </span>
              </div>

              {/* Plus Egg Discount % */}
              <div className="p-4 rounded-2xl bg-white border border-emerald-200/80 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-gray-800 font-black">
                    درصد تخفیف تخم‌مرغ محلی:
                  </label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    خصوصیت واقعی
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={settings.plusEggDiscountPercent}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        plusEggDiscountPercent: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-emerald-600 font-bold text-gray-900"
                  />
                  <span className="absolute left-3 top-2.5 text-gray-400">٪</span>
                </div>
                <span className="text-[11px] text-gray-500 mt-1 block">
                  کسر خودکار در فاکتور سبد خرید
                </span>
              </div>

              {/* Plus Egg Max Quota */}
              <div className="p-4 rounded-2xl bg-white border border-emerald-200/80 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-gray-800 font-black">
                    سقف سهمیه ماهانه تخم‌مرغ:
                  </label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    خصوصیت واقعی
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step={10}
                    value={settings.plusEggMaxQuota}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        plusEggMaxQuota: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-emerald-600 font-bold text-gray-900"
                  />
                  <span className="absolute left-3 top-2.5 text-gray-400">عدد</span>
                </div>
                <span className="text-[11px] text-gray-500 mt-1 block">
                  معادل {toPersianDigits(Math.round(settings.plusEggMaxQuota / 30))} شانه ۳۰ عددی
                </span>
              </div>

              {/* Plus Delivery Days Per Week */}
              <div className="p-4 rounded-2xl bg-white border border-emerald-200/80 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-gray-800 font-black">
                    تعداد روزهای مجاز تحویل:
                  </label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    خصوصیت واقعی
                  </span>
                </div>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={settings.plusDeliveryDaysPerWeek}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      plusDeliveryDaysPerWeek: Number(e.target.value),
                    }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-emerald-600 font-bold text-gray-900"
                />
                <span className="text-[11px] text-gray-500 mt-1 block">
                  شنبه تا پنج‌شنبه ({toPersianDigits(settings.plusDeliveryDaysPerWeek)} روز در هفته)
                </span>
              </div>
            </div>
          </div>

          {/* 2. VISUAL / MARKETING PROPERTIES */}
          <div className="bg-purple-50/20 rounded-3xl p-6 sm:p-8 border-2 border-purple-400/40 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-purple-200">
              <div className="space-y-1">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-700 text-white text-[11px] font-black w-fit shadow-xs">
                  <Eye className="w-3.5 h-3.5" />
                  <span>خصوصیت بصری (صرفاً جهت نمایش ظاهری، معرفی پلن و بازاریابی در سایت)</span>
                </div>
                <h3 className="text-base font-black text-gray-900 mt-1">
                  نشان برچسب، عناوین و فهرست مزایای اشتراک پلاس
                </h3>
                <p className="text-xs text-gray-600">
                  متونی که در ظاهر کارت اشتراک به مشتریان نمایش داده می‌شود.
                </p>
              </div>
              <span className="text-xs font-bold text-purple-900 bg-purple-100 px-3 py-1 rounded-full">
                {toPersianDigits(settings.plusFeatures?.length || 0)} مزیت نمایشی
              </span>
            </div>

            <div className="space-y-4">
              {/* Plus Badge Text */}
              <div className="p-4 rounded-2xl bg-white border border-purple-200/80 shadow-xs max-w-md space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <label className="block text-gray-800 font-black">
                    عنوان برچسب نشان پلن (Badge):
                  </label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                    خصوصیت بصری
                  </span>
                </div>
                <input
                  type="text"
                  value={settings.plusBadgeText || 'اقتصادی'}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, plusBadgeText: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-purple-600 font-bold text-gray-900"
                />
                <span className="text-[11px] text-gray-500 mt-1 block">
                  برچسب بالای کارت، مانند: «اقتصادی» یا «ویژه خانواده‌ها»
                </span>
              </div>

              {/* Dynamic Perks List */}
              <div className="p-5 rounded-2xl bg-white border border-purple-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-gray-800 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span>فهرست مزایا و امکانات نمایشی کارت پلاس (Bullet Points):</span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                    خصوصیت بصری
                  </span>
                </div>

                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <span>
                    <strong>راهنمای جلوگیری از تکرار:</strong> درصد تخفیف تخم‌مرغ محلی ({toPersianDigits(settings.plusEggDiscountPercent)}٪)، سقف سهمیه ({toPersianDigits(settings.plusEggMaxQuota)} عدد) و روزهای تحویل ({toPersianDigits(settings.plusDeliveryDaysPerWeek)} روز) در بخش بالا به صورت خودکار محاسبه و با آیکون به کارت اضافه می‌شوند و نیازی به تایپ مجدد آن‌ها در این بخش نیست.
                  </span>
                </div>

                <div className="space-y-2.5">
                  {settings.plusFeatures && settings.plusFeatures.length > 0 ? (
                    settings.plusFeatures.map((perk, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 bg-purple-50/40 rounded-2xl border border-purple-200/70 hover:border-purple-400 transition-all"
                      >
                        <CheckCircle2 className="w-5 h-5 text-purple-600 shrink-0" />
                        <input
                          type="text"
                          value={perk}
                          onChange={(e) => handleEditPerk('PLUS', index, e.target.value)}
                          className="flex-1 bg-transparent text-xs sm:text-sm font-bold text-gray-800 focus:outline-none focus:bg-white focus:px-3 focus:py-1.5 focus:rounded-xl focus:border focus:border-purple-400"
                        />
                        <button
                          type="button"
                          onClick={() => handleDeletePerk('PLUS', index)}
                          title="حذف این مزیت"
                          className="p-2 rounded-xl text-rose-500 hover:bg-rose-100 transition-all cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-xs text-gray-400">
                      هنوز مزیتی برای این اشتراک تعریف نشده است.
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="عنوان مزیت جدید پلن پلاس را وارد کنید..."
                    value={newPlusPerk}
                    onChange={(e) => setNewPlusPerk(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddPerk('PLUS');
                      }
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-xs sm:text-sm font-medium focus:outline-none focus:border-purple-600 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddPerk('PLUS')}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>افزودن مزیت</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 3: FREE TIER & GENERAL SHIPPING                  */}
      {/* ==================================================== */}
      {activeTab === 'free' && (
        <div className="space-y-6 animate-in fade-in">
          {/* 1. REAL / OPERATIONAL PROPERTIES */}
          <div className="bg-emerald-50/20 rounded-3xl p-6 sm:p-8 border-2 border-emerald-500/40 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-emerald-200">
              <div className="space-y-1">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-black w-fit shadow-xs">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>خصوصیت واقعی (اعمال سیستمی در فاکتور سفارشات عادی)</span>
                </div>
                <h3 className="text-base font-black text-gray-900 mt-1">
                  تعرفه استاندارد حمل سفارشات با پیک پروفارم در شیراز
                </h3>
                <p className="text-xs text-gray-600">
                  این مبلغ مستقیماً به جمع کل فاکتور سفارشات کاربران عادی در مرحله تسویه‌حساب افزوده می‌شود.
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-gray-100 text-gray-800 rounded-full shrink-0">
                پلن عادی
              </span>
            </div>

            <div className="max-w-md text-xs">
              <div className="p-4 rounded-2xl bg-white border border-emerald-200/80 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-gray-800 font-black">
                    هزینه استاندارد ارسال با پیک (تومان):
                  </label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    خصوصیت واقعی
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step={1000}
                    value={settings.baseShippingFee}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        baseShippingFee: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-emerald-600 font-bold text-gray-900"
                  />
                  <span className="absolute left-3 top-2.5 text-gray-400">تومان</span>
                </div>
                <span className="text-[11px] text-gray-500 mt-1 block">
                  مبلغ کرایه پایه در فاکتور: <strong>{formatToman(settings.baseShippingFee)}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* 2. VISUAL / MARKETING PROPERTIES */}
          <div className="bg-purple-50/20 rounded-3xl p-6 sm:p-8 border-2 border-purple-400/40 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-purple-200">
              <div className="space-y-1">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-700 text-white text-[11px] font-black w-fit shadow-xs">
                  <Eye className="w-3.5 h-3.5" />
                  <span>خصوصیت بصری (صرفاً جهت نمایش ظاهری در جدول مقایسه پلن‌ها)</span>
                </div>
                <h3 className="text-base font-black text-gray-900 mt-1">
                  متن نمایشی روزهای تحویل و توضیحات پلن عادی
                </h3>
                <p className="text-xs text-gray-600">
                  متونی که در جدول مقایسه اشتراک‌ها برای خریداران بدون عضویت نمایش داده می‌شود.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl text-xs">
                {/* Badge Text */}
                <div className="p-4 rounded-2xl bg-white border border-purple-200/80 shadow-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-gray-800 font-black">
                      عنوان برچسب پلن عادی (Badge):
                    </label>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                      خصوصیت بصری
                    </span>
                  </div>
                  <input
                    type="text"
                    value={settings.freeBadgeText || 'عادی'}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, freeBadgeText: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-purple-600 font-bold text-gray-900"
                  />
                </div>

                {/* Delivery Days Text */}
                <div className="p-4 rounded-2xl bg-white border border-purple-200/80 shadow-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-gray-800 font-black">
                      متن نمایشی روزهای تحویل:
                    </label>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                      خصوصیت بصری
                    </span>
                  </div>
                  <input
                    type="text"
                    value={settings.freeTierDeliveryDaysText}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        freeTierDeliveryDaysText: e.target.value,
                      }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-purple-600 font-bold text-gray-900"
                  />
                  <span className="text-[11px] text-gray-500 mt-1 block">
                    مثال: «شنبه، دوشنبه و چهارشنبه»
                  </span>
                </div>
              </div>

              {/* Dynamic Free Perks */}
              <div className="p-5 rounded-2xl bg-white border border-purple-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-gray-800 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span>توضیحات و شرایط نمایشی پلن عادی (در جدول مقایسه):</span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                    خصوصیت بصری
                  </span>
                </div>

                <div className="space-y-2.5">
                  {settings.freeFeatures && settings.freeFeatures.length > 0 ? (
                    settings.freeFeatures.map((perk, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 bg-purple-50/40 rounded-2xl border border-purple-200/70 hover:border-purple-400 transition-all"
                      >
                        <div className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
                        <input
                          type="text"
                          value={perk}
                          onChange={(e) => handleEditPerk('FREE', index, e.target.value)}
                          className="flex-1 bg-transparent text-xs sm:text-sm font-bold text-gray-800 focus:outline-none focus:bg-white focus:px-3 focus:py-1.5 focus:rounded-xl focus:border focus:border-purple-400"
                        />
                        <button
                          type="button"
                          onClick={() => handleDeletePerk('FREE', index)}
                          className="p-2 rounded-xl text-rose-500 hover:bg-rose-100 transition-all cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  ) : null}
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="افزودن شرط یا توضیح جدید برای پلن عادی..."
                    value={newFreePerk}
                    onChange={(e) => setNewFreePerk(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddPerk('FREE');
                      }
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-xs sm:text-sm font-medium focus:outline-none focus:border-purple-600 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddPerk('FREE')}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>افزودن آیتم</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 4: LIVE PREVIEW SIMULATOR                        */}
      {/* ==================================================== */}
      {activeTab === 'preview' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-gradient-to-r from-[#2C4A2E] to-[#1E3520] text-white p-6 rounded-3xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-amber-300 font-black">
                <Sparkles className="w-4 h-4" />
                <span>شبیه‌ساز لحظه‌ای صفحه مشترکین و صفحه اصلی (Live Preview)</span>
              </div>
              <h2 className="text-xl font-black">
                پیش‌نمایش دقیق نحوه انعکاس خصوصیات واقعی و بصری در سایت
              </h2>
              <p className="text-xs text-gray-300">
                تمام خصوصیات واقعی (قیمت، تخفیف‌ها) و بصری (برچسب‌ها، مزایا) هم‌اکنون در این شبیه‌ساز قابل مشاهده هستند.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-3 rounded-xl text-xs font-black bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black hover:brightness-110 shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>تأیید و ذخیره تغییرات</span>
              </button>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-[#E6E1D5] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-black text-gray-800 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span>حالت پیش‌نمایش کارت‌ها:</span>
              </div>
              <p className="text-[11px] text-gray-500">
                دید خریدار عادی: سقف کل ظرفیت مخفی است و مانده فقط زمانی که ۳ عدد یا کمتر باشد نمایش داده می‌شود.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-2xl w-fit">
              <button
                type="button"
                onClick={() => setPreviewMode('user')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  previewMode === 'user'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>دید مشتری عادی (تجربه کاربری سایت)</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('admin')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  previewMode === 'admin'
                    ? 'bg-[#2C4A2E] text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>دید مدیریت (همراه با ظرفیت‌ها و آمار)</span>
              </button>
            </div>
          </div>

          {/* Live Subscription Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Free Tier */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#E6E1D5] shadow-farm flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <span className="text-xs font-bold text-gray-500">کاربر عادی</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                    {previewMode === 'admin'
                      ? `${toPersianDigits(stats?.freeCount || 0)} عضو فعال`
                      : settings.freeBadgeText || 'طرح پایه'}
                  </span>
                </div>
                <div>
                  <div className="text-2xl font-black text-gray-900">
                    {settings.freePriceLabel || 'رایگان'}
                  </div>
                  <span className="text-[11px] text-gray-400">
                    {settings.freePriceSubtext || 'بدون نیاز به پرداخت ماهانه'}
                  </span>
                </div>

                <ul className="space-y-2.5 text-xs text-gray-600">
                  {settings.freeFeatures?.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <button
                  disabled
                  className="w-full py-3 px-4 rounded-xl text-center text-xs font-bold bg-gray-100 text-gray-500 cursor-not-allowed"
                >
                  {settings.freeButtonText || 'طرح پیش‌فرض فعال ✓'}
                </button>
              </div>
            </div>

            {/* Card 2: Plus Tier */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border-2 border-emerald-300 shadow-farm flex flex-col justify-between space-y-6 relative overflow-hidden">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-emerald-100">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-emerald-600" />
                    <span className="text-sm font-black text-emerald-950">{settings.plusTitle || 'اشتراک پلاس'}</span>
                  </div>
                  <span className="text-xs font-black px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900">
                    {settings.plusBadgeText || 'اقتصادی'}
                  </span>
                </div>

                <div>
                  <div className="text-2xl font-black text-[#2C4A2E]">
                    {formatToman(settings.plusMonthlyPrice)}
                  </div>
                  <span className="text-[11px] text-emerald-700 font-medium">
                    {settings.plusPriceSubtext || 'صرفه‌جویی تضمین‌شده در خرید هفتگی'}
                  </span>
                </div>

                {/* Capacity alert badge */}
                {previewMode === 'admin' ? (
                  <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-900 text-xs font-bold flex items-center justify-between border border-emerald-200">
                    <span>
                      ظرفیت کل: {settings.plusMaxCapacity > 0 ? `${toPersianDigits(settings.plusMaxCapacity)} نفر` : 'نامحدود'}
                    </span>
                    <span>{toPersianDigits(stats?.plusCount || 0)} عضو</span>
                  </div>
                ) : (
                  stats?.isPlusFull ? (
                    <div className="p-2 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold text-center border border-rose-200">
                      تکمیل ظرفیت این دوره
                    </div>
                  ) : stats && stats.plusRemaining !== null && stats.plusRemaining <= 3 ? (
                    <div className="p-2 rounded-xl bg-amber-50 text-amber-800 text-xs font-bold text-center border border-amber-200 animate-pulse">
                      تنها {toPersianDigits(stats.plusRemaining)} اشتراک باقیمانده!
                    </div>
                  ) : null
                )}

                <ul className="space-y-2.5 text-xs text-gray-700">
                  {settings.plusFeatures?.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 font-medium text-emerald-950">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <button
                  disabled={stats?.isPlusFull}
                  className={`w-full py-3 px-4 rounded-xl text-center text-xs font-black shadow-sm transition-all ${
                    stats?.isPlusFull
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-[#2C4A2E] hover:bg-[#1E3520] text-white cursor-pointer'
                  }`}
                >
                  {stats?.isPlusFull ? 'تکمیل ظرفیت' : settings.plusButtonText || 'خرید و ارتقاء به پلاس'}
                </button>
              </div>
            </div>

            {/* Card 3: Pro Tier */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border-2 border-amber-400 shadow-lg shadow-amber-500/10 flex flex-col justify-between space-y-6 relative overflow-hidden">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-amber-100">
                  <div className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-amber-600" />
                    <span className="text-sm font-black text-amber-950">{settings.proTitle || 'اشتراک طلایی پرو'}</span>
                  </div>
                  <span className="text-xs font-black px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-400 to-[#D4AF37] text-white shadow-xs">
                    {settings.proBadgeText || 'پیشنهاد طلایی'}
                  </span>
                </div>

                <div>
                  <div className="text-2xl font-black text-amber-950">
                    {formatToman(settings.proMonthlyPrice)}
                  </div>
                  <span className="text-[11px] text-amber-700 font-bold">
                    {settings.proPriceSubtext ||
                      `${toPersianDigits(settings.proEggDiscountPercent)}٪ تخم‌مرغ + ${toPersianDigits(settings.proOtherDiscountPercent)}٪ سایر محصولات + ${toPersianDigits(settings.proShippingDiscountPercent)}٪ تخفیف ارسال`}
                  </span>
                </div>

                {/* Capacity alert badge */}
                {previewMode === 'admin' ? (
                  <div className="p-2.5 rounded-xl bg-amber-50 text-amber-900 text-xs font-bold flex items-center justify-between border border-amber-200">
                    <span>
                      ظرفیت کل: {settings.proMaxCapacity > 0 ? `${toPersianDigits(settings.proMaxCapacity)} نفر` : 'نامحدود'}
                    </span>
                    <span>{toPersianDigits(stats?.proCount || 0)} عضو</span>
                  </div>
                ) : (
                  stats?.isProFull ? (
                    <div className="p-2 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold text-center border border-rose-200">
                      تکمیل ظرفیت این دوره
                    </div>
                  ) : stats && stats.proRemaining !== null && stats.proRemaining <= 3 ? (
                    <div className="p-2 rounded-xl bg-amber-50 text-amber-800 text-xs font-bold text-center border border-amber-200 animate-pulse">
                      تنها {toPersianDigits(stats.proRemaining)} اشتراک باقیمانده!
                    </div>
                  ) : null
                )}

                <ul className="space-y-2.5 text-xs text-gray-700">
                  {settings.proFeatures?.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 font-medium text-amber-950">
                      <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <button
                  disabled={stats?.isProFull}
                  className={`w-full py-3 px-4 rounded-xl text-center text-xs font-black shadow-md transition-all ${
                    stats?.isProFull
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black hover:brightness-105 cursor-pointer'
                  }`}
                >
                  {stats?.isProFull ? 'تکمیل ظرفیت' : 'عضویت طلایی در باشگاه پرو'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
