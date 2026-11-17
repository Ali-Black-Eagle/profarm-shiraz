'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShoppingBag,
  Sparkles,
  ShieldCheck,
  Menu,
  X,
  LayoutDashboard,
  User as UserIcon,
  Crown,
  ChevronDown,
  Truck,
  Leaf,
  Zap,
  MapPin,
  LogOut,
  Search,
  Home,
  LogIn,
  Phone,
} from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { farmStore } from '@/lib/db-store';
import { toPersianDigits, formatToman } from '@/lib/formatters';

interface HeaderProps {
  onOpenCart?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenCart }) => {
  const pathname = usePathname();

  // Never render public store header or public banner on admin pages
  if (pathname?.startsWith('/admin')) {
    return null;
  }

  const [mounted, setMounted] = useState(false);
  const [bannerText, setBannerText] = useState(
    'توزیع مستقیم مزارع استان فارس به شیراز | تحویل با پیک پروفارم'
  );
  const [bannerLinkText, setBannerLinkText] = useState('عضویت در باشگاه و ارسال روزانه');
  const [subSettings, setSubSettings] = useState(() => farmStore.getSubscriptionSettings());
  const [bannerActive, setBannerActive] = useState(true);
  const { getTotalItemsCount } = useCart();
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setMounted(true);
    try {
      const content = farmStore.getSiteContent();
      if (content?.topBannerText) {
        setBannerText(content.topBannerText);
      }
      if (content?.topBannerLinkText) {
        setBannerLinkText(content.topBannerLinkText);
      }
      if (content?.topBannerActive !== undefined) {
        setBannerActive(content.topBannerActive);
      }
      setSubSettings(farmStore.getSubscriptionSettings());
    } catch {
      // fallback to default
    }
  }, []);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Close mobile drawer on route navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close user account menu on outside click or Escape key
  useEffect(() => {
    if (!userMenuOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [userMenuOpen]);

  // Close user menu on route navigation
  useEffect(() => {
    setUserMenuOpen(false);
  }, [pathname]);

  const cartCount = mounted ? getTotalItemsCount() : 0;
  const isUserLoggedIn = mounted && isAuthenticated && !!user;
  const userTier = isUserLoggedIn ? user?.tier || (user?.isProMember ? 'PRO' : 'FREE') : 'FREE';
  const isAdmin = isUserLoggedIn && user?.role === 'ADMIN';
  const isPro = isUserLoggedIn && !isAdmin && userTier === 'PRO';
  const isPlus = isUserLoggedIn && !isAdmin && userTier === 'PLUS';

  // Base navigation links
  const allNavLinks = [
    { name: 'صفحه اصلی', href: '/' },
    { name: 'محصولات', href: '/products' },
    { name: 'اشتراک پروفارم', href: '/pro' },
    { name: 'خرید عمده (سراسر کشور)', href: '/bulk' },
    { name: 'پنل مدیریت', href: '/admin', badge: 'ادمین', adminOnly: true },
  ];

  // Filter links: Admin link ONLY visible if admin is logged in!
  const navLinks = allNavLinks.filter((link) => {
    if (link.adminOnly) {
      return isAdmin;
    }
    return true;
  });

  const searchResults = React.useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.trim().toLowerCase();
    const allProducts = farmStore.getProducts();
    return allProducts
      .filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query)
      )
      .slice(0, 8);
  }, [searchQuery]);

  return (
    <header className="sticky top-0 z-40 glass-nav border-b border-[#E6E1D5] transition-all">
      {/* Top Announcement Bar - Clean authentic announcements */}
      {bannerActive && (
        <div className="bg-[#2C4A2E] text-[#F3EFE6] text-[11px] sm:text-xs py-1.5 px-3 sm:px-4 text-center flex items-center justify-center gap-2 sm:gap-3 overflow-hidden">
          <span className="flex items-center gap-1.5 truncate max-w-full">
            <Truck className="w-3.5 h-3.5 text-[#D4A373] shrink-0" />
            <span className="truncate">{bannerText}</span>
          </span>
          {bannerLinkText && (
            <>
              <span className="text-[#D4A373] inline-block">•</span>
              <Link
                href="/pro"
                className="inline-flex items-center gap-1 text-[#F3E5AB] hover:underline cursor-pointer font-medium shrink-0"
              >
                <span>{bannerLinkText}</span>
              </Link>
            </>
          )}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-2">
          {/* Logo & Brand */}
          <div className="flex items-center gap-1.5 sm:gap-4 shrink-0 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 sm:p-2 rounded-xl text-[#2C4A2E] hover:bg-[#F3EFE6] transition-colors shrink-0"
              aria-label="منوی اصلی"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>

            <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group shrink-0">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-[#2C4A2E] flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform shrink-0">
                <Leaf className="w-5 h-5 sm:w-6 sm:h-6 text-[#D4A373]" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <span className="text-base sm:text-xl font-black text-[#2C4A2E] tracking-tight">پروفارم</span>
                  <span className="text-[10px] sm:text-xs font-semibold px-1.5 py-0.2 sm:py-0.5 rounded-md bg-[#2C4A2E]/10 text-[#2C4A2E]">
                    شیراز
                  </span>
                </div>
                <span className="text-[9px] sm:text-[11px] text-[#6C757D] font-medium block truncate max-w-[130px] sm:max-w-none">
                  محصولات ارگانیک و محلی فارس
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-7">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium transition-colors relative py-1 flex items-center gap-1.5 ${
                    isActive
                      ? 'text-[#2C4A2E] font-bold'
                      : 'text-[#4A5568] hover:text-[#2C4A2E]'
                  }`}
                >
                  <span>{link.name}</span>
                  {link.badge && (
                    <span className="text-[10px] px-1.5 py-0.2 bg-purple-100 text-purple-900 rounded font-bold">
                      {link.badge}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2C4A2E] rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Action Buttons & Authentic Account State */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Authenticated Account Menu or Guest Login Button */}
            {!isUserLoggedIn ? (
              <Link
                href="/login"
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-[#2C4A2E] text-white hover:bg-[#1E3520] text-xs font-bold transition-all shadow-xs active:scale-98 shrink-0"
                title="ورود به حساب کاربری یا ثبت‌نام"
              >
                <UserIcon className="w-4 h-4" />
                <span className="hidden sm:inline">ورود / ثبت‌نام</span>
                <span className="sm:hidden text-[11px]">ورود</span>
              </Link>
            ) : (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer shrink-0 ${
                    isAdmin
                      ? 'bg-purple-900 text-white border-purple-700'
                      : isPro
                      ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white border-amber-500 shadow-xs'
                      : isPlus
                      ? 'bg-emerald-800 text-white border-emerald-600 shadow-xs'
                      : 'bg-white text-[#2C4A2E] border-[#E6E1D5] hover:bg-[#F9F8F5]'
                  }`}
                >
                  <UserIcon className="w-4 h-4" />
                  {isPro && (
                    <span className="px-1.5 py-0.5 rounded-md bg-white/25 text-[10px] font-black">
                      پرو
                    </span>
                  )}
                  {isPlus && (
                    <span className="px-1.5 py-0.5 rounded-md bg-white/25 text-[10px] font-black">
                      پلاس
                    </span>
                  )}
                  {isAdmin && (
                    <span className="px-1.5 py-0.5 rounded-md bg-amber-400 text-purple-950 text-[10px] font-black">
                      مدیر
                    </span>
                  )}
                  <ChevronDown className="w-3.5 h-3.5 opacity-70 hidden sm:inline" />
                </button>

                {/* Dropdown Menu for Authenticated User */}
                {userMenuOpen && (
                  <div className="absolute left-0 mt-2 w-64 max-w-[85vw] bg-white rounded-2xl shadow-2xl border border-[#E6E1D5] p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-right">
                    <div className="p-3 bg-[#F9F8F5] rounded-xl border border-[#E6E1D5] mb-2">
                      <div className="font-bold text-xs text-[#2C4A2E] truncate">
                        {user?.name || 'کاربر گرامی'}
                      </div>
                      <div className="text-[11px] font-mono text-gray-500 mt-0.5">
                        {toPersianDigits(user?.phone || '')}
                      </div>
                      <div className="text-[10px] font-bold text-emerald-800 mt-1">
                        {isAdmin
                          ? 'مدیر ارشد سیستم'
                          : isPro
                          ? 'مشترک فعال پروفارم پرو'
                          : isPlus
                          ? 'مشترک فعال پروفارم پلاس'
                          : 'کاربر عادی'}
                      </div>
                    </div>

                    <div className="space-y-1 text-xs">
                      <Link
                        href="/account"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 p-2 rounded-xl text-gray-700 hover:bg-[#F3EFE6] font-medium transition-colors"
                      >
                        <UserIcon className="w-4 h-4 text-[#2C4A2E]" />
                        <span>ناحیه کاربری</span>
                      </Link>

                      <Link
                        href="/account?tab=orders"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 p-2 rounded-xl text-gray-700 hover:bg-[#F3EFE6] font-medium transition-colors"
                      >
                        <ShoppingBag className="w-4 h-4 text-emerald-700" />
                        <span>سفارش‌های من</span>
                      </Link>

                      <Link
                        href="/account?tab=addresses"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 p-2 rounded-xl text-gray-700 hover:bg-[#F3EFE6] font-medium transition-colors"
                      >
                        <MapPin className="w-4 h-4 text-amber-700" />
                        <span>آدرس‌های تحویل</span>
                      </Link>

                      {isAdmin && (
                        <Link
                          href="/admin"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 p-2 rounded-xl text-purple-900 bg-purple-50 hover:bg-purple-100 font-bold transition-colors"
                        >
                          <ShieldCheck className="w-4 h-4 text-purple-700" />
                          <span>پنل مدیریت سامانه</span>
                        </Link>
                      )}

                      <div className="pt-2 mt-1 border-t border-gray-100">
                        <button
                          onClick={() => {
                            logout();
                            setUserMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 p-2 rounded-xl text-rose-600 hover:bg-rose-50 font-bold transition-colors cursor-pointer"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>خروج از حساب کاربری</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Search Button */}
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-white border border-[#E6E1D5] text-[#2C4A2E] hover:bg-[#F9F8F5] transition-colors shadow-xs cursor-pointer shrink-0"
              aria-label="جستجوی سریع محصولات"
              title="جستجوی سریع محصولات"
            >
              <Search className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Cart Button */}
            <Link
              href="/cart"
              className="relative flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-white border border-[#E6E1D5] text-[#2C4A2E] hover:bg-[#F9F8F5] transition-colors shadow-xs shrink-0"
              aria-label="سبد خرید"
            >
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-[#E76F51] text-white text-[10px] sm:text-[11px] font-bold flex items-center justify-center shadow-xs">
                  {toPersianDigits(cartCount)}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      {/* Off-Canvas Mobile Drawer (Sliding from Right) */}
      <div className="md:hidden">
        {/* Backdrop Overlay */}
        <div
          onClick={() => setMobileMenuOpen(false)}
          className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity duration-300 ${
            mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          aria-hidden="true"
        />

        {/* Sliding Sheet (Drawer from the Right) */}
        <div
          className={`fixed top-0 bottom-0 right-0 z-50 w-72 sm:w-80 max-w-[85vw] h-full bg-[#FAF8F5] border-l border-[#E6E1D5] shadow-2xl flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            mobileMenuOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
          }`}
          dir="rtl"
        >
          {/* Drawer Top Header */}
          <div className="p-4 border-b border-[#E6E1D5] bg-white flex items-center justify-between shrink-0">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5"
            >
              <div className="w-9 h-9 rounded-xl bg-[#2C4A2E] flex items-center justify-center text-white shadow-xs">
                <Leaf className="w-5 h-5 text-[#D4A373]" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1">
                  <span className="text-base font-black text-[#2C4A2E]">پروفارم</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#2C4A2E]/10 text-[#2C4A2E]">
                    شیراز
                  </span>
                </div>
                <span className="text-[10px] text-gray-500 font-medium">
                  محصولات ارگانیک مزارع فارس
                </span>
              </div>
            </Link>

            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 rounded-xl text-gray-500 hover:text-[#2C4A2E] hover:bg-[#F3EFE6] transition-colors cursor-pointer"
              aria-label="بستن منو"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* User Profile / Login Banner */}
            {!isUserLoggedIn ? (
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#2C4A2E] to-[#1E3520] text-white shadow-md space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center text-white">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold block">حساب کاربری پروفارم</span>
                    <span className="text-[10px] text-emerald-200/90 block">ورود یا ثبت‌نام سریع با پیامک</span>
                  </div>
                </div>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2 px-3 rounded-xl bg-white text-[#2C4A2E] text-xs font-black flex items-center justify-center gap-1.5 shadow-xs hover:bg-emerald-50 transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>ورود به حساب یا ثبت‌نام</span>
                </Link>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-white border border-[#E6E1D5] shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#2C4A2E] text-white flex items-center justify-center text-xs font-black">
                      {user?.name ? user.name[0] : 'U'}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-900 block truncate max-w-[130px]">
                        {user?.name || 'کاربر گرامی'}
                      </span>
                      <span className="text-[10px] font-mono text-gray-500 dir-ltr block text-right">
                        {toPersianDigits(user?.phone || '')}
                      </span>
                    </div>
                  </div>
                  {userTier !== 'FREE' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1">
                      <Crown className="w-3 h-3 text-[#D4AF37]" />
                      <span>{userTier === 'PLUS' ? 'اشتراک پلاس' : 'عضو طلایی'}</span>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-gray-100 text-xs">
                  <Link
                    href="/account"
                    onClick={() => setMobileMenuOpen(false)}
                    className="py-1.5 px-2 rounded-lg bg-gray-50 text-gray-700 font-bold hover:bg-gray-100 text-center transition-colors"
                  >
                    ناحیه کاربری
                  </Link>
                  <button
                    onClick={() => {
                      logout();
                      setMobileMenuOpen(false);
                    }}
                    className="py-1.5 px-2 rounded-lg bg-rose-50 text-rose-700 font-bold hover:bg-rose-100 text-center transition-colors cursor-pointer"
                  >
                    خروج از حساب
                  </button>
                </div>
              </div>
            )}

            {/* Navigation Links */}
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-gray-400 px-2 block mb-1.5">
                بخش‌های اصلی فروشگاه:
              </span>
              {navLinks.map((link) => {
                const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
                const IconComponent =
                  link.href === '/'
                    ? Home
                    : link.href === '/products'
                    ? ShoppingBag
                    : link.href === '/pro'
                    ? Crown
                    : link.href === '/bulk'
                    ? Truck
                    : ShieldCheck;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between py-2.5 px-3 rounded-2xl text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-[#2C4A2E] text-white shadow-xs'
                        : 'text-gray-700 hover:bg-white hover:text-[#2C4A2E]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <IconComponent className={`w-4 h-4 ${isActive ? 'text-[#D4A373]' : 'text-gray-400'}`} />
                      <span>{link.name}</span>
                    </div>
                    {link.badge && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-purple-100 text-purple-900'
                        }`}
                      >
                        {link.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Quick Cart Preview / Link */}
            <div className="pt-2 border-t border-[#E6E1D5]">
              <Link
                href="/cart"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-3 rounded-2xl bg-white border border-[#E6E1D5] hover:border-[#2C4A2E] transition-colors shadow-xs"
              >
                <div className="flex items-center gap-2.5 text-xs font-bold text-gray-800">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#2C4A2E] flex items-center justify-center">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <span>سبد خرید شما</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-[#E76F51] text-white">
                    {toPersianDigits(cartCount)} قلم
                  </span>
                </div>
              </Link>
            </div>
          </div>

          {/* Drawer Footer */}
          <div className="p-3.5 border-t border-[#E6E1D5] bg-white text-center space-y-1 shrink-0">
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-[#2C4A2E]">
              <Truck className="w-3.5 h-3.5 text-[#D4A373]" />
              <span>ارسال مستقیم و اختصاصی در سراسر شیراز</span>
            </div>
            <p className="text-[10px] text-gray-400 font-medium">
              پشتیبانی تلفنی مزارع: <span className="font-mono text-gray-600 font-bold">۰۷۱-۳۶۲۸۰۰۰۰</span>
            </p>
          </div>
        </div>
      </div>

      {/* Quick Search Modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-20 px-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-[#E6E1D5] overflow-hidden flex flex-col max-h-[80vh] text-right">
            <div className="p-4 border-b border-[#E6E1D5] flex items-center gap-3">
              <Search className="w-5 h-5 text-[#2C4A2E] shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder="جستجوی فرآورده‌های ارگانیک شیراز (مانند: عسل، تخم‌مرغ، عرقیات)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs sm:text-sm outline-none bg-transparent placeholder-gray-400 text-gray-800"
              />
              <button
                onClick={() => {
                  setSearchOpen(false);
                  setSearchQuery('');
                }}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 overflow-y-auto divide-y divide-[#F3EFE6] space-y-1 max-h-[60vh]">
              {searchResults.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">
                  {searchQuery.trim()
                    ? 'محصولی مطابق با عبارت جستجو شده در مزرعه یافت نشد.'
                    : 'نام محصول، دسته‌بندی یا ویژگی مورد نظر خود را تایپ کنید.'}
                </div>
              ) : (
                searchResults.map((product) => (
                  <Link
                    key={product.id}
                    href={`/products/${product.slug}`}
                    onClick={() => {
                      setSearchOpen(false);
                      setSearchQuery('');
                    }}
                    className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-[#F9F8F5] transition-colors"
                  >
                    <img
                      src={product.images[0] || '/images/prod-eggs.jpg'}
                      alt={product.title}
                      className="w-12 h-12 rounded-xl object-cover border border-[#E6E1D5] shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate">{product.title}</p>
                      <p className="text-[11px] text-gray-400">{product.category}</p>
                    </div>
                    <span className="text-xs font-bold text-[#2C4A2E] shrink-0">
                      {formatToman(product.price)}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
