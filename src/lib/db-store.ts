/**
 * Unified data store for Pro Farm.
 * Seamlessly manages Products, Orders, Delivery Slots, Users, and Pro Memberships.
 */
import crypto from 'crypto';
import {
  Product,
  Order,
  Payment,
  DeliverySlot,
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
import { generateDeliverySlots, formatToJalali, PERSIAN_MONTHS, PERSIAN_WEEKDAYS } from './jalali';
import { sendOrderStatusSms, sendCustomSms } from './sms';
import { isCountableSaleOrder } from './order-utils';
import {
  generateSeoSlug,
  generateProductSeoTitle,
  generateProductSeoDescription,
  generateProductSeoKeywords,
} from './seo-utils';
import { hashPassword, verifyPassword, needsPasswordRehash } from './password';
import { getDeduplicatedPerks, normalizePhoneNumber } from './formatters';

export function sanitizeUser(user: User): User {
  const { password, ...safeUser } = user;
  return safeUser as User;
}

export const DEFAULT_FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-1',
    q: 'سقف ۲۰۰ و ۶۰۰ عدد تخم‌مرغ چگونه محاسبه می‌شود؟',
    a: 'سفارش‌های تخم‌مرغ معمولاً در بسته‌های ۳۰ یا ۲۰ عددی هستند. سیستم در هر سبد خرید به صورت خودکار تعداد تخم‌مرغ را شمرده و تا سقف اعلام‌شده (۲۰۰ عدد برای پلاس و ۶۰۰ عدد برای پرو) درصد تخفیف را اعمال می‌کند.',
    question: 'سقف ۲۰۰ و ۶۰۰ عدد تخم‌مرغ چگونه محاسبه می‌شود؟',
    answer:
      'سفارش‌های تخم‌مرغ معمولاً در بسته‌های ۳۰ یا ۲۰ عددی هستند. سیستم در هر سبد خرید به صورت خودکار تعداد تخم‌مرغ را شمرده و تا سقف اعلام‌شده (۲۰۰ عدد برای پلاس و ۶۰۰ عدد برای پرو) درصد تخفیف را اعمال می‌کند.',
  },
  {
    id: 'faq-2',
    q: 'تحویل در چه ساعاتی از شبانه‌روز انجام می‌شود؟',
    a: 'پیک اختصاصی پروفارم در شیراز، سفارش‌ها را در بسته‌بندی کاملاً بهداشتی و ایمن، همه روزه از ساعت ۱۵:۰۰ الی ۲۱:۰۰ تحویل می‌دهد.',
    question: 'تحویل در چه ساعاتی از شبانه‌روز انجام می‌شود؟',
    answer:
      'پیک اختصاصی پروفارم در شیراز، سفارش‌ها را در بسته‌بندی کاملاً بهداشتی و ایمن، همه روزه از ساعت ۱۵:۰۰ الی ۲۱:۰۰ تحویل می‌دهد.',
  },
  {
    id: 'faq-3',
    q: 'آیا می‌توانم اشتراک را در هر زمان ارتقا دهم؟',
    a: 'بله، شما می‌توانید در هر زمان از طرح عادی به پلاس یا از پلاس به پرو ارتقا دهید و بلافاصله امکانات و تخفیف‌های آن در همان روز برای شما فعال خواهد شد.',
    question: 'آیا می‌توانم اشتراک را در هر زمان ارتقا دهم؟',
    answer:
      'بله، شما می‌توانید در هر زمان از طرح عادی به پلاس یا از پلاس به پرو ارتقا دهید و بلافاصله امکانات و تخفیف‌های آن در همان روز برای شما فعال خواهد شد.',
  },
  {
    id: 'faq-4',
    q: 'آیا تخفیف ۲۰ درصدی ارسال روی همه سفارش‌ها اعمال می‌شود؟',
    a: 'بله، مشترکین پرو به صورت نامحدود و بدون سقف تعداد سفارش، ۲۰٪ تخفیف روی هزینه ارسال پیک پروفارم دریافت می‌کنند.',
    question: 'آیا تخفیف ۲۰ درصدی ارسال روی همه سفارش‌ها اعمال می‌شود؟',
    answer:
      'بله، مشترکین پرو به صورت نامحدود و بدون سقف تعداد سفارش، ۲۰٪ تخفیف روی هزینه ارسال پیک پروفارم دریافت می‌کنند.',
  },
];

export const DEFAULT_COMPARISON_ROWS: ComparisonRow[] = [
  {
    id: 'row-1',
    title: 'هزینه اشتراک ماهانه',
    free: '۰ تومان',
    plus: '۱۴۹,۰۰۰ تومان',
    pro: '۳۲۹,۰۰۰ تومان',
  },
  {
    id: 'row-2',
    title: 'روزهای مجاز تحویل در شیراز',
    free: 'روزهای یکشنبه و چهارشنبه',
    plus: '۶ روز در هفته (شنبه تا ۵‌شنبه)',
    pro: '۶ روز در هفته (شنبه تا ۵‌شنبه)',
  },
  {
    id: 'row-3',
    title: 'تخفیف تخم‌مرغ محلی ارگانیک',
    free: 'ندارد',
    plus: '۵٪ (تا سقف ۲۰۰ عدد)',
    pro: '۱۰٪ (تا سقف ۶۰۰ عدد)',
  },
  {
    id: 'row-4',
    title: 'تخفیف روی سایر کالاها',
    free: 'ندارد',
    plus: 'ندارد',
    pro: '۵٪ نامحدود روی تمام کالاها',
  },
  {
    id: 'row-5',
    title: 'تخفیف هزینه ارسال پیک پروفارم',
    free: 'ندارد (۴۹,۰۰۰ تومان)',
    plus: 'ندارد (۴۹,۰۰۰ تومان)',
    pro: '۲۰٪ تخفیف (۳۹,۲۰۰ تومان)',
  },
  {
    id: 'row-6',
    title: 'اولویت کالاهای محدود و فصلی',
    free: 'عادی',
    plus: 'متوسط',
    pro: 'بالاترین اولویت دسترسی',
  },
];

export const DEFAULT_SUBSCRIPTION_SETTINGS: SubscriptionSettings = {
  proMonthlyPrice: 329000,
  proEggDiscountPercent: 10,
  proEggMaxQuota: 600,
  proOtherDiscountPercent: 5,
  proShippingDiscountPercent: 20,
  proDeliveryDaysPerWeek: 6,
  proMaxCapacity: 50,
  proBadgeText: 'پیشنهاد طلایی',
  proFeatures: [
    'تحویل ۶ روز در هفته از شنبه تا پنج‌شنبه',
    '۱۰٪ تخفیف خرید تخم‌مرغ محلی تا سقف ۶۰۰ عدد',
    '۵٪ تخفیف نامحدود روی تمامی بقیه محصولات سایت',
    '۲۰٪ تخفیف نامحدود روی هزینه ارسال پیک پروفارم',
    'اولویت ارسال سفارش و دسترسی به محصولات کمیاب (عسل وحشی، پنیر کوزه‌ای)',
    'پشتیبانی تلفنی و مشاور اختصاصی سلامت تغذیه ارگانیک',
    'بسته‌بندی ویژه مزارع با کارتن عایق حرارتی اختصاصی',
    'امکان انصراف یا تعلیق موقت اشتراک در زمان مسافرت',
  ],

  plusMonthlyPrice: 149000,
  plusEggDiscountPercent: 5,
  plusEggMaxQuota: 200,
  plusDeliveryDaysPerWeek: 6,
  plusMaxCapacity: 100,
  plusBadgeText: 'اقتصادی',
  plusFeatures: [
    'تحویل ۶ روز در هفته (شنبه تا پنج‌شنبه)',
    '۵٪ تخفیف تخم‌مرغ محلی تا سقف ۲۰۰ عدد در ماه',
    'رزرو اولویت‌دار اسلات‌های توزیع پیک شیراز',
    'امکان انتخاب بازه زمانی تحویل ۲ ساعته',
    'پشتیبانی اولویت‌دار سفارش‌های مزارع',
  ],

  baseShippingFee: 49000,
  freeTierDeliveryDaysText: 'شنبه، دوشنبه و چهارشنبه',
  freeBadgeText: 'طرح پایه',
  freeFeatures: [
    'تحویل: یکشنبه و چهارشنبه',
    'بازه تحویل ۱۵:۰۰ الی ۲۱:۰۰ پیک پروفارم',
    'دسترسی کامل به تمامی محصولات تازه و فصلی مزارع',
    'بسته‌بندی بهداشتی استاندارد مزارع شیراز',
  ],

  // Visual in-place customizable texts:
  // 1. Hero Banner
  heroBadgeText: 'باشگاه مشترکین ویژه «پروفارم شیراز»',
  heroTitle: 'طراوت هر روزه با تحویل ۶ روز هفته و تخفیف‌های ویژه مزارع فارس',
  heroDescription:
    'کاربران عادی تنها ۲ روز در هفته (یکشنبه و چهارشنبه) امکان دریافت سفارش دارند. با اشتراک‌های پلاس یا پرو، از شنبه تا پنج‌شنبه هر روزی که بخواهید سفارشتان با پیک پروفارم ارسال شده و از تخفیف‌های دائمی خرید تخم‌مرغ محلی و محصولات ارگانیک بهره‌مند می‌شوید.',
  heroCtaText: 'مشاهده محصولات مزارع',

  // 2. Section Header
  sectionSubheader: 'انتخاب پلن مناسب نیاز شما',
  sectionTitle: 'مقایسه و انتخاب اشتراک ماهانه پروفارم',
  sectionDescription: 'برای خانواده‌هایی که سلامت و کیفیت تغذیه روزمره‌شان در اولویت است',

  // 3. Card Texts
  freeTitle: 'کاربر عادی',
  freeSubtitle: 'سفارش‌های گاه‌به‌گاه و خرید آزمایشی',
  freePriceLabel: 'رایگان',
  freePriceSubtext: 'بدون نیاز به پرداخت ماهانه',
  freeDeliveryHoursText: 'بازه تحویل ۱۵:۰۰ الی ۲۱:۰۰ پیک پروفارم',
  freeButtonText: 'طرح فعلی شما (رایگان) ✓',

  plusTitle: 'اشتراک پلاس',
  plusSubtitle: 'تحویل همه روزه + تخفیف تخم‌مرغ محلی',
  plusPriceSubtext: 'صرفه‌جویی تضمین‌شده در خرید هفتگی',
  plusButtonText: 'خرید اشتراک پلاس',

  proTopLabel: 'اشتراک طلایی پروفارم پرو',
  proTitle: 'اشتراک پرو (Pro)',
  proSubtitle: 'حداکثر تخفیف و بیشترین انعطاف در دریافت',
  proPriceSubtext: '۱۰٪ تخم‌مرغ + ۵٪ سایر محصولات + ۲۰٪ تخفیف ارسال',
  proButtonText: 'خرید اشتراک پرو',

  // 4. Comparison Table
  comparisonTitle: 'جدول مقایسه جامع ویژگی‌های پلن‌ها',
  comparisonFeatureHeader: 'ویژگی و امکانات',
  comparisonFreeHeader: 'کاربر عادی',
  comparisonPlusHeader: 'اشتراک پلاس',
  comparisonProHeader: 'اشتراک پرو',
  comparisonRows: DEFAULT_COMPARISON_ROWS,

  // 5. FAQ Section
  faqSubheader: 'پرسش‌های متداول',
  faqTitle: 'سوالاتی که ممکن است داشته باشید',
  faqItems: DEFAULT_FAQ_ITEMS,
};

export const DEFAULT_SMS_PROVIDER_SETTINGS: SmsProviderSettings = {
  provider: (process.env.SMS_PROVIDER as any) || 'MOCK',
  apiKey: process.env.SMS_API_KEY || '',
  senderNumber: process.env.SMS_SENDER_LINE || '',
  patternCode: 'profarm-notif',
  apiUrl: 'https://api.kavenegar.com/v1',
  isEnabled: true,
  testPhone: '',
  updatedAt: '۱۴۰۵/۰۶/۱۵',
};

export const DEFAULT_EMAIL_PROVIDER_SETTINGS: EmailProviderSettings = {
  isEnabled: true,
  provider: (process.env.EMAIL_PROVIDER as any) || (process.env.SMTP_HOST ? 'SMTP' : 'SMTP'),
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpSecure: process.env.SMTP_SECURE === 'true',
  fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'info@profarm-shiraz.ir',
  fromName: process.env.SMTP_FROM_NAME || 'مزارع ارگانیک پروفارم شیراز',
  updatedAt: '۱۴۰۵/۰۶/۱۵',
};

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  zarinpal: {
    enabled: true,
    merchantId: typeof window === 'undefined' ? (process.env.ZARINPAL_MERCHANT_ID || '') : '',
    sandbox: process.env.ZARINPAL_SANDBOX === 'true',
    defaultDescription: 'سفارش محصولات ارگانیک شیراز',
  },
  snapppay: {
    enabled: true,
    clientId: typeof window === 'undefined' ? (process.env.SNAPPPAY_CLIENT_ID || '') : '',
    clientSecret: typeof window === 'undefined' ? (process.env.SNAPPPAY_CLIENT_SECRET || '') : '',
    baseUrl: process.env.SNAPPPAY_BASE_URL || 'https://api.snapppay.ir/api/online/v1',
    minAmount: 200000,
  },
  general: {
    currency: 'IRT',
    allowCashOnDelivery: false,
    paymentTimeoutMinutes: 15,
    guideMessage: 'پرداخت امن از طریق درگاه رسمی شاپرک با کلیه کارت‌های عضو شتاب',
  },
  updatedAt: new Date().toISOString(),
};

export const DEFAULT_SITE_CONTENT: SiteContent = {
  topBannerActive: true,
  topBannerText: 'توزیع مستقیم مزارع استان فارس به شیراز | تحویل با پیک پروفارم',
  topBannerLinkText: 'عضویت در باشگاه و ارسال روزانه',

  heroBadgeText: 'برداشت اختصاصی پاییز مزارع استان فارس برای اهالی شیراز',
  heroTitlePart1: 'طعم اصیل مزرعه،',
  heroTitleHighlight: 'مستقیم و تازه در شیراز',
  heroSubtitle:
    'پلتفرم رسمی توزیع پکیج‌های ارگانیک؛ از تخم‌مرغ محلی آزاد کامفیروز تا عسل خام دشت ارژن و سبزیجات نوبرانه قصرالدشت. ارسال سریع در شیراز با پیک پروفارم.',
  heroCtaProductsText: 'مشاهده ویترین محصولات ارگانیک',
  heroCtaProText: 'اشتراک پروفارم پرو و پلاس (ارسال ۶ روزه)',
  heroStat1Number: '۴۵۰+',
  heroStat1Label: 'خانواده مشترک در شیراز',
  heroStat2Number: '۱۰۰٪',
  heroStat2Label: 'تضمین اصالت ارگانیک',
  heroStat3Number: '۶ روز',
  heroStat3Label: 'توزیع هفتگی با پیک پروفارم',

  trustItem1: 'تحویل اختصاصی سراسر شیراز',
  trustItem2: 'بسته‌بندی شناسنامه‌دار',
  trustItem3: 'آزمایشگاه کنترل کیفیت ارگانیک',
  trustItem1Title: 'تحویل اختصاصی سراسر شیراز',
  trustItem1Desc: 'پوشش کلیه مناطق شهرداری شیراز با پیک پروفارم',
  trustItem2Title: 'بسته‌بندی شناسنامه‌دار',
  trustItem2Desc: 'پلمپ بهداشتی با برچسب تاریخ دوشش شیر، چیدن سبزی و جمع‌آوری تخم‌مرغ',
  trustItem3Title: 'آزمایشگاه کنترل کیفیت ارگانیک',
  trustItem3Desc: 'برگه آزمایش رسمی اصالت عسل و عدم استفاده از سموم شیمیایی و هورمون',
  trustItem4Title: 'تضمین ۱۰۰٪ رضایت مشتری',
  trustItem4Desc: 'در صورت عدم رضایت از کیفیت، مرجوعی کالا و بازگشت وجه بدون قید و شرط انجام می‌شود',

  productsSectionTitle: 'سبد محصولات برگزیده مزارع فارس',
  productsSectionSubtitle: 'مستقیماً چیده شده و آماده توزیع تازه در سطح شیراز',
  productsBadgeText: 'تازه‌های امروز مزرعه',

  proSectionTitle: 'عضویت در باشگاه اختصاصی پروفارم پرو و پلاس شیراز',
  proSectionSubtitle:
    'ارسال ۶ روز در هفته، تخفیف ویژه خرید تخم‌مرغ محلی، تخفیف نامحدود سایر کالاها و تخفیف هزینه ارسال با پیک پروفارم',
  proSectionBadge: 'صرفه‌جویی طلایی خانوار',
  proCardHighlight: 'پیشنهاد طلایی: ۱۰٪ تخفیف تخم‌مرغ + ۵٪ سایر کالاها + ۲۰٪ ارسال',
  plusCardHighlight: 'پیشنهاد اقتصادی: ۵٪ تخفیف تخم‌مرغ محلی تا ۲۰۰ عدد + ارسال ۶ روزه',

  bulkSectionTitle: 'تامین عمده برای سازمان‌ها، فروشگاه‌ها و سراسر کشور',
  bulkSectionSubtitle: 'توزیع تناژ بالا با بارنامه رسمی، مجوز دامپزشکی و فاکتور رسمی حقوقی',
  bulkBadgeText: 'فروش مستقیم کارگاهی و مزارع',
  bulkCtaText: 'ثبت استعلام خرید عمده',

  storyTitle: 'از دامنه‌های زاگرس تا سفره‌های شیراز',
  storyDescription:
    'پروفارم با گردآوری بیش از ۲۴ مزرعه‌دار سنتی در مناطق کامفیروز، دشت ارژن، سپیدان، فیروزآباد و میمند، واسطه‌ها را حذف کرده تا محصولات طبیعی با حداکثر طراوت و بهای عادلانه به دست مصرف‌کننده برسد.',
  storyLocation: 'دشت ارژن، کامفیروز، سپیدان و میمند فارس',
  storyBadgeText: 'اصالت سرزمین فارس',

  heroImageUrl: '/images/hero-shiraz-farm.jpg',
  heroImageTag: 'تضمین ۱۰۰٪ ارگانیک و محلی',
  heroImageCaption: 'برداشت صبحگاهی و تحویل همان روز در شیراز با پیک پروفارم',
  bulkSectionImageUrl: '/images/bulk-logistics.jpg',
  storyImageUrl: '/images/story-fars-farms.jpg',

  supportPhone: '۰۷۱-۳۶۲۸۰۰۰۰',
  supportHours: 'همه‌روزه از ساعت ۸ صبح الی ۲۲ شب',
  supportAddress: 'شیراز، بلوار ارم، مجتمع کشاورزی و مزارع ارگانیک فارس',
  footerAboutText:
    'پروفارم؛ سامانه پیشرو در عرضه مستقیم محصولات غذایی سالم و ارگانیک مزارع استان فارس با استانداردهای بهداشتی و پیک پروفارم در شیراز.',
  socialInstagram: 'https://instagram.com/profarm_shiraz',
  socialTelegram: 'https://t.me/profarm_shiraz',
  socialEitaa: 'https://eitaa.com/profarm_shiraz',
  socialWhatsapp: 'https://wa.me/989170000000',
};

export const INITIAL_COUPONS: Coupon[] = [
  {
    id: 'coup-shiraz1403',
    code: 'SHIRAZ1403',
    title: 'جشنواره بهاره شیراز (۱۵٪ تخفیف کل سفارش)',
    description: 'تخفیف ویژه ۱۵ درصدی روی سبد خرید کلیه محصولات ارگانیک با سقف ۶۰ هزار تومان',
    targetType: 'ALL_PRODUCTS',
    discountType: 'PERCENTAGE',
    discountValue: 15,
    minOrderAmount: 200000,
    maxDiscountAmount: 60000,
    usageLimit: 100,
    usageCount: 18,
    isActive: true,
    expiresAt: '1404-06-31',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'coup-freeship',
    code: 'FREESHIP',
    title: 'ارسال رایگان با پیک پروفارم',
    description: 'ارسال ۱۰۰٪ رایگان با پیک پروفارم برای سفارش‌های بالای ۱۵۰ هزار تومان',
    targetType: 'SHIPPING',
    discountType: 'PERCENTAGE',
    discountValue: 100,
    minOrderAmount: 150000,
    usageLimit: 50,
    usageCount: 12,
    isActive: true,
    expiresAt: '1404-05-30',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'coup-honey50',
    code: 'HONEY50',
    title: 'تخفیف ۵۰ هزار تومانی عسل وحشی دشت ارژن',
    description: 'تخفیف مستقیم روی خرید عسل وحشی گون و کنار ۱۰۰۰ گرمی دشت ارژن',
    targetType: 'SPECIFIC_PRODUCT',
    targetProductId: 'prod-honey-1000',
    targetProductName: 'عسل وحشی گَوَن و کُنار دشت ارژن (شیشه ۱۰۰۰ گرمی)',
    discountType: 'FIXED_AMOUNT',
    discountValue: 50000,
    minOrderAmount: 0,
    usageLimit: 40,
    usageCount: 8,
    isActive: true,
    expiresAt: '1404-08-15',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'coup-eggs20',
    code: 'EGGS20',
    title: 'تخفیف ۲۰ درصدی تخم‌مرغ کامفیروز',
    description: '۲۰ درصد تخفیف ویژه برای بسته ۳۰ عددی تخم‌مرغ محلی ارگانیک کامفیروز',
    targetType: 'SPECIFIC_PRODUCT',
    targetProductId: 'prod-eggs-30',
    targetProductName: 'تخم‌مرغ محلی ارگانیک کامفیروز (بسته ۳۰ عددی)',
    discountType: 'PERCENTAGE',
    discountValue: 20,
    maxDiscountAmount: 40000,
    minOrderAmount: 0,
    usageLimit: 60,
    usageCount: 14,
    isActive: true,
    expiresAt: '1404-06-15',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'coup-promo100',
    code: 'PROMO100',
    title: 'تخفیف ۱۰۰ هزار تومانی سبدهای میلیونی',
    description: 'تخفیف ۱۰۰ هزار تومانی برای خریدهای بالای ۱ میلیون تومان از محصولات فارس',
    targetType: 'ALL_PRODUCTS',
    discountType: 'FIXED_AMOUNT',
    discountValue: 100000,
    minOrderAmount: 1000000,
    usageLimit: 30,
    usageCount: 5,
    isActive: true,
    expiresAt: '1404-12-29',
    createdAt: new Date().toISOString(),
  },
];

// Persistent in-process memory stores
class FarmDataStore {
  private products: Product[] = [...INITIAL_PRODUCTS];
  private orders: Order[] = [...INITIAL_ADMIN_ORDERS];
  private users: Map<string, User> = new Map();
  private bulkInquiries: BulkInquiry[] = [];
  private categories: string[] = [...INITIAL_CATEGORIES];
  private slotBookings: Map<string, number> = new Map();
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
    if (typeof window !== 'undefined') return null;
    if (!process.env.DATABASE_URL) return null;
    try {
      const { prisma } = require('@/lib/prisma');
      return prisma;
    } catch {
      return null;
    }
  }

  private async isDatabaseReachable(): Promise<boolean> {
    if (typeof window !== 'undefined' || !process.env.DATABASE_URL) return false;
    try {
      const parsedUrl = new URL(process.env.DATABASE_URL);
      const host = parsedUrl.hostname || 'localhost';
      const port = parseInt(parsedUrl.port || '5432', 10);
      const net = require('net');

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
  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }

  private saveItem<T>(key: string, data: T): void {
    if (!this.isBrowser()) return;
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn(`[FarmStore] Failed to save ${key} to localStorage:`, e);
    }
  }

  private loadItem<T>(key: string, fallback: T): T {
    if (!this.isBrowser()) return fallback;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn(`[FarmStore] Failed to load ${key} from localStorage:`, e);
    }
    return fallback;
  }

  // --- SERVER-SIDE DATA FILE PERSISTENCE ---
  private getServerDataFilePath(): string | null {
    if (typeof window !== 'undefined') return null;
    try {
      const fs = require('fs');
      const path = require('path');
      const dataDir = path.join(process.cwd(), '.data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      return path.join(dataDir, 'profarm_store.json');
    } catch {
      return null;
    }
  }

  public saveServerState(): void {
    if (typeof window !== 'undefined') return;
    try {
      const filePath = this.getServerDataFilePath();
      if (!filePath) return;
      const fs = require('fs');
      const data = {
        users: Array.from(this.users.entries()),
        orders: this.orders,
        coupons: this.coupons,
        paymentSettings: this.paymentSettings,
        subscriptionSettings: this.subscriptionSettings,
        products: this.products,
        smsSettings: this.smsSettings,
        bulkInquiries: this.bulkInquiries,
        reviews: this.reviews,
        emailLogs: this.emailLogs,
        emailSettings: this.emailSettings,
        siteContent: this.siteContent,
        savedAt: new Date().toISOString(),
      };

      const serialized = JSON.stringify(data, null, 2);
      const tempPath = `${filePath}.tmp.${Date.now()}`;
      const backupPath = `${filePath}.bak`;

      // 1. ATOMIC WRITE STEP 1: Write to temporary file first
      const fd = fs.openSync(tempPath, 'w');
      fs.writeSync(fd, serialized, 0, 'utf-8');
      // Force disk controller to flush physical cache (crash safety)
      fs.fsyncSync(fd);
      fs.closeSync(fd);

      // 2. ATOMIC WRITE STEP 2: Rotate previous healthy file to .bak as emergency recovery
      if (fs.existsSync(filePath)) {
        try {
          fs.copyFileSync(filePath, backupPath);
        } catch {}
      }

      // 3. ATOMIC WRITE STEP 3: Atomic rename
      // On Windows NTFS and POSIX, rename is an atomic filesystem operation.
      // If a sudden power cut occurs, the file is guaranteed to be 100% the old valid file
      // or 100% the new valid file — it can NEVER be corrupted or 0-bytes.
      fs.renameSync(tempPath, filePath);

      // 4. PERSISTENCE STEP 4: PostgreSQL Prisma Sync (when DATABASE_URL is configured)
      const prisma = this.getPrisma();
      if (prisma) {
        this.persistToPrismaAsync(prisma).catch(() => {});
      }
    } catch (e) {
      console.warn('[FarmStore] Failed to save server state:', e);
    }
  }

  public async syncFromPrisma(): Promise<boolean> {
    if (typeof window !== 'undefined') return false;
    const prisma = this.getPrisma();
    if (!prisma) return false;
    if (this.isDatabaseSyncing) return false;

    // Fast socket health check: if DB port is closed, gracefully skip without error dumps
    const isOnline = await this.isDatabaseReachable();
    if (!isOnline) {
      return false;
    }

    this.isDatabaseSyncing = true;
    try {
      // 1. Site Content Singleton
      const siteContentRecord = await prisma.siteContent.findUnique({ where: { id: 'singleton' } }).catch(() => null);
      if (siteContentRecord?.content && typeof siteContentRecord.content === 'object') {
        this.siteContent = { ...DEFAULT_SITE_CONTENT, ...(siteContentRecord.content as any) };
      }

      // 2. Subscription Settings Singleton
      const subSettingsRecord = await prisma.subscriptionSettings.findUnique({ where: { id: 'singleton' } }).catch(() => null);
      if (subSettingsRecord?.settings && typeof subSettingsRecord.settings === 'object') {
        this.subscriptionSettings = { ...DEFAULT_SUBSCRIPTION_SETTINGS, ...(subSettingsRecord.settings as any) };
      }

      // 3. Payment Settings Singleton
      const paymentSettingsRecord = await prisma.paymentSettings.findUnique({ where: { id: 'singleton' } }).catch(() => null);
      if (paymentSettingsRecord?.settings && typeof paymentSettingsRecord.settings === 'object') {
        this.paymentSettings = { ...DEFAULT_PAYMENT_SETTINGS, ...(paymentSettingsRecord.settings as any) };
      }

      // 4. Products
      const dbProducts = await prisma.product.findMany().catch(() => null);
      if (dbProducts && dbProducts.length > 0) {
        this.products = dbProducts.map((p: any) => ({
          ...p,
          specifications: (p.specifications as any) || [],
          nutritionalInfo: (p.nutritionalInfo as any) || {},
          faqs: (p.faqs as any) || [],
        }));
      }

      // 5. Users
      const dbUsers = await prisma.user.findMany({ include: { addresses: true } }).catch(() => null);
      if (dbUsers && dbUsers.length > 0) {
        for (const u of dbUsers) {
          const mappedUser: User = {
            id: u.id,
            phone: u.phone,
            username: u.username || `user_${u.phone.slice(-4)}`,
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
            addresses: (u.addresses || []).map((a: any) => ({
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
            })),
          };
          if (mappedUser.phone) this.users.set(mappedUser.phone, mappedUser);
          if (mappedUser.id) this.users.set(mappedUser.id, mappedUser);
        }
      }

      // 6. Coupons
      const dbCoupons = await prisma.coupon.findMany().catch(() => null);
      if (dbCoupons && dbCoupons.length > 0) {
        this.coupons = dbCoupons.map((c: any) => ({
          ...c,
          createdAt: c.createdAt ? c.createdAt.toISOString() : new Date().toISOString(),
        }));
      }

      // 7. Orders (fully include items with product, address, payment, deliverySlot, and user with addresses)
      const dbOrders = await prisma.order
        .findMany({
          include: {
            items: {
              include: {
                product: true,
              },
            },
            address: true,
            payment: true,
            deliverySlot: true,
            user: {
              include: {
                addresses: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        })
        .catch((err: any) => {
          console.error('[FarmStore Prisma Sync ERROR] Failed fetching orders from PostgreSQL:', err?.message || err);
          return null;
        });

      if (dbOrders && dbOrders.length > 0) {
        this.orders = dbOrders.map((o: any) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          userId: o.userId,
          user: this.users.get(o.userId) || this.users.get(o.address?.phone),
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
                createdAt: o.payment.createdAt ? o.payment.createdAt.toISOString() : undefined,
              }
            : undefined,
          createdAt: o.createdAt ? o.createdAt.toISOString() : new Date().toISOString(),
          updatedAt: o.updatedAt ? o.updatedAt.toISOString() : undefined,
        }));
      }

      // 8. Reviews
      const dbReviews = await prisma.productReview.findMany({ orderBy: { createdAt: 'desc' } }).catch(() => null);
      if (dbReviews && dbReviews.length > 0) {
        this.reviews = dbReviews.map((r: any) => ({
          ...r,
          createdAt: r.createdAt ? r.createdAt.toISOString() : new Date().toISOString(),
        }));
      }

      // 9. Return Requests
      const dbReturns = await prisma.returnRequest.findMany({ orderBy: { createdAt: 'desc' } }).catch(() => null);
      if (dbReturns && dbReturns.length > 0) {
        this.returnRequests = dbReturns.map((rt: any) => ({
          ...rt,
          createdAt: rt.createdAt ? rt.createdAt.toISOString() : new Date().toISOString(),
        }));
      }

      // 10. SMS Templates
      const dbTemplates = await prisma.smsEventTemplate.findMany().catch(() => null);
      if (dbTemplates && dbTemplates.length > 0) {
        this.smsEventTemplates = dbTemplates.map((t: any) => ({
          ...t,
          availableVariables: (t.availableVariables as any) || [],
        }));
      }

      this.hasSyncedFromPrisma = true;
      return true;
    } catch {
      return false;
    } finally {
      this.isDatabaseSyncing = false;
    }
  }

  public async persistToPrismaAsync(prisma: any): Promise<void> {
    if (!prisma) return;
    const isOnline = await this.isDatabaseReachable();
    if (!isOnline) return;

    try {
      // 1. Singletons
      await prisma.siteContent
        .upsert({
          where: { id: 'singleton' },
          update: { content: this.siteContent as any },
          create: { id: 'singleton', content: this.siteContent as any },
        })
        .catch(() => {});

      await prisma.subscriptionSettings
        .upsert({
          where: { id: 'singleton' },
          update: { settings: this.subscriptionSettings as any },
          create: { id: 'singleton', settings: this.subscriptionSettings as any },
        })
        .catch(() => {});

      await prisma.paymentSettings
        .upsert({
          where: { id: 'singleton' },
          update: { settings: this.paymentSettings as any },
          create: { id: 'singleton', settings: this.paymentSettings as any },
        })
        .catch(() => {});

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
          .catch(() => {});
      }

      // 3. Users
      const userList = Array.from(this.users.values()).filter((u) => Boolean(u.phone));
      for (const u of userList) {
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
          .catch(() => null);

        if (userRec && u.addresses && Array.isArray(u.addresses)) {
          for (const addr of u.addresses) {
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
              .catch(() => {});
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
          .catch((err: any) => {
            console.error(`[FarmStore Prisma ERROR] Failed persisting coupon ${coup.code}:`, err?.message || err);
          });
      }

      // 5. Orders (with User, Address, Order, OrderItem, Payment in atomic prisma.$transaction)
      for (const ord of this.orders) {
        try {
          await prisma.$transaction(async (tx: any) => {
            // A. Ensure User exists
            const userPhone =
              ord.address?.phone ||
              ord.user?.phone ||
              (ord.userId ? this.users.get(ord.userId)?.phone : null);

            if (!userPhone) return;

            const existingUser = this.users.get(userPhone) || ord.user;
            const userRecord = await tx.user.upsert({
              where: { phone: userPhone },
              update: {
                name: existingUser?.name || ord.address?.recipientName || 'مشتری شیراز',
                role: (existingUser?.role as any) || 'USER',
                tier: existingUser?.tier || 'FREE',
                isProMember: existingUser?.isProMember ?? false,
                isPlusMember: existingUser?.isPlusMember ?? false,
              },
              create: {
                id: ord.userId || existingUser?.id || `usr-${Date.now()}`,
                phone: userPhone,
                name: existingUser?.name || ord.address?.recipientName || 'مشتری شیراز',
                role: (existingUser?.role as any) || 'USER',
                tier: existingUser?.tier || 'FREE',
                isProMember: existingUser?.isProMember ?? false,
                isPlusMember: existingUser?.isPlusMember ?? false,
              },
            });

            // B. Ensure Address exists
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

            // C. Validate DeliverySlot
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

            // D. Upsert Order
            const statusMap: Record<string, string> = {
              PENDING_PAYMENT: 'PENDING_PAYMENT',
              PROCESSING: 'PROCESSING',
              OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
              DELIVERED: 'DELIVERED',
              CANCELLED: 'CANCELLED',
            };
            const validStatus = statusMap[ord.status] || 'PROCESSING';

            const orderRecord = await tx.order.upsert({
              where: { orderNumber: ord.orderNumber },
              update: {
                totalAmount: ord.totalAmount,
                status: validStatus,
                isBulkOrder: ord.isBulkOrder ?? false,
                bulkNotes: ord.bulkNotes || null,
                isSubscription: ord.isSubscription ?? false,
                subscriptionPlan: ord.subscriptionPlan || null,
                settlementStatus:
                  ord.settlementStatus ||
                  (validStatus === 'PROCESSING' || validStatus === 'DELIVERED' ? 'SETTLED' : 'PENDING'),
                settlementRef: ord.settlementRef || (ord.payment?.refId ? String(ord.payment.refId) : null),
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
                settlementStatus:
                  ord.settlementStatus ||
                  (validStatus === 'PROCESSING' || validStatus === 'DELIVERED' ? 'SETTLED' : 'PENDING'),
                settlementRef: ord.settlementRef || (ord.payment?.refId ? String(ord.payment.refId) : null),
              },
            });

            // E. Upsert OrderItems
            if (ord.items && Array.isArray(ord.items) && ord.items.length > 0) {
              await tx.orderItem.deleteMany({ where: { orderId: orderRecord.id } });
              for (const item of ord.items) {
                let product = await tx.product.findFirst({
                  where: { OR: [{ id: item.productId }, { slug: item.productId }] },
                });
                if (!product) {
                  const storeProd = this.products.find(
                    (p) => p.id === item.productId || p.slug === item.productId
                  );
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

                if (product) {
                  await tx.orderItem.create({
                    data: {
                      orderId: orderRecord.id,
                      productId: product.id,
                      quantity: item.quantity,
                      unitPrice: item.unitPrice,
                      totalPrice: item.totalPrice,
                    },
                  });
                }
              }
            }

            // F. Upsert Payment
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
    } catch {}
  }

  public async ensureDatabaseLoaded(): Promise<void> {
    if (typeof window !== 'undefined') return;
    if (this.hasSyncedFromPrisma) return;
    const prisma = this.getPrisma();
    if (!prisma) return;
    await this.syncFromPrisma();
  }

  public loadServerState(): void {
    if (typeof window !== 'undefined') return;
    try {
      const filePath = this.getServerDataFilePath();
      if (!filePath) return;
      const fs = require('fs');
      const backupPath = `${filePath}.bak`;

      let raw: string | null = null;

      // 1. Try reading the primary data file
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          if (content && content.trim().length > 0) {
            JSON.parse(content); // Test JSON integrity
            raw = content;
          }
        } catch (readErr) {
          console.warn('[FarmStore CRITICAL] Primary store file corrupted or unreadable. Attempting recovery from backup (.bak)...', readErr);
        }
      }

      // 2. Fallback to backup file if primary was damaged by sudden power loss
      if (!raw && fs.existsSync(backupPath)) {
        try {
          const backupContent = fs.readFileSync(backupPath, 'utf-8');
          if (backupContent && backupContent.trim().length > 0) {
            JSON.parse(backupContent);
            raw = backupContent;
            console.info('[FarmStore RECOVERY] Successfully restored database from healthy backup (.bak)!');
          }
        } catch (backupErr) {
          console.error('[FarmStore CRITICAL] Both primary store and backup are corrupted!', backupErr);
        }
      }

      if (!raw) return;

      const data = JSON.parse(raw);
      if (data.users && Array.isArray(data.users)) {
        for (const [k, v] of data.users) {
          if (v && !v.username && v.phone) {
            v.username = `user_${v.phone.slice(-4)}`;
          }
          this.users.set(k, v);
        }
      }
      if (data.orders && Array.isArray(data.orders) && data.orders.length > 0) {
        this.orders = data.orders;
      }
      if (data.coupons && Array.isArray(data.coupons)) {
        this.coupons = data.coupons;
      }
      if (data.paymentSettings) {
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
      if (data.products && Array.isArray(data.products) && data.products.length > 0) {
        this.products = data.products;
      }
      if (data.smsSettings) {
        this.smsSettings = { ...this.smsSettings, ...data.smsSettings };
      }
      if (data.bulkInquiries && Array.isArray(data.bulkInquiries) && data.bulkInquiries.length > 0) {
        this.bulkInquiries = data.bulkInquiries;
      }
      if (data.reviews && Array.isArray(data.reviews) && data.reviews.length > 0) {
        this.reviews = data.reviews;
      }
      if (data.emailLogs && Array.isArray(data.emailLogs)) {
        this.emailLogs = data.emailLogs;
      }
      if (data.emailSettings) {
        this.emailSettings = { ...this.emailSettings, ...data.emailSettings };
      }
      if (data.siteContent && typeof data.siteContent === 'object') {
        this.siteContent = { ...DEFAULT_SITE_CONTENT, ...data.siteContent };
      }
    } catch (e) {
      console.warn('[FarmStore] Failed to load server state:', e);
    }

    // Trigger asynchronous background sync from PostgreSQL if DATABASE_URL is configured
    const prisma = this.getPrisma();
    if (prisma && !this.isDatabaseSyncing && !this.hasSyncedFromPrisma) {
      this.syncFromPrisma().catch(() => {});
    }
  }

  private populateInitialUsers(): void {
    INITIAL_ADMIN_ORDERS.forEach((ord) => {
      if (ord.user) {
        const u = { ...ord.user };
        if (!u.username && u.phone) {
          u.username = `user_${u.phone.slice(-4)}`;
        }
        if (u.phone) this.users.set(u.phone, u);
        if (u.id) this.users.set(u.id, u);
      }
    });

    // SECURITY (C-1 Fix):
    // 1. In browser: Do NOT compute PBKDF2 hashes or expose them in client state.
    // 2. On server: Use cryptographically random salts via hashPassword() (210,000 iterations).
    // Never use hardcoded or sequential salts (1000000000000001, etc.).
    let adminPasswordHash = '';
    let userPasswordHash = '';
    let plusPasswordHash = '';
    let proPasswordHash = '';

    if (!this.isBrowser()) {
      let adminPass: string = process.env.ADMIN_INITIAL_PASSWORD || process.env.ADMIN_PASSWORD || '';
      if (!adminPass || adminPass.trim() === '' || (process.env.NODE_ENV === 'production' && adminPass === 'admin')) {
        if (process.env.NODE_ENV === 'production') {
          adminPass = crypto.randomBytes(16).toString('hex');
          console.warn('[SECURITY CRITICAL] ADMIN_INITIAL_PASSWORD is not set or default in production! Generated secure random password:', adminPass);
        } else {
          adminPass = 'Admin@ProFarm2026!#Shiraz';
        }
      }
      adminPasswordHash = hashPassword(adminPass);
      if (process.env.NODE_ENV !== 'production') {
        userPasswordHash = hashPassword('user123');
        plusPasswordHash = hashPassword('plus123');
        proPasswordHash = hashPassword('pro123');
      }
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
    if (adminUser.phone) this.users.set(adminUser.phone, adminUser);
    if (adminUser.id) this.users.set(adminUser.id, adminUser);

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
    if (regularUser.phone) this.users.set(regularUser.phone, regularUser);
    if (regularUser.id) this.users.set(regularUser.id, regularUser);

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
    if (plusUser.phone) this.users.set(plusUser.phone, plusUser);
    if (plusUser.id) this.users.set(plusUser.id, plusUser);

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
    if (proUser.phone) this.users.set(proUser.phone, proUser);
    if (proUser.id) this.users.set(proUser.id, proUser);
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

  public initFromLocalStorage(): void {
    if (!this.isBrowser()) return;

    // 1. Products
    const storedProducts = this.loadItem<Product[] | null>('profarm_products', null);
    if (storedProducts && Array.isArray(storedProducts) && storedProducts.length > 0) {
      this.products = storedProducts;
    }

    // 2. Orders
    const storedOrders = this.loadItem<Order[] | null>('profarm_orders', null);
    if (storedOrders && Array.isArray(storedOrders) && storedOrders.length > 0) {
      this.orders = storedOrders;
    }

    // 3. Users
    const storedUsers = this.loadItem<User[] | null>('profarm_users', null);
    if (storedUsers && Array.isArray(storedUsers) && storedUsers.length > 0) {
      this.users.clear();
      let usersNeedSave = false;
      storedUsers.forEach((u) => {
        // Automatic security upgrade: only hash on server runtime, never freeze browser UI thread
        if (!this.isBrowser() && u.password && !u.password.startsWith('pbkdf2$') && !u.password.startsWith('pfh_')) {
          try {
            u.password = hashPassword(u.password);
            usersNeedSave = true;
          } catch {
            // Ignore if empty
          }
        }
        if (u.phone) this.users.set(u.phone, u);
        if (u.id) this.users.set(u.id, u);
      });
      if (usersNeedSave) {
        this.saveUsers();
      }
    }

    // 4. Categories
    const storedCategories = this.loadItem<string[] | null>('profarm_categories', null);
    if (storedCategories && Array.isArray(storedCategories) && storedCategories.length > 0) {
      const list = storedCategories.filter((c) => c !== 'همه محصولات');
      this.categories = ['همه محصولات', ...list];
    }

    // 5. Site Content
    this.getSiteContent();

    // 6. Subscription Settings
    this.getSubscriptionSettings();

    // 7. Coupons
    const storedCoupons = this.loadItem<Coupon[] | null>('profarm_coupons', null);
    if (storedCoupons && Array.isArray(storedCoupons) && storedCoupons.length > 0) {
      this.coupons = storedCoupons;
    }

    // 8. Payment Settings
    const storedPayment = this.loadItem<PaymentSettings | null>('profarm_payment_settings', null);
    if (storedPayment) {
      this.paymentSettings = { ...DEFAULT_PAYMENT_SETTINGS, ...storedPayment };
    }

    // 9. Returns
    const storedReturns = this.loadItem<ReturnRequest[] | null>('profarm_return_requests', null);
    if (storedReturns && Array.isArray(storedReturns) && storedReturns.length > 0) {
      this.returnRequests = storedReturns;
    }

    // 10. Reviews
    const storedReviews = this.loadItem<ProductReview[] | null>('profarm_reviews', null);
    if (storedReviews && Array.isArray(storedReviews) && storedReviews.length > 0) {
      this.reviews = storedReviews;
    }

    // 11. Bulk Inquiries
    const storedInquiries = this.loadItem<BulkInquiry[] | null>('profarm_bulk_inquiries', null);
    if (storedInquiries && Array.isArray(storedInquiries) && storedInquiries.length > 0) {
      this.bulkInquiries = storedInquiries;
    }

    // 12. SMS Settings
    const storedSms = this.loadItem<SmsProviderSettings | null>('profarm_sms_settings', null);
    if (storedSms) {
      this.smsSettings = { ...DEFAULT_SMS_PROVIDER_SETTINGS, ...storedSms };
    }
    const storedTemplates = this.loadItem<SmsEventTemplate[] | null>('profarm_sms_templates', null);
    if (storedTemplates && Array.isArray(storedTemplates) && storedTemplates.length > 0) {
      this.smsEventTemplates = DEFAULT_SMS_EVENT_TEMPLATES.map((def) => {
        const match = storedTemplates.find((s) => s.id === def.id);
        if (!match) return def;
        return {
          ...def,
          ...match,
          availableVariables: def.availableVariables || match.availableVariables || [],
        };
      });
    }
    const storedBroadcasts = this.loadItem<SmsBroadcast[] | null>('profarm_sms_broadcasts', null);
    if (storedBroadcasts && Array.isArray(storedBroadcasts) && storedBroadcasts.length > 0) {
      this.smsBroadcasts = storedBroadcasts;
    }

    // 13. Email Provider / SMTP Settings
    const storedEmail = this.loadItem<EmailProviderSettings | null>('profarm_email_settings', null);
    if (storedEmail) {
      this.emailSettings = { ...DEFAULT_EMAIL_PROVIDER_SETTINGS, ...storedEmail };
    }
  }

  constructor() {
    this.populateInitialUsers();
    this.populateInitialBulkInquiries();
    this.initFromLocalStorage();
    this.loadServerState();
  }

  // --- PRODUCTS ---
  getProducts(): Product[] {
    if (this.isBrowser()) {
      const stored = this.loadItem<Product[] | null>('profarm_products', null);
      if (stored && Array.isArray(stored) && stored.length > 0) {
        this.products = stored;
      }
    }
    return this.products;
  }

  getProductBySlug(slug: string): Product | undefined {
    return this.getProducts().find((p) => p.slug === slug || p.id === slug);
  }

  getProductById(id: string): Product | undefined {
    return this.getProducts().find((p) => p.id === id || p.slug === id);
  }

  private saveProducts(): void {
    this.saveItem('profarm_products', this.products);
    this.saveServerState();
    if (this.isBrowser()) {
      window.dispatchEvent(
        new CustomEvent('profarm_products_updated', { detail: this.products })
      );
    }
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

  cloneProduct(slug: string): Product | null {
    const original = this.getProductBySlug(slug);
    if (!original) return null;
    const cloned: Product = {
      ...original,
      id: `prod-${Date.now()}`,
      slug: `${original.slug}-copy-${Math.floor(Math.random() * 1000)}`,
      title: `${original.title} (نسخه رونوشت)`,
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
    if (this.isBrowser()) {
      localStorage.removeItem('profarm_products');
      window.dispatchEvent(
        new CustomEvent('profarm_products_updated', { detail: this.products })
      );
    }
    return this.products;
  }

  // --- CATEGORIES ---
  getCategories(): string[] {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('profarm_categories');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const list = parsed.filter((c: string) => c !== 'همه محصولات');
            this.categories = ['همه محصولات', ...list];
          }
        }
      } catch (e) {
        // fallback
      }
    }
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
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('profarm_categories', JSON.stringify(this.categories));
      } catch (e) {
        // fallback
      }
    }
    return { success: true, message: `دسته‌بندی «${trimmed}» با موفقیت اضافه شد.`, categories: this.categories };
  }

  deleteCategory(categoryName: string): { success: boolean; message: string; categories: string[] } {
    if (categoryName === 'همه محصولات') {
      return { success: false, message: 'دسته‌بندی مرجع «همه محصولات» قابل حذف نیست.', categories: this.getCategories() };
    }
    const current = this.getCategories();
    this.categories = current.filter((c) => c !== categoryName);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('profarm_categories', JSON.stringify(this.categories));
      } catch (e) {
        // fallback
      }
    }
    return { success: true, message: `دسته‌بندی «${categoryName}» با موفقیت حذف شد.`, categories: this.categories };
  }

  resetCategories(): string[] {
    this.categories = [...INITIAL_CATEGORIES];
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('profarm_categories');
      } catch (e) {
        // fallback
      }
    }
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

  // --- USERS & PRO MEMBERSHIP ---
  private saveUsers(): void {
    const userMap = new Map<string, User>();
    for (const u of this.users.values()) {
      const key = u.id || u.phone || u.email;
      if (key && !userMap.has(key)) {
        userMap.set(key, u);
      }
    }
    // SECURITY: Always sanitize users (remove password hash) before writing to localStorage
    const safeList = Array.from(userMap.values()).map((u) => sanitizeUser(u));
    this.saveItem('profarm_users', safeList);
    this.saveServerState();
    if (this.isBrowser()) {
      window.dispatchEvent(
        new CustomEvent('profarm_users_updated', { detail: safeList })
      );
    }
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
      this.users.set(cleanPhone, user);
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
        this.users.set(cleanPhone, user);
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
    username?: string;
    password?: string;
  }): User {
    this.getAllUsers();
    const cleanEmail = params.email?.trim().toLowerCase();
    const cleanPhone = params.phone ? normalizePhoneNumber(params.phone) : undefined;

    if (!cleanEmail && !cleanPhone) {
      throw new Error('لطفاً ایمیل معتبر یا شماره تلفن همراه خود را وارد نمایید.');
    }

    // Auto-generate username: email or phone (no separate username required)
    const autoUsername =
      params.username?.trim() || cleanEmail || cleanPhone || `user_${Date.now().toString().slice(-4)}`;

    // Check unique email if provided
    if (cleanEmail) {
      const existingByEmail = this.getUserByEmail(cleanEmail);
      if (existingByEmail) {
        if (existingByEmail.role === 'ADMIN') {
          throw new Error('این ایمیل متعلق به حساب مدیر سیستم است و امکان ثبت‌نام مجدد ندارد.');
        }
        throw new Error('حساب کاربری دیگری با این آدرس ایمیل از قبل ثبت شده است. لطفاً وارد شوید.');
      }
    }

    // Check unique phone if provided
    if (cleanPhone) {
      const existingByPhone = this.getUserByPhone(cleanPhone);
      if (existingByPhone) {
        if (existingByPhone.role === 'ADMIN') {
          throw new Error('این شماره متعلق به حساب مدیر سیستم است و امکان ثبت‌نام مجدد ندارد.');
        }
        throw new Error('حساب کاربری با این شماره تلفن از قبل وجود دارد. لطفاً وارد شوید.');
      }
    }

    const userId = `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const user: User = {
      id: userId,
      phone: cleanPhone || '',
      isPhoneVerified: false,
      username: autoUsername,
      email: cleanEmail || null,
      name: params.name?.trim() || 'کاربر گرامی',
      role: 'USER',
      authProvider: params.password ? 'PASSWORD' : 'PHONE_OTP',
      password: params.password ? hashPassword(params.password.trim()) : undefined,
      isProMember: false,
      createdAt: new Date().toISOString(),
    };

    if (user.phone) this.users.set(user.phone, user);
    if (user.email) this.users.set(user.email.toLowerCase(), user);
    this.users.set(user.id, user);
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
        // Safe to merge / reassign from anonymous placeholder
        this.users.delete(cleanPhone);
      } else {
        return {
          success: false,
          message: 'این شماره همراه قبلاً در حساب کاربری دیگری ثبت و تایید شده است.',
        };
      }
    }

    targetUser.phone = cleanPhone;
    targetUser.isPhoneVerified = true;

    this.users.set(cleanPhone, targetUser);
    if (targetUser.id) this.users.set(targetUser.id, targetUser);
    if (targetUser.email) this.users.set(targetUser.email.toLowerCase(), targetUser);
    this.saveUsers();

    return {
      success: true,
      user: sanitizeUser(targetUser),
      message: 'شماره تلفن همراه با موفقیت تایید و در حساب کاربری شما ذخیره گردید.',
    };
  }

  updateUserProfile(
    userIdOrPhone: string,
    updates: {
      name?: string;
      username?: string;
      email?: string;
      password?: string;
      nationalId?: string;
      birthDate?: string;
      smsNotificationEnabled?: boolean;
    }
  ): { success: boolean; user?: User; message?: string } {
    this.getAllUsers();
    const cleanId = normalizePhoneNumber(userIdOrPhone);
    const user = Array.from(this.users.values()).find(
      (u) =>
        u.id === userIdOrPhone ||
        (u.phone && normalizePhoneNumber(u.phone) === cleanId) ||
        (u.username && u.username.toLowerCase() === userIdOrPhone.toLowerCase())
    );

    if (!user) {
      return { success: false, message: 'حساب کاربری مورد نظر یافت نشد.' };
    }

    if (updates.username && updates.username.trim()) {
      const cleanUname = updates.username.trim().toLowerCase();
      const existing = Array.from(this.users.values()).find(
        (u) => u.id !== user.id && u.username && u.username.toLowerCase() === cleanUname
      );
      if (existing) {
        return { success: false, message: 'این نام کاربری قبلاً توسط کاربر دیگری انتخاب شده است.' };
      }
      user.username = updates.username.trim();
    }

    if (updates.name && updates.name.trim()) user.name = updates.name.trim();
    if (updates.email !== undefined) user.email = updates.email ? updates.email.trim() : null;
    if (updates.nationalId !== undefined) user.nationalId = updates.nationalId ? updates.nationalId.trim() : null;
    if (updates.birthDate !== undefined) user.birthDate = updates.birthDate ? updates.birthDate.trim() : null;
    if (updates.smsNotificationEnabled !== undefined) user.smsNotificationEnabled = updates.smsNotificationEnabled;

    if (updates.password && updates.password.trim()) {
      if (updates.password.trim().length < 4) {
        return { success: false, message: 'کلمه عبور باید حداقل ۴ کاراکتر باشد.' };
      }
      user.password = hashPassword(updates.password.trim());
      user.authProvider = 'PASSWORD';
    }

    if (user.phone) this.users.set(user.phone, user);
    if (user.id) this.users.set(user.id, user);
    this.saveUsers();

    return { success: true, user: sanitizeUser(user), message: 'اطلاعات حساب کاربری با موفقیت به‌روزرسانی شد.' };
  }

  getOrCreateGoogleUser(googleUser: { email: string; name?: string; picture?: string }): User {
    this.getAllUsers();
    const cleanEmail = googleUser.email.trim().toLowerCase();
    let user = Array.from(this.users.values()).find(
      (u) => u.email && u.email.toLowerCase() === cleanEmail
    );

    // SECURITY: Prevent privilege escalation via Google Auth
    // Under no circumstance can an unverified OAuth claim hijack or access an ADMIN account.
    if (user && user.role === 'ADMIN') {
      console.warn(`[Security Alert] Blocked OAuth login attempt targeting admin email: ${cleanEmail}`);
      throw new Error('ورود با حساب گوگل برای مدیران سیستم مجاز نمی‌باشد. لطفاً از فرم اختصاصی ورود مدیریت استفاده نمایید.');
    }

    if (!user) {
      user = {
        id: `usr-g-${Date.now()}`,
        phone: '',
        name: googleUser.name || cleanEmail.split('@')[0],
        email: cleanEmail,
        avatarUrl: googleUser.picture,
        authProvider: 'GOOGLE',
        role: 'USER', // Strictly USER role
        isProMember: false,
        createdAt: new Date().toISOString(),
      };
      this.users.set(user.id, user);
      this.saveUsers();
    }
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
        if (user.phone) this.users.set(user.phone, user);
        if (user.id) this.users.set(user.id, user);
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
    this.users.set(phone, user);
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
    this.users.set(phone, user);
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
    if (user.phone) {
      this.users.set(user.phone, user);
    }
    if (user.id) {
      this.users.set(user.id, user);
    }
    this.saveUsers();

    // Trigger automated SMS for subscription activation/renewal if upgraded
    if (tier !== 'FREE' && user.phone) {
      const vars: Record<string, string> = {
        '{customerName}': user.name || 'کاربر گرامی',
        '{tierName}': tier === 'PRO' ? 'پروفارم پرو (طلایی ۶ روزه)' : 'پروفارم پلاس (۵٪ تخفیف)',
        '{expiresAt}': user.proExpiresAt || user.plusExpiresAt || '۱۴۰۵/۱۲/۲۹',
        '{siteUrl}': 'profarm.ir',
      };
      const rendered = this.renderEventSms('SUBSCRIPTION_ACTIVATED', vars);
      if (rendered && rendered.isEnabled && rendered.message) {
        sendCustomSms(user.phone, rendered.message, user.email);
      }
    }

    return user;
  }

  updateUserRole(identifier: string, role: UserRole): User | null {
    this.getAllUsers();
    let user = this.users.get(identifier);
    if (!user) {
      user = Array.from(this.users.values()).find((u) => u.id === identifier || u.phone === identifier);
    }
    if (!user) return null;
    user.role = role;
    if (user.phone) {
      this.users.set(user.phone, user);
    }
    if (user.id) {
      this.users.set(user.id, user);
    }
    this.saveUsers();
    return user;
  }

  getAllUsers(): User[] {
    if (this.isBrowser()) {
      const stored = this.loadItem<User[] | null>('profarm_users', null);
      if (stored && Array.isArray(stored) && stored.length > 0) {
        this.users.clear();
        stored.forEach((u) => {
          if (u.phone) this.users.set(u.phone, u);
          if (u.id) this.users.set(u.id, u);
          if (u.email) this.users.set(u.email.toLowerCase(), u);
        });
      }
    }
    const userMap = new Map<string, User>();
    for (const u of this.users.values()) {
      const key = u.id || u.phone || u.email;
      if (key && !userMap.has(key)) {
        userMap.set(key, u);
      }
    }
    return Array.from(userMap.values());
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
    if (this.isBrowser()) {
      const stored = this.loadItem<ReturnRequest[] | null>('profarm_return_requests', null);
      if (stored && Array.isArray(stored) && stored.length > 0) {
        this.returnRequests = stored;
      }
    }
    return this.returnRequests;
  }

  private saveReturnRequests(): void {
    this.saveItem('profarm_return_requests', this.returnRequests);
  }

  createReturnRequest(data: Omit<ReturnRequest, 'id' | 'createdAt' | 'updatedAt'>): ReturnRequest {
    const newReq: ReturnRequest = {
      ...data,
      id: `ret-${Date.now()}`,
      createdAt: new Date().toLocaleDateString('fa-IR'),
      updatedAt: new Date().toLocaleDateString('fa-IR'),
    };
    this.returnRequests.unshift(newReq);
    this.saveReturnRequests();
    return newReq;
  }

  updateReturnStatus(id: string, status: ReturnStatus, adminNotes?: string): ReturnRequest | null {
    const req = this.returnRequests.find((r) => r.id === id);
    if (!req) return null;
    req.status = status;
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
    if (this.isBrowser()) {
      const stored = this.loadItem<SmsEventTemplate[] | null>('profarm_sms_templates', null);
      if (stored && Array.isArray(stored) && stored.length > 0) {
        // Defensively merge with defaults so availableVariables, title, etc. are always defined
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
    }
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
    this.saveItem('profarm_sms_templates', this.smsEventTemplates);
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
    this.saveItem('profarm_sms_templates', this.smsEventTemplates);
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
    if (this.isBrowser()) {
      const stored = this.loadItem<SmsProviderSettings | null>('profarm_sms_settings', null);
      if (stored) {
        this.smsSettings = { ...DEFAULT_SMS_PROVIDER_SETTINGS, ...stored };
      }
    }
    return this.smsSettings;
  }

  updateSmsSettings(settings: Partial<SmsProviderSettings>): SmsProviderSettings {
    this.smsSettings = {
      ...this.getSmsSettings(),
      ...settings,
      updatedAt: new Date().toLocaleDateString('fa-IR'),
    };
    this.saveItem('profarm_sms_settings', this.smsSettings);
    this.saveServerState();
    return this.smsSettings;
  }

  // --- EMAIL PROVIDER / SMTP SETTINGS ---
  getEmailSettings(): EmailProviderSettings {
    if (this.isBrowser()) {
      const stored = this.loadItem<EmailProviderSettings | null>('profarm_email_settings', null);
      if (stored) {
        this.emailSettings = { ...DEFAULT_EMAIL_PROVIDER_SETTINGS, ...stored };
      }
    }
    return this.emailSettings;
  }

  updateEmailSettings(settings: Partial<EmailProviderSettings>): EmailProviderSettings {
    this.emailSettings = {
      ...this.getEmailSettings(),
      ...settings,
      updatedAt: new Date().toLocaleDateString('fa-IR'),
    };
    this.saveItem('profarm_email_settings', this.emailSettings);
    this.saveServerState();
    return this.emailSettings;
  }

  // --- SMS BROADCAST & CAMPAIGNS ---
  getSmsBroadcasts(): SmsBroadcast[] {
    if (this.isBrowser()) {
      const stored = this.loadItem<SmsBroadcast[] | null>('profarm_sms_broadcasts', null);
      if (stored && Array.isArray(stored) && stored.length > 0) {
        this.smsBroadcasts = stored;
      }
    }
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
    this.saveItem('profarm_sms_broadcasts', this.smsBroadcasts);
    return newSms;
  }

  // --- SLOTS ---
  getSlotsForUser(tierOrIsPro: boolean | SubscriptionTier) {
    const slots = generateDeliverySlots(tierOrIsPro);
    // Overlay booked counts from store
    return slots.map((slot) => {
      const extraBookings = this.slotBookings.get(slot.id) || 0;
      const totalBookings = Math.min(slot.maxCapacity, slot.currentBookings + extraBookings);
      const remaining = Math.max(0, slot.maxCapacity - totalBookings);
      return {
        ...slot,
        currentBookings: totalBookings,
        remainingCapacity: remaining,
        isAvailable: slot.isAllowedForTier && remaining > 0,
      };
    });
  }

  bookSlot(slotId: string): boolean {
    const current = this.slotBookings.get(slotId) || 0;
    this.slotBookings.set(slotId, current + 1);
    return true;
  }

  unbookSlot(slotId?: string | null): boolean {
    if (!slotId) return false;
    const current = this.slotBookings.get(slotId) || 0;
    if (current > 0) {
      this.slotBookings.set(slotId, current - 1);
    }
    return true;
  }

  checkSlotCapacity(slotId: string): { isAvailable: boolean; remainingCapacity: number } {
    this.releaseExpiredPendingOrders(15);
    const slots = this.getSlotsForUser(true);
    const found = slots.find((s) => s.id === slotId);
    if (!found) {
      return { isAvailable: true, remainingCapacity: 30 };
    }
    return {
      isAvailable: found.isAvailable && found.remainingCapacity > 0,
      remainingCapacity: found.remainingCapacity,
    };
  }

  // --- ORDERS ---
  private saveOrders(): void {
    this.saveItem('profarm_orders', this.orders);
    this.saveServerState();
    if (this.isBrowser()) {
      window.dispatchEvent(
        new CustomEvent('profarm_orders_updated', { detail: this.orders })
      );
    }
  }

  /**
   * Automatically releases inventory for orders stuck in PENDING_PAYMENT for longer than timeoutMinutes.
   */
  releaseExpiredPendingOrders(timeoutMinutes: number = 15): number {
    this.getOrders();
    const now = Date.now();
    const timeoutMs = timeoutMinutes * 60 * 1000;
    let releasedCount = 0;

    this.orders.forEach((order) => {
      if (order.status === 'PENDING_PAYMENT') {
        const orderTime = new Date(order.createdAt).getTime();
        if (!isNaN(orderTime) && now - orderTime > timeoutMs) {
          order.status = 'CANCELLED';
          this.restoreOrderStock(order.orderNumber);
          releasedCount++;
        }
      }
    });

    if (releasedCount > 0) {
      this.saveOrders();
      this.saveProducts();
    }
    return releasedCount;
  }

  createOrder(orderData: Omit<Order, 'id' | 'createdAt'>): Order {
    this.getOrders();
    this.getProducts();

    // 1. Release any expired pending orders before verifying stock
    this.releaseExpiredPendingOrders(15);

    // 2. ATOMIC PRE-CHECK: Verify all requested physical items have sufficient stock
    for (const item of orderData.items) {
      if (item.productId && !item.productId.startsWith('sub-')) {
        const prod = this.products.find(
          (p) => p.id === item.productId || p.slug === item.productId
        );
        if (!prod) {
          throw new Error(`محصول درخواستی با شناسه «${item.productId}» در فروشگاه یافت نشد.`);
        }
        const availableStock = prod.stock ?? 0;
        if (availableStock < item.quantity) {
          throw new Error(
            `INSUFFICIENT_STOCK: متاسفانه موجودی محصول «${prod.title}» کافی نیست. موجودی فعلی: ${availableStock} عدد، تعداد درخواستی: ${item.quantity} عدد.`
          );
        }
      }
    }

    const newOrder: Order = {
      ...orderData,
      id: `ord-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    // 3. ATOMIC STOCK DEDUCTION: Only runs if all items passed the check
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

    // Track delivery slot booking
    if (newOrder.deliverySlotId) {
      this.bookSlot(newOrder.deliverySlotId);
    }

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
    if (this.isBrowser()) {
      const stored = this.loadItem<Order[] | null>('profarm_orders', null);
      if (stored && Array.isArray(stored) && stored.length > 0) {
        this.orders = stored;
      }
    }
    return this.orders;
  }

  getOrderById(id: string): Order | undefined {
    this.getOrders();
    let order = this.orders.find((o) => o.id === id || o.orderNumber === id);
    if (!order && !this.isBrowser()) {
      this.loadServerState();
      order = this.orders.find((o) => o.id === id || o.orderNumber === id);
    }
    return order;
  }

  attachPaymentToOrder(idOrNumber: string, payment: Payment): Order | null {
    this.getOrders();
    let order = this.orders.find((o) => o.id === idOrNumber || o.orderNumber === idOrNumber);
    if (!order && !this.isBrowser()) {
      this.loadServerState();
      order = this.orders.find((o) => o.id === idOrNumber || o.orderNumber === idOrNumber);
    }
    if (!order) return null;
    order.payment = payment;
    order.updatedAt = new Date().toISOString();
    this.saveOrders();
    return order;
  }

  async updateOrderStatus(id: string, newStatus: OrderStatus): Promise<Order | null> {
    this.getOrders();
    let order = this.orders.find((o) => o.id === id || o.orderNumber === id);
    if (!order && !this.isBrowser()) {
      this.loadServerState();
      order = this.orders.find((o) => o.id === id || o.orderNumber === id);
    }
    if (!order) return null;

    order.status = newStatus;
    order.updatedAt = new Date().toISOString();
    this.saveOrders();

    const prisma = this.getPrisma();
    if (prisma) {
      prisma.order
        .update({
          where: { orderNumber: order.orderNumber },
          data: {
            status: newStatus,
            settlementStatus:
              newStatus === 'PROCESSING' || newStatus === 'DELIVERED' ? 'SETTLED' : undefined,
            settlementRef:
              order.settlementRef || (order.payment?.refId ? String(order.payment.refId) : undefined),
          },
        })
        .catch(() => {});
    }

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

  restoreOrderStock(idOrNumber: string): boolean {
    this.getOrders();
    const order = this.orders.find((o) => o.id === idOrNumber || o.orderNumber === idOrNumber);
    if (!order) return false;

    order.items.forEach((item) => {
      const prod = this.products.find((p) => p.id === item.productId || p.slug === item.productId);
      if (prod) {
        prod.stock = (prod.stock || 0) + item.quantity;
        if (prod.status === 'OUT_OF_STOCK' && prod.stock > 0) {
          prod.status = 'AVAILABLE';
        }
      }
    });

    // Release Shiraz delivery slot booking
    if (order.deliverySlotId) {
      this.unbookSlot(order.deliverySlotId);
    }

    this.saveProducts();
    this.saveOrders();
    return true;
  }

  /**
   * Calculates the total eggs purchased with subscription discount by a user within a rolling 30-day window.
   * Includes paid orders (PROCESSING, OUT_FOR_DELIVERY, DELIVERED) and active non-expired PENDING_PAYMENT orders
   * to protect against multi-tab concurrency race conditions.
   */
  getUserRolling30DaysEggDiscountUsed(userId?: string, phone?: string): number {
    const cleanPhone = phone ? normalizePhoneNumber(phone) : '';
    if (!userId && !cleanPhone) return 0;

    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const cutoffTime = now - thirtyDaysMs;
    const pendingTimeoutMs = (this.paymentSettings?.general?.paymentTimeoutMinutes || 30) * 60 * 1000;

    const allOrders = this.getOrders();
    let totalEggCountUsed = 0;

    for (const ord of allOrders) {
      if (ord.isSubscription) continue;

      const isUserMatch =
        (userId && ord.userId === userId) ||
        (cleanPhone && cleanPhone.length >= 10 && (
          (ord.address?.phone && normalizePhoneNumber(ord.address.phone) === cleanPhone) ||
          (ord.user?.phone && normalizePhoneNumber(ord.user.phone) === cleanPhone)
        ));
      if (!isUserMatch) continue;

      const orderCreatedAt = new Date(ord.createdAt).getTime();
      if (isNaN(orderCreatedAt) || orderCreatedAt < cutoffTime) continue;

      // Include paid orders
      const isPaid = ['PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(ord.status);
      // Include active pending payment orders to prevent multi-tab concurrency race condition
      const isActivePending = ord.status === 'PENDING_PAYMENT' && (now - orderCreatedAt < pendingTimeoutMs);

      if (!isPaid && !isActivePending) continue;

      let orderEggs = 0;
      for (const item of ord.items || []) {
        const prod = item.product;
        const isEgg =
          prod?.category === 'تخم‌مرغ و ماکیان' ||
          prod?.title?.includes('تخم‌مرغ') ||
          prod?.id?.includes('egg') ||
          item.productId?.includes('egg');

        if (isEgg) {
          const packStr = prod?.packSize || '';
          const eggsPerPack = packStr.includes('20') || packStr.includes('۲۰') ? 20 : 30;
          orderEggs += eggsPerPack * (item.quantity || 1);
        }
      }
      totalEggCountUsed += orderEggs;
    }

    return totalEggCountUsed;
  }

  resetOrders(): Order[] {
    this.orders = [...INITIAL_ADMIN_ORDERS];
    if (this.isBrowser()) {
      localStorage.removeItem('profarm_orders');
      window.dispatchEvent(
        new CustomEvent('profarm_orders_updated', { detail: this.orders })
      );
    }
    return this.orders;
  }

  // --- PRODUCT REVIEWS & VERIFIED RATINGS ---
  private saveReviews(): void {
    this.saveItem('profarm_reviews', this.reviews);
    this.saveServerState();
    if (this.isBrowser()) {
      window.dispatchEvent(
        new CustomEvent('profarm_reviews_updated', { detail: this.reviews })
      );
    }
  }

  getProductReviews(productIdOrSlug: string, onlyApproved = true): ProductReview[] {
    return this.getAllReviews().filter((r) => {
      const matches = r.productId === productIdOrSlug || r.productSlug === productIdOrSlug;
      return matches && (!onlyApproved || r.status === 'APPROVED');
    });
  }

  getAllReviews(statusFilter?: ReviewStatus): ProductReview[] {
    if (this.isBrowser()) {
      const stored = this.loadItem<ProductReview[] | null>('profarm_reviews', null);
      if (stored && Array.isArray(stored) && stored.length > 0) {
        this.reviews = stored;
      }
    }
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
    if (this.isBrowser()) {
      localStorage.removeItem('profarm_reviews');
      window.dispatchEvent(
        new CustomEvent('profarm_reviews_updated', { detail: this.reviews })
      );
    }
    return this.reviews;
  }

  // --- BULK INQUIRIES ---
  getBulkInquiries(): BulkInquiry[] {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('profarm_bulk_inquiries');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const idSet = new Set(parsed.map((p: BulkInquiry) => p.id));
            const merged = [...parsed];
            this.bulkInquiries.forEach((inq) => {
              if (!idSet.has(inq.id)) {
                merged.push(inq);
                idSet.add(inq.id);
              }
            });
            this.bulkInquiries = merged;
          }
        }
      } catch (e) {
        // fallback
      }
    }
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
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('profarm_bulk_inquiries', JSON.stringify(this.bulkInquiries));
      } catch (e) {
        // fallback
      }
    }
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
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('profarm_bulk_inquiries', JSON.stringify(this.bulkInquiries));
      } catch (e) {
        // fallback
      }
    }
    return this.bulkInquiries[idx];
  }

  deleteBulkInquiry(id: string): boolean {
    this.bulkInquiries = this.bulkInquiries.filter((i) => i.id !== id);
    this.saveServerState();
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('profarm_bulk_inquiries', JSON.stringify(this.bulkInquiries));
      } catch (e) {
        // fallback
      }
    }
    return true;
  }

  // --- SITE CONTENT (CMS) ---
  getSiteContent(): SiteContent {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('profarm_site_content');
        if (stored) {
          const parsed = JSON.parse(stored);
          // Auto-upgrade legacy unsplash images to local authentic images
          if (parsed.heroImageUrl && parsed.heroImageUrl.includes('images.unsplash.com')) {
            parsed.heroImageUrl = DEFAULT_SITE_CONTENT.heroImageUrl;
          }
          if (parsed.storyImageUrl && parsed.storyImageUrl.includes('images.unsplash.com')) {
            parsed.storyImageUrl = DEFAULT_SITE_CONTENT.storyImageUrl;
          }
          if (parsed.bulkSectionImageUrl && parsed.bulkSectionImageUrl.includes('images.unsplash.com')) {
            parsed.bulkSectionImageUrl = DEFAULT_SITE_CONTENT.bulkSectionImageUrl;
          }
          // Auto-sanitize legacy cold fleet / refrigerator keywords from browser cache
          if (parsed.topBannerText && (parsed.topBannerText.includes('سردخانه') || parsed.topBannerText.includes('یخچال'))) {
            parsed.topBannerText = DEFAULT_SITE_CONTENT.topBannerText;
          }
          if (parsed.heroSubtitle && (parsed.heroSubtitle.includes('سردخانه') || parsed.heroSubtitle.includes('یخچال'))) {
            parsed.heroSubtitle = DEFAULT_SITE_CONTENT.heroSubtitle;
          }
          if (parsed.heroStat3Label && (parsed.heroStat3Label.includes('سردخانه') || parsed.heroStat3Label.includes('یخچال'))) {
            parsed.heroStat3Label = DEFAULT_SITE_CONTENT.heroStat3Label;
          }
          this.siteContent = { ...DEFAULT_SITE_CONTENT, ...parsed };
        }
      } catch (e) {
        // fallback
      }
    }
    return this.siteContent;
  }

  updateSiteContent(updates: Partial<SiteContent>): SiteContent {
    this.siteContent = { ...this.siteContent, ...updates };
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('profarm_site_content', JSON.stringify(this.siteContent));
        window.dispatchEvent(new Event('profarm_content_updated'));
        window.dispatchEvent(new Event('storage'));
      } catch (e) {
        // fallback
      }
    } else {
      this.saveServerState();
    }
    return this.siteContent;
  }

  resetSiteContent(): SiteContent {
    this.siteContent = { ...DEFAULT_SITE_CONTENT };
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('profarm_site_content');
        window.dispatchEvent(new Event('profarm_content_updated'));
        window.dispatchEvent(new Event('storage'));
      } catch (e) {
        // fallback
      }
    } else {
      this.saveServerState();
    }
    return this.siteContent;
  }

  // --- SUBSCRIPTION & DISCOUNT SETTINGS ---
  getSubscriptionSettings(): SubscriptionSettings {
    if (typeof window === 'undefined') {
      this.loadServerState();
      return this.subscriptionSettings;
    }

    try {
      const stored = localStorage.getItem('profarm_subscription_settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.subscriptionSettings = {
          ...DEFAULT_SUBSCRIPTION_SETTINGS,
          ...parsed,
          proFeatures: Array.isArray(parsed.proFeatures)
            ? parsed.proFeatures
            : DEFAULT_SUBSCRIPTION_SETTINGS.proFeatures,
          plusFeatures: Array.isArray(parsed.plusFeatures)
            ? parsed.plusFeatures
            : DEFAULT_SUBSCRIPTION_SETTINGS.plusFeatures,
          freeFeatures: Array.isArray(parsed.freeFeatures)
            ? parsed.freeFeatures
            : DEFAULT_SUBSCRIPTION_SETTINGS.freeFeatures,
          faqItems: Array.isArray(parsed.faqItems)
            ? parsed.faqItems
            : DEFAULT_SUBSCRIPTION_SETTINGS.faqItems,
          comparisonRows: Array.isArray(parsed.comparisonRows)
            ? parsed.comparisonRows
            : DEFAULT_COMPARISON_ROWS,
          proMaxCapacity:
            typeof parsed.proMaxCapacity === 'number'
              ? parsed.proMaxCapacity
              : DEFAULT_SUBSCRIPTION_SETTINGS.proMaxCapacity,
          plusMaxCapacity:
            typeof parsed.plusMaxCapacity === 'number'
              ? parsed.plusMaxCapacity
              : DEFAULT_SUBSCRIPTION_SETTINGS.plusMaxCapacity,
          proBadgeText:
            parsed.proBadgeText !== undefined
              ? parsed.proBadgeText
              : DEFAULT_SUBSCRIPTION_SETTINGS.proBadgeText,
          plusBadgeText:
            parsed.plusBadgeText !== undefined
              ? parsed.plusBadgeText
              : DEFAULT_SUBSCRIPTION_SETTINGS.plusBadgeText,
          freeBadgeText:
            parsed.freeBadgeText !== undefined
              ? parsed.freeBadgeText
              : DEFAULT_SUBSCRIPTION_SETTINGS.freeBadgeText,
          comparisonFeatureHeader:
            parsed.comparisonFeatureHeader !== undefined
              ? parsed.comparisonFeatureHeader
              : DEFAULT_SUBSCRIPTION_SETTINGS.comparisonFeatureHeader,
          comparisonFreeHeader:
            parsed.comparisonFreeHeader !== undefined
              ? parsed.comparisonFreeHeader
              : DEFAULT_SUBSCRIPTION_SETTINGS.comparisonFreeHeader,
          comparisonPlusHeader:
            parsed.comparisonPlusHeader !== undefined
              ? parsed.comparisonPlusHeader
              : DEFAULT_SUBSCRIPTION_SETTINGS.comparisonPlusHeader,
          comparisonProHeader:
            parsed.comparisonProHeader !== undefined
              ? parsed.comparisonProHeader
              : DEFAULT_SUBSCRIPTION_SETTINGS.comparisonProHeader,
        };
      }
    } catch (e) {
      // fallback
    }
    return this.subscriptionSettings;
  }

  /**
   * Fetches latest subscription settings from server API and synchronizes
   * in-memory state and localStorage on all devices.
   */
  async syncSubscriptionSettings(): Promise<SubscriptionSettings> {
    if (typeof window === 'undefined') {
      this.loadServerState();
      return this.subscriptionSettings;
    }

    try {
      const res = await fetch('/api/subscriptions', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.settings) {
          this.subscriptionSettings = {
            ...DEFAULT_SUBSCRIPTION_SETTINGS,
            ...data.settings,
            proFeatures: Array.isArray(data.settings.proFeatures)
              ? data.settings.proFeatures
              : DEFAULT_SUBSCRIPTION_SETTINGS.proFeatures,
            plusFeatures: Array.isArray(data.settings.plusFeatures)
              ? data.settings.plusFeatures
              : DEFAULT_SUBSCRIPTION_SETTINGS.plusFeatures,
            freeFeatures: Array.isArray(data.settings.freeFeatures)
              ? data.settings.freeFeatures
              : DEFAULT_SUBSCRIPTION_SETTINGS.freeFeatures,
            faqItems: Array.isArray(data.settings.faqItems)
              ? data.settings.faqItems
              : DEFAULT_SUBSCRIPTION_SETTINGS.faqItems,
            comparisonRows: Array.isArray(data.settings.comparisonRows)
              ? data.settings.comparisonRows
              : DEFAULT_COMPARISON_ROWS,
          };
          try {
            localStorage.setItem(
              'profarm_subscription_settings',
              JSON.stringify(this.subscriptionSettings)
            );
          } catch {}
          window.dispatchEvent(
            new CustomEvent('profarm_subscription_updated', { detail: this.subscriptionSettings })
          );
        }
      }
    } catch (e) {
      // Offline fallback
    }
    return this.subscriptionSettings;
  }

  updateSubscriptionSettings(updates: Partial<SubscriptionSettings>): SubscriptionSettings {
    const current = this.getSubscriptionSettings();
    this.subscriptionSettings = { ...current, ...updates };
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          'profarm_subscription_settings',
          JSON.stringify(this.subscriptionSettings)
        );
        window.dispatchEvent(
          new CustomEvent('profarm_subscription_updated', { detail: this.subscriptionSettings })
        );
      } catch (e) {
        // fallback
      }
    } else {
      this.saveServerState();
    }
    return this.subscriptionSettings;
  }

  resetSubscriptionSettings(): SubscriptionSettings {
    this.subscriptionSettings = { ...DEFAULT_SUBSCRIPTION_SETTINGS };
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('profarm_subscription_settings');
        window.dispatchEvent(
          new CustomEvent('profarm_subscription_updated', { detail: this.subscriptionSettings })
        );
      } catch (e) {
        // fallback
      }
    } else {
      this.saveServerState();
    }
    return this.subscriptionSettings;
  }

  getSubscriptionStats(): SubscriptionStats {
    const users = this.getAllUsers();
    const settings = this.getSubscriptionSettings();

    const proCount = users.filter((u) => u.tier === 'PRO' || (u.isProMember && !u.tier)).length;
    const plusCount = users.filter((u) => u.tier === 'PLUS').length;
    const freeCount = users.filter((u) => u.tier === 'FREE' || (!u.tier && !u.isProMember)).length;
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
    // SECURITY: Remove any legacy payment credentials from browser localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('profarm_payment_settings');
      } catch {}
    }
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
        paymentTimeoutMinutes: s.general?.paymentTimeoutMinutes ?? 15,
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

    // SECURITY: Never write payment gateway secrets to browser localStorage
    this.saveServerState();
    return this.paymentSettings;
  }

  resetPaymentSettings(): PaymentSettings {
    this.paymentSettings = { ...DEFAULT_PAYMENT_SETTINGS, updatedAt: new Date().toISOString() };
    this.saveServerState();
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('profarm_payment_settings');
      } catch {}
    }
    return this.paymentSettings;
  }

  // --- COUPONS / DISCOUNT CODES ---
  getCoupons(): Coupon[] {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('profarm_coupons');
        if (stored) {
          this.coupons = JSON.parse(stored);
        }
      } catch (e) {
        // fallback
      }
    }
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
    const newCoupon: Coupon = {
      ...data,
      id: `coup-${Date.now()}`,
      code: data.code.trim().toUpperCase(),
      usageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.coupons.unshift(newCoupon);
    this.persistCoupons();
    return newCoupon;
  }

  updateCoupon(id: string, updates: Partial<Coupon>): Coupon | null {
    const idx = this.coupons.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    this.coupons[idx] = {
      ...this.coupons[idx],
      ...updates,
      code: updates.code ? updates.code.trim().toUpperCase() : this.coupons[idx].code,
      updatedAt: new Date().toISOString(),
    };
    this.persistCoupons();
    return this.coupons[idx];
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

  incrementCouponUsage(code: string): void {
    const coupon = this.getCouponByCode(code);
    if (coupon) {
      coupon.usageCount = (coupon.usageCount || 0) + 1;
      this.persistCoupons();
    }
  }

  private persistCoupons(): void {
    this.saveServerState();
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('profarm_coupons', JSON.stringify(this.coupons));
      } catch (e) {
        // fallback
      }
    }
  }

  validateAndApplyCoupon(
    code: string,
    cartItems: { product: { id: string; price: number; title?: string }; quantity: number }[],
    shippingFee: number,
    itemsSubtotal: number
  ): CouponValidationResult {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      return {
        isValid: false,
        message: 'لطفاً کد تخفیف را وارد نمایید.',
        discountAmount: 0,
      };
    }

    const coupon = this.getCouponByCode(cleanCode);

    if (!coupon) {
      return {
        isValid: false,
        message: 'کد تخفیف وارد شده معتبر نمی‌باشد.',
        discountAmount: 0,
      };
    }

    if (!coupon.isActive) {
      return {
        isValid: false,
        message: 'این کد تخفیف در حال حاضر غیرفعال است.',
        discountAmount: 0,
      };
    }

    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return {
        isValid: false,
        message: 'ظرفیت استفاده از این کد تخفیف به اتمام رسیده است.',
        discountAmount: 0,
      };
    }

    if (coupon.minOrderAmount && itemsSubtotal < coupon.minOrderAmount) {
      return {
        isValid: false,
        message: `حداقل ارزش سبد برای این کد تخفیف ${coupon.minOrderAmount.toLocaleString('fa-IR')} تومان است.`,
        discountAmount: 0,
      };
    }

    let discountAmount = 0;

    if (coupon.targetType === 'SHIPPING') {
      if (shippingFee <= 0) {
        return {
          isValid: false,
          message: 'هزینه ارسال سفارش شما در حال حاضر رایگان است.',
          discountAmount: 0,
        };
      }
      if (coupon.discountType === 'PERCENTAGE') {
        discountAmount = Math.round(shippingFee * (coupon.discountValue / 100));
      } else {
        discountAmount = Math.min(shippingFee, coupon.discountValue);
      }
    } else if (coupon.targetType === 'SPECIFIC_PRODUCT') {
      const item = cartItems.find((ci) => ci.product.id === coupon.targetProductId);
      if (!item) {
        return {
          isValid: false,
          message: `این کد تخفیف فقط برای «${coupon.targetProductName || 'محصول انتخاب‌شده'}» است و در سبد شما وجود ندارد.`,
          discountAmount: 0,
        };
      }
      const itemTotal = item.product.price * item.quantity;
      if (coupon.discountType === 'PERCENTAGE') {
        discountAmount = Math.round(itemTotal * (coupon.discountValue / 100));
        if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
          discountAmount = coupon.maxDiscountAmount;
        }
      } else {
        discountAmount = Math.min(itemTotal, coupon.discountValue);
      }
    } else if (coupon.targetType === 'ALL_PRODUCTS') {
      if (coupon.discountType === 'PERCENTAGE') {
        discountAmount = Math.round(itemsSubtotal * (coupon.discountValue / 100));
        if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
          discountAmount = coupon.maxDiscountAmount;
        }
      } else {
        discountAmount = Math.min(itemsSubtotal, coupon.discountValue);
      }
    }

    return {
      isValid: true,
      message: `کد تخفیف اعمال شد: ${coupon.title}`,
      coupon,
      discountAmount,
      targetType: coupon.targetType,
    };
  }

  // --- Daily Delivery Capacity Management (Admin Exclusive & Checkout Enforcement) ---
  getDailyCapacities(): DailyCapacityItem[] {
    const rawSlots = generateDeliverySlots(true, 12);
    let overrides: Record<string, { maxCapacity?: number; isClosedManually?: boolean }> = {};
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('profarm_daily_capacities');
        if (stored) {
          overrides = JSON.parse(stored);
        }
      } catch (e) {
        console.error('Error loading daily capacities', e);
      }
    }

    const orders = this.getOrders();

    return rawSlots.map((slot) => {
      const dateIso = slot.jalali.isoDateString;
      const override = overrides[dateIso];
      const maxCapacity = override?.maxCapacity ?? 30;
      const isClosedManually = override?.isClosedManually ?? false;

      // Count actual orders booked for this date
      const matchingOrders = orders.filter((o) => {
        if (!o.deliverySlot) return false;
        return (
          o.deliverySlot.isoDate === dateIso ||
          o.deliverySlot.date === slot.jalali.shortDate ||
          o.deliverySlot.date === slot.jalali.formattedDate
        );
      });

      // baseline simulation + actual orders
      const baseline = slot.currentBookings;
      const bookedCount = isClosedManually ? maxCapacity : Math.min(maxCapacity, Math.max(baseline, matchingOrders.length));
      const remainingCapacity = isClosedManually ? 0 : Math.max(0, maxCapacity - bookedCount);

      let status: 'OPEN' | 'NEAR_FULL' | 'FULL' = 'OPEN';
      if (isClosedManually || remainingCapacity === 0) {
        status = 'FULL';
      } else if (remainingCapacity <= 5) {
        status = 'NEAR_FULL';
      }

      return {
        dateIso,
        jalaliFormatted: slot.jalali.formattedDate,
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
    if (typeof window === 'undefined') return this.getDailyCapacities();
    try {
      const stored = localStorage.getItem('profarm_daily_capacities');
      const overrides: Record<string, { maxCapacity?: number; isClosedManually?: boolean }> = stored ? JSON.parse(stored) : {};
      overrides[dateIso] = {
        ...overrides[dateIso],
        ...updates,
      };
      localStorage.setItem('profarm_daily_capacities', JSON.stringify(overrides));
    } catch (e) {
      console.error('Error saving daily capacity', e);
    }
    return this.getDailyCapacities();
  }

  toggleDailyCapacityClose(dateIso: string): DailyCapacityItem[] {
    const list = this.getDailyCapacities();
    const item = list.find((c) => c.dateIso === dateIso);
    const newStatus = item ? !item.isClosedManually : true;
    return this.setDailyCapacity(dateIso, { isClosedManually: newStatus });
  }

  /**
   * Complete factory reset: removes all localStorage persistent keys
   * and restores in-memory collections to seed mock defaults.
   */
  resetEntireDatabaseToDefaults(): void {
    if (this.isBrowser()) {
      const keys = [
        'profarm_products',
        'profarm_orders',
        'profarm_users',
        'profarm_categories',
        'profarm_site_content',
        'profarm_subscription_settings',
        'profarm_coupons',
        'profarm_payment_settings',
        'profarm_return_requests',
        'profarm_reviews',
        'profarm_bulk_inquiries',
        'profarm_sms_settings',
        'profarm_sms_templates',
        'profarm_sms_broadcasts',
        'profarm_daily_capacities',
      ];
      keys.forEach((key) => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          // ignore
        }
      });
    }

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

    if (this.isBrowser()) {
      window.dispatchEvent(new CustomEvent('profarm_products_updated'));
      window.dispatchEvent(new CustomEvent('profarm_orders_updated'));
      window.dispatchEvent(new CustomEvent('profarm_users_updated'));
      window.dispatchEvent(new CustomEvent('profarm_reviews_updated'));
      window.dispatchEvent(new CustomEvent('profarm_subscription_updated'));
    }
  }
}

// Global singleton instance
const globalStore = (typeof globalThis !== 'undefined' ? globalThis : global) as unknown as { farmStore: FarmDataStore };
export const farmStore = globalStore.farmStore || new FarmDataStore();
globalStore.farmStore = farmStore;
