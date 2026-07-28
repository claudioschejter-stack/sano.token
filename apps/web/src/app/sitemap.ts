import type { MetadataRoute } from 'next';
import { buildPublicSitemapUrls, getSiteUrl } from '../lib/seo/siteUrl';
import { INDEXABLE_MEDIA_LOCALES } from '../lib/seo/mediaLocalePolicy';
import { withLocalePrefix } from '../lib/i18n/localeRouting';
import { getSanovaYouTubeChannelVideos } from '../lib/youtube/channelVideos';

export const revalidate = 3600;

/** Only es + en for shared media (same YouTube asset across locales). */
function withIndexableMediaLocales(siteUrl: string, path: string): string[] {
  return INDEXABLE_MEDIA_LOCALES.map((locale) => `${siteUrl}${withLocalePrefix(locale, path)}`);
}

function getPriority(url: string): number {
  if (/sanovacapital\.com\/?$/.test(url) || /sanovacapital\.com\/[a-z]{2}\/?$/.test(url)) return 1.0;
  if (url.includes('/faq')) return 0.9;
  if (url.includes('/blog') && url.match(/\/blog\/[^/]+$/)) return 0.8;
  if (url.includes('/blog')) return 0.9;
  if (url.includes('/nosotros')) return 0.7;
  if (url.includes('/contacto')) return 0.6;
  if (url.includes('/videos/') && !url.endsWith('/videos')) return 0.5;
  if (url.includes('/videos')) return 0.6;
  if (url.includes('/privacidad') || url.includes('/terminos')) return 0.4;
  return 0.6;
}

function getChangeFrequency(url: string): MetadataRoute.Sitemap[number]['changeFrequency'] {
  if (url.match(/\/blog\/[^/]+$/)) return 'monthly';
  if (url.includes('/blog')) return 'weekly';
  if (url.includes('/privacidad') || url.includes('/terminos')) return 'yearly';
  if (url.includes('/videos')) return 'weekly';
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

  const videosIndexEntries: MetadataRoute.Sitemap = withIndexableMediaLocales(siteUrl, '/videos').map(
    (url) => ({
      url,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.6
    })
  );

  const videoEntries: MetadataRoute.Sitemap = videos.flatMap((video) =>
    withIndexableMediaLocales(siteUrl, `/videos/${video.id}`).map((url) => ({
      url,
      lastModified: video.publishedAt ? new Date(video.publishedAt) : now,
      changeFrequency: 'monthly' as const,
      priority: 0.5
    }))
  );

  return [...staticEntries, ...videosIndexEntries, ...videoEntries];
}
