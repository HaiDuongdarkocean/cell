import type { ConversionPhase } from '@/entities/media';

/**
 * Format a byte count into a human-readable string with binary units.
 *
 * @example formatBytes(0) → '0 B'
 * @example formatBytes(1024) → '1.0 KB'
 * @example formatBytes(1048576) → '1.0 MB'
 * @example formatBytes(445.6 * 1024 * 1024) → '445.6 MB'
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / Math.pow(1024, i);
  // Show 1 decimal for KB+, no decimals for B
  const formatted = i === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${formatted} ${units[i]}`;
}

/**
 * Format an optional byte count for display. Returns empty string for
 * undefined/zero values (used in UI where empty is preferable to "0 B").
 *
 * @example formatFileSize(undefined) → ''
 * @example formatFileSize(0) → ''
 * @example formatFileSize(1024) → '1.0 KB'
 */
export function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
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
