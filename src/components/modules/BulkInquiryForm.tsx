'use client';

import React, { useState } from 'react';
import { Package, Send, CheckCircle2, ShieldCheck, MapPin, Building, Phone, User, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SITE_CONFIG } from '@/lib/site-config';

export default function BulkInquiryForm() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [city, setCity] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'name' | 'phone' | 'city' | 'message', string>>>({});

  /** Persian, field-level checks. The browser's own bubbles are disabled (noValidate), so these are the only messages. */
  const validate = () => {
    const errs: Partial<Record<'name' | 'phone' | 'city' | 'message', string>> = {};
    if (!name.trim()) errs.name = 'لطفاً نام و نام خانوادگی متقاضی را وارد نمایید.';
    const digits = phone.trim().replace(/[\s-]/g, '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
    if (!digits) errs.phone = 'لطفاً شماره تماس را وارد نمایید.';
    else if (!/^09\d{9}$/.test(digits)) {
      errs.phone = 'شماره تماس معتبر نیست. نمونه صحیح: ۰۹۱۲۳۴۵۶۷۸۹';
    }
    if (!city.trim()) errs.city = 'لطفاً شهر مقصد ارسال را وارد نمایید.';
    if (!message.trim()) errs.message = 'لطفاً اقلام مورد نیاز و حجم تقریبی سفارش را شرح دهید.';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!validate()) return;
    setIsLoading(true);

    try {
      const res = await fetch('/api/bulk-inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          companyName,
          city,
          message,
        }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data?.success !== false) {
        setIsSubmitted(true);
      } else {
        setSubmitError(
          data?.message ||
            'ثبت درخواست در سرور با خطا مواجه شد. لطفاً مجدداً تلاش کنید یا با واحد فروش عمده تماس بگیرید.'
        );
      }
    } catch {
      setSubmitError(
        'ارتباط با سرور برقرار نشد. لطفاً اتصال اینترنت خود را بررسی کرده و مجدداً ارسال نمایید.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-farm-primary/10 text-farm-primary text-xs font-bold">
          <Package className="w-4 h-4 text-[#D4A373]" />
          <span>تامین سازمانی و باربری عمده مزارع فارس</span>
        </div>
        <h1 className="text-3xl font-black text-farm-primary">
          فرم استعلام و ثبت درخواست سفارش عمده (سراسر کشور)
        </h1>
        <p className="text-xs sm:text-sm text-gray-600 max-w-xl mx-auto leading-relaxed">
          اگر در خارج از شیراز هستید یا برای رستوران‌ها، هایپرمارکت‌ها و فروشگاه‌های ارگانیک قصد تامین
          عمده تخم‌مرغ، عسل، عرقیات یا محصولات مزارع فارس را دارید، فرم زیر را تکمیل نمایید.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Left Form */}
        <div className="md:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-farm-border shadow-farm">
          {isSubmitted ? (
            <div className="text-center py-10 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-farm-primary">درخواست شما با موفقیت ثبت شد</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                کارشناسان بازرگانی عمده مزارع شیراز حداکثر ظرف ۴ ساعت کاری جهت استعلام قیمت کانتینری و
                هماهنگی باربری با شماره شما تماس خواهند گرفت.
              </p>
            </div>
          ) : (
            <form noValidate onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label htmlFor="bulk-1" className="block text-gray-700 font-semibold mb-1.5">
                  نام و نام خانوادگی متقاضی:
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input id="bulk-1"
                    type="text"
                    required
                    aria-invalid={Boolean(fieldErrors.name)}
                    aria-describedby={fieldErrors.name ? 'bulk-1-error' : undefined}
                    placeholder="مثال: مهندس رادمهر"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setFieldErrors((p) => ({ ...p, name: undefined }));
                    }}
                    className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-farm-border bg-farm-bg focus:bg-white focus:outline-none focus:border-farm-primary"
                  />
                </div>
                {fieldErrors.name && (
                  <p id="bulk-1-error" role="alert" className="mt-1 text-xs font-bold text-rose-700">{fieldErrors.name}</p>
                )}
              </div>

              <div>
                <label htmlFor="bulk-2" className="block text-gray-700 font-semibold mb-1.5">
                  شماره تماس مستقیم / همراه:
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input id="bulk-2"
                    type="tel"
                    required
                    aria-invalid={Boolean(fieldErrors.phone)}
                    aria-describedby={fieldErrors.phone ? 'bulk-2-error' : undefined}
                    placeholder="0912xxxxxxx"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setFieldErrors((p) => ({ ...p, phone: undefined }));
                    }}
                    className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-farm-border bg-farm-bg focus:bg-white focus:outline-none focus:border-farm-primary text-left"
                    dir="ltr"
                  />
                </div>
                {fieldErrors.phone && (
                  <p id="bulk-2-error" role="alert" className="mt-1 text-xs font-bold text-rose-700">{fieldErrors.phone}</p>
                )}
              </div>

              <div>
                <label htmlFor="bulk-3" className="block text-gray-700 font-semibold mb-1.5">
                  نام مجموعه، فروشگاه یا رستوران:
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input id="bulk-3"
                    type="text"
                    placeholder="مثال: هایپرمارکت پالادیوم تهران / رستوران صوفی"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-farm-border bg-farm-bg focus:bg-white focus:outline-none focus:border-farm-primary"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="bulk-4" className="block text-gray-700 font-semibold mb-1.5">شهر مقصد ارسال:</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input id="bulk-4"
                    type="text"
                    required
                    aria-invalid={Boolean(fieldErrors.city)}
                    aria-describedby={fieldErrors.city ? 'bulk-4-error' : undefined}
                    placeholder="مثال: تهران، اصفهان، بوشهر، بندرعباس..."
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      setFieldErrors((p) => ({ ...p, city: undefined }));
                    }}
                    className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-farm-border bg-farm-bg focus:bg-white focus:outline-none focus:border-farm-primary"
                  />
                </div>
                {fieldErrors.city && (
                  <p id="bulk-4-error" role="alert" className="mt-1 text-xs font-bold text-rose-700">{fieldErrors.city}</p>
                )}
              </div>

              <div>
                <label htmlFor="bulk-5" className="block text-gray-700 font-semibold mb-1.5">
                  اقلام مورد نیاز و حجم تقریبی سفارش:
                </label>
                <textarea id="bulk-5"
                  rows={4}
                  required
                  aria-invalid={Boolean(fieldErrors.message)}
                  aria-describedby={fieldErrors.message ? 'bulk-5-error' : undefined}
                  placeholder="مثال: ۵۰ کارتن تخم‌مرغ کامفیروز و ۱۰۰ شیشه عسل وحشی دشت ارژن..."
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    setFieldErrors((p) => ({ ...p, message: undefined }));
                  }}
                  className="w-full p-3 rounded-xl border border-farm-border bg-farm-bg focus:bg-white focus:outline-none focus:border-farm-primary"
                />
                {fieldErrors.message && (
                  <p id="bulk-5-error" role="alert" className="mt-1 text-xs font-bold text-rose-700">{fieldErrors.message}</p>
                )}
              </div>

              {submitError && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isLoading}
                className="w-full"
              >
                <Send className="w-4 h-4 ml-1.5" />
                <span>ارسال استعلام به واحد فروش عمده مزارع شیراز</span>
              </Button>
            </form>
          )}
        </div>

        {/* Right Info Cards */}
        <div className="md:col-span-5 space-y-4 text-xs text-gray-600">
          <div className="bg-farm-bg-warm rounded-3xl p-6 border border-farm-border space-y-3">
            <h4 className="font-bold text-sm text-farm-primary">شرایط توزیع عمده به سراسر کشور</h4>
            <ul className="space-y-2.5 list-disc list-inside leading-relaxed text-gray-700">
              <li>حداقل تیراژ سفارش عمده: {SITE_CONFIG.policies.bulkThresholdLabel}</li>
              <li>{SITE_CONFIG.policies.bulkDeliveryScope}</li>
              <li>صدور پیش‌فاکتور رسمی برای فروشگاه‌ها، رستوران‌ها و شرکت‌ها</li>
              <li>تخفیفات پله‌ای برای خریدهای ماهانه و قراردادی</li>
            </ul>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-farm-border shadow-xs space-y-2">
            <h4 className="font-bold text-sm text-farm-primary">شماره مستقیم واحد فروش عمده</h4>
            <p className="text-gray-600">{SITE_CONFIG.contact.wholesaleHours}</p>
            <a
              href={`tel:${SITE_CONFIG.contact.wholesalePhoneTel}`}
              className="inline-block text-base font-black text-farm-primary pt-1 hover:underline"
              dir="ltr"
            >
              {SITE_CONFIG.contact.wholesalePhoneDisplay}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
