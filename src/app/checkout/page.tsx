'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { useQuote, QuoteRequest } from '@/hooks/useQuote';
import { DeliverySlotPicker } from '@/components/modules/DeliverySlotPicker';
import { ShirazGuardAlert } from '@/components/modules/ShirazGuardAlert';
import { CouponInputBox } from '@/components/modules/CouponInputBox';
import { SlotOption, formatIsoDateToJalali, SLOT_TIME_LABEL } from '@/lib/jalali';
import {
  formatToman,
  toPersianDigits,
  toEnglishDigits,
  isValidIranPhone,
  normalizePhoneNumber,
} from '@/lib/formatters';
import { SITE_CONFIG } from '@/lib/site-config';
import { OTP_LENGTH } from '@/lib/otp-config';
import { Button } from '@/components/ui/Button';
import type { Address } from '@/types';
import {
  MapPin,
  CreditCard,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  Tag,
  Crown,
  Zap,
  TicketPercent,
  Wallet,
  Check,
  AlertCircle,
  Banknote,
  ShoppingBag,
} from 'lucide-react';

const CHECKOUT_DRAFT_KEY = 'profarm_checkout_draft';
/** Pause after the last city keystroke before the quote is requested again. */
const CITY_QUOTE_DEBOUNCE_MS = 800;
type PaymentMethod = 'zarinpal' | 'snapppay' | 'cod';
const METHOD_ORDER: PaymentMethod[] = ['zarinpal', 'snapppay', 'cod'];

const IRAN_PROVINCES = [
  'فارس', 'تهران', 'اصفهان', 'بوشهر', 'خوزستان', 'کرمان', 'هرمزگان', 'یزد', 'کهگیلویه و بویراحمد',
  'خراسان رضوی', 'آذربایجان شرقی', 'آذربایجان غربی', 'البرز', 'گیلان', 'مازندران', 'قم', 'قزوین',
  'مرکزی', 'همدان', 'لرستان', 'کرمانشاه', 'کردستان', 'گلستان', 'سمنان', 'زنجان', 'اردبیل',
  'چهارمحال و بختیاری', 'سیستان و بلوچستان', 'خراسان جنوبی', 'خراسان شمالی', 'ایلام',
] as const;

/** Persian messages for every error code the payment callback can redirect with. */
const VERIFY_ERROR_MESSAGES: Record<string, string> = {
  payment_cancelled_or_failed:
    'پرداخت لغو شد یا با خطا مواجه گردید. کالاهای این سفارش آزاد شدند و سبد خرید شما حفظ است؛ می‌توانید دوباره تلاش کنید.',
  invalid_payment_authority: 'شناسه تایید پرداخت نامعتبر است. سفارش تایید نشد.',
  invalid_authority: 'شناسه تایید پرداخت نامعتبر است. سفارش تایید نشد.',
  invalid_payment_token: 'توکن پرداخت نامعتبر است. سفارش تایید نشد.',
  missing_order_number: 'شماره سفارش در بازگشت از درگاه یافت نشد. اگر وجهی کسر شده، از بخش سفارش‌ها پیگیری فرمایید.',
  order_not_found: 'سفارش مورد نظر یافت نشد.',
  order_expired:
    'مهلت پرداخت این سفارش به پایان رسیده و سفارش لغو شده است. وجهی کسر نشده است؛ لطفاً سفارش را دوباره ثبت فرمایید.',
  order_not_payable: 'این سفارش دیگر قابل پرداخت نیست.',
  paid_after_cancel:
    'پرداخت شما دریافت شد اما سفارش پیش‌تر لغو شده بود. کارشناسان ما برای بازگرداندن وجه با شما تماس می‌گیرند.',
  snapppay_verification_failed:
    'تایید پرداخت اقساطی اسنپ‌پی با خطا مواجه شد. در صورت کسر وجه، مبلغ بازگردانده خواهد شد.',
  payment_verification_failed:
    'تایید پرداخت با خطا مواجه شد. در صورت کسر وجه از حساب، مبلغ ظرف ۷۲ ساعت بازگردانده می‌شود.',
};

interface ApiSlot {
  id: string;
  isoDate: string;
  window: string;
  jalaliLabel: string;
  maxCapacity: number;
  bookedCount: number;
  remainingCapacity: number;
  isClosed: boolean;
  isFull: boolean;
  isAllowedForTier: boolean;
  isAvailable: boolean;
}

interface PaymentOptions {
  gateways: {
    zarinpal: { enabled: boolean };
    snapppay: { enabled: boolean; minAmount: number };
    cod: { enabled: boolean };
  };
  mockGateway: boolean;
  guideMessage?: string;
}

interface PlanSummary {
  monthlyPrice: number;
  eggDiscountPercent: number;
  eggQuota: number;
  deliveryDaysPerWeek: number;
  isFull: boolean;
}

function toSlotOption(s: ApiSlot): SlotOption {
  return {
    id: s.id,
    dateStr: s.jalaliLabel,
    jalali: formatIsoDateToJalali(s.isoDate),
    timeWindow: SLOT_TIME_LABEL,
    timeWindowId: s.window,
    maxCapacity: s.maxCapacity,
    currentBookings: s.bookedCount,
    remainingCapacity: s.remainingCapacity,
    isAvailable: s.isAvailable && !s.isClosed,
    isAllowedForTier: s.isAllowedForTier,
    tierRestrictionNote: s.isAllowedForTier ? undefined : 'ویژه اعضای پلاس و پرو',
  };
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const subscriptionPlanParam = searchParams.get('subscriptionPlan');
  const isSubscription = subscriptionPlanParam === 'PRO' || subscriptionPlanParam === 'PLUS';
  const subscriptionPlan: 'PRO' | 'PLUS' = subscriptionPlanParam === 'PLUS' ? 'PLUS' : 'PRO';

  const { lines, appliedCouponCode, clearCart, refreshCatalog, getTotalItemsCount } = useCart();
  const { user, isAuthenticated, refreshProfile } = useAuth();

  const [mounted, setMounted] = useState(false);
  const [plans, setPlans] = useState<Record<string, PlanSummary> | null>(null);
  const [paymentOpts, setPaymentOpts] = useState<PaymentOptions | null>(null);

  // Delivery
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [slotsTier, setSlotsTier] = useState<'FREE' | 'PLUS' | 'PRO'>('FREE');
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);

  // Address form
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [recipientName, setRecipientName] = useState('');
  const [phone, setPhone] = useState('');
  const [province, setProvince] = useState('فارس');
  const [city, setCity] = useState('شیراز');
  const [streetAddress, setStreetAddress] = useState('');
  const [unit, setUnit] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const draftRestoredRef = React.useRef(false);

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('zarinpal');

  // Phone verification (inline OTP)
  const [otpStep, setOtpStep] = useState<'IDLE' | 'SENT'>('IDLE');
  const [otpCode, setOtpCode] = useState('');
  const [otpTimer, setOtpTimer] = useState(120);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpSuccessMsg, setOtpSuccessMsg] = useState<string | null>(null);
  const [otpErrorMsg, setOtpErrorMsg] = useState<string | null>(null);

  // Submission
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isPhoneVerified = Boolean(
    user?.isPhoneVerified && user?.phone && phone && normalizePhoneNumber(phone) === normalizePhoneNumber(user.phone)
  );

  // ---------- Mount: draft, plans, payment options ----------
  useEffect(() => {
    setMounted(true);
    try {
      const raw = sessionStorage.getItem(CHECKOUT_DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as Record<string, unknown>;
        const s = (k: string) => (typeof draft[k] === 'string' ? (draft[k] as string) : '');
        if (s('recipientName')) setRecipientName(s('recipientName'));
        if (s('phone')) setPhone(s('phone'));
        if (s('province')) setProvince(s('province'));
        if (s('city')) setCity(s('city'));
        if (s('streetAddress')) setStreetAddress(s('streetAddress'));
        if (s('unit')) setUnit(s('unit'));
        if (s('postalCode')) setPostalCode(s('postalCode'));
        draftRestoredRef.current = true;
      }
    } catch {
      // unreadable draft: start empty
    }

    fetch('/api/subscriptions', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.plans) setPlans(data.plans);
      })
      .catch(() => {});

    fetch('/api/payment-options', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.gateways) setPaymentOpts(data as PaymentOptions);
      })
      .catch(() => {});
  }, []);

  // Non-sensitive draft only (no OTP, no secrets), so a login redirect does not lose the form.
  useEffect(() => {
    if (!mounted) return;
    try {
      sessionStorage.setItem(
        CHECKOUT_DRAFT_KEY,
        JSON.stringify({ recipientName, phone, province, city, streetAddress, unit, postalCode })
      );
    } catch {
      // storage unavailable
    }
  }, [mounted, recipientName, phone, province, city, streetAddress, unit, postalCode]);

  // ---------- Saved addresses (account address book) ----------
  useEffect(() => {
    if (!mounted || !isAuthenticated) {
      setSavedAddresses([]);
      return;
    }
    let cancelled = false;
    fetch('/api/account/addresses', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.addresses) return;
        const list: Address[] = data.addresses;
        setSavedAddresses(list);
        const def = list.find((a) => a.isDefault) || list[0];
        if (def && !draftRestoredRef.current) {
          applyAddress(def);
        }
        if (user && !draftRestoredRef.current) {
          setRecipientName((prev) => prev || user.name || '');
          setPhone((prev) => prev || user.phone || '');
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, isAuthenticated, user?.id]);

  function applyAddress(a: Address) {
    setSelectedAddressId(a.id);
    setRecipientName(a.recipientName || '');
    setPhone(a.phone || '');
    setProvince(a.province || 'فارس');
    setCity(a.city || 'شیراز');
    setStreetAddress(a.streetAddress || '');
    setUnit(a.unit || '');
    setPostalCode(a.postalCode || '');
    setFieldErrors({});
  }

  // ---------- Delivery slots from the server (tier aware, capacity aware) ----------
  useEffect(() => {
    if (!mounted || isSubscription) return;
    let cancelled = false;
    setSlotsError(null);
    fetch('/api/delivery-slots?days=14', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (!data?.success) throw new Error(data?.message || 'خطا در دریافت سانس‌های تحویل');
        setSlotsTier(data.tier || 'FREE');
        setSlots((data.slots as ApiSlot[]).map(toSlotOption));
      })
      .catch((err: Error) => {
        if (!cancelled) setSlotsError(err.message || 'خطا در دریافت سانس‌های تحویل');
      });
    return () => {
      cancelled = true;
    };
  }, [mounted, isSubscription, user?.id]);

  // Keep a valid slot selected: the first one the customer may book when the current choice is gone.
  useEffect(() => {
    if (isSubscription) return;
    const current = slots.find((s) => s.id === slotId);
    if (current && current.isAvailable && current.isAllowedForTier) return;
    const first = slots.find((s) => s.isAvailable && s.isAllowedForTier);
    setSlotId(first?.id ?? null);
  }, [slots, slotId, isSubscription]);

  // ---------- Quote: the only source of amounts on this page ----------
  // The city is priced only after a pause of CITY_QUOTE_DEBOUNCE_MS or when its field loses focus, not on every
  // keystroke. Until then submit stays disabled (cityQuotePending), so the total shown is never for another city.
  const [quotedCity, setQuotedCity] = useState<string>(() => city.trim());
  useEffect(() => {
    const timer = setTimeout(() => setQuotedCity(city.trim()), CITY_QUOTE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [city]);
  const cityQuotePending = city.trim() !== quotedCity;

  const quoteRequest: QuoteRequest | null = useMemo(() => {
    if (!mounted) return null;
    if (isSubscription) return { isSubscription: true, subscriptionPlan };
    if (lines.length === 0) return null;
    return {
      items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
      couponCode: appliedCouponCode,
      slotId,
      city: quotedCity ? quotedCity : undefined,
      province: province || undefined,
    };
  }, [mounted, isSubscription, subscriptionPlan, lines, appliedCouponCode, slotId, quotedCity, province]);

  const {
    quote,
    loading: quoteLoading,
    error: quoteError,
    rateLimitedSeconds,
  } = useQuote(quoteRequest);

  const plan = plans && (isSubscription ? plans[subscriptionPlan] : undefined);
  const totalCount = getTotalItemsCount();
  const amountDue = quote?.total ?? 0;

  // Which payment methods may be offered for this amount.
  const methodAvailable = (m: PaymentMethod): boolean => {
    if (!paymentOpts) return m === 'zarinpal';
    if (m === 'zarinpal') return paymentOpts.gateways.zarinpal.enabled;
    if (m === 'snapppay') {
      return paymentOpts.gateways.snapppay.enabled && amountDue >= paymentOpts.gateways.snapppay.minAmount;
    }
    return paymentOpts.gateways.cod.enabled && !isSubscription;
  };
  const effectiveMethod: PaymentMethod | null = methodAvailable(paymentMethod)
    ? paymentMethod
    : METHOD_ORDER.find((m) => methodAvailable(m)) ?? null;

  const isCityShiraz = quote ? quote.isShiraz : true;
  const isBulk = quote?.isBulk ?? false;

  // ---------- Phone OTP ----------
  useEffect(() => {
    if (otpStep !== 'SENT' || otpTimer <= 0) return;
    const t = setInterval(() => setOtpTimer((prev) => (prev <= 1 ? 0 : prev - 1)), 1000);
    return () => clearInterval(t);
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
        body: JSON.stringify({ action: 'send-checkout-phone', phone: normalizePhoneNumber(phone) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || 'خطا در ارسال کد تایید');
      setOtpStep('SENT');
      setOtpTimer(120);
      setOtpCode('');
      setOtpSuccessMsg('کد تایید ۶ رقمی ارسال شد. لطفاً آن را وارد فرمایید.');
    } catch (err: unknown) {
      setOtpErrorMsg(err instanceof Error ? err.message : 'خطا در برقراری ارتباط با سامانه پیامکی');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyCheckoutOtp = async () => {
    setOtpErrorMsg(null);
    setOtpSuccessMsg(null);
    const cleanCode = toEnglishDigits(otpCode).replace(/\D/g, '');
    if (cleanCode.length !== OTP_LENGTH) {
      setOtpErrorMsg('لطفاً کد تایید ۶ رقمی را به صورت کامل وارد فرمایید.');
      return;
    }
    setIsVerifyingOtp(true);
    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify-checkout-phone',
          phone: normalizePhoneNumber(phone),
          code: cleanCode,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || 'کد تایید نادرست یا منقضی شده است.');
      setOtpStep('IDLE');
      setOtpSuccessMsg('شماره تلفن همراه با موفقیت تایید و برای حساب کاربری شما ثبت گردید.');
      await refreshProfile();
    } catch (err: unknown) {
      setOtpErrorMsg(err instanceof Error ? err.message : 'کد تایید نامعتبر است');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const renderPhoneField = (labelTitle: string) => (
    <div className="space-y-2 sm:col-span-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label htmlFor="checkout-phone" className="block text-gray-700 font-semibold text-xs">
          {labelTitle}
        </label>
        {isPhoneVerified ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
            شماره تایید شده است
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-bold border border-amber-300">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
            نیاز به تایید با کد پیامکی
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <input
          id="checkout-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          aria-invalid={Boolean(fieldErrors.phone)}
          aria-describedby={fieldErrors.phone ? 'checkout-phone-error' : undefined}
          placeholder="۰۹۱۷۱۲۳۴۵۶۷"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setFieldErrors((prev) => ({ ...prev, phone: '' }));
            setOtpStep('IDLE');
          }}
          className={`w-full min-h-11 px-3.5 py-2.5 rounded-xl border ${
            fieldErrors.phone
              ? 'border-rose-400 bg-rose-50/30'
              : isPhoneVerified
              ? 'border-emerald-400 bg-emerald-50/20'
              : 'border-farm-border bg-farm-bg'
          } focus:bg-white focus:outline-none focus:border-farm-primary text-left font-mono font-bold text-base sm:text-sm transition-all`}
          dir="ltr"
        />
        {!isPhoneVerified && (
          <button
            type="button"
            onClick={handleSendCheckoutOtp}
            disabled={isSendingOtp || !isValidIranPhone(phone) || !isAuthenticated}
            className="shrink-0 min-h-11 px-3.5 py-2.5 bg-farm-primary hover:bg-farm-primary-dark disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
          >
            {isSendingOtp ? 'در حال ارسال...' : otpStep === 'SENT' ? 'ارسال مجدد' : 'دریافت کد تایید'}
          </button>
        )}
      </div>

      {!isAuthenticated && (
        <p className="text-xs text-gray-600">برای تایید شماره همراه ابتدا وارد حساب کاربری شوید.</p>
      )}

      {fieldErrors.phone && (
        <p id="checkout-phone-error" className="text-xs text-rose-700 font-bold">
          {fieldErrors.phone}
        </p>
      )}

      {!isPhoneVerified && otpStep === 'SENT' && (
        <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-300/80 space-y-3">
          <div className="flex items-center justify-between text-xs gap-2">
            <label htmlFor="checkout-otp-input" className="font-bold text-amber-950">
              کد تایید ۶ رقمی پیامک‌شده:
            </label>
            <span className="text-amber-800 font-mono text-xs">
              {otpTimer > 0 ? `اعتبار: ${toPersianDigits(otpTimer)} ثانیه` : 'کد منقضی شده؛ ارسال مجدد را بزنید'}
            </span>
          </div>
          <div className="flex gap-2">
            <input
              id="checkout-otp-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={OTP_LENGTH}
              placeholder="••••••"
              value={otpCode}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleVerifyCheckoutOtp();
                }
              }}
              onChange={(e) => setOtpCode(toEnglishDigits(e.target.value).replace(/\D/g, '').slice(0, OTP_LENGTH))}
              className="w-32 min-h-11 text-center tracking-[0.4em] px-3 py-2 rounded-xl border-2 border-amber-300 bg-white font-mono font-black text-lg text-farm-primary focus:outline-none focus:border-farm-primary"
              dir="ltr"
            />
            <button
              type="button"
              onClick={() => void handleVerifyCheckoutOtp()}
              disabled={isVerifyingOtp || toEnglishDigits(otpCode).replace(/\D/g, '').length !== OTP_LENGTH}
              className="flex-1 min-h-11 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
            >
              {isVerifyingOtp ? 'در حال بررسی...' : 'تایید و ثبت شماره در حساب'}
            </button>
          </div>
          {otpErrorMsg && (
            <p role="alert" className="text-xs text-rose-700 font-bold flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{otpErrorMsg}</span>
            </p>
          )}
        </div>
      )}
      {otpStep === 'IDLE' && otpSuccessMsg && (
        <p role="status" className="text-xs text-emerald-800 font-bold flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{otpSuccessMsg}</span>
        </p>
      )}
    </div>
  );

  // ---------- Error from the payment callback ----------
  useEffect(() => {
    const err = searchParams.get('error');
    if (err) setErrorMessage(VERIFY_ERROR_MESSAGES[err] || 'خطایی در فرآیند پرداخت رخ داده است. لطفاً مجدداً تلاش فرمایید.');
  }, [searchParams]);

  // ---------- Submit ----------
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setFieldErrors({});

    const redirectTarget = isSubscription ? `/checkout?subscriptionPlan=${subscriptionPlan}` : '/checkout';
    if (!isAuthenticated || !user) {
      setErrorMessage('جهت تکمیل سفارش و اتصال به درگاه، لطفاً ابتدا وارد حساب کاربری شوید. اطلاعات فرم شما محفوظ می‌ماند.');
      router.push(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
      return;
    }

    if (!isSubscription && lines.length === 0) {
      setErrorMessage('سبد خرید شما خالی است.');
      return;
    }

    const errs: Record<string, string> = {};
    if (!recipientName.trim()) errs.recipientName = 'لطفاً نام و نام‌خانوادگی تحویل‌گیرنده را وارد نمایید.';
    if (!isValidIranPhone(phone)) errs.phone = 'شماره موبایل معتبر ۱۱ رقمی وارد نمایید (مانند ۰۹۱۷۱۲۳۴۵۶۷).';
    else if (!isPhoneVerified) errs.phone = 'تایید شماره همراه با کد پیامکی الزامی است.';
    if (!isSubscription) {
      if (!city.trim()) errs.city = 'لطفاً شهر مقصد را وارد نمایید.';
      if (!streetAddress.trim()) errs.streetAddress = 'لطفاً نشانی دقیق خیابان و کوچه را وارد نمایید.';
      if (!/^\d{10}$/.test(toEnglishDigits(postalCode).replace(/\s/g, ''))) {
        errs.postalCode = 'کد پستی باید ۱۰ رقم باشد.';
      }
      if (!slotId) errs.slot = 'لطفاً یک بازه زمانی معتبر برای تحویل انتخاب کنید.';
    }
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setErrorMessage(Object.values(errs)[0]);
      return;
    }

    if (!quote) {
      setErrorMessage('مبلغ سفارش هنوز محاسبه نشده است. لحظه‌ای صبر کنید.');
      return;
    }
    if (!quote.ok) {
      setErrorMessage(quote.errors[0] || 'سفارش قابل ثبت نیست.');
      return;
    }
    if (!effectiveMethod) {
      setErrorMessage('در حال حاضر هیچ درگاه پرداختی برای این سفارش فعال نیست.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientName: recipientName.trim(),
          phone: normalizePhoneNumber(phone),
          province: province || 'فارس',
          city: isSubscription ? 'شیراز' : city.trim(),
          streetAddress: isSubscription ? 'فعال‌سازی سرویس اشتراک آنلاین پروفارم' : streetAddress.trim(),
          unit: isSubscription ? '' : unit.trim(),
          postalCode: isSubscription ? '' : toEnglishDigits(postalCode),
          deliverySlot: isSubscription ? null : slotId,
          isSubscription,
          subscriptionPlan: isSubscription ? subscriptionPlan : undefined,
          items: isSubscription ? [] : lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
          appliedCouponCode: isSubscription ? null : appliedCouponCode,
          paymentMethod: effectiveMethod,
        }),
      });
      const data = await res.json().catch(() => null);

      if (res.status === 401) {
        router.push(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
        return;
      }
      if (!res.ok || !data?.success) {
        if (data?.errorCode === 'INSUFFICIENT_STOCK') void refreshCatalog();
        const first = Array.isArray(data?.errors) ? data.errors[0] : undefined;
        throw new Error(data?.message || first || 'خطا در ثبت سفارش');
      }

      if (data.gateway === 'cod') {
        clearCart();
        router.push(`/checkout/success?orderNumber=${encodeURIComponent(data.order.orderNumber)}&gateway=cod`);
        return;
      }
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }
      throw new Error('آدرس درگاه پرداخت از سرور دریافت نشد. لطفاً دوباره تلاش فرمایید.');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'خطا در اتصال به درگاه پرداخت');
      setIsLoading(false);
    }
  };

  if (!mounted) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 rounded-full border-2 border-farm-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isSubscription && lines.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-farm-bg-warm border border-farm-border flex items-center justify-center mx-auto text-farm-primary">
          <ShoppingBag className="w-9 h-9 text-gray-500" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-black text-farm-primary">سبد خرید شما خالی است</h1>
        <p className="text-sm text-gray-600">برای تسویه‌حساب ابتدا کالایی به سبد خرید اضافه کنید.</p>
        <Link href="/products" className="inline-flex px-6 py-3.5 rounded-2xl bg-farm-primary text-white text-sm font-bold">
          مشاهده محصولات
        </Link>
      </div>
    );
  }

  const shippingCharged = quote?.shipping ?? 0;
  const itemsSubtotal = quote?.subtotal ?? 0;
  const couponDiscount = quote?.couponDiscount ?? 0;
  const shippingDiscount = quote?.shippingDiscount ?? 0;
  const totalSavings = (quote?.tierDiscount ?? 0) + shippingDiscount + couponDiscount;
  // While the city is still being typed, or the server rate limits quotes, the shown total may be stale.
  const quoteStale = cityQuotePending || rateLimitedSeconds !== null;
  const isSubmitDisabled =
    isLoading ||
    quoteLoading ||
    quoteStale ||
    !quote ||
    !quote.ok ||
    !effectiveMethod ||
    (!isSubscription && !slotId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="pb-4 border-b border-farm-border">
        {isSubscription && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-2 rounded-full text-xs font-bold bg-[#D4AF37]/15 text-[#996515] border border-[#D4AF37]/30">
            <Crown className="w-3.5 h-3.5 text-[#D4AF37]" aria-hidden="true" />
            <span>اشتراک ویژه باشگاه مشتریان پروفارم</span>
          </div>
        )}
        <h1 className="text-2xl sm:text-3xl font-black text-farm-primary">
          {isSubscription
            ? `تسویه‌حساب و فعال‌سازی ${subscriptionPlan === 'PLUS' ? 'اشتراک نقره‌ای پلاس' : 'اشتراک طلایی پرو'}`
            : 'تسویه‌حساب و زمان‌بندی تحویل سفارش'}
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          {isSubscription
            ? 'عضویت ۳۰ روزه؛ مبلغ و شرایط از تنظیمات رسمی باشگاه محاسبه می‌شود.'
            : 'مشخصات نشانی شیراز و انتخاب زمان مناسب برای تحویل با پیک پروفارم'}
        </p>
      </div>

      {!isAuthenticated && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
              <AlertTriangle className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">حساب کاربری فعال یافت نشد</p>
              <p className="text-xs text-amber-700 mt-0.5">
                برای نهایی‌سازی سفارش و پیگیری تحویل، لطفاً ابتدا وارد حساب خود شوید. اطلاعات فرم شما ذخیره می‌ماند.
              </p>
            </div>
          </div>
          <Link
            href={`/login?redirect=${encodeURIComponent(
              isSubscription ? `/checkout?subscriptionPlan=${subscriptionPlan}` : '/checkout'
            )}`}
            className="w-full sm:w-auto text-center min-h-11 inline-flex items-center justify-center px-5 py-2.5 bg-farm-primary text-white text-xs font-bold rounded-xl hover:bg-farm-primary-dark transition-colors shadow-sm"
          >
            ورود به حساب کاربری
          </Link>
        </div>
      )}

      <form onSubmit={handleSubmitOrder} noValidate>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Steps Column */}
          <div className="lg:col-span-8 space-y-6">
            {isSubscription ? (
              <div className="bg-white rounded-3xl p-6 border border-farm-border shadow-farm space-y-5">
                <div className="flex items-center gap-3 pb-3 border-b border-farm-bg-warm">
                  <div className="w-10 h-10 rounded-2xl bg-farm-primary/10 flex items-center justify-center text-farm-primary">
                    <Crown className="w-5 h-5 text-[#D4AF37]" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-farm-primary">۱. مشخصات دارنده اشتراک و فعال‌سازی</h2>
                    <p className="text-xs text-gray-500">
                      اشتراک روی حساب کاربری و شماره موبایل زیر فعال می‌شود و نیازی به انتخاب بازه ارسال نیست.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label htmlFor="sub-recipient" className="block text-gray-700 font-semibold mb-1.5">
                      نام و نام‌خانوادگی مشترک:
                    </label>
                    <input
                      id="sub-recipient"
                      type="text"
                      autoComplete="name"
                      required
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="w-full min-h-11 px-3.5 py-2.5 rounded-xl border border-farm-border bg-farm-bg focus:bg-white focus:outline-none focus:border-farm-primary text-base sm:text-sm"
                    />
                    {fieldErrors.recipientName && (
                      <p className="text-xs text-rose-700 font-bold mt-1">{fieldErrors.recipientName}</p>
                    )}
                  </div>
                  {renderPhoneField('شماره تلفن همراه (پیامک تایید اشتراک):')}
                </div>
                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                  <span>پس از پرداخت بانکی، اشتراک حساب شما فعال می‌شود و تحویل روزهای منتخب در سفارش‌های بعدی اعمال می‌گردد.</span>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-6 border border-farm-border shadow-farm space-y-5">
                <div className="flex items-center gap-3 pb-3 border-b border-farm-bg-warm">
                  <div className="w-10 h-10 rounded-2xl bg-farm-primary/10 flex items-center justify-center text-farm-primary">
                    <MapPin className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-farm-primary">۱. آدرس تحویل</h2>
                    <p className="text-xs text-gray-500">خرده‌فروشی مختص شیراز است؛ سایر شهرها فقط با سفارش عمده ممکن است.</p>
                  </div>
                </div>

                {savedAddresses.length > 0 && (
                  <div>
                    <label htmlFor="saved-address" className="block text-gray-700 font-semibold text-xs mb-1.5">
                      انتخاب از نشانی‌های ذخیره‌شده:
                    </label>
                    <select
                      id="saved-address"
                      value={selectedAddressId}
                      onChange={(e) => {
                        const next = savedAddresses.find((a) => a.id === e.target.value);
                        if (next) applyAddress(next);
                        else setSelectedAddressId('');
                      }}
                      className="w-full min-h-11 px-3.5 py-2.5 rounded-xl border border-farm-border bg-farm-bg text-base sm:text-sm focus:bg-white focus:outline-none focus:border-farm-primary"
                    >
                      <option value="">نشانی جدید</option>
                      {savedAddresses.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.city}، {a.streetAddress}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label htmlFor="checkout-recipient" className="block text-gray-700 font-semibold mb-1.5">
                      نام و نام‌خانوادگی تحویل‌گیرنده:
                    </label>
                    <input
                      id="checkout-recipient"
                      type="text"
                      autoComplete="name"
                      required
                      aria-invalid={Boolean(fieldErrors.recipientName)}
                      aria-describedby={fieldErrors.recipientName ? 'checkout-recipient-error' : undefined}
                      value={recipientName}
                      onChange={(e) => {
                        setRecipientName(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, recipientName: '' }));
                      }}
                      className={`w-full min-h-11 px-3.5 py-2.5 rounded-xl border text-base sm:text-sm ${
                        fieldErrors.recipientName ? 'border-rose-400 bg-rose-50/30' : 'border-farm-border bg-farm-bg'
                      } focus:bg-white focus:outline-none focus:border-farm-primary`}
                    />
                    {fieldErrors.recipientName && (
                      <p id="checkout-recipient-error" className="text-xs text-rose-700 font-bold mt-1">
                        {fieldErrors.recipientName}
                      </p>
                    )}
                  </div>

                  {renderPhoneField('شماره تلفن همراه (پیامک وضعیت و هماهنگی تحویل):')}

                  <div>
                    <label htmlFor="checkout-province" className="block text-gray-700 font-semibold mb-1.5">
                      استان مقصد:
                    </label>
                    <select
                      id="checkout-province"
                      autoComplete="address-level1"
                      value={province}
                      onChange={(e) => {
                        const nextProv = e.target.value;
                        setProvince(nextProv);
                        if (nextProv === 'فارس' && !city.trim()) setCity('شیراز');
                        else if (nextProv !== 'فارس' && city.trim() === 'شیراز') setCity('');
                      }}
                      className="w-full min-h-11 px-3.5 py-2.5 rounded-xl border border-farm-border bg-farm-bg text-base sm:text-sm focus:bg-white focus:outline-none focus:border-farm-primary"
                    >
                      {IRAN_PROVINCES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="checkout-city" className="block text-gray-700 font-semibold mb-1.5">
                      شهر مقصد:
                    </label>
                    <input
                      id="checkout-city"
                      type="text"
                      autoComplete="address-level2"
                      required
                      aria-invalid={Boolean(fieldErrors.city)}
                      aria-describedby={fieldErrors.city ? 'checkout-city-error' : undefined}
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, city: '' }));
                      }}
                      onBlur={() => setQuotedCity(city.trim())}
                      placeholder={province === 'فارس' ? 'شیراز' : 'نام شهر مقصد (سفارش عمده)'}
                      className={`w-full min-h-11 px-3.5 py-2.5 rounded-xl border text-base sm:text-sm ${
                        fieldErrors.city ? 'border-rose-400 bg-rose-50/30' : 'border-farm-border bg-farm-bg'
                      } focus:bg-white focus:outline-none focus:border-farm-primary`}
                    />
                    {fieldErrors.city && (
                      <p id="checkout-city-error" className="text-xs text-rose-700 font-bold mt-1">
                        {fieldErrors.city}
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="checkout-street" className="block text-gray-700 font-semibold mb-1.5">
                      نشانی دقیق خیابان و کوچه:
                    </label>
                    <input
                      id="checkout-street"
                      type="text"
                      autoComplete="street-address"
                      required
                      aria-invalid={Boolean(fieldErrors.streetAddress)}
                      aria-describedby={fieldErrors.streetAddress ? 'checkout-street-error' : undefined}
                      value={streetAddress}
                      onChange={(e) => {
                        setStreetAddress(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, streetAddress: '' }));
                      }}
                      placeholder="مثال: بلوار ارم، کوچه ۶، پلاک ۱۲"
                      className={`w-full min-h-11 px-3.5 py-2.5 rounded-xl border text-base sm:text-sm ${
                        fieldErrors.streetAddress ? 'border-rose-400 bg-rose-50/30' : 'border-farm-border bg-farm-bg'
                      } focus:bg-white focus:outline-none focus:border-farm-primary`}
                    />
                    {fieldErrors.streetAddress && (
                      <p id="checkout-street-error" className="text-xs text-rose-700 font-bold mt-1">
                        {fieldErrors.streetAddress}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="checkout-unit" className="block text-gray-700 font-semibold mb-1.5">
                      پلاک / واحد:
                    </label>
                    <input
                      id="checkout-unit"
                      type="text"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full min-h-11 px-3.5 py-2.5 rounded-xl border border-farm-border bg-farm-bg text-base sm:text-sm focus:bg-white focus:outline-none focus:border-farm-primary"
                    />
                  </div>

                  <div>
                    <label htmlFor="checkout-postal" className="block text-gray-700 font-semibold mb-1.5">
                      کد پستی ۱۰ رقمی:
                    </label>
                    <input
                      id="checkout-postal"
                      type="text"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      maxLength={10}
                      required
                      aria-invalid={Boolean(fieldErrors.postalCode)}
                      aria-describedby={fieldErrors.postalCode ? 'checkout-postal-error' : undefined}
                      value={postalCode}
                      onChange={(e) => {
                        setPostalCode(toEnglishDigits(e.target.value).replace(/\D/g, '').slice(0, 10));
                        setFieldErrors((prev) => ({ ...prev, postalCode: '' }));
                      }}
                      className={`w-full min-h-11 px-3.5 py-2.5 rounded-xl border text-base sm:text-sm ${
                        fieldErrors.postalCode ? 'border-rose-400 bg-rose-50/30' : 'border-farm-border bg-farm-bg'
                      } focus:bg-white focus:outline-none focus:border-farm-primary text-left font-mono`}
                      dir="ltr"
                    />
                    {fieldErrors.postalCode && (
                      <p id="checkout-postal-error" className="text-xs text-rose-700 font-bold mt-1">
                        {fieldErrors.postalCode}
                      </p>
                    )}
                  </div>
                </div>

                <ShirazGuardAlert
                  city={city}
                  province={province}
                  isBulkOrder={isBulk}
                  totalItemsCount={totalCount}
                  totalPrice={itemsSubtotal}
                />
              </div>
            )}

            {/* Delivery slots (product orders only) */}
            {!isSubscription && (
              <div className="space-y-3">
                {slotsError && (
                  <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                    {slotsError}
                  </div>
                )}
                {!slotsError && slots.length === 0 && (
                  <div className="p-4 rounded-2xl bg-white border border-farm-border text-xs text-gray-600">
                    در حال دریافت سانس‌های تحویل...
                  </div>
                )}
                {slots.length > 0 && (
                  <DeliverySlotPicker
                    slots={slots}
                    selectedSlotId={slotId}
                    onSelectSlot={(slot) => {
                      setSlotId(slot.id);
                      setFieldErrors((prev) => ({ ...prev, slot: '' }));
                    }}
                    isMember={slotsTier === 'PRO' || slotsTier === 'PLUS'}
                  />
                )}
                {fieldErrors.slot && <p className="text-xs text-rose-700 font-bold">{fieldErrors.slot}</p>}
              </div>
            )}

            {/* Subscription benefits (numbers from the subscription settings) */}
            {isSubscription && plan && (
              <div className="bg-gradient-to-br from-farm-primary/5 via-farm-primary/10 to-transparent rounded-3xl p-6 border border-farm-primary/20 shadow-farm space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-farm-border">
                  <div className="w-10 h-10 rounded-2xl bg-farm-primary text-white flex items-center justify-center shadow-sm">
                    {subscriptionPlan === 'PLUS' ? (
                      <Zap className="w-5 h-5 text-emerald-400" aria-hidden="true" />
                    ) : (
                      <Crown className="w-5 h-5 text-[#D4AF37]" aria-hidden="true" />
                    )}
                  </div>
                  <h2 className="text-base font-bold text-farm-primary">
                    مزایای {subscriptionPlan === 'PLUS' ? 'اشتراک پلاس' : 'اشتراک پرو'}
                  </h2>
                </div>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <li className="flex items-start gap-2 bg-white/90 p-3 rounded-2xl border border-emerald-100">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>تحویل {toPersianDigits(plan.deliveryDaysPerWeek)} روز در هفته</span>
                  </li>
                  <li className="flex items-start gap-2 bg-white/90 p-3 rounded-2xl border border-emerald-100">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>
                      {toPersianDigits(plan.eggDiscountPercent)}٪ تخفیف تخم‌مرغ تا {toPersianDigits(plan.eggQuota)} عدد در ماه
                    </span>
                  </li>
                </ul>
              </div>
            )}

            {/* Payment method */}
            <div className="bg-white rounded-3xl p-6 border border-farm-border shadow-farm space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-farm-bg-warm">
                <div className="w-10 h-10 rounded-2xl bg-farm-primary/10 flex items-center justify-center text-farm-primary">
                  <CreditCard className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-farm-primary">
                    {isSubscription ? '۲. شیوه پرداخت اشتراک' : '۲. شیوه پرداخت'}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">گزینه‌های نمایش‌داده‌شده از تنظیمات فعلی فروشگاه می‌آیند.</p>
                </div>
              </div>

              <div role="radiogroup" aria-label="انتخاب شیوه پرداخت" className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                {methodAvailable('zarinpal') && (
                  <PaymentOption
                    selected={effectiveMethod === 'zarinpal'}
                    onSelect={() => setPaymentMethod('zarinpal')}
                    title="درگاه پرداخت زرین‌پال"
                    subtitle="پرداخت امن شاپرک با کلیه کارت‌ها"
                    icon={<CreditCard className="w-4 h-4" aria-hidden="true" />}
                    amountLabel="مبلغ پرداخت نقدی"
                    amount={formatToman(amountDue)}
                  />
                )}
                {paymentOpts?.gateways.snapppay.enabled && (
                  <PaymentOption
                    selected={effectiveMethod === 'snapppay'}
                    disabled={!methodAvailable('snapppay')}
                    onSelect={() => setPaymentMethod('snapppay')}
                    title="خرید اقساطی اسنپ‌پی"
                    subtitle={
                      methodAvailable('snapppay')
                        ? 'پرداخت در ۴ قسط بدون ضامن'
                        : `حداقل مبلغ خرید اقساطی ${formatToman(paymentOpts.gateways.snapppay.minAmount)} است`
                    }
                    icon={<Wallet className="w-4 h-4" aria-hidden="true" />}
                    amountLabel="قسط اول (امروز)"
                    amount={formatToman(Math.ceil(amountDue / 4))}
                  />
                )}
                {methodAvailable('cod') && (
                  <PaymentOption
                    selected={effectiveMethod === 'cod'}
                    onSelect={() => setPaymentMethod('cod')}
                    title="پرداخت در محل"
                    subtitle="پرداخت نقدی یا کارتخوان هنگام تحویل"
                    icon={<Banknote className="w-4 h-4" aria-hidden="true" />}
                    amountLabel="مبلغ قابل پرداخت هنگام تحویل"
                    amount={formatToman(amountDue)}
                  />
                )}
              </div>

              {paymentOpts?.guideMessage && (
                <div className="p-3 rounded-2xl bg-[#F8F7F4] border border-farm-border text-xs text-gray-700 flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
                  <span className="font-medium">{paymentOpts.guideMessage}</span>
                </div>
              )}
            </div>
          </div>

          {/* Summary column */}
          <div className="lg:col-span-4 space-y-5">
            {!isSubscription && <CouponInputBox slotId={slotId} city={city.trim() || undefined} province={province} appliedDiscount={quote?.couponDiscount} />}

            <div className="bg-white rounded-3xl p-6 border border-farm-border shadow-farm space-y-5 lg:sticky lg:top-28">
              <div className="flex items-center gap-2.5 pb-3 border-b border-farm-bg-warm">
                <CreditCard className="w-5 h-5 text-farm-primary" aria-hidden="true" />
                <h2 className="text-base font-bold text-farm-primary">{isSubscription ? 'پیش‌فاکتور اشتراک' : 'پیش‌فاکتور نهایی'}</h2>
              </div>

              {quoteError && (
                <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  {quoteError}
                </div>
              )}

              {rateLimitedSeconds !== null && (
                <div role="status" className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                  بروزرسانی مبلغ کمی کند شده است. مبلغ قبلی نمایش داده می‌شود و حدود {toPersianDigits(rateLimitedSeconds)} ثانیه دیگر
                  دوباره محاسبه می‌شود. ثبت سفارش تا آن زمان فعال نمی‌شود.
                </div>
              )}

              {quote && quote.errors.length > 0 && (
                <ul role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1.5 list-disc pr-4">
                  {quote.errors.map((msg) => (
                    <li key={msg}>{msg}</li>
                  ))}
                </ul>
              )}

              <div className="space-y-3 text-xs text-gray-600">
                {isSubscription ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span>نوع اشتراک:</span>
                      <span className="font-bold text-farm-primary">
                        {subscriptionPlan === 'PLUS' ? 'اشتراک نقره‌ای پلاس' : 'اشتراک طلایی پرو'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>مدت اعتبار:</span>
                      <span className="font-bold text-farm-primary">۳۰ روز کامل</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>هزینه اشتراک ماهانه:</span>
                      <span className="font-bold text-farm-primary">{formatToman(quote?.subtotal ?? plan?.monthlyPrice ?? 0)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span>تعداد بسته‌ها:</span>
                      <span className="font-bold text-farm-primary">{toPersianDigits(totalCount)} بسته</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>ارزش اقلام:</span>
                      <span className="font-bold text-farm-primary">{formatToman(itemsSubtotal)}</span>
                    </div>
                    {quote && quote.eggDiscount > 0 && (
                      <div className="flex items-center justify-between text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200">
                        <span className="flex items-center gap-1">
                          <Tag className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                          <span>تخفیف تخم‌مرغ:</span>
                        </span>
                        <span className="font-bold">- {formatToman(quote.eggDiscount)}</span>
                      </div>
                    )}
                    {quote && quote.otherDiscount > 0 && (
                      <div className="flex items-center justify-between text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200">
                        <span className="flex items-center gap-1">
                          <Tag className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                          <span>تخفیف سایر کالاها (پرو):</span>
                        </span>
                        <span className="font-bold">- {formatToman(quote.otherDiscount)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <span>{isCityShiraz ? 'هزینه ارسال با پیک پروفارم:' : 'ارسال خارج از شیراز (عمده):'}</span>
                        {shippingDiscount > 0 && <span className="text-xs text-amber-700 font-bold">(۲۰٪ تخفیف پرو)</span>}
                      </span>
                      <span className="font-bold text-farm-primary">{formatToman(shippingCharged)}</span>
                    </div>
                  </>
                )}

                {couponDiscount > 0 && (
                  <div className="flex items-center justify-between text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200">
                    <span className="flex items-center gap-1">
                      <TicketPercent className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                      <span>کد تخفیف ({quote?.couponCode}):</span>
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

                {!isSubscription && slotId && slots.find((s) => s.id === slotId) && (
                  <div className="p-3 rounded-2xl bg-farm-bg border border-farm-border space-y-1">
                    <span className="block font-bold text-farm-primary">زمان تحویل انتخابی:</span>
                    <div className="text-xs text-gray-700">
                      {slots.find((s) => s.id === slotId)?.dateStr} | {SLOT_TIME_LABEL}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-farm-bg-warm flex items-baseline justify-between">
                <span className="text-sm font-bold text-gray-800">مبلغ پرداخت:</span>
                <span className="text-xl font-black text-farm-primary" aria-live="polite">
                  {quote ? formatToman(amountDue) : quoteLoading ? '...' : '—'}
                </span>
              </div>

              {errorMessage && (
                <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={isSubmitDisabled}
                isLoading={isLoading}
                className="w-full min-h-11"
              >
                {!quote || !quote.ok
                  ? 'ثبت سفارش ممکن نیست'
                  : effectiveMethod === 'cod'
                  ? 'ثبت سفارش با پرداخت در محل'
                  : effectiveMethod === 'snapppay'
                  ? `پرداخت قسط اول اسنپ‌پی (${formatToman(Math.ceil(amountDue / 4))})`
                  : isSubscription
                  ? `پرداخت و فعال‌سازی اشتراک (${formatToman(amountDue)})`
                  : 'پرداخت امن با درگاه زرین‌پال'}
              </Button>

              <div className="flex items-center justify-center gap-2 text-xs text-gray-600 pt-1 text-center">
                <ShieldCheck className="w-4 h-4 text-farm-primary shrink-0" aria-hidden="true" />
                <span>{isSubscription ? SITE_CONFIG.policies.subscriptionRefundLabel : SITE_CONFIG.policies.freshReturnLabel}</span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function PaymentOption(props: {
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  amountLabel: string;
  amount: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={props.selected}
      disabled={props.disabled}
      onClick={props.onSelect}
      className={`min-h-11 p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 text-right disabled:opacity-50 disabled:cursor-not-allowed ${
        props.selected ? 'border-farm-primary bg-emerald-50/40 shadow-sm' : 'border-gray-200 hover:border-gray-300 bg-white'
      }`}
    >
      <div className="flex items-start justify-between w-full gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-farm-primary/10 text-farm-primary flex items-center justify-center shrink-0">
            {props.icon}
          </div>
          <div>
            <div className="font-bold text-sm text-gray-900">{props.title}</div>
            <span className="text-xs text-gray-600">{props.subtitle}</span>
          </div>
        </div>
        <div
          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
            props.selected ? 'border-farm-primary bg-farm-primary text-white' : 'border-gray-300'
          }`}
          aria-hidden="true"
        >
          {props.selected && <CheckCircle2 className="w-3.5 h-3.5" />}
        </div>
      </div>
      <div className="text-xs text-gray-700 bg-white p-2.5 rounded-xl border border-gray-100 flex items-center justify-between w-full gap-2">
        <span>{props.amountLabel}:</span>
        <span className="font-bold text-farm-primary">{props.amount}</span>
      </div>
    </button>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 py-16 flex items-center justify-center min-h-[50vh]">
          <div className="w-8 h-8 rounded-full border-2 border-farm-primary border-t-transparent animate-spin" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
