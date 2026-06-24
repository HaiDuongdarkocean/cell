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

    it('carries over query params from base URL to relative segment URLs', () => {
      const media = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXTINF:10.0,
seg0.ts
#EXTINF:10.0,
seg1.ts
#EXT-X-ENDLIST`;

      const baseUrl = 'https://streamfree.vip/hls/file.m3u8?vid=abc&hash=xyz&ct=123';
      const result = parseM3u8(media, baseUrl);
      expect(result.segments[0].url).toBe(
        'https://streamfree.vip/hls/seg0.ts?vid=abc&hash=xyz&ct=123',
      );
      expect(result.segments[1].url).toBe(
        'https://streamfree.vip/hls/seg1.ts?vid=abc&hash=xyz&ct=123',
      );
    });

    it('carries over query params from base URL to relative variant URLs', () => {
      const master = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720
720p.m3u8`;

      const baseUrl = 'https://streamfree.vip/hls/master.m3u8?vid=abc&hash=xyz';
      const result = parseM3u8(master, baseUrl);
      expect(result.variants[0].url).toBe(
        'https://streamfree.vip/hls/720p.m3u8?vid=abc&hash=xyz',
      );
    });

    it('does NOT carry over query params when segment URL has its own', () => {
      const media = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXTINF:10.0,
seg0.ts?token=own
#EXT-X-ENDLIST`;

      const baseUrl = 'https://streamfree.vip/hls/file.m3u8?vid=abc&hash=xyz';
      const result = parseM3u8(media, baseUrl);
      expect(result.segments[0].url).toBe(
        'https://streamfree.vip/hls/seg0.ts?token=own',
      );
    });

    it('does NOT carry over query params when base URL has none', () => {
      const media = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXTINF:10.0,
seg0.ts
#EXT-X-ENDLIST`;

      const result = parseM3u8(media, 'https://example.com/playlist.m3u8');
      expect(result.segments[0].url).toBe('https://example.com/seg0.ts');
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

  describe('#EXT-X-KEY (encryption)', () => {
    it('parses AES-128 encryption with URI and IV', () => {
      const media = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-KEY:METHOD=AES-128,URI="key.bin",IV=0x1234567890ABCDEF1234567890ABCDEF
#EXTINF:10.0,
seg0.ts
#EXT-X-ENDLIST`;

      const result = parseM3u8(media, 'https://cdn.example.com/stream/playlist.m3u8');
      expect(result.encryption).toBeDefined();
      expect(result.encryption!.method).toBe('AES-128');
      expect(result.encryption!.keyUri).toBe('https://cdn.example.com/stream/key.bin');
      expect(result.encryption!.iv).toBe('0x1234567890ABCDEF1234567890ABCDEF');
    });

    it('parses AES-128 encryption without IV (IV derived from sequence)', () => {
      const media = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-KEY:METHOD=AES-128,URI="https://cdn.example.com/key.bin"
#EXTINF:10.0,
seg0.ts
#EXT-X-ENDLIST`;

      const result = parseM3u8(media);
      expect(result.encryption).toBeDefined();
      expect(result.encryption!.method).toBe('AES-128');
      expect(result.encryption!.keyUri).toBe('https://cdn.example.com/key.bin');
      expect(result.encryption!.iv).toBeUndefined();
    });

    it('parses METHOD=NONE and clears encryption', () => {
      const media = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-KEY:METHOD=AES-128,URI="key.bin"
#EXT-X-KEY:METHOD=NONE
#EXTINF:10.0,
seg0.ts
#EXT-X-ENDLIST`;

      const result = parseM3u8(media);
      expect(result.encryption).toBeUndefined();
    });

    it('resolves key URI against base URL with query param carry-over', () => {
      const media = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-KEY:METHOD=AES-128,URI="key.bin"
#EXTINF:10.0,
seg0.ts
#EXT-X-ENDLIST`;

      const result = parseM3u8(media, 'https://streamfree.vip/hls/playlist.m3u8?vid=abc&hash=xyz');
      expect(result.encryption!.keyUri).toBe('https://streamfree.vip/hls/key.bin?vid=abc&hash=xyz');
    });

    it('parses unknown encryption method (SAMPLE-AES) without crashing', () => {
      const media = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-KEY:METHOD=SAMPLE-AES,URI="key.bin"
#EXTINF:10.0,
seg0.ts
#EXT-X-ENDLIST`;

      const result = parseM3u8(media, 'https://example.com/playlist.m3u8');
      expect(result.encryption).toBeDefined();
      expect(result.encryption!.method).toBe('SAMPLE-AES');
    });
  });

  describe('#EXT-X-MAP (fMP4 init segment)', () => {
    it('parses init segment URI', () => {
      const media = `#EXTM3U
#EXT-X-VERSION:6
#EXT-X-TARGETDURATION:10
#EXT-X-MAP:URI="init.mp4"
#EXTINF:10.0,
seg0.m4s
#EXT-X-ENDLIST`;

      const result = parseM3u8(media, 'https://cdn.example.com/stream/playlist.m3u8');
      expect(result.initSegment).toBeDefined();
      expect(result.initSegment!.uri).toBe('https://cdn.example.com/stream/init.mp4');
      expect(result.initSegment!.byteRange).toBeUndefined();
    });

    it('parses init segment with byte range', () => {
      const media = `#EXTM3U
#EXT-X-VERSION:6
#EXT-X-TARGETDURATION:10
#EXT-X-MAP:URI="init.mp4",BYTERANGE="1000@0"
#EXTINF:10.0,
seg0.m4s
#EXT-X-ENDLIST`;

      const result = parseM3u8(media, 'https://cdn.example.com/stream/playlist.m3u8');
      expect(result.initSegment!.byteRange).toEqual({ length: 1000, offset: 0 });
    });

    it('resolves init segment URI with query param carry-over', () => {
      const media = `#EXTM3U
#EXT-X-VERSION:6
#EXT-X-TARGETDURATION:10
#EXT-X-MAP:URI="init.mp4"
#EXTINF:10.0,
seg0.m4s
#EXT-X-ENDLIST`;

      const result = parseM3u8(media, 'https://streamfree.vip/hls/playlist.m3u8?token=abc');
      expect(result.initSegment!.uri).toBe('https://streamfree.vip/hls/init.mp4?token=abc');
    });
  });

  describe('#EXT-X-BYTERANGE', () => {
    it('attaches byte range to next segment with explicit offset', () => {
      const media = `#EXTM3U
#EXT-X-VERSION:6
#EXT-X-TARGETDURATION:10
#EXTINF:10.0,
#EXT-X-BYTERANGE:1000000@500000
seg0.ts
#EXT-X-ENDLIST`;

      const result = parseM3u8(media);
      expect(result.segments[0].byteRange).toEqual({ length: 1000000, offset: 500000 });
    });

    it('attaches byte range without offset (offset = previous segment end)', () => {
      const media = `#EXTM3U
#EXT-X-VERSION:6
#EXT-X-TARGETDURATION:10
#EXTINF:10.0,
#EXT-X-BYTERANGE:1000000@0
seg0.ts
#EXTINF:10.0,
#EXT-X-BYTERANGE:500000
seg1.ts
#EXT-X-ENDLIST`;

      const result = parseM3u8(media);
      expect(result.segments[0].byteRange).toEqual({ length: 1000000, offset: 0 });
      expect(result.segments[1].byteRange).toEqual({ length: 500000, offset: undefined });
    });
  });

  describe('#EXT-X-DISCONTINUITY', () => {
    it('marks next segment with discontinuity flag', () => {
      const media = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXTINF:10.0,
content.ts
#EXT-X-DISCONTINUITY
#EXTINF:5.0,
ad.ts
#EXT-X-DISCONTINUITY
#EXTINF:10.0,
content2.ts
#EXT-X-ENDLIST`;

      const result = parseM3u8(media);
      expect(result.segments).toHaveLength(3);
      expect(result.segments[0].discontinuity).toBeUndefined();
      expect(result.segments[1].discontinuity).toBe(true);
      expect(result.segments[2].discontinuity).toBe(true);
    });
  });

  describe('#EXT-X-ENDLIST', () => {
    it('sets hasEndlist to true when present (VOD)', () => {
      const media = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXTINF:10.0,
seg0.ts
#EXT-X-ENDLIST`;

      const result = parseM3u8(media);
      expect(result.hasEndlist).toBe(true);
    });

    it('sets hasEndlist to false when absent (LIVE)', () => {
      const media = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXTINF:10.0,
seg0.ts`;

      const result = parseM3u8(media);
      expect(result.hasEndlist).toBe(false);
    });
  });
});
