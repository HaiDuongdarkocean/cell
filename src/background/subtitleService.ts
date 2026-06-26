import type { DetectedSubtitle, Settings } from '@/types/media';
import type { SubtitleForOverlayResult } from '@/types/message';

/**
 * Find best matching subtitle for overlay based on target language.
 *
 * Validation rules:
 * - targetLanguage empty → no match (user hasn't set target language)
 * - subtitle.language must match targetLanguage (ISO 639-1, case-insensitive)
 * - autoLoadEnabled must be true
 * - Returns first matching subtitle (deterministic)
 *
 * @param subtitles - Detected subtitles on the tab
 * @param settings - User settings (target language + auto-load toggle)
 * @returns Matching subtitle info, or null if no match / disabled
 */
export function findSubtitleForOverlay(
  subtitles: DetectedSubtitle[],
  settings: Settings,
): SubtitleForOverlayResult | null {
  if (!settings.subtitleOverlayAutoLoad) return null;
  if (!settings.subtitleOverlayTargetLanguage.trim()) return null;

  const target = settings.subtitleOverlayTargetLanguage.toLowerCase().trim();
  const match = subtitles.find((s) => s.language.toLowerCase() === target);

  if (!match) return null;

  return {
    url: match.url,
    language: match.language,
    format: match.format,
  };
}
