/**
 * SubDL API adapter — pure functions only (no fetch, no side effects).
 *
 * Verified against real SubDL API 2026-08-13 (see docs/specs/subtitle-search.md).
 * Response shape: `{status, results[], subtitles[]}` where each subtitle has
 * `unpack_files[]` with single-file download URLs (requires `unpack=1` param).
 */

import type {
  FetchPlan,
  SearchQuery,
  SubtitleSearchProvider,
  SubtitleSearchResult,
} from '../subtitleSearchTypes';

const SUBDL_BASE_URL = 'https://api.subdl.com' as const;

// === SubDL response shapes (narrowed via type guards, no `any`) ===

interface SubdlUnpackFile {
  readonly file_n_id: string;
  readonly name: string;
  readonly release_name: string;
  readonly season: number | null;
  readonly episode: number | null;
  readonly language: string;
  readonly hi: boolean;
  readonly format: string;
  readonly size: number;
  readonly url: string;
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
  readonly unpack_files: readonly SubdlUnpackFile[];
}

interface SubdlResponse {
  readonly status: boolean;
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
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asUnpackFile(value: unknown): SubdlUnpackFile | null {
  if (!isRecord(value)) return null;
  const fileNId = asString(value.file_n_id);
  if (fileNId === '') return null; // skip empty file_n_id
  return {
    file_n_id: fileNId,
    name: asString(value.name),
    release_name: asString(value.release_name),
    season: asNumberOrNull(value.season),
    episode: asNumberOrNull(value.episode),
    language: asString(value.language),
    hi: asBoolean(value.hi),
    format: asString(value.format),
    size: typeof value.size === 'number' ? value.size : 0,
    url: asString(value.url),
  };
}

function asSubdlResponse(raw: unknown): SubdlResponse | null {
  if (!isRecord(raw)) return null;
  const subtitles = Array.isArray(raw.subtitles) ? raw.subtitles : [];
  const parsed: SubdlSubtitle[] = [];
  for (const sub of subtitles) {
    if (!isRecord(sub)) continue;
    const unpackFiles = Array.isArray(sub.unpack_files) ? sub.unpack_files : [];
    const files: SubdlUnpackFile[] = [];
    for (const f of unpackFiles) {
      const parsedFile = asUnpackFile(f);
      if (parsedFile) files.push(parsedFile);
    }
    parsed.push({
      release_name: asString(sub.release_name),
      name: asString(sub.name),
      lang: asString(sub.lang),
      url: asString(sub.url),
      season: asNumberOrNull(sub.season),
      episode: asNumberOrNull(sub.episode),
      language: asString(sub.language),
      hi: asBoolean(sub.hi),
      full_season: asBoolean(sub.full_season),
      unpack_files: files,
    });
  }
  return { status: asBoolean(raw.status), subtitles: parsed };
}

// === Language mapping ===

/**
 * SubDL `language` field = uppercase 2-letter (e.g. "EN").
 * Map to ISO 639-1 lowercase. Simple lowercase for 2-letter codes.
 */
function mapLanguage(providerLanguage: string): string {
  if (!providerLanguage) return '';
  const upper = providerLanguage.toUpperCase();
  // Simple lowercase for 2-letter codes (EN→en, VI→vi, FR→fr, JA→ja, KO→ko…)
  if (upper.length === 2) return upper.toLowerCase();
  // Fallback: lowercase as-is for unexpected longer codes
  return providerLanguage.toLowerCase();
}

// === Subtitle format normalization ===

type SubtitleFormat = 'srt' | 'vtt' | 'ass';

function normalizeFormat(format: string): SubtitleFormat {
  if (!format) return 'srt';
  const lower = format.toLowerCase();
  if (lower === 'vtt' || lower === 'ass') return lower;
  return 'srt'; // default
}

// === Filters ===

function matchesLanguageFilter(isoLanguage: string, languages: readonly string[]): boolean {
  if (languages.length === 0) return true; // no filter = accept all
  return languages.includes(isoLanguage);
}

function matchesSeasonEpisode(
  file: SubdlUnpackFile,
  query: SearchQuery,
): boolean {
  if (query.season !== undefined) {
    if (file.season === null || file.season !== query.season) return false;
  }
  if (query.episode !== undefined) {
    if (file.episode === null || file.episode !== query.episode) return false;
  }
  return true;
}

// === Adapter ===

function normalizeSearch(
  raw: unknown,
  query: SearchQuery,
): SubtitleSearchResult[] {
  const response = asSubdlResponse(raw);
  if (!response) return [];

  const results: SubtitleSearchResult[] = [];

  for (const subtitle of response.subtitles) {
    for (const file of subtitle.unpack_files) {
      // file_n_id empty already skipped in asUnpackFile
      const providerLanguage = file.language;
      const isoLanguage = mapLanguage(providerLanguage);

      // Filter by query.languages (match isoLanguage)
      if (!matchesLanguageFilter(isoLanguage, query.languages)) continue;

      // Filter by season/episode if provided
      if (!matchesSeasonEpisode(file, query)) continue;

      const name = file.name || file.release_name || subtitle.release_name;
      const downloadUrl = SUBDL_BASE_URL + file.url;

      results.push({
        id: 'subdl:' + file.file_n_id,
        name,
        providerLanguage,
        isoLanguage,
        format: normalizeFormat(file.format),
        download: { kind: 'direct', url: downloadUrl },
        source: 'subdl',
        sdh: file.hi,
      });
    }
  }

  return results;
}

function buildSearchRequest(query: SearchQuery, apiKey: string): FetchPlan {
  const params = new URLSearchParams();
  params.set('film_name', query.query);
  if (query.languages.length > 0) {
    params.set('languages', query.languages.join(','));
  }
  params.set('unpack', '1');
  if (query.season !== undefined) {
    params.set('season', String(query.season));
  }
  if (query.episode !== undefined) {
    params.set('episode', String(query.episode));
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
  // SubDL uses direct download — no handshake
  if (result.download.kind !== 'direct') {
    // Should not happen for SubDL results, but satisfy exhaustiveness
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

function decodeDownload(
  bytes: ArrayBuffer,
  result: SubtitleSearchResult,
): { content: string; format: SubtitleFormat } {
  const content = new TextDecoder().decode(bytes);
  return { content, format: result.format };
}

export const subdlAdapter: SubtitleSearchProvider = {
  id: 'subdl',
  normalizeSearch,
  buildSearchRequest,
  buildDownloadRequest,
  decodeDownload,
} as const;
