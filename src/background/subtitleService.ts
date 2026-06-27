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
