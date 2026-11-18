import React from 'react';
import Link from 'next/link';
import { FileText, Truck, RefreshCw, CheckCircle2, ArrowRight, Crown, Phone } from 'lucide-react';
import { SITE_CONFIG } from '@/lib/site-config';

export const metadata = {
  title: 'شرایط و قوانین خرید',
  alternates: { canonical: '/terms' },
  description: 'قوانین و ضوابط خرید، زمان‌بندی تحویل با پیک پروفارم در شیراز و ضمانت کیفیت محصولات ارگانیک',
};

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-3xl bg-farm-primary/10 border border-farm-primary/20 text-farm-primary flex items-center justify-center mx-auto">
          <FileText className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-black text-farm-primary">
          شرایط و قوانین خرید از {SITE_CONFIG.brandName}
        </h1>
        <p className="text-sm text-gray-600 max-w-lg mx-auto">
          شفافیت در کیفیت ارگانیک، شرایط ارسال با ناوگان اختصاصی و تضمین رضایت مشتری
        </p>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-farm-border shadow-farm space-y-8 text-sm text-gray-700 leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-farm-primary flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#8A6218]" />
            ۱. محدوده ارسال و ناوگان تحویل
          </h2>
          <p>
            توزیع خرده‌فروشی فرآورده‌های تازه (شامل سبزیجات تازه قصرالدشت، تخم‌مرغ محلی روز، لبنیات سنتی کامفیروز){' '}
            <strong className="text-gray-900">صرفاً مختص مناطق شهری شیراز</strong> بوده و با ناوگان پیک اختصاصی پروفارم انجام می‌شود.
          </p>
          <p>
            سفارش‌های خارج از شهر شیراز فقط به صورت{' '}
            <strong className="text-gray-900">خرید عمده ({SITE_CONFIG.policies.bulkThresholdLabel})</strong>{' '}
            پذیرفته و از طریق باربری مطمئن به سراسر کشور ارسال می‌گردند.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-farm-primary flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-[#8A6218]" />
            ۲. ضمانت سلامت و بازگشت محصولات تازه
          </h2>
          <p>
            تمام محصولات قبل از ارسال توسط کارشناسان کنترل کیفی مزارع بررسی می‌شوند. در صورتی که هریک از محصولات دریافتی دچار شکستگی (مانند تخم‌مرغ)، نقص در بسته‌بندی یا عدم انطباق با استاندارد ارگانیک باشد، مشتریان گرامی می‌توانند ظرف مدت{' '}
            <strong className="text-gray-900">۲۴ ساعت پس از تحویل</strong> از طریق تماس با پشتیبانی (
            <a
              href={`tel:${SITE_CONFIG.contact.supportPhoneTel}`}
              className="font-mono font-bold text-farm-primary hover:underline"
              dir="ltr"
            >
              {SITE_CONFIG.contact.supportPhoneDisplay}
            </a>
            ) یا ثبت درخواست مرجوعی در حساب کاربری نسبت به تعویض یا استرداد کامل وجه اقدام نمایند.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-farm-primary flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[#8A6218]" />
            ۳. زمان‌بندی و بازه‌های تحویل
          </h2>
          <p>
            تحویل سفارشات مطابق با بازه زمانی انتخاب‌شده توسط کاربر در صفحه تسویه‌حساب انجام می‌پذیرد. در صورت عدم حضور تحویل‌گیرنده در بازه مشخص‌شده، هماهنگی بعدی با دریافت هزینه مجدد ارسال انجام خواهد شد.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-farm-primary flex items-center gap-2">
            <Crown className="w-5 h-5 text-[#8A6218]" />
            ۴. قوانین اشتراک‌های پرو و پلاس
          </h2>
          <p>
            مشترکین پلن‌های پرو (PRO) و پلاس (PLUS) از اولویت ظرفیت اختصاصی پیک و تخفیف‌های ویژه روی فرآورده‌ها برخوردار هستند.{' '}
            <strong className="text-gray-900">{SITE_CONFIG.policies.subscriptionRefundLabel}.</strong>
          </p>
        </section>

        <section className="p-4 rounded-2xl bg-farm-bg border border-farm-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-700">
            <Phone className="w-4 h-4 text-farm-primary shrink-0" />
            <span>
              پشتیبانی مشتریان:{' '}
              <strong className="font-mono text-farm-primary" dir="ltr">
                {SITE_CONFIG.contact.supportPhoneDisplay}
              </strong>{' '}
              ({SITE_CONFIG.contact.supportHours})
            </span>
          </div>
          <div className="text-xs text-gray-700">
            واحد فروش عمده:{' '}
            <strong className="font-mono text-farm-primary" dir="ltr">
              {SITE_CONFIG.contact.wholesalePhoneDisplay}
            </strong>
          </div>
        </section>

        <div className="pt-6 border-t border-farm-bg-warm flex items-center justify-between">
          <Link
            href="/"
            className="text-xs font-bold text-farm-primary hover:underline flex items-center gap-1.5"
          >
            <ArrowRight className="w-4 h-4" />
            بازگشت به صفحه اصلی
          </Link>
          <span className="text-xs text-gray-600">{SITE_CONFIG.brandFullName}</span>
        </div>
      </div>
    </div>
  );
}
