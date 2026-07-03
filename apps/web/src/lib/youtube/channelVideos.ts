import { unstable_cache } from 'next/cache';
import {
  buildFeaturedVideoFromId,
  getFeaturedYouTubeVideos,
  type FeaturedYouTubeVideo,
  SANOVA_YOUTUBE_CHANNEL_ID,
  SANOVA_YOUTUBE_CHANNEL_URL
} from '../../config/social';

const RSS_CACHE_SECONDS = 60 * 60;

function channelIdFromEnv(): string {
  return process.env.YOUTUBE_CHANNEL_ID?.trim() || SANOVA_YOUTUBE_CHANNEL_ID;
}

function channelRssUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
}

export function parseYouTubeChannelRss(xml: string): FeaturedYouTubeVideo[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  const videos: FeaturedYouTubeVideo[] = [];

  for (const entry of entries) {
    const idMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
    if (!idMatch?.[1]) {
      continue;
    }

    const titleMatch = entry.match(/<media:title>([^<]*)<\/media:title>/);
    const video = buildFeaturedVideoFromId(idMatch[1], titleMatch?.[1]?.trim());
    if (video) {
      videos.push(video);
    }
  }

  return videos;
}

async function fetchChannelVideosUncached(): Promise<FeaturedYouTubeVideo[]> {
  const channelId = channelIdFromEnv();

  try {
    const response = await fetch(channelRssUrl(channelId), {
      next: { revalidate: RSS_CACHE_SECONDS }
    });

    if (!response.ok) {
      return [];
    }

    const xml = await response.text();
    return parseYouTubeChannelRss(xml);
  } catch {
    return [];
  }
}

const getCachedChannelVideos = unstable_cache(
  fetchChannelVideosUncached,
  ['sanova-youtube-channel-videos'],
  { revalidate: RSS_CACHE_SECONDS }
);

export async function getSanovaYouTubeChannelVideos(): Promise<FeaturedYouTubeVideo[]> {
  const fromChannel = await getCachedChannelVideos();
  if (fromChannel.length > 0) {
    return fromChannel;
  }

  const manual = getFeaturedYouTubeVideos();
  return manual;
}

export function getSanovaYouTubeUploadsPlaylistId(channelId = channelIdFromEnv()): string {
  if (!channelId.startsWith('UC') || channelId.length < 3) {
    return '';
  }

  return `UU${channelId.slice(2)}`;
}

export function getSanovaYouTubeChannelEmbedUrl(): string {
  const playlistId = getSanovaYouTubeUploadsPlaylistId();
  if (!playlistId) {
    return SANOVA_YOUTUBE_CHANNEL_URL;
  }

  return `https://www.youtube-nocookie.com/embed/videoseries?list=${playlistId}`;
}
