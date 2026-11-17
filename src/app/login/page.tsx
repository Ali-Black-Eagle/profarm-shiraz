'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import {
  Phone,
  KeyRound,
  ArrowLeft,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  RotateCcw,
  AlertCircle,
  Leaf,
  UserPlus,
  LogIn,
  User,
  Sparkles,
  ShieldCheck,
  Truck,
  Crown,
  Mail,
} from 'lucide-react';
import {
  isValidIranPhone,
  toPersianDigits,
  toEnglishDigits,
  normalizePhoneNumber,
  isValidEmail,
} from '@/lib/formatters';

type AuthMode = 'LOGIN' | 'REGISTER';
type MethodType = 'OTP' | 'PASSWORD';

function getSafeRedirectUrl(target: string | null): string {
  if (!target) return '/account';
  const clean = target.trim();
  // Open Redirect Defense: Allow only relative paths starting with single '/'
  if (
    clean.startsWith('/') &&
    !clean.startsWith('//') &&
    !clean.includes('\\') &&
    !clean.includes(':')
  ) {
    return clean;
  }
  return '/account';
}

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  // URL Parameters
  const redirectParam = searchParams.get('redirect');
  const modeParam = searchParams.get('mode');

  // Primary mode: 'LOGIN' (ورود) or 'REGISTER' (ساخت حساب کاربری)
  const [authMode, setAuthMode] = useState<AuthMode>(() =>
    modeParam === 'register' ? 'REGISTER' : 'LOGIN'
  );

  // Active Method: 'OTP' (پیامک) or 'PASSWORD' (کلمه عبور)
  const [activeMethod, setActiveMethod] = useState<MethodType>('OTP');
  const [otpStep, setOtpStep] = useState<'PHONE' | 'CODE'>('PHONE');

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '']);
  const [passwordIdentifier, setPasswordIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status feedback
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 120-second countdown timer for OTP
  const [timerSeconds, setTimerSeconds] = useState(120);
  const [canResend, setCanResend] = useState(false);

  // 5 input boxes refs
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Automatically switch to Password method if destination is password-oriented admin route
  useEffect(() => {
    if (redirectParam && redirectParam.startsWith('/admin')) {
      setActiveMethod('PASSWORD');
    }
  }, [redirectParam]);

  // Sync mode from URL query
  useEffect(() => {
    if (modeParam === 'register') {
      setAuthMode('REGISTER');
    } else if (modeParam === 'login') {
      setAuthMode('LOGIN');
    }
  }, [modeParam]);

  // Countdown timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeMethod === 'OTP' && otpStep === 'CODE' && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeMethod, otpStep, timerSeconds]);

  // Persian MM:SS formatter
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const str = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return toPersianDigits(str);
  };

  // Smart Post-Login Redirection (Role-Aware)
  const routeAfterSuccess = (user: any) => {
    login(user);
    setSuccessMessage(`خوش آمدید، ${user.name || 'کاربر گرامی'}! در حال ورود به حساب...`);

    setTimeout(() => {
      if (user.role === 'ADMIN') {
        if (
          redirectParam &&
          redirectParam.startsWith('/admin') &&
          !redirectParam.startsWith('//')
        ) {
          router.push(redirectParam);
        } else {
          router.push('/admin');
        }
      } else {
        if (!redirectParam || redirectParam.startsWith('/admin') || redirectParam.startsWith('//')) {
          router.push('/account');
        } else {
          router.push(getSafeRedirectUrl(redirectParam));
        }
      }
    }, 600);
  };

  // ----------------------------------------------------
  // 1. OTP REQUEST (Send SMS)
  // ----------------------------------------------------
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    if (authMode === 'REGISTER' && (!fullName.trim() || fullName.trim().length < 2)) {
      setErrorMessage('لطفاً نام و نام خانوادگی خود را کامل وارد فرمایید.');
      return;
    }

    if (!isValidIranPhone(phone)) {
      setErrorMessage('لطفاً شماره موبایل معتبر ۱۱ رقمی وارد نمایید (مانند ۰۹۱۷۱۲۳۴۵۶۷).');
      return;
    }

    setIsLoading(true);

    try {
      const normalizedPhone = normalizePhoneNumber(phone);
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', phone: normalizedPhone }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message || 'خطا در ارسال پیامک کد تایید');
      }

      setOtpStep('CODE');
      setTimerSeconds(120);
      setCanResend(false);
      setOtpDigits(['', '', '', '', '']);

      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 150);
    } catch (err: any) {
      setErrorMessage(err.message || 'خطا در ارتباط با سامانه پیامکی');
    } finally {
      setIsLoading(false);
    }
  };

  // ----------------------------------------------------
  // 2. OTP VERIFICATION (Supports Paste, SMS Autofill, and Persian/Arabic Digits)
  // ----------------------------------------------------
  const distributeOtpDigits = (startIndex: number, raw: string) => {
    const englishDigits = toEnglishDigits(raw).replace(/\D/g, '');
    if (!englishDigits) {
      const newDigits = [...otpDigits];
      newDigits[startIndex] = '';
      setOtpDigits(newDigits);
      return;
    }

    if (englishDigits.length > 1) {
      const digits = englishDigits.slice(0, 5).split('');
      const newArr = [...otpDigits];
      const baseIndex = digits.length === 5 ? 0 : startIndex;
      digits.forEach((d, i) => {
        if (baseIndex + i < 5) newArr[baseIndex + i] = d;
      });
      setOtpDigits(newArr);
      const nextIdx = Math.min(baseIndex + digits.length, 4);
      inputRefs.current[nextIdx]?.focus();

      const full = newArr.join('');
      if (full.length === 5 && !newArr.includes('')) {
        submitVerifyOtp(full);
      }
      return;
    }

    const singleDigit = englishDigits.slice(-1);
    const newDigits = [...otpDigits];
    newDigits[startIndex] = singleDigit;
    setOtpDigits(newDigits);

    if (singleDigit && startIndex < 4) {
      inputRefs.current[startIndex + 1]?.focus();
    }

    const fullCode = newDigits.join('');
    if (fullCode.length === 5 && !newDigits.includes('')) {
      submitVerifyOtp(fullCode);
    }
  };

  const handleOtpBoxChange = (index: number, val: string) => {
    distributeOtpDigits(index, val);
  };

  const handleOtpPaste = (index: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    distributeOtpDigits(index, pasted);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const submitVerifyOtp = async (code: string) => {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const normalizedPhone = normalizePhoneNumber(phone);
      const normalizedCode = toEnglishDigits(code).replace(/\D/g, '');
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          phone: normalizedPhone,
          code: normalizedCode,
          name: authMode === 'REGISTER' ? fullName.trim() : undefined,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        if (data.message?.includes('رمز عبور') || data.message?.includes('کلمه عبور')) {
          setActiveMethod('PASSWORD');
          setPasswordIdentifier(phone);
          throw new Error(data.message);
        }
        throw new Error(data.message || 'کد تایید وارد شده نادرست یا منقضی شده است');
      }

      routeAfterSuccess(data.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'کد تایید نامعتبر است');
      setIsLoading(false);
    }
  };

  const handleManualVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpDigits.join('');
    if (code.length !== 5) {
      setErrorMessage('لطفاً کد تایید ۵ رقمی را به طور کامل وارد نمایید.');
      return;
    }
    submitVerifyOtp(code);
  };

  // ----------------------------------------------------
  // 3. PASSWORD LOGIN
  // ----------------------------------------------------
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!passwordIdentifier.trim() || !password.trim()) {
      setErrorMessage('لطفاً شناسه کاربری و کلمه عبور را وارد فرمایید.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: passwordIdentifier, password }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message || 'شناسه کاربری یا کلمه عبور نادرست است.');
      }

      routeAfterSuccess(data.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'اطلاعات ورود نامعتبر است.');
      setIsLoading(false);
    }
  };

  // ----------------------------------------------------
  // 4. SIGN UP WITH PASSWORD (Email + Password)
  // ----------------------------------------------------
  const handlePasswordRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorMessage('لطفاً نام و نام خانوادگی خود را کامل وارد نمایید.');
      return;
    }

    if (!email.trim() || !isValidEmail(email)) {
      setErrorMessage('لطفاً یک آدرس ایمیل معتبر وارد فرمایید (مانند user@example.com).');
      return;
    }

    if (!password || password.length < 4) {
      setErrorMessage('کلمه عبور باید حداقل ۴ کاراکتر باشد.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fullName.trim(),
          email: email.trim().toLowerCase(),
          password: password.trim(),
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message || 'خطا در ثبت نام کاربر');
      }

      routeAfterSuccess(data.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'خطا در ساخت حساب کاربری');
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-[92vh] flex items-center justify-center p-4 py-12 overflow-hidden bg-[#F8F6F0]">
      {/* Static Ambient Organic Glows (Zero GPU Load) */}
      <div className="absolute top-1/4 -right-28 w-96 h-96 bg-emerald-600/10 rounded-full blur-[90px] pointer-events-none" />
      <div className="absolute bottom-1/4 -left-28 w-96 h-96 bg-[#D4AF37]/10 rounded-full blur-[90px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[#2C4A2E]/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Floating Interactive Decorative Badges (Desktop & Tablet) */}
      <div className="hidden lg:flex absolute top-20 right-12 xl:right-24 items-center gap-2.5 px-4 py-2 rounded-2xl bg-white/90 border border-[#E6E1D5] shadow-farm text-xs font-bold text-[#2C4A2E] pointer-events-none z-0">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
        <Leaf className="w-4 h-4 text-emerald-600" />
        <span>محصولات تازه مزارع فارس</span>
      </div>

      <div className="hidden lg:flex absolute bottom-24 left-12 xl:left-24 items-center gap-2.5 px-4 py-2 rounded-2xl bg-white/90 border border-amber-200/80 shadow-farm text-xs font-bold text-amber-900 pointer-events-none z-0">
        <Crown className="w-4 h-4 text-[#D4AF37]" />
        <span>باشگاه مشترکین ویژه پرو و پلاس</span>
      </div>

      {/* Main Solid Card (Flicker-Free, No Backdrop Filter Jitter) */}
      <div className="relative z-10 max-w-md w-full bg-white rounded-[32px] p-6 sm:p-8 border border-[#E6E1D5] shadow-[0_20px_50px_-12px_rgba(44,74,46,0.12)] space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="relative inline-block group">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2C4A2E] via-[#243c26] to-[#1E3520] text-white flex items-center justify-center mx-auto shadow-xl shadow-[#2C4A2E]/25 border border-emerald-500/30 transition-transform duration-300 group-hover:scale-105">
              <Leaf className="w-8 h-8 text-emerald-300 transition-transform duration-300 group-hover:rotate-12" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-r from-amber-500 to-[#D4AF37] text-white flex items-center justify-center text-[11px] shadow-md font-black">
              ✦
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-black text-[#2C4A2E] tracking-tight transition-opacity duration-200">
              {authMode === 'LOGIN' ? 'ورود به حساب کاربری' : 'ساخت حساب کاربری جدید'}
            </h1>
            <p className="text-xs text-gray-500 font-medium transition-opacity duration-200">
              {authMode === 'LOGIN'
                ? 'به فروشگاه محصولات ارگانیک مزارع شیراز خوش آمدید'
                : 'به جمع خانواده بزرگ مشتریان پروفارم شیراز بپیوندید'}
            </p>
          </div>
        </div>

        {/* Primary Mode Switcher: LOGIN vs REGISTER */}
        <div className="relative p-1 rounded-2xl bg-[#ECE7DC] border border-[#DFD8CA] shadow-inner grid grid-cols-2 text-xs font-bold select-none">
          {/* Animated Gliding Pill Background */}
          <div
            className="absolute top-1 bottom-1 right-1 w-[calc(50%-4px)] rounded-xl bg-gradient-to-r from-[#2C4A2E] via-[#243c26] to-[#1E3520] shadow-md transition-transform duration-200 ease-out pointer-events-none"
            style={{
              transform: authMode === 'LOGIN' ? 'translate3d(0, 0, 0)' : 'translate3d(-100%, 0, 0)',
            }}
          />

          {/* Tab 1: ورود به حساب */}
          <button
            type="button"
            onClick={() => {
              if (authMode !== 'LOGIN') {
                setAuthMode('LOGIN');
                setErrorMessage(null);
                setOtpStep('PHONE');
              }
            }}
            className={`relative z-10 py-2.5 px-3 rounded-xl transition-colors duration-150 flex items-center justify-center gap-2 cursor-pointer ${
              authMode === 'LOGIN'
                ? 'text-white font-black'
                : 'text-stone-600 hover:text-stone-900 font-bold'
            }`}
          >
            <LogIn
              className={`w-4 h-4 transition-colors duration-150 ${
                authMode === 'LOGIN' ? 'text-emerald-300' : ''
              }`}
            />
            <span>ورود به حساب</span>
          </button>

          {/* Tab 2: ساخت حساب کاربری */}
          <button
            type="button"
            onClick={() => {
              if (authMode !== 'REGISTER') {
                setAuthMode('REGISTER');
                setErrorMessage(null);
                setOtpStep('PHONE');
              }
            }}
            className={`relative z-10 py-2.5 px-3 rounded-xl transition-colors duration-150 flex items-center justify-center gap-2 cursor-pointer ${
              authMode === 'REGISTER'
                ? 'text-white font-black'
                : 'text-stone-600 hover:text-stone-900 font-bold'
            }`}
          >
            <UserPlus
              className={`w-4 h-4 transition-colors duration-150 ${
                authMode === 'REGISTER' ? 'text-[#D4AF37]' : ''
              }`}
            />
            <span>ساخت حساب کاربری</span>
          </button>
        </div>

        {/* Method Sub-Tabs (OTP vs PASSWORD) */}
        <div className="flex items-center justify-center gap-2 text-[11px] font-bold border-b border-gray-100 pb-2">
          <button
            type="button"
            onClick={() => {
              setActiveMethod('OTP');
              setErrorMessage(null);
              setOtpStep('PHONE');
            }}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeMethod === 'OTP'
                ? 'bg-emerald-50 text-emerald-800 font-black border border-emerald-200'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Phone className="w-3.5 h-3.5 text-emerald-600" />
            <span>با پیامک (کد یکبار مصرف)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMethod('PASSWORD');
              setErrorMessage(null);
            }}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeMethod === 'PASSWORD'
                ? 'bg-amber-50 text-amber-900 font-black border border-amber-200'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-600" />
            <span>با کلمه عبور</span>
          </button>
        </div>

        {/* Alerts */}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <span className="leading-relaxed font-medium">{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-900 flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span className="font-bold">{successMessage}</span>
          </div>
        )}

        {/* Smooth Container for Form Views */}
        <div className="space-y-5">
          {/* ==================================================== */}
          {/* METHOD 1: OTP FLOW (Sign In or Sign Up via SMS)     */}
          {/* ==================================================== */}
          {activeMethod === 'OTP' && (
            <div className="space-y-5">
            {otpStep === 'PHONE' ? (
              <form onSubmit={handleSendOtp} className="space-y-4 text-xs">
                {/* Full name input for registration mode */}
                {authMode === 'REGISTER' && (
                  <div>
                    <label className="block text-gray-700 font-bold mb-1.5">
                      نام و نام خانوادگی:
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="مانند: علی رضایی"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full pr-10 pl-4 py-3 rounded-2xl border border-[#E6E1D5] bg-[#FDFDFD] focus:bg-white focus:outline-none focus:border-[#2C4A2E] focus:ring-4 focus:ring-[#2C4A2E]/10 font-medium text-sm transition-colors"
                      />
                      <User className="w-4 h-4 text-gray-400 absolute right-3.5 top-3.5" />
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-gray-700 font-bold">شماره تلفن همراه:</label>
                    <span className="text-[11px] text-gray-400">کد ۵ رقمی ارسال می‌شود</span>
                  </div>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="۰۹۱۷۱۲۳۴۵۶۷"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-14 pr-4 py-3.5 rounded-2xl border border-[#E6E1D5] bg-[#FDFDFD] focus:bg-white focus:outline-none focus:border-[#2C4A2E] focus:ring-4 focus:ring-[#2C4A2E]/10 text-left font-mono font-bold text-sm tracking-wider transition-all"
                      dir="ltr"
                    />
                    <div className="absolute left-3 top-3 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100 border border-gray-200 text-[11px] font-mono text-gray-600 pointer-events-none">
                      <span>🇮🇷</span>
                      <span>+۹۸</span>
                    </div>
                  </div>
                </div>

                <Button type="submit" size="lg" isLoading={isLoading} className="w-full shadow-md">
                  <span>
                    {authMode === 'REGISTER'
                      ? 'دریافت کد و ساخت حساب کاربری'
                      : 'دریافت کد تایید ورود'}
                  </span>
                  <ArrowLeft className="w-4 h-4 mr-1.5" />
                </Button>
              </form>
            ) : (
              <form onSubmit={handleManualVerifySubmit} className="space-y-5 text-xs">
                <div className="space-y-3">
                  <div className="text-center space-y-1">
                    <label className="text-gray-800 font-bold block">
                      کد تایید ۵ رقمی پیامک‌شده را وارد نمایید:
                    </label>
                    <p className="text-[11px] text-gray-500">
                      ارسال‌شده به شماره{' '}
                      <strong className="font-mono text-gray-800 dir-ltr inline-block">
                        {toPersianDigits(phone)}
                      </strong>
                    </p>
                  </div>

                  <div className="flex justify-center gap-2.5 pt-1" dir="ltr">
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => {
                          inputRefs.current[idx] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                        aria-label={`رقم ${toPersianDigits(idx + 1)} از ۵ کد تایید`}
                        maxLength={5}
                        value={digit}
                        onChange={(e) => handleOtpBoxChange(idx, e.target.value)}
                        onPaste={(e) => handleOtpPaste(idx, e)}
                        onKeyDown={(e) => handleKeyDown(idx, e)}
                        className="w-12 h-14 rounded-2xl border-2 border-[#E6E1D5] bg-[#FAF8F5] text-center font-mono font-black text-2xl text-[#2C4A2E] focus:border-[#2C4A2E] focus:bg-white focus:ring-4 focus:ring-[#2C4A2E]/10 focus:outline-none transition-all shadow-xs"
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => {
                      setOtpStep('PHONE');
                      setErrorMessage(null);
                    }}
                    className="text-gray-500 hover:text-[#2C4A2E] font-medium transition-colors cursor-pointer"
                  >
                    ← ویرایش شماره
                  </button>

                  <div>
                    {timerSeconds > 0 ? (
                      <span className="text-gray-500 font-medium">
                        ارسال مجدد تا{' '}
                        <strong className="font-mono text-[#2C4A2E]">
                          {formatTimer(timerSeconds)}
                        </strong>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSendOtp()}
                        className="text-[#2C4A2E] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>ارسال دوباره کد</span>
                      </button>
                    )}
                  </div>
                </div>

                <Button type="submit" size="lg" isLoading={isLoading} className="w-full shadow-md">
                  <CheckCircle2 className="w-4 h-4 ml-1.5" />
                  <span>
                    {authMode === 'REGISTER'
                      ? 'تکمیل ثبت‌نام و ورود به پروفارم'
                      : 'تایید و ورود به حساب'}
                  </span>
                </Button>
              </form>
            )}
          </div>
        )}

        {/* ==================================================== */}
        {/* METHOD 2: PASSWORD FLOW (Sign In or Sign Up via Pwd)*/}
        {/* ==================================================== */}
        {activeMethod === 'PASSWORD' && (
          <form
            onSubmit={authMode === 'LOGIN' ? handlePasswordLogin : handlePasswordRegister}
            className="space-y-4 text-xs animate-in fade-in duration-200"
          >
            {/* Full Name for Registration */}
            {authMode === 'REGISTER' && (
              <div>
                <label className="block text-gray-700 font-bold mb-1.5">
                  نام و نام خانوادگی:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="مانند: علی رضایی"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pr-10 pl-4 py-3 rounded-2xl border border-[#E6E1D5] bg-[#FDFDFD] focus:bg-white focus:outline-none focus:border-[#2C4A2E] focus:ring-4 focus:ring-[#2C4A2E]/10 font-medium text-sm transition-colors"
                  />
                  <User className="w-4 h-4 text-gray-400 absolute right-3.5 top-3.5" />
                </div>
              </div>
            )}

            {/* Email for Registration with Password */}
            {authMode === 'REGISTER' && (
              <div>
                <label className="block text-gray-700 font-bold mb-1.5">
                  پست الکترونیک (ایمیل):
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3.5 rounded-2xl border border-[#E6E1D5] bg-[#FDFDFD] focus:bg-white focus:outline-none focus:border-[#2C4A2E] focus:ring-4 focus:ring-[#2C4A2E]/10 text-left font-mono text-sm transition-all"
                    dir="ltr"
                  />
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                </div>
                <p className="mt-1.5 text-[11px] text-gray-500 leading-relaxed">
                  ایمیل شما به عنوان شناسه ورود اختصاصی ثبت می‌شود. شماره همراه در مرحله تسویه حساب دریافت و با پیامک تایید خواهد شد.
                </p>
              </div>
            )}

            {/* Identifier input for LOGIN */}
            {authMode === 'LOGIN' && (
              <div>
                <label className="block text-gray-700 font-bold mb-1.5">
                  ایمیل یا شماره تلفن همراه:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    placeholder="example@gmail.com یا ۰۹۱۷xxxxxxx"
                    value={passwordIdentifier}
                    onChange={(e) => setPasswordIdentifier(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-2xl border border-[#E6E1D5] bg-[#FDFDFD] focus:bg-white focus:outline-none focus:border-[#2C4A2E] focus:ring-4 focus:ring-[#2C4A2E]/10 text-left font-mono font-medium transition-all"
                    dir="ltr"
                  />
                </div>
              </div>
            )}

            {/* Password input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-gray-700 font-bold">
                  {authMode === 'LOGIN' ? 'کلمه عبور:' : 'کلمه عبور انتخابی:'}
                </label>
                {authMode === 'LOGIN' && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMethod('OTP');
                      setOtpStep('PHONE');
                      setErrorMessage(null);
                    }}
                    className="text-[11px] text-[#2C4A2E] font-bold hover:underline cursor-pointer"
                  >
                    فراموشی رمز؟ (ورود با پیامک)
                  </button>
                )}
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete={authMode === 'LOGIN' ? 'current-password' : 'new-password'}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3.5 rounded-2xl border border-[#E6E1D5] bg-[#FDFDFD] focus:bg-white focus:outline-none focus:border-[#2C4A2E] focus:ring-4 focus:ring-[#2C4A2E]/10 text-left font-mono text-sm transition-all"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'مخفی کردن کلمه عبور' : 'نمایش کلمه عبور'}
                  className="absolute left-3 top-3.5 text-gray-500 hover:text-gray-800 cursor-pointer transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              isLoading={isLoading}
              className="w-full bg-[#2C4A2E] hover:bg-[#1E3520] text-white shadow-md font-bold"
            >
              {authMode === 'LOGIN' ? (
                <>
                  <KeyRound className="w-4 h-4 ml-1.5 text-[#D4AF37]" />
                  <span>ورود به حساب کاربری</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 ml-1.5 text-[#D4AF37]" />
                  <span>ثبت‌نام و ایجاد حساب کاربری</span>
                </>
              )}
            </Button>
          </form>
        )}

        {/* Benefits & Trust Highlight for Registration */}
        {authMode === 'REGISTER' && (
          <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-1.5 text-[11px] text-emerald-950">
            <div className="flex items-center gap-1.5 font-bold text-emerald-900">
              <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>مزایای عضویت در پروفارم شیراز:</span>
            </div>
            <ul className="space-y-1 text-gray-700 font-medium pr-1">
              <li className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>ضمانت ۱۰۰٪ سلامت و اصالت ارگانیک مزارع</span>
              </li>
              <li className="flex items-center gap-2">
                <Truck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>ارسال مستقیم با پیک اختصاصی در شهر شیراز</span>
              </li>
              <li className="flex items-center gap-2">
                <Crown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>دسترسی به تخفیف‌های ویژه اشتراک پلاس و پرو</span>
              </li>
            </ul>
          </div>
        )}
        </div>

        {/* Clean Footer Link */}
        <div className="pt-2 border-t border-gray-100 flex justify-center text-center">
          <Link
            href="/"
            className="text-[12px] text-gray-500 hover:text-[#2C4A2E] font-medium transition-colors"
          >
            ← بازگشت به صفحه اصلی فروشگاه
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-[88vh] flex items-center justify-center">
          <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginFormContent />
    </React.Suspense>
  );
}

