/** Public social profiles — override via Vercel env. */

/** Official Sanova Global YouTube channel — footer, SEO sameAs, landing section. */
export const SANOVA_YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/@SanovaGlobal';
export const SANOVA_YOUTUBE_CHANNEL_HANDLE = 'SanovaGlobal';
export const SANOVA_YOUTUBE_CHANNEL_ID = 'UCFnDx3UpU7ky7NdEUbxCVTw';

export type FeaturedYouTubeVideo = {
  id: string;
  title?: string;
  watchUrl: string;
  embedUrl: string;
};

export function youtubeVideoIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      const id = parsed.pathname.replace(/^\//, '').split('/')[0];
      return id || null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      return parsed.searchParams.get('v');
    }
  } catch {
    return null;
  }

  return null;
}

function buildFeaturedVideo(watchUrl: string): FeaturedYouTubeVideo | null {
  const id = youtubeVideoIdFromUrl(watchUrl);
  if (!id) {
    return null;
  }

  return buildFeaturedVideoFromId(id);
}

export function buildFeaturedVideoFromId(id: string, title?: string): FeaturedYouTubeVideo {
  const trimmedId = id.trim();
  return {
    id: trimmedId,
    title,
    watchUrl: `https://www.youtube.com/watch?v=${trimmedId}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${trimmedId}?rel=0`
  };
}

export function getLinkedInUrl(): string {
  return (
    process.env.NEXT_PUBLIC_LINKEDIN_URL?.trim() ||
    'https://www.linkedin.com/company/sanova-global'
  );
}

export function getYouTubeUrl(): string {
  return process.env.NEXT_PUBLIC_YOUTUBE_URL?.trim() || SANOVA_YOUTUBE_CHANNEL_URL;
}

export function getFeaturedYouTubeVideos(): FeaturedYouTubeVideo[] {
  const raw = process.env.NEXT_PUBLIC_YOUTUBE_FEATURED_VIDEOS?.trim();
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((entry) => buildFeaturedVideo(entry))
    .filter((video): video is FeaturedYouTubeVideo => video !== null);
}
