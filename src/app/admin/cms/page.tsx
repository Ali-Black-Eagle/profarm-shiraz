'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  farmStore,
  DEFAULT_SITE_CONTENT,
} from '@/lib/db-store';
import { SiteContent } from '@/types';
import { formatToman, toPersianDigits } from '@/lib/formatters';
import {
  LayoutTemplate,
  Save,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  Eye,
  Megaphone,
  Layers,
  ShieldCheck,
  Crown,
  Truck,
  ArrowLeft,
  ChevronLeft,
  Percent,
  Egg,
  Sliders,
  Store,
  PhoneCall,
  Check,
  Zap,
  Tag,
  HelpCircle,
  Clock,
  ShieldAlert,
  Info,
  Image as ImageIcon,
  UploadCloud,
  Link as LinkIcon,
  Camera,
  Share2,
  Globe,
} from 'lucide-react';
import CmsLiveEditor from '@/components/modules/CmsLiveEditor';
import { useToast, useConfirm } from '@/components/ui/ToastProvider';

type TabKey = 'hero' | 'images' | 'trust' | 'sections';

export default function AdminCmsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<TabKey>('hero');
  const [previewTab, setPreviewTab] = useState<'hero' | 'trust'>('hero');
  const [content, setContent] = useState<SiteContent>({ ...DEFAULT_SITE_CONTENT });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const heroFileRef = useRef<HTMLInputElement | null>(null);
  const bulkFileRef = useRef<HTMLInputElement | null>(null);
  const storyFileRef = useRef<HTMLInputElement | null>(null);

  const heroPresets = [
    { label: 'برداشت ارگانیک شیراز (پیش‌فرض)', url: '/images/hero-shiraz-farm.jpg' },
    { label: 'کشاورزان بومی فارس', url: '/images/story-fars-farms.jpg' },
    { label: 'سبد محصولات تازه مزرعه', url: '/images/prod-veggie-box.jpg' },
    { label: 'محصولات سالم و سبزی خوردن', url: '/images/prod-greens.jpg' },
  ];

  const bulkPresets = [
    { label: 'لجستیک و پیک پروفارم (پیش‌فرض)', url: '/images/bulk-logistics.jpg' },
    { label: 'برداشت و بسته‌بندی مزرعه', url: '/images/hero-shiraz-farm.jpg' },
    { label: 'توزیع عمده تخم‌مرغ محلی', url: '/images/prod-eggs.jpg' },
  ];

  const storyPresets = [
    { label: 'کشاورزان بومی فارس (پیش‌فرض)', url: '/images/story-fars-farms.jpg' },
    { label: 'مزرعه خانوادگی شیراز', url: '/images/hero-shiraz-farm.jpg' },
    { label: 'باغات زیتون سروستان', url: '/images/prod-olive-oil.jpg' },
  ];

  const handleImageFileUpload = (
    field: 'heroImageUrl' | 'bulkSectionImageUrl' | 'storyImageUrl',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('حجم فایل انتخابی نباید بیش از ۵ مگابایت باشد.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      const dataUrl = loadEvt.target?.result as string;
      if (dataUrl) {
        handleContentChange(field, dataUrl);
        setToastMessage('تصویر جدید با موفقیت بارگذاری شد. جهت تثبیت روی «ذخیره و انتشار زنده» کلیک کنید.');
        setTimeout(() => setToastMessage(null), 5000);
      }
    };
    reader.readAsDataURL(file);
  };

  const [editorMode, setEditorMode] = useState<'visual' | 'form'>('visual');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin?type=siteContent')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.content) {
          setContent(data.content);
        } else {
          setContent({ ...farmStore.getSiteContent() });
        }
      })
      .catch(() => {
        setContent({ ...farmStore.getSiteContent() });
      });
  }, []);

  const handleContentChange = (field: keyof SiteContent, value: any) => {
    setContent((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateSiteContent',
          payload: { content },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setToastMessage(`خطا: ${data.error || data.message || 'تنظیمات در سرور ذخیره نشد.'}`);
        setTimeout(() => setToastMessage(null), 6000);
        return;
      }
      farmStore.updateSiteContent(content);
      setToastMessage(
        'تنظیمات محتوا و المان‌های سایت با موفقیت در سرور ذخیره و منتشر شد.'
      );
      setTimeout(() => setToastMessage(null), 6000);
    } catch {
      setToastMessage('خطا در ارتباط با سرور؛ تغییرات محتوا ذخیره نشد.');
      setTimeout(() => setToastMessage(null), 6000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    const ok = await confirm({
      title: 'بازنشانی محتوای سایت به پیش‌فرض',
      description: 'آیا از بازنشانی کلیه متون، تصاویر و بخش‌های محتوایی سایت به مقادیر اولیه اطمینان دارید؟',
      confirmLabel: 'بازنشانی پیش‌فرض',
      cancelLabel: 'انصراف',
      variant: 'danger',
    });
    if (ok) {
      try {
        const res = await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'resetSiteContent' }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          const errMsg = data.error || 'بازنشانی در سرور انجام نشد.';
          setToastMessage(`خطا: ${errMsg}`);
          toast.error(errMsg);
          setTimeout(() => setToastMessage(null), 5000);
          return;
        }
        const resetContent = farmStore.resetSiteContent();
        setContent({ ...resetContent });
        const okMsg = 'کلیه متون و بخش‌های سایت به حالت پیش‌فرض اولیه بازنشانی شدند.';
        setToastMessage(okMsg);
        toast.success(okMsg);
        setTimeout(() => setToastMessage(null), 5000);
      } catch {
        const errMsg = 'خطا در ارتباط با سرور؛ بازنشانی انجام نشد.';
        setToastMessage(errMsg);
        toast.error(errMsg);
        setTimeout(() => setToastMessage(null), 5000);
      }
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-farm-border">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#D4A373]">
            <LayoutTemplate className="w-4 h-4 text-farm-primary" />
            <span>مدیریت جامع محتوای سایت (CMS)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-farm-primary mt-1">
            مدیریت المان‌ها، تصاویر، نشان‌های اعتماد و داستان مزرعه
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 leading-relaxed">
            ویرایش مستقیم متون صفحه اصلی، بنرها، تصاویر سایت، نشان‌های اعتماد و شبکه‌های اجتماعی بدون نیاز به کدنویسی
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <RotateCcw className="w-4 h-4 text-gray-500" />
            <span>بازنشانی پیش‌فرض</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl bg-farm-primary text-white hover:bg-farm-primary-dark text-xs font-bold transition-colors flex items-center gap-2 shadow-md cursor-pointer"
          >
            <Save className="w-4 h-4 text-[#D4A373]" />
            <span>ذخیره و انتشار زنده</span>
          </button>
        </div>
      </div>

      {toastMessage && (
        <div
          role={toastMessage.startsWith('خطا') ? 'alert' : 'status'}
          className={`p-4 rounded-2xl border text-sm font-bold flex items-center gap-2.5 animate-in fade-in shadow-xs ${
            toastMessage.startsWith('خطا')
              ? 'bg-rose-50 border-rose-300 text-rose-900'
              : 'bg-emerald-50 border-emerald-300 text-emerald-900'
          }`}
        >
          <CheckCircle2 className={`w-5 h-5 shrink-0 ${toastMessage.startsWith('خطا') ? 'text-rose-600' : 'text-emerald-700'}`} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Subscriptions Migration Notice Banner */}
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-farm-primary-dark via-farm-primary to-[#122315] text-white shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 border border-emerald-500/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center shrink-0">
            <Crown className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-gray-950 text-xs font-black">
                انتقال به مدیریت اختصاصی
              </span>
              <h4 className="text-sm font-black text-white">
                مدیریت اشتراک‌ها و باشگاه مشتریان تجمیع شد!
              </h4>
            </div>
            <p className="text-xs text-emerald-100/85 mt-1">
              تنظیمات جامع اشتراک‌ها شامل قیمت واقعی درگاه، سقف ظرفیت، درصدهای تخفیف، و خصوصیات بصری کارت‌ها تماماً در بخش «مدیریت اشتراک‌ها» متمرکز و ادغام شده‌اند.
            </p>
          </div>
        </div>
        <Link
          href="/admin/subscriptions"
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-[#D4AF37] hover:brightness-110 text-gray-950 text-xs font-black transition-all shrink-0 shadow-md flex items-center gap-2"
        >
          <span>ورود به مدیریت جامع اشتراک‌ها</span>
          <ChevronLeft className="w-4 h-4" />
        </Link>
      </div>

      {/* Editor Mode Selector: Live Visual Editor vs Detailed Form */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between bg-white p-2.5 rounded-2xl border border-farm-border shadow-xs gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditorMode('visual')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
              editorMode === 'visual'
                ? 'bg-gradient-to-r from-farm-primary to-farm-primary-dark text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Sparkles className="w-4 h-4 text-[#D4A373]" />
            <span>ویرایشگر زنده و تصویری (Live WYSIWYG)</span>
            <span className="px-1.5 py-0.5 rounded-md bg-emerald-700 text-xs text-emerald-100">
              پیشنهادی
            </span>
          </button>

          <button
            type="button"
            onClick={() => setEditorMode('form')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              editorMode === 'form'
                ? 'bg-farm-primary text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>فرم تفکیکی تنظیمات (Advanced Form)</span>
          </button>
        </div>

        <div className="text-xs text-gray-500 hidden md:flex items-center gap-1.5 px-3">
          <Info className="w-3.5 h-3.5 text-[#D4A373]" />
          <span>تغییرات به صورت آنی در تمام دستگاه‌ها و صفحه اصلی اعمال خواهند شد</span>
        </div>
      </div>

      {editorMode === 'visual' ? (
        <CmsLiveEditor
          content={content}
          onChange={setContent}
          onSave={handleSave}
          onReset={handleReset}
          isSaving={isSaving}
        />
      ) : (
        <div className="space-y-8">
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('hero')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'hero'
              ? 'bg-farm-primary text-white shadow-sm'
              : 'bg-white border border-farm-border text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>۱. بنر بالا و متن هیرو (Hero & Banner)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('images')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'images'
              ? 'bg-farm-primary text-white shadow-sm'
              : 'bg-white border border-farm-border text-gray-600 hover:bg-gray-50'
          }`}
        >
          <ImageIcon className="w-4 h-4 text-[#D4A373]" />
          <span>۲. تصاویر و بنرهای اصلی سایت (Site Images)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('trust')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'trust'
              ? 'bg-farm-primary text-white shadow-sm'
              : 'bg-white border border-farm-border text-gray-600 hover:bg-gray-50'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>۳. نشان‌های اعتماد و داستان مزرعه (Trust & Story)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sections')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'sections'
              ? 'bg-farm-primary text-white shadow-sm'
              : 'bg-white border border-farm-border text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Store className="w-4 h-4 text-purple-600" />
          <span>۴. محصولات، خرید عمده و شبکه‌های اجتماعی (Sections & Social)</span>
        </button>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="space-y-8">
        {/* TAB 1: HERO & BANNER */}
        {activeTab === 'hero' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-farm-border shadow-farm space-y-6 animate-in fade-in">
            <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100">
              <Megaphone className="w-5 h-5 text-farm-primary" />
              <h3 className="text-base font-bold text-farm-primary">
                تنظیمات نوار اطلاعیه بالا و هیرو صفحه اصلی
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
              <div className="md:col-span-2 p-4 rounded-2xl bg-farm-bg border border-farm-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-800">نوار اعلان بالای سایت (Announcement Bar):</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={content.topBannerActive}
                      onChange={(e) => handleContentChange('topBannerActive', e.target.checked)}
                      className="rounded text-farm-primary focus:ring-farm-primary"
                    />
                    <span className="font-semibold text-gray-700">نمایش در سایت</span>
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-gray-600 mb-1 font-medium">متن پیام اطلاعیه:</label>
                    <input
                      type="text"
                      value={content.topBannerText}
                      onChange={(e) => handleContentChange('topBannerText', e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white focus:outline-none focus:border-farm-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1 font-medium">متن اقدام/لینک:</label>
                    <input
                      type="text"
                      value={content.topBannerLinkText}
                      onChange={(e) => handleContentChange('topBannerLinkText', e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white focus:outline-none focus:border-farm-primary"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1.5">بج کوچک بالای هیرو:</label>
                <input
                  type="text"
                  value={content.heroBadgeText}
                  onChange={(e) => handleContentChange('heroBadgeText', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-farm-bg focus:bg-white focus:outline-none focus:border-farm-primary"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1.5">عنوان اصلی هیرو (بخش اول):</label>
                <input
                  type="text"
                  value={content.heroTitlePart1}
                  onChange={(e) => handleContentChange('heroTitlePart1', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-farm-bg focus:bg-white focus:outline-none focus:border-farm-primary"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-gray-700 font-bold mb-1.5">عبارت هایلایت طلایی عنوان:</label>
                <input
                  type="text"
                  value={content.heroTitleHighlight}
                  onChange={(e) => handleContentChange('heroTitleHighlight', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-amber-300 bg-amber-50/40 text-amber-950 font-bold focus:bg-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-gray-700 font-bold mb-1.5">توضیحات و زیرعنوان معرفی مزارع شیراز:</label>
                <textarea
                  rows={3}
                  value={content.heroSubtitle}
                  onChange={(e) => handleContentChange('heroSubtitle', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-farm-bg focus:bg-white focus:outline-none focus:border-farm-primary leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1.5">متن دکمه اصلی (ویترین محصولات):</label>
                <input
                  type="text"
                  value={content.heroCtaProductsText}
                  onChange={(e) => handleContentChange('heroCtaProductsText', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-farm-bg focus:bg-white focus:outline-none focus:border-farm-primary"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1.5">متن دکمه ثانویه (باشگاه اشتراک پرو):</label>
                <input
                  type="text"
                  value={content.heroCtaProText}
                  onChange={(e) => handleContentChange('heroCtaProText', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-farm-bg focus:bg-white focus:outline-none focus:border-farm-primary"
                />
              </div>

              {/* Stats Counters in Hero */}
              <div className="md:col-span-2 p-4 rounded-2xl bg-farm-bg border border-farm-border space-y-3">
                <span className="font-bold text-gray-800">آمارهای کلیدی هیرو (شمارنده‌های جلب اعتماد):</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-1.5">
                    <label className="block text-gray-600 font-medium">آمار ۱ (عدد / برچسب):</label>
                    <input
                      type="text"
                      placeholder="۴۵۰+"
                      value={content.heroStat1Number}
                      onChange={(e) => handleContentChange('heroStat1Number', e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-black rounded-lg border border-gray-300"
                    />
                    <input
                      type="text"
                      placeholder="خانواده مشترک در شیراز"
                      value={content.heroStat1Label}
                      onChange={(e) => handleContentChange('heroStat1Label', e.target.value)}
                      className="w-full px-2.5 py-1 text-xs rounded-lg border border-gray-300 text-gray-600"
                    />
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-1.5">
                    <label className="block text-gray-600 font-medium">آمار ۲ (عدد / برچسب):</label>
                    <input
                      type="text"
                      placeholder="۱۰۰٪"
                      value={content.heroStat2Number}
                      onChange={(e) => handleContentChange('heroStat2Number', e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-black rounded-lg border border-gray-300"
                    />
                    <input
                      type="text"
                      placeholder="تضمین اصالت ارگانیک"
                      value={content.heroStat2Label}
                      onChange={(e) => handleContentChange('heroStat2Label', e.target.value)}
                      className="w-full px-2.5 py-1 text-xs rounded-lg border border-gray-300 text-gray-600"
                    />
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-1.5">
                    <label className="block text-gray-600 font-medium">آمار ۳ (عدد / برچسب):</label>
                    <input
                      type="text"
                      placeholder="۶ روز"
                      value={content.heroStat3Number}
                      onChange={(e) => handleContentChange('heroStat3Number', e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-black rounded-lg border border-gray-300"
                    />
                    <input
                      type="text"
                      placeholder="توزیع هفتگی با پیک پروفارم"
                      value={content.heroStat3Label}
                      onChange={(e) => handleContentChange('heroStat3Label', e.target.value)}
                      className="w-full px-2.5 py-1 text-xs rounded-lg border border-gray-300 text-gray-600"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SITE IMAGES & BANNERS */}
        {activeTab === 'images' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-farm-border shadow-farm space-y-8 animate-in fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#D4A373]/20 flex items-center justify-center text-[#D4A373]">
                  <ImageIcon className="w-5 h-5 text-farm-primary" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-farm-primary">
                    مدیریت تصاویر، بنرهای اصلی و رسانه‌های بصری سایت
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    تغییر عکس‌ها با آپلود مستقیم فایل از کامپیوتر یا قرار دادن آدرس اینترنتی (URL)
                  </p>
                </div>
              </div>
            </div>

            {/* Hidden file inputs for FileReader */}
            <input
              type="file"
              ref={heroFileRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => handleImageFileUpload('heroImageUrl', e)}
            />
            <input
              type="file"
              ref={bulkFileRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => handleImageFileUpload('bulkSectionImageUrl', e)}
            />
            <input
              type="file"
              ref={storyFileRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => handleImageFileUpload('storyImageUrl', e)}
            />

            {/* 1. Hero Main Banner Image */}
            <div className="p-5 rounded-2xl bg-farm-bg border border-farm-border space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-200">
                <div>
                  <h4 className="font-bold text-sm text-farm-primary flex items-center gap-2">
                    <Camera className="w-4 h-4 text-[#D4A373]" />
                    <span>۱. تصویر اصلی بنر هدر (صفحه نخست)</span>
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    این تصویر در ستون سمت چپ هدر بالای صفحه اصلی و کنار معرفی مزارع نمایش داده می‌شود.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => heroFileRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-farm-primary text-white text-xs font-bold hover:bg-farm-primary-dark transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <UploadCloud className="w-4 h-4 text-[#D4A373]" />
                    <span>آپلود عکس از کامپیوتر</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleContentChange(
                        'heroImageUrl',
                        '/images/hero-shiraz-farm.jpg'
                      )
                    }
                    className="p-2 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-200 text-xs font-medium cursor-pointer"
                    title="بازنشانی تصویر هیرو به پیش‌فرض"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                {/* Visual Preview */}
                <div className="md:col-span-5">
                  <div className="relative rounded-2xl overflow-hidden border-2 border-white shadow-md aspect-4/3 bg-gray-100">
                    <img
                      src={
                        content.heroImageUrl ||
                        '/images/hero-shiraz-farm.jpg'
                      }
                      alt="پیش‌نمایش تصویر هدر"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex flex-col justify-end p-4 text-white">
                      <span className="text-xs text-[#D4A373] font-bold">
                        {content.heroImageTag || 'تضمین ۱۰۰٪ ارگانیک و محلی'}
                      </span>
                      <p className="text-xs font-bold mt-0.5 leading-snug">
                        {content.heroImageCaption ||
                          'برداشت صبحگاهی و تحویل همان روز در شیراز با پیک پروفارم'}
                      </p>
                    </div>
                  </div>
                  <span className="block text-xs text-gray-600 mt-1 text-center">
                    پیش‌نمایش کارد تصویر همراه با برچسب و زیرنویس
                  </span>
                </div>

                {/* Form Fields & Presets */}
                <div className="md:col-span-7 space-y-3 text-xs">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1">
                      آدرس مستقیم تصویر اینترنتی (URL):
                    </label>
                    <div className="relative">
                      <LinkIcon className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input
                        type="text"
                        dir="ltr"
                        placeholder="https://..."
                        value={content.heroImageUrl || ''}
                        onChange={(e) => handleContentChange('heroImageUrl', e.target.value)}
                        className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-gray-300 bg-white focus:outline-none focus:border-farm-primary text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-gray-700 font-semibold mb-1">
                        برچسب زرد روی تصویر:
                      </label>
                      <input
                        type="text"
                        value={content.heroImageTag || ''}
                        onChange={(e) => handleContentChange('heroImageTag', e.target.value)}
                        placeholder="تضمین ۱۰۰٪ ارگانیک و محلی"
                        className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 font-semibold mb-1">
                        متن زیرنویس روی تصویر:
                      </label>
                      <input
                        type="text"
                        value={content.heroImageCaption || ''}
                        onChange={(e) => handleContentChange('heroImageCaption', e.target.value)}
                        placeholder="برداشت صبحگاهی و تحویل همان روز در شیراز"
                        className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="block text-gray-600 mb-1.5 font-medium">
                      انتخاب سریع از تصاویر پیشنهادی و آماده:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {heroPresets.map((p) => (
                        <button
                          key={p.url}
                          type="button"
                          onClick={() => handleContentChange('heroImageUrl', p.url)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                            content.heroImageUrl === p.url
                              ? 'bg-farm-primary text-white border-farm-primary'
                              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Bulk Order Section Image */}
            <div className="p-5 rounded-2xl bg-farm-bg border border-farm-border space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-200">
                <div>
                  <h4 className="font-bold text-sm text-farm-primary flex items-center gap-2">
                    <Camera className="w-4 h-4 text-[#D4A373]" />
                    <span>۲. تصویر بنر بخش استعلام و خرید عمده (خارج از شیراز)</span>
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    تصویر پس‌زمینه یا کارد معرفی تامین سازمانی و کانتینری در صفحه اصلی و صفحه خرید عمده
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => bulkFileRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-farm-primary text-white text-xs font-bold hover:bg-farm-primary-dark transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <UploadCloud className="w-4 h-4 text-[#D4A373]" />
                    <span>آپلود عکس از کامپیوتر</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleContentChange(
                        'bulkSectionImageUrl',
                        '/images/bulk-logistics.jpg'
                      )
                    }
                    className="p-2 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-200 text-xs font-medium cursor-pointer"
                    title="بازنشانی تصویر عمده به پیش‌فرض"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                <div className="md:col-span-5">
                  <div className="relative rounded-2xl overflow-hidden border-2 border-white shadow-md aspect-16/9 bg-gray-100">
                    <img
                      src={
                        content.bulkSectionImageUrl ||
                        '/images/bulk-logistics.jpg'
                      }
                      alt="پیش‌نمایش بخش عمده"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                <div className="md:col-span-7 space-y-3 text-xs">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1">
                      آدرس مستقیم تصویر (URL):
                    </label>
                    <div className="relative">
                      <LinkIcon className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input
                        type="text"
                        dir="ltr"
                        placeholder="https://..."
                        value={content.bulkSectionImageUrl || ''}
                        onChange={(e) => handleContentChange('bulkSectionImageUrl', e.target.value)}
                        className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-gray-300 bg-white focus:outline-none focus:border-farm-primary text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="block text-gray-600 mb-1.5 font-medium">
                      تصاویر پیشنهادی خرید عمده:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {bulkPresets.map((p) => (
                        <button
                          key={p.url}
                          type="button"
                          onClick={() => handleContentChange('bulkSectionImageUrl', p.url)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                            content.bulkSectionImageUrl === p.url
                              ? 'bg-farm-primary text-white border-farm-primary'
                              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Farm Story & Heritage Image */}
            <div className="p-5 rounded-2xl bg-farm-bg border border-farm-border space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-200">
                <div>
                  <h4 className="font-bold text-sm text-farm-primary flex items-center gap-2">
                    <Camera className="w-4 h-4 text-[#D4A373]" />
                    <span>۳. تصویر بخش داستان و اصالت مزارع فارس</span>
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    تصویر معرف کشاورزان بومی، کوهپایه‌های زاگرس و مزارع کامفیروز و دشت ارژن
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => storyFileRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-farm-primary text-white text-xs font-bold hover:bg-farm-primary-dark transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <UploadCloud className="w-4 h-4 text-[#D4A373]" />
                    <span>آپلود عکس از کامپیوتر</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleContentChange(
                        'storyImageUrl',
                        '/images/story-fars-farms.jpg'
                      )
                    }
                    className="p-2 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-200 text-xs font-medium cursor-pointer"
                    title="بازنشانی تصویر داستان مزرعه به پیش‌فرض"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                <div className="md:col-span-5">
                  <div className="relative rounded-2xl overflow-hidden border-2 border-white shadow-md aspect-16/9 bg-gray-100">
                    <img
                      src={
                        content.storyImageUrl ||
                        '/images/story-fars-farms.jpg'
                      }
                      alt="پیش‌نمایش داستان مزرعه"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                <div className="md:col-span-7 space-y-3 text-xs">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1">
                      آدرس مستقیم تصویر (URL):
                    </label>
                    <div className="relative">
                      <LinkIcon className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input
                        type="text"
                        dir="ltr"
                        placeholder="https://..."
                        value={content.storyImageUrl || ''}
                        onChange={(e) => handleContentChange('storyImageUrl', e.target.value)}
                        className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-gray-300 bg-white focus:outline-none focus:border-farm-primary text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="block text-gray-600 mb-1.5 font-medium">
                      تصاویر پیشنهادی داستان مزارع فارس:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {storyPresets.map((p) => (
                        <button
                          key={p.url}
                          type="button"
                          onClick={() => handleContentChange('storyImageUrl', p.url)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                            content.storyImageUrl === p.url
                              ? 'bg-farm-primary text-white border-farm-primary'
                              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: TRUST HIGHLIGHTS & STORY */}
        {activeTab === 'trust' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-farm-border shadow-farm space-y-6 animate-in fade-in">
            <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100">
              <ShieldCheck className="w-5 h-5 text-farm-primary" />
              <h3 className="text-base font-bold text-farm-primary">
                ویرایش نشان‌های اعتماد مشتری و داستان مزارع فارس
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
              {/* Trust Item 1 */}
              <div className="p-4 rounded-2xl bg-farm-bg border border-gray-200 space-y-2">
                <span className="font-bold text-gray-800">نشان اعتماد ۱:</span>
                <input
                  type="text"
                  placeholder="عنوان نشان"
                  value={content.trustItem1Title || content.trustItem1}
                  onChange={(e) => {
                    handleContentChange('trustItem1Title', e.target.value);
                    handleContentChange('trustItem1', e.target.value);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white font-bold"
                />
                <textarea
                  rows={2}
                  placeholder="توضیحات کوتاه نشان"
                  value={content.trustItem1Desc || ''}
                  onChange={(e) => handleContentChange('trustItem1Desc', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white"
                />
              </div>

              {/* Trust Item 2 */}
              <div className="p-4 rounded-2xl bg-farm-bg border border-gray-200 space-y-2">
                <span className="font-bold text-gray-800">نشان اعتماد ۲:</span>
                <input
                  type="text"
                  placeholder="عنوان نشان"
                  value={content.trustItem2Title || content.trustItem2}
                  onChange={(e) => {
                    handleContentChange('trustItem2Title', e.target.value);
                    handleContentChange('trustItem2', e.target.value);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white font-bold"
                />
                <textarea
                  rows={2}
                  placeholder="توضیحات کوتاه نشان"
                  value={content.trustItem2Desc || ''}
                  onChange={(e) => handleContentChange('trustItem2Desc', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white"
                />
              </div>

              {/* Trust Item 3 */}
              <div className="p-4 rounded-2xl bg-farm-bg border border-gray-200 space-y-2">
                <span className="font-bold text-gray-800">نشان اعتماد ۳:</span>
                <input
                  type="text"
                  placeholder="عنوان نشان"
                  value={content.trustItem3Title || content.trustItem3}
                  onChange={(e) => {
                    handleContentChange('trustItem3Title', e.target.value);
                    handleContentChange('trustItem3', e.target.value);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white font-bold"
                />
                <textarea
                  rows={2}
                  placeholder="توضیحات کوتاه نشان"
                  value={content.trustItem3Desc || ''}
                  onChange={(e) => handleContentChange('trustItem3Desc', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white"
                />
              </div>

              {/* Trust Item 4 */}
              <div className="p-4 rounded-2xl bg-farm-bg border border-gray-200 space-y-2">
                <span className="font-bold text-gray-800">نشان اعتماد ۴:</span>
                <input
                  type="text"
                  placeholder="عنوان نشان"
                  value={content.trustItem4Title || ''}
                  onChange={(e) => handleContentChange('trustItem4Title', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white font-bold"
                />
                <textarea
                  rows={2}
                  placeholder="توضیحات کوتاه نشان"
                  value={content.trustItem4Desc || ''}
                  onChange={(e) => handleContentChange('trustItem4Desc', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white"
                />
              </div>

              {/* Farm Story */}
              <div className="md:col-span-2 p-4 rounded-2xl bg-amber-50/50 border border-amber-200 space-y-3">
                <span className="font-bold text-amber-950">بخش داستان و اصالت مزارع بومی:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-700 font-medium mb-1">تیتر بخش داستان:</label>
                    <input
                      type="text"
                      value={content.storyTitle}
                      onChange={(e) => handleContentChange('storyTitle', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-1">مناطق و مزارع تحت پوشش:</label>
                    <input
                      type="text"
                      value={content.storyLocation}
                      onChange={(e) => handleContentChange('storyLocation', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-gray-700 font-medium mb-1">متن تفصیلی داستان مزارع:</label>
                    <textarea
                      rows={3}
                      value={content.storyDescription}
                      onChange={(e) => handleContentChange('storyDescription', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white leading-relaxed"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SECTIONS & FOOTER */}
        {activeTab === 'sections' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-farm-border shadow-farm space-y-6 animate-in fade-in">
            <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100">
              <Store className="w-5 h-5 text-farm-primary" />
              <h3 className="text-base font-bold text-farm-primary">
                تنظیمات ویترین کالاها، خرید عمده و اطلاعات تماس فوتر
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
              {/* Products Section */}
              <div className="p-4 rounded-2xl bg-farm-bg border border-gray-200 space-y-3">
                <span className="font-bold text-gray-800">بخش ویترین محصولات صفحه اصلی:</span>
                <div>
                  <label className="block text-gray-600 mb-1">بج کوچک ویترین:</label>
                  <input
                    type="text"
                    value={content.productsBadgeText}
                    onChange={(e) => handleContentChange('productsBadgeText', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">تیتر ویترین محصولات:</label>
                  <input
                    type="text"
                    value={content.productsSectionTitle}
                    onChange={(e) => handleContentChange('productsSectionTitle', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">زیرتیتر توضیحات ویترین:</label>
                  <input
                    type="text"
                    value={content.productsSectionSubtitle}
                    onChange={(e) => handleContentChange('productsSectionSubtitle', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white"
                  />
                </div>
              </div>

              {/* Wholesale Section */}
              <div className="p-4 rounded-2xl bg-farm-bg border border-gray-200 space-y-3">
                <span className="font-bold text-gray-800">بخش خرید عمده سراسر کشور:</span>
                <div>
                  <label className="block text-gray-600 mb-1">بج خرید عمده:</label>
                  <input
                    type="text"
                    value={content.bulkBadgeText}
                    onChange={(e) => handleContentChange('bulkBadgeText', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">تیتر بخش عمده:</label>
                  <input
                    type="text"
                    value={content.bulkSectionTitle}
                    onChange={(e) => handleContentChange('bulkSectionTitle', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">متن دکمه استعلام عمده:</label>
                  <input
                    type="text"
                    value={content.bulkCtaText}
                    onChange={(e) => handleContentChange('bulkCtaText', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white"
                  />
                </div>
              </div>

              {/* Footer & Contact */}
              <div className="md:col-span-2 p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-3">
                <span className="font-bold text-gray-800">اطلاعات تماس و پاورقی (Footer):</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-gray-600 mb-1 font-medium">شماره تلفن تماس و پشتیبانی:</label>
                    <input
                      type="text"
                      value={content.supportPhone}
                      onChange={(e) => handleContentChange('supportPhone', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white font-mono text-left"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1 font-medium">ساعات پاسخگویی:</label>
                    <input
                      type="text"
                      value={content.supportHours}
                      onChange={(e) => handleContentChange('supportHours', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1 font-medium">نشانی دفتر مرکزی شیراز:</label>
                    <input
                      type="text"
                      value={content.supportAddress}
                      onChange={(e) => handleContentChange('supportAddress', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-gray-600 mb-1 font-medium">متن خلاصه معرفی مزارع در فوتر:</label>
                    <textarea
                      rows={2}
                      value={content.footerAboutText}
                      onChange={(e) => handleContentChange('footerAboutText', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white leading-relaxed"
                    />
                  </div>
                </div>
              </div>

              {/* Social Media & Channels */}
              <div className="md:col-span-2 p-4 rounded-2xl bg-gradient-to-r from-emerald-50/60 to-farm-bg border border-emerald-200/80 space-y-3">
                <div className="flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-farm-primary" />
                  <span className="font-bold text-farm-primary">کانال‌ها و شبکه‌های اجتماعی مزارع شیراز:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-gray-600 mb-1 font-medium">اینستاگرام (Instagram):</label>
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="https://instagram.com/..."
                      value={content.socialInstagram || ''}
                      onChange={(e) => handleContentChange('socialInstagram', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1 font-medium">تلگرام (Telegram):</label>
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="https://t.me/..."
                      value={content.socialTelegram || ''}
                      onChange={(e) => handleContentChange('socialTelegram', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1 font-medium">ایتا (Eitaa):</label>
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="https://eitaa.com/..."
                      value={content.socialEitaa || ''}
                      onChange={(e) => handleContentChange('socialEitaa', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1 font-medium">واتساپ (WhatsApp):</label>
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="https://wa.me/..."
                      value={content.socialWhatsapp || ''}
                      onChange={(e) => handleContentChange('socialWhatsapp', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Submit & Reset Bar */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleReset}
            className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 text-xs font-bold transition-colors shadow-xs"
          >
            بازنشانی به پیش‌فرض کارخانه
          </button>
          <button
            type="submit"
            className="px-7 py-3 rounded-xl bg-farm-primary text-white hover:bg-farm-primary-dark text-xs font-bold transition-colors flex items-center gap-2 shadow-md cursor-pointer"
          >
            <Save className="w-4 h-4 text-[#D4A373]" />
            <span>ذخیره کلیه تغییرات و انتشار زنده</span>
          </button>
        </div>
      </form>

      {/* LIVE INTERACTIVE PREVIEW ACCORDION */}
      <div className="bg-white rounded-3xl p-6 border border-farm-border shadow-farm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2 text-xs font-bold text-farm-primary">
            <Eye className="w-4 h-4 text-[#D4A373]" />
            <span>پیش‌نمایش زنده همزمان (همگام با مقادیر و تخفیف‌های بالا)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewTab('hero')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                previewTab === 'hero'
                  ? 'bg-farm-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              نمای هیرو
            </button>
            <button
              type="button"
              onClick={() => setPreviewTab('trust')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                previewTab === 'trust'
                  ? 'bg-farm-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              نشان‌های اعتماد
            </button>
          </div>
        </div>

        {/* 1. Preview Hero */}
        {previewTab === 'hero' && (
          <div className="p-6 rounded-2xl bg-gradient-to-b from-farm-bg-warm via-farm-bg to-white border border-farm-border space-y-5 text-right">
            {content.topBannerActive && (
              <div className="p-2 bg-farm-primary text-white rounded-xl text-center text-xs flex items-center justify-center gap-2">
                <Truck className="w-3.5 h-3.5 text-[#D4A373]" />
                <span>{content.topBannerText}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              <div className="md:col-span-7 space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-farm-border text-xs font-bold text-farm-primary">
                  <span className="w-2 h-2 rounded-full bg-farm-primary animate-ping" />
                  <span>{content.heroBadgeText}</span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-black text-farm-primary leading-tight">
                  {content.heroTitlePart1}{' '}
                  <span className="text-[#D4A373]">{content.heroTitleHighlight}</span>
                </h2>

                <p className="text-xs text-gray-600 leading-relaxed font-medium">
                  {content.heroSubtitle}
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="px-4 py-2 rounded-xl bg-farm-primary text-white text-xs font-bold shadow-xs">
                    {content.heroCtaProductsText}
                  </span>
                  <span className="px-4 py-2 rounded-xl bg-white border border-farm-border text-farm-primary text-xs font-bold">
                    {content.heroCtaProText}
                  </span>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-200/60 max-w-md">
                  <div className="text-center">
                    <div className="text-sm font-black text-farm-primary">{content.heroStat1Number}</div>
                    <div className="text-xs text-gray-500">{content.heroStat1Label}</div>
                  </div>
                  <div className="text-center border-x border-gray-200">
                    <div className="text-sm font-black text-farm-primary">{content.heroStat2Number}</div>
                    <div className="text-xs text-gray-500">{content.heroStat2Label}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-black text-farm-primary">{content.heroStat3Number}</div>
                    <div className="text-xs text-gray-500">{content.heroStat3Label}</div>
                  </div>
                </div>
              </div>

              {/* Visual Card Preview */}
              <div className="md:col-span-5">
                <div className="relative rounded-2xl overflow-hidden border-2 border-white shadow-md aspect-4/3 bg-white">
                  <img
                    src={
                      content.heroImageUrl ||
                      '/images/hero-shiraz-farm.jpg'
                    }
                    alt="پیش‌نمایش تصویر هدر"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent flex flex-col justify-end p-4 text-white">
                    <span className="text-xs text-[#D4A373] font-bold">
                      {content.heroImageTag || 'تضمین ۱۰۰٪ ارگانیک و محلی'}
                    </span>
                    <p className="text-xs font-bold mt-0.5 leading-snug">
                      {content.heroImageCaption ||
                        'برداشت صبحگاهی و تحویل همان روز در شیراز با پیک پروفارم'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. Preview Trust */}
        {previewTab === 'trust' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-right">
            <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-1">
              <div className="font-bold text-xs text-farm-primary">{content.trustItem1Title || content.trustItem1}</div>
              <div className="text-xs text-gray-500 leading-relaxed">{content.trustItem1Desc}</div>
            </div>
            <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-1">
              <div className="font-bold text-xs text-farm-primary">{content.trustItem2Title || content.trustItem2}</div>
              <div className="text-xs text-gray-500 leading-relaxed">{content.trustItem2Desc}</div>
            </div>
            <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-1">
              <div className="font-bold text-xs text-farm-primary">{content.trustItem3Title || content.trustItem3}</div>
              <div className="text-xs text-gray-500 leading-relaxed">{content.trustItem3Desc}</div>
            </div>
            <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-1">
              <div className="font-bold text-xs text-farm-primary">{content.trustItem4Title}</div>
              <div className="text-xs text-gray-500 leading-relaxed">{content.trustItem4Desc}</div>
            </div>
          </div>
        )}
      </div>
        </div>
      )}
    </div>
  );
}
