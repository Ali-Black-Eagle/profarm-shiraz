'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
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
  Edit2,
  Edit3,
  Camera,
  UploadCloud,
  X,
  Eye,
  Save,
  RotateCcw,
  Monitor,
  Smartphone,
  ExternalLink,
  Phone,
  Clock,
  Instagram,
  Send,
  MessageCircle,
  HelpCircle,
  Sliders,
  Globe,
  Info,
} from 'lucide-react';
import { SiteContent } from '@/types';
import { formatToman, toPersianDigits } from '@/lib/formatters';
import InlineEditableText from './InlineEditableText';
import { useToast } from '@/components/ui/ToastProvider';

interface CmsLiveEditorProps {
  content: SiteContent;
  onChange: (newContent: SiteContent) => void;
  onSave: () => Promise<void> | void;
  onReset: () => void;
  isSaving?: boolean;
}

export default function CmsLiveEditor({
  content,
  onChange,
  onSave,
  onReset,
  isSaving = false,
}: CmsLiveEditorProps) {
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(true);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [activeSection, setActiveSection] = useState<string>('all');
  const [isDirty, setIsDirty] = useState(false);

  // Image modal state
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [activeImageField, setActiveImageField] = useState<
    'heroImageUrl' | 'storyImageUrl' | 'bulkSectionImageUrl' | null
  >(null);
  const [tempImageUrl, setTempImageUrl] = useState('');
  const [imageTab, setImageTab] = useState<'presets' | 'upload' | 'url'>('presets');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Preset images
  const presetImages = [
    {
      title: 'مزارع سرسبز ارگانیک شیراز (پیش‌فرض)',
      url: '/images/hero-shiraz-farm.jpg',
      category: 'هدر و مزارع',
    },
    {
      title: 'کشاورزان بومی و باغات فارس',
      url: '/images/story-fars-farms.jpg',
      category: 'داستان و اصالت',
    },
    {
      title: 'لجستیک و بارگیری مزارع فارس',
      url: '/images/bulk-logistics.jpg',
      category: 'لجستیک و عمده',
    },
    {
      title: 'سبد تره‌بار و سبزیجات روزانه',
      url: '/images/prod-veggie-box.jpg',
      category: 'محصولات',
    },
    {
      title: 'سبزی خوردن محلی قصرالدشت',
      url: '/images/prod-greens.jpg',
      category: 'محصولات',
    },
    {
      title: 'عسل طبیعی کوهستان دشت ارژن',
      url: '/images/prod-honey.jpg',
      category: 'محصولات',
    },
    {
      title: 'روغن زیتون فرابکر سروستان',
      url: '/images/prod-olive-oil.jpg',
      category: 'محصولات',
    },
    {
      title: 'تخم‌مرغ محلی ارگانیک کامفیروز',
      url: '/images/prod-eggs.jpg',
      category: 'محصولات',
    },
    {
      title: 'زعفران سرگل استهبان فارس',
      url: '/images/prod-saffron.jpg',
      category: 'محصولات',
    },
    {
      title: 'پنیر کوزه‌ای سنتی عشایری',
      url: '/images/prod-cheese.jpg',
      category: 'محصولات',
    },
    {
      title: 'گردوی کاغذی باغات سپیدان',
      url: '/images/prod-walnut.jpg',
      category: 'محصولات',
    },
    {
      title: 'دوشاب و شیره انگور ناب بوانات',
      url: '/images/prod-grape-syrup.jpg',
      category: 'محصولات',
    },
    {
      title: 'پکیج عرقیات دوآتشه میمند',
      url: '/images/prod-distillates.jpg',
      category: 'محصولات',
    },
  ];

  const updateField = <K extends keyof SiteContent>(key: K, value: SiteContent[K]) => {
    setIsDirty(true);
    onChange({
      ...content,
      [key]: value,
    });
  };

  const handleOpenImageModal = (
    field: 'heroImageUrl' | 'storyImageUrl' | 'bulkSectionImageUrl'
  ) => {
    setActiveImageField(field);
    setTempImageUrl(content[field] || '');
    setImageModalOpen(true);
  };

  const handleApplyImage = () => {
    if (activeImageField && tempImageUrl) {
      updateField(activeImageField, tempImageUrl);
    }
    setImageModalOpen(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        setTempImageUrl(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    if (id === 'all') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const elem = document.getElementById(id);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="space-y-6 pb-28 select-none-headers">
      {/* 1. TOP STICKY CONTROL BAR */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-farm-border shadow-xs -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3.5 transition-all">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Title & Status */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-farm-primary to-farm-primary-dark text-white flex items-center justify-center shadow-xs shrink-0">
              <Sparkles className="w-5 h-5 text-[#D4A373]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black text-farm-primary">
                  ویرایشگر زنده محتوای مزارع پروفارم
                </h1>
                {isDirty && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold animate-pulse">
                    تغییرات ذخیره‌نشده
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 hidden sm:block">
                مستقیماً روی هر متن یا تصویر کلیک کنید تا در لحظه ویرایش و اعمال شود
              </p>
            </div>
          </div>

          {/* Controls: Mode + Device + Actions */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 self-end md:self-auto">
            {/* Device Switcher */}
            <div className="flex items-center bg-farm-bg-warm p-1 rounded-xl border border-farm-border">
              <button
                type="button"
                onClick={() => setPreviewDevice('desktop')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  previewDevice === 'desktop'
                    ? 'bg-white text-farm-primary shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="نمایشگر دسکتاپ عریض"
              >
                <Monitor className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">دسکتاپ</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice('mobile')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  previewDevice === 'mobile'
                    ? 'bg-white text-farm-primary shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="نمایشگر موبایل شیراز"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">موبایل</span>
              </button>
            </div>

            {/* Edit Mode / Preview Mode Switcher */}
            <div className="flex items-center bg-farm-bg-warm p-1 rounded-xl border border-farm-border">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isEditing
                    ? 'bg-farm-primary text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="حالت ویرایش زنده با راهنمای بصری"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>حالت ویرایش</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  !isEditing
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="پیش‌نمایش تمیز نهایی بدون کادرهای ویرایش"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>پیش‌نمایش تمیز</span>
              </button>
            </div>

            {/* View live site */}
            <Link
              href="/"
              target="_blank"
              className="p-2 sm:px-3 sm:py-2 rounded-xl border border-farm-border bg-white text-gray-700 hover:bg-gray-50 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="مشاهده صفحه اصلی زنده سایت در تب جدید"
            >
              <ExternalLink className="w-4 h-4 text-emerald-700" />
              <span className="hidden lg:inline">مشاهده سایت</span>
            </Link>

            {/* Reset Defaults */}
            <button
              type="button"
              onClick={onReset}
              className="p-2 sm:px-3 sm:py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="بازنشانی تمامی متون و عکس‌ها به پیش‌فرض کارخانه"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden lg:inline">بازنشانی</span>
            </button>

            {/* Save & Publish Live */}
            <button
              type="button"
              onClick={async () => {
                await onSave();
                setIsDirty(false);
              }}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-farm-primary via-emerald-800 to-farm-primary-dark hover:brightness-110 text-white text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4 text-[#D4A373]" />
              )}
              <span>ذخیره و انتشار زنده</span>
            </button>
          </div>
        </div>

        {/* Section Fast Jumper */}
        <div className="max-w-7xl mx-auto mt-2.5 pt-2 border-t border-gray-100 flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5 text-xs">
          <span className="text-gray-600 font-bold ml-1 shrink-0">پرش به بخش:</span>
          {[
            { id: 'all', label: 'همه بخش‌ها' },
            { id: 'sec-topbanner', label: 'نوار اعلان بالا' },
            { id: 'sec-hero', label: 'هدر اصلی و آمار' },
            { id: 'sec-trust', label: 'ستون‌های ارزش و اعتماد' },
            { id: 'sec-products', label: 'ویترین محصولات' },
            { id: 'sec-pro', label: 'باشگاه مشترکین طلایی' },
            { id: 'sec-story', label: 'اصالت و داستان مزرعه' },
            { id: 'sec-bulk', label: 'سفارش عمده لجستیک' },
            { id: 'sec-footer', label: 'فوتر و تماس' },
          ].map((sec) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => scrollToSection(sec.id)}
              className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                activeSection === sec.id
                  ? 'bg-farm-primary text-white shadow-2xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {sec.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. MAIN LIVE VISUAL CANVAS */}
      <div
        className={`transition-all duration-300 mx-auto ${
          previewDevice === 'mobile'
            ? 'max-w-[420px] bg-slate-900 p-3 rounded-[48px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] border-4 border-slate-800'
            : 'max-w-7xl w-full'
        }`}
      >
        {previewDevice === 'mobile' && (
          <div className="w-32 h-5 bg-slate-950 rounded-full mx-auto mb-2 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-slate-900 mr-2" />
            <div className="w-10 h-1 rounded-full bg-slate-800" />
          </div>
        )}

        {/* Inner Canvas */}
        <div
          className={`bg-farm-bg overflow-hidden ${
            previewDevice === 'mobile'
              ? 'rounded-[36px] border border-farm-border max-h-[85vh] overflow-y-auto'
              : 'rounded-3xl border border-farm-border shadow-sm'
          }`}
        >
          {/* SECTION 1: TOP ANNOUNCEMENT BAR */}
          <div id="sec-topbanner" className="relative group/sec">
            {isEditing && (
              <div className="absolute top-2 left-2 z-20 flex items-center gap-2 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-xl border border-gray-200 shadow-md text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={content.topBannerActive}
                    onChange={(e) => updateField('topBannerActive', e.target.checked)}
                    className="w-3.5 h-3.5 accent-farm-primary rounded cursor-pointer"
                  />
                  <span className="font-bold text-xs text-gray-700">
                    {content.topBannerActive ? 'نوار اعلان فعال است' : 'نوار اعلان خاموش است'}
                  </span>
                </label>
              </div>
            )}

            {content.topBannerActive ? (
              <div className="bg-farm-primary-dark text-farm-bg-warm px-4 py-2.5 text-xs text-center border-b border-farm-primary/50">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <InlineEditableText
                    value={content.topBannerText}
                    onChange={(val) => updateField('topBannerText', val)}
                    isEditing={isEditing}
                    label="متن اعلان بالای سایت"
                    placeholder="متن نوار اعلان را وارد کنید..."
                    className="font-medium"
                  />
                  <span className="text-[#D4A373] hidden sm:inline">|</span>
                  <span className="text-[#D4A373] underline underline-offset-4 decoration-amber-400/60 font-bold">
                    <InlineEditableText
                      value={content.topBannerLinkText}
                      onChange={(val) => updateField('topBannerLinkText', val)}
                      isEditing={isEditing}
                      label="متن لینک اعلان"
                      placeholder="متن لینک..."
                    />
                  </span>
                </div>
              </div>
            ) : (
              isEditing && (
                <div className="p-3 bg-gray-100 text-gray-600 text-xs text-center border-b border-dashed border-gray-300">
                  نوار اعلان بالای سایت در حال حاضر غیرفعال است (برای فعال‌سازی تیک بالا را بزنید)
                </div>
              )
            )}
          </div>

          {/* SECTION 2: HERO & STATS SECTION */}
          <section
            id="sec-hero"
            className="relative overflow-hidden pt-8 pb-14 md:pt-12 md:pb-20 bg-gradient-to-b from-farm-bg-warm via-farm-bg to-farm-bg border-b border-farm-border"
          >
            {/* Decorative background glows */}
            <div className="absolute top-0 right-10 w-80 h-80 bg-farm-primary/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-10 w-80 h-80 bg-[#D4A373]/10 rounded-full blur-2xl pointer-events-none" />

            <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                {/* Left/Main Content */}
                <div className="w-full lg:col-span-7 space-y-5 text-center lg:text-right flex flex-col items-center lg:items-start">
                  {/* Badge */}
                  <div className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-farm-border shadow-2xs text-xs font-semibold text-farm-primary">
                    <span className="w-2 h-2 rounded-full bg-farm-primary animate-ping" />
                    <InlineEditableText
                      value={content.heroBadgeText}
                      onChange={(val) => updateField('heroBadgeText', val)}
                      isEditing={isEditing}
                      label="بج هدر اصلی"
                    />
                  </div>

                  {/* Main Title (Part 1 + Highlight) */}
                  <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-farm-primary leading-tight text-center lg:text-right w-full">
                    <InlineEditableText
                      value={content.heroTitlePart1}
                      onChange={(val) => updateField('heroTitlePart1', val)}
                      isEditing={isEditing}
                      label="عنوان اصلی (بخش اول)"
                      className="block"
                    />
                    <span className="text-[#D4A373] block mt-1">
                      <InlineEditableText
                        value={content.heroTitleHighlight}
                        onChange={(val) => updateField('heroTitleHighlight', val)}
                        isEditing={isEditing}
                        label="عنوان برجسته (طلایی)"
                      />
                    </span>
                  </h1>

                  {/* Subtitle */}
                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed max-w-xl font-normal mx-auto lg:mx-0 text-center lg:text-right w-full">
                    <InlineEditableText
                      value={content.heroSubtitle}
                      onChange={(val) => updateField('heroSubtitle', val)}
                      isEditing={isEditing}
                      isTextarea={true}
                      label="توضیحات زیرعنوان هدر"
                    />
                  </p>

                  {/* CTAs */}
                  <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-2 w-full">
                    <div className="px-6 py-3 rounded-2xl bg-gradient-to-r from-farm-primary via-[#385e3b] to-farm-primary-dark text-white text-xs font-black shadow-md flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                      </span>
                      <InlineEditableText
                        value={content.heroCtaProductsText}
                        onChange={(val) => updateField('heroCtaProductsText', val)}
                        isEditing={isEditing}
                        label="متن دکمه اول"
                      />
                      <ArrowLeft className="w-3.5 h-3.5 text-[#D4A373]" />
                    </div>

                    <div className="px-6 py-3 rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#B8860B] text-slate-950 text-xs font-black shadow-md flex items-center gap-2">
                      <Crown className="w-3.5 h-3.5 text-amber-950" />
                      <InlineEditableText
                        value={content.heroCtaProText}
                        onChange={(val) => updateField('heroCtaProText', val)}
                        isEditing={isEditing}
                        label="متن دکمه دوم (اشتراک)"
                      />
                      <Sparkles className="w-3.5 h-3.5 text-amber-900" />
                    </div>
                  </div>

                  {/* Shiraz Trust Highlights (3 Items under Hero) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-5 border-t border-farm-border/60 text-xs w-full">
                    <div className="flex items-center justify-center lg:justify-start gap-2">
                      <Truck className="w-4 h-4 text-farm-primary shrink-0" />
                      <InlineEditableText
                        value={content.trustItem1}
                        onChange={(val) => updateField('trustItem1', val)}
                        isEditing={isEditing}
                        label="نشان ۱"
                        className="text-gray-700 font-medium"
                      />
                    </div>
                    <div className="flex items-center justify-center lg:justify-start gap-2">
                      <ShieldCheck className="w-4 h-4 text-farm-primary shrink-0" />
                      <InlineEditableText
                        value={content.trustItem2}
                        onChange={(val) => updateField('trustItem2', val)}
                        isEditing={isEditing}
                        label="نشان ۲"
                        className="text-gray-700 font-medium"
                      />
                    </div>
                    <div className="flex items-center justify-center lg:justify-start gap-2">
                      <Sparkles className="w-4 h-4 text-farm-primary shrink-0" />
                      <InlineEditableText
                        value={content.trustItem3}
                        onChange={(val) => updateField('trustItem3', val)}
                        isEditing={isEditing}
                        label="نشان ۳"
                        className="text-gray-700 font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Right/Hero Visual Image Card */}
                <div className="lg:col-span-5 relative w-full max-w-md mx-auto lg:max-w-none">
                  <div className="relative rounded-3xl overflow-hidden border-2 border-white shadow-2xl bg-white aspect-4/3 sm:aspect-square group/heroimg">
                    <Image
                      src={content.heroImageUrl || '/images/hero-shiraz-farm.jpg'}
                      alt="مزارع سرسبز ارگانیک فارس و شیراز"
                      fill
                      sizes="(max-width: 1024px) 100vw, 40vw"
                      className="object-cover transition-transform duration-500 group-hover/heroimg:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-5 text-white z-10">
                      <span className="text-xs text-[#D4A373] font-semibold">
                        <InlineEditableText
                          value={content.heroImageTag || 'تضمین ۱۰۰٪ ارگانیک و محلی'}
                          onChange={(val) => updateField('heroImageTag', val)}
                          isEditing={isEditing}
                          label="برچسب روی عکس"
                        />
                      </span>
                      <p className="text-sm font-bold mt-1 leading-snug">
                        <InlineEditableText
                          value={
                            content.heroImageCaption ||
                            'برداشت صبحگاهی و تحویل همان روز در شیراز با پیک پروفارم'
                          }
                          onChange={(val) => updateField('heroImageCaption', val)}
                          isEditing={isEditing}
                          label="کپشن روی عکس"
                        />
                      </p>
                    </div>

                    {/* Change Image Button Overlay */}
                    {isEditing && (
                      <div className="absolute top-3 left-3 z-20">
                        <button
                          type="button"
                          onClick={() => handleOpenImageModal('heroImageUrl')}
                          className="px-3 py-1.5 rounded-xl bg-white/95 text-farm-primary hover:bg-white text-xs font-black shadow-lg flex items-center gap-1.5 transition-all cursor-pointer backdrop-blur-xs hover:scale-105"
                        >
                          <Camera className="w-3.5 h-3.5 text-emerald-700" />
                          <span>تغییر تصویر هدر</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3: TRUST & VALUE PROPOSITION PILLARS */}
          <section id="sec-trust" className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-6">
            <div className="text-center max-w-xl mx-auto space-y-1">
              <span className="text-xs font-bold text-[#D4A373]">
                استانداردهای طلایی سلامت و زنجیره تامین
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-farm-primary">
                چهار رکن اعتماد خانواده‌های شیراز به پروفارم
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1 */}
              <div className="bg-white p-5 rounded-2xl border border-farm-border shadow-2xs space-y-2 relative group/card hover:border-emerald-300 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
                  <Truck className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-black text-farm-primary">
                  <InlineEditableText
                    value={content.trustItem1Title || 'تحویل اختصاصی سراسر شیراز'}
                    onChange={(val) => updateField('trustItem1Title', val)}
                    isEditing={isEditing}
                    label="عنوان ستون ۱"
                  />
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  <InlineEditableText
                    value={
                      content.trustItem1Desc || 'پوشش کلیه مناطق شهرداری شیراز با پیک پروفارم'
                    }
                    onChange={(val) => updateField('trustItem1Desc', val)}
                    isEditing={isEditing}
                    isTextarea={true}
                    label="توضیح ستون ۱"
                  />
                </p>
              </div>

              {/* Card 2 */}
              <div className="bg-white p-5 rounded-2xl border border-farm-border shadow-2xs space-y-2 relative group/card hover:border-emerald-300 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-black text-farm-primary">
                  <InlineEditableText
                    value={content.trustItem2Title || 'بسته‌بندی شناسنامه‌دار'}
                    onChange={(val) => updateField('trustItem2Title', val)}
                    isEditing={isEditing}
                    label="عنوان ستون ۲"
                  />
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  <InlineEditableText
                    value={
                      content.trustItem2Desc ||
                      'پلمپ بهداشتی با برچسب تاریخ دوشش شیر و چیدن سبزی'
                    }
                    onChange={(val) => updateField('trustItem2Desc', val)}
                    isEditing={isEditing}
                    isTextarea={true}
                    label="توضیح ستون ۲"
                  />
                </p>
              </div>

              {/* Card 3 */}
              <div className="bg-white p-5 rounded-2xl border border-farm-border shadow-2xs space-y-2 relative group/card hover:border-emerald-300 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-black text-farm-primary">
                  <InlineEditableText
                    value={content.trustItem3Title || 'آزمایشگاه کنترل کیفیت'}
                    onChange={(val) => updateField('trustItem3Title', val)}
                    isEditing={isEditing}
                    label="عنوان ستون ۳"
                  />
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  <InlineEditableText
                    value={
                      content.trustItem3Desc ||
                      'برگه آزمایش رسمی اصالت عسل و عدم استفاده از سموم شیمیایی'
                    }
                    onChange={(val) => updateField('trustItem3Desc', val)}
                    isEditing={isEditing}
                    isTextarea={true}
                    label="توضیح ستون ۳"
                  />
                </p>
              </div>

              {/* Card 4 */}
              <div className="bg-white p-5 rounded-2xl border border-farm-border shadow-2xs space-y-2 relative group/card hover:border-emerald-300 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-800 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-black text-farm-primary">
                  <InlineEditableText
                    value={content.trustItem4Title || 'تضمین ۱۰۰٪ رضایت مشتری'}
                    onChange={(val) => updateField('trustItem4Title', val)}
                    isEditing={isEditing}
                    label="عنوان ستون ۴"
                  />
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  <InlineEditableText
                    value={
                      content.trustItem4Desc ||
                      'در صورت عدم رضایت، مرجوعی کالا و بازگشت وجه بدون قید و شرط انجام می‌شود'
                    }
                    onChange={(val) => updateField('trustItem4Desc', val)}
                    isEditing={isEditing}
                    isTextarea={true}
                    label="توضیح ستون ۴"
                  />
                </p>
              </div>
            </div>
          </section>

          {/* SECTION 4: PRODUCTS SHOWCASE HEADER */}
          <section id="sec-products" className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-farm-border pb-4">
              <div>
                <span className="text-xs font-bold text-[#D4A373]">
                  <InlineEditableText
                    value={content.productsBadgeText || 'پکیج‌های آماده و شناسنامه‌دار'}
                    onChange={(val) => updateField('productsBadgeText', val)}
                    isEditing={isEditing}
                    label="بج ویترین محصولات"
                  />
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-farm-primary mt-1">
                  <InlineEditableText
                    value={
                      content.productsSectionTitle ||
                      'تازه‌ترین محصولات ارگانیک باغات و مزارع فارس'
                    }
                    onChange={(val) => updateField('productsSectionTitle', val)}
                    isEditing={isEditing}
                    label="تیتر ویترین محصولات"
                  />
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  <InlineEditableText
                    value={
                      content.productsSectionSubtitle ||
                      'مستقیماً چیده شده و آماده توزیع تازه در سطح شیراز'
                    }
                    onChange={(val) => updateField('productsSectionSubtitle', val)}
                    isEditing={isEditing}
                    label="زیرعنوان ویترین"
                  />
                </p>
              </div>
              <div className="text-xs font-bold text-gray-600">
                (ویترین زنده محصولات صفحه اصلی با ۴۵+ قلم کالای طبیعی)
              </div>
            </div>

            {/* Realistic Sample Preview of Product Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 opacity-85 pointer-events-none">
              {[
                { title: 'تخم‌مرغ محلی ارگانیک کامفیروز', price: '۱۸۵٬۰۰۰', img: '/images/prod-eggs.jpg' },
                { title: 'عسل طبیعی گون و آویشن دشت ارژن', price: '۵۹۰٬۰۰۰', img: '/images/prod-honey.jpg' },
                { title: 'روغن زیتون بکر باغات سروستان', price: '۴۸۰٬۰۰۰', img: '/images/prod-olive-oil.jpg' },
                { title: 'سبزی خوردن دست‌چین قصرالدشت', price: '۹۵٬۰۰۰', img: '/images/prod-greens.jpg' },
              ].map((p, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-farm-border overflow-hidden p-3 space-y-2 shadow-2xs"
                >
                  <div className="aspect-square rounded-xl overflow-hidden relative bg-gray-100">
                    <Image src={p.img} alt={p.title} fill className="object-cover" />
                  </div>
                  <div className="text-xs font-bold text-gray-900 truncate">{p.title}</div>
                  <div className="text-xs font-black text-emerald-800">
                    {p.price} تومان
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* SECTION 5: CLUB & PRO MEMBERSHIP BANNER */}
          <section id="sec-pro" className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
            <div className="bg-gradient-to-br from-farm-primary via-[#243c26] to-[#1a301c] rounded-3xl p-6 sm:p-10 text-white relative overflow-hidden shadow-farm">
              <div className="absolute top-0 left-0 w-80 h-80 bg-[#D4A373]/10 rounded-full blur-3xl pointer-events-none" />

              <div className="max-w-2xl mb-6 space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-semibold">
                  <Crown className="w-3.5 h-3.5" />
                  <InlineEditableText
                    value={content.proSectionBadge || 'باشگاه مشترکین طلایی مزارع شیراز'}
                    onChange={(val) => updateField('proSectionBadge', val)}
                    isEditing={isEditing}
                    label="بج باشگاه مشترکین"
                  />
                </div>

                <h2 className="text-xl sm:text-3xl font-black">
                  <InlineEditableText
                    value={
                      content.proSectionTitle ||
                      'عضویت در باشگاه اختصاصی پروفارم پرو و پلاس شیراز'
                    }
                    onChange={(val) => updateField('proSectionTitle', val)}
                    isEditing={isEditing}
                    label="تیتر باشگاه"
                  />
                </h2>

                <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                  <InlineEditableText
                    value={
                      content.proSectionSubtitle ||
                      'ارسال ۶ روز در هفته، تخفیف ویژه خرید تخم‌مرغ محلی و تخفیف نامحدود سایر کالاها'
                    }
                    onChange={(val) => updateField('proSectionSubtitle', val)}
                    isEditing={isEditing}
                    isTextarea={true}
                    label="توضیحات باشگاه"
                  />
                </p>
              </div>

              {/* Highlights cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-xs space-y-1">
                  <span className="text-amber-300 font-bold text-xs block">
                    نکته برجسته طرح طلایی پرو:
                  </span>
                  <div className="text-white font-medium">
                    <InlineEditableText
                      value={
                        content.proCardHighlight ||
                        'پیشنهاد طلایی: ۱۰٪ تخفیف تخم‌مرغ + ۵٪ سایر کالاها + ۲۰٪ ارسال'
                      }
                      onChange={(val) => updateField('proCardHighlight', val)}
                      isEditing={isEditing}
                      label="هایلایت طرح طلایی"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-xs space-y-1">
                  <span className="text-emerald-300 font-bold text-xs block">
                    نکته برجسته طرح اقتصادی پلاس:
                  </span>
                  <div className="text-white font-medium">
                    <InlineEditableText
                      value={
                        content.plusCardHighlight ||
                        'پیشنهاد اقتصادی: ۵٪ تخفیف تخم‌مرغ محلی تا ۲۰۰ عدد + ارسال ۶ روزه'
                      }
                      onChange={(val) => updateField('plusCardHighlight', val)}
                      isEditing={isEditing}
                      label="هایلایت طرح پلاس"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 6: SHIRAZ FARM STORY & HERITAGE */}
          <section id="sec-story" className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
            <div className="bg-white rounded-3xl border border-farm-border shadow-farm overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-12 items-center">
                <div className="lg:col-span-7 p-6 sm:p-10 space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4A373]/15 text-farm-primary text-xs font-bold">
                    <Leaf className="w-3.5 h-3.5 text-[#D4A373]" />
                    <InlineEditableText
                      value={content.storyBadgeText || 'اصالت سرزمین فارس'}
                      onChange={(val) => updateField('storyBadgeText', val)}
                      isEditing={isEditing}
                      label="بج داستان مزرعه"
                    />
                  </div>

                  <h2 className="text-xl sm:text-3xl font-black text-farm-primary leading-tight">
                    <InlineEditableText
                      value={content.storyTitle || 'از دامنه‌های زاگرس تا سفره‌های شیراز'}
                      onChange={(val) => updateField('storyTitle', val)}
                      isEditing={isEditing}
                      label="تیتر داستان مزرعه"
                    />
                  </h2>

                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed font-normal">
                    <InlineEditableText
                      value={
                        content.storyDescription ||
                        'پروفارم با گردآوری بیش از ۲۴ مزرعه‌دار سنتی در مناطق کامفیروز، دشت ارژن، سپیدان، فیروزآباد و میمند، واسطه‌ها را حذف کرده تا محصولات طبیعی با حداکثر طراوت به دست مصرف‌کننده برسد.'
                      }
                      onChange={(val) => updateField('storyDescription', val)}
                      isEditing={isEditing}
                      isTextarea={true}
                      label="متن تفصیلی داستان مزرعه"
                    />
                  </p>

                  <div className="flex items-center gap-2 text-xs font-bold text-farm-primary pt-2">
                    <MapPin className="w-4 h-4 text-[#D4A373] shrink-0" />
                    <span>مزارع تحت پوشش: </span>
                    <InlineEditableText
                      value={content.storyLocation || 'دشت ارژن، کامفیروز، سپیدان و میمند فارس'}
                      onChange={(val) => updateField('storyLocation', val)}
                      isEditing={isEditing}
                      label="مکان‌های تحت پوشش"
                    />
                  </div>
                </div>

                <div className="lg:col-span-5 h-64 sm:h-80 relative overflow-hidden bg-gray-100 group/storyimg">
                  <Image
                    src={content.storyImageUrl || '/images/story-fars-farms.jpg'}
                    alt={content.storyTitle || 'داستان مزارع فارس'}
                    fill
                    sizes="(max-width: 1024px) 100vw, 40vw"
                    className="object-cover transition-transform duration-500 group-hover/storyimg:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent z-10" />

                  {isEditing && (
                    <div className="absolute top-3 left-3 z-20">
                      <button
                        type="button"
                        onClick={() => handleOpenImageModal('storyImageUrl')}
                        className="px-3 py-1.5 rounded-xl bg-white/95 text-farm-primary hover:bg-white text-xs font-black shadow-lg flex items-center gap-1.5 transition-all cursor-pointer backdrop-blur-xs hover:scale-105"
                      >
                        <Camera className="w-3.5 h-3.5 text-emerald-700" />
                        <span>تغییر تصویر داستان</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 7: WHOLESALE & BULK LOGISTICS */}
          <section id="sec-bulk" className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
            <div className="bg-farm-bg-warm rounded-3xl border border-farm-border overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-12 items-center">
                <div className="md:col-span-8 p-6 sm:p-8 flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-farm-primary flex items-center justify-center text-[#D4A373] shrink-0">
                    <Package className="w-6 h-6" />
                  </div>
                  <div className="space-y-2">
                    <div className="inline-block text-xs font-bold text-[#D4A373]">
                      <InlineEditableText
                        value={content.bulkBadgeText || 'فروش مستقیم کارگاهی و مزارع'}
                        onChange={(val) => updateField('bulkBadgeText', val)}
                        isEditing={isEditing}
                        label="بج بخش عمده"
                      />
                    </div>
                    <h3 className="text-base sm:text-lg font-black text-farm-primary">
                      <InlineEditableText
                        value={
                          content.bulkSectionTitle ||
                          'خارج از شیراز هستید و تمایل به خرید عمده محصولات دارید؟'
                        }
                        onChange={(val) => updateField('bulkSectionTitle', val)}
                        isEditing={isEditing}
                        label="تیتر بخش عمده"
                      />
                    </h3>
                    <p className="text-xs text-gray-600 leading-relaxed max-w-lg">
                      <InlineEditableText
                        value={
                          content.bulkSectionSubtitle ||
                          'خرده‌فروشی مزارع ما صرفاً در شیراز عرضه می‌شود. اما با بخش «خرید عمده» می‌توانید سفارش‌های بالا را به مقصد تمام شهرهای ایران ثبت کنید.'
                        }
                        onChange={(val) => updateField('bulkSectionSubtitle', val)}
                        isEditing={isEditing}
                        isTextarea={true}
                        label="توضیح بخش عمده"
                      />
                    </p>
                    <div className="pt-2">
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-farm-primary text-white text-xs font-bold shadow-xs">
                        <InlineEditableText
                          value={content.bulkCtaText || 'ورود به سامانه سفارش عمده'}
                          onChange={(val) => updateField('bulkCtaText', val)}
                          isEditing={isEditing}
                          label="متن دکمه سفارش عمده"
                        />
                        <ArrowLeft className="w-3.5 h-3.5 text-[#D4A373]" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-4 h-48 md:h-full min-h-[180px] relative overflow-hidden bg-gray-200 group/bulkimg">
                  <Image
                    src={content.bulkSectionImageUrl || '/images/bulk-logistics.jpg'}
                    alt="تامین عمده مزارع فارس"
                    fill
                    sizes="(max-width: 768px) 100vw, 30vw"
                    className="object-cover transition-transform duration-500 group-hover/bulkimg:scale-105"
                  />
                  {isEditing && (
                    <div className="absolute top-3 left-3 z-20">
                      <button
                        type="button"
                        onClick={() => handleOpenImageModal('bulkSectionImageUrl')}
                        className="px-3 py-1.5 rounded-xl bg-white/95 text-farm-primary hover:bg-white text-xs font-black shadow-lg flex items-center gap-1.5 transition-all cursor-pointer backdrop-blur-xs hover:scale-105"
                      >
                        <Camera className="w-3.5 h-3.5 text-emerald-700" />
                        <span>تغییر تصویر عمده</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 8: CONTACT, SUPPORT & FOOTER */}
          <footer id="sec-footer" className="bg-farm-primary-dark text-gray-300 pt-12 pb-8 px-4 sm:px-8 border-t border-farm-primary">
            <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8">
              {/* Col 1: Brand & About */}
              <div className="md:col-span-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-[#D4A373] text-farm-primary-dark flex items-center justify-center font-black">
                    <Leaf className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-black text-white block">پروفارم شیراز</span>
                    <span className="text-xs text-emerald-300 block">
                      سامانه رسمی توزیع مستقیم محصولات ارگانیک فارس
                    </span>
                  </div>
                </div>

                <p className="text-xs text-gray-600 leading-relaxed max-w-sm">
                  <InlineEditableText
                    value={
                      content.footerAboutText ||
                      'پروفارم پلی مستقیم میان خانواده‌های شیرازی و کشاورزان بومی استان فارس است. ارسال بدون واسطه، با زنجیره توزیع بهداشتی.'
                    }
                    onChange={(val) => updateField('footerAboutText', val)}
                    isEditing={isEditing}
                    isTextarea={true}
                    label="متن معرفی فوتر"
                  />
                </p>
              </div>

              {/* Col 2: Support & Contact info */}
              <div className="md:col-span-4 space-y-3">
                <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#D4A373]" />
                  <span>اطلاعات تماس و پشتیبانی مزارع</span>
                </h4>

                <div className="space-y-2 text-xs text-gray-300">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">تلفن شیراز:</span>
                    <InlineEditableText
                      value={content.supportPhone || '۰۷۱-۳۶۲۸۰۰۰۰'}
                      onChange={(val) => updateField('supportPhone', val)}
                      isEditing={isEditing}
                      label="شماره تلفن پشتیبانی"
                      className="font-mono text-white font-bold"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">ساعات پاسخگویی:</span>
                    <InlineEditableText
                      value={content.supportHours || 'شنبه تا پنج‌شنبه، ۸ صبح الی ۲۰ شب'}
                      onChange={(val) => updateField('supportHours', val)}
                      isEditing={isEditing}
                      label="ساعات پاسخگویی"
                    />
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-gray-600 shrink-0">آدرس دفتر مرکزی:</span>
                    <InlineEditableText
                      value={
                        content.supportAddress ||
                        'شیراز، بلوار ارم، مجتمع کشاورزی نوین مزارع فارس'
                      }
                      onChange={(val) => updateField('supportAddress', val)}
                      isEditing={isEditing}
                      label="آدرس پستی"
                      className="text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Col 3: Social handles */}
              <div className="md:col-span-3 space-y-3">
                <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-[#D4A373]" />
                  <span>شبکه‌های اجتماعی مزارع</span>
                </h4>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Instagram className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                    <span className="text-gray-600">اینستاگرام:</span>
                    <InlineEditableText
                      value={content.socialInstagram || 'profarm_shiraz'}
                      onChange={(val) => updateField('socialInstagram', val)}
                      isEditing={isEditing}
                      label="آیدی اینستاگرام"
                      className="font-mono text-white font-bold"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Send className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span className="text-gray-600">تلگرام:</span>
                    <InlineEditableText
                      value={content.socialTelegram || 'profarm_support'}
                      onChange={(val) => updateField('socialTelegram', val)}
                      isEditing={isEditing}
                      label="آیدی تلگرام"
                      className="font-mono text-white font-bold"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-gray-600">واتس‌اپ:</span>
                    <InlineEditableText
                      value={content.socialWhatsapp || '۰۹۱۷۰۰۰۰۰۰۰'}
                      onChange={(val) => updateField('socialWhatsapp', val)}
                      isEditing={isEditing}
                      label="شماره واتس‌اپ"
                      className="font-mono text-white font-bold"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 font-black text-xs shrink-0">ایتا:</span>
                    <InlineEditableText
                      value={content.socialEitaa || 'profarm'}
                      onChange={(val) => updateField('socialEitaa', val)}
                      isEditing={isEditing}
                      label="آیدی ایتا"
                      className="font-mono text-white font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="max-w-6xl mx-auto mt-8 pt-4 border-t border-white/10 text-center text-xs text-gray-500">
              کلیه حقوق مادی و معنوی برای مزارع ارگانیک پروفارم شیراز محفوظ است.
            </div>
          </footer>
        </div>
      </div>

      {/* 3. IMAGE PICKER MODAL */}
      {imageModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-farm-border overflow-hidden flex flex-col max-h-[85vh] text-right">
            {/* Modal Header */}
            <div className="p-4 border-b border-farm-border flex items-center justify-between bg-farm-bg">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-farm-primary" />
                <h3 className="font-black text-sm text-farm-primary">
                  انتخاب یا بارگذاری تصویر بخش{' '}
                  {activeImageField === 'heroImageUrl'
                    ? 'هدر اصلی'
                    : activeImageField === 'storyImageUrl'
                    ? 'داستان مزرعه'
                    : 'سفارش عمده'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setImageModalOpen(false)}
                className="p-1 text-gray-600 hover:text-gray-700 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex items-center border-b border-gray-100 px-4 bg-gray-50 gap-2">
              <button
                type="button"
                onClick={() => setImageTab('presets')}
                className={`py-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  imageTab === 'presets'
                    ? 'border-farm-primary text-farm-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                گالری تصاویر آماده مزارع فارس ({presetImages.length})
              </button>
              <button
                type="button"
                onClick={() => setImageTab('upload')}
                className={`py-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  imageTab === 'upload'
                    ? 'border-farm-primary text-farm-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                آپلود فایل جدید از سیستم
              </button>
              <button
                type="button"
                onClick={() => setImageTab('url')}
                className={`py-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  imageTab === 'url'
                    ? 'border-farm-primary text-farm-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                آدرس مستقیم (URL)
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {/* Presets Gallery */}
              {imageTab === 'presets' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {presetImages.map((img, idx) => {
                    const isSelected = tempImageUrl === img.url;
                    return (
                      <div
                        key={idx}
                        onClick={() => setTempImageUrl(img.url)}
                        className={`group relative rounded-2xl overflow-hidden border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-emerald-600 ring-2 ring-emerald-400 shadow-md'
                            : 'border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        <div className="aspect-4/3 relative bg-gray-100">
                          <Image
                            src={img.url}
                            alt={img.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform"
                          />
                          {isSelected && (
                            <div className="absolute top-2 right-2 bg-emerald-600 text-white p-1 rounded-full shadow-md">
                              <Check className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>
                        <div className="p-2 bg-white">
                          <div className="text-xs font-bold text-gray-900 truncate">
                            {img.title}
                          </div>
                          <span className="text-xs text-gray-600 block mt-0.5">
                            {img.category}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Direct File Upload */}
              {imageTab === 'upload' && (
                <div className="space-y-4 text-center">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-emerald-500/50 hover:border-emerald-600 rounded-3xl p-8 bg-emerald-50/30 hover:bg-emerald-50/60 transition-colors cursor-pointer space-y-3"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 mx-auto flex items-center justify-center">
                      <UploadCloud className="w-7 h-7" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-800 block">
                        جهت انتخاب تصویر کلیک کنید
                      </span>
                      <span className="text-xs text-gray-500 block mt-1">
                        فرمت‌های مجاز: JPG, PNG, WEBP (حداکثر ۵ مگابایت)
                      </span>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>

                  {tempImageUrl && (
                    <div className="p-3 bg-white rounded-2xl border border-gray-200 text-right space-y-2">
                      <span className="text-xs font-bold text-gray-700 block">
                        پیش‌نمایش فایل بارگذاری‌شده:
                      </span>
                      <div className="aspect-video max-w-sm rounded-xl overflow-hidden relative border border-gray-200">
                        <Image
                          src={tempImageUrl}
                          alt="Uploaded Preview"
                          fill
                          className="object-cover"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Direct URL */}
              {imageTab === 'url' && (
                <div className="space-y-3">
                  <label className="text-xs font-bold text-gray-700 block">
                    آدرس تصویر را وارد نمایید:
                  </label>
                  <input
                    type="text"
                    value={tempImageUrl}
                    onChange={(e) => setTempImageUrl(e.target.value)}
                    placeholder="https://... یا /images/..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs font-mono outline-none focus:border-emerald-500"
                  />
                  {tempImageUrl && (
                    <div className="aspect-video max-w-sm rounded-xl overflow-hidden relative border border-gray-200 mt-3">
                      <Image
                        src={tempImageUrl}
                        alt="URL Preview"
                        fill
                        className="object-cover"
                        onError={() => {}}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-farm-border bg-farm-bg flex items-center justify-between">
              <button
                type="button"
                onClick={() => setImageModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 text-xs font-bold cursor-pointer"
              >
                انصراف
              </button>

              <button
                type="button"
                onClick={handleApplyImage}
                className="px-5 py-2 rounded-xl bg-farm-primary hover:bg-farm-primary-dark text-white text-xs font-black shadow-md transition-all cursor-pointer"
              >
                تایید و اعمال بر روی صفحه
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
