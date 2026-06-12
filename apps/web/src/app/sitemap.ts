import type { MetadataRoute } from 'next';
import { getSiteUrl, PUBLIC_MARKETING_PATHS } from '../lib/seo/siteUrl';

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const now = new Date();

  return PUBLIC_MARKETING_PATHS.map((path) => ({
    url: path === '/' ? siteUrl : `${siteUrl}${path}`,
    lastModified: now,
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : path === '/acceso' ? 0.9 : 0.6
  }));
}
