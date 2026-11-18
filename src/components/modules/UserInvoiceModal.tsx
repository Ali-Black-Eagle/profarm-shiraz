'use client';

import React from 'react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { Order } from '@/types';
import { formatToman, toPersianDigits } from '@/lib/formatters';
import { CopyOrderNumber } from '@/components/modules/CopyOrderNumber';
import { SITE_CONFIG, getOrderStatusMeta } from '@/lib/site-config';
import { Printer, X, ShieldCheck, Truck, MapPin } from 'lucide-react';

interface UserInvoiceModalProps {
  order: Order | null;
  onClose: () => void;
}

export const UserInvoiceModal: React.FC<UserInvoiceModalProps> = ({ order, onClose }) => {
  useEscapeKey(true, onClose);
  if (!order) return null;

  const handlePrint = () => {
    if (typeof window !== 'undefined' && (window as any).AndroidBridge?.printPage) {
      (window as any).AndroidBridge.printPage();
    } else {
      window.print();
    }
  };

  // Reconciled financial breakdown: itemsSubtotal + shippingFee - discountAmount === order.totalAmount
  const itemsSubtotal = order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const explicitDiscount = typeof (order as any).discountAmount === 'number' ? (order as any).discountAmount : 0;
  const rawDelta = order.totalAmount - (itemsSubtotal - explicitDiscount);
  const shippingFee = order.isSubscription
    ? 0
    : typeof (order as any).shippingFee === 'number'
    ? (order as any).shippingFee
    : rawDelta > 0
    ? rawDelta
    : 0;
  const discountAmount = Math.max(0, itemsSubtotal + shippingFee - order.totalAmount);
  const statusMeta = getOrderStatusMeta(order.status);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="فاکتور سفارش"
        className="bg-white rounded-3xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl border border-farm-border text-farm-primary print:p-0 print:border-none print:shadow-none print:max-h-none print:w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Controls Bar (hidden during browser print) */}
        <div className="sticky top-0 z-20 flex items-center justify-between p-4 bg-farm-bg border-b border-farm-border no-print rounded-t-3xl">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
            <span className="text-sm font-bold text-farm-primary">
              فاکتور سفارش {order.orderNumber}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl bg-farm-primary text-white text-xs font-bold hover:bg-farm-primary-dark transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4 text-[#FDE68A]" />
              <span>چاپ فاکتور</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="بستن فاکتور"
              className="min-w-11 min-h-11 flex items-center justify-center p-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Invoice Printable Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b-2 border-farm-primary/20">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-[#8A6218]">
                <ShieldCheck className="w-4 h-4 text-farm-primary" />
                <span>پلتفرم تخصصی محصولات ارگانیک مزارع فارس</span>
              </div>
              <h2 className="text-2xl font-black text-farm-primary mt-1">{SITE_CONFIG.brandName}</h2>
              <p className="text-xs text-gray-600 mt-0.5">{SITE_CONFIG.policies.retailDeliveryScope}</p>
            </div>

            <div className="text-left sm:text-right text-xs space-y-1.5 bg-farm-bg p-3.5 rounded-2xl border border-farm-border">
              <div>
                <span className="text-gray-600">شماره فاکتور: </span>
                <CopyOrderNumber value={order.orderNumber} className="text-farm-primary text-sm" />
              </div>
              {order.createdAt && (
                <div>
                  <span className="text-gray-600">تاریخ ثبت: </span>
                  <strong>{new Date(order.createdAt).toLocaleDateString('fa-IR')}</strong>
                </div>
              )}
              <div>
                <span className="text-gray-600">وضعیت سفارش: </span>
                <span className={`font-bold px-2 py-0.5 rounded-md ${statusMeta.badgeClass}`}>
                  {statusMeta.label}
                </span>
              </div>
            </div>
          </div>

          {/* Customer & Delivery Information Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-farm-bg-warm/60 p-4 rounded-2xl border border-farm-border">
            <div className="space-y-1.5">
              <div className="font-bold text-farm-primary flex items-center gap-1.5 text-sm">
                <MapPin className="w-4 h-4 text-emerald-700" />
                <span>مشخصات تحویل‌گیرنده</span>
              </div>
              <div className="text-gray-800">
                <span className="text-gray-600">نام گیرنده: </span>
                <strong>{order.address?.recipientName || order.user?.name || 'مشتری پروفارم'}</strong>
              </div>
              <div className="text-gray-800">
                <span className="text-gray-600">تلفن همراه: </span>
                <span dir="ltr" className="font-mono font-bold">
                  {order.address?.phone || order.user?.phone || '-'}
                </span>
              </div>
              <div className="text-gray-800 leading-relaxed">
                <span className="text-gray-600">نشانی تحویل: </span>
                <span>
                  {order.address?.province ? `${order.address.province}، ` : ''}
                  {order.address?.city ? `${order.address.city}، ` : ''}
                  {order.address?.streetAddress}{' '}
                  {order.address?.unit ? `- واحد ${order.address.unit}` : ''}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 border-t sm:border-t-0 sm:border-r border-farm-border sm:pr-4 pt-3 sm:pt-0">
              <div className="font-bold text-farm-primary flex items-center gap-1.5 text-sm">
                <Truck className="w-4 h-4 text-amber-700" />
                <span>اطلاعات ارسال و تحویل</span>
              </div>
              <div className="text-gray-800">
                <span className="text-gray-600">روش ارسال: </span>
                <span className="font-semibold text-emerald-900">
                  {order.isSubscription
                    ? 'فعال‌سازی آنلاین (بدون ارسال فیزیکی)'
                    : order.isBulkOrder
                    ? 'باربری عمده مزارع فارس'
                    : 'پیک اختصاصی پروفارم شیراز'}
                </span>
              </div>
              {order.deliverySlot?.date && (
                <div className="text-gray-800">
                  <span className="text-gray-600">روز تحویل: </span>
                  <strong>{order.deliverySlot.date}</strong>
                </div>
              )}
              {order.deliverySlot?.timeWindow && (
                <div className="text-gray-800">
                  <span className="text-gray-600">بازه زمانی: </span>
                  <span className="font-bold text-farm-primary">{order.deliverySlot.timeWindow}</span>
                </div>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto rounded-2xl border border-farm-border">
            <table className="w-full text-right text-xs">
              <thead className="bg-farm-bg border-b border-farm-border text-farm-primary font-bold">
                <tr>
                  <th scope="col" className="py-3 px-3.5">ردیف</th>
                  <th scope="col" className="py-3 px-3.5 min-w-[180px]">شرح کالا و مشخصات بسته</th>
                  <th scope="col" className="py-3 px-3.5 text-center">تعداد</th>
                  <th scope="col" className="py-3 px-3.5 text-left">قیمت واحد (تومان)</th>
                  <th scope="col" className="py-3 px-3.5 text-left">مجموع (تومان)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-farm-border">
                {order.items.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-3 px-3.5 text-gray-600 font-bold">{toPersianDigits(idx + 1)}</td>
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-gray-900">{item.product?.title || 'محصول ارگانیک'}</div>
                      {item.product?.packSize && (
                        <div className="text-xs text-gray-600 mt-0.5">{item.product.packSize}</div>
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-center font-bold text-gray-800">
                      {toPersianDigits(item.quantity)}
                    </td>
                    <td className="py-3 px-3.5 text-left font-mono text-gray-700">
                      {formatToman(item.unitPrice)}
                    </td>
                    <td className="py-3 px-3.5 text-left font-mono font-bold text-farm-primary">
                      {formatToman(item.unitPrice * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Reconciled Financial Totals */}
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4 pt-2">
            <div className="text-xs text-gray-600 space-y-1 max-w-sm">
              <p className="font-bold text-farm-primary">ضمانت سلامت و بازگشت کالا:</p>
              <p className="leading-relaxed">
                {order.isSubscription
                  ? SITE_CONFIG.policies.subscriptionRefundLabel
                  : `${SITE_CONFIG.policies.freshReturnLabel}.`}
              </p>
            </div>

            <div className="w-full sm:w-72 bg-farm-bg p-4 rounded-2xl border border-farm-border space-y-2 text-xs">
              <div className="flex items-center justify-between text-gray-700">
                <span>جمع اقلام:</span>
                <span className="font-mono font-bold">{formatToman(itemsSubtotal)}</span>
              </div>

              {!order.isSubscription && (
                <div className="flex items-center justify-between text-gray-700">
                  <span>هزینه ارسال:</span>
                  <span className="font-mono font-bold text-emerald-800">
                    {shippingFee > 0 ? formatToman(shippingFee) : 'رایگان'}
                  </span>
                </div>
              )}

              {discountAmount > 0 && (
                <div className="flex items-center justify-between text-rose-700 font-medium">
                  <span>تخفیف اشتراک / کوپن:</span>
                  <span className="font-mono font-bold">- {formatToman(discountAmount)}</span>
                </div>
              )}

              <div className="pt-2 border-t border-farm-border flex items-center justify-between text-sm font-black text-farm-primary">
                <span>مبلغ نهایی فاکتور:</span>
                <span className="text-base text-emerald-800">{formatToman(order.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Clean Official Footer (No fake QR or invented health codes) */}
          <div className="pt-4 border-t border-farm-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-gray-600">
            <div className="font-bold text-gray-700">
              {SITE_CONFIG.brandFullName} — {SITE_CONFIG.contact.address}
            </div>
            <div className="text-left font-mono" dir="ltr">
              profarm-shiraz.ir | {SITE_CONFIG.contact.supportPhoneDisplay}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
