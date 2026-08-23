import { useState } from 'react';
import type { VideoRecord, SubtitleRecord } from '@/features/local-player/services/mediaLibraryRepository';
import type { SortBy } from '@/features/local-player/logic/librarySort';
import { Select, Tabs } from '@/shared/ui';
import { Icon } from '@/shared/icons/Icon';
import { LibraryCard } from './LibraryCard';
import { SubtitleCard } from './SubtitleCard';
import styles from './LibraryView.module.css';

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'recent', label: 'Recently watched' },
  { value: 'title', label: 'Title' },
  { value: 'added', label: 'Date added' },
];

interface LibraryViewProps {
  videos: VideoRecord[];
  subtitles: SubtitleRecord[];
  sortBy: SortBy;
  onSortChange: (sortBy: SortBy) => void;
  onVideoSelect: (videoId: string) => void;
  onSubtitleSelect: (subtitleId: string) => void;
}

/**
 * LibraryView — tabbed library with Videos + Subtitles tabs.
 *
 * Videos tab: scrollable list of LibraryCard entries with sort dropdown.
 * Subtitles tab: scrollable list of SubtitleCard entries.
 */
export function LibraryView({
  videos,
  subtitles,
  sortBy,
  onSortChange,
  onVideoSelect,
  onSubtitleSelect,
}: LibraryViewProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState('videos');

  return (
    <div className={styles.root}>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List className={styles.tabList}>
          <Tabs.Trigger value="videos" data-cell-id="library-tab-videos">
            <Icon name="video" size={14} />
            Videos
          </Tabs.Trigger>
          <Tabs.Trigger value="subtitles" data-cell-id="library-tab-subtitles">
            <Icon name="captions" size={14} />
            Subtitles
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="videos">
          <div className={styles.header}>
            <span className={styles.sortLabel}>
              <Icon name="clock" size={14} />
              <Select
                options={SORT_OPTIONS}
                value={sortBy}
                onChange={(value) => onSortChange(value as SortBy)}
                aria-label="Sort library"
                data-cell-id="library-sort-select"
              />
            </span>
          </div>

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
              {videos.map((video) => (
                <LibraryCard
                  key={video.id}
                  video={video}
                  onClick={() => onVideoSelect(video.id)}
                />
              ))}
            </div>
          )}
        </Tabs.Content>

        <Tabs.Content value="subtitles">
          {subtitles.length === 0 ? (
            <div className={styles.empty} data-cell-id="subtitles-empty" role="status">
              <div className={styles.emptyIcon}>
                <Icon name="captions" size={48} />
              </div>
              <div className={styles.emptyTitle}>No subtitles yet</div>
              <div className={styles.emptyDesc}>
                Open subtitle files to add them to your library.
              </div>
            </div>
          ) : (
            <div className={styles.list}>
              {subtitles.map((sub) => (
                <SubtitleCard
                  key={sub.id}
                  subtitle={sub}
                  onClick={() => onSubtitleSelect(sub.id)}
                />
              ))}
            </div>
          )}
        </Tabs.Content>
      </Tabs>
    </div>
  );
}
