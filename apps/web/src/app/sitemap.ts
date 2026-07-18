import type { MetadataRoute } from 'next';
import { buildPublicSitemapUrls, getSiteUrl } from '../lib/seo/siteUrl';
import { locales } from '../i18n';
import { withLocalePrefix } from '../lib/i18n/localeRouting';
import { getSanovaYouTubeChannelVideos } from '../lib/youtube/channelVideos';

export const revalidate = 3600;

/** Every locale variant of `path` — unprefixed ES first, then the rest with their `/xx` prefix. */
function withAllLocales(siteUrl: string, path: string): string[] {
  return [
    `${siteUrl}${path}`,
    ...locales.filter((locale) => locale !== 'es').map((locale) => `${siteUrl}${withLocalePrefix(locale, path)}`)
  ];
}

function getPriority(url: string): number {
  if (/sanovacapital\.com\/?$/.test(url)) return 1.0;
  if (url.includes('/faq')) return 0.9;
  if (url.includes('/blog') && url.match(/\/blog\/[^/]+$/)) return 0.8;
  if (url.includes('/blog')) return 0.9;
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const siteUrl = getSiteUrl();

  const staticEntries: MetadataRoute.Sitemap = buildPublicSitemapUrls().map((url) => ({
    url,
    lastModified: now,
    changeFrequency: getChangeFrequency(url),
    priority: getPriority(url)
  }));

  const videos = await getSanovaYouTubeChannelVideos();

  const videosIndexEntries: MetadataRoute.Sitemap = withAllLocales(siteUrl, '/videos').map((url) => ({
    url,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.6
  }));

  const videoEntries: MetadataRoute.Sitemap = videos.flatMap((video) =>
    withAllLocales(siteUrl, `/videos/${video.id}`).map((url) => ({
      url,
      lastModified: video.publishedAt ? new Date(video.publishedAt) : now,
      changeFrequency: 'monthly',
      priority: 0.5
    }))
  );

  return [...staticEntries, ...videosIndexEntries, ...videoEntries];
}
