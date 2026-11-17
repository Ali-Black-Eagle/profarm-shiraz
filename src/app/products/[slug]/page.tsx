import React from 'react';
import type { Metadata } from 'next';
import { farmStore } from '@/lib/db-store';
import { INITIAL_PRODUCTS } from '@/lib/initial-data';
import { generateProductSeoMetadata, generateProductJsonLd } from '@/lib/seo-utils';
import { safeJsonLdStringify } from '@/lib/formatters';
import ProductDetailClient from '@/components/modules/ProductDetailClient';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const product =
    farmStore.getProductBySlug(decodedSlug) ||
    farmStore.getProductBySlug(slug) ||
    INITIAL_PRODUCTS.find(
      (p) => p.slug === decodedSlug || p.slug === slug || p.id === slug
    );

  return generateProductSeoMetadata(product);
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const product =
    farmStore.getProductBySlug(decodedSlug) ||
    farmStore.getProductBySlug(slug) ||
    INITIAL_PRODUCTS.find(
      (p) => p.slug === decodedSlug || p.slug === slug || p.id === slug
    );

  const reviews = product ? farmStore.getProductReviews(product.slug, true) : [];
  const jsonLd = product ? generateProductJsonLd(product, reviews) : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
        />
      )}
      <ProductDetailClient slug={decodedSlug} initialProduct={product} />
    </>
  );
}
