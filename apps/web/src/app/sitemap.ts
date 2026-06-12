import type { MetadataRoute } from 'next';
import { buildPublicSitemapUrls } from '../lib/seo/siteUrl';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return buildPublicSitemapUrls().map((url) => ({
    url,
    lastModified: now,
    changeFrequency: url.includes('/blog') ? 'monthly' : 'weekly',
    priority: url.endsWith('sanovacapital.com') || url.endsWith('sanovacapital.com/') ? 1 : 0.7
  }));
}
