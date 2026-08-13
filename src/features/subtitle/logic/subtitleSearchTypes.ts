/**
 * Subtitle search shared types — contract cho tất cả subagent.
 *
 * Pure types only, no logic. Used by:
 * - logic/subtitleSearch.ts (provider registry + orchestration)
 * - logic/providers/subdlAdapter.ts
 * - logic/providers/openSubtitlesAdapter.ts
 * - logic/keyRotation.ts
 * - background/handlers/subtitleSearch.ts
 * - background/helpers/subtitleKeyLedger.ts
 * - ui/SubtitleSearchPanel.tsx
 *
 * Verified against real API calls 2026-08-13 (see docs/specs/subtitle-search.md).
 */

// === Download kind (discriminated union) ===

export type SubtitleDownloadKind =
  | { readonly kind: 'direct'; readonly url: string }
  | { readonly kind: 'handshake'; readonly fileId: number };

// === Search result ===

export interface SubtitleSearchResult {
  readonly id: string;
  readonly name: string;
  readonly providerLanguage: string;
  readonly isoLanguage: string;
  readonly format: 'srt' | 'vtt' | 'ass';
  readonly download: SubtitleDownloadKind;
  readonly source: 'subdl' | 'opensubtitles';
  readonly rating?: number;
  readonly downloads?: number;
  readonly sdh?: boolean;
  readonly forced?: boolean;
  readonly isArchive?: boolean;
}

// === Query ===

export interface SearchQuery {
  readonly query: string;
  readonly languages: readonly string[];
  readonly season?: number;
  readonly episode?: number;
}

// === Fetch plan (background thực thi) ===

export interface FetchPlan {
  readonly url: string;
  readonly method: 'GET' | 'POST';
  readonly headers?: Record<string, string>;
  readonly body?: string;
  readonly responseType?: 'text' | 'arraybuffer';
}

// === Error taxonomy ===

export type SearchError =
  | { readonly type: 'no-key'; readonly provider: string }
  | { readonly type: 'quota-exhausted'; readonly provider: string }
  | { readonly type: 'rate-limited'; readonly provider: string; readonly retryAfterMs: number }
  | { readonly type: 'auth-invalid'; readonly provider: string }
  | { readonly type: 'network'; readonly message: string }
  | { readonly type: 'parse'; readonly message: string };

// === Provider interface ===

export interface SubtitleSearchProvider {
  readonly id: 'subdl' | 'opensubtitles';
  normalizeSearch(raw: unknown, query: SearchQuery): SubtitleSearchResult[];
  buildSearchRequest(query: SearchQuery, apiKey: string): FetchPlan;
  buildDownloadRequest(result: SubtitleSearchResult, apiKey: string): FetchPlan;
  decodeDownload(bytes: ArrayBuffer, result: SubtitleSearchResult): { content: string; format: 'srt' | 'vtt' | 'ass' };
}

// === Download result (background → content-script) ===

export interface SubtitleDownloadResult {
  readonly content: string;
  readonly format: 'srt' | 'vtt' | 'ass';
}

// === Search response (background → content-script) ===

export interface SubtitleSearchResponse {
  readonly results: SubtitleSearchResult[];
}

// === Key quota info (background → UI) ===

export interface KeyQuotaInfo {
  readonly keyId: string;
  readonly remaining: number;
  readonly resetAt: number;
}
