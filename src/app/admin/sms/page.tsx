'use client';

import React, { useState, useEffect } from 'react';
import { farmStore } from '@/lib/db-store';
import {
  SmsBroadcast,
  SmsTargetSegment,
  SmsEventType,
  SmsEventTemplate,
  SmsProviderType,
  SmsProviderSettings,
  EmailMessageLog,
  EmailProviderSettings,
  User,
} from '@/types';
import { toPersianDigits } from '@/lib/formatters';
import { useToast, useConfirm } from '@/components/ui/ToastProvider';
import {
  Send,
  MessageSquare,
  Users,
  Crown,
  Sparkles,
  MapPin,
  CheckCircle2,
  Clock,
  Radio,
  FileText,
  Smartphone,
  Info,
  History,
  Zap,
  Bell,
  Settings2,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  RotateCcw,
  Save,
  Tag,
  PackageCheck,
  Truck,
  RotateCcw as ReturnIcon,
  AlertTriangle,
  AlertCircle,
  Play,
  Key,
  ShieldCheck,
  Globe,
  Lock,
  PhoneCall,
  Server,
  Mail,
  Eye,
  EyeOff,
  HelpCircle,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class SmsPageErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[AdminSmsPage ErrorBoundary caught]', error, errorInfo);
  }

  handleReset = () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('profarm_sms_templates');
        localStorage.removeItem('profarm_sms_settings');
        localStorage.removeItem('profarm_sms_broadcasts');
      } catch {}
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-xl mx-auto my-12 bg-white rounded-3xl border border-rose-200 shadow-xl text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-black text-gray-900">مشکلی در بارگذاری سامانه پیامک و ایمیل رخ داد</h2>
          <p className="text-xs text-gray-600 leading-relaxed font-mono dir-ltr bg-gray-50 p-2 rounded-xl border border-gray-200">
            {this.state.error?.message || 'خطای ناشناخته'}
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={this.handleReset}
              className="px-5 py-2.5 rounded-xl bg-[#2C4A2E] text-white font-bold text-xs hover:bg-[#1E3520] transition-colors cursor-pointer"
            >
              بازنشانی داده‌ها به پیش‌فرض و بارگذاری مجدد
            </button>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-bold text-xs hover:bg-gray-50 transition-colors cursor-pointer"
            >
              تلاش مجدد
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AdminSmsPageContent() {
  const toast = useToast();
  const confirm = useConfirm();
  // Main Navigation Tab: 'EVENTS' | 'GATEWAY' | 'BROADCAST' | 'EMAIL'
  const [activeTab, setActiveTab] = useState<'EVENTS' | 'GATEWAY' | 'BROADCAST' | 'EMAIL'>('EVENTS');

  // --- AUTOMATED EVENT TEMPLATES STATE ---
  const [eventTemplates, setEventTemplates] = useState<SmsEventTemplate[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<SmsEventType>('ORDER_DELIVERED');
  const [eventCategoryFilter, setEventCategoryFilter] = useState<'ALL' | 'ORDERS' | 'CLUB' | 'RETURNS'>('ALL');
  const [editingTemplateText, setEditingTemplateText] = useState('');
  const [isEventEnabled, setIsEventEnabled] = useState(true);

  // --- SMS PROVIDER / GATEWAY API SETTINGS STATE ---
  const [gatewaySettings, setGatewaySettings] = useState<SmsProviderSettings>({
    provider: 'KAVENEGAR',
    apiKey: '',
    senderNumber: '',
    patternCode: '',
    username: '',
    password: '',
    apiUrl: '',
    isEnabled: true,
    testPhone: '09170000000',
  });
  const [testPhoneNumber, setTestPhoneNumber] = useState('09170000000');
  const [isTestingGateway, setIsTestingGateway] = useState(false);
  const [gatewayTestLog, setGatewayTestLog] = useState<string | null>(null);

  // --- MANUAL BROADCAST STATE ---
  const [broadcasts, setBroadcasts] = useState<SmsBroadcast[]>([]);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [targetSegment, setTargetSegment] = useState<SmsTargetSegment>('ALL');
  const [customNumbersInput, setCustomNumbersInput] = useState('');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);

  // --- EMAIL DISPATCH & LOGS STATE ---
  const [emailLogs, setEmailLogs] = useState<EmailMessageLog[]>([]);
  const [emailTarget, setEmailTarget] = useState<'ALL' | 'USER' | 'CUSTOM'>('ALL');
  const [emailRecipientInput, setEmailRecipientInput] = useState('');
  const [selectedUserEmail, setSelectedUserEmail] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailContent, setEmailContent] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [registeredUsersList, setRegisteredUsersList] = useState<User[]>([]);

  // --- EMAIL PROVIDER / SMTP SETTINGS STATE ---
  const [emailSubTab, setEmailSubTab] = useState<'COMPOSE' | 'SETTINGS'>('COMPOSE');
  const [emailSettings, setEmailSettings] = useState<EmailProviderSettings>({
    isEnabled: true,
    provider: 'SMTP',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
    smtpSecure: false,
    fromEmail: '',
    fromName: 'مزارع ارگانیک پروفارم شیراز',
  });
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [emailTestLog, setEmailTestLog] = useState<{ success: boolean; message: string } | null>(null);
  const [isSavingEmailSettings, setIsSavingEmailSettings] = useState(false);

  // Global Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const loadData = () => {
    try {
      const tmpls = farmStore.getSmsEventTemplates() || [];
      setEventTemplates(tmpls);
      setBroadcasts(farmStore.getSmsBroadcasts() || []);
      const gSettings = farmStore.getSmsSettings();
      if (gSettings) {
        setGatewaySettings({ ...gSettings });
        if (gSettings.testPhone) setTestPhoneNumber(gSettings.testPhone);
      }

      // Initialize current selected event template
      const current = tmpls.find((t) => t?.id === selectedEventId) || tmpls[0];
      if (current) {
        setSelectedEventId(current.id);
        setEditingTemplateText(current.template || '');
        setIsEventEnabled(current.isEnabled ?? true);
      }
    } catch (e) {
      console.warn('[AdminSmsPage] Error loading local store templates:', e);
    }

    // Fetch server-configured settings securely
    fetch('/api/admin/sms-settings')
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && data?.settings) {
          setGatewaySettings((prev) => ({ ...prev, ...data.settings }));
          if (data.settings.testPhone) setTestPhoneNumber(data.settings.testPhone);
        }
      })
      .catch(() => {});

    // Fetch Email Logs
    fetch('/api/admin/email')
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && Array.isArray(data?.logs)) {
          setEmailLogs(data.logs);
        }
      })
      .catch(() => {});

    // Fetch registered users with email
    fetch('/api/admin?type=users')
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && Array.isArray(data?.users)) {
          setRegisteredUsersList(data.users);
          const firstWithEmail = data.users.find((u: User) => u?.email);
          if (firstWithEmail?.email) {
            setSelectedUserEmail(firstWithEmail.email);
          }
        }
      })
      .catch(() => {});

    // Fetch Email Provider Settings
    fetch('/api/admin/email-settings')
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && data?.settings) {
          setEmailSettings(data.settings);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    setMounted(true);
    loadData();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Switch selected event template to edit
  const handleSelectEvent = (tmpl: SmsEventTemplate) => {
    setSelectedEventId(tmpl.id);
    setEditingTemplateText(tmpl.template);
    setIsEventEnabled(tmpl.isEnabled);
  };

  // Toggle template enabled/disabled directly from list or form
  const handleToggleEventStatus = (id: SmsEventType, currentStatus: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = farmStore.updateSmsEventTemplate(id, { isEnabled: !currentStatus });
    if (updated) {
      setEventTemplates([...farmStore.getSmsEventTemplates()]);
      if (selectedEventId === id) {
        setIsEventEnabled(!currentStatus);
      }
      showToast(`وضعیت ارسال پیامک رویداد «${updated.title}» به ${!currentStatus ? '«فعال»' : '«غیرفعال»'} تغییر یافت.`);
    }
  };

  // Insert variable tag into template text
  const handleInsertVariable = (variableKey: string) => {
    setEditingTemplateText((prev) => prev + ' ' + variableKey);
  };

  // Save changes to current template
  const handleSaveEventTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = farmStore.updateSmsEventTemplate(selectedEventId, {
      template: editingTemplateText,
      isEnabled: isEventEnabled,
    });
    if (updated) {
      setEventTemplates([...farmStore.getSmsEventTemplates()]);
      showToast(`قالب پیامک رویداد «${updated.title}» با موفقیت ذخیره شد.`);
    }
  };

  // Reset to default factory template
  const handleResetEventTemplate = async () => {
    const ok = await confirm({
      title: 'بازنشانی قالب پیامک',
      description: 'آیا از بازنشانی متن این پیامک به حالت پیش‌فرض کارخانه اطمینان دارید؟',
      confirmLabel: 'بازنشانی قالب',
      cancelLabel: 'انصراف',
      variant: 'warning',
    });
    if (ok) {
      const reset = farmStore.resetSmsEventTemplate(selectedEventId);
      if (reset) {
        setEventTemplates([...farmStore.getSmsEventTemplates()]);
        setEditingTemplateText(reset.template);
        setIsEventEnabled(reset.isEnabled);
        showToast(`قالب پیامک به متن پیش‌فرض اولیه بازنشانی شد.`);
        toast.success('قالب پیامک به متن پیش‌فرض اولیه بازنشانی شد.');
      }
    }
  };

  // Test simulation send (explicitly labeled as local simulation)
  const handleTestSendSimulation = () => {
    const current = eventTemplates.find((t) => t.id === selectedEventId);
    if (!current) return;
    showToast(`پیش‌نمایش شبیه‌سازی محلی رویداد «${current.title}» بررسی شد (ارسال واقعی مخابراتی انجام نشد).`);
  };

  // Save Gateway API Settings securely to server
  const handleSaveGatewaySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/sms-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...gatewaySettings,
          testPhone: testPhoneNumber,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.settings) {
        setGatewaySettings({ ...data.settings });
        farmStore.updateSmsSettings(data.settings);
        showToast(`تنظیمات وب‌سرویس API سامانه ${getProviderName(data.settings.provider)} با موفقیت در سرور ذخیره شد.`);
        toast.success(`تنظیمات سامانه ${getProviderName(data.settings.provider)} با موفقیت ذخیره شد.`);
        return;
      }
      toast.error(data.error || data.message || 'خطا در ذخیره تنظیمات پیامک در سرور.');
    } catch {
      toast.error('خطا در ارتباط با سرور؛ تنظیمات پیامک ذخیره نشد.');
    }
  };

  // Test send via configured SMS Gateway (explicitly labeled when simulated)
  const handleTestGatewaySend = () => {
    if (!testPhoneNumber.trim()) {
      toast.error('لطفاً شماره موبایل تست را وارد کنید.');
      return;
    }
    setIsTestingGateway(true);
    setGatewayTestLog(null);

    setTimeout(() => {
      setIsTestingGateway(false);
      const provName = getProviderName(gatewaySettings.provider);
      setGatewayTestLog(
        `[شبیه‌سازی محلی] وب‌سرویس ${provName} برای شماره ${testPhoneNumber} در محیط آزمایشی بررسی شد. تا زمان فعال‌سازی API کلید واقعی در سرور، پیامکی به شبکه مخابراتی ارسال نمی‌شود.`
      );
      showToast(`شبیه‌سازی تست اتصال وب‌سرویس ${provName} انجام شد (ارسال واقعی انجام نشد).`);
    }, 400);
  };

  const getProviderName = (prov?: SmsProviderType | string) => {
    switch (prov) {
      case 'KAVENEGAR':
        return 'کاوه‌نگار (Kavenegar)';
      case 'MELIPAYAMAK':
        return 'ملی‌پیامک (MeliPayamak)';
      case 'FARAZ_SMS':
        return 'فراز اس‌ام‌اس / IPPanel';
      case 'CUSTOM':
        return 'وب‌سرویس اختصاصی (Custom REST API)';
      case 'MOCK':
        return 'شبیه‌ساز تستی (Mock)';
      default:
        return 'کاوه‌نگار (Kavenegar)';
    }
  };

  // Generate live sample preview with mock data
  const renderLivePreviewText = (rawTemplate?: string) => {
    if (!rawTemplate) return '';
    return rawTemplate
      .replaceAll('{customerName}', 'سارا نامدار')
      .replaceAll('{orderNumber}', 'PRF-1405-8821')
      .replaceAll('{totalAmount}', '۷۴۵,۰۰۰')
      .replaceAll('{deliveryDate}', 'چهارشنبه ۱۹ شهریور')
      .replaceAll('{deliveryTime}', '۱۵:۰۰ الی ۲۱:۰۰')
      .replaceAll('{siteUrl}', 'profarm.ir')
      .replaceAll('{surveyUrl}', 'profarm.ir/survey')
      .replaceAll('{supportPhone}', '۰۷۱-۳۶۲۸۰۰۰۰')
      .replaceAll('{tierName}', 'پروفارم پرو (طلایی)')
      .replaceAll('{expiresAt}', '۱۴۰۵/۱۲/۲۹')
      .replaceAll('{returnStatus}', 'تایید عودت کالا')
      .replaceAll('{adminNote}', 'مبلغ به شبا واریز شد.');
  };

  // Character & Part Calculations
  const templateCharCount = editingTemplateText?.length || 0;
  const templateSmsPages = templateCharCount === 0 ? 1 : templateCharCount <= 70 ? 1 : Math.ceil(templateCharCount / 67);

  const broadcastCharCount = broadcastMessage?.length || 0;
  const broadcastSmsPages = broadcastCharCount === 0 ? 1 : broadcastCharCount <= 70 ? 1 : Math.ceil(broadcastCharCount / 67);

  // Manual broadcast recipient estimate
  const getBroadcastRecipientEstimate = () => {
    try {
      const allUsers = farmStore.getAllUsers() || [];
      if (targetSegment === 'PRO_MEMBERS') {
        return allUsers.filter((u) => u.isProMember || u.tier === 'PRO').length;
      }
      if (targetSegment === 'PLUS_MEMBERS') {
        return allUsers.filter((u) => u.isPlusMember || u.tier === 'PLUS').length;
      }
      if (targetSegment === 'SHIRAZ_BUYERS') {
        const shirazOrders = (farmStore.getOrders() || []).filter((o) => o.address?.isShiraz !== false);
        const uniquePhones = new Set(shirazOrders.map((o) => o.address?.phone).filter(Boolean));
        return uniquePhones.size || 15;
      }
      if (targetSegment === 'CUSTOM') {
        return (customNumbersInput || '').split(/[\n,]/).filter((n) => n.trim().length > 0).length;
      }
      return allUsers.length;
    } catch {
      return 0;
    }
  };

  const handleSendManualBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      toast.error('لطفاً عنوان و متن پیامک را کامل کنید.');
      return;
    }

    const recipientCount = Math.max(1, getBroadcastRecipientEstimate());
    const ok = await confirm({
      title: 'تایید ارسال کمپین پیامکی انبوه',
      description: `آیا از ثبت و ارسال کمپین «${broadcastTitle}» برای حدود ${toPersianDigits(recipientCount)} مخاطب اطمینان دارید؟`,
      confirmLabel: 'ارسال کمپین پیامکی',
      cancelLabel: 'انصراف',
      variant: 'warning',
    });
    if (!ok) return;

    setIsSendingBroadcast(true);
    setTimeout(() => {
      const customNumbers = targetSegment === 'CUSTOM' ? customNumbersInput.trim() : undefined;

      farmStore.createSmsBroadcast({
        title: broadcastTitle,
        message: broadcastMessage,
        targetSegment,
        recipientCount,
        customNumbers,
      });

      setBroadcasts([...farmStore.getSmsBroadcasts()]);
      setIsSendingBroadcast(false);
      setBroadcastTitle('');
      setBroadcastMessage('');
      if (targetSegment === 'CUSTOM') setCustomNumbersInput('');
      const msg = `کمپین پیامکی «${broadcastTitle}» با موفقیت برای ${toPersianDigits(recipientCount)} شماره در صف ارسال قرار گرفت.`;
      showToast(msg);
      toast.success(msg);
    }, 500);
  };

  const handleSendAdminEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailSubject.trim()) {
      toast.error('لطفاً موضوع ایمیل را وارد فرمایید.');
      return;
    }
    if (!emailContent.trim()) {
      toast.error('لطفاً متن پیام ایمیل را وارد فرمایید.');
      return;
    }
    if (emailTarget === 'CUSTOM' && !emailRecipientInput.trim()) {
      toast.error('لطفاً آدرس ایمیل گیرنده را وارد فرمایید.');
      return;
    }
    if (emailTarget === 'USER' && !selectedUserEmail.trim()) {
      toast.error('لطفاً کاربر دریافت‌کننده را انتخاب نمایید.');
      return;
    }

    if (emailTarget !== 'CUSTOM' && emailTarget !== 'USER') {
      const ok = await confirm({
        title: 'تایید ارسال ایمیل گروهی',
        description: `آیا از ارسال ایمیل گروهی با موضوع «${emailSubject}» به گروه انتخاب‌شده اطمینان دارید؟`,
        confirmLabel: 'ارسال ایمیل گروهی',
        cancelLabel: 'انصراف',
        variant: 'warning',
      });
      if (!ok) return;
    }

    setIsSendingEmail(true);
    try {
      const targetEmail = emailTarget === 'USER' ? selectedUserEmail : emailRecipientInput;
      const targetUser = registeredUsersList.find((u) => u.email === targetEmail);

      const res = await fetch('/api/admin/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: emailTarget,
          recipientEmail: targetEmail,
          recipientName: targetUser?.name || undefined,
          subject: emailSubject,
          content: emailContent,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'خطا در ارسال ایمیل');
      }

      const okMsg = data.message || 'ایمیل با موفقیت ارسال شد.';
      showToast(okMsg);
      toast.success(okMsg);
      setEmailSubject('');
      setEmailContent('');
      if (emailTarget === 'CUSTOM') setEmailRecipientInput('');

      // Refresh email logs
      const logsRes = await fetch('/api/admin/email');
      const logsData = await logsRes.json();
      if (logsData.success && logsData.logs) {
        setEmailLogs(logsData.logs);
      }
    } catch (err: any) {
      toast.error(err.message || 'خطا در ارسال ایمیل');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleSaveEmailSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingEmailSettings(true);
    try {
      const res = await fetch('/api/admin/email-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailSettings),
      });
      const data = await res.json();
      if (data.success) {
        setEmailSettings(data.settings);
        showToast('تنظیمات سرور ایمیل (SMTP) با موفقیت ذخیره شد.');
        toast.success('تنظیمات سرور ایمیل (SMTP) با موفقیت ذخیره شد.');
      } else {
        toast.error(data.message || 'خطا در ذخیره تنظیمات ایمیل');
      }
    } catch {
      toast.error('خطا در برقراری ارتباط با سرور.');
    } finally {
      setIsSavingEmailSettings(false);
    }
  };

  const handleTestEmailConnection = async () => {
    if (!emailSettings.smtpHost || !emailSettings.smtpUser) {
      toast.error('لطفاً ابتدا هاست SMTP و نام کاربری را وارد فرمایید.');
      return;
    }
    setIsTestingEmail(true);
    setEmailTestLog(null);
    try {
      const res = await fetch('/api/admin/email-settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...emailSettings,
          testRecipient: testEmailRecipient.trim() || undefined,
        }),
      });
      const data = await res.json();
      setEmailTestLog({
        success: data.success,
        message: data.message,
      });
      if (data.success) {
        showToast('تست ارسال واقعی ایمیل با موفقیت انجام شد!');
        // Refresh email logs
        fetch('/api/admin/email')
          .then((r) => r.json())
          .then((d) => {
            if (d?.success && d?.logs) setEmailLogs(d.logs);
          });
      }
    } catch (err: any) {
      setEmailTestLog({
        success: false,
        message: err.message || 'خطای غیرمنتظره در تست وب‌سرویس ایمیل',
      });
    } finally {
      setIsTestingEmail(false);
    }
  };

  const filteredEventTemplates = (eventTemplates || []).filter((t) => {
    if (eventCategoryFilter === 'ALL') return true;
    return t.category === eventCategoryFilter;
  });

  const selectedEvent = (eventTemplates || []).find((t) => t?.id === selectedEventId) || eventTemplates[0];

  if (!mounted) {
    return (
      <div className="min-h-[400px] flex items-center justify-center p-8 text-center text-gray-500 font-bold gap-3">
        <div className="w-7 h-7 border-3 border-[#2C4A2E] border-t-transparent rounded-full animate-spin" />
        <span>در حال بارگذاری سامانه پیامک و ایمیل...</span>
      </div>
    );
  }

  const getEventCategoryIcon = (category?: SmsEventTemplate['category']) => {
    switch (category) {
      case 'ORDERS':
        return <Truck className="w-4 h-4 text-emerald-700" />;
      case 'CLUB':
        return <Crown className="w-4 h-4 text-amber-600" />;
      case 'RETURNS':
        return <ReturnIcon className="w-4 h-4 text-rose-600" />;
      default:
        return <Truck className="w-4 h-4 text-emerald-700" />;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-50 p-4 rounded-2xl bg-[#2C4A2E] text-white text-xs sm:text-sm font-bold flex items-center gap-3 shadow-2xl border border-emerald-400/40 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-[#D4A373] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E6E1D5]">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#D4A373]">
            <Radio className="w-4 h-4 text-[#2C4A2E]" />
            <span>سامانه هوشمند پیامک، اعلان‌های خودکار رویدادها، تنظیم API و کمپین‌ها</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#2C4A2E] mt-0.5">
            مدیریت پیامک‌ها، وب‌سرویس API و سناریوهای خودکار
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            اتصال وب‌سرویس پیامکی، تعیین متن پیامک‌های ارسالی برای هر اتفاق، و ارسال کمپین‌های اعضا
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-3.5 py-2 rounded-2xl border text-xs font-bold flex items-center gap-1.5 shadow-xs ${
            gatewaySettings?.isEnabled
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            <Zap className={`w-3.5 h-3.5 ${gatewaySettings?.isEnabled ? 'text-emerald-600' : 'text-rose-600'}`} />
            <span>وب‌سرویس ({(getProviderName(gatewaySettings?.provider) || 'کاوه‌نگار').split(' ')[0]}): {gatewaySettings?.isEnabled ? 'متصل و فعال' : 'غیرفعال'}</span>
          </span>
        </div>
      </div>

      {/* 3-Tab Main Navigation Switcher */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-white border border-[#E6E1D5] shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab('EVENTS')}
          className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'EVENTS'
              ? 'bg-[#2C4A2E] text-white shadow-sm'
              : 'text-gray-600 hover:bg-[#F9F8F5]'
          }`}
        >
          <Bell className="w-4 h-4 text-[#D4A373]" />
          <span>پیامک‌های خودکار رویدادها (تکمیل سفارش، پیک و...)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('GATEWAY')}
          className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'GATEWAY'
              ? 'bg-[#2C4A2E] text-white shadow-sm'
              : 'text-gray-600 hover:bg-[#F9F8F5]'
          }`}
        >
          <Key className="w-4 h-4 text-[#D4A373]" />
          <span>تنظیمات وب‌سرویس و API درگاه پیامک (کاوه‌نگار، ملی‌پیامک و...)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('BROADCAST')}
          className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'BROADCAST'
              ? 'bg-[#2C4A2E] text-white shadow-sm'
              : 'text-gray-600 hover:bg-[#F9F8F5]'
          }`}
        >
          <Send className="w-4 h-4 text-[#D4A373]" />
          <span>ارسال پیامک انبوه و کمپین‌ها ({toPersianDigits(broadcasts.length)})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('EMAIL')}
          className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'EMAIL'
              ? 'bg-[#2C4A2E] text-white shadow-sm'
              : 'text-gray-600 hover:bg-[#F9F8F5]'
          }`}
        >
          <Mail className="w-4 h-4 text-[#D4A373]" />
          <span>سامانه ارسال ایمیل و مکاتبات ({toPersianDigits(emailLogs.length)})</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: AUTOMATED EVENT-TRIGGERED SMS TEMPLATES CONFIGURATION */}
      {/* ============================================================ */}
      {activeTab === 'EVENTS' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-gray-500 ml-1">دسته‌بندی رویدادها:</span>
            <button
              onClick={() => setEventCategoryFilter('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                eventCategoryFilter === 'ALL'
                  ? 'bg-[#2C4A2E] text-white shadow-xs'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-[#E6E1D5]'
              }`}
            >
              همه سناریوها ({toPersianDigits(eventTemplates.length)})
            </button>

            <button
              onClick={() => setEventCategoryFilter('ORDERS')}
              className={`inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                eventCategoryFilter === 'ORDERS'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white text-emerald-900 hover:bg-emerald-50 border border-emerald-200'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>مراحل سفارش و پیک شیراز</span>
            </button>

            <button
              onClick={() => setEventCategoryFilter('CLUB')}
              className={`inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                eventCategoryFilter === 'CLUB'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-amber-900 hover:bg-amber-50 border border-amber-200'
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              <span>باشگاه اعضا (پرو و پلاس)</span>
            </button>

            <button
              onClick={() => setEventCategoryFilter('RETURNS')}
              className={`inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                eventCategoryFilter === 'RETURNS'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'bg-white text-rose-900 hover:bg-rose-50 border border-rose-200'
              }`}
            >
              <ReturnIcon className="w-3.5 h-3.5" />
              <span>مرجوعی و تضمین کیفیت</span>
            </button>
          </div>

          {/* Master-Detail Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Events List (5 Cols) */}
            <div className="lg:col-span-5 space-y-3">
              <div className="text-xs font-bold text-gray-500 mb-1 flex items-center justify-between">
                <span>انتخاب رویداد جهت ویرایش متن پیامک:</span>
                <span>{toPersianDigits(filteredEventTemplates.length)} سناریو</span>
              </div>

              <div className="space-y-2.5">
                {filteredEventTemplates.map((tmpl) => {
                  const isSelected = tmpl.id === selectedEventId;

                  return (
                    <div
                      key={tmpl.id}
                      onClick={() => handleSelectEvent(tmpl)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer text-right relative overflow-hidden ${
                        isSelected
                          ? 'border-[#2C4A2E] bg-white shadow-md ring-2 ring-[#2C4A2E]/20'
                          : 'border-[#E6E1D5] bg-white hover:border-gray-400/80 hover:bg-gray-50/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-gray-100">
                            {getEventCategoryIcon(tmpl.category)}
                          </div>
                          <div>
                            <h4 className="font-bold text-xs sm:text-sm text-gray-900 leading-snug">
                              {tmpl.title}
                            </h4>
                            <span className="text-[10px] text-gray-400 block mt-0.5">
                              کد شناسه: <code className="font-mono text-gray-600">{tmpl.id}</code>
                            </span>
                          </div>
                        </div>

                        {/* Toggle Active Button */}
                        <button
                          type="button"
                          onClick={(e) => handleToggleEventStatus(tmpl.id, tmpl.isEnabled, e)}
                          title={tmpl.isEnabled ? 'غیرفعال‌سازی ارسال این پیامک' : 'فعال‌سازی ارسال خودکار'}
                          className={`p-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
                            tmpl.isEnabled
                              ? 'text-emerald-700 hover:bg-emerald-50'
                              : 'text-gray-400 hover:bg-gray-100'
                          }`}
                        >
                          {tmpl.isEnabled ? (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              <span>فعال</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
                              <span>خاموش</span>
                            </div>
                          )}
                        </button>
                      </div>

                      <p className="text-xs text-gray-500 mt-2.5 line-clamp-2 leading-relaxed">
                        {tmpl.description}
                      </p>

                      <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                        <span>قالب: {toPersianDigits(tmpl.template.length)} نویسه</span>
                        <span className="text-[#2C4A2E] font-bold group-hover:underline">
                          {isSelected ? 'در حال ویرایش ←' : 'ویرایش قالب'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Template Editor & Live Phone Preview (7 Cols) */}
            <div className="lg:col-span-7 space-y-6">
              {selectedEvent && (
                <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#E6E1D5] shadow-farm space-y-6">
                  {/* Editor Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#F3EFE6]">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-base text-[#2C4A2E]">
                          تنظیم پیامک: {selectedEvent.title}
                        </h3>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {selectedEvent.description}
                      </p>
                    </div>

                    {/* Quick Switch for this template */}
                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <span className="text-xs font-bold text-gray-700">ارسال خودکار:</span>
                      <button
                        type="button"
                        onClick={() => setIsEventEnabled(!isEventEnabled)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          isEventEnabled
                            ? 'bg-emerald-700 text-white shadow-xs'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {isEventEnabled ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>فعال است</span>
                          </>
                        ) : (
                          <span>غیرفعال</span>
                        )}
                      </button>
                    </div>
                  </div>

                  <form onSubmit={handleSaveEventTemplate} className="space-y-5">
                    {/* Available Dynamic Variables */}
                    <div className="p-3.5 rounded-2xl bg-[#F9F8F5] border border-[#E6E1D5] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-[#2C4A2E]" />
                          <span>متغیرهای پویا (برای درج در متن روی هر کدام کلیک کنید):</span>
                        </span>
                        <span className="text-[10px] text-gray-400">جایگذاری خودکار اطلاعات خریدار</span>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {(selectedEvent?.availableVariables || []).map((v) => (
                          <button
                            key={v.key}
                            type="button"
                            onClick={() => handleInsertVariable(v.key)}
                            className="px-2.5 py-1 rounded-lg bg-white border border-[#E6E1D5] hover:border-[#2C4A2E] hover:bg-emerald-50 text-xs text-gray-800 transition-colors flex items-center gap-1 cursor-pointer font-medium"
                            title={`درج ${v.label} در متن پیامک`}
                          >
                            <span className="font-mono text-[11px] font-bold text-[#2C4A2E]">{v.key}</span>
                            <span className="text-[11px] text-gray-500">({v.label})</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Textarea Template */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-gray-700 font-bold text-xs">
                          متن قالب پیامک (پشتیبانی کامل از زبان فارسی و اموجی):
                        </label>
                        <div className="text-[11px] font-bold text-gray-500">
                          <span>{toPersianDigits(templateCharCount)} نویسه</span>
                          <span className="mx-1">|</span>
                          <span className="text-[#2C4A2E]">{toPersianDigits(templateSmsPages)} پارت پیامک</span>
                        </div>
                      </div>

                      <textarea
                        rows={5}
                        required
                        value={editingTemplateText}
                        onChange={(e) => setEditingTemplateText(e.target.value)}
                        placeholder="متن پیامک رویداد را بنویسید..."
                        className="w-full p-4 rounded-2xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E] text-xs sm:text-sm text-gray-900 leading-relaxed font-medium"
                      />
                    </div>

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleResetEventTemplate}
                          className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                          title="بازگشت به متن پیش‌فرض کارخانه"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>بازنشانی به پیش‌فرض</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleTestSendSimulation}
                          className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                          title="ارسال تستی پیامک به شماره موبایل ادمین"
                        >
                          <Play className="w-3.5 h-3.5 text-amber-700" />
                          <span>ارسال تستی به ادمین</span>
                        </button>
                      </div>

                      <button
                        type="submit"
                        className="px-6 py-2.5 rounded-xl bg-[#2C4A2E] text-white font-bold text-xs sm:text-sm hover:bg-[#1E3520] shadow-md flex items-center gap-1.5 cursor-pointer transition-all hover:scale-102"
                      >
                        <Save className="w-4 h-4 text-[#D4A373]" />
                        <span>ذخیره تنظیمات قالب پیامک</span>
                      </button>
                    </div>
                  </form>

                  {/* Live Smartphone Frame Preview */}
                  <div className="pt-5 border-t border-[#F3EFE6] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                        <Smartphone className="w-4 h-4 text-[#2C4A2E]" />
                        <span>پیش‌نمایش زنده در صفحه گوشی همراه خریدار (با نمونه اطلاعات واقعی):</span>
                      </div>
                      <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        شبیه‌سازی زنده
                      </span>
                    </div>

                    <div className="max-w-md mx-auto p-4 rounded-3xl bg-gray-900 border-4 border-gray-800 shadow-2xl text-white space-y-3">
                      {/* Phone Top Notch */}
                      <div className="flex items-center justify-between px-3 text-[10px] text-gray-400">
                        <span>09:41</span>
                        <div className="w-16 h-3 bg-black rounded-full" />
                        <span>5G 100%</span>
                      </div>

                      {/* SMS Sender Header */}
                      <div className="text-center pb-2 border-b border-gray-800">
                        <div className="w-10 h-10 rounded-full bg-emerald-800 text-white font-black text-xs flex items-center justify-center mx-auto mb-1">
                          PF
                        </div>
                        <div className="text-xs font-bold text-gray-200">PRO FARM SHIRAZ</div>
                        <div className="text-[10px] text-gray-500">مزارع ارگانیک پروفارم شیراز</div>
                      </div>

                      {/* SMS Message Bubble */}
                      <div className="bg-gray-800 p-3.5 rounded-2xl rounded-tr-none text-xs text-gray-100 whitespace-pre-wrap leading-relaxed shadow-inner border border-gray-700/60">
                        {renderLivePreviewText(editingTemplateText)}
                      </div>

                      <div className="text-center text-[10px] text-gray-500">
                        ارسال از سرشماره خدماتی اختصاصی پروفارم شیراز
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: SMS PROVIDER / API GATEWAY SETTINGS                   */}
      {/* ============================================================ */}
      {activeTab === 'GATEWAY' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Form Column (8 Cols) */}
            <div className="lg:col-span-8 bg-white rounded-3xl p-6 sm:p-8 border border-[#E6E1D5] shadow-farm space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#F3EFE6]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#2C4A2E]/10 flex items-center justify-center text-[#2C4A2E]">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-[#2C4A2E]">
                      تنظیمات وب‌سرویس و درگاه پیامک (API)
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      اتصال سایت به پنل‌های پیامکی ایران (کاوه‌نگار، ملی‌پیامک، فراز اس‌ام‌اس و REST API)
                    </p>
                  </div>
                </div>

                {/* Gateway Enable/Disable Toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-700">اتصال وب‌سرویس:</span>
                  <button
                    type="button"
                    onClick={() =>
                      setGatewaySettings((prev) => ({ ...prev, isEnabled: !prev.isEnabled }))
                    }
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      gatewaySettings.isEnabled
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}
                  >
                    {gatewaySettings.isEnabled ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>فعال و آنلاین</span>
                      </>
                    ) : (
                      <span>قطع اتصال (خاموش)</span>
                    )}
                  </button>
                </div>
              </div>

              {/* Provider Selector Cards */}
              <div className="space-y-3">
                <label className="block text-gray-800 font-black text-xs">
                  انتخاب سامانه و ارائه‌دهنده پیامک (SMS Provider):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Kavenegar */}
                  <div
                    onClick={() => setGatewaySettings((prev) => ({ ...prev, provider: 'KAVENEGAR' }))}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      gatewaySettings.provider === 'KAVENEGAR'
                        ? 'border-[#2C4A2E] bg-emerald-50/50 ring-2 ring-[#2C4A2E]/20 shadow-xs'
                        : 'border-gray-200 hover:border-gray-300 bg-[#F9F8F5]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-gray-900">کاوه‌نگار (Kavenegar)</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                        پیشنهادی
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      وب‌سرویس خدماتی بدون بلک‌لیست (Lookup/Pattern) و ارسال مستقیم پیامک‌های OTP و سفارشات
                    </p>
                  </div>

                  {/* Faraz SMS / IPPanel */}
                  <div
                    onClick={() => setGatewaySettings((prev) => ({ ...prev, provider: 'FARAZ_SMS' }))}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      gatewaySettings.provider === 'FARAZ_SMS'
                        ? 'border-[#2C4A2E] bg-emerald-50/50 ring-2 ring-[#2C4A2E]/20 shadow-xs'
                        : 'border-gray-200 hover:border-gray-300 bg-[#F9F8F5]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-gray-900">فراز اس‌ام‌اس / IPPanel</span>
                      <span className="text-[10px] bg-sky-100 text-sky-800 font-bold px-2 py-0.5 rounded-md">
                        خط خدماتی ۳۰۰۰
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      پلتفرم یکپارچه نمایندگی‌های IPPanel با کلید دسترسی API Key و پترن پترن‌های شرکتی
                    </p>
                  </div>

                  {/* MeliPayamak */}
                  <div
                    onClick={() => setGatewaySettings((prev) => ({ ...prev, provider: 'MELIPAYAMAK' }))}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      gatewaySettings.provider === 'MELIPAYAMAK'
                        ? 'border-[#2C4A2E] bg-emerald-50/50 ring-2 ring-[#2C4A2E]/20 shadow-xs'
                        : 'border-gray-200 hover:border-gray-300 bg-[#F9F8F5]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-gray-900">ملی‌پیامک (MeliPayamak)</span>
                      <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-md">
                        وب‌سرویس REST
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      اتصال با نام کاربری، کلمه عبور و وب‌سرویس خدماتی ملی‌پیامک
                    </p>
                  </div>

                  {/* Custom REST API */}
                  <div
                    onClick={() => setGatewaySettings((prev) => ({ ...prev, provider: 'CUSTOM' }))}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      gatewaySettings.provider === 'CUSTOM'
                        ? 'border-[#2C4A2E] bg-emerald-50/50 ring-2 ring-[#2C4A2E]/20 shadow-xs'
                        : 'border-gray-200 hover:border-gray-300 bg-[#F9F8F5]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-gray-900">وب‌سرویس سفارشی (Custom API)</span>
                      <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-md">
                        REST Endpoint
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      اتصال به سامانه اختصاصی، SMS Gateway محلی یا هر سرور ارسال پیامک دیگر
                    </p>
                  </div>
                </div>
              </div>

              {/* Dynamic Credentials Form */}
              <form onSubmit={handleSaveGatewaySettings} className="space-y-4 text-xs sm:text-sm">
                {/* API Key (For Kavenegar, Faraz, Custom) */}
                {gatewaySettings.provider !== 'MELIPAYAMAK' && (
                  <div>
                    <label className="block text-gray-700 font-bold mb-1.5">
                      کلید دسترسی وب‌سرویس (API Key / Token):
                    </label>
                    <div className="relative">
                      <Key className="w-4 h-4 text-gray-400 absolute right-3.5 top-3" />
                      <input
                        type="text"
                        required
                        placeholder="مثال: 6E35474B5365576C726F763567..."
                        value={gatewaySettings.apiKey}
                        onChange={(e) =>
                          setGatewaySettings((prev) => ({ ...prev, apiKey: e.target.value }))
                        }
                        className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white text-xs font-mono text-left focus:outline-none focus:border-[#2C4A2E]"
                        dir="ltr"
                      />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">
                      این کلید را از پنل کاربری سامانه پیامک در منوی «تنظیمات و دسترسی‌های وب‌سرویس» کپی کنید.
                    </p>
                  </div>
                )}

                {/* Username & Password for MeliPayamak */}
                {gatewaySettings.provider === 'MELIPAYAMAK' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-gray-700 font-bold mb-1.5">نام کاربری پنل ملی‌پیامک:</label>
                      <input
                        type="text"
                        required
                        value={gatewaySettings.username || ''}
                        onChange={(e) =>
                          setGatewaySettings((prev) => ({ ...prev, username: e.target.value }))
                        }
                        className="w-full px-4 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white text-xs font-mono text-left"
                        dir="ltr"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-700 font-bold mb-1.5">رمز عبور پنل ملی‌پیامک:</label>
                      <input
                        type="password"
                        required
                        value={gatewaySettings.password || ''}
                        onChange={(e) =>
                          setGatewaySettings((prev) => ({ ...prev, password: e.target.value }))
                        }
                        className="w-full px-4 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white text-xs font-mono text-left"
                        dir="ltr"
                      />
                    </div>
                  </div>
                )}

                {/* Sender Line Number */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-700 font-bold mb-1.5">
                      شماره خط فرستنده (اختصاصی / خدماتی):
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: 1000596446 یا 3000..."
                      value={gatewaySettings.senderNumber}
                      onChange={(e) =>
                        setGatewaySettings((prev) => ({ ...prev, senderNumber: e.target.value }))
                      }
                      className="w-full px-4 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white text-xs font-mono text-left"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 font-bold mb-1.5">
                      کد الگو / پترن خدماتی (Pattern / Lookup Code):
                    </label>
                    <input
                      type="text"
                      placeholder="مثال: profarm-notif"
                      value={gatewaySettings.patternCode || ''}
                      onChange={(e) =>
                        setGatewaySettings((prev) => ({ ...prev, patternCode: e.target.value }))
                      }
                      className="w-full px-4 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white text-xs font-mono text-left"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Custom API Endpoint if Custom Provider */}
                {gatewaySettings.provider === 'CUSTOM' && (
                  <div>
                    <label className="block text-gray-700 font-bold mb-1.5">آدرس وب‌سرویس (Endpoint URL):</label>
                    <input
                      type="url"
                      required
                      placeholder="https://api.yoursms.com/v1/send"
                      value={gatewaySettings.apiUrl || ''}
                      onChange={(e) =>
                        setGatewaySettings((prev) => ({ ...prev, apiUrl: e.target.value }))
                      }
                      className="w-full px-4 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white text-xs font-mono text-left"
                      dir="ltr"
                    />
                  </div>
                )}

                {/* Save Button */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                  <button
                    type="submit"
                    className="px-7 py-2.5 rounded-xl bg-[#2C4A2E] text-white font-bold text-xs sm:text-sm hover:bg-[#1E3520] shadow-md flex items-center gap-1.5 cursor-pointer transition-all hover:scale-102"
                  >
                    <Save className="w-4 h-4 text-[#D4A373]" />
                    <span>ذخیره تنظیمات API پیامک</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Test Connection & Provider Documentation (4 Cols) */}
            <div className="lg:col-span-4 space-y-4">
              {/* Test SMS Sender Card */}
              <div className="bg-white rounded-3xl p-6 border border-[#E6E1D5] shadow-farm space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                  <PhoneCall className="w-4 h-4 text-[#2C4A2E]" />
                  <h3 className="font-bold text-sm text-[#2C4A2E]">تست آنلاین اتصال به وب‌سرویس</h3>
                </div>

                <p className="text-xs text-gray-500 leading-relaxed">
                  یک پیامک تست اتصال به شماره موبایل مورد نظر ارسال کنید تا از صحت API Key و برقراری ارتباط وب‌سرویس اطمینان حاصل فرمایید.
                </p>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-700">شماره موبایل دریافت‌کننده تست:</label>
                  <input
                    type="text"
                    value={testPhoneNumber}
                    onChange={(e) => setTestPhoneNumber(e.target.value)}
                    placeholder="09170000000"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] text-xs font-mono text-left focus:outline-none focus:border-[#2C4A2E]"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    disabled={isTestingGateway}
                    onClick={handleTestGatewaySend}
                    className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{isTestingGateway ? 'در حال برقراری ارتباط با وب‌سرویس...' : 'ارسال پیامک تستی به این شماره'}</span>
                  </button>
                </div>

                {gatewayTestLog && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-xs font-bold text-emerald-900 leading-relaxed animate-in fade-in">
                    {gatewayTestLog}
                  </div>
                )}
              </div>

              {/* Service Line Notice */}
              <div className="p-5 rounded-3xl bg-[#F3EFE6] border border-[#E6E1D5] space-y-2 text-xs text-gray-600">
                <div className="flex items-center gap-1.5 font-black text-[#2C4A2E]">
                  <ShieldCheck className="w-4 h-4" />
                  <span>خط خدماتی بدون مسدودی بلک‌لیست:</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  تمامی پیامک‌های مربوط به اطلاع‌رسانی وضعیت سفارش و کد ورود OTP از طریق خطوط خدماتی یا وب‌سرویس پترن (مانند متد VerifyLookup کاوه‌نگار) ارسال می‌شوند و برای ۱۰۰٪ کاربران حتی شماره‌هایی که پیامک تبلیغاتی را مسدود کرده‌اند تحویل داده خواهد شد.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: MANUAL SMS BROADCAST & CAMPAIGN DISPATCH              */}
      {/* ============================================================ */}
      {activeTab === 'BROADCAST' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Composer (7 Cols) */}
            <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-7 border border-[#E6E1D5] shadow-farm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#F3EFE6]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#2C4A2E]/10 flex items-center justify-center text-[#2C4A2E]">
                    <Send className="w-4 h-4" />
                  </div>
                  <h3 className="font-black text-base text-[#2C4A2E]">
                    ارسال کمپین یا پیامک مناسبتی جدید
                  </h3>
                </div>
                <span className="text-xs text-gray-400 font-medium">
                  تخمین گیرندگان: <strong className="text-[#2C4A2E] font-bold">{toPersianDigits(getBroadcastRecipientEstimate())} شماره</strong>
                </span>
              </div>

              <form onSubmit={handleSendManualBroadcast} className="space-y-4 text-xs sm:text-sm">
                <div>
                  <label className="block text-gray-700 font-bold mb-1.5">
                    عنوان کمپین پیامکی (جهت رهگیری در پنل):
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: اعلام برداشت عسل کوهستان و نوبرانه گردوی سپیدان"
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E] text-gray-900 font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-gray-700 font-bold">
                    گروه هدف و دریافت‌کنندگان پیامک:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTargetSegment('ALL')}
                      className={`p-3 rounded-2xl border text-right transition-all cursor-pointer flex items-center gap-2.5 ${
                        targetSegment === 'ALL'
                          ? 'bg-[#2C4A2E] text-white border-[#2C4A2E] shadow-xs'
                          : 'bg-[#F9F8F5] text-gray-800 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <Users className="w-4 h-4 shrink-0" />
                      <div>
                        <div className="font-bold text-xs">همه خریداران سایت</div>
                        <div className={`text-[10px] ${targetSegment === 'ALL' ? 'text-gray-200' : 'text-gray-500'}`}>
                          تمام کاربران و اعضای ثبت‌نامی
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTargetSegment('PRO_MEMBERS')}
                      className={`p-3 rounded-2xl border text-right transition-all cursor-pointer flex items-center gap-2.5 ${
                        targetSegment === 'PRO_MEMBERS'
                          ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                          : 'bg-[#F9F8F5] text-gray-800 border-gray-200 hover:bg-amber-50/50'
                      }`}
                    >
                      <Crown className="w-4 h-4 shrink-0 text-amber-300" />
                      <div>
                        <div className="font-bold text-xs">مشترکین ویژه پرو (طلایی)</div>
                        <div className={`text-[10px] ${targetSegment === 'PRO_MEMBERS' ? 'text-amber-100' : 'text-gray-500'}`}>
                          اعضای تحویل ۶ روزه
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTargetSegment('PLUS_MEMBERS')}
                      className={`p-3 rounded-2xl border text-right transition-all cursor-pointer flex items-center gap-2.5 ${
                        targetSegment === 'PLUS_MEMBERS'
                          ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                          : 'bg-[#F9F8F5] text-gray-800 border-gray-200 hover:bg-emerald-50/50'
                      }`}
                    >
                      <Sparkles className="w-4 h-4 shrink-0 text-emerald-300" />
                      <div>
                        <div className="font-bold text-xs">مشترکین باشگاه پلاس</div>
                        <div className={`text-[10px] ${targetSegment === 'PLUS_MEMBERS' ? 'text-emerald-100' : 'text-gray-500'}`}>
                          اعضای تخفیف دائمی
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTargetSegment('SHIRAZ_BUYERS')}
                      className={`p-3 rounded-2xl border text-right transition-all cursor-pointer flex items-center gap-2.5 ${
                        targetSegment === 'SHIRAZ_BUYERS'
                          ? 'bg-sky-700 text-white border-sky-800 shadow-xs'
                          : 'bg-[#F9F8F5] text-gray-800 border-gray-200 hover:bg-sky-50/50'
                      }`}
                    >
                      <MapPin className="w-4 h-4 shrink-0 text-sky-300" />
                      <div>
                        <div className="font-bold text-xs">خریداران ساکن شیراز</div>
                        <div className={`text-[10px] ${targetSegment === 'SHIRAZ_BUYERS' ? 'text-sky-100' : 'text-gray-500'}`}>
                          تحویل پیک اختصاصی عصرگاهی
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {targetSegment === 'CUSTOM' && (
                  <div className="space-y-1">
                    <label className="block text-gray-700 font-bold text-xs">
                      شماره موبایل‌های دستی (با کاما یا خط جدید جدا کنید):
                    </label>
                    <textarea
                      rows={2}
                      value={customNumbersInput}
                      onChange={(e) => setCustomNumbersInput(e.target.value)}
                      placeholder="09171234567, 09351234567"
                      className="w-full p-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white text-xs font-mono"
                      dir="ltr"
                    />
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-gray-700 font-bold">متن پیامک ارسالی:</label>
                    <div className="text-[11px] font-bold text-gray-500">
                      <span>{toPersianDigits(broadcastCharCount)} کاراکتر</span>
                      <span className="mx-1">|</span>
                      <span className="text-[#2C4A2E]">{toPersianDigits(broadcastSmsPages)} پارت پیامک</span>
                    </div>
                  </div>
                  <textarea
                    rows={4}
                    required
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="متن پیامک را بنویسید..."
                    className="w-full p-3.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E] text-gray-900 leading-relaxed font-medium"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSendingBroadcast || !broadcastMessage.trim()}
                    className="px-7 py-3 rounded-2xl bg-[#2C4A2E] text-white font-bold text-xs sm:text-sm hover:bg-[#1E3520] shadow-md flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                  >
                    <Send className="w-4 h-4 text-[#D4A373]" />
                    <span>{isSendingBroadcast ? 'در حال ارسال به وب‌سرویس...' : 'ارسال قطعی به صف پیامک'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Ready Presets (5 Cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white rounded-3xl p-6 border border-[#E6E1D5] shadow-farm space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                  <FileText className="w-4 h-4 text-[#2C4A2E]" />
                  <h3 className="font-bold text-sm text-[#2C4A2E]">
                    قالب‌های پیشنهادی مزارع شیراز
                  </h3>
                </div>

                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setBroadcastTitle('برداشت نوبرانه عسل و گردوی سپیدان');
                      setBroadcastMessage('سلام همراه گرامی مزارع پروفارم؛ محصول عسل خالص کوهستان و گردوی نوبرانه سپیدان هم‌اکنون در سایت موجود شد. سفارش سریع:\nprofarm.ir');
                      setTargetSegment('ALL');
                    }}
                    className="w-full p-3 rounded-2xl bg-[#F9F8F5] hover:bg-emerald-50/60 border border-gray-200 hover:border-emerald-300 text-right transition-colors cursor-pointer group"
                  >
                    <div className="font-bold text-xs text-gray-900 group-hover:text-[#2C4A2E]">
                      اعلان محصول جدید و نوبرانه فصلی
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1 line-clamp-2">
                      سلام همراه گرامی مزارع پروفارم؛ محصول عسل خالص کوهستان و گردوی نوبرانه سپیدان هم‌اکنون در سایت موجود شد...
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBroadcastTitle('یادآوری سفارش روز چهارشنبه شیراز');
                      setBroadcastMessage('کاربر گرامی؛ توزیع سراسری محصولات تازه مزارع شیراز فردا چهارشنبه (۳ عصر الی ۹ شب) انجام می‌شود. ثبت سفارش قبل از تکمیل ظرفیت:\nprofarm.ir');
                      setTargetSegment('SHIRAZ_BUYERS');
                    }}
                    className="w-full p-3 rounded-2xl bg-[#F9F8F5] hover:bg-sky-50/60 border border-gray-200 hover:border-sky-300 text-right transition-colors cursor-pointer group"
                  >
                    <div className="font-bold text-xs text-gray-900 group-hover:text-sky-800">
                      یادآوری سفارش روز چهارشنبه (شیراز)
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1 line-clamp-2">
                      توزیع سراسری محصولات تازه مزارع شیراز فردا چهارشنبه (۳ عصر الی ۹ شب) انجام می‌شود...
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBroadcastTitle('سوپرآفر اختصاصی مشترکین پرو');
                      setBroadcastMessage('مشترک ارجمند پروفارم پرو؛ سبد ویژه تخم‌مرغ رسمی محلی و عرقیات دوآتشه با ۱۰٪ تخفیف مازاد برای شما فعال گردید:\nprofarm.ir/pro');
                      setTargetSegment('PRO_MEMBERS');
                    }}
                    className="w-full p-3 rounded-2xl bg-[#F9F8F5] hover:bg-amber-50/60 border border-gray-200 hover:border-amber-300 text-right transition-colors cursor-pointer group"
                  >
                    <div className="font-bold text-xs text-gray-900 group-hover:text-amber-800">
                      تخفیف ویژه و مازاد مشترکین پرو
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1 line-clamp-2">
                      مشترک ارجمند پروفارم پرو؛ سبد ویژه تخم‌مرغ رسمی محلی و عرقیات دوآتشه با ۱۰٪ تخفیف مازاد...
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* History Table */}
          <div className="bg-white rounded-3xl border border-[#E6E1D5] shadow-farm overflow-hidden space-y-4 p-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-[#2C4A2E]" />
                <h3 className="font-black text-base text-[#2C4A2E]">
                  سوابق پیامک‌های ارسالی دستی و گزارش تحویل
                </h3>
              </div>
              <span className="text-xs text-gray-500">
                {toPersianDigits(broadcasts.length)} کمپین ثبت‌شده
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-[#F9F8F5] border-b border-[#E6E1D5] text-[#2C4A2E]">
                  <tr>
                    <th className="py-3.5 px-4 font-black">عنوان کمپین</th>
                    <th className="py-3.5 px-4 font-black">گروه دریافت‌کننده</th>
                    <th className="py-3.5 px-4 font-black">تعداد گیرندگان</th>
                    <th className="py-3.5 px-4 font-black min-w-[280px]">متن پیامک</th>
                    <th className="py-3.5 px-4 font-black">تاریخ و زمان ارسال</th>
                    <th className="py-3.5 px-4 font-black">وضعیت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {broadcasts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-500">
                        تاکنون هیچ کمپین پیامکی ارسال نشده است.
                      </td>
                    </tr>
                  ) : (
                    broadcasts.map((b) => (
                      <tr key={b.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-gray-900">
                          {b.title}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700">
                            {b.targetSegment}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 font-black text-[#2C4A2E]">
                          {toPersianDigits(b.recipientCount)} شماره
                        </td>

                        <td className="py-3.5 px-4 text-gray-700 leading-relaxed font-medium min-w-[280px]">
                          {b.message}
                        </td>

                        <td className="py-3.5 px-4 text-gray-500">
                          {b.sentAt}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>ارسال موفق</span>
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 4: DIRECT EMAIL BROADCAST, LOGS & SMTP GATEWAY SETTINGS  */}
      {/* ============================================================ */}
      {activeTab === 'EMAIL' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Subtab Navigation Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-2xl bg-white border border-[#E6E1D5] shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setEmailSubTab('COMPOSE')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  emailSubTab === 'COMPOSE'
                    ? 'bg-[#2C4A2E] text-white shadow-xs'
                    : 'text-gray-600 hover:bg-[#F9F8F5]'
                }`}
              >
                <Mail className="w-4 h-4 text-[#D4A373]" />
                <span>نگارش و تاریخچه ایمیل‌ها</span>
              </button>

              <button
                type="button"
                onClick={() => setEmailSubTab('SETTINGS')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  emailSubTab === 'SETTINGS'
                    ? 'bg-[#2C4A2E] text-white shadow-xs'
                    : 'text-gray-600 hover:bg-[#F9F8F5]'
                }`}
              >
                <Key className="w-4 h-4 text-[#D4A373]" />
                <span>تنظیمات سرور SMTP و تست ارسال واقعی</span>
                {emailSettings.smtpPass && emailSettings.smtpUser ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" title="تنظیمات ذخیره شده" />
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 font-bold">نیاز به رمز عبور</span>
                )}
              </button>
            </div>

            {/* Quick Status Pill */}
            <div className="flex items-center gap-2 text-xs">
              <span className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border flex items-center gap-1.5 shadow-2xs ${
                emailSettings.provider === 'SMTP' && emailSettings.smtpHost && emailSettings.smtpUser
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}>
                <Server className="w-3.5 h-3.5" />
                <span>
                  {emailSettings.provider === 'SMTP' && emailSettings.smtpHost && emailSettings.smtpUser
                    ? `سرور SMTP فعال: ${emailSettings.smtpHost}`
                    : 'ارسال شبیه‌ساز (Mock)'}
                </span>
              </span>
            </div>
          </div>

          {/* SUBTAB 1: COMPOSE & EMAIL LOGS */}
          {emailSubTab === 'COMPOSE' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Email Compose Form */}
                <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-[#E6E1D5] shadow-xs space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-[#F3EFE6]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-[#2C4A2E]/10 flex items-center justify-center text-[#2C4A2E]">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-[#2C4A2E]">
                          نگارش و ارسال ایمیل رسمی
                        </h2>
                        <p className="text-xs text-gray-500">
                          ارسال به صورت تکی یا همگانی با قالب HTML گرافیکی مزارع پروفارم شیراز
                        </p>
                      </div>
                    </div>

                    <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                      سیستم ارسال فعال ✓
                    </span>
                  </div>

                  <form onSubmit={handleSendAdminEmail} className="space-y-4 text-xs">
                    {/* Target Segment */}
                    <div>
                      <label className="block text-gray-700 font-bold mb-1.5">
                        جامعه هدف دریافت‌کنندگان:
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setEmailTarget('ALL')}
                          className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                            emailTarget === 'ALL'
                              ? 'border-[#2C4A2E] bg-[#2C4A2E]/5 font-bold text-[#2C4A2E]'
                              : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                          }`}
                        >
                          <span>همه کاربران دارای ایمیل</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEmailTarget('USER')}
                          className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                            emailTarget === 'USER'
                              ? 'border-[#2C4A2E] bg-[#2C4A2E]/5 font-bold text-[#2C4A2E]'
                              : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                          }`}
                        >
                          <span>انتخاب کاربر خاص</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEmailTarget('CUSTOM')}
                          className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                            emailTarget === 'CUSTOM'
                              ? 'border-[#2C4A2E] bg-[#2C4A2E]/5 font-bold text-[#2C4A2E]'
                              : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                          }`}
                        >
                          <span>ایمیل دلخواه</span>
                        </button>
                      </div>
                    </div>

                    {/* Conditional Recipient Inputs */}
                    {emailTarget === 'USER' && (
                      <div>
                        <label className="block text-gray-700 font-bold mb-1.5">
                          انتخاب کاربر مقصد:
                        </label>
                        <select
                          value={selectedUserEmail}
                          onChange={(e) => setSelectedUserEmail(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E] font-medium"
                        >
                          {registeredUsersList
                            .filter((u) => u.email)
                            .map((u) => (
                              <option key={u.id} value={u.email!}>
                                {u.name || 'بدون نام'} ({u.email}) - {u.tier === 'PRO' ? 'مشترک پرو' : u.tier === 'PLUS' ? 'مشترک پلاس' : 'عادی'}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}

                    {emailTarget === 'CUSTOM' && (
                      <div>
                        <label className="block text-gray-700 font-bold mb-1.5">
                          آدرس ایمیل گیرنده:
                        </label>
                        <input
                          type="email"
                          required
                          placeholder="client@example.com"
                          value={emailRecipientInput}
                          onChange={(e) => setEmailRecipientInput(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E] font-mono dir-ltr text-right"
                        />
                      </div>
                    )}

                    {/* Subject */}
                    <div>
                      <label className="block text-gray-700 font-bold mb-1.5">
                        موضوع ایمیل:
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="مثال: اطلاعیه تحویل سبد هفتگی ارگانیک مزارع شیراز"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E] font-medium"
                      />
                    </div>

                    {/* Content */}
                    <div>
                      <label className="block text-gray-700 font-bold mb-1.5">
                        متن پیام ایمیل:
                      </label>
                      <textarea
                        rows={5}
                        required
                        placeholder="متن پیام خود را اینجا بنویسید. این متن در قالب زیبا و رسمی مزارع پروفارم شیراز جاسازی خواهد شد..."
                        value={emailContent}
                        onChange={(e) => setEmailContent(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E] font-medium leading-relaxed"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSendingEmail}
                      className="w-full py-3 rounded-2xl bg-[#2C4A2E] hover:bg-[#1E3320] text-white font-bold flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50 cursor-pointer text-sm"
                    >
                      {isSendingEmail ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>در حال ارسال ایمیل...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 text-[#D4A373]" />
                          <span>ارسال ایمیل رسمی</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* Right: Live Email Visual Preview */}
                <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-[#E6E1D5] shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#F3EFE6]">
                    <div className="flex items-center gap-2 text-[#2C4A2E]">
                      <Sparkles className="w-4 h-4 text-[#D4A373]" />
                      <h3 className="text-sm font-bold">پیش‌نمایش قالب ایمیل ارسالی</h3>
                    </div>
                    <span className="text-[11px] text-gray-400">قالب ریسپانسیو HTML</span>
                  </div>

                  {/* Mock Email Canvas */}
                  <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-xs bg-[#F9F8F5] p-3">
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden text-right shadow-2xs">
                      {/* Header */}
                      <div className="bg-[#2C4A2E] p-4 text-center border-b-2 border-[#D4A373]">
                        <h4 className="text-white font-black text-sm">مزارع ارگانیک پروفارم شیراز</h4>
                        <p className="text-[10px] text-[#D4A373] mt-0.5 font-bold">توزیع مستقیم فرآورده‌های تازه و سالم مزارع فارس</p>
                      </div>

                      {/* Body */}
                      <div className="p-4 space-y-3 text-xs">
                        <div className="text-gray-800 font-bold">
                          سلام جناب/سرکار {emailTarget === 'USER' ? (registeredUsersList.find(u => u.email === selectedUserEmail)?.name || 'کاربر گرامی') : 'مشتری گرامی'}،
                        </div>

                        <div className="p-2.5 rounded-lg bg-gray-50 border-r-3 border-[#2C4A2E] font-bold text-gray-900 text-[11px]">
                          {emailSubject || 'موضوع ایمیل ارسالی در این بخش قرار می‌گیرد'}
                        </div>

                        <div className="text-gray-600 leading-relaxed whitespace-pre-line text-[11px] min-h-[60px]">
                          {emailContent || 'متن پیامی که در کادر بالا می‌نویسید، با تایپوگرافی شکیل و چیدمان استاندارد در این قسمت به مخاطب نمایش داده می‌شود.'}
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="bg-[#FAF8F5] p-3 border-t border-gray-100 text-center text-[9px] text-gray-400 space-y-0.5">
                        <p>پروفارم شیراز | ارسال با زنجیره سرد پیک اختصاصی درب منزل در شیراز</p>
                        <p>تلفن پشتیبانی: ۰۷۱۳۶۲۸۰۰۰۰</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <p>
                      قابلیت جایگزینی خودکار (Fallback): در صورت بروز هرگونه اختلال در خطوط پیامکی، سامانه به‌صورت هوشمند پیام را از طریق این قالب ایمیل ارسال می‌کند.
                    </p>
                  </div>
                </div>
          </div>

          {/* Email Logs History Table */}
          <div className="bg-white rounded-3xl p-6 border border-[#E6E1D5] shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F3EFE6]">
              <div className="flex items-center gap-2.5">
                <History className="w-5 h-5 text-[#2C4A2E]" />
                <h3 className="text-base font-bold text-[#2C4A2E]">
                  تاریخچه و گزارش ایمیل‌های ارسالی سیستم ({toPersianDigits(emailLogs.length)})
                </h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-[#FAF8F5] text-gray-600 border-b border-[#E6E1D5]">
                    <th className="py-3 px-4 font-bold">گیرنده</th>
                    <th className="py-3 px-4 font-bold">موضوع ایمیل</th>
                    <th className="py-3 px-4 font-bold">متن خلاصه</th>
                    <th className="py-3 px-4 font-bold">نوع ارسال</th>
                    <th className="py-3 px-4 font-bold">وضعیت</th>
                    <th className="py-3 px-4 font-bold">تاریخ و زمان</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3EFE6]">
                  {emailLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-gray-400">
                        تاکنون هیچ ایمیلی در سیستم ثبت نگردیده است.
                      </td>
                    </tr>
                  ) : (
                    emailLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-gray-900">
                          <div>{log.recipientName || 'کاربر'}</div>
                          <div className="text-[11px] font-mono text-gray-500 dir-ltr text-right">{log.to}</div>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-[#2C4A2E]">
                          {log.subject}
                        </td>
                        <td className="py-3.5 px-4 text-gray-600 max-w-[260px] truncate">
                          {log.body}
                        </td>
                        <td className="py-3.5 px-4">
                          {log.fallbackForSms ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              <AlertCircle className="w-3 h-3 text-amber-600" />
                              جایگزین خودکار پیامک
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                              <Mail className="w-3 h-3 text-blue-600" />
                              ارسال مستقیم
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {log.status === 'SENT' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              ارسال‌شده
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              ناموفق
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-gray-500 font-mono text-[11px]">
                          {(() => {
                            try {
                              if (!log.createdAt) return '-';
                              const d = new Date(log.createdAt);
                              if (isNaN(d.getTime())) return '-';
                              return `${d.toLocaleDateString('fa-IR')} ${d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}`;
                            } catch {
                              return '-';
                            }
                          })()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: SMTP PROVIDER SETTINGS & LIVE TEST CONNECTION */}
      {emailSubTab === 'SETTINGS' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: SMTP Configuration Form */}
            <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-[#E6E1D5] shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#F3EFE6]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#2C4A2E]/10 flex items-center justify-center text-[#2C4A2E]">
                    <Key className="w-5 h-5 text-[#D4A373]" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#2C4A2E]">
                      تنظیمات وب‌سرویس و سرور SMTP ایمیل
                    </h2>
                    <p className="text-xs text-gray-500">
                      اتصال مستقیم به سرورهای ایمیل گوگل (جیمیل)، وب‌میل هاست دامنه‌ای یا میل‌سرور اختصاصی
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailSettings.isEnabled}
                      onChange={(e) => setEmailSettings((prev) => ({ ...prev, isEnabled: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2C4A2E]"></div>
                  </label>
                  <span className="text-xs font-bold text-gray-700">
                    {emailSettings.isEnabled ? 'سرویس فعال' : 'سرویس غیرفعال'}
                  </span>
                </div>
              </div>

              <form onSubmit={handleSaveEmailSettings} className="space-y-4 text-xs">
                {/* Provider Selector */}
                <div>
                  <label className="block text-gray-700 font-bold mb-1.5">
                    نوع ارائه‌دهنده سرویس:
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setEmailSettings((prev) => ({ ...prev, provider: 'SMTP' }))}
                      className={`p-3 rounded-2xl border text-right flex items-center justify-between transition-all cursor-pointer ${
                        emailSettings.provider === 'SMTP'
                          ? 'border-[#2C4A2E] bg-[#2C4A2E]/5 font-bold text-[#2C4A2E]'
                          : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                      }`}
                    >
                      <div>
                        <div className="font-black text-xs">سرور SMTP اختصاصی / جیمیل</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">ارسال واقعی ایمیل به صندوق ورودی مخاطبین</div>
                      </div>
                      <Server className="w-4 h-4 text-[#D4A373] shrink-0" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setEmailSettings((prev) => ({ ...prev, provider: 'MOCK' }))}
                      className={`p-3 rounded-2xl border text-right flex items-center justify-between transition-all cursor-pointer ${
                        emailSettings.provider === 'MOCK'
                          ? 'border-[#2C4A2E] bg-[#2C4A2E]/5 font-bold text-[#2C4A2E]'
                          : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                      }`}
                    >
                      <div>
                        <div className="font-black text-xs">حالت شبیه‌ساز (Mock / Local)</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">ثبت در دیتابیس بدون اتصال اینترنتی به سرور</div>
                      </div>
                      <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                    </button>
                  </div>
                </div>

                {/* 1-Click Quick Provider Presets */}
                <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/70">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                      <span>⚡</span> انتخاب سریع تنظیمات سرور بر اساس سرویس‌دهنده ایمیل شما:
                    </span>
                    <span className="text-[10px] text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-full font-medium">تنظیم ۱-کلیک</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEmailSettings((prev) => ({
                          ...prev,
                          provider: 'SMTP',
                          smtpHost: 'smtp.gmail.com',
                          smtpPort: 587,
                          smtpSecure: false,
                        }));
                      }}
                      className="py-2 px-2.5 rounded-xl border border-amber-200 bg-white hover:border-[#2C4A2E] hover:bg-[#2C4A2E]/5 text-center transition-all cursor-pointer font-bold text-[11px] text-gray-800 shadow-sm"
                    >
                      📧 Google / Gmail
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmailSettings((prev) => ({
                          ...prev,
                          provider: 'SMTP',
                          smtpHost: 'smtp-mail.outlook.com',
                          smtpPort: 587,
                          smtpSecure: false,
                        }));
                      }}
                      className="py-2 px-2.5 rounded-xl border border-amber-200 bg-white hover:border-[#2C4A2E] hover:bg-[#2C4A2E]/5 text-center transition-all cursor-pointer font-bold text-[11px] text-gray-800 shadow-sm"
                    >
                      📨 Outlook / Live
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmailSettings((prev) => ({
                          ...prev,
                          provider: 'SMTP',
                          smtpHost: 'smtp.mail.yahoo.com',
                          smtpPort: 465,
                          smtpSecure: true,
                        }));
                      }}
                      className="py-2 px-2.5 rounded-xl border border-amber-200 bg-white hover:border-[#2C4A2E] hover:bg-[#2C4A2E]/5 text-center transition-all cursor-pointer font-bold text-[11px] text-gray-800 shadow-sm"
                    >
                      📬 Yahoo Mail
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmailSettings((prev) => ({
                          ...prev,
                          provider: 'SMTP',
                          smtpHost: 'mail.profarm-shiraz.ir',
                          smtpPort: 465,
                          smtpSecure: true,
                        }));
                      }}
                      className="py-2 px-2.5 rounded-xl border border-amber-200 bg-white hover:border-[#2C4A2E] hover:bg-[#2C4A2E]/5 text-center transition-all cursor-pointer font-bold text-[11px] text-gray-800 shadow-sm"
                    >
                      🌐 هاست اختصاصی / cPanel
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Host */}
                  <div>
                    <label className="block text-gray-700 font-bold mb-1.5">
                      هاست سرور SMTP (Server Host):
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="smtp.gmail.com یا mail.profarm.ir"
                      value={emailSettings.smtpHost}
                      onChange={(e) => setEmailSettings((prev) => ({ ...prev, smtpHost: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E] font-mono dir-ltr text-right"
                    />
                  </div>

                  {/* Port */}
                  <div>
                    <label className="block text-gray-700 font-bold mb-1.5">
                      پورت ارتباطی (Port):
                    </label>
                    <input
                      type="number"
                      required
                      placeholder="587 یا 465"
                      value={emailSettings.smtpPort}
                      onChange={(e) => setEmailSettings((prev) => ({ ...prev, smtpPort: parseInt(e.target.value, 10) || 587 }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E] font-mono dir-ltr text-right"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">پورت ۵۸۷ برای STARTTLS و پورت ۴۶۵ برای SSL مستقیم</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Username */}
                  <div>
                    <label className="block text-gray-700 font-bold mb-1.5">
                      نام کاربری سرور / ایمیل ورود:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="your-email@gmail.com"
                      value={emailSettings.smtpUser}
                      onChange={(e) => {
                        const val = e.target.value;
                        const lower = val.toLowerCase();
                        setEmailSettings((prev) => {
                          let autoHost = prev.smtpHost;
                          let autoPort = prev.smtpPort;
                          let autoSecure = prev.smtpSecure;

                          if (lower.endsWith('@gmail.com')) {
                            autoHost = 'smtp.gmail.com';
                            autoPort = 587;
                            autoSecure = false;
                          } else if (lower.endsWith('@yahoo.com')) {
                            autoHost = 'smtp.mail.yahoo.com';
                            autoPort = 465;
                            autoSecure = true;
                          } else if (lower.endsWith('@outlook.com') || lower.endsWith('@hotmail.com')) {
                            autoHost = 'smtp-mail.outlook.com';
                            autoPort = 587;
                            autoSecure = false;
                          }

                          return {
                            ...prev,
                            smtpUser: val,
                            smtpHost: autoHost,
                            smtpPort: autoPort,
                            smtpSecure: autoSecure,
                            fromEmail: (!prev.fromEmail || prev.fromEmail === 'info@profarm-shiraz.ir') ? val : prev.fromEmail,
                          };
                        });
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E] font-mono dir-ltr text-right"
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-gray-700 font-bold">
                        رمز عبور یا App Password:
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                        className="text-gray-400 hover:text-gray-600 flex items-center gap-1 text-[11px] cursor-pointer"
                      >
                        {showSmtpPassword ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>مخفی</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            <span>نمایش</span>
                          </>
                        )}
                      </button>
                    </div>
                    <input
                      type={showSmtpPassword ? 'text' : 'password'}
                      placeholder="رمز عبور برنامه (۱۶ رقمی برای Gmail)"
                      value={emailSettings.smtpPass}
                      onChange={(e) => setEmailSettings((prev) => ({ ...prev, smtpPass: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E] font-mono dir-ltr text-right"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* From Name */}
                  <div>
                    <label className="block text-gray-700 font-bold mb-1.5">
                      نام فرستنده نمایشی (Sender Name):
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="مزارع ارگانیک پروفارم شیراز"
                      value={emailSettings.fromName}
                      onChange={(e) => setEmailSettings((prev) => ({ ...prev, fromName: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E] font-medium"
                    />
                  </div>

                  {/* From Email */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-gray-700 font-bold">
                        آدرس ایمیل فرستنده اصلی (From Email):
                      </label>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                        فرستنده کلیه پیام‌های مشتریان
                      </span>
                    </div>
                    <input
                      type="email"
                      placeholder="info@profarm-shiraz.ir یا ایمیل اختصاصی شما"
                      value={emailSettings.fromEmail}
                      onChange={(e) => setEmailSettings((prev) => ({ ...prev, fromEmail: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E] font-mono dir-ltr text-right"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                      تمامی ایمیل‌های فاکتور سفارش، وضعیت مرسوله، کدهای تایید OTP و پاسخ کاربران با این نشانی ارسال و دریافت خواهند شد.
                    </p>
                  </div>
                </div>

                {/* SSL / Secure switch */}
                <div className="p-3 rounded-2xl bg-[#F9F8F5] border border-[#E6E1D5] flex items-center justify-between">
                  <div>
                    <span className="font-bold text-gray-800">استفاده از اتصال رمزنگاری مستقیم SSL (پورت ۴۶۵)</span>
                    <p className="text-[11px] text-gray-500 mt-0.5">در صورت استفاده از پورت ۵۸۷، اتصال به طور خودکار از نوع STARTTLS خواهد بود.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailSettings.smtpSecure}
                      onChange={(e) => setEmailSettings((prev) => ({ ...prev, smtpSecure: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#2C4A2E]"></div>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isSavingEmailSettings}
                  className="w-full py-3 rounded-2xl bg-[#2C4A2E] hover:bg-[#1E3320] text-white font-bold flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50 cursor-pointer text-sm"
                >
                  {isSavingEmailSettings ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>در حال ذخیره تنظیمات...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 text-[#D4A373]" />
                      <span>ذخیره تنظیمات وب‌سرویس ایمیل</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Right: Live Test & Step-by-Step Setup Guide */}
            <div className="lg:col-span-5 space-y-6">
              {/* Live Test Connection Card */}
              <div className="bg-white rounded-3xl p-6 border border-[#E6E1D5] shadow-xs space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-[#F3EFE6]">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#2C4A2E]">
                      تست اتصال و ارسال ایمیل زنده
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      ارسال یک ایمیل تستی برای اطمینان از عملکرد صحیح پروتکل SMTP
                    </p>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-gray-700 font-bold mb-1.5">
                      آدرس ایمیل دریافت‌کننده تست:
                    </label>
                    <input
                      type="email"
                      placeholder="your-personal@email.com"
                      value={testEmailRecipient}
                      onChange={(e) => setTestEmailRecipient(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E1D5] bg-[#F9F8F5] focus:bg-white focus:outline-none focus:border-[#2C4A2E] font-mono dir-ltr text-right"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleTestEmailConnection}
                    disabled={isTestingEmail}
                    className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold flex items-center justify-center gap-2 transition-all shadow-xs disabled:opacity-50 cursor-pointer text-xs"
                  >
                    {isTestingEmail ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>در حال برقراری ارتباط با سرور...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 text-[#D4A373]" />
                        <span>تست اتصال و ارسال ایمیل آزمایشی</span>
                      </>
                    )}
                  </button>

                  {emailTestLog && (
                    <div className={`p-3.5 rounded-2xl border text-xs leading-relaxed animate-in fade-in ${
                      emailTestLog.success
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        : 'bg-rose-50 border-rose-300 text-rose-900'
                    }`}>
                      <div className="flex items-center gap-2 font-bold mb-1">
                        {emailTestLog.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        <span>{emailTestLog.success ? 'اتصال موفقیت‌آمیز بود ✓' : 'خطا در برقراری اتصال'}</span>
                      </div>
                      <p className="text-[11px] mt-1">{emailTestLog.message}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Gmail & Hosting Instructions Guide */}
              <div className="bg-[#FAF8F5] rounded-3xl p-6 border border-[#E6E1D5] shadow-xs space-y-4 text-xs">
                <div className="flex items-center gap-2.5 text-[#2C4A2E] font-black text-sm pb-2 border-b border-[#E6E1D5]">
                  <HelpCircle className="w-4 h-4 text-[#D4A373]" />
                  <span>راهنمای راه‌اندازی سریع با Gmail (رایگان)</span>
                </div>

                <div className="space-y-3 text-gray-700 leading-relaxed">
                  <p className="text-[11px]">
                    گوگل به دلایل امنیتی اجازه استفاده از رمز ورود عادی اکانت را نمی‌دهد. برای اتصال جیمیل به سامانه، کافی است در کمتر از ۱ دقیقه یک <strong>App Password</strong> بسازید:
                  </p>

                  <ol className="list-decimal list-inside space-y-1.5 text-[11px] font-medium text-gray-800 bg-white p-3.5 rounded-xl border border-[#E6E1D5]">
                    <li>به حساب گوگل خود در <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" className="text-blue-600 underline inline-flex items-center gap-0.5">صفحه امنیت گوگل <ExternalLink className="w-2.5 h-2.5" /></a> مراجعه فرمایید.</li>
                    <li>مطمئن شوید گزینه <strong>2-Step Verification</strong> (تایید دو مرحله‌ای) روشن است.</li>
                    <li>در کادر جستجوی بالای صفحه حساب گوگل، عبارت <strong>App passwords</strong> را جستجو و باز کنید.</li>
                    <li>یک نام دلخواه مانند <code className="bg-gray-100 px-1 py-0.5 rounded font-mono font-bold">ProFarm</code> وارد کرده و دکمه Create را بزنید.</li>
                    <li>کد ۱۶ حرفی ایجاد شده را کپی کرده و در فیلد «رمز عبور یا App Password» این صفحه قرار دهید.</li>
                    <li>هاست را <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">smtp.gmail.com</code> و پورت را <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">587</code> وارد نمایید.</li>
                  </ol>

                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-[11px] flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>استفاده از ایمیل وب‌میل هاست خودتان:</strong>
                      <p className="mt-0.5">برای هاست‌های cPanel یا دایرکت‌ادمین، هاست معمولاً <code className="font-mono">mail.yourdomain.ir</code> و پورت <code className="font-mono">465</code> (با تیک SSL) است.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
        </div>
      )}
    </div>
  );
}

export default function AdminSmsPage() {
  return (
    <SmsPageErrorBoundary>
      <AdminSmsPageContent />
    </SmsPageErrorBoundary>
  );
}

