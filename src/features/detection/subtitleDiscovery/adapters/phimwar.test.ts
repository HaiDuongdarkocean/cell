import { createPhimwarAdapter, parsePhimwarGetSubtitles } from './phimwar';
import type { SubtitleDiscoveryContext, SubtitleSignal } from '../types';

const SAMPLE_LISTING = JSON.stringify({
  type: 'result',
  data: JSON.stringify([
    { _: 1, q: 13 },
    [2, 9],
    {
      id: 3,
      subsceneId: 4,
      language: 5,
      fileName: 6,
      releaseNames: 7,
      isDefault: 8,
      likers: 7,
      dislikers: 7,
      rand: 7,
      name: 7,
    },
    164931,
    -19074,
    'vi',
    'v07.srt',
    null,
    true,
    {
      id: 10,
      subsceneId: 4,
      language: 11,
      fileName: 12,
      releaseNames: 7,
      isDefault: 8,
      likers: 7,
      dislikers: 7,
      rand: 7,
      name: 7,
    },
    164941,
    'en',
    'e07.srt',
  ]),
});

const context: SubtitleDiscoveryContext = {
  tabId: 1,
  frameId: 0,
  origin: 'https://phimwar.com',
  initiator: 'https://phimwar.com/watch/qBMG',
  timestamp: Date.now(),
};

describe('phimwar listing adapter', () => {
  it('parses a SvelteKit-deferred subtitle listing', () => {
    const entries = parsePhimwarGetSubtitles(SAMPLE_LISTING);
    expect(entries).toHaveLength(2);
    expect(entries?.[0]).toEqual({
      id: 164931,
      subsceneId: -19074,
      language: 'vi',
      fileName: 'v07.srt',
      isDefault: true,
      rand: null,
    });
    expect(entries?.[1]).toEqual({
      id: 164941,
      subsceneId: -19074,
      language: 'en',
      fileName: 'e07.srt',
      isDefault: true,
      rand: null,
    });
  });

  it('returns null for redirect / invalid bodies', () => {
    expect(parsePhimwarGetSubtitles('{"type":"redirect"}')).toBeNull();
    expect(parsePhimwarGetSubtitles('not json')).toBeNull();
  });

  it('matches and discovers candidates from a network-response signal', async () => {
    const signal: SubtitleSignal = {
      kind: 'network-response',
      url: 'https://phimwar.com/_app/remote/1odrich/getSubtitles?payload=WyJxQk1HIl0',
      body: SAMPLE_LISTING,
      tabId: 1,
      frameId: 0,
      initiator: 'https://phimwar.com/watch/qBMG',
      method: 'GET',
      type: 'xmlhttprequest',
    };

    const adapter = createPhimwarAdapter();
    expect(adapter.match(signal)).toBe(true);

    const env = {
      fetchText: jest.fn(),
      resolveUrl: (base: string, relative: string) => new URL(relative, base).href,
      now: () => Date.now(),
    };
    const candidates = await adapter.discover(signal, context, env);

    expect(candidates).toHaveLength(2);
    expect(candidates[0].language).toBe('vi');
    expect(candidates[0].url).toBe(
      'https://phimwar.com/api/subtitle/-19074/v07.srt',
    );
    expect(candidates[0].label).toBe('Vietnamese');
    expect(candidates[0].format).toBe('srt');
    expect(candidates[0].default).toBe(true);

    expect(candidates[1].language).toBe('en');
    expect(candidates[1].url).toBe(
      'https://phimwar.com/api/subtitle/-19074/e07.srt',
    );
    expect(candidates[1].label).toBe('English');
  });

  it('does not match an empty body', () => {
    const adapter = createPhimwarAdapter();
    const signal: SubtitleSignal = {
      kind: 'network-response',
      url: 'https://phimwar.com/_app/remote/1odrich/getSubtitles?payload=WyJxQk1HIl0',
      body: '',
      tabId: 1,
      frameId: 0,
    };
    expect(adapter.match(signal)).toBe(false);
  });
});
