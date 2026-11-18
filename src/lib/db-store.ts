/**
 * Unified data store for Pro Farm.
 * Seamlessly manages Products, Orders, Delivery Slots, Users, and Pro Memberships.
 */
import 'server-only';
import crypto from 'crypto';
import fs from 'fs';
import net from 'net';
import path from 'path';
import {
  Address,
  Product,
  Order,
  OrderItem,
  Payment,
  DeliverySlot,
  AvailableDeliverySlot,
  User,
  BulkInquiry,
  OrderStatus,
  SiteContent,
  SubscriptionTier,
  SubscriptionSettings,
  SubscriptionStats,
  FaqItem,
  ComparisonRow,
  FinancialRecord,
  FinancialSummary,
  CategoryRevenue,
  TierRevenue,
  GatewayRevenue,
  MonthlyFinancialStat,
  WeeklyDayStat,
  DailyShiftStat,
  ProductStatus,
  Coupon,
  CouponTargetType,
  CouponDiscountType,
  CouponValidationResult,
  CartItem,
  DailyCapacityItem,
  PaymentSettings,
  ZarinPalSettings,
  SnappPaySettings,
  GeneralPaymentSettings,
  ReturnRequest,
  ReturnStatus,
  SmsBroadcast,
  SmsTargetSegment,
  SmsEventType,
  SmsEventTemplate,
  SmsProviderType,
  SmsProviderSettings,
  UserRole,
  ProductReview,
  ReviewStatus,
  EmailMessageLog,
  EmailProviderSettings,
} from '@/types';
import {
  INITIAL_PRODUCTS,
  INITIAL_ADMIN_ORDERS,
  INITIAL_CATEGORIES,
  DEFAULT_SMS_EVENT_TEMPLATES,
  INITIAL_PRODUCT_REVIEWS,
} from './initial-data';
import {
  generateDeliverySlots,
  formatToJalali,
  formatIsoDateToJalali,
  PERSIAN_MONTHS,
  PERSIAN_WEEKDAYS,
  DEFAULT_DAILY_CAPACITY,
  MAX_BOOKING_DAYS_AHEAD,
  DEFAULT_SLOT_WINDOW,
  SLOT_TIME_LABEL,
  buildSlotId,
  parseSlotId,
  parseTehranDateValue,
  getTehranIsoDate,
  addDaysIso,
  isDayAllowedForUser,
} from './jalali';
import { sendOrderStatusSms, sendCustomSms } from './sms';
import {
  isCountableSaleOrder,
  canTransition,
  canTransitionReturn,
  isCodOrder,
} from './order-utils';
import { getEffectiveTier, getSubscriptionExpiryMs } from './subscription';
import {
  generateSeoSlug,
  generateProductSeoTitle,
  generateProductSeoDescription,
  generateProductSeoKeywords,
} from './seo-utils';
import { hashPassword, verifyPassword, needsPasswordRehash } from './password';
import {
  getDeduplicatedPerks,
  normalizePhoneNumber,
  isValidEmail,
  isValidIranPhone,
  toEnglishDigits,
  formatSubscriptionExpiry,
  getEggsPerPack,
  isEggProduct,
} from './formatters';
import { BusinessError } from './api-errors';
import { isOrderLocked, withOrderLock } from './order-lock';
import {
  DEFAULT_FAQ_ITEMS,
  DEFAULT_COMPARISON_ROWS,
  DEFAULT_SUBSCRIPTION_SETTINGS,
  DEFAULT_SMS_PROVIDER_SETTINGS,
  DEFAULT_EMAIL_PROVIDER_SETTINGS,
  DEFAULT_PAYMENT_SETTINGS,
  DEFAULT_SITE_CONTENT,
  INITIAL_COUPONS,
} from './store-defaults';
export { DEFAULT_FAQ_ITEMS, DEFAULT_COMPARISON_ROWS, DEFAULT_SUBSCRIPTION_SETTINGS, DEFAULT_SMS_PROVIDER_SETTINGS, DEFAULT_EMAIL_PROVIDER_SETTINGS, DEFAULT_PAYMENT_SETTINGS, DEFAULT_SITE_CONTENT, INITIAL_COUPONS } from './store-defaults';
import {
  resolveInitialAdminPassword,
  getEnvAdminPassword,
  isLegacyAdminHash,
  generateUnguessableAdminPassword,
  saveGeneratedAdminCredentials,
} from './admin-bootstrap';

/** Extra minutes after the payment window before an unpaid online order is released (late gateway callbacks). */
const PAYMENT_EXPIRY_GRACE_MS = 5 * 60 * 1000;

export function sanitizeUser(user: User): User {
  const { password, ...safeUser } = user;
  return safeUser as User;
}

// Persistent in-process memory stores
const COUPON_TARGET_TYPES: Coupon['targetType'][] = ['ALL_PRODUCTS', 'SPECIFIC_PRODUCT', 'SHIPPING'];
const COUPON_DISCOUNT_TYPES: Coupon['discountType'][] = ['PERCENTAGE', 'FIXED_AMOUNT'];

function normalizeCouponDate(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value).trim();
  if (parseTehranDateValue(s, false) === null) {
    throw new BusinessError(`${label} نامعتبر است.`, 400);
  }
  return s;
}

/**
 * Whitelists and validates coupon fields that come from the admin API. Unknown keys (id, usageCount, createdAt, ...)
 * are ignored, so they can never be set from a request.
 */
function sanitizeCouponFields(input: Record<string, unknown>): Partial<Coupon> {
  const out: Partial<Coupon> = {};
  const num = (v: unknown, label: string): number | undefined => {
    if (v === null || v === undefined || v === '') return undefined;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) throw new BusinessError(`مقدار «${label}» نامعتبر است.`, 400);
    return n;
  };

  if (typeof input.code === 'string') {
    const code = input.code.trim().toUpperCase();
    if (!code || code.length > 40 || /\s/.test(code)) {
      throw new BusinessError('کد تخفیف نامعتبر است.', 400);
    }
    out.code = code;
  }
  if ('title' in input) out.title = String(input.title ?? '').trim().slice(0, 200);
  if ('description' in input) out.description = String(input.description ?? '').trim().slice(0, 1000);
  if ('targetType' in input) {
    if (!COUPON_TARGET_TYPES.includes(input.targetType as Coupon['targetType'])) {
      throw new BusinessError('نوع هدف کد تخفیف نامعتبر است.', 400);
    }
    out.targetType = input.targetType as Coupon['targetType'];
  }
  if ('targetProductId' in input) out.targetProductId = input.targetProductId ? String(input.targetProductId) : undefined;
  if ('targetProductName' in input) {
    out.targetProductName = input.targetProductName ? String(input.targetProductName).slice(0, 200) : undefined;
  }
  if ('discountType' in input) {
    if (!COUPON_DISCOUNT_TYPES.includes(input.discountType as Coupon['discountType'])) {
      throw new BusinessError('نوع تخفیف نامعتبر است.', 400);
    }
    out.discountType = input.discountType as Coupon['discountType'];
  }
  if ('discountValue' in input) {
    const v = num(input.discountValue, 'مقدار تخفیف');
    if (v === undefined) throw new BusinessError('مقدار تخفیف الزامی است.', 400);
    out.discountValue = v;
  }
  if ('minOrderAmount' in input) out.minOrderAmount = num(input.minOrderAmount, 'حداقل خرید');
  if ('maxDiscountAmount' in input) out.maxDiscountAmount = num(input.maxDiscountAmount, 'سقف تخفیف');
  if ('usageLimit' in input) out.usageLimit = num(input.usageLimit, 'سقف استفاده');
  if ('perUserLimit' in input) out.perUserLimit = num(input.perUserLimit, 'سقف استفاده هر کاربر');
  if ('isActive' in input) out.isActive = Boolean(input.isActive);
  if ('startsAt' in input) out.startsAt = normalizeCouponDate(input.startsAt, 'تاریخ شروع');
  if ('expiresAt' in input) out.expiresAt = normalizeCouponDate(input.expiresAt, 'تاریخ انقضا');
  return out;
}

/** Percentages are clamped to 0..100 and no value is negative. */
function clampCouponValues(c: Coupon): Coupon {
  const next = { ...c };
  const value = Number(next.discountValue);
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
  next.discountValue = next.discountType === 'PERCENTAGE' ? Math.min(100, safe) : safe;
  if (next.maxDiscountAmount !== undefined && next.maxDiscountAmount !== null) {
    next.maxDiscountAmount = Math.max(0, Number(next.maxDiscountAmount) || 0);
  }
  return next;
}

class FarmDataStore {
  private products: Product[] = [...INITIAL_PRODUCTS];
  private orders: Order[] = [...INITIAL_ADMIN_ORDERS];
  private users: Map<string, User> = new Map();
  // Generated dev admin password waiting to be saved (set only when no admin is stored yet)
  private pendingAdminCredentials: { user: User; password: string } | null = null;
  private bulkInquiries: BulkInquiry[] = [];
  private categories: string[] = [...INITIAL_CATEGORIES];
  private siteContent: SiteContent = { ...DEFAULT_SITE_CONTENT };
  private subscriptionSettings: SubscriptionSettings = { ...DEFAULT_SUBSCRIPTION_SETTINGS };
  private coupons: Coupon[] = [...INITIAL_COUPONS];
  private paymentSettings: PaymentSettings = { ...DEFAULT_PAYMENT_SETTINGS };
  private returnRequests: ReturnRequest[] = [
    {
      id: 'ret-101',
      orderNumber: 'PRF-1405-8821',
      customerName: 'سارا نامدار',
      customerPhone: '09171234567',
      productTitle: 'تخم‌مرغ محلی ارگانیک کامفیروز (۳۰ عددی)',
      quantity: 1,
      reason: 'DAMAGE_IN_TRANSIT',
      reasonTitle: 'شکستگی ۵ عدد تخم‌مرغ در حین حمل پیک',
      description: 'هنگام تحویل بسته تخم‌مرغ توسط پیک، راننده بسته را بررسی کرد و ۵ عدد تخم‌مرغ ترک خورده بود.',
      refundAmount: 65000,
      status: 'APPROVED',
      adminNotes: 'تایید شد و هماهنگ شد در خرید بعدی یا به شماره شبا واریز گردد.',
      createdAt: '۱۴۰۵/۰۶/۱۴ - ۱۰:۳۰',
      updatedAt: '۱۴۰۵/۰۶/۱۴ - ۱۱:۱۵',
    },
    {
      id: 'ret-102',
      orderNumber: 'PRF-1405-3419',
      customerName: 'رضا کمالی',
      customerPhone: '09172223344',
      productTitle: 'عسل وحشی گون کوهستان دشت ارژن',
      quantity: 1,
      reason: 'QUALITY_ISSUE',
      reasonTitle: 'عدم تطابق با سلیقه و ذائقه مشتری',
      description: 'مشتری طعم عسل آویشن را انتظار داشته و مایل به تعویض با عسل کوهی دیگر است.',
      refundAmount: 480000,
      status: 'PENDING',
      adminNotes: 'تماس تلفنی با مشتری برقرار شود جهت تعویض با عسل آویشن.',
      createdAt: '۱۴۰۵/۰۶/۱۶ - ۱۶:۴۵',
      updatedAt: '۱۴۰۵/۰۶/۱۶ - ۱۶:۴۵',
    },
  ];
  private smsBroadcasts: SmsBroadcast[] = [
    {
      id: 'sms-b-1',
      title: 'شارژ بار تازه تخم‌مرغ محلی کامفیروز',
      message: 'مشترک گرامی پروفارم؛ بار تازه تخم‌مرغ محلی کامفیروز با تحویل ۶ روزه شیراز شارژ شد. جهت ثبت سفارش به سایت مراجعه فرمایید.',
      targetSegment: 'PRO_MEMBERS',
      targetSegmentTitle: 'مشترکین طلایی پرو',
      recipientCount: 142,
      status: 'SENT',
      sentAt: '۱۴۰۵/۰۶/۱۰ - ۱۱:۰۰',
      createdAt: '۱۴۰۵/۰۶/۱۰ - ۱۰:۴۵',
    },
    {
      id: 'sms-b-2',
      title: 'اطلاعیه زمان‌بندی پیک شیراز (ساعت ۱۵ الی ۲۱)',
      message: 'مشتری گرامی؛ توزیع سفارشات امروز طبق روال در بازه عصرگاهی انجام می‌شود. لطفا در آدرس حضور داشته باشید.',
      targetSegment: 'SHIRAZ_BUYERS',
      targetSegmentTitle: 'خریداران فعال شیراز',
      recipientCount: 89,
      status: 'SENT',
      sentAt: '۱۴۰۵/۰۶/۱۵ - ۱۴:۳۰',
      createdAt: '۱۴۰۵/۰۶/۱۵ - ۱۴:۱۵',
    },
  ];
  private smsEventTemplates: SmsEventTemplate[] = [...DEFAULT_SMS_EVENT_TEMPLATES];
  private smsSettings: SmsProviderSettings = { ...DEFAULT_SMS_PROVIDER_SETTINGS };
  private reviews: ProductReview[] = [...INITIAL_PRODUCT_REVIEWS];
  private emailLogs: EmailMessageLog[] = [];
  private emailSettings: EmailProviderSettings = { ...DEFAULT_EMAIL_PROVIDER_SETTINGS };
  private isDatabaseSyncing: boolean = false;
  private hasSyncedFromPrisma: boolean = false;

  // --- PRISMA & POSTGRESQL INTEGRATION ---
  private getPrisma(): any {
    if (!process.env.DATABASE_URL) return null;
    try {
      const { prisma } = require('@/lib/prisma');
      return prisma;
    } catch {
      return null;
    }
  }

  private async isDatabaseReachable(): Promise<boolean> {
    if (!process.env.DATABASE_URL) return false;
    try {
      const parsedUrl = new URL(process.env.DATABASE_URL);
      const host = parsedUrl.hostname || 'localhost';
      const port = parseInt(parsedUrl.port || '5432', 10);
      
      return await new Promise<boolean>((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(500);
        socket.once('connect', () => {
          socket.destroy();
          resolve(true);
        });
        socket.once('timeout', () => {
          socket.destroy();
          resolve(false);
        });
        socket.once('error', () => {
          socket.destroy();
          resolve(false);
        });
        socket.connect(port, host);
      });
    } catch {
      return false;
    }
  }

  // --- LOCAL PERSISTENCE HELPERS ---
  // --- SERVER-SIDE DATA FILE PERSISTENCE ---
  // Timestamp (ms) of the newest state this process knows about: the savedAt of the loaded file or the last save.
  private memoryStampMs = 0;
  private saveSequence = 0;
  private prismaMirrorRunning = false;
  private prismaMirrorDirty = false;
  private prismaSkipWarned = false;
  private dailyCapacityOverrides: Record<string, { maxCapacity?: number; isClosedManually?: boolean }> = {};

  private getServerDataFilePath(): string | null {
    try {
      const dataDir = process.env.DATA_DIR?.trim() || path.join(/*turbopackIgnore: true*/ process.cwd(), '.data');
      if (!fs.existsSync(/*turbopackIgnore: true*/ dataDir)) {
        fs.mkdirSync(/*turbopackIgnore: true*/ dataDir, { recursive: true });
      }
      return path.join(dataDir, 'profarm_store.json');
    } catch {
      return null;
    }
  }

  /**
   * The users map holds several keys per account (id, phone, email), all pointing to the same object.
   * indexUser first removes every entry that belongs to this account id, so a replaced object or a changed
   * phone/email never leaves a stale key behind. Every write of a user must go through here.
   */
  private indexUser(user: User): void {
    if (!user) return;
    this.unindexUser(user);
    if (user.id) this.users.set(user.id, user);
    if (user.phone) this.users.set(user.phone, user);
    if (user.email) this.users.set(user.email.trim().toLowerCase(), user);
  }

  private unindexUser(user: User): void {
    for (const [key, value] of Array.from(this.users.entries())) {
      if (value === user || (user.id && value?.id === user.id)) {
        this.users.delete(key);
      }
    }
  }

  /** One entry per account. The index map holds each account several times, so this never returns duplicates. */
  private uniqueUsers(): User[] {
    const byAccount = new Map<string, User>();
    for (const u of this.users.values()) {
      if (!u) continue;
      const key = u.id || u.phone || u.email || '';
      if (key && !byAccount.has(key)) byAccount.set(key, u);
    }
    return Array.from(byAccount.values());
  }

  /**
   * Accepts both the current format (one object per account) and the legacy format (a list of [key, user]
   * pairs where each account appeared under its id, phone and email keys). In the legacy format the copy
   * stored under its own id key is the canonical one and wins over the other copies.
   */
  private loadUsersFromSnapshot(list: unknown[]): void {
    const chosen = new Map<string, { user: User; canonical: boolean }>();
    for (const entry of list) {
      let user: User | undefined;
      let canonical = true;
      if (Array.isArray(entry)) {
        const key = String(entry[0] ?? '');
        user = entry[1] as User | undefined;
        canonical = Boolean(user?.id && key === user.id);
      } else {
        user = entry as User;
      }
      if (!user || typeof user !== 'object') continue;
      const groupKey = user.id || user.phone || user.email;
      if (!groupKey) continue;
      const previous = chosen.get(groupKey);
      if (!previous || (canonical && !previous.canonical)) {
        chosen.set(groupKey, { user, canonical });
      }
    }
    for (const { user } of chosen.values()) {
      if (!user.username && user.phone) {
        user.username = `user_${user.phone.slice(-4)}`;
      }
      this.indexUser(user);
    }
  }

  /** Every collection that admins or customers can change must be listed here, or it is lost on restart. */
  private buildServerSnapshot(): Record<string, unknown> {
    return {
      version: 2,
      savedAt: new Date().toISOString(),
      users: this.uniqueUsers(),
      orders: this.orders,
      products: this.products,
      categories: this.categories,
      coupons: this.coupons,
      paymentSettings: this.paymentSettings,
      subscriptionSettings: this.subscriptionSettings,
      siteContent: this.siteContent,
      smsSettings: this.smsSettings,
      smsEventTemplates: this.smsEventTemplates,
      smsBroadcasts: this.smsBroadcasts,
      emailSettings: this.emailSettings,
      emailLogs: this.emailLogs,
      bulkInquiries: this.bulkInquiries,
      reviews: this.reviews,
      returnRequests: this.returnRequests,
      dailyCapacityOverrides: this.dailyCapacityOverrides,
    };
  }

  private isReadableJsonFile(filePath: string): boolean {
    try {
      JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ filePath, 'utf-8'));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Renames tempPath over targetPath. On Windows the rename fails with EPERM, EBUSY or EACCES while an editor, an
   * antivirus scan or the indexer holds the target, so it is retried with a short, growing pause (about 250 ms in
   * total). If every retry fails, the temp file is copied over the target and removed. A failed copy is logged and rethrown.
   */
  private replaceFileWithRetry(fs: any, tempPath: string, targetPath: string): void {
    const RETRYABLE = new Set(['EPERM', 'EBUSY', 'EACCES']);
    const pause = (ms: number) => {
      try {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
      } catch {
        // No SharedArrayBuffer in this runtime: retry without the pause.
      }
    };
    let lastError: any = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        fs.renameSync(/*turbopackIgnore: true*/ tempPath, targetPath);
        return;
      } catch (err: any) {
        lastError = err;
        if (!RETRYABLE.has(err?.code)) break;
        pause(25 * (attempt + 1));
      }
    }
    try {
      fs.copyFileSync(/*turbopackIgnore: true*/ tempPath, targetPath);
      fs.rmSync(/*turbopackIgnore: true*/ tempPath, { force: true });
      console.warn(
        `[FarmStore] Rename to ${targetPath} failed (${lastError?.code || 'unknown'}); the state was copied over it instead.`
      );
    } catch (copyErr) {
      console.error(`[FarmStore] Could not replace ${targetPath}: rename and copy both failed.`, copyErr);
      throw copyErr;
    }
  }

  /**
   * Writes the whole server state atomically: temp file, fsync, the current file rotated to .bak (only when it
   * is readable, so a damaged file never replaces a good backup), then rename over the target. A crash leaves
   * either the old file or the new one, never a partial file.
   */
  public saveServerState(): void {
    let tempPath: string | null = null;
    try {
      const filePath = this.getServerDataFilePath();
      if (filePath) {
        const serialized = JSON.stringify(this.buildServerSnapshot(), null, 2);
        tempPath = `${filePath}.${process.pid}.${++this.saveSequence}.tmp`;
        const fd = fs.openSync(/*turbopackIgnore: true*/ tempPath, 'w');
        try {
          fs.writeSync(/*turbopackIgnore: true*/ fd, serialized, undefined, 'utf-8');
          fs.fsyncSync(/*turbopackIgnore: true*/ fd);
        } finally {
          fs.closeSync(/*turbopackIgnore: true*/ fd);
        }

        const backupPath = `${filePath}.bak`;
        if (fs.existsSync(/*turbopackIgnore: true*/ filePath) && this.isReadableJsonFile(filePath)) {
          const backupTemp = `${backupPath}.${process.pid}.tmp`;
          fs.copyFileSync(/*turbopackIgnore: true*/ filePath, backupTemp);
          this.replaceFileWithRetry(fs, backupTemp, backupPath);
        }

        this.replaceFileWithRetry(fs, tempPath, filePath);
        tempPath = null;
        this.memoryStampMs = Date.now();
      }
    } catch (e) {
      console.error('[FarmStore] Failed to save server state:', e);
      if (tempPath) {
        try {
          fs.rmSync(/*turbopackIgnore: true*/ tempPath, { force: true });
        } catch {}
      }
    }
    this.schedulePrismaMirror();
  }

  /** Returns the parsed snapshot from the data file, or from the .bak copy when the file is damaged. */
  private readServerSnapshot(): Record<string, any> | null {
    try {
      const filePath = this.getServerDataFilePath();
      if (!filePath) return null;
      for (const candidate of [filePath, `${filePath}.bak`]) {
        if (!fs.existsSync(/*turbopackIgnore: true*/ candidate)) continue;
        try {
          const content = fs.readFileSync(/*turbopackIgnore: true*/ candidate, 'utf-8');
          if (!content || content.trim().length === 0) continue;
          const parsed = JSON.parse(content);
          if (candidate !== filePath) {
            console.info('[FarmStore RECOVERY] Restored server state from the .bak copy.');
          }
          return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (err) {
          console.warn(`[FarmStore] Could not read ${candidate}:`, (err as Error)?.message || err);
        }
      }
    } catch (err) {
      console.error('[FarmStore] Could not access the store file:', (err as Error)?.message || err);
    }
    return null;
  }

  private applyServerSnapshot(data: Record<string, any>): void {
    if (typeof data.savedAt === 'string') {
      const stamp = Date.parse(data.savedAt);
      if (Number.isFinite(stamp)) this.memoryStampMs = stamp;
    }
    if (Array.isArray(data.users)) this.loadUsersFromSnapshot(data.users);
    if (Array.isArray(data.orders)) this.orders = data.orders;
    if (Array.isArray(data.products)) this.products = data.products;
    if (Array.isArray(data.categories)) {
      this.categories = ['همه محصولات', ...data.categories.filter((c: string) => c !== 'همه محصولات')];
    }
    if (Array.isArray(data.coupons)) this.coupons = data.coupons;
    if (data.paymentSettings && typeof data.paymentSettings === 'object') {
      this.paymentSettings = { ...this.paymentSettings, ...data.paymentSettings };
    }
    if (data.subscriptionSettings && typeof data.subscriptionSettings === 'object') {
      this.subscriptionSettings = {
        ...DEFAULT_SUBSCRIPTION_SETTINGS,
        ...data.subscriptionSettings,
        proFeatures: Array.isArray(data.subscriptionSettings.proFeatures)
          ? data.subscriptionSettings.proFeatures
          : DEFAULT_SUBSCRIPTION_SETTINGS.proFeatures,
        plusFeatures: Array.isArray(data.subscriptionSettings.plusFeatures)
          ? data.subscriptionSettings.plusFeatures
          : DEFAULT_SUBSCRIPTION_SETTINGS.plusFeatures,
        freeFeatures: Array.isArray(data.subscriptionSettings.freeFeatures)
          ? data.subscriptionSettings.freeFeatures
          : DEFAULT_SUBSCRIPTION_SETTINGS.freeFeatures,
        faqItems: Array.isArray(data.subscriptionSettings.faqItems)
          ? data.subscriptionSettings.faqItems
          : DEFAULT_SUBSCRIPTION_SETTINGS.faqItems,
        comparisonRows: Array.isArray(data.subscriptionSettings.comparisonRows)
          ? data.subscriptionSettings.comparisonRows
          : DEFAULT_COMPARISON_ROWS,
      };
    }
    if (data.smsSettings && typeof data.smsSettings === 'object') {
      this.smsSettings = { ...this.smsSettings, ...data.smsSettings };
    }
    if (Array.isArray(data.smsEventTemplates)) {
      const stored = data.smsEventTemplates as SmsEventTemplate[];
      this.smsEventTemplates = DEFAULT_SMS_EVENT_TEMPLATES.map((def) => {
        const match = stored.find((s) => s.id === def.id);
        if (!match) return def;
        return {
          ...def,
          ...match,
          availableVariables: def.availableVariables || match.availableVariables || [],
        };
      });
    }
    if (Array.isArray(data.smsBroadcasts)) this.smsBroadcasts = data.smsBroadcasts;
    if (Array.isArray(data.bulkInquiries)) this.bulkInquiries = data.bulkInquiries;
    if (Array.isArray(data.reviews)) this.reviews = data.reviews;
    if (Array.isArray(data.returnRequests)) this.returnRequests = data.returnRequests;
    if (Array.isArray(data.emailLogs)) this.emailLogs = data.emailLogs;
    if (data.emailSettings && typeof data.emailSettings === 'object') {
      this.emailSettings = { ...this.emailSettings, ...data.emailSettings };
    }
    if (data.siteContent && typeof data.siteContent === 'object') {
      this.siteContent = { ...DEFAULT_SITE_CONTENT, ...data.siteContent };
    }
    // Legacy snapshots may still contain slotBookings: ignored. Slot occupancy is derived from orders.
    if (data.dailyCapacityOverrides && typeof data.dailyCapacityOverrides === 'object') {
      this.dailyCapacityOverrides = data.dailyCapacityOverrides;
    }
  }

  /**
   * Loads the snapshot once, at construction. Request handlers must never call this: it replaces live state.
   */
  public loadServerState(): void {
    try {
      const data = this.readServerSnapshot();
      if (data) this.applyServerSnapshot(data);
    } catch (e) {
      console.warn('[FarmStore] Failed to load server state:', e);
    }

    const prisma = this.getPrisma();
    if (prisma && !this.isDatabaseSyncing && !this.hasSyncedFromPrisma) {
      this.syncFromPrisma().catch((err) =>
        console.error('[FarmStore Prisma ERROR] Startup sync failed:', err?.message || err)
      );
    }
  }

  // --- PRISMA MIRROR: queue, merge and log helpers ---
  private timeOf(value: unknown): number {
    if (value === null || value === undefined || value === '') return NaN;
    const ms = value instanceof Date ? value.getTime() : Date.parse(String(value));
    return Number.isFinite(ms) ? ms : NaN;
  }

  /**
   * The JSON/in-memory store is authoritative. PostgreSQL may only ADD records that memory does not have.
   * A record is considered present when any of its keys (id, slug, code, orderNumber) is already known in memory.
   * Existing records are never replaced by the mirror, whatever their timestamps say.
   */
  private addMissingRecords<T>(
    current: T[],
    incoming: T[],
    keysOf: (record: T) => Array<string | undefined>
  ): T[] {
    const result = [...current];
    const known = new Set<string>();
    const remember = (record: T) => {
      for (const key of keysOf(record)) {
        if (key) known.add(key);
      }
    };
    result.forEach(remember);

    for (const rec of incoming) {
      const keys = keysOf(rec).filter((k): k is string => Boolean(k));
      if (keys.some((k) => known.has(k))) continue;
      result.push(rec);
      remember(rec);
    }
    return result;
  }

  private logPrismaSkip(message: string): void {
    if (this.prismaSkipWarned) return;
    this.prismaSkipWarned = true;
    console.warn(`[FarmStore Prisma] Skipping mirror work (logged once per process): ${message}`);
  }

  /** Runs the mirror as a single queue: at most one run at a time. A save during a run marks the mirror dirty. */
  private schedulePrismaMirror(): void {
    const prisma = this.getPrisma();
    if (!prisma) return;
    this.prismaMirrorDirty = true;
    if (this.prismaMirrorRunning) return;
    this.prismaMirrorRunning = true;
    void (async () => {
      try {
        while (this.prismaMirrorDirty) {
          this.prismaMirrorDirty = false;
          while (this.isDatabaseSyncing) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          try {
            await this.persistToPrismaAsync(prisma);
          } catch (err: any) {
            console.error('[FarmStore Prisma ERROR] Mirror run failed:', err?.message || err);
          }
        }
      } finally {
        this.prismaMirrorRunning = false;
      }
    })();
  }

  public async syncFromPrisma(): Promise<boolean> {
    const prisma = this.getPrisma();
    if (!prisma) return false;
    if (this.isDatabaseSyncing) return false;
    this.isDatabaseSyncing = true;
    try {
      // Fast socket health check: if DB port is closed, gracefully skip without error dumps
      const isOnline = await this.isDatabaseReachable();
      if (!isOnline) return false;

      const failed = (label: string) => (err: any) => {
        console.error(`[FarmStore Prisma ERROR] Failed reading ${label} from PostgreSQL:`, err?.message || err);
        return null;
      };

      // Phase 1: read everything. Nothing in memory is changed while awaiting.
      const siteRow = await prisma.siteContent.findUnique({ where: { id: 'singleton' } }).catch(failed('site content'));
      const subRow = await prisma.subscriptionSettings
        .findUnique({ where: { id: 'singleton' } })
        .catch(failed('subscription settings'));
      const payRow = await prisma.paymentSettings
        .findUnique({ where: { id: 'singleton' } })
        .catch(failed('payment settings'));
      const dbProducts = await prisma.product.findMany().catch(failed('products'));
      const dbUsers = await prisma.user.findMany({ include: { addresses: true } }).catch(failed('users'));
      const dbCoupons = await prisma.coupon.findMany().catch(failed('coupons'));
      const dbOrders = await prisma.order
        .findMany({
          include: {
            items: { include: { product: true } },
            address: true,
            payment: true,
            deliverySlot: true,
            user: { include: { addresses: true } },
          },
          orderBy: { createdAt: 'desc' },
        })
        .catch(failed('orders'));
      const dbReviews = await prisma.productReview
        .findMany({ orderBy: { createdAt: 'desc' } })
        .catch(failed('reviews'));
      const dbReturns = await prisma.returnRequest
        .findMany({ orderBy: { createdAt: 'desc' } })
        .catch(failed('return requests'));
      const dbTemplates = await prisma.smsEventTemplate.findMany().catch(failed('SMS templates'));

      const iso = (value: any) => (value instanceof Date ? value.toISOString() : value ?? undefined);
      // True once a JSON state has been loaded or saved in this process. Until then memory only holds defaults.
      const memoryHasState = this.memoryStampMs > 0;

      // Phase 2: merge synchronously, so no concurrent in-memory change can be lost.
      // Singleton settings: PostgreSQL fills them in only when there is no JSON state at all (fresh install).
      // Once a JSON state exists, memory is authoritative and these rows are never applied.
      if (!memoryHasState && siteRow?.content && typeof siteRow.content === 'object') {
        this.siteContent = { ...DEFAULT_SITE_CONTENT, ...(siteRow.content as any) };
      }
      if (!memoryHasState && subRow?.settings && typeof subRow.settings === 'object') {
        this.subscriptionSettings = { ...DEFAULT_SUBSCRIPTION_SETTINGS, ...(subRow.settings as any) };
      }
      if (!memoryHasState && payRow?.settings && typeof payRow.settings === 'object') {
        this.paymentSettings = { ...DEFAULT_PAYMENT_SETTINGS, ...(payRow.settings as any) };
      }

      if (dbProducts && dbProducts.length > 0) {
        const mapped: Product[] = dbProducts.map((p: any) => ({
          ...p,
          specifications: (p.specifications as any) || [],
          nutritionalInfo: (p.nutritionalInfo as any) || {},
          faqs: (p.faqs as any) || [],
          createdAt: iso(p.createdAt),
          updatedAt: iso(p.updatedAt),
        }));
        this.products = this.addMissingRecords(this.products, mapped, (p) => [p.id, p.slug]);
      }

      // Users: PostgreSQL only adds accounts that are missing in memory (memory is authoritative) and fills in
      // missing addresses. Existing accounts are never overwritten by the mirror.
      if (dbUsers && dbUsers.length > 0) {
        for (const u of dbUsers as any[]) {
          const mappedAddresses = (u.addresses || []).map((a: any) => ({
            id: a.id,
            userId: a.userId,
            recipientName: a.recipientName,
            phone: a.phone,
            province: a.province,
            city: a.city,
            postalCode: a.postalCode,
            streetAddress: a.streetAddress,
            unit: a.unit || '',
            isShiraz: a.isShiraz,
            isDefault: a.isDefault,
          }));
          const existing = this.users.get(u.id) || (u.phone ? this.users.get(u.phone) : undefined);
          if (existing) {
            const known = new Set((existing.addresses || []).map((a) => a.id));
            const missing = mappedAddresses.filter((a: any) => !known.has(a.id));
            if (missing.length > 0) existing.addresses = [...(existing.addresses || []), ...missing];
            continue;
          }
          const mappedUser: User = {
            id: u.id,
            phone: u.phone,
            username: u.username || `user_${String(u.phone || '').slice(-4)}`,
            name: u.name,
            email: u.email,
            password: u.password,
            authProvider: u.authProvider as any,
            isPhoneVerified: u.isPhoneVerified,
            avatarUrl: u.avatarUrl,
            nationalId: u.nationalId,
            birthDate: u.birthDate,
            smsNotificationEnabled: u.smsNotificationEnabled,
            role: u.role as any,
            isProMember: u.isProMember,
            tier: (u.tier as any) || (u.isProMember ? 'PRO' : 'FREE'),
            isPlusMember: u.isPlusMember,
            plusExpiresAt: u.plusExpiresAt,
            proExpiresAt: u.proExpiresAt,
            eggDiscountUsed: u.eggDiscountUsed || 0,
            addresses: mappedAddresses,
          };
          this.indexUser(mappedUser);
        }
        // Users loaded from PostgreSQL may carry the legacy admin hash: apply the admin policy again
        this.applyAdminPasswordPolicy();
      }

      if (dbCoupons && dbCoupons.length > 0) {
        const mapped: Coupon[] = dbCoupons.map((c: any) => ({
          ...c,
          createdAt: iso(c.createdAt) || new Date().toISOString(),
          updatedAt: iso(c.updatedAt),
        }));
        this.coupons = this.addMissingRecords(this.coupons, mapped, (c) => [c.id, c.code]);
      }

      if (dbOrders && dbOrders.length > 0) {
        // LOSSY COPY: the Prisma Order model has no Json column for the full order, so fields that exist only in
        // the JSON store (shippingFee, coupon data, payment gateway details, flags) are not restored from here.
        // That is acceptable only because the mirror never replaces an order that memory already has; it adds
        // orders only when the JSON file is missing them entirely. Restore the full copy by adding a Json column.
        const mapped: Order[] = dbOrders.map((o: any) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          userId: o.userId,
          user: this.users.get(o.userId),
          addressId: o.addressId,
          address: o.address
            ? {
                id: o.address.id,
                userId: o.address.userId,
                recipientName: o.address.recipientName,
                phone: o.address.phone,
                province: o.address.province,
                city: o.address.city,
                postalCode: o.address.postalCode,
                streetAddress: o.address.streetAddress,
                unit: o.address.unit || '',
                isShiraz: o.address.isShiraz,
                isDefault: o.address.isDefault,
              }
            : undefined,
          deliverySlotId: o.deliverySlotId,
          deliverySlot: o.deliverySlot
            ? {
                id: o.deliverySlot.id,
                date: o.deliverySlot.date,
                dayOfWeek: o.deliverySlot.dayOfWeek,
                timeWindow: o.deliverySlot.timeWindow,
                maxCapacity: o.deliverySlot.maxCapacity,
                currentBookings: o.deliverySlot.currentBookings,
              }
            : undefined,
          totalAmount: o.totalAmount,
          status: o.status as any,
          isBulkOrder: o.isBulkOrder,
          bulkNotes: o.bulkNotes,
          isSubscription: o.isSubscription,
          subscriptionPlan: o.subscriptionPlan,
          settlementStatus: o.settlementStatus,
          settlementRef: o.settlementRef,
          items: (o.items || []).map((it: any) => ({
            id: it.id,
            productId: it.productId,
            product: it.product || this.products.find((p) => p.id === it.productId),
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            totalPrice: it.totalPrice,
          })),
          payment: o.payment
            ? {
                id: o.payment.id,
                orderId: o.payment.orderId,
                amount: o.payment.amount,
                gateway: o.payment.gateway as any,
                authority: o.payment.authority,
                refId: o.payment.refId,
                status: o.payment.status as any,
                createdAt: iso(o.payment.createdAt),
              }
            : undefined,
          createdAt: iso(o.createdAt) || new Date().toISOString(),
          updatedAt: iso(o.updatedAt),
        }));
        this.orders = this.addMissingRecords(this.orders, mapped, (o) => [o.id, o.orderNumber]);
        this.orders.sort((a, b) => (this.timeOf(b.createdAt) || 0) - (this.timeOf(a.createdAt) || 0));
      }

      if (dbReviews && dbReviews.length > 0) {
        const mapped: ProductReview[] = dbReviews.map((r: any) => ({
          ...r,
          createdAt: iso(r.createdAt) || new Date().toISOString(),
          updatedAt: iso(r.updatedAt),
        }));
        this.reviews = this.addMissingRecords(this.reviews, mapped, (r) => [r.id]);
      }

      if (dbReturns && dbReturns.length > 0) {
        const mapped: ReturnRequest[] = dbReturns.map((rt: any) => ({
          ...rt,
          createdAt: iso(rt.createdAt) || new Date().toISOString(),
          updatedAt: iso(rt.updatedAt),
        }));
        this.returnRequests = this.addMissingRecords(this.returnRequests, mapped, (rt) => [rt.id]);
      }

      if (dbTemplates && dbTemplates.length > 0) {
        const mapped: SmsEventTemplate[] = dbTemplates.map((t: any) => ({
          ...t,
          availableVariables: (t.availableVariables as any) || [],
          updatedAt: iso(t.updatedAt),
        }));
        this.smsEventTemplates = this.addMissingRecords(this.smsEventTemplates, mapped, (t) => [t.id]);
      }

      this.hasSyncedFromPrisma = true;
      return true;
    } catch (err: any) {
      console.error('[FarmStore Prisma ERROR] Sync from PostgreSQL failed:', err?.message || err);
      return false;
    } finally {
      this.isDatabaseSyncing = false;
    }
  }

  /**
   * Writes the in-memory state to PostgreSQL. Runs only through schedulePrismaMirror (one run at a time).
   * The JSON file stays the source of truth: this is a mirror, and a failed run is logged and retried on the next save.
   */
  public async persistToPrismaAsync(prisma: any): Promise<void> {
    if (!prisma) return;
    const isOnline = await this.isDatabaseReachable();
    if (!isOnline) return;

    const logFailure = (label: string) => (err: any) => {
      console.error(`[FarmStore Prisma ERROR] ${label}:`, err?.message || err);
      return null;
    };

    try {
      // 1. Singletons
      await prisma.siteContent
        .upsert({
          where: { id: 'singleton' },
          update: { content: this.siteContent as any },
          create: { id: 'singleton', content: this.siteContent as any },
        })
        .catch(logFailure('site content upsert'));

      await prisma.subscriptionSettings
        .upsert({
          where: { id: 'singleton' },
          update: { settings: this.subscriptionSettings as any },
          create: { id: 'singleton', settings: this.subscriptionSettings as any },
        })
        .catch(logFailure('subscription settings upsert'));

      await prisma.paymentSettings
        .upsert({
          where: { id: 'singleton' },
          update: { settings: this.paymentSettings as any },
          create: { id: 'singleton', settings: this.paymentSettings as any },
        })
        .catch(logFailure('payment settings upsert'));

      // 2. Products
      for (const prod of this.products) {
        await prisma.product
          .upsert({
            where: { slug: prod.slug },
            update: {
              title: prod.title,
              description: prod.description,
              category: prod.category,
              price: prod.price,
              costPrice: prod.costPrice,
              packSize: prod.packSize || '',
              weightKg: prod.weightKg,
              dimensions: prod.dimensions,
              stock: prod.stock,
              status: prod.status || 'AVAILABLE',
              images: prod.images,
              isOrganicCertified: prod.isOrganicCertified,
              isBulkEligible: prod.isBulkEligible,
              minBulkQuantity: prod.minBulkQuantity,
              specifications: prod.specifications as any,
              highlights: prod.highlights,
              storageInstructions: prod.storageInstructions,
              nutritionalInfo: prod.nutritionalInfo as any,
              faqs: prod.faqs as any,
              originLocation: prod.originLocation,
              shelfLife: prod.shelfLife,
            },
            create: {
              id: prod.id,
              title: prod.title,
              slug: prod.slug,
              description: prod.description,
              category: prod.category,
              price: prod.price,
              costPrice: prod.costPrice,
              packSize: prod.packSize || '',
              weightKg: prod.weightKg,
              dimensions: prod.dimensions,
              stock: prod.stock,
              status: prod.status || 'AVAILABLE',
              images: prod.images,
              isOrganicCertified: prod.isOrganicCertified,
              isBulkEligible: prod.isBulkEligible,
              minBulkQuantity: prod.minBulkQuantity,
              specifications: prod.specifications as any,
              highlights: prod.highlights,
              storageInstructions: prod.storageInstructions,
              nutritionalInfo: prod.nutritionalInfo as any,
              faqs: prod.faqs as any,
              originLocation: prod.originLocation,
              shelfLife: prod.shelfLife,
            },
          })
          .catch(logFailure(`product ${prod.slug} upsert`));
      }

      // 3. Users (one entry per account; the Postgres user table is keyed by phone)
      for (const u of this.uniqueUsers()) {
        if (!u.phone) continue;
        const userRec = await prisma.user
          .upsert({
            where: { phone: u.phone },
            update: {
              name: u.name,
              username: u.username,
              email: u.email,
              password: u.password,
              role: (u.role as any) || 'USER',
              isProMember: u.isProMember,
              isPlusMember: u.isPlusMember,
              tier: u.tier || 'FREE',
              plusExpiresAt: u.plusExpiresAt,
              proExpiresAt: u.proExpiresAt,
              eggDiscountUsed: u.eggDiscountUsed || 0,
              authProvider: u.authProvider || 'PHONE_OTP',
              isPhoneVerified: u.isPhoneVerified || false,
            },
            create: {
              id: u.id,
              phone: u.phone,
              username: u.username,
              name: u.name,
              email: u.email,
              password: u.password,
              role: (u.role as any) || 'USER',
              isProMember: u.isProMember,
              isPlusMember: u.isPlusMember,
              tier: u.tier || 'FREE',
              plusExpiresAt: u.plusExpiresAt,
              proExpiresAt: u.proExpiresAt,
              eggDiscountUsed: u.eggDiscountUsed || 0,
              authProvider: u.authProvider || 'PHONE_OTP',
              isPhoneVerified: u.isPhoneVerified || false,
            },
          })
          .catch(logFailure(`user ${u.id} upsert`));

        if (userRec && Array.isArray(u.addresses)) {
          for (const addr of u.addresses) {
            if (!addr.id) continue;
            await prisma.address
              .upsert({
                where: { id: addr.id },
                update: {
                  recipientName: addr.recipientName,
                  phone: addr.phone,
                  streetAddress: addr.streetAddress,
                  unit: addr.unit,
                  isDefault: addr.isDefault,
                },
                create: {
                  id: addr.id,
                  userId: userRec.id,
                  recipientName: addr.recipientName,
                  phone: addr.phone,
                  province: addr.province || 'فارس',
                  city: addr.city || 'شیراز',
                  postalCode: addr.postalCode || '۷۱۹۸۷۶۵۴۳۲',
                  streetAddress: addr.streetAddress,
                  unit: addr.unit || '',
                  isShiraz: addr.isShiraz ?? true,
                  isDefault: addr.isDefault ?? false,
                },
              })
              .catch(logFailure(`address ${addr.id} upsert`));
          }
        }
      }

      // 4. Coupons
      for (const coup of this.coupons) {
        await prisma.coupon
          .upsert({
            where: { code: coup.code },
            update: {
              title: coup.title,
              description: coup.description,
              targetType: coup.targetType,
              targetProductId: coup.targetProductId,
              targetProductName: coup.targetProductName,
              discountType: coup.discountType,
              discountValue: coup.discountValue,
              minOrderAmount: coup.minOrderAmount,
              maxDiscountAmount: coup.maxDiscountAmount,
              usageLimit: coup.usageLimit,
              usageCount: coup.usageCount,
              isActive: coup.isActive,
              expiresAt: coup.expiresAt,
            },
            create: {
              id: coup.id,
              code: coup.code,
              title: coup.title,
              description: coup.description,
              targetType: coup.targetType,
              targetProductId: coup.targetProductId,
              targetProductName: coup.targetProductName,
              discountType: coup.discountType,
              discountValue: coup.discountValue,
              minOrderAmount: coup.minOrderAmount,
              maxDiscountAmount: coup.maxDiscountAmount,
              usageLimit: coup.usageLimit,
              usageCount: coup.usageCount,
              isActive: coup.isActive,
              expiresAt: coup.expiresAt,
            },
          })
          .catch(logFailure(`coupon ${coup.code} upsert`));
      }

      // 5. Orders. Each order is written in its own transaction. The user is resolved by order.userId only
      //    (never by the checkout phone). Order items use stable ids, so only removed items are deleted.
      const statusMap: Record<string, string> = {
        PENDING_PAYMENT: 'PENDING_PAYMENT',
        PROCESSING: 'PROCESSING',
        OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
        DELIVERED: 'DELIVERED',
        CANCELLED: 'CANCELLED',
      };

      for (const ord of this.orders) {
        const storeUser = this.users.get(ord.userId) || ord.user;
        if (!storeUser?.id || !storeUser.phone) {
          this.logPrismaSkip(`order ${ord.orderNumber}: its user is missing or has no phone number`);
          continue;
        }

        try {
          await prisma.$transaction(async (tx: any) => {
            // A. The user row must exist (written above by phone). Match by id first, then by phone.
            const userRecord = await tx.user.findFirst({
              where: { OR: [{ id: storeUser.id }, { phone: storeUser.phone }] },
            });
            if (!userRecord) {
              this.logPrismaSkip(`order ${ord.orderNumber}: user ${storeUser.id} is not in PostgreSQL`);
              return;
            }

            // B. Address
            const addressId = ord.address?.id || ord.addressId || `addr-${userRecord.id}`;
            const addressRecord = await tx.address.upsert({
              where: { id: addressId },
              update: {
                recipientName: ord.address?.recipientName || userRecord.name || 'مشتری شیراز',
                phone: ord.address?.phone || userRecord.phone,
                streetAddress: ord.address?.streetAddress || 'شیراز',
                unit: ord.address?.unit || '',
                isShiraz: ord.address?.isShiraz ?? true,
                isDefault: ord.address?.isDefault ?? true,
              },
              create: {
                id: addressId,
                userId: userRecord.id,
                recipientName: ord.address?.recipientName || userRecord.name || 'مشتری شیراز',
                phone: ord.address?.phone || userRecord.phone,
                province: ord.address?.province || 'فارس',
                city: ord.address?.city || 'شیراز',
                postalCode: ord.address?.postalCode || '۷۱۹۸۷۶۵۴۳۲',
                streetAddress: ord.address?.streetAddress || 'شیراز',
                unit: ord.address?.unit || '',
                isShiraz: ord.address?.isShiraz ?? true,
                isDefault: ord.address?.isDefault ?? true,
              },
            });

            // C. Delivery slot: keep the link only when the slot row exists or can be created
            let validDeliverySlotId: string | null = ord.deliverySlotId || null;
            if (validDeliverySlotId) {
              const slotInDb = await tx.deliverySlot.findUnique({ where: { id: validDeliverySlotId } });
              if (!slotInDb) {
                if (ord.deliverySlot) {
                  await tx.deliverySlot.create({
                    data: {
                      id: validDeliverySlotId,
                      date: ord.deliverySlot.date || 'تحویل شیراز',
                      dayOfWeek: ord.deliverySlot.dayOfWeek || 'یکشنبه',
                      timeWindow: ord.deliverySlot.timeWindow || '۱۵:۰۰ الی ۲۱:۰۰',
                      maxCapacity: ord.deliverySlot.maxCapacity || 30,
                      currentBookings: ord.deliverySlot.currentBookings || 1,
                    },
                  });
                } else {
                  validDeliverySlotId = null;
                }
              }
            }

            // D. Order
            const validStatus = statusMap[ord.status] || 'PROCESSING';
            const settlementStatus =
              ord.settlementStatus ||
              (validStatus === 'PROCESSING' || validStatus === 'DELIVERED' ? 'SETTLED' : 'PENDING');
            const settlementRef = ord.settlementRef || (ord.payment?.refId ? String(ord.payment.refId) : null);

            const orderRecord = await tx.order.upsert({
              where: { orderNumber: ord.orderNumber },
              update: {
                userId: userRecord.id,
                totalAmount: ord.totalAmount,
                status: validStatus,
                isBulkOrder: ord.isBulkOrder ?? false,
                bulkNotes: ord.bulkNotes || null,
                isSubscription: ord.isSubscription ?? false,
                subscriptionPlan: ord.subscriptionPlan || null,
                settlementStatus,
                settlementRef,
                addressId: addressRecord.id,
                deliverySlotId: validDeliverySlotId,
              },
              create: {
                id: ord.id || `ord-${Date.now()}`,
                orderNumber: ord.orderNumber,
                userId: userRecord.id,
                addressId: addressRecord.id,
                deliverySlotId: validDeliverySlotId,
                totalAmount: ord.totalAmount,
                status: validStatus,
                isBulkOrder: ord.isBulkOrder ?? false,
                bulkNotes: ord.bulkNotes || null,
                isSubscription: ord.isSubscription ?? false,
                subscriptionPlan: ord.subscriptionPlan || null,
                settlementStatus,
                settlementRef,
              },
            });

            // E. Order items: upsert by a stable id (order id + item id or position), then delete only the removed ones
            const keptItemIds: string[] = [];
            const items = Array.isArray(ord.items) ? ord.items : [];
            for (const [index, item] of items.entries()) {
              let product = await tx.product.findFirst({
                where: { OR: [{ id: item.productId }, { slug: item.productId }] },
              });
              if (!product) {
                const storeProd = this.products.find((p) => p.id === item.productId || p.slug === item.productId);
                if (storeProd) {
                  product = await tx.product.create({
                    data: {
                      id: storeProd.id,
                      title: storeProd.title,
                      slug: storeProd.slug,
                      description: storeProd.description,
                      category: storeProd.category,
                      price: storeProd.price,
                      stock: storeProd.stock,
                      images: storeProd.images,
                    },
                  });
                }
              }
              if (!product) {
                this.logPrismaSkip(`order ${ord.orderNumber}: product ${item.productId} is unknown`);
                continue;
              }

              const itemId = `${orderRecord.id}:${item.id || index}`;
              keptItemIds.push(itemId);
              const quantity = item.quantity ?? 1;
              const unitPrice = item.unitPrice ?? 0;
              const totalPrice = item.totalPrice ?? unitPrice * quantity;
              await tx.orderItem.upsert({
                where: { id: itemId },
                update: { productId: product.id, quantity, unitPrice, totalPrice },
                create: { id: itemId, orderId: orderRecord.id, productId: product.id, quantity, unitPrice, totalPrice },
              });
            }
            await tx.orderItem.deleteMany({
              where: { orderId: orderRecord.id, id: { notIn: keptItemIds } },
            });

            // F. Payment
            if (ord.payment || ord.status === 'PROCESSING' || ord.status === 'DELIVERED') {
              const paymentStatus =
                (ord.payment?.status as any) ||
                (ord.status === 'PROCESSING' || ord.status === 'DELIVERED' ? 'SUCCESS' : 'INITIATED');
              await tx.payment.upsert({
                where: { orderId: orderRecord.id },
                update: {
                  amount: ord.payment?.amount || ord.totalAmount,
                  status: paymentStatus,
                  refId: ord.payment?.refId ? String(ord.payment.refId) : ord.settlementRef || null,
                },
                create: {
                  orderId: orderRecord.id,
                  amount: ord.payment?.amount || ord.totalAmount,
                  gateway: ord.payment?.gateway || 'ZARINPAL',
                  authority: ord.payment?.authority || `AUTH-${ord.orderNumber.replace(/[^0-9]/g, '')}`,
                  refId: ord.payment?.refId ? String(ord.payment.refId) : ord.settlementRef || null,
                  status: paymentStatus,
                },
              });
            }
          });
        } catch (orderPersistErr: any) {
          console.error(
            `[FarmStore Prisma ERROR] Transaction failed persisting order ${ord.orderNumber}:`,
            orderPersistErr?.message || orderPersistErr
          );
        }
      }
    } catch (err: any) {
      console.error('[FarmStore Prisma ERROR] Mirror run failed:', err?.message || err);
    }
  }

  public async ensureDatabaseLoaded(): Promise<void> {
    if (this.hasSyncedFromPrisma) return;
    const prisma = this.getPrisma();
    if (!prisma) return;
    await this.syncFromPrisma();
  }

  private populateInitialUsers(): void {
    // SECURITY: demo customers from the sample orders are seeded in non-production only
    if (process.env.NODE_ENV !== 'production') {
      INITIAL_ADMIN_ORDERS.forEach((ord) => {
        if (ord.user) {
          const u = { ...ord.user };
          if (!u.username && u.phone) {
            u.username = `user_${u.phone.slice(-4)}`;
          }
          this.indexUser(u);
        }
      });
    }

    // SECURITY (C-1 Fix):
    // 1. In browser: Do NOT compute PBKDF2 hashes or expose them in client state.
    // 2. On server: Use cryptographically random salts via hashPassword() (210,000 iterations).
    // Never use hardcoded or sequential salts (1000000000000001, etc.).
    let adminPasswordHash = '';
    let userPasswordHash = '';
    let plusPasswordHash = '';
    let proPasswordHash = '';

    let generatedAdminPassword: string | null = null;
    // Production without ADMIN_PASSWORD: the seeded admin is not created at all (see applyAdminPasswordPolicy)
    let seedAdmin = true;
    // SECURITY: no hard-coded admin password. See lib/admin-bootstrap.ts for the resolution order.
    const resolvedAdmin = resolveInitialAdminPassword();
    if (resolvedAdmin.password) {
      adminPasswordHash = hashPassword(resolvedAdmin.password);
      if (resolvedAdmin.generated) generatedAdminPassword = resolvedAdmin.password;
    } else {
      seedAdmin = false;
      console.error(
        '[SECURITY] ADMIN_PASSWORD is not set. The admin account was not created. Set ADMIN_PASSWORD and restart the server.'
      );
    }
    if (process.env.NODE_ENV !== 'production') {
      userPasswordHash = hashPassword('user123');
      plusPasswordHash = hashPassword('plus123');
      proPasswordHash = hashPassword('pro123');
    }


    // 1. Admin User
    const adminUser: User = {
      id: 'usr-admin',
      username: 'admin',
      phone: '09170000000',
      email: 'admin@profarm-shiraz.ir',
      password: adminPasswordHash,
      name: 'مدیر ارشد سیستم (ادمین)',
      role: 'ADMIN',
      isProMember: true,
      tier: 'PRO',
      proExpiresAt: '1406-01-01',
      authProvider: 'PASSWORD',
      addresses: [
        {
          id: 'addr-admin-1',
          userId: 'usr-admin',
          recipientName: 'مدیر ارشد سیستم',
          phone: '09170000000',
          province: 'فارس',
          city: 'شیراز',
          postalCode: '۷۱۹۸۷۶۵۴۳۲',
          streetAddress: 'بلوار ارم، پلاک ۱۲',
          unit: 'واحد ۲',
          isShiraz: true,
          isDefault: true,
          createdAt: '۱۴۰۵/۰۱/۰۱',
        },
      ],
    };
    if (seedAdmin) {
      this.indexUser(adminUser);
      if (generatedAdminPassword) {
        this.pendingAdminCredentials = { user: adminUser, password: generatedAdminPassword };
      }
    }

    // SECURITY: Demo users (regular, plus, pro) are strictly seeded in non-production development/test only
    if (process.env.NODE_ENV !== 'production') {
      // 2. Regular User
      const regularUser: User = {
      id: 'usr-regular',
      username: 'user',
      phone: '09179876543',
      email: 'user@profarm-shiraz.ir',
      password: userPasswordHash,
      name: 'امیر محمدی (کاربر عادی)',
      role: 'USER',
      isProMember: false,
      tier: 'FREE',
      proExpiresAt: null,
      authProvider: 'PASSWORD',
      addresses: [
        {
          id: 'addr-regular-1',
          userId: 'usr-regular',
          recipientName: 'امیر محمدی',
          phone: '09179876543',
          province: 'فارس',
          city: 'شیراز',
          postalCode: '۷۱۳۴۵۱۲۳۴۵',
          streetAddress: 'خیابان زند، کوچه ۱۸، پلاک ۵',
          unit: 'طبقه ۱',
          isShiraz: true,
          isDefault: true,
          createdAt: '۱۴۰۵/۰۲/۱۰',
        },
      ],
    };
    this.indexUser(regularUser);

    // 3. Plus User
    const plusUser: User = {
      id: 'usr-plus',
      username: 'plus',
      phone: '09172223344',
      email: 'plus@profarm-shiraz.ir',
      password: plusPasswordHash,
      name: 'رضا کمالی (مشترک پلاس)',
      role: 'USER',
      isProMember: true,
      tier: 'PLUS',
      proExpiresAt: '1405-12-29',
      authProvider: 'PASSWORD',
      addresses: [
        {
          id: 'addr-plus-1',
          userId: 'usr-plus',
          recipientName: 'رضا کمالی',
          phone: '09172223344',
          province: 'فارس',
          city: 'شیراز',
          postalCode: '۷۱۵۵۵۹۸۷۶۱',
          streetAddress: 'بلوار معالی‌آباد، نبش خیابان دوستان، مجتمع نگین',
          unit: 'واحد ۱۴',
          isShiraz: true,
          isDefault: true,
          createdAt: '۱۴۰۵/۰۳/۱۵',
        },
      ],
    };
    this.indexUser(plusUser);

    // 4. Pro User
    const proUser: User = {
      id: 'usr-pro',
      username: 'pro',
      phone: '09171234567',
      email: 'pro@profarm-shiraz.ir',
      password: proPasswordHash,
      name: 'سارا نامدار (مشترک پرو)',
      role: 'USER',
      isProMember: true,
      tier: 'PRO',
      proExpiresAt: '1405-12-29',
      authProvider: 'PASSWORD',
      addresses: [
        {
          id: 'addr-pro-1',
          userId: 'usr-pro',
          recipientName: 'سارا نامدار',
          phone: '09171234567',
          province: 'فارس',
          city: 'شیراز',
          postalCode: '۷۱۶۶۶۴۳۲۱۸',
          streetAddress: 'خیابان قصردشت، نبش کوچه ۳۴، ساختمان پزشکان یاس',
          unit: 'طبقه ۳، واحد ۷',
          isShiraz: true,
          isDefault: true,
          createdAt: '۱۴۰۵/۰۴/۲۰',
        },
      ],
    };
    this.indexUser(proUser);
    }
  }

  private populateInitialBulkInquiries(): void {
    this.bulkInquiries = [
      {
        id: 'inq-sample-hyperstar-tehran',
        name: 'مهندس آرش جهانگیری',
        phone: '09121112233',
        companyName: 'فروشگاه‌های زنجیره‌ای هایپراستار تهران',
        city: 'تهران (انبار جاده مخصوص)',
        status: 'PENDING',
        message:
          'استعلام خرید عمده ماهانه ۳۰۰ کارتن تخم‌مرغ کامفیروز و ۱۰۰ کارتن عسل وحشی دشت ارژن همراه با ارسال باربری.',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'inq-sample-naghshe-jahan-isfahan',
        name: 'خانم دکتر صادقی',
        phone: '09135556677',
        companyName: 'هلدینگ غذایی نقش جهان اصفهان',
        city: 'اصفهان',
        status: 'PENDING',
        message:
          'درخواست تامین هفتگی ۵۰ بسته ۵ کیلویی صیفی‌جات ممتاز مرودشت و عرقیات اصیل میمند.',
        createdAt: new Date().toISOString(),
      },
    ];
  }

  constructor() {
    this.populateInitialUsers();
    this.populateInitialBulkInquiries();
    this.loadServerState();
    this.applyAdminPasswordPolicy();
    this.finalizeAdminBootstrap();
  }

  /**
   * Admin password policy, applied at startup and after users are loaded from PostgreSQL.
   * - ADMIN_PASSWORD_RESET=1 with ADMIN_INITIAL_PASSWORD/ADMIN_PASSWORD set: every admin password is reset
   *   to the env value (any environment). Remove the flag after recovery.
   * - Production only: an admin hash that still matches a legacy hard-coded password is replaced with the
   *   env password, or with an unguessable random hash when no env password is configured.
   * Development admin passwords are otherwise left untouched.
   */
  private applyAdminPasswordPolicy(): void {
    // `next build` also evaluates this module with NODE_ENV=production. Builds must never write the data store,
    // so the policy runs only when the server starts.
    if (process.env.NEXT_PHASE === 'phase-production-build') return;

    const isProduction = process.env.NODE_ENV === 'production';
    const envPassword = getEnvAdminPassword();
    const resetRequested = process.env.ADMIN_PASSWORD_RESET === '1' && Boolean(envPassword);
    let changed = false;
    let warnedLegacy = false;

    for (const u of this.uniqueUsers()) {
      if (u.role !== 'ADMIN') continue;

      if (resetRequested && envPassword) {
        u.password = hashPassword(envPassword);
        changed = true;
        continue;
      }

      if (isProduction && u.password && isLegacyAdminHash(u.password)) {
        if (envPassword) {
          u.password = hashPassword(envPassword);
        } else {
          u.password = hashPassword(generateUnguessableAdminPassword());
          if (!warnedLegacy) {
            console.error(
              '[SECURITY] The stored admin password was a legacy hard-coded value and has been disabled. Set ADMIN_PASSWORD (and ADMIN_PASSWORD_RESET=1 once) to restore admin access.'
            );
            warnedLegacy = true;
          }
        }
        changed = true;
      }
    }

    if (resetRequested) {
      console.warn('[SECURITY] ADMIN_PASSWORD_RESET=1: admin password was reset from the environment. Remove this flag after recovery.');
    }
    if (changed) this.saveUsers();
  }

  /**
   * Persists a freshly generated dev admin password only when the seeded admin is the active
   * account. If the stored data already has an admin, its password is never replaced.
   */
  private finalizeAdminBootstrap(): void {
    const pending = this.pendingAdminCredentials;
    this.pendingAdminCredentials = null;
    if (!pending) return;
    if (this.users.get('usr-admin') !== pending.user) return;
    saveGeneratedAdminCredentials(pending.password);
  }

  // --- PRODUCTS ---
  getProducts(): Product[] {
    return this.products;
  }

  getProductBySlug(slug: string): Product | undefined {
    return this.getProducts().find((p) => p.slug === slug || p.id === slug);
  }

  getProductById(id: string): Product | undefined {
    return this.getProducts().find((p) => p.id === id || p.slug === id);
  }

  private saveProducts(): void {
    this.saveServerState();
  }

  addProduct(
    productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'slug'> & {
      id?: string;
      slug?: string;
    }
  ): Product {
    const id = productData.id || `prod-${Date.now()}`;
    const existingSlugs = this.products.map((p) => p.slug);
    const slug =
      productData.slug && !productData.slug.startsWith('prod-')
        ? productData.slug
        : generateSeoSlug(productData.title, existingSlugs);

    const seoTitle =
      productData.seoTitle?.trim() ||
      generateProductSeoTitle({
        title: productData.title,
        category: productData.category,
        originLocation: productData.originLocation,
      });

    const seoDescription =
      productData.seoDescription?.trim() ||
      generateProductSeoDescription({
        title: productData.title,
        category: productData.category,
        description: productData.description,
        originLocation: productData.originLocation,
      });

    const seoKeywords =
      productData.seoKeywords && productData.seoKeywords.length > 0
        ? productData.seoKeywords
        : generateProductSeoKeywords({
            title: productData.title,
            category: productData.category,
            originLocation: productData.originLocation,
          });

    const canonicalUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://profarm-shiraz.ir'}/products/${slug}`;

    const newProduct: Product = {
      ...productData,
      id,
      slug,
      seoTitle,
      seoDescription,
      seoKeywords,
      canonicalUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.products.unshift(newProduct);
    this.saveProducts();
    return newProduct;
  }

  /** Copies a product as a hidden draft (isAvailable false) with a unique slug and id. */
  cloneProduct(slug: string): Product | null {
    const original = this.getProductBySlug(slug);
    if (!original) return null;
    const existingSlugs = new Set(this.products.map((p) => p.slug));
    let copySlug = `${original.slug}-copy`;
    for (let n = 2; existingSlugs.has(copySlug); n++) copySlug = `${original.slug}-copy-${n}`;
    const cloned: Product = {
      ...original,
      id: `prod-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      slug: copySlug,
      title: `${original.title} (نسخه رونوشت)`,
      isAvailable: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.products.unshift(cloned);
    this.saveProducts();
    return cloned;
  }

  updateProduct(id: string, updates: Partial<Product>): Product | null {
    const idx = this.products.findIndex((p) => p.id === id || p.slug === id);
    if (idx === -1) return null;
    const existing = this.products[idx];

    const title = updates.title || existing.title;
    const category = updates.category || existing.category;
    const originLocation = updates.originLocation || existing.originLocation;
    const description = updates.description || existing.description;
    const slug = updates.slug || existing.slug;

    const seoTitle =
      updates.seoTitle?.trim() ||
      existing.seoTitle ||
      generateProductSeoTitle({ title, category, originLocation });

    const seoDescription =
      updates.seoDescription?.trim() ||
      existing.seoDescription ||
      generateProductSeoDescription({ title, category, description, originLocation });

    const seoKeywords =
      updates.seoKeywords && updates.seoKeywords.length > 0
        ? updates.seoKeywords
        : existing.seoKeywords ||
          generateProductSeoKeywords({ title, category, originLocation });

    const canonicalUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://profarm-shiraz.ir'}/products/${slug}`;

    this.products[idx] = {
      ...existing,
      ...updates,
      slug,
      seoTitle,
      seoDescription,
      seoKeywords,
      canonicalUrl,
      updatedAt: new Date().toISOString(),
    };
    this.saveProducts();
    return this.products[idx];
  }

  decrementProductStock(idOrSlug: string, quantity: number): boolean {
    const product = this.products.find((p) => p.id === idOrSlug || p.slug === idOrSlug);
    if (!product) return false;
    const currentStock = product.stock ?? 0;
    const newStock = Math.max(0, currentStock - quantity);
    product.stock = newStock;
    if (newStock <= 0) {
      product.status = 'OUT_OF_STOCK';
    }
    product.updatedAt = new Date().toISOString();
    this.saveProducts();
    return true;
  }

  deleteProduct(id: string): boolean {
    const prevLen = this.products.length;
    this.products = this.products.filter((p) => p.id !== id && p.slug !== id);
    if (this.products.length < prevLen) {
      this.saveProducts();
      return true;
    }
    return false;
  }

  getLowStockProducts(threshold = 5): Product[] {
    return this.getProducts().filter(
      (p) => (p.stock !== undefined && p.stock <= threshold) || p.status === 'OUT_OF_STOCK'
    );
  }

  updateProductStock(idOrSlug: string, newStock: number): Product | null {
    const product = this.products.find((p) => p.id === idOrSlug || p.slug === idOrSlug);
    if (!product) return null;
    product.stock = Math.max(0, newStock);
    if (product.stock > 0 && product.status === 'OUT_OF_STOCK') {
      product.status = 'AVAILABLE';
    } else if (product.stock === 0) {
      product.status = 'OUT_OF_STOCK';
    }
    product.updatedAt = new Date().toISOString();
    this.saveProducts();
    return product;
  }

  resetProducts(): Product[] {
    this.products = [...INITIAL_PRODUCTS];
    this.saveServerState();
    return this.products;
  }

  // --- CATEGORIES ---
  getCategories(): string[] {
    return this.categories;
  }

  addCategory(categoryName: string): { success: boolean; message: string; categories: string[] } {
    const trimmed = categoryName.trim();
    if (!trimmed) {
      return { success: false, message: 'نام دسته‌بندی نمی‌تواند خالی باشد.', categories: this.getCategories() };
    }
    const current = this.getCategories();
    if (current.includes(trimmed)) {
      return { success: false, message: 'این دسته‌بندی از قبل در لیست وجود دارد.', categories: current };
    }
    this.categories = [...current, trimmed];
    this.saveServerState();
    return { success: true, message: `دسته‌بندی «${trimmed}» با موفقیت اضافه شد.`, categories: this.categories };
  }

  deleteCategory(categoryName: string): { success: boolean; message: string; categories: string[] } {
    if (categoryName === 'همه محصولات') {
      return { success: false, message: 'دسته‌بندی مرجع «همه محصولات» قابل حذف نیست.', categories: this.getCategories() };
    }
    const current = this.getCategories();
    this.categories = current.filter((c) => c !== categoryName);
    this.saveServerState();
    return { success: true, message: `دسته‌بندی «${categoryName}» با موفقیت حذف شد.`, categories: this.categories };
  }

  /**
   * Renames a category and moves every product that uses it to the new name, in one step.
   * The caller checks that the new name is free and that the old one is not the protected "all products" entry.
   */
  renameCategory(oldName: string, newName: string): { success: boolean; message: string } {
    const current = this.getCategories();
    if (!current.includes(oldName)) {
      return { success: false, message: 'دسته‌بندی مورد نظر یافت نشد.' };
    }
    this.categories = current.map((c) => (c === oldName ? newName : c));
    let moved = 0;
    for (const product of this.products) {
      if (product.category === oldName) {
        product.category = newName;
        product.updatedAt = new Date().toISOString();
        moved++;
      }
    }
    this.saveProducts();
    this.saveServerState();
    return { success: true, message: `دسته‌بندی به «${newName}» تغییر نام یافت (${moved} کالا منتقل شد).` };
  }

  resetCategories(): string[] {
    this.categories = [...INITIAL_CATEGORIES];
    this.saveServerState();
    return this.categories;
  }

  // --- TRAFFIC & ANALYTICS ---
  getSiteVisits(): { daily: number; monthly: number } {
    return {
      daily: 1420,
      monthly: 38650,
    };
  }

  getWeeklySalesData(): { day: string; amount: number; orderCount: number }[] {
    const paidOrders = this.getOrders().filter(isCountableSaleOrder);
    const days = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
    return days.map((day) => {
      const matching = paidOrders.filter((o) => {
        try {
          return formatToJalali(new Date(o.createdAt)).dayOfWeek === day;
        } catch {
          return false;
        }
      });
      return {
        day,
        amount: matching.reduce((sum, o) => sum + o.totalAmount, 0),
        orderCount: matching.length,
      };
    });
  }

  private calculateOrderCost(order: Order): number {
    if (order.isSubscription) return 0;
    return order.items.reduce((sum, item) => {
      // Prefer the cost snapshot taken at sale time; fall back to the live product for legacy orders
      if (typeof item.costPriceAtSale === 'number' && item.costPriceAtSale >= 0) {
        return sum + item.costPriceAtSale * item.quantity;
      }
      const prod =
        this.products.find((p) => p.id === item.productId || p.slug === item.productId) ||
        item.product;
      const unitCost = typeof prod?.costPrice === 'number' && prod.costPrice >= 0 ? prod.costPrice : 0;
      return sum + unitCost * item.quantity;
    }, 0);
  }

  // --- FINANCIAL ANALYTICS, DAILY, WEEKLY & MONTHLY PERIODS & EXCEL EXPORT (100% Real Paid Orders) ---
  getDailyFinancialStats(targetDate?: string): DailyShiftStat[] {
    const paidOrders = this.getOrders().filter(isCountableSaleOrder);
    const now = new Date();

    const shiftsConfig = [
      { id: 'morning', name: '۰۸:۰۰ الی ۱۲:۰۰ (صبح و تامین مزرعه)', startHour: 8, endHour: 12 },
      { id: 'noon', name: '۱۲:۰۰ الی ۱۶:۰۰ (ظهر و پردازش انبار)', startHour: 12, endHour: 16 },
      { id: 'afternoon', name: '۱۶:۰۰ الی ۲۰:۰۰ (عصر و تحویل پیک شیراز)', startHour: 16, endHour: 20 },
      { id: 'night', name: '۲۰:۰۰ الی ۲۴:۰۰ (شب و سفارش‌های آنلاین)', startHour: 20, endHour: 24 },
    ];

    const dateOrders = paidOrders.filter((o) => {
      const d = new Date(o.createdAt);
      if (isNaN(d.getTime())) return false;
      if (targetDate) {
        return d.toISOString().startsWith(targetDate);
      }
      return d.toDateString() === now.toDateString();
    });

    return shiftsConfig.map((shift) => {
      const shiftOrders = dateOrders.filter((o) => {
        const h = new Date(o.createdAt).getHours();
        return h >= shift.startHour && h < shift.endHour;
      });

      if (shiftOrders.length === 0) {
        return {
          shiftName: shift.name,
          ordersCount: 0,
          grossRevenue: 0,
          totalDiscount: 0,
          netRevenue: 0,
          grossProfit: 0,
          averageOrderValue: 0,
          topProduct: '-',
        };
      }

      const grossRevenue = shiftOrders.reduce(
        (sum, ord) =>
          sum +
          (ord.items.length > 0
            ? ord.items.reduce((s, it) => s + it.unitPrice * it.quantity, 0)
            : ord.totalAmount),
        0
      );
      const netRevenue = shiftOrders.reduce((sum, ord) => sum + ord.totalAmount, 0);
      const totalCost = shiftOrders.reduce((sum, ord) => sum + this.calculateOrderCost(ord), 0);
      const totalDiscount = Math.max(0, grossRevenue - netRevenue);
      const grossProfit = Math.max(0, netRevenue - totalCost);
      const averageOrderValue = Math.round(netRevenue / shiftOrders.length);

      const prodCounts: Record<string, number> = {};
      shiftOrders.forEach((ord) => {
        ord.items.forEach((item) => {
          const title = item.product?.title || item.productId;
          prodCounts[title] = (prodCounts[title] || 0) + item.quantity;
        });
      });
      const topProd = Object.entries(prodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

      return {
        shiftName: shift.name,
        ordersCount: shiftOrders.length,
        grossRevenue,
        totalDiscount,
        netRevenue,
        grossProfit,
        averageOrderValue,
        topProduct: topProd,
      };
    });
  }

  getWeeklyFinancialStats(weekFilter?: string): WeeklyDayStat[] {
    const paidOrders = this.getOrders().filter(isCountableSaleOrder);
    const now = new Date();
    const todayJalali = formatToJalali(now);

    const weekdaysConfig = [
      { dayName: 'شنبه', offset: -3 },
      { dayName: 'یکشنبه', offset: -2 },
      { dayName: 'دوشنبه', offset: -1 },
      { dayName: 'سه‌شنبه', offset: 0 },
      { dayName: 'چهارشنبه', offset: 1 },
      { dayName: 'پنج‌شنبه', offset: 2 },
      { dayName: 'جمعه', offset: 3 },
    ];

    return weekdaysConfig.map((wd) => {
      const isToday = wd.dayName === todayJalali.dayOfWeek;
      const targetDayNum = Math.max(1, Math.min(31, todayJalali.day + wd.offset));
      const dateStr = `${todayJalali.year}/${todayJalali.month.toString().padStart(2, '0')}/${targetDayNum.toString().padStart(2, '0')}`;

      const matchingOrders = paidOrders.filter((o) => {
        try {
          const d = new Date(o.createdAt);
          const diffDays = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
          return diffDays <= 7 && formatToJalali(d).dayOfWeek === wd.dayName;
        } catch {
          return false;
        }
      });

      if (matchingOrders.length === 0) {
        return {
          dayName: wd.dayName,
          date: dateStr,
          ordersCount: 0,
          grossRevenue: 0,
          totalDiscount: 0,
          netRevenue: 0,
          grossProfit: 0,
          averageOrderValue: 0,
          topGateway: '-',
          isToday,
        };
      }

      const grossRevenue = matchingOrders.reduce(
        (sum, ord) =>
          sum +
          (ord.items.length > 0
            ? ord.items.reduce((s, it) => s + it.unitPrice * it.quantity, 0)
            : ord.totalAmount),
        0
      );
      const netRevenue = matchingOrders.reduce((sum, ord) => sum + ord.totalAmount, 0);
      const totalCost = matchingOrders.reduce((sum, ord) => sum + this.calculateOrderCost(ord), 0);
      const totalDiscount = Math.max(0, grossRevenue - netRevenue);
      const grossProfit = Math.max(0, netRevenue - totalCost);
      const averageOrderValue = Math.round(netRevenue / matchingOrders.length);

      const gwCounts: Record<string, number> = {};
      matchingOrders.forEach((o) => {
        const g = o.payment?.gateway || 'زرین‌پال';
        gwCounts[g] = (gwCounts[g] || 0) + 1;
      });
      const topGw = Object.entries(gwCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

      return {
        dayName: wd.dayName,
        date: dateStr,
        ordersCount: matchingOrders.length,
        grossRevenue,
        totalDiscount,
        netRevenue,
        grossProfit,
        averageOrderValue,
        topGateway: topGw,
        isToday,
      };
    });
  }

  getMonthlyFinancialStats(year: number = 1405): MonthlyFinancialStat[] {
    const paidOrders = this.getOrders().filter(isCountableSaleOrder);
    const currentMonth = formatToJalali(new Date()).month;

    return PERSIAN_MONTHS.map((monthName, idx) => {
      const monthIndex = idx + 1;
      const isCurrentMonth = monthIndex === currentMonth;

      const monthOrders = paidOrders.filter((o) => {
        try {
          const jalali = formatToJalali(new Date(o.createdAt));
          return jalali.month === monthIndex && jalali.year === year;
        } catch {
          return false;
        }
      });

      if (monthOrders.length === 0) {
        return {
          monthIndex,
          monthName,
          year,
          ordersCount: 0,
          grossRevenue: 0,
          totalDiscount: 0,
          netRevenue: 0,
          grossProfit: 0,
          averageOrderValue: 0,
          topGateway: '-',
          isCurrentMonth,
        };
      }

      const grossRevenue = monthOrders.reduce(
        (sum, ord) =>
          sum +
          (ord.items.length > 0
            ? ord.items.reduce((s, it) => s + it.unitPrice * it.quantity, 0)
            : ord.totalAmount),
        0
      );
      const netRevenue = monthOrders.reduce((sum, ord) => sum + ord.totalAmount, 0);
      const totalCost = monthOrders.reduce((sum, ord) => sum + this.calculateOrderCost(ord), 0);
      const totalDiscount = Math.max(0, grossRevenue - netRevenue);
      const grossProfit = Math.max(0, netRevenue - totalCost);

      const gwCounts: Record<string, number> = {};
      monthOrders.forEach((o) => {
        const g = o.payment?.gateway || 'زرین‌پال';
        gwCounts[g] = (gwCounts[g] || 0) + 1;
      });
      const topGw = Object.entries(gwCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

      return {
        monthIndex,
        monthName,
        year,
        ordersCount: monthOrders.length,
        grossRevenue,
        totalDiscount,
        netRevenue,
        grossProfit,
        averageOrderValue: Math.round(netRevenue / monthOrders.length),
        topGateway: topGw,
        isCurrentMonth,
      };
    });
  }

  getFinancialRecords(timeframe?: string): FinancialRecord[] {
    const paidOrders = this.getOrders().filter(isCountableSaleOrder);
    const settings = this.getSubscriptionSettings();
    const now = new Date();

    const isPersianMonth = PERSIAN_MONTHS.includes(timeframe || '');
    const isPersianWeekday = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'].includes(timeframe || '');

    // Strict timeframe filtering — never fall back to all orders when a timeframe has 0 orders
    const filteredOrders = paidOrders.filter((order) => {
      if (!timeframe || timeframe === 'ALL' || timeframe === 'YEAR') return true;
      const orderDate = new Date(order.createdAt);
      if (isNaN(orderDate.getTime())) return false;

      if (isPersianMonth) {
        try {
          return formatToJalali(orderDate).monthName === timeframe;
        } catch {
          return false;
        }
      }

      if (isPersianWeekday) {
        try {
          return formatToJalali(orderDate).dayOfWeek === timeframe;
        } catch {
          return false;
        }
      }

      const diffDays = (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24);
      if (timeframe === 'TODAY' || timeframe === 'DAY') {
        return orderDate.toDateString() === now.toDateString();
      }
      if (timeframe === 'WEEK') {
        return diffDays <= 7;
      }
      if (timeframe === 'MONTH') {
        return diffDays <= 30;
      }
      return true;
    });

    return filteredOrders.map((order) => {
      const itemsGross =
        order.items.length > 0
          ? order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
          : order.totalAmount;
      const isPro = order.user?.tier === 'PRO' || (order.user?.isProMember && !order.user?.tier);
      const isPlus = order.user?.tier === 'PLUS';
      const customerTier: SubscriptionTier = order.user?.tier || (isPro ? 'PRO' : isPlus ? 'PLUS' : 'FREE');

      let shippingFee = order.isSubscription ? 0 : settings.baseShippingFee;
      if (!order.isSubscription && isPro) {
        shippingFee = Math.round(settings.baseShippingFee * (1 - settings.proShippingDiscountPercent / 100));
      }

      const calculatedExpected = itemsGross + shippingFee;
      const discountAmount = Math.max(0, calculatedExpected - order.totalAmount);
      const costAmount = this.calculateOrderCost(order);
      const profitAmount = Math.max(0, order.totalAmount - costAmount);

      const trackingCode = order.payment?.refId || order.orderNumber;

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        createdAt: order.createdAt,
        customerName: order.address?.recipientName || order.user?.name || 'مشتری پروفارم',
        customerPhone: order.address?.phone || order.user?.phone || '-',
        customerTier,
        grossAmount: itemsGross,
        discountAmount,
        shippingFee,
        netPayableAmount: order.totalAmount,
        costAmount,
        profitAmount,
        paymentGateway: order.payment?.gateway || 'زرین‌پال',
        paymentStatus: order.payment?.status || 'SUCCESS',
        orderStatus: order.status,
        itemCount: order.items.reduce((sum, i) => sum + i.quantity, 0),
        settlementStatus: 'SETTLED',
        settlementRef: trackingCode,
      };
    });
  }

  getFinancialSummary(timeframe?: string): FinancialSummary {
    const records = this.getFinancialRecords(timeframe);
    const currentYear = formatToJalali(new Date()).year;
    const monthlyStats = this.getMonthlyFinancialStats(currentYear);
    const weeklyStats = this.getWeeklyFinancialStats();
    const dailyStats = this.getDailyFinancialStats();

    const isPersianMonth = PERSIAN_MONTHS.includes(timeframe || '');
    const isPersianWeekday = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'].includes(timeframe || '');
    const isDaily = timeframe === 'TODAY' || timeframe === 'DAY';
    const isAllYear = !timeframe || timeframe === 'ALL' || timeframe === 'YEAR';

    const selectedPeriodLabel = isPersianMonth
      ? `ماه ${timeframe} ${currentYear}`
      : isPersianWeekday
      ? `روز ${timeframe}`
      : isDaily
      ? 'پایش امروز مزرعه'
      : timeframe === 'WEEK'
      ? 'عملکرد ۷ روز هفته جاری'
      : isAllYear
      ? 'کل سفارش‌های تاییدشده'
      : timeframe;

    // Strictly reconciled from filtered paid records so dashboard, finance, and CSV match 100%
    const grossRevenue = records.reduce((sum, r) => sum + r.grossAmount, 0);
    const totalDiscount = records.reduce((sum, r) => sum + r.discountAmount, 0);
    const netRevenue = records.reduce((sum, r) => sum + r.netPayableAmount, 0);
    const totalOrdersCount = records.length;
    const totalCost = records.reduce((sum, r) => sum + (r.costAmount || 0), 0);
    const grossProfit = Math.max(0, netRevenue - totalCost);
    const totalShipping = records.reduce((sum, r) => sum + r.shippingFee, 0);
    const averageOrderValue = totalOrdersCount > 0 ? Math.round(netRevenue / totalOrdersCount) : 0;
    const profitMarginPercent = netRevenue > 0 ? Math.round((grossProfit / netRevenue) * 100) : 0;

    // Payment Gateway Breakdown
    const gwMap = new Map<string, { amount: number; count: number }>();
    records.forEach((r) => {
      const gw = r.paymentGateway || 'شاپرک (سامان‌کیش)';
      const curr = gwMap.get(gw) || { amount: 0, count: 0 };
      curr.amount += r.netPayableAmount;
      curr.count += 1;
      gwMap.set(gw, curr);
    });

    const gatewayBreakdown: GatewayRevenue[] = Array.from(gwMap.entries())
      .map(([gateway, data]) => ({
        gateway,
        label: gateway,
        totalAmount: data.amount,
        count: data.count,
        percentage: netRevenue > 0 ? Math.round((data.amount / netRevenue) * 100) : 0,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    const proCount = this.getAllUsers().filter((u) => u.tier === 'PRO' || u.isProMember).length;
    const plusCount = this.getAllUsers().filter((u) => u.tier === 'PLUS').length;
    const settings = this.getSubscriptionSettings();
    const subscriptionRevenue = proCount * settings.proMonthlyPrice + plusCount * settings.plusMonthlyPrice;

    // Category breakdown derived strictly from the active timeframe's countable paid records
    const orderIdSet = new Set(records.map((r) => r.id));
    const timeframeOrders = this.orders.filter((o) => orderIdSet.has(o.id));
    const catMap = new Map<string, { revenue: number; count: number }>();
    timeframeOrders.forEach((ord) => {
      ord.items.forEach((item) => {
        const cat = item.product?.category || 'محصولات مزرعه';
        const current = catMap.get(cat) || { revenue: 0, count: 0 };
        current.revenue += item.totalPrice;
        current.count += item.quantity;
        catMap.set(cat, current);
      });
    });

    const totalCatRevenue = Array.from(catMap.values()).reduce((sum, c) => sum + c.revenue, 0) || 1;
    const categoryRevenues: CategoryRevenue[] = Array.from(catMap.entries())
      .map(([category, data]) => ({
        category,
        revenue: data.revenue,
        ordersCount: data.count,
        percentage: Math.round((data.revenue / totalCatRevenue) * 100),
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const tierMap: Record<SubscriptionTier, { revenue: number; count: number }> = {
      PRO: { revenue: 0, count: 0 },
      PLUS: { revenue: 0, count: 0 },
      FREE: { revenue: 0, count: 0 },
    };

    records.forEach((r) => {
      tierMap[r.customerTier].revenue += r.netPayableAmount;
      tierMap[r.customerTier].count += 1;
    });

    const tierRevenues: TierRevenue[] = [
      {
        tier: 'PRO',
        label: 'مشترکین طلایی پرو',
        revenue: tierMap.PRO.revenue,
        ordersCount: tierMap.PRO.count,
        percentage: netRevenue > 0 ? Math.round((tierMap.PRO.revenue / netRevenue) * 100) : 0,
      },
      {
        tier: 'PLUS',
        label: 'مشترکین نقره‌ای پلاس',
        revenue: tierMap.PLUS.revenue,
        ordersCount: tierMap.PLUS.count,
        percentage: netRevenue > 0 ? Math.round((tierMap.PLUS.revenue / netRevenue) * 100) : 0,
      },
      {
        tier: 'FREE',
        label: 'کاربران عمومی و عادی',
        revenue: tierMap.FREE.revenue,
        ordersCount: tierMap.FREE.count,
        percentage: netRevenue > 0 ? Math.round((tierMap.FREE.revenue / netRevenue) * 100) : 0,
      },
    ];

    return {
      grossRevenue,
      totalDiscount,
      netRevenue,
      totalShipping,
      averageOrderValue,
      totalOrdersCount,
      subscriptionRevenue,
      totalCost,
      grossProfit,
      profitMarginPercent,
      gatewayBreakdown,
      categoryRevenues,
      tierRevenues,
      monthlyStats,
      weeklyStats,
      dailyStats,
      selectedPeriodLabel,
      selectedMonthName: selectedPeriodLabel,
    };
  }

  exportFinancialCsv(timeframe?: string): string {
    const records = this.getFinancialRecords(timeframe);
    const BOM = '\uFEFF';
    const headers = [
      'ردیف',
      'شماره سفارش',
      'تاریخ و ساعت ثبت',
      'نام خریدار',
      'شماره موبایل',
      'سطح اشتراک',
      'تعداد اقلام',
      'مبلغ ناخالص کالاها (تومان)',
      'تخفیف اعطا شده (تومان)',
      'کرایه حمل شیراز (تومان)',
      'مبلغ خالص پرداختی (تومان)',
      'بهای تمام شده خرید (تومان)',
      'سود ناخالص سفارش (تومان)',
      'درگاه و روش پرداخت',
      'وضعیت پرداخت شاپرک',
      'وضعیت سفارش',
      'کد رهگیری تراکنش شاپرک',
    ];

    const rows = records.map((r, idx) => [
      idx + 1,
      `"${r.orderNumber}"`,
      `"${new Date(r.createdAt).toLocaleString('fa-IR')}"`,
      `"${r.customerName.replace(/"/g, '""')}"`,
      `"${r.customerPhone}"`,
      `"${r.customerTier === 'PRO' ? 'مشترک پرو' : r.customerTier === 'PLUS' ? 'مشترک پلاس' : 'کاربر عادی'}"`,
      r.itemCount,
      r.grossAmount,
      r.discountAmount,
      r.shippingFee,
      r.netPayableAmount,
      r.costAmount || 0,
      r.profitAmount || 0,
      `"${r.paymentGateway}"`,
      `"${r.paymentStatus === 'SUCCESS' ? 'موفق' : 'ناموفق'}"`,
      `"${r.orderStatus === 'DELIVERED' ? 'تحویل‌شده' : r.orderStatus === 'OUT_FOR_DELIVERY' ? 'در مسیر تحویل' : 'در حال پردازش'}"`,
      `"${r.settlementRef || '-'}"`,
    ]);

    return BOM + [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
  }

  /** Replaces the saved address book of one account. Used by /api/account/addresses. Returns null for an unknown account. */
  setUserAddresses(userId: string, addresses: Address[]): User | null {
    const user = this.getAllUsers().find((u) => u.id === userId);
    if (!user) return null;
    user.addresses = addresses;
    this.saveUsers();
    return user;
  }

  // --- USERS & PRO MEMBERSHIP ---
  private saveUsers(): void {
    this.saveServerState();
  }

  getUserByPhone(phone: string): User | undefined {
    this.getAllUsers();
    if (!phone) return undefined;
    const clean = normalizePhoneNumber(phone);
    for (const u of this.users.values()) {
      if (u.phone && normalizePhoneNumber(u.phone) === clean) {
        return u;
      }
    }
    return this.users.get(phone);
  }

  getOrCreateUser(phone: string, name?: string, username?: string, password?: string): User {
    this.getAllUsers();
    const cleanPhone = normalizePhoneNumber(phone) || phone;
    let user = this.getUserByPhone(cleanPhone);
    if (!user) {
      const generatedUsername =
        username?.trim() || `user_${cleanPhone.slice(-4) || Date.now().toString().slice(-4)}`;
      user = {
        id: `usr-${Date.now()}`,
        phone: cleanPhone,
        username: generatedUsername,
        name: name?.trim() || 'کاربر گرامی',
        role: 'USER',
        authProvider: password ? 'PASSWORD' : 'PHONE_OTP',
        password: password ? hashPassword(password.trim()) : undefined,
        isProMember: false,
        createdAt: new Date().toISOString(),
      };
      this.indexUser(user);
      this.saveUsers();
    } else {
      let updated = false;
      if (name && name.trim() && (user.name === 'کاربر گرامی' || !user.name)) {
        user.name = name.trim();
        updated = true;
      }
      if (username && username.trim() && !user.username) {
        user.username = username.trim();
        updated = true;
      } else if (!user.username) {
        user.username = `user_${cleanPhone.slice(-4) || 'member'}`;
        updated = true;
      }
      if (password && password.trim() && !user.password) {
        user.password = hashPassword(password.trim());
        user.authProvider = 'PASSWORD';
        updated = true;
      }
      if (updated) {
        this.indexUser(user);
        this.saveUsers();
      }
    }
    return user;
  }

  getUserByEmail(email?: string | null): User | undefined {
    this.getAllUsers();
    if (!email) return undefined;
    const clean = email.trim().toLowerCase();
    for (const u of this.users.values()) {
      if (u.email && u.email.trim().toLowerCase() === clean) {
        return u;
      }
    }
    return undefined;
  }

  registerUser(params: {
    name: string;
    email?: string;
    phone?: string;
    /** true only when the caller verified the phone with an OTP (phoneProof) */
    phoneVerified?: boolean;
    username?: string;
    password?: string;
  }): User {
    this.getAllUsers();
    const cleanEmail = params.email?.trim().toLowerCase();
    const cleanPhone = params.phone ? normalizePhoneNumber(params.phone) : undefined;

    if (!cleanEmail && !cleanPhone) {
      throw new BusinessError('لطفاً ایمیل معتبر یا شماره تلفن همراه خود را وارد نمایید.');
    }

    // Auto-generate username: email or phone (no separate username required)
    const autoUsername =
      params.username?.trim() || cleanEmail || cleanPhone || `user_${Date.now().toString().slice(-4)}`;

    // Check unique email if provided
    if (cleanEmail) {
      const existingByEmail = this.getUserByEmail(cleanEmail);
      if (existingByEmail) {
        if (existingByEmail.role === 'ADMIN') {
          throw new BusinessError('این ایمیل متعلق به حساب مدیر سیستم است و امکان ثبت‌نام مجدد ندارد.', 409);
        }
        throw new BusinessError('حساب کاربری دیگری با این آدرس ایمیل از قبل ثبت شده است. لطفاً وارد شوید.', 409);
      }
    }

    // Check unique phone if provided
    if (cleanPhone) {
      const existingByPhone = this.getUserByPhone(cleanPhone);
      if (existingByPhone) {
        if (existingByPhone.role === 'ADMIN') {
          throw new BusinessError('این شماره متعلق به حساب مدیر سیستم است و امکان ثبت‌نام مجدد ندارد.', 409);
        }
        throw new BusinessError('حساب کاربری با این شماره تلفن از قبل وجود دارد. لطفاً وارد شوید.', 409);
      }
    }

    const userId = `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const user: User = {
      id: userId,
      phone: cleanPhone || '',
      isPhoneVerified: Boolean(cleanPhone && params.phoneVerified),
      username: autoUsername,
      email: cleanEmail || null,
      name: params.name?.trim() || 'کاربر گرامی',
      role: 'USER',
      authProvider: params.password ? 'PASSWORD' : 'PHONE_OTP',
      password: params.password ? hashPassword(params.password.trim()) : undefined,
      isProMember: false,
      createdAt: new Date().toISOString(),
    };

    this.indexUser(user);
    this.saveUsers();
    return user;
  }

  attachVerifiedPhoneToUser(
    userIdOrEmail: string,
    rawPhone: string
  ): { success: boolean; user?: User; message?: string } {
    this.getAllUsers();
    const cleanPhone = normalizePhoneNumber(rawPhone);
    if (!cleanPhone || cleanPhone.length !== 11 || !cleanPhone.startsWith('09')) {
      return { success: false, message: 'شماره تلفن همراه وارد شده نامعتبر است.' };
    }

    // Find target user
    const targetUser = Array.from(this.users.values()).find(
      (u) =>
        u.id === userIdOrEmail ||
        (u.email && u.email.toLowerCase() === userIdOrEmail.toLowerCase()) ||
        (u.username && u.username.toLowerCase() === userIdOrEmail.toLowerCase()) ||
        (u.phone && normalizePhoneNumber(u.phone) === normalizePhoneNumber(userIdOrEmail))
    );

    if (!targetUser) {
      return { success: false, message: 'حساب کاربری مورد نظر یافت نشد.' };
    }

    // Check if phone belongs to another user with established credentials
    const existingWithPhone = this.getUserByPhone(cleanPhone);
    if (existingWithPhone && existingWithPhone.id !== targetUser.id) {
      if (!existingWithPhone.email && !existingWithPhone.password) {
        // Merge the anonymous placeholder into the target account: remove every index entry of the placeholder
        // (previously only its phone key was removed, which left a duplicate copy behind) and move its orders.
        this.unindexUser(existingWithPhone);
        for (const order of this.orders) {
          if (order.userId === existingWithPhone.id) order.userId = targetUser.id;
        }
      } else {
        return {
          success: false,
          message: 'این شماره همراه قبلاً در حساب کاربری دیگری ثبت و تایید شده است.',
        };
      }
    }

    targetUser.phone = cleanPhone;
    targetUser.isPhoneVerified = true;

    this.indexUser(targetUser);
    this.saveUsers();

    return {
      success: true,
      user: sanitizeUser(targetUser),
      message: 'شماره تلفن همراه با موفقیت تایید و در حساب کاربری شما ذخیره گردید.',
    };
  }

  /**
   * Updates the profile of the account with the given id. Only whitelisted fields are applied.
   * Email and username must stay unique (case-insensitive). A password change on an account that
   * already has a password requires `currentPassword`. Changing the email clears isEmailVerified.
   */
  updateUserProfile(
    userId: string,
    updates: {
      name?: string;
      username?: string;
      email?: string | null;
      password?: string;
      currentPassword?: string;
      nationalId?: string | null;
      birthDate?: string | null;
      smsNotificationEnabled?: boolean;
    }
  ): { success: boolean; user?: User; message?: string; status?: number } {
    this.getAllUsers();
    const user = Array.from(this.users.values()).find((u) => u.id === userId);

    if (!user) {
      return { success: false, message: 'حساب کاربری مورد نظر یافت نشد.', status: 404 };
    }

    const allUsers = Array.from(this.users.values()).filter((u, idx, arr) => arr.indexOf(u) === idx);

    // Usernames must not look like a phone number or an email address (they are used as login identifiers)
    if (typeof updates.username === 'string' && updates.username.trim()) {
      const rawUname = toEnglishDigits(updates.username.trim());
      if (rawUname.includes('@') || /^[+]?[\d\s\-()]+$/.test(rawUname) || isValidIranPhone(rawUname)) {
        return {
          success: false,
          message: 'نام کاربری نمی‌تواند شماره تلفن یا آدرس ایمیل باشد.',
          status: 400,
        };
      }
    }

    // Username uniqueness
    if (typeof updates.username === 'string' && updates.username.trim()) {
      const cleanUname = updates.username.trim().toLowerCase();
      const existing = allUsers.find(
        (u) => u.id !== user.id && u.username && u.username.toLowerCase() === cleanUname
      );
      if (existing) {
        return { success: false, message: 'این نام کاربری قبلاً توسط کاربر دیگری انتخاب شده است.', status: 409 };
      }
    }

    // Email uniqueness and format
    let nextEmail: string | null | undefined = undefined;
    if (updates.email !== undefined) {
      const cleanEmail = typeof updates.email === 'string' ? updates.email.trim().toLowerCase() : '';
      if (cleanEmail) {
        if (!isValidEmail(cleanEmail)) {
          return { success: false, message: 'فرمت آدرس ایمیل نامعتبر است.', status: 400 };
        }
        const takenBy = allUsers.find(
          (u) => u.id !== user.id && u.email && u.email.trim().toLowerCase() === cleanEmail
        );
        if (takenBy) {
          return { success: false, message: 'این آدرس ایمیل قبلاً برای حساب کاربری دیگری ثبت شده است.', status: 409 };
        }
      }
      nextEmail = cleanEmail || null;
    }

    // Password change (validated before anything is mutated)
    let nextPasswordHash: string | undefined = undefined;
    if (typeof updates.password === 'string' && updates.password.trim()) {
      const newPassword = updates.password.trim();
      if (newPassword.length < 8) {
        return { success: false, message: 'کلمه عبور باید حداقل ۸ کاراکتر باشد.', status: 400 };
      }
      if (user.password) {
        const currentPassword = typeof updates.currentPassword === 'string' ? updates.currentPassword.trim() : '';
        if (!currentPassword || !verifyPassword(currentPassword, user.password)) {
          return { success: false, message: 'کلمه عبور فعلی وارد شده نادرست است.', status: 403 };
        }
      }
      nextPasswordHash = hashPassword(newPassword);
    }

    if (typeof updates.name === 'string' && updates.name.trim()) user.name = updates.name.trim();
    if (typeof updates.username === 'string' && updates.username.trim()) user.username = updates.username.trim();
    if (nextEmail !== undefined) {
      if ((nextEmail || null) !== (user.email ? user.email.trim().toLowerCase() : null)) {
        user.isEmailVerified = false;
      }
      user.email = nextEmail;
    }
    if (updates.nationalId !== undefined) user.nationalId = updates.nationalId ? String(updates.nationalId).trim() : null;
    if (updates.birthDate !== undefined) user.birthDate = updates.birthDate ? String(updates.birthDate).trim() : null;
    if (typeof updates.smsNotificationEnabled === 'boolean') user.smsNotificationEnabled = updates.smsNotificationEnabled;
    if (nextPasswordHash) {
      user.password = nextPasswordHash;
      user.authProvider = 'PASSWORD';
    }

    this.indexUser(user);
    this.saveUsers();

    return { success: true, user: sanitizeUser(user), message: 'اطلاعات حساب کاربری با موفقیت به‌روزرسانی شد.' };
  }

  getOrCreateGoogleUser(googleUser: { email: string; name?: string; picture?: string }): User {
    this.getAllUsers();
    const cleanEmail = googleUser.email.trim().toLowerCase();
    const usersWithEmail = Array.from(this.users.values()).filter(
      (u, idx, arr) => arr.indexOf(u) === idx && u.email && u.email.trim().toLowerCase() === cleanEmail
    );

    // SECURITY: Prevent privilege escalation via Google Auth
    // Under no circumstance can an OAuth claim hijack or access an ADMIN account.
    if (usersWithEmail.some((u) => u.role === 'ADMIN')) {
      console.warn(`[Security Alert] Blocked OAuth login attempt targeting admin email: ${cleanEmail}`);
      throw new BusinessError(
        'ورود با حساب گوگل برای مدیران سیستم مجاز نمی‌باشد. لطفاً از فرم اختصاصی ورود مدیریت استفاده نمایید.',
        403
      );
    }

    // Link only to an account whose email was verified by Google (isEmailVerified is set only here).
    // An account that merely claims the email (password registration, profile edit) is never linked,
    // so a pre-registered email cannot take over a Google login.
    const verifiedUser = usersWithEmail.find((u) => u.isEmailVerified === true);
    if (verifiedUser) {
      return verifiedUser;
    }

    const user: User = {
      id: `usr-g-${Date.now()}`,
      phone: '',
      name: googleUser.name || cleanEmail.split('@')[0],
      email: cleanEmail,
      isEmailVerified: true,
      avatarUrl: googleUser.picture,
      authProvider: 'GOOGLE',
      role: 'USER', // Strictly USER role
      isProMember: false,
      createdAt: new Date().toISOString(),
    };
    this.indexUser(user);
    this.saveUsers();
    return user;
  }

  verifyUserPassword(identifier: string, pass: string): User | null {
    this.getAllUsers();
    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = pass.trim();

    // Find by username, phone, email, or id
    const user = Array.from(this.users.values()).find(
      (u) =>
        (u.username && u.username.toLowerCase() === cleanId) ||
        u.phone === cleanId ||
        (u.email && u.email.toLowerCase() === cleanId) ||
        u.id.toLowerCase() === cleanId
    );

    if (!user) return null;

    // Cryptographic PBKDF2 verification (no plaintext fallbacks allowed)
    const isHashValid = verifyPassword(cleanPass, user.password);

    if (isHashValid) {
      // Opportunistically upgrade stored password to current PBKDF2 (210,000 iterations) if needed
      if (needsPasswordRehash(user.password)) {
        user.password = hashPassword(cleanPass);
        this.indexUser(user);
        this.saveUsers();
      }
      return user;
    }

    return null;
  }

  setUserPassword(phone: string, pass: string): boolean {
    this.getAllUsers();
    const user = this.users.get(phone);
    if (!user) return false;
    user.password = hashPassword(pass.trim());
    this.indexUser(user);
    this.saveUsers();
    return true;
  }

  toggleProMembership(phone: string, isPro: boolean, expiryDate?: string): User | null {
    this.getAllUsers();
    const user = this.users.get(phone);
    if (!user) return null;
    user.isProMember = isPro;
    user.tier = isPro ? 'PRO' : 'FREE';
    user.proExpiresAt = isPro ? expiryDate || '۱۴۰۵/۱۲/۲۹' : null;
    this.indexUser(user);
    this.saveUsers();
    return user;
  }

  updateUserSubscription(identifier: string, tier: SubscriptionTier, expiryDate?: string | null): User | null {
    this.getAllUsers();
    let user = this.users.get(identifier);
    if (!user) {
      user = Array.from(this.users.values()).find((u) => u.id === identifier || u.phone === identifier);
    }
    if (!user) return null;

    const previousTier = getEffectiveTier(user);
    user.tier = tier;
    user.subscriptionTier = tier;
    user.isProMember = tier === 'PRO';
    user.isPlusMember = tier === 'PLUS';
    if (tier === 'PRO') {
      user.proExpiresAt = expiryDate || '۱۴۰۵/۱۲/۲۹';
      user.plusExpiresAt = null;
    } else if (tier === 'PLUS') {
      user.plusExpiresAt = expiryDate || '۱۴۰۵/۱۲/۲۹';
      user.proExpiresAt = null;
    } else {
      user.proExpiresAt = null;
      user.plusExpiresAt = null;
    }
    this.indexUser(user);
    this.saveUsers();

    // Subscription SMS only when the effective tier really changes (a same-tier update sends nothing)
    if (tier !== 'FREE' && previousTier !== tier) {
      this.sendSubscriptionActivatedSms(user, tier);
    }

    return user;
  }

  /** Sends the SUBSCRIPTION_ACTIVATED template to the account phone, when the template is enabled. */
  private sendSubscriptionActivatedSms(user: User, tier: 'PLUS' | 'PRO'): void {
    if (!user.phone) return;
    const vars: Record<string, string> = {
      '{customerName}': user.name || 'کاربر گرامی',
      '{tierName}': tier === 'PRO' ? 'پروفارم پرو (طلایی ۶ روزه)' : 'پروفارم پلاس (۵٪ تخفیف)',
      '{expiresAt}': formatSubscriptionExpiry(user.proExpiresAt || user.plusExpiresAt) || '۱۴۰۵/۱۲/۲۹',
      '{siteUrl}': 'profarm.ir',
    };
    const rendered = this.renderEventSms('SUBSCRIPTION_ACTIVATED', vars);
    if (rendered && rendered.isEnabled && rendered.message) {
      sendCustomSms(user.phone, rendered.message, user.email);
    }
  }

  /**
   * Admin tier change for one account (by id). FREE clears both plans. PLUS or PRO extends that plan by `months`
   * (from the current expiry while it still runs, otherwise from now). SMS is sent only when the effective tier
   * changes, so a same-tier renewal stays silent.
   */
  setUserTier(userId: string, tier: SubscriptionTier, months = 1): User | null {
    this.getAllUsers();
    const user = Array.from(this.users.values()).find((u) => u.id === userId);
    if (!user) return null;
    if (tier === 'FREE') {
      return this.updateUserSubscription(userId, 'FREE', null);
    }
    const previousTier = getEffectiveTier(user);
    const updated = this.activateSubscriptionForUser(userId, tier, months);
    if (updated && previousTier !== tier) {
      this.sendSubscriptionActivatedSms(updated, tier);
    }
    return updated;
  }

  /**
   * Activates a paid PLUS or PRO plan for the account with this id (called after a verified payment).
   * Expiry is stored as an ISO timestamp. If the current expiry for the plan is still in the future,
   * the new period is added on top of it; otherwise it starts now. Legacy Jalali dates are read as well (see getSubscriptionExpiryMs).
   */
  activateSubscriptionForUser(userId: string, plan: 'PLUS' | 'PRO', months: number): User | null {
    this.getAllUsers();
    const user = Array.from(this.users.values()).find((u) => u.id === userId);
    if (!user) return null;

    const DAY_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();
    // Same expiry reader as the tier check, so Jalali (legacy) and ISO dates both extend correctly.
    const currentMs = getSubscriptionExpiryMs(user, plan) ?? NaN;
    const base = Number.isFinite(currentMs) && currentMs > now ? currentMs : now;
    const expiresAt = new Date(base + Math.max(1, months) * 30 * DAY_MS).toISOString();

    user.tier = plan;
    user.subscriptionTier = plan;
    user.isProMember = plan === 'PRO';
    user.isPlusMember = plan === 'PLUS';
    if (plan === 'PRO') {
      user.proExpiresAt = expiresAt;
    } else {
      user.plusExpiresAt = expiresAt;
    }

    this.indexUser(user);
    this.saveUsers();
    return user;
  }

  /**
   * Completes a phone-only account (created by OTP sign-in, no password yet) through POST /api/auth/register.
   * The caller must have verified the phone with phoneProof. Admins and accounts that already have a password are refused.
   */
  completePhoneRegistration(
    userId: string,
    params: { name: string; email?: string; password?: string }
  ): { success: boolean; user?: User; message?: string; status?: number } {
    this.getAllUsers();
    const user = Array.from(this.users.values()).find((u) => u.id === userId);
    if (!user) {
      return { success: false, message: 'حساب کاربری مورد نظر یافت نشد.', status: 404 };
    }
    if (user.role === 'ADMIN' || user.password) {
      return { success: false, message: 'حساب کاربری با این شماره تلفن از قبل وجود دارد. لطفاً وارد شوید.', status: 409 };
    }

    const cleanEmail = params.email?.trim().toLowerCase() || undefined;
    if (cleanEmail) {
      if (user.email && user.email.trim().toLowerCase() !== cleanEmail) {
        return { success: false, message: 'این شماره تلفن به حساب کاربری با ایمیل دیگری متصل است.', status: 409 };
      }
      const takenBy = Array.from(this.users.values()).find(
        (u) => u.id !== user.id && u.email && u.email.trim().toLowerCase() === cleanEmail
      );
      if (takenBy) {
        return { success: false, message: 'این آدرس ایمیل قبلاً برای حساب کاربری دیگری ثبت شده است.', status: 409 };
      }
    }

    if (params.name && params.name.trim()) user.name = params.name.trim();
    if (cleanEmail) user.email = cleanEmail;
    if (params.password && params.password.trim()) {
      user.password = hashPassword(params.password.trim());
      user.authProvider = 'PASSWORD';
    }
    user.isPhoneVerified = true;

    this.indexUser(user);
    this.saveUsers();
    return { success: true, user };
  }

  updateUserRole(identifier: string, role: UserRole): User | null {
    this.getAllUsers();
    let user = this.users.get(identifier);
    if (!user) {
      user = Array.from(this.users.values()).find((u) => u.id === identifier || u.phone === identifier);
    }
    if (!user) return null;
    user.role = role;
    this.indexUser(user);
    this.saveUsers();
    return user;
  }

  getAllUsers(): User[] {
    return this.uniqueUsers();
  }

  // --- EMAIL DISPATCH & LOGS ---
  getEmailLogs(): EmailMessageLog[] {
    return this.emailLogs;
  }

  addEmailLog(log: EmailMessageLog): void {
    this.emailLogs.unshift(log);
    if (this.emailLogs.length > 500) {
      this.emailLogs = this.emailLogs.slice(0, 500);
    }
    this.saveServerState();
  }

  // --- RETURNS & REFUNDS ---
  getReturnRequests(): ReturnRequest[] {
    return this.returnRequests;
  }

  private saveReturnRequests(): void {
    this.saveServerState();
  }

  createReturnRequest(data: Omit<ReturnRequest, 'id' | 'createdAt' | 'updatedAt'>): ReturnRequest {
    const newReq: ReturnRequest = {
      ...data,
      // Random suffix: several lines of one return can be created within the same millisecond.
      id: `ret-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      createdAt: new Date().toLocaleDateString('fa-IR'),
      updatedAt: new Date().toLocaleDateString('fa-IR'),
    };
    this.returnRequests.unshift(newReq);
    this.saveReturnRequests();
    return newReq;
  }

  /**
   * Updates a return request. Allowed moves: PENDING -> APPROVED | REJECTED; APPROVED -> REFUNDED | REJECTED.
   * REFUNDED and REJECTED are final. A refund cannot exceed what was actually paid on the order.
   */
  updateReturnStatus(
    id: string,
    status: ReturnStatus,
    adminNotes?: string,
    options: { refundAmount?: number } = {}
  ): ReturnRequest | null {
    const req = this.returnRequests.find((r) => r.id === id);
    if (!req) return null;

    const transition = canTransitionReturn(req.status, status);
    if (!transition.allowed) {
      throw new BusinessError(transition.reason || 'تغییر وضعیت مرجوعی مجاز نیست.', 400);
    }
    // Refund amount is validated before anything is changed, so a refused request leaves the record untouched.
    const nextRefund = options.refundAmount !== undefined ? Number(options.refundAmount) : Number(req.refundAmount);
    if (status === 'REFUNDED') {
      const refund = nextRefund;
      if (!Number.isFinite(refund) || refund < 0) {
        throw new BusinessError('مبلغ عودت نامعتبر است.', 400);
      }
      const order = this.getOrders().find((o) => o.orderNumber === req.orderNumber);
      if (!order) {
        throw new BusinessError('سفارش مرتبط با این درخواست مرجوعی یافت نشد.', 400);
      }
      const paidAmount = isCountableSaleOrder(order) ? order.totalAmount : 0;
      if (refund > paidAmount) {
        throw new BusinessError(
          `مبلغ عودت نمی‌تواند بیشتر از مبلغ پرداخت‌شده سفارش (${paidAmount.toLocaleString('fa-IR')} تومان) باشد.`,
          400
        );
      }
    }

    req.status = status;
    if (options.refundAmount !== undefined && Number.isFinite(nextRefund)) req.refundAmount = nextRefund;
    if (adminNotes !== undefined) req.adminNotes = adminNotes;
    req.updatedAt = new Date().toLocaleDateString('fa-IR');
    this.saveReturnRequests();

    // Trigger automated SMS for return status update
    if (req.customerPhone) {
      const statusLabels: Record<ReturnStatus, string> = {
        PENDING: 'در انتظار بررسی',
        APPROVED: 'تایید عودت کالا',
        REFUNDED: 'مبلغ عودت داده شد به حساب',
        REJECTED: 'رد درخواست',
      };
      const vars: Record<string, string> = {
        '{customerName}': req.customerName,
        '{orderNumber}': req.orderNumber,
        '{returnStatus}': statusLabels[status] || status,
        '{adminNote}': adminNotes || 'بررسی پرونده انجام شد.',
      };
      const rendered = this.renderEventSms('RETURN_STATUS_CHANGED', vars);
      if (rendered && rendered.isEnabled && rendered.message) {
        sendCustomSms(req.customerPhone, rendered.message);
      }
    }

    return req;
  }

  // --- SMS EVENT TEMPLATES (CONFIGURABLE NOTIFICATIONS) ---
  getSmsEventTemplates(): SmsEventTemplate[] {
    return this.smsEventTemplates;
  }

  getSmsEventTemplateById(id: SmsEventType): SmsEventTemplate | undefined {
    return this.getSmsEventTemplates().find((t) => t.id === id);
  }

  updateSmsEventTemplate(
    id: SmsEventType,
    updates: Partial<Pick<SmsEventTemplate, 'template' | 'isEnabled'>>
  ): SmsEventTemplate | null {
    const tmpl = this.getSmsEventTemplates().find((t) => t.id === id);
    if (!tmpl) return null;
    if (updates.template !== undefined) tmpl.template = updates.template;
    if (updates.isEnabled !== undefined) tmpl.isEnabled = updates.isEnabled;
    tmpl.updatedAt = new Date().toLocaleDateString('fa-IR');
    this.saveServerState();
    return tmpl;
  }

  resetSmsEventTemplate(id: SmsEventType): SmsEventTemplate | null {
    const defaultTmpl = DEFAULT_SMS_EVENT_TEMPLATES.find((t) => t.id === id);
    if (!defaultTmpl) return null;
    const tmpl = this.getSmsEventTemplates().find((t) => t.id === id);
    if (!tmpl) return null;
    tmpl.template = defaultTmpl.template;
    tmpl.isEnabled = defaultTmpl.isEnabled;
    tmpl.updatedAt = new Date().toLocaleDateString('fa-IR');
    this.saveServerState();
    return tmpl;
  }

  renderEventSms(
    id: SmsEventType,
    variables: Record<string, string>
  ): { message: string; isEnabled: boolean } | null {
    const tmpl = this.getSmsEventTemplateById(id);
    if (!tmpl) return null;
    if (!tmpl.isEnabled) return { message: '', isEnabled: false };

    let text = tmpl.template;
    for (const [key, val] of Object.entries(variables)) {
      text = text.replaceAll(key, val);
    }
    return { message: text, isEnabled: true };
  }

  // --- SMS PROVIDER / API GATEWAY SETTINGS ---
  getSmsSettings(): SmsProviderSettings {
    return this.smsSettings;
  }

  updateSmsSettings(settings: Partial<SmsProviderSettings>): SmsProviderSettings {
    this.smsSettings = {
      ...this.getSmsSettings(),
      ...settings,
      updatedAt: new Date().toLocaleDateString('fa-IR'),
    };
    this.saveServerState();
    return this.smsSettings;
  }

  // --- EMAIL PROVIDER / SMTP SETTINGS ---
  getEmailSettings(): EmailProviderSettings {
    return this.emailSettings;
  }

  updateEmailSettings(settings: Partial<EmailProviderSettings>): EmailProviderSettings {
    this.emailSettings = {
      ...this.getEmailSettings(),
      ...settings,
      updatedAt: new Date().toLocaleDateString('fa-IR'),
    };
    this.saveServerState();
    return this.emailSettings;
  }

  // --- SMS BROADCAST & CAMPAIGNS ---
  getSmsBroadcasts(): SmsBroadcast[] {
    return this.smsBroadcasts;
  }

  createSmsBroadcast(data: Omit<SmsBroadcast, 'id' | 'createdAt' | 'sentAt'>): SmsBroadcast {
    const newSms: SmsBroadcast = {
      ...data,
      id: `sms-b-${Date.now()}`,
      sentAt: new Date().toLocaleDateString('fa-IR') + ' - ' + new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      createdAt: new Date().toISOString(),
    };
    this.smsBroadcasts.unshift(newSms);
    this.saveServerState();
    return newSms;
  }

  // --- PAYMENT TIMEOUT (one value for every expiry check) ---
  /** Minutes an online payment may stay pending before the order is auto-cancelled. Default 30. */
  getPaymentTimeoutMinutes(): number {
    const v = Number(this.paymentSettings?.general?.paymentTimeoutMinutes);
    return Number.isFinite(v) && v > 0 ? v : 30;
  }

  // --- SLOTS (server is the source of truth: closures and capacity live here, occupancy comes from orders) ---
  /**
   * Orders holding a place on a slot. CANCELLED orders never count. Expired PENDING online orders that have not
   * been swept yet are ignored too, so a read-only check gives the same answer as a sweep would.
   */
  countSlotBookings(slotId: string, now: Date = new Date()): number {
    return this.getOrders().filter((o) => {
      if (o.status === 'CANCELLED' || o.deliverySlotId !== slotId) return false;
      if (this.isPendingPaymentExpired(o, now.getTime())) return false;
      return true;
    }).length;
  }

  /** Capacity and manual closure for a civil date (YYYY-MM-DD). */
  getDailyCapacitySetting(isoDate: string): { maxCapacity: number; isClosedManually: boolean } {
    const override = this.dailyCapacityOverrides[isoDate];
    return {
      maxCapacity: override?.maxCapacity ?? DEFAULT_DAILY_CAPACITY,
      isClosedManually: override?.isClosedManually ?? false,
    };
  }

  /**
   * Validates a client-supplied slot id for a user's tier (Asia/Tehran calendar). Never throws; returns the
   * canonical slot to store, or a Persian error. Rejects malformed ids, past dates, dates beyond the booking
   * horizon, days the tier cannot receive (Friday is always closed), manually closed days and full days.
   */
  validateDeliverySlot(
    slotId: unknown,
    tier: SubscriptionTier,
    now: Date = new Date()
  ): { ok: true; slot: DeliverySlot } | { ok: false; error: string } {
    const parsed = parseSlotId(slotId);
    if (!parsed) {
      return { ok: false, error: 'سانس تحویل انتخابی نامعتبر است. لطفاً سانس را دوباره انتخاب فرمایید.' };
    }
    const today = getTehranIsoDate(now);
    if (parsed.isoDate <= today) {
      return { ok: false, error: 'سانس تحویل انتخابی گذشته است. لطفاً تاریخ دیگری را انتخاب فرمایید.' };
    }
    if (parsed.isoDate > addDaysIso(today, MAX_BOOKING_DAYS_AHEAD)) {
      return { ok: false, error: 'سانس تحویل انتخابی خارج از بازه رزرو است.' };
    }
    if (!isDayAllowedForUser(parsed.dayOfWeekIndex, tier)) {
      return {
        ok: false,
        error:
          tier === 'PRO'
            ? 'روز تحویل انتخابی مجاز نمی‌باشد.'
            : 'روز تحویل انتخابی با سطح اشتراک شما مطابقت ندارد. اعضای عادی فقط روزهای یکشنبه و چهارشنبه مجاز به دریافت سفارش هستند.',
      };
    }
    const setting = this.getDailyCapacitySetting(parsed.isoDate);
    if (setting.isClosedManually) {
      return { ok: false, error: 'این روز تحویل به‌صورت موقت تعطیل است. لطفاً تاریخ دیگری را انتخاب فرمایید.' };
    }
    const booked = this.countSlotBookings(slotId as string, now);
    if (booked >= setting.maxCapacity) {
      return {
        ok: false,
        error: 'متاسفانه ظرفیت سانس تحویل انتخابی در شیراز تکمیل شده است. لطفاً سانس یا تاریخ دیگری را انتخاب فرمایید.',
      };
    }
    return {
      ok: true,
      slot: this.buildCanonicalSlot(parsed.isoDate, parsed.window, booked, setting.maxCapacity),
    };
  }

  /** Canonical slot stored on an order: identity and display fields only. */
  buildCanonicalSlot(isoDate: string, window: string, bookedCount: number, maxCapacity: number): DeliverySlot {
    const j = formatIsoDateToJalali(isoDate);
    return {
      id: buildSlotId(isoDate, window),
      isoDate,
      window,
      jalaliLabel: j.jalaliLabel,
      dayOfWeekIndex: j.dayOfWeekIndex,
      date: j.shortDate,
      dayOfWeek: j.dayOfWeek,
      timeWindow: SLOT_TIME_LABEL,
      maxCapacity,
      currentBookings: bookedCount,
      isAvailable: true,
    };
  }

  /**
   * Upcoming delivery slots for a user (tier-aware), for the Phase 3 API and checkout. Friday is never offered.
   */
  getAvailableSlotsForUser(
    user: User | null | undefined,
    days: number = 14,
    now: Date = new Date()
  ): AvailableDeliverySlot[] {
    const tier = getEffectiveTier(user, now.getTime());
    const today = getTehranIsoDate(now);
    const horizon = Math.min(Math.max(1, Math.floor(days)), MAX_BOOKING_DAYS_AHEAD);
    const result: AvailableDeliverySlot[] = [];
    for (let i = 1; i <= horizon; i++) {
      const isoDate = addDaysIso(today, i);
      const j = formatIsoDateToJalali(isoDate);
      if (j.dayOfWeekIndex === 5) continue;
      const id = buildSlotId(isoDate, DEFAULT_SLOT_WINDOW);
      const setting = this.getDailyCapacitySetting(isoDate);
      const bookedCount = this.countSlotBookings(id, now);
      const isAllowedForTier = isDayAllowedForUser(j.dayOfWeekIndex, tier);
      const remainingCapacity = setting.isClosedManually ? 0 : Math.max(0, setting.maxCapacity - bookedCount);
      result.push({
        id,
        isoDate,
        window: DEFAULT_SLOT_WINDOW,
        jalaliLabel: j.jalaliLabel,
        dayOfWeekIndex: j.dayOfWeekIndex,
        maxCapacity: setting.maxCapacity,
        bookedCount,
        remainingCapacity,
        isClosed: setting.isClosedManually,
        isAllowedForTier,
        isAvailable: isAllowedForTier && remainingCapacity > 0,
      });
    }
    return result;
  }

  /** Remaining places on a slot id (checks closure and capacity; never throws). */
  checkSlotCapacity(slotId: string): { isAvailable: boolean; remainingCapacity: number } {
    const parsed = parseSlotId(slotId);
    if (!parsed) return { isAvailable: false, remainingCapacity: 0 };
    const setting = this.getDailyCapacitySetting(parsed.isoDate);
    const remaining = setting.isClosedManually
      ? 0
      : Math.max(0, setting.maxCapacity - this.countSlotBookings(slotId));
    return { isAvailable: remaining > 0, remainingCapacity: remaining };
  }

  // --- ORDERS ---
  private saveOrders(): void {
    this.saveServerState();
  }

  /**
   * Deadline (ms) after which an unpaid online order may be released: the payment's creation time (or the order's,
   * when no payment exists yet) + the payment timeout + a 5 minute grace. NaN when the order has no readable time.
   */
  getPaymentDeadlineMs(order: Order, timeoutMinutes: number = this.getPaymentTimeoutMinutes()): number {
    const anchor = this.timeOf(order.payment?.createdAt ?? order.createdAt);
    return Number.isFinite(anchor) ? anchor + timeoutMinutes * 60 * 1000 + PAYMENT_EXPIRY_GRACE_MS : NaN;
  }

  /** True for an unpaid online order (COD never expires) whose payment deadline has passed. */
  isPendingPaymentExpired(order: Order, nowMs: number = Date.now(), timeoutMinutes?: number): boolean {
    if (order.status !== 'PENDING_PAYMENT' || isCodOrder(order)) return false;
    const deadline = this.getPaymentDeadlineMs(order, timeoutMinutes ?? this.getPaymentTimeoutMinutes());
    return Number.isFinite(deadline) && nowMs > deadline;
  }

  /** Marks one unpaid order as expired and gives back its stock, slot and coupon. The caller holds the order lock. */
  private expireOrder(order: Order): void {
    if (order.payment && order.payment.status === 'INITIATED') {
      order.payment = { ...order.payment, status: 'FAILED' };
    }
    order.status = 'CANCELLED';
    order.cancelledByExpiry = true;
    order.updatedAt = new Date().toISOString();
    this.cancelOrderSideEffects(order);
  }

  /**
   * Releases unpaid online orders past their payment deadline (see getPaymentDeadlineMs).
   * Synchronous, so nothing else in this process runs during it. An order whose callback is in flight (its lock is
   * held, for example while the gateway is being asked) is skipped and left for a later sweep.
   */
  releaseExpiredPendingOrders(timeoutMinutes: number = this.getPaymentTimeoutMinutes()): number {
    this.getOrders();
    const now = Date.now();
    let releasedCount = 0;
    for (const order of this.orders) {
      if (!this.isPendingPaymentExpired(order, now, timeoutMinutes)) continue;
      if (isOrderLocked(order.orderNumber)) continue;
      this.expireOrder(order);
      releasedCount++;
    }
    return releasedCount;
  }

  /**
   * The same sweep with each order under withOrderLock. The order is checked again inside its lock, so a callback
   * that is verifying it with the gateway finishes first.
   */
  async releaseExpiredPendingOrdersLocked(timeoutMinutes: number = this.getPaymentTimeoutMinutes()): Promise<number> {
    this.getOrders();
    const candidates = this.orders
      .filter((o) => this.isPendingPaymentExpired(o, Date.now(), timeoutMinutes))
      .map((o) => o.orderNumber);
    let releasedCount = 0;
    for (const key of candidates) {
      releasedCount += await withOrderLock(key, () => {
        const order = this.orders.find((o) => o.orderNumber === key);
        if (!order || !this.isPendingPaymentExpired(order, Date.now(), timeoutMinutes)) return 0;
        this.expireOrder(order);
        return 1;
      });
    }
    return releasedCount;
  }

  /**
   * Releases one unpaid order when its payment deadline has passed. Returns true when it was released.
   * The caller must hold this order's lock (see withOrderLock).
   */
  expireOrderIfDue(orderNumber: string, nowMs: number = Date.now()): boolean {
    this.getOrders();
    const order = this.orders.find((o) => o.orderNumber === orderNumber);
    if (!order || !this.isPendingPaymentExpired(order, nowMs)) return false;
    this.expireOrder(order);
    return true;
  }

  /** Active unpaid online orders that hold a use of this coupon but are not counted yet. Expired ones never count. */
  private countPendingCouponReservations(code: string, nowMs: number): number {
    return this.getOrders().filter(
      (o) =>
        o.couponCode === code &&
        !o.couponCounted &&
        o.status === 'PENDING_PAYMENT' &&
        !this.isPendingPaymentExpired(o, nowMs)
    ).length;
  }

  /**
   * Whether an order released by expiry can take its stock, slot and coupon back right now.
   * A slot whose date has passed is ignored (the order is then only checked for stock and coupon).
   */
  canReviveExpiredOrder(order: Order, nowMs: number = Date.now()): { ok: true } | { ok: false; reason: string } {
    for (const item of order.items || []) {
      if (!item.productId || item.productId.startsWith('sub-')) continue;
      const prod = this.products.find((p) => p.id === item.productId || p.slug === item.productId);
      if (!prod) return { ok: false, reason: 'product_missing' };
      if ((prod.stock ?? 0) < item.quantity) return { ok: false, reason: 'stock' };
    }

    const slotId = order.deliverySlotId || order.deliverySlot?.id || null;
    const parsed = slotId ? parseSlotId(slotId) : null;
    if (slotId && parsed && parsed.isoDate > getTehranIsoDate(new Date(nowMs))) {
      const setting = this.getDailyCapacitySetting(parsed.isoDate);
      if (setting.isClosedManually) return { ok: false, reason: 'slot_closed' };
      if (this.countSlotBookings(slotId, new Date(nowMs)) >= setting.maxCapacity) {
        return { ok: false, reason: 'slot_full' };
      }
    }

    if (order.couponCode && !order.couponCounted) {
      const coupon = this.getCouponByCode(order.couponCode);
      if (
        coupon?.usageLimit &&
        (coupon.usageCount || 0) + this.countPendingCouponReservations(coupon.code, nowMs) >= coupon.usageLimit
      ) {
        return { ok: false, reason: 'coupon_limit' };
      }
    }
    return { ok: true };
  }

  /** Inverse of cancelOrderSideEffects for a revived order: takes the stock and the coupon use again. */
  private reapplyOrderSideEffects(order: Order): void {
    for (const item of order.items || []) {
      if (!item.productId || item.productId.startsWith('sub-')) continue;
      const prod = this.products.find((p) => p.id === item.productId || p.slug === item.productId);
      if (prod) {
        prod.stock = Math.max(0, (prod.stock || 0) - item.quantity);
      }
    }
    order.sideEffectsReleased = false;
    order.couponCounted = false;
    this.countOrderCouponOnce(order);
    this.saveProducts();
  }

  /**
   * Called after the gateway confirmed a payment for an order that expiry released. When the resources can still be
   * taken, they are taken again and the order becomes PROCESSING (outcome PAID). Otherwise the payment is recorded
   * as PAID_AFTER_CANCEL, for a refund. Other states go through recordSuccessfulPayment.
   * It bypasses the transition table on purpose (CANCELLED is final there). Callers must hold the order lock.
   */
  reviveExpiredOrder(
    orderNumber: string,
    confirmation: { refId: string; gateway?: string }
  ): { outcome: 'PAID' | 'ALREADY_PAID' | 'PAID_AFTER_CANCEL' | 'NOT_PAYABLE'; order: Order | null } {
    this.getOrders();
    const order = this.orders.find((o) => o.orderNumber === orderNumber);
    if (!order) return { outcome: 'NOT_PAYABLE', order: null };
    if (order.status !== 'CANCELLED' || !order.cancelledByExpiry) {
      return this.recordSuccessfulPayment(orderNumber, confirmation);
    }

    const base = order.payment || {
      id: `pay-${Date.now()}`,
      orderId: order.orderNumber,
      amount: order.totalAmount,
      gateway: confirmation.gateway || 'zarinpal',
      status: 'INITIATED' as const,
    };
    order.payment = { ...base, status: 'SUCCESS', refId: confirmation.refId };
    order.updatedAt = new Date().toISOString();

    if (!this.canReviveExpiredOrder(order).ok) {
      order.paidAfterCancel = true;
      this.saveOrders();
      return { outcome: 'PAID_AFTER_CANCEL', order };
    }

    this.reapplyOrderSideEffects(order);
    order.status = 'PROCESSING';
    order.cancelledByExpiry = false;
    order.settlementRef = confirmation.refId;
    order.settlementStatus = 'SETTLED';
    this.saveOrders();
    return { outcome: 'PAID', order };
  }

  /**
   * The one place where a cancelled order gives back its resources: stock, the delivery slot (occupancy is derived
   * from orders, so the slot frees itself) and the coupon use. Idempotent through order.sideEffectsReleased.
   * The caller sets status to CANCELLED.
   */
  cancelOrderSideEffects(order: Order): boolean {
    if (order.sideEffectsReleased) return false;

    for (const item of order.items || []) {
      if (!item.productId || item.productId.startsWith('sub-')) continue;
      const prod = this.products.find((p) => p.id === item.productId || p.slug === item.productId);
      if (prod) {
        prod.stock = (prod.stock || 0) + item.quantity;
        if (prod.status === 'OUT_OF_STOCK' && prod.stock > 0) {
          prod.status = 'AVAILABLE';
        }
      }
    }

    if (order.couponCounted && order.couponCode) {
      this.adjustCouponUsage(order.couponCode, -1);
    }
    order.couponCounted = false;
    order.sideEffectsReleased = true;
    order.updatedAt = new Date().toISOString();

    this.saveProducts();
    this.saveOrders();
    return true;
  }

  /** Counts the order's coupon use once. Used for COD orders at creation and for online orders once paid. */
  private countOrderCouponOnce(order: Order): void {
    if (order.couponCode && !order.couponCounted) {
      this.adjustCouponUsage(order.couponCode, 1);
      order.couponCounted = true;
    }
  }

  /** Public form of countOrderCouponOnce (idempotent). */
  countOrderCoupon(idOrNumber: string): boolean {
    this.getOrders();
    const order = this.orders.find((o) => o.id === idOrNumber || o.orderNumber === idOrNumber);
    if (!order) return false;
    this.countOrderCouponOnce(order);
    this.saveOrders();
    return true;
  }

  /**
   * Records a gateway-confirmed payment. Only PENDING_PAYMENT orders become paid (PROCESSING).
   * - PAID: payment SUCCESS, status PROCESSING, coupon counted.
   * - ALREADY_PAID: repeated callback for a paid order. Nothing changes.
   * - PAID_AFTER_CANCEL: the order was already cancelled (for example auto-expired). It is NOT revived. The payment is
   *   recorded and flagged paidAfterCancel so that support refunds it.
   * - NOT_PAYABLE: the order is in a state where an online payment cannot apply.
   * Callers must hold the per-order lock (src/lib/order-lock.ts).
   */
  recordSuccessfulPayment(
    idOrNumber: string,
    confirmation: { refId: string; gateway?: string }
  ): { outcome: 'PAID' | 'ALREADY_PAID' | 'PAID_AFTER_CANCEL' | 'NOT_PAYABLE'; order: Order | null } {
    this.getOrders();
    const order = this.orders.find((o) => o.id === idOrNumber || o.orderNumber === idOrNumber);
    if (!order) return { outcome: 'NOT_PAYABLE', order: null };

    const setSuccessfulPayment = () => {
      const base = order.payment || {
        id: `pay-${Date.now()}`,
        orderId: order.orderNumber,
        amount: order.totalAmount,
        gateway: confirmation.gateway || 'zarinpal',
        status: 'INITIATED' as const,
      };
      order.payment = { ...base, status: 'SUCCESS', refId: confirmation.refId };
    };

    if (order.status === 'CANCELLED') {
      if (order.paidAfterCancel) return { outcome: 'PAID_AFTER_CANCEL', order };
      setSuccessfulPayment();
      order.paidAfterCancel = true;
      order.updatedAt = new Date().toISOString();
      this.saveOrders();
      return { outcome: 'PAID_AFTER_CANCEL', order };
    }

    if (order.status !== 'PENDING_PAYMENT') {
      return {
        outcome: order.payment?.status === 'SUCCESS' ? 'ALREADY_PAID' : 'NOT_PAYABLE',
        order,
      };
    }

    setSuccessfulPayment();
    if (!canTransition(order, 'PROCESSING').allowed) {
      return { outcome: 'NOT_PAYABLE', order };
    }
    order.status = 'PROCESSING';
    order.settlementRef = confirmation.refId;
    order.settlementStatus = 'SETTLED';
    order.updatedAt = new Date().toISOString();
    this.countOrderCouponOnce(order);
    this.saveOrders();
    return { outcome: 'PAID', order };
  }

  /**
   * One line per product: lines for the same product (matched by id or slug) are summed. Lines without a product
   * and subscription lines (sub-*) are kept unchanged.
   */
  private mergeOrderItems(items: OrderItem[]): OrderItem[] {
    const byProduct = new Map<string, OrderItem>();
    const result: OrderItem[] = [];
    for (const item of items) {
      if (!item.productId || item.productId.startsWith('sub-')) {
        result.push(item);
        continue;
      }
      const prod = this.products.find((p) => p.id === item.productId || p.slug === item.productId);
      const key = prod ? prod.id : item.productId;
      const existing = byProduct.get(key);
      if (!existing) {
        const copy = { ...item };
        byProduct.set(key, copy);
        result.push(copy);
        continue;
      }
      existing.quantity += item.quantity;
      existing.totalPrice += item.totalPrice;
      if (item.discountAmount !== undefined) {
        existing.discountAmount = (existing.discountAmount ?? 0) + item.discountAmount;
      }
      if (item.eggDiscountedCount !== undefined) {
        existing.eggDiscountedCount = (existing.eggDiscountedCount ?? 0) + item.eggDiscountedCount;
      }
    }
    return result;
  }

  createOrder(orderData: Omit<Order, 'id' | 'createdAt'>): Order {
    this.getOrders();
    this.getProducts();

    // 1. Release any expired pending orders before verifying stock (busy orders are skipped, see the sweep)
    this.releaseExpiredPendingOrders();

    // 2. Repeated lines of one product are summed first, so the stock check sees the real total
    const items = this.mergeOrderItems(orderData.items || []);

    // 3. ATOMIC PRE-CHECK: Verify all requested physical items have sufficient stock
    for (const item of items) {
      if (item.productId && !item.productId.startsWith('sub-')) {
        const prod = this.products.find(
          (p) => p.id === item.productId || p.slug === item.productId
        );
        if (!prod) {
          throw new BusinessError(`محصول درخواستی با شناسه «${item.productId}» در فروشگاه یافت نشد.`);
        }
        const availableStock = prod.stock ?? 0;
        if (availableStock < item.quantity) {
          throw new BusinessError(
            `INSUFFICIENT_STOCK: متاسفانه موجودی محصول «${prod.title}» کافی نیست. موجودی فعلی: ${availableStock} عدد، تعداد درخواستی: ${item.quantity} عدد.`,
            409
          );
        }
      }
    }

    const newOrder: Order = {
      ...orderData,
      items,
      // Random suffix: two orders created in the same millisecond must not share an id.
      id: `ord-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      createdAt: new Date().toISOString(),
      couponCounted: false,
      sideEffectsReleased: false,
      paidAfterCancel: false,
    };

    // 4. ATOMIC STOCK DEDUCTION: Only runs if all items passed the check
    newOrder.items.forEach((item) => {
      if (item.productId && !item.productId.startsWith('sub-')) {
        const prod = this.products.find(
          (p) => p.id === item.productId || p.slug === item.productId
        );
        if (prod) {
          prod.stock = Math.max(0, (prod.stock || 0) - item.quantity);
        }
      }
    });
    this.saveProducts();

    // Slot occupancy is derived from orders (see countSlotBookings), so nothing else is booked here.
    this.orders.unshift(newOrder);
    this.saveOrders();

    return newOrder;
  }

  /**
   * Sends the ORDER_PLACED notification SMS only after successful payment verification.
   */
  sendOrderPlacedSms(order: Order): void {
    const phone = order.address?.phone || order.user?.phone;
    if (!phone) return;
    const vars: Record<string, string> = {
      '{customerName}': order.address?.recipientName || order.user?.name || 'مشتری گرامی',
      '{orderNumber}': order.orderNumber,
      '{totalAmount}': order.totalAmount.toLocaleString('fa-IR'),
      '{deliveryDate}': order.deliverySlot?.date || 'چهارشنبه آینده',
      '{deliveryTime}': '۱۵:۰۰ الی ۲۱:۰۰',
      '{siteUrl}': 'profarm.ir',
    };
    const rendered = this.renderEventSms('ORDER_PLACED', vars);
    if (rendered && rendered.isEnabled && rendered.message) {
      const targetEmail = order.user?.email || this.getUserByPhone(phone)?.email;
      sendCustomSms(phone, rendered.message, targetEmail);
    }
  }

  syncOrderFromApi(order: Order): Order {
    this.getOrders();
    const idx = this.orders.findIndex((o) => o.id === order.id || o.orderNumber === order.orderNumber);
    if (idx === -1) {
      this.orders.unshift(order);
    } else {
      this.orders[idx] = { ...this.orders[idx], ...order };
    }
    this.saveOrders();
    return order;
  }

  getOrders(): Order[] {
    return this.orders;
  }

  getOrderById(id: string): Order | undefined {
    this.getOrders();
    return this.orders.find((o) => o.id === id || o.orderNumber === id);
  }

  attachPaymentToOrder(idOrNumber: string, payment: Payment): Order | null {
    this.getOrders();
    const order = this.orders.find((o) => o.id === idOrNumber || o.orderNumber === idOrNumber);
    if (!order) return null;
    order.payment = payment;
    order.updatedAt = new Date().toISOString();
    this.saveOrders();
    return order;
  }

  /**
   * Changes an order's status through the single transition table (order-utils canTransition).
   * Throws BusinessError for a forbidden move. Moving to CANCELLED runs cancelOrderSideEffects exactly once.
   */
  async updateOrderStatus(id: string, newStatus: OrderStatus): Promise<Order | null> {
    this.getOrders();
    const order = this.orders.find((o) => o.id === id || o.orderNumber === id);
    if (!order) return null;
    if (order.status === newStatus) return order;

    const check = canTransition(order, newStatus);
    if (!check.allowed) {
      throw new BusinessError(check.reason || 'تغییر وضعیت سفارش مجاز نیست.', 400);
    }

    if (newStatus === 'CANCELLED') {
      order.status = 'CANCELLED';
      this.cancelOrderSideEffects(order);
    } else {
      order.status = newStatus;
      if (newStatus === 'DELIVERED') {
        order.deliveredAt = new Date().toISOString();
      }
      this.countOrderCouponOnce(order);
    }
    order.updatedAt = new Date().toISOString();
    // saveOrders also schedules the PostgreSQL mirror (queued, logged on failure)
    this.saveOrders();

    const statusTranslations: Record<OrderStatus, string> = {
      PENDING_PAYMENT: 'در انتظار پرداخت',
      PROCESSING: 'در حال آماده‌سازی در انبار',
      OUT_FOR_DELIVERY: 'تحویل به پیک جهت ارسال',
      DELIVERED: 'تحویل داده شده به مشتری',
      CANCELLED: 'لغو شده',
    };

    // Send configurable automated event SMS based on status
    const phone = order.address?.phone || order.user?.phone;
    if (phone) {
      const vars: Record<string, string> = {
        '{customerName}': order.address?.recipientName || order.user?.name || 'مشتری گرامی',
        '{orderNumber}': order.orderNumber,
        '{totalAmount}': order.totalAmount.toLocaleString('fa-IR'),
        '{deliveryDate}': order.deliverySlot?.date || 'چهارشنبه آینده',
        '{deliveryTime}': '۱۵:۰۰ الی ۲۱:۰۰',
        '{siteUrl}': 'profarm.ir',
        '{surveyUrl}': 'profarm.ir',
        '{supportPhone}': '۰۷۱-۳۶۲۸۰۰۰۰',
      };

      let eventId: SmsEventType | null = null;
      if (newStatus === 'DELIVERED') {
        eventId = 'ORDER_DELIVERED';
        const firstProd = order.items?.[0]?.product;
        const targetSlug = firstProd?.slug || order.items?.[0]?.productId;
        const reviewUrl = targetSlug
          ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://profarm-shiraz.ir'}/products/${targetSlug}?review=true`
          : `${process.env.NEXT_PUBLIC_APP_URL || 'https://profarm-shiraz.ir'}/account?tab=reviews`;
        vars['{reviewLink}'] = reviewUrl;
      } else if (newStatus === 'OUT_FOR_DELIVERY') {
        eventId = 'ORDER_OUT_FOR_DELIVERY';
      } else if (newStatus === 'PROCESSING') {
        eventId = 'ORDER_PROCESSING';
      } else if (newStatus === 'CANCELLED') {
        eventId = 'ORDER_CANCELLED';
      }

      const targetEmail = order.user?.email || (phone ? this.getUserByPhone(phone)?.email : undefined);
      if (eventId) {
        const rendered = this.renderEventSms(eventId, vars);
        if (rendered && rendered.isEnabled && rendered.message) {
          await sendCustomSms(phone, rendered.message, targetEmail);
        }
      } else {
        await sendOrderStatusSms(phone, order.orderNumber, statusTranslations[newStatus], targetEmail);
      }
    }

    return order;
  }

  /**
   * Eggs that counted against a user's subscription egg quota in the last 30 days (rolling window).
   * Matched by account id only (never by phone). Only eggs that received the discount are counted: each item stores
   * eggDiscountedCount at creation. Items created before that field existed count as 0.
   * Includes paid orders and PENDING orders still inside the payment window (so two tabs cannot overspend).
   */
  getUserRolling30DaysEggDiscountUsed(userId?: string | null): number {
    if (!userId) return 0;

    const now = Date.now();
    const cutoffTime = now - 30 * 24 * 60 * 60 * 1000;
    let totalEggsDiscounted = 0;

    for (const ord of this.getOrders()) {
      if (ord.isSubscription || ord.userId !== userId) continue;

      const orderCreatedAt = new Date(ord.createdAt).getTime();
      if (Number.isNaN(orderCreatedAt) || orderCreatedAt < cutoffTime) continue;

      const isPaid = ['PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(ord.status);
      const isActivePending =
        ord.status === 'PENDING_PAYMENT' && (isCodOrder(ord) || !this.isPendingPaymentExpired(ord, now));
      if (!isPaid && !isActivePending) continue;

      for (const item of ord.items || []) {
        if (typeof item.eggDiscountedCount === 'number' && Number.isFinite(item.eggDiscountedCount)) {
          totalEggsDiscounted += Math.max(0, Math.floor(item.eggDiscountedCount));
        } else if (isEggProduct(item.product ?? {}, item.productId)) {
          // Legacy line (saved before eggDiscountedCount existed): count every egg on it, as the old estimate did.
          totalEggsDiscounted += getEggsPerPack(item.product ?? {}) * (item.quantity || 1);
        }
      }
    }

    return totalEggsDiscounted;
  }

  resetOrders(): Order[] {
    this.orders = [...INITIAL_ADMIN_ORDERS];
    this.saveServerState();
    return this.orders;
  }

  // --- PRODUCT REVIEWS & VERIFIED RATINGS ---
  private saveReviews(): void {
    this.saveServerState();
  }

  getProductReviews(productIdOrSlug: string, onlyApproved = true): ProductReview[] {
    return this.getAllReviews().filter((r) => {
      const matches = r.productId === productIdOrSlug || r.productSlug === productIdOrSlug;
      return matches && (!onlyApproved || r.status === 'APPROVED');
    });
  }

  getAllReviews(statusFilter?: ReviewStatus): ProductReview[] {
    if (!statusFilter) return this.reviews;
    return this.reviews.filter((r) => r.status === statusFilter);
  }

  getReviewById(id: string): ProductReview | undefined {
    return this.getAllReviews().find((r) => r.id === id);
  }

  canUserReviewProduct(userId: string, productIdOrSlug: string): {
    canReview: boolean;
    reason?: string;
    orderId?: string;
    alreadyReviewed?: boolean;
  } {
    if (!userId) {
      return { canReview: false, reason: 'لطفاً ابتدا وارد حساب کاربری خود شوید.' };
    }

    // Check if user already reviewed this product
    const existingReview = this.getAllReviews().find(
      (r) =>
        r.userId === userId &&
        (r.productId === productIdOrSlug || r.productSlug === productIdOrSlug)
    );
    if (existingReview) {
      return {
        canReview: false,
        alreadyReviewed: true,
        reason: 'شما قبلاً دیدگاه ارزشمند خود را برای این محصول ثبت نموده‌اید.',
      };
    }

    // Must have at least one delivered order containing this product
    const deliveredOrders = this.getOrders().filter(
      (o) => (o.userId === userId || o.user?.id === userId) && o.status === 'DELIVERED'
    );

    if (deliveredOrders.length === 0) {
      return {
        canReview: false,
        reason: 'تنها خریداران تایید شده که سفارش آنها با موفقیت تحویل داده شده است مجاز به ثبت نظر می‌باشند.',
      };
    }

    const matchingOrder = deliveredOrders.find((o) =>
      o.items.some(
        (item) => item.productId === productIdOrSlug || item.product?.slug === productIdOrSlug
      )
    );

    if (!matchingOrder) {
      return {
        canReview: false,
        reason: 'شما این محصول را در میان سفارش‌های تحویل داده شده قبلی خود نداشته‌اید.',
      };
    }

    return {
      canReview: true,
      orderId: matchingOrder.orderNumber || matchingOrder.id,
    };
  }

  addProductReview(
    data: Omit<ProductReview, 'id' | 'createdAt' | 'status'> & { status?: ReviewStatus }
  ): ProductReview {
    this.getAllReviews();
    const sanitizeStr = (s?: string, max = 1000) => (s ? s.trim().slice(0, max).replace(/<[^>]*>?/gm, '') : '');
    const newReview: ProductReview = {
      ...data,
      id: `rev-${Date.now()}`,
      title: data.title ? sanitizeStr(data.title, 120) : undefined,
      comment: sanitizeStr(data.comment, 2000),
      pros: Array.isArray(data.pros) ? data.pros.map((p) => sanitizeStr(p, 100)).filter(Boolean) : [],
      cons: Array.isArray(data.cons) ? data.cons.map((c) => sanitizeStr(c, 100)).filter(Boolean) : [],
      rating: Math.min(5, Math.max(1, Math.round(Number(data.rating) || 5))),
      status: data.status || 'PENDING',
      createdAt: new Date().toLocaleDateString('fa-IR'),
      updatedAt: new Date().toISOString(),
    };
    this.reviews.unshift(newReview);
    this.saveReviews();
    return newReview;
  }

  updateReviewStatus(
    id: string,
    status: ReviewStatus,
    adminResponse?: string
  ): ProductReview | null {
    this.getAllReviews();
    const rev = this.reviews.find((r) => r.id === id);
    if (!rev) return null;
    rev.status = status;
    if (adminResponse !== undefined) {
      rev.adminResponse = adminResponse;
    }
    rev.updatedAt = new Date().toISOString();
    this.saveReviews();
    return rev;
  }

  deleteReview(id: string): boolean {
    this.getAllReviews();
    const prevLen = this.reviews.length;
    this.reviews = this.reviews.filter((r) => r.id !== id);
    if (this.reviews.length < prevLen) {
      this.saveReviews();
      return true;
    }
    return false;
  }

  getUserReviews(userId: string): ProductReview[] {
    return this.getAllReviews().filter((r) => r.userId === userId);
  }

  resetReviews(): ProductReview[] {
    this.reviews = [...INITIAL_PRODUCT_REVIEWS];
    this.saveServerState();
    return this.reviews;
  }

  // --- BULK INQUIRIES ---
  getBulkInquiries(): BulkInquiry[] {
    return this.bulkInquiries;
  }

  createBulkInquiry(
    data: Omit<BulkInquiry, 'id' | 'createdAt' | 'status'> & {
      id?: string;
      status?: 'PENDING' | 'REVIEWED' | 'COMPLETED';
      createdAt?: string;
    }
  ): BulkInquiry {
    const inquiry: BulkInquiry = {
      ...data,
      id: data.id || `inq-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      status: data.status || 'PENDING',
      createdAt: data.createdAt || new Date().toISOString(),
    };
    this.bulkInquiries.unshift(inquiry);
    this.saveServerState();
    return inquiry;
  }

  updateBulkInquiryStatus(
    id: string,
    status: 'PENDING' | 'REVIEWED' | 'COMPLETED'
  ): BulkInquiry | null {
    const idx = this.bulkInquiries.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    this.bulkInquiries[idx] = { ...this.bulkInquiries[idx], status };
    this.saveServerState();
    return this.bulkInquiries[idx];
  }

  /** true only when an inquiry with this id existed and was removed. */
  deleteBulkInquiry(id: string): boolean {
    const before = this.bulkInquiries.length;
    this.bulkInquiries = this.bulkInquiries.filter((i) => i.id !== id);
    if (this.bulkInquiries.length === before) return false;
    this.saveServerState();
    return true;
  }

  // --- SITE CONTENT (CMS) ---
  getSiteContent(): SiteContent {
    return this.siteContent;
  }

  updateSiteContent(updates: Partial<SiteContent>): SiteContent {
    this.siteContent = { ...this.siteContent, ...updates };
    this.saveServerState();

    return this.siteContent;
  }

  resetSiteContent(): SiteContent {
    this.siteContent = { ...DEFAULT_SITE_CONTENT };
    this.saveServerState();

    return this.siteContent;
  }

  // --- SUBSCRIPTION & DISCOUNT SETTINGS ---
  getSubscriptionSettings(): SubscriptionSettings {
    return this.subscriptionSettings;
  }



  updateSubscriptionSettings(updates: Partial<SubscriptionSettings>): SubscriptionSettings {
    const current = this.getSubscriptionSettings();
    this.subscriptionSettings = { ...current, ...updates };
    this.saveServerState();

    return this.subscriptionSettings;
  }

  resetSubscriptionSettings(): SubscriptionSettings {
    this.subscriptionSettings = { ...DEFAULT_SUBSCRIPTION_SETTINGS };
    this.saveServerState();

    return this.subscriptionSettings;
  }

  /** Accounts whose plan applies today (expired plans do not count). Used for plan capacity checks. */
  countActiveMembers(plan: 'PLUS' | 'PRO', nowMs: number = Date.now()): number {
    return this.getAllUsers().filter((u) => getEffectiveTier(u, nowMs) === plan).length;
  }

  getSubscriptionStats(): SubscriptionStats {
    const users = this.getAllUsers();
    const settings = this.getSubscriptionSettings();

    // Counts use the tier that applies today (an expired plan counts as FREE)
    const proCount = users.filter((u) => getEffectiveTier(u) === 'PRO').length;
    const plusCount = users.filter((u) => getEffectiveTier(u) === 'PLUS').length;
    const freeCount = users.filter((u) => getEffectiveTier(u) === 'FREE').length;
    const totalUsers = users.length;

    const proCapacity = settings.proMaxCapacity || 0;
    const plusCapacity = settings.plusMaxCapacity || 0;

    const proRemaining = proCapacity > 0 ? Math.max(0, proCapacity - proCount) : null;
    const plusRemaining = plusCapacity > 0 ? Math.max(0, plusCapacity - plusCount) : null;

    const isProFull = proCapacity > 0 && proCount >= proCapacity;
    const isPlusFull = plusCapacity > 0 && plusCount >= plusCapacity;

    return {
      proCount,
      plusCount,
      freeCount,
      totalUsers,
      proCapacity,
      plusCapacity,
      proRemaining,
      plusRemaining,
      isProFull,
      isPlusFull,
    };
  }

  // --- PAYMENT GATEWAY SETTINGS ---
  getPaymentSettings(): PaymentSettings {
    return this.paymentSettings;
  }

  /**
   * Safe public payment gateway settings getter for client-side components (checkout, etc.)
   * Strips all credentials (merchantId, clientId, clientSecret)
   */
  getClientPaymentSettings() {
    const s = this.getPaymentSettings();
    return {
      zarinpal: {
        enabled: Boolean(s.zarinpal?.enabled),
        defaultDescription: s.zarinpal?.defaultDescription || 'سفارش محصولات ارگانیک شیراز',
      },
      snapppay: {
        enabled: Boolean(s.snapppay?.enabled),
        minAmount: s.snapppay?.minAmount ?? 200000,
      },
      general: {
        currency: s.general?.currency || 'IRT',
        allowCashOnDelivery: Boolean(s.general?.allowCashOnDelivery),
        paymentTimeoutMinutes: s.general?.paymentTimeoutMinutes ?? 30,
        guideMessage: s.general?.guideMessage,
      },
    };
  }

  updatePaymentSettings(updates: Partial<PaymentSettings>): PaymentSettings {
    this.paymentSettings = {
      ...this.paymentSettings,
      ...updates,
      zarinpal: {
        ...this.paymentSettings.zarinpal,
        ...(updates.zarinpal || {}),
      },
      snapppay: {
        ...this.paymentSettings.snapppay,
        ...(updates.snapppay || {}),
      },
      general: {
        ...this.paymentSettings.general,
        ...(updates.general || {}),
      },
      updatedAt: new Date().toISOString(),
    };

    // Gateway secrets stay on the server; clients only receive getClientPaymentSettings()
    this.saveServerState();
    return this.paymentSettings;
  }

  resetPaymentSettings(): PaymentSettings {
    this.paymentSettings = { ...DEFAULT_PAYMENT_SETTINGS, updatedAt: new Date().toISOString() };
    this.saveServerState();
    return this.paymentSettings;
  }

  // --- COUPONS / DISCOUNT CODES ---
  getCoupons(): Coupon[] {
    return this.coupons;
  }

  getCouponById(id: string): Coupon | undefined {
    return this.getCoupons().find((c) => c.id === id);
  }

  getCouponByCode(code: string): Coupon | undefined {
    const clean = code.trim().toUpperCase();
    return this.getCoupons().find((c) => c.code.toUpperCase() === clean);
  }

  createCoupon(data: Omit<Coupon, 'id' | 'createdAt' | 'usageCount'>): Coupon {
    const fields = sanitizeCouponFields(data as unknown as Record<string, unknown>);
    if (!fields.code) throw new BusinessError('کد تخفیف الزامی است.', 400);
    if (this.coupons.some((c) => c.code.toUpperCase() === fields.code)) {
      throw new BusinessError('این کد تخفیف قبلاً تعریف شده است. لطفاً کد دیگری انتخاب کنید.', 409);
    }
    const now = new Date().toISOString();
    const newCoupon = clampCouponValues({
      id: `coup-${Date.now()}`,
      code: fields.code,
      title: fields.title ?? '',
      description: fields.description,
      targetType: fields.targetType ?? 'ALL_PRODUCTS',
      targetProductId: fields.targetProductId,
      targetProductName: fields.targetProductName,
      discountType: fields.discountType ?? 'PERCENTAGE',
      discountValue: fields.discountValue ?? 0,
      minOrderAmount: fields.minOrderAmount,
      maxDiscountAmount: fields.maxDiscountAmount,
      usageLimit: fields.usageLimit,
      perUserLimit: fields.perUserLimit,
      usageCount: 0,
      isActive: fields.isActive ?? true,
      startsAt: fields.startsAt ?? null,
      expiresAt: fields.expiresAt ?? null,
      createdAt: now,
      updatedAt: now,
    });
    this.coupons.unshift(newCoupon);
    this.persistCoupons();
    return newCoupon;
  }

  /** Updates only whitelisted fields. id, usageCount and createdAt can never change through this method. */
  updateCoupon(id: string, updates: Partial<Coupon>): Coupon | null {
    const idx = this.coupons.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    const current = this.coupons[idx];
    const fields = sanitizeCouponFields(updates as unknown as Record<string, unknown>);
    if (fields.code && fields.code !== current.code && this.coupons.some((c) => c.id !== id && c.code.toUpperCase() === fields.code)) {
      throw new BusinessError('این کد تخفیف قبلاً تعریف شده است. لطفاً کد دیگری انتخاب کنید.', 409);
    }
    const next = clampCouponValues({
      ...current,
      ...fields,
      id: current.id,
      usageCount: current.usageCount || 0,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    } as Coupon);
    this.coupons[idx] = next;
    this.persistCoupons();
    return next;
  }

  deleteCoupon(id: string): boolean {
    const initialLen = this.coupons.length;
    this.coupons = this.coupons.filter((c) => c.id !== id);
    this.persistCoupons();
    return this.coupons.length < initialLen;
  }

  toggleCouponActive(id: string): Coupon | null {
    const coupon = this.coupons.find((c) => c.id === id);
    if (!coupon) return null;
    coupon.isActive = !coupon.isActive;
    coupon.updatedAt = new Date().toISOString();
    this.persistCoupons();
    return coupon;
  }

  /** Adds or removes coupon uses. Only called from order payment, COD creation and order cancellation. */
  private adjustCouponUsage(code: string, delta: number): void {
    const coupon = this.getCouponByCode(code);
    if (!coupon) return;
    coupon.usageCount = Math.max(0, (coupon.usageCount || 0) + delta);
    this.persistCoupons();
  }

  private persistCoupons(): void {
    this.saveServerState();
  }

  /**
   * Validates a coupon and computes its discount for a cart. The discount never exceeds the amount it targets
   * (shipping fee, one product line, or the items subtotal) and never exceeds 100% of it.
   * Checks: active flag, start and expiry dates (Asia/Tehran, inclusive end), total usage, per-user usage, minimum order.
   * options.now defaults to the current time. options.userId enables the per-user limit.
   */
  validateAndApplyCoupon(
    code: string,
    cartItems: { product: { id: string; price: number; title?: string }; quantity: number }[],
    shippingFee: number,
    itemsSubtotal: number,
    options: { userId?: string | null; now?: number } = {}
  ): CouponValidationResult {
    const invalid = (message: string): CouponValidationResult => ({ isValid: false, message, discountAmount: 0 });

    const cleanCode = String(code || '').trim().toUpperCase();
    if (!cleanCode) return invalid('لطفاً کد تخفیف را وارد نمایید.');

    const coupon = this.getCouponByCode(cleanCode);
    if (!coupon) return invalid('کد تخفیف وارد شده معتبر نمی‌باشد.');
    if (!coupon.isActive) return invalid('این کد تخفیف در حال حاضر غیرفعال است.');

    const now = options.now ?? Date.now();
    if (coupon.startsAt) {
      const start = parseTehranDateValue(coupon.startsAt, false);
      if (start === null) return invalid('تاریخ شروع این کد تخفیف نامعتبر است.');
      if (now < start) return invalid('این کد تخفیف هنوز فعال نشده است.');
    }
    if (coupon.expiresAt) {
      const end = parseTehranDateValue(coupon.expiresAt, true);
      if (end === null) return invalid('تاریخ انقضای این کد تخفیف نامعتبر است.');
      if (now > end) return invalid('این کد تخفیف منقضی شده است.');
    }

    // Counted uses, plus unpaid orders that still hold a place (so pending checkouts cannot overshoot the limit).
    if (coupon.usageLimit) {
      const reserved = this.countPendingCouponReservations(coupon.code, now);
      if ((coupon.usageCount || 0) + reserved >= coupon.usageLimit) {
        return invalid('ظرفیت استفاده از این کد تخفیف به اتمام رسیده است.');
      }
    }
    if (coupon.perUserLimit && options.userId) {
      const used = this.getOrders().filter(
        (o) =>
          o.userId === options.userId &&
          o.couponCode === coupon.code &&
          o.status !== 'CANCELLED' &&
          !this.isPendingPaymentExpired(o, now)
      ).length;
      if (used >= coupon.perUserLimit) {
        return invalid('شما قبلاً از این کد تخفیف به حداکثر تعداد مجاز استفاده کرده‌اید.');
      }
    }

    if (coupon.minOrderAmount && itemsSubtotal < coupon.minOrderAmount) {
      return invalid(`حداقل ارزش سبد برای این کد تخفیف ${coupon.minOrderAmount.toLocaleString('fa-IR')} تومان است.`);
    }

    const value = Number(coupon.discountValue);
    if (!Number.isFinite(value) || value < 0) return invalid('مقدار تخفیف این کد نامعتبر است.');
    const isPercent = coupon.discountType === 'PERCENTAGE';
    const percent = Math.min(100, value);
    const cap = isPercent && coupon.maxDiscountAmount && coupon.maxDiscountAmount > 0 ? coupon.maxDiscountAmount : Infinity;

    const amountFor = (base: number): number => {
      if (base <= 0) return 0;
      let amount = isPercent ? Math.round((base * percent) / 100) : value;
      amount = Math.min(amount, cap, base);
      return Math.max(0, Math.round(amount));
    };
    const valid = (amount: number): CouponValidationResult => ({
      isValid: true,
      message: `کد تخفیف اعمال شد: ${coupon.title}`,
      coupon,
      discountAmount: amount,
      targetType: coupon.targetType,
    });

    if (coupon.targetType === 'SHIPPING') {
      if (shippingFee <= 0) return invalid('هزینه ارسال سفارش شما در حال حاضر رایگان است.');
      return valid(amountFor(shippingFee));
    }
    if (coupon.targetType === 'SPECIFIC_PRODUCT') {
      const item = cartItems.find((ci) => ci.product.id === coupon.targetProductId);
      if (!item) {
        return invalid(`این کد تخفیف فقط برای «${coupon.targetProductName || 'محصول انتخاب‌شده'}» است و در سبد شما وجود ندارد.`);
      }
      return valid(amountFor(item.product.price * item.quantity));
    }
    if (coupon.targetType === 'ALL_PRODUCTS') {
      return valid(amountFor(itemsSubtotal));
    }
    return invalid('نوع کد تخفیف نامعتبر است.');
  }

  // --- Daily Delivery Capacity Management (Admin Exclusive & Checkout Enforcement) ---
  // --- Daily Delivery Capacity Management (server state; admin changes persist with saveServerState) ---
  getDailyCapacities(now: Date = new Date()): DailyCapacityItem[] {
    const rawSlots = generateDeliverySlots(true, 12, undefined, false, now);
    return rawSlots.map((slot) => {
      const dateIso = slot.jalali.isoDateString;
      const { maxCapacity, isClosedManually } = this.getDailyCapacitySetting(dateIso);
      const booked = this.countSlotBookings(slot.id, now);
      const bookedCount = isClosedManually ? maxCapacity : Math.min(maxCapacity, booked);
      const remainingCapacity = isClosedManually ? 0 : Math.max(0, maxCapacity - bookedCount);

      let status: 'OPEN' | 'NEAR_FULL' | 'FULL' = 'OPEN';
      if (isClosedManually || remainingCapacity === 0) {
        status = 'FULL';
      } else if (remainingCapacity <= 5) {
        status = 'NEAR_FULL';
      }

      return {
        dateIso,
        jalaliFormatted: slot.jalali.jalaliLabel,
        dayOfWeek: slot.jalali.dayOfWeek,
        maxCapacity,
        bookedCount,
        isClosedManually,
        remainingCapacity,
        status,
      };
    });
  }

  setDailyCapacity(dateIso: string, updates: { maxCapacity?: number; isClosedManually?: boolean }): DailyCapacityItem[] {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateIso)) || parseTehranDateValue(dateIso, false) === null) {
      throw new BusinessError('تاریخ روز تحویل نامعتبر است.', 400);
    }
    const next: { maxCapacity?: number; isClosedManually?: boolean } = { ...this.dailyCapacityOverrides[dateIso] };
    if (updates.maxCapacity !== undefined) {
      const n = Math.floor(Number(updates.maxCapacity));
      if (!Number.isFinite(n) || n < 0 || n > 10000) {
        throw new BusinessError('ظرفیت روزانه باید عددی بین ۰ تا ۱۰۰۰۰ باشد.', 400);
      }
      next.maxCapacity = n;
    }
    if (updates.isClosedManually !== undefined) {
      next.isClosedManually = Boolean(updates.isClosedManually);
    }
    this.dailyCapacityOverrides = { ...this.dailyCapacityOverrides, [dateIso]: next };
    this.saveServerState();
    return this.getDailyCapacities();
  }

  toggleDailyCapacityClose(dateIso: string): DailyCapacityItem[] {
    const list = this.getDailyCapacities();
    const item = list.find((c) => c.dateIso === dateIso);
    const newStatus = item ? !item.isClosedManually : true;
    return this.setDailyCapacity(dateIso, { isClosedManually: newStatus });
  }

  /**
   * Complete reset: restores in-memory collections to the seed defaults and persists them.
   */
  resetEntireDatabaseToDefaults(): void {
    this.products = [...INITIAL_PRODUCTS];
    this.orders = [...INITIAL_ADMIN_ORDERS];
    this.users.clear();
    this.populateInitialUsers();
    this.bulkInquiries = [];
    this.populateInitialBulkInquiries();
    this.categories = [...INITIAL_CATEGORIES];
    this.siteContent = { ...DEFAULT_SITE_CONTENT };
    this.subscriptionSettings = { ...DEFAULT_SUBSCRIPTION_SETTINGS };
    this.coupons = [...INITIAL_COUPONS];
    this.paymentSettings = { ...DEFAULT_PAYMENT_SETTINGS };
    this.returnRequests = [
      {
        id: 'ret-101',
        orderNumber: 'PRF-1405-8821',
        customerName: 'سارا نامدار',
        customerPhone: '09171234567',
        productTitle: 'تخم‌مرغ محلی ارگانیک کامفیروز (۳۰ عددی)',
        quantity: 1,
        reason: 'DAMAGE_IN_TRANSIT',
        reasonTitle: 'شکستگی ۵ عدد تخم‌مرغ در حین حمل پیک',
        description: 'هنگام تحویل بسته تخم‌مرغ توسط پیک، راننده بسته را بررسی کرد و ۵ عدد تخم‌مرغ ترک خورده بود.',
        refundAmount: 65000,
        status: 'APPROVED',
        adminNotes: 'تایید شد و هماهنگ شد در خرید بعدی یا به شماره شبا واریز گردد.',
        createdAt: '۱۴۰۵/۰۶/۱۴ - ۱۰:۳۰',
        updatedAt: '۱۴۰۵/۰۶/۱۴ - ۱۱:۱۵',
      },
      {
        id: 'ret-102',
        orderNumber: 'PRF-1405-3419',
        customerName: 'رضا کمالی',
        customerPhone: '09172223344',
        productTitle: 'عسل وحشی گون کوهستان دشت ارژن',
        quantity: 1,
        reason: 'QUALITY_ISSUE',
        reasonTitle: 'عدم تطابق با سلیقه و ذائقه مشتری',
        description: 'مشتری طعم عسل آویشن را انتظار داشته و مایل به تعویض با عسل کوهی دیگر است.',
        refundAmount: 480000,
        status: 'PENDING',
        adminNotes: 'تماس تلفنی با مشتری برقرار شود جهت تعویض با عسل آویشن.',
        createdAt: '۱۴۰۵/۰۶/۱۶ - ۱۶:۴۵',
        updatedAt: '۱۴۰۵/۰۶/۱۶ - ۱۶:۴۵',
      },
    ];
    this.smsBroadcasts = [
      {
        id: 'sms-b-1',
        title: 'شارژ بار تازه تخم‌مرغ محلی کامفیروز',
        message: 'مشترک گرامی پروفارم؛ بار تازه تخم‌مرغ محلی کامفیروز با تحویل ۶ روزه شیراز شارژ شد. جهت ثبت سفارش به سایت مراجعه فرمایید.',
        targetSegment: 'PRO_MEMBERS',
        targetSegmentTitle: 'مشترکین طلایی پرو',
        recipientCount: 142,
        status: 'SENT',
        sentAt: '۱۴۰۵/۰۶/۱۰ - ۱۱:۰۰',
        createdAt: '۱۴۰۵/۰۶/۱۰ - ۱۰:۴۵',
      },
      {
        id: 'sms-b-2',
        title: 'اطلاعیه زمان‌بندی پیک شیراز (ساعت ۱۵ الی ۲۱)',
        message: 'مشتری گرامی؛ توزیع سفارشات امروز طبق روال در بازه عصرگاهی انجام می‌شود. لطفا در آدرس حضور داشته باشید.',
        targetSegment: 'SHIRAZ_BUYERS',
        targetSegmentTitle: 'خریداران فعال شیراز',
        recipientCount: 89,
        status: 'SENT',
        sentAt: '۱۴۰۵/۰۶/۱۵ - ۱۴:۳۰',
        createdAt: '۱۴۰۵/۰۶/۱۵ - ۱۴:۱۵',
      },
    ];
    this.smsEventTemplates = [...DEFAULT_SMS_EVENT_TEMPLATES];
    this.smsSettings = { ...DEFAULT_SMS_PROVIDER_SETTINGS };
    this.reviews = [...INITIAL_PRODUCT_REVIEWS];
    this.dailyCapacityOverrides = {};
    this.saveServerState();

  }
}

// Global singleton instance
const globalStore = (typeof globalThis !== 'undefined' ? globalThis : global) as unknown as { farmStore: FarmDataStore };
export const farmStore = globalStore.farmStore || new FarmDataStore();
globalStore.farmStore = farmStore;
