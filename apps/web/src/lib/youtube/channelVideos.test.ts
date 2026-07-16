import { describe, expect, it } from 'vitest';
import { parseYouTubeChannelRss } from './channelVideos';
import { getSanovaYouTubeUploadsPlaylistId } from './channelVideos';

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <entry>
  <yt:videoId>kjPpMdFweAM</yt:videoId>
  <published>2026-05-01T12:00:00+00:00</published>
  <media:group>
    <media:title>Edificio Urban View</media:title>
    <media:description>Recorrido por el Edificio Urban View &amp; sus amenities.</media:description>
  </media:group>
 </entry>
 <entry>
  <yt:videoId>OpZ2YUh0lMY</yt:videoId>
  <media:group><media:title>Sanova demo</media:title></media:group>
 </entry>
</feed>`;

describe('parseYouTubeChannelRss', () => {
  it('extracts all video ids from channel rss', () => {
    const videos = parseYouTubeChannelRss(SAMPLE_RSS);
    expect(videos.map((video) => video.id)).toEqual(['kjPpMdFweAM', 'OpZ2YUh0lMY']);
    expect(videos[0]?.watchUrl).toBe('https://www.youtube.com/watch?v=kjPpMdFweAM');
    expect(videos[0]?.title).toBe('Edificio Urban View');
  });

  it('extracts description (decoding entities) and published date', () => {
    const [video] = parseYouTubeChannelRss(SAMPLE_RSS);
    expect(video?.description).toBe('Recorrido por el Edificio Urban View & sus amenities.');
    expect(video?.publishedAt).toBe('2026-05-01T12:00:00+00:00');
  });

  it('derives a thumbnail url from the video id', () => {
    const [video] = parseYouTubeChannelRss(SAMPLE_RSS);
    expect(video?.thumbnailUrl).toBe('https://i.ytimg.com/vi/kjPpMdFweAM/hqdefault.jpg');
  });

  it('leaves description/publishedAt undefined when absent from the feed', () => {
    const videos = parseYouTubeChannelRss(SAMPLE_RSS);
    expect(videos[1]?.description).toBeUndefined();
    expect(videos[1]?.publishedAt).toBeUndefined();
  });

  it('derives uploads playlist id from channel id', () => {
    expect(getSanovaYouTubeUploadsPlaylistId('UCFnDx3UpU7ky7NdEUbxCVTw')).toBe(
      'UUFnDx3UpU7ky7NdEUbxCVTw'
    );
  });
});
