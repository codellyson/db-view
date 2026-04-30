import type { MetadataRoute } from 'next';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * Sitemap — public crawlable routes only. `/query` redirects to `/` so it's
 * deliberately excluded; `/api/*` and `/~offline` are excluded too.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${APP_URL}/`, lastModified, changeFrequency: 'monthly', priority: 1 },
    { url: `${APP_URL}/connections`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
  ];
}
