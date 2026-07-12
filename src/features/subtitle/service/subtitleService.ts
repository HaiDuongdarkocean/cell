import type { DetectedSubtitle, Settings } from '@/entities/media';
import type { SubtitleForOverlayResult, SubtitlesForOverlayResult } from '@/entities/message';
// ADR-029: languageMatches now lives in the single-source-of-truth registry.
// Re-export so existing callers (`@/features/subtitle`) keep working.
export { languageMatches } from '@/shared/config/languageRegistry';
import { languageMatches } from '@/shared/config/languageRegistry';

/**
 * Per-language preference indices for `findSubtitlesForOverlay` (ADR-014 D2).
 * `target`/`native` = 0-based index into filtered matches (undefined = first).
 * Origin-extracted by caller from `new URL(tabUrl).hostname`.
 */
export interface SubtitlePreference {
  readonly target?: number;
  readonly native?: number;
}

/**
 * Find matching subtitles for bilingual overlay based on target + native language.
 *
 * Validation rules:
 * - autoLoad off → null (skip)
 * - both languages empty → null (nothing to load)
 * - otherwise: find subtitle matching each language (case-insensitive, trimmed,
 *   BCP 47 subtag-aware via `languageMatches`)
 *   using `findPreferredMatch` (preference-aware, ADR-014 D2)
 * - if neither language matches any subtitle → null
 * - if only one matches → partial load ({ target, native } with one side null)
 * - V2: preference index khi ≥2 sub cùng lang (ADR-014 D2, fallback first-match B8)
 *
 * @param subtitles - Detected subtitles on the tab
 * @param settings - User settings (target + native language, auto-load toggle)
 * @param preferences - Optional per-language preference indices (ADR-014 D2)
 * @returns { target, native } with either side possibly null, or null when disabled/no-match
 */
export function findSubtitlesForOverlay(
  subtitles: DetectedSubtitle[],
  settings: Settings,
  preferences?: SubtitlePreference,
): SubtitlesForOverlayResult | null {
  if (!settings.subtitleOverlayAutoLoad) return null;

  const targetLang = settings.subtitleOverlayTargetLanguage.toLowerCase().trim();
  const nativeLang = settings.subtitleOverlayNativeLanguage.toLowerCase().trim();

  if (!targetLang && !nativeLang) return null;

  // V6: filter out ASR tracks when auto-load ASR toggle is OFF. Applies to
  // both target + native. Manual captions only when OFF.
  const includeAsr = settings.subtitleOverlayAutoLoadAsr;
  const eligible = includeAsr ? subtitles : subtitles.filter((s) => !s.isAsr);

  const target = findPreferredMatch(eligible, targetLang, preferences?.target);
  const native = findPreferredMatch(eligible, nativeLang, preferences?.native);

  if (!target && !native) return null;

  // ADR-014 D3: include all matches for dropdown (V2 subtitle selector).
  // Only populated when ≥2 matches (V1 behavior when 1 match).
  const targetMatches =
    targetLang && eligible.filter((s) => languageMatches(targetLang, s.language)).length >= 2
      ? eligible
          .filter((s) => languageMatches(targetLang, s.language))
          .map((s) => ({
            url: s.url,
            language: s.language,
            format: s.format,
            isAsr: s.isAsr,
            displayName: s.displayName,
            initiator: s.initiator,
          }))
      : [];
  const nativeMatches =
    nativeLang && eligible.filter((s) => languageMatches(nativeLang, s.language)).length >= 2
      ? eligible
          .filter((s) => languageMatches(nativeLang, s.language))
          .map((s) => ({
            url: s.url,
            language: s.language,
            format: s.format,
            isAsr: s.isAsr,
            displayName: s.displayName,
            initiator: s.initiator,
          }))
      : [];

  return { target, native, targetMatches, nativeMatches };
}

/**
 * Preference-aware subtitle match (ADR-014 D2). Replaces `findFirstMatch` for
 * V2 subtitle selector — returns sub at `preferredIndex` when ≥2 sub same lang,
 * falls back to first-match (index 0) when `preferredIndex` undefined or out of
 * range (site changed sub list, B8 graceful degradation).
 *
 * Matching is BCP 47 subtag-aware (e.g. target `zh` matches `zh-hans`)
 * so that iQIYI's Chinese variants auto-select when the user setting is `zh`.
 *
 * @param subtitles - Detected subtitles on the tab
 * @param language - ISO 639-1 language code (case-insensitive, trimmed)
 * @param preferredIndex - 0-based index into filtered matches (undefined = first)
 * @returns matching subtitle or null when no match / empty language
 */
export function findPreferredMatch(
  subtitles: DetectedSubtitle[],
  language: string,
  preferredIndex?: number,
): SubtitleForOverlayResult | null {
  if (!language) return null;
  const matches = subtitles.filter((s) => languageMatches(language, s.language));
  if (matches.length === 0) return null;
  const index =
    preferredIndex !== undefined && preferredIndex < matches.length
      ? preferredIndex
      : 0;
  const match = matches[index];
  return {
    url: match.url,
    language: match.language,
    format: match.format,
    isAsr: match.isAsr,
    displayName: match.displayName,
    initiator: match.initiator,
  };
}
