'use client';

import React from 'react';
import { Order } from '@/types';
import { formatToman, toPersianDigits } from '@/lib/formatters';
import { Printer, X, ShieldCheck, CheckCircle2, Truck, Calendar, MapPin, Phone, Package, QrCode } from 'lucide-react';

interface UserInvoiceModalProps {
  order: Order | null;
  onClose: () => void;
}

export const UserInvoiceModal: React.FC<UserInvoiceModalProps> = ({ order, onClose }) => {
  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  const itemsSubtotal = order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const discountAmount = Math.max(0, itemsSubtotal - order.totalAmount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl border border-[#E6E1D5] text-[#2C4A2E] print:p-0 print:border-none print:shadow-none print:max-h-none print:w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Controls Bar (hidden during browser print) */}
        <div className="sticky top-0 z-20 flex items-center justify-between p-4 bg-[#F9F8F5] border-b border-[#E6E1D5] no-print rounded-t-3xl">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
            <span className="text-sm font-bold text-[#2C4A2E]">
              فاکتور رسمی الکترونیک سفارش {order.orderNumber}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-[#2C4A2E] text-white text-xs font-bold hover:bg-[#1E3520] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4 text-[#D4A373]" />
              <span>چاپ فاکتور</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-gray-500 hover:text-gray-800 hover:bg-gray-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Invoice Printable Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b-2 border-[#2C4A2E]/20">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-[#D4A373]">
                <ShieldCheck className="w-4 h-4 text-[#2C4A2E]" />
                <span>پلتفرم تخصصی محصولات ارگانیک مزارع فارس</span>
              </div>
              <h2 className="text-2xl font-black text-[#2C4A2E] mt-1">پروفارم شیراز</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                توزیع مستقیم با پیک پروفارم در سراسر شیراز
              </p>
            </div>

            <div className="text-left sm:text-right text-xs space-y-1 bg-[#F9F8F5] p-3 rounded-2xl border border-[#E6E1D5]">
              <div>
                <span className="text-gray-500">شماره فاکتور: </span>
                <strong className="font-mono text-[#2C4A2E] text-sm">{order.orderNumber}</strong>
              </div>
              <div>
                <span className="text-gray-500">تاریخ ثبت: </span>
                <strong>{order.createdAt ? new Date(order.createdAt).toLocaleDateString('fa-IR') : '۱۴۰۵/۰۶/۱۸'}</strong>
              </div>
              <div>
                <span className="text-gray-500">وضعیت سفارش: </span>
                <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                  {order.status === 'DELIVERED'
                    ? 'تحویل‌شده'
                    : order.status === 'OUT_FOR_DELIVERY'
                    ? 'در مسیر توزیع'
                    : order.status === 'PROCESSING'
                    ? 'در حال آماده‌سازی'
                    : 'ثبت‌شده'}
                </span>
              </div>
            </div>
          </div>

          {/* Customer & Delivery Information Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-[#F3EFE6]/60 p-4 rounded-2xl border border-[#E6E1D5]">
            <div className="space-y-1.5">
              <div className="font-bold text-[#2C4A2E] flex items-center gap-1.5 text-sm">
                <MapPin className="w-4 h-4 text-emerald-700" />
                <span>مشخصات تحویل‌گیرنده در شیراز</span>
              </div>
              <div className="text-gray-800">
                <span className="text-gray-500">نام گیرنده: </span>
                <strong>{order.address?.recipientName || order.user?.name || 'کاربر گرامی'}</strong>
              </div>
              <div className="text-gray-800">
                <span className="text-gray-500">تلفن همراه: </span>
                <span dir="ltr" className="font-mono font-bold">
                  {order.address?.phone || order.user?.phone}
                </span>
              </div>
              <div className="text-gray-800 leading-relaxed">
                <span className="text-gray-500">نشانی تحویل: </span>
                <span>
                  {order.address?.streetAddress} {order.address?.unit ? `- ${order.address.unit}` : ''}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 border-t sm:border-t-0 sm:border-r border-[#E6E1D5] sm:pr-4 pt-3 sm:pt-0">
              <div className="font-bold text-[#2C4A2E] flex items-center gap-1.5 text-sm">
                <Truck className="w-4 h-4 text-amber-700" />
                <span>اطلاعات ناوگان و زمان تحویل</span>
              </div>
              <div className="text-gray-800">
                <span className="text-gray-500">روش ارسال: </span>
                <span className="font-semibold text-emerald-900">پیک پروفارم شیراز</span>
              </div>
              <div className="text-gray-800">
                <span className="text-gray-500">روز تحویل: </span>
                <strong>{order.deliverySlot?.date || 'چهارشنبه ۱۸ شهریور'}</strong>
              </div>
              <div className="text-gray-800">
                <span className="text-gray-500">بازه زمانی: </span>
                <span className="font-bold text-[#2C4A2E]">
                  {order.deliverySlot?.timeWindow || '۱۵:۰۰ الی ۲۱:۰۰ (۳ ظهر الی ۹ شب)'}
                </span>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto rounded-2xl border border-[#E6E1D5]">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#F9F8F5] border-b border-[#E6E1D5] text-[#2C4A2E] font-bold">
                <tr>
                  <th className="py-3 px-3.5">ردیف</th>
                  <th className="py-3 px-3.5 min-w-[180px]">شرح کالا و مشخصات بسته</th>
                  <th className="py-3 px-3.5 text-center">تعداد</th>
                  <th className="py-3 px-3.5 text-left">قیمت واحد (تومان)</th>
                  <th className="py-3 px-3.5 text-left">مجموع (تومان)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E1D5]">
                {order.items.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-3 px-3.5 text-gray-500 font-bold">{toPersianDigits(idx + 1)}</td>
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-gray-900">{item.product.title}</div>
                      {item.product.packSize && (
                        <div className="text-[11px] text-gray-500 mt-0.5">{item.product.packSize}</div>
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-center font-bold text-gray-800">
                      {toPersianDigits(item.quantity)}
                    </td>
                    <td className="py-3 px-3.5 text-left font-mono text-gray-700">
                      {formatToman(item.unitPrice)}
                    </td>
                    <td className="py-3 px-3.5 text-left font-mono font-bold text-[#2C4A2E]">
                      {formatToman(item.unitPrice * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Totals */}
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4 pt-2">
            <div className="text-xs text-gray-500 space-y-1 max-w-sm">
              <p className="font-bold text-[#2C4A2E]">توضیحات و ضمانت سلامت بار:</p>
              <p className="leading-relaxed">
                کلیه اقلام با بسته‌بندی بهداشتی و با پیک پروفارم حمل شده‌اند. در صورت هرگونه نقص در بسته‌بندی، ضمانت بازگشت ۱۰۰٪ وجه تا ۲۴ ساعت معتبر می‌باشد.
              </p>
            </div>

            <div className="w-full sm:w-72 bg-[#F9F8F5] p-4 rounded-2xl border border-[#E6E1D5] space-y-2 text-xs">
              <div className="flex items-center justify-between text-gray-600">
                <span>جمع اقلام:</span>
                <span className="font-mono">{formatToman(itemsSubtotal)}</span>
              </div>

              {discountAmount > 0 && (
                <div className="flex items-center justify-between text-rose-600 font-medium">
                  <span>تخفیف اشتراک و کوپن:</span>
                  <span className="font-mono">- {formatToman(discountAmount)}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-gray-600">
                <span>هزینه ارسال سرد شیراز:</span>
                <span className="text-emerald-700 font-bold">
                  {order.totalAmount < itemsSubtotal ? 'رایگان / تخفیف‌دار' : '۳۵,۰۰۰ تومان'}
                </span>
              </div>

              <div className="pt-2 border-t border-[#E6E1D5] flex items-center justify-between text-sm font-black text-[#2C4A2E]">
                <span>مبلغ نهایی پرداخت‌شده:</span>
                <span className="text-base text-emerald-800">{formatToman(order.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Official Stamp & QR Code */}
          <div className="pt-4 border-t border-[#E6E1D5] flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <QrCode className="w-8 h-8 text-gray-600" />
              <div>
                <div className="font-bold text-gray-700">اصالت فاکتور الکترونیک مزارع فارس</div>
                <div className="text-[10px]">کد رهگیری سامانه سلامت: PRF-SHZ-2026</div>
              </div>
            </div>
            <div className="text-left font-mono text-[11px]">
              profarm-shiraz.ir | ۰۷۱-۳۲۳۴۵۶۷۸
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
