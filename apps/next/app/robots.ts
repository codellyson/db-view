import type { MetadataRoute } from 'next';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * robots.txt — allow indexing of the public-facing surface (landing page +
 * connections page) and explicitly disallow crawl traffic on API routes,
 * Next internals, and the offline shell. The dashboard at `/` is publicly
 * indexable as a marketing surface; once a user has a session cookie it
 * becomes their dashboard.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/_next/', '/~offline'],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
    host: APP_URL,
  };
}
