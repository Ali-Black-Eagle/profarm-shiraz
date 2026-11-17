'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { farmStore } from '@/lib/db-store';
import { Order, Address, Coupon, OrderStatus, ProductReview } from '@/types';
import { formatToman, toPersianDigits, isValidIranPhone, getDeduplicatedPerks } from '@/lib/formatters';
import { UserInvoiceModal } from '@/components/modules/UserInvoiceModal';
import {
  User as UserIcon,
  ShoppingBag,
  MapPin,
  Crown,
  Zap,
  TicketPercent,
  Settings,
  LogOut,
  ChevronLeft,
  Clock,
  Truck,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Edit2,
  FileText,
  RotateCcw,
  Copy,
  Check,
  ShieldCheck,
  Calendar,
  Phone,
  Mail,
  Home,
  Star,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Package,
  CornerDownLeft,
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-react';

type TabType = 'overview' | 'orders' | 'addresses' | 'subscription' | 'coupons' | 'settings' | 'reviews';

function AccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    user,
    isAuthenticated,
    logout,
    updateUser,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
  } = useAuth();
  const { addItem } = useCart();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [mounted, setMounted] = useState(false);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [userReviews, setUserReviews] = useState<ProductReview[]>([]);
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<Order | null>(null);

  // Address Modal State
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressRecipient, setAddressRecipient] = useState('');
  const [addressPhone, setAddressPhone] = useState('0917');
  const [addressCity, setAddressCity] = useState('شیراز');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressUnit, setAddressUnit] = useState('');
  const [addressPostalCode, setAddressPostalCode] = useState('');
  const [addressIsDefault, setAddressIsDefault] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);

  // Settings State
  const [nameInput, setNameInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [nationalIdInput, setNationalIdInput] = useState('');
  const [birthDateInput, setBirthDateInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [smsNotificationInput, setSmsNotificationInput] = useState(true);
  const [settingsSuccessMsg, setSettingsSuccessMsg] = useState<string | null>(null);
  const [settingsErrorMsg, setSettingsErrorMsg] = useState<string | null>(null);

  // Orders Filter
  const [orderStatusFilter, setOrderStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DELIVERED' | 'CANCELLED'>('ALL');

  // Copy Feedback
  const [copiedCouponCode, setCopiedCouponCode] = useState<string | null>(null);
  const [reorderSuccessMsg, setReorderSuccessMsg] = useState<string | null>(null);
  const [selectedTrackingOrderId, setSelectedTrackingOrderId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const tabParam = searchParams.get('tab') as TabType;
    if (tabParam && ['overview', 'orders', 'addresses', 'subscription', 'coupons', 'settings', 'reviews'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Sync user reviews
  useEffect(() => {
    if (!user) return;
    setUserReviews(farmStore.getUserReviews(user.id));
  }, [user, activeTab]);

  // Load orders associated with current user
  useEffect(() => {
    if (!user) return;
    const allOrders = farmStore.getOrders();
    const filtered = allOrders.filter(
      (o) =>
        o.userId === user.id ||
        o.address?.phone === user.phone ||
        o.user?.phone === user.phone ||
        user.role === 'ADMIN' // Admin demo user sees demo orders
    );
    setUserOrders(filtered);

    // Sync settings fields
    setNameInput(user.name || '');
    setEmailInput(user.email || '');
    setNationalIdInput(user.nationalId || '');
    setBirthDateInput(user.birthDate || '');
    setSmsNotificationInput(user.smsNotificationEnabled !== false);
  }, [user]);

  const coupons = useMemo(() => {
    return farmStore.getCoupons();
  }, []);

  const [subSettings, setSubSettings] = useState(() => farmStore.getSubscriptionSettings());

  useEffect(() => {
    farmStore.syncSubscriptionSettings().then((synced) => {
      setSubSettings({ ...synced });
    });

    const handleSubUpdate = () => {
      setSubSettings(farmStore.getSubscriptionSettings());
    };
    window.addEventListener('profarm_subscription_updated', handleSubUpdate);
    window.addEventListener('storage', handleSubUpdate);
    return () => {
      window.removeEventListener('profarm_subscription_updated', handleSubUpdate);
      window.removeEventListener('storage', handleSubUpdate);
    };
  }, []);

  // Active / Selected Order for live stepper (placed before early returns to obey React Rules of Hooks)
  const activeOrder = useMemo(() => {
    if (selectedTrackingOrderId) {
      const found = userOrders.find((o) => o.id === selectedTrackingOrderId);
      if (found) return found;
    }
    return (
      userOrders.find((o) => o.status === 'PROCESSING' || o.status === 'OUT_FOR_DELIVERY') ||
      userOrders[0]
    );
  }, [selectedTrackingOrderId, userOrders]);

  if (!mounted) return null;

  if (!isAuthenticated || !user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-[#2C4A2E]/10 flex items-center justify-center text-[#2C4A2E] mx-auto">
          <UserIcon className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-[#2C4A2E]">ورود به ناحیه کاربری</h1>
        <p className="text-sm text-gray-600 leading-relaxed">
          برای دسترسی به سوابق خرید، پیگیری تحویل سفارش در شیراز، دفترچه نشانی‌ها و سهمیه اشتراک، لطفاً وارد حساب کاربری خود شوید.
        </p>
        <div className="flex items-center justify-center pt-2">
          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-[#2C4A2E] text-white font-bold text-sm hover:bg-[#1E3520] transition-colors shadow-md"
          >
            ورود با شماره موبایل
          </Link>
        </div>
      </div>
    );
  }

  // Handler for address modal
  const handleOpenAddAddress = () => {
    setEditingAddressId(null);
    setAddressRecipient(user.name || '');
    setAddressPhone(user.phone || '0917');
    setAddressCity('شیراز');
    setAddressStreet('');
    setAddressUnit('');
    setAddressPostalCode('');
    setAddressIsDefault((user.addresses || []).length === 0);
    setAddressError(null);
    setIsAddressModalOpen(true);
  };

  const handleOpenEditAddress = (addr: Address) => {
    setEditingAddressId(addr.id);
    setAddressRecipient(addr.recipientName);
    setAddressPhone(addr.phone);
    setAddressCity(addr.city || 'شیراز');
    setAddressStreet(addr.streetAddress);
    setAddressUnit(addr.unit || '');
    setAddressPostalCode(addr.postalCode);
    setAddressIsDefault(!!addr.isDefault);
    setAddressError(null);
    setIsAddressModalOpen(true);
  };

  const handleSaveAddress = (e: React.FormEvent) => {
    e.preventDefault();
    setAddressError(null);

    if (!addressRecipient.trim()) {
      setAddressError('لطفاً نام تحویل‌گیرنده را وارد کنید.');
      return;
    }
    if (!isValidIranPhone(addressPhone)) {
      setAddressError('شماره موبایل نامعتبر است (مثال: ۰۹۱۷۱۲۳۴۵۶۷).');
      return;
    }
    if (!addressStreet.trim()) {
      setAddressError('لطفاً آدرس دقیق را وارد فرمایید.');
      return;
    }

    if (editingAddressId) {
      updateAddress(editingAddressId, {
        recipientName: addressRecipient.trim(),
        phone: addressPhone.trim(),
        city: addressCity.trim(),
        streetAddress: addressStreet.trim(),
        unit: addressUnit.trim() || null,
        postalCode: addressPostalCode.trim(),
        isDefault: addressIsDefault,
      });
    } else {
      addAddress({
        recipientName: addressRecipient.trim(),
        phone: addressPhone.trim(),
        province: 'فارس',
        city: addressCity.trim(),
        streetAddress: addressStreet.trim(),
        unit: addressUnit.trim() || null,
        postalCode: addressPostalCode.trim(),
        isShiraz: true,
        isDefault: addressIsDefault,
      });
    }

    setIsAddressModalOpen(false);
  };

  // Reorder Handler
  const handleReorder = (order: Order) => {
    order.items.forEach((item) => {
      addItem(item.product, item.quantity);
    });
    setReorderSuccessMsg(`اقلام سفارش ${order.orderNumber} به سبد خرید اضافه شدند.`);
    setTimeout(() => setReorderSuccessMsg(null), 4000);
  };

  // Copy Coupon Handler
  const handleCopyCoupon = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCouponCode(code);
    setTimeout(() => setCopiedCouponCode(null), 2500);
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsErrorMsg(null);
    setSettingsSuccessMsg(null);

    try {
      const res = await fetch('/api/auth/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameInput.trim() || user.name,
          username: usernameInput.trim() || undefined,
          email: emailInput.trim() || null,
          nationalId: nationalIdInput.trim() || null,
          birthDate: birthDateInput.trim() || null,
          smsNotificationEnabled: smsNotificationInput,
          password: newPasswordInput.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setSettingsErrorMsg(data.message || 'خطا در ذخیره تغییرات');
        return;
      }

      if (data.user) {
        updateUser(data.user);
      }
      setNewPasswordInput('');
      setSettingsSuccessMsg(data.message || 'تغییرات حساب کاربری با موفقیت ذخیره شد.');
      setTimeout(() => setSettingsSuccessMsg(null), 4000);
    } catch {
      setSettingsErrorMsg('خطا در برقراری ارتباط با سرور.');
    }
  };

  // Filtered Orders
  const filteredOrders = userOrders.filter((o) => {
    if (orderStatusFilter === 'ALL') return true;
    if (orderStatusFilter === 'ACTIVE') return o.status === 'PROCESSING' || o.status === 'OUT_FOR_DELIVERY';
    if (orderStatusFilter === 'DELIVERED') return o.status === 'DELIVERED';
    if (orderStatusFilter === 'CANCELLED') return o.status === 'CANCELLED';
    return true;
  });

  const tier = user.tier || (user.isProMember ? 'PRO' : 'FREE');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Toast Messages */}
      {reorderSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-bold flex items-center justify-between shadow-farm animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>{reorderSuccessMsg}</span>
          </div>
          <Link href="/cart" className="text-xs bg-[#2C4A2E] text-white px-3 py-1.5 rounded-xl hover:bg-[#1E3520]">
            مشاهده سبد خرید
          </Link>
        </div>
      )}

      {/* Main Layout: Sidebar & Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Sidebar Nav (4 cols on lg) */}
        <div className="lg:col-span-4 space-y-6">
          {/* User Profile Card */}
          <div className="bg-white rounded-3xl p-6 border border-[#E6E1D5] shadow-farm space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[#2C4A2E] text-white flex items-center justify-center font-black text-2xl shadow-md border-2 border-[#D4A373]">
                {user.name ? user.name.slice(0, 1) : 'پ'}
              </div>
              <div className="space-y-1 overflow-hidden">
                <h2 className="text-base font-black text-[#2C4A2E] truncate">
                  {user.name || 'کاربر گرامی'}
                </h2>
                <p className="text-xs text-gray-500 font-mono" dir="ltr">
                  {user.phone}
                </p>
                {/* Tier Badge */}
                <div className="pt-0.5">
                  {user.role === 'ADMIN' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-200">
                      <ShieldCheck className="w-3.5 h-3.5 text-purple-700" />
                      <span>مدیر ارشد مزارع</span>
                    </span>
                  ) : tier === 'PRO' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      <Crown className="w-3.5 h-3.5 text-amber-600" />
                      <span>مشترک پرو (تحویل ۶ روزه)</span>
                    </span>
                  ) : tier === 'PLUS' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                      <Zap className="w-3.5 h-3.5 text-emerald-600" />
                      <span>مشترک پلاس (تحویل ۶ روزه)</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-700 border border-gray-200">
                      <UserIcon className="w-3.5 h-3.5 text-gray-500" />
                      <span>کاربر عادی (تحویل ۱شنبه/۴شنبه)</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Menu Links */}
          <div className="bg-white rounded-3xl p-3 border border-[#E6E1D5] shadow-farm space-y-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center justify-between p-3.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-[#2C4A2E] text-white shadow-xs'
                  : 'text-gray-700 hover:bg-[#F9F8F5]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Home className="w-4 h-4" />
                <span>داشبورد و نمای کلی</span>
              </div>
              <ChevronLeft className="w-4 h-4 opacity-70" />
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              className={`w-full flex items-center justify-between p-3.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'orders'
                  ? 'bg-[#2C4A2E] text-white shadow-xs'
                  : 'text-gray-700 hover:bg-[#F9F8F5]'
              }`}
            >
              <div className="flex items-center gap-3">
                <ShoppingBag className="w-4 h-4" />
                <span>سفارش‌های من</span>
              </div>
              <div className="flex items-center gap-1.5">
                {userOrders.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-900 font-black">
                    {toPersianDigits(userOrders.length)}
                  </span>
                )}
                <ChevronLeft className="w-4 h-4 opacity-70" />
              </div>
            </button>

            <button
              onClick={() => setActiveTab('addresses')}
              className={`w-full flex items-center justify-between p-3.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'addresses'
                  ? 'bg-[#2C4A2E] text-white shadow-xs'
                  : 'text-gray-700 hover:bg-[#F9F8F5]'
              }`}
            >
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4" />
                <span>دفترچه نشانی‌ها</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-800 font-bold">
                  {toPersianDigits((user.addresses || []).length)}
                </span>
                <ChevronLeft className="w-4 h-4 opacity-70" />
              </div>
            </button>

            <button
              onClick={() => setActiveTab('subscription')}
              className={`w-full flex items-center justify-between p-3.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'subscription'
                  ? 'bg-[#2C4A2E] text-white shadow-xs'
                  : 'text-gray-700 hover:bg-[#F9F8F5]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Crown className="w-4 h-4 text-amber-500" />
                <span>باشگاه و اشتراک فعال</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-amber-600 font-bold">
                  {tier === 'PRO' ? 'پرو' : tier === 'PLUS' ? 'پلاس' : 'عادی'}
                </span>
                <ChevronLeft className="w-4 h-4 opacity-70" />
              </div>
            </button>

            <button
              onClick={() => setActiveTab('coupons')}
              className={`w-full flex items-center justify-between p-3.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'coupons'
                  ? 'bg-[#2C4A2E] text-white shadow-xs'
                  : 'text-gray-700 hover:bg-[#F9F8F5]'
              }`}
            >
              <div className="flex items-center gap-3">
                <TicketPercent className="w-4 h-4 text-rose-500" />
                <span>کیف تخفیف‌ها</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-800 font-bold">
                  {toPersianDigits(coupons.length)}
                </span>
                <ChevronLeft className="w-4 h-4 opacity-70" />
              </div>
            </button>

            <button
              onClick={() => setActiveTab('reviews')}
              className={`w-full flex items-center justify-between p-3.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'reviews'
                  ? 'bg-[#2C4A2E] text-white shadow-xs'
                  : 'text-gray-700 hover:bg-[#F9F8F5]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                <span>دیدگاه‌ها و نظرات من</span>
              </div>
              <div className="flex items-center gap-1.5">
                {userReviews.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-900 font-black">
                    {toPersianDigits(userReviews.length)}
                  </span>
                )}
                <ChevronLeft className="w-4 h-4 opacity-70" />
              </div>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center justify-between p-3.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-[#2C4A2E] text-white shadow-xs'
                  : 'text-gray-700 hover:bg-[#F9F8F5]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Settings className="w-4 h-4" />
                <span>اطلاعات فردی و تنظیمات</span>
              </div>
              <ChevronLeft className="w-4 h-4 opacity-70" />
            </button>

            {/* Admin Link if Admin */}
            {user.role === 'ADMIN' && (
              <Link
                href="/admin"
                className="w-full flex items-center justify-between p-3.5 rounded-2xl text-xs font-bold bg-purple-50 text-purple-950 hover:bg-purple-100 transition-colors border border-purple-200"
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4 text-purple-700" />
                  <span>ورود به پنل مدیریت سایت</span>
                </div>
                <ExternalLink className="w-4 h-4 opacity-70" />
              </Link>
            )}

            {/* Logout */}
            <button
              onClick={() => {
                logout();
                router.push('/');
              }}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer pt-3 border-t border-gray-100 mt-2"
            >
              <LogOut className="w-4 h-4" />
              <span>خروج از حساب</span>
            </button>
          </div>
        </div>

        {/* Content Area (8 cols on lg) */}
        <div className="lg:col-span-8 space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-in fade-in">
              {/* Welcome Banner */}
              <div className="bg-gradient-to-l from-[#2C4A2E] to-[#1E3520] rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-farm">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#D4A373]/15 rounded-full blur-2xl pointer-events-none" />
                <div className="relative z-10 space-y-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-emerald-200 text-xs font-bold backdrop-blur-md">
                    <Sparkles className="w-3.5 h-3.5 text-[#D4A373]" />
                    <span>خوش آمدید به باشگاه مشتریان مزارع شیراز</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black">
                    سلام، {user.name || 'کاربر گرامی'} عزیز!
                  </h1>
                  <p className="text-xs sm:text-sm text-emerald-100/80 leading-relaxed max-w-xl">
                    سفارشات شما با پیک اختصاصی پروفارم در شهر شیراز توزیع می‌گردند. از اینجا می‌توانید سفارش‌های جاری را پیگیری، فاکتورها را دریافت و اشتراک خود را مدیریت فرمایید.
                  </p>
                </div>
              </div>

              {/* Stats KPIs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-[#E6E1D5] shadow-xs space-y-1 text-center">
                  <span className="text-[11px] text-gray-500 font-bold block">سفارش‌های جاری</span>
                  <span className="text-2xl font-black text-[#2C4A2E]">
                    {toPersianDigits(userOrders.filter((o) => o.status === 'PROCESSING' || o.status === 'OUT_FOR_DELIVERY').length)}
                  </span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-[#E6E1D5] shadow-xs space-y-1 text-center">
                  <span className="text-[11px] text-gray-500 font-bold block">کل سفارش‌ها</span>
                  <span className="text-2xl font-black text-gray-800">
                    {toPersianDigits(userOrders.length)}
                  </span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-[#E6E1D5] shadow-xs space-y-1 text-center">
                  <span className="text-[11px] text-gray-500 font-bold block">کوپن‌های در دسترس</span>
                  <span className="text-2xl font-black text-rose-600">
                    {toPersianDigits(coupons.length)}
                  </span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-[#E6E1D5] shadow-xs space-y-1 text-center">
                  <span className="text-[11px] text-gray-500 font-bold block">آدرس‌های ثبت‌شده</span>
                  <span className="text-2xl font-black text-emerald-700">
                    {toPersianDigits((user.addresses || []).length)}
                  </span>
                </div>
              </div>

              {/* Live Order Tracker (Latest Active or Recent Order) */}
              {activeOrder && (
                <div className="bg-white rounded-3xl p-6 border border-[#E6E1D5] shadow-farm space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#F3EFE6]">
                    <div>
                      <div className="flex items-center gap-2">
                        <Truck className="w-5 h-5 text-[#2C4A2E]" />
                        <h3 className="text-base font-bold text-[#2C4A2E]">
                          ردیابی و وضعیت آخرین سفارش
                        </h3>
                        <span className="font-mono text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-lg">
                          {activeOrder.orderNumber}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        تحویل اختصاصی شیراز | بازه: {activeOrder.deliverySlot?.timeWindow || '۱۵:۰۰ الی ۲۱:۰۰'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {userOrders.length > 1 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] text-gray-400 font-bold hidden sm:inline">سفارش انتخابی:</span>
                          {userOrders.map((ord) => (
                            <button
                              key={ord.id}
                              type="button"
                              onClick={() => setSelectedTrackingOrderId(ord.id)}
                              className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold transition-all cursor-pointer ${
                                activeOrder.id === ord.id
                                  ? 'bg-[#2C4A2E] text-white shadow-xs'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {ord.orderNumber}
                              {ord.status === 'DELIVERED' ? ' (تکمیل‌شده)' : ' (جاری)'}
                            </button>
                          ))}
                        </div>
                      )}

                      <button
                        onClick={() => setSelectedInvoiceOrder(activeOrder)}
                        className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl border border-[#E6E1D5] text-[#2C4A2E] hover:bg-[#F9F8F5] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <FileText className="w-4 h-4 text-emerald-700" />
                        <span>مشاهده فاکتور</span>
                      </button>
                    </div>
                  </div>

                  {/* Prominent Delivered Banner when order is completed and delivered */}
                  {activeOrder.status === 'DELIVERED' && (
                    <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-500/50 flex items-center justify-center gap-3.5 text-emerald-800 shadow-sm animate-in fade-in zoom-in-95">
                      <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-600 shrink-0 stroke-[2.5]" />
                      <span className="text-xl sm:text-2xl lg:text-3xl font-black text-emerald-700 tracking-tight">
                        سفارش تکمیل شده است
                      </span>
                    </div>
                  )}

                  {/* 4-Step Stepper Timeline with Distinct Active Stage Color */}
                  {(() => {
                    const getStepState = (stepIndex: number): 'COMPLETED' | 'ACTIVE' | 'UPCOMING' => {
                      if (activeOrder.status === 'DELIVERED') {
                        return 'COMPLETED';
                      }
                      let currentIdx = 0;
                      if (activeOrder.status === 'PENDING_PAYMENT') currentIdx = 0;
                      else if (activeOrder.status === 'PROCESSING') currentIdx = 1;
                      else if (activeOrder.status === 'OUT_FOR_DELIVERY') currentIdx = 2;

                      if (stepIndex < currentIdx) return 'COMPLETED';
                      if (stepIndex === currentIdx) return 'ACTIVE';
                      return 'UPCOMING';
                    };

                    const steps = [
                      {
                        index: 0,
                        title: 'تایید پرداخت',
                        icon: Check,
                        activeBadge: 'در حال بررسی پرداخت',
                        completedBadge: 'با موفقیت انجام شد',
                        upcomingBadge: 'در صف تایید',
                      },
                      {
                        index: 1,
                        title: 'آماده‌سازی ارگانیک',
                        icon: Package,
                        activeBadge: 'در حال بسته‌بندی در انبار',
                        completedBadge: 'سورتینگ و بسته‌بندی شد',
                        upcomingBadge: 'انبار مرکزی پروفارم',
                      },
                      {
                        index: 2,
                        title: 'پیک پروفارم شیراز',
                        icon: Truck,
                        activeBadge: 'در مسیر توزیع به نشانی شما',
                        completedBadge: 'تحویل سفیر پیک گردید',
                        upcomingBadge: 'در نوبت ارسال',
                      },
                      {
                        index: 3,
                        title: 'تحویل درب منزل',
                        icon: CheckCircle2,
                        activeBadge: 'مامور توزیع در محل',
                        completedBadge: 'تحویل داده شد',
                        upcomingBadge: activeOrder.deliverySlot?.timeWindow || 'بازه ۱۵ الی ۲۱',
                      },
                    ];

                    return (
                      <div className="py-2">
                        <div className="grid grid-cols-4 gap-2 relative">
                          {/* Stepper Connecting Line Behind Circles */}
                          <div className="absolute top-5 left-[12%] right-[12%] h-1 bg-gray-200 -z-0 hidden sm:block">
                            <div
                              className="h-full transition-all duration-500 rounded-full"
                              style={{
                                width:
                                  activeOrder.status === 'DELIVERED'
                                    ? '100%'
                                    : activeOrder.status === 'OUT_FOR_DELIVERY'
                                    ? '66%'
                                    : activeOrder.status === 'PROCESSING'
                                    ? '33%'
                                    : '0%',
                                background:
                                  activeOrder.status === 'DELIVERED'
                                    ? '#059669'
                                    : 'linear-gradient(to left, #F59E0B, #059669)',
                              }}
                            />
                          </div>

                          {steps.map((step) => {
                            const state = getStepState(step.index);
                            const StepIcon = step.icon;

                            return (
                              <div key={step.index} className="text-center space-y-2 relative z-10">
                                {/* Step Circle with Distinct Colors */}
                                <div
                                  className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center mx-auto transition-all duration-300 ${
                                    state === 'COMPLETED'
                                      ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-100'
                                      : state === 'ACTIVE'
                                      ? 'bg-amber-500 text-white ring-4 ring-amber-200 border-2 border-white shadow-lg shadow-amber-500/35 animate-pulse scale-110'
                                      : 'bg-gray-100 text-gray-400 border-2 border-gray-200'
                                  }`}
                                >
                                  {state === 'COMPLETED' ? (
                                    <Check className="w-5 h-5 stroke-[2.5]" />
                                  ) : (
                                    <StepIcon className="w-5 h-5" />
                                  )}
                                </div>

                                {/* Step Titles & Badges */}
                                <div className="space-y-1">
                                  <div
                                    className={`text-xs sm:text-sm transition-colors ${
                                      state === 'ACTIVE'
                                        ? 'font-black text-amber-950'
                                        : state === 'COMPLETED'
                                        ? 'font-bold text-gray-800'
                                        : 'font-medium text-gray-400'
                                    }`}
                                  >
                                    {step.title}
                                  </div>

                                  <div>
                                    {state === 'ACTIVE' ? (
                                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-xs">
                                        <span className="relative flex h-2 w-2">
                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-600"></span>
                                        </span>
                                        <span>{step.activeBadge}</span>
                                      </span>
                                    ) : state === 'COMPLETED' ? (
                                      <span className="text-[10px] sm:text-[11px] text-emerald-700 font-bold">
                                        {step.completedBadge}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] sm:text-[11px] text-gray-400">
                                        {step.upcomingBadge}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Order Items Preview */}
                  <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-gray-600">
                      <span>اقلام: </span>
                      <strong className="text-gray-800">
                        {activeOrder.items.map((i) => `${i.product.title} (${toPersianDigits(i.quantity)})`).join('، ')}
                      </strong>
                    </div>
                    <div className="text-sm font-black text-[#2C4A2E]">
                      {formatToman(activeOrder.totalAmount)}
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Actions Shortcuts */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  onClick={() => setActiveTab('orders')}
                  className="bg-white p-5 rounded-3xl border border-[#E6E1D5] hover:border-[#2C4A2E]/50 transition-all text-right shadow-xs space-y-2 cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-2xl bg-[#2C4A2E]/10 flex items-center justify-center text-[#2C4A2E] group-hover:scale-105 transition-transform">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-[#2C4A2E]">مشاهده تاریخچه سفارشات</h4>
                  <p className="text-xs text-gray-500">مشاهده فاکتورها و خرید مجدد با ۱ کلیک</p>
                </button>

                <button
                  onClick={handleOpenAddAddress}
                  className="bg-white p-5 rounded-3xl border border-[#E6E1D5] hover:border-[#2C4A2E]/50 transition-all text-right shadow-xs space-y-2 cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-800 group-hover:scale-105 transition-transform">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-[#2C4A2E]">ثبت نشانی جدید در شیراز</h4>
                  <p className="text-xs text-gray-500">افزودن آدرس منزل یا محل کار جهت تحویل سریع</p>
                </button>

                <Link
                  href="/products"
                  className="bg-white p-5 rounded-3xl border border-[#E6E1D5] hover:border-[#2C4A2E]/50 transition-all text-right shadow-xs space-y-2 cursor-pointer group block"
                >
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-800 group-hover:scale-105 transition-transform">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-[#2C4A2E]">خرید تازه‌های مزرعه</h4>
                  <p className="text-xs text-gray-500">عسل وحشی، تخم‌مرغ کامفیروز و سبزیجات شیراز</p>
                </Link>
              </div>
            </div>
          )}

          {/* TAB 2: MY ORDERS */}
          {activeTab === 'orders' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-[#2C4A2E]">سفارش‌های من</h2>
                  <p className="text-xs text-gray-500">تاریخچه کامل سفارشات و دسترسی به فاکتورهای رسمی</p>
                </div>

                {/* Status Filter Tabs */}
                <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-gray-100 text-xs font-bold">
                  <button
                    onClick={() => setOrderStatusFilter('ALL')}
                    className={`px-3 py-1.5 rounded-xl transition-all ${
                      orderStatusFilter === 'ALL' ? 'bg-white text-[#2C4A2E] shadow-xs' : 'text-gray-600'
                    }`}
                  >
                    همه ({toPersianDigits(userOrders.length)})
                  </button>
                  <button
                    onClick={() => setOrderStatusFilter('ACTIVE')}
                    className={`px-3 py-1.5 rounded-xl transition-all ${
                      orderStatusFilter === 'ACTIVE' ? 'bg-white text-[#2C4A2E] shadow-xs' : 'text-gray-600'
                    }`}
                  >
                    جاری
                  </button>
                  <button
                    onClick={() => setOrderStatusFilter('DELIVERED')}
                    className={`px-3 py-1.5 rounded-xl transition-all ${
                      orderStatusFilter === 'DELIVERED' ? 'bg-white text-[#2C4A2E] shadow-xs' : 'text-gray-600'
                    }`}
                  >
                    تحویل‌شده
                  </button>
                </div>
              </div>

              {filteredOrders.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 border border-[#E6E1D5] text-center space-y-4 shadow-farm">
                  <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto" />
                  <h3 className="text-base font-bold text-gray-800">هیچ سفارشی در این بخش یافت نشد</h3>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto">
                    می‌توانید همین حالا محصولات تازه و ارگانیک مزارع فارس را مشاهده و سفارش خود را ثبت کنید.
                  </p>
                  <Link
                    href="/products"
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-[#2C4A2E] text-white text-xs font-bold hover:bg-[#1E3520] shadow-sm"
                  >
                    <span>مشاهده کاتالوگ محصولات</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredOrders.map((order) => (
                    <div
                      key={order.id}
                      className="bg-white rounded-3xl p-6 border border-[#E6E1D5] shadow-farm space-y-4 transition-all hover:border-[#2C4A2E]/40"
                    >
                      {/* Order Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#F3EFE6]">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-black text-[#2C4A2E] bg-[#F9F8F5] px-3 py-1 rounded-xl border border-[#E6E1D5]">
                            {order.orderNumber}
                          </span>
                          <span className="text-xs text-gray-500">
                            {order.createdAt ? new Date(order.createdAt).toLocaleDateString('fa-IR') : '۱۴۰۵/۰۶/۱۸'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold border ${
                              order.status === 'DELIVERED'
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : order.status === 'OUT_FOR_DELIVERY'
                                ? 'bg-blue-100 text-blue-900 border-blue-300'
                                : order.status === 'PROCESSING'
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-gray-100 text-gray-800 border-gray-200'
                            }`}
                          >
                            {order.status === 'DELIVERED'
                              ? 'تحویل‌شده'
                              : order.status === 'OUT_FOR_DELIVERY'
                              ? 'در مسیر توزیع با پیک پروفارم'
                              : order.status === 'PROCESSING'
                              ? 'در حال آماده‌سازی'
                              : 'ثبت‌شده'}
                          </span>

                          <span className="text-sm font-black text-[#2C4A2E]">
                            {formatToman(order.totalAmount)}
                          </span>
                        </div>
                      </div>

                      {/* Delivery Slot info */}
                      <div className="flex items-center gap-2 text-xs text-gray-600 bg-[#F9F8F5] p-3 rounded-2xl border border-[#E6E1D5]/60">
                        <Truck className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span>زمان تحویل شیراز:</span>
                        <strong className="text-gray-800">
                          {order.deliverySlot?.date || 'چهارشنبه ۱۸ شهریور'} ({order.deliverySlot?.timeWindow || '۱۵:۰۰ الی ۲۱:۰۰'})
                        </strong>
                      </div>

                      {/* Items Row */}
                      <div className="divide-y divide-gray-100">
                        {order.items.map((item) => (
                          <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-3">
                              {item.product.images?.[0] ? (
                                <img
                                  src={item.product.images[0]}
                                  alt={item.product.title}
                                  className="w-12 h-12 rounded-xl object-cover border border-[#E6E1D5]"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-xl bg-[#2C4A2E]/10 flex items-center justify-center text-[#2C4A2E]">
                                  <Package className="w-6 h-6" />
                                </div>
                              )}
                              <div>
                                <div className="font-bold text-gray-900">{item.product.title}</div>
                                {item.product.packSize && (
                                  <div className="text-[11px] text-gray-500">{item.product.packSize}</div>
                                )}
                                {order.status === 'DELIVERED' && (
                                  <Link
                                    href={`/products/${item.product.slug}?review=true`}
                                    className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-lg border border-amber-200 transition-colors"
                                  >
                                    <Star className="w-3 h-3 text-amber-500 fill-amber-400" />
                                    <span>ثبت نظر و امتیاز برای این کالا</span>
                                  </Link>
                                )}
                              </div>
                            </div>

                            <div className="text-left">
                              <span className="text-gray-500 ml-2">تعداد: {toPersianDigits(item.quantity)}</span>
                              <span className="font-bold font-mono text-[#2C4A2E]">
                                {formatToman(item.unitPrice * item.quantity)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Card Actions */}
                      <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="text-gray-500 text-[11px]">
                          مقصد: {order.address?.streetAddress || 'شیراز'}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTrackingOrderId(order.id);
                              setActiveTab('overview');
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-emerald-200"
                          >
                            <Truck className="w-3.5 h-3.5 text-emerald-700" />
                            <span>ردیابی زنده</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedInvoiceOrder(order)}
                            className="px-3.5 py-1.5 rounded-xl border border-[#E6E1D5] text-[#2C4A2E] hover:bg-[#F9F8F5] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <FileText className="w-4 h-4 text-emerald-700" />
                            <span>فاکتور الکترونیک</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleReorder(order)}
                            className="px-3.5 py-1.5 rounded-xl bg-[#2C4A2E] text-white hover:bg-[#1E3520] font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>خرید مجدد این سبد</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ADDRESSES */}
          {activeTab === 'addresses' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-[#2C4A2E]">دفترچه نشانی‌های شیراز</h2>
                  <p className="text-xs text-gray-500">مدیریت آدرس‌های تحویل پیک پروفارم در مناطق شیراز</p>
                </div>

                <button
                  onClick={handleOpenAddAddress}
                  className="px-4 py-2.5 rounded-2xl bg-[#2C4A2E] text-white text-xs font-bold hover:bg-[#1E3520] transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-[#D4A373]" />
                  <span>+ افزودن نشانی جدید</span>
                </button>
              </div>

              {(user.addresses || []).length === 0 ? (
                <div className="bg-white rounded-3xl p-12 border border-[#E6E1D5] text-center space-y-4 shadow-farm">
                  <MapPin className="w-12 h-12 text-gray-300 mx-auto" />
                  <h3 className="text-base font-bold text-gray-800">هنوز نشانی در شیراز ثبت نکرده‌اید</h3>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto">
                    با ثبت آدرس، سفارش‌های شما در مراحل تسویه حساب با ۱ کلیک ثبت و تحویل سفیر پیک پروفارم خواهند شد.
                  </p>
                  <button
                    onClick={handleOpenAddAddress}
                    className="px-6 py-2.5 rounded-2xl bg-[#2C4A2E] text-white text-xs font-bold hover:bg-[#1E3520]"
                  >
                    افزودن اولین نشانی
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(user.addresses || []).map((addr) => (
                    <div
                      key={addr.id}
                      className={`bg-white rounded-3xl p-6 border transition-all flex flex-col justify-between gap-4 ${
                        addr.isDefault
                          ? 'border-[#2C4A2E] ring-2 ring-[#2C4A2E]/20 shadow-md'
                          : 'border-[#E6E1D5] shadow-farm'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-[#2C4A2E] flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-emerald-700" />
                            {addr.recipientName}
                          </span>
                          {addr.isDefault && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-full font-bold">
                              آدرس پیش‌فرض
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-gray-700 leading-relaxed font-medium">
                          {addr.streetAddress} {addr.unit ? `- ${addr.unit}` : ''}
                        </p>

                        <div className="text-[11px] text-gray-500 flex items-center justify-between pt-1">
                          <span dir="ltr" className="font-mono">
                            {addr.phone}
                          </span>
                          {addr.postalCode && <span>کد پستی: {toPersianDigits(addr.postalCode)}</span>}
                        </div>
                      </div>

                      {/* Address Actions */}
                      <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                        {!addr.isDefault && (
                          <button
                            type="button"
                            onClick={() => setDefaultAddress(addr.id)}
                            className="text-emerald-700 hover:text-emerald-900 font-bold text-[11px] cursor-pointer"
                          >
                            انتخاب به عنوان پیش‌فرض
                          </button>
                        )}
                        {addr.isDefault && <div />}

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEditAddress(addr)}
                            className="p-1.5 rounded-xl text-gray-600 hover:bg-gray-100 cursor-pointer"
                            title="ویرایش نشانی"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteAddress(addr.id)}
                            className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 cursor-pointer"
                            title="حذف نشانی"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SUBSCRIPTION */}
          {activeTab === 'subscription' && (
            <div className="space-y-6 animate-in fade-in">
              <div>
                <h2 className="text-xl font-black text-[#2C4A2E]">اشتراک و باشگاه مزارع فارس</h2>
                <p className="text-xs text-gray-500">مزایا، سهمیه تخفیف تخم‌مرغ محلی و وضعیت ارسال ۶ روزه</p>
              </div>

              {/* Active Plan Card */}
              <div
                className={`rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-2xl ${
                  tier === 'PRO'
                    ? 'bg-gradient-to-br from-[#2C4A2E] via-[#243E26] to-[#122314] border-2 border-[#D4A373]'
                    : tier === 'PLUS'
                    ? 'bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-950 border-2 border-emerald-400'
                    : 'bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-bold">
                      {tier === 'PRO' ? (
                        <Crown className="w-4 h-4 text-[#D4AF37]" />
                      ) : tier === 'PLUS' ? (
                        <Zap className="w-4 h-4 text-emerald-300" />
                      ) : (
                        <UserIcon className="w-4 h-4 text-gray-300" />
                      )}
                      <span>
                        پلن فعال شما:{' '}
                        {tier === 'PRO' ? 'اشتراک پرو' : tier === 'PLUS' ? 'اشتراک پلاس' : 'کاربر عادی (رایگان)'}
                      </span>
                    </div>

                    <span className="text-xs text-white/80 font-mono">
                      اعتبار: {user.proExpiresAt || (tier === 'FREE' ? 'نامحدود' : '۱۴۰۵/۱۲/۲۹')}
                    </span>
                  </div>

                  <h3 className="text-2xl font-black">
                    {tier === 'PRO'
                      ? 'دسترسی کامل به تحویل همه روزه + تخفیف‌های ویژه'
                      : tier === 'PLUS'
                      ? 'ارسال ۶ روز در هفته + تخفیف تخم‌مرغ محلی'
                      : 'ارتقا به پلاس یا پرو برای ارسال روزانه'}
                  </h3>

                  {/* Quota Progress (for Pro & Plus) */}
                  {(tier === 'PRO' || tier === 'PLUS') && (
                    <div className="bg-black/20 backdrop-blur-md p-4 rounded-2xl border border-white/10 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span>سهمیه مصرف‌شده تخم‌مرغ کامفیروز:</span>
                        <span className="font-bold font-mono">
                          {toPersianDigits(user.eggDiscountUsed || 40)} از{' '}
                          {toPersianDigits(tier === 'PRO' ? subSettings.proEggMaxQuota : subSettings.plusEggMaxQuota)} عدد
                        </span>
                      </div>
                      <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-[#D4A373] h-full rounded-full"
                          style={{
                            width: `${Math.min(
                              100,
                              ((user.eggDiscountUsed || 40) /
                                (tier === 'PRO' ? subSettings.proEggMaxQuota : subSettings.plusEggMaxQuota)) *
                                100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Benefits Checklist */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-white/90 pt-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>
                        ارسال {toPersianDigits(tier === 'FREE' ? 2 : 6)} روز در هفته (
                        {tier === 'FREE' ? '۱شنبه و ۴شنبه' : 'شنبه تا ۵شنبه'})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>
                        تخفیف تخم‌مرغ محلی:{' '}
                        {toPersianDigits(
                          tier === 'PRO'
                            ? subSettings.proEggDiscountPercent
                            : tier === 'PLUS'
                            ? subSettings.plusEggDiscountPercent
                            : 0
                        )}
                        ٪
                      </span>
                    </div>
                    {tier === 'PRO' && subSettings.proFeatures && subSettings.proFeatures.length > 0 ? (
                      subSettings.proFeatures.slice(0, 3).map((f, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>{f}</span>
                        </div>
                      ))
                    ) : tier === 'PLUS' && subSettings.plusFeatures && subSettings.plusFeatures.length > 0 ? (
                      subSettings.plusFeatures.slice(0, 3).map((f, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>{f}</span>
                        </div>
                      ))
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>پشتیبانی اولویت‌دار مزارع فارس</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>ارسال سریع و بهداشتی با پیک پروفارم در شیراز</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="pt-2">
                    <Link
                      href="/pro"
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-[#D4A373] text-[#2C4A2E] text-xs font-black hover:bg-[#c29263] transition-colors shadow-md"
                    >
                      <span>مشاهده و تمدید پلن‌های اشتراک</span>
                      <ChevronLeft className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: COUPONS */}
          {activeTab === 'coupons' && (
            <div className="space-y-6 animate-in fade-in">
              <div>
                <h2 className="text-xl font-black text-[#2C4A2E]">کیف کدهای تخفیف</h2>
                <p className="text-xs text-gray-500">کدهای فعال و اختصاصی شما جهت اعمال در سبد خرید</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {coupons.map((c) => (
                  <div
                    key={c.id}
                    className="bg-white rounded-3xl p-5 border border-[#E6E1D5] shadow-farm space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-[#2C4A2E]">{c.title}</span>
                        <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md font-bold">
                          {c.targetType === 'SHIPPING'
                            ? 'ارسال رایگان'
                            : c.discountType === 'PERCENTAGE'
                            ? `${toPersianDigits(c.discountValue)}٪ تخفیف`
                            : `${formatToman(c.discountValue)}`}
                        </span>
                      </div>

                      {c.description && <p className="text-xs text-gray-500">{c.description}</p>}

                      {c.minOrderAmount && (
                        <div className="text-[11px] text-gray-500">
                          حداقل سفارش: {formatToman(c.minOrderAmount)}
                        </div>
                      )}
                    </div>

                    {/* Code Copy Box */}
                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-sm text-[#2C4A2E] bg-[#F9F8F5] px-3 py-1.5 rounded-xl border border-[#E6E1D5]">
                        {c.code}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleCopyCoupon(c.code)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#2C4A2E] text-white text-xs font-bold hover:bg-[#1E3520] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        {copiedCouponCode === c.code ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-300" />
                            <span>کپی شد!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>کپی کد</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E6E1D5] shadow-farm space-y-6 animate-in fade-in">
              <div>
                <h2 className="text-xl font-black text-[#2C4A2E]">اطلاعات فردی و تنظیمات</h2>
                <p className="text-xs text-gray-500">مدیریت اطلاعات هویتی و ترجیحات اعلان پیامکی</p>
              </div>

              {settingsSuccessMsg && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{settingsSuccessMsg}</span>
                </div>
              )}

              {settingsErrorMsg && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  <span>{settingsErrorMsg}</span>
                </div>
              )}

              <form onSubmit={handleSaveSettings} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-gray-700 font-bold mb-1.5">نام و نام خانوادگی:</label>
                    <input
                      type="text"
                      required
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E]"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 font-bold mb-1.5">نام کاربری (جهت ورود با رمز):</label>
                    <input
                      type="text"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      placeholder="مانند: ali_rezaei"
                      dir="ltr"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E] text-left font-mono"
                    />
                    <span className="text-[10px] text-gray-400 mt-1 block">حروف انگلیسی و اعداد بدون فاصله</span>
                  </div>

                  <div>
                    <label className="block text-gray-700 font-bold mb-1.5">شماره تلفن همراه:</label>
                    <input
                      type="tel"
                      disabled
                      value={user.phone}
                      dir="ltr"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-100 text-gray-500 font-mono text-left cursor-not-allowed"
                    />
                    <span className="text-[10px] text-gray-400 mt-1 block">جهت تغییر شماره تماس با پشتیبانی هماهنگ فرمایید.</span>
                  </div>

                  <div>
                    <label className="block text-gray-700 font-bold mb-1.5">کلمه عبور جدید (اختیاری):</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPasswordInput}
                        onChange={(e) => setNewPasswordInput(e.target.value)}
                        placeholder="حداقل ۴ کاراکتر"
                        dir="ltr"
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E] text-left font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute left-2.5 top-2.5 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <span className="text-[10px] text-gray-400 mt-1 block">جهت فعال‌سازی ورود با رمز، کلمه عبور را ثبت کنید.</span>
                  </div>

                  <div>
                    <label className="block text-gray-700 font-bold mb-1.5">پست الکترونیک (اختیاری):</label>
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="example@domain.com"
                      dir="ltr"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E] text-left"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 font-bold mb-1.5">کد ملی (جهت فاکتور رسمی):</label>
                    <input
                      type="text"
                      value={nationalIdInput}
                      onChange={(e) => setNationalIdInput(e.target.value)}
                      placeholder="۲۲۸xxxxxxx"
                      dir="ltr"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E] text-left"
                    />
                  </div>
                </div>

                {/* SMS Notification Preference */}
                <div className="pt-3 border-t border-gray-100 space-y-3">
                  <span className="text-xs font-bold text-gray-800 block">تنظیمات اعلان پیامکی:</span>
                  <label className="flex items-center gap-3 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={smsNotificationInput}
                      onChange={(e) => setSmsNotificationInput(e.target.checked)}
                      className="w-4 h-4 rounded text-[#2C4A2E] focus:ring-[#2C4A2E]"
                    />
                    <span>دریافت پیامک خودکار مراحل آماده‌سازی و تحویل پیک پروفارم در شیراز</span>
                  </label>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-2xl bg-[#2C4A2E] text-white text-xs font-bold hover:bg-[#1E3520] transition-colors shadow-sm cursor-pointer"
                  >
                    ذخیره تغییرات پروفایل
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 7: REVIEWS */}
          {activeTab === 'reviews' && (
            <div className="space-y-6 animate-in fade-in">
              {/* Header */}
              <div className="bg-white rounded-3xl p-6 border border-[#E6E1D5] shadow-farm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
                    <h3 className="text-base font-black text-[#2C4A2E]">
                      دیدگاه‌ها و نظرات ثبت‌شده من
                    </h3>
                  </div>
                  <p className="text-xs text-gray-500">
                    وضعیت تایید و انتشار نظرات شما برای خریدهای ارگانیک مزارع پروفارم شیراز
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-xl bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200">
                    {toPersianDigits(userReviews.length)} نظر ثبت شده
                  </span>
                </div>
              </div>

              {/* Reviews Summary Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-[#E6E1D5] text-center space-y-1">
                  <span className="text-[11px] text-gray-500 font-bold block">کل دیدگاه‌ها</span>
                  <span className="text-xl font-black text-gray-800">
                    {toPersianDigits(userReviews.length)}
                  </span>
                </div>
                <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200 text-center space-y-1">
                  <span className="text-[11px] text-emerald-800 font-bold block">تایید و منتشر شده</span>
                  <span className="text-xl font-black text-emerald-700">
                    {toPersianDigits(userReviews.filter((r) => r.status === 'APPROVED').length)}
                  </span>
                </div>
                <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200 text-center space-y-1">
                  <span className="text-[11px] text-amber-800 font-bold block">در انتظار بررسی ادمین</span>
                  <span className="text-xl font-black text-amber-700">
                    {toPersianDigits(userReviews.filter((r) => r.status === 'PENDING').length)}
                  </span>
                </div>
              </div>

              {/* Delivered Products Ready for Review CTA */}
              {(() => {
                // Find all delivered products from user orders that don't have a review yet
                const reviewedSlugs = new Set(userReviews.map((r) => r.productSlug));
                const deliveredItemsToReview: { product: any; orderNumber: string }[] = [];
                userOrders
                  .filter((o) => o.status === 'DELIVERED')
                  .forEach((ord) => {
                    ord.items.forEach((item) => {
                      if (!reviewedSlugs.has(item.product.slug)) {
                        deliveredItemsToReview.push({ product: item.product, orderNumber: ord.orderNumber });
                      }
                    });
                  });

                if (deliveredItemsToReview.length === 0) return null;

                return (
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50/50 rounded-3xl p-6 border border-amber-200/80 space-y-4 shadow-xs">
                    <div className="flex items-center gap-2 text-amber-900">
                      <Sparkles className="w-5 h-5 text-amber-600" />
                      <h4 className="text-sm font-black">
                        کالاهای تحویل‌شده آماده ثبت دیدگاه ({toPersianDigits(deliveredItemsToReview.length)} کالا)
                      </h4>
                    </div>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      با ثبت تجربه خود درباره این کالاها، به سایر همشهریان شیرازی در انتخاب بهترین محصولات ارگانیک کمک نمایید:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {deliveredItemsToReview.slice(0, 4).map(({ product: prod, orderNumber }, idx) => (
                        <div
                          key={idx}
                          className="bg-white p-3.5 rounded-2xl border border-amber-200 flex items-center justify-between gap-3 shadow-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {prod.images?.[0] && (
                              <img
                                src={prod.images[0]}
                                alt={prod.title}
                                className="w-11 h-11 rounded-xl object-cover border border-gray-100 shrink-0"
                              />
                            )}
                            <div className="truncate">
                              <span className="font-bold text-gray-900 text-xs truncate block">
                                {prod.title}
                              </span>
                              <span className="text-[10px] text-gray-400">سفارش {orderNumber}</span>
                            </div>
                          </div>

                          <Link
                            href={`/products/${prod.slug}?review=true`}
                            className="px-3 py-1.5 rounded-xl bg-[#2C4A2E] hover:bg-[#1E3520] text-white text-[11px] font-bold shrink-0 transition-colors flex items-center gap-1 shadow-xs"
                          >
                            <Star className="w-3 h-3 text-[#D4AF37] fill-[#D4AF37]" />
                            <span>ثبت نظر</span>
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* User Reviews List */}
              {userReviews.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 border border-[#E6E1D5] text-center space-y-3 shadow-farm">
                  <Star className="w-12 h-12 text-gray-300 mx-auto" />
                  <h4 className="text-sm font-bold text-gray-800">هنوز دیدگاهی ثبت نکرده‌اید</h4>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto">
                    پس از تحویل هر سفارش توسط پیک، می‌توانید با مراجعه به صفحه محصولات خریداری‌شده، نظر و امتیاز ارزشمند خود را به اشتراک بگذارید.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {userReviews.map((review) => (
                    <div
                      key={review.id}
                      className="bg-white rounded-3xl p-6 border border-[#E6E1D5] shadow-farm space-y-3.5"
                    >
                      {/* Review Top */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100">
                        <div>
                          <Link
                            href={`/products/${review.productSlug}`}
                            className="font-black text-gray-900 hover:text-[#2C4A2E] text-sm flex items-center gap-1.5"
                          >
                            <span>{review.productTitle}</span>
                            <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                          </Link>
                          <span className="text-[11px] text-gray-400 mt-0.5 block">
                            تاریخ ثبت: {review.createdAt} • کد رهگیری سفارش: {review.orderId || 'نامشخص'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Rating */}
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`w-3.5 h-3.5 ${
                                  s <= review.rating
                                    ? 'text-amber-400 fill-amber-400'
                                    : 'text-gray-200 fill-gray-200'
                                }`}
                              />
                            ))}
                          </div>

                          {/* Status Badge */}
                          {review.status === 'PENDING' && (
                            <span className="px-2.5 py-1 rounded-xl bg-amber-100 text-amber-800 font-bold text-[11px] flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>در انتظار تایید ادمین</span>
                            </span>
                          )}
                          {review.status === 'APPROVED' && (
                            <span className="px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-[11px] flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>تایید و منتشر شده</span>
                            </span>
                          )}
                          {review.status === 'REJECTED' && (
                            <span className="px-2.5 py-1 rounded-xl bg-rose-100 text-rose-800 font-bold text-[11px]">
                              رد شده
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="space-y-1.5">
                        {review.title && (
                          <h5 className="font-bold text-gray-900 text-xs sm:text-sm">{review.title}</h5>
                        )}
                        <p className="text-gray-700 text-xs leading-relaxed font-medium">
                          {review.comment}
                        </p>
                      </div>

                      {/* Official Admin Response */}
                      {review.adminResponse && (
                        <div className="p-3.5 rounded-2xl bg-[#2C4A2E]/5 border border-[#2C4A2E]/15 space-y-1">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#2C4A2E]">
                            <CornerDownLeft className="w-3.5 h-3.5" />
                            <span>پاسخ رسمی پشتیبانی مزارع پروفارم شیراز:</span>
                          </div>
                          <p className="text-xs text-gray-800 pr-5 leading-relaxed font-medium">
                            {review.adminResponse}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ADD/EDIT ADDRESS MODAL */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 sm:p-8 space-y-5 shadow-2xl border border-[#E6E1D5]">
            <div className="flex items-center justify-between pb-3 border-b border-[#F3EFE6]">
              <h3 className="text-base font-bold text-[#2C4A2E]">
                {editingAddressId ? 'ویرایش نشانی تحویل' : 'افزودن نشانی جدید در شیراز'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddressModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {addressError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
                {addressError}
              </div>
            )}

            <form onSubmit={handleSaveAddress} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">نام تحویل‌گیرنده:</label>
                  <input
                    type="text"
                    required
                    value={addressRecipient}
                    onChange={(e) => setAddressRecipient(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5]"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1">شماره تماس تحویل‌گیرنده:</label>
                  <input
                    type="tel"
                    required
                    value={addressPhone}
                    onChange={(e) => setAddressPhone(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] text-left"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">شهر:</label>
                <input
                  type="text"
                  disabled
                  value="شیراز"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">نشانی دقیق (بلوار، خیابان، کوچه):</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: بلوار ارم، کوچه ۶، پلاک ۱۲"
                  value={addressStreet}
                  onChange={(e) => setAddressStreet(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">پلاک / واحد:</label>
                  <input
                    type="text"
                    placeholder="واحد ۲"
                    value={addressUnit}
                    onChange={(e) => setAddressUnit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5]"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1">کد پستی ۱۰ رقمی:</label>
                  <input
                    type="text"
                    placeholder="۷۱۹xxxxxxx"
                    value={addressPostalCode}
                    onChange={(e) => setAddressPostalCode(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] text-left"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addressIsDefault}
                    onChange={(e) => setAddressIsDefault(e.target.checked)}
                    className="w-4 h-4 rounded text-[#2C4A2E]"
                  />
                  <span>تنظیم به عنوان نشانی پیش‌فرض تحویل</span>
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddressModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#2C4A2E] text-white font-bold cursor-pointer hover:bg-[#1E3520]"
                >
                  ذخیره نشانی
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* USER INVOICE MODAL */}
      <UserInvoiceModal
        order={selectedInvoiceOrder}
        onClose={() => setSelectedInvoiceOrder(null)}
      />
    </div>
  );
}

export default function UserAccountPage() {
  return (
    <React.Suspense
      fallback={
        <div className="max-w-6xl mx-auto px-4 py-24 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
          <div className="w-5 h-5 border-2 border-[#2C4A2E] border-t-transparent rounded-full animate-spin" />
          <span>در حال بارگذاری ناحیه کاربری مزارع شیراز...</span>
        </div>
      }
    >
      <AccountContent />
    </React.Suspense>
  );
}
