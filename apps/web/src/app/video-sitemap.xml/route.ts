import { NextResponse } from 'next/server';
import { getSiteUrl } from '../../lib/seo/siteUrl';
import { getSanovaYouTubeChannelVideos } from '../../lib/youtube/channelVideos';

export const revalidate = 3600;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Google video sitemap extension (https://developers.google.com/search/docs/crawling-indexing/sitemaps/video-sitemaps).
 * Supplements the per-page VideoObject JSON-LD on /videos/[id] with a
 * dedicated discovery feed — helps the Video indexing report associate each
 * video with our own watch page instead of only the raw YouTube URL.
 */
export async function GET() {
  const siteUrl = getSiteUrl();
  const videos = await getSanovaYouTubeChannelVideos();

  const urlEntries = videos
    .map((video) => {
      const loc = `${siteUrl}/videos/${video.id}`;
      const title = escapeXml(video.title?.trim() || 'Sanova Global — Vaca Muerta RWA');
      const description = escapeXml(
        (video.description?.trim() || video.title?.trim() || 'Sanova Global — tokenización de activos reales en Vaca Muerta.').slice(
          0,
          2048
        )
      );
      const publicationDate = video.publishedAt ? new Date(video.publishedAt).toISOString() : null;

      return [
        '  <url>',
        `    <loc>${escapeXml(loc)}</loc>`,
        '    <video:video>',
        `      <video:thumbnail_loc>${escapeXml(video.thumbnailUrl)}</video:thumbnail_loc>`,
        `      <video:title>${title}</video:title>`,
        `      <video:description>${description}</video:description>`,
        `      <video:player_loc allow_embed="yes">${escapeXml(video.embedUrl)}</video:player_loc>`,
        publicationDate ? `      <video:publication_date>${publicationDate}</video:publication_date>` : null,
        '      <video:family_friendly>yes</video:family_friendly>',
        '      <video:live>no</video:live>',
        '    </video:video>',
        '  </url>'
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n${urlEntries}\n</urlset>\n`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=UTF-8'
    }
  });
}
