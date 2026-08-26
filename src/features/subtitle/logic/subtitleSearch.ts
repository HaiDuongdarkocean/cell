/**
 * Subtitle search provider registry + orchestration.
 *
 * Pure functions only — nhận input, trả output, không fetch, không storage.
 * Background handlers thực thi FetchPlan qua offscreenFetch.
 *
 * Thêm provider = thêm 1 object vào PROVIDERS, không đục orchestration.
 * O(1) lookup qua record, không if/switch chain.
 */

import { subdlAdapter } from './providers/subdlAdapter';
import { openSubtitlesAdapter } from './providers/openSubtitlesAdapter';
import type {
  FetchPlan,
  SearchQuery,
  SubtitleSearchProvider,
  SubtitleSearchResult,
} from './subtitleSearchTypes';

// === Provider registry — single source of truth ===

const PROVIDERS: Record<string, SubtitleSearchProvider> = {
  subdl: subdlAdapter,
  opensubtitles: openSubtitlesAdapter,
};

// === Orchestration (delegate to provider via O(1) record lookup) ===

/** SubDL-first, OpenSubtitles fallback. */
export function pickProviderOrder(): readonly string[] {
  return ['subdl', 'opensubtitles'];
}

/** Normalize raw API JSON → SubtitleSearchResult[]. */
export function normalizeSearch(
  providerId: string,
  raw: unknown,
  query: SearchQuery,
): SubtitleSearchResult[] {
  return PROVIDERS[providerId].normalizeSearch(raw, query);
}

/** Build fetch params cho search request. */
export function buildSearchRequest(
  providerId: string,
  query: SearchQuery,
  apiKey: string,
): FetchPlan {
  return PROVIDERS[providerId].buildSearchRequest(query, apiKey);
}

/**
 * Build fetch params cho download request.
 * Delegates to correct provider dựa trên `result.source` (không phải caller-supplied id)
 * — result mang nguồn của nó, tránh mismatch.
 */
export function buildDownloadRequest(
  result: SubtitleSearchResult,
  apiKey: string,
): FetchPlan {
  return PROVIDERS[result.source].buildDownloadRequest(result, apiKey);
}

/** Decode downloaded bytes → text + format. */
export async function decodeDownload(
  providerId: string,
  bytes: ArrayBuffer,
  result: SubtitleSearchResult,
): Promise<{ content: string; format: 'srt' | 'vtt' | 'ass' }> {
  return PROVIDERS[providerId].decodeDownload(bytes, result);
}
