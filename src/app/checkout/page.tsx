'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useCart, calculateCartDiscounts } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { DeliverySlotPicker } from '@/components/modules/DeliverySlotPicker';
import { ShirazGuardAlert } from '@/components/modules/ShirazGuardAlert';
import { generateDeliverySlots, SlotOption } from '@/lib/jalali';
import { formatToman, toPersianDigits, isValidIranPhone, normalizePhoneNumber } from '@/lib/formatters';
import { Button } from '@/components/ui/Button';
import {
  MapPin,
  Calendar,
  CreditCard,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Package,
  Tag,
  Crown,
  Zap,
  TicketPercent,
  Wallet,
  Sparkles,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import { CouponInputBox } from '@/components/modules/CouponInputBox';
import { CouponValidationResult } from '@/types';
import { farmStore } from '@/lib/db-store';

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const subscriptionPlanParam = searchParams.get('subscriptionPlan');
  const isSubscription = subscriptionPlanParam === 'PRO' || subscriptionPlanParam === 'PLUS';
  const subscriptionPlan: 'PRO' | 'PLUS' = subscriptionPlanParam === 'PLUS' ? 'PLUS' : 'PRO';

  const { items, getTotalItemsCount, isBulkOrder, setBulkOrder, clearCart } = useCart();
  const { user, isAuthenticated, login, updateUser } = useAuth();

  const [mounted, setMounted] = useState(false);
  const [subSettings, setSubSettings] = useState(() => farmStore.getSubscriptionSettings());
  const [paymentSettings, setPaymentSettings] = useState(() => farmStore.getClientPaymentSettings());
  const [stats, setStats] = useState(() => farmStore.getSubscriptionStats());

  useEffect(() => {
    setMounted(true);
    setSubSettings(farmStore.getSubscriptionSettings());
    setPaymentSettings(farmStore.getClientPaymentSettings());
    setStats(farmStore.getSubscriptionStats());

    farmStore.syncSubscriptionSettings().then((synced) => {
      setSubSettings({ ...synced });
      setStats(farmStore.getSubscriptionStats());
    });

    const handleSubUpdate = () => {
      setSubSettings(farmStore.getSubscriptionSettings());
      setStats(farmStore.getSubscriptionStats());
    };

    window.addEventListener('profarm_subscription_updated', handleSubUpdate);
    return () => window.removeEventListener('profarm_subscription_updated', handleSubUpdate);
  }, []);

  const isPlanFull =
    isSubscription && (subscriptionPlan === 'PRO' ? stats.isProFull : stats.isPlusFull);

  const totalCount = getTotalItemsCount();
  const userTier = user?.tier || (user?.isProMember ? 'PRO' : 'FREE');
  const discounts = calculateCartDiscounts(items, userTier);
  const isPro = !!user?.isProMember;
  const [couponResult, setCouponResult] = useState<CouponValidationResult | null>(null);
  const couponDiscount = couponResult?.discountAmount || 0;

  // Subscription Pricing
  const subPrice =
    subscriptionPlan === 'PLUS'
      ? subSettings.plusMonthlyPrice || 149000
      : subSettings.proMonthlyPrice || 329000;

  const finalAmount = isSubscription
    ? Math.max(0, subPrice - couponDiscount)
    : Math.max(0, discounts.finalPayable - couponDiscount);

  const totalSavings = isSubscription
    ? couponDiscount
    : discounts.totalDiscount + couponDiscount;

  const totalPrice = isSubscription ? subPrice : discounts.itemsSubtotal;

  // Form State - dynamically populated from authenticated user
  const defaultAddr = user?.addresses?.find((a) => a.isDefault) || user?.addresses?.[0];
  const [recipientName, setRecipientName] = useState(user?.name || defaultAddr?.recipientName || '');
  const [phone, setPhone] = useState(user?.phone || defaultAddr?.phone || '');
  const [province, setProvince] = useState(defaultAddr?.province || 'فارس');
  const [city, setCity] = useState(defaultAddr?.city || 'شیراز');
  const [streetAddress, setStreetAddress] = useState(defaultAddr?.streetAddress || '');
  const [unit, setUnit] = useState(defaultAddr?.unit || '');
  const [postalCode, setPostalCode] = useState(defaultAddr?.postalCode || '');

  // Delivery Slot Selection (ONLY for physical product orders, never for subscriptions)
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<SlotOption | null>(null);

  // Payment Gateway Selection (ZarinPal vs SnappPay BNPL)
  const [paymentMethod, setPaymentMethod] = useState<'zarinpal' | 'snapppay'>('zarinpal');

  // Sync with user profile if it loads after mount
  useEffect(() => {
    if (user) {
      const addr = user.addresses?.find((a) => a.isDefault) || user.addresses?.[0];
      setRecipientName((prev) => prev || user.name || addr?.recipientName || '');
      setPhone((prev) => prev || user.phone || addr?.phone || '');
      if (addr) {
        setStreetAddress((prev) => prev || addr.streetAddress || '');
        setUnit((prev) => prev || addr.unit || '');
        setPostalCode((prev) => prev || addr.postalCode || '');
        if (addr.city) setCity(addr.city);
        if (addr.province) setProvince(addr.province);
      }
    }
  }, [user]);

  // Phone OTP Verification State for Checkout
  const [isPhoneVerified, setIsPhoneVerified] = useState<boolean>(() => {
    return Boolean(user?.isPhoneVerified && user?.phone);
  });
  const [otpStep, setOtpStep] = useState<'IDLE' | 'SENT'>('IDLE');
  const [otpCode, setOtpCode] = useState('');
  const [otpTimer, setOtpTimer] = useState(120);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpSuccessMsg, setOtpSuccessMsg] = useState<string | null>(null);
  const [otpErrorMsg, setOtpErrorMsg] = useState<string | null>(null);

  // Sync phone verification status with user
  useEffect(() => {
    if (
      user?.isPhoneVerified &&
      user?.phone &&
      phone &&
      normalizePhoneNumber(phone) === normalizePhoneNumber(user.phone)
    ) {
      setIsPhoneVerified(true);
    } else {
      setIsPhoneVerified(false);
    }
  }, [user, phone]);

  // Countdown timer for checkout OTP
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (otpStep === 'SENT' && otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpStep, otpTimer]);

  const handleSendCheckoutOtp = async () => {
    setOtpErrorMsg(null);
    setOtpSuccessMsg(null);
    if (!isValidIranPhone(phone)) {
      setOtpErrorMsg('لطفاً شماره تلفن همراه معتبر ۱۱ رقمی وارد نمایید (مانند ۰۹۱۷۱۲۳۴۵۶۷).');
      return;
    }
    setIsSendingOtp(true);
    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          phone,
          fallbackEmail: user?.email || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'خطا در ارسال کد تایید');
      }
      setOtpStep('SENT');
      setOtpTimer(120);
      setOtpCode('');
      setOtpSuccessMsg('کد تایید ۵ رقمی ارسال شد. لطفاً آن را وارد فرمایید.');
    } catch (err: any) {
      setOtpErrorMsg(err.message || 'خطا در برقراری ارتباط با سامانه پیامکی');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyCheckoutOtp = async () => {
    setOtpErrorMsg(null);
    setOtpSuccessMsg(null);
    if (otpCode.trim().length !== 5) {
      setOtpErrorMsg('لطفاً کد تایید ۵ رقمی را به صورت کامل وارد فرمایید.');
      return;
    }
    setIsVerifyingOtp(true);
    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify-checkout-phone',
          phone,
          code: otpCode.trim(),
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'کد تایید نادرست یا منقضی شده است.');
      }
      setIsPhoneVerified(true);
      setOtpStep('IDLE');
      setOtpSuccessMsg('شماره تلفن همراه با موفقیت تایید و برای حساب کاربری شما ثبت گردید.');
      if (data.user) {
        updateUser(data.user);
        login(data.user);
      }
    } catch (err: any) {
      setOtpErrorMsg(err.message || 'کد تایید نامعتبر است');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const renderPhoneVerificationField = (labelTitle: string) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-gray-700 font-semibold text-xs">
          {labelTitle}
        </label>
        {isPhoneVerified ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            شماره تایید شده است ✓
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold border border-amber-300">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            نیاز به تایید با کد پیامکی
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="tel"
          required
          placeholder="۰۹۱۷۱۲۳۴۵۶۷"
          value={phone}
          onChange={(e) => {
            const val = e.target.value;
            setPhone(val);
            if (
              user?.isPhoneVerified &&
              user?.phone &&
              normalizePhoneNumber(val) === normalizePhoneNumber(user.phone)
            ) {
              setIsPhoneVerified(true);
            } else {
              setIsPhoneVerified(false);
            }
          }}
          className={`w-full px-3.5 py-2.5 rounded-xl border ${
            isPhoneVerified
              ? 'border-emerald-400 bg-emerald-50/20'
              : 'border-[#E6E1D5] bg-[#F9F8F5]'
          } focus:bg-white focus:outline-none focus:border-[#2C4A2E] text-left font-mono font-bold text-sm transition-all`}
          dir="ltr"
        />

        {!isPhoneVerified && (
          <button
            type="button"
            onClick={handleSendCheckoutOtp}
            disabled={isSendingOtp || !isValidIranPhone(phone)}
            className="shrink-0 px-3.5 py-2.5 bg-[#2C4A2E] hover:bg-[#1E3520] disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            {isSendingOtp ? (
              <span>در حال ارسال...</span>
            ) : otpStep === 'SENT' ? (
              <span>ارسال مجدد</span>
            ) : (
              <span>دریافت کد تایید</span>
            )}
          </button>
        )}
      </div>

      {/* Inline Verification Box */}
      {!isPhoneVerified && otpStep === 'SENT' && (
        <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-300/80 space-y-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-amber-950">کد تایید ۵ رقمی پیامک‌شده:</span>
            <span className="text-amber-800 font-mono text-[11px]">
              {otpTimer > 0 ? `اعتبار: ${toPersianDigits(otpTimer)} ثانیه` : 'کد منقضی شده؛ ارسال مجدد را بزنید'}
            </span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              placeholder="•••••"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
              className="w-32 text-center tracking-[0.4em] px-3 py-2 rounded-xl border-2 border-amber-300 bg-white font-mono font-black text-lg text-[#2C4A2E] focus:outline-none focus:border-[#2C4A2E]"
              dir="ltr"
            />
            <button
              type="button"
              onClick={handleVerifyCheckoutOtp}
              disabled={isVerifyingOtp || otpCode.trim().length !== 5}
              className="flex-1 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
            >
              {isVerifyingOtp ? 'در حال بررسی...' : 'تایید و ثبت شماره در حساب'}
            </button>
          </div>

          {otpErrorMsg && (
            <p className="text-xs text-rose-700 font-bold flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{otpErrorMsg}</span>
            </p>
          )}

          {otpSuccessMsg && (
            <p className="text-xs text-emerald-800 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{otpSuccessMsg}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );

  // Submission state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const err = searchParams.get('error');
    if (err) {
      if (err === 'payment_cancelled_or_failed') {
        setErrorMessage('پرداخت توسط شما لغو شد یا با خطا در درگاه بانکی مواجه گردید.');
      } else if (err === 'invalid_payment_authority' || err === 'invalid_authority') {
        setErrorMessage('شناسه تایید پرداخت نامعتبر است. سفارش تایید نشد.');
      } else if (err === 'order_not_found') {
        setErrorMessage('سفارش مورد نظر یافت نشد.');
      } else if (err === 'snapppay_verification_failed') {
        setErrorMessage('تایید پرداخت اقساطی اسنپ‌پی با خطا مواجه شد. در صورت کسر وجه، مبلغ بازگردانده خواهد شد.');
      } else if (err === 'payment_verification_failed') {
        setErrorMessage('تایید پرداخت با خطا مواجه شد. در صورت کسر وجه از حساب، مبلغ ظرف ۷۲ ساعت بازگردانده می‌شود.');
      } else {
        setErrorMessage('خطایی در فرآیند پرداخت رخ داده است. لطفاً مجدداً تلاش فرمایید.');
      }
    }
  }, [searchParams]);

  // Generate delivery slots only if this is NOT a subscription checkout
  useEffect(() => {
    if (isSubscription) return;

    const capacities = farmStore.getDailyCapacities();
    const map: Record<string, { maxCapacity?: number; currentBookings?: number; isClosedManually?: boolean }> = {};
    capacities.forEach((c) => {
      map[c.dateIso] = {
        maxCapacity: c.maxCapacity,
        currentBookings: c.bookedCount,
        isClosedManually: c.isClosedManually,
      };
    });

    const generated = generateDeliverySlots(isPro, 12, map);
    setSlots(generated);
    const firstAvailable = generated.find((s) => s.isAvailable);
    if (firstAvailable) {
      setSelectedSlot(firstAvailable);
    } else {
      setSelectedSlot(null);
    }
  }, [isPro, isSubscription]);

  const isCityShiraz =
    city.trim() === 'شیراز' || city.trim() === 'شهر شیراز' || city.trim() === '';
  const meetsBulkCriteria = totalCount >= 10 || totalPrice >= 5000000;
  const isBlockedByShirazRule = !isSubscription && !isCityShiraz && !(isBulkOrder && meetsBulkCriteria);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const redirectTarget = isSubscription
      ? `/checkout?subscriptionPlan=${subscriptionPlan}`
      : '/checkout';

    if (!user || !isAuthenticated) {
      setErrorMessage('جهت تکمیل سفارش و اتصال به درگاه، لطفاً ابتدا وارد حساب کاربری شوید.');
      router.push(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
      return;
    }

    if (isSubscription && isPlanFull) {
      setErrorMessage(
        `ظرفیت اشتراک ${subscriptionPlan === 'PRO' ? 'طلایی پرو' : 'اقتصادی پلاس'} در این دوره تکمیل شده است و امکان فعال‌سازی جدید وجود ندارد.`
      );
      return;
    }

    if (!isSubscription && items.length === 0) {
      setErrorMessage('سبد خرید شما خالی است.');
      return;
    }

    if (!recipientName.trim()) {
      setErrorMessage('لطفاً نام و نام‌خانوادگی را وارد نمایید.');
      return;
    }

    if (!isValidIranPhone(phone)) {
      setErrorMessage('شماره موبایل وارد شده معتبر نمی‌باشد (مانند ۰۹۱۷۱۲۳۴۵۶۷).');
      return;
    }

    if (!isPhoneVerified) {
      setErrorMessage('تایید شماره همراه الزامی است. لطفاً روی دکمه «دریافت کد تایید» کلیک کرده و شماره خود را تایید فرمایید.');
      return;
    }

    if (!isSubscription && !streetAddress.trim()) {
      setErrorMessage('لطفاً نشانی کامل پستی را وارد فرمایید.');
      return;
    }

    if (!isSubscription && isBlockedByShirazRule) {
      setErrorMessage('سفارشات خارج از شیراز تنها به صورت خرید عمده قابل ثبت است.');
      return;
    }

    if (!isSubscription && !selectedSlot) {
      setErrorMessage('لطفاً یک بازه زمانی معتبر برای تحویل سفارش انتخاب کنید.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Send order payload to API
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientName,
          phone,
          province: province || 'فارس',
          city: city || 'شیراز',
          streetAddress: isSubscription ? 'فعال‌سازی سرویس اشتراک آنلاین پروفارم' : streetAddress,
          unit: isSubscription ? '' : unit,
          postalCode: isSubscription ? '' : postalCode,
          isShiraz: isCityShiraz,
          deliverySlot: isSubscription ? null : selectedSlot,
          isBulkOrder: isSubscription ? false : isBulkOrder,
          isSubscription,
          subscriptionPlan: isSubscription ? subscriptionPlan : undefined,
          items: isSubscription
            ? []
            : items.map((i) => ({
                productId: i.product.id,
                quantity: i.quantity,
                unitPrice: i.product.price,
              })),
          totalAmount: finalAmount,
          appliedCouponCode: couponResult?.coupon?.code || null,
          paymentMethod,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message || 'خطا در ثبت سفارش');
      }

      if (data.order) {
        try {
          farmStore.syncOrderFromApi(data.order);
        } catch (e) {
          console.warn('Failed to sync order locally', e);
        }
      }

      // 2. Redirect to genuine bank payment gateway (Shaparak / ZarinPal or SnappPay)
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        throw new Error(
          'آدرس درگاه پرداخت از سرور دریافت نشد. لطفاً از پیکربندی صحیح درگاه بانکی در سرور اطمینان حاصل فرمایید.'
        );
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'خطا در اتصال به درگاه پرداخت');
      setIsLoading(false);
    }
  };

  if (!mounted) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 rounded-full border-2 border-[#2C4A2E] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Page Header */}
      <div className="pb-4 border-b border-[#E6E1D5]">
        <div className="flex items-center gap-2 mb-1">
          {isSubscription ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#D4AF37]/15 text-[#996515] border border-[#D4AF37]/30">
              <Crown className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>اشتراک ویژه باشگاه مشتریان پروفارم</span>
            </div>
          ) : null}
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#2C4A2E]">
          {isSubscription
            ? `تسویه‌حساب و فعال‌سازی ${
                subscriptionPlan === 'PLUS' ? 'اشتراک نقره‌ای پلاس' : 'اشتراک طلایی پرو'
              }`
            : 'تسویه‌حساب و زمان‌بندی تحویل سفارش'}
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          {isSubscription
            ? subscriptionPlan === 'PLUS'
              ? 'عضویت ۳۰ روزه با امکان تحویل ۶ روز در هفته و ۵٪ تخفیف تخم‌مرغ محلی (ارسال با تعرفه عادی پیک بدون تخفیف)'
              : 'عضویت ۳۰ روزه با امکان تحویل ۶ روز در هفته، ۲۰٪ تخفیف هزینه ارسال پیک، ۱۰٪ تخفیف تخم‌مرغ و ۵٪ سایر محصولات'
            : 'مشخصات نشانی شیراز و انتخاب زمان مناسب برای تحویل با پیک پروفارم'}
        </p>
      </div>

      {isSubscription && isPlanFull && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-3xl p-5 sm:p-6 flex items-start gap-4 shadow-md text-rose-900 animate-in fade-in">
          <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black">ظرفیت پذیرش این اشتراک تکمیل شده است</h3>
            <p className="text-xs text-rose-800 leading-relaxed">
              ظرفیت اعضای مجاز برای این اشتراک در این دوره به حداکثر رسیده است و امکان پرداخت و ثبت‌نام جدید وجود ندارد. لطفاً پلن دیگری را انتخاب کنید یا با پشتیبانی تماس بگیرید.
            </p>
          </div>
        </div>
      )}

      {(!isAuthenticated || !user) && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">
                حساب کاربری فعال یافت نشد
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                {isSubscription
                  ? 'برای فعال‌سازی اشتراک بر روی حساب کاربری شما، لطفاً ابتدا وارد شوید.'
                  : 'برای نهایی‌سازی سفارش، صدور فاکتور رسمی و پیگیری پیک اختصاصی شیراز، لطفاً ابتدا وارد حساب خود شوید.'}
              </p>
            </div>
          </div>
          <Link
            href={`/login?redirect=${encodeURIComponent(
              isSubscription ? `/checkout?subscriptionPlan=${subscriptionPlan}` : '/checkout'
            )}`}
            className="w-full sm:w-auto text-center px-5 py-2.5 bg-[#2C4A2E] text-white text-xs font-bold rounded-xl hover:bg-[#223924] transition-colors shadow-sm"
          >
            ورود سریع با پیامک / رمز
          </Link>
        </div>
      )}

      <form onSubmit={handleSubmitOrder}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Steps Column */}
          <div className="lg:col-span-8 space-y-6">
            {/* Step 1: Address or Subscription Account Details */}
            {isSubscription ? (
              <div className="bg-white rounded-3xl p-6 border border-[#E6E1D5] shadow-farm space-y-5">
                <div className="flex items-center gap-3 pb-3 border-b border-[#F3EFE6]">
                  <div className="w-10 h-10 rounded-2xl bg-[#2C4A2E]/10 flex items-center justify-center text-[#2C4A2E]">
                    <Crown className="w-5 h-5 text-[#D4AF37]" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#2C4A2E]">
                      ۱. مشخصات دارنده اشتراک و فعال‌سازی
                    </h3>
                    <p className="text-xs text-gray-500">
                      این اشتراک روی شماره موبایل و حساب کاربری زیر فعال شده و نیازی به انتخاب بازه ارسال ندارد
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1.5">
                      نام و نام‌خانوادگی مشترک:
                    </label>
                    <input
                      type="text"
                      required
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E]"
                      placeholder="نام خود را وارد کنید"
                    />
                  </div>

                  {renderPhoneVerificationField('شماره تلفن همراه (پیامک تایید اشتراک):')}

                  <div>
                    <label className="block text-gray-700 font-semibold mb-1.5">استان:</label>
                    <input
                      type="text"
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E]"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 font-semibold mb-1.5">شهر:</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E]"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    سرویس آنلاین: بلافاصله پس از پرداخت بانکی، وضعیت اشتراک حساب شما فعال شده و در سفارشات بعدی بازه‌های ارسال ۶ روزه برای شما نمایش داده خواهد شد.
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-6 border border-[#E6E1D5] shadow-farm space-y-5">
                <div className="flex items-center gap-3 pb-3 border-b border-[#F3EFE6]">
                  <div className="w-10 h-10 rounded-2xl bg-[#2C4A2E]/10 flex items-center justify-center text-[#2C4A2E]">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#2C4A2E]">
                      ۱. آدرس تحویل و موقعیت جغرافیایی
                    </h3>
                    <p className="text-xs text-gray-500">
                      خرده‌فروشی مختص شیراز بوده و سایر شهرها مستلزم حدنصاب عمده می‌باشند
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1.5">
                      نام و نام‌خانوادگی تحویل‌گیرنده:
                    </label>
                    <input
                      type="text"
                      required
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E]"
                    />
                  </div>

                  {renderPhoneVerificationField('شماره تلفن همراه (پیامک وضعیت و هماهنگی تحویل):')}

                  <div>
                    <label className="block text-gray-700 font-semibold mb-1.5">استان:</label>
                    <input
                      type="text"
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E]"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 font-semibold mb-1.5">
                      شهر مقصد:
                    </label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-gray-700 font-semibold mb-1.5">
                      نشانی دقیق خیابان و کوچه:
                    </label>
                    <input
                      type="text"
                      required
                      value={streetAddress}
                      onChange={(e) => setStreetAddress(e.target.value)}
                      placeholder="مثال: بلوار ارم، کوچه ۶، پلاک ۱۲"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E]"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 font-semibold mb-1.5">پلاک / واحد:</label>
                    <input
                      type="text"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E]"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 font-semibold mb-1.5">کد پستی ۱۰ رقمی:</label>
                    <input
                      type="text"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E] text-left"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Shiraz Rule Geographic Enforcement Alert */}
                <ShirazGuardAlert
                  city={city}
                  isBulkOrder={isBulkOrder}
                  totalItemsCount={totalCount}
                  totalPrice={totalPrice}
                  onEnableBulkMode={() => setBulkOrder(true)}
                />
              </div>
            )}

            {/* Step 2: Delivery Slot Picker ONLY for product orders, NOT for subscriptions */}
            {!isSubscription ? (
              <DeliverySlotPicker
                slots={slots}
                selectedSlotId={selectedSlot?.id || null}
                onSelectSlot={(slot) => setSelectedSlot(slot)}
                isProMember={isPro}
              />
            ) : (
              <div className="bg-gradient-to-br from-[#2C4A2E]/5 via-[#2C4A2E]/10 to-transparent rounded-3xl p-6 border border-[#2C4A2E]/20 shadow-farm space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-[#E6E1D5]">
                  <div className="w-10 h-10 rounded-2xl bg-[#2C4A2E] text-white flex items-center justify-center shadow-sm">
                    {subscriptionPlan === 'PLUS' ? (
                      <Zap className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Sparkles className="w-5 h-5 text-[#D4AF37]" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#2C4A2E]">
                      {subscriptionPlan === 'PLUS'
                        ? 'مزایای اشتراک اقتصادی پلاس (Plus)'
                        : 'مزایای کامل اشتراک طلایی پرو (Pro)'}
                    </h3>
                    <p className="text-xs text-gray-500">
                      این سفارش نیازی به زمان تحویل ندارد؛ پس از پرداخت، مزایای زیر بلافاصله روی حساب کاربری شما اعمال خواهد شد:
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Feature 1: 6 Days Delivery */}
                  <div className="flex items-start gap-2 bg-white/90 p-3 rounded-2xl border border-emerald-100 shadow-xs">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-gray-900 block">ارسال ۶ روز در هفته:</span>
                      <span className="text-gray-600 text-[11px]">
                        امکان انتخاب روزهای تحویل از شنبه تا پنج‌شنبه در خریدهای آینده شهر شیراز
                      </span>
                    </div>
                  </div>

                  {/* Feature 2: Egg Discount */}
                  <div className="flex items-start gap-2 bg-white/90 p-3 rounded-2xl border border-emerald-100 shadow-xs">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-gray-900 block">تخفیف تخم‌مرغ محلی:</span>
                      <span className="text-gray-600 text-[11px]">
                        {subscriptionPlan === 'PLUS'
                          ? '۵٪ تخفیف خودکار تخم‌مرغ تا سقف ۲۰۰ عدد در ماه'
                          : '۱۰٪ تخفیف طلایی تخم‌مرغ تا سقف ۶۰۰ عدد در ماه'}
                      </span>
                    </div>
                  </div>

                  {/* Feature 3: Courier Delivery Discount (PRO: 20%, PLUS: NONE) */}
                  {subscriptionPlan === 'PRO' ? (
                    <div className="flex items-start gap-2 bg-amber-50/60 p-3 rounded-2xl border border-amber-200 shadow-xs">
                      <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-amber-950 block">تخفیف هزینه پیک:</span>
                        <span className="text-amber-800 text-[11px]">
                          ۲۰٪ تخفیف دائمی و نامحدود روی هزینه پیک اختصاصی پروفارم در شیراز
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 bg-gray-50/80 p-3 rounded-2xl border border-gray-200">
                      <X className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-gray-500 block">تخفیف ارسال با پیک:</span>
                        <span className="text-gray-500 text-[11px]">
                          ندارد (محاسبه با تعرفه عادی پیک؛ ۲۰٪ تخفیف پیک مختص مشترکین پرو است)
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Feature 4: Other items discount (PRO: 5%, PLUS: NONE) */}
                  {subscriptionPlan === 'PRO' ? (
                    <div className="flex items-start gap-2 bg-amber-50/60 p-3 rounded-2xl border border-amber-200 shadow-xs">
                      <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-amber-950 block">تخفیف سایر کالاها:</span>
                        <span className="text-amber-800 text-[11px]">
                          ۵٪ تخفیف نامحدود روی عسل، عرقیات، لبنیات، خشکبار و سبزیجات
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 bg-gray-50/80 p-3 rounded-2xl border border-gray-200">
                      <X className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-gray-500 block">تخفیف سایر محصولات:</span>
                        <span className="text-gray-500 text-[11px]">
                          ندارد (محاسبه با قیمت عادی؛ ۵٪ تخفیف روی سایر کالاها مختص پرو است)
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Feature 5: Support and supply */}
                  <div className="flex items-start gap-2 bg-white/90 p-3 rounded-2xl border border-emerald-100 shadow-xs sm:col-span-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-gray-900 block">
                        {subscriptionPlan === 'PRO'
                          ? 'اولویت VIP در تامین نوبرانه‌ها و ارسال سریع:'
                          : 'پشتیبانی اختصاصی و تامین روزانه مزارع:'}
                      </span>
                      <span className="text-gray-600 text-[11px]">
                        {subscriptionPlan === 'PRO'
                          ? 'رزرو زودهنگام محصولات فصلی کمیاب (عسل وحشی، پنیر کوزه‌ای) و بسته‌بندی نفیس'
                          : 'تامین اقلام تازه با تضمین اصالت و سلامت ارگانیک'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Payment Method Selection (ZarinPal vs SnappPay BNPL) */}
            <div className="bg-white rounded-3xl p-6 border border-[#E6E1D5] shadow-farm space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-[#F3EFE6]">
                <div className="w-10 h-10 rounded-2xl bg-[#2C4A2E]/10 flex items-center justify-center text-[#2C4A2E]">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#2C4A2E]">
                    {isSubscription ? '۲. انتخاب شیوه پرداخت اشتراک' : 'مرحله ۳: انتخاب شیوه پرداخت'}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    پرداخت مستقیم با کارت بانکی یا خرید اقساطی ۴ ماهه اسنپ‌پی بدون کارمزد
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                {/* Option 1: ZarinPal */}
                <div
                  onClick={() => setPaymentMethod('zarinpal')}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                    paymentMethod === 'zarinpal'
                      ? 'border-[#2C4A2E] bg-emerald-50/40 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#2C4A2E] text-[#D4AF37] flex items-center justify-center font-black text-sm">
                        Z
                      </div>
                      <div>
                        <div className="font-bold text-xs text-gray-900">درگاه پرداخت زرین‌پال</div>
                        <span className="text-[10px] text-gray-500">پرداخت امن شاپرک با کلیه کارت‌ها</span>
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        paymentMethod === 'zarinpal'
                          ? 'border-[#2C4A2E] bg-[#2C4A2E] text-white'
                          : 'border-gray-300'
                      }`}
                    >
                      {paymentMethod === 'zarinpal' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </div>
                  </div>

                  <div className="text-[11px] text-gray-600 bg-white p-2 rounded-xl border border-gray-100 flex items-center justify-between">
                    <span>مبلغ پرداخت نقدی:</span>
                    <span className="font-bold text-[#2C4A2E]">{formatToman(finalAmount)}</span>
                  </div>
                </div>

                {/* Option 2: SnappPay BNPL (if enabled) */}
                {paymentSettings.snapppay.enabled && (
                  <div
                    onClick={() => setPaymentMethod('snapppay')}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                      paymentMethod === 'snapppay'
                        ? 'border-[#00D170] bg-emerald-50/50 shadow-sm ring-2 ring-[#00D170]/20'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#00D170] text-white flex items-center justify-center font-black text-base shadow-xs">
                          S
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-gray-900">خرید اقساطی اسنپ‌پی</span>
                            <span className="text-[9px] bg-[#00D170] text-white font-bold px-1.5 py-0.2 rounded-md">
                              بدون کارمزد
                            </span>
                          </div>
                          <span className="text-[10px] text-emerald-700 font-medium">پرداخت در ۴ قسط بدون ضامن</span>
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                          paymentMethod === 'snapppay'
                            ? 'border-[#00D170] bg-[#00D170] text-white'
                            : 'border-gray-300'
                        }`}
                      >
                        {paymentMethod === 'snapppay' && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </div>
                    </div>

                    <div className="text-[11px] text-gray-700 bg-white p-2 rounded-xl border border-emerald-100 flex items-center justify-between">
                      <span>قسط اول (امروز):</span>
                      <span className="font-black text-emerald-800">
                        {formatToman(Math.ceil(finalAmount / 4))}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Trust Guide Banner */}
              <div className="p-3 rounded-2xl bg-[#F8F7F4] border border-[#E6E1D5] text-xs text-gray-700 flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <span className="font-medium">
                  {paymentSettings.general.guideMessage ||
                    'پرداخت امن از طریق درگاه رسمی شاپرک با کلیه کارت‌های عضو شتاب'}
                </span>
              </div>

              {paymentMethod === 'snapppay' && paymentSettings.snapppay.enabled && (
                <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-900 space-y-1.5 animate-in fade-in">
                  <div className="font-bold flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-[#00D170]" />
                    <span>برنامه ۴ قسطه اسنپ‌پی (بدون چک و بدون سود):</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] text-center">
                    <div className="bg-white p-2 rounded-xl border border-emerald-200">
                      <span className="block text-gray-500 text-[10px]">قسط ۱ (امروز)</span>
                      <strong className="text-emerald-800">{formatToman(Math.ceil(finalAmount / 4))}</strong>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-emerald-100">
                      <span className="block text-gray-500 text-[10px]">قسط ۲ (۱ ماه بعد)</span>
                      <strong>{formatToman(Math.ceil(finalAmount / 4))}</strong>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-emerald-100">
                      <span className="block text-gray-500 text-[10px]">قسط ۳ (۲ ماه بعد)</span>
                      <strong>{formatToman(Math.ceil(finalAmount / 4))}</strong>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-emerald-100">
                      <span className="block text-gray-500 text-[10px]">قسط ۴ (۳ ماه بعد)</span>
                      <strong>{formatToman(finalAmount - Math.ceil(finalAmount / 4) * 3)}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Checkout Summary & Payment Action */}
          <div className="lg:col-span-4 space-y-5">
            {/* Coupon Input Box */}
            <CouponInputBox
              cartItems={items}
              itemsSubtotal={totalPrice}
              shippingFee={isSubscription ? 0 : discounts.finalShipping}
              onCouponChange={(res) => setCouponResult(res)}
              showSuggestions={false}
            />

            <div className="bg-white rounded-3xl p-6 border border-[#E6E1D5] shadow-farm space-y-5 sticky top-28">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[#F3EFE6]">
                <CreditCard className="w-5 h-5 text-[#2C4A2E]" />
                <h3 className="text-base font-bold text-[#2C4A2E]">
                  {isSubscription ? 'پیش‌فاکتور عضویت اشتراک' : 'پیش‌فاکتور نهایی'}
                </h3>
              </div>

              <div className="space-y-3 text-xs text-gray-600">
                {isSubscription ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span>نوع اشتراک:</span>
                      <span className="font-bold text-[#2C4A2E]">
                        {subscriptionPlan === 'PLUS' ? 'اشتراک نقره‌ای پلاس' : 'اشتراک طلایی پرو'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span>مدت اعتبار:</span>
                      <span className="font-bold text-[#2C4A2E]">۳۰ روز کامل</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span>تحویل در سفارشات آتی:</span>
                      <span className="font-bold text-emerald-700">۶ روز در هفته (شنبه تا ۵شنبه)</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span>تخفیف تخم‌مرغ محلی:</span>
                      <span className="font-bold text-emerald-700">
                        {subscriptionPlan === 'PLUS' ? '۵٪ تخفیف (تا ۲۰۰ عدد)' : '۱۰٪ تخفیف (تا ۶۰۰ عدد)'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span>تخفیف ارسال با پیک:</span>
                      {subscriptionPlan === 'PRO' ? (
                        <span className="font-bold text-amber-700">۲۰٪ تخفیف دائمی</span>
                      ) : (
                        <span className="font-medium text-gray-400 text-[11px]">ندارد (تعرفه عادی پیک)</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span>تخفیف سایر کالاها:</span>
                      {subscriptionPlan === 'PRO' ? (
                        <span className="font-bold text-amber-700">۵٪ تخفیف نامحدود</span>
                      ) : (
                        <span className="font-medium text-gray-400 text-[11px]">ندارد (مختص اشتراک پرو)</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span>هزینه اشتراک ماهانه:</span>
                      <span className="font-bold text-[#2C4A2E]">{formatToman(subPrice)}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span>هزینه تحویل این فاکتور:</span>
                      <span className="font-bold text-emerald-700">رایگان (فعال‌سازی آنلاین)</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span>تعداد پکیج‌ها:</span>
                      <span className="font-bold text-[#2C4A2E]">
                        {toPersianDigits(totalCount)} بسته
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span>ارزش اقلام:</span>
                      <span className="font-bold text-[#2C4A2E]">{formatToman(discounts.itemsSubtotal)}</span>
                    </div>

                    {discounts.eggDiscount > 0 && (
                      <div className="flex items-center justify-between text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200">
                        <span className="flex items-center gap-1">
                          <Tag className="w-3.5 h-3.5 text-emerald-600" />
                          <span>تخفیف تخم‌مرغ ({userTier === 'PRO' ? '۱۰٪ پرو' : '۵٪ پلاس'}):</span>
                        </span>
                        <span className="font-bold">- {formatToman(discounts.eggDiscount)}</span>
                      </div>
                    )}

                    {discounts.otherDiscount > 0 && (
                      <div className="flex items-center justify-between text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200">
                        <span className="flex items-center gap-1">
                          <Tag className="w-3.5 h-3.5 text-emerald-600" />
                          <span>تخفیف ۵٪ سایر کالاها (پرو):</span>
                        </span>
                        <span className="font-bold">- {formatToman(discounts.otherDiscount)}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <span>هزینه ارسال با پیک پروفارم:</span>
                        {discounts.shippingDiscount > 0 && (
                          <span className="text-[10px] text-amber-600 font-bold">(۲۰٪ تخفیف پرو)</span>
                        )}
                      </span>
                      <span className="font-bold text-[#2C4A2E]">
                        {formatToman(discounts.finalShipping)}
                      </span>
                    </div>
                  </>
                )}

                {/* Coupon Discount */}
                {couponDiscount > 0 && (
                  <div className="flex items-center justify-between text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200">
                    <span className="flex items-center gap-1">
                      <TicketPercent className="w-3.5 h-3.5 text-emerald-600" />
                      <span>کد تخفیف ({couponResult?.coupon?.code}):</span>
                    </span>
                    <span className="font-bold">- {formatToman(couponDiscount)}</span>
                  </div>
                )}

                {totalSavings > 0 && (
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-700 pt-1 border-t border-dashed border-gray-200">
                    <span>مجموع سود و تخفیف شما:</span>
                    <span>{formatToman(totalSavings)} سود</span>
                  </div>
                )}

                {!isSubscription && selectedSlot && (
                  <div className="p-3 rounded-2xl bg-[#F9F8F5] border border-[#E6E1D5] space-y-1">
                    <span className="block font-bold text-[#2C4A2E]">زمان تحویل انتخابی:</span>
                    <div className="text-[11px] text-gray-700">
                      {selectedSlot.dateStr} | {selectedSlot.timeWindow}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-[#F3EFE6] flex items-baseline justify-between">
                <span className="text-sm font-bold text-gray-800">مبلغ پرداخت:</span>
                <span className="text-xl font-black text-[#2C4A2E]">
                  {formatToman(finalAmount)}
                </span>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Payment Submit Button */}
              <Button
                type="submit"
                variant={isBlockedByShirazRule || isPlanFull ? 'outline' : 'primary'}
                size="lg"
                disabled={isBlockedByShirazRule || isPlanFull || isLoading || (!isSubscription && items.length === 0)}
                isLoading={isLoading}
                className={`w-full ${
                  paymentMethod === 'snapppay'
                    ? '!bg-[#00D170] hover:!bg-[#00B963] !text-white'
                    : ''
                }`}
              >
                {isBlockedByShirazRule
                  ? 'پرداخت غیرفعال (آدرس خارج از شیراز)'
                  : isPlanFull
                  ? 'تکمیل ظرفیت (امکان پرداخت وجود ندارد)'
                  : isSubscription
                  ? paymentMethod === 'snapppay'
                    ? `پرداخت قسط اول (${formatToman(Math.ceil(finalAmount / 4))})`
                    : `پرداخت و فعال‌سازی اشتراک (${formatToman(finalAmount)})`
                  : paymentMethod === 'snapppay'
                  ? `پرداخت قسط اول اسنپ‌پی (${formatToman(Math.ceil(finalAmount / 4))})`
                  : 'پرداخت امن با درگاه زرین‌پال'}
              </Button>

              <div className="flex items-center justify-center gap-2 text-[11px] text-gray-400 pt-1 text-center">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>
                  {isSubscription
                    ? 'ضمانت بازگشت وجه در صورت انصراف طی ۷ روز اول'
                    : 'تضمین بازگشت وجه در صورت عدم رضایت از کیفیت ارگانیک'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 py-16 flex items-center justify-center min-h-[50vh]">
          <div className="w-8 h-8 rounded-full border-2 border-[#2C4A2E] border-t-transparent animate-spin" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
