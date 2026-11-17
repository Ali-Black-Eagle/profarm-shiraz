'use client';

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Save,
  Zap,
  HelpCircle,
  Info,
  Lock,
  Sparkles,
  Server,
  Activity,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { farmStore } from '@/lib/db-store';
import { PaymentSettings } from '@/types';
import { toPersianDigits, formatToman } from '@/lib/formatters';

export default function AdminPaymentSettingsPage() {
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [activeTab, setActiveTab] = useState<'zarinpal' | 'snapppay' | 'general' | 'guide'>('zarinpal');
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Visibility toggles for sensitive fields
  const [showZarinpalMerchant, setShowZarinpalMerchant] = useState(false);
  const [showSnappSecret, setShowSnappSecret] = useState(false);

  // Copy state
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Testing connection states
  const [isTestingZarinpal, setIsTestingZarinpal] = useState(false);
  const [zarinpalTestResult, setZarinpalTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
    code?: number;
  } | null>(null);

  const [isTestingSnappPay, setIsTestingSnappPay] = useState(false);
  const [snappPayTestResult, setSnappPayTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
    statusCode?: number;
  } | null>(null);

  // Load settings on mount
  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch('/api/admin/payment-settings');
        const data = await res.json();
        if (data.success && data.settings) {
          setSettings(data.settings);
        } else {
          setSettings(farmStore.getPaymentSettings());
        }
      } catch (err) {
        setSettings(farmStore.getPaymentSettings());
      }
    }
    fetchSettings();
  }, []);

  const handleCopy = (text: string, fieldName: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2500);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);
    setNotification(null);

    try {
      const res = await fetch('/api/admin/payment-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        farmStore.updatePaymentSettings(settings);
        setNotification({
          type: 'success',
          message: data.message || 'تنظیمات درگاه با موفقیت در پایگاه داده و سرور ذخیره شد.',
        });
      } else {
        setNotification({
          type: 'error',
          message: data.message || data.error || 'خطا در ذخیره‌سازی تنظیمات در سرور.',
        });
      }
    } catch {
      setNotification({
        type: 'error',
        message: 'خطا در ارتباط با سرور؛ تنظیمات درگاه در سرور ذخیره نشد.',
      });
    } finally {
      setIsSaving(false);
      setTimeout(() => setNotification(null), 6000);
    }
  };

  const handleReset = () => {
    if (confirm('آیا از بازنشانی کلیه تنظیمات درگاه به مقادیر اولیه سیستم اطمینان دارید؟')) {
      const def = farmStore.resetPaymentSettings();
      setSettings({ ...def });
      setNotification({
        type: 'success',
        message: 'تنظیمات به مقادیر پیش‌فرض کارخانه بازنشانی شد.',
      });
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const runZarinpalTest = async () => {
    if (!settings?.zarinpal.merchantId) {
      setZarinpalTestResult({
        success: false,
        message: 'ابتدا کد مرچنت ۳۶ کاراکتری زرین‌پال را وارد فرمایید.',
      });
      return;
    }

    setIsTestingZarinpal(true);
    setZarinpalTestResult(null);

    try {
      const res = await fetch('/api/admin/payment-settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gateway: 'zarinpal',
          merchantId: settings.zarinpal.merchantId,
          sandbox: settings.zarinpal.sandbox,
        }),
      });
      const data = await res.json();
      setZarinpalTestResult({
        success: data.success,
        message: data.message,
        latencyMs: data.latencyMs,
        code: data.code,
      });
    } catch (err: any) {
      setZarinpalTestResult({
        success: false,
        message: `خطای شبکه در تست اتصال: ${err.message || 'سرور پاسخ نداد'}`,
      });
    } finally {
      setIsTestingZarinpal(false);
    }
  };

  const runSnappPayTest = async () => {
    if (!settings?.snapppay.clientId || !settings?.snapppay.clientSecret) {
      setSnappPayTestResult({
        success: false,
        message: 'ابتدا Client ID و Client Secret اسنپ‌پی را وارد فرمایید.',
      });
      return;
    }

    setIsTestingSnappPay(true);
    setSnappPayTestResult(null);

    try {
      const res = await fetch('/api/admin/payment-settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gateway: 'snapppay',
          clientId: settings.snapppay.clientId,
          clientSecret: settings.snapppay.clientSecret,
          baseUrl: settings.snapppay.baseUrl,
        }),
      });
      const data = await res.json();
      setSnappPayTestResult({
        success: data.success,
        message: data.message,
        latencyMs: data.latencyMs,
        statusCode: data.statusCode,
      });
    } catch (err: any) {
      setSnappPayTestResult({
        success: false,
        message: `خطای شبکه در تست وب‌سرویس: ${err.message}`,
      });
    } finally {
      setIsTestingSnappPay(false);
    }
  };

  if (!settings) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-[#2C4A2E] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-gray-500">در حال بارگذاری تنظیمات درگاه...</span>
        </div>
      </div>
    );
  }

  const callbackUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/payment/verify` : 'https://profarm-shiraz.ir/api/payment/verify';
  const isMerchantValidFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    settings.zarinpal.merchantId?.trim() || ''
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E6E1D5]">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-900 font-bold text-[11px] border border-indigo-200">
              شاپرک و درگاه‌های آنلاین
            </span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs text-emerald-700 font-bold">اتصال مستقیم به سیستم بانکی</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#2C4A2E] mt-1.5 flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-[#D4A373]" />
            <span>تنظیمات درگاه پرداخت و اتصالات بانکی</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            پیکربندی مرچنت‌کد شاپرک زرین‌پال، احراز هویت اقساطی اسنپ‌پی، تست زنده ارتباط و روش‌های تسویه‌حساب مشتریان
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          <button
            type="button"
            onClick={handleReset}
            className="px-3.5 py-2.5 rounded-2xl border border-gray-300 text-gray-700 text-xs font-bold hover:bg-gray-100 transition-colors cursor-pointer"
          >
            بازنشانی پیش‌فرض
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#2C4A2E] text-white text-xs font-bold shadow-md hover:bg-[#1E3520] transition-all cursor-pointer disabled:opacity-60"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 animate-spin text-[#D4A373]" />
            ) : (
              <Save className="w-4 h-4 text-[#D4A373]" />
            )}
            <span>{isSaving ? 'در حال ذخیره...' : 'ذخیره و فعال‌سازی درگاه‌ها'}</span>
          </button>
        </div>
      </div>

      {/* Live Notification Bar */}
      {notification && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-3 animate-in fade-in zoom-in-95 shadow-sm ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
              : 'bg-rose-50 text-rose-900 border border-rose-300'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Gateway Status Cards Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: ZarinPal Live Status */}
        <div
          onClick={() => setActiveTab('zarinpal')}
          className={`p-5 rounded-3xl border transition-all cursor-pointer bg-white relative overflow-hidden group shadow-xs ${
            activeTab === 'zarinpal' ? 'border-[#2C4A2E] ring-2 ring-[#2C4A2E]/10' : 'border-[#E6E1D5] hover:border-gray-300'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-center font-black text-xl shadow-xs">
                Z
              </div>
              <div>
                <h3 className="font-black text-sm text-gray-900">زرین‌پال شاپرک</h3>
                <p className="text-[11px] text-gray-500">کارت‌های عضو شتاب</p>
              </div>
            </div>

            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                settings.zarinpal.enabled
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {settings.zarinpal.enabled ? 'فعال' : 'غیرفعال'}
            </span>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-gray-500">وضعیت محیط:</span>
            <span className={`font-bold ${settings.zarinpal.sandbox ? 'text-amber-700' : 'text-emerald-700'}`}>
              {settings.zarinpal.sandbox ? 'سندباکس (تستی)' : 'شاپرک عملیاتی (Live)'}
            </span>
          </div>

          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-gray-500">قالب مرچنت:</span>
            <span className={`font-bold text-[11px] ${isMerchantValidFormat ? 'text-emerald-700' : 'text-rose-600'}`}>
              {isMerchantValidFormat ? 'معتبر (۳۶ حرف)' : 'کد نامعتبر / پیش‌فرض'}
            </span>
          </div>
        </div>

        {/* Card 2: SnappPay Live Status */}
        <div
          onClick={() => setActiveTab('snapppay')}
          className={`p-5 rounded-3xl border transition-all cursor-pointer bg-white relative overflow-hidden group shadow-xs ${
            activeTab === 'snapppay' ? 'border-[#2C4A2E] ring-2 ring-[#2C4A2E]/10' : 'border-[#E6E1D5] hover:border-gray-300'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#00D170]/10 border border-[#00D170]/30 text-[#00D170] flex items-center justify-center font-black text-xl shadow-xs">
                S
              </div>
              <div>
                <h3 className="font-black text-sm text-gray-900">اسنپ‌پی (BNPL)</h3>
                <p className="text-[11px] text-gray-500">۴ قسط بدون کارمزد</p>
              </div>
            </div>

            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                settings.snapppay.enabled
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {settings.snapppay.enabled ? 'فعال' : 'غیرفعال'}
            </span>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-gray-500">حداقل سفارش:</span>
            <span className="font-bold text-gray-800 font-mono">
              {formatToman(settings.snapppay.minAmount)}
            </span>
          </div>

          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-gray-500">کلیدهای اتصال:</span>
            <span
              className={`font-bold text-[11px] ${
                settings.snapppay.clientId && settings.snapppay.clientSecret
                  ? 'text-emerald-700'
                  : 'text-amber-700'
              }`}
            >
              {settings.snapppay.clientId && settings.snapppay.clientSecret
                ? 'پیکربندی‌شده'
                : 'نیاز به تنظیم'}
            </span>
          </div>
        </div>

        {/* Card 3: General & Cash on delivery */}
        <div
          onClick={() => setActiveTab('general')}
          className={`p-5 rounded-3xl border transition-all cursor-pointer bg-white relative overflow-hidden group shadow-xs ${
            activeTab === 'general' ? 'border-[#2C4A2E] ring-2 ring-[#2C4A2E]/10' : 'border-[#E6E1D5] hover:border-gray-300'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 flex items-center justify-center shadow-xs">
                <ShieldCheck className="w-6 h-6 text-purple-700" />
              </div>
              <div>
                <h3 className="font-black text-sm text-gray-900">تسویه و پرداخت در محل</h3>
                <p className="text-[11px] text-gray-500">پیک اختصاصی شیراز</p>
              </div>
            </div>

            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
              تومان
            </span>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-gray-500">کارت‌خوان در محل:</span>
            <span className={`font-bold ${settings.general.allowCashOnDelivery ? 'text-emerald-700' : 'text-gray-500'}`}>
              {settings.general.allowCashOnDelivery ? 'فعال (کارت‌خوان پیک)' : 'غیرفعال (فقط آنلاین)'}
            </span>
          </div>

          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-gray-500">مهلت پرداخت فاکتور:</span>
            <span className="font-bold text-gray-800">
              {toPersianDigits(settings.general.paymentTimeoutMinutes)} دقیقه
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-[#E6E1D5] pb-px overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('zarinpal')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-black border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'zarinpal'
              ? 'border-[#2C4A2E] text-[#2C4A2E] bg-white rounded-t-2xl shadow-xs'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <CreditCard className="w-4 h-4 text-[#D4A373]" />
          <span>درگاه پرداخت زرین‌پال (شاپرک)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('snapppay')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-black border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'snapppay'
              ? 'border-[#00D170] text-emerald-800 bg-white rounded-t-2xl shadow-xs'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <div className="w-4 h-4 rounded bg-[#00D170] text-white flex items-center justify-center text-[10px] font-black">
            S
          </div>
          <span>درگاه اقساطی اسنپ‌پی (BNPL)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-black border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'general'
              ? 'border-purple-700 text-purple-900 bg-white rounded-t-2xl shadow-xs'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Zap className="w-4 h-4 text-purple-600" />
          <span>تنظیمات عمومی تسویه و انقضا</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('guide')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-black border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'guide'
              ? 'border-amber-600 text-amber-900 bg-white rounded-t-2xl shadow-xs'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <HelpCircle className="w-4 h-4 text-amber-600" />
          <span>راهنمای اتصال و دریافت درگاه</span>
        </button>
      </div>

      {/* Tab 1: ZarinPal Configuration */}
      {activeTab === 'zarinpal' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E6E1D5] shadow-farm space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-black text-gray-900 flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                <span>پیکربندی درگاه زرین‌پال شاپرک</span>
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                این درگاه پرداخت‌های مستقیم شتابی را از طریق سوییچ رسمی شاپرک پردازش می‌نماید.
              </p>
            </div>

            {/* Enable/Disable Switch */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-gray-700">وضعیت درگاه زرین‌پال:</span>
              <button
                type="button"
                onClick={() =>
                  setSettings({
                    ...settings,
                    zarinpal: { ...settings.zarinpal, enabled: !settings.zarinpal.enabled },
                  })
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  settings.zarinpal.enabled ? 'bg-emerald-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    settings.zarinpal.enabled ? '-translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className={`text-xs font-black ${settings.zarinpal.enabled ? 'text-emerald-700' : 'text-gray-400'}`}>
                {settings.zarinpal.enabled ? 'فعال' : 'غیرفعال'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Merchant ID Input */}
            <div className="space-y-2 lg:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-gray-800 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  <span>کد پذیرنده اختصاصی (Merchant ID ۳۶ کاراکتری):</span>
                  <span className="text-rose-600">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowZarinpalMerchant(!showZarinpalMerchant)}
                    className="text-[11px] font-bold text-gray-500 hover:text-gray-800 flex items-center gap-1 cursor-pointer"
                  >
                    {showZarinpalMerchant ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>مخفی‌سازی</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>نمایش کد</span>
                      </>
                    )}
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(settings.zarinpal.merchantId, 'merchant')}
                    className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedField === 'merchant' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">کپی شد</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>کپی مرچنت</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="relative">
                <input
                  type={showZarinpalMerchant ? 'text' : 'password'}
                  value={settings.zarinpal.merchantId}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      zarinpal: { ...settings.zarinpal, merchantId: e.target.value.trim() },
                    })
                  }
                  placeholder="مثال: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  dir="ltr"
                  className={`w-full px-4 py-3 rounded-2xl border text-sm font-mono transition-all outline-hidden ${
                    isMerchantValidFormat
                      ? 'border-emerald-300 bg-emerald-50/20 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'
                      : 'border-gray-300 bg-gray-50/50 focus:border-amber-500 focus:ring-2 focus:ring-amber-100'
                  }`}
                />
                <div className="absolute left-3 top-3">
                  {isMerchantValidFormat ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>فرمت UUID صحیح</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                      ۳۶ کاراکتر مورد نیاز
                    </span>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-gray-500">
                این کد را از پنل کاربری زرین‌پال در بخش «درگاه‌های پرداخت من» پس از تایید هویت و وب‌سایت دریافت می‌کنید.
              </p>
            </div>

            {/* Sandbox vs Live Mode Segmented Selector (Unambiguous in RTL) */}
            <div className="p-4 rounded-2xl border border-gray-200 bg-gray-50/50 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-black text-gray-900">حالت اجرای درگاه زرین‌پال:</h4>
                  <p className="text-xs text-gray-600 mt-0.5">
                    در حالت سندباکس پرداخت‌ها به درگاه تستی هدایت می‌شوند؛ در حالت عملیاتی پرداخت واقعی شاپرک فعال است.
                  </p>
                </div>
                <div
                  role="radiogroup"
                  aria-label="حالت اجرای زرین‌پال"
                  className="inline-flex p-1 rounded-xl bg-gray-200/80 border border-gray-300 shrink-0"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={settings.zarinpal.sandbox}
                    onClick={() =>
                      setSettings({
                        ...settings,
                        zarinpal: { ...settings.zarinpal, sandbox: true },
                      })
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      settings.zarinpal.sandbox
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-gray-700 hover:text-gray-900'
                    }`}
                  >
                    تستی (سندباکس)
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!settings.zarinpal.sandbox}
                    onClick={() =>
                      setSettings({
                        ...settings,
                        zarinpal: { ...settings.zarinpal, sandbox: false },
                      })
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      !settings.zarinpal.sandbox
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'text-gray-700 hover:text-gray-900'
                    }`}
                  >
                    عملیاتی (Live)
                  </button>
                </div>
              </div>

              <div
                className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  settings.zarinpal.sandbox
                    ? 'bg-amber-100/70 text-amber-900 border border-amber-300'
                    : 'bg-emerald-100/70 text-emerald-900 border border-emerald-300'
                }`}
              >
                <Activity className="w-4 h-4 shrink-0" />
                <span>
                  {settings.zarinpal.sandbox
                    ? 'حالت تستی (سندباکس) فعال است - پرداخت با کارت‌های شتاب واقعی انجام نمی‌شود.'
                    : 'حالت لایو (Live) فعال است - متصل به شبکه رسمی شاپرک و تسویه حساب بانکی.'}
                </span>
              </div>
            </div>

            {/* Default Description */}
            <div className="p-4 rounded-2xl border border-gray-200 bg-gray-50/50 space-y-2">
              <label className="text-xs font-black text-gray-800">
                شرح پیش‌فرض تراکنش بانکی:
              </label>
              <input
                type="text"
                value={settings.zarinpal.defaultDescription}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    zarinpal: { ...settings.zarinpal, defaultDescription: e.target.value },
                  })
                }
                placeholder="سفارش محصولات ارگانیک شیراز"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-xs text-gray-900 outline-hidden focus:border-[#2C4A2E]"
              />
              <p className="text-[11px] text-gray-500">
                این عبارت در برگه پرداخت شاپرک به عنوان توضیحات خرید به مشتری نمایش داده می‌شود.
              </p>
            </div>
          </div>

          {/* Connection Test Box */}
          <div className="p-5 rounded-2xl border border-indigo-200 bg-indigo-50/40 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-black text-indigo-950 flex items-center gap-2">
                  <Server className="w-4 h-4 text-indigo-700" />
                  <span>آزمون زنده ارتباط با سرور زرین‌پال (Live Healthcheck)</span>
                </h4>
                <p className="text-[11px] text-indigo-800/80 mt-0.5">
                  ارسال درخواست تست به وب‌سرویس REST v4 جهت بررسی در دسترس بودن سرور و اصالت مرچنت‌کد
                </p>
              </div>

              <button
                type="button"
                onClick={runZarinpalTest}
                disabled={isTestingZarinpal}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-700 text-white text-xs font-bold hover:bg-indigo-800 transition-all cursor-pointer shadow-xs disabled:opacity-50 self-start sm:self-auto"
              >
                {isTestingZarinpal ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-200" />
                ) : (
                  <Zap className="w-4 h-4 text-amber-300" />
                )}
                <span>{isTestingZarinpal ? 'در حال برقراری ارتباط...' : 'تست اتصال به وب‌سرویس'}</span>
              </button>
            </div>

            {zarinpalTestResult && (
              <div
                className={`p-3.5 rounded-xl text-xs font-bold border flex items-start gap-3 animate-in fade-in ${
                  zarinpalTestResult.success
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                    : 'bg-rose-50 text-rose-900 border-rose-300'
                }`}
              >
                {zarinpalTestResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <div>{zarinpalTestResult.message}</div>
                  {zarinpalTestResult.latencyMs !== undefined && (
                    <div className="text-[11px] font-mono text-gray-600 flex items-center gap-2">
                      <span>زمان پاسخ سرور (Latency):</span>
                      <span className="font-bold text-gray-900">{zarinpalTestResult.latencyMs} میلی‌ثانیه</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Callback URL Box */}
          <div className="p-4 rounded-2xl border border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-black text-gray-800 block">آدرس بازگشت (Callback URL) سایت:</span>
              <span className="font-mono text-gray-600 text-[11px] block mt-0.5" dir="ltr">
                {callbackUrl}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(callbackUrl, 'callback')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 transition-colors cursor-pointer self-start sm:self-auto"
            >
              {copiedField === 'callback' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">کپی شد</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-gray-500" />
                  <span>کپی آدرس بازگشت</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: SnappPay Configuration */}
      {activeTab === 'snapppay' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E6E1D5] shadow-farm space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-black text-gray-900 flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-[#00D170]" />
                <span>پیکربندی درگاه اقساطی اسنپ‌پی (BNPL)</span>
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                سرویس خرید اعتباری آنلاین (الان بخر، بعداً پرداخت کن) در ۴ قسط مساوی و بدون کارمزد
              </p>
            </div>

            {/* Enable/Disable Switch */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-gray-700">وضعیت اسنپ‌پی:</span>
              <button
                type="button"
                onClick={() =>
                  setSettings({
                    ...settings,
                    snapppay: { ...settings.snapppay, enabled: !settings.snapppay.enabled },
                  })
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  settings.snapppay.enabled ? 'bg-[#00D170]' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    settings.snapppay.enabled ? '-translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className={`text-xs font-black ${settings.snapppay.enabled ? 'text-emerald-700' : 'text-gray-400'}`}>
                {settings.snapppay.enabled ? 'فعال' : 'غیرفعال'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Client ID */}
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-800 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#00D170]" />
                <span>شناسه کلاینت اسنپ‌پی (Client ID):</span>
                <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={settings.snapppay.clientId}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    snapppay: { ...settings.snapppay, clientId: e.target.value.trim() },
                  })
                }
                placeholder="مثال: profarm_shiraz_prod_client"
                dir="ltr"
                className="w-full px-4 py-3 rounded-2xl border border-gray-300 bg-gray-50/50 text-sm font-mono outline-hidden focus:border-[#00D170] focus:ring-2 focus:ring-[#00D170]/10"
              />
              <p className="text-[11px] text-gray-500">شناسه اختصاصی پذیرنده که توسط تیم سازمانی اسنپ‌پی اعطا می‌شود.</p>
            </div>

            {/* Client Secret */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-gray-800 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#00D170]" />
                  <span>کلید امنیتی اسنپ‌پی (Client Secret):</span>
                  <span className="text-rose-600">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowSnappSecret(!showSnappSecret)}
                  className="text-[11px] font-bold text-gray-500 hover:text-gray-800 flex items-center gap-1 cursor-pointer"
                >
                  {showSnappSecret ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>مخفی‌سازی</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>نمایش کلید</span>
                    </>
                  )}
                </button>
              </div>

              <input
                type={showSnappSecret ? 'text' : 'password'}
                value={settings.snapppay.clientSecret}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    snapppay: { ...settings.snapppay, clientSecret: e.target.value.trim() },
                  })
                }
                placeholder="رمز عبور / کلاینت سکرت امنیتی"
                dir="ltr"
                className="w-full px-4 py-3 rounded-2xl border border-gray-300 bg-gray-50/50 text-sm font-mono outline-hidden focus:border-[#00D170] focus:ring-2 focus:ring-[#00D170]/10"
              />
              <p className="text-[11px] text-gray-500">برای اعتبارسنجی توکن‌های وب‌سرویس Basic Auth استفاده می‌گردد.</p>
            </div>

            {/* Base API URL */}
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-800">
                آدرس وب‌سرویس اسنپ‌پی (Base URL):
              </label>
              <input
                type="text"
                value={settings.snapppay.baseUrl}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    snapppay: { ...settings.snapppay, baseUrl: e.target.value.trim() },
                  })
                }
                placeholder="https://api.snapppay.ir/api/online/v1"
                dir="ltr"
                className="w-full px-4 py-2.5 rounded-2xl border border-gray-300 bg-white text-xs font-mono outline-hidden focus:border-[#00D170]"
              />
              <p className="text-[11px] text-gray-500">
                آدرس سرور رسمی اسنپ‌پی: <code className="font-mono text-emerald-800">https://api.snapppay.ir/api/online/v1</code>
              </p>
            </div>

            {/* Min Amount */}
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-800">
                حداقل مبلغ فاکتور جهت امکان خرید اقساطی (تومان):
              </label>
              <input
                type="number"
                value={settings.snapppay.minAmount}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    snapppay: { ...settings.snapppay, minAmount: Math.max(0, parseInt(e.target.value) || 0) },
                  })
                }
                placeholder="200000"
                className="w-full px-4 py-2.5 rounded-2xl border border-gray-300 bg-white text-xs font-mono outline-hidden focus:border-[#00D170]"
              />
              <p className="text-[11px] text-gray-500">
                سفارش‌های کمتر از این سقف منحصراً از طریق کارت بانکی قابل تسویه خواهند بود.
              </p>
            </div>
          </div>

          {/* Test SnappPay Connection Box */}
          <div className="p-5 rounded-2xl border border-emerald-200 bg-emerald-50/40 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-black text-emerald-950 flex items-center gap-2">
                  <Server className="w-4 h-4 text-emerald-700" />
                  <span>آزمون اعتبار کلیدهای اسنپ‌پی</span>
                </h4>
                <p className="text-[11px] text-emerald-800/80 mt-0.5">
                  ارسال درخواست تست به متد /payment/token جهت اطمینان از دسترسی پذیرنده به شبکه اسنپ‌پی
                </p>
              </div>

              <button
                type="button"
                onClick={runSnappPayTest}
                disabled={isTestingSnappPay}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition-all cursor-pointer shadow-xs disabled:opacity-50 self-start sm:self-auto"
              >
                {isTestingSnappPay ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-200" />
                ) : (
                  <Zap className="w-4 h-4 text-amber-300" />
                )}
                <span>{isTestingSnappPay ? 'در حال اعتبارسنجی...' : 'تست اتصال به اسنپ‌پی'}</span>
              </button>
            </div>

            {snappPayTestResult && (
              <div
                className={`p-3.5 rounded-xl text-xs font-bold border flex items-start gap-3 animate-in fade-in ${
                  snappPayTestResult.success
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                    : 'bg-rose-50 text-rose-900 border-rose-300'
                }`}
              >
                {snappPayTestResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <div>{snappPayTestResult.message}</div>
                  {snappPayTestResult.latencyMs !== undefined && (
                    <div className="text-[11px] font-mono text-gray-600">
                      زمان پاسخ: {snappPayTestResult.latencyMs} میلی‌ثانیه | وضعیت: {snappPayTestResult.statusCode || 'OK'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: General & Cash on Delivery */}
      {activeTab === 'general' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E6E1D5] shadow-farm space-y-6 animate-in fade-in duration-200">
          <div>
            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-purple-600" />
              <span>تنظیمات عمومی تسویه و پرداخت در محل</span>
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              مدیریت واحد پول، امکان پرداخت از طریق کارت‌خوان پیک پروفارم در شیراز و مهلت انقضای سفارش
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cash on Delivery Toggle */}
            <div className="p-5 rounded-2xl border border-gray-200 bg-gray-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-gray-900">پرداخت در محل (کارت‌خوان سیار پیک):</h4>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    مشتریان شهر شیراز می‌توانند هنگام تحویل سفارش با دستگاه پوز سیار تسویه نمایند.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSettings({
                      ...settings,
                      general: {
                        ...settings.general,
                        allowCashOnDelivery: !settings.general.allowCashOnDelivery,
                      },
                    })
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    settings.general.allowCashOnDelivery ? 'bg-purple-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      settings.general.allowCashOnDelivery ? '-translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div
                className={`p-2.5 rounded-xl text-xs font-bold ${
                  settings.general.allowCashOnDelivery
                    ? 'bg-purple-100 text-purple-900'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {settings.general.allowCashOnDelivery
                  ? 'گزینه «پرداخت در محل با کارت‌خوان» در تسویه‌حساب مشتریان فعال است.'
                  : 'گزینه پرداخت در محل غیرفعال است (تسویه منحصراً پیش از ارسال و آنلاین انجام می‌شود).'}
              </div>
            </div>

            {/* Payment Timeout */}
            <div className="p-5 rounded-2xl border border-gray-200 bg-gray-50/50 space-y-2">
              <label className="text-xs font-black text-gray-800">
                مهلت زمان تکمیل پرداخت و رزرو نوبت تحویل (دقیقه):
              </label>
              <input
                type="number"
                value={settings.general.paymentTimeoutMinutes}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    general: {
                      ...settings.general,
                      paymentTimeoutMinutes: Math.max(5, parseInt(e.target.value) || 15),
                    },
                  })
                }
                min={5}
                max={60}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-xs font-mono outline-hidden focus:border-[#2C4A2E]"
              />
              <p className="text-[11px] text-gray-500">
                در صورتی که خریدار ظرف این مدت پرداخت را نهایی نکند، ظرفیت اسلات تحویل و موجودی آزاد می‌شود.
              </p>
            </div>

            {/* Guide Message in Checkout */}
            <div className="lg:col-span-2 space-y-2">
              <label className="text-xs font-black text-gray-800">
                متن پیام اطمینان‌بخش و راهنمای پرداخت به مشتری (در سبد خرید و تسویه‌حساب):
              </label>
              <textarea
                rows={2}
                value={settings.general.guideMessage || ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    general: { ...settings.general, guideMessage: e.target.value },
                  })
                }
                placeholder="پرداخت امن از طریق درگاه رسمی شاپرک با کلیه کارت‌های عضو شتاب"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-xs text-gray-900 outline-hidden focus:border-[#2C4A2E]"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Step-by-Step Gateway Connection Guide */}
      {activeTab === 'guide' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E6E1D5] shadow-farm space-y-6 animate-in fade-in duration-200">
          <div>
            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span>راهنمای دریافت و فعال‌سازی درگاه پرداخت شاپرک در ۳ مرحله</span>
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              مراحل رسمی دریافت درگاه پرداخت برای فروشگاه‌های اینترنتی بر بستر شبکه شاپرک بانک مرکزی
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Step 1 */}
            <div className="p-5 rounded-2xl border border-amber-200 bg-amber-50/50 space-y-3 relative">
              <div className="w-8 h-8 rounded-xl bg-amber-600 text-white font-black text-sm flex items-center justify-center">
                ۱
              </div>
              <h3 className="font-black text-sm text-gray-900">ثبت‌نام در زرین‌پال و احراز هویت</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                وارد وب‌سایت رسمی زرین‌پال (zarinpal.com) شوید و با شماره همراه مدیر سایت ثبت‌نام کنید. مدارک هویتی و شماره شبا بانکی خود را بارگذاری فرمایید.
              </p>
              <a
                href="https://my.zarinpal.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 hover:text-amber-950 mt-2"
              >
                <span>ورود به پنل زرین‌پال من</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Step 2 */}
            <div className="p-5 rounded-2xl border border-emerald-200 bg-emerald-50/50 space-y-3 relative">
              <div className="w-8 h-8 rounded-xl bg-emerald-700 text-white font-black text-sm flex items-center justify-center">
                ۲
              </div>
              <h3 className="font-black text-sm text-gray-900">ایجاد درگاه جدید و ثبت آدرس سایت</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                در منوی «درگاه‌های پرداخت»، گزینه درگاه جدید را انتخاب کنید. آدرس وب‌سایت و اینماد فروشگاه خود را وارد کنید. پس از تایید توسط شاپرک، یک کد مرچنت ۳۶ کاراکتری به شما اعطا خواهد شد.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-5 rounded-2xl border border-indigo-200 bg-indigo-50/50 space-y-3 relative">
              <div className="w-8 h-8 rounded-xl bg-indigo-700 text-white font-black text-sm flex items-center justify-center">
                ۳
              </div>
              <h3 className="font-black text-sm text-gray-900">درج مرچنت در پنل و آزمون اتصال</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                کد ۳۶ کاراکتری دریافتی را در فیلد «کد پذیرنده اختصاصی» در تب اول این صفحه کپی کنید، وضعیت را روی «فعال» قرار دهید و دکمه «تست اتصال به وب‌سرویس» را فشار دهید.
              </p>
            </div>
          </div>

          {/* Important Technical Notices */}
          <div className="p-5 rounded-2xl bg-[#F8F7F4] border border-[#E6E1D5] space-y-3">
            <h4 className="text-xs font-black text-[#2C4A2E] flex items-center gap-2">
              <Info className="w-4 h-4 text-[#D4A373]" />
              <span>نکات امنیتی و فنی شاپرک</span>
            </h4>
            <ul className="text-xs text-gray-600 space-y-2 list-disc list-inside leading-relaxed">
              <li>
                <strong>کد خطای -۱۰ در تست اتصال:</strong> به این معناست که آی‌پی سرور شما در پنل زرین‌پال هنوز تایید نشده است. کافی است آی‌پی سرور هاست خود را در پنل زرین‌پال ثبت فرمایید.
              </li>
              <li>
                <strong>پروتکل HTTPS:</strong> برای هدایت امن مشتریان به شاپرک در محیط عملیاتی، فعال بودن گواهی SSL (پروتکل https) بر روی دامنه الزامی است.
              </li>
              <li>
                <strong>تضمین عدم شارژ تکراری (Idempotency):</strong> سامانه پروفارم به طور هوشمند مجهز به کش اعتبارسنجی یکتای توکن‌های شاپرک است و از هرگونه تراکنش تکراری جلوگیری می‌کند.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
