import { detectSubtitle } from '@/features/detection/logic/subtitleDetector';
import type { NetworkRequest } from '@/types/media';

function makeRequest(url: string, tabId = 1): NetworkRequest {
  return {
    url,
    method: 'GET',
    tabId,
    type: 'xmlhttprequest',
    timeStamp: 1000,
  };
}

describe('detectSubtitle', () => {
  it('detects .ass URL and returns DetectedSubtitle with format="ass"', () => {
    const request = makeRequest('https://example.com/subtitles/movie.ass');
    const result = detectSubtitle(request);

    expect(result).not.toBeNull();
    expect(result?.format).toBe('ass');
    expect(result?.url).toBe('https://example.com/subtitles/movie.ass');
    expect(result?.tabId).toBe(1);
    expect(result?.detectedAt).toBe(1000);
    expect(typeof result?.id).toBe('string');
    expect(result?.id.length).toBeGreaterThan(0);
  });

  it('detects .vtt URL and returns DetectedSubtitle with format="vtt"', () => {
    const request = makeRequest('https://example.com/subtitles/movie.vtt');
    const result = detectSubtitle(request);

    expect(result).not.toBeNull();
    expect(result?.format).toBe('vtt');
  });

  it('detects .srt URL and returns DetectedSubtitle with format="srt"', () => {
    const request = makeRequest('https://example.com/subtitles/movie.srt');
    const result = detectSubtitle(request);

    expect(result).not.toBeNull();
    expect(result?.format).toBe('srt');
  });

  it('returns null for a non-subtitle URL', () => {
    const request = makeRequest('https://example.com/video/movie.mp4');
    const result = detectSubtitle(request);

    expect(result).toBeNull();
  });

  // Regression: anime.nexus serves `.../stream/thumbnails.vtt` (seek preview,
  // cues = image URLs) and `.../stream/cues.vtt` (chapter marker, 1 cue
  // "Episode" spanning the full duration) — neither is a subtitle. Without
  // the guard, both are detected as subtitles, language-detected as English
  // (URLs/words contain English), and selected over the real ASS track by
  // findSubtitlesForOverlay → ASS never auto-loads.
  it('returns null for thumbnail preview VTT (thumbnails.vtt)', () => {
    const request = makeRequest(
      'https://api.anime.nexus/api/anime/video/019f573c-c039-739b-ae4c-ddaea828b4b3/stream/thumbnails.vtt',
    );
    const result = detectSubtitle(request);
    expect(result).toBeNull();
  });

  it('returns null for chapter/episode marker VTT (cues.vtt)', () => {
    const request = makeRequest(
      'https://api.anime.nexus/api/anime/video/019f41fb-a078-7052-aba7-169fbe679565/stream/cues.vtt',
    );
    const result = detectSubtitle(request);
    expect(result).toBeNull();
  });

  it('returns null for storyboard/chapter/preview VTT previews', () => {
    expect(detectSubtitle(makeRequest('https://example.com/stream/storyboard.vtt'))).toBeNull();
    expect(detectSubtitle(makeRequest('https://example.com/stream/chapters.vtt'))).toBeNull();
    expect(detectSubtitle(makeRequest('https://example.com/stream/preview.vtt'))).toBeNull();
  });

  it('still detects a real subtitle.vtt that contains "subtitle" in the path', () => {
    // "subtitle" contains "subtitle" not "thumbnail/storyboard/chapter/preview/cues"
    // — guard must not over-match. Real subtitle URLs with /subtitles/ path
    // are still detected.
    const request = makeRequest('https://example.com/subtitles/movie.vtt');
    const result = detectSubtitle(request);
    expect(result).not.toBeNull();
    expect(result?.format).toBe('vtt');
  });

  it('extracts language from filename pattern "movie.en.srt"', () => {
    const request = makeRequest('https://example.com/subtitles/movie.en.srt');
    const result = detectSubtitle(request);

    expect(result).not.toBeNull();
    expect(result?.language).toBe('en');
  });

  it('extracts language from filename pattern "movie.vi.vtt"', () => {
    const request = makeRequest('https://example.com/subtitles/movie.vi.vtt');
    const result = detectSubtitle(request);

    expect(result).not.toBeNull();
    expect(result?.language).toBe('vi');
  });

  it('extracts language from URL path "/subtitles/en/movie.srt"', () => {
    const request = makeRequest('https://example.com/subtitles/en/movie.srt');
    const result = detectSubtitle(request);

    expect(result).not.toBeNull();
    expect(result?.language).toBe('en');
  });

  it('extracts primary subtag from BCP 47 filename "movie.en-US.srt"', () => {
    const request = makeRequest('https://example.com/subtitles/movie.en-US.srt');
    const result = detectSubtitle(request);
    expect(result).not.toBeNull();
    expect(result?.language).toBe('en');
  });

  it('extracts primary subtag from BCP 47 filename "movie.zh-Hans.vtt"', () => {
    const request = makeRequest('https://example.com/subtitles/movie.zh-Hans.vtt');
    const result = detectSubtitle(request);
    expect(result).not.toBeNull();
    expect(result?.language).toBe('zh');
  });

  it('extracts primary subtag from BCP 47 filename "movie.pt-BR.srt"', () => {
    const request = makeRequest('https://example.com/subtitles/movie.pt-BR.srt');
    const result = detectSubtitle(request);
    expect(result).not.toBeNull();
    expect(result?.language).toBe('pt');
  });

  it('extracts primary subtag from BCP 47 path "/subs/ar-EG/movie.srt"', () => {
    const request = makeRequest('https://example.com/subs/ar-EG/movie.srt');
    const result = detectSubtitle(request);
    expect(result).not.toBeNull();
    expect(result?.language).toBe('ar');
  });

  it('extracts language from display-name filename "English - English [SDH].vtt"', () => {
    const request = makeRequest(
      'https://example.com/English%20-%20English%20%5BSDH%5D.vtt',
    );
    const result = detectSubtitle(request);

    expect(result).not.toBeNull();
    expect(result?.language).toBe('en');
  });

  it('extracts language from vidnest English - English [SDH].vtt URL', () => {
    const request = makeRequest(
      'https://cache.vdrk.site/v3/tv/125988/1/3/English%20-%20English%20%5BSDH%5D.vtt',
    );
    const result = detectSubtitle(request);

    expect(result).not.toBeNull();
    expect(result?.language).toBe('en');
  });

  it('defaults language to "unknown" when language cannot be detected', () => {
    const request = makeRequest('https://example.com/movie.srt');
    const result = detectSubtitle(request);

    expect(result).not.toBeNull();
    expect(result?.language).toBe('unknown');
  });

  it('still detects subtitle correctly when URL has a query string', () => {
    const request = makeRequest(
      'https://example.com/subtitles/movie.en.srt?token=abc123&t=2',
    );
    const result = detectSubtitle(request);

    expect(result).not.toBeNull();
    expect(result?.format).toBe('srt');
    expect(result?.language).toBe('en');
    expect(result?.url).toBe(
      'https://example.com/subtitles/movie.en.srt?token=abc123&t=2',
    );
  });

  it('generates unique IDs across multiple calls', () => {
    const request = makeRequest('https://example.com/movie.srt');
    const result1 = detectSubtitle(request);
    const result2 = detectSubtitle(request);

    expect(result1).not.toBeNull();
    expect(result2).not.toBeNull();
    expect(result1?.id).not.toBe(result2?.id);
  });

  it('defaults to vtt format when the URL matches a subtitle pattern via query string but has no subtitle extension in its path', () => {
    // The ".ass" appears in the query string, so the URL pattern matches.
    // detectFormat now falls back to 'vtt' when no extension is found in the
    // pathname but the URL matched subtitle patterns.
    const request = makeRequest('https://example.com/page?url=sub.ass');
    const result = detectSubtitle(request);
    expect(result).not.toBeNull();
    expect(result?.format).toBe('vtt');
  });

  it('defaults language to "unknown" when the filename suffix is not a language code', () => {
    // "movie.123.srt": parts.length >= 2 but "123" fails the language pattern,
    // and the path segment "example.com" also fails, so it falls back to unknown.
    const request = makeRequest('https://example.com/movie.123.srt');
    const result = detectSubtitle(request);

    expect(result).not.toBeNull();
    expect(result?.language).toBe('unknown');
  });

  it('defaults language to "unknown" for a relative URL with no path segments', () => {
    // "movie.srt" matches the pattern and has a valid extension, but there are
    // fewer than 2 path segments, so neither language-detection branch matches.
    const request = makeRequest('movie.srt');
    const result = detectSubtitle(request);

    expect(result).not.toBeNull();
    expect(result?.format).toBe('srt');
    expect(result?.language).toBe('unknown');
  });

  // Regression: kisskh.co subtitle URL `/sub/<hash>.srt` — the path segment
  // "sub" matches the BCP47 shape (3 letters) but is a folder name, not a
  // language code. Without ISO 639 validation, extractLanguage returned "sub",
  // which is neither a real language nor "unknown", so
  // resolveUnknownSubtitleLanguages never fired and auto-load failed.
  it('rejects folder-name path segment "sub" as language (kisskh.co regression)', () => {
    const request = makeRequest('https://sub.cdnvideo11.shop/sub/xbnp1w4q.srt');
    const result = detectSubtitle(request);

    expect(result).not.toBeNull();
    expect(result?.format).toBe('srt');
    expect(result?.language).toBe('unknown');
  });

  it('rejects folder-name path segment "vid" as language (3-letter non-language)', () => {
    const request = makeRequest('https://cdn.example.com/vid/movie.en.srt');
    const result = detectSubtitle(request);

    expect(result).not.toBeNull();
    // "en" in filename is valid → should still extract from filename
    expect(result?.language).toBe('en');
  });

  it('rejects folder-name path segment "api" when filename has no language', () => {
    const request = makeRequest('https://api.example.com/api/abc123.srt');
    const result = detectSubtitle(request);

    expect(result).not.toBeNull();
    expect(result?.language).toBe('unknown');
  });

  describe('generateId fallback', () => {
    it('uses the timestamp+random fallback when crypto.randomUUID is unavailable', () => {
      const realRandomUUID = crypto.randomUUID;
      Object.defineProperty(crypto, 'randomUUID', {
        value: undefined,
        configurable: true,
      });

      try {
        const request = makeRequest('https://example.com/movie.srt');
        const result = detectSubtitle(request);

        expect(result).not.toBeNull();
        expect(typeof result?.id).toBe('string');
        expect(result?.id).not.toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        );
      } finally {
        Object.defineProperty(crypto, 'randomUUID', {
          value: realRandomUUID,
          configurable: true,
        });
      }
    });
  });

  describe('trustAsSubtitle option', () => {
    // Regression: anikage.cc serves subtitles from
    // `prox.anicore.tv/stream/<base64-hash>` — no file extension, no
    // `/subtitles|subs|caption|cc/` path segment, no format query param. The
    // URL is indistinguishable from a video segment URL by shape. The page
    // scanner reads the `<track kind="subtitles">` element and trusts its
    // semantics, passing `trustAsSubtitle: true` to bypass the URL-pattern
    // check. The NON_SUBTITLE_KEYWORDS guard still runs.
    it('detects an extension-less <track>-origin URL when trustAsSubtitle=true (anikage.cc regression)', () => {
      const url =
        'https://prox.anicore.tv/stream/CQQGHwtDHR9RUg9eEwERA1NCUxgSBB0dHVZBRVBCCAQeCgtWAVQdVQNfQQsbGw';
      const request = makeRequest(url);
      // Without the flag: URL pattern check fails → null.
      expect(detectSubtitle(request)).toBeNull();
      // With the flag: pattern check bypassed → detected, format defaults to vtt.
      const result = detectSubtitle(request, { trustAsSubtitle: true });
      expect(result).not.toBeNull();
      expect(result?.url).toBe(url);
      expect(result?.format).toBe('vtt');
      expect(result?.language).toBe('unknown');
    });

    it('still rejects thumbnail/chapter VTT previews even with trustAsSubtitle=true', () => {
      // NON_SUBTITLE_KEYWORDS guard runs regardless of trustAsSubtitle — a
      // `<track>` named "thumbnails" is a seek-preview, not a subtitle.
      expect(
        detectSubtitle(makeRequest('https://example.com/stream/thumbnails.vtt'), {
          trustAsSubtitle: true,
        }),
      ).toBeNull();
      expect(
        detectSubtitle(makeRequest('https://example.com/stream/cues.vtt'), {
          trustAsSubtitle: true,
        }),
      ).toBeNull();
    });

    it('rejects a <track> whose displayName contains a non-subtitle keyword', () => {
      // A player may create a <track src="blob:..." label="Thumbnails">. The
      // URL is a generic blob and carries no keyword, so the label/displayName
      // must be the rejection signal.
      const url = 'blob:https://example.com/abc-123';
      const request = makeRequest(url);
      const result = detectSubtitle(request, {
        trustAsSubtitle: true,
        language: 'en',
        displayName: 'Thumbnails',
      });
      expect(result).toBeNull();
    });

    it('trustAsSubtitle does not change behavior for URLs that already match patterns', () => {
      const url = 'https://example.com/subs/en.vtt';
      const withoutFlag = detectSubtitle(makeRequest(url));
      const withFlag = detectSubtitle(makeRequest(url), { trustAsSubtitle: true });
      expect(withoutFlag).not.toBeNull();
      expect(withFlag).not.toBeNull();
      expect(withFlag?.url).toBe(withoutFlag?.url);
      expect(withFlag?.format).toBe(withoutFlag?.format);
      expect(withFlag?.language).toBe(withoutFlag?.language);
    });

    it('rejects blob: URLs by default and accepts them when trustAsSubtitle=true with track metadata', () => {
      const url = 'blob:https://onzload.com/abc-123';
      const request = makeRequest(url);
      expect(detectSubtitle(request)).toBeNull();
      const result = detectSubtitle(request, {
        trustAsSubtitle: true,
        language: 'vi',
        displayName: 'Tiếng Việt',
      });
      expect(result).not.toBeNull();
      expect(result?.url).toBe(url);
      expect(result?.format).toBe('vtt');
      expect(result?.language).toBe('vi');
      expect(result?.displayName).toBe('Tiếng Việt');
    });
  });

  describe('Stremio addon listing rejection (ADR-036)', () => {
    // torrentio (Stremio addon) serves a JSON listing of subtitle URLs at
    // `/api/v1/<type>/subtitles/<id>` — NOT a subtitle file. Without the
    // guard, `/subtitles/` in the path matches SUBTITLE_URL_PATTERNS → the
    // extension fetches JSON, tries parseVtt → "missing WEBVTT header" →
    // download fails at 50%.
    it('returns null for torrentio Stremio addon listing URL', () => {
      const url = 'https://stream.torrentio.to/api/v1/tmdb/subtitles/tt37287335';
      expect(detectSubtitle(makeRequest(url))).toBeNull();
    });

    it('returns null for Stremio listing URL even with trustAsSubtitle=true', () => {
      // Even when the caller trusts the URL as a subtitle (e.g. from a
      // <track> element), a Stremio listing URL is JSON, not a subtitle file.
      const url = 'https://stream.torrentio.to/api/v1/tmdb/subtitles/tt37287335';
      expect(detectSubtitle(makeRequest(url), { trustAsSubtitle: true })).toBeNull();
    });

    it('returns null for Stremio listing URL with query params', () => {
      const url =
        'https://stream.torrentio.to/api/v1/tmdb/subtitles/tt37287335?videoHash=abc&videoSize=1000000';
      expect(detectSubtitle(makeRequest(url))).toBeNull();
    });

    it('does NOT reject regular subtitle URLs with /subtitles/ path segment', () => {
      // Regular subtitle CDNs use /subtitles/ as a path segment but serve
      // actual subtitle files — these must still be detected.
      const url = 'https://example.com/subtitles/movie.en.srt';
      expect(detectSubtitle(makeRequest(url))).not.toBeNull();
    });
  });
});
