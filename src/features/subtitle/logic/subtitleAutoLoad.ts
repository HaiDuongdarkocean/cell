/**
 * Configuration for auto-load decision.
 */
export interface AutoLoadConfig {
  readonly autoLoad: boolean;
  readonly targetLanguage: string;
}

/**
 * Configuration for override validation.
 */
export interface OverrideConfig {
  readonly targetLanguage: string;
  readonly fileLanguage: string;
}

export interface OverrideResult {
  readonly allowed: boolean;
  readonly reason?: string;
}

import { parseSubtitle } from './subtitleParser';
import { convertAssToSrt } from '@/shared/lib/parsers/assToSrt';
import {
  isPhimwarSubtitleUrl,
  decryptPhimwarSrtFromUrl,
} from '@/shared/lib/parsers/phimwarDecryption';
import { getCachedSubtitleBody, waitForCachedSubtitleBody } from './subtitleResponseCache';
import { decryptAndDetectFormat } from '@/shared/lib/parsers/encryptedFile';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { SrtCue } from '@/entities/media';
import type { SubtitleFormat, ParseResult } from '@/entities/subtitle';
import type {
  AutoLoadSubtitlesPayload,
  FetchSubtitleContentResult,
  SubtitleForOverlayResult,
} from '@/entities/message';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { formatSubtitleName } from '@/features/subtitle/logic/subtitleNaming';
import type { LoadStatus, LoadErrorType } from '@/stores/cuesStore';

/**
 * Decide whether auto-load should trigger.
 * Auto-load triggers when: autoLoad enabled AND target language is set (non-empty).
 */
export function shouldAutoLoad(config: AutoLoadConfig): boolean {
  return config.autoLoad && config.targetLanguage.trim().length > 0;
}

/**
 * Validate whether a user-dropped/imported subtitle file can override
 * the auto-loaded subtitle.
 *
 * Rule: override allowed only when file language matches target language.
 * When target language is empty (no restriction), any file is allowed.
 *
 * @returns { allowed: true } or { allowed: false, reason }
 */
export function validateOverride(config: OverrideConfig): OverrideResult {
  const target = config.targetLanguage.trim().toLowerCase();

  // No target language set = no restriction
  if (target === '') {
    return { allowed: true };
  }

  const file = config.fileLanguage.trim().toLowerCase();

  if (file === target) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Blocked: file language '${config.fileLanguage}' is different from target language '${config.targetLanguage}'`,
  };
}

// --- Bilingual auto-load: cache + fetch + parse + load (ADR-007 D1, spec F4/F7/F8) ---

/** Fetch timeout (ms) for content-script + background fetch (spec F8, Case 1). */
const FETCH_TIMEOUT_MS = 15_000;

/** Per-URL cache: { cues, format }. Cleared on tab navigate (content-script re-inject). */
const subtitleCache = new Map<string, { cues: SrtCue[]; format: string }>();

/** Clear the auto-load cache (called on content-script re-inject / tab navigate). */
export function clearAutoLoadCache(): void {
  subtitleCache.clear();
}

/**
 * Detect subtitle format from URL extension.
 * ponytail: SRT fallback — most subtitle URLs are SRT, fallback avoids skipping.
 */
export function formatFromUrl(url: string): SubtitleFormat {
  const path = url.split('?')[0]?.split('#')[0] ?? url;
  const ext = path.slice(path.lastIndexOf('.')).toLowerCase();
  if (ext === '.vtt') return 'vtt';
  if (ext === '.ass' || ext === '.ssa') return 'ass';
  // YouTube timedtext URLs have no file extension — detect via `fmt` query
  // param (fmt=vtt → WebVTT, fmt=srv3/srv → XML, fmt=json3 → JSON3).
  // ADR-020: YouTube ANDROID client baseUrl uses fmt=srv3; buildVttUrl
  // rewrites to fmt=vtt for reuse with parseVtt.
  try {
    const fmt = new URL(url).searchParams.get('fmt');
    if (fmt === 'vtt') return 'vtt';
  } catch {
    // Not a valid URL — fall through to srt default.
  }
  return 'srt';
}

/**
 * Resolve subtitle format: prefer the detected format from the subtitle entity
 * (set by the detection mapper — e.g. Netflix sets 'ttml'), fall back to URL
 * extension detection. Netflix CDN URLs have no file extension, so URL-based
 * detection defaults to 'srt' and fails to parse IMSC1.1 TTML content.
 */
export function resolveFormat(detectedFormat: string | undefined, url: string): SubtitleFormat {
  if (detectedFormat === 'ttml' || detectedFormat === 'vtt' || detectedFormat === 'ass' || detectedFormat === 'srt') {
    return detectedFormat;
  }
  return formatFromUrl(url);
}

/**
 * Fetch + parse a subtitle by URL. Caches by URL — second call is a cache hit.
 * ASS/SSA → convert to SRT first (reuse `convertAssToSrt`).
 *
 * CORS fallback (spec F9, ADR-007 A7): if the content-script fetch fails
 * (TypeError = CORS, or non-ok 403/404), retries via background
 * `FETCH_SUBTITLE_CONTENT` (SW fetch is cross-origin allowed with host
 * permission). `tabUrl` is passed so background can resolve relative URLs.
 *
 * `initiator` (iframe player origin) is sent to the background fallback as
 * the `Referer` source — many subtitle CDNs reject the top-level tab URL and
 * return 403. The content-script fetch itself cannot set `Referer` (browser
 * controls it), so the background fallback is the only path that benefits.
 *
 * Returns ParseResult (success: false on fetch/parse failure, never throws).
 */
export async function fetchAndParseSubtitle(
  url: string,
  format: SubtitleFormat,
  tabUrl?: string,
  initiator?: string,
): Promise<ParseResult> {
  const cached = subtitleCache.get(url);
  if (cached) {
    return { success: true, cues: cached.cues, format: cached.format as SubtitleFormat };
  }

  // Ephemeral-token subtitle URLs are cached when the player fetches them.
  // `blob:` URLs can only be read in the MAIN world, so we wait for the
  // interceptor to deliver the body before falling back. Ordinary `https:`
  // URLs are replayable in most cases, so we only do a cheap cache peek.
  let content: string | undefined;
  if (/^blob:/i.test(url)) {
    content = await waitForCachedSubtitleBody(url, 5000);
  } else {
    content = getCachedSubtitleBody(url);
  }
  if (!content) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(url, { signal: controller.signal });
      } catch (err) {
        clearTimeout(timeoutId);
        // AbortError = our 15s timeout → return immediately (no background retry).
        if (err instanceof DOMException && err.name === 'AbortError') {
          return { success: false, cues: [], format, error: 'Fetch timeout (15s)' };
        }
        throw err;
      }
      clearTimeout(timeoutId);
      if (!response.ok) {
        // Non-ok (403/404) → try background fallback before giving up.
        content = await fetchViaBackground(url, tabUrl, initiator);
      } else {
        content = await response.text();
      }
    } catch {
      // TypeError (CORS blocked) → background fallback.
      try {
        content = await fetchViaBackground(url, tabUrl, initiator);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, cues: [], format, error: `Fetch failed: ${msg}` };
      }
    }
  }

  if (!content) {
    // The MAIN-world interceptor may have delivered the body just after the
    // wait timeout or after a failed replay. Check the cache one final time
    // before giving up on token-signed URLs.
    content = getCachedSubtitleBody(url);
    if (!content) {
      return { success: false, cues: [], format, error: 'Subtitle content unavailable' };
    }
  }

  // PhimWar-style encrypted payloads must be decrypted before
  // format detection. Prefer content-based format detection so a wrong default
  // (e.g. SRT for an API endpoint) does not break parsing.
  if (isPhimwarSubtitleUrl(url)) {
    try {
      content = await decryptPhimwarSrtFromUrl(url, content);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        cues: [],
        format,
        error: `PhimWar decryption failed: ${msg}`,
      };
    }
  }

  // Decrypt HUBPHIM-style payloads and sniff the real format. Trust content
  // over the caller-supplied format, because API endpoints like tophim's
  // /api/subtitles/play have no extension to reveal the format.
  // Guard: malformed encrypted payloads can throw; fetchAndParseSubtitle must
  // never throw (it returns ParseResult with success:false).
  let detectedFormat: SubtitleFormat = format;
  try {
    const { content: decryptedContent, format: contentFormat } = decryptAndDetectFormat(content);
    content = decryptedContent;
    if (contentFormat) {
      detectedFormat = contentFormat;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, cues: [], format, error: `Decryption failed: ${msg}` };
  }

  // ASS/SSA → convert to SRT, then parse as SRT.
  if (detectedFormat === 'ass' || detectedFormat === 'ssa') {
    const srtContent = convertAssToSrt(content);
    if (!srtContent) {
      return { success: false, cues: [], format: detectedFormat, error: 'ASS conversion produced no cues' };
    }
    const result = parseSubtitle(srtContent, 'srt');
    if (result.success) subtitleCache.set(url, { cues: result.cues, format: 'srt' });
    return result;
  }

  const result = parseSubtitle(content, detectedFormat);
  if (result.success) subtitleCache.set(url, { cues: result.cues, format: result.format });
  return result;
}

/**
 * Fallback: ask background to fetch the subtitle (CORS bypass via SW).
 * Throws on failure (caller catches + reports).
 */
async function fetchViaBackground(url: string, tabUrl?: string, initiator?: string): Promise<string> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Fetch timeout (15s)')), FETCH_TIMEOUT_MS);
  });
  const response = await Promise.race([
    sendMessage<{ content?: string; error?: string }>({
      type: MESSAGE_TYPES.FETCH_SUBTITLE_CONTENT,
      payload: { url, tabUrl, initiator },
    }),
    timeoutPromise,
  ]) as { success?: boolean; data?: FetchSubtitleContentResult; error?: string } | undefined;
  if (!response?.success || !response.data?.content) {
    throw new Error(response?.error ?? 'background fetch returned no content');
  }
  return response.data.content;
}

/** Controller shape accepted by `handleAutoLoadSubtitles` (decoupled from SubtitleOverlayController). */
export interface AutoLoadController {
  loadBilingualCues(targetCues: SrtCue[], nativeCues: SrtCue[]): void;
  loadCues(cues: SrtCue[]): void;
  clearCues(): void;
}

/** Side-effects passed to `handleAutoLoadSubtitles` (kept injectable for testing). */
export interface AutoLoadDeps {
  readonly controller: AutoLoadController;
  readonly onPanelRender?: (targetCues: SrtCue[], nativeCues: SrtCue[]) => void;
  /** Inline load status per role — replaces toast for auto-load notifications.
   *  The controller updates cuesStore; SubtitleBlock shows the status inline
   *  when no active cue is visible (subtitle appearing = success). */
  readonly onLoadStatus?: (role: 'target' | 'native', status: LoadStatus) => void;
  /** Page URL for resolving relative subtitle URLs (CORS fallback, spec F9). */
  readonly tabUrl?: string;
  /**
   * ADR-014 D3: called when ≥2 sub same lang detected (for dropdown render).
   * Receives all matches + active index per role. Empty array = no dropdown.
   */
  readonly onSubtitleMatches?: (target: readonly SubtitleForOverlayResult[], native: readonly SubtitleForOverlayResult[]) => void;
  /**
   * ADR-021: called when target cues loaded but no native track + autoTranslate ON.
   * Caller starts BackgroundPrefillController to translate target→native.
   * Receives target cues (already parsed). Caller manages prefill lifecycle.
   */
  readonly onStartTranslatePrefill?: (targetCues: SrtCue[]) => void;
  /** ADR-021: auto-translate setting (true = translate when native missing). */
  readonly autoTranslate?: boolean;
}

/**
 * Resolve a subtitle display name — SSOT with the manager panel.
 * Uses `formatSubtitleName` (same function the panel uses) so the inline
 * status shows the exact same name the user sees in the track list.
 * Auto-load picks the first match → index 0 → "English #1" or
 * "English (auto-generated) #1" (YouTube displayName) or "Sub #1" (fallback).
 */
function resolveSubtitleName(sub: SubtitleForOverlayResult): string {
  return formatSubtitleName('auto', sub.language, 0, undefined, sub.displayName);
}

/**
 * Detect a user-friendly error type from a fetch/parse error message.
 * Order: timeout → offline → not-found → invalid → unknown (spec F8).
 */
function detectErrorType(error: string | undefined): LoadErrorType {
  if (error && error.toLowerCase().includes('timeout')) return 'timeout';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  if (error) {
    const lower = error.toLowerCase();
    if (lower.includes('404') || lower.includes('not found')) return 'not-found';
    if (lower.includes('parse') || lower.includes('invalid') || lower.includes('conversion')) return 'invalid';
  }
  return 'unknown';
}

/**
 * Handle `AUTO_LOAD_SUBTITLES` payload: fetch + parse target + native (cache
 * by URL), then load bilingual cues into the overlay controller + re-render
 * the panel. Re-renders fully each time (no accumulation across pushes —
 * spec F7). Partial load: either target or native may be null.
 *
 * Never throws — fetch/parse failures are reported via `onLoadStatus` and the
 * failing side is treated as empty cues (spec F8). Success needs no
 * notification: the subtitle appearing in the block IS the success feedback.
 */
export async function handleAutoLoadSubtitles(
  payload: AutoLoadSubtitlesPayload,
  deps: AutoLoadDeps,
): Promise<void> {
  const { target, native } = payload;
  if (!target && !native) {
    return;
  }

  // Signal loading state for each role that has a subtitle to fetch.
  // AC1: native null → no 'native' status call (stays idle in store).
  if (target) deps.onLoadStatus?.('target', { state: 'loading', languageLabel: resolveSubtitleName(target), source: 'auto' });
  if (native) deps.onLoadStatus?.('native', { state: 'loading', languageLabel: resolveSubtitleName(native), source: 'auto' });

  const [targetResult, nativeResult] = await Promise.all([
    target ? fetchAndParseSubtitle(target.url, resolveFormat(target.format, target.url), deps.tabUrl, target.initiator) : Promise.resolve(null),
    native ? fetchAndParseSubtitle(native.url, resolveFormat(native.format, native.url), deps.tabUrl, native.initiator) : Promise.resolve(null),
  ]);
  const targetCues = targetResult?.success ? targetResult.cues : [];
  const nativeCues = nativeResult?.success ? nativeResult.cues : [];

  // Report fetch/parse failure via inline status (spec F8). Never log full
  // URL (ADR-007 D8). Technical details stay in console; the inline status
  // in the subtitle block area shows a concise, human-readable message.
  if (target && targetResult && !targetResult.success) {
    console.error('[handleAutoLoadSubtitles] target failed', targetResult.error);
    deps.onLoadStatus?.('target', { state: 'error', languageLabel: resolveSubtitleName(target), errorType: detectErrorType(targetResult.error) });
  }
  if (native && nativeResult && !nativeResult.success) {
    console.error('[handleAutoLoadSubtitles] native failed', nativeResult.error);
    deps.onLoadStatus?.('native', { state: 'error', languageLabel: resolveSubtitleName(native), errorType: detectErrorType(nativeResult.error) });
  }

  // AC4 (Case 9): parse succeeded but produced 0 cues (empty file).
  if (target && targetResult?.success && targetCues.length === 0) {
    deps.onLoadStatus?.('target', { state: 'error', languageLabel: resolveSubtitleName(target), errorType: 'empty' });
  }
  if (native && nativeResult?.success && nativeCues.length === 0) {
    deps.onLoadStatus?.('native', { state: 'error', languageLabel: resolveSubtitleName(native), errorType: 'empty' });
  }

  // Both empty (both failed or both null) → nothing to load.
  if (targetCues.length === 0 && nativeCues.length === 0) {
    return;
  }

  // Success: load cues into the overlay. setCues clears the load status for
  // any role that received non-empty cues — the subtitle text appearing in
  // the block IS the success indicator, no toast needed.
  deps.controller.loadBilingualCues(targetCues, nativeCues);
  deps.onPanelRender?.(targetCues, nativeCues);

  // ADR-021: if no native track + autoTranslate ON → start background prefill
  // to translate target→native. Caller (contentScriptController) owns the
  // BackgroundPrefillController instance + manages lifecycle (SPA nav clear,
  // tab hidden pause). Prefill feeds loadBilingualCues on each chunk.
  if (nativeCues.length === 0 && targetCues.length > 0 && deps.autoTranslate && deps.onStartTranslatePrefill) {
    deps.onStartTranslatePrefill(targetCues);
  }

  // ADR-014 D3 + ADR-015: notify content-script of all matches for panel + dropdown render.
  // Show panel/chip when at least 1 subtitle (target or native) is auto-detected —
  // not only when 2+ matches (user needs to see active subtitle state even with 1 sub).
  // targetMatches/nativeMatches are always populated when ≥1 match (so the manager
  // panel shows every available subtitle of the target/native language). The
  // payload.target/native fallback below is now defensive only — targetMatches
  // already covers the 1-match case — but kept for callers that send target
  // without targetMatches.
  if (deps.onSubtitleMatches) {
    const targetM = payload.targetMatches?.length
      ? payload.targetMatches
      : payload.target ? [payload.target] : [];
    const nativeM = payload.nativeMatches?.length
      ? payload.nativeMatches
      : payload.native ? [payload.native] : [];
    if (targetM.length >= 1 || nativeM.length >= 1) {
      deps.onSubtitleMatches(targetM, nativeM);
    }
  }
}
