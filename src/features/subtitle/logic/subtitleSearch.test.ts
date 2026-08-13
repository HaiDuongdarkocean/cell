/**
 * Unit tests for pure subtitle search logic.
 *
 * Co-located with subtitleSearch.ts (repo convention).
 * Covers:
 *  - SubDL normalizeSearch (verified SubDL response shape from spec API Reference)
 *  - OpenSubtitles normalizeSearch (verified OS response shape from spec API Reference)
 *  - Key rotation (pickSearchKey, pickDownloadKey, shouldKeyBeActive, markKeyStatus)
 *  - buildSearchRequest (correct URL + headers per provider)
 *  - buildDownloadRequest (direct vs handshake)
 *
 * @see docs/specs/subtitle-search.md § API Reference (verified 2026-08-13)
 */

import { subdlAdapter } from './providers/subdlAdapter';
import { openSubtitlesAdapter } from './providers/openSubtitlesAdapter';
import {
  pickSearchKey,
  pickDownloadKey,
  shouldKeyBeActive,
  markKeyStatus,
} from './keyRotation';
import {
  buildSearchRequest,
  buildDownloadRequest,
} from './subtitleSearch';
import type {
  SearchQuery,
  SubtitleSearchResult,
} from './subtitleSearchTypes';
import type {
  SubtitleApiKey,
  SubtitleApiKeyProvider,
} from '@/entities/settings/types';

// === Fixtures (verified response shapes from docs/specs/subtitle-search.md) ===

const SUBDL_RESPONSE = {
  status: true,
  results: [
    {
      sd_id: 2922,
      type: 'movie',
      name: 'Inception',
      imdb_id: 'tt1375666',
      tmdb_id: 27205,
      slug: 'inception',
    },
  ],
  subtitles: [
    {
      release_name: 'Inception.2010.1080p.BluRay.x265-YAWNTiC_eng',
      name: 'Inception.2010.1080p.BluRay.x265-YAWNTiC_eng.zip',
      lang: 'English',
      author: 'YTSDD',
      url: '/subtitle/3467330-8390389.zip?api_key=xxx',
      season: 0,
      episode: null,
      language: 'EN',
      hi: false,
      full_season: false,
      unpack_files: [
        {
          file_n_id: '9Z7h1Yr0CI',
          name: 'Inception.2010.1080p.BluRay.x265-YAWNTiC_eng SDH.srt',
          release_name: 'Inception.2010.1080p.BluRay.x265-YAWNTiC_eng SDH',
          season: 0,
          episode: 0,
          language: 'EN',
          hi: true,
          format: 'srt',
          size: 135733,
          md5: '723b23daba3b9453307d304ab2dbbd3b',
          url: '/subtitle/aUEepyPYhXB/9Z7h1Yr0CI?api_key=xxx',
        },
        {
          // empty file_n_id → must be skipped
          file_n_id: '',
          name: 'broken.srt',
          release_name: 'broken',
          season: 0,
          episode: 0,
          language: 'EN',
          hi: false,
          format: 'srt',
          size: 0,
          url: '/subtitle/broken/empty?api_key=xxx',
        },
      ],
    },
  ],
  totalPages: 15,
  currentPage: 1,
} as const;

const OS_RESPONSE = {
  total_pages: 2,
  total_count: 56,
  per_page: 50,
  page: 1,
  data: [
    {
      id: '4859512',
      type: 'subtitle',
      attributes: {
        subtitle_id: '4859512',
        language: 'en',
        download_count: 7617,
        hearing_impaired: false,
        hd: false,
        fps: 23.976,
        ratings: 5.0,
        release: 'Inception',
        ai_translated: false,
        machine_translated: false,
        foreign_parts_only: false,
        upload_date: '2019-06-15T21:59:52Z',
        uploader: { uploader_id: 61795, name: 'coolgit', rank: 'Admin Warning' },
        feature_details: {
          feature_id: 554572,
          feature_type: 'Movie',
          year: 2010,
          title: 'Inception',
          imdb_id: 1375666,
          tmdb_id: 27205,
        },
        files: [{ file_id: 4982777, cd_number: 1, file_name: 'Inception.srt' }],
      },
    },
  ],
} as const;

// === Key fixtures ===

function makeKey(
  overrides: Partial<SubtitleApiKey> & {
    provider: SubtitleApiKeyProvider;
    id: string;
  },
): SubtitleApiKey {
  return {
    key: 'k-' + overrides.id,
    status: 'active',
    addedAt: 1000,
    ...overrides,
  };
}

const BASE_QUERY: SearchQuery = {
  query: 'Inception',
  languages: ['en'],
};

// === SubDL normalizeSearch ===

describe('subdlAdapter.normalizeSearch', () => {
  it('parses verified SubDL response shape', () => {
    const results = subdlAdapter.normalizeSearch(SUBDL_RESPONSE, BASE_QUERY);
    expect(results).toHaveLength(1);
    const r = results[0] as SubtitleSearchResult;
    expect(r.id).toBe('subdl:9Z7h1Yr0CI');
    expect(r.source).toBe('subdl');
    expect(r.format).toBe('srt');
    expect(r.sdh).toBe(true);
    expect(r.download.kind).toBe('direct');
  });

  it('skips entries with empty file_n_id', () => {
    const results = subdlAdapter.normalizeSearch(SUBDL_RESPONSE, BASE_QUERY);
    // only the valid file_n_id entry survives
    expect(results.every((r) => r.id !== 'subdl:')).toBe(true);
    expect(results.find((r) => r.name.includes('broken'))).toBeUndefined();
  });

  it('prepends https://api.subdl.com to relative URLs', () => {
    const results = subdlAdapter.normalizeSearch(SUBDL_RESPONSE, BASE_QUERY);
    const r = results[0] as SubtitleSearchResult;
    expect(r.download).toEqual({
      kind: 'direct',
      url: 'https://api.subdl.com/subtitle/aUEepyPYhXB/9Z7h1Yr0CI?api_key=xxx',
    });
  });

  it('maps language "EN" → "en"', () => {
    const results = subdlAdapter.normalizeSearch(SUBDL_RESPONSE, BASE_QUERY);
    const r = results[0] as SubtitleSearchResult;
    expect(r.providerLanguage).toBe('EN');
    expect(r.isoLanguage).toBe('en');
  });

  it('filters by query.languages', () => {
    const viQuery: SearchQuery = { query: 'Inception', languages: ['vi'] };
    const results = subdlAdapter.normalizeSearch(SUBDL_RESPONSE, viQuery);
    expect(results).toEqual([]);
  });

  it('returns [] for malformed input', () => {
    expect(subdlAdapter.normalizeSearch(null, BASE_QUERY)).toEqual([]);
    expect(subdlAdapter.normalizeSearch({ status: true }, BASE_QUERY)).toEqual([]);
    expect(subdlAdapter.normalizeSearch('not-an-object', BASE_QUERY)).toEqual([]);
  });
});

// === OpenSubtitles normalizeSearch ===

describe('openSubtitlesAdapter.normalizeSearch', () => {
  it('parses verified OS response shape', () => {
    const results = openSubtitlesAdapter.normalizeSearch(OS_RESPONSE, BASE_QUERY);
    expect(results).toHaveLength(1);
    const r = results[0] as SubtitleSearchResult;
    expect(r.id).toBe('os:4982777');
    expect(r.source).toBe('opensubtitles');
    expect(r.name).toBe('Inception');
    expect(r.downloads).toBe(7617);
    expect(r.rating).toBe(5.0);
  });

  it('extracts file_id from attributes.files[0]', () => {
    const results = openSubtitlesAdapter.normalizeSearch(OS_RESPONSE, BASE_QUERY);
    const r = results[0] as SubtitleSearchResult;
    expect(r.download.kind).toBe('handshake');
    if (r.download.kind === 'handshake') {
      expect(r.download.fileId).toBe(4982777);
    }
  });

  it('maps language codes (en→en, zh-cn→zh, pt-br→pt)', () => {
    const zhResponse = {
      data: [
        {
          id: '1',
          attributes: {
            language: 'zh-cn',
            files: [{ file_id: 100, file_name: 'a.srt' }],
            feature_details: { title: 'A' },
          },
        },
        {
          id: '2',
          attributes: {
            language: 'pt-br',
            files: [{ file_id: 200, file_name: 'b.srt' }],
            feature_details: { title: 'B' },
          },
        },
      ],
    };
    const allQuery: SearchQuery = { query: 'x', languages: [] };
    const results = openSubtitlesAdapter.normalizeSearch(zhResponse, allQuery);
    expect(results).toHaveLength(2);
    expect(results[0]?.isoLanguage).toBe('zh');
    expect(results[1]?.isoLanguage).toBe('pt');
  });

  it('filters by query.languages', () => {
    const viQuery: SearchQuery = { query: 'Inception', languages: ['vi'] };
    const results = openSubtitlesAdapter.normalizeSearch(OS_RESPONSE, viQuery);
    expect(results).toEqual([]);
  });

  it('skips entries with no files', () => {
    const noFiles = {
      data: [
        { id: '1', attributes: { language: 'en', files: [] } },
        { id: '2', attributes: { language: 'en' } },
      ],
    };
    expect(openSubtitlesAdapter.normalizeSearch(noFiles, BASE_QUERY)).toEqual([]);
  });

  it('returns [] for malformed input', () => {
    expect(openSubtitlesAdapter.normalizeSearch(null, BASE_QUERY)).toEqual([]);
    expect(openSubtitlesAdapter.normalizeSearch({}, BASE_QUERY)).toEqual([]);
  });
});

// === Key rotation ===

describe('pickSearchKey', () => {
  it('picks oldest addedAt among active/unverified', () => {
    const keys: readonly SubtitleApiKey[] = [
      makeKey({ id: 'a', provider: 'subdl', addedAt: 3000 }),
      makeKey({ id: 'b', provider: 'subdl', addedAt: 1000, status: 'unverified' }),
      makeKey({ id: 'c', provider: 'subdl', addedAt: 2000 }),
    ];
    expect(pickSearchKey(keys, 'subdl')?.id).toBe('b');
  });

  it('skips rate-limited (unless expired)', () => {
    const future = Date.now() + 60_000;
    const keys: readonly SubtitleApiKey[] = [
      makeKey({ id: 'a', provider: 'subdl', addedAt: 1000, status: 'rate-limited', rateLimitedUntil: future }),
      makeKey({ id: 'b', provider: 'subdl', addedAt: 2000 }),
    ];
    // 'a' rate-limited → skip, pick 'b'
    expect(pickSearchKey(keys, 'subdl')?.id).toBe('b');
  });

  it('treats expired rate-limited as eligible', () => {
    const past = Date.now() - 60_000;
    const keys: readonly SubtitleApiKey[] = [
      makeKey({ id: 'a', provider: 'subdl', addedAt: 1000, status: 'rate-limited', rateLimitedUntil: past }),
      makeKey({ id: 'b', provider: 'subdl', addedAt: 2000 }),
    ];
    // 'a' cooldown expired + older → pick 'a'
    expect(pickSearchKey(keys, 'subdl')?.id).toBe('a');
  });

  it('skips invalid', () => {
    const keys: readonly SubtitleApiKey[] = [
      makeKey({ id: 'a', provider: 'subdl', addedAt: 1000, status: 'invalid' }),
      makeKey({ id: 'b', provider: 'subdl', addedAt: 2000 }),
    ];
    expect(pickSearchKey(keys, 'subdl')?.id).toBe('b');
  });

  it('returns undefined when all exhausted', () => {
    const future = Date.now() + 60_000;
    const keys: readonly SubtitleApiKey[] = [
      makeKey({ id: 'a', provider: 'subdl', addedAt: 1000, status: 'invalid' }),
      makeKey({ id: 'b', provider: 'subdl', addedAt: 2000, status: 'rate-limited', rateLimitedUntil: future }),
    ];
    expect(pickSearchKey(keys, 'subdl')).toBeUndefined();
  });

  it('filters by provider', () => {
    const keys: readonly SubtitleApiKey[] = [
      makeKey({ id: 'a', provider: 'opensubtitles', addedAt: 1000 }),
      makeKey({ id: 'b', provider: 'subdl', addedAt: 2000 }),
    ];
    expect(pickSearchKey(keys, 'subdl')?.id).toBe('b');
    expect(pickSearchKey(keys, 'opensubtitles')?.id).toBe('a');
  });
});

describe('pickDownloadKey', () => {
  it('only picks active (not unverified)', () => {
    const keys: readonly SubtitleApiKey[] = [
      makeKey({ id: 'a', provider: 'subdl', addedAt: 1000, status: 'unverified' }),
      makeKey({ id: 'b', provider: 'subdl', addedAt: 2000, status: 'active' }),
    ];
    // 'a' unverified → skip for download, pick 'b'
    expect(pickDownloadKey(keys, 'subdl')?.id).toBe('b');
  });

  it('returns undefined when only unverified available', () => {
    const keys: readonly SubtitleApiKey[] = [
      makeKey({ id: 'a', provider: 'subdl', addedAt: 1000, status: 'unverified' }),
    ];
    expect(pickDownloadKey(keys, 'subdl')).toBeUndefined();
  });

  it('treats expired rate-limited as active', () => {
    const past = Date.now() - 60_000;
    const keys: readonly SubtitleApiKey[] = [
      makeKey({ id: 'a', provider: 'subdl', addedAt: 1000, status: 'rate-limited', rateLimitedUntil: past }),
    ];
    expect(pickDownloadKey(keys, 'subdl')?.id).toBe('a');
  });
});

describe('shouldKeyBeActive', () => {
  it('returns true for active', () => {
    expect(shouldKeyBeActive(makeKey({ id: 'a', provider: 'subdl', status: 'active' }))).toBe(true);
  });

  it('returns false for rate-limited not expired', () => {
    const future = Date.now() + 60_000;
    expect(
      shouldKeyBeActive(makeKey({ id: 'a', provider: 'subdl', status: 'rate-limited', rateLimitedUntil: future })),
    ).toBe(false);
  });

  it('returns true when rate-limited expired', () => {
    const past = Date.now() - 60_000;
    expect(
      shouldKeyBeActive(makeKey({ id: 'a', provider: 'subdl', status: 'rate-limited', rateLimitedUntil: past })),
    ).toBe(true);
  });

  it('returns false for invalid/unverified', () => {
    expect(shouldKeyBeActive(makeKey({ id: 'a', provider: 'subdl', status: 'invalid' }))).toBe(false);
    expect(shouldKeyBeActive(makeKey({ id: 'a', provider: 'subdl', status: 'unverified' }))).toBe(false);
  });
});

describe('markKeyStatus', () => {
  it('rate-limited sets rateLimitedUntil = now + retryAfterMs', () => {
    const before = Date.now();
    const key = makeKey({ id: 'a', provider: 'subdl', status: 'active' });
    const marked = markKeyStatus(key, 'rate-limited', 5000);
    const after = Date.now();
    expect(marked.status).toBe('rate-limited');
    expect(marked.rateLimitedUntil).toBeGreaterThanOrEqual(before + 5000);
    expect(marked.rateLimitedUntil).toBeLessThanOrEqual(after + 5000);
  });

  it('active clears rateLimitedUntil', () => {
    const key = makeKey({ id: 'a', provider: 'subdl', status: 'rate-limited', rateLimitedUntil: 9999 });
    const marked = markKeyStatus(key, 'active');
    expect(marked.status).toBe('active');
    expect(marked.rateLimitedUntil).toBeUndefined();
  });

  it('preserves other fields', () => {
    const key = makeKey({ id: 'a', provider: 'subdl', status: 'active', label: 'my key' });
    const marked = markKeyStatus(key, 'invalid');
    expect(marked.id).toBe('a');
    expect(marked.label).toBe('my key');
    expect(marked.status).toBe('invalid');
  });
});

// === buildSearchRequest ===

describe('buildSearchRequest', () => {
  it('SubDL: correct URL + headers', () => {
    const plan = buildSearchRequest('subdl', BASE_QUERY, 'KEY123');
    expect(plan.method).toBe('GET');
    expect(plan.url).toContain('https://api.subdl.com/api/v2/subtitles/search');
    expect(plan.url).toContain('film_name=Inception');
    expect(plan.url).toContain('languages=en');
    expect(plan.url).toContain('unpack=1');
    expect(plan.headers?.Authorization).toBe('Bearer KEY123');
  });

  it('SubDL: includes season/episode when provided', () => {
    const tvQuery: SearchQuery = { query: 'Game of Thrones', languages: ['en'], season: 1, episode: 1 };
    const plan = buildSearchRequest('subdl', tvQuery, 'KEY');
    expect(plan.url).toContain('season=1');
    expect(plan.url).toContain('episode=1');
  });

  it('OpenSubtitles: correct URL + headers', () => {
    const plan = buildSearchRequest('opensubtitles', BASE_QUERY, 'OSKEY');
    expect(plan.method).toBe('GET');
    expect(plan.url).toContain('https://api.opensubtitles.com/api/v1/subtitles');
    expect(plan.url).toContain('query=Inception');
    expect(plan.url).toContain('languages=en');
    expect(plan.headers?.['Api-Key']).toBe('OSKEY');
    expect(plan.headers?.['User-Agent']).toBeDefined();
    expect(plan.headers?.Accept).toBe('application/json');
  });

  it('OpenSubtitles: uses season_number/episode_number params', () => {
    const tvQuery: SearchQuery = { query: 'GoT', languages: ['en'], season: 2, episode: 3 };
    const plan = buildSearchRequest('opensubtitles', tvQuery, 'OSKEY');
    expect(plan.url).toContain('season_number=2');
    expect(plan.url).toContain('episode_number=3');
  });
});

// === buildDownloadRequest ===

describe('buildDownloadRequest', () => {
  it('SubDL direct: GET with Authorization header', () => {
    const result: SubtitleSearchResult = {
      id: 'subdl:abc',
      name: 'Inception.srt',
      providerLanguage: 'EN',
      isoLanguage: 'en',
      format: 'srt',
      download: { kind: 'direct', url: 'https://api.subdl.com/subtitle/x/abc?api_key=zzz' },
      source: 'subdl',
    };
    const plan = buildDownloadRequest(result, 'KEY');
    expect(plan.method).toBe('GET');
    expect(plan.url).toBe('https://api.subdl.com/subtitle/x/abc?api_key=zzz');
    expect(plan.headers?.Authorization).toBe('Bearer KEY');
  });

  it('OpenSubtitles handshake: POST with file_id query param + Api-Key header', () => {
    const result: SubtitleSearchResult = {
      id: 'os:4982777',
      name: 'Inception.srt',
      providerLanguage: 'en',
      isoLanguage: 'en',
      format: 'srt',
      download: { kind: 'handshake', fileId: 4982777 },
      source: 'opensubtitles',
    };
    const plan = buildDownloadRequest(result, 'OSKEY');
    expect(plan.method).toBe('POST');
    expect(plan.url).toBe('https://api.opensubtitles.com/api/v1/download?file_id=4982777');
    expect(plan.headers?.['Api-Key']).toBe('OSKEY');
    expect(plan.headers?.['User-Agent']).toBeDefined();
    expect(plan.headers?.Accept).toBe('application/json');
  });
});
