'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { Order, Address, OrderItem } from '@/types';
import { formatToman, toPersianDigits, toEnglishDigits, isValidIranPhone, normalizePhoneNumber } from '@/lib/formatters';
import { CopyOrderNumber } from '@/components/modules/CopyOrderNumber';
import { getOrderStatusMeta } from '@/lib/site-config';
import { UserInvoiceModal } from '@/components/modules/UserInvoiceModal';
import { useConfirm } from '@/components/ui/ToastProvider';
import {
  User as UserIcon,
  ShoppingBag,
  MapPin,
  Crown,
  Zap,
  Settings,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Edit2,
  FileText,
  RotateCcw,
  ShieldCheck,

  ExternalLink,
  Undo2,
} from 'lucide-react';

type TabType = 'overview' | 'orders' | 'addresses' | 'subscription' | 'settings';
const TABS: { id: TabType; label: string }[] = [
  { id: 'overview', label: 'نمای کلی' },
  { id: 'orders', label: 'سفارش‌ها و مرجوعی‌ها' },
  { id: 'addresses', label: 'دفترچه نشانی' },
  { id: 'subscription', label: 'اشتراک' },
  { id: 'settings', label: 'اطلاعات حساب' },
];

const RETURN_REASONS: { value: string; label: string }[] = [
  { value: 'DAMAGE_IN_TRANSIT', label: 'آسیب‌دیدگی در حمل' },
  { value: 'QUALITY_ISSUE', label: 'کیفیت نامطلوب' },
  { value: 'WRONG_ITEM', label: 'کالای اشتباه' },
  { value: 'CUSTOMER_CANCEL', label: 'انصراف از خرید' },
];
const RETURN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

interface OwnReturn {
  id: string;
  orderNumber: string;
  productTitle: string | null;
  quantity: number | null;
  reasonTitle: string | null;
  reason: string;
  refundAmount: number;
  status: string;
  createdAt: string;
}

interface PlanSummary {
  monthlyPrice: number;
  eggQuota: number;
  eggDiscountPercent: number;
  deliveryDaysPerWeek: number;
  isFull: boolean;
}

const EMPTY_ADDRESS = {
  recipientName: '',
  phone: '',
  province: 'فارس',
  city: 'شیراز',
  postalCode: '',
  streetAddress: '',
  unit: '',
  isDefault: false,
};

const ACTIVE_STATUSES = new Set(['PENDING_PAYMENT', 'PROCESSING', 'OUT_FOR_DELIVERY']);

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  return toPersianDigits(new Date(ms).toLocaleDateString('fa-IR'));
}

function AccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirm = useConfirm();
  const { user, isAuthenticated, profileLoaded, logout, refreshProfile } = useAuth();
  const { addLine, refreshCatalog } = useCart();

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Orders and returns
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersPage, setOrdersPage] = useState(0);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DELIVERED' | 'CANCELLED'>('ALL');
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
  const [returns, setReturns] = useState<OwnReturn[]>([]);
  const [returnOrder, setReturnOrder] = useState<Order | null>(null);
  const [returnReason, setReturnReason] = useState(RETURN_REASONS[0].value);
  const [returnDescription, setReturnDescription] = useState('');
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returnSaving, setReturnSaving] = useState(false);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);

  // Addresses
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressModal, setAddressModal] = useState<{ id: string | null } | null>(null);
  const [addressForm, setAddressForm] = useState(EMPTY_ADDRESS);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [addressSaving, setAddressSaving] = useState(false);

  // Subscription plans
  const [plans, setPlans] = useState<{ PLUS?: PlanSummary; PRO?: PlanSummary }>({});

  // Settings form (pre-filled once per account, so later edits are not overwritten)
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [smsInput, setSmsInput] = useState(true);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  // Accounts created by OTP have no password yet: the first password is set without the current one.
  const hasPassword = user?.hasPassword === true;
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const settingsInitFor = React.useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const tabParam = searchParams.get('tab') as TabType | null;
    if (tabParam && TABS.some((t) => t.id === tabParam)) setActiveTab(tabParam);
  }, [searchParams]);

  useEffect(() => {
    if (!user || settingsInitFor.current === user.id) return;
    settingsInitFor.current = user.id;
    setNameInput(user.name || '');
    setEmailInput(user.email || '');
    setUsernameInput(user.username || '');
    setSmsInput(user.smsNotificationEnabled !== false);
  }, [user]);

  const loadOrders = useCallback(async (page: number) => {
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const res = await fetch(`/api/orders?page=${page}&pageSize=20`, { cache: 'no-store' });
      if (res.status === 401) {
        setOrdersError('برای مشاهده سفارش‌ها وارد حساب شوید.');
        return;
      }
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || 'خطا در دریافت سفارش‌ها');
      setOrders((prev) => (page === 1 ? data.orders : [...prev, ...data.orders]));
      setOrdersPage(data.pagination.page);
      setOrdersTotal(data.pagination.total);
    } catch (err: unknown) {
      setOrdersError(err instanceof Error ? err.message : 'خطا در دریافت سفارش‌ها');
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const loadReturns = useCallback(async () => {
    try {
      const res = await fetch('/api/returns', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data?.success) setReturns(data.returns);
    } catch {
      // keep the previous list
    }
  }, []);

  const loadAddresses = useCallback(async () => {
    try {
      const res = await fetch('/api/account/addresses', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data?.success) setAddresses(data.addresses);
    } catch {
      // keep the previous list
    }
  }, []);

  useEffect(() => {
    if (!mounted || !isAuthenticated) return;
    void loadOrders(1);
    void loadReturns();
    void loadAddresses();
    fetch('/api/subscriptions', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.plans) setPlans(data.plans);
      })
      .catch(() => {});
  }, [mounted, isAuthenticated, loadOrders, loadReturns, loadAddresses]);

  if (!mounted || !profileLoaded) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-farm-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-farm-primary/10 flex items-center justify-center text-farm-primary mx-auto">
          <UserIcon className="w-8 h-8" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-black text-farm-primary">ورود به ناحیه کاربری</h1>
        <p className="text-sm text-gray-600 leading-relaxed">
          برای دیدن سفارش‌ها، دفترچه نشانی و وضعیت اشتراک، لطفاً وارد حساب کاربری خود شوید.
        </p>
        <Link
          href="/login?redirect=/account"
          className="inline-flex min-h-11 items-center px-8 py-3.5 rounded-2xl bg-farm-primary text-white font-bold text-sm hover:bg-farm-primary-dark transition-colors shadow-md"
        >
          ورود به حساب کاربری
        </Link>
      </div>
    );
  }

  const tier = user.tier || (user.isProMember ? 'PRO' : 'FREE');
  const currentPlan = tier === 'PRO' ? plans.PRO : tier === 'PLUS' ? plans.PLUS : undefined;
  const activeOrders = orders.filter((o) => ACTIVE_STATUSES.has(o.status));

  const filteredOrders = orders.filter((o) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'ACTIVE') return ACTIVE_STATUSES.has(o.status);
    if (statusFilter === 'DELIVERED') return o.status === 'DELIVERED';
    return o.status === 'CANCELLED';
  });

  const handleLogout = async () => {
    logout();
    router.push('/');
  };

  const handleReorder = async (order: Order) => {
    // Only ids and quantities are copied from the old order. Price and stock come from the current catalog,
    // and refreshCatalog clamps each quantity to the stock that is available now.
    order.items.forEach((item: OrderItem) => {
      const productId = item.productId || item.product?.id;
      if (productId) addLine(productId, item.quantity);
    });
    await refreshCatalog();
    const catalogFailed = useCart.getState().catalogError;
    setMessage({
      kind: catalogFailed ? 'err' : 'ok',
      text: catalogFailed
        ? `اقلام سفارش ${order.orderNumber} اضافه شد، اما قیمت و موجودی فعلی دریافت نشد. سبد خرید را بررسی کنید.`
        : `اقلام سفارش ${order.orderNumber} به سبد خرید اضافه شد. قیمت و موجودی بر اساس وضعیت فعلی فروشگاه بررسی شد.`,
    });
  };

  const handlePayAgain = async (order: Order) => {
    setMessage(null);
    setPayingOrderId(order.id);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(order.id)}/retry-payment`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success || !data.paymentUrl) {
        throw new Error(data?.message || 'خطا در ایجاد درخواست پرداخت مجدد');
      }
      window.location.href = data.paymentUrl;
    } catch (err: unknown) {
      setMessage({ kind: 'err', text: err instanceof Error ? err.message : 'خطا در ایجاد درخواست پرداخت مجدد' });
      setPayingOrderId(null);
    }
  };

  const openReturn = (order: Order) => {
    const qty: Record<string, number> = {};
    order.items.forEach((it) => {
      qty[it.productId] = 0;
    });
    setReturnQty(qty);
    setReturnReason(RETURN_REASONS[0].value);
    setReturnDescription('');
    setReturnError(null);
    setReturnOrder(order);
  };

  const submitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnOrder) return;
    const items = Object.entries(returnQty)
      .filter(([, q]) => q > 0)
      .map(([productId, quantity]) => ({ productId, quantity }));
    if (items.length === 0) {
      setReturnError('حداقل یک کالا با تعداد بیشتر از صفر انتخاب کنید.');
      return;
    }
    setReturnSaving(true);
    setReturnError(null);
    try {
      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: returnOrder.orderNumber,
          reason: returnReason,
          description: returnDescription.trim(),
          items,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || 'خطا در ثبت درخواست مرجوعی');
      setReturnOrder(null);
      setMessage({ kind: 'ok', text: data.message || 'درخواست مرجوعی ثبت شد.' });
      void loadReturns();
    } catch (err: unknown) {
      setReturnError(err instanceof Error ? err.message : 'خطا در ثبت درخواست مرجوعی');
    } finally {
      setReturnSaving(false);
    }
  };

  const openAddAddress = () => {
    setAddressForm({ ...EMPTY_ADDRESS, recipientName: user.name || '', phone: user.phone || '', isDefault: addresses.length === 0 });
    setAddressError(null);
    setAddressModal({ id: null });
  };

  const openEditAddress = (a: Address) => {
    setAddressForm({
      recipientName: a.recipientName,
      phone: a.phone,
      province: a.province || 'فارس',
      city: a.city,
      postalCode: a.postalCode,
      streetAddress: a.streetAddress,
      unit: a.unit || '',
      isDefault: !!a.isDefault,
    });
    setAddressError(null);
    setAddressModal({ id: a.id });
  };

  const saveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    const f = addressForm;
    const cleanPostal = toEnglishDigits(f.postalCode).replace(/[\s-]/g, '');
    if (!f.recipientName.trim()) return setAddressError('لطفاً نام تحویل‌گیرنده را وارد کنید.');
    if (!isValidIranPhone(f.phone)) return setAddressError('شماره موبایل نامعتبر است (مثال: ۰۹۱۷۱۲۳۴۵۶۷).');
    if (!f.city.trim()) return setAddressError('لطفاً شهر را وارد کنید.');
    if (!f.streetAddress.trim()) return setAddressError('لطفاً نشانی دقیق را وارد کنید.');
    if (!/^\d{10}$/.test(cleanPostal)) return setAddressError('کد پستی باید ۱۰ رقم باشد.');

    const payload = {
      recipientName: f.recipientName.trim(),
      phone: normalizePhoneNumber(toEnglishDigits(f.phone)),
      province: f.province.trim() || 'فارس',
      city: f.city.trim(),
      postalCode: cleanPostal,
      streetAddress: f.streetAddress.trim(),
      unit: f.unit.trim() || null,
      isDefault: f.isDefault,
    };

    setAddressSaving(true);
    setAddressError(null);
    try {
      const editing = addressModal?.id;
      const res = await fetch('/api/account/addresses', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { id: editing, ...payload } : payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || 'خطا در ذخیره نشانی');
      setAddresses(data.addresses);
      setAddressModal(null);
    } catch (err: unknown) {
      setAddressError(err instanceof Error ? err.message : 'خطا در ذخیره نشانی');
    } finally {
      setAddressSaving(false);
    }
  };

  const changeAddress = async (method: 'PATCH' | 'DELETE', body: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/account/addresses', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || 'خطا در به‌روزرسانی نشانی');
      setAddresses(data.addresses);
    } catch (err: unknown) {
      setMessage({ kind: 'err', text: err instanceof Error ? err.message : 'خطا در به‌روزرسانی نشانی' });
    }
  };

  const deleteAddress = async (a: Address) => {
    const ok = await confirm({
      title: 'حذف نشانی',
      description: `نشانی «${a.streetAddress}» از دفترچه حذف شود؟`,
      confirmLabel: 'بله، حذف شود',
      cancelLabel: 'انصراف',
      variant: 'danger',
    });
    if (ok) await changeAddress('DELETE', { id: a.id });
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsError(null);
    if (newPasswordInput && newPasswordInput.length < 8) {
      setSettingsError('کلمه عبور جدید باید حداقل ۸ کاراکتر باشد.');
      return;
    }
    if (newPasswordInput && hasPassword && !currentPasswordInput) {
      setSettingsError('برای تغییر کلمه عبور، کلمه عبور فعلی را وارد کنید.');
      return;
    }
    setSettingsSaving(true);
    try {
      const res = await fetch('/api/auth/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameInput.trim() || user.name,
          email: emailInput.trim() || null,
          username: usernameInput.trim() || undefined,
          smsNotificationEnabled: smsInput,
          ...(newPasswordInput ? { password: newPasswordInput, currentPassword: currentPasswordInput } : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || 'خطا در ذخیره تغییرات');
      setNewPasswordInput('');
      setCurrentPasswordInput('');
      await refreshProfile();
      setMessage({ kind: 'ok', text: data.message || 'تغییرات حساب کاربری ذخیره شد.' });
    } catch (err: unknown) {
      setSettingsError(err instanceof Error ? err.message : 'خطا در ذخیره تغییرات');
    } finally {
      setSettingsSaving(false);
    }
  };

  const inputClass =
    'w-full min-h-11 px-3.5 py-2.5 rounded-xl border border-farm-border bg-farm-bg focus:bg-white focus:outline-none focus:border-farm-primary text-base sm:text-sm';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {message && (
        <div
          role={message.kind === 'err' ? 'alert' : 'status'}
          className={`p-4 rounded-2xl border text-sm font-bold flex items-center justify-between gap-3 ${
            message.kind === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.kind === 'ok' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" aria-hidden="true" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600" aria-hidden="true" />
            )}
            <span>{message.text}</span>
          </div>
          <button type="button" onClick={() => setMessage(null)} className="min-h-11 px-2 text-xs underline">
            بستن
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Sidebar */}
        <aside className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-farm-border shadow-farm flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-farm-primary text-white flex items-center justify-center font-black text-2xl shadow-md border-2 border-[#D4A373] shrink-0">
              {user.name ? user.name.slice(0, 1) : 'پ'}
            </div>
            <div className="space-y-1 min-w-0">
              <h1 className="text-base font-black text-farm-primary truncate">{user.name || 'کاربر گرامی'}</h1>
              {user.phone && (
                <p className="text-xs text-gray-500 font-mono" dir="ltr">
                  {toPersianDigits(user.phone)}
                </p>
              )}
              {user.role === 'ADMIN' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-900 border border-purple-200">
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" /> مدیر مزارع
                </span>
              ) : tier === 'PRO' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  <Crown className="w-3.5 h-3.5" aria-hidden="true" /> مشترک پرو
                </span>
              ) : tier === 'PLUS' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                  <Zap className="w-3.5 h-3.5" aria-hidden="true" /> مشترک پلاس
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                  کاربر عادی
                </span>
              )}
            </div>
          </div>

          <nav aria-label="بخش‌های حساب کاربری" className="bg-white rounded-3xl p-3 border border-farm-border shadow-farm space-y-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                aria-current={activeTab === t.id ? 'page' : undefined}
                className={`w-full min-h-11 flex items-center justify-between px-3.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === t.id ? 'bg-farm-primary text-white shadow-xs' : 'text-gray-700 hover:bg-farm-bg'
                }`}
              >
                <span>{t.label}</span>
                {t.id === 'orders' && activeOrders.length > 0 && (
                  <span className="min-w-6 h-6 px-1.5 rounded-full bg-amber-400 text-amber-950 text-xs flex items-center justify-center">
                    {toPersianDigits(activeOrders.length)}
                  </span>
                )}
              </button>
            ))}
            {user.role === 'ADMIN' && (
              <Link href="/admin" className="w-full min-h-11 flex items-center justify-between px-3.5 rounded-2xl text-xs font-bold text-purple-900 hover:bg-purple-50">
                <span>پنل مدیریت</span>
                <ExternalLink className="w-4 h-4 opacity-70" aria-hidden="true" />
              </Link>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="w-full min-h-11 flex items-center gap-2 px-3.5 rounded-2xl text-xs font-bold text-rose-700 hover:bg-rose-50 cursor-pointer"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              <span>خروج از حساب</span>
            </button>
          </nav>
        </aside>

        {/* Content */}
        <section className="lg:col-span-8 space-y-6 min-w-0">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-3xl p-5 border border-farm-border shadow-farm">
                  <span className="text-xs text-gray-500">تعداد سفارش‌ها</span>
                  <p className="text-2xl font-black text-farm-primary mt-1">{toPersianDigits(ordersTotal)}</p>
                </div>
                <div className="bg-white rounded-3xl p-5 border border-farm-border shadow-farm">
                  <span className="text-xs text-gray-500">سفارش‌های در جریان</span>
                  <p className="text-2xl font-black text-farm-primary mt-1">{toPersianDigits(activeOrders.length)}</p>
                </div>
                <div className="bg-white rounded-3xl p-5 border border-farm-border shadow-farm">
                  <span className="text-xs text-gray-500">نشانی‌های ذخیره‌شده</span>
                  <p className="text-2xl font-black text-farm-primary mt-1">{toPersianDigits(addresses.length)}</p>
                </div>
              </div>
              <div className="bg-white rounded-3xl p-6 border border-farm-border shadow-farm space-y-3">
                <h2 className="text-lg font-black text-farm-primary">دسترسی سریع</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <button type="button" onClick={() => setActiveTab('orders')} className="min-h-11 p-4 rounded-2xl bg-farm-bg border border-farm-border text-right font-bold text-farm-primary cursor-pointer">
                    پیگیری سفارش‌ها
                  </button>
                  <Link href="/products" className="min-h-11 p-4 rounded-2xl bg-farm-bg border border-farm-border font-bold text-farm-primary flex items-center">
                    خرید تازه‌های مزرعه
                  </Link>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-6 border border-farm-border shadow-farm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-black text-farm-primary">سفارش‌های من</h2>
                  <div role="group" aria-label="فیلتر وضعیت سفارش" className="flex flex-wrap gap-2">
                    {(
                      [
                        ['ALL', 'همه'],
                        ['ACTIVE', 'در جریان'],
                        ['DELIVERED', 'تحویل شده'],
                        ['CANCELLED', 'لغو شده'],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={statusFilter === value}
                        onClick={() => setStatusFilter(value)}
                        className={`min-h-11 px-3.5 rounded-xl text-xs font-bold border cursor-pointer ${
                          statusFilter === value ? 'bg-farm-primary text-white border-farm-primary' : 'bg-white text-gray-700 border-farm-border'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {ordersError && (
                  <p role="alert" className="text-xs text-rose-700 font-bold">
                    {ordersError}
                  </p>
                )}

                {!ordersLoading && !ordersError && filteredOrders.length === 0 && (
                  <div className="py-10 text-center space-y-2">
                    <ShoppingBag className="w-10 h-10 text-gray-400 mx-auto" aria-hidden="true" />
                    <p className="text-sm font-bold text-gray-800">سفارشی در این بخش یافت نشد</p>
                  </div>
                )}

                <ul className="space-y-3">
                  {filteredOrders.map((order) => {
                    const meta = getOrderStatusMeta(order.status);
                    const deliveredAt = Date.parse(order.deliveredAt || order.updatedAt || order.createdAt);
                    const canReturn =
                      order.status === 'DELIVERED' && !order.isSubscription && Date.now() - deliveredAt <= RETURN_WINDOW_MS;
                    const canPayAgain = order.status === 'PENDING_PAYMENT' && order.paymentMethod !== 'cod' && !order.isSubscription;
                    return (
                      <li key={order.id} className="rounded-2xl border border-farm-border p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="space-y-1 min-w-0">
                            <CopyOrderNumber value={order.orderNumber} className="text-sm text-farm-primary" />
                            <p className="text-xs text-gray-500">
                              {formatDate(order.createdAt)} · {formatToman(order.totalAmount)}
                            </p>
                          </div>
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${meta.badgeClass}`}>
                            {meta.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-700 line-clamp-2">
                          {order.items.map((it) => `${it.product?.title || 'کالا'} × ${toPersianDigits(it.quantity)}`).join('، ')}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => setInvoiceOrder(order)} className="min-h-11 px-3.5 rounded-xl border border-farm-border text-xs font-bold text-farm-primary inline-flex items-center gap-1.5 cursor-pointer">
                            <FileText className="w-4 h-4" aria-hidden="true" /> فاکتور
                          </button>
                          {!order.isSubscription && (
                            <button type="button" onClick={() => handleReorder(order)} className="min-h-11 px-3.5 rounded-xl border border-farm-border text-xs font-bold text-farm-primary inline-flex items-center gap-1.5 cursor-pointer">
                              <RotateCcw className="w-4 h-4" aria-hidden="true" /> افزودن دوباره به سبد
                            </button>
                          )}
                          {canPayAgain && (
                            <button
                              type="button"
                              onClick={() => handlePayAgain(order)}
                              disabled={payingOrderId === order.id}
                              className="min-h-11 px-3.5 rounded-xl bg-farm-primary text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                            >
                              {payingOrderId === order.id ? 'در حال اتصال...' : 'پرداخت مجدد'}
                            </button>
                          )}
                          {canReturn && (
                            <button type="button" onClick={() => openReturn(order)} className="min-h-11 px-3.5 rounded-xl border border-amber-300 bg-amber-50 text-xs font-bold text-amber-900 inline-flex items-center gap-1.5 cursor-pointer">
                              <Undo2 className="w-4 h-4" aria-hidden="true" /> درخواست مرجوعی
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {orders.length < ordersTotal && (
                  <button
                    type="button"
                    onClick={() => loadOrders(ordersPage + 1)}
                    disabled={ordersLoading}
                    className="w-full min-h-11 rounded-xl border border-farm-border text-xs font-bold text-farm-primary cursor-pointer disabled:opacity-60"
                  >
                    {ordersLoading ? 'در حال بارگذاری...' : 'نمایش سفارش‌های بیشتر'}
                  </button>
                )}
              </div>

              <div className="bg-white rounded-3xl p-6 border border-farm-border shadow-farm space-y-3">
                <h2 className="text-lg font-black text-farm-primary">درخواست‌های مرجوعی</h2>
                {returns.length === 0 ? (
                  <p className="text-xs text-gray-600">درخواست مرجوعی ثبت نشده است.</p>
                ) : (
                  <ul className="space-y-2">
                    {returns.map((r) => (
                      <li key={r.id} className="rounded-xl border border-farm-border p-3 text-xs flex flex-wrap justify-between gap-2">
                        <span className="font-bold text-gray-800">
                          {r.productTitle || 'کالا'} × {toPersianDigits(r.quantity ?? 1)} ({r.reasonTitle || r.reason})
                        </span>
                        <span className="text-gray-600">
                          {formatDate(r.createdAt)} · {r.status === 'PENDING' ? 'در انتظار بررسی' : r.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {activeTab === 'addresses' && (
            <div className="bg-white rounded-3xl p-6 border border-farm-border shadow-farm space-y-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-black text-farm-primary">دفترچه نشانی</h2>
                <button type="button" onClick={openAddAddress} disabled={addresses.length >= 10} className="min-h-11 px-4 rounded-xl bg-farm-primary text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                  <Plus className="w-4 h-4" aria-hidden="true" /> نشانی جدید
                </button>
              </div>

              {addresses.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <MapPin className="w-10 h-10 text-gray-400 mx-auto" aria-hidden="true" />
                  <p className="text-sm font-bold text-gray-800">هنوز نشانی ثبت نکرده‌اید</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {addresses.map((a) => (
                    <li key={a.id} className="rounded-2xl border border-farm-border p-4 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-sm text-gray-900">{a.recipientName}</span>
                        {a.isDefault && (
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                            نشانی پیش‌فرض
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-700 leading-relaxed">
                        {a.province}، {a.city}، {a.streetAddress}
                        {a.unit ? ` (${a.unit})` : ''} · کد پستی {toPersianDigits(a.postalCode)}
                      </p>
                      <p className="text-xs text-gray-500 font-mono" dir="ltr">
                        {toPersianDigits(a.phone)}
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button type="button" onClick={() => openEditAddress(a)} className="min-h-11 px-3 rounded-xl border border-farm-border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer">
                          <Edit2 className="w-3.5 h-3.5" aria-hidden="true" /> ویرایش
                        </button>
                        {!a.isDefault && (
                          <button type="button" onClick={() => changeAddress('PATCH', { id: a.id, isDefault: true })} className="min-h-11 px-3 rounded-xl border border-farm-border text-xs font-bold cursor-pointer">
                            تنظیم به عنوان پیش‌فرض
                          </button>
                        )}
                        <button type="button" onClick={() => deleteAddress(a)} className="min-h-11 px-3 rounded-xl border border-rose-200 text-xs font-bold text-rose-700 inline-flex items-center gap-1.5 cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> حذف
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === 'subscription' && (
            <div className="bg-white rounded-3xl p-6 border border-farm-border shadow-farm space-y-5">
              <h2 className="text-lg font-black text-farm-primary">اشتراک و باشگاه مزارع فارس</h2>
              <div className="p-4 rounded-2xl bg-farm-bg border border-farm-border text-sm space-y-2">
                <p>
                  طرح فعلی:{' '}
                  <strong>{tier === 'PRO' ? 'پرو' : tier === 'PLUS' ? 'پلاس' : 'عادی (بدون اشتراک)'}</strong>
                </p>
                {tier !== 'FREE' && (user.proExpiresAt || user.plusExpiresAt) && (
                  <p className="text-xs text-gray-600">
                    اعتبار تا: {formatDate(tier === 'PRO' ? user.proExpiresAt : user.plusExpiresAt)}
                  </p>
                )}
                {currentPlan && (
                  <p className="text-xs text-gray-600">
                    سهمیه تخم‌مرغ با تخفیف: {toPersianDigits(currentPlan.eggQuota)} عدد در ۳۰ روز گذشته
                    {typeof user.eggDiscountUsed === 'number' ? ` (مصرف‌شده: ${toPersianDigits(user.eggDiscountUsed)})` : ''}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(['PLUS', 'PRO'] as const).map((p) => {
                  const plan = plans[p];
                  const isCurrent = tier === p;
                  const blocked = tier === 'PRO' && p === 'PLUS';
                  return (
                    <div key={p} className="rounded-2xl border border-farm-border p-5 space-y-3">
                      <div className="flex items-center gap-2 font-black text-farm-primary">
                        {p === 'PRO' ? <Crown className="w-5 h-5 text-[#D4AF37]" aria-hidden="true" /> : <Zap className="w-5 h-5 text-emerald-600" aria-hidden="true" />}
                        <span>{p === 'PRO' ? 'اشتراک طلایی پرو' : 'اشتراک نقره‌ای پلاس'}</span>
                      </div>
                      {plan ? (
                        <ul className="text-xs text-gray-700 space-y-1">
                          <li>قیمت ماهانه: {formatToman(plan.monthlyPrice)}</li>
                          <li>تحویل {toPersianDigits(plan.deliveryDaysPerWeek)} روز در هفته (شنبه تا پنج‌شنبه)</li>
                          <li>
                            {toPersianDigits(plan.eggDiscountPercent)}٪ تخفیف تخم‌مرغ تا {toPersianDigits(plan.eggQuota)} عدد
                          </li>
                        </ul>
                      ) : (
                        <p className="text-xs text-gray-500">در حال دریافت اطلاعات طرح...</p>
                      )}
                      {blocked ? (
                        <p className="text-xs text-gray-600">اشتراک پرو فعال است؛ خرید پلاس امکان‌پذیر نیست.</p>
                      ) : plan?.isFull && !isCurrent ? (
                        <p className="text-xs text-rose-700 font-bold">ظرفیت این طرح در حال حاضر تکمیل است.</p>
                      ) : (
                        <Link
                          href={`/checkout?subscriptionPlan=${p}`}
                          className="inline-flex min-h-11 items-center justify-center w-full rounded-xl bg-farm-primary text-white text-xs font-bold"
                        >
                          {isCurrent ? 'تمدید اشتراک' : 'خرید اشتراک'}
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <form onSubmit={saveSettings} className="bg-white rounded-3xl p-6 border border-farm-border shadow-farm space-y-5">
              <h2 className="text-lg font-black text-farm-primary">اطلاعات فردی و تنظیمات</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <label htmlFor="acc-name" className="block font-bold text-gray-700 mb-1.5">نام و نام خانوادگی</label>
                  <input id="acc-name" type="text" autoComplete="name" value={nameInput} onChange={(e) => setNameInput(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="acc-email" className="block font-bold text-gray-700 mb-1.5">ایمیل</label>
                  <input id="acc-email" type="email" autoComplete="email" dir="ltr" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className={`${inputClass} text-left`} />
                </div>
                <div>
                  <label htmlFor="acc-username" className="block font-bold text-gray-700 mb-1.5">نام کاربری (اختیاری)</label>
                  <input id="acc-username" type="text" autoComplete="username" dir="ltr" value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} className={`${inputClass} text-left`} />
                </div>
                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2 min-h-11 text-sm font-bold text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={smsInput} onChange={(e) => setSmsInput(e.target.checked)} className="w-5 h-5 accent-farm-primary" />
                    <span>دریافت پیامک وضعیت سفارش</span>
                  </label>
                </div>
              </div>

              <fieldset className="space-y-4 pt-4 border-t border-farm-bg-warm">
                <legend className="text-sm font-black text-farm-primary flex items-center gap-2">
                  <Settings className="w-4 h-4" aria-hidden="true" /> تغییر کلمه عبور
                </legend>
                <p className="text-xs text-gray-500">
                  {hasPassword
                    ? 'برای تغییر کلمه عبور، کلمه عبور فعلی را وارد کنید. کلمه عبور جدید حداقل ۸ کاراکتر است.'
                    : 'این حساب هنوز کلمه عبور ندارد. با ثبت کلمه عبور، ورود با شماره موبایل و کلمه عبور نیز فعال می‌شود (حداقل ۸ کاراکتر).'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  {hasPassword && (
                    <div>
                      <label htmlFor="acc-current-pass" className="block font-bold text-gray-700 mb-1.5">کلمه عبور فعلی</label>
                      <input id="acc-current-pass" type="password" autoComplete="current-password" dir="ltr" value={currentPasswordInput} onChange={(e) => setCurrentPasswordInput(e.target.value)} className={`${inputClass} text-left`} />
                    </div>
                  )}
                  <div>
                    <label htmlFor="acc-new-pass" className="block font-bold text-gray-700 mb-1.5">کلمه عبور جدید</label>
                    <input id="acc-new-pass" type="password" autoComplete="new-password" minLength={8} dir="ltr" value={newPasswordInput} onChange={(e) => setNewPasswordInput(e.target.value)} className={`${inputClass} text-left`} />
                  </div>
                </div>
              </fieldset>

              {settingsError && (
                <p role="alert" className="text-xs text-rose-700 font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" aria-hidden="true" /> {settingsError}
                </p>
              )}
              <button type="submit" disabled={settingsSaving} className="min-h-11 px-6 py-3 rounded-2xl bg-farm-primary text-white text-sm font-bold disabled:opacity-60 cursor-pointer">
                {settingsSaving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
              </button>
            </form>
          )}
        </section>
      </div>

      {/* Address modal */}
      {addressModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="address-dialog-title">
          <form onSubmit={saveAddress} className="w-full max-w-lg bg-white rounded-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 id="address-dialog-title" className="text-lg font-black text-farm-primary">
              {addressModal.id ? 'ویرایش نشانی' : 'نشانی جدید'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <label htmlFor="addr-recipient" className="block font-bold text-gray-700 mb-1.5">نام تحویل‌گیرنده</label>
                <input id="addr-recipient" type="text" required value={addressForm.recipientName} onChange={(e) => setAddressForm({ ...addressForm, recipientName: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label htmlFor="addr-phone" className="block font-bold text-gray-700 mb-1.5">شماره موبایل</label>
                <input id="addr-phone" type="tel" required inputMode="tel" dir="ltr" value={addressForm.phone} onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })} className={`${inputClass} text-left`} />
              </div>
              <div>
                <label htmlFor="addr-city" className="block font-bold text-gray-700 mb-1.5">شهر</label>
                <input id="addr-city" type="text" required value={addressForm.city} onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label htmlFor="addr-postal" className="block font-bold text-gray-700 mb-1.5">کد پستی ۱۰ رقمی</label>
                <input id="addr-postal" type="text" required inputMode="numeric" maxLength={10} dir="ltr" value={addressForm.postalCode} onChange={(e) => setAddressForm({ ...addressForm, postalCode: toEnglishDigits(e.target.value).replace(/\D/g, '').slice(0, 10) })} className={`${inputClass} text-left font-mono`} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="addr-street" className="block font-bold text-gray-700 mb-1.5">نشانی دقیق</label>
                <input id="addr-street" type="text" required value={addressForm.streetAddress} onChange={(e) => setAddressForm({ ...addressForm, streetAddress: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label htmlFor="addr-unit" className="block font-bold text-gray-700 mb-1.5">پلاک / واحد</label>
                <input id="addr-unit" type="text" value={addressForm.unit} onChange={(e) => setAddressForm({ ...addressForm, unit: e.target.value })} className={inputClass} />
              </div>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 min-h-11 font-bold text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={addressForm.isDefault} onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })} className="w-5 h-5 accent-farm-primary" />
                  <span>نشانی پیش‌فرض باشد</span>
                </label>
              </div>
            </div>
            {addressError && (
              <p role="alert" className="text-xs text-rose-700 font-bold">{addressError}</p>
            )}
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={addressSaving} className="flex-1 min-h-11 rounded-2xl bg-farm-primary text-white text-sm font-bold disabled:opacity-60 cursor-pointer">
                {addressSaving ? 'در حال ذخیره...' : 'ذخیره نشانی'}
              </button>
              <button type="button" onClick={() => setAddressModal(null)} className="flex-1 min-h-11 rounded-2xl border border-farm-border text-sm font-bold cursor-pointer">
                انصراف
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Return request modal */}
      {returnOrder && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="return-dialog-title">
          <form onSubmit={submitReturn} className="w-full max-w-lg bg-white rounded-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 id="return-dialog-title" className="text-lg font-black text-farm-primary">
              درخواست مرجوعی سفارش {returnOrder.orderNumber}
            </h2>
            <p className="text-xs text-gray-600">مهلت ثبت مرجوعی ۷ روز پس از تحویل است. هزینه ارسال مسترد نمی‌شود.</p>

            <fieldset className="space-y-2">
              <legend className="text-sm font-bold text-gray-800 mb-1">تعداد هر کالا برای مرجوعی</legend>
              {returnOrder.items.map((it) => (
                <div key={it.productId} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{it.product?.title || 'کالا'} (خریداری: {toPersianDigits(it.quantity)})</span>
                  <input
                    type="number"
                    min={0}
                    max={it.quantity}
                    aria-label={`تعداد مرجوعی ${it.product?.title || 'کالا'}`}
                    value={returnQty[it.productId] ?? 0}
                    onChange={(e) => {
                      const n = Math.min(it.quantity, Math.max(0, Math.floor(Number(e.target.value) || 0)));
                      setReturnQty((prev) => ({ ...prev, [it.productId]: n }));
                    }}
                    className="w-24 min-h-11 px-2 rounded-xl border border-farm-border text-center"
                  />
                </div>
              ))}
            </fieldset>

            <div>
              <label htmlFor="return-reason" className="block text-sm font-bold text-gray-800 mb-1.5">دلیل مرجوعی</label>
              <select id="return-reason" value={returnReason} onChange={(e) => setReturnReason(e.target.value)} className={inputClass}>
                {RETURN_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="return-desc" className="block text-sm font-bold text-gray-800 mb-1.5">توضیحات (اختیاری)</label>
              <textarea id="return-desc" rows={3} maxLength={1000} value={returnDescription} onChange={(e) => setReturnDescription(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-farm-border bg-farm-bg text-base sm:text-sm" />
            </div>

            {returnError && <p role="alert" className="text-xs text-rose-700 font-bold">{returnError}</p>}
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={returnSaving} className="flex-1 min-h-11 rounded-2xl bg-farm-primary text-white text-sm font-bold disabled:opacity-60 cursor-pointer">
                {returnSaving ? 'در حال ثبت...' : 'ثبت درخواست مرجوعی'}
              </button>
              <button type="button" onClick={() => setReturnOrder(null)} className="flex-1 min-h-11 rounded-2xl border border-farm-border text-sm font-bold cursor-pointer">
                انصراف
              </button>
            </div>
          </form>
        </div>
      )}

      <UserInvoiceModal order={invoiceOrder} onClose={() => setInvoiceOrder(null)} />
    </div>
  );
}

export default function UserAccountPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-2 border-farm-primary border-t-transparent animate-spin" />
        </div>
      }
    >
      <AccountContent />
    </Suspense>
  );
}
