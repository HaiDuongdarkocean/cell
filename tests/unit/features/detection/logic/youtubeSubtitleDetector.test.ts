import {
  mapYouTubeCaptionTracks,
  extractCaptionTracks,
  buildVttUrl,
  requiresPoToken,
  type YouTubeCaptionTrack,
} from '@/features/detection/logic/youtubeSubtitleDetector';

function makeTrack(overrides: Partial<YouTubeCaptionTrack> = {}): YouTubeCaptionTrack {
  return {
    baseUrl: 'https://www.youtube.com/api/timedtext?v=abc&lang=en&sig=xyz',
    languageCode: 'en',
    ...overrides,
  };
}

describe('buildVttUrl', () => {
  it('appends &fmt=vtt when baseUrl already has query params', () => {
    const url = buildVttUrl('https://www.youtube.com/api/timedtext?v=abc&lang=en');
    expect(url).toBe('https://www.youtube.com/api/timedtext?v=abc&lang=en&fmt=vtt');
  });

  it('appends ?fmt=vtt when baseUrl has no query params', () => {
    const url = buildVttUrl('https://www.youtube.com/api/timedtext');
    expect(url).toBe('https://www.youtube.com/api/timedtext?fmt=vtt');
  });

  it('strips xosf param (yt-dlp #13654 — damaged subtitles)', () => {
    const url = buildVttUrl(
      'https://www.youtube.com/api/timedtext?v=abc&xosf=1&lang=en',
    );
    expect(url).not.toContain('xosf');
    expect(url).toContain('fmt=vtt');
    expect(url).toContain('v=abc');
    expect(url).toContain('lang=en');
  });

  it('preserves other params (signature, pot token) after stripping xosf', () => {
    const url = buildVttUrl(
      'https://www.youtube.com/api/timedtext?v=abc&pot=token123&xosf=1&lang=en',
    );
    expect(url).toContain('pot=token123');
    expect(url).not.toContain('xosf');
  });

  it('strips existing fmt param (ANDROID client uses fmt=srv3)', () => {
    const url = buildVttUrl(
      'https://www.youtube.com/api/timedtext?v=abc&fmt=srv3&lang=en',
    );
    expect(url).not.toContain('fmt=srv3');
    expect(url).toContain('fmt=vtt');
    expect(url).toContain('v=abc');
    expect(url).toContain('lang=en');
  });

  it('replaces fmt=srv3 with fmt=vtt preserving all other params', () => {
    const url = buildVttUrl(
      'https://www.youtube.com/api/timedtext?v=abc&ei=xyz&fmt=srv3&signature=abc123&lang=en',
    );
    expect(url).not.toContain('fmt=srv3');
    expect(url).toContain('fmt=vtt');
    expect(url).toContain('signature=abc123');
    expect(url).toContain('ei=xyz');
  });
});

describe('requiresPoToken', () => {
  it('returns true when exp param contains xpe', () => {
    expect(
      requiresPoToken('https://www.youtube.com/api/timedtext?v=abc&exp=xpe'),
    ).toBe(true);
  });

  it('returns true when exp param contains xpv', () => {
    expect(
      requiresPoToken('https://www.youtube.com/api/timedtext?v=abc&exp=xpv'),
    ).toBe(true);
  });

  it('returns true when exp param contains xpe in comma-separated list', () => {
    expect(
      requiresPoToken('https://www.youtube.com/api/timedtext?v=abc&exp=foo,xpe,bar'),
    ).toBe(true);
  });

  it('returns false when exp param does not contain xpe or xpv', () => {
    expect(
      requiresPoToken('https://www.youtube.com/api/timedtext?v=abc&exp=foo,bar'),
    ).toBe(false);
  });

  it('returns false when exp param is absent', () => {
    expect(
      requiresPoToken('https://www.youtube.com/api/timedtext?v=abc&lang=en'),
    ).toBe(false);
  });

  it('returns false for invalid URL', () => {
    expect(requiresPoToken('not-a-url')).toBe(false);
  });
});

describe('extractCaptionTracks', () => {
  it('extracts captionTracks from a well-formed playerResponse', () => {
    const playerResponse = {
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [
            makeTrack({ languageCode: 'en' }),
            makeTrack({ languageCode: 'vi', kind: 'asr' }),
          ],
        },
      },
    };
    const tracks = extractCaptionTracks(playerResponse);
    expect(tracks).toHaveLength(2);
    expect(tracks[0].languageCode).toBe('en');
    expect(tracks[1].languageCode).toBe('vi');
  });

  it('returns [] when captions is missing', () => {
    expect(extractCaptionTracks({})).toEqual([]);
  });

  it('returns [] when playerCaptionsTracklistRenderer is missing', () => {
    expect(extractCaptionTracks({ captions: {} })).toEqual([]);
  });

  it('returns [] when captionTracks is not an array', () => {
    expect(
      extractCaptionTracks({
        captions: { playerCaptionsTracklistRenderer: { captionTracks: null } },
      }),
    ).toEqual([]);
  });

  it('filters out tracks missing baseUrl or languageCode', () => {
    const playerResponse = {
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [
            makeTrack({ languageCode: 'en' }),
            { languageCode: 'vi' }, // missing baseUrl
            { baseUrl: 'https://x' }, // missing languageCode
            'not-an-object',
            null,
          ],
        },
      },
    };
    const tracks = extractCaptionTracks(playerResponse);
    expect(tracks).toHaveLength(1);
    expect(tracks[0].languageCode).toBe('en');
  });

  it('returns [] for non-object input', () => {
    expect(extractCaptionTracks(null)).toEqual([]);
    expect(extractCaptionTracks('string')).toEqual([]);
    expect(extractCaptionTracks(undefined)).toEqual([]);
  });
});

describe('mapYouTubeCaptionTracks', () => {
  it('maps a manual caption track to DetectedSubtitle with format=vtt', () => {
    const tracks = [makeTrack({ languageCode: 'en' })];
    const result = mapYouTubeCaptionTracks(tracks, 42);

    expect(result).toHaveLength(1);
    expect(result[0].format).toBe('vtt');
    expect(result[0].language).toBe('en');
    expect(result[0].tabId).toBe(42);
    expect(result[0].url).toContain('fmt=vtt');
    expect(result[0].isAsr).toBe(false);
    expect(typeof result[0].id).toBe('string');
    expect(result[0].id.length).toBeGreaterThan(0);
  });

  it('sets isAsr=true for kind="asr" tracks', () => {
    const tracks = [makeTrack({ languageCode: 'en', kind: 'asr' })];
    const result = mapYouTubeCaptionTracks(tracks, 1);

    expect(result).toHaveLength(1);
    expect(result[0].isAsr).toBe(true);
  });

  it('sets isAsr=false when kind is absent (manual captions)', () => {
    const tracks = [makeTrack({ languageCode: 'en' })];
    const result = mapYouTubeCaptionTracks(tracks, 1);

    expect(result[0].isAsr).toBe(false);
  });

  it('sets displayName from name.simpleText', () => {
    const tracks = [
      makeTrack({
        languageCode: 'en',
        name: { simpleText: 'English (auto-generated)' },
        kind: 'asr',
      }),
    ];
    const result = mapYouTubeCaptionTracks(tracks, 1);

    expect(result[0].displayName).toBe('English (auto-generated)');
  });

  it('falls back to uppercase languageCode when name.simpleText is absent', () => {
    const tracks = [makeTrack({ languageCode: 'en' })];
    const result = mapYouTubeCaptionTracks(tracks, 1);

    expect(result[0].displayName).toBe('EN');
  });

  it('falls back to uppercase languageCode when name.simpleText is empty', () => {
    const tracks = [makeTrack({ languageCode: 'vi', name: { simpleText: '   ' } })];
    const result = mapYouTubeCaptionTracks(tracks, 1);

    expect(result[0].displayName).toBe('VI');
  });

  it('lowercases the language code', () => {
    const tracks = [makeTrack({ languageCode: 'EN-US' })];
    const result = mapYouTubeCaptionTracks(tracks, 1);

    expect(result[0].language).toBe('en-us');
  });

  it('skips tracks requiring PO Token (exp=xpe) and warns', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const tracks = [
      makeTrack({
        languageCode: 'en',
        baseUrl: 'https://www.youtube.com/api/timedtext?v=abc&exp=xpe&lang=en',
      }),
    ];
    const result = mapYouTubeCaptionTracks(tracks, 1);

    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('PO Token'),
    );
    warnSpy.mockRestore();
  });

  it('skips PO Token tracks but keeps non-pot tracks', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const tracks = [
      makeTrack({
        languageCode: 'en',
        baseUrl: 'https://www.youtube.com/api/timedtext?v=abc&exp=xpe&lang=en',
      }),
      makeTrack({ languageCode: 'vi', baseUrl: 'https://x?lang=vi' }),
    ];
    const result = mapYouTubeCaptionTracks(tracks, 1);

    expect(result).toHaveLength(1);
    expect(result[0].language).toBe('vi');
    warnSpy.mockRestore();
  });

  it('returns [] for empty input', () => {
    expect(mapYouTubeCaptionTracks([], 1)).toEqual([]);
  });

  it('handles manual + ASR tracks for the same language (both kept)', () => {
    const tracks = [
      makeTrack({ languageCode: 'en', name: { simpleText: 'English' } }),
      makeTrack({
        languageCode: 'en',
        kind: 'asr',
        name: { simpleText: 'English (auto-generated)' },
      }),
    ];
    const result = mapYouTubeCaptionTracks(tracks, 1);

    expect(result).toHaveLength(2);
    expect(result[0].isAsr).toBe(false);
    expect(result[0].displayName).toBe('English');
    expect(result[1].isAsr).toBe(true);
    expect(result[1].displayName).toBe('English (auto-generated)');
  });
});
