// OpenSubtitles API adapter — pure functions only (no fetch, no side effects).
// Verified against real API calls 2026-08-13 (see docs/specs/subtitle-search.md § API Reference).
//
// Response shape (verified):
//   { total_pages, total_count, data: [{ id, attributes: { language, download_count,
//     hearing_impaired, ratings, release, files: [{ file_id, file_name }],
//     feature_details: { title, imdb_id, tmdb_id } } }] }
//
// Download = 2-step handshake: POST /download?file_id={id} → temp link → GET link.
// POST uses query params, NOT JSON body (JSON body returns 400 — verified S9).

import type {
  FetchPlan,
  SearchQuery,
  SubtitleSearchProvider,
  SubtitleSearchResult,
} from '../subtitleSearchTypes';

const OS_BASE = 'https://api.opensubtitles.com/api/v1';
const USER_AGENT = 'Cell v1.0';

/** OpenSubtitles language code → ISO 639-1 (verified from /infos/languages, 95 codes). */
const OS_LANG_TO_ISO: Readonly<Record<string, string>> = {
  en: 'en',
  vi: 'vi',
  'zh-cn': 'zh',
  'zh-tw': 'zh',
  'zh-ca': 'zh',
  ze: 'zh',
  'pt-br': 'pt',
  'pt-pt': 'pt',
  ja: 'ja',
  ko: 'ko',
};

function mapIsoLanguage(osCode: string): string {
  if (!osCode) return '';
  const lower = osCode.toLowerCase();
  return OS_LANG_TO_ISO[lower] ?? lower.slice(0, 2);
}

type SubtitleFormat = 'srt' | 'vtt' | 'ass';

function detectFormat(fileName: string): SubtitleFormat {
  if (!fileName) return 'srt';
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.vtt')) return 'vtt';
  if (lower.endsWith('.ass')) return 'ass';
  return 'srt';
}

// === Minimal shape guards (trust boundary: raw external JSON) ===

interface OsFile {
  readonly file_id: number;
  readonly file_name: string;
}
interface OsAttributes {
  readonly language: string;
  readonly download_count?: number;
  readonly hearing_impaired?: boolean;
  readonly ratings?: number;
  readonly release?: string;
  readonly files?: readonly OsFile[];
  readonly feature_details?: { readonly title?: string };
}
interface OsEntry {
  readonly id: string | number;
  readonly attributes: OsAttributes;
}
function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function readEntry(raw: unknown): OsEntry | null {
  if (!isObject(raw) || !isObject(raw.attributes)) return null;
  return raw as unknown as OsEntry;
}

// === Provider ===

function normalizeSearch(raw: unknown, query: SearchQuery): SubtitleSearchResult[] {
  if (!isObject(raw) || !Array.isArray(raw.data)) return [];

  const langFilter =
    query.languages.length > 0 ? new Set(query.languages.map((l) => l.toLowerCase())) : null;

  const out: SubtitleSearchResult[] = [];
  for (const item of raw.data as readonly unknown[]) {
    const entry = readEntry(item);
    if (!entry) continue;
    const { attributes } = entry;
    const file = attributes.files?.[0];
    if (!file || typeof file.file_id !== 'number') continue;

    const isoLanguage = mapIsoLanguage(attributes.language ?? '');
    if (!isoLanguage) continue;
    if (langFilter && !langFilter.has(isoLanguage.toLowerCase())) continue;

    const fileId = file.file_id;
    const name =
      attributes.feature_details?.title ?? attributes.release ?? file.file_name ?? String(entry.id);

    out.push({
      id: `os:${fileId}`,
      name,
      providerLanguage: attributes.language,
      isoLanguage,
      format: detectFormat(file.file_name ?? ''),
      download: { kind: 'handshake', fileId },
      source: 'opensubtitles',
      rating: typeof attributes.ratings === 'number' ? attributes.ratings : undefined,
      downloads: typeof attributes.download_count === 'number' ? attributes.download_count : undefined,
      sdh: attributes.hearing_impaired === true ? true : undefined,
    });
  }
  return out;
}

function buildSearchRequest(query: SearchQuery, apiKey: string): FetchPlan {
  const params = new URLSearchParams();
  params.set('query', query.query);
  if (query.languages.length > 0) params.set('languages', query.languages.join(','));
  if (typeof query.season === 'number') params.set('season_number', String(query.season));
  if (typeof query.episode === 'number') params.set('episode_number', String(query.episode));

  return {
    url: `${OS_BASE}/subtitles?${params.toString()}`,
    method: 'GET',
    headers: {
      'Api-Key': apiKey,
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
    responseType: 'text',
  };
}

function buildDownloadRequest(result: SubtitleSearchResult, apiKey: string): FetchPlan {
  if (result.download.kind !== 'handshake') {
    // OpenSubtitles results are always handshake; guard for type narrowing only.
    throw new Error(`openSubtitlesAdapter: expected handshake download, got ${result.download.kind}`);
  }
  return {
    url: `${OS_BASE}/download?file_id=${result.download.fileId}`,
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
    responseType: 'text',
  };
}

async function decodeDownload(bytes: ArrayBuffer, result: SubtitleSearchResult): Promise<{
  content: string;
  format: SubtitleFormat;
}> {
  const content = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
  return { content, format: result.format };
}

export const openSubtitlesAdapter: SubtitleSearchProvider = {
  id: 'opensubtitles',
  normalizeSearch,
  buildSearchRequest,
  buildDownloadRequest,
  decodeDownload,
};
