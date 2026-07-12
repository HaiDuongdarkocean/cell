import type { DetectedSubtitle } from '@/entities/media';

/**
 * iQIYI subtitle detection — map `window.playerObject.stl` tracks to the
 * extension's `DetectedSubtitle[]` for the auto-load flow.
 *
 * iQIYI serves subtitles via a CDN whose URLs do NOT match the generic
 * `SUBTITLE_URL_PATTERNS` (hash paths like `/20260115/6c/7b/c112...srt?...`,
 * no `/subtitles|subs|caption|cc/` path segment). Detection is therefore
 * proactive: the MAIN-world script reads `window.playerObject.package.engine
 * .movieinfo.current.originalData.data.program.stl[]` and forwards the tracks
 * to the isolated-world content-script via `postMessage` (ADR-028).
 *
 * This module is pure (no DOM, no Chrome API) so it is unit-testable in
 * isolation. The MAIN-world script wires it to the page; the unified
 * background handler (`detectionDispatch.ts`) wires it to the auto-load flow.
 *
 * Sources:
 * - Stress test 2026-07-12 via edge-devtools MCP (free ep56 `c4ww2kwbfg` +
 *   VIP ep51 `l10pr7s8ho`, logged in).
 * - ADR-028 (interface contracts).
 */

/** iQIYI subtitle track from `playerObject.stl` (subset of fields used). */
export interface IqiyiSubtitleTrack {
  readonly _name: string; // "Vietnamese", "English", ...
  readonly lid: number; // language ID (1=zh-hans, 23=vi, ...)
  readonly ss: number; // 0=human, 1=AI-generated
  readonly srt: string; // relative path to SRT (e.g. "/20260115/6c/7b/c112...srt?...")
  readonly webvtt?: string;
  readonly xml?: string;
  readonly _limited?: number;
  readonly uuid?: string;
}

/**
 * iQIYI numeric language ID → ISO 639-1 / IETF tag (lowercase, matches the
 * auto-load flow's language matching). Verified 2026-07-12 against 12
 * languages on free ep56 + 11 on VIP ep51.
 *
 * ponytail: ceiling — IQ adds a `lid` not in this map → track skipped +
 * console.warn (graceful degradation, clone YouTube PO Token skip).
 * Upgrade: fetch IQ language list API (if exposed) or user-configurable map.
 */
const LID_TO_ISO: Readonly<Record<number, string>> = {
  1: 'zh-hans', // Simplified Chinese
  2: 'zh-hant', // Traditional Chinese
  3: 'en', // English
  4: 'ko', // Korean
  5: 'ja', // Japanese
  6: 'fr', // French
  18: 'th', // Thai
  21: 'ms', // Bahasa Malaysia
  23: 'vi', // Vietnamese
  24: 'id', // Bahasa Indonesia
  26: 'es', // Spanish
  30: 'de', // German
};

/** Referer the iQIYI CDN requires for subtitle fetches (set as `initiator`). */
const IQ_INITIATOR = 'https://www.iq.com/';

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Safely walk the deep `playerObject` path to `stl[]` (defensive parsing).
 * Path: `package.engine.movieinfo.current.originalData.data.program.stl`.
 * Returns `[]` when the structure is missing or malformed — callers treat
 * empty as "no subtitles" (trigger overlay clear on SPA nav, clone ADR-020).
 */
export function extractIqiyiStl(playerObject: unknown): IqiyiSubtitleTrack[] {
  if (typeof playerObject !== 'object' || playerObject === null) return [];
  try {
    const pkg = (playerObject as Record<string, unknown>).package;
    if (typeof pkg !== 'object' || pkg === null) return [];
    const engine = (pkg as Record<string, unknown>).engine;
    if (typeof engine !== 'object' || engine === null) return [];
    const movieinfo = (engine as Record<string, unknown>).movieinfo;
    if (typeof movieinfo !== 'object' || movieinfo === null) return [];
    const current = (movieinfo as Record<string, unknown>).current;
    if (typeof current !== 'object' || current === null) return [];
    const originalData = (current as Record<string, unknown>).originalData;
    if (typeof originalData !== 'object' || originalData === null) return [];
    const data = (originalData as Record<string, unknown>).data;
    if (typeof data !== 'object' || data === null) return [];
    const program = (data as Record<string, unknown>).program;
    if (typeof program !== 'object' || program === null) return [];
    const stl = (program as Record<string, unknown>).stl;
    if (!Array.isArray(stl)) return [];
    return stl.filter(
      (t): t is IqiyiSubtitleTrack =>
        typeof t === 'object' &&
        t !== null &&
        typeof (t as IqiyiSubtitleTrack).srt === 'string' &&
        typeof (t as IqiyiSubtitleTrack).lid === 'number',
    );
  } catch {
    return [];
  }
}

/**
 * Build the absolute SRT URL from a track's relative `srt` path and the
 * manifest's `dstl` base URL. Uses `URL` resolution to avoid double-slash
 * bugs when `dstl` has a trailing slash (spec-reviewer risk #7 fix).
 */
export function buildSrtUrl(track: IqiyiSubtitleTrack, origin: string): string {
  try {
    return new URL(track.srt, origin).href;
  } catch {
    // Malformed `srt` or `origin` — return as-is and let the fetch fail
    // downstream (graceful degradation, logged by fetchAndParseSubtitle).
    return track.srt;
  }
}

/**
 * Map iQIYI `stl[]` → `DetectedSubtitle[]` for the extension's auto-load flow.
 *
 * - `url` = `new URL(entry.srt, origin).href` (full URL, format `'srt'`).
 * - `language` = `LID_TO_ISO[entry.lid]` (skip unknown lid + console.warn —
 *   graceful degradation, clone YouTube PO Token skip).
 * - `isAsr` = `entry.ss === 1` (AI-generated subtitle).
 * - `displayName` = `entry._name` ("Vietnamese", ...).
 * - `initiator` = `'https://www.iq.com/'` (Referer for CORS/DNR fallback).
 *
 * @param tracks - `stl[]` from `playerObject...program.stl`.
 * @param tabId - Current tab ID.
 * @param origin - `data.dstl` base URL (HTTP upgraded to HTTPS by caller).
 * @returns `DetectedSubtitle[]` (empty if no tracks or all skipped).
 */
export function mapIqiyiSubtitleTracks(
  tracks: readonly IqiyiSubtitleTrack[],
  tabId: number,
  origin: string,
): DetectedSubtitle[] {
  const now = Date.now();
  const out: DetectedSubtitle[] = [];

  for (const track of tracks) {
    const language = LID_TO_ISO[track.lid];
    if (!language) {
      console.warn(
        `[iqiyi-detector] skipping track with unknown lid: ${track.lid} (${track._name})`,
      );
      continue;
    }

    out.push({
      id: generateId(),
      url: buildSrtUrl(track, origin),
      format: 'srt',
      language,
      tabId,
      detectedAt: now,
      isAsr: track.ss === 1,
      displayName: track._name,
      initiator: IQ_INITIATOR,
    });
  }

  return out;
}
