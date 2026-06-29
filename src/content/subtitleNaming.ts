import { isoCodeToLabel } from '@/lib/detectors/languageDetector';

/**
 * Format a subtitle display name (ADR-015 — friendly naming convention).
 *
 * - **auto-detected**: `{Language} #{N}` where N = index + 1 (e.g. `English #2`).
 *   Uses `isoCodeToLabel` (returns lowercase) → capitalize first letter.
 * - **imported**: `{filename without extension}` (e.g. `my-subtitle` from
 *   `my-subtitle.srt`). Filename >20 chars → truncate + `…`.
 *
 * Pure function — no side effects, fully unit-testable.
 *
 * @param source - 'auto' (detected by extension) | 'imported' (user file)
 * @param language - ISO 639-1 code for 'auto' (e.g. 'en'). Ignored for 'imported'.
 * @param index - 0-based position in the matches list (used for 'auto' numbering)
 * @param filename - Original filename for 'imported' (with extension)
 * @returns Friendly display name
 */
export function formatSubtitleName(
  source: 'auto' | 'imported',
  language: string,
  index: number,
  filename?: string,
): string {
  if (source === 'imported' && filename) {
    const nameWithoutExt = filename.replace(/\.(srt|vtt|ass|ssa)$/i, '');
    return nameWithoutExt.length > 20
      ? nameWithoutExt.slice(0, 20) + '…'
      : nameWithoutExt;
  }
  const label = language ? isoCodeToLabel(language) : null;
  if (!label) return `Sub #${index + 1}`;
  return `${label.charAt(0).toUpperCase()}${label.slice(1)} #${index + 1}`;
}
