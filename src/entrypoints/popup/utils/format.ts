import type { ConversionPhase } from '@/entities/media';
import { formatBytes } from '@/shared/lib/formatBytes';

/**
 * Format an optional byte count for display. Returns empty string for
 * undefined/zero values (used in UI where empty is preferable to "0 B").
 *
 * @example formatFileSize(undefined) → ''
 * @example formatFileSize(0) → ''
 * @example formatFileSize(1024) → '1.0 KB'
 */
export function formatFileSize(bytes?: number): string {
  return bytes ? formatBytes(bytes) : '';
}

/**
 * Like {@link formatFileSize} but returns 'Unknown' for undefined/zero,
 * for UI contexts where an explicit label is preferable to empty string.
 */
export function formatFileSizeOrUnknown(bytes?: number): string {
  return bytes ? formatFileSize(bytes) : 'Unknown';
}

/**
 * Format a duration in milliseconds for display.
 *
 * @example formatDuration(undefined) → ''
 * @example formatDuration(500) → '500ms'
 * @example formatDuration(2500) → '2.5s'
 */
export function formatDuration(ms?: number): string {
  if (!ms || ms <= 0) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Human-readable label for each conversion phase.
 */
const PHASE_LABELS: Record<ConversionPhase, string> = {
  planning: 'Planning',
  transmuxing: 'Converting',
  merging: 'Merging',
  validating: 'Validating',
  done: 'Done',
};

/**
 * Get a human-readable label for a conversion phase.
 * Falls back to the raw phase string if unknown.
 */
export function phaseToLabel(phase: string): string {
  return PHASE_LABELS[phase as ConversionPhase] ?? phase;
}
