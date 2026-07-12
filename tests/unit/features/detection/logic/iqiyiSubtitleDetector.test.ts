import {
  mapIqiyiSubtitleTracks,
  extractIqiyiStl,
  buildSrtUrl,
  type IqiyiSubtitleTrack,
} from '@/features/detection/logic/iqiyiSubtitleDetector';

const ORIGIN = 'https://meta.video.iqiyi.com';

function makeTrack(overrides: Partial<IqiyiSubtitleTrack> = {}): IqiyiSubtitleTrack {
  return {
    _name: 'Vietnamese',
    lid: 23,
    ss: 0,
    srt: '/20260115/6c/7b/c112abc.srt?qd_tm=1783806770187',
    ...overrides,
  };
}

/** Build a minimal `playerObject` with the deep `stl` path. */
function makePlayerObject(stl: unknown, extra?: Record<string, unknown>): unknown {
  return {
    package: {
      engine: {
        movieinfo: {
          current: {
            originalData: {
              data: {
                program: { stl, ...extra },
                dstl: 'http://meta.video.iqiyi.com',
                tvid: '1148400684481200',
              },
            },
          },
        },
      },
    },
  };
}

describe('extractIqiyiStl', () => {
  it('returns [] for undefined playerObject', () => {
    expect(extractIqiyiStl(undefined)).toEqual([]);
  });

  it('returns [] for null playerObject', () => {
    expect(extractIqiyiStl(null)).toEqual([]);
  });

  it('returns [] for non-object playerObject', () => {
    expect(extractIqiyiStl('string')).toEqual([]);
  });

  it('returns [] when deep path is missing (no package)', () => {
    expect(extractIqiyiStl({})).toEqual([]);
  });

  it('returns [] when stl is not an array', () => {
    expect(extractIqiyiStl(makePlayerObject(null))).toEqual([]);
  });

  it('returns [] when stl array is empty', () => {
    expect(extractIqiyiStl(makePlayerObject([]))).toEqual([]);
  });

  it('filters out malformed entries (missing srt or lid)', () => {
    const stl = [
      makeTrack(),
      { _name: 'bad', lid: 3 }, // missing srt
      { _name: 'bad', srt: '/x.srt' }, // missing lid
      { _name: 'bad', lid: '3', srt: '/x.srt' }, // lid not number
      null,
      'string',
    ];
    const result = extractIqiyiStl(makePlayerObject(stl));
    expect(result).toHaveLength(1);
    expect(result[0]._name).toBe('Vietnamese');
  });

  it('returns valid stl array as-is (filtered)', () => {
    const stl = [makeTrack({ _name: 'English', lid: 3 }), makeTrack()];
    const result = extractIqiyiStl(makePlayerObject(stl));
    expect(result).toHaveLength(2);
    expect(result[0]._name).toBe('English');
    expect(result[1]._name).toBe('Vietnamese');
  });
});

describe('buildSrtUrl', () => {
  it('resolves relative path against origin', () => {
    const url = buildSrtUrl(makeTrack(), ORIGIN);
    expect(url).toBe(`${ORIGIN}/20260115/6c/7b/c112abc.srt?qd_tm=1783806770187`);
  });

  it('handles origin with trailing slash (no double slash)', () => {
    const url = buildSrtUrl(makeTrack(), `${ORIGIN}/`);
    expect(url).toBe(`${ORIGIN}/20260115/6c/7b/c112abc.srt?qd_tm=1783806770187`);
    expect(url).not.toContain('//2026');
  });

  it('returns srt as-is when origin is malformed (graceful)', () => {
    const track = makeTrack();
    expect(buildSrtUrl(track, ':::not-a-url:::')).toBe(track.srt);
  });
});

describe('mapIqiyiSubtitleTracks', () => {
  it('returns [] for empty input', () => {
    expect(mapIqiyiSubtitleTracks([], 1, ORIGIN)).toEqual([]);
  });

  it('maps a single human track (ss:0) correctly', () => {
    const result = mapIqiyiSubtitleTracks([makeTrack()], 42, ORIGIN);
    expect(result).toHaveLength(1);
    const sub = result[0];
    expect(sub.format).toBe('srt');
    expect(sub.language).toBe('vi');
    expect(sub.isAsr).toBe(false);
    expect(sub.displayName).toBe('Vietnamese');
    expect(sub.tabId).toBe(42);
    expect(sub.initiator).toBe('https://www.iq.com/');
    expect(sub.url).toBe(`${ORIGIN}/20260115/6c/7b/c112abc.srt?qd_tm=1783806770187`);
    expect(typeof sub.id).toBe('string');
    expect(sub.detectedAt).toBeGreaterThan(0);
  });

  it('maps a single AI track (ss:1) → isAsr: true', () => {
    const result = mapIqiyiSubtitleTracks(
      [makeTrack({ _name: 'French', lid: 6, ss: 1 })],
      1,
      ORIGIN,
    );
    expect(result).toHaveLength(1);
    expect(result[0].isAsr).toBe(true);
    expect(result[0].language).toBe('fr');
    expect(result[0].displayName).toBe('French');
  });

  it('skips unknown lid + warns (graceful degradation)', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = mapIqiyiSubtitleTracks(
      [makeTrack({ _name: 'Unknown', lid: 999 }), makeTrack()],
      1,
      ORIGIN,
    );
    expect(result).toHaveLength(1);
    expect(result[0].language).toBe('vi');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('unknown lid: 999'),
    );
    warnSpy.mockRestore();
  });

  it('maps all 12 known languages correctly', () => {
    const tracks: IqiyiSubtitleTrack[] = [
      makeTrack({ _name: '简体中文', lid: 1 }),
      makeTrack({ _name: '繁體中文', lid: 2 }),
      makeTrack({ _name: 'English', lid: 3 }),
      makeTrack({ _name: '한국어', lid: 4 }),
      makeTrack({ _name: '日本語', lid: 5 }),
      makeTrack({ _name: 'Français', lid: 6, ss: 1 }),
      makeTrack({ _name: 'ภาษาไทย', lid: 18 }),
      makeTrack({ _name: 'Bahasa Malaysia', lid: 21 }),
      makeTrack({ _name: 'Tiếng Việt', lid: 23 }),
      makeTrack({ _name: 'Bahasa Indonesia', lid: 24 }),
      makeTrack({ _name: 'Español', lid: 26, ss: 1 }),
      makeTrack({ _name: 'Deutsch', lid: 30, ss: 1 }),
    ];
    const result = mapIqiyiSubtitleTracks(tracks, 1, ORIGIN);
    expect(result).toHaveLength(12);
    expect(result.map((s) => s.language).sort()).toEqual(
      [
        'zh-hans',
        'zh-hant',
        'en',
        'ko',
        'ja',
        'fr',
        'th',
        'ms',
        'vi',
        'id',
        'es',
        'de',
      ].sort(),
    );
    // AI tracks (FR, ES, DE)
    const ai = result.filter((s) => s.isAsr);
    expect(ai.map((s) => s.language).sort()).toEqual(['de', 'es', 'fr']);
  });

  it('uses new URL() resolution (no double slash with trailing-slash origin)', () => {
    const result = mapIqiyiSubtitleTracks([makeTrack()], 1, `${ORIGIN}/`);
    expect(result[0].url).toBe(`${ORIGIN}/20260115/6c/7b/c112abc.srt?qd_tm=1783806770187`);
  });
});
