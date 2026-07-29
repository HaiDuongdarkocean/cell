/**
 * Shared subtitle panel model types and pure helpers.
 *
 * Used by the React `SubtitleManagerPanel` to avoid pulling in the DOM API.
 */

export interface SubtitlePanelItem {
  readonly id: string;
  /** Display name (e.g. "English #2" or "my-subtitle"). */
  readonly name: string;
  /** srt/vtt/ass */
  readonly format: string;
  /** Bytes, optional. */
  readonly size?: number;
  readonly source: 'auto' | 'imported' | 'translated';
  readonly role: 'target' | 'native';
  /** Position within role section. */
  readonly index: number;
  /** YouTube auto-generated captions badge. */
  readonly isAsr?: boolean;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function extractLanguageName(name: string): string {
  // "English #2" → "English"; "my-subtitle" → ""
  const match = name.match(/^([A-Za-z\s]+)\s*#/);
  return match ? match[1].trim() : '';
}
