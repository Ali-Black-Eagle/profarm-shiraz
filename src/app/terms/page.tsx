import React from 'react';
import Link from 'next/link';
import { FileText, Truck, RefreshCw, CheckCircle2, ArrowRight, AlertTriangle } from 'lucide-react';

export const metadata = {
  title: 'شرایط و قوانین خرید',
  description: 'قوانین و ضوابط خرید، زمان‌بندی تحویل با پیک پروفارم در شیراز و ضمانت کیفیت محصولات ارگانیک',
};

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-3xl bg-[#2C4A2E]/10 border border-[#2C4A2E]/20 text-[#2C4A2E] flex items-center justify-center mx-auto">
          <FileText className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-black text-[#2C4A2E]">
          شرایط و قوانین خرید از پروفارم شیراز
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 max-w-lg mx-auto">
          شفافیت در کیفیت ارگانیک، شرایط ارسال با ناوگان اختصاصی و تضمین رضایت مشتری
        </p>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-[#E6E1D5] shadow-farm space-y-8 text-sm text-gray-700 leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[#2C4A2E] flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#D4A373]" />
            ۱. محدوده ارسال و ناوگان تحویل
          </h2>
          <p>
            توزیع خرده‌فروشی فرآورده‌های تازه (شامل سبزیجات تازه قصرالدشت، تخم‌مرغ محلی روز، لبنیات سنتی کامفیروز) **صرفاً مختص مناطق شهری شیراز** بوده و با ناوگان پیک اختصاصی پروفارم انجام می‌شود.
          </p>
          <p>
            سفارش‌های خارج از شهر شیراز فقط به صورت **خرید عمده** (با حداقل ۱۰ قلم یا سبد خرید بالای ۵ میلیون تومان) پذیرفته و از طریق باربری مطمئن به سراسر کشور ارسال می‌گردند.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[#2C4A2E] flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-[#D4A373]" />
            ۲. ضمانت سلامت و بازگشت کالا
          </h2>
          <p>
            تمام محصولات قبل از ارسال توسط کارشناسان کنترل کیفی مزارع بررسی می‌شوند. در صورتی که هریک از محصولات دریافتی دچار شکستگی (مانند تخم‌مرغ)، نقص در بسته‌بندی یا عدم انطباق با استاندارد ارگانیک باشد، مشتریان گرامی می‌توانند ظرف مدت ۲۴ ساعت پس از تحویل، از طریق تماس تلفنی یا ثبت در حساب کاربری نسبت به تعویض یا استرداد کامل وجه اقدام نمایند.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[#2C4A2E] flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[#D4A373]" />
            ۳. زمان‌بندی و بازه‌های تحویل
          </h2>
          <p>
            تحویل سفارشات مطابق با بازه زمانی انتخاب‌شده توسط کاربر در صفحه تسویه‌حساب انجام می‌پذیرد. در صورت عدم حضور تحویل‌گیرنده در بازه مشخص‌شده، هماهنگی بعدی با دریافت هزینه مجدد ارسال انجام خواهد شد.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[#2C4A2E] flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-[#D4A373]" />
            ۴. اشتراک طلایی پروفارم
          </h2>
          <p>
            مشترکین پلن‌های پرو (PRO) و پلاس (PLUS) از اولویت ظرفیت اختصاصی پیک و تخفیف‌های ویژه روی فرآورده‌ها برخوردار هستند. تمدید یا ارتقای اشتراک از طریق پنل کاربری در هر زمان امکان‌پذیر است.
          </p>
        </section>

        <div className="pt-6 border-t border-[#F3EFE6] flex items-center justify-between">
          <Link
            href="/"
            className="text-xs font-bold text-[#2C4A2E] hover:underline flex items-center gap-1.5"
          >
            <ArrowRight className="w-4 h-4" />
            بازگشت به صفحه اصلی
          </Link>
          <span className="text-xs text-gray-400">آخرین ویرایش: شهریور ۱۴۰۵</span>
        </div>
      </div>
    </div>
  );
}
