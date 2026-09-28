import type { ConversionPhase } from '@/entities/media';
import { formatBytes } from '@/shared/lib/formatBytes';
import { t } from '@/shared/i18n';
import type { MessageKey } from '@/shared/i18n';

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
 * Like {@link formatFileSize} but returns a localized fallback for
 * undefined/zero, for UI contexts where an explicit label is preferable
 * to empty string.
 */
export function formatFileSizeOrUnknown(bytes?: number): string {
  return bytes ? formatFileSize(bytes) : t('downloads.media.sizeUnknown');
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
const PHASE_LABEL_KEYS: Record<ConversionPhase, MessageKey> = {
  planning: 'downloads.phase.planning',
  transmuxing: 'downloads.phase.transmuxing',
  merging: 'downloads.phase.merging',
  validating: 'downloads.phase.validating',
  done: 'jobs.status.done',
};

/**
 * Get a human-readable label for a conversion phase.
 * Falls back to the raw phase string if unknown.
 */
export function phaseToLabel(phase: string): string {
  const key = PHASE_LABEL_KEYS[phase as ConversionPhase];
  return key ? t(key) : phase;
}
