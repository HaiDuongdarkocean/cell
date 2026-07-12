import {
  mapNetflixSubtitleTracks,
  type NetflixSubtitleTrack,
} from '@/features/detection/logic/netflixSubtitleDetector';

const TAB_ID = 42;

function makeTrack(overrides: Partial<NetflixSubtitleTrack> = {}): NetflixSubtitleTrack {
  return {
    trackId: 'T:2:0;1;en;0;0;0;',
    bcp47: 'en',
    displayName: 'English',
    rawTrackType: 'SUBTITLES',
    isNoneTrack: false,
    isForcedNarrative: false,
    isImageBased: false,
    url: 'https://ipv6-c077-sin001-ix.1.oca.nflxvideo.net/?o=1&v=121&e=1783887412&t=abc123',
    ...overrides,
  };
}

describe('mapNetflixSubtitleTracks', () => {
  it('returns [] for empty input', () => {
    expect(mapNetflixSubtitleTracks([], TAB_ID)).toEqual([]);
  });

  it('maps a track to DetectedSubtitle with correct fields', () => {
    const result = mapNetflixSubtitleTracks([makeTrack()], TAB_ID);
    expect(result).toHaveLength(1);
    const sub = result[0];
    expect(sub.format).toBe('ttml');
    expect(sub.language).toBe('en');
    expect(sub.isAsr).toBe(false);
    expect(sub.displayName).toBe('English');
    expect(sub.tabId).toBe(TAB_ID);
    expect(sub.initiator).toBe('https://www.netflix.com/');
    expect(sub.url).toContain('nflxvideo.net');
    expect(typeof sub.id).toBe('string');
    expect(sub.detectedAt).toBeGreaterThan(0);
  });

  it('lowercases BCP-47 language codes', () => {
    const result = mapNetflixSubtitleTracks(
      [makeTrack({ bcp47: 'pt-BR', displayName: 'Português' })],
      TAB_ID,
    );
    expect(result[0].language).toBe('pt-br');
  });

  it('appends [forced] only when not already in description', () => {
    const forcedNew = makeTrack({
      bcp47: 'es-ES',
      displayName: 'Español',
      isForcedNarrative: true,
    });
    const forcedAlready = makeTrack({
      bcp47: 'es-ES',
      displayName: 'Spanish (Forced)',
      isForcedNarrative: true,
    });
    const result = mapNetflixSubtitleTracks([forcedNew, forcedAlready], TAB_ID);
    expect(result[0].displayName).toBe('Español [forced]');
    expect(result[1].displayName).toBe('Spanish (Forced)');
  });

  it('appends -cc suffix for CLOSEDDCAPTIONS rawTrackType', () => {
    const result = mapNetflixSubtitleTracks(
      [makeTrack({ rawTrackType: 'CLOSEDCAPTIONS' })],
      TAB_ID,
    );
    expect(result[0].language).toBe('en-cc');
  });

  it('skips isNoneTrack entries', () => {
    const result = mapNetflixSubtitleTracks(
      [makeTrack({ isNoneTrack: true }), makeTrack({ bcp47: 'vi' })],
      TAB_ID,
    );
    expect(result).toHaveLength(1);
    expect(result[0].language).toBe('vi');
  });

  it('skips isImageBased entries', () => {
    const result = mapNetflixSubtitleTracks(
      [makeTrack({ isImageBased: true }), makeTrack({ bcp47: 'ko' })],
      TAB_ID,
    );
    expect(result).toHaveLength(1);
    expect(result[0].language).toBe('ko');
  });

  it('skips tracks with url === "lazy" (not yet loaded)', () => {
    const result = mapNetflixSubtitleTracks(
      [makeTrack({ url: 'lazy' }), makeTrack({ bcp47: 'vi' })],
      TAB_ID,
    );
    expect(result).toHaveLength(1);
    expect(result[0].language).toBe('vi');
  });

  it('skips tracks with empty url', () => {
    const result = mapNetflixSubtitleTracks(
      [makeTrack({ url: '' }), makeTrack({ bcp47: 'vi' })],
      TAB_ID,
    );
    expect(result).toHaveLength(1);
    expect(result[0].language).toBe('vi');
  });

  it('maps a multi-track list and preserves all valid tracks', () => {
    const tracks = [
      makeTrack({ trackId: 'T:2:0;1;en;0;0;0;', bcp47: 'en', displayName: 'English' }),
      makeTrack({ trackId: 'T:2:0;1;vi;0;0;0;', bcp47: 'vi', displayName: 'Tiếng Việt' }),
      makeTrack({ trackId: 'T:2:0;1;zh-Hans;0;0;0;', bcp47: 'zh-Hans', displayName: '中文（简体）' }),
    ];
    const result = mapNetflixSubtitleTracks(tracks, TAB_ID);
    expect(result).toHaveLength(3);
    expect(result.map((s) => s.language).sort()).toEqual(['en', 'vi', 'zh-hans']);
  });

  it('maps a 33-language-like list including BCP-47 variants', () => {
    const languages = [
      'en', 'vi', 'zh-Hans', 'zh-Hant', 'ko', 'ja', 'fr', 'de', 'es',
      'pt-BR', 'ar', 'ru', 'it', 'pl', 'tr', 'th', 'id', 'ms', 'nl',
      'sv', 'da', 'fi', 'no', 'cs', 'hu', 'el', 'he', 'hi', 'ta',
      'te', 'bn', 'mr', 'ur',
    ];
    const tracks = languages.map((lang, i) =>
      makeTrack({
        trackId: `T:2:0;1;${lang};0;0;0;`,
        bcp47: lang,
        displayName: lang === 'pt-BR' ? 'Português' : lang,
        url: `https://cdn.nflxvideo.net/${i}.ttml`,
      }),
    );
    const result = mapNetflixSubtitleTracks(tracks, TAB_ID);
    expect(result).toHaveLength(languages.length);
    expect(result.map((s) => s.language)).toEqual(
      languages.map((l) => l.toLowerCase()),
    );
  });
});
