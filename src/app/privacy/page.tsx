import React from 'react';
import Link from 'next/link';
import { Shield, Lock, Eye, CheckCircle2, ArrowRight } from 'lucide-react';
import { SITE_CONFIG } from '@/lib/site-config';

export const metadata = {
  title: 'سیاست حفظ حریم خصوصی',
  description: 'قوانین و تعهدات مزارع ارگانیک پروفارم شیراز در راستای حفاظت از اطلاعات و حریم خصوصی کاربران',
};

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-3xl bg-farm-primary/10 border border-farm-primary/20 text-farm-primary flex items-center justify-center mx-auto">
          <Shield className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-black text-farm-primary">
          سیاست حفظ حریم خصوصی کاربران
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 max-w-lg mx-auto">
          تعهد مزارع ارگانیک پروفارم شیراز به حفظ امنیت اطلاعات هویتی و تراکنش‌های بانکی مشتریان
        </p>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-farm-border shadow-farm space-y-8 text-sm text-gray-700 leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-farm-primary flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#D4A373]" />
            ۱. جمع‌آوری و استفاده از اطلاعات شخصی
          </h2>
          <p>
            مجموعه پروفارم شیراز برای پردازش سفارشات، ارسال با پیک اختصاصی و ارائه خدمات اشتراک، اطلاعاتی نظیر شماره تلفن همراه، نام تحویل‌گیرنده، نشانی پستی دقیق در شیراز و کد پستی را دریافت می‌کند. این اطلاعات صرفاً جهت تحویل بدون نقص محصولات ارگانیک و صدور فاکتور رسمی به کار گرفته می‌شود.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-farm-primary flex items-center gap-2">
            <Eye className="w-5 h-5 text-[#D4A373]" />
            ۲. امنیت داده‌ها و اطلاعات پرداخت بانکی
          </h2>
          <p>
            تمامی تراکنش‌های مالی به صورت مستقیم از طریق درگاه‌های امن شاپرک بانک مرکزی (زرین‌پال و اسنپ‌پی) صورت می‌پذیرد. مزارع پروفارم شیراز هیچ‌گونه دسترسی به اطلاعات کارت بانکی، رمز دوم یا CVV2 مشتریان نداشته و این اطلاعات هرگز در سرورهای ما ذخیره نمی‌شوند. نشست‌های کاربری با استانداردهای مدرن رمزنگاری Session Token محافظت می‌گردند.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-farm-primary flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[#D4A373]" />
            ۳. عدم اشتراک‌گذاری اطلاعات با اشخاص ثالث
          </h2>
          <p>
            اطلاعات کاربران امانت مزارع پروفارم است و تحت هیچ شرایطی به سازمان‌ها، شرکت‌های تبلیغاتی یا اشخاص ثالث فروخته و واگذار نخواهد شد، مگر با حکم مستقیم مراجع قضایی ذی‌صلاح جمهوری اسلامی ایران.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-farm-primary flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#D4A373]" />
            ۴. تماس و پشتیبانی حریم خصوصی
          </h2>
          <p>
            در صورت هرگونه سوال یا درخواست حذف حساب کاربری و سوابق نشانی، می‌توانید از طریق شماره پشتیبانی {SITE_CONFIG.contact.supportPhoneDisplay} با کارشناسان حقوقی و پشتیبانی مزارع پروفارم در تماس باشید.
          </p>
        </section>

        <div className="pt-6 border-t border-farm-bg-warm flex items-center justify-between">
          <Link
            href="/"
            className="text-xs font-bold text-farm-primary hover:underline flex items-center gap-1.5"
          >
            <ArrowRight className="w-4 h-4" />
            بازگشت به صفحه اصلی
          </Link>
          <span className="text-xs text-gray-600">آخرین ویرایش: شهریور ۱۴۰۵</span>
        </div>
      </div>
    </div>
  );
}
