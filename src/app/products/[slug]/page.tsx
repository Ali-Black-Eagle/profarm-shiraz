import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { cache } from 'react';
import { farmStore } from '@/lib/db-store';
import { maskReviewerName, publicReview, toPublicProduct } from '@/lib/public-api';
import {
  generateProductBreadcrumbJsonLd,
  generateProductJsonLd,
  generateProductSeoMetadata,
} from '@/lib/seo-utils';
import { safeJsonLdStringify } from '@/lib/formatters';
import ProductDetailClient, { type StorefrontReview } from '@/components/modules/ProductDetailClient';
import type { Product } from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://profarm-shiraz.ir';

interface ProductPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Active product by slug or id. Hidden products (isAvailable === false) behave as if they did not exist. */
const loadVisibleProduct = cache((rawSlug: string): Product | null => {
  const decoded = decodeSlug(rawSlug);
  const product = farmStore.getProductBySlug(decoded) || farmStore.getProductBySlug(rawSlug);
  if (!product || product.isAvailable === false) return null;
  return product;
});

const reviewDateFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'Asia/Tehran',
});

function formatReviewDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : reviewDateFormatter.format(date);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return generateProductSeoMetadata(loadVisibleProduct(slug) ?? undefined);
}

export default async function ProductPage({ params, searchParams }: ProductPageProps) {
  // Read per request so price, stock and review changes show at once.
  await connection();

  const { slug } = await params;
  const product = loadVisibleProduct(slug);
  if (!product) {
    notFound();
  }

  const query = await searchParams;
  const openReview = (Array.isArray(query.review) ? query.review[0] : query.review) === 'true';

  const approvedReviews = farmStore.getProductReviews(product.slug, true);
  const reviews: StorefrontReview[] = approvedReviews.map((review) => ({
    ...publicReview(review),
    dateLabel: formatReviewDate(review.createdAt),
  }));

  // Same rule as GET /api/products?slug: same category first, four items at most
  const others = farmStore
    .getProducts()
    .filter((p) => p.isAvailable !== false && p.id !== product.id);
  const related = [
    ...others.filter((p) => p.category === product.category),
    ...others.filter((p) => p.category !== product.category),
  ]
    .slice(0, 4)
    .map((p) => toPublicProduct(p));

  // The only Product JSON-LD on the page. Only approved reviews, with masked names.
  const productJsonLd = generateProductJsonLd(
    product,
    approvedReviews.map((review) => ({
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      authorName: maskReviewerName(review.userName),
    })),
    BASE_URL
  );
  const breadcrumbJsonLd = generateProductBreadcrumbJsonLd(product, BASE_URL);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(breadcrumbJsonLd) }}
      />
      <ProductDetailClient
        product={toPublicProduct(product)}
        reviews={reviews}
        related={related}
        openReview={openReview}
      />
    </>
  );
}
