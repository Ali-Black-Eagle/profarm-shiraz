'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Crown,
  Zap,
  Truck,
  Sparkles,
  HelpCircle,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Eye,
  Edit3,
  Smartphone,
  Monitor,
  ExternalLink,
  Check,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';
import { SubscriptionSettings, FaqItem, ComparisonRow } from '@/types';
import { formatToman, toPersianDigits } from '@/lib/formatters';
import InlineEditableText from './InlineEditableText';

interface SubscriptionLiveEditorProps {
  settings: SubscriptionSettings;
  onChange: (newSettings: SubscriptionSettings) => void;
  onSave: () => Promise<void> | void;
  onReset: () => void;
  isSaving?: boolean;
}

export default function SubscriptionLiveEditor({
  settings,
  onChange,
  onSave,
  onReset,
  isSaving = false,
}: SubscriptionLiveEditorProps) {
  const [isEditing, setIsEditing] = useState(true);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [newFreePerk, setNewFreePerk] = useState('');
  const [newPlusPerk, setNewPlusPerk] = useState('');
  const [newProPerk, setNewProPerk] = useState('');

  // Update helper
  const updateSetting = <K extends keyof SubscriptionSettings>(
    key: K,
    value: SubscriptionSettings[K]
  ) => {
    onChange({
      ...settings,
      [key]: value,
    });
  };

  // Perks helpers
  const handleAddPerk = (tier: 'pro' | 'plus' | 'free') => {
    if (tier === 'pro' && newProPerk.trim()) {
      updateSetting('proFeatures', [...(settings.proFeatures || []), newProPerk.trim()]);
      setNewProPerk('');
    } else if (tier === 'plus' && newPlusPerk.trim()) {
      updateSetting('plusFeatures', [...(settings.plusFeatures || []), newPlusPerk.trim()]);
      setNewPlusPerk('');
    } else if (tier === 'free' && newFreePerk.trim()) {
      updateSetting('freeFeatures', [...(settings.freeFeatures || []), newFreePerk.trim()]);
      setNewFreePerk('');
    }
  };

  const handleUpdatePerk = (tier: 'pro' | 'plus' | 'free', index: number, value: string) => {
    if (tier === 'pro') {
      const list = [...(settings.proFeatures || [])];
      list[index] = value;
      updateSetting('proFeatures', list);
    } else if (tier === 'plus') {
      const list = [...(settings.plusFeatures || [])];
      list[index] = value;
      updateSetting('plusFeatures', list);
    } else {
      const list = [...(settings.freeFeatures || [])];
      list[index] = value;
      updateSetting('freeFeatures', list);
    }
  };

  const handleDeletePerk = (tier: 'pro' | 'plus' | 'free', index: number) => {
    if (tier === 'pro') {
      updateSetting('proFeatures', (settings.proFeatures || []).filter((_, i) => i !== index));
    } else if (tier === 'plus') {
      updateSetting('plusFeatures', (settings.plusFeatures || []).filter((_, i) => i !== index));
    } else {
      updateSetting('freeFeatures', (settings.freeFeatures || []).filter((_, i) => i !== index));
    }
  };

  // FAQ helpers
  const handleAddFaq = () => {
    const newItem: FaqItem = {
      id: `faq_${Date.now()}`,
      q: 'عنوان سوال جدید را اینجا وارد کنید',
      a: 'پاسخ کامل سوال را اینجا تایپ کنید...',
    };
    updateSetting('faqItems', [...(settings.faqItems || []), newItem]);
  };

  const handleUpdateFaq = (index: number, field: 'q' | 'a', value: string) => {
    const list = [...(settings.faqItems || [])];
    if (list[index]) {
      list[index] = { ...list[index], [field]: value };
      updateSetting('faqItems', list);
    }
  };

  const handleDeleteFaq = (index: number) => {
    updateSetting('faqItems', (settings.faqItems || []).filter((_, i) => i !== index));
  };

  // Comparison Rows helpers
  const handleAddComparisonRow = () => {
    const newRow: ComparisonRow = {
      id: `row_${Date.now()}`,
      title: 'ویژگی جدید',
      free: 'ندارد',
      plus: 'دارد',
      pro: 'کامل',
    };
    updateSetting('comparisonRows', [...(settings.comparisonRows || []), newRow]);
  };

  const handleUpdateComparisonRow = (
    id: string,
    field: 'title' | 'free' | 'plus' | 'pro',
    value: string
  ) => {
    const list = [...(settings.comparisonRows || [])].map((row) => {
      if (row.id === id) {
        return { ...row, [field]: value };
      }
      return row;
    });
    updateSetting('comparisonRows', list);
  };

  const handleDeleteComparisonRow = (id: string) => {
    updateSetting(
      'comparisonRows',
      (settings.comparisonRows || []).filter((r) => r.id !== id)
    );
  };

  return (
    <div className="space-y-6">
      {/* Sticky Top Control Toolbar */}
      <div className="sticky top-4 z-40 bg-farm-primary-dark/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-emerald-500/30 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-400/20 text-[#D4AF37] border border-amber-400/30">
            <Edit3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-white">ویرایشگر زنده و بصری صفحه اشتراک</h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Live In-Place Editor
              </span>
            </div>
            <p className="text-xs text-emerald-200/80">
              روی هر متنی در پایین کلیک کنید تا درجا ویرایش شود. پیش‌نمایش به صورت لحظه‌ای بروز می‌شود.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Mode Switch: Edit vs Preview */}
          <div className="bg-black/30 p-1 rounded-xl border border-white/10 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                isEditing ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-300 hover:text-white'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>حالت ویرایش اجزا</span>
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                !isEditing ? 'bg-[#D4AF37] text-gray-950 font-black shadow-xs' : 'text-gray-300 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>پیش‌نمایش نهایی</span>
            </button>
          </div>

          {/* Device toggle */}
          <div className="bg-black/30 p-1 rounded-xl border border-white/10 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPreviewDevice('desktop')}
              title="نمای رایانه (تمام‌صفحه)"
              className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                previewDevice === 'desktop' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice('mobile')}
              title="نمای گوشی هوشمند"
              className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                previewDevice === 'mobile' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-4 h-4" />
            </button>
          </div>

          {/* Reset button */}
          <button
            type="button"
            onClick={onReset}
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-rose-500/20 hover:text-rose-200 text-gray-200 text-xs font-bold transition-all flex items-center gap-1.5 border border-white/10 cursor-pointer"
            title="بازگردانی کلیه متون به پیش‌فرض سیستم"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">بازنشانی پیش‌فرض</span>
          </button>

          {/* View actual /pro page */}
          <Link
            href="/pro"
            target="_blank"
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-1.5 border border-white/10"
            title="مشاهده صفحه زنده سایت در تب جدید"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">صفحه اصلی /pro</span>
          </Link>

          {/* Save button */}
          <button
            type="button"
            onClick={() => onSave()}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-[#D4AF37] hover:brightness-110 text-gray-950 font-black text-xs shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'در حال ذخیره‌سازی...' : 'ذخیره و انتشار تغییرات'}</span>
          </button>
        </div>
      </div>

      {/* Simulator Wrapper */}
      <div
        className={`mx-auto transition-all duration-300 ${
          previewDevice === 'mobile'
            ? 'max-w-[420px] bg-gray-100 p-4 rounded-[40px] shadow-2xl border-8 border-gray-800 my-6'
            : 'w-full'
        }`}
      >
        <div className="bg-[#F8F6F0] rounded-3xl p-4 sm:p-8 space-y-16 border border-farm-border shadow-xs">
          
          {/* ======================================================== */}
          {/* 1. HERO BANNER */}
          {/* ======================================================== */}
          <div className="bg-gradient-to-br from-farm-primary via-[#203622] to-[#122314] rounded-3xl p-6 sm:p-12 text-white relative overflow-hidden shadow-2xl border border-[#D4A373]/40">
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#D4AF37]/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-3xl space-y-5 relative z-10">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold border border-amber-400/30">
                <Crown className="w-4 h-4 text-[#D4AF37]" />
                <InlineEditableText
                  value={settings.heroBadgeText || 'باشگاه مشترکین ویژه «پروفارم شیراز»'}
                  onChange={(val) => updateSetting('heroBadgeText', val)}
                  isEditing={isEditing}
                  label="نشان بالای هیرو"
                />
              </div>

              {/* Title */}
              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black leading-tight text-white">
                <InlineEditableText
                  value={
                    settings.heroTitle ||
                    'طراوت هر روزه با تحویل ۶ روز هفته و تخفیف‌های ویژه مزارع فارس'
                  }
                  onChange={(val) => updateSetting('heroTitle', val)}
                  isEditing={isEditing}
                  label="تیتر اصلی هیرو"
                  as="span"
                />
              </h1>

              {/* Description */}
              <div className="text-xs sm:text-base text-gray-300 leading-relaxed">
                <InlineEditableText
                  value={
                    settings.heroDescription ||
                    'کاربران عادی تنها ۲ روز در هفته (یکشنبه و چهارشنبه) امکان دریافت سفارش دارند. با اشتراک‌های پلاس یا پرو، از شنبه تا پنج‌شنبه هر روزی که بخواهید سفارشتان با پیک پروفارم ارسال شده و از تخفیف‌های دائمی خرید تخم‌مرغ محلی و محصولات ارگانیک بهره‌مند می‌شوید.'
                  }
                  onChange={(val) => updateSetting('heroDescription', val)}
                  isEditing={isEditing}
                  isTextarea
                  label="توضیحات هیرو"
                  as="p"
                />
              </div>

              {/* Quick links & CTA */}
              <div className="pt-2 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 text-xs text-amber-200 bg-black/20 px-3.5 py-2 rounded-xl border border-white/10">
                  <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                  <span>طرح فعال شما: <strong>اشتراک پرو (عضویت ویژه)</strong></span>
                </div>

                <div className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-md transition-all flex items-center gap-1.5">
                  <InlineEditableText
                    value={settings.heroCtaText || 'مشاهده محصولات مزارع'}
                    onChange={(val) => updateSetting('heroCtaText', val)}
                    isEditing={isEditing}
                    label="متن دکمه هیرو"
                  />
                  <ArrowLeft className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* 2. SECTION HEADER */}
          {/* ======================================================== */}
          <div className="space-y-8">
            <div className="text-center space-y-2 max-w-2xl mx-auto">
              <span className="text-xs font-bold text-[#D4A373]">
                <InlineEditableText
                  value={settings.sectionSubheader || 'انتخاب پلن مناسب نیاز شما'}
                  onChange={(val) => updateSetting('sectionSubheader', val)}
                  isEditing={isEditing}
                  label="زیرتیتر بخش اشتراک‌ها"
                />
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-farm-primary">
                <InlineEditableText
                  value={settings.sectionTitle || 'مقایسه و انتخاب اشتراک ماهانه پروفارم'}
                  onChange={(val) => updateSetting('sectionTitle', val)}
                  isEditing={isEditing}
                  label="تیتر بزرگ بخش اشتراک‌ها"
                  as="span"
                />
              </h2>
              <p className="text-xs sm:text-sm text-gray-600">
                <InlineEditableText
                  value={
                    settings.sectionDescription ||
                    'برای خانواده‌هایی که سلامت و کیفیت تغذیه روزمره‌شان در اولویت است'
                  }
                  onChange={(val) => updateSetting('sectionDescription', val)}
                  isEditing={isEditing}
                  label="توضیح کوتاه بخش اشتراک‌ها"
                  as="span"
                />
              </p>
            </div>

            {/* ======================================================== */}
            {/* 3 PRICING CARDS */}
            {/* ======================================================== */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
              
              {/* CARD 1: FREE TIER */}
              <div className="rounded-3xl p-6 sm:p-8 flex flex-col justify-between bg-white border border-farm-border shadow-xs">
                <div className="space-y-5">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-gray-500">
                      <InlineEditableText
                        value={settings.freeSubtitle || 'طرح پایه'}
                        onChange={(val) => updateSetting('freeSubtitle', val)}
                        isEditing={isEditing}
                        label="برچسب طرح پایه"
                      />
                    </span>
                    <h3 className="text-xl font-black text-farm-primary">
                      <InlineEditableText
                        value={settings.freeTitle || 'کاربر عادی'}
                        onChange={(val) => updateSetting('freeTitle', val)}
                        isEditing={isEditing}
                        label="عنوان طرح عادی"
                      />
                    </h3>
                    <p className="text-xs text-gray-500">سفارش‌های گاه‌به‌گاه و خرید آزمایشی</p>
                  </div>

                  <div className="pt-2 pb-4 border-b border-gray-100">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-farm-primary">
                        <InlineEditableText
                          value={settings.freePriceLabel || 'رایگان'}
                          onChange={(val) => updateSetting('freePriceLabel', val)}
                          isEditing={isEditing}
                          label="عنوان قیمت طرح عادی"
                        />
                      </span>
                    </div>
                    <span className="text-xs text-gray-600">
                      <InlineEditableText
                        value={settings.freePriceSubtext || 'بدون نیاز به پرداخت ماهانه'}
                        onChange={(val) => updateSetting('freePriceSubtext', val)}
                        isEditing={isEditing}
                        label="زیرنویس قیمت"
                      />
                    </span>
                  </div>

                  {/* Free Perks */}
                  <div className="space-y-3">
                    {(settings.freeFeatures || []).map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2 group/perk text-xs text-gray-700">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <InlineEditableText
                            value={feat}
                            onChange={(val) => handleUpdatePerk('free', idx, val)}
                            isEditing={isEditing}
                            label={`مزیت ${idx + 1}`}
                          />
                        </div>
                        {isEditing && (
                          <button
                            type="button"
                            onClick={() => handleDeletePerk('free', idx)}
                            className="text-rose-400 hover:text-rose-600 p-0.5 rounded opacity-60 hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                            title="حذف این مزیت"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}

                    {/* Add Perk input */}
                    {isEditing && (
                      <div className="pt-2 border-t border-dashed border-gray-200">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newFreePerk}
                            onChange={(e) => setNewFreePerk(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddPerk('free')}
                            placeholder="+ افزودن مزیت جدید به کاربر عادی..."
                            className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:border-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddPerk('free')}
                            className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs cursor-pointer"
                            title="افزودن مزیت"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-8">
                  <div className="w-full py-3.5 px-4 rounded-2xl text-xs font-bold text-center bg-farm-bg-warm text-farm-primary">
                    <InlineEditableText
                      value={settings.freeButtonText || 'طرح فعلی شما (رایگان) ✓'}
                      onChange={(val) => updateSetting('freeButtonText', val)}
                      isEditing={isEditing}
                      label="متن دکمه طرح عادی"
                    />
                  </div>
                </div>
              </div>

              {/* CARD 2: PLUS TIER */}
              <div className="rounded-3xl p-6 sm:p-8 flex flex-col justify-between bg-white border border-emerald-200 shadow-farm hover:border-emerald-400">
                <div className="space-y-5">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-xs font-bold">
                      <Zap className="w-3 h-3 text-emerald-600" />
                      <InlineEditableText
                        value={settings.plusBadgeText || 'اقتصادی'}
                        onChange={(val) => updateSetting('plusBadgeText', val)}
                        isEditing={isEditing}
                        label="برچسب بالای پلاس"
                      />
                    </div>
                    <h3 className="text-xl font-black text-emerald-950">
                      <InlineEditableText
                        value={settings.plusTitle || 'اشتراک پلاس'}
                        onChange={(val) => updateSetting('plusTitle', val)}
                        isEditing={isEditing}
                        label="عنوان طرح پلاس"
                      />
                    </h3>
                    <p className="text-xs text-gray-500">
                      <InlineEditableText
                        value={settings.plusSubtitle || 'تحویل همه روزه + تخفیف تخم‌مرغ محلی'}
                        onChange={(val) => updateSetting('plusSubtitle', val)}
                        isEditing={isEditing}
                        label="توضیح زیرین طرح پلاس"
                      />
                    </p>
                  </div>

                  <div className="pt-2 pb-4 border-b border-emerald-100">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-emerald-900">
                        {formatToman(settings.plusMonthlyPrice)}
                      </span>
                      <span className="text-xs font-bold text-gray-600"> / ماهانه</span>
                    </div>
                    <span className="text-xs text-emerald-700 font-medium">
                      <InlineEditableText
                        value={settings.plusPriceSubtext || 'صرفه‌جویی تضمین‌شده در خرید هفتگی'}
                        onChange={(val) => updateSetting('plusPriceSubtext', val)}
                        isEditing={isEditing}
                        label="زیرنویس قیمت پلاس"
                      />
                    </span>
                  </div>

                  {/* Plus Perks */}
                  <div className="space-y-3 text-xs text-gray-700">
                    {(settings.plusFeatures || []).map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2 group/perk text-xs text-gray-700">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <InlineEditableText
                            value={feat}
                            onChange={(val) => handleUpdatePerk('plus', idx, val)}
                            isEditing={isEditing}
                            label={`مزیت ${idx + 1}`}
                          />
                        </div>
                        {isEditing && (
                          <button
                            type="button"
                            onClick={() => handleDeletePerk('plus', idx)}
                            className="text-rose-400 hover:text-rose-600 p-0.5 rounded opacity-60 hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                            title="حذف این مزیت"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}

                    {/* Add Perk input */}
                    {isEditing && (
                      <div className="pt-2 border-t border-dashed border-emerald-200">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newPlusPerk}
                            onChange={(e) => setNewPlusPerk(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddPerk('plus')}
                            placeholder="+ افزودن مزیت جدید به پلاس..."
                            className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-emerald-200 focus:outline-none focus:border-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddPerk('plus')}
                            className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-xs cursor-pointer"
                            title="افزودن مزیت"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-8">
                  <div className="w-full py-3.5 px-4 rounded-2xl text-xs font-bold shadow-md bg-emerald-700 text-white flex items-center justify-center gap-2">
                    <Zap className="w-4 h-4" />
                    <InlineEditableText
                      value={
                        settings.plusButtonText ||
                        `خرید اشتراک پلاس (${formatToman(settings.plusMonthlyPrice)})`
                      }
                      onChange={(val) => updateSetting('plusButtonText', val)}
                      isEditing={isEditing}
                      label="متن دکمه پلاس"
                    />
                  </div>
                </div>
              </div>

              {/* CARD 3: PRO TIER (GOLDEN) */}
              <div className="rounded-3xl p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden bg-gradient-to-b from-amber-50/70 via-white to-white border-2 border-[#D4AF37] shadow-xl hover:border-amber-600">
                {/* Ribbon Badge */}
                <div className="absolute top-4 left-4 bg-gradient-to-r from-amber-600 to-[#D4AF37] text-white text-xs font-black px-3 py-1 rounded-full shadow-md">
                  <InlineEditableText
                    value={settings.proTopLabel || '★ محبوب‌ترین'}
                    onChange={(val) => updateSetting('proTopLabel', val)}
                    isEditing={isEditing}
                    label="روبان گوشه کارت پرو"
                  />
                </div>

                <div className="space-y-5">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 text-xs font-bold">
                      <Crown className="w-3 h-3 text-amber-600" />
                      <InlineEditableText
                        value={settings.proBadgeText || 'اشتراک طلایی پروفارم پرو'}
                        onChange={(val) => updateSetting('proBadgeText', val)}
                        isEditing={isEditing}
                        label="برچسب طرح پرو"
                      />
                    </div>
                    <h3 className="text-xl font-black text-amber-950">
                      <InlineEditableText
                        value={settings.proTitle || 'اشتراک پرو (Pro)'}
                        onChange={(val) => updateSetting('proTitle', val)}
                        isEditing={isEditing}
                        label="عنوان طرح پرو"
                      />
                    </h3>
                    <p className="text-xs text-gray-500">
                      <InlineEditableText
                        value={settings.proSubtitle || 'حداکثر تخفیف و بیشترین انعطاف در دریافت'}
                        onChange={(val) => updateSetting('proSubtitle', val)}
                        isEditing={isEditing}
                        label="توضیح زیرین طرح پرو"
                      />
                    </p>
                  </div>

                  <div className="pt-2 pb-4 border-b border-amber-200">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-farm-primary">
                        {formatToman(settings.proMonthlyPrice)}
                      </span>
                      <span className="text-xs font-bold text-gray-600"> / ماهانه</span>
                    </div>
                    <span className="text-xs text-amber-700 font-bold">
                      <InlineEditableText
                        value={
                          settings.proPriceSubtext ||
                          `${toPersianDigits(settings.proEggDiscountPercent)}٪ تخم‌مرغ + ${toPersianDigits(settings.proOtherDiscountPercent)}٪ سایر محصولات + ${toPersianDigits(settings.proShippingDiscountPercent)}٪ تخفیف ارسال`
                        }
                        onChange={(val) => updateSetting('proPriceSubtext', val)}
                        isEditing={isEditing}
                        label="زیرنویس قیمت پرو"
                      />
                    </span>
                  </div>

                  {/* Pro Perks */}
                  <div className="space-y-3 text-xs text-gray-800">
                    {(settings.proFeatures || []).map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2 group/perk text-xs font-medium text-gray-700">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <InlineEditableText
                            value={feat}
                            onChange={(val) => handleUpdatePerk('pro', idx, val)}
                            isEditing={isEditing}
                            label={`مزیت ${idx + 1}`}
                          />
                        </div>
                        {isEditing && (
                          <button
                            type="button"
                            onClick={() => handleDeletePerk('pro', idx)}
                            className="text-rose-400 hover:text-rose-600 p-0.5 rounded opacity-60 hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                            title="حذف این مزیت"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}

                    {/* Add Perk input */}
                    {isEditing && (
                      <div className="pt-2 border-t border-dashed border-amber-300">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newProPerk}
                            onChange={(e) => setNewProPerk(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddPerk('pro')}
                            placeholder="+ افزودن مزیت جدید به پرو..."
                            className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-amber-300 focus:outline-none focus:border-amber-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddPerk('pro')}
                            className="p-1.5 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-lg text-xs cursor-pointer"
                            title="افزودن مزیت"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-8">
                  <div className="w-full py-4 px-4 rounded-2xl text-xs font-black shadow-lg bg-gradient-to-r from-farm-primary to-farm-primary-dark text-white flex items-center justify-center gap-2">
                    <Crown className="w-4 h-4 text-[#F3E5AB]" />
                    <InlineEditableText
                      value={
                        settings.proButtonText ||
                        `خرید اشتراک پرو (${formatToman(settings.proMonthlyPrice)})`
                      }
                      onChange={(val) => updateSetting('proButtonText', val)}
                      isEditing={isEditing}
                      label="متن دکمه پرو"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* 4. COMPARISON TABLE */}
          {/* ======================================================== */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-farm-border shadow-farm space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <h3 className="text-xl font-black text-farm-primary">
                <InlineEditableText
                  value={settings.comparisonTitle || 'جدول مقایسه جامع ویژگی‌های پلن‌ها'}
                  onChange={(val) => updateSetting('comparisonTitle', val)}
                  isEditing={isEditing}
                  label="تیتر جدول مقایسه"
                />
              </h3>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleAddComparisonRow}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                  title="افزودن ردیف جدید به جدول مقایسه"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>افزودن ردیف به جدول مقایسه</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="py-3 px-4 font-bold text-gray-700">
                      <InlineEditableText
                        value={settings.comparisonFeatureHeader || 'ویژگی و امکانات'}
                        onChange={(val) => updateSetting('comparisonFeatureHeader', val)}
                        isEditing={isEditing}
                        label="سرستون امکانات"
                      />
                    </th>
                    <th className="py-3 px-4 text-center font-bold text-gray-700">
                      <InlineEditableText
                        value={settings.comparisonFreeHeader || 'کاربر عادی'}
                        onChange={(val) => updateSetting('comparisonFreeHeader', val)}
                        isEditing={isEditing}
                        label="سرستون کاربر عادی"
                      />
                    </th>
                    <th className="py-3 px-4 text-center font-bold text-emerald-800 bg-emerald-50/50 rounded-t-xl">
                      <InlineEditableText
                        value={settings.comparisonPlusHeader || 'اشتراک پلاس'}
                        onChange={(val) => updateSetting('comparisonPlusHeader', val)}
                        isEditing={isEditing}
                        label="سرستون پلاس"
                      />
                    </th>
                    <th className="py-3 px-4 text-center font-bold text-amber-900 bg-amber-50/50 rounded-t-xl">
                      <InlineEditableText
                        value={settings.comparisonProHeader || 'اشتراک پرو'}
                        onChange={(val) => updateSetting('comparisonProHeader', val)}
                        isEditing={isEditing}
                        label="سرستون پرو"
                      />
                    </th>
                    {isEditing && (
                      <th className="py-3 px-2 text-center font-bold text-gray-600 w-10">
                        عملیات
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(settings.comparisonRows || []).map((row, idx) => (
                    <tr key={row.id || idx} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-gray-800">
                        <InlineEditableText
                          value={row.title}
                          onChange={(val) => handleUpdateComparisonRow(row.id, 'title', val)}
                          isEditing={isEditing}
                          label={`عنوان ردیف ${idx + 1}`}
                        />
                      </td>
                      <td className="py-3.5 px-4 text-center text-gray-600">
                        <InlineEditableText
                          value={row.free}
                          onChange={(val) => handleUpdateComparisonRow(row.id, 'free', val)}
                          isEditing={isEditing}
                          label="مقدار عادی"
                        />
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-emerald-800 bg-emerald-50/30">
                        <InlineEditableText
                          value={row.plus}
                          onChange={(val) => handleUpdateComparisonRow(row.id, 'plus', val)}
                          isEditing={isEditing}
                          label="مقدار پلاس"
                        />
                      </td>
                      <td className="py-3.5 px-4 text-center font-black text-amber-900 bg-amber-50/30">
                        <InlineEditableText
                          value={row.pro}
                          onChange={(val) => handleUpdateComparisonRow(row.id, 'pro', val)}
                          isEditing={isEditing}
                          label="مقدار پرو"
                        />
                      </td>
                      {isEditing && (
                        <td className="py-3.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteComparisonRow(row.id)}
                            className="text-rose-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                            title="حذف این ردیف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {(!settings.comparisonRows || settings.comparisonRows.length === 0) && (
                    <tr>
                      <td colSpan={isEditing ? 5 : 4} className="py-6 text-center text-gray-600 text-xs">
                        هیچ ردیفی در جدول تعریف نشده است.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ======================================================== */}
          {/* 5. FAQ SECTION */}
          {/* ======================================================== */}
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold text-[#D4A373]">
                  <InlineEditableText
                    value={settings.faqSubheader || 'پرسش‌های متداول'}
                    onChange={(val) => updateSetting('faqSubheader', val)}
                    isEditing={isEditing}
                    label="زیرتیتر بخش سوالات"
                  />
                </span>
                <h2 className="text-2xl font-black text-farm-primary">
                  <InlineEditableText
                    value={settings.faqTitle || 'سوالاتی که ممکن است داشته باشید'}
                    onChange={(val) => updateSetting('faqTitle', val)}
                    isEditing={isEditing}
                    label="تیتر بخش سوالات"
                    as="span"
                  />
                </h2>
              </div>

              {isEditing && (
                <button
                  type="button"
                  onClick={handleAddFaq}
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>افزودن پرسش و پاسخ جدید</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(settings.faqItems || []).map((faq, idx) => (
                <div
                  key={faq.id || idx}
                  className="bg-white rounded-2xl p-5 border border-farm-border shadow-xs space-y-2 relative group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold text-farm-primary flex items-center gap-2 flex-1">
                      <HelpCircle className="w-4 h-4 text-[#D4A373] shrink-0" />
                      <div className="flex-1">
                        <InlineEditableText
                          value={faq.q}
                          onChange={(val) => handleUpdateFaq(idx, 'q', val)}
                          isEditing={isEditing}
                          label={`سوال ${toPersianDigits(idx + 1)}`}
                        />
                      </div>
                    </h4>

                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => handleDeleteFaq(idx)}
                        className="text-gray-600 hover:text-rose-600 p-1 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
                        title="حذف این پرسش"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="text-xs text-gray-600 leading-relaxed pr-6">
                    <InlineEditableText
                      value={faq.a}
                      onChange={(val) => handleUpdateFaq(idx, 'a', val)}
                      isEditing={isEditing}
                      isTextarea
                      label="پاسخ"
                      as="p"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
