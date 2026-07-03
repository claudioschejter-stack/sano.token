import { describe, expect, it } from 'vitest';
import {
  buildFeaturedVideoFromId,
  getFeaturedYouTubeVideos,
  getYouTubeUrl,
  SANOVA_YOUTUBE_CHANNEL_URL,
  youtubeVideoIdFromUrl
} from './social';

describe('social youtube config', () => {
  it('extracts video ids from watch and youtu.be urls', () => {
    expect(youtubeVideoIdFromUrl('https://www.youtube.com/watch?v=p6MRv3dNFt8&list=PLaz-FiJ6v_TE')).toBe(
      'p6MRv3dNFt8'
    );
    expect(youtubeVideoIdFromUrl('https://youtu.be/OpZ2YUh0lMY?si=a3ND2cQiu-lE4yw9')).toBe(
      'OpZ2YUh0lMY'
    );
  });

  it('builds channel watch urls without foreign playlists', () => {
    const video = buildFeaturedVideoFromId('OpZ2YUh0lMY', 'Demo');
    expect(video.watchUrl).toBe('https://www.youtube.com/watch?v=OpZ2YUh0lMY');
    expect(video.title).toBe('Demo');
  });

  it('returns empty featured list unless env override is set', () => {
    expect(getFeaturedYouTubeVideos()).toEqual([]);
  });

  it('uses the official Sanova Global YouTube channel by default', () => {
    expect(getYouTubeUrl()).toBe(SANOVA_YOUTUBE_CHANNEL_URL);
    expect(SANOVA_YOUTUBE_CHANNEL_URL).toBe('https://www.youtube.com/@SanovaGlobal');
  });
});
