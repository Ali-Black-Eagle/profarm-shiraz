'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Leaf,
  ShieldCheck,
  Truck,
  Phone,
  MapPin,
  Clock,
  Heart,
  Share2,
  Send,
  MessageCircle,
} from 'lucide-react';
import { farmStore, DEFAULT_SITE_CONTENT } from '@/lib/db-store';
import { SiteContent } from '@/types';

export const Footer: React.FC = () => {
  const pathname = usePathname();
  const [content, setContent] = useState<SiteContent>({ ...DEFAULT_SITE_CONTENT });

  useEffect(() => {
    setContent(farmStore.getSiteContent());
  }, []);

  // Never render public store footer on admin pages (placed safely AFTER all hooks)
  if (pathname?.startsWith('/admin')) {
    return null;
  }

  return (
    <footer className="bg-[#1E3520] text-[#F3EFE6] border-t border-[#2C4A2E] mt-20">
      {/* Guarantees bar */}
      <div className="border-b border-[#2C4A2E]/80 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#2C4A2E]/50">
              <div className="w-12 h-12 rounded-xl bg-[#D4A373]/20 flex items-center justify-center text-[#D4A373]">
                <Leaf className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">۱۰۰٪ بومی و ارگانیک</h4>
                <p className="text-xs text-gray-300 mt-0.5">
                  تغذیه پاک از مزارع دشت ارژن، کامفیروز و باغات شیراز
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#2C4A2E]/50">
              <div className="w-12 h-12 rounded-xl bg-[#D4A373]/20 flex items-center justify-center text-[#D4A373]">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">پیک پروفارم در شیراز</h4>
                <p className="text-xs text-gray-300 mt-0.5">
                  ارسال مستقیم و سریع محصولات از مزرعه تا درب منزل
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#2C4A2E]/50">
              <div className="w-12 h-12 rounded-xl bg-[#D4A373]/20 flex items-center justify-center text-[#D4A373]">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">بسته‌بندی شناسنامه‌دار</h4>
                <p className="text-xs text-gray-300 mt-0.5">
                  پکیج‌های استاندارد بهداشتی با تاریخ برداشت و وزن دقیق
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Col 1: About */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-[#D4A373] flex items-center justify-center text-[#1E3520] font-black">
                <Leaf className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold text-white">پروفارم شیراز</span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              {content.footerAboutText ||
                'پلتفرم تخصصی عرضه مستقیم فرآورده‌های ارگانیک، تخم‌مرغ محلی، عسل وحشی، سبزیجات تازه و لبنیات سنتی باغات و مزارع اصیل استان فارس.'}
            </p>

            {/* Social channels */}
            <div className="pt-2">
              <span className="block text-[11px] font-bold text-[#D4A373] mb-2">ما را در شبکه‌های اجتماعی دنبال کنید:</span>
              <div className="flex items-center gap-2">
                {content.socialInstagram && (
                  <a
                    href={content.socialInstagram}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-[#2C4A2E] hover:bg-[#D4A373] hover:text-[#1E3520] transition-colors text-[11px] font-bold"
                  >
                    اینستاگرام
                  </a>
                )}
                {content.socialTelegram && (
                  <a
                    href={content.socialTelegram}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-[#2C4A2E] hover:bg-[#D4A373] hover:text-[#1E3520] transition-colors text-[11px] font-bold"
                  >
                    تلگرام
                  </a>
                )}
                {content.socialEitaa && (
                  <a
                    href={content.socialEitaa}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-[#2C4A2E] hover:bg-[#D4A373] hover:text-[#1E3520] transition-colors text-[11px] font-bold"
                  >
                    ایتا
                  </a>
                )}
                {content.socialWhatsapp && !content.socialWhatsapp.includes('989170000000') && (
                  <a
                    href={content.socialWhatsapp}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-[#2C4A2E] hover:bg-[#D4A373] hover:text-[#1E3520] transition-colors text-xs font-bold"
                  >
                    واتساپ
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div className="space-y-3">
            <h5 className="text-sm font-bold text-white">دسترسی سریع</h5>
            <ul className="space-y-2 text-xs text-gray-300">
              <li>
                <Link href="/products" className="hover:text-[#D4A373] transition-colors">
                  همه محصولات ارگانیک
                </Link>
              </li>
              <li>
                <Link href="/pro" className="hover:text-[#D4A373] transition-colors">
                  عضویت پرو و ارسال روزانه
                </Link>
              </li>
              <li>
                <Link href="/bulk" className="hover:text-[#D4A373] transition-colors">
                  استعلام و خرید عمده (خارج از شیراز)
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-[#D4A373] transition-colors">
                  قوانین و شرایط خرید
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-[#D4A373] transition-colors">
                  حفظ حریم خصوصی
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Shiraz Logistics */}
          <div className="space-y-3">
            <h5 className="text-sm font-bold text-white">قوانین و روزهای توزیع</h5>
            <div className="space-y-2 text-xs text-gray-300">
              <p>
                <strong className="text-white">کاربران عادی:</strong> تحویل یکشنبه‌ها و چهارشنبه‌ها
              </p>
              <p>
                <strong className="text-white">مشترکین پرو:</strong> تحویل همه روزه (شنبه تا پنج‌شنبه)
              </p>
              <p className="text-[11px] text-amber-200/90 pt-1">
                * توزیع خرده‌فروشی صرفاً در محدوده شهر شیراز انجام می‌پذیرد.
              </p>
            </div>
          </div>

          {/* Col 4: Contact & Address */}
          <div className="space-y-3">
            <h5 className="text-sm font-bold text-white">تماس با انبار مرکزی شیراز</h5>
            <div className="space-y-2.5 text-xs text-gray-300">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#D4A373] shrink-0 mt-0.5" />
                <span>{content.supportAddress || 'شیراز، بلوار ارم، مجتمع مزارع ارگانیک فارس'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#D4A373] shrink-0" />
                <span dir="ltr">{content.supportPhone || '۰۷۱-۳۲۲۲۰۰۰۰'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#D4A373] shrink-0" />
                <span>{content.supportHours || 'پاسخگویی شنبه تا پنج‌شنبه: ۸ الی ۲۰'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-[#2C4A2E] mt-10 pt-6 flex flex-col md:flex-row items-center justify-between text-xs text-gray-400 gap-4">
          <p>© ۲۰۲۶ مزارع ارگانیک پروفارم شیراز. تمامی حقوق محفوظ است.</p>
          <p className="flex items-center gap-1 text-gray-400">
            <span>توسعه یافته با عشق به طبیعت شیراز</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
          </p>
        </div>
      </div>
    </footer>
  );
};
