import type { DetectedSubtitle, Settings } from '@/types/media';
import type { SubtitleForOverlayResult, SubtitlesForOverlayResult } from '@/types/message';

/**
 * Find matching subtitles for bilingual overlay based on target + native language.
 *
 * Validation rules:
 * - autoLoad off → null (skip)
 * - both languages empty → null (nothing to load)
 * - otherwise: find first subtitle matching each language (case-insensitive, trimmed)
 * - if neither language matches any subtitle → null
 * - if only one matches → partial load ({ target, native } with one side null)
 * - V1: first-match wins when 2+ subtitles share a language (no dropdown — ADR-007 D3)
 *
 * @param subtitles - Detected subtitles on the tab
 * @param settings - User settings (target + native language, auto-load toggle)
 * @returns { target, native } with either side possibly null, or null when disabled/no-match
 */
export function findSubtitlesForOverlay(
  subtitles: DetectedSubtitle[],
  settings: Settings,
): SubtitlesForOverlayResult | null {
  if (!settings.subtitleOverlayAutoLoad) return null;

  const targetLang = settings.subtitleOverlayTargetLanguage.toLowerCase().trim();
  const nativeLang = settings.subtitleOverlayNativeLanguage.toLowerCase().trim();

  if (!targetLang && !nativeLang) return null;

  const target = findFirstMatch(subtitles, targetLang);
  const native = findFirstMatch(subtitles, nativeLang);

  if (!target && !native) return null;

  return { target, native };
}

/**
 * Preference-aware subtitle match (ADR-014 D2). Replaces `findFirstMatch` for
 * V2 subtitle selector — returns sub at `preferredIndex` when ≥2 sub same lang,
 * falls back to first-match (index 0) when `preferredIndex` undefined or out of
 * range (site changed sub list, B8 graceful degradation).
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
  const matches = subtitles.filter(
    (s) => s.language.toLowerCase() === language.toLowerCase(),
  );
  if (matches.length === 0) return null;
  const index =
    preferredIndex !== undefined && preferredIndex < matches.length
      ? preferredIndex
      : 0;
  const match = matches[index];
  return { url: match.url, language: match.language, format: match.format };
}

function findFirstMatch(
  subtitles: DetectedSubtitle[],
  language: string,
): SubtitleForOverlayResult | null {
  if (!language) return null;
  const match = subtitles.find((s) => s.language.toLowerCase() === language);
  if (!match) return null;
  return {
    url: match.url,
    language: match.language,
    format: match.format,
  };
}
