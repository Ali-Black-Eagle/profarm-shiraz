import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://profarm-shiraz.ir';

export default function robots(): MetadataRoute.Robots {
  // One rule set for every crawler. Private and transactional areas are closed to all of them.
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api/', '/login', '/cart', '/checkout', '/account', '/profile'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
