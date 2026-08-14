/**
 * SubDL API v2 adapter — pure functions only (no fetch, no side effects).
 *
 * Verified against real SubDL API 2026-08-14 (see docs/specs/subtitle-search.md).
 *
 * API v2 flow (2-step):
 * 1. GET /api/v2/subtitles/search?film_name=... → {results[]} movie matches
 * 2. GET /api/v2/subtitles/search?imdb_id=... → {results[], subtitles[]}
 *
 * Each subtitle has: release_name, lang, language (EN), url (direct download),
 * season, episode, hi, full_season. No unpack_files in v2.
 */

import type {
  FetchPlan,
  SearchQuery,
  SubtitleSearchProvider,
  SubtitleSearchResult,
} from '../subtitleSearchTypes';

const SUBDL_BASE_URL = 'https://api.subdl.com' as const;

// === SubDL v2 response shapes ===

interface SubdlMovieResult {
  readonly sd_id: number | string;
  readonly type: string;
  readonly name: string;
  readonly imdb_id: string;
  readonly tmdb_id: number | string | null;
  readonly year: number | null;
}

interface SubdlSubtitle {
  readonly release_name: string;
  readonly name: string;
  readonly lang: string;
  readonly url: string;
  readonly season: number | null;
  readonly episode: number | null;
  readonly language: string;
  readonly hi: boolean;
  readonly full_season: boolean;
  readonly framerate: number;
  readonly fps: string | null;
}

interface SubdlResponse {
  readonly status: boolean;
  readonly results: readonly SubdlMovieResult[];
  readonly subtitles: readonly SubdlSubtitle[];
}

// === Type guards ===

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value !== '' && !Number.isNaN(Number(value))) return Number(value);
  return null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asMovieResult(value: unknown): SubdlMovieResult | null {
  if (!isRecord(value)) return null;
  return {
    sd_id: typeof value.sd_id === 'number' ? value.sd_id : asString(value.sd_id),
    type: asString(value.type),
    name: asString(value.name),
    imdb_id: asString(value.imdb_id),
    tmdb_id: typeof value.tmdb_id === 'number' ? value.tmdb_id : asString(value.tmdb_id),
    year: asNumberOrNull(value.year),
  };
}

function asSubtitle(value: unknown): SubdlSubtitle | null {
  if (!isRecord(value)) return null;
  return {
    release_name: asString(value.release_name),
    name: asString(value.name),
    lang: asString(value.lang),
    url: asString(value.url),
    season: asNumberOrNull(value.season),
    episode: asNumberOrNull(value.episode),
    language: asString(value.language),
    hi: asBoolean(value.hi),
    full_season: asBoolean(value.full_season),
    framerate: typeof value.framerate === 'number' ? value.framerate : 0,
    fps: typeof value.fps === 'string' ? value.fps : null,
  };
}

function asSubdlResponse(raw: unknown): SubdlResponse | null {
  if (!isRecord(raw)) return null;
  const results = Array.isArray(raw.results) ? raw.results.map(asMovieResult).filter((r): r is SubdlMovieResult => r !== null) : [];
  const subtitles = Array.isArray(raw.subtitles) ? raw.subtitles.map(asSubtitle).filter((s): s is SubdlSubtitle => s !== null) : [];
  return { status: asBoolean(raw.status), results, subtitles };
}

// === Language mapping ===

/**
 * SubDL `language` field = uppercase 2-letter (e.g. "EN").
 * Map to ISO 639-1 lowercase. Simple lowercase for 2-letter codes.
 */
function mapLanguage(providerLanguage: string): string {
  if (!providerLanguage) return '';
  const upper = providerLanguage.toUpperCase();
  if (upper.length === 2) return upper.toLowerCase();
  return providerLanguage.toLowerCase();
}

// === Subtitle format normalization ===

type SubtitleFormat = 'srt' | 'vtt' | 'ass';

function normalizeFormat(name: string): SubtitleFormat {
  if (!name) return 'srt';
  const lower = name.toLowerCase();
  if (lower.endsWith('.vtt')) return 'vtt';
  if (lower.endsWith('.ass')) return 'ass';
  return 'srt'; // default — SubDL urls end with .zip but content is srt
}

// === Filters ===

function matchesLanguageFilter(isoLanguage: string, languages: readonly string[]): boolean {
  if (languages.length === 0) return true;
  return languages.includes(isoLanguage);
}

function matchesSeasonEpisode(sub: SubdlSubtitle, query: SearchQuery): boolean {
  if (query.season !== undefined) {
    if (sub.season === null || sub.season === 0) {
      // season 0 = movie or not set → skip if user wants specific season
      if (query.season > 0) return false;
    } else if (sub.season !== query.season) {
      return false;
    }
  }
  if (query.episode !== undefined) {
    if (sub.episode === null || sub.episode !== query.episode) return false;
  }
  return true;
}

// === Adapter ===

/**
 * Extract imdb_id from the first movie result (step 1 response).
 * Returns null if no results or missing imdb_id.
 */
export function extractImdbId(raw: unknown): string | null {
  const response = asSubdlResponse(raw);
  if (!response || response.results.length === 0) return null;
  const first = response.results[0];
  if (!first || !first.imdb_id) return null;
  return first.imdb_id;
}

/**
 * Check if a response already has subtitles (step 2 response).
 * If so, no need for a second call.
 */
export function hasSubtitles(raw: unknown): boolean {
  const response = asSubdlResponse(raw);
  if (!response) return false;
  return response.subtitles.length > 0;
}

function normalizeSearch(
  raw: unknown,
  query: SearchQuery,
): SubtitleSearchResult[] {
  const response = asSubdlResponse(raw);
  if (!response) return [];

  const results: SubtitleSearchResult[] = [];

  for (const sub of response.subtitles) {
    if (!sub.url) continue; // skip entries without download url

    const providerLanguage = sub.language;
    const isoLanguage = mapLanguage(providerLanguage);

    if (!matchesLanguageFilter(isoLanguage, query.languages)) continue;
    if (!matchesSeasonEpisode(sub, query)) continue;

    const name = sub.release_name || sub.name;
    const downloadUrl = SUBDL_BASE_URL + sub.url;

    results.push({
      id: 'subdl:' + sub.url,
      name,
      providerLanguage,
      isoLanguage,
      format: normalizeFormat(sub.name),
      download: { kind: 'direct', url: downloadUrl },
      source: 'subdl',
      sdh: sub.hi,
    });
  }

  return results;
}

/** Step 1: search by film_name → get movie matches with imdb_id */
function buildSearchRequest(query: SearchQuery, apiKey: string): FetchPlan {
  const params = new URLSearchParams();
  params.set('film_name', query.query);
  if (query.languages.length > 0) {
    params.set('languages', query.languages.join(','));
  }

  const url = `${SUBDL_BASE_URL}/api/v2/subtitles/search?${params.toString()}`;

  return {
    url,
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  };
}

/** Step 2: search by imdb_id → get subtitles list */
function buildSubtitleListRequest(imdbId: string, query: SearchQuery, apiKey: string): FetchPlan {
  const params = new URLSearchParams();
  params.set('imdb_id', imdbId);
  if (query.languages.length > 0) {
    params.set('languages', query.languages.join(','));
  }

  const url = `${SUBDL_BASE_URL}/api/v2/subtitles/search?${params.toString()}`;

  return {
    url,
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  };
}

function buildDownloadRequest(
  result: SubtitleSearchResult,
  apiKey: string,
): FetchPlan {
  if (result.download.kind !== 'direct') {
    throw new Error(
      `subdlAdapter.buildDownloadRequest: expected direct download, got ${result.download.kind}`,
    );
  }

  return {
    url: result.download.url,
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  };
}

/**
 * Unzip a single-file ZIP archive (SubDL downloads are .zip containing one .srt).
 * Uses DecompressionStream('deflate-raw') for deflate-compressed entries,
 * raw copy for stored entries. Returns the extracted file content as string.
 *
 * ponytail: minimal ZIP parser — reads only the first local file entry.
 * Ceiling: multi-file ZIPs only return the first file. SubDL always packs
 * one .srt per .zip, so this is sufficient.
 */
async function unzipFirstEntry(bytes: ArrayBuffer): Promise<string> {
  const view = new DataView(bytes);
  // Check PK\x03\x04 magic
  if (view.getUint16(0, true) !== 0x4b50 || view.getUint16(2, true) !== 0x0403) {
    // Not a ZIP — return as text
    return new TextDecoder().decode(bytes);
  }
  const compressionMethod = view.getUint16(10, true);
  const compressedSize = view.getUint32(20, true);
  const filenameLen = view.getUint16(28, true);
  const extraLen = view.getUint16(30, true);
  const dataOffset = 34 + filenameLen + extraLen;
  const compressedData = bytes.slice(dataOffset, dataOffset + compressedSize);

  if (compressionMethod === 0) {
    // Store (no compression)
    return new TextDecoder().decode(compressedData);
  }
  if (compressionMethod === 8) {
    // Deflate — use DecompressionStream with 'deflate-raw' (no zlib header)
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    writer.write(compressedData);
    writer.close();
    const reader = ds.readable.getReader();
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const total = chunks.reduce((sum, c) => sum + c.length, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return new TextDecoder().decode(merged);
  }
  // Unknown compression — return raw as fallback
  return new TextDecoder().decode(compressedData);
}

async function decodeDownload(
  bytes: ArrayBuffer,
  result: SubtitleSearchResult,
): Promise<{ content: string; format: SubtitleFormat }> {
  const content = await unzipFirstEntry(bytes);
  return { content, format: result.format };
}

export const subdlAdapter: SubtitleSearchProvider = {
  id: 'subdl',
  normalizeSearch,
  buildSearchRequest,
  buildDownloadRequest,
  decodeDownload,
} as const;

// Export step-2 builder for the handler (not part of SubtitleSearchProvider
// interface — only SubDL needs 2-step).
export { buildSubtitleListRequest };
