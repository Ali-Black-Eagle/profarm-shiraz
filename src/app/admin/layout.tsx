'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Truck,
  Package,
  ShoppingBag,
  Users,
  Inbox,
  ArrowRight,
  Leaf,
  PanelRightClose,
  PanelRightOpen,
  ChevronLeft,
  ShieldAlert,
  ShieldCheck,
  Lock,
  LayoutTemplate,
  CircleDollarSign,
  TicketPercent,
  CreditCard,
  LogOut,
  RotateCcw,
  MessageSquare,
  Star,
  Crown,
  Menu,
  X,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isInApp, setIsInApp] = useState(false);

  // Check if running inside the Android ProfarmAdminApp
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isApp =
        Boolean((window as any).AndroidBridge) ||
        navigator.userAgent.includes('ProfarmAdminApp') ||
        window.location.search.includes('in_app=1') ||
        document.documentElement.classList.contains('in-profarm-app');
      if (isApp) {
        setIsInApp(true);
        document.documentElement.classList.add('in-profarm-app');
      }
    }
  }, []);

  // Restore sidebar state from localStorage if available
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('profarm_admin_sidebar_collapsed');
    if (saved !== null) {
      setIsCollapsed(saved === 'true');
    }
  }, []);

  // Close mobile drawer automatically when navigating to another route
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  // ESC key to close mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('profarm_admin_sidebar_collapsed', String(next));
      return next;
    });
  };

  const navItems = [
    { label: 'داشبورد و آمار کلی', href: '/admin', icon: LayoutDashboard },
    {
      label: 'پیک و لجستیک شیراز',
      href: '/admin/manifest',
      icon: Truck,
      highlight: true,
    },
    { label: 'مدیریت محصولات و انبار', href: '/admin/products', icon: Package },
    {
      label: 'نظرات و رضایت خریداران',
      href: '/admin/reviews',
      icon: Star,
      highlight: true,
    },
    { label: 'مدیریت سفارش‌ها و ارسال', href: '/admin/orders', icon: ShoppingBag },
    {
      label: 'کدهای تخفیف و پروموشن',
      href: '/admin/coupons',
      icon: TicketPercent,
      highlight: true,
    },
    { label: 'مدیریت محتوای سایت (CMS)', href: '/admin/cms', icon: LayoutTemplate },
    {
      label: 'پایش مالی و تراز درآمد',
      href: '/admin/finance',
      icon: CircleDollarSign,
      highlight: true,
    },
    {
      label: 'تنظیمات درگاه پرداخت',
      href: '/admin/payment',
      icon: CreditCard,
      highlight: true,
    },
    {
      label: 'مرجوعی و تضمین کیفیت',
      href: '/admin/returns',
      icon: RotateCcw,
      highlight: true,
    },
    {
      label: 'سامانه پیامک و کمپین',
      href: '/admin/sms',
      icon: MessageSquare,
      highlight: true,
    },
    {
      label: 'مدیریت اشتراک‌های پرو',
      href: '/admin/subscriptions',
      icon: Crown,
      highlight: true,
    },
    { label: 'مدیریت کاربران و دسترسی‌ها', href: '/admin/users', icon: Users },
    { label: 'استعلام‌های خرید عمده', href: '/admin/bulk', icon: Inbox },
  ];

  // Mobile Bottom Quick Navigation shortcuts
  const quickNavItems = [
    { label: 'داشبورد', href: '/admin', icon: LayoutDashboard },
    { label: 'سفارش‌ها', href: '/admin/orders', icon: ShoppingBag },
    { label: 'پیک شیراز', href: '/admin/manifest', icon: Truck },
    { label: 'پایش مالی', href: '/admin/finance', icon: CircleDollarSign },
  ];

  // 1. Bypass layout for admin login route
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  // 2. Loading state while checking authentication
  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center p-6">
        <div className="w-10 h-10 rounded-full border-3 border-[#2C4A2E] border-t-transparent animate-spin" />
      </div>
    );
  }

  // 3. SECURITY ROLE GUARD: Block non-admin users immediately!
  if (user?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-[#E6E1D5] shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 rounded-3xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
            <ShieldAlert className="w-9 h-9" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-black text-gray-900">دسترسی منحصراً برای مدیریت</h2>
            <p className="text-xs text-gray-600 leading-relaxed">
              مشاهده اطلاعات، موجودی انبار، آمار فروش و سفارشات مزارع تنها با ورود رسمی{' '}
              <strong className="text-[#2C4A2E]">مدیر ارشد (ADMIN)</strong> امکان‌پذیر می‌باشد.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 font-medium leading-relaxed text-right flex items-start gap-2">
            <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              جهت ورود به پنل مدیریت، لطفاً با نام کاربری و کلمه عبور اختصاصی مدیر یا پیامک امن وارد شوید.
            </span>
          </div>

          <div className="space-y-2.5 pt-2">
            <Link
              href="/login?redirect=/admin"
              className="w-full py-3.5 px-4 rounded-xl bg-[#2C4A2E] text-white font-bold text-xs hover:bg-[#1E3520] transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
              <span>ورود به سامانه با حساب مدیر ارشد</span>
            </Link>

            <Link
              href="/"
              className="block w-full py-3 px-4 rounded-xl border border-gray-200 text-gray-700 font-bold text-xs hover:bg-gray-50 transition-colors"
            >
              بازگشت به صفحه اصلی فروشگاه عمومی
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 4. ADMIN AUTHORIZED VIEW
  return (
    <div className="min-h-screen bg-[#F8F7F4] flex flex-col md:flex-row text-gray-800 antialiased selection:bg-[#2C4A2E] selection:text-white">
      {/* Mobile Topbar (Sticky on screens < md, hidden inside Android app to eliminate duplicate headers) */}
      {!isInApp && (
        <header
          data-admin-mobile-header
          className="sticky top-0 z-30 bg-[#1E3520] text-white px-4 py-3 border-b border-[#2C4A2E] shadow-md flex items-center justify-between md:hidden no-print"
        >
          {/* Right side in RTL: Hamburger button */}
          <button
            onClick={() => setIsMobileOpen(true)}
            className="p-2 -mr-1 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all cursor-pointer flex items-center justify-center"
            aria-label="باز کردن منوی کشویی مدیریت"
          >
            <Menu className="w-5 h-5 text-[#D4A373]" />
          </button>

          {/* Center: Brand Title */}
          <Link href="/admin" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#D4A373] text-[#1E3520] flex items-center justify-center font-black shadow-xs">
              <Leaf className="w-4 h-4" />
            </div>
            <div className="text-right">
              <div className="text-xs font-black text-white leading-tight">پروفارم شیراز</div>
              <div className="text-[10px] text-[#D4A373] font-medium leading-tight">پنل مدیریت مزارع</div>
            </div>
          </Link>

          {/* Left side in RTL: Store Link shortcut */}
          <Link
            href="/"
            className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[#D4A373] text-[11px] font-bold flex items-center gap-1 transition-colors"
            title="مشاهده فروشگاه عمومی"
          >
            <span>فروشگاه</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </header>
      )}

      {/* Mobile Backdrop Overlay */}
      <div
        onClick={() => setIsMobileOpen(false)}
        className={`fixed inset-0 bg-black/65 backdrop-blur-xs z-40 transition-opacity duration-300 md:hidden no-print ${
          isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />

      {/* Mobile Sliding Drawer (کشویی از سمت راست در چیدمان RTL) */}
      <aside
        className={`fixed top-0 right-0 bottom-0 w-[290px] sm:w-[320px] max-w-[85vw] bg-[#1E3520] text-white z-50 shadow-2xl flex flex-col justify-between transition-transform duration-300 ease-out md:hidden no-print ${
          isMobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-label="منوی کشویی مدیریت"
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Drawer Header */}
          <div className="p-4 border-b border-[#2C4A2E] flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#D4A373] text-[#1E3520] flex items-center justify-center font-black shrink-0">
                <Leaf className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-black text-white leading-tight">پروفارم شیراز</div>
                <div className="text-[10px] text-[#D4A373] font-medium leading-tight mt-0.5">
                  مرکز کنترل و لجستیک
                </div>
              </div>
            </div>

            {/* Close Drawer Button */}
            <button
              onClick={() => setIsMobileOpen(false)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-gray-300 hover:text-white transition-all cursor-pointer"
              aria-label="بستن منو"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Admin User Chip */}
          <div className="px-4 py-2.5 bg-[#2C4A2E]/50 border-b border-[#2C4A2E]/40 flex items-center justify-between text-xs shrink-0">
            <div className="flex items-center gap-2 text-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold truncate max-w-[170px]">{user?.name || 'مدیر ارشد سامانه'}</span>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-[#D4A373]/20 text-[#D4A373] text-[10px] font-black border border-[#D4A373]/30">
              ADMIN
            </span>
          </div>

          {/* Drawer Nav Items with Smooth Touch Scrolling */}
          <nav className="flex-1 p-3.5 space-y-1 overflow-y-auto overscroll-contain text-xs">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium transition-all group ${
                    isActive
                      ? 'bg-[#2C4A2E] text-white shadow-xs font-bold border-r-4 border-[#D4A373]'
                      : 'text-gray-300 hover:bg-[#2C4A2E]/50 hover:text-white'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                      item.highlight ? 'text-[#D4A373]' : isActive ? 'text-white' : 'text-gray-300'
                    }`}
                  />
                  <span className="truncate leading-relaxed">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Drawer Footer Actions */}
          <div className="p-3.5 border-t border-[#2C4A2E] space-y-1.5 shrink-0 bg-[#162918]">
            <Link
              href="/"
              onClick={() => setIsMobileOpen(false)}
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-gray-300 hover:bg-[#2C4A2E] hover:text-white transition-colors"
            >
              <ArrowRight className="w-4 h-4 text-[#D4A373] shrink-0" />
              <span>مشاهده فروشگاه عمومی</span>
            </Link>

            <button
              onClick={() => {
                setIsMobileOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-300 hover:bg-rose-950/50 hover:text-white transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-rose-400 shrink-0" />
              <span>خروج از حساب مدیریت</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Desktop Sidebar (visible on screens md and up) */}
      <aside
        className={`hidden md:flex bg-[#1E3520] text-white shrink-0 flex-col justify-between no-print shadow-xl transition-all duration-300 ease-in-out z-30 sticky top-0 h-screen ${
          isCollapsed ? 'w-20 p-3' : 'w-64 p-5'
        }`}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Brand Header & Minimize Button */}
          <div
            className={`flex items-center pb-4 border-b border-[#2C4A2E]/80 transition-all shrink-0 ${
              isCollapsed ? 'justify-center' : 'justify-between gap-3'
            }`}
          >
            <Link
              href="/admin"
              className={`flex items-center gap-3 group overflow-hidden ${
                isCollapsed ? 'justify-center' : ''
              }`}
              title="پنل مدیریت پروفارم شیراز"
            >
              <div className="w-10 h-10 rounded-2xl bg-[#D4A373] flex items-center justify-center text-[#1E3520] font-black shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                <Leaf className="w-5 h-5" />
              </div>
              {!isCollapsed && (
                <div className="overflow-hidden transition-opacity duration-200">
                  <div className="text-sm font-black text-white tracking-tight leading-tight">
                    پروفارم شیراز
                  </div>
                  <div className="text-[11px] text-[#D4A373] font-medium leading-tight mt-0.5">
                    مرکز کنترل و لجستیک
                  </div>
                </div>
              )}
            </Link>

            {/* Minimize / Expand Toggle Button */}
            <button
              onClick={toggleSidebar}
              className={`flex items-center justify-center p-2 rounded-xl text-gray-300 hover:text-white hover:bg-[#2C4A2E] transition-colors cursor-pointer ${
                isCollapsed ? 'mt-2' : ''
              }`}
              title={isCollapsed ? 'گسترش منوی کناری (فضای کامل)' : 'جمع کردن منو (افزایش فضای کار)'}
              aria-label={isCollapsed ? 'باز کردن منو' : 'جمع کردن منو'}
            >
              {isCollapsed ? (
                <PanelRightOpen className="w-5 h-5 text-[#D4A373]" />
              ) : (
                <PanelRightClose className="w-5 h-5 text-gray-300 hover:text-[#D4A373]" />
              )}
            </button>
          </div>

          {/* Quick collapse tooltip banner when minimized */}
          {isCollapsed && (
            <button
              onClick={toggleSidebar}
              className="w-full py-1.5 mt-2 flex items-center justify-center rounded-lg bg-[#2C4A2E]/60 text-[10px] text-emerald-200 hover:bg-[#2C4A2E] transition-colors cursor-pointer shrink-0"
              title="کلیک برای باز کردن منو"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Nav Items with scroll */}
          <nav className="flex-1 py-3 space-y-1 text-xs overflow-y-auto pr-0.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={isCollapsed ? item.label : undefined}
                  className={`flex items-center rounded-xl font-medium transition-all group ${
                    isCollapsed ? 'justify-center p-3' : 'gap-3 px-3.5 py-2.5'
                  }`}
                >
                  <span
                    className={`flex items-center w-full rounded-xl transition-all ${
                      isCollapsed ? 'justify-center p-1' : 'gap-3'
                    } ${
                      isActive
                        ? 'bg-[#2C4A2E] text-white shadow-xs font-bold border-r-4 border-[#D4A373] py-2 px-2.5'
                        : 'text-gray-300 hover:bg-[#2C4A2E]/50 hover:text-white py-1 px-1'
                    }`}
                  >
                    <Icon
                      className={`shrink-0 transition-transform group-hover:scale-110 ${
                        item.highlight ? 'text-[#D4A373]' : isActive ? 'text-white' : 'text-gray-300'
                      } ${isCollapsed ? 'w-5 h-5' : 'w-4 h-4'}`}
                    />
                    {!isCollapsed && <span className="truncate leading-relaxed">{item.label}</span>}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Back to Public Store & Logout */}
          <div className="pt-3 border-t border-[#2C4A2E]/80 space-y-1 shrink-0">
            <Link
              href="/"
              title={isCollapsed ? 'مشاهده فروشگاه عمومی' : undefined}
              className={`flex items-center rounded-xl text-xs font-semibold text-gray-300 hover:bg-[#2C4A2E] hover:text-white transition-colors group ${
                isCollapsed ? 'justify-center p-3' : 'gap-2 px-3.5 py-2'
              }`}
            >
              <ArrowRight className="w-4 h-4 text-[#D4A373] shrink-0 group-hover:-translate-x-0.5 transition-transform" />
              {!isCollapsed && <span className="truncate">مشاهده فروشگاه</span>}
            </Link>

            <button
              onClick={() => logout()}
              title={isCollapsed ? 'خروج از حساب مدیریت' : undefined}
              className={`w-full flex items-center rounded-xl text-xs font-semibold text-rose-300 hover:bg-rose-950/50 hover:text-white transition-colors group cursor-pointer ${
                isCollapsed ? 'justify-center p-3' : 'gap-2 px-3.5 py-2'
              }`}
            >
              <LogOut className="w-4 h-4 text-rose-400 shrink-0" />
              {!isCollapsed && <span className="truncate">خروج از حساب</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Admin Content Area */}
      <main className={`flex-1 p-3.5 sm:p-6 md:p-8 lg:p-9 max-w-full overflow-x-hidden overflow-y-auto ${isInApp ? 'pb-6 pt-4' : 'pb-28 md:pb-8'} leading-relaxed`}>
        {children}
      </main>

      {/* Mobile Bottom Quick Navigation Bar (Sticky at bottom on screens < md, hidden inside Android app to eliminate duplicate bottombars) */}
      {!isInApp && (
        <nav
          data-admin-mobile-nav
          className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#E6E1D5] py-1 px-2 flex items-center justify-around shadow-2xl md:hidden no-print"
          aria-label="دسترسی سریع مدیریت"
        >
          {quickNavItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all min-w-[58px] ${
                  isActive
                    ? 'text-[#2C4A2E] font-black'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center mb-0.5 transition-all ${
                    isActive ? 'bg-emerald-100 text-[#2C4A2E] shadow-xs' : 'text-gray-500'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}

          {/* 5th Tab: Open Full Drawer Menu */}
          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all min-w-[58px] cursor-pointer ${
              isMobileOpen ? 'text-[#2C4A2E] font-black' : 'text-gray-500 hover:text-gray-900'
            }`}
            aria-label="باز کردن کشوی همه منوها"
          >
            <div className="w-7 h-7 rounded-xl bg-gray-100 flex items-center justify-center mb-0.5 text-gray-700">
              <Menu className="w-4 h-4" />
            </div>
            <span>همه منوها</span>
          </button>
        </nav>
      )}
    </div>
  );
}
