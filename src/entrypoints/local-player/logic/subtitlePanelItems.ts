/**
 * Build `SubtitlePanelItem[]` for the subtitle manager from `SubtitlesState`.
 *
 * Local-player sources subtitles from a single directory scan — no auto/import/
 * searched/translated distinction like content-script. All tracks are "imported"
 * (user-picked folder). Target + native + others are flattened into per-role
 * item lists with stable indices.
 */
import type { SubtitleMatch } from '@/features/local-player/logic/subtitleMatch';
import type { SubtitlesState } from '@/entrypoints/local-player/hooks/useLocalPlayerStore';
import type { SubtitlePanelItem } from '@/features/subtitle/ui/subtitlePanelModel';

/** Extract format from filename extension (lowercase, no dot). */
function fileFormat(filename: string): string {
  const dotIdx = filename.lastIndexOf('.');
  return dotIdx > 0 ? filename.slice(dotIdx + 1).toLowerCase() : 'srt';
}

/** Build a display name from a SubtitleMatch: language code + tags. */
function matchDisplayName(match: SubtitleMatch): string {
  const parts: string[] = [];
  if (match.languageCode) {
    parts.push(match.languageCode);
  }
  for (const tag of match.tags) {
    parts.push(tag);
  }
  // Fallback: filename without extension
  if (parts.length === 0) {
    const dotIdx = match.filename.lastIndexOf('.');
    return dotIdx > 0 ? match.filename.slice(0, dotIdx) : match.filename;
  }
  return parts.join('.');
}

/** Convert a SubtitleMatch to a SubtitlePanelItem. */
function matchToItem(match: SubtitleMatch, role: 'target' | 'native', index: number): SubtitlePanelItem {
  return {
    id: `${role}-${match.filename}`,
    name: matchDisplayName(match),
    format: fileFormat(match.filename),
    source: 'imported',
    role,
    index,
  };
}

export interface BuiltPanelItems {
  targetItems: SubtitlePanelItem[];
  nativeItems: SubtitlePanelItem[];
  targetActiveIndex: number;
  nativeActiveIndex: number;
}

/**
 * Build manager panel items from SubtitlesState.
 *
 * Target section: the current target match (if any).
 * Native section: the current native match (if any).
 * "Others" are NOT shown in the manager — they're available via the TrackSelector
 * overlay which already handles switching. The manager is for re-selecting
 * the active target/native within the matched set.
 *
 * If target is null → targetItems is empty, activeIndex = -1.
 * If native is null → nativeItems is empty, activeIndex = -1.
 */
export function buildPanelItemsFromSubtitles(subtitles: SubtitlesState): BuiltPanelItems {
  const targetItems: SubtitlePanelItem[] = [];
  const nativeItems: SubtitlePanelItem[] = [];

  if (subtitles.target) {
    targetItems.push(matchToItem(subtitles.target, 'target', 0));
  }
  if (subtitles.native) {
    nativeItems.push(matchToItem(subtitles.native, 'native', 0));
  }

  return {
    targetItems,
    nativeItems,
    targetActiveIndex: targetItems.length > 0 ? 0 : -1,
    nativeActiveIndex: nativeItems.length > 0 ? 0 : -1,
  };
}
