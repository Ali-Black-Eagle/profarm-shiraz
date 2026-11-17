import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Header } from '@/components/modules/Header';
import { Footer } from '@/components/modules/Footer';
import { ScrollToTop } from '@/components/modules/ScrollToTop';
import { CartFloatingPopup } from '@/components/modules/CartFloatingPopup';
import { safeJsonLdStringify } from '@/lib/formatters';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://profarm-shiraz.ir';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'پروفارم شیراز | فروشگاه آنلاین محصولات ارگانیک و محلی فارس',
    template: '%s | پروفارم شیراز',
  },
  description:
    'خرید مستقیم محصولات ارگانیک در شیراز: تخم‌مرغ محلی تازه، عسل وحشی دشت ارژن، سبزیجات تازه قصرالدشت، پنیر کوزه سنتی و عرقیات اصل میمند با ارسال اختصاصی و تحویل فوری روزانه درب منزل.',
  keywords: [
    'ارگانیک شیراز',
    'خرید تخم مرغ محلی در شیراز',
    'قیمت تخم مرغ ارگانیک شیراز',
    'عسل طبیعی دشت ارژن',
    'سبزیجات تازه قصرالدشت',
    'خرید سبزی قصرالدشت شیراز',
    'لبنیات سنتی شیراز',
    'پنیر کوزه عشایری فارس',
    'عرقیات اصل میمند شیراز',
    'روغن زیتون فرابکر شیراز',
    'گردو پوست کاغذی سپیدان',
    'سوپرمارکت ارگانیک شیراز',
    'فروشگاه محصولات سالم شیراز',
    'خرید عمده محصولات کشاورزی شیراز',
    'سفارش آنلاین غذای ارگانیک شیراز',
    'پیک فوری تحویل شیراز',
    'مزارع ارگانیک پروفارم شیراز',
  ],
  authors: [{ name: 'مزارع ارگانیک پروفارم شیراز', url: BASE_URL }],
  creator: 'پروفارم شیراز',
  publisher: 'پروفارم شیراز',
  formatDetection: {
    email: true,
    address: true,
    telephone: true,
  },
  alternates: {
    canonical: BASE_URL,
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'fa_IR',
    url: BASE_URL,
    siteName: 'پروفارم شیراز - محصولات ارگانیک و محلی',
    title: 'پروفارم شیراز | فروشگاه آنلاین فرآورده‌های ارگانیک و تازه فارس',
    description:
      'عرضه مستقیم فرآورده‌های ارگانیک، تخم‌مرغ محلی، عسل وحشی دشت ارژن، سبزیجات قصرالدشت و لبنیات محلی با ارسال اکسپرس در شیراز.',
    images: [
      {
        url: '/images/hero-shiraz-farm.jpg',
        width: 1200,
        height: 630,
        alt: 'مزارع ارگانیک پروفارم شیراز',
      },
      {
        url: '/images/story-fars-farms.jpg',
        width: 1200,
        height: 630,
        alt: 'مزارع سنتی فارس و برداشت ارگانیک',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'پروفارم شیراز | فروشگاه آنلاین محصولات ارگانیک فارس',
    description: 'عرضه مستقیم فرآورده‌های ارگانیک و محلی تازه در شیراز با تحویل فوری روزانه درب منزل',
    images: ['/images/hero-shiraz-farm.jpg'],
  },
  category: 'supermarket, organic food, agriculture, local produce',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Rich Structured Data for Google Local Business & Store
  const localStoreSchema = {
    '@context': 'https://schema.org',
    '@type': ['GroceryStore', 'Store'],
    '@id': `${BASE_URL}/#store`,
    name: 'پروفارم شیراز | مزارع ارگانیک و فرآورده‌های محلی فارس',
    alternateName: ['پروفارم', 'ProFarm Shiraz', 'مزارع ارگانیک پروفارم شیراز'],
    description:
      'اولین سامانه آنلاین توزیع مستقیم محصولات کشاورزی ارگانیک، تخم‌مرغ رسمی روز، عسل وحشی دشت ارژن، سبزیجات تازه باغات قصرالدشت و عرقیات اصیل میمند در شیراز با تحویل فوری روزانه.',
    url: BASE_URL,
    telephone: '+987136280000',
    priceRange: '$$',
    currenciesAccepted: 'IRR, IRT',
    paymentAccepted: 'کارت به کارت، درگاه پرداخت شاپرک، زرین‌پال، پرداخت در محل با کارتخوان پیک شیراز',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'بلوار ارم، مجتمع مزارع ارگانیک پروفارم',
      addressLocality: 'شیراز',
      addressRegion: 'فارس',
      postalCode: '7143912345',
      addressCountry: 'IR',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 29.6385,
      longitude: 52.5255,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: [
          'Saturday',
          'Sunday',
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
        ],
        opens: '07:30',
        closes: '23:00',
      },
    ],
    areaServed: [
      {
        '@type': 'City',
        name: 'شیراز',
      },
      {
        '@type': 'AdministrativeArea',
        name: 'استان فارس',
      },
    ],
    logo: `${BASE_URL}/images/hero-shiraz-farm.jpg`,
    image: `${BASE_URL}/images/hero-shiraz-farm.jpg`,
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'فهرست محصولات ارگانیک و محلی پروفارم شیراز',
      itemListElement: [
        { '@type': 'OfferCatalog', name: 'تخم‌مرغ محلی و رسمی روز' },
        { '@type': 'OfferCatalog', name: 'عسل طبیعی و کوهستان دشت ارژن' },
        { '@type': 'OfferCatalog', name: 'سبزیجات تازه و دست‌چین قصرالدشت' },
        { '@type': 'OfferCatalog', name: 'پنیر کوزه و لبنیات محلی فارس' },
        { '@type': 'OfferCatalog', name: 'عرقیات دوآتشه و گلاب ناب میمند' },
        { '@type': 'OfferCatalog', name: 'روغن زیتون فرابکر مزارع سروستان' },
      ],
    },
  };

  // Rich Structured Data for WebSite & Google Sitelinks Searchbox
  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${BASE_URL}/#website`,
    url: BASE_URL,
    name: 'پروفارم شیراز | فروشگاه آنلاین فرآورده‌های ارگانیک',
    alternateName: 'ProFarm Shiraz',
    inLanguage: 'fa-IR',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/products?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  // Rich Structured Data for Organization
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${BASE_URL}/#organization`,
    name: 'مزارع ارگانیک پروفارم شیراز',
    url: BASE_URL,
    logo: `${BASE_URL}/images/hero-shiraz-farm.jpg`,
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+987136280000',
      contactType: 'customer service',
      areaServed: 'IR',
      availableLanguage: ['fa', 'en'],
    },
  };

  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
      </head>
      <body
        className="min-h-screen flex flex-col bg-[#F9F8F5] text-[#212529] antialiased"
        suppressHydrationWarning
      >
        {/* Structured Data Scripts for Google Knowledge Graph & Local SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(localStoreSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(websiteSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(organizationSchema) }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined') {
                window.addEventListener('unhandledrejection', function(e) {
                  if (e.reason && (
                    String(e.reason).includes('MetaMask') || 
                    String(e.reason.message || '').includes('MetaMask') ||
                    String(e.reason).includes('Failed to connect')
                  )) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                  }
                });
              }
            `,
          }}
        />
        <ScrollToTop />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <CartFloatingPopup />
      </body>
    </html>
  );
}
