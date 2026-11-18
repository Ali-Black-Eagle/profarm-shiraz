import type { Metadata } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { farmStore } from '@/lib/db-store';
import { toPublicProduct } from '@/lib/public-api';
import { generateCategorySeoDescription, generateCategorySeoTitle } from '@/lib/seo-utils';
import ProductsCatalogClient from '@/components/modules/ProductsCatalogClient';

const ALL_CATEGORIES = 'همه محصولات';

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' ? raw.trim() : '';
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const params = await searchParams;
  const search = firstParam(params.search);
  const category = firstParam(params.category);
  const knownCategories = farmStore.getCategories();

  // Search results are open-ended combinations of queries: keep them out of the index and point to the catalog.
  if (search) {
    return {
      title: 'نتایج جستجوی محصولات',
      description: `نتایج جستجوی «${search}» در کاتالوگ محصولات ارگانیک مزارع فارس.`,
      alternates: { canonical: '/products' },
      robots: { index: false, follow: true },
    };
  }

  // A known category gets its own indexable page with its own canonical.
  if (category && knownCategories.includes(category)) {
    return {
      title: { absolute: generateCategorySeoTitle(category) },
      description: generateCategorySeoDescription(category),
      alternates: { canonical: `/products?category=${encodeURIComponent(category)}` },
    };
  }

  if (category) {
    return {
      title: { absolute: generateCategorySeoTitle(ALL_CATEGORIES) },
      description: generateCategorySeoDescription(ALL_CATEGORIES),
      alternates: { canonical: '/products' },
      robots: { index: false, follow: true },
    };
  }

  return {
    title: { absolute: generateCategorySeoTitle(ALL_CATEGORIES) },
    description: generateCategorySeoDescription(ALL_CATEGORIES),
    alternates: { canonical: '/products' },
  };
}

export default async function ProductsPage() {
  await connection();

  const products = farmStore
    .getProducts()
    .filter((p) => p.isAvailable !== false)
    .map((p) => toPublicProduct(p));
  const categories = farmStore.getCategories().filter((c) => c && c !== ALL_CATEGORIES);

  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 py-16 text-center text-sm text-gray-500">
          در حال بارگذاری کاتالوگ محصولات...
        </div>
      }
    >
      <ProductsCatalogClient products={products} categories={categories} />
    </Suspense>
  );
}
