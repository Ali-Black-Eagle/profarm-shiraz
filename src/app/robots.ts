import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://profarm-shiraz.ir';

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/products',
          '/products/*',
          '/pro',
          '/bulk',
          '/terms',
          '/privacy',
          '/images/*',
        ],
        disallow: [
          '/admin/',
          '/api/',
          '/checkout/',
          '/login/',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/checkout/',
        ],
      },
      {
        userAgent: 'Googlebot-Image',
        allow: ['/images/*', '/products/*'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
