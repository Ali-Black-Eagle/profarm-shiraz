/**
 * Default configuration values and seed collections for the farm store.
 * Plain data shared by the server store (db-store.ts) and the database seed script.
 * Contains no browser or filesystem access.
 */
import { SiteContent, SubscriptionSettings, FaqItem, ComparisonRow, Coupon, PaymentSettings, SmsProviderSettings, EmailProviderSettings } from '@/types';

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
  freeTierDeliveryDaysText: 'یکشنبه و چهارشنبه',
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
    merchantId: process.env.ZARINPAL_MERCHANT_ID || '',
    sandbox: process.env.ZARINPAL_SANDBOX === 'true',
    defaultDescription: 'سفارش محصولات ارگانیک شیراز',
  },
  snapppay: {
    enabled: true,
    clientId: process.env.SNAPPPAY_CLIENT_ID || '',
    clientSecret: process.env.SNAPPPAY_CLIENT_SECRET || '',
    baseUrl: process.env.SNAPPPAY_BASE_URL || 'https://api.snapppay.ir/api/online/v1',
    minAmount: 200000,
  },
  general: {
    currency: 'IRT',
    allowCashOnDelivery: false,
    paymentTimeoutMinutes: 30,
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
  socialWhatsapp: '',
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
