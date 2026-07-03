import { describe, expect, it } from 'vitest';
import { parseYouTubeChannelRss } from './channelVideos';
import { getSanovaYouTubeUploadsPlaylistId } from './channelVideos';

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <entry>
  <yt:videoId>kjPpMdFweAM</yt:videoId>
  <media:group><media:title>Edificio Urban View</media:title></media:group>
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

  it('derives uploads playlist id from channel id', () => {
    expect(getSanovaYouTubeUploadsPlaylistId('UCFnDx3UpU7ky7NdEUbxCVTw')).toBe(
      'UUFnDx3UpU7ky7NdEUbxCVTw'
    );
  });
});
