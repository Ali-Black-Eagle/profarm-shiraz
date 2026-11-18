import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'پروفارم شیراز | مزارع ارگانیک و فرآورده‌های محلی فارس',
    short_name: 'پروفارم شیراز',
    description: 'فروشگاه آنلاین خرید مستقیم محصولات ارگانیک، تخم‌مرغ محلی، عسل و لبنیات تازه شیراز',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#F9F8F5',
    theme_color: '#2C4A2E',
    lang: 'fa',
    dir: 'rtl',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
