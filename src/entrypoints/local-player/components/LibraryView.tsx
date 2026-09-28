import { useMemo } from 'react';
import { t, type MessageKey } from '@/shared/i18n';
import type { VideoRecord, SubtitleRecord } from '@/features/local-player/services/mediaLibraryRepository';
import type { SortBy } from '@/features/local-player/logic/librarySort';
import type { SubtitleMatch, MatchResult } from '@/features/local-player/logic/subtitleMatch';
import { matchSubtitles } from '@/features/local-player/logic/subtitleMatch';
import type { SubtitlesState } from '@/entrypoints/local-player/hooks/useLocalPlayerStore';
import { Button, EmptyState, Select } from '@/shared/ui';
import { Icon } from '@/shared/ui/Icon';
import { LibraryCard } from './LibraryCard';
import { ImmersionStats } from './ImmersionStats';
import styles from './LibraryView.module.css';

const SORT_OPTIONS: { value: SortBy; labelKey: MessageKey }[] = [
  { value: 'recent', labelKey: 'library.sort.recent' },
  { value: 'title', labelKey: 'library.sort.title' },
  { value: 'added', labelKey: 'library.sort.added' },
  { value: 'fit', labelKey: 'library.sort.fit' },
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
      <ImmersionStats />
      {videos.length === 0 ? (
        <EmptyState
          icon={<Icon name="video" size="lg" />}
          title={t('library.empty.title')}
          description={t('library.empty.desc')}
          data-cell-id="library-empty"
        />
      ) : (
        <div className={styles.list} role="list">
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
          options={SORT_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
          value={sortBy}
          onChange={(value) => onSortChange(value as SortBy)}
          aria-label={t('library.sort.aria')}
          data-cell-id="library-sort-select"
          className={styles.sortSelect}
        />
        <div className={styles.buttonRow}>
          <Button
            variant="primary"
            size="sm"
            onClick={onOpenFile}
            leadingIcon={<Icon name="plus" size="xs" />}
            data-cell-id="playlist-add-files"
          >
            <span className={styles.btnLabel}>{t('library.action.addFiles')}</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onOpenFolder}
            leadingIcon={<Icon name="folderOpen" size="xs" />}
            data-cell-id="playlist-add-folder"
          >
            <span className={styles.btnLabel}>{t('library.action.addFolder')}</span>
          </Button>
          {videos.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              leadingIcon={<Icon name="trash" size="xs" />}
              data-cell-id="playlist-clear-all"
            >
              <span className={styles.btnLabel}>{t('library.action.clearAll')}</span>
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
