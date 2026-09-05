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
import { ChevronRight } from 'lucide-react';

import { Button, Tabs } from '@/shared/ui';
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
   *  panel renders Tabs (Subtitles | Playlist) instead of just CueList.
   *  The playlist content (LibraryView) owns its own footer with add-file /
   *  add-folder buttons — SubtitlePanel no longer renders them. */
  playlistContent?: ReactNode;
  /** Video filename shown in the panel header (local-player only). */
  filename?: string;
}

type PanelTab = 'subtitles' | 'playlist';

function SubtitlePanelImpl({
  cues,
  currentTimeMs,
  offsetMs,
  onSeek,
  onClose,
  playlistContent,
  filename,
}: SubtitlePanelProps): React.JSX.Element {
  const hasPlaylist = playlistContent !== undefined;
  // Default to 'playlist' when no cues (e.g. local player just opened, no video
  // loaded yet) so the user can pick a video to resume. Otherwise 'subtitles'.
  const [activeTab, setActiveTab] = useState<PanelTab>(cues.length > 0 ? 'subtitles' : 'playlist');

  return (
    <div className={styles.panel} data-cell-id="subtitle-panel">
      {onClose && (
        <div className={styles.header}>
          <Button shape="circle" material="liquid" variant="transparent"
            aria-label="Collapse subtitle list"
            title="Collapse (T)"
            data-cell-id="subtitle-panel-close"
            size="sm"
            onClick={onClose}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
          <span className={styles.title}>{filename ?? 'Subtitles'}</span>
        </div>
      )}

      {hasPlaylist ? (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PanelTab)}>
          <Tabs.List className={styles.tabList}>
            <Tabs.Trigger value="subtitles" data-cell-id="subtitle-panel-tab-subtitles">
              Subtitles
            </Tabs.Trigger>
            <Tabs.Trigger value="playlist" data-cell-id="subtitle-panel-tab-playlist">
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
