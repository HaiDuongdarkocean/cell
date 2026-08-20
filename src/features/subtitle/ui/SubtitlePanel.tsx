// SubtitlePanel — SSOT wrapper for CueList used by both Player Mode and Split View.
// Provides the flex-column + overflow:hidden container that lets CueList's .list
// (flex:1, min-height:0) become the sole scroll container.
//
// Usage:
//   Player Mode: <SubtitlePanel cues={...} currentTimeMs={...} offsetMs={...} onSeek={...} />
//   Split View:  <SubtitlePanel cues={...} currentTimeMs={...} offsetMs={...} onSeek={...} onClose={...} />
//   Split View + Playlist (local-player):
//     <SubtitlePanel ... playlistContent={<LibraryView .../>} onOpenFile={...} onOpenFolder={...} />

import { memo, useState } from 'react';
import type { ReactNode } from 'react';
import type { BilingualCue } from '@/entities/media';
import { CueList } from '@/entrypoints/sidepanel/components/CueList';
import { Icon } from '@/shared/icons/Icon';
import { IconButton } from '@/shared/ui/IconButton';
import { Tabs } from '@/shared/ui';
import styles from './SubtitlePanel.module.css';

export interface SubtitlePanelProps {
  cues: BilingualCue[];
  currentTimeMs: number;
  /** ADR-019 sync: offset from content script. Highlight cue at
   *  effective = currentTimeMs + offsetMs to match the overlay. */
  offsetMs?: number;
  /** Seek video to timeMs when user clicks a cue. */
  onSeek: (timeMs: number) => void;
  /** Optional close button (Split View). Player Mode handles close via 't'. */
  onClose?: () => void;
  /** Optional Playlist tab content (local-player only). When provided, the
   *  panel renders Tabs (Subtitles | Playlist) instead of just CueList. */
  playlistContent?: ReactNode;
  /** Open file picker — rendered in Playlist tab footer (local-player only). */
  onOpenFile?: () => void;
  /** Open folder picker — rendered in Playlist tab footer (local-player only). */
  onOpenFolder?: () => void;
}

type PanelTab = 'subtitles' | 'playlist';

function SubtitlePanelImpl({
  cues,
  currentTimeMs,
  offsetMs,
  onSeek,
  onClose,
  playlistContent,
  onOpenFile,
  onOpenFolder,
}: SubtitlePanelProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<PanelTab>('subtitles');
  const hasPlaylist = playlistContent !== undefined;

  return (
    <div className={styles.panel} data-cell-id="subtitle-panel">
      {onClose && (
        <div className={styles.header}>
          <span className={styles.title}>Subtitles</span>
          <IconButton variant="transparent"
            aria-label="Close subtitle list"
            title="Close (T)"
            data-cell-id="subtitle-panel-close"
            size="sm"
            onClick={onClose}
          >
            <Icon name="x"  />
          </IconButton>
        </div>
      )}

      {hasPlaylist ? (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PanelTab)}>
          <Tabs.List className={styles.tabList}>
            <Tabs.Trigger value="subtitles" data-cell-id="subtitle-panel-tab-subtitles">
              <Icon name="captions" size={14} />
              Subtitles
            </Tabs.Trigger>
            <Tabs.Trigger value="playlist" data-cell-id="subtitle-panel-tab-playlist">
              <Icon name="video" size={14} />
              Playlist
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="subtitles" className={styles.tabContent}>
            <div className={styles.cueListWrap}>
              <CueList
                cues={cues}
                currentTimeMs={currentTimeMs}
                offsetMs={offsetMs}
                onSeek={onSeek}
              />
            </div>
          </Tabs.Content>

          <Tabs.Content value="playlist" className={styles.tabContent}>
            {playlistContent}
            {(onOpenFile || onOpenFolder) && (
              <footer className={styles.footer}>
                <div className={styles.buttonRow}>
                  {onOpenFile && (
                    <button
                      type="button"
                      className={styles.addFilesBtn}
                      onClick={onOpenFile}
                      aria-label="Add files"
                    >
                      <Icon name="plus" size={16} />
                      <span>Add files</span>
                    </button>
                  )}
                  {onOpenFolder && (
                    <button
                      type="button"
                      className={styles.addFolderBtn}
                      onClick={onOpenFolder}
                      aria-label="Add folder"
                    >
                      <Icon name="folderOpen" size={16} />
                      <span>Add folder</span>
                    </button>
                  )}
                </div>
                <p className={styles.dragHint}>You can also drag-and-drop</p>
              </footer>
            )}
          </Tabs.Content>
        </Tabs>
      ) : (
        <div className={styles.cueListWrap}>
          <CueList
            cues={cues}
            currentTimeMs={currentTimeMs}
            offsetMs={offsetMs}
            onSeek={onSeek}
          />
        </div>
      )}
    </div>
  );
}

export const SubtitlePanel = memo(SubtitlePanelImpl);
