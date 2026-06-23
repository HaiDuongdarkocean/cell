import { readFileSync } from 'fs';
import { join } from 'path';
import { parseM3u8 } from '@/lib/parsers/m3u8Parser';

const fixturesDir = join(__dirname, '..', 'fixtures');

describe('parseM3u8', () => {
  describe('valid media playlist with segments', () => {
    const mediaPlaylist = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXTINF:9.009,
segment0.ts
#EXTINF:9.009,
segment1.ts
#EXTINF:9.009,
segment2.ts
#EXT-X-ENDLIST`;

    it('parses segments with durations and urls', () => {
      const result = parseM3u8(mediaPlaylist);

      expect(result.isMasterPlaylist).toBe(false);
      expect(result.variants).toEqual([]);
      expect(result.version).toBe(3);
      expect(result.targetDuration).toBe(10);
      expect(result.segments).toHaveLength(3);
      expect(result.segments[0]).toEqual({
        url: 'segment0.ts',
        duration: 9.009,
      });
      expect(result.segments[1].url).toBe('segment1.ts');
      expect(result.segments[2].duration).toBe(9.009);
    });

    it('defaults version to 3 when #EXT-X-VERSION missing', () => {
      const noVersion = `#EXTM3U
#EXT-X-TARGETDURATION:5
#EXTINF:5.0,
seg.ts
#EXT-X-ENDLIST`;

      expect(parseM3u8(noVersion).version).toBe(3);
    });

    it('parses sample fixture file', () => {
      const content = readFileSync(join(fixturesDir, 'sample.m3u8'), 'utf-8');
      const result = parseM3u8(content);

      expect(result.segments.length).toBeGreaterThan(0);
      expect(result.isMasterPlaylist).toBe(false);
      expect(result.targetDuration).toBe(10);
    });
  });

  describe('valid master playlist with variants', () => {
    const masterPlaylist = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080,CODECS="avc1.640028"
high.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720,CODECS="avc1.4d401f"
mid.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=854x480,CODECS="avc1.4d401e"
low.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=500000,RESOLUTION=640x360,CODECS="avc1.4d4015"
lowest.m3u8`;

    it('parses variants with bandwidth, resolution, codecs, quality', () => {
      const result = parseM3u8(masterPlaylist);

      expect(result.isMasterPlaylist).toBe(true);
      expect(result.segments).toEqual([]);
      expect(result.variants).toHaveLength(4);

      const [first, second, third, fourth] = result.variants;
      expect(first.url).toBe('high.m3u8');
      expect(first.bandwidth).toBe(5000000);
      expect(first.resolution).toBe('1920x1080');
      expect(first.codecs).toBe('avc1.640028');

      // first variant = 'highest', last = 'lowest', middle mapped by resolution
      expect(first.quality).toBe('highest');
      expect(second.quality).toBe('720p');
      expect(third.quality).toBe('480p');
      expect(fourth.quality).toBe('lowest');
    });

    it('marks first variant as highest and last as lowest', () => {
      const result = parseM3u8(masterPlaylist);
      expect(result.variants[0].quality).toBe('highest');
      expect(result.variants[result.variants.length - 1].quality).toBe('lowest');
    });

    it('uses auto quality when middle variant resolution cannot be mapped', () => {
      const unknown = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
high.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=1024x768
unknown.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=500000,RESOLUTION=640x360
low.m3u8`;
      const result = parseM3u8(unknown);
      expect(result.variants).toHaveLength(3);
      expect(result.variants[0].quality).toBe('highest');
      expect(result.variants[1].quality).toBe('auto');
      expect(result.variants[2].quality).toBe('lowest');
    });
  });

  describe('empty content', () => {
    it('throws Error on empty string', () => {
      expect(() => parseM3u8('')).toThrow(Error);
    });

    it('throws Error on whitespace-only content', () => {
      expect(() => parseM3u8('   \n  \t ')).toThrow(Error);
    });
  });

  describe('malformed lines', () => {
    it('skips malformed lines gracefully', () => {
      const malformed = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXTINF:9.009,
segment0.ts
this is a malformed line
#EXTINF:9.009,
segment1.ts
#EXT-X-ENDLIST`;

      const result = parseM3u8(malformed);
      expect(result.segments).toHaveLength(2);
      expect(result.segments[0].url).toBe('segment0.ts');
      expect(result.segments[1].url).toBe('segment1.ts');
    });

    it('skips unknown tags', () => {
      const unknownTags = `#EXTM3U
#EXT-X-VERSION:4
#EXT-X-TARGETDURATION:8
#EXT-X-SOME-UNKNOWN-TAG:value
#EXTINF:8.0,
seg.ts
#EXT-X-ENDLIST`;
      const result = parseM3u8(unknownTags);
      expect(result.segments).toHaveLength(1);
      expect(result.targetDuration).toBe(8);
    });
  });

  describe('relative URLs', () => {
    it('resolves relative segment URLs against base URL', () => {
      const media = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXTINF:10.0,
seg/segment0.ts
#EXTINF:10.0,
seg/segment1.ts
#EXT-X-ENDLIST`;

      const result = parseM3u8(media, 'https://example.com/video/playlist.m3u8');
      expect(result.segments[0].url).toBe(
        'https://example.com/video/seg/segment0.ts',
      );
      expect(result.segments[1].url).toBe(
        'https://example.com/video/seg/segment1.ts',
      );
    });

    it('resolves relative variant URLs against base URL', () => {
      const master = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720
720p.m3u8`;

      const result = parseM3u8(master, 'https://cdn.example.com/stream/master.m3u8');
      expect(result.variants[0].url).toBe('https://cdn.example.com/stream/720p.m3u8');
    });

    it('leaves absolute URLs unchanged', () => {
      const media = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXTINF:10.0,
https://cdn.example.com/seg0.ts
#EXT-X-ENDLIST`;

      const result = parseM3u8(media, 'https://example.com/playlist.m3u8');
      expect(result.segments[0].url).toBe('https://cdn.example.com/seg0.ts');
    });
  });

  describe('missing #EXTINF', () => {
    it('skips segment URL when no preceding #EXTINF', () => {
      const noExtinf = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
segment0.ts
#EXTINF:10.0,
segment1.ts
#EXT-X-ENDLIST`;

      const result = parseM3u8(noExtinf);
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].url).toBe('segment1.ts');
    });

    it('skips dangling #EXTINF without following URL', () => {
      const dangling = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXTINF:10.0,
#EXTINF:9.0,
segment1.ts
#EXT-X-ENDLIST`;

      const result = parseM3u8(dangling);
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].url).toBe('segment1.ts');
      expect(result.segments[0].duration).toBe(9.0);
    });
  });
});
