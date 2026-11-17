'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Shield } from 'lucide-react';

export default function AdminLoginRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const redirectParam = searchParams.get('redirect') || '/admin';
    const targetUrl = `/login?redirect=${encodeURIComponent(redirectParam)}&reason=admin_required`;
    router.replace(targetUrl);
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-[#F8F7F4] flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-sm w-full bg-white/80 backdrop-blur-md rounded-3xl p-8 border border-[#E6E1D5] shadow-xl space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-[#2C4A2E]/10 text-[#2C4A2E] flex items-center justify-center mx-auto">
          <Shield className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-black text-gray-900">انتقال به درگاه یکپارچه ورود</h2>
          <p className="text-xs text-gray-500">در حال انتقال امن به صفحه ورود اصلی مزارع شیراز...</p>
        </div>
        <div className="flex justify-center pt-2">
          <Loader2 className="w-6 h-6 text-[#2C4A2E] animate-spin" />
        </div>
      </div>
    </div>
  );
}
