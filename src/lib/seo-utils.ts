import { Product, ProductReview } from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://profarm-shiraz.ir';

// Common Persian to English transliteration map for clean slugs
const TRANSLATION_DICTIONARY: Record<string, string> = {
  'تخم مرغ': 'eggs',
  'تخم‌مرغ': 'eggs',
  'عسل': 'honey',
  'سبزیجات': 'veggies',
  'سبزی': 'herbs',
  'پنیر': 'cheese',
  'شیر': 'milk',
  'ماست': 'yogurt',
  'دوغ': 'doogh',
  'کره': 'butter',
  'روغن': 'oil',
  'زیتون': 'olive',
  'زعفران': 'saffron',
  'گردو': 'walnut',
  'بادام': 'almond',
  'پسته': 'pistachio',
  'شیره': 'syrup',
  'انگور': 'grape',
  'خرما': 'dates',
  'عرقیات': 'distillates',
  'گلاب': 'rosewater',
  'بیدمشک': 'pussy-willow',
  'نعنا': 'mint',
  'کاسنی': 'chicory',
  'کامفیروز': 'kamfiruz',
  'دشت ارژن': 'dasht-arjan',
  'قصرالدشت': 'qasrodasht',
  'سپیدان': 'sepidan',
  'فیروزآباد': 'firuzabad',
  'میمند': 'meymand',
  'سروستان': 'sarvestan',
  'استهبان': 'estehban',
  'مرودشت': 'marvdasht',
  'اقلید': 'eghlid',
  'شیراز': 'shiraz',
  'ارگانیک': 'organic',
  'محلی': 'local',
  'سنتی': 'traditional',
  'طبیعی': 'natural',
  'بسته': 'pack',
  'شیشه': 'jar',
  'کوزه': 'pottery',
};

/**
 * Generate a clean, SEO-friendly slug.
 * Supports Persian keywords with hyphen separation or clean transliteration.
 */
export function generateSeoSlug(title: string, existingSlugs: string[] = []): string {
  if (!title || !title.trim()) {
    return `product-${Date.now()}`;
  }

  const cleanTitle = title.trim().toLowerCase();

  // Try to find dictionary matches for transliteration
  const slugParts: string[] = [];
  let remaining = cleanTitle;

  // Replace common dictionary phrases
  for (const [persian, english] of Object.entries(TRANSLATION_DICTIONARY)) {
    if (remaining.includes(persian)) {
      slugParts.push(english);
      remaining = remaining.replace(new RegExp(persian, 'g'), ' ');
    }
  }

  let baseSlug = '';
  if (slugParts.length >= 2) {
    // English transliteration slug
    baseSlug = slugParts.join('-');
  } else {
    // Clean Persian slug
    baseSlug = cleanTitle
      .replace(/[^\u0600-\u06FFa-zA-Z0-9\s-]/g, '') // Keep Persian, English, digits
      .replace(/\s+/g, '-') // Replace spaces with dashes
      .replace(/-+/g, '-') // Remove duplicate dashes
      .slice(0, 70); // Max 70 chars for SEO
  }

  if (!baseSlug) {
    baseSlug = `prod-${Date.now()}`;
  }

  // Ensure uniqueness
  let finalSlug = baseSlug;
  let counter = 1;
  while (existingSlugs.includes(finalSlug)) {
    finalSlug = `${baseSlug}-${counter}`;
    counter++;
  }

  return finalSlug;
}

/**
 * Generates an SEO meta title optimized for Google SERP display (50-60 characters).
 */
export function generateProductSeoTitle(product: {
  title: string;
  category?: string;
  originLocation?: string;
}): string {
  const brandSuffix = 'پروفارم شیراز';
  const cleanTitle = product.title.trim();

  if (cleanTitle.length <= 35) {
    return `خرید آنلاین ${cleanTitle} ارگانیک | ${brandSuffix}`;
  }
  return `${cleanTitle} | خرید مستقیم با پیک شیراز | ${brandSuffix}`;
}

/**
 * Generates an SEO meta description optimized for Google CTR (140-160 characters).
 */
export function generateProductSeoDescription(product: {
  title: string;
  category?: string;
  description?: string;
  originLocation?: string;
}): string {
  const origin = product.originLocation ? ` از ${product.originLocation}` : ' از مزارع استان فارس';
  return `خرید اینترنتی ${product.title}${origin} با تضمین ۱۰۰٪ اصالت و سلامت ارگانیک. ارسال سریع با زنجیره سرد پیک پروفارم در شیراز، ضمانت بازگشت وجه.`;
}

/**
 * Generates SEO meta keywords.
 */
export function generateProductSeoKeywords(product: {
  title: string;
  category?: string;
  originLocation?: string;
}): string[] {
  const keywords: string[] = [
    `خرید ${product.title}`,
    `قیمت ${product.title} در شیراز`,
    'فروشگاه ارگانیک شیراز',
    'پیک اختصاصی پروفارم شیراز',
    'محصولات سالم مزارع فارس',
  ];

  if (product.category) {
    keywords.push(product.category);
    keywords.push(`خرید ${product.category} ارگانیک`);
  }

  if (product.originLocation) {
    keywords.push(`محصولات ارگانیک ${product.originLocation}`);
  }

  return keywords;
}

/**
 * Generates Category SEO Title.
 */
export function generateCategorySeoTitle(categoryName: string): string {
  if (categoryName === 'همه محصولات') {
    return 'خرید آنلاین محصولات ارگانیک و محلی شیراز | توزیع مزارع فارس | پروفارم';
  }
  return `خرید انواع ${categoryName} ارگانیک و محلی در شیراز | قیمت روز و ارسال سریع | پروفارم`;
}

/**
 * Generates Category SEO Description.
 */
export function generateCategorySeoDescription(categoryName: string): string {
  if (categoryName === 'همه محصولات') {
    return 'فهرست کامل محصولات تازه و ارگانیک مزارع استان فارس شامل تخم‌مرغ رسمی، عسل کوهستان، سبزیجات نوبرانه، لبنیات محلی و عرقیات اصیل با تحویل روزانه در شیراز.';
  }
  return `فروش آنلاین تازه‌ترین ${categoryName} طبیعی و بهداشتی با ارسال روزانه پیک در شیراز. تضمین سلامت، قیمت منصفانه و ارسال مستقیم از مزارع استان فارس.`;
}

/**
 * Generates complete JSON-LD Structured Data for Product with Reviews.
 */
export function generateProductJsonLd(
  product: Product,
  reviews: ProductReview[] = [],
  baseUrl = BASE_URL
) {
  const productUrl = `${baseUrl}/products/${product.slug}`;
  const images = (product.images || []).map((img) =>
    img.startsWith('http') ? img : `${baseUrl}${img}`
  );

  const approvedReviews = reviews.filter((r) => r.status === 'APPROVED');
  const avgRating =
    approvedReviews.length > 0
      ? (
          approvedReviews.reduce((sum, r) => sum + r.rating, 0) / approvedReviews.length
        ).toFixed(1)
      : '5.0';

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    image: images.length > 0 ? images : [`${baseUrl}/images/prod-eggs.jpg`],
    description: product.description,
    sku: product.id,
    mpn: product.slug,
    brand: {
      '@type': 'Brand',
      name: 'پروفارم شیراز',
    },
    category: product.category,
    offers: {
      '@type': 'Offer',
      url: productUrl,
      priceCurrency: 'IRT',
      price: product.price,
      priceValidUntil: '2027-12-31',
      availability:
        (product.stock || 0) > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: {
        '@type': 'Organization',
        name: 'پروفارم شیراز',
        url: baseUrl,
      },
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'IR',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 7,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/FreeReturn',
      },
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: {
          '@type': 'MonetaryAmount',
          value: '45000',
          currency: 'IRT',
        },
        shippingDestination: {
          '@type': 'DefinedRegion',
          addressCountry: 'IR',
          addressRegion: 'فارس',
          addressLocality: 'شیراز',
        },
      },
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: avgRating,
      reviewCount: Math.max(1, approvedReviews.length).toString(),
      bestRating: '5',
      worstRating: '1',
    },
  };

  // Add individual reviews for Google rich snippet stars
  if (approvedReviews.length > 0) {
    schema.review = approvedReviews.slice(0, 5).map((r) => ({
      '@type': 'Review',
      author: {
        '@type': 'Person',
        name: r.userName || 'خریدار پروفارم',
      },
      datePublished: r.createdAt || '۱۴۰۵/۰۶/۰۱',
      reviewBody: r.comment,
      reviewRating: {
        '@type': 'Rating',
        ratingValue: r.rating.toString(),
        bestRating: '5',
        worstRating: '1',
      },
    }));
  }

  return schema;
}

/**
 * Generates JSON-LD BreadcrumbList schema for category navigation.
 */
export function generateCategoryBreadcrumbJsonLd(
  categoryName: string,
  baseUrl = BASE_URL
) {
  const items = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'خانه',
      item: baseUrl,
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'محصولات ارگانیک شیراز',
      item: `${baseUrl}/products`,
    },
  ];

  if (categoryName && categoryName !== 'همه محصولات') {
    items.push({
      '@type': 'ListItem',
      position: 3,
      name: categoryName,
      item: `${baseUrl}/products?category=${encodeURIComponent(categoryName)}`,
    });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  };
}

/**
 * Generates Next.js Metadata object for Product SSR head tags.
 */
export function generateProductSeoMetadata(
  product: Product | undefined,
  baseUrl = BASE_URL
) {
  if (!product) {
    return {
      title: 'محصول یافت نشد | پروفارم شیراز',
      description: 'کالای مورد نظر شما در فروشگاه پروفارم شیراز یافت نشد یا ممکن است ناموجود شده باشد.',
      robots: { index: false, follow: true },
    };
  }

  const title = product.seoTitle || generateProductSeoTitle(product);
  const description = product.seoDescription || generateProductSeoDescription(product);
  const keywords = product.seoKeywords || generateProductSeoKeywords(product);
  const productUrl = `${baseUrl}/products/${product.slug}`;
  const images =
    product.images && product.images.length > 0
      ? product.images.map((img) => (img.startsWith('http') ? img : `${baseUrl}${img}`))
      : [`${baseUrl}/images/prod-eggs.jpg`];

  return {
    title: { absolute: title },
    description,
    keywords,
    alternates: {
      canonical: productUrl,
    },
    openGraph: {
      title,
      description,
      url: productUrl,
      siteName: 'پروفارم شیراز - مزارع ارگانیک',
      locale: 'fa_IR',
      type: 'website',
      images: images.map((img) => ({
        url: img,
        width: 800,
        height: 600,
        alt: product.title,
      })),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images,
    },
    other: {
      'product:price:amount': product.price.toString(),
      'product:price:currency': 'IRT',
      'product:availability': (product.stock || 0) > 0 ? 'in stock' : 'out of stock',
    },
  };
}

/**
 * Generates Next.js Metadata object for Category Catalog SSR head tags.
 */
export function generateCategorySeoMetadata(
  categoryName: string,
  baseUrl = BASE_URL
) {
  const title = generateCategorySeoTitle(categoryName);
  const description = generateCategorySeoDescription(categoryName);
  const categoryUrl =
    categoryName && categoryName !== 'همه محصولات'
      ? `${baseUrl}/products?category=${encodeURIComponent(categoryName)}`
      : `${baseUrl}/products`;

  return {
    title,
    description,
    keywords: [
      `خرید ${categoryName} شیراز`,
      `قیمت ${categoryName} ارگانیک`,
      'محصولات تازه مزارع فارس',
      'ارسال فوری شیراز با زنجیره سرد',
      'سوپرمارکت ارگانیک پروفارم',
    ],
    alternates: {
      canonical: categoryUrl,
    },
    openGraph: {
      title,
      description,
      url: categoryUrl,
      siteName: 'پروفارم شیراز',
      locale: 'fa_IR',
      type: 'website',
      images: [
        {
          url: `${baseUrl}/images/hero-shiraz-farm.jpg`,
          width: 1200,
          height: 630,
          alt: `خرید ${categoryName} در شیراز`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${baseUrl}/images/hero-shiraz-farm.jpg`],
    },
  };
}
