'use client';

import React, { useState } from 'react';
import { Package, Send, CheckCircle2, ShieldCheck, MapPin, Building, Phone, User, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { farmStore } from '@/lib/db-store';
import { SITE_CONFIG } from '@/lib/site-config';

export default function BulkOrderInquiryPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [city, setCity] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSubmitError(null);

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
        if (data?.inquiry) {
          farmStore.createBulkInquiry(data.inquiry);
        }
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
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#2C4A2E]/10 text-[#2C4A2E] text-xs font-bold">
          <Package className="w-4 h-4 text-[#D4A373]" />
          <span>تامین سازمانی و باربری عمده مزارع فارس</span>
        </div>
        <h1 className="text-3xl font-black text-[#2C4A2E]">
          فرم استعلام و ثبت درخواست سفارش عمده (سراسر کشور)
        </h1>
        <p className="text-xs sm:text-sm text-gray-600 max-w-xl mx-auto leading-relaxed">
          اگر در خارج از شیراز هستید یا برای رستوران‌ها، هایپرمارکت‌ها و فروشگاه‌های ارگانیک قصد تامین
          عمده تخم‌مرغ، عسل، عرقیات یا محصولات مزارع فارس را دارید، فرم زیر را تکمیل نمایید.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Left Form */}
        <div className="md:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-[#E6E1D5] shadow-farm">
          {isSubmitted ? (
            <div className="text-center py-10 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-[#2C4A2E]">درخواست شما با موفقیت ثبت شد</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                کارشناسان بازرگانی عمده مزارع شیراز حداکثر ظرف ۴ ساعت کاری جهت استعلام قیمت کانتینری و
                هماهنگی باربری با شماره شما تماس خواهند گرفت.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-700 font-semibold mb-1.5">
                  نام و نام خانوادگی متقاضی:
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    required
                    placeholder="مثال: مهندس رادمهر"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1.5">
                  شماره تماس مستقیم / همراه:
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="tel"
                    required
                    placeholder="0912xxxxxxx"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E] text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1.5">
                  نام مجموعه، فروشگاه یا رستوران:
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="مثال: هایپرمارکت پالادیوم تهران / رستوران صوفی"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1.5">شهر مقصد ارسال:</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    required
                    placeholder="مثال: تهران، اصفهان، بوشهر، بندرعباس..."
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1.5">
                  اقلام مورد نیاز و حجم تقریبی سفارش:
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="مثال: ۵۰ کارتن تخم‌مرغ کامفیروز و ۱۰۰ شیشه عسل وحشی دشت ارژن..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E]"
                />
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
          <div className="bg-[#F3EFE6] rounded-3xl p-6 border border-[#E6E1D5] space-y-3">
            <h4 className="font-bold text-sm text-[#2C4A2E]">شرایط توزیع عمده به سراسر کشور</h4>
            <ul className="space-y-2.5 list-disc list-inside leading-relaxed text-gray-700">
              <li>حداقل تیراژ سفارش عمده: {SITE_CONFIG.policies.bulkThresholdLabel}</li>
              <li>{SITE_CONFIG.policies.bulkDeliveryScope}</li>
              <li>صدور پیش‌فاکتور رسمی برای فروشگاه‌ها، رستوران‌ها و شرکت‌ها</li>
              <li>تخفیفات پله‌ای برای خریدهای ماهانه و قراردادی</li>
            </ul>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-[#E6E1D5] shadow-xs space-y-2">
            <h4 className="font-bold text-sm text-[#2C4A2E]">شماره مستقیم واحد فروش عمده</h4>
            <p className="text-gray-600">{SITE_CONFIG.contact.wholesaleHours}</p>
            <a
              href={`tel:${SITE_CONFIG.contact.wholesalePhoneTel}`}
              className="inline-block text-base font-black text-[#2C4A2E] pt-1 hover:underline"
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
