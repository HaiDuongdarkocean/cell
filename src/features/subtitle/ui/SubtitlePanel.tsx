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
import type { PlaybackSpeed } from '@/entities/studyMode/types';
import { CueList } from '@/entrypoints/sidepanel/components/CueList';
import { PracticeOptions, SubtitlePracticeSession } from '@/features/studyModes/ui/SubtitlePractice';
import type { SubtitlePracticeMode } from '@/features/studyModes/lib/subtitlePractice';
import { ChevronRight } from 'lucide-react';

import { Button, EmptyState, Tabs } from '@/shared/ui';
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
  practiceMode?: SubtitlePracticeMode;
  onPracticeModeChange?: (mode: SubtitlePracticeMode) => void;
  isPlaying?: boolean;
  playbackSpeed?: PlaybackSpeed;
  onPlaybackSpeedChange?: (speed: PlaybackSpeed) => void;
  onPlayPause?: () => void;
  onPreviousCue?: (cue: BilingualCue) => void;
  onReplayCue?: (cue: BilingualCue) => void;
  onContinueCue?: (cue: BilingualCue) => void;
}

type PanelTab = 'subtitles' | 'playlist';

const noop = (): void => undefined;

function SubtitlePanelImpl({
  cues,
  currentTimeMs,
  offsetMs = 0,
  onSeek,
  onClose,
  playlistContent,
  filename,
  practiceMode = 'off',
  onPracticeModeChange,
  isPlaying = false,
  playbackSpeed = 1,
  onPlaybackSpeedChange,
  onPlayPause,
  onPreviousCue,
  onReplayCue,
  onContinueCue,
}: SubtitlePanelProps): React.JSX.Element {
  const hasPlaylist = playlistContent !== undefined;
  // Default to 'playlist' when no cues (e.g. local player just opened, no video
  // loaded yet) so the user can pick a video to resume. Otherwise 'subtitles'.
  const [activeTab, setActiveTab] = useState<PanelTab>(cues.length > 0 ? 'subtitles' : 'playlist');
  const [translationEnabled, setTranslationEnabled] = useState(true);

  const handlePreviousCue = (cue: BilingualCue): void => {
    if (onPreviousCue) {
      onPreviousCue(cue);
      return;
    }
    const i = cues.findIndex((c) => c.index === cue.index && c.start === cue.start);
    if (i > 0) onSeek(cues[i - 1].start);
  };

  const handleReplayCue = (cue: BilingualCue): void => {
    if (onReplayCue) {
      onReplayCue(cue);
      return;
    }
    onSeek(cue.start);
  };

  const handleContinueCue = (cue: BilingualCue): void => {
    if (onContinueCue) {
      onContinueCue(cue);
      return;
    }
    const i = cues.findIndex((c) => c.index === cue.index && c.start === cue.start);
    const next = i >= 0 ? cues[i + 1] : undefined;
    if (next) onSeek(next.start);
  };

  // Empty cue list → EmptyState instead of a blank area (same copy as the
  // side panel). flex:1 fills cueListWrap so content centers vertically.
  const subtitleContent = cues.length > 0 ? (
    practiceMode === 'off' ? (
      <CueList
        cues={cues}
        currentTimeMs={currentTimeMs}
        offsetMs={offsetMs}
        onSeek={onSeek}
      />
    ) : (
      <SubtitlePracticeSession
        mode={practiceMode}
        cues={cues}
        currentTimeMs={currentTimeMs}
        offsetMs={offsetMs}
        translationEnabled={translationEnabled}
        isPlaying={isPlaying}
        onSeek={onSeek}
        onPrevious={handlePreviousCue}
        onReplay={handleReplayCue}
        onContinue={handleContinueCue}
        onPlayPause={onPlayPause ?? noop}
      />
    )
  ) : (
    <EmptyState title="No subtitles loaded" size="compact" style={{ flex: 1 }} />
  );

  return (
    <div
      className={styles.panel}
      data-cell-id="subtitle-panel"
      data-practice-mode={practiceMode}
      data-has-close={onClose ? 'true' : 'false'}
    >
      <div className={styles.header} data-cell-id="subtitle-panel-header">
        {onClose && (
          <Button shape="circle" variant="transparent"
            aria-label="Collapse subtitle list"
            title="Collapse (T)"
            data-cell-id="subtitle-panel-close"
            size="sm"
            onClick={onClose}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        )}
        <span className={styles.title}>{filename ?? 'Subtitles'}</span>
      </div>
      {onPracticeModeChange && (
        <PracticeOptions
          mode={practiceMode}
          translationEnabled={translationEnabled}
          playbackSpeed={playbackSpeed}
          onModeChange={onPracticeModeChange}
          onTranslationChange={setTranslationEnabled}
          onPlaybackSpeedChange={onPlaybackSpeedChange ?? noop}
        />
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
              {subtitleContent}
            </div>
          </Tabs.Content>

          <Tabs.Content value="playlist" className={styles.tabContent}>
            {playlistContent}
          </Tabs.Content>
        </Tabs>
      ) : (
        <div className={styles.cueListWrap}>
          {subtitleContent}
        </div>
      )}
    </div>
  );
}

export const SubtitlePanel = memo(SubtitlePanelImpl);
