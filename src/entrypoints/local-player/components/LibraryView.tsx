import { useMemo } from 'react';
import type { VideoRecord, SubtitleRecord } from '@/features/local-player/services/mediaLibraryRepository';
import type { SortBy } from '@/features/local-player/logic/librarySort';
import type { SubtitleMatch, MatchResult } from '@/features/local-player/logic/subtitleMatch';
import { matchSubtitles } from '@/features/local-player/logic/subtitleMatch';
import type { SubtitlesState } from '@/entrypoints/local-player/hooks/useLocalPlayerStore';
import { Select } from '@/shared/ui';
import { Button } from '@/shared/ui';
import { Icon } from '@/shared/icons/Icon';
import { LibraryCard } from './LibraryCard';
import styles from './LibraryView.module.css';

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'recent', label: 'Recently watched' },
  { value: 'title', label: 'Title' },
  { value: 'added', label: 'Date added' },
];

const TARGET_LANG = 'en';
const NATIVE_LANG = 'vi';

interface LibraryViewProps {
  videos: VideoRecord[];
  subtitles: SubtitleRecord[];
  sortBy: SortBy;
  onSortChange: (sortBy: SortBy) => void;
  onVideoSelect: (videoId: string) => void;
  onSubtitleSelect: (subtitleId: string) => void;
  onSelectTrack: (match: SubtitleMatch) => void;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  currentVideoId: string | null;
  currentSubtitles: SubtitlesState;
  onVideoDelete: (videoId: string) => void;
  onClearAll: () => void;
}

/**
 * Compute all subtitle matches for a video as a flat list.
 * Combines target, native, and others into a single array.
 */
function allMatches(result: MatchResult): SubtitleMatch[] {
  return [result.target, result.native, ...result.others].filter(Boolean) as SubtitleMatch[];
}

/**
 * LibraryView — playlist panel with video list + footer.
 *
 * No header, no tabs. Each video row shows a ring progress + title.
 * Expanding a row reveals Target + Native subtitle dropdowns.
 * Footer has a sort dropdown + Add files/folder buttons.
 */
export function LibraryView({
  videos,
  subtitles,
  sortBy,
  onSortChange,
  onVideoSelect,
  onSelectTrack,
  onOpenFile,
  onOpenFolder,
  currentVideoId,
  currentSubtitles,
  onVideoDelete,
  onClearAll,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onSubtitleSelect: _onSubtitleSelect,
}: LibraryViewProps): React.JSX.Element {
  const subtitleFilenames = useMemo(
    () => subtitles.map((s) => s.filename),
    [subtitles],
  );

  const matchesByVideoId = useMemo(() => {
    const map = new Map<string, SubtitleMatch[]>();
    for (const video of videos) {
      const result = matchSubtitles(video.filename, subtitleFilenames, TARGET_LANG, NATIVE_LANG);
      map.set(video.id, allMatches(result));
    }
    return map;
  }, [videos, subtitleFilenames]);

  const selectedByVideoId = useMemo(() => {
    const map = new Map<string, { target: string | null; native: string | null }>();
    for (const video of videos) {
      const matches = matchesByVideoId.get(video.id) ?? [];
      if (video.id === currentVideoId) {
        map.set(video.id, {
          target: currentSubtitles.target?.filename ?? matches[0]?.filename ?? null,
          native: currentSubtitles.native?.filename ?? null,
        });
      } else {
        const result = matchSubtitles(video.filename, subtitleFilenames, TARGET_LANG, NATIVE_LANG);
        map.set(video.id, {
          target: result.target?.filename ?? null,
          native: result.native?.filename ?? null,
        });
      }
    }
    return map;
  }, [videos, matchesByVideoId, currentVideoId, currentSubtitles, subtitleFilenames]);

  return (
    <div className={styles.root}>
      {videos.length === 0 ? (
        <div className={styles.empty} data-cell-id="library-empty" role="status">
          <div className={styles.emptyIcon}>
            <Icon name="video" size={48} />
          </div>
          <div className={styles.emptyTitle}>No videos yet</div>
          <div className={styles.emptyDesc}>
            Open a video file to add it to your library.
          </div>
        </div>
      ) : (
        <div className={styles.list}>
          {videos.map((video) => {
            const matches = matchesByVideoId.get(video.id) ?? [];
            const selected = selectedByVideoId.get(video.id) ?? { target: null, native: null };
            return (
              <LibraryCard
                key={video.id}
                video={video}
                isActive={video.id === currentVideoId}
                subtitleMatches={matches}
                selectedTarget={selected.target}
                selectedNative={selected.native}
                onVideoSelect={onVideoSelect}
                onSelectTrack={onSelectTrack}
                onVideoDelete={onVideoDelete}
              />
            );
          })}
        </div>
      )}

      <footer className={styles.footer}>
        <Select
          options={SORT_OPTIONS}
          value={sortBy}
          onChange={(value) => onSortChange(value as SortBy)}
          aria-label="Sort library"
          data-cell-id="library-sort-select"
          className={styles.sortSelect}
        />
        <div className={styles.buttonRow}>
          <Button
            variant="primary"
            size="sm"
            onClick={onOpenFile}
            leadingIcon={<Icon name="plus" size={16} />}
            data-cell-id="playlist-add-files"
          >
            <span className={styles.btnLabel}>Add files</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onOpenFolder}
            leadingIcon={<Icon name="folderOpen" size={16} />}
            data-cell-id="playlist-add-folder"
          >
            <span className={styles.btnLabel}>Add folder</span>
          </Button>
          {videos.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              leadingIcon={<Icon name="trash" size={16} />}
              data-cell-id="playlist-clear-all"
            >
              <span className={styles.btnLabel}>Clear all</span>
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
