import type { Metadata } from 'next';
import { connection } from 'next/server';
import { farmStore } from '@/lib/db-store';
import ProMembershipClient from '@/components/modules/ProMembershipClient';

export const metadata: Metadata = {
  title: 'اشتراک پرو و پلاس',
  description:
    'مقایسه طرح‌های اشتراک پلاس و پرو پروفارم شیراز: تحویل روزانه، سهمیه تخم‌مرغ محلی و تخفیف روی محصولات ارگانیک مزارع فارس.',
  alternates: { canonical: '/pro' },
};

export default async function ProPage() {
  // Prices, quotas and capacity come from the admin settings, read per request.
  await connection();

  const subSettings = farmStore.getSubscriptionSettings();
  const stats = farmStore.getSubscriptionStats();

  return <ProMembershipClient subSettings={subSettings} stats={stats} />;
}
