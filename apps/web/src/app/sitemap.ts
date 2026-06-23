import type { MetadataRoute } from 'next';
import { buildPublicSitemapUrls } from '../lib/seo/siteUrl';

function getPriority(url: string): number {
  if (/sanovacapital\.com\/?$/.test(url)) return 1.0;
  if (url.includes('/nosotros') || url.includes('/faq')) return 0.8;
  if (url.match(/\/blog\/[^/]+$/)) return 0.8;
  if (url.includes('/blog')) return 0.7;
  if (url.includes('/contacto')) return 0.6;
  if (url.includes('/privacidad') || url.includes('/terminos')) return 0.3;
  return 0.6;
}

function getChangeFrequency(url: string): MetadataRoute.Sitemap[number]['changeFrequency'] {
  if (url.match(/\/blog\/[^/]+$/)) return 'monthly';
  if (url.includes('/blog')) return 'weekly';
  if (url.includes('/privacidad') || url.includes('/terminos')) return 'yearly';
  return 'weekly';
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return buildPublicSitemapUrls().map((url) => ({
    url,
    lastModified: now,
    changeFrequency: getChangeFrequency(url),
    priority: getPriority(url)
  }));
}
