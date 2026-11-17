'use client';

import React, { useState } from 'react';
import { formatToman, toPersianDigits } from '@/lib/formatters';
import { TrendingUp, ShoppingBag } from 'lucide-react';

interface SalesChartProps {
  data: { day: string; amount: number; orderCount: number }[];
}

export const SalesChart: React.FC<SalesChartProps> = ({ data }) => {
  const [pinnedIdx, setPinnedIdx] = useState<number | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxAmount = Math.max(...data.map((d) => d.amount), 1);
  const totalWeeklySales = data.reduce((sum, d) => sum + d.amount, 0);
  const totalOrders = data.reduce((sum, d) => sum + d.orderCount, 0);
  const activeIdx = hoveredIdx ?? pinnedIdx;
  const activeDay = activeIdx !== null ? data[activeIdx] : null;

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-farm-border shadow-farm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-farm-bg-warm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-farm-gold-text">
            <TrendingUp className="w-4 h-4 text-farm-primary" />
            <span>تحلیل مالی و بازدهی فروشگاه شیراز</span>
          </div>
          <h3 className="text-base sm:text-lg font-black text-farm-primary mt-0.5">
            نمودار روند فروش ۷ روز اخیر (تومان)
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="text-right">
            <span className="block text-xs text-farm-text-muted font-medium">مجموع فروش ۷ روز اخیر:</span>
            <span className="text-base font-black text-farm-primary">
              {formatToman(totalWeeklySales)}
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-900 text-xs font-bold border border-emerald-200">
            <ShoppingBag className="w-3.5 h-3.5 text-emerald-700" />
            <span>{toPersianDigits(totalOrders)} سفارش تاییدشده</span>
          </span>
        </div>
      </div>

      {/* Touch-friendly Selected Day Detail Readout */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-farm-bg border border-farm-border text-xs">
        {activeDay ? (
          <>
            <span className="font-bold text-farm-primary">
              جزئیات روز <strong className="text-farm-gold-text">{activeDay.day}</strong>:
            </span>
            <div className="flex items-center gap-3 font-bold">
              <span className="text-farm-primary">{formatToman(activeDay.amount)}</span>
              <span className="text-farm-text-muted">({toPersianDigits(activeDay.orderCount)} سفارش)</span>
            </div>
          </>
        ) : (
          <span className="text-farm-text-muted">
            برای مشاهده دقیق فروش هر روز، روی ستون آن کلیک یا لمس کنید.
          </span>
        )}
      </div>

      {/* Interactive Bar Chart (Keyboard & Touch Accessible) */}
      {totalWeeklySales === 0 ? (
        <div className="py-10 px-4 rounded-2xl bg-farm-bg border border-dashed border-farm-border text-center space-y-1">
          <p className="text-sm font-bold text-farm-text">هنوز سفارش پرداخت‌شده‌ای در ۷ روز اخیر ثبت نشده است.</p>
          <p className="text-xs text-farm-text-muted">به محض تایید پرداخت سفارش‌های جدید، نمودار واقعی اینجا نمایش داده می‌شود.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="h-52 flex items-end justify-between gap-1.5 sm:gap-4 pt-6 px-1">
            {data.map((item, idx) => {
              const heightPercent = item.amount > 0 ? Math.max(12, Math.round((item.amount / maxAmount) * 100)) : 4;
              const isSelected = activeIdx === idx;
              const isPinned = pinnedIdx === idx;
              const isPeak = item.amount > 0 && item.amount === maxAmount;

              return (
                <button
                  key={item.day}
                  type="button"
                  onClick={() => setPinnedIdx((prev) => (prev === idx ? null : idx))}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onFocus={() => setHoveredIdx(idx)}
                  onBlur={() => setHoveredIdx(null)}
                  aria-pressed={isPinned}
                  aria-label={`${item.day}: ${formatToman(item.amount)} (${toPersianDigits(item.orderCount)} سفارش)`}
                  className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer focus-visible:rounded-xl"
                >
                  {/* Compact label above bar on desktop */}
                  <span
                    className={`text-xs font-mono mb-1.5 transition-opacity hidden sm:block ${
                      isSelected ? 'opacity-100 text-farm-primary font-bold' : 'opacity-70 text-farm-text-muted'
                    }`}
                  >
                    {item.amount > 0 ? toPersianDigits(Math.round(item.amount / 1000)) + 'K' : '۰'}
                  </span>

                  {/* The Bar */}
                  <div
                    className={`w-full max-w-[48px] rounded-t-2xl transition-all duration-300 ${
                      isPeak
                        ? 'bg-gradient-to-t from-farm-primary to-farm-accent shadow-md'
                        : isSelected
                        ? 'bg-farm-primary ring-2 ring-farm-accent/60'
                        : 'bg-farm-primary/75 group-hover:bg-farm-primary'
                    }`}
                    style={{ height: `${heightPercent}%` }}
                  />

                  {/* Day label */}
                  <span
                    className={`mt-2 text-xs sm:text-xs font-bold transition-colors truncate max-w-full ${
                      isSelected ? 'text-farm-primary font-black' : 'text-farm-text-muted'
                    }`}
                  >
                    {item.day}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Chart Sub-legend */}
          <div className="pt-3 border-t border-farm-bg-warm flex flex-wrap items-center justify-between gap-2 text-xs text-farm-text-muted">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-gradient-to-t from-farm-primary to-farm-accent" />
                <span>بیشترین فروش هفته</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-farm-primary/75" />
                <span>فروش روزهای هفته</span>
              </span>
            </div>
            <div>
              <span>میانگین ارزش هر سفارش: </span>
              <strong className="text-farm-primary font-bold">
                {formatToman(Math.round(totalWeeklySales / Math.max(1, totalOrders)))}
              </strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
