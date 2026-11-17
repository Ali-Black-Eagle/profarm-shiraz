'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { farmStore } from '@/lib/db-store';
import { Order, OrderStatus, Product, OrderItem } from '@/types';
import { formatToman, toPersianDigits, isValidIranPhone } from '@/lib/formatters';
import { getOrderStatusMeta, SITE_CONFIG } from '@/lib/site-config';
import { Dialog } from '@/components/ui/Dialog';
import { useToast, useConfirm } from '@/components/ui/ToastProvider';
import {
  ShoppingBag,
  Truck,
  CheckCircle2,
  MessageSquare,
  Printer,
  Plus,
  Minus,
  Trash2,
  Package,
  X,
  FileText,
  User,
  Phone,
  MapPin,
  Calendar,
  Clock,
  ShieldCheck,
  Search,
} from 'lucide-react';

export default function AdminOrdersPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [smsNotification, setSmsNotification] = useState<string | null>(null);

  // Search & Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL');

  // Modals state
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<Order | null>(null);
  const [isManualOrderModalOpen, setIsManualOrderModalOpen] = useState(false);

  // Manual Order Form Fields
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('0917');
  const [streetAddress, setStreetAddress] = useState('');
  const [unit, setUnit] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [orderItemsList, setOrderItemsList] = useState<{ product: Product; quantity: number }[]>([]);
  const [deliveryDate, setDeliveryDate] = useState('امروز / فردا');
  const [deliveryTimeWindow, setDeliveryTimeWindow] = useState('۱۵:۰۰ الی ۲۱:۰۰ (۳ ظهر الی ۹ شب)');

  const fetchOrdersAndProducts = () => {
    setOrders([...farmStore.getOrders()]);
    const prods = farmStore.getProducts();
    setProducts(prods);
    if (prods.length > 0 && !selectedProductId) {
      setSelectedProductId(prods[0].id);
    }
  };

  useEffect(() => {
    fetchOrdersAndProducts();
  }, []);

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    const statusLabel = getOrderStatusMeta(newStatus).label;
    if (newStatus === 'CANCELLED' || newStatus === 'DELIVERED' || newStatus === 'OUT_FOR_DELIVERY') {
      const ok = await confirm({
        title: `تغییر وضعیت سفارش به «${statusLabel}»`,
        description:
          newStatus === 'CANCELLED'
            ? 'آیا از لغو این سفارش اطمینان دارید؟ ممکن است اطلاع‌رسانی برای مشتری ثبت شود.'
            : `آیا از تغییر وضعیت سفارش به «${statusLabel}» اطمینان دارید؟ ممکن است پیامک اطلاع‌رسانی برای مشتری ارسال شود.`,
        confirmLabel: `تغییر به ${statusLabel}`,
        cancelLabel: 'انصراف',
        variant: newStatus === 'CANCELLED' ? 'danger' : 'primary',
      });
      if (!ok) return;
    }

    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateOrderStatus',
          payload: { orderId, status: newStatus },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        const errMsg = data.error || data.message || 'تغییر وضعیت سفارش مجاز نیست.';
        setSmsNotification(`خطا: ${errMsg}`);
        toast.error(errMsg);
        setTimeout(() => setSmsNotification(null), 5000);
        return;
      }
      const updated = await farmStore.updateOrderStatus(orderId, newStatus);
      fetchOrdersAndProducts();
      const phone = updated?.address?.phone || updated?.user?.phone || '';
      const okMsg = `وضعیت سفارش به «${statusLabel}» تغییر یافت${phone ? ` (شماره تماس مشتری: ${toPersianDigits(phone)})` : ''}.`;
      setSmsNotification(okMsg);
      toast.success(okMsg);
      setTimeout(() => setSmsNotification(null), 5000);
    } catch {
      const errMsg = 'خطا در ارتباط با سرور؛ وضعیت سفارش تغییر نکرد.';
      setSmsNotification(errMsg);
      toast.error(errMsg);
      setTimeout(() => setSmsNotification(null), 5000);
    }
  };

  const handleAddItemToManualOrder = (productToAdd?: Product, qtyToAdd?: number) => {
    const prod = productToAdd || products.find((p) => p.id === selectedProductId);
    if (!prod) return;

    const qty = qtyToAdd !== undefined ? qtyToAdd : selectedQuantity;
    const existingIdx = orderItemsList.findIndex((i) => i.product.id === prod.id);
    if (existingIdx > -1) {
      const updated = [...orderItemsList];
      updated[existingIdx].quantity += qty;
      setOrderItemsList(updated);
    } else {
      setOrderItemsList([...orderItemsList, { product: prod, quantity: qty }]);
    }
    setSelectedQuantity(1);
  };

  const handleUpdateItemQuantity = (prodId: string, qty: number) => {
    if (qty <= 0) {
      handleRemoveItemFromManualOrder(prodId);
      return;
    }
    const updated = orderItemsList.map((item) => {
      if (item.product.id === prodId) {
        return {
          ...item,
          quantity: Math.min(item.product.stock || 999, qty),
        };
      }
      return item;
    });
    setOrderItemsList(updated);
  };

  const handleRemoveItemFromManualOrder = (prodId: string) => {
    setOrderItemsList(orderItemsList.filter((i) => i.product.id !== prodId));
  };

  const handleClearManualOrderItems = () => {
    setOrderItemsList([]);
  };

  const calculateManualTotal = () => {
    const itemsTotal = orderItemsList.reduce(
      (sum, i) => sum + i.product.price * i.quantity,
      0
    );
    const baseShipping = farmStore.getSubscriptionSettings().baseShippingFee;
    const shipping = itemsTotal === 0 ? 0 : itemsTotal >= 500000 ? 0 : baseShipping;
    return { itemsTotal, shipping, finalTotal: itemsTotal + shipping };
  };

  const handleCreateManualOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim()) {
      toast.error('لطفاً نام مشتری را وارد کنید.');
      return;
    }

    if (!isValidIranPhone(customerPhone)) {
      toast.error('لطفاً شماره تلفن همراه معتبر وارد نمایید.');
      return;
    }

    if (!streetAddress.trim()) {
      toast.error('لطفاً نشانی دقیق شیراز را وارد فرمایید.');
      return;
    }

    if (orderItemsList.length === 0) {
      toast.error('لطفاً حداقل یک محصول به لیست سفارش اضافه کنید.');
      return;
    }

    const { finalTotal } = calculateManualTotal();
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    const orderNumber = `PRF-1405-${Date.now().toString(36).toUpperCase()}-${randomPart}`;

    const user = farmStore.getOrCreateUser(customerPhone, customerName);

    const fullItems: OrderItem[] = orderItemsList.map((i, idx) => ({
      id: `manual-item-${Date.now()}-${idx}`,
      productId: i.product.id,
      product: i.product,
      quantity: i.quantity,
      unitPrice: i.product.price,
      totalPrice: i.product.price * i.quantity,
    }));

    const created = farmStore.createOrder({
      orderNumber,
      userId: user.id,
      user,
      addressId: `addr-manual-${Date.now()}`,
      address: {
        id: `addr-manual-${Date.now()}`,
        userId: user.id,
        recipientName: customerName,
        phone: customerPhone,
        province: 'فارس',
        city: 'شیراز',
        postalCode: '۷۱۹۸۷۶۵۴۳۲',
        streetAddress,
        unit: unit || null,
        isShiraz: true,
      },
      deliverySlotId: `slot-${Date.now()}`,
      deliverySlot: {
        id: `slot-${Date.now()}`,
        date: deliveryDate,
        dayOfWeek: 'تحویل روزانه',
        timeWindow: '۱۵:۰۰ الی ۲۱:۰۰ (۳ ظهر الی ۹ شب)',
        maxCapacity: 30,
        currentBookings: 1,
      },
      totalAmount: finalTotal,
      status: 'PROCESSING',
      isBulkOrder: false,
      items: fullItems,
    });

    // Send order confirmation SMS automatically
    const smsContent = `پروفارم شیراز\nمشتری گرامی ${customerName}، سفارش شماره ${orderNumber} برای شما ثبت گردید و در بازه ۱۵ تا ۲۱ تحویل پیک شیراز خواهد شد.\nمبلغ: ${formatToman(finalTotal)}`;
    console.log(`[Manual Order SMS] To: ${customerPhone} | Content:\n${smsContent}`);

    setSmsNotification(
      `سفارش جدید ${orderNumber} با موفقیت ثبت شد و پیامک تایید و هماهنگی برای ${customerName} (${toPersianDigits(customerPhone)}) ارسال گردید.`
    );
    setTimeout(() => setSmsNotification(null), 6000);

    // Reset and close
    setCustomerName('');
    setCustomerPhone('0917');
    setStreetAddress('');
    setUnit('');
    setOrderItemsList([]);
    setIsManualOrderModalOpen(false);
    fetchOrdersAndProducts();
  };

  const handlePrintInvoice = () => {
    if (typeof window !== 'undefined' && (window as any).AndroidBridge?.printPage) {
      (window as any).AndroidBridge.printPage();
    } else {
      window.print();
    }
  };

  const { itemsTotal, shipping, finalTotal } = calculateManualTotal();

  // Helper for multi-digit normalization (Persian & Arabic to English)
  const normalizeText = (text: string) => {
    if (!text) return '';
    const persianNumbers = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    let res = text.toString().toLowerCase().trim();
    for (let i = 0; i < 10; i++) {
      res = res.replaceAll(persianNumbers[i], i.toString()).replaceAll(arabicNumbers[i], i.toString());
    }
    return res;
  };

  // Filtered orders matching mobile, customer name, and order code
  const filteredOrders = useMemo(() => {
    const query = normalizeText(searchQuery);

    return orders.filter((order) => {
      // 1. Status filter
      if (statusFilter !== 'ALL' && order.status !== statusFilter) {
        return false;
      }

      if (!query) return true;

      // 2. Search by order code / number
      const orderNum = normalizeText(order.orderNumber || '');
      const orderId = normalizeText(order.id || '');

      // 3. Search by mobile phone (recipient phone or customer account phone)
      const recipientPhone = normalizeText(order.address?.phone || '');
      const userPhone = normalizeText(order.user?.phone || '');

      // 4. Search by customer name (recipient name or customer account name)
      const recipientName = (order.address?.recipientName || '').toLowerCase();
      const userName = (order.user?.name || '').toLowerCase();
      const street = (order.address?.streetAddress || '').toLowerCase();

      return (
        orderNum.includes(query) ||
        orderId.includes(query) ||
        recipientPhone.includes(query) ||
        userPhone.includes(query) ||
        recipientName.includes(query) ||
        userName.includes(query) ||
        street.includes(query)
      );
    });
  }, [orders, searchQuery, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E6E1D5] no-print">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#2C4A2E]">
            مدیریت سفارشات، چاپ فاکتور و ثبت سفارش دستی
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            امکان ثبت سفارش تلفنی برای مشتری با ارسال خودکار SMS و چاپ فاکتور رسمی
          </p>
        </div>

        <button
          onClick={() => setIsManualOrderModalOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#2C4A2E] text-white text-xs font-bold shadow-md hover:bg-[#1E3520] transition-all self-start cursor-pointer"
        >
          <Plus className="w-4 h-4 text-[#D4A373]" />
          <span>ثبت سفارش جدید دستی (تلفنی / حضوری)</span>
        </button>
      </div>

      {smsNotification && (
        <div className="p-4 rounded-2xl bg-emerald-100 border border-emerald-300 text-xs font-bold text-emerald-950 flex items-center gap-2.5 animate-in fade-in shadow-xs no-print">
          <MessageSquare className="w-5 h-5 text-emerald-700 shrink-0" />
          <span>{smsNotification}</span>
        </div>
      )}

      {/* Orders Search & Filter Toolbar */}
      <div className="bg-white rounded-3xl p-5 border border-[#E6E1D5] shadow-farm space-y-4 no-print">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Main Search Input: Phone, Name, Order Code */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-gray-400">
              <Search className="w-5 h-5 text-[#2C4A2E]" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو با شماره موبایل (مثلاً ۰۹۱۷...)، نام مشتری یا کد سفارش (مثلاً PRF-1405)..."
              className="w-full pr-11 pl-10 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-xs sm:text-sm font-medium focus:bg-white focus:border-[#2C4A2E] focus:ring-2 focus:ring-[#2C4A2E]/20 outline-none transition-all placeholder:text-gray-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                title="پاک کردن کادر جستجو"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Status Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-gray-100 text-xs font-bold shrink-0 overflow-x-auto">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'ALL'
                  ? 'bg-white text-[#2C4A2E] shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              همه ({toPersianDigits(orders.length)})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('PROCESSING')}
              className={`px-3 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'PROCESSING'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              در حال آماده‌سازی
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('OUT_FOR_DELIVERY')}
              className={`px-3 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'OUT_FOR_DELIVERY'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              در مسیر توزیع
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('DELIVERED')}
              className={`px-3 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'DELIVERED'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              تحویل‌شده
            </button>
          </div>
        </div>

        {/* Search Results Summary Info */}
        {(searchQuery || statusFilter !== 'ALL') && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <span>نتیجه جستجو:</span>
              <strong className="text-[#2C4A2E] font-black">
                {toPersianDigits(filteredOrders.length)} سفارش یافت شد
              </strong>
              {searchQuery && (
                <span className="text-gray-400">
                  (عبارت: «{searchQuery}»)
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
              }}
              className="text-rose-600 hover:text-rose-700 font-bold hover:underline cursor-pointer flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>پاک‌سازی جستجو و فیلترها</span>
            </button>
          </div>
        )}
      </div>

      {/* Mobile Orders Card View (Visible only on mobile screens < 768px, eliminates horizontal scrolling) */}
      <div className="md:hidden flex flex-col gap-3.5 no-print">
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E6E1D5] p-8 text-center space-y-3">
            <Search className="w-8 h-8 text-gray-400 mx-auto" />
            <div className="text-sm font-bold text-gray-700">هیچ سفارشی یافت نشد</div>
            <p className="text-xs text-gray-400">شماره یا نام واردشده را بررسی کنید.</p>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-2xl border border-[#E6E1D5] p-4 shadow-xs space-y-3"
            >
              {/* Top Row: Order Number, Bulk Tag & Total Price */}
              <div className="flex items-center justify-between border-b border-[#F3EFE6] pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-[#2C4A2E] text-sm">
                    #{order.orderNumber}
                  </span>
                  {order.isBulkOrder && (
                    <span className="text-[10px] text-amber-700 font-bold px-1.5 py-0.5 rounded bg-amber-100">
                      عمده
                    </span>
                  )}
                </div>
                <div className="font-black text-sm text-[#2C4A2E]">
                  {formatToman(order.totalAmount)}
                </div>
              </div>

              {/* Customer Info & Click-to-Call */}
              <div className="flex items-center justify-between text-xs">
                <div className="font-bold text-gray-900">
                  {order.address?.recipientName}
                </div>
                {order.address?.phone && (
                  <a
                    href={`tel:${order.address.phone}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold hover:bg-emerald-100 transition-colors"
                    dir="ltr"
                  >
                    <span>{order.address.phone}</span>
                    <span className="text-sm">📞</span>
                  </a>
                )}
              </div>

              {/* Shiraz Address */}
              <div className="text-xs text-gray-700 bg-gray-50 p-2.5 rounded-xl leading-relaxed">
                <span className="text-gray-400 ml-1">📍 نشانی:</span>
                <span>{order.address?.streetAddress}</span>
                {order.address?.unit && (
                  <span className="text-gray-500 mr-1.5 font-bold">(واحد {order.address.unit})</span>
                )}
              </div>

              {/* Items List */}
              <div className="bg-[#F9F8F5] p-2.5 rounded-xl space-y-1 text-xs">
                <div className="text-[11px] font-bold text-gray-500 mb-1">
                  اقلام فاکتور ({toPersianDigits(order.items.length)} ردیف):
                </div>
                {order.items.map((i) => (
                  <div key={i.id} className="flex justify-between items-center text-gray-800">
                    <span className="truncate max-w-[200px]">• {i.product.title}</span>
                    <span className="font-bold text-[#2C4A2E] shrink-0">
                      {toPersianDigits(i.quantity)} بسته
                    </span>
                  </div>
                ))}
              </div>

              {/* Delivery Window */}
              <div className="text-[11px] text-gray-500 flex items-center justify-between">
                <span>بازه تحویل:</span>
                <span className="font-bold text-[#2C4A2E] bg-[#F3EFE6] px-2 py-0.5 rounded-md">
                  ۱۵:۰۰ الی ۲۱:۰۰ (پیک شیراز)
                </span>
              </div>

              {/* Actions: Status Dropdown & Print Invoice */}
              <div className="flex items-center gap-2 pt-1 border-t border-[#F3EFE6]">
                <select
                  value={order.status}
                  onChange={(e) =>
                    handleStatusChange(order.orderNumber, e.target.value as OrderStatus)
                  }
                  className="flex-1 px-3 py-2 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] text-xs font-bold text-[#2C4A2E] focus:outline-none focus:border-[#2C4A2E]"
                >
                  <option value="PENDING_PAYMENT">در انتظار پرداخت</option>
                  <option value="PROCESSING">در حال آماده‌سازی</option>
                  <option value="OUT_FOR_DELIVERY">تحویل به پیک شیراز</option>
                  <option value="DELIVERED">تحویل داده شد</option>
                  <option value="CANCELLED">لغو سفارش</option>
                </select>

                <button
                  type="button"
                  onClick={() => setSelectedInvoiceOrder(order)}
                  className="px-3 py-2 rounded-xl bg-[#2C4A2E] text-white font-bold text-xs flex items-center gap-1.5 shrink-0 shadow-xs active:scale-95 transition-transform"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>فاکتور</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Orders Table (hidden on mobile md:block) */}
      <div className="hidden md:block bg-white rounded-3xl border border-[#E6E1D5] shadow-farm overflow-hidden no-print">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-right text-sm">
            <thead className="bg-[#F9F8F5] border-b border-[#E6E1D5] text-[#2C4A2E]">
              <tr>
                <th className="py-4 px-4 font-black whitespace-nowrap">کد سفارش</th>
                <th className="py-4 px-4 font-black whitespace-nowrap min-w-[130px]">خریدار / تلفن</th>
                <th className="py-4 px-4 font-black min-w-[200px]">نشانی در شیراز</th>
                <th className="py-4 px-4 font-black min-w-[240px]">اقلام فاکتور</th>
                <th className="py-4 px-4 font-black whitespace-nowrap">ساعت تحویل پیک</th>
                <th className="py-4 px-4 font-black whitespace-nowrap">مبلغ کل</th>
                <th className="py-4 px-4 font-black whitespace-nowrap min-w-[180px]">وضعیت و پیامک</th>
                <th className="py-4 px-4 font-black whitespace-nowrap">فاکتور</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E1D5]">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 px-4 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto">
                      <Search className="w-6 h-6" />
                    </div>
                    <div className="text-sm font-bold text-gray-700">
                      هیچ سفارشی با مشخصات جستجو شده یافت نشد
                    </div>
                    <p className="text-xs text-gray-400 max-w-sm mx-auto">
                      لطفاً شماره موبایل، نام خریدار یا کد سفارش وارد شده را بررسی کنید یا فیلتر را پاک نمایید.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setStatusFilter('ALL');
                      }}
                      className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 cursor-pointer"
                    >
                      نمایش همه سفارشات
                    </button>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="py-4 px-4 font-mono font-bold text-[#2C4A2E] whitespace-nowrap">
                    {order.orderNumber}
                    {order.isBulkOrder && (
                      <span className="block mt-1 text-[10px] text-amber-700 font-bold px-1.5 py-0.5 rounded bg-amber-100 w-fit">
                        سفارش عمده
                      </span>
                    )}
                  </td>

                  <td className="py-4 px-4 whitespace-nowrap">
                    <div className="font-bold text-gray-900">{order.address?.recipientName}</div>
                    <div className="font-mono text-gray-500 text-xs pt-0.5" dir="ltr">
                      {order.address?.phone}
                    </div>
                  </td>

                  <td className="py-4 px-4 min-w-[200px] max-w-xs text-gray-700 leading-relaxed">
                    <div className="font-medium">{order.address?.streetAddress}</div>
                    {order.address?.unit && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded bg-gray-100 text-xs text-gray-600">
                        واحد: {order.address?.unit}
                      </span>
                    )}
                  </td>

                  <td className="py-4 px-4 min-w-[240px]">
                    <div className="space-y-1.5 leading-relaxed">
                      {order.items.map((i) => (
                        <div key={i.id} className="text-gray-800 text-xs">
                          • {i.product.title} (
                          <strong className="text-[#2C4A2E]">{toPersianDigits(i.quantity)} بسته</strong>)
                        </div>
                      ))}
                    </div>
                  </td>

                  <td className="py-4 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-[#F3EFE6] text-[#2C4A2E] font-bold text-xs whitespace-nowrap">
                      ۱۵:۰۰ الی ۲۱:۰۰ (۳ ظهر الی ۹ شب)
                    </span>
                  </td>

                  <td className="py-4 px-4 font-black text-[#2C4A2E] whitespace-nowrap">
                    {formatToman(order.totalAmount)}
                  </td>

                  <td className="py-4 px-4 whitespace-nowrap">
                    <select
                      value={order.status}
                      onChange={(e) =>
                        handleStatusChange(order.orderNumber, e.target.value as OrderStatus)
                      }
                      className="px-3 py-2 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] text-xs font-bold text-[#2C4A2E] focus:outline-none focus:border-[#2C4A2E] cursor-pointer whitespace-nowrap shadow-xs"
                    >
                      <option value="PENDING_PAYMENT">در انتظار پرداخت</option>
                      <option value="PROCESSING">در حال آماده‌سازی در انبار</option>
                      <option value="OUT_FOR_DELIVERY">تحویل به پیک شیراز</option>
                      <option value="DELIVERED">تحویل داده شد به مشتری</option>
                      <option value="CANCELLED">لغو سفارش</option>
                    </select>
                  </td>

                  <td className="py-4 px-4 whitespace-nowrap">
                    <button
                      onClick={() => setSelectedInvoiceOrder(order)}
                      className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-[#2C4A2E] hover:text-white text-gray-800 font-bold text-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>چاپ فاکتور</span>
                    </button>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 1. Modal: Create Manual Order by Admin (Native <dialog>) */}
      <Dialog
        open={isManualOrderModalOpen}
        onClose={() => setIsManualOrderModalOpen(false)}
        title="ثبت سفارش دستی جدید توسط ادمین"
        description="برای خریدارانی که امکان ثبت آنلاین ندارند"
        icon={<ShoppingBag className="w-5 h-5" />}
        size="2xl"
      >
        <form onSubmit={handleCreateManualOrder} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">نام و نام خانوادگی مشتری:</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: آقای کریمی"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E]"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">شماره همراه مشتری (ارسال پیامک):</label>
                  <input
                    type="tel"
                    required
                    placeholder="0917xxxxxxx"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E] text-left font-mono"
                    dir="ltr"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-gray-700 font-semibold mb-1">نشانی دقیق در شیراز:</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: شیراز، معالی‌آباد، کوچه ۱۰، پلاک ۱۵"
                    value={streetAddress}
                    onChange={(e) => setStreetAddress(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E]"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">واحد / طبقه:</label>
                  <input
                    type="text"
                    placeholder="واحد ۲"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E]"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">ساعت تحویل پیک شیراز:</label>
                  <input
                    type="text"
                    disabled
                    value="۱۵:۰۰ الی ۲۱:۰۰ (۳ ظهر الی ۹ شب)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-100 text-gray-600 font-bold"
                  />
                </div>
              </div>

              {/* Add Items Sub-form */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#F9F8F5] border border-[#E6E1D5] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-[#2C4A2E]" />
                    <span className="font-bold text-[#2C4A2E]">مدیریت اقلام و محصولات فاکتور:</span>
                  </div>
                  {orderItemsList.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearManualOrderItems}
                      className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف همه اقلام</span>
                    </button>
                  )}
                </div>

                {/* Quick Add Chips for Popular Products */}
                <div className="space-y-1.5">
                  <span className="text-[11px] text-gray-500 font-medium">افزودن سریع محصولات پرفروش:</span>
                  <div className="flex flex-wrap gap-2">
                    {products.slice(0, 5).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleAddItemToManualOrder(p, 1)}
                        className="px-2.5 py-1 rounded-xl bg-white hover:bg-emerald-50 border border-gray-200 hover:border-emerald-300 text-[11px] font-semibold text-gray-700 hover:text-emerald-900 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <Plus className="w-3 h-3 text-emerald-600" />
                        <span>{p.title.split('(')[0].trim()}</span>
                        <span className="text-[10px] text-gray-400 font-mono">({formatToman(p.price)})</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dropdown Product Selector */}
                <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-[#E6E1D5] bg-white text-xs font-semibold focus:outline-none focus:border-[#2C4A2E]"
                  >
                    <option value="">-- انتخاب محصول از کاتالوگ انبار --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.packSize}) | موجودی: {toPersianDigits(p.stock)} | {formatToman(p.price)}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-[#E6E1D5] bg-white rounded-xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setSelectedQuantity(Math.max(1, selectedQuantity - 1))}
                        className="px-2 py-2.5 text-gray-500 hover:bg-gray-100"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={selectedQuantity}
                        onChange={(e) => setSelectedQuantity(Math.max(1, Number(e.target.value) || 1))}
                        className="w-12 py-2 text-center text-xs font-black focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setSelectedQuantity(selectedQuantity + 1)}
                        className="px-2 py-2.5 text-gray-500 hover:bg-gray-100"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddItemToManualOrder()}
                      className="px-4 py-2.5 rounded-xl bg-[#2C4A2E] hover:bg-[#1E3520] text-white text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#D4A373]" />
                      <span>افزودن به سفارش</span>
                    </button>
                  </div>
                </div>

                {/* Selected Items List with Interactive Quantity Adjustment */}
                {orderItemsList.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-gray-300 text-center text-xs text-gray-500 bg-white/50">
                    هنوز محصولی به سفارش افزوده نشده است. از لیست بالا محصولات موردنظر مشتری را انتخاب فرمایید.
                  </div>
                ) : (
                  <div className="space-y-2 pt-2 border-t border-gray-200">
                    <div className="flex items-center justify-between text-[11px] text-gray-500 px-1 font-bold">
                      <span>اقلام سبد ({toPersianDigits(orderItemsList.reduce((s, i) => s + i.quantity, 0))} بسته انتخاب شده)</span>
                      <span>مبلغ کل ردیف</span>
                    </div>

                    {orderItemsList.map((item) => (
                      <div
                        key={item.product.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-white p-3 rounded-2xl border border-[#E6E1D5] shadow-2xs hover:border-gray-300 transition-all"
                      >
                        {/* Product Info */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {item.product.images?.[0] ? (
                            <img
                              src={item.product.images[0]}
                              alt={item.product.title}
                              className="w-12 h-12 rounded-xl object-cover border border-gray-200 shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold text-[10px] shrink-0">
                              ارگانیک
                            </div>
                          )}

                          <div className="min-w-0">
                            <h4 className="font-bold text-gray-900 text-xs truncate">
                              {item.product.title}
                            </h4>
                            <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                              <span>{item.product.packSize}</span>
                              <span>•</span>
                              <span>فی: {formatToman(item.product.price)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Interactive Quantity Stepper & Price */}
                        <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                          {/* Quantity Controls */}
                          <div className="flex items-center border border-gray-300 rounded-xl bg-gray-50 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQuantity(item.product.id, item.quantity - 1)}
                              className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                              title="کاهش تعداد"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={item.product.stock || 999}
                              value={item.quantity}
                              onChange={(e) =>
                                handleUpdateItemQuantity(
                                  item.product.id,
                                  Math.max(1, Number(e.target.value) || 1)
                                )
                              }
                              className="w-11 text-center text-xs font-black bg-white py-1 focus:outline-none"
                              title="تغییر مستقیم تعداد"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQuantity(item.product.id, item.quantity + 1)}
                              disabled={item.quantity >= (item.product.stock || 999)}
                              className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors disabled:opacity-40"
                              title="افزایش تعداد"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Line Item Total */}
                          <div className="font-mono text-[#2C4A2E] font-black text-xs sm:text-sm min-w-[90px] text-left">
                            {formatToman(item.product.price * item.quantity)}
                          </div>

                          {/* Delete Item Button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveItemFromManualOrder(item.product.id)}
                            className="text-gray-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                            title="حذف این محصول از فاکتور"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Invoice Pricing Breakdown */}
                    <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 text-xs space-y-1.5 mt-3">
                      <div className="flex justify-between text-gray-700">
                        <span>مجموع ارزش اقلام:</span>
                        <span className="font-bold text-gray-900">{formatToman(itemsTotal)}</span>
                      </div>
                      <div className="flex justify-between text-gray-700">
                        <span>هزینه پیک پروفارم شیراز:</span>
                        <span className="font-bold text-gray-900">
                          {shipping === 0 ? (
                            <span className="text-emerald-700 font-bold">رایگان (خرید بالای ۵۰۰ هزارتومان)</span>
                          ) : (
                            formatToman(shipping)
                          )}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-emerald-200/80 flex justify-between font-black text-sm text-[#2C4A2E]">
                        <span>مبلغ نهایی فاکتور:</span>
                        <span className="text-base">{formatToman(finalTotal)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsManualOrderModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-100 font-semibold"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#2C4A2E] text-white font-bold hover:bg-[#1E3520] shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#D4A373]" />
                  <span>ثبت قطعی سفارش و ارسال پیامک به مشتری</span>
                </button>
              </div>
            </form>
      </Dialog>

      {/* 2. Official Printable Invoice Modal (Native <dialog>) */}
      <Dialog
        open={Boolean(selectedInvoiceOrder)}
        onClose={() => setSelectedInvoiceOrder(null)}
        title="پیش‌نمایش فاکتور رسمی"
        icon={<FileText className="w-5 h-5" />}
        size="2xl"
        className="print:border-none print:shadow-none print:max-w-none"
        headerActions={
          <button
            type="button"
            onClick={handlePrintInvoice}
            className="px-4 py-2 rounded-xl bg-farm-primary text-white font-bold text-xs flex items-center gap-2 hover:bg-farm-primary-dark cursor-pointer"
          >
            <Printer className="w-4 h-4 text-farm-accent" />
            <span>پرینت فاکتور (A4/A5)</span>
          </button>
        }
      >
        {selectedInvoiceOrder && (
            <div className="p-6 border-2 border-gray-800 rounded-2xl space-y-6 text-black print:border-black print:rounded-none">
              {/* Invoice Head */}
              <div className="flex items-start justify-between pb-4 border-b-2 border-black">
                <div>
                  <h2 className="text-lg font-black">مزارع ارگانیک و محلی «پروفارم شیراز»</h2>
                  <p className="text-xs mt-1">صورت‌حساب فروش رسمی کالا و خدمات</p>
                  <p className="text-[11px] text-gray-600 mt-0.5">
                    انبار مرکزی پروفارم: شیراز، بلوار ارم | تلفن: {SITE_CONFIG.contact.supportPhoneDisplay}
                  </p>
                </div>
                <div className="text-left text-xs font-mono space-y-1">
                  <div>
                    شماره فاکتور: <strong>{selectedInvoiceOrder.orderNumber}</strong>
                  </div>
                  <div>
                    تاریخ صدور:{' '}
                    <strong>
                      {selectedInvoiceOrder.deliverySlot?.date || '۱۴۰۵/۰۶/۱۸'}
                    </strong>
                  </div>
                  <div>
                    شیفت ارسال: <strong>۱۵:۰۰ الی ۲۱:۰۰ (پیک شیراز)</strong>
                  </div>
                </div>
              </div>

              {/* Customer Info Box */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-300 text-xs space-y-2 print:bg-white print:border-black">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span>تحویل‌گیرنده: </span>
                    <strong>{selectedInvoiceOrder.address?.recipientName}</strong>
                  </div>
                  <div className="text-left font-mono" dir="ltr">
                    <span>تلفن همراه: </span>
                    <strong>{selectedInvoiceOrder.address?.phone}</strong>
                  </div>
                </div>
                <div>
                  <span>نشانی تحویل در شیراز: </span>
                  <strong>{selectedInvoiceOrder.address?.streetAddress}</strong>
                  {selectedInvoiceOrder.address?.unit && (
                    <span> - واحد: {selectedInvoiceOrder.address.unit}</span>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-right text-xs border border-black">
                <thead className="bg-gray-100 border-b border-black">
                  <tr>
                    <th className="py-2 px-3 border-l border-black">ردیف</th>
                    <th className="py-2 px-3 border-l border-black">شرح کالا و نوع پکیج</th>
                    <th className="py-2 px-3 border-l border-black text-center">تعداد بسته</th>
                    <th className="py-2 px-3 border-l border-black">قیمت واحد (تومان)</th>
                    <th className="py-2 px-3">جمع کل (تومان)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300 print:divide-black">
                  {selectedInvoiceOrder.items.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="py-2.5 px-3 border-l border-black text-center font-bold">
                        {toPersianDigits(idx + 1)}
                      </td>
                      <td className="py-2.5 px-3 border-l border-black">
                        <div className="font-bold">{item.product.title}</div>
                        <div className="text-[10px] text-gray-500">{item.product.packSize}</div>
                      </td>
                      <td className="py-2.5 px-3 border-l border-black text-center font-black">
                        {toPersianDigits(item.quantity)}
                      </td>
                      <td className="py-2.5 px-3 border-l border-black font-mono">
                        {formatToman(item.unitPrice)}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold">
                        {formatToman(item.totalPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals & Delivery */}
              <div className="flex justify-between items-center text-xs pt-2 border-t border-gray-300">
                <div className="text-gray-700 space-y-1">
                  <div>• حمل با پیک پروفارم در سراسر شیراز</div>
                  <div>• بسته‌بندی بهداشتی، استاندارد و محافظت کامل از طراوت و تازگی بار</div>
                </div>
                <div className="text-left space-y-1.5 font-bold">
                  <div className="text-base font-black">
                    مبلغ قابل پرداخت: {formatToman(selectedInvoiceOrder.totalAmount)}
                  </div>
                  <div className="text-[11px] text-emerald-800">
                    وضعیت فاکتور: پرداخت تاییدشده شاپرک / زرین‌پال
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-8 border-t-2 border-black text-center text-xs font-bold">
                <div>مهر و امضای سرپرست انبار پروفارم شیراز</div>
                <div>امضای تحویل‌گیرنده سفارش</div>
              </div>
            </div>
        )}
      </Dialog>
    </div>
  );
}
