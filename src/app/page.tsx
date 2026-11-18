import type { Metadata } from 'next';
import { connection } from 'next/server';
import { farmStore } from '@/lib/db-store';
import { toPublicProduct } from '@/lib/public-api';
import HomeClient from '@/components/modules/HomeClient';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  description:
    'خرید مستقیم محصولات ارگانیک در شیراز: تخم‌مرغ محلی تازه، عسل وحشی دشت ارژن، سبزیجات تازه قصرالدشت، پنیر کوزه سنتی و عرقیات اصل میمند با ارسال اختصاصی و تحویل روزانه.',
};

export default async function HomePage() {
  // Read per request so CMS, price and stock edits show without a rebuild.
  await connection();

  const content = farmStore.getSiteContent();
  const subSettings = farmStore.getSubscriptionSettings();
  const stats = farmStore.getSubscriptionStats();
  const products = farmStore
    .getProducts()
    .filter((p) => p.isAvailable !== false)
    .map((p) => toPublicProduct(p));
  const categories = farmStore.getCategories().filter((c) => c && c !== 'همه محصولات');

  return (
    <HomeClient
      content={content}
      subSettings={subSettings}
      stats={stats}
      products={products}
      categories={categories}
    />
  );
}
