'use client';

import React, { useMemo, useState } from 'react';
import { Coupon, CouponTargetType, CouponDiscountType, Product } from '@/types';
import { formatToman, toPersianDigits } from '@/lib/formatters';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/ToastProvider';
import { adminRequest, AdminStatus, useAdminFetch } from '@/components/admin/admin-client';
import {
  TicketPercent,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Truck,
  Package,
  ShoppingBag,
  Clock,
  Sparkles,
  Percent,
  Coins,
  Power,
  Edit2,
  Trash2,
  X,
  Shuffle,
  Tag,
  ArrowUpDown,
  Filter,
} from 'lucide-react';

export default function AdminCouponsPage() {
  const toast = useToast();
  const couponsState = useAdminFetch<{ coupons: Coupon[] }>('/api/admin/coupons');
  const productsState = useAdminFetch<{ products: Product[] }>('/api/admin/products');
  const coupons = useMemo(() => couponsState.data?.coupons ?? [], [couponsState.data]);
  const products = useMemo(() => productsState.data?.products ?? [], [productsState.data]);
  const [activeTab, setActiveTab] = useState<'ALL' | CouponTargetType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  // Form Fields
  const [formCode, setFormCode] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTargetType, setFormTargetType] = useState<CouponTargetType>('ALL_PRODUCTS');
  const [formTargetProductId, setFormTargetProductId] = useState('');
  const [formDiscountType, setFormDiscountType] = useState<CouponDiscountType>('PERCENTAGE');
  const [formDiscountValue, setFormDiscountValue] = useState<number | ''>(15);
  const [formMinOrderAmount, setFormMinOrderAmount] = useState<number | ''>(150000);
  const [formMaxDiscountAmount, setFormMaxDiscountAmount] = useState<number | ''>(50000);
  const [formUsageLimit, setFormUsageLimit] = useState<number | ''>(50);
  const [formExpiresAt, setFormExpiresAt] = useState('1404-06-31');
  const [formIsActive, setFormIsActive] = useState(true);

  const showToast = (msg: string) => toast.success(msg);

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      showToast(`کد «${code}» در کلیپ‌بورد کپی شد.`);
      setTimeout(() => setCopiedCode(null), 2500);
    } catch {
      toast.error('کپی کد انجام نشد. کد را دستی کپی کنید.');
    }
  };

  const generateRandomCode = () => {
    const prefixes = ['SHIRAZ', 'FARM', 'NOOROOZ', 'ORGANIC', 'GOLAB', 'HONEY'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(100 + Math.random() * 900);
    setFormCode(`${prefix}${num}`);
  };

  const openCreateModal = () => {
    setEditingCoupon(null);
    setFormCode('');
    setFormTitle('');
    setFormDescription('');
    setFormTargetType('ALL_PRODUCTS');
    setFormTargetProductId(products[0]?.id || '');
    setFormDiscountType('PERCENTAGE');
    setFormDiscountValue(15);
    setFormMinOrderAmount(150000);
    setFormMaxDiscountAmount(50000);
    setFormUsageLimit(50);
    setFormExpiresAt('1404-06-31');
    setFormIsActive(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormCode(coupon.code);
    setFormTitle(coupon.title);
    setFormDescription(coupon.description || '');
    setFormTargetType(coupon.targetType);
    setFormTargetProductId(coupon.targetProductId || products[0]?.id || '');
    setFormDiscountType(coupon.discountType);
    setFormDiscountValue(coupon.discountValue);
    setFormMinOrderAmount(coupon.minOrderAmount ?? '');
    setFormMaxDiscountAmount(coupon.maxDiscountAmount ?? '');
    setFormUsageLimit(coupon.usageLimit ?? '');
    setFormExpiresAt(coupon.expiresAt || '');
    setFormIsActive(coupon.isActive);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (busyId) return;
    const current = coupons.find((c) => c.id === id);
    if (!current) return;
    const nextActive = !current.isActive;
    setBusyId(id);
    couponsState.setData((prev) =>
      prev ? { ...prev, coupons: prev.coupons.map((c) => (c.id === id ? { ...c, isActive: nextActive } : c)) } : prev
    );
    const result = await adminRequest<{ coupon: Coupon }>('/api/admin/coupons', {
      method: 'PATCH',
      body: { id, action: 'toggle' },
    });
    setBusyId(null);
    if (!result.ok) {
      couponsState.setData((prev) =>
        prev ? { ...prev, coupons: prev.coupons.map((c) => (c.id === id ? { ...c, isActive: current.isActive } : c)) } : prev
      );
      toast.error(result.message);
      return;
    }
    const saved = result.data.coupon;
    couponsState.setData((prev) =>
      prev && saved ? { ...prev, coupons: prev.coupons.map((c) => (c.id === id ? { ...c, ...saved } : c)) } : prev
    );
    showToast(saved?.isActive ? `کد «${current.code}» فعال شد.` : `کد «${current.code}» غیرفعال شد.`);
  };

  const handleDeleteCoupon = async (id: string, code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (busyId) return;
    const ok = await toast.confirm({
      title: 'حذف کد تخفیف',
      description: `آیا از حذف کامل کد تخفیف «${code}» اطمینان دارید؟`,
      confirmLabel: 'حذف کد تخفیف',
      cancelLabel: 'انصراف',
      variant: 'danger',
    });
    if (!ok) return;
    setBusyId(id);
    const result = await adminRequest(`/api/admin/coupons?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    couponsState.setData((prev) => (prev ? { ...prev, coupons: prev.coupons.filter((c) => c.id !== id) } : prev));
    toast.success(`کد تخفیف «${code}» با موفقیت حذف گردید.`);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setFormError(null);

    const code = formCode.trim().toUpperCase();
    if (!/^[A-Z0-9-]{3,40}$/.test(code)) {
      setFormError('کد تخفیف باید ۳ تا ۴۰ نویسه و فقط شامل حروف انگلیسی، عدد و خط تیره باشد.');
      return;
    }
    if (!formTitle.trim()) {
      setFormError('لطفاً عنوان کد تخفیف را مشخص فرمایید.');
      return;
    }
    const value = Number(formDiscountValue);
    if (formDiscountValue === '' || !Number.isFinite(value) || value <= 0) {
      setFormError('مقدار تخفیف باید عددی بزرگتر از صفر باشد.');
      return;
    }
    if (formDiscountType === 'PERCENTAGE' && value > 100) {
      setFormError('درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد.');
      return;
    }
    if (formTargetType === 'SPECIFIC_PRODUCT' && !formTargetProductId) {
      setFormError('برای کد تخفیف کالای مشخص، کالای مورد نظر را انتخاب کنید.');
      return;
    }

    // Empty optional numbers are sent as null so that an edit can clear them.
    const optionalNumber = (v: number | '') => (v === '' ? null : Number(v));
    const payload = {
      code,
      title: formTitle.trim(),
      description: formDescription.trim(),
      targetType: formTargetType,
      targetProductId: formTargetType === 'SPECIFIC_PRODUCT' ? formTargetProductId : null,
      discountType: formDiscountType,
      discountValue: value,
      minOrderAmount: optionalNumber(formMinOrderAmount),
      maxDiscountAmount: formDiscountType === 'PERCENTAGE' ? optionalNumber(formMaxDiscountAmount) : null,
      usageLimit: optionalNumber(formUsageLimit),
      expiresAt: formExpiresAt.trim() || null,
      isActive: formIsActive,
    };

    setSaving(true);
    const result = editingCoupon
      ? await adminRequest<{ coupon: Coupon }>('/api/admin/coupons', {
          method: 'PATCH',
          body: { id: editingCoupon.id, ...payload },
        })
      : await adminRequest<{ coupon: Coupon }>('/api/admin/coupons', { method: 'POST', body: payload });
    setSaving(false);

    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    const saved = result.data.coupon;
    if (saved) {
      couponsState.setData((prev) => {
        if (!prev) return prev;
        const exists = prev.coupons.some((c) => c.id === saved.id);
        return {
          ...prev,
          coupons: exists ? prev.coupons.map((c) => (c.id === saved.id ? saved : c)) : [saved, ...prev.coupons],
        };
      });
    }
    setIsModalOpen(false);
    toast.success(
      editingCoupon
        ? `کد تخفیف «${code}» با موفقیت به‌روزرسانی شد.`
        : `کد تخفیف جدید «${code}» ایجاد شد.`
    );
    void couponsState.reload();
  };

  // Filtered List
  const filteredCoupons = coupons.filter((c) => {
    const matchesTarget = activeTab === 'ALL' || c.targetType === activeTab;
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && c.isActive) ||
      (statusFilter === 'INACTIVE' && !c.isActive);
    const matchesSearch =
      searchQuery.trim() === '' ||
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.targetProductName && c.targetProductName.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesTarget && matchesStatus && matchesSearch;
  });

  // KPI Metrics
  const totalCoupons = coupons.length;
  const activeCouponsCount = coupons.filter((c) => c.isActive).length;
  const totalRedemptions = coupons.reduce((sum, c) => sum + (c.usageCount || 0), 0);
  const shippingCouponsCount = coupons.filter((c) => c.targetType === 'SHIPPING').length;

  return (
    <div className="space-y-8">
      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-farm-primary">
              مدیریت کدهای تخفیف و جشنواره‌ها
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
              {toPersianDigits(totalCoupons)} کد
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            تعریف کدهای تخفیف روی هزینه حمل و نقل، یک کالای مشخص از مزارع یا کل اقلام سبد خرید
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-farm-primary text-white text-xs font-bold shadow-md hover:bg-farm-primary-dark transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ ایجاد کد تخفیف جدید</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-3xl p-5 border border-farm-border shadow-farm space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-bold">کل کدهای تخفیف</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-farm-primary flex items-center justify-center">
              <TicketPercent className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-farm-primary">{toPersianDigits(totalCoupons)}</div>
          <span className="text-xs text-gray-600">شامل تمامی جشنواره‌ها و پروموشن‌ها</span>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-farm-border shadow-farm space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-bold">کدهای فعال و آماده استفاده</span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-800">{toPersianDigits(activeCouponsCount)}</div>
          <span className="text-xs text-blue-600">قابل اعمال توسط خریداران در تسویه‌حساب</span>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-farm-border shadow-farm space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-bold">دفعات استفاده موفق</span>
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-800">{toPersianDigits(totalRedemptions)} بار</div>
          <span className="text-xs text-purple-600">ثبت‌شده در فاکتورهای نهایی مشتریان</span>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-farm-border shadow-farm space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-bold">تخفیفات حمل و نقل</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-800">{toPersianDigits(shippingCouponsCount)} کد</div>
          <span className="text-xs text-amber-600">ارسال رایگان یا تخفیف پیک پروفارم شیراز</span>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white rounded-3xl p-4 border border-farm-border shadow-farm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Target Type Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'ALL'
                ? 'bg-farm-primary text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            همه اهداف ({toPersianDigits(totalCoupons)})
          </button>
          <button
            onClick={() => setActiveTab('ALL_PRODUCTS')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'ALL_PRODUCTS'
                ? 'bg-farm-primary text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>کل سبد خرید</span>
          </button>
          <button
            onClick={() => setActiveTab('SPECIFIC_PRODUCT')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'SPECIFIC_PRODUCT'
                ? 'bg-farm-primary text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>کالای خاص</span>
          </button>
          <button
            onClick={() => setActiveTab('SHIPPING')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'SHIPPING'
                ? 'bg-farm-primary text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>حمل و نقل</span>
          </button>
        </div>

        {/* Search & Status Filters */}
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-xs font-bold text-gray-700 cursor-pointer"
          >
            <option value="ALL">تمامی وضعیت‌ها</option>
            <option value="ACTIVE">فقط فعال‌ها</option>
            <option value="INACTIVE">فقط غیرفعال‌ها</option>
          </select>

          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="جستجوی کد، عنوان..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-9 py-2 rounded-xl border border-gray-200 text-xs bg-gray-50 focus:bg-white transition-all outline-none"
            />
          </div>
        </div>
      </div>

      {/* Coupons Grid / Cards */}
      <AdminStatus
        hasData={couponsState.data !== null}
        loading={couponsState.loading}
        error={couponsState.error}
        onRetry={() => void couponsState.reload()}
      />
      {couponsState.data !== null && filteredCoupons.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-farm-border text-center space-y-4 shadow-farm">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto text-gray-500">
            <TicketPercent className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-gray-700">کد تخفیفی با این مشخصات یافت نشد</h3>
          <p className="text-xs text-gray-600">
            می‌توانید فیلترهای بالا را تغییر دهید یا با دکمه «ایجاد کد تخفیف جدید» اقدام به تعریف کد نمایید.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCoupons.map((coupon) => {
            const isShipping = coupon.targetType === 'SHIPPING';
            const isSpecific = coupon.targetType === 'SPECIFIC_PRODUCT';
            const isAll = coupon.targetType === 'ALL_PRODUCTS';
            const usagePercent = coupon.usageLimit
              ? Math.min(100, Math.round((coupon.usageCount / coupon.usageLimit) * 100))
              : 0;

            return (
              <div
                key={coupon.id}
                className={`bg-white rounded-3xl p-6 border transition-all duration-300 relative flex flex-col justify-between shadow-farm hover:shadow-farm-hover ${
                  coupon.isActive ? 'border-farm-border' : 'border-gray-200 opacity-75 bg-gray-50/70'
                }`}
              >
                <div className="space-y-4">
                  {/* Top Bar: Target Badge & Active Switch */}
                  <div className="flex items-center justify-between">
                    {isShipping && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        <Truck className="w-3.5 h-3.5" />
                        <span>تخفیف ارسال و حمل</span>
                      </span>
                    )}
                    {isSpecific && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                        <Package className="w-3.5 h-3.5" />
                        <span>تخفیف کالای خاص</span>
                      </span>
                    )}
                    {isAll && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>تخفیف کل سبد خرید</span>
                      </span>
                    )}

                    <button
                      onClick={(e) => handleToggleStatus(coupon.id, e)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        coupon.isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                      title={coupon.isActive ? 'کلیک برای غیرفعال‌سازی' : 'کلیک برای فعال‌سازی'}
                    >
                      <Power className="w-3 h-3" />
                      <span>{coupon.isActive ? 'فعال' : 'غیرفعال'}</span>
                    </button>
                  </div>

                  {/* Coupon Code Banner with 1-click Copy */}
                  <div className="p-3.5 rounded-2xl bg-farm-bg border border-dashed border-[#D4A373] flex items-center justify-between">
                    <div>
                      <span className="text-xs text-gray-600 block font-sans">کد کوپن:</span>
                      <span className="text-base font-black font-mono tracking-wider text-farm-primary">
                        {coupon.code}
                      </span>
                    </div>

                    <button
                      onClick={() => handleCopyCode(coupon.code)}
                      className="p-2 rounded-xl bg-white hover:bg-emerald-50 text-gray-600 hover:text-emerald-700 border border-gray-200 shadow-sm transition-all cursor-pointer flex items-center gap-1 text-xs font-medium"
                      title="کپی در حافظه"
                    >
                      {copiedCode === coupon.code ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-600 text-xs">کپی شد</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span className="text-xs">کپی</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Title & Description */}
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-gray-900 leading-snug">{coupon.title}</h3>
                    {coupon.description && (
                      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                        {coupon.description}
                      </p>
                    )}
                    {isSpecific && coupon.targetProductName && (
                      <div className="pt-1 text-xs font-bold text-purple-700 flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        <span>محصول هدف: {coupon.targetProductName}</span>
                      </div>
                    )}
                  </div>

                  {/* Discount Value Display */}
                  <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100 space-y-2 text-xs">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-gray-500">میزان تخفیف:</span>
                      <span className="text-emerald-700 text-sm font-black">
                        {coupon.discountType === 'PERCENTAGE'
                          ? `${toPersianDigits(coupon.discountValue)}٪ تخفیف`
                          : formatToman(coupon.discountValue)}
                      </span>
                    </div>

                    {coupon.maxDiscountAmount && coupon.discountType === 'PERCENTAGE' && (
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span>سقف تخفیف ریالی:</span>
                        <span className="font-bold">{formatToman(coupon.maxDiscountAmount)}</span>
                      </div>
                    )}

                    {coupon.minOrderAmount && coupon.minOrderAmount > 0 && (
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span>حداقل سبد خرید:</span>
                        <span className="font-bold">{formatToman(coupon.minOrderAmount)}</span>
                      </div>
                    )}
                  </div>

                  {/* Usage Stats & Expiry */}
                  <div className="space-y-1.5 text-xs text-gray-500">
                    <div className="flex items-center justify-between text-xs">
                      <span>میزان مصرف:</span>
                      <span className="font-bold text-gray-800">
                        {toPersianDigits(coupon.usageCount)}{' '}
                        {coupon.usageLimit ? `از ${toPersianDigits(coupon.usageLimit)} بار` : 'بار (نامحدود)'}
                      </span>
                    </div>

                    {coupon.usageLimit && (
                      <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            usagePercent >= 90 ? 'bg-rose-500' : 'bg-emerald-600'
                          }`}
                          style={{ width: `${usagePercent}%` }}
                        />
                      </div>
                    )}

                    {coupon.expiresAt && (
                      <div className="flex items-center gap-1 text-xs text-gray-600 pt-1">
                        <Clock className="w-3 h-3" />
                        <span>انقضا: تا {coupon.expiresAt}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-600">
                    ثبت‌شده در مزارع شیراز
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(coupon)}
                      className="p-2 rounded-xl hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
                      title="ویرایش کد تخفیف"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteCoupon(coupon.id, coupon.code, e)}
                      className="p-2 rounded-xl hover:bg-rose-50 text-gray-600 hover:text-rose-600 transition-colors cursor-pointer"
                      title="حذف کد تخفیف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal (Native <dialog>) */}
      <Dialog
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCoupon ? 'ویرایش کد تخفیف' : 'تعریف کد تخفیف جدید'}
        description="تنظیم قوانین تخفیف برای سفارشات، حمل و نقل یا اقلام خاص"
        icon={<TicketPercent className="w-5 h-5" />}
        size="xl"
      >
        <form onSubmit={handleSubmitForm} className="space-y-5 text-xs">
              {/* Code & Random Generator */}
              <div>
                <label className="block text-gray-700 font-bold mb-1">
                  کد تخفیف (لاتین و بدون فاصله): <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="مثال: SHIRAZ1403 یا FREESHIP"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 font-mono text-sm tracking-wider text-left uppercase focus:border-farm-primary outline-none"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={generateRandomCode}
                    className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="تولید کد تصادفی"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>کد تصادفی</span>
                  </button>
                </div>
              </div>

              {/* Title & Description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">
                    عنوان کد تخفیف: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: جشنواره عید فطر"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-farm-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1">توضیح مختصر (اختیاری):</label>
                  <input
                    type="text"
                    placeholder="مثال: ویژه اولین خرید خریداران شیراز"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-farm-primary outline-none"
                  />
                </div>
              </div>

              {/* Target Type Selector (3 Interactive Cards) */}
              <div className="space-y-2">
                <label className="block text-gray-700 font-bold">
                  نوع هدف تخفیف (کجا اعمال شود؟): <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Option 1: All Products */}
                  <div
                    onClick={() => setFormTargetType('ALL_PRODUCTS')}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer text-center space-y-1.5 ${
                      formTargetType === 'ALL_PRODUCTS'
                        ? 'border-farm-primary bg-emerald-50/50 text-farm-primary'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <ShoppingBag className="w-5 h-5 mx-auto text-farm-primary" />
                    <span className="block font-bold text-xs">۱. کل سبد خرید</span>
                    <span className="block text-xs text-gray-500 leading-tight">
                      تخفیف روی جمع کل کالاهای سفارش
                    </span>
                  </div>

                  {/* Option 2: Specific Product */}
                  <div
                    onClick={() => setFormTargetType('SPECIFIC_PRODUCT')}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer text-center space-y-1.5 ${
                      formTargetType === 'SPECIFIC_PRODUCT'
                        ? 'border-purple-600 bg-purple-50/50 text-purple-900'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Package className="w-5 h-5 mx-auto text-purple-700" />
                    <span className="block font-bold text-xs">۲. یک کالای خاص</span>
                    <span className="block text-xs text-gray-500 leading-tight">
                      تخفیف تنها روی یک محصول مشخص
                    </span>
                  </div>

                  {/* Option 3: Shipping */}
                  <div
                    onClick={() => setFormTargetType('SHIPPING')}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer text-center space-y-1.5 ${
                      formTargetType === 'SHIPPING'
                        ? 'border-amber-600 bg-amber-50/50 text-amber-900'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Truck className="w-5 h-5 mx-auto text-amber-700" />
                    <span className="block font-bold text-xs">۳. هزینه حمل و نقل</span>
                    <span className="block text-xs text-gray-500 leading-tight">
                      ارسال رایگان یا تخفیف کرایه پیک
                    </span>
                  </div>
                </div>
              </div>

              {/* Target Product Dropdown (if SPECIFIC_PRODUCT selected) */}
              {formTargetType === 'SPECIFIC_PRODUCT' && (
                <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 space-y-2 animate-in fade-in">
                  <label className="block text-purple-900 font-bold">
                    انتخاب محصول هدف از انبار: <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formTargetProductId}
                    onChange={(e) => setFormTargetProductId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-purple-300 bg-white text-xs font-bold text-gray-800 cursor-pointer outline-none"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({formatToman(p.price)})
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-purple-700 block">
                    این کد تنها زمانی اعمال می‌شود که محصول بالا در سبد خرید مشتری وجود داشته باشد.
                  </span>
                </div>
              )}

              {/* Discount Value & Discount Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">
                    نوع محاسبه تخفیف: <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFormDiscountType('PERCENTAGE')}
                      className={`flex-1 py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                        formDiscountType === 'PERCENTAGE'
                          ? 'border-farm-primary bg-farm-primary text-white'
                          : 'border-gray-200 bg-gray-50 text-gray-600'
                      }`}
                    >
                      <Percent className="w-3.5 h-3.5" />
                      <span>درصدی (٪)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormDiscountType('FIXED_AMOUNT')}
                      className={`flex-1 py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                        formDiscountType === 'FIXED_AMOUNT'
                          ? 'border-farm-primary bg-farm-primary text-white'
                          : 'border-gray-200 bg-gray-50 text-gray-600'
                      }`}
                    >
                      <Coins className="w-3.5 h-3.5" />
                      <span>مبلغ ثابت (تومان)</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 font-bold mb-1">
                    مقدار تخفیف ({formDiscountType === 'PERCENTAGE' ? 'درصد مثلا ۱۵' : 'تومان مثلا ۵۰۰۰۰'}):{' '}
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={formDiscountType === 'PERCENTAGE' ? 100 : undefined}
                    required
                    placeholder={formDiscountType === 'PERCENTAGE' ? '۱۵' : '۵۰۰۰۰'}
                    value={formDiscountValue}
                    onChange={(e) =>
                      setFormDiscountValue(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-farm-primary outline-none font-mono text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Conditions: Min Order, Max Ceiling, Usage Limit */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">حداقل مبلغ سفارش (تومان):</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="۰ = بدون شرط"
                    value={formMinOrderAmount}
                    onChange={(e) =>
                      setFormMinOrderAmount(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-farm-primary outline-none font-mono text-left"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-bold mb-1">سقف ریالی تخفیف درصدی:</label>
                  <input
                    type="number"
                    min="0"
                    disabled={formDiscountType === 'FIXED_AMOUNT'}
                    placeholder="اختیاری"
                    value={formMaxDiscountAmount}
                    onChange={(e) =>
                      setFormMaxDiscountAmount(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-farm-primary outline-none font-mono text-left disabled:bg-gray-100"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-bold mb-1">سقف تعداد دفعات استفاده:</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="خالی = نامحدود"
                    value={formUsageLimit}
                    onChange={(e) =>
                      setFormUsageLimit(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-farm-primary outline-none font-mono text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Expiry Date & Active Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">تاریخ انقضا (شمسی):</label>
                  <input
                    type="text"
                    placeholder="مثال: ۱۴۰۴-۰۶-۳۱"
                    value={formExpiresAt}
                    onChange={(e) => setFormExpiresAt(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 focus:border-farm-primary outline-none font-mono text-left"
                    dir="ltr"
                  />
                </div>

                <div className="flex items-center gap-3 pt-6">
                  <input
                    type="checkbox"
                    id="formIsActive"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-farm-primary focus:ring-farm-primary cursor-pointer"
                  />
                  <label htmlFor="formIsActive" className="text-gray-700 font-bold cursor-pointer">
                    کد تخفیف بلافاصله فعال و آماده استفاده باشد
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              {formError && (
                <p role="alert" className="text-xs font-bold text-rose-700">
                  {formError}
                </p>
              )}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold transition-colors cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-2xl bg-farm-primary hover:bg-farm-primary-dark text-white font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'در حال ذخیره...' : editingCoupon ? 'ذخیره تغییرات' : 'ایجاد کد تخفیف'}
                </button>
              </div>
            </form>
      </Dialog>
    </div>
  );
}
