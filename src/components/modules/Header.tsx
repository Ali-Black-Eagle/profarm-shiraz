'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
import { SITE_CONFIG } from '@/lib/site-config';

interface HeaderProps {
  onOpenCart?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenCart }) => {
  const pathname = usePathname();
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
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    requestAnimationFrame(() => menuButtonRef.current?.focus());
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery('');
    requestAnimationFrame(() => searchButtonRef.current?.focus());
  };

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

  // Lock body scroll when mobile drawer or search modal is open
  useEffect(() => {
    if (mobileMenuOpen || searchOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen, searchOpen]);

  // Close overlays on route navigation
  useEffect(() => {
    setMobileMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  // Close mobile drawer or search modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (searchOpen) {
          closeSearch();
        } else if (mobileMenuOpen) {
          closeMobileMenu();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen, mobileMenuOpen]);

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

  // Never render public store header or public banner on admin pages (placed safely AFTER all hooks)
  if (pathname?.startsWith('/admin')) {
    return null;
  }

  return (
    <>
      <header className="sticky top-0 z-40 glass-nav border-b border-farm-border transition-all">
        {/* Top Announcement Bar - Clean authentic announcements */}
        {bannerActive && (
          <div className="bg-farm-primary text-farm-bg-warm text-xs py-1.5 px-3 sm:px-4 text-center flex items-center justify-center gap-2 sm:gap-3 overflow-hidden">
            <span className="flex items-center gap-1.5 truncate max-w-full">
              <Truck className="w-3.5 h-3.5 text-farm-accent shrink-0" />
              <span className="truncate">{bannerText}</span>
            </span>
            {bannerLinkText && (
              <>
                <span className="text-farm-accent inline-block" aria-hidden="true">•</span>
                <Link
                  href="/pro"
                  className="inline-flex items-center gap-1 text-[#F3E5AB] hover:underline cursor-pointer font-semibold shrink-0"
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
                ref={menuButtonRef}
                type="button"
                onClick={() => (mobileMenuOpen ? closeMobileMenu() : setMobileMenuOpen(true))}
                className="md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-farm-primary hover:bg-farm-bg-warm transition-colors shrink-0 cursor-pointer"
                aria-label="منوی اصلی"
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-nav-drawer"
              >
                {mobileMenuOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
              </button>

              <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group shrink-0">
                <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-farm-primary flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform shrink-0">
                  <Leaf className="w-5 h-5 sm:w-6 sm:h-6 text-farm-accent" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <span className="text-base sm:text-xl font-black text-farm-primary tracking-tight">پروفارم</span>
                    <span className="text-[11px] sm:text-xs font-semibold px-1.5 py-0.5 rounded-md bg-farm-primary/10 text-farm-primary">
                      شیراز
                    </span>
                  </div>
                  <span className="text-[11px] text-farm-text-muted font-medium hidden sm:block">
                    محصولات ارگانیک و محلی فارس
                  </span>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6 lg:gap-7" aria-label="منوی اصلی فروشگاه">
              {navLinks.map((link) => {
                const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`text-sm font-medium transition-colors relative py-1.5 flex items-center gap-1.5 ${
                      isActive
                        ? 'text-farm-primary font-bold'
                        : 'text-[#4A5568] hover:text-farm-primary'
                    }`}
                  >
                    <span>{link.name}</span>
                    {link.badge && (
                      <span className="text-[11px] px-2 py-0.5 bg-farm-primary/10 text-farm-primary border border-farm-primary/20 rounded-md font-bold">
                        {link.badge}
                      </span>
                    )}
                    {isActive && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-farm-primary rounded-full" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Action Buttons & Authentic Account State */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              {/* Authenticated Account Menu or Guest Login Button */}
              {!isUserLoggedIn ? (
                <Link
                  href="/login"
                  className="flex items-center gap-1.5 sm:gap-2 min-h-[44px] px-3 sm:px-4 rounded-xl bg-farm-primary text-white hover:bg-farm-primary-dark text-xs font-bold transition-all shadow-xs active:scale-98 shrink-0"
                  title="ورود به حساب کاربری یا ثبت‌نام"
                >
                  <UserIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">ورود / ثبت‌نام</span>
                  <span className="sm:hidden text-xs">ورود</span>
                </Link>
              ) : (
                <div className="relative" ref={userMenuRef}>
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    aria-expanded={userMenuOpen}
                    aria-haspopup="menu"
                    className={`flex items-center gap-1.5 sm:gap-2 min-h-[44px] px-2.5 sm:px-3.5 rounded-xl text-xs font-bold transition-all border cursor-pointer shrink-0 ${
                      isAdmin
                        ? 'bg-farm-primary-dark text-white border-farm-accent/40 shadow-xs'
                        : isPro
                        ? 'bg-farm-accent text-farm-gold-ink border-farm-gold-text/30 shadow-xs'
                        : isPlus
                        ? 'bg-emerald-800 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-farm-primary border-farm-border hover:bg-farm-bg'
                    }`}
                  >
                    <UserIcon className="w-4 h-4" />
                    {isPro && (
                      <span className="px-1.5 py-0.5 rounded-md bg-farm-primary-dark/15 text-farm-gold-ink text-[11px] font-black">
                        پرو
                      </span>
                    )}
                    {isPlus && (
                      <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-[11px] font-black">
                        پلاس
                      </span>
                    )}
                    {isAdmin && (
                      <span className="px-1.5 py-0.5 rounded-md bg-farm-accent text-farm-gold-ink text-[11px] font-black">
                        مدیر
                      </span>
                    )}
                    <ChevronDown className="w-3.5 h-3.5 opacity-75 hidden sm:inline" />
                  </button>

                  {/* Dropdown Menu for Authenticated User */}
                  {userMenuOpen && (
                    <div className="absolute left-0 mt-2 w-64 max-w-[85vw] bg-white rounded-2xl shadow-2xl border border-farm-border p-3 z-50 animate-in fade-in slide-in-from-top-2 text-right">
                      <div className="p-3 bg-farm-bg rounded-xl border border-farm-border mb-2">
                        <div className="font-bold text-xs text-farm-primary truncate">
                          {user?.name || 'کاربر گرامی'}
                        </div>
                        <div className="text-xs font-mono text-farm-text-muted mt-0.5">
                          {toPersianDigits(user?.phone || '')}
                        </div>
                        <div className="text-[11px] font-bold text-emerald-800 mt-1">
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
                          className="flex items-center gap-2.5 p-2.5 rounded-xl text-gray-700 hover:bg-farm-bg-warm font-medium transition-colors"
                        >
                          <UserIcon className="w-4 h-4 text-farm-primary" />
                          <span>ناحیه کاربری</span>
                        </Link>

                        <Link
                          href="/account?tab=orders"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 p-2.5 rounded-xl text-gray-700 hover:bg-farm-bg-warm font-medium transition-colors"
                        >
                          <ShoppingBag className="w-4 h-4 text-emerald-700" />
                          <span>سفارش‌های من</span>
                        </Link>

                        <Link
                          href="/account?tab=addresses"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 p-2.5 rounded-xl text-gray-700 hover:bg-farm-bg-warm font-medium transition-colors"
                        >
                          <MapPin className="w-4 h-4 text-farm-gold-text" />
                          <span>آدرس‌های تحویل</span>
                        </Link>

                        {isAdmin && (
                          <Link
                            href="/admin"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-2.5 p-2.5 rounded-xl text-farm-primary bg-farm-bg-warm hover:bg-farm-primary/10 font-bold transition-colors"
                          >
                            <ShieldCheck className="w-4 h-4 text-farm-primary" />
                            <span>پنل مدیریت سامانه</span>
                          </Link>
                        )}

                        <div className="pt-2 mt-1 border-t border-gray-100">
                          <button
                            type="button"
                            onClick={() => {
                              logout();
                              setUserMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-2.5 p-2.5 rounded-xl text-rose-700 hover:bg-rose-50 font-bold transition-colors cursor-pointer"
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
                ref={searchButtonRef}
                type="button"
                onClick={() => setSearchOpen(true)}
                className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl bg-white border border-farm-border text-farm-primary hover:bg-farm-bg transition-colors shadow-xs cursor-pointer shrink-0"
                aria-label="جستجوی سریع محصولات"
                title="جستجوی سریع محصولات"
              >
                <Search className="w-5 h-5" />
              </button>

              {/* Cart Button */}
              <Link
                href="/cart"
                className="relative flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl bg-white border border-farm-border text-farm-primary hover:bg-farm-bg transition-colors shadow-xs shrink-0"
                aria-label={`سبد خرید (${toPersianDigits(cartCount)} قلم)`}
              >
                <ShoppingBag className="w-5 h-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-farm-accent-warm text-white text-[11px] font-bold flex items-center justify-center shadow-xs">
                    {toPersianDigits(cartCount)}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Portal-rendered Overlays (outside .glass-nav so backdrop-filter never clips fixed positioning) */}
      {mounted &&
        createPortal(
          <>
            {/* Off-Canvas Mobile Drawer (Sliding from Right) */}
            <div className="md:hidden">
              {/* Backdrop Overlay */}
              <div
                onClick={closeMobileMenu}
                className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity duration-300 ${
                  mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
                aria-hidden="true"
              />

              {/* Sliding Sheet (Drawer from the Right) */}
              <div
                id="mobile-nav-drawer"
                role="dialog"
                aria-modal="true"
                aria-label="منوی ناوبری فروشگاه"
                inert={!mobileMenuOpen ? true : undefined}
                aria-hidden={!mobileMenuOpen}
                className={`fixed top-0 bottom-0 right-0 z-50 w-72 sm:w-80 max-w-[85vw] h-full bg-farm-bg border-l border-farm-border shadow-2xl flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  mobileMenuOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
                }`}
                dir="rtl"
              >
                {/* Drawer Top Header */}
                <div className="p-4 border-b border-farm-border bg-white flex items-center justify-between shrink-0">
                  <Link
                    href="/"
                    onClick={closeMobileMenu}
                    className="flex items-center gap-2.5"
                  >
                    <div className="w-9 h-9 rounded-xl bg-farm-primary flex items-center justify-center text-white shadow-xs">
                      <Leaf className="w-5 h-5 text-farm-accent" />
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1">
                        <span className="text-base font-black text-farm-primary">پروفارم</span>
                        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-farm-primary/10 text-farm-primary">
                          شیراز
                        </span>
                      </div>
                      <span className="text-[11px] text-farm-text-muted font-medium">
                        محصولات ارگانیک مزارع فارس
                      </span>
                    </div>
                  </Link>

                  <button
                    type="button"
                    onClick={closeMobileMenu}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-gray-600 hover:text-farm-primary hover:bg-farm-bg-warm transition-colors cursor-pointer"
                    aria-label="بستن منو"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Drawer Body - Scrollable */}
                <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
                  {/* User Profile / Login Banner */}
                  {!isUserLoggedIn ? (
                    <div className="p-3.5 rounded-2xl bg-gradient-to-br from-farm-primary to-farm-primary-dark text-white shadow-md space-y-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center text-white">
                          <UserIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold block">حساب کاربری پروفارم</span>
                          <span className="text-[11px] text-emerald-100 block">ورود یا ثبت‌نام سریع با پیامک</span>
                        </div>
                      </div>
                      <Link
                        href="/login"
                        onClick={closeMobileMenu}
                        className="w-full min-h-[44px] px-3 rounded-xl bg-white text-farm-primary text-xs font-black flex items-center justify-center gap-1.5 shadow-xs hover:bg-emerald-50 transition-colors"
                      >
                        <LogIn className="w-4 h-4" />
                        <span>ورود به حساب یا ثبت‌نام</span>
                      </Link>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-2xl bg-white border border-farm-border shadow-xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-farm-primary text-white flex items-center justify-center text-xs font-black">
                            {user?.name ? user.name[0] : 'ک'}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-gray-900 block truncate max-w-[130px]">
                              {user?.name || 'کاربر گرامی'}
                            </span>
                            <span className="text-[11px] font-mono text-farm-text-muted block text-right" dir="ltr">
                              {toPersianDigits(user?.phone || '')}
                            </span>
                          </div>
                        </div>
                        {userTier !== 'FREE' && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-950 border border-amber-200 flex items-center gap-1">
                            <Crown className="w-3 h-3 text-farm-gold-text" />
                            <span>{userTier === 'PLUS' ? 'پلاس' : 'پرو'}</span>
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-gray-100 text-xs">
                        <Link
                          href="/account"
                          onClick={closeMobileMenu}
                          className="min-h-[40px] flex items-center justify-center px-2 rounded-lg bg-gray-100 text-gray-800 font-bold hover:bg-gray-200 text-center transition-colors"
                        >
                          ناحیه کاربری
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            logout();
                            closeMobileMenu();
                          }}
                          className="min-h-[40px] flex items-center justify-center px-2 rounded-lg bg-rose-50 text-rose-700 font-bold hover:bg-rose-100 text-center transition-colors cursor-pointer"
                        >
                          خروج از حساب
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Navigation Links */}
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-farm-text-muted px-2 block mb-1.5">
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
                          onClick={closeMobileMenu}
                          className={`flex items-center justify-between min-h-[44px] px-3 rounded-2xl text-sm font-bold transition-all ${
                            isActive
                              ? 'bg-farm-primary text-white shadow-xs'
                              : 'text-gray-800 hover:bg-white hover:text-farm-primary'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <IconComponent className={`w-4 h-4 ${isActive ? 'text-farm-accent' : 'text-farm-text-muted'}`} />
                            <span>{link.name}</span>
                          </div>
                          {link.badge && (
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-md font-bold ${
                                isActive
                                  ? 'bg-white/20 text-white'
                                  : 'bg-farm-primary/10 text-farm-primary'
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
                  <div className="pt-2 border-t border-farm-border">
                    <Link
                      href="/cart"
                      onClick={closeMobileMenu}
                      className="flex items-center justify-between p-3 rounded-2xl bg-white border border-farm-border hover:border-farm-primary transition-colors shadow-xs"
                    >
                      <div className="flex items-center gap-2.5 text-xs font-bold text-gray-800">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-farm-primary flex items-center justify-center">
                          <ShoppingBag className="w-4 h-4" />
                        </div>
                        <span>سبد خرید شما</span>
                      </div>
                      <span className="text-xs font-bold font-mono px-2.5 py-0.5 rounded-full bg-farm-accent-warm text-white">
                        {toPersianDigits(cartCount)} قلم
                      </span>
                    </Link>
                  </div>
                </div>

                {/* Drawer Footer */}
                <div className="p-3.5 border-t border-farm-border bg-white text-center space-y-1 shrink-0">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-farm-primary">
                    <Truck className="w-3.5 h-3.5 text-farm-gold-text" />
                    <span>ارسال مستقیم و اختصاصی در سراسر شیراز</span>
                  </div>
                  <p className="text-xs text-farm-text-muted font-medium">
                    پشتیبانی مزارع:{' '}
                    <a
                      href={`tel:${SITE_CONFIG.contact.supportPhoneTel}`}
                      className="font-mono text-gray-800 font-bold hover:underline"
                    >
                      {SITE_CONFIG.contact.supportPhoneDisplay}
                    </a>
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Search Modal (Portal-mounted outside .glass-nav) */}
            {searchOpen && (
              <div
                role="dialog"
                aria-modal="true"
                aria-label="جستجوی سریع محصولات"
                onClick={(e) => {
                  if (e.target === e.currentTarget) closeSearch();
                }}
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-16 sm:pt-20 px-4 animate-in fade-in"
                dir="rtl"
              >
                <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-farm-border overflow-hidden flex flex-col max-h-[80vh] text-right animate-in zoom-in-95">
                  <div className="p-4 border-b border-farm-border flex items-center gap-3">
                    <Search className="w-5 h-5 text-farm-primary shrink-0" />
                    <input
                      type="search"
                      autoFocus
                      aria-label="عبارت جستجوی محصول"
                      placeholder="جستجوی فرآورده‌های ارگانیک شیراز (مانند: عسل، تخم‌مرغ، عرقیات)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full text-base sm:text-sm outline-none bg-transparent placeholder-gray-500 text-gray-900"
                    />
                    <button
                      type="button"
                      onClick={closeSearch}
                      aria-label="بستن جستجو"
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 hover:text-gray-800 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-3 overflow-y-auto overscroll-contain divide-y divide-farm-bg-warm space-y-1 max-h-[60vh]">
                    {searchResults.length === 0 ? (
                      <div className="py-8 text-center text-sm text-farm-text-muted">
                        {searchQuery.trim()
                          ? 'محصولی مطابق با عبارت جستجو شده در مزرعه یافت نشد.'
                          : 'نام محصول، دسته‌بندی یا ویژگی مورد نظر خود را تایپ کنید.'}
                      </div>
                    ) : (
                      searchResults.map((product) => (
                        <Link
                          key={product.id}
                          href={`/products/${product.slug}`}
                          onClick={closeSearch}
                          className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-farm-bg transition-colors"
                        >
                          <img
                            src={product.images[0] || '/images/prod-eggs.jpg'}
                            alt={product.title}
                            className="w-12 h-12 rounded-xl object-cover border border-farm-border shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{product.title}</p>
                            <p className="text-xs text-farm-text-muted">{product.category}</p>
                          </div>
                          <span className="text-xs font-bold text-farm-primary shrink-0">
                            {formatToman(product.price)}
                          </span>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </>,
          document.body
        )}
    </>
  );
};
