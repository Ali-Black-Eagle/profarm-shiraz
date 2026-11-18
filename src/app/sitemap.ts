import type { MetadataRoute } from 'next';
import { connection } from 'next/server';
import { farmStore } from '@/lib/db-store';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://profarm-shiraz.ir';
const ALL_CATEGORIES = 'همه محصولات';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Generated per request so new, hidden or re-priced products show without a rebuild.
  await connection();

  // Only products a visitor can actually open (hidden products are excluded)
  const products = farmStore.getProducts().filter((p) => p.isAvailable !== false);
  const categories = farmStore.getCategories().filter((c) => c && c !== ALL_CATEGORIES);

  const productEntries: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${BASE_URL}/products/${p.slug}`,
    lastModified: new Date(p.updatedAt || p.createdAt || Date.now()),
    changeFrequency: 'daily',
    priority: 0.9,
  }));

  const categoryEntries: MetadataRoute.Sitemap = categories.map((cat) => ({
    url: `${BASE_URL}/products?category=${encodeURIComponent(cat)}`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 0.85,
  }));

  const staticEntries: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE_URL}/products`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.95 },
    { url: `${BASE_URL}/pro`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.85 },
    { url: `${BASE_URL}/bulk`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/terms`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
  ];

  return [...staticEntries, ...categoryEntries, ...productEntries];
}
