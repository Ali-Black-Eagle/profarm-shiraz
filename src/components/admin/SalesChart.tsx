'use client';

import React, { useState } from 'react';
import { formatToman, toPersianDigits } from '@/lib/formatters';
import { TrendingUp, Calendar, ArrowUpRight } from 'lucide-react';

interface SalesChartProps {
  data: { day: string; amount: number; orderCount: number }[];
}

export const SalesChart: React.FC<SalesChartProps> = ({ data }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxAmount = Math.max(...data.map((d) => d.amount), 1);
  const totalWeeklySales = data.reduce((sum, d) => sum + d.amount, 0);
  const totalOrders = data.reduce((sum, d) => sum + d.orderCount, 0);

  return (
    <div className="bg-white rounded-3xl p-6 border border-[#E6E1D5] shadow-farm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#F3EFE6]">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#D4A373]">
            <TrendingUp className="w-4 h-4 text-[#2C4A2E]" />
            <span>تحلیل مالی و بازدهی فروشگاه شیراز</span>
          </div>
          <h3 className="text-base sm:text-lg font-black text-[#2C4A2E] mt-0.5">
            نمودار روند فروش هفتگی مزارع (به تومان)
          </h3>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-left sm:text-right">
            <span className="block text-[11px] text-gray-400 font-medium">مجموع فروش هفته جاری:</span>
            <span className="text-base font-black text-[#2C4A2E]">
              {formatToman(totalWeeklySales)}
            </span>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
            <span>+۱۸٪ نسبت به هفته قبل</span>
          </span>
        </div>
      </div>

      {/* Modern Interactive Bar Chart */}
      <div className="space-y-3">
        <div className="h-56 flex items-end justify-between gap-2 sm:gap-4 pt-8 px-2">
          {data.map((item, idx) => {
            const heightPercent = Math.max(12, Math.round((item.amount / maxAmount) * 100));
            const isHovered = hoveredIdx === idx;
            const isPeak = item.amount === maxAmount;

            return (
              <div
                key={item.day}
                className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Floating tooltip on hover */}
                {isHovered && (
                  <div className="absolute -top-14 z-20 bg-[#1E3520] text-white p-2 rounded-xl text-[11px] whitespace-nowrap shadow-xl border border-[#D4A373]/50 animate-in fade-in zoom-in-95 pointer-events-none text-center">
                    <div className="font-bold text-[#F3E5AB]">{item.day}</div>
                    <div>{formatToman(item.amount)}</div>
                    <div className="text-[10px] text-gray-300">
                      {toPersianDigits(item.orderCount)} سفارش موفق
                    </div>
                  </div>
                )}

                {/* Amount label on top of bar */}
                <span className="text-[10px] font-mono text-gray-500 mb-2 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block">
                  {toPersianDigits(Math.round(item.amount / 1000000))}M
                </span>

                {/* The Bar */}
                <div
                  className={`w-full max-w-[48px] rounded-t-2xl transition-all duration-300 ${
                    isPeak
                      ? 'bg-gradient-to-t from-[#2C4A2E] to-[#D4A373] shadow-md'
                      : isHovered
                      ? 'bg-[#2C4A2E]'
                      : 'bg-[#2C4A2E]/75 hover:bg-[#2C4A2E]'
                  }`}
                  style={{ height: `${heightPercent}%` }}
                />

                {/* Day label */}
                <span
                  className={`mt-2.5 text-xs font-bold transition-colors ${
                    isHovered ? 'text-[#2C4A2E] font-black' : 'text-gray-600'
                  }`}
                >
                  {item.day}
                </span>
              </div>
            );
          })}
        </div>

        {/* Chart Sub-legend */}
        <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-gradient-to-t from-[#2C4A2E] to-[#D4A373]" />
              <span>پیک فروش هفتگی (چهارشنبه و یکشنبه)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-[#2C4A2E]/75" />
              <span>فروش روزهای کاری</span>
            </span>
          </div>
          <div>
            <span>میانگین ارزش هر سفارش: </span>
            <strong className="text-[#2C4A2E] font-bold">
              {formatToman(Math.round(totalWeeklySales / Math.max(1, totalOrders)))}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
};
