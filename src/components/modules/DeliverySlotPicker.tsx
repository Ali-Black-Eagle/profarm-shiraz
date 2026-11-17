'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { FormattedJalaliDate, SlotOption } from '@/lib/jalali';
import { toPersianDigits } from '@/lib/formatters';
import {
  Calendar,
  Clock,
  Lock,
  CheckCircle2,
  AlertCircle,
  Crown,
  Sparkles,
  Users,
} from 'lucide-react';
import Link from 'next/link';

interface DeliverySlotPickerProps {
  slots: SlotOption[];
  selectedSlotId: string | null;
  onSelectSlot: (slot: SlotOption) => void;
  isProMember: boolean;
}

export const DeliverySlotPicker: React.FC<DeliverySlotPickerProps> = ({
  slots,
  selectedSlotId,
  onSelectSlot,
  isProMember,
}) => {
  // Group slots by unique date
  const dateGroups = useMemo(() => {
    const groups: {
      dateStr: string;
      jalali: FormattedJalaliDate;
      isAllowedForTier: boolean;
      slots: SlotOption[];
    }[] = [];

    slots.forEach((slot) => {
      const existing = groups.find((g) => g.jalali.isoDateString === slot.jalali.isoDateString);
      if (existing) {
        existing.slots.push(slot);
      } else {
        groups.push({
          dateStr: slot.dateStr,
          jalali: slot.jalali,
          isAllowedForTier: slot.isAllowedForTier,
          slots: [slot],
        });
      }
    });

    return groups;
  }, [slots]);

  // First eligible date as default
  const defaultEligibleDate = useMemo(() => {
    return (
      dateGroups.find((g) => g.isAllowedForTier)?.jalali.isoDateString ||
      dateGroups[0]?.jalali.isoDateString
    );
  }, [dateGroups]);

  const [activeDateIso, setActiveDateIso] = useState<string>(defaultEligibleDate);

  // Keep activeDateIso in sync whenever selectedSlotId changes or loads
  useEffect(() => {
    if (selectedSlotId) {
      const matched = slots.find((s) => s.id === selectedSlotId);
      if (matched && matched.jalali.isoDateString !== activeDateIso) {
        setActiveDateIso(matched.jalali.isoDateString);
      }
    } else if (defaultEligibleDate && !activeDateIso) {
      setActiveDateIso(defaultEligibleDate);
    }
  }, [selectedSlotId, slots, defaultEligibleDate]);

  const activeGroup = dateGroups.find((g) => g.jalali.isoDateString === activeDateIso);

  return (
    <div className="bg-white rounded-3xl p-6 border border-[#E6E1D5] shadow-farm space-y-6">
      {/* Header & User Tier Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#F3EFE6]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#2C4A2E]/10 flex items-center justify-center text-[#2C4A2E]">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#2C4A2E]">
              انتخاب روز و زمان تحویل اختصاصی شیراز
            </h3>
            <p className="text-xs text-gray-500">
              ارسال با پیک پروفارم در سراسر مناطق شیراز
            </p>
          </div>
        </div>

        {/* Tier Indicator Pill */}
        <div
          className={`self-start sm:self-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold ${
            isProMember
              ? 'bg-amber-100 text-amber-900 border border-amber-300'
              : 'bg-emerald-50 text-emerald-900 border border-emerald-200'
          }`}
        >
          {isProMember ? (
            <>
              <Crown className="w-4 h-4 text-amber-600" />
              <span>کاربر ویژه (پلاس / پرو): تحویل همه روزه (شنبه تا پنج‌شنبه)</span>
            </>
          ) : (
            <>
              <Users className="w-4 h-4 text-emerald-700" />
              <span>کاربر عادی: تحویل فقط یکشنبه و چهارشنبه</span>
            </>
          )}
        </div>
      </div>

      {/* Notice for Regular users */}
      {!isProMember && (
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              نیاز به تحویل در روزهای شنبه، دوشنبه، سه‌شنبه یا پنج‌شنبه دارید؟
            </span>
          </div>
          <Link
            href="/pro"
            className="shrink-0 font-bold underline text-amber-800 hover:text-amber-950"
          >
            مشاهده اشتراک پلاس
          </Link>
        </div>
      )}

      {/* Date Carousel / Horizontal Selector */}
      <div>
        <label className="block text-xs font-bold text-gray-700 mb-3">
          ۱. انتخاب روز تحویل:
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
          {dateGroups.map((group) => {
            const isSelected = activeDateIso === group.jalali.isoDateString;
            const isAllowed = group.isAllowedForTier;
            const isDayFull = group.slots.every((s) => s.remainingCapacity <= 0);
            const isClickable = isAllowed && !isDayFull;

            const handleDateSelect = () => {
              if (!isClickable) return;
              setActiveDateIso(group.jalali.isoDateString);

              // Automatically select a delivery time slot on this day
              const currentSlot = slots.find((s) => s.id === selectedSlotId);
              const matchingSlot = currentSlot
                ? group.slots.find(
                    (s) =>
                      s.timeWindow === currentSlot.timeWindow &&
                      s.isAvailable &&
                      s.remainingCapacity > 0
                  )
                : null;

              const slotToSelect =
                matchingSlot ||
                group.slots.find((s) => s.isAvailable && s.remainingCapacity > 0) ||
                group.slots[0];

              if (slotToSelect) {
                onSelectSlot(slotToSelect);
              }
            };

            return (
              <button
                key={group.jalali.isoDateString}
                type="button"
                onClick={handleDateSelect}
                disabled={!isClickable}
                className={`relative flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#2C4A2E] bg-[#2C4A2E] text-white shadow-md scale-102 ring-2 ring-[#2C4A2E]/20'
                    : isClickable
                    ? 'border-[#E6E1D5] bg-[#F9F8F5] text-[#2C4A2E] hover:border-[#2C4A2E]/50 hover:bg-white'
                    : 'border-dashed border-gray-300 bg-gray-50 text-gray-400 opacity-60 cursor-not-allowed'
                }`}
              >
                {!isAllowed && (
                  <div className="absolute top-1.5 left-1.5">
                    <Lock className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                )}
                {isAllowed && isDayFull && (
                  <div className="absolute top-1.5 left-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                  </div>
                )}
                <span className="text-[11px] font-medium opacity-90">
                  {group.jalali.dayOfWeek}
                </span>
                <span className="text-lg font-black my-0.5">
                  {toPersianDigits(group.jalali.day)}
                </span>
                <span className="text-[10px] font-medium opacity-80">
                  {group.jalali.monthName}
                </span>

                {!isAllowed ? (
                  <span className="mt-1 text-[9px] text-amber-700 font-bold px-1 rounded bg-amber-100/80">
                    ویژه پلاس
                  </span>
                ) : isDayFull ? (
                  <span className="mt-1 text-[9px] text-rose-700 font-bold px-1 rounded bg-rose-100">
                    تکمیل ظرفیت
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time Window Slots for Selected Date */}
      {activeGroup && (
        <div className="pt-2">
          <label className="block text-xs font-bold text-gray-700 mb-3">
            ۲. ساعت تحویل سفارش در {activeGroup.dateStr} (بازه ۳ عصر الی ۹ شب):
          </label>

          <div className="grid grid-cols-1 gap-4">
            {activeGroup.slots.map((slot) => {
              const isSelected = selectedSlotId === slot.id;
              const isFull = slot.remainingCapacity <= 0;
              const isAvailable = slot.isAvailable && !isFull;

              return (
                <div
                  key={slot.id}
                  onClick={() => {
                    if (isAvailable) {
                      onSelectSlot(slot);
                    }
                  }}
                  className={`relative p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'border-[#2C4A2E] bg-[#F3EFE6]/50 shadow-sm ring-2 ring-[#2C4A2E]/20'
                      : isAvailable
                      ? 'border-[#E6E1D5] bg-white hover:border-[#2C4A2E]/40 hover:bg-[#F9F8F5]'
                      : 'border-rose-200 bg-rose-50/40 opacity-75 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className={`w-4 h-4 ${isFull ? 'text-rose-500' : 'text-[#2C4A2E]'}`} />
                      <span className={`text-sm font-bold ${isFull ? 'text-gray-600' : 'text-[#2C4A2E]'}`}>
                        {slot.timeWindow}
                      </span>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        isSelected
                          ? 'border-[#2C4A2E] bg-[#2C4A2E] text-white'
                          : isFull
                          ? 'border-rose-300 text-rose-500 bg-rose-50'
                          : 'border-gray-300'
                      }`}
                    >
                      {isSelected ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : isFull ? (
                        <Lock className="w-3.5 h-3.5" />
                      ) : null}
                    </div>
                  </div>

                  {/* ONLY show if capacity is full */}
                  {isFull && (
                    <div className="pt-2 border-t border-rose-200 flex items-center justify-between text-xs">
                      <span className="text-gray-500 font-medium">وضعیت پذیرش سفارش:</span>
                      <span className="font-bold text-rose-600 bg-white px-2.5 py-1 rounded-lg border border-rose-200">
                        تکمیل ظرفیت ارسال در این روز
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
