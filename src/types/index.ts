export type UserRole = 'USER' | 'ADMIN';
export type SubscriptionTier = 'FREE' | 'PLUS' | 'PRO';

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PROCESSING'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export type PaymentStatus = 'INITIATED' | 'SUCCESS' | 'FAILED';

export interface User {
  id: string;
  phone?: string;
  username?: string | null;
  name?: string | null;
  email?: string | null;
  password?: string | null;
  /** Set only by GET /api/auth/me: whether the account has a password (the hash itself is never sent). */
  hasPassword?: boolean;
  authProvider?: 'PHONE_OTP' | 'PASSWORD' | 'GOOGLE';
  isPhoneVerified?: boolean;
  /** true only when the email was verified by the identity provider (Google) */
  isEmailVerified?: boolean;
  avatarUrl?: string | null;
  nationalId?: string | null;
  birthDate?: string | null;
  smsNotificationEnabled?: boolean;
  role: UserRole;
  isProMember: boolean; // Backward compatibility (true if tier === 'PRO' || tier === 'PLUS')
  tier?: SubscriptionTier;
  subscriptionTier?: SubscriptionTier;
  isPlusMember?: boolean;
  plusExpiresAt?: string | null;
  proExpiresAt?: string | null;
  eggDiscountUsed?: number; // Count of eggs discounted in current month
  addresses?: Address[];
  createdAt?: string;
  /** Bumped on password change; sessions with a lower `sv` are rejected. */
  sessionVersion?: number;
}

export interface EmailMessageLog {
  id: string;
  to: string;
  recipientName?: string;
  subject: string;
  body: string;
  status: 'SENT' | 'FAILED';
  fallbackForSms?: boolean;
  createdAt: string;
}

export interface FaqItem {
  id: string;
  q: string;
  a: string;
  question?: string;
  answer?: string;
}

export interface ComparisonRow {
  id: string;
  title: string;
  free: string;
  plus: string;
  pro: string;
}

export interface SubscriptionSettings {
  // Pro Tier Settings
  proMonthlyPrice: number;
  proEggDiscountPercent: number;
  proEggMaxQuota: number;
  proOtherDiscountPercent: number;
  proShippingDiscountPercent: number;
  proDeliveryDaysPerWeek: number;
  proMaxCapacity: number; // 0 for unlimited, or specific max subscriber count
  proFeatures: string[]; // List of perk bullet points
  proBadgeText?: string;

  // Plus Tier Settings
  plusMonthlyPrice: number;
  plusEggDiscountPercent: number;
  plusEggMaxQuota: number;
  plusDeliveryDaysPerWeek: number;
  plusMaxCapacity: number; // 0 for unlimited, or specific max subscriber count
  plusFeatures: string[]; // List of perk bullet points
  plusBadgeText?: string;

  // General & Base Delivery
  baseShippingFee: number;
  freeTierDeliveryDaysText: string;
  freeFeatures: string[]; // List of perk bullet points for free tier
  freeBadgeText?: string;

  // Visual In-Place Customizable Texts:
  // 1. Hero Banner
  heroBadgeText?: string;
  heroTitle?: string;
  heroDescription?: string;
  heroCtaText?: string;

  // 2. Section Header
  sectionSubheader?: string;
  sectionTitle?: string;
  sectionDescription?: string;

  // 3. Card Texts
  freeTitle?: string;
  freeSubtitle?: string;
  freePriceLabel?: string;
  freePriceSubtext?: string;
  freeDeliveryHoursText?: string;
  freeButtonText?: string;

  plusTitle?: string;
  plusSubtitle?: string;
  plusPriceSubtext?: string;
  plusButtonText?: string;

  proTopLabel?: string;
  proTitle?: string;
  proSubtitle?: string;
  proPriceSubtext?: string;
  proButtonText?: string;

  // 4. Comparison Table
  comparisonTitle?: string;
  comparisonFeatureHeader?: string;
  comparisonFreeHeader?: string;
  comparisonPlusHeader?: string;
  comparisonProHeader?: string;
  comparisonRows?: ComparisonRow[];

  // 5. FAQ Section
  faqSubheader?: string;
  faqTitle?: string;
  faqItems?: FaqItem[];
}

export interface SubscriptionStats {
  proCount: number;
  plusCount: number;
  freeCount: number;
  totalUsers: number;
  proCapacity: number;
  plusCapacity: number;
  proRemaining: number | null; // null if unlimited
  plusRemaining: number | null;
  isProFull: boolean;
  isPlusFull: boolean;
}


export interface SiteContent {
  // Top Announcement Bar
  topBannerActive: boolean;
  topBannerText: string;
  topBannerLinkText: string;

  // Hero Section
  heroBadgeText: string;
  heroTitlePart1: string;
  heroTitleHighlight: string;
  heroSubtitle: string;
  heroCtaProductsText: string;
  heroCtaProText: string;
  heroStat1Number: string;
  heroStat1Label: string;
  heroStat2Number: string;
  heroStat2Label: string;
  heroStat3Number: string;
  heroStat3Label: string;

  // Trust & Value Propositions (backward-compatible strings + detailed titles/descriptions)
  trustItem1: string;
  trustItem2: string;
  trustItem3: string;
  trustItem1Title?: string;
  trustItem1Desc?: string;
  trustItem2Title?: string;
  trustItem2Desc?: string;
  trustItem3Title?: string;
  trustItem3Desc?: string;
  trustItem4Title?: string;
  trustItem4Desc?: string;

  // Products Showcase Section
  productsSectionTitle: string;
  productsSectionSubtitle: string;
  productsBadgeText: string;

  // Membership & Club Section
  proSectionTitle: string;
  proSectionSubtitle: string;
  proSectionBadge: string;
  proCardHighlight: string;
  plusCardHighlight: string;

  // Wholesale & Bulk Section
  bulkSectionTitle: string;
  bulkSectionSubtitle: string;
  bulkBadgeText: string;
  bulkCtaText: string;

  // Shiraz Farm Story & About
  storyTitle: string;
  storyDescription: string;
  storyLocation: string;
  storyBadgeText?: string;

  // Site Media & Images
  heroImageUrl?: string;
  heroImageTag?: string;
  heroImageCaption?: string;
  bulkSectionImageUrl?: string;
  storyImageUrl?: string;

  // Footer, Social & Contact
  supportPhone: string;
  supportHours: string;
  supportAddress: string;
  footerAboutText: string;
  socialInstagram?: string;
  socialTelegram?: string;
  socialEitaa?: string;
  socialWhatsapp?: string;
}

export type ProductStatus = 'AVAILABLE' | 'OUT_OF_STOCK' | 'COMING_SOON';

export interface ProductSpecification {
  key: string;
  value: string;
}

export interface ProductFaq {
  question: string;
  answer: string;
}

export interface ProductNutritionalInfo {
  calories?: string;
  protein?: string;
  fat?: string;
  carbs?: string;
  fiber?: string;
  salt?: string;
  servingSize?: string;
}

export interface Product {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  price: number; // تومان
  /** false = inactive: hidden from customers (set by the admin). Missing means active. */
  isAvailable?: boolean;
  costPrice?: number; // قیمت خرید از مزرعه / تمام شده (تومان)
  packSize?: string | null; // مانند "بسته ۳۰ عددی" یا "شیشه ۵۰۰ گرمی"
  /** Number of eggs per pack (explicit; preferred over guessing from packSize / title). */
  eggPackSize?: number | null;
  weightKg?: number | null;
  dimensions?: string | null;
  stock: number;
  status?: ProductStatus; // موجود، ناموجود، به زودی
  images: string[];
  isOrganicCertified: boolean;
  isDigital?: boolean;
  isBulkEligible: boolean;
  minBulkQuantity: number;

  // Modern Specifications & Rich Content
  specifications?: ProductSpecification[];
  highlights?: string[];
  storageInstructions?: string;
  nutritionalInfo?: ProductNutritionalInfo;
  faqs?: ProductFaq[];
  originLocation?: string;
  shelfLife?: string;

  // Automated & Custom SEO Fields
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
  canonicalUrl?: string;

  createdAt?: string;
  updatedAt?: string;
}

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ProductReview {
  id: string;
  productId: string;
  productSlug: string;
  productTitle: string;
  userId: string;
  userName: string;
  userPhone?: string;
  userAvatar?: string | null;
  rating: number; // 1 to 5
  title?: string;
  comment: string;
  isVerifiedBuyer: boolean;
  orderId?: string;
  pros?: string[];
  cons?: string[];
  isRecommended?: boolean;
  status: ReviewStatus;
  adminResponse?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Address {
  id: string;
  userId: string;
  recipientName: string;
  phone: string;
  province: string;
  city: string;
  postalCode: string;
  streetAddress: string;
  unit?: string | null;
  isShiraz: boolean;
  isDefault?: boolean;
  createdAt?: string;
}

/**
 * Delivery slot. Stored orders keep the canonical fields (id, isoDate, window, jalaliLabel, dayOfWeekIndex)
 * plus the legacy display fields (date, dayOfWeek, timeWindow) that older screens still read.
 * id format: `${isoDate}_${window}`, e.g. `2026-11-22_15-21` (dates are Asia/Tehran civil dates).
 */
export interface DeliverySlot {
  id: string;
  date: string; // تاریخ شمسی کوتاه مانند "۱۴۰۵/۰۸/۲۹"
  isoDate?: string; // YYYY-MM-DD (Asia/Tehran civil date)
  window?: string; // e.g. "15-21"
  jalaliLabel?: string; // e.g. "یکشنبه ۲۹ آبان ۱۴۰۵"
  dayOfWeekIndex?: number; // 0 = Sunday ... 6 = Saturday
  dayOfWeek: string; // "شنبه", "یکشنبه", "چهارشنبه", ...
  timeWindow: string; // "۱۵:۰۰ الی ۲۱:۰۰"
  maxCapacity: number;
  currentBookings: number;
  isAvailable?: boolean;
}

/** A bookable slot as offered to a user (Phase 3 API and checkout). */
export interface AvailableDeliverySlot {
  id: string;
  isoDate: string;
  window: string;
  jalaliLabel: string;
  dayOfWeekIndex: number;
  maxCapacity: number;
  bookedCount: number;
  remainingCapacity: number;
  isClosed: boolean;
  isAllowedForTier: boolean;
  isAvailable: boolean;
}

export interface OrderItem {
  id: string;
  orderId?: string;
  productId: string;
  product: Product;
  quantity: number;
  /** Server price per unit at the time of sale (تومان). */
  unitPrice: number;
  /** Gross line total (unitPrice * quantity), before tier discounts. */
  totalPrice: number;
  /** Tier discount applied to this line (تومان). */
  discountAmount?: number;
  /** Number of eggs on this line that actually received the subscription egg discount. */
  eggDiscountedCount?: number;
  /** Cost price snapshot at sale time (for finance). */
  costPriceAtSale?: number;
}

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  gateway: 'zarinpal' | 'snapppay' | string;
  authority?: string | null;
  refId?: string | null;
  status: PaymentStatus;
  installmentsCount?: number;
  installmentAmount?: number;
  createdAt?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  user?: User;
  addressId: string;
  address: Address;
  deliverySlotId?: string | null;
  deliverySlot?: DeliverySlot | null;
  totalAmount: number;
  status: OrderStatus;
  isBulkOrder: boolean;
  bulkNotes?: string | null;
  isSubscription?: boolean;
  subscriptionPlan?: 'PLUS' | 'PRO';
  items: OrderItem[];
  payment?: Payment | null;
  settlementStatus?: 'SETTLED' | 'PENDING' | 'REFUNDED';
  settlementRef?: string;

  // Pricing snapshot (computed by the server quote at creation time)
  subtotal?: number; // sum of gross line totals
  tierDiscountAmount?: number; // egg + other-goods subscription discounts
  /** Shipping actually charged. 0 for outside-Shiraz bulk orders: freight is quoted separately. */
  shippingFee?: number;
  couponCode?: string | null;
  couponDiscountAmount?: number;
  /** true once this order has been counted in the coupon usageCount (paid, or COD at creation). */
  couponCounted?: boolean;
  /** true once cancelOrderSideEffects has restored stock, slot and coupon for this order. */
  sideEffectsReleased?: boolean;
  /** true when the payment deadline (not a customer or admin) cancelled this unpaid order. A late payment may revive it. */
  cancelledByExpiry?: boolean;
  /** Payment confirmed by the gateway after the order was already cancelled. Needs a manual refund. */
  paidAfterCancel?: boolean;
  paymentMethod?: 'zarinpal' | 'snapppay' | 'cod' | string;
  isShiraz?: boolean;
  /** Set when the order reaches DELIVERED (ISO). The 7-day return window starts here. */
  deliveredAt?: string | null;
  /** Who created the order. Manual orders are entered by an admin (phone or counter sale). */
  source?: 'ONLINE' | 'ADMIN_MANUAL';
  /** Payment method chosen for a manual order. */
  manualPaymentMethod?: 'cash' | 'card-on-delivery' | 'paid-offline';

  createdAt: string;
  updatedAt?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface BulkInquiry {
  id: string;
  name: string;
  phone: string;
  city: string;
  companyName?: string | null;
  message: string;
  status: 'PENDING' | 'REVIEWED' | 'COMPLETED';
  createdAt: string;
}

export interface FinancialRecord {
  id: string;
  orderNumber: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  customerTier: SubscriptionTier;
  grossAmount: number; // جمع کالاها قبل از تخفیف
  discountAmount: number; // تخفیف اعطا شده
  shippingFee: number; // هزینه حمل
  netPayableAmount: number; // مبلغ نهایی فاکتور
  paymentGateway: string; // شاپرک / زرین‌پال / نقدی
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  itemCount: number;
  costAmount?: number; // بهای تمام شده خرید کالاها
  profitAmount?: number; // سود ناخالص این سفارش
  settlementStatus?: 'SETTLED' | 'PENDING' | 'REFUNDED'; // وضعیت تسویه با حساب بانکی
  settlementRef?: string; // شماره ارجاع شبا یا تسویه شاپرک
}

export interface CategoryRevenue {
  category: string;
  revenue: number;
  ordersCount: number;
  percentage: number;
}

export interface TierRevenue {
  tier: SubscriptionTier;
  label: string;
  revenue: number;
  ordersCount: number;
  percentage: number;
}

export interface GatewayRevenue {
  gateway: string;
  label: string;
  totalAmount: number;
  count: number;
  percentage: number;
}

export interface DailyShiftStat {
  shiftName: string; // ۰۸:۰۰ الی ۱۲:۰۰ (صبح)، ۱۲:۰۰ الی ۱۶:۰۰ (ظهر)، ۱۶:۰۰ الی ۲۰:۰۰ (عصر)، ۲۰:۰۰ الی ۲۴:۰۰ (شب)
  ordersCount: number;
  grossRevenue: number;
  totalDiscount: number;
  netRevenue: number;
  grossProfit: number;
  averageOrderValue: number;
  topProduct?: string;
}

export interface WeeklyDayStat {
  dayName: string; // شنبه، یکشنبه، دوشنبه، سه‌شنبه، چهارشنبه، پنج‌شنبه، جمعه
  date: string; // ۱۴۰۵/۰۶/۲۴
  ordersCount: number;
  grossRevenue: number;
  totalDiscount: number;
  netRevenue: number;
  grossProfit: number;
  averageOrderValue: number;
  topGateway?: string;
  isToday?: boolean;
}

export interface MonthlyFinancialStat {
  monthIndex: number; // 1 to 12
  monthName: string; // فروردین، اردیبهشت، ...
  year: number; // 1405
  ordersCount: number;
  grossRevenue: number;
  totalDiscount: number;
  netRevenue: number;
  grossProfit: number;
  averageOrderValue: number;
  topGateway?: string;
  isCurrentMonth?: boolean;
}

export interface FinancialSummary {
  grossRevenue: number;
  totalDiscount: number;
  netRevenue: number;
  totalShipping: number;
  averageOrderValue: number;
  totalOrdersCount: number;
  subscriptionRevenue: number;
  totalCost?: number; // بهای کل خرید از مزرعه
  grossProfit?: number; // سود ناخالص کل
  profitMarginPercent?: number; // درصد حاشیه سود
  gatewayBreakdown?: GatewayRevenue[]; // تفکیک درآمد بر اساس درگاه و روش پرداخت
  categoryRevenues: CategoryRevenue[];
  tierRevenues: TierRevenue[];
  monthlyStats?: MonthlyFinancialStat[]; // تفکیک عملکرد مالی ماه‌های سال
  weeklyStats?: WeeklyDayStat[]; // تفکیک عملکرد روزهای هفته
  dailyStats?: DailyShiftStat[]; // تفکیک شیفت‌ها و ساعات روز
  selectedPeriodLabel?: string;
  selectedMonthName?: string;
}

// --- COUPONS / DISCOUNT CODES ---
export type CouponTargetType = 'ALL_PRODUCTS' | 'SPECIFIC_PRODUCT' | 'SHIPPING';
export type CouponDiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';

export interface Coupon {
  id: string;
  code: string; // کد تخفیف مثلا SHIRAZ1403, FREESHIP
  title: string; // عنوان مثلا تخفیف ویژه عید
  description?: string;
  targetType: CouponTargetType; // نوع هدف: همه کالاها، کالای خاص، حمل و نقل
  targetProductId?: string; // شناسه کالا در صورت انتخاب کالای خاص
  targetProductName?: string; // عنوان کالا برای نمایش سریع
  discountType: CouponDiscountType; // درصدی یا مبلغ ثابت به تومان
  discountValue: number; // درصد (مثلا ۱۵) یا مبلغ (مثلا ۵۰۰۰۰ تومان)
  minOrderAmount?: number; // حداقل مبلغ سفارش
  maxDiscountAmount?: number; // حداکثر سقف تخفیف درصدی
  usageLimit?: number; // حداکثر تعداد مجاز استفاده
  perUserLimit?: number; // حداکثر تعداد استفاده برای هر کاربر
  usageCount: number; // تعداد دفعات استفاده شده تاکنون (فقط سفارش‌های پرداخت‌شده / COD)
  isActive: boolean; // فعال / غیرفعال
  startsAt?: string | null; // شروع اعتبار (ایزو یا شمسی)
  expiresAt?: string | null; // تاریخ انقضا به شمسی یا ایزو
  createdAt: string;
  updatedAt?: string;
}

export interface CouponValidationResult {
  isValid: boolean;
  message: string;
  coupon?: Coupon;
  discountAmount: number;
  targetType?: CouponTargetType;
}

export interface DailyCapacityItem {
  dateIso: string;
  jalaliFormatted: string;
  dayOfWeek: string;
  maxCapacity: number;
  bookedCount: number;
  isClosedManually: boolean;
  remainingCapacity: number;
  status: 'OPEN' | 'NEAR_FULL' | 'FULL';
}

export interface ZarinPalSettings {
  enabled: boolean;
  merchantId: string;
  sandbox: boolean;
  defaultDescription: string;
}

export interface SnappPaySettings {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  minAmount: number;
}

export interface GeneralPaymentSettings {
  currency: 'IRT' | 'IRR';
  allowCashOnDelivery: boolean;
  paymentTimeoutMinutes: number;
  /** Hours a cash-on-delivery order may stay unconfirmed before it is cancelled (integer 1..720, default 48). */
  codConfirmationHours?: number;
  guideMessage?: string;
}

export interface PaymentSettings {
  zarinpal: ZarinPalSettings;
  snapppay: SnappPaySettings;
  general: GeneralPaymentSettings;
  updatedAt?: string;
}

// --- RETURNS & REFUNDS ---
export type ReturnStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REFUNDED';

export interface ReturnRequest {
  id: string;
  orderNumber: string;
  /** Account that opened the request (customer returns). Absent on admin-created records. */
  userId?: string;
  /** Product slug/id of the returned line (customer returns). */
  productId?: string;
  customerName: string;
  customerPhone: string;
  productTitle?: string;
  quantity?: number;
  reason: 'DAMAGE' | 'QUALITY' | 'WRONG_ITEM' | 'CUSTOMER_CANCEL' | 'DAMAGE_IN_TRANSIT' | 'QUALITY_ISSUE' | string;
  reasonTitle?: string;
  description: string;
  refundAmount: number;
  status: ReturnStatus;
  adminNotes?: string;
  adminNote?: string;
  createdAt: string;
  updatedAt?: string;
}

// --- SMS BROADCAST & CAMPAIGNS & EVENT TEMPLATES ---
export type SmsTargetSegment =
  | 'ALL'
  | 'ALL_USERS'
  | 'FREE_USERS'
  | 'PRO_MEMBERS'
  | 'PLUS_MEMBERS'
  | 'SHIRAZ_BUYERS'
  | 'CUSTOM';

export type SmsEventType =
  | 'ORDER_PLACED'
  | 'ORDER_PROCESSING'
  | 'ORDER_OUT_FOR_DELIVERY'
  | 'ORDER_DELIVERED'
  | 'ORDER_CANCELLED'
  | 'SUBSCRIPTION_ACTIVATED'
  | 'RETURN_STATUS_CHANGED';

export interface SmsEventTemplate {
  id: SmsEventType;
  title: string;
  category: 'ORDERS' | 'CLUB' | 'RETURNS';
  description: string;
  template: string;
  isEnabled: boolean;
  availableVariables: { key: string; label: string }[];
  updatedAt?: string;
}

export interface SmsBroadcast {
  id: string;
  title: string;
  message: string;
  targetSegment: SmsTargetSegment;
  targetSegmentTitle?: string;
  recipientCount: number;
  customNumbers?: string | string[];
  status?: 'SENT' | 'SCHEDULED' | 'FAILED' | 'PARTIAL';
  /** Messages the provider accepted (real counts from the dispatcher, never estimated). */
  sentCount?: number;
  /** Messages the provider refused or that could not be sent. */
  failedCount?: number;
  /** Provider the broadcast went through (MOCK in development). */
  provider?: string;
  /** Admin username or id who sent it. */
  sentBy?: string;
  sentAt: string;
  createdAt?: string;
}

// --- SMS PROVIDER / GATEWAY API SETTINGS ---
export type SmsProviderType = 'KAVENEGAR' | 'MELIPAYAMAK' | 'FARAZ_SMS' | 'CUSTOM';

export interface SmsProviderSettings {
  provider: SmsProviderType;
  apiKey: string;
  senderNumber: string;
  patternCode?: string;
  username?: string;
  password?: string;
  apiUrl?: string;
  isEnabled: boolean;
  testPhone?: string;
  updatedAt?: string;
}
// --- EMAIL PROVIDER / SMTP SETTINGS ---
export type EmailProviderType = 'SMTP' | 'MOCK';

export interface EmailProviderSettings {
  isEnabled: boolean;
  provider: EmailProviderType;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpSecure: boolean;
  fromEmail: string;
  fromName: string;
  updatedAt?: string;
}
