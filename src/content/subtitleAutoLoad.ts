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
import { convertAssToSrt } from '@/lib/converters/assToSrt';
import type { SrtCue } from '@/types/media';
import type { SubtitleFormat, ParseResult } from '@/types/subtitle';
import type { AutoLoadSubtitlesPayload } from '@/types/message';

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
  return 'srt';
}

/**
 * Fetch + parse a subtitle by URL. Caches by URL — second call is a cache hit.
 * ASS/SSA → convert to SRT first (reuse `convertAssToSrt`).
 * Returns ParseResult (success: false on fetch/parse failure, never throws).
 */
export async function fetchAndParseSubtitle(
  url: string,
  format: SubtitleFormat,
): Promise<ParseResult> {
  const cached = subtitleCache.get(url);
  if (cached) {
    return { success: true, cues: cached.cues, format: cached.format as SubtitleFormat };
  }

  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, cues: [], format, error: `Fetch failed: ${msg}` };
  }

  if (!response.ok) {
    return { success: false, cues: [], format, error: `HTTP ${response.status}` };
  }

  let content: string;
  try {
    content = await response.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, cues: [], format, error: `Read body failed: ${msg}` };
  }

  // ASS/SSA → convert to SRT, then parse as SRT.
  if (format === 'ass' || format === 'ssa') {
    const srtContent = convertAssToSrt(content);
    if (!srtContent) {
      return { success: false, cues: [], format, error: 'ASS conversion produced no cues' };
    }
    const result = parseSubtitle(srtContent, 'srt');
    if (result.success) subtitleCache.set(url, { cues: result.cues, format: 'srt' });
    return result;
  }

  const result = parseSubtitle(content, format);
  if (result.success) subtitleCache.set(url, { cues: result.cues, format: result.format });
  return result;
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
  readonly onToast?: (message: string) => void;
}

/**
 * Handle `AUTO_LOAD_SUBTITLES` payload: fetch + parse target + native (cache
 * by URL), then load bilingual cues into the overlay controller + re-render
 * the panel. Re-renders fully each time (no accumulation across pushes —
 * spec F7). Partial load: either target or native may be null.
 *
 * Never throws — fetch/parse failures are reported via `onToast` and the
 * failing side is treated as empty cues (spec F8).
 */
export async function handleAutoLoadSubtitles(
  payload: AutoLoadSubtitlesPayload,
  deps: AutoLoadDeps,
): Promise<void> {
  const { target, native } = payload;
  if (!target && !native) return;

  const [targetResult, nativeResult] = await Promise.all([
    target ? fetchAndParseSubtitle(target.url, formatFromUrl(target.url)) : Promise.resolve(null),
    native ? fetchAndParseSubtitle(native.url, formatFromUrl(native.url)) : Promise.resolve(null),
  ]);

  // Toast on fetch/parse failure (spec F8). Never log full URL (ADR-007 D8).
  if (target && targetResult && !targetResult.success) {
    deps.onToast?.(`Auto-load target failed: ${targetResult.error ?? 'unknown'}`);
  }
  if (native && nativeResult && !nativeResult.success) {
    deps.onToast?.(`Auto-load native failed: ${nativeResult.error ?? 'unknown'}`);
  }

  const targetCues = targetResult?.success ? targetResult.cues : [];
  const nativeCues = nativeResult?.success ? nativeResult.cues : [];

  // Both empty (both failed or both null) → nothing to load.
  if (targetCues.length === 0 && nativeCues.length === 0) return;

  deps.controller.loadBilingualCues(targetCues, nativeCues);
  deps.onPanelRender?.(targetCues, nativeCues);
}
