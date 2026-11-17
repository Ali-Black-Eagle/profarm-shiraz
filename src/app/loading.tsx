import React from 'react';
import { Sprout } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 space-y-4">
      <div className="relative flex items-center justify-center">
        <div className="w-16 h-16 rounded-full border-4 border-[#E6E1D5] border-t-[#2C4A2E] animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center text-[#2C4A2E]">
          <Sprout className="w-6 h-6 animate-pulse" />
        </div>
      </div>
      <p className="text-xs font-bold text-[#2C4A2E] tracking-wider animate-pulse">
        در حال بارگذاری اطلاعات مزارع شیراز...
      </p>
    </div>
  );
}
